// TODO: sql-formatter の FormatOptions に commaPosition オプションが存在しない（v15時点）。
// Task 5 の formatEngine.ts でカンマ移動の後処理を手動で実装すること。
// 確認バージョンの FormatOptions に存在するオプション:
//   tabWidth, useTabs, keywordCase, identifierCase, dataTypeCase, functionCase,
//   indentStyle, logicalOperatorNewline ('before' | 'after'), expressionWidth,
//   linesBetweenQueries, denseOperators, newlineBeforeSemicolon, params, paramTypes

export type SourceLanguage = 'csharp' | 'java' | 'python' | 'javascript' | 'vb'

export interface ExtractedCandidate {
  id: string
  rawJoined: string        // 連結済み文字列。補間式は {expr} のまま。{{ は {{ のまま保持
  sourceLineStart: number  // 1-based
  sourceLineEnd: number    // 1-based
  sqlScore: number         // sqlDetector によるスコア（初期値 0）
}

export interface PlaceholderResult {
  text: string
  placeholders: { name: string; originalExpr: string }[]
}

export type SqlDialect = 'sql' | 'tsql' | 'mysql' | 'postgresql' | 'plsql'
export type FormatMode = 'align' | 'breakline'
