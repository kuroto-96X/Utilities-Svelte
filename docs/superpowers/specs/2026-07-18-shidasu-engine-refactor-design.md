# Shidasu engine.ts / engine.test.ts 分割 設計

## 0. 背景・目的

`src/lib/game/shidasu/engine.ts`(1772行)・`src/lib/game/shidasu/engine.test.ts`(3793行)が肥大化しており、今後のClaudeCodeによる修正作業(護符追加・スコア式変更など)のたびにファイル全体を読み込む必要があり、探索・編集の効率が落ちている。

役割ごとにファイルを分割し、今後の作業(特にサブエージェント方式での実装)で「必要な部分だけを読み込めばよい」状態にする。**挙動は一切変更しない、純粋なリファクタリング**であることが最重要の制約。

## 1. `engine.ts`の分割

```
src/lib/game/shidasu/
  engine.ts        (コア: カード基本関数・startWave・playCard・drawStock・
                     isStuck/markStuck・forceStockTop・RunStateライフサイクル)
  itemEffects.ts    (ItemEffectContext・ITEM_EFFECTS レジストリ・applyItemEffects・
                     関連の内部ヘルパー関数・fmtMultiplier)
  directEffects.ts  (DirectEffectContext・DIRECT_EFFECTS レジストリ・applyDirectEffects)
  patterns.ts       (evaluateChainBonus・analyzeStair・analyzeSuitColor・checkFlush・
                     checkRoyalSet・chainContinuesPattern など、独立した純粋なパターン判定関数群)
  items.ts          (ITEM_POOL・itemName・itemDesc・shuffleItems・rollItemOffer)
```

- `engine.ts`は1772行→750行程度に縮小する見込み
- 依存関係は`engine.ts` → `itemEffects.ts`/`directEffects.ts`/`patterns.ts`/`items.ts`の一方向。循環参照は発生しない
- 各ファイルの移動は「コピー&import文の追加」のみで、関数本体のロジックは1文字も変更しない

### バレル(再エクスポート)は用意しない

`engine.ts`を薄い再エクスポートにはしない。外部ファイルは実体のあるファイルから直接importする。

現在`engine.ts`から関数をimportしている外部ファイルは8つ。うち`itemDesc`をimportしているのは以下の2ファイルのみで、これらのimport元を`$lib/game/shidasu/engine`から`$lib/game/shidasu/items`に変更する。

- `src/routes/admin/shidasu-debug/DebugStatePanel.svelte`
- `src/routes/admin/shidasu-talismans/+page.svelte`

残り6ファイル(`shidasu-debug/+page.svelte`・`ItemChecklist.svelte`・`game/shidasu/+page.svelte`・`CardFace.svelte`・`DebugPanel.svelte`・`PlayArea.svelte`)は、分割後も`engine.ts`側に残るコア関数(`startWave`/`playCard`/`drawStock`/`forceStockTop`/`ITEM_POOL`など)しか使っておらず、import元の変更は不要(`ITEM_POOL`は`items.ts`に移るため、これをimportしている箇所は`items.ts`からのimportに変更する)。

## 2. `engine.test.ts`の分割 + テストヘルパーの共通化

```
src/lib/game/shidasu/
  engine.test.ts        (startWave/playCard/drawStock/isStuck・markStuck・
                          RunStateライフサイクルのテスト)
  itemEffects.test.ts   (ITEM_EFFECTS/applyItemEffectsのテスト)
  directEffects.test.ts (DIRECT_EFFECTS/applyDirectEffectsのテスト)
  patterns.test.ts      (evaluateChainBonus/analyzeStair/analyzeSuitColorなどのテスト)
  items.test.ts         (ITEM_POOL/itemName/itemDescのテスト)
  testHelpers.ts        (新規: 共通ctx()/directCtx()ヘルパー)
```

現状`engine.test.ts`には`ItemEffectContext`を組み立てる`ctx()`ヘルパーがdescribeブロックごとに14箇所ほぼ同じ内容でコピーされている。ファイル分割のタイミングで`testHelpers.ts`に一本化し、各テストファイルはそこから`ctx(overrides)`/`directCtx(overrides)`をimportして使う。

- 既存テストの**アサーション内容・テストケース自体は一切変更しない**(移動のみ)。`ctx()`/`directCtx()`呼び出しに置き換わる箇所も、生成される`ItemEffectContext`/`DirectEffectContext`の値は既存コピーと同一になるよう機械的に移行する
- describeブロック単位でファイルを移す(護符ごとのテストは対応する`itemEffects.test.ts`等にまとめて移動)

## 3. 検証方針(ゼロ挙動変化の担保)

1. 分割作業は5タスク程度に分ける(itemEffects/directEffects/patterns/itemsそれぞれの本体+テストを1タスクとし、最後にengine.ts本体の整理・全体確認を1タスク)
2. 各タスク後に`npm run test`を実行し、該当ファイルのテスト数(`it(...)`の総数)が分割前と一致することを確認したうえで、全件成功することを確認する
3. 各タスク後に`npm run check`(型チェック)を実行する
4. 全タスク完了後、`npm run build`を実行し、実際のブラウザで`/game/shidasu`・`/admin/shidasu-debug`・`/admin/shidasu-talismans`の動作確認を行う(スコア計算・護符効果・説明文表示が分割前と同じであること)
5. 途中のどのタスクでも、既存テストの期待値(アサーション)は変更しない — テストが落ちた場合は移行ミスとして扱い、テスト側ではなく移行後のコード配置を疑う

## 4. スコープ外

- `ITEM_EFFECTS`/`DIRECT_EFFECTS`のロジック自体の変更・改善
- `engine.ts`本体(コア部分)のさらなる分割
- テストケースの追加・削除・アサーション内容の変更

## 5. 受け入れ基準

1. `src/lib/game/shidasu/engine.ts`が、カード基本関数・`startWave`・`playCard`・`drawStock`・`isStuck`/`markStuck`・`forceStockTop`・`RunState`ライフサイクル関数のみを含む状態になっている
2. `ITEM_EFFECTS`/`ItemEffectContext`/`applyItemEffects`関連が`src/lib/game/shidasu/itemEffects.ts`に、`DIRECT_EFFECTS`/`DirectEffectContext`/`applyDirectEffects`関連が`src/lib/game/shidasu/directEffects.ts`に、パターン判定関数群が`src/lib/game/shidasu/patterns.ts`に、`ITEM_POOL`/`itemName`/`itemDesc`/`shuffleItems`/`rollItemOffer`が`src/lib/game/shidasu/items.ts`に、それぞれ移動している
3. `engine.ts`が新規4ファイルをimportして使用しており、バレル(再エクスポート)は存在しない
4. `itemDesc`をimportしている2ファイル(`DebugStatePanel.svelte`・`shidasu-talismans/+page.svelte`)のimport元が`items.ts`に更新されている
5. `engine.test.ts`が対応する5ファイル(`engine.test.ts`・`itemEffects.test.ts`・`directEffects.test.ts`・`patterns.test.ts`・`items.test.ts`)に分割され、`testHelpers.ts`に共通の`ctx()`/`directCtx()`ヘルパーが一本化されている
6. 分割前後でテストケースの総数が一致し、`npm run test`が全件成功する
7. `npm run check`・`npm run build`が成功する
8. `/game/shidasu`・`/admin/shidasu-debug`・`/admin/shidasu-talismans`の実際の動作(スコア計算・護符効果・説明文表示)が分割前と変化していない
