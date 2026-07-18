// src/lib/game/shidasu/itemEffects.test.ts
import { describe, test, expect } from 'vitest'
import { applyItemEffects } from './itemEffects'
import { DEFAULT_PARAMS } from './params'
import { card, ctx } from './testHelpers'

describe('applyItemEffects', () => {
  const params = DEFAULT_PARAMS

  test('未登録の護符は素通りし、内訳(parts)も空になる', () => {
    const result = applyItemEffects('gained', 100, ['bridge'], ctx(), params)
    expect(result.value).toBe(100)
    expect(result.parts).toEqual([])
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
