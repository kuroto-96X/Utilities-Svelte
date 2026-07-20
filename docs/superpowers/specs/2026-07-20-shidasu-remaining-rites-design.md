# Shidasu 秘儀(Rite) 残り7ルーン 実装 設計

## 0. 背景・目的

`docs/superpowers/specs/2026-07-19-shidasu-rites-design.md`で秘儀(②Rite)のうち17種を実装した際、残り7ルーン(ハガラズ・ナウジズ・イサ・ソウィロ・ベルカナ・エワズ・マンナズ)は`runes.ts`の見た目候補としてのみ存在させ、効果設計を見送った。

`docs/shidasu/shidasu-higi-candidates.md`でこの7種の効果案をブレインストーミングし、以下の設計で実装を確定する(本ドキュメント作成時点で候補ドキュメントの内容を一部更新している。詳細は6節)。

## 1. 各秘儀の効果仕様

| ルーン(グリフ・読み) | 効果テンプレート(desc) | 種別 |
|---|---|---|
| ᚺ ハガラズ | 場札と山札の残りを全て合流させ、シャッフルして配り直す | 即時・盤面操作 |
| ᚾ ナウジズ | そのウェーブが終わるまで、コンボリセット時の再開値を`floor((直前のコンボ数-基礎コンボ数)/2)+基礎コンボ数`にする | 持続・内部干渉 |
| ᛁ イサ | そのウェーブが終わるまで、コンボ数を発動時点の値のまま凍結する(増減しない) | 持続・内部干渉 |
| ᛋ ソウィロ | 発動後に初めて成立した役の種類を記憶し、そのウェーブが終わるまでその役のボーナスを{x}倍にする(記憶した瞬間のプレイ自体も対象) | 持続・内部干渉 |
| ᛒ ベルカナ | 現在のコンボ数を{x}倍にする(端数切り捨て) | 即時・内部干渉 |
| ᛗ マンナズ | そのウェーブが終わるまで、得点計算時に「所持護符のレア度重み(C=1/U=2/R=4)の合計×{x}」を1に加えた係数を掛ける | 持続・内部干渉 |
| ᛖ エワズ | そのウェーブが終わるまで、場札の許容ランク差を2差まで拡張する(ループを跨ぐK→2、Q→Aなども対象)。階段パターン判定には影響しない | 持続・ルール変更 |

各ルーンのグリフは`src/lib/game/shidasu/runes.ts`に既に定義済みの24種から、`RiteId`未割り当てだった7種にそのまま対応する。

## 2. 新規WaveStateフィールド

即時効果(ハガラズ・ベルカナ)は新規stateを必要としない(既存の`raidho`・`uruz`と同じ)。持続効果の5種は、ウェーブ限定の永続フラグとして`WaveState`に以下を追加する(`アルギズ`の`playFromAnywhereActiveThisWave`と同じ設計思想)。

```ts
// ナウジズ用: そのウェーブが終わるまで、コンボリセット時の再開式を変更するか
nauthizActiveThisWave: boolean
// イサ用: そのウェーブが終わるまで、コンボ数の変化を凍結するか
comboFrozenThisWave: boolean
// ソウィロ用: 発動済みか(役未確定の待機状態を含む)
sowiloActiveThisWave: boolean
// ソウィロ用: 倍率対象として確定した役(未確定ならnull)
sowiloBoostedRole: RoleName | null
// マンナズ用: そのウェーブが終わるまで、得点計算に護符レア度倍率を掛けるか
mannazActiveThisWave: boolean
// エワズ用: そのウェーブが終わるまで、場札の許容ランク差を2まで拡張するか
ehwazActiveThisWave: boolean
```

いずれも`startWave`で`false`/`null`に初期化し、対応する秘儀を使用した瞬間に`applyRiteEffect`内でtrueに設定、ウェーブ終了まで持続する(次のウェーブには持ち越さない)。

## 3. 各効果の実装詳細

### 3.1 ハガラズ(即時・盤面操作)

`wave.tableau.flat()`と`wave.stock`を1つの配列に合流させ、`shuffleInPlace`でシャッフルする。各列の**現在の枚数**(プレイによって減っている場合はその減った枚数)を維持したまま、シャッフル後のプールから先頭から順に配り直す。余ったカードは新しい`stock`にする。`foundation`・`chain`・`chainOrigin`・`combo`は変更しない(既存の`raidho`/`jera`/`wunjo`と同様、盤面操作のみで得点状態には触れない)。

```ts
function applyHagalaz(wave: WaveState, rand: () => number): WaveState {
  const pool = [...wave.tableau.flat(), ...wave.stock]
  shuffleInPlace(pool, rand)
  let cursor = 0
  const tableau = wave.tableau.map(col => {
    const take = col.length
    const newCol = pool.slice(cursor, cursor + take)
    cursor += take
    return newCol
  })
  const stock = pool.slice(cursor)
  return { ...wave, tableau, stock }
}
```

### 3.2 ナウジズ(持続・内部干渉)

`applyNauthiz`は`nauthizActiveThisWave: true`をセットするのみ。

`resetComboFields`の通常リセット分岐(`comboResetShieldRemaining`が0の場合の分岐)で、`combo`の再開値を決めるロジックを以下の優先順位に変更する。

1. `comboFrozenThisWave`が`true`(イサ発動中) → `wave.combo`をそのまま維持(2・3より優先)
2. `nauthizActiveThisWave`が`true` → `floor((wave.combo - wave.baseComboCount) / 2) + wave.baseComboCount`
3. どちらも`false` → 既存の挙動(`sanctify`所持なら`baseComboCount`、それ以外は`0`)

ナウジズの式は`baseComboCount`を除いた分だけ半減させるため、祝福(基礎コンボ数を上げる護符)の効果とも自然に合成される。

### 3.3 イサ(持続・内部干渉)

`applyIsa`は`comboFrozenThisWave: true`をセットするのみ。

`comboFrozenThisWave`が`true`の間、以下3箇所の`combo`更新処理をすべて無効化し、`wave.combo`を変化させない。

- `playCard`: `newCombo = wave.combo + (golden ? 2 : 1)`の代入を`wave.combo`のままにする
- `resetComboFields`: 3.2節の優先順位1の通り、リセット式自体を適用しない
- `drawStock`の素朴(naive)分岐: `naiveCombo = wave.combo + (golden ? 2 : 1)`の代入を`wave.combo`のままにする

`maxComboThisWave`・`chain`・役ボーナス判定など、コンボ数以外の状態は通常通り更新される(凍結はコンボ数のみに作用する)。

### 3.4 ソウィロ(持続・内部干渉)

`applySowilo`は`sowiloActiveThisWave: true`をセットするのみ(`sowiloBoostedRole`は`null`のまま)。

`playCard`内の`roleBonusMultiplier(name)`(既存の明星用コールバック)を拡張し、明星の倍率と乗算で合成する。

```ts
const sowiloFactor = (name: RoleName): number => {
  if (!wave.sowiloActiveThisWave) return 1
  if (wave.sowiloBoostedRole === name) return params.rites.sowilo.x
  if (wave.sowiloBoostedRole === null && sowiloCommittedThisPlay === null) {
    sowiloCommittedThisPlay = name
    return params.rites.sowilo.x
  }
  return 1
}
const roleBonusMultiplier = (name: RoleName): number => morningStarFactor(name) * sowiloFactor(name)
```

`sowiloCommittedThisPlay`は`playCard`関数内のローカル変数(`let sowiloCommittedThisPlay: RoleName | null = null`)とし、`evaluateChainBonus`呼び出し完了後、`wave.sowiloBoostedRole`が`null`のままなら`sowiloCommittedThisPlay`の値(またはnull)で更新する。一度確定した後は、そのウェーブが終わるまで同じ役だけが`x`倍の対象になる。

`columnSweep`も同じ`roleBonusMultiplier`コールバック経由で処理されるため、追加の実装は不要。

`drawStock`の素朴(naive)分岐は、既存の明星も同様に`roleBonusMultiplier`を渡していない(`evaluateChainBonus`呼び出しで省略しデフォルトの`() => 1`になる)ため、ソウィロもこの分岐には適用しない(明星と同じ既存の制約に揃える)。

### 3.5 ベルカナ(即時・内部干渉)

```ts
function applyBerkano(wave: WaveState, x: number): WaveState {
  const combo = Math.floor(wave.combo * x)
  return { ...wave, combo, maxComboThisWave: Math.max(wave.maxComboThisWave, combo) }
}
```

### 3.6 マンナズ(持続・内部干渉)

`applyMannaz`は`mannazActiveThisWave: true`をセットするのみ。

レア度重みは`Record<Rarity, number> = { C: 1, U: 2, R: 4 }`として定義し、以下のヘルパーで所持護符の重み合計を求める。

```ts
function mannazWeightSum(items: ItemId[], params: ShidasuParams): number {
  const weight: Record<Rarity, number> = { C: 1, U: 2, R: 4 }
  return items.reduce((sum, id) => sum + weight[params.talismans[id].rarity], 0)
}
```

`playCard`・`drawStock`の素朴(naive)分岐それぞれで、既存のコンボ倍率(`multiplier`)を適用する箇所に、`mannazActiveThisWave`が`true`なら追加の係数を同時に掛ける(floor誤差を避けるため1回の`Math.floor`にまとめる)。

```ts
const mannazFactor = wave.mannazActiveThisWave
  ? 1 + mannazWeightSum(items, params) * params.rites.mannaz.x
  : 1
const gained = Math.floor(itemResult.value * multiplier * mannazFactor)
```

### 3.7 エワズ(持続・ルール変更)

`applyEhwaz`は`ehwazActiveThisWave: true`をセットするのみ。

`isPlayable`の判定に、`ehwazActiveThisWave`が`true`の場合の追加分岐を挿す。

```ts
export function isPlayable(modifier: StageModifier, wave: WaveState, card: Card): boolean {
  if (wave.playFromAnywhereActiveThisWave) return true
  if (modifier === 'faceLock' && isFace(card) && wave.combo < 2) return false
  if (card.wild || wave.foundation.wild) return true
  const d = Math.abs(card.rank - wave.foundation.rank)
  if (d === 1) return true
  if (d === 12 && modifier !== 'noLoop') return true
  if (wave.ehwazActiveThisWave) {
    if (d === 2) return true
    if (d === 11 && modifier !== 'noLoop') return true
  }
  return false
}
```

`analyzeStair`・`chainContinuesPattern`・`evaluateChainBonus`には一切手を入れない。ランク差2でのプレイは、階段パターンの継続条件(`stepRank`によるランク差1の判定)を満たさないため、既存の「階段が崩れる動き」と同じ扱いになる。循環・輪廐・威光などK⇔Aループに依存する護符や`noLoop`ステージ修飾子への影響はない(エワズのループ越え判定にも同じ`modifier !== 'noLoop'`条件を適用しているため)。

## 4. `canUseRite`

7種すべて、使用条件による制限は設けない(常時使用可)。既存の`canUseRite`のswitch文には追加しない(`default: return true`にフォールスルーする)。

## 5. 変更ファイル一覧

- `src/lib/game/shidasu/types.ts`: `RiteId`に`hagalaz` `nauthiz` `isa` `sowilo` `berkano` `mannaz` `ehwaz`を追加。`WaveState`に2節の6フィールドを追加
- `src/lib/game/shidasu/params.ts`: `ShidasuParams['rites']`に7エントリの型定義を追加(`nauthiz`/`isa`/`ehwaz`/`hagalaz`はパラメータ無し、`sowilo`/`berkano`/`mannaz`は`x: number`)。`DEFAULT_PARAMS.rites`にも同様に7エントリ追加(`name`は対応するルーングリフ、`desc`は1節のテンプレート文言)
- `src/lib/game/shidasu/shidasu.config.json`: `DEFAULT_PARAMS`と同じ7エントリを追加(既存の17種と同じ形式)
- `src/lib/game/shidasu/rites.ts`: `RITE_POOL`に7種を追加(既存17種と合わせて24種で均等抽選になる)
- `src/lib/game/shidasu/riteEffects.ts`: `applyHagalaz` `applyNauthiz` `applyIsa` `applySowilo` `applyBerkano` `applyMannaz` `applyEhwaz`を追加し、`applyRiteEffect`のswitchに追加
- `src/lib/game/shidasu/riteActualEffects.ts`: `RITE_ACTUAL_EFFECTS`に7種の監査用説明文を追加
- `src/lib/game/shidasu/engine.ts`:
  - `startWave`の初期化オブジェクトに2節の6フィールド(初期値`false`/`null`)を追加
  - `isPlayable`にエワズ分岐を追加(3.7節)
  - `resetComboFields`にイサ・ナウジズの優先分岐を追加(3.2・3.3節)
  - `playCard`に`sowiloCommittedThisPlay`ローカル変数・`roleBonusMultiplier`合成・マンナズ係数を追加(3.4・3.6節)。プレイ後の`next`オブジェクトに`sowiloBoostedRole`の更新を追加
  - `drawStock`の素朴(naive)分岐に、`playCard`と同様のイサ凍結・マンナズ係数を追加
  - `mannazWeightSum`ヘルパーを追加(3.6節)
- `src/routes/admin/shidasu-rites/+page.svelte`: 変更不要(既存の`RITE_POOL`ループ・`RITE_ACTUAL_EFFECTS`表示が自動的に7種を含む)
- `docs/shidasu/shidasu-higi-candidates.md`: 本設計での変更点(エワズは階段判定に影響しない、ベルカナはコンボ倍算に変更、マンナズは得点倍算に変更)を反映して更新

## 6. `shidasu-higi-candidates.md`からの変更点

ブレインストーミング時点の候補から、実装設計を詰める過程で以下の3点を変更した。

1. **エワズ**: 「階段パターンの継続条件も1差・2差混在でよいように緩和する」を撤回。階段パターン判定(`analyzeStair`)には一切手を入れず、ランク差2のプレイは階段を継続させない(プレイ可否判定のみの変更にとどめ、`analyzeStair`/`stepRank`という他護符・ステージ修飾子からも参照される中核ロジックへの影響を避ける)
2. **ベルカナ**: 「発動時点のコンボ数×xを直接点として加算」から「現在のコンボ数自体を×x倍にする」に変更。秘儀として初めて得点を直接動かす仕組みを新設する必要がなくなり、既存のuruz(コンボ+n)と同じ設計に揃えられる
3. **マンナズ**: 「役成立ごとに加算」から「得点計算時に係数として倍算する」に変更。既存の護符(琥珀・蒼穹)と同じ`1 + 値×x`の乗算パターンに揃えられる

## 7. スコープ外

- ③天啓・④神託の実装
- 護符の並び替えUI(`docs/shidasu-roadmap.md`項目6、既存の未着手課題)
- ゲーム内通貨・ショップ経由での秘儀購入(`docs/shidasu-roadmap.md`項目5で別途検討)

## 8. 受け入れ基準

1. `RiteId`型が24種(既存17種+今回の7種)になり、`RITE_POOL`・`ShidasuParams.rites`・`RITE_ACTUAL_EFFECTS`がすべて24種分揃っている
2. ハガラズ使用で、場札+山札が合流・シャッフルされ、各列の現在の枚数を維持したまま配り直される。`foundation`・`chain`・`combo`は変化しない
3. ナウジズ使用後、そのウェーブ中のコンボリセットが`floor((直前のコンボ数-基礎コンボ数)/2)+基礎コンボ数`から再開する(祝福との併用時も正しく合成される)
4. イサ使用後、そのウェーブが終わるまでコンボ数が発動時点のまま変化しない(プレイ・リセットのいずれでも増減しない)
5. ソウィロ使用後、初めて成立した役(その場のプレイ含む)からそのウェーブが終わるまで、その役の種類だけボーナスが`x`倍になる(他の役は通常通り)
6. ベルカナ使用で、現在のコンボ数が即座に`x`倍(切り捨て)になる
7. マンナズ使用後、そのウェーブが終わるまで得点計算に「所持護符のレア度重み合計×xを1に加えた係数」が掛かる
8. エワズ使用後、そのウェーブが終わるまで場札からランク差2(ループ越え含む)のカードもプレイできるようになるが、階段パターンの成立条件には影響しない
9. 秘儀由来の持続効果は次のウェーブに一切持ち越されない(`startWave`で全てリセットされる)
10. `npm run test`・`npm run check`・`npm run build`が成功する
