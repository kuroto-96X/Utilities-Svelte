# 天啓プレビューwave一時差し替え共通化リファクタ 実装プラン

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `src/routes/game/shidasu/+page.svelte`にある4箇所の「run.waveを一時的にプレビュー用waveへ差し替えて効果適用関数を呼び、結果からrunを更新した上でwaveだけ元に戻す」という完全一致パターンを、共通ヘルパー`applyToRevelationPreview`へ切り出す。

**Architecture:** `applyToRevelationPreview(fn)`という高階関数を1つ追加し、`handleUseRiteInPreview`・`handlePickPackRevelationUse`・`handleUseRevelationClick`・`handleTargetColumn`の4箇所にある差し替え・復元の核(4行)をこの関数呼び出しに置き換える。呼び出し後の`previewResultWave`の反映ロジック(2分岐/3分岐のパターン)、および「どの関数を呼ぶか」の選択ロジックは各呼び出し元にそのまま残す。純粋なリファクタであり挙動は一切変更しない。

**Tech Stack:** SvelteKit, Svelte 5, TypeScript, Vitest

**設計書:** `docs/superpowers/specs/2026-08-18-shidasu-revelation-preview-wave-swap-refactor-design.md`

---

## Task 1: `applyToRevelationPreview`ヘルパーの追加と4箇所の置き換え

**Files:**
- Modify: `src/routes/game/shidasu/+page.svelte`

- [ ] **Step 1: `applyToRevelationPreview`ヘルパーを追加する**

`src/routes/game/shidasu/+page.svelte`内、`handleUseRiteInPreview`関数の直前(`grep -n "function handleUseRiteInPreview"`で位置を特定できる。現在186行目のコメント直前)に以下を追加する:

```ts
  // 天啓プレビュー盤面(revelationPreviewWave)に対してfnを適用する共通処理。run.waveを
  // 一時的にプレビューへすり替えてfnを呼び出し、結果からwave以外(deckComposition・
  // currency・shop・revelations等の永続的な変更)を本番runへ反映する。本番run.wave自体は
  // 変更しない(直前Waveのended状態のまま維持する)。呼び出し元は返り値(適用後のプレビュー
  // wave、効果が無効化された場合はnullになりうる)を見て、revelationPreviewWaveをどう
  // 更新するか(そのまま/終了扱い/破棄)を判断する。呼び出し元は事前にrevelationPreviewWaveが
  // 非nullであることを確認済みである前提で、ここでは改めてチェックしない。
  function applyToRevelationPreview(fn: (runForPreview: RunState) => RunState): WaveState | null {
    const runForPreview = { ...run, wave: revelationPreviewWave }
    const resultRun = fn(runForPreview)
    run = { ...resultRun, wave: run.wave }
    return resultRun.wave
  }

```

- [ ] **Step 2: `handleUseRiteInPreview`を置き換える**

`src/routes/game/shidasu/+page.svelte`内、以下のブロック(`grep -n "function handleUseRiteInPreview"`で位置を特定できる):

```ts
  function handleUseRiteInPreview(riteId: RiteId) {
    if (!revelationPreviewWave) return
    const runForPreview = { ...run, wave: revelationPreviewWave }
    const resultRun = useRite(params, runForPreview, riteId)
    const previewResultWave = resultRun.wave
    run = { ...resultRun, wave: run.wave }
    if (previewResultWave) {
      revelationPreviewWave = previewResultWave
    }
  }
```

を以下に置き換える:

```ts
  function handleUseRiteInPreview(riteId: RiteId) {
    if (!revelationPreviewWave) return
    const previewResultWave = applyToRevelationPreview((runForPreview) => useRite(params, runForPreview, riteId))
    if (previewResultWave) {
      revelationPreviewWave = previewResultWave
    }
  }
```

- [ ] **Step 3: `handlePickPackRevelationUse`のプレビュー分岐を置き換える**

同ファイル内、`handlePickPackRevelationUse`関数内の以下のブロック(`grep -n "const resultRun = pickPackRevelationUse(params, runForPreview, revelationId, null)"`で位置を特定できる):

```ts
    if (revelationPreviewWave) {
      // ターゲット不要な天啓もプレビュー盤面に対して適用する。run.waveへ直接適用すると、
      // 本番の直前Wave(ended状態)のデータが意図せず書き換わり、その変化を本番PlayAreaが
      // 検知して片付けアニメーションが誤って再生されてしまう不具合があった。
      const runForPreview = { ...run, wave: revelationPreviewWave }
      const resultRun = pickPackRevelationUse(params, runForPreview, revelationId, null)
      const previewResultWave = resultRun.wave
      run = { ...resultRun, wave: run.wave }
      if (!previewResultWave) {
        revelationPreviewWave = null
      } else if (resultRun.phase === 'revelationSelect') {
        revelationPreviewWave = previewResultWave
      } else {
        revelationPreviewWave = { ...previewResultWave, status: 'ended', endReason: 'previewDismissed' }
      }
      return
    }
```

を以下に置き換える(コメントはそのまま維持する):

```ts
    if (revelationPreviewWave) {
      // ターゲット不要な天啓もプレビュー盤面に対して適用する。run.waveへ直接適用すると、
      // 本番の直前Wave(ended状態)のデータが意図せず書き換わり、その変化を本番PlayAreaが
      // 検知して片付けアニメーションが誤って再生されてしまう不具合があった。
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

(`applyToRevelationPreview`呼び出し後、`run.phase`は元の`resultRun.phase`と一致するため、分岐条件を`run.phase === 'revelationSelect'`に置き換えても意味は変わらない。)

- [ ] **Step 4: `handleUseRevelationClick`のプレビュー分岐を置き換える**

同ファイル内、`handleUseRevelationClick`関数内の以下のブロック(`grep -n "const resultRun = useRevelation(params, runForPreview, revelationId, null)"`で位置を特定できる):

```ts
    if (revelationPreviewWave) {
      // プレビュー表示中の即時適用天啓(コラム選択不要)は、プレビュー盤面に対して
      // 適用する。片付けアニメーションは発火させない(秘儀の即時使用と同様)。
      const runForPreview = { ...run, wave: revelationPreviewWave }
      const resultRun = useRevelation(params, runForPreview, revelationId, null)
      const previewResultWave = resultRun.wave
      run = { ...resultRun, wave: run.wave }
      if (previewResultWave) {
        revelationPreviewWave = previewResultWave
      }
      return
    }
```

を以下に置き換える(コメントはそのまま維持する):

```ts
    if (revelationPreviewWave) {
      // プレビュー表示中の即時適用天啓(コラム選択不要)は、プレビュー盤面に対して
      // 適用する。片付けアニメーションは発火させない(秘儀の即時使用と同様)。
      const previewResultWave = applyToRevelationPreview((runForPreview) =>
        useRevelation(params, runForPreview, revelationId, null)
      )
      if (previewResultWave) {
        revelationPreviewWave = previewResultWave
      }
      return
    }
```

- [ ] **Step 5: `handleTargetColumn`のプレビュー分岐を置き換える**

同ファイル内、`handleTargetColumn`関数内の以下のブロック(`grep -n "let resultRun: RunState"`で位置を特定できる):

```ts
    if (revelationPreviewWave) {
      // プレビュー盤面に対して既存の天啓適用関数を流用する。run.waveを一時的に
      // プレビューへすり替えて呼び出し、結果からwave以外(deckComposition・currency・
      // shop・revelations等の永続的な変更)のみ本番runへ反映する。プレビューは使い捨て
      // であり、本番run.waveへ反映すると通常のショップ/プレイ画面にプレビュー内容が
      // 漏れてしまうため、wave自体は呼び出し前のrun.wave(直前Waveのended状態)のまま
      // 変更しない。
      const runForPreview = { ...run, wave: revelationPreviewWave }
      let resultRun: RunState
      if (target.source === 'individual') {
        resultRun = buyIndividualRevelationUse(params, runForPreview, target.slotIndex, colIndex)
      } else if (target.source === 'pack') {
        resultRun = pickPackRevelationUse(params, runForPreview, target.revelationId, colIndex)
      } else {
        resultRun = useRevelation(params, runForPreview, target.revelationId, colIndex)
      }
      const previewResultWave = resultRun.wave
      run = { ...resultRun, wave: run.wave }
      if (!previewResultWave) {
        revelationPreviewWave = null
      } else if (target.source === 'held' || resultRun.phase === 'revelationSelect') {
        // 所持天啓の使用(held)は福袋選択そのものではないため、コラム確定してもプレビューは
        // 終了させない(即時反映のみ、秘儀・コラム不要天啓のプレビュー内使用と同様)。
        // 福袋選択(pack)は、選択後もofferPickRemainingが残っていればresolvePackRevelationPick
        // がphaseをrevelationSelectのまま維持する(=複数選択の途中)ため、この場合もプレビューを
        // 終了させない。選び終えてphaseがshopへ戻った場合のみ、次のelse節で終了させる。
        revelationPreviewWave = previewResultWave
      } else {
        revelationPreviewWave = { ...previewResultWave, status: 'ended', endReason: 'previewDismissed' }
      }
      return
    }
```

を以下に置き換える(コメントはそのまま維持する):

```ts
    if (revelationPreviewWave) {
      // プレビュー盤面に対して既存の天啓適用関数を流用する。run.waveを一時的に
      // プレビューへすり替えて呼び出し、結果からwave以外(deckComposition・currency・
      // shop・revelations等の永続的な変更)のみ本番runへ反映する。プレビューは使い捨て
      // であり、本番run.waveへ反映すると通常のショップ/プレイ画面にプレビュー内容が
      // 漏れてしまうため、wave自体は呼び出し前のrun.wave(直前Waveのended状態)のまま
      // 変更しない。
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
        // 所持天啓の使用(held)は福袋選択そのものではないため、コラム確定してもプレビューは
        // 終了させない(即時反映のみ、秘儀・コラム不要天啓のプレビュー内使用と同様)。
        // 福袋選択(pack)は、選択後もofferPickRemainingが残っていればresolvePackRevelationPick
        // がphaseをrevelationSelectのまま維持する(=複数選択の途中)ため、この場合もプレビューを
        // 終了させない。選び終えてphaseがshopへ戻った場合のみ、次のelse節で終了させる。
        revelationPreviewWave = previewResultWave
      } else {
        revelationPreviewWave = { ...previewResultWave, status: 'ended', endReason: 'previewDismissed' }
      }
      return
    }
```

- [ ] **Step 6: 型チェックを実行する**

Run: `npm run check`
Expected: エラー無し

- [ ] **Step 7: フルテストスイートを実行する**

Run: `npx vitest run`
Expected: 全件PASS(このリファクタは`+page.svelte`のみを対象とし、`engine.ts`側のロジックは一切変更していないため、既存テストは無修正のまま全てグリーンになるはず)

- [ ] **Step 8: ビルドを実行する**

Run: `npm run build`
Expected: 成功

- [ ] **Step 9: ブラウザで動作確認する**

Run: `npm run dev` → `http://localhost:5173/game/shidasu` を開く

以下を確認する(`+page.svelte`はUIイベントハンドラに密結合したロジックのため、このリファクタでは必須の確認とする):

- 天啓プレビュー中に秘儀を使用し、盤面に反映されること(`handleUseRiteInPreview`)
- 天啓プレビュー中に福袋から天啓(コラム選択不要のもの)を使用すること(`handlePickPackRevelationUse`)
- 天啓プレビュー中に手持ちの天啓(コラム選択不要のもの)を使用すること(`handleUseRevelationClick`)
- 天啓プレビュー中に列を対象とした天啓(バラ売り・福袋・手持ちのいずれか)を発動し、対象列に正しく反映されること(`handleTargetColumn`)
- 上記いずれについても、効果発動後にプレビューが継続/終了/破棄される挙動が従来通りであること

ブラウザ操作が困難な環境であれば、Step 6〜8(型チェック・テスト・ビルド)の成功で代替してよい。

- [ ] **Step 10: コミット**

```bash
git add src/routes/game/shidasu/+page.svelte
git commit -m "refactor: 天啓プレビューのwave一時差し替え処理をapplyToRevelationPreviewへ共通化する"
```

---

## 最終確認

- [ ] `npm run build`を実行し、ビルドが通ることを確認する
- [ ] `npm run check`を実行し、型エラーが無いことを確認する
- [ ] `npx vitest run`を実行し、全テストがPASSすることを確認する
- [ ] `docs/shidasu/shidasu-roadmap.md`に今回のリファクタ完了を反映する
