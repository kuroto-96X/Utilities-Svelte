# BPM音符換算ツール実装プラン

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** BPMを入力すると全音符〜32分音符（6種類）の通常・付点・3連符の長さを秒・msで表示するツールをSvelteKitに追加する。

**Architecture:** 計算ロジックを `noteDuration.ts` に分離してテスト可能にし、UI を3つのSvelteコンポーネントに分割。`+page.svelte` が URL `?bpm=` パラメータを `$effect` で読み取り、`$state` の `bpm` に反映する。`site.ts` にルートを登録し、BPM Tapperに音符換算ページへのリンクを追加する。

**Tech Stack:** SvelteKit 2、Svelte 5（runes: `$state`/`$derived`/`$effect`/`$props`/`$bindable`）、TypeScript、Tailwind CSS v3、Vitest

---

## ファイルマップ

| 操作 | パス | 役割 |
|------|------|------|
| 新規 | `src/lib/noteDuration.ts` | 型・定数・計算ロジック（テスト対象） |
| 新規 | `src/lib/noteDuration.test.ts` | Vitest ユニットテスト |
| 新規 | `src/lib/components/NoteIcon.svelte` | 音符SVGアイコン |
| 新規 | `src/lib/components/BpmInput.svelte` | BPM入力UI |
| 新規 | `src/lib/components/NoteDurationTable.svelte` | 音符秒数テーブル |
| 新規 | `src/routes/note-duration/+page.svelte` | ページ本体 |
| 変更 | `src/lib/site.ts` | note-durationをmusicカテゴリに追加 |
| 変更 | `src/routes/bpm-tapper/+page.svelte` | 音符換算リンクを追加 |

---

## Task 1: 計算ロジック (`noteDuration.ts`) — TDD

**Files:**
- Create: `src/lib/noteDuration.test.ts`
- Create: `src/lib/noteDuration.ts`

- [ ] **Step 1: テストファイルを作成する**

`src/lib/noteDuration.test.ts` を新規作成:

```ts
import { describe, expect, test } from 'vitest'
import {
  clampBpm, calculateNoteDurations, formatSec, formatMs,
  MIN_BPM, MAX_BPM, DEFAULT_BPM,
} from './noteDuration'

describe('clampBpm', () => {
  test('NaNはDEFAULT_BPMを返す', () => {
    expect(clampBpm(NaN)).toBe(DEFAULT_BPM)
  })

  test('0はMIN_BPMを返す', () => {
    expect(clampBpm(0)).toBe(MIN_BPM)
  })

  test('負の値はMIN_BPMを返す', () => {
    expect(clampBpm(-10)).toBe(MIN_BPM)
  })

  test('MAX_BPM超はMAX_BPMを返す', () => {
    expect(clampBpm(500)).toBe(MAX_BPM)
  })

  test('範囲内はそのまま返す', () => {
    expect(clampBpm(120)).toBe(120)
    expect(clampBpm(MIN_BPM)).toBe(MIN_BPM)
    expect(clampBpm(MAX_BPM)).toBe(MAX_BPM)
  })
})

describe('calculateNoteDurations (BPM=120)', () => {
  const durations = calculateNoteDurations(120)
  const whole        = durations.find(d => d.id === 'whole')!
  const quarter      = durations.find(d => d.id === 'quarter')!
  const eighth       = durations.find(d => d.id === 'eighth')!
  const thirtysecond = durations.find(d => d.id === 'thirtysecond')!

  test('6種類の音符を返す', () => {
    expect(durations).toHaveLength(6)
    const ids = durations.map(d => d.id)
    expect(ids).toEqual(['whole','half','quarter','eighth','sixteenth','thirtysecond'])
  })

  test('4分音符 normalSec = 0.5 (BPM=120)', () => {
    expect(quarter.normalSec).toBeCloseTo(0.5, 10)
  })

  test('全音符は4分音符の4倍', () => {
    expect(whole.normalSec).toBeCloseTo(2.0, 10)
  })

  test('8分音符は4分音符の1/2', () => {
    expect(eighth.normalSec).toBeCloseTo(0.25, 10)
  })

  test('32分音符は4分音符の1/8', () => {
    expect(thirtysecond.normalSec).toBeCloseTo(0.0625, 10)
  })

  test('付点は通常の1.5倍', () => {
    expect(quarter.dottedSec).toBeCloseTo(0.75, 10)
  })

  test('3連符は通常の2/3', () => {
    expect(quarter.tripletSec).toBeCloseTo(1 / 3, 10)
  })

  test('BPM=0はDEFAULT_BPMにフォールバック', () => {
    const fallback = calculateNoteDurations(0)
    const def      = calculateNoteDurations(DEFAULT_BPM)
    expect(fallback[2].normalSec).toBeCloseTo(def[2].normalSec, 10)
  })

  test('全音符 symbol: filled=false, stem=false, flags=0', () => {
    expect(whole.symbol).toEqual({ filled: false, stem: false, flags: 0 })
  })

  test('32分音符 symbol: filled=true, stem=true, flags=3', () => {
    expect(thirtysecond.symbol).toEqual({ filled: true, stem: true, flags: 3 })
  })

  test('label と fraction が正しい', () => {
    expect(quarter.label).toBe('4分音符')
    expect(quarter.fraction).toBe('1/4')
    expect(whole.label).toBe('全音符')
    expect(whole.fraction).toBe('1/1')
  })
})

describe('formatSec', () => {
  test('3桁固定小数を返す', () => {
    expect(formatSec(0.5)).toBe('0.500')
    expect(formatSec(2)).toBe('2.000')
    expect(formatSec(0.0625)).toBe('0.063')
  })
})

describe('formatMs', () => {
  test('ミリ秒換算で1桁固定小数を返す', () => {
    expect(formatMs(0.5)).toBe('500.0')
    expect(formatMs(2)).toBe('2000.0')
    expect(formatMs(0.25)).toBe('250.0')
  })
})
```

- [ ] **Step 2: テストが失敗することを確認する**

```bash
npx vitest run src/lib/noteDuration.test.ts
```

期待出力: `Cannot find module './noteDuration'` または類似エラー

- [ ] **Step 3: `noteDuration.ts` を実装する**

`src/lib/noteDuration.ts` を新規作成:

```ts
export type NoteId = 'whole' | 'half' | 'quarter' | 'eighth' | 'sixteenth' | 'thirtysecond'

export interface NoteSymbol {
  filled: boolean
  stem: boolean
  flags: 0 | 1 | 2 | 3
}

export interface NoteDuration {
  id: NoteId
  label: string
  fraction: string
  symbol: NoteSymbol
  normalSec: number
  dottedSec: number
  tripletSec: number
}

export const MIN_BPM = 20
export const MAX_BPM = 300
export const DEFAULT_BPM = 120

export function clampBpm(bpm: number): number {
  if (Number.isNaN(bpm)) return DEFAULT_BPM
  return Math.min(MAX_BPM, Math.max(MIN_BPM, bpm))
}

const NOTE_DEFS: Array<Omit<NoteDuration, 'normalSec' | 'dottedSec' | 'tripletSec'> & { mult: number }> = [
  { id: 'whole',        label: '全音符',   fraction: '1/1',  mult: 4,     symbol: { filled: false, stem: false, flags: 0 } },
  { id: 'half',         label: '2分音符',  fraction: '1/2',  mult: 2,     symbol: { filled: false, stem: true,  flags: 0 } },
  { id: 'quarter',      label: '4分音符',  fraction: '1/4',  mult: 1,     symbol: { filled: true,  stem: true,  flags: 0 } },
  { id: 'eighth',       label: '8分音符',  fraction: '1/8',  mult: 0.5,   symbol: { filled: true,  stem: true,  flags: 1 } },
  { id: 'sixteenth',    label: '16分音符', fraction: '1/16', mult: 0.25,  symbol: { filled: true,  stem: true,  flags: 2 } },
  { id: 'thirtysecond', label: '32分音符', fraction: '1/32', mult: 0.125, symbol: { filled: true,  stem: true,  flags: 3 } },
]

export function calculateNoteDurations(bpm: number): NoteDuration[] {
  const safeBpm = bpm > 0 ? bpm : DEFAULT_BPM
  const quarterSec = 60 / safeBpm
  return NOTE_DEFS.map(({ mult, ...rest }) => {
    const normalSec = quarterSec * mult
    return {
      ...rest,
      normalSec,
      dottedSec: normalSec * 1.5,
      tripletSec: normalSec * (2 / 3),
    }
  })
}

export function formatSec(sec: number): string {
  return sec.toFixed(3)
}

export function formatMs(sec: number): string {
  return (sec * 1000).toFixed(1)
}
```

- [ ] **Step 4: テストがパスすることを確認する**

```bash
npx vitest run src/lib/noteDuration.test.ts
```

期待出力: `✓ src/lib/noteDuration.test.ts (17 tests)` または全テストパス

- [ ] **Step 5: コミットする**

```bash
git add src/lib/noteDuration.ts src/lib/noteDuration.test.ts
git commit -m "feat: BPM音符換算の計算ロジックとテストを追加"
```

---

## Task 2: `NoteIcon.svelte` — 音符SVGアイコン

**Files:**
- Create: `src/lib/components/NoteIcon.svelte`

- [ ] **Step 1: `NoteIcon.svelte` を作成する**

`src/lib/components/NoteIcon.svelte` を新規作成:

```svelte
<script lang="ts">
  let {
    filled,
    stem,
    flags,
    size = 24,
  }: {
    filled: boolean
    stem: boolean
    flags: 0 | 1 | 2 | 3
    size?: number
  } = $props()
</script>

<svg
  viewBox="0 0 24 24"
  width={size}
  height={size}
  xmlns="http://www.w3.org/2000/svg"
  aria-hidden="true"
>
  <ellipse
    cx="8" cy="17" rx="4" ry="3"
    transform="rotate(-20 8 17)"
    fill={filled ? 'currentColor' : 'none'}
    stroke={filled ? 'none' : 'currentColor'}
    stroke-width="1.5"
  />
  {#if stem}
    <line x1="11.5" y1="15" x2="11.5" y2="3" stroke="currentColor" stroke-width="1.5" />
  {/if}
  {#each Array(flags) as _, i}
    <path
      d={`M11.5 ${3 + i * 3} C16 ${4 + i * 3}, 17 ${8 + i * 3}, 14 ${11 + i * 3}`}
      stroke="currentColor"
      stroke-width="1.5"
      fill="none"
    />
  {/each}
</svg>
```

- [ ] **Step 2: ビルドが通ることを確認する**

```bash
npm run build
```

期待出力: `✓ built in ...` (エラーなし)

- [ ] **Step 3: コミットする**

```bash
git add src/lib/components/NoteIcon.svelte
git commit -m "feat: 音符SVGアイコンコンポーネントを追加"
```

---

## Task 3: `BpmInput.svelte` — BPM入力コンポーネント

**Files:**
- Create: `src/lib/components/BpmInput.svelte`

- [ ] **Step 1: `BpmInput.svelte` を作成する**

`src/lib/components/BpmInput.svelte` を新規作成:

```svelte
<script lang="ts">
  import { MIN_BPM, MAX_BPM, clampBpm } from '$lib/noteDuration'

  let {
    bpm = $bindable(),
    min = MIN_BPM,
    max = MAX_BPM,
  }: {
    bpm: number
    min?: number
    max?: number
  } = $props()

  let inputValue = $state(String(bpm))

  $effect(() => {
    inputValue = String(bpm)
  })

  function handleInput(e: Event) {
    inputValue = (e.target as HTMLInputElement).value
  }

  function handleBlur() {
    const n = parseFloat(inputValue)
    bpm = clampBpm(Number.isNaN(n) ? bpm : n)
  }

  function step(delta: number) {
    bpm = clampBpm(bpm + delta)
  }
</script>

<div class="flex flex-col items-center gap-3 w-full max-w-xs mx-auto">
  <div class="flex items-center gap-2 w-full">
    <button
      type="button"
      onclick={() => step(-1)}
      class="w-10 h-10 rounded-full border border-slate-300 text-slate-600 font-bold text-lg hover:bg-slate-100 active:bg-slate-200 transition-colors shrink-0"
      aria-label="BPMを1減らす"
    >−</button>
    <input
      type="number"
      value={inputValue}
      oninput={handleInput}
      onblur={handleBlur}
      min={min}
      max={max}
      class="flex-1 min-w-0 text-center text-3xl font-bold tabular-nums border border-slate-300 rounded-lg py-2 focus:outline-none focus:ring-2 focus:ring-teal-600"
      aria-label="BPM"
    />
    <button
      type="button"
      onclick={() => step(1)}
      class="w-10 h-10 rounded-full border border-slate-300 text-slate-600 font-bold text-lg hover:bg-slate-100 active:bg-slate-200 transition-colors shrink-0"
      aria-label="BPMを1増やす"
    >＋</button>
  </div>
  <input
    type="range"
    value={bpm}
    oninput={(e) => { bpm = clampBpm(Number((e.target as HTMLInputElement).value)) }}
    min={min}
    max={max}
    step="1"
    class="w-full accent-teal-700"
    aria-label="BPMスライダー"
  />
  <div class="text-xs text-slate-400">{min} – {max} BPM</div>
</div>
```

- [ ] **Step 2: ビルドが通ることを確認する**

```bash
npm run build
```

期待出力: `✓ built in ...` (エラーなし)

- [ ] **Step 3: コミットする**

```bash
git add src/lib/components/BpmInput.svelte
git commit -m "feat: BPM入力コンポーネントを追加"
```

---

## Task 4: `NoteDurationTable.svelte` — 音符秒数テーブル

**Files:**
- Create: `src/lib/components/NoteDurationTable.svelte`

- [ ] **Step 1: `NoteDurationTable.svelte` を作成する**

`src/lib/components/NoteDurationTable.svelte` を新規作成:

```svelte
<script lang="ts">
  import type { NoteDuration } from '$lib/noteDuration'
  import { formatSec, formatMs } from '$lib/noteDuration'
  import NoteIcon from './NoteIcon.svelte'

  let { durations }: { durations: NoteDuration[] } = $props()
</script>

<div class="overflow-x-auto">
  <table class="w-full text-sm min-w-[400px]">
    <thead>
      <tr class="border-b border-slate-200">
        <th scope="col" class="py-2 pr-3 text-left text-xs font-semibold text-slate-500">音符</th>
        <th scope="col" class="py-2 px-3 text-right text-xs font-semibold text-slate-500">通常</th>
        <th scope="col" class="py-2 px-3 text-right text-xs font-semibold text-slate-500">付点</th>
        <th scope="col" class="py-2 pl-3 text-right text-xs font-semibold text-slate-500">3連符</th>
      </tr>
    </thead>
    <tbody>
      {#each durations as d (d.id)}
        <tr class="border-b border-slate-100 odd:bg-slate-50">
          <td class="py-2 pr-3">
            <div class="flex items-center gap-2">
              <span class="text-slate-700 shrink-0">
                <NoteIcon filled={d.symbol.filled} stem={d.symbol.stem} flags={d.symbol.flags} size={22} />
              </span>
              <span class="font-medium text-slate-800 whitespace-nowrap">{d.label}</span>
              <span class="text-xs text-slate-400 whitespace-nowrap">{d.fraction}</span>
            </div>
          </td>
          <td class="py-2 px-3 text-right tabular-nums whitespace-nowrap">
            <span class="font-semibold text-slate-800">{formatSec(d.normalSec)}s</span>
            <br /><span class="text-xs text-slate-400">{formatMs(d.normalSec)}ms</span>
          </td>
          <td class="py-2 px-3 text-right tabular-nums whitespace-nowrap">
            <span class="font-semibold text-slate-800">{formatSec(d.dottedSec)}s</span>
            <br /><span class="text-xs text-slate-400">{formatMs(d.dottedSec)}ms</span>
          </td>
          <td class="py-2 pl-3 text-right tabular-nums whitespace-nowrap">
            <span class="font-semibold text-slate-800">{formatSec(d.tripletSec)}s</span>
            <br /><span class="text-xs text-slate-400">{formatMs(d.tripletSec)}ms</span>
          </td>
        </tr>
      {/each}
    </tbody>
  </table>
</div>
```

- [ ] **Step 2: ビルドが通ることを確認する**

```bash
npm run build
```

期待出力: `✓ built in ...` (エラーなし)

- [ ] **Step 3: コミットする**

```bash
git add src/lib/components/NoteDurationTable.svelte
git commit -m "feat: 音符秒数テーブルコンポーネントを追加"
```

---

## Task 5: ページ本体 & site.ts 登録

**Files:**
- Create: `src/routes/note-duration/+page.svelte`
- Modify: `src/lib/site.ts`

- [ ] **Step 1: `+page.svelte` を作成する**

`src/routes/note-duration/+page.svelte` を新規作成:

```svelte
<script lang="ts">
  import { page } from '$app/state'
  import { calculateNoteDurations, clampBpm, DEFAULT_BPM } from '$lib/noteDuration'
  import BpmInput from '$lib/components/BpmInput.svelte'
  import NoteDurationTable from '$lib/components/NoteDurationTable.svelte'

  let bpm = $state(DEFAULT_BPM)

  $effect(() => {
    const p = page.url.searchParams.get('bpm')
    if (!p) return
    const n = parseFloat(p)
    if (!Number.isNaN(n)) bpm = clampBpm(n)
  })

  const durations = $derived(calculateNoteDurations(bpm))
</script>

<svelte:head>
  <title>BPM音符換算ツール｜32分音符〜全音符の秒数を計算</title>
  <meta name="description" content="BPMを入力するだけで、全音符から32分音符までの長さを秒・msで自動計算。付点・3連符にも対応した楽曲制作向けツール。" />
</svelte:head>

<div class="max-w-lg mx-auto px-4 py-6 space-y-4">
  <!-- 広告枠 top -->
  <div class="ad-slot ad-slot--top flex h-24 items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 text-xs text-slate-400">
    広告枠
  </div>

  <div>
    <h1 class="text-2xl font-bold text-slate-800">BPM音符換算ツール</h1>
    <p class="mt-1 text-sm text-slate-500">BPMを入力すると、32分音符から全音符までの長さを表示します。</p>
  </div>

  <BpmInput bind:bpm />

  <!-- 広告枠 in-content -->
  <div class="ad-slot ad-slot--in-content flex h-24 items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 text-xs text-slate-400">
    広告枠
  </div>

  <NoteDurationTable {durations} />
</div>
```

- [ ] **Step 2: `site.ts` に登録する**

`src/lib/site.ts` の `tools` 配列の先頭（BPM Tapperの直後）に追加する。

現在の BPM Tapper エントリの後ろ（`href: "/bpm-tapper"` のブロックの閉じ `},` の直後）に挿入:

```ts
    {
      href: "/note-duration",
      label: "BPM音符換算(開発中)",
      description: "BPMから全音符〜32分音符の長さを秒・msで計算するツール",
      visible: true,
      category: 'music',
    },
```

変更後の `tools` 配列先頭部分のイメージ:

```ts
  tools: [
    {
      href: "/bpm-tapper",
      label: "BPM Tapper",
      description: "タップしてBPMを計測するツール",
      visible: true,
      category: 'music',
    },
    {
      href: "/note-duration",
      label: "BPM音符換算(開発中)",
      description: "BPMから全音符〜32分音符の長さを秒・msで計算するツール",
      visible: true,
      category: 'music',
    },
    // ... 既存エントリが続く
```

- [ ] **Step 3: ビルドが通ることを確認する**

```bash
npm run build
```

期待出力: `✓ built in ...` (エラーなし)

- [ ] **Step 4: コミットする**

```bash
git add src/routes/note-duration/+page.svelte src/lib/site.ts
git commit -m "feat: BPM音符換算ページを追加"
```

---

## Task 6: BPM Tapperに音符換算リンクを追加

**Files:**
- Modify: `src/routes/bpm-tapper/+page.svelte`

- [ ] **Step 1: 現在の説明文セクションを確認する**

`src/routes/bpm-tapper/+page.svelte` を開き、`<!-- Description -->` コメントのブロックを見つける。このブロックは `border-t border-slate-100` クラスを持つ `<div>` 内にある。

- [ ] **Step 2: 説明文セクションの末尾にリンクを追加する**

`<!-- Description -->` ブロック内の最後の `</div>` の直前（スライダーの説明文 `<p>` の後）に以下を追加する:

```svelte
    <div class="mt-4 pt-3 border-t border-slate-100 text-center">
      <a
        href="/note-duration?bpm={mainBpm !== null ? Math.round(mainBpm) : 120}"
        class="text-sm font-medium text-teal-700 hover:underline"
      >音符換算で開く →</a>
    </div>
```

追加後の説明文セクション末尾はこの形になる:

```svelte
  <!-- Description -->
  <div class="w-full max-w-sm px-4 py-5 mt-2 border-t border-slate-100">
    <h2 class="text-sm font-semibold text-slate-700 mb-2">BPM Tapperとは</h2>
    <p class="text-xs text-slate-500 leading-relaxed">
      音楽のビートに合わせてTAPボタンを叩くと、テンポ（BPM）をリアルタイムで測定します。
      タップするたびに直前との間隔から瞬間BPMを算出し、その平均値を大きく表示します。
    </p>
    <h2 class="text-sm font-semibold text-slate-700 mt-4 mb-2">スライダーについて</h2>
    <p class="text-xs text-slate-500 leading-relaxed">
      スライダーで平均を取るタップ数を調整できます。
      左端では全タップの平均、右端では直近1タップのみの瞬間BPMを表示します。
      グラフの青い折れ線が平均範囲、灰色が対象外のタップを示しています。
    </p>
    <div class="mt-4 pt-3 border-t border-slate-100 text-center">
      <a
        href="/note-duration?bpm={mainBpm !== null ? Math.round(mainBpm) : 120}"
        class="text-sm font-medium text-teal-700 hover:underline"
      >音符換算で開く →</a>
    </div>
  </div>
```

- [ ] **Step 3: ビルドが通ることを確認する**

```bash
npm run build
```

期待出力: `✓ built in ...` (エラーなし)

- [ ] **Step 4: コミットする**

```bash
git add src/routes/bpm-tapper/+page.svelte
git commit -m "feat: BPM Tapperに音符換算ページへのリンクを追加"
```

---

## Task 7: 最終確認

**Files:** 変更なし（確認のみ）

- [ ] **Step 1: 全テストがパスすることを確認する**

```bash
npm run build && npx vitest run
```

期待出力:
- `✓ built in ...`
- `✓ src/lib/noteDuration.test.ts (17 tests)`
- 既存テストも全てパス

- [ ] **Step 2: 開発サーバーで動作確認する**

```bash
npm run dev
```

ブラウザで `http://localhost:5173/note-duration` を開き、以下を確認:

1. BPM入力（数値・スライダー・±ボタン）でテーブルがリアルタイム更新される
2. 全音符〜32分音符の6行が表示される
3. 各行にSVG音符アイコンが表示される（全音符は中抜き・符幹なし、32分音符は塗り・符幹・旗3本）
4. 通常・付点・3連符の3列が常時表示される
5. 広告枠（破線ボーダーのプレースホルダー）が2箇所表示される
6. ナビゲーションの「楽曲制作」カテゴリに「BPM音符換算(開発中)」が表示される

- [ ] **Step 3: `?bpm=` URLパラメータを確認する**

`http://localhost:5173/note-duration?bpm=140` を開き、BPM入力欄が 140 になっていることを確認する。

- [ ] **Step 4: BPM Tapperのリンクを確認する**

`http://localhost:5173/bpm-tapper` を開き、説明文セクションの末尾に「音符換算で開く →」リンクが表示されていることを確認する。いくつかタップした後にリンクをクリックし、note-durationが計測したBPMで開くことを確認する。
