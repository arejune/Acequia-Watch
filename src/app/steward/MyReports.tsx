import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { db } from '../../db/local'
import { useStewardData } from './data'
import { useLive } from '../../lib/hooks'
import { Empty, OutcomeChip, TypeGlyph } from '../../components/ui'
import { typeLabel } from '../../config/labels'
import { dateTime } from '../../lib/format'

const SYNC_WORDS = { draft: 'Draft, not sent', queued: 'Saved on phone, waiting', uploading: 'Sending', synced: 'On the server', error: 'Needs attention', conflict: 'Newer version exists' }

export function MyReports() {
  const data = useStewardData()
  const photos = useLive(() => db.photos.toArray(), []) ?? []
  if (!data) return null
  const rows = [...data.assessments].sort((a, b) => b.updated_at.localeCompare(a.updated_at))
  return (
    <div>
      <h1>My reports</h1>
      <p className="muted small mt-8">{data.event?.name}</p>
      {rows.length === 0 ? <Empty title="No reports yet" /> : (
        <ul className="list mt-16">
          {rows.map((a) => {
            const s = data.structures.find((x) => x.id === a.structure_id)
            const pending = photos.filter((p) => a.photo_ids.includes(p.id) && p.sync_state !== 'synced').length
            return (
              <li key={a.id}>
                <Link className="list-row" to={`/steward/report/${a.id}`}>
                  <TypeGlyph type={s?.type ?? a.unlisted_type} />
                  <div className="grow">
                    <div className="name">{s?.name ?? a.unlisted_name ?? `Unlisted ${typeLabel(a.unlisted_type).toLowerCase()}`}</div>
                    <div className="meta">{SYNC_WORDS[a.sync_state]}{pending > 0 && ` · ${pending} photo${pending === 1 ? '' : 's'} waiting`} · {dateTime(a.updated_at)}</div>
                    {a.outcome && <div className="mt-8"><OutcomeChip outcome={a.outcome} /></div>}
                  </div>
                  <ChevronRight size={22} aria-hidden />
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
