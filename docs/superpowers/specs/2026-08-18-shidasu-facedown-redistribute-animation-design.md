# 妨害行動「総戻し」「一列戻し」の裏向き演出(アニメーション) 実装 設計

> 対象: 前回セッションで実装した裏向き挙動(データ・表示)の続き。星の妨害行動「総戻し」(`tableauFullReturn`)・「一列戻し」(`columnReturn`)発動時に、(1) 対象カードが山札へ収束するアニメーション、(2) 裏向きの状態で場札へ配布されるアニメーション、(3) 各列の一番上のカードだけが表向きにめくれるフリップ演出、の3段階演出を実装する。あわせて、動作確認を容易にするため`/admin/shidasu-debug`に妨害行動を直接発動するデバッグボタンを追加する。

## 背景・目的

前回セッションで、`Card.faceUp`フィールドと表示ルール(場札の列の一番上は常に表向き)を実装し、裏向きカード・護符裏面デザインのデータ・表示部分を完成させた。今回はその続きとして見送っていたアニメーション部分を実装する。

`捨て札埋没`(`discardBury`)は場札への配布を伴わないため、今回のスコープには含めない(引き続き即時再描画のまま)。

前回の最終レビューで、星の妨害行動を直接発動させる手段が無く、実装した機能の動作確認がしづらいという課題が指摘されていた。今回はこの課題を解消するため、デバッグ画面に発動ボタンを追加する。

## 方針(スコープ)

- `総戻し`(`tableauFullReturn`)・`一列戻し`(`columnReturn`)発動時の3段階演出(収束→裏向き配布→フリップ)を実装する。
- `/admin/shidasu-debug`に、`総戻し`・`一列戻し`(および今後の妨害関連作業でも使えるよう、他の妨害行動も含めた)を直接発動するデバッグボタンを追加する。
- `捨て札埋没`・他の妨害行動への演出拡張は対象外。
- 護符裏面デザイン(`護符並び替え`)への演出追加は対象外(前回設計書で既にスコープ外とした通り、今回も対象にしない)。

## 技術設計

### A. 妨害発動の検知(トリガー機構)

`WaveState`に新規フィールドを追加する(`src/lib/game/shidasu/types.ts`):

```ts
// 直近発動した妨害行動の識別情報。UI(PlayArea.svelte)がこの値の変化を検知して
// 専用アニメーションを起動するために使う。発動のたびにseqをインクリメントし、
// 同じIDが連続発動しても検知できるようにする。
lastSabotage?: { id: SabotageActionId; seq: number }
```

`triggerSabotage`(`src/lib/game/shidasu/engine.ts`)が発動のたびにこれを更新する(全32種の妨害行動で共通更新。`PlayArea.svelte`側で`id`をフィルタし、対象の2種のときだけ専用アニメーションを起動する):

```ts
export function triggerSabotage(params: ShidasuParams, run: RunState, id: SabotageActionId, rand: () => number = Math.random): RunState {
  if (!run.wave) return run
  const wave = run.wave
  const resetWave: WaveState = { ...wave, activeSeal: null }
  const result = applySabotageEffect(id, { params, run, wave, rand, useRite, useRevelation, useOracle })
  const nextWave: WaveState = { ...resetWave, ...result.wave }
  const nextRun: RunState = { ...run, ...result.run, wave: nextWave }

  const star = nextRun.stageStars[nextRun.waveIndex]
  const rolled = rollSabotage(star?.sabotage ?? { kind: 'none' }, rand)
  return {
    ...nextRun,
    wave: {
      ...nextWave,
      pendingSabotageId: rolled.pendingSabotageId,
      sabotageTurnsRemaining: rolled.sabotageTurnsRemaining,
      lastSabotage: { id, seq: (wave.lastSabotage?.seq ?? 0) + 1 },
    },
  }
}
```

**対象列の特定**: `columnReturn`は具体的にどの列が選ばれたかを`SabotageActionId`だけでは判別できない。ここで前回追加した`Card.faceUp`フラグを再利用する。妨害後の`wave.tableau`を見て「`faceUp === false`のカードを1枚でも含む列」を対象列として検出する(`tableauFullReturn`なら全列、`columnReturn`なら1列だけがヒットする)。新しいフィールドを追加せずに済む。

`PlayArea.svelte`側は、既存の`chainResetAnimation`が使っている`$effect.pre`パターン(DOM再描画前に発火するタイミングで、旧カードの画面座標をキャプチャしてからアニメーションを開始する)をそのまま踏襲する。`wave.tableau`は`$effect.pre`の時点で既に妨害後の値になっているため、対象列の判定はこのタイミングの`wave.tableau`から行い、「集める対象カード」の画面座標は、その時点でまだ再描画されていないDOM要素(`data-drop-col`/`data-drop-row`)から直接読み取る(`chainResetAnimation`の実装と同じ手法)。

```ts
let previousSabotageSeq = wave.lastSabotage?.seq ?? 0
$effect.pre(() => {
  const current = wave.lastSabotage
  if (!current || current.seq === previousSabotageSeq) return
  previousSabotageSeq = current.seq
  if (current.id === 'tableauFullReturn' || current.id === 'columnReturn') {
    const affectedCols = wave.tableau.map((col, ci) => ({ ci, hidden: col.some(c => c.faceUp === false) })).filter(x => x.hidden).map(x => x.ci)
    startSabotageRedistributeAnimation(affectedCols)
  }
})
```

### B. アニメーション本体(収束→裏向き配布)

**フェーズ1(収束): 対象列→山札**

既存の`runGatherAndMoveAnimation`(片付けアニメーションが使っているもの)をそのまま再利用する。対象列それぞれについて、`$effect.pre`のタイミングでまだ再描画されていない旧DOM要素から座標を1枚(その列の一番上に見えていたカード)取得し、`gatherCards`として渡す。移動先は`stockButtonEl`(片付けアニメーションと同じ移動先取得ロジックを再利用する)。この間、対象列の本物の場札描画(既に妨害後のデータになっている)は非表示にする。既存の`cleanedUpColumns`と同様の仕組みで、新規`$state<Set<number>>`(例: `sabotageAnimatingColumns`)を用意し、場札描画側の`invisible`判定条件に追加する。

**フェーズ2(裏向き配布): 山札→対象列**

既存の`startDealAnimation`/`dealOneCard`のロジックを流用するが、以下の点を変える:
- 対象は「対象列のみ」(`tableauFullReturn`なら全列、`columnReturn`なら1列)
- 各列の配布枚数は`wave.tableau[ci].length`(妨害後の実データ。シャッフルしても列の枚数自体は変わらない)
- 配布中のカードは常に`faceUp={false}`で描画する(`CardFace`の既存propをそのまま利用)
- 着地後、そのカードがその列の一番上でなければ、既存の表示ルール(`card.faceUp !== false || isTop`)により自動的に裏向きのまま表示される(前回実装済みのロジックがそのまま機能する)

### C. フリップ演出

**状態**: `flippingCards: $state<FlippingCard[]>([])`(複数列が同時にめくれる`総戻し`のケースに対応するため配列)。

```ts
interface FlippingCard {
  colIndex: number
  rowIndex: number
  card: Card
  revealed: boolean   // trueになった瞬間、描画するCardFaceのfaceUpをtrueに切り替える
  rotation: number     // 0=正面向き(裏 or 表), 90=真横向き(不可視)
  transitionMs: number
}
```

Svelteの`transition:`ディレクティブは使わない(既存コード全体で統一して避けている手法であり、`CardFace`は`faceUp`propの変化だけで初回マウント時にも発火してしまうリスクがあるため、既存の流儀通りJS駆動の数値遷移(`scoreNumberScale`と同種のパターン)で実装する)。

**シーケンス**(Solitaireの`flipIn`と同程度、220ms前後を目安にする):

1. 配布フェーズでカードが着地し、かつそのマスがその列の一番上になったタイミングで、`flippingCards`に`{rotation:0, revealed:false, transitionMs:0}`として追加する(裏面のまま)
2. 2段`requestAnimationFrame`後、`rotation:90, transitionMs:100`にして裏面を真横向きに回転させる
3. 100ms後(真横=不可視のタイミング)、`revealed:true`に切り替える(このタイミングで初めて`CardFace`へ渡す`faceUp`をtrueにする。回転が真横で見えないため切り替えが視覚的に破綻しない)
4. 同時に`rotation:90, transitionMs:0`→2段rAF→`rotation:0, transitionMs:100`とし、表面を正面へ回転させる
5. 100ms後、`flippingCards`からそのカードを除去する。以後は通常の場札描画(既存の`faceUp={card.faceUp !== false || isTop}`ルール)にそのまま委ねる

**本物の場札表示との連携**: 配布フェーズで着地したカードは実データ(`wave.tableau`)としては既に存在するが、それが列の一番上かつフリップ演出中である間は、既存の`isNotYetDealt`/`isCleaningUpThisColumn`と同様の仕組みで本物の描画を`invisible`にし、上記のフリップ用オーバーレイ`<div>`(絶対配置、`dealingCards`と同じ表示方式)を代わりに表示する。フリップ完了後にオーバーレイを消すと、本物の場札描画が(既に`faceUp`条件を満たしているため)自然に表向きで見える。

### D. デバッグ画面への発動ボタン追加

`/admin/shidasu-debug`(`src/routes/admin/shidasu-debug/+page.svelte`)は現状`wave: WaveState`のみを`$state`で保持し、`RunState`は保持していない。一方`triggerSabotage`は`RunState`を引数に取る。デバッグ画面専用に、既存の`createInitialRun()`ヘルパーで使い捨ての`RunState`を組み立て、結果の`wave`だけを取り出すラッパー関数を追加する。

```ts
import { triggerSabotage, createInitialRun } from '$lib/game/shidasu/engine'
import type { SabotageActionId } from '$lib/game/shidasu/types'

function handleTriggerSabotage(id: SabotageActionId) {
  const run = { ...createInitialRun(), items, wave }
  const next = triggerSabotage(params, run, id, Math.random)
  wave = next.wave!
  lastSnapshot = null
}
```

`SABOTAGE_POOL`(`src/lib/game/shidasu/sabotage.ts`)から全妨害行動のリストを取得し、それぞれに対応するボタンをデバッグ画面に並べる(既存の`RiteExecutePanel`/`RevelationExecutePanel`と同様の一覧UIパターンを踏襲する)。今回のアニメーション確認で主に使うのは`tableauFullReturn`・`columnReturn`だが、他の妨害行動も含めて一覧化しておくことで、今後の妨害関連作業でも再利用できるようにする。

## テスト

- **トリガー機構**: `triggerSabotage`が`lastSabotage`を正しく設定する(`id`・`seq`のインクリメント)ことをエンジンレベルのテストで確認する。
- **アニメーション本体**: `PlayArea.svelte`はSvelteコンポーネントであり、このプロジェクトにはコンポーネントレベルの自動テストが無い。`npm run dev`でブラウザから、新設したデバッグボタンを使い以下を確認する:
  - `総戻し`発動時、全列のカードが山札へ収束→裏向きで再配布→各列の一番上だけフリップして表向きになる、という3段階が正しい順序・見た目で再生されること
  - `一列戻し`発動時、対象の1列だけが同様に演出され、他の列は一切動かないこと
  - 演出中は他の操作(カードプレイ・山札引き等)が無効化されること(`anyAnimationActive`に新規アニメーション状態を含める)
  - 演出完了後、通常のカードプレイ・裏向きカードの解放(プレイして一番上が入れ替わる)が問題なく機能し続けること
- `npm run build`・`npm run check`が通ることを確認する。

## スコープ外

- `捨て札埋没`への演出拡張(場札への配布を伴わないため、今回と同じ3段階パターンが当てはまらない。将来別途検討する)
- 護符裏面デザインへの演出追加
- デバッグ画面のボタン以外での妨害発動手段(通常プレイでの偶発的な発動に頼らずに済むようにする、という当初の課題を解消する最小限の対応に留める)
