import type { RevelationId } from './types'

// 各天啓の実際の実装ロジックを、開発者向けに要約したもの(監査用)。
// 説明文テンプレート(revelations.ts の desc)とは独立して管理し、実装(revelationEffects.ts)を正として記述する。
// パラメータは実際の数値ではなく、paramsのキー名(nなど)のまま一般化して書く。
export const REVELATION_ACTUAL_EFFECTS: Record<RevelationId, string> = {
  kaku: '選んだ列の非ワイルドカードを全て♠に変換し、deckCompositionの対応する枠も同じスートに書き換える(ワイルドは対象外)',
  kou: '選んだ列の非ワイルドカードを全て♥に変換し、deckCompositionの対応する枠も同じスートに書き換える(ワイルドは対象外)',
  tei: '選んだ列の非ワイルドカードを全て♦に変換し、deckCompositionの対応する枠も同じスートに書き換える(ワイルドは対象外)',
  bou: '選んだ列の非ワイルドカードを全て♣に変換し、deckCompositionの対応する枠も同じスートに書き換える(ワイルドは対象外)',
  shin: '場札全体の非ワイルド♠を全て♥に変換し、deckCompositionの対応する枠も書き換える(♠以外・ワイルドは対象外)',
  bi: '場札全体の非ワイルド♥を全て♣に変換し、deckCompositionの対応する枠も書き換える(♥以外・ワイルドは対象外)',
  ki: '場札全体の非ワイルド♣を全て♦に変換し、deckCompositionの対応する枠も書き換える(♣以外・ワイルドは対象外)',
  to: '場札全体の非ワイルド♦を全て♠に変換し、deckCompositionの対応する枠も書き換える(♦以外・ワイルドは対象外)',
  gyu: '選んだ列の非ワイルドカードを、1枚ごとに個別抽選でA〜10のいずれかのランクへ変換し、deckCompositionの対応する枠も同じランクに書き換える(ワイルドは対象外)',
  jo: '選んだ列の非ワイルドカードを、1枚ごとに個別抽選でJ・Q・Kのいずれかのランクへ変換し、deckCompositionの対応する枠も同じランクに書き換える(ワイルドは対象外)',
  kyo: 'useRevelation内のgrantRevelationRewardで実施、wave/deckCompositionは変更しない。targetRelicIdで指定されたレリックがrun.relicsに存在し、かつ未付喪化(tsukumoka: false)であれば、そのエントリのtsukumokaをtrueに更新する。targetRelicIdがnull、対象が存在しない、または既に付喪化済みの場合は何もしない',
  aya: '選んだ列の一番上にワイルドを1枚追加し、deckCompositionにも新規ワイルドエントリを1件追加する(deckIdは配列長を採番して衝突を回避)',
  shitsu: '選んだ列の各カード(位置iごと)を、1つ左の列の同じ位置iのカードのランク+1(A⇔Kループ)に変換し、deckCompositionの対応する枠も同じランクに書き換える。左列がワイルドの位置・左列の方が短く対応する位置が無い場合はスキップ。選択列自身がワイルドの位置もスキップ。列0(左端)を選んだ場合の参照列は最終列',
  heki: '場札全体の非ワイルドカードを、変換前のスート基準の対応表(♠→♥、♥→♣、♣→♦、♦→♠)で1回だけ変換し、deckCompositionの対応する枠も書き換える(ワイルドは対象外、逐次適用ではないためカスケードしない)',
  kei: '空でない列を左から順に走査し、最初の列の一番上のカードのランクを起点に、i番目の列の一番上のカードをbase+i(A⇔Kループ)に変換する。deckCompositionの対応する枠も書き換える(空列はカウントしない、ワイルドの列はスキップするが順番はカウントする)',
  rou: '場札の全ての列の一番上のカード(ワイルド含む)をwave.tableauから取り除き、deckCompositionの対応する枠をremoved:trueにする(配列からは削除しない。空の列はスキップ)',
  i: '場札の非ワイルド実カードから最大ランク・最小ランクを求め、それぞれ該当カード(複数あればランダムに1枚)をwild:trueに変換する。wave.tableau・deckComposition双方を更新する',
  hitsu: '選んだ列の先頭カードのランクを起点に、使用ごとにランダムな方向(昇順/降順)で階段状のランク(A⇔Kループ)へ再配置する(秘儀「雷光」と同じアルゴリズム)。deckCompositionの対応する枠も書き換える(秘儀版と異なり永続化される)',
  shi: 'wave.chainの末尾1枚をwild:trueに変換し、foundationも更新する(秘儀「対話」と同じ効果)。deckCompositionの対応する枠も書き換える(秘儀版と異なり永続化される)。チェーンが空の場合は何もしない',
  sei: '場札の非ワイルド実カードからランダムにn枚選んでwild:trueに変換する(秘儀「賜物」と同じ方式)。wave.tableau・deckComposition双方を更新する(秘儀版と異なり永続化される)',
  subaru: 'ITEM_POOLから所持中の護符を除いてランダムに1つ選び、items.length < itemMaxCapacity(招き布袋像所持時は拡張)なら所持に追加する(useRevelation内のgrantRevelationRewardで実施、wave/deckCompositionは変更しない)',
  ryuu: 'run.currencyを2倍にする(useRevelation内のgrantRevelationRewardで実施、wave/deckCompositionは変更しない)',
  hotori: 'run.lastUsedRevelationId(hotori自身を使った場合は更新されない)を読み、revelations+oraclesの合算枚数(使用中の天啓自身を取り除いた後)が上限(基本2、千羽鶴所持時は拡張)未満なら追加する。履歴が無ければ何もしない',
  chou: 'ORACLE_POOLからrollOfferで2つ抽選し、revelations+oraclesの合算枚数(使用中の天啓自身を取り除いた後)の残り枠数(基本2、千羽鶴所持時は拡張)までoraclesに追加する',
  yoku: 'REVELATION_POOLからrollOfferで2つ抽選し、revelations+oraclesの合算枚数(使用中の天啓自身を取り除いた後)の残り枠数(基本2、千羽鶴所持時は拡張)までrevelationsに追加する',
  mitsu: '所持する各護符のitemSellPrice(params, run, id)を合計し、currencyに加算する',
  karasu: 'recentUsedRiteIds(最大2件、新しい順)を先頭からrites.lengthの残り枠数(基本上限3、破魔矢所持時は拡張)まで所持に追加する',
  oni: '(未実装。未所持のレリックをランダムに1つ獲得する予定)',
}
