import { describe, expect, test } from 'vitest'
import { convert } from './converter'
import { DEFAULT_SETTINGS } from './settings'

// --- 基本変換 ---

describe('基本的なかな変換', () => {
  test('ひらがな母音', () => {
    expect(convert('あいうえお', DEFAULT_SETTINGS).output).toBe('aiueo')
  })

  test('基本子音行', () => {
    expect(convert('かさたなは', DEFAULT_SETTINGS).output).toBe('kasatanaha')
  })

  test('複合拍（2文字）', () => {
    expect(convert('きゃしゃちゃじゃ', DEFAULT_SETTINGS).output).toBe('kyashachaja')
  })

  test('カタカナ変換', () => {
    expect(convert('アイウエオ', DEFAULT_SETTINGS).output).toBe('aiueo')
  })

  test('ひらがなとカタカナが混在', () => {
    expect(convert('あいアイ', DEFAULT_SETTINGS).output).toBe('aiai')
  })
})

// --- っ/ッ ---

describe('促音（っ/ッ）', () => {
  test('っか → kka', () => {
    expect(convert('きって', DEFAULT_SETTINGS).output).toBe('kitte')
  })

  test('っし → sshi', () => {
    expect(convert('ざっし', DEFAULT_SETTINGS).output).toBe('zasshi')
  })

  test('っち → cchi', () => {
    expect(convert('まっち', DEFAULT_SETTINGS).output).toBe('macchi')
  })

  test('っつ → ttsu', () => {
    expect(convert('きっつ', DEFAULT_SETTINGS).output).toBe('kittsu')
  })
})

// --- ん/ン ---

describe('撥音（ん/ン）', () => {
  test('mn規則: b前はm', () => {
    expect(convert('しんぶん', DEFAULT_SETTINGS).output).toBe('shimbun')
  })

  test('mn規則: m前はm', () => {
    expect(convert('まんまる', DEFAULT_SETTINGS).output).toBe('mammaru')
  })

  test('mn規則: p前はm', () => {
    expect(convert('でんぱ', DEFAULT_SETTINGS).output).toBe('dempa')
  })

  test('mn規則: h前はn', () => {
    expect(convert('にほん', DEFAULT_SETTINGS).output).toBe('nihon')
  })

  test('常にn設定', () => {
    expect(convert('しんぶん', { ...DEFAULT_SETTINGS, nasal: 'n' }).output).toBe('shinbun')
  })

  test('アポストロフィ区切り: ん+母音', () => {
    expect(
      convert('きんえん', { ...DEFAULT_SETTINGS, separator: 'apostrophe' }).output
    ).toBe("kin'en")
  })

  test('ハイフン区切り: ん+母音', () => {
    expect(
      convert('きんえん', { ...DEFAULT_SETTINGS, separator: 'hyphen' }).output
    ).toBe('kin-en')
  })

  test('区切りなし（デフォルト）', () => {
    expect(convert('きんえん', DEFAULT_SETTINGS).output).toBe('kinen')
  })

  test('アポストロフィ区切り: ん+y', () => {
    expect(
      convert('しんよう', { ...DEFAULT_SETTINGS, separator: 'apostrophe' }).output
    ).toBe("shin'yo")
  })

  test('区切りなし: ん+y (パスポート式)', () => {
    expect(convert('しんよう', DEFAULT_SETTINGS).output).toBe('shinyo')
  })
})

// --- 長音 ---

describe('長音', () => {
  test('表記なし（パスポート）: おう → o', () => {
    expect(convert('とうきょう', DEFAULT_SETTINGS).output).toBe('tokyo')
  })

  test('マクロン: おう → ō', () => {
    expect(
      convert('とうきょう', { ...DEFAULT_SETTINGS, longVowel: 'macron' }).output
    ).toBe('tōkyō')
  })

  test('重ねる: おう → ou', () => {
    expect(
      convert('とうきょう', { ...DEFAULT_SETTINGS, longVowel: 'double' }).output
    ).toBe('toukyou')
  })

  test('表記なし: カタカナ長音符（ー）を省略', () => {
    expect(convert('ラーメン', DEFAULT_SETTINGS).output).toBe('ramen')
  })

  test('マクロン: カタカナ長音符（ー）', () => {
    expect(
      convert('ラーメン', { ...DEFAULT_SETTINGS, longVowel: 'macron' }).output
    ).toBe('rāmen')
  })

  test('重ねる: カタカナ長音符（ー）', () => {
    expect(
      convert('ラーメン', { ...DEFAULT_SETTINGS, longVowel: 'double' }).output
    ).toBe('raamen')
  })

  // 形態素解析なしでは同一母音の長音と語境界を区別できないため、
  // おお/ええ/ああ等の同一母音繰り返しは長音として検出しない（既知の制限）
  test('既知の制限: おお は長音検出しない（おう のみ対応）', () => {
    expect(convert('おおさか', DEFAULT_SETTINGS).output).toBe('oosaka')
  })
})

// --- 文字の大小 ---

describe('大文字・小文字', () => {
  test('小文字（デフォルト）', () => {
    expect(convert('とうきょう', DEFAULT_SETTINGS).output).toBe('tokyo')
  })

  test('大文字', () => {
    expect(
      convert('とうきょう', { ...DEFAULT_SETTINGS, caseMode: 'upper' }).output
    ).toBe('TOKYO')
  })

  test('PascalCase: 先頭のみ大文字', () => {
    expect(
      convert('とうきょう', { ...DEFAULT_SETTINGS, caseMode: 'pascal' }).output
    ).toBe('Tokyo')
  })
})

// --- パススルー ---

describe('変換対象外文字', () => {
  test('漢字はそのまま出力', () => {
    expect(convert('東京', DEFAULT_SETTINGS).output).toBe('東京')
    expect(convert('東京', DEFAULT_SETTINGS).hasUntranslatableChars).toBe(false)
  })

  test('漢字+かな混在', () => {
    expect(convert('東京にいく', DEFAULT_SETTINGS).output).toBe('東京niiku')
  })

  test('数字はそのまま', () => {
    expect(convert('123', DEFAULT_SETTINGS).output).toBe('123')
  })

  test('ASCII英字はそのまま', () => {
    expect(convert('hello', DEFAULT_SETTINGS).output).toBe('hello')
  })

  test('絵文字はそのまま出力され hasUntranslatableChars が true', () => {
    const result = convert('😀', DEFAULT_SETTINGS)
    expect(result.output).toBe('😀')
    expect(result.hasUntranslatableChars).toBe(true)
  })

  test('改行はそのまま', () => {
    expect(convert('あ\nい', DEFAULT_SETTINGS).output).toBe('a\ni')
  })

  test('スペースはそのまま', () => {
    expect(convert('あ い', DEFAULT_SETTINGS).output).toBe('a i')
  })
})

// --- 出力文字幅 ---

describe('出力文字幅', () => {
  test('半角（デフォルト）', () => {
    expect(convert('あいう', DEFAULT_SETTINGS).output).toBe('aiu')
  })

  test('全角出力', () => {
    expect(
      convert('あいう', { ...DEFAULT_SETTINGS, width: 'full' }).output
    ).toBe('ａｉｕ')
  })
})

// --- サンプル文 ---

describe('サンプル文', () => {
  test('パスポート式: しんぶんはきんようびにとうきょうへいく', () => {
    expect(
      convert('しんぶんはきんようびにとうきょうへいく', DEFAULT_SETTINGS).output
    ).toBe('shimbunhakinyobinitokyoheiku')
  })

  test('鉄道式: しんぶんはきんようびにとうきょうへいく', () => {
    expect(
      convert('しんぶんはきんようびにとうきょうへいく', {
        ...DEFAULT_SETTINGS,
        longVowel: 'macron',
        separator: 'hyphen'
      }).output
    ).toBe('shimbunhakin-yōbinitōkyōheiku')
  })
})
