# currency.bossBonus未使用フィールドの削除 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ゲームロジックから一切参照されていない死んだ設定項目`currency.bossBonus`(小凶/中凶/大凶ボーナス)を、型定義・実データ・管理画面UIから削除する。

**Architecture:** `params.ts`(型定義+DEFAULT_PARAMS実データ)→`shidasu.config.json`(実データ)→`admin/shidasu-currency/+page.svelte`(UI+バリデーション)→`admin/+page.svelte`(一覧ページの説明文)の順に、依存の少ない箇所から段階的に削除する。

**Tech Stack:** SvelteKit, Svelte 5 runes, TypeScript, Vitest

---

### Task 1: params.tsからcurrency.bossBonusフィールドを削除

**Files:**
- Modify: `src/lib/game/shidasu/params.ts:53-63`(型定義)、`src/lib/game/shidasu/params.ts:271-277`(DEFAULT_PARAMS実データ)

- [ ] **Step 1: 型定義からbossBonusを削除**

`src/lib/game/shidasu/params.ts`の`ShidasuParams`型内、`currency`フィールドの定義を以下のように変更する。

変更前(53-63行目):
```ts
  currency: {
    name: string
    symbol: string
    initialAmount: number
    waveClearAmount: number
    bossBonus: {
      shoukyou: number
      chuukyou: number
      taikyou: number
    }
  }
```

変更後:
```ts
  currency: {
    name: string
    symbol: string
    initialAmount: number
    waveClearAmount: number
  }
```

- [ ] **Step 2: DEFAULT_PARAMS実データからbossBonusを削除**

同ファイルの`DEFAULT_PARAMS`内、`currency`実データを以下のように変更する。

変更前(271-277行目):
```ts
  currency: {
    name: '星片',
    symbol: '☆',
    initialAmount: 5,
    waveClearAmount: 5,
    bossBonus: { shoukyou: 5, chuukyou: 10, taikyou: 15 },
  },
```

変更後:
```ts
  currency: {
    name: '星片',
    symbol: '☆',
    initialAmount: 5,
    waveClearAmount: 5,
  },
```

- [ ] **Step 3: 型チェックを実行**

Run: `npm run check`
Expected: `shidasu.config.json`側にまだ`bossBonus`データが残っているため、`params.ts`の`shidasuConfigJson`を`ShidasuParams`型にキャストする箇所(434行目付近)で型エラーが出る。これはTask 2で解消される想定内のエラー。

- [ ] **Step 4: Commit**

```bash
git add src/lib/game/shidasu/params.ts
git commit -m "feat: params.tsからcurrency.bossBonusフィールドを削除"
```

---

### Task 2: shidasu.config.jsonからcurrency.bossBonusデータを削除

**Files:**
- Modify: `src/lib/game/shidasu/shidasu.config.json:117-127`

- [ ] **Step 1: bossBonusデータを削除**

`src/lib/game/shidasu/shidasu.config.json`の`currency`オブジェクトを以下のように変更する。

変更前(117-127行目):
```json
  "currency": {
    "name": "星片",
    "symbol": "☆",
    "initialAmount": 5,
    "waveClearAmount": 5,
    "bossBonus": {
      "shoukyou": 5,
      "chuukyou": 10,
      "taikyou": 15
    }
  },
```

変更後:
```json
  "currency": {
    "name": "星片",
    "symbol": "☆",
    "initialAmount": 5,
    "waveClearAmount": 5
  },
```

- [ ] **Step 2: 型チェックを実行**

Run: `npm run check`
Expected: shidasu関連のエラーが0件になること(`grep -i shidasu`で絞り込んで確認するとよい)。

- [ ] **Step 3: テストを実行**

Run: `npx vitest run`
Expected: 全件PASS(`currency.bossBonus`に依存するテストは存在しないため、影響なし)。

- [ ] **Step 4: Commit**

```bash
git add src/lib/game/shidasu/shidasu.config.json
git commit -m "feat: shidasu.config.jsonからcurrency.bossBonusデータを削除"
```

---

### Task 3: admin/shidasu-currency/+page.svelteからbossBonus UI・バリデーションを削除

**Files:**
- Modify: `src/routes/admin/shidasu-currency/+page.svelte:22-24`(バリデーション)、`src/routes/admin/shidasu-currency/+page.svelte:138-155`(UI+説明文)

- [ ] **Step 1: バリデーションチェックを削除**

`src/routes/admin/shidasu-currency/+page.svelte`の`hasValidationError`内から、以下の3行(22-24行目)を削除する。

削除対象:
```ts
    if (!Number.isFinite(config.currency.bossBonus.shoukyou) || config.currency.bossBonus.shoukyou < 0) return true
    if (!Number.isFinite(config.currency.bossBonus.chuukyou) || config.currency.bossBonus.chuukyou < 0) return true
    if (!Number.isFinite(config.currency.bossBonus.taikyou) || config.currency.bossBonus.taikyou < 0) return true
```

削除後、`waveClearAmount`のチェックの直後に`config.shop.itemPrice.C.buy`のチェックが続く形になる。

- [ ] **Step 2: 入力UI・説明文を削除**

同ファイルの138-155行目、以下のブロック全体(「小凶/中凶/大凶ボスボーナス」の3項目`<div class="grid grid-cols-3 gap-3">`と、直後の説明文`<p>`)を削除する。

削除対象:
```svelte
      <div class="grid grid-cols-3 gap-3">
        <label class="text-xs text-slate-500">
          小凶ボスボーナス
          <input type="number" step="1" bind:value={config.currency.bossBonus.shoukyou} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
        </label>
        <label class="text-xs text-slate-500">
          中凶ボスボーナス
          <input type="number" step="1" bind:value={config.currency.bossBonus.chuukyou} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
        </label>
        <label class="text-xs text-slate-500">
          大凶ボスボーナス
          <input type="number" step="1" bind:value={config.currency.bossBonus.taikyou} class="mt-1 w-full border border-slate-200 rounded px-2 py-1 text-sm" />
        </label>
      </div>

      <p class="text-xs text-slate-400">
        ボスボーナスはWaveクリア時の獲得数に加算されます(例: 小凶ボスWaveクリア時の獲得数 = Waveクリア時の獲得数 + 小凶ボスボーナス)。
      </p>
```

削除後、「Waveクリア時の獲得数」の`<label>`ブロックの直後に`</section>`が続く形になる(ショップ価格設定セクションの直前)。

- [ ] **Step 3: 型チェックを実行**

Run: `npm run check`
Expected: `admin/shidasu-currency/+page.svelte`起因のエラーが0件になること。

- [ ] **Step 4: Commit**

```bash
git add src/routes/admin/shidasu-currency/+page.svelte
git commit -m "feat: admin/shidasu-currencyからbossBonus入力UI・バリデーションを削除"
```

---

### Task 4: admin一覧ページの説明文を更新

**Files:**
- Modify: `src/routes/admin/+page.svelte:75`

- [ ] **Step 1: shidasu-currencyリンクの説明文を更新**

`src/routes/admin/+page.svelte`の`shidasu-currency`リンク内、75行目の`<p>`タグを以下のように変更する。

変更前:
```svelte
        <p class="text-xs text-slate-400 mt-0.5">通貨(星片)の名称・記号、初期所持数、Waveクリア獲得数、ボス階級別ボーナスの編集</p>
```

変更後:
```svelte
        <p class="text-xs text-slate-400 mt-0.5">通貨(星片)の名称・記号、初期所持数、Waveクリア獲得数の編集</p>
```

- [ ] **Step 2: Commit**

```bash
git add src/routes/admin/+page.svelte
git commit -m "docs: admin一覧のshidasu-currencyリンク説明文からボス階級別ボーナスの記述を削除"
```

---

### Task 5: 統合確認

**Files:** なし(確認のみ)

- [ ] **Step 1: 残存参照がないことを確認**

Run: `grep -rn "bossBonus" src/`
Expected: 出力なし(何も表示されない)。

- [ ] **Step 2: 全テストを実行**

Run: `npx vitest run`
Expected: 全ファイルPASS。

- [ ] **Step 3: ビルドを実行**

Run: `npm run build`
Expected: ビルド成功。

- [ ] **Step 4: 型チェックを実行**

Run: `npm run check`
Expected: shidasu関連のエラー0件(他ツールの既存エラーは無関係のため無視してよい)。

- [ ] **Step 5: 開発サーバーでブラウザ確認**

Run: `npm run dev`
確認項目:
- `/admin/shidasu-currency`から「小凶/中凶/大凶ボスボーナス」の入力欄・説明文が消えていること
- 名称・記号・初期所持数・Waveクリア獲得数・ショップ価格設定セクションの表示・保存・バリデーションが正常に動作すること
- `/admin`一覧ページの`shidasu-currency`説明文が「通貨(星片)の名称・記号、初期所持数、Waveクリア獲得数の編集」に更新されていること

---
