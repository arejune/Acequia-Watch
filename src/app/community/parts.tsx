import { CircleCheck, CircleX } from 'lucide-react'
import { STAGES, type Bill } from '../../content/community'

/** How far a bill got: five stops from filed to signed. */
export function BillTrack({ bill, compact = false }: { bill: Bill; compact?: boolean }) {
  const reached = STAGES.findIndex((s) => s.key === bill.reached)
  const died = bill.outcome === 'died'
  return (
    <div className={`bill-track${compact ? ' compact' : ''}${died ? ' died' : ''}`} role="img" aria-label={`${bill.number}: ${died ? `stopped at ${STAGES[reached].label.toLowerCase()}` : bill.outcome === 'law' ? 'law' : 'signed into law'}`}>
      <div className="bt-line"><span style={{ width: `${(reached / (STAGES.length - 1)) * 100}%` }} /></div>
      <ol>
        {STAGES.map((s, n) => (
          <li key={s.key} data-done={n <= reached} data-stop={died && n === reached}>
            <span className="bt-dot" />
            {!compact && <span className="bt-label">{s.label}</span>}
          </li>
        ))}
      </ol>
    </div>
  )
}

export function OutcomeTag({ bill }: { bill: Bill }) {
  if (bill.outcome === 'died') return <span className="outcome-tag died"><CircleX size={15} aria-hidden /> Died</span>
  return <span className="outcome-tag passed"><CircleCheck size={15} aria-hidden /> {bill.outcome === 'law' ? 'Law' : 'Signed'}</span>
}
