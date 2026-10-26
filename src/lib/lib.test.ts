import { describe, expect, it } from 'vitest'
import { haversine } from './geo'
import { computeCoverage } from './gaps'
import { computeTotals, thresholdStatus } from './totals'
import { csvCell, toCsv } from './csv'
import * as demo from '../demo/seed'
import type { Assessment, Structure } from '../db/types'

describe('haversine', () => {
  it('matches a known distance (1 degree of latitude ≈ 111.2 km)', () => {
    expect(haversine({ lat: 35, lng: -106 }, { lat: 36, lng: -106 }) / 1000).toBeCloseTo(111.19, 1)
  })
})

describe('demo seed', () => {
  it('reads like real records: unique names and descriptions, rounded varied costs', () => {
    expect(new Set(demo.structures.map((s) => s.name)).size).toBe(demo.structures.length)
    const dmg = demo.assessments.filter((a) => a.outcome === 'damaged')
    expect(new Set(dmg.map((a) => a.description)).size).toBe(dmg.length)
    for (const a of dmg) for (const c of [a.cost_low!, a.cost_likely!, a.cost_high!]) expect(c % 500).toBe(0)
    expect(new Set(dmg.map((a) => (a.cost_high! / a.cost_likely!).toFixed(2))).size).toBeGreaterThan(4)
  })
  it('has 3 acequias, 40 structures, 8 damaged / 20 no damage / 12 blank', () => {
    expect(demo.acequias).toHaveLength(3)
    expect(demo.structures).toHaveLength(40)
    const by = (o: string) => demo.assessments.filter((a) => a.outcome === o).length
    expect([by('damaged'), by('no_damage'), demo.structures.length - demo.assessments.length]).toEqual([8, 20, 12])
    expect(demo.photos).toHaveLength(8)
  })
  it('respects the database invariants', () => {
    for (const a of demo.assessments) {
      if (a.outcome === 'damaged') {
        expect(a.cost_low! <= a.cost_likely! && a.cost_likely! <= a.cost_high!).toBe(true)
        expect(a.photo_ids.length).toBeGreaterThan(0)
        expect(a.severity).not.toBeNull()
      }
    }
  })
})

describe('gap detection', () => {
  const cov = computeCoverage(demo.structures, demo.assessments, demo.event)

  it('flags exactly the 12 unassessed structures', () => {
    expect(cov.gaps).toHaveLength(12)
    const assessed = new Set(demo.assessments.map((a) => a.structure_id))
    expect(cov.gaps.every((g) => !assessed.has(g.structure.id))).toBe(true)
    expect(cov.coverage).toBeCloseTo(28 / 40)
  })

  it('sorts gaps closest to damage first', () => {
    const d = cov.gaps.map((g) => g.distance_m!)
    expect(d).toEqual([...d].sort((a, b) => a - b))
  })

  it('reports the priority hit rate on synthetic data (logged, not asserted)', () => {
    const top6 = new Set(cov.gaps.slice(0, 6).map((g) => g.structure.id))
    const hits = demo.hiddenDamagedGaps.filter((id) => top6.has(id)).length
    console.log(`GAP-PRIORITY synthetic hit rate: ${hits} of ${demo.hiddenDamagedGaps.length} hidden-damaged gaps in top 6 of ${cov.gaps.length}`)
    expect(hits).toBeGreaterThanOrEqual(0)
  })

  it('excludes structures added after the event and retired ones', () => {
    const s0 = demo.structures[0]
    const later: Structure = { ...s0, id: 'later', created_at: '2026-07-01T00:00:00Z' }
    const retired: Structure = { ...s0, id: 'retired', retired_at: '2026-01-01T00:00:00Z' }
    const c = computeCoverage([...demo.structures, later, retired], demo.assessments, demo.event)
    expect(c.baseline).toHaveLength(40)
    expect(c.addedAfter.map((s) => s.id)).toEqual(['later'])
  })

  it('has no priority when nothing is damaged', () => {
    const c = computeCoverage(demo.structures, [], demo.event)
    expect(c.gaps.every((g) => g.distance_m === null)).toBe(true)
  })
})

describe('totals', () => {
  it('sum only damaged rows and match an independent recompute', () => {
    const t = computeTotals(demo.assessments)
    console.log(`DEMO TOTALS (synthetic): low $${t.cost_low} / likely $${t.cost_likely} / high $${t.cost_high}, ${t.damaged} damaged`)
    const dmg = demo.assessments.filter((a) => a.outcome === 'damaged')
    let lo = 0, li = 0, hi = 0
    for (const a of dmg) { lo += a.cost_low!; li += a.cost_likely!; hi += a.cost_high! }
    expect([t.cost_low, t.cost_likely, t.cost_high]).toEqual([lo, li, hi])
    expect(t.damaged).toBe(8)
    console.log(`TOTALS demo: low ${lo} likely ${li} high ${hi}`)
  })
  it('ignores stray costs on non-damaged rows', () => {
    const a = { ...demo.assessments.find((x) => x.outcome === 'no_damage')!, cost_low: 5, cost_likely: 5, cost_high: 5 } as Assessment
    expect(computeTotals([a]).cost_likely).toBe(0)
  })
  it('threshold progress uses the likely total and reports whether low clears', () => {
    const t = { ...computeTotals([]), cost_low: 80, cost_likely: 120, cost_high: 200 }
    expect(thresholdStatus(t, 100)).toEqual({ progress: 1.2, likelyClears: true, lowClears: false })
    expect(thresholdStatus(t, null)).toBeNull()
  })
})

describe('csv', () => {
  it('defuses formulas and quotes', () => {
    expect(csvCell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`)
    expect(csvCell('+1')).toBe("'+1")
    expect(csvCell('-2')).toBe("'-2")
    expect(csvCell('@sum')).toBe("'@sum")
    expect(csvCell('a,b')).toBe('"a,b"')
    expect(toCsv(['a'], [[1]])).toBe('a\r\n1\r\n')
  })
})
