import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { BookOpen, ChevronRight, ClipboardList, Download, Gamepad2, HandHeart, Info, ListTree, LogOut, Megaphone, Newspaper, PenLine, RefreshCw, Share, Compass } from 'lucide-react'
import { setMeta } from '../db/local'
import { backend } from '../db/backend'
import { useSession } from './session'
import { homeFor } from './AppShell'
import { useSeverityScale, type SeverityScale } from './steward/data'
import { useMeta, useOutboxSummary } from '../lib/hooks'
import { useInstall } from '../lib/install'
import { Flowline, useToast } from '../components/ui'
import { Sheet, useConfirm } from '../components/native'
import { DEFAULT_SEVERITY } from '../config/labels'

function Row({ to, icon: Icon, label, meta }: { to: string; icon: typeof Info; label: string; meta?: string }) {
  return (
    <li>
      <Link className="list-row" to={to}>
        <span className="type-glyph"><Icon size={22} aria-hidden /></span>
        <span className="grow"><span className="name" style={{ display: 'block' }}>{label}</span>{meta && <span className="meta">{meta}</span>}</span>
        <ChevronRight size={22} aria-hidden />
      </Link>
    </li>
  )
}

/** Install card: native prompt on Android/Chrome, illustrated steps on iPhone. */
export function InstallCard() {
  const { installed, canPrompt, ios, prompt } = useInstall()
  const [steps, setSteps] = useState(false)
  if (installed) return null
  return (
    <div className="install-card">
      <img src="/icon.svg" alt="" width={52} height={52} />
      <div className="grow">
        <strong>Install Acequia Watch</strong>
        <p className="small" style={{ margin: '2px 0 0' }}>Opens from your home screen, full screen, and works with no signal.</p>
      </div>
      <button className="btn btn-primary btn-small" onClick={() => (canPrompt ? prompt() : setSteps(true))}>
        <Download size={16} aria-hidden /> Install
      </button>
      <Sheet open={steps} onClose={() => setSteps(false)} title={ios ? 'Add to your iPhone' : 'Add to your home screen'}>
        <ol className="install-steps">
          {ios ? (
            <>
              <li><span className="step-icon"><Share size={20} aria-hidden /></span> Tap <strong>Share</strong> at the bottom of Safari.</li>
              <li><span className="step-icon">＋</span> Scroll and tap <strong>Add to Home Screen</strong>.</li>
              <li><span className="step-icon"><img src="/icon.svg" alt="" width={22} height={22} /></span> Tap <strong>Add</strong>. Open it from your home screen.</li>
            </>
          ) : (
            <>
              <li><span className="step-icon">⋮</span> Open your browser menu.</li>
              <li><span className="step-icon">＋</span> Tap <strong>Install app</strong> or <strong>Add to Home screen</strong>.</li>
              <li><span className="step-icon"><img src="/icon.svg" alt="" width={22} height={22} /></span> Open it from your home screen.</li>
            </>
          )}
        </ol>
        <p className="small muted mt-8">Open the app once with signal so it can save itself for offline use.</p>
      </Sheet>
    </div>
  )
}

export function More() {
  const { profile, signOut } = useSession()
  const nav = useNavigate()
  const toast = useToast()
  const confirm = useConfirm()
  const scale = useSeverityScale()
  const hideBanner = useMeta('hideDemoBanner', false)
  const { waiting } = useOutboxSummary()
  const [draft, setDraft] = useState<SeverityScale | null>(null)
  const [editScale, setEditScale] = useState(false)
  const s = draft ?? scale
  const steward = profile?.role === 'steward'

  return (
    <div className="stack" style={{ '--stack': '24px' } as React.CSSProperties}>
      <div className="profile-card">
        <span className="avatar" aria-hidden>{(profile?.display_name || '?').replace(/^Demo /, '').slice(0, 1)}</span>
        <div className="grow">
          <strong>{profile?.display_name}</strong>
          <div className="small muted">{profile?.email} · {profile?.role}</div>
        </div>
      </div>

      <InstallCard />

      <ul className="list">
        {steward && <Row to="/steward/inventory" icon={ListTree} label="Inventory" meta="Structures before the disaster" />}
        {steward && <Row to="/steward/reports" icon={ClipboardList} label="My reports" />}
        {steward && <Row to="/steward/sync" icon={RefreshCw} label="Sync center" meta={waiting ? `${waiting} waiting` : 'All sent'} />}
        <Row to={`${homeFor(profile?.role ?? null)}?tour=1`} icon={Compass} label="Show the tour again" />
      </ul>

      <section aria-labelledby="community-h">
        <h2 id="community-h" className="section-title">Community</h2>
        <p className="small muted mt-8">The public side of the app, the same as anyone without an account sees.</p>
        <ul className="list">
          <Row to="/explore" icon={Newspaper} label="Front page" meta="This season, the latest bill news" />
          <Row to="/learn" icon={BookOpen} label="Learn about acequias" />
          <Row to="/act" icon={Megaphone} label="Issues and bills" />
          <Row to="/act?tab=help" icon={HandHeart} label="Programs, crews and events" />
          <Row to="/act/write" icon={PenLine} label="Write your legislator" />
          <Row to="/play" icon={Gamepad2} label="Play Turno" />
        </ul>
      </section>

      {steward && (
        <section>
          <div className="row"><h2 className="grow">Severity scale</h2><button className="btn btn-small" onClick={() => setEditScale(true)}>Edit</button></div>
          <Flowline />
          <ol className="scale-list mt-8">
            {([1, 2, 3, 4] as const).map((n) => <li key={n}><span className="sev-dot" style={{ background: `var(--sev-${n})` }} aria-hidden /> <strong>{scale[n].label}.</strong> {scale[n].detail}</li>)}
          </ol>
          <p className="small muted">A suggested scale, not an agency standard. Packets print the wording in use.</p>
          <Sheet open={editScale} onClose={() => setEditScale(false)} title="Edit severity scale" tall>
            <div className="stack">
              {([1, 2, 3, 4] as const).map((n) => (
                <div key={n} className="card" style={{ padding: 12 }}>
                  <label className="field"><span className="label">Level {n} name</span>
                    <input className="input" value={s[n].label} onChange={(e) => setDraft({ ...s, [n]: { ...s[n], label: e.target.value } })} /></label>
                  <label className="field mt-8"><span className="label">Level {n} meaning</span>
                    <input className="input" value={s[n].detail} onChange={(e) => setDraft({ ...s, [n]: { ...s[n], detail: e.target.value } })} /></label>
                </div>
              ))}
              <button className="btn btn-primary btn-block" onClick={async () => { await setMeta('severityScale', draft ?? scale); setDraft(null); setEditScale(false); toast('Scale saved on this phone.') }}>Save scale</button>
              <button className="btn btn-block" onClick={async () => { await setMeta('severityScale', DEFAULT_SEVERITY); setDraft(null); setEditScale(false); toast('Scale reset.') }}>Reset to suggested</button>
            </div>
          </Sheet>
        </section>
      )}

      <section>
        <h2>Display</h2>
        <Flowline />
        <div className="list-row" style={{ cursor: 'default' }}>
          <div className="grow">
            <div className="name">Show DEMO DATA banner</div>
            <div className="meta">Keep it on for the demo video.</div>
          </div>
          <label className="switch">
            <input type="checkbox" role="switch" checked={!hideBanner} onChange={(e) => setMeta('hideDemoBanner', !e.target.checked)} aria-label="Show DEMO DATA banner" />
            <span aria-hidden />
          </label>
        </div>
        <p className="small muted">Language: English. Spanish is planned. · Server: {backend.mode === 'supabase' ? 'Supabase' : 'demo server inside this browser'}</p>
      </section>

      <button className="btn btn-block" onClick={async () => {
        const r = await signOut()
        if (r?.pending) {
          const ok = await confirm({ title: 'Sign out and lose unsent items?', body: <p>{r.pending} item{r.pending === 1 ? ' has' : 's have'} not reached the server. Signing out deletes them from this phone.</p>, ok: 'Sign out anyway', danger: true })
          if (!ok) return
          await signOut(true)
        }
        nav('/learn')
      }}>
        <LogOut size={20} aria-hidden /> Sign out
      </button>
    </div>
  )
}
