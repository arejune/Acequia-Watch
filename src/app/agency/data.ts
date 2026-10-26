// One store for the agency tabs (Overview, Map, Reports) so switching tabs
// does not refetch. Last good copy is cached for offline viewing.
import { useEffect, useMemo, useSyncExternalStore } from 'react'
import { backend } from '../../db/backend'
import { db } from '../../db/local'
import { useLive } from '../../lib/hooks'
import { computeCoverage } from '../../lib/gaps'
import { computeTotals } from '../../lib/totals'
import { typeLabel } from '../../config/labels'
import type { AcequiaData } from '../../db/backend/types'
import type { Acequia, Assessment, AwEvent, EventShare } from '../../db/types'

type EventData = AcequiaData & { acequias: Acequia[]; shares: EventShare[]; fetched_at: string }

interface State { eventId: string | null; data: EventData | null; stale: boolean; loading: boolean; error: string | null }
const savedEvent = (() => { try { return localStorage.getItem('aw-agency-event') } catch { return null } })()
let state: State = { eventId: savedEvent, data: null, stale: false, loading: false, error: null }
const subs = new Set<() => void>()
const set = (patch: Partial<State>) => {
  state = { ...state, ...patch }
  subs.forEach((f) => f())
}
const cacheKey = (id: string) => `aw-agency-cache-${id}`

async function load(eventId: string) {
  set({ loading: true, error: null })
  try {
    if (!navigator.onLine) throw new Error('offline')
    const d = { ...(await backend.agencyEvent(eventId)), fetched_at: new Date().toISOString() }
    set({ data: d, stale: false })
    try { localStorage.setItem(cacheKey(eventId), JSON.stringify(d)) } catch { /* cache is optional */ }
  } catch (e) {
    let cached: EventData | null = null
    try { cached = JSON.parse(localStorage.getItem(cacheKey(eventId)) ?? 'null') } catch { /* ignore */ }
    set({ data: cached, stale: true, error: cached ? null : navigator.onLine ? (e as Error).message : 'No signal, and no saved copy of this event yet.' })
  } finally {
    set({ loading: false })
  }
}

export function useAgencyData() {
  const s = useSyncExternalStore((cb) => (subs.add(cb), () => void subs.delete(cb)), () => state)
  const events = useLive(async () => (await db.events.toArray()).sort((a, b) => b.started_on.localeCompare(a.started_on)), []) ?? []
  const event: AwEvent | undefined = events.find((e) => e.id === s.eventId) ?? events[0]

  useEffect(() => {
    if (event && (state.data === null || state.eventId !== event.id) && !state.loading) {
      state.eventId = event.id
      load(event.id)
    }
  }, [event])

  const view = useMemo(() => {
    const data = s.data
    if (!data || !event) return null
    const totals = computeTotals(data.assessments)
    const coverage = computeCoverage(data.structures, data.assessments, event)
    const perAcequia = data.acequias.map((q) => {
      const rows = data.assessments.filter((a) => a.acequia_id === q.id)
      return { acequia: q, totals: computeTotals(rows), coverage: computeCoverage(data.structures.filter((x) => x.acequia_id === q.id), rows, event) }
    })
    const structureName = (a: Assessment) =>
      data.structures.find((x) => x.id === a.structure_id)?.name ?? a.unlisted_name ?? `Unlisted ${typeLabel(a.unlisted_type).toLowerCase()}`
    return { data, totals, coverage, perAcequia, structureName }
  }, [s.data, event])

  return {
    ...s,
    events,
    event,
    view,
    refresh: () => event && load(event.id),
    selectEvent: (id: string) => {
      try { localStorage.setItem('aw-agency-event', id) } catch { /* optional */ }
      set({ eventId: id, data: null })
      load(id)
    },
  }
}

/** Forget everything on sign-out so the next person starts clean. */
export function resetAgencyData() {
  set({ eventId: null, data: null, stale: false, error: null })
  try {
    for (const k of Object.keys(localStorage)) if (k.startsWith('aw-agency-')) localStorage.removeItem(k)
  } catch { /* optional */ }
}
