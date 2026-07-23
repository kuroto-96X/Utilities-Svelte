// src/lib/game/shidasu/items.test.ts
import { describe, test, expect } from 'vitest'
import { rollItemOffer, ITEM_POOL, itemName, itemDesc } from './items'
import { DEFAULT_PARAMS } from './params'
import { createRng } from './deck'
import type { ItemId } from './types'

describe('rollItemOffer', () => {
  test('未所持のアイテムの中から最大3件返す(プール数が3件を超える場合)', () => {
    const offer = rollItemOffer([], createRng(1))
    expect(offer).toHaveLength(3)
    offer.forEach(id => expect(ITEM_POOL).toContain(id))
    expect(new Set(offer).size).toBe(3) // 重複なし
  })

  test('既に持っているアイテムは種類を問わず候補から除外される', () => {
    const owned = ITEM_POOL.slice(0, ITEM_POOL.length - 1) // 1個だけ未所持にする
    const remaining = ITEM_POOL[ITEM_POOL.length - 1]
    const offer = rollItemOffer(owned, createRng(1))
    expect(offer).toEqual([remaining])
  })

  test('全て持っていれば候補は空になる', () => {
    const offer = rollItemOffer([...ITEM_POOL], createRng(1))
    expect(offer).toEqual([])
  })

  test('countを指定すればその件数まで返す', () => {
    const offer = rollItemOffer([], createRng(1), 5)
    expect(offer).toHaveLength(5)
    expect(new Set(offer).size).toBe(5)
  })

  test('countを省略すれば従来通り3件になる', () => {
    const offer = rollItemOffer([], createRng(1))
    expect(offer).toHaveLength(3)
  })
})

describe('ITEM_POOL / itemName / itemDesc', () => {
  test('87種類のアイテムが定義されている', () => {
    expect(ITEM_POOL).toHaveLength(87)
    expect(new Set(ITEM_POOL).size).toBe(87) // 重複なし
    ITEM_POOL.forEach(id => expect(itemName(id, DEFAULT_PARAMS)).toBeTruthy())
  })

  test('グループ9〜16の残り20個も名前と説明文を持つ', () => {
    const newIds: ItemId[] = [
      'gentleBreeze', 'resonance',
      'azureSky', 'amber',
      'composure', 'clarity', 'arrogance', 'echo', 'shootingStar',
      'naive', 'intuition', 'sincerity',
      'promise', 'darkClouds', 'regeneration',
      'benevolence', 'healing',
      'guidance',
      'passion', 'fightingSpirit',
    ]
    expect(newIds).toHaveLength(20)
    newIds.forEach(id => {
      expect(itemName(id, DEFAULT_PARAMS)).toBeTruthy()
      expect(itemDesc(id, DEFAULT_PARAMS)).toBeTruthy()
    })
  })

  test('グループ17の8個も名前と説明文を持つ', () => {
    const newIds: ItemId[] = [
      'sanctify', 'protection', 'earth', 'golden',
      'morningStar', 'mercy', 'mirror', 'deadline',
    ]
    expect(newIds).toHaveLength(8)
    newIds.forEach(id => {
      expect(itemName(id, DEFAULT_PARAMS)).toBeTruthy()
      expect(itemDesc(id, DEFAULT_PARAMS)).toBeTruthy()
    })
  })

  test('itemDescはパラメータの数値を埋め込んだ説明文を返す', () => {
    expect(itemDesc('bridge', DEFAULT_PARAMS)).toContain(String(DEFAULT_PARAMS.talismans.bridge.m))
    expect(itemDesc('grace', DEFAULT_PARAMS)).toContain(String(DEFAULT_PARAMS.talismans.grace.m))
    expect(itemDesc('daybreak', DEFAULT_PARAMS)).toContain(String(DEFAULT_PARAMS.talismans.daybreak.c))
    expect(itemDesc('daybreak', DEFAULT_PARAMS)).toContain(String(DEFAULT_PARAMS.talismans.daybreak.x))
  })

  test('itemDescは未知のプレースホルダーがあってもクラッシュせずそのまま残す', () => {
    const params = JSON.parse(JSON.stringify(DEFAULT_PARAMS)) as typeof DEFAULT_PARAMS
    params.talismans.purify.desc = '全消しボーナスに{n}点を加算({typo}は置換されない)'
    expect(itemDesc('purify', params)).toBe(`全消しボーナスに${DEFAULT_PARAMS.talismans.purify.n}点を加算({typo}は置換されない)`)
  })

  test('新規追加した18個の護符も名前と説明文を持つ', () => {
    const newIds: ItemId[] = [
      'patience', 'purify', 'temperance',
      'springBreeze', 'summerBreeze', 'autumnBreeze', 'winterBreeze',
      'kinship', 'thaw', 'dusk', 'dawn', 'wit',
      'courage', 'daybreak', 'twilight', 'cheerful', 'conscience', 'morningMist',
    ]
    newIds.forEach(id => {
      expect(itemName(id, DEFAULT_PARAMS)).toBeTruthy()
      expect(itemDesc(id, DEFAULT_PARAMS)).toBeTruthy()
    })
  })

  test('新規追加した35個(グループ4〜8)の護符も名前と説明文を持つ', () => {
    const newIds: ItemId[] = [
      'calm', 'serenity', 'destiny', 'fate', 'relief',
      'verdantGreen', 'gem', 'resolve', 'grail', 'moonlight', 'sunlight',
      'crown', 'cloverLeaf', 'coin', 'blade', 'chalice', 'balance', 'harmony',
      'nobility', 'tenacity', 'determination', 'cycle', 'reincarnation', 'majesty',
      'omen', 'crescent',
      'blessing', 'focus', 'lapis', 'jade', 'emptyMind',
      'prologue', 'interlude', 'morningDew',
      'drizzle',
    ]
    expect(newIds).toHaveLength(35)
    newIds.forEach(id => {
      expect(itemName(id, DEFAULT_PARAMS)).toBeTruthy()
      expect(itemDesc(id, DEFAULT_PARAMS)).toBeTruthy()
    })
  })

  test('永劫・豊穣・静寂・不屈も名前と説明文を持つ', () => {
    const newIds: ItemId[] = ['eternity', 'abundance', 'silence', 'resilience']
    newIds.forEach(id => {
      expect(itemName(id, DEFAULT_PARAMS)).toBeTruthy()
      expect(itemDesc(id, DEFAULT_PARAMS)).toBeTruthy()
    })
  })

  test('bridge・grace・eternity・abundance・silenceもtalismansにnameエントリを持つ', () => {
    const ids: ItemId[] = ['bridge', 'grace', 'eternity', 'abundance', 'silence']
    ids.forEach(id => {
      expect(DEFAULT_PARAMS.talismans[id].name).toBeTruthy()
    })
  })
})
