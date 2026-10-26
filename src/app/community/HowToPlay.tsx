// Turno's rules, one drawing per rule, drawn the way the game draws them.
const soil = '#7a5232'
const dry = '#e2c480'
const water = '#3b82c4'
const ink = '#4a3220'

function Field({ x, y, wet = 0.6, w = 70, h = 50 }: { x: number; y: number; wet?: number; w?: number; h?: number }) {
  const c = wet > 0.5 ? soil : dry
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx="6" fill={c} />
      {[0, 1, 2].map((r) => [0, 1, 2, 3].map((k) => <circle key={`${r}${k}`} cx={x + 12 + k * 15} cy={y + 12 + r * 13} r="3" fill="#5f9a34" />))}
    </g>
  )
}
const Ditch = ({ x = 100, h = 90 }: { x?: number; h?: number }) => (
  <g><rect x={x - 8} y="0" width="16" height={h} fill="#9b6a42" /><rect x={x - 4} y="0" width="8" height={h} fill={water} /></g>
)

const ART = {
  gate: (
    <svg viewBox="0 0 200 90" aria-hidden>
      <Ditch />
      <Field x={14} y={20} wet={0.8} />
      <rect x={84} y={34} width={8} height={14} fill={water} />
      <rect x={88} y={22} width="5" height="14" fill={ink} />
      <rect x={88.5} y="24" width="4" height="3" fill="#f2c94c" />
      <Field x={116} y={20} wet={0.2} />
      <rect x={108} y="38" width="5" height="14" fill={ink} />
      <text x={49} y={86} textAnchor="middle" className="howto-cap">open: water in</text>
      <text x={151} y={86} textAnchor="middle" className="howto-cap">closed</text>
    </svg>
  ),
  gauge: (
    <svg viewBox="0 0 200 90" aria-hidden>
      {[{ x: 30, m: 0.15, t: 'dries out' }, { x: 95, m: 0.6, t: 'just right' }, { x: 160, m: 1, t: 'floods' }].map(({ x, m, t }) => (
        <g key={x}>
          <rect x={x} y="6" width="12" height="62" rx="5" fill="rgba(80,55,30,.25)" />
          <rect x={x} y={6 + 62 * 0.12} width="12" height={62 * 0.58} rx="3" fill="rgba(255,255,255,.75)" />
          <rect x={x + 2.5} y={6 + 62 * (1 - m)} width="7" height={62 * m} rx="3" fill={m < 0.3 || m > 0.88 ? '#c0392b' : water} />
          <text x={x + 6} y={86} textAnchor="middle" className="howto-cap">{t}</text>
        </g>
      ))}
    </svg>
  ),
  share: (
    <svg viewBox="0 0 200 90" aria-hidden>
      <Ditch x={60} />
      <rect x={66} y="22" width="30" height="7" fill={water} /><rect x={66} y="56" width="30" height="7" fill={water} />
      <rect x={100} y="10" width="40" height="30" rx="5" fill={soil} /><rect x={100} y="46" width="40" height="30" rx="5" fill={soil} />
      <text x={170} y={30} textAnchor="middle" className="howto-num">½</text>
      <text x={170} y={66} textAnchor="middle" className="howto-num">½</text>
      <text x={60} y={86} textAnchor="middle" className="howto-cap">one ditch</text>
    </svg>
  ),
  debris: (
    <svg viewBox="0 0 200 90" aria-hidden>
      <Ditch />
      <g transform="translate(100 18) rotate(20)"><path d="M-11 0 L11 0 M-3 0 L3 -7 M4 0 L8 6" stroke="#5b3b22" strokeWidth="3.5" strokeLinecap="round" /></g>
      <path d="M100 30 v12" stroke={ink} strokeWidth="1.5" strokeDasharray="3 3" />
      <circle cx="88" cy="56" r="14" fill="rgba(192,57,43,.25)" />
      <g transform="translate(88 56) rotate(10)"><ellipse rx="9" ry="6" fill="#6b4a2e" /></g>
      <Field x={14} y={34} wet={0.3} />
      <text x={150} y={52} textAnchor="middle" className="howto-cap">tap to clear</text>
    </svg>
  ),
  weather: (
    <svg viewBox="0 0 200 90" aria-hidden>
      <g stroke="rgba(40,60,90,.55)" strokeWidth="1.5">{[10, 26, 42, 58, 74].map((x) => <path key={x} d={`M${x} ${14 + (x % 3) * 8} l-4 12`} />)}</g>
      <rect x="20" y="52" width="60" height="16" fill="#8a7356" />
      <text x={50} y={86} textAnchor="middle" className="howto-cap">storm: too much</text>
      <circle cx="150" cy="24" r="12" fill="#f2a541" />
      <rect x="138" y="58" width="24" height="8" fill="#7fb2d9" />
      <text x={150} y={86} textAnchor="middle" className="howto-cap">dry spell: too little</text>
    </svg>
  ),
}

const RULES: { art: keyof typeof ART; title: string; body: string }[] = [
  { art: 'gate', title: 'Tap a field to open its gate', body: 'Water from the ditch runs in while the gate is open. Tap the field again to close it.' },
  { art: 'gauge', title: 'Watch the bar beside each field', body: 'It shows how wet the field is. Keep the blue inside the light band and the crop grows. Empty, it dries out. Full for too long, it floods. Either way you lose that crop.' },
  { art: 'share', title: 'Open gates share the water', body: 'The ditch only carries so much. One open gate fills its field fast; with four open, each fills slowly. Open and close them in turns.' },
  { art: 'debris', title: 'Clear the branches and mud', body: 'Junk floats down the ditch and jams the first open gate it reaches, which stops water to that field. Tap it to clear it.' },
  { art: 'weather', title: 'Storms and dry spells', body: 'A note warns you two seconds ahead. Before a storm, close gates or fields flood. Before a dry spell, fill fields up while you can.' },
]

export function HowToPlay() {
  return (
    <ol className="howto">
      {RULES.map((r, n) => (
        <li key={r.art}>
          <div className="howto-art">{ART[r.art]}</div>
          <div>
            <h3><span className="howto-n">{n + 1}</span> {r.title}</h3>
            <p>{r.body}</p>
          </div>
        </li>
      ))}
      <li className="howto-score">
        <p><strong>Scoring.</strong> A crop that grows all the way is harvested: 100 points times the level, plus 50 if its bar never left the band. Lose three crops and the season ends. Every four harvests the level goes up and fields dry faster.</p>
      </li>
    </ol>
  )
}
