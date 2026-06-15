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
</script>

<svelte:head>
  <title>NISA積立シミュレーター</title>
</svelte:head>

<div class="max-w-lg mx-auto px-4 py-6 space-y-4">
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
</div>
