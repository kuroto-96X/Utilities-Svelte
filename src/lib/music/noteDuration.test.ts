import { describe, expect, test } from 'vitest'
import {
  clampBpm, calculateNoteDurations, formatSec, formatMs,
  findNearestNotes,
  MIN_BPM, MAX_BPM, DEFAULT_BPM,
} from './noteDuration'

describe('clampBpm', () => {
  test('NaNはDEFAULT_BPMを返す', () => {
    expect(clampBpm(NaN)).toBe(DEFAULT_BPM)
  })

  test('0はMIN_BPMを返す', () => {
    expect(clampBpm(0)).toBe(MIN_BPM)
  })

  test('負の値はMIN_BPMを返す', () => {
    expect(clampBpm(-10)).toBe(MIN_BPM)
  })

  test('MAX_BPM超はMAX_BPMを返す', () => {
    expect(clampBpm(500)).toBe(MAX_BPM)
  })

  test('範囲内はそのまま返す', () => {
    expect(clampBpm(120)).toBe(120)
    expect(clampBpm(MIN_BPM)).toBe(MIN_BPM)
    expect(clampBpm(MAX_BPM)).toBe(MAX_BPM)
  })
})

describe('calculateNoteDurations (BPM=120)', () => {
  const durations = calculateNoteDurations(120)
  const whole        = durations.find(d => d.id === 'whole')!
  const quarter      = durations.find(d => d.id === 'quarter')!
  const eighth       = durations.find(d => d.id === 'eighth')!
  const thirtysecond = durations.find(d => d.id === 'thirtysecond')!

  test('7種類の音符を返す', () => {
    expect(durations).toHaveLength(7)
    const ids = durations.map(d => d.id)
    expect(ids).toEqual(['whole','half','quarter','eighth','sixteenth','thirtysecond','sixtyfourth'])
  })

  test('4分音符 normalSec = 0.5 (BPM=120)', () => {
    expect(quarter.normalSec).toBeCloseTo(0.5, 10)
  })

  test('全音符は4分音符の4倍', () => {
    expect(whole.normalSec).toBeCloseTo(2.0, 10)
  })

  test('8分音符は4分音符の1/2', () => {
    expect(eighth.normalSec).toBeCloseTo(0.25, 10)
  })

  test('32分音符は4分音符の1/8', () => {
    expect(thirtysecond.normalSec).toBeCloseTo(0.0625, 10)
  })

  test('付点は通常の1.5倍', () => {
    expect(quarter.dottedSec).toBeCloseTo(0.75, 10)
  })

  test('3連符は通常の2/3', () => {
    expect(quarter.tripletSec).toBeCloseTo(1 / 3, 10)
  })

  test('BPM=0はDEFAULT_BPMにフォールバック', () => {
    const fallback = calculateNoteDurations(0)
    const def      = calculateNoteDurations(DEFAULT_BPM)
    expect(fallback[2].normalSec).toBeCloseTo(def[2].normalSec, 10)
  })

  test('全音符 symbol: filled=false, stem=false, flags=0', () => {
    expect(whole.symbol).toEqual({ filled: false, stem: false, flags: 0 })
  })

  test('32分音符 symbol: filled=true, stem=true, flags=3', () => {
    expect(thirtysecond.symbol).toEqual({ filled: true, stem: true, flags: 3 })
  })

  test('label と fraction が正しい', () => {
    expect(quarter.label).toBe('4分音符')
    expect(quarter.fraction).toBe('1/4')
    expect(whole.label).toBe('全音符')
    expect(whole.fraction).toBe('1/1')
  })
})

describe('formatSec', () => {
  test('3桁固定小数を返す', () => {
    expect(formatSec(0.5)).toBe('0.500')
    expect(formatSec(2)).toBe('2.000')
    expect(formatSec(0.0625)).toBe('0.063')
  })
})

describe('formatMs', () => {
  test('ミリ秒換算で1桁固定小数を返す', () => {
    expect(formatMs(0.5)).toBe('500.0')
    expect(formatMs(2)).toBe('2000.0')
    expect(formatMs(0.25)).toBe('250.0')
  })
})

describe('findNearestNotes', () => {
  test('targetMs <= 0 は空配列を返す', () => {
    expect(findNearestNotes(0,  { mode: 'topN' })).toEqual([])
    expect(findNearestNotes(-1, { mode: 'topN' })).toEqual([])
  })

  test('BPM 120 で 500ms を検索すると topN 1 件目は 4分音符（通常）になる', () => {
    const results = findNearestNotes(500, { mode: 'topN', topN: 1, bpmMin: 120, bpmMax: 120 })
    expect(results).toHaveLength(1)
    expect(results[0].bpm).toBe(120)
    expect(results[0].noteId).toBe('quarter')
    expect(results[0].variant).toBe('normal')
    expect(results[0].durationMs).toBeCloseTo(500, 5)
    expect(results[0].diffMs).toBeCloseTo(0, 5)
  })

  test('BPM 120 で 750ms を検索すると付点4分音符が最上位になる（includeDotted: true）', () => {
    const results = findNearestNotes(750, {
      mode: 'topN', topN: 1, bpmMin: 120, bpmMax: 120, includeDotted: true,
    })
    expect(results[0].noteId).toBe('quarter')
    expect(results[0].variant).toBe('dotted')
    expect(results[0].durationMs).toBeCloseTo(750, 5)
  })

  test('includeDotted: false では付点が含まれない', () => {
    const results = findNearestNotes(750, {
      mode: 'topN', topN: 50, bpmMin: 120, bpmMax: 120, includeDotted: false,
    })
    expect(results.every(r => r.variant !== 'dotted')).toBe(true)
  })

  test('includeTriplet: true では3連符が含まれる', () => {
    const results = findNearestNotes(333.33, {
      mode: 'topN', topN: 1, bpmMin: 120, bpmMax: 120, includeTriplet: true, includeDotted: false,
    })
    expect(results[0].variant).toBe('triplet')
    expect(results[0].noteId).toBe('quarter')
  })

  test('mode=tolerance では diffPct が閾値以内の結果だけ返す', () => {
    const results = findNearestNotes(500, {
      mode: 'tolerance', tolerancePct: 1, bpmMin: 20, bpmMax: 300,
    })
    expect(results.every(r => r.diffPct <= 1)).toBe(true)
    expect(results.length).toBeGreaterThan(0)
  })

  test('mode=topN でデフォルト 10 件を返す', () => {
    const results = findNearestNotes(500, { mode: 'topN' })
    expect(results.length).toBeLessThanOrEqual(10)
    expect(results.length).toBeGreaterThan(0)
  })

  test('結果は diffMs 昇順に並んでいる', () => {
    const results = findNearestNotes(500, { mode: 'topN', topN: 20 })
    for (let i = 1; i < results.length; i++) {
      expect(results[i].diffMs).toBeGreaterThanOrEqual(results[i - 1].diffMs)
    }
  })

  test('label に付点プレフィクスが付く', () => {
    const results = findNearestNotes(750, {
      mode: 'topN', topN: 1, bpmMin: 120, bpmMax: 120, includeDotted: true,
    })
    expect(results[0].label).toBe('付点4分音符')
  })

  test('label に3連符サフィクスが付く', () => {
    const results = findNearestNotes(333.33, {
      mode: 'topN', topN: 1, bpmMin: 120, bpmMax: 120, includeTriplet: true, includeDotted: false,
    })
    expect(results[0].label).toBe('4分音符（3連符）')
  })
})
