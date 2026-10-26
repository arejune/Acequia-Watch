// The Map tab. Stewards: their ditches and structures by status, with live
// location. Agency/admin: shared reports and gaps. Guests: the statewide map.
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Crosshair, Layers, LocateFixed } from 'lucide-react'
import { useSession } from './session'
import { useStewardData } from './steward/data'
import { useAgencyData } from './agency/data'
import { MapView, type Me, type MarkerSpec } from '../components/MapView'
import { OutcomeChip, TypeGlyph } from '../components/ui'
import { Sheet, haptic } from '../components/native'
import { ReportDetail, usePhotoUrls } from '../components/ReportDetail'
import { MapLegend } from './agency/parts'
import { ditchLines, isDemoAcequia } from '../demo/seed'
import { db } from '../db/local'
import { useBlobUrl, useLive } from '../lib/hooks'
import { haversine } from '../lib/geo'
import { typeLabel } from '../config/labels'
import { meters } from '../lib/format'

/** Live position while the map is open. Starts only when `on` is true. */
function useLivePosition(on: boolean) {
  const [me, setMe] = useState<Me | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    if (!on || !('geolocation' in navigator)) return
    const id = navigator.geolocation.watchPosition(
      (p) => { setMe({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy_m: Math.round(p.coords.accuracy) }); setError(null) },
      (e) => setError(e.code === e.PERMISSION_DENIED ? 'Location is off for this site.' : 'No GPS fix yet.'),
      { enableHighAccuracy: true, maximumAge: 5000 },
    )
    return () => navigator.geolocation.clearWatch(id)
  }, [on])
  return { me, error }
}

const distanceText = (m: number) => (m < 1000 ? `${Math.round(m)} m away` : `${(m / 1000).toFixed(1)} km away`)

function MapChrome({ me, error, onLocate, ose, setOse, demo = false, children }: { me: Me | null; error: string | null; onLocate: () => void; ose: boolean; setOse: (v: boolean) => void; demo?: boolean; children?: React.ReactNode }) {
  return (
    <>
      <div className="map-fabs">
        <button className="fab-round" onClick={() => { haptic(); setOse(!ose) }} aria-pressed={ose} aria-label="Show state acequia lines">
          <Layers size={22} aria-hidden />
        </button>
        <button className="fab-round" onClick={() => { haptic(); onLocate() }} aria-label="Center on my location">
          {me ? <LocateFixed size={22} aria-hidden /> : <Crosshair size={22} aria-hidden />}
        </button>
      </div>
      <div className="map-caption">
        {children}
        <span className="small">{me ? `You are here (${meters(me.accuracy_m)})` : error ?? 'Tap the target to show where you are.'}</span>
        {demo && <span className="small demo-note">Demo locations are invented and do not mark real structures.</span>}
      </div>
    </>
  )
}

function StewardMap() {
  const data = useStewardData()
  const nav = useNavigate()
  const [on, setOn] = useState(true)
  const { me, error } = useLivePosition(on)
  const [recenter, setRecenter] = useState(0)
  const [ose, setOse] = useState(false)
  const [open, setOpen] = useState<string | null>(null)

  const markers = useMemo<MarkerSpec[]>(() => {
    if (!data) return []
    const gapIds = new Set(data.coverage?.gaps.map((g) => g.structure.id))
    return [
      ...data.structures.map((s): MarkerSpec => {
        const a = data.byStructure.get(s.id)
        const done = a && !(a.sync_state === 'draft' && a.base_version === 0)
        return { id: s.id, lat: s.lat, lng: s.lng, kind: done ? a!.outcome : gapIds.has(s.id) ? 'gap' : 'structure', severity: a?.severity, label: `${s.name}: ${done ? a!.outcome.replace('_', ' ') : 'not assessed'}` }
      }),
      ...data.assessments.filter((a) => !a.structure_id && a.lat != null).map((a): MarkerSpec => ({ id: `a:${a.id}`, lat: a.lat!, lng: a.lng!, kind: a.outcome, severity: a.severity, unlisted: true, label: a.unlisted_name || 'Unlisted damage' })),
    ]
  }, [data])
  const lines = useMemo(() => ditchLines.filter((l) => data?.acequias.some((q) => q.id === l.acequia_id)).map((l) => ({ id: l.acequia_id, coords: l.coords, label: l.name })), [data])
  const onClick = useCallback((id: string) => { haptic(); setOpen(id) }, [])

  const s = open && !open.startsWith('a:') ? data?.structures.find((x) => x.id === open) : null
  const a = s ? data?.byStructure.get(s.id) : open?.startsWith('a:') ? data?.assessments.find((x) => x.id === open.slice(2)) : null
  const baseline = useLive(() => (s?.baseline_photo_id ? db.photos.get(s.baseline_photo_id) : Promise.resolve(undefined)), [s?.baseline_photo_id])
  const thumb = useBlobUrl(baseline?.thumb ?? baseline?.blob)
  const remote = usePhotoUrls(baseline && !thumb && navigator.onLine ? [baseline] : [])
  const img = thumb ?? (baseline ? remote[baseline.id] : undefined)

  return (
    <div className="map-screen">
      <MapView label="Field map of your structures" height="100%" markers={markers} lines={lines} ose={ose} me={me} recenter={recenter} onMarkerClick={onClick} />
      <MapChrome me={me} error={error} ose={ose} setOse={setOse} demo={!!data?.acequias.some((q) => isDemoAcequia(q.id))} onLocate={() => { setOn(true); setRecenter((n) => n + 1) }}>
        <ul className="legend legend-compact" aria-label="Map legend">
          <li><span className="aw-marker damaged sev-3" style={{ width: 16, height: 16, background: 'var(--sev-3)', fontSize: 9 }}>3</span> Damaged</li>
          <li><span className="aw-marker no_damage" style={{ width: 14, height: 14, fontSize: 8 }}>✓</span> OK</li>
          <li><span className="aw-marker gap" style={{ width: 14, height: 14 }} /> Gap</li>
        </ul>
      </MapChrome>
      <Sheet open={!!open} onClose={() => setOpen(null)} title={s?.name ?? a?.unlisted_name ?? 'Unlisted damage'}>
        <div className="row">
          <TypeGlyph type={s?.type ?? a?.unlisted_type} />
          <div className="grow">
            <div className="small muted">{typeLabel(s?.type ?? a?.unlisted_type)}{me && (s || a?.lat) && ` · ${distanceText(haversine(me, s ?? { lat: a!.lat!, lng: a!.lng! }))}`}</div>
            <div className="mt-8"><OutcomeChip outcome={a && !(a.sync_state === 'draft' && a.base_version === 0) ? a.outcome : 'gap'} /></div>
          </div>
        </div>
        {img && <img className="sheet-photo" src={img} alt={`Before the disaster: ${s?.name}`} />}
        {!img && s && <p className="small muted mt-8">No pre-disaster photo yet.</p>}
        <div className="stack mt-16" style={{ '--stack': '8px' } as React.CSSProperties}>
          <button className="btn btn-primary btn-block" onClick={() => nav(a ? `/steward/report/${a.id}` : `/steward/report/new?structure=${s!.id}`)}>
            {a ? 'Open report' : 'Assess this structure'}
          </button>
          {s && <Link className="btn btn-block" to={`/steward/inventory/${s.id}`}>Inventory details</Link>}
        </div>
      </Sheet>
    </div>
  )
}

function AgencyMap() {
  const d = useAgencyData()
  const [ose, setOse] = useState(true)
  const [on, setOn] = useState(false)
  const { me, error } = useLivePosition(on)
  const [recenter, setRecenter] = useState(0)
  const [open, setOpen] = useState<string | null>(null)
  const v = d.view
  const markers = useMemo<MarkerSpec[]>(() => v ? [
    ...v.coverage.gaps.map((g): MarkerSpec => ({ id: `gap:${g.structure.id}`, lat: g.structure.lat, lng: g.structure.lng, kind: 'gap', label: `Not assessed: ${g.structure.name}` })),
    ...v.data.assessments.filter((a) => a.lat != null).map((a): MarkerSpec => ({ id: a.id, lat: a.lat!, lng: a.lng!, kind: a.outcome, severity: a.severity, unlisted: !a.structure_id, label: `${v.structureName(a)}: ${a.outcome.replace('_', ' ')}` })),
  ] : [], [v])
  const lines = useMemo(() => ditchLines.filter((l) => v?.data.acequias.some((q) => q.id === l.acequia_id)).map((l) => ({ id: l.acequia_id, coords: l.coords, label: l.name })), [v])
  const onClick = useCallback((id: string) => { haptic(); setOpen(id) }, [])
  const sel = v?.data.assessments.find((a) => a.id === open)
  const gap = open?.startsWith('gap:') ? v?.data.structures.find((s) => s.id === open.slice(4)) : null

  return (
    <div className="map-screen">
      <MapView label="Map of shared reports and gaps" height="100%" markers={markers} lines={lines} ose={ose} me={me} recenter={recenter} onMarkerClick={onClick} />
      <MapChrome me={me} error={on ? error : null} ose={ose} setOse={setOse} demo={!!v?.data.acequias.some((q) => isDemoAcequia(q.id))} onLocate={() => { setOn(true); setRecenter((n) => n + 1) }}>
        {d.event && <strong className="small">{d.event.name}</strong>}
        <MapLegend />
      </MapChrome>
      <Sheet open={!!open} onClose={() => setOpen(null)} title={sel ? v!.structureName(sel) : gap?.name ?? ''} tall={!!sel}>
        {sel && v && (
          <ReportDetail a={sel} title={v.structureName(sel)} acequia={v.data.acequias.find((q) => q.id === sel.acequia_id)?.name ?? ''}
            photos={v.data.photos.filter((p) => p.assessment_id === sel.id)}
            baseline={v.data.photos.find((p) => p.id === v.data.structures.find((s) => s.id === sel.structure_id)?.baseline_photo_id) ?? null} />
        )}
        {gap && <p>{typeLabel(gap.type)} in the pre-disaster inventory. Nobody has assessed it for this event yet, so any damage here is not in the totals.</p>}
      </Sheet>
    </div>
  )
}

function PublicMap() {
  const [on, setOn] = useState(false)
  const { me, error } = useLivePosition(on)
  const [recenter, setRecenter] = useState(0)
  const [ose, setOse] = useState(true)
  return (
    <div className="map-screen">
      <MapView label="Acequias reported to the New Mexico State Engineer" height="100%" ose={ose} fitTo="state" me={me} recenter={recenter} />
      <MapChrome me={me} error={on ? error : null} ose={ose} setOse={setOse} onLocate={() => { setOn(true); setRecenter((n) => n + 1) }}>
        <span className="small"><strong>Blue lines:</strong> named acequias. <strong>Dots:</strong> headgates. State data, as-is and incomplete.</span>
      </MapChrome>
    </div>
  )
}

export function FieldMap() {
  const { profile } = useSession()
  if (profile?.role === 'steward') return <StewardMap />
  if (profile) return <AgencyMap />
  return <PublicMap />
}
