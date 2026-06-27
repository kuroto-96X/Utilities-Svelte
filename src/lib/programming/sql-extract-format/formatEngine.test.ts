import { describe, it, expect } from 'vitest'
import { formatSql } from './formatEngine'

describe('formatSql', () => {
  it('キーワードを大文字にする', () => {
    const result = formatSql('select * from users', 'sql')
    expect(result).toContain('SELECT')
    expect(result).toContain('FROM')
  })

  it('sql 方言で整形できる', () => {
    const result = formatSql('SELECT id,name FROM users WHERE id = 1', 'sql')
    expect(result).toContain('SELECT')
    expect(result).toContain('FROM')
    expect(result).toContain('WHERE')
  })

  it('tsql 方言で整形できる', () => {
    const result = formatSql('select top 10 * from users', 'tsql')
    expect(result).toContain('SELECT')
  })

  it('mysql 方言で整形できる', () => {
    const result = formatSql('select * from users limit 10', 'mysql')
    expect(result).toContain('SELECT')
  })

  it('postgresql 方言で整形できる', () => {
    const result = formatSql('select * from users', 'postgresql')
    expect(result).toContain('SELECT')
  })

  it('plsql 方言で整形できる', () => {
    const result = formatSql('select * from dual', 'plsql')
    expect(result).toContain('SELECT')
  })
})
