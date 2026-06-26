# Color32 / Color 変換ツール 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unity 向け Color32・Color（float）・HEX の相互変換ツールを `/color-converter` に追加する。

**Architecture:** 変換ロジックを `src/lib/colorConverter.ts` に分離してユニットテストで保護し、`+page.svelte` で Svelte 5 Runes を使って状態管理・UI を実装する。内部状態は整数 r/g/b/a（0–255）のみで、表示時に各形式に変換する。

**Tech Stack:** Svelte 5 (Runes), SvelteKit, Tailwind CSS, Vitest

---

## ファイル構成

| 操作 | ファイル | 責務 |
|---|---|---|
| 新規作成 | `src/lib/colorConverter.ts` | 変換ヘルパー・フォーマット関数 |
| 新規作成 | `src/lib/colorConverter.test.ts` | ユニットテスト |
| 新規作成 | `src/routes/color-converter/+page.svelte` | UI・状態管理 |
| 変更 | `src/lib/site.ts` | ナビゲーションエントリー追加 |
| 変更 | `src/lib/site.config.json` | 表示設定・開発中フラグ追加 |

---

## Task 1: 変換ロジック（TDD）

**Files:**
- Create: `src/lib/colorConverter.ts`
- Create: `src/lib/colorConverter.test.ts`

- [ ] **Step 1: テストを先に書く**

`src/lib/colorConverter.test.ts` を作成する：

```typescript
import { describe, it, expect } from 'vitest'
import {
  clamp, toHex2, fStr, parseHex,
  formatColor32, formatColorFloat, formatHex8, formatHex6, formatRgba
} from './colorConverter'

describe('clamp', () => {
  it('範囲内の値はそのまま返す', () => expect(clamp(128, 0, 255)).toBe(128))
  it('最小値でクランプする', () => expect(clamp(-1, 0, 255)).toBe(0))
  it('最大値でクランプする', () => expect(clamp(256, 0, 255)).toBe(255))
})

describe('toHex2', () => {
  it('0 → "00"', () => expect(toHex2(0)).toBe('00'))
  it('255 → "FF"', () => expect(toHex2(255)).toBe('FF'))
  it('128 → "80"', () => expect(toHex2(128)).toBe('80'))
  it('小数は四捨五入してから変換する', () => expect(toHex2(127.6)).toBe('80'))
})

describe('fStr', () => {
  it('0 → "0.000f"', () => expect(fStr(0)).toBe('0.000f'))
  it('255 → "1.000f"', () => expect(fStr(255)).toBe('1.000f'))
  it('128 → "0.502f"', () => expect(fStr(128)).toBe('0.502f'))
})

describe('parseHex', () => {
  it('8桁（#付き）をパースする', () =>
    expect(parseHex('#FF8000C8')).toEqual({ r: 255, g: 128, b: 0, a: 200 }))
  it('6桁（#付き）は a=255 を補完する', () =>
    expect(parseHex('#FF8000')).toEqual({ r: 255, g: 128, b: 0, a: 255 }))
  it('#なしでもパースする', () =>
    expect(parseHex('FF8000FF')).toEqual({ r: 255, g: 128, b: 0, a: 255 }))
  it('5桁は null を返す', () => expect(parseHex('#FF800')).toBeNull())
  it('9桁以上は null を返す', () => expect(parseHex('#FF800012')).toBeNull())
  it('不正な16進文字は null を返す', () => expect(parseHex('#GGGGGGGG')).toBeNull())
})

describe('formatColor32', () => {
  it('正しくフォーマットする', () =>
    expect(formatColor32(255, 128, 0, 255)).toBe('new Color32(255, 128, 0, 255)'))
})

describe('formatColorFloat', () => {
  it('正しくフォーマットする', () =>
    expect(formatColorFloat(255, 128, 0, 255)).toBe('new Color(1.000f, 0.502f, 0.000f, 1.000f)'))
})

describe('formatHex8', () => {
  it('正しくフォーマットする', () =>
    expect(formatHex8(255, 128, 0, 255)).toBe('#FF8000FF'))
  it('アルファ付きも正しい', () =>
    expect(formatHex8(255, 128, 0, 200)).toBe('#FF8000C8'))
})

describe('formatHex6', () => {
  it('正しくフォーマットする', () =>
    expect(formatHex6(255, 128, 0)).toBe('#FF8000'))
})

describe('formatRgba', () => {
  it('alpha=255 のとき 1.00', () =>
    expect(formatRgba(255, 128, 0, 255)).toBe('rgba(255, 128, 0, 1.00)'))
  it('alpha=128 のとき 0.50', () =>
    expect(formatRgba(255, 128, 0, 128)).toBe('rgba(255, 128, 0, 0.50)'))
})
```

- [ ] **Step 2: テストが失敗することを確認する**

```bash
npm test
```

Expected: `Cannot find module './colorConverter'` などのエラーで FAIL

- [ ] **Step 3: 変換ロジックを実装する**

`src/lib/colorConverter.ts` を作成する：

```typescript
export function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n))
}

export function toHex2(n: number): string {
  return Math.round(n).toString(16).toUpperCase().padStart(2, '0')
}

export function fStr(n: number): string {
  return (n / 255).toFixed(3) + 'f'
}

export function parseHex(
  hex: string
): { r: number; g: number; b: number; a: number } | null {
  const h = hex.replace('#', '').trim()
  if (h.length === 6) {
    const r = parseInt(h.slice(0, 2), 16)
    const g = parseInt(h.slice(2, 4), 16)
    const b = parseInt(h.slice(4, 6), 16)
    if (isNaN(r) || isNaN(g) || isNaN(b)) return null
    return { r, g, b, a: 255 }
  }
  if (h.length === 8) {
    const r = parseInt(h.slice(0, 2), 16)
    const g = parseInt(h.slice(2, 4), 16)
    const b = parseInt(h.slice(4, 6), 16)
    const a = parseInt(h.slice(6, 8), 16)
    if (isNaN(r) || isNaN(g) || isNaN(b) || isNaN(a)) return null
    return { r, g, b, a }
  }
  return null
}

export function formatColor32(r: number, g: number, b: number, a: number): string {
  return `new Color32(${r}, ${g}, ${b}, ${a})`
}

export function formatColorFloat(r: number, g: number, b: number, a: number): string {
  return `new Color(${fStr(r)}, ${fStr(g)}, ${fStr(b)}, ${fStr(a)})`
}

export function formatHex8(r: number, g: number, b: number, a: number): string {
  return `#${toHex2(r)}${toHex2(g)}${toHex2(b)}${toHex2(a)}`
}

export function formatHex6(r: number, g: number, b: number): string {
  return `#${toHex2(r)}${toHex2(g)}${toHex2(b)}`
}

export function formatRgba(r: number, g: number, b: number, a: number): string {
  return `rgba(${r}, ${g}, ${b}, ${(a / 255).toFixed(2)})`
}
```

- [ ] **Step 4: テストが通ることを確認する**

```bash
npm test
```

Expected: 全テスト PASS

- [ ] **Step 5: コミットする**

```bash
git add src/lib/colorConverter.ts src/lib/colorConverter.test.ts
git commit -m "feat: Color32/Color変換ロジックを追加"
```

---

## Task 2: ナビゲーション登録

**Files:**
- Modify: `src/lib/site.ts`
- Modify: `src/lib/site.config.json`

- [ ] **Step 1: site.ts にエントリーを追加する**

`src/lib/site.ts` の `tools` 配列（`hepburn-converter` エントリーの直後）に追加する：

```typescript
// 既存の hepburn-converter エントリーの後に追加
{
  href: '/color-converter',
  label: 'Color32/Color変換',
  description: 'Unity の Color32・Color・HEX を相互変換するツール',
  category: 'programming',
},
```

- [ ] **Step 2: site.config.json に表示設定を追加する**

`src/lib/site.config.json` の `toolDevStatus` と `toolVisibility` にそれぞれ追加する：

```json
{
  "toolLabels": { ... },
  "toolDevStatus": {
    "/image-tools": true,
    "/sns-image-resize": true,
    "/id-photo": true,
    "/nisa-simple-calculator": true,
    "/nisa-detailed-calculator": true,
    "/nisa-accumulation-simulator": true,
    "/color-converter": true
  },
  "toolVisibility": {
    "/bpm-tapper": true,
    "/note-duration": true,
    "/scale-visualizer": true,
    "/hepburn-converter": true,
    "/image-tools": false,
    "/sns-image-resize": false,
    "/id-photo": false,
    "/nisa-simple-calculator": false,
    "/nisa-detailed-calculator": false,
    "/nisa-accumulation-simulator": false,
    "/color-converter": true
  }
}
```

- [ ] **Step 3: コミットする**

```bash
git add src/lib/site.ts src/lib/site.config.json
git commit -m "feat: Color32/Color変換をナビゲーションに追加"
```

---

## Task 3: ページコンポーネント（状態・タブ・入力エリア）

**Files:**
- Create: `src/routes/color-converter/+page.svelte`

- [ ] **Step 1: ページファイルを作成する**

`src/routes/color-converter/+page.svelte` を作成する（script セクション）：

```svelte
<script lang="ts">
  import {
    clamp, toHex2, parseHex,
    formatColor32, formatColorFloat, formatHex8, formatHex6, formatRgba
  } from '$lib/colorConverter'

  let r = $state(255)
  let g = $state(0)
  let b = $state(0)
  let a = $state(255)
  type Tab = 'color32' | 'float' | 'hex'
  let activeTab = $state<Tab>('color32')
  let copiedRow = $state<string | null>(null)
  let copyTimer: ReturnType<typeof setTimeout> | null = null

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
    { id: 'hex', label: 'HEX' },
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
    r = parsed.r; g = parsed.g; b = parsed.b; a = parsed.a
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
    await navigator.clipboard.writeText(text)
    if (copyTimer) clearTimeout(copyTimer)
    copiedRow = label
    copyTimer = setTimeout(() => { copiedRow = null }, 1200)
  }
</script>
```

- [ ] **Step 2: テンプレートを追加する（タブ行 + カラーピッカー）**

script の直下に追加する：

```svelte
<svelte:head>
  <title>Color32 / Color 変換 | Unity カラーコンバーター | 96xtools</title>
  <meta name="description" content="Unity の Color32・Color・HEX を相互変換。new Color32()・new Color()・#RRGGBBAA をリアルタイムで変換してコピーできる無料ツール。" />
</svelte:head>

<div class="max-w-2xl mx-auto px-4 py-6">
  <h1 class="text-xl font-bold text-slate-900">Color32 / Color 変換</h1>
  <p class="text-sm text-slate-500 mt-1">Unity の色形式をリアルタイム変換</p>

  <!-- タブ行 + カラーピッカー（同じ flex 構成） -->
  <div class="flex items-stretch gap-3 mt-6">
    <!-- タブ群（flex:1、border-bottom あり） -->
    <div class="flex-1 flex items-stretch border-b border-slate-200">
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
      <!-- 縦区切り線 -->
      <div class="w-px bg-slate-200 my-1.5 ml-auto shrink-0"></div>
    </div>
    <!-- カラーピッカー（64px = テキストボックス列と同幅、border-bottom なし） -->
    <div class="w-16 shrink-0 flex items-center py-1.5">
      <input
        type="color"
        value={pickerHex}
        oninput={onPickerInput}
        title="カラーピッカー（アルファは A 欄で指定）"
        class="w-full h-9 rounded-lg border-2 border-slate-200 cursor-pointer p-0.5"
      />
    </div>
  </div>

  <!-- HEX タブのテキスト入力欄 -->
  {#if activeTab === 'hex'}
    <div class="mt-3">
      <input
        type="text"
        placeholder="#RRGGBBAA"
        value={formatHex8(r, g, b, a)}
        oninput={onHexTextInput}
        maxlength="9"
        class="w-full font-mono text-sm bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500"
      />
    </div>
  {/if}

  <!-- スライダー + テキストボックス（同じ flex 構成） -->
  <div class="flex gap-3 mt-4">
    <!-- 左: ラベル＋スライダー（flex:1） -->
    <div class="flex-1 flex flex-col gap-2">
      {#each channels as ch}
        <div class="flex items-center gap-2 h-8">
          <span class="text-xs font-bold w-3 shrink-0 uppercase" style="color:{ch.color}">{ch.label}</span>
          <input
            type="range"
            min="0"
            max="255"
            value={getVal(ch.key)}
            oninput={(e) => onSliderInput(ch.key, e)}
            style="accent-color:{ch.color}"
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
```

- [ ] **Step 3: プレビューと変換結果を追加する**

スライダー区画の終わりに続けて追加する：

```svelte
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
</div>
```

- [ ] **Step 4: コミットする**

```bash
git add src/routes/color-converter/+page.svelte
git commit -m "feat: Color32/Color変換ページを追加"
```

---

## Task 4: ビルド確認と動作検証

**Files:** なし（確認のみ）

- [ ] **Step 1: ビルドが通ることを確認する**

```bash
npm run build
```

Expected: エラーなしで `Build complete` が表示される

- [ ] **Step 2: 開発サーバーを起動して動作確認する**

```bash
npm run dev
```

ブラウザで `http://localhost:5173/color-converter` を開いて以下を確認する：

1. ページが表示され、上部ナビに「Color32/Color変換(開発中)」が表示される
2. Color32 タブ: スライダーを動かすと数値欄・プレビュー・変換結果が即時更新される
3. Color (float) タブ: 数値欄が 0.000–1.000 で表示される
4. HEX タブ: テキスト欄に `#RRGGBBAA` 形式が表示される
5. カラーピッカーで色を選ぶと R/G/B が更新される（A は変わらない）
6. 変換結果の「コピー」ボタンを押すと 1200ms だけ「✓」になる

- [ ] **Step 3: （問題があれば）修正してコミットする**

```bash
git add src/routes/color-converter/+page.svelte
git commit -m "fix: Color32/Color変換ページの表示を修正"
```
