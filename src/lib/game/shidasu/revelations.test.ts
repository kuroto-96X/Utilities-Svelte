import { describe, test, expect } from 'vitest'
import { rollRevelationOffer, REVELATION_POOL } from './revelations'
import { createRng } from './deck'

describe('rollRevelationOffer', () => {
  test('デフォルトで3件返す', () => {
    const offer = rollRevelationOffer(createRng(1))
    expect(offer).toHaveLength(3)
    expect(new Set(offer).size).toBe(3)
    offer.forEach(id => expect(REVELATION_POOL).toContain(id))
  })

  test('countを指定すればその件数まで返す', () => {
    const offer = rollRevelationOffer(createRng(1), 7)
    expect(offer).toHaveLength(7)
    expect(new Set(offer).size).toBe(7)
  })

  test('プール(27種)を超えるcountを指定してもプール全件までしか返らない', () => {
    const offer = rollRevelationOffer(createRng(1), 30)
    expect(offer).toHaveLength(REVELATION_POOL.length)
  })
})
