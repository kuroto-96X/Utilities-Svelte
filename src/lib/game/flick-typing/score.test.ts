import { beforeEach, describe, test, expect, vi } from 'vitest'
import { getBest, saveBest } from './score'

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
