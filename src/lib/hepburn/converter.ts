import { normalize } from './normalizer'
import { TABLE } from './table'
import type { HepburnSettings } from './settings'

export type ConvertResult = {
  output: string
  hasUntranslatableChars: boolean
}

const VOWELS = new Set(['a', 'i', 'u', 'e', 'o'])
const LABIALS = new Set(['b', 'm', 'p'])

const MACRON_MAP: Record<string, string> = {
  a: 'ā', i: 'ī', u: 'ū', e: 'ē', o: 'ō',
  ā: 'ā', ī: 'ī', ū: 'ū', ē: 'ē', ō: 'ō'  // idempotent
}

const FULL_WIDTH_OFFSET = 0xFEE0

/** 出力文字列の末尾方向から最初の母音を見つけてマクロン版に置換する */
function applyMacronToLastVowel(s: string): string {
  for (let i = s.length - 1; i >= 0; i--) {
    const ch = s[i].toLowerCase()
    if (ch in MACRON_MAP) {
      const macron = MACRON_MAP[ch]
      return s.slice(0, i) + macron + s.slice(i + 1)
    }
  }
  return s
}

/**
 * っ/ッ が生成する重ね子音を返す（次の拍の本体は別途処理される）。
 * 例: 次が shi なら 's'、chi なら 'c' を返す。母音始まりなら何も返さない。
 */
function doubledConsonant(romaji: string): string {
  if (!romaji) return ''
  const first = romaji[0].toLowerCase()
  if (VOWELS.has(first)) return ''  // 母音から始まる場合は重ねない
  return romaji[0]
}

/** 指定インデックスのかな（複合拍優先）のローマ字を返す。テーブルにない場合は '' */
function getNextRomaji(src: string, idx: number): string {
  const ch = src[idx] ?? ''
  const next = src[idx + 1] ?? ''
  if (TABLE.has(ch + next)) return TABLE.get(ch + next)!
  if (TABLE.has(ch)) return TABLE.get(ch)!
  return ''
}

/** ローマ字文字列が母音または 'y' で始まるか */
function startsWithVowelOrY(s: string): boolean {
  if (!s) return false
  const first = s[0].toLowerCase()
  return VOWELS.has(first) || first === 'y'
}

/**
 * kana が直前の母音に対して長音延長かどうか。
 * う/ウ after o-vowel → long ō のみ検出する（Hepburn おう パターン）。
 *
 * 同一母音繰り返し（ああ/いい/おお）は形態素解析なしでは語境界と区別できない
 * ため意図的に検出しない。例: にいく（に＋いく）の「い」が長音と誤認される。
 */
function isLongVowelExtension(kana: string, lastVowel: string): boolean {
  return (kana === 'う' || kana === 'ウ') && lastVowel === 'o'
}

/** ASCII 半角文字を全角に変換する */
function toFullWidth(s: string): string {
  return [...s].map(ch => {
    const code = ch.charCodeAt(0)
    if (code === 0x20) return '　'
    if (code >= 0x21 && code <= 0x7E) return String.fromCharCode(code + FULL_WIDTH_OFFSET)
    return ch
  }).join('')
}

/** 大文字・小文字変換を適用する */
function applyCaseMode(s: string, caseMode: HepburnSettings['caseMode']): string {
  switch (caseMode) {
    case 'lower': return s.toLowerCase()
    case 'upper': return s.toUpperCase()
    case 'pascal':
      // 自動変換モード（単語境界なし）: 先頭のみ大文字、残りは小文字
      return s.length === 0 ? '' : s[0].toUpperCase() + s.slice(1).toLowerCase()
  }
}

/**
 * 入力文字列をヘボン式ローマ字に変換する。
 * - ひらがな・カタカナ・半角カナ: テーブルで変換
 * - 漢字・数字・記号: そのまま出力
 * - 絵文字・特殊記号: そのまま出力し hasUntranslatableChars = true
 */
export function convert(
  input: string,
  settings: HepburnSettings
): ConvertResult {
  const src = normalize(input)
  let output = ''
  let hasUntranslatableChars = false
  let lastVowel = ''
  let i = 0

  while (i < src.length) {
    const ch = src[i]
    const next = src[i + 1] ?? ''

    // 2文字複合拍（きゃ, しゃ, etc.）。next が空のときは単拍処理に回す。
    if (next !== '' && TABLE.has(ch + next)) {
      const romaji = TABLE.get(ch + next)!
      output += romaji
      lastVowel = romaji[romaji.length - 1].toLowerCase()
      i += 2
      continue
    }

    // っ / ッ（促音: 次の子音を重ねる）
    if (ch === 'っ' || ch === 'ッ') {
      const nextRomaji = getNextRomaji(src, i + 1)
      output += doubledConsonant(nextRomaji)
      // lastVowel は更新しない（促音は母音を含まない）
      i++
      continue
    }

    // ん / ン（撥音）
    if (ch === 'ん' || ch === 'ン') {
      const nextRomaji = getNextRomaji(src, i + 1)
      const firstOfNext = nextRomaji[0]?.toLowerCase() ?? ''
      const isLabial = LABIALS.has(firstOfNext)
      let nasal = (settings.nasal === 'mn' && isLabial) ? 'm' : 'n'
      if (settings.separator !== 'none' && startsWithVowelOrY(nextRomaji)) {
        nasal += settings.separator === 'apostrophe' ? "'" : '-'
      }
      output += nasal
      lastVowel = ''
      i++
      continue
    }

    // ー（長音符: 直前の母音を延長）
    if (ch === 'ー') {
      if (settings.longVowel === 'macron') {
        output = applyMacronToLastVowel(output)
      } else if (settings.longVowel === 'double' && lastVowel) {
        output += lastVowel
      }
      // 'omit': 何もしない
      i++
      continue
    }

    // 単拍かな（テーブルにある1文字）
    if (TABLE.has(ch)) {
      const romaji = TABLE.get(ch)!
      const thisVowel = romaji[romaji.length - 1].toLowerCase()

      if (isLongVowelExtension(ch, lastVowel)) {
        // 長音延長処理
        if (settings.longVowel === 'macron') {
          output = applyMacronToLastVowel(output)
        } else if (settings.longVowel === 'double') {
          output += romaji
          lastVowel = thisVowel
        }
        // 'omit': 何もしない（このかなを飛ばす）
      } else {
        output += romaji
        lastVowel = thisVowel
      }
      i++
      continue
    }

    // ASCII 英字（ヘボン式として正規化せずそのまま通す）
    if (/[a-zA-Z]/.test(ch)) {
      output += ch
      if (VOWELS.has(ch.toLowerCase())) lastVowel = ch.toLowerCase()
      i++
      continue
    }

    // 空白・改行
    if (/\s/.test(ch)) {
      output += ch
      lastVowel = ''
      i++
      continue
    }

    // 漢字（CJK 統合漢字: U+4E00–U+9FFF, 拡張 U+3400–U+4DBF）
    const codePoint = ch.codePointAt(0)!
    const isKanji = (codePoint >= 0x4E00 && codePoint <= 0x9FFF) ||
                    (codePoint >= 0x3400 && codePoint <= 0x4DBF)
    if (isKanji) {
      output += ch
      lastVowel = ''
      i += ch.length  // サロゲートペアに対応
      continue
    }

    // 数字
    if (/\d/.test(ch)) {
      output += ch
      lastVowel = ''
      i++
      continue
    }

    // 日本語句読点・記号（変換不可フラグを立てない）
    const isJaPunctuation = /[。、・〜～「」『』【】…‥〔〕〈〉《》，．：；？！—（）]/.test(ch)
    const isAsciiPunctuation = /[!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]/.test(ch)
    if (isJaPunctuation || isAsciiPunctuation) {
      output += ch
      lastVowel = ''
      i++
      continue
    }

    // それ以外（絵文字・特殊記号など）: そのまま出力し flagを立てる
    if (codePoint > 0xFFFF) {
      output += String.fromCodePoint(codePoint)
      i += 2  // サロゲートペア（2コードユニット）
    } else {
      output += ch
      i++
    }
    hasUntranslatableChars = true
    lastVowel = ''
    continue
  }

  // 大文字・小文字変換
  output = applyCaseMode(output, settings.caseMode)

  // 全角変換
  if (settings.width === 'full') {
    output = toFullWidth(output)
  }

  return { output, hasUntranslatableChars }
}
