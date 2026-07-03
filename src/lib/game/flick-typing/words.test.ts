import { describe, test, expect } from 'vitest'
import { easyWords, hardSentences, pickQuestions } from './words'

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
