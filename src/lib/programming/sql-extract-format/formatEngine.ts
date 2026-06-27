import { format as sqlFormat } from 'sql-formatter'
import type { SqlLanguage } from 'sql-formatter'
import type { SqlDialect } from './types'

const DIALECT_MAP: Record<SqlDialect, SqlLanguage> = {
  sql: 'sql',
  tsql: 'tsql',
  mysql: 'mysql',
  postgresql: 'postgresql',
  plsql: 'plsql',
}

export function formatSql(sql: string, dialect: SqlDialect): string {
  return sqlFormat(sql, {
    language: DIALECT_MAP[dialect],
    keywordCase: 'upper',
    logicalOperatorNewline: 'before',
  })
}
