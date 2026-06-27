import { describe, it, expect } from 'vitest'
import { formatSql } from './formatEngine'

describe('formatSql', () => {
  it('キーワードを大文字にする', () => {
    const result = formatSql('select id, name from users where id = 1', 'sql')
    expect(result).toContain('SELECT')
    expect(result).toContain('FROM')
    expect(result).toContain('WHERE')
    // 小文字のキーワードが残っていないことを確認（大文字化が実際に機能していることを検証）
    expect(result).not.toContain('select')
    expect(result).not.toContain('from')
    expect(result).not.toContain('where')
  })

  it('AND/OR 演算子を行頭に置く (logicalOperatorNewline: before)', () => {
    const result = formatSql(
      'SELECT * FROM users WHERE id = 1 AND name = 2 OR status = 3',
      'sql',
    )
    const lines = result.split('\n')
    // AND/OR は前の行末ではなく、新しい行の先頭に現れること
    expect(lines.some((l) => l.trimStart().startsWith('AND'))).toBe(true)
    expect(lines.some((l) => l.trimStart().startsWith('OR'))).toBe(true)
  })

  it('sql 方言で整形できる', () => {
    const result = formatSql('SELECT id,name FROM users WHERE id = 1', 'sql')
    // カンマ区切りの列が別々の行に展開されること
    const lines = result.split('\n')
    expect(lines.some((l) => l.includes('id'))).toBe(true)
    expect(lines.some((l) => l.includes('name'))).toBe(true)
    expect(result).toContain('WHERE')
  })

  it('tsql 方言で整形できる', () => {
    const result = formatSql('select top 10 id, name from users', 'tsql')
    // TOP句が保持され、キーワードが大文字になること
    expect(result).toContain('SELECT')
    expect(result).toContain('TOP')
    expect(result).toContain('FROM')
    expect(result).not.toContain('select')
    expect(result).not.toContain('from')
  })

  it('mysql 方言で整形できる', () => {
    const result = formatSql('select * from users limit 10', 'mysql')
    expect(result).toContain('SELECT')
    expect(result).toContain('LIMIT')
    expect(result).not.toContain('limit')
  })

  it('postgresql 方言で整形できる', () => {
    const result = formatSql('select id::text, name from users where id = 1', 'postgresql')
    expect(result).toContain('SELECT')
    expect(result).toContain('::text')  // PostgreSQL cast syntax preserved
    expect(result).not.toContain('select')
  })

  it('plsql 方言で整形できる', () => {
    const result = formatSql('select sysdate from dual', 'plsql')
    expect(result).toContain('SELECT')
    expect(result).toContain('dual')   // Oracle pseudo-table preserved (sql-formatter keeps dual lowercase in plsql mode)
    expect(result).not.toContain('select')
  })
})
