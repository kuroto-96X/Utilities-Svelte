import { describe, expect, test } from 'vitest'
import {
  clampBpm, calculateNoteDurations, formatSec, formatMs,
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
