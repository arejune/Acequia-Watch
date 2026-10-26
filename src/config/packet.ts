// Packet layout in one place. These fields are NOT matched to any DHSEM or
// FEMA form (none has been checked). Rename or reorder here when one is.
import type { Assessment, Structure } from '../db/types'
import { typeLabel } from './labels'
import { coord, date, meters, usd } from '../lib/format'

export interface Row { a: Assessment; s: Structure | undefined }

export const PACKET_SECTIONS = {
  checklist: 'Supporting documents checklist',
  summary: 'Summary',
  inventory: 'Damage inventory',
  photos: 'Photographs',
  gaps: 'Not yet assessed',
  method: 'Method notes',
}

export const INVENTORY_COLUMNS: { header: string; value: (r: Row) => string | number }[] = [
  { header: 'Type', value: (r) => typeLabel(r.s?.type ?? r.a.unlisted_type) },
  { header: 'Name', value: (r) => r.s?.name ?? r.a.unlisted_name ?? 'Unlisted' },
  { header: 'Severity', value: (r) => r.a.severity ?? '' },
  { header: 'Coordinates', value: (r) => coord(r.a.lat, r.a.lng) },
  { header: 'GPS accuracy', value: (r) => (r.a.location_source === 'gps' ? meters(r.a.accuracy_m) : r.a.location_source ?? '') },
  { header: 'Captured', value: (r) => date(r.a.captured_at) },
  { header: 'Cost low (estimate)', value: (r) => usd(r.a.cost_low) },
  { header: 'Cost likely (estimate)', value: (r) => usd(r.a.cost_likely) },
  { header: 'Cost high (estimate)', value: (r) => usd(r.a.cost_high) },
  { header: 'Description', value: (r) => r.a.description },
]

/**
 * From the NMAA Acequia Guide to Disaster Funding (rev. June 2024). The app
 * cannot supply these; the checklist only reminds.
 */
export const SUPPORTING_DOCS = [
  'Current bylaws',
  'Pre-disaster pictures of the acequia',
  'Mapping of the acequia with GPS coordinates',
  'Cost estimates for repairs (this packet has estimates, not bids)',
  'GPS coordinates of the point of diversion (asked for in federal requests)',
]

export const NMAA_GUIDE_URL = 'https://lasacequias.org/wp-content/uploads/2024/07/Acequia-Guide-to-Disaster-Funding-Rev-June-2024.pdf'
