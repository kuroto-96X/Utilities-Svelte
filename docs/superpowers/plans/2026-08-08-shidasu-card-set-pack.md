# トランプセット福袋の実装 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Shidasuのショップに新しい福袋種別「トランプセット福袋」(`packKind: 'cardSet'`)を追加し、23種類のセットジャンルからランダムに提示・選択したカード群を`RunState.deckComposition`へ恒久的に追加できるようにする。

**Architecture:** 既存の護符/秘儀/天啓/神託福袋と同じ`PACK_DEFINITIONS`/`RunPhase`/選択確定フローの枠組みを踏襲しつつ、カードセットは(1)バラ売り無し、(2)所持枠・スワップ処理無し(選択即`deckComposition`へ追加)、(3)ジャンルの出現確率が枚数に応じた重み付き抽選、という3点で他の4種と異なる。新規モジュール`cardSets.ts`に23種類のカード生成ロジックと重み付き抽選を実装する。

**Tech Stack:** TypeScript, SvelteKit, Vitest

---

## 実行順序についての注意

Task 1で型定義を追加した後、`npm run check`が通ることを確認してからTask 2以降に進むこと。Task 3〜5(カードセット生成ロジック)は同じファイル`cardSets.ts`に追記していくため、必ずTask 3→4→5の順で実行すること。

---

### Task 1: 型定義の追加

**Files:**
- Modify: `src/lib/game/shidasu/types.ts`
- Modify: `src/lib/game/shidasu/engine.ts`

- [ ] **Step 1: `types.ts`に`CardSetGenreId`・`CardSetOffer`型を追加する**

`src/lib/game/shidasu/types.ts`内、以下の既存コードを探す:

```ts
export type PackOfferCount = 3 | 5 | 7
export type PackPickCount = 1 | 2
```

直前に以下を追加する:

```ts
// トランプセット福袋のセットジャンル識別子。枚数バリエーションを持つジャンルは
// 識別子の末尾に枚数(または組数×2など)を含める(例: stair3/stair5/stair7)。
export type CardSetGenreId =
  | 'stair3' | 'stair5' | 'stair7'
  | 'sameRank2' | 'sameRank3' | 'sameRank4'
  | 'faceCards'
  | 'sameSuit3' | 'sameSuit5' | 'sameSuit7'
  | 'royal'
  | 'flush'
  | 'completeRunSameSuit' | 'completeRunRandomSuit'
  | 'pair2' | 'pair3'
  | 'redBlack4Random' | 'redBlack4Fixed' | 'redBlack6Random' | 'redBlack6Fixed' | 'redBlack8Random' | 'redBlack8Fixed'
  | 'wildCard'

// 福袋を開けた瞬間に確定する、1オファー分の中身(ジャンルIDと具体的なカード内容)。
// cardsはこの時点ではdeckIdを持たない(deckIdは実際に選択が確定しdeckCompositionへ
// 追加する瞬間に採番する。福袋を開けてから選ぶまでの間に他の処理でdeckCompositionの
// 長さが変わる可能性を考慮し、確定時点で採番することで常に一意性を保証する)。
export interface CardSetOffer {
  genreId: CardSetGenreId
  cards: { suit: Suit; rank: Rank; wild: boolean }[]
}
```

- [ ] **Step 2: `ShopSlotKind`に`'cardSet'`を追加する**

同ファイル内、以下の既存コードを探す:

```ts
export type ShopSlotKind = 'item' | 'rite' | 'revelation' | 'oracle'
```

以下に置き換える:

```ts
export type ShopSlotKind = 'item' | 'rite' | 'revelation' | 'oracle' | 'cardSet'
```

- [ ] **Step 3: `RunPhase`に`'cardSetSelect'`を追加する**

同ファイル内、以下の既存コードを探す:

```ts
export type RunPhase = 'title' | 'playing' | 'shop' | 'itemSelect' | 'riteSelect' | 'revelationSelect' | 'oracleSelect' | 'continueChoice' | 'allClear' | 'gameOver'
```

以下に置き換える:

```ts
export type RunPhase = 'title' | 'playing' | 'shop' | 'itemSelect' | 'riteSelect' | 'revelationSelect' | 'oracleSelect' | 'cardSetSelect' | 'continueChoice' | 'allClear' | 'gameOver'
```

- [ ] **Step 4: `RunState`に`cardSetOffer`フィールドを追加する**

同ファイル内、`RunState`インターフェース内の以下の既存コードを探す:

```ts
  // 神託の福袋中身選択で温存を選び上限到達時、選ばれたが未確定の神託(スワップ待ち)。待機中でなければnull
  pendingNewOracle: RoleName | null
}
```

以下に置き換える:

```ts
  // 神託の福袋中身選択で温存を選び上限到達時、選ばれたが未確定の神託(スワップ待ち)。待機中でなければnull
  pendingNewOracle: RoleName | null
  // カードセット福袋('cardSetSelect'フェーズ)で提示中のオファー。それ以外のフェーズでは空配列
  cardSetOffer: CardSetOffer[]
}
```

- [ ] **Step 5: `engine.ts`の`createInitialRun`・`beginRun`・`enterShop`・`SHOP_FLOW_PHASES`を更新する**

`src/lib/game/shidasu/engine.ts`内、以下の既存コードを探す:

```ts
export const SHOP_FLOW_PHASES: RunPhase[] = ['shop', 'itemSelect', 'riteSelect', 'revelationSelect', 'oracleSelect']
```

以下に置き換える:

```ts
export const SHOP_FLOW_PHASES: RunPhase[] = ['shop', 'itemSelect', 'riteSelect', 'revelationSelect', 'oracleSelect', 'cardSetSelect']
```

同ファイル内、以下の既存コードを探す(`createInitialRun`関数):

```ts
export function createInitialRun(): RunState {
  return {
    phase: 'title', stageIndex: 0, waveIndex: 0, items: [], offer: [], wave: null, waveGeneration: 0, pendingNewItem: null,
    deckComposition: standardDeckComposition(), rites: [], revelations: [], revelationOffer: [], extraTableauRows: 0,
    oracleLevels: defaultOracleLevels(), oracleOffer: [], spreadId: 'fool',
    stageStars: [], currency: 0,
    dedicationX: 1, diligenceX: 1, divineProtectionX: 1,
    discretionN: 10, frostX: 1,
    echoX: 1, shootingStarN: 50,
    oracles: [], shop: null, offerPickRemaining: 0, riteOffer: [],
    pendingNewRite: null, pendingNewRevelation: null, pendingNewOracle: null,
  }
}
```

以下に置き換える:

```ts
export function createInitialRun(): RunState {
  return {
    phase: 'title', stageIndex: 0, waveIndex: 0, items: [], offer: [], wave: null, waveGeneration: 0, pendingNewItem: null,
    deckComposition: standardDeckComposition(), rites: [], revelations: [], revelationOffer: [], extraTableauRows: 0,
    oracleLevels: defaultOracleLevels(), oracleOffer: [], spreadId: 'fool',
    stageStars: [], currency: 0,
    dedicationX: 1, diligenceX: 1, divineProtectionX: 1,
    discretionN: 10, frostX: 1,
    echoX: 1, shootingStarN: 50,
    oracles: [], shop: null, offerPickRemaining: 0, riteOffer: [],
    pendingNewRite: null, pendingNewRevelation: null, pendingNewOracle: null,
    cardSetOffer: [],
  }
}
```

同ファイル内、以下の既存コードを探す(`beginRun`関数の末尾部分):

```ts
    oracles: [],
    shop: null,
    offerPickRemaining: 0,
    riteOffer: [],
    pendingNewRite: null,
    pendingNewRevelation: null,
    pendingNewOracle: null,
  }
}

export function resolveWaveEnd(params: ShidasuParams, run: RunState, rand: () => number = Math.random, seed?: number): RunState {
```

以下に置き換える:

```ts
    oracles: [],
    shop: null,
    offerPickRemaining: 0,
    riteOffer: [],
    pendingNewRite: null,
    pendingNewRevelation: null,
    pendingNewOracle: null,
    cardSetOffer: [],
  }
}

export function resolveWaveEnd(params: ShidasuParams, run: RunState, rand: () => number = Math.random, seed?: number): RunState {
```

同ファイル内、以下の既存コードを探す(`enterShop`関数内、次ウェーブへの遷移時に各種オファーをリセットする箇所):

```ts
    revelationOffer: [],
    oracleOffer: [],
    riteOffer: [],
    offerPickRemaining: 0,
  }
  return { ...next, shop: rollShop(next, rand) }
}
```

以下に置き換える:

```ts
    revelationOffer: [],
    oracleOffer: [],
    riteOffer: [],
    offerPickRemaining: 0,
    cardSetOffer: [],
  }
  return { ...next, shop: rollShop(next, rand) }
}
```

- [ ] **Step 6: 型チェックを実行し、他に影響がないか確認する**

Run: `npm run check`

Expected: エラーなし。もし他の`RunState`直接構築箇所でエラーが出た場合(既存コードは`{ ...createInitialRun(), ... }`または`{ ...beginRun(...), ... }`のスプレッド形式がほとんどのため通常は発生しない見込み)、該当箇所に`cardSetOffer: []`を追加する。

- [ ] **Step 7: コミット**

```bash
git add src/lib/game/shidasu/types.ts src/lib/game/shidasu/engine.ts
git commit -m "feat: トランプセット福袋の型定義(CardSetGenreId/CardSetOffer等)を追加"
```

---

### Task 2: `deckComposition`への一括追加関数

**Files:**
- Modify: `src/lib/game/shidasu/deck.ts`
- Test: `src/lib/game/shidasu/deck.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/game/shidasu/deck.test.ts`内、以下の既存コードを探す(ファイル末尾の`describe('rollOffer'`ブロックの直後):

```ts
describe('rollOffer', () => {
  test('countで指定した件数を返す(プールがcountを超える場合)', () => {
    const result = rollOffer([1, 2, 3, 4, 5], 3, createRng(1))
    expect(result).toHaveLength(3)
  })

  test('プールがcount未満なら全件を返す', () => {
    const result = rollOffer([1, 2], 3, createRng(1))
    expect(result).toHaveLength(2)
    expect(new Set(result)).toEqual(new Set([1, 2]))
  })

  test('重複を含まない非復元抽出になる', () => {
    const result = rollOffer([1, 2, 3, 4, 5], 5, createRng(1))
    expect(new Set(result).size).toBe(5)
  })

  test('同じシードなら同じ結果になる(再現性)', () => {
    const a = rollOffer([1, 2, 3, 4, 5], 3, createRng(7))
    const b = rollOffer([1, 2, 3, 4, 5], 3, createRng(7))
    expect(a).toEqual(b)
  })

  test('元の配列を書き換えない', () => {
    const pool = [1, 2, 3, 4, 5]
    const copy = [...pool]
    rollOffer(pool, 3, createRng(1))
    expect(pool).toEqual(copy)
  })
})
```

直後に以下を追加する:

```ts

describe('addCardsToDeckComposition', () => {
  test('既存のdeckCompositionにカードを追加した長さになる', () => {
    const composition = standardDeckComposition()
    const result = addCardsToDeckComposition(composition, [
      { suit: '♠', rank: 1, wild: false },
      { suit: '♥', rank: 13, wild: false },
    ])
    expect(result).toHaveLength(54)
  })

  test('追加されたカードのdeckIdは既存の最大値の続きから連番で振られる', () => {
    const composition = standardDeckComposition()
    const result = addCardsToDeckComposition(composition, [
      { suit: '♠', rank: 1, wild: false },
      { suit: '♥', rank: 13, wild: false },
      { suit: '★', rank: 0, wild: true },
    ])
    const addedIds = result.slice(52).map(c => c.deckId)
    expect(addedIds).toEqual([52, 53, 54])
  })

  test('追加されたカードのsuit/rank/wildが入力通りに反映される', () => {
    const composition = standardDeckComposition()
    const result = addCardsToDeckComposition(composition, [{ suit: '♦', rank: 7, wild: false }])
    const added = result[result.length - 1]
    expect(added.suit).toBe('♦')
    expect(added.rank).toBe(7)
    expect(added.wild).toBe(false)
  })

  test('元のdeckCompositionを書き換えない(イミュータブル)', () => {
    const composition = standardDeckComposition()
    const copy = composition.map(c => ({ ...c }))
    addCardsToDeckComposition(composition, [{ suit: '♠', rank: 1, wild: false }])
    expect(composition).toEqual(copy)
  })

  test('deckIdが既に飛び飛びの場合でも配列長を基準に採番する(既存の永劫等と同じ方式)', () => {
    const composition = [{ deckId: 0, suit: '♠' as const, rank: 1 as const, wild: false }]
    const result = addCardsToDeckComposition(composition, [{ suit: '♥', rank: 2, wild: false }])
    expect(result[1].deckId).toBe(1)
  })
})
```

- [ ] **Step 2: テストを実行して失敗することを確認する**

Run: `npx vitest run src/lib/game/shidasu/deck.test.ts -t "addCardsToDeckComposition"`

Expected: FAIL(`addCardsToDeckComposition`が存在しない、またはimportエラー)

- [ ] **Step 3: `deck.test.ts`のimportに`addCardsToDeckComposition`を追加する**

`src/lib/game/shidasu/deck.test.ts`の先頭、以下の既存importを探す:

```ts
import { createDeck, createRng, rollOffer, shuffle, standardDeckComposition } from './deck'
```

以下に置き換える:

```ts
import { createDeck, createRng, rollOffer, shuffle, standardDeckComposition, addCardsToDeckComposition } from './deck'
```

- [ ] **Step 4: `deck.ts`に`addCardsToDeckComposition`関数を実装する**

`src/lib/game/shidasu/deck.ts`の先頭、以下の既存importを探す:

```ts
import type { Card, Suit, Rank, DeckCard } from './types'
```

以下に置き換える:

```ts
import type { Card, Suit, Rank, DeckCard } from './types'

export type NewCardSpec = { suit: Suit; rank: Rank; wild: boolean }
```

同ファイル内、以下の既存コード(`standardDeckComposition`関数の直後)を探す:

```ts
export function standardDeckComposition(): DeckCard[] {
  const composition: DeckCard[] = []
  let deckId = 0
  for (const suit of SUITS) {
    for (let rank = 1; rank <= 13; rank++) {
      composition.push({ deckId: deckId++, suit, rank: rank as Rank, wild: false })
    }
  }
  return composition
}
```

直後に以下を追加する:

```ts

// deckCompositionに複数枚のカードを一括追加する。deckIdは既存の配列長を基準に連番で振る
// (天啓のワイルド供給処理revelationEffects.tsのnewDeckIdと同じ採番方式)。
export function addCardsToDeckComposition(deckComposition: DeckCard[], cards: NewCardSpec[]): DeckCard[] {
  let nextDeckId = deckComposition.length
  const added: DeckCard[] = cards.map(c => ({ deckId: nextDeckId++, suit: c.suit, rank: c.rank, wild: c.wild }))
  return [...deckComposition, ...added]
}
```

- [ ] **Step 5: テストを実行してパスすることを確認する**

Run: `npx vitest run src/lib/game/shidasu/deck.test.ts`

Expected: PASS(全件)

- [ ] **Step 6: コミット**

```bash
git add src/lib/game/shidasu/deck.ts src/lib/game/shidasu/deck.test.ts
git commit -m "feat: deckCompositionへのカード一括追加関数addCardsToDeckCompositionを追加"
```

---

### Task 3: カードセット生成ロジック(基盤+シンプルなジャンル)

**Files:**
- Create: `src/lib/game/shidasu/cardSets.ts`
- Test: `src/lib/game/shidasu/cardSets.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/game/shidasu/cardSets.test.ts`を新規作成する:

```ts
// src/lib/game/shidasu/cardSets.test.ts
import { describe, test, expect } from 'vitest'
import { createRng } from './deck'
import { generateCardSet, CARD_SET_GENRE_NAMES } from './cardSets'
import type { CardSetGenreId } from './types'

describe('generateCardSet: faceCards(絵札セット)', () => {
  test('3枚生成され、ランクはJ・Q・K固定', () => {
    const cards = generateCardSet('faceCards', createRng(1))
    expect(cards).toHaveLength(3)
    expect(cards.map(c => c.rank).sort((a, b) => a - b)).toEqual([11, 12, 13])
  })

  test('全て非ワイルド', () => {
    const cards = generateCardSet('faceCards', createRng(1))
    expect(cards.every(c => !c.wild)).toBe(true)
  })

  test('スートは個別ランダム(複数シードで統一スートにならないケースがあることを確認)', () => {
    const suitsAcrossSeeds = new Set<string>()
    for (let seed = 1; seed <= 30; seed++) {
      const cards = generateCardSet('faceCards', createRng(seed))
      const suits = new Set(cards.map(c => c.suit))
      if (suits.size > 1) suitsAcrossSeeds.add('mixed')
    }
    expect(suitsAcrossSeeds.has('mixed')).toBe(true)
  })
})

describe('generateCardSet: royal(ロイヤルセット)', () => {
  test('3枚生成され、ランクはJ・Q・K固定・スートは全て同一', () => {
    const cards = generateCardSet('royal', createRng(1))
    expect(cards).toHaveLength(3)
    expect(cards.map(c => c.rank).sort((a, b) => a - b)).toEqual([11, 12, 13])
    expect(new Set(cards.map(c => c.suit)).size).toBe(1)
  })
})

describe('generateCardSet: flush(フラッシュセット)', () => {
  test('4枚生成され、4スートが1枚ずつ揃う', () => {
    const cards = generateCardSet('flush', createRng(1))
    expect(cards).toHaveLength(4)
    expect(new Set(cards.map(c => c.suit))).toEqual(new Set(['♠', '♥', '♦', '♣']))
  })

  test('全て非ワイルド', () => {
    const cards = generateCardSet('flush', createRng(1))
    expect(cards.every(c => !c.wild)).toBe(true)
  })
})

describe('generateCardSet: completeRunSameSuit(コンプリートランセット・同スート)', () => {
  test('13枚生成され、A〜K全ランクかつ全て同一スート', () => {
    const cards = generateCardSet('completeRunSameSuit', createRng(1))
    expect(cards).toHaveLength(13)
    expect(cards.map(c => c.rank).sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13])
    expect(new Set(cards.map(c => c.suit)).size).toBe(1)
  })
})

describe('generateCardSet: completeRunRandomSuit(コンプリートランセット・スートランダム)', () => {
  test('13枚生成され、A〜K全ランクを網羅する', () => {
    const cards = generateCardSet('completeRunRandomSuit', createRng(1))
    expect(cards).toHaveLength(13)
    expect(cards.map(c => c.rank).sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13])
  })

  test('スートは統一されない(複数シードで複数スートが混在するケースがあることを確認)', () => {
    let mixedFound = false
    for (let seed = 1; seed <= 30; seed++) {
      const cards = generateCardSet('completeRunRandomSuit', createRng(seed))
      if (new Set(cards.map(c => c.suit)).size > 1) mixedFound = true
    }
    expect(mixedFound).toBe(true)
  })
})

describe('generateCardSet: wildCard(ワイルドカード)', () => {
  test('1枚生成され、wild: trueになる', () => {
    const cards = generateCardSet('wildCard', createRng(1))
    expect(cards).toHaveLength(1)
    expect(cards[0].wild).toBe(true)
  })
})

describe('CARD_SET_GENRE_NAMES', () => {
  test('全23ジャンルの和名が定義されている', () => {
    const genreIds: CardSetGenreId[] = [
      'stair3', 'stair5', 'stair7',
      'sameRank2', 'sameRank3', 'sameRank4',
      'faceCards',
      'sameSuit3', 'sameSuit5', 'sameSuit7',
      'royal',
      'flush',
      'completeRunSameSuit', 'completeRunRandomSuit',
      'pair2', 'pair3',
      'redBlack4Random', 'redBlack4Fixed', 'redBlack6Random', 'redBlack6Fixed', 'redBlack8Random', 'redBlack8Fixed',
      'wildCard',
    ]
    genreIds.forEach(id => {
      expect(CARD_SET_GENRE_NAMES[id]).toBeTruthy()
      expect(typeof CARD_SET_GENRE_NAMES[id]).toBe('string')
    })
  })
})
```

- [ ] **Step 2: テストを実行して失敗することを確認する**

Run: `npx vitest run src/lib/game/shidasu/cardSets.test.ts`

Expected: FAIL(`./cardSets`モジュールが存在しない)

- [ ] **Step 3: `cardSets.ts`を新規作成する(基盤ヘルパー+シンプルなジャンル群)**

`src/lib/game/shidasu/cardSets.ts`を新規作成する:

```ts
// src/lib/game/shidasu/cardSets.ts
import type { Suit, Rank, CardSetGenreId } from './types'
import type { NewCardSpec } from './deck'

const SUITS: Suit[] = ['♠', '♥', '♦', '♣']
const RED_SUITS: Suit[] = ['♥', '♦']
const BLACK_SUITS: Suit[] = ['♠', '♣']
const ALL_RANKS: Rank[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]

function pickRandom<T>(arr: T[], rand: () => number): T {
  return arr[Math.floor(rand() * arr.length)]
}

// 重複無く非復元でcount個を無作為抽出する(rollOfferと同じ考え方だが、配列を破壊しないコピー操作)。
function pickRandomDistinct<T>(arr: T[], count: number, rand: () => number): T[] {
  const pool = [...arr]
  const result: T[] = []
  for (let i = 0; i < count && pool.length > 0; i++) {
    const idx = Math.floor(rand() * pool.length)
    result.push(pool[idx])
    pool.splice(idx, 1)
  }
  return result
}

function randomRank(rand: () => number): Rank {
  return ALL_RANKS[Math.floor(rand() * ALL_RANKS.length)]
}

// 絵札セット: J・Q・K固定。スートは各カード個別ランダム。
function generateFaceCardsSet(rand: () => number): NewCardSpec[] {
  return ([11, 12, 13] as Rank[]).map(rank => ({ suit: pickRandom(SUITS, rand), rank, wild: false }))
}

// ロイヤルセット: J・Q・K固定。スートを1つランダムに決定して3枚とも統一。
function generateRoyalSet(rand: () => number): NewCardSpec[] {
  const suit = pickRandom(SUITS, rand)
  return ([11, 12, 13] as Rank[]).map(rank => ({ suit, rank, wild: false }))
}

// フラッシュセット: 4スート固定(各1枚)。ランクは各カード個別ランダム。
function generateFlushSet(rand: () => number): NewCardSpec[] {
  return SUITS.map(suit => ({ suit, rank: randomRank(rand), wild: false }))
}

// コンプリートランセット(同スート): スートをランダムに1つ決定。A〜K全13ランク。
function generateCompleteRunSameSuitSet(rand: () => number): NewCardSpec[] {
  const suit = pickRandom(SUITS, rand)
  return ALL_RANKS.map(rank => ({ suit, rank, wild: false }))
}

// コンプリートランセット(スートランダム): A〜K全13ランク。スートは各カード個別ランダム。
function generateCompleteRunRandomSuitSet(rand: () => number): NewCardSpec[] {
  return ALL_RANKS.map(rank => ({ suit: pickRandom(SUITS, rand), rank, wild: false }))
}

// ワイルドカード: wild: true固定1枚(スート・ランク概念なし)。
function generateWildCardSet(): NewCardSpec[] {
  return [{ suit: '★', rank: 0, wild: true }]
}

export const CARD_SET_GENRE_NAMES: Record<CardSetGenreId, string> = {
  stair3: '階段セット(3枚)',
  stair5: '階段セット(5枚)',
  stair7: '階段セット(7枚)',
  sameRank2: '同ランクセット(2枚)',
  sameRank3: '同ランクセット(3枚)',
  sameRank4: '同ランクセット(4枚)',
  faceCards: '絵札セット',
  sameSuit3: '同スートセット(3枚)',
  sameSuit5: '同スートセット(5枚)',
  sameSuit7: '同スートセット(7枚)',
  royal: 'ロイヤルセット',
  flush: 'フラッシュセット',
  completeRunSameSuit: 'コンプリートランセット(同スート)',
  completeRunRandomSuit: 'コンプリートランセット(スートランダム)',
  pair2: 'ペアセット(2組)',
  pair3: 'ペアセット(3組)',
  redBlack4Random: '赤黒バランスセット(4枚・スートランダム)',
  redBlack4Fixed: '赤黒バランスセット(4枚・スート統一)',
  redBlack6Random: '赤黒バランスセット(6枚・スートランダム)',
  redBlack6Fixed: '赤黒バランスセット(6枚・スート統一)',
  redBlack8Random: '赤黒バランスセット(8枚・スートランダム)',
  redBlack8Fixed: '赤黒バランスセット(8枚・スート統一)',
  wildCard: 'ワイルドカード',
}

export function generateCardSet(genreId: CardSetGenreId, rand: () => number = Math.random): NewCardSpec[] {
  switch (genreId) {
    case 'faceCards': return generateFaceCardsSet(rand)
    case 'royal': return generateRoyalSet(rand)
    case 'flush': return generateFlushSet(rand)
    case 'completeRunSameSuit': return generateCompleteRunSameSuitSet(rand)
    case 'completeRunRandomSuit': return generateCompleteRunRandomSuitSet(rand)
    case 'wildCard': return generateWildCardSet()
    default:
      throw new Error(`generateCardSet: 未対応のジャンルID: ${genreId}`)
  }
}
```

(`pickRandomDistinct`・`RED_SUITS`・`BLACK_SUITS`はTask 4・5で使うため、この時点では未使用でも定義しておく。`default`分岐はTask 4・5で他のジャンルの実装を追加するまでの暫定的なエラーで、Task 5完了時点で全ジャンルが分岐に揃うため削除する。)

- [ ] **Step 4: テストを実行してパスすることを確認する**

Run: `npx vitest run src/lib/game/shidasu/cardSets.test.ts`

Expected: PASS(全件)

- [ ] **Step 5: 型チェックを実行する**

Run: `npm run check`

Expected: エラーなし(`pickRandomDistinct`・`RED_SUITS`・`BLACK_SUITS`が未使用でも、モジュールレベルの`export`ではない`function`/`const`の未使用はTypeScriptの型チェックではエラーにならない想定。もしエラーが出た場合は、これらの宣言をコメントアウトせずそのまま残し、Task 4で使用を追加することを確認する)

- [ ] **Step 6: コミット**

```bash
git add src/lib/game/shidasu/cardSets.ts src/lib/game/shidasu/cardSets.test.ts
git commit -m "feat: トランプセット福袋のカード生成ロジック(絵札・ロイヤル・フラッシュ・コンプリートラン・ワイルド)を追加"
```

---

### Task 4: カードセット生成ロジック(バリエーション系: 階段・同ランク・同スート)

**Files:**
- Modify: `src/lib/game/shidasu/cardSets.ts`
- Modify: `src/lib/game/shidasu/cardSets.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/game/shidasu/cardSets.test.ts`内、以下の既存コードを探す(`describe('generateCardSet: faceCards...`ブロックの直前):

```ts
describe('generateCardSet: faceCards(絵札セット)', () => {
```

直前に以下を追加する:

```ts
describe('generateCardSet: stair3/stair5/stair7(階段セット)', () => {
  test('stair3は3枚、連続ランクになる', () => {
    const cards = generateCardSet('stair3', createRng(1))
    expect(cards).toHaveLength(3)
  })

  test('stair5は5枚、stair7は7枚になる', () => {
    expect(generateCardSet('stair5', createRng(1))).toHaveLength(5)
    expect(generateCardSet('stair7', createRng(1))).toHaveLength(7)
  })

  test('ランクが1ずつ連続する(A⇔Kループを跨いでもよい)', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const cards = generateCardSet('stair5', createRng(seed))
      const ranks = cards.map(c => c.rank)
      for (let i = 1; i < ranks.length; i++) {
        const expected = ranks[i - 1] === 13 ? 1 : ranks[i - 1] + 1
        expect(ranks[i]).toBe(expected)
      }
    }
  })

  test('スートは個別ランダム(複数シードで統一スートにならないケースがあることを確認)', () => {
    let mixedFound = false
    for (let seed = 1; seed <= 30; seed++) {
      const cards = generateCardSet('stair5', createRng(seed))
      if (new Set(cards.map(c => c.suit)).size > 1) mixedFound = true
    }
    expect(mixedFound).toBe(true)
  })
})

describe('generateCardSet: sameRank2/sameRank3/sameRank4(同ランクセット)', () => {
  test('sameRank2は2枚、sameRank3は3枚、sameRank4は4枚になる', () => {
    expect(generateCardSet('sameRank2', createRng(1))).toHaveLength(2)
    expect(generateCardSet('sameRank3', createRng(1))).toHaveLength(3)
    expect(generateCardSet('sameRank4', createRng(1))).toHaveLength(4)
  })

  test('全て同一ランクになる', () => {
    const cards = generateCardSet('sameRank4', createRng(1))
    expect(new Set(cards.map(c => c.rank)).size).toBe(1)
  })

  test('スートは重複しない', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const cards = generateCardSet('sameRank4', createRng(seed))
      expect(new Set(cards.map(c => c.suit)).size).toBe(4)
    }
  })

  test('sameRank4は4スート全てを含む', () => {
    const cards = generateCardSet('sameRank4', createRng(1))
    expect(new Set(cards.map(c => c.suit))).toEqual(new Set(['♠', '♥', '♦', '♣']))
  })
})

describe('generateCardSet: sameSuit3/sameSuit5/sameSuit7(同スートセット)', () => {
  test('sameSuit3は3枚、sameSuit5は5枚、sameSuit7は7枚になる', () => {
    expect(generateCardSet('sameSuit3', createRng(1))).toHaveLength(3)
    expect(generateCardSet('sameSuit5', createRng(1))).toHaveLength(5)
    expect(generateCardSet('sameSuit7', createRng(1))).toHaveLength(7)
  })

  test('全て同一スートになる', () => {
    const cards = generateCardSet('sameSuit5', createRng(1))
    expect(new Set(cards.map(c => c.suit)).size).toBe(1)
  })

  test('ランクは重複しない', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const cards = generateCardSet('sameSuit7', createRng(seed))
      expect(new Set(cards.map(c => c.rank)).size).toBe(7)
    }
  })
})

```

- [ ] **Step 2: テストを実行して失敗することを確認する**

Run: `npx vitest run src/lib/game/shidasu/cardSets.test.ts -t "階段セット|同ランクセット|同スートセット"`

Expected: FAIL(`generateCardSet`が`stair3`等のジャンルIDで例外を投げる)

- [ ] **Step 3: `cardSets.ts`に階段・同ランク・同スートセットの生成関数を追加する**

`src/lib/game/shidasu/cardSets.ts`内、以下の既存コードを探す:

```ts
// 絵札セット: J・Q・K固定。スートは各カード個別ランダム。
function generateFaceCardsSet(rand: () => number): NewCardSpec[] {
```

直前に以下を追加する:

```ts
// 階段セット(length枚): 開始ランクをランダムに1つ決定(A⇔Kループを跨いでよい)、
// そこからlength枚連続するランクを生成。各カードのスートは個別にランダム。
function generateStairSet(length: number, rand: () => number): NewCardSpec[] {
  const startRank = Math.floor(rand() * 13) + 1
  const cards: NewCardSpec[] = []
  for (let i = 0; i < length; i++) {
    const rank = (((startRank - 1 + i) % 13) + 1) as Rank
    cards.push({ suit: pickRandom(SUITS, rand), rank, wild: false })
  }
  return cards
}

// 同ランクセット(count枚): ランクをランダムに1つ決定。4スートから重複無くcount個を選択。
function generateSameRankSet(count: number, rand: () => number): NewCardSpec[] {
  const rank = randomRank(rand)
  const suits = pickRandomDistinct(SUITS, count, rand)
  return suits.map(suit => ({ suit, rank, wild: false }))
}

// 同スートセット(count枚): スートをランダムに1つ決定。13ランクから重複無くcount個を選択。
function generateSameSuitSet(count: number, rand: () => number): NewCardSpec[] {
  const suit = pickRandom(SUITS, rand)
  const ranks = pickRandomDistinct(ALL_RANKS, count, rand)
  return ranks.map(rank => ({ suit, rank, wild: false }))
}

```

同ファイル内、以下の既存コード(`generateCardSet`関数の`switch`文)を探す:

```ts
export function generateCardSet(genreId: CardSetGenreId, rand: () => number = Math.random): NewCardSpec[] {
  switch (genreId) {
    case 'faceCards': return generateFaceCardsSet(rand)
    case 'royal': return generateRoyalSet(rand)
    case 'flush': return generateFlushSet(rand)
    case 'completeRunSameSuit': return generateCompleteRunSameSuitSet(rand)
    case 'completeRunRandomSuit': return generateCompleteRunRandomSuitSet(rand)
    case 'wildCard': return generateWildCardSet()
    default:
      throw new Error(`generateCardSet: 未対応のジャンルID: ${genreId}`)
  }
}
```

以下に置き換える:

```ts
export function generateCardSet(genreId: CardSetGenreId, rand: () => number = Math.random): NewCardSpec[] {
  switch (genreId) {
    case 'stair3': return generateStairSet(3, rand)
    case 'stair5': return generateStairSet(5, rand)
    case 'stair7': return generateStairSet(7, rand)
    case 'sameRank2': return generateSameRankSet(2, rand)
    case 'sameRank3': return generateSameRankSet(3, rand)
    case 'sameRank4': return generateSameRankSet(4, rand)
    case 'faceCards': return generateFaceCardsSet(rand)
    case 'sameSuit3': return generateSameSuitSet(3, rand)
    case 'sameSuit5': return generateSameSuitSet(5, rand)
    case 'sameSuit7': return generateSameSuitSet(7, rand)
    case 'royal': return generateRoyalSet(rand)
    case 'flush': return generateFlushSet(rand)
    case 'completeRunSameSuit': return generateCompleteRunSameSuitSet(rand)
    case 'completeRunRandomSuit': return generateCompleteRunRandomSuitSet(rand)
    case 'wildCard': return generateWildCardSet()
    default:
      throw new Error(`generateCardSet: 未対応のジャンルID: ${genreId}`)
  }
}
```

- [ ] **Step 4: テストを実行してパスすることを確認する**

Run: `npx vitest run src/lib/game/shidasu/cardSets.test.ts`

Expected: PASS(全件)

- [ ] **Step 5: コミット**

```bash
git add src/lib/game/shidasu/cardSets.ts src/lib/game/shidasu/cardSets.test.ts
git commit -m "feat: トランプセット福袋のカード生成ロジック(階段・同ランク・同スート)を追加"
```

---

### Task 5: カードセット生成ロジック(複合ジャンル: ペア・赤黒バランス)

**Files:**
- Modify: `src/lib/game/shidasu/cardSets.ts`
- Modify: `src/lib/game/shidasu/cardSets.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/game/shidasu/cardSets.test.ts`内、以下の既存コードを探す(`describe('generateCardSet: wildCard...`ブロックの直前):

```ts
describe('generateCardSet: wildCard(ワイルドカード)', () => {
```

直前に以下を追加する:

```ts
describe('generateCardSet: pair2/pair3(ペアセット)', () => {
  test('pair2は4枚(2組)、pair3は6枚(3組)になる', () => {
    expect(generateCardSet('pair2', createRng(1))).toHaveLength(4)
    expect(generateCardSet('pair3', createRng(1))).toHaveLength(6)
  })

  test('pair3は3種類の異なるランクが各2枚ずつになる', () => {
    const cards = generateCardSet('pair3', createRng(1))
    const rankCounts = new Map<number, number>()
    cards.forEach(c => rankCounts.set(c.rank, (rankCounts.get(c.rank) ?? 0) + 1))
    expect(rankCounts.size).toBe(3)
    expect([...rankCounts.values()]).toEqual([2, 2, 2])
  })

  test('各組の2枚は異なるスートになる', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const cards = generateCardSet('pair3', createRng(seed))
      const rankGroups = new Map<number, string[]>()
      cards.forEach(c => {
        const list = rankGroups.get(c.rank) ?? []
        list.push(c.suit)
        rankGroups.set(c.rank, list)
      })
      rankGroups.forEach(suits => expect(new Set(suits).size).toBe(2))
    }
  })
})

describe('generateCardSet: redBlack4Random/redBlack4Fixed/redBlack6Random/redBlack6Fixed/redBlack8Random/redBlack8Fixed(赤黒バランスセット)', () => {
  test('4枚/6枚/8枚それぞれ正しい枚数になる', () => {
    expect(generateCardSet('redBlack4Random', createRng(1))).toHaveLength(4)
    expect(generateCardSet('redBlack6Random', createRng(1))).toHaveLength(6)
    expect(generateCardSet('redBlack8Random', createRng(1))).toHaveLength(8)
    expect(generateCardSet('redBlack4Fixed', createRng(1))).toHaveLength(4)
    expect(generateCardSet('redBlack6Fixed', createRng(1))).toHaveLength(6)
    expect(generateCardSet('redBlack8Fixed', createRng(1))).toHaveLength(8)
  })

  function isRed(suit: string): boolean {
    return suit === '♥' || suit === '♦'
  }

  test('赤黒が同数になる(6枚なら赤3・黒3)', () => {
    const cards = generateCardSet('redBlack6Random', createRng(1))
    const redCount = cards.filter(c => isRed(c.suit)).length
    expect(redCount).toBe(3)
    expect(cards.length - redCount).toBe(3)
  })

  test('スートランダム版は赤2種・黒2種のスートが個別に決まりうる(複数シードで両方のスートが出るケースを確認)', () => {
    const redSuitsSeen = new Set<string>()
    const blackSuitsSeen = new Set<string>()
    for (let seed = 1; seed <= 30; seed++) {
      const cards = generateCardSet('redBlack6Random', createRng(seed))
      cards.forEach(c => {
        if (isRed(c.suit)) redSuitsSeen.add(c.suit)
        else blackSuitsSeen.add(c.suit)
      })
    }
    expect(redSuitsSeen.size).toBe(2)
    expect(blackSuitsSeen.size).toBe(2)
  })

  test('スート統一版は赤3枚が同一スート、黒3枚が同一スートになる', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const cards = generateCardSet('redBlack6Fixed', createRng(seed))
      const redSuits = new Set(cards.filter(c => isRed(c.suit)).map(c => c.suit))
      const blackSuits = new Set(cards.filter(c => !isRed(c.suit)).map(c => c.suit))
      expect(redSuits.size).toBe(1)
      expect(blackSuits.size).toBe(1)
    }
  })
})

```

- [ ] **Step 2: テストを実行して失敗することを確認する**

Run: `npx vitest run src/lib/game/shidasu/cardSets.test.ts -t "ペアセット|赤黒バランスセット"`

Expected: FAIL(`generateCardSet`が`pair2`等のジャンルIDで例外を投げる)

- [ ] **Step 3: `cardSets.ts`にペア・赤黒バランスセットの生成関数を追加する**

`src/lib/game/shidasu/cardSets.ts`内、以下の既存コードを探す:

```ts
// ワイルドカード: wild: true固定1枚(スート・ランク概念なし)。
function generateWildCardSet(): NewCardSpec[] {
```

直前に以下を追加する:

```ts
// ペアセット(groups組): 13ランクから重複無くgroups個を選択、各ランクにつき2枚(計2*groups枚)。
// 各組の2枚は異なるスートになるよう個別にランダム。
function generatePairSet(groups: number, rand: () => number): NewCardSpec[] {
  const ranks = pickRandomDistinct(ALL_RANKS, groups, rand)
  const cards: NewCardSpec[] = []
  for (const rank of ranks) {
    const suits = pickRandomDistinct(SUITS, 2, rand)
    cards.push({ suit: suits[0], rank, wild: false })
    cards.push({ suit: suits[1], rank, wild: false })
  }
  return cards
}

// 赤黒バランスセット(totalCount枚・スート個別ランダム): 赤totalCount/2枚(♥♦から個別ランダム)・
// 黒totalCount/2枚(♠♣から個別ランダム)。ランクは各カード個別にランダム。
function generateRedBlackRandomSet(totalCount: number, rand: () => number): NewCardSpec[] {
  const half = totalCount / 2
  const cards: NewCardSpec[] = []
  for (let i = 0; i < half; i++) cards.push({ suit: pickRandom(RED_SUITS, rand), rank: randomRank(rand), wild: false })
  for (let i = 0; i < half; i++) cards.push({ suit: pickRandom(BLACK_SUITS, rand), rank: randomRank(rand), wild: false })
  return cards
}

// 赤黒バランスセット(totalCount枚・スート統一): 赤totalCount/2枚は♥/♦のどちらか1つにランダムに
// 統一、黒totalCount/2枚は♠/♣のどちらか1つにランダムに統一。ランクは各カード個別にランダム。
function generateRedBlackFixedSet(totalCount: number, rand: () => number): NewCardSpec[] {
  const half = totalCount / 2
  const redSuit = pickRandom(RED_SUITS, rand)
  const blackSuit = pickRandom(BLACK_SUITS, rand)
  const cards: NewCardSpec[] = []
  for (let i = 0; i < half; i++) cards.push({ suit: redSuit, rank: randomRank(rand), wild: false })
  for (let i = 0; i < half; i++) cards.push({ suit: blackSuit, rank: randomRank(rand), wild: false })
  return cards
}

```

同ファイル内、以下の既存コード(`generateCardSet`関数の`switch`文)を探す:

```ts
    case 'completeRunSameSuit': return generateCompleteRunSameSuitSet(rand)
    case 'completeRunRandomSuit': return generateCompleteRunRandomSuitSet(rand)
    case 'wildCard': return generateWildCardSet()
    default:
      throw new Error(`generateCardSet: 未対応のジャンルID: ${genreId}`)
  }
}
```

以下に置き換える:

```ts
    case 'completeRunSameSuit': return generateCompleteRunSameSuitSet(rand)
    case 'completeRunRandomSuit': return generateCompleteRunRandomSuitSet(rand)
    case 'pair2': return generatePairSet(2, rand)
    case 'pair3': return generatePairSet(3, rand)
    case 'redBlack4Random': return generateRedBlackRandomSet(4, rand)
    case 'redBlack4Fixed': return generateRedBlackFixedSet(4, rand)
    case 'redBlack6Random': return generateRedBlackRandomSet(6, rand)
    case 'redBlack6Fixed': return generateRedBlackFixedSet(6, rand)
    case 'redBlack8Random': return generateRedBlackRandomSet(8, rand)
    case 'redBlack8Fixed': return generateRedBlackFixedSet(8, rand)
    case 'wildCard': return generateWildCardSet()
  }
}
```

(`default`分岐を削除した。`CardSetGenreId`の全23メンバーが`switch`文で網羅されるため、TypeScriptが網羅性を保証しdefault不要になる。)

- [ ] **Step 4: テストを実行してパスすることを確認する**

Run: `npx vitest run src/lib/game/shidasu/cardSets.test.ts`

Expected: PASS(全件、これで23ジャンル全てのテストが揃う)

- [ ] **Step 5: 型チェックを実行する**

Run: `npm run check`

Expected: エラーなし(`switch`文が`CardSetGenreId`の全メンバーを網羅していることを確認。網羅漏れがあれば`Function lacks ending return statement`等のエラーが出るため、その場合はcase漏れを確認する)

- [ ] **Step 6: コミット**

```bash
git add src/lib/game/shidasu/cardSets.ts src/lib/game/shidasu/cardSets.test.ts
git commit -m "feat: トランプセット福袋のカード生成ロジック(ペア・赤黒バランス)を追加し23ジャンル完備"
```

---

### Task 6: 重み付き抽選ロジック

**Files:**
- Modify: `src/lib/game/shidasu/cardSets.ts`
- Modify: `src/lib/game/shidasu/cardSets.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/game/shidasu/cardSets.test.ts`の先頭、以下の既存importを探す:

```ts
import { generateCardSet, CARD_SET_GENRE_NAMES } from './cardSets'
```

以下に置き換える:

```ts
import { generateCardSet, CARD_SET_GENRE_NAMES, rollCardSetOffer } from './cardSets'
```

同ファイル内、以下の既存コード(`describe('CARD_SET_GENRE_NAMES'...`ブロックの直後、ファイル末尾)を探す:

```ts
describe('CARD_SET_GENRE_NAMES', () => {
  test('全23ジャンルの和名が定義されている', () => {
    const genreIds: CardSetGenreId[] = [
      'stair3', 'stair5', 'stair7',
      'sameRank2', 'sameRank3', 'sameRank4',
      'faceCards',
      'sameSuit3', 'sameSuit5', 'sameSuit7',
      'royal',
      'flush',
      'completeRunSameSuit', 'completeRunRandomSuit',
      'pair2', 'pair3',
      'redBlack4Random', 'redBlack4Fixed', 'redBlack6Random', 'redBlack6Fixed', 'redBlack8Random', 'redBlack8Fixed',
      'wildCard',
    ]
    genreIds.forEach(id => {
      expect(CARD_SET_GENRE_NAMES[id]).toBeTruthy()
      expect(typeof CARD_SET_GENRE_NAMES[id]).toBe('string')
    })
  })
})
```

直後に以下を追加する:

```ts

describe('rollCardSetOffer', () => {
  test('countで指定した件数のオファーを返す', () => {
    const offers = rollCardSetOffer(createRng(1), 3)
    expect(offers).toHaveLength(3)
  })

  test('各オファーはgenreIdとcards(生成済みカード内容)を持つ', () => {
    const offers = rollCardSetOffer(createRng(1), 3)
    offers.forEach(o => {
      expect(typeof o.genreId).toBe('string')
      expect(Array.isArray(o.cards)).toBe(true)
      expect(o.cards.length).toBeGreaterThan(0)
    })
  })

  test('同じ福袋内でジャンルが重複しない', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const offers = rollCardSetOffer(createRng(seed), 7)
      const genreIds = offers.map(o => o.genreId)
      expect(new Set(genreIds).size).toBe(genreIds.length)
    }
  })

  test('同じシードなら同じ結果になる(再現性)', () => {
    const a = rollCardSetOffer(createRng(7), 5)
    const b = rollCardSetOffer(createRng(7), 5)
    expect(a).toEqual(b)
  })

  test('枚数が少ないジャンルほど出現しやすい(統計的検証: 1000回中、階段セット3枚の出現数が階段セット7枚の出現数を上回る)', () => {
    let stair3Count = 0
    let stair7Count = 0
    for (let seed = 1; seed <= 1000; seed++) {
      const offers = rollCardSetOffer(createRng(seed), 1)
      if (offers[0].genreId === 'stair3') stair3Count++
      if (offers[0].genreId === 'stair7') stair7Count++
    }
    expect(stair3Count).toBeGreaterThan(stair7Count)
  })
})
```

- [ ] **Step 2: テストを実行して失敗することを確認する**

Run: `npx vitest run src/lib/game/shidasu/cardSets.test.ts -t "rollCardSetOffer"`

Expected: FAIL(`rollCardSetOffer`が存在しない)

- [ ] **Step 3: `cardSets.ts`に重み付き抽選ロジックを追加する**

`src/lib/game/shidasu/cardSets.ts`内、以下の既存コード(ファイル末尾、`generateCardSet`関数の直後)を探す:

```ts
    case 'wildCard': return generateWildCardSet()
  }
}
```

直後に以下を追加する:

```ts

// 各ジャンルの抽選重み(1/枚数)。ワイルドカードは1枚だが例外的に6枚相当(1/6)とする。
const CARD_SET_GENRE_WEIGHTS: Record<CardSetGenreId, number> = {
  stair3: 1 / 3, stair5: 1 / 5, stair7: 1 / 7,
  sameRank2: 1 / 2, sameRank3: 1 / 3, sameRank4: 1 / 4,
  faceCards: 1 / 3,
  sameSuit3: 1 / 3, sameSuit5: 1 / 5, sameSuit7: 1 / 7,
  royal: 1 / 3,
  flush: 1 / 4,
  completeRunSameSuit: 1 / 13, completeRunRandomSuit: 1 / 13,
  pair2: 1 / 4, pair3: 1 / 6,
  redBlack4Random: 1 / 4, redBlack4Fixed: 1 / 4,
  redBlack6Random: 1 / 6, redBlack6Fixed: 1 / 6,
  redBlack8Random: 1 / 8, redBlack8Fixed: 1 / 8,
  wildCard: 1 / 6,
}

// 重み付き非復元抽選でcount個のジャンルIDを選ぶ。選ばれた候補は次の抽選対象から除外し、
// 残りの重みで再正規化して繰り返す(ルーレット選択の逐次適用)。
function weightedSampleGenres(count: number, rand: () => number): CardSetGenreId[] {
  const remaining = (Object.keys(CARD_SET_GENRE_WEIGHTS) as CardSetGenreId[]).map(id => ({ id, weight: CARD_SET_GENRE_WEIGHTS[id] }))
  const result: CardSetGenreId[] = []
  for (let i = 0; i < count && remaining.length > 0; i++) {
    const totalWeight = remaining.reduce((sum, r) => sum + r.weight, 0)
    let roll = rand() * totalWeight
    let idx = remaining.length - 1
    for (let j = 0; j < remaining.length; j++) {
      roll -= remaining[j].weight
      if (roll <= 0) { idx = j; break }
    }
    result.push(remaining[idx].id)
    remaining.splice(idx, 1)
  }
  return result
}

// トランプセット福袋を開けた瞬間に呼ぶ。count個のジャンルを重み付き抽選し、
// 各ジャンルの具体的なカード内容もその場で確定する。
export function rollCardSetOffer(rand: () => number = Math.random, count: number): CardSetOffer[] {
  return weightedSampleGenres(count, rand).map(genreId => ({ genreId, cards: generateCardSet(genreId, rand) }))
}
```

同ファイル先頭、以下の既存importを探す:

```ts
import type { Suit, Rank, CardSetGenreId } from './types'
```

以下に置き換える:

```ts
import type { Suit, Rank, CardSetGenreId, CardSetOffer } from './types'
```

- [ ] **Step 4: テストを実行してパスすることを確認する**

Run: `npx vitest run src/lib/game/shidasu/cardSets.test.ts`

Expected: PASS(全件)

- [ ] **Step 5: コミット**

```bash
git add src/lib/game/shidasu/cardSets.ts src/lib/game/shidasu/cardSets.test.ts
git commit -m "feat: トランプセット福袋の重み付きジャンル抽選ロジックrollCardSetOfferを追加"
```

---

### Task 7: 福袋価格・`PACK_DEFINITIONS`設定

**Files:**
- Modify: `src/lib/game/shidasu/params.ts`
- Modify: `src/lib/game/shidasu/shidasu.config.json`
- Modify: `src/lib/game/shidasu/shop.ts`
- Modify: `src/lib/game/shidasu/shop.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/game/shidasu/shop.test.ts`内、以下の既存コードを探す:

```ts
  test('福袋2枠はPACK_DEFINITIONSのパターンから重複なく選ばれる', () => {
    const shop = rollShop(createInitialRun(), createRng(1))
    const keys = shop.packs.map(p => `${p.packKind}-${p.offerCount}-${p.pickCount}`)
    expect(new Set(keys).size).toBe(2)
    shop.packs.forEach(p => {
      expect(PACK_DEFINITIONS.some(d => d.packKind === p.packKind && d.offerCount === p.offerCount && d.pickCount === p.pickCount)).toBe(true)
    })
  })
})
```

以下に置き換える:

```ts
  test('福袋2枠はPACK_DEFINITIONSのパターンから重複なく選ばれる', () => {
    const shop = rollShop(createInitialRun(), createRng(1))
    const keys = shop.packs.map(p => `${p.packKind}-${p.offerCount}-${p.pickCount}`)
    expect(new Set(keys).size).toBe(2)
    shop.packs.forEach(p => {
      expect(PACK_DEFINITIONS.some(d => d.packKind === p.packKind && d.offerCount === p.offerCount && d.pickCount === p.pickCount)).toBe(true)
    })
  })

  test('PACK_DEFINITIONSにcardSetの3-1・5-1・7-2パターンが含まれる', () => {
    const cardSetDefs = PACK_DEFINITIONS.filter(d => d.packKind === 'cardSet')
    expect(cardSetDefs).toHaveLength(3)
    expect(cardSetDefs.some(d => d.offerCount === 3 && d.pickCount === 1)).toBe(true)
    expect(cardSetDefs.some(d => d.offerCount === 5 && d.pickCount === 1)).toBe(true)
    expect(cardSetDefs.some(d => d.offerCount === 7 && d.pickCount === 2)).toBe(true)
  })
})
```

同ファイル内、以下の既存コードを探す(`describe('価格関数'...`ブロックの末尾):

```ts
  test('packPriceはkind×offerCountの組み合わせで価格表を参照する', () => {
    expect(packPrice(DEFAULT_PARAMS, 'item', 3)).toBe(20)
    expect(packPrice(DEFAULT_PARAMS, 'item', 5)).toBe(30)
    expect(packPrice(DEFAULT_PARAMS, 'item', 7)).toBe(50)
    expect(packPrice(DEFAULT_PARAMS, 'revelation', 3)).toBe(25)
    expect(packPrice(DEFAULT_PARAMS, 'revelation', 5)).toBe(38)
    expect(packPrice(DEFAULT_PARAMS, 'revelation', 7)).toBe(63)
    expect(packPrice(DEFAULT_PARAMS, 'oracle', 3)).toBe(22)
    expect(packPrice(DEFAULT_PARAMS, 'oracle', 5)).toBe(33)
  })
})
```

以下に置き換える:

```ts
  test('packPriceはkind×offerCountの組み合わせで価格表を参照する', () => {
    expect(packPrice(DEFAULT_PARAMS, 'item', 3)).toBe(20)
    expect(packPrice(DEFAULT_PARAMS, 'item', 5)).toBe(30)
    expect(packPrice(DEFAULT_PARAMS, 'item', 7)).toBe(50)
    expect(packPrice(DEFAULT_PARAMS, 'revelation', 3)).toBe(25)
    expect(packPrice(DEFAULT_PARAMS, 'revelation', 5)).toBe(38)
    expect(packPrice(DEFAULT_PARAMS, 'revelation', 7)).toBe(63)
    expect(packPrice(DEFAULT_PARAMS, 'oracle', 3)).toBe(22)
    expect(packPrice(DEFAULT_PARAMS, 'oracle', 5)).toBe(33)
  })

  test('cardSetの福袋価格', () => {
    expect(packPrice(DEFAULT_PARAMS, 'cardSet', 3)).toBe(20)
    expect(packPrice(DEFAULT_PARAMS, 'cardSet', 5)).toBe(30)
    expect(packPrice(DEFAULT_PARAMS, 'cardSet', 7)).toBe(50)
  })
})
```

- [ ] **Step 2: テストを実行して失敗することを確認する**

Run: `npx vitest run src/lib/game/shidasu/shop.test.ts`

Expected: FAIL(`cardSet`のPACK_DEFINITIONSが存在しない、`packPrice`が`undefined`を返す)

- [ ] **Step 3: `params.ts`の型定義と`DEFAULT_PARAMS`を更新する**

`src/lib/game/shidasu/params.ts`内、以下の既存コードを探す:

```ts
    // 護符/秘儀/天啓は3-1・5-1・7-2の3パターン、神託は3-1・5-1のみ(7-2は無し)
    packPrice: {
      item: { threeOne: number; fiveOne: number; sevenTwo: number }
      rite: { threeOne: number; fiveOne: number; sevenTwo: number }
      revelation: { threeOne: number; fiveOne: number; sevenTwo: number }
      oracle: { threeOne: number; fiveOne: number }
    }
```

以下に置き換える:

```ts
    // 護符/秘儀/天啓/カードセットは3-1・5-1・7-2の3パターン、神託は3-1・5-1のみ(7-2は無し)
    packPrice: {
      item: { threeOne: number; fiveOne: number; sevenTwo: number }
      rite: { threeOne: number; fiveOne: number; sevenTwo: number }
      revelation: { threeOne: number; fiveOne: number; sevenTwo: number }
      oracle: { threeOne: number; fiveOne: number }
      cardSet: { threeOne: number; fiveOne: number; sevenTwo: number }
    }
```

同ファイル内、以下の既存コードを探す(`DEFAULT_PARAMS`内の`packPrice`):

```ts
    packPrice: {
      item: { threeOne: 20, fiveOne: 30, sevenTwo: 50 },
      rite: { threeOne: 20, fiveOne: 30, sevenTwo: 50 },
      revelation: { threeOne: 25, fiveOne: 38, sevenTwo: 63 },
      oracle: { threeOne: 22, fiveOne: 33 },
    },
```

以下に置き換える:

```ts
    packPrice: {
      item: { threeOne: 20, fiveOne: 30, sevenTwo: 50 },
      rite: { threeOne: 20, fiveOne: 30, sevenTwo: 50 },
      revelation: { threeOne: 25, fiveOne: 38, sevenTwo: 63 },
      oracle: { threeOne: 22, fiveOne: 33 },
      cardSet: { threeOne: 20, fiveOne: 30, sevenTwo: 50 },
    },
```

- [ ] **Step 4: `shidasu.config.json`の`shop.packPrice`に`cardSet`を追加する**

`src/lib/game/shidasu/shidasu.config.json`内、以下の既存コードを探す:

```json
    "packPrice": {
      "item": {
        "threeOne": 4,
        "fiveOne": 7,
        "sevenTwo": 10
      },
      "rite": {
        "threeOne": 4,
        "fiveOne": 6,
        "sevenTwo": 8
      },
      "revelation": {
        "threeOne": 4,
        "fiveOne": 6,
        "sevenTwo": 8
      },
      "oracle": {
        "threeOne": 2,
        "fiveOne": 4
      }
    }
```

以下に置き換える:

```json
    "packPrice": {
      "item": {
        "threeOne": 4,
        "fiveOne": 7,
        "sevenTwo": 10
      },
      "rite": {
        "threeOne": 4,
        "fiveOne": 6,
        "sevenTwo": 8
      },
      "revelation": {
        "threeOne": 4,
        "fiveOne": 6,
        "sevenTwo": 8
      },
      "oracle": {
        "threeOne": 2,
        "fiveOne": 4
      },
      "cardSet": {
        "threeOne": 4,
        "fiveOne": 6,
        "sevenTwo": 8
      }
    }
```

- [ ] **Step 5: `shop.ts`の`PACK_DEFINITIONS`に`cardSet`の3パターンを追加する**

`src/lib/game/shidasu/shop.ts`内、以下の既存コードを探す:

```ts
// 護符/秘儀/天啓は3-1・5-1・7-2の3パターン、神託は3-1・5-1の2パターン(7-2は無し)。計11パターン。
export const PACK_DEFINITIONS: PackDefinition[] = [
  { packKind: 'item', offerCount: 3, pickCount: 1 },
  { packKind: 'item', offerCount: 5, pickCount: 1 },
  { packKind: 'item', offerCount: 7, pickCount: 2 },
  { packKind: 'rite', offerCount: 3, pickCount: 1 },
  { packKind: 'rite', offerCount: 5, pickCount: 1 },
  { packKind: 'rite', offerCount: 7, pickCount: 2 },
  { packKind: 'revelation', offerCount: 3, pickCount: 1 },
  { packKind: 'revelation', offerCount: 5, pickCount: 1 },
  { packKind: 'revelation', offerCount: 7, pickCount: 2 },
  { packKind: 'oracle', offerCount: 3, pickCount: 1 },
  { packKind: 'oracle', offerCount: 5, pickCount: 1 },
]
```

以下に置き換える:

```ts
// 護符/秘儀/天啓/カードセットは3-1・5-1・7-2の3パターン、神託は3-1・5-1の2パターン(7-2は無し)。計14パターン。
export const PACK_DEFINITIONS: PackDefinition[] = [
  { packKind: 'item', offerCount: 3, pickCount: 1 },
  { packKind: 'item', offerCount: 5, pickCount: 1 },
  { packKind: 'item', offerCount: 7, pickCount: 2 },
  { packKind: 'rite', offerCount: 3, pickCount: 1 },
  { packKind: 'rite', offerCount: 5, pickCount: 1 },
  { packKind: 'rite', offerCount: 7, pickCount: 2 },
  { packKind: 'revelation', offerCount: 3, pickCount: 1 },
  { packKind: 'revelation', offerCount: 5, pickCount: 1 },
  { packKind: 'revelation', offerCount: 7, pickCount: 2 },
  { packKind: 'oracle', offerCount: 3, pickCount: 1 },
  { packKind: 'oracle', offerCount: 5, pickCount: 1 },
  { packKind: 'cardSet', offerCount: 3, pickCount: 1 },
  { packKind: 'cardSet', offerCount: 5, pickCount: 1 },
  { packKind: 'cardSet', offerCount: 7, pickCount: 2 },
]
```

- [ ] **Step 6: テストを実行してパスすることを確認する**

Run: `npx vitest run src/lib/game/shidasu/shop.test.ts`

Expected: PASS(全件)

- [ ] **Step 7: 型チェックを実行する**

Run: `npm run check`

Expected: エラーなし

- [ ] **Step 8: コミット**

```bash
git add src/lib/game/shidasu/params.ts src/lib/game/shidasu/shidasu.config.json src/lib/game/shidasu/shop.ts src/lib/game/shidasu/shop.test.ts
git commit -m "feat: トランプセット福袋の価格(packPrice.cardSet)とPACK_DEFINITIONSを追加"
```

---

### Task 8: 選択・確定フロー(`engine.ts`)

**Files:**
- Modify: `src/lib/game/shidasu/engine.ts`
- Modify: `src/lib/game/shidasu/engine.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/game/shidasu/engine.test.ts`の先頭、`import { ... } from './engine'`ブロック内にある以下の既存の行を探す:

```ts
  buyPack,
```

以下に置き換える:

```ts
  buyPack,
  pickPackCardSet,
  closePackCardSetSelect,
```

同ファイル内、以下の既存コード(`describe('resolveWaveEnd'`ブロックの直前、または適当な末尾セクション)を探す:

```ts
describe('resolveWaveEnd', () => {
```

直前に以下を追加する:

```ts
describe('トランプセット福袋の購入・選択フロー', () => {
  test('buyPackでcardSet福袋を購入すると、cardSetSelectフェーズへ遷移しcardSetOfferが確定する', () => {
    const run: RunState = { ...beginRun(DEFAULT_PARAMS, 1), phase: 'shop', currency: 100, shop: { individual: [], packs: [{ packKind: 'cardSet', offerCount: 3, pickCount: 1, sold: false }] } }
    const result = buyPack(DEFAULT_PARAMS, run, 0, createRng(1))
    expect(result.phase).toBe('cardSetSelect')
    expect(result.cardSetOffer).toHaveLength(3)
    expect(result.offerPickRemaining).toBe(1)
  })

  test('buyPackでcardSet福袋を購入すると通貨が価格分減る', () => {
    const run: RunState = { ...beginRun(DEFAULT_PARAMS, 1), phase: 'shop', currency: 100, shop: { individual: [], packs: [{ packKind: 'cardSet', offerCount: 3, pickCount: 1, sold: false }] } }
    const result = buyPack(DEFAULT_PARAMS, run, 0, createRng(1))
    expect(result.currency).toBe(100 - packPrice(DEFAULT_PARAMS, 'cardSet', 3))
  })

  test('pickPackCardSetで選んだジャンルのカードがdeckCompositionに追加される', () => {
    const run: RunState = { ...beginRun(DEFAULT_PARAMS, 1), phase: 'cardSetSelect', offerPickRemaining: 1, cardSetOffer: [{ genreId: 'wildCard', cards: [{ suit: '★', rank: 0, wild: true }] }] }
    const result = pickPackCardSet(run, 'wildCard')
    expect(result.deckComposition).toHaveLength(53)
    expect(result.deckComposition[52].wild).toBe(true)
  })

  test('pickPackCardSetで選択後、offerPickRemainingが0ならshopフェーズへ戻る', () => {
    const run: RunState = { ...beginRun(DEFAULT_PARAMS, 1), phase: 'cardSetSelect', offerPickRemaining: 1, cardSetOffer: [{ genreId: 'wildCard', cards: [{ suit: '★', rank: 0, wild: true }] }] }
    const result = pickPackCardSet(run, 'wildCard')
    expect(result.phase).toBe('shop')
    expect(result.cardSetOffer).toEqual([])
  })

  test('pickPackCardSetで選択後、offerPickRemainingが残っていればcardSetSelectのまま残りオファーを保持する', () => {
    const run: RunState = {
      ...beginRun(DEFAULT_PARAMS, 1),
      phase: 'cardSetSelect',
      offerPickRemaining: 2,
      cardSetOffer: [
        { genreId: 'wildCard', cards: [{ suit: '★', rank: 0, wild: true }] },
        { genreId: 'royal', cards: [{ suit: '♠', rank: 11, wild: false }, { suit: '♠', rank: 12, wild: false }, { suit: '♠', rank: 13, wild: false }] },
      ],
    }
    const result = pickPackCardSet(run, 'wildCard')
    expect(result.phase).toBe('cardSetSelect')
    expect(result.offerPickRemaining).toBe(1)
    expect(result.cardSetOffer).toHaveLength(1)
    expect(result.cardSetOffer[0].genreId).toBe('royal')
    expect(result.deckComposition).toHaveLength(53)
  })

  test('pickPackCardSetで追加されたカードのdeckIdは既存の続きから採番される', () => {
    const run: RunState = { ...beginRun(DEFAULT_PARAMS, 1), phase: 'cardSetSelect', offerPickRemaining: 1, cardSetOffer: [{ genreId: 'flush', cards: [{ suit: '♠', rank: 1, wild: false }, { suit: '♥', rank: 2, wild: false }, { suit: '♦', rank: 3, wild: false }, { suit: '♣', rank: 4, wild: false }] }] }
    const result = pickPackCardSet(run, 'flush')
    const addedIds = result.deckComposition.slice(52).map(c => c.deckId)
    expect(addedIds).toEqual([52, 53, 54, 55])
  })

  test('cardSetSelectフェーズ以外でpickPackCardSetを呼んでも何も起きない', () => {
    const run: RunState = { ...beginRun(DEFAULT_PARAMS, 1), phase: 'shop' }
    const result = pickPackCardSet(run, 'wildCard')
    expect(result).toBe(run)
  })

  test('closePackCardSetSelectで残りの選択を放棄しshopフェーズへ戻る', () => {
    const run: RunState = { ...beginRun(DEFAULT_PARAMS, 1), phase: 'cardSetSelect', offerPickRemaining: 1, cardSetOffer: [{ genreId: 'wildCard', cards: [{ suit: '★', rank: 0, wild: true }] }] }
    const result = closePackCardSetSelect(run)
    expect(result.phase).toBe('shop')
    expect(result.cardSetOffer).toEqual([])
    expect(result.offerPickRemaining).toBe(0)
    expect(result.deckComposition).toHaveLength(52)
  })
})

```

- [ ] **Step 2: テストを実行して失敗することを確認する**

Run: `npx vitest run src/lib/game/shidasu/engine.test.ts -t "トランプセット福袋の購入・選択フロー"`

Expected: FAIL(`pickPackCardSet`・`closePackCardSetSelect`が存在しない、`buyPack`が`cardSet`を処理しない)

- [ ] **Step 3: `engine.ts`の`buyPack`に`cardSet`分岐を追加する**

`src/lib/game/shidasu/engine.ts`内、以下の既存コードを探す:

```ts
export function buyPack(params: ShidasuParams, run: RunState, slotIndex: number, rand: () => number = Math.random): RunState {
  if (run.phase !== 'shop' || !run.shop) return run
  const slot = run.shop.packs[slotIndex]
  if (!slot || slot.sold) return run
  const price = packPrice(params, slot.packKind, slot.offerCount)
  if (run.currency < price) return run
  const packs = run.shop.packs.map((s, i) => (i === slotIndex ? { ...s, sold: true } : s))
  const base: RunState = { ...run, currency: run.currency - price, shop: { ...run.shop, packs }, offerPickRemaining: slot.pickCount }
  if (slot.packKind === 'item') return { ...base, phase: 'itemSelect', offer: rollItemOffer(run.items, rand, slot.offerCount) }
  if (slot.packKind === 'rite') return { ...base, phase: 'riteSelect', riteOffer: rollRiteOffer(rand, slot.offerCount) }
  if (slot.packKind === 'revelation') return { ...base, phase: 'revelationSelect', revelationOffer: rollRevelationOffer(rand, slot.offerCount) }
  return { ...base, phase: 'oracleSelect', oracleOffer: rollOracleOffer(rand, slot.offerCount) }
}
```

以下に置き換える:

```ts
export function buyPack(params: ShidasuParams, run: RunState, slotIndex: number, rand: () => number = Math.random): RunState {
  if (run.phase !== 'shop' || !run.shop) return run
  const slot = run.shop.packs[slotIndex]
  if (!slot || slot.sold) return run
  const price = packPrice(params, slot.packKind, slot.offerCount)
  if (run.currency < price) return run
  const packs = run.shop.packs.map((s, i) => (i === slotIndex ? { ...s, sold: true } : s))
  const base: RunState = { ...run, currency: run.currency - price, shop: { ...run.shop, packs }, offerPickRemaining: slot.pickCount }
  if (slot.packKind === 'item') return { ...base, phase: 'itemSelect', offer: rollItemOffer(run.items, rand, slot.offerCount) }
  if (slot.packKind === 'rite') return { ...base, phase: 'riteSelect', riteOffer: rollRiteOffer(rand, slot.offerCount) }
  if (slot.packKind === 'revelation') return { ...base, phase: 'revelationSelect', revelationOffer: rollRevelationOffer(rand, slot.offerCount) }
  if (slot.packKind === 'oracle') return { ...base, phase: 'oracleSelect', oracleOffer: rollOracleOffer(rand, slot.offerCount) }
  return { ...base, phase: 'cardSetSelect', cardSetOffer: rollCardSetOffer(rand, slot.offerCount) }
}
```

同ファイル先頭、以下の既存importを探す(`rollOracleOffer`をimportしている行):

```ts
import { rollOracleOffer, defaultOracleLevels } from './oracles'
```

直後に以下を追加する:

```ts
import { rollCardSetOffer } from './cardSets'
```

- [ ] **Step 4: `engine.ts`に`pickPackCardSet`・`closePackCardSetSelect`を実装する**

`src/lib/game/shidasu/engine.ts`内、以下の既存コード(神託福袋の選択・確定・キャンセル・クローズ処理群の末尾、`useOracle`関数の直前)を探す:

```ts
export function closePackOracleSelect(run: RunState): RunState {
  if (run.phase !== 'oracleSelect') return run
  return { ...run, phase: 'shop', oracleOffer: [], pendingNewOracle: null, offerPickRemaining: 0 }
}

// 所持中の神託を1つ消費する。playingフェーズでのみ呼べる(ショップ内フェーズでは呼べない)。
// run/wave両方のoracleLevelsを同期する。盤面への直接効果は無い。
export function useOracle(params: ShidasuParams, run: RunState, roleName: RoleName): RunState {
```

`closePackOracleSelect`関数と`useOracle`関数の間(コメント`// 所持中の神託を1つ消費する。...`の直前)に、以下を挿入する:

```ts

function resolvePackCardSetPick(run: RunState, pickedGenreId: CardSetGenreId): RunState {
  const idx = run.cardSetOffer.findIndex(o => o.genreId === pickedGenreId)
  const cardSetOffer = idx === -1 ? run.cardSetOffer : [...run.cardSetOffer.slice(0, idx), ...run.cardSetOffer.slice(idx + 1)]
  const offerPickRemaining = run.offerPickRemaining - 1
  if (offerPickRemaining <= 0) {
    return { ...run, phase: 'shop', cardSetOffer: [], offerPickRemaining: 0 }
  }
  return { ...run, cardSetOffer, offerPickRemaining }
}

// カードセットの福袋(cardSetSelect)から1つ選び、そのカードをdeckCompositionへ即座に追加する。
// 護符・秘儀・天啓/神託と異なり所持枠・スワップ処理は無い(選択即確定)。
// deckIdはこの時点のdeckComposition長を基準に採番する(addCardsToDeckComposition、deck.ts参照)。
export function pickPackCardSet(run: RunState, genreId: CardSetGenreId): RunState {
  if (run.phase !== 'cardSetSelect') return run
  const offer = run.cardSetOffer.find(o => o.genreId === genreId)
  if (!offer) return run
  const deckComposition = addCardsToDeckComposition(run.deckComposition, offer.cards)
  return resolvePackCardSetPick({ ...run, deckComposition }, genreId)
}

// 残りの選択を放棄してshopへ戻る。
export function closePackCardSetSelect(run: RunState): RunState {
  if (run.phase !== 'cardSetSelect') return run
  return { ...run, phase: 'shop', cardSetOffer: [], offerPickRemaining: 0 }
}
```

同ファイル先頭、以下の既存importを探す(`shuffleInPlace`をimportしている行):

```ts
import { createRng, shuffle, shuffleInPlace, standardDeckComposition } from './deck'
```

以下に置き換える:

```ts
import { createRng, shuffle, shuffleInPlace, standardDeckComposition, addCardsToDeckComposition } from './deck'
```

同ファイル先頭、以下の既存importを探す:

```ts
import type { Card, StageModifier, WaveState, ItemId, WaveEndReason, RunState, Suit, Rank, DeckCard, RoleName, ChainCardOrigin, RiteId, Rarity, RevelationId, SpreadId, RunPhase, HeldRevelationOrOracleRef, Star, StarRestriction } from './types'
```

以下に置き換える:

```ts
import type { Card, StageModifier, WaveState, ItemId, WaveEndReason, RunState, Suit, Rank, DeckCard, RoleName, ChainCardOrigin, RiteId, Rarity, RevelationId, SpreadId, RunPhase, HeldRevelationOrOracleRef, Star, StarRestriction, CardSetGenreId } from './types'
```

- [ ] **Step 5: テストを実行してパスすることを確認する**

Run: `npx vitest run src/lib/game/shidasu/engine.test.ts -t "トランプセット福袋の購入・選択フロー"`

Expected: PASS

- [ ] **Step 6: 全体テストと型チェックを実行する**

Run: `npm run check && npx vitest run src/lib/game/shidasu`

Expected: 両方PASS

- [ ] **Step 7: コミット**

```bash
git add src/lib/game/shidasu/engine.ts src/lib/game/shidasu/engine.test.ts
git commit -m "feat: トランプセット福袋の選択・確定フロー(pickPackCardSet/closePackCardSetSelect)を実装"
```

---

### Task 9: UI実装(`+page.svelte`)

**Files:**
- Modify: `src/routes/game/shidasu/+page.svelte`

- [ ] **Step 1: importとハンドラー関数を追加する**

`src/routes/game/shidasu/+page.svelte`内、以下の既存importを探す(秘儀福袋のハンドラーが含まれる行):

```ts
    pickPackRite, confirmPackRiteSwap, cancelPackRiteSwap, closePackRiteSelect,
```

直後に以下を追加する:

```ts
    pickPackCardSet, closePackCardSetSelect,
```

同ファイル内、以下の既存importを探す:

```ts
  import type { RunState, ItemId, Suit, Rank, RiteId, RevelationId, RoleName, SpreadId, HeldRevelationOrOracleRef, ShopSlotKind, PlayCardResult, Star, WaveState } from '$lib/game/shidasu/types'
```

以下に置き換える:

```ts
  import type { RunState, ItemId, Suit, Rank, RiteId, RevelationId, RoleName, SpreadId, HeldRevelationOrOracleRef, ShopSlotKind, PlayCardResult, Star, WaveState, CardSetGenreId } from '$lib/game/shidasu/types'
```

同ファイル内、以下の既存コードを探す(`handleClosePackRiteSelect`関数):

```ts
  function handleClosePackRiteSelect() {
    run = closePackRiteSelect(run)
  }
```

直後に以下を追加する:

```ts

  function handlePickPackCardSet(genreId: CardSetGenreId) {
    run = pickPackCardSet(run, genreId)
  }

  function handleClosePackCardSetSelect() {
    run = closePackCardSetSelect(run)
  }
```

- [ ] **Step 2: `cardSetSelect`フェーズのUIを追加する**

同ファイル内、以下の既存コード(`riteSelect`フェーズのUIブロック全体)を探す:

```svelte
{:else if run.phase === 'riteSelect'}
  <div class="fixed inset-0 z-50 bg-emerald-950/90 backdrop-blur-sm flex items-center justify-center p-6">
    <div class="bg-white rounded-2xl p-6 max-w-xl w-full max-h-[90vh] overflow-y-auto space-y-3">
      <h2 class="text-lg font-bold text-slate-800">秘儀福袋(残り{run.offerPickRemaining}個選べます)</h2>
      {#if run.pendingNewRite}
        <p class="text-sm text-slate-600">所持枠が満杯です。入れ替える秘儀を選んでください。</p>
        <div class="space-y-1">
          {#each run.rites as riteId}
            <button onclick={() => handleConfirmPackRiteSwap(riteId)} class="w-full text-left px-3 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-sm">{riteId}</button>
          {/each}
        </div>
        <button onclick={handleCancelPackRiteSwap} class="text-xs text-slate-500 underline">キャンセル</button>
      {:else}
        <div class="space-y-1">
          {#each run.riteOffer as riteId}
            <button onclick={() => handlePickPackRite(riteId)} class="w-full text-left px-3 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-sm">{riteId}</button>
          {/each}
        </div>
        <button onclick={handleClosePackRiteSelect} class="text-xs text-slate-500 underline">選択を終える</button>
      {/if}
    </div>
  </div>
{:else if run.phase === 'itemSelect'}
```

以下に置き換える(`riteSelect`ブロックの末尾と`itemSelect`の間に`cardSetSelect`ブロックを挿入する):

```svelte
{:else if run.phase === 'riteSelect'}
  <div class="fixed inset-0 z-50 bg-emerald-950/90 backdrop-blur-sm flex items-center justify-center p-6">
    <div class="bg-white rounded-2xl p-6 max-w-xl w-full max-h-[90vh] overflow-y-auto space-y-3">
      <h2 class="text-lg font-bold text-slate-800">秘儀福袋(残り{run.offerPickRemaining}個選べます)</h2>
      {#if run.pendingNewRite}
        <p class="text-sm text-slate-600">所持枠が満杯です。入れ替える秘儀を選んでください。</p>
        <div class="space-y-1">
          {#each run.rites as riteId}
            <button onclick={() => handleConfirmPackRiteSwap(riteId)} class="w-full text-left px-3 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-sm">{riteId}</button>
          {/each}
        </div>
        <button onclick={handleCancelPackRiteSwap} class="text-xs text-slate-500 underline">キャンセル</button>
      {:else}
        <div class="space-y-1">
          {#each run.riteOffer as riteId}
            <button onclick={() => handlePickPackRite(riteId)} class="w-full text-left px-3 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-sm">{riteId}</button>
          {/each}
        </div>
        <button onclick={handleClosePackRiteSelect} class="text-xs text-slate-500 underline">選択を終える</button>
      {/if}
    </div>
  </div>
{:else if run.phase === 'cardSetSelect'}
  <div class="fixed inset-0 z-50 bg-emerald-950/90 backdrop-blur-sm flex items-center justify-center p-6">
    <div class="bg-white rounded-2xl p-6 max-w-xl w-full max-h-[90vh] overflow-y-auto space-y-3">
      <h2 class="text-lg font-bold text-slate-800">トランプセット福袋(残り{run.offerPickRemaining}個選べます)</h2>
      <div class="space-y-2">
        {#each run.cardSetOffer as offer (offer.genreId)}
          <button onclick={() => handlePickPackCardSet(offer.genreId)} class="w-full text-left px-3 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-sm space-y-1">
            <div class="font-semibold text-slate-700">{CARD_SET_GENRE_NAMES[offer.genreId]}</div>
            <div class="flex flex-wrap gap-1">
              {#each offer.cards as c, i (i)}
                <div class="w-8">
                  <CardFace card={{ id: i, deckId: i, suit: c.suit, rank: c.rank, wild: c.wild }} covered={false} />
                </div>
              {/each}
            </div>
          </button>
        {/each}
      </div>
      <button onclick={handleClosePackCardSetSelect} class="text-xs text-slate-500 underline">選択を終える</button>
    </div>
  </div>
{:else if run.phase === 'itemSelect'}
```

- [ ] **Step 3: `CARD_SET_GENRE_NAMES`と`CardFace`のimportを追加する**

同ファイル内、以下の既存importを探す:

```ts
  import DebugPanel from './DebugPanel.svelte'
  import PlayArea from './PlayArea.svelte'
  import RoleStatusPanel from './RoleStatusPanel.svelte'
```

以下に置き換える:

```ts
  import DebugPanel from './DebugPanel.svelte'
  import PlayArea from './PlayArea.svelte'
  import RoleStatusPanel from './RoleStatusPanel.svelte'
  import CardFace from './CardFace.svelte'
  import { CARD_SET_GENRE_NAMES } from '$lib/game/shidasu/cardSets'
```

- [ ] **Step 4: 型チェックを実行する**

Run: `npm run check`

Expected: エラーなし。`CardFace`コンポーネントのpropsの型(`Card`型、`id`・`deckId`必須)にダミー値`i`(配列インデックス)を渡している箇所が正しく型を満たしているか確認する。

- [ ] **Step 5: 開発サーバーで動作確認する**

Run: `npm run dev`

`/admin/shidasu-debug`または実際のゲームプレイ経由でショップに入り、福袋を購入してカードセット福袋(`cardSetSelect`フェーズ)が出現した際に、ジャンル名とカード内容が正しく表示され、選択すると`deckComposition`にカードが追加されることをブラウザで確認する。福袋の出現は乱数依存のため、複数回ショップに入り直すか、`/admin/shidasu-debug`のデッキ確認機能で確認する。

- [ ] **Step 6: コミット**

```bash
git add src/routes/game/shidasu/+page.svelte
git commit -m "feat: トランプセット福袋の選択画面UIを実装"
```

---

### Task 10: 管理画面の価格編集UI

**Files:**
- Modify: `src/routes/admin/shidasu-currency/+page.svelte`

- [ ] **Step 1: バリデーションに`cardSet`価格のチェックを追加する**

`src/routes/admin/shidasu-currency/+page.svelte`内、以下の既存コードを探す:

```ts
    if (!Number.isFinite(config.shop.packPrice.oracle.threeOne) || config.shop.packPrice.oracle.threeOne < 0) return true
    if (!Number.isFinite(config.shop.packPrice.oracle.fiveOne) || config.shop.packPrice.oracle.fiveOne < 0) return true
```

直後に以下を追加する:

```ts
    if (!Number.isFinite(config.shop.packPrice.cardSet.threeOne) || config.shop.packPrice.cardSet.threeOne < 0) return true
    if (!Number.isFinite(config.shop.packPrice.cardSet.fiveOne) || config.shop.packPrice.cardSet.fiveOne < 0) return true
    if (!Number.isFinite(config.shop.packPrice.cardSet.sevenTwo) || config.shop.packPrice.cardSet.sevenTwo < 0) return true
```

- [ ] **Step 2: 価格編集フォームに`cardSet`の入力欄を追加する**

同ファイル内、以下の既存コードを探す(福袋価格セクションの神託3-1・5-1入力欄、`grid-cols-3`ブロックの末尾):

```svelte
          <label class="text-xs text-slate-500">
            神託 3-1
            <input type="number" step="1" bind:value={config.shop.packPrice.oracle.threeOne} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            神託 5-1
            <input type="number" step="1" bind:value={config.shop.packPrice.oracle.fiveOne} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
        </div>
      </div>
    </section>
```

以下に置き換える:

```svelte
          <label class="text-xs text-slate-500">
            神託 3-1
            <input type="number" step="1" bind:value={config.shop.packPrice.oracle.threeOne} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            神託 5-1
            <input type="number" step="1" bind:value={config.shop.packPrice.oracle.fiveOne} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            トランプセット 3-1
            <input type="number" step="1" bind:value={config.shop.packPrice.cardSet.threeOne} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            トランプセット 5-1
            <input type="number" step="1" bind:value={config.shop.packPrice.cardSet.fiveOne} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs text-slate-500">
            トランプセット 7-2
            <input type="number" step="1" bind:value={config.shop.packPrice.cardSet.sevenTwo} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
          </label>
        </div>
      </div>
    </section>
```

同ファイル内、以下の既存コードを探す(福袋価格セクションの見出し):

```svelte
        <p class="text-xs text-slate-500 mb-1">福袋価格(護符・秘儀・天啓は3-1/5-1/7-2、神託は3-1/5-1のみ)</p>
```

以下に置き換える:

```svelte
        <p class="text-xs text-slate-500 mb-1">福袋価格(護符・秘儀・天啓・トランプセットは3-1/5-1/7-2、神託は3-1/5-1のみ)</p>
```

- [ ] **Step 3: 型チェックを実行する**

Run: `npm run check`

Expected: エラーなし

- [ ] **Step 4: 開発サーバーで動作確認する**

Run: `npm run dev`

`/admin/shidasu-currency`を開き、「トランプセット 3-1/5-1/7-2」の入力欄が表示され、値を編集・保存できることをブラウザで確認する。

- [ ] **Step 5: コミット**

```bash
git add src/routes/admin/shidasu-currency/+page.svelte
git commit -m "feat: 管理画面にトランプセット福袋の価格編集欄を追加"
```

---

## 全タスク完了後の確認

- [ ] `npm run build`を実行し、ビルドが通ることを確認する
- [ ] `npm run check`を実行し、型エラーが無いことを確認する
- [ ] `npx vitest run`でリポジトリ全体のテストスイートを実行し、全てPASSすることを確認する
- [ ] `npm run dev`で開発サーバーを起動し、実際にショップでトランプセット福袋を購入→ジャンル選択→デッキへの反映までの一連の流れを、複数のジャンル(階段セット・ペアセット・赤黒バランスセット等)で目視確認する
- [ ] `/admin/shidasu-currency`でトランプセット福袋の価格を変更し、ショップでの購入価格に反映されることを確認する
