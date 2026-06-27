import { describe, it, expect } from 'vitest'
import { alignSelectColumns } from './alignFormatter'

describe('alignSelectColumns', () => {
  it('SELECT カラムの AS を同じ列に揃える', () => {
    const input = [
      'SELECT',
      '  id AS UserId,',
      '  user_name AS UserName,',
      '  email AS Email',
      'FROM users',
    ].join('\n')

    const result = alignSelectColumns(input)
    const colLines = result.split('\n').filter(l => /\bAS\b/.test(l) && /^\s/.test(l))
    const asPositions = colLines.map(l => l.indexOf(' AS '))
    expect(colLines.length).toBeGreaterThan(1)
    expect(asPositions.every(p => p === asPositions[0])).toBe(true)
  })

  it('SELECT 直後以外の AS は揃え対象にしない', () => {
    const input = [
      'SELECT',
      '  id AS UserId',
      'FROM users AS u',
      'WHERE id = :id',
    ].join('\n')
    const result = alignSelectColumns(input)
    // FROM 行はそのまま
    expect(result).toContain('FROM users AS u')
  })

  it('AS がないカラムリストはそのまま返す', () => {
    const input = 'SELECT\n  id,\n  name\nFROM users'
    expect(alignSelectColumns(input)).toBe(input)
  })

  it('SELECT 以外のキーワード行は変更しない', () => {
    const input = 'SELECT\n  id AS UserId\nFROM users\nWHERE id = :id'
    const result = alignSelectColumns(input)
    expect(result).toContain('FROM users')
    expect(result).toContain('WHERE id = :id')
  })

  it('補間なしの SQL はそのまま通過する', () => {
    const input = 'SELECT id FROM users'
    expect(alignSelectColumns(input)).toBe(input)
  })
})
