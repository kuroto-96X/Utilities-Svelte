import { describe, test, expect } from 'vitest'
import { freqFromMidi } from './audioEngine'

describe('freqFromMidi', () => {
  test('MIDI 69 は 440 Hz (A4)', () => {
    expect(freqFromMidi(69)).toBeCloseTo(440, 5)
  })
  test('MIDI 81 は 880 Hz (A5 = 1オクターブ上)', () => {
    expect(freqFromMidi(81)).toBeCloseTo(880, 5)
  })
  test('MIDI 57 は 220 Hz (A3 = 1オクターブ下)', () => {
    expect(freqFromMidi(57)).toBeCloseTo(220, 5)
  })
  test('MIDI 60 は約 261.63 Hz (C4)', () => {
    expect(freqFromMidi(60)).toBeCloseTo(261.626, 2)
  })
})
