// src/lib/game/shidasu/chainAttributeEffects.test.ts
import { describe, test, expect } from 'vitest'
import { applyItemEffects } from './itemEffects'
import { DEFAULT_PARAMS } from './params'
import { card, ctx } from './testHelpers'
import type { Card } from './types'

describe('applyItemEffects (グループ4-a: 絵札条件系)', () => {
  const params = DEFAULT_PARAMS

  test('平穏: チェーンにJQKが無ければ加算、絵札が混ざれば不発動', () => {
    const fired = applyItemEffects('gained', 100, ['calm'], ctx({ chain: [card(1, '♠', 5), card(2, '♦', 8)] }), params)
    expect(fired.value).toBe(100 + params.talismans.calm.n)
    const notFired = applyItemEffects('gained', 100, ['calm'], ctx({ chain: [card(1, '♠', 5), card(2, '♦', 12)] }), params)
    expect(notFired.value).toBe(100)
  })

  test('安寧: チェーンにJQKが無ければ倍算', () => {
    const result = applyItemEffects('gained', 100, ['serenity'], ctx({ chain: [card(1, '♠', 5), card(2, '♦', 8)] }), params)
    expect(result.value).toBe(100 * params.talismans.serenity.x)
  })

  test('運命: チェーンがJQKのみなら加算、非絵札が混ざれば不発動', () => {
    const fired = applyItemEffects('gained', 100, ['destiny'], ctx({ chain: [card(1, '♠', 11), card(2, '♦', 13)] }), params)
    expect(fired.value).toBe(100 + params.talismans.destiny.n)
    const notFired = applyItemEffects('gained', 100, ['destiny'], ctx({ chain: [card(1, '♠', 11), card(2, '♦', 5)] }), params)
    expect(notFired.value).toBe(100)
  })

  test('宿命: チェーンがJQKのみなら倍算', () => {
    const result = applyItemEffects('gained', 100, ['fate'], ctx({ chain: [card(1, '♠', 11), card(2, '♦', 13)] }), params)
    expect(result.value).toBe(100 * params.talismans.fate.x)
  })

  test('安堵: 取得したカードのランクが1〜10なら加算、ワイルドなら都合よく発動、絵札なら不発動', () => {
    const numberCard = applyItemEffects('gained', 100, ['relief'], ctx({ card: card(1, '♠', 7) }), params)
    expect(numberCard.value).toBe(100 + params.talismans.relief.n)
    const wildCard = applyItemEffects('gained', 100, ['relief'], ctx({ card: card(1, '★', 0, true) }), params)
    expect(wildCard.value).toBe(100 + params.talismans.relief.n)
    const faceCard = applyItemEffects('gained', 100, ['relief'], ctx({ card: card(1, '♠', 12) }), params)
    expect(faceCard.value).toBe(100)
  })
})

describe('applyItemEffects (グループ4-b: スート/色専有系)', () => {
  const params = DEFAULT_PARAMS

  test('深緑: ♣専有チェーンで倍算、他スートが混ざれば不発動、全ワイルドでも都合よく発動', () => {
    const pure = applyItemEffects('gained', 100, ['verdantGreen'], ctx({ chain: [card(1, '♣', 3), card(2, '♣', 5)] }), params)
    expect(pure.value).toBe(100 * params.talismans.verdantGreen.x)
    const mixed = applyItemEffects('gained', 100, ['verdantGreen'], ctx({ chain: [card(1, '♣', 3), card(2, '♦', 5)] }), params)
    expect(mixed.value).toBe(100)
    const allWild = applyItemEffects('gained', 100, ['verdantGreen'], ctx({ chain: [card(1, '★', 0, true), card(2, '★', 0, true)] }), params)
    expect(allWild.value).toBe(100 * params.talismans.verdantGreen.x)
  })

  test('宝石: ♦専有チェーンで倍算', () => {
    const result = applyItemEffects('gained', 100, ['gem'], ctx({ chain: [card(1, '♦', 3), card(2, '♦', 5)] }), params)
    expect(result.value).toBe(100 * params.talismans.gem.x)
  })

  test('真剣: ♠専有チェーンで倍算', () => {
    const result = applyItemEffects('gained', 100, ['resolve'], ctx({ chain: [card(1, '♠', 3), card(2, '♠', 5)] }), params)
    expect(result.value).toBe(100 * params.talismans.resolve.x)
  })

  test('聖杯: ♥専有チェーンで倍算', () => {
    const result = applyItemEffects('gained', 100, ['grail'], ctx({ chain: [card(1, '♥', 3), card(2, '♥', 5)] }), params)
    expect(result.value).toBe(100 * params.talismans.grail.x)
  })

  test('月光: 黒専有チェーンで倍算、赤が混ざれば不発動', () => {
    const pure = applyItemEffects('gained', 100, ['moonlight'], ctx({ chain: [card(1, '♠', 3), card(2, '♣', 5)] }), params)
    expect(pure.value).toBe(100 * params.talismans.moonlight.x)
    const mixed = applyItemEffects('gained', 100, ['moonlight'], ctx({ chain: [card(1, '♠', 3), card(2, '♥', 5)] }), params)
    expect(mixed.value).toBe(100)
  })

  test('陽光: 赤専有チェーンで倍算', () => {
    const result = applyItemEffects('gained', 100, ['sunlight'], ctx({ chain: [card(1, '♥', 3), card(2, '♦', 5)] }), params)
    expect(result.value).toBe(100 * params.talismans.sunlight.x)
  })

  test('月光+紅蓮: 赤札が混ざっても紅蓮所持時は成立しない(紅蓮は黒→赤拡張のみ)が、漆黒所持時は赤札もblackを含むため成立する', () => {
    const chain = [card(1, '♠', 3), card(2, '♥', 5)]
    const withCrimson = applyItemEffects('gained', 100, ['moonlight', 'crimson'], ctx({ chain, items: ['moonlight', 'crimson'] }), params)
    expect(withCrimson.value).toBe(100)
    const withJetBlack = applyItemEffects('gained', 100, ['moonlight', 'jetBlack'], ctx({ chain, items: ['moonlight', 'jetBlack'] }), params)
    expect(withJetBlack.value).toBe(100 * params.talismans.moonlight.x)
  })
})

describe('applyItemEffects (グループ4-c: 枚数カウント系)', () => {
  const params = DEFAULT_PARAMS

  test('王冠: チェーン内のK枚数(ワイルド込み)×xで倍算、K無しなら不発動', () => {
    const chain = [card(1, '♠', 13), card(2, '♦', 13), card(3, '★', 0, true)]
    const result = applyItemEffects('gained', 100, ['crown'], ctx({ chain }), params)
    expect(result.value).toBe(100 * (1 + 3 * params.talismans.crown.x))
    const noKing = applyItemEffects('gained', 100, ['crown'], ctx({ chain: [card(1, '♠', 5)] }), params)
    expect(noKing.value).toBe(100)
  })

  test('青葉: チェーン内の♣枚数(ワイルド込み)×nで加算', () => {
    const chain = [card(1, '♣', 3), card(2, '♣', 5), card(3, '★', 0, true)]
    const result = applyItemEffects('gained', 100, ['cloverLeaf'], ctx({ chain }), params)
    expect(result.value).toBe(100 + 3 * params.talismans.cloverLeaf.n)
  })

  test('硬貨: チェーン内の♦枚数×nで加算', () => {
    const chain = [card(1, '♦', 3), card(2, '♦', 5)]
    const result = applyItemEffects('gained', 100, ['coin'], ctx({ chain }), params)
    expect(result.value).toBe(100 + 2 * params.talismans.coin.n)
  })

  test('武器: チェーン内の♠枚数×nで加算', () => {
    const chain = [card(1, '♠', 3), card(2, '♠', 5)]
    const result = applyItemEffects('gained', 100, ['blade'], ctx({ chain }), params)
    expect(result.value).toBe(100 + 2 * params.talismans.blade.n)
  })

  test('献杯: チェーン内の♥枚数×nで加算', () => {
    const chain = [card(1, '♥', 3), card(2, '♥', 5)]
    const result = applyItemEffects('gained', 100, ['chalice'], ctx({ chain }), params)
    expect(result.value).toBe(100 + 2 * params.talismans.chalice.n)
  })

  test('均衡: 赤黒枚数が同数(ワイルドで調整可)なら加算', () => {
    const balanced = applyItemEffects('gained', 100, ['balance'], ctx({ chain: [card(1, '♠', 3), card(2, '♥', 5)] }), params)
    expect(balanced.value).toBe(100 + params.talismans.balance.n)
    const adjustedByWild = applyItemEffects('gained', 100, ['balance'], ctx({ chain: [card(1, '♠', 3), card(2, '♥', 4), card(3, '♠', 5), card(4, '★', 0, true)] }), params)
    expect(adjustedByWild.value).toBe(100 + params.talismans.balance.n)
    const unbalanced = applyItemEffects('gained', 100, ['balance'], ctx({ chain: [card(1, '♠', 3), card(2, '♠', 4), card(3, '♥', 5)] }), params)
    expect(unbalanced.value).toBe(100)
  })

  test('均衡: 合計枚数が奇数だとワイルドをどう振り分けても同数にできないため不発動', () => {
    const singleWild = applyItemEffects('gained', 100, ['balance'], ctx({ chain: [card(1, '★', 0, true)] }), params)
    expect(singleWild.value).toBe(100)
    const oddTotal = applyItemEffects('gained', 100, ['balance'], ctx({ chain: [card(1, '♠', 3), card(2, '★', 0, true), card(3, '★', 0, true)] }), params)
    expect(oddTotal.value).toBe(100)
  })

  test('調和: 赤黒枚数が同数なら倍算', () => {
    const result = applyItemEffects('gained', 100, ['harmony'], ctx({ chain: [card(1, '♠', 3), card(2, '♥', 5)] }), params)
    expect(result.value).toBe(100 * params.talismans.harmony.x)
  })
})

describe('applyItemEffects (グループ4-d: 既存フラグ再利用・KAループ系)', () => {
  const params = DEFAULT_PARAMS

  test('高潔: 同スートパターン成立時(3枚以上・同スート)に加算', () => {
    const chain = [card(1, '♠', 3), card(2, '♠', 5), card(3, '♠', 9)]
    const fired = applyItemEffects('gained', 100, ['nobility'], ctx({ chain }), params)
    expect(fired.value).toBe(100 + params.talismans.nobility.n)
    const tooShort = applyItemEffects('gained', 100, ['nobility'], ctx({ chain: chain.slice(0, 2) }), params)
    expect(tooShort.value).toBe(100)
  })

  test('執念: 同スートパターン成立時、チェーン長×xで倍算', () => {
    const chain = [card(1, '♠', 3), card(2, '♠', 5), card(3, '♠', 9)]
    const result = applyItemEffects('gained', 100, ['tenacity'], ctx({ chain }), params)
    expect(result.value).toBe(100 * (1 + chain.length * params.talismans.tenacity.x))
  })

  test('覚悟: 階段成立時(effectiveStairMinLen以上)、階段長×xで倍算', () => {
    const chain = [card(1, '♠', 3), card(2, '♦', 4), card(3, '♥', 5), card(4, '♣', 6), card(5, '♠', 7)]
    const result = applyItemEffects('gained', 100, ['determination'], ctx({ chain, effectiveStairMinLen: 5 }), params)
    expect(result.value).toBe(100 * (1 + 5 * params.talismans.determination.x))
  })

  test('覚悟: 階段の長さがeffectiveStairMinLen未満、または階段が崩れていれば不発動', () => {
    const tooShort = [card(1, '♠', 3), card(2, '♦', 4), card(3, '♥', 5)]
    const tooShortResult = applyItemEffects('gained', 100, ['determination'], ctx({ chain: tooShort, effectiveStairMinLen: 5 }), params)
    expect(tooShortResult.value).toBe(100)
    const broken = [card(1, '♠', 3), card(2, '♦', 9), card(3, '♥', 5), card(4, '♣', 6), card(5, '♠', 7)]
    const brokenResult = applyItemEffects('gained', 100, ['determination'], ctx({ chain: broken, effectiveStairMinLen: 5 }), params)
    expect(brokenResult.value).toBe(100)
  })

  test('循環: K→A、A→Kの遷移で倍算し、ワイルドが絡む場合も都合よく成立する', () => {
    const kToA = applyItemEffects('gained', 100, ['cycle'], ctx({ previousFoundation: card(1, '♠', 13), card: card(2, '♦', 1) }), params)
    expect(kToA.value).toBe(100 * params.talismans.cycle.x)
    const wildAsA = applyItemEffects('gained', 100, ['cycle'], ctx({ previousFoundation: card(1, '♠', 13), card: card(2, '★', 0, true) }), params)
    expect(wildAsA.value).toBe(100 * params.talismans.cycle.x)
    const notFired = applyItemEffects('gained', 100, ['cycle'], ctx({ previousFoundation: card(1, '♠', 7), card: card(2, '♦', 8) }), params)
    expect(notFired.value).toBe(100)
  })

  const kaLoopChain: Card[] = [8, 9, 10, 11, 12, 13, 1, 2, 3, 4, 5, 6, 7].map((r, i) => card(i + 1, '♠', r as Card['rank']))
  const completeRunRoleFired = { bonus: 0, parts: [], patternFired: false, patternFiredCount: 0, roleFired: [{ name: 'completeRun' as const, usedWild: false, amount: 0 }] }

  test('輪廻: コンプリートラン成立かつ階段成立かつK↔Aループを跨ぐ場合に倍算', () => {
    const fired = applyItemEffects('gained', 100, ['reincarnation'], ctx({ chain: kaLoopChain, chainBonus: completeRunRoleFired }), params)
    expect(fired.value).toBe(100 * params.talismans.reincarnation.x)
    const noLoopChain = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13].map((r, i) => card(i + 1, '♠', r as Card['rank']))
    const notFired = applyItemEffects('gained', 100, ['reincarnation'], ctx({ chain: noLoopChain, chainBonus: completeRunRoleFired }), params)
    expect(notFired.value).toBe(100)
  })

  test('威光: コンプリートラン成立かつ階段成立かつ同スート専有の場合に倍算', () => {
    const fired = applyItemEffects('gained', 100, ['majesty'], ctx({ chain: kaLoopChain, chainBonus: completeRunRoleFired }), params)
    expect(fired.value).toBe(100 * params.talismans.majesty.x)
    const mixedSuitChain = kaLoopChain.map((c, i) => (i === 0 ? { ...c, suit: '♦' as const } : c))
    const notFired = applyItemEffects('gained', 100, ['majesty'], ctx({ chain: mixedSuitChain, chainBonus: completeRunRoleFired }), params)
    expect(notFired.value).toBe(100)
  })
})
