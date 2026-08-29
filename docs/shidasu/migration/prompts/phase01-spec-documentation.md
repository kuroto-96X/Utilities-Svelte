# フェーズ1: 現状仕様の資料化(移植用リファレンス作成)

> このプロンプトは、Shidasu(Balatro風トランプソリティア型ローグライク)をGodot(GDScript)へ移植し、Steam向けPCゲームとして販売するプロジェクトの一部です。Godotプロジェクトは元のWebリポジトリ(Utilities-Svelte)とは別管理ですが、VSCodeのマルチルートワークスペースにより両方のファイルを参照できます。
>
> 着手前に必ず読むこと:
> - `Utilities-Svelte/docs/shidasu/migration/01-work-plan.md`(全体計画。フェーズ1の位置づけ・全16フェーズの依存関係を確認すること)
> - 依存フェーズなし(本フェーズが起点)

## 目的

Web版のソースコード(TypeScript)を1行も読まなくても正確にGodot移植ができるレベルの仕様書・コンテンツカタログを作る。既存の`docs/shidasu/shidasu-current-rules.md`は実装より古く(スプレッドを2種としか書いていないが実装は10種)、これを鵜呑みにせず、**コード(`engine.ts`等)と`shidasu.config.json`を正として全面的に書き直す**。

**このフェーズはコードを1行も書かない、資料作成のみのフェーズである。** Godotプロジェクトの作成・GDScriptの記述・Utilities-Svelte側のコード変更は一切行わないこと。

## 前提・依存

- 依存フェーズ: なし(起点)
- 後続フェーズ(2〜9、14)がこのフェーズの成果物を直接参照する。特にフェーズ3(データモデル移植)・フェーズ6〜9(各種効果移植)は、ここで作るコンテンツカタログが無いと作業できない。抜け漏れ・不正確な記述は後工程にそのまま伝播するため、面倒でも実装コードと数値を1件ずつ突き合わせること。
- 確定済み移行方針(ユーザー確認済み、変更しないこと):
  - Godot実装言語はGDScript
  - コンテンツスコープは現状の完全移植のみ(スプレッド10種・護符99種・秘儀24種・天啓28種・レリック10種・妨害32種)。ロードマップ上の未着手拡張は対象外
  - Steam向け機能は最小限(実績・クラウドセーブ等は初期スコープ外)
  - ビジュアル/オーディオは強化する(現状無し。ただし本フェーズの担当外、フェーズ14・15で扱う)

## 作業内容(具体的な箇条書き)

1. **現行仕様書の最新化**
   - `shidasu.config.json`・`src/lib/game/shidasu/types.ts`・`src/lib/game/shidasu/params.ts`・`src/lib/game/shidasu/engine.ts`を突き合わせ、既存の`docs/shidasu/shidasu-current-rules.md`を実装に合わせて全面的に書き直す(上書きではなく、フェーズ1成果物として新規ファイルに書くこと。既存ファイルは参照専用として残す)。
   - 特に以下は既存docsが古いか未記載なので必ず更新・追記すること。
     - スプレッド: `fool`/`moon`/`pope`/`empress`/`magician`/`justice`/`lovers`/`emperor`/`wheelOfFortune`/`strength`の10種、それぞれの固有ルール(`SpreadConfig`の各フィールドの意味と効果)
     - 護符99種・秘儀24種・天啓28種・レリック10種・妨害32種という正確な件数
     - Run(8ステージ×3ウェーブ=24ウェーブ)・「星」システム(waveSlot 1/2/3)の現行仕様
2. **コンテンツカタログの作成**(護符・秘儀・天啓・レリック・妨害・役・スプレッドそれぞれについて)
   - 各アイテムの「ID・名称・効果ロジックの自然文記述・関連パラメータ名(`shidasu.config.json`内のキー名)・依存するState(WaveState/RunStateのどのフィールドを読み書きするか)」を一覧化する。
   - 形式はMarkdown表またはJSONで良いが、後続フェーズ(特にフェーズ6〜9)が1件ずつ機械的に処理できる粒度にすること(「〇〇系の護符をまとめて」のような粗い粒度は不可、99件・32件などそれぞれ全件を個別の行/要素として記載する)。
   - 効果ロジックの実装元ファイルは以下を参照すること。
     - 護符: `src/lib/game/shidasu/itemEffects.ts`(通常効果フック)、`itemActualEffects.ts`(実際の適用処理)、`rewardTalismanEffects.ts`(Wave終了時系の護符)
     - 秘儀: `src/lib/game/shidasu/riteEffects.ts`、`riteActualEffects.ts`
     - 天啓: `src/lib/game/shidasu/revelationEffects.ts`、`revelationActualEffects.ts`
     - 神託: `src/lib/game/shidasu/oracles.ts`、`oracleActualEffects.ts`(役レベルアップの仕組み)
     - レリック: `src/lib/game/shidasu/relics.ts`
     - 妨害: `src/lib/game/shidasu/sabotageEffects.ts`、`sabotage.ts`
     - 役: `src/lib/game/shidasu/roles.ts`、`patterns.ts`
   - 各カタログの「名称・数値パラメータ・説明文テンプレート」の実データは`src/lib/game/shidasu/shidasu.config.json`側にある(`talismans`/`rites`/`revelations`/`relics`/`sabotageActions`/`stars`/`spreads`の各キー)。効果ロジック(コード)とメタデータ(JSON)が分離している現状の設計をそのままカタログの列構成に反映すること。
3. **スコア計算パイプラインの実装順序の明文化**
   - `src/lib/game/shidasu/engine.ts`の`playCard`関数(1364行目付近で定義)を読み、1枚プレイするごとの計算順序(base点→チェーンボーナス→列一掃ボーナス→護符効果フック→各種加算→最終乗算チェーン→floor→星の得点ロック、という流れ)を正確な関数呼び出し順として書き出す。
   - `src/lib/game/shidasu/scoreParts.ts`(得点内訳の型・ヘルパー)、`patterns.ts`(役判定)、`chainAttributeEffects.ts`・`cardComboEffects.ts`・`stateAndPatternEffects.ts`(スコアに絡む各種効果)も合わせて確認し、どの段階でどのファイルの関数が呼ばれるかを明示する。
   - `drawStock`(738行目付近)・`isPlayable`(29行目)・`isStuck`(1015行目付近)についても、判定順序・分岐条件を明文化する。
4. **乱数(PRNG)の扱いに関する論点整理**
   - `src/lib/game/shidasu/deck.ts`の`createRng`(mulberry32型PRNG、seedから決定論的に0〜1の乱数列を生成)が、Web版のどこで(`beginRun`/`startWave`/`finishShop`/`enterShop`/各種`roll*`関数)使われているかを一覧化する。
   - Godotで決定論的互換(同じseedならWeb版と全く同じ結果になること)が必要かどうかの論点を整理する。**結論(標準RNGへの置き換え可否)はフェーズ2で出すため、本フェーズでは論点整理のみに留め、方針を決定しないこと。**
5. **`PlayArea.svelte`の技術的負債の棚卸し**
   - `src/routes/game/shidasu/PlayArea.svelte`(約1900行)を読み、「移動先の常設UI要素がアニメーション完了前の状態を先出ししてしまう」問題への対策として個別実装された「表示専用`$state`スナップショット変数+ガードフラグ」パターンの発生箇所を全て洗い出す。
   - 各発生箇所について、(a)何のアニメーションか、(b)どのstateが先出しされてしまう問題だったか、(c)どんな変数名でどう対策したか、を一覧化する。このメモはフェーズ13(演出の再設計)がAnimationPlayer/Tween/シグナルベースの構造的解消を設計する際の入力になる。

## 参照すべき既存ファイル(Utilities-Svelte内、パス明記、各ファイルで何を見るべきか)

- `src/lib/game/shidasu/types.ts`(551行): 全ての型定義の正本。`SpreadId`/`SpreadConfig`(24〜67行目)、`ItemId`/`RiteId`/`RevelationId`/`RelicId`(97〜186行目)、`WaveState`/`RunState`の全フィールド(235〜551行目)を確認する。
- `src/lib/game/shidasu/params.ts`(646行): `ShidasuParams`インターフェース。`shidasu.config.json`のスキーマそのもの。
- `src/lib/game/shidasu/shidasu.config.json`(1732行): 実データ。護符99種・秘儀24種・天啓28種・レリック10種・妨害32種・星・スプレッド10種の名称・数値・説明文テンプレートが入っている。**数値を参照する際は`params.ts`の`DEFAULT_PARAMS`ではなく必ずこちらを正とする**(既存docsにも同様の注記あり)。
- `src/lib/game/shidasu/engine.ts`(2022行): 進行・スコアリング・ショップの全ロジック。関数一覧は`export function`宣言をgrepすると把握しやすい。
- `src/lib/game/shidasu/deck.ts`(112行): `createRng`・シャッフル・デッキ生成・スプレッド固有変形処理。
- `docs/shidasu/shidasu-current-rules.md`: 既存の仕様書(古い。書き直しの土台・章立ての参考にはして良いが、数値・件数は再検証すること)。
- `docs/shidasu/shidasu-glossary.md`: 用語集(護符=北欧ルーン、天啓=二十八宿、神託=六十四卦、スプレッド=大アルカナ、という世界観の対応関係)。
- `docs/shidasu/shidasu-spread-candidates.md`: スプレッド10種の設計時の検討メモ(現状の実装と差異が無いか照合する)。
- `src/routes/game/shidasu/PlayArea.svelte`(約1900行): 技術的負債棚卸しの対象。
- `src/routes/game/shidasu/+page.svelte`(約1350行): フェーズ遷移の呼び出し元(フェーズ11の参照ファイルでもあるが、本フェーズでもスコア計算・妨害演出のトリガー呼び出し箇所を確認する際に参考になる)。

## 成果物・保存先

すべて`Utilities-Svelte/docs/shidasu/migration/reference/`配下に新規作成する(既存の`docs/shidasu/`直下のファイルは変更しない)。

- `Utilities-Svelte/docs/shidasu/migration/reference/00-updated-rules.md` — 最新化した現行仕様書
- `Utilities-Svelte/docs/shidasu/migration/reference/catalog-talismans.md` — 護符99種の全件カタログ
- `Utilities-Svelte/docs/shidasu/migration/reference/catalog-rites.md` — 秘儀24種の全件カタログ
- `Utilities-Svelte/docs/shidasu/migration/reference/catalog-revelations.md` — 天啓28種の全件カタログ
- `Utilities-Svelte/docs/shidasu/migration/reference/catalog-relics.md` — レリック10種の全件カタログ
- `Utilities-Svelte/docs/shidasu/migration/reference/catalog-sabotage.md` — 妨害行動32種の全件カタログ
- `Utilities-Svelte/docs/shidasu/migration/reference/catalog-roles-spreads.md` — 役10種・スプレッド10種の全件カタログ
- `Utilities-Svelte/docs/shidasu/migration/reference/score-pipeline.md` — スコア計算パイプライン仕様(実装順序の明文化)
- `Utilities-Svelte/docs/shidasu/migration/reference/rng-notes.md` — 乱数の使用箇所一覧と論点整理(方針決定はしない)
- `Utilities-Svelte/docs/shidasu/migration/reference/playarea-tech-debt.md` — `PlayArea.svelte`技術的負債の棚卸しメモ

## 完了条件(チェックリスト形式)

- [ ] 上記10ファイルすべてを`docs/shidasu/migration/reference/`配下に作成した
- [ ] 護符カタログの件数が99件、秘儀が24件、天啓が28件、レリックが10件、妨害が32件、役が10件、スプレッドが10件と、それぞれ実装(`ItemId`/`RiteId`/`RevelationId`/`RelicId`/`SabotageActionId`/`RoleName`/`SpreadId`の各Union型のメンバー数、および各`*_POOL`配列の件数)と一致することを確認した
- [ ] 各カタログ項目に「ID・名称・効果の自然文記述・関連パラメータ名・依存State」が漏れなく記載されている
- [ ] スコア計算パイプライン仕様が、`engine.ts`の`playCard`の実装順序と1対1で対応している
- [ ] 乱数の使用箇所一覧に`beginRun`/`startWave`/`finishShop`/`enterShop`/主要な`roll*`系関数が含まれている
- [ ] `PlayArea.svelte`の技術的負債棚卸しメモに、発生箇所ごとの(アニメーション種別/先出しされたstate/対策変数名)が記載されている
- [ ] 既存の`docs/shidasu/shidasu-current-rules.md`など既存ファイルは変更していない(参照のみ)
- [ ] Godotプロジェクトのファイル・Utilities-Svelte側のソースコードを一切変更していない(資料作成のみ)

## 注意点

- **既存ドキュメントを鵜呑みにしないこと。** `docs/shidasu/shidasu-current-rules.md`はスプレッドを2種(fool/moon)としか記載していないが、実装(`types.ts`の`SpreadId`)は10種存在する。同様に護符などの件数も古い可能性が高い。必ずコードと`shidasu.config.json`の実件数を数えて突き合わせること。
- 99種の護符など件数が多いカテゴリーは、作業を複数回に分けて良い(1回のセッションで全件を書き切る必要はない)。ただし最終的に全件が抜け漏れなく揃っていることを完了条件で確認すること。
- カタログは「後工程がこれだけ読めば実装できる」精度を目指す。効果の自然文記述は、該当する`*ActualEffects.ts`のコードを読んで、条件分岐・数値の丸め方(`Math.floor`など)まで含めて正確に書くこと。曖昧な要約で済ませない。
- 本フェーズはコードを書かない。Godotプロジェクトの作成やGDScriptの記述に着手した場合はスコープ逸脱なので中断すること。
