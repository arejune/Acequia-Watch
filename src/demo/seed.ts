// Fictional demo data, generated deterministically so the local backend and
// the Supabase seed script produce identical rows.
//
// Everything here is invented: the Río Sombra valley, its acequias, the fire.
// Coordinates sit inside the San Pedro Parks Wilderness (Santa Fe National
// Forest): no homes, no acequias on the State Engineer's map, and away from
// the 2022 Hermits Peak–Calf Canyon and Black Fire burn areas.
//
// Synthetic "truth" for the gap-priority test: each structure's chance of
// damage falls off with distance from a debris-flow hotspot. 12 structures
// are truly damaged; 8 of those and 20 undamaged ones are assessed; the 12
// left blank hide 4 damaged ones. This spatial model is an assumption, so the
// test is a sanity check of the heuristic, not evidence about real floods.
import type { Acequia, Assessment, AwEvent, EventShare, Photo, Structure, StructureType } from '../db/types'

function mulberry32(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const rand = mulberry32(20261021)
const shuffle = <T,>(xs: T[]) => {
  for (let i = xs.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[xs[i], xs[j]] = [xs[j], xs[i]]
  }
  return xs
}
function seededUuid() {
  const h = Array.from({ length: 32 }, () => Math.floor(rand() * 16).toString(16))
  h[12] = '4'
  h[16] = '89ab'[Math.floor(rand() * 4)]
  const s = h.join('')
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20)}`
}

// local meters -> lat/lng around an origin in the San Pedro Parks Wilderness
const ORIGIN = { lat: 36.095, lng: -106.835 }
const M_PER_DEG_LAT = 111_320
const M_PER_DEG_LNG = 111_320 * Math.cos((ORIGIN.lat * Math.PI) / 180)
const toLL = (x: number, y: number) => ({
  lat: +(ORIGIN.lat + y / M_PER_DEG_LAT).toFixed(6),
  lng: +(ORIGIN.lng + x / M_PER_DEG_LNG).toFixed(6),
})

export const DEMO_USERS = {
  steward: { email: 'steward@demo.acequiawatch.org', display_name: 'Demo Commission Member (two acequias)', role: 'steward' },
  steward2: { email: 'steward2@demo.acequiawatch.org', display_name: 'Demo Steward (Ojo Escondido)', role: 'steward' },
  agency: { email: 'agency@demo.acequiawatch.org', display_name: 'Demo Agency Reviewer', role: 'agency' },
  admin: { email: 'admin@demo.acequiawatch.org', display_name: 'Demo Admin', role: 'admin' },
} as const
export const DEMO_PASSWORD = 'demo-acequia-2026'

// Ditches follow the slope, so each is a gentle curve, sampled every 100 m.
const curve = (x0: number, x1: number, f: (x: number) => number) =>
  Array.from({ length: Math.round((x1 - x0) / 100) + 1 }, (_, i) => { const x = x0 + i * 100; return [x, Math.round(f(x))] })

const ditchDefs = [
  {
    name: 'Acequia Madre del Río Sombra',
    region: 'Upper Río Sombra',
    blurb: 'Fictional. The oldest ditch in the made-up Río Sombra valley, on the north bank.',
    path: curve(0, 2500, (x) => -0.11 * x + 150 * Math.sin(x / 380)),
    count: 15,
  },
  {
    name: 'Acequia de la Loma Quemada',
    region: 'Upper Río Sombra',
    blurb: 'Fictional. A south-bank ditch below the burned ridge.',
    path: curve(350, 2300, (x) => -560 - 0.09 * (x - 350) + 120 * Math.sin((x - 350) / 330 + 1)),
    count: 14,
  },
  {
    name: 'Acequia del Ojo Escondido',
    region: 'Lower Río Sombra',
    blurb: 'Fictional. A small spring-fed ditch farther down the valley.',
    path: curve(3000, 4500, (x) => -820 - 0.17 * (x - 3000) + 90 * Math.sin((x - 3000) / 280)),
    count: 11,
  },
]

// a tributary arroyo entering near x=1150: where the debris flow hit
const HOTSPOT = { x: 1150, y: -330 }

const typeCycle: StructureType[] = ['presa', 'headgate', 'culvert', 'ditch_segment', 'headgate', 'flume', 'sand_trap', 'headgate', 'culvert', 'ditch_segment', 'other', 'headgate', 'culvert', 'ditch_segment', 'headgate']
/** One unique, descriptive name per structure. No real surnames or places. */
const NAMES: Record<StructureType, string[]> = {
  presa: ['Presa at the river bend', 'Rock presa below the spring', 'Brush presa at the narrows'],
  headgate: ['Headgate by the cottonwoods', 'Lower field compuerta', 'Compuerta at the old orchard', 'Headgate above the chile field', 'Compuerta by the stone wall', 'Split-box headgate', 'Compuerta at the upper pasture', 'Headgate at the road bend', 'Compuerta at the alfalfa strip', 'Headgate by the burn line', 'Compuerta near the corral', 'Headgate at the long field', 'Compuerta by the plum trees', 'Headgate below the mesa trail', 'Compuerta at the bean field'],
  culvert: ['Road-crossing culvert', 'Culvert under the forest road', 'Driveway culvert by the gate', 'Culvert at the arroyo crossing', 'Culvert under the two-track', 'Culvert below the cattle guard', 'Culvert at the sheep crossing', 'Culvert by the mailbox turnout', 'Culvert under the ridge road'],
  flume: ['Flume over the arroyo', 'Wooden canoa at the gully', 'Steel flume at the side canyon'],
  sand_trap: ['Sand trap below the presa', 'Settling box at the bend', 'Sand trap by the spring'],
  ditch_segment: ['Ditch along the burned slope', 'Ditch through the willows', 'Lined ditch at the switchback', 'Ditch below the ridge trail', 'Ditch at the rock outcrop', 'Ditch by the beaver ponds', 'Earthen ditch at the meadow', 'Ditch along the fence line', 'Ditch past the old mill site'],
  other: ['Spill box at the tail', 'Overflow gate by the pond', 'Diversion box at the fork'],
}
const used: Record<string, number> = {}
const nameFor = (t: StructureType) => NAMES[t][(used[t] = (used[t] ?? -1) + 1)]

/** A point a fraction t of the way along a path, by distance. */
function along(path: number[][], t: number) {
  const lens = path.slice(1).map((p, i) => Math.hypot(p[0] - path[i][0], p[1] - path[i][1]))
  let d = t * lens.reduce((a, b) => a + b, 0)
  for (let i = 0; i < lens.length; i++) {
    if (d <= lens[i] || i === lens.length - 1) {
      const u = lens[i] ? Math.min(1, d / lens[i]) : 0
      return { x: path[i][0] + (path[i + 1][0] - path[i][0]) * u, y: path[i][1] + (path[i + 1][1] - path[i][1]) * u }
    }
    d -= lens[i]
  }
  return { x: path[0][0], y: path[0][1] }
}

export const EVENT_ID = '7f1c2a40-5d3e-4b6f-9a10-2c8e1f0d9b01'
export const event: AwEvent = {
  id: EVENT_ID,
  name: 'Cerro Sombra Fire and post-fire flooding',
  kind: 'fire',
  started_on: '2026-06-14',
  threshold_usd: null, // agency staff type the threshold that applies; the app suggests none
}

export const acequias: Acequia[] = ditchDefs.map((d) => ({ id: seededUuid(), name: d.name, region: d.region, ose_ref: null, blurb: d.blurb }))

/** True for the made-up acequias, so maps can say their points are invented. */
export const isDemoAcequia = (id: string) => acequias.some((a) => a.id === id)

export const ditchLines = ditchDefs.map((d, i) => ({
  acequia_id: acequias[i].id,
  name: d.name,
  coords: d.path.map(([x, y]) => toLL(x, y)),
}))

interface Draft { s: Structure; x: number; y: number }
const drafts: Draft[] = ditchDefs.flatMap((d, i) =>
  Array.from({ length: d.count }, (_, k) => {
    const type = typeCycle[k % typeCycle.length]
    const p = along(d.path, (k + 0.3 * rand()) / d.count)
    const jitter = { x: (rand() - 0.5) * 10, y: (rand() - 0.5) * 10 }
    const { lat, lng } = toLL(p.x + jitter.x, p.y + jitter.y)
    const name = nameFor(type)
    return {
      x: p.x, y: p.y,
      s: {
        id: seededUuid(), acequia_id: acequias[i].id, type, name, lat, lng,
        accuracy_m: Math.round(3 + rand() * 9), notes: '', baseline_photo_id: null,
        created_at: '2025-04-12T16:00:00Z', retired_at: null, updated_at: '2025-04-12T16:00:00Z', version: 1,
      },
    }
  }),
)
export const structures: Structure[] = drafts.map((d) => d.s)

// --- synthetic truth: weighted draw of 12 damaged structures, no replacement
const weight = (d: Draft) => Math.exp(-Math.hypot(d.x - HOTSPOT.x, d.y - HOTSPOT.y) / 700)
const pool = [...drafts]
const trulyDamaged = new Set<string>()
while (trulyDamaged.size < 12) {
  const total = pool.reduce((s, d) => s + weight(d), 0)
  let r = rand() * total
  const i = pool.findIndex((d) => (r -= weight(d)) <= 0)
  trulyDamaged.add(pool.splice(i === -1 ? pool.length - 1 : i, 1)[0].s.id)
}
const damagedIds = shuffle(structures.filter((s) => trulyDamaged.has(s.id)).map((s) => s.id))
const fineIds = shuffle(structures.filter((s) => !trulyDamaged.has(s.id)).map((s) => s.id))
const assessedDamaged = new Set(damagedIds.slice(0, 8))
const assessedFine = new Set(fineIds.slice(0, 20))

/** Hidden column for the gap-priority test only. Never shown in the app. */
export const hiddenDamagedGaps = damagedIds.slice(8)

/** What a steward might write, by structure type and severity (1 minor … 4 destroyed). */
const DESC: Record<StructureType, [string, string, string, string]> = {
  headgate: ['Gate sticks halfway; ash and silt in the slot. Water still gets through.', 'Gate board cracked and the frame packed with mud. Only part of the water passes.', 'A log knocked the gate off its frame. No water past this point.', 'Headgate and its concrete box are gone, washed downstream.'],
  culvert: ['Inlet half full of gravel. Water still passes.', 'Pipe partly crushed at the outlet; flow is slow.', 'Pipe plugged solid with gravel and burned branches.', 'Road washed out over the culvert and the pipe is missing.'],
  ditch_segment: ['Thin layer of ash and silt along the bottom. Still flowing.', 'Silt and debris fill about half the channel for roughly 30 m.', 'Bank washed out on the downhill side; water spills onto the slope.', 'About 60 m of ditch buried under a debris flow.'],
  presa: ['A few rocks shifted; the diversion still works.', 'Brush and rocks partly swept away; less water turns into the ditch.', 'Boulders and burned logs piled across the diversion; no water enters the ditch.', 'Diversion washed out; the river cut a new channel.'],
  flume: ['Silt in the trough. Water still crosses.', 'One support leaning; the flume leaks at a joint.', 'Flume knocked off one support; water spills into the arroyo.', 'Flume carried away by the flood.'],
  sand_trap: ['Box half full of sand. Still passing water.', 'Box full of sand and ash; most water overflows.', 'Box walls cracked and filled with debris.', 'Box buried and broken.'],
  other: ['Spill gate stiff but working.', 'Overflow gate jammed with branches.', 'Box cracked; water leaks around it.', 'Box destroyed.'],
}
const costBySeverity = { 1: [500, 1_500], 2: [2_000, 7_000], 3: [9_000, 35_000], 4: [30_000, 110_000] } as const
/** Round to a believable estimate: $500 steps below $10k, $1,000 steps above. */
const roundCost = (n: number) => (n < 10_000 ? Math.max(500, Math.round(n / 500) * 500) : Math.round(n / 1000) * 1000)
const usedDesc = new Set<string>()

export const assessments: Assessment[] = []
export const photos: Photo[] = []
for (const s of structures) {
  const damaged = assessedDamaged.has(s.id)
  if (!damaged && !assessedFine.has(s.id)) continue
  const id = seededUuid()
  const day = 15 + Math.floor(rand() * 6)
  const captured_at = `2026-06-${day}T${10 + Math.floor(rand() * 7)}:${String(Math.floor(rand() * 60)).padStart(2, '0')}:00-06:00`
  const base: Assessment = {
    id, event_id: EVENT_ID, acequia_id: s.acequia_id, structure_id: s.id, unlisted_type: null, unlisted_name: null,
    outcome: 'no_damage', severity: null, description: '', agency_notes: '',
    cost_low: null, cost_likely: null, cost_high: null, volunteer_hours: Math.round(rand() * 3),
    lat: s.lat, lng: s.lng, accuracy_m: Math.round(4 + rand() * 10), location_source: 'gps',
    photo_ids: [], captured_at, updated_at: captured_at, version: 1,
  }
  if (damaged) {
    // a severity whose description this type hasn't used yet, so no two reports read the same
    let severity = (1 + Math.floor(rand() * 4)) as 1 | 2 | 3 | 4
    for (let k = 0; k < 4 && usedDesc.has(`${s.type}${severity}`); k++) severity = ((severity % 4) + 1) as 1 | 2 | 3 | 4
    usedDesc.add(`${s.type}${severity}`)
    const [lo, hi] = costBySeverity[severity]
    const likely = roundCost(lo + rand() * (hi - lo))
    const low = Math.min(likely, roundCost(likely * (0.35 + rand() * 0.45)))
    const high = Math.max(likely, roundCost(likely * (1.25 + rand() * 1.4)))
    const photoId = seededUuid()
    Object.assign(base, {
      outcome: 'damaged', severity, description: DESC[s.type][severity - 1],
      cost_low: low, cost_likely: likely, cost_high: high,
      volunteer_hours: 4 + Math.round(rand() * 20), photo_ids: [photoId],
    })
    photos.push({
      id: photoId, acequia_id: s.acequia_id, assessment_id: id, structure_id: null,
      storage_path: `${s.acequia_id}/${EVENT_ID}/${id}/${photoId}.svg`, width: 1200, height: 900, bytes: 0, taken_at: captured_at,
    })
  }
  assessments.push(base)
}

/** Acequias 1 and 2 have shared the event; acequia 3 has not (shows consent). */
export const shares = (stewardId: string): EventShare[] =>
  acequias.slice(0, 2).map((a) => ({ event_id: EVENT_ID, acequia_id: a.id, shared: true, changed_by: stewardId, changed_at: '2026-06-22T09:00:00-06:00' }))

export const membershipsFor = (ids: Record<keyof typeof DEMO_USERS, string>) => [
  { user_id: ids.steward, acequia_id: acequias[0].id },
  { user_id: ids.steward, acequia_id: acequias[1].id },
  { user_id: ids.steward2, acequia_id: acequias[2].id },
]

/** A flat illustration standing in for a damage photo. Clearly labeled. */
export function demoPhotoSvg(title: string, severity: number, before = false): string {
  const esc = (t: string) => t.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`)
  const debris = before ? '' : Array.from({ length: 4 + severity * 3 }, (_, i) =>
    `<rect x="${380 + ((i * 97) % 440)}" y="${560 + ((i * 53) % 90)}" width="${70 + ((i * 31) % 60)}" height="16" rx="8" fill="#3a2a1d" transform="rotate(${(i * 37) % 50 - 25} ${420 + ((i * 97) % 440)} ${570 + ((i * 53) % 90)})"/>`).join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 900" width="1200" height="900">
<rect width="1200" height="900" fill="#e9dcc3"/>
<path d="M0 420 L260 250 L470 380 L700 210 L980 360 L1200 260 L1200 900 L0 900Z" fill="#b9a27c"/>
<path d="M0 520 L1200 470 L1200 900 L0 900Z" fill="#9c7f57"/>
<path d="M0 640 C300 600 500 700 1200 620 L1200 720 C700 790 400 700 0 760Z" fill="${before ? '#3f7fb3' : '#6b6152'}"/>
${before ? '<path d="M0 500 L1200 470" stroke="#8aa36a" stroke-width="40"/>' : '<path d="M0 520 L1200 480" stroke="#3a3a3a" stroke-width="30" opacity="0.6"/>'}
<rect x="520" y="470" width="160" height="200" fill="#7d7468"/><rect x="545" y="500" width="110" height="150" fill="#5a524a"/>
${debris}
<rect x="0" y="0" width="1200" height="96" fill="#17140f"/>
<text x="40" y="62" font-family="sans-serif" font-size="38" font-weight="700" fill="#f4efe4">DEMO PHOTO · ${before ? 'before' : 'after'} · illustration</text>
<text x="40" y="860" font-family="sans-serif" font-size="40" font-weight="700" fill="#17140f">${esc(title)}</text>
</svg>`
}

// Pre-disaster ("before") photos for 30 of the 40 structures, so the
// inventory still shows the "no photo" nudge and before/after works.
// Generated last so the IDs above never change.
export const baselinePhotos: Photo[] = []
structures.forEach((s, i) => {
  if (i % 4 === 3) return
  const id = seededUuid()
  s.baseline_photo_id = id
  baselinePhotos.push({
    id, acequia_id: s.acequia_id, assessment_id: null, structure_id: s.id,
    storage_path: `${s.acequia_id}/baseline/${s.id}/${id}.svg`, width: 1200, height: 900, bytes: 0, taken_at: '2025-04-12T16:00:00Z',
  })
})

/** Bump when the generated data changes so the in-browser server reseeds. */
export const SEED_VERSION = 5
