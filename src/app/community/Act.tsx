// "Act": the issues, the bills, and ways to help. One screen with three tabs;
// issues and the message builder open as pushed screens.
import { useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { ArrowRight, ChevronDown, Copy, ExternalLink, PenLine, Send } from 'lucide-react'
import { Cites } from '../../components/Cite'
import { BILLS, CHECKED_AT, ISSUES, LETTER_TOPICS, OPPORTUNITIES, type Opportunity } from '../../content/community'
import { SOURCES } from '../../content/learn'
import { date } from '../../lib/format'
import { haptic } from '../../components/native'
import { useToast } from '../../components/ui'
import { BillTrack, OutcomeTag } from './parts'

type Tab = 'issues' | 'bills' | 'help'
const TABS: { key: Tab; label: string }[] = [
  { key: 'issues', label: 'Issues' },
  { key: 'bills', label: 'Bills' },
  { key: 'help', label: 'Help out' },
]

export default function Act() {
  const [params, setParams] = useSearchParams()
  const tab = (TABS.find((t) => t.key === params.get('tab'))?.key ?? 'issues') as Tab

  return (
    <div>
      <h1 className="screen-title">What’s at stake, and what you can do</h1>
      <div className="tabs-line mt-16" role="tablist" aria-label="Sections">
        {TABS.map((t) => (
          <button key={t.key} role="tab" aria-selected={tab === t.key} onClick={() => { haptic(); setParams({ tab: t.key }, { replace: true }) }}>{t.label}</button>
        ))}
      </div>
      <div key={tab} className="tab-panel">
        {tab === 'issues' && <Issues />}
        {tab === 'bills' && <Bills />}
        {tab === 'help' && <Help />}
      </div>
    </div>
  )
}

function Issues() {
  return (
    <ul className="issue-list" role="list">
      {ISSUES.map((it, n) => (
        <li key={it.id}>
          <Link to={`/act/issue/${it.id}`} className="issue-row">
            <span className="index-n">{String(n + 1).padStart(2, '0')}</span>
            <span className="grow">
              <strong>{it.title}</strong>
              <small>{it.what}</small>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  )
}

function Bills() {
  const [open, setOpen] = useState<string | null>(BILLS[0].id)
  return (
    <>
      <p className="mt-16">Acequia bills from the 2026 New Mexico session, plus the federal fire law. Statuses checked on nmlegis.gov on {date(CHECKED_AT)}.</p>
      <ul className="bill-list" role="list">
        {BILLS.map((b) => {
          const on = open === b.id
          return (
            <li key={b.id} className={`bill-card${on ? ' on' : ''}`}>
              <button className="bill-head" aria-expanded={on} onClick={() => { haptic(); setOpen(on ? null : b.id) }}>
                <span className="bill-num">{b.number}</span>
                <span className="grow"><strong>{b.name}</strong></span>
                <OutcomeTag bill={b} />
                <ChevronDown className="bill-chev" size={20} aria-hidden />
              </button>
              <p className="bill-plain">{b.plain}</p>
              <BillTrack bill={b} />
              {on && (
                <div className="bill-more">
                  <p><strong>Status:</strong> {b.statusLine}</p>
                  {b.sponsors && <p><strong>Sponsors:</strong> {b.sponsors}</p>}
                  {b.story && <p className="bill-story">{b.story}</p>}
                  <p className="small">Sources: <Cites list={b.sources} /></p>
                  {b.issue && <Link className="btn btn-soft btn-small" to={`/act/issue/${b.issue}`}>Read the issue <ArrowRight size={16} aria-hidden /></Link>}
                </div>
              )}
            </li>
          )
        })}
      </ul>
      <div className="callout mt-16">
        <p className="mt-0"><strong>Bills that die can come back.</strong> Lawmakers can file them again in a later session. <a href="https://www.nmlegis.gov/" target="_blank" rel="noreferrer">Follow bills on nmlegis.gov</a>, or write your legislator now.</p>
        <Link to="/act/write" className="btn btn-primary btn-block mt-8"><PenLine size={18} aria-hidden /> Write your legislator</Link>
      </div>
    </>
  )
}

const KINDS: { key: Opportunity['kind'] | 'all'; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'youth', label: 'Youth programs' },
  { key: 'job', label: 'Paid crews' },
  { key: 'event', label: 'Events' },
  { key: 'support', label: 'Support' },
]

function Help() {
  const [kind, setKind] = useState<(typeof KINDS)[number]['key']>('all')
  const list = OPPORTUNITIES.filter((o) => kind === 'all' || o.kind === kind)
  return (
    <>
      <Link to="/act/write" className="write-cta mt-16">
        <span className="grow"><strong>Write your legislator</strong><small>Pick an issue. We draft the letter, you change what you want and send it yourself.</small></span>
        <ArrowRight size={20} aria-hidden />
      </Link>
      <a className="link-row" href={SOURCES.findLegislator.url} target="_blank" rel="noreferrer">
        Find who represents you <ExternalLink size={16} aria-hidden />
      </a>

      <h2 className="mt-24">Programs, jobs and events</h2>
      <div className="filters mt-8" role="group" aria-label="Filter">
        {KINDS.map((k) => <button key={k.key} aria-pressed={kind === k.key} onClick={() => setKind(k.key)}>{k.label}</button>)}
      </div>
      <ul className="opp-list" role="list">
        {list.map((o) => (
          <li key={o.name}>
            <a className="opp" href={o.url} target="_blank" rel="noreferrer">
              <span className="grow">
                <small className="opp-kind">{KINDS.find((k) => k.key === o.kind)?.label} · {o.who}</small>
                <strong>{o.name}</strong>
                <small>{o.what}</small>
              </span>
              <ExternalLink size={16} aria-hidden className="opp-ext" />
            </a>
          </li>
        ))}
      </ul>
      <p className="small muted mt-16">Listed from each group’s own pages, checked {date(CHECKED_AT)}. Dates change, so check the page before you apply. Acequia Watch is a student project and isn’t connected to any group listed here.</p>
    </>
  )
}

export function IssueDetail() {
  const { id } = useParams()
  const it = ISSUES.find((x) => x.id === id) ?? ISSUES[0]
  const bills = BILLS.filter((b) => b.issue === it.id)
  const topic = { debris: 'disaster', money: 'disaster', drought: 'water', sale: 'water', map: 'map', repair: 'fund' }[it.art]
  return (
    <article className="issue-detail">
      <p className="dateline">Issue {String(ISSUES.indexOf(it) + 1).padStart(2, '0')} of {ISSUES.length}</p>
      <h1 className="screen-title">{it.title}</h1>
      {it.stat && (
        <p className="issue-figure"><span className="issue-figure-n">{it.stat}</span> <span>{it.statLabel}</span></p>
      )}
      <section className="issue-sec"><h2>What’s happening</h2><p>{it.what}</p></section>
      <section className="issue-sec"><h2>Why it matters</h2><p>{it.why}</p></section>
      <section className="issue-sec issue-helps"><h2>What helps</h2><p>{it.helps}</p></section>
      {bills.length > 0 && (
        <section className="issue-sec">
          <h2>Related bills</h2>
          <ul className="stack" role="list" style={{ listStyle: 'none', padding: 0 }}>
            {bills.map((b) => (
              <li key={b.id}><Link to="/act?tab=bills" className="mini-bill"><span className="bill-num">{b.number}</span><span className="grow">{b.name}</span><OutcomeTag bill={b} /></Link></li>
            ))}
          </ul>
        </section>
      )}
      <p className="small mt-16">Sources: <Cites list={it.sources} /></p>
      <Link to={`/act/write?topic=${topic}`} className="btn btn-primary btn-block mt-16"><PenLine size={18} aria-hidden /> Write a lawmaker about this</Link>
    </article>
  )
}

export function Write() {
  const [params] = useSearchParams()
  const toast = useToast()
  const [topic, setTopic] = useState(LETTER_TOPICS.find((t) => t.id === params.get('topic'))?.id ?? LETTER_TOPICS[0].id)
  const [name, setName] = useState('')
  const [town, setTown] = useState('')
  const [edited, setEdited] = useState<string | null>(null)
  const ask = LETTER_TOPICS.find((t) => t.id === topic)!.ask
  const draft = useMemo(() => [
    'Dear Representative or Senator,',
    '',
    `My name is ${name.trim() || '[your name]'} and I live in ${town.trim() || '[your town]'}. I’m writing about New Mexico’s acequias.`,
    '',
    ask,
    '',
    'Thank you for your time.',
    name.trim() || '[your name]',
  ].join('\n'), [ask, name, town])
  const text = edited ?? draft

  const copy = async () => {
    try { await navigator.clipboard.writeText(text); haptic(); toast('Copied. Paste it into an email or the legislator’s contact form.') } catch { toast('Couldn’t copy. Select the text and copy it yourself.') }
  }
  const share = async () => {
    if (navigator.share) { try { await navigator.share({ text }) } catch { /* closed */ } } else copy()
  }

  return (
    <div>
      <h1 className="screen-title">Write your legislator</h1>
      <p className="mt-8">Pick what you care about. We start the letter; change anything you want. Nothing is sent from this app.</p>

      <fieldset className="mt-16">
        <legend>What’s it about?</legend>
        <div className="chip-pick">
          {LETTER_TOPICS.map((t) => <button key={t.id} type="button" aria-pressed={topic === t.id} onClick={() => { setTopic(t.id); setEdited(null); haptic() }}>{t.label}</button>)}
        </div>
      </fieldset>
      <div className="row mt-16" style={{ gap: 10 }}>
        <label className="field grow"><span className="label">Your name</span><input className="input" value={name} autoComplete="name" onChange={(e) => { setName(e.target.value); setEdited(null) }} /></label>
        <label className="field grow"><span className="label">Town</span><input className="input" value={town} autoComplete="address-level2" onChange={(e) => { setTown(e.target.value); setEdited(null) }} /></label>
      </div>
      <label className="field mt-16">
        <span className="label">Your letter</span>
        <textarea className="textarea letter" rows={12} value={text} onChange={(e) => setEdited(e.target.value)} />
      </label>
      <div className="row mt-16" style={{ gap: 8 }}>
        <button className="btn btn-primary grow" onClick={copy}><Copy size={18} aria-hidden /> Copy</button>
        <button className="btn btn-soft grow" onClick={share}><Send size={18} aria-hidden /> Share</button>
      </div>
      <a className="link-row mt-8" href={SOURCES.findLegislator.url} target="_blank" rel="noreferrer">Find who represents you, with their email and phone <ExternalLink size={16} aria-hidden /></a>
      <p className="small muted mt-16">Facts in these drafts come from the Issues and Bills pages, where each one has its source.</p>
    </div>
  )
}
