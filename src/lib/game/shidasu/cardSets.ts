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
