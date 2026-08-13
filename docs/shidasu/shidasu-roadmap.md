# 星詠みソリティア -Shidasu- 今後の改善計画

現時点では未着手・未検討のアイデアメモ。着手する際は`superpowers:brainstorming`から設計を詰める。

1. **護符の効果の検討**
   `docs/shidasu/done/shidasu-gofu-candidates.md`の護符100個は実装完了(2026-08-03)。
   「直接点の護符」を無くして別の効果にする→対象6個(沈着・冷静・慢心・残響・流星・誠実)の変更候補12案を洗い出し(詳細は`docs/shidasu/done/shidasu-direct-score-talismans-redesign.md`を参照)、6護符すべて案Bを採用して実装完了(2026-08-06)。詳細は`docs/superpowers/specs/2026-08-06-shidasu-direct-score-talismans-plan-b-design.md`を参照。
   「報酬増加系の護符」「ワンパン軸の護符」の追加を検討する→報酬増加系の名前候補80個を洗い出し済み(2026-08-06)。詳細は`docs/shidasu/shidasu-reward-talismans-name-candidates.md`を参照。効果検討・ワンパン軸の名前検討・実装は未着手。
   合計で１５０枚になるようにする(現状98枚、残り52枚を新規検討)。
2. **天啓の追加の検討**
   モチーフの二十八宿は28宿中27宿が実装済み(Phase A: カード変換・場札操作系8個、Phase B: 即時報酬獲得系7個を追加実装完了)。残り1宿(鬼)は`mansions.ts`に温存済み。新規天啓の効果候補24個を洗い出し、2026-08-09に1つずつ採用・不採用・修正を判断済み(詳細は`docs/shidasu/done/shidasu-revelation-candidates.md`を参照)。なお1宿(虚)は護符「暗雲」との機能重複により2026-08-13に一度削除し、同日中に所持レリックの付喪化効果として再実装した。
3. **報酬の計算方法の検討**
   Waveクリア時の報酬は「星による報酬」「護符による報酬」「ゲームプレイ内容による報酬」の3種類に整理。星による報酬は実装済み(`currentStar.reward`)、護符による報酬は項目1「報酬増加系の護符」で検討予定。ゲームプレイ内容による報酬(コンボ・役・全消しなどのプレイ内容軸)は将来的に項目5「レリックの追加の検討」側で扱う方針とし、効率軸(山札残り枚数・手数など)を含め本項目としては現状保留。あわせて2026-08-11、Waveクリアごとに毎回付与していた基礎報酬`waveClearAmount`(既定5)を廃止し、通貨報酬は星の`reward`のみになるよう変更済み。
4. **星の妨害行動の検討**
   Wave3の星は一定ターンごとに妨害行動が発動するようにする。
   例えば、「場札の１列をランダムに選び山札に戻してシャッフル、その後裏向きで戻す」など
5. **レリックの追加の検討**
   レリックは、ショップ販売価格の減少、ショップ商品提示数の増加、リロールコストの減少、秘儀・天啓・神託の所持上限増加などランを通して効果があり、護符の守備範囲外（ゲームプレイに直接かかわる部分以外）で有利になる効果を持つアイテム。システムの仕組み・個別候補13種の実装は完了済み(詳細は「完了済み(履歴)」を参照)。
   今後の検討課題:
   - Waveクリア報酬系レリック(数珠・千社札・算盤)は現状いずれも「難しくやるほど得」型の条件のみ。項目3で保留中の効率軸(山札残り枚数・手数など、少ない消費でクリアするほど得)を条件とした反転型のレリックを追加候補として検討する
   - 候補メモ: 天啓候補審査(項目3)で不採用となった「オファー拡張」(次回ショップのオファー数を一時的に増やす)は、天啓ではなくレリックの効果候補として転用できる(詳細は`docs/shidasu/done/shidasu-revelation-candidates.md`の候補24を参照)
   - 護符「暗雲」・天啓「虚」の削除(2026-08-13)により、レリック候補「独楽」(Wave開始時、場札に配る行数を+nする)の機能重複が解消し、レリック化検討が再開可能になった

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
- **役の再検討(完了)**: 難易度別(簡単・中・難しい)の新規役・パターン候補12個を洗い出し(`docs/shidasu/done/shidasu-role-candidates.md`)、うち新規役「ペア」(チェーン全体で同ランク組が2組以上成立で組数×50点加算)と新規パターン「交互」(チェーン内の実カードが4枚以上赤黒交互で80点加算、同スート・同色・階段に並ぶ第4のパターン)の2個を採用・実装した。`docs/superpowers/specs/2026-08-06-shidasu-pair-alternating-roles-design.md`。あわせて神託(oracle)のモチーフを「八卦」(8種固定)から「六十四卦」(将来の拡張余地あり)に変更し、ペア・交互を含む10役全ての卦名を再割り当て、`ORACLE_POOL`にも追加した。`docs/superpowers/specs/2026-08-06-shidasu-oracle-hexagrams-design.md`。残り10個の役・パターン候補は不採用。
- **全消しボーナスのgained計算統合**: 全消しボーナスを、コンボ倍率を通さない別枠(`lastBonusGains`)加算から、そのプレイの獲得点(gained)計算の内訳に統合した。コンボ倍率・献身・勤勉・加護・星霜・残響・慢心などの乗算、および星の得点ロックの影響も受けるようになった。`lastBonusGains`(`BonusGain`型)は不要になったため完全削除した。`docs/superpowers/specs/2026-08-06-shidasu-clear-bonus-gained-integration-design.md`。
- **トランプセット福袋の実装**: `docs/shidasu/done/shidasu-card-set-pack-candidates.md`の候補11ジャンルを再検討し、枚数バリエーションを独立ジャンルとして扱う方針のもと23種類のセットジャンル(階段・同ランク・絵札・同スート・ロイヤル・フラッシュ・コンプリートラン・ペア・赤黒バランス・ワイルド)を確定して実装した。新しい`packKind: 'cardSet'`の福袋(バラ売り無し、3-1/5-1/7-2パターン)を開けるとジャンルが重み付き抽選(重み=1/枚数、ワイルドのみ例外で1/6)で提示され、選ぶと即座に`RunState.deckComposition`へ永続追加される。`docs/superpowers/specs/2026-08-08-shidasu-card-set-pack-design.md`。
- **ショップ品ぞろえリロールの実装**: ショップ画面にバラ売り3枠+福袋2枠を一括で再抽選する「リロール」ボタンを追加した。売り切れ済みの枠も含めて全て新しい商品に入れ替わる(既存の`rollShop`を再利用)。コストは通貨消費で、同一ショップ訪問中のリロール回数(`shopRerollCount`)に応じて`shop.rerollCostStep`(既定5)ずつ増額し、次のショップに入るたびにリセットされる。`/admin/shidasu-currency`でコスト刻み幅を編集可能。`docs/superpowers/specs/2026-08-08-shidasu-shop-reroll-design.md`。
- **福袋のオブジェクト化**: ハードコードされていた福袋パターン(`PACK_DEFINITIONS`固定14種+`packPrice`価格表)を廃止し、`ShidasuParams.shop.packCatalog`という名前・種別・選択肢数・取得数・価格を持つ可変長リストに置き換えた。新規管理画面`/admin/shidasu-packs`から福袋の追加・削除・編集ができ、同じ内容のエントリを名前だけ変えて複数用意すると、その福袋の抽選確率を相対的に上げられる(各エントリの抽選確率自体は均等)。`docs/superpowers/specs/2026-08-08-shidasu-pack-catalog-design.md`。
- **天啓候補の検討・Phase A実装(カード変換・場札操作系8個)**: `docs/shidasu/done/shidasu-revelation-candidates.md`の天啓候補33個(既存秘儀からの転用9個を含む)を1つずつ採用・不採用・修正判断し、採用15個をPhase A(8個)・Phase B(7個)に分割した。Phase Aは`wave`・`deckComposition`を書き換える効果(隣列連鎖変換・4色循環変換・階段整列・全列トップ廃棄・極値ワイルド化・雷光・対話・賜物)で、`DeckCard.removed`フラグ(廃棄=デッキから永久除外、配列は縮めずフラグ管理)を新設して実装した。`docs/superpowers/specs/2026-08-09-shidasu-revelation-phase-a-design.md`。
- **天啓Phase B実装(即時報酬獲得系7個)**: 護符獲得・星片倍化・天啓回帰・神託獲得・天啓連続獲得・護符換金・秘儀回帰の7個を実装した。`wave`/`deckComposition`ではなくRunStateレベル(通貨・護符・秘儀・天啓・神託の所持リスト)を操作するため、`applyRevelationEffect`側は全てno-opにし、新規関数`grantRevelationReward`(engine.ts)で実処理を行う構成にした。天啓回帰は自己参照ループ(使用するたび自分自身を再取得し続ける)を、使用履歴フィールドの更新を自分自身の使用時だけスキップする方式で構造的に防止した。天啓は28宿中27宿(Phase A・B合計15個追加、残り1宿は未定のまま温存)まで実装完了。`docs/superpowers/specs/2026-08-09-shidasu-revelation-phase-b-design.md`。
- **秘儀の追加の検討・実装完了**: 2026-08-09、天啓候補審査(項目3)の過程で「天啓=カード変換系、秘儀=それ以外」という将来方針が決まり、既存秘儀のうちカード変換系9個を2026-08-11に秘儀の実装から一度削除した(3個は天啓側に転用済み、6個は完全削除)。同日中に、削除で空いた9枠に`docs/shidasu/done/shidasu-rite-redesign-candidates.md`セクションA(天啓候補審査で不採用となった10候補)の内容で新しい効果を設計・実装し、秘儀は全24種に復帰した。
- **レリックシステムの実装・個別候補13種の実装完了**: レリックは、ショップ販売価格の減少、ショップ商品提示数の増加、リロールコストの減少、秘儀・天啓・神託の所持上限増加などランを通して効果があり、護符の守備範囲外（ゲームプレイに直接かかわる部分以外）で有利になる効果を持つアイテム。2026-08-12、システムの仕組み(データ構造・ショップ専用枠での単品購入・所持数無制限かつ重複不可・売却不可・「付喪化」という個体ごとの進化状態・バッジ表示)を設計・実装した(詳細は`docs/superpowers/specs/2026-08-12-shidasu-relic-system-design.md`を参照)。続けて同日中に、個別レリック候補13種(招き猫・福だるま・熊手・数珠・招き布袋像・破魔矢・千羽鶴・福笹・開運こけし・縁起小槌・縁起鈴・千社札・算盤)の効果・名前を設計し、全て実装完了した(詳細は`docs/shidasu/done/shidasu-relic-candidates.md`を参照)。動作確認用の仮レリック`placeholder`は削除済み。
- **護符「暗雲」・天啓「虚」の削除**: レリック候補検討(2026-08-12)で、レリック候補「独楽」(Wave開始時、場札に配る行数を+nする)が既存の護符「暗雲」・天啓「虚」と同じ`extraTableauRows`の仕組みを使っており機能重複することが判明し、保留していた。2026-08-13、`extraTableauRows`のみを効果とする単機能アイテムであるこの2つを削除した(新規効果の割り当ては行わず単純削除)。護符は98種、天啓は28宿中26宿に更新。独楽のレリック化検討は別セッションで再開する。
- **天啓「虚」(レリック付喪化)の実装**: レリックシステム設計(2026-08-12)で保留していた「付喪化のトリガーとなる天啓」を、2026-08-13に天啓「虚」として実装した。所持レリックの中から選んだ1つ(未付喪化のもの限定)を付喪化させる選択式の効果で、`useRevelation`の新規`targetRelicId`引数と`grantRevelationReward`の`kyo`ケースで実現している。天啓は28宿中27宿に復帰。詳細は`docs/superpowers/specs/2026-08-13-shidasu-relic-tsukumoka-revelation-design.md`を参照。
