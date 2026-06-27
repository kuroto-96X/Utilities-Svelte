// SELECT カラムの AS キーワード位置を揃える後処理。
// 完全な SQL パーサーではなく行ベースの簡易処理のため、
// サブクエリや複雑な式が含まれるカラムでは位置がずれる場合がある（MVP 制約）。

const TOP_LEVEL_KEYWORDS = new Set([
  'FROM', 'WHERE', 'JOIN', 'LEFT', 'RIGHT', 'INNER', 'OUTER', 'FULL',
  'GROUP', 'ORDER', 'HAVING', 'UNION', 'EXCEPT', 'INTERSECT', 'LIMIT',
  'OFFSET', 'INSERT', 'UPDATE', 'DELETE', 'SET', 'VALUES', 'WITH',
])

function isTopLevelKeyword(line: string): boolean {
  const firstWord = line.trim().split(/\s+/)[0].toUpperCase()
  return TOP_LEVEL_KEYWORDS.has(firstWord)
}

function alignGroup(lines: string[]): string[] {
  if (!lines.some(l => /\bAS\b/i.test(l))) return lines

  let maxPreAs = 0
  for (const line of lines) {
    const m = line.match(/^(\s+\S.*?)\s+AS\b/i)
    if (m) {
      maxPreAs = Math.max(maxPreAs, m[1].length)
    } else {
      // Non-AS line: expression length is the trimmed line (without trailing comma)
      const expr = line.replace(/,\s*$/, '')
      maxPreAs = Math.max(maxPreAs, expr.length)
    }
  }

  return lines.map(line => {
    const m = line.match(/^(\s+\S.*?)\s+AS\b(.*)$/i)
    if (m) {
      const padding = ' '.repeat(maxPreAs - m[1].length + 1)
      return m[1] + padding + 'AS' + m[2]
    } else {
      // Non-AS line: pad expression to maxPreAs
      const trailingComma = /,\s*$/.test(line) ? line.match(/,\s*$/)?.[0] ?? '' : ''
      const expr = line.replace(/,\s*$/, '')
      const padding = ' '.repeat(Math.max(0, maxPreAs - expr.length))
      return expr + padding + trailingComma
    }
  })
}

export function alignSelectColumns(sql: string): string {
  const lines = sql.split('\n')
  const result: string[] = []
  let i = 0

  while (i < lines.length) {
    if (lines[i].trim() === 'SELECT') {
      result.push(lines[i])
      i++

      const group: string[] = []
      while (i < lines.length && /^\s/.test(lines[i]) && !isTopLevelKeyword(lines[i])) {
        group.push(lines[i])
        i++
      }

      result.push(...(group.length > 1 ? alignGroup(group) : group))
    } else {
      result.push(lines[i++])
    }
  }

  return result.join('\n')
}
