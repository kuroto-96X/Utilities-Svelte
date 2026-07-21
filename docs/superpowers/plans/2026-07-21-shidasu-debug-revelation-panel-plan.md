# Shidasuデバッグ画面 天啓実行パネル追加 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `docs/superpowers/specs/2026-07-21-shidasu-debug-revelation-panel-design.md`に基づき、`/admin/shidasu-debug`に天啓12種を所持数無視で直接発動できる`RevelationExecutePanel`を追加し、既存の`RiteExecutePanel`と同じ列にまとめる。

**Architecture:** 既存の`RiteExecutePanel.svelte`と同じ構造の新規コンポーネントを作り、列選択が必要な天啓のみ`+page.svelte`側で「選択待ち」状態を持って`PlayArea`の`columnTargetMode`系propsに配線する(本編`game/shidasu/+page.svelte`で確立済みの`pendingRevelationTarget`パターンをデバッグ用に簡略化して踏襲)。レイアウトは2パネルを1つの共有スクロール領域にまとめ、二重スクロールを避ける。

**Tech Stack:** TypeScript, Svelte 5, Vitest

---

### Task 1: `RevelationExecutePanel.svelte`(新規コンポーネント)

**Files:**
- Create: `src/routes/admin/shidasu-debug/RevelationExecutePanel.svelte`

- [ ] **Step 1: 既存の`RiteExecutePanel.svelte`を確認する**

参考のため、`src/routes/admin/shidasu-debug/RiteExecutePanel.svelte`の現在の内容(以下、そのまま引用):

```svelte
<script lang="ts">
  import { riteDesc, RITE_POOL } from '$lib/game/shidasu/rites'
  import { loadParams } from '$lib/game/shidasu/params'
  import type { RiteId } from '$lib/game/shidasu/types'

  let { onExecute }: {
    onExecute: (riteId: RiteId) => void
  } = $props()

  const params = loadParams()
</script>

<div class="space-y-1 max-h-[70vh] overflow-y-auto pr-1">
  <h2 class="text-sm font-bold text-slate-700 sticky top-0 bg-slate-50">秘儀({RITE_POOL.length}種・所持数無視で直接発動)</h2>
  {#each RITE_POOL as id (id)}
    <div class="flex items-start gap-1.5 text-xs">
      <button
        type="button"
        onclick={() => onExecute(id)}
        style="font-family: 'ShidasuRunic', sans-serif;"
        class="shrink-0 w-8 h-8 rounded border border-slate-300 bg-white hover:bg-slate-100 flex items-center justify-center text-base font-black"
      >{params.rites[id].name}</button>
      <span class="pt-1.5 text-slate-400">{riteDesc(id, params)}</span>
    </div>
  {/each}
</div>
```

このタスクではこのファイルを直接変更しない(Task 2でスクロール周りのみ変更する)。ここでは同じ見た目・スタイル規約を踏襲した新規コンポーネントを作る。

- [ ] **Step 2: `RevelationExecutePanel.svelte`を新規作成する**

`src/routes/admin/shidasu-debug/RevelationExecutePanel.svelte`を新規作成:

```svelte
<script lang="ts">
  import { revelationDesc, REVELATION_POOL } from '$lib/game/shidasu/revelations'
  import { revelationNeedsTarget } from '$lib/game/shidasu/revelationEffects'
  import { loadParams } from '$lib/game/shidasu/params'
  import type { RevelationId } from '$lib/game/shidasu/types'

  let { onExecute, pendingRevelationId, onCancelTarget }: {
    onExecute: (revelationId: RevelationId) => void
    pendingRevelationId: RevelationId | null
    onCancelTarget: () => void
  } = $props()

  const params = loadParams()
</script>

<div class="space-y-1">
  <h2 class="text-sm font-bold text-slate-700 sticky top-0 bg-slate-50">天啓({REVELATION_POOL.length}種・所持数無視で直接発動)</h2>
  {#if pendingRevelationId}
    <div class="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1.5 flex items-center justify-between gap-2">
      <span>列を選択してください({params.revelations[pendingRevelationId].name})</span>
      <button type="button" onclick={onCancelTarget} class="text-amber-700 underline shrink-0">キャンセル</button>
    </div>
  {/if}
  {#each REVELATION_POOL as id (id)}
    <div class="flex items-start gap-1.5 text-xs">
      <button
        type="button"
        onclick={() => onExecute(id)}
        disabled={pendingRevelationId !== null && pendingRevelationId !== id}
        class="shrink-0 w-8 h-8 rounded border flex items-center justify-center text-base font-black {pendingRevelationId === id ? 'border-amber-400 bg-amber-100' : 'border-slate-300 bg-white hover:bg-slate-100'} disabled:opacity-30 disabled:cursor-not-allowed"
      >{params.revelations[id].name}</button>
      <span class="pt-1.5 text-slate-400">{revelationDesc(id, params)}</span>
    </div>
  {/each}
</div>
```

**注意:** `revelationNeedsTarget`はこのコンポーネント内では使用しない(列選択が必要かどうかの判定は呼び出し元`+page.svelte`が行う設計のため、importは不要)。上記コードには含めていないので、そのまま実装すること。

- [ ] **Step 3: 型チェックを実行する**

Run: `npm run check`
Expected: `RevelationExecutePanel.svelte`にエラーが無いこと(この時点では`+page.svelte`から未使用のため、コンポーネント単体としてのエラーが無ければよい)

- [ ] **Step 4: コミット**

```bash
git add src/routes/admin/shidasu-debug/RevelationExecutePanel.svelte
git commit -m "feat: shidasu-debugに天啓実行パネル(RevelationExecutePanel)を追加"
```

---

### Task 2: `+page.svelte`の状態・配線とレイアウト調整

**Files:**
- Modify: `src/routes/admin/shidasu-debug/+page.svelte`
- Modify: `src/routes/admin/shidasu-debug/RiteExecutePanel.svelte`

- [ ] **Step 1: importを追加する**

`src/routes/admin/shidasu-debug/+page.svelte`のimport群(1-14行目付近、現在の内容):

```ts
  import { onMount } from 'svelte'
  import { loadParams } from '$lib/game/shidasu/params'
  import { startWave, playCard, drawStock, forceStockTop } from '$lib/game/shidasu/engine'
  import { applyRiteEffect } from '$lib/game/shidasu/riteEffects'
  import RiteExecutePanel from './RiteExecutePanel.svelte'
  import { ITEM_POOL } from '$lib/game/shidasu/items'
  import { standardDeckComposition } from '$lib/game/shidasu/deck'
  import type { WaveState, Card, ItemId, DeckCard, Suit, Rank, RiteId } from '$lib/game/shidasu/types'
  import ItemChecklist from './ItemChecklist.svelte'
  import DebugStatePanel from './DebugStatePanel.svelte'
  import CardPalette from './CardPalette.svelte'
  import CardFace from '../../game/shidasu/CardFace.svelte'
  import PlayArea from '../../game/shidasu/PlayArea.svelte'
```

を以下に置き換える:

```ts
  import { onMount } from 'svelte'
  import { loadParams } from '$lib/game/shidasu/params'
  import { startWave, playCard, drawStock, forceStockTop } from '$lib/game/shidasu/engine'
  import { applyRiteEffect } from '$lib/game/shidasu/riteEffects'
  import { applyRevelationEffect, revelationNeedsTarget } from '$lib/game/shidasu/revelationEffects'
  import RiteExecutePanel from './RiteExecutePanel.svelte'
  import RevelationExecutePanel from './RevelationExecutePanel.svelte'
  import { ITEM_POOL } from '$lib/game/shidasu/items'
  import { standardDeckComposition } from '$lib/game/shidasu/deck'
  import type { WaveState, Card, ItemId, DeckCard, Suit, Rank, RiteId, RevelationId } from '$lib/game/shidasu/types'
  import ItemChecklist from './ItemChecklist.svelte'
  import DebugStatePanel from './DebugStatePanel.svelte'
  import CardPalette from './CardPalette.svelte'
  import CardFace from '../../game/shidasu/CardFace.svelte'
  import PlayArea from '../../game/shidasu/PlayArea.svelte'
```

- [ ] **Step 2: 天啓実行用の状態・ハンドラを追加する**

`handleExecuteRite`関数の直後(163-166行目付近、現在の内容):

```ts
  function handleExecuteRite(riteId: RiteId) {
    lastSnapshot = wave
    wave = applyRiteEffect(params, wave, riteId, Math.random)
  }
```

の直後に、以下を追加する:

```ts
  let pendingDebugRevelation = $state<RevelationId | null>(null)

  function handleExecuteRevelation(revelationId: RevelationId) {
    if (revelationNeedsTarget(revelationId)) {
      pendingDebugRevelation = revelationId
      return
    }
    lastSnapshot = wave
    const result = applyRevelationEffect(params, wave, deckComposition, revelationId, null, Math.random)
    wave = result.wave
    deckComposition = result.deckComposition
  }

  function handleTargetDebugColumn(colIndex: number) {
    if (!pendingDebugRevelation) return
    lastSnapshot = wave
    const result = applyRevelationEffect(params, wave, deckComposition, pendingDebugRevelation, colIndex, Math.random)
    wave = result.wave
    deckComposition = result.deckComposition
    pendingDebugRevelation = null
  }

  function canTargetDebugColumn(colIndex: number): boolean {
    if (!pendingDebugRevelation) return false
    if (pendingDebugRevelation === 'aya') return true
    return wave.tableau[colIndex].length > 0
  }

  function handleCancelDebugRevelationTarget() {
    pendingDebugRevelation = null
  }
```

- [ ] **Step 3: `PlayArea`にターゲティング系propsを追加する**

`<PlayArea>`の呼び出し箇所(245行目付近、現在の内容):

```svelte
        <PlayArea {wave} {params} modifier={'none'} target={TARGET} {items} onPlayCard={handlePlayCard} onDraw={handleDraw} {dropTarget} />
```

を以下に置き換える:

```svelte
        <PlayArea
          {wave} {params} modifier={'none'} target={TARGET} {items} onPlayCard={handlePlayCard} onDraw={handleDraw} {dropTarget}
          columnTargetMode={pendingDebugRevelation !== null}
          canTargetColumn={canTargetDebugColumn}
          onTargetColumn={handleTargetDebugColumn}
        />
```

- [ ] **Step 4: 4列目のレイアウトを変更し`RevelationExecutePanel`を配置する**

4列目の`<RiteExecutePanel .../>`(251行目付近、現在の内容):

```svelte
      <RiteExecutePanel onExecute={handleExecuteRite} />
```

を以下に置き換える:

```svelte
      <div class="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
        <RiteExecutePanel onExecute={handleExecuteRite} />
        <RevelationExecutePanel
          onExecute={handleExecuteRevelation}
          pendingRevelationId={pendingDebugRevelation}
          onCancelTarget={handleCancelDebugRevelationTarget}
        />
      </div>
```

- [ ] **Step 5: `RiteExecutePanel.svelte`の二重スクロールを解消する**

`src/routes/admin/shidasu-debug/RiteExecutePanel.svelte`のルート要素(13行目付近、現在の内容):

```svelte
<div class="space-y-1 max-h-[70vh] overflow-y-auto pr-1">
```

を以下に置き換える(スクロール指定を削除し、Task 4で追加した外側ラッパーにスクロールを一本化する):

```svelte
<div class="space-y-1">
```

閉じタグ`</div>`(26行目付近)はそのまま変更しない。

- [ ] **Step 6: 型チェックを実行する**

Run: `npm run check`
Expected: `+page.svelte`・`RiteExecutePanel.svelte`・`RevelationExecutePanel.svelte`にエラーが無いこと

- [ ] **Step 7: `npm run build`を実行する**

Run: `npm run build`
Expected: 成功

- [ ] **Step 8: コミット**

```bash
git add src/routes/admin/shidasu-debug/+page.svelte src/routes/admin/shidasu-debug/RiteExecutePanel.svelte
git commit -m "feat: shidasu-debugに天啓ボタン列を配線し秘儀パネルと共有スクロール化"
```

---

### Task 3: ブラウザ動作確認

**Files:** (テスト・動作確認のみ、コード変更なし)

- [ ] **Step 1: `npm run dev`でブラウザ動作確認する**

`npm run dev`で開発サーバーを起動し、`/admin/shidasu-debug`を開いて以下を確認する:

1. 4列目に、秘儀パネルの下に天啓12種のボタン一覧が表示されていることを確認する
2. 列選択が不要な天啓(心・尾・箕・斗・虚のいずれか)のボタンを押すと、即座に場札(またはデッキ構成)に効果が反映されることを確認する(例: 心を押すと場札の♠が全て♥に変わる)
3. 列選択が必要な天啓(角・亢・氐・房・牛・女・危のいずれか)のボタンを押すと「列を選択してください」の案内が表示され、他の天啓ボタンが押せなくなることを確認する。場札の列をクリックすると、その列に効果が発動し、案内が消えることを確認する
4. 危(aya)のボタンを押した状態で、空の列(あれば)をクリックしてもワイルドが追加されることを確認する(空列が無い場合は`場札を階段にする`等で調整するか、コード確認で代替してよい)
5. 「列を選択してください」表示中にキャンセルを押すと、効果が発動せず案内が消えることを確認する
6. ページ全体に不要な縦スクロールバーが出ていないことを確認する(4列目の秘儀+天啓パネルが70vh以内に収まり内部スクロールのみになっていること)
7. 「新しいウェーブ」「デッキリセット」「元に戻す」ボタンが引き続き正常に動作することを確認する
8. コンソールエラーが出ていないことを確認する

- [ ] **Step 2: 問題があれば修正し、再度Step 1を実行する**

- [ ] **Step 3: 最終コミット(修正があった場合のみ)**

```bash
git add -A
git commit -m "fix: shidasu-debug天啓パネルのブラウザ動作確認で見つかった問題を修正"
```
