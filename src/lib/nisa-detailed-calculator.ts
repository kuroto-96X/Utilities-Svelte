export const NISA_MAX = 18_000_000

export type Frequency = 'monthly' | 'yearly'

export type InvestmentRecord = {
  id: string
  startMonth: string
  frequency: Frequency
  amount: number
}

export type CashFlow = {
  month: string
  amount: number
  date: Date
}

export type FutureRow = { own: number; ref: number }

export type NisaMaxRow = {
  reachedAlready: boolean
  yearsToMax: number | null
  own: number | null
  ref: number | null
  currentValue: number | null
  veryLong: boolean
}

export type DetailedCalcResult =
  | null
  | { error: string }
  | {
      annualReturn: number
      yearsInvested: number
      totalInvested: number
      latestAmount: number
      latestFrequency: Frequency
      hasDuplicateStartMonth: boolean
      futures: {
        years5: FutureRow
        years10: FutureRow
        years20: FutureRow
        nisaMax: NisaMaxRow
      }
    }

type ValidRecord = InvestmentRecord & { index: number; monthIndex: number }

const SHORT_PERIOD_ERROR = '投資期間が短すぎるため、年率を正確に計算できません'
const MS_PER_365_DAYS = 365 * 24 * 60 * 60 * 1000

export function periodsPerYear(frequency: Frequency): number {
  return frequency === 'monthly' ? 12 : 1
}

export function generateCashFlows(records: InvestmentRecord[], now: Date = new Date()): CashFlow[] {
  const validRecords = sortedValidRecords(records)
  if (validRecords.length === 0) return []

  const exclusiveCurrentMonth = dateToMonthIndex(now) + 1
  const flows: CashFlow[] = []

  for (let i = 0; i < validRecords.length; i++) {
    const record = validRecords[i]
    const exclusiveEnd = Math.min(
      validRecords[i + 1]?.monthIndex ?? exclusiveCurrentMonth,
      exclusiveCurrentMonth
    )

    if (record.monthIndex >= exclusiveEnd) continue

    if (record.frequency === 'monthly') {
      for (let monthIndex = record.monthIndex; monthIndex < exclusiveEnd; monthIndex++) {
        flows.push(createCashFlow(monthIndex, record.amount))
      }
    } else {
      const startMonthOfYear = record.monthIndex % 12
      for (let monthIndex = record.monthIndex; monthIndex < exclusiveEnd; monthIndex++) {
        if (monthIndex % 12 === startMonthOfYear) {
          flows.push(createCashFlow(monthIndex, record.amount))
        }
      }
    }
  }

  return flows
}

export function calcFutureValue(
  currentValue: number,
  perPeriod: number,
  rateAnnual: number,
  years: number,
  ppy: number
): number {
  const periods = years * ppy
  if (periods <= 0) return currentValue

  const rPeriod = Math.pow(1 + rateAnnual, 1 / ppy) - 1
  if (Math.abs(rPeriod) < 1e-10) {
    return currentValue + perPeriod * periods
  }
  return (
    currentValue * Math.pow(1 + rPeriod, periods) +
    perPeriod * ((Math.pow(1 + rPeriod, periods) - 1) / rPeriod)
  )
}

export function calculateDetailed(
  records: InvestmentRecord[],
  currentValue: number,
  referenceRate: number,
  now: Date = new Date()
): DetailedCalcResult {
  if (!Number.isFinite(currentValue) || currentValue < 0) return null

  const validRecords = sortedValidRecords(records)
  if (validRecords.length === 0) return null

  const cashFlows = generateCashFlows(records, now)
  if (cashFlows.length === 0) return null

  const ages = cashFlows.map(flow => yearsBetween(flow.date, now))
  const yearsInvested = Math.max(...ages)
  if (ages.every(age => age < 0.05)) return { error: SHORT_PERIOD_ERROR }

  const totalInvested = cashFlows.reduce((sum, flow) => sum + flow.amount, 0)
  const latestRecord = validRecords[validRecords.length - 1]
  const ppy = periodsPerYear(latestRecord.frequency)
  const refRate = Number.isFinite(referenceRate) && referenceRate > -100 ? referenceRate / 100 : 0
  const solvedRate = solveXirr(cashFlows, ages, currentValue)
  const ownRate = Number.isFinite(solvedRate) ? solvedRate : 0

  const calc = (years: number, rate: number) =>
    calcFutureValue(currentValue, latestRecord.amount, rate, years, ppy)

  let nisaMax: NisaMaxRow
  if (totalInvested >= NISA_MAX) {
    nisaMax = {
      reachedAlready: true,
      yearsToMax: null,
      own: null,
      ref: null,
      currentValue,
      veryLong: false
    }
  } else {
    const remaining = NISA_MAX - totalInvested
    const yearsToMax = remaining / latestRecord.amount / ppy
    nisaMax = {
      reachedAlready: false,
      yearsToMax,
      own: calcFutureValue(currentValue, latestRecord.amount, ownRate, yearsToMax, ppy),
      ref: calcFutureValue(currentValue, latestRecord.amount, refRate, yearsToMax, ppy),
      currentValue: null,
      veryLong: yearsToMax > 50
    }
  }

  return {
    annualReturn: ownRate * 100,
    yearsInvested,
    totalInvested,
    latestAmount: latestRecord.amount,
    latestFrequency: latestRecord.frequency,
    hasDuplicateStartMonth: hasDuplicateStartMonth(records),
    futures: {
      years5: { own: calc(5, ownRate), ref: calc(5, refRate) },
      years10: { own: calc(10, ownRate), ref: calc(10, refRate) },
      years20: { own: calc(20, ownRate), ref: calc(20, refRate) },
      nisaMax
    }
  }
}

function solveXirr(cashFlows: CashFlow[], ages: number[], currentValue: number): number {
  let rate = 0.1

  for (let i = 0; i < 100; i++) {
    const base = 1 + rate
    if (base <= 0 || !Number.isFinite(base)) return 0

    let value = -currentValue
    let derivative = 0
    for (let j = 0; j < cashFlows.length; j++) {
      const amount = cashFlows[j].amount
      const age = ages[j]
      value += amount * Math.pow(base, age)
      derivative += amount * age * Math.pow(base, age - 1)
    }

    if (!Number.isFinite(value) || !Number.isFinite(derivative)) return 0
    if (Math.abs(derivative) < 1e-12) break

    const step = Math.max(-1, Math.min(1, value / derivative))
    let nextRate = rate - step
    if (nextRate < -0.99) nextRate = -0.99
    if (Math.abs(nextRate - rate) < 1e-8) return nextRate

    rate = nextRate
  }

  return 0
}

function sortedValidRecords(records: InvestmentRecord[]): ValidRecord[] {
  return records
    .map((record, index) => ({ ...record, index, monthIndex: parseMonth(record.startMonth) }))
    .filter(
      (record): record is ValidRecord =>
        record.monthIndex !== null &&
        Number.isFinite(record.amount) &&
        record.amount > 0 &&
        (record.frequency === 'monthly' || record.frequency === 'yearly')
    )
    .sort((a, b) => a.monthIndex - b.monthIndex || a.index - b.index)
}

function parseMonth(month: string): number | null {
  const match = /^(\d{4})-(\d{2})$/.exec(month)
  if (!match) return null

  const year = Number(match[1])
  const monthNumber = Number(match[2])
  if (!Number.isInteger(year) || monthNumber < 1 || monthNumber > 12) return null

  return year * 12 + (monthNumber - 1)
}

function dateToMonthIndex(date: Date): number {
  return date.getFullYear() * 12 + date.getMonth()
}

function monthIndexToString(monthIndex: number): string {
  const year = Math.floor(monthIndex / 12)
  const month = (monthIndex % 12) + 1
  return `${year}-${String(month).padStart(2, '0')}`
}

function createCashFlow(monthIndex: number, amount: number): CashFlow {
  const year = Math.floor(monthIndex / 12)
  const month = monthIndex % 12
  return {
    month: monthIndexToString(monthIndex),
    amount,
    date: new Date(year, month, 1)
  }
}

function yearsBetween(from: Date, to: Date): number {
  return Math.max(0, (to.getTime() - from.getTime()) / MS_PER_365_DAYS)
}

function hasDuplicateStartMonth(records: InvestmentRecord[]): boolean {
  const seen = new Set<string>()
  for (const record of records) {
    if (seen.has(record.startMonth)) return true
    seen.add(record.startMonth)
  }
  return false
}
