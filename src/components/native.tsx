// App-like building blocks: bottom sheets, in-app confirm, haptics,
// pull-to-sync, progress ring, skeletons.
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Loader2, RefreshCw } from 'lucide-react'

/** A short buzz on phones that support it (Android). Silent elsewhere. */
export const haptic = (ms = 10) => {
  try { navigator.vibrate?.(ms) } catch { /* unsupported */ }
}

export function Sheet({ open, onClose, title, children, tall }: { open: boolean; onClose: () => void; title: string; children: ReactNode; tall?: boolean }) {
  const panel = useRef<HTMLDivElement>(null)
  const start = useRef<number | null>(null)
  const [drag, setDrag] = useState(0)

  useEffect(() => {
    if (!open) return
    const prev = document.activeElement as HTMLElement | null
    panel.current?.focus()
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', esc)
    document.body.classList.add('sheet-open')
    return () => {
      window.removeEventListener('keydown', esc)
      document.body.classList.remove('sheet-open')
      prev?.focus?.()
    }
  }, [open, onClose])

  if (!open) return null
  return createPortal(
    <div className="sheet-scrim" onClick={onClose}>
      <div
        ref={panel}
        className={`sheet${tall ? ' sheet-tall' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        style={drag ? { transform: `translateY(${drag}px)`, transition: 'none' } : undefined}
        onClick={(e) => e.stopPropagation()}
      >
        {/* drag the handle down to close, like a native sheet */}
        <div
          className="sheet-grip"
          onTouchStart={(e) => (start.current = e.touches[0].clientY)}
          onTouchMove={(e) => start.current != null && setDrag(Math.max(0, e.touches[0].clientY - start.current))}
          onTouchEnd={() => {
            if (drag > 90) onClose()
            setDrag(0)
            start.current = null
          }}
        >
          <span aria-hidden />
        </div>
        <h2 className="sheet-title">{title}</h2>
        <div className="sheet-body">{children}</div>
      </div>
    </div>,
    document.body,
  )
}

// ---- confirm(): same promise API as window.confirm, drawn as a sheet ----

interface ConfirmOpts { title: string; body?: ReactNode; ok: string; danger?: boolean; cancel?: string }
const ConfirmCtx = createContext<(o: ConfirmOpts) => Promise<boolean>>(async () => false)

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [req, setReq] = useState<(ConfirmOpts & { resolve: (v: boolean) => void }) | null>(null)
  const ask = useCallback((o: ConfirmOpts) => new Promise<boolean>((resolve) => setReq({ ...o, resolve })), [])
  const done = (v: boolean) => {
    req?.resolve(v)
    setReq(null)
  }
  return (
    <ConfirmCtx.Provider value={ask}>
      {children}
      <Sheet open={!!req} onClose={() => done(false)} title={req?.title ?? ''}>
        {req?.body && <div className="mt-8">{req.body}</div>}
        <div className="stack mt-16" style={{ '--stack': '8px' } as React.CSSProperties}>
          <button className={`btn btn-block ${req?.danger ? 'btn-danger-solid' : 'btn-primary'}`} onClick={() => { haptic(); done(true) }}>{req?.ok}</button>
          <button className="btn btn-block" onClick={() => done(false)}>{req?.cancel ?? 'Cancel'}</button>
        </div>
      </Sheet>
    </ConfirmCtx.Provider>
  )
}
export const useConfirm = () => useContext(ConfirmCtx)

// ---- pull down at the top of a list to sync ----

export function PullToSync({ onSync, children }: { onSync: () => Promise<unknown>; children: ReactNode }) {
  const [pull, setPull] = useState(0)
  const [busy, setBusy] = useState(false)
  const startY = useRef<number | null>(null)
  const THRESHOLD = 70
  return (
    <div
      onTouchStart={(e) => { if (window.scrollY <= 0 && !busy) startY.current = e.touches[0].clientY }}
      onTouchMove={(e) => {
        if (startY.current == null) return
        const d = e.touches[0].clientY - startY.current
        setPull(d > 0 ? Math.min(110, d * 0.55) : 0)
      }}
      onTouchEnd={async () => {
        startY.current = null
        if (pull >= THRESHOLD) {
          haptic(15)
          setBusy(true)
          setPull(56)
          await onSync().catch(() => {})
          setBusy(false)
        }
        setPull(0)
      }}
    >
      <div className="ptr" style={{ height: pull }} aria-hidden={!busy}>
        {busy ? <Loader2 size={22} className="spin" /> : <RefreshCw size={22} style={{ transform: `rotate(${pull * 3}deg)`, opacity: Math.min(1, pull / 60) }} />}
        <span className="small">{busy ? 'Syncing…' : pull >= THRESHOLD ? 'Release to sync' : 'Pull to sync'}</span>
      </div>
      {children}
    </div>
  )
}

export function ProgressRing({ value, total, size = 112, label }: { value: number; total: number; size?: number; label: string }) {
  const r = (size - 14) / 2
  const c = 2 * Math.PI * r
  const frac = total ? value / total : 0
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label} className="ring">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--sunk)" strokeWidth="12" />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--water)" strokeWidth="12" strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={c * (1 - frac)} transform={`rotate(-90 ${size / 2} ${size / 2})`}
        className="ring-arc"
      />
      <text x="50%" y="47%" textAnchor="middle" className="ring-num">{value}</text>
      <text x="50%" y="66%" textAnchor="middle" className="ring-sub">of {total}</text>
    </svg>
  )
}

const Skeleton = ({ h = 20, w = '100%', r = 6 }: { h?: number; w?: number | string; r?: number }) => (
  <span className="skeleton" style={{ height: h, width: w, borderRadius: r }} aria-hidden />
)

export function ScreenSkeleton() {
  return (
    <div className="stack" style={{ '--stack': '14px' } as React.CSSProperties} aria-busy="true" aria-label="Loading">
      <Skeleton h={14} w="40%" />
      <Skeleton h={34} w="80%" />
      <Skeleton h={120} />
      <Skeleton h={64} />
      <Skeleton h={64} />
    </div>
  )
}

/** The ditch under the app bar fills with water as you scroll down the page. */
export function WaterLine() {
  const ref = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    let raf = 0
    const on = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        const max = document.documentElement.scrollHeight - window.innerHeight
        ref.current?.style.setProperty('--fill', String(max > 0 ? Math.min(1, window.scrollY / max) : 0))
      })
    }
    on()
    window.addEventListener('scroll', on, { passive: true })
    window.addEventListener('resize', on)
    return () => { window.removeEventListener('scroll', on); window.removeEventListener('resize', on); cancelAnimationFrame(raf) }
  }, [])
  return <span className="waterline" ref={ref} aria-hidden><span /></span>
}
