// Agency Overview tab: totals against a threshold, coverage, per-acequia table.
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { useAgencyData } from './data'
import { AcequiaTable, EventBar, ThresholdMeter } from './parts'
import { Empty, Flowline } from '../../components/ui'
import { ProgressRing, ScreenSkeleton } from '../../components/native'
import { thresholdStatus } from '../../lib/totals'
import { pct, usd } from '../../lib/format'

export default function Overview() {
  const d = useAgencyData()
  const [threshold, setThreshold] = useState('')
  useEffect(() => {
    if (d.event) setThreshold(d.event.threshold_usd ? String(d.event.threshold_usd) : '')
  }, [d.event])

  if (d.events.length === 0) return <Empty title="No events yet"><p>An admin adds events. Check back after one is created.</p></Empty>
  const v = d.view
  const t = Number(threshold.replace(/[^0-9.]/g, '')) || null
  const status = v ? thresholdStatus(v.totals, t) : null

  return (
    <div className="stack" style={{ '--stack': '20px' } as React.CSSProperties}>
      <div>
        <p className="eyebrow">Agency overview</p>
        <h1 className="mt-8">Damage picture</h1>
      </div>
      <EventBar d={d} />

      {!v ? (d.loading ? <ScreenSkeleton /> : null) : v.data.acequias.length === 0 ? (
        <Empty title="No acequia has shared this event yet">
          <p>Reports appear here only after an acequia’s commission turns on sharing for this event. Stewards stay in control.</p>
        </Empty>
      ) : (
        <>
          <section className="hero-card" aria-label="Totals" data-tour="totals">
            <div className="grow">
              <p className="eyebrow on-dark">Likely repair cost · estimate</p>
              <p className="hero-num">{usd(v.totals.cost_likely)}</p>
              <p className="small on-dark">Range {usd(v.totals.cost_low)} to {usd(v.totals.cost_high)}. The high end is a worst case, not a probability.</p>
            </div>
            <ProgressRing value={v.coverage.assessed} total={v.coverage.baseline.length} size={104} label={`${v.coverage.assessed} of ${v.coverage.baseline.length} structures assessed`} />
          </section>
          {v.coverage.coverage < 1 && (
            <p className="floor-note small">Coverage is {pct(v.coverage.coverage)}, so this total is a floor: {v.coverage.gaps.length} structures have not been checked.</p>
          )}

          <section className="stat-row" aria-label="Counts">
            <Link to="/agency/reports?outcome=damaged" className="stat"><span className="stat-num">{v.totals.damaged}</span><span className="stat-label">damaged</span></Link>
            <Link to="/map" className="stat"><span className="stat-num">{v.coverage.gaps.length}</span><span className="stat-label">gaps</span></Link>
            <Link to="/agency/reports?outcome=not_accessible" className="stat"><span className="stat-num">{v.totals.not_accessible}</span><span className="stat-label">follow up</span></Link>
            <div className="stat"><span className="stat-num">{Math.round(v.totals.volunteer_hours)}</span><span className="stat-label">vol. hours</span></div>
          </section>

          <section className="card card-strong" aria-labelledby="thr-h" data-tour="threshold">
            <div className="row wrap" style={{ alignItems: 'flex-end', gap: 16 }}>
              <div className="grow" style={{ minWidth: 180 }}><h2 id="thr-h">Compare to a threshold</h2><Flowline /></div>
              <label className="field" style={{ width: 220, maxWidth: '100%' }}>
                <span className="label small">Example threshold (you type it)</span>
                <span className="money"><input className="input" inputMode="numeric" value={threshold} onChange={(e) => setThreshold(e.target.value)} /></span>
              </label>
            </div>
            <p className="small muted mt-8">Each disaster has its own threshold. For example, about $3.4M was cited for the 2022 Black Fire case (<a href="https://sourcenm.com/2022/12/20/acequia-steward-strains-to-get-help-to-recover-historic-southern-nm-irrigation-systems/" target="_blank" rel="noreferrer">Source NM</a>). Type the one that applies.</p>
            {status ? <ThresholdMeter low={v.totals.cost_low} likely={v.totals.cost_likely} threshold={t!} status={status} /> : <p className="mt-8">The app doesn’t suggest a threshold. Type the one that applies to this disaster to compare.</p>}
          </section>

          <section className="card">
            <h2>Coverage by acequia</h2>
            <Flowline />
            <ul className="cov-list mt-16">
              {v.perAcequia.map(({ acequia, coverage }) => (
                <li key={acequia.id}>
                  <div className="row small"><strong className="grow">{acequia.name}</strong><span>{pct(coverage.coverage)}</span></div>
                  <div className="cov-bar" role="img" aria-label={`${acequia.name}: ${coverage.assessed} of ${coverage.baseline.length} structures assessed`}>
                    <span style={{ width: `${coverage.coverage * 100}%` }} />
                  </div>
                  <p className="small muted" style={{ margin: '4px 0 0' }}>{coverage.assessed} of {coverage.baseline.length} checked · {coverage.gaps.length} gaps{coverage.followUp.length > 0 && ` · ${coverage.followUp.length} not accessible`}</p>
                </li>
              ))}
            </ul>
          </section>

          <AcequiaTable rows={v.perAcequia} eventName={d.event!.name} assessments={v.data.assessments} structureName={v.structureName} />

          <div className="row wrap">
            {v.data.acequias.map((q) => (
              <Link key={q.id} className="btn" to={`/packet/${d.event!.id}/${q.id}`}>Packet: {q.name} <ArrowRight size={16} aria-hidden /></Link>
            ))}
          </div>

          <p className="small muted">Acequia Watch produces agency-ready packets and a shared dashboard. It is not connected to DHSEM, FEMA, or the Interstate Stream Commission and submits nothing to them. All costs are estimates.</p>
        </>
      )}
    </div>
  )
}
