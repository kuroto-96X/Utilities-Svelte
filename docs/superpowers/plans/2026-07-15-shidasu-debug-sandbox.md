# Shidasu デバッグサンドボックス画面 実装プラン

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/admin/shidasu-debug` に、護符の効果検証を高速化するための独立サンドボックス画面を新設する。通常プレイと同じ盤面を配り、カードパレットからのドラッグ&ドロップで場札・山札の任意のカードを入れ替え、護符をチェックボックスで自由に付与/削除しながら、その場の得点計算・内部状態を確認できるようにする。

**Architecture:** `src/lib/game/shidasu/engine.ts` の純粋関数(`startWave`・`playCard`・`drawStock`・`forceStockTop`)をそのまま呼び出す、`/game/shidasu` の実プレイセッションとは完全に独立したページ。state はページコンポーネントの Svelte 5 runes のみで完結し、永続化やタブ間連携は行わない。カード入れ替えは `src/routes/game/solitaire/+page.svelte` で実績のあるポインターイベントベースの自前ドラッグ実装を踏襲する。既存の `src/routes/game/shidasu/DebugPanel.svelte` は変更せず、新設する `DebugStatePanel.svelte` から直接インポートして再利用する。

**Tech Stack:** SvelteKit + Svelte 5 runes、TypeScript、Vitest。参照元スペック: `docs/superpowers/specs/2026-07-15-shidasu-debug-sandbox-design.md`

---

## 前提知識(実装前に把握しておくこと)

- `startWave(params, stageIndex, waveIndex, items, deckComposition, seed?)` は `{ wave: WaveState; deckComposition: DeckCard[] }` を返す純粋関数(`src/lib/game/shidasu/engine.ts:68`)。本サンドボックスでは `stageIndex`/`waveIndex` に常に `0, 0` を渡す(実際には使われない)。
- `playCard(params, wave, modifier, items, target, colIndex, rand?)` は `wave.tableau[colIndex]` の**先頭(配列末尾)のカードのみ**をプレイする純粋関数(`engine.ts:137`)。`modifier` は本サンドボックスでは常に `'none'` を渡す。
- `drawStock(params, wave, items, deckComposition, modifier?, rand?)` は `{ wave, deckComposition }` を返す純粋関数(`engine.ts:403`)。
- `forceStockTop(wave, suit, rank, wild)` は山札の次にめくられる位置のカードを差し替える(`engine.ts:1849`)。既存 `DebugPanel.svelte` の「山札の次を強制指定」フォームが使う。
- `ITEM_POOL: ItemId[]`(`engine.ts:1204`)が全87種類の唯一の正とする配列。`docs/shidasu-gofu-candidates.md` は未実装候補(例: 「謙虚」)が混在しており、グルーピングの正としては使わない。
- `ITEM_NAMES: Record<ItemId, string>`・`itemDesc(id, params): string` はどちらも `engine.ts` から export 済み。
- `Card { id, suit, rank, wild }`、`DeckCard { suit, rank, wild }`、`Suit = '♠'|'♥'|'♦'|'♣'|'★'`、`Rank = 0|1|...|13`(`types.ts`)。ワイルドは `suit: '★', rank: 0, wild: true`。
- `standardDeckComposition(): DeckCard[]` は `src/lib/game/shidasu/deck.ts` から export。
- `src/routes/game/shidasu/DebugPanel.svelte` の props は `{ wave: WaveState; onForceDraw: (suit, rank, wild) => void }`。combo・chain・獲得点ログ・「山札の次を強制指定」フォームを内部で完結して表示する。**このファイルは変更しない。**
- vitest 設定(`vitest.config.ts`)は `environment: 'node'` かつ Svelte プラグイン未登録のため、`.svelte` ファイルを直接 import するユニットテストは書けない。UI コンポーネントの検証は `npm run build` + `npm run check` + `npm run dev` でのブラウザ確認で行う(このプロジェクトの既存パターンを踏襲)。ロジックを `.ts` に切り出せる箇所(護符のグルーピングデータ)だけは通常どおり TDD で `.test.ts` を書く。

---

## ファイル構成

- `src/routes/admin/+page.svelte`(既存を修正): リンク追加
- `src/routes/admin/shidasu-debug/+page.svelte`(新規): ページ全体。state管理・盤面表示・プレイ/山札めくり・ドラッグ&ドロップの座標判定・Undo
- `src/routes/admin/shidasu-debug/itemGroups.ts`(新規): 87護符のグルーピングデータ(純粋データ、TDD対象)
- `src/routes/admin/shidasu-debug/itemGroups.test.ts`(新規): 上記の網羅性テスト
- `src/routes/admin/shidasu-debug/ItemChecklist.svelte`(新規): 護符チェックリストUI
- `src/routes/admin/shidasu-debug/CardPalette.svelte`(新規): 53種カードパレットUI(ドラッグ元)
- `src/routes/admin/shidasu-debug/DebugStatePanel.svelte`(新規): 内部状態パネル(既存DebugPanelを再利用)

---

### Task 1: `/admin` 一覧にリンクを追加

**Files:**
- Modify: `src/routes/admin/+page.svelte`

- [ ] **Step 1: リンクを追加する**

`src/routes/admin/+page.svelte` の `<a href="/admin/shidasu" ...>` ブロックの直後(`</a>` の次の行、`</div>` の前)に、以下を追加する。

```svelte
    <a href="/admin/shidasu-debug" class="flex items-center gap-3 px-4 py-4 hover:bg-slate-50 transition-colors group">
      <div class="flex-1">
        <p class="text-sm font-semibold text-slate-700 group-hover:text-teal-700">星詠みソリティア -Shidasu- デバッグサンドボックス</p>
        <p class="text-xs text-slate-400 mt-0.5">護符の付与/削除・場札/山札のカード入れ替えで効果を検証</p>
      </div>
      <span class="text-slate-300 group-hover:text-teal-600 transition-colors">→</span>
    </a>
```

- [ ] **Step 2: ビルド確認**

Run: `npm run build`
Expected: エラーなく成功

- [ ] **Step 3: コミット**

```bash
git add src/routes/admin/+page.svelte
git commit -m "$(cat <<'EOF'
feat: 管理ページにShidasuデバッグサンドボックスへのリンクを追加

EOF
)"
```

---

### Task 2: ルート雛形・盤面表示・プレイ/山札めくり・新しいウェーブ

この時点では護符は常に空配列(`[]`)固定。護符の付与/削除・カード入れ替え・内部状態パネルは後続タスクで追加する。

**Files:**
- Create: `src/routes/admin/shidasu-debug/+page.svelte`

- [ ] **Step 1: ページを作成する**

```svelte
<script lang="ts">
  import { loadParams } from '$lib/game/shidasu/params'
  import { startWave, playCard, drawStock, getPlayableColumns, isRed, rankLabel } from '$lib/game/shidasu/engine'
  import { standardDeckComposition } from '$lib/game/shidasu/deck'
  import type { WaveState, Card, ItemId, DeckCard } from '$lib/game/shidasu/types'

  const params = loadParams()
  const TARGET = Number.MAX_SAFE_INTEGER

  let items = $state<ItemId[]>([])
  let deckComposition = $state<DeckCard[]>(standardDeckComposition())
  let wave = $state<WaveState>(startWave(params, 0, 0, items, deckComposition).wave)

  const PIP_LAYOUTS: Record<number, [number, number, boolean][]> = {
    1:  [[50, 50, false]],
    2:  [[50, 18, false], [50, 82, true]],
    3:  [[50, 14, false], [50, 50, false], [50, 86, true]],
    4:  [[25, 18, false], [75, 18, false], [25, 82, true], [75, 82, true]],
    5:  [[25, 18, false], [75, 18, false], [50, 50, false], [25, 82, true], [75, 82, true]],
    6:  [[25, 15, false], [75, 15, false], [25, 50, false], [75, 50, false], [25, 85, true], [75, 85, true]],
    7:  [[25, 13, false], [75, 13, false], [50, 30, false], [25, 52, false], [75, 52, false], [25, 85, true], [75, 85, true]],
    8:  [[25, 11, false], [75, 11, false], [50, 28, false], [25, 50, false], [75, 50, false], [50, 72, true], [25, 89, true], [75, 89, true]],
    9:  [[25, 9, false], [75, 9, false], [25, 35, false], [75, 35, false], [50, 50, false], [25, 65, true], [75, 65, true], [25, 91, true], [75, 91, true]],
    10: [[25, 9, false], [75, 9, false], [50, 26, false], [25, 37, false], [75, 37, false], [25, 63, true], [75, 63, true], [50, 74, true], [25, 91, true], [75, 91, true]],
  }
  const FACE_CHAR: Record<number, string> = { 11: '♞', 12: '♛', 13: '♚' }

  function newWave() {
    const result = startWave(params, 0, 0, items, deckComposition)
    wave = result.wave
    deckComposition = result.deckComposition
  }

  function handlePlayCard(colIndex: number) {
    wave = playCard(params, wave, 'none', items, TARGET, colIndex)
  }

  function handleDraw() {
    const result = drawStock(params, wave, items, deckComposition, 'none')
    wave = result.wave
    deckComposition = result.deckComposition
  }

  let playableCols = $derived(getPlayableColumns('none', wave))
</script>

<svelte:head>
  <title>Shidasu デバッグサンドボックス</title>
</svelte:head>

{#snippet cardFace(card: Card, covered: boolean)}
  {#if card.wild}
    <div
      class="relative w-full rounded-lg border p-1 flex flex-col items-start overflow-hidden select-none"
      style="aspect-ratio: 2 / 3; background:#EDE4FF; border-color:#A78BFA; color:#6D28D9;"
    >
      <div class="flex items-center gap-0.5 leading-none">
        <span class="text-sm font-bold leading-none">{rankLabel(card)}</span>
      </div>
      {#if !covered}
        <div class="w-full flex-1 flex items-center justify-center">
          <span class="leading-none" style="font-size:26px;">{rankLabel(card)}</span>
        </div>
        <div class="rotate-180 self-end flex items-center gap-0.5 leading-none">
          <span class="text-sm font-bold leading-none">{rankLabel(card)}</span>
        </div>
      {/if}
    </div>
  {:else}
    {@const colorClass = isRed(card) ? 'text-red-600' : 'text-slate-900'}
    <div
      class="relative w-full rounded-lg border border-indigo-500/50 p-1 flex flex-col items-start overflow-hidden bg-white select-none"
      style="aspect-ratio: 2 / 3;"
    >
      <div class="flex items-center gap-0.5 leading-none {colorClass}">
        <span class="text-sm font-bold leading-none">{rankLabel(card)}</span>
        <span class="text-xs leading-none">{card.suit}</span>
      </div>
      {#if !covered}
        {#if card.rank <= 10}
          <div class="w-full flex-1 relative {colorClass}">
            {#each (PIP_LAYOUTS[card.rank] ?? []) as [x, y, rot], i (i)}
              <span
                class="absolute leading-none select-none"
                style="left:{x}%; top:{y}%; transform:translate(-50%,-50%){rot ? ' rotate(180deg)' : ''}; font-size:{card.rank === 1 ? 18 : card.rank <= 4 ? 11 : card.rank <= 7 ? 10 : 9}px;"
              >{card.suit}</span>
            {/each}
          </div>
        {:else}
          <div class="w-full flex-1 flex items-center justify-center {colorClass}">
            <span class="leading-none" style="font-size:26px;">{FACE_CHAR[card.rank]}</span>
          </div>
        {/if}
        <div class="rotate-180 self-end flex items-center gap-0.5 leading-none {colorClass}">
          <span class="text-sm font-bold leading-none">{rankLabel(card)}</span>
          <span class="text-xs leading-none">{card.suit}</span>
        </div>
      {/if}
    </div>
  {/if}
{/snippet}

<div class="min-h-screen bg-slate-50 px-4 py-4">
  <div class="flex items-center justify-between mb-3">
    <h1 class="text-lg font-bold text-slate-800">Shidasu デバッグサンドボックス</h1>
    <button type="button" onclick={newWave} class="px-3 py-1.5 rounded bg-teal-600 text-white text-sm font-bold">新しいウェーブ</button>
  </div>

  <div class="grid gap-4 items-start" style="grid-template-columns: 1fr 360px;">
    <div class="bg-emerald-950 rounded-lg p-3">
      <div class="text-emerald-100 text-xs mb-2">score: {wave.score} / status: {wave.status} / endReason: {wave.endReason ?? 'null'}</div>
      <div class="grid gap-1" style="grid-template-columns: repeat({params.layout.cols}, minmax(0, 1fr));">
        {#each wave.tableau as col, ci (ci)}
          <div class="relative" style="min-height: 12rem;">
            {#each col as card, ri (card.id)}
              {@const isTop = ri === col.length - 1}
              <div class="absolute left-0 right-0" style="top:{ri * 18}px; z-index:{ri}; width:64px;">
                {#if isTop}
                  <button type="button" onclick={() => handlePlayCard(ci)} class="w-full text-left {playableCols.has(ci) ? 'ring-2 ring-yellow-300' : ''}">
                    {@render cardFace(card, false)}
                  </button>
                {:else}
                  {@render cardFace(card, false)}
                {/if}
              </div>
            {/each}
          </div>
        {/each}
      </div>
      <div class="mt-16 flex items-center gap-3">
        <button
          type="button"
          onclick={handleDraw}
          disabled={wave.stock.length === 0}
          style="aspect-ratio: 2/3; width:64px;"
          class="rounded-lg border-2 flex flex-col items-center justify-center font-black {wave.stock.length > 0 ? 'bg-emerald-700 border-emerald-500 text-amber-50' : 'bg-emerald-900 border-emerald-800 text-emerald-700'}"
        >
          <div class="text-xs">山札</div>
          <div class="text-lg tabular-nums">{wave.stock.length}</div>
        </button>
        <div class="flex flex-wrap gap-1">
          {#each wave.chain as c (c.id)}
            <div style="width:48px;">{@render cardFace(c, false)}</div>
          {/each}
        </div>
      </div>
    </div>
    <div class="space-y-4">
      <div class="text-xs text-slate-500">護符チェックリスト・カードパレット・内部状態パネルは以降のタスクで追加します。</div>
    </div>
  </div>
</div>
```

- [ ] **Step 2: ビルド・型チェック**

Run: `npm run build && npm run check`
Expected: どちらもエラーなく成功

- [ ] **Step 3: ブラウザで確認**

Run: `npm run dev` → `http://localhost:5173/admin/shidasu-debug` を開く
Expected: 盤面が配られ、場札クリックでプレイ、山札クリックでめくりができ、「新しいウェーブ」で盤面が再度配られる

- [ ] **Step 4: コミット**

```bash
git add src/routes/admin/shidasu-debug/+page.svelte
git commit -m "$(cat <<'EOF'
feat: Shidasuデバッグサンドボックスの盤面表示とプレイ操作を追加

EOF
)"
```

---

### Task 3: 護符グルーピングデータ(TDD)+ チェックリストUI

**Files:**
- Create: `src/routes/admin/shidasu-debug/itemGroups.ts`
- Create: `src/routes/admin/shidasu-debug/itemGroups.test.ts`
- Create: `src/routes/admin/shidasu-debug/ItemChecklist.svelte`
- Modify: `src/routes/admin/shidasu-debug/+page.svelte`

- [ ] **Step 1: 失敗するテストを書く**

`src/routes/admin/shidasu-debug/itemGroups.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { ITEM_GROUPS } from './itemGroups'
import { ITEM_POOL } from '$lib/game/shidasu/engine'

describe('ITEM_GROUPS', () => {
  it('ITEM_POOLの全種類を過不足なく分類している', () => {
    const flattened = ITEM_GROUPS.flatMap(g => g.ids)
    expect(new Set(flattened)).toEqual(new Set(ITEM_POOL))
  })

  it('同じ護符が複数グループに重複していない', () => {
    const flattened = ITEM_GROUPS.flatMap(g => g.ids)
    expect(flattened.length).toBe(new Set(flattened).size)
  })

  it('件数がITEM_POOLと一致する', () => {
    const flattened = ITEM_GROUPS.flatMap(g => g.ids)
    expect(flattened.length).toBe(ITEM_POOL.length)
  })
})
```

- [ ] **Step 2: テストを実行して失敗を確認する**

Run: `npm run test -- itemGroups`
Expected: FAIL(`itemGroups.ts` が存在しないため import エラー)

- [ ] **Step 3: `itemGroups.ts` を実装する**

`docs/shidasu-gofu-candidates.md` の章立てに沿いつつ、`engine.ts` の `ITEM_POOL` 配列の並び(実装順のまとまり)を正として分類する。

```ts
// src/routes/admin/shidasu-debug/itemGroups.ts
import type { ItemId } from '$lib/game/shidasu/types'

export interface ItemGroup {
  label: string
  ids: ItemId[]
}

export const ITEM_GROUPS: ItemGroup[] = [
  { label: '初期実装', ids: ['bridge', 'grace'] },
  { label: 'グループ1: 全消しボーナス', ids: ['patience', 'purify', 'temperance'] },
  { label: 'グループ2: カード単体の属性', ids: ['springBreeze', 'summerBreeze', 'autumnBreeze', 'winterBreeze', 'kinship', 'thaw', 'dusk', 'dawn', 'wit'] },
  { label: 'グループ3: 現在のコンボ数判定', ids: ['courage', 'daybreak', 'twilight', 'cheerful', 'conscience', 'morningMist'] },
  { label: 'グループ4: チェーン全体の属性', ids: ['calm', 'serenity', 'destiny', 'fate', 'relief', 'verdantGreen', 'gem', 'resolve', 'grail', 'moonlight', 'sunlight', 'crown', 'cloverLeaf', 'coin', 'blade', 'chalice', 'balance', 'harmony', 'nobility', 'tenacity', 'determination', 'cycle', 'reincarnation', 'majesty'] },
  { label: 'グループ5: 場札・山札の残り枚数', ids: ['omen', 'crescent'] },
  { label: 'グループ6: 役・パターン成立状況', ids: ['blessing', 'focus', 'lapis', 'jade', 'emptyMind'] },
  { label: 'グループ7: コンボ内の位置', ids: ['prologue', 'interlude', 'morningDew'] },
  { label: 'グループ8: 無条件固定加算', ids: ['drizzle'] },
  { label: '永続デッキ・捨て札系', ids: ['eternity', 'abundance', 'silence', 'resilience'] },
  { label: 'グループ9: 列選択の連続性', ids: ['gentleBreeze', 'resonance'] },
  { label: 'グループ10: ウェーブ内累積state', ids: ['azureSky', 'amber'] },
  { label: 'グループ11: イベント発生時の直接点', ids: ['composure', 'clarity', 'arrogance', 'echo', 'shootingStar'] },
  { label: 'グループ12: 山札めくり関連', ids: ['naive', 'intuition', 'sincerity'] },
  { label: 'グループ13: 資源操作(残り)', ids: ['promise', 'darkClouds', 'regeneration'] },
  { label: 'グループ14: 保護・救済', ids: ['benevolence', 'healing'] },
  { label: 'グループ15: 情報表示', ids: ['guidance'] },
  { label: 'グループ16: 持続効果', ids: ['passion', 'fightingSpirit'] },
  { label: 'グループ17: コアパラメータ書き換え', ids: ['sanctify', 'protection', 'earth', 'golden', 'morningStar', 'mercy', 'mirror', 'deadline'] },
]
```

- [ ] **Step 4: テストを実行して成功を確認する**

Run: `npm run test -- itemGroups`
Expected: PASS(3件とも成功)

- [ ] **Step 5: `ItemChecklist.svelte` を作成する**

```svelte
<script lang="ts">
  import { ITEM_NAMES, itemDesc } from '$lib/game/shidasu/engine'
  import { loadParams } from '$lib/game/shidasu/params'
  import type { ItemId } from '$lib/game/shidasu/types'
  import { ITEM_GROUPS } from './itemGroups'

  let { items, onToggle }: {
    items: ItemId[]
    onToggle: (id: ItemId, checked: boolean) => void
  } = $props()

  const params = loadParams()
</script>

<div class="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
  <h2 class="text-sm font-bold text-slate-700 sticky top-0 bg-slate-50">護符({items.length}/87)</h2>
  {#each ITEM_GROUPS as group (group.label)}
    <div>
      <div class="text-xs font-bold text-slate-500 mb-1">{group.label}</div>
      <div class="space-y-0.5">
        {#each group.ids as id (id)}
          <label class="flex items-start gap-1.5 text-xs">
            <input
              type="checkbox"
              checked={items.includes(id)}
              onchange={(e) => onToggle(id, (e.currentTarget as HTMLInputElement).checked)}
              class="mt-0.5"
            />
            <span>
              <span class="font-semibold text-slate-700">{ITEM_NAMES[id]}</span>
              <span class="text-slate-400 ml-1">{itemDesc(id, params)}</span>
            </span>
          </label>
        {/each}
      </div>
    </div>
  {/each}
</div>
```

- [ ] **Step 6: `+page.svelte` に組み込む**

`src/routes/admin/shidasu-debug/+page.svelte` の import 群に以下を追加する。

```ts
  import ItemChecklist from './ItemChecklist.svelte'
```

`newWave`・`handlePlayCard`・`handleDraw` の定義の後(`let playableCols = ...` の前)に以下を追加する。

```ts
  function handleToggleItem(id: ItemId, checked: boolean) {
    if (checked) {
      if (!items.includes(id)) items = [...items, id]
    } else {
      items = items.filter(x => x !== id)
    }
  }
```

`<div class="text-xs text-slate-500">護符チェックリスト・カードパレット・内部状態パネルは以降のタスクで追加します。</div>` の行を、以下に置き換える。

```svelte
      <ItemChecklist {items} onToggle={handleToggleItem} />
      <div class="text-xs text-slate-500">カードパレット・内部状態パネルは以降のタスクで追加します。</div>
```

- [ ] **Step 7: ビルド・型チェック**

Run: `npm run build && npm run check`
Expected: どちらもエラーなく成功

- [ ] **Step 8: ブラウザで確認**

Run: `npm run dev` → `/admin/shidasu-debug` を開く
Expected: 護符チェックリストが19グループ・87項目表示され、チェックのON/OFFで所持数表示が変わり、以降のプレイ結果に反映される(例: 「架橋」をONにしてから3枚以上の階段判定が緩くなることを確認)

- [ ] **Step 9: コミット**

```bash
git add src/routes/admin/shidasu-debug/itemGroups.ts src/routes/admin/shidasu-debug/itemGroups.test.ts src/routes/admin/shidasu-debug/ItemChecklist.svelte src/routes/admin/shidasu-debug/+page.svelte
git commit -m "$(cat <<'EOF'
feat: Shidasuデバッグサンドボックスに護符チェックリストを追加

EOF
)"
```

---

### Task 4: 内部状態パネル(既存DebugPanelを再利用)

**Files:**
- Create: `src/routes/admin/shidasu-debug/DebugStatePanel.svelte`
- Modify: `src/routes/admin/shidasu-debug/+page.svelte`

- [ ] **Step 1: `DebugStatePanel.svelte` を作成する**

既存の `src/routes/game/shidasu/DebugPanel.svelte` を直接インポートして再利用し、ウェーブ状態・所持護符一覧を追加で表示する。

```svelte
<script lang="ts">
  import DebugPanel from '../../game/shidasu/DebugPanel.svelte'
  import { ITEM_NAMES } from '$lib/game/shidasu/engine'
  import type { WaveState, ItemId, Suit, Rank } from '$lib/game/shidasu/types'

  let { wave, items, onForceDraw }: {
    wave: WaveState
    items: ItemId[]
    onForceDraw: (suit: Suit, rank: Rank, wild: boolean) => void
  } = $props()
</script>

<div class="space-y-3">
  <div class="text-xs bg-slate-800 text-slate-100 rounded px-3 py-2 space-y-1 font-mono">
    <div>status: {wave.status} / endReason: {wave.endReason ?? 'null'}</div>
    <div>score: {wave.score}</div>
    <div>stock残り: {wave.stock.length}</div>
  </div>
  <div class="text-xs bg-white border border-slate-200 rounded px-3 py-2">
    <div class="font-bold text-slate-600 mb-1">所持中の護符({items.length}種)</div>
    <div class="flex flex-wrap gap-1">
      {#each items as id (id)}
        <span class="bg-slate-100 text-slate-700 rounded px-1.5 py-0.5">{ITEM_NAMES[id]}</span>
      {/each}
      {#if items.length === 0}<span class="text-slate-400">(なし)</span>{/if}
    </div>
  </div>
  <DebugPanel {wave} {onForceDraw} />
</div>
```

- [ ] **Step 2: `+page.svelte` に組み込む**

import 群に以下を追加する。

```ts
  import DebugStatePanel from './DebugStatePanel.svelte'
```

`handleToggleItem` の定義の後に以下を追加する。

```ts
  function handleForceDraw(suit: Suit, rank: Rank, wild: boolean) {
    wave = forceStockTop(wave, suit, rank, wild)
    const result = drawStock(params, wave, items, deckComposition, 'none')
    wave = result.wave
    deckComposition = result.deckComposition
  }
```

このために import 文を修正する必要がある。既存の

```ts
  import { startWave, playCard, drawStock, getPlayableColumns, isRed, rankLabel } from '$lib/game/shidasu/engine'
```

を、以下に置き換える。

```ts
  import { startWave, playCard, drawStock, forceStockTop, getPlayableColumns, isRed, rankLabel } from '$lib/game/shidasu/engine'
```

同様に既存の

```ts
  import type { WaveState, Card, ItemId, DeckCard } from '$lib/game/shidasu/types'
```

を、以下に置き換える。

```ts
  import type { WaveState, Card, ItemId, DeckCard, Suit, Rank } from '$lib/game/shidasu/types'
```

`<div class="text-xs text-slate-500">カードパレット・内部状態パネルは以降のタスクで追加します。</div>` の行を、以下に置き換える。

```svelte
      <DebugStatePanel {wave} {items} onForceDraw={handleForceDraw} />
      <div class="text-xs text-slate-500">カードパレットは次のタスクで追加します。</div>
```

- [ ] **Step 3: ビルド・型チェック**

Run: `npm run build && npm run check`
Expected: どちらもエラーなく成功

- [ ] **Step 4: ブラウザで確認**

Run: `npm run dev` → `/admin/shidasu-debug` を開く
Expected: 内部状態パネルに combo・chain・獲得点ログ・所持護符・ウェーブ状態が表示される。「山札の次を強制指定」フォームからカードを指定して引くと、そのカードが実際にめくられる

- [ ] **Step 5: コミット**

```bash
git add src/routes/admin/shidasu-debug/DebugStatePanel.svelte src/routes/admin/shidasu-debug/+page.svelte
git commit -m "$(cat <<'EOF'
feat: Shidasuデバッグサンドボックスに内部状態パネルを追加

EOF
)"
```

---

### Task 5: カードパレット + ドラッグ&ドロップによるカード入れ替え + 1回限りのUndo

**Files:**
- Create: `src/routes/admin/shidasu-debug/CardPalette.svelte`
- Modify: `src/routes/admin/shidasu-debug/+page.svelte`

- [ ] **Step 1: `CardPalette.svelte` を作成する**

```svelte
<script lang="ts">
  import type { Snippet } from 'svelte'
  import type { Card, Suit, Rank } from '$lib/game/shidasu/types'

  let { cardFace, onCardPointerDown }: {
    cardFace: Snippet<[card: Card, covered: boolean]>
    onCardPointerDown: (source: { suit: Suit; rank: Rank; wild: boolean }, e: PointerEvent) => void
  } = $props()

  const REAL_SUITS: Suit[] = ['♠', '♥', '♦', '♣']
  const RANKS: Rank[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]
</script>

<div class="space-y-2">
  <h2 class="text-sm font-bold text-slate-700">カードパレット(ドラッグして場札・山札に入れ替え)</h2>
  <div class="grid gap-1" style="grid-template-columns: repeat(13, minmax(0, 1fr));">
    {#each REAL_SUITS as suit (suit)}
      {#each RANKS as rank (rank)}
        <div
          role="button"
          tabindex="0"
          onpointerdown={(e) => onCardPointerDown({ suit, rank, wild: false }, e)}
          class="cursor-grab active:cursor-grabbing touch-none"
        >
          {@render cardFace({ id: -1, suit, rank, wild: false }, false)}
        </div>
      {/each}
    {/each}
    <div
      role="button"
      tabindex="0"
      onpointerdown={(e) => onCardPointerDown({ suit: '★', rank: 0, wild: true }, e)}
      class="cursor-grab active:cursor-grabbing touch-none"
    >
      {@render cardFace({ id: -1, suit: '★', rank: 0, wild: true }, false)}
    </div>
  </div>
</div>
```

- [ ] **Step 2: `+page.svelte` にドラッグ状態とUndo状態を追加する**

import 群に以下を追加する。

```ts
  import { onMount } from 'svelte'
  import CardPalette from './CardPalette.svelte'
```

`let wave = $state<WaveState>(...)` の行の後に以下を追加する。

```ts
  let lastSwap = $state<{ location: { col: number; row: number } | 'stockTop'; previousCard: Card } | null>(null)

  interface DragState {
    source: { suit: Suit; rank: Rank; wild: boolean }
    startX: number
    startY: number
    currentX: number
    currentY: number
    isDragging: boolean
    pointerId: number
  }
  let dragState = $state<DragState | null>(null)
  let dropTarget = $state<{ col: number; row: number } | 'stockTop' | null>(null)
```

- [ ] **Step 3: 既存のハンドラの末尾で `lastSwap` をクリアする**

`newWave`・`handlePlayCard`・`handleDraw`・`handleForceDraw`・`handleToggleItem` の各関数の最後に `lastSwap = null` を追加する。例えば `handlePlayCard` は以下のようになる。

```ts
  function handlePlayCard(colIndex: number) {
    wave = playCard(params, wave, 'none', items, TARGET, colIndex)
    lastSwap = null
  }
```

同様に `newWave`・`handleDraw`・`handleForceDraw`・`handleToggleItem` の関数末尾にも `lastSwap = null` を1行追加する。

- [ ] **Step 4: ドラッグ&ドロップとUndoのロジックを追加する**

`let playableCols = $derived(...)` の行の後に以下を追加する。

```ts
  function onPaletteCardPointerDown(source: { suit: Suit; rank: Rank; wild: boolean }, e: PointerEvent) {
    e.preventDefault()
    dragState = {
      source,
      startX: e.clientX,
      startY: e.clientY,
      currentX: e.clientX,
      currentY: e.clientY,
      isDragging: false,
      pointerId: e.pointerId,
    }
  }

  function updateDropTarget(x: number, y: number) {
    const els = document.elementsFromPoint(x, y)
    for (const el of els) {
      const colEl = (el as HTMLElement).closest?.('[data-drop-col]') as HTMLElement | null
      if (colEl) {
        dropTarget = { col: Number(colEl.dataset.dropCol), row: Number(colEl.dataset.dropRow) }
        return
      }
      const stockEl = (el as HTMLElement).closest?.('[data-drop-stock]') as HTMLElement | null
      if (stockEl) {
        dropTarget = 'stockTop'
        return
      }
    }
    dropTarget = null
  }

  function applySwap(target: { col: number; row: number } | 'stockTop', source: { suit: Suit; rank: Rank; wild: boolean }) {
    if (target === 'stockTop') {
      if (wave.stock.length === 0) return
      const idx = wave.stock.length - 1
      const previousCard = wave.stock[idx]
      const newCard: Card = { id: previousCard.id, suit: source.suit, rank: source.rank, wild: source.wild }
      wave = { ...wave, stock: wave.stock.map((c, i) => (i === idx ? newCard : c)) }
      lastSwap = { location: 'stockTop', previousCard }
    } else {
      const { col, row } = target
      const column = wave.tableau[col]
      if (!column?.[row]) return
      const previousCard = column[row]
      const newCard: Card = { id: previousCard.id, suit: source.suit, rank: source.rank, wild: source.wild }
      wave = {
        ...wave,
        tableau: wave.tableau.map((c, ci) => (ci === col ? c.map((cc, ri) => (ri === row ? newCard : cc)) : c)),
      }
      lastSwap = { location: { col, row }, previousCard }
    }
  }

  function handleUndo() {
    if (!lastSwap) return
    const swap = lastSwap
    if (swap.location === 'stockTop') {
      const idx = wave.stock.length - 1
      wave = { ...wave, stock: wave.stock.map((c, i) => (i === idx ? swap.previousCard : c)) }
    } else {
      const { col, row } = swap.location
      wave = {
        ...wave,
        tableau: wave.tableau.map((c, ci) => (ci === col ? c.map((cc, ri) => (ri === row ? swap.previousCard : cc)) : c)),
      }
    }
    lastSwap = null
  }

  onMount(() => {
    function onPointerMove(e: PointerEvent) {
      if (!dragState || e.pointerId !== dragState.pointerId) return
      const dx = e.clientX - dragState.startX
      const dy = e.clientY - dragState.startY
      const isDragging = dragState.isDragging || Math.sqrt(dx * dx + dy * dy) > 5
      dragState = { ...dragState, currentX: e.clientX, currentY: e.clientY, isDragging }
      if (isDragging) updateDropTarget(e.clientX, e.clientY)
    }
    function onPointerUp(e: PointerEvent) {
      if (!dragState || e.pointerId !== dragState.pointerId) return
      if (dragState.isDragging && dropTarget) {
        applySwap(dropTarget, dragState.source)
      }
      dragState = null
      dropTarget = null
    }
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
    return () => {
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
    }
  })
```

- [ ] **Step 5: 盤面の各カードにドロップターゲット属性を付与し、山札にも同様に付与する**

`+page.svelte` の場札レンダリング部分、

```svelte
              <div class="absolute left-0 right-0" style="top:{ri * 18}px; z-index:{ri}; width:64px;">
```

を、以下に置き換える(ドロップ中のハイライトと `data-drop-col`/`data-drop-row` を追加)。

```svelte
              <div
                class="absolute left-0 right-0 {dropTarget !== 'stockTop' && dropTarget?.col === ci && dropTarget?.row === ri ? 'ring-4 ring-sky-400 rounded-lg' : ''}"
                style="top:{ri * 18}px; z-index:{ri}; width:64px;"
                data-drop-col={ci}
                data-drop-row={ri}
              >
```

山札ボタンの

```svelte
        <button
          type="button"
          onclick={handleDraw}
          disabled={wave.stock.length === 0}
          style="aspect-ratio: 2/3; width:64px;"
          class="rounded-lg border-2 flex flex-col items-center justify-center font-black {wave.stock.length > 0 ? 'bg-emerald-700 border-emerald-500 text-amber-50' : 'bg-emerald-900 border-emerald-800 text-emerald-700'}"
        >
```

を、以下に置き換える。

```svelte
        <button
          type="button"
          onclick={handleDraw}
          disabled={wave.stock.length === 0}
          data-drop-stock
          style="aspect-ratio: 2/3; width:64px;"
          class="rounded-lg border-2 flex flex-col items-center justify-center font-black {dropTarget === 'stockTop' ? 'ring-4 ring-sky-400' : ''} {wave.stock.length > 0 ? 'bg-emerald-700 border-emerald-500 text-amber-50' : 'bg-emerald-900 border-emerald-800 text-emerald-700'}"
        >
```

- [ ] **Step 6: カードパレット・Undoボタン・ドラッグ中の浮遊表示をレイアウトに追加する**

`<DebugStatePanel {wave} {items} onForceDraw={handleForceDraw} />` の行の後の `<div class="text-xs text-slate-500">カードパレットは次のタスクで追加します。</div>` を削除し、右カラムの一番上(`<ItemChecklist ... />` の前)に以下を追加する。

```svelte
      <CardPalette {cardFace} onCardPointerDown={onPaletteCardPointerDown} />
```

ヘッダーの「新しいウェーブ」ボタンの前に、Undoボタンを追加する。

```svelte
    <div class="flex items-center gap-2">
      <button type="button" onclick={handleUndo} disabled={!lastSwap} class="px-3 py-1.5 rounded text-sm font-bold {lastSwap ? 'bg-amber-500 text-white' : 'bg-slate-200 text-slate-400'}">元に戻す</button>
      <button type="button" onclick={newWave} class="px-3 py-1.5 rounded bg-teal-600 text-white text-sm font-bold">新しいウェーブ</button>
    </div>
```

(既存の `<button type="button" onclick={newWave} ...>新しいウェーブ</button>` 単体の行を上記の `<div>` ブロックで置き換える形になる。)

ページ最上位の閉じタグ `</div>` の直前(全体の一番最後)に、ドラッグ中の浮遊カード表示を追加する。

```svelte
  {#if dragState?.isDragging}
    <div class="fixed pointer-events-none z-50" style="left:{dragState.currentX - 32}px; top:{dragState.currentY - 48}px; width:64px;">
      {@render cardFace({ id: -1, suit: dragState.source.suit, rank: dragState.source.rank, wild: dragState.source.wild }, false)}
    </div>
  {/if}
```

- [ ] **Step 7: ビルド・型チェック**

Run: `npm run build && npm run check`
Expected: どちらもエラーなく成功

- [ ] **Step 8: ブラウザで確認**

Run: `npm run dev` → `/admin/shidasu-debug` を開く

- カードパレットから場札の任意の位置(先頭以外も含む)へドラッグ&ドロップし、カードが入れ替わることを確認する
- カードパレットから山札の先頭へドラッグ&ドロップし、次にめくられるカードが入れ替わることを確認する
- 入れ替え直後は「元に戻す」ボタンが有効化され、押すと直前の入れ替えだけが取り消されることを確認する
- 入れ替え後にプレイ・山札めくり・護符の切り替え・新しいウェーブのいずれかを行うと、「元に戻す」ボタンが無効化されることを確認する

- [ ] **Step 9: コミット**

```bash
git add src/routes/admin/shidasu-debug/CardPalette.svelte src/routes/admin/shidasu-debug/+page.svelte
git commit -m "$(cat <<'EOF'
feat: Shidasuデバッグサンドボックスにカード入れ替えドラッグ&ドロップを追加

EOF
)"
```

---

### Task 6: 最終確認

**Files:** なし(検証のみ)

- [ ] **Step 1: テスト全体を実行する**

Run: `npm run test`
Expected: 既存テスト・`itemGroups.test.ts` すべて成功

- [ ] **Step 2: ビルド・型チェック**

Run: `npm run build && npm run check`
Expected: どちらもエラーなく成功

- [ ] **Step 3: ブラウザで受け入れ基準9項目を確認する**

Run: `npm run dev` → `http://localhost:5173/admin/shidasu-debug` を開き、`docs/superpowers/specs/2026-07-15-shidasu-debug-sandbox-design.md` の7節「受け入れ基準」1〜9をすべて確認する。あわせて `/admin`(トップ一覧にリンクが表示されること)と `/game/shidasu`(既存の実プレイ・`DebugPanel.svelte` が変更前と同じ挙動であること)にも回帰がないことを確認する。

- [ ] **Step 4: 完了報告**

問題があれば修正してから完了とする。新規コミットは不要(Task 1〜5で既にコミット済み)。

---

## 自己レビュー結果

- **spec カバレッジ:** spec 1節(全体アーキテクチャ・画面構成5要素)→ Task 2〜5、2節(ファイル構成)→ 全タスクの Files 欄で網羅、3節(カード入れ替え・Undo)→ Task 5、4節(内部状態パネル)→ Task 4、5節(護符の付与削除)→ Task 3、6節(スコープ外)→ 該当機能は一切実装していない、7節(受け入れ基準9項目)→ Task 6 で全項目を確認。すべて対応するタスクあり。
- **プレースホルダースキャン:** 「TBD」「後で実装」等の記述なし。全ステップに完全なコード。
- **型・シグネチャ整合性:** `lastSwap`・`dragState`・`dropTarget` の型は Task 5 内で一貫。`ItemId`/`Suit`/`Rank`/`Card`/`DeckCard`/`WaveState` は全タスクで `$lib/game/shidasu/types` の定義と一致させた。`ITEM_GROUPS`(Task 3)・`ITEM_POOL`(既存)の集合一致はテストで担保。
