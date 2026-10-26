import { describe, expect, it } from 'vitest'
import { newGame, step, tap, DITCH_X, type Game } from './turno'

const run = (g: Game, seconds: number) => {
  const signals: string[] = []
  for (let t = 0; t < seconds; t += 1 / 60) signals.push(...step(g, 1 / 60))
  return signals
}
const calm = (g: Game) => { g.nextEvent = 1e9; g.nextDebris = 1e9 }

describe('Turno', () => {
  it('a field with its gate closed dries out and costs a life', () => {
    const g = newGame(1)
    calm(g)
    const s = run(g, 12)
    expect(s).toContain('lost')
    expect(g.lives).toBeLessThan(3)
  })

  it('one open gate on its own floods the field', () => {
    const g = newGame(2)
    calm(g)
    g.fields.forEach((f, i) => { f.open = i === 0 })
    run(g, 6)
    expect(g.fields[0].dead).toBeGreaterThan(0)
  })

  it('sharing water between all four gates grows crops to harvest', () => {
    const g = newGame(3)
    calm(g)
    g.fields.forEach((f) => { f.open = true })
    const s = run(g, 14)
    expect(s.filter((x) => x === 'harvest').length).toBe(4)
    expect(g.lives).toBe(3)
    expect(g.score).toBeGreaterThanOrEqual(400)
  })

  it('debris sticks in the first open gate and blocks it until tapped', () => {
    const g = newGame(4)
    calm(g)
    g.fields.forEach((f) => { f.open = true })
    g.debris.push({ id: 99, y: 70, x: DITCH_X, spin: 0, kind: 0, stuckAt: null })
    run(g, 6)
    expect(g.fields[0].clog).toBe(99)
    const d = g.debris.find((x) => x.id === 99)!
    expect(tap(g, d.x, d.y)).toEqual(['clear'])
    expect(g.fields[0].clog).toBeNull()
  })

  it('a storm floods fields left open', () => {
    const g = newGame(5)
    g.nextDebris = 1e9
    g.fields.forEach((f) => { f.open = true; f.moisture = 0.8 })
    g.event = { kind: 'storm', warn: 0, left: 8 }
    g.nextEvent = 1e9
    run(g, 7)
    expect(g.lives).toBeLessThan(3)
  })

  it('tapping a field toggles its gate, and the game ends at zero lives', () => {
    const g = newGame(6)
    const f = g.fields[2]
    tap(g, f.x + 10, f.y + 10)
    expect(f.open).toBe(true)
    calm(g)
    g.fields.forEach((x) => { x.open = false })
    const s = run(g, 40)
    expect(s).toContain('over')
    expect(g.over).toBe(true)
  })
})

describe('Turno balance', () => {
  // a careful player: opens thirsty fields, closes wet ones, clears clogs, and
  // closes most gates when a storm is coming
  const careful = (g: Game) => {
    for (const f of g.fields) {
      if (f.clog !== null) tap(g, DITCH_X + f.side * 18, f.gateY)
      const stormSoon = g.event?.kind === 'storm'
      const hi = stormSoon ? 0.45 : 0.78
      if (!f.open && f.moisture < 0.45 && f.dead === 0) f.open = true
      else if (f.open && f.moisture > hi) f.open = false
    }
  }
  const play = (seed: number, smart: boolean) => {
    const g = newGame(seed)
    let t = 0
    while (!g.over && t < 300) {
      for (let k = 0; k < 18; k++) { step(g, 1 / 60); t += 1 / 60 }
      if (smart) careful(g)
    }
    return { t, g }
  }

  it('an idle player loses within about half a minute', () => {
    for (const seed of [1, 2, 3]) expect(play(seed, false).t).toBeLessThan(40)
  })

  it('a careful player lasts much longer and harvests', () => {
    const runs = [11, 12, 13, 14, 15].map((s) => play(s, true))
    const median = runs.map((r) => r.t).sort((a, b) => a - b)[2]
    console.log('careful runs (s, harvests):', runs.map((r) => `${Math.round(r.t)}s/${r.g.harvests}`).join(' '))
    expect(median).toBeGreaterThan(90)
    expect(runs.every((r) => r.g.harvests >= 4)).toBe(true)
  })
})
