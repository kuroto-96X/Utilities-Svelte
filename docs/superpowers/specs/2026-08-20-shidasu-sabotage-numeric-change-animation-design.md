# 妨害行動アニメーション実装(グループE: 数値変化系) 設計

> 対象: 妨害行動32個のうち未実装だった27個を5グループに分類した(詳細は`docs/shidasu/shidasu-star-sabotage-candidates.md`「演出(アニメーション)の実装状況」を参照)うち、グループE「数値変化系」8個(`comboBreather`・`comboReduce`・`currencyConfiscate`・`rewardReduce`・`currencyDrain`・`roleLevelDecay`・`tsukumokaRelease`・`roleBias`)のうち`rewardReduce`を除く7個に発動演出を実装する。

## 背景・目的

数値・状態表示(コンボ数・所持星片・役レベル・レリックの付喪化状態)が変化する瞬間、表示が赤く縁取られて揺れると同時に、変化内容を示すテキスト(マイナス数字・倍率・状態名)が右上にポップして浮かび上がりながら消える演出を追加する(ビジュアルコンパニオンでのモックアップ比較により決定済み、2026-08-20)。

グループA(封印系)・B(没収系)・C(強制発動系)と異なり、対象UI要素は「消える」わけでも「使用不可になる」わけでもなく、単純に数値・状態が変わるだけ。そのため`withFadingId`のような一時保持の仕組みは不要。一方で、ポップアップに表示する内容(変化量)は妨害行動ごとに異なり、上限クランプ(0未満にしない等)により実際の変化量が固定値と一致しないケースがあるため、グループA/Bで確立した「明示的シグナルで伝える」原則に従い、`SabotageResult`に実際の変化内容を含める。

## スコープ外: rewardReduce

`rewardReduce`(報酬減少、`RunState.rewardPenalty`に累積)は、プレイ中の画面に対応する常設表示が存在しない(Wave終了時の内部計算でのみ使われる値)。今回のグループEの対象からは除外する。

## 対象UI要素の整理

| 妨害行動 | 対象UI要素 | 所在 | ポップアップ内容 |
|---|---|---|---|
| `comboBreather`(強制小休止) | コンボ表示 | `PlayArea.svelte`内 | マイナス数字(実際の減少量) |
| `comboReduce`(コンボ削減) | コンボ表示 | `PlayArea.svelte`内 | マイナス数字(実際の減少量) |
| `currencyConfiscate`(通貨没収) | 通貨表示(`stageRow`スニペット) | `+page.svelte`側 | マイナス数字(実際の減少量) |
| `currencyDrain`(通貨強制消費) | 通貨表示(`stageRow`スニペット) | `+page.svelte`側 | マイナス数字(実際の減少量) |
| `roleLevelDecay`(役減衰) | `RoleStatusPanel`(対象2役) | `+page.svelte`側 | マイナス数字(各役-1固定) |
| `roleBias`(役偏重) | `RoleStatusPanel`(対象5役×2グループ) | `+page.svelte`側 | 倍率テキスト(強化側「×2」・減衰側「×0.5」) |
| `tsukumokaRelease`(付喪化解除) | レリックバッジ(対象1つ) | `+page.svelte`側 | 固定テキスト「付喪化解除」 |

通貨表示(`stageRow`)・`RoleStatusPanel`・レリックバッジはいずれも`PlayArea`の外(`+page.svelte`側)にあるため、グループA/Bで確立したコールバックprops経由の連携が必要になる。コンボ表示のみ`PlayArea.svelte`内で完結する。

## 技術設計

### A. 対象特定・変化量の仕組み(`SabotageResult.numericChangeTarget`)

`sabotageEffects.ts`の`SabotageResult`インターフェースに、数値変化の内容を明示的に伝える`numericChangeTarget`フィールドを追加する:

```ts
export interface SabotageResult {
  // ...(既存フィールド省略)
  // 今回「数値変化系」(comboBreather/comboReduce/currencyConfiscate/currencyDrain/
  // roleLevelDecay/roleBias/tsukumokaRelease)で変化した対象と内容を明示的に伝える。
  // 上限クランプ(0未満にしないなど)により実際の変化量が固定値と一致しないケースが
  // あるため、各効果関数が実際の変化量を計算して返す。
  numericChangeTarget?:
    | { kind: 'combo'; amount: number }
    | { kind: 'currency'; amount: number }
    | { kind: 'roleLevel'; names: RoleName[]; amount: number }
    | { kind: 'roleBias'; buffed: RoleName[]; nerfed: RoleName[] }
    | { kind: 'tsukumoka'; relicId: RelicId }
}
```

各効果関数を、実際の変化量を計算して`numericChangeTarget`に含める形に修正する:

```ts
function applyComboBreather({ wave }: SabotageContext): SabotageResult {
  return { wave: { combo: 0 }, numericChangeTarget: { kind: 'combo', amount: wave.combo } }
}

function applyComboReduce({ wave }: SabotageContext): SabotageResult {
  const next = Math.max(0, wave.combo - 3)
  return { wave: { combo: next }, numericChangeTarget: { kind: 'combo', amount: wave.combo - next } }
}

function applyCurrencyConfiscate({ run }: SabotageContext): SabotageResult {
  const next = Math.max(0, run.currency - 5)
  return { run: { currency: next }, numericChangeTarget: { kind: 'currency', amount: run.currency - next } }
}

function applyCurrencyDrain({ run }: SabotageContext): SabotageResult {
  const loss = Math.floor(run.currency * 0.2)
  const next = Math.max(0, run.currency - loss)
  return { run: { currency: next }, numericChangeTarget: { kind: 'currency', amount: run.currency - next } }
}

function applyRoleLevelDecay({ run, rand }: SabotageContext): SabotageResult {
  const names = rollOffer(ORACLE_POOL, 2, rand)
  const oracleLevels = { ...run.oracleLevels }
  for (const name of names) oracleLevels[name] = Math.max(1, oracleLevels[name] - 1)
  return { run: { oracleLevels }, wave: { oracleLevels }, numericChangeTarget: { kind: 'roleLevel', names, amount: 1 } }
}

function applyRoleBias({ rand }: SabotageContext): SabotageResult {
  const shuffled = [...ORACLE_POOL]
  shuffleInPlace(shuffled, rand)
  const half = Math.floor(shuffled.length / 2)
  const buffed = shuffled.slice(0, half)
  const nerfed = shuffled.slice(half)
  return {
    wave: { activeSeal: { kind: 'roleBias', buffed, nerfed, multiplier: 2 } },
    numericChangeTarget: { kind: 'roleBias', buffed, nerfed },
  }
}

function applyTsukumokaRelease({ run, rand }: SabotageContext): SabotageResult {
  const tsukumokaRelics = run.relics.filter(r => r.tsukumoka)
  if (tsukumokaRelics.length === 0) return {}
  const target = tsukumokaRelics[Math.floor(rand() * tsukumokaRelics.length)]
  const relics = run.relics.map(r => (r.id === target.id ? { ...r, tsukumoka: false } : r))
  return { run: { relics }, numericChangeTarget: { kind: 'tsukumoka', relicId: target.id } }
}
```

`roleLevelDecay`はテストで既に`各役-1固定`であることが確認されているため、`amount: 1`は固定値として問題ない(上限クランプ`Math.max(1, ...)`はあるが、既に`Lv.1`の役が対象に選ばれても表示上「-1」のポップ自体は変わらない、という割り切り)。

`triggerSabotage`(`engine.ts`)は、`lastSabotage`に`numericChangeTarget`もそのまま含める(既存の`confiscatedTarget`等と同じ扱い)。`WaveState.lastSabotage`の型定義にも追加する。

### B. 共通state「numericPopup」

`PlayArea.svelte`に、ポップアップ表示用の共通stateを持たせる:

```ts
export type NumericChangeTarget = Exclude<WaveState['lastSabotage'], undefined>['numericChangeTarget']

let numericPopupTarget = $state<NumericChangeTarget | null>(null)
let numericPopupActive = $state(false)

function startNumericPopupAnimation(target: NonNullable<NumericChangeTarget>) {
  numericPopupActive = true
  numericPopupTarget = target
  onNumericPopupChange?.(target)
  const timer = setTimeout(() => {
    numericPopupActive = false
    numericPopupTarget = null
    onNumericPopupChange?.(null)
  }, 500)
  dealTimers.push(timer)
}
```

`numericPopupActive`は関数先頭で同期的に`true`にする(既存の`sealFlashActive`等と同じ原則)。グループCの`pressPulseActive`と同様、効果自体は`triggerSabotage`実行時点で既に確定済みのため、`anyAnimationActive`には含めない(演出中も他の操作をブロックしない)。

**検知**: 既存の`lastSabotage`検知`$effect.pre`に分岐を追加する:

```ts
} else if (current.id === 'comboBreather' || current.id === 'comboReduce' || current.id === 'currencyConfiscate' || current.id === 'currencyDrain' || current.id === 'roleLevelDecay' || current.id === 'roleBias' || current.id === 'tsukumokaRelease') {
  if (current.numericChangeTarget) {
    startNumericPopupAnimation(current.numericChangeTarget)
  }
}
```

`PlayArea`外(通貨表示・`RoleStatusPanel`・レリックバッジ)への連携は、新規コールバックprops`onNumericPopupChange`(既存の`onSealFlashChange`等と同じパターン)経由で行う。

### C. CSS(シェイク+ポップアップ)

`sabotageAnimations.css`に新規keyframesを追加する:

```css
@keyframes shidasu-numeric-shake {
  0%, 100% { transform: translateX(0); }
  20% { transform: translateX(-5px); }
  40% { transform: translateX(5px); }
  60% { transform: translateX(-3px); }
  80% { transform: translateX(3px); }
}

.shidasu-numeric-shake {
  animation: shidasu-numeric-shake 0.4s ease-out;
}

@keyframes shidasu-numeric-popup {
  0% { transform: translateY(0) scale(0.8); opacity: 0; }
  20% { transform: translateY(-8px) scale(1.1); opacity: 1; }
  100% { transform: translateY(-36px) scale(1); opacity: 0; }
}

.shidasu-numeric-popup {
  position: absolute;
  top: -4px;
  right: -8px;
  color: #f87171;
  font-weight: 900;
  font-size: 18px;
  pointer-events: none;
  animation: shidasu-numeric-popup 0.5s ease-out forwards;
}
```

シェイクは対象要素自体に`shidasu-numeric-shake`クラスを付与する(既存の`shidasu-seal-flash`等と同じ運用)。ポップアップは対象要素に`position: relative`を持たせた上で、子要素として`<span class="shidasu-numeric-popup">`を条件付きレンダリングし、テキスト内容(`-3`・`×0.5`・`付喪化解除`)を`numericPopupTarget`から算出して表示する。

### D. ポップアップテキストの算出

`numericChangeTarget`の`kind`に応じて、表示テキストを算出する関数を用意する(`PlayArea.svelte`内、`export`して他ファイルからも使えるようにする):

```ts
export function numericChangePopupText(target: NonNullable<NumericChangeTarget>, roleName?: RoleName): string {
  if (target.kind === 'combo' || target.kind === 'currency') return `−${target.amount}`
  if (target.kind === 'roleLevel') return `−${target.amount}`
  if (target.kind === 'roleBias') {
    if (roleName && target.buffed.includes(roleName)) return '×2'
    if (roleName && target.nerfed.includes(roleName)) return '×0.5'
    return ''
  }
  return '付喪化解除'
}
```

`roleBias`は対象役ごとに強化/減衰いずれかでテキストが変わるため、呼び出し側(`RoleStatusPanel`)で対象の`roleName`を渡して判定する。

### E. 対象要素ごとの適用

- **コンボ表示**(`PlayArea.svelte`): 既存の`comboCapFlashing`と同様に`numericPopupTarget?.kind === 'combo'`を判定し、`shidasu-numeric-shake`クラスと`numericChangePopupText`によるポップアップ`<span>`を追加する。
- **通貨表示**(`+page.svelte`の`stageRow`スニペット): `pressPulseTarget`等と同様、`onNumericPopupChange`で受け取った`numericPopupTarget`を`+page.svelte`側の`$state`に保持し、`numericPopupTarget?.kind === 'currency'`を判定して適用する。
- **`RoleStatusPanel`**: 既存の`flashingRoles`とは別に、新規props`shakingRoles?: { name: RoleName; text: string }[]`(役ごとに表示テキストが異なるため配列で渡す)を追加する。`+page.svelte`側で`numericPopupTarget`から`shakingRoles`を`$derived`で算出する。
- **レリックバッジ**(`+page.svelte`の`itemBadges`スニペット): `numericPopupTarget?.kind === 'tsukumoka' && numericPopupTarget.relicId === relic.id`を判定し、`shidasu-numeric-shake`クラスと固定テキスト「付喪化解除」のポップアップを追加する。

## テスト

- **`numericChangeTarget`の設定**: `triggerSabotage`が数値変化系7種発動時に`lastSabotage.numericChangeTarget`へ正しい`kind`・変化量(またはbuffed/nerfed・relicId)を設定することをエンジンレベルのテストで確認する。上限クランプが効くケース(コンボ・通貨が減少量より少ない状態で発動)では、実際の変化量が正しく計算されることも確認する。`tsukumokaRelease`は対象が0件の場合`numericChangeTarget`が`undefined`のままであることも確認する。
- **アニメーション**: `/admin/shidasu-debug`のデバッグ発動ボタンで目視確認する。デバッグ画面の現状の対応状況を事前に確認した結果:
  - コンボ表示: `PlayArea`の`showScoreAndCombo`はデフォルト`true`のため、デバッグ画面にも表示されている。`comboBreather`・`comboReduce`は目視確認できる
  - `RoleStatusPanel`: デバッグ画面に既に表示されている(グループA実装時に追加済み)。`roleLevelDecay`・`roleBias`は目視確認できる
  - 通貨表示(`stageRow`スニペット相当のもの): デバッグ画面には存在しない。`currencyConfiscate`・`currencyDrain`はデバッグ画面では目視確認できない
  - レリック所持機能: デバッグ画面には存在しない(グループB実装時のレビューで既知の制約として指摘済み)。`tsukumokaRelease`はデバッグ画面では目視確認できない
  - 目視確認できない`currencyConfiscate`・`currencyDrain`・`tsukumokaRelease`については、エンジンレベルの`numericChangeTarget`テストで正確性を担保し、必要であれば実プレイ画面(`/game/shidasu`)またはデバッグ画面へのレリック所持機能追加を実装時に判断する(グループCでも同様の理由でデバッグ画面拡張を行った実績がある)
  - `comboBreather`・`comboReduce`: コンボを重ねた状態で発動し、コンボ表示がシェイクしてマイナス数字がポップすることを確認する
  - `roleLevelDecay`: 役レベルを上げた状態で発動し、対象2役がシェイクして「-1」がポップすることを確認する
  - `roleBias`: 発動し、強化側5役に「×2」、減衰側5役に「×0.5」がポップすることを確認する
  - 各演出中も他の操作(カードプレイ・山札引き等)がブロックされないことを確認する(グループCと同じ挙動)
- `npm run build`・`npm run check`が通ることを確認する。

## スコープ外

- `rewardReduce`(常設表示が存在しないため対象外)
- グループD(カード移動系)の演出実装
