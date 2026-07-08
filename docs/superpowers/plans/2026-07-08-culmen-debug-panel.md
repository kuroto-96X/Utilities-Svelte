# Culmen デバッグパネル Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/game/culmen`にローカル開発時(`npm run dev`)のみ表示されるデバッグパネルを追加し、内部状態の可視化・獲得点内訳ログ・任意カードの強制引きを提供する。

**Architecture:** エンジンに副作用のない純粋関数`forceStockTop`を1つ追加し、新規コンポーネント`DebugPanel.svelte`が`analyzeSuitColor`/`analyzeStair`など既存のpure関数を再利用して内部状態を表示する。`+page.svelte`からは`{#if import.meta.env.DEV}`で条件付きレンダリングし、Vite/Rollupのビルド時定数畳み込み+デッドコード除去により本番バンドルから完全に除去されることをビルド出力で確認する。

**Tech Stack:** SvelteKit(Svelte 5 runes) / TypeScript / Vitest / Tailwind CSS

**Spec:** `docs/superpowers/specs/2026-07-08-culmen-debug-panel-design.md`

---

## 事前確認

- [ ] **Step 1: 作業ブランチを確認する**

```bash
git branch --show-current
```

Expected: `feat`(または `feat-*`)。

---

### Task 1: エンジン — `forceStockTop`の追加

**Files:**
- Modify: `src/lib/game/culmen/engine.ts`
- Modify: `src/lib/game/culmen/engine.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/game/culmen/engine.test.ts` の末尾に追記する(`makeWave`/`card`ヘルパーは既存のものを使う。`forceStockTop`を`./engine`の既存import文に追加すること):

```ts
describe('forceStockTop', () => {
  test('山札の一番上(末尾)が指定カードに置き換わる', () => {
    const wave = makeWave({ stock: [card(1, '♠', 2), card(2, '♣', 3)] })
    const next = forceStockTop(wave, '♥', 9, false)
    expect(next.stock).toHaveLength(2)
    expect(next.stock[0]).toEqual(card(1, '♠', 2))
    expect(next.stock[1].suit).toBe('♥')
    expect(next.stock[1].rank).toBe(9)
    expect(next.stock[1].wild).toBe(false)
  })

  test('山札が空の場合は指定カード1枚だけの山札になる', () => {
    const wave = makeWave({ stock: [] })
    const next = forceStockTop(wave, '★', 0, true)
    expect(next.stock).toHaveLength(1)
    expect(next.stock[0].suit).toBe('★')
    expect(next.stock[0].wild).toBe(true)
  })

  test('stock以外のWaveStateフィールドは変化しない', () => {
    const wave = makeWave({ stock: [card(1, '♠', 2)], score: 500, combo: 3 })
    const next = forceStockTop(wave, '♦', 5, false)
    expect(next.score).toBe(500)
    expect(next.combo).toBe(3)
    expect(next.chain).toEqual(wave.chain)
  })

  test('呼び出すたびに異なるidが振られる', () => {
    const wave = makeWave({ stock: [card(1, '♠', 2)] })
    const next1 = forceStockTop(wave, '♦', 5, false)
    const next2 = forceStockTop(wave, '♦', 5, false)
    expect(next1.stock[0].id).not.toBe(next2.stock[0].id)
  })
})
```

Run: `npx vitest run src/lib/game/culmen/engine.test.ts`
Expected: FAIL(`forceStockTop`が存在しない)

- [ ] **Step 2: 実装を追記する**

`src/lib/game/culmen/engine.ts` 冒頭のimport文を以下に変更する(`Rank`を追加):

```ts
import type { Card, StageModifier, WaveState, ItemId, WaveEndReason, RunState, Suit, Rank } from './types'
```

ファイル末尾に追記する:

```ts
let debugCardIdSeq = 900000

// デバッグパネル専用: 山札の一番上(次にめくられる札)を指定カードに差し替える。
// idは既存デッキ(最大でも数百枚程度)と衝突しないよう90万番台から発番する。
export function forceStockTop(wave: WaveState, suit: Suit, rank: Rank, wild: boolean): WaveState {
  const card: Card = { id: ++debugCardIdSeq, suit, rank, wild }
  const newStock = wave.stock.length === 0 ? [card] : [...wave.stock.slice(0, -1), card]
  return { ...wave, stock: newStock }
}
```

- [ ] **Step 3: テストが通ることを確認する**

Run: `npx vitest run src/lib/game/culmen/engine.test.ts`
Expected: PASS(全テスト)

- [ ] **Step 4: 型チェックを実行する**

Run: `npm run check`
Expected: culmen関連のエラーなし

- [ ] **Step 5: コミット**

```bash
git add src/lib/game/culmen/engine.ts src/lib/game/culmen/engine.test.ts
git commit -m "feat: Culmenのデバッグ用山札強制指定関数(forceStockTop)を追加"
```

---

### Task 2: `DebugPanel.svelte` コンポーネントの新規作成

**Files:**
- Create: `src/routes/game/culmen/DebugPanel.svelte`

- [ ] **Step 1: コンポーネントを作成する**

```svelte
<script lang="ts">
  import { analyzeSuitColor, analyzeStair, isRed, rankLabel } from '$lib/game/culmen/engine'
  import type { WaveState, Suit, Rank, ScoreGain } from '$lib/game/culmen/types'

  let { wave, onForceDraw }: {
    wave: WaveState
    onForceDraw: (suit: Suit, rank: Rank, wild: boolean) => void
  } = $props()

  let gainLog = $state<{ combo: number; gain: ScoreGain }[]>([])

  $effect(() => {
    const gain = wave.lastGain
    if (gain) {
      gainLog = [{ combo: wave.combo, gain }, ...gainLog].slice(0, 20)
    }
  })

  const REAL_SUITS: Suit[] = ['♠', '♥', '♦', '♣']
  const RANKS: Rank[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]

  let formSuit = $state<Suit>('♠')
  let formRank = $state<Rank>(1)
  let formWild = $state(false)

  function submitForceDraw() {
    if (formWild) {
      onForceDraw('★', 0, true)
    } else {
      onForceDraw(formSuit, formRank, false)
    }
  }

  let suitColor = $derived(analyzeSuitColor(wave.chain))
  let stairInfo = $derived(analyzeStair(wave.chain))
</script>

<div class="mt-2 px-3 py-3 border-t-4 border-fuchsia-500 bg-slate-900 text-slate-100 text-xs space-y-3">
  <div class="font-black text-fuchsia-400">🐛 DEBUG (dev only)</div>

  <section>
    <div class="font-bold text-slate-300 mb-1">内部状態</div>
    <div class="grid grid-cols-2 gap-x-3 gap-y-0.5 font-mono">
      <div>combo: {wave.combo}</div>
      <div>shieldLeft: {wave.shieldLeft}</div>
      <div>columnsEmptied: {wave.columnsEmptiedThisCombo}</div>
      <div>lastDrawEffect: {wave.lastDrawEffect ?? 'null'}</div>
      <div>suitHeld: {String(suitColor.suitHeld)}</div>
      <div>colorHeld: {String(suitColor.colorHeld)}</div>
      <div>stair.held: {String(stairInfo.held)}</div>
      <div>stair.dir/len: {stairInfo.dir}/{stairInfo.len}</div>
    </div>
    <div class="mt-1">
      <span class="text-slate-400">chain:</span>
      {#each wave.chain as c (c.id)}
        <span class="inline-block px-1 border border-slate-600 rounded ml-1 {c.wild ? 'text-fuchsia-300' : isRed(c) ? 'text-red-400' : 'text-slate-100'}">{rankLabel(c)}{c.suit}</span>
      {/each}
      {#if wave.chain.length === 0}<span class="text-slate-500">(空)</span>{/if}
    </div>
  </section>

  <section>
    <div class="font-bold text-slate-300 mb-1">獲得点ログ(新しい順)</div>
    <div class="max-h-24 overflow-y-auto space-y-0.5">
      {#each gainLog as entry, i (i)}
        <div class="font-mono">×{entry.combo}: +{entry.gain.points} {entry.gain.parts.join(' ')}</div>
      {/each}
      {#if gainLog.length === 0}<div class="text-slate-500">(まだ得点なし)</div>{/if}
    </div>
  </section>

  <section>
    <div class="font-bold text-slate-300 mb-1">山札の次を強制指定</div>
    <div class="flex items-center gap-2 flex-wrap">
      <label class="flex items-center gap-1">
        <input type="checkbox" bind:checked={formWild} />
        ワイルド
      </label>
      <select bind:value={formSuit} disabled={formWild} class="bg-slate-800 border border-slate-600 rounded px-1 py-0.5">
        {#each REAL_SUITS as s (s)}
          <option value={s}>{s}</option>
        {/each}
      </select>
      <select bind:value={formRank} disabled={formWild} class="bg-slate-800 border border-slate-600 rounded px-1 py-0.5">
        {#each RANKS as r (r)}
          <option value={r}>{r}</option>
        {/each}
      </select>
      <button onclick={submitForceDraw} class="px-2 py-1 rounded bg-fuchsia-700 text-white">この札をセットして引く</button>
    </div>
  </section>
</div>
```

- [ ] **Step 2: 型チェックを実行する**

Run: `npm run check`
Expected: `DebugPanel.svelte` 関連のエラーなし(この時点ではどこからもimportされていないため、未使用ファイルとしての警告が出ないことを確認する)

- [ ] **Step 3: コミット**

```bash
git add src/routes/game/culmen/DebugPanel.svelte
git commit -m "feat: CulmenにDebugPanelコンポーネントを追加"
```

## Context

このタスクではコンポーネントを作成するのみで、`+page.svelte`からはまだ読み込まない(Task 3で配線する)。`analyzeSuitColor`/`analyzeStair`/`isRed`/`rankLabel`はすべて既存のexport済みpure関数で、新規ロジックの追加は不要。このプロジェクトには Svelte コンポーネント単体の自動テスト基盤が無く(`/admin/culmen`のTask 8でも同様)、動作確認はTask 4でbrowser経由の目視確認に委ねる。

---

### Task 3: `+page.svelte` への配線

**Files:**
- Modify: `src/routes/game/culmen/+page.svelte`

- [ ] **Step 1: importとハンドラを追加する**

`src/routes/game/culmen/+page.svelte` の `<script>` 冒頭のimport群を以下に変更する:

```svelte
<script lang="ts">
  import { onDestroy } from 'svelte'
  import { loadParams } from '$lib/game/culmen/params'
  import {
    createInitialRun, beginRun, applyPlayCard, applyDrawStock, applyStuckCheck,
    resolveWaveEnd, pickItem, advanceStage, restartRun, startWave, forceStockTop,
    getPlayableColumns, remainingCount, rankLabel, isRed, itemDesc, ITEM_NAMES,
  } from '$lib/game/culmen/engine'
  import type { RunState, Card, ItemId, StageModifier, WaveState, Suit, Rank } from '$lib/game/culmen/types'
  import DebugPanel from './DebugPanel.svelte'
```

(変更点: `forceStockTop`をengineのimportに追加、`Suit, Rank`をtypesのimportに追加、`DebugPanel`のimportを新規追加)

`handleRestart` 関数の直後に、新しいハンドラを追加する:

```ts
  function handleForceDraw(suit: Suit, rank: Rank, wild: boolean) {
    if (!run.wave) return
    run = { ...run, wave: forceStockTop(run.wave, suit, rank, wild) }
    handleDraw()
  }
```

- [ ] **Step 2: デバッグパネルを画面下に配置する**

ファイル末尾、`</div>`(380行目、メインのゲームコンテナを閉じるタグ)の直後に、以下を追加する:

```svelte
{#if import.meta.env.DEV && wave}
  <div class="w-full mx-auto" style="max-width:480px;">
    <DebugPanel {wave} onForceDraw={handleForceDraw} />
  </div>
{/if}
```

- [ ] **Step 3: Lintと型チェックを実行する**

Run: `npx eslint src/routes/game/culmen/ src/lib/game/culmen/`
Expected: エラーなし

Run: `npm run check`
Expected: culmen関連のエラーなし

- [ ] **Step 4: 全体テストスイートを実行する**

Run: `npm run test`
Expected: 全ファイルPASS

- [ ] **Step 5: 開発サーバーで動作確認する**

Run: `npm run dev`(既に起動中でなければ)

ブラウザで `/game/culmen` を開き、以下を確認する:
- ゲーム画面の下に「🐛 DEBUG (dev only)」パネルが常時表示されている
- カードをプレイ/山札を引くたびに「内部状態」セクションの値(combo・suitHeld・stair.dir/lenなど)がリアルタイムに変化する
- 得点が発生するたびに「獲得点ログ」に新しい行が追加される
- 「山札の次を強制指定」でワイルド以外のスート・ランクを選び「この札をセットして引く」を押すと、実際にその札が場札(foundation)に反映され、通常の引き処理(パターン継続・シールドなど)が正しく作動する
- 「ワイルド」にチェックを入れるとスート・ランクの選択欄が無効化され、引くと★のワイルド札が場札になる
- コンソールエラーが出ていない

- [ ] **Step 6: コミット**

```bash
git add src/routes/game/culmen/+page.svelte
git commit -m "feat: CulmenのゲームページにDebugPanelを配線(開発時のみ表示)"
```

## Context

`import.meta.env.DEV`はViteのビルド時定数で、`npm run dev`実行時は`true`、`npm run build`後の本番ビルドでは`false`に静的に置換される。この分岐がRollup(またはこのプロジェクトが使用するRolldown)のデッドコード除去によって本番バンドルから実際に取り除かれることは、次のTask 4でビルド出力を直接確認する。

---

### Task 4: 最終検証

**Files:** なし(検証のみ)

- [ ] **Step 1: 全テストを実行する**

Run: `npm run test`
Expected: 全ファイルPASS

- [ ] **Step 2: 型チェック・Lintを実行する**

Run: `npm run check && npx eslint src/lib/game/culmen/ src/routes/game/culmen/`
Expected: culmen関連のエラーなし

- [ ] **Step 3: 本番ビルドを実行し、デバッグ用コードが本番バンドルに含まれないことを確認する**

Run:
```bash
npm run build
grep -r "この札をセットして引く" dist/ || echo "NOT FOUND (expected)"
grep -r "DEBUG (dev only)" dist/ || echo "NOT FOUND (expected)"
```
Expected: ビルド成功。どちらの`grep`も`NOT FOUND (expected)`が出力される(=本番バンドルに`DebugPanel`関連の文字列が一切含まれていない)。

もし文字列が見つかった場合は、`import.meta.env.DEV`によるデッドコード除去が期待通り働いていないことを意味するため、原因を調査して報告する(このプランの想定外の結果であり、その場で無理に修正せず状況を報告すること)。

- [ ] **Step 4: 開発サーバーで受け入れ基準を一通り確認する**

Run: `npm run dev`

`docs/superpowers/specs/2026-07-08-culmen-debug-panel-design.md` の「6. 受け入れ基準」を上から順にブラウザで確認する(1と6-7はStep 1-3で確認済み、2-5をブラウザで再確認):
2. デバッグパネルが常時表示される
3. 内部状態表示がリアルタイムに変化する
4. 獲得点ログが新しい順で追記される
5. 強制引きフォームで指定したカードが実際に引かれ、通常の引き処理が正しく作動する

- [ ] **Step 5: 最終コミット(検証中に見つかった不具合を修正した場合のみ)**

```bash
git add -A
git commit -m "fix: デバッグパネルの最終検証で見つかった不具合を修正"
```

---

## 自己レビュー結果

- **スペック網羅性**: 1節(スコープ・表示条件)→Task 3、2節(アーキテクチャ)→Task 2・3、3節(DebugPanelの3セクション)→Task 2、4節(forceStockTop)→Task 1、5節(テスト方針)→Task 1(ユニットテスト)・Task 4(ブラウザ目視)、6節(受け入れ基準)→Task 4、で対応済み。
- **プレースホルダー**: なし。全タスクに実コードを記載。
- **型・関数名の一貫性**: `forceStockTop(wave, suit, rank, wild)`(Task 1)→`DebugPanel`の`onForceDraw`プロパティ(Task 2)→`+page.svelte`の`handleForceDraw`(Task 3)まで、引数の型(`Suit`/`Rank`/`boolean`)と順序が一貫していることを確認済み。`WaveState`の`lastDrawEffect`/`columnsEmptiedThisCombo`/`lastGain`/`chain`など、DebugPanelが参照するフィールド名はすべて`types.ts`の既存定義と一致している。
