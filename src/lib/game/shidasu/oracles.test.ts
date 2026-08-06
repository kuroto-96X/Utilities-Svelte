import { describe, test, expect } from 'vitest'
import { rollOracleOffer, ORACLE_POOL } from './oracles'
import { createRng } from './deck'

describe('rollOracleOffer', () => {
  test('デフォルトで3件返す', () => {
    const offer = rollOracleOffer(createRng(1))
    expect(offer).toHaveLength(3)
    expect(new Set(offer).size).toBe(3)
    offer.forEach(id => expect(ORACLE_POOL).toContain(id))
  })

  test('ORACLE_POOLは10種類(ペア・交互を含む)', () => {
    expect(ORACLE_POOL).toHaveLength(10)
    expect(ORACLE_POOL).toContain('pair')
    expect(ORACLE_POOL).toContain('alternating')
  })

  test('countを指定すればその件数まで返す(神託は3-1/5-1パックのみ、5まで)', () => {
    const offer = rollOracleOffer(createRng(1), 5)
    expect(offer).toHaveLength(5)
    expect(new Set(offer).size).toBe(5)
  })
})
