# 星詠みソリティア -Shidasu- 今後の改善計画

現時点では未着手・未検討のアイデアメモ。着手する際は`superpowers:brainstorming`から設計を詰める。

1. **護符の効果の検討**
   `docs/shidasu/done/shidasu-gofu-candidates.md`の護符100個は実装完了(2026-08-03)。
   「直接点の護符」を無くして別の効果にする→対象6個(沈着・冷静・慢心・残響・流星・誠実)の変更候補12案を洗い出し(詳細は`docs/shidasu/done/shidasu-direct-score-talismans-redesign.md`を参照)、6護符すべて案Bを採用して実装完了(2026-08-06)。詳細は`docs/superpowers/specs/2026-08-06-shidasu-direct-score-talismans-plan-b-design.md`を参照。
   「報酬増加系の護符」「ワンパン軸の護符」の追加を検討する→報酬増加系の名前候補80個を洗い出し済み(2026-08-06)。詳細は`docs/shidasu/shidasu-reward-talismans-name-candidates.md`を参照。効果検討・ワンパン軸の名前検討・実装は未着手。
   合計で１５０枚になるようにする(現状100枚、残り50枚を新規検討)。
2. **秘儀の追加の検討**
   モチーフの北欧ルーン文字(エルダー・フサルク全24種)は既に全て実装済み(`RiteId`型・`RITE_POOL`とも24種完備、2026-07-20時点で全種の効果実装が完了)。余っているルーンは無いため、これ以上追加するには神託(八卦→六十四卦)と同様にモチーフ自体の拡張・変更が必要
3. **天啓の追加の検討**
   モチーフの二十八宿は28宿中12宿のみ実装済みで、残り16宿(室・壁・奎・婁・胃・昴・畢・觜・参・井・鬼・柳・星・張・翼・軫)は`mansions.ts`に温存済み。新規天啓の効果候補24個を洗い出し済み(2026-08-06)。詳細は`docs/shidasu/shidasu-revelation-candidates.md`を参照。実装対象の選定・具体的な宿への割り当て・実装は未着手
4. **報酬の計算方法の検討**
5. **星の妨害行動の検討**
   Wave3の星は一定ターンごとに妨害行動が発動するようにする。
   例えば、「場札の１列をランダムに選び山札に戻してシャッフル、その後裏向きで戻す」など
6. **アニメーションの検討**
   得点計算時の表示のうち、役・パターン(同スート/同色/階段/フラッシュ/ロイヤル/同ランク/コンプリートラン)の対象カードを黄色枠でハイライトする演出、および護符効果由来のパーツで対象護符を黄色枠でハイライトする演出は実装完了(2026-08-06)。
   残りの表示演出(基礎点・コンボ倍率パーツなど)は今後検討。
7. **ショップで購入できる商品の検討**
   トランプセットの福袋の追加（福袋を開けると、５枚の階段、同ランクのセット、JQKなどトランプの複数枚セットから１つ選びデッキに加える）→セットジャンル候補11個を洗い出し済み(2026-08-06)。詳細は`docs/shidasu/shidasu-card-set-pack-candidates.md`を参照。実装対象の選定・実装は未着手
   福袋の種類の再検討。名前と種類と選択肢と獲得数と価格のデータで管理

## 完了済み(履歴)

以下は着手済み・完了済みの改善項目。詳細は各specを参照。

- **アイテムのモチーフ・名称体系**: 秘儀=ルーン文字、天啓=二十八宿、神託=八卦で統一命名済み。護符は自由命名(`docs/shidasu/done/shidasu-gofu-candidates.md`参照)。
- **アイテムの種類・効果の拡充**: 役ボーナス緩和(階段・列一掃)、同スート・同色・同ランク軸、コンボ軸、全消し軸、詰み救済軸、ワイルド供給アイテムまで実装済み(約80種の護符)。`docs/superpowers/specs/2026-07-09-shidasu-item-hard-yaku-relax-design.md`ほか多数。
- **デバッグ用専用画面**: `/admin/shidasu-debug`として実装済み。`docs/superpowers/specs/2026-07-15-shidasu-debug-sandbox-design.md`ほか。
- **ステージ構成(旧ボスWave構想)**: 旧`BossKind`階級制を廃止し、Wave単位の「星」(`stars`)による目標倍率・報酬・制限ルールの仕組みに再構築済み。`docs/superpowers/specs/2026-07-28-shidasu-run-structure-redesign-design.md`、`2026-07-30-shidasu-boss-tiers-removal-design.md`ほか。
- **ゲーム内通貨・ショップ**: 通貨(星片)を新設し、Wave終了ごとのショップで護符・秘儀・天啓・神託を購入できる仕組みを実装済み。`docs/superpowers/specs/2026-07-22-shidasu-currency-design.md`、`2026-07-23-shidasu-shop-design.md`ほか。
- **エフェクト・アニメーション**: カードプレイ移動・Wave開始配布・得点内訳表示・得点パーツ演出・片付け演出などを実装済み。`docs/superpowers/specs/2026-07-27-shidasu-play-card-animation-design.md`ほか多数。
- **護符の並べ替えUI**: ショップ画面から所持護符をドラッグ&ドロップ(PC・スマホ両対応)で並べ替えられるようにした。並べ替え結果はプレイ中の常設バッジ表示にも反映される。`docs/superpowers/specs/2026-07-31-shidasu-item-reorder-design.md`。
- **護符100個の実装完了**: `docs/shidasu/done/shidasu-gofu-candidates.md`記載の護符候補100個すべてを実装済み。誓約・契り・紅蓮・漆黒(色/スート拡張解釈を含む)は`docs/superpowers/specs/2026-08-02-shidasu-color-suit-lock-and-enablers-design.md`、白銀・果断・星霜は`docs/superpowers/specs/2026-08-03-shidasu-remaining-talismans-silver-audacity-frost-design.md`を参照。
- **得点内訳パーツの対象カードハイライト**: 得点内訳アニメーションで、同スート・同色・階段・フラッシュ・ロイヤル・同ランク・コンプリートランのパーツが中央表示されている間、対象カードを黄色枠で強調表示するようにした。`docs/superpowers/specs/2026-08-06-shidasu-score-part-card-highlight-design.md`。
- **得点内訳パーツの対象護符ハイライト**: 得点内訳アニメーションで、護符効果由来のパーツ(gained・clearBonus両チャンネル)が中央表示されている間、対応する護符バッジを黄色枠で強調表示するようにした。水鏡のエコー分は水鏡自身をハイライトする。`docs/superpowers/specs/2026-08-06-shidasu-score-part-item-highlight-design.md`。
- **役の再検討(いったん完了)**: 難易度別(簡単・中・難しい)の新規役・パターン候補12個を洗い出し(`docs/shidasu/shidasu-role-candidates.md`)、うち新規役「ペア」(チェーン全体で同ランク組が2組以上成立で組数×50点加算)と新規パターン「交互」(チェーン内の実カードが4枚以上赤黒交互で80点加算、同スート・同色・階段に並ぶ第4のパターン)の2個を採用・実装した。`docs/superpowers/specs/2026-08-06-shidasu-pair-alternating-roles-design.md`。あわせて神託(oracle)のモチーフを「八卦」(8種固定)から「六十四卦」(将来の拡張余地あり)に変更し、ペア・交互を含む10役全ての卦名を再割り当て、`ORACLE_POOL`にも追加した。`docs/superpowers/specs/2026-08-06-shidasu-oracle-hexagrams-design.md`。残り10個の役・パターン候補は未実装のまま`docs/shidasu/shidasu-role-candidates.md`に残っている。
