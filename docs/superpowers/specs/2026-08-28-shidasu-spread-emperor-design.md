# 新規スプレッド「皇帝」(デッキ枚数x2・場札行x2・目標スコアx2・護符スロット-1) 実装設計

## 背景・目的

`docs/shidasu/shidasu-spread-candidates.md`の「具体的なルール候補一覧」の候補E(「初期デッキの枚数x倍、場札配布行x倍、基礎目標スコアx倍、護符の所持スロット-N(初期値x=2, N=1)」)を、新規スプレッド「皇帝」(`emperor`)として実装する。既存の`fool`(愚者)・`moon`(月)・`pope`(教皇)・`empress`(女帝)・`magician`(魔術師)・`justice`(正義)・`lovers`(恋人)に続く8種類目のスプレッドになる。

初期デッキが2組(104枚)になり、場札の配布行数が2倍、目標スコアも2倍になる一方、護符の所持スロットが1減る「規模拡大・ハイリスクハイリターン」型のスプレッド。

## 変更内容

### 1. `SpreadId`型に`'emperor'`を追加

対象: `src/lib/game/shidasu/types.ts`

```ts
export type SpreadId = 'fool' | 'moon' | 'pope' | 'empress' | 'magician' | 'justice' | 'lovers' | 'emperor'
```

コメントに`emperor(皇帝)=初期デッキ・場札・目標スコアが全て2倍になるが、護符所持スロットが1減る`旨を追記する。

### 2. `SpreadConfig`型の整理

対象: `src/lib/game/shidasu/types.ts`

**削除**: `waveTargetBase: number`・`waveTargetMultiplier: number`

これらは全7既存スプレッドが同一値(`2000`/`1.5`)を持つ未使用の拡張用フィールドで、実際の`waveTarget`関数(`engine.ts`)は`params.flow.stageTargetBase`/`stageTargetMultiplier`という別のグローバル設定を参照しており、この2フィールドはどこからも読まれていない(死んだフィールド)。

**追加**:

```ts
export interface SpreadConfig {
  name: string
  desc: string
  initialExtraTableauRows: number
  // 初期デッキ生成時、標準デッキ(52枚)を何組連結するか(既定1)。2ならデッキ枚数が2倍(104枚)になる。
  deckMultiplier: number
  // 場札の配布行数への倍率(既定1)。ラン開始時、
  // params.layout.rows * tableauRowMultiplier - params.layout.rows を
  // initialExtraTableauRowsに加算する形で反映する(基準行数の変更に自動追従するため)。
  tableauRowMultiplier: number
  // 目標スコア(waveTarget)への倍率(既定1)。
  targetScoreMultiplier: number
  initialOracleLevel: number
  bannedShopKinds: ShopSlotKind[]
  initialCurrencyBonus: number
  initialItemCapacityBonus: number
  excludedRanks: Rank[]
  unifyBlackRedSuits: boolean
}
```

### 3. `deck.ts`にデッキ複製ヘルパー関数を新設

対象: `src/lib/game/shidasu/deck.ts`

```ts
// 標準デッキ(52枚)をmultiplier組連結したdeckCompositionを生成する。deckIdは重複しないよう
// 通し番号で振り直す(例: multiplier=2なら0〜103の104個)。multiplier=1のときは
// standardDeckComposition()と同じ結果になる。
export function multipliedDeckComposition(multiplier: number): DeckCard[] {
  const composition: DeckCard[] = []
  let deckId = 0
  for (let i = 0; i < multiplier; i++) {
    for (const suit of SUITS) {
      for (let rank = 1; rank <= 13; rank++) {
        composition.push({ deckId: deckId++, suit, rank: rank as Rank, wild: false, removed: false })
      }
    }
  }
  return composition
}
```

### 4. `beginRun`(`engine.ts`)への反映

対象: `src/lib/game/shidasu/engine.ts`

```ts
export function beginRun(params: ShidasuParams, seed?: number, spreadId: SpreadId = 'fool'): RunState {
  const spreadConfig = params.spreads[spreadId]
  const extraRowsFromMultiplier = params.layout.rows * spreadConfig.tableauRowMultiplier - params.layout.rows
  const initialExtraTableauRows = spreadConfig.initialExtraTableauRows + extraRowsFromMultiplier
  const rand = createRng(seed ?? Math.floor(Math.random() * 999999) + 1)
  const initialStageStars = rollStageStars(params, rand)
  const oracleLevels = oracleLevelsWithUniformValue(spreadConfig.initialOracleLevel)
  const initialRun = createInitialRun()
  const baseDeckComposition = spreadConfig.deckMultiplier === 1
    ? initialRun.deckComposition
    : multipliedDeckComposition(spreadConfig.deckMultiplier)
  const deckCompositionAfterExclusion = spreadConfig.excludedRanks.length === 0
    ? baseDeckComposition
    : baseDeckComposition.map(c =>
        spreadConfig.excludedRanks.includes(c.rank) ? { ...c, removed: true } : c
      )
  const deckComposition = spreadConfig.unifyBlackRedSuits
    ? unifyBlackRedSuits(deckCompositionAfterExclusion, rand)
    : deckCompositionAfterExclusion
  return {
    ...initialRun,
    phase: 'shop',
    extraTableauRows: initialExtraTableauRows,
    spreadId,
    stageStars: initialStageStars,
    currency: params.currency.initialAmount + spreadConfig.initialCurrencyBonus,
    oracleLevels,
    deckComposition,
  }
}
```

`initialRun.deckComposition`(`createInitialRun()`が生成する`standardDeckComposition()`)は`deckMultiplier === 1`のときのみ使い、それ以外は`multipliedDeckComposition`で組み直す。

### 5. `waveTarget`関数への`spreadId`引数追加

対象: `src/lib/game/shidasu/engine.ts`

```ts
export function waveTarget(params: ShidasuParams, stageIndex: number, waveIndex: number, stageStars: Star[], spreadId: SpreadId): number {
  const base = params.flow.stageTargetBase * params.flow.stageTargetMultiplier ** stageIndex
  const star = stageStars[waveIndex]
  const spreadMultiplier = params.spreads[spreadId].targetScoreMultiplier
  return Math.floor(base * (star?.targetMultiplier ?? 1) * spreadMultiplier)
}
```

呼び出し元2箇所(`engine.ts`内の`resolveWaveEnd`関数・`resolvePlayContext`関数、いずれも`run: RunState`を引数に持つ)に`run.spreadId`を追加で渡す。

### 6. `DEFAULT_PARAMS.spreads`・`shidasu.config.json`への反映

- 既存7スプレッド(fool/moon/pope/empress/magician/justice/lovers)から`waveTargetBase`/`waveTargetMultiplier`を削除し、代わりに`deckMultiplier: 1`・`tableauRowMultiplier: 1`・`targetScoreMultiplier: 1`を追加
- 新規`emperor`: `deckMultiplier: 2`・`tableauRowMultiplier: 2`・`targetScoreMultiplier: 2`・`initialItemCapacityBonus: -1`、他は`fool`と同じ

### 7. `SPREAD_IDS`に`'emperor'`を追記

対象: `src/lib/game/shidasu/params.ts`

### 8. 既存の死んだUIの削除

**削除対象ファイル**: `src/routes/admin/shidasu/SpreadsSection.svelte`

このコンポーネントは`/admin/shidasu-spreads`(単一テーブル型ページ)が作られる前の古い実装で、`fool`・`moon`の2スプレッドしかハードコードで扱っておらず、`pope`以降の5スプレッドは編集不可能な状態で放置されている。

**修正対象**: `src/routes/admin/shidasu/+page.svelte`

- `import SpreadsSection from './SpreadsSection.svelte'`を削除
- `<SpreadsSection {config} />`の使用箇所を削除
- `hasValidationError`内の以下6行を削除:
  ```ts
  if (!Number.isFinite(config.spreads.fool.initialExtraTableauRows)) return true
  if (!Number.isFinite(config.spreads.fool.waveTargetBase) || config.spreads.fool.waveTargetBase <= 0) return true
  if (!Number.isFinite(config.spreads.fool.waveTargetMultiplier) || config.spreads.fool.waveTargetMultiplier <= 1) return true
  if (!Number.isFinite(config.spreads.moon.initialExtraTableauRows)) return true
  if (!Number.isFinite(config.spreads.moon.waveTargetBase) || config.spreads.moon.waveTargetBase <= 0) return true
  if (!Number.isFinite(config.spreads.moon.waveTargetMultiplier) || config.spreads.moon.waveTargetMultiplier <= 1) return true
  ```

**修正対象**: `src/routes/admin/shidasu/JsonPanel.svelte`

JSON妥当性チェックから以下の型チェックを削除:
```ts
typeof fool?.waveTargetBase === 'number' &&
typeof fool?.waveTargetMultiplier === 'number' &&
typeof moon?.waveTargetBase === 'number' &&
typeof moon?.waveTargetMultiplier === 'number' &&
```

### 9. `/admin/shidasu-spreads`のUI更新

対象: `src/routes/admin/shidasu-spreads/+page.svelte`

- 既存の「目標スコア基礎値」「目標スコア倍率」列(`waveTargetBase`/`waveTargetMultiplier`用)を削除
- 新規「デッキ枚数倍率」「場札行倍率」「目標スコア倍率」列(いずれも`number`入力)を追加
- `hasValidationError`から`waveTargetBase`/`waveTargetMultiplier`のチェックを削除し、`deckMultiplier`/`tableauRowMultiplier`/`targetScoreMultiplier`の`Number.isFinite`チェックを追加

## 役判定への影響(未検証事項)

デッキが2組になり、同じランク・スートのカードが複数枚存在する状態になる。既存の役判定ロジック(フラッシュ・階段・同ランク・コンプリートラン等)がこの状況で破綻しないか、実装時に既存テストで確認する。理論上は「スート・ランクの比較」ベースのロジックなので大きな問題は起きないと想定しているが、コンプリートラン(13ランク制覇)等の役が複数デッキ環境で意図しない挙動を示す可能性はゼロではない。実装フェーズで挙動を確認し、問題があれば別途対応を検討する(本設計のスコープには含めない)。

## テスト方針

- `src/lib/game/shidasu/params.test.ts`: `emperor`の`deckMultiplier`が`2`・`tableauRowMultiplier`が`2`・`targetScoreMultiplier`が`2`・`initialItemCapacityBonus`が`-1`であること、他7スプレッドが全て`deckMultiplier: 1`・`tableauRowMultiplier: 1`・`targetScoreMultiplier: 1`であることを確認する
- `src/lib/game/shidasu/deck.test.ts`: `multipliedDeckComposition(1)`が`standardDeckComposition()`と同じ結果になること、`multipliedDeckComposition(2)`が104枚・deckIdが0〜103の連番であること、各スート・ランクの組み合わせが2枚ずつ存在することを確認する
- `src/lib/game/shidasu/engine.test.ts`:
  - `beginRun(params, seed, 'emperor')`で`run.deckComposition`が104枚になることを確認する
  - `run.extraTableauRows`が`spreadConfig.initialExtraTableauRows + (params.layout.rows * 2 - params.layout.rows)`と一致することを確認する(`params.layout.rows`が5の場合、`extraTableauRows`は5になる)
  - `waveTarget(params, stageIndex, waveIndex, stageStars, 'emperor')`が`spreadId`省略時(または`fool`指定時)の2倍になることを確認する
  - `waveTarget`の既存呼び出しテストに`spreadId`引数が必要になるため、既存テストを`'fool'`明示指定に更新する
- 既存の役判定関連テスト(`patterns.test.ts`等)が全てPASSすることを確認する(回帰確認)

## スコープ外

- 候補Fの実装
- 複数デッキ時の役判定ロジックの新規調整(既存ロジックで問題が発生した場合のみ対応を検討、今回は既存ロジックをそのまま使う)
- `SpreadsSection.svelte`削除以外の`/admin/shidasu`ページの改修(他のセクションには手を加えない)
