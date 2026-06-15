export const NISA_MAX = 18_000_000

export type Frequency = 'monthly' | 'yearly'

export type FutureRow = { own: number; ref: number }

export type NisaMaxRow = {
  reachedAlready: boolean
  yearsToMax: number | null
  own: number | null
  ref: number | null
  currentValue: number | null
  veryLong: boolean
}

export type CalcResult =
  | null
  | { error: string }
  | {
      annualReturn: number
      yearsInvested: number
      totalInvested: number
      perPeriodAmount: number
      futures: {
        years5: FutureRow
        years10: FutureRow
        years20: FutureRow
        nisaMax: NisaMaxRow
      }
    }

export function periodsPerYear(frequency: Frequency): number {
  return frequency === 'monthly' ? 12 : 1
}

export function calcN(startMonth: string, frequency: Frequency, now: Date = new Date()): number {
  const [startY, startM] = startMonth.split('-').map(Number)
  const nowY = now.getFullYear()
  const nowM = now.getMonth() + 1
  const N =
    frequency === 'monthly'
      ? (nowY - startY) * 12 + (nowM - startM)
      : nowY - startY
  return Math.max(N, 1)
}

export function calcFutureValue(
  cv: number,
  perPeriod: number,
  rateAnnual: number,
  years: number,
  ppy: number
): number {
  const M = years * ppy
  const rPeriod = Math.pow(1 + rateAnnual, 1 / ppy) - 1
  if (Math.abs(rPeriod) < 1e-10) {
    return cv + perPeriod * M
  }
  return (
    cv * Math.pow(1 + rPeriod, M) +
    perPeriod * ((Math.pow(1 + rPeriod, M) - 1) / rPeriod)
  )
}

export function calculate(
  startMonth: string,
  frequency: Frequency,
  currentValue: number,
  profitRate: number,
  referenceRate: number
): CalcResult {
  if (!startMonth || isNaN(currentValue) || isNaN(profitRate)) return null
  if (profitRate <= -100) return { error: '入力値を確認してください（損益率が -100% 以下です）' }

  const ppy = periodsPerYear(frequency)
  const N = calcN(startMonth, frequency)
  const totalInvested = currentValue / (1 + profitRate / 100)
  const perPeriodAmount = totalInvested / N
  const R = (profitRate / 100) * ((2 * N) / (N + 1))
  if (1 + R <= 0) return { error: '入力値を確認してください（計算できない損益率です）' }
  const T = N / ppy
  const r = Math.pow(1 + R, 1 / T) - 1
  const refRate = referenceRate / 100

  const calc = (years: number, rate: number) =>
    calcFutureValue(currentValue, perPeriodAmount, rate, years, ppy)

  const remaining = NISA_MAX - totalInvested
  let nisaMax: NisaMaxRow

  if (remaining <= 0) {
    nisaMax = {
      reachedAlready: true,
      yearsToMax: null,
      own: null,
      ref: null,
      currentValue,
      veryLong: false
    }
  } else {
    const periodsToMax = remaining / perPeriodAmount
    const yearsToMax = periodsToMax / ppy
    nisaMax = {
      reachedAlready: false,
      yearsToMax,
      own: calcFutureValue(currentValue, perPeriodAmount, r, yearsToMax, ppy),
      ref: calcFutureValue(currentValue, perPeriodAmount, refRate, yearsToMax, ppy),
      currentValue: null,
      veryLong: yearsToMax > 50
    }
  }

  return {
    annualReturn: r * 100,
    yearsInvested: T,
    totalInvested,
    perPeriodAmount,
    futures: {
      years5: { own: calc(5, r), ref: calc(5, refRate) },
      years10: { own: calc(10, r), ref: calc(10, refRate) },
      years20: { own: calc(20, r), ref: calc(20, refRate) },
      nisaMax
    }
  }
}
