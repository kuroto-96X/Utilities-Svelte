import type { PlaceholderResult } from './types'

// C# 識別子またはプロパティアクセスチェーン（ドット区切り）
const IDENTIFIER_RE = /^[a-zA-Z_][a-zA-Z0-9_]*(\.[a-zA-Z_][a-zA-Z0-9_]*)*$/

export function placeholderize(rawJoined: string): PlaceholderResult {
  const placeholders: { name: string; originalExpr: string }[] = []
  const exprToName = new Map<string, string>()
  let paramCount = 0

  // {expr} にマッチ。{{ や }} の場合は負の先読み/後読みで除外する
  const text = rawJoined.replace(/(?<!\{)\{([^{}]+)\}(?!\})/g, (_, expr: string) => {
    const trimmed = expr.trim()

    // 同じ式が既にある場合は再利用
    if (exprToName.has(trimmed)) return `:${exprToName.get(trimmed)}`

    let name: string
    if (IDENTIFIER_RE.test(trimmed)) {
      // a.b.c → c
      const parts = trimmed.split('.')
      const candidate = parts[parts.length - 1]
      // 同名が別式で既に使われていれば paramN にフォールバック
      if (placeholders.some(p => p.name === candidate)) {
        name = `param${++paramCount}`
      } else {
        name = candidate
      }
    } else {
      do {
        name = `param${++paramCount}`
      } while (placeholders.some(p => p.name === name))
    }

    placeholders.push({ name, originalExpr: trimmed })
    exprToName.set(trimmed, name)
    return `:${name}`
  })

  // {{ → { 、}} → } に戻す
  const finalText = text.replace(/\{\{/g, '{').replace(/\}\}/g, '}')

  return { text: finalText, placeholders }
}
