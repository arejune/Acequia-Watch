// Follow the water: a wide valley drawing pinned under the app bar. Scrolling
// the page pans the drawing sideways and runs water from the snowpack, through
// the presa and the acequia madre, into the fields and back to the river.
// Nothing moves on its own; with reduced motion it shows the whole valley wet.
import { useEffect, useRef, useState } from 'react'
import { Cites } from './Cite'

const W = 1600
const H = 420

const STOPS = [
  { at: 0, title: 'Snow in the mountains', text: 'Spring snowmelt fills the river. In a dry year there is less of it.' },
  { at: 0.2, title: 'The presa', text: 'A small dam of rocks and brush turns part of the river into the ditch.' },
  { at: 0.42, title: 'The acequia madre', text: 'The mother ditch runs along the slope, above the fields, so water can fall to each one.' },
  { at: 0.62, title: 'Compuertas', text: 'A headgate opens and water runs down into one field. Then the next.' },
  { at: 0.82, title: 'Back to the river', text: 'What the fields don’t use soaks into the ground, and some slowly returns to the river.' },
]

/** One path for all the water, from the peaks to the far end of the valley. */
const WATER = 'M60 70 C120 120 150 170 230 205 C300 236 360 250 430 262 L470 256 C560 240 640 226 760 222 C880 218 980 220 1100 224 C1200 228 1290 232 1360 248 C1420 262 1470 300 1500 352'

export function ScrollStory({ title }: { title: string }) {
  const box = useRef<HTMLDivElement>(null)
  const stage = useRef<HTMLDivElement>(null)
  const [p, setP] = useState(0)
  const [dims, setDims] = useState({ sw: 390, sh: 400 })
  const [still] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches)

  useEffect(() => {
    if (still) { setP(1); return }
    let raf = 0
    const update = () => {
      const el = box.current
      const st = stage.current
      if (!el || !st) return
      const travel = el.offsetHeight - st.offsetHeight
      // progress starts once the stage reaches its pinned spot under the app bar
      const pinned = parseFloat(getComputedStyle(st).top) || 0
      setP(Math.max(0, Math.min(1, (pinned - el.getBoundingClientRect().top) / Math.max(1, travel))))
    }
    const on = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(update) }
    update()
    window.addEventListener('scroll', on, { passive: true })
    window.addEventListener('resize', on)
    return () => { window.removeEventListener('scroll', on); window.removeEventListener('resize', on); cancelAnimationFrame(raf) }
  }, [still])

  useEffect(() => {
    const st = stage.current
    if (!st) return
    const ro = new ResizeObserver(() => setDims({ sw: st.clientWidth, sh: st.clientHeight }))
    ro.observe(st)
    return () => ro.disconnect()
  }, [])

  // on a phone the drawing is sized to the width (sky fills the space above);
  // on a wide screen it fills the height
  const svgH = Math.min(dims.sh, Math.max(dims.sw * 0.95, dims.sh * 0.55))
  const svgW = (svgH * W) / H
  // the camera follows the stops: each stop's x in the drawing, at its scroll point
  const CAM: [number, number][] = [[0, 160], [0.2, 440], [0.42, 700], [0.62, 1000], [0.82, 1440], [1, 1500]]
  let worldX = 120
  for (let k = 1; k < CAM.length; k++) {
    if (p <= CAM[k][0]) {
      const [a0, x0] = CAM[k - 1]
      const [a1, x1] = CAM[k]
      // hold on the stop for the first part of its stretch, then ease to the next
      // the first stretch moves right away so the first scroll visibly does something
      const hold = k === 1 ? 0 : 0.4
      const t = Math.max(0, Math.min(1, ((p - a0) / (a1 - a0) - hold) / (1 - hold)))
      worldX = x0 + t * t * (3 - 2 * t) * (x1 - x0)
      break
    }
  }
  const scale = svgH / H
  const pan = still ? 0 : Math.max(dims.sw - svgW, Math.min(0, dims.sw * 0.38 - worldX * scale))
  // scroll distance roughly matches the sideways pan, so it feels like moving along the valley
  const travel = Math.round(Math.max(700, (svgW - dims.sw) * 1.1))
  const stop = STOPS.reduce((best, s, i) => (p >= s.at ? i : best), 0)

  return (
    <section className={`scrolly${still ? ' still' : ''}`} ref={box} aria-label="How water moves through an acequia" style={{ '--p': p } as React.CSSProperties}>
      <div className="scrolly-stage" ref={stage}>
        <svg className="scrolly-pan" viewBox={`0 0 ${W} ${H}`} style={{ width: still ? '100%' : svgW, height: still ? '100%' : svgH, transform: `translate3d(${pan}px,0,0)` }} preserveAspectRatio={still ? 'xMidYMid slice' : 'none'} aria-hidden>
                    <rect y="300" width={W} height="120" fill="#e2c995" />
          {/* far mountains with snow, then mesas across the valley */}
          <path d="M0 150 L70 40 L120 90 L170 30 L260 140 L340 120 L420 170 L520 150 L600 175 L700 160 L760 180 L900 172 L980 150 L1060 150 L1080 170 L1300 168 L1340 150 L1440 150 L1460 172 L1600 170 L1600 360 L0 360Z" fill="#b98a6d" />
          <path d="M70 40 L95 72 L82 70 L70 82 L58 68Z M170 30 L198 66 L184 62 L170 76 L156 62Z" fill="#f8f4ec" />
          <path d="M0 210 C200 190 400 200 600 196 C800 192 1000 200 1200 198 C1400 196 1500 204 1600 202 L1600 360 L0 360Z" fill="#e2c995" />
          {/* fields below the ditch, each with a compuerta */}
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
            const x = 760 + i * 92
            const wet = Math.max(0, Math.min(1, (p - (0.55 + i * 0.035)) * 9))
            return (
              <g key={i}>
                <path d={`M${x} 236 L${x + 80} 236 L${x + 92} 360 L${x - 4} 360Z`} fill={i % 2 ? '#9fbd5d' : '#8aa94e'} />
                <path d={`M${x} 236 L${x + 80} 236 L${x + 92} 360 L${x - 4} 360Z`} fill="#5d7f9e" opacity={wet * 0.32} />
                <rect x={x + 36} y={218} width="8" height="7" fill="#5b3b22" />
                <path d={`M${x + 40} 225 L${x + 42} 244`} stroke="#2f78b7" strokeWidth="4" strokeDasharray="20" strokeDashoffset={20 - wet * 20} />
              </g>
            )
          })}
          {/* cottonwoods */}
          {[[300, 228], [350, 244], [520, 214], [610, 210], [1420, 262], [1480, 276]].map(([x, y], i) => (
            <g key={i}><rect x={x - 2} y={y} width="4" height="14" fill="#6d4a2e" /><circle cx={x} cy={y - 8} r={i % 2 ? 12 : 15} fill="#607f33" /></g>
          ))}
          {/* the river again at the far end, where the ditch and the seepage return */}
          <path d="M1250 410 C1350 380 1450 360 1600 352" stroke="#2f78b7" strokeWidth="16" fill="none" opacity={0.25 + Math.max(0, (p - 0.8) * 3.75) * 0.75} />
          {[800, 900, 1000, 1100, 1200, 1300].map((x) => (
            <path key={x} d={`M${x + 40} 300 l0 50`} stroke="#2f78b7" strokeWidth="3" strokeDasharray="4 8" opacity={Math.max(0, (p - 0.8) * 5)} />
          ))}
          {/* the presa */}
          <path d="M424 270 l8 -6 l8 4 l8 -4 l8 6" stroke="#5b3b22" strokeWidth="5" fill="none" strokeLinecap="round" />
          {/* river bed and ditch bed, then the water that fills them as you scroll */}
          <path d="M60 70 C120 120 150 170 230 205 C300 236 360 250 430 262 C470 280 520 300 600 330 L640 360" stroke="#8d6a48" strokeWidth="16" fill="none" strokeLinecap="round" opacity="0.35" />
          <path d={WATER} stroke="#8d6a48" strokeWidth="9" fill="none" strokeLinecap="round" opacity="0.35" />
          <path className="scrolly-water" d="M60 70 C120 120 150 170 230 205 C300 236 360 250 430 262 C470 280 520 300 600 330 L640 360" pathLength={1} stroke="#2f78b7" strokeWidth="14" fill="none" strokeLinecap="round" style={{ strokeDashoffset: 1 - Math.min(1, p * 3.2) }} />
          <path className="scrolly-water" d={WATER} pathLength={1} stroke="#2f78b7" strokeWidth="7" fill="none" strokeLinecap="round" style={{ strokeDashoffset: 1 - p }} />
          {/* station markers */}
          {[[120, 120], [440, 252], [700, 222], [980, 214], [1500, 330]].map(([x, y], i) => (
            <g key={i} opacity={i <= stop ? 1 : 0.35}>
              <circle cx={x} cy={y - 34} r="15" fill={i <= stop ? '#1c1914' : '#f2ebdd'} stroke="#1c1914" strokeWidth="2.5" />
              <text x={x} y={y - 28} textAnchor="middle" className="scrolly-n" fill={i <= stop ? '#f2ebdd' : '#1c1914'}>{i + 1}</text>
            </g>
          ))}
        </svg>
        <div className="scrolly-title" style={{ opacity: Math.max(0, 1 - p * 12) }}>
          <h1>{title}</h1>
          <p>Scroll to follow the water</p>
        </div>
        <div className="scrolly-caption" key={stop} hidden={!still && p < 0.04}>
          <p className="scrolly-step">{stop + 1} of {STOPS.length}</p>
          <h2>{STOPS[stop].title}</h2>
          <p>{STOPS[stop].text}</p>
        </div>
        <div className="scrolly-bar" aria-hidden><span /></div>
      </div>
      {!still && <div style={{ height: travel }} aria-hidden />}
      <p className="source-line scrolly-src">Sources: <Cites list={['utton', 'nmsuWtf', 'undark']} /></p>
    </section>
  )
}
