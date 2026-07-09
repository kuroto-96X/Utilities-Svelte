<script lang="ts">
  import { onMount, onDestroy } from 'svelte'
  import { DEFAULT_PARAMS, type ShidasuParams } from '$lib/game/shidasu/params'

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

  function addStage() {
    if (!config) return
    config.stages.push({ name: `STAGE ${config.stages.length + 1}`, modifier: 'none', targets: [100, 200, 300] })
  }

  function removeStage(index: number) {
    if (!config) return
    if (config.stages.length <= 1) return
    config.stages.splice(index, 1)
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
      typeof v.ui === 'object' && v.ui !== null
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

  function setScoring<K extends keyof ShidasuParams['scoring']>(key: K, value: number) {
    if (!config) return
    config.scoring[key] = value as ShidasuParams['scoring'][K]
  }

  function setItems<K extends keyof ShidasuParams['items']>(key: K, value: number) {
    if (!config) return
    config.items[key] = value as ShidasuParams['items'][K]
  }

  function setTarget(stageIndex: number, targetIndex: 0 | 1 | 2, value: number) {
    if (!config) return
    config.stages[stageIndex].targets[targetIndex] = value
  }

  onMount(() => loadConfig())
  onDestroy(() => {
    if (flashTimer) clearTimeout(flashTimer)
  })
</script>

{#snippet scaledNumberInput(value: number, onChange: (v: number) => void)}
  <div class="mt-1 flex items-center gap-1">
    <input
      type="number"
      min="0"
      step="1"
      value={value / 10}
      oninput={(e) => onChange(Number((e.target as HTMLInputElement).value) * 10)}
      class="w-full border border-slate-200 rounded px-2 py-1 text-sm"
    />
    <span class="text-slate-400 font-mono text-sm select-none" title="点数系パラメータは常に10の倍数">0</span>
  </div>
{/snippet}

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
      <section class="bg-white border border-slate-200 rounded-xl p-4">
        <h2 class="font-semibold text-slate-700 text-sm mb-3">レイアウト</h2>
        <div class="grid grid-cols-2 gap-3">
          <label class="text-xs text-slate-500">
            列数(cols)
            <input type="number" min="1" step="1" bind:value={config.layout.cols} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            段数(rows)
            <input type="number" min="1" step="1" bind:value={config.layout.rows} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
        </div>
      </section>

      <section class="bg-white border border-slate-200 rounded-xl p-4">
        <h2 class="font-semibold text-slate-700 text-sm mb-3">スコアリング</h2>
        <div class="grid grid-cols-2 gap-3">
          <label class="text-xs text-slate-500">
            基礎点(basePoint)
            {@render scaledNumberInput(config.scoring.basePoint, v => setScoring('basePoint', v))}
          </label>
          <label class="text-xs text-slate-500">
            同スートボーナス(suitBonus)
            {@render scaledNumberInput(config.scoring.suitBonus, v => setScoring('suitBonus', v))}
          </label>
          <label class="text-xs text-slate-500">
            同色ボーナス(colorBonus)
            {@render scaledNumberInput(config.scoring.colorBonus, v => setScoring('colorBonus', v))}
          </label>
          <label class="text-xs text-slate-500">
            階段ボーナス(stairBonus)
            {@render scaledNumberInput(config.scoring.stairBonus, v => setScoring('stairBonus', v))}
          </label>
          <label class="text-xs text-slate-500">
            階段成立枚数(stairMinLen)
            <input type="number" min="2" step="1" bind:value={config.scoring.stairMinLen} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            ワイルド直後ボーナス(wildSuitBonus)
            {@render scaledNumberInput(config.scoring.wildSuitBonus, v => setScoring('wildSuitBonus', v))}
          </label>
          <label class="text-xs text-slate-500">
            全消しボーナス(clearBonus)
            {@render scaledNumberInput(config.scoring.clearBonus, v => setScoring('clearBonus', v))}
          </label>
          <label class="text-xs text-slate-500">
            全消し・残り山札1枚あたり(clearBonusPerStock)
            {@render scaledNumberInput(config.scoring.clearBonusPerStock, v => setScoring('clearBonusPerStock', v))}
          </label>
          <label class="text-xs text-slate-500">
            コンボ倍率のstep幅(comboMultiplierStep)
            <input type="number" min="0" step="0.1" bind:value={config.scoring.comboMultiplierStep} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
        </div>
      </section>

      <section class="bg-white border border-slate-200 rounded-xl p-4">
        <h2 class="font-semibold text-slate-700 text-sm mb-3">役ボーナス</h2>
        <div class="grid grid-cols-2 gap-3">
          <label class="text-xs text-slate-500">
            スートコンプリート(flushBonus)
            {@render scaledNumberInput(config.scoring.flushBonus, v => setScoring('flushBonus', v))}
          </label>
          <label class="text-xs text-slate-500">
            ロイヤルセット(royalSetBonus)
            {@render scaledNumberInput(config.scoring.royalSetBonus, v => setScoring('royalSetBonus', v))}
          </label>
          <label class="text-xs text-slate-500">
            同ランク単位(sameRankBonusUnit)
            {@render scaledNumberInput(config.scoring.sameRankBonusUnit, v => setScoring('sameRankBonusUnit', v))}
          </label>
          <label class="text-xs text-slate-500">
            コンプリートラン(completeRunBonus)
            {@render scaledNumberInput(config.scoring.completeRunBonus, v => setScoring('completeRunBonus', v))}
          </label>
          <label class="text-xs text-slate-500">
            コンプリートラン・同スート加点(completeRunSuitBonus)
            {@render scaledNumberInput(config.scoring.completeRunSuitBonus, v => setScoring('completeRunSuitBonus', v))}
          </label>
          <label class="text-xs text-slate-500">
            列一掃(columnSweepBonus)
            {@render scaledNumberInput(config.scoring.columnSweepBonus, v => setScoring('columnSweepBonus', v))}
          </label>
        </div>
      </section>

      <section class="bg-white border border-slate-200 rounded-xl p-4">
        <div class="flex items-center justify-between mb-3">
          <h2 class="font-semibold text-slate-700 text-sm">ステージ</h2>
          <button onclick={addStage} class="text-xs px-2.5 py-1 rounded border border-dashed border-slate-300 text-slate-500 hover:border-teal-400 hover:text-teal-600">+ ステージ追加</button>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-xs border border-slate-200 rounded-lg overflow-hidden">
            <thead>
              <tr class="bg-slate-50 text-slate-500">
                <th class="px-2 py-1.5 text-left">名前</th>
                <th class="px-2 py-1.5 text-left">modifier</th>
                <th class="px-2 py-1.5 text-center">target1</th>
                <th class="px-2 py-1.5 text-center">target2</th>
                <th class="px-2 py-1.5 text-center">target3</th>
                <th class="px-2 py-1.5 w-8"></th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              {#each config.stages as stage, si (si)}
                <tr>
                  <td class="px-2 py-1">
                    <input type="text" bind:value={stage.name} class="w-full border border-slate-200 rounded px-1.5 py-0.5" />
                  </td>
                  <td class="px-2 py-1">
                    <select bind:value={stage.modifier} class="w-full border border-slate-200 rounded px-1.5 py-0.5">
                      <option value="none">none</option>
                      <option value="noLoop">noLoop</option>
                      <option value="faceLock">faceLock</option>
                    </select>
                  </td>
                  {#each [0, 1, 2] as ti (ti)}
                    <td class="px-1 py-1">
                      {@render scaledNumberInput(stage.targets[ti], v => setTarget(si, ti as 0 | 1 | 2, v))}
                    </td>
                  {/each}
                  <td class="px-1 py-1 text-center">
                    <button onclick={() => removeStage(si)} disabled={config.stages.length <= 1} class="text-slate-400 hover:text-red-500 disabled:opacity-30 px-1">×</button>
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      </section>

      <section class="bg-white border border-slate-200 rounded-xl p-4">
        <h2 class="font-semibold text-slate-700 text-sm mb-3">アイテム</h2>
        <div class="grid grid-cols-2 gap-3">
          <label class="text-xs text-slate-500">
            紅の目利き(redBonusValue)
            {@render scaledNumberInput(config.items.redBonusValue, v => setItems('redBonusValue', v))}
          </label>
          <label class="text-xs text-slate-500">
            宮廷の紋章(faceBonusValue)
            {@render scaledNumberInput(config.items.faceBonusValue, v => setItems('faceBonusValue', v))}
          </label>
          <label class="text-xs text-slate-500">
            コンボシールド回数(shieldChargesPerPick)
            <input type="number" min="0" step="1" bind:value={config.items.shieldChargesPerPick} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            厚めの山札枚数(extraStockCount)
            <input type="number" min="0" step="1" bind:value={config.items.extraStockCount} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            ワイルド混入枚数(wildPerPick)
            <input type="number" min="0" step="1" bind:value={config.items.wildPerPick} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            助走コンボ値(startCombo)
            <input type="number" min="0" step="1" bind:value={config.items.startCombo} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            完全消去加算(fullClearItemBonus)
            {@render scaledNumberInput(config.items.fullClearItemBonus, v => setItems('fullClearItemBonus', v))}
          </label>
        </div>
      </section>

      <section class="bg-white border border-slate-200 rounded-xl p-4">
        <h2 class="font-semibold text-slate-700 text-sm mb-3">フロー・UI</h2>
        <div class="grid grid-cols-2 gap-3">
          <label class="text-xs text-slate-500">
            1ステージのウェーブ数(wavesPerStage)
            <input type="number" min="1" step="1" bind:value={config.flow.wavesPerStage} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            クリア演出待ち(clearDelayMs)
            <input type="number" min="0" step="10" bind:value={config.flow.clearDelayMs} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          {#each [0, 1, 2] as ti (ti)}
            <label class="text-xs text-slate-500">
              comboTierThresholds[{ti}]
              <input type="number" min="0" step="1" bind:value={config.ui.comboTierThresholds[ti]} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
            </label>
          {/each}
          <label class="text-xs text-slate-500">
            チェーン表示: 横にずらす幅(chainCardOffsetX)
            <input type="number" min="0" step="1" bind:value={config.ui.chainCardOffsetX} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            チェーン表示: 1行に表示する枚数(chainCardsPerRow)
            <input type="number" min="1" step="1" bind:value={config.ui.chainCardsPerRow} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
        </div>
      </section>

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
