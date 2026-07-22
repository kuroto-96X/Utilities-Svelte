<script lang="ts">
  import { onMount, onDestroy } from 'svelte'
  import { DEFAULT_PARAMS, type ShidasuParams } from '$lib/game/shidasu/params'

  let config = $state<ShidasuParams | null>(null)
  let error = $state<string | null>(null)
  let flash = $state<string | null>(null)
  let flashTimer: ReturnType<typeof setTimeout> | null = null

  function showToast(message: string) {
    if (flashTimer) clearTimeout(flashTimer)
    flash = message
    flashTimer = setTimeout(() => { flash = null }, 2000)
  }

  let hasValidationError = $derived.by(() => {
    if (!config) return false
    if (!config.currency.name.trim()) return true
    if (!config.currency.symbol.trim()) return true
    if (!Number.isFinite(config.currency.initialAmount) || config.currency.initialAmount < 0) return true
    if (!Number.isFinite(config.currency.waveClearAmount) || config.currency.waveClearAmount < 0) return true
    if (!Number.isFinite(config.currency.bossBonus.shoukyou) || config.currency.bossBonus.shoukyou < 0) return true
    if (!Number.isFinite(config.currency.bossBonus.chuukyou) || config.currency.bossBonus.chuukyou < 0) return true
    if (!Number.isFinite(config.currency.bossBonus.taikyou) || config.currency.bossBonus.taikyou < 0) return true
    return false
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
  <title>Shidasu 通貨設定</title>
</svelte:head>

<div class="max-w-lg mx-auto px-4 py-8">
  <a href="/admin" class="text-xs text-slate-400 hover:text-teal-600 mb-4 inline-block">← 管理ページ一覧</a>

  <div class="flex items-center justify-between mb-6">
    <h1 class="text-2xl font-bold text-slate-800">星詠みソリティア -Shidasu- 通貨設定</h1>
    <div class="flex gap-2">
      <button onclick={() => loadConfig(true)} class="text-sm px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors">
        リロード
      </button>
      {#if hasValidationError}
        <p class="text-xs text-red-600 self-center">名称・記号が空、または数値項目が未入力・0未満です</p>
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
    <section class="bg-white border border-slate-200 rounded-xl p-4 space-y-4">
      <div class="grid grid-cols-2 gap-3">
        <label class="text-xs text-slate-500">
          名称
          <input type="text" bind:value={config.currency.name} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
        </label>
        <label class="text-xs text-slate-500">
          記号
          <input type="text" bind:value={config.currency.symbol} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
        </label>
      </div>

      <label class="block text-xs text-slate-500">
        ラン開始時の初期所持数
        <input type="number" step="1" bind:value={config.currency.initialAmount} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
      </label>

      <label class="block text-xs text-slate-500">
        Waveクリア時の獲得数(ボスWaveも含め毎回付与される基礎分)
        <input type="number" step="1" bind:value={config.currency.waveClearAmount} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
      </label>

      <div class="grid grid-cols-3 gap-3">
        <label class="text-xs text-slate-500">
          小凶ボスボーナス
          <input type="number" step="1" bind:value={config.currency.bossBonus.shoukyou} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
        </label>
        <label class="text-xs text-slate-500">
          中凶ボスボーナス
          <input type="number" step="1" bind:value={config.currency.bossBonus.chuukyou} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
        </label>
        <label class="text-xs text-slate-500">
          大凶ボスボーナス
          <input type="number" step="1" bind:value={config.currency.bossBonus.taikyou} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
        </label>
      </div>

      <p class="text-xs text-slate-400">
        ボスボーナスはWaveクリア時の獲得数に加算されます(例: 小凶ボスWaveクリア時の獲得数 = Waveクリア時の獲得数 + 小凶ボスボーナス)。
      </p>
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
