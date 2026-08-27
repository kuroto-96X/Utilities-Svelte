# 配布アニメーションの裏向き統一・着地時フリップ演出 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 場札配布アニメーションを「常に裏向きの見た目で移動し、着地の瞬間にそのカードが表向きであるべきかどうかを判定してフリップする」という共通パターンに統一し、月スプレッドの裏向きカードが配布アニメーション中も裏向きのまま表示されるようにする。

**Architecture:** `dealOneCard`のシグネチャを`faceUp`/`onLanded`の2引数から`shouldFlipToFaceUp`という単一の真偽値引数に変更し、常に裏向きで移動→着地時に`shouldFlipToFaceUp`が`true`なら`startFlipReveal`を呼ぶ、`false`ならそのまま`dealtCells`登録という共通ロジックに一本化する。呼び出し元は`startDealAnimation`(通常配布、判定は`entry.card.faceUp !== false`)と`startSabotageDealAnimation`(妨害系再配布、判定は`isTopOfColumn`)の2箇所のみ。

**Tech Stack:** Svelte 5, TypeScript

---

### Task 1: `dealOneCard`のシグネチャ変更と呼び出し元2箇所の更新

**Files:**
- Modify: `src/routes/game/shidasu/PlayArea.svelte:1026-1068` (`dealOneCard`関数本体とコメント)
- Modify: `src/routes/game/shidasu/PlayArea.svelte:996-1024` (`startDealAnimation`内の呼び出し)
- Modify: `src/routes/game/shidasu/PlayArea.svelte:953-994` (`startSabotageDealAnimation`内の呼び出しとコメント)

このタスクは自動テストの対象外(配布アニメーションはタイマー・DOM操作が主体のため、このプロジェクトの既存方針として自動テストを書かない)。手を動かして直接修正し、ビルド・型チェック・ブラウザ確認で検証する。

- [ ] **Step 1: `dealOneCard`関数のシグネチャとコメントを変更する**

`src/routes/game/shidasu/PlayArea.svelte`の現在の内容(1026-1068行目):

```ts
  // 1枚のカードを山札の位置からマス目の位置へ移動させ、着地したらdealtCellsに登録して
  // 実表示へ切り替える。複数枚が時間差で同時並行するため、dealingCardsは配列で管理する。
  // faceUpは配布中の表示に使う(通常配布は常にtrue、妨害再配布はfalse)。onLandedは
  // 着地時にdealtCells登録の代わりに独自処理をしたい呼び出し元(妨害再配布)向けのフック。
  function dealOneCard(
    entry: { card: Card; colIndex: number; rowIndex: number },
    fromLeft: number,
    fromTop: number,
    faceUp: boolean = true,
    onLanded?: (entry: { card: Card; colIndex: number; rowIndex: number }) => void
  ) {
    if (!tableauEl) return
    const targetEl = tableauEl.querySelector<HTMLElement>(`[data-drop-col="${entry.colIndex}"][data-drop-row="${entry.rowIndex}"]`)
    if (!targetEl) return
    const targetRect = targetEl.getBoundingClientRect()
    const targetLeft = targetRect.left + targetRect.width / 2
    const targetTop = targetRect.top + targetRect.height / 2

    dealingCards = [
      ...dealingCards,
      { card: entry.card, colIndex: entry.colIndex, rowIndex: entry.rowIndex, left: fromLeft, top: fromTop, transitionMs: 0, faceUp },
    ]

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        dealingCards = dealingCards.map(d =>
          d.colIndex === entry.colIndex && d.rowIndex === entry.rowIndex
            ? { ...d, left: targetLeft, top: targetTop, transitionMs: DEAL_MOVE_MS }
            : d
        )
      })
    })

    const timer = setTimeout(() => {
      dealingCards = dealingCards.filter(d => !(d.colIndex === entry.colIndex && d.rowIndex === entry.rowIndex))
      if (onLanded) {
        onLanded(entry)
      } else {
        dealtCells = new Set([...dealtCells, `${entry.colIndex}-${entry.rowIndex}`])
      }
    }, DEAL_MOVE_MS)
    dealTimers.push(timer)
  }
```

これを以下に変更する:

```ts
  // 1枚のカードを山札の位置からマス目の位置へ、常に裏向きの見た目で移動させる。複数枚が
  // 時間差で同時並行するため、dealingCardsは配列で管理する。着地時、shouldFlipToFaceUpが
  // trueならstartFlipRevealで表向きへフリップする演出を開始し、falseなら裏向きのまま
  // dealtCellsへ登録して確定表示に切り替える(通常配布・妨害系再配布の両方で共通の着地処理)。
  function dealOneCard(
    entry: { card: Card; colIndex: number; rowIndex: number },
    fromLeft: number,
    fromTop: number,
    shouldFlipToFaceUp: boolean
  ) {
    if (!tableauEl) return
    const targetEl = tableauEl.querySelector<HTMLElement>(`[data-drop-col="${entry.colIndex}"][data-drop-row="${entry.rowIndex}"]`)
    if (!targetEl) return
    const targetRect = targetEl.getBoundingClientRect()
    const targetLeft = targetRect.left + targetRect.width / 2
    const targetTop = targetRect.top + targetRect.height / 2

    dealingCards = [
      ...dealingCards,
      { card: entry.card, colIndex: entry.colIndex, rowIndex: entry.rowIndex, left: fromLeft, top: fromTop, transitionMs: 0, faceUp: false },
    ]

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        dealingCards = dealingCards.map(d =>
          d.colIndex === entry.colIndex && d.rowIndex === entry.rowIndex
            ? { ...d, left: targetLeft, top: targetTop, transitionMs: DEAL_MOVE_MS }
            : d
        )
      })
    })

    const timer = setTimeout(() => {
      dealingCards = dealingCards.filter(d => !(d.colIndex === entry.colIndex && d.rowIndex === entry.rowIndex))
      if (shouldFlipToFaceUp) {
        startFlipReveal(entry.colIndex, entry.rowIndex, entry.card)
      } else {
        dealtCells = new Set([...dealtCells, `${entry.colIndex}-${entry.rowIndex}`])
      }
    }, DEAL_MOVE_MS)
    dealTimers.push(timer)
  }
```

- [ ] **Step 2: `startDealAnimation`内の呼び出しを変更する**

`src/routes/game/shidasu/PlayArea.svelte`の現在の内容(1018-1023行目):

```ts
    order.forEach((entry, index) => {
      const timer = setTimeout(() => {
        dealOneCard(entry, fromLeft, fromTop)
      }, index * DEAL_INTERVAL_MS)
      dealTimers.push(timer)
    })
```

これを以下に変更する:

```ts
    order.forEach((entry, index) => {
      const timer = setTimeout(() => {
        dealOneCard(entry, fromLeft, fromTop, entry.card.faceUp !== false)
      }, index * DEAL_INTERVAL_MS)
      dealTimers.push(timer)
    })
```

- [ ] **Step 3: `startSabotageDealAnimation`内の呼び出しとコメントを変更する**

`src/routes/game/shidasu/PlayArea.svelte`の現在の内容(953-994行目):

```ts
  // 収束アニメーション完了後、対象列のみへカードを裏向きで配り直す。配布順序は
  // 対象列内でrow=0から順に、複数列がある場合は列をまたいでrow単位で揃える
  // (startDealAnimationと同じ考え方)。着地したカードがその列の一番上であれば
  // フリップ演出(startFlipReveal)を、そうでなければ即座にdealtCellsへ登録する。
  function startSabotageDealAnimation(affectedCols: number[]) {
    // 対象列を「未配布」扱いに戻す(isNotYetDealtの判定に使うdealtCellsから除去)。
    dealtCells = new Set([...dealtCells].filter(key => !affectedCols.includes(Number(key.split('-')[0]))))
    // sabotageAnimatingColumnsによる列全体の非表示は収束フェーズ専用。配布フェーズが
    // 始まった時点でクリアし、以後は1枚ずつ着地するたびにdealtCellsへ登録される
    // isNotYetDealt判定に表示制御を委ねる(このクリアを配布完了まで遅らせると、
    // 対象列が全カード着地するまで丸ごと非表示のままになり、対象列数・枚数が多い
    // 総戻しほど「配布完了まで何も見えない」不具合が顕著になっていた)。
    sabotageAnimatingColumns = new Set()

    if (!stockButtonEl) return
    const fromRect = stockButtonEl.getBoundingClientRect()
    const fromLeft = fromRect.left + fromRect.width / 2
    const fromTop = fromRect.top + fromRect.height / 2

    const maxRows = Math.max(0, ...affectedCols.map(ci => wave.tableau[ci].length))
    const order: { card: Card; colIndex: number; rowIndex: number }[] = []
    for (let ri = 0; ri < maxRows; ri++) {
      for (const ci of affectedCols) {
        const card = wave.tableau[ci][ri]
        if (card) order.push({ card, colIndex: ci, rowIndex: ri })
      }
    }

    order.forEach((entry, index) => {
      const timer = setTimeout(() => {
        const isTopOfColumn = entry.rowIndex === wave.tableau[entry.colIndex].length - 1
        dealOneCard(entry, fromLeft, fromTop, false, landedEntry => {
          if (isTopOfColumn) {
            startFlipReveal(landedEntry.colIndex, landedEntry.rowIndex, landedEntry.card)
          } else {
            dealtCells = new Set([...dealtCells, `${landedEntry.colIndex}-${landedEntry.rowIndex}`])
          }
        })
      }, index * DEAL_INTERVAL_MS)
      dealTimers.push(timer)
    })
  }
```

これを以下に変更する:

```ts
  // 収束アニメーション完了後、対象列のみへカードを裏向きで配り直す。配布順序は
  // 対象列内でrow=0から順に、複数列がある場合は列をまたいでrow単位で揃える
  // (startDealAnimationと同じ考え方)。着地したカードがその列の一番上であれば
  // dealOneCard内部でフリップ演出(startFlipReveal)が呼ばれ、そうでなければ
  // 裏向きのままdealtCellsへ登録される。
  function startSabotageDealAnimation(affectedCols: number[]) {
    // 対象列を「未配布」扱いに戻す(isNotYetDealtの判定に使うdealtCellsから除去)。
    dealtCells = new Set([...dealtCells].filter(key => !affectedCols.includes(Number(key.split('-')[0]))))
    // sabotageAnimatingColumnsによる列全体の非表示は収束フェーズ専用。配布フェーズが
    // 始まった時点でクリアし、以後は1枚ずつ着地するたびにdealtCellsへ登録される
    // isNotYetDealt判定に表示制御を委ねる(このクリアを配布完了まで遅らせると、
    // 対象列が全カード着地するまで丸ごと非表示のままになり、対象列数・枚数が多い
    // 総戻しほど「配布完了まで何も見えない」不具合が顕著になっていた)。
    sabotageAnimatingColumns = new Set()

    if (!stockButtonEl) return
    const fromRect = stockButtonEl.getBoundingClientRect()
    const fromLeft = fromRect.left + fromRect.width / 2
    const fromTop = fromRect.top + fromRect.height / 2

    const maxRows = Math.max(0, ...affectedCols.map(ci => wave.tableau[ci].length))
    const order: { card: Card; colIndex: number; rowIndex: number }[] = []
    for (let ri = 0; ri < maxRows; ri++) {
      for (const ci of affectedCols) {
        const card = wave.tableau[ci][ri]
        if (card) order.push({ card, colIndex: ci, rowIndex: ri })
      }
    }

    order.forEach((entry, index) => {
      const timer = setTimeout(() => {
        const isTopOfColumn = entry.rowIndex === wave.tableau[entry.colIndex].length - 1
        dealOneCard(entry, fromLeft, fromTop, isTopOfColumn)
      }, index * DEAL_INTERVAL_MS)
      dealTimers.push(timer)
    })
  }
```

- [ ] **Step 4: 型チェックを実行する**

Run: `npm run check`
Expected: shidasu関連の新規エラーなし(既存の無関係ファイル由来のエラー・警告のみ)。`dealOneCard`の呼び出し元が全て新しいシグネチャ(4引数、第4引数は`boolean`必須)に一致していることを型チェックで確認する。

- [ ] **Step 5: ビルドを実行する**

Run: `npm run build`
Expected: 成功

- [ ] **Step 6: コミット**

```bash
git add src/routes/game/shidasu/PlayArea.svelte
git commit -m "$(cat <<'EOF'
feat: 配布アニメーションを裏向き統一・着地時フリップ演出に変更

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: ブラウザでの動作確認

**Files:**
- なし(確認のみ)

- [ ] **Step 1: 開発サーバーを起動する**

Run: `npm run dev`(ポートが競合する場合は自動的に別ポートが割り当てられる。実際に使われたポート番号を確認すること)

- [ ] **Step 2: 月スプレッドでの配布を確認する**

ブラウザで`/game/shidasu`を開き、「月」スプレッドを選んでランを開始する。最初のWaveの配布アニメーションを観察し、以下を確認する。

1. 各列の奥側(裏向きになるべき`floor(rows/2)`枚)のカードが、山札から飛んでいる間も裏向きの見た目のまま移動すること
2. 手前側(表向きになるべき残りの枚数)のカードは、着地の瞬間にフリップ演出(裏→表の回転)が始まり、表向きになること
3. 奥側の裏向きカードは着地後もフリップせず、裏向きのまま表示され続けること

- [ ] **Step 3: 愚者・教皇スプレッドでの配布を確認する(回帰確認)**

「愚者」または「教皇」スプレッドを選んでランを開始し、配布される全カードが着地の瞬間にフリップ演出を経て表向きになることを確認する(月以外は全カード表向き想定のため、従来通りの見た目になるはず)。

- [ ] **Step 4: 妨害行動による再配布を確認する(回帰確認)**

`/admin/shidasu-debug`(`src/routes/admin/shidasu-debug/+page.svelte`、`PlayArea.svelte`を本編と共通で使うデバッグサンドボックス)を開き、`handleTriggerSabotage`に対応するボタンから「総戻し」または「一列戻し」の妨害行動を発生させる。再配布時、従来通り列の一番上のカードだけ着地後にフリップして表向きになり、それ以外は裏向きのまま留まることを確認する。

- [ ] **Step 5: 問題があれば修正する**

見た目上の問題(フリップのタイミングがずれる、裏向きのはずのカードが一瞬表向きに見える等)があれば修正し、Step 1〜4を再実行する。修正した場合は追加でコミットする(コミットメッセージは日本語)。

- [ ] **Step 6: 開発サーバーを停止する**

動作確認が完了したら`npm run dev`のプロセスを停止する。
