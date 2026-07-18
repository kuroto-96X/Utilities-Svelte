# Shidasu engine.ts/engine.test.ts 分割リファクタリング Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `src/lib/game/shidasu/engine.ts`(1772行)/`engine.test.ts`(3793行)を、役割ごとの4ファイル(`patterns.ts`/`items.ts`/`directEffects.ts`/`itemEffects.ts`)+対応するテストファイルに分割し、`engine.ts`をコアのウェーブ/ラン進行ロジックのみに縮小する。**挙動は一切変更しない、純粋なリファクタリング。**

**Architecture:** 依存関係が一方向になるよう、まず他に依存しない「葉」の2ファイル(`patterns.ts`: 純粋なパターン判定関数群+`isRed`/`isFace`、`items.ts`: 護符メタデータ)を作り、次に`items.ts`に依存する`directEffects.ts`、`patterns.ts`に依存する`itemEffects.ts`を作る。最後に`engine.ts`側のimportを整理する。各タスクの後に`engine.ts`は常にコンパイル可能・テスト通過可能な状態を保つ。

**Tech Stack:** TypeScript, Vitest, SvelteKit (Svelte 5)

**この計画の性質について:** 本計画はロジックを一切変更しない「移動のみ」のリファクタリングであるため、各タスクは「既存ファイルのどの行範囲を、どの新ファイルへ、どんなimportヘッダーを添えて移すか」を正確な行番号で指定する形式を取る(該当コードは現在のファイルにそのまま存在しており、Readツールで該当行範囲を読み取ってから新ファイルへ書き写す、という機械的な作業になる)。コードを新たに書き起こす必要がある箇所(新しいimport文・`testHelpers.ts`の内容)は、このドキュメント内に完全な内容を記載する。

---

## 事前準備: 対象ファイルの現状(すべてのタスクで前提とする行番号)

- `src/lib/game/shidasu/engine.ts`: 1773行(このplan作成時点の内容)
- `src/lib/game/shidasu/engine.test.ts`: 3793行(このplan作成時点の内容)

**重要:** 各タスクは直前のタスクの結果を前提に行番号がずれるため、必ず直前のタスク完了後の実際のファイル内容を`Read`ツールで確認してから作業すること。以下の行番号はすべて「事前準備時点(このplan作成時点)のオリジナルファイル」を指す。

---

### Task 1: `patterns.ts`(パターン判定関数群)の抽出

**Files:**
- Create: `src/lib/game/shidasu/patterns.ts`
- Create: `src/lib/game/shidasu/patterns.test.ts`
- Modify: `src/lib/game/shidasu/engine.ts`
- Modify: `src/lib/game/shidasu/engine.test.ts`
- Modify: `src/routes/game/shidasu/DebugPanel.svelte`
- Modify: `src/routes/game/shidasu/CardFace.svelte`

**背景:** `isRed`/`isFace`は現在`engine.ts`冒頭(8-14行目)にあるが、`itemEffects.ts`(Task 4で作成)の判定ヘルパー(`chainColorExclusive`/`redBlackBalanced`/`chainHasNoFace`/`chainIsFaceOnly`)が`isRed`/`isFace`を必要とする。`engine.ts`と`itemEffects.ts`が互いを参照する循環importを避けるため、`isRed`/`isFace`は依存を持たない`patterns.ts`に置き、`engine.ts`・`itemEffects.ts`の両方がそこからimportする形にする。

- [ ] **Step 1: `patterns.ts`を新規作成する**

`src/lib/game/shidasu/engine.ts`の以下の行範囲を、記載の順序でそのまま`patterns.ts`に移す(ロジックは一字も変えない)。

1. 8-10行目: `isRed`関数
2. 12-14行目: `isFace`関数
3. 1502-1515行目: `SuitColorAnalysis`インターフェース・`analyzeSuitColor`関数
4. 1517-1528行目: `StairAnalysis`インターフェース・`stepRank`関数(非export)
5. 1530-1564行目: `analyzeStair`関数
6. 1566-1580行目: `stairUsesKALoop`関数
7. 1582行目: `ALL_SUITS_REAL`定数
8. 1584-1604行目: `checkFlush`関数・`checkRoyalSet`関数(コメント含む)
9. 1606-1622行目: `countSameRankBefore`関数・`countSameRankForWildPlay`関数
10. 1624-1633行目: `checkCompleteRun`関数
11. 1635-1649行目: `ChainBonusResult`インターフェース
12. 1651-1744行目: `evaluateChainBonus`関数
13. 1746-1762行目: `chainContinuesPattern`関数

ファイル冒頭には以下のヘッダーを置く:

```ts
// src/lib/game/shidasu/patterns.ts
import type { Card, Suit, RoleName } from './types'
import type { ShidasuParams } from './params'
```

- [ ] **Step 2: `engine.ts`から移した範囲を削除し、importを追加する**

上記13箇所の行範囲を`engine.ts`から削除する。ファイル冒頭のimport行(1-4行目)を以下に置き換える:

```ts
// src/lib/game/shidasu/engine.ts
import type { Card, StageModifier, WaveState, ItemId, WaveEndReason, RunState, Suit, Rank, DeckCard, RoleName, BonusGain } from './types'
import type { ShidasuParams } from './params'
import { createRng, shuffle, shuffleInPlace, standardDeckComposition } from './deck'
import { isFace, chainContinuesPattern } from './patterns'
```

(`isRed`は`engine.ts`のコア部分では使われていないため、ここではimportしない。`isFace`は`isPlayable`が、`chainContinuesPattern`は`arrangeNextCardForContinuation`・`drawStock`が、それぞれ引き続き使用する。)

- [ ] **Step 3: `patterns.test.ts`を新規作成する**

`src/lib/game/shidasu/engine.test.ts`から以下を移す(アサーション内容は一切変更しない)。

- 55-78行目の`describe('isRed / isFace / rankLabel', ...)`ブロックのうち、`isRed`のテスト(63行目`test('J/Q/Kは...')`より前、56-61行目の`test('♥♦は赤、♠♣は黒', ...)`)のみを`patterns.test.ts`に移す。`isFace`・`rankLabel`のテスト(63-77行目)は`engine.test.ts`に残す(Task 5で確認)。
- 974-1025行目: `describe('chainContinuesPattern', ...)`
- 1026-1051行目: `describe('stairUsesKALoop', ...)`
- 1052-1123行目: `describe('evaluateChainBonus (patternFired/roleFired)', ...)`
- 2246-2280行目: `describe('analyzeSuitColor', ...)`
- 2281-2354行目: `describe('analyzeStair', ...)`
- 2355-2388行目: `describe('checkFlush', ...)`
- 2389-2416行目: `describe('checkRoyalSet', ...)`
- 2417-2437行目: `describe('countSameRankBefore', ...)`
- 2438-2459行目: `describe('countSameRankForWildPlay', ...)`
- 2460-2493行目: `describe('checkCompleteRun', ...)`
- 2494-2660行目: `describe('evaluateChainBonus', ...)`(1052行目のものとは別の、より大きいブロック)

ファイル冒頭ヘッダー:

```ts
// src/lib/game/shidasu/patterns.test.ts
import { describe, test, expect } from 'vitest'
import { isRed, analyzeSuitColor, analyzeStair, checkFlush, checkRoyalSet, countSameRankBefore, countSameRankForWildPlay, checkCompleteRun, evaluateChainBonus, stairUsesKALoop, chainContinuesPattern } from './patterns'
import type { Card, RoleName } from './types'
import { DEFAULT_PARAMS } from './params'
```

各ブロック内で使われている`card(...)`ヘルパー関数(現`engine.test.ts`51-53行目)を、`patterns.test.ts`の先頭(import文の直後)にもコピーする:

```ts
function card(id: number, suit: Card['suit'], rank: Card['rank'], wild = false): Card {
  return { id, suit, rank, wild }
}
```

- [ ] **Step 4: `engine.test.ts`から移した範囲を削除し、importを整理する**

上記で移した範囲を`engine.test.ts`から削除する。冒頭のimport文(3-46行目)から`isRed`・`chainContinuesPattern`・`analyzeSuitColor`・`analyzeStair`・`checkFlush`・`checkRoyalSet`・`countSameRankBefore`・`countSameRankForWildPlay`・`checkCompleteRun`・`evaluateChainBonus`・`stairUsesKALoop`を削除し、代わりに`chainContinuesPattern`のみを`./patterns`からimportする一文を追加する(他は`patterns.test.ts`に移ったため不要。`chainContinuesPattern`は3676行目付近の「約束・暗雲」テストで引き続き使われるため`engine.test.ts`に残す)。

```ts
import { chainContinuesPattern } from './patterns'
```

- [ ] **Step 5: 外部ファイルの`isRed`importを更新する**

`src/routes/game/shidasu/DebugPanel.svelte`の3行目:

```ts
import { analyzeSuitColor, analyzeStair, isRed, rankLabel } from '$lib/game/shidasu/engine'
```

を以下2行に置き換える:

```ts
import { analyzeSuitColor, analyzeStair, isRed } from '$lib/game/shidasu/patterns'
import { rankLabel } from '$lib/game/shidasu/engine'
```

`src/routes/game/shidasu/CardFace.svelte`の2行目:

```ts
import { rankLabel, isRed } from '$lib/game/shidasu/engine'
```

を以下2行に置き換える:

```ts
import { rankLabel } from '$lib/game/shidasu/engine'
import { isRed } from '$lib/game/shidasu/patterns'
```

- [ ] **Step 6: テスト実行・型チェック**

```bash
npm run test
npm run check
```

Expected: 全テスト成功。移動前後でテストケース総数(`it(`/`test(`の総数)が変化していないこと。型エラーなし。

- [ ] **Step 7: コミット**

```bash
git add src/lib/game/shidasu/patterns.ts src/lib/game/shidasu/patterns.test.ts src/lib/game/shidasu/engine.ts src/lib/game/shidasu/engine.test.ts src/routes/game/shidasu/DebugPanel.svelte src/routes/game/shidasu/CardFace.svelte
git commit -m "refactor: パターン判定関数群をpatterns.tsに分離"
```

---

### Task 2: `items.ts`(護符メタデータ)の抽出

**Files:**
- Create: `src/lib/game/shidasu/items.ts`
- Create: `src/lib/game/shidasu/items.test.ts`
- Modify: `src/lib/game/shidasu/engine.ts`
- Modify: `src/lib/game/shidasu/engine.test.ts`
- Modify: `src/lib/game/shidasu/itemGroups.test.ts`
- Modify: `src/routes/admin/shidasu-talismans/+page.svelte`
- Modify: `src/routes/admin/shidasu-debug/ItemChecklist.svelte`
- Modify: `src/routes/admin/shidasu-debug/DebugStatePanel.svelte`
- Modify: `src/routes/game/shidasu/+page.svelte`
- Modify: `src/routes/admin/shidasu-debug/+page.svelte`

**背景:** Task 1完了後の`engine.ts`の行番号を基準にする(Task 1で1502-1762行目付近を削除済みのため、Task 1完了後に`engine.ts`を実際に読み直して以下の対象範囲の行番号を再確認すること)。対象コード自体は次の関数・定数:`ITEM_POOL`・`itemName`・`itemDesc`・`shuffleItems`(非export)・`rollItemOffer`(Task 1時点の元ファイルで1285-1336行目)。

- [ ] **Step 1: `items.ts`を新規作成する**

Task 1後の`engine.ts`を`Read`し、`ITEM_POOL`定数・`itemName`関数・`itemDesc`関数・`shuffleItems`関数(非export)・`rollItemOffer`関数を、この順序のまま`items.ts`に移す(ロジック変更なし)。

ファイル冒頭ヘッダー:

```ts
// src/lib/game/shidasu/items.ts
import type { ItemId } from './types'
import type { ShidasuParams } from './params'
import { shuffleInPlace } from './deck'
```

- [ ] **Step 2: `engine.ts`から移した範囲を削除し、importを追加する**

削除後、`resolveWaveEnd`関数(現在の対象範囲より前にあり削除の影響を受けない)が`rollItemOffer`を呼び出しているため、`engine.ts`のimport群に以下を追加する:

```ts
import { rollItemOffer } from './items'
```

- [ ] **Step 3: `items.test.ts`を新規作成する**

`engine.test.ts`(Task 1適用後の状態)から以下を移す:

- `describe('rollItemOffer', ...)`ブロック(Task 1適用前の元ファイルで1803-1823行目)
- `describe('ITEM_POOL / itemName / itemDesc', ...)`ブロック(元ファイルで1905-2001行目)

ファイル冒頭ヘッダー:

```ts
// src/lib/game/shidasu/items.test.ts
import { describe, test, expect } from 'vitest'
import { rollItemOffer, ITEM_POOL, itemName, itemDesc } from './items'
import { DEFAULT_PARAMS } from './params'
```

- [ ] **Step 4: `engine.test.ts`のimportを整理する**

冒頭のimport文から`rollItemOffer`・`ITEM_POOL`・`itemName`・`itemDesc`を削除する(移動先の`items.test.ts`でのみ使用するため、`engine.test.ts`本体には残存する参照がないことを確認する。もし`engine.test.ts`の他のテスト内でこれらが直接呼ばれている箇所が見つかった場合は、そのテストも該当ファイルへ一緒に移すか、`import { ... } from './items'`を`engine.test.ts`にも追加すること)。

- [ ] **Step 5: `itemGroups.test.ts`のimportを更新する**

`src/lib/game/shidasu/itemGroups.test.ts`の3行目:

```ts
import { ITEM_POOL } from './engine'
```

を以下に置き換える:

```ts
import { ITEM_POOL } from './items'
```

- [ ] **Step 6: 外部Svelteファイルのimportを更新する**

`src/routes/admin/shidasu-talismans/+page.svelte`の4行目:

```ts
import { itemDesc } from '$lib/game/shidasu/engine'
```
→
```ts
import { itemDesc } from '$lib/game/shidasu/items'
```

`src/routes/admin/shidasu-debug/ItemChecklist.svelte`の2行目:

```ts
import { itemName, itemDesc } from '$lib/game/shidasu/engine'
```
→
```ts
import { itemName, itemDesc } from '$lib/game/shidasu/items'
```

`src/routes/admin/shidasu-debug/DebugStatePanel.svelte`の3行目:

```ts
import { itemName } from '$lib/game/shidasu/engine'
```
→
```ts
import { itemName } from '$lib/game/shidasu/items'
```

`src/routes/game/shidasu/+page.svelte`の4-9行目のimportブロック:

```ts
  import {
    createInitialRun, beginRun, applyPlayCard, applyDrawStock, applyStuckCheck,
    resolveWaveEnd, pickItem, confirmItemSwap, cancelItemSwap, skipItemSelect,
    advanceStage, restartRun, startWave, forceStockTop,
    itemDesc, itemName,
  } from '$lib/game/shidasu/engine'
```
→
```ts
  import {
    createInitialRun, beginRun, applyPlayCard, applyDrawStock, applyStuckCheck,
    resolveWaveEnd, pickItem, confirmItemSwap, cancelItemSwap, skipItemSelect,
    advanceStage, restartRun, startWave, forceStockTop,
  } from '$lib/game/shidasu/engine'
  import { itemDesc, itemName } from '$lib/game/shidasu/items'
```

`src/routes/admin/shidasu-debug/+page.svelte`の4行目:

```ts
import { startWave, playCard, drawStock, forceStockTop, ITEM_POOL } from '$lib/game/shidasu/engine'
```
→
```ts
import { startWave, playCard, drawStock, forceStockTop } from '$lib/game/shidasu/engine'
import { ITEM_POOL } from '$lib/game/shidasu/items'
```

- [ ] **Step 7: テスト実行・型チェック**

```bash
npm run test
npm run check
```

Expected: 全テスト成功、型エラーなし。

- [ ] **Step 8: コミット**

```bash
git add src/lib/game/shidasu/items.ts src/lib/game/shidasu/items.test.ts src/lib/game/shidasu/engine.ts src/lib/game/shidasu/engine.test.ts src/lib/game/shidasu/itemGroups.test.ts src/routes/admin/shidasu-talismans/+page.svelte src/routes/admin/shidasu-debug/ItemChecklist.svelte src/routes/admin/shidasu-debug/DebugStatePanel.svelte src/routes/game/shidasu/+page.svelte src/routes/admin/shidasu-debug/+page.svelte
git commit -m "refactor: 護符メタデータ(ITEM_POOL/itemName/itemDesc/rollItemOffer)をitems.tsに分離"
```

---

### Task 3: `testHelpers.ts` + `directEffects.ts`の抽出

**Files:**
- Create: `src/lib/game/shidasu/testHelpers.ts`
- Create: `src/lib/game/shidasu/directEffects.ts`
- Create: `src/lib/game/shidasu/directEffects.test.ts`
- Modify: `src/lib/game/shidasu/engine.ts`
- Modify: `src/lib/game/shidasu/engine.test.ts`

- [ ] **Step 1: `testHelpers.ts`を新規作成する**

以下の内容で新規作成する(`card`は`engine.test.ts`51-53行目、`directCtx`は`engine.test.ts`3231-3253行目付近の内容を正規版として採用する。Task 4で`ItemEffectContext`用の`ctx`もこのファイルに追加する)。

```ts
// src/lib/game/shidasu/testHelpers.ts
import type { Card, DirectEffectContext } from './types'
import { DEFAULT_PARAMS } from './params'

export function card(id: number, suit: Card['suit'], rank: Card['rank'], wild = false): Card {
  return { id, suit, rank, wild }
}

export function directCtx(overrides: Partial<DirectEffectContext> = {}): DirectEffectContext {
  return {
    comboBeforeReset: 0,
    hasPlayableColumns: true,
    roleFiredThisChain: false,
    remainingTableauCount: 0,
    combo: 0,
    colorHeld: false,
    previousCombo: 0,
    scoreAfterGained: 0,
    ...overrides,
  }
}
```

`DirectEffectContext`型は`directEffects.ts`(このタスクのStep 2)からimportするため、`import type { Card } from './types'`と`import type { DirectEffectContext } from './directEffects'`に分ける必要がある。上記コード例の`import type { Card, DirectEffectContext } from './types'`は誤り。正しくは:

```ts
// src/lib/game/shidasu/testHelpers.ts
import type { Card } from './types'
import type { DirectEffectContext } from './directEffects'

export function card(id: number, suit: Card['suit'], rank: Card['rank'], wild = false): Card {
  return { id, suit, rank, wild }
}

export function directCtx(overrides: Partial<DirectEffectContext> = {}): DirectEffectContext {
  return {
    comboBeforeReset: 0,
    hasPlayableColumns: true,
    roleFiredThisChain: false,
    remainingTableauCount: 0,
    combo: 0,
    colorHeld: false,
    previousCombo: 0,
    scoreAfterGained: 0,
    ...overrides,
  }
}
```

- [ ] **Step 2: `directEffects.ts`を新規作成する**

Task 2後の`engine.ts`を`Read`し、以下を移す(Task 1適用前の元ファイル行番号: 1220行目`DirectChannel`型・1222-1233行目`DirectEffectContext`インターフェース・1235行目`DirectEffect`型・1237-1266行目`DIRECT_EFFECTS`定数・1268-1283行目`applyDirectEffects`関数)。

ファイル冒頭ヘッダー:

```ts
// src/lib/game/shidasu/directEffects.ts
import type { ItemId } from './types'
import type { ShidasuParams } from './params'
import { itemName } from './items'
```

- [ ] **Step 3: `engine.ts`から移した範囲を削除し、importを追加する**

`playCard`・`drawStock`は`DirectEffectContext`型・`applyDirectEffects`関数を引き続き使用するため、`engine.ts`のimport群に以下を追加する:

```ts
import { applyDirectEffects, type DirectEffectContext } from './directEffects'
```

- [ ] **Step 4: `directEffects.test.ts`を新規作成する**

`engine.test.ts`(Task 1・2適用後の状態)から、`describe('applyDirectEffects', ...)`ブロック2箇所(元ファイルで3228-3324行目・3744-3793行目の2つ、同名のdescribeが離れた場所に2つ存在する)を`directEffects.test.ts`に移す。

3231-3253行目付近の`function directCtx(overrides...)`ローカル定義は削除し、`testHelpers.ts`からのimportに置き換える。

ファイル冒頭ヘッダー:

```ts
// src/lib/game/shidasu/directEffects.test.ts
import { describe, test, expect } from 'vitest'
import { applyDirectEffects, type DirectEffectContext } from './directEffects'
import { DEFAULT_PARAMS } from './params'
import { directCtx } from './testHelpers'
```

- [ ] **Step 5: `engine.test.ts`のimportを整理する**

冒頭のimport文から`applyDirectEffects`・`type DirectEffectContext`を削除する。

- [ ] **Step 6: テスト実行・型チェック**

```bash
npm run test
npm run check
```

Expected: 全テスト成功、型エラーなし。`directCtx`を使った既存テストの期待値がすべて変わらず一致すること(`comboBeforeReset`/`hasPlayableColumns`等のデフォルト値が、移動元の各ブロックの`directCtx`定義と一致しているか必ず確認する。異なるデフォルトを使っていたブロックがあれば、そのブロックの呼び出し側で`overrides`により差分を明示的に指定し直す)。

- [ ] **Step 7: コミット**

```bash
git add src/lib/game/shidasu/testHelpers.ts src/lib/game/shidasu/directEffects.ts src/lib/game/shidasu/directEffects.test.ts src/lib/game/shidasu/engine.ts src/lib/game/shidasu/engine.test.ts
git commit -m "refactor: 直接加算護符(DIRECT_EFFECTS)をdirectEffects.tsに分離しテストヘルパーを共通化"
```

---

### Task 4: `itemEffects.ts`の抽出 + `ctx()`ヘルパーの統合

**Files:**
- Modify: `src/lib/game/shidasu/testHelpers.ts`
- Create: `src/lib/game/shidasu/itemEffects.ts`
- Create: `src/lib/game/shidasu/itemEffects.test.ts`
- Modify: `src/lib/game/shidasu/engine.ts`
- Modify: `src/lib/game/shidasu/engine.test.ts`

**背景:** `engine.test.ts`には`ItemEffectContext`を組み立てる`function ctx(overrides = {})`が、少なくとも以下の14箇所にほぼ同じ内容でコピーされている(Task 1適用前の元ファイル行番号): 1631, 2698, 2759, 2823, 2904, 2989, 3029, 3127, 3197, 3327, 3369, 3407, 3456, 3491。

- [ ] **Step 1: 14箇所の`ctx()`定義を比較する**

各`describe`ブロック内の`function ctx(overrides: Partial<ItemEffectContext> = {}): ItemEffectContext { ... }`本体(デフォルト値オブジェクトの中身)を読み比べ、以下の分類を行う。

- デフォルト値が完全に一致するグループ → `testHelpers.ts`の共通`ctx()`に統合し、各ブロックの呼び出しは`overrides`のみで既存の挙動を再現できるようにする
- デフォルト値が異なるブロック → そのブロックの`ctx()`はそのブロックのテストファイル内にローカル関数として残す(無理に統合しない。統合すると既存テストの暗黙の前提値が変わり、挙動が変化するリスクがあるため)

1631行目の版(Task 1のStep 3で提示した内容)を共通版の初期候補とする。

- [ ] **Step 2: `testHelpers.ts`に共通`ctx()`を追加する**

Step 1で「完全一致」と判定されたデフォルト値を使い、`testHelpers.ts`に以下を追記する(具体的な数値は1631行目の版をベースにするが、Step 1の比較結果で他の値が正なら合わせる):

```ts
import type { ItemEffectContext } from './itemEffects'
import { DEFAULT_PARAMS } from './params'

export function ctx(overrides: Partial<ItemEffectContext> = {}, params = DEFAULT_PARAMS): ItemEffectContext {
  return {
    card: card(1, '♠', 5),
    previousFoundation: card(2, '♣', 4),
    combo: 1,
    stockRemaining: 0,
    chain: [card(2, '♣', 4), card(1, '♠', 5)],
    remainingTableauCount: 10,
    chainBonus: { bonus: 0, parts: [], patternFired: false, patternFiredCount: 0, roleFired: [] },
    isFirstPlayOfWave: false,
    isPlayAction: true,
    playCountInChain: 1,
    effectiveStairMinLen: params.scoring.stairMinLen,
    effectiveSuitColorMinLen: params.scoring.suitColorMinLen,
    sameColumnStreak: 1,
    totalColumnsEmptiedThisWave: 0,
    maxComboThisWave: 1,
    flushActiveThisCombo: false,
    columnSweepActiveThisWave: false,
    drawContinueCountThisChain: 0,
    mercyActiveNextCombo: false,
    ...overrides,
  }
}
```

- [ ] **Step 3: `itemEffects.ts`を新規作成する**

Task 3後の`engine.ts`を`Read`し、以下を移す(Task 1適用前の元ファイル行番号: 646-681行目`ItemEffectContext`インターフェース・683-686行目`fmtMultiplier`関数・688行目`ItemEffect`型・690-731行目`chainHasNoFace`/`chainIsFaceOnly`/`chainSuitExclusive`/`chainColorExclusive`/`countSuitInChain`/`countRankInChain`/`redBlackBalanced`(すべて非export)・733-1200行目`ITEM_EFFECTS`定数・1202-1218行目`applyItemEffects`関数)。

ファイル冒頭ヘッダー:

```ts
// src/lib/game/shidasu/itemEffects.ts
import type { Card, ItemId, Suit } from './types'
import type { ShidasuParams } from './params'
import { isRed, isFace, type ChainBonusResult } from './patterns'
```

- [ ] **Step 4: `engine.ts`から移した範囲を削除し、importを追加する**

`playCard`・`drawStock`は`ItemEffectContext`型・`applyItemEffects`関数・`fmtMultiplier`関数を引き続き使用するため、`engine.ts`のimport群に以下を追加する:

```ts
import { applyItemEffects, fmtMultiplier, type ItemEffectContext } from './itemEffects'
```

- [ ] **Step 5: `itemEffects.test.ts`を新規作成する**

`engine.test.ts`(Task 1〜3適用後の状態)から以下のブロックをすべて移す(Task 1適用前の元ファイル行番号): 1628-1802行目`describe('applyItemEffects', ...)`、2696-2756行目・2757-2820行目・2821-2901行目・2902-2986行目・2987-3026行目・3027-3124行目・3125-3194行目・3195-3227行目・3325-3366行目・3367-3404行目・3405-3453行目・3454-3488行目・3489-3523行目の各`describe('applyItemEffects (グループN: ...)', ...)`ブロック。

各ブロック内のローカル`function ctx(...)`定義は、Step 1の判定に従い、共通版と完全一致するものは削除して`testHelpers.ts`からのimportに置き換え、異なるものはそのブロック内にローカル関数としてそのまま残す。

ファイル冒頭ヘッダー:

```ts
// src/lib/game/shidasu/itemEffects.test.ts
import { describe, test, expect } from 'vitest'
import { applyItemEffects, type ItemEffectContext } from './itemEffects'
import { DEFAULT_PARAMS } from './params'
import { card, ctx } from './testHelpers'
```

(ローカル`ctx()`を残すブロックがある場合、そのブロック内では共通`ctx`をimportしていても同名のローカル関数で上書き定義してよい—Vitestのdescribeブロックはスコープが独立しているため問題ない。)

- [ ] **Step 6: `engine.test.ts`のimportを整理する**

冒頭のimport文から`applyItemEffects`・`type ItemEffectContext`を削除する。

- [ ] **Step 7: テスト実行・型チェック**

```bash
npm run test
npm run check
```

Expected: 全テスト成功、型エラーなし。分割前後でテストケース総数が完全一致すること。

- [ ] **Step 8: コミット**

```bash
git add src/lib/game/shidasu/testHelpers.ts src/lib/game/shidasu/itemEffects.ts src/lib/game/shidasu/itemEffects.test.ts src/lib/game/shidasu/engine.ts src/lib/game/shidasu/engine.test.ts
git commit -m "refactor: 護符効果(ITEM_EFFECTS)をitemEffects.tsに分離しctx()ヘルパーを共通化"
```

---

### Task 5: `engine.ts`/`engine.test.ts`の最終整理・全体検証

**Files:**
- Modify: `src/lib/game/shidasu/engine.ts` (import整理のみ、ロジック変更なし)
- Modify: `src/lib/game/shidasu/engine.test.ts` (import整理のみ)

- [ ] **Step 1: `engine.ts`の残存内容を確認する**

Task 1〜4完了後の`engine.ts`を`Read`し、以下の関数・定数のみが残っていることを確認する: `RANK_LABEL`・`isFace`・`rankLabel`・`isPlayable`・`getPlayableColumns`・`remainingCount`・`convertRandomCardToWild`・`arrangeNextCardForContinuation`・`startWave`・`playCard`・`drawStock`・`isStuck`・`markStuck`・`createInitialRun`・`beginRun`・`resolveWaveEnd`・`pickItem`・`confirmItemSwap`・`cancelItemSwap`・`skipItemSelect`・`advanceStage`・`restartRun`・`withActiveWave`・`applyPlayCard`・`applyDrawStock`・`tryResilienceRevive`・`applyStuckCheck`・`debugCardIdSeq`・`forceStockTop`。

これ以外の宣言が残っていた場合(移し忘れ)、Task 1〜4のいずれに属するかを判断し、該当する新ファイルに移す。

- [ ] **Step 2: `engine.ts`冒頭のimport文を最終確認する**

以下の内容になっていることを確認する(未使用のimportがあれば`npm run check`のunused-import警告で検出されるため、それに従って削除する):

```ts
// src/lib/game/shidasu/engine.ts
import type { Card, StageModifier, WaveState, ItemId, WaveEndReason, RunState, Suit, Rank, DeckCard, RoleName, BonusGain } from './types'
import type { ShidasuParams } from './params'
import { createRng, shuffle, shuffleInPlace, standardDeckComposition } from './deck'
import { isFace, chainContinuesPattern } from './patterns'
import { rollItemOffer } from './items'
import { applyItemEffects, fmtMultiplier, type ItemEffectContext } from './itemEffects'
import { applyDirectEffects, type DirectEffectContext } from './directEffects'
```

- [ ] **Step 3: テストケース総数の分割前後一致を確認する**

分割後の5ファイル(`engine.test.ts`・`patterns.test.ts`・`items.test.ts`・`directEffects.test.ts`・`itemEffects.test.ts`)それぞれで`test(`の出現数を数え、合計がこのリファクタリング開始前の`engine.test.ts`の`test(`出現数(3793行のオリジナルファイル)と一致することを確認する。

```bash
grep -c "test(" src/lib/game/shidasu/engine.test.ts src/lib/game/shidasu/patterns.test.ts src/lib/game/shidasu/items.test.ts src/lib/game/shidasu/directEffects.test.ts src/lib/game/shidasu/itemEffects.test.ts
```

Expected: 5ファイルの合計が、分割前のオリジナル`engine.test.ts`の`test(`出現数と一致する。

- [ ] **Step 4: 全体テスト・型チェック・ビルド**

```bash
npm run test
npm run check
npm run build
```

Expected: すべて成功。

- [ ] **Step 5: コミット(差分がある場合のみ)**

```bash
git add src/lib/game/shidasu/engine.ts src/lib/game/shidasu/engine.test.ts
git commit -m "refactor: engine.ts/engine.test.tsの最終整理(未使用import削除)"
```

(Step 1〜2で修正すべき差分がなければ、このコミットは不要。)

---

### Task 6: ブラウザでの動作確認

**Files:** なし(確認のみ)

- [ ] **Step 1: 開発サーバーを起動する**

```bash
npm run dev
```

- [ ] **Step 2: `/game/shidasu`を確認する**

ブラウザ(またはPlaywright)で開き、カードをプレイ・山札をめくる・護符選択画面まで進め、スコア計算・護符バッジ表示・説明文表示がリファクタリング前と同じであることを確認する。

- [ ] **Step 3: `/admin/shidasu-debug`を確認する**

護符をいくつかチェックし、場札をプレイ・山札めくり・「場札を階段にする」→「元に戻す」・デッキリセットの一連の操作が問題なく動作することを確認する。

- [ ] **Step 4: `/admin/shidasu-talismans`を確認する**

護符一覧が表示され、説明文プレビューが正しく展開されていること、レア度・説明文の編集が保存できることを確認する。

- [ ] **Step 5: 開発サーバーを停止する**

動作確認が完了したら開発サーバーを終了する。

---

## Self-Review 結果

- **spec coverage:** spec section 1(ファイル分割)→Task 1-4、section 2(テスト分割+testHelpers統合)→Task 1,3,4のStep群、section 3(検証方針)→Task 5-6、受け入れ基準1-8→Task 1-6でそれぞれ充足。基準6(テスト総数一致)はTask 5 Step 3で機械的に検証する。
- **placeholder scan:** 「行範囲をそのまま移す」という指示は、対象コードが既存ファイルに実在し行番号で一意に特定できるため、プレースホルダーではなく機械的な移動指示として扱う。ctx()統合の判断基準(Step 1: 完全一致のみ統合)も具体的な手順を明記済み。
- **type consistency:** `ItemEffectContext`/`DirectEffectContext`の型名・フィールド名はTask 1-4を通して一貫させた。`ctx`/`directCtx`/`card`のヘルパー関数名もTask 3・4で一貫させた。
