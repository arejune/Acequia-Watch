import type { AccessRequest, NewAccessRequest, Acequia, Assessment, AwEvent, EventShare, Membership, Photo, Profile, Structure } from '../types'

/** How the sync engine should react to a failure. */
export type ErrorKind = 'network' | 'server' | 'auth' | 'conflict' | 'validation' | 'too_large'

export class BackendError extends Error {
  kind: ErrorKind
  code?: string
  constructor(kind: ErrorKind, message: string, code?: string) {
    super(message)
    this.kind = kind
    this.code = code
  }
}

interface Bootstrap {
  profile: Profile
  acequias: Acequia[]
  memberships: Membership[]
  events: AwEvent[]
  shares: EventShare[]
}

export interface AcequiaData { structures: Structure[]; assessments: Assessment[]; photos: Photo[] }

export interface PublicSummaryRow {
  event_id: string
  event_name: string
  kind: string
  region: string
  reports: number
  damaged: number
  cost_low: number
  cost_likely: number
  cost_high: number
}

export type WritableTable = 'structures' | 'assessments' | 'photos' | 'event_shares' | 'packets' | 'events' | 'acequias' | 'memberships'

export interface AdminData { profiles: Profile[]; memberships: Membership[]; acequias: Acequia[]; events: AwEvent[]; shares: EventShare[]; requests: AccessRequest[] }

export interface Backend {
  mode: 'supabase' | 'local'
  /** Returns the signed-in user id, or null. Must not hit the network. */
  currentUserId(): Promise<string | null>
  signInWithPassword(email: string, password: string): Promise<void>
  sendMagicLink(email: string): Promise<void>
  /** Creates an account. `signedIn` is false when the server wants the email confirmed first. */
  signUp(email: string, password: string, display_name: string): Promise<{ signedIn: boolean }>
  /** Your latest access request, if any. */
  myRequest(): Promise<AccessRequest | null>
  requestAccess(req: NewAccessRequest): Promise<void>
  signOut(): Promise<void>

  bootstrap(): Promise<Bootstrap>
  pullAcequias(ids: string[]): Promise<AcequiaData>
  /** Insert or update by primary key. Idempotent: retries never duplicate. */
  upsert(table: WritableTable, row: Record<string, unknown>): Promise<void>
  getAssessment(id: string): Promise<Assessment | null>
  findAssessment(event_id: string, structure_id: string): Promise<Assessment | null>
  getStructure(id: string): Promise<Structure | null>
  /** Uploading the same path twice is harmless. */
  uploadPhoto(path: string, blob: Blob): Promise<void>
  photoUrl(path: string): Promise<string>

  /** Everything the agency is allowed to see for one event. */
  agencyEvent(event_id: string): Promise<AcequiaData & { acequias: Acequia[]; shares: EventShare[] }>
  publicSummary(): Promise<PublicSummaryRow[]>

  /** Admin only (RLS refuses everyone else). */
  adminData(): Promise<AdminData>
  removeMembership(user_id: string, acequia_id: string): Promise<void>
  decideRequest(id: string, approve: boolean, acequia_id?: string): Promise<void>
}
