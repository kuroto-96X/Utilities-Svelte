import { describe, test, expect } from 'vitest'
import { easyWords, pickQuestions, generatePool } from './words'

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
  test('GeneratedQuestion の reading は wordGroups の reading/text を結合したものと一致する', () => {
    const { questions } = generatePool(10, 42)
    for (const q of questions) {
      const reconstructed = q.wordGroups.flat()
        .map((p) => (p.type === 'ruby' ? p.reading : p.text))
        .join('')
      expect(reconstructed).toBe(q.reading)
    }
  })

  test('reading はひらがなのみ', () => {
    const { questions } = generatePool(30, 123)
    for (const q of questions) {
      expect(/^[ぁ-ん]+$/.test(q.reading)).toBe(true)
    }
  })

  test('同じシードで同じ reading が生成される', () => {
    const { questions: a } = generatePool(10, 999)
    const { questions: b } = generatePool(10, 999)
    expect(a.map((q) => q.reading)).toEqual(b.map((q) => q.reading))
  })

  test('異なるシードで異なる reading が生成される', () => {
    const { questions: a } = generatePool(10, 1)
    const { questions: b } = generatePool(10, 2)
    expect(a.map((q) => q.reading)).not.toEqual(b.map((q) => q.reading))
  })

  test('seed を省略するとランダムに生成され戻り値に seed が含まれる', () => {
    const { questions, seed } = generatePool(5)
    expect(seed).toBeGreaterThanOrEqual(0)
    expect(seed).toBeLessThanOrEqual(0xffffffff)
    expect(questions.length).toBeGreaterThan(0)
  })

  test('重複する reading が含まれない', () => {
    const { questions } = generatePool(50, 777)
    const readings = questions.map((q) => q.reading)
    expect(new Set(readings).size).toBe(readings.length)
  })

  test('pickQuestions は GeneratedQuestion[] に対しても動作する', () => {
    const { questions } = generatePool(100, 42)
    const picked = pickQuestions(questions, 5)
    expect(picked).toHaveLength(5)
    for (const q of picked) {
      expect(q.reading).toBeTruthy()
      expect(q.wordGroups.length).toBeGreaterThan(0)
    }
  })

  test('questions の数が要求した count を超えない', () => {
    const count = 10
    const { questions } = generatePool(count, 42)
    expect(questions.length).toBeLessThanOrEqual(count)
  })
})
