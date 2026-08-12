// src/lib/game/shidasu/relics.test.ts
import { describe, test, it, expect } from 'vitest'
import { RELIC_POOL, relicName, relicDesc, relicTsukumokaDesc } from './relics'
import { DEFAULT_PARAMS } from './params'

describe('relics', () => {
  test('relicName/relicDesc/relicTsukumokaDescはparams.relicsを参照する', () => {
    expect(relicName('maneki-neko', DEFAULT_PARAMS)).toBe(DEFAULT_PARAMS.relics['maneki-neko'].name)
    expect(relicDesc('maneki-neko', DEFAULT_PARAMS)).toBe(DEFAULT_PARAMS.relics['maneki-neko'].desc)
    expect(relicTsukumokaDesc('maneki-neko', DEFAULT_PARAMS)).toBe(DEFAULT_PARAMS.relics['maneki-neko'].tsukumokaDesc)
  })
})

describe('RELIC_POOL(第1弾13候補)', () => {
  const expectedIds = [
    'maneki-neko', 'fuku-daruma', 'kumade', 'juzu',
    'maneki-hoteizo', 'hamaya', 'senbazuru', 'fukuzasa',
    'kaiun-kokeshi', 'engi-kozuchi', 'engi-suzu', 'senjafuda', 'soroban',
  ] as const

  it('13候補すべてがRELIC_POOLに含まれる(placeholderは除去済み)', () => {
    for (const id of expectedIds) {
      expect(RELIC_POOL).toContain(id)
    }
    expect(RELIC_POOL).not.toContain('placeholder')
    expect(RELIC_POOL).toHaveLength(13)
  })

  it('全13候補がparams.relicsに定義されている', () => {
    for (const id of expectedIds) {
      expect(DEFAULT_PARAMS.relics[id]).toBeDefined()
      expect(DEFAULT_PARAMS.relics[id].name.length).toBeGreaterThan(0)
      expect(DEFAULT_PARAMS.relics[id].price).toBeGreaterThan(0)
    }
  })
})
