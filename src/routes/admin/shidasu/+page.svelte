<script lang="ts">
  import { onMount, onDestroy } from 'svelte'
  import { DEFAULT_PARAMS, type ShidasuParams } from '$lib/game/shidasu/params'
  import LayoutSection from './LayoutSection.svelte'
  import ItemsSection from './ItemsSection.svelte'
  import ScoringSection from './ScoringSection.svelte'
  import RoleBonusSection from './RoleBonusSection.svelte'
  import StagesSection from './StagesSection.svelte'
  import FlowUiSection from './FlowUiSection.svelte'

  let config = $state<ShidasuParams | null>(null)
  let error = $state<string | null>(null)
  let flash = $state<string | null>(null)
  let flashTimer: ReturnType<typeof setTimeout> | null = null
  let jsonText = $state('')
  let jsonError = $state<string | null>(null)

  function showToast(message: string) {
    if (flashTimer) clearTimeout(flashTimer)
    flash = message
    flashTimer = setTimeout(() => { flash = null }, 2000)
  }

  let hasValidationError = $derived.by(() => {
    if (!config) return false
    if (config.stages.length < 1) return true
    for (const stage of config.stages) {
      if (stage.targets.some(t => !Number.isFinite(t) || t < 0)) return true
    }
    // 場札(cols×rows)配布後にfoundation用の1枚が残らないと山札が尽きてゲームが起動できない
    if (config.layout.cols < 1 || config.layout.rows < 1) return true
    if (config.layout.cols * config.layout.rows > 51) return true
    if (!Number.isFinite(config.ui.chainCardsPerRow) || config.ui.chainCardsPerRow < 1) return true
    if (!Number.isFinite(config.ui.chainCardOffsetX) || config.ui.chainCardOffsetX < 0) return true
    if (!Number.isFinite(config.items.maxItems) || config.items.maxItems < 1) return true
    if (!Number.isFinite(config.scoring.suitColorMinLen) || config.scoring.suitColorMinLen < 1) return true
    if (!Number.isFinite(config.talismans.morningMist.x) || config.talismans.morningMist.x <= 0) return true
    return false
  })

  let targetsNotAscending = $derived.by(() => {
    if (!config) return false
    return config.stages.some(s => !(s.targets[0] < s.targets[1] && s.targets[1] < s.targets[2]))
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

  function resetToDefault() {
    if (!confirm('既定値に戻しますか?')) return
    config = JSON.parse(JSON.stringify(DEFAULT_PARAMS))
  }

  function openJsonPanel() {
    if (!config) return
    jsonText = JSON.stringify(config, null, 2)
    jsonError = null
  }

  function isValidShidasuParams(value: unknown): value is ShidasuParams {
    if (typeof value !== 'object' || value === null) return false
    const v = value as Record<string, unknown>
    return (
      typeof v.layout === 'object' && v.layout !== null &&
      typeof v.scoring === 'object' && v.scoring !== null &&
      Array.isArray(v.stages) && v.stages.length >= 1 &&
      typeof v.items === 'object' && v.items !== null &&
      typeof v.flow === 'object' && v.flow !== null &&
      typeof v.ui === 'object' && v.ui !== null &&
      typeof v.talismans === 'object' && v.talismans !== null
    )
  }

  function applyJson() {
    try {
      const parsed = JSON.parse(jsonText)
      if (!isValidShidasuParams(parsed)) {
        jsonError = '必須項目(layout/scoring/stages/items/flow/ui)が不足しています'
        return
      }
      config = parsed
      jsonError = null
      showToast('JSONを適用しました')
    } catch {
      jsonError = 'JSONの形式が正しくありません'
    }
  }

  onMount(() => loadConfig())
  onDestroy(() => {
    if (flashTimer) clearTimeout(flashTimer)
  })
</script>

<div class="max-w-3xl mx-auto px-4 py-8">
  <a href="/admin" class="text-xs text-slate-400 hover:text-teal-600 mb-4 inline-block">← 管理ページ一覧</a>

  <div class="flex items-center justify-between mb-6">
    <h1 class="text-2xl font-bold text-slate-800">星詠みソリティア -Shidasu- 設定</h1>
    <div class="flex gap-2">
      <button onclick={() => loadConfig(true)} class="text-sm px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors">
        リロード
      </button>
      {#if hasValidationError}
        <p class="text-xs text-red-600 self-center">入力値が不正です</p>
      {:else if targetsNotAscending}
        <p class="text-xs text-amber-600 self-center">目標スコアが昇順ではありません</p>
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
    <div class="space-y-6">
      <LayoutSection {config} />

      <ScoringSection {config} />

      <RoleBonusSection {config} />

      <StagesSection {config} />

      <ItemsSection {config} />

      <p class="text-xs text-slate-400 px-1">
        護符ごとの名前・パラメータ・説明文は
        <a href="/admin/shidasu-talismans" class="text-teal-600 hover:underline">護符パラメータ設定ページ</a>
        に移動しました。
      </p>

      <FlowUiSection {config} />

      <section class="bg-white border border-slate-200 rounded-xl p-4">
        <div class="flex items-center justify-between mb-3">
          <h2 class="font-semibold text-slate-700 text-sm">JSON入出力</h2>
          <button onclick={openJsonPanel} class="text-xs px-2.5 py-1 rounded border border-slate-200 text-slate-500 hover:border-teal-400 hover:text-teal-600">現在値を表示</button>
        </div>
        <textarea bind:value={jsonText} rows="10" class="w-full border border-slate-200 rounded px-2 py-1.5 text-xs font-mono"></textarea>
        {#if jsonError}
          <p class="text-xs text-red-600 mt-1">{jsonError}</p>
        {/if}
        <button onclick={applyJson} class="mt-2 text-xs px-3 py-1 rounded bg-slate-700 text-white hover:bg-slate-800">貼り付けを適用</button>
      </section>

      <div class="flex justify-end">
        <button onclick={resetToDefault} class="text-xs px-3 py-1 rounded border border-slate-200 text-slate-400 hover:border-amber-400 hover:text-amber-600 transition-colors">
          デフォルトに戻す
        </button>
      </div>
    </div>
  {:else if !error}
    <p class="text-slate-500 text-sm">読み込み中...</p>
  {/if}
</div>

{#if flash}
  <div class="fixed bottom-6 right-6 bg-slate-800 text-white text-sm px-4 py-2.5 rounded-lg shadow-lg z-50">
    {flash}
  </div>
{/if}
