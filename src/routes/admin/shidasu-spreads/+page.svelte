<script lang="ts">
  import { onMount, onDestroy } from 'svelte'
  import { DEFAULT_PARAMS, SPREAD_IDS, type ShidasuParams } from '$lib/game/shidasu/params'
  import type { SpreadId, ShopSlotKind, Rank } from '$lib/game/shidasu/types'

  let config = $state<ShidasuParams | null>(null)
  let error = $state<string | null>(null)
  let flash = $state<string | null>(null)
  let flashTimer: ReturnType<typeof setTimeout> | null = null

  const SHOP_SLOT_KIND_OPTIONS: ShopSlotKind[] = ['item', 'rite', 'revelation', 'oracle', 'cardSet']
  const SHOP_SLOT_KIND_LABELS: Record<ShopSlotKind, string> = {
    item: '護符',
    rite: '秘儀',
    revelation: '天啓',
    oracle: '神託',
    cardSet: 'トランプセット',
  }

  const RANK_OPTIONS: Rank[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]
  const RANK_LABELS: Record<Rank, string> = {
    0: '',
    1: 'A', 2: '2', 3: '3', 4: '4', 5: '5', 6: '6', 7: '7', 8: '8', 9: '9', 10: '10', 11: 'J', 12: 'Q', 13: 'K',
  }

  function showToast(message: string) {
    if (flashTimer) clearTimeout(flashTimer)
    flash = message
    flashTimer = setTimeout(() => { flash = null }, 2000)
  }

  function spreadEntry(id: SpreadId) {
    return config!.spreads[id]
  }

  // チェックボックスのON/OFFに応じて、対象種別をbannedShopKinds配列に追加/削除する。
  function toggleBannedShopKind(id: SpreadId, kind: ShopSlotKind, checked: boolean) {
    const entry = spreadEntry(id)
    if (checked) {
      if (!entry.bannedShopKinds.includes(kind)) entry.bannedShopKinds = [...entry.bannedShopKinds, kind]
    } else {
      entry.bannedShopKinds = entry.bannedShopKinds.filter(k => k !== kind)
    }
  }

  // チェックボックスのON/OFFに応じて、対象ランクをexcludedRanks配列に追加/削除する。
  function toggleExcludedRank(id: SpreadId, rank: Rank, checked: boolean) {
    const entry = spreadEntry(id)
    if (checked) {
      if (!entry.excludedRanks.includes(rank)) entry.excludedRanks = [...entry.excludedRanks, rank]
    } else {
      entry.excludedRanks = entry.excludedRanks.filter(r => r !== rank)
    }
  }

  let hasValidationError = $derived.by(() => {
    if (!config) return false
    return SPREAD_IDS.some(id => {
      const entry = spreadEntry(id)
      if (!entry.name.trim()) return true
      if (!entry.desc.trim()) return true
      if (!Number.isFinite(entry.initialExtraTableauRows)) return true
      if (!Number.isFinite(entry.deckMultiplier)) return true
      if (!Number.isFinite(entry.tableauRowMultiplier)) return true
      if (!Number.isFinite(entry.targetScoreMultiplier)) return true
      if (!Number.isFinite(entry.initialOracleLevel)) return true
      if (!Number.isFinite(entry.initialCurrencyBonus)) return true
      if (!Number.isFinite(entry.initialItemCapacityBonus)) return true
      return false
    })
  })

  async function loadConfig(toast = false) {
    try {
      const res = await fetch('/api/admin/shidasu-config')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      config = await res.json() as ShidasuParams
      error = null
      if (toast) showToast('リロードしました')
    } catch {
      error = 'Shidasu設定APIに接続できません。npm run dev で起動してください。'
      if (!config) config = JSON.parse(JSON.stringify(DEFAULT_PARAMS))
    }
  }

  async function save() {
    if (!config) return
    try {
      const res = await fetch('/api/admin/shidasu-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      showToast('保存しました(反映には再ビルド・再デプロイが必要です)')
    } catch {
      error = '保存に失敗しました'
    }
  }

  onMount(() => loadConfig())
  onDestroy(() => {
    if (flashTimer) clearTimeout(flashTimer)
  })
</script>

<svelte:head>
  <title>Shidasu スプレッド設定</title>
</svelte:head>

<div class="max-w-6xl mx-auto px-4 py-8">
  <a href="/admin" class="text-xs text-slate-400 hover:text-teal-600 mb-4 inline-block">← 管理ページ一覧</a>

  <div class="flex items-center justify-between mb-6">
    <h1 class="text-2xl font-bold text-slate-800">星詠みソリティア -Shidasu- スプレッド設定</h1>
    <div class="flex gap-2">
      <button onclick={() => loadConfig(true)} class="text-sm px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors">
        リロード
      </button>
      {#if hasValidationError}
        <p class="text-xs text-red-600 self-center">名前・説明文が未入力、または数値パラメータが不正な項目があります</p>
      {/if}
      <button
        onclick={save}
        disabled={hasValidationError || !config}
        class="text-sm px-3 py-1.5 rounded-lg bg-teal-600 text-white hover:bg-teal-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        保存
      </button>
    </div>
  </div>

  {#if error}
    <div class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">{error}</div>
  {/if}

  {#if config}
    <section class="bg-white border border-slate-200 rounded-xl p-4">
      <div class="overflow-x-auto">
        <table class="w-full text-xs border border-slate-200 rounded-lg overflow-hidden">
          <thead>
            <tr class="bg-slate-50 text-slate-500">
              <th class="px-2 py-1.5 text-left" style="width:6rem;">id</th>
              <th class="px-2 py-1.5 text-left" style="width:6rem;">名称</th>
              <th class="px-2 py-1.5 text-left" style="width:16rem;">説明文</th>
              <th class="px-2 py-1.5 text-left" style="width:7rem;">初期行数オフセット</th>
              <th class="px-2 py-1.5 text-left" style="width:7rem;">デッキ枚数倍率</th>
              <th class="px-2 py-1.5 text-left" style="width:7rem;">場札行倍率</th>
              <th class="px-2 py-1.5 text-left" style="width:7rem;">目標スコア倍率</th>
              <th class="px-2 py-1.5 text-left" style="width:7rem;">神託初期レベル</th>
              <th class="px-2 py-1.5 text-left" style="width:7rem;">初期所持金オフセット</th>
              <th class="px-2 py-1.5 text-left" style="width:7rem;">護符所持スロットオフセット</th>
              <th class="px-2 py-1.5 text-left" style="width:12rem;">ショップ非販売種別</th>
              <th class="px-2 py-1.5 text-left" style="width:16rem;">除外ランク</th>
              <th class="px-2 py-1.5 text-left" style="width:7rem;">黒赤スート統一</th>
              <th class="px-2 py-1.5 text-left" style="width:7rem;">デッキランダム化</th>
              <th class="px-2 py-1.5 text-left" style="width:7rem;">スート別ワイルド化</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            {#each SPREAD_IDS as id (id)}
              {@const entry = spreadEntry(id)}
              <tr>
                <td class="px-2 py-1.5 align-top text-slate-400 font-mono">{id}</td>
                <td class="px-2 py-1.5 align-top">
                  <input type="text" bind:value={entry.name} class="w-full border border-slate-200 rounded px-1.5 py-0.5" />
                </td>
                <td class="px-2 py-1.5 align-top">
                  <textarea bind:value={entry.desc} rows="2" class="w-full border border-slate-200 rounded px-1.5 py-0.5 font-mono text-[11px] resize-y"></textarea>
                </td>
                <td class="px-2 py-1.5 align-top">
                  <input type="number" step="any" bind:value={entry.initialExtraTableauRows} class="w-full border border-slate-200 rounded px-1 py-0.5" />
                </td>
                <td class="px-2 py-1.5 align-top">
                  <input type="number" step="any" bind:value={entry.deckMultiplier} class="w-full border border-slate-200 rounded px-1 py-0.5" />
                </td>
                <td class="px-2 py-1.5 align-top">
                  <input type="number" step="any" bind:value={entry.tableauRowMultiplier} class="w-full border border-slate-200 rounded px-1 py-0.5" />
                </td>
                <td class="px-2 py-1.5 align-top">
                  <input type="number" step="any" bind:value={entry.targetScoreMultiplier} class="w-full border border-slate-200 rounded px-1 py-0.5" />
                </td>
                <td class="px-2 py-1.5 align-top">
                  <input type="number" step="any" bind:value={entry.initialOracleLevel} class="w-full border border-slate-200 rounded px-1 py-0.5" />
                </td>
                <td class="px-2 py-1.5 align-top">
                  <input type="number" step="any" bind:value={entry.initialCurrencyBonus} class="w-full border border-slate-200 rounded px-1 py-0.5" />
                </td>
                <td class="px-2 py-1.5 align-top">
                  <input type="number" step="any" bind:value={entry.initialItemCapacityBonus} class="w-full border border-slate-200 rounded px-1 py-0.5" />
                </td>
                <td class="px-2 py-1.5 align-top">
                  <div class="flex flex-col gap-0.5">
                    {#each SHOP_SLOT_KIND_OPTIONS as kind (kind)}
                      <label class="flex items-center gap-1 text-[11px] text-slate-600">
                        <input
                          type="checkbox"
                          checked={entry.bannedShopKinds.includes(kind)}
                          onchange={(e) => toggleBannedShopKind(id, kind, e.currentTarget.checked)}
                        />
                        {SHOP_SLOT_KIND_LABELS[kind]}
                      </label>
                    {/each}
                  </div>
                </td>
                <td class="px-2 py-1.5 align-top">
                  <div class="flex flex-wrap gap-x-2 gap-y-0.5">
                    {#each RANK_OPTIONS as rank (rank)}
                      <label class="flex items-center gap-1 text-[11px] text-slate-600">
                        <input
                          type="checkbox"
                          checked={entry.excludedRanks.includes(rank)}
                          onchange={(e) => toggleExcludedRank(id, rank, e.currentTarget.checked)}
                        />
                        {RANK_LABELS[rank]}
                      </label>
                    {/each}
                  </div>
                </td>
                <td class="px-2 py-1.5 align-top">
                  <input type="checkbox" bind:checked={entry.unifyBlackRedSuits} />
                </td>
                <td class="px-2 py-1.5 align-top">
                  <input type="checkbox" bind:checked={entry.randomizeDeck} />
                </td>
                <td class="px-2 py-1.5 align-top">
                  <input type="checkbox" bind:checked={entry.randomizeWildPerSuit} />
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </section>
  {:else if !error}
    <p class="text-slate-500 text-sm">読み込み中...</p>
  {/if}
</div>

{#if flash}
  <div class="fixed bottom-6 right-6 bg-slate-800 text-white text-sm px-4 py-2.5 rounded-lg shadow-lg z-50">
    {flash}
  </div>
{/if}
