// Original illustration: how water moves from the river to the fields.
// The figure caption carries a full text equivalent.

const L = ({ x, y, tx, ty, n, children }: { x: number; y: number; tx: number; ty: number; n: number; children: string }) => (
  <g>
    <path d={`M${x} ${y} L${tx} ${ty}`} stroke="var(--ink)" strokeWidth="1.5" />
    <circle cx={x} cy={y} r="4" fill="var(--ink)" />
    <g transform={`translate(${tx} ${ty})`}>
      <circle r="17" fill="var(--ink)" />
      <text textAnchor="middle" dy="7" fill="var(--paper)" fontSize="19" fontWeight="700" fontFamily="var(--font-ui)">{n}</text>
      <text x="24" dy="8" fill="var(--ink)" fontSize="24" paintOrder="stroke" stroke="#ece5d6" strokeWidth="5" fontWeight="700" fontFamily="var(--font-ui)">{children}</text>
    </g>
  </g>
)

export function Anatomy() {
  return (
    <figure className="anatomy">
      <svg viewBox="0 0 800 470" role="img" aria-labelledby="anat-t anat-d">
        <title id="anat-t">How an acequia works</title>
        <desc id="anat-d">A river runs down the left side. A small dam called a presa turns some water into the main ditch, the acequia madre, which runs across the slope. Headgates called compuertas let water out of the ditch into fields below. Some water seeps from the ditch into the ground.</desc>
        {/* hills */}
        <path d="M0 0 H800 V120 C640 90 520 150 380 110 C250 75 140 120 0 95Z" fill="#e2d6bd" />
        <path d="M0 95 C140 120 250 75 380 110 C520 150 640 90 800 120 V470 H0Z" fill="#ece5d6" />
        {/* fields below the ditch */}
        {[
          'M210 250 L430 236 L452 330 L222 350Z', 'M436 236 L640 224 L668 312 L456 330Z',
          'M226 356 L454 336 L478 440 L236 462Z', 'M460 336 L670 318 L700 420 L484 440Z',
        ].map((d, i) => <path key={i} d={d} fill={i % 3 === 0 ? '#b9c98f' : '#cfd6a2'} stroke="#8a9a5b" strokeWidth="1.5" />)}
        {[0, 1, 2, 3, 4, 5, 6].map((i) => <path key={i} d={`M${240 + i * 30} ${262 - i * 2} L${252 + i * 31} ${338 - i * 2}`} stroke="#8a9a5b" strokeWidth="1.2" />)}
        {/* river */}
        <path d="M120 0 C100 80 150 140 110 220 C80 290 120 370 90 470" fill="none" stroke="#7fa6c9" strokeWidth="46" strokeLinecap="round" />
        <path d="M120 0 C100 80 150 140 110 220 C80 290 120 370 90 470" fill="none" stroke="var(--water)" strokeWidth="3" strokeDasharray="10 14" opacity="0.6" />
        {/* presa: rocks across part of the river */}
        {[0, 1, 2, 3].map((i) => <ellipse key={i} cx={118 + i * 12} cy={168 - i * 4} rx="10" ry="7" fill="#7d7468" stroke="var(--ink)" strokeWidth="1.5" />)}
        {/* acequia madre */}
        <path d="M150 162 C230 175 300 205 380 210 C480 216 600 200 760 196" fill="none" stroke="#5d4a33" strokeWidth="16" strokeLinecap="round" />
        <path d="M150 162 C230 175 300 205 380 210 C480 216 600 200 760 196" fill="none" stroke="var(--water)" strokeWidth="9" strokeLinecap="round" />
        {/* seepage dots */}
        {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => <circle key={i} cx={300 + i * 52} cy={226 + (i % 2) * 8} r="3" fill="var(--water)" opacity="0.55" />)}
        {/* compuertas and laterals */}
        {[[330, 205], [548, 210], [700, 198]].map(([x, y], i) => (
          <g key={i}>
            <path d={`M${x} ${y + 6} L${x + 4} ${y + 44}`} stroke="var(--water)" strokeWidth="5" />
            <rect x={x - 9} y={y - 14} width="18" height="22" fill="var(--surface)" stroke="var(--ink)" strokeWidth="2" />
            <path d={`M${x - 5} ${y - 6} H${x + 5}`} stroke="var(--ink)" strokeWidth="2" />
          </g>
        ))}
        <L x={132} y={164} tx={30} ty={300} n={1}>Presa</L>
        <L x={420} y={212} tx={250} ty={46} n={2}>Acequia madre</L>
        <L x={548} y={198} tx={590} ty={46} n={3}>Compuerta</L>
        <L x={560} y={290} tx={640} ty={445} n={4}>Fields</L>
        <L x={92} y={420} tx={170} ty={445} n={5}>River</L>
      </svg>
      <figcaption>
        <ol className="anatomy-key">
          <li><strong>Presa.</strong> Rocks or a small dam turn part of the river into the ditch.</li>
          <li><strong>Acequia madre.</strong> The main ditch carries water along the slope, above the fields. Some water seeps into the ground on the way.</li>
          <li><strong>Compuerta.</strong> A headgate. Opening it sends water down to a field.</li>
          <li><strong>Fields.</strong> Water spreads across the field and soaks in.</li>
          <li><strong>River.</strong> Water the fields do not use soaks down, and some can slowly return to the river.</li>
        </ol>
      </figcaption>
    </figure>
  )
}
