import type { EventKind, Outcome, StructureType } from '../db/types'

export const STRUCTURE_TYPES: { value: StructureType; label: string; hint: string }[] = [
  { value: 'presa', label: 'Presa', hint: 'diversion dam' },
  { value: 'headgate', label: 'Compuerta', hint: 'headgate' },
  { value: 'culvert', label: 'Culvert', hint: 'pipe under a road' },
  { value: 'flume', label: 'Flume', hint: 'raised channel' },
  { value: 'sand_trap', label: 'Sand trap', hint: 'settling box' },
  { value: 'ditch_segment', label: 'Ditch segment', hint: 'a stretch of ditch' },
  { value: 'other', label: 'Other', hint: 'anything else' },
]

export const typeLabel = (t: StructureType | null | undefined) => STRUCTURE_TYPES.find((x) => x.value === t)?.label ?? 'Structure'

export const OUTCOMES: { value: Outcome; label: string; hint: string }[] = [
  { value: 'damaged', label: 'Damaged', hint: 'needs repair' },
  { value: 'no_damage', label: 'No damage', hint: 'inspected, fine' },
  { value: 'not_accessible', label: 'Not accessible', hint: 'could not reach it' },
]

export const outcomeLabel = (o: Outcome) => OUTCOMES.find((x) => x.value === o)!.label

export const EVENT_KINDS: Record<EventKind, string> = { fire: 'Fire', flood: 'Flood', drought: 'Drought', other: 'Other' }

/**
 * Suggested severity scale. This is the app author's scale, not an agency
 * standard; stewards can reword it in Settings and the packet prints the
 * wording that was in use.
 */
export const DEFAULT_SEVERITY: Record<1 | 2 | 3 | 4, { label: string; detail: string }> = {
  1: { label: 'Minor', detail: 'Water still flows.' },
  2: { label: 'Partial', detail: 'Partial flow. Volunteers can fix it.' },
  3: { label: 'No flow', detail: 'Needs equipment or a contractor.' },
  4: { label: 'Destroyed', detail: 'Needs rebuilding.' },
}
