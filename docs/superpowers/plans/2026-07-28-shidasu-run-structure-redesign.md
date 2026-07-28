# ラン構成の再構築(データモデル層) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `docs/superpowers/specs/2026-07-28-shidasu-run-structure-redesign-design.md`で定義した「星」データモデルを`types.ts`・`params.ts`・`engine.ts`に実装し、旧`BossKind`/`currentBossKind`/`currentGreatMisfortuneSuit`/`bossTierOf`ベースの仕組みを`Star`/`stageStars`ベースへ置き換える。

**Architecture:** `types.ts`に`Star`・`StarRestriction`型を追加し、`params.ts`に星の定義データ(`stars`)を追加する。`engine.ts`の`beginRun`/`resolveWaveEnd`/`nextWaveLocation`等を、ステージ突入時に`stageStars`(3つの星の配列)を一括抽選する方式に書き換える。`stageModifierFor`/`bossScoreLockFor`は、現在Waveの星(`RunState.stageStars[run.waveIndex]`から都度導出する。専用フィールドとしては保持しない)の`restriction`を見る形に変更する。

**スコープ注記(重要):** このplanは`types.ts`・`params.ts`・`engine.ts`・関連ユニットテスト(`engine.test.ts`)のみを対象とする。以下は**今回のスコープ外**であり、別セッションで扱う:
- 新設「ステージ画面」のUI実装(`PlayArea.svelte`または新規コンポーネント)
- `+page.svelte`のWave進行フロー本格改修(ショップ→ステージ画面→次Wave、というフロー自体の実装)
- 管理画面(`src/routes/admin/shidasu-bosses/+page.svelte`・`src/routes/admin/shidasu/BossTiersSection.svelte`)の「星」編集UIへの置き換え
- Waveスキップ・リロールの実際の操作UI
- 8ステージクリアの新しい終端ロジックのUI(`continueChoice`に代わる新フェーズ)

このplanでは、`+page.svelte`の型エラーを解消するための**最小限の暫定修正**(表示ロジックを`stageStars[waveIndex]`ベースに置き換えるだけ、見た目は変えない)のみ行う。

**Tech Stack:** TypeScript、Vitest。

---

## 前提知識(既存コードの構造)

- `src/lib/game/shidasu/types.ts`: `RunState`・`BossKind`・`BossTierKey`・`StageModifier`などの型定義
- `src/lib/game/shidasu/params.ts`: `ShidasuParams`インターフェース定義。`bossTiers`・`bosses`フィールドが今回の対象
- `src/lib/game/shidasu/engine.ts`: ゲームロジック本体。`bossTierOf`・`stageModifierFor`・`bossScoreLockFor`・`nextWaveLocation`・`nextBossKind`・`nextGreatMisfortuneSuit`・`rollBossKindForStage`・`rollGreatMisfortuneSuit`・`enterShop`・`beginRun`・`createInitialRun`・`resolveWaveEnd`が変更対象
- `src/lib/game/shidasu/bosses.ts`: `BOSS_KINDS`配列、`bossName`/`bossDesc`/`bossesInTier`関数。今回**廃止**し、`Star`ベースの同等関数に置き換える
- `src/lib/game/shidasu/bossActualEffects.ts`: 開発者向け監査ドキュメント。`BOSS_ACTUAL_EFFECTS`を`Star`ベースに書き換える
- `src/lib/game/shidasu/sinDaughters.ts`: 命名候補データ(`SIN_DAUGHTERS`)。`BossKind`と独立しているため**変更不要**、そのまま残す
- `src/lib/game/shidasu/engine.test.ts`: 既存テストで`currentBossKind`/`currentGreatMisfortuneSuit`/`bossTierOf`/`stageModifierFor`/`bossScoreLockFor`/`continueChoice`関連のテストが約41箇所存在する。書き換えが必要
- `src/routes/game/shidasu/+page.svelte`: 64〜71行目の`upcomingBossInfo`(ヘッダー表示用)、722行目の`params.bossTiers.taikyou.name`参照が型エラーになる箇所。今回は最小限の暫定修正のみ行う

**設計の要点(specより):**
- `Star`は`waveSlot: 1 | 2 | 3`を持つフラットな1つのリストとして定義される
- Wave開始時、そのWave番号と`waveSlot`が一致する星の中からランダムに1つ選ばれる
- 新ステージ突入直前(`waveIndex`が0に戻るタイミング)に、waveSlot 1・2・3それぞれの候補群から1つずつ抽選し`stageStars: [Star, Star, Star]`としてまとめて確定させる
- `restriction.kind === 'suit'`が選ばれた場合のみ、選出と同時にスートを抽選し`restriction.suit`に確定させる(`currentGreatMisfortuneSuit`のような別フィールドは廃止)
- 目標点数: `base(stageIndex) = flow.stageTargetBase × flow.stageTargetMultiplier^stageIndex`、`target = base × stageStars[waveIndex].targetMultiplier`
- `reward`は単一の固定額(`number`)、`sabotage`は今回`null`固定
- 8ステージクリアで1回だけ続行確認(このロジック自体は今回実装するが、UIは別セッション)

---

### Task 1: `types.ts`に`Star`・`StarRestriction`型を追加し、`RunState`を変更

**Files:**
- Modify: `src/lib/game/shidasu/types.ts`

- [ ] **Step 1: `StarRestriction`・`Star`型を追加**

`types.ts`の`BossKind`・`BossTierKey`の定義(4〜14行目付近)の直後に、以下を追加する:

```ts
// Wave単位の新概念「星」が持つ制限ルール。旧BossKind(noLoop/faceLock/lowCombo/oddCombo/suit/face)を
// kindで判別するUnion型として引き継ぐ。suitのみ、星が選出されると同時にスートを抽選し確定させる。
export type StarRestriction =
  | { kind: 'noLoop' }
  | { kind: 'faceLock' }
  | { kind: 'lowCombo'; maxCombo: number }
  | { kind: 'oddCombo' }
  | { kind: 'suit'; suit: Suit }
  | { kind: 'face' }
  | null

// Wave単位の新概念「星」(旧: 小凶/中凶/大凶の階級制を廃止した代わりの仕組み)。
// waveSlotが1/2/3のうちどのWave番号で使われうるかを表す。全ての星はフラットな1つのリストとして
// 定義され、Wave開始時にwaveSlotが一致する星の中からランダムに1つ選ばれる。
export interface Star {
  id: string
  name: string
  waveSlot: 1 | 2 | 3
  targetMultiplier: number
  reward: number
  restriction: StarRestriction
  sabotage: null
}
```

`Suit`型は同ファイル3行目で既に定義済みのため、追加のimportは不要。

- [ ] **Step 2: `BossKind`・`BossTierKey`型に非推奨コメントを追加**

`BossKind`・`BossTierKey`の型定義(4〜14行目付近)は、`Star`移行後も`bosses.ts`の一時的な互換のために残すファイルがある場合に備え、削除せずコメントで非推奨を明記する。既存の型定義:

```ts
export type BossKind = 'noLoop' | 'faceLock' | 'lowCombo' | 'oddCombo' | 'suit' | 'face'
export type BossTierKey = 'shoukyou' | 'chuukyou' | 'taikyou'
```

の直前に、以下のコメントを追加する:

```ts
// 非推奨: Star型(下記)への移行に伴い廃止予定。StarRestriction.kindが同等の役割を持つ。
// 移行完了後(次回以降のセッションでUI・管理画面の置き換えが終わったら)削除すること。
```

- [ ] **Step 3: `RunState`から`currentBossKind`・`currentGreatMisfortuneSuit`を削除し、`stageStars`を追加**

`RunState`インターフェース(234行目付近)内の以下のフィールドを変更する。

変更前(256〜264行目付近):

```ts
  // 大凶ステージ(stageIndex % 3 === 2)の対象スート。中凶クリア直後(大凶ステージの1ウェーブ目を
  // 配る時点)にrandで抽選して確定し、そのステージが終わるまで(1〜3ウェーブ目)固定で使い回す。
  // 小凶・中凶ステージの間は常にnull
  currentGreatMisfortuneSuit: Suit | null
  // ラン開始時に選ばれたスプレッド。ラン全体を通して不変(タイトル画面に戻って選び直すまで固定)
  spreadId: SpreadId
  // 現在のステージのボスウェーブで適用される候補。ステージ突入時(そのステージのウェーブ0を
  // 配る時点)にそのステージの階級(bossTierOf(stageIndex))に属する候補群からrandで1つ抽選し、
  // そのステージの3ウェーブ間(表示・実際の判定とも)固定で使い回す。titleフェーズではnull
  currentBossKind: BossKind | null
```

変更後:

```ts
  // ラン開始時に選ばれたスプレッド。ラン全体を通して不変(タイトル画面に戻って選び直すまで固定)
  spreadId: SpreadId
  // 現在のステージの3Wave分の「星」。新しいステージに入る直前(waveIndexが0に戻るタイミング)に
  // waveSlot 1・2・3それぞれの候補群から1つずつ抽選し一括で確定させる。titleフェーズでは空配列。
  // stageStars[waveIndex]が現在Waveの星に相当する(専用フィールドは持たず都度導出する)。
  stageStars: Star[]
```

`currentBossKind`・`currentGreatMisfortuneSuit`を参照する既存コードは後続タスクで全て置き換えるため、この時点で型エラーが出るのは想定通り(まだ`engine.ts`を直していないため)。

- [ ] **Step 4: 型チェックを実行しエラー内容を確認**

Run: `npm run check 2>&1 | grep -i "shidasu"`
Expected: `engine.ts`・`+page.svelte`等で`currentBossKind`/`currentGreatMisfortuneSuit`が存在しないというエラーが複数出る(想定通り、後続タスクで解消する)

- [ ] **Step 5: コミット**

```bash
git add src/lib/game/shidasu/types.ts
git commit -m "feat: Star型を追加しRunStateをstageStarsベースに変更"
```

---

### Task 2: `params.ts`に星の定義データを追加

**Files:**
- Modify: `src/lib/game/shidasu/params.ts`

- [ ] **Step 1: 既存の`flow`フィールドに`stageTargetBase`・`stageTargetMultiplier`・`stagesPerRun`を追加**

`ShidasuParams`インターフェース内には既に以下の`flow`フィールドが定義されている(218〜221行目付近):

```ts
  flow: {
    wavesPerStage: number
    clearDelayMs: number
  }
```

これを、以下のように変更する(既存の2フィールドは維持したまま追加):

```ts
  flow: {
    wavesPerStage: number
    clearDelayMs: number
    // ステージ基準点。target(stageIndex, waveIndex) = flow.stageTargetBase × flow.stageTargetMultiplier^stageIndex
    // × stageStars[waveIndex].targetMultiplier で算出する。
    stageTargetBase: number
    stageTargetMultiplier: number
    // このステージ数をクリアするとラン全体のクリアとなり、続行確認(continueChoice)を挟む。
    stagesPerRun: number
  }
```

- [ ] **Step 2: `ShidasuParams`インターフェースに`stars`フィールドを追加**

`ShidasuParams`インターフェース内、`bossTiers`・`bosses`フィールド(29〜43行目付近)の直前に、以下を追加する:

```ts
  // Wave単位の新概念「星」の定義一覧。waveSlot(1/2/3)が一致する星の中からランダムに1つ選ばれる。
  // idは一意な文字列(管理画面での編集・参照に使う)。
  stars: {
    id: string
    name: string
    waveSlot: 1 | 2 | 3
    targetMultiplier: number
    reward: number
    restrictionKind: 'none' | 'noLoop' | 'faceLock' | 'lowCombo' | 'oddCombo' | 'suit' | 'face'
    maxCombo?: number
  }[]
```

`restrictionKind: 'none'`は制限ルールなし(旧`waveSlot 1・2`用)を表す。`maxCombo`は`restrictionKind === 'lowCombo'`のときのみ使う任意フィールド。管理画面での編集しやすさを優先し、`params.ts`内のデータはUnion型ではなくフラットな構造にする(実行時に`engine.ts`側で`StarRestriction`型へ変換する)。

- [ ] **Step 3: `bossTiers`・`bosses`フィールドに非推奨コメントを追加**

Task 1 Step 2と同様、`bossTiers`・`bosses`フィールド定義の直前に以下のコメントを追加する(削除はしない、後続タスクの`bosses.ts`・管理画面が引き続き参照する可能性があるため):

```ts
  // 非推奨: starsフィールド(上記)への移行に伴い廃止予定。移行完了後(UI・管理画面の
  // 置き換えが終わったら)削除すること。
```

- [ ] **Step 4: `shidasu.config.json`の`flow`エントリを拡張し、`stars`を新規追加**

`src/lib/game/shidasu/shidasu.config.json`の857〜860行目付近に、既に以下の`flow`エントリが存在する:

```json
"flow": {
  "wavesPerStage": 3,
  "clearDelayMs": 450
},
```

これを、以下のように変更する(既存の2キーは維持したまま追加):

```json
"flow": {
  "wavesPerStage": 3,
  "clearDelayMs": 450,
  "stageTargetBase": 2000,
  "stageTargetMultiplier": 1.8,
  "stagesPerRun": 8
},
```

`stageTargetBase`・`stageTargetMultiplier`の値は、既存の`spreads.fool.waveTargetBase`(2000)・`waveTargetMultiplier`(1.5)を参考値として使い、新しい指数カーブが極端に急峻/平坦にならないよう`1.8`とする(暫定値、実際のバランス調整は別セッション)。

続けて、`flow`エントリと同じ階層(トップレベル)に、`stars`の新規キーを追加する。挿入位置は`bosses`エントリの直後を推奨する:

```json
"stars": [
  { "id": "ordinary-moon", "name": "普通の衛星", "waveSlot": 1, "targetMultiplier": 1.0, "reward": 20, "restrictionKind": "none" },
  { "id": "slightly-bigger-moon", "name": "少し大きな衛星", "waveSlot": 2, "targetMultiplier": 1.3, "reward": 25, "restrictionKind": "none" },
  { "id": "closed-loop-planet", "name": "循環の閉じた荒廃惑星", "waveSlot": 3, "targetMultiplier": 1.6, "reward": 35, "restrictionKind": "noLoop" },
  { "id": "sealed-noble-planet", "name": "高貴なる封印の惑星", "waveSlot": 3, "targetMultiplier": 1.6, "reward": 35, "restrictionKind": "faceLock" },
  { "id": "harsh-planet", "name": "弱き者を拒む峻厳な惑星", "waveSlot": 3, "targetMultiplier": 1.6, "reward": 35, "restrictionKind": "lowCombo", "maxCombo": 2 },
  { "id": "twisted-odd-planet", "name": "奇数を忌む歪んだ惑星", "waveSlot": 3, "targetMultiplier": 1.6, "reward": 35, "restrictionKind": "oddCombo" },
  { "id": "exiling-color-planet", "name": "排斥の色殺す惑星", "waveSlot": 3, "targetMultiplier": 1.6, "reward": 35, "restrictionKind": "suit" },
  { "id": "regicide-planet", "name": "王侯を打ち滅ぼす惑星", "waveSlot": 3, "targetMultiplier": 1.6, "reward": 35, "restrictionKind": "face" }
],
```

既存JSONの末尾カンマ・構造を壊さないよう、`bosses`エントリの閉じ`}`の直後にカンマを追加してから`"stars": [...]`を挿入する(JSON構文エラーに注意)。

- [ ] **Step 5: 型チェックを実行**

Run: `npm run check 2>&1 | grep -i "shidasu.config"`
Expected: `shidasu.config.json`の型不一致エラーが出ないことを確認(`ShidasuParams`の`flow`・`stars`フィールドと一致する構造になっているか)

- [ ] **Step 6: コミット**

```bash
git add src/lib/game/shidasu/params.ts src/lib/game/shidasu/shidasu.config.json
git commit -m "feat: paramsにflow・stars定義を追加"
```

---

### Task 3: `engine.ts`の星抽選ロジックを実装

**Files:**
- Modify: `src/lib/game/shidasu/engine.ts`

- [ ] **Step 1: `StarRestriction`変換ヘルパーと星抽選関数を追加**

`engine.ts`内、`rollGreatMisfortuneSuit`・`rollBossKindForStage`関数(927〜945行目付近)を、以下の内容に置き換える:

```ts
// params.stars内の1エントリ(フラットなJSON表現)を、実行時に使うStarRestriction型へ変換する。
function toStarRestriction(entry: ShidasuParams['stars'][number], rand: () => number): StarRestriction {
  switch (entry.restrictionKind) {
    case 'none': return null
    case 'noLoop': return { kind: 'noLoop' }
    case 'faceLock': return { kind: 'faceLock' }
    case 'lowCombo': return { kind: 'lowCombo', maxCombo: entry.maxCombo ?? 2 }
    case 'oddCombo': return { kind: 'oddCombo' }
    case 'suit': return { kind: 'suit', suit: GREAT_MISFORTUNE_SUITS[Math.floor(rand() * GREAT_MISFORTUNE_SUITS.length)] }
    case 'face': return { kind: 'face' }
  }
}

// 指定したwaveSlot(1/2/3)に属する候補群からrandで1つ抽選し、Star型に変換する。
// 候補が1件も無いwaveSlotは管理画面のバリデーションで基本的に発生しないが、念のため
// エントリが見つからない場合は制限ルールなしのダミー星を返す。
function rollStarForSlot(params: ShidasuParams, waveSlot: 1 | 2 | 3, rand: () => number): Star {
  const candidates = params.stars.filter(s => s.waveSlot === waveSlot)
  if (candidates.length === 0) {
    return { id: `fallback-${waveSlot}`, name: '名もなき星', waveSlot, targetMultiplier: 1, reward: 0, restriction: null, sabotage: null }
  }
  const entry = candidates[Math.floor(rand() * candidates.length)]
  return {
    id: entry.id,
    name: entry.name,
    waveSlot: entry.waveSlot,
    targetMultiplier: entry.targetMultiplier,
    reward: entry.reward,
    restriction: toStarRestriction(entry, rand),
    sabotage: null,
  }
}

// 新しいステージに入る際、waveSlot 1・2・3それぞれから1つずつ抽選し3Wave分をまとめて確定させる。
function rollStageStars(params: ShidasuParams, rand: () => number): Star[] {
  return [1, 2, 3].map(slot => rollStarForSlot(params, slot as 1 | 2 | 3, rand))
}
```

`GREAT_MISFORTUNE_SUITS`定数(既存、927行目付近に定義されている)はそのまま流用する。`rollGreatMisfortuneSuit`・`rollBossKindForStage`・`BOSS_TIER_KEYS`・`BOSS_KINDS`は削除する(この置き換えで不要になる)。

`StarRestriction`・`Star`型のimportを、ファイル先頭のimport文に追加する:

```ts
import type { Card, StageModifier, WaveState, ItemId, WaveEndReason, RunState, Suit, Rank, DeckCard, RoleName, BonusGain, ChainCardOrigin, RiteId, Rarity, RevelationId, SpreadId, RunPhase, HeldRevelationOrOracleRef, Star, StarRestriction } from './types'
```

(`BossKind`・`BossTierKey`は今回のimportから削除、他は既存のまま維持)

- [ ] **Step 2: ビルドで壊れていないことを確認**

Run: `npm run build`
Expected: 成功(まだ`stageModifierFor`等の書き換えが済んでいないため、型エラーは残る可能性がある。エラーメッセージを確認し、Step 1のコード自体には問題がないことを確認する)

- [ ] **Step 3: コミット**

```bash
git add src/lib/game/shidasu/engine.ts
git commit -m "feat: engine.tsに星抽選ロジック(rollStageStars等)を実装"
```

---

### Task 4: `stageModifierFor`・`bossScoreLockFor`・`waveTarget`を`Star`ベースに書き換え

**Files:**
- Modify: `src/lib/game/shidasu/engine.ts`

- [ ] **Step 1: `stageModifierFor`を書き換える**

既存の`stageModifierFor`関数(897〜902行目付近)を、以下に置き換える:

変更前:

```ts
export function stageModifierFor(params: ShidasuParams, run: RunState): StageModifier {
  if (!isBossWave(params, run.waveIndex)) return 'none'
  if (run.currentBossKind === 'noLoop') return 'noLoop'
  if (run.currentBossKind === 'faceLock') return 'faceLock'
  return 'none'
}
```

変更後:

```ts
// 現在Waveの星(stageStars[waveIndex])が持つ制限ルールのうち、取得可否そのものを制限する
// 種類(noLoop/faceLock)のみを対象とする。得点ロック系(lowCombo/oddCombo/suit/face)は
// bossScoreLockForが別途扱う。
export function stageModifierFor(params: ShidasuParams, run: RunState): StageModifier {
  const star = run.stageStars[run.waveIndex]
  if (!star || !star.restriction) return 'none'
  if (star.restriction.kind === 'noLoop') return 'noLoop'
  if (star.restriction.kind === 'faceLock') return 'faceLock'
  return 'none'
}
```

- [ ] **Step 2: `bossScoreLockFor`を書き換える**

既存の`bossScoreLockFor`関数(907〜917行目付近)を、以下に置き換える:

変更前:

```ts
export function bossScoreLockFor(params: ShidasuParams, run: RunState): BossScoreLock {
  if (!isBossWave(params, run.waveIndex)) return null
  const tierLabelFor = (bossKind: BossKind) => params.bossTiers[params.bosses[bossKind].tier].name
  switch (run.currentBossKind) {
    case 'lowCombo': return { kind: 'combo', maxCombo: params.bosses.lowCombo.maxCombo, tierLabel: tierLabelFor('lowCombo') }
    case 'oddCombo': return { kind: 'oddCombo', tierLabel: tierLabelFor('oddCombo') }
    case 'suit': return run.currentGreatMisfortuneSuit ? { kind: 'suit', suit: run.currentGreatMisfortuneSuit, tierLabel: tierLabelFor('suit') } : null
    case 'face': return { kind: 'face', tierLabel: tierLabelFor('face') }
    default: return null
  }
}
```

変更後:

```ts
// 現在Waveの星が持つ制限ルールのうち、得点ロック系(lowCombo/oddCombo/suit/face)を対象とする。
// tierLabelには星の名前(旧: 階級名)をそのまま使う。
export function bossScoreLockFor(params: ShidasuParams, run: RunState): BossScoreLock {
  const star = run.stageStars[run.waveIndex]
  if (!star || !star.restriction) return null
  switch (star.restriction.kind) {
    case 'lowCombo': return { kind: 'combo', maxCombo: star.restriction.maxCombo, tierLabel: star.name }
    case 'oddCombo': return { kind: 'oddCombo', tierLabel: star.name }
    case 'suit': return { kind: 'suit', suit: star.restriction.suit, tierLabel: star.name }
    case 'face': return { kind: 'face', tierLabel: star.name }
    default: return null
  }
}
```

- [ ] **Step 3: `waveTarget`を`stageStars`ベースに書き換える**

既存の`waveTarget`関数(919〜925行目付近)を、以下に置き換える:

変更前:

```ts
// ラン開始からの通しウェーブ番号(1始まり)から目標スコアを算出する。
// target(n) = waveTargetBase × waveTargetMultiplier^(n-1)
export function waveTarget(params: ShidasuParams, stageIndex: number, waveIndex: number, spreadId: SpreadId = 'fool'): number {
  const overallWaveNumber = stageIndex * params.flow.wavesPerStage + waveIndex + 1
  const spread = params.spreads[spreadId]
  return Math.floor(spread.waveTargetBase * spread.waveTargetMultiplier ** (overallWaveNumber - 1))
}
```

変更後:

```ts
// ステージ基準点に、現在Waveの星が持つ倍率をかけて目標スコアを算出する。
// target(stageIndex, waveIndex) = flow.stageTargetBase × flow.stageTargetMultiplier^stageIndex × star.targetMultiplier
export function waveTarget(params: ShidasuParams, stageIndex: number, waveIndex: number, stageStars: Star[]): number {
  const base = params.flow.stageTargetBase * params.flow.stageTargetMultiplier ** stageIndex
  const star = stageStars[waveIndex]
  return Math.floor(base * (star?.targetMultiplier ?? 1))
}
```

`spreadId`引数を`stageStars`に置き換える(スプレッドは`initialExtraTableauRows`にのみ使われ続けるため、`waveTarget`からは不要になる)。

呼び出し元を全て確認し、`spreadId`引数を`stageStars`(通常`run.stageStars`)に置き換える:

Run: `grep -n "waveTarget(" src/lib/game/shidasu/engine.ts`

`engine.ts`内の呼び出し(1051・1479・1488・1527行目付近、いずれも`waveTarget(params, run.stageIndex, run.waveIndex, run.spreadId)`という形)を、`waveTarget(params, run.stageIndex, run.waveIndex, run.stageStars)`に置き換える。

- [ ] **Step 4: `isBossWave`・`bossTierOf`・`BOSS_TIER_KEYS`の呼び出し元を確認**

Run: `grep -n "isBossWave\|bossTierOf\|BOSS_TIER_KEYS" src/lib/game/shidasu/engine.ts`

残っている呼び出し元(`beginRun`・`resolveWaveEnd`・`nextBossKind`・`nextGreatMisfortuneSuit`)は後続タスクで書き換えるため、この時点でまだ残っていて問題ない。`isBossWave`関数自体は削除しない(waveIndexがステージ最終Wave=waveSlot 3のWaveかどうかの判定として、後続タスクでも使う可能性があるため)。

- [ ] **Step 5: ビルドで壊れていないことを確認**

Run: `npm run build`
Expected: 成功。まだ他の箇所にエラーが残る可能性があるが、`stageModifierFor`・`bossScoreLockFor`・`waveTarget`自体は正しく書き換わっていることを確認する

- [ ] **Step 6: コミット**

```bash
git add src/lib/game/shidasu/engine.ts
git commit -m "feat: stageModifierFor・bossScoreLockFor・waveTargetをstageStarsベースに書き換え"
```

---

### Task 5: `beginRun`・`resolveWaveEnd`・`nextWaveLocation`を`stageStars`ベースに書き換え

**Files:**
- Modify: `src/lib/game/shidasu/engine.ts`

- [ ] **Step 1: `createInitialRun`を書き換える**

既存の`createInitialRun`関数(1002〜1011行目付近)を、以下に置き換える:

変更前:

```ts
export function createInitialRun(): RunState {
  return {
    phase: 'title', stageIndex: 0, waveIndex: 0, items: [], offer: [], wave: null, pendingNewItem: null,
    deckComposition: standardDeckComposition(), rites: [], revelations: [], revelationOffer: [], extraTableauRows: 0,
    oracleLevels: defaultOracleLevels(), oracleOffer: [], currentGreatMisfortuneSuit: null, spreadId: 'fool',
    currentBossKind: null, currency: 0,
    oracles: [], shop: null, offerPickRemaining: 0, riteOffer: [],
    pendingNewRite: null, pendingNewRevelation: null, pendingNewOracle: null,
  }
}
```

変更後:

```ts
export function createInitialRun(): RunState {
  return {
    phase: 'title', stageIndex: 0, waveIndex: 0, items: [], offer: [], wave: null, pendingNewItem: null,
    deckComposition: standardDeckComposition(), rites: [], revelations: [], revelationOffer: [], extraTableauRows: 0,
    oracleLevels: defaultOracleLevels(), oracleOffer: [], spreadId: 'fool',
    stageStars: [], currency: 0,
    oracles: [], shop: null, offerPickRemaining: 0, riteOffer: [],
    pendingNewRite: null, pendingNewRevelation: null, pendingNewOracle: null,
  }
}
```

- [ ] **Step 2: `beginRun`を書き換える**

既存の`beginRun`関数(1013〜1045行目付近)を、以下に置き換える:

変更前:

```ts
export function beginRun(params: ShidasuParams, seed?: number, spreadId: SpreadId = 'fool'): RunState {
  const initialExtraTableauRows = params.spreads[spreadId].initialExtraTableauRows
  const rand = createRng(seed ?? Math.floor(Math.random() * 999999) + 1)
  const initialBossKind = rollBossKindForStage(params, 0, rand)
  const { wave, deckComposition } = startWave(params, 0, 0, [], standardDeckComposition(), seed, initialExtraTableauRows, defaultOracleLevels())
  return {
    phase: 'playing',
    stageIndex: 0,
    waveIndex: 0,
    items: [],
    offer: [],
    wave,
    pendingNewItem: null,
    deckComposition,
    rites: [],
    revelations: [],
    revelationOffer: [],
    extraTableauRows: initialExtraTableauRows,
    oracleLevels: defaultOracleLevels(),
    oracleOffer: [],
    currentGreatMisfortuneSuit: null,
    spreadId,
    currentBossKind: initialBossKind,
    currency: params.currency.initialAmount,
    oracles: [],
    shop: null,
    offerPickRemaining: 0,
    riteOffer: [],
    pendingNewRite: null,
    pendingNewRevelation: null,
    pendingNewOracle: null,
  }
}
```

変更後:

```ts
export function beginRun(params: ShidasuParams, seed?: number, spreadId: SpreadId = 'fool'): RunState {
  const initialExtraTableauRows = params.spreads[spreadId].initialExtraTableauRows
  const rand = createRng(seed ?? Math.floor(Math.random() * 999999) + 1)
  const initialStageStars = rollStageStars(params, rand)
  const { wave, deckComposition } = startWave(params, 0, 0, [], standardDeckComposition(), seed, initialExtraTableauRows, defaultOracleLevels())
  return {
    phase: 'playing',
    stageIndex: 0,
    waveIndex: 0,
    items: [],
    offer: [],
    wave,
    pendingNewItem: null,
    deckComposition,
    rites: [],
    revelations: [],
    revelationOffer: [],
    extraTableauRows: initialExtraTableauRows,
    oracleLevels: defaultOracleLevels(),
    oracleOffer: [],
    spreadId,
    stageStars: initialStageStars,
    currency: params.currency.initialAmount,
    oracles: [],
    shop: null,
    offerPickRemaining: 0,
    riteOffer: [],
    pendingNewRite: null,
    pendingNewRevelation: null,
    pendingNewOracle: null,
  }
}
```

- [ ] **Step 3: `nextWaveLocation`・`nextBossKind`・`nextGreatMisfortuneSuit`を書き換える**

既存の`nextWaveLocation`関数(951〜959行目付近)・`nextBossKind`関数(963〜971行目付近)・`nextGreatMisfortuneSuit`関数(976〜984行目付近)を、以下に置き換える:

変更前:

```ts
function nextWaveLocation(params: ShidasuParams, run: RunState): { stageIndex: number; waveIndex: number } {
  const nextWaveIndex = run.waveIndex + 1
  if (nextWaveIndex >= params.flow.wavesPerStage) {
    return { stageIndex: run.stageIndex + 1, waveIndex: 0 }
  }
  return { stageIndex: run.stageIndex, waveIndex: nextWaveIndex }
}

function nextBossKind(
  params: ShidasuParams,
  run: RunState,
  newLocation: { stageIndex: number; waveIndex: number },
  rand: () => number
): BossKind | null {
  if (newLocation.stageIndex === run.stageIndex) return run.currentBossKind
  return rollBossKindForStage(params, newLocation.stageIndex, rand)
}

function nextGreatMisfortuneSuit(
  run: RunState,
  newLocation: { stageIndex: number; waveIndex: number },
  newBossKind: BossKind | null,
  rand: () => number
): Suit | null {
  if (newLocation.stageIndex === run.stageIndex) return run.currentGreatMisfortuneSuit
  return newBossKind === 'suit' ? rollGreatMisfortuneSuit(rand) : null
}
```

変更後:

```ts
function nextWaveLocation(params: ShidasuParams, run: RunState): { stageIndex: number; waveIndex: number } {
  const nextWaveIndex = run.waveIndex + 1
  if (nextWaveIndex >= params.flow.wavesPerStage) {
    return { stageIndex: run.stageIndex + 1, waveIndex: 0 }
  }
  return { stageIndex: run.stageIndex, waveIndex: nextWaveIndex }
}

// 次のウェーブ位置に応じたstageStarsを算出する。同じステージ内に留まる場合は現在のstageStarsを
// 維持し、新しいステージに入る場合はrollStageStarsで3Wave分をまとめて新規抽選する。
function nextStageStars(
  params: ShidasuParams,
  run: RunState,
  newLocation: { stageIndex: number; waveIndex: number },
  rand: () => number
): Star[] {
  if (newLocation.stageIndex === run.stageIndex) return run.stageStars
  return rollStageStars(params, rand)
}
```

`nextBossKind`・`nextGreatMisfortuneSuit`は`nextStageStars`に統合されるため削除する。

- [ ] **Step 4: `enterShop`を書き換える**

既存の`enterShop`関数(1083〜1105行目付近)を確認し、`newBossKind`・`newGreatMisfortuneSuit`の呼び出し部分を`newStageStars`に置き換える。

変更前:

```ts
function enterShop(params: ShidasuParams, run: RunState, seed: number | undefined, rand: () => number): RunState {
  const newLocation = nextWaveLocation(params, run)
  const newBossKind = nextBossKind(params, run, newLocation, rand)
  const newGreatMisfortuneSuit = nextGreatMisfortuneSuit(run, newLocation, newBossKind, rand)
  const { wave, deckComposition } = startWave(params, newLocation.stageIndex, newLocation.waveIndex, run.items, run.deckComposition, seed, run.extraTableauRows, run.oracleLevels)
  const next: RunState = {
    ...run,
    phase: 'shop',
    stageIndex: newLocation.stageIndex,
    waveIndex: newLocation.waveIndex,
    currentGreatMisfortuneSuit: newGreatMisfortuneSuit,
    currentBossKind: newBossKind,
    offer: [],
    pendingNewItem: null,
    wave,
    deckComposition,
    revelationOffer: [],
    oracleOffer: [],
    riteOffer: [],
    offerPickRemaining: 0,
  }
  return { ...next, shop: rollShop(next, rand) }
}
```

変更後:

```ts
function enterShop(params: ShidasuParams, run: RunState, seed: number | undefined, rand: () => number): RunState {
  const newLocation = nextWaveLocation(params, run)
  const newStageStars = nextStageStars(params, run, newLocation, rand)
  const { wave, deckComposition } = startWave(params, newLocation.stageIndex, newLocation.waveIndex, run.items, run.deckComposition, seed, run.extraTableauRows, run.oracleLevels)
  const next: RunState = {
    ...run,
    phase: 'shop',
    stageIndex: newLocation.stageIndex,
    waveIndex: newLocation.waveIndex,
    stageStars: newStageStars,
    offer: [],
    pendingNewItem: null,
    wave,
    deckComposition,
    revelationOffer: [],
    oracleOffer: [],
    riteOffer: [],
    offerPickRemaining: 0,
  }
  return { ...next, shop: rollShop(next, rand) }
}
```

- [ ] **Step 5: `resolveWaveEnd`の大凶(taikyou)判定を8ステージ終端判定に書き換える**

既存の`resolveWaveEnd`関数(1047〜1066行目付近)を確認する。以下の箇所を変更する:

変更前:

```ts
  const earned = params.currency.waveClearAmount
    + (isBossWave(params, run.waveIndex) ? params.currency.bossBonus[BOSS_TIER_KEYS[bossTierOf(run.stageIndex)]] : 0)
  const runWithCurrency = { ...run, currency: run.currency + earned }

  // 大凶(各サイクルの最終ウェーブ)クリア時のみ、ショップ突入を後回しにして続行確認を挟む。
  // それ以外(小凶・中凶のボスウェーブを含む通常のウェーブクリア)は、すべて同じショップへ進む。
  if (isBossWave(params, run.waveIndex) && bossTierOf(run.stageIndex) === 2) {
    return { ...runWithCurrency, phase: 'continueChoice' }
  }
  return enterShop(params, runWithCurrency, seed, rand)
```

変更後:

```ts
  const currentStar = run.stageStars[run.waveIndex]
  const earned = params.currency.waveClearAmount + (currentStar?.reward ?? 0)
  const runWithCurrency = { ...run, currency: run.currency + earned }

  // 8ステージクリア(stageIndex === stagesPerRun - 1のwaveSlot 3クリア)時のみ、ショップ突入を
  // 後回しにして続行確認を挟む。それ以外は通常通りショップへ進む。
  const isFinalWaveOfRun = isBossWave(params, run.waveIndex) && run.stageIndex === params.flow.stagesPerRun - 1
  if (isFinalWaveOfRun) {
    return { ...runWithCurrency, phase: 'continueChoice' }
  }
  return enterShop(params, runWithCurrency, seed, rand)
```

- [ ] **Step 6: ビルドで壊れていないことを確認**

Run: `npm run build`
Expected: 成功。`grep -n "currentBossKind\|currentGreatMisfortuneSuit\|BOSS_TIER_KEYS\|BOSS_KINDS\|rollBossKindForStage\|rollGreatMisfortuneSuit\|bossTierOf" src/lib/game/shidasu/engine.ts`を実行し、`engine.ts`内に残存していないことを確認する(`isBossWave`は残ってよい)

- [ ] **Step 7: コミット**

```bash
git add src/lib/game/shidasu/engine.ts
git commit -m "feat: beginRun・resolveWaveEnd・enterShopをstageStarsベースに書き換え"
```

---

### Task 6: `bosses.ts`・`bossActualEffects.ts`を`Star`ベースに書き換え

**Files:**
- Modify: `src/lib/game/shidasu/bosses.ts`
- Modify: `src/lib/game/shidasu/bossActualEffects.ts`

- [ ] **Step 1: `bosses.ts`を書き換える**

`src/lib/game/shidasu/bosses.ts`の全内容を、以下に置き換える:

```ts
// src/lib/game/shidasu/bosses.ts
import type { ShidasuParams } from './params'

// 指定したwaveSlotに属する星の一覧を返す(管理画面の件数表示・バリデーションで使う)。
export function starsInSlot(params: ShidasuParams, waveSlot: 1 | 2 | 3): ShidasuParams['stars'] {
  return params.stars.filter(s => s.waveSlot === waveSlot)
}
```

`bossName`・`bossDesc`関数は、星の`name`・`reward`・`restrictionKind`が`params.stars`エントリに直接含まれているため不要になり削除する。呼び出し元(`+page.svelte`)は後続タスクで書き換える。

- [ ] **Step 2: `bossActualEffects.ts`を書き換える**

`src/lib/game/shidasu/bossActualEffects.ts`の全内容を、以下に置き換える:

```ts
// src/lib/game/shidasu/bossActualEffects.ts

// 各制限ルール種別の実際の実装ロジックを、開発者向けに要約したもの(監査用)。
// params.stars内のrestrictionKindと対応する。実装(engine.ts)を正として記述する。
export const STAR_RESTRICTION_ACTUAL_EFFECTS: Record<'noLoop' | 'faceLock' | 'lowCombo' | 'oddCombo' | 'suit' | 'face', string> = {
  noLoop: 'stageModifierForがStageModifier "noLoop" を返し、isPlayableでランク差12(A⇔Kループ)の接続を禁止する(取得可否そのものを制限、得点には無関係)',
  faceLock: 'stageModifierForがStageModifier "faceLock" を返し、isPlayableでコンボ数が2未満のとき絵札(J・Q・K、ランク11以上)の取得を禁止する(ワイルドの場札はfaceLock判定より先に優先評価される)',
  lowCombo: 'bossScoreLockForが{kind:"combo", maxCombo:star.restriction.maxCombo}を返し、playCard/drawStockでeffectiveCombo(庇護・大地等の護符補正込みの実効コンボ数)がmaxCombo以下のとき獲得点(gained/naiveGained)を0にする。コンボ数自体(wave.combo)は通常通り進行する',
  oddCombo: 'bossScoreLockForが{kind:"oddCombo"}を返し、playCard/drawStockでeffectiveComboが奇数のとき獲得点を0にする。コンボ数自体は通常通り進行する',
  suit: '星が選出される瞬間(rollStarForSlot内のtoStarRestriction)にスートを1つ確定しstar.restriction.suitに保持する。bossScoreLockForが{kind:"suit", suit}を返し、playCard/drawStockで非ワイルドかつそのスートのカードを取ると獲得点を0にする(ワイルドは対象外)',
  face: 'bossScoreLockForが{kind:"face"}を返し、playCard/drawStockで非ワイルドかつisFace(ランク11以上)のカードを取ると獲得点を0にする(ワイルドは対象外)',
}
```

- [ ] **Step 3: `bosses.ts`・`bossActualEffects.ts`の呼び出し元を確認**

Run: `grep -rn "from '\$lib/game/shidasu/bosses'\|from '\./bosses'\|bossName\|bossDesc\|BOSS_ACTUAL_EFFECTS" src/`

呼び出し元(`+page.svelte`・管理画面)は今回のスコープ外(Task 7で最小限のみ対応)だが、管理画面側の呼び出しは型エラーとして残ることを確認しておく(次セッションで対応)。

- [ ] **Step 4: コミット**

```bash
git add src/lib/game/shidasu/bosses.ts src/lib/game/shidasu/bossActualEffects.ts
git commit -m "feat: bosses.ts・bossActualEffects.tsをStarベースに書き換え"
```

---

### Task 7: `+page.svelte`の型エラーを最小限の暫定修正で解消

**Files:**
- Modify: `src/routes/game/shidasu/+page.svelte`

- [ ] **Step 1: `upcomingBossInfo`を`stageStars[waveIndex]`ベースに書き換える**

`+page.svelte`の60〜71行目を、以下に置き換える:

変更前:

```svelte
  // 現在のステージのボス(小凶→中凶→大凶)の情報を返す。ステージ内の3ウェーブは
  // 常に同じボス階級を共有し、ボスウェーブ(3ウェーブ目)でのみ実際に制約が発動する
  // (どちらの表示にするかはstageRow側のisBossWave分岐が担い、ここでは扱わない)。
  let upcomingBossInfo = $derived.by(() => {
    const kind = run.currentBossKind
    if (!kind) return { label: '', detail: '' }
    if (kind === 'suit') {
      const detail = run.currentGreatMisfortuneSuit ? `${run.currentGreatMisfortuneSuit}で無得点` : '対象スート未確定'
      return { label: bossName('suit', params), detail }
    }
    return { label: bossName(kind, params), detail: bossDesc(kind, params) }
  })
```

変更後(暫定: 表示ロジックは維持しつつ、参照元をstageStarsに変更するだけ。UI自体の見直しは別セッション):

```svelte
  // 現在Waveの星(制限ルール)の情報を返す。stageStarsが未確定(title等)の場合は空表示。
  // 表示の見直し(ステージ画面新設に伴うUI再設計)は別セッションで行う。
  let upcomingBossInfo = $derived.by(() => {
    const star = run.stageStars[run.waveIndex]
    if (!star || !star.restriction) return { label: '', detail: '' }
    if (star.restriction.kind === 'suit') {
      return { label: star.name, detail: `${star.restriction.suit}で無得点` }
    }
    return { label: star.name, detail: '' }
  })
```

`bossName`・`bossDesc`のimportがこのファイルにあれば削除する(`grep -n "bossName\|bossDesc" src/routes/game/shidasu/+page.svelte`で確認)。

- [ ] **Step 2: `waveTarget`呼び出しの引数を`stageStars`に変更する**

`+page.svelte`の56行目付近を確認する。

変更前:

```svelte
  let target = $derived(waveTarget(params, run.stageIndex, run.waveIndex, run.spreadId))
```

変更後:

```svelte
  let target = $derived(waveTarget(params, run.stageIndex, run.waveIndex, run.stageStars))
```

- [ ] **Step 3: `continueChoice`画面の`params.bossTiers.taikyou.name`参照を修正**

`+page.svelte`の722行目付近を確認する。

変更前:

```svelte
      <div class="text-yellow-300 text-xs tracking-widest mb-2">{params.bossTiers.taikyou.name} 撃破!</div>
```

変更後(暫定: 固定文言に置き換える。8ステージクリアという新しい終端の呼称・演出は別セッションで検討):

```svelte
      <div class="text-yellow-300 text-xs tracking-widest mb-2">ステージ突破!</div>
```

- [ ] **Step 4: ビルド・型チェックを実行**

Run: `npm run build`
Expected: 成功

Run: `npm run check 2>&1 | grep -i "shidasu"`
Expected: `PlayArea.svelte`・`+page.svelte`(通常プレイ画面)に関する新規エラーが無いことを確認する。ただし管理画面(`admin/shidasu-bosses`・`BossTiersSection.svelte`)は今回のスコープ外のため、そちらのエラーは残っていてよい(Step 5で確認)

- [ ] **Step 5: 管理画面のエラーが残っていることを確認(想定通り)**

Run: `npm run check 2>&1 | grep -i "shidasu-bosses\|BossTiersSection"`
Expected: エラーが出力される(想定通り、次セッションで対応する旨をこのタスクの最後に記録する)

- [ ] **Step 6: コミット**

```bash
git add src/routes/game/shidasu/+page.svelte
git commit -m "fix: +page.svelteの型エラーをstageStarsベースの暫定表示に修正"
```

---

### Task 8: 既存テストを`stageStars`ベースに書き換え

**Files:**
- Modify: `src/lib/game/shidasu/engine.test.ts`

- [ ] **Step 1: `runWith`ヘルパー・`beginRun`関連テストを確認**

`engine.test.ts`の2152〜2320行目付近、および2696〜2816行目付近(`runWith`のデフォルト値・個別テストケース)を全て読み、`currentBossKind`・`currentGreatMisfortuneSuit`を使っている箇所を洗い出す。

Run: `grep -n "currentBossKind\|currentGreatMisfortuneSuit" src/lib/game/shidasu/engine.test.ts`

あわせて、`waveTarget`の呼び出し箇所も洗い出す(シグネチャが`spreadId`引数から`stageStars`引数に変わるため、テスト側の呼び出しも修正が必要):

Run: `grep -n "waveTarget(" src/lib/game/shidasu/engine.test.ts`

`waveTarget(custom, 0, 0, 'fool')`のような`spreadId`文字列を渡している箇所は、`waveTarget(custom, 0, 0, someStageStars)`のように`Star[]`配列を渡す形に書き換える。Task 1で追加した`starWith`相当のヘルパー(Step 4で定義する)や、`beginRun`で生成した`run.stageStars`をテスト内で直接使う。

- [ ] **Step 2: `waveTargetはspreadIdごとに〜`テストを書き換える**

変更前(2139〜2150行目付近):

```ts
  test('waveTargetはspreadIdごとに設定された基礎値・倍率を参照する', () => {
    const custom = {
      ...DEFAULT_PARAMS,
      spreads: {
        fool: { ...DEFAULT_PARAMS.spreads.fool, waveTargetBase: 1000, waveTargetMultiplier: 2 },
        moon: { ...DEFAULT_PARAMS.spreads.moon, waveTargetBase: 3000, waveTargetMultiplier: 1.1 },
      },
    }
    expect(waveTarget(custom, 0, 0, 'fool')).toBe(1000) // 1000 × 2^0
    expect(waveTarget(custom, 0, 1, 'fool')).toBe(2000) // 1000 × 2^1
    expect(waveTarget(custom, 0, 0, 'moon')).toBe(3000) // 3000 × 1.1^0
  })
```

変更後(`spreadId`ではなく`flow.stageTargetBase`/`stageTargetMultiplier`とstageStarsの`targetMultiplier`を参照する形に書き換える):

```ts
  test('waveTargetはflow.stageTargetBase・stageTargetMultiplierとstageStarsの倍率を参照する', () => {
    const custom = {
      ...DEFAULT_PARAMS,
      flow: { ...DEFAULT_PARAMS.flow, stageTargetBase: 1000, stageTargetMultiplier: 2 },
    }
    const stars: Star[] = [
      { id: 's1', name: 'star1', waveSlot: 1, targetMultiplier: 1, reward: 0, restriction: null, sabotage: null },
      { id: 's2', name: 'star2', waveSlot: 2, targetMultiplier: 1.5, reward: 0, restriction: null, sabotage: null },
      { id: 's3', name: 'star3', waveSlot: 3, targetMultiplier: 2, reward: 0, restriction: null, sabotage: null },
    ]
    expect(waveTarget(custom, 0, 0, stars)).toBe(1000) // 1000 × 2^0 × 1
    expect(waveTarget(custom, 0, 1, stars)).toBe(1500) // 1000 × 2^0 × 1.5
    expect(waveTarget(custom, 1, 0, stars)).toBe(2000) // 1000 × 2^1 × 1
  })
```

`Star`型のimportを`engine.test.ts`のimport文に追加する(型定義元は`./types`または既存のimport元を確認)。

- [ ] **Step 3: `beginRunのcurrentBossKindは〜`テストを書き換える**

変更前(2152〜2155行目付近):

```ts
  test('beginRunのcurrentBossKindは、ステージ0(小凶)に属する候補からランダムに選ばれる', () => {
    const run = beginRun(DEFAULT_PARAMS, 1)
    expect(['noLoop', 'faceLock']).toContain(run.currentBossKind)
  })
```

変更後:

```ts
  test('beginRunのstageStarsは、waveSlot 1・2・3それぞれから1件ずつ確定した3要素配列になる', () => {
    const run = beginRun(DEFAULT_PARAMS, 1)
    expect(run.stageStars).toHaveLength(3)
    expect(run.stageStars[0].waveSlot).toBe(1)
    expect(run.stageStars[1].waveSlot).toBe(2)
    expect(run.stageStars[2].waveSlot).toBe(3)
  })
```

- [ ] **Step 4: `大凶ボスWaveクリア時は〜`テストを書き換える**

変更前(2214〜2225行目付近):

```ts
  test('大凶ボスWaveクリア時はcontinueChoiceへ遷移しshopはnullのまま', () => {
    // (既存のテスト本体、stageIndex等の具体値を確認して読むこと)
  })

  test('2周目の大凶(stageIndex5の3ウェーブ目)クリアもcontinueChoiceになる(サイクルが無限に続く)', () => {
    // (既存のテスト本体)
  })
```

このテストは実際のテストコード本体を`engine.test.ts`から読み取り、`stageIndex`の具体値を`DEFAULT_PARAMS.flow.stagesPerRun - 1`(8ステージ目、0始まりで`stageIndex === 7`)に置き換えて書き直す。「2周目」というテストケース自体は、8ステージ制では該当しなくなるため削除する(1回のクリアで終端に達するため周期がない)。修正後のテストは以下のような形になる:

```ts
  test('8ステージ目(最終ステージ)のボスWaveクリア時はcontinueChoiceへ遷移しshopはnullのまま', () => {
    const finalStageIndex = DEFAULT_PARAMS.flow.stagesPerRun - 1
    const run: RunState = {
      ...beginRun(DEFAULT_PARAMS, 1),
      stageIndex: finalStageIndex,
      waveIndex: DEFAULT_PARAMS.flow.wavesPerStage - 1,
      wave: { ...startWave(DEFAULT_PARAMS, finalStageIndex, DEFAULT_PARAMS.flow.wavesPerStage - 1, [], standardDeckComposition(), 1, 0, defaultOracleLevels()).wave, status: 'ended', score: 999999 },
    }
    const result = resolveWaveEnd(DEFAULT_PARAMS, run, () => 0.5, 1)
    expect(result.phase).toBe('continueChoice')
    expect(result.shop).toBeNull()
  })
```

`wave.score`はテスト対象Waveの`waveTarget`を上回る値であれば良い(既存テストの値の付け方を踏襲する。既存の`999999`のような十分大きい固定値、または既存コードでの`waveTarget`計算呼び出しパターンを確認して合わせる)。

- [ ] **Step 5: `stageModifierFor / bossScoreLockFor`テストを書き換える**

変更前(2263〜2303行目付近):

```ts
describe('stageModifierFor / bossScoreLockFor', () => {
  function runWith(overrides: Partial<RunState>): RunState {
    // (既存の実装を確認)
  }

  test('currentBossKindがnoLoopのボスウェーブではnoLoopが返る', () => {
    const run = runWith({ currentBossKind: 'noLoop' })
    expect(stageModifierFor(DEFAULT_PARAMS, run)).toBe('noLoop')
  })
  // ...他5テスト、同様のパターン
})
```

`runWith`ヘルパー自体はそのまま活用しつつ、`overrides`の指定を`stageStars`ベースに書き換える。テストヘルパー用に、以下のようなStarを直接組み立てるヘルパーを`describe`ブロック内に追加する:

```ts
  function starWith(restriction: StarRestriction): Star {
    return { id: 'test-star', name: 'テスト星', waveSlot: 3, targetMultiplier: 1, reward: 0, restriction, sabotage: null }
  }
```

`StarRestriction`・`Star`型のimportを`engine.test.ts`のimport文に追加する(`from './types'`または既存のimport元を確認)。

各テストを以下のように書き換える:

```ts
  test('制限ルールがnoLoopならnoLoopが返る', () => {
    const run = runWith({ stageStars: [starWith(null), starWith(null), starWith({ kind: 'noLoop' })], waveIndex: 2 })
    expect(stageModifierFor(DEFAULT_PARAMS, run)).toBe('noLoop')
  })

  test('制限ルールがfaceLockならfaceLockが返る', () => {
    const run = runWith({ stageStars: [starWith(null), starWith(null), starWith({ kind: 'faceLock' })], waveIndex: 2 })
    expect(stageModifierFor(DEFAULT_PARAMS, run)).toBe('faceLock')
  })

  test('現在Waveの星に制限ルールが無ければnoneが返る', () => {
    const run = runWith({ stageStars: [starWith(null), starWith(null), starWith({ kind: 'noLoop' })], waveIndex: 0 })
    expect(stageModifierFor(DEFAULT_PARAMS, run)).toBe('none')
  })

  test('制限ルールがlowComboならkind:comboのscoreLockが返る', () => {
    const run = runWith({ stageStars: [starWith(null), starWith(null), starWith({ kind: 'lowCombo', maxCombo: 2 })], waveIndex: 2 })
    expect(bossScoreLockFor(DEFAULT_PARAMS, run)).toEqual({ kind: 'combo', maxCombo: 2, tierLabel: 'テスト星' })
  })

  test('制限ルールがoddComboならkind:oddComboのscoreLockが返る', () => {
    const run = runWith({ stageStars: [starWith(null), starWith(null), starWith({ kind: 'oddCombo' })], waveIndex: 2 })
    expect(bossScoreLockFor(DEFAULT_PARAMS, run)).toEqual({ kind: 'oddCombo', tierLabel: 'テスト星' })
  })

  test('制限ルールがsuitならkind:suitのscoreLockが返る', () => {
    const run = runWith({ stageStars: [starWith(null), starWith(null), starWith({ kind: 'suit', suit: '♠' })], waveIndex: 2 })
    expect(bossScoreLockFor(DEFAULT_PARAMS, run)).toEqual({ kind: 'suit', suit: '♠', tierLabel: 'テスト星' })
  })

  test('制限ルールがfaceならkind:faceのscoreLockが返る', () => {
    const run = runWith({ stageStars: [starWith(null), starWith(null), starWith({ kind: 'face' })], waveIndex: 2 })
    expect(bossScoreLockFor(DEFAULT_PARAMS, run)).toEqual({ kind: 'face', tierLabel: 'テスト星' })
  })
```

- [ ] **Step 6: `runWith`のデフォルト値・その他のテストケースを修正**

2696〜2816行目付近の各テストで`currentGreatMisfortuneSuit: null, spreadId: 'fool', currentBossKind: 'noLoop',`という記述パターンが繰り返されている箇所を、`spreadId: 'fool', stageStars: [],`に置き換える(このテストの本来の目的が星のロジック検証ではない場合、空配列で問題ない。テストの意図を確認し、`stageStars`を参照するアサーションがあれば個別に対応する)。

- [ ] **Step 7: テストを実行**

Run: `npx vitest run src/lib/game/shidasu/engine.test.ts`
Expected: 全件PASS

失敗するテストがあれば、エラーメッセージを確認し、期待値・セットアップを修正する。

- [ ] **Step 8: コミット**

```bash
git add src/lib/game/shidasu/engine.test.ts
git commit -m "test: engine.test.tsをstageStarsベースに書き換え"
```

---

### Task 9: 全体のビルド・型チェック・テスト確認

**Files:** なし(確認のみ)

- [ ] **Step 1: ビルド・型チェック・全テストを実行**

Run: `npm run build`
Expected: 成功

Run: `npm run check 2>&1 | grep -i "shidasu"`
Expected: `PlayArea.svelte`・`+page.svelte`(通常プレイ画面)にエラーが無いこと。管理画面(`admin/shidasu-bosses`・`BossTiersSection.svelte`)のエラーは残っていてよい(次セッションで対応)

Run: `npx vitest run src/lib/game/shidasu`
Expected: 全件PASS

- [ ] **Step 2: 残存する型エラーの一覧を記録する**

Run: `npm run check 2>&1 | grep -i "shidasu-bosses\|BossTiersSection\|JsonPanel"`

出力された内容を、次のタスクへの申し送りとして`docs/superpowers/specs/2026-07-28-shidasu-run-structure-redesign-design.md`の末尾に追記する(具体的なエラー内容と該当ファイル名)。

- [ ] **Step 3: specに申し送り事項を追記してコミット**

`docs/superpowers/specs/2026-07-28-shidasu-run-structure-redesign-design.md`の末尾に、以下のセクションを追加する:

```markdown
## 実装セッションからの申し送り(データモデル層完了時点)

`types.ts`・`params.ts`・`engine.ts`・`engine.test.ts`の変更が完了した。以下は次セッションで対応が必要:

1. **管理画面**: `src/routes/admin/shidasu-bosses/+page.svelte`・`src/routes/admin/shidasu/BossTiersSection.svelte`が旧`BossKind`/`bossTiers`/`bosses`を参照しており型エラーが残っている。`Star`一覧を編集できる新しいUIへの置き換えが必要。
2. **ステージ画面の新設**: `+page.svelte`のWave進行フロー(ショップ→ステージ画面→次Wave)は未実装。現状は`enterShop`が確定させた`stageStars`を使って即座に次Waveへ進む形のまま。
3. **Waveスキップ・リロールのUI**: 未実装。`engine.ts`側にもスキップ・リロールを行う関数はまだ存在しない(Star抽選ロジックのみ実装済み)。
4. **8ステージクリア後の`continueChoice`画面の文言・演出**: 暫定的に「ステージ突破!」という固定文言にしている。適切な演出は別途検討。
5. **`bosses.ts`・`params.ts`内の非推奨フィールド(`bossTiers`・`bosses`)の削除**: 管理画面の置き換えが完了してから、`types.ts`の`BossKind`・`BossTierKey`型とあわせて削除する。
```

```bash
git add docs/superpowers/specs/2026-07-28-shidasu-run-structure-redesign-design.md
git commit -m "docs: データモデル層実装完了と次セッションへの申し送りを追記"
```
