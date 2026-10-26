// A guided tour: a spotlight moves from one part of the screen to the next,
// with a note pinned beside it. Shown once per role (or on request from More).
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { haptic } from './native'

export interface TourStep {
  /** CSS selectors tried in order; the first visible match is spotlighted. None = centered note. */
  target?: string[]
  title: string
  body: string
}

const doneKey = (key: string) => `aw-tour-${key}`
// automated browsers (tests, screenshots) skip tours unless one is asked for with ?tour=1
const tourDone = (key: string) => { try { return navigator.webdriver || localStorage.getItem(doneKey(key)) === '1' } catch { return true } }
const markDone = (key: string) => { try { localStorage.setItem(doneKey(key), '1') } catch { /* private mode */ } }

function find(sel?: string[]): HTMLElement | null {
  for (const s of sel ?? []) {
    for (const el of document.querySelectorAll<HTMLElement>(s)) {
      const r = el.getBoundingClientRect()
      if (r.width && r.height && getComputedStyle(el).visibility !== 'hidden') return el
    }
  }
  return null
}
const inFixed = (el: HTMLElement) => {
  for (let n: HTMLElement | null = el; n; n = n.parentElement) if (getComputedStyle(n).position === 'fixed' || getComputedStyle(n).position === 'sticky') return true
  return false
}

/** Starts once per id, when `requires` is on screen (or again when `force` is set). */
export function Tour({ id, steps, requires, force = false, onEnd }: { id: string; steps: TourStep[]; requires: string; force?: boolean; onEnd?: () => void }) {
  const [i, setI] = useState<number | null>(null)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const [cardH, setCardH] = useState(220)
  const card = useRef<HTMLDivElement>(null)

  // wait until the screen has drawn the part the tour needs, then start
  useEffect(() => {
    if (i !== null || !(force || !tourDone(id))) return
    let tries = 0
    const t = window.setInterval(() => {
      if (document.querySelector(requires) && !document.querySelector('.sheet-scrim')) { window.clearInterval(t); setI(0) }
      else if (++tries > 30) window.clearInterval(t)
    }, 400)
    return () => window.clearInterval(t)
  }, [force, id, i, requires])

  const measure = useCallback(() => {
    if (i === null) return
    const el = find(steps[i].target)
    setRect(el ? el.getBoundingClientRect() : null)
  }, [i, steps])

  // bring the target into view, then measure; keep measuring on scroll/resize
  useLayoutEffect(() => {
    if (i === null) return
    const el = find(steps[i].target)
    if (el && !inFixed(el)) el.scrollIntoView({ block: 'center', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
    measure()
    const t = window.setTimeout(measure, 420)
    window.addEventListener('resize', measure)
    window.addEventListener('scroll', measure, { passive: true })
    card.current?.focus({ preventScroll: true })
    return () => { window.clearTimeout(t); window.removeEventListener('resize', measure); window.removeEventListener('scroll', measure) }
  }, [i, steps, measure])

  const end = useCallback(() => {
    markDone(id)
    setI(null)
    onEnd?.()
  }, [id, onEnd])

  useEffect(() => {
    if (i === null) return
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') end()
      if (e.key === 'ArrowRight' || e.key === 'Enter') next()
      if (e.key === 'ArrowLeft') setI((n) => (n ? n - 1 : n))
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  })

  if (i === null) return null
  const step = steps[i]
  const last = i === steps.length - 1
  function next() {
    haptic()
    if (last) end()
    else setI((n) => (n ?? 0) + 1)
  }

  const vw = window.innerWidth
  const vh = window.innerHeight
  const pad = 6
  const spot = rect ? { top: rect.top - pad, left: rect.left - pad, width: rect.width + pad * 2, height: rect.height + pad * 2 } : { top: vh / 2, left: vw / 2, width: 0, height: 0 }
  // keep the note fully on screen: under the target if it fits, else above, else
  // pinned just over the bottom tab bar
  const topSafe = 96
  const bottomSafe = (document.querySelector('.tabbar') as HTMLElement | null)?.offsetHeight ?? 0
  const spaceBelow = rect ? vh - bottomSafe - 12 - (spot.top + spot.height + 14) : 0
  const spaceAbove = rect ? spot.top - 14 - topSafe : 0
  const below = !rect || spaceBelow >= cardH || (spaceBelow >= spaceAbove && spaceAbove < cardH)
  const pinned = !!rect && spaceBelow < cardH && spaceAbove < cardH
  const cardW = Math.min(360, vw - 32)
  const cx = rect ? rect.left + rect.width / 2 : vw / 2
  const left = Math.max(16, Math.min(vw - cardW - 16, cx - cardW / 2))
  const pos: React.CSSProperties = !rect
    ? { left, top: '50%', transform: 'translateY(-50%)', width: cardW }
    : pinned
      ? { left, top: vh - bottomSafe - 12 - cardH, width: cardW }
      : below
        ? { left, top: spot.top + spot.height + 14, width: cardW }
        : { left, bottom: vh - spot.top + 14, width: cardW }

  return createPortal(
    <div className="tour" role="dialog" aria-modal="true" aria-labelledby="tour-title" aria-describedby="tour-body">
      <div className="tour-block" onClick={(e) => e.stopPropagation()} />
      <div className={`tour-spot${rect ? '' : ' none'}`} style={spot} aria-hidden />
      <div className={`tour-card${rect && !pinned ? (below ? ' below' : ' above') : ''}`} style={pos} ref={(el) => { card.current = el; if (el && Math.abs(el.offsetHeight - cardH) > 4) setCardH(el.offsetHeight) }} tabIndex={-1} key={i}>
        {rect && !pinned && <span className="tour-arrow" style={{ left: Math.max(18, Math.min(cardW - 18, cx - left)) }} aria-hidden />}
        <p className="tour-count">{i + 1} of {steps.length}</p>
        <h2 id="tour-title">{step.title}</h2>
        <p id="tour-body">{step.body}</p>
        <div className="tour-actions">
          <button className="btn-text" onClick={end}>{last ? 'Close' : 'Skip tour'}</button>
          {i > 0 && <button className="btn btn-small" onClick={() => setI(i - 1)}>Back</button>}
          <button className="btn btn-primary btn-small" onClick={next}>{last ? 'Done' : 'Next'}</button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
