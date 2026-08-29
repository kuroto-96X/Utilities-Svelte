# フェーズ10: ロジック層の統合検証・xUnitユニットテスト整備

> このプロンプトは、Shidasu(Balatro風トランプソリティア型ローグライク)をGodot(C#)へ移植し、Steam向けPCゲームとして販売するプロジェクトの一部です。Godotプロジェクトは元のWebリポジトリ(Utilities-Svelte)とは別管理ですが、VSCodeのマルチルートワークスペースにより両方のファイルを参照できます。
>
> 着手前に必ず読むこと:
> - `Utilities-Svelte/docs/shidasu/migration/01-work-plan.md`(全体計画)
> - フェーズ4〜9の成果物一式(本フェーズはこれらすべてのロジック実装が対象)

## 目的

Web版はロジック層(`src/lib/game/shidasu/`)のほぼ全モジュールにvitestテストが対応しており、テストファイル21個・合計約10,700行(`engine.test.ts`だけで6,267行、約80個の`describe`ブロック)という高い網羅性を持つ。この網羅性を`Shidasu.Core`(Pure C#)でも再現し、以後の変更(バランス調整・バグ修正)に対する回帰検知の土台を作る。

## 前提・依存

- 依存: フェーズ4〜9(Run/Wave進行・スコアリング・護符・秘儀/天啓・神託/レリック/ショップ・妨害/スプレッド、のロジック実装すべて)。
- **本フェーズは「最終棚卸し」の位置づけである。** 理想的には各フェーズ(4〜9)の実装時にそのフェーズ分のテストを都度追加しておくべきで、本フェーズを「全部まとめて最後に一括で書く」フェーズだと誤解しないこと。もし先行フェーズでテストが未整備のまま進んでいた場合、本フェーズで不足分をまとめて追いつかせる。
- テスティングフレームワークとして **xUnit(またはNUnit)** を使う。`Shidasu.Core`はGodotランタイムに一切依存しないPure C#のクラスライブラリなので、Godotエディタを起動せず、標準の.NETテストプロジェクトから直接ロジック層を呼び出してテストできる(TypeScript版のvitestに近い開発体験を再現できる)。テストプロジェクトの雛形はフェーズ2で用意済みの前提とする。

## 作業内容

### 1. xUnitテストプロジェクトの整備

- フェーズ2で用意した`Shidasu.Core`用のxUnit(またはNUnit)テストプロジェクトを確認し、不足があれば整備する(パッケージ参照・ソリューションへの追加・`dotnet test`での実行確認)。
- テストファイルの配置規約を決める(例: `Shidasu.Core.Tests/`配下に、移植元のvitestファイル名に対応させた`*Tests.cs`を1対1で配置)。
- コマンドラインから`dotnet test`で全テストを実行できることを確認する(Godotエディタを一切起動せずに実行できる状態を必須とする。CIやフェーズ16のパッケージング前チェックで使うため)。

### 2. vitestテストケースのxUnit形式への翻訳

以下の優先順で移植する(work-plan.mdの依存関係と同じ順序、コアロジックほど土台になるため先に固める)。

1. **コアスコアリング**: `patterns.test.ts`(919行、役判定10種+チェーンボーナス評価)・`scoreParts.test.ts`(得点内訳)・`chainAttributeEffects.test.ts`・`cardComboEffects.test.ts`・`stateAndPatternEffects.test.ts`。`evaluateChainBonus`関連のdescribeブロックが特に大きい(`patterns.test.ts`の505〜919行目、神託レベルによる得点上昇を含む)ので優先的に翻訳する。
2. **護符**: `itemEffects.test.ts`・`items.test.ts`・`itemGroups.test.ts`・`rewardTalismanEffects.test.ts`。99種すべてを1件ずつ検証しているわけではなく代表的な効果パターンを検証している構成なので、翻訳時も「効果パターンの網羅」を意識する(全99種の個別テストが無いからといって移植時に手を抜いて良いわけではなく、フェーズ6の実装が正しいかはここで担保する)。
3. **秘儀/天啓**: `riteEffects.test.ts`(456行)・`rites.test.ts`・`revelationEffects.test.ts`(487行)・`revelations.test.ts`。天啓の自己参照ループ防止など防御ロジックのテスト(フェーズ7で移植済みのはず)が含まれているか確認する。
4. **妨害/ショップの優先順**: `sabotage.test.ts`・`sabotageEffects.test.ts`・`shop.test.ts`(265行)・`relics.test.ts`(190行)・`cardSets.test.ts`(297行)・`deck.test.ts`(295行)。`engine.test.ts`内の妨害関連describe(`星のsabotage割り当て`/`startWaveの妨害初期抽選`/`妨害のターンカウントダウン`/`役封印のoracleLevelへの反映`/`役偏重(roleBias)のoracleLevelへの反映`/`comboCapのplayCard/drawStockへのクランプ`/`triggerSabotage`/`配当(dividend)`/`妨害の発動トリガー統合`、5071〜6044行目付近)は分量が大きいので優先的に押さえる。
5. **`engine.test.ts`全体の棚卸し**: 上記1〜4のテストで拾いきれない`engine.ts`固有のロジック(`startWave`/`playCard`/`drawStock`/`isStuck`/`resolveWaveEnd`/`beginRun`/ショップフロー関数群/`useRite`/`useRevelation`/`useOracle`/`sellItem`系等)を、`engine.test.ts`の`describe`ブロック一覧(345行目`startWave`から6247行目付近`賞金・僥倖・祝儀`まで、約80ブロック)を目視で洗い出し、対応するxUnitテストが存在するか突き合わせる。抜けがあれば追加する。

各vitestの`describe`/`it`は、原則としてxUnitの`[Fact]`/`[Theory]`メソッド1つに1対1対応させる(粒度を大きくまとめ直さない。後からどのWeb版テストに対応するxUnitテストか追跡できるようにするため)。`testHelpers.ts`(`card()`・`ctx()`ヘルパー)に相当する共通ヘルパークラスをテストプロジェクト側にも用意し、テストごとに手組みのダミーオブジェクトを重複して書かないようにする。

### 3. 固定シードによるスモークテスト

- `createRng`相当の`Shidasu.Core`内RNG実装(フェーズ2で方針決定済み)に対し、固定シードを与えてRun開始→全ステージ・全ウェーブを自動プレイ→Run終了(All Clear or Game Over)まで通す自動テストを作成する。
- 自動プレイのロジックは「常に取得可能な場札の中から1枚を選ぶ→取得可能な場札が無ければ山札を引く→手詰まりならウェーブ終了処理→ショップフェーズは規定のロジック(例: 何も買わずに次へ進む、または簡易的な購入ロジック)で自動突破する」といった、意思決定が複雑でなくてよい機械的なプレイヤーで十分。目的は「例外を投げずに最後まで完走できるか」の検証であり、最適なプレイや高得点を目指す必要はない。
- 複数の異なる固定シードで実行し、妨害発動・ショップ購入・スプレッド違いなど分岐が偏らないようにする。

## 参照すべき既存ファイル(Utilities-Svelte内)

- `src/lib/game/shidasu/engine.test.ts`(6,267行): 最大のテストファイル。`describe`ブロック一覧は`^describe\(`で検索すると全体像を把握しやすい(`startWave`/`playCard`/`drawStock`/`isStuck`/`resolveWaveEnd`/ショップ関連/`useRite`/`useRevelation`/`useOracle`/妨害統合、等)。
- `src/lib/game/shidasu/patterns.test.ts`(919行): 役判定10種のテスト。`evaluateChainBonus`関連が最大のブロック。
- `src/lib/game/shidasu/testHelpers.ts`: `card(id, suit, rank, wild, deckId)`・`ctx(overrides, params)`という共通テストヘルパー。多数のテストファイルから使われている(`ItemEffectContext`の初期値を1箇所で管理する設計)。xUnitテストプロジェクト側でも同等の共通ヘルパークラスを用意すること。
- 各`*.test.ts`(21ファイル、内訳は本文参照): それぞれ対応する実装ファイル(`*.ts`)と1対1。
- `src/lib/game/shidasu/sabotageEffects.test.ts`・`sabotage.test.ts`: 分量は少ないが「全件が例外を投げずに完走するか」という疎通テストの書き方の参考になる(妨害32種を1つのループでテストしている)。

## 成果物・保存先

- `Shidasu.Core`用xUnit(またはNUnit)テストプロジェクト一式(vitestの各`*.test.ts`に対応する`*Tests.cs`)、共通テストヘルパークラス。
- 固定シードによるRun全体の自動プレイスモークテスト(複数シード分)。
- 実行コマンド(READMEやスクリプトとして、`dotnet test`等どのコマンドで全テストを回せるかを明記)。

## 完了条件

- [ ] `Shidasu.Core`用xUnit(またはNUnit)テストプロジェクトが整備され、コマンドラインから`dotnet test`で全テストを実行できる
- [ ] コアスコアリング(役判定・チェーンボーナス・得点内訳)のテストが翻訳され、Web版と同等のケース(正常系・境界値・神託レベルによる変化等)をカバーしている
- [ ] 護符・秘儀・天啓のテストが翻訳され、代表的な効果パターンを一通り検証している
- [ ] 妨害32種・ショップ・封印/没収/強制発動のテストが翻訳され、`engine.test.ts`の妨害統合系describeブロック(星のsabotage割り当て〜妨害の発動トリガー統合まで)に対応するケースが揃っている
- [ ] `engine.test.ts`の`describe`ブロック一覧と突き合わせ、対応するxUnitテストが存在しない項目がないことを確認した
- [ ] 固定シード(複数)によるRun全体の自動プレイスモークテストが、例外を投げずに最後まで完走することを確認した
- [ ] 全テストがGodotエディタを開かず、コマンドラインから実行・合否判定できる(`Shidasu.Core`がGodotランタイムに依存しないことの利点)

## 注意点

- 「各フェーズ内で都度テストを追加する運用が望ましい」という前提を踏まえ、本フェーズ着手時にまず「フェーズ4〜9のどこまで既にxUnitテストがあるか」を棚卸しすることから始める。ゼロから全部書き直す前提で作業しないこと。
- vitestの`describe`/`it`とxUnitの`[Fact]`/`[Theory]`メソッドは1対1対応を基本とし、対応関係が追跡できるようにする(コメントで元のvitestファイル名・行番号を残すなど)。
- スモークテストはあくまで「例外なく完走するか」の検証であり、数値バランスの妥当性検証ではない。数値レベルの正確性は個々のユニットテスト(手順2)側で担保する。
