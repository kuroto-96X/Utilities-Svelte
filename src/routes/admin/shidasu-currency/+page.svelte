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
    if (!Number.isFinite(config.shop.itemPrice.C.buy) || config.shop.itemPrice.C.buy < 0) return true
    if (!Number.isFinite(config.shop.itemPrice.C.sell) || config.shop.itemPrice.C.sell < 0) return true
    if (!Number.isFinite(config.shop.itemPrice.U.buy) || config.shop.itemPrice.U.buy < 0) return true
    if (!Number.isFinite(config.shop.itemPrice.U.sell) || config.shop.itemPrice.U.sell < 0) return true
    if (!Number.isFinite(config.shop.itemPrice.R.buy) || config.shop.itemPrice.R.buy < 0) return true
    if (!Number.isFinite(config.shop.itemPrice.R.sell) || config.shop.itemPrice.R.sell < 0) return true
    if (!Number.isFinite(config.shop.ritePrice.buy) || config.shop.ritePrice.buy < 0) return true
    if (!Number.isFinite(config.shop.ritePrice.sell) || config.shop.ritePrice.sell < 0) return true
    if (!Number.isFinite(config.shop.revelationPrice.buy) || config.shop.revelationPrice.buy < 0) return true
    if (!Number.isFinite(config.shop.revelationPrice.sell) || config.shop.revelationPrice.sell < 0) return true
    if (!Number.isFinite(config.shop.oraclePrice.buy) || config.shop.oraclePrice.buy < 0) return true
    if (!Number.isFinite(config.shop.oraclePrice.sell) || config.shop.oraclePrice.sell < 0) return true
    if (!Number.isFinite(config.shop.packPrice.item.threeOne) || config.shop.packPrice.item.threeOne < 0) return true
    if (!Number.isFinite(config.shop.packPrice.item.fiveOne) || config.shop.packPrice.item.fiveOne < 0) return true
    if (!Number.isFinite(config.shop.packPrice.item.sevenTwo) || config.shop.packPrice.item.sevenTwo < 0) return true
    if (!Number.isFinite(config.shop.packPrice.rite.threeOne) || config.shop.packPrice.rite.threeOne < 0) return true
    if (!Number.isFinite(config.shop.packPrice.rite.fiveOne) || config.shop.packPrice.rite.fiveOne < 0) return true
    if (!Number.isFinite(config.shop.packPrice.rite.sevenTwo) || config.shop.packPrice.rite.sevenTwo < 0) return true
    if (!Number.isFinite(config.shop.packPrice.revelation.threeOne) || config.shop.packPrice.revelation.threeOne < 0) return true
    if (!Number.isFinite(config.shop.packPrice.revelation.fiveOne) || config.shop.packPrice.revelation.fiveOne < 0) return true
    if (!Number.isFinite(config.shop.packPrice.revelation.sevenTwo) || config.shop.packPrice.revelation.sevenTwo < 0) return true
    if (!Number.isFinite(config.shop.packPrice.oracle.threeOne) || config.shop.packPrice.oracle.threeOne < 0) return true
    if (!Number.isFinite(config.shop.packPrice.oracle.fiveOne) || config.shop.packPrice.oracle.fiveOne < 0) return true
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

    <section class="bg-white border border-slate-200 rounded-xl p-4 space-y-4">
      <h2 class="text-sm font-bold text-slate-700">ショップ価格設定</h2>

      <div>
        <p class="text-xs text-slate-500 mb-1">護符バラ売り(レアリティ別)</p>
        <div class="grid grid-cols-3 gap-3">
          <label class="text-xs text-slate-500">
            C 購入額
            <input type="number" step="1" bind:value={config.shop.itemPrice.C.buy} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            U 購入額
            <input type="number" step="1" bind:value={config.shop.itemPrice.U.buy} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            R 購入額
            <input type="number" step="1" bind:value={config.shop.itemPrice.R.buy} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            C 売却額
            <input type="number" step="1" bind:value={config.shop.itemPrice.C.sell} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            U 売却額
            <input type="number" step="1" bind:value={config.shop.itemPrice.U.sell} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            R 売却額
            <input type="number" step="1" bind:value={config.shop.itemPrice.R.sell} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
        </div>
      </div>

      <div>
        <p class="text-xs text-slate-500 mb-1">秘儀・天啓・神託バラ売り</p>
        <div class="grid grid-cols-2 gap-3">
          <label class="text-xs text-slate-500">
            秘儀 購入額
            <input type="number" step="1" bind:value={config.shop.ritePrice.buy} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            秘儀 売却額
            <input type="number" step="1" bind:value={config.shop.ritePrice.sell} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            天啓 購入額
            <input type="number" step="1" bind:value={config.shop.revelationPrice.buy} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            天啓 売却額
            <input type="number" step="1" bind:value={config.shop.revelationPrice.sell} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            神託 購入額
            <input type="number" step="1" bind:value={config.shop.oraclePrice.buy} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            神託 売却額
            <input type="number" step="1" bind:value={config.shop.oraclePrice.sell} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
        </div>
      </div>

      <div>
        <p class="text-xs text-slate-500 mb-1">福袋価格(護符・秘儀・天啓は3-1/5-1/7-2、神託は3-1/5-1のみ)</p>
        <div class="grid grid-cols-3 gap-3">
          <label class="text-xs text-slate-500">
            護符 3-1
            <input type="number" step="1" bind:value={config.shop.packPrice.item.threeOne} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            護符 5-1
            <input type="number" step="1" bind:value={config.shop.packPrice.item.fiveOne} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            護符 7-2
            <input type="number" step="1" bind:value={config.shop.packPrice.item.sevenTwo} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            秘儀 3-1
            <input type="number" step="1" bind:value={config.shop.packPrice.rite.threeOne} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            秘儀 5-1
            <input type="number" step="1" bind:value={config.shop.packPrice.rite.fiveOne} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            秘儀 7-2
            <input type="number" step="1" bind:value={config.shop.packPrice.rite.sevenTwo} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            天啓 3-1
            <input type="number" step="1" bind:value={config.shop.packPrice.revelation.threeOne} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            天啓 5-1
            <input type="number" step="1" bind:value={config.shop.packPrice.revelation.fiveOne} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            天啓 7-2
            <input type="number" step="1" bind:value={config.shop.packPrice.revelation.sevenTwo} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            神託 3-1
            <input type="number" step="1" bind:value={config.shop.packPrice.oracle.threeOne} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            神託 5-1
            <input type="number" step="1" bind:value={config.shop.packPrice.oracle.fiveOne} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
        </div>
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
