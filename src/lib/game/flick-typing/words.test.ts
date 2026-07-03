import { describe, test, expect } from 'vitest'
import { easyWords, hardSentences, pickQuestions, generatePool } from './words'

describe('easyWords', () => {
  test('60語以上ある', () => {
    expect(easyWords.length).toBeGreaterThanOrEqual(60)
  })

  test('すべてひらがなのみ（2〜5文字）', () => {
    const hiraganaOnly = /^[ぁ-ゖ]{2,5}$/
    easyWords.forEach(w => {
      expect(w).toMatch(hiraganaOnly)
    })
  })

  test('重複がない', () => {
    expect(new Set(easyWords).size).toBe(easyWords.length)
  })
})

describe('hardSentences', () => {
  test('40文以上ある', () => {
    expect(hardSentences.length).toBeGreaterThanOrEqual(40)
  })

  test('すべてひらがなのみ（10〜20文字）', () => {
    const hiraganaOnly = /^[ぁ-ゖ]{10,20}$/
    hardSentences.forEach(s => {
      expect(s).toMatch(hiraganaOnly)
    })
  })
})

describe('pickQuestions', () => {
  test('指定した件数を返す', () => {
    expect(pickQuestions(easyWords, 10)).toHaveLength(10)
  })

  test('重複がない', () => {
    const picked = pickQuestions(easyWords, 20)
    expect(new Set(picked).size).toBe(20)
  })

  test('プール内の語のみ返す', () => {
    const pool = ['あ', 'い', 'う', 'え', 'お']
    const picked = pickQuestions(pool, 3)
    picked.forEach(w => expect(pool).toContain(w))
  })

  test('count がプールより大きい場合はプール全体を返す', () => {
    const pool = ['あ', 'い', 'う']
    expect(pickQuestions(pool, 10)).toHaveLength(3)
  })

  test('元のプール配列を変更しない', () => {
    const pool = ['あ', 'い', 'う', 'え', 'お']
    const original = [...pool]
    pickQuestions(pool, 3)
    expect(pool).toEqual(original)
  })
})

describe('generatePool', () => {
  test('指定件数以下の文を生成する', () => {
    const { sentences } = generatePool(10, 42)
    expect(sentences.length).toBeGreaterThan(0)
    expect(sentences.length).toBeLessThanOrEqual(10)
  })

  test('同じシードは同じ結果を返す', () => {
    const { sentences: a } = generatePool(20, 12345)
    const { sentences: b } = generatePool(20, 12345)
    expect(a).toEqual(b)
  })

  test('異なるシードは異なる結果を返す', () => {
    const { sentences: a } = generatePool(20, 11111)
    const { sentences: b } = generatePool(20, 99999)
    expect(a).not.toEqual(b)
  })

  test('重複がない', () => {
    const { sentences } = generatePool(50, 42)
    expect(new Set(sentences).size).toBe(sentences.length)
  })

  test('指定したシードを返す', () => {
    const { seed } = generatePool(10, 99999)
    expect(seed).toBe(99999)
  })

  test('シードなしでも seed を返す', () => {
    const { seed } = generatePool(10)
    expect(typeof seed).toBe('number')
    expect(Number.isFinite(seed)).toBe(true)
  })

  test('すべてひらがなのみ', () => {
    const hiraganaOnly = /^[ぁ-ゖ]+$/
    const { sentences } = generatePool(100, 42)
    sentences.forEach(s => {
      expect(s).toMatch(hiraganaOnly)
    })
  })
})
