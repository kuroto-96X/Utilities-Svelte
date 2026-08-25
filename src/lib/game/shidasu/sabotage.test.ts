import { describe, it, expect } from 'vitest'
import { SABOTAGE_POOL, eligibleSabotageIds, rollSabotage } from './sabotage'
import { DEFAULT_PARAMS } from './params'

describe('SABOTAGE_POOL', () => {
  it('32件・ID重複無し・intervalTurnsが全て正の整数', () => {
    expect(SABOTAGE_POOL).toHaveLength(32)
    expect(new Set(SABOTAGE_POOL).size).toBe(32)
    for (const id of SABOTAGE_POOL) {
      expect(Number.isInteger(DEFAULT_PARAMS.sabotageActions[id].intervalTurns)).toBe(true)
      expect(DEFAULT_PARAMS.sabotageActions[id].intervalTurns).toBeGreaterThan(0)
    }
  })
})

describe('eligibleSabotageIds', () => {
  it('noneは空配列', () => {
    expect(eligibleSabotageIds({ kind: 'none' })).toEqual([])
  })
  it('allはSABOTAGE_POOL全件のID', () => {
    expect(eligibleSabotageIds({ kind: 'all' })).toEqual(SABOTAGE_POOL)
  })
  it('someは指定したIDのみ', () => {
    expect(eligibleSabotageIds({ kind: 'some', ids: ['stockPurge', 'comboBreather'] })).toEqual(['stockPurge', 'comboBreather'])
  })
})

describe('rollSabotage', () => {
  it('noneはpendingSabotageId: null, sabotageTurnsRemaining: 0', () => {
    const result = rollSabotage(DEFAULT_PARAMS, { kind: 'none' }, () => 0)
    expect(result).toEqual({ pendingSabotageId: null, sabotageTurnsRemaining: 0 })
  })
  it('allは候補の中から1つ選び、対応するintervalTurnsを設定する', () => {
    const result = rollSabotage(DEFAULT_PARAMS, { kind: 'all' }, () => 0)
    const expectedId = SABOTAGE_POOL[0]
    expect(result.pendingSabotageId).toBe(expectedId)
    expect(result.sabotageTurnsRemaining).toBe(DEFAULT_PARAMS.sabotageActions[expectedId].intervalTurns)
  })
})
