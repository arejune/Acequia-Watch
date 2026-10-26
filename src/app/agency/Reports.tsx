// Agency Reports tab: every shared report, filterable, with a detail sheet.
import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { useAgencyData } from './data'
import { EventBar } from './parts'
import { Empty, OutcomeChip } from '../../components/ui'
import { ScreenSkeleton, Sheet } from '../../components/native'
import { ReportDetail } from '../../components/ReportDetail'
import { typeLabel } from '../../config/labels'
import { usd } from '../../lib/format'
import type { Outcome } from '../../db/types'

const OUTCOME_FILTERS: { value: Outcome | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'damaged', label: 'Damaged' },
  { value: 'not_accessible', label: 'Follow up' },
  { value: 'no_damage', label: 'No damage' },
]

export default function Reports() {
  const d = useAgencyData()
  const [params, setParams] = useSearchParams()
  const outcome = (params.get('outcome') as Outcome | 'all') ?? 'all'
  const [acequia, setAcequia] = useState('all')
  const [minSev, setMinSev] = useState(0)
  const [open, setOpen] = useState<string | null>(null)
  const v = d.view

  const rows = v
    ? v.data.assessments
        .filter((a) => (outcome === 'all' || a.outcome === outcome) && (acequia === 'all' || a.acequia_id === acequia) && (a.severity ?? 0) >= minSev)
        .sort((a, b) => (b.severity ?? 0) - (a.severity ?? 0) || (b.cost_likely ?? 0) - (a.cost_likely ?? 0))
    : []
  const selected = v?.data.assessments.find((a) => a.id === open)
  const structureOf = (id: string | null) => v?.data.structures.find((s) => s.id === id)

  return (
    <div>
      <h1>Reports</h1>
      <div className="mt-8"><EventBar d={d} /></div>
      {!v ? (d.loading ? <div className="mt-16"><ScreenSkeleton /></div> : null) : (
        <>
          <div className="filters mt-16" role="group" aria-label="Filter by outcome">
            {OUTCOME_FILTERS.map((f) => (
              <button key={f.value} aria-pressed={outcome === f.value} onClick={() => setParams({ outcome: f.value }, { replace: true })}>{f.label}</button>
            ))}
          </div>
          <div className="row wrap" style={{ gap: 10 }}>
            <label className="field grow" style={{ minWidth: 180 }}>
              <span className="label small">Acequia</span>
              <select className="select" value={acequia} onChange={(e) => setAcequia(e.target.value)}>
                <option value="all">All shared acequias</option>
                {v.data.acequias.map((q) => <option key={q.id} value={q.id}>{q.name}</option>)}
              </select>
            </label>
            <label className="field" style={{ minWidth: 150 }}>
              <span className="label small">Severity at least</span>
              <select className="select" value={minSev} onChange={(e) => setMinSev(+e.target.value)}>
                <option value={0}>Any</option>
                {[1, 2, 3, 4].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
          </div>
          <p className="small muted mt-8" aria-live="polite">{rows.length} report{rows.length === 1 ? '' : 's'}</p>
          {rows.length === 0 ? <Empty title="No reports match" /> : (
            <ul className="list">
              {rows.map((a) => (
                <li key={a.id}>
                  <button className="list-row" onClick={() => setOpen(a.id)}>
                    <span className={`sev-tile sev-tile-${a.outcome === 'damaged' ? a.severity : a.outcome}`} aria-hidden>
                      {a.outcome === 'damaged' ? a.severity : a.outcome === 'no_damage' ? '✓' : '?'}
                    </span>
                    <div className="grow">
                      <div className="name">{v.structureName(a)}</div>
                      <div className="meta">{typeLabel(structureOf(a.structure_id)?.type ?? a.unlisted_type)} · {v.data.acequias.find((q) => q.id === a.acequia_id)?.name}</div>
                      <div className="row wrap mt-8" style={{ gap: 6 }}>
                        <OutcomeChip outcome={a.outcome} />
                        {a.outcome === 'damaged' && <span className="chip mono">{usd(a.cost_likely)} likely</span>}
                      </div>
                    </div>
                    <ChevronRight size={22} aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
      <Sheet open={!!selected} onClose={() => setOpen(null)} title={selected ? v!.structureName(selected) : ''} tall>
        {selected && v && (
          <ReportDetail
            a={selected}
            title={v.structureName(selected)}
            acequia={v.data.acequias.find((q) => q.id === selected.acequia_id)?.name ?? ''}
            photos={v.data.photos.filter((p) => p.assessment_id === selected.id)}
            baseline={v.data.photos.find((p) => p.id === structureOf(selected.structure_id)?.baseline_photo_id) ?? null}
          />
        )}
      </Sheet>
    </div>
  )
}

