# Shidasu スコア計算式の並び替え・護符4種の効果変更 設計

## 0. 背景・目的

護符の効果検証・バランス調整を進める中で、以下の変更が必要になった。

1. スコア計算式全体の構造変更(コンボ倍率を最後に一括適用)
2. 流星・序章・幕間・瑠璃の4護符の効果変更

いずれも`src/lib/game/shidasu/engine.ts`のスコアリングロジックに関わる変更で、既存のテストスイート(700件超)に大きな影響がある。

## 1. スコア計算式の並び替え(コンボ倍率を最後に)

### 現状

`playCard`・`drawStock`(素朴の護符によるnaiveスコアリング)ともに、以下の順序で計算している。

```
base = basePoint + チェーンボーナス + 列一掃ボーナス
rawGained = floor(base × コンボ倍率)
itemResult = applyItemEffects('gained', rawGained, items, ctx, params)  // 護符のgained効果をrawGainedに適用
gained = floor(itemResult.value)
```

護符の`gained`チャンネル効果(春風・勇気・恩寵など、加算型・倍算型どちらも含む)は、**コンボ倍率が既にかかった後の値**に対して適用されている。

### 変更後

```
base = basePoint + チェーンボーナス + 列一掃ボーナス   // 変更なし、乗算前
itemResult = applyItemEffects('gained', base, items, ctx, params)  // 護符のgained効果をbaseに適用
preMultiplier = itemResult.value
multiplier = 1 + (effectiveCombo - 1) × comboMultiplierStep
gained = floor(preMultiplier × multiplier)
```

コンボ倍率を**最後に一度だけ**適用する。護符の加算型効果(例: 春風+100)も含めて、最終的にコンボ倍率でスケールするようになる。乗算型効果(例: 勇気の倍率)は数学的には順序を入れ替えても最終値は変わらないが、中間の`Math.floor`が1箇所に統合されるため、二重丸め誤差が解消される。

**対象範囲**: `playCard`(通常のプレイ時スコアリング)と`drawStock`のnaive分岐(素朴の護符による山札めくり時スコアリング)の両方に同じ並び替えを適用する。

**変更しない部分**: 全消しボーナス(`clearBonus`チャンネル)・護符による直接加算(4つの`Direct`チャンネル: `resetDirect`・`stockEmptyDirect`・`comboMilestoneDirect`・`drawContinueDirect`)は、現状通りコンボ倍率の対象外のまま、上記の`gained`計算が完了した後に別枠で加算される。この関係は変更しない。

## 2. 流星の護符(shootingStar)

### 現状

```ts
shootingStar: {
  channel: 'comboMilestoneDirect',
  effect: (ctx, p) => (ctx.combo === p.talismans.shootingStar.c ? p.talismans.shootingStar.n : 0),
}
```

コンボ数が**ちょうど**`c`(既定10)になった瞬間のみ、固定`n`点を直接加算する。黄金の護符併用時、コンボが+2ずつ進むため9→11のようにちょうど10を踏まずに通過するケースがあり、その場合発動しない。

### 変更後

コンボ数が`c`**未満から`c`以上に到達した瞬間**(黄金併用でジャンプした場合も含む)、そのプレイの獲得点(`gained`、1節の新計算式適用後)を加算した後の現在スコアの`p`%を直接加算する。

```ts
shootingStar: {
  channel: 'comboMilestoneDirect',
  effect: (ctx, p) => {
    if (ctx.previousCombo >= p.talismans.shootingStar.c) return 0
    if (ctx.combo < p.talismans.shootingStar.c) return 0
    return Math.floor(ctx.scoreAfterGained * p.talismans.shootingStar.p / 100)
  },
}
```

- `talismans.shootingStar`のパラメータを`{ name, c, n }`から`{ name, c, p }`に変更する(`n`→割合`p`)
- `DirectEffectContext`に`previousCombo: number`(このプレイ直前のコンボ数)・`scoreAfterGained: number`(このプレイの`gained`加算後のスコア)を追加する
- `comboMilestoneDirect`チャンネルは現状通り`playCard`のみで評価される(`drawStock`では評価しない、現状維持)

## 3. 序章の護符(prologue)

### 現状

```ts
prologue: {
  channel: 'gained',
  effect: (v, ctx, p) =>
    ctx.combo === 1 ? { value: v + p.talismans.prologue.n, part: `序章+${p.talismans.prologue.n}` } : { value: v, part: null },
}
```

コンボ数が1の時に発動する。`gained`チャンネルは`playCard`だけでなく`drawStock`のnaive分岐でも評価されるため、理論上は山札めくりでも該当しうる。

### 変更後

「プレイ」でチェーン内の1枚目のプレイの時のみ発動する。山札めくりでは(素朴の護符を持っていても)発動しない。直前に山札めくりでコンボが継続していても、プレイとしては1枚目であれば発動する。

- `ItemEffectContext`に`isPlayAction: boolean`(このスコアリングがプレイによるものかどうか。`playCard`側は`true`、`drawStock`のnaiveCtx側は`false`)と`playCountInChain: number`(このプレイを含めて、現在のチェーン内で何枚目のプレイか)を追加する
- `playCountInChain`は`playCard`側で`wave.chainOrigin.filter(o => o === 'play').length + 1`として計算する(このプレイ自体はまだ`chainOrigin`に追加されていない時点の値なので+1する)
- `drawStock`のnaiveCtx側は`isPlayAction: false`を設定する(`playCountInChain`の値に関わらず、`isPlayAction`のガードで発動しない)

```ts
prologue: {
  channel: 'gained',
  effect: (v, ctx, p) =>
    ctx.isPlayAction && ctx.playCountInChain === 1
      ? { value: v + p.talismans.prologue.n, part: `序章+${p.talismans.prologue.n}` }
      : { value: v, part: null },
}
```

## 4. 幕間の護符(interlude)

### 現状

```ts
interlude: {
  channel: 'gained',
  effect: (v, ctx, p) =>
    ctx.combo % p.talismans.interlude.m === 0
      ? { value: v + p.talismans.interlude.n, part: `幕間+${p.talismans.interlude.n}` }
      : { value: v, part: null },
}
```

コンボ数が`m`の倍数に達するたび繰り返し発動する(m=5なら5, 10, 15…のたび)。

### 変更後

3節と同じ`playCountInChain`/`isPlayAction`を用いて、チェーン内でちょうど`m`枚目のプレイの時のみ、一回だけ発動する(繰り返しなし)。

```ts
interlude: {
  channel: 'gained',
  effect: (v, ctx, p) =>
    ctx.isPlayAction && ctx.playCountInChain === p.talismans.interlude.m
      ? { value: v + p.talismans.interlude.n, part: `幕間+${p.talismans.interlude.n}` }
      : { value: v, part: null },
}
```

## 5. 瑠璃の護符(lapis)

### 現状

```ts
lapis: {
  channel: 'gained',
  effect: (v, ctx, p) => {
    if (ctx.chainBonus.roleFired.length < 2) return { value: v, part: null }
    const factor = p.talismans.lapis.x
    return { value: v * factor, part: `瑠璃×${fmtMultiplier(factor)}` }
  },
}
```

役ボーナス(`roleFired`配列、フラッシュ・ロイヤル・同ランク・コンプリートラン・列一掃)が2種類以上同時発生したときのみ発動する。パターンボーナス(同スート・同色・階段)は現状カウント対象外。

### 変更後

役ボーナスの成立数(`roleFired.length`)+パターンボーナスの成立数(同スート/同色のいずれかで最大1、階段でさらに+1、合計最大2)の合計が2以上で発動する。

- `ChainBonusResult`に、実際に成立したパターンボーナスの種類数(0〜2)を保持する`patternFiredCount: number`を追加する(現状の`patternFired: boolean`は既存の用途(素朴・山札めくりのパターン継続判定等)を壊さないよう残し、新規フィールドとして追加する)
- `evaluateChainBonus`内で、同スート/同色いずれかが成立すれば+1、階段が別途成立すればさらに+1して`patternFiredCount`を算出する

```ts
lapis: {
  channel: 'gained',
  effect: (v, ctx, p) => {
    const total = ctx.chainBonus.roleFired.length + ctx.chainBonus.patternFiredCount
    if (total < 2) return { value: v, part: null }
    const factor = p.talismans.lapis.x
    return { value: v * factor, part: `瑠璃×${fmtMultiplier(factor)}` }
  },
}
```

## 6. スコープ外

- 上記5項目以外の護符効果・スコア計算ロジックの変更
- `docs/shidasu-current-rules.md`・`docs/shidasu-glossary.md`等の既存ドキュメントの更新(別タスクとして扱う)

## 7. 受け入れ基準

1. `playCard`・`drawStock`(naive)双方で、コンボ倍率が護符の`gained`効果適用後に最後に一度だけ乗算される
2. 全消しボーナス・護符の直接加算はコンボ倍率の影響を受けず、プレイの獲得点計算後に別枠で加算される(現状維持を確認)
3. 流星: コンボ数が閾値未満から閾値以上へ到達した瞬間(黄金併用でジャンプした場合を含む)、現在スコア(獲得点加算後)の`p`%が直接加算される。閾値以上の状態が続いている間は再発動しない
4. 序章: プレイでチェーン内1枚目の時のみ発動する。山札めくり(素朴)では発動しない
5. 幕間: プレイでチェーン内ちょうど`m`枚目の時のみ一回発動する。それ以外のプレイ枚数・山札めくりでは発動しない
6. 瑠璃: 役ボーナス成立数+パターンボーナス成立数の合計が2以上で発動する(例: 同スート+階段の組み合わせでも発動)
7. `npm run test`・`npm run build`・`npm run check`が成功する
