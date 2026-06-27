import type { ExtractedCandidate } from './types'

// 複合キーワードを先に配置（ORDER BY など部分文字列の誤検出を防ぐ）
const SQL_KEYWORDS = [
  'INSERT INTO', 'DELETE FROM', 'GROUP BY', 'ORDER BY',
  'SELECT', 'UPDATE', 'FROM', 'WHERE', 'JOIN', 'VALUES', 'SET',
] as const

export function scoreSql(text: string): number {
  const upper = text.toUpperCase()
  return SQL_KEYWORDS.reduce((acc, kw) => {
    const pattern = new RegExp(`\\b${kw.replace(' ', '\\s+')}\\b`)
    return acc + (pattern.test(upper) ? 1 : 0)
  }, 0)
}

export function scoreAndSort(candidates: ExtractedCandidate[]): ExtractedCandidate[] {
  return candidates
    .map(c => ({ ...c, sqlScore: scoreSql(c.rawJoined) }))
    .sort((a, b) => b.sqlScore - a.sqlScore)
}
