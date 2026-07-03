import { beforeEach, describe, test, expect, vi } from 'vitest'
import { getBest, saveBest, getHistory, addHistory, type PlayRecord } from './score'

// Node.js 環境に localStorage モックを注入する
const store: Record<string, string> = {}
vi.stubGlobal('localStorage', {
  getItem: (k: string) => store[k] ?? null,
  setItem: (k: string, v: string) => { store[k] = v },
  removeItem: (k: string) => { delete store[k] },
  clear: () => Object.keys(store).forEach(k => delete store[k]),
})

beforeEach(() => {
  Object.keys(store).forEach(k => delete store[k])
})

describe('getBest', () => {
  test('記録がない場合は null を返す', () => {
    expect(getBest('easy', 10)).toBeNull()
  })

  test('保存済みのタイムを返す', () => {
    saveBest('easy', 10, 38000)
    expect(getBest('easy', 10)).toBe(38000)
  })
})

describe('saveBest', () => {
  test('初回は true を返す', () => {
    expect(saveBest('easy', 10, 38000)).toBe(true)
  })

  test('既存より遅いタイムは false を返す', () => {
    saveBest('easy', 10, 38000)
    expect(saveBest('easy', 10, 42000)).toBe(false)
  })

  test('既存より速いタイムは true を返し上書きする', () => {
    saveBest('easy', 10, 38000)
    expect(saveBest('easy', 10, 35000)).toBe(true)
    expect(getBest('easy', 10)).toBe(35000)
  })

  test('難易度×問題数ごとに独立して保存される', () => {
    saveBest('easy', 10, 38000)
    saveBest('hard', 10, 55000)
    saveBest('easy', 5, 20000)
    expect(getBest('easy', 10)).toBe(38000)
    expect(getBest('hard', 10)).toBe(55000)
    expect(getBest('easy', 5)).toBe(20000)
    expect(getBest('hard', 5)).toBeNull()
  })
})

describe('getHistory', () => {
  test('履歴がない場合は [] を返す', () => {
    expect(getHistory()).toEqual([])
  })

  test('パースエラーの場合は [] を返す', () => {
    store['flick-typing:history'] = 'invalid json'
    expect(getHistory()).toEqual([])
  })
})

describe('addHistory', () => {
  test('記録を追加する', () => {
    const record: PlayRecord = {
      difficulty: 'easy',
      count: 10,
      timeMs: 38000,
      playedAt: 1000,
      isPersonalBest: true,
    }
    addHistory(record)
    expect(getHistory()).toEqual([record])
  })

  test('新しい記録が先頭に来る', () => {
    const r1: PlayRecord = {
      difficulty: 'easy',
      count: 5,
      timeMs: 20000,
      playedAt: 1000,
      isPersonalBest: false,
    }
    const r2: PlayRecord = {
      difficulty: 'hard',
      count: 10,
      timeMs: 55000,
      seed: 12345,
      playedAt: 2000,
      isPersonalBest: true,
    }
    addHistory(r1)
    addHistory(r2)
    const history = getHistory()
    expect(history[0]).toEqual(r2)
    expect(history[1]).toEqual(r1)
  })

  test('21件目以降は切り捨てる（上限20件）', () => {
    for (let i = 0; i < 21; i++) {
      addHistory({
        difficulty: 'easy',
        count: 10,
        timeMs: i * 1000,
        playedAt: i,
        isPersonalBest: false,
      })
    }
    expect(getHistory().length).toBe(20)
  })
})
