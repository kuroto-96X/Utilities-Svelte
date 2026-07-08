# Culmen スコア計算再設計 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 登頂ソリティア -Culmen- のスコア計算を再設計する。コンボ倍率のstep化、点数系パラメータの10倍スケーリング、パターンボーナスの「コンボ開始からの一貫性」判定への変更、山札めくりでの新コンボ継続ルール、全消しボーナスの残り山札連動、役ボーナス(フラッシュ・ロイヤルセット・同ランク・コンプリートラン・列一掃)という新スコア軸を追加する。

**Architecture:** `wave.chain`(コンボ中に取った札の履歴)を都度解析する純粋関数群(`analyzeSuitColor`・`analyzeStair`・役判定関数群)を`engine.ts`に追加し、`playCard`/`drawStock`をそれらを使う形に書き換える。`WaveState`から個別インクリメンタルなフラグ(`stairDir`/`stairLen`)を削除し、チェーン履歴からの都度導出に統一する。新たに列一掃カウントと、山札めくりでの特殊演出フラグをWaveStateに追加する。

**Tech Stack:** SvelteKit(Svelte 5 runes) / TypeScript / Vitest / Tailwind CSS

**Spec:** `docs/superpowers/specs/2026-07-08-culmen-scoring-redesign-design.md`

---

## 事前確認

- [ ] **Step 1: 作業ブランチを確認する**

```bash
git branch --show-current
```

Expected: `feat`(または `feat-*`)。

---

### Task 1: 型定義とパラメータの変更(WaveState・params・config)

**Files:**
- Modify: `src/lib/game/culmen/types.ts`
- Modify: `src/lib/game/culmen/params.ts`
- Modify: `src/lib/game/culmen/culmen.config.json`
- Modify: `src/lib/game/culmen/params.test.ts`

- [ ] **Step 1: `types.ts` の `WaveState` を変更する**

`src/lib/game/culmen/types.ts` の `WaveState` インターフェースを以下に置き換える(`stairDir`/`stairLen` を削除し、`columnsEmptiedThisCombo`・`lastDrawEffect` を追加):

```ts
export type DrawEffect = 'wild' | 'shield' | 'pattern' | null

export interface WaveState {
  tableau: Card[][]
  stock: Card[]
  foundation: Card
  score: number
  combo: number
  shieldLeft: number
  chain: Card[]
  linked: boolean
  columnsEmptiedThisCombo: number
  lastDrawEffect: DrawEffect
  status: WaveStatus
  endReason: WaveEndReason
  lastGain: ScoreGain | null
}
```

ファイル全体は以下のようになる(`Suit`/`Rank`/`StageModifier`/`ItemId`/`Card`/`ScoreGain`/`WaveStatus`/`WaveEndReason`/`RunPhase`/`RunState` は変更しない):

```ts
// src/lib/game/culmen/types.ts
export type Suit = '♠' | '♥' | '♦' | '♣' | '★'
export type Rank = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13
export type StageModifier = 'none' | 'noLoop' | 'faceLock'
export type ItemId = 'red5' | 'face10' | 'shield' | 'stock5' | 'wild1' | 'start1' | 'clear300'

export interface Card {
  id: number
  suit: Suit
  rank: Rank
  wild: boolean
}

export interface ScoreGain {
  points: number
  parts: string[]
}

export type WaveStatus = 'playing' | 'ended'
export type WaveEndReason = 'target' | 'fullClear' | 'stuck' | null
export type DrawEffect = 'wild' | 'shield' | 'pattern' | null

export interface WaveState {
  tableau: Card[][]
  stock: Card[]
  foundation: Card
  score: number
  combo: number
  shieldLeft: number
  chain: Card[]
  linked: boolean
  columnsEmptiedThisCombo: number
  lastDrawEffect: DrawEffect
  status: WaveStatus
  endReason: WaveEndReason
  lastGain: ScoreGain | null
}

export type RunPhase = 'title' | 'playing' | 'itemSelect' | 'stageClear' | 'allClear' | 'gameOver'

export interface RunState {
  phase: RunPhase
  stageIndex: number
  waveIndex: number
  items: ItemId[]
  offer: ItemId[]
  wave: WaveState | null
}
```

- [ ] **Step 2: `culmen.config.json` を新しい既定値に書き換える**

```json
{
  "layout": { "cols": 7, "rows": 5 },
  "scoring": {
    "basePoint": 100,
    "suitBonus": 100,
    "colorBonus": 50,
    "stairBonus": 150,
    "stairMinLen": 3,
    "wildSuitBonus": 100,
    "clearBonus": 2000,
    "clearBonusPerStock": 50,
    "comboMultiplierStep": 0.1,
    "flushBonus": 300,
    "royalSetBonus": 400,
    "sameRankBonusUnit": 100,
    "completeRunBonus": 1000,
    "completeRunSuitBonus": 1000,
    "columnSweepBonus": 150
  },
  "stages": [
    { "name": "STAGE 1", "modifier": "none", "targets": [4000, 7500, 13000] },
    { "name": "STAGE 2", "modifier": "noLoop", "targets": [6000, 11000, 19000] },
    { "name": "STAGE 3", "modifier": "faceLock", "targets": [8000, 15000, 26000] }
  ],
  "items": {
    "redBonusValue": 50,
    "faceBonusValue": 100,
    "shieldChargesPerPick": 1,
    "extraStockCount": 5,
    "wildPerPick": 1,
    "startCombo": 1,
    "fullClearItemBonus": 3000
  },
  "flow": { "wavesPerStage": 3, "clearDelayMs": 450 },
  "ui": { "comboTierThresholds": [3, 5, 8] }
}
```

- [ ] **Step 3: 失敗するテストを書く(既存 `params.test.ts` の該当箇所を更新)**

`src/lib/game/culmen/params.test.ts` を以下に置き換える:

```ts
import { describe, test, expect } from 'vitest'
import { DEFAULT_PARAMS, loadParams } from './params'
import culmenConfigJson from './culmen.config.json'

describe('DEFAULT_PARAMS', () => {
  test('レイアウトは7列5段', () => {
    expect(DEFAULT_PARAMS.layout).toEqual({ cols: 7, rows: 5 })
  })

  test('ステージが3つ、modifierが none/noLoop/faceLock の順で定義されている', () => {
    expect(DEFAULT_PARAMS.stages).toHaveLength(3)
    expect(DEFAULT_PARAMS.stages.map(s => s.modifier)).toEqual(['none', 'noLoop', 'faceLock'])
  })

  test('ui.comboTierThresholds は [3, 5, 8]', () => {
    expect(DEFAULT_PARAMS.ui.comboTierThresholds).toEqual([3, 5, 8])
  })

  test('点数系パラメータは10の倍数になっている', () => {
    const s = DEFAULT_PARAMS.scoring
    expect(s.basePoint % 10).toBe(0)
    expect(s.suitBonus % 10).toBe(0)
    expect(s.colorBonus % 10).toBe(0)
    expect(s.stairBonus % 10).toBe(0)
    expect(s.wildSuitBonus % 10).toBe(0)
    expect(s.clearBonus % 10).toBe(0)
    expect(s.clearBonusPerStock % 10).toBe(0)
    expect(s.flushBonus % 10).toBe(0)
    expect(s.royalSetBonus % 10).toBe(0)
    expect(s.sameRankBonusUnit % 10).toBe(0)
    expect(s.completeRunBonus % 10).toBe(0)
    expect(s.completeRunSuitBonus % 10).toBe(0)
    expect(s.columnSweepBonus % 10).toBe(0)
    expect(DEFAULT_PARAMS.items.redBonusValue % 10).toBe(0)
    expect(DEFAULT_PARAMS.items.faceBonusValue % 10).toBe(0)
    expect(DEFAULT_PARAMS.items.fullClearItemBonus % 10).toBe(0)
    DEFAULT_PARAMS.stages.forEach(stage => {
      stage.targets.forEach(t => expect(t % 10).toBe(0))
    })
  })

  test('comboMultiplierStepは0.1', () => {
    expect(DEFAULT_PARAMS.scoring.comboMultiplierStep).toBe(0.1)
  })
})

describe('loadParams', () => {
  test('culmen.config.json の内容をそのまま返す', () => {
    expect(loadParams()).toEqual(culmenConfigJson)
  })

  test('既定値と一致する(config.json が未編集の場合)', () => {
    expect(loadParams()).toEqual(DEFAULT_PARAMS)
  })
})
```

- [ ] **Step 4: テストが失敗することを確認する**

Run: `npx vitest run src/lib/game/culmen/params.test.ts`
Expected: FAIL(`CulmenParams` にまだ新フィールドが無いため型上・値上不一致)

- [ ] **Step 5: `params.ts` を新しい型・既定値に書き換える**

```ts
// src/lib/game/culmen/params.ts
import culmenConfigJson from './culmen.config.json'
import type { StageModifier } from './types'

export interface CulmenParams {
  layout: {
    cols: number
    rows: number
  }
  scoring: {
    basePoint: number
    suitBonus: number
    colorBonus: number
    stairBonus: number
    stairMinLen: number
    wildSuitBonus: number
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
  items: {
    redBonusValue: number
    faceBonusValue: number
    shieldChargesPerPick: number
    extraStockCount: number
    wildPerPick: number
    startCombo: number
    fullClearItemBonus: number
  }
  flow: {
    wavesPerStage: number
    clearDelayMs: number
  }
  ui: {
    comboTierThresholds: [number, number, number]
  }
}

export const DEFAULT_PARAMS: CulmenParams = {
  layout: { cols: 7, rows: 5 },
  scoring: {
    basePoint: 100,
    suitBonus: 100,
    colorBonus: 50,
    stairBonus: 150,
    stairMinLen: 3,
    wildSuitBonus: 100,
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
  items: {
    redBonusValue: 50,
    faceBonusValue: 100,
    shieldChargesPerPick: 1,
    extraStockCount: 5,
    wildPerPick: 1,
    startCombo: 1,
    fullClearItemBonus: 3000,
  },
  flow: { wavesPerStage: 3, clearDelayMs: 450 },
  ui: { comboTierThresholds: [3, 5, 8] },
}

export function loadParams(): CulmenParams {
  return culmenConfigJson as CulmenParams
}
```

- [ ] **Step 6: テストが通ることを確認する**

Run: `npx vitest run src/lib/game/culmen/params.test.ts`
Expected: PASS(全テスト)

- [ ] **Step 7: コミット**

```bash
git add src/lib/game/culmen/types.ts src/lib/game/culmen/params.ts src/lib/game/culmen/culmen.config.json src/lib/game/culmen/params.test.ts
git commit -m "feat: Culmenの型定義・パラメータを再設計に合わせて変更"
```

## Context

このタスクは今後の全タスクの土台になる。`engine.ts`/`engine.test.ts`はこの時点でまだ古い`stairDir`/`stairLen`を参照しているため型エラーが出る状態になるが、Task 2〜7で順次書き換えるため一時的に許容する(`npm run test`はvitestがesbuildでトランスパイルするだけなので、この時点でも実行は通る可能性が高いが、型エラー自体はTask 7完了後に`npm run check`でまとめて確認する)。

You are on the `feat` git branch already (confirm with `git branch --show-current`). Work directly in the repo at c:\Users\the-f\Documents\ClaudeProjects\Utilities-Svelte. Commit messages should be in Japanese.

---

### Task 2: エンジン — チェーン解析ヘルパー(同スート・同色・階段)

**Files:**
- Modify: `src/lib/game/culmen/engine.ts`
- Modify: `src/lib/game/culmen/engine.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`engine.test.ts` の末尾に追記(既存の `evaluatePattern` describe ブロックはこのタスクではまだ削除しない。Task 5で削除する):

```ts
import { analyzeSuitColor, analyzeStair } from './engine'

describe('analyzeSuitColor', () => {
  test('空のチェーンは両方true', () => {
    expect(analyzeSuitColor([])).toEqual({ suitHeld: true, colorHeld: true })
  })

  test('実カード1枚だけなら両方true', () => {
    expect(analyzeSuitColor([card(1, '♠', 5)])).toEqual({ suitHeld: true, colorHeld: true })
  })

  test('全て同じスートならsuitHeld/colorHeldともtrue', () => {
    const chain = [card(1, '♠', 5), card(2, '♠', 6), card(3, '♠', 7)]
    expect(analyzeSuitColor(chain)).toEqual({ suitHeld: true, colorHeld: true })
  })

  test('スートは違うが同色ならcolorHeldのみtrue', () => {
    const chain = [card(1, '♥', 5), card(2, '♦', 6), card(3, '♥', 7)]
    expect(analyzeSuitColor(chain)).toEqual({ suitHeld: false, colorHeld: true })
  })

  test('色も違う札が混ざるとcolorHeldもfalse', () => {
    const chain = [card(1, '♥', 5), card(2, '♠', 6)]
    expect(analyzeSuitColor(chain)).toEqual({ suitHeld: false, colorHeld: false })
  })

  test('一度崩れたら後で同じスートに戻ってもtrueには戻らない', () => {
    const chain = [card(1, '♠', 5), card(2, '♥', 6), card(3, '♠', 7)]
    expect(analyzeSuitColor(chain).suitHeld).toBe(false)
  })

  test('ワイルドは無視して実カードのみで判定する', () => {
    const chain = [card(1, '♠', 5), card(2, '★', 0, true), card(3, '♠', 9)]
    expect(analyzeSuitColor(chain)).toEqual({ suitHeld: true, colorHeld: true })
  })
})

describe('analyzeStair', () => {
  test('空のチェーンはheld:true, dir:0, len:1', () => {
    expect(analyzeStair([])).toEqual({ held: true, dir: 0, len: 1 })
  })

  test('実カード1枚だけならheld:true, dir:0, len:1', () => {
    expect(analyzeStair([card(1, '♠', 5)])).toEqual({ held: true, dir: 0, len: 1 })
  })

  test('5→6→7で方向+1・長さ3が保持される', () => {
    const chain = [card(1, '♠', 5), card(2, '♣', 6), card(3, '♦', 7)]
    expect(analyzeStair(chain)).toEqual({ held: true, dir: 1, len: 3 })
  })

  test('5→6→5は方向反転でheld:falseになり、その後は復活しない', () => {
    const chain = [card(1, '♠', 5), card(2, '♣', 6), card(3, '♦', 5), card(4, '♣', 6)]
    expect(analyzeStair(chain).held).toBe(false)
  })

  test('差が±1でない場合はheld:false', () => {
    const chain = [card(1, '♠', 5), card(2, '♣', 8)]
    expect(analyzeStair(chain)).toEqual({ held: false, dir: 0, len: 1 })
  })

  test('K→A→2はループ跨ぎで継続する', () => {
    const chain = [card(1, '♠', 13), card(2, '♣', 1), card(3, '♦', 2)]
    expect(analyzeStair(chain)).toEqual({ held: true, dir: 1, len: 3 })
  })

  test('方向確立前にワイルドが来ても継続扱いにはならない(まだheld/未確立のまま)', () => {
    const chain = [card(1, '♠', 5), card(2, '★', 0, true), card(3, '♣', 9)]
    expect(analyzeStair(chain)).toEqual({ held: true, dir: 0, len: 1 })
  })

  test('方向確立後のワイルドは実際の差を問わず長さ+1で延長する', () => {
    const chain = [card(1, '♠', 5), card(2, '♣', 6), card(3, '★', 0, true), card(4, '♦', 9)]
    // 5→6で dir=1,len=2。ワイルドを挟んで9が来ても無条件でlen+1=3
    expect(analyzeStair(chain)).toEqual({ held: true, dir: 1, len: 3 })
  })
})
```

- [ ] **Step 2: テストが失敗することを確認する**

Run: `npx vitest run src/lib/game/culmen/engine.test.ts`
Expected: FAIL(`analyzeSuitColor`/`analyzeStair` が存在しない)

- [ ] **Step 3: 実装を追記する**

`engine.ts` の末尾(既存コードの後ろ)に追記する:

```ts
export interface SuitColorAnalysis {
  suitHeld: boolean
  colorHeld: boolean
}

export function analyzeSuitColor(chain: Card[]): SuitColorAnalysis {
  const realCards = chain.filter(c => !c.wild)
  if (realCards.length === 0) return { suitHeld: true, colorHeld: true }
  const first = realCards[0]
  return {
    suitHeld: realCards.every(c => c.suit === first.suit),
    colorHeld: realCards.every(c => isRed(c) === isRed(first)),
  }
}

export interface StairAnalysis {
  held: boolean
  dir: -1 | 0 | 1
  len: number
}

export function analyzeStair(chain: Card[]): StairAnalysis {
  let dir: -1 | 0 | 1 = 0
  let len = 1
  let prevReal: Card | null = null
  let justHadWild = false

  for (const c of chain) {
    if (c.wild) {
      justHadWild = true
      continue
    }
    if (prevReal === null) {
      prevReal = c
      continue
    }
    if (justHadWild) {
      if (dir !== 0) len += 1
      justHadWild = false
      prevReal = c
      continue
    }
    let d = c.rank - prevReal.rank
    if (d === 12) d = -1
    if (d === -12) d = 1
    if (Math.abs(d) !== 1) {
      return { held: false, dir: 0, len: 1 }
    }
    if (dir === 0) {
      dir = d as -1 | 1
      len = 2
    } else if (d === dir) {
      len += 1
    } else {
      return { held: false, dir: 0, len: 1 }
    }
    prevReal = c
  }
  return { held: true, dir, len }
}
```

- [ ] **Step 4: テストが通ることを確認する**

Run: `npx vitest run src/lib/game/culmen/engine.test.ts`
Expected: PASS(全テスト。既存の`evaluatePattern`テストもまだ残っているので合わせてPASSすること)

- [ ] **Step 5: コミット**

```bash
git add src/lib/game/culmen/engine.ts src/lib/game/culmen/engine.test.ts
git commit -m "feat: Culmenのチェーン解析ヘルパー(同スート・同色・階段)を追加"
```

## Context

このタスクは新しい純粋関数を追加するだけで、既存の`evaluatePattern`/`playCard`/`drawStock`はまだ変更しない(Task 5・6で置き換える)。`card`ヘルパーは既存の`engine.test.ts`に既に定義されている。

---

### Task 3: エンジン — 役ボーナス判定ヘルパー

**Files:**
- Modify: `src/lib/game/culmen/engine.ts`
- Modify: `src/lib/game/culmen/engine.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`engine.test.ts` の末尾に追記:

```ts
import { checkFlush, checkRoyalSet, countSameRankBefore, checkCompleteRun } from './engine'

describe('checkFlush', () => {
  test('直近4枚が4スート全部なら成立(順不同)', () => {
    const cards = [card(1, '♦', 3), card(2, '♠', 5), card(3, '♣', 9), card(4, '♥', 2)]
    expect(checkFlush(cards)).toBe(true)
  })

  test('4枚未満なら不成立', () => {
    expect(checkFlush([card(1, '♠', 5), card(2, '♥', 6), card(3, '♦', 7)])).toBe(false)
  })

  test('直近4枚にスートの重複があれば不成立', () => {
    const cards = [card(1, '♠', 3), card(2, '♠', 5), card(3, '♣', 9), card(4, '♥', 2)]
    expect(checkFlush(cards)).toBe(false)
  })

  test('5枚以上でも直近4枚だけで判定する', () => {
    const cards = [card(1, '♠', 1), card(2, '♠', 2), card(3, '♦', 3), card(4, '♠', 5), card(5, '♥', 9), card(6, '♣', 2)]
    // 直近4枚(3,4,5,6番目)が♦♠♥♣で揃っている
    expect(checkFlush(cards)).toBe(true)
  })
})

describe('checkRoyalSet', () => {
  test('直近3枚がJ・Q・K全部なら成立(順不同)', () => {
    const cards = [card(1, '♠', 13), card(2, '♥', 11), card(3, '♦', 12)]
    expect(checkRoyalSet(cards)).toBe(true)
  })

  test('3枚未満なら不成立', () => {
    expect(checkRoyalSet([card(1, '♠', 11), card(2, '♥', 12)])).toBe(false)
  })

  test('J/Q/K以外が混ざれば不成立', () => {
    const cards = [card(1, '♠', 13), card(2, '♥', 11), card(3, '♦', 5)]
    expect(checkRoyalSet(cards)).toBe(false)
  })
})

describe('countSameRankBefore', () => {
  test('同ランクが無ければ0', () => {
    expect(countSameRankBefore([card(1, '♠', 5), card(2, '♥', 6)], 7)).toBe(0)
  })

  test('同ランクが2枚あれば2を返す', () => {
    const cards = [card(1, '♠', 5), card(2, '♥', 5), card(3, '♦', 5)]
    expect(countSameRankBefore(cards, 5)).toBe(3)
  })
})

describe('checkCompleteRun', () => {
  test('13ランク揃う直前(12種)ではfalse', () => {
    const before = Array.from({ length: 12 }, (_, i) => card(i + 1, '♠', (i + 1) as Card['rank']))
    const now = [...before, card(13, '♥', 13)]
    // beforeは1〜12(12種)、nowで13が追加され13種になる想定を後続テストで検証
    expect(checkCompleteRun(before.slice(0, 11), before)).toBe(false)
  })

  test('13種類目が揃った瞬間にtrue', () => {
    const before = Array.from({ length: 12 }, (_, i) => card(i + 1, '♠', (i + 1) as Card['rank']))
    const now = [...before, card(13, '♥', 13)]
    expect(checkCompleteRun(before, now)).toBe(true)
  })

  test('既に13種揃った後に重複が増えても再度trueにはならない(呼び出し側でbefore/nowの差分を見る想定)', () => {
    const all13 = Array.from({ length: 13 }, (_, i) => card(i + 1, '♠', (i + 1) as Card['rank']))
    const withDup = [...all13, card(14, '♥', 5)]
    expect(checkCompleteRun(all13, withDup)).toBe(false)
  })
})
```

- [ ] **Step 2: テストが失敗することを確認する**

Run: `npx vitest run src/lib/game/culmen/engine.test.ts`
Expected: FAIL(該当関数が存在しない)

- [ ] **Step 3: 実装を追記する**

```ts
const ALL_SUITS_REAL: Suit[] = ['♠', '♥', '♦', '♣']

export function checkFlush(realCardsIncludingThis: Card[]): boolean {
  if (realCardsIncludingThis.length < 4) return false
  const last4 = realCardsIncludingThis.slice(-4)
  const suitsPresent = new Set(last4.map(c => c.suit))
  return ALL_SUITS_REAL.every(s => suitsPresent.has(s))
}

export function checkRoyalSet(realCardsIncludingThis: Card[]): boolean {
  if (realCardsIncludingThis.length < 3) return false
  const last3 = realCardsIncludingThis.slice(-3)
  const ranksPresent = new Set(last3.map(c => c.rank))
  return ranksPresent.has(11) && ranksPresent.has(12) && ranksPresent.has(13)
}

export function countSameRankBefore(realCardsBefore: Card[], rank: Card['rank']): number {
  return realCardsBefore.filter(c => c.rank === rank).length
}

export function checkCompleteRun(realCardsBefore: Card[], realCardsIncludingThis: Card[]): boolean {
  const distinctBefore = new Set(realCardsBefore.map(c => c.rank)).size
  const distinctNow = new Set(realCardsIncludingThis.map(c => c.rank)).size
  return distinctBefore < 13 && distinctNow >= 13
}
```

`Suit` 型は既に `import type { Card, StageModifier, WaveState, ItemId, WaveEndReason, RunState } from './types'` に含まれていないため、この行を `import type { Card, StageModifier, WaveState, ItemId, WaveEndReason, RunState, Suit } from './types'` に変更すること。

- [ ] **Step 4: テストが通ることを確認する**

Run: `npx vitest run src/lib/game/culmen/engine.test.ts`
Expected: PASS(全テスト)

- [ ] **Step 5: コミット**

```bash
git add src/lib/game/culmen/engine.ts src/lib/game/culmen/engine.test.ts
git commit -m "feat: Culmenの役ボーナス判定ヘルパー(フラッシュ・ロイヤル・同ランク・コンプリートラン)を追加"
```

---

### Task 4: エンジン — チェーン全体のボーナス統合(evaluateChainBonus)

**Files:**
- Modify: `src/lib/game/culmen/engine.ts`
- Modify: `src/lib/game/culmen/engine.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`engine.test.ts` の末尾に追記:

```ts
import { evaluateChainBonus } from './engine'

describe('evaluateChainBonus', () => {
  const scoring = DEFAULT_PARAMS.scoring

  test('コンボ1枚目(chainBefore空)はボーナス0', () => {
    const result = evaluateChainBonus(scoring, [], card(1, '♠', 5))
    expect(result).toEqual({ bonus: 0, parts: [] })
  })

  test('同スートが継続していればsuitBonusが付く', () => {
    const chainBefore = [card(1, '♠', 5)]
    const result = evaluateChainBonus(scoring, chainBefore, card(2, '♠', 6))
    expect(result.bonus).toBe(scoring.suitBonus)
    expect(result.parts).toEqual([`同スート+${scoring.suitBonus}`])
  })

  test('コンボ中に一度スートが崩れたら、以降同スートが来てもsuitBonusは付かない', () => {
    const chainBefore = [card(1, '♠', 5), card(2, '♥', 6)] // 既にスート崩れ済み
    const result = evaluateChainBonus(scoring, chainBefore, card(3, '♠', 7))
    expect(result.parts.some(p => p.startsWith('同スート'))).toBe(false)
  })

  test('ワイルド直後はwildSuitBonusのみ(同スート・同色は付かない)', () => {
    const chainBefore = [card(1, '★', 0, true)]
    const result = evaluateChainBonus(scoring, chainBefore, card(2, '♠', 9))
    expect(result.bonus).toBe(scoring.wildSuitBonus)
    expect(result.parts).toEqual([`★同スート+${scoring.wildSuitBonus}`])
  })

  test('階段が一貫して続いていればstairMinLen以上でstairBonusが付く', () => {
    const chainBefore = [card(1, '♠', 5), card(2, '♣', 6)]
    const result = evaluateChainBonus(scoring, chainBefore, card(3, '♦', 7))
    expect(result.parts).toContain(`階段3 +${scoring.stairBonus}`)
  })

  test('直近4枚で4スート揃うとflushBonusが付く', () => {
    const chainBefore = [card(1, '♦', 3), card(2, '♠', 5), card(3, '♣', 9)]
    const result = evaluateChainBonus(scoring, chainBefore, card(4, '♥', 2))
    expect(result.parts).toContain(`フラッシュ+${scoring.flushBonus}`)
  })

  test('直近3枚でJQK揃うとroyalSetBonusが付く', () => {
    const chainBefore = [card(1, '♠', 13), card(2, '♥', 11)]
    const result = evaluateChainBonus(scoring, chainBefore, card(3, '♦', 12))
    expect(result.parts).toContain(`ロイヤル+${scoring.royalSetBonus}`)
  })

  test('同ランクが既に2枚あれば sameRankBonusUnit×2 が付く', () => {
    const chainBefore = [card(1, '♠', 5), card(2, '♥', 5)]
    const result = evaluateChainBonus(scoring, chainBefore, card(3, '♦', 5))
    expect(result.parts).toContain(`同ランク+${scoring.sameRankBonusUnit * 2}`)
  })

  test('13ランクが揃った瞬間にcompleteRunBonusが付く(同スートでなければ追加ボーナスなし)', () => {
    const chainBefore = Array.from({ length: 12 }, (_, i) => card(i + 1, i % 2 === 0 ? '♠' : '♥', (i + 1) as Card['rank']))
    const result = evaluateChainBonus(scoring, chainBefore, card(13, '♦', 13))
    expect(result.parts).toContain(`コンプリートラン+${scoring.completeRunBonus}`)
    expect(result.parts.some(p => p.includes('コンプリートラン(同スート)'))).toBe(false)
  })

  test('13ランクが全て同じスートで揃うとcompleteRunSuitBonusも追加で付く', () => {
    const chainBefore = Array.from({ length: 12 }, (_, i) => card(i + 1, '♠', (i + 1) as Card['rank']))
    const result = evaluateChainBonus(scoring, chainBefore, card(13, '♠', 13))
    expect(result.parts).toContain(`コンプリートラン+${scoring.completeRunBonus}`)
    expect(result.parts).toContain(`コンプリートラン(同スート)+${scoring.completeRunSuitBonus}`)
  })
})
```

- [ ] **Step 2: テストが失敗することを確認する**

Run: `npx vitest run src/lib/game/culmen/engine.test.ts`
Expected: FAIL(`evaluateChainBonus` が存在しない)

- [ ] **Step 3: 実装を追記する**

```ts
export interface ChainBonusResult {
  bonus: number
  parts: string[]
}

export function evaluateChainBonus(
  scoring: CulmenParams['scoring'],
  chainBefore: Card[],
  card: Card
): ChainBonusResult {
  if (chainBefore.length === 0) {
    return { bonus: 0, parts: [] }
  }

  let bonus = 0
  const parts: string[] = []

  const prevIsWild = chainBefore[chainBefore.length - 1].wild
  const realBefore = chainBefore.filter(c => !c.wild)
  const chainIncludingThis = [...chainBefore, card]
  const realIncludingThis = [...realBefore, card]

  if (prevIsWild) {
    bonus += scoring.wildSuitBonus
    parts.push(`★同スート+${scoring.wildSuitBonus}`)
  } else {
    const { suitHeld, colorHeld } = analyzeSuitColor(chainIncludingThis)
    if (suitHeld) {
      bonus += scoring.suitBonus
      parts.push(`同スート+${scoring.suitBonus}`)
    } else if (colorHeld) {
      bonus += scoring.colorBonus
      parts.push(`同色+${scoring.colorBonus}`)
    }
  }

  const stairInfo = analyzeStair(chainIncludingThis)
  if (stairInfo.held && stairInfo.len >= scoring.stairMinLen) {
    bonus += scoring.stairBonus
    parts.push(`階段${stairInfo.len} +${scoring.stairBonus}`)
  }

  if (checkFlush(realIncludingThis)) {
    bonus += scoring.flushBonus
    parts.push(`フラッシュ+${scoring.flushBonus}`)
  }

  if (checkRoyalSet(realIncludingThis)) {
    bonus += scoring.royalSetBonus
    parts.push(`ロイヤル+${scoring.royalSetBonus}`)
  }

  const sameRankCount = countSameRankBefore(realBefore, card.rank)
  if (sameRankCount > 0) {
    const sameRankGain = scoring.sameRankBonusUnit * sameRankCount
    bonus += sameRankGain
    parts.push(`同ランク+${sameRankGain}`)
  }

  if (checkCompleteRun(realBefore, realIncludingThis)) {
    bonus += scoring.completeRunBonus
    parts.push(`コンプリートラン+${scoring.completeRunBonus}`)
    if (analyzeSuitColor(realIncludingThis).suitHeld) {
      bonus += scoring.completeRunSuitBonus
      parts.push(`コンプリートラン(同スート)+${scoring.completeRunSuitBonus}`)
    }
  }

  return { bonus, parts }
}
```

`CulmenParams` 型を使うため、`import type { CulmenParams } from './params'` が既にファイル冒頭にあることを確認する(Task 1時点で既存のはず)。

- [ ] **Step 4: テストが通ることを確認する**

Run: `npx vitest run src/lib/game/culmen/engine.test.ts`
Expected: PASS(全テスト)

- [ ] **Step 5: コミット**

```bash
git add src/lib/game/culmen/engine.ts src/lib/game/culmen/engine.test.ts
git commit -m "feat: Culmenのチェーン全体ボーナス統合関数(evaluateChainBonus)を追加"
```

---

### Task 5: エンジン — playCardの書き換え(新コンボ倍率・チェーンボーナス統合・列一掃・全消し連動)

**Files:**
- Modify: `src/lib/game/culmen/engine.ts`
- Modify: `src/lib/game/culmen/engine.test.ts`

- [ ] **Step 1: 既存の古いテスト・実装を削除する**

`engine.test.ts` から以下を**削除**する:
- `describe('evaluatePattern', ...)` ブロック全体(64〜141行目付近、Task開始前の内容)
- `describe('playCard', ...)` ブロック全体(既存の古い期待値のテスト)
- `makeWave` 関数定義内の `stairDir: 0, stairLen: 1,` の2行(型が変わったため削除し、代わりに `columnsEmptiedThisCombo: 0, lastDrawEffect: null,` を追加)

`engine.ts` から以下を**削除**する:
- `export interface PatternResult { ... }`
- `export function evaluatePattern(...) { ... }`(Task 4の`evaluateChainBonus`に置き換わるため)

`makeWave` は以下のようになる:

```ts
function makeWave(overrides: Partial<WaveState> = {}): WaveState {
  return {
    tableau: [],
    stock: [],
    foundation: card(0, '♠', 5),
    score: 0,
    combo: 0,
    shieldLeft: 0,
    chain: [],
    linked: false,
    columnsEmptiedThisCombo: 0,
    lastDrawEffect: null,
    status: 'playing',
    endReason: null,
    lastGain: null,
    ...overrides,
  }
}
```

- [ ] **Step 2: 失敗する新しいplayCardテストを書く**

`engine.test.ts` に以下を追記する(`makeWave`定義の後、他のdescribeブロックと並列の位置):

```ts
describe('playCard', () => {
  const scoring = DEFAULT_PARAMS.scoring

  function baseWave(overrides: Partial<WaveState> = {}): WaveState {
    return makeWave({
      foundation: card(0, '♠', 5),
      tableau: [[card(1, '♣', 6)], [card(2, '♦', 2)]],
      ...overrides,
    })
  }

  test('取れない列を指定した場合は何も変わらない', () => {
    const wave = baseWave()
    const next = playCard(DEFAULT_PARAMS, wave, 'none', [], 1000000, 1) // 列1(2)は取れない
    expect(next).toBe(wave)
  })

  test('コンボ1(倍率1.0)で基礎点そのまま加点される', () => {
    const wave = baseWave()
    const next = playCard(DEFAULT_PARAMS, wave, 'none', [], 1000000, 0)
    expect(next.combo).toBe(1)
    expect(next.score).toBe(scoring.basePoint)
    expect(next.foundation).toEqual(card(1, '♣', 6))
    expect(next.chain).toEqual([card(1, '♣', 6)])
    expect(next.tableau[0]).toEqual([])
  })

  test('コンボ2(倍率1+0.1=1.1)で加点される(パターン不一致の場合)', () => {
    // 1枚目を取ってコンボ1にし、2枚目(パターン不一致)を取ってコンボ2にする
    const wave = baseWave({ tableau: [[card(1, '♣', 6)], [card(2, '♦', 9)]] })
    const afterFirst = playCard(DEFAULT_PARAMS, wave, 'none', [], 1000000, 0)
    // 2列目のfoundation差分を6→9にするため、一旦foundationを差し替えたウェーブで2枚目を取る
    const wave2 = { ...afterFirst, foundation: card(1, '♣', 6), tableau: [[], [card(2, '♦', 7)]] }
    const next = playCard(DEFAULT_PARAMS, wave2, 'none', [], 1000000, 1)
    expect(next.combo).toBe(2)
    // 6→7は階段方向+1・長さ2(閾値3未満でボーナスなし)、スート♣→♦で色も違う→パターンボーナス0
    expect(next.score).toBe(afterFirst.score + Math.floor(scoring.basePoint * 1.1))
  })

  test('「紅の目利き」所持時、赤札の基礎点が加算される(内訳表示には出ない)', () => {
    const wave = baseWave({ tableau: [[card(1, '♥', 6)], [card(2, '♦', 2)]] })
    const next = playCard(DEFAULT_PARAMS, wave, 'none', ['red5'], 1000000, 0)
    expect(next.score).toBe(scoring.basePoint + DEFAULT_PARAMS.items.redBonusValue)
    expect(next.lastGain?.parts).toEqual([])
  })

  test('「宮廷の紋章」所持時、絵札の基礎点が加算される', () => {
    const wave = baseWave({ tableau: [[card(1, '♣', 4)], [card(2, '♣', 11)]], foundation: card(0, '♣', 12) })
    const next = playCard(DEFAULT_PARAMS, wave, 'none', ['face10'], 1000000, 1)
    expect(next.score).toBe(scoring.basePoint + DEFAULT_PARAMS.items.faceBonusValue)
  })

  test('列を空にすると列一掃ボーナスが加算される(1列目)', () => {
    const wave = baseWave({ tableau: [[card(1, '♣', 6)], [card(2, '♦', 9)]] })
    const next = playCard(DEFAULT_PARAMS, wave, 'none', [], 1000000, 0)
    expect(next.columnsEmptiedThisCombo).toBe(1)
    expect(next.score).toBe(scoring.basePoint + scoring.columnSweepBonus * 1)
    expect(next.lastGain?.parts).toContain(`列一掃+${scoring.columnSweepBonus}`)
  })

  test('同じコンボ内で2列目を空にすると列一掃ボーナスが列数倍になる', () => {
    const wave = baseWave({
      tableau: [[card(1, '♣', 6)], [card(2, '♦', 7)]],
      columnsEmptiedThisCombo: 1,
    })
    const next = playCard(DEFAULT_PARAMS, wave, 'none', [], 1000000, 1)
    expect(next.columnsEmptiedThisCombo).toBe(2)
    expect(next.lastGain?.parts).toContain(`列一掃+${scoring.columnSweepBonus * 2}`)
  })

  test('場札が0枚になったら全消しボーナス(clearBonus+残り山札×clearBonusPerStock)が加算されendReason=fullClear', () => {
    const wave = baseWave({ tableau: [[card(1, '♣', 6)]], stock: [card(9, '♠', 1), card(10, '♠', 2)] })
    const next = playCard(DEFAULT_PARAMS, wave, 'none', [], 100000000, 0)
    expect(next.tableau.reduce((n, c) => n + c.length, 0)).toBe(0)
    expect(next.status).toBe('ended')
    expect(next.endReason).toBe('fullClear')
    const expectedClearBonus = scoring.clearBonus + 2 * scoring.clearBonusPerStock
    expect(next.score).toBe(scoring.basePoint + scoring.columnSweepBonus * 1 + expectedClearBonus)
  })

  test('「完全消去」所持時は全消しボーナスにさらに加算される', () => {
    const wave = baseWave({ tableau: [[card(1, '♣', 6)]], stock: [] })
    const next = playCard(DEFAULT_PARAMS, wave, 'none', ['clear300'], 100000000, 0)
    const expectedClearBonus = scoring.clearBonus + 0 * scoring.clearBonusPerStock + DEFAULT_PARAMS.items.fullClearItemBonus
    expect(next.score).toBe(scoring.basePoint + scoring.columnSweepBonus * 1 + expectedClearBonus)
  })

  test('スコアが目標に達したらendReason=targetでstatus=ended', () => {
    const wave = baseWave()
    const next = playCard(DEFAULT_PARAMS, wave, 'none', [], 5, 0) // basePoint(100) >= target(5)
    expect(next.status).toBe('ended')
    expect(next.endReason).toBe('target')
  })

  test('status が playing でない場合は何もしない', () => {
    const wave = baseWave({ status: 'ended', endReason: 'target' })
    const next = playCard(DEFAULT_PARAMS, wave, 'none', [], 1000000, 0)
    expect(next).toBe(wave)
  })

  test('端数が出る設定でもfloorで切り捨てられる(保険の確認)', () => {
    const oddParams: typeof DEFAULT_PARAMS = {
      ...DEFAULT_PARAMS,
      scoring: { ...DEFAULT_PARAMS.scoring, basePoint: 15, comboMultiplierStep: 0.25 },
    }
    const wave = baseWave()
    // コンボ1: 倍率1+(1-1)*0.25=1.0 → 15*1.0=15 (割り切れる、floorの効果を見るには2枚目が必要)
    const afterFirst = playCard(oddParams, wave, 'none', [], 1000000, 0)
    const wave2 = { ...afterFirst, tableau: [[], [card(2, '♦', 9)]] }
    const next = playCard(oddParams, wave2, 'none', [], 1000000, 1)
    // コンボ2: 倍率1+(2-1)*0.25=1.25 → 15*1.25=18.75 → floor=18
    expect(next.score).toBe(afterFirst.score + 18)
  })
})
```

- [ ] **Step 3: テストが失敗することを確認する**

Run: `npx vitest run src/lib/game/culmen/engine.test.ts`
Expected: FAIL(`playCard`が旧仕様のまま、`columnsEmptiedThisCombo`等が存在しない)

- [ ] **Step 4: `playCard` を書き換える**

`engine.ts` の既存 `export function playCard(...)` を丸ごと以下に置き換える:

```ts
export function playCard(
  params: CulmenParams,
  wave: WaveState,
  modifier: StageModifier,
  items: ItemId[],
  target: number,
  colIndex: number
): WaveState {
  if (wave.status !== 'playing') return wave
  const col = wave.tableau[colIndex]
  const card = col?.[col.length - 1]
  if (!card) return wave
  if (!isPlayable(modifier, wave, card)) return wave

  const newCombo = wave.combo + 1
  let base = params.scoring.basePoint
  if (isRed(card) && items.includes('red5')) base += params.items.redBonusValue
  if (isFace(card) && items.includes('face10')) base += params.items.faceBonusValue

  const chainResult = evaluateChainBonus(params.scoring, wave.chain, card)
  base += chainResult.bonus
  const parts = [...chainResult.parts]

  const newTableau = wave.tableau.map((c, i) => (i === colIndex ? c.slice(0, -1) : c))
  const columnJustEmptied = newTableau[colIndex].length === 0
  const newColumnsEmptied = columnJustEmptied ? wave.columnsEmptiedThisCombo + 1 : wave.columnsEmptiedThisCombo
  if (columnJustEmptied) {
    const sweepGain = params.scoring.columnSweepBonus * newColumnsEmptied
    base += sweepGain
    parts.push(`列一掃+${sweepGain}`)
  }

  const comboMultiplierStep = params.scoring.comboMultiplierStep
  const multiplier = 1 + (newCombo - 1) * comboMultiplierStep
  const gained = Math.floor(base * multiplier)

  const remaining = remainingCount(newTableau)
  const newScore = wave.score + gained

  const next: WaveState = {
    ...wave,
    tableau: newTableau,
    foundation: card,
    combo: newCombo,
    chain: [...wave.chain, card],
    linked: true,
    columnsEmptiedThisCombo: newColumnsEmptied,
    score: newScore,
    lastGain: { points: gained, parts },
    status: 'playing',
    endReason: null,
  }

  if (remaining === 0) {
    const clearBonus = params.scoring.clearBonus + wave.stock.length * params.scoring.clearBonusPerStock
    const itemBonus = items.includes('clear300') ? params.items.fullClearItemBonus : 0
    return { ...next, score: newScore + clearBonus + itemBonus, status: 'ended', endReason: 'fullClear' }
  }

  if (newScore >= target) {
    return { ...next, status: 'ended', endReason: 'target' }
  }

  return next
}
```

- [ ] **Step 5: テストが通ることを確認する**

Run: `npx vitest run src/lib/game/culmen/engine.test.ts`
Expected: PASS(全テスト)

- [ ] **Step 6: コミット**

```bash
git add src/lib/game/culmen/engine.ts src/lib/game/culmen/engine.test.ts
git commit -m "feat: Culmenのplaycard計算式を新コンボ倍率・チェーンボーナス・列一掃・全消し連動に書き換え"
```

## Context

これは大きめの置き換えタスク。`evaluatePattern`と旧`playCard`テストを削除し、`evaluateChainBonus`(Task 4)を使う新しい`playCard`に差し替える。`stairDir`/`stairLen`という個別フィールドは完全に無くなり、`wave.chain`から都度導出する方式になる。

---

### Task 6: エンジン — drawStockの書き換え(パターン継続の新ルール・特殊演出フラグ)

**Files:**
- Modify: `src/lib/game/culmen/engine.ts`
- Modify: `src/lib/game/culmen/engine.test.ts`

- [ ] **Step 1: 既存の古いdrawStockテストを削除し、新しいテストを書く**

`engine.test.ts` の `describe('drawStock', ...)` ブロックを丸ごと以下に置き換える:

```ts
describe('chainContinuesPattern', () => {
  test('チェーンが空なら継続不可', () => {
    expect(chainContinuesPattern(DEFAULT_PARAMS.scoring, [], card(1, '♠', 5))).toBe(false)
  })

  test('同スートが成立中で、捲った札が同じスートなら継続', () => {
    const chain = [card(1, '♠', 5), card(2, '♠', 6)]
    expect(chainContinuesPattern(DEFAULT_PARAMS.scoring, chain, card(3, '♠', 9))).toBe(true)
  })

  test('同スートが成立中でも、捲った札が違うスート・違う色なら継続不可', () => {
    const chain = [card(1, '♠', 5), card(2, '♠', 6)]
    expect(chainContinuesPattern(DEFAULT_PARAMS.scoring, chain, card(3, '♥', 9))).toBe(false)
  })

  test('階段が成立中で、捲った札が同方向を継続すれば継続', () => {
    const chain = [card(1, '♠', 5), card(2, '♣', 6)] // dir=+1
    expect(chainContinuesPattern(DEFAULT_PARAMS.scoring, chain, card(3, '♦', 7))).toBe(true)
  })

  test('全ての条件が既に崩れていれば継続不可', () => {
    const chain = [card(1, '♠', 5), card(2, '♥', 8)] // スートも色も階段も不成立
    expect(chainContinuesPattern(DEFAULT_PARAMS.scoring, chain, card(3, '♣', 2))).toBe(false)
  })
})

describe('drawStock', () => {
  test('山札が空なら何もしない', () => {
    const wave = makeWave({ stock: [] })
    expect(drawStock(DEFAULT_PARAMS, wave, [])).toBe(wave)
  })

  test('通常時(継続条件なし): コンボ・チェーン・列一掃カウントがリセットされる', () => {
    const wave = makeWave({
      stock: [card(1, '♠', 9)],
      combo: 3,
      shieldLeft: 0,
      chain: [card(2, '♣', 1)],
      linked: true,
      columnsEmptiedThisCombo: 2,
    })
    const next = drawStock(DEFAULT_PARAMS, wave, [])
    expect(next.foundation).toEqual(card(1, '♠', 9))
    expect(next.combo).toBe(0)
    expect(next.chain).toEqual([])
    expect(next.linked).toBe(false)
    expect(next.columnsEmptiedThisCombo).toBe(0)
    expect(next.lastDrawEffect).toBeNull()
    expect(next.stock).toEqual([])
  })

  test('「助走」所持時のリセット後コンボはstartComboになる', () => {
    const wave = makeWave({ stock: [card(1, '♠', 9)], combo: 3, shieldLeft: 0 })
    const next = drawStock(DEFAULT_PARAMS, wave, ['start1'])
    expect(next.combo).toBe(DEFAULT_PARAMS.items.startCombo)
  })

  test('ワイルドがめくれた場合: コンボは変わらずチェーンに追加され、lastDrawEffectはwild', () => {
    const wave = makeWave({
      stock: [card(1, '★', 0, true)],
      combo: 3,
      chain: [card(2, '♣', 5)],
      linked: true,
    })
    const next = drawStock(DEFAULT_PARAMS, wave, [])
    expect(next.combo).toBe(3)
    expect(next.chain).toEqual([card(2, '♣', 5), card(1, '★', 0, true)])
    expect(next.linked).toBe(true)
    expect(next.lastDrawEffect).toBe('wild')
  })

  test('シールド発動時: コンボ維持・shieldLeft減少・得点は付かずチェーンに加わり、lastDrawEffectはshield', () => {
    const wave = makeWave({
      stock: [card(1, '♣', 9)], // チェーン継続条件を満たさない札にしてシールド発動だけを検証
      combo: 2,
      shieldLeft: 1,
      chain: [card(2, '♥', 5)],
      linked: true,
    })
    const next = drawStock(DEFAULT_PARAMS, wave, [])
    expect(next.combo).toBe(2)
    expect(next.shieldLeft).toBe(0)
    expect(next.chain).toEqual([card(2, '♥', 5), card(1, '♣', 9)])
    expect(next.lastDrawEffect).toBe('shield')
  })

  test('シールドが無くても、パターンに合う札ならアイテム無しで特殊継続しlastDrawEffectはpattern', () => {
    const wave = makeWave({
      stock: [card(1, '♠', 9)], // 同スート継続
      combo: 2,
      shieldLeft: 0,
      chain: [card(2, '♠', 5)],
      linked: true,
    })
    const next = drawStock(DEFAULT_PARAMS, wave, [])
    expect(next.combo).toBe(2)
    expect(next.chain).toEqual([card(2, '♠', 5), card(1, '♠', 9)])
    expect(next.linked).toBe(true)
    expect(next.lastDrawEffect).toBe('pattern')
    expect(next.score).toBe(wave.score) // 得点は付かない
  })

  test('パターンに合わずシールドも無ければ通常通りリセットする', () => {
    const wave = makeWave({
      stock: [card(1, '♣', 9)], // 同スートでも階段でもない
      combo: 2,
      shieldLeft: 0,
      chain: [card(2, '♥', 5)],
      linked: true,
    })
    const next = drawStock(DEFAULT_PARAMS, wave, [])
    expect(next.combo).toBe(0)
    expect(next.chain).toEqual([])
    expect(next.linked).toBe(false)
    expect(next.lastDrawEffect).toBeNull()
  })

  test('コンボがbaseCombo以下ならシールドがあっても消費せずリセットする(パターン不一致の場合)', () => {
    const wave = makeWave({ stock: [card(1, '♣', 9)], combo: 0, shieldLeft: 2, chain: [], linked: false })
    const next = drawStock(DEFAULT_PARAMS, wave, [])
    expect(next.shieldLeft).toBe(2)
    expect(next.combo).toBe(0)
    expect(next.chain).toEqual([])
  })
})
```

- [ ] **Step 2: テストが失敗することを確認する**

Run: `npx vitest run src/lib/game/culmen/engine.test.ts`
Expected: FAIL(`chainContinuesPattern`が存在せず、`drawStock`も旧仕様のまま)

- [ ] **Step 3: `chainContinuesPattern` を追加し、`drawStock` を書き換える**

まず `chainContinuesPattern` ヘルパーを `engine.ts` に追加(`evaluateChainBonus`の直後などに配置):

```ts
export function chainContinuesPattern(
  scoring: CulmenParams['scoring'],
  chain: Card[],
  card: Card
): boolean {
  if (chain.length === 0) return false

  const realChain = chain.filter(c => !c.wild)
  const { suitHeld, colorHeld } = analyzeSuitColor(chain)
  if (realChain.length > 0) {
    const anchor = realChain[0]
    if (suitHeld && card.suit === anchor.suit) return true
    if (colorHeld && isRed(card) === isRed(anchor)) return true
  }

  const stairInfo = analyzeStair(chain)
  if (stairInfo.held && stairInfo.dir !== 0 && realChain.length > 0) {
    const lastReal = realChain[realChain.length - 1]
    let d = card.rank - lastReal.rank
    if (d === 12) d = -1
    if (d === -12) d = 1
    if (d === stairInfo.dir) return true
  }

  return false
}
```

次に既存の `export function drawStock(...)` を丸ごと以下に置き換える:

```ts
export function drawStock(params: CulmenParams, wave: WaveState, items: ItemId[]): WaveState {
  if (wave.status !== 'playing') return wave
  if (wave.stock.length === 0) return wave

  const newStock = [...wave.stock]
  const card = newStock.pop() as Card

  if (card.wild) {
    return {
      ...wave,
      stock: newStock,
      foundation: card,
      chain: [...wave.chain, card],
      linked: true,
      lastDrawEffect: 'wild',
    }
  }

  const baseCombo = items.includes('start1') ? params.items.startCombo : 0
  const canShieldProtect = wave.combo > baseCombo && wave.shieldLeft > 0
  const patternContinues = wave.linked && chainContinuesPattern(params.scoring, wave.chain, card)

  if (canShieldProtect || patternContinues) {
    return {
      ...wave,
      stock: newStock,
      foundation: card,
      shieldLeft: canShieldProtect ? wave.shieldLeft - 1 : wave.shieldLeft,
      chain: [...wave.chain, card],
      linked: true,
      lastDrawEffect: canShieldProtect ? 'shield' : 'pattern',
    }
  }

  return {
    ...wave,
    stock: newStock,
    foundation: card,
    combo: baseCombo,
    chain: [],
    linked: false,
    columnsEmptiedThisCombo: 0,
    lastDrawEffect: null,
  }
}
```

- [ ] **Step 4: テストが通ることを確認する**

Run: `npx vitest run src/lib/game/culmen/engine.test.ts`
Expected: PASS(全テスト)

- [ ] **Step 5: 全体テストスイートを実行する**

Run: `npm run test`
Expected: 全ファイルPASS

- [ ] **Step 6: コミット**

```bash
git add src/lib/game/culmen/engine.ts src/lib/game/culmen/engine.test.ts
git commit -m "feat: Culmenのdrawstockにパターン継続の新ルール(アイテム無しでのコンボ継続)を追加"
```

## Context

シールド発動時は「コンボ維持」のみが目的で、パターン継続条件を満たさない札(例: `♣9`を`♥5`の後に引く)を使うことで、シールド分岐のテストとパターン継続分岐のテストを明確に分離している。両方の条件が同時に満たされる場合はシールドが優先して消費される(実装の`if (canShieldProtect || patternContinues)`の中で`canShieldProtect`を先に判定しているため)。

---

### Task 7: エンジン — startWaveの初期化フィールド更新

**Files:**
- Modify: `src/lib/game/culmen/engine.ts`
- Modify: `src/lib/game/culmen/engine.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`engine.test.ts` の `describe('startWave', ...)` 内の「初期状態」テストを以下に置き換える:

```ts
  test('初期状態: スコア0、コンボ0、チェーン空、列一掃0、演出フラグnull', () => {
    const wave = startWave(DEFAULT_PARAMS, 0, 0, [], 1)
    expect(wave.score).toBe(0)
    expect(wave.combo).toBe(0)
    expect(wave.chain).toEqual([])
    expect(wave.linked).toBe(false)
    expect(wave.columnsEmptiedThisCombo).toBe(0)
    expect(wave.lastDrawEffect).toBeNull()
    expect(wave.status).toBe('playing')
  })
```

- [ ] **Step 2: テストが失敗することを確認する**

Run: `npx vitest run src/lib/game/culmen/engine.test.ts`
Expected: FAIL(`startWave`の戻り値にまだ`stairDir`/`stairLen`が残っており、`columnsEmptiedThisCombo`/`lastDrawEffect`が無い)

- [ ] **Step 3: `startWave` の戻り値を修正する**

`engine.ts` の `startWave` 関数末尾の `return { ... }` を以下に置き換える(`stairDir: 0, stairLen: 1,` を削除し、`columnsEmptiedThisCombo: 0, lastDrawEffect: null,` を追加):

```ts
  return {
    tableau,
    stock: deck,
    foundation,
    score: 0,
    combo: hasStart1 ? params.items.startCombo : 0,
    shieldLeft: shieldCount * params.items.shieldChargesPerPick,
    chain: [],
    linked: false,
    columnsEmptiedThisCombo: 0,
    lastDrawEffect: null,
    status: 'playing',
    endReason: null as WaveEndReason,
    lastGain: null,
  }
```

- [ ] **Step 4: テストが通ることを確認する**

Run: `npx vitest run src/lib/game/culmen/engine.test.ts`
Expected: PASS(全テスト)

- [ ] **Step 5: 型チェックを実行する**

Run: `npm run check`
Expected: culmen関連のエラーが0件(既存の無関係なエラーのみ残る)

- [ ] **Step 6: 全体テストスイートを実行する**

Run: `npm run test`
Expected: 全ファイルPASS

- [ ] **Step 7: コミット**

```bash
git add src/lib/game/culmen/engine.ts src/lib/game/culmen/engine.test.ts
git commit -m "feat: CulmenのstartWaveを新WaveState構造に対応させる"
```

---

### Task 8: adminページ — 一の位固定入力欄と新パラメータの追加

**Files:**
- Modify: `src/routes/admin/culmen/+page.svelte`

- [ ] **Step 1: 「一の位固定」入力用スニペットを追加する**

`src/routes/admin/culmen/+page.svelte` の `<script>` セクション末尾(`onMount`/`onDestroy`の前)に、以下のヘルパー関数を追加する:

```ts
  function setScoring<K extends keyof CulmenParams['scoring']>(key: K, value: number) {
    if (!config) return
    config.scoring[key] = value as CulmenParams['scoring'][K]
  }

  function setItems<K extends keyof CulmenParams['items']>(key: K, value: number) {
    if (!config) return
    config.items[key] = value as CulmenParams['items'][K]
  }

  function setTarget(stageIndex: number, targetIndex: 0 | 1 | 2, value: number) {
    if (!config) return
    config.stages[stageIndex].targets[targetIndex] = value
  }
```

`<script>` 冒頭の型インポートに変更はない(`CulmenParams`は既にimport済み)。

- [ ] **Step 2: `{#snippet}` を追加する**

`</script>` の直後、`<div class="max-w-3xl ...">` の直前に、以下のスニペットを追加する:

```svelte
{#snippet scaledNumberInput(value: number, onChange: (v: number) => void)}
  <div class="mt-1 flex items-center gap-1">
    <input
      type="number"
      min="0"
      step="1"
      value={value / 10}
      oninput={(e) => onChange(Number((e.target as HTMLInputElement).value) * 10)}
      class="w-full border border-slate-200 rounded px-2 py-1 text-sm"
    />
    <span class="text-slate-400 font-mono text-sm select-none" title="点数系パラメータは常に10の倍数">0</span>
  </div>
{/snippet}
```

- [ ] **Step 3: 「スコアリング」セクションを一の位固定入力に置き換え、新パラメータを追加する**

既存の「スコアリング」`<section>` を以下に置き換える:

```svelte
      <section class="bg-white border border-slate-200 rounded-xl p-4">
        <h2 class="font-semibold text-slate-700 text-sm mb-3">スコアリング</h2>
        <div class="grid grid-cols-2 gap-3">
          <label class="text-xs text-slate-500">
            基礎点(basePoint)
            {@render scaledNumberInput(config.scoring.basePoint, v => setScoring('basePoint', v))}
          </label>
          <label class="text-xs text-slate-500">
            同スートボーナス(suitBonus)
            {@render scaledNumberInput(config.scoring.suitBonus, v => setScoring('suitBonus', v))}
          </label>
          <label class="text-xs text-slate-500">
            同色ボーナス(colorBonus)
            {@render scaledNumberInput(config.scoring.colorBonus, v => setScoring('colorBonus', v))}
          </label>
          <label class="text-xs text-slate-500">
            階段ボーナス(stairBonus)
            {@render scaledNumberInput(config.scoring.stairBonus, v => setScoring('stairBonus', v))}
          </label>
          <label class="text-xs text-slate-500">
            階段成立枚数(stairMinLen)
            <input type="number" min="2" step="1" bind:value={config.scoring.stairMinLen} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            ワイルド直後ボーナス(wildSuitBonus)
            {@render scaledNumberInput(config.scoring.wildSuitBonus, v => setScoring('wildSuitBonus', v))}
          </label>
          <label class="text-xs text-slate-500">
            全消しボーナス(clearBonus)
            {@render scaledNumberInput(config.scoring.clearBonus, v => setScoring('clearBonus', v))}
          </label>
          <label class="text-xs text-slate-500">
            全消し・残り山札1枚あたり(clearBonusPerStock)
            {@render scaledNumberInput(config.scoring.clearBonusPerStock, v => setScoring('clearBonusPerStock', v))}
          </label>
          <label class="text-xs text-slate-500">
            コンボ倍率のstep幅(comboMultiplierStep)
            <input type="number" min="0" step="0.1" bind:value={config.scoring.comboMultiplierStep} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
        </div>
      </section>

      <section class="bg-white border border-slate-200 rounded-xl p-4">
        <h2 class="font-semibold text-slate-700 text-sm mb-3">役ボーナス</h2>
        <div class="grid grid-cols-2 gap-3">
          <label class="text-xs text-slate-500">
            スートコンプリート(flushBonus)
            {@render scaledNumberInput(config.scoring.flushBonus, v => setScoring('flushBonus', v))}
          </label>
          <label class="text-xs text-slate-500">
            ロイヤルセット(royalSetBonus)
            {@render scaledNumberInput(config.scoring.royalSetBonus, v => setScoring('royalSetBonus', v))}
          </label>
          <label class="text-xs text-slate-500">
            同ランク単位(sameRankBonusUnit)
            {@render scaledNumberInput(config.scoring.sameRankBonusUnit, v => setScoring('sameRankBonusUnit', v))}
          </label>
          <label class="text-xs text-slate-500">
            コンプリートラン(completeRunBonus)
            {@render scaledNumberInput(config.scoring.completeRunBonus, v => setScoring('completeRunBonus', v))}
          </label>
          <label class="text-xs text-slate-500">
            コンプリートラン・同スート加点(completeRunSuitBonus)
            {@render scaledNumberInput(config.scoring.completeRunSuitBonus, v => setScoring('completeRunSuitBonus', v))}
          </label>
          <label class="text-xs text-slate-500">
            列一掃(columnSweepBonus)
            {@render scaledNumberInput(config.scoring.columnSweepBonus, v => setScoring('columnSweepBonus', v))}
          </label>
        </div>
      </section>
```

- [ ] **Step 4: 「アイテム」セクションの点数系フィールドを一の位固定入力に置き換える**

既存の「アイテム」`<section>` 内の `redBonusValue`・`faceBonusValue`・`fullClearItemBonus` の3つの `<input>` を以下に置き換える(他のフィールドは変更しない):

```svelte
          <label class="text-xs text-slate-500">
            紅の目利き(redBonusValue)
            {@render scaledNumberInput(config.items.redBonusValue, v => setItems('redBonusValue', v))}
          </label>
```

```svelte
          <label class="text-xs text-slate-500">
            宮廷の紋章(faceBonusValue)
            {@render scaledNumberInput(config.items.faceBonusValue, v => setItems('faceBonusValue', v))}
          </label>
```

```svelte
          <label class="text-xs text-slate-500">
            完全消去加算(fullClearItemBonus)
            {@render scaledNumberInput(config.items.fullClearItemBonus, v => setItems('fullClearItemBonus', v))}
          </label>
```

- [ ] **Step 5: ステージ表の target1〜3 を一の位固定入力に置き換える**

既存のステージテーブル内、`{#each [0, 1, 2] as ti (ti)}` のブロックを以下に置き換える:

```svelte
                  {#each [0, 1, 2] as ti (ti)}
                    <td class="px-1 py-1">
                      {@render scaledNumberInput(stage.targets[ti], v => setTarget(si, ti as 0 | 1 | 2, v))}
                    </td>
                  {/each}
```

- [ ] **Step 6: Lintと型チェックを実行する**

Run: `npx eslint src/routes/admin/culmen/`
Expected: エラーなし

Run: `npm run check`
Expected: culmen関連のエラーなし

- [ ] **Step 7: 開発サーバーで動作確認する**

Run: `npm run dev`(既に起動中でなければ)

ブラウザで `/admin/culmen` を開き、以下を確認する:
- 「基礎点(basePoint)」の入力欄に `10` と表示され(100/10)、右に固定表示「0」がある
- その入力欄を `15` に変更して保存→リロードすると、実際の値が150として保持されている(JSON入出力欄で確認)
- 「役ボーナス」セクションが表示され、6項目とも同様の一の位固定入力になっている
- ステージ表の target1〜3 も同様の形式になっている
- `stairMinLen`・`comboMultiplierStep` は通常の入力欄のまま(一の位固定ではない)

- [ ] **Step 8: コミット**

```bash
git add src/routes/admin/culmen/+page.svelte
git commit -m "feat: /admin/culmenに一の位固定入力と役ボーナス等の新パラメータ欄を追加"
```

---

### Task 9: ゲーム画面 — 山札めくりの特殊演出表示

**Files:**
- Modify: `src/routes/game/culmen/+page.svelte`

- [ ] **Step 1: `lastDrawEffect` に応じた演出テキストを表示する**

`src/routes/game/culmen/+page.svelte` の `playArea` スニペット内、山札ボタンの直後(操作バー`<div class="px-4 pb-5 pt-2 flex items-center gap-4">`の中、山札ボタンと場札の間、もしくは操作バー直上)に、以下を追加する。まず操作バーの直前に演出表示用のブロックを追加する:

```svelte
  {#if displayWave.lastDrawEffect === 'pattern'}
    <div class="px-4 text-center text-yellow-300 text-xs font-black animate-pulse mb-1">✦ パターン継続! ✦</div>
  {/if}
```

この行は `<div class="px-4 pb-5 pt-2 flex items-center gap-4">`(操作バー)の直前、チェーン表示の`<div class="px-4 flex items-center gap-1 overflow-x-auto" ...>`ブロックの後に挿入する。

- [ ] **Step 2: `handleDraw` 後に演出を一定時間で消す**

`+page.svelte` の `<script>` セクション、`handleDraw` 関数の直後に、演出を数百ミリ秒後にクリアする処理を追加する必要はない。`lastDrawEffect` は次のアクション(次のカードプレイ、または次の山札めくり)で自動的に上書き・リセットされる(`drawStock`が通常リセット時に`lastDrawEffect: null`を設定し、`playCard`は`lastDrawEffect`フィールドを`...wave`のスプレッドでそのまま引き継ぐため、次にプレイした瞬間に古い演出フラグが残り続ける点に注意)。これを避けるため、`playCard`実行時に`lastDrawEffect`をクリアする必要がある。

`src/lib/game/culmen/engine.ts` の `playCard` 関数内、`const next: WaveState = { ... }` の中に `lastDrawEffect: null,` を追加する:

```ts
  const next: WaveState = {
    ...wave,
    tableau: newTableau,
    foundation: card,
    combo: newCombo,
    chain: [...wave.chain, card],
    linked: true,
    columnsEmptiedThisCombo: newColumnsEmptied,
    lastDrawEffect: null,
    score: newScore,
    lastGain: { points: gained, parts },
    status: 'playing',
    endReason: null,
  }
```

- [ ] **Step 3: 対応するテストを追記する**

`src/lib/game/culmen/engine.test.ts` の `describe('playCard', ...)` 内に以下のテストを追加する:

```ts
  test('カードを取るとlastDrawEffectがクリアされる', () => {
    const wave = baseWave({ lastDrawEffect: 'pattern' })
    const next = playCard(DEFAULT_PARAMS, wave, 'none', [], 1000000, 0)
    expect(next.lastDrawEffect).toBeNull()
  })
```

- [ ] **Step 4: テストが通ることを確認する**

Run: `npx vitest run src/lib/game/culmen/engine.test.ts`
Expected: PASS(全テスト)

- [ ] **Step 5: Lintと型チェックを実行する**

Run: `npx eslint src/routes/game/culmen/ src/lib/game/culmen/`
Expected: エラーなし

Run: `npm run check`
Expected: culmen関連のエラーなし

- [ ] **Step 6: 開発サーバーで動作確認する**

Run: `npm run dev`(既に起動中でなければ)

ブラウザで `/game/culmen` を開き、ゲームを開始してから、同スートが成立している状態で山札をめくり、シールドを持っていない状態でも「✦ パターン継続! ✦」の演出が表示され、次にカードを取ると演出が消えることを確認する。

- [ ] **Step 7: コミット**

```bash
git add src/lib/game/culmen/engine.ts src/lib/game/culmen/engine.test.ts src/routes/game/culmen/+page.svelte
git commit -m "feat: Culmenの山札めくりパターン継続に専用演出表示を追加"
```

---

### Task 10: 最終検証

**Files:** なし(検証のみ)

- [ ] **Step 1: 全テストを実行する**

Run: `npm run test`
Expected: 全ファイルPASS

- [ ] **Step 2: 型チェック・Lintを実行する**

Run: `npm run check && npx eslint src/lib/game/culmen/ src/routes/game/culmen/ src/routes/admin/culmen/`
Expected: culmen関連のエラーなし(既存の無関係なエラーは変化なしでよい)

- [ ] **Step 3: 本番ビルドを実行する**

Run: `npm run build`
Expected: ビルド成功

- [ ] **Step 4: 開発サーバーで受け入れ基準を一通り確認する**

Run: `npm run dev`

`docs/superpowers/specs/2026-07-08-culmen-scoring-redesign-design.md` の「9. 受け入れ基準」を上から順にブラウザ・DevToolsで確認する:
1. コンボ8で倍率×1.7(既定`comboMultiplierStep`=0.1) — `evaluateChainBonus`/`playCard`のテストで検証済み、実機でもコンボを伸ばして獲得点の増え方を確認
2. 基礎点100・倍率1.3で獲得点130 — テストで検証済み
3〜4. 同スート・階段が一度崩れたら復活しないこと — 実際にプレイして内訳表示を確認
5〜6. シールド無しでもパターン継続する新ルール、パターンが無ければ通常通りリセット — 「✦ パターン継続! ✦」演出を目視確認
7. 全消し時の残り山札連動ボーナス — 全消しを達成して内訳(または合計スコアの増分)を確認
8〜12. 役ボーナス(フラッシュ・ロイヤル・同ランク・コンプリートラン・列一掃)が内訳表示に出ること
13. `/admin/culmen`の一の位固定入力欄の動作
14. `npm run test`・`npm run build`成功

- [ ] **Step 5: 最終コミット(検証中に見つかった不具合を修正した場合のみ)**

```bash
git add -A
git commit -m "fix: スコア再設計の最終検証で見つかった不具合を修正"
```

---

## 自己レビュー結果

- **スペック網羅性**: 1節(コンボ倍率step化)→Task 1・5、2節(10倍スケーリング)→Task 1、2.1節(一の位固定)→Task 8、3節(パターンボーナス全体一貫性)→Task 2・4・5、4節(山札めくり新コンボ継続)→Task 6・9、5節(全消しボーナス残り山札連動)→Task 5、6節(役ボーナス)→Task 3・4・5、で対応済み。
- **プレースホルダー**: なし。全タスクに実コードを記載。
- **型・関数名の一貫性**: `analyzeSuitColor`/`analyzeStair`(Task 2)→`evaluateChainBonus`(Task 4)→`playCard`(Task 5)、`chainContinuesPattern`(Task 6)→`drawStock`(Task 6)で一貫して使用。`WaveState`の新フィールド(`columnsEmptiedThisCombo`・`lastDrawEffect`)はTask 1で定義後、Task 5(playCard)・Task 6(drawStock)・Task 7(startWave)・Task 9で一貫して読み書きされることを確認済み。
