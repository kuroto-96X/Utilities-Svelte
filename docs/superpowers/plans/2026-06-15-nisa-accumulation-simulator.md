# NISA積立シミュレーター 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/nisa-accumulation-simulator` ルートに積立投資の将来価値をリアルタイム計算・SVGグラフ表示するページを追加する

**Architecture:** 計算ロジックを `src/lib/nisa-accumulation-simulator.ts` に分離し、Svelte 5 の `$state`/`$derived.by()` でリアクティブに結果とSVGパスを生成する。グラフは外部ライブラリなしで `<path>` を動的生成する。

**Tech Stack:** SvelteKit + Svelte 5 (runes), TypeScript, Tailwind CSS, Vitest, SVG

---

## ファイルマップ

| 操作 | パス | 役割 |
|---|---|---|
| 作成 | `src/lib/nisa-accumulation-simulator.ts` | 計算ロジック・型定義 |
| 作成 | `src/lib/nisa-accumulation-simulator.test.ts` | vitest ユニットテスト |
| 作成 | `src/routes/nisa-accumulation-simulator/+page.svelte` | UI（入力・結果・グラフ） |
| 修正 | `src/lib/site.ts` | ツールリストへのエントリ追加 |

---

## Task 1: 計算ロジックのlibファイルとテスト

**Files:**
- Create: `src/lib/nisa-accumulation-simulator.ts`
- Create: `src/lib/nisa-accumulation-simulator.test.ts`

- [ ] **Step 1: テストファイルを作成して失敗させる**

`src/lib/nisa-accumulation-simulator.test.ts` を作成:

```ts
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
```

- [ ] **Step 2: テストが失敗することを確認**

```
npm test -- --reporter=verbose nisa-accumulation-simulator
```

期待: `Cannot find module './nisa-accumulation-simulator'` エラー

- [ ] **Step 3: libファイルを実装する**

`src/lib/nisa-accumulation-simulator.ts` を作成:

```ts
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
```

- [ ] **Step 4: テストが通ることを確認**

```
npm test -- --reporter=verbose nisa-accumulation-simulator
```

期待: 全テスト PASS

- [ ] **Step 5: コミット**

```bash
git add src/lib/nisa-accumulation-simulator.ts src/lib/nisa-accumulation-simulator.test.ts
git commit -m "feat: NISA積立シミュレーターの計算ロジックを追加"
```

---

## Task 2: site.ts にツールを登録する

**Files:**
- Modify: `src/lib/site.ts`

- [ ] **Step 1: site.ts を開いて末尾のエントリの直後にエントリを追加する**

`src/lib/site.ts` の `tools` 配列の末尾（`/nisa-simple-calculator` エントリの後）に追加:

```ts
    {
      href: "/nisa-accumulation-simulator",
      label: "NISA積立シミュレーター(開発中)",
      description: "毎月・毎年の積立投資の将来評価額と資産推移をシミュレーションするツール",
      visible: true,
    },
```

修正後の `tools` 配列末尾:

```ts
    {
      href: "/nisa-simple-calculator",
      label: "NISA年率計算(開発中)",
      description: "NISAの損益率から運用年率を逆算するツール",
      visible: true,
    },
    {
      href: "/nisa-accumulation-simulator",
      label: "NISA積立シミュレーター(開発中)",
      description: "毎月・毎年の積立投資の将来評価額と資産推移をシミュレーションするツール",
      visible: true,
    },
  ],
} as const
```

- [ ] **Step 2: ビルドが通ることを確認**

```
npm run build
```

期待: エラーなし（site.ts はルーティングと独立したデータファイルなので、ページ未実装でもビルドできる）

- [ ] **Step 3: コミット**

```bash
git add src/lib/site.ts
git commit -m "feat: NISA積立シミュレーターをサイトナビゲーションに追加"
```

---

## Task 3: ページコンポーネントを実装する

**Files:**
- Create: `src/routes/nisa-accumulation-simulator/+page.svelte`

### Step 1: ディレクトリとファイルを作成する

- [ ] **Step 1: +page.svelte の骨格を作成する**

`src/routes/nisa-accumulation-simulator/+page.svelte` を作成:

```svelte
<script lang="ts">
  import { simulate, type Frequency } from '$lib/nisa-accumulation-simulator'

  let frequency = $state<Frequency>('monthly')
  let amountStr = $state('30000')
  let years = $state(20)
  let annualRate = $state(5.0)

  const result = $derived.by(() =>
    simulate(parseFloat(amountStr) || 0, years, annualRate, frequency)
  )

  const investLabel = $derived(frequency === 'monthly' ? '毎月の投資額（円）' : '毎年の投資額（円）')

  function fmt(n: number): string {
    return Math.round(n).toLocaleString()
  }

  function fmtRate(n: number): string {
    return n.toFixed(1)
  }
</script>

<svelte:head>
  <title>NISA積立シミュレーター</title>
</svelte:head>

<div class="max-w-lg mx-auto px-4 py-6 space-y-4">
  <!-- 入力カード -->
  <!-- 結果カード -->
  <!-- グラフカード -->
</div>
```

- [ ] **Step 2: 入力カードを実装する**

スクリプトブロックはそのままに、コメント `<!-- 入力カード -->` を以下で置き換える:

```svelte
  <!-- 入力カード -->
  <div class="bg-white rounded-xl shadow-sm p-4 space-y-4">
    <h2 class="text-sm font-semibold text-slate-700">投資情報を入力</h2>

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
          aria-pressed={frequency === 'monthly'}
        >毎月</button>
        <button
          type="button"
          class="flex-1 py-2 text-sm font-medium transition-colors border-l border-slate-200"
          class:bg-teal-700={frequency === 'yearly'}
          class:text-white={frequency === 'yearly'}
          class:text-slate-600={frequency !== 'yearly'}
          onclick={() => (frequency = 'yearly')}
          aria-pressed={frequency === 'yearly'}
        >毎年</button>
      </div>
    </div>

    <div>
      <label class="block text-xs text-slate-500 mb-1" for="amount">{investLabel}</label>
      <input
        id="amount"
        type="text"
        inputmode="decimal"
        bind:value={amountStr}
        placeholder="例: 30000"
        class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
      />
    </div>

    <div>
      <div class="flex items-center justify-between mb-1">
        <label class="text-xs text-slate-500" for="years">投資期間（年）</label>
        <span class="text-sm font-bold text-slate-700">{years}年</span>
      </div>
      <input
        id="years"
        type="range"
        min="1"
        max="40"
        step="1"
        bind:value={years}
        class="w-full accent-teal-600"
        aria-label="投資期間"
      />
    </div>

    <div>
      <div class="flex items-center justify-between mb-1">
        <label class="text-xs text-slate-500" for="rate">想定年利（%）</label>
        <span class="text-sm font-bold text-slate-700">{annualRate.toFixed(1)}%</span>
      </div>
      <input
        id="rate"
        type="range"
        min="0"
        max="15"
        step="0.5"
        bind:value={annualRate}
        class="w-full accent-teal-600"
        aria-label="想定年利"
      />
    </div>
  </div>
```

- [ ] **Step 3: 結果カードを実装する**

コメント `<!-- 結果カード -->` を以下で置き換える:

```svelte
  <!-- 結果カード -->
  <div class="bg-white rounded-xl shadow-sm p-4 space-y-3">
    <h2 class="text-sm font-semibold text-slate-700">計算結果</h2>
    <div class="grid grid-cols-2 gap-3">
      <div class="bg-teal-50 rounded-xl p-3">
        <p class="text-xs text-slate-500 mb-1">最終評価額</p>
        <p class="text-xl font-bold text-teal-700">
          {fmt(result.finalValue)}<span class="text-sm font-normal ml-0.5">円</span>
        </p>
      </div>
      <div class="bg-slate-50 rounded-xl p-3">
        <p class="text-xs text-slate-500 mb-1">累計投資額</p>
        <p class="text-lg font-bold text-slate-700">
          {fmt(result.totalInvested)}<span class="text-xs font-normal ml-0.5">円</span>
        </p>
      </div>
      <div class="bg-slate-50 rounded-xl p-3">
        <p class="text-xs text-slate-500 mb-1">損益額</p>
        <p class="text-lg font-bold text-slate-700">
          {fmt(result.profit)}<span class="text-xs font-normal ml-0.5">円</span>
        </p>
      </div>
      <div class="bg-slate-50 rounded-xl p-3">
        <p class="text-xs text-slate-500 mb-1">損益率</p>
        <p class="text-lg font-bold text-slate-700">
          {fmtRate(result.profitRate)}<span class="text-xs font-normal ml-0.5">%</span>
        </p>
      </div>
    </div>
  </div>
```

- [ ] **Step 4: グラフカードを実装する**

グラフのSVGパスを計算する derived を `<script>` に追加し、グラフカードを差し込む。

`<script>` の末尾（`fmtRate` 関数の後）に以下を追加:

```ts
  const SVG_W = 300
  const SVG_H = 160
  const PAD_L = 36
  const PAD_R = 8
  const PAD_T = 16
  const PAD_B = 20
  const PLOT_W = SVG_W - PAD_L - PAD_R
  const PLOT_H = SVG_H - PAD_T - PAD_B

  const chart = $derived.by(() => {
    const data = result.chartData
    const maxValue = Math.max(result.finalValue, 1)

    function xOf(year: number) {
      return PAD_L + (year / Math.max(years, 1)) * PLOT_W
    }
    function yOf(value: number) {
      return PAD_T + (1 - value / maxValue) * PLOT_H
    }

    const yBottom = PAD_T + PLOT_H

    const areaPoints = data
      .map((p, i) => (i === 0 ? `M ${xOf(p.year)},${yBottom} L ${xOf(p.year)},${yOf(p.value)}` : `L ${xOf(p.year)},${yOf(p.value)}`))
      .join(' ')
    const areaPath = `${areaPoints} L ${xOf(years)},${yBottom} Z`

    const linePath = data
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${xOf(p.year)},${yOf(p.value)}`)
      .join(' ')

    const investedPath = data
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${xOf(p.year)},${yOf(p.invested)}`)
      .join(' ')

    const maxLabel = `${Math.round(maxValue / 10_000).toLocaleString()}万円`

    return { areaPath, linePath, investedPath, maxLabel, yBottom, xEnd: xOf(years), xStart: xOf(0) }
  })
```

コメント `<!-- グラフカード -->` を以下で置き換える:

```svelte
  <!-- グラフカード -->
  <div class="bg-white rounded-xl shadow-sm p-4 space-y-3">
    <h2 class="text-sm font-semibold text-slate-700">資産推移</h2>

    <!-- 凡例 -->
    <div class="flex items-center gap-4 text-xs text-slate-600">
      <span class="flex items-center gap-1.5">
        <span class="inline-block w-6 h-0.5 bg-[#0F6E56] rounded"></span>評価額
      </span>
      <span class="flex items-center gap-1.5">
        <svg width="24" height="4" class="inline-block">
          <line x1="0" y1="2" x2="24" y2="2" stroke="#888780" stroke-width="1.5" stroke-dasharray="4 2"/>
        </svg>累計投資額
      </span>
    </div>

    <!-- グラフ -->
    <svg viewBox="0 0 {SVG_W} {SVG_H}" width="100%" class="overflow-visible">
      <!-- エリア塗り -->
      <path d={chart.areaPath} fill="#1D9E75" fill-opacity="0.15" stroke="none" />
      <!-- 評価額ライン -->
      <path d={chart.linePath} stroke="#0F6E56" stroke-width="1.5" fill="none" />
      <!-- 累計投資額破線 -->
      <path d={chart.investedPath} stroke="#888780" stroke-width="1.5" stroke-dasharray="4 2" fill="none" />
      <!-- 軸ラベル -->
      <text x={chart.xStart} y={SVG_H - 4} font-size="9" fill="#94a3b8" text-anchor="start">0年</text>
      <text x={chart.xEnd} y={SVG_H - 4} font-size="9" fill="#94a3b8" text-anchor="end">{years}年</text>
      <text x={PAD_L - 2} y={PAD_T + 4} font-size="9" fill="#94a3b8" text-anchor="end">{chart.maxLabel}</text>
    </svg>

    <!-- 免責文 -->
    <p class="text-xs text-slate-400 border-t border-slate-100 pt-3">
      ※想定年利は一定と仮定したシミュレーションです。実際の運用成果は市場の変動により異なります。将来の運用成果を示すものではありません。
    </p>
  </div>
```

- [ ] **Step 5: ビルドが通ることを確認**

```
npm run build
```

期待: エラーなし

- [ ] **Step 6: 開発サーバーで動作確認**

```
npm run dev
```

ブラウザで `http://localhost:5173/nisa-accumulation-simulator` を開いて以下を確認:

1. 入力カードが表示され、頻度トグル・投資額テキスト・スライダー2本が正常に動く
2. スライダーを動かすと結果カードの数値がリアルタイムに更新される
3. SVGグラフに評価額（緑エリア＋実線）と累計投資額（グレー破線）が描画される
4. 年利0%にすると評価額と累計投資額の線が重なる
5. ナビゲーションバーに「NISA積立シミュレーター(開発中)」が表示され、クリックでページに遷移する
6. ホームページのツール一覧にも表示される

- [ ] **Step 7: コミット**

```bash
git add src/routes/nisa-accumulation-simulator/+page.svelte
git commit -m "feat: NISA積立シミュレーターのページコンポーネントを追加"
```

---

## Task 4: 全テスト・ビルドの最終確認

**Files:** なし（確認のみ）

- [ ] **Step 1: 全テストを実行**

```
npm test
```

期待: 全テスト PASS（`nisa-accumulation-simulator.test.ts` の13テストを含む）

- [ ] **Step 2: ビルドを実行**

```
npm run build
```

期待: エラーなし

- [ ] **Step 3: 最終コミット（必要な場合）**

未コミットの変更がある場合のみ:

```bash
git add -A
git commit -m "chore: NISA積立シミュレーター追加に伴うビルド確認"
```
