// src/lib/game/shidasu/patterns.ts
import type { Card, Suit, RoleName, ItemId } from './types'
import type { ShidasuParams } from './params'
import { addPart, type ScorePart } from './scoreParts'

export function isRed(card: Card): boolean {
  return card.suit === '♥' || card.suit === '♦'
}

export interface CardColors {
  red: boolean
  black: boolean
}

// 紅蓮・漆黒による色の拡張解釈。紅蓮所持時は全ての札がredとしても扱われ(blackは元のまま)、
// 漆黒所持時は全ての札がblackとしても扱われる(redは元のまま)。両方所持時はどちらも常にtrue。
// ワイルドカードの扱いは呼び出し元で個別に処理する(この関数はワイルドの母数を考慮しない)。
export function cardColors(card: Card, items: ItemId[]): CardColors {
  const baseRed = card.suit === '♥' || card.suit === '♦'
  return {
    red: baseRed || items.includes('crimson'),
    black: !baseRed || items.includes('jetBlack'),
  }
}

export function isFace(card: Card): boolean {
  return card.rank >= 11
}

export interface SuitColorAnalysis {
  suitHeld: boolean
  colorHeld: boolean
}

export function analyzeSuitColor(chain: Card[], items: ItemId[] = []): SuitColorAnalysis {
  const realCards = chain.filter(c => !c.wild)
  if (realCards.length === 0) return { suitHeld: true, colorHeld: true }
  const first = realCards[0]
  const firstColors = cardColors(first, items)
  return {
    suitHeld: realCards.every(c => c.suit === first.suit),
    // 全カードが「firstと共通の色を持つか」で判定する(紅蓮・漆黒で複数色を持つカードは
    // どちらの色とも一致しうる、都合の良い解釈)
    colorHeld: realCards.every(c => {
      const cColors = cardColors(c, items)
      return (cColors.red && firstColors.red) || (cColors.black && firstColors.black)
    }),
  }
}

export interface StairAnalysis {
  held: boolean
  dir: -1 | 0 | 1
  len: number
}

// rankをdir方向にsteps回分ずらした値を返す(1〜13の循環、K⇔Aのループも跨ぐ)
function stepRank(rank: number, dir: -1 | 1, steps: number): number {
  const zeroBased = rank - 1
  const shifted = ((zeroBased + dir * steps) % 13 + 13) % 13
  return shifted + 1
}

export function analyzeStair(chain: Card[]): StairAnalysis {
  if (chain.length === 0) return { held: true, dir: 0, len: 1 }

  const realPositions = chain
    .map((c, i) => ({ card: c, index: i }))
    .filter(p => !p.card.wild)

  if (realPositions.length === 0) {
    // 実カードが1枚も無い場合、比較対象が無く矛盾しないため都合よく一直線とみなす
    return { held: true, dir: chain.length >= 2 ? 1 : 0, len: chain.length }
  }
  if (realPositions.length === 1) {
    // 方向を確立する相手(2つ目の実カード)が無いため未確立のまま
    return { held: true, dir: 0, len: 1 }
  }

  let dir: -1 | 0 | 1 = 0
  for (let k = 1; k < realPositions.length; k++) {
    const prev = realPositions[k - 1]
    const curr = realPositions[k]
    const gap = curr.index - prev.index // 間にあるワイルド枚数+1

    const matchesAscending = stepRank(prev.card.rank, 1, gap) === curr.card.rank
    const matchesDescending = stepRank(prev.card.rank, -1, gap) === curr.card.rank

    if (dir === 0) {
      if (matchesAscending) dir = 1
      else if (matchesDescending) dir = -1
      else return { held: false, dir: 0, len: 1 }
    } else if (!(dir === 1 ? matchesAscending : matchesDescending)) {
      return { held: false, dir: 0, len: 1 }
    }
  }
  return { held: true, dir, len: chain.length }
}

// 階段のチェーンが13→1、または1→13の境界を跨いだか(ワイルドで橋渡しされた区間内の越境も検出する)
export function stairUsesKALoop(chain: Card[]): boolean {
  const analysis = analyzeStair(chain)
  if (!analysis.held || analysis.dir === 0) return false
  const realPositions = chain.map((c, i) => ({ card: c, index: i })).filter(p => !p.card.wild)
  if (realPositions.length < 2) return true
  for (let k = 1; k < realPositions.length; k++) {
    const prev = realPositions[k - 1]
    const curr = realPositions[k]
    const gap = curr.index - prev.index
    if (analysis.dir === 1 && prev.card.rank + gap > 13) return true
    if (analysis.dir === -1 && prev.card.rank - gap < 1) return true
  }
  return false
}

const ALL_SUITS_REAL: Suit[] = ['♠', '♥', '♦', '♣']

// checkFlush/checkRoyalSet/checkCompleteRunは、いずれもワイルド1枚につき不足分を1つ埋めたものとして扱う。
// ただし現時点ではワイルドカードを山札に供給する手段が無いため(既存のワイルド供給アイテムは削除済み)、
// この緩和ルールは実際のプレイでは発動しない。将来ワイルド供給アイテムが追加された際に機能する先行実装。
export function checkFlush(chainIncludingThis: Card[]): boolean {
  if (chainIncludingThis.length < 4) return false
  const last4 = chainIncludingThis.slice(-4)
  const wildCount = last4.filter(c => c.wild).length
  const suitsPresent = new Set(last4.filter(c => !c.wild).map(c => c.suit))
  const missingSuits = ALL_SUITS_REAL.filter(s => !suitsPresent.has(s)).length
  return missingSuits <= wildCount
}

export function checkRoyalSet(chainIncludingThis: Card[]): boolean {
  if (chainIncludingThis.length < 3) return false
  const last3 = chainIncludingThis.slice(-3)
  const wildCount = last3.filter(c => c.wild).length
  const ranksPresent = new Set(last3.filter(c => !c.wild).map(c => c.rank))
  const requiredRanks: Card['rank'][] = [11, 12, 13]
  const missingRanks = requiredRanks.filter(r => !ranksPresent.has(r)).length
  return missingRanks <= wildCount
}

export function countSameRankBefore(chainBefore: Card[], rank: Card['rank']): number {
  const realMatches = chainBefore.filter(c => !c.wild && c.rank === rank).length
  const wildCount = chainBefore.filter(c => c.wild).length
  return realMatches + wildCount
}

// ワイルド自身をプレイした場合の同ランクボーナス判定用: チェーン内で既に発生している
// 同ランクの最大枚数(既存ワイルドの代役分を含む)に+1枚した数で発生させる(まだ発生していなければ2枚)
export function countSameRankForWildPlay(chainBefore: Card[]): number {
  const realRankCounts = new Map<Card['rank'], number>()
  for (const c of chainBefore) {
    if (!c.wild) realRankCounts.set(c.rank, (realRankCounts.get(c.rank) ?? 0) + 1)
  }
  const maxRealRankCount = realRankCounts.size === 0 ? 0 : Math.max(...realRankCounts.values())
  const wildCountInChain = chainBefore.filter(c => c.wild).length
  return Math.max(maxRealRankCount + wildCountInChain, 1) + 1
}

export function checkCompleteRun(chainBefore: Card[], chainIncludingThis: Card[]): boolean {
  const distinctRealBefore = new Set(chainBefore.filter(c => !c.wild).map(c => c.rank)).size
  const wildCountBefore = chainBefore.filter(c => c.wild).length
  const distinctRealNow = new Set(chainIncludingThis.filter(c => !c.wild).map(c => c.rank)).size
  const wildCountNow = chainIncludingThis.filter(c => c.wild).length

  const distinctBefore = Math.min(13, distinctRealBefore + wildCountBefore)
  const distinctNow = Math.min(13, distinctRealNow + wildCountNow)
  return distinctBefore < 13 && distinctNow >= 13
}

export interface ChainBonusResult {
  bonus: number
  parts: ScorePart[]
  // 同スート/同色/階段のいずれかの「パターンボーナス」が成立したか
  patternFired: boolean
  // 成立したパターンボーナスの種類数(同スート/同色のいずれかで+1、階段でさらに+1。最大2)。瑠璃が参照する。
  patternFiredCount: number
  // 成立した「役ボーナス」の一覧。usedWildの意味はrole名によって異なる:
  // flush/royalSet/completeRunは「実カードだけでは成立せずワイルドの穴埋めが必須だったか」(必要性ベース)。
  // sameRankは同ランクボーナスの加点量自体がワイルド枚数を無条件に含むため、
  // 「チェーンにワイルドが1枚でも存在すれば常にtrue」(寄与ベース)になる。
  // amountはこの役が実際に加算した点数(roleBonusMultiplier適用後、completeRunは同スート追加分を含む)。
  // 明星(倍率適用)・鋼鉄(遅延複製)が参照する。
  roleFired: { name: RoleName; usedWild: boolean; amount: number }[]
}

export function evaluateChainBonus(
  scoring: ShidasuParams['scoring'],
  chainBefore: Card[],
  card: Card,
  stairMinLen: number = scoring.stairMinLen,
  roleBonusMultiplier: (name: RoleName) => number = () => 1,
  suitColorMinLen: number = scoring.suitColorMinLen,
  oracleLevel: (name: RoleName) => number = () => 1,
  items: ItemId[] = []
): ChainBonusResult {
  if (chainBefore.length === 0) {
    return { bonus: 0, parts: [], patternFired: false, patternFiredCount: 0, roleFired: [] }
  }

  let bonus = 0
  const parts: ScorePart[] = []
  let patternFired = false
  let patternFiredCount = 0
  const roleFired: { name: RoleName; usedWild: boolean; amount: number }[] = []

  const chainIncludingThis = [...chainBefore, card]
  const chainIncludingThisIds = chainIncludingThis.map(c => c.id)

  const { suitHeld, colorHeld } = analyzeSuitColor(chainIncludingThis, items)
  if (chainIncludingThis.length >= suitColorMinLen) {
    if (suitHeld) {
      const suitGain = Math.floor(scoring.suitBonus * oracleLevel('suit'))
      bonus += suitGain
      parts.push(addPart('同スート', suitGain, chainIncludingThisIds))
      patternFired = true
      patternFiredCount += 1
    } else if (colorHeld) {
      const colorGain = Math.floor(scoring.colorBonus * oracleLevel('color'))
      bonus += colorGain
      parts.push(addPart('同色', colorGain, chainIncludingThisIds))
      patternFired = true
      patternFiredCount += 1
    }
  }

  const stairInfo = analyzeStair(chainIncludingThis)
  if (stairInfo.held && stairInfo.len >= stairMinLen) {
    const stairGain = Math.floor(scoring.stairBonus * oracleLevel('stair'))
    bonus += stairGain
    parts.push(addPart(`階段${stairInfo.len} `, stairGain, chainIncludingThisIds))
    patternFired = true
    patternFiredCount += 1
  }

  if (checkFlush(chainIncludingThis)) {
    const flushGain = Math.floor(scoring.flushBonus * oracleLevel('flush') * roleBonusMultiplier('flush'))
    bonus += flushGain
    const last4 = chainIncludingThis.slice(-4)
    parts.push(addPart('フラッシュ', flushGain, last4.map(c => c.id)))
    const realSuits = new Set(last4.filter(c => !c.wild).map(c => c.suit))
    const flushUsedWild = ALL_SUITS_REAL.some(s => !realSuits.has(s))
    roleFired.push({ name: 'flush', usedWild: flushUsedWild, amount: flushGain })
  }

  if (checkRoyalSet(chainIncludingThis)) {
    const royalSetGain = Math.floor(scoring.royalSetBonus * oracleLevel('royalSet') * roleBonusMultiplier('royalSet'))
    bonus += royalSetGain
    const last3 = chainIncludingThis.slice(-3)
    parts.push(addPart('ロイヤル', royalSetGain, last3.map(c => c.id)))
    const realRanks = new Set(last3.filter(c => !c.wild).map(c => c.rank))
    const requiredRanks: Card['rank'][] = [11, 12, 13]
    const royalSetUsedWild = requiredRanks.some(r => !realRanks.has(r))
    roleFired.push({ name: 'royalSet', usedWild: royalSetUsedWild, amount: royalSetGain })
  }

  const sameRankCount = card.wild ? countSameRankForWildPlay(chainBefore) : countSameRankBefore(chainBefore, card.rank)
  if (sameRankCount > 0) {
    const sameRankGain = Math.floor(scoring.sameRankBonusUnit * sameRankCount * oracleLevel('sameRank') * roleBonusMultiplier('sameRank'))
    bonus += sameRankGain
    // ワイルド自身をプレイした場合、countSameRankForWildPlayが対象にする「既存の実カードのうち
    // 最も多いランク」の実カード群+チェーン内の全ワイルド+今回のワイルドをハイライト対象にする
    // (通常時は単純に「今回のカードと同ランクの実カード+ワイルド」でよい)
    let sameRankCardIds: number[]
    if (card.wild) {
      const realRankCounts = new Map<Card['rank'], number>()
      for (const c of chainBefore) {
        if (!c.wild) realRankCounts.set(c.rank, (realRankCounts.get(c.rank) ?? 0) + 1)
      }
      let maxRank: Card['rank'] | null = null
      let maxCount = 0
      for (const [rank, count] of realRankCounts) {
        if (count > maxCount) {
          maxRank = rank
          maxCount = count
        }
      }
      sameRankCardIds = chainBefore.filter(c => c.wild || c.rank === maxRank).map(c => c.id).concat(card.id)
    } else {
      sameRankCardIds = chainBefore.filter(c => c.wild || c.rank === card.rank).map(c => c.id).concat(card.id)
    }
    parts.push(addPart('同ランク', sameRankGain, sameRankCardIds))
    const sameRankUsedWild = card.wild || chainBefore.some(c => c.wild)
    roleFired.push({ name: 'sameRank', usedWild: sameRankUsedWild, amount: sameRankGain })
  }

  if (checkCompleteRun(chainBefore, chainIncludingThis)) {
    const completeRunGain = Math.floor(scoring.completeRunBonus * oracleLevel('completeRun') * roleBonusMultiplier('completeRun'))
    bonus += completeRunGain
    parts.push(addPart('コンプリートラン', completeRunGain, chainIncludingThisIds))
    const distinctRealNow = new Set(chainIncludingThis.filter(c => !c.wild).map(c => c.rank)).size
    const wildCountNow = chainIncludingThis.filter(c => c.wild).length
    const completeRunUsedWild = distinctRealNow < 13 && wildCountNow > 0
    // completeRunのみ、同スート追加ボーナスの有無を確定させてからroleFiredにpushする
    // (他の役は単一の加点のみだが、completeRunは同スート追加分も合算してamountに含めるため)。
    let completeRunTotalGain = completeRunGain
    if (suitHeld) {
      const completeRunSuitGain = Math.floor(scoring.completeRunSuitBonus * oracleLevel('completeRun') * roleBonusMultiplier('completeRun'))
      bonus += completeRunSuitGain
      parts.push(addPart('コンプリートラン(同スート)', completeRunSuitGain, chainIncludingThisIds))
      completeRunTotalGain += completeRunSuitGain
    }
    roleFired.push({ name: 'completeRun', usedWild: completeRunUsedWild, amount: completeRunTotalGain })
  }

  return { bonus, parts, patternFired, patternFiredCount, roleFired }
}

export function chainContinuesPattern(
  scoring: ShidasuParams['scoring'],
  chain: Card[],
  card: Card,
  stairMinLen: number = scoring.stairMinLen,
  suitColorMinLen: number = scoring.suitColorMinLen,
  items: ItemId[] = []
): boolean {
  const chainIncludingThis = [...chain, card]

  const { suitHeld, colorHeld } = analyzeSuitColor(chainIncludingThis, items)
  if (chainIncludingThis.length >= suitColorMinLen && (suitHeld || colorHeld)) return true

  const stairInfo = analyzeStair(chainIncludingThis)
  if (stairInfo.held && stairInfo.dir !== 0 && stairInfo.len >= stairMinLen) return true

  return false
}
