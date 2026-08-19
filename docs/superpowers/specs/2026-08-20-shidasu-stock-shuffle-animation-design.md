# 山札シャッフル演出(揺れアニメーション) 実装 設計

> 対象: 妨害行動「山札攪拌」(`stockShuffle`)・秘儀「ᛞ」(`dagaz`、山札と捨て札を合わせてシャッフルし新しい山札にする)発動時、山札ボタンが短く左右に揺れる演出を実装する。

## 背景・目的

山札(stock)は個別カード表示を持たず、山札ボタン(件数バッジ)のみで表現される。そのため、これまでのセッションで実装した「総戻し」「一列戻し」「大量放出」「少量放出」のような、個々のカードが画面上を移動する演出は成立しない。今回は、山札の中身が並べ替わったことを視覚的に伝える、山札ボタン自体が短く揺れる装飾的な演出を実装する。

`stockShuffle`(妨害行動)は`wave.stock`を単純に並べ替えるだけ。`dagaz`(秘儀)は`wave.stock`と`wave.discardPile`を合わせてシャッフルし、新しい`wave.stock`にする(`discardPile`は空になる)。いずれも山札の中身自体(枚数構成)や個々のカードの表裏(`faceUp`)には影響を与えない。

## 方針(スコープ)

- 「山札攪拌」(`stockShuffle`)・「ᛞ」(`dagaz`)発動時の演出のみを対象とする。
- 他の山札を経由するシャッフル(場札・チェーンへの配布を伴うもの、`kenaz`・`hagalaz`・`wunjo`・`othala`等)は対象外。これらは既にプレイの結果としてカード移動アニメーションが発生する箇所であり、今回のスコープに含めると影響範囲が大きくなりすぎる。

## 技術設計

### A. トリガー機構

`stockShuffle`・`dagaz`は発動経路が異なる(`triggerSabotage`/`useRite`)ため、両方から共通で更新できるトリガー用フィールドを`WaveState`に追加する:

```ts
lastStockShuffle?: { seq: number }
```

`triggerSabotage`(`engine.ts`)は、`id === 'stockShuffle'`のときだけ`seq`をインクリメントし、それ以外の妨害行動発動時は前回の値をそのまま維持する:

```ts
lastStockShuffle: id === 'stockShuffle' ? { seq: (wave.lastStockShuffle?.seq ?? 0) + 1 } : wave.lastStockShuffle,
```

`useRite`(`engine.ts`)も、`riteId === 'dagaz'`のときだけ同様に`wave`へ反映する。既存の`useRite`は`wave = applyRiteEffect(...)`の結果をそのまま使うため、`dagaz`のケースのみ`lastStockShuffle`を追加で上書きする:

```ts
export function useRite(params: ShidasuParams, run: RunState, riteId: RiteId, rand: () => number = Math.random): RunState {
  if ((run.phase !== 'playing' && !SHOP_FLOW_PHASES.includes(run.phase)) || !run.wave || run.wave.status !== 'playing') return run
  if (!canUseRite(params, run.wave, riteId)) return run
  const idx = run.rites.indexOf(riteId)
  if (idx === -1) return run
  let wave = applyRiteEffect(params, run.wave, riteId, rand)
  wave = applyDiscretionFrostBonus(params, run, wave)
  if (riteId === 'dagaz') {
    wave = { ...wave, lastStockShuffle: { seq: (run.wave.lastStockShuffle?.seq ?? 0) + 1 } }
  }
  const rites = [...run.rites.slice(0, idx), ...run.rites.slice(idx + 1)]
  const recentUsedRiteIds = [riteId, ...run.recentUsedRiteIds].slice(0, 2)
  return { ...run, wave, rites, recentUsedRiteIds }
}
```

`PlayArea.svelte`は、既存の`lastSabotage`検知に使っている`$effect.pre`パターンと同じ形で、`wave.lastStockShuffle?.seq`の変化を検知する(前回値を`let`変数で追跡し、変化時のみ演出を起動する)。

### B. アニメーション本体

山札ボタンに`transform: rotate(...)`をJS駆動で短時間適用し、左右に揺れる動きを作る。既存のフリップ系アニメーションと同じ「角度・`transitionMs`を都度書き換える」手法を踏襲する。カードの表裏(`faceUp`)や枚数表示には一切影響しない、純粋な演出。

```ts
let stockShuffleRotation = $state(0)
let stockShuffleTransitionMs = $state(0)

function startStockShuffleAnimation() {
  const steps = [-8, 8, -5, 5, 0]
  steps.forEach((deg, i) => {
    const timer = setTimeout(() => {
      stockShuffleRotation = deg
      stockShuffleTransitionMs = 60
    }, i * 60)
    dealTimers.push(timer)
  })
}
```

山札ボタンの`style`に`transform: rotate({stockShuffleRotation}deg); transition-duration:{stockShuffleTransitionMs}ms;`を追加する(既存のCARD_BACK_STYLE等と同様、インラインstyleへ追記する形)。

演出中(最初のステップ開始から最後のステップの`transitionMs`経過まで)は、他の操作をブロックする目的で`anyAnimationActive`に含める。これまでの`discardPurgeActive`と同様、関数の先頭で同期的に`true`へ切り替える専用フラグ(例: `stockShuffleActive`)を用意し、最後のステップ完了時に`false`へ戻す。演出時間が短い(計300ms)ため、体感への影響は小さい。

## テスト

- **トリガー**: `triggerSabotage`が`stockShuffle`発動時のみ`lastStockShuffle.seq`を更新し、他の妨害行動では前回値を維持することをエンジンレベルのテストで確認する。`useRite`が`dagaz`使用時のみ同様に更新することも確認する。
- **アニメーション**: コンポーネントレベルの自動テストは無いため、`npm run dev`+`/admin/shidasu-debug`のデバッグ発動ボタンで目視確認する:
  - 「山札攪拌」ボタンを押し、山札ボタンが短く左右に揺れることを確認する
  - 秘儀パネルから「ᛞ」(dagaz)を実行し、同様に揺れることを確認する
  - 演出中は他の操作が無効化され、完了後は正常に操作できることを確認する
  - 演出前後で山札の枚数表示・見た目(裏面デザイン)自体は変化しないことを確認する(純粋な演出であり、データ上の変化は無いことの裏付け)
- `npm run build`・`npm run check`が通ることを確認する。

## スコープ外

- `stockShuffle`・`dagaz`以外の山札を経由するシャッフル・配布処理への演出拡張
- 個々のカードが画面上を移動する演出(山札は個別カード表示を持たないため、そもそも対象にならない)
