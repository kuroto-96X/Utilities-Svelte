import type { ExtractedCandidate } from '../types'
import type { LanguageExtractor } from './types'

interface StringToken {
  content: string     // エスケープ解除済み。{expr} 保持。{{ は {{ のまま
  startLine: number   // 1-based
  endLine: number     // 1-based
  startPos: number    // コード上のプレフィックス先頭オフセット
  endPos: number      // 閉じ " の次のオフセット
}

/** 各文字オフセットに対する 1-based 行番号を返す配列 */
function buildLineMap(code: string): number[] {
  const map: number[] = new Array(code.length + 1)
  let line = 1
  for (let i = 0; i <= code.length; i++) {
    map[i] = line
    if (i < code.length && code[i] === '\n') line++
  }
  return map
}

function scanTokens(code: string, lineMap: number[]): StringToken[] {
  const tokens: StringToken[] = []
  let i = 0

  while (i < code.length) {
    const c = code[i]

    // 行コメントをスキップ
    if (c === '/' && code[i + 1] === '/') {
      while (i < code.length && code[i] !== '\n') i++
      continue
    }
    // ブロックコメントをスキップ
    if (c === '/' && code[i + 1] === '*') {
      i += 2
      while (i < code.length - 1 && !(code[i] === '*' && code[i + 1] === '/')) i++
      i += 2
      continue
    }
    // 文字リテラルをスキップ
    if (c === "'") {
      i++
      while (i < code.length && code[i] !== "'") {
        if (code[i] === '\\') i++
        i++
      }
      i++
      continue
    }

    const startPos = i
    let isVerbatim = false
    let isInterpolated = false

    if (i + 2 < code.length && code[i + 2] === '"' &&
        ((c === '$' && code[i + 1] === '@') || (c === '@' && code[i + 1] === '$'))) {
      isVerbatim = isInterpolated = true
      i += 3
    } else if (c === '@' && i + 1 < code.length && code[i + 1] === '"') {
      isVerbatim = true
      i += 2
    } else if (c === '$' && i + 1 < code.length && code[i + 1] === '"') {
      isInterpolated = true
      i += 2
    } else if (c === '"') {
      i++
    } else {
      i++
      continue
    }

    const startLine = lineMap[startPos]
    let content = ''

    if (isVerbatim) {
      while (i < code.length) {
        if (code[i] === '"') {
          if (i + 1 < code.length && code[i + 1] === '"') { content += '"'; i += 2 }
          else { i++; break }
        } else if (isInterpolated && code[i] === '{') {
          if (i + 1 < code.length && code[i + 1] === '{') { content += '{{'; i += 2 }
          else {
            const s = i; i++; let d = 1
            while (i < code.length && d > 0) {
              if (code[i] === '{') d++
              else if (code[i] === '}') d--
              i++
            }
            content += code.slice(s, i)
          }
        } else if (isInterpolated && code[i] === '}') {
          if (i + 1 < code.length && code[i + 1] === '}') { content += '}}'; i += 2 }
          else { content += '}'; i++ }
        } else {
          content += code[i++]
        }
      }
    } else {
      // 通常 / 補間（非 verbatim）: バックスラッシュエスケープ、単一行
      while (i < code.length && code[i] !== '\n') {
        if (code[i] === '"') { i++; break }
        if (code[i] === '\\') {
          const esc = code[i + 1]
          const escMap: Record<string, string> = { '"': '"', '\\': '\\', 'n': '\n', 'r': '\r', 't': '\t', '0': '\0' }
          content += escMap[esc] ?? (code[i] + esc)
          i += 2; continue
        }
        if (isInterpolated && code[i] === '{') {
          if (i + 1 < code.length && code[i + 1] === '{') { content += '{{'; i += 2 }
          else {
            const s = i; i++; let d = 1
            while (i < code.length && d > 0) {
              if (code[i] === '{') d++
              else if (code[i] === '}') d--
              i++
            }
            content += code.slice(s, i)
          }
        } else if (isInterpolated && code[i] === '}') {
          if (i + 1 < code.length && code[i + 1] === '}') { content += '}}'; i += 2 }
          else { content += '}'; i++ }
        } else {
          content += code[i++]
        }
      }
    }

    tokens.push({
      content,
      startLine,
      endLine: lineMap[Math.max(0, i - 1)],
      startPos,
      endPos: i,
    })
  }

  return tokens
}

/** 2トークン間に + 演算子のみが存在するか確認（コメント・空白は無視） */
function isChained(code: string, fromPos: number, toPos: number): boolean {
  const gap = code.slice(fromPos, toPos)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '')
    .trim()
  return gap === '+'
}

function groupChains(tokens: StringToken[], code: string): StringToken[][] {
  if (tokens.length === 0) return []
  const chains: StringToken[][] = [[tokens[0]]]
  for (let i = 1; i < tokens.length; i++) {
    if (isChained(code, tokens[i - 1].endPos, tokens[i].startPos)) {
      chains[chains.length - 1].push(tokens[i])
    } else {
      chains.push([tokens[i]])
    }
  }
  return chains
}

export const csharpExtractor: LanguageExtractor = {
  language: 'csharp',
  extract(code: string): ExtractedCandidate[] {
    const lineMap = buildLineMap(code)
    const tokens = scanTokens(code, lineMap)
    const chains = groupChains(tokens, code)
    return chains.map((chain, idx) => ({
      id: String(idx + 1),
      rawJoined: chain.map(t => t.content).join(''),
      sourceLineStart: chain[0].startLine,
      sourceLineEnd: chain[chain.length - 1].endLine,
      sqlScore: 0,
    }))
  },
}
