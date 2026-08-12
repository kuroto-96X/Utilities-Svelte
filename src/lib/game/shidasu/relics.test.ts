// src/lib/game/shidasu/relics.test.ts
import { describe, test, expect } from 'vitest'
import { RELIC_POOL, relicName, relicDesc, relicTsukumokaDesc } from './relics'
import { DEFAULT_PARAMS } from './params'

describe('relics', () => {
  test('RELIC_POOLはplaceholderのみを含む', () => {
    expect(RELIC_POOL).toEqual(['placeholder'])
  })

  test('relicName/relicDesc/relicTsukumokaDescはparams.relicsを参照する', () => {
    expect(relicName('placeholder', DEFAULT_PARAMS)).toBe(DEFAULT_PARAMS.relics.placeholder.name)
    expect(relicDesc('placeholder', DEFAULT_PARAMS)).toBe(DEFAULT_PARAMS.relics.placeholder.desc)
    expect(relicTsukumokaDesc('placeholder', DEFAULT_PARAMS)).toBe(DEFAULT_PARAMS.relics.placeholder.tsukumokaDesc)
  })
})
