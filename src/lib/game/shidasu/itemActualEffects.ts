import type { ItemId } from './types'

// 各護符の実際の実装ロジックを、開発者向けに要約したもの(監査用)。
// 説明文テンプレート(items.ts の desc)とは独立して管理し、実装(if条件・計算式)を正として記述する。
// パラメータは実際の数値ではなく、paramsのキー名(x, c, n, m, p など)のまま一般化して書く。
export const ITEM_ACTUAL_EFFECTS: Record<ItemId, string> = {
  // 初期実装
  bridge: '常時、階段・同スート/同色パターンの成立に必要な枚数をm枚少なくする(effectiveStairMinLen/effectiveSuitColorMinLenをm引き下げ)',
  grace: '列がちょうど空になった瞬間、その列のコンボ開始時枚数がrows-m以下でも列一掃(columnSweep)として扱う',

  // グループ1: 全消しボーナス
  patience: '全消しボーナスに、山札残り枚数×xを加算する',
  purify: '全消しボーナスにnを加算する',
  temperance: '全消しボーナスを(1+山札残り枚数×x)倍にする',

  // グループ2: カード単体の属性
  springBreeze: '取得したカードが♣のとき、獲得点にnを加算する',
  summerBreeze: '取得したカードが♦のとき、獲得点にnを加算する',
  autumnBreeze: '取得したカードが♥のとき、獲得点にnを加算する',
  winterBreeze: '取得したカードが♠のとき、獲得点にnを加算する',
  kinship: '直前の場札が♥以外から今回♥に変わった瞬間、獲得点にnを加算する',
  thaw: '直前の場札が♠から今回♠以外に変わった瞬間、獲得点にnを加算する',
  dusk: '直前の場札が赤(♥/♦)から今回黒(♠/♣)に変わった瞬間、獲得点にnを加算する',
  dawn: '直前の場札が黒(♠/♣)から今回赤(♥/♦)に変わった瞬間、獲得点にnを加算する',
  wit: '取得したカードがワイルドのとき、獲得点にnを加算する',

  // グループ3: 現在のコンボ数判定
  courage: '獲得点を(1+コンボ数×x)倍にする(常時)',
  daybreak: 'コンボ数がc以下のとき、獲得点をx倍にする',
  twilight: 'コンボ数がc以上のとき、獲得点をx倍にする',
  cheerful: 'コンボ数が偶数のとき、獲得点にnを加算する',
  conscience: 'コンボ数が奇数のとき、獲得点にnを加算する',
  morningMist: 'コンボ数がc未満なら獲得点を1/xに、c以上ならx倍にする(常時)',

  // グループ4: チェーン全体の属性
  calm: 'チェーン全体にJ/Q/K(絵札)の実カードが1枚も無ければ、獲得点にnを加算する',
  serenity: 'チェーン全体にJ/Q/Kが無ければ、獲得点をx倍にする',
  destiny: 'チェーン全体の実カードが全て絵札(J/Q/K)なら、獲得点にnを加算する',
  fate: 'チェーン全体が絵札のみなら、獲得点をx倍にする',
  relief: '今回プレイした1枚がワイルド、またはランク1〜10なら、獲得点にnを加算する',
  verdantGreen: 'チェーン全体の実カードが♣専有なら、獲得点をx倍にする',
  gem: 'チェーン全体の実カードが♦専有なら、獲得点をx倍にする',
  resolve: 'チェーン全体の実カードが♠専有なら、獲得点をx倍にする',
  grail: 'チェーン全体の実カードが♥専有なら、獲得点をx倍にする',
  moonlight: 'チェーン全体の実カードが黒(♠/♣)専有なら、獲得点をx倍にする',
  sunlight: 'チェーン全体の実カードが赤(♥/♦)専有なら、獲得点をx倍にする',
  crown: 'チェーン内のK実枚数+ワイルド枚数の合計count(>0)に対し、獲得点を(1+count×x)倍にする',
  cloverLeaf: 'チェーン内の♣実枚数+ワイルド枚数の合計count(>0)に、count×nを加算する',
  coin: 'チェーン内の♦実枚数+ワイルド枚数の合計count(>0)に、count×nを加算する',
  blade: 'チェーン内の♠実枚数+ワイルド枚数の合計count(>0)に、count×nを加算する',
  chalice: 'チェーン内の♥実枚数+ワイルド枚数の合計count(>0)に、count×nを加算する',
  balance: 'チェーン内の赤黒差がワイルドで埋めて同数にできるとき、獲得点にnを加算する',
  harmony: 'balanceと同一条件(赤黒同数化可能)のとき、獲得点をx倍にする',
  nobility: 'チェーン全体が同一スート専有、かつチェーン長がeffectiveSuitColorMinLen以上のとき、獲得点にnを加算する',
  tenacity: 'nobilityと同一条件のとき、獲得点を(1+チェーン長×x)倍にする',
  determination: 'チェーン全体が方向の定まった階段(長さeffectiveStairMinLen以上)のとき、獲得点を(1+階段長×x)倍にする',
  cycle: '直前の場札と今回のカードの組がK→AまたはA→K(ワイルドは万能扱い)のとき、獲得点をx倍にする',
  reincarnation: 'このプレイでコンプリートラン成立、かつ階段がK→A/A→Kの境界を跨いでいるとき、獲得点をx倍にする',
  majesty: 'このプレイでコンプリートラン成立、かつ階段成立、かつチェーン全体が同一スート専有のとき、獲得点をx倍にする',

  // グループ5: 場札・山札の残り枚数
  omen: 'このプレイ後の場札残り枚数がm以下のとき、獲得点をx倍にする',
  crescent: 'omenと同一条件(場札残りm以下)のとき、獲得点をx倍にする(omenとは独立に多重適用される)',

  // グループ6: 役・パターン成立状況
  blessing: 'このプレイで役ボーナス(列一掃含む)が1つでも成立したとき、獲得点をx倍にする',
  focus: 'このプレイで同ランクの役が成立したとき、獲得点をx倍にする',
  lapis: 'このプレイで成立した役ボーナス数+パターンボーナス数の合計が2以上のとき、獲得点をx倍にする',
  jade: 'このプレイで成立した役のいずれかがワイルド使用によるものだったとき、獲得点にnを加算する',
  emptyMind: 'このプレイで役もパターンボーナスも一切成立しなかったとき、獲得点をx倍にする',

  // グループ7: コンボ内の位置
  prologue: '通常プレイでチェーン内1枚目のプレイのとき、獲得点にnを加算する',
  interlude: '通常プレイでチェーン内ちょうどm枚目のプレイのとき、獲得点にnを加算する',
  morningDew: 'ウェーブ開始後まだ一度もプレイしていない状態での最初のプレイのとき、獲得点にnを加算する',

  // グループ8: 無条件固定加算
  drizzle: '常に無条件で獲得点にnを加算する',

  // 永続デッキ・捨て札系
  eternity: 'ウェーブ開始時、デッキ構成の末尾にワイルドカードを1枚追加する(以降のウェーブにも引き継がれる)',
  abundance: 'ウェーブ開始時、デッキ構成の非ワイルドカードを1枚ランダムにワイルドへ変換する(以降のウェーブにも引き継がれる)',
  silence: '山札からめくったカードでプレイ可能な列が無いとき、そのカードをワイルドにして使用し、さらにデッキ構成の別の1枚もランダムにワイルドへ変換する',
  resilience: '手詰まり時、コンボリセット後に捨て札が1枚以上ありウェーブ中未使用なら、スコアのp%を消費して捨て札の半数を山札へ戻し、その後山札を1枚めくる(ウェーブ中1回のみ)',

  // グループ9: 列選択の連続性
  gentleBreeze: '同じ列を連続でプレイした回数(sameColumnStreak)が2回目以降のとき、獲得点にsameColumnStreak×nを加算する',
  resonance: 'gentleBreezeと同一条件のとき、獲得点を(1+sameColumnStreak×x)倍にする',

  // グループ10: ウェーブ内累積state
  azureSky: 'ウェーブ内の列一掃累計回数が1回以上のとき、獲得点を(1+累計回数×x)倍にする',
  amber: 'ウェーブ内最大到達コンボ数が1以上のとき、獲得点を(1+最大コンボ数×x)倍にする',

  // グループ11: イベント発生時のbaseComboCount/echoX/shootingStarN強化
  composure: 'drawStockの通常コンボリセット時、リセット後にプレイ可能な列が無ければ、baseComboCountに永続でnを加算する',
  clarity: 'drawStockの通常コンボリセット時、そのチェーン中に役が一度も成立していなければ、baseComboCountに永続でnを加算する',
  arrogance: 'playCardの獲得点計算時、山札が0枚なら獲得点をx倍にする',
  echo: 'drawStockの通常コンボリセット時、リセット前のコンボ数×nを永続倍率echoXとして蓄積し、以後の獲得点に乗算する(全消し・手詰まりによるリセットは対象外)',
  shootingStar: 'コンボ数が初めてc以上に達するたび、永続加算shootingStarNにnを蓄積し、以後の獲得点に加算する(到達した同じプレイの獲得点には反映されない)',

  // グループ12: 山札めくり関連
  naive: '山札めくりでパターンが実際に継続する場合、通常プレイとほぼ同じ得点計算(基礎点・チェーンボーナス・コンボ加算・護符効果)を実行する(未所持時は継続してもスコア計算されない。鋼鉄の予約消費/予約加算・明星の役ボーナス倍率・聖化のbaseComboCount更新はこの計算には反映されない)',
  intuition: '現在のチェーン中に山札めくりでパターン継続した回数(drawContinueCountThisChain)に応じ、獲得点を(1+回数×x)倍にする(素朴とは独立に発動条件を持つ)',
  sincerity: '山札めくりでパターンが実際に継続する場合(同スート・同色・階段いずれでも、博愛による救済継続を除く)、wave.comboに直接nを加算する(naiveの有無に関わらず適用され、次のプレイのeffectiveComboに反映される)',

  // グループ13: 資源操作(残り)
  promise: '山札の中から、次にめくった際にパターン継続できる最初のカードを探し、めくり位置(末尾)へ入れ替える(ウェーブ開始時・パターン継続直後・drawStockの通常コンボリセット直後の3箇所のみで実行、全消し・手詰まりによるリセット後は対象外)',
  regeneration: '全消し時、コンボリセット後に山札が1枚以上ありウェーブ中未使用なら、スコアのp%を消費して捨て札から場札を全復活させ、その後山札を1枚めくる(ウェーブ中1回のみ)',

  // グループ14: 保護・救済
  benevolence: '山札めくりでパターンが継続しない場合、このコンボ中まだ未使用なら、コンボリセットを行わずチェーン・コンボ状態を維持したまま継続扱いにする(コンボごとに1回のみ)',
  healing: 'コンボリセット時(通常・全消し・手詰まりいずれも)、そのコンボ中に列一掃した列を、コンボ開始時点の枚数を上限に捨て札から復活させる',

  // グループ15: 情報表示
  guidance: '山札が1枚以上あるとき、次にめくられるカードを画面に表示する(スコア・挙動への影響はない情報表示のみ)',

  // グループ16: 持続効果
  passion: '現在のコンボ中に一度でもフラッシュが成立していれば、獲得点をx倍にする',
  fightingSpirit: 'このウェーブ中に一度でも列一掃が発生していれば、獲得点をx倍にする',

  // グループ17: コアパラメータ書き換え
  sanctify: '通常プレイで役が成立するたび基礎コンボ数(baseComboCount)を永続的に+1する(素朴による山札めくり継続時は対象外)。baseComboCountはコンボリセット処理では参照されず、得点計算時の実効コンボ(effectiveCombo)に常に加算される別枠の値',
  protection: '得点計算用の実効コンボがc未満なら、cまで引き上げる(実コンボ数自体は変えない)',
  earth: '得点計算用の実効コンボに常にcを加算する',
  golden: 'コンボが進む際、+1ではなく+2する',
  morningStar: '各役ボーナス(列一掃含む)の加点額を、その役がウェーブ中に過去成立した回数に応じて(1+過去回数×x)倍にする',
  mercy: 'コンボリセット直前のコンボ数がc以下なら次のコンボを有効化し、そのコンボ中の獲得点をx倍にする',
  mirror: '成立した役ボーナスのうち未予約の1つを次のプレイ用に予約し、次のプレイの基礎点に無条件加算する(同一役タイプにつき1コンボ1回。異なる役タイプならコンボ内で複数回予約されうる)',
  deadline: '山札残り枚数(0のときは無効)×nを獲得点に加算する',

  // グループ18: 判定ロジック内部干渉
  dedication: '所持中、フラッシュが成立するたび累積倍率dedicationXに永続的にnを加算する(1から開始)。獲得点に常にdedicationXを乗算する',
  diligence: '所持中、同ランクの役が成立するたび累積倍率diligenceXに永続的にnを加算する(1から開始)。獲得点に常にdiligenceXを乗算する',
  divineProtection: '所持中、ロイヤルセットが成立するたび累積倍率divineProtectionXに永続的にnを加算する(1から開始)。獲得点に常にdivineProtectionXを乗算する',
  fortitude: 'Wave開始時、その時点の山札+場札の合計枚数(deckComposition.length)がn枚ごとに基礎コンボ数(baseComboCount)を+1する',
  waterMirror: '護符の並び順(run.items配列)で自分の左隣(添字-1)にある護符の効果を、その時点の値に対して追加でもう一度適用する(自分が先頭の場合は何も起きない)',
  vow: '獲得点に常にx倍算する。isPlayableでチェーン最新実カードとの色不一致を禁止する制約と対になる(制約自体はengine.tsのisPlayable内で実装)',
  pact: '獲得点に常にx倍算する。isPlayableでチェーン最新実カードとのスート不一致を禁止する制約と対になる(制約自体はengine.tsのisPlayable内で実装)',
  crimson: '直接のスコア加算/倍算は持たない。cardColorsを通じて全ての札がredを含むものとして扱われ、色判定系の護符・isPlayableの色制約・秘儀ヴンヨー/ラグズの赤黒判定に影響する',
  jetBlack: '直接のスコア加算/倍算は持たない。cardColorsを通じて全ての札がblackを含むものとして扱われ、色判定系の護符・isPlayableの色制約・秘儀ヴンヨー/ラグズの赤黒判定に影響する',
  silver: '獲得点に常にx倍算する。CardFace.svelte側でスート記号非表示・色をグレー統一する表示変更と対になる(スコア計算・isPlayable・コンボ継続判定には一切影響しない)',

  // グループ18: 秘儀/天啓/神託使用への永続加算
  discretion: '所持中、天啓・神託・秘儀のいずれかを使用するたび永続的にdiscretionNにnを加算する(10から開始)。playCardのgained計算時にdiscretionN分を加算する',
  frost: '所持中、天啓・神託・秘儀のいずれかを使用するたび永続的にfrostXにxを加算する(1から開始)。playCardのgained計算時にfrostXを乗算する',

  // グループ23: 売値ボーナス(方向性1)
  exchange: '秘儀・天啓・神託のいずれかを使用した直後、この護符自身のsellBonusにnを加算する',
  koban: 'コンボ数がc未満からc以上へ変化した瞬間(エッジトリガー)、この護符自身のsellBonusにnを加算する',
  senryo: 'コンボ数がc未満からc以上へ変化した瞬間(エッジトリガー)、この護符自身のsellBonusにnを加算する',
  manryo: 'コンボ数がc未満からc以上へ変化した瞬間(エッジトリガー)、この護符自身のsellBonusにnを加算する',
  harvest: '全消し(remainingTableauCount===0)を達成したプレイで、この護符自身のsellBonusにnを加算する',
  settlement: 'ウェーブクリア確定時、そのウェーブのplayCountThisWaveがc以下であれば、この護符自身のsellBonusにnを加算する',
  hiddenTreasure: '取得したカードが♠のAのとき、この護符自身のsellBonusにnを加算する',
  greatestTreasure: '取得したカードが♥のKのとき、この護符自身のsellBonusにnを加算する',
  heirloom: '取得したカードが♦のJのとき、この護符自身のsellBonusにnを加算する',
  treasury: '取得したカードが♣のQのとき、この護符自身のsellBonusにnを加算する',
  boom: 'そのプレイでroleFiredにflushが含まれるとき、この護符自身のsellBonusにnを加算する',
  abundantFunds: '場札の残り枚数がm超からm以下へ変化した瞬間(エッジトリガー)、この護符自身のsellBonusにnを加算する',
  savings: '同じ列を連続でプレイした場合(2回目以降)、この護符自身のsellBonusに(連続回数-1)×nを加算する',
  bigCatch: 'そのプレイで列一掃(sweepQualifies)が成立したとき、この護符自身のsellBonusにnを加算する',
  grains: '取得したカードがワイルドのとき、この護符自身のsellBonusにnを加算する',
  liveliness: 'analyzeSuitColorがsuitHeld=trueを返し、かつチェーン長がm以上のとき、この護符自身のsellBonusにnを加算する',
  prosperity: 'analyzeSuitColorがcolorHeld=trueを返し、かつチェーン長がm以上のとき、この護符自身のsellBonusにnを加算する',
  heavenlyBlessing: 'analyzeStairが階段成立(held&&dir!==0)を返し、かつstairInfo.lenがm以上のとき、この護符自身のsellBonusにnを加算する',
  mizuho: 'analyzeAlternatingColorにminLen=mを渡してheld=trueが返るとき、この護符自身のsellBonusにnを加算する',
  bountifulYear: 'そのプレイでroleFiredにroyalSetが含まれるとき、この護符自身のsellBonusにnを加算する',
  profit: 'そのプレイでroleFiredにsameRankが含まれるとき、この護符自身のsellBonusにnを加算する',
  bounty: 'そのプレイでroleFiredにcompleteRunが含まれるとき、この護符自身のsellBonusにnを加算する',
  perk: 'そのプレイでroleFiredにpairが含まれるとき、この護符自身のsellBonusにnを加算する',
  nestEgg: '他の護符が売却されるたび、この護符自身のsellBonusにnを加算する(自分自身が売却対象の場合は加算しない)',

  // グループ24: 星片獲得(方向性2)
  dividend: '星の妨害行動(triggerSabotage)が発動するたび、星片(currency)にnを加算する',
  prizeMoney: 'プレイしたカードのランクがrandomTarget(ウェーブ開始時にinstanceIdごと再抽選)と一致するとき、星片にnを加算する',
  windfall: 'J・Q・Kのいずれかをプレイしたとき、p%の確率で星片にnを加算する',
  celebration: 'そのプレイでroleFiredにrandomTarget(ウェーブ開始時にinstanceIdごと再抽選)が含まれるとき、星片にnを加算する',
  refund: 'ウェーブ終了時、所持している護符・秘儀・天啓・神託すべて(refund自身を含む)のsellBonusにnを加算する',
  bonus: 'ウェーブ終了時、無条件で星片にnを加算する',
  commendation: 'ウェーブ終了時、deckComposition内のランクlの現存カード枚数×nを星片に加算する',
  favor: 'ウェーブ終了時、所持するfavorインスタンスごとにrewardBonusの現在値を星片に加算する。ステージクリア(isBossWave)時はrewardBonusにaを加算して蓄積する',

  // グループ25: Wave終了時報酬(レリックから移行)
  vigor: 'ウェーブ終了時、そのウェーブのwave.maxComboThisWaveに応じてfloor(maxComboThisWave/5)×nを星片に加算する',
  zuishuku: 'ウェーブ終了時、そのウェーブのwave.roleOccurrenceCountThisWaveから成立した役の種類数を数え、floor(役の種類数/2)×nを星片に加算する',
  marketTrend: 'ウェーブ終了時、山札消化率(a=wave.stock.length, b=wave.dealtRows×params.layout.cols, c=run.deckComposition中の現存枚数)からfloor(((c-b-a)/(c-b))×n)を星片に加算する(c-b<=0の場合は0)',
}
