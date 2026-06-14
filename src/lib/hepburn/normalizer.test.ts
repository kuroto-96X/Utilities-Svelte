import { describe, expect, test } from 'vitest'
import { normalize } from './normalizer'

describe('normalize', () => {
  test('半角カタカナを全角カタカナに変換する', () => {
    expect(normalize('ｱｲｳｴｵ')).toBe('アイウエオ')
  })

  test('半角濁点を結合して全角濁点付きカタカナにする', () => {
    expect(normalize('ｶﾞｷﾞｸﾞｹﾞｺﾞ')).toBe('ガギグゲゴ')
  })

  test('半角半濁点を結合して全角半濁点付きカタカナにする', () => {
    expect(normalize('ﾊﾟﾋﾟﾌﾟﾍﾟﾎﾟ')).toBe('パピプペポ')
  })

  test('全角ひらがなはそのまま', () => {
    expect(normalize('あいうえお')).toBe('あいうえお')
  })

  test('全角カタカナはそのまま', () => {
    expect(normalize('アイウエオ')).toBe('アイウエオ')
  })

  test('ASCII はそのまま', () => {
    expect(normalize('hello123')).toBe('hello123')
  })

  test('空文字はそのまま', () => {
    expect(normalize('')).toBe('')
  })
})
