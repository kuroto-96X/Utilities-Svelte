# Shidasu itemEffects.ts さらなる分割 設計

## 0. 背景・目的

先行するリファクタリング(`docs/superpowers/specs/2026-07-18-shidasu-engine-refactor-design.md`)で`engine.ts`から`itemEffects.ts`を抽出したが、`ITEM_EFFECTS`定数(62護符分のレジストリ)が578行という単一ファイルとして残っており、今後護符を追加・修正する際に依然としてファイル全体を読む必要がある。

`docs/shidasu-gofu-candidates.md`に、護符ごとの実装グルーピング(グループ1〜17、実装時期・判定ロジックの種類で分類済み)が既に文書化されているため、この既存分類に沿って`itemEffects.ts`をさらに4つのカテゴリファイルへ分割する。**挙動は一切変更しない、純粋なリファクタリング**であることが最重要の制約。

## 1. ファイル構成

```
src/lib/game/shidasu/
  itemEffects.ts             (ItemEffectContext・ItemEffect型・4ファイルをマージしたITEM_EFFECTS・applyItemEffects)
  clearBonusEffects.ts       (グループ1: 忍耐・浄化・節制 [3個])
  cardComboEffects.ts        (グループ2+3: 春風・夏風・秋風・冬風・友愛・雪解・宵闇・払暁・機知・勇気・暁・黄昏・快活・良心・朝霧 [15個])
  chainAttributeEffects.ts   (グループ4: 平穏・安寧・運命・宿命・安堵・深緑・宝石・真剣・聖杯・月光・陽光・王冠・青葉・硬貨・武器・献杯・均衡・調和・高潔・執念・覚悟・循環・輪廻・威光 [24個] + 内部ヘルパー7個(chainHasNoFace/chainIsFaceOnly/chainSuitExclusive/chainColorExclusive/countSuitInChain/countRankInChain/redBlackBalanced))
  stateAndPatternEffects.ts  (グループ5,6,7,8,9,10,12,16,17: 兆し・三日月・恩寵・集中・瑠璃・翡翠・無心・序章・幕間・朝露・小雨・微風・共鳴・蒼穹・琥珀・直感・情熱・闘志・慈悲・刻限 [20個])
```

`itemEffects.ts`は578行→100行程度に縮小見込み。62護符すべてが上記いずれかに過不足なく分配される(3+15+24+20=62)。

各ファイルの`patterns.ts`への依存:
- `clearBonusEffects.ts`: 依存なし
- `cardComboEffects.ts`: `isRed`(宵闇・払暁が使用)
- `chainAttributeEffects.ts`: `isFace`・`isRed`・`analyzeSuitColor`・`analyzeStair`・`stairUsesKALoop`
- `stateAndPatternEffects.ts`: 依存なし

## 2. 型の相互参照の扱い

`ItemEffectContext`型・`ItemEffect`型は`itemEffects.ts`に残す。4つのカテゴリファイルはこの型を`import type { ItemEffectContext, ItemEffect } from './itemEffects'`という**型のみの**importで使用する。`itemEffects.ts`側は4ファイルから効果マップの実体をimportする。

型のみのimportはコンパイル時に消去されるため、実行時のモジュール循環importにはならない。

`fmtMultiplier`(倍率表示の整形関数)は、カテゴリファイル側からも実体として呼ばれるため、実行時の循環を避ける目的で`itemEffects.ts`から`patterns.ts`へ移動する。`engine.ts`の`fmtMultiplier`のimport元も`./itemEffects`から`./patterns`に変更する(バレル禁止・実体ファイルから直接importという既存方針にも合致)。

## 3. テストファイルの分割

```
src/lib/game/shidasu/
  itemEffects.test.ts             (「未登録の護符は素通り」等、applyItemEffects自体の汎用テストのみ残す)
  clearBonusEffects.test.ts       (忍耐・浄化・節制のテスト)
  cardComboEffects.test.ts        (グループ2+3のテスト)
  chainAttributeEffects.test.ts   (グループ4-a〜4-dの4ブロックすべて)
  stateAndPatternEffects.test.ts  (グループ5,6,7,8,9,10,12,16,17のテスト)
```

各ブロックの`describe`名・アサーション内容は一切変更しない(移動のみ)。既存の`testHelpers.ts`の`ctx()`は全ファイルから引き続きimportして使う。

## 4. 検証方針(ゼロ挙動変化の担保)

1. 各ファイルの移動は「コピー&import文の追加」のみで、関数本体のロジックは1文字も変えない
2. グループ1つにつき1タスク程度に分割し、各タスク後に`npm run test`(該当ファイルのテスト数が分割前と一致すること含む)・`npm run check`を実行する
3. 全タスク完了後、`npm run build`と実際のブラウザでの動作確認(`/game/shidasu`でいくつかの護符を有効にしてプレイし、スコア計算・護符効果が分割前と同じであること)を行う
4. `engine.ts`の`fmtMultiplier`import元変更(`./itemEffects`→`./patterns`)を含め、`npm run check`で型エラーがないことを確認する
5. 途中のどのタスクでも、既存テストの期待値(アサーション)は変更しない

## 5. スコープ外

- `ITEM_EFFECTS`のロジック自体の変更・改善
- `clearBonusEffects.ts`/`cardComboEffects.ts`等のさらなる細分化(グループ番号単位への分割。今回は4カテゴリまでに留める)
- `engine.ts`本体・`patterns.ts`・`items.ts`・`directEffects.ts`の追加分割

## 6. 受け入れ基準

1. `src/lib/game/shidasu/itemEffects.ts`が、`ItemEffectContext`・`ItemEffect`型・4ファイルをマージした`ITEM_EFFECTS`・`applyItemEffects`のみを含む状態になっている
2. 62護符すべてが`clearBonusEffects.ts`・`cardComboEffects.ts`・`chainAttributeEffects.ts`・`stateAndPatternEffects.ts`のいずれかに過不足なく分配されている
3. `fmtMultiplier`が`patterns.ts`に移動しており、`engine.ts`のimport元も更新されている
4. カテゴリファイルが`ItemEffectContext`/`ItemEffect`型を型のみのimportで参照しており、実行時の循環importが発生しない
5. `itemEffects.test.ts`が対応する4ファイル(`clearBonusEffects.test.ts`・`cardComboEffects.test.ts`・`chainAttributeEffects.test.ts`・`stateAndPatternEffects.test.ts`)に分割され、汎用テストのみ`itemEffects.test.ts`に残っている
6. 分割前後でテストケースの総数が一致し、`npm run test`が全件成功する
7. `npm run check`・`npm run build`が成功する
8. `/game/shidasu`の実際の動作(スコア計算・護符効果)が分割前と変化していない
