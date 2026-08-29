# フェーズ別AI実行プロンプト 一覧

`../01-work-plan.md`(全体計画)の16フェーズに対応する、AI実行用の指示プロンプト集。各ファイルは、そのフェーズを担当する(将来の別セッションの)AIエージェントにそのまま貼り付けて実行させることを想定している。

実行順は依存関係に従うこと(詳細は`01-work-plan.md`の「フェーズ間の依存関係」を参照)。フェーズ14(ビジュアルアセット)・フェーズ15の一部(BGM)はフェーズ1完了後、他のフェーズと並行して着手できる。

| # | ファイル | 内容 |
|---|---|---|
| 1 | [phase01-spec-documentation.md](phase01-spec-documentation.md) | 現状仕様の資料化(移植用リファレンス作成)。コード変更なし |
| 2 | [phase02-godot-foundation.md](phase02-godot-foundation.md) | Godotプロジェクトの基盤構築(状態管理パターン・ADR決定) |
| 3 | [phase03-data-model.md](phase03-data-model.md) | コアデータモデル・パラメータ/コンテンツデータの移植 |
| 4 | [phase04-run-wave-flow.md](phase04-run-wave-flow.md) | Run/Wave進行フロー・デッキ生成の移植(効果はスタブ) |
| 5 | [phase05-scoring-pipeline.md](phase05-scoring-pipeline.md) | 役判定・スコアリングパイプラインの移植 |
| 6 | [phase06-talismans.md](phase06-talismans.md) | 護符(Talisman)の効果移植 |
| 7 | [phase07-rites-revelations.md](phase07-rites-revelations.md) | 秘儀(Rite)・天啓(Revelation)の効果移植 |
| 8 | [phase08-oracles-relics-shop.md](phase08-oracles-relics-shop.md) | 神託・レリック・ショップ/福袋システムの移植 |
| 9 | [phase09-sabotage-spreads.md](phase09-sabotage-spreads.md) | 星の妨害行動・スプレッド固有ルールの移植・統合 |
| 10 | [phase10-testing.md](phase10-testing.md) | ロジック層の統合検証・xUnit(またはNUnit)ユニットテスト整備 |
| 11 | [phase11-ui-title-select.md](phase11-ui-title-select.md) | UI①: タイトル・スプレッド選択・基本画面構成 |
| 12 | [phase12-ui-core-gameplay.md](phase12-ui-core-gameplay.md) | UI②: 場札/山札/チェーン/捨て札・ショップ/選択UI |
| 13 | [phase13-animation-redesign.md](phase13-animation-redesign.md) | アニメーション・演出の再設計 |
| 14 | [phase14-visual-assets.md](phase14-visual-assets.md) | ビジュアルアセット制作・組み込み |
| 15 | [phase15-audio.md](phase15-audio.md) | オーディオ実装 |
| 16 | [phase16-packaging.md](phase16-packaging.md) | Steam向け最小パッケージング・総合動作確認 |

## 既知の注意事項

- **護符(Talisman)の件数について**: `01-work-plan.md`作成時点では99種としていたが、フェーズ5〜8のプロンプト作成時にソースコードを再確認したところ、実装は既に133種まで増えていた(work-plan作成後にコンテンツが追加されたため)。秘儀24種・天啓28種・レリック10種は記載通り。→ **フェーズ1実行により確定**: 護符133種で確定(`ItemId`実カウント=`shidasu.config.json`の`talismans`キー数=133で一致)。後続フェーズは`docs/shidasu/migration/reference/catalog-talismans.md`を正とすること。
- 各プロンプトはUtilities-Svelteリポジトリのファイルパスをそのまま参照している。実行時はVSCodeのマルチルートワークスペース等で、Godotプロジェクトと`Utilities-Svelte`の両方を閲覧できる状態にしておくこと。

## フェーズ1 実行結果(完了)

`docs/shidasu/migration/reference/`配下に10ファイルすべて作成済み。確定した件数: スプレッド10・護符133・秘儀24・天啓28・神託10・レリック10・妨害32・役10・星定義8・トランプセット福袋ジャンル23・福袋カタログ32件(旧`shidasu-current-rules.md`記載の14件は古い)。

実行中に判明した、後続フェーズで踏まえるべき重要事項:

- **RNGは実プレイでは事実上使われていない**: `+page.svelte`から`beginRun`/`finishShop`/`applyPlayCard`等を呼ぶ際、`seed`/`rand`引数は常に省略され`Math.random`にフォールバックしている。UIにシード入力/表示機能もない。`createRng`(mulberry32)の決定論性は実質テストコード側でしか使われていない。→ フェーズ2のRNG方針決定(標準RNGへの置き換え)を後押しする材料。詳細は`reference/rng-notes.md`。
- **`drawStock`と`playCard`のスコア計算に非対称性がある**: 山札から直接めくる「素朴」パスでは、列一掃ボーナス・役倍率(明星/ソウィロ)・7種の乗算(献身/勤勉/加護/星霜/残響/慢心/スリサズ)が適用されない。移植時にこの非対称性を誤って解消(または誤って複製)しないこと。詳細は`reference/score-pipeline.md`。
- **`types.ts`のコメントに誤りがある**: `moon`スプレッドのコメントは「場札が1行少ない」だが、実装(`initialExtraTableauRows: 1`)は逆に「1行多い」。ソースコードは修正せず(スコープ外)、カタログ側で正しい仕様を記載済み。詳細は`reference/catalog-roles-spreads.md`。
- **`PlayArea.svelte`の技術的負債は想定より広範**: 「表示専用スナップショット+ガードフラグ」パターンは既知6件ではなく実際は16件確認された。加えて、JS側のアニメーションタイマー時間とCSS `@keyframes`の時間を手打ちで一致させており(`animationend`イベント未使用)、ズレると演出が壊れる潜在的な脆弱ポイントがある。フェーズ13で構造的に解消する際の入力として`reference/playarea-tech-debt.md`を参照すること。
- **RunはbeginRun直後に一度shopフェーズを経由する**: 旧仕様書には未記載だった遷移。詳細は`reference/00-updated-rules.md`。

## フェーズ2 実行結果(完了)

Godotプロジェクトを`c:\Users\the-f\Documents\ClaudeProjects\Shidasu-Godot\`に新規作成し、ローカルgitリポジトリとして初期化済み(リモート未作成)。実パス・ADR一覧は`reference/godot-project-location.md`を参照。

- ソリューション構成: `Shidasu.Core`(Pure C#、Godot非依存)・`Game/`(Godotプロジェクト本体、C#アダプタ層)・`Shidasu.Core.Tests`(xUnit)の3プロジェクト、`ShidasuGodot.slnx`でビルド成功確認済み
- Godot 4.6.3 / .NET 8.0(net8.0)を採用
- 状態管理は`record`+`with`式、乱数は`System.Random`+mulberry32相当の自前PRNG、命名規約等をADR 0001〜0005として文書化
- **重要な構造上の決定**: Godotプロジェクト本体はリポジトリ直下ではなく`Game/`サブフォルダに分離した。SDK形式csprojの暗黙globが`Shidasu.Core`配下のソースを二重コンパイルしてしまう問題が実際に発生したため(詳細は`docs/adr/0001-project-structure.md`)。後続フェーズでファイルを配置する際はこの構成を前提にすること
- **環境注意点(解消済み)**: 当初この実行環境には.NET 10のみがインストールされておりnet8.0の実行用ランタイムがなく`dotnet test`が失敗していたが、ユーザーが.NET 8.0 Runtime(x64)を追加インストール済み(.NET 10と共存)。`dotnet test`で2件のサンプルテストが成功することを確認済み。

## フェーズ3 実行結果(完了)

`types.ts`の型定義・`shidasu.config.json`のパラメータ/コンテンツデータを`Shidasu.Core/Data/`配下にC#で移植した(効果ロジックは対象外、フェーズ6〜9で実装)。

- enum・record: `Suit`/`StageModifier`/`SabotageActionId`(32)/`SpreadId`(10)/`RoleName`(10)/`ItemId`(**133**)/`RiteId`(24)/`RevelationId`(28)/`RelicId`(10)/`RunPhase`/`ShopSlotKind`/`CardSetGenreId`のenumと、`Card`/`DeckCard`/`ScoreGain`/`Star`(判別共用体はabstract record継承+パターンマッチングで表現)のrecordを定義。`Rank`は算術演算(±1、K⇔Aループ)を多用するためenum化せず`int`のまま扱う方針にした
- コンテンツIDプール(`ItemPool`等)は`Enum.GetValues<T>()`で代替(Web版のプールは均等抽選専用で並び順に意味がないため)
- JSONローダー(`ParamsLoader.LoadFromJson(string json)`): `Shidasu.Core`はGodotに依存できないため、ファイルパスではなくJSON文字列を受け取る設計にした。護符等の可変パラメータ(`m`/`n`等、項目により異なる)は個別クラス化せず、共通の`ContentEntry`型+`System.Text.Json`の`[JsonExtensionData]`で吸収する設計(ADR0005のTalismanMetaパターンを実装)
- enumキーの`Dictionary<ItemId, ContentEntry>`等をデシリアライズするため、camelCase JSONキー(`"bridge"`等)⇔PascalCase enum名(`Bridge`)を変換するカスタム`JsonConverterFactory`を実装
- `dotnet build ShidasuGodot.slnx`・`dotnet test`とも成功(17件のテスト全てパス、護符133/秘儀24/天啓28/レリック10/妨害32の件数一致を確認)

## フェーズ4 実行結果(完了)

`RunState`/`WaveState`を`types.ts`から全フィールド移植し、`deck.ts`(`createRng`=mulberry32・シャッフル・デッキ生成・スプレッド固有変形)、`beginRun`/`startWave`/`resolveWaveEnd`/`enterShop`/`finishShop`等のRun/Wave進行フローを`Shidasu.Core`に実装した(効果ロジック・スコア計算はスタブのまま、フェーズ5〜9の担当)。

- `WaveState`⇔`RunState`間で同期する7つの永続カウンタ(`dedicationX`/`diligenceX`/`divineProtectionX`/`discretionN`/`frostX`/`echoX`/`shootingStarN`)のコピー・書き戻しタイミングをWeb版通りに再現し、専用テストで検証済み
- `rollShop`/`rollSabotage`/`rerollRandomTargets`等の他フェーズ担当ロジックはシグネチャのみ確定してスタブ化(フェーズ6・8・9で差し替え予定)
- `dotnet build`/`dotnet test`とも成功、21件のテスト全て成功(全10スプレッドでの`beginRun`、24Wave分のRun通し、7値同期の検証を含む)

## フェーズ5 実行結果(完了)

`patterns.ts`(10役判定)・`scoreParts.ts`・`isPlayable`/`getPlayableColumns`・`playCard`(26ステップの計算順序)・`drawStock`・`isStuck`/`markStuck`を`Shidasu.Core`に移植した。

- フック1〜3(`ApplyItemEffects`/`ResolvePlayTriggeredRewardTalismans`/`ResolvePlayTriggeredCurrencyGain`、フェーズ6が本実装)のみスタブとし、それ以外の護符関連分岐(黄金・祝福・鋼鉄・献身・勤勉・加護・果断・星霜・残響・慢心・静寂・沈着・冷静・博愛・素朴・約束・再生・治癒・庇護・大地・明星・架橋・慈悲・誓約・契り)は本フェーズで完全実装済み
- `waveReset.ts`の`ResetComboFields`も本フェーズで追加移植(playCard/drawStockの暗黙の依存として判明)
- フェーズ4のスタブ(約束護符の並べ替え・手詰まり判定)を本実装に差し替え
- `dotnet build`/`dotnet test`とも成功、76件のテスト全て成功(既存21件+`patterns.test.ts`移植50件+スコアリングパイプライン検証5件)

## フェーズ6 実行結果(完了)

護符100種(clearBonus 3・cardCombo 18・chainAttribute 24・stateAndPattern 20・rewardTalisman 24・waveStart 3・waveEnd 8)を`Shidasu.Core`に実装した(残り33種はフェーズ5で完全実装済み・独自効果なし・他フェーズ担当のいずれか)。

- フェーズ5の3スタブ(`ApplyItemEffectsStub`等)を実装に差し替え。所持順に効果を逐次適用する設計と、水鏡(waterMirror)による左隣護符の再適用ロジックを実装
- 永劫/豊穣/不屈はフェーズ4の時点で既に完全実装済みと判明し、重複実装を回避(担当エージェントが自主的に検出)
- ファイル競合を避けるため、共有ファイル(`ScoringPipeline.cs`/`WaveFlow.cs`/`RunFlow.cs`)の編集担当を4グループ間で明確に分離して並列実装
- `dotnet build`/`dotnet test`とも成功、221件のテスト全て成功(既存76件+護符関連145件)。GitHubリモート(`https://github.com/kuroto-96X/Shidasu-Godot`)へpush済み

## フェーズ7 実行結果(完了)

秘儀24種(WaveStateのみ書き換え)・天啓28種(WaveState+deckComposition両方を書き換え)を`Shidasu.Core`に実装した。

- `useRite`/`useRevelation`の処理順序をengine.ts通りに再現し、フェーズ6で保留にしていたdiscretion/frost/exchange護符の配線用共有ヘルパー(`ApplyDiscretionFrostBonus`/`ApplyExchangeBonus`)を実装、両方から再利用
- `hotori`(昴)の自己参照ループ防止、`useRevelation`内での`ApplyExchangeBonus`適用順序(Web版で実際に発生したバグの再発防止)をテストで検証済み
- `dotnet build`/`dotnet test`とも成功、329件のテスト全て成功。GitHubリモートへpush済み

## フェーズ8 実行結果(完了)

神託10種(単一パターン、`run.OracleLevels`/`wave.OracleLevels`両方を同期)・レリック10種(付喪化ボーナスを共通ヘルパー`RelicBonus`に集約)、ショップの価格計算(5カテゴリ共通の`CategoryPrice`)・購入(`BuyIndividualHold<TId>`)・売却(`SellFromArray<T>`)・福袋中身選択(`ResolvePackOfferPick<T>`)・トランプセット福袋23ジャンルを`Shidasu.Core`に実装した。

- フェーズ6で保留していた`nestEgg`(儲蓄)のsellBonus加算を`sellItem`で配線
- `useOracle`で`ApplyDiscretionFrostBonus`/`ApplyExchangeBonus`(フェーズ7のヘルパー)を再利用
- `dotnet build`/`dotnet test`とも成功、464件のテスト全て成功。GitHubリモートへpush済み
