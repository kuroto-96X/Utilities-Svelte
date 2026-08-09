// 二十八宿(中国・日本の伝統的な天文体系)全28宿の参照データ。
// RevelationId(効果実装済み20種)とは独立しており、管理画面の「名前」<select>の
// 選択肢・読み方ラベル表示にのみ使う。将来天啓を追加する際、ここから未使用の宿を選んで割り当てる。
export interface MansionEntry {
  kanji: string
  reading: string
}

export const MANSIONS: MansionEntry[] = [
  { kanji: '角', reading: 'かく' },
  { kanji: '亢', reading: 'こう' },
  { kanji: '氐', reading: 'てい' },
  { kanji: '房', reading: 'ぼう' },
  { kanji: '心', reading: 'しん' },
  { kanji: '尾', reading: 'び' },
  { kanji: '箕', reading: 'き' },
  { kanji: '斗', reading: 'と' },
  { kanji: '牛', reading: 'ぎゅう' },
  { kanji: '女', reading: 'じょ' },
  { kanji: '虚', reading: 'きょ' },
  { kanji: '危', reading: 'き' },
  { kanji: '室', reading: 'しつ' },
  { kanji: '壁', reading: 'へき' },
  { kanji: '奎', reading: 'けい' },
  { kanji: '婁', reading: 'ろう' },
  { kanji: '胃', reading: 'い' },
  { kanji: '昴', reading: 'ぼう' },
  { kanji: '畢', reading: 'ひつ' },
  { kanji: '觜', reading: 'し' },
  { kanji: '参', reading: 'しん' },
  { kanji: '井', reading: 'せい' },
  { kanji: '鬼', reading: 'き' },
  { kanji: '柳', reading: 'りゅう' },
  { kanji: '星', reading: 'せい' },
  { kanji: '張', reading: 'ちょう' },
  { kanji: '翼', reading: 'よく' },
  { kanji: '軫', reading: 'しん' },
]
