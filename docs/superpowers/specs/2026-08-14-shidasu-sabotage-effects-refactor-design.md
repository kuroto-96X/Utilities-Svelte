# triggerSabotage 個別関数化リファクタ 設計

> 対象: `src/lib/game/shidasu/engine.ts`の`triggerSabotage`関数(22ケース・約190行のswitch文)を、既存の`applyRiteEffect`(`riteEffects.ts`)・`applyRevelationEffect`(`revelationEffects.ts`)と同じパターンで、各効果を個別関数に切り出すリファクタ。純粋なリファクタであり、ゲームの挙動は一切変更しない。

## 背景・目的

星の妨害行動は2ラウンド(計22個)の実装を経て、`triggerSabotage`のswitch文が22ケース・約190行まで肥大化した。この状態は、最終ホリスティックレビューで繰り返し指摘されてきた:

- 「大きなプール型ディスパッチャ」としてこのコードベースの既存慣習(`applyRiteEffect`・`applyRevelationEffect`は各ケースを個別の`applyXxx`関数に委譲する薄いディスパッチャ)から外れている
- switch文には`default`ケースも`never`型による網羅性チェックも無いため、TypeScriptが「新しいIDを追加したのにケースを書き忘れる」ミスを検出できない(このセッション中に複数回、この構造上の弱点自体は実害には至らなかったものの繰り返し話題になった)

残り候補(Phase B、10個)が今後さらに追加される前に、既存の22個を整理しておく。

## 方針(スコープ)

- 純粋なリファクタ。`triggerSabotage`が返す`RunState`の内容は、あらゆる入力に対して変更前と完全に同一であることを、既存のテストスイート(`triggerSabotage`経由の939件のテスト、無修正のまま)がグリーンであることで保証する
- ディスパッチはswitch文からRecordマップ方式に変更する。`Record<SabotageActionId, Handler>`という型注釈により、TypeScriptが「22種類全てにハンドラが存在するか」をコンパイル時に強制する(既存switch文には無かった網羅性チェックを獲得する)
- 個別関数への直接テストの追加はスコープ外(YAGNI、既存の`triggerSabotage`経由のテストで十分な回帰保証がある)
- Phase B(残り10個)の実装は別セッション、本リファクタのスコープ外

## 技術設計

### 新規ファイル: `src/lib/game/shidasu/sabotageEffects.ts`

`riteEffects.ts`・`revelationEffects.ts`と同じ立ち位置(効果の実装を`engine.ts`から分離する専用ファイル)。

```ts
export interface SabotageContext {
  params: ShidasuParams
  run: RunState
  wave: WaveState
  rand: () => number
}

// wave・runへの差分(部分更新)。両方ともoptional(片方だけ、あるいはどちらも変更しない場合はキー自体を省略する)
export interface SabotageResult {
  wave?: Partial<WaveState>
  run?: Partial<RunState>
}
```

22個の効果それぞれを、`apply` + `SabotageActionId`をPascalCase化した名前の関数として実装する(`riteEffects.ts`の`raidho`→`applyRaidho`と同じ命名規則):

```
stockPurge            → applyStockPurge
columnReturn          → applyColumnReturn
chainSettle           → applyChainSettle
comboBreather         → applyComboBreather
talismanSeal          → applyTalismanSeal
riteSeal              → applyRiteSeal
revelationOracleSeal  → applyRevelationOracleSeal
relicConfiscate       → applyRelicConfiscate
tableauCardToDiscard  → applyTableauCardToDiscard
currencyConfiscate    → applyCurrencyConfiscate
roleSeal              → applyRoleSeal
stockPurgeSmall       → applyStockPurgeSmall
stockShuffle          → applyStockShuffle
tableauFullReturn     → applyTableauFullReturn
tableauShuffle        → applyTableauShuffle
chainPartialDiscard   → applyChainPartialDiscard
chainShuffle          → applyChainShuffle
comboReduce           → applyComboReduce
comboCap              → applyComboCap
talismanConfiscate    → applyTalismanConfiscate
riteConfiscate        → applyRiteConfiscate
riteForceActivate     → applyRiteForceActivate
```

各関数のシグネチャは`(ctx: SabotageContext) => SabotageResult`に統一する(Recordマップの値として型が揃っている必要があるため)。関数内部では`ctx`から必要なものだけを分割代入で取り出して使う。

例(`stockPurge`、既存のswitchケースをそのまま関数化):

```ts
function applyStockPurge({ wave }: SabotageContext): SabotageResult {
  const n = Math.min(5, wave.stock.length)
  const purged = wave.stock.slice(wave.stock.length - n)
  return { wave: { stock: wave.stock.slice(0, wave.stock.length - n), discardPile: [...wave.discardPile, ...purged] } }
}
```

例(`talismanConfiscate`、RunStateのみを返す):

```ts
function applyTalismanConfiscate({ run, rand }: SabotageContext): SabotageResult {
  if (run.items.length === 0) return {}
  const idx = Math.floor(rand() * run.items.length)
  return { run: { items: [...run.items.slice(0, idx), ...run.items.slice(idx + 1)] } }
}
```

例(`riteForceActivate`、wave・run両方を返す。既存の「`activatedWave`は元の`wave.activeSeal`を引き継ぐため、明示的に`activeSeal: null`で上書きする必要がある」という注意点はそのまま引き継ぐ):

```ts
function applyRiteForceActivate({ params, run, wave, rand }: SabotageContext): SabotageResult {
  const usable = run.rites.filter(riteId => canUseRite(params, wave, riteId))
  if (usable.length === 0) return {}
  const target = usable[Math.floor(rand() * usable.length)]
  const activatedWave = applyRiteEffect(params, wave, target, rand)
  const idx = run.rites.indexOf(target)
  return {
    wave: { ...activatedWave, activeSeal: null },
    run: { rites: [...run.rites.slice(0, idx), ...run.rites.slice(idx + 1)] },
  }
}
```

ファイル末尾にRecordマップとエントリポイントを定義する:

```ts
const SABOTAGE_HANDLERS: Record<SabotageActionId, (ctx: SabotageContext) => SabotageResult> = {
  stockPurge: applyStockPurge,
  columnReturn: applyColumnReturn,
  // ...22件全て
}

export function applySabotageEffect(id: SabotageActionId, ctx: SabotageContext): SabotageResult {
  return SABOTAGE_HANDLERS[id](ctx)
}
```

### `engine.ts`側の変更

`triggerSabotage`関数を以下に置き換える(22ケースのswitch文を削除):

```ts
export function triggerSabotage(params: ShidasuParams, run: RunState, id: SabotageActionId, rand: () => number = Math.random): RunState {
  if (!run.wave) return run
  const wave = run.wave
  const resetWave: WaveState = { ...wave, activeSeal: null }
  const result = applySabotageEffect(id, { params, run, wave, rand })
  const nextWave: WaveState = { ...resetWave, ...result.wave }
  const nextRun: RunState = { ...run, ...result.run, wave: nextWave }

  const star = nextRun.stageStars[nextRun.waveIndex]
  const rolled = rollSabotage(star?.sabotage ?? { kind: 'none' }, rand)
  return { ...nextRun, wave: { ...nextRun.wave, pendingSabotageId: rolled.pendingSabotageId, sabotageTurnsRemaining: rolled.sabotageTurnsRemaining } }
}
```

`resetComboFields`関数(`chainSettle`のハンドラが必要とする)に`export`を追加する。`applySabotageEffect`を`sabotageEffects.ts`からimportする。

## テスト

- 既存の`triggerSabotage`経由のテスト(`engine.test.ts`内、22個の効果それぞれの検証+統合テスト、計939件)を無修正のまま実行し、全てグリーンであることを確認する。これが本リファクタの主たる正しさの根拠になる。
- `sabotage.ts`(`SABOTAGE_POOL`定義)・`sabotage.test.ts`は変更不要(このリファクタは`triggerSabotage`の内部実装のみが対象)。

## スコープ外

- Phase B(残り10個)の実装
- 個別`applyXxx`関数への直接ユニットテストの追加
- `SABOTAGE_HANDLERS`の管理画面や動的登録の仕組み
