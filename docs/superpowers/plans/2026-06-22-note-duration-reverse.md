# Note Duration 逆引き機能 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 既存の NoteDuration ページにタブを追加し、ms を入力すると近い BPM＋音符の組み合わせを返す逆引き機能を実装する。

**Architecture:** `noteDuration.ts` に `findNearestNotes()` を追加、新規コンポーネント `NoteReverseSearch.svelte` でUIを担い、既存の `+page.svelte` にタブ切り替えを追加する。3ファイルの変更で機能が完結する。

**Tech Stack:** SvelteKit 2 / Svelte 5 (runes), TypeScript, Tailwind CSS, Vitest

---

## ファイル構成

| ファイル | 種別 | 内容 |
|---|---|---|
| `src/lib/noteDuration.ts` | 修正 | 型追加・`findNearestNotes()` 追加・既存型バグ修正 |
| `src/lib/noteDuration.test.ts` | 修正 | 壊れたテスト修正・新テスト追加 |
| `src/lib/components/NoteReverseSearch.svelte` | 新規 | 逆引きUIコンポーネント |
| `src/routes/note-duration/+page.svelte` | 修正 | タブ追加 |

---

### Task 1: 既存の壊れたテストを修正してグリーンにする

**Files:**
- Modify: `src/lib/noteDuration.ts`
- Modify: `src/lib/noteDuration.test.ts`

**背景:** `sixtyfourth`（64分音符）が `NOTE_DEFS` に追加されたが、テストが 6 件を期待したまま未更新で失敗している。また `NoteSymbol.flags` の型が `0|1|2|3` と宣言されているが `sixtyfourth` は `flags: 4` を使っており TypeScript エラーになる。

- [ ] **Step 1: `NoteSymbol.flags` の型を修正する**

`src/lib/noteDuration.ts` の `NoteSymbol` インターフェースを以下に変更：

```ts
export interface NoteSymbol {
  filled: boolean
  stem: boolean
  flags: 0 | 1 | 2 | 3 | 4
}
```

- [ ] **Step 2: テストを 7 件に更新する**

`src/lib/noteDuration.test.ts` の該当テストを以下に変更：

```ts
test('7種類の音符を返す', () => {
  expect(durations).toHaveLength(7)
  const ids = durations.map(d => d.id)
  expect(ids).toEqual(['whole','half','quarter','eighth','sixteenth','thirtysecond','sixtyfourth'])
})
```

- [ ] **Step 3: テストがグリーンになることを確認する**

```bash
npx vitest run src/lib/noteDuration.test.ts
```

Expected: `Test Files 1 passed (1)` / `Tests 18 passed (18)`

- [ ] **Step 4: コミット**

```bash
git add src/lib/noteDuration.ts src/lib/noteDuration.test.ts
git commit -m "fix: 64分音符追加に伴うflagsの型とテストを修正"
```

---

### Task 2: `findNearestNotes()` を `noteDuration.ts` に追加する

**Files:**
- Modify: `src/lib/noteDuration.ts`
- Modify: `src/lib/noteDuration.test.ts`

- [ ] **Step 1: 新しいテストを書く（まだ失敗する）**

`src/lib/noteDuration.test.ts` の末尾に追加：

```ts
import {
  clampBpm, calculateNoteDurations, formatSec, formatMs,
  findNearestNotes,
  MIN_BPM, MAX_BPM, DEFAULT_BPM,
} from './noteDuration'

// ... 既存のテストの下に追加 ...

describe('findNearestNotes', () => {
  test('targetMs <= 0 は空配列を返す', () => {
    expect(findNearestNotes(0,  { mode: 'topN' })).toEqual([])
    expect(findNearestNotes(-1, { mode: 'topN' })).toEqual([])
  })

  test('BPM 120 で 500ms を検索すると topN 1 件目は 4分音符（通常）になる', () => {
    const results = findNearestNotes(500, { mode: 'topN', topN: 1, bpmMin: 120, bpmMax: 120 })
    expect(results).toHaveLength(1)
    expect(results[0].bpm).toBe(120)
    expect(results[0].noteId).toBe('quarter')
    expect(results[0].variant).toBe('normal')
    expect(results[0].durationMs).toBeCloseTo(500, 5)
    expect(results[0].diffMs).toBeCloseTo(0, 5)
  })

  test('BPM 120 で 750ms を検索すると付点4分音符が最上位になる（includeDotted: true）', () => {
    const results = findNearestNotes(750, {
      mode: 'topN', topN: 1, bpmMin: 120, bpmMax: 120, includeDotted: true,
    })
    expect(results[0].noteId).toBe('quarter')
    expect(results[0].variant).toBe('dotted')
    expect(results[0].durationMs).toBeCloseTo(750, 5)
  })

  test('includeDotted: false では付点が含まれない', () => {
    const results = findNearestNotes(750, {
      mode: 'topN', topN: 50, bpmMin: 120, bpmMax: 120, includeDotted: false,
    })
    expect(results.every(r => r.variant !== 'dotted')).toBe(true)
  })

  test('includeTriplet: true では3連符が含まれる', () => {
    const results = findNearestNotes(333.33, {
      mode: 'topN', topN: 1, bpmMin: 120, bpmMax: 120, includeTriplet: true, includeDotted: false,
    })
    expect(results[0].variant).toBe('triplet')
    expect(results[0].noteId).toBe('quarter')
  })

  test('mode=tolerance では diffPct が閾値以内の結果だけ返す', () => {
    const results = findNearestNotes(500, {
      mode: 'tolerance', tolerancePct: 1, bpmMin: 20, bpmMax: 300,
    })
    expect(results.every(r => r.diffPct <= 1)).toBe(true)
    expect(results.length).toBeGreaterThan(0)
  })

  test('mode=topN でデフォルト 10 件を返す', () => {
    const results = findNearestNotes(500, { mode: 'topN' })
    expect(results.length).toBeLessThanOrEqual(10)
    expect(results.length).toBeGreaterThan(0)
  })

  test('結果は diffMs 昇順に並んでいる', () => {
    const results = findNearestNotes(500, { mode: 'topN', topN: 20 })
    for (let i = 1; i < results.length; i++) {
      expect(results[i].diffMs).toBeGreaterThanOrEqual(results[i - 1].diffMs)
    }
  })

  test('label に付点プレフィクスが付く', () => {
    const results = findNearestNotes(750, {
      mode: 'topN', topN: 1, bpmMin: 120, bpmMax: 120, includeDotted: true,
    })
    expect(results[0].label).toBe('付点4分音符')
  })

  test('label に3連符サフィクスが付く', () => {
    const results = findNearestNotes(333.33, {
      mode: 'topN', topN: 1, bpmMin: 120, bpmMax: 120, includeTriplet: true, includeDotted: false,
    })
    expect(results[0].label).toBe('4分音符（3連符）')
  })
})
```

- [ ] **Step 2: テストが失敗することを確認する**

```bash
npx vitest run src/lib/noteDuration.test.ts
```

Expected: FAIL with "findNearestNotes is not a function" または similar

- [ ] **Step 3: 型と関数を `noteDuration.ts` に追加する**

`src/lib/noteDuration.ts` の末尾に追加：

```ts
export type NoteVariant = 'normal' | 'dotted' | 'triplet'

export interface NoteMatch {
  bpm: number
  noteId: NoteId
  label: string
  variant: NoteVariant
  durationMs: number
  diffMs: number
  diffPct: number
}

export interface FindNearestNotesOptions {
  bpmMin?: number
  bpmMax?: number
  includeDotted?: boolean
  includeTriplet?: boolean
  topN?: number
  tolerancePct?: number
  mode: 'topN' | 'tolerance'
}

export function findNearestNotes(targetMs: number, options: FindNearestNotesOptions): NoteMatch[] {
  if (targetMs <= 0) return []

  const {
    bpmMin = MIN_BPM,
    bpmMax = MAX_BPM,
    includeDotted = true,
    includeTriplet = false,
    topN = 10,
    tolerancePct = 5,
    mode,
  } = options

  type VariantDef = { variant: NoteVariant; factor: number; prefix: string; suffix: string }
  const variants: VariantDef[] = [
    { variant: 'normal',  factor: 1,       prefix: '',     suffix: '' },
    ...(includeDotted  ? [{ variant: 'dotted'  as NoteVariant, factor: 1.5,   prefix: '付点', suffix: '' }]         : []),
    ...(includeTriplet ? [{ variant: 'triplet' as NoteVariant, factor: 2 / 3, prefix: '',     suffix: '（3連符）' }] : []),
  ]

  const results: NoteMatch[] = []

  const safeMin = Math.max(MIN_BPM, Math.floor(bpmMin ?? MIN_BPM))
  const safeMax = Math.min(MAX_BPM, Math.floor(bpmMax ?? MAX_BPM))

  for (let bpm = safeMin; bpm <= safeMax; bpm++) {
    const quarterMs = (60 / bpm) * 1000
    for (const noteDef of NOTE_DEFS) {
      for (const { variant, factor, prefix, suffix } of variants) {
        const durationMs = quarterMs * noteDef.mult * factor
        const diffMs = Math.abs(targetMs - durationMs)
        const diffPct = (diffMs / targetMs) * 100
        results.push({
          bpm,
          noteId: noteDef.id,
          label: `${prefix}${noteDef.label}${suffix}`,
          variant,
          durationMs,
          diffMs,
          diffPct,
        })
      }
    }
  }

  results.sort((a, b) => a.diffMs - b.diffMs)

  if (mode === 'topN') {
    return results.slice(0, Math.max(1, topN ?? 10))
  }
  return results.filter(r => r.diffPct <= (tolerancePct ?? 5))
}
```

- [ ] **Step 4: テストがグリーンになることを確認する**

```bash
npx vitest run src/lib/noteDuration.test.ts
```

Expected: `Tests 27 passed (27)`（既存 18 + 新規 9）

- [ ] **Step 5: コミット**

```bash
git add src/lib/noteDuration.ts src/lib/noteDuration.test.ts
git commit -m "feat: noteDuration に findNearestNotes() を追加"
```

---

### Task 3: `NoteReverseSearch.svelte` を新規作成する

**Files:**
- Create: `src/lib/components/NoteReverseSearch.svelte`

- [ ] **Step 1: コンポーネントを作成する**

`src/lib/components/NoteReverseSearch.svelte` を以下の内容で作成：

```svelte
<!-- src/lib/components/NoteReverseSearch.svelte -->
<script lang="ts">
  import { findNearestNotes, MIN_BPM, MAX_BPM } from '$lib/noteDuration'
  import type { NoteMatch } from '$lib/noteDuration'

  let msInput = $state('')
  let bpmMin = $state(MIN_BPM)
  let bpmMax = $state(MAX_BPM)
  let includeDotted = $state(true)
  let includeTriplet = $state(false)
  let mode = $state<'topN' | 'tolerance'>('topN')
  let topN = $state(10)
  let tolerancePct = $state(5)

  const targetMs = $derived(parseFloat(msInput))

  const results = $derived.by((): NoteMatch[] => {
    if (!Number.isFinite(targetMs) || targetMs <= 0) return []
    const safeMin = Math.min(bpmMin, bpmMax)
    const safeMax = Math.max(bpmMin, bpmMax)
    return findNearestNotes(targetMs, {
      bpmMin: safeMin,
      bpmMax: safeMax,
      includeDotted,
      includeTriplet,
      mode,
      topN,
      tolerancePct,
    })
  })

  function formatDiff(match: NoteMatch): string {
    if (match.diffMs < 0.05) return '±0.0ms'
    const sign = match.durationMs >= targetMs ? '+' : '−'
    return `${sign}${match.diffMs.toFixed(1)}ms`
  }
</script>

<div class="space-y-4">
  <!-- ms 入力 -->
  <div class="flex items-center gap-2">
    <label class="text-sm font-medium text-slate-700 shrink-0" for="ms-input">ms 入力</label>
    <input
      id="ms-input"
      type="number"
      min="0"
      step="0.1"
      bind:value={msInput}
      placeholder="例: 433.0"
      class="w-36 border border-slate-300 rounded-lg px-3 py-1.5 text-sm text-right tabular-nums focus:outline-none focus:ring-2 focus:ring-teal-600"
    />
    <span class="text-sm text-slate-500">ms</span>
  </div>

  <!-- BPM 範囲 -->
  <div class="flex items-center gap-2 flex-wrap">
    <span class="text-sm font-medium text-slate-700 shrink-0">BPM 範囲</span>
    <input
      type="number"
      min={MIN_BPM}
      max={MAX_BPM}
      bind:value={bpmMin}
      class="w-16 border border-slate-300 rounded-lg px-2 py-1.5 text-sm text-center tabular-nums focus:outline-none focus:ring-2 focus:ring-teal-600"
    />
    <span class="text-sm text-slate-400">〜</span>
    <input
      type="number"
      min={MIN_BPM}
      max={MAX_BPM}
      bind:value={bpmMax}
      class="w-16 border border-slate-300 rounded-lg px-2 py-1.5 text-sm text-center tabular-nums focus:outline-none focus:ring-2 focus:ring-teal-600"
    />
  </div>

  <!-- 含める音符 -->
  <div class="flex items-center gap-4 flex-wrap">
    <span class="text-sm font-medium text-slate-700 shrink-0">含める音符</span>
    <label class="flex items-center gap-1.5 text-sm text-slate-600 cursor-pointer">
      <input type="checkbox" bind:checked={includeDotted} class="accent-teal-600" />
      付点
    </label>
    <label class="flex items-center gap-1.5 text-sm text-slate-600 cursor-pointer">
      <input type="checkbox" bind:checked={includeTriplet} class="accent-teal-600" />
      3連符
    </label>
  </div>

  <!-- 表示方法 -->
  <div class="flex items-center gap-4 flex-wrap">
    <span class="text-sm font-medium text-slate-700 shrink-0">表示方法</span>
    <label class="flex items-center gap-1.5 text-sm text-slate-600 cursor-pointer">
      <input type="radio" bind:group={mode} value="topN" class="accent-teal-600" />
      上位
      <input
        type="number"
        min="1"
        max="50"
        bind:value={topN}
        disabled={mode !== 'topN'}
        class="w-14 border border-slate-300 rounded px-2 py-0.5 text-sm text-center tabular-nums focus:outline-none focus:ring-2 focus:ring-teal-600 disabled:opacity-40"
      />
      件
    </label>
    <label class="flex items-center gap-1.5 text-sm text-slate-600 cursor-pointer">
      <input type="radio" bind:group={mode} value="tolerance" class="accent-teal-600" />
      誤差
      <input
        type="number"
        min="0.1"
        max="50"
        step="0.1"
        bind:value={tolerancePct}
        disabled={mode !== 'tolerance'}
        class="w-16 border border-slate-300 rounded px-2 py-0.5 text-sm text-center tabular-nums focus:outline-none focus:ring-2 focus:ring-teal-600 disabled:opacity-40"
      />
      % 以内
    </label>
  </div>

  <!-- 結果テーブル -->
  {#if msInput === '' || (!Number.isFinite(targetMs) || targetMs <= 0)}
    <p class="text-sm text-slate-400 py-4 text-center">ms を入力してください</p>
  {:else if results.length === 0}
    <p class="text-sm text-slate-400 py-4 text-center">該当する音符が見つかりませんでした</p>
  {:else}
    <div class="overflow-x-auto rounded-lg border border-slate-200">
      <table class="w-full text-sm">
        <thead>
          <tr class="bg-slate-50 border-b border-slate-200">
            <th class="px-3 py-2 text-left font-semibold text-slate-600">BPM</th>
            <th class="px-3 py-2 text-left font-semibold text-slate-600">音符</th>
            <th class="px-3 py-2 text-right font-semibold text-slate-600">実際のms</th>
            <th class="px-3 py-2 text-right font-semibold text-slate-600">差分</th>
          </tr>
        </thead>
        <tbody>
          {#each results as match, i}
            <tr class="border-b border-slate-100 last:border-0 {i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}">
              <td class="px-3 py-2 tabular-nums font-mono text-slate-700">{match.bpm}</td>
              <td class="px-3 py-2 text-slate-700">{match.label}</td>
              <td class="px-3 py-2 tabular-nums font-mono text-right text-slate-700">{match.durationMs.toFixed(1)}</td>
              <td class="px-3 py-2 tabular-nums font-mono text-right {match.diffMs < 0.05 ? 'text-teal-600 font-semibold' : 'text-slate-500'}">
                {formatDiff(match)}
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</div>
```

- [ ] **Step 2: ビルドが通ることを確認する**

```bash
npm run build 2>&1 | tail -5
```

Expected: `✓ built in ...s`

- [ ] **Step 3: コミット**

```bash
git add src/lib/components/NoteReverseSearch.svelte
git commit -m "feat: NoteReverseSearch コンポーネントを追加"
```

---

### Task 4: `+page.svelte` にタブ切り替えを追加する

**Files:**
- Modify: `src/routes/note-duration/+page.svelte`

- [ ] **Step 1: ページを書き換える**

`src/routes/note-duration/+page.svelte` を以下の内容に置き換える：

```svelte
<script lang="ts">
  import { page } from '$app/state'
  import { calculateNoteDurations, clampBpm, DEFAULT_BPM } from '$lib/noteDuration'
  import BpmInput from '$lib/components/BpmInput.svelte'
  import NoteDurationTable from '$lib/components/NoteDurationTable.svelte'
  import NoteReverseSearch from '$lib/components/NoteReverseSearch.svelte'

  let bpm = $state(DEFAULT_BPM)
  let activeTab = $state<'forward' | 'reverse'>('forward')

  $effect(() => {
    const p = page.url.searchParams.get('bpm')
    if (!p) return
    const n = parseFloat(p)
    if (!Number.isNaN(n)) bpm = clampBpm(n)
  })

  const durations = $derived(calculateNoteDurations(bpm))
  const pageTitle = $derived(`BPM ${bpm} | Note Duration – 96X's Tools`)
</script>

<svelte:head>
  <title>{pageTitle}</title>
  <meta name="description" content="BPMを入力するだけで、全音符から32分音符までの長さを秒・msで自動計算。付点・3連符にも対応した楽曲制作向けツール。" />
</svelte:head>

<div class="max-w-lg mx-auto px-4 py-6 space-y-4">
  <div>
    <h1 class="text-2xl font-bold text-slate-800">Note Duration</h1>
    <p class="mt-1 text-sm text-slate-500">BPMと音符の長さを相互に変換します。</p>
  </div>

  <!-- タブ -->
  <div class="flex border-b border-slate-200">
    <button
      type="button"
      onclick={() => { activeTab = 'forward' }}
      class="px-4 py-2 text-sm font-medium border-b-2 transition-colors {activeTab === 'forward' ? 'border-teal-600 text-teal-700' : 'border-transparent text-slate-500 hover:text-slate-700'}"
    >BPM → 音符長</button>
    <button
      type="button"
      onclick={() => { activeTab = 'reverse' }}
      class="px-4 py-2 text-sm font-medium border-b-2 transition-colors {activeTab === 'reverse' ? 'border-teal-600 text-teal-700' : 'border-transparent text-slate-500 hover:text-slate-700'}"
    >ms → 音符</button>
  </div>

  {#if activeTab === 'forward'}
    <BpmInput bind:bpm />
    <NoteDurationTable {durations} />

    <div class="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-3 text-sm text-slate-600">
      <h2 class="font-semibold text-slate-700">使い方</h2>
      <p>BPM（Beats Per Minute）を入力すると、各音符の長さをミリ秒・Hzで自動計算します。DAW での遅延設定やシンセのエンベロープ調整など、楽曲制作に役立ててください。セルをクリックすると数値をコピーできます。</p>
      <h2 class="font-semibold text-slate-700">計算式</h2>
      <div class="space-y-1 font-mono text-xs bg-white border border-slate-200 rounded p-3">
        <p>1拍（4分音符） = 60 ÷ BPM （秒）</p>
        <p>各音符 = 1拍 × 倍率</p>
        <div class="pl-4 text-slate-400 space-y-0.5 mt-1">
          <p>全音符 ×4　2分音符 ×2　4分音符 ×1</p>
          <p>8分音符 ×½　16分音符 ×¼　32分音符 ×⅛　64分音符 ×1/16</p>
        </div>
        <p class="mt-1">付点 = 基本値 × 1.5</p>
        <p>3連符 = 基本値 × 2/3</p>
        <p class="mt-1">Hz = 1 ÷ 秒数</p>
      </div>
      <h2 class="font-semibold text-slate-700">表の見かた</h2>
      <ul class="space-y-1 list-disc list-inside">
        <li><span class="font-medium">通常</span>：基本の音符長さ</li>
        <li><span class="font-medium">付点</span>：音符の長さ × 1.5倍</li>
        <li><span class="font-medium">3連符</span>：音符の長さ × 2/3倍</li>
      </ul>
    </div>
  {:else}
    <NoteReverseSearch />

    <div class="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-3 text-sm text-slate-600">
      <h2 class="font-semibold text-slate-700">使い方</h2>
      <p>ミリ秒（ms）を入力すると、その長さに近い「BPM と音符の組み合わせ」を一覧表示します。DAW のサンプルやエフェクトのディレイ値を入力することで、対応する音符を見つけられます。</p>
      <h2 class="font-semibold text-slate-700">表示モード</h2>
      <ul class="space-y-1 list-disc list-inside">
        <li><span class="font-medium">上位 N 件</span>：差分が小さい順に指定件数を表示</li>
        <li><span class="font-medium">誤差 X% 以内</span>：入力値との差が指定割合以内の結果をすべて表示</li>
      </ul>
    </div>
  {/if}
</div>
```

- [ ] **Step 2: ビルドが通ることを確認する**

```bash
npm run build 2>&1 | tail -5
```

Expected: `✓ built in ...s`

- [ ] **Step 3: 全テストがグリーンであることを確認する**

```bash
npx vitest run src/lib/noteDuration.test.ts
```

Expected: `Tests 27 passed (27)`

- [ ] **Step 4: 開発サーバーで動作確認する**

```bash
npm run dev
```

ブラウザで `http://localhost:5173/note-duration` を開き：
1. 「ms → 音符」タブをクリック → タブが切り替わること
2. `500` と入力 → BPM 120 / 4分音符 が上位に表示されること
3. `750` と入力、付点チェックON → 付点4分音符 BPM 120 が最上位になること
4. 誤差モードに切り替え、`5` → 結果がフィルタされること
5. BPM 範囲を `120` 〜 `120` に絞り込み → 120 のみの結果になること
6. 「BPM → 音符長」タブに戻る → 既存機能が壊れていないこと

- [ ] **Step 5: コミット**

```bash
git add src/routes/note-duration/+page.svelte
git commit -m "feat: Note Duration に ms → 音符の逆引きタブを追加"
```
