import { Link, useNavigate } from 'react-router-dom'
import { Camera, ClipboardCheck, FileText, MapPinPlus, RefreshCw, Share2 } from 'lucide-react'
import { useState } from 'react'
import { setActiveEvent, useStewardData } from './data'
import { pendingShot } from './QuickReport'
import { useSession } from '../session'
import { db } from '../../db/local'
import { setShare } from '../../db/actions'
import { syncNow } from '../../db/sync'
import { useLive, useMeta, useOnline, useOutboxSummary, useSyncRunning } from '../../lib/hooks'
import { Empty, Flowline, Notice, OutcomeChip, useToast } from '../../components/ui'
import { ProgressRing, PullToSync, ScreenSkeleton, haptic, useConfirm } from '../../components/native'
import { InstallCard } from '../More'
import { Scene } from '../../components/Scene'
import { StartHere } from './StartHere'
import { Access } from '../Access'
import { EVENT_KINDS, typeLabel } from '../../config/labels'
import { ago, date, dateTime } from '../../lib/format'

export function Home() {
  const data = useStewardData()
  const { profile } = useSession()
  const nav = useNavigate()
  const toast = useToast()
  const confirm = useConfirm()
  const online = useOnline()
  const running = useSyncRunning()
  const { waiting } = useOutboxSummary()
  const lastSync = useMeta<string | null>('lastSync', null)
  const [syncMsg, setSyncMsg] = useState<string | null>(null)
  const shares = useLive(() => db.shares.toArray(), []) ?? []

  if (!data) return <ScreenSkeleton />
  const { event, events, coverage, acequias } = data

  if (acequias.length === 0) return <Access />
  if (!event) {
    return (
      <Empty title="No events yet">
        <p>When an admin adds a fire or flood event, it shows up here. You can still build your inventory now.</p>
        <Link className="btn btn-primary mt-16" to="/steward/inventory">Open inventory</Link>
      </Empty>
    )
  }

  const assessed = coverage?.assessed ?? 0
  const baseline = coverage?.baseline.length ?? 0
  const gaps = coverage?.gaps.length ?? 0
  const damaged = data.assessments.filter((a) => a.outcome === 'damaged' && !(a.sync_state === 'draft' && a.base_version === 0)).length
  const drafts = data.assessments.filter((a) => a.sync_state === 'draft' && a.base_version === 0 && a.outcome)
  const recent = [...data.assessments].filter((a) => a.outcome).sort((a, b) => b.updated_at.localeCompare(a.updated_at)).slice(0, 4)

  async function doSync() {
    setSyncMsg(null)
    const r = await syncNow(true)
    setSyncMsg(r.failed ? `Not finished: ${r.message} Your data is safe on this phone.` : r.message)
  }

  return (
    <PullToSync onSync={doSync}>
      <div className="stack" style={{ '--stack': '20px' } as React.CSSProperties}>
        <header className="scene-hero steward-hero">
          <Scene mood={event.kind === 'fire' ? 'fire' : 'day'} height={230} debris={damaged > 0} />
          <div className="scene-hero-text">
            <p className="kicker kicker-light">Hola, {profile?.display_name?.replace(/^Demo /, '') || 'steward'}</p>
            <h1>{event.name}</h1>
            <p className="hero-meta">{EVENT_KINDS[event.kind]} · started {date(event.started_on)}</p>
          </div>
        </header>
        {events.length > 1 && (
          <label className="field">
            <span className="label">Active event</span>
            <select className="select" value={event.id} onChange={(e) => setActiveEvent(e.target.value)}>
              {events.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </label>
        )}

        <section className="hero-card" aria-label="Progress" data-tour="progress">
          <ProgressRing value={assessed} total={baseline} label={`${assessed} of ${baseline} structures assessed`} />
          <div className="grow">
            <p className="hero-line">{assessed === baseline ? 'Every structure checked' : `${gaps} structure${gaps === 1 ? '' : 's'} nobody has checked`}</p>
            <div className="hero-chips">
              <span className="hchip"><span className="dot" style={{ background: 'var(--sev-3)' }} />{damaged} damaged</span>
              <span className="hchip">{waiting ? `${waiting} waiting to sync` : `synced ${ago(lastSync)}`}</span>
            </div>
            {gaps > 0 && <Link to="/steward/assess?filter=gap" className="hero-link">See the gaps →</Link>}
          </div>
        </section>
        <p className="small muted hero-explain">The ring counts structures in your inventory that have a report for this event. Gaps are the ones nobody has looked at yet.</p>

        <StartHere
          hasInventory={data.structures.length > 0}
          reported={data.assessments.some((a) => a.outcome && !(a.sync_state === 'draft' && a.base_version === 0))}
          synced={!!lastSync}
          decided={shares.some((x) => x.event_id === event.id)}
        />

        {/* camera opens straight from Home: one tap to start a report */}
        <label className="cta-camera" onClick={() => haptic()} data-tour="camera">
          <span className="cta-icon"><Camera size={30} aria-hidden /></span>
          <span className="grow"><strong>Report damage</strong><small>Opens the camera. Works with no signal.</small></span>
          <input
            type="file" accept="image/*" capture="environment" aria-label="Report damage: take a photo"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (!f) return
              pendingShot.file = f
              nav('/steward/quick')
            }}
          />
        </label>

        <section className="action-grid" aria-label="Actions">
          <Link to="/steward/assess?filter=gap" className="action"><ClipboardCheck size={26} aria-hidden /><strong>Assess list</strong><small>{gaps} left</small></Link>
          <Link to="/steward/inventory/new" className="action"><MapPinPlus size={26} aria-hidden /><strong>Add structure</strong><small>to inventory</small></Link>
          <button className="action" onClick={doSync} disabled={running}>
            <RefreshCw size={26} className={running ? 'spin' : ''} aria-hidden /><strong>{running ? 'Syncing…' : 'Sync now'}</strong><small>{online ? 'online' : 'no signal'}</small>
          </button>
          <Link to={`/packet/${event.id}/${acequias[0].id}`} className="action"><FileText size={26} aria-hidden /><strong>Packet</strong><small>print or share</small></Link>
        </section>
        {syncMsg && <Notice tone={syncMsg.startsWith('Not') ? 'warn' : 'ok'}>{syncMsg}</Notice>}

        {drafts.length > 0 && (
          <Notice tone="info">
            <strong>{drafts.length} unfinished report{drafts.length === 1 ? '' : 's'}</strong> kept on this phone.{' '}
            <Link to={`/steward/report/${drafts[0].id}`}>Finish {drafts.length === 1 ? 'it' : 'the latest'}</Link>
          </Notice>
        )}

        <InstallCard />

        {recent.length > 0 && (
          <section aria-labelledby="recent-h">
            <h2 id="recent-h">Recent</h2>
            <Flowline />
            <ul className="feed mt-8">
              {recent.map((a) => {
                const s = data.structures.find((x) => x.id === a.structure_id)
                return (
                  <li key={a.id}>
                    <Link to={`/steward/report/${a.id}`}>
                      <OutcomeChip outcome={a.outcome} />
                      <span className="grow">{s?.name ?? a.unlisted_name ?? `Unlisted ${typeLabel(a.unlisted_type).toLowerCase()}`}</span>
                      <span className="small muted">{a.sync_state === 'synced' ? 'sent' : a.sync_state === 'draft' ? 'draft' : 'waiting'} · {ago(a.updated_at)}</span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          </section>
        )}

        <section aria-labelledby="share-h" data-tour="share">
          <h2 id="share-h">Share with agencies</h2>
          <Flowline />
          <p className="small mt-8">Agency and NMAA staff see this event’s reports only while sharing is on. Your commission decides, and can turn it off any time.</p>
          <ul className="list mt-8">
            {acequias.map((a) => {
              const s = shares.find((x) => x.event_id === event.id && x.acequia_id === a.id)
              const on = !!s?.shared
              return (
                <li key={a.id}>
                  <div className="list-row" style={{ cursor: 'default' }}>
                    <div className="grow">
                      <div className="name">{a.name}</div>
                      <div className="meta">
                        {on ? 'Shared' : 'Not shared'}
                        {s && ` · ${dateTime(s.changed_at)}`}
                        {s?.pending && ' · waiting to sync'}
                      </div>
                    </div>
                    <label className="switch">
                      <input
                        type="checkbox" role="switch" checked={on}
                        aria-label={`Share ${a.name} reports for this event with agencies`}
                        onChange={async (e) => {
                          const next = e.target.checked
                          const ok = await confirm(next
                            ? { title: `Share ${a.name}?`, body: <p>Agency and NMAA reviewers will see this event’s reports and photos for {a.name}. You can turn it off later.</p>, ok: 'Share with agencies' }
                            : { title: `Stop sharing ${a.name}?`, body: <p>Agency reviewers lose access as soon as this syncs.</p>, ok: 'Stop sharing', danger: true })
                          if (!ok) return
                          await setShare(event.id, a.id, next, profile!.id)
                          toast(next ? 'Sharing on. Saved on this phone, will sync.' : 'Sharing off. Saved on this phone, will sync.')
                          void syncNow().catch(() => {})
                        }}
                      />
                      <span aria-hidden />
                    </label>
                  </div>
                </li>
              )
            })}
          </ul>
        </section>

        {acequias.length > 1 && (
          <section aria-labelledby="packet-h">
            <h2 id="packet-h">Damage packets</h2>
            <Flowline />
            <div className="stack mt-8" style={{ '--stack': '8px' } as React.CSSProperties}>
              {acequias.map((a) => (
                <Link key={a.id} className="btn btn-block" style={{ justifyContent: 'flex-start' }} to={`/packet/${event.id}/${a.id}`}>
                  <Share2 size={20} aria-hidden /> {a.name}
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </PullToSync>
  )
}
