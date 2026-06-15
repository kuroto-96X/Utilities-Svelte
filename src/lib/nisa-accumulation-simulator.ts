export type Frequency = 'monthly' | 'yearly'

export type ChartPoint = { year: number; invested: number; value: number }

export type SimResult = {
  finalValue: number
  totalInvested: number
  profit: number
  profitRate: number
  chartData: ChartPoint[]
}

export function simulate(
  amount: number,
  years: number,
  annualRate: number,
  frequency: Frequency
): SimResult {
  const periodsPerYear = frequency === 'monthly' ? 12 : 1
  const rPeriod = Math.pow(1 + annualRate / 100, 1 / periodsPerYear) - 1

  function fv(numPeriods: number): number {
    if (numPeriods === 0) return 0
    if (Math.abs(rPeriod) < 1e-9) return amount * numPeriods
    return amount * (Math.pow(1 + rPeriod, numPeriods) - 1) / rPeriod
  }

  const n = years * periodsPerYear
  const finalValue = fv(n)
  const totalInvested = amount * n
  const profit = finalValue - totalInvested
  const profitRate = totalInvested > 0 ? (profit / totalInvested) * 100 : 0

  const chartData: ChartPoint[] = []
  for (let y = 0; y <= years; y++) {
    const np = y * periodsPerYear
    chartData.push({ year: y, invested: amount * np, value: fv(np) })
  }

  return { finalValue, totalInvested, profit, profitRate, chartData }
}
