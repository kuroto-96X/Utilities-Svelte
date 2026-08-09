<script lang="ts">
  import { onMount, onDestroy } from 'svelte'
  import { DEFAULT_PARAMS, type ShidasuParams } from '$lib/game/shidasu/params'
  import type { ShopSlotKind } from '$lib/game/shidasu/types'

  let config = $state<ShidasuParams | null>(null)
  let error = $state<string | null>(null)
  let flash = $state<string | null>(null)
  let flashTimer: ReturnType<typeof setTimeout> | null = null

  const PACK_KINDS: ShopSlotKind[] = ['item', 'rite', 'revelation', 'oracle', 'cardSet']
  const PACK_KIND_LABEL: Record<ShopSlotKind, string> = {
    item: '護符', rite: '秘儀', revelation: '天啓', oracle: '神託', cardSet: 'トランプセット',
  }

  function showToast(message: string) {
    if (flashTimer) clearTimeout(flashTimer)
    flash = message
    flashTimer = setTimeout(() => { flash = null }, 2000)
  }

  let hasValidationError = $derived.by(() => {
    if (!config) return false
    return config.shop.packCatalog.some(entry => {
      if (!entry.name.trim()) return true
      if (!Number.isFinite(entry.offerCount) || entry.offerCount < 1) return true
      if (!Number.isFinite(entry.pickCount) || entry.pickCount < 1 || entry.pickCount > entry.offerCount) return true
      if (!Number.isFinite(entry.price) || entry.price < 0) return true
      return false
    })
  })

  function addEntry() {
    if (!config) return
    config.shop.packCatalog = [...config.shop.packCatalog, { name: '', packKind: 'item', offerCount: 3, pickCount: 1, price: 0 }]
  }

  function removeEntry(index: number) {
    if (!config) return
    config.shop.packCatalog = config.shop.packCatalog.filter((_, i) => i !== index)
  }

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
  <title>Shidasu 福袋カタログ設定</title>
</svelte:head>

<div class="max-w-5xl mx-auto px-4 py-8">
  <a href="/admin" class="text-xs text-slate-400 hover:text-teal-600 mb-4 inline-block">← 管理ページ一覧</a>

  <div class="flex items-center justify-between mb-6">
    <h1 class="text-2xl font-bold text-slate-800">星詠みソリティア -Shidasu- 福袋カタログ設定</h1>
    <div class="flex gap-2">
      <button onclick={() => loadConfig(true)} class="text-sm px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors">
        リロード
      </button>
      {#if hasValidationError}
        <p class="text-xs text-red-600 self-center">名前が空、選択肢数が1未満、取得数が範囲外、または価格が負の行があります</p>
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
      <p class="text-xs text-slate-500 mb-3">ショップで抽選される福袋の一覧。同じ内容(種別・選択肢数・取得数・価格)の行を名前だけ変えて複数用意すると、その福袋の出現率を相対的に上げられる(各行の抽選確率は常に均等)。</p>
      <div class="overflow-x-auto">
        <table class="w-full text-xs border border-slate-200 rounded-lg overflow-hidden">
          <thead>
            <tr class="bg-slate-50 text-slate-500">
              <th class="px-2 py-1.5 text-left" style="width:12rem;">名前</th>
              <th class="px-2 py-1.5 text-left" style="width:8rem;">アイテム種別</th>
              <th class="px-2 py-1.5 text-left" style="width:6rem;">選択肢数</th>
              <th class="px-2 py-1.5 text-left" style="width:6rem;">取得数</th>
              <th class="px-2 py-1.5 text-left" style="width:6rem;">価格</th>
              <th class="px-2 py-1.5 text-left" style="width:4rem;"></th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            {#each config.shop.packCatalog as entry, i (i)}
              <tr>
                <td class="px-2 py-1.5 align-top">
                  <input type="text" bind:value={entry.name} class="w-full border border-slate-200 rounded px-1.5 py-0.5" />
                </td>
                <td class="px-2 py-1.5 align-top">
                  <select bind:value={entry.packKind} class="w-full border border-slate-200 rounded px-1.5 py-0.5">
                    {#each PACK_KINDS as kind (kind)}
                      <option value={kind}>{PACK_KIND_LABEL[kind]}</option>
                    {/each}
                  </select>
                </td>
                <td class="px-2 py-1.5 align-top">
                  <input type="number" step="1" bind:value={entry.offerCount} class="w-full border border-slate-200 rounded px-1.5 py-0.5" />
                </td>
                <td class="px-2 py-1.5 align-top">
                  <input type="number" step="1" bind:value={entry.pickCount} class="w-full border border-slate-200 rounded px-1.5 py-0.5" />
                </td>
                <td class="px-2 py-1.5 align-top">
                  <input type="number" step="1" bind:value={entry.price} class="w-full border border-slate-200 rounded px-1.5 py-0.5" />
                </td>
                <td class="px-2 py-1.5 align-top">
                  <button onclick={() => removeEntry(i)} class="text-slate-400 hover:text-red-600">削除</button>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
      <button onclick={addEntry} class="mt-3 text-sm px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors">
        + 行を追加
      </button>
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
