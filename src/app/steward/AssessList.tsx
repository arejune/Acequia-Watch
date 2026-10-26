import { Link, useSearchParams } from 'react-router-dom'
import { ChevronRight, Plus } from 'lucide-react'
import { useStewardData } from './data'
import { Empty, OutcomeChip, TypeGlyph } from '../../components/ui'
import { typeLabel } from '../../config/labels'
import type { Outcome } from '../../db/types'

type Filter = 'all' | 'gap' | Outcome

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'gap', label: 'Not assessed' },
  { value: 'damaged', label: 'Damaged' },
  { value: 'no_damage', label: 'No damage' },
  { value: 'not_accessible', label: 'Not accessible' },
  { value: 'all', label: 'All' },
]

const distance = (m: number | null) => (m == null ? null : m < 1000 ? `${Math.round(m / 10) * 10} m from damage` : `${(m / 1000).toFixed(1)} km from damage`)

export function AssessList() {
  const data = useStewardData()
  const [params, setParams] = useSearchParams()
  const filter = (params.get('filter') as Filter) ?? 'gap'

  if (!data) return null
  const { event, coverage, byStructure, structures, acequias, assessments } = data
  if (!event || !coverage) return <Empty title="No active event">Pick an event on Home first.</Empty>

  const gapDistance = new Map(coverage.gaps.map((g) => [g.structure.id, g.distance_m]))
  const multiAcequia = acequias.length > 1
  const acequiaName = (id: string) => acequias.find((a) => a.id === id)?.name

  // a draft that was never sent still counts as a gap, not as a finding
  const isDraft = (a?: { sync_state: string; base_version: number }) => !!a && a.sync_state === 'draft' && a.base_version === 0
  const shownOutcome = (id: string) => { const a = byStructure.get(id); return a && !isDraft(a) ? a.outcome : undefined }

  // gaps come pre-sorted by priority; other filters sort by name
  const rows =
    filter === 'gap'
      ? coverage.gaps.map((g) => g.structure)
      : structures
          .filter((s) => (filter === 'all' ? true : shownOutcome(s.id) === filter))
          .sort((a, b) => a.name.localeCompare(b.name))
  const unlisted = assessments.filter((a) => !a.structure_id && (filter === 'all' || (!isDraft(a) && a.outcome === filter)))

  return (
    <div>
      <h1>Assess</h1>
      <p className="muted small mt-8">{event.name}</p>

      <div className="filters mt-16" role="group" aria-label="Filter by status">
        {FILTERS.map((f) => (
          <button key={f.value} aria-pressed={filter === f.value} onClick={() => setParams({ filter: f.value }, { replace: true })}>
            {f.label}
            {f.value === 'gap' && ` (${coverage.gaps.length})`}
          </button>
        ))}
      </div>

      {filter === 'gap' && coverage.gaps.length > 0 && (
        <p className="small" style={{ color: 'var(--ink-2)' }}>
          {coverage.gaps[0].distance_m != null
            ? 'Closest to known damage first. Damage tends to cluster along a flood path or burn scar. This order is a rule of thumb, not a prediction.'
            : 'No damage reported yet, so these are in name order.'}
        </p>
      )}

      {rows.length === 0 && unlisted.length === 0 ? (
        <Empty title={filter === 'gap' ? 'Every structure has been checked' : 'Nothing here yet'}>
          {filter === 'gap' && <p>Gap detection only knows structures in your inventory. If you see damage somewhere else, report it as unlisted.</p>}
        </Empty>
      ) : (
        <ul className="list">
          {rows.map((s) => {
            const a = byStructure.get(s.id)
            const d = distance(gapDistance.get(s.id) ?? null)
            return (
              <li key={s.id}>
                <Link className="list-row" to={a ? `/steward/report/${a.id}` : `/steward/report/new?structure=${s.id}`}>
                  <TypeGlyph type={s.type} />
                  <div className="grow">
                    <div className="name">{s.name}</div>
                    <div className="meta">
                      {typeLabel(s.type)}
                      {multiAcequia && ` · ${acequiaName(s.acequia_id)}`}
                      {(!a || isDraft(a)) && d && ` · ${d}`}
                    </div>
                    {(a || filter !== 'gap') && <div className="mt-8"><OutcomeChip outcome={a ? (a.sync_state === 'draft' && a.base_version === 0 ? 'draft' : a.outcome) : 'gap'} /></div>}
                  </div>
                  <ChevronRight size={22} aria-hidden />
                </Link>
              </li>
            )
          })}
          {unlisted.map((a) => (
            <li key={a.id}>
              <Link className="list-row" to={`/steward/report/${a.id}`}>
                <TypeGlyph type={a.unlisted_type} />
                <div className="grow">
                  <div className="name">{a.unlisted_name || `Unlisted ${typeLabel(a.unlisted_type).toLowerCase()}`}</div>
                  <div className="meta">Not in inventory{multiAcequia && ` · ${acequiaName(a.acequia_id)}`}</div>
                  <div className="mt-8"><OutcomeChip outcome={a.outcome} /></div>
                </div>
                <ChevronRight size={22} aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      )}

      <Link className="btn btn-block mt-24" to="/steward/report/new">
        <Plus size={20} aria-hidden /> Report damage not in the inventory
      </Link>
    </div>
  )
}
