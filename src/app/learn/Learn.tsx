// Public page for anyone who has never heard of an acequia. Illustrations,
// maps, and charts only, no photos. Every fact links to its source.
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Sparkles } from 'lucide-react'
import { Cite } from '../../components/Cite'
import { Anatomy } from './Anatomy'
import { CHECKED_ON, COUNTS, FACTS, GLOSSARY, SOURCES, TIMELINE, type Fact } from '../../content/learn'
import { MapView } from '../../components/MapView'
import { Flowline } from '../../components/ui'
import { backend } from '../../db/backend'
import type { PublicSummaryRow } from '../../db/backend/types'
import { date, usdShort } from '../../lib/format'

function FactCard({ f }: { f: Fact }) {
  return (
    <article className="fact">
      {f.stat && <p className="fact-stat">{f.stat}</p>}
      <p className="fact-text">{f.text}</p>
      <footer className="fact-src">
        Source: <Cite s={f.source} /> <span className="muted">· checked {date(CHECKED_ON)}</span>
      </footer>
    </article>
  )
}

function Section({ n, id, title, kicker, children }: { n: number; id: string; title: string; kicker?: string; children: React.ReactNode }) {
  return (
    <section className="learn-sec" id={id} aria-labelledby={`${id}-h`}>
      <p className="sec-num" aria-hidden>{String(n).padStart(2, '0')}</p>
      <h2 id={`${id}-h`}>{title}</h2>
      <Flowline />
      {kicker && <p className="sec-kicker">{kicker}</p>}
      {children}
    </section>
  )
}

function Flow({ steps, label }: { steps: { t: string; d?: string; stuck?: boolean }[]; label: string }) {
  return (
    <ol className="flow" aria-label={label}>
      {steps.map((s, i) => (
        <li key={i} className={s.stuck ? 'stuck' : ''}>
          <strong>{s.t}</strong>
          {s.d && <span>{s.d}</span>}
        </li>
      ))}
    </ol>
  )
}

function CountsChart() {
  const max = Math.max(...COUNTS.map((c) => c.value))
  const [table, setTable] = useState(false)
  return (
    <figure className="counts">
      <figcaption className="counts-title">How many acequias are in New Mexico? It depends who you ask.</figcaption>
      <div className="row mt-8">
        <button className="btn btn-quiet" aria-pressed={table} onClick={() => setTable((t) => !t)}>{table ? 'Show chart' : 'Show as table'}</button>
      </div>
      {table ? (
        <table className="table mt-8">
          <thead><tr><th scope="col">Count by</th><th scope="col" className="num">Number</th><th scope="col">What it counts</th></tr></thead>
          <tbody>{COUNTS.map((c) => <tr key={c.label}><th scope="row"><Cite s={c.source} /> {c.label}</th><td className="num">{c.approx ? '~' : ''}{c.value.toLocaleString()}{c.plus ? '+' : ''}</td><td>{c.note}</td></tr>)}</tbody>
        </table>
      ) : (
        <ul className="bars" role="list">
          {COUNTS.map((c) => (
            <li key={c.label} title={`${c.label}: ${c.note}`}>
              <span className="bar-label">{c.label}</span>
              <span className="bar-track">
                <span className="bar" style={{ width: `${(c.value / max) * 100}%` }} />
                <span className="bar-val">{c.approx ? '~' : ''}{c.value.toLocaleString()}{c.plus ? '+' : ''}</span>
              </span>
              <span className="bar-note">{c.note} · <Cite s={c.source} /></span>
            </li>
          ))}
        </ul>
      )}
      <p className="small mt-8">The sources do not explain why their counts differ. They count different things in different years. That is one reason mapping every acequia matters.</p>
    </figure>
  )
}

function DemoSummary() {
  const [rows, setRows] = useState<PublicSummaryRow[] | null>(null)
  useEffect(() => {
    backend.publicSummary().then(setRows).catch(() => setRows([]))
  }, [])
  if (!rows) return null
  return (
    <div className="demo-summary">
      <p className="eyebrow">Demo: what the public can see about an event</p>
      <p className="small">Only counts and cost ranges by region, from acequias that chose to share. No exact locations, names, or notes. A region shows only when at least 3 sharing acequias are in it, so no single acequia can be picked out.</p>
      {rows.length === 0 && <p className="small mt-8"><strong>Nothing is public for the demo event.</strong> Only two acequias in the made-up valley have shared, and they are in one region, so the totals stay private.</p>}
      <ul>
        {rows.map((r) => (
          <li key={r.event_id + r.region}>
            <strong>{r.region}</strong> ({r.event_name}): {r.reports} reports, {r.damaged} damaged, {usdShort(Number(r.cost_low))}–{usdShort(Number(r.cost_high))} estimated
          </li>
        ))}
      </ul>
    </div>
  )
}

const CHAPTERS = [['what', 'Basics'], ['words', 'Words'], ['history', 'History'], ['beyond', 'Beyond NM'], ['matter', 'Why they matter'], ['count', 'How many'], ['disaster', 'Disasters'], ['act', 'Help']] as const

export default function Learn() {
  const [showDemo, setShowDemo] = useState(false)
  // open at a chapter when the link has one (/learn#words)
  useEffect(() => {
    const id = window.location.hash.slice(1)
    if (!id) return
    const t = window.setTimeout(() => document.getElementById(id)?.scrollIntoView({ block: 'start' }), 350)
    return () => window.clearTimeout(t)
  }, [])
  return (
    <div className="learn">

      <div className="learn-body">
        <section className="hero">
          <p className="kicker">Learn · New Mexico, Colorado, Texas</p>
          <h1>How an acequia works</h1>
          <p className="lede">
            An <em>acequia</em> (ah-SEH-kee-ah) is an irrigation ditch that a whole neighborhood shares. This page covers how one works and where they came from. It ends with what happens when a fire or flood breaks one. In 2021 about 640 still watered farms in New Mexico (<Cite s="ap2021" />).
          </p>
          <div className="hero-map">
            <MapView label="Map of acequia lines and headgates reported to the New Mexico State Engineer" height={360} ose fitTo="state" />
            <p className="map-note">
              Blue lines: named acequias. White dots: acequia headgates. Data: Office of the State Engineer, EDAC (<a href={SOURCES.oseDitches.url}>service</a>), provided as-is and <strong>incomplete</strong>. Many acequias are not on the map. Snapshot saved {date(CHECKED_ON)}.
            </p>
            <label className="row small mt-8" style={{ minHeight: 44 }}>
              <input type="checkbox" checked={showDemo} onChange={(e) => setShowDemo(e.target.checked)} style={{ width: 22, height: 22 }} />
              Show the demo disaster summary
            </label>
            {showDemo && <DemoSummary />}
          </div>
          <Link to="/learn/quiz" className="quiz-card">
            <Sparkles size={26} aria-hidden />
            <span className="grow"><strong>Check your knowledge</strong><small>Five questions, each with its source.</small></span>
            <span aria-hidden>→</span>
          </Link>
        </section>

        <nav className="chapters" aria-label="Chapters">
          {CHAPTERS.map(([id, label]) => <a key={id} href={`#${id}`} onClick={(e) => { e.preventDefault(); document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }}>{label}</a>)}
        </nav>

        <Section n={1} id="what" title="What is an acequia?" kicker="A river, a small dam, one long ditch, and a lot of shared work.">
          <Anatomy />
          <div className="people">
            <h3>The people</h3>
            <div className="people-grid">
              <div><strong>Parciantes</strong><p>The members. Each has a share of the water and helps with the work.</p></div>
              <div><strong>Mayordomo</strong><p>Chosen by the members to run the ditch and divide the water.</p></div>
              <div><strong>Comisión</strong><p>An elected commission, often three people, that governs the acequia.</p></div>
            </div>
          </div>
          <h3 className="mt-24 anchor" id="words">Words to know</h3>
          <dl className="glossary">
            {GLOSSARY.map((g) => <div key={g.term}><dt>{g.term}</dt><dd>{g.def}</dd></div>)}
          </dl>
          <p className="small muted">Definitions in our own words, checked against the <a href={SOURCES.utton.url}>UNM Utton Center glossary</a> and NMAA’s note on <a href={SOURCES.nmaaRepartimiento.url}>repartimiento</a>.</p>
        </Section>

        <Section n={2} id="history" title="Where they came from">
          <ol className="timeline">
            {TIMELINE.map((t) => <li key={t.year}><span className="t-year">{t.year}</span><span className="t-text">{t.text} <Cite s={t.source} /></span></li>)}
          </ol>
          <div className="facts-grid">{FACTS.origins.map((f, i) => <FactCard key={i} f={f} />)}</div>
        </Section>

        <Section n={3} id="beyond" title="Beyond New Mexico" kicker="Acequias also run in southern Colorado, and Texas had them too.">
          <div className="facts-grid">{FACTS.beyond.map((f, i) => <FactCard key={i} f={f} />)}</div>
        </Section>

        <Section n={4} id="matter" title="Why they matter" kicker="Earthen ditches leak. The water that leaks out doesn’t go to waste.">
          <Flow label="Where ditch water goes" steps={[
            { t: 'Ditch', d: 'water flows in an earthen channel' },
            { t: 'Seepage', d: 'some soaks into the bed and banks' },
            { t: 'Groundwater', d: 'shallow aquifers fill back up' },
            { t: 'Streams', d: 'water can return slowly to the river' },
            { t: 'Plants', d: 'trees and grasses grow along ditches' },
            { t: 'Wildlife', d: 'birds and animals use that habitat' },
          ]} />
          <p className="small muted">Steps summarized from <Cite s="nmsuWtf" />.</p>
          <div className="facts-grid">{FACTS.matter.map((f, i) => <FactCard key={i} f={f} />)}</div>
          <div className="facts-grid">{FACTS.today.map((f, i) => <FactCard key={i} f={f} />)}</div>
        </Section>

        <Section n={5} id="count" title="How many are there?">
          <CountsChart />
        </Section>

        <Section n={6} id="disaster" title="When disaster hits" kicker="Fire strips the hills, and the next rain carries ash and mud into the ditches.">
          <Flow label="How disaster money reaches an acequia, and where volunteers get stuck" steps={[
            { t: 'Damage', d: 'flood or fire breaks the ditch' },
            { t: 'Documentation', d: 'photos, locations, cost estimates', stuck: true },
            { t: 'Agency', d: 'state or federal review' },
            { t: 'Money', d: 'often paid back after the work', stuck: true },
          ]} />
          <p className="small"><span className="stuck-key" aria-hidden /> Where volunteers get stuck: proving the damage, and paying first. Sources: <Cite s="sourceNmMuddy" />, <Cite s="nmaa2023" />.</p>
          <div className="facts-grid">{FACTS.disaster.map((f, i) => <FactCard key={i} f={f} />)}</div>
        </Section>

        <Section n={7} id="act" title="What you can do">
          <ul className="act-list">
            <li>Issues, the 2026 bills, and programs and jobs are on the <Link to="/act">Act tab</Link>.</li>
            <li><a href="https://lasacequias.org/">New Mexico Acequia Association</a> supports acequias across the state.</li>
            <li><a href={SOURCES.cuHandbook.url}>Colorado Acequia Handbook</a>, for Colorado acequias.</li>
            <li>If you live near an acequia, ask the mayordomo when the spring limpia is. Extra hands help.</li>
          </ul>
        </Section>

      </div>
    </div>
  )
}
