// Totals are always recomputed from rows, never stored separately.
import type { Assessment } from '../db/types'

export interface Totals {
  reports: number
  damaged: number
  no_damage: number
  not_accessible: number
  cost_low: number
  cost_likely: number
  cost_high: number
  volunteer_hours: number
}

export function computeTotals(rows: Assessment[]): Totals {
  const t: Totals = { reports: rows.length, damaged: 0, no_damage: 0, not_accessible: 0, cost_low: 0, cost_likely: 0, cost_high: 0, volunteer_hours: 0 }
  for (const a of rows) {
    t[a.outcome]++
    t.volunteer_hours += a.volunteer_hours ?? 0
    // only damaged rows carry cost; others add zero
    if (a.outcome === 'damaged') {
      t.cost_low += a.cost_low ?? 0
      t.cost_likely += a.cost_likely ?? 0
      t.cost_high += a.cost_high ?? 0
    }
  }
  return t
}

export interface ThresholdStatus { progress: number; likelyClears: boolean; lowClears: boolean }

export function thresholdStatus(t: Totals, threshold: number | null): ThresholdStatus | null {
  if (!threshold || threshold <= 0) return null
  return { progress: t.cost_likely / threshold, likelyClears: t.cost_likely >= threshold, lowClears: t.cost_low >= threshold }
}
