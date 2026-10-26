import { ArrowUpRight } from 'lucide-react'
import { SOURCES, type SourceKey } from '../content/learn'

/** A source link: publisher and year, opens the page in a new tab. */
export function Cite({ s }: { s: SourceKey }) {
  const src = SOURCES[s]
  return (
    <a className="cite" href={src.url} target="_blank" rel="noreferrer">
      {src.publisher}{src.year !== 'n.d.' && ` ${src.year}`}
      <ArrowUpRight size={14} aria-hidden />
      <span className="sr-only"> (opens source in a new tab)</span>
    </a>
  )
}

/** Several sources in a row, separated by middots. */
export function Cites({ list }: { list: SourceKey[] }) {
  return (
    <span className="cites">
      {list.map((s, i) => <span key={s}>{i > 0 && ' · '}<Cite s={s} /></span>)}
    </span>
  )
}
