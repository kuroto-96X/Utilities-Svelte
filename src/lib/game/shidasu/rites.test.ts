// src/lib/game/shidasu/rites.test.ts
import { describe, test, expect } from 'vitest'
import { rollRiteOffer, RITE_POOL, rollRite } from './rites'
import { createRng } from './deck'

describe('rollRiteOffer', () => {
  test('デフォルトで3件返す(プールは24種あるため重複なし)', () => {
    const offer = rollRiteOffer(createRng(1))
    expect(offer).toHaveLength(3)
    expect(new Set(offer).size).toBe(3)
    offer.forEach(id => expect(RITE_POOL).toContain(id))
  })

  test('countを指定すればその件数まで返す', () => {
    const offer = rollRiteOffer(createRng(1), 7)
    expect(offer).toHaveLength(7)
    expect(new Set(offer).size).toBe(7)
    offer.forEach(id => expect(RITE_POOL).toContain(id))
  })
})

describe('rollRite(既存、後方互換確認)', () => {
  test('所持数が3未満なら1件返す', () => {
    const rite = rollRite([], createRng(1))
    expect(rite).not.toBeNull()
    expect(RITE_POOL).toContain(rite)
  })

  test('所持数が3以上ならnullを返す', () => {
    expect(rollRite(['raidho', 'jera', 'wunjo'], createRng(1))).toBeNull()
  })
})
