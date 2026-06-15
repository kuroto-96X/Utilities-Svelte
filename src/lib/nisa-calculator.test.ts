import { describe, expect, test } from 'vitest'
import { calcN, calcFutureValue, calculate } from './nisa-calculator'

describe('calcN', () => {
  test('毎月: 2022-01から2024-01は24期', () => {
    expect(calcN('2022-01', 'monthly', new Date('2024-01-15'))).toBe(24)
  })

  test('毎年: 2020-01から2024年は4期', () => {
    expect(calcN('2020-01', 'yearly', new Date('2024-06-15'))).toBe(4)
  })

  test('開始月=現在月は1に補正', () => {
    expect(calcN('2024-01', 'monthly', new Date('2024-01-15'))).toBe(1)
  })

  test('開始月が未来（N<0）でも1に補正', () => {
    expect(calcN('2024-12', 'monthly', new Date('2024-01-15'))).toBe(1)
  })
})

describe('calcFutureValue', () => {
  test('年率0%は元本+積立の単純合計', () => {
    const result = calcFutureValue(1_000_000, 50_000, 0, 5, 12)
    expect(result).toBeCloseTo(1_000_000 + 50_000 * 60, -2)
  })

  test('正の年率で将来価値は元本+単純積立を上回る', () => {
    const noGrowth = 1_000_000 + 50_000 * 120
    const withGrowth = calcFutureValue(1_000_000, 50_000, 0.05, 10, 12)
    expect(withGrowth).toBeGreaterThan(noGrowth)
  })

  test('年率0%と微小年率で近似値が一致する', () => {
    const zeroRate = calcFutureValue(100_000, 10_000, 0, 3, 12)
    const tinyRate = calcFutureValue(100_000, 10_000, 1e-12, 3, 12)
    expect(zeroRate).toBeCloseTo(tinyRate, 0)
  })
})

describe('calculate', () => {
  test('startMonthが空の場合はnull', () => {
    expect(calculate('', 'monthly', 1_500_000, 10, 6)).toBeNull()
  })

  test('currentValueがNaNの場合はnull', () => {
    expect(calculate('2022-01', 'monthly', NaN, 10, 6)).toBeNull()
  })

  test('profitRateがNaNの場合はnull', () => {
    expect(calculate('2022-01', 'monthly', 1_500_000, NaN, 6)).toBeNull()
  })

  test('損益率-100%はerrorオブジェクト', () => {
    const result = calculate('2022-01', 'monthly', 500_000, -100, 6)
    expect(result).toEqual({ error: expect.stringContaining('確認') })
  })

  test('損益率-100%未満もerrorオブジェクト', () => {
    const result = calculate('2022-01', 'monthly', 100_000, -150, 6)
    expect(result).toEqual({ error: expect.stringContaining('確認') })
  })

  test('正常入力で年率・期間・累計投資額を返す', () => {
    const result = calculate('2022-01', 'monthly', 1_500_000, 15, 6)
    if (!result || 'error' in result) throw new Error('Expected full result')
    expect(result.annualReturn).toBeGreaterThan(0)
    expect(result.yearsInvested).toBeGreaterThan(0)
    expect(result.totalInvested).toBeCloseTo(1_500_000 / 1.15, 0)
    expect(result.perPeriodAmount).toBeGreaterThan(0)
  })

  test('futuresオブジェクトに5/10/20年後のデータがある', () => {
    const result = calculate('2022-01', 'monthly', 1_500_000, 15, 6)
    if (!result || 'error' in result) throw new Error('Expected full result')
    expect(result.futures.years5.own).toBeGreaterThan(0)
    expect(result.futures.years10.own).toBeGreaterThan(0)
    expect(result.futures.years20.own).toBeGreaterThan(0)
  })

  test('累計投資額が1800万円超で満額達成済み', () => {
    const result = calculate('2000-01', 'monthly', 25_000_000, 30, 6)
    if (!result || 'error' in result) throw new Error('Expected full result')
    expect(result.futures.nisaMax.reachedAlready).toBe(true)
    expect(result.futures.nisaMax.currentValue).toBe(25_000_000)
  })

  test('累計投資額が1800万円未満で満額到達時を計算', () => {
    const result = calculate('2022-01', 'monthly', 1_500_000, 15, 6)
    if (!result || 'error' in result) throw new Error('Expected full result')
    expect(result.futures.nisaMax.reachedAlready).toBe(false)
    expect(result.futures.nisaMax.yearsToMax).toBeGreaterThan(0)
    expect(result.futures.nisaMax.own).toBeGreaterThan(0)
    expect(result.futures.nisaMax.ref).toBeGreaterThan(0)
  })

  test('50年超の満額到達はveryLong=true', () => {
    // 少額投資のため満額まで数百年かかる → veryLong=true になるはず
    const result = calculate('2024-01', 'monthly', 100_000, 1, 6)
    if (!result || 'error' in result) throw new Error('Expected full result')
    expect(result.futures.nisaMax.reachedAlready).toBe(false)
    expect(result.futures.nisaMax.yearsToMax).toBeGreaterThan(50)
    expect(result.futures.nisaMax.veryLong).toBe(true)
  })
})
