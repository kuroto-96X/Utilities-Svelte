import { describe, it, expect } from 'vitest'
import { scoreSql, scoreAndSort } from './sqlDetector'

describe('scoreSql', () => {
  it('空文字列は 0 を返す', () => expect(scoreSql('')).toBe(0))
  it('SQL でない文字列は 0 を返す', () => expect(scoreSql('hello world')).toBe(0))
  it('SELECT + FROM で 2 を返す', () => expect(scoreSql('SELECT id FROM users')).toBe(2))
  it('大文字小文字を無視する', () => expect(scoreSql('select id from users')).toBe(2))
  it('複数キーワードを合算する', () => {
    expect(scoreSql('SELECT id FROM users WHERE id = 1 ORDER BY id')).toBe(4)
  })
  it('RESET は SET とマッチしない（単語境界）', () => {
    expect(scoreSql('RESET QUERY CACHE')).toBe(0)
  })
  it('INSERT INTO を1スコアとして数える', () => {
    expect(scoreSql('INSERT INTO users VALUES (1)')).toBe(2) // INSERT INTO + VALUES
  })
})

describe('scoreAndSort', () => {
  it('sqlScore をセットしてスコア降順でソートする', () => {
    const candidates = [
      { id: '1', rawJoined: 'hello', sourceLineStart: 1, sourceLineEnd: 1, sqlScore: 0 },
      { id: '2', rawJoined: 'SELECT * FROM users', sourceLineStart: 2, sourceLineEnd: 2, sqlScore: 0 },
      { id: '3', rawJoined: 'SELECT id FROM t WHERE id = 1', sourceLineStart: 3, sourceLineEnd: 3, sqlScore: 0 },
    ]
    const result = scoreAndSort(candidates)
    expect(result[0].id).toBe('3')
    expect(result[1].id).toBe('2')
    expect(result[0].sqlScore).toBe(3)
    expect(result[1].sqlScore).toBe(2)
  })
})
