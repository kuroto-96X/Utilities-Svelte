import { describe, it, expect } from 'vitest'
import { placeholderize } from './placeholderizer'

describe('placeholderize', () => {
  it('単純な識別子を :name に変換する', () => {
    const result = placeholderize('SELECT * FROM users WHERE id = {userId}')
    expect(result.text).toBe('SELECT * FROM users WHERE id = :userId')
    expect(result.placeholders).toEqual([{ name: 'userId', originalExpr: 'userId' }])
  })

  it('プロパティアクセス (user.Id) は末尾部分を名前にする', () => {
    const result = placeholderize('WHERE id = {user.Id}')
    expect(result.text).toBe('WHERE id = :Id')
    expect(result.placeholders[0].name).toBe('Id')
  })

  it('複雑な式は :param1, :param2 ... に変換する', () => {
    const result = placeholderize('WHERE id = {GetUserId()} AND name = {obj.GetName()}')
    expect(result.text).toBe('WHERE id = :param1 AND name = :param2')
    expect(result.placeholders[0].name).toBe('param1')
    expect(result.placeholders[1].name).toBe('param2')
  })

  it('同じ式が複数回登場する場合は同じプレースホルダーを再利用する', () => {
    const result = placeholderize('WHERE id = {userId} AND other_id = {userId}')
    expect(result.text).toBe('WHERE id = :userId AND other_id = :userId')
    expect(result.placeholders).toHaveLength(1)
  })

  it('補間式がない文字列はそのまま返す', () => {
    const result = placeholderize('SELECT * FROM users WHERE id = @id')
    expect(result.text).toBe('SELECT * FROM users WHERE id = @id')
    expect(result.placeholders).toHaveLength(0)
  })

  it('{{ は { に、}} は } に変換する', () => {
    const result = placeholderize('SELECT * FROM {{schema}}.users WHERE id = {userId}')
    expect(result.text).toBe('SELECT * FROM {schema}.users WHERE id = :userId')
  })

  it('{param1} が先に登場した場合、複雑な式のフォールバックは :param2 になる', () => {
    const result = placeholderize('WHERE id = {param1} AND name = {GetName()}')
    expect(result.text).toBe('WHERE id = :param1 AND name = :param2')
    expect(result.placeholders[0].name).toBe('param1')
    expect(result.placeholders[1].name).toBe('param2')
  })
})
