# 得点内訳パーツの拡大→移動演出 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 得点内訳行の表示順序を「内訳→合計」に反転し、各パーツを画面中央に2倍拡大表示してから内訳行へ移動させる演出を追加、あわせて合計値が更新されるたびに一瞬拡大する強調演出を加える。

**Architecture:** `PlayArea.svelte`内の既存の得点内訳アニメーション状態(`scoreReveal`)を拡張し、パーツ1件ごとに「中央拡大表示→内訳行へ移動」の2段階サブアニメーションを行う新しい状態(`partFlyIn`)を追加する。既存の`playingAnimation`/`scoreReveal`のフライ演出と同じ設計パターン(`position: fixed`オーバーレイ、`getBoundingClientRect`による座標計算、`setTimeout`+`$state`による段階制御)を踏襲する。「パーツが1つなら即時表示」という既存の例外は廃止し、常にこの演出を行う。

**Tech Stack:** SvelteKit / Svelte 5 runes(`$state`)、TypeScript、CSS transition

---

## 事前情報(実装者向け)

- 対象ファイルは`src/routes/game/shidasu/PlayArea.svelte`のみ。
- このタスクの直前の状態(現在のコード)は以下の通り(行番号は変更前のファイルを基準):
  - 76-99行目: 得点内訳アニメーションの定数・型・state宣言(`SCORE_PART_REVEAL_MS`, `ScoreRevealState`, `scoreReveal`, `displayedScore`, `scoreNumberEl`, `totalGainEl`, `scoreRevealTimer`)
  - 101-129行目: `startScoreReveal`関数(現状、パーツが1つだけなら`tick().then(() => startScoreFly())`で即座にフライへ進むショートカットがある)
  - 131-139行目: `revealNextScorePart`関数(280ms間隔でパーツを1つずつ`revealedCount`に反映するだけの単純な処理)
  - 141-174行目: `startScoreFly`/`finishScoreReveal`関数(SCORE欄への飛び込み演出、変更不要)
  - 273-293行目: 得点内訳の表示テンプレート(`{#if scoreReveal} ... {:else if wave.lastGain ...} ... {:else} ... {/if}`)
  - 431-436行目: SCORE飛び込みオーバーレイのテンプレート(変更不要)
- `revealNextScorePart`は今回のタスクで削除し、代わりに`startPartFlyIn`/`landPart`という2つの新しい関数に置き換える。
- 新しい`breakdownRowEl`という`bind:this`参照(内訳行のコンテナ要素)を追加する。これは中央拡大表示されたパーツテキストの「移動先」の座標計算に使う。
- 中央拡大表示の開始位置は画面中央固定(`window.innerWidth / 2`, `window.innerHeight / 2`)。移動先は`breakdownRowEl`の中心座標(`rect.left + rect.width / 2`, `rect.top + rect.height / 2`)。両方とも`transform: translate(-50%, -50%) scale(...)`で中心基準の位置決めを行う(要素の実際の幅が可変のため、中心座標を基準にして`-50%`シフトすることで正しく中央に配置される)。
- 1パーツあたりの演出時間は既存の`SCORE_PART_REVEAL_MS = 280`(ms)を維持しつつ、その内訳を「中央拡大表示150ms + 内訳行への移動130ms」の2段階に分割する。
- 合計値の強調(パルス)は、各パーツが内訳行に着地した瞬間に発生させる。既存の「ワープ」パターン(`transitionMs: 0`→2段rAF→`transitionMs`付きで変化)とは異なり、単純な「拡大状態(`transitionMs: 0`)→2段rAFで元のサイズへ戻す(`transitionMs`付き)」という順序で実装する。

---

### Task 1: 得点内訳パーツの拡大→移動演出と合計強調を実装する

**Files:**
- Modify: `src/routes/game/shidasu/PlayArea.svelte`

このタスクはUIコンポーネントの変更でありSvelteコンポーネントテストは書かず、ブラウザでの手動確認で動作を確かめる方針とする(既存の得点内訳アニメーション機能と同じ方針)。

- [ ] **Step 1: 定数・型・stateを更新する**

`src/routes/game/shidasu/PlayArea.svelte`の76-99行目(`const SCORE_PART_REVEAL_MS = 280`から`let scoreRevealTimer: ReturnType<typeof setTimeout> | undefined`まで)を、以下に置き換える:

```ts
  const PART_FLYIN_CENTER_MS = 150
  const PART_FLYIN_MOVE_MS = 130
  const PART_FLYIN_SCALE = 2
  const TOTAL_PULSE_SCALE = 1.3
  const TOTAL_PULSE_MS = 150
  const SCORE_FLY_UP_MS = 200
  const SCORE_FLY_TO_SCORE_MS = 250
  const SCORE_FLY_UP_DISTANCE_PX = 40
  const SCORE_FLY_UP_SCALE = 1.5

  interface ScoreRevealState {
    parts: ScorePart[]
    runningTotals: number[]
    revealedCount: number
    totalGain: number
    totalScale: number
    totalTransitionMs: number
    flyPhase: 'none' | 'up' | 'toScore'
    flyLeft: number
    flyTop: number
    flyScale: number
    flyTransitionMs: number
  }

  interface PartFlyInState {
    text: string
    phase: 'center' | 'toRow'
    left: number
    top: number
    scale: number
    transitionMs: number
  }

  let scoreReveal = $state<ScoreRevealState | null>(null)
  let partFlyIn = $state<PartFlyInState | null>(null)
  let displayedScore = $state(wave.score)
  let scoreNumberEl: HTMLDivElement | undefined = $state()
  let totalGainEl: HTMLSpanElement | undefined = $state()
  let breakdownRowEl: HTMLDivElement | undefined = $state()

  let scoreRevealTimer: ReturnType<typeof setTimeout> | undefined
```

(`SCORE_PART_REVEAL_MS`という定数は削除される。1パーツあたりの時間は`PART_FLYIN_CENTER_MS + PART_FLYIN_MOVE_MS`(150+130=280)で表現されるため)

- [ ] **Step 2: `startScoreReveal`・`revealNextScorePart`・`startScoreFly`・`finishScoreReveal`を更新する**

Step 1で置き換えたブロックの直後にある、`function startScoreReveal(...)`から`function finishScoreReveal() { ... }`まで(現在の101-174行目に相当する範囲)を、以下に置き換える:

```ts
  function startScoreReveal(lastGain: ScoreGain | null, lastBonusGains: BonusGain[]) {
    const allParts = [...(lastGain?.parts ?? []), ...lastBonusGains.flatMap(g => g.parts)]
    if (allParts.length === 0) {
      displayedScore = wave.score
      return
    }
    const runningTotals = runningTotalsFromScoreParts(allParts)
    const totalGain = (lastGain?.points ?? 0) + lastBonusGains.reduce((sum, g) => sum + g.points, 0)
    clearTimeout(scoreRevealTimer)
    scoreReveal = {
      parts: allParts,
      runningTotals,
      revealedCount: 0,
      totalGain,
      totalScale: 1,
      totalTransitionMs: 0,
      flyPhase: 'none',
      flyLeft: 0,
      flyTop: 0,
      flyScale: 1,
      flyTransitionMs: 0,
    }
    // 内訳行(breakdownRowEl)がDOMに描画されるのを待ってから、1つ目のパーツの拡大表示を開始する。
    // 直前のscoreReveal代入だけではSvelteの描画がまだ反映されていない可能性があるため、
    // tick()で描画反映を待つ(既存のカード移動アニメ・SCORE飛び込みアニメと同じ考え方)。
    tick().then(() => startPartFlyIn(0))
  }

  // index番目のパーツを、画面中央に拡大表示してから内訳行(breakdownRowEl)へ移動させる。
  function startPartFlyIn(index: number) {
    const part = scoreReveal?.parts[index]
    if (!scoreReveal || !part || !breakdownRowEl) {
      if (scoreReveal) landPart(index)
      return
    }
    partFlyIn = {
      text: part.text,
      phase: 'center',
      left: window.innerWidth / 2,
      top: window.innerHeight / 2,
      scale: PART_FLYIN_SCALE,
      transitionMs: 0,
    }
    scoreRevealTimer = setTimeout(() => {
      if (!partFlyIn || !breakdownRowEl) return
      const rowRect = breakdownRowEl.getBoundingClientRect()
      partFlyIn = {
        ...partFlyIn,
        phase: 'toRow',
        left: rowRect.left + rowRect.width / 2,
        top: rowRect.top + rowRect.height / 2,
        scale: 1,
        transitionMs: PART_FLYIN_MOVE_MS,
      }
      scoreRevealTimer = setTimeout(() => landPart(index), PART_FLYIN_MOVE_MS)
    }, PART_FLYIN_CENTER_MS)
  }

  // index番目のパーツを内訳行に確定表示し、合計値の強調(パルス)を行う。
  // 次のパーツがあれば続けてstartPartFlyInを呼び、無ければSCOREへの飛び込み演出へ進む。
  function landPart(index: number) {
    if (!scoreReveal) return
    partFlyIn = null
    scoreReveal = { ...scoreReveal, revealedCount: index + 1, totalScale: TOTAL_PULSE_SCALE, totalTransitionMs: 0 }
    // transitionMs:0でのスタイル変更をブラウザが実際に描画へ反映してから次のtransitionを開始するために
    // 2段rAFが必要。1段のrAFだけだと同一フレーム内でスタイル変更がバッチ処理され、
    // 拡大→元のサイズへの戻りがtransitionせず一瞬で切り替わってしまうブラウザがある。
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (!scoreReveal) return
        scoreReveal = { ...scoreReveal, totalScale: 1, totalTransitionMs: TOTAL_PULSE_MS }
      })
    })
    if (index + 1 < scoreReveal.parts.length) {
      startPartFlyIn(index + 1)
    } else {
      startScoreFly()
    }
  }

  function startScoreFly() {
    if (!scoreReveal || !totalGainEl || !scoreNumberEl) {
      finishScoreReveal()
      return
    }
    const fromRect = totalGainEl.getBoundingClientRect()
    const toRect = scoreNumberEl.getBoundingClientRect()
    scoreReveal = { ...scoreReveal, flyPhase: 'up', flyLeft: fromRect.left, flyTop: fromRect.top, flyScale: 1, flyTransitionMs: 0 }
    // transitionMs:0でのスタイル変更をブラウザが実際に描画へ反映してから次のtransitionを開始するために
    // 2段rAFが必要。1段のrAFだけだと同一フレーム内でスタイル変更がバッチ処理され、transitionが
    // 発生しないブラウザがある(カード移動アニメのワープ処理と同じ理由)。
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (!scoreReveal) return
        scoreReveal = {
          ...scoreReveal,
          flyLeft: fromRect.left,
          flyTop: fromRect.top - SCORE_FLY_UP_DISTANCE_PX,
          flyScale: SCORE_FLY_UP_SCALE,
          flyTransitionMs: SCORE_FLY_UP_MS,
        }
      })
    })
    scoreRevealTimer = setTimeout(() => {
      if (!scoreReveal) return
      scoreReveal = { ...scoreReveal, flyPhase: 'toScore', flyLeft: toRect.left, flyTop: toRect.top, flyScale: 1, flyTransitionMs: SCORE_FLY_TO_SCORE_MS }
      scoreRevealTimer = setTimeout(finishScoreReveal, SCORE_FLY_TO_SCORE_MS)
    }, SCORE_FLY_UP_MS)
  }

  function finishScoreReveal() {
    displayedScore = wave.score
    scoreReveal = null
  }
```

- [ ] **Step 3: 得点内訳の表示テンプレートを、順序反転+パルス演出対応に変更する**

現在の得点内訳表示ブロック(`{#if scoreReveal} ... {:else if wave.lastGain || wave.lastBonusGains.length > 0} ... {:else} ... {/if}`、現在の273-293行目に相当)を、以下に置き換える:

```svelte
  {#if scoreReveal}
    {@const isLastLanded = scoreReveal.revealedCount === scoreReveal.parts.length}
    {@const currentTotal = scoreReveal.revealedCount === 0
      ? 0
      : isLastLanded
        ? Math.floor(scoreReveal.runningTotals[scoreReveal.revealedCount - 1])
        : Math.round(scoreReveal.runningTotals[scoreReveal.revealedCount - 1])}
    <div bind:this={breakdownRowEl} class="flex items-center justify-between text-sm h-5">
      <span class="text-emerald-200 text-xs">{scoreReveal.parts.slice(0, scoreReveal.revealedCount).map(p => p.text).join(' ')}</span>
      <span
        bind:this={totalGainEl}
        class="text-yellow-300 font-black inline-block ease-out"
        style="transform: scale({scoreReveal.totalScale}); transition-property: transform; transition-duration:{scoreReveal.totalTransitionMs}ms;"
      >+{currentTotal}</span>
    </div>
  {:else if wave.lastGain || wave.lastBonusGains.length > 0}
    {@const totalPoints = (wave.lastGain?.points ?? 0) + wave.lastBonusGains.reduce((sum, g) => sum + g.points, 0)}
    {@const allParts = [...(wave.lastGain?.parts ?? []), ...wave.lastBonusGains.flatMap(g => g.parts)]}
    <div class="flex items-center justify-between text-sm h-5">
      {#if allParts.length > 0}
        <span class="text-emerald-200 text-xs">{allParts.map(p => p.text).join(' ')}</span>
      {:else}
        <span></span>
      {/if}
      <span class="text-yellow-300 font-black">+{totalPoints}</span>
    </div>
  {:else}
    <div class="h-5"></div>
  {/if}
```

注意: `totalGainEl`の`bind:this`は、これまで「+合計」の`<span>`に付いていたものと同じ役割で、位置が変わっただけ(左→右)。`startScoreFly`関数の`totalGainEl.getBoundingClientRect()`はこの新しい位置を正しく参照する。

静的フォールバック分岐(`{:else if wave.lastGain ...}`)でも、内訳が空(`allParts.length === 0`)の場合に`justify-between`のレイアウトが崩れないよう、空の`<span></span>`を明示的に置いている。

- [ ] **Step 4: パーツの拡大→移動オーバーレイを追加する**

ファイル末尾、SCORE飛び込みオーバーレイ(`{#if scoreReveal && scoreReveal.flyPhase !== 'none'} ... {/if}`、現在の431-436行目)の直後に、以下を追加する:

```svelte
{#if partFlyIn}
  <div
    class="fixed pointer-events-none z-[110] ease-out text-emerald-200 text-sm font-bold"
    style="left:{partFlyIn.left}px; top:{partFlyIn.top}px; transform: translate(-50%, -50%) scale({partFlyIn.scale}); transition-property: left, top, transform; transition-duration:{partFlyIn.transitionMs}ms;"
  >{partFlyIn.text}</div>
{/if}
```

`z-[110]`はSCORE飛び込みオーバーレイ(`z-[100]`)より手前に表示するための値。

- [ ] **Step 5: 型チェックを実行する**

Run: `npm run check`
Expected: `PlayArea.svelte`に関するエラーが0件(既存の無関係な警告・他ファイルのエラーは無視してよい)

- [ ] **Step 6: コミット**

```bash
git add src/routes/game/shidasu/PlayArea.svelte
git commit -m "feat: 得点内訳パーツの拡大→移動演出と合計値の強調アニメーションを追加"
```

---

### Task 2: ビルド・型チェック・ブラウザでの動作確認

**Files:** なし(検証のみ)

- [ ] **Step 1: 全体ビルドを実行する**

Run: `npm run build`
Expected: `✓ built` で成功終了

- [ ] **Step 2: 型チェックを実行する**

Run: `npm run check`
Expected: shidasuディレクトリ関連のエラー0件(他ツールの既存エラー・警告は無視)

- [ ] **Step 3: 全体のユニットテストを実行する**

Run: `npx vitest run src/lib/game/shidasu`
Expected: 全件PASS(このタスクではロジック側のテストは変更していないため、既存件数のまま通ること)

- [ ] **Step 4: devサーバーを起動しブラウザで確認する**

Run: `npm run dev`

`http://localhost:5173/game/shidasu` を開き、以下を確認する:
- 得点内訳行が「内訳テキスト(左) +合計(右)」の順で表示されること(以前の「+合計(左) 内訳(右)」から反転していること)
- パターン・役・護符ボーナスが複数発生するプレイをして、各パーツが画面中央に大きく(2倍)拡大表示された後、内訳行の位置へ縮小しながら移動し、到達した瞬間に内訳行のテキストとして確定表示されること
- パーツが確定表示されるたびに、右側の「+合計」の数字が一瞬拡大してから元のサイズに戻る強調演出が起きること
- パターン・役が一切発生しない地味なプレイ(基礎点のみ、パーツ1つ)でも、同様に中央拡大→移動の演出が1回行われること(以前の「パーツ1つなら即時表示」というスキップが無くなっていること)
- 全パーツの表示が終わった後、既存の「+合計がSCORE欄へ飛び込む」演出がこれまで通り動作すること
- 得点内訳アニメーション中(パーツの拡大→移動、SCOREへの飛び込みを含む全体)は場札・山札・秘儀・天啓のいずれもクリックできないこと(既存の`scoreReveal !== null`によるロックが今回のリファクタでも維持されていること)
- 山札をめくって得点が発生した場合(パターン継続時)は、従来通り即座に内訳が表示される静的な見た目のままであること(中央拡大アニメは発生しない)
- 複数回連続でプレイしても、アニメーションや表示が壊れずに繰り返し動作すること

- [ ] **Step 5: 問題があれば修正し、再度Step 1-4を実行する。問題なければ完了**

---

## Self-Review メモ(実装者は読み飛ばしてよい)

- spec要件「1. 内訳行の表示順序を反転する」は Task 1 Step 3 でカバーしている(scoreReveal駆動・静的フォールバックの両方の分岐で反転させている。spec本文は主にscoreReveal駆動の場合を指しているが、一貫性のため静的フォールバックも合わせて反転させた)。
- spec要件「2. パーツごとの拡大→移動演出」「対象範囲: 常にこの演出を行う(1パーツでも省略しない)」は Task 1 Step 1・Step 2 の`startScoreReveal`(ショートカット分岐を削除)、`startPartFlyIn`/`landPart`でカバーしている。
- spec要件「タイミング: 280msを拡大表示+移動の合計に充てる」は`PART_FLYIN_CENTER_MS = 150`・`PART_FLYIN_MOVE_MS = 130`(合計280)でカバーしている。
- spec要件「3. 合計加点数の強調アニメーション、パーツが1つでも1回発生」は Task 1 Step 2 の`landPart`内の`totalScale`/`totalTransitionMs`制御でカバーしている(`landPart`は必ず呼ばれるため、パーツ数に関わらず毎回発生する)。
- spec要件「4. 既存のSCOREへの飛び込みアニメーションは変更しない」は Task 1 Step 2 の`startScoreFly`/`finishScoreReveal`を変更前と同一のロジックのまま維持することでカバーしている。
- spec要件「除外・非対象: 山札めくり経由は対象外」は、`startPartFlyIn`/`landPart`が`startScoreReveal`経由(=`onPlayCard`の戻り値からのみ)呼ばれる既存の設計をそのまま維持しているため、山札めくり由来の得点は引き続き静的フォールバック分岐(`{:else if wave.lastGain ...}`)のまま変わらない。
