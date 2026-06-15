import { describe, expect, test } from 'vitest'
import { convert } from './converter'
import { DEFAULT_SETTINGS } from './settings'

// テスト用設定: caseMode を lower に固定（DEFAULT_SETTINGS は pascal だがテストは小文字で検証する）
const TS = { ...DEFAULT_SETTINGS, caseMode: 'lower' as const }

// --- 基本変換 ---

describe('基本的なかな変換', () => {
  test('ひらがな母音', () => {
    expect(convert('あいうえお', TS).output).toBe('aiueo')
  })

  test('基本子音行', () => {
    expect(convert('かさたなは', TS).output).toBe('kasatanaha')
  })

  test('複合拍（2文字）', () => {
    expect(convert('きゃしゃちゃじゃ', TS).output).toBe('kyashachaja')
  })

  test('カタカナ変換', () => {
    expect(convert('アイウエオ', TS).output).toBe('aiueo')
  })

  test('ひらがなとカタカナが混在', () => {
    expect(convert('あいアイ', TS).output).toBe('aiai')
  })
})

// --- っ/ッ ---

describe('促音（っ/ッ）', () => {
  test('っか → kka', () => {
    expect(convert('きって', TS).output).toBe('kitte')
  })

  test('っし → sshi', () => {
    expect(convert('ざっし', TS).output).toBe('zasshi')
  })

  test('っち → cchi', () => {
    expect(convert('まっち', TS).output).toBe('macchi')
  })

  test('っつ → ttsu', () => {
    expect(convert('きっつ', TS).output).toBe('kittsu')
  })
})

// --- ん/ン ---

describe('撥音（ん/ン）', () => {
  test('mn規則: b前はm', () => {
    expect(convert('しんぶん', TS).output).toBe('shimbun')
  })

  test('mn規則: m前はm', () => {
    expect(convert('まんまる', TS).output).toBe('mammaru')
  })

  test('mn規則: p前はm', () => {
    expect(convert('でんぱ', TS).output).toBe('dempa')
  })

  test('mn規則: h前はn', () => {
    expect(convert('にほん', TS).output).toBe('nihon')
  })

  test('常にn設定', () => {
    expect(convert('しんぶん', { ...TS, nasal: 'n' }).output).toBe('shinbun')
  })

  test('アポストロフィ区切り: ん+母音', () => {
    expect(
      convert('きんえん', { ...TS, separator: 'apostrophe' }).output
    ).toBe("kin'en")
  })

  test('ハイフン区切り: ん+母音', () => {
    expect(
      convert('きんえん', { ...TS, separator: 'hyphen' }).output
    ).toBe('kin-en')
  })

  test('区切りなし（デフォルト）', () => {
    expect(convert('きんえん', TS).output).toBe('kinen')
  })

  test('アポストロフィ区切り: ん+y', () => {
    expect(
      convert('しんよう', { ...TS, separator: 'apostrophe' }).output
    ).toBe("shin'yo")
  })

  test('区切りなし: ん+y (パスポート式)', () => {
    expect(convert('しんよう', TS).output).toBe('shinyo')
  })
})

// --- 長音 ---

describe('長音', () => {
  test('表記なし（パスポート）: おう → o', () => {
    expect(convert('とうきょう', TS).output).toBe('tokyo')
  })

  test('マクロン: おう → ō', () => {
    expect(
      convert('とうきょう', { ...TS, longVowel: 'macron' }).output
    ).toBe('tōkyō')
  })

  test('重ねる: おう → ou', () => {
    expect(
      convert('とうきょう', { ...TS, longVowel: 'double' }).output
    ).toBe('toukyou')
  })

  test('表記なし: カタカナ長音符（ー）を省略', () => {
    expect(convert('ラーメン', TS).output).toBe('ramen')
  })

  test('マクロン: カタカナ長音符（ー）', () => {
    expect(
      convert('ラーメン', { ...TS, longVowel: 'macron' }).output
    ).toBe('rāmen')
  })

  test('重ねる: カタカナ長音符（ー）', () => {
    expect(
      convert('ラーメン', { ...TS, longVowel: 'double' }).output
    ).toBe('raamen')
  })

  // 形態素解析なしでは同一母音の長音と語境界を区別できないため、
  // おお/ええ/ああ等の同一母音繰り返しは長音として検出しない（既知の制限）
  test('既知の制限: おお は長音検出しない（おう のみ対応）', () => {
    expect(convert('おおさか', TS).output).toBe('oosaka')
  })
})

// --- 文字の大小 ---

describe('大文字・小文字', () => {
  test('小文字', () => {
    expect(convert('とうきょう', TS).output).toBe('tokyo')
  })

  test('大文字', () => {
    expect(
      convert('とうきょう', { ...TS, caseMode: 'upper' }).output
    ).toBe('TOKYO')
  })

  test('PascalCase: 先頭のみ大文字', () => {
    expect(
      convert('とうきょう', { ...TS, caseMode: 'pascal' }).output
    ).toBe('Tokyo')
  })
})

// --- パススルー ---

describe('変換対象外文字', () => {
  test('漢字はそのまま出力', () => {
    expect(convert('東京', TS).output).toBe('東京')
    expect(convert('東京', TS).hasUntranslatableChars).toBe(false)
  })

  test('漢字+かな混在', () => {
    expect(convert('東京にいく', TS).output).toBe('東京niiku')
  })

  test('数字はそのまま', () => {
    expect(convert('123', TS).output).toBe('123')
  })

  test('ASCII英字はそのまま', () => {
    expect(convert('hello', TS).output).toBe('hello')
  })

  test('絵文字はそのまま出力され hasUntranslatableChars が true', () => {
    const result = convert('😀', TS)
    expect(result.output).toBe('😀')
    expect(result.hasUntranslatableChars).toBe(true)
  })

  test('改行はそのまま', () => {
    expect(convert('あ\nい', TS).output).toBe('a\ni')
  })

  test('スペースはそのまま', () => {
    expect(convert('あ い', TS).output).toBe('a i')
  })
})

// --- 出力文字幅 ---

describe('出力文字幅', () => {
  test('半角（デフォルト）', () => {
    expect(convert('あいう', TS).output).toBe('aiu')
  })

  test('全角出力', () => {
    expect(
      convert('あいう', { ...TS, width: 'full' }).output
    ).toBe('ａｉｕ')
  })
})

// --- サンプル文 ---

describe('サンプル文', () => {
  test('パスポート式: しんぶんはきんようびにとうきょうへいく', () => {
    expect(
      convert('しんぶんはきんようびにとうきょうへいく', TS).output
    ).toBe('shimbunhakinyobinitokyoheiku')
  })

  test('鉄道式: しんぶんはきんようびにとうきょうへいく', () => {
    expect(
      convert('しんぶんはきんようびにとうきょうへいく', {
        ...TS,
        longVowel: 'macron',
        separator: 'hyphen'
      }).output
    ).toBe('shimbunhakin-yōbinitōkyōheiku')
  })
})
