import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Save, Trash2 } from 'lucide-react'
import { db, type LocalAssessment } from '../../db/local'
import { addPhoto, deleteDraft, newAssessment, resolveConflict, saveAssessment, saveDraft, validateAssessment } from '../../db/actions'
import { syncNow } from '../../db/sync'
import { useStewardData, useSeverityScale } from './data'
import { useSession } from '../session'
import { Notice, OutcomeChip, TypeGlyph, useToast } from '../../components/ui'
import { useConfirm } from '../../components/native'
import { PhotoField } from '../../components/PhotoField'
import { LocationField, type LocationValue } from '../../components/LocationField'
import { OUTCOMES, STRUCTURE_TYPES, typeLabel } from '../../config/labels'
import { dateTime, usd } from '../../lib/format'
import type { Assessment } from '../../db/types'

const num = (v: string) => (v.trim() === '' ? null : Math.max(0, Number(v)))

export function AssessForm() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const nav = useNavigate()
  const toast = useToast()
  const confirm = useConfirm()
  const data = useStewardData()
  const { profile } = useSession()
  const scale = useSeverityScale()
  const [a, setA] = useState<LocalAssessment | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [showHelper, setShowHelper] = useState(false)
  const [missing, setMissing] = useState(false)
  const dirty = useRef(false)
  const timer = useRef<number>(undefined)

  const structureId = params.get('structure')
  const structure = data?.structures.find((s) => s.id === (a?.structure_id ?? structureId))

  // load an existing report, or start a new one (reusing one that exists for this structure)
  useEffect(() => {
    if (!data?.event || a) return
    ;(async () => {
      if (id && id !== 'new') {
        const row = await db.assessments.get(id)
        if (row) setA(row)
        else setMissing(true) // not on this phone, or not yours to see
        return
      }
      if (structureId) {
        const existing = await db.assessments.where('[event_id+structure_id]').equals([data.event!.id, structureId]).first()
        if (existing) return nav(`/steward/report/${existing.id}`, { replace: true })
        const s = data.structures.find((x) => x.id === structureId)
        if (s) setA(newAssessment(data.event!.id, s.acequia_id, s.id))
        else setMissing(true)
      } else {
        setA(newAssessment(data.event!.id, data.acequias[0]?.id ?? '', null))
      }
    })()
  }, [data, id, structureId, a, nav])

  // autosave a draft on every change; restored if the tab closes or the phone crashes
  useEffect(() => {
    if (!a || !dirty.current) return
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => void saveDraft(a), 300)
    return () => window.clearTimeout(timer.current)
  }, [a])

  const update = useCallback((patch: Partial<Assessment>) => {
    dirty.current = true
    setA((prev) => (prev ? { ...prev, ...patch } : prev))
  }, [])
  const setLocation = useCallback((v: LocationValue) => update(v), [update])

  // once errors are showing, each one clears as soon as its field is fixed
  useEffect(() => {
    if (!a) return
    setErrors((prev) => {
      if (!Object.keys(prev).length) return prev
      const now: Record<string, string> = a.outcome ? validateAssessment(a) : { outcome: 'Pick what you found.' }
      return Object.fromEntries(Object.entries(now).filter(([k]) => k in prev))
    })
  }, [a])

  if (missing) {
    return (
      <div className="page-message">
        <h1 className="screen-title">You can’t open this report</h1>
        <p className="lede-sm">It isn’t on this phone, or it belongs to an acequia your account isn’t linked to.</p>
        <button className="btn mt-16" onClick={() => nav('/steward/assess', { replace: true })}>Go to the assess list</button>
      </div>
    )
  }

  if (!data || !a) return null
  if (!data.event) return null

  const damaged = a.outcome === 'damaged'
  const neverSent = a.base_version === 0
  const title = structure?.name ?? (a.unlisted_name || 'Damage not in inventory')

  async function onSave() {
    if (!a) return
    if (!a.outcome) {
      setErrors({ outcome: 'Pick what you found.' })
      requestAnimationFrame(() => document.querySelector('.has-error')?.scrollIntoView({ behavior: 'smooth', block: 'center' }))
      return
    }
    const errs = validateAssessment(a)
    setErrors(errs)
    if (Object.keys(errs).length) {
      // wait for the error styles to render, then bring the first one into view
      requestAnimationFrame(() => document.querySelector('.has-error')?.scrollIntoView({ behavior: 'smooth', block: 'center' }))
      return
    }
    window.clearTimeout(timer.current)
    // damage costs only count when damaged; clear stale numbers from a changed outcome
    const clean = damaged ? a : { ...a, severity: null, cost_low: null, cost_likely: null, cost_high: null }
    await saveAssessment(clean)
    toast(navigator.onLine ? 'Saved on this phone. Syncing…' : 'Saved on this phone. Will sync when there is signal.')
    void syncNow().catch(() => {})
    nav(-1)
  }

  return (
    <form onSubmit={(e) => (e.preventDefault(), onSave())} noValidate style={{ paddingBottom: 40 }}>
      <p className="eyebrow mt-8">{data.acequias.find((q) => q.id === a.acequia_id)?.name ?? 'Unlisted'} · {structure ? typeLabel(structure.type) : 'not in inventory'}</p>
      <h1 className="mt-8">{title}</h1>
      {a.sync_state !== 'draft' && a.outcome && (
        <p className="row mt-8 small"><OutcomeChip outcome={a.outcome} /> <span className="muted">updated {dateTime(a.updated_at)} · {a.sync_state === 'synced' ? 'on the server' : 'waiting to sync'}</span></p>
      )}

      {a.sync_state === 'conflict' && a.server_copy && (
        <div className="mt-16">
          <Notice tone="warn">
            <strong>A newer version exists.</strong> Someone saved this report on another phone ({a.server_copy.outcome.replace('_', ' ')}, {usd(a.server_copy.cost_likely)} likely, {dateTime(a.server_copy.updated_at)}).
            <div className="row wrap mt-8">
              <button type="button" className="btn" onClick={async () => { await resolveConflict('assessment', a.id, 'mine'); toast('Keeping yours. Will sync.'); nav(-1) }}>Keep mine</button>
              <button type="button" className="btn" onClick={async () => { await resolveConflict('assessment', a.id, 'theirs'); toast('Took the server version.'); nav(-1) }}>Take theirs</button>
            </div>
          </Notice>
        </div>
      )}
      {a.sync_state === 'error' && a.sync_error && <div className="mt-16"><Notice tone="bad">{a.sync_error} Fix it and save again.</Notice></div>}

      <div className="stack mt-24" style={{ '--stack': '28px' } as React.CSSProperties}>
        {!structure && (
          <>
            {data.acequias.length > 1 && (
              <label className="field">
                <span className="label">Acequia</span>
                <select className="select" value={a.acequia_id} onChange={(e) => update({ acequia_id: e.target.value })} disabled={!neverSent}>
                  {data.acequias.map((q) => <option key={q.id} value={q.id}>{q.name}</option>)}
                </select>
              </label>
            )}
            <fieldset className={`field${errors.type ? ' has-error' : ''}`}>
              <legend>What is it?</legend>
              <div className="choices cols-2">
                {STRUCTURE_TYPES.map((t) => (
                  <label key={t.value} className="choice">
                    <input type="radio" name="type" checked={a.unlisted_type === t.value} onChange={() => update({ unlisted_type: t.value })} />
                    <span className="face"><strong><TypeGlyph type={t.value} />{t.label}</strong><small>{t.hint}</small></span>
                  </label>
                ))}
              </div>
              {errors.type && <p className="field-error">{errors.type}</p>}
            </fieldset>
            <label className="field">
              <span className="label">Short name <span className="muted">(optional)</span></span>
              <input className="input" maxLength={120} value={a.unlisted_name ?? ''} onChange={(e) => update({ unlisted_name: e.target.value })} placeholder="e.g. culvert below the second gate" />
            </label>
          </>
        )}

        <fieldset className={`field${errors.outcome ? ' has-error' : ''}`}>
          <legend>What did you find?</legend>
          <div className="choices">
            {OUTCOMES.map((o) => (
              <label key={o.value} className="choice">
                <input type="radio" name="outcome" checked={a.outcome === o.value} onChange={() => update({ outcome: o.value })} />
                <span className="face">
                  <strong><span className={`chip-${o.value}`} style={{ display: 'inline-flex' }}><span className="dot" style={{ width: 14, height: 14 }} /></span>{o.label}</strong>
                  <small>{o.hint}</small>
                </span>
              </label>
            ))}
          </div>
          {errors.outcome && <p className="field-error">{errors.outcome}</p>}
        </fieldset>

        {damaged && (
          <fieldset className={`field${errors.severity ? ' has-error' : ''}`}>
            <legend>How bad is it?</legend>
            <span className="hint" style={{ display: 'block', fontSize: '0.875rem', color: 'var(--ink-2)', marginBottom: 8 }}>
              Suggested scale, not an agency standard. Reword it in Settings.
            </span>
            <div className="choices">
              {([1, 2, 3, 4] as const).map((n) => (
                <label key={n} className="choice">
                  <input type="radio" name="severity" checked={a.severity === n} onChange={() => update({ severity: n })} />
                  <span className="face">
                    <strong><span className="sev-dot" style={{ background: `var(--sev-${n})` }} aria-hidden />{n} · {scale[n].label}</strong>
                    <small>{scale[n].detail}</small>
                  </span>
                </label>
              ))}
            </div>
            {errors.severity && <p className="field-error">{errors.severity}</p>}
          </fieldset>
        )}

        {a.outcome && (
          <PhotoField
            label={damaged ? 'Photos of the damage (at least 1)' : 'Photos (optional)'}
            ids={a.photo_ids}
            error={errors.photos}
            onAdd={async (c) => {
              const p = await addPhoto({ acequia_id: a.acequia_id, event_id: a.event_id, assessment_id: a.id }, c)
              setA((prev) => (prev ? { ...prev, photo_ids: [...prev.photo_ids, p.id] } : prev))
              dirty.current = true
              return p.id
            }}
            onRemove={(pid) => update({ photo_ids: a.photo_ids.filter((x) => x !== pid) })}
          />
        )}

        {damaged && (
          <fieldset className={`field${errors.cost ? ' has-error' : ''}`}>
            <legend>Repair cost estimate</legend>
            <span className="hint" style={{ display: 'block', fontSize: '0.875rem', color: 'var(--ink-2)', marginBottom: 8 }}>
              Your best guess as a range. Low ≤ likely ≤ high.
            </span>
            <div className="costs">
              {(['cost_low', 'cost_likely', 'cost_high'] as const).map((k) => (
                <label key={k} className="field">
                  <span className="label small">{k === 'cost_low' ? 'Low' : k === 'cost_likely' ? 'Likely' : 'High'}</span>
                  <span className="money">
                    <input className="input" inputMode="numeric" pattern="[0-9]*" value={a[k] ?? ''} onChange={(e) => update({ [k]: num(e.target.value) })} aria-label={`${k.split('_')[1]} cost estimate in dollars`} />
                  </span>
                </label>
              ))}
            </div>
            {errors.cost && <p className="field-error">{errors.cost}</p>}
            <button type="button" className="btn btn-quiet mt-8" aria-expanded={showHelper} onClick={() => setShowHelper((s) => !s)}>
              {showHelper ? 'Hide cost helper' : 'Cost helper: quantity × unit cost'}
            </button>
            {showHelper && <CostHelper onFill={(lo, li, hi) => update({ cost_low: lo, cost_likely: li, cost_high: hi })} />}
          </fieldset>
        )}

        {a.outcome && (
          <LocationField
            value={{ lat: a.lat, lng: a.lng, accuracy_m: a.accuracy_m, location_source: a.location_source }}
            onChange={setLocation}
            structureSpot={structure ? { lat: structure.lat, lng: structure.lng } : null}
            autoStart={neverSent}
            error={errors.location}
          />
        )}

        {a.outcome && (
          <>
            <label className={`field${errors.description ? ' has-error' : ''}`}>
              <span className="label">{a.outcome === 'not_accessible' ? 'Why couldn’t you reach it?' : 'What happened?'} <span className="muted">(optional)</span></span>
              <span className="hint">Tap the microphone on your keyboard to speak instead of typing.</span>
              <textarea className="textarea" maxLength={500} value={a.description} onChange={(e) => update({ description: e.target.value })} />
              <span className="small muted">{a.description.length}/500</span>
            </label>
            <label className="field">
              <span className="label">Volunteer hours <span className="muted">(optional)</span></span>
              <input className="input" inputMode="decimal" value={a.volunteer_hours ?? ''} onChange={(e) => update({ volunteer_hours: num(e.target.value) })} style={{ maxWidth: 160 }} />
            </label>
            <label className="field">
              <span className="label">Notes for the agency <span className="muted">(optional)</span></span>
              <textarea className="textarea" maxLength={500} value={a.agency_notes} onChange={(e) => update({ agency_notes: e.target.value })} style={{ minHeight: 72 }} />
            </label>
          </>
        )}

        {neverSent && a.sync_state === 'draft' && (a.outcome || a.photo_ids.length > 0 || a.description) && (
          <button type="button" className="btn btn-danger" onClick={async () => {
            if (!(await confirm({ title: 'Delete this draft?', body: <p>It was never sent. Its photos will be removed from this phone.</p>, ok: 'Delete draft', danger: true }))) return
            await deleteDraft(a.id).catch(() => {})
            toast('Draft deleted from this phone.')
            nav(-1)
          }}>
            <Trash2 size={18} aria-hidden /> Delete draft
          </button>
        )}
      </div>

      <div className="savebar">
        <div className="inner">
          <span className="small grow muted" aria-live="polite">{dirty.current ? 'Draft kept on this phone' : ''}</span>
          <button type="submit" className="btn btn-primary" style={{ minWidth: 160 }} disabled={!profile}>
            <Save size={20} aria-hidden /> Save
          </button>
        </div>
      </div>
    </form>
  )
}

function CostHelper({ onFill }: { onFill: (lo: number, li: number, hi: number) => void }) {
  const [qty, setQty] = useState('')
  const [unit, setUnit] = useState({ lo: '', li: '', hi: '' })
  const q = Number(qty)
  const ready = q > 0 && unit.lo && unit.li && unit.hi && +unit.lo <= +unit.li && +unit.li <= +unit.hi
  return (
    <div className="card mt-8 stack">
      <p className="small" style={{ margin: 0 }}>For example 12 feet of liner, or 3 loads of gravel. Unit costs are your own numbers, not official rates.</p>
      <label className="field">
        <span className="label small">Quantity</span>
        <input className="input" inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} style={{ maxWidth: 160 }} />
      </label>
      <div className="costs">
        {(['lo', 'li', 'hi'] as const).map((k) => (
          <label key={k} className="field">
            <span className="label small">Unit {k === 'lo' ? 'low' : k === 'li' ? 'likely' : 'high'}</span>
            <span className="money"><input className="input" inputMode="decimal" value={unit[k]} onChange={(e) => setUnit({ ...unit, [k]: e.target.value })} /></span>
          </label>
        ))}
      </div>
      <button type="button" className="btn" disabled={!ready} onClick={() => onFill(Math.round(q * +unit.lo), Math.round(q * +unit.li), Math.round(q * +unit.hi))}>
        Fill the three cost fields
      </button>
    </div>
  )
}
