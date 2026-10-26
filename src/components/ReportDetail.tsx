// Shared report detail (agency sheet and steward map sheet) and the
// before/after photo slider.
import { useEffect, useState } from 'react'
import { backend } from '../db/backend'
import { OutcomeChip } from './ui'
import { coord, dateTime, meters, usd } from '../lib/format'
import type { Assessment, Photo } from '../db/types'

/** Signed (or local) URLs for a set of photos, fetched once each. */
export function usePhotoUrls(photos: Pick<Photo, 'id' | 'storage_path'>[]) {
  const [urls, setUrls] = useState<Record<string, string>>({})
  const key = photos.map((p) => p.id).join()
  useEffect(() => {
    let gone = false
    photos.forEach((p) =>
      backend.photoUrl(p.storage_path).then((u) => !gone && setUrls((m) => ({ ...m, [p.id]: u }))).catch(() => {}),
    )
    return () => { gone = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  return urls
}

/** Drag to compare the pre-disaster photo with the damage photo. */
function BeforeAfter({ before, after, label }: { before: string; after: string; label: string }) {
  const [pos, setPos] = useState(50)
  return (
    <figure className="ba">
      <div className="ba-frame">
        <img src={after} alt={`After: ${label}`} />
        <div className="ba-before" style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}>
          <img src={before} alt={`Before: ${label}`} />
        </div>
        <div className="ba-handle" style={{ left: `${pos}%` }} aria-hidden><span /></div>
        <span className="ba-tag ba-tag-l">Before</span>
        <span className="ba-tag ba-tag-r">After</span>
        <input
          type="range" min={0} max={100} value={pos} onChange={(e) => setPos(+e.target.value)}
          aria-label="Slide to compare before and after photos" className="ba-range"
        />
      </div>
      <figcaption className="small muted">Drag to compare the pre-disaster photo with the damage.</figcaption>
    </figure>
  )
}

export function ReportDetail({ a, title, acequia, photos, baseline }: {
  a: Assessment
  title: string
  acequia: string
  photos: Pick<Photo, 'id' | 'storage_path'>[]
  baseline?: Pick<Photo, 'id' | 'storage_path'> | null
}) {
  const urls = usePhotoUrls(baseline ? [...photos, baseline] : photos)
  const first = photos[0]
  const compare = baseline && first && urls[baseline.id] && urls[first.id]
  return (
    <div className="report-detail">
      <div className={`sev-banner sev-banner-${a.outcome === 'damaged' ? a.severity : a.outcome}`}>
        <span className="eyebrow">{acequia}</span>
        <div className="row wrap mt-8">
          <OutcomeChip outcome={a.outcome} />
          {a.severity && <span className="chip">Severity {a.severity}</span>}
        </div>
      </div>
      {compare ? (
        <BeforeAfter before={urls[baseline!.id]} after={urls[first!.id]} label={title} />
      ) : null}
      <div className="drawer-photos mt-8">
        {photos.length === 0 && <p className="small muted">No photos.</p>}
        {photos.slice(compare ? 1 : 0).map((p, i) => urls[p.id] ? <img key={p.id} src={urls[p.id]} alt={`Photo ${i + 1} of ${title}`} /> : <div key={p.id} className="photo-loading">Loading photo…</div>)}
      </div>
      <dl className="facts mt-16">
        {a.outcome === 'damaged' && <><dt>Cost (estimate)</dt><dd className="mono">{usd(a.cost_low)} – {usd(a.cost_high)}<br />likely {usd(a.cost_likely)}</dd></>}
        {a.description && <><dt>Description</dt><dd>{a.description}</dd></>}
        {a.agency_notes && <><dt>Notes for agency</dt><dd>{a.agency_notes}</dd></>}
        <dt>Captured</dt><dd>{dateTime(a.captured_at)}</dd>
        <dt>Location</dt><dd className="mono">{coord(a.lat, a.lng)}</dd>
        <dt>Accuracy</dt><dd>{a.location_source === 'gps' ? `GPS ${meters(a.accuracy_m)}` : a.location_source === 'structure' ? 'structure’s recorded spot' : 'placed by hand'}</dd>
        {a.volunteer_hours != null && <><dt>Volunteer hours</dt><dd>{a.volunteer_hours}</dd></>}
      </dl>
    </div>
  )
}
