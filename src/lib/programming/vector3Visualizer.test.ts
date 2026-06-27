import { describe, it, expect } from 'vitest'
import { fmt, fv, getDotInterpretation } from './vector3Visualizer'

describe('fmt', () => {
  it('デフォルト3桁で丸める', () => expect(fmt(1.23456)).toBe(1.235))
  it('指定桁数で丸める', () => expect(fmt(1.23456, 2)).toBe(1.23))
  it('整数はそのまま返す', () => expect(fmt(5)).toBe(5))
  it('負の値を丸める', () => expect(fmt(-1.23456)).toBe(-1.235))
})

describe('fv', () => {
  it('(x, y, z) 形式の文字列を返す', () => expect(fv(1, 2, 3)).toBe('(1, 2, 3)'))
  it('小数を3桁に丸める', () => expect(fv(1.1234, 2.5678, 3.9999)).toBe('(1.123, 2.568, 4)'))
  it('桁数を指定できる', () => expect(fv(1.5, 2.5, 3.5, 1)).toBe('(1.5, 2.5, 3.5)'))
})

describe('getDotInterpretation', () => {
  it('cosA > 0.99 → ほぼ同じ向き', () => expect(getDotInterpretation(1.0)).toBe('ほぼ同じ向き'))
  it('cosA = 0.995 → ほぼ同じ向き', () => expect(getDotInterpretation(0.995)).toBe('ほぼ同じ向き'))
  it('cosA = 0.7 → 鋭角（同方向寄り）', () => expect(getDotInterpretation(0.7)).toBe('鋭角（同方向寄り）'))
  it('cosA = 0.5 → 鋭角（同方向寄り）', () => expect(getDotInterpretation(0.501)).toBe('鋭角（同方向寄り）'))
  it('cosA = 0 → ほぼ直角', () => expect(getDotInterpretation(0.0)).toBe('ほぼ直角'))
  it('cosA = -0.005 → ほぼ直角', () => expect(getDotInterpretation(-0.005)).toBe('ほぼ直角'))
  it('cosA = -0.3 → 鈍角（逆方向寄り）', () => expect(getDotInterpretation(-0.3)).toBe('鈍角（逆方向寄り）'))
  it('cosA = -0.5 → 鈍角（逆方向寄り）', () => expect(getDotInterpretation(-0.499)).toBe('鈍角（逆方向寄り）'))
  it('cosA = -0.8 → ほぼ逆向き', () => expect(getDotInterpretation(-0.8)).toBe('ほぼ逆向き'))
  it('cosA = -0.5 境界 → ほぼ逆向き', () => expect(getDotInterpretation(-0.5)).toBe('ほぼ逆向き'))
})
