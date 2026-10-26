// First run. Three short story screens explain what an acequia is and what goes
// wrong after a fire, then one question: which one is you? Stewards and agency
// staff see what they will do before signing in; everyone else goes straight
// to the community side with no account.
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { haptic } from '../components/native'
import { Scene, type Mood } from '../components/Scene'
import { useSession } from './session'
import { DEMO_PASSWORD, DEMO_USERS } from '../demo/seed'

const ONBOARDED_KEY = 'aw-onboarded'
export const markOnboarded = () => {
  try { localStorage.setItem(ONBOARDED_KEY, '1') } catch { /* private mode */ }
}
export const isOnboarded = () => {
  try { return localStorage.getItem(ONBOARDED_KEY) === '1' } catch { return true }
}

const STORY: { mood: Mood; debris?: boolean; kicker: string; title: string; body: string }[] = [
  {
    mood: 'day',
    kicker: 'Acequia · ah-SEH-kee-ah',
    title: 'A ditch the neighbors own',
    body: 'An acequia carries river water to farms. The families on it share the water and the work, and they elect a mayordomo to run it. Some in New Mexico are older than the state.',
  },
  {
    mood: 'fire',
    debris: true,
    kicker: 'After a wildfire',
    title: 'Then the hills burn',
    body: 'Burned slopes can’t hold rain. The next storm sends mud and logs down into the ditch, and headgates break.',
  },
  {
    mood: 'dusk',
    kicker: 'Getting help',
    title: 'Proving it is slow work',
    body: 'Getting repair money takes documentation: photos, locations and cost estimates. Volunteers gather it in canyons with no cell signal.',
  },
]

type Who = 'steward' | 'agency'
const STEPS: Record<Who, { title: string; body: string }[]> = {
  steward: [
    { title: 'List what’s on your ditch', body: 'Headgates, culverts, diversions. Do it on a calm day so it’s ready.' },
    { title: 'Walk it after a fire or flood', body: 'Photo, tap how bad, move on. It saves on your phone with no signal.' },
    { title: 'Your commission decides who sees it', body: 'Agencies see nothing until you turn sharing on. Then print a damage packet.' },
  ],
  agency: [
    { title: 'See what acequias chose to share', body: 'Only events a commission has shared show up, and you can’t change them.' },
    { title: 'Check totals against the threshold', body: 'Low, likely and high cost estimates, added up per acequia.' },
    { title: 'Find what nobody has checked', body: 'Structures with no report yet, closest to known damage first.' },
  ],
}

export function Welcome() {
  const nav = useNavigate()
  const { signIn } = useSession()
  const [i, setI] = useState(0)
  const [who, setWho] = useState<Who | null>(null)
  const [busy, setBusy] = useState(false)
  const [touchX, setTouchX] = useState<number | null>(null)
  const onChoose = i >= STORY.length
  const mood: Mood = who ? 'dawn' : onChoose ? 'night' : STORY[i].mood

  const go = (n: number) => { haptic(); setI(Math.max(0, n)) }
  const community = () => {
    haptic()
    markOnboarded()
    nav('/explore', { replace: true })
  }
  const demo = async (w: Who) => {
    setBusy(true)
    try {
      await signIn(DEMO_USERS[w].email, DEMO_PASSWORD)
      markOnboarded()
      nav(w === 'steward' ? '/steward' : '/agency', { replace: true })
    } catch {
      nav(`/signin?as=${w}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <main
      className="welcome2"
      id="main"
      data-compact={onChoose}
      onTouchStart={(e) => setTouchX(e.touches[0].clientX)}
      onTouchEnd={(e) => {
        if (touchX === null || who) return
        const dx = e.changedTouches[0].clientX - touchX
        if (dx < -50 && !onChoose) go(i + 1)
        if (dx > 50 && i > 0) go(i - 1)
        setTouchX(null)
      }}
    >
      <div className="welcome-scene">
        {/* one scene per mood, crossfaded */}
        {(['day', 'fire', 'dusk', 'night', 'dawn'] as Mood[]).map((m) => (
          <div key={m} className="welcome-scene-layer" data-on={m === mood}>
            <Scene mood={m} height={420} debris={m === 'fire'} parallax={false} />
          </div>
        ))}
        <div className="welcome-brand">
          <img src="/icon.svg" alt="" width={34} height={34} />
          <strong>Acequia Watch</strong>
          {!onChoose && <button className="welcome-skip" onClick={() => go(STORY.length)}>Skip</button>}
        </div>
      </div>

      <section className="welcome-panel" aria-live="polite">
        {!onChoose && (
          <div key={i} className="welcome-copy">
            <p className="dateline">{i + 1} of {STORY.length + 1} · {STORY[i].kicker}</p>
            <h1>{STORY[i].title}</h1>
            <p className="welcome-body">{STORY[i].body}</p>
          </div>
        )}

        {onChoose && !who && (
          <div className="welcome-copy">
            <h1>Which one is you?</h1>
            <p className="welcome-body">This sets up the app for what you’ll do. You can switch later.</p>
            <div className="who-grid">
              <button className="who-card who-steward" onClick={() => { haptic(); setWho('steward') }}>
                <strong>I’m on an acequia</strong>
                <small>Commissioner, mayordomo or parciante</small>
                <ArrowRight className="who-go" size={20} aria-hidden />
              </button>
              <button className="who-card who-community" onClick={community}>
                <strong>I live here, or I just care</strong>
                <small>Learn, play, and find ways to help. No account.</small>
                <ArrowRight className="who-go" size={20} aria-hidden />
              </button>
            </div>
            <button className="who-agency" onClick={() => { haptic(); setWho('agency') }}>
              I review damage for an agency
            </button>
          </div>
        )}

        {who && (
          <div className="welcome-copy">
            <h1>{who === 'steward' ? 'What you’ll do in the app' : 'What agency staff see'}</h1>
            <ol className="ledger mt-16">
              {STEPS[who].map(({ title, body }, n) => (
                <li key={title}>
                  <span className="ledger-n">{n + 1}</span>
                  <span><strong>{title}</strong> {body}</span>
                </li>
              ))}
            </ol>
            <p className="small mt-8">The demo opens with a short tour that points at each part.</p>
            <div className="stack mt-16" style={{ '--stack': '8px' } as React.CSSProperties}>
              <button className="btn btn-primary btn-block btn-lg" disabled={busy} onClick={() => demo(who)}>
                {busy ? 'Opening the demo…' : 'Try it with demo data'} <ArrowRight size={18} aria-hidden />
              </button>
              <button className="btn btn-block" onClick={() => { markOnboarded(); nav(`/signin?as=${who}&tab=signin`) }}>Sign in</button>
              <button className="btn-text" onClick={() => { markOnboarded(); nav(`/signin?as=${who}&tab=create`) }}>Make an account</button>
            </div>
          </div>
        )}

        <div className="welcome-foot2">
          {(i > 0 || who) ? (
            <button className="icon-round" aria-label="Back" onClick={() => (who ? setWho(null) : go(i - 1))}><ArrowLeft size={20} aria-hidden /></button>
          ) : <span />}
          <div className="dots" role="tablist" aria-label="Steps">
            {[...STORY, null].map((_, n) => <button key={n} role="tab" aria-selected={n === Math.min(i, STORY.length)} aria-label={`Step ${n + 1}`} onClick={() => { setWho(null); go(n) }} />)}
          </div>
          {!onChoose ? (
            <button className="icon-round icon-round-primary" aria-label="Next" onClick={() => go(i + 1)}><ArrowRight size={20} aria-hidden /></button>
          ) : <span className="icon-round-spacer" />}
        </div>
      </section>
    </main>
  )
}
