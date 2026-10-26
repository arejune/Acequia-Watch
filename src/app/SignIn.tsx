// Accounts: what each kind of account can do, then three ways in: try a demo
// role, sign in, or create an account (which an admin then approves).
import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowRight, ChevronLeft, Mail } from 'lucide-react'
import { useSession } from './session'
import { backend } from '../db/backend'
import { DEMO_PASSWORD, DEMO_USERS } from '../demo/seed'
import { Notice } from '../components/ui'
import { haptic } from '../components/native'
import { homeFor } from './AppShell'
import { markOnboarded } from './Welcome'
import { saveDraft } from './Access'
import type { NewAccessRequest } from '../db/types'

const ROLES = [
  { key: 'steward', who: 'Steward', can: 'Someone on an acequia. Keeps the list of headgates and culverts, logs damage with no signal, and decides with the commission whether to share.' },
  { key: 'agency', who: 'Agency reviewer', can: 'Agency or NMAA staff. Sees only what an acequia chose to share, with cost totals and what nobody has checked. Can’t change anything.' },
  { key: 'admin', who: 'Admin', can: 'Sets up fire and flood events, adds acequias, and approves new accounts.' },
] as const

const DEMO_NOTE: Record<string, string> = {
  steward: 'Two made-up acequias after a made-up fire',
  steward2: 'A different acequia. Can’t see the first one’s data',
  agency: 'Sees the two acequias that chose to share',
  admin: 'Events, acequias, and account requests',
}

type Tab = 'demo' | 'signin' | 'create'

export function SignIn() {
  const { signIn, signUp, profile, expired } = useSession()
  const nav = useNavigate()
  const [params] = useSearchParams()
  const as = params.get('as')
  const initial = params.get('tab')
  const [tab, setTab] = useState<Tab>(initial === 'account' || initial === 'signin' ? 'signin' : initial === 'create' ? 'create' : 'demo')
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)

  const fail = (err: unknown) => setError(navigator.onLine ? (err as Error).message : 'This needs signal once. After that, the app works offline.')

  async function go(e: string, p: string, key: string) {
    haptic()
    setBusy(key)
    setError(null)
    try {
      const prof = await signIn(e, p)
      markOnboarded()
      nav(homeFor(prof.role), { replace: true })
    } catch (err) {
      fail(err)
    } finally {
      setBusy(null)
    }
  }

  return (
    <main className="signin" id="main">
      <div className="signin-inner">
        <Link to="/explore" className="back"><ChevronLeft size={22} aria-hidden /> Back</Link>
        <h1 className="screen-title mt-8">Accounts</h1>
        <p className="lede-sm">You only need one if you’re on an acequia or review damage for an agency. Reading, the bills and the game work <Link to="/explore">without an account</Link>.</p>

        <dl className="role-ledger">
          {ROLES.map((r) => (
            <div key={r.key} data-on={r.key === as}>
              <dt>{r.who}</dt>
              <dd>{r.can}</dd>
            </div>
          ))}
        </dl>

        {expired && profile && <Notice tone="warn">Your session expired. Sign in again to send what is saved on this phone. Nothing has been lost.</Notice>}

        <div className="tabs-line mt-24" role="tablist" aria-label="How to get in">
          {([['demo', 'Try a demo'], ['signin', 'Sign in'], ['create', 'Create account']] as [Tab, string][]).map(([k, label]) => (
            <button key={k} role="tab" aria-selected={tab === k} onClick={() => { setTab(k); setError(null); setNote(null) }}>{label}</button>
          ))}
        </div>
        {error && <div className="mt-16"><Notice tone="bad">{error}</Notice></div>}
        {note && <div className="mt-16"><Notice tone="ok">{note}</Notice></div>}

        {tab === 'demo' && (
          <section className="mt-16" aria-label="Demo accounts">
            <p className="small">Everything in the demo is made up. Each one opens with a short tour.</p>
            <ul className="demo-list">
              {(['steward', 'agency', 'admin', 'steward2'] as const).map((k) => (
                <li key={k}>
                  <button className={`demo-account${k === as ? ' suggested' : ''}`} disabled={!!busy} onClick={() => go(DEMO_USERS[k].email, DEMO_PASSWORD, k)}>
                    <span className="grow">
                      <strong>{busy === k ? 'Opening…' : { steward: 'Steward', agency: 'Agency reviewer', admin: 'Admin', steward2: 'Second steward' }[k]}</strong>
                      <small>{DEMO_NOTE[k]}</small>
                    </span>
                    <ArrowRight size={20} aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        {tab === 'signin' && <SignInForm busy={busy} onSubmit={(e, p) => go(e, p, 'form')} onMagic={async (email) => {
          setError(null)
          try { await backend.sendMagicLink(email); setNote('Check your email and open the link on this phone.') } catch (err) { fail(err) }
        }} />}

        {tab === 'create' && (
          <CreateForm
            busy={!!busy}
            defaultKind={as === 'agency' ? 'agency' : 'steward'}
            onSubmit={async (f) => {
              setBusy('create')
              setError(null)
              try {
                const req: NewAccessRequest = { requested_role: f.kind, acequia_name: f.kind === 'steward' ? f.acequia : null, acequia_role: f.kind === 'steward' ? f.part : null, organization: f.kind === 'agency' ? f.org : null, note: null }
                const prof = await signUp(f.email, f.password, f.name)
                if (!prof) {
                  saveDraft(req)
                  setNote('Account made. Open the confirmation email on this phone, then sign in. Your request will be ready to send.')
                  return
                }
                await backend.requestAccess(req)
                markOnboarded()
                nav('/steward', { replace: true })
              } catch (err) {
                fail(err)
              } finally {
                setBusy(null)
              }
            }}
          />
        )}
      </div>
    </main>
  )
}

function SignInForm({ busy, onSubmit, onMagic }: { busy: string | null; onSubmit: (e: string, p: string) => void; onMagic: (e: string) => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  return (
    <form onSubmit={(e) => (e.preventDefault(), onSubmit(email, password))} className="stack mt-16">
      <label className="field"><span className="label">Email</span><input className="input" type="email" autoComplete="email" inputMode="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></label>
      <label className="field"><span className="label">Password</span><input className="input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} /></label>
      <button className="btn btn-primary btn-block" disabled={!!busy}>{busy === 'form' ? 'Signing in…' : 'Sign in'}</button>
      {backend.mode === 'supabase' && (
        <button type="button" className="btn btn-block" disabled={!email || !!busy} onClick={() => onMagic(email)}><Mail size={18} aria-hidden /> Email me a link instead</button>
      )}
      {backend.mode === 'local' && <p className="small muted">This copy has no server. Accounts you create live only in this browser.</p>}
    </form>
  )
}

interface CreateFields { name: string; email: string; password: string; kind: 'steward' | 'agency'; acequia: string; part: NewAccessRequest['acequia_role']; org: string }

function CreateForm({ busy, defaultKind, onSubmit }: { busy: boolean; defaultKind: 'steward' | 'agency'; onSubmit: (f: CreateFields) => void }) {
  const [f, setF] = useState<CreateFields>({ name: '', email: '', password: '', kind: defaultKind, acequia: '', part: 'parciante', org: '' })
  const set = <K extends keyof CreateFields>(k: K, v: CreateFields[K]) => setF((x) => ({ ...x, [k]: v }))
  return (
    <form onSubmit={(e) => (e.preventDefault(), onSubmit(f))} className="stack mt-16">
      <p className="small">After you make the account, an admin checks it and links you to your acequia. Until then you’ll see a waiting screen.</p>
      <label className="field"><span className="label">Your name</span><input className="input" required autoComplete="name" value={f.name} onChange={(e) => set('name', e.target.value)} /></label>
      <label className="field"><span className="label">Email</span><input className="input" type="email" required autoComplete="email" inputMode="email" value={f.email} onChange={(e) => set('email', e.target.value)} /></label>
      <label className="field">
        <span className="label">Password</span>
        <span className="hint">At least 8 characters.</span>
        <input className="input" type="password" required minLength={8} autoComplete="new-password" value={f.password} onChange={(e) => set('password', e.target.value)} />
      </label>
      <fieldset>
        <legend>I’m joining as</legend>
        <div className="seg-choice">
          <label><input type="radio" name="kind" checked={f.kind === 'steward'} onChange={() => set('kind', 'steward')} /> <span>Someone on an acequia</span></label>
          <label><input type="radio" name="kind" checked={f.kind === 'agency'} onChange={() => set('kind', 'agency')} /> <span>Agency or NMAA staff</span></label>
        </div>
      </fieldset>
      {f.kind === 'steward' ? (
        <>
          <label className="field"><span className="label">Which acequia?</span><input className="input" required value={f.acequia} onChange={(e) => set('acequia', e.target.value)} placeholder="Acequia de…" /></label>
          <label className="field">
            <span className="label">Your part in it</span>
            <select className="select" value={f.part ?? 'parciante'} onChange={(e) => set('part', e.target.value as NewAccessRequest['acequia_role'])}>
              <option value="parciante">Parciante (member)</option>
              <option value="mayordomo">Mayordomo</option>
              <option value="commissioner">Commissioner</option>
              <option value="other">Something else</option>
            </select>
          </label>
        </>
      ) : (
        <label className="field"><span className="label">Agency or organization</span><input className="input" required value={f.org} onChange={(e) => set('org', e.target.value)} /></label>
      )}
      <button className="btn btn-primary btn-block" disabled={busy}>{busy ? 'Creating…' : 'Create account'}</button>
    </form>
  )
}
