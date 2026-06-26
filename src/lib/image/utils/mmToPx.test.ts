import { describe, it, expect } from 'vitest'
import { mmToPx } from './mmToPx'

describe('mmToPx', () => {
  it('300dpiで25.4mmを300pxに変換する', () => {
    expect(mmToPx(25.4)).toBe(300)
  })

  it('300dpiで30mmを354pxに変換する', () => {
    // 30 / 25.4 * 300 = 354.33... → Math.round = 354
    expect(mmToPx(30)).toBe(354)
  })

  it('カスタムDPIを使用できる', () => {
    expect(mmToPx(25.4, 72)).toBe(72)
  })

  it('0mmは0pxを返す', () => {
    expect(mmToPx(0)).toBe(0)
  })
})
