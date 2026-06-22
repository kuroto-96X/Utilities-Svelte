import { describe, expect, test } from 'vitest'
import { RHYTHM_PATTERNS, pickRhythmTemplate } from './melodyRhythms'

describe('RHYTHM_PATTERNS', () => {
  test('パターン数が19', () => {
    expect(RHYTHM_PATTERNS).toHaveLength(19)
  })

  test('全パターンのbeats合計が4になる', () => {
    for (const pat of RHYTHM_PATTERNS) {
      const sum = pat.beats.reduce((s, b) => s + b, 0)
      expect(sum).toBeCloseTo(4, 10)
    }
  })

  test('各パターンにid/label/notation/beatsがある', () => {
    for (const pat of RHYTHM_PATTERNS) {
      expect(typeof pat.id).toBe('string')
      expect(typeof pat.label).toBe('string')
      expect(typeof pat.notation).toBe('string')
      expect(pat.notation.length).toBeGreaterThan(0)
      expect(Array.isArray(pat.beats)).toBe(true)
      expect(pat.beats.length).toBeGreaterThan(0)
    }
  })
})

describe('pickRhythmTemplate', () => {
  const secPerBeat = 0.5 // 120bpm

  test('正の数のみを返す', () => {
    const durations = pickRhythmTemplate(1, secPerBeat)
    for (const d of durations) {
      expect(d).toBeGreaterThan(0)
    }
  })

  test('1小節: 合計秒数が4 * secPerBeat', () => {
    const durations = pickRhythmTemplate(1, secPerBeat)
    const total = durations.reduce((s, d) => s + d, 0)
    expect(total).toBeCloseTo(4 * secPerBeat, 10)
  })

  test('2小節: 合計秒数が2 * 4 * secPerBeat', () => {
    const durations = pickRhythmTemplate(2, secPerBeat)
    const total = durations.reduce((s, d) => s + d, 0)
    expect(total).toBeCloseTo(2 * 4 * secPerBeat, 10)
  })

  test('4小節: 合計秒数が4 * 4 * secPerBeat', () => {
    const durations = pickRhythmTemplate(4, secPerBeat)
    const total = durations.reduce((s, d) => s + d, 0)
    expect(total).toBeCloseTo(4 * 4 * secPerBeat, 10)
  })

  test('異なるBPMでも合計秒数が正しい', () => {
    const secPerBeat90 = 60 / 90
    const durations = pickRhythmTemplate(2, secPerBeat90)
    const total = durations.reduce((s, d) => s + d, 0)
    expect(total).toBeCloseTo(2 * 4 * secPerBeat90, 10)
  })
})
