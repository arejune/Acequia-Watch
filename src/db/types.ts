// Row shapes shared by the local store, the backends, and the screens.
// Field names match the Postgres columns in supabase/schema.sql.

export type Role = 'steward' | 'agency' | 'admin'
export type StructureType = 'presa' | 'headgate' | 'culvert' | 'flume' | 'sand_trap' | 'ditch_segment' | 'other'
export type Outcome = 'damaged' | 'no_damage' | 'not_accessible'
export type EventKind = 'fire' | 'flood' | 'drought' | 'other'
export type LocationSource = 'gps' | 'manual' | 'structure'

/** Local-only lifecycle. Never sent to the server. */
type SyncState = 'draft' | 'queued' | 'uploading' | 'synced' | 'error' | 'conflict'

export interface Profile { id: string; role: Role; display_name: string; email?: string }
export interface Acequia { id: string; name: string; region: string; ose_ref: string | null; blurb: string }
export interface Membership { user_id: string; acequia_id: string }
export interface AccessRequest {
  id: string
  user_id: string
  requested_role: 'steward' | 'agency'
  acequia_name: string | null
  acequia_role: 'commissioner' | 'mayordomo' | 'parciante' | 'other' | null
  organization: string | null
  note: string | null
  status: 'pending' | 'approved' | 'declined'
  created_at: string
}
export type NewAccessRequest = Pick<AccessRequest, 'requested_role' | 'acequia_name' | 'acequia_role' | 'organization' | 'note'>
export interface AwEvent { id: string; name: string; kind: EventKind; started_on: string; threshold_usd: number | null }
export interface EventShare { event_id: string; acequia_id: string; shared: boolean; changed_by: string; changed_at: string }

export interface Structure {
  id: string
  acequia_id: string
  type: StructureType
  name: string
  lat: number
  lng: number
  accuracy_m: number | null
  notes: string
  baseline_photo_id: string | null
  created_at: string
  retired_at: string | null
  updated_at: string
  version: number
}

export interface Assessment {
  id: string
  event_id: string
  acequia_id: string
  structure_id: string | null
  unlisted_type: StructureType | null
  unlisted_name: string | null
  outcome: Outcome
  severity: 1 | 2 | 3 | 4 | null
  description: string
  agency_notes: string
  cost_low: number | null
  cost_likely: number | null
  cost_high: number | null
  volunteer_hours: number | null
  lat: number | null
  lng: number | null
  accuracy_m: number | null
  location_source: LocationSource | null
  photo_ids: string[]
  captured_at: string
  updated_at: string
  version: number
}

export interface Photo {
  id: string
  acequia_id: string
  assessment_id: string | null
  structure_id: string | null
  storage_path: string
  width: number
  height: number
  bytes: number
  taken_at: string
}

/** Local copies carry a sync state; photos also carry their image data. */
export type Local<T> = T & { sync_state: SyncState; sync_error?: string }
export type LocalPhoto = Local<Photo> & {
  blob: Blob | null // full-size JPEG, freed after the server confirms
  thumb: Blob | null // small preview, kept (null for photos pulled from the server)
  original_bytes: number
}
