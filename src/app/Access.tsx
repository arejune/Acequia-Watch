// What a new account sees before an admin approves it: a short form saying how
// you're connected, then the status of that request. Nothing about any acequia
// is visible until approval (enforced by the database, see migration 0003).
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { backend } from '../db/backend'
import type { AccessRequest, NewAccessRequest } from '../db/types'
import { Notice, useToast } from '../components/ui'
import { useSession } from './session'
import { date } from '../lib/format'

const DRAFT_KEY = 'aw-access-draft'
export function saveDraft(d: Partial<NewAccessRequest>) {
  try { localStorage.setItem(DRAFT_KEY, JSON.stringify(d)) } catch { /* private mode */ }
}
function readDraft(): Partial<NewAccessRequest> {
  try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}') } catch { return {} }
}

export function Access() {
  const { profile, refresh } = useSession()
  const toast = useToast()
  const [req, setReq] = useState<AccessRequest | null | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)
  const [checking, setChecking] = useState(false)

  const load = () => backend.myRequest().then(setReq).catch(() => setReq(null))
  useEffect(() => { void load() }, [])

  async function check() {
    setChecking(true)
    try {
      await refresh()
      await load()
      toast('Checked just now.')
    } catch {
      setError('No signal. Try again when you have it.')
    } finally {
      setChecking(false)
    }
  }

  if (req === undefined) return null
  const pending = req?.status === 'pending'

  return (
    <div className="access">
      <p className="dateline">Account · {profile?.display_name || profile?.email}</p>
      {pending ? (
        <>
          <h1 className="screen-title">Waiting for your admin</h1>
          <p className="lede-sm">
            You asked to join {req.requested_role === 'agency' ? `as agency staff${req.organization ? ` from ${req.organization}` : ''}` : <>as a {req.acequia_role ?? 'member'} of <strong>{req.acequia_name}</strong></>} on {date(req.created_at)}.
          </p>
          <ol className="ledger mt-16">
            <li><span className="ledger-n">1</span><span><strong>An admin reads your request.</strong> For a steward, that’s usually someone from your commission.</span></li>
            <li><span className="ledger-n">2</span><span><strong>They link you to your acequia</strong>, or give you agency access.</span></li>
            <li><span className="ledger-n">3</span><span><strong>Your inventory and events show up here.</strong> Tap below to check.</span></li>
          </ol>
          <button className="btn btn-primary btn-block mt-16" onClick={check} disabled={checking}>{checking ? 'Checking…' : 'Check again'}</button>
          {error && <div className="mt-8"><Notice tone="warn">{error}</Notice></div>}
          <p className="mt-24">While you wait, the public side works without approval: <Link to="/explore">read about acequias</Link>, <Link to="/act">see the bills</Link>, or <Link to="/play">play Turno</Link>.</p>
        </>
      ) : (
        <RequestForm onSent={load} declined={req?.status === 'declined'} />
      )}
    </div>
  )
}

function RequestForm({ onSent, declined }: { onSent: () => void; declined: boolean }) {
  const draft = readDraft()
  const [roleKind, setRoleKind] = useState<'steward' | 'agency'>(draft.requested_role ?? 'steward')
  const [acequia, setAcequia] = useState(draft.acequia_name ?? '')
  const [pos, setPos] = useState<NewAccessRequest['acequia_role']>(draft.acequia_role ?? 'parciante')
  const [org, setOrg] = useState(draft.organization ?? '')
  const [note, setNote] = useState(draft.note ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function send(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await backend.requestAccess({
        requested_role: roleKind,
        acequia_name: roleKind === 'steward' ? acequia.trim() : null,
        acequia_role: roleKind === 'steward' ? pos : null,
        organization: roleKind === 'agency' ? org.trim() : null,
        note: note.trim() || null,
      })
      try { localStorage.removeItem(DRAFT_KEY) } catch { /* ignore */ }
      onSent()
    } catch (err) {
      setError(navigator.onLine ? (err as Error).message : 'Sending this needs signal.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={send}>
      <h1 className="screen-title">How are you connected?</h1>
      <p className="lede-sm">Your account works, but it can’t see any acequia yet. An admin checks who you are first, so nobody can read another ditch’s reports.</p>
      {declined && <div className="mt-16"><Notice tone="warn">Your last request was declined. Talk to your commission or the admin, then try again.</Notice></div>}
      <fieldset className="mt-24">
        <legend>I’m joining as</legend>
        <div className="seg-choice">
          <label><input type="radio" name="kind" checked={roleKind === 'steward'} onChange={() => setRoleKind('steward')} /> <span>Someone on an acequia</span></label>
          <label><input type="radio" name="kind" checked={roleKind === 'agency'} onChange={() => setRoleKind('agency')} /> <span>Agency or NMAA staff</span></label>
        </div>
      </fieldset>
      {roleKind === 'steward' ? (
        <>
          <label className="field mt-16"><span className="label">Which acequia?</span><input className="input" required value={acequia} onChange={(e) => setAcequia(e.target.value)} placeholder="Acequia de…" /></label>
          <label className="field mt-16">
            <span className="label">Your part in it</span>
            <select className="select" value={pos ?? 'parciante'} onChange={(e) => setPos(e.target.value as NewAccessRequest['acequia_role'])}>
              <option value="parciante">Parciante (member)</option>
              <option value="mayordomo">Mayordomo</option>
              <option value="commissioner">Commissioner</option>
              <option value="other">Something else</option>
            </select>
          </label>
        </>
      ) : (
        <label className="field mt-16"><span className="label">Agency or organization</span><input className="input" required value={org} onChange={(e) => setOrg(e.target.value)} /></label>
      )}
      <label className="field mt-16"><span className="label">Anything the admin should know (optional)</span><textarea className="textarea" rows={3} value={note} onChange={(e) => setNote(e.target.value)} /></label>
      {error && <div className="mt-16"><Notice tone="bad">{error}</Notice></div>}
      <button className="btn btn-primary btn-block mt-16" disabled={busy}>{busy ? 'Sending…' : 'Send to the admin'}</button>
    </form>
  )
}
