import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, CheckCircle2, CloudOff, Info, Loader2, RefreshCw, XCircle } from 'lucide-react'
import { useMeta, useOnline, useOutboxSummary, useSyncRunning } from '../lib/hooks'
import type { Outcome, StructureType } from '../db/types'
import { outcomeLabel, typeLabel } from '../config/labels'

export function DemoBanner() {
  const hidden = useMeta('hideDemoBanner', false)
  if (hidden) return null
  return (
    <div className="demo-banner" role="note">
      <span>Demo data</span> fictional acequias &amp; event
    </div>
  )
}

/** Synced · N waiting · Offline · Syncing · N need attention */
export function SyncPill() {
  const online = useOnline()
  const running = useSyncRunning()
  const { waiting, attention, paused } = useOutboxSummary()
  let state = 'synced'
  let label = 'Synced'
  let icon = <CheckCircle2 size={16} aria-hidden />
  if (running) [state, label, icon] = ['waiting', 'Syncing…', <Loader2 size={16} className="spin" aria-hidden />]
  else if (attention) [state, label, icon] = ['attention', `${attention} need${attention === 1 ? 's' : ''} attention`, <AlertTriangle size={16} aria-hidden />]
  else if (paused) [state, label, icon] = ['attention', 'Sign in to sync', <AlertTriangle size={16} aria-hidden />]
  else if (!online) [state, label, icon] = ['offline', waiting ? `Offline · ${waiting} waiting` : 'Offline', <CloudOff size={16} aria-hidden />]
  else if (waiting) [state, label, icon] = ['waiting', `${waiting} waiting`, <RefreshCw size={16} aria-hidden />]
  return (
    <Link to="/steward/sync" className="sync-pill" data-state={state} aria-label={`Sync status: ${label}. Open sync center.`}>
      {icon}
      {label}
    </Link>
  )
}

export function OutcomeChip({ outcome }: { outcome: Outcome | 'gap' | 'draft' }) {
  const label = outcome === 'gap' ? 'Not assessed' : outcome === 'draft' ? 'Draft' : outcomeLabel(outcome)
  return (
    <span className={`chip chip-${outcome}`}>
      <span className="dot" aria-hidden />
      {label}
    </span>
  )
}

/** Small line drawings for each structure type, so lists scan without reading. */
export function TypeGlyph({ type }: { type: StructureType | null | undefined }) {
  const paths: Record<string, ReactNode> = {
    presa: <><path d="M3 16h18" /><path d="M5 16V9l3-2 3 2 3-2 3 2 2-1v8" /></>,
    headgate: <><path d="M6 20V5h12v15" /><path d="M9 9h6v5H9z" /><path d="M12 5V2" /></>,
    culvert: <><circle cx="12" cy="13" r="5" /><path d="M2 13h5M17 13h5M3 20h18" /></>,
    flume: <><path d="M3 9h18v4H3z" /><path d="M6 13v7M18 13v7" /></>,
    sand_trap: <><path d="M4 7v10h16V7" /><path d="M7 14h2M11 15h2M15 13h2" /></>,
    ditch_segment: <><path d="M2 8c4 0 6 8 10 8s6-8 10-8" /><path d="M2 13c4 0 6 6 10 6" /></>,
    other: <><circle cx="12" cy="12" r="8" /><path d="M12 8v5M12 16v.5" /></>,
  }
  return (
    <span className="type-glyph" aria-hidden title={typeLabel(type)}>
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        {paths[type ?? 'other']}
      </svg>
    </span>
  )
}

/** The signature ditch line drawn under section heads. */
export function Flowline() {
  return (
    <svg className="flowline" viewBox="0 0 72 10" aria-hidden>
      <path d="M0 5 H30 L34 1 V9 L38 5 H72" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" />
    </svg>
  )
}

export function Notice({ tone, children }: { tone: 'ok' | 'warn' | 'bad' | 'info'; children: ReactNode }) {
  const Icon = { ok: CheckCircle2, warn: AlertTriangle, bad: XCircle, info: Info }[tone]
  return (
    <div className={`notice notice-${tone}`} role={tone === 'bad' ? 'alert' : 'status'}>
      <Icon size={20} aria-hidden />
      <div>{children}</div>
    </div>
  )
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <h2>{title}</h2>
      {children}
    </div>
  )
}

// ---- toast: every data-changing button says what happened ----

const ToastCtx = createContext<(msg: string) => void>(() => {})
export function ToastProvider({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState<string | null>(null)
  const show = useCallback((m: string) => {
    setMsg(m)
    window.clearTimeout((show as unknown as { t?: number }).t)
    ;(show as unknown as { t?: number }).t = window.setTimeout(() => setMsg(null), 3200)
  }, [])
  return (
    <ToastCtx.Provider value={show}>
      {children}
      <div aria-live="polite">
        {msg && (
          <div className="toast">
            <CheckCircle2 size={18} aria-hidden /> {msg}
          </div>
        )}
      </div>
    </ToastCtx.Provider>
  )
}
export const useToast = () => useContext(ToastCtx)
