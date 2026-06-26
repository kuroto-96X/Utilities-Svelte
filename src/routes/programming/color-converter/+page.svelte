<script lang="ts">
  import { onDestroy } from 'svelte'
  import {
    clamp, toHex2, parseHex,
    formatColor32, formatColorFloat, formatHex8, formatHex6, formatRgba
  } from '$lib/programming/colorConverter'

  let r = $state(255)
  let g = $state(0)
  let b = $state(0)
  let a = $state(255)
  type Tab = 'color32' | 'float'
  let activeTab = $state<Tab>('color32')
  let copiedRow = $state<string | null>(null)
  let copyTimer: ReturnType<typeof setTimeout> | null = null

  onDestroy(() => { if (copyTimer) clearTimeout(copyTimer) })

  const pickerHex = $derived(`#${toHex2(r)}${toHex2(g)}${toHex2(b)}`)

  const channels = [
    { key: 'r' as const, label: 'R', color: '#ef4444' },
    { key: 'g' as const, label: 'G', color: '#22c55e' },
    { key: 'b' as const, label: 'B', color: '#3b82f6' },
    { key: 'a' as const, label: 'A', color: '#94a3b8' },
  ]

  const tabs: { id: Tab; label: string }[] = [
    { id: 'color32', label: 'Color32' },
    { id: 'float', label: 'Color (float)' },
  ]

  function getVal(ch: 'r' | 'g' | 'b' | 'a'): number {
    return ch === 'r' ? r : ch === 'g' ? g : ch === 'b' ? b : a
  }

  function setVal(ch: 'r' | 'g' | 'b' | 'a', v: number): void {
    if (ch === 'r') r = v
    else if (ch === 'g') g = v
    else if (ch === 'b') b = v
    else a = v
  }

  function getFloat(ch: 'r' | 'g' | 'b' | 'a'): string {
    return (getVal(ch) / 255).toFixed(3)
  }

  const results = $derived([
    { label: 'Color32',       value: formatColor32(r, g, b, a) },
    { label: 'Color (float)', value: formatColorFloat(r, g, b, a) },
    { label: 'HEX #RRGGBBAA', value: formatHex8(r, g, b, a) },
    { label: 'HEX #RRGGBB',   value: formatHex6(r, g, b) },
    { label: 'HTML rgba()',    value: formatRgba(r, g, b, a) },
  ])

  function onPickerInput(e: Event) {
    const hex = (e.target as HTMLInputElement).value
    r = parseInt(hex.slice(1, 3), 16)
    g = parseInt(hex.slice(3, 5), 16)
    b = parseInt(hex.slice(5, 7), 16)
  }

  function onHexTextInput(e: Event) {
    const parsed = parseHex((e.target as HTMLInputElement).value)
    if (!parsed) return
    r = parsed.r
    g = parsed.g
    b = parsed.b
    if (parsed.a !== undefined) a = parsed.a
  }

  function onSliderInput(ch: 'r' | 'g' | 'b' | 'a', e: Event) {
    setVal(ch, parseInt((e.target as HTMLInputElement).value))
  }

  function onInt32Input(ch: 'r' | 'g' | 'b' | 'a', e: Event) {
    const v = parseInt((e.target as HTMLInputElement).value)
    if (!isNaN(v)) setVal(ch, clamp(v, 0, 255))
  }

  function onFloatInput(ch: 'r' | 'g' | 'b' | 'a', e: Event) {
    const v = parseFloat((e.target as HTMLInputElement).value)
    if (!isNaN(v)) setVal(ch, clamp(Math.round(v * 255), 0, 255))
  }

  async function copyRow(label: string, text: string) {
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      return
    }
    if (copyTimer) clearTimeout(copyTimer)
    copiedRow = label
    copyTimer = setTimeout(() => { copiedRow = null }, 1200)
  }
</script>

<svelte:head>
  <title>Color32 / Color 変換 | Unity カラーコンバーター | 96xtools</title>
  <meta name="description" content="Unity の Color32・Color・HEX を相互変換。new Color32()・new Color()・#RRGGBBAA をリアルタイムで変換してコピーできる無料ツール。" />
</svelte:head>

<div class="max-w-2xl mx-auto px-4 py-6">
  <h1 class="text-xl font-bold text-slate-900">Color32 / Color 変換</h1>
  <p class="text-sm text-slate-500 mt-1">Unity の色形式をリアルタイム変換</p>

  <!-- タブ行 -->
  <div class="mt-6 flex border-b border-slate-200">
    {#each tabs as tab}
      {@const isActive = activeTab === tab.id}
      <button
        type="button"
        onclick={() => { activeTab = tab.id }}
        class="px-4 py-2.5 text-sm border-b-2 transition-colors"
        class:font-semibold={isActive}
        class:text-teal-700={isActive}
        class:border-teal-700={isActive}
        class:text-slate-500={!isActive}
        class:border-transparent={!isActive}
      >
        {tab.label}
      </button>
    {/each}
  </div>

  <!-- HEX 入力 + カラーピッカー（スライダーの上） -->
  <div class="flex items-center gap-3 mt-3">
    <input
      type="text"
      placeholder="#RRGGBBAA"
      value={formatHex8(r, g, b, a)}
      oninput={onHexTextInput}
      maxlength="9"
      class="flex-1 font-mono text-sm bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500"
    />
    <input
      type="color"
      value={pickerHex}
      oninput={onPickerInput}
      title="カラーピッカー（アルファは A 欄で指定）"
      aria-label="カラーピッカー"
      class="w-16 h-9 shrink-0 rounded-lg border-2 border-slate-200 cursor-pointer p-0.5"
    />
  </div>

  <!-- スライダー + テキストボックス -->
  <div class="flex gap-3 mt-4">
    <!-- 左: ラベル＋スライダー -->
    <div class="flex-1 flex flex-col gap-2 color-sliders">
      {#each channels as ch}
        <div class="flex items-center gap-2 h-8">
          <span class="text-xs font-bold w-3 shrink-0 uppercase" style="color:{ch.color}">{ch.label}</span>
          <input
            type="range"
            min="0"
            max="255"
            value={getVal(ch.key)}
            oninput={(e) => onSliderInput(ch.key, e)}
            style="--thumb-color:{ch.color}; --fill-pct:{(getVal(ch.key)/255*100).toFixed(1)}%"
            class="flex-1"
          />
        </div>
      {/each}
    </div>
    <!-- 右: テキストボックス（64px） -->
    <div class="flex flex-col gap-2 w-16 shrink-0">
      {#each channels as ch}
        {#if activeTab === 'float'}
          <input
            type="number"
            min="0"
            max="1"
            step="0.001"
            value={getFloat(ch.key)}
            oninput={(e) => onFloatInput(ch.key, e)}
            class="bg-slate-50 border border-slate-200 rounded-md text-center text-sm font-medium h-8 w-full focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
        {:else}
          <input
            type="number"
            min="0"
            max="255"
            step="1"
            value={getVal(ch.key)}
            oninput={(e) => onInt32Input(ch.key, e)}
            class="bg-slate-50 border border-slate-200 rounded-md text-center text-sm font-medium h-8 w-full focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
        {/if}
      {/each}
    </div>
  </div>

  <!-- プレビュー -->
  <div class="mt-6">
    <p class="text-xs font-bold text-slate-700 mb-2">プレビュー</p>
    <div class="flex gap-3">
      <div class="flex-1">
        <p class="text-xs text-slate-400 mb-1.5">アルファあり</p>
        <div
          class="h-11 rounded-lg border border-slate-200"
          style="background: linear-gradient(135deg,#ccc 25%,transparent 25%,transparent 75%,#ccc 75%) 0 0 / 12px 12px, rgba({r},{g},{b},{(a/255).toFixed(3)})"
        ></div>
      </div>
      <div class="flex-1">
        <p class="text-xs text-slate-400 mb-1.5">アルファなし</p>
        <div
          class="h-11 rounded-lg border border-slate-200"
          style="background: rgb({r},{g},{b})"
        ></div>
      </div>
    </div>
  </div>

  <!-- 変換結果 -->
  <div class="mt-6">
    <p class="text-xs font-bold text-slate-700 mb-2">変換結果</p>
    <div class="flex flex-col gap-1.5">
      {#each results as row (row.label)}
        <div class="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5">
          <div class="min-w-0">
            <p class="text-[10px] font-semibold text-slate-400 mb-0.5">{row.label}</p>
            <p class="text-xs font-mono text-slate-900 truncate">{row.value}</p>
          </div>
          <button
            type="button"
            onclick={() => copyRow(row.label, row.value)}
            class="shrink-0 ml-3 text-xs font-semibold px-2.5 py-1 rounded transition-colors"
            class:bg-emerald-100={copiedRow === row.label}
            class:text-emerald-700={copiedRow === row.label}
            class:bg-sky-100={copiedRow !== row.label}
            class:text-sky-700={copiedRow !== row.label}
          >
            {copiedRow === row.label ? '✓' : 'コピー'}
          </button>
        </div>
      {/each}
    </div>
  </div>

  <!-- 説明 -->
  <div class="mt-10 pt-6 border-t border-slate-100 space-y-3">
    <p class="text-sm text-slate-500">Unity で使用される色の形式を相互変換するツールです。スライダーまたは数値入力で RGBA を調整すると、各形式の出力がリアルタイムで更新されます。</p>
    <ul class="space-y-1.5 text-xs text-slate-400">
      <li><span class="font-semibold text-slate-500">Color32</span> — R/G/B/A を 0〜255 の整数で表す形式。スプライトや UI の色設定によく使われます。</li>
      <li><span class="font-semibold text-slate-500">Color (float)</span> — R/G/B/A を 0.0〜1.0 の浮動小数点で表す形式。シェーダーやマテリアルのプロパティに使われます。</li>
      <li><span class="font-semibold text-slate-500">HEX #RRGGBBAA / #RRGGBB</span> — 16 進数表記。HEX 入力欄に貼り付けて変換することもできます。</li>
      <li><span class="font-semibold text-slate-500">HTML rgba()</span> — CSS で使用できる rgba 記法。アルファ値は 0〜1 の小数で表されます。</li>
    </ul>
  </div>
</div>

<style>
  .color-sliders input[type='range'] {
    -webkit-appearance: none;
    appearance: none;
    background: transparent;
  }
  .color-sliders input[type='range']::-webkit-slider-runnable-track {
    height: 4px;
    border-radius: 9999px;
    background: linear-gradient(to right, var(--thumb-color) 0%, var(--thumb-color) var(--fill-pct), #e2e8f0 var(--fill-pct), #e2e8f0 100%);
  }
  .color-sliders input[type='range']::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    margin-top: -6px;
    background: var(--thumb-color, #64748b);
    cursor: pointer;
  }
  .color-sliders input[type='range']::-moz-range-track {
    height: 4px;
    border-radius: 9999px;
    background: #e2e8f0;
  }
  .color-sliders input[type='range']::-moz-range-progress {
    height: 4px;
    border-radius: 9999px;
    background: var(--thumb-color);
  }
  .color-sliders input[type='range']::-moz-range-thumb {
    width: 16px;
    height: 16px;
    border-radius: 50%;
    border: none;
    background: var(--thumb-color, #64748b);
    cursor: pointer;
  }
</style>
