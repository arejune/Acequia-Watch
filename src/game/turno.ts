// Turno: an arcade game. Water comes down the acequia madre; open and close
// compuertas (gates) to keep four fields growing. Debris clogs open gates,
// storms send a surge that floods open fields, dry spells cut the flow.
// Pure logic, no DOM: the screen calls step() every frame and tap() on touch.

export const W = 360
export const H = 600
export const DITCH_X = 180
export const DITCH_TOP = 70
export const DITCH_BOTTOM = 580

export interface Field { x: number; y: number; w: number; h: number; gateY: number; side: -1 | 1; moisture: number; growth: number; flood: number; dead: number; open: boolean; clog: number | null; perfect: boolean }
export interface Debris { id: number; y: number; x: number; spin: number; kind: 0 | 1 | 2; stuckAt: number | null }
type EventKind = 'storm' | 'drought' | 'debris'
interface GameEvent { kind: EventKind; warn: number; left: number }
interface Pop { x: number; y: number; text: string; age: number; tone: 'good' | 'bad' }

export interface Game {
  t: number
  score: number
  harvests: number
  lives: number
  level: number
  flow: number
  fields: Field[]
  debris: Debris[]
  event: GameEvent | null
  nextEvent: number
  nextDebris: number
  pops: Pop[]
  over: boolean
  /** practice mode: no weather, no random debris */
  calm: boolean
  rng: () => number
  idSeq: number
}

/** What happened this step or tap, so the screen can buzz or play a sound. */
export type Signal = 'harvest' | 'lost' | 'clear' | 'toggle' | 'storm' | 'drought' | 'over'

export const RATES = {
  fill: 0.24,         // moisture per second for one open gate at normal flow
  dry: 0.055,         // base moisture lost per second
  grow: 0.085,        // growth per second while moisture is in the good band
  bandLow: 0.3,
  bandHigh: 0.88,
  floodLimit: 1.6,    // seconds at full moisture before the crop drowns
  replant: 2.2,       // seconds before a lost field is replanted
  debrisSpeed: 46,    // px per second down the ditch
}

function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const FIELD_LAYOUT: { y: number; side: -1 | 1 }[] = [
  { y: 120, side: -1 },
  { y: 220, side: 1 },
  { y: 330, side: -1 },
  { y: 430, side: 1 },
]

export function newGame(seed = Date.now()): Game {
  const fields: Field[] = FIELD_LAYOUT.map(({ y, side }) => {
    const w = 132
    const h = 96
    const x = side < 0 ? DITCH_X - 26 - w : DITCH_X + 26
    return { x, y, w, h, gateY: y + h / 2, side, moisture: 0.55, growth: 0, flood: 0, dead: 0, open: false, clog: null, perfect: true }
  })
  return { t: 0, score: 0, harvests: 0, lives: 3, level: 1, flow: 1, fields, debris: [], event: null, nextEvent: 14, nextDebris: 6, pops: [], over: false, calm: false, rng: mulberry32(seed), idSeq: 0 }
}

const targetFlow = (g: Game) => {
  const e = g.event
  if (!e || e.warn > 0) return 1
  if (e.kind === 'storm') return 2.6
  if (e.kind === 'drought') return 0.45
  return 1
}

export function step(g: Game, dt: number): Signal[] {
  if (g.over) return []
  dt = Math.min(dt, 0.1)
  const out: Signal[] = []
  g.t += dt
  g.flow += (targetFlow(g) - g.flow) * Math.min(1, dt * 2.5)

  // events
  if (g.event) {
    if (g.event.warn > 0) {
      g.event.warn -= dt
      if (g.event.warn <= 0) out.push(g.event.kind === 'storm' ? 'storm' : 'drought')
    } else {
      g.event.left -= dt
      if (g.event.kind === 'storm' && g.rng() < dt * 0.9) spawnDebris(g)
      if (g.event.left <= 0) g.event = null
    }
  } else if (!g.calm && g.t >= g.nextEvent) {
    const r = g.rng()
    const kind: EventKind = r < 0.42 ? 'storm' : r < 0.8 ? 'drought' : 'debris'
    g.event = { kind, warn: kind === 'debris' ? 0 : 2.2, left: kind === 'storm' ? 6 : kind === 'drought' ? 9 : 4 }
    if (kind === 'debris') for (let i = 0; i < 2 + g.level; i++) spawnDebris(g, i * 22)
    g.nextEvent = g.t + 15 + g.rng() * 8 - Math.min(6, g.level)
  }

  // debris drifts; the first open gate it meets catches it
  if (!g.calm) g.nextDebris -= dt
  if (g.nextDebris <= 0) {
    spawnDebris(g)
    g.nextDebris = Math.max(2.2, 7 - g.level * 0.7) + g.rng() * 3
  }
  for (const d of g.debris) {
    d.spin += dt * 1.8
    if (d.stuckAt !== null) continue
    const before = d.y
    d.y += RATES.debrisSpeed * (0.6 + g.flow * 0.4) * dt
    for (let i = 0; i < g.fields.length; i++) {
      const f = g.fields[i]
      if (f.open && f.clog === null && before < f.gateY && d.y >= f.gateY) {
        d.stuckAt = i
        d.y = f.gateY
        d.x = DITCH_X + f.side * 14
        f.clog = d.id
        break
      }
    }
  }
  g.debris = g.debris.filter((d) => d.stuckAt !== null || d.y < DITCH_BOTTOM + 20)

  // water: equal split between open, unclogged gates
  const live = g.fields.filter((f) => f.open && f.clog === null && f.dead === 0)
  const share = live.length ? (RATES.fill * g.flow) / Math.max(1, live.length * 0.85) : 0
  const heat = 1 + (g.level - 1) * 0.12 + (g.event?.kind === 'drought' && g.event.warn <= 0 ? 0.35 : 0)

  for (const f of g.fields) {
    if (f.dead > 0) {
      f.dead -= dt
      if (f.dead <= 0) { f.dead = 0; f.moisture = 0.55; f.growth = 0; f.flood = 0; f.perfect = true }
      continue
    }
    const watered = live.includes(f)
    f.moisture += ((watered ? share : 0) - RATES.dry * heat) * dt
    if (f.moisture >= 1) {
      f.moisture = 1
      f.flood += dt
    } else {
      f.flood = Math.max(0, f.flood - dt * 2)
    }
    const good = f.moisture >= RATES.bandLow && f.moisture <= RATES.bandHigh
    if (good) f.growth += RATES.grow * dt
    else f.perfect = false

    if (f.moisture <= 0 || f.flood >= RATES.floodLimit) {
      out.push(lose(g, f, f.moisture <= 0 ? 'Dried out' : 'Flooded'))
    } else if (f.growth >= 1) {
      const pts = 100 * g.level + (f.perfect ? 50 : 0)
      g.score += pts
      g.harvests += 1
      g.pops.push({ x: f.x + f.w / 2, y: f.y + 20, text: `+${pts}${f.perfect ? ' perfect' : ''}`, age: 0, tone: 'good' })
      f.growth = 0
      f.perfect = true
      out.push('harvest')
      if (g.harvests % 4 === 0) g.level += 1
    }
  }

  for (const p of g.pops) p.age += dt
  g.pops = g.pops.filter((p) => p.age < 1.4)

  if (g.lives <= 0 && !g.over) {
    g.over = true
    out.push('over')
  }
  return out
}

function lose(g: Game, f: Field, why: string): Signal {
  if (!g.calm) g.lives -= 1
  f.dead = RATES.replant
  f.growth = 0
  f.flood = 0
  f.open = false
  g.pops.push({ x: f.x + f.w / 2, y: f.y + 20, text: why, age: 0, tone: 'bad' })
  return 'lost'
}

export function spawnDebris(g: Game, offset = 0) {
  g.debris.push({ id: ++g.idSeq, y: DITCH_TOP - offset, x: DITCH_X + (g.rng() - 0.5) * 10, spin: g.rng() * 6, kind: Math.floor(g.rng() * 3) as 0 | 1 | 2, stuckAt: null })
}

/** A touch at game coordinates. Debris first (it is small and on top), then gates and fields. */
export function tap(g: Game, x: number, y: number): Signal[] {
  if (g.over) return []
  let best: Debris | null = null
  let bestD = 34
  for (const d of g.debris) {
    const dist = Math.hypot(d.x - x, d.y - y)
    if (dist < bestD) { best = d; bestD = dist }
  }
  if (best) {
    if (best.stuckAt !== null) g.fields[best.stuckAt].clog = null
    g.debris = g.debris.filter((d) => d !== best)
    g.score += 10
    return ['clear']
  }
  for (const f of g.fields) {
    const onGate = Math.abs(y - f.gateY) < 36 && Math.abs(x - (DITCH_X + f.side * 18)) < 40
    const onField = x >= f.x - 6 && x <= f.x + f.w + 6 && y >= f.y - 6 && y <= f.y + f.h + 6
    if (onGate || onField) {
      if (f.dead > 0) return []
      if (f.clog !== null) {
        g.debris = g.debris.filter((d) => d.id !== f.clog)
        f.clog = null
        g.score += 10
        return ['clear']
      }
      f.open = !f.open
      return ['toggle']
    }
  }
  return []
}

const BEST_KEY = 'aw-turno-best'
export function readBest(): number {
  try { return Number(localStorage.getItem(BEST_KEY)) || 0 } catch { return 0 }
}
export function saveBest(score: number): boolean {
  if (score <= readBest()) return false
  try { localStorage.setItem(BEST_KEY, String(score)) } catch { /* private mode */ }
  return true
}
