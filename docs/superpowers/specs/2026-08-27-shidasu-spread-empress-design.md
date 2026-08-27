# 新規スプレッド「女帝」(初期所持金+N) 実装設計

## 背景・目的

`docs/shidasu/shidasu-spread-candidates.md`の「具体的なルール候補一覧」の候補A(「初期所持金+N(初期値N=10)」)を、新規スプレッド「女帝」(`empress`)として実装する。既存の`fool`(愚者)・`moon`(月)・`pope`(教皇)に続く4種類目のスプレッドになる。

## 変更内容

### 1. `SpreadId`型に`'empress'`を追加

対象: `src/lib/game/shidasu/types.ts`

```ts
// スプレッド: ラン開始時にプレイヤーが選ぶ固有ルールセット。大アルカナから命名する。
// fool(愚者)=特殊ルールなしの基本スプレッド、moon(月)=場札が常に1行少ない状態で始まる、
// pope(教皇)=神託の初期レベルが上がるが、ショップで神託が販売されない、
// empress(女帝)=初期所持金が多い状態で始まる
export type SpreadId = 'fool' | 'moon' | 'pope' | 'empress'
```

### 2. `SpreadConfig`型に`initialCurrencyBonus: number`フィールドを追加

対象: `src/lib/game/shidasu/types.ts`

既存の`initialOracleLevel`と同型のパターン。ラン開始時の初期所持金(`params.currency.initialAmount`)へのオフセット。既定値は0(影響なし)。

```ts
export interface SpreadConfig {
  name: string
  desc: string
  initialExtraTableauRows: number
  waveTargetBase: number
  waveTargetMultiplier: number
  initialOracleLevel: number
  bannedShopKinds: ShopSlotKind[]
  // 初期所持金(currency.initialAmount)へのオフセット。既定0(影響なし)。
  initialCurrencyBonus: number
}
```

### 3. `SPREAD_IDS`に`'empress'`を追記

対象: `src/lib/game/shidasu/params.ts`

```ts
export const SPREAD_IDS: SpreadId[] = ['fool', 'moon', 'pope', 'empress']
```

### 4. `DEFAULT_PARAMS.spreads`に`empress`エントリを追加、既存3スプレッドにも`initialCurrencyBonus: 0`を追加

対象: `src/lib/game/shidasu/params.ts`

```ts
spreads: {
  fool: { name: '愚者', desc: '特殊ルールなし', initialExtraTableauRows: 0, waveTargetBase: 2000, waveTargetMultiplier: 1.5, initialOracleLevel: 1, bannedShopKinds: [], initialCurrencyBonus: 0 },
  moon: { name: '月', desc: '場札が常に1行多い状態で始まる。Wave開始時に配られる場札の上半分(端数切捨て)の行は裏向きになる。', initialExtraTableauRows: 1, waveTargetBase: 2000, waveTargetMultiplier: 1.5, initialOracleLevel: 1, bannedShopKinds: [], initialCurrencyBonus: 0 },
  pope: { name: '教皇', desc: '神託の初期レベルが5になるが、ショップで神託が販売されない', initialExtraTableauRows: 0, waveTargetBase: 2000, waveTargetMultiplier: 1.5, initialOracleLevel: 5, bannedShopKinds: ['oracle'], initialCurrencyBonus: 0 },
  empress: { name: '女帝', desc: '初期所持金が10多い状態で始まる', initialExtraTableauRows: 0, waveTargetBase: 2000, waveTargetMultiplier: 1.5, initialOracleLevel: 1, bannedShopKinds: [], initialCurrencyBonus: 10 },
},
```

### 5. `shidasu.config.json`にも同内容を反映

対象: `src/lib/game/shidasu/shidasu.config.json`

既存3スプレッドのエントリに`"initialCurrencyBonus": 0`を追加し、`empress`エントリを新規追加する。

### 6. `beginRun`で`initialCurrencyBonus`を反映

対象: `src/lib/game/shidasu/engine.ts`

```ts
export function beginRun(params: ShidasuParams, seed?: number, spreadId: SpreadId = 'fool'): RunState {
  const spreadConfig = params.spreads[spreadId]
  const initialExtraTableauRows = spreadConfig.initialExtraTableauRows
  const rand = createRng(seed ?? Math.floor(Math.random() * 999999) + 1)
  const initialStageStars = rollStageStars(params, rand)
  const oracleLevels = oracleLevelsWithUniformValue(spreadConfig.initialOracleLevel)
  return {
    ...createInitialRun(),
    phase: 'shop',
    extraTableauRows: initialExtraTableauRows,
    spreadId,
    stageStars: initialStageStars,
    currency: params.currency.initialAmount + spreadConfig.initialCurrencyBonus,
    oracleLevels,
  }
}
```

### 7. `/admin/shidasu-spreads`に列を1つ追加

対象: `src/routes/admin/shidasu-spreads/+page.svelte`

既存の「神託初期レベル」列の右隣に「初期所持金オフセット」列(`number`入力、`step="any"`)を追加する。`hasValidationError`の`$derived.by`にも`Number.isFinite(entry.initialCurrencyBonus)`のチェックを追加する。

## テスト方針

- `src/lib/game/shidasu/params.test.ts`: `empress`の`initialCurrencyBonus`が`10`であること、`fool`/`moon`/`pope`の`initialCurrencyBonus`が`0`であることをアサートするテストを追加する
- `src/lib/game/shidasu/engine.test.ts`: `beginRun(params, seed, 'empress')`のとき、`run.currency`が`params.currency.initialAmount + 10`になることを確認するテストを追加する。既存の`beginRun`テスト(`spreadId`省略時=`fool`)は`run.currency === params.currency.initialAmount`のままであることも確認する(回帰確認)
- 実装完了後、プロジェクトCLAUDE.mdの完了前チェック(`npm run build`・`npm run check`・`npm run dev`でのブラウザ動作確認)で最終確認する。`npm run dev`では、`/game/shidasu`のスプレッド選択画面に「女帝」が表示されること、選択してランを開始した際の所持金が愚者と比べて10多いことを確認する

## スコープ外

- 他の名称候補・他の具体的ルール候補(B〜F)の実装
- `initialCurrencyBonus`以外の新規フィールド追加
- `docs/shidasu/shidasu-spread-candidates.md`の候補A行・名称候補一覧の更新(実装完了後、別途ドキュメント更新で対応)
