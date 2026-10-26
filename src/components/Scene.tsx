// An illustrated northern New Mexico valley: sky, mesas, cottonwoods, river,
// the acequia branching off it, and fields. Moods change the light. Water in
// the ditch moves; clouds drift; layers shift a little on scroll (parallax).
// Decorative only: aria-hidden, no data, no status colors.
import { useEffect, useRef } from 'react'

export type Mood = 'day' | 'dusk' | 'fire' | 'night' | 'dawn'

const SKY: Record<Mood, [string, string, string]> = {
  dawn: ['#f7c59f', '#fbe3c4', '#fdf1de'],
  day: ['#7fbfdc', '#bfe0e9', '#f4ead2'],
  dusk: ['#5b3f78', '#e0775a', '#f6c27a'],
  fire: ['#6e4436', '#c7714a', '#efb57a'],
  night: ['#0d1630', '#1d2b52', '#3a4a72'],
}
const LAND: Record<Mood, { far: string; mid: string; near: string; floor: string; field: [string, string]; tree: string; water: string; sun: string }> = {
  dawn: { far: '#d59a86', mid: '#b97a5c', near: '#8f5a3f', floor: '#e2c99a', field: ['#a8bf6a', '#93ad5a'], tree: '#6f8a3c', water: '#4f8fc0', sun: '#fff1c9' },
  day: { far: '#c99a7c', mid: '#b8744e', near: '#8d5638', floor: '#e3cb96', field: ['#9fbd5d', '#87a64c'], tree: '#5f7f31', water: '#2f78b7', sun: '#fff6d8' },
  dusk: { far: '#8e5d79', mid: '#7a4258', near: '#4e2a3c', floor: '#c49470', field: ['#7f8f4c', '#6c7c40'], tree: '#46512a', water: '#5d79b8', sun: '#ffd28a' },
  fire: { far: '#7b5246', mid: '#5c3a30', near: '#3b2620', floor: '#b88e66', field: ['#8c8a4a', '#7a7640'], tree: '#3f3a24', water: '#5b7f9e', sun: '#ffb26b' },
  night: { far: '#2c3557', mid: '#222a47', near: '#171d35', floor: '#2b3352', field: ['#2f3d4a', '#283542'], tree: '#1a2233', water: '#6f9bd1', sun: '#f4f1e4' },
}

export function Scene({ mood = 'day', height = 220, debris = false, className = '', parallax = true }: { mood?: Mood; height?: number; debris?: boolean; className?: string; parallax?: boolean }) {
  const ref = useRef<SVGSVGElement>(null)
  const s = SKY[mood]
  const l = LAND[mood]
  const id = `sc-${mood}`

  useEffect(() => {
    if (!parallax || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    let raf = 0
    const on = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => ref.current?.style.setProperty('--py', `${Math.min(window.scrollY, 400)}px`))
    }
    window.addEventListener('scroll', on, { passive: true })
    return () => { window.removeEventListener('scroll', on); cancelAnimationFrame(raf) }
  }, [parallax])

  return (
    <svg ref={ref} className={`scene scene-${mood} ${className}`} viewBox="0 0 400 220" preserveAspectRatio="xMidYMax slice" style={{ height }} aria-hidden focusable="false">
      <defs>
        <linearGradient id={`${id}-sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={s[0]} />
          <stop offset="0.6" stopColor={s[1]} />
          <stop offset="1" stopColor={s[2]} />
        </linearGradient>
        <radialGradient id={`${id}-glow`}>
          <stop offset="0" stopColor={l.sun} stopOpacity="0.9" />
          <stop offset="1" stopColor={l.sun} stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="400" height="220" fill={`url(#${id}-sky)`} />

      {mood === 'night' && (
        <g className="stars" fill="#fff">
          {[[30, 20], [70, 44], [120, 16], [180, 36], [240, 14], [290, 40], [350, 22], [380, 52], [150, 60], [210, 62]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r={i % 3 ? 0.9 : 1.4} style={{ animationDelay: `${i * 0.37}s` }} />)}
        </g>
      )}

      <g className="layer" style={{ ['--d' as string]: 0.08 }}>
        <circle cx="300" cy={mood === 'dusk' || mood === 'fire' ? 108 : 58} r="46" fill={`url(#${id}-glow)`} className="sun-glow" />
        <circle cx="300" cy={mood === 'dusk' || mood === 'fire' ? 108 : 58} r={mood === 'night' ? 12 : 16} fill={l.sun} />
        {mood === 'night' && <circle cx="305" cy="54" r="11" fill={s[0]} />}
      </g>

      {mood !== 'night' && (
        <g className="clouds" fill="#fff" opacity={mood === 'fire' ? 0.25 : 0.7}>
          <g className="cloud c1"><ellipse cx="60" cy="40" rx="26" ry="8" /><ellipse cx="78" cy="35" rx="16" ry="9" /></g>
          <g className="cloud c2"><ellipse cx="200" cy="28" rx="20" ry="6" /><ellipse cx="212" cy="24" rx="12" ry="7" /></g>
        </g>
      )}

      {mood === 'fire' && (
        <g className="smoke" fill="#4b3a33" opacity="0.35">
          <path d="M70 130 C60 100 90 90 80 60 C76 40 100 30 110 10 L140 10 C120 40 110 60 120 90 C126 110 100 120 104 132Z" />
          <path d="M110 128 C104 110 124 98 118 80 C114 66 132 54 138 40 L156 40 C146 60 140 76 146 96 C150 110 132 120 136 130Z" opacity="0.6" />
        </g>
      )}

      <g className="layer" style={{ ['--d' as string]: 0.18 }}>
        <path d="M0 118 L34 118 L42 104 L96 104 L104 118 L150 118 L158 96 L226 96 L236 116 L268 116 L276 108 L330 108 L340 120 L400 120 L400 220 L0 220Z" fill={l.far} />
      </g>
      <g className="layer" style={{ ['--d' as string]: 0.3 }}>
        <path d="M0 140 C40 126 70 132 110 128 C150 124 170 134 210 130 C260 125 300 138 340 132 C370 128 390 134 400 132 L400 220 L0 220Z" fill={l.mid} />
        {mood === 'fire' && <path d="M40 132 L60 120 L66 132 M80 128 L96 114 L100 128 M120 126 L132 116 L138 128" stroke="#2a1d18" strokeWidth="2" fill="none" />}
      </g>

      <g className="layer" style={{ ['--d' as string]: 0.42 }}>
        <path d="M0 152 C80 146 160 150 240 149 C300 148 360 151 400 150 L400 220 L0 220Z" fill={l.floor} />
        {/* fields on both banks, below their acequias. Phones crop to the middle, so the story sits at x 100–300. */}
        {[0, 1, 2, 3, 4].map((i) => (
          <path key={`r${i}`} d={`M${196 + i * 42} 170 L${234 + i * 42} 170 L${246 + i * 46} 220 L${200 + i * 46} 220Z`} fill={l.field[i % 2]} />
        ))}
        {[0, 1, 2, 3].map((i) => (
          <path key={`l${i}`} d={`M${132 - i * 40} 170 L${96 - i * 40} 170 L${84 - i * 44} 220 L${128 - i * 44} 220Z`} fill={l.field[(i + 1) % 2]} />
        ))}
        {/* the river comes out between the mesas and runs toward you, off the bottom */}
        <path d="M166 146 C162 152 158 158 150 166 C140 176 138 186 146 196 C152 204 146 214 136 222 L176 222 C186 212 186 200 178 192 C168 182 168 174 176 164 C180 158 178 151 174 146Z" fill={l.water} />
        <path className="river-shine" d="M170 147 C166 156 158 164 152 172 C146 182 150 192 160 200 C166 206 162 214 156 222" stroke="#fff" strokeOpacity="0.55" strokeWidth="1.3" fill="none" />
        {/* presa: rocks across the river that push water into both acequias */}
        <path d="M158 155 l4 -2.5 l4 1.5 l4 -1.5 l4 2.5" stroke={l.near} strokeWidth="2.6" fill="none" strokeLinecap="round" />
        {/* the acequias: one leaves each bank at the presa and runs along the slope above its fields */}
        {['M174 155 C200 157 240 160 300 160 S380 160 410 159', 'M158 155 C140 157 110 160 70 160 S10 160 -10 159'].map((d, k) => (
          <g key={k}>
            <path d={d} stroke={l.water} strokeWidth="3.2" fill="none" />
            <path className="acequia-flow" d={d} stroke="#fff" strokeOpacity="0.85" strokeWidth="1.2" strokeDasharray="5 9" fill="none" />
          </g>
        ))}
        {/* compuertas and laterals into each field */}
        {[215, 257, 299, 341, 383, 114, 74, 34].map((x) => (
          <g key={x}>
            <path d={`M${x} 160 L${x + (x > 160 ? 2 : -2)} 172`} stroke={l.water} strokeWidth="1.5" />
            <rect x={x - 2.2} y={158.2} width="4.4" height="3.6" fill={l.near} />
          </g>
        ))}
        {/* cottonwoods along the river */}
        {[[186, 150], [142, 151], [130, 178], [190, 186], [120, 200]].map(([x, y], i) => (
          <g key={i} className="tree" style={{ animationDelay: `${i * 0.6}s` }}>
            <rect x={x - 1.5} y={y} width="3" height="9" fill={l.near} />
            <circle cx={x} cy={y - 4} r={i % 2 ? 7 : 9} fill={l.tree} />
          </g>
        ))}
        {debris && (
          <g fill={l.near}>
            <path d="M222 156 l12 3 l-2 3 l-12 -3Z" /><circle cx="262" cy="160" r="3.2" /><path d="M96 158 l-10 2 l1 4 l10 -2Z" />
          </g>
        )}
      </g>

      <g className="layer" style={{ ['--d' as string]: 0.55 }}>
        <path d="M0 208 C30 204 60 210 96 207 L100 220 L0 220Z" fill={l.near} opacity="0.85" /><path d="M220 210 C260 205 330 212 400 206 L400 220 L216 220Z" fill={l.near} opacity="0.85" />
        <g stroke={l.near} strokeWidth="1.5" strokeLinecap="round" opacity="0.9">
          {[8, 30, 56, 80, 236, 268, 300, 340, 372].map((x, i) => <path key={i} d={`M${x} 206 l${i % 2 ? 2 : -2} -${7 + (i % 3) * 2}`} />)}
        </g>
      </g>
    </svg>
  )
}
