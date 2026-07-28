# ラン構成の再構築 設計

## 背景・目的

星詠みソリティア「Shidasu」の現在のラン進行(ステージ/Wave構造)は、`stageIndex`が3の倍数周期で「小凶/中凶/大凶」という階級を繰り返し、階級が上がるほど遵しい制限ルール(ボス種別)が課される、という直線的な構造になっている。この構造が単調で、変化に乏しいという課題認識から、Balatro(Ante/Blind構造)を参考にしつつ、Shidasuの世界観(星詠み・占い)に沿った新しいラン構成へ再設計する。

配布アニメーション実装セッション(`docs/superpowers/specs/2026-07-28-shidasu-deal-animation-design.md`)で見つかった「ショップ画面表示中に配布アニメーションが誤発火する問題」は、このラン構成再構築によって発火タイミングの設計自体が変わる可能性が高いため、対応を保留していた。本設計により新設される「ステージ画面での確認後に次Wave開始」というアクションが、配布アニメーションの専用トリガーポイントとして自然に機能する見込みがある(詳細な実装方針は本specの対象外、実装セッションで検討する)。

## スコープ

このセッションでは、ラン構成再構築の**データモデルと仕様**を確定させる。実装(`engine.ts`・UI変更)は別セッションでplan作成から進める。

対象:
- 「星」(Wave単位の新概念、旧: 小凶/中凶/大凶)のデータモデル定義
- `RunState`型の変更方針(廃止・追加フィールド)
- 目標点数の算出方式
- 新設「ステージ画面」の仕様(表示内容・スキップ/リロール操作)
- Wave進行フロー全体の見直し
- 「大凶撃破時の続行確認」に代わる新しい終端(ラン全体のクリア条件)

対象外:
- 実際のコード変更(`engine.ts`・`+page.svelte`・`PlayArea.svelte`等)
- 「妨害行為」の具体的な中身(今回はプレースホルダーとしてのみ定義)
- 「報酬」の具体的な計算式(今回は固定額として仮置き、計算式は将来検討)
- ラン全体の代替名称(「ラン」という呼称が本来の意図と異なる場合、名称は別途検討。`RunState`型名は変更しない)
- 配布アニメーション誤発火問題の実装対応(ラン構成再構築後に改めて検討)

## 「星」データモデル

Wave単位の新概念。旧来の「小凶/中凶/大凶」という階級・世界観上の対極表現として「星」(接尾辞)を採用し、各星は固有の名前を持つ。全ての星は`waveSlot`(1・2・3のいずれか)を持つフラットな1つのリストとして定義される。Wave開始時、そのWave番号(1/2/3)と`waveSlot`が一致する星の中からランダムに1つ選ばれる。

```ts
type StarRestriction =
  | { kind: 'noLoop' }
  | { kind: 'faceLock' }
  | { kind: 'lowCombo'; maxCombo: number }
  | { kind: 'oddCombo' }
  | { kind: 'suit'; suit: Suit }
  | { kind: 'face' }
  | null

interface Star {
  id: string
  name: string
  waveSlot: 1 | 2 | 3
  targetMultiplier: number
  reward: number
  restriction: StarRestriction
  sabotage: null
}
```

- `restriction`: 制限ルール。既存の6種類のボス種別(`noLoop`/`faceLock`/`lowCombo`/`oddCombo`/`suit`/`face`)をkindで判別するUnion型として引き継ぐ。`suit`が選ばれた場合のみ、星が選出されると同時にスートをランダム抽選し`restriction.suit`に確定させる(旧`currentGreatMisfortuneSuit`のような`RunState`側の別フィールド保持は不要になる)。
- `sabotage`: 妨害行為(新要素、今後実装予定)。今回は型として`null`のみを持つプレースホルダー。
- `reward`: 報酬(旧: 通貨)。今回は単一の固定額(`number`)として仮置きする。計算式の詳細は将来のセッションで検討する。

### 星の初期ラインナップ(現時点の想定)

| 名前 | waveSlot | restriction |
|---|---|---|
| 普通の衛星 | 1 | なし |
| 少し大きな衛星 | 2 | なし |
| 循環の閉じた荒廃惑星 | 3 | noLoop |
| 高貴なる封印の惑星 | 3 | faceLock |
| 弱き者を拒む峻厳な惑星 | 3 | lowCombo |
| 奇数を忌む歪んだ惑星 | 3 | oddCombo |
| 排斥の色殺す惑星 | 3 | suit |
| 王侯を打ち滅ぼす惑星 | 3 | face |

waveSlot 1・waveSlot 2は現時点でそれぞれ1つずつしか定義しないため実質固定になるが、データ構造としては将来複数候補を追加できる拡張性を持つ。

## `RunState`の変更方針

- **廃止**: `currentBossKind`, `currentGreatMisfortuneSuit`(いずれも`Star.restriction`に統合されるため不要)
- **追加**: `stageStars: [Star, Star, Star]`。新しいステージに入る直前(`waveIndex`が0に戻るタイミング)に、waveSlot 1・2・3それぞれの候補群から1つずつランダム抽選し、ステージ内の3Wave分をまとめて確定させる。リロール操作では`stageStars[2]`(waveSlot 3の分)のみ再抽選される(waveSlot 1・2はリロール対象外、後述)。

## 目標点数の算出方式

ステージ基準点を指数式で算出し、各Waveの「星」が持つ倍率をかけ合わせる。

```
base(stageIndex) = waveTargetBase × stageMultiplier ^ stageIndex
target(stageIndex, waveIndex) = base(stageIndex) × stageStars[waveIndex].targetMultiplier
```

`waveTargetBase`・`stageMultiplier`は管理画面の`params`で調整可能な既存パラメータ(現行の`waveTargetBase`/`waveTargetMultiplier`を踏襲、ステージ単位の指数として再定義する)。

## 新設「ステージ画面」

Wave開始前に毎回表示される画面。ショップ画面(`fixed inset-0`のオーバーレイ)と同様の構造で新設する。

**表示タイミング**: Waveクリア → ショップ → 「次のWaveへ」ボタン押下 → **ステージ画面** → 確認操作 → 次Wave開始、という順番。新しいステージへ入る場合は、ステージ画面表示前に`stageStars`を新規抽選する。

**表示内容**: そのステージの3Wave分(`stageStars`全て)を、縦並びのカードリストとして一括表示する。各カードには星の名前・倍率・報酬・制限ルールを表示する。既にクリア済みのWave・現在挑戦中のWaveも含めて、ステージ内の3Wave全体を俯瞰できる。

**操作**:
- **Waveスキップ**: 未消化のWaveをプレイせずに次のWaveへ進む。報酬は一切得られない(今回は代替特典なし)。
- **リロール**: waveSlot 3(3Wave目)のみ、通貨を消費してその星を引き直せる。waveSlot 1・2は星が実質固定のため、リロールボタン自体を表示しない。

## Wave進行フロー全体

1. Waveクリア → ショップ画面
2. ショップで「次のWaveへ」を押す
3. 新しいステージに入る場合は`stageStars`を新規抽選
4. ステージ画面を表示(3Wave分の情報を一覧、スキップ・リロール操作が可能)
5. 確認操作で次のWaveを開始(`waveKey`相当の変化、配布アニメーションのトリガーになりうる)

## ラン全体の終端(旧: 大凶撃破後の続行確認)

現行の「大凶(3ステージ周期の最後)撃破時に続ける/やめるを選べるチェックポイント」は、階級制廃止に伴い意味を失う。代わりに、**8ステージクリアでラン全体のクリア**とし、そのタイミングで1回だけ「続ける/やめる」の続行確認を挟む。「続ける」を選べばステージ9以降も継続、「やめる」を選べばそこでラン終了(クリア扱い)とする。

## 廃止される既存要素

- `bossTierOf`, `BOSS_TIER_KEYS`, `params.bossTiers`, `params.bosses`(旧6種の名称・説明): `Star`一覧に統合される
- `isBossWave`(waveIndex === wavesPerStage - 1の判定): waveSlot 3(3Wave目)がこれに相当するため、実質的な用途は残るが名称・扱いは見直しが必要(実装セッションで検討)

## テスト方針

このセッションではデータモデル・仕様の確定のみを行うため、自動テストの追加・変更はない。実装セッションで`engine.ts`の変更に伴うユニットテストの追加・既存テスト(`bossTierOf`・`currentBossKind`関連)の削除・書き換えが必要になる。

## 実装セッションからの申し送り(データモデル層完了時点)

`types.ts`・`params.ts`・`engine.ts`・`bosses.ts`・`bossActualEffects.ts`・`engine.test.ts`の変更が完了した。当初「別セッション」の予定だった`+page.svelte`の型エラー解消・管理画面(`src/routes/admin/shidasu-bosses/+page.svelte`)の最小限修正も、`npm run build`がビルド全体を通す都合上、今回のセッション内で対応した(`bosses.ts`から削除されたシンボルを管理画面がimportしていたため、`MISSING_EXPORT`でビルド自体が失敗する状態だったため)。

- `npm run build`・`npm run check`・`npx vitest run src/lib/game/shidasu`(589件)すべて成功

以下は次セッションで対応が必要:

1. **ステージ画面の新設**: `+page.svelte`のWave進行フロー(ショップ→ステージ画面→次Wave)は未実装。現状は`enterShop`が確定させた`stageStars`を使って即座に次Waveへ進む形のまま。ヘッダー表示(`upcomingBossInfo`)も最小限の暫定表示のみ。
2. **Waveスキップ・リロールのUI**: 未実装。`engine.ts`側にもスキップ・リロールを行う関数はまだ存在しない(Star抽選ロジックのみ実装済み)。
3. **8ステージクリア後の`continueChoice`画面の文言・演出**: 暫定的に「ステージ突破!」という固定文言にしている。適切な演出は別途検討。
4. **管理画面(`admin/shidasu-bosses`)の本格UI**: 今回は「動く最小限のシンプルなUI」(stars配列を素朴なテーブルで編集、追加・削除ボタンのみ)にとどめた。UX改善(waveSlotごとのグルーピング表示、ドラッグ&ドロップでの並び替え等)は別途検討。
5. **`bosses.ts`・`params.ts`内の非推奨フィールド(`bossTiers`・`bosses`)の削除**: `types.ts`の`BossKind`・`BossTierKey`型とあわせて削除する。`BossTiersSection.svelte`(`config.bossTiers.*.name`を参照)も合わせて整理が必要。
6. **配布アニメーションの誤発火問題(再掲)**: `docs/superpowers/specs/2026-07-28-shidasu-deal-animation-design.md`に記載の通り保留中。ステージ画面新設のタイミングで改めて検討する。
