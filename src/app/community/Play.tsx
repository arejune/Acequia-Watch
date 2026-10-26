// Turno, drawn on a canvas. The engine (src/game/turno.ts) holds the rules;
// this file draws a frame, turns touches into taps, and shows the HUD.
import { useCallback, useEffect, useRef, useState } from 'react'
import { CircleHelp, CloudRain, Droplets, Pause, Play as PlayIcon, RotateCcw, Sprout, Sun, Trophy } from 'lucide-react'
import { DITCH_BOTTOM, DITCH_TOP, DITCH_X, H, RATES, W, newGame, readBest, saveBest, spawnDebris, step, tap, type Debris, type Field, type Game, type Signal } from '../../game/turno'
import { HowToPlay } from './HowToPlay'
import { haptic } from '../../components/native'

type Phase = 'intro' | 'rules' | 'playing' | 'paused' | 'over'
type Box = { x: number; y: number; w: number; h: number }

const PRACTICED_KEY = 'aw-turno-practiced'
const practiced = () => { try { return localStorage.getItem(PRACTICED_KEY) === '1' } catch { return true } }

/** The practice round: each step waits for the player to do one thing. */
const COACH: { text: string; target: (g: Game) => Box | null; done: (g: Game) => boolean; enter?: (g: Game) => void }[] = [
  { text: 'Tap the field at the top left to open its gate.', target: (g) => g.fields[0], done: (g) => g.fields[0].open },
  { text: 'Water is running in, and the bar on its left is rising. Tap the field again to close the gate before the bar hits the top.', target: (g) => ({ x: g.fields[0].x - 18, y: g.fields[0].y, w: 16, h: g.fields[0].h }), done: (g) => !g.fields[0].open && g.fields[0].moisture > 0.45 },
  { text: 'Now open the other three fields. They share one ditch, so each one fills more slowly.', target: () => ({ x: 14, y: 110, w: 332, h: 430 }), done: (g) => g.fields.slice(1).every((f) => f.open) },
  { text: 'A branch is floating down the ditch. Tap it before it jams a gate.', target: (g) => { const d = g.debris[0]; return d ? { x: d.x - 18, y: d.y - 18, w: 36, h: 36 } : null }, done: (g) => g.debris.length === 0, enter: (g) => spawnDebris(g) },
]
interface Hud { score: number; lives: number; level: number; harvests: number; event: string | null; warn: boolean }

const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const mix = (c1: number[], c2: number[], t: number) => `rgb(${c1.map((v, i) => Math.round(lerp(v, c2[i], t))).join(',')})`
const DRY = [226, 196, 128]
const TREES: [number, number, number][] = [[44, 262, 13], [102, 292, 10], [290, 118, 14], [326, 160, 10], [252, 372, 11], [318, 392, 13], [52, 478, 12], [112, 520, 9], [70, 560, 11], [280, 560, 12], [330, 548, 9]]
const WET = [116, 78, 46]

export default function Play() {
  const wrap = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const game = useRef<Game>(newGame())
  const [phase, setPhase] = useState<Phase>('intro')
  const [hud, setHud] = useState<Hud>({ score: 0, lives: 3, level: 1, harvests: 0, event: null, warn: false })
  const [best, setBest] = useState(readBest())
  const [newBest, setNewBest] = useState(false)
  const view = useRef({ scale: 1, ox: 0, oy: 0, dpr: 1 })
  const phaseRef = useRef(phase)
  phaseRef.current = phase
  const [coach, setCoach] = useState<number | null>(null)
  const coachRef = useRef(coach)
  coachRef.current = coach
  const [coachDone, setCoachDone] = useState(false)

  const signal = useCallback((s: Signal[]) => {
    if (s.includes('lost')) haptic(60)
    else if (s.includes('harvest')) haptic(25)
    else if (s.includes('storm') || s.includes('drought')) haptic(40)
    else if (s.length) haptic(8)
    if (s.includes('over')) {
      const g = game.current
      const nb = saveBest(g.score)
      setNewBest(nb)
      if (nb) setBest(g.score)
      setPhase('over')
    }
  }, [])

  // size the canvas to its box, crisp on high-DPI screens
  useEffect(() => {
    const el = wrap.current
    const cv = canvas.current
    if (!el || !cv) return
    const fit = () => {
      const r = el.getBoundingClientRect()
      const dpr = Math.min(window.devicePixelRatio || 1, 2.5)
      cv.width = Math.round(r.width * dpr)
      cv.height = Math.round(r.height * dpr)
      cv.style.width = `${r.width}px`
      cv.style.height = `${r.height}px`
      const scale = Math.min(r.width / W, r.height / H)
      view.current = { scale, ox: (r.width - W * scale) / 2, oy: (r.height - H * scale) / 2, dpr }
      draw(cv, game.current, performance.now() / 1000, view.current, null)
    }
    const ro = new ResizeObserver(fit)
    ro.observe(el)
    fit()
    return () => ro.disconnect()
  }, [])

  // the loop: runs every frame while the screen is open; the game only advances while playing
  useEffect(() => {
    let raf = 0
    let last = performance.now()
    let hudAt = 0
    const frame = (now: number) => {
      const dt = (now - last) / 1000
      last = now
      const g = game.current
      if (phaseRef.current === 'playing') signal(step(g, dt))
      const c = coachRef.current
      if (c !== null && phaseRef.current === 'playing' && COACH[c].done(g)) {
        haptic(20)
        if (c + 1 < COACH.length) { COACH[c + 1].enter?.(g); setCoach(c + 1) } else { setCoach(null); setCoachDone(true) }
      }
      if (canvas.current) draw(canvas.current, g, now / 1000, view.current, c !== null ? COACH[c].target(g) : null)
      if (now - hudAt > 100) {
        hudAt = now
        setHud((h) => {
          const ev = g.event ? g.event.kind : null
          const warn = !!g.event && g.event.warn > 0
          return h.score === g.score && h.lives === g.lives && h.level === g.level && h.event === ev && h.warn === warn ? h : { score: g.score, lives: g.lives, level: g.level, harvests: g.harvests, event: ev, warn }
        })
      }
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    const hide = () => { if (document.hidden && phaseRef.current === 'playing') setPhase('paused') }
    document.addEventListener('visibilitychange', hide)
    return () => { cancelAnimationFrame(raf); document.removeEventListener('visibilitychange', hide) }
  }, [signal])

  const start = () => {
    haptic(15)
    game.current = newGame()
    setCoach(null)
    setCoachDone(false)
    setNewBest(false)
    setPhase('playing')
  }
  const practice = () => {
    haptic(15)
    const g = newGame()
    g.calm = true
    g.nextDebris = 1e9
    game.current = g
    setCoachDone(false)
    setCoach(0)
    setPhase('playing')
  }
  const finishPractice = () => {
    try { localStorage.setItem(PRACTICED_KEY, '1') } catch { /* private mode */ }
    start()
  }

  const onPointer = (e: React.PointerEvent) => {
    if (phase !== 'playing') return
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const { scale, ox, oy } = view.current
    const x = (e.clientX - r.left - ox) / scale
    const y = (e.clientY - r.top - oy) / scale
    signal(tap(game.current, x, y))
  }

  const banner = hud.event === 'storm' ? (hud.warn ? 'Storm coming. Close some gates.' : 'Storm! Too much water.')
    : hud.event === 'drought' ? (hud.warn ? 'Dry spell coming. Fill up now.' : 'Dry spell. Less water in the ditch.')
    : hud.event === 'debris' ? 'Debris coming down!' : null
  const BannerIcon = hud.event === 'storm' ? CloudRain : hud.event === 'drought' ? Sun : Droplets

  return (
    <div className="play-screen">
      <div className="play-hud">
        <span className="hud-score"><small>Score</small>{hud.score.toLocaleString()}</span>
        <span className="hud-lives" role="img" aria-label={`${hud.lives} lives left`}>
          {[0, 1, 2].map((n) => <Sprout key={n} size={20} aria-hidden className={n < hud.lives ? 'on' : ''} />)}
        </span>
        <span className="hud-level"><small>Level</small>{hud.level}</span>
        <button className="icon-round" aria-label="How to play" onClick={() => setPhase('rules')}><CircleHelp size={18} aria-hidden /></button>
        <button className="icon-round" aria-label={phase === 'paused' ? 'Resume' : 'Pause'} disabled={phase !== 'playing' && phase !== 'paused'} onClick={() => setPhase(phase === 'paused' ? 'playing' : 'paused')}>
          {phase === 'paused' ? <PlayIcon size={18} aria-hidden /> : <Pause size={18} aria-hidden />}
        </button>
      </div>

      {phase === 'playing' && coach !== null && (
          <div className="coach" key={coach} role="status">
            <p className="coach-step">Practice · {coach + 1} of {COACH.length}</p>
            <p>{COACH[coach].text}</p>
            <button className="btn-text" onClick={finishPractice}>Skip practice</button>
          </div>
      )}
      <div className="play-stage" ref={wrap}>
        <canvas ref={canvas} onPointerDown={onPointer} aria-label="Turno game board. Tap fields to open or close their gates; tap debris to clear it." role="img" />
        {phase === 'playing' && banner && coach === null && <div key={banner} className={`play-banner ${hud.event}`}><BannerIcon size={18} aria-hidden /> {banner}</div>}
        {phase === 'playing' && coachDone && (
          <div className="play-overlay">
            <div className="play-panel">
              <h2>That’s the whole game</h2>
              <p>Keep every bar in the light band. Now weather starts: storms send too much water and dry spells too little. You get a warning two seconds ahead.</p>
              <button className="btn btn-primary btn-block btn-lg mt-16" onClick={finishPractice}><PlayIcon size={18} aria-hidden /> Start the season</button>
            </div>
          </div>
        )}
        {phase === 'rules' && (
          <div className="play-overlay">
            <div className="play-panel play-rules-panel">
              <h2>How to play</h2>
              <HowToPlay />
              <div className="stack mt-16" style={{ '--stack': '8px' } as React.CSSProperties}>
                <button className="btn btn-primary btn-block" onClick={practice}>Practice round</button>
                <button className="btn btn-block" onClick={() => setPhase(hud.score > 0 || game.current.t > 0 ? 'paused' : 'intro')}>Back</button>
              </div>
            </div>
          </div>
        )}

        {phase === 'intro' && (
          <div className="play-overlay">
            <div className="play-panel">
              <h1 className="play-title">Turno</h1>
              <p className="play-sub"><em>Turno</em> means “turn.” This one is yours: you run the gates.</p>
              <p className="small muted">This is a touch game drawn as a picture, so a screen reader can’t play it. The score and lives above the board are read out.</p>
              <p>Water comes down the ditch and you share it between four fields, opening and closing their gates. Keep every field watered without flooding it, through storms and dry spells.</p>
              {best > 0 && <p className="play-best-line"><Trophy size={16} aria-hidden /> Best: {best.toLocaleString()}</p>}
              <div className="stack mt-16" style={{ '--stack': '8px' } as React.CSSProperties}>
                {practiced()
                  ? <button className="btn btn-primary btn-block btn-lg" onClick={start}><PlayIcon size={18} aria-hidden /> Play</button>
                  : <button className="btn btn-primary btn-block btn-lg" onClick={practice}><PlayIcon size={18} aria-hidden /> Play the practice round</button>}
                <button className="btn btn-block" onClick={() => setPhase('rules')}>How to play</button>
                {!practiced() && <button className="btn-text" onClick={start}>Skip practice and play</button>}
              </div>
            </div>
          </div>
        )}
        {phase === 'paused' && (
          <div className="play-overlay">
            <div className="play-panel center">
              <h2>Paused</h2>
              <button className="btn btn-primary btn-block btn-lg mt-16" onClick={() => setPhase('playing')}><PlayIcon size={18} aria-hidden /> Keep going</button>
              <button className="btn btn-soft btn-block mt-8" onClick={start}><RotateCcw size={18} aria-hidden /> Start over</button>
            </div>
          </div>
        )}
        {phase === 'over' && (
          <div className="play-overlay">
            <div className="play-panel center">
              <p className="kicker">Season over</p>
              <p className="play-final">{hud.score.toLocaleString()}</p>
              <p>{game.current.harvests} harvests · level {hud.level}</p>
              {newBest ? <p className="play-newbest"><Trophy size={18} aria-hidden /> New best!</p> : best > 0 && <p className="muted">Best: {best.toLocaleString()}</p>}
              <button className="btn btn-primary btn-block btn-lg mt-16" onClick={start}><RotateCcw size={18} aria-hidden /> Play again</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ------------------------------------------------------------- drawing

function draw(cv: HTMLCanvasElement, g: Game, t: number, v: { scale: number; ox: number; oy: number; dpr: number }, hl: Box | null) {
  const ctx = cv.getContext('2d')
  if (!ctx) return
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.clearRect(0, 0, cv.width, cv.height)
  ctx.setTransform(v.dpr * v.scale, 0, 0, v.dpr * v.scale, v.dpr * v.ox, v.dpr * v.oy)

  const storm = g.event?.kind === 'storm' && g.event.warn <= 0
  const drought = g.event?.kind === 'drought' && g.event.warn <= 0

  // ground
  const ground = ctx.createLinearGradient(0, 0, 0, H)
  ground.addColorStop(0, '#e6cf9c')
  ground.addColorStop(1, '#d4b57d')
  ctx.fillStyle = ground
  roundRect(ctx, 0, 0, W, H, 22)
  ctx.fill()
  ctx.save()
  roundRect(ctx, 0, 0, W, H, 22)
  ctx.clip()

  // speckles (fixed pattern)
  ctx.fillStyle = 'rgba(120, 84, 48, 0.12)'
  for (let i = 0; i < 90; i++) {
    const x = (i * 97.3) % W
    const y = (i * 53.7 + (i % 7) * 31) % H
    ctx.beginPath(); ctx.arc(x, y, 1 + (i % 3) * 0.6, 0, Math.PI * 2); ctx.fill()
  }

  // cottonwoods and brush in the open ground between fields
  for (const [x, y, r] of TREES) {
    ctx.fillStyle = 'rgba(60, 40, 20, 0.18)'
    ctx.beginPath(); ctx.ellipse(x + 3, y + r * 0.8, r, r * 0.45, 0, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = '#5f7f31'
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = '#7a9a3e'
    ctx.beginPath(); ctx.arc(x - r * 0.3, y - r * 0.3 + Math.sin(t + x) * 0.6, r * 0.55, 0, Math.PI * 2); ctx.fill()
  }

  // river along the top, and the presa that turns water into the ditch
  const riverY = 34
  ctx.fillStyle = storm ? '#7d6a52' : '#3b82c4'
  ctx.beginPath()
  ctx.moveTo(0, riverY - 18)
  for (let x = 0; x <= W; x += 20) ctx.lineTo(x, riverY - 18 + Math.sin(x / 40 + t) * 2)
  for (let x = W; x >= 0; x -= 20) ctx.lineTo(x, riverY + 16 + Math.sin(x / 50 + t * 0.8) * 2)
  ctx.closePath()
  ctx.fill()
  ctx.strokeStyle = 'rgba(255,255,255,0.5)'
  ctx.lineWidth = 1.5
  for (let k = 0; k < 6; k++) {
    const x = ((k * 70 + t * 40) % (W + 60)) - 30
    ctx.beginPath(); ctx.moveTo(x, riverY - 2 + (k % 2) * 8); ctx.lineTo(x + 18, riverY - 2 + (k % 2) * 8); ctx.stroke()
  }
  ctx.fillStyle = '#7b5233'
  roundRect(ctx, DITCH_X - 22, riverY + 6, 44, 12, 3)
  ctx.fill()

  // the acequia madre
  const flowW = Math.max(4, Math.min(20, 11 * g.flow))
  ctx.fillStyle = '#9b6a42'
  roundRect(ctx, DITCH_X - 15, DITCH_TOP - 14, 30, DITCH_BOTTOM - DITCH_TOP + 40, 12)
  ctx.fill()
  ctx.fillStyle = storm ? '#8a7356' : drought ? '#7fb2d9' : '#3b82c4'
  roundRect(ctx, DITCH_X - flowW / 2, DITCH_TOP - 10, flowW, DITCH_BOTTOM - DITCH_TOP + 32, flowW / 2)
  ctx.fill()
  ctx.strokeStyle = 'rgba(255,255,255,0.6)'
  ctx.lineWidth = 1.4
  ctx.setLineDash([7, 12])
  ctx.lineDashOffset = -t * 50 * (0.5 + g.flow * 0.5)
  ctx.beginPath(); ctx.moveTo(DITCH_X, DITCH_TOP - 8); ctx.lineTo(DITCH_X, DITCH_BOTTOM + 20); ctx.stroke()
  ctx.setLineDash([])

  // fields, gates, and the water running into them
  for (const f of g.fields) drawField(ctx, f, t, g)

  // debris
  for (const d of g.debris) drawDebris(ctx, d)

  // storm rain / dry heat
  if (storm) {
    ctx.strokeStyle = 'rgba(40, 60, 90, 0.35)'
    ctx.lineWidth = 1.2
    for (let k = 0; k < 60; k++) {
      const x = (k * 37.7 + t * 120) % (W + 40) - 20
      const y = (k * 61.3 + t * 520) % (H + 40) - 20
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 4, y + 12); ctx.stroke()
    }
    ctx.fillStyle = 'rgba(40, 50, 70, 0.12)'
    ctx.fillRect(0, 0, W, H)
  }
  if (drought) {
    ctx.fillStyle = `rgba(255, 150, 60, ${0.1 + Math.sin(t * 2) * 0.03})`
    ctx.fillRect(0, 0, W, H)
  }

  // practice round: a pulsing outline around what to tap or watch
  if (hl) {
    ctx.save()
    ctx.strokeStyle = `rgba(255, 255, 255, ${0.65 + Math.sin(t * 6) * 0.35})`
    ctx.lineWidth = 3
    ctx.setLineDash([8, 6])
    ctx.lineDashOffset = -t * 20
    roundRect(ctx, hl.x - 6, hl.y - 6, hl.w + 12, hl.h + 12, 12)
    ctx.stroke()
    ctx.restore()
  }

  // floating score text
  ctx.textAlign = 'center'
  for (const p of g.pops) {
    const a = 1 - p.age / 1.4
    ctx.font = '700 15px "Atkinson Hyperlegible Next Variable", system-ui, sans-serif'
    ctx.fillStyle = p.tone === 'good' ? `rgba(255,255,255,${a})` : `rgba(255,236,220,${a})`
    ctx.strokeStyle = p.tone === 'good' ? `rgba(31,90,40,${a})` : `rgba(140,40,20,${a})`
    ctx.lineWidth = 3.5
    ctx.strokeText(p.text, p.x, p.y - p.age * 30)
    ctx.fillText(p.text, p.x, p.y - p.age * 30)
  }
  ctx.restore()
}

function drawField(ctx: CanvasRenderingContext2D, f: Field, t: number, g: Game) {
  const m = Math.max(0, Math.min(1, f.moisture))
  const dead = f.dead > 0
  // the field
  ctx.save()
  ctx.globalAlpha = dead ? 0.55 : 1
  ctx.shadowColor = 'rgba(60, 40, 20, 0.25)'
  ctx.shadowBlur = 8
  ctx.shadowOffsetY = 3
  ctx.fillStyle = mix(DRY, WET, m)
  roundRect(ctx, f.x, f.y, f.w, f.h, 12)
  ctx.fill()
  ctx.restore()

  // standing water when it is too wet
  if (f.flood > 0 && !dead) {
    ctx.fillStyle = `rgba(59, 130, 196, ${0.25 + Math.min(0.45, f.flood / RATES.floodLimit * 0.45)})`
    roundRect(ctx, f.x + 4, f.y + 4, f.w - 8, f.h - 8, 9)
    ctx.fill()
    ctx.strokeStyle = 'rgba(255,255,255,0.55)'
    ctx.lineWidth = 1
    const r = ((t * 20) % 18) + 4
    ctx.beginPath(); ctx.arc(f.x + f.w / 2, f.y + f.h / 2, r, 0, Math.PI * 2); ctx.stroke()
  }

  // furrows and plants
  const rows = 4
  const cols = 6
  for (let r = 0; r < rows; r++) {
    const y = f.y + 16 + r * ((f.h - 28) / (rows - 1))
    ctx.strokeStyle = 'rgba(70, 45, 25, 0.25)'
    ctx.lineWidth = 1
    ctx.beginPath(); ctx.moveTo(f.x + 10, y + 4); ctx.lineTo(f.x + f.w - 10, y + 4); ctx.stroke()
    for (let c = 0; c < cols; c++) {
      const x = f.x + 16 + c * ((f.w - 32) / (cols - 1))
      if (dead) {
        ctx.strokeStyle = '#7a5a3a'
        ctx.lineWidth = 1.5
        ctx.beginPath(); ctx.moveTo(x - 3, y + 2); ctx.lineTo(x + 3, y - 3); ctx.stroke()
        continue
      }
      const s = 1.6 + f.growth * 5.2
      const sway = Math.sin(t * 2 + c + r) * 0.6
      ctx.fillStyle = f.growth > 0.8 ? '#c9a227' : m < RATES.bandLow ? '#9a9a4a' : '#4f8a2e'
      ctx.beginPath(); ctx.ellipse(x - s * 0.45 + sway, y, s * 0.55, s, -0.5, 0, Math.PI * 2); ctx.fill()
      ctx.fillStyle = f.growth > 0.8 ? '#e0b93a' : m < RATES.bandLow ? '#a8a65a' : '#6aa63c'
      ctx.beginPath(); ctx.ellipse(x + s * 0.45 + sway, y, s * 0.55, s, 0.5, 0, Math.PI * 2); ctx.fill()
    }
  }

  // growth ring in the corner
  const cx = f.side < 0 ? f.x + 16 : f.x + f.w - 16
  const cy = f.y + 14
  ctx.lineWidth = 3
  ctx.strokeStyle = 'rgba(255,255,255,0.45)'
  ctx.beginPath(); ctx.arc(cx, cy, 8, 0, Math.PI * 2); ctx.stroke()
  ctx.strokeStyle = '#ffffff'
  ctx.beginPath(); ctx.arc(cx, cy, 8, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * f.growth); ctx.stroke()

  // moisture gauge on the outer edge, with the good band marked
  const gx = f.side < 0 ? f.x - 14 : f.x + f.w + 6
  const gy = f.y + 4
  const gh = f.h - 8
  ctx.fillStyle = 'rgba(80, 55, 30, 0.25)'
  roundRect(ctx, gx, gy, 8, gh, 4); ctx.fill()
  ctx.fillStyle = 'rgba(255,255,255,0.6)'
  roundRect(ctx, gx, gy + gh * (1 - RATES.bandHigh), 8, gh * (RATES.bandHigh - RATES.bandLow), 3); ctx.fill()
  const low = m < RATES.bandLow + 0.05 || m > RATES.bandHigh
  ctx.fillStyle = low ? (Math.sin(t * 10) > 0 ? '#c0392b' : '#e67e22') : '#3b82c4'
  roundRect(ctx, gx + 1.5, gy + gh * (1 - m), 5, gh * m, 2.5); ctx.fill()

  // gate (compuerta) at the ditch
  const gateX = DITCH_X + f.side * 15
  const open = f.open && !dead
  if (open && f.clog === null) {
    // water running from the gate into the field
    ctx.strokeStyle = g.event?.kind === 'storm' && g.event.warn <= 0 ? '#8a7356' : '#3b82c4'
    ctx.lineWidth = 6
    const fx = f.side < 0 ? f.x + f.w : f.x
    ctx.beginPath(); ctx.moveTo(gateX, f.gateY); ctx.lineTo(fx, f.gateY); ctx.stroke()
    ctx.strokeStyle = 'rgba(255,255,255,0.7)'
    ctx.lineWidth = 1.5
    ctx.setLineDash([4, 6])
    ctx.lineDashOffset = f.side * t * 30
    ctx.beginPath(); ctx.moveTo(gateX, f.gateY); ctx.lineTo(fx, f.gateY); ctx.stroke()
    ctx.setLineDash([])
  }
  ctx.fillStyle = '#4a3220'
  const boardY = open ? f.gateY - 22 : f.gateY - 9
  roundRect(ctx, gateX - 4, boardY, 8, 18, 2); ctx.fill()
  ctx.fillStyle = open ? '#f2c94c' : '#e9e1cf'
  roundRect(ctx, gateX - 2.5, boardY + 2, 5, 4, 1); ctx.fill()
  // a soft ring that says "tap me" on closed gates of thirsty fields
  if (!open && !dead && m < RATES.bandLow + 0.08) {
    ctx.strokeStyle = `rgba(255,255,255,${0.4 + Math.sin(t * 6) * 0.3})`
    ctx.lineWidth = 2
    roundRect(ctx, f.x - 3, f.y - 3, f.w + 6, f.h + 6, 14); ctx.stroke()
  }
}

function drawDebris(ctx: CanvasRenderingContext2D, d: Debris) {
  ctx.save()
  ctx.translate(d.x, d.y)
  ctx.rotate(d.stuckAt !== null ? 0.3 : d.spin)
  if (d.stuckAt !== null) {
    ctx.fillStyle = 'rgba(192, 57, 43, 0.25)'
    ctx.beginPath(); ctx.arc(0, 0, 16, 0, Math.PI * 2); ctx.fill()
  }
  if (d.kind === 0) {
    ctx.strokeStyle = '#5b3b22'
    ctx.lineWidth = 3.5
    ctx.lineCap = 'round'
    ctx.beginPath(); ctx.moveTo(-11, 0); ctx.lineTo(11, 0); ctx.moveTo(-3, 0); ctx.lineTo(3, -7); ctx.moveTo(4, 0); ctx.lineTo(8, 6); ctx.stroke()
  } else if (d.kind === 1) {
    ctx.strokeStyle = '#a07a46'
    ctx.lineWidth = 1.6
    for (let k = 0; k < 5; k++) { ctx.beginPath(); ctx.arc(0, 0, 8 - k * 1.2, k, k + 4.2); ctx.stroke() }
  } else {
    ctx.fillStyle = '#6b4a2e'
    ctx.beginPath(); ctx.ellipse(0, 0, 10, 7, 0, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = '#86603d'
    ctx.beginPath(); ctx.ellipse(-3, -2, 4, 3, 0, 0, Math.PI * 2); ctx.fill()
  }
  ctx.restore()
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}
