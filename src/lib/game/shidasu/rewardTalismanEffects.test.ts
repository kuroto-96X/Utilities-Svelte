import { describe, test, expect } from 'vitest'
import { DEFAULT_PARAMS } from './params'
import { resolvePlayTriggeredRewardTalismans, type PlayTriggerContext } from './rewardTalismanEffects'
import type { Card } from './types'

const card = (suit: Card['suit'], rank: Card['rank'], wild = false): Card => ({ id: 1, deckId: 1, suit, rank, wild })

function baseCtx(overrides: Partial<PlayTriggerContext> = {}): PlayTriggerContext {
  return {
    card: card('♠', 5),
    chain: [card('♠', 5)],
    comboBefore: 0,
    comboAfter: 1,
    remainingTableauCountBefore: 10,
    remainingTableauCountAfter: 9,
    roleFired: [],
    sweepQualifies: false,
    sameColumnStreak: 1,
    ...overrides,
  }
}

describe('resolvePlayTriggeredRewardTalismans', () => {
  test('小判: コンボがcに到達した瞬間のみtriggeredIdsに含む', () => {
    const ctx = baseCtx({ comboBefore: 2, comboAfter: 3 })
    const result = resolvePlayTriggeredRewardTalismans(DEFAULT_PARAMS, ['koban'], ctx)
    expect(result.triggeredIds).toContain('koban')
  })

  test('小判: コンボがc以上のまま推移した場合は再発動しない', () => {
    const ctx = baseCtx({ comboBefore: 3, comboAfter: 4 })
    const result = resolvePlayTriggeredRewardTalismans(DEFAULT_PARAMS, ['koban'], ctx)
    expect(result.triggeredIds).not.toContain('koban')
  })

  test('豊作: 全消し達成時のみtriggeredIdsに含む', () => {
    const ctx = baseCtx({ remainingTableauCountAfter: 0 })
    const result = resolvePlayTriggeredRewardTalismans(DEFAULT_PARAMS, ['harvest'], ctx)
    expect(result.triggeredIds).toContain('harvest')
  })

  test('秘宝: ♠のAをプレイしたときのみtriggeredIdsに含む', () => {
    const ctx = baseCtx({ card: card('♠', 1) })
    const result = resolvePlayTriggeredRewardTalismans(DEFAULT_PARAMS, ['hiddenTreasure'], ctx)
    expect(result.triggeredIds).toContain('hiddenTreasure')
  })

  test('秘宝: ♠以外のAではtriggeredIdsに含まない', () => {
    const ctx = baseCtx({ card: card('♥', 1) })
    const result = resolvePlayTriggeredRewardTalismans(DEFAULT_PARAMS, ['hiddenTreasure'], ctx)
    expect(result.triggeredIds).not.toContain('hiddenTreasure')
  })

  test('好況: roleFiredにflushが含まれるときtriggeredIdsに含む', () => {
    const ctx = baseCtx({ roleFired: [{ name: 'flush', usedWild: false, amount: 10 }] })
    const result = resolvePlayTriggeredRewardTalismans(DEFAULT_PARAMS, ['boom'], ctx)
    expect(result.triggeredIds).toContain('boom')
  })

  test('潤沢: 場札残数がm超からm以下へ変化した瞬間のみtriggeredIdsに含む', () => {
    const ctx = baseCtx({ remainingTableauCountBefore: 11, remainingTableauCountAfter: 10 })
    const result = resolvePlayTriggeredRewardTalismans(DEFAULT_PARAMS, ['abundantFunds'], ctx)
    expect(result.triggeredIds).toContain('abundantFunds')
  })

  test('蓄財: 連続回数-1に応じたsellBonus加算量をamountsに返す', () => {
    const ctx = baseCtx({ sameColumnStreak: 3 })
    const result = resolvePlayTriggeredRewardTalismans(DEFAULT_PARAMS, ['savings'], ctx)
    expect(result.amounts.savings).toBe((3 - 1) * DEFAULT_PARAMS.talismans.savings.n)
  })

  test('蓄財: 連続回数1(初回)ではtriggeredIdsに含まない', () => {
    const ctx = baseCtx({ sameColumnStreak: 1 })
    const result = resolvePlayTriggeredRewardTalismans(DEFAULT_PARAMS, ['savings'], ctx)
    expect(result.triggeredIds).not.toContain('savings')
  })

  test('大漁: 列一掃成立時のみtriggeredIdsに含む', () => {
    const ctx = baseCtx({ sweepQualifies: true })
    const result = resolvePlayTriggeredRewardTalismans(DEFAULT_PARAMS, ['bigCatch'], ctx)
    expect(result.triggeredIds).toContain('bigCatch')
  })

  test('五穀: ワイルドをプレイしたときのみtriggeredIdsに含む', () => {
    const ctx = baseCtx({ card: card('★', 0, true) })
    const result = resolvePlayTriggeredRewardTalismans(DEFAULT_PARAMS, ['grains'], ctx)
    expect(result.triggeredIds).toContain('grains')
  })

  test('活況: 同スート成立かつチェーン長m以上でtriggeredIdsに含む', () => {
    const chain = Array.from({ length: 6 }, (_, i) => card('♠', ((i % 13) + 1) as Card['rank']))
    const ctx = baseCtx({ chain })
    const result = resolvePlayTriggeredRewardTalismans(DEFAULT_PARAMS, ['liveliness'], ctx)
    expect(result.triggeredIds).toContain('liveliness')
  })

  test('活況: チェーン長がm未満ならtriggeredIdsに含まない', () => {
    const chain = [card('♠', 1), card('♠', 2)]
    const ctx = baseCtx({ chain })
    const result = resolvePlayTriggeredRewardTalismans(DEFAULT_PARAMS, ['liveliness'], ctx)
    expect(result.triggeredIds).not.toContain('liveliness')
  })

  test('天恵: 階段成立かつ長さm以上でtriggeredIdsに含む', () => {
    const chain = Array.from({ length: 6 }, (_, i) => card('♠', (i + 1) as Card['rank']))
    const ctx = baseCtx({ chain })
    const result = resolvePlayTriggeredRewardTalismans(DEFAULT_PARAMS, ['heavenlyBlessing'], ctx)
    expect(result.triggeredIds).toContain('heavenlyBlessing')
  })

  test('瑞穂: 交互成立(minLen=m)でtriggeredIdsに含む', () => {
    const chain = [card('♠', 1), card('♥', 2), card('♣', 3), card('♦', 4), card('♠', 5), card('♥', 6)]
    const ctx = baseCtx({ chain })
    const result = resolvePlayTriggeredRewardTalismans(DEFAULT_PARAMS, ['mizuho'], ctx)
    expect(result.triggeredIds).toContain('mizuho')
  })

  test('利得: roleFiredにsameRankが含まれるときtriggeredIdsに含む', () => {
    const ctx = baseCtx({ roleFired: [{ name: 'sameRank', usedWild: false, amount: 5 }] })
    const result = resolvePlayTriggeredRewardTalismans(DEFAULT_PARAMS, ['profit'], ctx)
    expect(result.triggeredIds).toContain('profit')
  })

  test('役得: roleFiredにpairが含まれるときtriggeredIdsに含む', () => {
    const ctx = baseCtx({ roleFired: [{ name: 'pair', usedWild: false, amount: 5 }] })
    const result = resolvePlayTriggeredRewardTalismans(DEFAULT_PARAMS, ['perk'], ctx)
    expect(result.triggeredIds).toContain('perk')
  })

  test('複数護符が同時に条件を満たす場合、全てtriggeredIdsに含む', () => {
    const ctx = baseCtx({ card: card('♠', 1), remainingTableauCountAfter: 0 })
    const result = resolvePlayTriggeredRewardTalismans(DEFAULT_PARAMS, ['hiddenTreasure', 'harvest'], ctx)
    expect(result.triggeredIds).toEqual(expect.arrayContaining(['hiddenTreasure', 'harvest']))
  })
})
