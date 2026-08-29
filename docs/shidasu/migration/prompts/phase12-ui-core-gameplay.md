# フェーズ12: UI実装②(場札/山札/チェーン/捨て札の操作・ショップ/選択UI)

> このプロンプトは、Shidasu(Balatro風トランプソリティア型ローグライク)をGodot(GDScript)へ移植し、Steam向けPCゲームとして販売するプロジェクトの一部です。Godotプロジェクトは元のWebリポジトリ(Utilities-Svelte)とは別管理ですが、VSCodeのマルチルートワークスペースにより両方のファイルを参照できます。
>
> 着手前に必ず読むこと:
> - `Utilities-Svelte/docs/shidasu/migration/01-work-plan.md`(全体計画)
> - フェーズ11の成果物(`RunPhase`ごとのシーン/`Control`切り替えの骨格。本フェーズはその骨格の中身を作り込む)

## 目的

ゲームの中核となる操作可能な最小限のプレイUIを実装する。場札・山札・チェーン・捨て札の表示と操作、ショップ画面、各種選択画面(護符/秘儀/天啓/神託選択・福袋中身選択)、役ステータス・スート枚数表示までを一通り揃える。**演出(アニメーション)は簡易でよい**(本格的な演出再設計はフェーズ13の担当)。ただし、フェーズ13が乗せやすいように、状態変化点を明示的なシグナルとして発火する設計にしておく(後述)。

## 前提・依存

- 依存: フェーズ11(`RunPhase`ごとの画面切り替え骨格、解像度非依存レイアウトの土台)。
- ロジック層(フェーズ4〜10で移植済み)は純粋関数(引数を書き換えず新しい状態を返す)であることを前提にしたAPIになっている。UI層の役割は「操作を検知して対応するロジック層の関数を呼び、返り値を現在の状態として保持し直す」だけであり、Web版もこの原則を徹底している(`+page.svelte`の`handlePlayCard`は`run = applyPlayCard(params, run, colIndex, undefined, rowIndex)`のように、呼び出して結果を代入するだけ)。Godot側でもこの分離(UIノードがゲームロジックを一切持たず、状態更新は必ずロジック層の関数経由で行う)を崩さないこと。

## 作業内容

### 1. 場札(tableau)・山札(stock)・チェーン(chain)・捨て札(discardPile)のデータ構造

いずれも`WaveState`(ロジック層、フェーズ2〜3で定義済み)のフィールドをそのまま描画する。

- `tableau: Card[][]`: 列(`params.layout.cols`列)×行の2次元配列。各列は配列の**末尾側が手前(操作可能な最上段)**、先頭側が奥(積み重ねの下)。`moon`スプレッド(フェーズ9)では奥側の一部が裏向き(`Card.faceUp === false`)になる。
- `stock: Card[]`: 山札。配列の末尾がめくる対象(残り枚数のみ表示、中身は非公開)。
- `chain: Card[]`+`chainOrigin: ChainCardOrigin[]`(`'play'|'draw'`、同じインデックスで対応): これまでプレイ/ドローで連結してきたカードの列。`params.ui.chainCardsPerRow`・`params.ui.chainCardOffsetX`で折り返し行数・オフセットが決まる(`chainLayout.ts`の`nextChainSlotPosition`、フェーズ4で移植済みのはず)。
- `discardPile: Card[]`: コンボが途切れた際にチェーンから送られる捨て札(ウェーブ内限定)。末尾が一番上。

### 2. カード操作方式の決定・実装

Web版は**クリック操作**(ドラッグではない)を採用している。場札の一番手前のカード(`isTop`)、または護符「◯◯」等でプレイ可能状態(`isPlayable(modifier, wave, card, items)`)なら押せるボタンとして表示し、クリックで即座に`applyPlayCard`相当を呼ぶ(`handlePlayCard(colIndex, rowIndex)`)。山札も同様にクリックでめくる(`onDraw`)。

- **本フェーズでは、まずクリック操作(タップ/マウスクリックでカードを選ぶ)で実装することを推奨する。** 理由: (1) Web版と同じ操作性のため移植の正確性を検証しやすい、(2) ドラッグ&ドロップは判定領域・ドロップ先のハイライト・キャンセル操作等を追加で設計する必要があり、本フェーズのスコープ(操作可能な最小限のUI)を超えやすい。
- ドラッグ操作への置き換えは、PC向けゲームとしての操作感向上のためにフェーズ13(演出再設計)以降で検討する選択肢として残してよいが、本フェーズで必須ではない。
- 護符の所持順並べ替え(ショップ画面、下記4.)はWeb版でもドラッグ操作(`onpointerdown`/`onpointermove`/`onpointerup`によるカスタムポインタドラッグ、ネイティブHTML Drag and Dropではない)になっており、こちらはドラッグでの並べ替えをそのまま踏襲すること(`reorderItems`相当のロジック層関数へ、ドラッグ確定時の新しい並び順を渡す)。
- カードをクリックした結果、実際の状態更新(`applyPlayCard`/`applyDrawStock`相当)を**即座に**適用してよい(Web版はここで見た目のアニメーション区間を挟んでから状態更新するが、本フェーズは演出を作り込まないため、クリック→即時反映で問題ない)。

### 3. カード表示コンポーネント

`CardFace.svelte`相当を実装する。**仮素材でよい**(実アセットはフェーズ14)。

- 表向き: ランク表記(A/2〜10/J/Q/K)+スート記号(♠♥♦♣)、赤黒の色分け。ワイルドカード(`card.wild === true`)は専用の色・記法(Web版は紫系背景+"★"のような特殊表現)。
- 裏向き: 単色+枠線の裏面プレースホルダーでよい(`faceUp === false`のカード、山札のめくり待ちカード等)。
- Pip(スート記号の配置パターンによる見た目の作り込み)はWeb版では枚数ごとに座標テーブルを持つ凝った実装だが、**本フェーズでは省略し、ランク+スートのテキスト表示だけで十分**(視覚的な作り込みはフェーズ14のアセット組み込み時に置き換える前提)。

### 4. ショップ画面

- バラ売り3枠(護符/秘儀/天啓/神託のいずれか、種類は`ShopSlot.kind`)+福袋2枠(内容は種別ごとの`offerCount`件から`pickCount`件選ぶ)+レリック枠(スプレッド`bannedShopKinds`で除外されていれば非表示)を一覧表示する。
- 各枠に名称・説明文・価格を表示し、購入ボタン(所持上限・所持金不足なら無効化)を押すとロジック層の対応する購入関数(`buyIndividualItem`/`buyIndividualRite`/`buyIndividualRevelationUse`/`buyIndividualRevelationHold`/`buyIndividualOracleUse`/`buyIndividualOracleHold`/`buyRelic`/`buyPack`等、フェーズ8で移植済み)を呼ぶ。
- リロールボタン(`shopRerollCost`分の通貨を消費、`rerollShop`相当)。
- 所持護符一覧: 名称表示+売却ボタン(`sellItem`相当)+**ドラッグによる並べ替え**(上記2.参照)。効果適用順序(所持順)がスコアリングに影響するため、並べ替え結果は必ずロジック層へ反映すること。
- 所持秘儀・天啓・神託・レリック一覧: 使用ボタン(秘儀・天啓・神託)+売却ボタン(レリックは売却不可)。
- 「次のWaveへ」ボタンでステージ確認画面(フェーズ11で骨格のみ作成済み)へ、またはステージ確認画面から「Waveへ進む」でプレイ画面へ遷移する。ステージ確認画面自体(3つの星のプレビュー・スキップ/リロール)は本フェーズで中身を完成させる(フェーズ11は骨格のみだったことを踏まえる)。

### 5. 各種選択画面

- **護符福袋(`itemSelect`)**: 提示された候補(`run.offer`)から`run.offerPickRemaining`個選ぶ。所持枠が満杯なら入れ替え対象を選ぶサブフロー(`pendingNewItem`)に分岐する。
- **秘儀福袋(`riteSelect`)**: 同様の構造(`run.riteOffer`/`pendingNewRite`)。
- **天啓/神託選択(`revelationSelect`/`oracleSelect`)**: 天啓選択はWeb版では専用の「プレイ画面プレビュー」(場札に対して天啓の効果対象列を選ぶ、`revelationPreviewWave`)という特殊なUIになっている。神託選択(`oracleSelect`)は「即使う」/「温存」の2択ボタン付き一覧+`pendingNewOracle`による入れ替えサブフロー。フェーズ11で確認した「本番プレイ画面の上に常時オーバーレイとして重ねる」という構成方針を踏襲すること。
- **トランプセット福袋(`cardSetSelect`)**: ジャンルごとのカード構成プレビュー(`offer.cards`をカード表示コンポーネントで並べる)+選択ボタン。

### 6. 役ステータス表示・スート枚数表示

- **役ステータスパネル**: 役10種(`ROLE_LIST`、`roles.ts`)それぞれについて、名称・簡易説明・現在の神託レベル(`oracleLevels[role.name]`)・レベル×基礎点(`roleBasePoint(params, role.name) * level`)を一覧表示する。妨害「役封印」「役偏重」「天啓封印(神託対象)」中は実効レベルが変わるため、`resolveSealedRoleEffect`相当(フェーズ9で移植済み)を使って表示側でも実効値を再計算すること(封印中は`storedLevel`と`effectiveLevel`が食い違うことを示す強調表示があるとなお良い)。
- **スート枚数パネル**: 現在の場札(`tableau`)に残っている♠♥♦♣それぞれの枚数+ワイルド枚数を集計して表示する(`SuitCountPanel.svelte`相当、単純な集計ロジック)。

### 7. 演出フック用シグナル設計(重要、フェーズ13が使う)

フェーズ13(アニメーション・演出の再設計)は、Web版で個別に発生していた「表示専用スナップショット+ガードフラグ」という技術的負債パターンを、Godotの`AnimationPlayer`/`Tween`+シグナルベースの構造的な仕組みに置き換える計画になっている。そのためには、**状態が変化した「タイミング」を明示的なシグナルとしてロジック層(またはロジック層の呼び出し直後のUI層)が発火する**設計が前提になる。本フェーズでは演出そのものは実装しないが、以下のシグナルを設計・発火するところまでは行うこと。

- **妨害発動シグナル**: 例 `signal sabotage_triggered(sabotage_id: String, result: Dictionary)`。`WaveState.lastSabotage`(`id`・`seq`・`affectedCols`・`purgedToDiscardCount`・`confiscatedTarget`・`forceActivatedTarget`・`numericChangeTarget`・`tableauCardRemoved`・`redistributedAreas`、フェーズ9で移植済み)の`seq`が増加したタイミングで発火する。Web版もこの`seq`インクリメント方式で「同じIDが連続発動しても変化を検知できる」設計にしている(`types.ts`の`lastSabotage`コメント参照)ので、そのままGodot版でも採用する。
- **コンボリセットシグナル**: 例 `signal combo_reset(previous_combo: int)`。Web版には現状「コンボリセット」専用の演出は無く、単に`wave.combo`の表示値が0に戻るだけだが、フェーズ13で新規に演出を追加する前提のため、本フェーズで「直前の`combo`値」と「更新後の`combo`値」を比較し、`0`より大きい値から`0`に落ちた(かつ妨害の`comboBreather`/`comboReduce`等ではなく、手詰まりや不成立プレイによる自然なリセットの場合を区別したいなら`resetComboFields`が呼ばれた経路も合わせて判定する)場合にこのシグナルを発火するロジックをUI層(またはUI層向けの薄いラッパー関数)に用意する。
- **役成立シグナル**: 例 `signal role_established(role_name: String, amount: int, used_wild: bool)`。ロジック層内部では`evaluateChainBonus`(`patterns.ts`、フェーズ5で移植済み)の返り値`ChainBonusResult.roleFired: { name: RoleName; usedWild: boolean; amount: number }[]`が、そのプレイで成立した役の名前・獲得点・ワイルド使用有無を保持しているが、**現状この情報は`playCard`内部で得点内訳(`ScorePart`)に変換された後は個別の役名として外に出てこない**(`ScorePart.text`は表示用文字列に丸め込まれる)。フェーズ13で役ごとの成立演出(例: 該当役のステータス行が光る)を作りたい場合、この`roleFired`配列を`PlayCardResult`(またはそれに類する返り値)に含めて呼び出し元まで伝播させる拡張が必要になる。**本フェーズでこの拡張(`roleFired`を呼び出し元まで伝播させる)を行い、UI層でそれを受け取って`role_established`シグナルを役の数だけ発火する**ところまで実装すること(ロジック層の返り値を1つ増やすだけの変更であり、既存のスコア計算結果自体は変えない)。
- 上記3つに加えて、以下も同様の考え方で最低限シグナル化しておくと後続フェーズがスムーズになる(必須ではないが推奨)。
  - ウェーブクリア/失敗(`WaveState.status`が`'ended'`になったタイミング、`WaveState.endReason`で分岐)
  - 護符/秘儀/天啓/神託/レリックの新規獲得・売却
  - 封印(`activeSeal`)の設定・解除
  - 山札シャッフル(`lastStockShuffle.seq`の増加、Web版と同じseq方式)
- **本フェーズの時点ではシグナルを受け取って何か演出をする実装(受信側)は作らなくてよい。** シグナルを発火する送信側の設計・実装までが本フェーズのスコープであり、実際に演出をつなぎ込むのはフェーズ13。

## 参照すべき既存ファイル(Utilities-Svelte内)

- `src/routes/game/shidasu/PlayArea.svelte`(約1900行、レイアウト・操作部分に限定して参照。アニメーション実装の詳細はフェーズ13の対象なので深追いしない):
  - Props定義: 58〜103行目(`wave`/`params`/`modifier`/`target`/`items`/`onPlayCard`/`onDraw`等)。
  - 場札の描画・クリック判定: 1626〜1678行目(`isTop`/`isSelectable`/`isPlayable`/`onclick`)。
  - 山札・捨て札: 1682〜1700行目付近(`onDraw`・`displayedDiscardTop`。**`displayedDiscardTop`はフェーズ13が扱う表示専用スナップショットパターンの実例であり、本フェーズでは直接データを参照する単純な実装で構わない**)。
  - チェーン領域のレイアウト計算: `chainEntries`/`chainRows`(1541〜1542行目)、`nextChainSlotPosition`の呼び出し(1486行目)。
  - クリック→状態反映の呼び出し方(演出無しの最短経路として`startPlayCardAnimation`の末尾、1517〜1521行目の`onPlayCard(colIndex, rowIndex)`呼び出し部分だけを参考にする)。
- `src/routes/game/shidasu/RoleStatusPanel.svelte`: 役ステータス表示のロジック(`effectiveLevel`による封印中の実効値再計算)。
- `src/routes/game/shidasu/SuitCountPanel.svelte`: スート枚数集計(単純な`Array.flat`+集計)。
- `src/routes/game/shidasu/CardFace.svelte`: カード表示の参考(Pip配置等の作り込みは本フェーズでは簡略化してよい)。
- `src/routes/game/shidasu/+page.svelte`:
  - ショップ画面: 941〜1108行目。
  - 各種選択画面: `riteSelect`(1109〜1130行目)・`cardSetSelect`(1131〜1151行目)・`itemSelect`(1152〜1196行目)・`oracleSelect`(1197〜1245行目)。
  - ステージ確認画面: 1285〜1340行目。
  - 護符ドラッグ並べ替え: `handleItemPointerDown`/`handleItemPointerMove`/`handleItemPointerUp`(該当箇所をgrepして参照)。
- `src/lib/game/shidasu/patterns.ts`: `ChainBonusResult`(192〜206行目)・`evaluateChainBonus`。役成立シグナル設計時に`roleFired`の型を確認する。
- `src/lib/game/shidasu/types.ts`: `WaveState`全フィールド(235行目〜、特に`lastSabotage`/`lastStockShuffle`/`activeSeal`)、`PlayCardResult`(224行目)、`ChainCardOrigin`(233行目)。
- `src/lib/game/shidasu/chainLayout.ts`: `nextChainSlotPosition`(チェーン領域のカード配置座標計算)。

## 成果物・保存先

- Godotプロジェクト側: 場札/山札/チェーン/捨て札の表示・操作一式、カード表示コンポーネント(仮素材)、ショップ画面、各種選択画面(護符/秘儀/天啓/神託/トランプセット福袋)、役ステータスパネル、スート枚数パネル。
- 演出フック用シグナルの定義一式(送信側のみ実装、受信側は未実装で可)。
- 上記すべてが実際に操作可能で、フェーズ11で骨格のみだったタイトル→ゲーム開始の後、1ウェーブを最初から最後まで(場札プレイ→山札めくり→ウェーブクリア/失敗→ショップ→次ウェーブ)操作できる状態。

## 完了条件

- [ ] 場札をクリック(または決定した操作方式)でプレイでき、`applyPlayCard`相当の結果が画面に反映される
- [ ] 山札をクリックでめくれる
- [ ] チェーン・捨て札の内容が正しく表示される
- [ ] ショップ画面でバラ売り・福袋・レリックの購入、リロール、所持品売却・並べ替えができる
- [ ] 護符/秘儀/天啓/神託の各福袋選択画面(入れ替えサブフロー含む)が動作する
- [ ] トランプセット福袋選択画面が動作する
- [ ] 役ステータスパネルが神託レベル・封印中の実効値変化を正しく表示する
- [ ] スート枚数パネルが現在の場札構成を正しく集計・表示する
- [ ] 妨害発動・コンボリセット・役成立の3種のシグナルが、対応する状態変化のタイミングで正しく発火することを確認した(受信側は未実装でよいが、`print`等でログ出力して発火タイミングが正しいことを検証する)
- [ ] 役成立シグナルのために`roleFired`相当の情報がロジック層の返り値経由でUI層まで伝播している
- [ ] 1ウェーブを最初から最後まで(プレイ→クリア/失敗→ショップ→次ウェーブ)操作だけで完走できる

## 注意点

- 演出は簡易でよいが、シグナル設計(手順7)は妥協しないこと。ここでの設計品質がフェーズ13の作業効率に直結する。
- `displayedDiscardTop`のような「表示専用スナップショット」パターンを本フェーズで先回りして実装する必要はない(演出が無い本フェーズでは「先出し」自体が問題にならないため)。ただし、後でフェーズ13がスナップショットノードに差し替えやすいよう、UI要素と実データの結びつきを可能な限りシンプルに保つこと(複雑な条件分岐を伴う直接参照を増やさない)。
- 護符の効果適用順序(所持順)はスコアリングに影響する仕様(フェーズ6で移植済み)。並べ替えUIの実装ミスで順序が意図せず変わらないよう注意する。
- 本フェーズはロジック層に手を加える必要が一部ある(役成立シグナルのための`roleFired`伝播)。ロジック層の既存の計算結果・スコア数値自体を変えないよう、戻り値を1つ追加するだけの変更に留めること。
