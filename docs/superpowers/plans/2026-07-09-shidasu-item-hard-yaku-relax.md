# Shidasuの難条件役緩和護符 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 既存7個のアイテムを全て削除してアイテム制度を「1種類につき最大1個まで」に統一し、階段・列一掃・フラッシュ・ロイヤルセット・コンプリートランという「条件が難しい役」を緩和する新規護符2個(架橋の護符・寛容の護符)と、それに連動する4つの基本ルール変更を実装する。

**Architecture:** `src/lib/game/shidasu/{types,params,engine}.ts`と`shidasu.config.json`を刷新した後、UI(ゲーム画面・DebugPanel・管理画面)を追従させる。各タスクの終了時点で`npm run test`・`npm run check`・`npm run build`が必ずグリーンになるよう、型定義→エンジン→UIの順に、機能ごとに一括で変更する。

**Tech Stack:** SvelteKit(Svelte 5) / TypeScript / Vitest

**Spec:** `docs/superpowers/specs/2026-07-09-shidasu-item-hard-yaku-relax-design.md`

---

## 事前確認

- [ ] **Step 1: 作業ブランチを確認する**

```bash
git branch --show-current
```

Expected: `feat`(または `feat-*`)。

---

### Task 1: 既存7アイテムの全削除+1個までルール統一+架橋の護符

**Files:**
- Modify: `src/lib/game/shidasu/types.ts`
- Modify: `src/lib/game/shidasu/params.ts`
- Modify: `src/lib/game/shidasu/shidasu.config.json`
- Modify: `src/lib/game/shidasu/params.test.ts`
- Modify: `src/lib/game/shidasu/engine.ts`
- Modify: `src/lib/game/shidasu/engine.test.ts`

**Context:** 紅の目利き・宮廷の紋章・コンボシールド・厚めの山札・ワイルド★・助走・完全消去の7個を削除し、代わりに「架橋の護符」(階段の最小連続枚数を緩和する)1個だけを追加する。あわせて全アイテムを「既に持っていれば以降のオファーに出現しない」ルールに統一する(`UNIQUE_ITEMS`という特別扱いの仕組みを撤廃)。階段の基本ルールも、この機会に既定`stairMinLen`を3→5に引き上げる(架橋の護符は5→3に戻す効果)。「寛容の護符」(列一掃緩和)はTask 2で追加するため、このタスクではまだ触れない。

- [ ] **Step 1: `types.ts`を変更する**

`src/lib/game/shidasu/types.ts`の以下の行を:

```ts
export type ItemId = 'red5' | 'face10' | 'shield' | 'stock5' | 'wild1' | 'start1' | 'clear300'
```

次に置き換える:

```ts
export type ItemId = 'bridge'
```

以下の行を:

```ts
export type DrawEffect = 'wild' | 'shield' | 'pattern' | null
```

次に置き換える:

```ts
export type DrawEffect = 'wild' | 'pattern' | null
```

`WaveState`インターフェース内の`shieldLeft: number`の行を削除する。変更後の`WaveState`は以下の通り:

```ts
export interface WaveState {
  tableau: Card[][]
  stock: Card[]
  foundation: Card
  score: number
  combo: number
  chain: Card[]
  chainOrigin: ChainCardOrigin[]
  linked: boolean
  columnsEmptiedThisCombo: number
  lastDrawEffect: DrawEffect
  status: WaveStatus
  endReason: WaveEndReason
  lastGain: ScoreGain | null
}
```

- [ ] **Step 2: `params.ts`を変更する**

`ShidasuParams`インターフェース内の`items`ブロックを:

```ts
  items: {
    redBonusValue: number
    faceBonusValue: number
    shieldChargesPerPick: number
    extraStockCount: number
    wildPerPick: number
    startCombo: number
    fullClearItemBonus: number
  }
```

次に置き換える:

```ts
  items: {
    stairRelaxedMinLen: number
  }
```

`DEFAULT_PARAMS`内の`items`ブロックを:

```ts
  items: {
    redBonusValue: 50,
    faceBonusValue: 100,
    shieldChargesPerPick: 1,
    extraStockCount: 5,
    wildPerPick: 1,
    startCombo: 1,
    fullClearItemBonus: 3000,
  },
```

次に置き換える:

```ts
  items: {
    stairRelaxedMinLen: 3,
  },
```

`DEFAULT_PARAMS.scoring`内の`stairMinLen: 3,`を`stairMinLen: 5,`に変更する。

- [ ] **Step 3: `shidasu.config.json`を変更する**

`"stairMinLen": 3,`を`"stairMinLen": 5,`に変更する。

`"items"`ブロックを:

```json
  "items": {
    "redBonusValue": 50,
    "faceBonusValue": 100,
    "shieldChargesPerPick": 1,
    "extraStockCount": 5,
    "wildPerPick": 1,
    "startCombo": 1,
    "fullClearItemBonus": 3000
  },
```

次に置き換える:

```json
  "items": {
    "stairRelaxedMinLen": 3
  },
```

- [ ] **Step 4: `params.test.ts`を変更する**

`'点数系パラメータは10の倍数になっている'`テスト内の以下3行を削除する:

```ts
    expect(DEFAULT_PARAMS.items.redBonusValue % 10).toBe(0)
    expect(DEFAULT_PARAMS.items.faceBonusValue % 10).toBe(0)
    expect(DEFAULT_PARAMS.items.fullClearItemBonus % 10).toBe(0)
```

(`stairRelaxedMinLen`は点数ではなく枚数のパラメータのため、10の倍数チェックの対象には含めない。削除するのみでよい。)

- [ ] **Step 5: `engine.ts`を全面的に書き換える**

`src/lib/game/shidasu/engine.ts`の内容全体を、以下の内容に置き換える:

```ts
// src/lib/game/shidasu/engine.ts
import type { Card, StageModifier, WaveState, ItemId, WaveEndReason, RunState, Suit, Rank } from './types'
import type { ShidasuParams } from './params'
import { createDeck, createRng, shuffle, shuffleInPlace } from './deck'

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

export function isPlayable(modifier: StageModifier, wave: WaveState, card: Card): boolean {
  // faceLockはワイルド(場札含む)より優先して評価する: ワイルド場札でも絵札はコンボ不足なら拒否する
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

export function remainingCount(tableau: Card[][]): number {
  return tableau.reduce((n, c) => n + c.length, 0)
}

export function startWave(
  params: ShidasuParams,
  _stageIndex: number,
  _waveIndex: number,
  _items: ItemId[],
  seed?: number
): WaveState {
  const rand = createRng(seed ?? Math.floor(Math.random() * 999999) + 1)
  let idSeq = 0
  const nextId = () => ++idSeq

  const deck = shuffle(createDeck(nextId), rand)
  const { cols, rows } = params.layout
  const tableau: Card[][] = []
  for (let c = 0; c < cols; c++) {
    tableau.push(deck.splice(0, rows))
  }
  const foundation = deck.pop() as Card

  return {
    tableau,
    stock: deck,
    foundation,
    score: 0,
    combo: 0,
    chain: [foundation],
    chainOrigin: ['draw'],
    linked: false,
    columnsEmptiedThisCombo: 0,
    lastDrawEffect: null,
    status: 'playing',
    endReason: null as WaveEndReason,
    lastGain: null,
  }
}

export function playCard(
  params: ShidasuParams,
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

  const effectiveStairMinLen = items.includes('bridge') ? params.items.stairRelaxedMinLen : params.scoring.stairMinLen
  const chainResult = evaluateChainBonus(params.scoring, wave.chain, card, effectiveStairMinLen)
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
    chainOrigin: [...wave.chainOrigin, 'play'],
    linked: true,
    columnsEmptiedThisCombo: newColumnsEmptied,
    lastDrawEffect: null,
    score: newScore,
    lastGain: { points: gained, parts },
    status: 'playing',
    endReason: null,
  }

  if (remaining === 0) {
    const clearBonus = params.scoring.clearBonus + wave.stock.length * params.scoring.clearBonusPerStock
    return { ...next, score: newScore + clearBonus, status: 'ended', endReason: 'fullClear' }
  }

  if (newScore >= target) {
    return { ...next, status: 'ended', endReason: 'target' }
  }

  return next
}

export function drawStock(params: ShidasuParams, wave: WaveState, _items: ItemId[]): WaveState {
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
      chainOrigin: [...wave.chainOrigin, 'draw'],
      linked: true,
      lastDrawEffect: 'wild',
      lastGain: null,
    }
  }

  const patternContinues = wave.linked && chainContinuesPattern(params.scoring, wave.chain, card)

  if (patternContinues) {
    return {
      ...wave,
      stock: newStock,
      foundation: card,
      chain: [...wave.chain, card],
      chainOrigin: [...wave.chainOrigin, 'draw'],
      linked: true,
      lastDrawEffect: 'pattern',
      lastGain: null,
    }
  }

  return {
    ...wave,
    stock: newStock,
    foundation: card,
    combo: 0,
    chain: [card],
    chainOrigin: ['draw'],
    linked: false,
    columnsEmptiedThisCombo: 0,
    lastDrawEffect: null,
    lastGain: null,
  }
}

export function isStuck(modifier: StageModifier, wave: WaveState): boolean {
  const remaining = remainingCount(wave.tableau)
  if (remaining === 0) return false
  if (wave.stock.length > 0) return false
  return getPlayableColumns(modifier, wave).size === 0
}

export function markStuck(wave: WaveState): WaveState {
  if (wave.status !== 'playing') return wave
  return { ...wave, status: 'ended', endReason: 'stuck' }
}

export const ITEM_POOL: ItemId[] = ['bridge']

export const ITEM_NAMES: Record<ItemId, string> = {
  bridge: '架橋の護符',
}

export function itemDesc(id: ItemId, params: ShidasuParams): string {
  switch (id) {
    case 'bridge': return `階段成立に必要な最小連続枚数を${params.scoring.stairMinLen}→${params.items.stairRelaxedMinLen}枚に緩和`
  }
}

function shuffleItems(list: ItemId[], rand: () => number): ItemId[] {
  const arr = [...list]
  shuffleInPlace(arr, rand)
  return arr
}

export function rollItemOffer(items: ItemId[], rand: () => number = Math.random): ItemId[] {
  const available = ITEM_POOL.filter(id => !items.includes(id))
  return shuffleItems(available, rand).slice(0, 3)
}

export function createInitialRun(): RunState {
  return { phase: 'title', stageIndex: 0, waveIndex: 0, items: [], offer: [], wave: null }
}

export function beginRun(params: ShidasuParams, seed?: number): RunState {
  return {
    phase: 'playing',
    stageIndex: 0,
    waveIndex: 0,
    items: [],
    offer: [],
    wave: startWave(params, 0, 0, [], seed),
  }
}

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
  return { ...run, phase: 'itemSelect', offer: rollItemOffer(run.items, rand) }
}

export function pickItem(params: ShidasuParams, run: RunState, itemId: ItemId, seed?: number): RunState {
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

export function advanceStage(params: ShidasuParams, run: RunState, seed?: number): RunState {
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

export function restartRun(params: ShidasuParams, seed?: number): RunState {
  return beginRun(params, seed)
}

// runがプレイ中でwaveを持つ場合のみfnを適用し、そうでなければrunをそのまま返す
function withActiveWave(run: RunState, fn: (wave: WaveState) => WaveState): RunState {
  if (run.phase !== 'playing' || !run.wave) return run
  return { ...run, wave: fn(run.wave) }
}

export function applyPlayCard(params: ShidasuParams, run: RunState, colIndex: number): RunState {
  return withActiveWave(run, wave => {
    const stage = params.stages[run.stageIndex]
    const target = stage.targets[run.waveIndex]
    return playCard(params, wave, stage.modifier, run.items, target, colIndex)
  })
}

export function applyDrawStock(params: ShidasuParams, run: RunState): RunState {
  return withActiveWave(run, wave => drawStock(params, wave, run.items))
}

export function applyStuckCheck(params: ShidasuParams, run: RunState): RunState {
  return withActiveWave(run, wave => {
    const modifier = params.stages[run.stageIndex].modifier
    return isStuck(modifier, wave) ? markStuck(wave) : wave
  })
}

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

export interface ChainBonusResult {
  bonus: number
  parts: string[]
}

export function evaluateChainBonus(
  scoring: ShidasuParams['scoring'],
  chainBefore: Card[],
  card: Card,
  stairMinLen: number = scoring.stairMinLen
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
  if (stairInfo.held && stairInfo.len >= stairMinLen) {
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

export function chainContinuesPattern(
  scoring: ShidasuParams['scoring'],
  chain: Card[],
  card: Card
): boolean {
  if (chain.length === 0) return false

  const realChain = chain.filter(c => !c.wild)
  const { suitHeld, colorHeld } = analyzeSuitColor(chain)
  if (realChain.length > 0) {
    const anchor = realChain[0]
    // suitHeldは実カード1枚のみの場合も便宜上trueになる(analyzeSuitColorの仕様)ため、
    // 「同スート」条件を優先評価し、それが不成立の場合のみ「同色」条件にフォールバックする
    // (evaluateChainBonusのsuitBonus/colorBonus判定と同じ優先順位)
    if (suitHeld) {
      if (card.suit === anchor.suit) return true
    } else if (colorHeld) {
      if (isRed(card) === isRed(anchor)) return true
    }
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

let debugCardIdSeq = 900000

// デバッグパネル専用: 山札の一番上(次にめくられる札)を指定カードに差し替える。
// idは既存デッキ(最大でも数百枚程度)と衝突しないよう90万番台から発番する。
export function forceStockTop(wave: WaveState, suit: Suit, rank: Rank, wild: boolean): WaveState {
  const card: Card = { id: ++debugCardIdSeq, suit, rank, wild }
  const newStock = wave.stock.length === 0 ? [card] : [...wave.stock.slice(0, -1), card]
  return { ...wave, stock: newStock }
}
```

- [ ] **Step 6: `engine.test.ts`を全面的に書き換える**

`src/lib/game/shidasu/engine.test.ts`の内容全体を、以下の内容に置き換える:

```ts
// src/lib/game/shidasu/engine.test.ts
import { describe, test, expect } from 'vitest'
import {
  isRed,
  isFace,
  rankLabel,
  isPlayable,
  getPlayableColumns,
  remainingCount,
  startWave,
  playCard,
  drawStock,
  chainContinuesPattern,
  isStuck,
  markStuck,
  rollItemOffer,
  ITEM_POOL,
  ITEM_NAMES,
  itemDesc,
  createInitialRun,
  beginRun,
  resolveWaveEnd,
  pickItem,
  advanceStage,
  restartRun,
  applyPlayCard,
  applyDrawStock,
  applyStuckCheck,
  analyzeSuitColor,
  analyzeStair,
  checkFlush,
  checkRoyalSet,
  countSameRankBefore,
  checkCompleteRun,
  evaluateChainBonus,
  forceStockTop,
} from './engine'
import type { Card, WaveState, RunState } from './types'
import { DEFAULT_PARAMS } from './params'
import { createRng } from './deck'

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

function makeWave(overrides: Partial<WaveState> = {}): WaveState {
  return {
    tableau: [],
    stock: [],
    foundation: card(0, '♠', 5),
    score: 0,
    combo: 0,
    chain: [],
    chainOrigin: [],
    linked: false,
    columnsEmptiedThisCombo: 0,
    lastDrawEffect: null,
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
    expect(remainingCount(wave.tableau)).toBe(3)
  })
})

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

  test('初期状態: チェーンにfoundationが1枚(由来はdraw)、スコア0、コンボ0、列一掃0、演出フラグnull', () => {
    const wave = startWave(DEFAULT_PARAMS, 0, 0, [], 1)
    expect(wave.score).toBe(0)
    expect(wave.combo).toBe(0)
    expect(wave.chain).toEqual([wave.foundation])
    expect(wave.chainOrigin).toEqual(['draw'])
    expect(wave.linked).toBe(false)
    expect(wave.columnsEmptiedThisCombo).toBe(0)
    expect(wave.lastDrawEffect).toBeNull()
    expect(wave.status).toBe('playing')
  })

  test('同じシードなら同じ結果になる(決定的、アイテムを持っていても山札生成自体は変わらない)', () => {
    const a = startWave(DEFAULT_PARAMS, 0, 0, ['bridge'], 123)
    const b = startWave(DEFAULT_PARAMS, 0, 0, ['bridge'], 123)
    expect(a).toEqual(b)
  })
})

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
    // 列一掃ボーナスが混ざらないよう、played対象の下にダミー札を積んで列が空にならないようにする
    const wave = baseWave({ tableau: [[card(9, '♠', 1), card(1, '♣', 6)], [card(2, '♦', 2)]] })
    const next = playCard(DEFAULT_PARAMS, wave, 'none', [], 1000000, 0)
    expect(next.combo).toBe(1)
    expect(next.score).toBe(scoring.basePoint)
    expect(next.foundation).toEqual(card(1, '♣', 6))
    expect(next.chain).toEqual([card(1, '♣', 6)])
    expect(next.tableau[0]).toEqual([card(9, '♠', 1)])
  })

  test('コンボ2(倍率1+0.1=1.1)で加点される(パターン不一致の場合)', () => {
    // 1枚目を取ってコンボ1にし、2枚目(パターン不一致)を取ってコンボ2にする
    // (列一掃・全消しボーナスが混ざらないよう、played対象の下にダミー札を積んでおく)
    const wave = baseWave({
      tableau: [
        [card(9, '♠', 1), card(1, '♣', 6)],
        [card(10, '♠', 2), card(2, '♦', 9)],
      ],
    })
    const afterFirst = playCard(DEFAULT_PARAMS, wave, 'none', [], 1000000, 0)
    // 2列目のfoundation差分を6→9にするため、一旦foundationを差し替えたウェーブで2枚目を取る
    const wave2 = {
      ...afterFirst,
      foundation: card(1, '♣', 6),
      tableau: [[card(9, '♠', 1)], [card(10, '♠', 2), card(2, '♦', 7)]],
    }
    const next = playCard(DEFAULT_PARAMS, wave2, 'none', [], 1000000, 1)
    expect(next.combo).toBe(2)
    // 6→7は階段方向+1・長さ2(既定stairMinLen=5未満でボーナスなし)、スート♣→♦で色も違う→パターンボーナス0
    expect(next.score).toBe(afterFirst.score + Math.floor(scoring.basePoint * 1.1))
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
      foundation: card(0, '♠', 6), // 列1(rank7)との差を1にして取れるようにする
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
    // 列一掃・全消しボーナスが混ざらないよう、played対象の下にダミー札を積んでおく
    const wave = baseWave({
      tableau: [
        [card(9, '♠', 1), card(1, '♣', 6)],
        [card(10, '♠', 2), card(2, '♦', 2)],
      ],
    })
    // コンボ1: 倍率1+(1-1)*0.25=1.0 → 15*1.0=15 (割り切れる、floorの効果を見るには2枚目が必要)
    const afterFirst = playCard(oddParams, wave, 'none', [], 1000000, 0)
    const wave2 = { ...afterFirst, tableau: [[card(9, '♠', 1)], [card(10, '♠', 2), card(2, '♦', 7)]] }
    const next = playCard(oddParams, wave2, 'none', [], 1000000, 1)
    // コンボ2: 倍率1+(2-1)*0.25=1.25 → 15*1.25=18.75 → floor=18
    expect(next.score).toBe(afterFirst.score + 18)
  })

  test('カードを取るとlastDrawEffectがクリアされる', () => {
    const wave = baseWave({ lastDrawEffect: 'pattern' })
    const next = playCard(DEFAULT_PARAMS, wave, 'none', [], 1000000, 0)
    expect(next.lastDrawEffect).toBeNull()
  })

  test('chainOriginにplayが追記される', () => {
    const wave = baseWave({ tableau: [[card(9, '♠', 1), card(1, '♣', 6)], [card(2, '♦', 2)]] })
    const next = playCard(DEFAULT_PARAMS, wave, 'none', [], 1000000, 0)
    expect(next.chainOrigin).toEqual(['play'])
  })

  test('架橋の護符を持っていなければ、階段が3枚繋がっても既定のstairMinLen(5)未満のためボーナスが付かない', () => {
    const wave = baseWave({
      foundation: card(0, '♣', 5),
      chain: [card(20, '♠', 4), card(0, '♣', 5)],
      tableau: [[card(9, '♠', 1), card(1, '♦', 6)], [card(2, '♥', 2)]],
    })
    const next = playCard(DEFAULT_PARAMS, wave, 'none', [], 1000000, 0)
    expect(next.lastGain?.parts.some(p => p.startsWith('階段'))).toBe(false)
  })

  test('架橋の護符を持っていれば、階段成立に必要な最小連続枚数がstairRelaxedMinLen(3)に緩和される', () => {
    const wave = baseWave({
      foundation: card(0, '♣', 5),
      chain: [card(20, '♠', 4), card(0, '♣', 5)],
      tableau: [[card(9, '♠', 1), card(1, '♦', 6)], [card(2, '♥', 2)]],
    })
    const next = playCard(DEFAULT_PARAMS, wave, 'none', ['bridge'], 1000000, 0)
    expect(next.lastGain?.parts).toContain(`階段3 +${scoring.stairBonus}`)
  })
})

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

  test('実カード1枚のみのチェーンでは、色が一致してもスートが違えば継続しない(スート優先)', () => {
    const chain = [card(1, '♠', 5)]
    expect(chainContinuesPattern(DEFAULT_PARAMS.scoring, chain, card(2, '♣', 9))).toBe(false)
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

  test('通常時(継続条件なし): コンボ・チェーン・列一掃カウントがリセットされ、捲った札1枚が新しい起点になる', () => {
    const wave = makeWave({
      stock: [card(1, '♠', 9)],
      combo: 3,
      chain: [card(2, '♣', 1)],
      chainOrigin: ['play'],
      linked: true,
      columnsEmptiedThisCombo: 2,
    })
    const next = drawStock(DEFAULT_PARAMS, wave, [])
    expect(next.foundation).toEqual(card(1, '♠', 9))
    expect(next.combo).toBe(0)
    expect(next.chain).toEqual([card(1, '♠', 9)])
    expect(next.chainOrigin).toEqual(['draw'])
    expect(next.linked).toBe(false)
    expect(next.columnsEmptiedThisCombo).toBe(0)
    expect(next.lastDrawEffect).toBeNull()
    expect(next.stock).toEqual([])
  })

  test('ワイルドがめくれた場合: コンボは変わらずチェーンに追加され、lastDrawEffectはwild', () => {
    const wave = makeWave({
      stock: [card(1, '★', 0, true)],
      combo: 3,
      chain: [card(2, '♣', 5)],
      chainOrigin: ['play'],
      linked: true,
    })
    const next = drawStock(DEFAULT_PARAMS, wave, [])
    expect(next.combo).toBe(3)
    expect(next.chain).toEqual([card(2, '♣', 5), card(1, '★', 0, true)])
    expect(next.chainOrigin).toEqual(['play', 'draw'])
    expect(next.linked).toBe(true)
    expect(next.lastDrawEffect).toBe('wild')
  })

  test('パターンに合う札ならアイテム無しで特殊継続しlastDrawEffectはpattern', () => {
    const wave = makeWave({
      stock: [card(1, '♠', 9)], // 同スート継続
      combo: 2,
      chain: [card(2, '♠', 5)],
      chainOrigin: ['play'],
      linked: true,
    })
    const next = drawStock(DEFAULT_PARAMS, wave, [])
    expect(next.combo).toBe(2)
    expect(next.chain).toEqual([card(2, '♠', 5), card(1, '♠', 9)])
    expect(next.chainOrigin).toEqual(['play', 'draw'])
    expect(next.linked).toBe(true)
    expect(next.lastDrawEffect).toBe('pattern')
    expect(next.score).toBe(wave.score) // 得点は付かない
  })

  test('パターンに合わなければ通常通りリセットし、捲った札1枚が新しい起点になる', () => {
    const wave = makeWave({
      stock: [card(1, '♣', 9)], // 同スートでも階段でもない
      combo: 2,
      chain: [card(2, '♥', 5)],
      chainOrigin: ['play'],
      linked: true,
    })
    const next = drawStock(DEFAULT_PARAMS, wave, [])
    expect(next.combo).toBe(0)
    expect(next.chain).toEqual([card(1, '♣', 9)])
    expect(next.chainOrigin).toEqual(['draw'])
    expect(next.linked).toBe(false)
    expect(next.lastDrawEffect).toBeNull()
  })

  test('山札を引くとlastGainがクリアされる(得点は山札からは発生しないため)', () => {
    const wave = makeWave({
      stock: [card(1, '★', 0, true)],
      lastGain: { points: 100, parts: ['同スート+100'] },
    })
    const next = drawStock(DEFAULT_PARAMS, wave, [])
    expect(next.lastGain).toBeNull()
  })
})

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
  test('未所持のアイテムを全て返す(プールの上限は3件だが、実際のプール数がそれ以下ならそのまま返す)', () => {
    const offer = rollItemOffer([], createRng(1))
    expect(offer).toEqual(['bridge'])
  })

  test('既に持っているアイテムは種類を問わず候補から除外される', () => {
    const offer = rollItemOffer(['bridge'], createRng(1))
    expect(offer).toEqual([])
  })
})

describe('ITEM_POOL / ITEM_NAMES / itemDesc', () => {
  test('1種類のアイテムが定義されている', () => {
    expect(ITEM_POOL).toHaveLength(1)
    ITEM_POOL.forEach(id => expect(ITEM_NAMES[id]).toBeTruthy())
  })

  test('itemDescはパラメータの数値を埋め込んだ説明文を返す', () => {
    expect(itemDesc('bridge', DEFAULT_PARAMS)).toContain(String(DEFAULT_PARAMS.scoring.stairMinLen))
    expect(itemDesc('bridge', DEFAULT_PARAMS)).toContain(String(DEFAULT_PARAMS.items.stairRelaxedMinLen))
  })
})

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

  test('ウェーブ1・2クリアならitemSelectになりofferにプール内の未所持アイテムが入る', () => {
    const run = endedRun({ waveIndex: 0 }, DEFAULT_PARAMS.stages[0].targets[0])
    const next = resolveWaveEnd(DEFAULT_PARAMS, run, createRng(5))
    expect(next.phase).toBe('itemSelect')
    expect(next.offer).toEqual(['bridge'])
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
    const run: RunState = { ...beginRun(DEFAULT_PARAMS, 1), phase: 'itemSelect', waveIndex: 0, offer: ['bridge'] }
    const next = pickItem(DEFAULT_PARAMS, run, 'bridge', 2)
    expect(next.phase).toBe('playing')
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

  test('7→6→5で方向-1・長さ3が保持される', () => {
    const chain = [card(1, '♠', 7), card(2, '♣', 6), card(3, '♦', 5)]
    expect(analyzeStair(chain)).toEqual({ held: true, dir: -1, len: 3 })
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

  test('同ランクが3枚あれば3を返す', () => {
    const cards = [card(1, '♠', 5), card(2, '♥', 5), card(3, '♦', 5)]
    expect(countSameRankBefore(cards, 5)).toBe(3)
  })
})

describe('checkCompleteRun', () => {
  test('13ランク揃う直前(12種)ではfalse', () => {
    const before = Array.from({ length: 12 }, (_, i) => card(i + 1, '♠', (i + 1) as Card['rank']))
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
    const chainBefore = [card(1, '♠', 5), card(2, '♥', 6), card(3, '♠', 7)] // 1枚目→2枚目でスート崩壊済み、3枚目は直前(2枚目...)
    const result = evaluateChainBonus(scoring, chainBefore, card(4, '♠', 8))
    expect(result.parts.some(p => p.startsWith('同スート'))).toBe(false)
  })

  test('ワイルド直後はwildSuitBonusのみ(同スート・同色は付かない)', () => {
    const chainBefore = [card(1, '★', 0, true)]
    const result = evaluateChainBonus(scoring, chainBefore, card(2, '♠', 9))
    expect(result.bonus).toBe(scoring.wildSuitBonus)
    expect(result.parts).toEqual([`★同スート+${scoring.wildSuitBonus}`])
  })

  test('基本ルールでは階段は既定のstairMinLen(5)未満だとstairBonusが付かない', () => {
    const chainBefore = [card(1, '♠', 5), card(2, '♣', 6)]
    const result = evaluateChainBonus(scoring, chainBefore, card(3, '♦', 7))
    // 5→6→7で長さ3、既定のstairMinLen(5)未満のためstairBonusは付かない
    expect(result.parts.some(p => p.startsWith('階段'))).toBe(false)
  })

  test('階段が既定のstairMinLen(5)以上続けばstairBonusが付く', () => {
    const chainBefore = [card(1, '♠', 3), card(2, '♣', 4), card(3, '♦', 5), card(4, '♠', 6)]
    const result = evaluateChainBonus(scoring, chainBefore, card(5, '♣', 7))
    expect(result.parts).toContain(`階段5 +${scoring.stairBonus}`)
  })

  test('stairMinLenを明示的に指定すると(架橋の護符相当)その値で判定される', () => {
    const chainBefore = [card(1, '♠', 5), card(2, '♣', 6)]
    const result = evaluateChainBonus(scoring, chainBefore, card(3, '♦', 7), 3)
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

- [ ] **Step 7: 型チェックとテストを実行する**

Run: `npm run check`
Expected: エラーなし

Run: `npm run test`
Expected: 全ファイルPASS

- [ ] **Step 8: コミットする**

```bash
git add src/lib/game/shidasu/types.ts src/lib/game/shidasu/params.ts src/lib/game/shidasu/shidasu.config.json src/lib/game/shidasu/params.test.ts src/lib/game/shidasu/engine.ts src/lib/game/shidasu/engine.test.ts
git commit -m "feat: Shidasuの既存7アイテムを削除し1個までルールと架橋の護符を追加"
```

---

### Task 2: 列一掃の基本ルール変更+寛容の護符

**Files:**
- Modify: `src/lib/game/shidasu/types.ts`
- Modify: `src/lib/game/shidasu/params.ts`
- Modify: `src/lib/game/shidasu/shidasu.config.json`
- Modify: `src/lib/game/shidasu/engine.ts`
- Modify: `src/lib/game/shidasu/engine.test.ts`

**Context:** Task 1で`ITEM_POOL`に`bridge`だけを追加した状態から、`grace`(寛容の護符)を追加する。列一掃ボーナスの基本ルールを「列の全カード(`rows`枚)を1回も途切れていない連続コンボの中で0枚にした場合のみ」に難化し、寛容の護符所持時は「対象列が現在の連続コンボ開始時点で残り`rows - columnSweepRelaxCards`枚以下だった場合」に緩和する。この判定のため、`WaveState`に列ごとの「現在の連続コンボが始まった時点での残り枚数」を記録する`comboStreakColumnLengths`を追加する。

- [ ] **Step 1: `types.ts`を変更する**

`ItemId`の行を:

```ts
export type ItemId = 'bridge'
```

次に置き換える:

```ts
export type ItemId = 'bridge' | 'grace'
```

`WaveState`インターフェースに`comboStreakColumnLengths: number[]`フィールドを追加する。`columnsEmptiedThisCombo: number`の行の直後に追加すること:

```ts
export interface WaveState {
  tableau: Card[][]
  stock: Card[]
  foundation: Card
  score: number
  combo: number
  chain: Card[]
  chainOrigin: ChainCardOrigin[]
  linked: boolean
  columnsEmptiedThisCombo: number
  comboStreakColumnLengths: number[]
  lastDrawEffect: DrawEffect
  status: WaveStatus
  endReason: WaveEndReason
  lastGain: ScoreGain | null
}
```

- [ ] **Step 2: `params.ts`を変更する**

`ShidasuParams`の`items`ブロックを:

```ts
  items: {
    stairRelaxedMinLen: number
  }
```

次に置き換える:

```ts
  items: {
    stairRelaxedMinLen: number
    columnSweepRelaxCards: number
  }
```

`DEFAULT_PARAMS`の`items`ブロックを:

```ts
  items: {
    stairRelaxedMinLen: 3,
  },
```

次に置き換える:

```ts
  items: {
    stairRelaxedMinLen: 3,
    columnSweepRelaxCards: 2,
  },
```

- [ ] **Step 3: `shidasu.config.json`を変更する**

`"items"`ブロックを:

```json
  "items": {
    "stairRelaxedMinLen": 3
  },
```

次に置き換える:

```json
  "items": {
    "stairRelaxedMinLen": 3,
    "columnSweepRelaxCards": 2
  },
```

- [ ] **Step 4: `engine.ts`の`startWave`を変更する**

`startWave`関数内の戻り値オブジェクトの`columnsEmptiedThisCombo: 0,`の行の直後に、以下の行を追加する:

```ts
    comboStreakColumnLengths: tableau.map(col => col.length),
```

(ウェーブ開始時点では全列とも「連続コンボはまだ何も消費していない」ため、各列の現在の残り枚数=`rows`がそのままスナップショットになる。)

- [ ] **Step 5: `engine.ts`の`drawStock`を変更する**

`drawStock`関数の最後の`return`(コンボがリセットされる、パターン不成立の分岐)を:

```ts
  return {
    ...wave,
    stock: newStock,
    foundation: card,
    combo: 0,
    chain: [card],
    chainOrigin: ['draw'],
    linked: false,
    columnsEmptiedThisCombo: 0,
    lastDrawEffect: null,
    lastGain: null,
  }
}
```

次に置き換える(`comboStreakColumnLengths`を、コンボがリセットされる瞬間の各列の残り枚数でスナップショットし直す):

```ts
  return {
    ...wave,
    stock: newStock,
    foundation: card,
    combo: 0,
    chain: [card],
    chainOrigin: ['draw'],
    linked: false,
    columnsEmptiedThisCombo: 0,
    comboStreakColumnLengths: wave.tableau.map(col => col.length),
    lastDrawEffect: null,
    lastGain: null,
  }
}
```

(ワイルドが引かれた分岐・パターン継続の分岐は、コンボが途切れていないため`comboStreakColumnLengths`を更新しない=`...wave`のまま維持される。)

- [ ] **Step 6: `engine.ts`の`playCard`を変更する**

`playCard`関数内の以下のブロックを:

```ts
  const newTableau = wave.tableau.map((c, i) => (i === colIndex ? c.slice(0, -1) : c))
  const columnJustEmptied = newTableau[colIndex].length === 0
  const newColumnsEmptied = columnJustEmptied ? wave.columnsEmptiedThisCombo + 1 : wave.columnsEmptiedThisCombo
  if (columnJustEmptied) {
    const sweepGain = params.scoring.columnSweepBonus * newColumnsEmptied
    base += sweepGain
    parts.push(`列一掃+${sweepGain}`)
  }
```

次に置き換える:

```ts
  const newTableau = wave.tableau.map((c, i) => (i === colIndex ? c.slice(0, -1) : c))
  const columnJustEmptied = newTableau[colIndex].length === 0
  const streakStartLength = wave.comboStreakColumnLengths[colIndex]
  const rows = params.layout.rows
  const sweepQualifies = columnJustEmptied && (
    items.includes('grace')
      ? streakStartLength <= rows - params.items.columnSweepRelaxCards
      : streakStartLength === rows
  )
  const newColumnsEmptied = sweepQualifies ? wave.columnsEmptiedThisCombo + 1 : wave.columnsEmptiedThisCombo
  if (sweepQualifies) {
    const sweepGain = params.scoring.columnSweepBonus * newColumnsEmptied
    base += sweepGain
    parts.push(`列一掃+${sweepGain}`)
  }
```

`playCard`が返す`next`オブジェクト内の`columnsEmptiedThisCombo: newColumnsEmptied,`の行の直後に、以下の行を追加する:

```ts
    comboStreakColumnLengths: wave.comboStreakColumnLengths,
```

(コンボが継続する限り、このスナップショット自体は変化しない。列が空になった場合の更新は次にコンボがリセットされる=`drawStock`の分岐でのみ行われる。)

- [ ] **Step 7: `engine.ts`の`ITEM_POOL`・`ITEM_NAMES`・`itemDesc`を変更する**

```ts
export const ITEM_POOL: ItemId[] = ['bridge']

export const ITEM_NAMES: Record<ItemId, string> = {
  bridge: '架橋の護符',
}

export function itemDesc(id: ItemId, params: ShidasuParams): string {
  switch (id) {
    case 'bridge': return `階段成立に必要な最小連続枚数を${params.scoring.stairMinLen}→${params.items.stairRelaxedMinLen}枚に緩和`
  }
}
```

次に置き換える:

```ts
export const ITEM_POOL: ItemId[] = ['bridge', 'grace']

export const ITEM_NAMES: Record<ItemId, string> = {
  bridge: '架橋の護符',
  grace: '寛容の護符',
}

export function itemDesc(id: ItemId, params: ShidasuParams): string {
  switch (id) {
    case 'bridge': return `階段成立に必要な最小連続枚数を${params.scoring.stairMinLen}→${params.items.stairRelaxedMinLen}枚に緩和`
    case 'grace': {
      const relaxed = params.layout.rows - params.items.columnSweepRelaxCards
      return `列一掃ボーナスの条件を「列の全${params.layout.rows}枚を1コンボで空に」→「残り${relaxed}枚から1コンボで空に」に緩和`
    }
  }
}
```

- [ ] **Step 8: `engine.test.ts`を変更する**

`makeWave`関数の戻り値オブジェクトに、`columnsEmptiedThisCombo: 0,`の行の直後に以下を追加する:

```ts
    comboStreakColumnLengths: [],
```

`startWave`describeブロック内の`'場札はcols×rowsの列数・枚数になる'`テストの直後に、以下のテストを追加する:

```ts
  test('comboStreakColumnLengthsは各列ともrows枚で初期化される', () => {
    const wave = startWave(DEFAULT_PARAMS, 0, 0, [], 1)
    expect(wave.comboStreakColumnLengths).toEqual(wave.tableau.map(() => DEFAULT_PARAMS.layout.rows))
  })
```

`rollItemOffer`describeブロックを:

```ts
describe('rollItemOffer', () => {
  test('未所持のアイテムを全て返す(プールの上限は3件だが、実際のプール数がそれ以下ならそのまま返す)', () => {
    const offer = rollItemOffer([], createRng(1))
    expect(offer).toEqual(['bridge'])
  })

  test('既に持っているアイテムは種類を問わず候補から除外される', () => {
    const offer = rollItemOffer(['bridge'], createRng(1))
    expect(offer).toEqual([])
  })
})
```

次に置き換える:

```ts
describe('rollItemOffer', () => {
  test('未所持のアイテムを全て返す(プールの上限は3件だが、実際のプール数がそれ以下ならそのまま返す)', () => {
    const offer = rollItemOffer([], createRng(1))
    expect([...offer].sort()).toEqual(['bridge', 'grace'])
  })

  test('既に持っているアイテムは種類を問わず候補から除外される', () => {
    const offer = rollItemOffer(['bridge'], createRng(1))
    expect(offer).toEqual(['grace'])
  })

  test('全て持っていれば候補は空になる', () => {
    const offer = rollItemOffer(['bridge', 'grace'], createRng(1))
    expect(offer).toEqual([])
  })
})
```

`ITEM_POOL / ITEM_NAMES / itemDesc`describeブロックを:

```ts
describe('ITEM_POOL / ITEM_NAMES / itemDesc', () => {
  test('1種類のアイテムが定義されている', () => {
    expect(ITEM_POOL).toHaveLength(1)
    ITEM_POOL.forEach(id => expect(ITEM_NAMES[id]).toBeTruthy())
  })

  test('itemDescはパラメータの数値を埋め込んだ説明文を返す', () => {
    expect(itemDesc('bridge', DEFAULT_PARAMS)).toContain(String(DEFAULT_PARAMS.scoring.stairMinLen))
    expect(itemDesc('bridge', DEFAULT_PARAMS)).toContain(String(DEFAULT_PARAMS.items.stairRelaxedMinLen))
  })
})
```

次に置き換える:

```ts
describe('ITEM_POOL / ITEM_NAMES / itemDesc', () => {
  test('2種類のアイテムが定義されている', () => {
    expect(ITEM_POOL).toHaveLength(2)
    ITEM_POOL.forEach(id => expect(ITEM_NAMES[id]).toBeTruthy())
  })

  test('itemDescはパラメータの数値を埋め込んだ説明文を返す', () => {
    expect(itemDesc('bridge', DEFAULT_PARAMS)).toContain(String(DEFAULT_PARAMS.scoring.stairMinLen))
    expect(itemDesc('bridge', DEFAULT_PARAMS)).toContain(String(DEFAULT_PARAMS.items.stairRelaxedMinLen))
    expect(itemDesc('grace', DEFAULT_PARAMS)).toContain(String(DEFAULT_PARAMS.layout.rows))
    expect(itemDesc('grace', DEFAULT_PARAMS)).toContain(String(DEFAULT_PARAMS.layout.rows - DEFAULT_PARAMS.items.columnSweepRelaxCards))
  })
})
```

`resolveWaveEnd`describeブロック内の`'ウェーブ1・2クリアならitemSelectになりofferにプール内の未所持アイテムが入る'`テストを:

```ts
  test('ウェーブ1・2クリアならitemSelectになりofferにプール内の未所持アイテムが入る', () => {
    const run = endedRun({ waveIndex: 0 }, DEFAULT_PARAMS.stages[0].targets[0])
    const next = resolveWaveEnd(DEFAULT_PARAMS, run, createRng(5))
    expect(next.phase).toBe('itemSelect')
    expect(next.offer).toEqual(['bridge'])
  })
```

次に置き換える:

```ts
  test('ウェーブ1・2クリアならitemSelectになりofferにプール内の未所持アイテムが入る', () => {
    const run = endedRun({ waveIndex: 0 }, DEFAULT_PARAMS.stages[0].targets[0])
    const next = resolveWaveEnd(DEFAULT_PARAMS, run, createRng(5))
    expect(next.phase).toBe('itemSelect')
    expect(next.offer).toHaveLength(2)
    expect([...next.offer].sort()).toEqual(['bridge', 'grace'])
  })
```

`playCard`describeブロック内の`'列を空にすると列一掃ボーナスが加算される(1列目)'`テストと`'同じコンボ内で2列目を空にすると列一掃ボーナスが列数倍になる'`テストを、`comboStreakColumnLengths`を明示的にセットするよう変更する。

```ts
  test('列を空にすると列一掃ボーナスが加算される(1列目)', () => {
    const wave = baseWave({ tableau: [[card(1, '♣', 6)], [card(2, '♦', 9)]] })
    const next = playCard(DEFAULT_PARAMS, wave, 'none', [], 1000000, 0)
    expect(next.columnsEmptiedThisCombo).toBe(1)
    expect(next.score).toBe(scoring.basePoint + scoring.columnSweepBonus * 1)
    expect(next.lastGain?.parts).toContain(`列一掃+${scoring.columnSweepBonus}`)
  })

  test('同じコンボ内で2列目を空にすると列一掃ボーナスが列数倍になる', () => {
    const wave = baseWave({
      foundation: card(0, '♠', 6), // 列1(rank7)との差を1にして取れるようにする
      tableau: [[card(1, '♣', 6)], [card(2, '♦', 7)]],
      columnsEmptiedThisCombo: 1,
    })
    const next = playCard(DEFAULT_PARAMS, wave, 'none', [], 1000000, 1)
    expect(next.columnsEmptiedThisCombo).toBe(2)
    expect(next.lastGain?.parts).toContain(`列一掃+${scoring.columnSweepBonus * 2}`)
  })
```

次に置き換える(基本ルールは「列の全カード(`rows`枚)を1コンボで空にした場合のみ」のため、`comboStreakColumnLengths`は対象列について`DEFAULT_PARAMS.layout.rows`と一致させる。実際の`tableau`の残り枚数(1枚)とは値が異なってよい — `comboStreakColumnLengths`は「現在の連続コンボが始まった時点」のスナップショットであり、現在の残り枚数ではないため):

```ts
  test('基本ルール: 列の全カードを1コンボで空にすると列一掃ボーナスが加算される(1列目)', () => {
    const wave = baseWave({
      tableau: [[card(1, '♣', 6)], [card(2, '♦', 9)]],
      comboStreakColumnLengths: [DEFAULT_PARAMS.layout.rows, 1],
    })
    const next = playCard(DEFAULT_PARAMS, wave, 'none', [], 1000000, 0)
    expect(next.columnsEmptiedThisCombo).toBe(1)
    expect(next.score).toBe(scoring.basePoint + scoring.columnSweepBonus * 1)
    expect(next.lastGain?.parts).toContain(`列一掃+${scoring.columnSweepBonus}`)
  })

  test('基本ルール: 列が現在の連続コンボ開始時点で全カードでなければ(=既に一部消化済みなら)列一掃ボーナスは付かない', () => {
    const wave = baseWave({
      tableau: [[card(1, '♣', 6)], [card(2, '♦', 9)]],
      comboStreakColumnLengths: [2, 1], // 列0はコンボ開始時点で2枚残っていた(rows=5と一致しないため、全カードを1コンボで消化したことにはならない)
    })
    const next = playCard(DEFAULT_PARAMS, wave, 'none', [], 1000000, 0)
    expect(next.columnsEmptiedThisCombo).toBe(0)
    expect(next.lastGain?.parts.some(p => p.startsWith('列一掃'))).toBe(false)
  })

  test('寛容の護符所持時: 列一掃の条件が「残りrows-columnSweepRelaxCards枚以下から1コンボで空に」に緩和される', () => {
    const wave = baseWave({
      tableau: [[card(1, '♣', 6)], [card(2, '♦', 9)]],
      comboStreakColumnLengths: [DEFAULT_PARAMS.layout.rows - DEFAULT_PARAMS.items.columnSweepRelaxCards, 1],
    })
    const next = playCard(DEFAULT_PARAMS, wave, 'none', ['grace'], 1000000, 0)
    expect(next.columnsEmptiedThisCombo).toBe(1)
    expect(next.lastGain?.parts).toContain(`列一掃+${scoring.columnSweepBonus}`)
  })

  test('同じコンボ内で2列目を空にすると列一掃ボーナスが列数倍になる', () => {
    const wave = baseWave({
      foundation: card(0, '♠', 6), // 列1(rank7)との差を1にして取れるようにする
      tableau: [[card(1, '♣', 6)], [card(2, '♦', 7)]],
      columnsEmptiedThisCombo: 1,
      comboStreakColumnLengths: [1, DEFAULT_PARAMS.layout.rows],
    })
    const next = playCard(DEFAULT_PARAMS, wave, 'none', [], 1000000, 1)
    expect(next.columnsEmptiedThisCombo).toBe(2)
    expect(next.lastGain?.parts).toContain(`列一掃+${scoring.columnSweepBonus * 2}`)
  })
```

`'場札が0枚になったら全消しボーナス...'`テストも、`comboStreakColumnLengths`を明示的に指定する(既定の`[]`のままだと`wave.comboStreakColumnLengths[colIndex]`が`undefined`になり、`undefined === rows`はfalseになるため列一掃ボーナスが期待通り付かなくなってしまう。対象列は`DEFAULT_PARAMS.layout.rows`と一致させ、基本ルールで列一掃ボーナスが成立する状態にする):

```ts
  test('場札が0枚になったら全消しボーナス(clearBonus+残り山札×clearBonusPerStock)が加算されendReason=fullClear', () => {
    const wave = baseWave({
      tableau: [[card(1, '♣', 6)]],
      stock: [card(9, '♠', 1), card(10, '♠', 2)],
      comboStreakColumnLengths: [DEFAULT_PARAMS.layout.rows],
    })
    const next = playCard(DEFAULT_PARAMS, wave, 'none', [], 100000000, 0)
    expect(next.tableau.reduce((n, c) => n + c.length, 0)).toBe(0)
    expect(next.status).toBe('ended')
    expect(next.endReason).toBe('fullClear')
    const expectedClearBonus = scoring.clearBonus + 2 * scoring.clearBonusPerStock
    expect(next.score).toBe(scoring.basePoint + scoring.columnSweepBonus * 1 + expectedClearBonus)
  })
```

`drawStock`describeブロック内の`'通常時(継続条件なし): コンボ・チェーン・列一掃カウントがリセットされ、捲った札1枚が新しい起点になる'`テストを:

```ts
  test('通常時(継続条件なし): コンボ・チェーン・列一掃カウントがリセットされ、捲った札1枚が新しい起点になる', () => {
    const wave = makeWave({
      stock: [card(1, '♠', 9)],
      combo: 3,
      chain: [card(2, '♣', 1)],
      chainOrigin: ['play'],
      linked: true,
      columnsEmptiedThisCombo: 2,
    })
    const next = drawStock(DEFAULT_PARAMS, wave, [])
    expect(next.foundation).toEqual(card(1, '♠', 9))
    expect(next.combo).toBe(0)
    expect(next.chain).toEqual([card(1, '♠', 9)])
    expect(next.chainOrigin).toEqual(['draw'])
    expect(next.linked).toBe(false)
    expect(next.columnsEmptiedThisCombo).toBe(0)
    expect(next.lastDrawEffect).toBeNull()
    expect(next.stock).toEqual([])
  })
```

次に置き換える(`comboStreakColumnLengths`が、その時点の`tableau`の各列枚数でスナップショットし直されることを確認する):

```ts
  test('通常時(継続条件なし): コンボ・チェーン・列一掃カウント・comboStreakColumnLengthsがリセットされ、捲った札1枚が新しい起点になる', () => {
    const wave = makeWave({
      stock: [card(1, '♠', 9)],
      combo: 3,
      chain: [card(2, '♣', 1)],
      chainOrigin: ['play'],
      linked: true,
      columnsEmptiedThisCombo: 2,
      tableau: [[card(3, '♣', 2)], [card(4, '♦', 8), card(5, '♥', 9)]],
      comboStreakColumnLengths: [0, 1],
    })
    const next = drawStock(DEFAULT_PARAMS, wave, [])
    expect(next.foundation).toEqual(card(1, '♠', 9))
    expect(next.combo).toBe(0)
    expect(next.chain).toEqual([card(1, '♠', 9)])
    expect(next.chainOrigin).toEqual(['draw'])
    expect(next.linked).toBe(false)
    expect(next.columnsEmptiedThisCombo).toBe(0)
    expect(next.comboStreakColumnLengths).toEqual([1, 2])
    expect(next.lastDrawEffect).toBeNull()
    expect(next.stock).toEqual([])
  })
```

`'ワイルドがめくれた場合...'`テストと`'パターンに合う札なら...'`テストに、`comboStreakColumnLengths`が維持されることを確認するアサーションを追加する:

```ts
  test('ワイルドがめくれた場合: コンボは変わらずチェーンに追加され、lastDrawEffectはwild', () => {
    const wave = makeWave({
      stock: [card(1, '★', 0, true)],
      combo: 3,
      chain: [card(2, '♣', 5)],
      chainOrigin: ['play'],
      linked: true,
      comboStreakColumnLengths: [4, 2],
    })
    const next = drawStock(DEFAULT_PARAMS, wave, [])
    expect(next.combo).toBe(3)
    expect(next.chain).toEqual([card(2, '♣', 5), card(1, '★', 0, true)])
    expect(next.chainOrigin).toEqual(['play', 'draw'])
    expect(next.linked).toBe(true)
    expect(next.lastDrawEffect).toBe('wild')
    expect(next.comboStreakColumnLengths).toEqual([4, 2])
  })
```

```ts
  test('パターンに合う札ならアイテム無しで特殊継続しlastDrawEffectはpattern', () => {
    const wave = makeWave({
      stock: [card(1, '♠', 9)], // 同スート継続
      combo: 2,
      chain: [card(2, '♠', 5)],
      chainOrigin: ['play'],
      linked: true,
      comboStreakColumnLengths: [3, 2],
    })
    const next = drawStock(DEFAULT_PARAMS, wave, [])
    expect(next.combo).toBe(2)
    expect(next.chain).toEqual([card(2, '♠', 5), card(1, '♠', 9)])
    expect(next.chainOrigin).toEqual(['play', 'draw'])
    expect(next.linked).toBe(true)
    expect(next.lastDrawEffect).toBe('pattern')
    expect(next.score).toBe(wave.score) // 得点は付かない
    expect(next.comboStreakColumnLengths).toEqual([3, 2])
  })
```

- [ ] **Step 9: 型チェックとテストを実行する**

Run: `npm run check`
Expected: エラーなし

Run: `npm run test`
Expected: 全ファイルPASS

- [ ] **Step 10: コミットする**

```bash
git add src/lib/game/shidasu/types.ts src/lib/game/shidasu/params.ts src/lib/game/shidasu/shidasu.config.json src/lib/game/shidasu/engine.ts src/lib/game/shidasu/engine.test.ts
git commit -m "feat: Shidasuの列一掃を基本ルールで難化し寛容の護符で緩和する"
```

---

### Task 3: ワイルドによる役穴埋め(フラッシュ・ロイヤルセット・コンプリートラン)

**Files:**
- Modify: `src/lib/game/shidasu/engine.ts`
- Modify: `src/lib/game/shidasu/engine.test.ts`

**Context:** `checkFlush`・`checkRoyalSet`・`checkCompleteRun`を、実カードだけでなくワイルドも含めた配列を受け取るように変更し、ワイルド1枚につき不足分を1つ埋めたものとして扱うようにする。現時点ではワイルドカードを山札に供給する手段が無いため、この変更は実際のプレイでは発動しないが、将来ワイルド供給アイテムが追加された際に機能するよう先行実装する。

- [ ] **Step 1: `engine.ts`の`checkFlush`を変更する**

```ts
export function checkFlush(realCardsIncludingThis: Card[]): boolean {
  if (realCardsIncludingThis.length < 4) return false
  const last4 = realCardsIncludingThis.slice(-4)
  const suitsPresent = new Set(last4.map(c => c.suit))
  return ALL_SUITS_REAL.every(s => suitsPresent.has(s))
}
```

次に置き換える:

```ts
export function checkFlush(chainIncludingThis: Card[]): boolean {
  if (chainIncludingThis.length < 4) return false
  const last4 = chainIncludingThis.slice(-4)
  const wildCount = last4.filter(c => c.wild).length
  const suitsPresent = new Set(last4.filter(c => !c.wild).map(c => c.suit))
  const missingSuits = ALL_SUITS_REAL.filter(s => !suitsPresent.has(s)).length
  return missingSuits <= wildCount
}
```

- [ ] **Step 2: `engine.ts`の`checkRoyalSet`を変更する**

```ts
export function checkRoyalSet(realCardsIncludingThis: Card[]): boolean {
  if (realCardsIncludingThis.length < 3) return false
  const last3 = realCardsIncludingThis.slice(-3)
  const ranksPresent = new Set(last3.map(c => c.rank))
  return ranksPresent.has(11) && ranksPresent.has(12) && ranksPresent.has(13)
}
```

次に置き換える:

```ts
export function checkRoyalSet(chainIncludingThis: Card[]): boolean {
  if (chainIncludingThis.length < 3) return false
  const last3 = chainIncludingThis.slice(-3)
  const wildCount = last3.filter(c => c.wild).length
  const ranksPresent = new Set(last3.filter(c => !c.wild).map(c => c.rank))
  const requiredRanks: Card['rank'][] = [11, 12, 13]
  const missingRanks = requiredRanks.filter(r => !ranksPresent.has(r)).length
  return missingRanks <= wildCount
}
```

- [ ] **Step 3: `engine.ts`の`checkCompleteRun`を変更する**

```ts
export function checkCompleteRun(realCardsBefore: Card[], realCardsIncludingThis: Card[]): boolean {
  const distinctBefore = new Set(realCardsBefore.map(c => c.rank)).size
  const distinctNow = new Set(realCardsIncludingThis.map(c => c.rank)).size
  return distinctBefore < 13 && distinctNow >= 13
}
```

次に置き換える:

```ts
export function checkCompleteRun(chainBefore: Card[], chainIncludingThis: Card[]): boolean {
  const distinctRealBefore = new Set(chainBefore.filter(c => !c.wild).map(c => c.rank)).size
  const wildCountBefore = chainBefore.filter(c => c.wild).length
  const distinctRealNow = new Set(chainIncludingThis.filter(c => !c.wild).map(c => c.rank)).size
  const wildCountNow = chainIncludingThis.filter(c => c.wild).length

  const distinctBefore = Math.min(13, distinctRealBefore + wildCountBefore)
  const distinctNow = Math.min(13, distinctRealNow + wildCountNow)
  return distinctBefore < 13 && distinctNow >= 13
}
```

- [ ] **Step 4: `engine.ts`の`evaluateChainBonus`内の呼び出し箇所を変更する**

```ts
  if (checkFlush(realIncludingThis)) {
    bonus += scoring.flushBonus
    parts.push(`フラッシュ+${scoring.flushBonus}`)
  }

  if (checkRoyalSet(realIncludingThis)) {
    bonus += scoring.royalSetBonus
    parts.push(`ロイヤル+${scoring.royalSetBonus}`)
  }
```

次に置き換える(ワイルドを含む`chainIncludingThis`を渡すようにする):

```ts
  if (checkFlush(chainIncludingThis)) {
    bonus += scoring.flushBonus
    parts.push(`フラッシュ+${scoring.flushBonus}`)
  }

  if (checkRoyalSet(chainIncludingThis)) {
    bonus += scoring.royalSetBonus
    parts.push(`ロイヤル+${scoring.royalSetBonus}`)
  }
```

さらに、その少し下の以下の行を:

```ts
  if (checkCompleteRun(realBefore, realIncludingThis)) {
```

次に置き換える(ワイルドを含む`chainBefore`/`chainIncludingThis`を渡すようにする):

```ts
  if (checkCompleteRun(chainBefore, chainIncludingThis)) {
```

- [ ] **Step 5: `engine.test.ts`の`checkFlush`・`checkRoyalSet`・`checkCompleteRun`describeブロックにワイルド穴埋めのテストを追加する**

`checkFlush`describeブロックの末尾に、以下のテストを追加する:

```ts
  test('ワイルドが1枚あれば不足スート1つを埋めたものとして成立する', () => {
    const cards = [card(1, '♦', 3), card(2, '♠', 5), card(3, '★', 0, true), card(4, '♥', 2)]
    // 実スートは♦♠♥の3種類、ワイルド1枚が残り1種類(♣)を埋める
    expect(checkFlush(cards)).toBe(true)
  })

  test('不足スート数がワイルド枚数を上回れば不成立', () => {
    const cards = [card(1, '♦', 3), card(2, '♦', 5), card(3, '★', 0, true), card(4, '♥', 2)]
    // 実スートは♦♥の2種類(♦が重複)、不足は♠♣の2つに対しワイルドは1枚のみ
    expect(checkFlush(cards)).toBe(false)
  })
```

`checkRoyalSet`describeブロックの末尾に、以下のテストを追加する:

```ts
  test('ワイルドが1枚あれば不足するJ/Q/Kのうち1つを埋めたものとして成立する', () => {
    const cards = [card(1, '♠', 13), card(2, '★', 0, true), card(3, '♦', 12)]
    // 実ランクはK・Qの2種類、ワイルド1枚が残り1種類(J)を埋める
    expect(checkRoyalSet(cards)).toBe(true)
  })

  test('不足ランク数がワイルド枚数を上回れば不成立', () => {
    const cards = [card(1, '♠', 13), card(2, '★', 0, true), card(3, '♦', 5)]
    // 実ランクはKのみ、不足はQ・Jの2つに対しワイルドは1枚のみ
    expect(checkRoyalSet(cards)).toBe(false)
  })
```

`checkCompleteRun`describeブロックの末尾に、以下のテストを追加する:

```ts
  test('ワイルド1枚が未出現ランク1つを埋め、実12種+ワイルド1枚で13種扱いになる', () => {
    const before = [
      ...Array.from({ length: 11 }, (_, i) => card(i + 1, '♠', (i + 1) as Card['rank'])),
      card(90, '★', 0, true),
    ] // 実11種+ワイルド1枚 = 12種扱い(まだ13種未満)
    const now = [...before, card(13, '♥', 12)] // 実12種目を追加 = 12種+ワイルド1枚 = 13種扱い
    expect(checkCompleteRun(before, now)).toBe(true)
  })

  test('ワイルドが無ければ実11種+実1種=実12種のままで13種に届かない', () => {
    const before = Array.from({ length: 11 }, (_, i) => card(i + 1, '♠', (i + 1) as Card['rank']))
    const now = [...before, card(13, '♥', 12)]
    expect(checkCompleteRun(before, now)).toBe(false)
  })
```

- [ ] **Step 6: 型チェックとテストを実行する**

Run: `npm run check`
Expected: エラーなし

Run: `npm run test`
Expected: 全ファイルPASS

- [ ] **Step 7: コミットする**

```bash
git add src/lib/game/shidasu/engine.ts src/lib/game/shidasu/engine.test.ts
git commit -m "feat: Shidasuのフラッシュ・ロイヤルセット・コンプリートランにワイルド穴埋めルールを追加"
```

---

### Task 4: UI更新(ゲーム画面・DebugPanel・管理画面)

**Files:**
- Modify: `src/routes/game/shidasu/+page.svelte`
- Modify: `src/routes/game/shidasu/DebugPanel.svelte`
- Modify: `src/routes/admin/shidasu/+page.svelte`

**Context:** `shieldLeft`フィールド削除に伴い、ゲーム画面の「盾×N」表示と、DebugPanelの内部状態表示を削除する。管理画面の「アイテム」セクションを、旧7項目から新2項目(`stairRelaxedMinLen`・`columnSweepRelaxCards`)に置き換える。

- [ ] **Step 1: `src/routes/game/shidasu/+page.svelte`を変更する**

以下のブロックを削除する:

```svelte
      {#if displayWave.shieldLeft > 0}
        <span class="text-xs bg-sky-900 text-sky-200 border border-sky-600 rounded px-1.5 py-0.5">盾×{displayWave.shieldLeft}</span>
      {/if}
```

- [ ] **Step 2: `src/routes/game/shidasu/DebugPanel.svelte`を変更する**

以下の行を:

```svelte
      <div>shieldLeft: {wave.shieldLeft}</div>
```

次に置き換える:

```svelte
      <div class="col-span-2">comboStreakColumnLengths: {wave.comboStreakColumnLengths.join(',')}</div>
```

- [ ] **Step 3: `src/routes/admin/shidasu/+page.svelte`を変更する**

`hasValidationError`の`$derived.by`内、`if (!Number.isFinite(config.ui.chainCardOffsetX) || config.ui.chainCardOffsetX < 0) return true`の行の直後に、以下の2行を追加する:

```ts
    if (!Number.isFinite(config.items.stairRelaxedMinLen) || config.items.stairRelaxedMinLen < 1) return true
    if (!Number.isFinite(config.items.columnSweepRelaxCards) || config.items.columnSweepRelaxCards < 0) return true
```

「アイテム」セクションを:

```svelte
      <section class="bg-white border border-slate-200 rounded-xl p-4">
        <h2 class="font-semibold text-slate-700 text-sm mb-3">アイテム</h2>
        <div class="grid grid-cols-2 gap-3">
          <label class="text-xs text-slate-500">
            紅の目利き(redBonusValue)
            {@render scaledNumberInput(config.items.redBonusValue, v => setItems('redBonusValue', v))}
          </label>
          <label class="text-xs text-slate-500">
            宮廷の紋章(faceBonusValue)
            {@render scaledNumberInput(config.items.faceBonusValue, v => setItems('faceBonusValue', v))}
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
            {@render scaledNumberInput(config.items.fullClearItemBonus, v => setItems('fullClearItemBonus', v))}
          </label>
        </div>
      </section>
```

次に置き換える:

```svelte
      <section class="bg-white border border-slate-200 rounded-xl p-4">
        <h2 class="font-semibold text-slate-700 text-sm mb-3">アイテム</h2>
        <div class="grid grid-cols-2 gap-3">
          <label class="text-xs text-slate-500">
            架橋の護符: 階段成立に必要な枚数(stairRelaxedMinLen)
            <input type="number" min="1" step="1" bind:value={config.items.stairRelaxedMinLen} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            寛容の護符: 列一掃緩和の猶予枚数(columnSweepRelaxCards)
            <input type="number" min="0" step="1" bind:value={config.items.columnSweepRelaxCards} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
        </div>
      </section>
```

- [ ] **Step 4: 型チェックを実行する**

Run: `npm run check`
Expected: エラーなし

- [ ] **Step 5: コミットする**

```bash
git add src/routes/game/shidasu/+page.svelte src/routes/game/shidasu/DebugPanel.svelte src/routes/admin/shidasu/+page.svelte
git commit -m "feat: Shidasuのアイテム刷新にUI(ゲーム画面・DebugPanel・管理画面)を追従させる"
```

---

### Task 5: 最終検証+ロードマップ更新

**Files:**
- Modify: `docs/shidasu-roadmap.md`

**Context:** 全体の整合性を最終確認し、ロードマップ文書の項目2に、今回実装した内容と今回スコープ外にした残タスクを追記する。

- [ ] **Step 1: 全テストを実行する**

Run: `npm run test`
Expected: 全ファイルPASS

- [ ] **Step 2: 型チェック・Lintを実行する**

Run: `npm run check`
Expected: エラーなし

Run: `npx eslint src/lib/game/shidasu/ src/routes/game/shidasu/ src/routes/admin/shidasu/`
Expected: エラーなし

- [ ] **Step 3: 本番ビルドを実行する**

Run: `npm run build`
Expected: ビルド成功

- [ ] **Step 4: `docs/shidasu-roadmap.md`の項目2を更新する**

```markdown
2. **アイテムなどの詳細な種類と効果の検討**
   現在のアイテムプール(紅の目利き・宮廷の紋章・コンボシールド・厚めの山札・ワイルド★・助走・完全消去)に続く、新規アイテムの種類・効果を検討する。
```

次に置き換える:

```markdown
2. **アイテムなどの詳細な種類と効果の検討**
   2026-07-09、役ボーナス軸のうち「条件が難しい役(階段・列一掃・フラッシュ・ロイヤルセット・コンプリートラン)の緩和」に着手し、既存7個のアイテム(紅の目利き・宮廷の紋章・コンボシールド・厚めの山札・ワイルド★・助走・完全消去)を全て削除、新規に「架橋の護符」(階段緩和)・「寛容の護符」(列一掃緩和)の2個を追加した。あわせて、全アイテムを「1種類につき最大1個まで」保持できるルールに統一した(詳細: `docs/superpowers/specs/2026-07-09-shidasu-item-hard-yaku-relax-design.md`)。
   残タスク: 役ボーナス軸のうち同スート・同色・同ランクの緩和/強化アイテム、コンボ軸・全消し軸・詰み救済軸の新規アイテム、「ワンパン軸」(少ない枚数で高得点)という新軸の検討、アイテム所持数の上限・入れ替え機能、ワイルドカードを山札に供給する新規アイテム(現状ワイルドの供給源が無いため、フラッシュ/ロイヤルセット/コンプリートランのワイルド穴埋めルールは実装済みだが未発動)。
```

- [ ] **Step 5: ロードマップ更新をコミットする**

```bash
git add docs/shidasu-roadmap.md
git commit -m "docs: shidasu-roadmap.mdの項目2に難条件役緩和護符の実装状況を追記"
```

- [ ] **Step 6: 開発サーバーで動作確認する**

Run: `npm run dev`(既に起動中でなければ)

ブラウザで以下を確認する:
- `/game/shidasu`でゲームを開始し、場札を数枚プレイして通常のスコア加算が動作することを確認する
- DebugPanelの「山札の次を強制指定」機能を使い、階段(連続するランク)を5枚以上繋げてstairBonus(既定`stairMinLen=5`)が付くことを確認する
- ウェーブをクリアしてアイテム選択画面を開き、選択肢が「架橋の護符」「寛容の護符」の2つ(または所持済みなら残りの1つ、あるいは両方所持済みなら空)になっていることを確認する
- 「架橋の護符」を選択し、以後は階段3枚でもstairBonusが付くことを確認する
- 2周目以降、両アイテムを取り尽くすとアイテム選択画面の選択肢が空になることを確認する(想定通りの挙動であり、今回のスコープでは対処しない)
- コンソールエラーが出ていないことを確認する
- `/admin/shidasu`にアクセスし、「アイテム」セクションに`stairRelaxedMinLen`・`columnSweepRelaxCards`の2項目のみが表示され、値が正しく読み込まれていることを確認する(保存操作は行わなくてよい)

- [ ] **Step 7: 不具合が見つかった場合のみ修正しコミットする**

```bash
git add -A
git commit -m "fix: 難条件役緩和護符の最終検証で見つかった不具合を修正"
```

---

## 自己レビュー結果

- **スペック網羅性**: spec 1節(既存アイテム全削除)→Task1、2節(1個までルール)→Task1、3.1節(階段基本難化)→Task1、3.2節(ワイルド穴埋め基本ルール)→Task3、4.1節(架橋の護符)→Task1、4.2節(寛容の護符+comboStreakColumnLengths)→Task2、5節(プール構成2個)→Task1・Task2、6節(スコープ外の追記)→Task5、7節(受け入れ基準)→Task5で対応済み。
- **プレースホルダー**: なし。全タスクに実際のコード・完全なテスト内容を記載。
- **型・関数名の一貫性**: `ItemId`(`'bridge' | 'grace'`)・`ShidasuParams.items.stairRelaxedMinLen`/`columnSweepRelaxCards`・`WaveState.comboStreakColumnLengths`は全タスクで同じ名前を一貫して使用している。`evaluateChainBonus`の第4引数`stairMinLen`もTask1で導入し、Task1以降変更していない。
- **ビルド健全性**: 各タスクの終了時点で、型定義・設定・エンジン・テストが揃って更新されるよう構成しており、タスク境界ごとに`npm run check`・`npm run test`がグリーンになる設計にした。
