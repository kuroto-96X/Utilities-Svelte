import { describe, it, expect } from 'vitest'
import {
  clamp, toHex2, fStr, parseHex,
  formatColor32, formatColorFloat, formatHex8, formatHex6, formatRgba
} from './colorConverter'

describe('clamp', () => {
  it('範囲内の値はそのまま返す', () => expect(clamp(128, 0, 255)).toBe(128))
  it('最小値でクランプする', () => expect(clamp(-1, 0, 255)).toBe(0))
  it('最大値でクランプする', () => expect(clamp(256, 0, 255)).toBe(255))
})

describe('toHex2', () => {
  it('0 → "00"', () => expect(toHex2(0)).toBe('00'))
  it('255 → "FF"', () => expect(toHex2(255)).toBe('FF'))
  it('128 → "80"', () => expect(toHex2(128)).toBe('80'))
  it('小数は四捨五入してから変換する', () => expect(toHex2(127.6)).toBe('80'))
})

describe('fStr', () => {
  it('0 → "0.000f"', () => expect(fStr(0)).toBe('0.000f'))
  it('255 → "1.000f"', () => expect(fStr(255)).toBe('1.000f'))
  it('128 → "0.502f"', () => expect(fStr(128)).toBe('0.502f'))
})

describe('parseHex', () => {
  it('8桁（#付き）をパースする', () =>
    expect(parseHex('#FF8000C8')).toEqual({ r: 255, g: 128, b: 0, a: 200 }))
  it('6桁（#付き）は a=255 を補完する', () =>
    expect(parseHex('#FF8000')).toEqual({ r: 255, g: 128, b: 0, a: 255 }))
  it('#なしでもパースする', () =>
    expect(parseHex('FF8000FF')).toEqual({ r: 255, g: 128, b: 0, a: 255 }))
  it('5桁は null を返す', () => expect(parseHex('#FF800')).toBeNull())
  it('9桁以上は null を返す', () => expect(parseHex('#FF8000120')).toBeNull())
  it('不正な16進文字は null を返す', () => expect(parseHex('#GGGGGGGG')).toBeNull())
})

describe('formatColor32', () => {
  it('正しくフォーマットする', () =>
    expect(formatColor32(255, 128, 0, 255)).toBe('new Color32(255, 128, 0, 255)'))
})

describe('formatColorFloat', () => {
  it('正しくフォーマットする', () =>
    expect(formatColorFloat(255, 128, 0, 255)).toBe('new Color(1.000f, 0.502f, 0.000f, 1.000f)'))
})

describe('formatHex8', () => {
  it('正しくフォーマットする', () =>
    expect(formatHex8(255, 128, 0, 255)).toBe('#FF8000FF'))
  it('アルファ付きも正しい', () =>
    expect(formatHex8(255, 128, 0, 200)).toBe('#FF8000C8'))
})

describe('formatHex6', () => {
  it('正しくフォーマットする', () =>
    expect(formatHex6(255, 128, 0)).toBe('#FF8000'))
})

describe('formatRgba', () => {
  it('alpha=255 のとき 1.00', () =>
    expect(formatRgba(255, 128, 0, 255)).toBe('rgba(255, 128, 0, 1.00)'))
  it('alpha=128 のとき 0.50', () =>
    expect(formatRgba(255, 128, 0, 128)).toBe('rgba(255, 128, 0, 0.50)'))
})
