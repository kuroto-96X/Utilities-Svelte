// 八卦(易における8つの基本図像)全8卦の参照データ。管理画面の「名前」<select>の
// 選択肢・読み方ラベル表示にのみ使う(秘儀のrunes.ts・天啓のmansions.tsと同じ位置づけ。
// 神託は8卦が現在実装済みの8役と1:1で対応するため、天啓のような「未使用分の温存」は無い)。
export interface TrigramEntry {
  kanji: string
  reading: string
}

export const TRIGRAMS: TrigramEntry[] = [
  { kanji: '乾', reading: 'けん' },
  { kanji: '兌', reading: 'だ' },
  { kanji: '離', reading: 'り' },
  { kanji: '震', reading: 'しん' },
  { kanji: '巽', reading: 'そん' },
  { kanji: '坎', reading: 'かん' },
  { kanji: '艮', reading: 'ごん' },
  { kanji: '坤', reading: 'こん' },
]
