# NISA年率計算（簡易版）実装プラン

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** NISA口座の「現在の評価額」「損益率」から運用年率を逆算し、将来予測を表示するWebページを実装する

**Architecture:** 計算ロジックを `src/lib/nisa-calculator.ts` に純粋関数として実装してテストし、UIは `src/routes/nisa-simple-calculator/+page.svelte` で Svelte 5 runes を使いリアルタイム反映する。3カード構成（入力・結果・将来予測）のモバイル優先レイアウト。

**Tech Stack:** SvelteKit, Svelte 5 (runes: `$state`, `$derived.by`), TypeScript, Tailwind CSS, Vitest

**Design doc:** `docs/superpowers/specs/2026-06-15-nisa-simple-calculator-design.md`

---

## ファイル構成

| ファイル | 操作 | 役割 |
|---|---|---|
| `src/lib/site.ts` | 修正 | ナビゲーションにツール登録 |
| `src/lib/nisa-calculator.ts` | 新規作成 | 計算ロジック（純粋関数） |
| `src/lib/nisa-calculator.test.ts` | 新規作成 | Vitest ユニットテスト |
| `src/routes/nisa-simple-calculator/+page.svelte` | 新規作成 | UI（入力・結果・将来予測の3カード） |

---

## Task 1: site.ts にツールを登録

**Files:**
- Modify: `src/lib/site.ts`

- [ ] **Step 1: `src/lib/site.ts` の `tools` 配列に以下のエントリを追加**（`id-photo` エントリの直後、`] as const` の前に追加）

```typescript
    {
      href: "/nisa-simple-calculator",
      label: "NISA年率計算(開発中)",
      description: "NISAの損益率から運用年率を逆算するツール",
      visible: true,
    },
```

- [ ] **Step 2: コミット**

```bash
git add src/lib/site.ts
git commit -m "feat: add nisa-simple-calculator to site navigation"
```

---

## Task 2: 計算ロジックを実装

**Files:**
- Create: `src/lib/nisa-calculator.ts`

- [ ] **Step 1: `src/lib/nisa-calculator.ts` を新規作成**

```typescript
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
```

- [ ] **Step 2: コミット**

```bash
git add src/lib/nisa-calculator.ts
git commit -m "feat: add nisa-calculator calculation logic"
```

---

## Task 3: 計算ロジックのテストを書いて通す

**Files:**
- Create: `src/lib/nisa-calculator.test.ts`

- [ ] **Step 1: `src/lib/nisa-calculator.test.ts` を新規作成**

```typescript
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
    // 少額投資で満額まで超長期かかるケース
    const result = calculate('2024-01', 'monthly', 100_000, 1, 6)
    if (!result || 'error' in result) throw new Error('Expected full result')
    if (result.futures.nisaMax.reachedAlready) return
    if (result.futures.nisaMax.yearsToMax! > 50) {
      expect(result.futures.nisaMax.veryLong).toBe(true)
    }
  })
})
```

- [ ] **Step 2: テストを実行して全件パスを確認**

```bash
npm run test -- --reporter=verbose src/lib/nisa-calculator.test.ts
```

期待される出力（すべて✓）:
```
✓ calcN > 毎月: 2022-01から2024-01は24期
✓ calcN > 毎年: 2020-01から2024年は4期
...
Test Files  1 passed (1)
Tests      13 passed (13)
```

- [ ] **Step 3: コミット**

```bash
git add src/lib/nisa-calculator.test.ts
git commit -m "test: add unit tests for nisa-calculator logic"
```

---

## Task 4: +page.svelte を作成（スクリプト＋入力カード）

**Files:**
- Create: `src/routes/nisa-simple-calculator/+page.svelte`

- [ ] **Step 1: `src/routes/nisa-simple-calculator/+page.svelte` を新規作成**

```svelte
<script lang="ts">
  import { calculate, type CalcResult } from '$lib/nisa-calculator'

  let startMonth = $state('')
  let frequency = $state<'monthly' | 'yearly'>('monthly')
  let currentValueStr = $state('')
  let profitRateStr = $state('')
  let referenceRate = $state(6.0)

  type FullResult = Exclude<CalcResult, null | { error: string }>

  const result: CalcResult = $derived.by(() =>
    calculate(
      startMonth,
      frequency,
      parseFloat(currentValueStr),
      parseFloat(profitRateStr),
      referenceRate
    )
  )

  const fullResult: FullResult | null = $derived.by(() => {
    if (!result || 'error' in result) return null
    return result
  })

  function toMan(yen: number): string {
    return Math.round(yen / 10000).toLocaleString()
  }

  const todayMonth = new Date().toISOString().slice(0, 7)
</script>

<div class="max-w-lg mx-auto px-4 py-6 space-y-4">
  <!-- 入力カード -->
  <div class="bg-white rounded-xl shadow-sm p-4 space-y-4">
    <h2 class="text-sm font-semibold text-slate-700">投資情報を入力</h2>

    <div>
      <label class="block text-xs text-slate-500 mb-1" for="start-month">投資開始年月</label>
      <input
        id="start-month"
        type="month"
        bind:value={startMonth}
        max={todayMonth}
        class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
      />
    </div>

    <div>
      <p class="text-xs text-slate-500 mb-1">投資頻度</p>
      <div class="flex rounded-lg border border-slate-200 overflow-hidden">
        <button
          type="button"
          class="flex-1 py-2 text-sm font-medium transition-colors"
          class:bg-teal-700={frequency === 'monthly'}
          class:text-white={frequency === 'monthly'}
          class:text-slate-600={frequency !== 'monthly'}
          onclick={() => (frequency = 'monthly')}
        >
          毎月
        </button>
        <button
          type="button"
          class="flex-1 py-2 text-sm font-medium transition-colors border-l border-slate-200"
          class:bg-teal-700={frequency === 'yearly'}
          class:text-white={frequency === 'yearly'}
          class:text-slate-600={frequency !== 'yearly'}
          onclick={() => (frequency = 'yearly')}
        >
          毎年
        </button>
      </div>
    </div>

    <div class="grid grid-cols-2 gap-3">
      <div>
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
      <div>
        <label class="block text-xs text-slate-500 mb-1" for="profit-rate">現在の損益率（%）</label>
        <input
          id="profit-rate"
          type="text"
          inputmode="decimal"
          bind:value={profitRateStr}
          placeholder="例: 15.3"
          class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
        />
      </div>
    </div>
  </div>
</div>
```

- [ ] **Step 2: 開発サーバーを起動してブラウザで入力カードが表示されることを確認**

```bash
npm run dev
```

`http://localhost:5173/nisa-simple-calculator` を開く。
- ナビゲーションに「NISA年率計算(開発中)」が表示される
- 投資開始年月・頻度トグル・評価額・損益率の入力欄が縦並びで表示される
- 頻度トグルでボタンが teal に切り替わることを確認

- [ ] **Step 3: コミット**

```bash
git add src/routes/nisa-simple-calculator/+page.svelte
git commit -m "feat: add nisa-simple-calculator page with input card"
```

---

## Task 5: 計算結果カードを追加

**Files:**
- Modify: `src/routes/nisa-simple-calculator/+page.svelte`

- [ ] **Step 1: `</div>` （外側コンテナの閉じタグ）の直前に計算結果カードを追加**

入力カードの `</div>` の後（外側 `<div class="max-w-lg...">` の `</div>` の前）に以下を挿入：

```svelte
  <!-- 計算結果カード -->
  {#if result !== null}
    <div class="bg-white rounded-xl shadow-sm p-4 space-y-3">
      <h2 class="text-sm font-semibold text-slate-700">計算結果</h2>

      {#if 'error' in result}
        <p class="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{result.error}</p>
      {:else if fullResult}
        <div class="grid grid-cols-2 gap-3">
          <div class="bg-teal-50 rounded-xl p-3">
            <p class="text-xs text-slate-500 mb-1">年率換算リターン</p>
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
              {Math.round(fullResult.totalInvested).toLocaleString()}<span class="text-xs font-normal ml-0.5">円</span>
            </p>
          </div>
          <div class="bg-slate-50 rounded-xl p-3">
            <p class="text-xs text-slate-500 mb-1">1回あたり投資額</p>
            <p class="text-lg font-bold text-slate-700">
              {Math.round(fullResult.perPeriodAmount).toLocaleString()}<span class="text-xs font-normal ml-0.5">円</span>
            </p>
          </div>
        </div>
      {/if}
    </div>
  {/if}
```

- [ ] **Step 2: ブラウザで動作確認**

`http://localhost:5173/nisa-simple-calculator` で以下を入力して確認：
- 投資開始年月: `2022-01`
- 投資頻度: 毎月
- 現在の評価額: `1500000`
- 現在の損益率: `15`

計算結果カードが表示され、以下が確認できること：
- 年率換算リターン（正の値 %）
- 運用期間（年）
- 累計投資額（約 1,304,348 円）
- 1回あたり投資額（正の値）

次に損益率を `-100` にして「入力値を確認してください」エラーが表示されること。

- [ ] **Step 3: コミット**

```bash
git add src/routes/nisa-simple-calculator/+page.svelte
git commit -m "feat: add calculation result card to nisa-simple-calculator"
```

---

## Task 6: 将来予測カードを追加

**Files:**
- Modify: `src/routes/nisa-simple-calculator/+page.svelte`

- [ ] **Step 1: 計算結果カードの `{/if}` の後（外側コンテナ `</div>` の前）に将来予測カードを追加**

```svelte
  <!-- 将来予測カード -->
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
                <td class="py-2 px-2 text-right font-medium">
                  {toMan(fullResult.futures.nisaMax.currentValue!)}<span class="text-xs text-slate-400 ml-0.5">万円</span>
                </td>
                <td class="py-2 pl-2 text-right text-xs text-slate-400">—</td>
              {:else}
                <td class="py-2 pr-2 text-xs text-slate-600">
                  NISA満額到達時
                  {#if fullResult.futures.nisaMax.veryLong}
                    <span class="block text-amber-600">（参考値・長期）</span>
                  {/if}
                </td>
                <td class="py-2 px-2 text-right font-medium">
                  {toMan(fullResult.futures.nisaMax.own!)}<span class="text-xs text-slate-400 ml-0.5">万円</span>
                </td>
                <td class="py-2 pl-2 text-right font-medium">
                  {toMan(fullResult.futures.nisaMax.ref!)}<span class="text-xs text-slate-400 ml-0.5">万円</span>
                </td>
              {/if}
            </tr>
          </tbody>
        </table>
      </div>

      <div class="text-xs text-slate-400 space-y-1 border-t border-slate-100 pt-3">
        <p>※年率は損益率と投資期間から近似計算した参考値です。投資額が一定でない場合や不定期な投資の場合、実際の年率とは異なります。</p>
        <p>※参考年率は想定値であり、将来の運用成果を示すものではありません。</p>
        <p>※NISA生涯投資枠1,800万円（2024年からの新NISA制度）を基準にしています。制度内容は変更される可能性があります。</p>
      </div>
    </div>
  {/if}
```

- [ ] **Step 2: ブラウザで動作確認**

`http://localhost:5173/nisa-simple-calculator` で以下を確認：
- 計算値入力時に将来予測テーブルが表示される
- スライダーを動かすと参考年率列がリアルタイムで更新される
- テーブルが横スクロールなしで表示される
- NISA満額行が「達成済み」または「到達時」で適切に表示される

- [ ] **Step 3: コミット**

```bash
git add src/routes/nisa-simple-calculator/+page.svelte
git commit -m "feat: add future prediction card with slider and NISA table"
```

---

## Task 7: ビルド確認と最終チェック

**Files:** なし（確認のみ）

- [ ] **Step 1: ビルドを通す**

```bash
npm run build
```

エラーがないことを確認。TypeScript の型エラーが出た場合は修正する。

- [ ] **Step 2: 型チェックを実行**

```bash
npm run check
```

エラー0件であることを確認。

- [ ] **Step 3: テストを全件実行**

```bash
npm run test
```

すべてパスすることを確認。

- [ ] **Step 4: ブラウザで最終確認**

`http://localhost:5173/nisa-simple-calculator` で以下の入力パターンを確認：

| テストケース | 投資開始 | 評価額 | 損益率 | 期待される動作 |
|---|---|---|---|---|
| 通常入力 | 2022-01 | 1500000 | 15 | 全カード表示、年率>0% |
| 損益率0% | 2022-01 | 1500000 | 0 | 年率0%表示 |
| 損益率マイナス | 2022-01 | 500000 | -30 | 年率マイナス表示 |
| 全損近く | 2022-01 | 100000 | -99 | 計算可能（エラーなし） |
| 全損 | 2022-01 | 0 | -100 | エラー表示 |
| 毎年投資 | 2020-01 | 2000000 | 20 | 頻度切替で再計算 |

- [ ] **Step 5: コミット**

```bash
git add -A
git commit -m "feat: complete nisa-simple-calculator implementation"
```
