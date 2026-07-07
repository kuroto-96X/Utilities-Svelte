# 登頂ソリティア -Culmen- Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ゴルフソリティア型のカード取り合いに、コンボ・パターンボーナス・アイテム強化・ステージ制ラン進行を組み合わせた新ゲーム「登頂ソリティア -Culmen-」を `/game/culmen` に追加し、`/admin/culmen` でスコアリング・ステージ構成を調整できるようにする。

**Architecture:** ゲームロジックは `src/lib/game/culmen/` 配下に UI から独立した純粋関数(`engine.ts`)として実装し、状態(`WaveState`=1ウェーブの盤面、`RunState`=ラン全体の進行)を不変更新する。パラメータは既存の `/admin/animation` と同じ「JSON設定ファイル + vite dev サーバーミドルウェア」方式で永続化し、ゲーム画面は `culmen.config.json` を静的importして使う。UIは Svelte 5 runes(`$state`/`$derived`)で組み、既存の「ソリティア」の画面構成規約(単数形 `game` ディレクトリ、admin レイアウト)を踏襲する。

**Tech Stack:** SvelteKit(Svelte 5 runes) / TypeScript / Vitest / Tailwind CSS / adapter-static

**Spec:** `docs/superpowers/specs/2026-07-07-culmen-solitaire-design.md`

---

## 事前確認

- [ ] **Step 1: 作業ブランチを確認する**

```bash
git branch --show-current
```

Expected: `feat`(または `feat-*`)。`master` の場合は作業ブランチへ切り替えてから進める。

---

### Task 1: 型定義

**Files:**
- Create: `src/lib/game/culmen/types.ts`

- [ ] **Step 1: 型定義ファイルを作成する**

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

export interface WaveState {
  tableau: Card[][]
  stock: Card[]
  foundation: Card
  score: number
  combo: number
  shieldLeft: number
  chain: Card[]
  linked: boolean
  stairDir: -1 | 0 | 1
  stairLen: number
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

- [ ] **Step 2: 型チェックを実行する**

Run: `npm run check`
Expected: エラーなし(このファイルはまだどこからも import されていないため新規エラーが出ないこと)

- [ ] **Step 3: コミット**

```bash
git add src/lib/game/culmen/types.ts
git commit -m "feat: Culmen用の型定義を追加"
```

---

### Task 2: デッキユーティリティ(シード付き乱数・シャッフル)

**Files:**
- Create: `src/lib/game/culmen/deck.ts`
- Test: `src/lib/game/culmen/deck.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

```ts
// src/lib/game/culmen/deck.test.ts
import { describe, test, expect } from 'vitest'
import { createDeck, createRng, shuffle } from './deck'

function idGen() {
  let n = 0
  return () => ++n
}

describe('createDeck', () => {
  test('52枚生成される', () => {
    expect(createDeck(idGen())).toHaveLength(52)
  })

  test('全て wild: false', () => {
    expect(createDeck(idGen()).every(c => !c.wild)).toBe(true)
  })

  test('id が重複しない連番になる', () => {
    const deck = createDeck(idGen())
    const ids = deck.map(c => c.id)
    expect(new Set(ids).size).toBe(52)
  })

  test('4スート × 13ランクの組み合わせが揃っている', () => {
    const deck = createDeck(idGen())
    const suits = ['♠', '♥', '♦', '♣'] as const
    suits.forEach(suit => {
      const cards = deck.filter(c => c.suit === suit)
      expect(cards).toHaveLength(13)
      const ranks = cards.map(c => c.rank).sort((a, b) => a - b)
      expect(ranks).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13])
    })
  })
})

describe('createRng', () => {
  test('同じシードなら同じ数列を返す', () => {
    const a = createRng(42)
    const b = createRng(42)
    expect([a(), a(), a()]).toEqual([b(), b(), b()])
  })

  test('0以上1未満の値を返す', () => {
    const rand = createRng(1)
    for (let i = 0; i < 20; i++) {
      const v = rand()
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })
})

describe('shuffle', () => {
  test('枚数が変わらない', () => {
    const deck = createDeck(idGen())
    expect(shuffle(deck, createRng(1))).toHaveLength(52)
  })

  test('元のデッキを変更しない(イミュータブル)', () => {
    const deck = createDeck(idGen())
    const copy = deck.map(c => ({ ...c }))
    shuffle(deck, createRng(1))
    expect(deck).toEqual(copy)
  })

  test('同じシードなら同じ順序になる', () => {
    const deckA = createDeck(idGen())
    const deckB = createDeck(idGen())
    expect(shuffle(deckA, createRng(7))).toEqual(shuffle(deckB, createRng(7)))
  })

  test('全カードが保たれている(id基準)', () => {
    const deck = createDeck(idGen())
    const shuffled = shuffle(deck, createRng(3))
    expect(shuffled.map(c => c.id).sort((a, b) => a - b))
      .toEqual(deck.map(c => c.id).sort((a, b) => a - b))
  })
})
```

- [ ] **Step 2: テストが失敗することを確認する**

Run: `npx vitest run src/lib/game/culmen/deck.test.ts`
Expected: FAIL(`./deck` が存在しない)

- [ ] **Step 3: 実装する**

```ts
// src/lib/game/culmen/deck.ts
import type { Card, Suit, Rank } from './types'

const SUITS: Suit[] = ['♠', '♥', '♦', '♣']

export function createDeck(nextId: () => number): Card[] {
  const deck: Card[] = []
  for (const suit of SUITS) {
    for (let rank = 1; rank <= 13; rank++) {
      deck.push({ id: nextId(), suit, rank: rank as Rank, wild: false })
    }
  }
  return deck
}

export function createRng(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6D2B79F5) >>> 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 0x100000000
  }
}

export function shuffle(deck: Card[], rand: () => number = Math.random): Card[] {
  const arr = deck.map(c => ({ ...c }))
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

export function generateSeed(): number {
  return Math.floor(Math.random() * 999999) + 1
}
```

- [ ] **Step 4: テストが通ることを確認する**

Run: `npx vitest run src/lib/game/culmen/deck.test.ts`
Expected: PASS(全テスト)

- [ ] **Step 5: コミット**

```bash
git add src/lib/game/culmen/deck.ts src/lib/game/culmen/deck.test.ts
git commit -m "feat: Culmen用のデッキ生成・シード付きシャッフルを追加"
```

---

### Task 3: パラメータ定義・既定値・設定ファイル

**Files:**
- Create: `src/lib/game/culmen/culmen.config.json`
- Create: `src/lib/game/culmen/params.ts`
- Test: `src/lib/game/culmen/params.test.ts`

- [ ] **Step 1: 設定ファイル(既定値)を作成する**

```json
{
  "layout": { "cols": 7, "rows": 5 },
  "scoring": {
    "basePoint": 10,
    "suitBonus": 10,
    "colorBonus": 5,
    "stairBonus": 15,
    "stairMinLen": 3,
    "wildSuitBonus": 10,
    "clearBonus": 200
  },
  "stages": [
    { "name": "STAGE 1", "modifier": "none", "targets": [400, 750, 1300] },
    { "name": "STAGE 2", "modifier": "noLoop", "targets": [600, 1100, 1900] },
    { "name": "STAGE 3", "modifier": "faceLock", "targets": [800, 1500, 2600] }
  ],
  "items": {
    "redBonusValue": 5,
    "faceBonusValue": 10,
    "shieldChargesPerPick": 1,
    "extraStockCount": 5,
    "wildPerPick": 1,
    "startCombo": 1,
    "fullClearItemBonus": 300
  },
  "flow": { "wavesPerStage": 3, "clearDelayMs": 450 },
  "ui": { "comboTierThresholds": [3, 5, 8] }
}
```

Save to: `src/lib/game/culmen/culmen.config.json`

- [ ] **Step 2: 失敗するテストを書く**

```ts
// src/lib/game/culmen/params.test.ts
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

- [ ] **Step 3: テストが失敗することを確認する**

Run: `npx vitest run src/lib/game/culmen/params.test.ts`
Expected: FAIL(`./params` が存在しない)

- [ ] **Step 4: 実装する**

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
    basePoint: 10,
    suitBonus: 10,
    colorBonus: 5,
    stairBonus: 15,
    stairMinLen: 3,
    wildSuitBonus: 10,
    clearBonus: 200,
  },
  stages: [
    { name: 'STAGE 1', modifier: 'none', targets: [400, 750, 1300] },
    { name: 'STAGE 2', modifier: 'noLoop', targets: [600, 1100, 1900] },
    { name: 'STAGE 3', modifier: 'faceLock', targets: [800, 1500, 2600] },
  ],
  items: {
    redBonusValue: 5,
    faceBonusValue: 10,
    shieldChargesPerPick: 1,
    extraStockCount: 5,
    wildPerPick: 1,
    startCombo: 1,
    fullClearItemBonus: 300,
  },
  flow: { wavesPerStage: 3, clearDelayMs: 450 },
  ui: { comboTierThresholds: [3, 5, 8] },
}

export function loadParams(): CulmenParams {
  return culmenConfigJson as CulmenParams
}
```

- [ ] **Step 5: テストが通ることを確認する**

Run: `npx vitest run src/lib/game/culmen/params.test.ts`
Expected: PASS(全テスト)

- [ ] **Step 6: コミット**

```bash
git add src/lib/game/culmen/culmen.config.json src/lib/game/culmen/params.ts src/lib/game/culmen/params.test.ts
git commit -m "feat: Culmenのパラメータ定義・既定値・設定ファイルを追加"
```

---

### Task 4: エンジン基礎 — 表示ヘルパーとパターンボーナス判定

**Files:**
- Create: `src/lib/game/culmen/engine.ts`
- Test: `src/lib/game/culmen/engine.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

```ts
// src/lib/game/culmen/engine.test.ts
import { describe, test, expect } from 'vitest'
import { isRed, isFace, rankLabel, evaluatePattern } from './engine'
import type { Card } from './types'
import { DEFAULT_PARAMS } from './params'

function card(id: number, suit: Card['suit'], rank: Card['rank'], wild = false): Card {
  return { id, suit, rank, wild }
}

describe('isRed / isFace / rankLabel', () => {
  test('♥♦は赤、♠♣は黒', () => {
    expect(isRed(card(1, '♥', 5))).toBe(true)
    expect(isRed(card(2, '♦', 5))).toBe(true)
    expect(isRed(card(3, '♠', 5))).toBe(false)
    expect(isRed(card(4, '♣', 5))).toBe(false)
  })

  test('J/Q/Kはisface、それ以外はfalse', () => {
    expect(isFace(card(1, '♠', 11))).toBe(true)
    expect(isFace(card(2, '♠', 12))).toBe(true)
    expect(isFace(card(3, '♠', 13))).toBe(true)
    expect(isFace(card(4, '♠', 10))).toBe(false)
  })

  test('rankLabelはA/J/Q/K表記、ワイルドは★', () => {
    expect(rankLabel(card(1, '♠', 1))).toBe('A')
    expect(rankLabel(card(2, '♠', 11))).toBe('J')
    expect(rankLabel(card(3, '♠', 12))).toBe('Q')
    expect(rankLabel(card(4, '♠', 13))).toBe('K')
    expect(rankLabel(card(5, '♠', 7))).toBe('7')
    expect(rankLabel(card(6, '★', 0, true))).toBe('★')
  })
})

describe('evaluatePattern', () => {
  const scoring = DEFAULT_PARAMS.scoring

  test('直前の札がない場合はボーナス0', () => {
    const result = evaluatePattern(scoring, null, false, card(1, '♠', 5), 0, 1)
    expect(result).toEqual({ bonus: 0, parts: [], newStairDir: 0, newStairLen: 1 })
  })

  test('同スートはsuitBonusが付く', () => {
    const prev = card(1, '♠', 5)
    const result = evaluatePattern(scoring, prev, false, card(2, '♠', 6), 0, 1)
    expect(result.bonus).toBe(10)
    expect(result.parts).toEqual(['同スート+10'])
  })

  test('スート違いだが同色はcolorBonusが付く', () => {
    const prev = card(1, '♥', 5)
    const result = evaluatePattern(scoring, prev, false, card(2, '♦', 6), 0, 1)
    expect(result.bonus).toBe(5)
    expect(result.parts).toEqual(['同色+5'])
  })

  test('スートも色も違う場合はボーナス0(階段も不成立なら)', () => {
    const prev = card(1, '♠', 5)
    const result = evaluatePattern(scoring, prev, false, card(2, '♥', 3), 0, 1)
    expect(result.bonus).toBe(0)
    expect(result.parts).toEqual([])
  })

  test('5→6→7で3枚目に階段ボーナスが付く', () => {
    // 1枚目→2枚目: 5→6 (方向+1、長さ2、閾値3未満なのでボーナスなし)
    const step1 = evaluatePattern(scoring, card(1, '♠', 5), false, card(2, '♣', 6), 0, 1)
    expect(step1.newStairDir).toBe(1)
    expect(step1.newStairLen).toBe(2)
    expect(step1.parts.some(p => p.startsWith('階段'))).toBe(false)
    // 2枚目→3枚目: 6→7 (方向維持、長さ3、閾値到達でボーナス)
    const step2 = evaluatePattern(scoring, card(2, '♣', 6), false, card(3, '♦', 7), step1.newStairDir, step1.newStairLen)
    expect(step2.newStairLen).toBe(3)
    expect(step2.bonus).toBe(15)
    expect(step2.parts).toContain('階段3 +15')
  })

  test('5→6→5では階段は成立しない(方向反転で長さ2に戻る)', () => {
    const step1 = evaluatePattern(scoring, card(1, '♠', 5), false, card(2, '♣', 6), 0, 1)
    const step2 = evaluatePattern(scoring, card(2, '♣', 6), false, card(3, '♦', 5), step1.newStairDir, step1.newStairLen)
    expect(step2.newStairDir).toBe(-1)
    expect(step2.newStairLen).toBe(2)
    expect(step2.parts.some(p => p.startsWith('階段'))).toBe(false)
  })

  test('K→A→2はループ跨ぎで階段継続と判定される', () => {
    // K(13)→A(1): 差-12は+1に正規化
    const step1 = evaluatePattern(scoring, card(1, '♠', 13), false, card(2, '♣', 1), 0, 1)
    expect(step1.newStairDir).toBe(1)
    expect(step1.newStairLen).toBe(2)
    // A(1)→2: 差+1、方向維持で長さ3、ボーナス発生
    const step2 = evaluatePattern(scoring, card(2, '♣', 1), false, card(3, '♦', 2), step1.newStairDir, step1.newStairLen)
    expect(step2.newStairLen).toBe(3)
    expect(step2.bonus).toBe(15)
  })

  test('ワイルド直後はwildSuitBonusが無条件で付く', () => {
    const result = evaluatePattern(scoring, card(1, '★', 0, true), true, card(2, '♠', 9), 0, 1)
    expect(result.bonus).toBe(10)
    expect(result.parts).toEqual(['★同スート+10'])
    expect(result.newStairDir).toBe(0)
    expect(result.newStairLen).toBe(1)
  })

  test('ワイルド直後でも進行中の階段があれば延長・ボーナスも加算される', () => {
    // 進行中の階段: 方向+1、長さ2の状態でワイルドをまたいで次の札が来た場合
    const result = evaluatePattern(scoring, card(1, '★', 0, true), true, card(2, '♠', 9), 1, 2)
    expect(result.newStairDir).toBe(1)
    expect(result.newStairLen).toBe(3)
    expect(result.bonus).toBe(10 + 15) // wildSuitBonus + stairBonus
    expect(result.parts).toEqual(['★同スート+10', '階段3 +15'])
  })
})
```

- [ ] **Step 2: テストが失敗することを確認する**

Run: `npx vitest run src/lib/game/culmen/engine.test.ts`
Expected: FAIL(`./engine` が存在しない)

- [ ] **Step 3: 実装する(このタスクの範囲で必要な部分のみ)**

```ts
// src/lib/game/culmen/engine.ts
import type { Card, StageModifier } from './types'
import type { CulmenParams } from './params'

const RANK_LABEL: Record<number, string> = { 1: 'A', 11: 'J', 12: 'Q', 13: 'K' }

export function isRed(card: Card): boolean {
  return card.suit === '♥' || card.suit === '♦'
}

export function isFace(card: Card): boolean {
  return card.rank >= 11
}

export function rankLabel(card: Card): string {
  if (card.wild) return '★'
  return RANK_LABEL[card.rank] ?? String(card.rank)
}

export interface PatternResult {
  bonus: number
  parts: string[]
  newStairDir: -1 | 0 | 1
  newStairLen: number
}

export function evaluatePattern(
  scoring: CulmenParams['scoring'],
  prev: Card | null,
  prevIsWild: boolean,
  card: Card,
  stairDir: -1 | 0 | 1,
  stairLen: number
): PatternResult {
  if (!prev) {
    return { bonus: 0, parts: [], newStairDir: 0, newStairLen: 1 }
  }

  if (prevIsWild) {
    let bonus = scoring.wildSuitBonus
    const parts = [`★同スート+${scoring.wildSuitBonus}`]
    let newStairDir: -1 | 0 | 1 = 0
    let newStairLen = 1
    if (stairDir !== 0) {
      newStairDir = stairDir
      newStairLen = stairLen + 1
      if (newStairLen >= scoring.stairMinLen) {
        bonus += scoring.stairBonus
        parts.push(`階段${newStairLen} +${scoring.stairBonus}`)
      }
    }
    return { bonus, parts, newStairDir, newStairLen }
  }

  let bonus = 0
  const parts: string[] = []
  if (card.suit === prev.suit) {
    bonus += scoring.suitBonus
    parts.push(`同スート+${scoring.suitBonus}`)
  } else if (isRed(card) === isRed(prev)) {
    bonus += scoring.colorBonus
    parts.push(`同色+${scoring.colorBonus}`)
  }

  let d = card.rank - prev.rank
  if (d === 12) d = -1
  if (d === -12) d = 1

  let newStairDir: -1 | 0 | 1 = 0
  let newStairLen = 1
  if (Math.abs(d) === 1) {
    if (d === stairDir) {
      newStairDir = d as -1 | 1
      newStairLen = stairLen + 1
    } else {
      newStairDir = d as -1 | 1
      newStairLen = 2
    }
    if (newStairLen >= scoring.stairMinLen) {
      bonus += scoring.stairBonus
      parts.push(`階段${newStairLen} +${scoring.stairBonus}`)
    }
  }

  return { bonus, parts, newStairDir, newStairLen }
}
```

- [ ] **Step 4: テストが通ることを確認する**

Run: `npx vitest run src/lib/game/culmen/engine.test.ts`
Expected: PASS(全テスト)

- [ ] **Step 5: コミット**

```bash
git add src/lib/game/culmen/engine.ts src/lib/game/culmen/engine.test.ts
git commit -m "feat: Culmenのパターンボーナス判定ロジックを追加"
```

---

### Task 5: エンジン — プレイ可否判定・補助関数

**Files:**
- Modify: `src/lib/game/culmen/engine.ts`
- Modify: `src/lib/game/culmen/engine.test.ts`

- [ ] **Step 1: 失敗するテストを追記する**

`engine.test.ts` の末尾に追記:

```ts
import { isPlayable, getPlayableColumns, remainingCount } from './engine'
import type { WaveState } from './types'

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
    stairDir: 0,
    stairLen: 1,
    status: 'playing',
    endReason: null,
    lastGain: null,
    ...overrides,
  }
}

describe('isPlayable', () => {
  test('ランク差1は取れる', () => {
    const wave = makeWave({ foundation: card(1, '♠', 5) })
    expect(isPlayable('none', wave, card(2, '♣', 6))).toBe(true)
    expect(isPlayable('none', wave, card(3, '♣', 4))).toBe(true)
  })

  test('ランク差2は取れない', () => {
    const wave = makeWave({ foundation: card(1, '♠', 5) })
    expect(isPlayable('none', wave, card(2, '♣', 7))).toBe(false)
  })

  test('A-Kループは通常時のみ取れる、noLoop中は取れない', () => {
    const wave = makeWave({ foundation: card(1, '♠', 13) })
    expect(isPlayable('none', wave, card(2, '♣', 1))).toBe(true)
    expect(isPlayable('noLoop', wave, card(2, '♣', 1))).toBe(false)
  })

  test('faceLock中はコンボ2未満だと絵札を取れない', () => {
    const wave = makeWave({ foundation: card(1, '♠', 10), combo: 1 })
    expect(isPlayable('faceLock', wave, card(2, '♣', 11))).toBe(false)
    const wave2 = makeWave({ foundation: card(1, '♠', 10), combo: 2 })
    expect(isPlayable('faceLock', wave2, card(2, '♣', 11))).toBe(true)
  })

  test('faceLock中は場札(foundation)がワイルドでもコンボ不足なら絵札を拒否する', () => {
    const wave = makeWave({ foundation: card(1, '★', 0, true), combo: 0 })
    expect(isPlayable('faceLock', wave, card(2, '♣', 12))).toBe(false)
  })

  test('ワイルドの札、またはfoundationがワイルドなら基本は取れる', () => {
    const wave = makeWave({ foundation: card(1, '♠', 5) })
    expect(isPlayable('none', wave, card(2, '★', 0, true))).toBe(true)
    const wildFoundationWave = makeWave({ foundation: card(1, '★', 0, true) })
    expect(isPlayable('none', wildFoundationWave, card(2, '♣', 9))).toBe(true)
  })
})

describe('getPlayableColumns / remainingCount', () => {
  test('各列の一番手前のカードのみ判定対象になる', () => {
    const wave = makeWave({
      foundation: card(1, '♠', 5),
      tableau: [
        [card(2, '♣', 9), card(3, '♣', 6)], // 一番手前=6 → 取れる
        [card(4, '♦', 2)],                   // 取れない
      ],
    })
    expect(getPlayableColumns('none', wave)).toEqual(new Set([0]))
  })

  test('remainingCountは全列の合計枚数', () => {
    const wave = makeWave({
      tableau: [[card(1, '♠', 1)], [card(2, '♠', 2), card(3, '♠', 3)]],
    })
    expect(remainingCount(wave)).toBe(3)
  })
})
```

- [ ] **Step 2: テストが失敗することを確認する**

Run: `npx vitest run src/lib/game/culmen/engine.test.ts`
Expected: FAIL(`isPlayable` / `getPlayableColumns` / `remainingCount` が存在しない)

- [ ] **Step 3: 実装を追記する**

`engine.ts` の末尾に追記:

```ts
import type { WaveState } from './types'

export function isPlayable(modifier: StageModifier, wave: WaveState, card: Card): boolean {
  if (modifier === 'faceLock' && isFace(card) && wave.combo < 2) return false
  if (card.wild || wave.foundation.wild) return true
  const d = Math.abs(card.rank - wave.foundation.rank)
  if (d === 1) return true
  if (d === 12 && modifier !== 'noLoop') return true
  return false
}

export function getPlayableColumns(modifier: StageModifier, wave: WaveState): Set<number> {
  const result = new Set<number>()
  wave.tableau.forEach((col, i) => {
    const top = col[col.length - 1]
    if (top && isPlayable(modifier, wave, top)) result.add(i)
  })
  return result
}

export function remainingCount(wave: WaveState): number {
  return wave.tableau.reduce((n, c) => n + c.length, 0)
}
```

`import type { Card, StageModifier } from './types'` は既存の import 文に `WaveState` を追加する形にまとめてよい(重複import不可のため、ファイル先頭の import 文を編集すること)。

- [ ] **Step 4: テストが通ることを確認する**

Run: `npx vitest run src/lib/game/culmen/engine.test.ts`
Expected: PASS(全テスト)

- [ ] **Step 5: コミット**

```bash
git add src/lib/game/culmen/engine.ts src/lib/game/culmen/engine.test.ts
git commit -m "feat: Culmenのプレイ可否判定・補助関数を追加"
```

---

### Task 6: エンジン — ウェーブ開始(startWave)

**Files:**
- Modify: `src/lib/game/culmen/engine.ts`
- Modify: `src/lib/game/culmen/engine.test.ts`

- [ ] **Step 1: 失敗するテストを追記する**

```ts
import { startWave } from './engine'
import { DEFAULT_PARAMS } from './params'

describe('startWave', () => {
  test('場札はcols×rowsの列数・枚数になる', () => {
    const wave = startWave(DEFAULT_PARAMS, 0, 0, [], 1)
    expect(wave.tableau).toHaveLength(DEFAULT_PARAMS.layout.cols)
    wave.tableau.forEach(col => expect(col).toHaveLength(DEFAULT_PARAMS.layout.rows))
  })

  test('山札+場札+foundationで52枚になる(アイテムなし)', () => {
    const wave = startWave(DEFAULT_PARAMS, 0, 0, [], 1)
    const tableauCount = wave.tableau.reduce((n, c) => n + c.length, 0)
    expect(tableauCount + wave.stock.length + 1).toBe(52)
  })

  test('初期状態: スコア0、コンボ0、チェーン空、階段未成立', () => {
    const wave = startWave(DEFAULT_PARAMS, 0, 0, [], 1)
    expect(wave.score).toBe(0)
    expect(wave.combo).toBe(0)
    expect(wave.chain).toEqual([])
    expect(wave.linked).toBe(false)
    expect(wave.stairDir).toBe(0)
    expect(wave.stairLen).toBe(1)
    expect(wave.status).toBe('playing')
  })

  test('「助走」所持時はコンボがstartComboから始まる', () => {
    const wave = startWave(DEFAULT_PARAMS, 0, 0, ['start1'], 1)
    expect(wave.combo).toBe(DEFAULT_PARAMS.items.startCombo)
  })

  test('「コンボシールド」所持数×shieldChargesPerPick がshieldLeftになる', () => {
    const wave = startWave(DEFAULT_PARAMS, 0, 0, ['shield', 'shield'], 1)
    expect(wave.shieldLeft).toBe(2 * DEFAULT_PARAMS.items.shieldChargesPerPick)
  })

  test('「厚めの山札」所持数に応じて山札が増える', () => {
    const base = startWave(DEFAULT_PARAMS, 0, 0, [], 1)
    const withItem = startWave(DEFAULT_PARAMS, 0, 0, ['stock5'], 1)
    expect(withItem.stock.length).toBe(base.stock.length + DEFAULT_PARAMS.items.extraStockCount)
  })

  test('「ワイルド★」所持数に応じて山札にワイルドが混入する', () => {
    const wave = startWave(DEFAULT_PARAMS, 0, 0, ['wild1', 'wild1'], 1)
    const wildCount = wave.stock.filter(c => c.wild).length
    expect(wildCount).toBe(2 * DEFAULT_PARAMS.items.wildPerPick)
  })

  test('同じシードなら同じ結果になる(決定的)', () => {
    const a = startWave(DEFAULT_PARAMS, 0, 0, ['stock5', 'wild1'], 123)
    const b = startWave(DEFAULT_PARAMS, 0, 0, ['stock5', 'wild1'], 123)
    expect(a).toEqual(b)
  })
})
```

- [ ] **Step 2: テストが失敗することを確認する**

Run: `npx vitest run src/lib/game/culmen/engine.test.ts`
Expected: FAIL(`startWave` が存在しない)

- [ ] **Step 3: 実装を追記する**

```ts
import type { ItemId } from './types'
import { createDeck, createRng, shuffle } from './deck'
import type { WaveEndReason } from './types'

function countItem(items: ItemId[], id: ItemId): number {
  return items.filter(x => x === id).length
}

export function startWave(
  params: CulmenParams,
  stageIndex: number,
  waveIndex: number,
  items: ItemId[],
  seed?: number
): WaveState {
  const rand = createRng(seed ?? Math.floor(Math.random() * 999999) + 1)
  let idSeq = 0
  const nextId = () => ++idSeq

  const shieldCount = countItem(items, 'shield')
  const stock5Count = countItem(items, 'stock5')
  const wild1Count = countItem(items, 'wild1')
  const hasStart1 = items.includes('start1')

  let deck = shuffle(createDeck(nextId), rand)
  const { cols, rows } = params.layout
  const tableau: Card[][] = []
  for (let c = 0; c < cols; c++) {
    tableau.push(deck.splice(0, rows))
  }
  const foundation = deck.pop() as Card

  const extra = stock5Count * params.items.extraStockCount
  if (extra > 0) {
    const dupSource = shuffle(createDeck(nextId), rand).slice(0, extra)
    deck = shuffle([...deck, ...dupSource], rand)
  }

  const wildCount = wild1Count * params.items.wildPerPick
  for (let i = 0; i < wildCount; i++) {
    const pos = Math.floor(rand() * Math.max(1, deck.length))
    deck.splice(pos, 0, { id: nextId(), suit: '★', rank: 0, wild: true })
  }

  return {
    tableau,
    stock: deck,
    foundation,
    score: 0,
    combo: hasStart1 ? params.items.startCombo : 0,
    shieldLeft: shieldCount * params.items.shieldChargesPerPick,
    chain: [],
    linked: false,
    stairDir: 0,
    stairLen: 1,
    status: 'playing',
    endReason: null as WaveEndReason,
    lastGain: null,
  }
}
```

`stageIndex` / `waveIndex` 引数は今のタスクでは未使用だが、後続タスク(ラン管理)で `params.stages[stageIndex]` の参照や将来の拡張のためシグネチャに含めておく(ESLintの未使用引数エラーが出る場合は `_stageIndex` / `_waveIndex` のようにアンダースコア接頭辞を付けること)。

- [ ] **Step 4: テストが通ることを確認する**

Run: `npx vitest run src/lib/game/culmen/engine.test.ts`
Expected: PASS(全テスト)

- [ ] **Step 5: コミット**

```bash
git add src/lib/game/culmen/engine.ts src/lib/game/culmen/engine.test.ts
git commit -m "feat: Culmenのウェーブ開始処理(startWave)を追加"
```

---

### Task 7: エンジン — カードを取る(playCard)

**Files:**
- Modify: `src/lib/game/culmen/engine.ts`
- Modify: `src/lib/game/culmen/engine.test.ts`

- [ ] **Step 1: 失敗するテストを追記する**

```ts
import { playCard } from './engine'

describe('playCard', () => {
  function baseWave(overrides: Partial<WaveState> = {}): WaveState {
    return makeWave({
      foundation: card(0, '♠', 5),
      tableau: [[card(1, '♣', 6)], [card(2, '♦', 2)]],
      ...overrides,
    })
  }

  test('取れない列を指定した場合は何も変わらない', () => {
    const wave = baseWave()
    const next = playCard(DEFAULT_PARAMS, wave, 'none', [], 1000, 1) // 列1(2)は取れない
    expect(next).toBe(wave)
  })

  test('基本点×コンボで加点され、場札とチェーンが更新される', () => {
    const wave = baseWave()
    const next = playCard(DEFAULT_PARAMS, wave, 'none', [], 1000, 0)
    expect(next.combo).toBe(1)
    expect(next.score).toBe(DEFAULT_PARAMS.scoring.basePoint * 1)
    expect(next.foundation).toEqual(card(1, '♣', 6))
    expect(next.chain).toEqual([card(1, '♣', 6)])
    expect(next.tableau[0]).toEqual([])
  })

  test('「紅の目利き」所持時、赤札の基礎点が加算される(内訳表示には出ない)', () => {
    const wave = baseWave({ tableau: [[card(1, '♥', 6)], [card(2, '♦', 2)]] })
    const next = playCard(DEFAULT_PARAMS, wave, 'none', ['red5'], 1000, 0)
    expect(next.score).toBe(DEFAULT_PARAMS.scoring.basePoint + DEFAULT_PARAMS.items.redBonusValue)
    expect(next.lastGain?.parts).toEqual([])
  })

  test('「宮廷の紋章」所持時、絵札の基礎点が加算される', () => {
    const wave = baseWave({ tableau: [[card(1, '♣', 4)], [card(2, '♣', 11)]], foundation: card(0, '♣', 12) })
    // rank差 12→11 = 1 なので取れる
    const next = playCard(DEFAULT_PARAMS, wave, 'none', ['face10'], 1000, 1)
    expect(next.score).toBe(DEFAULT_PARAMS.scoring.basePoint + DEFAULT_PARAMS.items.faceBonusValue)
  })

  test('場札が0枚になったら全消しボーナスが加算されendReason=fullClear', () => {
    const wave = baseWave({ tableau: [[card(1, '♣', 6)]] })
    const next = playCard(DEFAULT_PARAMS, wave, 'none', [], 100000, 0)
    expect(next.tableau.reduce((n, c) => n + c.length, 0)).toBe(0)
    expect(next.status).toBe('ended')
    expect(next.endReason).toBe('fullClear')
    expect(next.score).toBe(DEFAULT_PARAMS.scoring.basePoint + DEFAULT_PARAMS.scoring.clearBonus)
  })

  test('「完全消去」所持時は全消しボーナスにさらに加算される', () => {
    const wave = baseWave({ tableau: [[card(1, '♣', 6)]] })
    const next = playCard(DEFAULT_PARAMS, wave, 'none', ['clear300'], 100000, 0)
    expect(next.score).toBe(
      DEFAULT_PARAMS.scoring.basePoint + DEFAULT_PARAMS.scoring.clearBonus + DEFAULT_PARAMS.items.fullClearItemBonus
    )
  })

  test('スコアが目標に達したらendReason=targetでstatus=ended', () => {
    const wave = baseWave()
    const next = playCard(DEFAULT_PARAMS, wave, 'none', [], 5, 0) // basePoint(10) >= target(5)
    expect(next.status).toBe('ended')
    expect(next.endReason).toBe('target')
  })

  test('status が playing でない場合は何もしない', () => {
    const wave = baseWave({ status: 'ended', endReason: 'target' })
    const next = playCard(DEFAULT_PARAMS, wave, 'none', [], 1000, 0)
    expect(next).toBe(wave)
  })
})
```

- [ ] **Step 2: テストが失敗することを確認する**

Run: `npx vitest run src/lib/game/culmen/engine.test.ts`
Expected: FAIL(`playCard` が存在しない)

- [ ] **Step 3: 実装を追記する**

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

  const prevCard = wave.linked && wave.chain.length > 0 ? wave.chain[wave.chain.length - 1] : null
  const prevIsWild = !!prevCard?.wild
  const pattern = evaluatePattern(params.scoring, prevCard, prevIsWild, card, wave.stairDir, wave.stairLen)
  base += pattern.bonus

  const gained = base * newCombo
  const newTableau = wave.tableau.map((c, i) => (i === colIndex ? c.slice(0, -1) : c))
  const remaining = newTableau.reduce((n, c) => n + c.length, 0)
  const newScore = wave.score + gained

  const next: WaveState = {
    ...wave,
    tableau: newTableau,
    foundation: card,
    combo: newCombo,
    chain: [...wave.chain, card],
    linked: true,
    stairDir: pattern.newStairDir,
    stairLen: pattern.newStairLen,
    score: newScore,
    lastGain: { points: gained, parts: pattern.parts },
    status: 'playing',
    endReason: null,
  }

  if (remaining === 0) {
    const bonus = params.scoring.clearBonus + (items.includes('clear300') ? params.items.fullClearItemBonus : 0)
    return { ...next, score: newScore + bonus, status: 'ended', endReason: 'fullClear' }
  }

  if (newScore >= target) {
    return { ...next, status: 'ended', endReason: 'target' }
  }

  return next
}
```

- [ ] **Step 4: テストが通ることを確認する**

Run: `npx vitest run src/lib/game/culmen/engine.test.ts`
Expected: PASS(全テスト)

- [ ] **Step 5: コミット**

```bash
git add src/lib/game/culmen/engine.ts src/lib/game/culmen/engine.test.ts
git commit -m "feat: Culmenのカードプレイ処理(playCard)を追加"
```

---

### Task 8: エンジン — 山札めくり(drawStock)

**Files:**
- Modify: `src/lib/game/culmen/engine.ts`
- Modify: `src/lib/game/culmen/engine.test.ts`

- [ ] **Step 1: 失敗するテストを追記する**

```ts
import { drawStock } from './engine'

describe('drawStock', () => {
  test('山札が空なら何もしない', () => {
    const wave = makeWave({ stock: [] })
    expect(drawStock(DEFAULT_PARAMS, wave, [])).toBe(wave)
  })

  test('通常時(コンボがbaseCombo以下、またはシールドなし): コンボ・チェーンがリセットされる', () => {
    const wave = makeWave({
      stock: [card(1, '♠', 9)],
      combo: 3,
      shieldLeft: 0,
      chain: [card(2, '♣', 1)],
      linked: true,
      stairDir: 1,
      stairLen: 2,
    })
    const next = drawStock(DEFAULT_PARAMS, wave, [])
    expect(next.foundation).toEqual(card(1, '♠', 9))
    expect(next.combo).toBe(0)
    expect(next.chain).toEqual([])
    expect(next.linked).toBe(false)
    expect(next.stairDir).toBe(0)
    expect(next.stairLen).toBe(1)
    expect(next.stock).toEqual([])
  })

  test('「助走」所持時のリセット後コンボはstartComboになる', () => {
    const wave = makeWave({ stock: [card(1, '♠', 9)], combo: 3, shieldLeft: 0 })
    const next = drawStock(DEFAULT_PARAMS, wave, ['start1'])
    expect(next.combo).toBe(DEFAULT_PARAMS.items.startCombo)
  })

  test('ワイルドがめくれた場合: コンボは変わらずチェーンに追加される', () => {
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
  })

  test('シールド発動時: コンボ維持・shieldLeft減少・得点は付かずチェーンに加わる', () => {
    const wave = makeWave({
      stock: [card(1, '♣', 6)],
      combo: 2,
      shieldLeft: 1,
      chain: [card(2, '♣', 5)],
      linked: true,
      stairDir: 0,
      stairLen: 1,
    })
    const next = drawStock(DEFAULT_PARAMS, wave, [])
    expect(next.combo).toBe(2)
    expect(next.shieldLeft).toBe(0)
    expect(next.chain).toEqual([card(2, '♣', 5), card(1, '♣', 6)])
    expect(next.stairDir).toBe(1) // 5→6 で階段開始
    expect(next.stairLen).toBe(2)
  })

  test('コンボがbaseCombo以下ならシールドがあっても消費せずリセットする', () => {
    const wave = makeWave({ stock: [card(1, '♣', 6)], combo: 0, shieldLeft: 2 })
    const next = drawStock(DEFAULT_PARAMS, wave, [])
    expect(next.shieldLeft).toBe(2)
    expect(next.combo).toBe(0)
    expect(next.chain).toEqual([])
  })
})
```

- [ ] **Step 2: テストが失敗することを確認する**

Run: `npx vitest run src/lib/game/culmen/engine.test.ts`
Expected: FAIL(`drawStock` が存在しない)

- [ ] **Step 3: 実装を追記する**

```ts
export function drawStock(params: CulmenParams, wave: WaveState, items: ItemId[]): WaveState {
  if (wave.status !== 'playing') return wave
  if (wave.stock.length === 0) return wave

  const newStock = [...wave.stock]
  const card = newStock.pop() as Card
  const baseCombo = items.includes('start1') ? params.items.startCombo : 0

  if (card.wild) {
    return {
      ...wave,
      stock: newStock,
      foundation: card,
      chain: [...wave.chain, card],
      linked: true,
    }
  }

  if (wave.combo > baseCombo && wave.shieldLeft > 0) {
    const prev = wave.linked ? [...wave.chain].reverse().find(c => !c.wild) ?? null : null
    let newStairDir: -1 | 0 | 1 = 0
    let newStairLen = 1
    if (prev) {
      let d = card.rank - prev.rank
      if (d === 12) d = -1
      if (d === -12) d = 1
      if (Math.abs(d) === 1) {
        if (d === wave.stairDir) {
          newStairDir = d as -1 | 1
          newStairLen = wave.stairLen + 1
        } else {
          newStairDir = d as -1 | 1
          newStairLen = 2
        }
      }
    }
    return {
      ...wave,
      stock: newStock,
      foundation: card,
      shieldLeft: wave.shieldLeft - 1,
      chain: [...wave.chain, card],
      linked: true,
      stairDir: newStairDir,
      stairLen: newStairLen,
    }
  }

  return {
    ...wave,
    stock: newStock,
    foundation: card,
    combo: baseCombo,
    chain: [],
    linked: false,
    stairDir: 0,
    stairLen: 1,
  }
}
```

- [ ] **Step 4: テストが通ることを確認する**

Run: `npx vitest run src/lib/game/culmen/engine.test.ts`
Expected: PASS(全テスト)

- [ ] **Step 5: コミット**

```bash
git add src/lib/game/culmen/engine.ts src/lib/game/culmen/engine.test.ts
git commit -m "feat: Culmenの山札めくり処理(drawStock)を追加"
```

---

### Task 9: エンジン — 手詰まり判定・アイテム抽選

**Files:**
- Modify: `src/lib/game/culmen/engine.ts`
- Modify: `src/lib/game/culmen/engine.test.ts`

- [ ] **Step 1: 失敗するテストを追記する**

```ts
import { isStuck, markStuck, rollItemOffer, ITEM_POOL, UNIQUE_ITEMS, ITEM_NAMES, itemDesc } from './engine'
import { createRng } from './deck'

describe('isStuck', () => {
  test('場札が残っていて山札が空、かつ取れる札が無いなら手詰まり', () => {
    const wave = makeWave({
      foundation: card(0, '♠', 5),
      stock: [],
      tableau: [[card(1, '♣', 9)]], // 差4、取れない
    })
    expect(isStuck('none', wave)).toBe(true)
  })

  test('取れる札があれば手詰まりではない', () => {
    const wave = makeWave({
      foundation: card(0, '♠', 5),
      stock: [],
      tableau: [[card(1, '♣', 6)]],
    })
    expect(isStuck('none', wave)).toBe(false)
  })

  test('山札が残っていれば手詰まりではない', () => {
    const wave = makeWave({
      foundation: card(0, '♠', 5),
      stock: [card(2, '♦', 1)],
      tableau: [[card(1, '♣', 9)]],
    })
    expect(isStuck('none', wave)).toBe(false)
  })

  test('場札が0枚なら手詰まりではない(全消し扱い)', () => {
    const wave = makeWave({ stock: [], tableau: [] })
    expect(isStuck('none', wave)).toBe(false)
  })
})

describe('markStuck', () => {
  test('playing中のウェーブをended/stuckにする', () => {
    const wave = makeWave({ status: 'playing' })
    const next = markStuck(wave)
    expect(next.status).toBe('ended')
    expect(next.endReason).toBe('stuck')
  })

  test('既にendedなら変化しない', () => {
    const wave = makeWave({ status: 'ended', endReason: 'target' })
    expect(markStuck(wave)).toBe(wave)
  })
})

describe('rollItemOffer', () => {
  test('3種類を返す', () => {
    const offer = rollItemOffer([], createRng(1))
    expect(offer).toHaveLength(3)
    expect(new Set(offer).size).toBe(3)
  })

  test('取得済みのユニークアイテムは候補から除外される', () => {
    const owned = UNIQUE_ITEMS.slice(0, 3) // 4種のうち3種を所持済みにする
    const offer = rollItemOffer(owned, createRng(1))
    offer.forEach(id => expect(owned.includes(id)).toBe(false))
  })

  test('重複取得可能なアイテムは所持済みでも候補に残る', () => {
    const rand = createRng(2)
    const offer = rollItemOffer(['shield', 'shield', 'stock5'], rand)
    expect(offer.length).toBe(3)
  })
})

describe('ITEM_POOL / ITEM_NAMES / itemDesc', () => {
  test('7種類のアイテムが定義されている', () => {
    expect(ITEM_POOL).toHaveLength(7)
    ITEM_POOL.forEach(id => expect(ITEM_NAMES[id]).toBeTruthy())
  })

  test('itemDescはパラメータの数値を埋め込んだ説明文を返す', () => {
    expect(itemDesc('red5', DEFAULT_PARAMS)).toContain(String(DEFAULT_PARAMS.items.redBonusValue))
    expect(itemDesc('clear300', DEFAULT_PARAMS)).toContain(String(DEFAULT_PARAMS.items.fullClearItemBonus))
  })
})
```

- [ ] **Step 2: テストが失敗することを確認する**

Run: `npx vitest run src/lib/game/culmen/engine.test.ts`
Expected: FAIL(該当エクスポートが存在しない)

- [ ] **Step 3: 実装を追記する**

```ts
export function isStuck(modifier: StageModifier, wave: WaveState): boolean {
  const remaining = remainingCount(wave)
  if (remaining === 0) return false
  if (wave.stock.length > 0) return false
  return getPlayableColumns(modifier, wave).size === 0
}

export function markStuck(wave: WaveState): WaveState {
  if (wave.status !== 'playing') return wave
  return { ...wave, status: 'ended', endReason: 'stuck' }
}

export const ITEM_POOL: ItemId[] = ['red5', 'face10', 'shield', 'stock5', 'wild1', 'start1', 'clear300']
export const UNIQUE_ITEMS: ItemId[] = ['red5', 'face10', 'start1', 'clear300']

export const ITEM_NAMES: Record<ItemId, string> = {
  red5: '紅の目利き',
  face10: '宮廷の紋章',
  shield: 'コンボシールド',
  stock5: '厚めの山札',
  wild1: 'ワイルド★',
  start1: '助走',
  clear300: '完全消去',
}

export function itemDesc(id: ItemId, params: CulmenParams): string {
  switch (id) {
    case 'red5': return `♥♦の基礎点 +${params.items.redBonusValue}`
    case 'face10': return `J/Q/Kの基礎点 +${params.items.faceBonusValue}`
    case 'shield': return `山札めくりのコンボリセットを毎ウェーブ${params.items.shieldChargesPerPick}回無効`
    case 'stock5': return `山札 +${params.items.extraStockCount}枚`
    case 'wild1': return `毎ウェーブ山札に★を${params.items.wildPerPick}枚混入`
    case 'start1': return `コンボが${params.items.startCombo}からスタート`
    case 'clear300': return `全消しボーナス +${params.items.fullClearItemBonus}`
  }
}

function shuffleItems(list: ItemId[], rand: () => number): ItemId[] {
  const arr = [...list]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

export function rollItemOffer(items: ItemId[], rand: () => number = Math.random): ItemId[] {
  const available = ITEM_POOL.filter(id => !(UNIQUE_ITEMS.includes(id) && items.includes(id)))
  return shuffleItems(available, rand).slice(0, 3)
}
```

- [ ] **Step 4: テストが通ることを確認する**

Run: `npx vitest run src/lib/game/culmen/engine.test.ts`
Expected: PASS(全テスト)

- [ ] **Step 5: コミット**

```bash
git add src/lib/game/culmen/engine.ts src/lib/game/culmen/engine.test.ts
git commit -m "feat: Culmenの手詰まり判定・アイテム抽選を追加"
```

---

### Task 10: エンジン — ラン進行(タイトル〜アイテム選択〜ステージクリア〜ゲームオーバー)

**Files:**
- Modify: `src/lib/game/culmen/engine.ts`
- Modify: `src/lib/game/culmen/engine.test.ts`

- [ ] **Step 1: 失敗するテストを追記する**

```ts
import {
  createInitialRun, beginRun, resolveWaveEnd, pickItem, advanceStage, restartRun,
  applyPlayCard, applyDrawStock, applyStuckCheck,
} from './engine'
import type { RunState } from './types'

describe('createInitialRun / beginRun', () => {
  test('createInitialRunはtitleフェーズでwave=null', () => {
    const run = createInitialRun()
    expect(run.phase).toBe('title')
    expect(run.wave).toBeNull()
    expect(run.items).toEqual([])
  })

  test('beginRunはplayingフェーズでステージ0・ウェーブ0から始まる', () => {
    const run = beginRun(DEFAULT_PARAMS, 1)
    expect(run.phase).toBe('playing')
    expect(run.stageIndex).toBe(0)
    expect(run.waveIndex).toBe(0)
    expect(run.wave).not.toBeNull()
  })
})

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

  test('ウェーブ1・2クリアならitemSelectになりofferが3件入る', () => {
    const run = endedRun({ waveIndex: 0 }, DEFAULT_PARAMS.stages[0].targets[0])
    const next = resolveWaveEnd(DEFAULT_PARAMS, run, createRng(5))
    expect(next.phase).toBe('itemSelect')
    expect(next.offer).toHaveLength(3)
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

describe('pickItem / advanceStage / restartRun', () => {
  test('pickItemでアイテムが追加され次ウェーブが始まる', () => {
    const run: RunState = { ...beginRun(DEFAULT_PARAMS, 1), phase: 'itemSelect', waveIndex: 0, offer: ['shield', 'stock5', 'wild1'] }
    const next = pickItem(DEFAULT_PARAMS, run, 'shield', 2)
    expect(next.phase).toBe('playing')
    expect(next.items).toEqual(['shield'])
    expect(next.waveIndex).toBe(1)
    expect(next.wave?.shieldLeft).toBe(DEFAULT_PARAMS.items.shieldChargesPerPick)
  })

  test('advanceStageで次ステージのウェーブ0から始まる', () => {
    const run: RunState = { ...beginRun(DEFAULT_PARAMS, 1), phase: 'stageClear', stageIndex: 0 }
    const next = advanceStage(DEFAULT_PARAMS, run, 2)
    expect(next.phase).toBe('playing')
    expect(next.stageIndex).toBe(1)
    expect(next.waveIndex).toBe(0)
  })

  test('restartRunでステージ0・ウェーブ0・アイテムなしに戻る', () => {
    const next = restartRun(DEFAULT_PARAMS, 1)
    expect(next.phase).toBe('playing')
    expect(next.stageIndex).toBe(0)
    expect(next.waveIndex).toBe(0)
    expect(next.items).toEqual([])
  })
})

describe('applyPlayCard / applyDrawStock / applyStuckCheck', () => {
  test('applyPlayCardはrun.waveを更新する', () => {
    const run = beginRun(DEFAULT_PARAMS, 1)
    const col0 = run.wave!.tableau[0]
    const before = col0.length
    const next = applyPlayCard(DEFAULT_PARAMS, run, 0)
    // 取れない場合は変化なし、取れた場合は1枚減る。どちらでもrunオブジェクトの形は保たれる
    expect(next.wave!.tableau[0].length).toBeLessThanOrEqual(before)
  })

  test('applyDrawStockはrun.wave.stockを減らす', () => {
    const run = beginRun(DEFAULT_PARAMS, 1)
    const before = run.wave!.stock.length
    const next = applyDrawStock(DEFAULT_PARAMS, run)
    expect(next.wave!.stock.length).toBe(before - 1)
  })

  test('applyStuckCheckは手詰まりでなければ何もしない', () => {
    const run = beginRun(DEFAULT_PARAMS, 1)
    const next = applyStuckCheck(DEFAULT_PARAMS, run)
    expect(next.wave!.status).toBe('playing')
  })

  test('phaseがplaying以外なら何もしない', () => {
    const run: RunState = { ...createInitialRun() }
    expect(applyPlayCard(DEFAULT_PARAMS, run, 0)).toBe(run)
    expect(applyDrawStock(DEFAULT_PARAMS, run)).toBe(run)
    expect(applyStuckCheck(DEFAULT_PARAMS, run)).toBe(run)
  })
})
```

- [ ] **Step 2: テストが失敗することを確認する**

Run: `npx vitest run src/lib/game/culmen/engine.test.ts`
Expected: FAIL(該当エクスポートが存在しない)

- [ ] **Step 3: 実装を追記する**

```ts
export function createInitialRun(): RunState {
  return { phase: 'title', stageIndex: 0, waveIndex: 0, items: [], offer: [], wave: null }
}

export function beginRun(params: CulmenParams, seed?: number): RunState {
  return {
    phase: 'playing',
    stageIndex: 0,
    waveIndex: 0,
    items: [],
    offer: [],
    wave: startWave(params, 0, 0, [], seed),
  }
}

export function resolveWaveEnd(params: CulmenParams, run: RunState, rand: () => number = Math.random): RunState {
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
  return { ...run, phase: 'itemSelect', offer: rollItemOffer(run.items, rand) }
}

export function pickItem(params: CulmenParams, run: RunState, itemId: ItemId, seed?: number): RunState {
  if (run.phase !== 'itemSelect') return run
  const newItems = [...run.items, itemId]
  const newWaveIndex = run.waveIndex + 1
  return {
    ...run,
    phase: 'playing',
    items: newItems,
    waveIndex: newWaveIndex,
    offer: [],
    wave: startWave(params, run.stageIndex, newWaveIndex, newItems, seed),
  }
}

export function advanceStage(params: CulmenParams, run: RunState, seed?: number): RunState {
  if (run.phase !== 'stageClear') return run
  const newStageIndex = run.stageIndex + 1
  return {
    ...run,
    phase: 'playing',
    stageIndex: newStageIndex,
    waveIndex: 0,
    wave: startWave(params, newStageIndex, 0, run.items, seed),
  }
}

export function restartRun(params: CulmenParams, seed?: number): RunState {
  return beginRun(params, seed)
}

export function applyPlayCard(params: CulmenParams, run: RunState, colIndex: number): RunState {
  if (run.phase !== 'playing' || !run.wave) return run
  const stage = params.stages[run.stageIndex]
  const target = stage.targets[run.waveIndex]
  const nextWave = playCard(params, run.wave, stage.modifier, run.items, target, colIndex)
  return { ...run, wave: nextWave }
}

export function applyDrawStock(params: CulmenParams, run: RunState): RunState {
  if (run.phase !== 'playing' || !run.wave) return run
  return { ...run, wave: drawStock(params, run.wave, run.items) }
}

export function applyStuckCheck(params: CulmenParams, run: RunState): RunState {
  if (run.phase !== 'playing' || !run.wave) return run
  const modifier = params.stages[run.stageIndex].modifier
  if (!isStuck(modifier, run.wave)) return run
  return { ...run, wave: markStuck(run.wave) }
}
```

- [ ] **Step 4: テストが通ることを確認する**

Run: `npx vitest run src/lib/game/culmen/engine.test.ts`
Expected: PASS(全テスト)

- [ ] **Step 5: 全テストスイートを実行し、既存のテストを壊していないことを確認する**

Run: `npm run test`
Expected: 全ファイルPASS

- [ ] **Step 6: コミット**

```bash
git add src/lib/game/culmen/engine.ts src/lib/game/culmen/engine.test.ts
git commit -m "feat: Culmenのラン進行(ステージ・アイテム選択・ゲームオーバー遷移)を追加"
```

---

### Task 11: vite dev サーバーの設定API・adminツール登録

**Files:**
- Modify: `vite.config.ts`
- Modify: `src/lib/site.ts`
- Modify: `src/lib/site.config.json`

- [ ] **Step 1: `vite.config.ts` に culmen 用のミドルウェアを追加する**

`animConfigApiPlugin()` 関数の直後に以下を追記する:

```ts
function culmenConfigApiPlugin(): Plugin {
  return {
    name: 'culmen-config-api',
    enforce: 'pre',
    configureServer(server) {
      const configPath = path.resolve('src/lib/game/culmen/culmen.config.json')
      server.middlewares.use('/api/admin/culmen-config', (req, res) => {
        if (req.method === 'GET') {
          try {
            res.setHeader('Content-Type', 'application/json')
            res.end(readFileSync(configPath, 'utf-8'))
          } catch {
            res.statusCode = 500
            res.end('error reading config')
          }
        } else if (req.method === 'POST') {
          let body = ''
          req.on('data', (chunk: Buffer) => { body += chunk.toString() })
          req.on('end', () => {
            try {
              const parsed = JSON.parse(body)
              writeFileSync(configPath, JSON.stringify(parsed, null, 2) + '\n')
              res.statusCode = 200
              res.end('ok')
            } catch {
              res.statusCode = 400
              res.end('invalid JSON')
            }
          })
        } else {
          res.statusCode = 405
          res.end('method not allowed')
        }
      })
    }
  }
}
```

続けて `export default defineConfig({ ... })` 内を以下のように変更する:

```ts
export default defineConfig({
  plugins: [sveltekit(), kuromojiDictRawPlugin(), adminApiPlugin(), animConfigApiPlugin(), culmenConfigApiPlugin()],
  build: {
    outDir: 'dist'
  },
  server: {
    watch: {
      // 保存APIで書き換えるたびにHMRが発火してコンポーネントが再マウントされるのを防ぐ
      ignored: ['**/site.config.json', '**/anim.config.json', '**/culmen.config.json']
    }
  },
  resolve: {
    alias: {
      // kuromoji の browser field 置換が Vite/esbuild で機能しないため、
      // browserify 済みのブラウザ用バンドル(BrowserDictionaryLoader 組み込み)を直接使う
      kuromoji: path.resolve('node_modules/kuromoji/build/kuromoji.js')
    }
  },
  optimizeDeps: {
    include: ['kuromoji']
  }
});
```

- [ ] **Step 2: `src/lib/site.ts` にツールを登録する**

`tools` 配列の `/game/flick-typing` エントリの直後に追記する:

```ts
    {
      href: "/game/culmen",
      label: "登頂ソリティア -Culmen-",
      description: "ゴルフソリティア×ローグライク。コンボと階段ボーナスでスコアを稼ぎ、アイテムで強化しながらステージを駆け上がる",
      category: 'game',
    },
```

- [ ] **Step 3: `src/lib/site.config.json` に開発中フラグと表示設定を追加する**

`toolDevStatus` に `"/game/culmen": true` を、`toolVisibility` に `"/game/culmen": true` を追加する(既存の `/game/flick-typing` の隣に追記する形):

```json
{
  "adsEnabled": true,
  "toolLabels": {
    "/music/scale-visualizer": "Scale Visualizer",
    "/music/note-duration": "Note Duration"
  },
  "toolDevStatus": {
    "/programming/sql-extract-format": true,
    "/programming/vector3-visualizer": true,
    "/image/image-tools": true,
    "/image/sns-image-resize": true,
    "/image/id-photo": true,
    "/investment/nisa-simple-calculator": true,
    "/investment/nisa-detailed-calculator": true,
    "/investment/nisa-accumulation-simulator": true,
    "/game/flick-typing": true,
    "/game/culmen": true
  },
  "toolVisibility": {
    "/music/bpm-tapper": true,
    "/music/note-duration": true,
    "/music/scale-visualizer": true,
    "/programming/hepburn-converter": true,
    "/programming/color-converter": true,
    "/programming/vector3-visualizer": false,
    "/programming/sql-extract-format": false,
    "/image/image-tools": false,
    "/image/sns-image-resize": false,
    "/image/id-photo": false,
    "/investment/nisa-simple-calculator": false,
    "/investment/nisa-detailed-calculator": false,
    "/investment/nisa-accumulation-simulator": false,
    "/game/solitaire": true,
    "/game/flick-typing": true,
    "/game/culmen": true
  }
}
```

- [ ] **Step 4: 型チェックを実行する**

Run: `npm run check`
Expected: エラーなし

- [ ] **Step 5: コミット**

```bash
git add vite.config.ts src/lib/site.ts src/lib/site.config.json
git commit -m "feat: Culmenの設定API・サイト登録を追加"
```

---

### Task 12: adminパラメータ調整ページ(/admin/culmen)

**Files:**
- Create: `src/routes/admin/culmen/+page.svelte`

- [ ] **Step 1: ページを作成する**

```svelte
<script lang="ts">
  import { onMount, onDestroy } from 'svelte'
  import { DEFAULT_PARAMS, type CulmenParams } from '$lib/game/culmen/params'

  let config = $state<CulmenParams | null>(null)
  let error = $state<string | null>(null)
  let flash = $state<string | null>(null)
  let flashTimer: ReturnType<typeof setTimeout> | null = null
  let jsonText = $state('')
  let jsonError = $state<string | null>(null)

  function showToast(message: string) {
    if (flashTimer) clearTimeout(flashTimer)
    flash = message
    flashTimer = setTimeout(() => { flash = null }, 2000)
  }

  let hasValidationError = $derived.by(() => {
    if (!config) return false
    if (config.stages.length < 1) return true
    for (const stage of config.stages) {
      if (stage.targets.some(t => !Number.isFinite(t) || t < 0)) return true
    }
    return false
  })

  let targetsNotAscending = $derived.by(() => {
    if (!config) return false
    return config.stages.some(s => !(s.targets[0] < s.targets[1] && s.targets[1] < s.targets[2]))
  })

  async function loadConfig(toast = false) {
    try {
      const res = await fetch('/api/admin/culmen-config')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      config = await res.json() as CulmenParams
      error = null
      if (toast) showToast('リロードしました')
    } catch {
      error = 'Culmen設定APIに接続できません。npm run dev で起動してください。'
      if (!config) config = JSON.parse(JSON.stringify(DEFAULT_PARAMS))
    }
  }

  async function save() {
    if (!config) return
    try {
      const res = await fetch('/api/admin/culmen-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      showToast('保存しました(反映には再ビルド・再デプロイが必要です)')
    } catch {
      error = '保存に失敗しました'
    }
  }

  function resetToDefault() {
    if (!confirm('既定値に戻しますか?')) return
    config = JSON.parse(JSON.stringify(DEFAULT_PARAMS))
  }

  function addStage() {
    if (!config) return
    config.stages.push({ name: `STAGE ${config.stages.length + 1}`, modifier: 'none', targets: [100, 200, 300] })
  }

  function removeStage(index: number) {
    if (!config) return
    if (config.stages.length <= 1) return
    config.stages.splice(index, 1)
  }

  function openJsonPanel() {
    if (!config) return
    jsonText = JSON.stringify(config, null, 2)
    jsonError = null
  }

  function applyJson() {
    try {
      const parsed = JSON.parse(jsonText) as CulmenParams
      config = parsed
      jsonError = null
      showToast('JSONを適用しました')
    } catch {
      jsonError = 'JSONの形式が正しくありません'
    }
  }

  onMount(() => loadConfig())
  onDestroy(() => {
    if (flashTimer) clearTimeout(flashTimer)
  })
</script>

<div class="max-w-3xl mx-auto px-4 py-8">
  <a href="/admin" class="text-xs text-slate-400 hover:text-teal-600 mb-4 inline-block">← 管理ページ一覧</a>

  <div class="flex items-center justify-between mb-6">
    <h1 class="text-2xl font-bold text-slate-800">登頂ソリティア -Culmen- 設定</h1>
    <div class="flex gap-2">
      <button onclick={() => loadConfig(true)} class="text-sm px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors">
        リロード
      </button>
      {#if hasValidationError}
        <p class="text-xs text-red-600 self-center">入力値が不正です</p>
      {:else if targetsNotAscending}
        <p class="text-xs text-amber-600 self-center">目標スコアが昇順ではありません</p>
      {/if}
      <button
        onclick={save}
        disabled={hasValidationError || !config}
        class="text-sm px-3 py-1.5 rounded-lg bg-teal-600 text-white hover:bg-teal-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        保存
      </button>
    </div>
  </div>

  {#if error}
    <div class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">{error}</div>
  {/if}

  {#if config}
    <div class="space-y-6">
      <section class="bg-white border border-slate-200 rounded-xl p-4">
        <h2 class="font-semibold text-slate-700 text-sm mb-3">レイアウト</h2>
        <div class="grid grid-cols-2 gap-3">
          <label class="text-xs text-slate-500">
            列数(cols)
            <input type="number" min="1" step="1" bind:value={config.layout.cols} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            段数(rows)
            <input type="number" min="1" step="1" bind:value={config.layout.rows} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
        </div>
      </section>

      <section class="bg-white border border-slate-200 rounded-xl p-4">
        <h2 class="font-semibold text-slate-700 text-sm mb-3">スコアリング</h2>
        <div class="grid grid-cols-2 gap-3">
          <label class="text-xs text-slate-500">
            基礎点(basePoint)
            <input type="number" min="0" step="1" bind:value={config.scoring.basePoint} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            同スートボーナス(suitBonus)
            <input type="number" min="0" step="1" bind:value={config.scoring.suitBonus} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            同色ボーナス(colorBonus)
            <input type="number" min="0" step="1" bind:value={config.scoring.colorBonus} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            階段ボーナス(stairBonus)
            <input type="number" min="0" step="1" bind:value={config.scoring.stairBonus} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            階段成立枚数(stairMinLen)
            <input type="number" min="2" step="1" bind:value={config.scoring.stairMinLen} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            ワイルド直後ボーナス(wildSuitBonus)
            <input type="number" min="0" step="1" bind:value={config.scoring.wildSuitBonus} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            全消しボーナス(clearBonus)
            <input type="number" min="0" step="1" bind:value={config.scoring.clearBonus} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
        </div>
      </section>

      <section class="bg-white border border-slate-200 rounded-xl p-4">
        <div class="flex items-center justify-between mb-3">
          <h2 class="font-semibold text-slate-700 text-sm">ステージ</h2>
          <button onclick={addStage} class="text-xs px-2.5 py-1 rounded border border-dashed border-slate-300 text-slate-500 hover:border-teal-400 hover:text-teal-600">+ ステージ追加</button>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-xs border border-slate-200 rounded-lg overflow-hidden">
            <thead>
              <tr class="bg-slate-50 text-slate-500">
                <th class="px-2 py-1.5 text-left">名前</th>
                <th class="px-2 py-1.5 text-left">modifier</th>
                <th class="px-2 py-1.5 text-center">target1</th>
                <th class="px-2 py-1.5 text-center">target2</th>
                <th class="px-2 py-1.5 text-center">target3</th>
                <th class="px-2 py-1.5 w-8"></th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              {#each config.stages as stage, si (si)}
                <tr>
                  <td class="px-2 py-1">
                    <input type="text" bind:value={stage.name} class="w-full border border-slate-200 rounded px-1.5 py-0.5" />
                  </td>
                  <td class="px-2 py-1">
                    <select bind:value={stage.modifier} class="w-full border border-slate-200 rounded px-1.5 py-0.5">
                      <option value="none">none</option>
                      <option value="noLoop">noLoop</option>
                      <option value="faceLock">faceLock</option>
                    </select>
                  </td>
                  {#each [0, 1, 2] as ti}
                    <td class="px-1 py-1">
                      <input type="number" min="0" step="1" bind:value={stage.targets[ti]} class="w-full text-center border border-slate-200 rounded px-1 py-0.5" />
                    </td>
                  {/each}
                  <td class="px-1 py-1 text-center">
                    <button onclick={() => removeStage(si)} disabled={config.stages.length <= 1} class="text-slate-400 hover:text-red-500 disabled:opacity-30 px-1">×</button>
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      </section>

      <section class="bg-white border border-slate-200 rounded-xl p-4">
        <h2 class="font-semibold text-slate-700 text-sm mb-3">アイテム</h2>
        <div class="grid grid-cols-2 gap-3">
          <label class="text-xs text-slate-500">
            紅の目利き(redBonusValue)
            <input type="number" min="0" step="1" bind:value={config.items.redBonusValue} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            宮廷の紋章(faceBonusValue)
            <input type="number" min="0" step="1" bind:value={config.items.faceBonusValue} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            コンボシールド回数(shieldChargesPerPick)
            <input type="number" min="0" step="1" bind:value={config.items.shieldChargesPerPick} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            厚めの山札枚数(extraStockCount)
            <input type="number" min="0" step="1" bind:value={config.items.extraStockCount} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            ワイルド混入枚数(wildPerPick)
            <input type="number" min="0" step="1" bind:value={config.items.wildPerPick} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            助走コンボ値(startCombo)
            <input type="number" min="0" step="1" bind:value={config.items.startCombo} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            完全消去加算(fullClearItemBonus)
            <input type="number" min="0" step="1" bind:value={config.items.fullClearItemBonus} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
        </div>
      </section>

      <section class="bg-white border border-slate-200 rounded-xl p-4">
        <h2 class="font-semibold text-slate-700 text-sm mb-3">フロー・UI</h2>
        <div class="grid grid-cols-2 gap-3">
          <label class="text-xs text-slate-500">
            1ステージのウェーブ数(wavesPerStage)
            <input type="number" min="1" step="1" bind:value={config.flow.wavesPerStage} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            クリア演出待ち(clearDelayMs)
            <input type="number" min="0" step="10" bind:value={config.flow.clearDelayMs} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          {#each [0, 1, 2] as ti}
            <label class="text-xs text-slate-500">
              comboTierThresholds[{ti}]
              <input type="number" min="0" step="1" bind:value={config.ui.comboTierThresholds[ti]} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
            </label>
          {/each}
        </div>
      </section>

      <section class="bg-white border border-slate-200 rounded-xl p-4">
        <div class="flex items-center justify-between mb-3">
          <h2 class="font-semibold text-slate-700 text-sm">JSON入出力</h2>
          <button onclick={openJsonPanel} class="text-xs px-2.5 py-1 rounded border border-slate-200 text-slate-500 hover:border-teal-400 hover:text-teal-600">現在値を表示</button>
        </div>
        <textarea bind:value={jsonText} rows="10" class="w-full border border-slate-200 rounded px-2 py-1.5 text-xs font-mono"></textarea>
        {#if jsonError}
          <p class="text-xs text-red-600 mt-1">{jsonError}</p>
        {/if}
        <button onclick={applyJson} class="mt-2 text-xs px-3 py-1 rounded bg-slate-700 text-white hover:bg-slate-800">貼り付けを適用</button>
      </section>

      <div class="flex justify-end">
        <button onclick={resetToDefault} class="text-xs px-3 py-1 rounded border border-slate-200 text-slate-400 hover:border-amber-400 hover:text-amber-600 transition-colors">
          デフォルトに戻す
        </button>
      </div>
    </div>
  {:else if !error}
    <p class="text-slate-500 text-sm">読み込み中...</p>
  {/if}
</div>

{#if flash}
  <div class="fixed bottom-6 right-6 bg-slate-800 text-white text-sm px-4 py-2.5 rounded-lg shadow-lg z-50">
    {flash}
  </div>
{/if}
```

- [ ] **Step 2: 開発サーバーで動作確認する**

Run: `npm run dev`

ブラウザで `http://localhost:5173/admin/culmen` を開き、以下を確認する:
- 各セクションの数値が既定値で表示される
- `basePoint` を変更して「保存」→「リロード」で変更が保持される
- ステージの追加・削除ボタンが機能する
- ステージ数を1にした状態で削除ボタンが無効化される

- [ ] **Step 3: コミット**

```bash
git add src/routes/admin/culmen/+page.svelte
git commit -m "feat: Culmenのパラメータ管理ページ(/admin/culmen)を追加"
```

---

### Task 13: ゲーム本体ページ(/game/culmen)

**Files:**
- Create: `src/routes/game/culmen/+page.svelte`

- [ ] **Step 1: ページを作成する**

```svelte
<script lang="ts">
  import { loadParams } from '$lib/game/culmen/params'
  import {
    createInitialRun, beginRun, applyPlayCard, applyDrawStock, applyStuckCheck,
    resolveWaveEnd, pickItem, advanceStage, restartRun,
    getPlayableColumns, remainingCount, rankLabel, isRed, itemDesc, ITEM_NAMES,
  } from '$lib/game/culmen/engine'
  import type { RunState, Card, ItemId, StageModifier } from '$lib/game/culmen/types'

  const params = loadParams()

  let run = $state<RunState>(createInitialRun())
  let stuckTimer: ReturnType<typeof setTimeout> | null = null

  let stage = $derived(params.stages[run.stageIndex])
  let target = $derived(stage.targets[run.waveIndex])
  let wave = $derived(run.wave)
  let playableColumns = $derived(wave ? getPlayableColumns(stage.modifier, wave) : new Set<number>())
  let remaining = $derived(wave ? remainingCount(wave) : 0)

  let comboTier = $derived.by(() => {
    const combo = wave?.combo ?? 0
    const [t1, t2, t3] = params.ui.comboTierThresholds
    return combo >= t3 ? 3 : combo >= t2 ? 2 : combo >= t1 ? 1 : 0
  })
  const comboColor = ['text-emerald-100', 'text-yellow-300', 'text-orange-400', 'text-rose-400']
  const comboScale = ['scale-100', 'scale-105', 'scale-110', 'scale-125']

  function modifierLabel(modifier: StageModifier): string {
    if (modifier === 'noLoop') return 'A-Kループ禁止'
    if (modifier === 'faceLock') return '絵札はコンボ2以上でのみ取れる'
    return '制約なし'
  }

  function scheduleStuckCheck() {
    if (stuckTimer) clearTimeout(stuckTimer)
    stuckTimer = setTimeout(() => {
      const checked = applyStuckCheck(params, run)
      if (checked.wave?.status === 'ended') {
        run = resolveWaveEnd(params, checked)
      }
    }, 600)
  }

  function afterAction() {
    if (run.wave?.status === 'ended') {
      const delay = run.wave.endReason === 'target' ? params.flow.clearDelayMs : 0
      setTimeout(() => { run = resolveWaveEnd(params, run) }, delay)
      return
    }
    scheduleStuckCheck()
  }

  function startGame() {
    run = beginRun(params)
    afterAction()
  }

  function handlePlayCard(colIndex: number) {
    if (run.phase !== 'playing') return
    run = applyPlayCard(params, run, colIndex)
    afterAction()
  }

  function handleDraw() {
    if (run.phase !== 'playing') return
    run = applyDrawStock(params, run)
    afterAction()
  }

  function handlePickItem(id: ItemId) {
    run = pickItem(params, run, id)
    afterAction()
  }

  function handleAdvanceStage() {
    run = advanceStage(params, run)
    afterAction()
  }

  function handleRestart() {
    run = restartRun(params)
    afterAction()
  }
</script>

{#snippet cardFace(card: Card, covered: boolean)}
  {#if card.wild}
    <div
      class="relative w-full rounded-md border select-none flex items-end justify-center pb-1"
      style="aspect-ratio: 2 / 3; background:#EDE4FF; color:#6D28D9; border-color:#A78BFA;"
    >
      <div class="absolute top-0.5 left-1 font-black" style="font-size:13px;">★</div>
      {#if !covered}<span class="text-base font-bold">★</span>{/if}
    </div>
  {:else}
    <div
      class="relative w-full rounded-md border select-none"
      style="aspect-ratio: 2 / 3; background:{covered ? '#E9E2D0' : '#FBF7EC'}; color:{isRed(card) ? '#C7402D' : '#15181D'}; border-color:#B8AE98;"
    >
      <div class="absolute top-0.5 left-1 flex items-baseline gap-0.5 leading-none">
        <span class="font-black" style="font-size:13px;">{rankLabel(card)}</span>
        <span class="font-bold" style="font-size:10px;">{card.suit}</span>
      </div>
      {#if !covered}
        <div class="absolute inset-0 flex items-end justify-center pb-1 text-base font-bold">{card.suit}</div>
      {/if}
    </div>
  {/if}
{/snippet}

<div class="w-full min-h-screen flex flex-col bg-emerald-950 text-amber-50 mx-auto" style="user-select:none; max-width:480px;">

{#if run.phase === 'title'}
  <div class="flex flex-col items-center justify-center flex-1 gap-6 text-center px-6">
    <div>
      <div class="text-xs tracking-widest text-emerald-300/70 mb-2">SOLITAIRE ROGUE</div>
      <h1 class="text-4xl font-black text-amber-50">登頂ソリティア -Culmen-</h1>
      <p class="text-emerald-100/70 text-sm mt-3 leading-relaxed">
        ランクの±1を連鎖で取ってスコアを稼ぐ<br />
        同スート・同色・階段(同方向3枚以上)で<br />
        ボーナスが乗る。場札を全消しすると<br />
        大きく加点され、3ウェーブ突破で<br />
        ステージクリア。
      </p>
    </div>
    <button
      onclick={startGame}
      class="px-10 py-3 rounded-full bg-yellow-400 text-emerald-950 font-black text-lg active:scale-95 transition-transform"
    >
      はじめる
    </button>
  </div>

{:else if wave}
  <div class="px-4 pt-3">
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

    <div class="mt-2 flex items-end justify-between">
      <div>
        <div class="text-xs text-emerald-300/70 tracking-widest">SCORE / TARGET</div>
        <div class="text-xl font-black text-amber-50 tabular-nums">
          {wave.score} <span class="text-sm text-emerald-300/70">/ {target}</span>
        </div>
      </div>
      <div class="text-right transition-transform origin-bottom-right {comboScale[comboTier]}">
        <div class="text-xs text-emerald-300/70 tracking-widest">COMBO</div>
        <div class="text-3xl font-black italic tabular-nums leading-none {comboColor[comboTier]}">×{wave.combo}</div>
      </div>
    </div>
    <div class="mt-1 h-1.5 rounded-full bg-emerald-900 overflow-hidden">
      <div class="h-full bg-gradient-to-r from-yellow-500 to-yellow-300 transition-all duration-300" style="width:{Math.min(100, (wave.score / target) * 100)}%"></div>
    </div>
    {#if wave.lastGain}
      <div class="text-right text-sm h-5">
        <span class="text-yellow-300 font-black">+{wave.lastGain.points}</span>
        {#if wave.lastGain.parts.length > 0}
          <span class="text-emerald-200 text-xs ml-2">{wave.lastGain.parts.join(' ')}</span>
        {/if}
      </div>
    {:else}
      <div class="h-5"></div>
    {/if}
  </div>

  <div class="flex-1 px-3 pt-1">
    <div class="grid gap-1" style="grid-template-columns: repeat({params.layout.cols}, minmax(0, 1fr));">
      {#each wave.tableau as col, ci (ci)}
        <div class="relative" style="min-height: 10.5rem;">
          {#each col as card, ri (card.id)}
            {@const isTop = ri === col.length - 1}
            <div class="absolute left-0 right-0" style="top:{ri * 18}px; z-index:{ri};">
              {#if isTop}
                <button
                  type="button"
                  onclick={() => handlePlayCard(ci)}
                  class="w-full text-left {playableColumns.has(ci) ? 'ring-2 ring-yellow-300 shadow-lg -translate-y-0.5' : ''} transition-transform"
                >
                  {@render cardFace(card, false)}
                </button>
              {:else}
                {@render cardFace(card, true)}
              {/if}
            </div>
          {/each}
        </div>
      {/each}
    </div>
    {#if playableColumns.size === 0 && wave.stock.length > 0 && remaining > 0}
      <div class="text-center text-emerald-300/80 text-xs mt-16 animate-pulse">取れる札がない → 山札をめくろう</div>
    {/if}
  </div>

  <div class="px-4 flex items-center gap-1 overflow-x-auto" style="min-height: 2.6rem;">
    {#each wave.chain as c, i (c.id)}
      <div
        class="flex-none rounded border text-center font-black leading-none flex flex-col items-center justify-center"
        style="width:24px; height:34px; font-size:11px; background:{c.wild ? '#EDE4FF' : '#FBF7EC'}; color:{c.wild ? '#6D28D9' : isRed(c) ? '#C7402D' : '#15181D'}; border-color:{c.wild ? '#A78BFA' : '#B8AE98'}; opacity:{!wave.linked && i === wave.chain.length - 1 ? 0.55 : 1};"
      >
        <div>{rankLabel(c)}</div>
        <div style="font-size:9px;">{c.suit}</div>
      </div>
    {/each}
    {#if wave.chain.length === 0}
      <div class="text-emerald-300/50 text-xs">取った札がここに並ぶ → 同スート/同色/階段でボーナス</div>
    {/if}
  </div>

  <div class="px-4 pb-5 pt-2 flex items-center gap-4">
    <button
      onclick={handleDraw}
      disabled={wave.stock.length === 0}
      style="aspect-ratio: 2 / 3;"
      class="w-16 rounded-lg border-2 flex flex-col items-center justify-center font-black active:scale-95 transition-transform {wave.stock.length > 0 ? 'bg-emerald-700 border-emerald-500 text-amber-50' : 'bg-emerald-900 border-emerald-800 text-emerald-700'}"
    >
      <div class="text-xs">山札</div>
      <div class="text-lg tabular-nums">{wave.stock.length}</div>
    </button>
    <div class="w-16">
      {@render cardFace(wave.foundation, false)}
    </div>
    <div class="flex-1 flex flex-wrap gap-1 justify-end">
      {#if wave.shieldLeft > 0}
        <span class="text-xs bg-sky-900 text-sky-200 border border-sky-600 rounded px-1.5 py-0.5">盾×{wave.shieldLeft}</span>
      {/if}
      {#each [...new Set(run.items)] as id (id)}
        {@const n = run.items.filter(x => x === id).length}
        <span class="text-xs bg-emerald-900 text-yellow-200/90 border border-yellow-600/40 rounded px-1.5 py-0.5">
          {ITEM_NAMES[id]}{n > 1 ? `×${n}` : ''}
        </span>
      {/each}
    </div>
  </div>
{/if}

{#if run.phase === 'itemSelect'}
  <div class="fixed inset-0 z-50 bg-emerald-950/90 backdrop-blur-sm flex items-center justify-center p-6">
    <div class="w-full max-w-sm flex flex-col items-center text-center">
      <div class="text-yellow-300 text-xs tracking-widest mb-1">WAVE {run.waveIndex} CLEAR</div>
      <div class="text-2xl font-black text-amber-50 mb-4">{run.wave?.score ?? 0} 点</div>
      <div class="text-emerald-100/70 text-sm mb-4">アイテムを1つ選ぶ</div>
      <div class="flex flex-col gap-3 w-full">
        {#each run.offer as id (id)}
          <button
            onclick={() => handlePickItem(id)}
            class="text-left bg-emerald-900/80 border border-yellow-500/40 rounded-xl px-4 py-3 active:scale-[0.98] transition-transform"
          >
            <div class="font-black text-yellow-300">{ITEM_NAMES[id]}</div>
            <div class="text-xs text-emerald-100/80 mt-0.5">{itemDesc(id, params)}</div>
          </button>
        {/each}
      </div>
    </div>
  </div>
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
{:else if run.phase === 'gameOver'}
  <div class="fixed inset-0 z-50 bg-emerald-950/90 backdrop-blur-sm flex items-center justify-center p-6">
    <div class="w-full max-w-sm flex flex-col items-center text-center">
      <div class="text-rose-400 text-xs tracking-widest mb-2">GAME OVER</div>
      <div class="text-2xl font-black text-amber-50 mb-1">{run.wave?.score ?? 0} / {target}</div>
      <div class="text-emerald-100/70 text-sm mb-6">目標スコアに届かなかった</div>
      <button onclick={handleRestart} class="px-10 py-3 rounded-full bg-yellow-400 text-emerald-950 font-black active:scale-95">
        最初から
      </button>
    </div>
  </div>
{/if}

</div>
```

- [ ] **Step 2: 型チェックを実行する**

Run: `npm run check`
Expected: エラーなし

- [ ] **Step 3: 開発サーバーで動作確認する**

Run: `npm run dev`

ブラウザで `http://localhost:5173/game/culmen` を開き、以下を確認する:
- タイトル画面が表示され、「はじめる」でゲームが開始する
- 場札7列が崩れず表示され、取れる札に黄色リングが付く
- カードをタップして取ると、コンボ・スコア・チェーンが更新される
- 山札をタップするとめくれて場札が更新される
- スマホ幅(devtoolsで375px)でレイアウトが崩れない

- [ ] **Step 4: コミット**

```bash
git add src/routes/game/culmen/+page.svelte
git commit -m "feat: 登頂ソリティア -Culmen- のゲーム画面(/game/culmen)を追加"
```

---

### Task 14: 最終検証

**Files:** なし(検証のみ)

- [ ] **Step 1: 全テストを実行する**

Run: `npm run test`
Expected: 全ファイルPASS

- [ ] **Step 2: 型チェック・Lintを実行する**

Run: `npm run check && npm run lint`
Expected: エラーなし

- [ ] **Step 3: 本番ビルドを実行する**

Run: `npm run build`
Expected: ビルド成功(adapter-staticでdist配下に出力される)

- [ ] **Step 4: 開発サーバーで受け入れ基準を一通り確認する**

Run: `npm run dev`

`docs/superpowers/specs/2026-07-07-culmen-solitaire-design.md` の「6. 受け入れ基準」を上から順にブラウザで確認する:
1. `/admin/culmen` で `basePoint` を変更して保存 → `/game/culmen` を最初からやり直すと獲得点に反映される
2. トップページ・`/admin/menu` で「登頂ソリティア -Culmen-(開発中)」が表示される
3. 階段判定: 5→6→7で3枚目にボーナス、5→6→5は付かない、K→A→2(ループ)は付く
4. シールド発動でめくった札がチェーンに並び得点は付かない
5. ワイルド直後の獲得札に★同スートボーナスが付く
6. スコアが目標に達した瞬間にウェーブクリア(全消し・手詰まりを含む)へ遷移する
7. 手詰まり(山札0・取れる札なし)で自動的に終了判定が走る
8. スマホ幅(375px)で場札7列が崩れず、黒スートのカードが暗背景でも読める

- [ ] **Step 5: 最終コミット(必要な微修正があれば)**

検証中に見つかった不具合を修正した場合のみ:

```bash
git add -A
git commit -m "fix: Culmen最終検証で見つかった不具合を修正"
```

---

## 自己レビュー結果

- **スペック網羅性**: セクション1(ファイル構成)→Task 1-13、セクション2(パラメータ)→Task 3・11、セクション3(ゲームルール)→Task 4-10、セクション4(UI)→Task 13、セクション5(admin)→Task 12、セクション6(受け入れ基準)→Task 14 で対応済み。
- **プレースホルダー**: なし。全タスクに実コードを記載。
- **型・関数名の一貫性**: `types.ts`(Task 1)で定義した型を `deck.ts`(Task 2)・`params.ts`(Task 3)・`engine.ts`(Task 4-10)で一貫して使用。`applyPlayCard`/`applyDrawStock`/`applyStuckCheck` の引数順序は `(params, run, ...)` に統一。UI(Task 13)からの呼び出し名・引数順序もこれに合わせて記載済み。
