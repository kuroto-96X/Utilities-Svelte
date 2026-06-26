import { describe, test, expect } from 'vitest'
import { buildKeyboardWindow, WHITE_W, WHITE_H, BLACK_W, BLACK_H, TOTAL_WIDTH } from './pianoLayout'

describe('buildKeyboardWindow(0) — C基準', () => {
  const { whiteKeys, blackKeys } = buildKeyboardWindow(0)

  test('白鍵7個・黒鍵5個', () => {
    expect(whiteKeys).toHaveLength(7)
    expect(blackKeys).toHaveLength(5)
  })

  test('白鍵のpcが C,D,E,F,G,A,B の順', () => {
    expect(whiteKeys.map(k => k.pc)).toEqual([0,2,4,5,7,9,11])
  })

  test('黒鍵のpcが C#,D#,F#,G#,A# の順', () => {
    expect(blackKeys.map(k => k.pc)).toEqual([1,3,6,8,10])
  })

  test('白鍵のx座標が0から始まりWHITE_W刻みで増える', () => {
    whiteKeys.forEach((k, i) => expect(k.x).toBe(i * WHITE_W))
  })

  test('最後の白鍵右端がTOTAL_WIDTH', () => {
    const last = whiteKeys[whiteKeys.length - 1]
    expect(last.x + WHITE_W).toBe(TOTAL_WIDTH)
  })

  test('windowIndexが0〜11で全12音を網羅', () => {
    const all = [...whiteKeys, ...blackKeys].sort((a, b) => a.windowIndex - b.windowIndex)
    expect(all.map(k => k.windowIndex)).toEqual([0,1,2,3,4,5,6,7,8,9,10,11])
  })
})

describe('buildKeyboardWindow(2) — D基準', () => {
  const { whiteKeys, blackKeys } = buildKeyboardWindow(2)

  test('白鍵7個・黒鍵5個（Dから始まっても変わらない）', () => {
    expect(whiteKeys).toHaveLength(7)
    expect(blackKeys).toHaveLength(5)
  })

  test('先頭白鍵のpcはD(2)', () => {
    const sorted = whiteKeys.sort((a, b) => a.windowIndex - b.windowIndex)
    expect(sorted[0].pc).toBe(2)
  })

  test('白鍵のx座標は0から始まる', () => {
    const minX = Math.min(...whiteKeys.map(k => k.x))
    expect(minX).toBe(0)
  })
})

describe('定数', () => {
  test('TOTAL_WIDTH = 7 * WHITE_W', () => {
    expect(TOTAL_WIDTH).toBe(7 * WHITE_W)
  })
  test('WHITE_H, BLACK_H が正の数', () => {
    expect(WHITE_H).toBeGreaterThan(0)
    expect(BLACK_H).toBeGreaterThan(0)
    expect(BLACK_H).toBeLessThan(WHITE_H)
  })
})
