# Shidasu 永続デッキ構成+ウェーブ内捨て札の実装 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ラン全体で持続するデッキ構成(`RunState.deckComposition`)とウェーブ内限定の捨て札(`WaveState.discardPile`)という2つの基盤を作り、それに依存する4個の護符(永劫・豊穣・静寂・不屈)を実装する。

**Architecture:** `startWave`が標準52枚デッキを毎回新規生成する代わりに、`RunState`が持つ`deckComposition`(idを持たないカード構成のリスト)を元に配る形へ変更する。永劫・豊穣は`startWave`内で`deckComposition`を書き換え、静寂は`drawStock`内で書き換える。不屈は`WaveState.discardPile`(コンボリセット時にチェーンが送られる、ウェーブ内限定の捨て札)を参照する。

**Tech Stack:** TypeScript, Vitest。対象ファイルは`src/lib/game/shidasu/{types,deck,params,engine}.ts`・`src/lib/game/shidasu/shidasu.config.json`・`src/lib/game/shidasu/{deck,engine}.test.ts`・`src/routes/admin/shidasu/+page.svelte`。

---

## 前提知識(実装者向け)

- 詳細仕様は`docs/superpowers/specs/2026-07-14-shidasu-persistent-deck-discard-design.md`を参照(本プランはこのspecの実装計画)。
- 永劫・豊穣・静寂・不屈は、既存の`bridge`/`grace`と同様に`ITEM_EFFECTS`レジストリ(採点パイプライン)には登録しない。`items.includes(...)`によって該当箇所を直接分岐させるルール系の護符として実装する。
- `startWave`・`drawStock`は、デッキ構成を書き換える可能性があるため、戻り値が`{ wave: WaveState; deckComposition: DeckCard[] }`のペアになる(現在の`startWave`は`WaveState`を直接返している。`drawStock`も同様に変更する)。

---

### Task 1: データモデル拡張(DeckCard型・WaveState.discardPile・RunState.deckComposition・talismans.resilience)

**Files:**
- Modify: `src/lib/game/shidasu/types.ts`
- Modify: `src/lib/game/shidasu/deck.ts`
- Modify: `src/lib/game/shidasu/params.ts`
- Modify: `src/lib/game/shidasu/shidasu.config.json`
- Modify: `src/lib/game/shidasu/deck.test.ts`
- Modify: `src/lib/game/shidasu/engine.test.ts`(`makeWave`ヘルパー)

- [ ] **Step 1: 失敗するテストを書く(standardDeckCompositionとtalismans.resilience)**

`src/lib/game/shidasu/deck.test.ts`の末尾(`describe('createDeck', ...)`ブロックの後)に追加:

```ts
describe('standardDeckComposition', () => {
  test('52枚、全スート×全ランクを網羅し、全て非ワイルド', () => {
    const composition = standardDeckComposition()
    expect(composition).toHaveLength(52)
    expect(composition.every(c => !c.wild)).toBe(true)
    const suits = ['♠', '♥', '♦', '♣'] as const
    suits.forEach(suit => {
      const ranks = composition.filter(c => c.suit === suit).map(c => c.rank).sort((a, b) => a - b)
      expect(ranks).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13])
    })
  })
})
```

このファイル冒頭のimport文を`import { createDeck, createRng, shuffle, standardDeckComposition } from './deck'`に変更する。

`src/lib/game/shidasu/engine.test.ts`の`describe('DEFAULT_PARAMS.talismans (グループ4〜8)', ...)`ブロックの直後に追加:

```ts
describe('DEFAULT_PARAMS.talismans.resilience', () => {
  test('既定値が設定されている', () => {
    expect(DEFAULT_PARAMS.talismans.resilience.p).toBe(30)
  })
})
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `npm run test -- deck.test.ts engine.test.ts`
Expected: FAIL(`standardDeckComposition`が存在しない、`DEFAULT_PARAMS.talismans.resilience`が`undefined`)

- [ ] **Step 3: `types.ts`に`DeckCard`型・`ItemId`4個・`WaveState.discardPile`・`RunState.deckComposition`を追加**

`src/lib/game/shidasu/types.ts`の`ItemId`型定義の末尾(`| 'drizzle'`の直後)に追加:

```ts
  | 'eternity' | 'abundance' | 'silence' | 'resilience'
```

`Card`インターフェースの直後に追加:

```ts
// ラン全体で持続するデッキの中身(idを持たない。ウェーブ開始のたびに新しいidを振ってCardを生成する)
export interface DeckCard {
  suit: Suit
  rank: Rank
  wild: boolean
}
```

`WaveState`インターフェース内、`firstPlayDone: boolean`の直後に追加:

```ts
  // コンボリセット時にチェーンにあった札が送られる、ウェーブ内限定の捨て札(不屈の護符が参照する。ウェーブを跨いで持続しない)
  discardPile: Card[]
```

`RunState`インターフェース内、`pendingNewItem: ItemId | null`の直後に追加:

```ts
  // ラン全体で持続するデッキの構成(永劫・豊穣・静寂によって書き換えられる)
  deckComposition: DeckCard[]
```

- [ ] **Step 4: `deck.ts`に`standardDeckComposition`を追加**

`src/lib/game/shidasu/deck.ts`の冒頭のimport文を以下に置き換える:

```ts
import type { Card, Suit, Rank, DeckCard } from './types'
```

`createDeck`関数の直後に追加:

```ts
export function standardDeckComposition(): DeckCard[] {
  const composition: DeckCard[] = []
  for (const suit of SUITS) {
    for (let rank = 1; rank <= 13; rank++) {
      composition.push({ suit, rank: rank as Rank, wild: false })
    }
  }
  return composition
}
```

- [ ] **Step 5: `params.ts`・`shidasu.config.json`に`talismans.resilience`を追加**

`src/lib/game/shidasu/params.ts`の`ShidasuParams.talismans`型内、`drizzle: { n: number }`の直後に追加:

```ts
    resilience: { p: number }
```

`DEFAULT_PARAMS.talismans`内、`drizzle: { n: 50 },`の直後に追加:

```ts
    resilience: { p: 30 },
```

`src/lib/game/shidasu/shidasu.config.json`の`talismans`オブジェクト内、`"drizzle": { "n": 50 }`を以下に置き換える:

```json
    "drizzle": { "n": 50 },
    "resilience": { "p": 30 }
```

- [ ] **Step 6: `makeWave`テストヘルパーに`discardPile: []`を追加**

`src/lib/game/shidasu/engine.test.ts`の`makeWave`関数内、`firstPlayDone: false,`の直後に追加:

```ts
    discardPile: [],
```

- [ ] **Step 7: テストを実行して成功を確認**

Run: `npm run test -- deck.test.ts engine.test.ts`
Expected: FAIL(この時点では`WaveState`/`RunState`に必須フィールドが増えたことで、既存の`startWave`・`makeWave`呼び出し以外の箇所(`RunState`を直接組み立てているテスト等)で型エラーが出る可能性がある。Task 2で`startWave`とその呼び出し箇所を修正するまでは、型エラーが残るのは想定内)

Run: `npm run test -- deck.test.ts` のみ実行した場合は成功するはず(このテストは`WaveState`/`RunState`に依存しないため)
Expected: PASS

- [ ] **Step 8: コミット**

```bash
git add src/lib/game/shidasu/types.ts src/lib/game/shidasu/deck.ts src/lib/game/shidasu/params.ts src/lib/game/shidasu/shidasu.config.json src/lib/game/shidasu/deck.test.ts src/lib/game/shidasu/engine.test.ts
git commit -m "$(cat <<'EOF'
feat: Shidasu永続デッキ構成の型定義(DeckCard・discardPile・deckComposition)を追加

永劫・豊穣・静寂・不屈の実装に向けて、DeckCard型・WaveState.discardPile・
RunState.deckComposition・talismans.resilienceを追加した。
startWave/drawStockの実際の配線はTask2以降で行う。
EOF
)"
```

---

### Task 2: startWaveの永続デッキ対応(シグネチャ変更・永劫・豊穣)

**Files:**
- Modify: `src/lib/game/shidasu/engine.ts`
- Modify: `src/lib/game/shidasu/engine.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/game/shidasu/engine.test.ts`の`describe('startWave', ...)`ブロック全体を以下に置き換える:

```ts
describe('startWave', () => {
  test('場札はcols×rowsの列数・枚数になる', () => {
    const { wave } = startWave(DEFAULT_PARAMS, 0, 0, [], standardDeckComposition(), 1)
    expect(wave.tableau).toHaveLength(DEFAULT_PARAMS.layout.cols)
    wave.tableau.forEach(col => expect(col).toHaveLength(DEFAULT_PARAMS.layout.rows))
  })

  test('comboStreakColumnLengthsは各列ともrows枚で初期化される', () => {
    const { wave } = startWave(DEFAULT_PARAMS, 0, 0, [], standardDeckComposition(), 1)
    expect(wave.comboStreakColumnLengths).toEqual(wave.tableau.map(() => DEFAULT_PARAMS.layout.rows))
  })

  test('山札+場札+foundationで52枚になる(アイテムなし)', () => {
    const { wave } = startWave(DEFAULT_PARAMS, 0, 0, [], standardDeckComposition(), 1)
    const tableauCount = wave.tableau.reduce((n, c) => n + c.length, 0)
    expect(tableauCount + wave.stock.length + 1).toBe(52)
  })

  test('初期状態: チェーンにfoundationが1枚(由来はdraw)、スコア0、コンボ0、列一掃0、演出フラグnull、捨て札は空', () => {
    const { wave } = startWave(DEFAULT_PARAMS, 0, 0, [], standardDeckComposition(), 1)
    expect(wave.score).toBe(0)
    expect(wave.combo).toBe(0)
    expect(wave.chain).toEqual([wave.foundation])
    expect(wave.chainOrigin).toEqual(['draw'])
    expect(wave.linked).toBe(false)
    expect(wave.columnsEmptiedThisCombo).toBe(0)
    expect(wave.lastDrawEffect).toBeNull()
    expect(wave.status).toBe('playing')
    expect(wave.discardPile).toEqual([])
  })

  test('同じシードなら同じ結果になる(決定的、アイテムを持っていても山札生成自体は変わらない)', () => {
    const a = startWave(DEFAULT_PARAMS, 0, 0, ['bridge'], standardDeckComposition(), 123)
    const b = startWave(DEFAULT_PARAMS, 0, 0, ['bridge'], standardDeckComposition(), 123)
    expect(a).toEqual(b)
  })

  test('永劫を持っていればdeckCompositionにワイルドが1枚追加され、山札構築に反映される(53枚になる)', () => {
    const { wave, deckComposition } = startWave(DEFAULT_PARAMS, 0, 0, ['eternity'], standardDeckComposition(), 1)
    expect(deckComposition).toHaveLength(53)
    const tableauCount = wave.tableau.reduce((n, c) => n + c.length, 0)
    expect(tableauCount + wave.stock.length + 1).toBe(53)
  })

  test('豊穣を持っていればdeckComposition内の1枚がワイルドに変換される(枚数は52枚のまま)', () => {
    const { deckComposition } = startWave(DEFAULT_PARAMS, 0, 0, ['abundance'], standardDeckComposition(), 1)
    expect(deckComposition).toHaveLength(52)
    expect(deckComposition.filter(c => c.wild)).toHaveLength(1)
  })

  test('永劫・豊穣を複数ウェーブ保持し続けると効果が蓄積する', () => {
    const first = startWave(DEFAULT_PARAMS, 0, 0, ['eternity', 'abundance'], standardDeckComposition(), 1)
    const second = startWave(DEFAULT_PARAMS, 0, 1, ['eternity', 'abundance'], first.deckComposition, 2)
    expect(second.deckComposition).toHaveLength(54) // 標準52枚+永劫2ウェーブ分
    expect(second.deckComposition.filter(c => c.wild)).toHaveLength(4) // 永劫追加2枚+豊穣変換2枚
  })
})
```

このファイル冒頭のimport文に`standardDeckComposition`を追加する(`import { createRng } from './deck'`を`import { createRng, standardDeckComposition } from './deck'`に変更)。

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `npm run test -- engine.test.ts`
Expected: FAIL(`startWave`の戻り値が`WaveState`のままで`.wave`プロパティが無い、シグネチャの引数も合わない)

- [ ] **Step 3: `startWave`のシグネチャを変更し、永劫・豊穣を実装**

`src/lib/game/shidasu/engine.ts`冒頭のimport文を以下に置き換える:

```ts
import type { Card, StageModifier, WaveState, ItemId, WaveEndReason, RunState, Suit, Rank, DeckCard } from './types'
import type { ShidasuParams } from './params'
import { createDeck, createRng, shuffle, shuffleInPlace, standardDeckComposition } from './deck'
```

`startWave`関数全体を以下に置き換える:

```ts
// デッキ構成のうち非ワイルドの1枚をランダムに選びワイルドへ変換した新しい配列を返す(候補が無ければそのまま返す)
function convertRandomCardToWild(composition: DeckCard[], rand: () => number): DeckCard[] {
  const candidates = composition.map((c, i) => i).filter(i => !composition[i].wild)
  if (candidates.length === 0) return composition
  const target = candidates[Math.floor(rand() * candidates.length)]
  return composition.map((c, i) => (i === target ? { ...c, wild: true } : c))
}

export function startWave(
  params: ShidasuParams,
  _stageIndex: number,
  _waveIndex: number,
  items: ItemId[],
  deckComposition: DeckCard[],
  seed?: number
): { wave: WaveState; deckComposition: DeckCard[] } {
  const rand = createRng(seed ?? Math.floor(Math.random() * 999999) + 1)
  let idSeq = 0
  const nextId = () => ++idSeq

  let composition = deckComposition
  if (items.includes('eternity')) {
    composition = [...composition, { suit: '★', rank: 0 as Rank, wild: true }]
  }
  if (items.includes('abundance')) {
    composition = convertRandomCardToWild(composition, rand)
  }

  const deck = shuffle(composition.map(c => ({ id: nextId(), ...c })), rand)
  const { cols, rows } = params.layout
  const tableau: Card[][] = []
  for (let c = 0; c < cols; c++) {
    tableau.push(deck.splice(0, rows))
  }
  const foundation = deck.pop() as Card

  const wave: WaveState = {
    tableau,
    stock: deck,
    foundation,
    score: 0,
    combo: 0,
    chain: [foundation],
    chainOrigin: ['draw'],
    linked: false,
    columnsEmptiedThisCombo: 0,
    comboStreakColumnLengths: tableau.map(col => col.length),
    lastDrawEffect: null,
    status: 'playing',
    endReason: null as WaveEndReason,
    lastGain: null,
    firstPlayDone: false,
    discardPile: [],
  }

  return { wave, deckComposition: composition }
}
```

- [ ] **Step 4: `startWave`の呼び出し箇所5箇所と`createInitialRun`を修正**

`src/lib/game/shidasu/engine.ts`の`createInitialRun`関数を以下に置き換える:

```ts
export function createInitialRun(): RunState {
  return { phase: 'title', stageIndex: 0, waveIndex: 0, items: [], offer: [], wave: null, pendingNewItem: null, deckComposition: standardDeckComposition() }
}
```

`beginRun`関数を以下に置き換える:

```ts
export function beginRun(params: ShidasuParams, seed?: number): RunState {
  const { wave, deckComposition } = startWave(params, 0, 0, [], standardDeckComposition(), seed)
  return {
    phase: 'playing',
    stageIndex: 0,
    waveIndex: 0,
    items: [],
    offer: [],
    wave,
    pendingNewItem: null,
    deckComposition,
  }
}
```

`pickItem`関数を以下に置き換える:

```ts
export function pickItem(params: ShidasuParams, run: RunState, itemId: ItemId, seed?: number): RunState {
  if (run.phase !== 'itemSelect') return run
  if (run.items.length >= params.items.maxItems) {
    return { ...run, pendingNewItem: itemId }
  }
  const newItems = [...run.items, itemId]
  const newWaveIndex = run.waveIndex + 1
  const { wave, deckComposition } = startWave(params, run.stageIndex, newWaveIndex, newItems, run.deckComposition, seed)
  return {
    ...run,
    phase: 'playing',
    items: newItems,
    waveIndex: newWaveIndex,
    offer: [],
    pendingNewItem: null,
    wave,
    deckComposition,
  }
}
```

`confirmItemSwap`関数を以下に置き換える:

```ts
export function confirmItemSwap(params: ShidasuParams, run: RunState, oldItemId: ItemId, seed?: number): RunState {
  if (run.phase !== 'itemSelect' || run.pendingNewItem === null) return run
  const idx = run.items.indexOf(oldItemId)
  const remaining = idx === -1 ? [...run.items] : [...run.items.slice(0, idx), ...run.items.slice(idx + 1)]
  const newItems = [...remaining, run.pendingNewItem]
  const newWaveIndex = run.waveIndex + 1
  const { wave, deckComposition } = startWave(params, run.stageIndex, newWaveIndex, newItems, run.deckComposition, seed)
  return {
    ...run,
    phase: 'playing',
    items: newItems,
    waveIndex: newWaveIndex,
    offer: [],
    pendingNewItem: null,
    wave,
    deckComposition,
  }
}
```

`skipItemSelect`関数を以下に置き換える:

```ts
export function skipItemSelect(params: ShidasuParams, run: RunState, seed?: number): RunState {
  if (run.phase !== 'itemSelect') return run
  const newWaveIndex = run.waveIndex + 1
  const { wave, deckComposition } = startWave(params, run.stageIndex, newWaveIndex, run.items, run.deckComposition, seed)
  return {
    ...run,
    phase: 'playing',
    waveIndex: newWaveIndex,
    offer: [],
    pendingNewItem: null,
    wave,
    deckComposition,
  }
}
```

`advanceStage`関数を以下に置き換える:

```ts
export function advanceStage(params: ShidasuParams, run: RunState, seed?: number): RunState {
  if (run.phase !== 'stageClear') return run
  const newStageIndex = run.stageIndex + 1
  const { wave, deckComposition } = startWave(params, newStageIndex, 0, run.items, run.deckComposition, seed)
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

- [ ] **Step 5: テストを実行して成功を確認**

Run: `npm run test -- engine.test.ts`
Expected: PASS(`startWave`関連は全てPASS。ただし`drawStock`関連のテストはTask3まで型エラーが残る可能性がある — `drawStock`のシグネチャ自体はTask3で変更するため、この時点ではまだ変更していない)

Run: `npm run build`
Expected: この時点では`drawStock`関連の型不整合が残っている可能性があるため、Task3完了まではエラーが出ても想定内(最終的にはTask3完了時点で解消される)

- [ ] **Step 6: コミット**

```bash
git add src/lib/game/shidasu/engine.ts src/lib/game/shidasu/engine.test.ts
git commit -m "$(cat <<'EOF'
feat: startWaveをRunState.deckComposition対応にし、永劫・豊穣を実装

startWaveが{wave, deckComposition}のペアを返すよう変更し、
永劫(ワイルド追加)・豊穣(既存カードのワイルド変換)が
ウェーブを跨いで持続するようにした。呼び出し元5箇所を更新。
EOF
)"
```

---

### Task 3: drawStockの捨て札蓄積・静寂の実装

**Files:**
- Modify: `src/lib/game/shidasu/engine.ts`
- Modify: `src/lib/game/shidasu/engine.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/game/shidasu/engine.test.ts`の`describe('drawStock', ...)`ブロック全体を以下に置き換える:

```ts
describe('drawStock', () => {
  test('山札が空なら何もしない', () => {
    const wave = makeWave({ stock: [] })
    const composition = standardDeckComposition()
    expect(drawStock(DEFAULT_PARAMS, wave, [], composition).wave).toBe(wave)
  })

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
    const { wave: next } = drawStock(DEFAULT_PARAMS, wave, [], standardDeckComposition())
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

  test('ワイルドがめくれた場合(継続中のパターンが無い): コンボがリセットされ、ワイルド1枚が新しい起点になる', () => {
    const wave = makeWave({
      stock: [card(1, '★', 0, true)],
      combo: 3,
      chain: [card(2, '♣', 5)], // 実カード1枚のみ、パターン不成立
      chainOrigin: ['play'],
      linked: true,
      comboStreakColumnLengths: [4, 2],
    })
    const { wave: next } = drawStock(DEFAULT_PARAMS, wave, [], standardDeckComposition())
    expect(next.combo).toBe(0)
    expect(next.chain).toEqual([card(1, '★', 0, true)])
    expect(next.chainOrigin).toEqual(['draw'])
    expect(next.linked).toBe(false)
    expect(next.lastDrawEffect).toBeNull()
  })

  test('ワイルドがめくれた場合(継続中のパターンがある): コンボが継続し、lastDrawEffectはwild', () => {
    const wave = makeWave({
      stock: [card(1, '★', 0, true)],
      combo: 3,
      chain: [card(2, '♠', 5), card(3, '♠', 6), card(4, '♠', 7)], // 実カード3枚・同スート継続中
      chainOrigin: ['play', 'play', 'play'],
      linked: true,
      comboStreakColumnLengths: [4, 2],
    })
    const { wave: next } = drawStock(DEFAULT_PARAMS, wave, [], standardDeckComposition())
    expect(next.combo).toBe(3)
    expect(next.chain).toEqual([card(2, '♠', 5), card(3, '♠', 6), card(4, '♠', 7), card(1, '★', 0, true)])
    expect(next.chainOrigin).toEqual(['play', 'play', 'play', 'draw'])
    expect(next.linked).toBe(true)
    expect(next.lastDrawEffect).toBe('wild')
    expect(next.comboStreakColumnLengths).toEqual([4, 2])
  })

  test('パターンに合う札ならアイテム無しで特殊継続しlastDrawEffectはpattern', () => {
    const wave = makeWave({
      stock: [card(1, '♠', 9)], // 同スート継続(捲った後で実カード3枚)
      combo: 2,
      chain: [card(2, '♠', 4), card(3, '♠', 5)],
      chainOrigin: ['play', 'play'],
      linked: true,
      comboStreakColumnLengths: [3, 2],
    })
    const { wave: next } = drawStock(DEFAULT_PARAMS, wave, [], standardDeckComposition())
    expect(next.combo).toBe(2)
    expect(next.chain).toEqual([card(2, '♠', 4), card(3, '♠', 5), card(1, '♠', 9)])
    expect(next.chainOrigin).toEqual(['play', 'play', 'draw'])
    expect(next.linked).toBe(true)
    expect(next.lastDrawEffect).toBe('pattern')
    expect(next.score).toBe(wave.score) // 得点は付かない
    expect(next.comboStreakColumnLengths).toEqual([3, 2])
  })

  test('架橋の護符所持時は、山札めくりの階段パターン継続判定にもstairRelaxedMinLenが使われる', () => {
    const wave = makeWave({
      stock: [card(1, '♦', 7)], // 階段継続: 5→6→7(長さ3)
      combo: 2,
      chain: [card(2, '♠', 5), card(3, '♣', 6)], // dir=+1, len=2
      chainOrigin: ['play', 'play'],
      linked: true,
    })
    const { wave: next } = drawStock(DEFAULT_PARAMS, wave, ['bridge'], standardDeckComposition()) // stairRelaxedMinLen=3
    expect(next.combo).toBe(2)
    expect(next.lastDrawEffect).toBe('pattern')
    expect(next.chain).toEqual([card(2, '♠', 5), card(3, '♣', 6), card(1, '♦', 7)])
  })

  test('架橋の護符を持っていなければ、同じ階段(長さ3)ではdrawStockのパターン継続は成立しない(既定stairMinLen(5)未満)', () => {
    const wave = makeWave({
      stock: [card(1, '♦', 7)],
      combo: 2,
      chain: [card(2, '♠', 5), card(3, '♣', 6)],
      chainOrigin: ['play', 'play'],
      linked: true,
    })
    const { wave: next } = drawStock(DEFAULT_PARAMS, wave, [], standardDeckComposition())
    expect(next.combo).toBe(0) // リセットされる
    expect(next.lastDrawEffect).toBeNull()
  })

  test('パターンに合わなければ通常通りリセットし、捲った札1枚が新しい起点になる', () => {
    const wave = makeWave({
      stock: [card(1, '♣', 9)], // 同スートでも階段でもない
      combo: 2,
      chain: [card(2, '♥', 5)],
      chainOrigin: ['play'],
      linked: true,
    })
    const { wave: next } = drawStock(DEFAULT_PARAMS, wave, [], standardDeckComposition())
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
    const { wave: next } = drawStock(DEFAULT_PARAMS, wave, [], standardDeckComposition())
    expect(next.lastGain).toBeNull()
  })

  test('リセット時、直前のチェーンが捨て札に追加される', () => {
    const wave = makeWave({
      stock: [card(1, '♣', 9)],
      chain: [card(2, '♥', 5), card(3, '♥', 6)],
      linked: true,
      discardPile: [card(9, '♦', 1)],
    })
    const { wave: next } = drawStock(DEFAULT_PARAMS, wave, [], standardDeckComposition())
    expect(next.discardPile).toEqual([card(9, '♦', 1), card(2, '♥', 5), card(3, '♥', 6)])
  })

  test('パターン継続時は捨て札に何も追加されない', () => {
    const wave = makeWave({
      stock: [card(1, '♠', 9)],
      chain: [card(2, '♠', 4), card(3, '♠', 5)],
      linked: true,
      discardPile: [],
    })
    const { wave: next } = drawStock(DEFAULT_PARAMS, wave, [], standardDeckComposition())
    expect(next.discardPile).toEqual([])
  })

  test('静寂: リセット時に取れる場札が無ければ、めくった札がそのウェーブ内でワイルド化し、deckCompositionも1枚ワイルドに変換される', () => {
    const wave = makeWave({
      stock: [card(1, '♣', 9)],
      tableau: [[card(2, '♠', 2)]], // foundation想定rank9との差が大きく取れない
      chain: [card(3, '♥', 5)],
      linked: true,
    })
    const composition = standardDeckComposition()
    const { wave: next, deckComposition } = drawStock(DEFAULT_PARAMS, wave, ['silence'], composition, 'none', createRng(1))
    expect(next.foundation.wild).toBe(true)
    expect(next.chain).toEqual([{ ...card(1, '♣', 9), wild: true }])
    expect(deckComposition.filter(c => c.wild)).toHaveLength(1)
  })

  test('静寂を持っていても取れる場札があれば発動しない', () => {
    const wave = makeWave({
      stock: [card(1, '♣', 9)],
      tableau: [[card(2, '♣', 8)]], // 差1、取れる
      chain: [card(3, '♥', 5)],
      linked: true,
    })
    const composition = standardDeckComposition()
    const { wave: next, deckComposition } = drawStock(DEFAULT_PARAMS, wave, ['silence'], composition, 'none', createRng(1))
    expect(next.foundation.wild).toBe(false)
    expect(deckComposition.filter(c => c.wild)).toHaveLength(0)
  })
})
```

このファイル冒頭のimport文の`import { createRng, standardDeckComposition } from './deck'`はTask2で既に修正済みのため変更不要(そのまま利用する)。

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `npm run test -- engine.test.ts`
Expected: FAIL(`drawStock`の戻り値・シグネチャがまだ旧仕様のため)

- [ ] **Step 3: `drawStock`のシグネチャを変更し、捨て札蓄積・静寂を実装**

`src/lib/game/shidasu/engine.ts`の`drawStock`関数全体を以下に置き換える:

```ts
export function drawStock(
  params: ShidasuParams,
  wave: WaveState,
  items: ItemId[],
  deckComposition: DeckCard[],
  modifier: StageModifier = 'none',
  rand: () => number = Math.random
): { wave: WaveState; deckComposition: DeckCard[] } {
  if (wave.status !== 'playing') return { wave, deckComposition }
  if (wave.stock.length === 0) return { wave, deckComposition }

  const newStock = [...wave.stock]
  const drawnCard = newStock.pop() as Card

  const effectiveStairMinLen = items.includes('bridge') ? params.items.stairRelaxedMinLen : params.scoring.stairMinLen
  const patternContinues = wave.linked && chainContinuesPattern(params.scoring, wave.chain, drawnCard, effectiveStairMinLen)

  if (patternContinues) {
    return {
      wave: {
        ...wave,
        stock: newStock,
        foundation: drawnCard,
        chain: [...wave.chain, drawnCard],
        chainOrigin: [...wave.chainOrigin, 'draw'],
        linked: true,
        lastDrawEffect: drawnCard.wild ? 'wild' : 'pattern',
        lastGain: null,
      },
      deckComposition,
    }
  }

  const hasPlayableColumns = getPlayableColumns(modifier, { ...wave, foundation: drawnCard }).size > 0
  const silenceFires = !hasPlayableColumns && items.includes('silence')
  const card = silenceFires ? { ...drawnCard, wild: true } : drawnCard
  const newDeckComposition = silenceFires ? convertRandomCardToWild(deckComposition, rand) : deckComposition

  return {
    wave: {
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
      discardPile: [...wave.discardPile, ...wave.chain],
    },
    deckComposition: newDeckComposition,
  }
}
```

- [ ] **Step 4: `applyDrawStock`を新シグネチャに追従させる**

`src/lib/game/shidasu/engine.ts`の`applyDrawStock`関数を以下に置き換える:

```ts
export function applyDrawStock(params: ShidasuParams, run: RunState, rand: () => number = Math.random): RunState {
  if (run.phase !== 'playing' || !run.wave) return run
  const modifier = params.stages[run.stageIndex].modifier
  const { wave, deckComposition } = drawStock(params, run.wave, run.items, run.deckComposition, modifier, rand)
  return { ...run, wave, deckComposition }
}
```

- [ ] **Step 5: テストを実行して成功を確認**

Run: `npm run test -- engine.test.ts`
Expected: PASS

Run: `npm run build`
Expected: 型エラーなく成功

- [ ] **Step 6: コミット**

```bash
git add src/lib/game/shidasu/engine.ts src/lib/game/shidasu/engine.test.ts
git commit -m "$(cat <<'EOF'
feat: drawStockに捨て札蓄積と静寂の護符を実装

コンボリセット時に直前のチェーンをWaveState.discardPileへ送るようにし、
静寂の護符(取れる場札が無いリセット時にめくった札をワイルド化、
deckCompositionにも反映)を実装した。
EOF
)"
```

---

### Task 4: applyStuckCheckへの不屈の実装

**Files:**
- Modify: `src/lib/game/shidasu/engine.ts`
- Modify: `src/lib/game/shidasu/engine.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/game/shidasu/engine.test.ts`の`describe('applyPlayCard / applyDrawStock / applyStuckCheck', ...)`ブロックの直後に追加:

```ts
describe('applyStuckCheck (不屈の護符)', () => {
  test('不屈を持ち捨て札があれば、手詰まり時にスコア消費して山札へ約半数戻し手詰まりを回避する', () => {
    const wave = makeWave({
      tableau: [[card(1, '♠', 5)]],
      stock: [],
      foundation: card(0, '♣', 1), // 差が4で取れない
      score: 1000,
      discardPile: [card(10, '♦', 2), card(11, '♦', 3), card(12, '♦', 4), card(13, '♦', 5)],
    })
    const run: RunState = {
      phase: 'playing', stageIndex: 0, waveIndex: 0, items: ['resilience'], offer: [],
      wave, pendingNewItem: null, deckComposition: standardDeckComposition(),
    }
    const next = applyStuckCheck(DEFAULT_PARAMS, run, createRng(1))
    expect(next.wave!.status).toBe('playing') // 手詰まりが解消されている
    expect(next.wave!.score).toBe(700) // 1000 - 30%
    expect(next.wave!.stock).toHaveLength(2) // 4枚の半数
    expect(next.wave!.discardPile).toHaveLength(2)
  })

  test('不屈を持っていても捨て札が無ければ通常通り手詰まりになる', () => {
    const wave = makeWave({
      tableau: [[card(1, '♠', 5)]],
      stock: [],
      foundation: card(0, '♣', 1),
      score: 1000,
      discardPile: [],
    })
    const run: RunState = {
      phase: 'playing', stageIndex: 0, waveIndex: 0, items: ['resilience'], offer: [],
      wave, pendingNewItem: null, deckComposition: standardDeckComposition(),
    }
    const next = applyStuckCheck(DEFAULT_PARAMS, run)
    expect(next.wave!.status).toBe('ended')
    expect(next.wave!.endReason).toBe('stuck')
  })

  test('不屈を持っていなければ捨て札があっても通常通り手詰まりになる', () => {
    const wave = makeWave({
      tableau: [[card(1, '♠', 5)]],
      stock: [],
      foundation: card(0, '♣', 1),
      score: 1000,
      discardPile: [card(10, '♦', 2), card(11, '♦', 3)],
    })
    const run: RunState = {
      phase: 'playing', stageIndex: 0, waveIndex: 0, items: [], offer: [],
      wave, pendingNewItem: null, deckComposition: standardDeckComposition(),
    }
    const next = applyStuckCheck(DEFAULT_PARAMS, run)
    expect(next.wave!.status).toBe('ended')
    expect(next.wave!.endReason).toBe('stuck')
  })
})
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `npm run test -- engine.test.ts`
Expected: FAIL(不屈の復活処理が無いため、いずれのケースも通常通り`stuck`になる)

- [ ] **Step 3: `tryResilienceRevive`ヘルパーと`applyStuckCheck`を実装**

`src/lib/game/shidasu/engine.ts`の`applyStuckCheck`関数を以下に置き換える:

```ts
// 不屈の護符: 捨て札があれば約半数をランダムに山札へ戻しスコアを消費する(捨て札が無ければ元のwaveをそのまま返す)
function tryResilienceRevive(params: ShidasuParams, wave: WaveState, items: ItemId[], rand: () => number): WaveState {
  if (!items.includes('resilience') || wave.discardPile.length === 0) return wave
  const pool = [...wave.discardPile]
  shuffleInPlace(pool, rand)
  const reviveCount = Math.max(1, Math.ceil(pool.length / 2))
  const revived = pool.slice(0, reviveCount)
  const remaining = pool.slice(reviveCount)
  const cost = Math.floor(wave.score * params.talismans.resilience.p / 100)
  return {
    ...wave,
    score: wave.score - cost,
    stock: [...wave.stock, ...revived],
    discardPile: remaining,
  }
}

export function applyStuckCheck(params: ShidasuParams, run: RunState, rand: () => number = Math.random): RunState {
  return withActiveWave(run, wave => {
    const modifier = params.stages[run.stageIndex].modifier
    if (!isStuck(modifier, wave)) return wave
    const revived = tryResilienceRevive(params, wave, run.items, rand)
    if (revived !== wave) return revived
    return markStuck(wave)
  })
}
```

- [ ] **Step 4: テストを実行して成功を確認**

Run: `npm run test -- engine.test.ts`
Expected: PASS

Run: `npm run build`
Expected: 型エラーなく成功

- [ ] **Step 5: コミット**

```bash
git add src/lib/game/shidasu/engine.ts src/lib/game/shidasu/engine.test.ts
git commit -m "$(cat <<'EOF'
feat: applyStuckCheckに不屈の護符(捨て札からの山札復活)を実装
EOF
)"
```

---

### Task 5: ITEM_NAMES・itemDesc・ITEM_POOLへの4個登録

**Files:**
- Modify: `src/lib/game/shidasu/engine.ts`
- Modify: `src/lib/game/shidasu/engine.test.ts`

- [ ] **Step 1: 失敗するテストを更新・追加する**

`src/lib/game/shidasu/engine.test.ts`の`describe('ITEM_POOL / ITEM_NAMES / itemDesc', ...)`ブロック内、以下の箇所を書き換える:

既存:
```ts
  test('55種類のアイテムが定義されている', () => {
    expect(ITEM_POOL).toHaveLength(55)
    expect(new Set(ITEM_POOL).size).toBe(55) // 重複なし
    ITEM_POOL.forEach(id => expect(ITEM_NAMES[id]).toBeTruthy())
  })
```

置き換え後:
```ts
  test('59種類のアイテムが定義されている', () => {
    expect(ITEM_POOL).toHaveLength(59)
    expect(new Set(ITEM_POOL).size).toBe(59) // 重複なし
    ITEM_POOL.forEach(id => expect(ITEM_NAMES[id]).toBeTruthy())
  })
```

同ブロック内の末尾(最後の`test(...)`の直後)に追加:

```ts
  test('永劫・豊穣・静寂・不屈も名前と説明文を持つ', () => {
    const newIds: ItemId[] = ['eternity', 'abundance', 'silence', 'resilience']
    newIds.forEach(id => {
      expect(ITEM_NAMES[id]).toBeTruthy()
      expect(itemDesc(id, DEFAULT_PARAMS)).toBeTruthy()
    })
  })
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `npm run test -- engine.test.ts`
Expected: FAIL(`ITEM_POOL`の長さが55のまま、`ITEM_NAMES`/`itemDesc`に4個分が無い)

- [ ] **Step 3: `ITEM_NAMES`・`itemDesc`・`ITEM_POOL`に4個追加**

`src/lib/game/shidasu/engine.ts`の`ITEM_NAMES`オブジェクト内、`drizzle: '小雨の護符',`の直後に追加:

```ts
  eternity: '永劫の護符',
  abundance: '豊穣の護符',
  silence: '静寂の護符',
  resilience: '不屈の護符',
```

`itemDesc`関数内、`case 'drizzle': ...`の直後に追加:

```ts
    case 'eternity': return `ウェーブ開始時、山札にワイルドを1枚追加(以後のウェーブにも引き継がれる)`
    case 'abundance': return `ウェーブ開始時、デッキ内の1枚がランダムにワイルドへ変換される(以後のウェーブにも引き継がれる)`
    case 'silence': return `山札めくりで取れる場札が無いままコンボがリセットされた時、めくった札をワイルドに変換する(デッキにも永続的に反映)`
    case 'resilience': return `山札が無く場札も取れない手詰まり時、スコアの${params.talismans.resilience.p}%を消費して捨て札の半数を山札に戻す`
```

`ITEM_POOL`定義を以下に置き換える:

```ts
export const ITEM_POOL: ItemId[] = [
  'bridge', 'grace',
  'patience', 'purify', 'temperance',
  'springBreeze', 'summerBreeze', 'autumnBreeze', 'winterBreeze',
  'kinship', 'thaw', 'dusk', 'dawn', 'wit',
  'courage', 'daybreak', 'twilight', 'cheerful', 'conscience', 'morningMist',
  'calm', 'serenity', 'destiny', 'fate', 'relief',
  'verdantGreen', 'gem', 'resolve', 'grail', 'moonlight', 'sunlight',
  'crown', 'cloverLeaf', 'coin', 'blade', 'chalice', 'balance', 'harmony',
  'nobility', 'tenacity', 'determination', 'cycle', 'reincarnation', 'majesty',
  'omen', 'crescent',
  'blessing', 'focus', 'lapis', 'jade', 'emptyMind',
  'prologue', 'interlude', 'morningDew',
  'drizzle',
  'eternity', 'abundance', 'silence', 'resilience',
]
```

- [ ] **Step 4: テストを実行して成功を確認**

Run: `npm run test -- engine.test.ts`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add src/lib/game/shidasu/engine.ts src/lib/game/shidasu/engine.test.ts
git commit -m "$(cat <<'EOF'
feat: ITEM_POOLに永劫・豊穣・静寂・不屈を追加(全59種類に)
EOF
)"
```

---

### Task 6: 管理画面に不屈のスコア消費率パラメータ入力欄を追加

**Files:**
- Modify: `src/routes/admin/shidasu/+page.svelte`

- [ ] **Step 1: 「護符パラメータ(グループ4〜8)」セクションの直後に新セクションを追加**

`src/routes/admin/shidasu/+page.svelte`の、`護符パラメータ(グループ4〜8)`セクションの`</section>`の直後(`フロー・UI`セクションの直前)に、以下の新セクションを追加する:

```svelte
      <section class="bg-white border border-slate-200 rounded-xl p-4">
        <h2 class="font-semibold text-slate-700 text-sm mb-3">護符パラメータ(永続デッキ系)</h2>
        <div class="grid grid-cols-2 gap-3">
          <label class="text-xs text-slate-500">
            不屈: 手詰まり復活時のスコア消費率%(resilience.p)
            <input type="number" min="0" max="100" step="1" bind:value={config.talismans.resilience.p} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
        </div>
      </section>
```

永劫・豊穣・静寂は数値パラメータを持たないため、入力欄は不要。

- [ ] **Step 2: ビルドが通ることを確認**

Run: `npm run build`
Expected: 型エラーなく成功

- [ ] **Step 3: 開発サーバーで表示を確認**

Run: `npm run dev`

ブラウザで`http://localhost:5173/admin/shidasu`を開き、「護符パラメータ(永続デッキ系)」セクションが表示され、既定値(resilience.p=30)が入力欄に反映されていることを目視確認する。既存の`npm run dev`プロセスが残っていないか確認してから起動すること。

- [ ] **Step 4: コミット**

```bash
git add src/routes/admin/shidasu/+page.svelte
git commit -m "$(cat <<'EOF'
feat: 管理画面に不屈(永続デッキ系)のパラメータ入力欄を追加
EOF
)"
```

---

### Task 7: 最終検証とドキュメント更新

**Files:**
- Modify: `docs/shidasu-gofu-candidates.md`
- Test: 全体テストスイート・ビルド・ブラウザ動作確認

- [ ] **Step 1: 全体テストスイートを実行**

Run: `npm run test`
Expected: 全テストPASS

- [ ] **Step 2: ビルドと型チェックを実行**

Run: `npm run build`
Expected: 成功

Run: `npm run check`
Expected: shidasu関連の型エラーが0件であることを確認する(`grep -i shidasu`等で絞り込んで確認)

- [ ] **Step 3: `docs/shidasu-gofu-candidates.md`のグループ13該当4行に実装済みマークを追加**

`docs/shidasu-gofu-candidates.md`内、以下4箇所の「備考」列末尾にそれぞれ実装済みマークを追記する(該当行を探して書き換える):

```
| 不屈 | U | 山札無く場札が取れない時、現在スコアをp%消費して山札が半分で復活。 | 資源 | - | 手詰まり時 | 山札0&取れる札なし | スコアp%消費 | リスク付き復活 |
```
→
```
| 不屈 | U | 山札無く場札が取れない時、現在スコアをp%消費して山札が半分で復活。 | 資源 | - | 手詰まり時 | 山札0&取れる札なし | スコアp%消費 | リスク付き復活【実装済み: 2026-07-14】 |
```

```
| 静寂 | U | 山札をめくってコンボリセットされた時、取れる場札が無かったらめくった札をワイルドに変換(ウェーブ後も引き継がれる) | 資源 | - | リセット時 | 取れる場札なし | - | ワイルド生成、ウェーブ跨ぎ引継ぎ |
```
→
```
| 静寂 | U | 山札をめくってコンボリセットされた時、取れる場札が無かったらめくった札をワイルドに変換(ウェーブ後も引き継がれる) | 資源 | - | リセット時 | 取れる場札なし | - | ワイルド生成、ウェーブ跨ぎ引継ぎ【実装済み: 2026-07-14】 |
```

```
| 永劫 | U | ウェーブ開始時、山札にワイルドを1枚追加(ウェーブ後も引き継ぎ)。 | 資源 | - | ウェーブ開始時 | ワイルド+1(引継ぎ) | - | 豊穣と役割が近いが対象が異なる(山札に新規追加 vs 場札を変換)。差別化済み |
```
→
```
| 永劫 | U | ウェーブ開始時、山札にワイルドを1枚追加(ウェーブ後も引き継ぎ)。 | 資源 | - | ウェーブ開始時 | ワイルド+1(引継ぎ) | - | 豊穣と役割が近いが対象が異なる(山札に新規追加 vs 場札を変換)。差別化済み【実装済み: 2026-07-14】 |
```

```
| 豊穣 | U | ウェーブ開始時、場札のうち一枚をランダムに選びワイルドに変換(ウェーブクリア後もそのまま) | 資源 | - | ウェーブ開始時 | 場札1枚→ワイルド変換(引継ぎ) | - | 永劫(山札にワイルドを新規追加)とは対象が異なり差別化済み。場札の1枚を変換するため、山札に手を加えず盤面の構成だけ変える点が特徴 |
```
→
```
| 豊穣 | U | ウェーブ開始時、場札のうち一枚をランダムに選びワイルドに変換(ウェーブクリア後もそのまま) | 資源 | - | ウェーブ開始時 | 場札1枚→ワイルド変換(引継ぎ) | - | 永劫(山札にワイルドを新規追加)とは対象が異なり差別化済み。場札の1枚を変換するため、山札に手を加えず盤面の構成だけ変える点が特徴【実装済み: 2026-07-14】 |
```

- [ ] **Step 4: 開発サーバーでブラウザ動作確認**

Run: `npm run dev`

`http://localhost:5173/game/shidasu`を開き、通常のプレイフロー(場札プレイ・山札めくり)が壊れていないことを確認する。デバッグパネル等で永劫・豊穣・静寂・不屈を所持させられる場合は、ウェーブをまたいでプレイし、山札の総枚数が変化する(永劫)・手詰まり時にスコア消費で復活する(不屈)といった挙動を目視確認する。特別な確認手段が無い場合は、通常プレイでの回帰が無いことの確認で足りる。

- [ ] **Step 5: コミット**

```bash
git add docs/shidasu-gofu-candidates.md
git commit -m "$(cat <<'EOF'
docs: Shidasu護符候補一覧の不屈・静寂・永劫・豊穣に実装済みマークを追加
EOF
)"
```

---

## 完了条件(specの受け入れ基準との対応)

1. `beginRun`で標準52枚から開始し、ウェーブを重ねても`deckComposition`が正しく持続する → Task 2
2. 永劫でウェーブ開始のたび`deckComposition`が1枚増える → Task 2
3. 豊穣でウェーブ開始のたび非ワイルド1枚がワイルドに変換される(合計枚数不変) → Task 2
4. 静寂は取れる場札がない状態でのリセット時のみ発動し、めくった札がそのウェーブ内で即ワイルドになる → Task 3
5. `drawStock`のリセットのたびに直前のチェーンが`discardPile`に追加される → Task 3
6. 不屈は手詰まり時にスコアp%減算・捨て札の約半数を山札に戻し手詰まりを解消する → Task 4
7. 不屈を所持していても`discardPile`が空なら通常通り手詰まりになる → Task 4
8. `npm run test`・`npm run build`が成功する → Task 7
