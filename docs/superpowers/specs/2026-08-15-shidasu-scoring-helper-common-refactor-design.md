# playCard/drawStock安全断片共通化リファクタ 設計

> 対象: `src/lib/game/shidasu/engine.ts`の`playCard`・`drawStock`にある、完全に一致する3つの小さな計算断片(橋の護符による長さ補正・神託レベル解決クロージャ・庇護/大地によるコンボ下駄履かせ)を共通ヘルパーへ切り出す。純粋なリファクタであり、スコア計算式・ゲームの挙動は一切変更しない。

## 背景・目的

これまでのセッションで5回、`engine.ts`・`shop.ts`・`+page.svelte`・`PlayArea.svelte`にあった機械的重複を共通ヘルパー・ファクトリに切り出すリファクタを実施した。前回のセッションで、`drawStock`のnaiveパス(パターン継続時のドロー処理、約75行)が`playCard`のスコア計算パイプラインを部分的に再実装しているように見える点を「慎重な検討が必要」として見送っていた。

今回、`playCard`(356行)・`drawStock`(naiveパス含む)を実際に精読した結果、次のことが分かった。

**naiveパス全体は共通化候補ではない**: naiveパスは`playCard`のスコア計算を単純に再実装しているのではなく、意図的に縮小した別の計算式になっている。`playCard`は明星・ソウィロの役倍率、列一掃ボーナス、鋼鉄の遅延複製予約、果断・流星の加算、全消しボーナス、献身・勤勉・加護・星霜・残響・慢心・スリサズの7乗数を全て適用するのに対し、naiveパスはコンボ倍率とマンナズの2乗数のみを適用し、それ以外(果断・流星・全消し・献身・勤勉・加護・星霜・残響・慢心・スリサズ・列一掃・明星・ソウィロ・鋼鉄)は意図的に適用しない。護符「素朴(naive)」自体が「パターン継続時のドロー処理をあえて簡易な得点計算に留める」という設計上の役割を持っていると読める。これを1つの共通関数に統合しようとすると8個以上のオン/オフフラグを引数で渡すことになり、可読性がかえって悪化する。したがって**naiveパス全体の共通化は不採用**とする。

一方で、両者に**完全に一致する**小さな計算断片が3箇所見つかった。これらは安全に共通化できる。

## 方針(スコープ)

`playCard`・`drawStock`(naiveパス)にある、以下3つの完全一致断片のみを共通ヘルパーへ切り出す。スコア計算式そのもの(どの乗数がどの順序で適用されるか)は一切変更しない。

## 技術設計

### A. `resolveBridgeAdjustedLengths`(橋の護符による長さ補正)

`playCard`(2行)・`drawStock`(2行)双方で完全に同一:

```ts
const effectiveStairMinLen = items.includes('bridge') ? params.scoring.stairMinLen - params.talismans.bridge.m : params.scoring.stairMinLen
const effectiveSuitColorMinLen = items.includes('bridge') ? params.scoring.suitColorMinLen - params.talismans.bridge.m : params.scoring.suitColorMinLen
```

以下のヘルパーへ切り出す:

```ts
function resolveBridgeAdjustedLengths(params: ShidasuParams, items: ItemId[]): { effectiveStairMinLen: number; effectiveSuitColorMinLen: number } {
  const effectiveStairMinLen = items.includes('bridge') ? params.scoring.stairMinLen - params.talismans.bridge.m : params.scoring.stairMinLen
  const effectiveSuitColorMinLen = items.includes('bridge') ? params.scoring.suitColorMinLen - params.talismans.bridge.m : params.scoring.suitColorMinLen
  return { effectiveStairMinLen, effectiveSuitColorMinLen }
}
```

呼び出し側: `const { effectiveStairMinLen, effectiveSuitColorMinLen } = resolveBridgeAdjustedLengths(params, items)`

### B. `makeOracleLevelResolver`(神託レベル解決クロージャ)

`playCard`・`drawStock`のnaiveパス内、`oracleLevel`クロージャ(6行)が完全に同一:

```ts
const oracleLevel = (name: RoleName): number => {
  if (sealedRoleEffect.zeroRoles.includes(name)) return 0
  if (sealedRoleEffect.oracleBaselineRole === name) return 1
  const base = wave.oracleLevels[name] ?? 1
  const mult = sealedRoleEffect.multipliers?.[name]
  return mult !== undefined ? base * mult : base
}
```

クロージャを生成するファクトリ関数として切り出す:

```ts
function makeOracleLevelResolver(wave: WaveState, sealedRoleEffect: SealedRoleEffect): (name: RoleName) => number {
  return (name: RoleName): number => {
    if (sealedRoleEffect.zeroRoles.includes(name)) return 0
    if (sealedRoleEffect.oracleBaselineRole === name) return 1
    const base = wave.oracleLevels[name] ?? 1
    const mult = sealedRoleEffect.multipliers?.[name]
    return mult !== undefined ? base * mult : base
  }
}
```

呼び出し側: `const oracleLevel = makeOracleLevelResolver(wave, sealedRoleEffect)`

### C. `applyProtectionEarthFloor`(庇護・大地によるコンボ下駄履かせ)

`playCard`・`drawStock`のnaiveパス内、`items`を順にループして庇護(protection、下限を底上げ)・大地(earth、加算)を適用するループの本体(5行)は完全に同一だが、ループに入る前の**開始値**が呼び出し元で異なる(`playCard`は`newCombo + newBaseComboCount`、`drawStock`のnaiveパスは`newCombo + sincerityAdd + wave.baseComboCount`)。開始値を引数として受け取り、適用後の値を返す関数にする:

```ts
// 庇護: effectiveComboがprotection.c未満なら底上げする。大地: effectiveComboにearth.cを加算する。
// 所持順(items配列の並び順)で順に適用する。
function applyProtectionEarthFloor(items: ItemId[], params: ShidasuParams, startingCombo: number): number {
  let effectiveCombo = startingCombo
  for (const id of items) {
    if (id === 'protection' && effectiveCombo < params.talismans.protection.c) {
      effectiveCombo = params.talismans.protection.c
    } else if (id === 'earth') {
      effectiveCombo += params.talismans.earth.c
    }
  }
  return effectiveCombo
}
```

呼び出し側:
- `playCard`: `const effectiveCombo = applyProtectionEarthFloor(items, params, newCombo + newBaseComboCount)`
- `drawStock`(naiveパス): `const effectiveCombo = applyProtectionEarthFloor(items, params, newCombo + sincerityAdd + wave.baseComboCount)`

## テスト

- 純粋なリファクタのため、既存の`engine.test.ts`内の`playCard`・`drawStock`関連テスト(護符「橋」「庇護」「大地」・神託・役封印・役偏重を含む)を無修正のまま実行し、全てグリーンであることを確認する。これが本リファクタの正しさの根拠になる。特にスコア計算に関わる変更のため、この既存テストが実際にこれらのロジックをカバーしていることを`engine.test.ts`から確認したうえで実施する。
- 新規ヘルパー(`resolveBridgeAdjustedLengths`・`makeOracleLevelResolver`・`applyProtectionEarthFloor`)自体への直接のユニットテスト追加はスコープ外とする(YAGNI、既存の経由テストで十分な回帰保証がある。これまでのリファクタと同じ方針)。

## スコープ外

- `drawStock`のnaiveパス全体の共通化。上記の通り、`playCard`とは意図的に異なる縮小版のスコア計算式であり、無理に共通化すると可読性が悪化するため不採用
- `+page.svelte`の天啓プレビュー用「run.waveを一時差し替えて効果適用→戻す」パターン(3ハンドラで重複)の共通化。今回のスコープ外
- スコア計算式そのものの変更(本リファクタは純粋なリファクタであり、どの乗数がどの順序で適用されるかを含め、ゲームの挙動は一切変更しない)
