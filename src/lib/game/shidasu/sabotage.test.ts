import { describe, it, expect } from 'vitest'
import { SABOTAGE_POOL, eligibleSabotageIds, rollSabotage } from './sabotage'

describe('SABOTAGE_POOL', () => {
  it('32件・ID重複無し・intervalTurnsが全て正の整数', () => {
    expect(SABOTAGE_POOL).toHaveLength(32)
    const ids = SABOTAGE_POOL.map(a => a.id)
    expect(new Set(ids).size).toBe(32)
    for (const action of SABOTAGE_POOL) {
      expect(Number.isInteger(action.intervalTurns)).toBe(true)
      expect(action.intervalTurns).toBeGreaterThan(0)
    }
  })
})

describe('eligibleSabotageIds', () => {
  it('noneは空配列', () => {
    expect(eligibleSabotageIds({ kind: 'none' })).toEqual([])
  })
  it('allはSABOTAGE_POOL全件のID', () => {
    expect(eligibleSabotageIds({ kind: 'all' })).toEqual(SABOTAGE_POOL.map(a => a.id))
  })
  it('someは指定したIDのみ', () => {
    expect(eligibleSabotageIds({ kind: 'some', ids: ['stockPurge', 'comboBreather'] })).toEqual(['stockPurge', 'comboBreather'])
  })
})

describe('rollSabotage', () => {
  it('noneはpendingSabotageId: null, sabotageTurnsRemaining: 0', () => {
    const result = rollSabotage({ kind: 'none' }, () => 0)
    expect(result).toEqual({ pendingSabotageId: null, sabotageTurnsRemaining: 0 })
  })
  it('allは候補の中から1つ選び、対応するintervalTurnsを設定する', () => {
    const result = rollSabotage({ kind: 'all' }, () => 0)
    const expectedId = SABOTAGE_POOL[0].id
    expect(result.pendingSabotageId).toBe(expectedId)
    expect(result.sabotageTurnsRemaining).toBe(SABOTAGE_POOL[0].intervalTurns)
  })
})
