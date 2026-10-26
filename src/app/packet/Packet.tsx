// Printable damage packet. Built from the phone's own data for stewards (works
// offline), or from shared data for agency users. The app never sends it.
import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { ChevronLeft, Copy, Download, Printer, Share2 } from 'lucide-react'
import { useSession } from '../session'
import { backend } from '../../db/backend'
import { db, getMeta, type LocalShare } from '../../db/local'
import { useLive } from '../../lib/hooks'
import { computeCoverage } from '../../lib/gaps'
import { computeTotals } from '../../lib/totals'
import { downloadText, toCsv } from '../../lib/csv'
import { coord, date, dateTime, meters, usd, uuid } from '../../lib/format'
import { INVENTORY_COLUMNS, NMAA_GUIDE_URL, PACKET_SECTIONS, SUPPORTING_DOCS, type Row } from '../../config/packet'
import { DEFAULT_SEVERITY, typeLabel } from '../../config/labels'
import { PHOTO_LONG_EDGE, PHOTO_QUALITY } from '../../lib/photo'
import type { Acequia, Assessment, AwEvent, LocalPhoto, Photo, Structure } from '../../db/types'

interface PacketData {
  event: AwEvent
  acequia: Acequia
  structures: Structure[]
  assessments: Assessment[]
  photos: (Photo & Partial<Pick<LocalPhoto, 'blob' | 'thumb'>>)[]
  scale: typeof DEFAULT_SEVERITY
}

function useLocalPacket(eventId: string, acequiaId: string, enabled: boolean) {
  return useLive(async () => {
    if (!enabled) return null
    const event = await db.events.get(eventId)
    const acequia = await db.acequias.get(acequiaId)
    // the phone only holds the acequias this account belongs to
    if (!event || !acequia) return 'denied' as const
    const structures = (await db.structures.where('acequia_id').equals(acequiaId).toArray()).filter((s) => s.sync_state !== 'draft')
    const assessments = (await db.assessments.where('event_id').equals(eventId).toArray())
      .filter((a) => a.acequia_id === acequiaId && !(a.sync_state === 'draft' && a.base_version === 0))
    const ids = new Set(assessments.flatMap((a) => a.photo_ids))
    const photos = (await db.photos.bulkGet([...ids])).filter((p): p is LocalPhoto => !!p)
    const scale = await getMeta('severityScale', DEFAULT_SEVERITY)
    return { event, acequia, structures, assessments, photos, scale } satisfies PacketData
  }, [eventId, acequiaId, enabled])
}

function PhotoImg({ p, alt }: { p: PacketData['photos'][number]; alt: string }) {
  const [src, setSrc] = useState<string>()
  useEffect(() => {
    const local = p.blob ?? p.thumb ?? null
    if (local) {
      const u = URL.createObjectURL(local)
      setSrc(u)
      return () => URL.revokeObjectURL(u)
    }
    let gone = false
    backend.photoUrl(p.storage_path).then((u) => !gone && setSrc(u)).catch(() => {})
    return () => { gone = true }
  }, [p])
  return src ? <img src={src} alt={alt} /> : <div className="photo-loading">Photo not on this device (needs signal)</div>
}

export default function Packet() {
  const { eventId = '', acequiaId = '' } = useParams()
  const { profile, ready } = useSession()
  const isSteward = profile?.role === 'steward'
  const local = useLocalPacket(eventId, acequiaId, !!isSteward)
  const [remote, setRemote] = useState<PacketData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const share = useLive(() => db.shares.get([eventId, acequiaId]), [eventId, acequiaId]) as LocalShare | undefined

  useEffect(() => {
    if (!profile || isSteward) return
    ;(async () => {
      try {
        const d = await backend.agencyEvent(eventId)
        const acequia = d.acequias.find((q) => q.id === acequiaId)
        const event = await db.events.get(eventId)
        if (!acequia || !event) return setError('This acequia hasn’t shared this event, so its packet isn’t available to you.')
        setRemote({
          event, acequia,
          structures: d.structures.filter((s) => s.acequia_id === acequiaId),
          assessments: d.assessments.filter((a) => a.acequia_id === acequiaId),
          photos: d.photos.filter((p) => p.acequia_id === acequiaId),
          scale: DEFAULT_SEVERITY,
        })
      } catch (e) {
        setError((e as Error).message)
      }
    })()
  }, [profile, isSteward, eventId, acequiaId])

  const denied = isSteward && local === 'denied'
  const data = isSteward ? (local === 'denied' ? null : local) : remote
  const view = useMemo(() => {
    if (!data) return null
    const rows: Row[] = data.assessments.map((a) => ({ a, s: data.structures.find((s) => s.id === a.structure_id) }))
    const damaged = rows.filter((r) => r.a.outcome === 'damaged').sort((x, y) => (y.a.severity ?? 0) - (x.a.severity ?? 0))
    return { rows, damaged, totals: computeTotals(data.assessments), coverage: computeCoverage(data.structures.filter((s) => !s.retired_at), data.assessments, data.event) }
  }, [data])

  if (!ready) return null
  if (!profile) return <Navigate to="/signin" replace />
  if (denied || error) {
    return (
      <main className="page page-message" id="main">
        <h1 className="screen-title">You don’t have access to this packet</h1>
        <p className="lede-sm">{error ?? 'It belongs to an acequia your account isn’t linked to. Ask that acequia’s commission, or your admin, if you need it.'}</p>
        <Link className="btn mt-16" to="/">Back to the app</Link>
      </main>
    )
  }
  if (!data || !view) return <main className="page"><p aria-live="polite">Preparing packet…</p></main>

  const { event, acequia, scale } = data
  const generated = new Date().toISOString()
  const name = (r: Row) => r.s?.name ?? r.a.unlisted_name ?? `Unlisted ${typeLabel(r.a.unlisted_type).toLowerCase()}`
  const photoRows = view.damaged.flatMap((r) => r.a.photo_ids.map((pid) => ({ r, p: data.photos.find((p) => p.id === pid) })).filter((x) => x.p))

  async function print() {
    // snapshot the totals so this packet can be reproduced later (best effort)
    if (isSteward && navigator.onLine) {
      await backend.upsert('packets', { id: uuid(), event_id: event.id, acequia_id: acequia.id, totals: { ...view!.totals, coverage: view!.coverage.coverage, gaps: view!.coverage.gaps.length } }).catch(() => {})
    }
    window.print()
  }

  const summary = () =>
    `${acequia.name}: ${event.name}\n` +
    `Assessed ${view!.coverage.assessed} of ${view!.coverage.baseline.length} structures; ${view!.totals.damaged} damaged; ${view!.coverage.gaps.length} not yet assessed.\n` +
    `Repair cost estimate: ${usd(view!.totals.cost_low)} to ${usd(view!.totals.cost_high)} (likely ${usd(view!.totals.cost_likely)}).\n` +
    `Volunteer hours: ${Math.round(view!.totals.volunteer_hours)}. Estimates only; not an agency form. Prepared with Acequia Watch.`

  async function shareOut() {
    const text = summary()
    const csvFile = new File([toCsv(INVENTORY_COLUMNS.map((c) => c.header), view!.damaged.map((r) => INVENTORY_COLUMNS.map((c) => c.value(r))))], 'damage-inventory.csv', { type: 'text/csv' })
    try {
      if (navigator.canShare?.({ files: [csvFile] })) await navigator.share({ title: `${acequia.name} damage packet`, text, files: [csvFile] })
      else if (navigator.share) await navigator.share({ title: `${acequia.name} damage packet`, text })
      else { await navigator.clipboard.writeText(text); setCopied(true) }
    } catch { /* the person closed the share sheet */ }
  }

  function csv() {
    const text = toCsv(INVENTORY_COLUMNS.map((c) => c.header), view!.damaged.map((r) => INVENTORY_COLUMNS.map((c) => c.value(r))))
    downloadText(`${acequia.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-damage-inventory.csv`, text)
  }

  return (
    <div className="packet">
      <div className="packet-tools no-print">
        <Link to={isSteward ? '/steward' : '/agency'} className="back"><ChevronLeft size={22} aria-hidden /> Back</Link>
        <span className="grow" />
        <button className="btn icon-btn" onClick={csv} aria-label="Download CSV"><Download size={18} aria-hidden /></button>
        <button className="btn icon-btn" onClick={async () => { await navigator.clipboard?.writeText(summary()); setCopied(true) }} aria-label="Copy summary"><Copy size={18} aria-hidden /></button>
        <button className="btn" onClick={shareOut}><Share2 size={18} aria-hidden /> Share</button>
        <button className="btn btn-primary" onClick={print}><Printer size={18} aria-hidden /> Print / PDF</button>
      </div>
      {copied && <p className="no-print packet-note" role="status">Summary copied. Paste it into a text or email to your commission.</p>}
      {isSteward && !share?.shared && <p className="no-print packet-note">This acequia has not shared this event with agencies. You can still print the packet and hand it in yourself.</p>}

      <section className="sheet cover">
        <p className="eyebrow">Acequia damage packet</p>
        <h1>{acequia.name}</h1>
        <p className="cover-event">{event.name}</p>
        <dl className="facts">
          <dt>Event started</dt><dd>{date(event.started_on)}</dd>
          <dt>Generated</dt><dd>{dateTime(generated)}</dd>
          <dt>Prepared by</dt><dd>{profile.display_name || profile.email}</dd>
          <dt>Region</dt><dd>{acequia.region}</dd>
        </dl>
        <p className="cover-warn">
          All costs in this packet are <strong>estimates</strong> made by volunteers, given as low, likely, and high. This is not an official agency form and has not been checked against DHSEM or FEMA forms.
          {view.coverage.gaps.length > 0 && ` ${view.coverage.gaps.length} inventory structures have not been assessed yet; see “${PACKET_SECTIONS.gaps}.”`}
        </p>
        <h2>{PACKET_SECTIONS.checklist}</h2>
        <p className="small">From the NMAA <a href={NMAA_GUIDE_URL}>Acequia Guide to Disaster Funding</a> (rev. June 2024). This app cannot supply these; attach them yourself.</p>
        <ul className="checklist">
          {SUPPORTING_DOCS.map((d) => <li key={d}><span className="box" aria-hidden /> {d}</li>)}
        </ul>
      </section>

      <section className="sheet">
        <h2>{PACKET_SECTIONS.summary}</h2>
        <table className="table summary-table">
          <tbody>
            <tr><th scope="row">Structures in inventory (baseline)</th><td className="num">{view.coverage.baseline.length}</td></tr>
            <tr><th scope="row">Assessed</th><td className="num">{view.coverage.assessed}</td></tr>
            <tr><th scope="row">Damaged</th><td className="num">{view.totals.damaged}</td></tr>
            <tr><th scope="row">No damage</th><td className="num">{view.totals.no_damage}</td></tr>
            <tr><th scope="row">Not accessible</th><td className="num">{view.totals.not_accessible}</td></tr>
            <tr><th scope="row">Not yet assessed (gaps)</th><td className="num">{view.coverage.gaps.length}</td></tr>
            <tr><th scope="row">Repair cost, low (estimate)</th><td className="num mono">{usd(view.totals.cost_low)}</td></tr>
            <tr><th scope="row">Repair cost, likely (estimate)</th><td className="num mono">{usd(view.totals.cost_likely)}</td></tr>
            <tr><th scope="row">Repair cost, high (estimate)</th><td className="num mono">{usd(view.totals.cost_high)}</td></tr>
            <tr><th scope="row">Volunteer hours</th><td className="num">{Math.round(view.totals.volunteer_hours)}</td></tr>
          </tbody>
        </table>
        {view.coverage.coverage < 1 && <p className="small mt-8">Totals are a floor: they include only the structures assessed so far.</p>}

        <h2 className="mt-24">{PACKET_SECTIONS.inventory}</h2>
        {view.damaged.length === 0 ? <p>No damaged structures recorded.</p> : (
          <table className="table inv-table">
            <thead><tr>{INVENTORY_COLUMNS.map((c) => <th key={c.header} scope="col">{c.header}</th>)}</tr></thead>
            <tbody>
              {view.damaged.map((r) => (
                <tr key={r.a.id}>{INVENTORY_COLUMNS.map((c) => <td key={c.header}>{c.value(r)}</td>)}</tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {photoRows.length > 0 && (
        <section className="sheet">
          <h2>{PACKET_SECTIONS.photos}</h2>
          <div className="photo-pages">
            {photoRows.map(({ r, p }, i) => (
              <figure key={p!.id} className="packet-photo">
                <PhotoImg p={p!} alt={`Damage at ${name(r)}`} />
                <figcaption>
                  <strong>{i + 1}. {name(r)}</strong> · {typeLabel(r.s?.type ?? r.a.unlisted_type)} · severity {r.a.severity}<br />
                  {date(p!.taken_at)} · <span className="mono">{coord(r.a.lat, r.a.lng)}</span> {r.a.location_source === 'gps' && `(${meters(r.a.accuracy_m)})`}
                </figcaption>
              </figure>
            ))}
          </div>
        </section>
      )}

      <section className="sheet">
        <h2>{PACKET_SECTIONS.gaps}</h2>
        <p>This packet does not cover every structure. The following have not been assessed, or could not be reached, as of {dateTime(generated)}.</p>
        {view.coverage.gaps.length === 0 && view.coverage.followUp.length === 0 ? <p>Every inventory structure has been assessed.</p> : (
          <table className="table">
            <thead><tr><th scope="col">Structure</th><th scope="col">Type</th><th scope="col">Status</th><th scope="col">Coordinates</th></tr></thead>
            <tbody>
              {view.coverage.gaps.map((g) => <tr key={g.structure.id}><td>{g.structure.name}</td><td>{typeLabel(g.structure.type)}</td><td>Not yet assessed</td><td className="mono">{coord(g.structure.lat, g.structure.lng)}</td></tr>)}
              {view.coverage.followUp.map((s) => <tr key={s.id}><td>{s.name}</td><td>{typeLabel(s.type)}</td><td>Not accessible; follow up</td><td className="mono">{coord(s.lat, s.lng)}</td></tr>)}
            </tbody>
          </table>
        )}
        {view.coverage.addedAfter.length > 0 && <p className="small mt-8">{view.coverage.addedAfter.length} structures were added to the inventory after the event started and are not counted as gaps.</p>}

        <h2 className="mt-24">{PACKET_SECTIONS.method}</h2>
        <p><strong>Severity scale used</strong> (suggested by the app, not an agency standard):</p>
        <ol className="method-scale">
          {([1, 2, 3, 4] as const).map((n) => <li key={n}><strong>{scale[n].label}.</strong> {scale[n].detail}</li>)}
        </ol>
        <p><strong>Cost estimates.</strong> Volunteers entered a low, likely, and high cost for each damaged structure, sometimes using quantity × their own unit costs. They are not contractor bids. Totals add each column; the sum of highs is a worst case, not a probability.</p>
        <p><strong>Locations.</strong> Read from the phone’s GPS at the site with its accuracy shown, or taken from the structure’s recorded spot, or placed by hand on a map, as marked in the table.</p>
        <p><strong>Photos.</strong> Resized on the phone to {PHOTO_LONG_EDGE} px on the long edge (JPEG quality {PHOTO_QUALITY}), which also removes embedded metadata.</p>
        <p><strong>Gaps.</strong> A gap is a structure in the pre-disaster inventory with no report for this event. Damage at places not in the inventory can only appear if someone reported it as unlisted.</p>
        <p className="small muted">Prepared with Acequia Watch, which produces agency-ready packets and a shared dashboard. It is not connected to and does not submit anything to DHSEM, FEMA, or the Interstate Stream Commission.</p>
      </section>
    </div>
  )
}
