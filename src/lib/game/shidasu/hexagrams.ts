// 六十四卦(易経)のうち、神託(oracle)として使用中の10卦の参照データ。
// 管理画面の「名前」<select>の選択肢・読み方ラベル表示にのみ使う(秘儀のrunes.ts・
// 天啓のmansions.tsと同じ位置づけ)。六十四卦は全部で64卦あるが、今回使う10卦のみを
// データ化する(mansions.tsのような未使用分の温存はしない、将来追加時に別途拡張する)。
export interface HexagramEntry {
  kanji: string
  reading: string
}

export const HEXAGRAMS: HexagramEntry[] = [
  { kanji: '乾為天', reading: 'けんいてん' },
  { kanji: '兌為沢', reading: 'だいたく' },
  { kanji: '離為火', reading: 'りいか' },
  { kanji: '震為雷', reading: 'しんいらい' },
  { kanji: '巽為風', reading: 'そんいふう' },
  { kanji: '坎為水', reading: 'かんいすい' },
  { kanji: '艮為山', reading: 'ごんいさん' },
  { kanji: '坤為地', reading: 'こんいち' },
  { kanji: '沢山咸', reading: 'たくざんかん' },
  { kanji: '水火既済', reading: 'すいかきせい' },
]
