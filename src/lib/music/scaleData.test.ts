// src/lib/scaleData.test.ts
import { describe, test, expect } from 'vitest'
import {
  ROOTS,
  SCALE_GROUPS,
  SCALES,
  CHORD_GROUPS,
  CHORDS,
  PROGRESSIONS,
  CHROMATIC_PROGRESSIONS,
  TENSION_PROGRESSIONS,
  resolveProgressionVoicing,
} from './scaleData'

describe('ROOTS', () => {
  test('12個のルート音がある', () => {
    expect(ROOTS).toHaveLength(12)
  })
  test('pcが0から11まで過不足なく存在する', () => {
    const pcs = ROOTS.map(r => r.pc).sort((a, b) => a - b)
    expect(pcs).toEqual([0,1,2,3,4,5,6,7,8,9,10,11])
  })
})

describe('SCALE_GROUPS / SCALES', () => {
  test('グループが3つある（基本・モード・和風その他）', () => {
    expect(SCALE_GROUPS).toHaveLength(3)
  })
  test('スケールが合計15種', () => {
    expect(SCALES).toHaveLength(15)
  })
  test('全スケールのintervalsは0から始まる', () => {
    SCALES.forEach(s => expect(s.intervals[0]).toBe(0))
  })
  test('major は [0,2,4,5,7,9,11]', () => {
    const major = SCALES.find(s => s.id === 'major')!
    expect(major.intervals).toEqual([0,2,4,5,7,9,11])
  })
})

describe('CHORD_GROUPS / CHORDS', () => {
  test('グループが3つある（トライアド・セブンス・テンション）', () => {
    expect(CHORD_GROUPS).toHaveLength(3)
  })
  test('コードが合計13種', () => {
    expect(CHORDS).toHaveLength(13)
  })
  test('全コードのintervalsは0から始まる', () => {
    CHORDS.forEach(c => expect(c.intervals[0]).toBe(0))
  })
})

describe('PROGRESSIONS', () => {
  test('11種類のプリセットがある', () => {
    expect(PROGRESSIONS).toHaveLength(11)
  })
  test('全degreesは0〜6の範囲', () => {
    PROGRESSIONS.forEach(p => {
      p.degrees.forEach(d => {
        expect(d).toBeGreaterThanOrEqual(0)
        expect(d).toBeLessThanOrEqual(6)
      })
    })
  })
})

describe('resolveProgressionVoicing', () => {
  test('smooth on ignores common inversion when no preset is given', () => {
    expect(resolveProgressionVoicing([0, 4, 7], null, true, 2)).toEqual([0, 4, 7])
  })

  test('smooth on applies preset octave offsets to each chord tone', () => {
    expect(resolveProgressionVoicing([0, 4, 7], [12, 0, 0], true, 0)).toEqual([12, 4, 7])
  })

  test('smooth off applies common inversion', () => {
    expect(resolveProgressionVoicing([0, 4, 7], null, false, 1)).toEqual([4, 7, 12])
  })

  test('does not mutate input arrays', () => {
    const intervals = [0, 4, 7]
    const smooth = [12, 0, 0]
    resolveProgressionVoicing(intervals, smooth, true, 0)
    expect(intervals).toEqual([0, 4, 7])
    expect(smooth).toEqual([12, 0, 0])
  })
})

describe('smoothVoicings', () => {
  test('全プリセットで進行とボイシングのステップ数が一致する', () => {
    PROGRESSIONS.forEach(p => expect(p.smoothVoicings).toHaveLength(p.degrees.length))
    ;[...CHROMATIC_PROGRESSIONS, ...TENSION_PROGRESSIONS].forEach(p => {
      expect(p.smoothVoicings).toHaveLength(p.steps.length)
    })
  })

  test.each([
    ['basicLoop', [60, 65, 64, 62]],
    ['fifties', [60, 64, 65, 62]],
    ['jazzCircle', [60, 64, 65, 62]],
  ])('%sはループ境界を含め最大5半音以内で動く', (id, expectedBass) => {
    const majorRoots = [0, 2, 4, 5, 7, 9, 11]
    const majorIntervals = [
      [0, 4, 7], [0, 3, 7], [0, 3, 7], [0, 4, 7],
      [0, 4, 7], [0, 3, 7], [0, 3, 6],
    ]
    const progression = PROGRESSIONS.find(p => p.id === id)!
    const bass = progression.degrees.map((degree, i) => {
      const rootMidi = 60 + majorRoots[degree]
      const voiced = resolveProgressionVoicing(
        majorIntervals[degree],
        progression.smoothVoicings[i],
        true,
        0,
      )
      return Math.min(...voiced.map(interval => rootMidi + interval))
    })
    const looped = [...bass, bass[0]]
    const maxMove = Math.max(...looped.slice(1).map((midi, i) => Math.abs(midi - looped[i])))

    expect(bass).toEqual(expectedBass)
    expect(maxMove).toBeLessThanOrEqual(5)
  })
})
