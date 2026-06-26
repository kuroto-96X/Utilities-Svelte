<script lang="ts">
  import { calculate, type CalcResult } from '$lib/investment/nisa-calculator'

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
          aria-pressed={frequency === 'monthly'}
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
          aria-pressed={frequency === 'yearly'}
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
</div>
