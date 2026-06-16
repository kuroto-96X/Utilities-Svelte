import { describe, expect, test } from 'vitest'
import {
  calculateDetailed,
  generateCashFlows,
  type InvestmentRecord
} from './nisa-detailed-calculator'

describe('generateCashFlows', () => {
  test('次の投資記録の開始月は前の記録に含めない', () => {
    const records: InvestmentRecord[] = [
      { id: 'a', startMonth: '2022-01', frequency: 'monthly', amount: 10_000 },
      { id: 'b', startMonth: '2022-04', frequency: 'monthly', amount: 30_000 }
    ]

    const flows = generateCashFlows(records, new Date('2022-05-15T00:00:00'))

    expect(flows.map(flow => [flow.month, flow.amount])).toEqual([
      ['2022-01', 10_000],
      ['2022-02', 10_000],
      ['2022-03', 10_000],
      ['2022-04', 30_000],
      ['2022-05', 30_000]
    ])
  })

  test('毎年頻度は開始月と同じ月だけを年単位で追加する', () => {
    const records: InvestmentRecord[] = [
      { id: 'a', startMonth: '2020-06', frequency: 'yearly', amount: 120_000 }
    ]

    const flows = generateCashFlows(records, new Date('2023-08-20T00:00:00'))

    expect(flows.map(flow => flow.month)).toEqual(['2020-06', '2021-06', '2022-06', '2023-06'])
    expect(flows.every(flow => flow.amount === 120_000)).toBe(true)
  })
})

describe('calculateDetailed', () => {
  test('評価額が累計投資額と同程度なら年率は0%付近になる', () => {
    const result = calculateDetailed(
      [{ id: 'a', startMonth: '2022-01', frequency: 'monthly', amount: 10_000 }],
      300_000,
      6,
      new Date('2024-06-15T00:00:00')
    )

    if (!result || 'error' in result) throw new Error('Expected full result')
    expect(result.totalInvested).toBe(300_000)
    expect(result.annualReturn).toBeCloseTo(0, 1)
    expect(result.yearsInvested).toBeGreaterThan(2)
  })

  test('投資期間が短すぎる場合は専用エラーになる', () => {
    const result = calculateDetailed(
      [{ id: 'a', startMonth: '2024-06', frequency: 'monthly', amount: 10_000 }],
      10_000,
      6,
      new Date('2024-06-15T00:00:00')
    )

    expect(result).toEqual({ error: expect.stringContaining('短すぎる') })
  })

  test('累計投資額が1800万円以上ならNISA満額達成済みになる', () => {
    const result = calculateDetailed(
      [{ id: 'a', startMonth: '2020-01', frequency: 'monthly', amount: 500_000 }],
      25_000_000,
      6,
      new Date('2024-01-15T00:00:00')
    )

    if (!result || 'error' in result) throw new Error('Expected full result')
    expect(result.totalInvested).toBeGreaterThanOrEqual(18_000_000)
    expect(result.futures.nisaMax.reachedAlready).toBe(true)
    expect(result.futures.nisaMax.currentValue).toBe(25_000_000)
  })

  test('referenceRate at or below -100% uses 0% for finite reference projections', () => {
    const result = calculateDetailed(
      [{ id: 'a', startMonth: '2022-01', frequency: 'monthly', amount: 10_000 }],
      300_000,
      -101,
      new Date('2024-06-15T00:00:00')
    )

    if (!result || 'error' in result) throw new Error('Expected full result')
    expect(Number.isFinite(result.futures.years5.ref)).toBe(true)
    expect(Number.isFinite(result.futures.years10.ref)).toBe(true)
    expect(Number.isFinite(result.futures.years20.ref)).toBe(true)
    if (!result.futures.nisaMax.reachedAlready) {
      expect(Number.isFinite(result.futures.nisaMax.ref)).toBe(true)
    }
  })
})
