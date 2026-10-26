// Community home, laid out like the front page of a local paper: a dateline,
// the lead story from the Roundhouse, an index of issues, and the game.
import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { ScrollStory } from '../../components/ScrollStory'
import { Cite, Cites } from '../../components/Cite'
import { BILLS, ISSUES, YEAR } from '../../content/community'
import { readBest } from '../../game/turno'
import { useSession } from '../session'
import { BillTrack } from './parts'

const today = () => new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })

export default function Explore() {
  const { profile } = useSession()
  const month = new Date().getMonth()
  const season = YEAR.find((y) => y.months.includes(month)) ?? YEAR[YEAR.length - 1]
  const bill = BILLS[0]
  const best = readBest()

  return (
    <div className="explore">
      <ScrollStory title="Water shared by neighbors for over 400 years" />

      <section className="front" data-tour="lead">
        <p className="dateline">{today()}</p>
        <p className="front-lede">
          An acequia is an irrigation ditch that a whole community owns and runs. One still in use dates to 1598, according to a state memorial. About 640 still carried water to New Mexico farms in 2021. When a fire or flood breaks one, the volunteers who run it have to prove the damage before help comes.
        </p>
        <p className="source-line">Sources: <Cites list={['hm14', 'ap2021']} /></p>
        <Link to="/learn" className="btn btn-primary">How an acequia works <ArrowRight size={18} aria-hidden /></Link>
      </section>

      <Link to="/act?tab=bills" className="story" data-tour="news">
        <p className="story-label">From the Roundhouse</p>
        <h2 className="story-head">{bill.number} is law: the acequia repair fund doubles to $5 million a year</h2>
        <p className="story-body">Mayordomos asked for exactly this at their 2022 Congreso. The governor signed it March 9, 2026. Two bigger funding bills died the same session.</p>
        <BillTrack bill={bill} />
        <span className="story-more">All the 2026 acequia bills <ArrowRight size={16} aria-hidden /></span>
      </Link>

      <aside className="almanac" aria-labelledby="season-h">
        <h2 id="season-h" className="almanac-head"><span>This time of year:</span> {season.title}</h2>
        <p>{season.text}</p>
        <div className="season-strip" aria-hidden>
          {'JFMAMJJASOND'.split('').map((m, n) => <span key={n} data-on={season.months.includes(n)} data-now={n === month}>{m}</span>)}
        </div>
        <p className="source-line">Source: <Cite s={season.source} /></p>
      </aside>

      <section aria-labelledby="issues-h" data-tour="issues">
        <h2 id="issues-h" className="section-title">What acequias are up against</h2>
        <ol className="index">
          {ISSUES.map((it, n) => (
            <li key={it.id}>
              <Link to={`/act/issue/${it.id}`}>
                <span className="index-n">{String(n + 1).padStart(2, '0')}</span>
                <span className="grow"><strong>{it.title}</strong>{it.statLabel && <small>{it.stat} {it.statLabel}</small>}</span>
                <ArrowRight size={18} aria-hidden />
              </Link>
            </li>
          ))}
        </ol>
      </section>

      <Link to="/play" className="game-strip">
        <span className="game-strip-art" aria-hidden>
          <span className="pc-field f1" /><span className="pc-field f2" /><span className="pc-ditch" /><span className="pc-field f3" /><span className="pc-field f4" />
        </span>
        <span className="grow">
          <strong>Turno</strong>
          <small>A game. Share one ditch between four fields and keep them alive through storms and dry spells.</small>
          {best > 0 && <small className="game-best">Your best: {best.toLocaleString()}</small>}
        </span>
        <ArrowRight size={20} aria-hidden />
      </Link>

      <section aria-label="More">
        <h2 className="section-title">More to do</h2>
        <ul className="link-list">
          <li><Link to="/act/write">Write your legislator <span>We draft it, you send it</span></Link></li>
          <li><Link to="/act?tab=help">Programs, paid crews and events <span>Several are for young people</span></Link></li>
          <li><Link to="/learn/quiz">Five-question quiz <span>Each answer has its source</span></Link></li>
          <li><Link to="/map">Map of the mapped ditches <span>From the State Engineer</span></Link></li>
          <li><Link to="/explore?tour=1">Show the tour again <span>What each part of the app does</span></Link></li>
        </ul>
      </section>

      {!profile && (
        <section className="steward-note">
          <h2>On an acequia?</h2>
          <p>Commissioners, mayordomos and parciantes can log damage with no signal, keep a list of every headgate, and share it with agencies when the commission agrees.</p>
          <Link to="/signin?as=steward" className="btn">Accounts and sign-in <ArrowRight size={18} aria-hidden /></Link>
        </section>
      )}
    </div>
  )
}
