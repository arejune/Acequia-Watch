// Quick report: camera first, then three taps. Built for one hand, bright sun,
// no signal. GPS is read in the background from the moment the screen opens.
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Camera, Check, MapPin, Plus } from 'lucide-react'
import { useStewardData, useSeverityScale } from './data'
import { db, type LocalAssessment } from '../../db/local'
import { addPhoto, newAssessment, saveAssessment, saveDraft, validateAssessment } from '../../db/actions'
import { syncNow } from '../../db/sync'
import { compressPhoto } from '../../lib/photo'
import { captureFix, haversine, type Fix } from '../../lib/geo'
import { useBlobUrl, useLive } from '../../lib/hooks'
import { meters } from '../../lib/format'
import { Notice, TypeGlyph, useToast } from '../../components/ui'
import { haptic } from '../../components/native'
import { OUTCOMES, STRUCTURE_TYPES, typeLabel } from '../../config/labels'
import type { Outcome } from '../../db/types'

/** Hand-off for a photo taken from the Home screen's camera button. */
export const pendingShot: { file: File | null } = { file: null }

const num = (v: string) => (v.trim() === '' ? null : Math.max(0, Number(v)))

function Shot({ id }: { id: string }) {
  const p = useLive(() => db.photos.get(id), [id])
  const url = useBlobUrl(p?.thumb ?? p?.blob)
  return url ? <img src={url} alt="Your photo" /> : null
}

export function QuickReport() {
  const data = useStewardData()
  const nav = useNavigate()
  const toast = useToast()
  const scale = useSeverityScale()
  const [a, setA] = useState<LocalAssessment | null>(null)
  const [fix, setFix] = useState<Fix | null>(null)
  const [gpsNote, setGpsNote] = useState('Finding your location…')
  const [busy, setBusy] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saved, setSaved] = useState(false)

  // start the draft and GPS as soon as the screen opens
  useEffect(() => {
    if (data?.event && !a) setA(newAssessment(data.event.id, data.acequias[0]?.id ?? '', null))
  }, [data, a])
  // a photo taken from the Home button arrives here
  const took = useRef(false)
  useEffect(() => {
    if (a && pendingShot.file && !took.current) {
      took.current = true
      const f = pendingShot.file
      pendingShot.file = null
      void onPhotoFile(f)
    }
  })
  useEffect(() => {
    captureFix(12_000, 8, setFix).then(setFix).catch((e) => setGpsNote(e === 'denied' ? 'Location is off. The structure’s recorded spot will be used.' : 'No GPS fix. The structure’s recorded spot will be used.'))
  }, [])

  // nearest inventory structures to where you stand (or gaps first without GPS)
  const nearby = useMemo(() => {
    if (!data) return []
    const list = data.structures.map((s) => ({ s, d: fix ? haversine(fix, s) : null, done: data.byStructure.has(s.id) }))
    if (fix) return list.sort((x, y) => x.d! - y.d!).slice(0, 6)
    const gapOrder = new Map(data.coverage?.gaps.map((g, i) => [g.structure.id, i]))
    return list.filter((x) => gapOrder.has(x.s.id)).sort((x, y) => gapOrder.get(x.s.id)! - gapOrder.get(y.s.id)!).slice(0, 6)
  }, [data, fix])

  if (!data || !a) return null
  if (!data.event) return <Notice tone="info">No active event. Pick one on Home first.</Notice>

  const update = (patch: Partial<LocalAssessment>) => setA((p) => (p ? { ...p, ...patch } : p))
  const structure = data.structures.find((s) => s.id === a.structure_id)

  async function onPhoto(files: FileList | null) {
    const f = files?.[0]
    if (f) await onPhotoFile(f)
  }

  async function onPhotoFile(f: File) {
    if (!a) return
    setBusy(true)
    try {
      const c = await compressPhoto(f)
      const p = await addPhoto({ acequia_id: a.acequia_id, event_id: a.event_id, assessment_id: a.id }, c)
      haptic()
      setA((prev) => (prev ? { ...prev, photo_ids: [...prev.photo_ids, p.id] } : prev))
    } finally {
      setBusy(false)
    }
  }

  function pickStructure(id: string) {
    const existing = data!.byStructure.get(id)
    if (existing && !(existing.sync_state === 'draft' && existing.base_version === 0)) {
      // one report per structure per event: open the one that exists
      nav(`/steward/report/${existing.id}`, { replace: true })
      return
    }
    const s = data!.structures.find((x) => x.id === id)!
    haptic()
    update({ structure_id: id, acequia_id: s.acequia_id, unlisted_type: null })
  }

  function located(x: LocalAssessment): LocalAssessment {
    if (fix) return { ...x, lat: fix.lat, lng: fix.lng, accuracy_m: fix.accuracy_m, location_source: 'gps' }
    if (structure) return { ...x, lat: structure.lat, lng: structure.lng, accuracy_m: null, location_source: 'structure' }
    return x
  }

  async function save(later = false) {
    if (!a) return
    const row = located(a)
    if (later) {
      await saveDraft(row)
      toast('Kept as a draft on this phone. Finish it from Assess.')
      return nav('/steward', { replace: true })
    }
    const errs = { ...validateAssessment(row), ...(row.outcome ? {} : { outcome: 'Pick what you found.' }) }
    setErrors(errs)
    if (Object.keys(errs).length) return
    await saveAssessment(row)
    haptic(30)
    setSaved(true)
    void syncNow().catch(() => {})
    setTimeout(() => nav('/steward', { replace: true }), 1100)
  }

  if (saved) {
    return (
      <div className="saved-splash" role="status">
        <span className="saved-check"><Check size={56} strokeWidth={3} aria-hidden /></span>
        <h1>Saved on this phone</h1>
        <p>{navigator.onLine ? 'Sending now.' : 'It will send when you have signal.'}</p>
      </div>
    )
  }

  return (
    <div className="quick">
      <h1>Quick report</h1>
      <p className="small muted mt-8 row"><MapPin size={16} aria-hidden /> {fix ? `GPS ${meters(fix.accuracy_m)}` : gpsNote}</p>

      <section className="quick-step">
        <h2><span className="step-num">1</span> Photo</h2>
        <div className="quick-photos">
          {a.photo_ids.map((id) => <div key={id} className="quick-photo"><Shot id={id} /></div>)}
          <label className={`quick-shoot${a.photo_ids.length ? ' small' : ''}`}>
            {a.photo_ids.length ? <Plus size={26} aria-hidden /> : <Camera size={40} aria-hidden />}
            <span>{busy ? 'Shrinking…' : a.photo_ids.length ? 'Another' : 'Take photo'}</span>
            <input type="file" accept="image/*" capture="environment" onChange={(e) => onPhoto(e.target.files)} aria-label="Take a photo" />
          </label>
        </div>
        <p className="small muted">Photograph structures, not people or private homes.</p>
        {errors.photos && <p className="field-error">{errors.photos}</p>}
      </section>

      <section className="quick-step">
        <h2><span className="step-num">2</span> Which structure?</h2>
        <p className="small muted">{fix ? 'Closest to you first.' : 'Unchecked structures closest to damage first.'}</p>
        <div className="pick-list">
          {nearby.map(({ s, d, done }) => (
            <button key={s.id} className={`pick${a.structure_id === s.id ? ' on' : ''}`} onClick={() => pickStructure(s.id)} aria-pressed={a.structure_id === s.id}>
              <TypeGlyph type={s.type} />
              <span className="grow"><strong>{s.name}</strong><small>{typeLabel(s.type)}{d != null && ` · ${d < 1000 ? `${Math.round(d)} m` : `${(d / 1000).toFixed(1)} km`}`}{done && ' · already reported'}</small></span>
              {a.structure_id === s.id && <Check size={22} aria-hidden />}
            </button>
          ))}
          <button className={`pick${!a.structure_id && a.unlisted_type ? ' on' : ''}`} onClick={() => update({ structure_id: null, unlisted_type: a.unlisted_type ?? 'other' })}>
            <TypeGlyph type="other" />
            <span className="grow"><strong>Not in the inventory</strong><small>Damage somewhere new</small></span>
          </button>
        </div>
        {!a.structure_id && a.unlisted_type && (
          <div className="chip-pick mt-8" role="group" aria-label="What kind of structure">
            {STRUCTURE_TYPES.map((t) => <button key={t.value} aria-pressed={a.unlisted_type === t.value} onClick={() => update({ unlisted_type: t.value })}>{t.label}</button>)}
          </div>
        )}
        {errors.type && <p className="field-error">{errors.type}</p>}
      </section>

      <section className="quick-step">
        <h2><span className="step-num">3</span> What did you find?</h2>
        <div className="outcome-row">
          {OUTCOMES.map((o) => (
            <button key={o.value} className={`outcome-btn outcome-${o.value}`} aria-pressed={a.outcome === o.value} onClick={() => { haptic(); update({ outcome: o.value as Outcome }) }}>
              <span className="dot" aria-hidden />{o.label}
            </button>
          ))}
        </div>
        {errors.outcome && <p className="field-error">{errors.outcome}</p>}
        {a.outcome === 'damaged' && (
          <>
            <div className="sev-row mt-16" role="group" aria-label="Severity">
              {([1, 2, 3, 4] as const).map((n) => (
                <button key={n} className="sev-btn" aria-pressed={a.severity === n} onClick={() => { haptic(); update({ severity: n }) }} style={{ '--sev': `var(--sev-${n})` } as React.CSSProperties}>
                  <strong>{n}</strong><small>{scale[n].label}</small>
                </button>
              ))}
            </div>
            {a.severity && <p className="small mt-8">{scale[a.severity].detail}</p>}
            {errors.severity && <p className="field-error">{errors.severity}</p>}
            <div className="costs mt-16">
              {(['cost_low', 'cost_likely', 'cost_high'] as const).map((k) => (
                <label key={k} className="field">
                  <span className="label small">{k === 'cost_low' ? 'Low $' : k === 'cost_likely' ? 'Likely $' : 'High $'}</span>
                  <span className="money"><input className="input" inputMode="numeric" value={a[k] ?? ''} onChange={(e) => update({ [k]: num(e.target.value) })} aria-label={`${k.split('_')[1]} cost estimate in dollars`} /></span>
                </label>
              ))}
            </div>
            <p className="small muted">Repair cost estimate, as a range.</p>
            {errors.cost && <p className="field-error">{errors.cost}</p>}
          </>
        )}
        {errors.location && <p className="field-error">{errors.location}</p>}
      </section>

      <div className="savebar">
        <div className="inner">
          <button className="btn" onClick={() => save(true)}>Finish later</button>
          <button className="btn btn-primary grow" onClick={() => save()}><Check size={20} aria-hidden /> Save report</button>
        </div>
      </div>
    </div>
  )
}
