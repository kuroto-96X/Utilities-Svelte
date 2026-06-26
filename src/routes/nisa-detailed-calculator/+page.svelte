<script lang="ts">
  import {
    calculateDetailed,
    type DetailedCalcResult,
    type Frequency,
    type InvestmentRecord
  } from '$lib/investment/nisa-detailed-calculator'

  type EditableRecord = {
    id: string
    startMonth: string
    frequency: Frequency
    amountStr: string
  }

  type FullResult = Exclude<DetailedCalcResult, null | { error: string }>

  let records = $state<EditableRecord[]>([
    { id: 'record-1', startMonth: '2022-01', frequency: 'monthly', amountStr: '10000' },
    { id: 'record-2', startMonth: '2024-04', frequency: 'monthly', amountStr: '30000' }
  ])
  let nextRecordNumber = $state(3)
  let currentValueStr = $state('1500000')
  let referenceRate = $state(6.0)

  const investmentRecords: InvestmentRecord[] = $derived(
    records.map(record => ({
      id: record.id,
      startMonth: record.startMonth,
      frequency: record.frequency,
      amount: parseFloat(record.amountStr)
    }))
  )

  const result: DetailedCalcResult = $derived(
    calculateDetailed(investmentRecords, parseFloat(currentValueStr), referenceRate)
  )

  const fullResult: FullResult | null = $derived.by(() => {
    if (!result || 'error' in result) return null
    return result
  })

  const todayMonth = new Date().toISOString().slice(0, 7)

  function addRecord() {
    records = [
      ...records,
      {
        id: `record-${nextRecordNumber}`,
        startMonth: todayMonth,
        frequency: 'monthly',
        amountStr: '30000'
      }
    ]
    nextRecordNumber += 1
  }

  function updateRecord(id: string, updates: Partial<Omit<EditableRecord, 'id'>>) {
    records = records.map(record => (record.id === id ? { ...record, ...updates } : record))
  }

  function deleteRecord(id: string) {
    if (records.length <= 1) return
    records = records.filter(record => record.id !== id)
  }

  function toMan(yen: number): string {
    return Math.round(yen / 10000).toLocaleString()
  }

  function yen(yenValue: number): string {
    return Math.round(yenValue).toLocaleString()
  }

  function paceLabel(result: FullResult): string {
    const suffix = result.latestFrequency === 'monthly' ? '月' : '年'
    return `${yen(result.latestAmount)}円 / ${suffix}`
  }
</script>

<svelte:head>
  <title>NISA詳細年率計算</title>
</svelte:head>

<div class="max-w-lg mx-auto px-4 py-6 space-y-4">
  <h1 class="text-lg font-bold text-slate-800">NISA詳細年率計算</h1>

  <div class="bg-white rounded-xl shadow-sm p-4 space-y-4">
    <div class="space-y-1">
      <h2 class="text-sm font-semibold text-slate-700">投資記録</h2>
      <p class="text-xs leading-relaxed text-slate-500">
        開始年月以降、次の記録の開始年月になるまで、その投資額・頻度を継続したものとして計算します。
      </p>
    </div>

    <div class="space-y-3">
      {#each records as record, index (record.id)}
        <div class="rounded-xl border border-slate-100 bg-slate-50/60 p-3 space-y-3">
          <div class="flex items-center justify-between">
            <p class="text-xs font-semibold text-slate-500">記録 {index + 1}</p>
            <button
              type="button"
              class="rounded-lg px-2 py-1 text-xs font-medium text-slate-500 transition-colors hover:bg-white hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-slate-500"
              disabled={records.length === 1}
              onclick={() => deleteRecord(record.id)}
              aria-label="投資記録を削除"
            >
              削除
            </button>
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-xs text-slate-500 mb-1" for={`${record.id}-month`}>
                開始年月
              </label>
              <input
                id={`${record.id}-month`}
                type="month"
                value={record.startMonth}
                max={todayMonth}
                oninput={event =>
                  updateRecord(record.id, { startMonth: event.currentTarget.value })}
                class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>

            <div>
              <label class="block text-xs text-slate-500 mb-1" for={`${record.id}-frequency`}>
                頻度
              </label>
              <select
                id={`${record.id}-frequency`}
                value={record.frequency}
                oninput={event =>
                  updateRecord(record.id, { frequency: event.currentTarget.value as Frequency })}
                class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                <option value="monthly">毎月</option>
                <option value="yearly">毎年</option>
              </select>
            </div>
          </div>

          <div>
            <label class="block text-xs text-slate-500 mb-1" for={`${record.id}-amount`}>
              投資額（円）
            </label>
            <input
              id={`${record.id}-amount`}
              type="text"
              inputmode="decimal"
              value={record.amountStr}
              oninput={event =>
                updateRecord(record.id, { amountStr: event.currentTarget.value })}
              class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
        </div>
      {/each}
    </div>

    <button
      type="button"
      class="w-full rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 text-sm font-semibold text-teal-700 transition-colors hover:bg-teal-100"
      onclick={addRecord}
    >
      ＋ 投資記録を追加
    </button>

    {#if fullResult?.hasDuplicateStartMonth}
      <p class="text-sm text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
        同じ開始年月の記録が複数あります。入力内容をご確認ください。
      </p>
    {/if}

    <div class="border-t border-slate-100 pt-4">
      <label class="block text-xs text-slate-500 mb-1" for="current-value">
        現在の評価額（円）
      </label>
      <input
        id="current-value"
        type="text"
        inputmode="decimal"
        bind:value={currentValueStr}
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
              {yen(fullResult.totalInvested)}<span class="text-xs font-normal ml-0.5">円</span>
            </p>
          </div>
          <div class="bg-slate-50 rounded-xl p-3">
            <p class="text-xs text-slate-500 mb-1">直近の投資ペース</p>
            <p class="text-lg font-bold text-slate-700">{paceLabel(fullResult)}</p>
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
          <label class="text-xs text-slate-500" for="reference-rate">参考年率</label>
          <span class="text-sm font-bold text-slate-700">{referenceRate.toFixed(1)}%</span>
        </div>
        <input
          id="reference-rate"
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
                ご自身の年率<br /><span class="text-teal-700 font-semibold">
                  {fullResult.annualReturn.toFixed(1)}%
                </span>
              </th>
              <th class="text-right text-xs text-slate-500 font-normal pb-2 pl-2">
                参考年率<br /><span class="text-slate-700 font-semibold">
                  {referenceRate.toFixed(1)}%
                </span>
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
                  {toMan(fullResult.futures.nisaMax.currentValue ?? 0)}<span class="text-xs text-slate-400 ml-0.5">万円</span>
                </td>
                <td class="py-2 pl-2 text-right text-xs text-slate-400">-</td>
              {:else}
                <td class="py-2 pr-2 text-xs text-slate-600">
                  NISA満額到達時
                  {#if fullResult.futures.nisaMax.veryLong}
                    <span class="block text-amber-600">（参考値・長期）</span>
                  {/if}
                </td>
                <td class="py-2 px-2 text-right font-medium">
                  {toMan(fullResult.futures.nisaMax.own ?? 0)}<span class="text-xs text-slate-400 ml-0.5">万円</span>
                </td>
                <td class="py-2 pl-2 text-right font-medium">
                  {toMan(fullResult.futures.nisaMax.ref ?? 0)}<span class="text-xs text-slate-400 ml-0.5">万円</span>
                </td>
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
