import { db, getMeta, setMeta, type LocalAssessment, type LocalStructure } from '../../db/local'
import { useLive, useMeta } from '../../lib/hooks'
import { computeCoverage } from '../../lib/gaps'
import { DEFAULT_SEVERITY } from '../../config/labels'
import type { Acequia, AwEvent } from '../../db/types'

export interface StewardData {
  events: AwEvent[]
  event: AwEvent | null
  acequias: Acequia[]
  structures: LocalStructure[]
  assessments: LocalAssessment[] // for the active event
  byStructure: Map<string, LocalAssessment>
  coverage: ReturnType<typeof computeCoverage> | null
}

/** Everything the steward screens need, live from the phone's database. */
export function useStewardData(): StewardData | undefined {
  return useLive(async () => {
    const profile = await getMeta<{ id: string } | null>('profile', null)
    const events = (await db.events.toArray()).sort((a, b) => b.started_on.localeCompare(a.started_on))
    const activeId = await getMeta<string | null>('activeEvent', null)
    const event = events.find((e) => e.id === activeId) ?? events[0] ?? null
    const mine = profile ? (await db.memberships.toArray()).filter((m) => m.user_id === profile.id).map((m) => m.acequia_id) : []
    const acequias = (await db.acequias.bulkGet(mine)).filter((a): a is Acequia => !!a)
    const structures = (await db.structures.where('acequia_id').anyOf(mine).toArray()).filter((s) => !s.retired_at)
    const assessments = event ? await db.assessments.where('event_id').equals(event.id).toArray() : []
    const byStructure = new Map(assessments.filter((a) => a.structure_id).map((a) => [a.structure_id!, a]))
    // an unsaved first draft is not an assessment yet
    const saved = assessments.filter((a) => !(a.sync_state === 'draft' && a.base_version === 0))
    const coverage = event ? computeCoverage(structures, saved, event) : null
    return { events, event, acequias, structures, assessments, byStructure, coverage }
  })
}

export const setActiveEvent = (id: string) => setMeta('activeEvent', id)

export type SeverityScale = typeof DEFAULT_SEVERITY
export const useSeverityScale = () => useMeta<SeverityScale>('severityScale', DEFAULT_SEVERITY)
