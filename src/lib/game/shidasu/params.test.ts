import { describe, test, expect } from 'vitest'
import { DEFAULT_PARAMS, loadParams } from './params'
import shidasuConfigJson from './shidasu.config.json'

describe('DEFAULT_PARAMS', () => {
  test('レイアウトは7列5段', () => {
    expect(DEFAULT_PARAMS.layout).toEqual({ cols: 7, rows: 5 })
  })

  test('ui.comboTierThresholds は [3, 5, 8]', () => {
    expect(DEFAULT_PARAMS.ui.comboTierThresholds).toEqual([3, 5, 8])
  })

  test('点数系パラメータは10の倍数になっている', () => {
    const s = DEFAULT_PARAMS.scoring
    expect(s.basePoint % 10).toBe(0)
    expect(s.suitBonus % 10).toBe(0)
    expect(s.colorBonus % 10).toBe(0)
    expect(s.stairBonus % 10).toBe(0)
    expect(s.clearBonus % 10).toBe(0)
    expect(s.clearBonusPerStock % 10).toBe(0)
    expect(s.flushBonus % 10).toBe(0)
    expect(s.royalSetBonus % 10).toBe(0)
    expect(s.sameRankBonusUnit % 10).toBe(0)
    expect(s.completeRunBonus % 10).toBe(0)
    expect(s.completeRunSuitBonus % 10).toBe(0)
    expect(s.columnSweepBonus % 10).toBe(0)
  })

  test('comboMultiplierStepは0.1', () => {
    expect(DEFAULT_PARAMS.scoring.comboMultiplierStep).toBe(0.1)
  })

  test('月の目標スコア基礎値・倍率は愚者と全く同じ', () => {
    expect(DEFAULT_PARAMS.spreads.moon.waveTargetBase).toBe(DEFAULT_PARAMS.spreads.fool.waveTargetBase)
    expect(DEFAULT_PARAMS.spreads.moon.waveTargetMultiplier).toBe(DEFAULT_PARAMS.spreads.fool.waveTargetMultiplier)
  })

  test('月の初期行数オフセットは1、愚者は0', () => {
    expect(DEFAULT_PARAMS.spreads.fool.initialExtraTableauRows).toBe(0)
    expect(DEFAULT_PARAMS.spreads.moon.initialExtraTableauRows).toBe(1)
  })

  test('fool/moonのinitialOracleLevelは1、bannedShopKindsは空配列', () => {
    expect(DEFAULT_PARAMS.spreads.fool.initialOracleLevel).toBe(1)
    expect(DEFAULT_PARAMS.spreads.fool.bannedShopKinds).toEqual([])
    expect(DEFAULT_PARAMS.spreads.moon.initialOracleLevel).toBe(1)
    expect(DEFAULT_PARAMS.spreads.moon.bannedShopKinds).toEqual([])
  })

  test('fool/moon/popeのinitialCurrencyBonusは0、empressは10', () => {
    expect(DEFAULT_PARAMS.spreads.fool.initialCurrencyBonus).toBe(0)
    expect(DEFAULT_PARAMS.spreads.moon.initialCurrencyBonus).toBe(0)
    expect(DEFAULT_PARAMS.spreads.pope.initialCurrencyBonus).toBe(0)
    expect(DEFAULT_PARAMS.spreads.empress.initialCurrencyBonus).toBe(10)
  })

  test('empressの名称は女帝、初期行数オフセット・目標スコア・神託初期レベルは愚者と同じ', () => {
    expect(DEFAULT_PARAMS.spreads.empress.name).toBe('女帝')
    expect(DEFAULT_PARAMS.spreads.empress.initialExtraTableauRows).toBe(DEFAULT_PARAMS.spreads.fool.initialExtraTableauRows)
    expect(DEFAULT_PARAMS.spreads.empress.waveTargetBase).toBe(DEFAULT_PARAMS.spreads.fool.waveTargetBase)
    expect(DEFAULT_PARAMS.spreads.empress.waveTargetMultiplier).toBe(DEFAULT_PARAMS.spreads.fool.waveTargetMultiplier)
    expect(DEFAULT_PARAMS.spreads.empress.initialOracleLevel).toBe(DEFAULT_PARAMS.spreads.fool.initialOracleLevel)
    expect(DEFAULT_PARAMS.spreads.empress.bannedShopKinds).toEqual([])
  })

  test('fool/moon/pope/empressのinitialItemCapacityBonusは0、excludedRanksは空配列', () => {
    expect(DEFAULT_PARAMS.spreads.fool.initialItemCapacityBonus).toBe(0)
    expect(DEFAULT_PARAMS.spreads.fool.excludedRanks).toEqual([])
    expect(DEFAULT_PARAMS.spreads.moon.initialItemCapacityBonus).toBe(0)
    expect(DEFAULT_PARAMS.spreads.moon.excludedRanks).toEqual([])
    expect(DEFAULT_PARAMS.spreads.pope.initialItemCapacityBonus).toBe(0)
    expect(DEFAULT_PARAMS.spreads.pope.excludedRanks).toEqual([])
    expect(DEFAULT_PARAMS.spreads.empress.initialItemCapacityBonus).toBe(0)
    expect(DEFAULT_PARAMS.spreads.empress.excludedRanks).toEqual([])
  })

  test('magicianの名称は魔術師、initialItemCapacityBonusは1、initialExtraTableauRowsは-1', () => {
    expect(DEFAULT_PARAMS.spreads.magician.name).toBe('魔術師')
    expect(DEFAULT_PARAMS.spreads.magician.initialItemCapacityBonus).toBe(1)
    expect(DEFAULT_PARAMS.spreads.magician.initialExtraTableauRows).toBe(-1)
    expect(DEFAULT_PARAMS.spreads.magician.excludedRanks).toEqual([])
  })

  test('justiceの名称は正義、excludedRanksは[11, 12, 13]', () => {
    expect(DEFAULT_PARAMS.spreads.justice.name).toBe('正義')
    expect(DEFAULT_PARAMS.spreads.justice.excludedRanks).toEqual([11, 12, 13])
    expect(DEFAULT_PARAMS.spreads.justice.initialItemCapacityBonus).toBe(0)
    expect(DEFAULT_PARAMS.spreads.justice.initialExtraTableauRows).toBe(0)
  })

  test('方向性1の24護符がtalismansに定義されている', () => {
    const ids = ['exchange', 'koban', 'senryo', 'manryo', 'harvest', 'settlement', 'hiddenTreasure', 'greatestTreasure', 'heirloom', 'treasury', 'boom', 'abundantFunds', 'savings', 'bigCatch', 'grains', 'liveliness', 'prosperity', 'heavenlyBlessing', 'mizuho', 'bountifulYear', 'profit', 'bounty', 'perk', 'nestEgg'] as const
    for (const id of ids) {
      expect(DEFAULT_PARAMS.talismans[id]).toBeDefined()
      expect(typeof DEFAULT_PARAMS.talismans[id].name).toBe('string')
    }
  })

  test('方向性2の8護符がtalismansに定義されている', () => {
    const ids = ['dividend', 'prizeMoney', 'windfall', 'celebration', 'refund', 'bonus', 'commendation', 'favor'] as const
    for (const id of ids) {
      expect(DEFAULT_PARAMS.talismans[id]).toBeDefined()
      expect(typeof DEFAULT_PARAMS.talismans[id].name).toBe('string')
    }
  })

  test('Wave終了時報酬護符3件(活気・瑞祝・市況)がtalismansに定義されている', () => {
    const ids = ['vigor', 'zuishuku', 'marketTrend'] as const
    for (const id of ids) {
      expect(DEFAULT_PARAMS.talismans[id]).toBeDefined()
      expect(typeof DEFAULT_PARAMS.talismans[id].name).toBe('string')
    }
  })
})

describe('loadParams', () => {
  test('shidasu.config.json の内容をそのまま返す', () => {
    expect(loadParams()).toEqual(shidasuConfigJson)
  })
})
