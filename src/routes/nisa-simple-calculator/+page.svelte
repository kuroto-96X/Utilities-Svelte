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
