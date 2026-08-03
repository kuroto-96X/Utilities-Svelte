// src/lib/game/shidasu/patterns.test.ts
import { describe, test, expect } from 'vitest'
import { isRed, analyzeSuitColor, analyzeStair, checkFlush, checkRoyalSet, countSameRankBefore, countSameRankForWildPlay, checkCompleteRun, evaluateChainBonus, stairUsesKALoop, chainContinuesPattern, cardColors } from './patterns'
import type { Card, RoleName } from './types'
import { DEFAULT_PARAMS } from './params'
import { card } from './testHelpers'

describe('isRed', () => {
  test('♥♦は赤、♠♣は黒', () => {
    expect(isRed(card(1, '♥', 5))).toBe(true)
    expect(isRed(card(2, '♦', 5))).toBe(true)
    expect(isRed(card(3, '♠', 5))).toBe(false)
    expect(isRed(card(4, '♣', 5))).toBe(false)
  })
})

describe('cardColors(紅蓮・漆黒を考慮した色判定)', () => {
  test('護符なしの場合、赤札はred:trueのみ、黒札はblack:trueのみを返す', () => {
    expect(cardColors(card(1, '♥', 5), [])).toEqual({ red: true, black: false })
    expect(cardColors(card(1, '♦', 5), [])).toEqual({ red: true, black: false })
    expect(cardColors(card(1, '♠', 5), [])).toEqual({ red: false, black: true })
    expect(cardColors(card(1, '♣', 5), [])).toEqual({ red: false, black: true })
  })

  test('紅蓮所持時、黒札もred:trueになる(blackは元のまま)', () => {
    expect(cardColors(card(1, '♠', 5), ['crimson'])).toEqual({ red: true, black: true })
  })

  test('紅蓮所持時、赤札はred:trueのまま(blackは変化しない)', () => {
    expect(cardColors(card(1, '♥', 5), ['crimson'])).toEqual({ red: true, black: false })
  })

  test('漆黒所持時、赤札もblack:trueになる(redは元のまま)', () => {
    expect(cardColors(card(1, '♥', 5), ['jetBlack'])).toEqual({ red: true, black: true })
  })

  test('紅蓮・漆黒を両方所持時、どのカードもred:true・black:trueになる', () => {
    expect(cardColors(card(1, '♠', 5), ['crimson', 'jetBlack'])).toEqual({ red: true, black: true })
    expect(cardColors(card(1, '♥', 5), ['crimson', 'jetBlack'])).toEqual({ red: true, black: true })
  })
})

describe('analyzeSuitColor with 紅蓮・漆黒', () => {
  test('紅蓮所持時、黒札のみのチェーンでもcolorHeldがtrueになる(赤札が混ざっても崩れない)', () => {
    const chain = [card(1, '♠', 5), card(2, '♣', 6), card(3, '♥', 7)]
    const result = analyzeSuitColor(chain, ['crimson'])
    expect(result.colorHeld).toBe(true)
  })

  test('護符なしの場合、黒札と赤札が混在するとcolorHeldはfalse', () => {
    const chain = [card(1, '♠', 5), card(2, '♣', 6), card(3, '♥', 7)]
    const result = analyzeSuitColor(chain, [])
    expect(result.colorHeld).toBe(false)
  })
})

describe('chainContinuesPattern', () => {
  test('チェーンが空なら継続不可', () => {
    expect(chainContinuesPattern(DEFAULT_PARAMS.scoring, [], card(1, '♠', 5))).toBe(false)
  })

  test('実カード3枚未満では同スートが揃っていても継続不可', () => {
    const chain = [card(1, '♠', 5)]
    expect(chainContinuesPattern(DEFAULT_PARAMS.scoring, chain, card(2, '♠', 6))).toBe(false)
  })

  test('捲った札を含めて実カード3枚以上・同スートが揃えば継続', () => {
    const chain = [card(1, '♠', 5), card(2, '♠', 6)]
    expect(chainContinuesPattern(DEFAULT_PARAMS.scoring, chain, card(3, '♠', 9))).toBe(true)
  })

  test('同スートが成立中でも、捲った札が違うスート・違う色なら継続不可', () => {
    const chain = [card(1, '♠', 5), card(2, '♠', 6)]
    expect(chainContinuesPattern(DEFAULT_PARAMS.scoring, chain, card(3, '♥', 9))).toBe(false)
  })

  test('紅蓮所持時、黒2枚のチェーンに赤札を捲っても同色継続する(紅蓮で黒札もredを含むため)', () => {
    const chain = [card(1, '♠', 5), card(2, '♣', 6)]
    const withoutCrimson = chainContinuesPattern(DEFAULT_PARAMS.scoring, chain, card(3, '♥', 9))
    expect(withoutCrimson).toBe(false)
    const withCrimson = chainContinuesPattern(DEFAULT_PARAMS.scoring, chain, card(3, '♥', 9), undefined, undefined, ['crimson'])
    expect(withCrimson).toBe(true)
  })

  test('階段が成立中で、捲った札が同方向を継続し長さがstairMinLen以上になれば継続', () => {
    const chain = [card(1, '♠', 5), card(2, '♣', 6)] // dir=+1, len=2
    expect(chainContinuesPattern(DEFAULT_PARAMS.scoring, chain, card(3, '♦', 7), 3)).toBe(true)
  })

  test('階段の長さがstairMinLen未満なら継続不可', () => {
    const chain = [card(1, '♠', 5), card(2, '♣', 6)] // dir=+1, len=2
    expect(chainContinuesPattern(DEFAULT_PARAMS.scoring, chain, card(3, '♦', 7))).toBe(false) // 既定のstairMinLen(5)未満
  })

  test('全ての条件が既に崩れていれば継続不可', () => {
    const chain = [card(1, '♠', 5), card(2, '♥', 8)] // スートも色も階段も不成立
    expect(chainContinuesPattern(DEFAULT_PARAMS.scoring, chain, card(3, '♣', 2))).toBe(false)
  })

  test('全てワイルドでも母数を満たせば継続する(比較対象の実カードが無く矛盾しないため)', () => {
    const chain = [card(1, '★', 0, true), card(2, '★', 0, true)]
    expect(chainContinuesPattern(DEFAULT_PARAMS.scoring, chain, card(3, '★', 0, true))).toBe(true)
  })

  test('階段がワイルドで橋渡しされていても、方向確立に使われて継続する', () => {
    const chain = [card(1, '♠', 5), card(2, '★', 0, true)]
    expect(chainContinuesPattern(DEFAULT_PARAMS.scoring, chain, card(3, '♦', 7), 3)).toBe(true)
  })

  test('suitColorMinLenを指定すると、その枚数で同スート継続と判定される', () => {
    const chain = [card(20, '♠', 3)]
    expect(chainContinuesPattern(DEFAULT_PARAMS.scoring, chain, card(21, '♠', 4), DEFAULT_PARAMS.scoring.stairMinLen, 2)).toBe(true)
    expect(chainContinuesPattern(DEFAULT_PARAMS.scoring, chain, card(21, '♠', 4), DEFAULT_PARAMS.scoring.stairMinLen, 3)).toBe(false)
  })
})

describe('stairUsesKALoop', () => {
  test('実カード同士が隣接してK→A(13→1)を跨ぐ場合はtrue', () => {
    const chain = [card(1, '♠', 12), card(2, '♠', 13), card(3, '♠', 1), card(4, '♠', 2)]
    expect(stairUsesKALoop(chain)).toBe(true)
  })

  test('ワイルドで橋渡しされた区間の内側でK→Aを跨ぐ場合もtrue', () => {
    const chain = [card(1, '♠', 12), card(2, '★', 0, true), card(3, '★', 0, true), card(4, '♠', 2)]
    expect(stairUsesKALoop(chain)).toBe(true)
  })

  test('境界を跨がない階段はfalse', () => {
    const chain = [card(1, '♠', 3), card(2, '♠', 4), card(3, '♠', 5)]
    expect(stairUsesKALoop(chain)).toBe(false)
  })

  test('階段が成立していなければfalse', () => {
    const chain = [card(1, '♠', 3), card(2, '♠', 9)]
    expect(stairUsesKALoop(chain)).toBe(false)
  })

  test('実カードが2枚未満なら比較対象が無く都合よくtrueとみなす', () => {
    expect(stairUsesKALoop([card(1, '★', 0, true), card(2, '★', 0, true)])).toBe(true)
  })
})

describe('evaluateChainBonus (patternFired/roleFired)', () => {
  const scoring = DEFAULT_PARAMS.scoring

  test('同スートパターン成立時はpatternFired=trueになる', () => {
    const result = evaluateChainBonus(scoring, [card(1, '♠', 3), card(2, '♠', 5)], card(3, '♠', 9))
    expect(result.patternFired).toBe(true)
    expect(result.roleFired).toEqual([])
  })

  test('フラッシュ成立時、実カードだけで4スート揃っていればusedWild=false', () => {
    const chainBefore = [card(1, '♠', 1), card(2, '♥', 2), card(3, '♦', 3)]
    const result = evaluateChainBonus(scoring, chainBefore, card(4, '♣', 4))
    const flush = result.roleFired.find(r => r.name === 'flush')
    expect(flush?.usedWild).toBe(false)
  })

  test('フラッシュ成立時、ワイルドで穴埋めしていればusedWild=true', () => {
    const chainBefore = [card(1, '♠', 1), card(2, '★', 0, true), card(3, '♦', 3)]
    const result = evaluateChainBonus(scoring, chainBefore, card(4, '♣', 4))
    const flush = result.roleFired.find(r => r.name === 'flush')
    expect(flush?.usedWild).toBe(true)
  })

  test('ロイヤルセット成立時、実カードだけで揃っていればusedWild=false', () => {
    const chainBefore = [card(1, '♠', 11), card(2, '♥', 12)]
    const result = evaluateChainBonus(scoring, chainBefore, card(3, '♦', 13))
    const royalSet = result.roleFired.find(r => r.name === 'royalSet')
    expect(royalSet?.usedWild).toBe(false)
  })

  test('ロイヤルセット成立時、ワイルドで穴埋めしていればusedWild=true', () => {
    const chainBefore = [card(1, '♠', 11), card(2, '★', 0, true)]
    const result = evaluateChainBonus(scoring, chainBefore, card(3, '♦', 13))
    const royalSet = result.roleFired.find(r => r.name === 'royalSet')
    expect(royalSet?.usedWild).toBe(true)
  })

  test('同ランクボーナス成立時、チェーンにワイルドが無ければusedWild=false', () => {
    const chainBefore = [card(1, '♠', 5), card(2, '♥', 5)]
    const result = evaluateChainBonus(scoring, chainBefore, card(3, '♦', 5))
    const sameRank = result.roleFired.find(r => r.name === 'sameRank')
    expect(sameRank?.usedWild).toBe(false)
  })

  test('同ランクボーナス成立時、実カードだけで既に成立していてもチェーンにワイルドがあればusedWild=true(加点量に無条件で寄与するため)', () => {
    const chainBefore = [card(1, '♠', 5), card(2, '★', 0, true)]
    const result = evaluateChainBonus(scoring, chainBefore, card(3, '♦', 5))
    const sameRank = result.roleFired.find(r => r.name === 'sameRank')
    expect(sameRank?.usedWild).toBe(true)
  })

  test('コンプリートラン成立時、実カードだけで全ランク揃っていればusedWild=false', () => {
    const chainBefore = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((r, i) => card(i + 1, '♠', r as Card['rank']))
    const result = evaluateChainBonus(scoring, chainBefore, card(20, '♦', 13))
    const completeRun = result.roleFired.find(r => r.name === 'completeRun')
    expect(completeRun?.usedWild).toBe(false)
  })

  test('コンプリートラン成立時、ワイルドで穴埋めしていればusedWild=true', () => {
    const chainBefore = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((r, i) => card(i + 1, '♠', r as Card['rank'])).concat(card(12, '★', 0, true))
    const result = evaluateChainBonus(scoring, chainBefore, card(20, '♦', 13))
    const completeRun = result.roleFired.find(r => r.name === 'completeRun')
    expect(completeRun?.usedWild).toBe(true)
  })

  test('役もパターンも成立しなければpatternFired=false・roleFired=[]', () => {
    const result = evaluateChainBonus(scoring, [card(1, '♠', 2)], card(2, '♥', 9))
    expect(result.patternFired).toBe(false)
    expect(result.roleFired).toEqual([])
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

  test('実カード2枚をワイルド1枚が橋渡しし、差がちょうど埋まれば方向確立に使われる', () => {
    const chain = [card(1, '♠', 5), card(2, '★', 0, true), card(3, '♣', 7)]
    // 5→7の差2をワイルド1枚(6扱い)で埋め、方向+1・長さ3で成立する
    expect(analyzeStair(chain)).toEqual({ held: true, dir: 1, len: 3 })
  })

  test('ワイルドで埋めても差が合わなければheld:false', () => {
    const chain = [card(1, '♠', 5), card(2, '★', 0, true), card(3, '♣', 9)]
    // 5→9の差4に対しワイルドは1枚(1ステップ分)しか無く埋めきれないため不成立
    expect(analyzeStair(chain)).toEqual({ held: false, dir: 0, len: 1 })
  })

  test('ワイルドを挟んだK⇔Aループ跨ぎも方向確立に使われる', () => {
    const chain = [card(1, '♠', 13), card(2, '★', 0, true), card(3, '♣', 2)]
    // K→2の間をワイルド(A扱い)1枚で埋め、ループ跨ぎで方向+1・長さ3が成立する
    expect(analyzeStair(chain)).toEqual({ held: true, dir: 1, len: 3 })
  })

  test('方向確立後、実際の差が合わないワイルド越しの札は継続しない', () => {
    const chain = [card(1, '♠', 5), card(2, '♣', 6), card(3, '★', 0, true), card(4, '♦', 9)]
    // 5→6でdir=1確立。6→9の差3をワイルド1枚(1ステップ分)では埋めきれないため不成立
    expect(analyzeStair(chain)).toEqual({ held: false, dir: 0, len: 1 })
  })

  test('方向確立後、ワイルド越しでも差が正しく埋まれば継続する', () => {
    const chain = [card(1, '♠', 5), card(2, '♣', 6), card(3, '★', 0, true), card(4, '♦', 8)]
    // 5→6でdir=1確立。6→8の差2をワイルド1枚(7扱い)で埋め、長さ4で継続する
    expect(analyzeStair(chain)).toEqual({ held: true, dir: 1, len: 4 })
  })

  test('全てワイルド(2枚以上)の場合は都合よく一直線とみなされる', () => {
    const chain = [card(1, '★', 0, true), card(2, '★', 0, true), card(3, '★', 0, true)]
    expect(analyzeStair(chain)).toEqual({ held: true, dir: 1, len: 3 })
  })

  test('ワイルド1枚のみ(実カード無し)ではheld:true, dir:0, len:1', () => {
    expect(analyzeStair([card(1, '★', 0, true)])).toEqual({ held: true, dir: 0, len: 1 })
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
})

describe('countSameRankBefore', () => {
  test('同ランクが無ければ0', () => {
    expect(countSameRankBefore([card(1, '♠', 5), card(2, '♥', 6)], 7)).toBe(0)
  })

  test('同ランクの実カードが3枚あれば3を返す', () => {
    const cards = [card(1, '♠', 5), card(2, '♥', 5), card(3, '♦', 5)]
    expect(countSameRankBefore(cards, 5)).toBe(3)
  })

  test('ワイルドはランクを問わず加算される', () => {
    const cards = [card(1, '♠', 5), card(2, '♥', 5), card(3, '★', 0, true)]
    expect(countSameRankBefore(cards, 5)).toBe(3) // 実カード2枚+ワイルド1枚
  })

  test('指定ランクと無関係な実カードが混ざっていても、ワイルドの枚数分は必ず加算される', () => {
    const cards = [card(1, '♠', 9), card(2, '★', 0, true), card(3, '★', 0, true)]
    expect(countSameRankBefore(cards, 5)).toBe(2) // 実カード0枚(9はランク不一致)+ワイルド2枚
  })
})

describe('countSameRankForWildPlay', () => {
  test('同ランクの重複が無ければ2を返す(既発生の最大枚数1+1)', () => {
    const cards = [card(1, '♠', 5), card(2, '♥', 3), card(3, '♦', 7)]
    expect(countSameRankForWildPlay(cards)).toBe(2)
  })

  test('既に同ランクが2枚あるランクが存在すれば、その枚数+1を返す', () => {
    const cards = [card(1, '♠', 5), card(2, '♥', 5), card(3, '♦', 3), card(4, '♣', 3)]
    expect(countSameRankForWildPlay(cards)).toBe(3)
  })

  test('チェーン内の既存ワイルドは最大枚数の算出に加算される', () => {
    const cards = [card(1, '♠', 5), card(2, '♥', 5), card(3, '★', 0, true)]
    // 実カードの最大重複は5の2枚、既存ワイルド1枚を加えて3、+1で4
    expect(countSameRankForWildPlay(cards)).toBe(4)
  })

  test('チェーンが空でも2を返す(下限)', () => {
    expect(countSameRankForWildPlay([])).toBe(2)
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
})

describe('evaluateChainBonus', () => {
  const scoring = DEFAULT_PARAMS.scoring

  test('コンボ1枚目(chainBefore空)はボーナス0', () => {
    const result = evaluateChainBonus(scoring, [], card(1, '♠', 5))
    expect(result).toEqual({ bonus: 0, parts: [], patternFired: false, patternFiredCount: 0, roleFired: [] })
  })

  test('実カード2枚(3枚未満)ではまだ同スートボーナスは付かない', () => {
    const chainBefore = [card(1, '♠', 5)]
    const result = evaluateChainBonus(scoring, chainBefore, card(2, '♠', 6))
    expect(result.parts.some(p => p.text.startsWith('同スート'))).toBe(false)
  })

  test('実カード3枚以上になった瞬間から同スートボーナスが付く', () => {
    const chainBefore = [card(1, '♠', 5), card(2, '♠', 6)]
    const result = evaluateChainBonus(scoring, chainBefore, card(3, '♠', 7))
    expect(result.bonus).toBe(scoring.suitBonus)
    expect(result.parts.map(p => p.text)).toEqual([`同スート+${scoring.suitBonus}`])
  })

  test('新たに加えたカード自身がワイルドの場合も母数に含める(3枚以上なら同スートボーナスが付く)', () => {
    const chainBefore = [card(1, '♠', 5), card(2, '♠', 7)] // 実カード2枚、同スート
    const result = evaluateChainBonus(scoring, chainBefore, card(3, '★', 0, true))
    // ワイルド自身も母数に含めるため、実カード2枚+ワイルド1枚=3枚として同スートボーナスが成立する
    // (ワイルドをプレイすると同ランクボーナスも同時に発生するため、部分一致で検証する)
    expect(result.parts.map(p => p.text)).toContain(`同スート+${scoring.suitBonus}`)
  })

  test('3枚全てワイルドでも母数を満たせば都合よく同スートボーナスが成立する', () => {
    const chainBefore = [card(1, '★', 0, true), card(2, '★', 0, true)]
    const result = evaluateChainBonus(scoring, chainBefore, card(3, '★', 0, true))
    expect(result.parts.map(p => p.text)).toContain(`同スート+${scoring.suitBonus}`)
  })

  test('コンボ中に一度スートが崩れたら、以降同スートが来てもsuitBonusは付かない', () => {
    const chainBefore = [card(1, '♠', 5), card(2, '♥', 6), card(3, '♠', 7)] // 1枚目→2枚目でスート崩壊済み、3枚目は直前(2枚目...)
    const result = evaluateChainBonus(scoring, chainBefore, card(4, '♠', 8))
    expect(result.parts.some(p => p.text.startsWith('同スート'))).toBe(false)
  })

  test('基本ルールでは階段は既定のstairMinLen(5)未満だとstairBonusが付かない', () => {
    const chainBefore = [card(1, '♠', 5), card(2, '♣', 6)]
    const result = evaluateChainBonus(scoring, chainBefore, card(3, '♦', 7))
    // 5→6→7で長さ3、既定のstairMinLen(5)未満のためstairBonusは付かない
    expect(result.parts.some(p => p.text.startsWith('階段'))).toBe(false)
  })

  test('階段が既定のstairMinLen(5)以上続けばstairBonusが付く', () => {
    const chainBefore = [card(1, '♠', 3), card(2, '♣', 4), card(3, '♦', 5), card(4, '♠', 6)]
    const result = evaluateChainBonus(scoring, chainBefore, card(5, '♣', 7))
    expect(result.parts.map(p => p.text)).toContain(`階段5 +${scoring.stairBonus}`)
  })

  test('stairMinLenを明示的に指定すると(架橋の護符相当)その値で判定される', () => {
    const chainBefore = [card(1, '♠', 5), card(2, '♣', 6)]
    const result = evaluateChainBonus(scoring, chainBefore, card(3, '♦', 7), 3)
    expect(result.parts.map(p => p.text)).toContain(`階段3 +${scoring.stairBonus}`)
  })

  test('ワイルドで橋渡しされた階段もstairBonusの対象になる', () => {
    const chainBefore = [card(1, '♠', 5), card(2, '★', 0, true)]
    const result = evaluateChainBonus(scoring, chainBefore, card(3, '♦', 7), 3)
    // 5→(ワイルド=6扱い)→7で長さ3、stairMinLen=3(架橋の護符相当)で成立
    expect(result.parts.map(p => p.text)).toContain(`階段3 +${scoring.stairBonus}`)
  })

  test('直近4枚で4スート揃うとflushBonusが付く', () => {
    const chainBefore = [card(1, '♦', 3), card(2, '♠', 5), card(3, '♣', 9)]
    const result = evaluateChainBonus(scoring, chainBefore, card(4, '♥', 2))
    expect(result.parts.map(p => p.text)).toContain(`フラッシュ+${scoring.flushBonus}`)
  })

  test('直近3枚でJQK揃うとroyalSetBonusが付く', () => {
    const chainBefore = [card(1, '♠', 13), card(2, '♥', 11)]
    const result = evaluateChainBonus(scoring, chainBefore, card(3, '♦', 12))
    expect(result.parts.map(p => p.text)).toContain(`ロイヤル+${scoring.royalSetBonus}`)
  })

  test('同ランクが既に2枚あれば sameRankBonusUnit×2 が付く', () => {
    const chainBefore = [card(1, '♠', 5), card(2, '♥', 5)]
    const result = evaluateChainBonus(scoring, chainBefore, card(3, '♦', 5))
    expect(result.parts.map(p => p.text)).toContain(`同ランク+${scoring.sameRankBonusUnit * 2}`)
  })

  test('チェーン内にワイルドが含まれる場合、同ランクボーナスにワイルドの枚数分も加算される', () => {
    const chainBefore = [card(1, '♠', 5), card(2, '★', 0, true)]
    const result = evaluateChainBonus(scoring, chainBefore, card(3, '♥', 5))
    // 実カード1枚(5)+ワイルド1枚 = 2枚扱い
    expect(result.parts.map(p => p.text)).toContain(`同ランク+${scoring.sameRankBonusUnit * 2}`)
  })

  test('ワイルド自身をプレイした場合、既発生の最大同ランク数+1枚として同ランクボーナスが発生する', () => {
    const chainBefore = [card(1, '♠', 5), card(2, '♥', 5), card(3, '♦', 3), card(4, '♣', 3)]
    // 5が2枚・3が2枚 → 既発生の最大枚数は2、ワイルドは2+1=3枚分として発生
    const result = evaluateChainBonus(scoring, chainBefore, card(5, '★', 0, true))
    expect(result.parts.map(p => p.text)).toContain(`同ランク+${scoring.sameRankBonusUnit * 3}`)
  })

  test('チェーン内に同ランクの重複が無い状態でワイルドをプレイすると2枚分として発生する', () => {
    const chainBefore = [card(1, '♠', 5), card(2, '♥', 3), card(3, '♦', 7)] // 全て異なるランク
    const result = evaluateChainBonus(scoring, chainBefore, card(4, '★', 0, true))
    expect(result.parts.map(p => p.text)).toContain(`同ランク+${scoring.sameRankBonusUnit * 2}`)
  })

  test('13ランクが揃った瞬間にcompleteRunBonusが付く(同スートでなければ追加ボーナスなし)', () => {
    const chainBefore = Array.from({ length: 12 }, (_, i) => card(i + 1, i % 2 === 0 ? '♠' : '♥', (i + 1) as Card['rank']))
    const result = evaluateChainBonus(scoring, chainBefore, card(13, '♦', 13))
    expect(result.parts.map(p => p.text)).toContain(`コンプリートラン+${scoring.completeRunBonus}`)
    expect(result.parts.some(p => p.text.includes('コンプリートラン(同スート)'))).toBe(false)
  })

  test('13ランクが全て同じスートで揃うとcompleteRunSuitBonusも追加で付く', () => {
    const chainBefore = Array.from({ length: 12 }, (_, i) => card(i + 1, '♠', (i + 1) as Card['rank']))
    const result = evaluateChainBonus(scoring, chainBefore, card(13, '♠', 13))
    expect(result.parts.map(p => p.text)).toContain(`コンプリートラン+${scoring.completeRunBonus}`)
    expect(result.parts.map(p => p.text)).toContain(`コンプリートラン(同スート)+${scoring.completeRunSuitBonus}`)
  })

  test('roleFiredの各要素は実際の加点額(amount)を持つ', () => {
    const chainBefore = [card(1, '♥', 9), card(2, '♦', 10), card(3, '♣', 11)]
    const result = evaluateChainBonus(DEFAULT_PARAMS.scoring, chainBefore, card(4, '♠', 12))
    const flushEntry = result.roleFired.find(r => r.name === 'flush')
    expect(flushEntry).toBeDefined()
    expect(flushEntry?.amount).toBe(DEFAULT_PARAMS.scoring.flushBonus)
  })

  test('roleBonusMultiplierを渡すと役ボーナスの額に倍率がかかる(パターンボーナスには影響しない)', () => {
    const chainBefore = [card(1, '♥', 9), card(2, '♦', 10), card(3, '♣', 11)]
    const multiplier = (name: RoleName) => (name === 'flush' ? 2 : 1)
    const result = evaluateChainBonus(DEFAULT_PARAMS.scoring, chainBefore, card(4, '♠', 12), DEFAULT_PARAMS.scoring.stairMinLen, multiplier)
    const flushEntry = result.roleFired.find(r => r.name === 'flush')
    expect(flushEntry?.amount).toBe(DEFAULT_PARAMS.scoring.flushBonus * 2)
    expect(result.bonus).toBe(DEFAULT_PARAMS.scoring.flushBonus * 2)
  })

  test('roleBonusMultiplierを省略すると常に等倍(既存挙動と同じ)', () => {
    const chainBefore = [card(1, '♣', 5), card(2, '♣', 6)]
    const withoutMultiplier = evaluateChainBonus(DEFAULT_PARAMS.scoring, chainBefore, card(3, '♣', 5))
    const withIdentityMultiplier = evaluateChainBonus(DEFAULT_PARAMS.scoring, chainBefore, card(3, '♣', 5), DEFAULT_PARAMS.scoring.stairMinLen, () => 1)
    expect(withoutMultiplier).toEqual(withIdentityMultiplier)
  })

  test('suitColorMinLenを指定すると、その枚数で同スートボーナスが成立する', () => {
    // 実カード2枚(同スート)のみ。既定のsuitColorMinLen(3)では不成立だが、2を渡すと成立する。
    const chainBefore = [card(20, '♠', 3)]
    const result = evaluateChainBonus(DEFAULT_PARAMS.scoring, chainBefore, card(21, '♠', 4), undefined, undefined, 2)
    expect(result.parts.map(p => p.text)).toContain(`同スート+${DEFAULT_PARAMS.scoring.suitBonus}`)
  })

  test('同スート・階段が同時成立すると、patternFiredCountが2になる', () => {
    // 実カード3枚を同スート(♠)かつ連続ランク(3,4,5)にして、同スートと階段の両方を成立させる。
    // stairMinLenを3に指定して3枚でも階段ボーナスが成立するようにする。
    const chainBefore = [card(20, '♠', 3), card(21, '♠', 4)]
    const result = evaluateChainBonus(DEFAULT_PARAMS.scoring, chainBefore, card(22, '♠', 5), 3)
    expect(result.parts.map(p => p.text)).toContain(`同スート+${DEFAULT_PARAMS.scoring.suitBonus}`)
    expect(result.parts.some(p => p.text.startsWith('階段'))).toBe(true)
    expect(result.patternFiredCount).toBe(2)
  })

  test('パターンボーナスが1種類も成立しなければpatternFiredCountは0', () => {
    const chainBefore = [card(20, '♠', 3)]
    const result = evaluateChainBonus(DEFAULT_PARAMS.scoring, chainBefore, card(21, '♦', 9))
    expect(result.patternFiredCount).toBe(0)
  })
})

describe('evaluateChainBonus: 神託レベル(oracleLevel)による得点上昇', () => {
  const scoring = DEFAULT_PARAMS.scoring

  test('同スートボーナスにレベルが乗算される', () => {
    const chainBefore = [card(1, '♠', 3), card(2, '♠', 4)]
    const oracleLevel = (name: RoleName) => (name === 'suit' ? 3 : 1)
    const result = evaluateChainBonus(scoring, chainBefore, card(3, '♠', 5), undefined, undefined, undefined, oracleLevel)
    expect(result.bonus).toBe(scoring.suitBonus * 3)
  })

  test('同色ボーナスにレベルが乗算される', () => {
    const chainBefore = [card(1, '♠', 3), card(2, '♣', 4)]
    const oracleLevel = (name: RoleName) => (name === 'color' ? 2 : 1)
    const result = evaluateChainBonus(scoring, chainBefore, card(3, '♠', 6), undefined, undefined, undefined, oracleLevel)
    expect(result.bonus).toBe(scoring.colorBonus * 2)
  })

  test('階段ボーナスにレベルが乗算される', () => {
    // スートを♠♥♦♠♠にして、直近4枚が偶然フラッシュ(全スート網羅)を満たさないようにする
    // (♠♥♦♣♠だと直近4枚が♥♦♣♠で全スート揃いフラッシュも同時成立してしまうため)
    const chainBefore = [card(1, '♠', 1), card(2, '♥', 2), card(3, '♦', 3), card(4, '♠', 4)]
    const oracleLevel = (name: RoleName) => (name === 'stair' ? 4 : 1)
    const result = evaluateChainBonus(scoring, chainBefore, card(5, '♠', 5), undefined, undefined, undefined, oracleLevel)
    expect(result.bonus).toBe(scoring.stairBonus * 4)
  })

  test('フラッシュボーナスにレベルが乗算され、既存のroleBonusMultiplierとも併用できる', () => {
    const chainBefore = [card(1, '♠', 2), card(2, '♥', 3), card(3, '♦', 4)]
    const oracleLevel = (name: RoleName) => (name === 'flush' ? 2 : 1)
    const roleBonusMultiplier = (name: RoleName) => (name === 'flush' ? 1.5 : 1)
    const result = evaluateChainBonus(scoring, chainBefore, card(4, '♣', 5), undefined, roleBonusMultiplier, undefined, oracleLevel)
    const flushEntry = result.roleFired.find(r => r.name === 'flush')
    expect(flushEntry?.amount).toBe(Math.floor(scoring.flushBonus * 2 * 1.5))
  })

  test('コンプリートラン・コンプリートラン(同スート)は同じcompleteRunレベルを参照する', () => {
    const chainBefore: Card[] = []
    for (let rank = 1 as Card['rank']; rank <= 12; rank = (rank + 1) as Card['rank']) {
      chainBefore.push(card(rank, '♠', rank))
    }
    const oracleLevel = (name: RoleName) => (name === 'completeRun' ? 2 : 1)
    const result = evaluateChainBonus(scoring, chainBefore, card(13, '♠', 13), undefined, undefined, undefined, oracleLevel)
    const completeRunEntry = result.roleFired.find(r => r.name === 'completeRun')
    expect(completeRunEntry?.amount).toBe(Math.floor(scoring.completeRunBonus * 2) + Math.floor(scoring.completeRunSuitBonus * 2))
  })

  test('同ランクボーナスにレベルが乗算される', () => {
    const chainBefore = [card(1, '♠', 5), card(2, '♥', 5)]
    const oracleLevel = (name: RoleName) => (name === 'sameRank' ? 3 : 1)
    const result = evaluateChainBonus(scoring, chainBefore, card(3, '♦', 5), undefined, undefined, undefined, oracleLevel)
    const sameRankEntry = result.roleFired.find(r => r.name === 'sameRank')
    expect(sameRankEntry?.amount).toBe(Math.floor(scoring.sameRankBonusUnit * 2 * 3))
  })

  test('oracleLevelを省略すると全役レベル1として扱われ、既存の挙動と一致する', () => {
    const chainBefore = [card(1, '♠', 3), card(2, '♠', 4)]
    const withDefault = evaluateChainBonus(scoring, chainBefore, card(3, '♠', 5))
    const withExplicitOne = evaluateChainBonus(scoring, chainBefore, card(3, '♠', 5), undefined, undefined, undefined, () => 1)
    expect(withDefault.bonus).toBe(withExplicitOne.bonus)
    expect(withDefault.bonus).toBe(scoring.suitBonus)
  })
})
