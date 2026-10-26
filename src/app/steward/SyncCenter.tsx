import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { RefreshCw, RotateCcw } from 'lucide-react'
import { db, type OutboxItem } from '../../db/local'
import { hooks, setSimulateOffline } from '../../db/backend'
import { retryItem } from '../../db/actions'
import { syncNow } from '../../db/sync'
import { useLive, useMeta, useOnline, useSyncRunning } from '../../lib/hooks'
import { Empty, Flowline, Notice } from '../../components/ui'
import { ago, bytes, dateTime } from '../../lib/format'

const KIND: Record<OutboxItem['kind'], string> = { structure: 'Structure', assessment: 'Report', photo: 'Photo', share: 'Sharing change' }
const STATE: Record<OutboxItem['state'], string> = { queued: 'Waiting', paused: 'Paused: sign in', error: 'Needs attention', conflict: 'Newer version exists' }

export function SyncCenter() {
  const items = useLive(() => db.outbox.orderBy('created_at').toArray(), []) ?? []
  const lastSync = useMeta<string | null>('lastSync', null)
  const online = useOnline()
  const running = useSyncRunning()
  const [msg, setMsg] = useState<string | null>(null)
  const [storage, setStorage] = useState<{ usage: number; quota: number; persisted: boolean } | null>(null)
  const [, force] = useState(0)

  useEffect(() => {
    ;(async () => {
      const est = await navigator.storage?.estimate?.()
      const persisted = (await navigator.storage?.persisted?.()) ?? false
      if (est) setStorage({ usage: est.usage ?? 0, quota: est.quota ?? 0, persisted })
    })()
  }, [items.length])

  const titles = useLive(async () => {
    const m = new Map<string, string>()
    for (const i of items) {
      if (i.kind === 'assessment') {
        const a = await db.assessments.get(i.entity_id)
        const s = a?.structure_id ? await db.structures.get(a.structure_id) : null
        m.set(i.id, s?.name ?? a?.unlisted_name ?? 'Unlisted damage')
      } else if (i.kind === 'structure') m.set(i.id, (await db.structures.get(i.entity_id))?.name ?? '')
      else if (i.kind === 'photo') {
        const p = await db.photos.get(i.entity_id)
        m.set(i.id, p ? `${bytes(p.bytes)}${p.original_bytes > p.bytes ? `, shrunk from ${bytes(p.original_bytes)}` : ''}` : '')
      }
    }
    return m
  }, [items.map((i) => i.id + i.state).join()])

  const nearlyFull = storage && storage.quota > 0 && storage.usage / storage.quota > 0.8

  return (
    <div className="stack" style={{ '--stack': '20px' } as React.CSSProperties}>
      <div>
        <h1>Sync</h1>
        <p className="muted small mt-8">Last successful sync: {ago(lastSync)}{lastSync && ` (${dateTime(lastSync)})`}</p>
      </div>

      {!online && <Notice tone="info">No signal. Everything is saved on this phone and will send when you reconnect.</Notice>}
      {nearlyFull && <Notice tone="warn">This phone’s storage for the app is nearly full. Sync when you can so photos can be freed.</Notice>}

      <button className="btn btn-primary btn-big" onClick={async () => setMsg((await syncNow(true)).message)} disabled={running}>
        <RefreshCw size={24} className={running ? 'spin' : ''} aria-hidden /> {running ? 'Syncing…' : 'Sync now'}
        <span className="sub">{items.length} in queue</span>
      </button>
      {msg && <p aria-live="polite" className="small">{msg}</p>}

      <section>
        <h2>Queue</h2>
        <Flowline />
        {items.length === 0 ? (
          <Empty title="All sent"><p>Nothing is waiting on this phone.</p></Empty>
        ) : (
          <ul className="list mt-8">
            {items.map((i) => (
              <li key={i.id}>
                <div className="list-row" style={{ cursor: 'default' }}>
                  <div className="grow">
                    <div className="name">{KIND[i.kind]} {titles?.get(i.id) && <span className="muted">· {titles.get(i.id)}</span>}</div>
                    <div className="meta">
                      {STATE[i.state]}
                      {i.attempts > 0 && ` · ${i.attempts} tr${i.attempts === 1 ? 'y' : 'ies'}`}
                      {i.state === 'queued' && i.next_try_at > Date.now() && ` · next try ${ago(new Date(i.next_try_at).toISOString()).replace(' ago', '')}`}
                    </div>
                    {i.last_error && <div className="small" style={{ color: i.state === 'error' ? 'var(--damaged)' : 'var(--ink-2)' }}>{i.last_error}</div>}
                  </div>
                  {i.kind === 'assessment' && (i.state === 'conflict' || i.state === 'error') ? (
                    <Link className="btn" to={`/steward/report/${i.entity_id}`}>Open</Link>
                  ) : i.state !== 'queued' || i.attempts > 0 ? (
                    <button className="btn" onClick={() => retryItem(i.id)}><RotateCcw size={18} aria-hidden /> Retry</button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2>Storage on this phone</h2>
        <Flowline />
        {storage ? (
          <p className="mt-8">
            Using {bytes(storage.usage)}{storage.quota ? ` of about ${bytes(storage.quota)}` : ''}.{' '}
            {storage.persisted ? 'The browser has agreed to keep this data.' : 'The browser may clear this data if the phone runs low on space, so sync often.'}
          </p>
        ) : <p className="mt-8">This browser does not report storage use.</p>}
        {storage && !storage.persisted && (
          <button className="btn" onClick={async () => { await navigator.storage.persist?.(); force((n) => n + 1); setStorage({ ...storage, persisted: (await navigator.storage.persisted()) }) }}>
            Ask the browser to keep data
          </button>
        )}
      </section>

      <details className="card">
        <summary style={{ fontWeight: 700, minHeight: 44, display: 'flex', alignItems: 'center', cursor: 'pointer' }}>Test switches</summary>
        <p className="small">For testing and the demo video only.</p>
        <TestSwitch label="Simulate offline" hint="Every server call fails as if there were no signal." get={() => hooks.simulateOffline} set={setSimulateOffline} />
        <TestSwitch label="Drop the connection mid-sync" hint="On the next sync, the 3rd write reaches the server but its reply is lost, and later writes fail. Turns itself off." get={() => hooks.dropMidSync} set={(v) => (hooks.dropMidSync = v)} />
      </details>
    </div>
  )
}

function TestSwitch({ label, hint, get, set }: { label: string; hint: string; get: () => boolean; set: (v: boolean) => void }) {
  const [on, setOn] = useState(get())
  useEffect(() => {
    const t = setInterval(() => setOn(get()), 500)
    return () => clearInterval(t)
  }, [get])
  return (
    <div className="list-row" style={{ cursor: 'default' }}>
      <div className="grow">
        <div className="name">{label}</div>
        <div className="meta">{hint}</div>
      </div>
      <label className="switch">
        <input type="checkbox" role="switch" checked={on} onChange={(e) => { set(e.target.checked); setOn(e.target.checked) }} aria-label={label} />
        <span aria-hidden />
      </label>
    </div>
  )
}
