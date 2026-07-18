// src/lib/game/shidasu/itemEffects.test.ts
import { describe, test, expect } from 'vitest'
import { applyItemEffects } from './itemEffects'
import { DEFAULT_PARAMS } from './params'
import { card, ctx } from './testHelpers'
import type { Card } from './types'

describe('applyItemEffects', () => {
  const params = DEFAULT_PARAMS

  test('未登録の護符は素通りし、内訳(parts)も空になる', () => {
    const result = applyItemEffects('gained', 100, ['bridge'], ctx(), params)
    expect(result.value).toBe(100)
    expect(result.parts).toEqual([])
  })

  test('patience: clearBonusチャンネルで残り山札数×xを加算し、内訳に「忍耐+n」が入る', () => {
    const result = applyItemEffects('clearBonus', 1000, ['patience'], ctx({ stockRemaining: 4 }), params)
    const add = 4 * params.talismans.patience.x
    expect(result.value).toBe(1000 + add)
    expect(result.parts).toEqual([`忍耐+${add}`])
  })

  test('purify: clearBonusチャンネルでnを加算し、内訳に「浄化+n」が入る', () => {
    const result = applyItemEffects('clearBonus', 1000, ['purify'], ctx(), params)
    expect(result.value).toBe(1000 + params.talismans.purify.n)
    expect(result.parts).toEqual([`浄化+${params.talismans.purify.n}`])
  })

  test('temperance: clearBonusチャンネルで残り山札数×x分倍算し、内訳に「節制×倍率」が入る', () => {
    const result = applyItemEffects('clearBonus', 1000, ['temperance'], ctx({ stockRemaining: 4 }), params)
    const factor = 1 + 4 * params.talismans.temperance.x
    expect(result.value).toBe(1000 * factor)
    expect(result.parts).toEqual([`節制×${factor}`])
  })

  test('springBreeze: ♣を取った時のみgainedにnを加算し、内訳に「春風+n」が入る', () => {
    const withClub = applyItemEffects('gained', 100, ['springBreeze'], ctx({ card: card(1, '♣', 5) }), params)
    expect(withClub.value).toBe(100 + params.talismans.springBreeze.n)
    expect(withClub.parts).toEqual([`春風+${params.talismans.springBreeze.n}`])
    const withoutClub = applyItemEffects('gained', 100, ['springBreeze'], ctx({ card: card(1, '♥', 5) }), params)
    expect(withoutClub.value).toBe(100)
    expect(withoutClub.parts).toEqual([])
  })

  test('summerBreeze: ♦を取った時のみgainedにnを加算', () => {
    const result = applyItemEffects('gained', 100, ['summerBreeze'], ctx({ card: card(1, '♦', 5) }), params)
    expect(result.value).toBe(100 + params.talismans.summerBreeze.n)
  })

  test('autumnBreeze: ♥を取った時のみgainedにnを加算', () => {
    const result = applyItemEffects('gained', 100, ['autumnBreeze'], ctx({ card: card(1, '♥', 5) }), params)
    expect(result.value).toBe(100 + params.talismans.autumnBreeze.n)
  })

  test('winterBreeze: ♠を取った時のみgainedにnを加算', () => {
    const result = applyItemEffects('gained', 100, ['winterBreeze'], ctx({ card: card(1, '♠', 5) }), params)
    expect(result.value).toBe(100 + params.talismans.winterBreeze.n)
  })

  test('kinship: 直前が♥以外から今回♥を取った時のみnを加算', () => {
    const triggered = applyItemEffects('gained', 100, ['kinship'], ctx({ previousFoundation: card(2, '♣', 4), card: card(1, '♥', 5) }), params)
    expect(triggered.value).toBe(100 + params.talismans.kinship.n)
    const notTriggered = applyItemEffects('gained', 100, ['kinship'], ctx({ previousFoundation: card(2, '♥', 4), card: card(1, '♥', 5) }), params)
    expect(notTriggered.value).toBe(100)
  })

  test('thaw: 直前が♠から今回♠以外を取った時のみnを加算', () => {
    const triggered = applyItemEffects('gained', 100, ['thaw'], ctx({ previousFoundation: card(2, '♠', 4), card: card(1, '♥', 5) }), params)
    expect(triggered.value).toBe(100 + params.talismans.thaw.n)
    const notTriggered = applyItemEffects('gained', 100, ['thaw'], ctx({ previousFoundation: card(2, '♠', 4), card: card(1, '♠', 6) }), params)
    expect(notTriggered.value).toBe(100)
  })

  test('dusk: 直前が赤から今回黒を取った時のみnを加算', () => {
    const triggered = applyItemEffects('gained', 100, ['dusk'], ctx({ previousFoundation: card(2, '♥', 4), card: card(1, '♠', 5) }), params)
    expect(triggered.value).toBe(100 + params.talismans.dusk.n)
    const notTriggered = applyItemEffects('gained', 100, ['dusk'], ctx({ previousFoundation: card(2, '♠', 4), card: card(1, '♣', 5) }), params)
    expect(notTriggered.value).toBe(100)
  })

  test('dawn: 直前が黒から今回赤を取った時のみnを加算', () => {
    const triggered = applyItemEffects('gained', 100, ['dawn'], ctx({ previousFoundation: card(2, '♠', 4), card: card(1, '♥', 5) }), params)
    expect(triggered.value).toBe(100 + params.talismans.dawn.n)
    const notTriggered = applyItemEffects('gained', 100, ['dawn'], ctx({ previousFoundation: card(2, '♥', 4), card: card(1, '♦', 5) }), params)
    expect(notTriggered.value).toBe(100)
  })

  test('wit: ワイルドを取った時のみnを加算', () => {
    const triggered = applyItemEffects('gained', 100, ['wit'], ctx({ card: card(1, '★', 0, true) }), params)
    expect(triggered.value).toBe(100 + params.talismans.wit.n)
    const notTriggered = applyItemEffects('gained', 100, ['wit'], ctx({ card: card(1, '♠', 5) }), params)
    expect(notTriggered.value).toBe(100)
  })

  test('courage: コンボ数×xで倍算し、内訳に「勇気×倍率」が入る', () => {
    const result = applyItemEffects('gained', 100, ['courage'], ctx({ combo: 5 }), params)
    const factor = 1 + 5 * params.talismans.courage.x
    expect(result.value).toBe(100 * factor)
    expect(result.parts).toEqual([`勇気×${factor}`])
  })

  test('daybreak: コンボ数がc以下の時のみx倍', () => {
    const triggered = applyItemEffects('gained', 100, ['daybreak'], ctx({ combo: params.talismans.daybreak.c }), params)
    expect(triggered.value).toBe(100 * params.talismans.daybreak.x)
    const notTriggered = applyItemEffects('gained', 100, ['daybreak'], ctx({ combo: params.talismans.daybreak.c + 1 }), params)
    expect(notTriggered.value).toBe(100)
  })

  test('twilight: コンボ数がc以上の時のみx倍', () => {
    const triggered = applyItemEffects('gained', 100, ['twilight'], ctx({ combo: params.talismans.twilight.c }), params)
    expect(triggered.value).toBe(100 * params.talismans.twilight.x)
    const notTriggered = applyItemEffects('gained', 100, ['twilight'], ctx({ combo: params.talismans.twilight.c - 1 }), params)
    expect(notTriggered.value).toBe(100)
  })

  test('cheerful: コンボ数が偶数の時のみnを加算', () => {
    const triggered = applyItemEffects('gained', 100, ['cheerful'], ctx({ combo: 4 }), params)
    expect(triggered.value).toBe(100 + params.talismans.cheerful.n)
    const notTriggered = applyItemEffects('gained', 100, ['cheerful'], ctx({ combo: 5 }), params)
    expect(notTriggered.value).toBe(100)
  })

  test('conscience: コンボ数が奇数の時のみnを加算', () => {
    const triggered = applyItemEffects('gained', 100, ['conscience'], ctx({ combo: 5 }), params)
    expect(triggered.value).toBe(100 + params.talismans.conscience.n)
    const notTriggered = applyItemEffects('gained', 100, ['conscience'], ctx({ combo: 4 }), params)
    expect(notTriggered.value).toBe(100)
  })

  test('morningMist: コンボ数がc未満なら1/x倍、c以上ならx倍で、内訳に「朝霧×倍率」が入る', () => {
    const below = applyItemEffects('gained', 100, ['morningMist'], ctx({ combo: params.talismans.morningMist.c - 1 }), params)
    const belowFactor = 1 / params.talismans.morningMist.x
    expect(below.value).toBe(100 * belowFactor)
    expect(below.parts).toEqual([`朝霧×${Math.round(belowFactor * 100) / 100}`])
    const aboveOrEqual = applyItemEffects('gained', 100, ['morningMist'], ctx({ combo: params.talismans.morningMist.c }), params)
    expect(aboveOrEqual.value).toBe(100 * params.talismans.morningMist.x)
    expect(aboveOrEqual.parts).toEqual([`朝霧×${params.talismans.morningMist.x}`])
  })

  test('複数護符は所持順(配列順)に適用され、内訳もその順で並ぶ(加算→倍算と倍算→加算で結果が変わることを確認)', () => {
    const order1 = applyItemEffects('clearBonus', 1000, ['purify', 'temperance'], ctx({ stockRemaining: 4 }), params)
    const order2 = applyItemEffects('clearBonus', 1000, ['temperance', 'purify'], ctx({ stockRemaining: 4 }), params)
    expect(order1.value).not.toBe(order2.value)
    expect(order1.value).toBe((1000 + params.talismans.purify.n) * (1 + 4 * params.talismans.temperance.x))
    expect(order2.value).toBe(1000 * (1 + 4 * params.talismans.temperance.x) + params.talismans.purify.n)
    expect(order1.parts).toEqual([`浄化+${params.talismans.purify.n}`, `節制×${1 + 4 * params.talismans.temperance.x}`])
    expect(order2.parts).toEqual([`節制×${1 + 4 * params.talismans.temperance.x}`, `浄化+${params.talismans.purify.n}`])
  })

  test('gainedチャンネルの護符はclearBonusチャンネル計算には適用されない', () => {
    const result = applyItemEffects('clearBonus', 1000, ['springBreeze'], ctx({ card: card(1, '♣', 5) }), params)
    expect(result.value).toBe(1000)
    expect(result.parts).toEqual([])
  })
})

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

describe('applyItemEffects (グループ5: 場札残数系)', () => {
  const params = DEFAULT_PARAMS

  test('兆し: 場札残数がm以下なら倍算、超えていれば不発動', () => {
    const fired = applyItemEffects('gained', 100, ['omen'], ctx({ remainingTableauCount: params.talismans.omen.m }), params)
    expect(fired.value).toBe(100 * params.talismans.omen.x)
    const notFired = applyItemEffects('gained', 100, ['omen'], ctx({ remainingTableauCount: params.talismans.omen.m + 1 }), params)
    expect(notFired.value).toBe(100)
  })

  test('三日月: 場札残数がm以下なら倍算', () => {
    const result = applyItemEffects('gained', 100, ['crescent'], ctx({ remainingTableauCount: params.talismans.crescent.m }), params)
    expect(result.value).toBe(100 * params.talismans.crescent.x)
  })
})

describe('applyItemEffects (グループ6: 役・パターン成立状況系)', () => {
  const params = DEFAULT_PARAMS

  test('恩寵: いずれかの役ボーナスが成立していれば倍算', () => {
    const chainBonus = { bonus: 0, parts: [], patternFired: false, patternFiredCount: 0, roleFired: [{ name: 'flush' as const, usedWild: false, amount: 0 }] }
    const fired = applyItemEffects('gained', 100, ['blessing'], ctx({ chainBonus }), params)
    expect(fired.value).toBe(100 * params.talismans.blessing.x)
    const notFired = applyItemEffects('gained', 100, ['blessing'], ctx(), params)
    expect(notFired.value).toBe(100)
  })

  test('集中: 同ランクによる役が含まれていれば倍算', () => {
    const chainBonus = { bonus: 0, parts: [], patternFired: false, patternFiredCount: 0, roleFired: [{ name: 'sameRank' as const, usedWild: false, amount: 0 }] }
    const fired = applyItemEffects('gained', 100, ['focus'], ctx({ chainBonus }), params)
    expect(fired.value).toBe(100 * params.talismans.focus.x)
    const otherRole = { bonus: 0, parts: [], patternFired: false, patternFiredCount: 0, roleFired: [{ name: 'flush' as const, usedWild: false, amount: 0 }] }
    const notFired = applyItemEffects('gained', 100, ['focus'], ctx({ chainBonus: otherRole }), params)
    expect(notFired.value).toBe(100)
  })

  test('瑠璃: 役ボーナス2種類以上の同時発生でも倍算(従来の役のみパターンでも成立)', () => {
    const chainBonus = {
      bonus: 0, parts: [], patternFired: false, patternFiredCount: 0,
      roleFired: [{ name: 'flush' as const, usedWild: false, amount: 0 }, { name: 'sameRank' as const, usedWild: false, amount: 0 }],
    }
    const fired = applyItemEffects('gained', 100, ['lapis'], ctx({ chainBonus }), params)
    expect(fired.value).toBe(100 * params.talismans.lapis.x)
  })

  test('瑠璃: 役ボーナス1種類のみでは発動しない', () => {
    const singleRole = { bonus: 0, parts: [], patternFired: false, patternFiredCount: 0, roleFired: [{ name: 'flush' as const, usedWild: false, amount: 0 }] }
    const notFired = applyItemEffects('gained', 100, ['lapis'], ctx({ chainBonus: singleRole }), params)
    expect(notFired.value).toBe(100)
  })

  test('瑠璃: 役ボーナス1種類+パターンボーナス1種類の組み合わせでも倍算', () => {
    const roleAndPattern = {
      bonus: 0, parts: [], patternFired: true, patternFiredCount: 1,
      roleFired: [{ name: 'flush' as const, usedWild: false, amount: 0 }],
    }
    const fired = applyItemEffects('gained', 100, ['lapis'], ctx({ chainBonus: roleAndPattern }), params)
    expect(fired.value).toBe(100 * params.talismans.lapis.x)
  })

  test('瑠璃: パターンボーナス2種類(同スート+階段)の組み合わせのみでも倍算', () => {
    const bothPatterns = { bonus: 0, parts: [], patternFired: true, patternFiredCount: 2, roleFired: [] }
    const fired = applyItemEffects('gained', 100, ['lapis'], ctx({ chainBonus: bothPatterns }), params)
    expect(fired.value).toBe(100 * params.talismans.lapis.x)
  })

  test('瑠璃: パターンボーナス1種類のみでは発動しない', () => {
    const singlePattern = { bonus: 0, parts: [], patternFired: true, patternFiredCount: 1, roleFired: [] }
    const notFired = applyItemEffects('gained', 100, ['lapis'], ctx({ chainBonus: singlePattern }), params)
    expect(notFired.value).toBe(100)
  })

  test('翡翠: 役の成立にワイルドが使われていれば加算', () => {
    const chainBonus = { bonus: 0, parts: [], patternFired: false, patternFiredCount: 0, roleFired: [{ name: 'flush' as const, usedWild: true, amount: 0 }] }
    const fired = applyItemEffects('gained', 100, ['jade'], ctx({ chainBonus }), params)
    expect(fired.value).toBe(100 + params.talismans.jade.n)
    const withoutWild = { bonus: 0, parts: [], patternFired: false, patternFiredCount: 0, roleFired: [{ name: 'flush' as const, usedWild: false, amount: 0 }] }
    const notFired = applyItemEffects('gained', 100, ['jade'], ctx({ chainBonus: withoutWild }), params)
    expect(notFired.value).toBe(100)
  })

  test('無心: 役もパターンも無ければ倍算', () => {
    const fired = applyItemEffects('gained', 100, ['emptyMind'], ctx(), params)
    expect(fired.value).toBe(100 * params.talismans.emptyMind.x)
    const withPattern = { bonus: 0, parts: [], patternFired: true, patternFiredCount: 1, roleFired: [] }
    const notFired = applyItemEffects('gained', 100, ['emptyMind'], ctx({ chainBonus: withPattern }), params)
    expect(notFired.value).toBe(100)
  })
})

describe('applyItemEffects (グループ7: コンボ内位置系)', () => {
  const params = DEFAULT_PARAMS

  test('序章: プレイでチェーン内1枚目の時のみ加算', () => {
    const fired = applyItemEffects('gained', 100, ['prologue'], ctx({ playCountInChain: 1 }), params)
    expect(fired.value).toBe(100 + params.talismans.prologue.n)
    const notFired = applyItemEffects('gained', 100, ['prologue'], ctx({ playCountInChain: 2 }), params)
    expect(notFired.value).toBe(100)
  })

  test('序章: プレイでなければ(山札めくり)チェーン内1枚目相当でも加算しない', () => {
    const notFired = applyItemEffects('gained', 100, ['prologue'], ctx({ isPlayAction: false, playCountInChain: 1 }), params)
    expect(notFired.value).toBe(100)
  })

  test('ctxはisPlayAction・playCountInChainを受け付ける(型の確認)', () => {
    const playCtx = ctx({ isPlayAction: true, playCountInChain: 3 })
    expect(playCtx.isPlayAction).toBe(true)
    expect(playCtx.playCountInChain).toBe(3)
    const drawCtx = ctx({ isPlayAction: false, playCountInChain: 0 })
    expect(drawCtx.isPlayAction).toBe(false)
    expect(drawCtx.playCountInChain).toBe(0)
  })

  test('幕間: プレイでチェーン内ちょうどm枚目の時のみ加算', () => {
    const m = params.talismans.interlude.m
    const fired = applyItemEffects('gained', 100, ['interlude'], ctx({ playCountInChain: m }), params)
    expect(fired.value).toBe(100 + params.talismans.interlude.n)
    const notFired = applyItemEffects('gained', 100, ['interlude'], ctx({ playCountInChain: m * 2 }), params)
    expect(notFired.value).toBe(100)
  })

  test('幕間: プレイでなければ(山札めくり)m枚目相当でも加算しない', () => {
    const m = params.talismans.interlude.m
    const notFired = applyItemEffects('gained', 100, ['interlude'], ctx({ isPlayAction: false, playCountInChain: m }), params)
    expect(notFired.value).toBe(100)
  })

  test('朝露: ウェーブで最初にプレイしたカードのみ加算', () => {
    const fired = applyItemEffects('gained', 100, ['morningDew'], ctx({ isFirstPlayOfWave: true }), params)
    expect(fired.value).toBe(100 + params.talismans.morningDew.n)
    const notFired = applyItemEffects('gained', 100, ['morningDew'], ctx({ isFirstPlayOfWave: false }), params)
    expect(notFired.value).toBe(100)
  })
})

describe('applyItemEffects (グループ8: 無条件固定加算)', () => {
  const params = DEFAULT_PARAMS

  test('小雨: 常にn点加算', () => {
    const result = applyItemEffects('gained', 100, ['drizzle'], ctx(), params)
    expect(result.value).toBe(100 + params.talismans.drizzle.n)
  })
})

describe('applyItemEffects (グループ9: 列選択の連続性)', () => {
  const params = DEFAULT_PARAMS

  test('微風: 同一列連続2回目以降のみ、連続回数×nを加算', () => {
    const notFired = applyItemEffects('gained', 100, ['gentleBreeze'], ctx({ sameColumnStreak: 1 }), params)
    expect(notFired.value).toBe(100)
    const fired = applyItemEffects('gained', 100, ['gentleBreeze'], ctx({ sameColumnStreak: 3 }), params)
    expect(fired.value).toBe(100 + 3 * params.talismans.gentleBreeze.n)
  })

  test('共鳴: 同一列連続2回目以降のみ、連続回数×xで倍算', () => {
    const notFired = applyItemEffects('gained', 100, ['resonance'], ctx({ sameColumnStreak: 1 }), params)
    expect(notFired.value).toBe(100)
    const fired = applyItemEffects('gained', 100, ['resonance'], ctx({ sameColumnStreak: 3 }), params)
    expect(fired.value).toBe(100 * (1 + 3 * params.talismans.resonance.x))
  })
})

describe('applyItemEffects (グループ10: ウェーブ内累積state)', () => {
  const params = DEFAULT_PARAMS

  test('蒼穹: ウェーブ内列一掃累計回数×xで倍算', () => {
    const result = applyItemEffects('gained', 100, ['azureSky'], ctx({ totalColumnsEmptiedThisWave: 4 }), params)
    expect(result.value).toBe(100 * (1 + 4 * params.talismans.azureSky.x))
  })

  test('琥珀: ウェーブ内最大到達コンボ数×xで倍算', () => {
    const result = applyItemEffects('gained', 100, ['amber'], ctx({ maxComboThisWave: 8 }), params)
    expect(result.value).toBe(100 * (1 + 8 * params.talismans.amber.x))
  })
})

describe('applyItemEffects (グループ16: 持続効果)', () => {
  const params = DEFAULT_PARAMS

  test('情熱: フラッシュ成立中フラグが立っていれば倍算', () => {
    const fired = applyItemEffects('gained', 100, ['passion'], ctx({ flushActiveThisCombo: true }), params)
    expect(fired.value).toBe(100 * params.talismans.passion.x)
    const notFired = applyItemEffects('gained', 100, ['passion'], ctx({ flushActiveThisCombo: false }), params)
    expect(notFired.value).toBe(100)
  })

  test('闘志: 列一掃発生済みフラグが立っていれば倍算', () => {
    const fired = applyItemEffects('gained', 100, ['fightingSpirit'], ctx({ columnSweepActiveThisWave: true }), params)
    expect(fired.value).toBe(100 * params.talismans.fightingSpirit.x)
    const notFired = applyItemEffects('gained', 100, ['fightingSpirit'], ctx({ columnSweepActiveThisWave: false }), params)
    expect(notFired.value).toBe(100)
  })

  test('慈悲: mercyActiveNextComboが立っていれば倍算', () => {
    const fired = applyItemEffects('gained', 100, ['mercy'], ctx({ mercyActiveNextCombo: true }), params)
    expect(fired.value).toBe(100 * params.talismans.mercy.x)
    const notFired = applyItemEffects('gained', 100, ['mercy'], ctx({ mercyActiveNextCombo: false }), params)
    expect(notFired.value).toBe(100)
  })
})

describe('applyItemEffects (グループ12: 直感)', () => {
  const params = DEFAULT_PARAMS

  test('直感: drawContinueCountThisChainが0より大きい時のみ、その回数×xで倍算', () => {
    const notFired = applyItemEffects('gained', 100, ['intuition'], ctx({ drawContinueCountThisChain: 0 }), params)
    expect(notFired.value).toBe(100)
    const fired = applyItemEffects('gained', 100, ['intuition'], ctx({ drawContinueCountThisChain: 3 }), params)
    expect(fired.value).toBe(100 * (1 + 3 * params.talismans.intuition.x))
  })
})

describe('applyItemEffects (グループ17: 刻限)', () => {
  const params = DEFAULT_PARAMS

  test('刻限: 山札残り枚数×nを加算', () => {
    const notFired = applyItemEffects('gained', 100, ['deadline'], ctx({ stockRemaining: 0 }), params)
    expect(notFired.value).toBe(100)
    const fired = applyItemEffects('gained', 100, ['deadline'], ctx({ stockRemaining: 5 }), params)
    expect(fired.value).toBe(100 + 5 * params.talismans.deadline.n)
  })
})
