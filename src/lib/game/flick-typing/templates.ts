export type SlotKey = 'adj' | 'noun' | 'subject' | 'location' | 'verb'

export type WordPart =
  | { type: 'ruby'; kanji: string; reading: string }
  | { type: 'plain'; text: string }

export type PatternPart =
  | { type: 'slot'; key: SlotKey }
  | { type: 'ruby'; kanji: string; reading: string }
  | { type: 'plain'; text: string }

// 助詞はテンプレート側に固定。単語リストには含めない。
export const patterns: PatternPart[][] = [
  // {adj}{noun}をたべた
  [{ type: 'slot', key: 'adj' }, { type: 'slot', key: 'noun' }, { type: 'plain', text: 'を' }, { type: 'ruby', kanji: '食', reading: 'た' }, { type: 'plain', text: 'べた' }],
  // {adj}{noun}がみえる
  [{ type: 'slot', key: 'adj' }, { type: 'slot', key: 'noun' }, { type: 'plain', text: 'が' }, { type: 'ruby', kanji: '見', reading: 'み' }, { type: 'plain', text: 'える' }],
  // {adj}{noun}のにおいがする
  [{ type: 'slot', key: 'adj' }, { type: 'slot', key: 'noun' }, { type: 'plain', text: 'のにおいがする' }],
  // {adj}{noun}をもらった
  [{ type: 'slot', key: 'adj' }, { type: 'slot', key: 'noun' }, { type: 'plain', text: 'をもらった' }],
  // {adj}{noun}をかった
  [{ type: 'slot', key: 'adj' }, { type: 'slot', key: 'noun' }, { type: 'plain', text: 'を' }, { type: 'ruby', kanji: '買', reading: 'か' }, { type: 'plain', text: 'った' }],
  // {subject}が{location}{verb}
  [{ type: 'slot', key: 'subject' }, { type: 'plain', text: 'が' }, { type: 'slot', key: 'location' }, { type: 'slot', key: 'verb' }],
  // {subject}と{noun}をみた
  [{ type: 'slot', key: 'subject' }, { type: 'plain', text: 'と' }, { type: 'slot', key: 'noun' }, { type: 'plain', text: 'を' }, { type: 'ruby', kanji: '見', reading: 'み' }, { type: 'plain', text: 'た' }],
  // {subject}が{noun}を{verb}
  [{ type: 'slot', key: 'subject' }, { type: 'plain', text: 'が' }, { type: 'slot', key: 'noun' }, { type: 'plain', text: 'を' }, { type: 'slot', key: 'verb' }],
  // {subject}は{location}{verb}
  [{ type: 'slot', key: 'subject' }, { type: 'plain', text: 'は' }, { type: 'slot', key: 'location' }, { type: 'slot', key: 'verb' }],
  // {subject}に{adj}{noun}をあげた
  [{ type: 'slot', key: 'subject' }, { type: 'plain', text: 'に' }, { type: 'slot', key: 'adj' }, { type: 'slot', key: 'noun' }, { type: 'plain', text: 'を' }, { type: 'ruby', kanji: '上', reading: 'あ' }, { type: 'plain', text: 'げた' }],
  // {subject}が{adj}{noun}をもっている
  [{ type: 'slot', key: 'subject' }, { type: 'plain', text: 'が' }, { type: 'slot', key: 'adj' }, { type: 'slot', key: 'noun' }, { type: 'plain', text: 'を' }, { type: 'ruby', kanji: '持', reading: 'も' }, { type: 'plain', text: 'っている' }],
  // {subject}が{adj}{noun}をもらった
  [{ type: 'slot', key: 'subject' }, { type: 'plain', text: 'が' }, { type: 'slot', key: 'adj' }, { type: 'slot', key: 'noun' }, { type: 'plain', text: 'をもらった' }],
  // {subject}は{adj}{noun}がすきだ
  [{ type: 'slot', key: 'subject' }, { type: 'plain', text: 'は' }, { type: 'slot', key: 'adj' }, { type: 'slot', key: 'noun' }, { type: 'plain', text: 'が' }, { type: 'ruby', kanji: '好', reading: 'す' }, { type: 'plain', text: 'きだ' }],
  // {subject}は{noun}が{adj}
  [{ type: 'slot', key: 'subject' }, { type: 'plain', text: 'は' }, { type: 'slot', key: 'noun' }, { type: 'plain', text: 'が' }, { type: 'slot', key: 'adj' }],
  // {subject}は{noun}をもっている
  [{ type: 'slot', key: 'subject' }, { type: 'plain', text: 'は' }, { type: 'slot', key: 'noun' }, { type: 'plain', text: 'を' }, { type: 'ruby', kanji: '持', reading: 'も' }, { type: 'plain', text: 'っている' }],
  // {subject}が{noun}をさがしている
  [{ type: 'slot', key: 'subject' }, { type: 'plain', text: 'が' }, { type: 'slot', key: 'noun' }, { type: 'plain', text: 'を' }, { type: 'ruby', kanji: '探', reading: 'さが' }, { type: 'plain', text: 'している' }],
  // {adj}{noun}が{location}ある
  [{ type: 'slot', key: 'adj' }, { type: 'slot', key: 'noun' }, { type: 'plain', text: 'が' }, { type: 'slot', key: 'location' }, { type: 'plain', text: 'ある' }],
  // {adj}{noun}が{verb}
  [{ type: 'slot', key: 'adj' }, { type: 'slot', key: 'noun' }, { type: 'plain', text: 'が' }, { type: 'slot', key: 'verb' }],
  // {location}{adj}{noun}がいる
  [{ type: 'slot', key: 'location' }, { type: 'slot', key: 'adj' }, { type: 'slot', key: 'noun' }, { type: 'plain', text: 'がいる' }],
  // {location}{noun}がある
  [{ type: 'slot', key: 'location' }, { type: 'slot', key: 'noun' }, { type: 'plain', text: 'がある' }],
  // {noun}が{location}ある
  [{ type: 'slot', key: 'noun' }, { type: 'plain', text: 'が' }, { type: 'slot', key: 'location' }, { type: 'plain', text: 'ある' }],
  // {location}{subject}が{verb}
  [{ type: 'slot', key: 'location' }, { type: 'slot', key: 'subject' }, { type: 'plain', text: 'が' }, { type: 'slot', key: 'verb' }],
]

export const adjectives: WordPart[][] = [
  [{ type: 'ruby', kanji: '赤', reading: 'あか' }, { type: 'plain', text: 'い' }],
  [{ type: 'ruby', kanji: '青', reading: 'あお' }, { type: 'plain', text: 'い' }],
  [{ type: 'ruby', kanji: '白', reading: 'しろ' }, { type: 'plain', text: 'い' }],
  [{ type: 'ruby', kanji: '黒', reading: 'くろ' }, { type: 'plain', text: 'い' }],
  [{ type: 'ruby', kanji: '黄色', reading: 'きいろ' }, { type: 'plain', text: 'い' }],
  [{ type: 'ruby', kanji: '大', reading: 'おお' }, { type: 'plain', text: 'きい' }],
  [{ type: 'ruby', kanji: '小', reading: 'ちい' }, { type: 'plain', text: 'さい' }],
  [{ type: 'ruby', kanji: '新', reading: 'あたら' }, { type: 'plain', text: 'しい' }],
  [{ type: 'ruby', kanji: '古', reading: 'ふる' }, { type: 'plain', text: 'い' }],
  [{ type: 'ruby', kanji: '広', reading: 'ひろ' }, { type: 'plain', text: 'い' }],
  [{ type: 'ruby', kanji: '狭', reading: 'せま' }, { type: 'plain', text: 'い' }],
  [{ type: 'ruby', kanji: '冷', reading: 'つめ' }, { type: 'plain', text: 'たい' }],
  [{ type: 'ruby', kanji: '温', reading: 'あたた' }, { type: 'plain', text: 'かい' }],
  [{ type: 'ruby', kanji: '暑', reading: 'あつ' }, { type: 'plain', text: 'い' }],
  [{ type: 'ruby', kanji: '寒', reading: 'さむ' }, { type: 'plain', text: 'い' }],
  [{ type: 'ruby', kanji: '優', reading: 'やさ' }, { type: 'plain', text: 'しい' }],
  [{ type: 'ruby', kanji: '柔', reading: 'やわ' }, { type: 'plain', text: 'らかい' }],
  [{ type: 'ruby', kanji: '固', reading: 'かた' }, { type: 'plain', text: 'い' }],
  [{ type: 'ruby', kanji: '重', reading: 'おも' }, { type: 'plain', text: 'い' }],
  [{ type: 'ruby', kanji: '軽', reading: 'かる' }, { type: 'plain', text: 'い' }],
  [{ type: 'ruby', kanji: '明', reading: 'あか' }, { type: 'plain', text: 'るい' }],
  [{ type: 'ruby', kanji: '暗', reading: 'くら' }, { type: 'plain', text: 'い' }],
  [{ type: 'ruby', kanji: '速', reading: 'はや' }, { type: 'plain', text: 'い' }],
  [{ type: 'ruby', kanji: '遅', reading: 'おそ' }, { type: 'plain', text: 'い' }],
  [{ type: 'ruby', kanji: '長', reading: 'なが' }, { type: 'plain', text: 'い' }],
  [{ type: 'ruby', kanji: '短', reading: 'みじか' }, { type: 'plain', text: 'い' }],
  [{ type: 'ruby', kanji: '高', reading: 'たか' }, { type: 'plain', text: 'い' }],
  [{ type: 'ruby', kanji: '低', reading: 'ひく' }, { type: 'plain', text: 'い' }],
  [{ type: 'ruby', kanji: '丸', reading: 'まる' }, { type: 'plain', text: 'い' }],
  [{ type: 'ruby', kanji: '甘', reading: 'あま' }, { type: 'plain', text: 'い' }],
  [{ type: 'ruby', kanji: '辛', reading: 'から' }, { type: 'plain', text: 'い' }],
  [{ type: 'ruby', kanji: '酸', reading: 'す' }, { type: 'plain', text: 'っぱい' }],
]

export const nouns: WordPart[][] = [
  [{ type: 'plain', text: 'りんご' }],
  [{ type: 'ruby', kanji: '桃', reading: 'もも' }],
  [{ type: 'ruby', kanji: '梨', reading: 'なし' }],
  [{ type: 'plain', text: 'ぶどう' }],
  [{ type: 'ruby', kanji: '苺', reading: 'いちご' }],
  [{ type: 'plain', text: 'みかん' }],
  [{ type: 'plain', text: 'すいか' }],
  [{ type: 'ruby', kanji: '山', reading: 'やま' }],
  [{ type: 'ruby', kanji: '海', reading: 'うみ' }],
  [{ type: 'ruby', kanji: '川', reading: 'かわ' }],
  [{ type: 'ruby', kanji: '森', reading: 'もり' }],
  [{ type: 'ruby', kanji: '空', reading: 'そら' }],
  [{ type: 'ruby', kanji: '月', reading: 'つき' }],
  [{ type: 'ruby', kanji: '星', reading: 'ほし' }],
  [{ type: 'ruby', kanji: '太陽', reading: 'たいよう' }],
  [{ type: 'ruby', kanji: '花', reading: 'はな' }],
  [{ type: 'ruby', kanji: '葉', reading: 'は' }, { type: 'plain', text: 'っぱ' }],
  [{ type: 'ruby', kanji: '種', reading: 'たね' }],
  [{ type: 'ruby', kanji: '草', reading: 'くさ' }],
  [{ type: 'ruby', kanji: '雲', reading: 'くも' }],
  [{ type: 'ruby', kanji: '水', reading: 'みず' }],
  [{ type: 'ruby', kanji: '光', reading: 'ひかり' }],
  [{ type: 'ruby', kanji: '風', reading: 'かぜ' }],
  [{ type: 'ruby', kanji: '雨', reading: 'あめ' }],
  [{ type: 'ruby', kanji: '雪', reading: 'ゆき' }],
  [{ type: 'ruby', kanji: '氷', reading: 'こおり' }],
  [{ type: 'ruby', kanji: '石', reading: 'いし' }],
  [{ type: 'ruby', kanji: '道', reading: 'みち' }],
  [{ type: 'ruby', kanji: '橋', reading: 'はし' }],
  [{ type: 'ruby', kanji: '窓', reading: 'まど' }],
  [{ type: 'ruby', kanji: '魚', reading: 'さかな' }],
  [{ type: 'ruby', kanji: '虫', reading: 'むし' }],
  [{ type: 'ruby', kanji: '鳥', reading: 'とり' }],
  [{ type: 'ruby', kanji: '蝶', reading: 'ちょう' }],
]

export const subjects: WordPart[][] = [
  [{ type: 'ruby', kanji: '猫', reading: 'ねこ' }],
  [{ type: 'ruby', kanji: '犬', reading: 'いぬ' }],
  [{ type: 'ruby', kanji: '子', reading: 'こ' }, { type: 'plain', text: 'ども' }],
  [{ type: 'plain', text: 'お' }, { type: 'ruby', kanji: '爺', reading: 'じい' }, { type: 'plain', text: 'さん' }],
  [{ type: 'plain', text: 'お' }, { type: 'ruby', kanji: '婆', reading: 'ばあ' }, { type: 'plain', text: 'さん' }],
  [{ type: 'ruby', kanji: '男', reading: 'おとこ' }, { type: 'plain', text: 'の' }, { type: 'ruby', kanji: '子', reading: 'こ' }],
  [{ type: 'ruby', kanji: '女', reading: 'おんな' }, { type: 'plain', text: 'の' }, { type: 'ruby', kanji: '子', reading: 'こ' }],
  [{ type: 'plain', text: 'お' }, { type: 'ruby', kanji: '母', reading: 'かあ' }, { type: 'plain', text: 'さん' }],
  [{ type: 'plain', text: 'お' }, { type: 'ruby', kanji: '父', reading: 'とう' }, { type: 'plain', text: 'さん' }],
  [{ type: 'ruby', kanji: '鳥', reading: 'とり' }],
  [{ type: 'plain', text: 'うさぎ' }],
  [{ type: 'ruby', kanji: '狐', reading: 'きつね' }],
  [{ type: 'ruby', kanji: '熊', reading: 'くま' }],
  [{ type: 'ruby', kanji: '狸', reading: 'たぬき' }],
  [{ type: 'ruby', kanji: '亀', reading: 'かめ' }],
  [{ type: 'ruby', kanji: '私', reading: 'わたし' }],
  [{ type: 'ruby', kanji: '君', reading: 'きみ' }],
]

export const locations: WordPart[][] = [
  [{ type: 'ruby', kanji: '公園', reading: 'こうえん' }, { type: 'plain', text: 'で' }],
  [{ type: 'ruby', kanji: '山', reading: 'やま' }, { type: 'plain', text: 'で' }],
  [{ type: 'ruby', kanji: '海', reading: 'うみ' }, { type: 'plain', text: 'で' }],
  [{ type: 'ruby', kanji: '森', reading: 'もり' }, { type: 'plain', text: 'で' }],
  [{ type: 'ruby', kanji: '川', reading: 'かわ' }, { type: 'plain', text: 'で' }],
  [{ type: 'ruby', kanji: '外', reading: 'そと' }, { type: 'plain', text: 'で' }],
  [{ type: 'ruby', kanji: '庭', reading: 'にわ' }, { type: 'plain', text: 'で' }],
  [{ type: 'ruby', kanji: '道', reading: 'みち' }, { type: 'plain', text: 'で' }],
  [{ type: 'ruby', kanji: '丘', reading: 'おか' }, { type: 'plain', text: 'で' }],
  [{ type: 'ruby', kanji: '浜辺', reading: 'はまべ' }, { type: 'plain', text: 'で' }],
  [{ type: 'ruby', kanji: '家', reading: 'いえ' }, { type: 'plain', text: 'で' }],
  [{ type: 'ruby', kanji: '学校', reading: 'がっこう' }, { type: 'plain', text: 'で' }],
  [{ type: 'ruby', kanji: '村', reading: 'むら' }, { type: 'plain', text: 'で' }],
  [{ type: 'ruby', kanji: '町', reading: 'まち' }, { type: 'plain', text: 'で' }],
  [{ type: 'ruby', kanji: '田', reading: 'た' }, { type: 'plain', text: 'んぼで' }],
  [{ type: 'ruby', kanji: '教室', reading: 'きょうしつ' }, { type: 'plain', text: 'で' }],
]

export const verbPhrases: WordPart[][] = [
  [{ type: 'ruby', kanji: '食', reading: 'た' }, { type: 'plain', text: 'べた' }],
  [{ type: 'ruby', kanji: '飲', reading: 'の' }, { type: 'plain', text: 'んだ' }],
  [{ type: 'ruby', kanji: '見', reading: 'み' }, { type: 'plain', text: 'た' }],
  [{ type: 'ruby', kanji: '聞', reading: 'き' }, { type: 'plain', text: 'いた' }],
  [{ type: 'ruby', kanji: '走', reading: 'はし' }, { type: 'plain', text: 'った' }],
  [{ type: 'ruby', kanji: '歩', reading: 'ある' }, { type: 'plain', text: 'いた' }],
  [{ type: 'ruby', kanji: '書', reading: 'か' }, { type: 'plain', text: 'いた' }],
  [{ type: 'ruby', kanji: '読', reading: 'よ' }, { type: 'plain', text: 'んだ' }],
  [{ type: 'ruby', kanji: '歌', reading: 'うた' }, { type: 'plain', text: 'った' }],
  [{ type: 'ruby', kanji: '踊', reading: 'おど' }, { type: 'plain', text: 'った' }],
  [{ type: 'ruby', kanji: '眠', reading: 'ねむ' }, { type: 'plain', text: 'った' }],
  [{ type: 'ruby', kanji: '笑', reading: 'わら' }, { type: 'plain', text: 'った' }],
  [{ type: 'ruby', kanji: '泣', reading: 'な' }, { type: 'plain', text: 'いた' }],
  [{ type: 'ruby', kanji: '飛', reading: 'と' }, { type: 'plain', text: 'んだ' }],
  [{ type: 'ruby', kanji: '泳', reading: 'およ' }, { type: 'plain', text: 'いだ' }],
  [{ type: 'ruby', kanji: '止', reading: 'と' }, { type: 'plain', text: 'まった' }],
  [{ type: 'ruby', kanji: '帰', reading: 'かえ' }, { type: 'plain', text: 'った' }],
  [{ type: 'ruby', kanji: '来', reading: 'き' }, { type: 'plain', text: 'た' }],
  [{ type: 'ruby', kanji: '見', reading: 'み' }, { type: 'plain', text: 'ている' }],
  [{ type: 'ruby', kanji: '走', reading: 'はし' }, { type: 'plain', text: 'っている' }],
  [{ type: 'ruby', kanji: '寝', reading: 'ね' }, { type: 'plain', text: 'ている' }],
  [{ type: 'ruby', kanji: '遊', reading: 'あそ' }, { type: 'plain', text: 'んでいる' }],
  [{ type: 'ruby', kanji: '探', reading: 'さが' }, { type: 'plain', text: 'している' }],
  [{ type: 'ruby', kanji: '読', reading: 'よ' }, { type: 'plain', text: 'んでいる' }],
  [{ type: 'ruby', kanji: '飛', reading: 'と' }, { type: 'plain', text: 'んでいる' }],
  [{ type: 'ruby', kanji: '歌', reading: 'うた' }, { type: 'plain', text: 'っている' }],
  [{ type: 'ruby', kanji: '待', reading: 'ま' }, { type: 'plain', text: 'っている' }],
  [{ type: 'ruby', kanji: '考', reading: 'かんが' }, { type: 'plain', text: 'えている' }],
]
