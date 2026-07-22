# Shidasu 「スプレッド」(ラン選択)導入 Phase3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `docs/superpowers/specs/2026-07-22-shidasu-spread-selection-design.md`に基づき、ラン開始時に「スプレッド」(愚者=特殊ルールなし、月=場札-1行固定)を選べるようにし、選んだスプレッドごとに固有の目標スコア算出式・初期配布行数オフセットが適用されるようにする。

**Architecture:** `ShidasuParams`に新規`spreads`セクション(愚者・月それぞれの名前・説明文・初期行数オフセット・目標スコア基礎値/倍率)を追加し、既存の`scoring.waveTargetBase/waveTargetMultiplier`(グローバル値)を廃止してスプレッドごとの値に置き換える。`RunState`に`spreadId`を追加し、`beginRun`が選択されたスプレッドIDを受け取って`extraTableauRows`の初期値・目標スコア算出に反映する。タイトル画面の「はじめる」ボタンをスプレッド一覧に差し替える。

**Tech Stack:** TypeScript, Svelte 5, Vitest

---

### Task 1: 型定義・パラメータ構造の変更

**Files:**
- Modify: `src/lib/game/shidasu/types.ts`
- Modify: `src/lib/game/shidasu/params.ts`
- Modify: `src/lib/game/shidasu/shidasu.config.json`
- Modify: `src/lib/game/shidasu/engine.test.ts`(型追従のみ)

- [ ] **Step 1: `types.ts`に`SpreadId`型を追加する**

`src/lib/game/shidasu/types.ts`の4行目、現在の内容:

```ts
export type StageModifier = 'none' | 'noLoop' | 'faceLock'
```

の直後に以下を追加する:

```ts
export type StageModifier = 'none' | 'noLoop' | 'faceLock'
// スプレッド: ラン開始時にプレイヤーが選ぶ固有ルールセット。大アルカナから命名する。
// fool(愚者)=特殊ルールなしの基本スプレッド、moon(月)=場札が常に1行少ない状態で始まる
export type SpreadId = 'fool' | 'moon'
```

- [ ] **Step 2: `RunState`に`spreadId`フィールドを追加する**

`RunState`インターフェースの末尾(`currentGreatMisfortuneSuit: Suit | null`の直後、210行目付近)に追加する。現在の内容:

```ts
  // 大凶ステージ(stageIndex % 3 === 2)の対象スート。中凶クリア直後(大凶ステージの1ウェーブ目を
  // 配る時点)にrandで抽選して確定し、そのステージが終わるまで(1〜3ウェーブ目)固定で使い回す。
  // 小凶・中凶ステージの間は常にnull
  currentGreatMisfortuneSuit: Suit | null
}
```

を以下に置き換える:

```ts
  // 大凶ステージ(stageIndex % 3 === 2)の対象スート。中凶クリア直後(大凶ステージの1ウェーブ目を
  // 配る時点)にrandで抽選して確定し、そのステージが終わるまで(1〜3ウェーブ目)固定で使い回す。
  // 小凶・中凶ステージの間は常にnull
  currentGreatMisfortuneSuit: Suit | null
  // ラン開始時に選ばれたスプレッド。ラン全体を通して不変(タイトル画面に戻って選び直すまで固定)
  spreadId: SpreadId
}
```

- [ ] **Step 3: `params.ts`の`scoring`から`waveTargetBase`/`waveTargetMultiplier`を削除し、新規`spreads`セクションを追加する**

`ShidasuParams`インターフェースの`scoring`ブロック、現在の内容:

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

を以下に置き換える(`waveTargetBase`/`waveTargetMultiplier`を`scoring`から削除し、`bossTiers`の直後に新規`spreads`セクションを追加する):

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
  // ボス階級ごとの設定。stageIndex % 3 (0=小凶,1=中凶,2=大凶)でインデックスする代わりに、
  // 読みやすさのため名前付きキーで持つ(shoukyou=小凶,chuukyou=中凶,taikyou=大凶)
  bossTiers: {
    shoukyou: { name: string }
    chuukyou: { name: string; maxCombo: number }
    taikyou: { name: string }
  }
  // スプレッド(ラン開始時に選ぶ固有ルールセット)ごとの設定。目標スコア算出式
  // target(n) = waveTargetBase × waveTargetMultiplier^(n-1) の基礎値・倍率(nは通しウェーブ番号、1始まり)と、
  // ウェーブ開始時の配布行数への初期オフセット(initialExtraTableauRows)をスプレッドごとに持つ。
  // 暗雲護符・虚の天啓によるextraTableauRowsの加算は、この初期値を起点に通常通り行われる。
  spreads: {
    fool: { name: string; desc: string; initialExtraTableauRows: number; waveTargetBase: number; waveTargetMultiplier: number }
    moon: { name: string; desc: string; initialExtraTableauRows: number; waveTargetBase: number; waveTargetMultiplier: number }
  }
```

`params.ts`内で`import type { Rarity } from './types'`となっている箇所は、`SpreadId`をこのファイルの型注釈で直接参照する必要はない(`spreads`の型は`SpreadId`ではなく固定キー`fool`/`moon`で直接書いているため)。importの変更は不要。

- [ ] **Step 4: `DEFAULT_PARAMS`から`waveTargetBase`/`waveTargetMultiplier`を削除し、`spreads`のデータを追加する**

`DEFAULT_PARAMS.scoring`ブロック、現在の内容:

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
  },
  bossTiers: {
    shoukyou: { name: '小凶' },
    chuukyou: { name: '中凶', maxCombo: 2 },
    taikyou: { name: '大凶' },
  },
  spreads: {
    fool: { name: '愚者', desc: '特殊ルールなし', initialExtraTableauRows: 0, waveTargetBase: 2000, waveTargetMultiplier: 1.5 },
    moon: { name: '月', desc: '場札は常に1行少ない状態で始まる(護符・天啓による行数変動は通常通り発生する)', initialExtraTableauRows: -1, waveTargetBase: 2000, waveTargetMultiplier: 1.5 },
  },
```

- [ ] **Step 5: `shidasu.config.json`を`params.ts`と同期する**

`src/lib/game/shidasu/shidasu.config.json`の現在の内容(1-29行目):

```json
{
  "layout": {
    "cols": 7,
    "rows": 5
  },
  "scoring": {
    "basePoint": 100,
    "suitBonus": 100,
    "colorBonus": 50,
    "suitColorMinLen": 3,
    "stairBonus": 150,
    "stairMinLen": 3,
    "clearBonus": 2000,
    "clearBonusPerStock": 50,
    "comboMultiplierStep": 0.1,
    "flushBonus": 300,
    "royalSetBonus": 400,
    "sameRankBonusUnit": 100,
    "completeRunBonus": 1000,
    "completeRunSuitBonus": 1000,
    "columnSweepBonus": 500,
    "waveTargetBase": 2000,
    "waveTargetMultiplier": 1.5
  },
  "bossTiers": {
    "shoukyou": { "name": "小凶" },
    "chuukyou": { "name": "中凶", "maxCombo": 2 },
    "taikyou": { "name": "大凶" }
  },
```

を以下に置き換える(`scoring`から`waveTargetBase`/`waveTargetMultiplier`を削除し、`bossTiers`の直後に`spreads`を追加する。`columnSweepBonus`の値はこのファイル固有の`500`のまま変更しない):

```json
{
  "layout": {
    "cols": 7,
    "rows": 5
  },
  "scoring": {
    "basePoint": 100,
    "suitBonus": 100,
    "colorBonus": 50,
    "suitColorMinLen": 3,
    "stairBonus": 150,
    "stairMinLen": 3,
    "clearBonus": 2000,
    "clearBonusPerStock": 50,
    "comboMultiplierStep": 0.1,
    "flushBonus": 300,
    "royalSetBonus": 400,
    "sameRankBonusUnit": 100,
    "completeRunBonus": 1000,
    "completeRunSuitBonus": 1000,
    "columnSweepBonus": 500
  },
  "bossTiers": {
    "shoukyou": { "name": "小凶" },
    "chuukyou": { "name": "中凶", "maxCombo": 2 },
    "taikyou": { "name": "大凶" }
  },
  "spreads": {
    "fool": { "name": "愚者", "desc": "特殊ルールなし", "initialExtraTableauRows": 0, "waveTargetBase": 2000, "waveTargetMultiplier": 1.5 },
    "moon": { "name": "月", "desc": "場札は常に1行少ない状態で始まる(護符・天啓による行数変動は通常通り発生する)", "initialExtraTableauRows": -1, "waveTargetBase": 2000, "waveTargetMultiplier": 1.5 }
  },
```

- [ ] **Step 6: 既存の`RunState`リテラル(6箇所)に`spreadId`を追加する**

`src/lib/game/shidasu/engine.test.ts`内、`describe('applyStuckCheck (不屈の護符)', ...)`ブロック内の以下の完全な文字列(6箇所、全て同一):

```ts
      oracleLevels: defaultOracleLevels(), oracleOffer: [], currentGreatMisfortuneSuit: null,
```

を`replace_all`で以下に一括置換する:

```ts
      oracleLevels: defaultOracleLevels(), oracleOffer: [], currentGreatMisfortuneSuit: null, spreadId: 'fool',
```

- [ ] **Step 7: `spreads.fool`と`spreads.moon`の目標スコア式が同一であることを確認するテストを追加する**

`src/lib/game/shidasu/params.test.ts`の`describe('DEFAULT_PARAMS', ...)`ブロック内、`test('comboMultiplierStepは0.1', ...)`テストの直後に以下を追加する:

```ts
  test('月の目標スコア基礎値・倍率は愚者と全く同じ(場札が少ない分の難易度上昇を目標スコア側では相殺しない)', () => {
    expect(DEFAULT_PARAMS.spreads.moon.waveTargetBase).toBe(DEFAULT_PARAMS.spreads.fool.waveTargetBase)
    expect(DEFAULT_PARAMS.spreads.moon.waveTargetMultiplier).toBe(DEFAULT_PARAMS.spreads.fool.waveTargetMultiplier)
  })

  test('月の初期行数オフセットは-1、愚者は0', () => {
    expect(DEFAULT_PARAMS.spreads.fool.initialExtraTableauRows).toBe(0)
    expect(DEFAULT_PARAMS.spreads.moon.initialExtraTableauRows).toBe(-1)
  })
```

Run: `npx vitest run src/lib/game/shidasu/params.test.ts`
Expected: PASS(2件とも)

- [ ] **Step 8: 型チェックを実行し、想定内のエラーのみであることを確認する**

Run: `npm run check`

Expected: 以下のエラーは想定内であり許容する(このタスクでは`engine.ts`・UI・admin画面は一切変更しないため、Task 2〜4で解消する):
- `engine.ts`内で`params.scoring.waveTargetBase/waveTargetMultiplier`を参照している`waveTarget`関数のエラー
- `engine.ts`の`createInitialRun`・`beginRun`が返す`RunState`リテラルに`spreadId`が無いことによるエラー
- `src/routes/admin/shidasu/BossTiersSection.svelte`(`config.scoring.waveTargetBase/waveTargetMultiplier`参照)のエラー
- `src/routes/admin/shidasu/+page.svelte`(同様の参照)のエラー

それ以外(`types.ts`・`params.ts`・`shidasu.config.json`・`engine.test.ts`の6箇所修正関連、`params.test.ts`)にエラーが無いことを確認する。

- [ ] **Step 9: コミット**

```bash
git add src/lib/game/shidasu/types.ts src/lib/game/shidasu/params.ts src/lib/game/shidasu/shidasu.config.json src/lib/game/shidasu/engine.test.ts src/lib/game/shidasu/params.test.ts
git commit -m "feat: スプレッド(ラン選択)の型定義とパラメータを追加"
```

---

### Task 2: engine.tsのロジック変更(waveTarget・beginRun・呼び出し元)

**Files:**
- Modify: `src/lib/game/shidasu/engine.ts`
- Modify: `src/lib/game/shidasu/engine.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/game/shidasu/engine.test.ts`の`describe('createInitialRun / beginRun', ...)`ブロック(現在の内容):

```ts
describe('createInitialRun / beginRun', () => {
  test('createInitialRunはtitleフェーズでwave=null、pendingNewItemはnull', () => {
    const run = createInitialRun()
    expect(run.phase).toBe('title')
    expect(run.wave).toBeNull()
    expect(run.items).toEqual([])
    expect(run.pendingNewItem).toBeNull()
  })

  test('beginRunはplayingフェーズでステージ0・ウェーブ0から始まる、pendingNewItemはnull', () => {
    const run = beginRun(DEFAULT_PARAMS, 1)
    expect(run.phase).toBe('playing')
    expect(run.stageIndex).toBe(0)
    expect(run.waveIndex).toBe(0)
    expect(run.wave).not.toBeNull()
    expect(run.pendingNewItem).toBeNull()
  })
})
```

を以下に置き換える(既存2テストは維持し、新規4テストを追加する):

```ts
describe('createInitialRun / beginRun', () => {
  test('createInitialRunはtitleフェーズでwave=null、pendingNewItemはnull', () => {
    const run = createInitialRun()
    expect(run.phase).toBe('title')
    expect(run.wave).toBeNull()
    expect(run.items).toEqual([])
    expect(run.pendingNewItem).toBeNull()
  })

  test('createInitialRunのspreadIdは既定でfool', () => {
    const run = createInitialRun()
    expect(run.spreadId).toBe('fool')
  })

  test('beginRunはplayingフェーズでステージ0・ウェーブ0から始まる、pendingNewItemはnull', () => {
    const run = beginRun(DEFAULT_PARAMS, 1)
    expect(run.phase).toBe('playing')
    expect(run.stageIndex).toBe(0)
    expect(run.waveIndex).toBe(0)
    expect(run.wave).not.toBeNull()
    expect(run.pendingNewItem).toBeNull()
  })

  test('beginRunはspreadIdを省略するとfoolになり、extraTableauRowsは0、場札は通常の行数(5行)で配られる', () => {
    const run = beginRun(DEFAULT_PARAMS, 1)
    expect(run.spreadId).toBe('fool')
    expect(run.extraTableauRows).toBe(0)
    run.wave!.tableau.forEach(col => expect(col).toHaveLength(DEFAULT_PARAMS.layout.rows))
  })

  test('beginRunでspreadId=moonを指定すると、extraTableauRowsは-1になり、場札は通常より1行少なく配られる', () => {
    const run = beginRun(DEFAULT_PARAMS, 1, 'moon')
    expect(run.spreadId).toBe('moon')
    expect(run.extraTableauRows).toBe(-1)
    run.wave!.tableau.forEach(col => expect(col).toHaveLength(DEFAULT_PARAMS.layout.rows - 1))
  })

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
})
```

- [ ] **Step 2: テストを実行し失敗を確認する**

Run: `npx vitest run src/lib/game/shidasu/engine.test.ts -t "createInitialRun / beginRun"`
Expected: FAIL(`createInitialRun`が`spreadId`を持たない、`beginRun`が3番目の引数`spreadId`を受け取らない、`waveTarget`が4番目の引数`spreadId`を受け取らないため)

- [ ] **Step 3: `waveTarget`を変更する**

`src/lib/game/shidasu/engine.ts`の`waveTarget`関数、現在の内容:

```ts
export function waveTarget(params: ShidasuParams, stageIndex: number, waveIndex: number): number {
  const overallWaveNumber = stageIndex * params.flow.wavesPerStage + waveIndex + 1
  return Math.floor(params.scoring.waveTargetBase * params.scoring.waveTargetMultiplier ** (overallWaveNumber - 1))
}
```

を以下に置き換える(末尾に`spreadId`引数を追加し、`params.spreads[spreadId]`から基礎値・倍率を取る):

```ts
export function waveTarget(params: ShidasuParams, stageIndex: number, waveIndex: number, spreadId: SpreadId = 'fool'): number {
  const overallWaveNumber = stageIndex * params.flow.wavesPerStage + waveIndex + 1
  const spread = params.spreads[spreadId]
  return Math.floor(spread.waveTargetBase * spread.waveTargetMultiplier ** (overallWaveNumber - 1))
}
```

`engine.ts`の先頭のimport文、現在`import type { Card, StageModifier, WaveState, ItemId, WaveEndReason, RunState, Suit, Rank, DeckCard, RoleName, BonusGain, ChainCardOrigin, RiteId, Rarity, RevelationId } from './types'`となっている行に`SpreadId`を追加する:

```ts
import type { Card, StageModifier, WaveState, ItemId, WaveEndReason, RunState, Suit, Rank, DeckCard, RoleName, BonusGain, ChainCardOrigin, RiteId, Rarity, RevelationId, SpreadId } from './types'
```

- [ ] **Step 4: `createInitialRun`・`beginRun`を変更する**

現在の内容:

```ts
export function createInitialRun(): RunState {
  return {
    phase: 'title', stageIndex: 0, waveIndex: 0, items: [], offer: [], wave: null, pendingNewItem: null,
    deckComposition: standardDeckComposition(), rites: [], revelations: [], revelationOffer: [], extraTableauRows: 0,
    oracleLevels: defaultOracleLevels(), oracleOffer: [], currentGreatMisfortuneSuit: null,
  }
}

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

を以下に置き換える:

```ts
export function createInitialRun(): RunState {
  return {
    phase: 'title', stageIndex: 0, waveIndex: 0, items: [], offer: [], wave: null, pendingNewItem: null,
    deckComposition: standardDeckComposition(), rites: [], revelations: [], revelationOffer: [], extraTableauRows: 0,
    oracleLevels: defaultOracleLevels(), oracleOffer: [], currentGreatMisfortuneSuit: null, spreadId: 'fool',
  }
}

export function beginRun(params: ShidasuParams, seed?: number, spreadId: SpreadId = 'fool'): RunState {
  const initialExtraTableauRows = params.spreads[spreadId].initialExtraTableauRows
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
  }
}
```

- [ ] **Step 5: `resolveWaveEnd`・`applyPlayCard`・`applyDrawStock`・`applyStuckCheck`の`waveTarget`呼び出しに`run.spreadId`を渡す**

`src/lib/game/shidasu/engine.ts`内、以下の4箇所全てで`waveTarget(params, run.stageIndex, run.waveIndex)`という完全に同一の文字列が使われている。`replace_all`で以下に一括置換する:

```ts
waveTarget(params, run.stageIndex, run.waveIndex)
```

を以下に置き換える:

```ts
waveTarget(params, run.stageIndex, run.waveIndex, run.spreadId)
```

(該当箇所は`resolveWaveEnd`・`applyPlayCard`・`applyDrawStock`・`applyStuckCheck`の4関数。編集前に実際のコードを読んで、この文字列が本当に4箇所とも一致すること、他の意図しない箇所に誤爆しないことを確認してから置換すること)

- [ ] **Step 6: テストを実行し成功を確認する**

Run: `npx vitest run src/lib/game/shidasu/engine.test.ts`
Expected: PASS(全件)

- [ ] **Step 7: 型チェック・全体テストを実行する**

Run: `npm run check`
Expected: `engine.ts`・`engine.test.ts`のエラーは解消していること。`src/routes/admin/shidasu/BossTiersSection.svelte`・`src/routes/admin/shidasu/+page.svelte`・`src/routes/game/shidasu/+page.svelte`のエラーはTask 3〜4で解消するため許容する。

Run: `npm run test`
Expected: 全件PASS

- [ ] **Step 8: コミット**

```bash
git add src/lib/game/shidasu/engine.ts src/lib/game/shidasu/engine.test.ts
git commit -m "feat: waveTarget・beginRunがスプレッドごとの目標スコア式・初期行数オフセットを参照するよう変更"
```

---

### Task 3: +page.svelteのUI変更(タイトル画面のスプレッド選択・常時表示)

**Files:**
- Modify: `src/routes/game/shidasu/+page.svelte`

- [ ] **Step 1: importに`SpreadId`型を追加し、`waveTarget`呼び出しに`spreadId`を渡す**

`src/routes/game/shidasu/+page.svelte`の型importの行、現在の内容:

```ts
  import type { RunState, ItemId, Suit, Rank, RiteId, RevelationId, RoleName } from '$lib/game/shidasu/types'
```

を以下に置き換える:

```ts
  import type { RunState, ItemId, Suit, Rank, RiteId, RevelationId, RoleName, SpreadId } from '$lib/game/shidasu/types'
```

現在の内容:

```ts
  let target = $derived(waveTarget(params, run.stageIndex, run.waveIndex))
```

を以下に置き換える:

```ts
  let target = $derived(waveTarget(params, run.stageIndex, run.waveIndex, run.spreadId))
```

- [ ] **Step 2: `startGame`を`handleStartWithSpread`に差し替える**

現在の内容:

```ts
  function startGame() {
    run = beginRun(params)
    afterAction()
  }
```

を以下に置き換える:

```ts
  const SPREAD_IDS: SpreadId[] = ['fool', 'moon']

  function handleStartWithSpread(spreadId: SpreadId) {
    run = beginRun(params, undefined, spreadId)
    afterAction()
  }
```

- [ ] **Step 3: タイトル画面の「はじめる」ボタンをスプレッド一覧に差し替える**

現在の内容:

```svelte
    <button
      onclick={startGame}
      class="px-10 py-3 rounded-full bg-yellow-400 text-emerald-950 font-black text-lg active:scale-95 transition-transform"
    >
      はじめる
    </button>
  </div>
```

を以下に置き換える:

```svelte
    <div class="flex flex-col gap-3 w-full max-w-xs">
      {#each SPREAD_IDS as spreadId (spreadId)}
        <button
          onclick={() => handleStartWithSpread(spreadId)}
          class="text-left bg-emerald-900/80 border border-yellow-500/40 rounded-xl px-4 py-3 active:scale-[0.98] transition-transform"
        >
          <div class="font-black text-yellow-300 text-lg">{params.spreads[spreadId].name}</div>
          <div class="text-xs text-emerald-100/80 mt-0.5">{params.spreads[spreadId].desc}</div>
        </button>
      {/each}
    </div>
  </div>
```

**注意:** 計測用ダミー(`measurementWave`)は`startWave(params, 0, 0, [], standardDeckComposition(), 1)`のまま変更しない(`extraTableauRows`引数を省略しデフォルトの0を使う。これはあくまで表示高さ測定用であり、スプレッドの選択とは無関係)。

- [ ] **Step 4: 常時表示エリア(`stageRow`)にスプレッド名を追加する**

現在の内容:

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
```

を以下に置き換える(ボス情報の前にスプレッド名を追加する):

```svelte
{#snippet stageRow()}
  <div class="flex items-center justify-between text-xs">
    <span class="flex items-center gap-2">
      <span class="text-emerald-200/90 font-bold">{params.spreads[run.spreadId].name}</span>
      <span class="flex gap-1">
        {#each [0, 1, 2] as w (w)}
          <span class="w-2 h-2 rounded-full {w < run.waveIndex ? 'bg-yellow-400' : w === run.waveIndex ? 'bg-yellow-400 animate-pulse' : 'bg-emerald-800'}"></span>
        {/each}
      </span>
    </span>
    {#if isBossWave(params, run.waveIndex)}
      <span class="font-black text-rose-400">{upcomingBossInfo.label}({upcomingBossInfo.detail})</span>
    {:else}
      <span class="text-emerald-300/80">次: {upcomingBossInfo.label}({upcomingBossInfo.detail})</span>
    {/if}
```

- [ ] **Step 5: 型チェックを実行する**

Run: `npm run check`
Expected: `+page.svelte`にエラーが無いこと(`src/routes/admin/shidasu/`配下のエラーはTask 4で解消するため許容する)

- [ ] **Step 6: コミット**

```bash
git add src/routes/game/shidasu/+page.svelte
git commit -m "feat: タイトル画面をスプレッド選択に差し替え、プレイ中の常時表示にスプレッド名を追加"
```

---

### Task 4: 管理画面の更新

**Files:**
- Create: `src/routes/admin/shidasu/SpreadsSection.svelte`
- Modify: `src/routes/admin/shidasu/BossTiersSection.svelte`
- Modify: `src/routes/admin/shidasu/+page.svelte`
- Modify: `src/routes/admin/shidasu/JsonPanel.svelte`

- [ ] **Step 1: `BossTiersSection.svelte`から目標スコア項目を削除する**

`src/routes/admin/shidasu/BossTiersSection.svelte`の現在の内容:

```svelte
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
```

を以下に置き換える(見出しを「ボス」に変更し、目標スコア関連のブロックを削除する):

```svelte
<section class="bg-white border border-slate-200 rounded-xl p-4">
  <h2 class="font-semibold text-slate-700 text-sm mb-3">ボス</h2>
  <div class="grid grid-cols-3 gap-3">
```

- [ ] **Step 2: `SpreadsSection.svelte`を新規作成する**

`src/routes/admin/shidasu/SpreadsSection.svelte`を新規作成:

```svelte
<script lang="ts">
  import type { ShidasuParams } from '$lib/game/shidasu/params'

  let { config }: { config: ShidasuParams } = $props()
</script>

<section class="bg-white border border-slate-200 rounded-xl p-4">
  <h2 class="font-semibold text-slate-700 text-sm mb-3">スプレッド(ラン選択)</h2>
  <div class="space-y-4">
    <div>
      <div class="text-xs font-bold text-slate-600 mb-2">愚者(fool)</div>
      <div class="grid grid-cols-2 gap-3">
        <label class="text-xs text-slate-500">
          名前
          <input type="text" bind:value={config.spreads.fool.name} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
        </label>
        <label class="text-xs text-slate-500">
          説明文
          <input type="text" bind:value={config.spreads.fool.desc} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
        </label>
        <label class="text-xs text-slate-500">
          初期行数オフセット(initialExtraTableauRows)
          <input type="number" step="1" bind:value={config.spreads.fool.initialExtraTableauRows} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
        </label>
        <label class="text-xs text-slate-500">
          目標スコア基礎値(waveTargetBase)
          <input type="number" min="1" step="1" bind:value={config.spreads.fool.waveTargetBase} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
        </label>
        <label class="text-xs text-slate-500">
          目標スコア倍率(waveTargetMultiplier)
          <input type="number" min="1" step="0.01" bind:value={config.spreads.fool.waveTargetMultiplier} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
        </label>
      </div>
    </div>
    <div>
      <div class="text-xs font-bold text-slate-600 mb-2">月(moon)</div>
      <div class="grid grid-cols-2 gap-3">
        <label class="text-xs text-slate-500">
          名前
          <input type="text" bind:value={config.spreads.moon.name} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
        </label>
        <label class="text-xs text-slate-500">
          説明文
          <input type="text" bind:value={config.spreads.moon.desc} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
        </label>
        <label class="text-xs text-slate-500">
          初期行数オフセット(initialExtraTableauRows)
          <input type="number" step="1" bind:value={config.spreads.moon.initialExtraTableauRows} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
        </label>
        <label class="text-xs text-slate-500">
          目標スコア基礎値(waveTargetBase)
          <input type="number" min="1" step="1" bind:value={config.spreads.moon.waveTargetBase} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
        </label>
        <label class="text-xs text-slate-500">
          目標スコア倍率(waveTargetMultiplier)
          <input type="number" min="1" step="0.01" bind:value={config.spreads.moon.waveTargetMultiplier} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
        </label>
      </div>
    </div>
  </div>
</section>
```

- [ ] **Step 3: `/admin/shidasu/+page.svelte`を更新する**

import文、現在の内容:

```ts
  import LayoutSection from './LayoutSection.svelte'
  import ItemsSection from './ItemsSection.svelte'
  import ScoringSection from './ScoringSection.svelte'
  import RoleBonusSection from './RoleBonusSection.svelte'
  import BossTiersSection from './BossTiersSection.svelte'
  import FlowUiSection from './FlowUiSection.svelte'
  import JsonPanel from './JsonPanel.svelte'
```

を以下に置き換える:

```ts
  import LayoutSection from './LayoutSection.svelte'
  import ItemsSection from './ItemsSection.svelte'
  import ScoringSection from './ScoringSection.svelte'
  import RoleBonusSection from './RoleBonusSection.svelte'
  import BossTiersSection from './BossTiersSection.svelte'
  import SpreadsSection from './SpreadsSection.svelte'
  import FlowUiSection from './FlowUiSection.svelte'
  import JsonPanel from './JsonPanel.svelte'
```

`hasValidationError`の現在の内容:

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

を以下に置き換える(`scoring.waveTargetBase/waveTargetMultiplier`のチェックを`spreads.fool`/`spreads.moon`それぞれのチェックに差し替える。**注意:** `config.layout.cols * config.layout.rows > 51`のチェックは、月スプレッドの`initialExtraTableauRows`が`-1`であっても配布行数の下限には影響しない(rows自体は変わらず、実際に配られる枚数だけが1行分減るため、山札が尽きるリスクはむしろ下がる方向であり、この既存チェックとは無関係。変更不要)):

```ts
  let hasValidationError = $derived.by(() => {
    if (!config) return false
    if (!Number.isFinite(config.spreads.fool.waveTargetBase) || config.spreads.fool.waveTargetBase <= 0) return true
    if (!Number.isFinite(config.spreads.fool.waveTargetMultiplier) || config.spreads.fool.waveTargetMultiplier <= 1) return true
    if (!Number.isFinite(config.spreads.moon.waveTargetBase) || config.spreads.moon.waveTargetBase <= 0) return true
    if (!Number.isFinite(config.spreads.moon.waveTargetMultiplier) || config.spreads.moon.waveTargetMultiplier <= 1) return true
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

テンプレート内、現在の内容:

```svelte
      <BossTiersSection {config} />

      <ItemsSection {config} />
```

を以下に置き換える:

```svelte
      <BossTiersSection {config} />

      <SpreadsSection {config} />

      <ItemsSection {config} />
```

- [ ] **Step 4: `JsonPanel.svelte`のバリデータに`spreads`のチェックを追加する**

現在の内容:

```ts
  function isValidShidasuParams(value: unknown): value is ShidasuParams {
    if (typeof value !== 'object' || value === null) return false
    const v = value as Record<string, unknown>
    const bossTiers = v.bossTiers as Record<string, unknown> | undefined
    const shoukyou = bossTiers?.shoukyou as Record<string, unknown> | undefined
    const chuukyou = bossTiers?.chuukyou as Record<string, unknown> | undefined
    const taikyou = bossTiers?.taikyou as Record<string, unknown> | undefined
    return (
      typeof v.layout === 'object' && v.layout !== null &&
      typeof v.scoring === 'object' && v.scoring !== null &&
      typeof v.bossTiers === 'object' && v.bossTiers !== null &&
      typeof shoukyou?.name === 'string' &&
      typeof chuukyou?.name === 'string' &&
      typeof chuukyou?.maxCombo === 'number' &&
      typeof taikyou?.name === 'string' &&
      typeof v.items === 'object' && v.items !== null &&
      typeof v.flow === 'object' && v.flow !== null &&
      typeof v.ui === 'object' && v.ui !== null &&
      typeof v.talismans === 'object' && v.talismans !== null
    )
  }

  function applyJson() {
    try {
      const parsed = JSON.parse(jsonText)
      if (!isValidShidasuParams(parsed)) {
        jsonError = '必須項目(layout/scoring/bossTiers/items/flow/ui)が不足しています'
        return
      }
      onApply(parsed)
      jsonError = null
    } catch {
      jsonError = 'JSONの形式が正しくありません'
    }
  }
```

を以下に置き換える(`spreads.fool`/`spreads.moon`の構造チェックを追加し、エラーメッセージも更新する):

```ts
  function isValidShidasuParams(value: unknown): value is ShidasuParams {
    if (typeof value !== 'object' || value === null) return false
    const v = value as Record<string, unknown>
    const bossTiers = v.bossTiers as Record<string, unknown> | undefined
    const shoukyou = bossTiers?.shoukyou as Record<string, unknown> | undefined
    const chuukyou = bossTiers?.chuukyou as Record<string, unknown> | undefined
    const taikyou = bossTiers?.taikyou as Record<string, unknown> | undefined
    const spreads = v.spreads as Record<string, unknown> | undefined
    const fool = spreads?.fool as Record<string, unknown> | undefined
    const moon = spreads?.moon as Record<string, unknown> | undefined
    return (
      typeof v.layout === 'object' && v.layout !== null &&
      typeof v.scoring === 'object' && v.scoring !== null &&
      typeof v.bossTiers === 'object' && v.bossTiers !== null &&
      typeof shoukyou?.name === 'string' &&
      typeof chuukyou?.name === 'string' &&
      typeof chuukyou?.maxCombo === 'number' &&
      typeof taikyou?.name === 'string' &&
      typeof v.spreads === 'object' && v.spreads !== null &&
      typeof fool?.name === 'string' &&
      typeof fool?.initialExtraTableauRows === 'number' &&
      typeof fool?.waveTargetBase === 'number' &&
      typeof fool?.waveTargetMultiplier === 'number' &&
      typeof moon?.name === 'string' &&
      typeof moon?.initialExtraTableauRows === 'number' &&
      typeof moon?.waveTargetBase === 'number' &&
      typeof moon?.waveTargetMultiplier === 'number' &&
      typeof v.items === 'object' && v.items !== null &&
      typeof v.flow === 'object' && v.flow !== null &&
      typeof v.ui === 'object' && v.ui !== null &&
      typeof v.talismans === 'object' && v.talismans !== null
    )
  }

  function applyJson() {
    try {
      const parsed = JSON.parse(jsonText)
      if (!isValidShidasuParams(parsed)) {
        jsonError = '必須項目(layout/scoring/bossTiers/spreads/items/flow/ui)が不足しています'
        return
      }
      onApply(parsed)
      jsonError = null
    } catch {
      jsonError = 'JSONの形式が正しくありません'
    }
  }
```

- [ ] **Step 5: 型チェック・ビルドを実行する**

Run: `npm run check`
Expected: shidasu関連ファイルにエラー無し

Run: `npm run build`
Expected: 成功

- [ ] **Step 6: コミット**

```bash
git add src/routes/admin/shidasu/SpreadsSection.svelte src/routes/admin/shidasu/BossTiersSection.svelte src/routes/admin/shidasu/+page.svelte src/routes/admin/shidasu/JsonPanel.svelte
git commit -m "feat: 管理画面にスプレッド設定セクションを追加"
```

---

### Task 5: 最終確認・ブラウザ動作確認

**Files:** (テスト・動作確認のみ、コード変更なし)

- [ ] **Step 1: 全体テスト・型チェック・ビルドを実行する**

Run: `npm run test` — Expected: 全件PASS
Run: `npm run check` — Expected: shidasu関連ファイルにエラー無し
Run: `npm run build` — Expected: 成功

- [ ] **Step 2: `npm run dev`でブラウザ動作確認する**

`npm run dev`で開発サーバーを起動し、`/game/shidasu`を開いて以下を確認する:

1. タイトル画面に「愚者」「月」の2つのスプレッドがカード形式で表示され、それぞれに説明文が表示される
2. 「愚者」を選ぶと、通常通り(場札5行)でゲームが開始される
3. 常時表示エリアの先頭に「愚者」という表示が出る
4. タイトルに戻り、「月」を選ぶと、場札が4行(通常より1行少ない)で配られる
5. 常時表示エリアの先頭に「月」という表示が出る
6. 「月」のランで暗雲護符を獲得した場合、通常(愚者)と同じ加算量だけ行数が増えることを確認する(愚者で暗雲を持ったときの行数から1引いた行数になる)
7. ゲームオーバー・結果画面から「タイトルへ戻る」を押すと、再びスプレッド選択画面(愚者・月)が表示される
8. コンソールエラーが出ていないことを確認する

- [ ] **Step 3: `/admin/shidasu`の動作確認**

`/admin/shidasu`を開き、「スプレッド(ラン選択)」セクションが表示され、愚者・月それぞれの名前・説明文・初期行数オフセット・目標スコア基礎値/倍率を編集できることを確認する。「ボス」セクションから目標スコアの項目が消えていることを確認する。

- [ ] **Step 4: 問題があれば修正し、再度Step 1〜3を実行する**

- [ ] **Step 5: 最終コミット(修正があった場合のみ)**

```bash
git add -A
git commit -m "fix: スプレッド選択機能のブラウザ動作確認で見つかった問題を修正"
```
