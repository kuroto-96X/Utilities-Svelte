import { describe, test, expect } from 'vitest'
import { DEFAULT_PARAMS, loadParams } from './params'
import shidasuConfigJson from './shidasu.config.json'

describe('DEFAULT_PARAMS', () => {
  test('レイアウトは7列5段', () => {
    expect(DEFAULT_PARAMS.layout).toEqual({ cols: 7, rows: 5 })
  })

  test('ステージが3つ、modifierが none/noLoop/faceLock の順で定義されている', () => {
    expect(DEFAULT_PARAMS.stages).toHaveLength(3)
    expect(DEFAULT_PARAMS.stages.map(s => s.modifier)).toEqual(['none', 'noLoop', 'faceLock'])
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
    expect(s.wildSuitBonus % 10).toBe(0)
    expect(s.clearBonus % 10).toBe(0)
    expect(s.clearBonusPerStock % 10).toBe(0)
    expect(s.flushBonus % 10).toBe(0)
    expect(s.royalSetBonus % 10).toBe(0)
    expect(s.sameRankBonusUnit % 10).toBe(0)
    expect(s.completeRunBonus % 10).toBe(0)
    expect(s.completeRunSuitBonus % 10).toBe(0)
    expect(s.columnSweepBonus % 10).toBe(0)
    DEFAULT_PARAMS.stages.forEach(stage => {
      stage.targets.forEach(t => expect(t % 10).toBe(0))
    })
  })

  test('comboMultiplierStepは0.1', () => {
    expect(DEFAULT_PARAMS.scoring.comboMultiplierStep).toBe(0.1)
  })
})

describe('loadParams', () => {
  test('shidasu.config.json の内容をそのまま返す', () => {
    expect(loadParams()).toEqual(shidasuConfigJson)
  })

  test('既定値と一致する(config.json が未編集の場合)', () => {
    expect(loadParams()).toEqual(DEFAULT_PARAMS)
  })
})
