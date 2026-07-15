import { describe, it, expect } from 'vitest'
import { ITEM_GROUPS } from './itemGroups'
import { ITEM_POOL } from '../../../lib/game/shidasu/engine'

describe('ITEM_GROUPS', () => {
  it('ITEM_POOLの全種類を過不足なく分類している', () => {
    const flattened = ITEM_GROUPS.flatMap(g => g.ids)
    expect(new Set(flattened)).toEqual(new Set(ITEM_POOL))
  })

  it('同じ護符が複数グループに重複していない', () => {
    const flattened = ITEM_GROUPS.flatMap(g => g.ids)
    expect(flattened.length).toBe(new Set(flattened).size)
  })

  it('件数がITEM_POOLと一致する', () => {
    const flattened = ITEM_GROUPS.flatMap(g => g.ids)
    expect(flattened.length).toBe(ITEM_POOL.length)
  })
})
