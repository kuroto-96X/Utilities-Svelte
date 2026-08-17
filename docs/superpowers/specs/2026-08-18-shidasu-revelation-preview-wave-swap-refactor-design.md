# 天啓プレビューwave一時差し替え共通化リファクタ 設計

> 対象: `src/routes/game/shidasu/+page.svelte`にある、天啓プレビュー中に「`run.wave`を一時的にプレビュー用waveへ差し替えて効果適用関数を呼び、結果から`run`を更新した上で`wave`だけ元に戻す」という4箇所のパターンを共通ヘルパーへ切り出す。純粋なリファクタであり挙動は一切変更しない。

## 背景・目的

これまでのセッションで7回、`engine.ts`・`shop.ts`・`+page.svelte`・`PlayArea.svelte`にあった機械的重複を共通ヘルパー・ファクトリに切り出すリファクタを実施してきた。`+page.svelte`の天啓プレビュー用「wave一時差し替え」パターンは、過去複数回のセッションで「リスクがありそう」として繰り返し見送られてきた候補だった。

今回、実際に該当コードを精読した結果、以下が判明した。

- パターンの出現箇所は3箇所ではなく**4箇所**だった(`handleUseRiteInPreview`が過去のセッションで見落とされていた)。
- 4箇所すべてにおいて、以下の4行(差し替え→呼び出し→結果取り出し→wave以外を反映)は**完全に一致**している。

```ts
const runForPreview = { ...run, wave: revelationPreviewWave }
const resultRun = <何らかの関数>(params, runForPreview, ...)
const previewResultWave = resultRun.wave
run = { ...resultRun, wave: run.wave }
```

- 差分は「どの関数を呼ぶか」(`useRite`・`useRevelation`・`pickPackRevelationUse`・`buyIndividualRevelationUse`のいずれか、`handleTargetColumn`のみ`target.source`により3択)と、「呼び出し後、`previewResultWave`を`revelationPreviewWave`へどう反映するか」(単純に代入するだけの2分岐パターンと、null/継続中/終了で分岐する3分岐パターンの2種類)のみ。

この「完全一致する核」と「呼び出し元ごとに異なる分岐ロジック」は明確に分離できるため、過去に懸念されていたほどのリスクはなく、安全に共通化できると判断した。

## 方針(スコープ)

`+page.svelte`内の以下4箇所にある「wave一時差し替え→呼び出し→復元」の核(4行)のみを、高階関数`applyToRevelationPreview`へ切り出す。呼び出し後の分岐ロジック(`previewResultWave`をどう`revelationPreviewWave`に反映するか)、および「どの関数を呼ぶか」の選択ロジックは、各呼び出し元にそのまま残す。

対象4箇所:
1. `handleUseRiteInPreview`
2. `handlePickPackRevelationUse`のプレビュー分岐
3. `handleUseRevelationClick`のプレビュー分岐
4. `handleTargetColumn`のプレビュー分岐

## 技術設計

### `applyToRevelationPreview`ヘルパー

```ts
// 天啓プレビュー盤面(revelationPreviewWave)に対してfnを適用する共通処理。run.waveを一時的に
// プレビューへすり替えてfnを呼び出し、結果からwave以外(deckComposition・currency・shop・
// revelations等の永続的な変更)を本番runへ反映する。本番run.wave自体は変更しない
// (直前Waveのended状態のまま維持する)。呼び出し元は返り値(適用後のプレビューwave、
// 効果が無効化された場合はnullになりうる)を見て、revelationPreviewWaveをどう更新するか
// (そのまま/終了扱い/破棄)を判断する。
function applyToRevelationPreview(fn: (runForPreview: RunState) => RunState): WaveState | null {
  const runForPreview = { ...run, wave: revelationPreviewWave }
  const resultRun = fn(runForPreview)
  run = { ...resultRun, wave: run.wave }
  return resultRun.wave
}
```

呼び出し元は既に`revelationPreviewWave`が非nullであることを確認済みの分岐内でのみこの関数を呼ぶ(既存のガード構造は変更しない)。`applyToRevelationPreview`内部では改めてnullチェックしない(呼び出し元の既存ガードに委ねる)。

`run.phase`は`applyToRevelationPreview`の呼び出し後、`resultRun.phase`と一致する(`resultRun`の`wave`以外のフィールドはそのまま`run`へ反映されるため)。したがって、呼び出し元の分岐条件で`resultRun.phase`を参照していた箇所は、呼び出し後の`run.phase`を参照する形に置き換えても意味は変わらない。

### 呼び出し元の変更

**`handleUseRiteInPreview`:**

```ts
function handleUseRiteInPreview(riteId: RiteId) {
  if (!revelationPreviewWave) return
  const previewResultWave = applyToRevelationPreview((runForPreview) => useRite(params, runForPreview, riteId))
  if (previewResultWave) {
    revelationPreviewWave = previewResultWave
  }
}
```

**`handlePickPackRevelationUse`のプレビュー分岐:**

```ts
if (revelationPreviewWave) {
  const previewResultWave = applyToRevelationPreview((runForPreview) =>
    pickPackRevelationUse(params, runForPreview, revelationId, null)
  )
  if (!previewResultWave) {
    revelationPreviewWave = null
  } else if (run.phase === 'revelationSelect') {
    revelationPreviewWave = previewResultWave
  } else {
    revelationPreviewWave = { ...previewResultWave, status: 'ended', endReason: 'previewDismissed' }
  }
  return
}
```

**`handleUseRevelationClick`のプレビュー分岐:**

```ts
if (revelationPreviewWave) {
  const previewResultWave = applyToRevelationPreview((runForPreview) =>
    useRevelation(params, runForPreview, revelationId, null)
  )
  if (previewResultWave) {
    revelationPreviewWave = previewResultWave
  }
  return
}
```

**`handleTargetColumn`のプレビュー分岐:**

```ts
if (revelationPreviewWave) {
  const previewResultWave = applyToRevelationPreview((runForPreview) => {
    if (target.source === 'individual') {
      return buyIndividualRevelationUse(params, runForPreview, target.slotIndex, colIndex)
    }
    if (target.source === 'pack') {
      return pickPackRevelationUse(params, runForPreview, target.revelationId, colIndex)
    }
    return useRevelation(params, runForPreview, target.revelationId, colIndex)
  })
  if (!previewResultWave) {
    revelationPreviewWave = null
  } else if (target.source === 'held' || run.phase === 'revelationSelect') {
    revelationPreviewWave = previewResultWave
  } else {
    revelationPreviewWave = { ...previewResultWave, status: 'ended', endReason: 'previewDismissed' }
  }
  return
}
```

## テスト

- 純粋なリファクタのため、天啓プレビューに関するE2E/コンポーネントテストが既存にあればそれを無修正のまま実行し、グリーンであることを確認する。
- `+page.svelte`はロジックがUIイベントハンドラに密結合しているため、`npm run dev`でブラウザから実際に以下を確認する(このリファクタで唯一のブラウザ確認が必須な回であり、他の作業完了条件を上回る優先度で行う):
  - 天啓プレビュー中に秘儀を使用し、盤面に反映されること(`handleUseRiteInPreview`)
  - 天啓プレビュー中に福袋から天啓を使用すること(`handlePickPackRevelationUse`)
  - 天啓プレビュー中に手持ちの天啓を使用すること(`handleUseRevelationClick`)
  - 天啓プレビュー中に列を対象とした天啓(バラ売り・福袋・手持ちのいずれか)を発動し、対象列に正しく反映されること(`handleTargetColumn`)
  - 上記いずれについても、効果発動後にプレビューが継続/終了/破棄される挙動がリファクタ前と変わらないこと
- `npm run check`・`npm run build`が通ることを確認する。

## スコープ外

- `handleConfirmRelicTarget`(天啓関連だが「wave一時差し替え」パターンを使わないため対象外)
- `previewResultWave`の反映ロジック自体の統一・簡略化(2分岐パターンと3分岐パターンの統合)。呼び出し元ごとに意味が異なる分岐であり、無理に統一すると可読性が悪化するため見送る
- ゲームの挙動変更(本リファクタは純粋なリファクタであり一切の挙動変更を行わない)
