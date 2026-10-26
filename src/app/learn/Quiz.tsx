import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight, Check, RotateCcw, X } from 'lucide-react'
import { QUIZ, SOURCES } from '../../content/learn'
import { haptic } from '../../components/native'

export default function Quiz() {
  const [i, setI] = useState(0)
  const [picked, setPicked] = useState<number | null>(null)
  const [score, setScore] = useState(0)
  const done = i >= QUIZ.length
  const q = QUIZ[i]

  if (done) {
    return (
      <div className="quiz-done">
        <p className="eyebrow">Check your knowledge</p>
        <p className="quiz-score">{score}<span>/{QUIZ.length}</span></p>
        <h1>{score === QUIZ.length ? 'Every one right.' : score >= 3 ? 'Nicely done.' : 'Now you know more than most.'}</h1>
        <p className="mt-8">Every answer came from a source you can open on the <Link to="/learn">Learn</Link> tab.</p>
        <button className="btn btn-primary mt-16" onClick={() => { setI(0); setPicked(null); setScore(0) }}><RotateCcw size={18} aria-hidden /> Try again</button>
      </div>
    )
  }

  return (
    <div className="quiz">
      <p className="eyebrow">Question {i + 1} of {QUIZ.length}</p>
      <div className="quiz-bar" aria-hidden><span style={{ width: `${(i / QUIZ.length) * 100}%` }} /></div>
      <h1 className="mt-16">{q.q}</h1>
      <div className="stack mt-16" style={{ '--stack': '10px' } as React.CSSProperties} role="group" aria-label="Answers">
        {q.options.map((o, n) => {
          const state = picked === null ? '' : n === q.answer ? ' right' : n === picked ? ' wrong' : ' dim'
          return (
            <button key={o} className={`quiz-opt${state}`} disabled={picked !== null} onClick={() => {
              setPicked(n)
              haptic(n === q.answer ? 15 : 40)
              if (n === q.answer) setScore((s) => s + 1)
            }}>
              <span className="grow">{o}</span>
              {picked !== null && n === q.answer && <Check size={22} aria-label="correct" />}
              {picked === n && n !== q.answer && <X size={22} aria-label="not correct" />}
            </button>
          )
        })}
      </div>
      {picked !== null && (
        <div className="quiz-why" role="status">
          <p><strong>{picked === q.answer ? 'Right.' : 'Not quite.'}</strong> {q.why}</p>
          <a href={SOURCES[q.source].url} target="_blank" rel="noreferrer" className="cite">{SOURCES[q.source].publisher}<ArrowUpRight size={14} aria-hidden /></a>
          <button className="btn btn-primary btn-block mt-16" onClick={() => { setI(i + 1); setPicked(null) }}>{i + 1 === QUIZ.length ? 'See score' : 'Next question'}</button>
        </div>
      )}
    </div>
  )
}
