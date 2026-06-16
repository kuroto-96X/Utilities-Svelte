import { describe, test, expect } from 'vitest'
import { buildDiatonicChords } from './diatonicChords'

describe('buildDiatonicChords', () => {
  test('7音以外はnullを返す（ペンタトニック）', () => {
    expect(buildDiatonicChords([0,2,4,7,9], 0)).toBeNull()
  })

  test('7音以外はnullを返す（ブルース6音）', () => {
    expect(buildDiatonicChords([0,3,5,6,7,10], 0)).toBeNull()
  })

  test('Cメジャー: I, ii, iii, IV, V, vi, vii°', () => {
    const chords = buildDiatonicChords([0,2,4,5,7,9,11], 0)!
    expect(chords).toHaveLength(7)
    expect(chords.map(c => c.roman)).toEqual(['I','ii','iii','IV','V','vi','vii°'])
  })

  test('Cメジャー: 各コードの quality', () => {
    const chords = buildDiatonicChords([0,2,4,5,7,9,11], 0)!
    expect(chords[0].quality).toBe('maj')
    expect(chords[1].quality).toBe('min')
    expect(chords[6].quality).toBe('dim')
  })

  test('Cメジャー: 各コードのrootPc', () => {
    const chords = buildDiatonicChords([0,2,4,5,7,9,11], 0)!
    expect(chords.map(c => c.rootPc)).toEqual([0,2,4,5,7,9,11])
  })

  test('Aナチュラルマイナー (rootPc=9): i, ii°, III, iv, v, VI, VII', () => {
    const chords = buildDiatonicChords([0,2,3,5,7,8,10], 9)!
    expect(chords.map(c => c.roman)).toEqual(['i','ii°','III','iv','v','VI','VII'])
  })

  test('ハーモニックマイナーでaugが出る', () => {
    // harmonic minor [0,2,3,5,7,8,11] — III度はaugmented
    const chords = buildDiatonicChords([0,2,3,5,7,8,11], 0)!
    expect(chords[2].roman).toBe('III+')
    expect(chords[2].quality).toBe('aug')
  })

  test('各コードのintervalsは3要素', () => {
    const chords = buildDiatonicChords([0,2,4,5,7,9,11], 0)!
    chords.forEach(c => expect(c.intervals).toHaveLength(3))
  })
})
