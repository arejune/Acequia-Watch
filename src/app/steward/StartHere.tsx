// First-time checklist on the steward Home. Each step links to where you do it
// and ticks itself off; the card hides when all four are done or on "Hide".
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { X } from 'lucide-react'

const HIDDEN_KEY = 'aw-start-hidden'
const SEEN_INV_KEY = 'aw-start-inventory'
const read = (k: string) => { try { return localStorage.getItem(k) === '1' } catch { return false } }
const write = (k: string) => { try { localStorage.setItem(k, '1') } catch { /* private mode */ } }

export function StartHere({ hasInventory, reported, synced, decided }: { hasInventory: boolean; reported: boolean; synced: boolean; decided: boolean }) {
  const [hidden, setHidden] = useState(() => read(HIDDEN_KEY))
  const [sawInventory, setSawInventory] = useState(() => read(SEEN_INV_KEY))
  const steps = [
    { done: sawInventory || hasInventory, to: '/steward/inventory', title: 'Look over your inventory', sub: 'The headgates and culverts on your ditch', onClick: () => { write(SEEN_INV_KEY); setSawInventory(true) } },
    { done: reported, to: '/steward/assess?filter=gap', title: 'Report on one structure', sub: 'Damaged, fine, or couldn’t reach it' },
    { done: synced, to: '/steward/sync', title: 'Send it once you have signal', sub: 'It also sends by itself while the app is open' },
    { done: decided, to: '#share-h', title: 'Decide about sharing', sub: 'With your commission, at the bottom of this page' },
  ]
  const n = steps.filter((s) => s.done).length
  if (hidden || n === steps.length) return null
  return (
    <section className="start-card" aria-labelledby="start-h">
      <div className="row">
        <h2 id="start-h" className="grow">Start here</h2>
        <span className="small muted">{n} of {steps.length}</span>
        <button className="btn btn-quiet icon-btn" aria-label="Hide the checklist" onClick={() => { write(HIDDEN_KEY); setHidden(true) }}><X size={18} aria-hidden /></button>
      </div>
      <div className="start-bar" aria-hidden><span style={{ width: `${(n / steps.length) * 100}%` }} /></div>
      <ol className="start-steps">
        {steps.map((s, i) => {
          const body = (<><span className="start-check" aria-hidden>{s.done ? '✓' : i + 1}</span><span className="grow"><strong>{s.title}</strong><small>{s.sub}</small></span></>)
          return (
            <li key={s.title}>
              {s.to.startsWith('#')
                ? <a href={s.to} data-done={s.done}>{body}<span className="sr-only">{s.done ? ' (done)' : ''}</span></a>
                : <Link to={s.to} data-done={s.done} onClick={s.onClick}>{body}<span className="sr-only">{s.done ? ' (done)' : ''}</span></Link>}
            </li>
          )
        })}
      </ol>
    </section>
  )
}
