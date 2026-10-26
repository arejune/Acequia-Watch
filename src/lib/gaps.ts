// Gap detection: which baseline structures has nobody assessed for an event?
// The priority is a heuristic (distance to the nearest damage), not a prediction.
import type { Assessment, AwEvent, Structure } from '../db/types'
import { haversine } from './geo'

interface Gap { structure: Structure; distance_m: number | null }

export interface Coverage {
  baseline: Structure[]
  addedAfter: Structure[]
  assessed: number
  gaps: Gap[] // sorted closest-to-damage first
  followUp: Structure[] // marked not accessible
  coverage: number // 0..1, assessed / baseline
}

const toTime = (s: string) => new Date(s).getTime()

/** In the baseline if created before the event started and not retired before it. */
export function isBaseline(s: Structure, event: AwEvent): boolean {
  const start = toTime(event.started_on)
  return toTime(s.created_at) < start && (s.retired_at == null || toTime(s.retired_at) >= start)
}

export function computeCoverage(structures: Structure[], assessments: Assessment[], event: AwEvent): Coverage {
  const forEvent = assessments.filter((a) => a.event_id === event.id)
  const byStructure = new Map(forEvent.filter((a) => a.structure_id).map((a) => [a.structure_id!, a]))

  const baseline = structures.filter((s) => isBaseline(s, event))
  const addedAfter = structures.filter((s) => !s.retired_at && !isBaseline(s, event) && toTime(s.created_at) >= toTime(event.started_on))

  const damaged = forEvent.filter((a) => a.outcome === 'damaged' && a.lat != null && a.lng != null)
  const gaps: Gap[] = baseline
    .filter((s) => !byStructure.has(s.id))
    .map((s) => ({
      structure: s,
      distance_m: damaged.length ? Math.min(...damaged.map((d) => haversine(s, { lat: d.lat!, lng: d.lng! }))) : null,
    }))
    .sort((a, b) => (a.distance_m ?? Infinity) - (b.distance_m ?? Infinity) || a.structure.name.localeCompare(b.structure.name))

  const assessed = baseline.length - gaps.length
  return {
    baseline,
    addedAfter,
    assessed,
    gaps,
    followUp: baseline.filter((s) => byStructure.get(s.id)?.outcome === 'not_accessible'),
    coverage: baseline.length ? assessed / baseline.length : 0,
  }
}
