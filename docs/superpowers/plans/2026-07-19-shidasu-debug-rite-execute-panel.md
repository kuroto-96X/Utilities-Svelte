# Shidasu デバッグ画面「秘儀実行パネル」追加 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/admin/shidasu-debug`に、17種の秘儀を所持数・使用条件を無視して任意に直接発動できる実行パネルを追加する。

**Architecture:** 新規コンポーネント`RiteExecutePanel.svelte`(既存`ItemChecklist.svelte`と同型)を追加し、`applyRiteEffect`を直接呼んでwaveを更新する。これに先立ち、既存のUndo機構(`lastSnapshot`)をtableau・stockのみの限定的な型からwave全体に拡張し、秘儀実行を含むすべての盤面操作を一貫してundoできるようにする。

**Tech Stack:** TypeScript, Svelte 5

---

## 事前準備: 対象ファイルの現状

- `src/routes/admin/shidasu-debug/+page.svelte`: `lastSnapshot`(現状`{ tableau: Card[][]; stock: Card[] } | null`)、`applySwap`・`unifySuit`・`stairifyTableau`・`handleUndo`が対象
- `src/routes/admin/shidasu-debug/ItemChecklist.svelte`: 今回新設する`RiteExecutePanel.svelte`のスタイルモデル
- `src/lib/game/shidasu/rites.ts`: `RITE_POOL`・`riteDesc`
- `src/lib/game/shidasu/riteEffects.ts`: `applyRiteEffect`
- `src/lib/game/shidasu/params.ts`: `loadParams`・`ShidasuParams.rites`

**重要:** 各タスクは直前のタスクの結果を前提に行番号がずれるため、必ず直前のタスク完了後の実際のファイル内容を`Read`ツールで確認してから作業すること。

---

### Task 1: Undo機構をwave全体に拡張する

**Files:**
- Modify: `src/routes/admin/shidasu-debug/+page.svelte`

- [ ] **Step 1: `lastSnapshot`の型を`WaveState | null`に変更する**

`+page.svelte`内の以下の行:

```ts
  let lastSnapshot = $state<{ tableau: Card[][]; stock: Card[] } | null>(null)
```

を、以下に変更する:

```ts
  let lastSnapshot = $state<WaveState | null>(null)
```

- [ ] **Step 2: `applySwap`のスナップショット保存を wave 全体に変更する**

`applySwap`関数内、以下の2箇所:

```ts
    if (target === 'stockTop') {
      if (wave.stock.length === 0) return
      const idx = wave.stock.length - 1
      const newCard: Card = { id: wave.stock[idx].id, suit: source.suit, rank: source.rank, wild: source.wild }
      lastSnapshot = { tableau: wave.tableau, stock: wave.stock }
      wave = { ...wave, stock: wave.stock.map((c, i) => (i === idx ? newCard : c)), lastGain: null, lastBonusGains: [] }
    } else {
      const { col, row } = target
      const column = wave.tableau[col]
      if (!column?.[row]) return
      const newCard: Card = { id: column[row].id, suit: source.suit, rank: source.rank, wild: source.wild }
      lastSnapshot = { tableau: wave.tableau, stock: wave.stock }
      wave = {
        ...wave,
        tableau: wave.tableau.map((c, ci) => (ci === col ? c.map((cc, ri) => (ri === row ? newCard : cc)) : c)),
        lastGain: null,
        lastBonusGains: [],
      }
    }
```

の、`lastSnapshot = { tableau: wave.tableau, stock: wave.stock }`という行2箇所を、いずれも以下に変更する:

```ts
      lastSnapshot = wave
```

(それぞれの分岐内の該当行のみを書き換え、他の行はそのまま残すこと。)

- [ ] **Step 3: `unifySuit`のスナップショット保存を変更する**

```ts
  function unifySuit(suit: Suit) {
    lastSnapshot = { tableau: wave.tableau, stock: wave.stock }
    wave = {
      ...wave,
      tableau: wave.tableau.map(col => col.map(c => (c.wild ? c : { ...c, suit }))),
      lastGain: null,
      lastBonusGains: [],
    }
  }
```

の`lastSnapshot = { tableau: wave.tableau, stock: wave.stock }`を、以下に変更する:

```ts
    lastSnapshot = wave
```

- [ ] **Step 4: `stairifyTableau`のスナップショット保存を変更する**

```ts
    lastSnapshot = { tableau: wave.tableau, stock: wave.stock }
    wave = {
      ...wave,
      tableau: wave.tableau.map((col, ci) => col.map((c, ri) => ({ ...c, rank: newRanks.get(`${ci}-${ri}`) as Rank }))),
      lastGain: null,
      lastBonusGains: [],
    }
```

の`lastSnapshot = { tableau: wave.tableau, stock: wave.stock }`を、以下に変更する:

```ts
    lastSnapshot = wave
```

- [ ] **Step 5: `handleUndo`を単純化する**

```ts
  function handleUndo() {
    if (!lastSnapshot) return
    wave = { ...wave, tableau: lastSnapshot.tableau, stock: lastSnapshot.stock, lastGain: null, lastBonusGains: [] }
    lastSnapshot = null
  }
```

を、以下に変更する(スナップショットしたwave全体をそのまま復元する):

```ts
  function handleUndo() {
    if (!lastSnapshot) return
    wave = lastSnapshot
    lastSnapshot = null
  }
```

- [ ] **Step 6: 型チェック・ビルド**

```bash
npm run check
npm run build
```

Expected: エラーなし・ビルド成功。

- [ ] **Step 7: `npm run dev`で動作確認する**

```bash
npm run dev
```

`/admin/shidasu-debug`を開き、以下を確認する:
- カードパレットからカードをドラッグ&ドロップして場札/山札のカードを差し替え、「元に戻す」で正しく戻ること
- 「場札を階段にする」ボタンを押した後、「元に戻す」で正しく戻ること
- カードパレットの色統一ボタンを押した後、「元に戻す」で正しく戻ること
- コンソールエラーが出ていないこと

確認できたら開発サーバーを停止する。

- [ ] **Step 8: コミット**

現在のブランチは`feat`です。プロジェクトのCLAUDE.md規約により、`feat`ブランチではユーザーへの確認なしでコミットしてよい規約になっています。

```bash
git add src/routes/admin/shidasu-debug/+page.svelte
git commit -m "refactor: shidasu-debugのUndo機構をwave全体のスナップショットに拡張"
```

---

### Task 2: `RiteExecutePanel.svelte`の新規作成と統合

**Files:**
- Create: `src/routes/admin/shidasu-debug/RiteExecutePanel.svelte`
- Modify: `src/routes/admin/shidasu-debug/+page.svelte`

- [ ] **Step 1: `RiteExecutePanel.svelte`を新規作成する**

`src/routes/admin/shidasu-debug/RiteExecutePanel.svelte`を以下の内容で新規作成する。

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
  <h2 class="text-sm font-bold text-slate-700 sticky top-0 bg-slate-50">秘儀(17種・所持数無視で直接発動)</h2>
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

- [ ] **Step 2: `+page.svelte`に実行ハンドラを追加する**

`+page.svelte`冒頭のimportに以下を追加する(既存の`import { startWave, playCard, drawStock, forceStockTop } from '$lib/game/shidasu/engine'`の直後):

```ts
  import { applyRiteEffect } from '$lib/game/shidasu/riteEffects'
  import RiteExecutePanel from './RiteExecutePanel.svelte'
  import type { RiteId } from '$lib/game/shidasu/types'
```

(`RiteId`型は、既存の`import type { WaveState, Card, ItemId, DeckCard, Suit, Rank } from '$lib/game/shidasu/types'`という行に追加する形でもよい。両方の型importが重複しないよう、どちらか一方にまとめること。)

`unifySuit`関数の直後に、以下の新規関数を追加する:

```ts
  function handleExecuteRite(riteId: RiteId) {
    lastSnapshot = wave
    wave = applyRiteEffect(params, wave, riteId, Math.random)
  }
```

- [ ] **Step 3: `RiteExecutePanel`をマークアップに追加する**

既存の右サイド列:

```svelte
    <div class="space-y-4">
      <CardPalette onCardPointerDown={onPaletteCardPointerDown} onUnifySuit={unifySuit} />
      <ItemChecklist {items} onToggle={handleToggleItem} onSetAll={handleSetAllItems} />
    </div>
```

を、以下に変更する(`ItemChecklist`の直後に`RiteExecutePanel`を追加):

```svelte
    <div class="space-y-4">
      <CardPalette onCardPointerDown={onPaletteCardPointerDown} onUnifySuit={unifySuit} />
      <ItemChecklist {items} onToggle={handleToggleItem} onSetAll={handleSetAllItems} />
      <RiteExecutePanel onExecute={handleExecuteRite} />
    </div>
```

- [ ] **Step 4: 型チェック・ビルド**

```bash
npm run check
npm run build
```

Expected: エラーなし・ビルド成功。

- [ ] **Step 5: `npm run dev`で動作確認する**

```bash
npm run dev
```

`/admin/shidasu-debug`を開き、以下を確認する:
- 右サイドに秘儀実行パネルが表示され、17種すべてがルーングリフ・説明文とともに一覧表示される
- いくつかの秘儀(例: 「現在のコンボ数に+nする」「場札を一番多いスートに統一変換する」)を実行し、盤面に効果が反映されること
- 使用条件を満たさない秘儀(例: 捨て札が無い状態でのゲボ)を実行してもクラッシュせず、盤面が変化しないこと
- 秘儀実行後に「元に戻す」を押すと、実行前の状態(チェーン・コンボ数含む)に正しく戻ること
- コンソールエラーが出ていないこと

可能であればPlaywright等でブラウザを実際に開いて確認し、スクリーンショットで見た目も確認すること。確認できたら開発サーバーを停止する。

- [ ] **Step 6: コミット**

```bash
git add src/routes/admin/shidasu-debug/RiteExecutePanel.svelte src/routes/admin/shidasu-debug/+page.svelte
git commit -m "feat: shidasu-debugに秘儀実行パネルを追加"
```

---

## Self-Review 結果

- **spec coverage:** spec section1(秘儀実行パネル)→Task2、section2(実行処理)→Task2、section3(Undo対応の拡張)→Task1、受け入れ基準1〜5→Task1・Task2でそれぞれ充足。
- **placeholder scan:** 全タスクで変更対象の完全なコードを記載済み(TBD・TODO無し)。
- **type consistency:** `lastSnapshot`の型(`WaveState | null`)はTask1で定義し、Task2ではその型を前提に`handleExecuteRite`が同じ`lastSnapshot = wave`パターンを踏襲している。`RiteExecutePanel`の`onExecute: (riteId: RiteId) => void`という型は、Task2内で一貫している。
