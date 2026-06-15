import { describe, expect, test } from 'vitest'
import { simulate } from './nisa-accumulation-simulator'

describe('simulate', () => {
  test('年利0%・毎月積立は評価額=累計投資額（線形）', () => {
    const r = simulate(10_000, 12, 0, 'monthly')
    expect(r.finalValue).toBeCloseTo(10_000 * 12 * 12, 0)
    expect(r.totalInvested).toBe(10_000 * 12 * 12)
    expect(r.profit).toBeCloseTo(0, 0)
    expect(r.profitRate).toBeCloseTo(0, 5)
  })

  test('年利5%・毎月30年では評価額が累計投資額を大きく上回る', () => {
    const r = simulate(30_000, 30, 5, 'monthly')
    expect(r.finalValue).toBeGreaterThan(r.totalInvested * 1.5)
    expect(r.profit).toBeGreaterThan(0)
    expect(r.profitRate).toBeGreaterThan(0)
  })

  test('年利0%・毎年積立は評価額=累計投資額（線形）', () => {
    const r = simulate(100_000, 10, 0, 'yearly')
    expect(r.finalValue).toBeCloseTo(100_000 * 10, 0)
    expect(r.totalInvested).toBe(100_000 * 10)
  })

  test('年利5%・毎年積立は年利5%・毎月積立より評価額が低い', () => {
    const monthly = simulate(10_000, 20, 5, 'monthly')
    const yearly = simulate(10_000 * 12, 20, 5, 'yearly')
    // 同じ総積立だが毎月の方が複利が多くかかる
    expect(monthly.finalValue).toBeGreaterThan(yearly.finalValue)
  })

  test('投資額0は全結果がゼロ', () => {
    const r = simulate(0, 20, 5, 'monthly')
    expect(r.finalValue).toBe(0)
    expect(r.totalInvested).toBe(0)
    expect(r.profit).toBe(0)
    expect(r.profitRate).toBe(0)
  })

  test('投資期間0年はfinalValueが0', () => {
    const r = simulate(30_000, 0, 5, 'monthly')
    expect(r.finalValue).toBe(0)
    expect(r.totalInvested).toBe(0)
  })

  test('chartDataのlengthはyears+1（y=0を含む）', () => {
    const r = simulate(30_000, 20, 5, 'monthly')
    expect(r.chartData).toHaveLength(21) // 0〜20
  })

  test('chartData[0]はすべて0', () => {
    const r = simulate(30_000, 20, 5, 'monthly')
    expect(r.chartData[0]).toEqual({ year: 0, invested: 0, value: 0 })
  })

  test('chartDataは年が増えるにつれてvalueが単調増加（年利>0時）', () => {
    const r = simulate(30_000, 10, 5, 'monthly')
    for (let i = 1; i < r.chartData.length; i++) {
      expect(r.chartData[i].value).toBeGreaterThanOrEqual(r.chartData[i - 1].value)
    }
  })

  test('年利0%時のchartDataはvalueとinvestedが一致', () => {
    const r = simulate(10_000, 5, 0, 'monthly')
    for (const point of r.chartData) {
      expect(point.value).toBeCloseTo(point.invested, 0)
    }
  })

  test('chartDataの最後のvalueはfinalValueと一致', () => {
    const r = simulate(30_000, 20, 5, 'monthly')
    const last = r.chartData[r.chartData.length - 1]
    expect(last.value).toBeCloseTo(r.finalValue, 0)
    expect(last.invested).toBe(r.totalInvested)
  })

  test('cumulative investedが0の時profitRateは0（0除算なし）', () => {
    const r = simulate(0, 20, 5, 'monthly')
    expect(r.profitRate).toBe(0)
  })
})
