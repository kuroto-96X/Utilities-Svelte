import { describe, it, expect } from 'vitest'
import { csharpExtractor } from './csharp'

describe('csharpExtractor.extract', () => {
  describe('通常文字列 ("...")', () => {
    it('単一の文字列リテラルを抽出する', () => {
      const candidates = csharpExtractor.extract(`string sql = "SELECT * FROM users";`)
      expect(candidates).toHaveLength(1)
      expect(candidates[0].rawJoined).toBe('SELECT * FROM users')
    })

    it('バックスラッシュエスケープを解除する', () => {
      const candidates = csharpExtractor.extract(`string s = "line1\\nline2";`)
      expect(candidates[0].rawJoined).toBe('line1\nline2')
    })

    it('+ 演算子で連結された文字列を1候補にまとめる', () => {
      const code = `string sql = "SELECT * " +\n             "FROM users " +\n             "WHERE id = @id";`
      const candidates = csharpExtractor.extract(code)
      expect(candidates).toHaveLength(1)
      expect(candidates[0].rawJoined).toBe('SELECT * FROM users WHERE id = @id')
    })

    it('連結されていない2つの文字列は別候補になる', () => {
      const code = `string a = "SELECT * FROM a";\nstring b = "SELECT * FROM b";`
      expect(csharpExtractor.extract(code)).toHaveLength(2)
    })

    it('行コメント内の文字列をスキップする', () => {
      const code = `// string s = "not a candidate";\nstring sql = "SELECT 1";`
      expect(csharpExtractor.extract(code)).toHaveLength(1)
    })

    it('ブロックコメント内の文字列をスキップする', () => {
      const code = `/* string s = "not" */ string sql = "SELECT 1";`
      expect(csharpExtractor.extract(code)).toHaveLength(1)
    })

    it('コメントをはさんだ + 連結をチェーンと認識する', () => {
      const code = `string sql = "SELECT " + /* comment */ "FROM users";`
      const candidates = csharpExtractor.extract(code)
      expect(candidates).toHaveLength(1)
      expect(candidates[0].rawJoined).toBe('SELECT FROM users')
    })
  })

  describe('verbatim 文字列 (@"...")', () => {
    it('複数行の verbatim 文字列を抽出する', () => {
      const code = 'string sql = @"SELECT *\nFROM users\nWHERE id = @id";'
      const candidates = csharpExtractor.extract(code)
      expect(candidates[0].rawJoined).toBe('SELECT *\nFROM users\nWHERE id = @id')
    })

    it('verbatim 内の "" をダブルクォートに変換する', () => {
      const code = `string s = @"it's ""quoted""";`
      expect(csharpExtractor.extract(code)[0].rawJoined).toBe(`it's "quoted"`)
    })
  })

  describe('補間文字列 ($"...")', () => {
    it('{expr} をそのまま保持する', () => {
      const code = `string sql = $"SELECT * FROM users WHERE id = {userId}";`
      expect(csharpExtractor.extract(code)[0].rawJoined).toBe('SELECT * FROM users WHERE id = {userId}')
    })

    it('{{ は {{ のまま保持する（リテラルの { として後段で処理）', () => {
      const code = `string sql = $"SELECT * FROM {{schema}}.users WHERE id = {userId}";`
      expect(csharpExtractor.extract(code)[0].rawJoined).toBe('SELECT * FROM {{schema}}.users WHERE id = {userId}')
    })
  })

  describe('補間 verbatim ($@"..." / @$"...")', () => {
    it('$@ 形式を処理する', () => {
      const code = `string sql = $@"SELECT *\nFROM users\nWHERE id = {userId}";`
      const r = csharpExtractor.extract(code)[0].rawJoined
      expect(r).toContain('SELECT *')
      expect(r).toContain('{userId}')
    })

    it('@$ 形式を処理する', () => {
      const code = `string sql = @$"SELECT * FROM users WHERE id = {userId}";`
      expect(csharpExtractor.extract(code)[0].rawJoined).toContain('{userId}')
    })
  })

  describe('行番号', () => {
    it('sourceLineStart が正しい（1-based）', () => {
      const code = `// comment\nstring sql = "SELECT 1";`
      expect(csharpExtractor.extract(code)[0].sourceLineStart).toBe(2)
    })

    it('verbatim 複数行の sourceLineEnd が正しい', () => {
      const code = 'string sql = @"SELECT *\nFROM users";'
      const c = csharpExtractor.extract(code)[0]
      expect(c.sourceLineStart).toBe(1)
      expect(c.sourceLineEnd).toBe(2)
    })
  })
})
