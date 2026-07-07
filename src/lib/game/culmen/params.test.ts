// src/lib/game/culmen/params.test.ts
import { describe, test, expect } from 'vitest'
import { DEFAULT_PARAMS, loadParams } from './params'
import culmenConfigJson from './culmen.config.json'

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
})

describe('loadParams', () => {
  test('culmen.config.json の内容をそのまま返す', () => {
    expect(loadParams()).toEqual(culmenConfigJson)
  })

  test('既定値と一致する(config.json が未編集の場合)', () => {
    expect(loadParams()).toEqual(DEFAULT_PARAMS)
  })
})
