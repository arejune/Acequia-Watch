// Admin console: account requests, events, acequias, and which stewards belong to which acequia.
// Every write is still checked by RLS; the screen only hides buttons.
import { useCallback, useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { CalendarPlus, Droplets, Plus, UserRound } from 'lucide-react'
import { useSession } from '../session'
import { backend } from '../../db/backend'
import { pull } from '../../db/sync'
import type { AdminData } from '../../db/backend/types'
import type { Acequia, AwEvent, EventKind } from '../../db/types'
import { Empty, Flowline, Notice, useToast } from '../../components/ui'
import { ScreenSkeleton, Sheet, haptic } from '../../components/native'
import { EVENT_KINDS } from '../../config/labels'
import { date, usd, uuid } from '../../lib/format'

type Tab = 'requests' | 'events' | 'acequias' | 'people'

export default function Admin() {
  const { profile } = useSession()
  const toast = useToast()
  const [tab, setTab] = useState<Tab>('requests')
  const [data, setData] = useState<AdminData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [editEvent, setEditEvent] = useState<AwEvent | null>(null)
  const [editAcequia, setEditAcequia] = useState<Acequia | null>(null)
  const [person, setPerson] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      setData(await backend.adminData())
      setError(null)
    } catch (e) {
      setError(navigator.onLine ? (e as Error).message : 'The admin console needs signal.')
    }
  }, [])
  useEffect(() => { load() }, [load])

  if (profile?.role !== 'admin') return <Navigate to="/" replace />

  async function save(table: 'events' | 'acequias', row: AwEvent | Acequia, msg: string) {
    try {
      await backend.upsert(table, row as unknown as Record<string, unknown>)
      haptic()
      toast(msg)
      await load()
      await pull().catch(() => {}) // refresh the event list everywhere
      return true
    } catch (e) {
      toast(`Not saved: ${(e as Error).message}`)
      return false
    }
  }

  const stewards = data?.profiles.filter((p) => p.role === 'steward') ?? []
  const sel = data?.profiles.find((p) => p.id === person)

  return (
    <div>
      <h1 className="screen-title">Admin</h1>
      <p className="lede-sm">Approve new accounts, set up events, and keep the list of acequias and stewards current.</p>
      <div className="tabs-line mt-16" role="tablist" aria-label="Admin sections">
        {(['requests', 'events', 'acequias', 'people'] as Tab[]).map((t) => {
          const n = t === 'requests' ? data?.requests.filter((r) => r.status === 'pending').length ?? 0 : 0
          return <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}>{{ requests: 'Requests', events: 'Events', acequias: 'Acequias', people: 'Stewards' }[t]}{n > 0 && <span className="count"> {n}</span>}</button>
        })}
      </div>
      {error && <div className="mt-16"><Notice tone="bad">{error}</Notice></div>}
      {!data && !error && <div className="mt-16"><ScreenSkeleton /></div>}

      {data && tab === 'requests' && <Requests data={data} onDone={load} />}

      {data && tab === 'events' && (
        <section className="mt-16">
          <button className="btn btn-primary btn-block" onClick={() => setEditEvent({ id: uuid(), name: '', kind: 'fire', started_on: new Date().toISOString().slice(0, 10), threshold_usd: null })}>
            <CalendarPlus size={20} aria-hidden /> New event
          </button>
          <ul className="list mt-16">
            {data.events.map((e) => {
              const shared = data.shares.filter((s) => s.event_id === e.id && s.shared).length
              return (
                <li key={e.id}>
                  <button className="list-row" onClick={() => setEditEvent(e)}>
                    <span className="type-glyph"><CalendarPlus size={22} aria-hidden /></span>
                    <span className="grow">
                      <span className="name" style={{ display: 'block' }}>{e.name}</span>
                      <span className="meta">{EVENT_KINDS[e.kind]} · {date(e.started_on)} · threshold {e.threshold_usd ? usd(e.threshold_usd) : 'not set'} · {shared} of {data.acequias.length} acequias sharing</span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      {data && tab === 'acequias' && (
        <section className="mt-16">
          <button className="btn btn-primary btn-block" onClick={() => setEditAcequia({ id: uuid(), name: '', region: '', ose_ref: null, blurb: '' })}>
            <Plus size={20} aria-hidden /> Add acequia
          </button>
          <ul className="list mt-16">
            {data.acequias.map((q) => (
              <li key={q.id}>
                <button className="list-row" onClick={() => setEditAcequia(q)}>
                  <span className="type-glyph"><Droplets size={22} aria-hidden /></span>
                  <span className="grow">
                    <span className="name" style={{ display: 'block' }}>{q.name}</span>
                    <span className="meta">{q.region} · {data.memberships.filter((m) => m.acequia_id === q.id).length} steward(s)</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {data && tab === 'people' && (
        <section className="mt-16">
          <p className="small">Everyone with a steward account. Approving a request links the person for you; you can also change links here.</p>
          {stewards.length === 0 ? <Empty title="No stewards yet" /> : (
            <ul className="list mt-8">
              {stewards.map((p) => {
                const mine = data.memberships.filter((m) => m.user_id === p.id)
                return (
                  <li key={p.id}>
                    <button className="list-row" onClick={() => setPerson(p.id)}>
                      <span className="avatar" aria-hidden>{(p.display_name || p.email || '?').replace(/^Demo /, '').slice(0, 1)}</span>
                      <span className="grow">
                        <span className="name" style={{ display: 'block' }}>{p.display_name || p.email}</span>
                        <span className="meta">{mine.length ? mine.map((m) => data.acequias.find((q) => q.id === m.acequia_id)?.name).join(', ') : 'Not linked yet'}</span>
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      )}

      <Sheet open={!!editEvent} onClose={() => setEditEvent(null)} title={editEvent?.name ? 'Edit event' : 'New event'} tall>
        {editEvent && (
          <form className="stack" onSubmit={async (e) => {
            e.preventDefault()
            if (!editEvent.name.trim()) return
            if (await save('events', { ...editEvent, name: editEvent.name.trim() }, 'Event saved.')) setEditEvent(null)
          }}>
            <label className="field"><span className="label">Name</span>
              <input className="input" required value={editEvent.name} onChange={(e) => setEditEvent({ ...editEvent, name: e.target.value })} placeholder="e.g. Spring flooding 2027" /></label>
            <fieldset className="field"><legend>Kind</legend>
              <div className="chip-pick">
                {(Object.keys(EVENT_KINDS) as EventKind[]).map((k) => <button type="button" key={k} aria-pressed={editEvent.kind === k} onClick={() => setEditEvent({ ...editEvent, kind: k })}>{EVENT_KINDS[k]}</button>)}
              </div>
            </fieldset>
            <label className="field"><span className="label">Started on</span>
              <span className="hint">Structures added to the inventory after this date are not counted as gaps.</span>
              <input className="input" type="date" required value={editEvent.started_on} onChange={(e) => setEditEvent({ ...editEvent, started_on: e.target.value })} /></label>
            <label className="field"><span className="label">Threshold (optional)</span>
              <span className="hint">A number to compare totals against. Not a fact about any program.</span>
              <span className="money"><input className="input" inputMode="numeric" value={editEvent.threshold_usd ?? ''} onChange={(e) => setEditEvent({ ...editEvent, threshold_usd: e.target.value ? Number(e.target.value.replace(/\D/g, '')) : null })} /></span></label>
            <button className="btn btn-primary btn-block">Save event</button>
          </form>
        )}
      </Sheet>

      <Sheet open={!!editAcequia} onClose={() => setEditAcequia(null)} title={editAcequia?.name ? 'Edit acequia' : 'Add acequia'} tall>
        {editAcequia && (
          <form className="stack" onSubmit={async (e) => {
            e.preventDefault()
            if (!editAcequia.name.trim() || !editAcequia.region.trim()) return
            if (await save('acequias', editAcequia, 'Acequia saved.')) setEditAcequia(null)
          }}>
            <label className="field"><span className="label">Name</span><input className="input" required value={editAcequia.name} onChange={(e) => setEditAcequia({ ...editAcequia, name: e.target.value })} /></label>
            <label className="field"><span className="label">Region</span><span className="hint">Used for the public summary, which hides regions with fewer than 3 reports.</span><input className="input" required value={editAcequia.region} onChange={(e) => setEditAcequia({ ...editAcequia, region: e.target.value })} /></label>
            <label className="field"><span className="label">OSE reference (optional)</span><input className="input" value={editAcequia.ose_ref ?? ''} onChange={(e) => setEditAcequia({ ...editAcequia, ose_ref: e.target.value || null })} /></label>
            <label className="field"><span className="label">Short description</span><textarea className="textarea" value={editAcequia.blurb} onChange={(e) => setEditAcequia({ ...editAcequia, blurb: e.target.value })} /></label>
            <button className="btn btn-primary btn-block">Save acequia</button>
          </form>
        )}
      </Sheet>

      <Sheet open={!!sel} onClose={() => setPerson(null)} title={sel?.display_name || sel?.email || 'Steward'}>
        {sel && data && (
          <>
            <p className="small muted row"><UserRound size={16} aria-hidden /> {sel.email}</p>
            <h3 className="mt-16">Acequias</h3>
            <Flowline />
            <ul className="list mt-8">
              {data.acequias.map((q) => {
                const on = data.memberships.some((m) => m.user_id === sel.id && m.acequia_id === q.id)
                return (
                  <li key={q.id}>
                    <div className="list-row" style={{ cursor: 'default' }}>
                      <span className="grow name">{q.name}</span>
                      <label className="switch">
                        <input type="checkbox" role="switch" checked={on} aria-label={`${sel.display_name} is a steward of ${q.name}`} onChange={async (e) => {
                          try {
                            if (e.target.checked) await backend.upsert('memberships', { user_id: sel.id, acequia_id: q.id })
                            else await backend.removeMembership(sel.id, q.id)
                            haptic()
                            toast(e.target.checked ? `Linked to ${q.name}.` : `Removed from ${q.name}.`)
                            await load()
                          } catch (err) { toast(`Not saved: ${(err as Error).message}`) }
                        }} />
                        <span aria-hidden />
                      </label>
                    </div>
                  </li>
                )
              })}
            </ul>
          </>
        )}
      </Sheet>
    </div>
  )
}

function Requests({ data, onDone }: { data: AdminData; onDone: () => Promise<void> }) {
  const toast = useToast()
  const pending = data.requests.filter((r) => r.status === 'pending')
  const done = data.requests.filter((r) => r.status !== 'pending')
  const [pick, setPick] = useState<Record<string, string>>({})
  const guess = (name: string | null) => data.acequias.find((q) => name && q.name.toLowerCase().includes(name.toLowerCase().replace(/^acequia (de |del |madre )?/, '').trim()))?.id ?? ''

  async function decide(id: string, approve: boolean, acequia?: string) {
    try {
      await backend.decideRequest(id, approve, acequia)
      haptic()
      toast(approve ? 'Approved. They’ll see it next time they check.' : 'Declined.')
      await onDone()
    } catch (e) {
      toast(`Not saved: ${(e as Error).message}`)
    }
  }

  return (
    <section className="mt-16">
      {pending.length === 0 ? <p className="muted">No requests waiting.</p> : (
        <ul className="request-list">
          {pending.map((r) => {
            const who = data.profiles.find((p) => p.id === r.user_id)
            const chosen = pick[r.id] ?? guess(r.acequia_name)
            return (
              <li key={r.id} className="request">
                <p className="request-who"><strong>{who?.display_name || who?.email || 'New account'}</strong> <span className="muted">{who?.email}</span></p>
                <p className="request-what">
                  {r.requested_role === 'agency' ? <>Wants agency access{r.organization ? <> for <strong>{r.organization}</strong></> : null}.</> : <>Says they’re a <strong>{r.acequia_role ?? 'member'}</strong> on <strong>{r.acequia_name}</strong>.</>}
                  {' '}<span className="muted">Asked {date(r.created_at)}.</span>
                </p>
                {r.note && <blockquote className="request-note">{r.note}</blockquote>}
                {r.requested_role === 'steward' && (
                  <label className="field mt-8">
                    <span className="label">Link to</span>
                    <select className="select" value={chosen} onChange={(e) => setPick({ ...pick, [r.id]: e.target.value })}>
                      <option value="">Pick an acequia…</option>
                      {data.acequias.map((q) => <option key={q.id} value={q.id}>{q.name}</option>)}
                    </select>
                  </label>
                )}
                <p className="small muted mt-8">Check with their commission before approving. Approval lets them see that acequia’s reports and photos.</p>
                <div className="row mt-8">
                  <button className="btn btn-primary grow" disabled={r.requested_role === 'steward' && !chosen} onClick={() => decide(r.id, true, chosen || undefined)}>Approve</button>
                  <button className="btn grow" onClick={() => decide(r.id, false)}>Decline</button>
                </div>
              </li>
            )
          })}
        </ul>
      )}
      {done.length > 0 && (
        <details className="mt-24">
          <summary>Decided ({done.length})</summary>
          <ul className="list mt-8">
            {done.map((r) => {
              const who = data.profiles.find((p) => p.id === r.user_id)
              return <li key={r.id} className="list-row" style={{ cursor: 'default' }}><span className="grow">{who?.display_name || who?.email}</span><span className="meta">{r.status}</span></li>
            })}
          </ul>
        </details>
      )}
    </section>
  )
}
