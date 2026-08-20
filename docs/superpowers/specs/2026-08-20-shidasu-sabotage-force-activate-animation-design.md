# 妨害行動アニメーション実装(グループC: 強制発動系+通常発動共通化) 設計

> 対象: 妨害行動32個のうち未実装だった27個を5グループに分類した(詳細は`docs/shidasu/shidasu-star-sabotage-candidates.md`「演出(アニメーション)の実装状況」を参照)うち、グループC「強制発動系」2個(`riteForceActivate`・`revelationOracleForceActivate`)に発動演出を実装する。この演出は、プレイヤー自身が秘儀・天啓・神託を通常クリックで発動する場合にも共通適用する。

## 背景・目的

強制発動系は、対象1つ(秘儀・天啓・神託のいずれか)をプレイヤーの操作を介さず即座に使用させる妨害行動。対象ボタンが自動でクリックされたように、一瞬縮んでから戻り強く光る「自動プレス+パルス」演出を追加する(ビジュアルコンパニオンでのモックアップ比較により決定済み、2026-08-20)。

この演出は「強制発動時だけの特別な見た目」にするのではなく、プレイヤー自身が秘儀・天啓・神託を通常クリックで発動する場合にも共通適用する(既存の`active:scale-95`だけの見た目を、パルス付きに統一する)。実装上は「強制発動時となるべく同じ見た目」にするため、通常クリック時も強制発動時と同じJS駆動の一時state経由でパルスクラスを付与する方式に統一し、既存の`active:scale-95`(CSSの`:active`疑似クラス、押しっぱなし中のみ働く縮小)とは別レイヤーとして共存させる。

## 対象UI要素の整理

| 発動種別 | 対象UI要素 |
|---|---|
| `riteForceActivate`(秘儀強制発動)・秘儀の通常クリック | `PlayArea.svelte`内の秘儀ボタン |
| `revelationOracleForceActivate`(天啓・神託強制発動、天啓が対象)・天啓の通常クリック | `PlayArea.svelte`内の天啓ボタン |
| `revelationOracleForceActivate`(天啓・神託強制発動、神託が対象)・神託の通常クリック | `itemBadges`スニペット(`+page.svelte`)内の神託バッジの「使」ボタン |

秘儀・天啓ボタンは`PlayArea.svelte`内で完結するが、神託「使」ボタンは`+page.svelte`側にあるため、グループA・Bと同じくコールバックprops経由での連携が必要になる。

## 技術設計

### A. 対象特定の仕組み(強制発動時)

`sabotageEffects.ts`の`SabotageResult`インターフェースに、強制発動した対象を明示的に伝える`forceActivatedTarget`フィールドを追加する:

```ts
export interface SabotageResult {
  wave?: Partial<WaveState>
  run?: Partial<RunState>
  affectedTableauCols?: number[]
  purgedToDiscardCount?: number
  confiscatedTarget?: /* 既存(グループB) */
  // 今回「強制発動系」(riteForceActivate/revelationOracleForceActivate)で即座に使用された対象。
  // 通常のプレイヤークリックと同じ処理(useRite/useRevelation/useOracle)を経由するため、活性化した
  // 対象自体を保持する仕組みが無い。ここで明示的に伝える。
  forceActivatedTarget?:
    | { kind: 'rite'; id: RiteId }
    | { kind: 'revelationOrOracle'; ref: HeldRevelationOrOracleRef }
}
```

`applyRiteForceActivate`・`applyRevelationOracleForceActivate`は、既にローカル変数として選択済みの対象(`target`/`ref`)を`forceActivatedTarget`として返すだけで済む(既存ロジックへの変更は最小):

```ts
function applyRiteForceActivate({ params, run, wave, rand, useRite }: SabotageContext): SabotageResult {
  const usable = run.rites.filter(riteId => canUseRite(params, wave, riteId))
  if (usable.length === 0) return {}
  const target = usable[Math.floor(rand() * usable.length)]
  const used = useRite(params, run, target, rand)
  return { wave: { ...used.wave!, activeSeal: null }, run: used, forceActivatedTarget: { kind: 'rite', id: target } }
}
```

```ts
function applyRevelationOracleForceActivate({ params, run, wave, rand, useRevelation, useOracle }: SabotageContext): SabotageResult {
  const usableRevelations = run.revelations.filter(id => canUseRevelation(params, wave, id, run.relics))
  const usableOracles = wave.status === 'playing' ? run.oracles : []
  const pool: HeldRevelationOrOracleRef[] = [
    ...usableRevelations.map(id => ({ kind: 'revelation' as const, id })),
    ...usableOracles.map(id => ({ kind: 'oracle' as const, id })),
  ]
  if (pool.length === 0) return {}
  const ref = pool[Math.floor(rand() * pool.length)]
  if (ref.kind === 'oracle') {
    const used = useOracle(params, run, ref.id)
    return { wave: { ...used.wave!, activeSeal: null }, run: used, forceActivatedTarget: { kind: 'revelationOrOracle', ref } }
  }
  const targetCol = revelationNeedsTarget(ref.id) ? Math.floor(rand() * wave.tableau.length) : null
  const used = useRevelation(params, run, ref.id, targetCol, rand)
  return { wave: { ...used.wave!, activeSeal: null }, run: used, forceActivatedTarget: { kind: 'revelationOrOracle', ref } }
}
```

`triggerSabotage`(`engine.ts`)は、`lastSabotage`に`forceActivatedTarget`もそのまま含める(既存の`confiscatedTarget`等と同じ扱い)。`WaveState.lastSabotage`の型定義にも追加する。

### B. 共通state「pressPulseTarget」

強制発動時(検知経由)・通常クリック時(onclick経由)の両方から、同じ`pressPulseTarget`という単一stateをセットする。`PlayArea.svelte`に配置する:

```ts
export type PressPulseTarget = Exclude<WaveState['lastSabotage'], undefined>['forceActivatedTarget']

let pressPulseTarget = $state<PressPulseTarget | null>(null)
let pressPulseActive = $state(false)

function startPressPulseAnimation(target: NonNullable<PressPulseTarget>) {
  pressPulseActive = true
  pressPulseTarget = target
  onPressPulseChange?.(target)
  const timer = setTimeout(() => {
    pressPulseActive = false
    pressPulseTarget = null
    onPressPulseChange?.(null)
  }, 500)
  dealTimers.push(timer)
}
```

`pressPulseActive`は関数先頭で同期的に`true`にする(CLAUDE.mdの「移動アニメーション実装時の注意」・既存の`sealFlashActive`/`confiscateFadingActive`と同じ原則)。ただし`anyAnimationActive`には含めない(理由は下記「D. 操作ブロックの扱い」を参照)。`pressPulseActive`自体は演出終了タイミングの管理にのみ使う。

**検知(強制発動時)**: 既存の`lastSabotage`検知`$effect.pre`に分岐を追加する:

```ts
} else if (current.id === 'riteForceActivate' || current.id === 'revelationOracleForceActivate') {
  if (current.forceActivatedTarget) {
    startPressPulseAnimation(current.forceActivatedTarget)
  }
}
```

**通常クリック時**: 秘儀ボタンの`onclick`ハンドラを、`pressPulseTarget`を先にセットしてから`onUseRite?.(riteId)`を呼ぶ形に変更する:

```svelte
onclick={() => { startPressPulseAnimation({ kind: 'rite', id: riteId }); onUseRite?.(riteId) }}
```

天啓ボタンも同様のパターンで`onUseRevelationClick?.(revelationId)`をラップする。

神託「使」ボタン(`itemBadges`スニペット、`+page.svelte`側)は`PlayArea`の外にあるため、グループA/Bと同じ「コールバックpropsで値を受け渡す」設計にする。`PlayArea.svelte`は新規コールバックprops`onPressPulseChange?: (target: PressPulseTarget | null) => void`を追加し、`startPressPulseAnimation`実行時に呼び出す(既存の`onSealFlashChange`・`onConfiscateFadingChange`と同じパターン)。`+page.svelte`側は`pressPulseTarget`という`$state`を持ち、`onPressPulseChange`コールバックで値を受け取る。

神託「使」ボタンの`onclick`は、`PlayArea`側の`startPressPulseAnimation`を直接呼べない(`+page.svelte`はコンポーネントの外側にいる)ため、`+page.svelte`側に同様の`startOraclePressPulse`関数を用意し、500msのタイマーで`pressPulseTarget`をセット・クリアする(`PlayArea`側の実装と同じロジックを、対象が`+page.svelte`側にある分だけ複製する形になる。グループBの`withFadingId`のように`PlayArea.svelte`からexportして共有する案もあるが、今回はタイマー管理を伴う関数のため、単純な関数extractではなく素直に複製する):

```ts
// +page.svelte側
let pressPulseTarget = $state<PressPulseTarget | null>(null)

function startOraclePressPulse(roleName: RoleName) {
  pressPulseTarget = { kind: 'revelationOrOracle', ref: { kind: 'oracle', id: roleName } }
  setTimeout(() => { pressPulseTarget = null }, 500)
}

function handleUseOracle(roleName: RoleName) {
  startOraclePressPulse(roleName)
  run = useOracle(params, run, roleName)
}
```

`itemBadges`スニペット内の「使」ボタンに、`pressPulseTarget`との一致判定でクラスを適用する:

```svelte
{@const oraclePulsing = pressPulseTarget?.kind === 'revelationOrOracle' && pressPulseTarget.ref.kind === 'oracle' && pressPulseTarget.ref.id === roleName}
<button onclick={() => handleUseOracle(roleName)} class="text-purple-300/70 underline {oraclePulsing ? 'shidasu-press-pulse' : ''}">使</button>
```

強制発動(神託が対象の場合)による`pressPulseTarget`更新は、`PlayArea`側の`onPressPulseChange`コールバックから`+page.svelte`側の同じ`pressPulseTarget`stateへ反映される(`sealFlashTarget`・`confiscateFadingTarget`と同じ受け取り方)。

### C. CSS(自動プレス+パルス)

`sabotageAnimations.css`に新規keyframesを追加する:

```css
@keyframes shidasu-press-pulse {
  0% { transform: scale(1); box-shadow: 0 0 0 rgba(217, 70, 239, 0); }
  30% { transform: scale(0.85); box-shadow: 0 0 24px rgba(217, 70, 239, 0.9); }
  60% { transform: scale(1.1); }
  100% { transform: scale(1); box-shadow: 0 0 0 rgba(217, 70, 239, 0); }
}

.shidasu-press-pulse {
  animation: shidasu-press-pulse 0.5s ease-out;
}
```

既存の`active:scale-95`(Tailwindユーティリティ、押しっぱなし中のみ働く)とは重ねて適用してよい(別レイヤーのため相互に干渉しない)。ボタンの`class`に`{pulsing ? 'shidasu-press-pulse' : ''}`を追加する形で、既存の`shidasu-seal-flash`・`shidasu-confiscate-fade`と同じ運用にする。

### D. 操作ブロックの扱い(グループA/Bとの相違点)

グループA(フラッシュ+シェイク)・グループB(崩れ落ちるフェード)は演出中`anyAnimationActive`に含めて他の操作をブロックしていたが、グループCは性質が異なる。通常クリックで秘儀・天啓・神託を発動する場合、`useRite`/`useRevelation`/`useOracle`の効果自体は同期的に即座へ適用されるため、パルス演出(装飾)の完了を待ってから次の操作を許可する必要は薄い。強制発動時も同様(効果は`triggerSabotage`実行時点で既に確定済み)。

そのため、`pressPulseActive`は`anyAnimationActive`に含めない(演出中も通常通り操作可能)。ボタンの`disabled`判定(`usable`)には影響を与えず、純粋に見た目の演出としてのみ扱う。

## テスト

- **`forceActivatedTarget`の設定**: `triggerSabotage`が強制発動系2種発動時に`lastSabotage.forceActivatedTarget`へ正しい`kind`/`id`(または`ref`)を設定することをエンジンレベルのテストで確認する。対象プールが空の場合は`forceActivatedTarget`が`undefined`のままであることも確認する。
- **アニメーション**: デバッグ画面(`/admin/shidasu-debug`)は`PlayArea`に`rites`/`revelations`propsを渡しておらず、秘儀・天啓ボタン自体が表示されない(グループB実装時に確認済みの制約。既存の`RiteExecutePanel`/`RevelationExecutePanel`は全種を直接発動する別UIで、`useRite`/`useRevelation`を経由しないため対象外)。神託「使」ボタンもデバッグ画面には神託所持手段が無く表示されない。そのため今回のグループC(強制発動系+通常発動共通化)の目視確認は、実プレイ画面(`/game/shidasu`)で行う:
  - 実際にゲームを開始し、秘儀を所持した状態で秘儀ボタンを通常クリックし、パルス演出が発生することを確認する
  - 天啓を所持した状態で天啓ボタンを通常クリックし、パルス演出が発生することを確認する
  - 神託を所持した状態で神託「使」ボタンを通常クリックし、パルス演出が発生することを確認する
  - `riteForceActivate`・`revelationOracleForceActivate`は星の妨害行動設定(`stageStars`)経由でないと実プレイ中に自然発生させにくいため、Vitestの`triggerSabotage`テストで`lastSabotage.forceActivatedTarget`の正確性を確認することを主とし、目視確認は「対象ボタンにパルス演出が効くこと」を上記の通常クリック確認で代替する(検知ロジック自体は`$effect.pre`の分岐であり、既存のグループA/Bと同型のため、通常クリック側の動作確認で演出の仕組み自体の正しさは担保できる)
  - 演出中も他の操作(カードプレイ・山札引き等)がブロックされないことを確認する(グループA/Bとの相違点)
- `npm run build`・`npm run check`が通ることを確認する。

## スコープ外

- グループD(カード移動系)・グループE(数値変化系)の演出実装
- 神託「使」ボタン以外(「売」ボタン等)へのパルス演出適用
