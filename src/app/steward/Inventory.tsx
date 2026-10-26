import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ChevronRight, Plus, Save } from 'lucide-react'
import { useStewardData } from './data'
import { isDemoAcequia } from '../../demo/seed'
import { db, type LocalStructure } from '../../db/local'
import { addPhoto, saveStructure } from '../../db/actions'
import { syncNow } from '../../db/sync'
import { Empty, Notice, TypeGlyph, useToast } from '../../components/ui'
import { useConfirm } from '../../components/native'
import { PhotoField } from '../../components/PhotoField'
import { LocationField, type LocationValue } from '../../components/LocationField'
import { MapView } from '../../components/MapView'
import { STRUCTURE_TYPES, typeLabel } from '../../config/labels'
import { isBaseline } from '../../lib/gaps'
import { uuid } from '../../lib/format'
import type { StructureType } from '../../db/types'

export function Inventory() {
  const data = useStewardData()
  const nav = useNavigate()
  const [view, setView] = useState<'list' | 'map'>('list')
  if (!data) return null
  const { structures, acequias, event } = data
  const missingPhoto = structures.filter((s) => !s.baseline_photo_id).length

  return (
    <div>
      <div className="row">
        <h1 className="grow">Inventory</h1>
        <Link className="btn btn-primary" to="/steward/inventory/new"><Plus size={20} aria-hidden /> Add</Link>
      </div>
      <p className="small mt-8">List each presa, compuerta, culvert and flume before anything happens. After a disaster, the app checks reports against this list to find what nobody has looked at.</p>
      {missingPhoto > 0 && (
        <Notice tone="info">
          {missingPhoto} structure{missingPhoto === 1 ? ' has' : 's have'} no pre-disaster photo. NMAA’s disaster guide lists pre-disaster pictures and GPS points among what to have ready.
        </Notice>
      )}
      <div className="filters mt-16" role="group" aria-label="View">
        <button aria-pressed={view === 'list'} onClick={() => setView('list')}>List</button>
        <button aria-pressed={view === 'map'} onClick={() => setView('map')}>Map</button>
      </div>

      {structures.length === 0 ? (
        <Empty title="No structures yet"><p>Add your presa first, then each headgate down the ditch.</p></Empty>
      ) : view === 'map' ? (
        <>
          <MapView
            label="Map of inventory structures"
            height={420}
            markers={structures.map((s) => ({ id: s.id, lat: s.lat, lng: s.lng, kind: 'structure', label: s.name }))}
            onMarkerClick={(id) => nav(`/steward/inventory/${id}`)}
          />
          <p className="map-note">Map tiles need signal. Your structures are saved on the phone either way.{structures.some((x) => isDemoAcequia(x.acequia_id)) && ' Demo locations are invented and do not mark real structures.'}</p>
        </>
      ) : (
        acequias.map((q) => (
          <section key={q.id} className="mt-16">
            <h2 style={{ fontSize: '1.05rem' }}>{q.name}</h2>
            <ul className="list mt-8">
              {structures.filter((s) => s.acequia_id === q.id).sort((a, b) => a.name.localeCompare(b.name)).map((s) => (
                <li key={s.id}>
                  <Link className="list-row" to={`/steward/inventory/${s.id}`}>
                    <TypeGlyph type={s.type} />
                    <div className="grow">
                      <div className="name">{s.name}</div>
                      <div className="meta">
                        {typeLabel(s.type)}
                        {!s.baseline_photo_id && ' · no photo'}
                        {event && !isBaseline(s, event) && ' · added after event'}
                        {s.sync_state !== 'synced' && ' · waiting to sync'}
                      </div>
                    </div>
                    <ChevronRight size={22} aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  )
}

export function StructureForm() {
  const { id } = useParams()
  const data = useStewardData()
  const nav = useNavigate()
  const toast = useToast()
  const confirm = useConfirm()
  const [s, setS] = useState<LocalStructure | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const loaded = useRef(false)

  useEffect(() => {
    if (!data || loaded.current) return
    loaded.current = true
    ;(async () => {
      if (id && id !== 'new') {
        const row = await db.structures.get(id)
        if (row) setS(row)
        return
      }
      const now = new Date().toISOString()
      setS({
        id: uuid(), acequia_id: data.acequias[0]?.id ?? '', type: undefined as unknown as StructureType, name: '',
        lat: undefined as unknown as number, lng: undefined as unknown as number, accuracy_m: null, notes: '', baseline_photo_id: null,
        created_at: now, retired_at: null, updated_at: now, version: 1, base_version: 0, sync_state: 'draft',
      })
    })()
  }, [data, id])

  const update = useCallback((patch: Partial<LocalStructure>) => setS((p) => (p ? { ...p, ...patch } : p)), [])
  const setLocation = useCallback((v: LocationValue) => update({ lat: v.lat!, lng: v.lng!, accuracy_m: v.accuracy_m }), [update])
  if (!data || !s) return null
  const isNew = s.base_version === 0 && s.sync_state === 'draft'

  async function onSave() {
    if (!s) return
    const e: Record<string, string> = {}
    if (!s.type) e.type = 'Pick a type.'
    if (!s.name.trim()) e.name = 'Give it a short name you will recognize.'
    if (s.lat == null) e.location = 'Add a location.'
    setErrors(e)
    if (Object.keys(e).length) return document.querySelector('.has-error')?.scrollIntoView({ block: 'center' })
    await saveStructure({ ...s, name: s.name.trim() })
    toast('Saved on this phone. Will sync.')
    void syncNow().catch(() => {})
    nav('/steward/inventory')
  }

  return (
    <form onSubmit={(e) => (e.preventDefault(), onSave())} noValidate style={{ paddingBottom: 40 }}>
      <h1 className="mt-8">{isNew ? 'Add structure' : s.name}</h1>
      <div className="stack mt-24" style={{ '--stack': '28px' } as React.CSSProperties}>
        {data.acequias.length > 1 && (
          <label className="field">
            <span className="label">Acequia</span>
            <select className="select" value={s.acequia_id} onChange={(e) => update({ acequia_id: e.target.value })} disabled={!isNew}>
              {data.acequias.map((q) => <option key={q.id} value={q.id}>{q.name}</option>)}
            </select>
          </label>
        )}
        <fieldset className={`field${errors.type ? ' has-error' : ''}`}>
          <legend>Type</legend>
          <div className="choices cols-2">
            {STRUCTURE_TYPES.map((t) => (
              <label key={t.value} className="choice">
                <input type="radio" name="type" checked={s.type === t.value} onChange={() => update({ type: t.value })} />
                <span className="face"><strong><TypeGlyph type={t.value} />{t.label}</strong><small>{t.hint}</small></span>
              </label>
            ))}
          </div>
          {errors.type && <p className="field-error">{errors.type}</p>}
        </fieldset>
        <label className={`field${errors.name ? ' has-error' : ''}`}>
          <span className="label">Name</span>
          <span className="hint">Describe the place, not a landowner. “Compuerta 3, below the bridge.”</span>
          <input className="input" maxLength={120} value={s.name} onChange={(e) => update({ name: e.target.value })} />
          {errors.name && <span className="field-error">{errors.name}</span>}
        </label>
        <PhotoField
          label="Pre-disaster photo"
          ids={s.baseline_photo_id ? [s.baseline_photo_id] : []}
          max={1}
          onAdd={async (c) => {
            const p = await addPhoto({ acequia_id: s.acequia_id, event_id: null, structure_id: s.id }, c)
            update({ baseline_photo_id: p.id })
            return p.id
          }}
          onRemove={() => update({ baseline_photo_id: null })}
        />
        <LocationField
          value={{ lat: s.lat ?? null, lng: s.lng ?? null, accuracy_m: s.accuracy_m, location_source: s.lat == null ? null : s.accuracy_m == null ? 'manual' : 'gps' }}
          onChange={setLocation}
          autoStart={isNew}
          error={errors.location}
        />
        <label className="field">
          <span className="label">Notes <span className="muted">(optional)</span></span>
          <textarea className="textarea" maxLength={500} value={s.notes} onChange={(e) => update({ notes: e.target.value })} />
        </label>
        {!isNew && !s.retired_at && (
          <button type="button" className="btn btn-danger" onClick={async () => {
            if (!(await confirm({ title: 'Retire this structure?', body: <p>It stays in past events but leaves the inventory and future gap lists.</p>, ok: 'Retire', danger: true }))) return
            await saveStructure({ ...s, retired_at: new Date().toISOString() })
            toast('Retired. Saved on this phone, will sync.')
            nav('/steward/inventory')
          }}>Retire structure</button>
        )}
      </div>
      <div className="savebar">
        <div className="inner">
          <span className="grow" />
          <button type="submit" className="btn btn-primary" style={{ minWidth: 160 }}><Save size={20} aria-hidden /> Save</button>
        </div>
      </div>
    </form>
  )
}
