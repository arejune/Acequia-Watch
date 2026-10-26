// Pieces shared by the agency tabs.
import { useState } from 'react'
import { ArrowDownUp, Download, RefreshCw } from 'lucide-react'
import { computeCoverage } from '../../lib/gaps'
import { computeTotals, thresholdStatus } from '../../lib/totals'
import { toCsv, downloadText } from '../../lib/csv'
import { ago, date, dateTime, pct, usd, usdShort } from '../../lib/format'
import { Notice } from '../../components/ui'
import { EVENT_KINDS } from '../../config/labels'
import type { Acequia, Assessment } from '../../db/types'
import type { useAgencyData } from './data'

/** Event picker + freshness, shown at the top of each agency tab. */
export function EventBar({ d }: { d: ReturnType<typeof useAgencyData> }) {
  return (
    <>
      <section className="event-bar" data-tour="event">
        <label className="grow">
          <span className="sr-only">Event</span>
          <select className="select" value={d.event?.id} onChange={(e) => d.selectEvent(e.target.value)}>
            {d.events.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
        </label>
        <button className="btn icon-btn" onClick={d.refresh} disabled={d.loading} aria-label="Refresh"><RefreshCw size={20} className={d.loading ? 'spin' : ''} aria-hidden /></button>
      </section>
      {d.event && <p className="small muted" style={{ margin: '6px 0 0' }}>{EVENT_KINDS[d.event.kind]} · started {date(d.event.started_on)}{d.view && ` · updated ${ago(d.view.data.fetched_at)}`}</p>}
      {d.stale && d.view && <div className="mt-8"><Notice tone="warn"><strong>Offline: showing the copy saved {dateTime(d.view.data.fetched_at)}.</strong> It may be out of date.</Notice></div>}
      {d.error && !d.view && <div className="mt-8"><Notice tone="bad">{d.error}</Notice></div>}
    </>
  )
}

export function ThresholdMeter({ low, likely, threshold, status }: { low: number; likely: number; threshold: number; status: NonNullable<ReturnType<typeof thresholdStatus>> }) {
  // scale so the threshold line sits at 80% when the total is below it
  const max = Math.max(threshold * 1.25, likely * 1.05)
  const x = (v: number) => `${Math.min(100, (v / max) * 100)}%`
  return (
    <div className="mt-16">
      <div className="meter" role="img" aria-label={`Likely total ${usd(likely)} is ${pct(status.progress)} of the ${usd(threshold)} threshold`}>
        <span className="meter-fill" style={{ width: x(likely) }} />
        <span className="meter-low" style={{ left: x(low) }} title={`Low total ${usd(low)}`} />
        <span className="meter-line" style={{ left: x(threshold) }} />
        <span className="meter-line-label" style={{ left: x(threshold) }}>Threshold {usdShort(threshold)}</span>
      </div>
      <p className="mt-8" style={{ fontSize: '1.05rem' }}>
        <strong>Likely total is {pct(status.progress)} of the threshold.</strong>{' '}
        {status.likelyClears ? (status.lowClears ? 'Even the low total clears it.' : 'The low total alone does not clear it.') : `${usd(threshold - likely)} short on the likely estimate.`}
      </p>
      <p className="small muted" style={{ margin: 0 }}>Bar: likely total. Tick: low total. Estimates only.</p>
    </div>
  )
}

export function MapLegend() {
  return (
    <ul className="legend" aria-label="Map legend">
      <li><span className="aw-marker damaged sev-3" style={{ width: 18, height: 18, background: 'var(--sev-3)', fontSize: 10 }}>3</span> Damaged (number = severity)</li>
      <li><span className="aw-marker no_damage" style={{ width: 16, height: 16, fontSize: 9 }}>✓</span> No damage</li>
      <li><span className="aw-marker not_accessible" style={{ width: 16, height: 16, fontSize: 9 }}>?</span> Not accessible</li>
      <li><span className="aw-marker gap" style={{ width: 16, height: 16 }} /> Not assessed (gap)</li>
    </ul>
  )
}

type SortKey = 'name' | 'structures' | 'damaged' | 'gaps' | 'likely' | 'hours'

export function AcequiaTable({ rows, eventName, assessments, structureName }: {
  rows: { acequia: Acequia; totals: ReturnType<typeof computeTotals>; coverage: ReturnType<typeof computeCoverage> }[]
  eventName: string
  assessments: Assessment[]
  structureName: (a: Assessment) => string
}) {
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'likely', dir: -1 })
  const val = (r: (typeof rows)[number], k: SortKey) =>
    ({ name: r.acequia.name, structures: r.coverage.baseline.length, damaged: r.totals.damaged, gaps: r.coverage.gaps.length, likely: r.totals.cost_likely, hours: r.totals.volunteer_hours })[k]
  const sorted = [...rows].sort((a, b) => {
    const x = val(a, sort.key), y = val(b, sort.key)
    return (typeof x === 'string' ? x.localeCompare(y as string) : (x as number) - (y as number)) * sort.dir
  })
  const head = (k: SortKey, label: string, num = false) => (
    <th scope="col" aria-sort={sort.key === k ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'} className={num ? 'num' : ''}>
      <button className="th-btn" onClick={() => setSort({ key: k, dir: sort.key === k ? (-sort.dir as 1 | -1) : -1 })}>
        {label} <ArrowDownUp size={14} aria-hidden />
      </button>
    </th>
  )

  function exportCsv() {
    const name = (id: string) => rows.find((r) => r.acequia.id === id)?.acequia.name ?? ''
    const csv = toCsv(
      ['acequia', 'structure', 'outcome', 'severity', 'lat', 'lng', 'gps_accuracy_m', 'captured_at', 'cost_low_estimate', 'cost_likely_estimate', 'cost_high_estimate', 'volunteer_hours', 'description'],
      assessments.map((a) => [name(a.acequia_id), structureName(a), a.outcome, a.severity, a.lat, a.lng, a.accuracy_m, a.captured_at, a.cost_low, a.cost_likely, a.cost_high, a.volunteer_hours, a.description]),
    )
    downloadText(`${eventName.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-reports.csv`, csv)
  }

  return (
    <section className="card" aria-labelledby="tbl-h">
      <div className="row wrap">
        <h2 id="tbl-h" className="grow">By acequia</h2>
        <button className="btn" onClick={exportCsv}><Download size={18} aria-hidden /> CSV of all reports</button>
      </div>
      <div className="table-wrap mt-16">
        <table className="table">
          <thead>
            <tr>
              {head('name', 'Acequia')}
              {head('structures', 'Structures', true)}
              {head('damaged', 'Damaged', true)}
              {head('gaps', 'Gaps', true)}
              {head('likely', 'Cost range (estimate)', true)}
              {head('hours', 'Hours', true)}
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => (
              <tr key={r.acequia.id}>
                <th scope="row">{r.acequia.name}<div className="small muted">{r.acequia.region}</div></th>
                <td className="num">{r.coverage.baseline.length}</td>
                <td className="num">{r.totals.damaged}</td>
                <td className="num">{r.coverage.gaps.length}</td>
                <td className="num mono">{usdShort(r.totals.cost_low)}–{usdShort(r.totals.cost_high)}<div className="small">likely {usd(r.totals.cost_likely)}</div></td>
                <td className="num">{Math.round(r.totals.volunteer_hours)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

