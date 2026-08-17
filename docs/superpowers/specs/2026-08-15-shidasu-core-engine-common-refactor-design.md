# コア進行系(engine.ts)共通化リファクタ 設計

> 対象: `src/lib/game/shidasu/engine.ts`のコア進行系関数(`createInitialRun`/`beginRun`、`applyPlayCard`/`applyDrawStock`/`applyStuckCheck`、`useRite`/`useRevelation`/`useOracle`)にある機械的な重複を、安全な範囲で共通化する。純粋なリファクタであり、ゲームの挙動は一切変更しない。

## 背景・目的

これまでのセッションで3回、`engine.ts`・`shop.ts`・`+page.svelte`にあったショップ・福袋・売買まわりの重複を共通ヘルパーに切り出すリファクタを実施した。

1. 福袋(item/rite/revelation/oracle/cardSet)のpick/confirm/cancel/close処理の共通化(`docs/superpowers/specs/2026-08-15-shidasu-pack-flow-common-refactor-design.md`)
2. 売却系4関数・価格関数6個・buy/sellハンドラ10個の共通化(`docs/superpowers/specs/2026-08-15-shidasu-sell-price-handler-common-refactor-design.md`)
3. バラ売り購入(buyIndividual)系4関数の共通化(`docs/superpowers/specs/2026-08-15-shidasu-buy-individual-hold-common-refactor-design.md`)

これらはいずれもショップ・福袋・売買まわりが対象で、`engine.ts`のコア進行系(`playCard`/`drawStock`を呼び出すラッパー、Run初期化、秘儀・天啓・神託の使用処理)は未調査だった。今回改めて調査した結果、3箇所の明確な機械的重複が見つかった。

## 方針(スコープ)

3つの独立した共通化を行う。いずれも`engine.ts`単体で完結し、公開APIのシグネチャ・戻り値は一切変更しない。

## 技術設計

### A. `createInitialRun()`/`beginRun()`の重複解消

現状、`beginRun`は独自にRunStateリテラルを組み立てているが、以下5フィールド以外は`createInitialRun()`と完全に同じ値になっている: `phase`(`'title'` vs `'shop'`)・`extraTableauRows`(`0` vs `params.spreads[spreadId].initialExtraTableauRows`)・`spreadId`(`'fool'` vs 引数の`spreadId`)・`stageStars`(`[]` vs `initialStageStars`)・`currency`(`0` vs `params.currency.initialAmount`)。

```ts
export function beginRun(params: ShidasuParams, seed?: number, spreadId: SpreadId = 'fool'): RunState {
  const initialExtraTableauRows = params.spreads[spreadId].initialExtraTableauRows
  const rand = createRng(seed ?? Math.floor(Math.random() * 999999) + 1)
  const initialStageStars = rollStageStars(params, rand)
  return {
    ...createInitialRun(),
    phase: 'shop',
    extraTableauRows: initialExtraTableauRows,
    spreadId,
    stageStars: initialStageStars,
    currency: params.currency.initialAmount,
  }
}
```

### B. `applyPlayCard`/`applyDrawStock`/`applyStuckCheck`の重複解消

`playCard`/`drawStock`の呼び出しに必要な文脈値(目標スコア・得点ロック・実効護符・役封印効果・コンボ上限)の算出と、呼び出し後の「妨害トリガー判定」処理が、3関数で一字一句同じ形で繰り返されている。

```ts
function resolvePlayContext(params: ShidasuParams, run: RunState, wave: WaveState) {
  return {
    target: waveTarget(params, run.stageIndex, run.waveIndex, run.stageStars),
    scoreLock: bossScoreLockFor(params, run),
    effectiveItems: resolveEffectiveItems(run.items, wave.activeSeal),
    sealedRoleEffect: resolveSealedRoleEffect(wave.activeSeal),
    comboCap: resolveComboCap(wave.activeSeal),
  }
}

// playCard/drawStock適用後、妨害発動タイミング(sabotageTurnsRemaining<=0)なら即座にtriggerSabotageを適用する。
function resolveActionSabotage(params: ShidasuParams, next: RunState, wave: WaveState, rand: () => number): RunState {
  if (wave.pendingSabotageId && wave.sabotageTurnsRemaining <= 0) {
    return triggerSabotage(params, next, wave.pendingSabotageId, rand)
  }
  return next
}
```

`stageModifierFor(params, run)`(`modifier`)は`resolvePlayContext`には含めない。`applyStuckCheck`は`isStuck`判定より前の時点で`modifier`を単独で必要とするため、`resolvePlayContext`に含めると呼び出し元で二重計算・不自然な分離が発生する。`modifier`は各呼び出し元がこれまで通り個別に計算する。

`applyPlayCard`・`applyDrawStock`は関数全体をこの2ヘルパー呼び出しに単純化できる。`applyStuckCheck`は`resetWave.stock.length > 0`の分岐内(実際に`drawStock`を呼ぶケース)でのみこの2ヘルパーを使う(手詰まり確定でそのまま`markStuck`する経路は対象外のまま)。

### C. `useRite`/`useRevelation`/`useOracle`の重複解消

「果断・星霜(discretion/frost)」加算の2行ブロックが、コメントごと3箇所で完全に同一。

```ts
function applyDiscretionFrostBonus(run: RunState, params: ShidasuParams, wave: WaveState): WaveState {
  let next = wave
  if (run.items.includes('discretion')) next = { ...next, discretionN: next.discretionN + params.talismans.discretion.n }
  if (run.items.includes('frost')) next = { ...next, frostX: next.frostX + params.talismans.frost.x }
  return next
}
```

`useOracle`のみ`wave`が`null`になりうる(`run.wave`が`null`の状態でも呼べる設計)ため、既存の`if (wave) { ... }`ガードは呼び出し元に残す。ヘルパー自体は`WaveState`必須のシンプルな関数にする(null分岐まで汎用化しようとすると、ジェネリクスでの型ナローイングが絡み複雑になる割に得るものが少ないため)。

## テスト

- 純粋なリファクタのため、既存の`engine.test.ts`内の該当関数(`beginRun`・`applyPlayCard`・`applyDrawStock`・`applyStuckCheck`・`useRite`・`useRevelation`・`useOracle`)関連テストを無修正のまま実行し、全てグリーンであることを確認する。これが本リファクタの正しさの根拠になる。
- 新規ヘルパー(`resolvePlayContext`・`resolveActionSabotage`・`applyDiscretionFrostBonus`)自体への直接のユニットテスト追加はスコープ外とする(YAGNI、既存の経由テストで十分な回帰保証がある。これまでの3回のリファクタと同じ方針)。

## スコープ外

- `drawStock`内部の「naive」パス(playCardのスコア計算パイプラインを部分的に再実装している箇所)。構造は似ているが乗数の適用範囲が微妙に異なり、抽出には既存テストでの厳重な固め打ちが必要なため、今回は見送る
- `+page.svelte`の天啓プレビュー用「run.waveを一時差し替えて効果適用→戻す」パターン(3ハンドラで重複)。プレビュー継続/終了の分岐条件が呼び出し元ごとに微妙に異なり、慎重な検討が必要なため見送る
- `PlayArea.svelte`のアニメーション中判定の重複。今回はengine.ts側のみを対象とする
- 挙動・UIの変更(本リファクタは純粋なリファクタであり、ゲームの挙動は一切変更しない)
