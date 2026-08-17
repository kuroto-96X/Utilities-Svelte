# riteEffects.ts applyRiteEffect Record化リファクタ 設計

> 対象: `src/lib/game/shidasu/riteEffects.ts`の`applyRiteEffect`(24ケースのswitch文)を、`sabotageEffects.ts`で既に実施済みの前例(switch→`Record`ディスパッチ)と同じ形へ置き換える。個々の`applyXxx`関数(24個)の実装は一切変更しない。純粋なリファクタであり挙動は一切変更しない。

## 背景・目的

これまでのセッションで8回、`engine.ts`・`shop.ts`・`+page.svelte`・`PlayArea.svelte`にあった機械的重複を共通ヘルパー・ファクトリに切り出すリファクタを実施してきた。さらに遡ると、本セッション以前に`sabotageEffects.ts`で「switch文(22ケース、個別`applyXxx`関数へディスパッチ)を`Record<SabotageActionId, Handler>`へ変換し、コンパイル時の網羅性チェックを獲得する」というリファクタが実施済みである。

今回、既存の他のswitch文を`riteEffects.ts`・`revelationEffects.ts`・`roles.ts`・`cardSets.ts`・`engine.ts`にわたって調査した結果、`riteEffects.ts`の`applyRiteEffect`(24ケース)が`sabotageEffects.ts`のリファクタ前と全く同じ形の重複であることが判明した。各`riteId`を個別の`applyXxx(wave, ...)`関数へディスパッチするswitch文で、個々の関数の引数だけが不揃い(`wave`のみ・`wave, rand`・`wave, n`)である。

他候補(`revelationEffects.ts`の`applyRevelationEffect`)は今回のスコープ外とする。`roles.ts`(10ケースの単純な値マッピング)・`cardSets.ts`(既に個別関数への素直なディスパッチのみで重複なし)・`canUseRite`(24ケース中7ケースのみ条件あり、残りは`default: true`)・`engine.ts`の`grantRevelationReward`(各ケースが本質的に異なるゲームロジック)は、いずれもRecord化してもメリットが薄い、またはむしろ冗長になるため対象外とする。

## 方針(スコープ)

`riteEffects.ts`の`applyRiteEffect`のみを対象とする。個々の`applyXxx`関数(`applyRaidho`・`applyJera`など24個)の実装は一切変更しない。ディスパッチ層(switch文)だけを、統一シグネチャの薄いラッパー関数からなる`Record<RiteId, RiteHandler>`に置き換える。

`canUseRite`(別のswitch、24ケース中7ケースのみ条件あり・残りは`default: true`)は対象外のまま維持する。Record化すると24キー全てに`() => true`を明示する必要があり、現状の`default`の方が簡潔なため。

## 技術設計

`riteEffects.ts`内、`applyRiteEffect`関数の直前に、統一シグネチャの型エイリアスと`Record<RiteId, RiteHandler>`を追加する。各エントリは対応する既存の`applyXxx`関数を、必要な引数だけ抜き出して呼ぶ薄いアロー関数。

```ts
type RiteHandler = (wave: WaveState, params: ShidasuParams, rand: () => number) => WaveState

const RITE_HANDLERS: Record<RiteId, RiteHandler> = {
  raidho: (wave, _params, rand) => applyRaidho(wave, rand),
  jera: (wave, _params, rand) => applyJera(wave, rand),
  wunjo: (wave, _params, rand) => applyWunjo(wave, rand),
  othala: (wave, _params, rand) => applyOthala(wave, rand),
  perthro: (wave) => applyPerthro(wave),
  uruz: (wave, params) => applyUruz(wave, params.rites.uruz.n),
  ingwaz: (wave, params) => applyIngwaz(wave, params.rites.ingwaz.n),
  gebo: (wave, _params, rand) => applyGebo(wave, rand),
  fehu: (wave) => applyFehu(wave),
  dagaz: (wave, _params, rand) => applyDagaz(wave, rand),
  algiz: (wave) => applyAlgiz(wave),
  tiwaz: (wave) => applyTiwaz(wave),
  laguz: (wave, _params, rand) => applyLaguz(wave, rand),
  eihwaz: (wave, params) => applyEihwaz(wave, params.rites.eihwaz.n),
  ansuz: (wave) => applyAnsuz(wave),
  kenaz: (wave, _params, rand) => applyKenaz(wave, rand),
  thurisaz: (wave, params) => applyThurisaz(wave, params.rites.thurisaz.x),
  hagalaz: (wave, _params, rand) => applyHagalaz(wave, rand),
  nauthiz: (wave) => applyNauthiz(wave),
  isa: (wave) => applyIsa(wave),
  sowilo: (wave) => applySowilo(wave),
  berkano: (wave, params) => applyBerkano(wave, params.rites.berkano.x),
  mannaz: (wave) => applyMannaz(wave),
  ehwaz: (wave) => applyEhwaz(wave),
}

export function applyRiteEffect(params: ShidasuParams, wave: WaveState, riteId: RiteId, rand: () => number): WaveState {
  return RITE_HANDLERS[riteId](wave, params, rand)
}
```

`Record<RiteId, RiteHandler>`という型注釈により、`RiteId`(24種)のいずれかのキーが欠けていた場合、TypeScriptがコンパイル時にエラーを出す。これはswitch文には無かった網羅性チェックであり、`sabotageEffects.ts`のリファクタで得られたのと同じ利点をこのファイルにも適用する。

使わない引数(`_params`など)にはアンダースコアプレフィックスを付け、未使用変数であることを明示する。この命名規則は同じ`riteEffects.ts`内の`canUseRite(_params: ShidasuParams, wave: WaveState, riteId: RiteId)`で既に使われている既存の慣例であり、新規に導入するものではない。

## テスト

- 純粋なディスパッチ層の置き換えのため、既存の`riteEffects.test.ts`・`engine.test.ts`(秘儀使用関連のテストを含む)を無修正のまま実行し、全てグリーンであることを確認する。これが本リファクタの正しさの根拠になる。
- 新規追加する`RITE_HANDLERS`自体への直接のユニットテスト追加はスコープ外とする(YAGNI、既存の経由テストで十分な回帰保証がある。これまでのリファクタと同じ方針)。

## スコープ外

- `revelationEffects.ts`の`applyRevelationEffect`(同種の候補だが、今回は`riteEffects.ts`のみに絞る。次回リファクタ候補として記録しておく)
- `canUseRite`のswitch文(Record化するとむしろ冗長になるため見送り)
- `roles.ts`・`cardSets.ts`・`engine.ts`の`grantRevelationReward`のswitch文(重複が無い、または各ケースが本質的に異なるロジックのため対象外)
- ゲームの挙動変更(本リファクタは純粋なリファクタであり一切の挙動変更を行わない)
