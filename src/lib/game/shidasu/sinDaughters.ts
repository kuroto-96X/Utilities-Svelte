// 七つの大罪(傲慢・嫉妬・憤怒・怠惰・強欲・暴食・色欲)にそれぞれ紐づく「派生悪徳(娘罪)」の参照データ。
// BossKind(実装済み6種)とは独立しており、管理画面の「名前」<select>の選択肢・由来ラベル表示にのみ使う。
// 将来ボス候補を追加する際、ここから未使用の名前を選んで割り当てる。
export interface SinDaughterEntry {
  name: string
  parentSin: string
}

export const SIN_DAUGHTERS: SinDaughterEntry[] = [
  { name: '頑迷', parentSin: '傲慢' },
  { name: '偽善', parentSin: '傲慢' },
  { name: '虚栄', parentSin: '傲慢' },
  { name: '高慢', parentSin: '傲慢' },
  { name: '不遜', parentSin: '傲慢' },
  { name: '妬み', parentSin: '嫉妬' },
  { name: '憎悪', parentSin: '嫉妬' },
  { name: '中傷', parentSin: '嫉妬' },
  { name: '冷笑', parentSin: '嫉妬' },
  { name: '憤慨', parentSin: '憤怒' },
  { name: '口論', parentSin: '憤怒' },
  { name: '侮辱', parentSin: '憤怒' },
  { name: '激昂', parentSin: '憤怒' },
  { name: '無気力', parentSin: '怠惰' },
  { name: '怠慢', parentSin: '怠惰' },
  { name: '逃避', parentSin: '怠惰' },
  { name: '絶望', parentSin: '怠惰' },
  { name: '裏切り', parentSin: '強欲' },
  { name: '詐欺', parentSin: '強欲' },
  { name: '強奪', parentSin: '強欲' },
  { name: '独占欲', parentSin: '強欲' },
  { name: '浪費', parentSin: '暴食' },
  { name: '貪食', parentSin: '暴食' },
  { name: '放埓', parentSin: '暴食' },
  { name: '過食', parentSin: '暴食' },
  { name: '誘惑', parentSin: '色欲' },
  { name: '耽溺', parentSin: '色欲' },
  { name: '執着', parentSin: '色欲' },
  { name: '淫蕩', parentSin: '色欲' },
]
