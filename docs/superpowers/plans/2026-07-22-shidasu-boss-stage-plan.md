# Shidasu ステージ構成(ボスウェーブ)導入 Phase1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `docs/superpowers/specs/2026-07-22-shidasu-boss-stage-design.md`に基づき、既存の3ステージ×3ウェーブ構造を「無限に続く小凶・中凶・大凶ボスサイクル」に置き換え、ボスウェーブ固有の得点制約(中凶=低コンボ無得点、大凶=特定スート無得点)・目標スコアの指数関数化・大凶クリア後の続行選択を実装する。

**Architecture:** `RunState.stageIndex`を無制限に増加させ`stageIndex % 3`でボス階級を決定する。既存の`StageModifier`(isPlayable用、取得可否を左右する)とは別に、新しい`BossScoreLock`(得点だけを0にする、取得自体は妨げない)という概念を`playCard`/`drawStock`に追加する。固定`stages`配列を廃止し、目標スコアは指数関数の算出式に、ボス制約は`stageIndex % 3`から導出するヘルパー関数に置き換える。既存の`stageClear`フェーズは廃止して通常のアイテム選択フローに統合し、大凶クリア時のみ新設の`continueChoice`フェーズを経由する。

**Tech Stack:** TypeScript, Svelte 5, Vitest

---

### Task 1: 型定義・パラメータ構造の変更

**Files:**
- Modify: `src/lib/game/shidasu/types.ts`
- Modify: `src/lib/game/shidasu/params.ts`
- Modify: `src/lib/game/shidasu/shidasu.config.json`
- Test: `src/lib/game/shidasu/engine.test.ts`(型追従のみ)

- [ ] **Step 1: `RunPhase`を変更する**

`src/lib/game/shidasu/types.ts`の182行目、現在の内容:

```ts
export type RunPhase = 'title' | 'playing' | 'itemSelect' | 'revelationSelect' | 'oracleSelect' | 'stageClear' | 'allClear' | 'gameOver'
```

を以下に置き換える(`'stageClear'`を`'continueChoice'`に差し替える):

```ts
export type RunPhase = 'title' | 'playing' | 'itemSelect' | 'revelationSelect' | 'oracleSelect' | 'continueChoice' | 'allClear' | 'gameOver'
```

- [ ] **Step 2: `RunState`に大凶の対象スートを保持するフィールドを追加する**

`RunState`インターフェースの末尾(`oracleOffer: RoleName[]`の直後、206行目付近)に追加:

```ts
  // 大凶ステージ(stageIndex % 3 === 2)の対象スート。中凶クリア直後(大凶ステージの1ウェーブ目を
  // 配る時点)にrandで抽選して確定し、そのステージが終わるまで(1〜3ウェーブ目)固定で使い回す。
  // 小凶・中凶ステージの間は常にnull
  currentGreatMisfortuneSuit: Suit | null
```

- [ ] **Step 3: `params.ts`から`stages`配列を削除し、`scoring`にボス目標スコア用フィールド、新規`bossTiers`セクションを追加する**

`ShidasuParams`インターフェースの`scoring: {...}`ブロック(10-26行目、現在の内容):

```ts
  scoring: {
    basePoint: number
    suitBonus: number
    colorBonus: number
    suitColorMinLen: number
    stairBonus: number
    stairMinLen: number
    clearBonus: number
    clearBonusPerStock: number
    comboMultiplierStep: number
    flushBonus: number
    royalSetBonus: number
    sameRankBonusUnit: number
    completeRunBonus: number
    completeRunSuitBonus: number
    columnSweepBonus: number
  }
  stages: Array<{
    name: string
    modifier: StageModifier
    targets: [number, number, number]
  }>
```

を以下に置き換える(`stages`ブロックを削除し、`scoring`に2フィールド追加、新規`bossTiers`を追加):

```ts
  scoring: {
    basePoint: number
    suitBonus: number
    colorBonus: number
    suitColorMinLen: number
    stairBonus: number
    stairMinLen: number
    clearBonus: number
    clearBonusPerStock: number
    comboMultiplierStep: number
    flushBonus: number
    royalSetBonus: number
    sameRankBonusUnit: number
    completeRunBonus: number
    completeRunSuitBonus: number
    columnSweepBonus: number
    // 目標スコア算出式 target(n) = waveTargetBase × waveTargetMultiplier^(n-1) の基礎値・倍率
    // (nはラン開始からの通しウェーブ番号、1始まり)
    waveTargetBase: number
    waveTargetMultiplier: number
  }
  // ボス階級ごとの設定。stageIndex % 3 (0=小凶,1=中凶,2=大凶)でインデックスする代わりに、
  // 読みやすさのため名前付きキーで持つ(shoukyou=小凶,chuukyou=中凶,taikyou=大凶)
  bossTiers: {
    shoukyou: { name: string }
    chuukyou: { name: string; maxCombo: number }
    taikyou: { name: string }
  }
```

`ShidasuParams`インターフェースからは`StageModifier`型自体を削除しない(`isPlayable`等が引き続き使用するため、小凶の制約=`noLoop`として活用する)。ただし`import type { StageModifier, Rarity } from './types'`の`StageModifier`は`stages`配列の型注釈が無くなるため、実際に使われなくなる可能性がある。`params.ts`内で他に`StageModifier`を使う箇所が無ければimportから削除する(Step実施時に`npm run check`で確認する)。

- [ ] **Step 4: `DEFAULT_PARAMS`から`stages`を削除し、`scoring`・`bossTiers`のデータを追加する**

`DEFAULT_PARAMS.scoring`ブロック(現在の内容、末尾に`columnSweepBonus: 150,`がある)の直後に2フィールドを追加し、その後の`stages: [...]`ブロックを削除して`bossTiers`に置き換える。現在の内容:

```ts
  scoring: {
    basePoint: 100,
    suitBonus: 100,
    colorBonus: 50,
    suitColorMinLen: 3,
    stairBonus: 150,
    stairMinLen: 5,
    clearBonus: 2000,
    clearBonusPerStock: 50,
    comboMultiplierStep: 0.1,
    flushBonus: 300,
    royalSetBonus: 400,
    sameRankBonusUnit: 100,
    completeRunBonus: 1000,
    completeRunSuitBonus: 1000,
    columnSweepBonus: 150,
  },
  stages: [
    { name: 'STAGE 1', modifier: 'none', targets: [4000, 7500, 13000] },
    { name: 'STAGE 2', modifier: 'noLoop', targets: [6000, 11000, 19000] },
    { name: 'STAGE 3', modifier: 'faceLock', targets: [8000, 15000, 26000] },
  ],
```

を以下に置き換える:

```ts
  scoring: {
    basePoint: 100,
    suitBonus: 100,
    colorBonus: 50,
    suitColorMinLen: 3,
    stairBonus: 150,
    stairMinLen: 5,
    clearBonus: 2000,
    clearBonusPerStock: 50,
    comboMultiplierStep: 0.1,
    flushBonus: 300,
    royalSetBonus: 400,
    sameRankBonusUnit: 100,
    completeRunBonus: 1000,
    completeRunSuitBonus: 1000,
    columnSweepBonus: 150,
    waveTargetBase: 2000,
    waveTargetMultiplier: 1.5,
  },
  bossTiers: {
    shoukyou: { name: '小凶' },
    chuukyou: { name: '中凶', maxCombo: 2 },
    taikyou: { name: '大凶' },
  },
```

- [ ] **Step 5: `shidasu.config.json`を`params.ts`と同期する**

`src/lib/game/shidasu/shidasu.config.json`の`"scoring"`セクション末尾(`"columnSweepBonus": 150`の直後)に2フィールドを追加し、既存の`"stages"`セクション(23-45行目付近、`[{...},{...},{...}]`の3要素配列)を削除して、代わりに`"bossTiers"`セクションを追加する:

```json
    "columnSweepBonus": 150,
    "waveTargetBase": 2000,
    "waveTargetMultiplier": 1.5
  },
  "bossTiers": {
    "shoukyou": { "name": "小凶" },
    "chuukyou": { "name": "中凶", "maxCombo": 2 },
    "taikyou": { "name": "大凶" }
  },
```

(既存の`"scoring"`ブロックの閉じ`}`の直後に`"stages"`が続いていた構造を、上記のように`"scoring"`の閉じ`},`の直後に`"bossTiers"`が続く形に差し替える。既存の`"stages"`セクション全体は削除する)

- [ ] **Step 6: 既存の`RunState`リテラル(6箇所)に`currentGreatMisfortuneSuit`を追加する**

`src/lib/game/shidasu/engine.test.ts`内、`describe('applyStuckCheck', ...)`ブロック内の以下の完全な文字列(6箇所、全て同一):

```ts
      oracleLevels: defaultOracleLevels(), oracleOffer: [],
```

を`replace_all`で以下に一括置換する:

```ts
      oracleLevels: defaultOracleLevels(), oracleOffer: [], currentGreatMisfortuneSuit: null,
```

- [ ] **Step 7: 型チェックを実行し、想定内のエラーのみであることを確認する**

Run: `npm run check`

Expected: 以下のエラーは想定内であり許容する(Task 2〜3で解消する):
- `engine.ts`内で`params.stages`を参照している箇所(`resolveWaveEnd`・`applyPlayCard`・`applyDrawStock`・`applyStuckCheck`)のエラー
- `engine.ts`の`createInitialRun`・`beginRun`が返す`RunState`リテラルに`currentGreatMisfortuneSuit`が無いことによるエラー
- `engine.ts`の`advanceStage`関数内のエラー
- `src/routes/game/shidasu/+page.svelte`・`src/routes/admin/shidasu/StagesSection.svelte`・`src/routes/admin/shidasu/+page.svelte`関連のエラー(Task 4〜5で解消する)

それ以外(`types.ts`・`params.ts`・`shidasu.config.json`・`engine.test.ts`の6箇所修正関連)にエラーが無いことを確認する。

- [ ] **Step 8: コミット**

```bash
git add src/lib/game/shidasu/types.ts src/lib/game/shidasu/params.ts src/lib/game/shidasu/shidasu.config.json src/lib/game/shidasu/engine.test.ts
git commit -m "feat: ボス階級・目標スコア算出式の型定義とパラメータを追加"
```

---

### Task 2: 得点ロック機構(`BossScoreLock`)を`playCard`・`drawStock`に追加する

**Files:**
- Modify: `src/lib/game/shidasu/engine.ts`
- Test: `src/lib/game/shidasu/engine.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/game/shidasu/engine.test.ts`の`describe('playCard', ...)`ブロック内(末尾、`同じコンボ内で2列目を空にすると列一掃ボーナスが列数倍になる`テストなどの近く)に以下の`describe`ブロックを追加する:

```ts
describe('playCard: BossScoreLock(ボス制約による得点0)', () => {
  test('scoreLockがkind:comboで、effectiveComboがmaxCombo以下なら獲得点が0になる', () => {
    const wave = baseWave({
      foundation: card(0, '♠', 5),
      tableau: [[card(1, '♣', 6)]],
      combo: 1, // このプレイでnewCombo=2、baseComboCount=0によりeffectiveCombo=2
    })
    const { wave: next } = playCard(DEFAULT_PARAMS, wave, 'none', [], 1000000, 0, standardDeckComposition(), Math.random, { kind: 'combo', maxCombo: 2 })
    expect(next.score).toBe(wave.score)
    expect(next.lastGain?.points).toBe(0)
  })

  test('scoreLockがkind:comboで、effectiveComboがmaxComboを超えるなら通常通り得点する', () => {
    const wave = baseWave({
      foundation: card(0, '♠', 5),
      tableau: [[card(1, '♣', 6)]],
      combo: 2, // このプレイでnewCombo=3、effectiveCombo=3 > maxCombo(2)
    })
    const { wave: next } = playCard(DEFAULT_PARAMS, wave, 'none', [], 1000000, 0, standardDeckComposition(), Math.random, { kind: 'combo', maxCombo: 2 })
    expect(next.lastGain?.points).toBeGreaterThan(0)
  })

  test('scoreLockがkind:suitで、対象スートのカードを取ると獲得点が0になる', () => {
    const wave = baseWave({
      foundation: card(0, '♠', 5),
      tableau: [[card(1, '♠', 6)]],
    })
    const { wave: next } = playCard(DEFAULT_PARAMS, wave, 'none', [], 1000000, 0, standardDeckComposition(), Math.random, { kind: 'suit', suit: '♠' })
    expect(next.score).toBe(wave.score)
    expect(next.lastGain?.points).toBe(0)
  })

  test('scoreLockがkind:suitで、対象外のスートのカードを取ると通常通り得点する', () => {
    const wave = baseWave({
      foundation: card(0, '♠', 5),
      tableau: [[card(1, '♥', 6)]],
    })
    const { wave: next } = playCard(DEFAULT_PARAMS, wave, 'none', [], 1000000, 0, standardDeckComposition(), Math.random, { kind: 'suit', suit: '♠' })
    expect(next.lastGain?.points).toBeGreaterThan(0)
  })

  test('scoreLockがkind:suitで、ワイルドを取ると対象スートと一致していても通常通り得点する', () => {
    const wave = baseWave({
      foundation: card(0, '♠', 5),
      tableau: [[card(1, '★', 0, true)]],
    })
    const { wave: next } = playCard(DEFAULT_PARAMS, wave, 'none', [], 1000000, 0, standardDeckComposition(), Math.random, { kind: 'suit', suit: '♠' })
    expect(next.lastGain?.points).toBeGreaterThan(0)
  })

  test('scoreLockを省略(未指定)すると通常通り得点する(既存の呼び出し箇所は無変更のまま動作する)', () => {
    const wave = baseWave({
      foundation: card(0, '♠', 5),
      tableau: [[card(1, '♣', 6)]],
    })
    const { wave: next } = playCard(DEFAULT_PARAMS, wave, 'none', [], 1000000, 0, standardDeckComposition())
    expect(next.lastGain?.points).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 2: テストを実行し失敗を確認する**

Run: `npm run test -- engine`
Expected: FAIL(`playCard`が8番目の引数`scoreLock`を受け取らず、常に通常の得点計算になるため、`kind:combo`/`kind:suit`のテストが失敗する)

- [ ] **Step 3: `BossScoreLock`型を定義し、`playCard`に組み込む**

`src/lib/game/shidasu/engine.ts`の`playCard`関数シグネチャの直前(現在の内容、278行目付近)に型定義を追加:

```ts
// 中凶・大凶ボスウェーブによる得点ロック。isPlayable(取得可否)には一切影響せず、
// 獲得点(基礎点・チェーンボーナス・列一掃ボーナス等を含めた総額)だけを0にする。
// 既存のStageModifier(取得を禁止する型)とは別の仕組みとして扱う。
export type BossScoreLock = { kind: 'combo'; maxCombo: number } | { kind: 'suit'; suit: Suit } | null

export function playCard(
```

`playCard`関数シグネチャ(現在の内容):

```ts
export function playCard(
  params: ShidasuParams,
  wave: WaveState,
  modifier: StageModifier,
  items: ItemId[],
  target: number,
  colIndex: number,
  deckComposition: DeckCard[],
  rand: () => number = Math.random
): { wave: WaveState; deckComposition: DeckCard[] } {
```

を以下に置き換える(**末尾に新しい省略可能引数を追加する。既存の呼び出し箇所・テストは無変更のまま動作し続ける**):

```ts
export function playCard(
  params: ShidasuParams,
  wave: WaveState,
  modifier: StageModifier,
  items: ItemId[],
  target: number,
  colIndex: number,
  deckComposition: DeckCard[],
  rand: () => number = Math.random,
  scoreLock: BossScoreLock = null
): { wave: WaveState; deckComposition: DeckCard[] } {
```

`playCard`関数内、`let gained = Math.floor(itemResult.value * multiplier * mannazFactor)`の行(現在の内容、448行目付近):

```ts
  let gained = Math.floor(itemResult.value * multiplier * mannazFactor)

  const scoreAfterGained = wave.score + gained
```

を以下に置き換える:

```ts
  let gained = Math.floor(itemResult.value * multiplier * mannazFactor)
  if (scoreLock) {
    const locked = scoreLock.kind === 'combo' ? effectiveCombo <= scoreLock.maxCombo : (!card.wild && card.suit === scoreLock.suit)
    if (locked) {
      parts.push(scoreLock.kind === 'combo' ? '中凶: 獲得点0' : '大凶: 獲得点0')
      gained = 0
    }
  }

  const scoreAfterGained = wave.score + gained
```

- [ ] **Step 4: `drawStock`の素朴(誠実)分岐にも同じ`scoreLock`を組み込む**

`drawStock`関数シグネチャ(現在の内容、589-597行目付近):

```ts
export function drawStock(
  params: ShidasuParams,
  wave: WaveState,
  items: ItemId[],
  target: number,
  deckComposition: DeckCard[],
  modifier: StageModifier = 'none',
  rand: () => number = Math.random
): { wave: WaveState; deckComposition: DeckCard[] } {
```

を以下に置き換える:

```ts
export function drawStock(
  params: ShidasuParams,
  wave: WaveState,
  items: ItemId[],
  target: number,
  deckComposition: DeckCard[],
  modifier: StageModifier = 'none',
  rand: () => number = Math.random,
  scoreLock: BossScoreLock = null
): { wave: WaveState; deckComposition: DeckCard[] } {
```

`drawStock`関数内、`naiveGained = Math.floor(itemResult.value * multiplier * mannazFactor)`の行(現在の内容):

```ts
      naiveGained = Math.floor(itemResult.value * multiplier * mannazFactor)
      naiveParts = parts
      naiveCombo = newCombo
    }
```

を以下に置き換える:

```ts
      naiveGained = Math.floor(itemResult.value * multiplier * mannazFactor)
      if (scoreLock) {
        const locked = scoreLock.kind === 'combo' ? effectiveCombo <= scoreLock.maxCombo : (!drawnCard.wild && drawnCard.suit === scoreLock.suit)
        if (locked) {
          parts.push(scoreLock.kind === 'combo' ? '中凶: 獲得点0' : '大凶: 獲得点0')
          naiveGained = 0
        }
      }
      naiveParts = parts
      naiveCombo = newCombo
    }
```

- [ ] **Step 5: テストを実行し成功を確認する**

Run: `npm run test -- engine`
Expected: PASS(`BossScoreLock`関連の6件のテストが通る)

- [ ] **Step 6: 型チェック・全体テストを実行する**

Run: `npm run check`
Run: `npm run test`
Expected: Task 1と同様、`engine.ts`のフェーズ遷移周り・UI・管理画面のエラーは許容する(Task 3〜5で解消)。それ以外に新規エラーが無いこと。全体テストは既存分がすべてPASSすること。

- [ ] **Step 7: コミット**

```bash
git add src/lib/game/shidasu/engine.ts src/lib/game/shidasu/engine.test.ts
git commit -m "feat: playCard・drawStockにボス制約による得点ロック(BossScoreLock)を追加"
```

---

### Task 3: フェーズ遷移の書き換え(ボスサイクル・continueChoice・目標スコア算出式)

**Files:**
- Modify: `src/lib/game/shidasu/engine.ts`
- Test: `src/lib/game/shidasu/engine.test.ts`

- [ ] **Step 1: ボス階級・目標スコアのヘルパー関数を追加する**

`src/lib/game/shidasu/engine.ts`の`export function isStuck(...)`の直前(818行目付近)に追加:

```ts
// 各ステージの最終ウェーブ(ボスウェーブ)かどうかを返す。
export function isBossWave(params: ShidasuParams, waveIndex: number): boolean {
  return waveIndex === params.flow.wavesPerStage - 1
}

// stageIndexから、そのステージのボス階級を返す(0=小凶,1=中凶,2=大凶)。stageIndexは
// 無制限に増加するため、3で割った余りで階級を決定する(3ステージごとに小凶→中凶→大凶を繰り返す)。
export function bossTierOf(stageIndex: number): 0 | 1 | 2 {
  return (stageIndex % 3) as 0 | 1 | 2
}

// そのウェーブで適用されるisPlayable用の修飾子を返す(小凶ボスウェーブ=noLoop、それ以外=none)。
// 中凶・大凶の制約はisPlayableの可否には影響しないため、ここでは扱わない(bossScoreLockForを使う)。
export function stageModifierFor(params: ShidasuParams, run: RunState): StageModifier {
  if (isBossWave(params, run.waveIndex) && bossTierOf(run.stageIndex) === 0) return 'noLoop'
  return 'none'
}

// そのウェーブで適用される得点ロックを返す(中凶=nコンボ以下無得点、大凶=対象スート無得点)。
// 大凶で対象スートが未確定(currentGreatMisfortuneSuitがnull)の場合はロック無しとして扱う
// (実際には大凶ステージ突入時に必ず確定させるため、通常はnullにならない)。
export function bossScoreLockFor(params: ShidasuParams, run: RunState): BossScoreLock {
  if (!isBossWave(params, run.waveIndex)) return null
  const tier = bossTierOf(run.stageIndex)
  if (tier === 1) return { kind: 'combo', maxCombo: params.bossTiers.chuukyou.maxCombo }
  if (tier === 2 && run.currentGreatMisfortuneSuit) return { kind: 'suit', suit: run.currentGreatMisfortuneSuit }
  return null
}

// ラン開始からの通しウェーブ番号(1始まり)から目標スコアを算出する。
// target(n) = waveTargetBase × waveTargetMultiplier^(n-1)
export function waveTarget(params: ShidasuParams, stageIndex: number, waveIndex: number): number {
  const overallWaveNumber = stageIndex * params.flow.wavesPerStage + waveIndex + 1
  return Math.floor(params.scoring.waveTargetBase * params.scoring.waveTargetMultiplier ** (overallWaveNumber - 1))
}

const GREAT_MISFORTUNE_SUITS: Suit[] = ['♠', '♥', '♦', '♣']

// 大凶ステージの対象スートを、既存のrand(シード連動PRNG)を使って抽選する。
// 将来「ラン開始時にシードを指定してステージ構成を再現する」機能に対応できるよう、
// Math.random()を直接使わずこの関数経由で必ずrandを通すこと。
function rollGreatMisfortuneSuit(rand: () => number): Suit {
  return GREAT_MISFORTUNE_SUITS[Math.floor(rand() * GREAT_MISFORTUNE_SUITS.length)]
}

// 現在のstageIndexから次のウェーブの(stageIndex, waveIndex)を算出する。
// waveIndexがwavesPerStageに達したら次のステージ(stageIndex+1・waveIndex0)へ繰り上がる。
function nextWaveLocation(params: ShidasuParams, run: RunState): { stageIndex: number; waveIndex: number } {
  const nextWaveIndex = run.waveIndex + 1
  if (nextWaveIndex >= params.flow.wavesPerStage) {
    return { stageIndex: run.stageIndex + 1, waveIndex: 0 }
  }
  return { stageIndex: run.stageIndex, waveIndex: nextWaveIndex }
}

// 次のウェーブ位置に応じたcurrentGreatMisfortuneSuitを算出する。同じステージ内に留まる場合は
// 現在の値を維持し、新しいステージに入る場合は小凶・中凶ならnullに、大凶ならrandで新規抽選する。
function nextGreatMisfortuneSuit(
  run: RunState,
  newLocation: { stageIndex: number; waveIndex: number },
  rand: () => number
): Suit | null {
  if (newLocation.stageIndex === run.stageIndex) return run.currentGreatMisfortuneSuit
  return bossTierOf(newLocation.stageIndex) === 2 ? rollGreatMisfortuneSuit(rand) : null
}
```

- [ ] **Step 2: `resolveWaveEnd`を書き換える**

`resolveWaveEnd`関数(現在の内容、862-878行目付近):

```ts
export function resolveWaveEnd(params: ShidasuParams, run: RunState, rand: () => number = Math.random): RunState {
  const wave = run.wave
  if (!wave || wave.status !== 'ended') return run

  const target = params.stages[run.stageIndex].targets[run.waveIndex]
  if (wave.score < target) {
    return { ...run, phase: 'gameOver' }
  }

  const isLastWave = run.waveIndex === params.flow.wavesPerStage - 1
  const isLastStage = run.stageIndex === params.stages.length - 1

  if (isLastWave) {
    return { ...run, phase: isLastStage ? 'allClear' : 'stageClear' }
  }
  return { ...run, phase: 'itemSelect', offer: rollItemOffer(run.items, rand), pendingNewItem: null }
}
```

を以下に置き換える:

```ts
export function resolveWaveEnd(params: ShidasuParams, run: RunState, rand: () => number = Math.random): RunState {
  const wave = run.wave
  if (!wave || wave.status !== 'ended') return run

  const target = waveTarget(params, run.stageIndex, run.waveIndex)
  if (wave.score < target) {
    return { ...run, phase: 'gameOver' }
  }

  // 大凶(各サイクルの最終ウェーブ)クリア時のみ、護符等の選択を後回しにして続行確認を挟む。
  // それ以外(小凶・中凶のボスウェーブを含む通常のウェーブクリア)は、すべて同じitemSelectへ進む。
  if (isBossWave(params, run.waveIndex) && bossTierOf(run.stageIndex) === 2) {
    return { ...run, phase: 'continueChoice' }
  }
  return { ...run, phase: 'itemSelect', offer: rollItemOffer(run.items, rand), pendingNewItem: null }
}
```

- [ ] **Step 3: `enterRevelationSelect`を書き換え、ステージ繰り上がり・大凶スート抽選に対応する**

`enterRevelationSelect`関数(現在の内容、896-918行目付近):

```ts
function enterRevelationSelect(
  params: ShidasuParams,
  run: RunState,
  newItems: ItemId[],
  newRites: RiteId[],
  newWaveIndex: number,
  seed: number | undefined,
  rand: () => number
): RunState {
  const { wave, deckComposition } = startWave(params, run.stageIndex, newWaveIndex, newItems, run.deckComposition, seed, run.extraTableauRows, run.oracleLevels)
  return {
    ...run,
    phase: 'revelationSelect',
    items: newItems,
    rites: newRites,
    waveIndex: newWaveIndex,
    offer: [],
    pendingNewItem: null,
    wave,
    deckComposition,
    revelationOffer: rollRevelationOffer(rand),
  }
}
```

を以下に置き換える(**`newWaveIndex`引数を廃止し、`nextWaveLocation`で内部的にステージ繰り上がりを算出するよう変更する**):

```ts
function enterRevelationSelect(
  params: ShidasuParams,
  run: RunState,
  newItems: ItemId[],
  newRites: RiteId[],
  seed: number | undefined,
  rand: () => number
): RunState {
  const newLocation = nextWaveLocation(params, run)
  const newGreatMisfortuneSuit = nextGreatMisfortuneSuit(run, newLocation, rand)
  const { wave, deckComposition } = startWave(params, newLocation.stageIndex, newLocation.waveIndex, newItems, run.deckComposition, seed, run.extraTableauRows, run.oracleLevels)
  return {
    ...run,
    phase: 'revelationSelect',
    items: newItems,
    rites: newRites,
    stageIndex: newLocation.stageIndex,
    waveIndex: newLocation.waveIndex,
    currentGreatMisfortuneSuit: newGreatMisfortuneSuit,
    offer: [],
    pendingNewItem: null,
    wave,
    deckComposition,
    revelationOffer: rollRevelationOffer(rand),
  }
}
```

- [ ] **Step 4: `pickItem`・`confirmItemSwap`・`skipItemSelect`を`enterRevelationSelect`の新シグネチャに合わせる**

`pickItem`関数(現在の内容、934-943行目付近):

```ts
export function pickItem(params: ShidasuParams, run: RunState, itemId: ItemId, seed?: number, rand: () => number = Math.random): RunState {
  if (run.phase !== 'itemSelect') return run
  if (run.items.length >= params.items.maxItems) {
    return { ...run, pendingNewItem: itemId }
  }
  const newItems = [...run.items, itemId]
  const rolledRite = rollRite(run.rites, rand)
  const newRites = rolledRite ? [...run.rites, rolledRite] : run.rites
  return enterRevelationSelect(params, run, newItems, newRites, run.waveIndex + 1, seed, rand)
}
```

を以下に置き換える:

```ts
export function pickItem(params: ShidasuParams, run: RunState, itemId: ItemId, seed?: number, rand: () => number = Math.random): RunState {
  if (run.phase !== 'itemSelect') return run
  if (run.items.length >= params.items.maxItems) {
    return { ...run, pendingNewItem: itemId }
  }
  const newItems = [...run.items, itemId]
  const rolledRite = rollRite(run.rites, rand)
  const newRites = rolledRite ? [...run.rites, rolledRite] : run.rites
  return enterRevelationSelect(params, run, newItems, newRites, seed, rand)
}
```

`confirmItemSwap`関数(現在の内容、945-953行目付近):

```ts
export function confirmItemSwap(params: ShidasuParams, run: RunState, oldItemId: ItemId, seed?: number, rand: () => number = Math.random): RunState {
  if (run.phase !== 'itemSelect' || run.pendingNewItem === null) return run
  const idx = run.items.indexOf(oldItemId)
  const remaining = idx === -1 ? [...run.items] : [...run.items.slice(0, idx), ...run.items.slice(idx + 1)]
  const newItems = [...remaining, run.pendingNewItem]
  const rolledRite = rollRite(run.rites, rand)
  const newRites = rolledRite ? [...run.rites, rolledRite] : run.rites
  return enterRevelationSelect(params, run, newItems, newRites, run.waveIndex + 1, seed, rand)
}
```

を以下に置き換える:

```ts
export function confirmItemSwap(params: ShidasuParams, run: RunState, oldItemId: ItemId, seed?: number, rand: () => number = Math.random): RunState {
  if (run.phase !== 'itemSelect' || run.pendingNewItem === null) return run
  const idx = run.items.indexOf(oldItemId)
  const remaining = idx === -1 ? [...run.items] : [...run.items.slice(0, idx), ...run.items.slice(idx + 1)]
  const newItems = [...remaining, run.pendingNewItem]
  const rolledRite = rollRite(run.rites, rand)
  const newRites = rolledRite ? [...run.rites, rolledRite] : run.rites
  return enterRevelationSelect(params, run, newItems, newRites, seed, rand)
}
```

`skipItemSelect`関数(現在の内容、960-963行目付近):

```ts
export function skipItemSelect(params: ShidasuParams, run: RunState, seed?: number, rand: () => number = Math.random): RunState {
  if (run.phase !== 'itemSelect') return run
  return enterRevelationSelect(params, run, run.items, run.rites, run.waveIndex + 1, seed, rand)
}
```

を以下に置き換える:

```ts
export function skipItemSelect(params: ShidasuParams, run: RunState, seed?: number, rand: () => number = Math.random): RunState {
  if (run.phase !== 'itemSelect') return run
  return enterRevelationSelect(params, run, run.items, run.rites, seed, rand)
}
```

- [ ] **Step 5: `advanceStage`を削除し、`continueAfterGreatMisfortune`・`stopAfterGreatMisfortune`を追加する**

`advanceStage`関数(現在の内容、1041-1053行目付近)を削除する:

```ts
export function advanceStage(params: ShidasuParams, run: RunState, seed?: number): RunState {
  if (run.phase !== 'stageClear') return run
  const newStageIndex = run.stageIndex + 1
  const { wave, deckComposition } = startWave(params, newStageIndex, 0, run.items, run.deckComposition, seed, run.extraTableauRows, run.oracleLevels)
  return {
    ...run,
    phase: 'playing',
    stageIndex: newStageIndex,
    waveIndex: 0,
    wave,
    deckComposition,
  }
}
```

この関数全体を削除し、代わりに以下を追加する(削除した箇所と同じ位置でよい):

```ts
// 大凶クリア後の続行確認画面('continueChoice'フェーズ)で「続ける」を選んだ場合。
// 通常のウェーブクリアと同じくitemSelectへ進む(以後のステージ繰り上がり・大凶スート抽選は
// pickItem等が呼ぶenterRevelationSelectが担う)。所持中の護符・秘儀・天啓・神託レベルは
// このrunをそのまま引き継ぐため、リセットされない。
export function continueAfterGreatMisfortune(params: ShidasuParams, run: RunState, rand: () => number = Math.random): RunState {
  if (run.phase !== 'continueChoice') return run
  return { ...run, phase: 'itemSelect', offer: rollItemOffer(run.items, rand), pendingNewItem: null }
}

// 大凶クリア後の続行確認画面で「やめる」を選んだ場合。結果画面(allClear)へ遷移する。
export function stopAfterGreatMisfortune(run: RunState): RunState {
  if (run.phase !== 'continueChoice') return run
  return { ...run, phase: 'allClear' }
}
```

- [ ] **Step 6: `createInitialRun`・`beginRun`に`currentGreatMisfortuneSuit`を追加する**

`createInitialRun`関数(現在の内容):

```ts
export function createInitialRun(): RunState {
  return {
    phase: 'title', stageIndex: 0, waveIndex: 0, items: [], offer: [], wave: null, pendingNewItem: null,
    deckComposition: standardDeckComposition(), rites: [], revelations: [], revelationOffer: [], extraTableauRows: 0,
    oracleLevels: defaultOracleLevels(), oracleOffer: [],
  }
}
```

を以下に置き換える:

```ts
export function createInitialRun(): RunState {
  return {
    phase: 'title', stageIndex: 0, waveIndex: 0, items: [], offer: [], wave: null, pendingNewItem: null,
    deckComposition: standardDeckComposition(), rites: [], revelations: [], revelationOffer: [], extraTableauRows: 0,
    oracleLevels: defaultOracleLevels(), oracleOffer: [], currentGreatMisfortuneSuit: null,
  }
}
```

`beginRun`関数(現在の内容):

```ts
export function beginRun(params: ShidasuParams, seed?: number): RunState {
  const { wave, deckComposition } = startWave(params, 0, 0, [], standardDeckComposition(), seed, 0, defaultOracleLevels())
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
    extraTableauRows: 0,
    oracleLevels: defaultOracleLevels(),
    oracleOffer: [],
  }
}
```

を以下に置き換える:

```ts
export function beginRun(params: ShidasuParams, seed?: number): RunState {
  const { wave, deckComposition } = startWave(params, 0, 0, [], standardDeckComposition(), seed, 0, defaultOracleLevels())
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
    extraTableauRows: 0,
    oracleLevels: defaultOracleLevels(),
    oracleOffer: [],
    currentGreatMisfortuneSuit: null,
  }
}
```

- [ ] **Step 7: `applyPlayCard`・`applyDrawStock`・`applyStuckCheck`を新しいヘルパー・目標スコア式に合わせる**

`applyPlayCard`関数(現在の内容、1059-1064行目付近):

```ts
export function applyPlayCard(params: ShidasuParams, run: RunState, colIndex: number, rand: () => number = Math.random): RunState {
  if (run.phase !== 'playing' || !run.wave) return run
  const stage = params.stages[run.stageIndex]
  const target = stage.targets[run.waveIndex]
  const { wave, deckComposition } = playCard(params, run.wave, stage.modifier, run.items, target, colIndex, run.deckComposition, rand)
  return { ...run, wave, deckComposition }
}
```

を以下に置き換える:

```ts
export function applyPlayCard(params: ShidasuParams, run: RunState, colIndex: number, rand: () => number = Math.random): RunState {
  if (run.phase !== 'playing' || !run.wave) return run
  const target = waveTarget(params, run.stageIndex, run.waveIndex)
  const modifier = stageModifierFor(params, run)
  const scoreLock = bossScoreLockFor(params, run)
  const { wave, deckComposition } = playCard(params, run.wave, modifier, run.items, target, colIndex, run.deckComposition, rand, scoreLock)
  return { ...run, wave, deckComposition }
}
```

`applyDrawStock`関数(現在の内容、1067-1071行目付近):

```ts
export function applyDrawStock(params: ShidasuParams, run: RunState, rand: () => number = Math.random): RunState {
  if (run.phase !== 'playing' || !run.wave) return run
  const stage = params.stages[run.stageIndex]
  const target = stage.targets[run.waveIndex]
  const { wave, deckComposition } = drawStock(params, run.wave, run.items, target, run.deckComposition, stage.modifier, rand)
  return { ...run, wave, deckComposition }
}
```

を以下に置き換える:

```ts
export function applyDrawStock(params: ShidasuParams, run: RunState, rand: () => number = Math.random): RunState {
  if (run.phase !== 'playing' || !run.wave) return run
  const target = waveTarget(params, run.stageIndex, run.waveIndex)
  const modifier = stageModifierFor(params, run)
  const scoreLock = bossScoreLockFor(params, run)
  const { wave, deckComposition } = drawStock(params, run.wave, run.items, target, run.deckComposition, modifier, rand, scoreLock)
  return { ...run, wave, deckComposition }
}
```

`applyStuckCheck`関数内(現在の内容、1079-1109行目付近から関連箇所のみ):

```ts
export function applyStuckCheck(params: ShidasuParams, run: RunState, rand: () => number = Math.random): RunState {
  if (run.phase !== 'playing' || !run.wave) return run
  const modifier = params.stages[run.stageIndex].modifier
  const wave = run.wave
  if (!isStuck(modifier, wave, run.rites)) return run
```

を以下に置き換える:

```ts
export function applyStuckCheck(params: ShidasuParams, run: RunState, rand: () => number = Math.random): RunState {
  if (run.phase !== 'playing' || !run.wave) return run
  const modifier = stageModifierFor(params, run)
  const wave = run.wave
  if (!isStuck(modifier, wave, run.rites)) return run
```

同関数内、以下の箇所(現在の内容):

```ts
  if (resetWave.stock.length > 0) {
    const stageTarget = params.stages[run.stageIndex].targets[run.waveIndex]
    const drawResult = drawStock(params, resetWave, run.items, stageTarget, run.deckComposition, modifier, rand)
    return { ...run, wave: drawResult.wave, deckComposition: drawResult.deckComposition }
  }
```

を以下に置き換える:

```ts
  if (resetWave.stock.length > 0) {
    const stageTarget = waveTarget(params, run.stageIndex, run.waveIndex)
    const scoreLock = bossScoreLockFor(params, run)
    const drawResult = drawStock(params, resetWave, run.items, stageTarget, run.deckComposition, modifier, rand, scoreLock)
    return { ...run, wave: drawResult.wave, deckComposition: drawResult.deckComposition }
  }
```

- [ ] **Step 8: 既存テストを新しい仕様に更新する**

`src/lib/game/shidasu/engine.test.ts`の`describe('resolveWaveEnd', ...)`ブロック(現在の内容):

```ts
describe('resolveWaveEnd', () => {
  function endedRun(overrides: Partial<RunState>, waveScore: number): RunState {
    const run = beginRun(DEFAULT_PARAMS, 1)
    return {
      ...run,
      ...overrides,
      wave: { ...run.wave!, score: waveScore, status: 'ended', endReason: 'target' },
    }
  }

  test('目標未達ならgameOverになる', () => {
    const run = endedRun({}, 0)
    const next = resolveWaveEnd(DEFAULT_PARAMS, run)
    expect(next.phase).toBe('gameOver')
  })

  test('ウェーブ1・2クリアならitemSelectになりofferにプール内の未所持アイテムが入る', () => {
    const run = endedRun({ waveIndex: 0 }, DEFAULT_PARAMS.stages[0].targets[0])
    const next = resolveWaveEnd(DEFAULT_PARAMS, run, createRng(5))
    expect(next.phase).toBe('itemSelect')
    expect(next.offer).toHaveLength(3)
    next.offer.forEach(id => expect(ITEM_POOL).toContain(id))
    expect(new Set(next.offer).size).toBe(3) // 重複なし
  })

  test('最終ウェーブクリア・次ステージありならstageClearになる', () => {
    const run = endedRun({ waveIndex: 2 }, DEFAULT_PARAMS.stages[0].targets[2])
    const next = resolveWaveEnd(DEFAULT_PARAMS, run)
    expect(next.phase).toBe('stageClear')
  })

  test('最終ステージの最終ウェーブクリアならallClearになる', () => {
    const lastStage = DEFAULT_PARAMS.stages.length - 1
    const run = endedRun({ waveIndex: 2, stageIndex: lastStage }, DEFAULT_PARAMS.stages[lastStage].targets[2])
    const next = resolveWaveEnd(DEFAULT_PARAMS, run)
    expect(next.phase).toBe('allClear')
  })
})
```

を以下に置き換える:

```ts
describe('resolveWaveEnd', () => {
  function endedRun(overrides: Partial<RunState>, waveScore: number): RunState {
    const run = beginRun(DEFAULT_PARAMS, 1)
    return {
      ...run,
      ...overrides,
      wave: { ...run.wave!, score: waveScore, status: 'ended', endReason: 'target' },
    }
  }

  test('目標未達ならgameOverになる', () => {
    const run = endedRun({}, 0)
    const next = resolveWaveEnd(DEFAULT_PARAMS, run)
    expect(next.phase).toBe('gameOver')
  })

  test('ウェーブ1・2クリア(通しウェーブ1・2)ならitemSelectになりofferにプール内の未所持アイテムが入る', () => {
    const run = endedRun({ waveIndex: 0 }, waveTarget(DEFAULT_PARAMS, 0, 0))
    const next = resolveWaveEnd(DEFAULT_PARAMS, run, createRng(5))
    expect(next.phase).toBe('itemSelect')
    expect(next.offer).toHaveLength(3)
    next.offer.forEach(id => expect(ITEM_POOL).toContain(id))
    expect(new Set(next.offer).size).toBe(3) // 重複なし
  })

  test('小凶(stageIndex0の3ウェーブ目)クリアもitemSelectになる(stageClearは廃止)', () => {
    const run = endedRun({ waveIndex: 2, stageIndex: 0 }, waveTarget(DEFAULT_PARAMS, 0, 2))
    const next = resolveWaveEnd(DEFAULT_PARAMS, run, createRng(5))
    expect(next.phase).toBe('itemSelect')
  })

  test('中凶(stageIndex1の3ウェーブ目)クリアもitemSelectになる', () => {
    const run = endedRun({ waveIndex: 2, stageIndex: 1 }, waveTarget(DEFAULT_PARAMS, 1, 2))
    const next = resolveWaveEnd(DEFAULT_PARAMS, run, createRng(5))
    expect(next.phase).toBe('itemSelect')
  })

  test('大凶(stageIndex2の3ウェーブ目)クリアはcontinueChoiceになる', () => {
    const run = endedRun({ waveIndex: 2, stageIndex: 2 }, waveTarget(DEFAULT_PARAMS, 2, 2))
    const next = resolveWaveEnd(DEFAULT_PARAMS, run)
    expect(next.phase).toBe('continueChoice')
  })

  test('2周目の大凶(stageIndex5の3ウェーブ目)クリアもcontinueChoiceになる(サイクルが無限に続く)', () => {
    const run = endedRun({ waveIndex: 2, stageIndex: 5 }, waveTarget(DEFAULT_PARAMS, 5, 2))
    const next = resolveWaveEnd(DEFAULT_PARAMS, run)
    expect(next.phase).toBe('continueChoice')
  })
})
```

`describe('pickItem / advanceStage / restartRun', ...)`ブロック(現在の内容)の`describe`名と`advanceStage`テストを書き換える。現在の内容:

```ts
describe('pickItem / advanceStage / restartRun', () => {
  test('pickItemでアイテムが追加され次ウェーブが始まる(revelationSelectフェーズを経由する)', () => {
    const run: RunState = { ...beginRun(DEFAULT_PARAMS, 1), phase: 'itemSelect', waveIndex: 0, offer: ['bridge'] }
    const next = pickItem(DEFAULT_PARAMS, run, 'bridge', 2)
    expect(next.phase).toBe('revelationSelect')
    expect(next.items).toEqual(['bridge'])
    expect(next.waveIndex).toBe(1)
  })

  test('advanceStageで次ステージのウェーブ0から始まる', () => {
    const run: RunState = { ...beginRun(DEFAULT_PARAMS, 1), phase: 'stageClear', stageIndex: 0 }
    const next = advanceStage(DEFAULT_PARAMS, run, 2)
    expect(next.phase).toBe('playing')
    expect(next.stageIndex).toBe(1)
    expect(next.waveIndex).toBe(0)
  })

  test('restartRunでステージ0・ウェーブ0・アイテムなしに戻る', () => {
```

を以下に置き換える(`advanceStage`のテストを削除し、ステージ繰り上がり・大凶スート抽選のテストに差し替える):

```ts
describe('pickItem / continueAfterGreatMisfortune / restartRun', () => {
  test('pickItemでアイテムが追加され次ウェーブが始まる(revelationSelectフェーズを経由する)', () => {
    const run: RunState = { ...beginRun(DEFAULT_PARAMS, 1), phase: 'itemSelect', waveIndex: 0, offer: ['bridge'] }
    const next = pickItem(DEFAULT_PARAMS, run, 'bridge', 2)
    expect(next.phase).toBe('revelationSelect')
    expect(next.items).toEqual(['bridge'])
    expect(next.waveIndex).toBe(1)
    expect(next.stageIndex).toBe(0)
  })

  test('小凶(stageIndex0)の3ウェーブ目クリア後、pickItemでstageIndex1・waveIndex0へ繰り上がる', () => {
    const run: RunState = { ...beginRun(DEFAULT_PARAMS, 1), phase: 'itemSelect', stageIndex: 0, waveIndex: 2, offer: ['bridge'] }
    const next = pickItem(DEFAULT_PARAMS, run, 'bridge', 2)
    expect(next.stageIndex).toBe(1)
    expect(next.waveIndex).toBe(0)
    expect(next.currentGreatMisfortuneSuit).toBeNull()
  })

  test('中凶(stageIndex1)の3ウェーブ目クリア後、pickItemでstageIndex2(大凶)・waveIndex0へ繰り上がり、対象スートが確定する', () => {
    const run: RunState = { ...beginRun(DEFAULT_PARAMS, 1), phase: 'itemSelect', stageIndex: 1, waveIndex: 2, offer: ['bridge'] }
    const next = pickItem(DEFAULT_PARAMS, run, 'bridge', 2, createRng(3))
    expect(next.stageIndex).toBe(2)
    expect(next.waveIndex).toBe(0)
    expect(next.currentGreatMisfortuneSuit).not.toBeNull()
    expect(['♠', '♥', '♦', '♣']).toContain(next.currentGreatMisfortuneSuit)
  })

  test('continueAfterGreatMisfortuneでitemSelectへ進む。所持護符・秘儀・天啓・神託レベルは維持される', () => {
    const run: RunState = {
      ...beginRun(DEFAULT_PARAMS, 1),
      phase: 'continueChoice',
      stageIndex: 2,
      waveIndex: 2,
      items: ['bridge'],
      rites: ['uruz'],
      oracleLevels: { ...defaultOracleLevels(), suit: 3 },
    }
    const next = continueAfterGreatMisfortune(DEFAULT_PARAMS, run, createRng(1))
    expect(next.phase).toBe('itemSelect')
    expect(next.offer).toHaveLength(3)
    expect(next.items).toEqual(['bridge'])
    expect(next.rites).toEqual(['uruz'])
    expect(next.oracleLevels.suit).toBe(3)
  })

  test('stopAfterGreatMisfortuneでallClearへ進む', () => {
    const run: RunState = { ...beginRun(DEFAULT_PARAMS, 1), phase: 'continueChoice' }
    const next = stopAfterGreatMisfortune(run)
    expect(next.phase).toBe('allClear')
  })

  test('restartRunでステージ0・ウェーブ0・アイテムなしに戻る', () => {
```

**注意:** 上記置き換え後、元の`describe`ブロックの残り(`restartRun`のテスト本体とそれに続くテスト群)はそのまま変更せず維持すること。`describe`名と冒頭2テストの直後に新規4テストを追加し、末尾の`restartRun`テストへ続く形にする。

`engine.test.ts`のimport文(現在の内容、3-31行目付近の`from './engine'`ブロック)から`advanceStage`を削除し、新規関数を追加する:

```ts
import {
  rankLabel,
  isPlayable,
  getPlayableColumns,
  remainingCount,
  startWave,
  playCard,
  drawStock,
  isStuck,
  markStuck,
  createInitialRun,
  beginRun,
  resolveWaveEnd,
  pickItem,
  confirmItemSwap,
  cancelItemSwap,
  skipItemSelect,
  advanceStage,
  restartRun,
  applyPlayCard,
  applyDrawStock,
  applyStuckCheck,
  forceStockTop,
  useRite,
  useRevelation,
  useRevelationFromOffer,
  pickRevelationFromOffer,
  skipRevelationSelect,
```

を以下に置き換える(`advanceStage`を削除し、新規エクスポートを追加。この後に続く`pickOracleFromOffer, skipOracleSelect,` `} from './engine'`はそのまま維持する):

```ts
import {
  rankLabel,
  isPlayable,
  getPlayableColumns,
  remainingCount,
  startWave,
  playCard,
  drawStock,
  isStuck,
  markStuck,
  createInitialRun,
  beginRun,
  resolveWaveEnd,
  pickItem,
  confirmItemSwap,
  cancelItemSwap,
  skipItemSelect,
  continueAfterGreatMisfortune,
  stopAfterGreatMisfortune,
  restartRun,
  applyPlayCard,
  applyDrawStock,
  applyStuckCheck,
  forceStockTop,
  useRite,
  useRevelation,
  useRevelationFromOffer,
  pickRevelationFromOffer,
  skipRevelationSelect,
  waveTarget,
```

- [ ] **Step 9: テストを実行し成功を確認する**

Run: `npm run test -- engine`
Expected: PASS(全件)

- [ ] **Step 10: 型チェック・全体テストを実行する**

Run: `npm run check`
Expected: `engine.ts`・`engine.test.ts`のエラーは解消していること。`+page.svelte`・`src/routes/admin/shidasu/`配下のエラーはTask 4〜5で解消するため許容する。

Run: `npm run test`
Expected: 全件PASS

- [ ] **Step 11: コミット**

```bash
git add src/lib/game/shidasu/engine.ts src/lib/game/shidasu/engine.test.ts
git commit -m "feat: ボスサイクル(小凶/中凶/大凶)のフェーズ遷移と目標スコア算出式に置き換え"
```

---

### Task 4: `+page.svelte`のUI更新

**Files:**
- Modify: `src/routes/game/shidasu/+page.svelte`

- [ ] **Step 1: importと目標スコア・修飾子の算出方法を変更する**

`src/routes/game/shidasu/+page.svelte`のimport群(現在の内容、1-19行目付近):

```ts
  import { onDestroy } from 'svelte'
  import { loadParams } from '$lib/game/shidasu/params'
  import {
    createInitialRun, beginRun, applyPlayCard, applyDrawStock, applyStuckCheck,
    resolveWaveEnd, pickItem, confirmItemSwap, cancelItemSwap, skipItemSelect,
    advanceStage, restartRun, startWave, forceStockTop, useRite,
    useRevelation, useRevelationFromOffer, pickRevelationFromOffer, skipRevelationSelect,
    pickOracleFromOffer, skipOracleSelect,
  } from '$lib/game/shidasu/engine'
  import { itemDesc, itemName } from '$lib/game/shidasu/items'
  import { revelationDesc, revelationName } from '$lib/game/shidasu/revelations'
  import { revelationNeedsTarget } from '$lib/game/shidasu/revelationEffects'
  import { oracleName, oracleDesc } from '$lib/game/shidasu/oracles'
  import { standardDeckComposition } from '$lib/game/shidasu/deck'
  import type { RunState, ItemId, StageModifier, Suit, Rank, RiteId, RevelationId, RoleName } from '$lib/game/shidasu/types'
  import DebugPanel from './DebugPanel.svelte'
  import PlayArea from './PlayArea.svelte'
  import RoleStatusPanel from './RoleStatusPanel.svelte'
```

を以下に置き換える:

```ts
  import { onDestroy } from 'svelte'
  import { loadParams } from '$lib/game/shidasu/params'
  import {
    createInitialRun, beginRun, applyPlayCard, applyDrawStock, applyStuckCheck,
    resolveWaveEnd, pickItem, confirmItemSwap, cancelItemSwap, skipItemSelect,
    continueAfterGreatMisfortune, stopAfterGreatMisfortune, restartRun, startWave, forceStockTop, useRite,
    useRevelation, useRevelationFromOffer, pickRevelationFromOffer, skipRevelationSelect,
    pickOracleFromOffer, skipOracleSelect,
    waveTarget, stageModifierFor, bossTierOf, isBossWave,
  } from '$lib/game/shidasu/engine'
  import { itemDesc, itemName } from '$lib/game/shidasu/items'
  import { revelationDesc, revelationName } from '$lib/game/shidasu/revelations'
  import { revelationNeedsTarget } from '$lib/game/shidasu/revelationEffects'
  import { oracleName, oracleDesc } from '$lib/game/shidasu/oracles'
  import { standardDeckComposition } from '$lib/game/shidasu/deck'
  import type { RunState, ItemId, StageModifier, Suit, Rank, RiteId, RevelationId, RoleName } from '$lib/game/shidasu/types'
  import DebugPanel from './DebugPanel.svelte'
  import PlayArea from './PlayArea.svelte'
  import RoleStatusPanel from './RoleStatusPanel.svelte'
```

- [ ] **Step 2: `stage`・`target`の算出とラベル関数を変更する**

`src/routes/game/shidasu/+page.svelte`の以下の箇所(現在の内容、40-48行目付近):

```ts
  let stage = $derived(params.stages[run.stageIndex])
  let target = $derived(stage.targets[run.waveIndex])
  let wave = $derived(run.wave)

  function modifierLabel(modifier: StageModifier): string {
    if (modifier === 'noLoop') return 'A-Kループ禁止'
    if (modifier === 'faceLock') return '絵札はコンボ2以上でのみ取れる'
    return '制約なし'
  }
```

を以下に置き換える:

```ts
  let target = $derived(waveTarget(params, run.stageIndex, run.waveIndex))
  let wave = $derived(run.wave)
  let currentModifier = $derived(stageModifierFor(params, run))

  // 次のボス(小凶→中凶→大凶)の情報を返す。nextStageIndexは次に迎えるステージ番号
  // (現在ボスウェーブ中ならその次のサイクルの小凶、それ以外なら現在のステージ自身)。
  let upcomingBossInfo = $derived.by(() => {
    const nextStageIndex = isBossWave(params, run.waveIndex) ? run.stageIndex + 1 : run.stageIndex
    const tier = bossTierOf(nextStageIndex)
    if (tier === 0) return { label: params.bossTiers.shoukyou.name, detail: 'A⇔Kループ禁止' }
    if (tier === 1) return { label: params.bossTiers.chuukyou.name, detail: `${params.bossTiers.chuukyou.maxCombo}コンボ以下で無得点` }
    const suit = tier === bossTierOf(run.stageIndex) ? run.currentGreatMisfortuneSuit : null
    return { label: params.bossTiers.taikyou.name, detail: suit ? `${suit}で無得点` : '対象スート未確定' }
  })

  function modifierLabel(modifier: StageModifier): string {
    if (modifier === 'noLoop') return 'A-Kループ禁止'
    if (modifier === 'faceLock') return '絵札はコンボ2以上でのみ取れる'
    return '制約なし'
  }
```

**注意:** `upcomingBossInfo`の`大凶`分岐で、`run.stageIndex`自身が既に大凶ステージ(`tier===2`かつ`nextStageIndex===run.stageIndex`)の場合は`run.currentGreatMisfortuneSuit`(既に確定済み)を表示し、それ以外(まだ大凶ステージに入っていない、次に迎えるのが大凶というだけの場合)は対象スートが未確定なので`null`のままにする。この判定は`tier === bossTierOf(run.stageIndex)`という比較で行っている(次に迎えるステージが大凶で、かつ現在のステージ自身も大凶=つまり大凶ステージの真っ最中、という意味)。

- [ ] **Step 3: `stageRow`スニペットを「次のボス情報」表示に差し替える**

`src/routes/game/shidasu/+page.svelte`の`stageRow`スニペット(現在の内容):

```svelte
{#snippet stageRow()}
  <div class="flex items-center justify-between text-xs">
    <div class="flex items-center gap-2">
      <span class="font-black text-amber-50">{stage.name}</span>
      <span class="flex gap-1">
        {#each [0, 1, 2] as w (w)}
          <span class="w-2 h-2 rounded-full {w < run.waveIndex ? 'bg-yellow-400' : w === run.waveIndex ? 'bg-yellow-400 animate-pulse' : 'bg-emerald-800'}"></span>
        {/each}
      </span>
    </div>
    <span class="text-emerald-300/80">{modifierLabel(stage.modifier)}</span>
  </div>
{/snippet}
```

を以下に置き換える:

```svelte
{#snippet stageRow()}
  <div class="flex items-center justify-between text-xs">
    <span class="flex gap-1">
      {#each [0, 1, 2] as w (w)}
        <span class="w-2 h-2 rounded-full {w < run.waveIndex ? 'bg-yellow-400' : w === run.waveIndex ? 'bg-yellow-400 animate-pulse' : 'bg-emerald-800'}"></span>
      {/each}
    </span>
    {#if isBossWave(params, run.waveIndex)}
      <span class="font-black text-rose-400">{upcomingBossInfo.label}({upcomingBossInfo.detail})</span>
    {:else}
      <span class="text-emerald-300/80">次: {upcomingBossInfo.label}({upcomingBossInfo.detail})</span>
    {/if}
  </div>
{/snippet}
```

- [ ] **Step 4: `PlayArea`呼び出しの`modifier`引数を差し替える**

`src/routes/game/shidasu/+page.svelte`内、`modifier={stage.modifier}`という文字列を検索し、3箇所全てを`modifier={currentModifier}`に置き換える(`replace_all`で一括置換可能):

```svelte
modifier={stage.modifier}
```

を以下に置き換える(3箇所):

```svelte
modifier={currentModifier}
```

- [ ] **Step 5: `handleAdvanceStage`を`handleContinueAfterGreatMisfortune`・`handleStopAfterGreatMisfortune`に差し替える**

`src/routes/game/shidasu/+page.svelte`の以下の箇所(現在の内容):

```ts
  function handleAdvanceStage() {
    run = advanceStage(params, run)
    afterAction()
  }
```

を以下に置き換える:

```ts
  function handleContinueAfterGreatMisfortune() {
    run = continueAfterGreatMisfortune(params, run)
    afterAction()
  }

  function handleStopAfterGreatMisfortune() {
    run = stopAfterGreatMisfortune(run)
  }
```

- [ ] **Step 6: `stageClear`画面を`continueChoice`画面(続ける/やめるの2択)に差し替える**

`src/routes/game/shidasu/+page.svelte`の以下の箇所(現在の内容):

```svelte
{:else if run.phase === 'stageClear'}
  <div class="fixed inset-0 z-50 bg-emerald-950/90 backdrop-blur-sm flex items-center justify-center p-6">
    <div class="w-full max-w-sm flex flex-col items-center text-center">
      <div class="text-yellow-300 text-xs tracking-widest mb-2">STAGE CLEAR</div>
      <div class="text-3xl font-black text-amber-50 mb-4">{stage.name} 突破!</div>
      <div class="bg-emerald-900/80 border border-emerald-500/40 rounded-xl px-4 py-3 mb-5 text-sm">
        <div class="text-emerald-300/80 text-xs mb-1">次のステージの制約</div>
        <div class="font-bold text-amber-50">{modifierLabel(params.stages[run.stageIndex + 1].modifier)}</div>
      </div>
      <button onclick={handleAdvanceStage} class="px-10 py-3 rounded-full bg-yellow-400 text-emerald-950 font-black active:scale-95 transition-transform">
        次のステージへ
      </button>
    </div>
  </div>
{:else if run.phase === 'allClear'}
  <div class="fixed inset-0 z-50 bg-emerald-950/90 backdrop-blur-sm flex items-center justify-center p-6">
    <div class="w-full max-w-sm flex flex-col items-center text-center">
      <div class="text-3xl font-black text-yellow-300 mb-2">全ステージクリア!</div>
      <div class="text-emerald-100/80 text-sm mb-6">全ての山を制覇した</div>
      <button onclick={handleRestart} class="px-10 py-3 rounded-full bg-yellow-400 text-emerald-950 font-black active:scale-95">
        もう一度
      </button>
    </div>
  </div>
```

を以下に置き換える:

```svelte
{:else if run.phase === 'continueChoice'}
  <div class="fixed inset-0 z-50 bg-emerald-950/90 backdrop-blur-sm flex items-center justify-center p-6">
    <div class="w-full max-w-sm flex flex-col items-center text-center">
      <div class="text-yellow-300 text-xs tracking-widest mb-2">{params.bossTiers.taikyou.name} 撃破!</div>
      <div class="text-2xl font-black text-amber-50 mb-6">続けますか?</div>
      <div class="flex flex-col gap-3 w-full">
        <button onclick={handleContinueAfterGreatMisfortune} class="px-10 py-3 rounded-full bg-yellow-400 text-emerald-950 font-black active:scale-95 transition-transform">
          続ける
        </button>
        <button onclick={handleStopAfterGreatMisfortune} class="px-10 py-3 rounded-full border border-emerald-700/60 text-emerald-200/70 font-black active:scale-95 transition-transform">
          やめる
        </button>
      </div>
    </div>
  </div>
{:else if run.phase === 'allClear'}
  <div class="fixed inset-0 z-50 bg-emerald-950/90 backdrop-blur-sm flex items-center justify-center p-6">
    <div class="w-full max-w-sm flex flex-col items-center text-center">
      <div class="text-3xl font-black text-yellow-300 mb-2">結果</div>
      <div class="text-2xl font-black text-amber-50 mb-1">{run.wave?.score ?? 0} 点</div>
      <div class="text-emerald-100/80 text-sm mb-6">お疲れ様でした</div>
      <button onclick={handleRestart} class="px-10 py-3 rounded-full bg-yellow-400 text-emerald-950 font-black active:scale-95">
        もう一度
      </button>
    </div>
  </div>
```

- [ ] **Step 7: 型チェックを実行する**

Run: `npm run check`
Expected: `+page.svelte`にエラーが無いこと(`src/routes/admin/shidasu/`配下のエラーはTask 5で解消するため許容する)

- [ ] **Step 8: コミット**

```bash
git add src/routes/game/shidasu/+page.svelte
git commit -m "feat: 次のボス情報表示・続行確認画面(continueChoice)をUIに反映"
```

---

### Task 5: 管理画面の更新(`/admin/shidasu`)

**Files:**
- Delete: `src/routes/admin/shidasu/StagesSection.svelte`
- Create: `src/routes/admin/shidasu/BossTiersSection.svelte`
- Modify: `src/routes/admin/shidasu/+page.svelte`

- [ ] **Step 1: `StagesSection.svelte`を削除する**

```bash
git rm src/routes/admin/shidasu/StagesSection.svelte
```

- [ ] **Step 2: `BossTiersSection.svelte`を新規作成する**

`src/routes/admin/shidasu/BossTiersSection.svelte`を新規作成:

```svelte
<script lang="ts">
  import type { ShidasuParams } from '$lib/game/shidasu/params'

  let { config }: { config: ShidasuParams } = $props()
</script>

<section class="bg-white border border-slate-200 rounded-xl p-4">
  <h2 class="font-semibold text-slate-700 text-sm mb-3">ボス・目標スコア</h2>
  <div class="grid grid-cols-2 gap-3 mb-4">
    <label class="text-xs text-slate-500">
      目標スコア基礎値(waveTargetBase)
      <input type="number" min="1" step="1" bind:value={config.scoring.waveTargetBase} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
    </label>
    <label class="text-xs text-slate-500">
      目標スコア倍率(waveTargetMultiplier)
      <input type="number" min="1" step="0.01" bind:value={config.scoring.waveTargetMultiplier} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
    </label>
  </div>
  <div class="grid grid-cols-3 gap-3">
    <label class="text-xs text-slate-500">
      小凶の名前
      <input type="text" bind:value={config.bossTiers.shoukyou.name} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
    </label>
    <label class="text-xs text-slate-500">
      中凶の名前
      <input type="text" bind:value={config.bossTiers.chuukyou.name} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
    </label>
    <label class="text-xs text-slate-500">
      大凶の名前
      <input type="text" bind:value={config.bossTiers.taikyou.name} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
    </label>
    <label class="text-xs text-slate-500 col-span-3">
      中凶: n以下のコンボで無得点(maxCombo)
      <input type="number" min="0" step="1" bind:value={config.bossTiers.chuukyou.maxCombo} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
    </label>
  </div>
</section>
```

- [ ] **Step 3: `/admin/shidasu/+page.svelte`を更新する**

`src/routes/admin/shidasu/+page.svelte`のimport群(現在の内容):

```ts
  import { onMount, onDestroy } from 'svelte'
  import { DEFAULT_PARAMS, type ShidasuParams } from '$lib/game/shidasu/params'
  import LayoutSection from './LayoutSection.svelte'
  import ItemsSection from './ItemsSection.svelte'
  import ScoringSection from './ScoringSection.svelte'
  import RoleBonusSection from './RoleBonusSection.svelte'
  import StagesSection from './StagesSection.svelte'
  import FlowUiSection from './FlowUiSection.svelte'
  import JsonPanel from './JsonPanel.svelte'
```

を以下に置き換える:

```ts
  import { onMount, onDestroy } from 'svelte'
  import { DEFAULT_PARAMS, type ShidasuParams } from '$lib/game/shidasu/params'
  import LayoutSection from './LayoutSection.svelte'
  import ItemsSection from './ItemsSection.svelte'
  import ScoringSection from './ScoringSection.svelte'
  import RoleBonusSection from './RoleBonusSection.svelte'
  import BossTiersSection from './BossTiersSection.svelte'
  import FlowUiSection from './FlowUiSection.svelte'
  import JsonPanel from './JsonPanel.svelte'
```

`hasValidationError`の算出(現在の内容):

```ts
  let hasValidationError = $derived.by(() => {
    if (!config) return false
    if (config.stages.length < 1) return true
    for (const stage of config.stages) {
      if (stage.targets.some(t => !Number.isFinite(t) || t < 0)) return true
    }
    // 場札(cols×rows)配布後にfoundation用の1枚が残らないと山札が尽きてゲームが起動できない
    if (config.layout.cols < 1 || config.layout.rows < 1) return true
    if (config.layout.cols * config.layout.rows > 51) return true
    if (!Number.isFinite(config.ui.chainCardsPerRow) || config.ui.chainCardsPerRow < 1) return true
    if (!Number.isFinite(config.ui.chainCardOffsetX) || config.ui.chainCardOffsetX < 0) return true
    if (!Number.isFinite(config.items.maxItems) || config.items.maxItems < 1) return true
    if (!Number.isFinite(config.scoring.suitColorMinLen) || config.scoring.suitColorMinLen < 1) return true
    if (!Number.isFinite(config.talismans.morningMist.x) || config.talismans.morningMist.x <= 0) return true
    return false
  })

  let targetsNotAscending = $derived.by(() => {
    if (!config) return false
    return config.stages.some(s => !(s.targets[0] < s.targets[1] && s.targets[1] < s.targets[2]))
  })
```

を以下に置き換える(`stages`関連のバリデーションを削除し、`waveTargetBase`・`waveTargetMultiplier`・`chuukyou.maxCombo`のチェックに差し替える。`targetsNotAscending`は目標スコアが常に単調増加する算出式に変わったため不要になり削除する):

```ts
  let hasValidationError = $derived.by(() => {
    if (!config) return false
    if (!Number.isFinite(config.scoring.waveTargetBase) || config.scoring.waveTargetBase <= 0) return true
    if (!Number.isFinite(config.scoring.waveTargetMultiplier) || config.scoring.waveTargetMultiplier <= 1) return true
    if (!Number.isFinite(config.bossTiers.chuukyou.maxCombo) || config.bossTiers.chuukyou.maxCombo < 0) return true
    // 場札(cols×rows)配布後にfoundation用の1枚が残らないと山札が尽きてゲームが起動できない
    if (config.layout.cols < 1 || config.layout.rows < 1) return true
    if (config.layout.cols * config.layout.rows > 51) return true
    if (!Number.isFinite(config.ui.chainCardsPerRow) || config.ui.chainCardsPerRow < 1) return true
    if (!Number.isFinite(config.ui.chainCardOffsetX) || config.ui.chainCardOffsetX < 0) return true
    if (!Number.isFinite(config.items.maxItems) || config.items.maxItems < 1) return true
    if (!Number.isFinite(config.scoring.suitColorMinLen) || config.scoring.suitColorMinLen < 1) return true
    if (!Number.isFinite(config.talismans.morningMist.x) || config.talismans.morningMist.x <= 0) return true
    return false
  })
```

テンプレート内、`{:else if targetsNotAscending}`の分岐(現在の内容):

```svelte
      {#if hasValidationError}
        <p class="text-xs text-red-600 self-center">入力値が不正です</p>
      {:else if targetsNotAscending}
        <p class="text-xs text-amber-600 self-center">目標スコアが昇順ではありません</p>
      {/if}
```

を以下に置き換える:

```svelte
      {#if hasValidationError}
        <p class="text-xs text-red-600 self-center">入力値が不正です</p>
      {/if}
```

テンプレート内、`<StagesSection {config} />`の行を`<BossTiersSection {config} />`に置き換える:

```svelte
      <StagesSection {config} />
```

を以下に置き換える:

```svelte
      <BossTiersSection {config} />
```

- [ ] **Step 4: 型チェック・ビルドを実行する**

Run: `npm run check`
Expected: エラー無し(shidasu関連)

Run: `npm run build`
Expected: 成功

- [ ] **Step 5: コミット**

```bash
git add src/routes/admin/shidasu/BossTiersSection.svelte src/routes/admin/shidasu/+page.svelte src/routes/admin/shidasu/StagesSection.svelte
git commit -m "feat: 管理画面のステージ設定をボス階級・目標スコア算出式設定に置き換え"
```

---

### Task 6: 最終確認・ブラウザ動作確認

**Files:** (テスト・動作確認のみ、コード変更なし)

- [ ] **Step 1: 全体テスト・型チェック・ビルドを実行する**

Run: `npm run test`
Expected: 全件PASS

Run: `npm run check`
Expected: shidasu関連ファイルにエラー無し

Run: `npm run build`
Expected: 成功

- [ ] **Step 2: `npm run dev`でブラウザ動作確認する**

`npm run dev`で開発サーバーを起動し、`/game/shidasu`を開いて以下を確認する:

1. ゲームを開始すると、常時表示エリアに「次: 小凶(A⇔Kループ禁止)」のように表示される
2. 1・2ウェーブ目は制約なくプレイできる
3. 3ウェーブ目(小凶ボスウェーブ)ではA⇔Kループ接続ができなくなり、表示が強調される
4. 小凶クリア後、他のウェーブと同じく護符→天啓→神託の選択画面を経て次のウェーブへ進む(旧STAGE CLEAR画面が表示されない)
5. ステージ1(中凶)の3ウェーブ目で、2コンボ以下のプレイの獲得点が0になり、3コンボ以上では通常通り得点することを確認する
6. 中凶クリア後、常時表示エリアに大凶の対象スートが表示される(例:「次: 大凶(♠で無得点)」)
7. ステージ2(大凶)の1〜3ウェーブ目全てで同じ対象スートが使われ続けることを確認する。対象スートのカードを取ると獲得点が0になり、対象外のスート・ワイルドは通常通り得点することを確認する
8. 大凶クリア後、「続ける/やめる」の選択画面が表示される。「続ける」を選ぶと護符→天啓→神託の選択画面を経て次のサイクル(小凶)へ進み、所持中の護符・秘儀・天啓・神託レベルが維持されていることを確認する
9. 「やめる」を選ぶと結果画面が表示され、「もう一度」でタイトルに戻れることを確認する
10. 目標スコアがウェーブが進むごとに上昇していくことを確認する(2000×1.5^(n-1)の指数関数的な増加)
11. コンソールエラーが出ていないことを確認する

- [ ] **Step 3: `/admin/shidasu`の動作確認**

`/admin/shidasu`を開き、「ボス・目標スコア」セクションが表示され、目標スコア基礎値・倍率・小凶/中凶/大凶の名前・中凶のmaxComboを編集できることを確認する。旧「ステージ」セクション(ステージ追加・削除UI)が表示されていないことを確認する。

- [ ] **Step 4: 問題があれば修正し、再度Step 1〜3を実行する**

- [ ] **Step 5: 最終コミット(修正があった場合のみ)**

```bash
git add -A
git commit -m "fix: ボスサイクル機能のブラウザ動作確認で見つかった問題を修正"
```
