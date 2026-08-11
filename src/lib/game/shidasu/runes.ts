// エルダー・フサルク(北欧ルーン文字)全24文字の参照データ。
// RiteId(全24種実装済み)とは独立しており、管理画面の「名前」<select>の
// 選択肢・読み方ラベル表示にのみ使う。将来秘儀を追加する際、ここから未使用のグリフを選んで割り当てる。
export interface RuneEntry {
  glyph: string
  reading: string
}

export const RUNES: RuneEntry[] = [
  { glyph: 'ᚠ', reading: 'フェフ' },
  { glyph: 'ᚢ', reading: 'ウルズ' },
  { glyph: 'ᚦ', reading: 'スリサズ' },
  { glyph: 'ᚨ', reading: 'アンスズ' },
  { glyph: 'ᚱ', reading: 'ライドー' },
  { glyph: 'ᚲ', reading: 'ケナズ' },
  { glyph: 'ᚷ', reading: 'ゲボ' },
  { glyph: 'ᚹ', reading: 'ウンヨー' },
  { glyph: 'ᚺ', reading: 'ハガラズ' },
  { glyph: 'ᚾ', reading: 'ナウジズ' },
  { glyph: 'ᛁ', reading: 'イサ' },
  { glyph: 'ᛃ', reading: 'イェラ' },
  { glyph: 'ᛇ', reading: 'エイワズ' },
  { glyph: 'ᛈ', reading: 'ペルスロ' },
  { glyph: 'ᛉ', reading: 'アルギズ' },
  { glyph: 'ᛋ', reading: 'ソウィロ' },
  { glyph: 'ᛏ', reading: 'ティワズ' },
  { glyph: 'ᛒ', reading: 'ベルカナ' },
  { glyph: 'ᛖ', reading: 'エワズ' },
  { glyph: 'ᛗ', reading: 'マンナズ' },
  { glyph: 'ᛚ', reading: 'ラグズ' },
  { glyph: 'ᛜ', reading: 'イングズ' },
  { glyph: 'ᛞ', reading: 'ダガズ' },
  { glyph: 'ᛟ', reading: 'オセラ' },
]
