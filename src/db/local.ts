// The phone's database. It is the source of truth until the server confirms
// a write; nothing pending is ever deleted before that.
import Dexie, { type Table } from 'dexie'
import type { Acequia, Assessment, AwEvent, EventShare, Local, LocalPhoto, Membership, Structure } from './types'

export type OutboxKind = 'structure' | 'assessment' | 'photo' | 'share'
type OutboxState = 'queued' | 'error' | 'conflict' | 'paused'

export interface OutboxItem {
  id: string // `${kind}:${entity_id}` so re-saving an entity never queues it twice
  kind: OutboxKind
  entity_id: string
  created_at: number
  attempts: number
  next_try_at: number
  last_error: string | null
  state: OutboxState
}

/** Local rows remember the last version the server confirmed. */
export type LocalStructure = Local<Structure> & { base_version: number; server_copy?: Structure }
export type LocalAssessment = Local<Assessment> & { base_version: number; server_copy?: Assessment }
export type LocalShare = EventShare & { pending: boolean }

interface Meta { key: string; value: unknown }

class LocalDB extends Dexie {
  structures!: Table<LocalStructure, string>
  assessments!: Table<LocalAssessment, string>
  photos!: Table<LocalPhoto, string>
  outbox!: Table<OutboxItem, string>
  acequias!: Table<Acequia, string>
  events!: Table<AwEvent, string>
  memberships!: Table<Membership, [string, string]>
  shares!: Table<LocalShare, [string, string]>
  meta!: Table<Meta, string>

  constructor() {
    super('acequia-watch')
    this.version(1).stores({
      structures: 'id, acequia_id, sync_state',
      assessments: 'id, event_id, acequia_id, structure_id, sync_state, [event_id+structure_id]',
      photos: 'id, assessment_id, structure_id, sync_state',
      outbox: 'id, created_at, state',
      acequias: 'id',
      events: 'id',
      memberships: '[user_id+acequia_id]',
      shares: '[event_id+acequia_id]',
      meta: 'key',
    })
  }
}

export const db = new LocalDB()

export async function getMeta<T>(key: string, fallback: T): Promise<T> {
  return ((await db.meta.get(key))?.value as T) ?? fallback
}
export const setMeta = (key: string, value: unknown) => db.meta.put({ key, value })

/** Strip local-only fields before sending a row to the server. */
export function serverRow<T extends object>(row: T): Record<string, unknown> {
  const { sync_state, sync_error, base_version, server_copy, blob, thumb, original_bytes, pending, ...rest } = row as Record<string, unknown>
  void [sync_state, sync_error, base_version, server_copy, blob, thumb, original_bytes, pending]
  return rest
}
