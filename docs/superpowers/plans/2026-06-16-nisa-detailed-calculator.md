# NISA詳細年率計算 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 投資額や頻度の途中変更を反映して、XIRRでNISA運用年率と将来予測を計算する新しいツールページを追加する。

**Architecture:** 計算は `src/lib/nisa-detailed-calculator.ts` に集約し、Svelteページは入力状態、追加削除、表示に集中する。既存NISA系ページと同じTailwindカードUI、tealアクセント、Svelte 5 runesで実装する。

**Tech Stack:** SvelteKit, Svelte 5 runes, TypeScript, Tailwind CSS, Vitest

---

## File Structure

- Create: `src/lib/nisa-detailed-calculator.ts`
  - 投資記録型、キャッシュフロー生成、XIRR、将来価値、総合計算関数を提供する。
- Create: `src/lib/nisa-detailed-calculator.test.ts`
  - キャッシュフロー、XIRR、短期エラー、NISA満額到達の単体テストを置く。
- Create: `src/routes/nisa-detailed-calculator/+page.svelte`
  - 投資記録の入力UI、結果カード、将来予測テーブルを表示する。
- Modify: `src/lib/site.ts`
  - 投資カテゴリに `NISA詳細年率計算(開発中)` を追加する。

---

### Task 1: Calculation Tests

**Files:**
- Create: `src/lib/nisa-detailed-calculator.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
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
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/lib/nisa-detailed-calculator.test.ts`

Expected: FAIL because `./nisa-detailed-calculator` does not exist.

- [ ] **Step 3: Commit failing test**

```bash
git add src/lib/nisa-detailed-calculator.test.ts
git commit -m "test: NISA詳細年率計算のテストを追加"
```

---

### Task 2: Calculation Library

**Files:**
- Create: `src/lib/nisa-detailed-calculator.ts`
- Test: `src/lib/nisa-detailed-calculator.test.ts`

- [ ] **Step 1: Implement calculation library**

```ts
export const NISA_MAX = 18_000_000

export type Frequency = 'monthly' | 'yearly'

export type InvestmentRecord = {
  id: string
  startMonth: string
  frequency: Frequency
  amount: number
}

export type CashFlow = {
  date: Date
  month: string
  amount: number
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

const DAY_MS = 24 * 60 * 60 * 1000

export function periodsPerYear(frequency: Frequency): number {
  return frequency === 'monthly' ? 12 : 1
}

function parseMonth(month: string): Date | null {
  const match = /^(\d{4})-(\d{2})$/.exec(month)
  if (!match) return null
  const year = Number(match[1])
  const monthIndex = Number(match[2]) - 1
  if (monthIndex < 0 || monthIndex > 11) return null
  return new Date(year, monthIndex, 1)
}

function formatMonth(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}

function addMonths(date: Date, months: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + months, 1)
}

function addYears(date: Date, years: number): Date {
  return new Date(date.getFullYear() + years, date.getMonth(), 1)
}

function stableSortedRecords(records: InvestmentRecord[]): InvestmentRecord[] {
  return records
    .map((record, index) => ({ record, index }))
    .sort((a, b) => {
      const byMonth = a.record.startMonth.localeCompare(b.record.startMonth)
      return byMonth === 0 ? a.index - b.index : byMonth
    })
    .map(item => item.record)
}

export function hasDuplicateStartMonth(records: InvestmentRecord[]): boolean {
  const seen = new Set<string>()
  for (const record of records) {
    if (seen.has(record.startMonth)) return true
    seen.add(record.startMonth)
  }
  return false
}

export function generateCashFlows(records: InvestmentRecord[], now: Date = new Date()): CashFlow[] {
  const validRecords = records.filter(record => parseMonth(record.startMonth) && record.amount > 0)
  const sorted = stableSortedRecords(validRecords)
  const flows: CashFlow[] = []
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1)

  sorted.forEach((record, index) => {
    const periodStart = parseMonth(record.startMonth)
    if (!periodStart) return
    const nextRecord = sorted[index + 1]
    const periodEnd = nextRecord ? parseMonth(nextRecord.startMonth) : nextMonth
    if (!periodEnd) return

    let cursor = periodStart
    while (cursor < periodEnd) {
      flows.push({ date: cursor, month: formatMonth(cursor), amount: record.amount })
      cursor = record.frequency === 'monthly' ? addMonths(cursor, 1) : addYears(cursor, 1)
    }
  })

  return flows
}

export function calcFutureValue(
  currentValue: number,
  perPeriod: number,
  rateAnnual: number,
  years: number,
  ppy: number
): number {
  const M = years * ppy
  if (M <= 0) return currentValue
  const rPeriod = Math.pow(1 + rateAnnual, 1 / ppy) - 1
  if (Math.abs(rPeriod) < 1e-10) {
    return currentValue + perPeriod * M
  }
  return (
    currentValue * Math.pow(1 + rPeriod, M) +
    perPeriod * ((Math.pow(1 + rPeriod, M) - 1) / rPeriod)
  )
}

function solveXirr(flows: CashFlow[], currentValue: number, now: Date): { rate: number; converged: boolean } {
  let rate = 0.1

  for (let i = 0; i < 100; i++) {
    let f = -currentValue
    let derivative = 0

    for (const flow of flows) {
      const yearsAgo = (now.getTime() - flow.date.getTime()) / DAY_MS / 365
      const base = 1 + rate
      f += flow.amount * Math.pow(base, yearsAgo)
      derivative += flow.amount * yearsAgo * Math.pow(base, yearsAgo - 1)
    }

    if (!Number.isFinite(f) || !Number.isFinite(derivative) || Math.abs(derivative) < 1e-10) {
      return { rate: 0, converged: false }
    }

    const step = Math.max(-1, Math.min(1, f / derivative))
    let nextRate = rate - step
    if (nextRate < -0.99) nextRate = -0.99

    if (!Number.isFinite(nextRate)) return { rate: 0, converged: false }
    if (Math.abs(nextRate - rate) < 1e-8) return { rate: nextRate, converged: true }

    rate = nextRate
  }

  return { rate: 0, converged: false }
}

export function calculateDetailed(
  records: InvestmentRecord[],
  currentValue: number,
  referenceRate: number,
  now: Date = new Date()
): DetailedCalcResult {
  if (records.length === 0 || !Number.isFinite(currentValue) || currentValue < 0) return null

  const sorted = stableSortedRecords(records.filter(record => parseMonth(record.startMonth) && record.amount > 0))
  if (sorted.length === 0) return null

  const flows = generateCashFlows(sorted, now)
  if (flows.length === 0) return null

  const years = flows.map(flow => (now.getTime() - flow.date.getTime()) / DAY_MS / 365)
  if (years.every(year => year < 0.05)) {
    return { error: '投資期間が短すぎるため、年率を正確に計算できません' }
  }

  const totalInvested = flows.reduce((sum, flow) => sum + flow.amount, 0)
  const yearsInvested = Math.max(...years)
  const latest = sorted[sorted.length - 1]
  const ppy = periodsPerYear(latest.frequency)
  const refRate = referenceRate / 100
  const solved = solveXirr(flows, currentValue, now)
  const ownRate = solved.rate

  const calc = (yearsAhead: number, rate: number) =>
    calcFutureValue(currentValue, latest.amount, rate, yearsAhead, ppy)

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
    const periodsToMax = remaining / latest.amount
    const yearsToMax = periodsToMax / ppy
    nisaMax = {
      reachedAlready: false,
      yearsToMax,
      own: calc(yearsToMax, ownRate),
      ref: calc(yearsToMax, refRate),
      currentValue: null,
      veryLong: yearsToMax > 50
    }
  }

  return {
    annualReturn: ownRate * 100,
    yearsInvested,
    totalInvested,
    latestAmount: latest.amount,
    latestFrequency: latest.frequency,
    hasDuplicateStartMonth: hasDuplicateStartMonth(records),
    futures: {
      years5: { own: calc(5, ownRate), ref: calc(5, refRate) },
      years10: { own: calc(10, ownRate), ref: calc(10, refRate) },
      years20: { own: calc(20, ownRate), ref: calc(20, refRate) },
      nisaMax
    }
  }
}
```

- [ ] **Step 2: Run test to verify it passes**

Run: `npm run test -- src/lib/nisa-detailed-calculator.test.ts`

Expected: PASS for all tests in `src/lib/nisa-detailed-calculator.test.ts`.

- [ ] **Step 3: Commit calculation library**

```bash
git add src/lib/nisa-detailed-calculator.ts src/lib/nisa-detailed-calculator.test.ts
git commit -m "feat: NISA詳細年率計算ロジックを追加"
```

---

### Task 3: Tool Page UI

**Files:**
- Create: `src/routes/nisa-detailed-calculator/+page.svelte`
- Modify: `src/lib/site.ts`

- [ ] **Step 1: Add route page**

Create `src/routes/nisa-detailed-calculator/+page.svelte` using:

```svelte
<script lang="ts">
  import {
    calculateDetailed,
    type DetailedCalcResult,
    type Frequency,
    type InvestmentRecord
  } from '$lib/nisa-detailed-calculator'

  type FullResult = Exclude<DetailedCalcResult, null | { error: string }>

  let records = $state<InvestmentRecord[]>([
    { id: 'record-1', startMonth: '2022-01', frequency: 'monthly', amount: 10_000 },
    { id: 'record-2', startMonth: '2024-04', frequency: 'monthly', amount: 30_000 }
  ])
  let currentValueStr = $state('1500000')
  let referenceRate = $state(6.0)
  let nextId = $state(3)

  const todayMonth = new Date().toISOString().slice(0, 7)
  const result: DetailedCalcResult = $derived.by(() =>
    calculateDetailed(records, parseFloat(currentValueStr), referenceRate)
  )
  const fullResult: FullResult | null = $derived.by(() => {
    if (!result || 'error' in result) return null
    return result
  })

  function addRecord() {
    records = [
      ...records,
      {
        id: `record-${nextId}`,
        startMonth: todayMonth,
        frequency: 'monthly',
        amount: 10_000
      }
    ]
    nextId += 1
  }

  function removeRecord(id: string) {
    if (records.length <= 1) return
    records = records.filter(record => record.id !== id)
  }

  function updateRecord(id: string, patch: Partial<InvestmentRecord>) {
    records = records.map(record => (record.id === id ? { ...record, ...patch } : record))
  }

  function toMan(yen: number): string {
    return Math.round(yen / 10_000).toLocaleString()
  }

  function fmtYen(yen: number): string {
    return Math.round(yen).toLocaleString()
  }

  function paceLabel(amount: number, frequency: Frequency): string {
    return `${fmtYen(amount)}円 / ${frequency === 'monthly' ? '月' : '年'}`
  }
</script>

<svelte:head>
  <title>NISA詳細年率計算</title>
</svelte:head>

<div class="max-w-lg mx-auto px-4 py-6 space-y-4">
  <div class="bg-white rounded-xl shadow-sm p-4 space-y-4">
    <div>
      <h2 class="text-sm font-semibold text-slate-700">投資記録</h2>
      <p class="text-xs text-slate-500 mt-1">
        開始年月以降、次の記録の開始年月になるまで、その投資額・頻度を継続したものとして計算します。
      </p>
    </div>

    <div class="space-y-3">
      {#each records as record, index (record.id)}
        <div class="rounded-xl border border-slate-200 p-3 space-y-3">
          <div class="flex items-center justify-between gap-3">
            <p class="text-xs font-semibold text-slate-500">記録 {index + 1}</p>
            <button
              type="button"
              class="w-7 h-7 rounded-full border border-slate-200 text-slate-400 text-sm disabled:opacity-30 disabled:cursor-not-allowed hover:border-red-200 hover:text-red-500"
              disabled={records.length <= 1}
              onclick={() => removeRecord(record.id)}
              aria-label="投資記録を削除"
            >
              ×
            </button>
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-xs text-slate-500 mb-1" for={`${record.id}-month`}>開始年月</label>
              <input
                id={`${record.id}-month`}
                type="month"
                value={record.startMonth}
                max={todayMonth}
                onchange={(event) => updateRecord(record.id, { startMonth: event.currentTarget.value })}
                class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
            <div>
              <label class="block text-xs text-slate-500 mb-1" for={`${record.id}-frequency`}>頻度</label>
              <select
                id={`${record.id}-frequency`}
                value={record.frequency}
                onchange={(event) => updateRecord(record.id, { frequency: event.currentTarget.value as Frequency })}
                class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                <option value="monthly">毎月</option>
                <option value="yearly">毎年</option>
              </select>
            </div>
          </div>

          <div>
            <label class="block text-xs text-slate-500 mb-1" for={`${record.id}-amount`}>投資額（円）</label>
            <input
              id={`${record.id}-amount`}
              type="text"
              inputmode="decimal"
              value={record.amount}
              onchange={(event) => updateRecord(record.id, { amount: parseFloat(event.currentTarget.value) || 0 })}
              class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
        </div>
      {/each}
    </div>

    {#if fullResult?.hasDuplicateStartMonth}
      <p class="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
        同じ開始年月の記録が複数あります。後の記録がその月以降の投資ペースとして扱われます。
      </p>
    {/if}

    <button
      type="button"
      onclick={addRecord}
      class="w-full rounded-lg border border-dashed border-teal-300 text-teal-700 py-2 text-sm font-semibold hover:bg-teal-50"
    >
      ＋ 投資記録を追加
    </button>

    <div class="border-t border-slate-100 pt-4">
      <label class="block text-xs text-slate-500 mb-1" for="current-value">現在の評価額（円）</label>
      <input
        id="current-value"
        type="text"
        inputmode="decimal"
        bind:value={currentValueStr}
        placeholder="例: 1500000"
        class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
      />
    </div>
  </div>

  {#if result !== null}
    <div class="bg-white rounded-xl shadow-sm p-4 space-y-3">
      <h2 class="text-sm font-semibold text-slate-700">計算結果</h2>

      {#if 'error' in result}
        <p class="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{result.error}</p>
      {:else if fullResult}
        <div class="grid grid-cols-2 gap-3">
          <div class="bg-teal-50 rounded-xl p-3">
            <p class="text-xs text-slate-500 mb-1">年率（XIRR）</p>
            <p class="text-xl font-bold text-teal-700">
              {fullResult.annualReturn.toFixed(1)}<span class="text-sm font-normal ml-0.5">%</span>
            </p>
          </div>
          <div class="bg-slate-50 rounded-xl p-3">
            <p class="text-xs text-slate-500 mb-1">運用期間</p>
            <p class="text-xl font-bold text-slate-700">
              {fullResult.yearsInvested.toFixed(1)}<span class="text-sm font-normal ml-0.5">年</span>
            </p>
          </div>
          <div class="bg-slate-50 rounded-xl p-3">
            <p class="text-xs text-slate-500 mb-1">累計投資額</p>
            <p class="text-lg font-bold text-slate-700">
              {fmtYen(fullResult.totalInvested)}<span class="text-xs font-normal ml-0.5">円</span>
            </p>
          </div>
          <div class="bg-slate-50 rounded-xl p-3">
            <p class="text-xs text-slate-500 mb-1">直近の投資ペース</p>
            <p class="text-lg font-bold text-slate-700">{paceLabel(fullResult.latestAmount, fullResult.latestFrequency)}</p>
          </div>
        </div>
      {/if}
    </div>
  {/if}

  {#if fullResult}
    <div class="bg-white rounded-xl shadow-sm p-4 space-y-4">
      <h2 class="text-sm font-semibold text-slate-700">将来予測</h2>

      <div>
        <div class="flex items-center justify-between mb-1">
          <p class="text-xs text-slate-500">参考年率</p>
          <span class="text-sm font-bold text-slate-700">{referenceRate.toFixed(1)}%</span>
        </div>
        <input
          type="range"
          min="0"
          max="15"
          step="0.5"
          bind:value={referenceRate}
          class="w-full accent-teal-600"
          aria-label="参考年率"
        />
      </div>

      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-slate-100">
              <th class="text-left text-xs text-slate-500 font-normal pb-2 pr-2">時期</th>
              <th class="text-right text-xs text-slate-500 font-normal pb-2 px-2">
                ご自身の年率<br /><span class="text-teal-700 font-semibold">{fullResult.annualReturn.toFixed(1)}%</span>
              </th>
              <th class="text-right text-xs text-slate-500 font-normal pb-2 pl-2">
                参考年率<br /><span class="text-slate-700 font-semibold">{referenceRate.toFixed(1)}%</span>
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-50">
            <tr>
              <td class="py-2 pr-2 text-xs text-slate-600">5年後</td>
              <td class="py-2 px-2 text-right font-medium">{toMan(fullResult.futures.years5.own)}<span class="text-xs text-slate-400 ml-0.5">万円</span></td>
              <td class="py-2 pl-2 text-right font-medium">{toMan(fullResult.futures.years5.ref)}<span class="text-xs text-slate-400 ml-0.5">万円</span></td>
            </tr>
            <tr>
              <td class="py-2 pr-2 text-xs text-slate-600">10年後</td>
              <td class="py-2 px-2 text-right font-medium">{toMan(fullResult.futures.years10.own)}<span class="text-xs text-slate-400 ml-0.5">万円</span></td>
              <td class="py-2 pl-2 text-right font-medium">{toMan(fullResult.futures.years10.ref)}<span class="text-xs text-slate-400 ml-0.5">万円</span></td>
            </tr>
            <tr>
              <td class="py-2 pr-2 text-xs text-slate-600">20年後</td>
              <td class="py-2 px-2 text-right font-medium">{toMan(fullResult.futures.years20.own)}<span class="text-xs text-slate-400 ml-0.5">万円</span></td>
              <td class="py-2 pl-2 text-right font-medium">{toMan(fullResult.futures.years20.ref)}<span class="text-xs text-slate-400 ml-0.5">万円</span></td>
            </tr>
            <tr class="bg-slate-50">
              {#if fullResult.futures.nisaMax.reachedAlready}
                <td class="py-2 pr-2 text-xs text-slate-600">NISA満額（達成済み）</td>
                <td class="py-2 px-2 text-right font-medium">{toMan(fullResult.futures.nisaMax.currentValue!)}<span class="text-xs text-slate-400 ml-0.5">万円</span></td>
                <td class="py-2 pl-2 text-right text-xs text-slate-400">—</td>
              {:else}
                <td class="py-2 pr-2 text-xs text-slate-600">
                  NISA満額到達時
                  {#if fullResult.futures.nisaMax.veryLong}
                    <span class="block text-amber-600">（参考値・長期）</span>
                  {/if}
                </td>
                <td class="py-2 px-2 text-right font-medium">{toMan(fullResult.futures.nisaMax.own!)}<span class="text-xs text-slate-400 ml-0.5">万円</span></td>
                <td class="py-2 pl-2 text-right font-medium">{toMan(fullResult.futures.nisaMax.ref!)}<span class="text-xs text-slate-400 ml-0.5">万円</span></td>
              {/if}
            </tr>
          </tbody>
        </table>
      </div>

      <div class="text-xs text-slate-400 space-y-1 border-t border-slate-100 pt-3">
        <p>※年率はこれまでの投資記録と現在の評価額から、XIRR（内部収益率）という方法で算出した参考値です。</p>
        <p>※参考年率は想定値であり、将来の運用成果を示すものではありません。</p>
        <p>※NISA生涯投資枠1,800万円（2024年からの新NISA制度）を基準にしています。制度内容は変更される可能性があります。</p>
      </div>
    </div>
  {/if}
</div>
```

- [ ] **Step 2: Add site navigation entry**

Modify `src/lib/site.ts` investment tools:

```ts
    {
      href: "/nisa-detailed-calculator",
      label: "NISA詳細年率計算(開発中)",
      description: "投資額の変更履歴からXIRRで運用年率を計算するツール",
      visible: true,
      category: 'investment',
    },
```

Place it after `NISA年率計算(開発中)` and before `NISA積立シミュレーター(開発中)`.

- [ ] **Step 3: Run Svelte check**

Run: `npm run check`

Expected: PASS with no TypeScript or Svelte diagnostics.

- [ ] **Step 4: Commit page UI**

```bash
git add src/routes/nisa-detailed-calculator/+page.svelte src/lib/site.ts
git commit -m "feat: NISA詳細年率計算ページを追加"
```

---

### Task 4: Full Verification

**Files:**
- No source changes unless verification finds a bug.

- [ ] **Step 1: Run all tests**

Run: `npm run test`

Expected: PASS.

- [ ] **Step 2: Run project check**

Run: `npm run check`

Expected: PASS.

- [ ] **Step 3: Run production build**

Run: `npm run build`

Expected: PASS and SvelteKit static build completes.

- [ ] **Step 4: Preview the route**

Run: `npm run preview -- --host 127.0.0.1`

Expected: preview server starts, and `/nisa-detailed-calculator/` renders the input card, calculation result, future projection table, and footer disclaimer.

- [ ] **Step 5: Commit fixes if needed**

If verification required changes:

```bash
git add <changed-files>
git commit -m "fix: NISA詳細年率計算の検証指摘を修正"
```

---

## Self-Review

- Spec coverage: 投資記録追加削除、安定ソート、キャッシュフロー生成、XIRR、短期エラー、重複開始年月注意、将来予測、NISA満額到達、免責文、ナビ追加を各タスクに含めた。
- Placeholder scan: 未解決の作業メモや後回し表現はない。
- Type consistency: `InvestmentRecord`、`DetailedCalcResult`、`calculateDetailed`、`generateCashFlows` の名前はテスト、実装、ページで一致している。
