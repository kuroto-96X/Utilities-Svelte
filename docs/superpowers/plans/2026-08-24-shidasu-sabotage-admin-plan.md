# 妨害行動一覧のadmin編集画面 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 妨害行動32種類の`name`・`intervalTurns`・`descTemplate`を`params.ts`/`shidasu.config.json`側で管理する形に移行し、`/admin/shidasu-sabotage`から編集・保存できるようにする。

**Architecture:** `sabotage.ts`の`SABOTAGE_POOL`を`SabotageActionDef[]`(全フィールド持ち)から`SabotageActionId[]`(idのみ)に変更し、実データは`ShidasuParams.sabotageActions`(レリック等と同じ管理方式)に移す。`rollSabotage`に`params`引数を追加し、`sabotageActionName`/`sabotageActionDesc`ヘルパーを新設。呼び出し元(`engine.ts`・`+page.svelte`・admin debugページ)をこれらのヘルパー経由に更新した上で、`shidasu-relics`と同型の新規admin画面を追加する。

**Tech Stack:** SvelteKit, Svelte 5 runes, TypeScript, Vitest

---

### Task 1: params.ts・shidasu.config.json — `sabotageActions`データの追加

**Files:**
- Modify: `src/lib/game/shidasu/params.ts:242-257`(`ShidasuParams`インターフェース、`relics`の直後に追加)
- Modify: `src/lib/game/shidasu/params.ts:511-526`(`DEFAULT_PARAMS`、`relics`の直後に追加)
- Modify: `src/lib/game/shidasu/shidasu.config.json:1334-1335`(`relics`の直後に追加)

- [ ] **Step 1: `ShidasuParams`インターフェースに`sabotageActions`フィールドを追加する**

`src/lib/game/shidasu/params.ts:242-257`の:
```ts
  relics: {
    manekiNeko: { name: string; desc: string; tsukumokaDesc: string; price: number; discountPercent: number; tsukumokaDiscountPercent: number }
    fukuDaruma: { name: string; desc: string; tsukumokaDesc: string; price: number; n: number }
    kumade: { name: string; desc: string; tsukumokaDesc: string; price: number; n: number }
    juzu: { name: string; desc: string; tsukumokaDesc: string; price: number; n: number; tsukumokaN: number }
    manekiHoteizo: { name: string; desc: string; tsukumokaDesc: string; price: number; n: number; tsukumokaN: number }
    hamaya: { name: string; desc: string; tsukumokaDesc: string; price: number; n: number; tsukumokaN: number }
    senbazuru: { name: string; desc: string; tsukumokaDesc: string; price: number; n: number; tsukumokaN: number }
    fukuzasa: { name: string; desc: string; tsukumokaDesc: string; price: number; n: number }
    kaiunKokeshi: { name: string; desc: string; tsukumokaDesc: string; price: number; sellBonusPercent: number; tsukumokaSellBonusPercent: number }
    engiKozuchi: { name: string; desc: string; tsukumokaDesc: string; price: number; n: number; tsukumokaN: number }
    engiSuzu: { name: string; desc: string; tsukumokaDesc: string; price: number; n: number; tsukumokaN: number }
    senjafuda: { name: string; desc: string; tsukumokaDesc: string; price: number; n: number }
    soroban: { name: string; desc: string; tsukumokaDesc: string; price: number; n: number }
  }
  flow: {
```
を:
```ts
  relics: {
    manekiNeko: { name: string; desc: string; tsukumokaDesc: string; price: number; discountPercent: number; tsukumokaDiscountPercent: number }
    fukuDaruma: { name: string; desc: string; tsukumokaDesc: string; price: number; n: number }
    kumade: { name: string; desc: string; tsukumokaDesc: string; price: number; n: number }
    juzu: { name: string; desc: string; tsukumokaDesc: string; price: number; n: number; tsukumokaN: number }
    manekiHoteizo: { name: string; desc: string; tsukumokaDesc: string; price: number; n: number; tsukumokaN: number }
    hamaya: { name: string; desc: string; tsukumokaDesc: string; price: number; n: number; tsukumokaN: number }
    senbazuru: { name: string; desc: string; tsukumokaDesc: string; price: number; n: number; tsukumokaN: number }
    fukuzasa: { name: string; desc: string; tsukumokaDesc: string; price: number; n: number }
    kaiunKokeshi: { name: string; desc: string; tsukumokaDesc: string; price: number; sellBonusPercent: number; tsukumokaSellBonusPercent: number }
    engiKozuchi: { name: string; desc: string; tsukumokaDesc: string; price: number; n: number; tsukumokaN: number }
    engiSuzu: { name: string; desc: string; tsukumokaDesc: string; price: number; n: number; tsukumokaN: number }
    senjafuda: { name: string; desc: string; tsukumokaDesc: string; price: number; n: number }
    soroban: { name: string; desc: string; tsukumokaDesc: string; price: number; n: number }
  }
  // 妨害行動32種の可変フィールド。idは固定(SabotageActionId、sabotage.tsのSABOTAGE_POOLで列挙)。
  // targetは対象カテゴリのラベル(admin画面では読み取り専用表示、編集対象は name/intervalTurns/descTemplate)。
  sabotageActions: Record<SabotageActionId, { name: string; target: string; intervalTurns: number; descTemplate: string }>
  flow: {
```
に変更する。

- [ ] **Step 2: `import type`に`SabotageActionId`を追加する**

`src/lib/game/shidasu/params.ts:3`の:
```ts
import type { Rarity, PackCatalogEntry } from './types'
```
を:
```ts
import type { Rarity, PackCatalogEntry, SabotageActionId } from './types'
```
に変更する。

- [ ] **Step 3: `DEFAULT_PARAMS`に`sabotageActions`の実値を追加する**

`src/lib/game/shidasu/params.ts:524-526`の:
```ts
    soroban: { name: '算盤', desc: 'Waveクリア時、山札の消費割合に応じて追加報酬(floor(((c-b-a)/(c-b))×{n})、a=残り山札枚数,b=初期配布枚数,c=デッキ総枚数)を得る', tsukumokaDesc: 'Waveクリア時、山札の消費割合に応じて追加報酬(floor(((c-b-a)/(c-b))×10)、a=残り山札枚数,b=初期配布枚数,c=デッキ総枚数)を得る(付喪化によりn=10に強化)', price: 20, n: 5 },
  },
  flow: { wavesPerStage: 3, clearDelayMs: 450, stageTargetBase: 2000, stageTargetMultiplier: 1.8, stagesPerRun: 8, rerollCost: 30 },
```
を:
```ts
    soroban: { name: '算盤', desc: 'Waveクリア時、山札の消費割合に応じて追加報酬(floor(((c-b-a)/(c-b))×{n})、a=残り山札枚数,b=初期配布枚数,c=デッキ総枚数)を得る', tsukumokaDesc: 'Waveクリア時、山札の消費割合に応じて追加報酬(floor(((c-b-a)/(c-b))×10)、a=残り山札枚数,b=初期配布枚数,c=デッキ総枚数)を得る(付喪化によりn=10に強化)', price: 20, n: 5 },
  },
  sabotageActions: {
    stockPurge: { name: '大量放出', target: '山札', intervalTurns: 6, descTemplate: '山札の上から5枚を捨て札に置く' },
    columnReturn: { name: '一列戻し', target: '場札', intervalTurns: 6, descTemplate: 'ランダムな1列を山札に戻し、シャッフル後同じ列に裏向きで再配布する' },
    chainSettle: { name: '強制清算', target: 'チェーン', intervalTurns: 8, descTemplate: 'チェーンを全て捨て札に送り、山札から1枚めくって新しいチェーンにする。コンボも0にする' },
    comboBreather: { name: '強制小休止', target: 'コンボ', intervalTurns: 5, descTemplate: 'チェーンはそのまま、コンボ数だけ0にする' },
    talismanSeal: { name: '護符封印', target: '護符', intervalTurns: 5, descTemplate: '所持護符を1つ選び、次の妨害発動まで効果を無効化する' },
    riteSeal: { name: '秘儀封印', target: '秘儀', intervalTurns: 5, descTemplate: '所持秘儀を1つ選び、次の妨害発動まで使用を禁止する' },
    revelationOracleSeal: { name: '天啓・神託封印', target: '天啓・神託', intervalTurns: 5, descTemplate: '天啓または神託を1つ選び、次の妨害発動まで使用禁止にする' },
    relicConfiscate: { name: 'レリック没収', target: 'レリック', intervalTurns: 7, descTemplate: '所持レリックを1つ選び、完全に失わせる' },
    tableauCardToDiscard: { name: '一枚没収', target: '捨て札', intervalTurns: 4, descTemplate: '場札からランダムに1枚選び捨て札に送る' },
    currencyConfiscate: { name: '通貨没収', target: '資産(星片)', intervalTurns: 6, descTemplate: '所持する星片を5減らす' },
    roleSeal: { name: '役封印', target: '役ステータス', intervalTurns: 6, descTemplate: 'ランダムな2役を選び、次の妨害発動までそれらのボーナスを無効化する' },
    stockPurgeSmall: { name: '少量放出', target: '山札', intervalTurns: 4, descTemplate: '山札の上から2枚を捨て札に置く' },
    stockShuffle: { name: '山札攪拌', target: '山札', intervalTurns: 5, descTemplate: '山札の順序をランダムに並び替える(枚数は変わらない)' },
    tableauFullReturn: { name: '総戻し', target: '場札', intervalTurns: 8, descTemplate: '場札全体を山札に戻し、シャッフル後同じ配分で再配布する' },
    tableauShuffle: { name: '総入れ替え', target: '場札', intervalTurns: 6, descTemplate: '場札の中身を列をまたいでランダムに再配置する(山札には触れない)' },
    chainPartialDiscard: { name: 'チェーン部分放棄', target: 'チェーン', intervalTurns: 5, descTemplate: 'チェーンの先頭(最古)から2枚を捨て札に送る(コンボはそのまま維持)' },
    chainShuffle: { name: 'チェーン入れ替え', target: 'チェーン', intervalTurns: 6, descTemplate: 'チェーンをシャッフルし、新しい末尾を基準カードにする' },
    comboReduce: { name: 'コンボ削減', target: 'コンボ', intervalTurns: 5, descTemplate: 'コンボ数を3減らす(0未満にはしない)' },
    comboCap: { name: 'コンボ頭打ち', target: 'コンボ', intervalTurns: 6, descTemplate: '発動時点のコンボ数を上限として、次の妨害発動まで増加を止める' },
    talismanConfiscate: { name: '護符没収', target: '護符', intervalTurns: 7, descTemplate: '所持護符を1つ選び、完全に失わせる' },
    riteConfiscate: { name: '秘儀没収', target: '秘儀', intervalTurns: 6, descTemplate: '所持秘儀を1つ選び、効果を発動させずに消費させる' },
    riteForceActivate: { name: '秘儀強制発動', target: '秘儀', intervalTurns: 6, descTemplate: '使用可能な秘儀を1つ選び、即座に効果を発動させて消費する' },
    talismanShuffle: { name: '護符並び替え', target: '護符', intervalTurns: 5, descTemplate: '所持護符の並び順をランダムにシャッフルし、次の妨害発動まで護符を裏向き表示にする' },
    revelationOracleConfiscate: { name: '天啓・神託没収', target: '天啓・神託', intervalTurns: 7, descTemplate: '所持している天啓または神託からランダムに1つ選び、完全に失わせる' },
    revelationOracleForceActivate: { name: '天啓・神託強制発動', target: '天啓・神託', intervalTurns: 6, descTemplate: '使用可能な天啓または所持神託からランダムに1つ選び、即座に効果を発動させて消費する' },
    tsukumokaRelease: { name: '付喪化解除', target: 'レリック', intervalTurns: 6, descTemplate: '付喪化済みレリックがあればランダムに1つ選び、未付喪化状態に戻す' },
    discardErase: { name: '捨て札消去', target: '捨て札', intervalTurns: 6, descTemplate: 'チェーンのカードを捨て札に送り、捨て札全体をシャッフルしてから同じ枚数をチェーンに戻す' },
    discardBury: { name: '捨て札埋没', target: '捨て札', intervalTurns: 5, descTemplate: '捨て札の中身を山札に戻し混ぜ込み、同じ枚数を山札から裏向きで捨て札に移す' },
    rewardReduce: { name: '報酬減少', target: '資産(星片)', intervalTurns: 8, descTemplate: 'Waveクリア時の通貨報酬を-2する(複数回発動した場合は累積する)' },
    currencyDrain: { name: '通貨強制消費', target: '資産(星片)', intervalTurns: 6, descTemplate: '所持通貨の20%を失わせる' },
    roleLevelDecay: { name: '役減衰', target: '役ステータス', intervalTurns: 7, descTemplate: 'ランダムな2役を選び、oracleLevelを1下げる(下限1、永続的なマイナス)' },
    roleBias: { name: '役偏重', target: '役ステータス', intervalTurns: 6, descTemplate: '次の妨害発動まで、全役を半分ずつ2グループに分け、一方を2倍、他方を1/2倍にする' },
  },
  flow: { wavesPerStage: 3, clearDelayMs: 450, stageTargetBase: 2000, stageTargetMultiplier: 1.8, stagesPerRun: 8, rerollCost: 30 },
```
に変更する(`soroban`エントリ自体・`flow`の内容は変更しない、間に`sabotageActions`ブロックを挿入するだけ)。

- [ ] **Step 4: `shidasu.config.json`に`sabotageActions`セクションを追加する**

`src/lib/game/shidasu/shidasu.config.json:1327-1335`の:
```json
    "soroban": {
      "name": "算盤",
      "desc": "Waveクリア時、山札の消費割合に応じて追加報酬(floor(((c-b-a)/(c-b))×{n})、a=残り山札枚数,b=初期配布枚数,c=デッキ総枚数)を得る",
      "tsukumokaDesc": "Waveクリア時、山札の消費割合に応じて追加報酬(floor(((c-b-a)/(c-b))×10)、a=残り山札枚数,b=初期配布枚数,c=デッキ総枚数)を得る(付喪化によりn=10に強化)",
      "price": 20,
      "n": 5
    }
  },
  "flow": {
```
を:
```json
    "soroban": {
      "name": "算盤",
      "desc": "Waveクリア時、山札の消費割合に応じて追加報酬(floor(((c-b-a)/(c-b))×{n})、a=残り山札枚数,b=初期配布枚数,c=デッキ総枚数)を得る",
      "tsukumokaDesc": "Waveクリア時、山札の消費割合に応じて追加報酬(floor(((c-b-a)/(c-b))×10)、a=残り山札枚数,b=初期配布枚数,c=デッキ総枚数)を得る(付喪化によりn=10に強化)",
      "price": 20,
      "n": 5
    }
  },
  "sabotageActions": {
    "stockPurge": { "name": "大量放出", "target": "山札", "intervalTurns": 6, "descTemplate": "山札の上から5枚を捨て札に置く" },
    "columnReturn": { "name": "一列戻し", "target": "場札", "intervalTurns": 6, "descTemplate": "ランダムな1列を山札に戻し、シャッフル後同じ列に裏向きで再配布する" },
    "chainSettle": { "name": "強制清算", "target": "チェーン", "intervalTurns": 8, "descTemplate": "チェーンを全て捨て札に送り、山札から1枚めくって新しいチェーンにする。コンボも0にする" },
    "comboBreather": { "name": "強制小休止", "target": "コンボ", "intervalTurns": 5, "descTemplate": "チェーンはそのまま、コンボ数だけ0にする" },
    "talismanSeal": { "name": "護符封印", "target": "護符", "intervalTurns": 5, "descTemplate": "所持護符を1つ選び、次の妨害発動まで効果を無効化する" },
    "riteSeal": { "name": "秘儀封印", "target": "秘儀", "intervalTurns": 5, "descTemplate": "所持秘儀を1つ選び、次の妨害発動まで使用を禁止する" },
    "revelationOracleSeal": { "name": "天啓・神託封印", "target": "天啓・神託", "intervalTurns": 5, "descTemplate": "天啓または神託を1つ選び、次の妨害発動まで使用禁止にする" },
    "relicConfiscate": { "name": "レリック没収", "target": "レリック", "intervalTurns": 7, "descTemplate": "所持レリックを1つ選び、完全に失わせる" },
    "tableauCardToDiscard": { "name": "一枚没収", "target": "捨て札", "intervalTurns": 4, "descTemplate": "場札からランダムに1枚選び捨て札に送る" },
    "currencyConfiscate": { "name": "通貨没収", "target": "資産(星片)", "intervalTurns": 6, "descTemplate": "所持する星片を5減らす" },
    "roleSeal": { "name": "役封印", "target": "役ステータス", "intervalTurns": 6, "descTemplate": "ランダムな2役を選び、次の妨害発動までそれらのボーナスを無効化する" },
    "stockPurgeSmall": { "name": "少量放出", "target": "山札", "intervalTurns": 4, "descTemplate": "山札の上から2枚を捨て札に置く" },
    "stockShuffle": { "name": "山札攪拌", "target": "山札", "intervalTurns": 5, "descTemplate": "山札の順序をランダムに並び替える(枚数は変わらない)" },
    "tableauFullReturn": { "name": "総戻し", "target": "場札", "intervalTurns": 8, "descTemplate": "場札全体を山札に戻し、シャッフル後同じ配分で再配布する" },
    "tableauShuffle": { "name": "総入れ替え", "target": "場札", "intervalTurns": 6, "descTemplate": "場札の中身を列をまたいでランダムに再配置する(山札には触れない)" },
    "chainPartialDiscard": { "name": "チェーン部分放棄", "target": "チェーン", "intervalTurns": 5, "descTemplate": "チェーンの先頭(最古)から2枚を捨て札に送る(コンボはそのまま維持)" },
    "chainShuffle": { "name": "チェーン入れ替え", "target": "チェーン", "intervalTurns": 6, "descTemplate": "チェーンをシャッフルし、新しい末尾を基準カードにする" },
    "comboReduce": { "name": "コンボ削減", "target": "コンボ", "intervalTurns": 5, "descTemplate": "コンボ数を3減らす(0未満にはしない)" },
    "comboCap": { "name": "コンボ頭打ち", "target": "コンボ", "intervalTurns": 6, "descTemplate": "発動時点のコンボ数を上限として、次の妨害発動まで増加を止める" },
    "talismanConfiscate": { "name": "護符没収", "target": "護符", "intervalTurns": 7, "descTemplate": "所持護符を1つ選び、完全に失わせる" },
    "riteConfiscate": { "name": "秘儀没収", "target": "秘儀", "intervalTurns": 6, "descTemplate": "所持秘儀を1つ選び、効果を発動させずに消費させる" },
    "riteForceActivate": { "name": "秘儀強制発動", "target": "秘儀", "intervalTurns": 6, "descTemplate": "使用可能な秘儀を1つ選び、即座に効果を発動させて消費する" },
    "talismanShuffle": { "name": "護符並び替え", "target": "護符", "intervalTurns": 5, "descTemplate": "所持護符の並び順をランダムにシャッフルし、次の妨害発動まで護符を裏向き表示にする" },
    "revelationOracleConfiscate": { "name": "天啓・神託没収", "target": "天啓・神託", "intervalTurns": 7, "descTemplate": "所持している天啓または神託からランダムに1つ選び、完全に失わせる" },
    "revelationOracleForceActivate": { "name": "天啓・神託強制発動", "target": "天啓・神託", "intervalTurns": 6, "descTemplate": "使用可能な天啓または所持神託からランダムに1つ選び、即座に効果を発動させて消費する" },
    "tsukumokaRelease": { "name": "付喪化解除", "target": "レリック", "intervalTurns": 6, "descTemplate": "付喪化済みレリックがあればランダムに1つ選び、未付喪化状態に戻す" },
    "discardErase": { "name": "捨て札消去", "target": "捨て札", "intervalTurns": 6, "descTemplate": "チェーンのカードを捨て札に送り、捨て札全体をシャッフルしてから同じ枚数をチェーンに戻す" },
    "discardBury": { "name": "捨て札埋没", "target": "捨て札", "intervalTurns": 5, "descTemplate": "捨て札の中身を山札に戻し混ぜ込み、同じ枚数を山札から裏向きで捨て札に移す" },
    "rewardReduce": { "name": "報酬減少", "target": "資産(星片)", "intervalTurns": 8, "descTemplate": "Waveクリア時の通貨報酬を-2する(複数回発動した場合は累積する)" },
    "currencyDrain": { "name": "通貨強制消費", "target": "資産(星片)", "intervalTurns": 6, "descTemplate": "所持通貨の20%を失わせる" },
    "roleLevelDecay": { "name": "役減衰", "target": "役ステータス", "intervalTurns": 7, "descTemplate": "ランダムな2役を選び、oracleLevelを1下げる(下限1、永続的なマイナス)" },
    "roleBias": { "name": "役偏重", "target": "役ステータス", "intervalTurns": 6, "descTemplate": "次の妨害発動まで、全役を半分ずつ2グループに分け、一方を2倍、他方を1/2倍にする" }
  },
  "flow": {
```
に変更する(JSON構文のため各行末のカンマ位置に注意し、最後の`roleBias`エントリの後にはカンマを付けないこと)。

- [ ] **Step 5: 型チェック**

`npm run check`を実行し、`params.ts`自体にエラーが無いことを確認する(`sabotage.ts`・その他呼び出し元はまだ未対応のためエラーが出るのは想定内、後続タスクで解消する)。

- [ ] **Step 6: コミット**

```bash
git add src/lib/game/shidasu/params.ts src/lib/game/shidasu/shidasu.config.json
git commit -m "$(cat <<'EOF'
feat: 妨害行動のname・intervalTurns・descTemplateをparams.ts/config.json管理に移行
EOF
)"
```

---

### Task 2: sabotage.ts — `SABOTAGE_POOL`のリファクタとヘルパー関数追加

**Files:**
- Modify: `src/lib/game/shidasu/sabotage.ts`

- [ ] **Step 1: `import`に`ShidasuParams`を追加する**

`src/lib/game/shidasu/sabotage.ts:2`の:
```ts
import type { SabotageActionId, StarSabotage } from './types'
```
を:
```ts
import type { SabotageActionId, StarSabotage } from './types'
import type { ShidasuParams } from './params'
```
に変更する。

- [ ] **Step 2: `SABOTAGE_POOL`を`SabotageActionId[]`に変更する**

`src/lib/game/shidasu/sabotage.ts:4-47`の:
```ts
export interface SabotageActionDef {
  id: SabotageActionId
  name: string
  target: string
  intervalTurns: number
  descTemplate: string
}

// 妨害行動プール。32件(先行実装11個+Phase A 11個+Phase B 10個)。詳細はdocs/shidasu/shidasu-star-sabotage-candidates.mdを参照。
// intervalTurnsは初期値の目安(効果が強い・永続的なものほど長め)。数値調整はこの配列を直接編集する。
export const SABOTAGE_POOL: SabotageActionDef[] = [
  { id: 'stockPurge', name: '大量放出', target: '山札', intervalTurns: 6, descTemplate: '山札の上から5枚を捨て札に置く' },
  { id: 'columnReturn', name: '一列戻し', target: '場札', intervalTurns: 6, descTemplate: 'ランダムな1列を山札に戻し、シャッフル後同じ列に裏向きで再配布する' },
  { id: 'chainSettle', name: '強制清算', target: 'チェーン', intervalTurns: 8, descTemplate: 'チェーンを全て捨て札に送り、山札から1枚めくって新しいチェーンにする。コンボも0にする' },
  { id: 'comboBreather', name: '強制小休止', target: 'コンボ', intervalTurns: 5, descTemplate: 'チェーンはそのまま、コンボ数だけ0にする' },
  { id: 'talismanSeal', name: '護符封印', target: '護符', intervalTurns: 5, descTemplate: '所持護符を1つ選び、次の妨害発動まで効果を無効化する' },
  { id: 'riteSeal', name: '秘儀封印', target: '秘儀', intervalTurns: 5, descTemplate: '所持秘儀を1つ選び、次の妨害発動まで使用を禁止する' },
  { id: 'revelationOracleSeal', name: '天啓・神託封印', target: '天啓・神託', intervalTurns: 5, descTemplate: '天啓または神託を1つ選び、次の妨害発動まで使用禁止にする' },
  { id: 'relicConfiscate', name: 'レリック没収', target: 'レリック', intervalTurns: 7, descTemplate: '所持レリックを1つ選び、完全に失わせる' },
  { id: 'tableauCardToDiscard', name: '一枚没収', target: '捨て札', intervalTurns: 4, descTemplate: '場札からランダムに1枚選び捨て札に送る' },
  { id: 'currencyConfiscate', name: '通貨没収', target: '資産(星片)', intervalTurns: 6, descTemplate: '所持する星片を5減らす' },
  { id: 'roleSeal', name: '役封印', target: '役ステータス', intervalTurns: 6, descTemplate: 'ランダムな2役を選び、次の妨害発動までそれらのボーナスを無効化する' },
  { id: 'stockPurgeSmall', name: '少量放出', target: '山札', intervalTurns: 4, descTemplate: '山札の上から2枚を捨て札に置く' },
  { id: 'stockShuffle', name: '山札攪拌', target: '山札', intervalTurns: 5, descTemplate: '山札の順序をランダムに並び替える(枚数は変わらない)' },
  { id: 'tableauFullReturn', name: '総戻し', target: '場札', intervalTurns: 8, descTemplate: '場札全体を山札に戻し、シャッフル後同じ配分で再配布する' },
  { id: 'tableauShuffle', name: '総入れ替え', target: '場札', intervalTurns: 6, descTemplate: '場札の中身を列をまたいでランダムに再配置する(山札には触れない)' },
  { id: 'chainPartialDiscard', name: 'チェーン部分放棄', target: 'チェーン', intervalTurns: 5, descTemplate: 'チェーンの先頭(最古)から2枚を捨て札に送る(コンボはそのまま維持)' },
  { id: 'chainShuffle', name: 'チェーン入れ替え', target: 'チェーン', intervalTurns: 6, descTemplate: 'チェーンをシャッフルし、新しい末尾を基準カードにする' },
  { id: 'comboReduce', name: 'コンボ削減', target: 'コンボ', intervalTurns: 5, descTemplate: 'コンボ数を3減らす(0未満にはしない)' },
  { id: 'comboCap', name: 'コンボ頭打ち', target: 'コンボ', intervalTurns: 6, descTemplate: '発動時点のコンボ数を上限として、次の妨害発動まで増加を止める' },
  { id: 'talismanConfiscate', name: '護符没収', target: '護符', intervalTurns: 7, descTemplate: '所持護符を1つ選び、完全に失わせる' },
  { id: 'riteConfiscate', name: '秘儀没収', target: '秘儀', intervalTurns: 6, descTemplate: '所持秘儀を1つ選び、効果を発動させずに消費させる' },
  { id: 'riteForceActivate', name: '秘儀強制発動', target: '秘儀', intervalTurns: 6, descTemplate: '使用可能な秘儀を1つ選び、即座に効果を発動させて消費する' },
  { id: 'talismanShuffle', name: '護符並び替え', target: '護符', intervalTurns: 5, descTemplate: '所持護符の並び順をランダムにシャッフルし、次の妨害発動まで護符を裏向き表示にする' },
  { id: 'revelationOracleConfiscate', name: '天啓・神託没収', target: '天啓・神託', intervalTurns: 7, descTemplate: '所持している天啓または神託からランダムに1つ選び、完全に失わせる' },
  { id: 'revelationOracleForceActivate', name: '天啓・神託強制発動', target: '天啓・神託', intervalTurns: 6, descTemplate: '使用可能な天啓または所持神託からランダムに1つ選び、即座に効果を発動させて消費する' },
  { id: 'tsukumokaRelease', name: '付喪化解除', target: 'レリック', intervalTurns: 6, descTemplate: '付喪化済みレリックがあればランダムに1つ選び、未付喪化状態に戻す' },
  { id: 'discardErase', name: '捨て札消去', target: '捨て札', intervalTurns: 6, descTemplate: 'チェーンのカードを捨て札に送り、捨て札全体をシャッフルしてから同じ枚数をチェーンに戻す' },
  { id: 'discardBury', name: '捨て札埋没', target: '捨て札', intervalTurns: 5, descTemplate: '捨て札の中身を山札に戻し混ぜ込み、同じ枚数を山札から裏向きで捨て札に移す' },
  { id: 'rewardReduce', name: '報酬減少', target: '資産(星片)', intervalTurns: 8, descTemplate: 'Waveクリア時の通貨報酬を-2する(複数回発動した場合は累積する)' },
  { id: 'currencyDrain', name: '通貨強制消費', target: '資産(星片)', intervalTurns: 6, descTemplate: '所持通貨の20%を失わせる' },
  { id: 'roleLevelDecay', name: '役減衰', target: '役ステータス', intervalTurns: 7, descTemplate: 'ランダムな2役を選び、oracleLevelを1下げる(下限1、永続的なマイナス)' },
  { id: 'roleBias', name: '役偏重', target: '役ステータス', intervalTurns: 6, descTemplate: '次の妨害発動まで、全役を半分ずつ2グループに分け、一方を2倍、他方を1/2倍にする' },
]
```
を:
```ts
// 妨害行動プール。32件のid(先行実装11個+Phase A 11個+Phase B 10個)。詳細はdocs/shidasu/shidasu-star-sabotage-candidates.mdを参照。
// name・target・intervalTurns・descTemplateの実値はShidasuParams.sabotageActions側で管理する
// (/admin/shidasu-sabotageから編集可能。レリック等と同じ「固定idプール+params.ts側の可変フィールド」構造)。
export const SABOTAGE_POOL: SabotageActionId[] = [
  'stockPurge', 'columnReturn', 'chainSettle', 'comboBreather',
  'talismanSeal', 'riteSeal', 'revelationOracleSeal', 'relicConfiscate',
  'tableauCardToDiscard', 'currencyConfiscate', 'roleSeal',
  'stockPurgeSmall', 'stockShuffle', 'tableauFullReturn', 'tableauShuffle',
  'chainPartialDiscard', 'chainShuffle', 'comboReduce', 'comboCap',
  'talismanConfiscate', 'riteConfiscate', 'riteForceActivate',
  'talismanShuffle', 'revelationOracleConfiscate', 'revelationOracleForceActivate', 'tsukumokaRelease',
  'discardErase', 'discardBury', 'rewardReduce', 'currencyDrain', 'roleLevelDecay', 'roleBias',
]

// 妨害行動の表示名をparams経由で取得する(relicName等と同じパターン)。
export function sabotageActionName(id: SabotageActionId, params: ShidasuParams): string {
  return params.sabotageActions[id].name
}

// 妨害行動の効果説明文をparams経由で取得する(プレースホルダー展開は無し、descTemplateは常に完成文)。
export function sabotageActionDesc(id: SabotageActionId, params: ShidasuParams): string {
  return params.sabotageActions[id].descTemplate
}
```
に変更する。

- [ ] **Step 3: `eligibleSabotageIds`・`rollSabotage`を更新する**

`src/lib/game/shidasu/sabotage.ts`(旧行番号49-63、Step2の変更により行番号がずれるため、`export function eligibleSabotageIds`以降を対象に)の:
```ts
export function eligibleSabotageIds(sabotage: StarSabotage): SabotageActionId[] {
  switch (sabotage.kind) {
    case 'none': return []
    case 'all': return SABOTAGE_POOL.map(a => a.id)
    case 'some': return sabotage.ids
  }
}

export function rollSabotage(sabotage: StarSabotage, rand: () => number): { pendingSabotageId: SabotageActionId | null; sabotageTurnsRemaining: number } {
  const ids = eligibleSabotageIds(sabotage)
  if (ids.length === 0) return { pendingSabotageId: null, sabotageTurnsRemaining: 0 }
  const id = ids[Math.floor(rand() * ids.length)]
  const def = SABOTAGE_POOL.find(a => a.id === id)!
  return { pendingSabotageId: id, sabotageTurnsRemaining: def.intervalTurns }
}
```
を:
```ts
export function eligibleSabotageIds(sabotage: StarSabotage): SabotageActionId[] {
  switch (sabotage.kind) {
    case 'none': return []
    case 'all': return SABOTAGE_POOL
    case 'some': return sabotage.ids
  }
}

// paramsからintervalTurnsを読むため、paramsを第一引数に取る。
export function rollSabotage(params: ShidasuParams, sabotage: StarSabotage, rand: () => number): { pendingSabotageId: SabotageActionId | null; sabotageTurnsRemaining: number } {
  const ids = eligibleSabotageIds(sabotage)
  if (ids.length === 0) return { pendingSabotageId: null, sabotageTurnsRemaining: 0 }
  const id = ids[Math.floor(rand() * ids.length)]
  return { pendingSabotageId: id, sabotageTurnsRemaining: params.sabotageActions[id].intervalTurns }
}
```
に変更する。

- [ ] **Step 4: 型チェック**

`npm run check`を実行し、`sabotage.ts`自体にエラーが無いことを確認する(呼び出し元`engine.ts`・`+page.svelte`・admin debugページ・テストファイルはまだ未対応のためエラーが出るのは想定内、後続タスクで解消する)。

- [ ] **Step 5: コミット**

```bash
git add src/lib/game/shidasu/sabotage.ts
git commit -m "$(cat <<'EOF'
refactor: SABOTAGE_POOLをid配列化しparams経由でintervalTurns等を取得するよう変更
EOF
)"
```

---

### Task 3: engine.ts — `rollSabotage`呼び出し元の更新

**Files:**
- Modify: `src/lib/game/shidasu/engine.ts:226`
- Modify: `src/lib/game/shidasu/engine.ts:1149`

- [ ] **Step 1: `startWave`内の`rollSabotage`呼び出しに`params`を追加する**

`src/lib/game/shidasu/engine.ts:226`の:
```ts
    ...rollSabotage(sabotage, rand),
```
を:
```ts
    ...rollSabotage(params, sabotage, rand),
```
に変更する(この行は`export function startWave(params: ShidasuParams, ...)`の内部にあり、`params`は既に引数として存在する)。

- [ ] **Step 2: `triggerSabotage`内の`rollSabotage`呼び出しに`params`を追加する**

`src/lib/game/shidasu/engine.ts:1149`の:
```ts
  const rolled = rollSabotage(star?.sabotage ?? { kind: 'none' }, rand)
```
を:
```ts
  const rolled = rollSabotage(params, star?.sabotage ?? { kind: 'none' }, rand)
```
に変更する(この行は`export function triggerSabotage(params: ShidasuParams, ...)`の内部にあり、`params`は既に引数として存在する)。

- [ ] **Step 3: 型チェック**

`npm run check`を実行し、`engine.ts`自体にエラーが無いことを確認する。

- [ ] **Step 4: コミット**

```bash
git add src/lib/game/shidasu/engine.ts
git commit -m "$(cat <<'EOF'
refactor: engine.tsのrollSabotage呼び出しにparamsを渡すよう変更
EOF
)"
```

---

### Task 4: UI層(+page.svelte・admin debugページ)の更新

**Files:**
- Modify: `src/routes/game/shidasu/+page.svelte`
- Modify: `src/routes/admin/shidasu-debug/+page.svelte`

- [ ] **Step 1: `+page.svelte`の`sabotageDetail`を`sabotageActionName`経由に変更する**

`src/routes/game/shidasu/+page.svelte:40`の:
```ts
  import { SABOTAGE_POOL } from '$lib/game/shidasu/sabotage'
```
を:
```ts
  import { sabotageActionName } from '$lib/game/shidasu/sabotage'
```
に変更する。

`src/routes/game/shidasu/+page.svelte:57-63`の:
```ts
  // 次に発動する妨害の名前+残りターン数を1行で返す。妨害が無い(pendingSabotageIdがnull)場合は空文字。
  function sabotageDetail(wave: WaveState | null): string {
    if (!wave || !wave.pendingSabotageId) return ''
    const action = SABOTAGE_POOL.find(a => a.id === wave.pendingSabotageId)
    if (!action) return ''
    return `次の妨害: ${action.name}(あと${wave.sabotageTurnsRemaining}ターン)`
  }
```
を:
```ts
  // 次に発動する妨害の名前+残りターン数を1行で返す。妨害が無い(pendingSabotageIdがnull)場合は空文字。
  function sabotageDetail(wave: WaveState | null): string {
    if (!wave || !wave.pendingSabotageId) return ''
    return `次の妨害: ${sabotageActionName(wave.pendingSabotageId, params)}(あと${wave.sabotageTurnsRemaining}ターン)`
  }
```
に変更する(`params`はこのファイルのモジュールスコープ42行目`const params = loadParams()`に既に存在する)。

- [ ] **Step 2: admin debugページのボタン一覧を`sabotageActionName`経由に変更する**

`src/routes/admin/shidasu-debug/+page.svelte:5`の:
```ts
  import { SABOTAGE_POOL } from '$lib/game/shidasu/sabotage'
```
を:
```ts
  import { SABOTAGE_POOL, sabotageActionName } from '$lib/game/shidasu/sabotage'
```
に変更する。

`src/routes/admin/shidasu-debug/+page.svelte:511-517`の:
```svelte
            {#each SABOTAGE_POOL as def (def.id)}
              <button
                type="button"
                onclick={() => handleTriggerSabotage(def.id)}
                class="text-xs px-2 py-1 rounded border border-slate-300 bg-white hover:bg-slate-100"
              >{def.name}</button>
            {/each}
```
を:
```svelte
            {#each SABOTAGE_POOL as id (id)}
              <button
                type="button"
                onclick={() => handleTriggerSabotage(id)}
                class="text-xs px-2 py-1 rounded border border-slate-300 bg-white hover:bg-slate-100"
              >{sabotageActionName(id, params)}</button>
            {/each}
```
に変更する(`params`はこのファイルの29行目`const params = loadParams()`に既に存在する)。

- [ ] **Step 3: 型チェック**

`npm run check`を実行し、この2ファイル自体にエラーが無いことを確認する(テストファイルはまだ未対応のためエラーが出るのは想定内、後続タスクで解消する)。

- [ ] **Step 4: コミット**

```bash
git add src/routes/game/shidasu/+page.svelte src/routes/admin/shidasu-debug/+page.svelte
git commit -m "$(cat <<'EOF'
refactor: 妨害行動の表示名取得をsabotageActionName経由に変更
EOF
)"
```

---

### Task 5: テストファイルの更新

**Files:**
- Modify: `src/lib/game/shidasu/sabotage.test.ts`
- Modify: `src/lib/game/shidasu/sabotageEffects.test.ts`

- [ ] **Step 1: `sabotage.test.ts`を更新する**

`src/lib/game/shidasu/sabotage.test.ts`の全文を以下に置き換える:
```ts
import { describe, it, expect } from 'vitest'
import { SABOTAGE_POOL, eligibleSabotageIds, rollSabotage } from './sabotage'
import { DEFAULT_PARAMS } from './params'

describe('SABOTAGE_POOL', () => {
  it('32件・ID重複無し・intervalTurnsが全て正の整数', () => {
    expect(SABOTAGE_POOL).toHaveLength(32)
    expect(new Set(SABOTAGE_POOL).size).toBe(32)
    for (const id of SABOTAGE_POOL) {
      expect(Number.isInteger(DEFAULT_PARAMS.sabotageActions[id].intervalTurns)).toBe(true)
      expect(DEFAULT_PARAMS.sabotageActions[id].intervalTurns).toBeGreaterThan(0)
    }
  })
})

describe('eligibleSabotageIds', () => {
  it('noneは空配列', () => {
    expect(eligibleSabotageIds({ kind: 'none' })).toEqual([])
  })
  it('allはSABOTAGE_POOL全件のID', () => {
    expect(eligibleSabotageIds({ kind: 'all' })).toEqual(SABOTAGE_POOL)
  })
  it('someは指定したIDのみ', () => {
    expect(eligibleSabotageIds({ kind: 'some', ids: ['stockPurge', 'comboBreather'] })).toEqual(['stockPurge', 'comboBreather'])
  })
})

describe('rollSabotage', () => {
  it('noneはpendingSabotageId: null, sabotageTurnsRemaining: 0', () => {
    const result = rollSabotage(DEFAULT_PARAMS, { kind: 'none' }, () => 0)
    expect(result).toEqual({ pendingSabotageId: null, sabotageTurnsRemaining: 0 })
  })
  it('allは候補の中から1つ選び、対応するintervalTurnsを設定する', () => {
    const result = rollSabotage(DEFAULT_PARAMS, { kind: 'all' }, () => 0)
    const expectedId = SABOTAGE_POOL[0]
    expect(result.pendingSabotageId).toBe(expectedId)
    expect(result.sabotageTurnsRemaining).toBe(DEFAULT_PARAMS.sabotageActions[expectedId].intervalTurns)
  })
})
```

- [ ] **Step 2: `sabotageEffects.test.ts`を更新する**

`src/lib/game/shidasu/sabotageEffects.test.ts:17`の:
```ts
    for (const action of SABOTAGE_POOL) {
      expect(() =>
        applySabotageEffect(action.id, { params: DEFAULT_PARAMS, run, wave, rand: () => 0, useRite, useRevelation, useOracle })
      ).not.toThrow()
    }
```
を:
```ts
    for (const id of SABOTAGE_POOL) {
      expect(() =>
        applySabotageEffect(id, { params: DEFAULT_PARAMS, run, wave, rand: () => 0, useRite, useRevelation, useOracle })
      ).not.toThrow()
    }
```
に変更する(`SABOTAGE_POOL`の要素が`SabotageActionDef`オブジェクトから`SabotageActionId`文字列に変わったため、ループ変数名を`action`から`id`に変更し`action.id`を`id`に置き換える。それ以外の行は変更不要)。

- [ ] **Step 3: テストを実行し、全て通ることを確認する**

```bash
npm run test -- sabotage.test.ts sabotageEffects.test.ts
```

- [ ] **Step 4: 型チェック**

`npm run check`を実行し、この2ファイル自体にエラーが無いことを確認する。

- [ ] **Step 5: コミット**

```bash
git add src/lib/game/shidasu/sabotage.test.ts src/lib/game/shidasu/sabotageEffects.test.ts
git commit -m "$(cat <<'EOF'
test: sabotage関連テストをSABOTAGE_POOLのid配列化・rollSabotageのparams引数追加に対応
EOF
)"
```

---

### Task 6: `/admin/shidasu-sabotage`画面の新規作成

**Files:**
- Create: `src/routes/admin/shidasu-sabotage/+page.svelte`

- [ ] **Step 1: 新規ファイルを作成する**

`src/routes/admin/shidasu-sabotage/+page.svelte`を以下の内容で新規作成する(`shidasu-relics/+page.svelte`と同じ構成、フィールドが固定4種のためレリックのような動的パラメータ列は無い):

```svelte
<script lang="ts">
  import { onMount, onDestroy } from 'svelte'
  import { DEFAULT_PARAMS, type ShidasuParams } from '$lib/game/shidasu/params'
  import { SABOTAGE_POOL } from '$lib/game/shidasu/sabotage'
  import type { SabotageActionId } from '$lib/game/shidasu/types'

  let config = $state<ShidasuParams | null>(null)
  let error = $state<string | null>(null)
  let flash = $state<string | null>(null)
  let flashTimer: ReturnType<typeof setTimeout> | null = null

  function showToast(message: string) {
    if (flashTimer) clearTimeout(flashTimer)
    flash = message
    flashTimer = setTimeout(() => { flash = null }, 2000)
  }

  function sabotageEntry(id: SabotageActionId) {
    return config!.sabotageActions[id]
  }

  let hasValidationError = $derived.by(() => {
    if (!config) return false
    return SABOTAGE_POOL.some(id => {
      const entry = sabotageEntry(id)
      if (!entry.name.trim()) return true
      if (!entry.descTemplate.trim()) return true
      if (!Number.isInteger(entry.intervalTurns) || entry.intervalTurns <= 0) return true
      return false
    })
  })

  async function loadConfig(toast = false) {
    try {
      const res = await fetch('/api/admin/shidasu-config')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      config = await res.json() as ShidasuParams
      error = null
      if (toast) showToast('リロードしました')
    } catch {
      error = 'Shidasu設定APIに接続できません。npm run dev で起動してください。'
      if (!config) config = JSON.parse(JSON.stringify(DEFAULT_PARAMS))
    }
  }

  async function save() {
    if (!config) return
    try {
      const res = await fetch('/api/admin/shidasu-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      showToast('保存しました(反映には再ビルド・再デプロイが必要です)')
    } catch {
      error = '保存に失敗しました'
    }
  }

  onMount(() => loadConfig())
  onDestroy(() => {
    if (flashTimer) clearTimeout(flashTimer)
  })
</script>

<svelte:head>
  <title>Shidasu 妨害行動設定</title>
</svelte:head>

<div class="max-w-6xl mx-auto px-4 py-8">
  <a href="/admin" class="text-xs text-slate-400 hover:text-teal-600 mb-4 inline-block">← 管理ページ一覧</a>

  <div class="flex items-center justify-between mb-6">
    <h1 class="text-2xl font-bold text-slate-800">星詠みソリティア -Shidasu- 妨害行動設定</h1>
    <div class="flex gap-2">
      <button onclick={() => loadConfig(true)} class="text-sm px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors">
        リロード
      </button>
      {#if hasValidationError}
        <p class="text-xs text-red-600 self-center">名前・説明文が未入力、または発動間隔ターン数が不正な項目があります</p>
      {/if}
      <button
        onclick={save}
        disabled={hasValidationError || !config}
        class="text-sm px-3 py-1.5 rounded-lg bg-teal-600 text-white hover:bg-teal-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        保存
      </button>
    </div>
  </div>

  {#if error}
    <div class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">{error}</div>
  {/if}

  {#if config}
    <section class="bg-white border border-slate-200 rounded-xl p-4">
      <div class="overflow-x-auto">
        <table class="w-full text-xs border border-slate-200 rounded-lg overflow-hidden">
          <thead>
            <tr class="bg-slate-50 text-slate-500">
              <th class="px-2 py-1.5 text-left" style="width:10rem;">id</th>
              <th class="px-2 py-1.5 text-left" style="width:8rem;">表示名</th>
              <th class="px-2 py-1.5 text-left" style="width:6rem;">対象カテゴリ</th>
              <th class="px-2 py-1.5 text-left" style="width:6rem;">発動間隔(ターン)</th>
              <th class="px-2 py-1.5 text-left" style="width:24rem;">効果説明文</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            {#each SABOTAGE_POOL as id (id)}
              {@const entry = sabotageEntry(id)}
              <tr>
                <td class="px-2 py-1.5 align-top text-slate-400 font-mono">{id}</td>
                <td class="px-2 py-1.5 align-top">
                  <input type="text" bind:value={entry.name} class="w-full border border-slate-200 rounded px-1.5 py-0.5" />
                </td>
                <td class="px-2 py-1.5 align-top text-slate-500">{entry.target}</td>
                <td class="px-2 py-1.5 align-top">
                  <input type="number" step="1" min="1" bind:value={entry.intervalTurns} class="w-full border border-slate-200 rounded px-1 py-0.5" />
                </td>
                <td class="px-2 py-1.5 align-top">
                  <textarea bind:value={entry.descTemplate} rows="2" class="w-full border border-slate-200 rounded px-1.5 py-0.5 font-mono text-[11px] resize-y"></textarea>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </section>
  {:else if !error}
    <p class="text-slate-500 text-sm">読み込み中...</p>
  {/if}
</div>

{#if flash}
  <div class="fixed bottom-6 right-6 bg-slate-800 text-white text-sm px-4 py-2.5 rounded-lg shadow-lg z-50">
    {flash}
  </div>
{/if}
```

- [ ] **Step 2: 型チェック**

`npm run check`を実行し、`src/routes/admin/shidasu-sabotage/+page.svelte`自体にエラーが無いことを確認する。

- [ ] **Step 3: コミット**

```bash
git add src/routes/admin/shidasu-sabotage/+page.svelte
git commit -m "$(cat <<'EOF'
feat: /admin/shidasu-sabotageに妨害行動一覧編集画面を新規作成
EOF
)"
```

---

### Task 7: adminトップページへのリンク追加

**Files:**
- Modify: `src/routes/admin/+page.svelte:86-91`

- [ ] **Step 1: リンクカードを追加する**

`src/routes/admin/+page.svelte:86-91`(既存の`shidasu-relics`カード)の:
```svelte
    <a href="/admin/shidasu-relics" class="flex items-center gap-3 px-4 py-4 hover:bg-slate-50 transition-colors group">
      <div class="flex-1">
        <p class="text-sm font-semibold text-slate-700 group-hover:text-teal-700">星詠みソリティア -Shidasu- レリックパラメータ設定</p>
        <p class="text-xs text-slate-400 mt-0.5">レリックごとの名前・価格・数値パラメータ・効果説明文(付喪化前後)を1行ずつ編集</p>
      </div>
      <span class="text-slate-300 group-hover:text-teal-600 transition-colors">→</span>
    </a>
```
の直後に、以下のリンクカードを追加する:
```svelte
    <a href="/admin/shidasu-sabotage" class="flex items-center gap-3 px-4 py-4 hover:bg-slate-50 transition-colors group">
      <div class="flex-1">
        <p class="text-sm font-semibold text-slate-700 group-hover:text-teal-700">星詠みソリティア -Shidasu- 妨害行動設定</p>
        <p class="text-xs text-slate-400 mt-0.5">妨害行動32種の表示名・発動間隔ターン数・効果説明文を1行ずつ編集</p>
      </div>
      <span class="text-slate-300 group-hover:text-teal-600 transition-colors">→</span>
    </a>
```

- [ ] **Step 2: 型チェック**

`npm run check`を実行し、`src/routes/admin/+page.svelte`自体にエラーが無いことを確認する。

- [ ] **Step 3: コミット**

```bash
git add src/routes/admin/+page.svelte
git commit -m "$(cat <<'EOF'
feat: adminトップページに妨害行動設定画面へのリンクを追加
EOF
)"
```

---

### Task 8: 最終確認

**Files:** なし(検証のみ)

- [ ] **Step 1: 全体テストスイートを実行する**

```bash
npm run test
```

全テストが通ることを確認する。失敗があれば、該当タスクに戻って修正する。

- [ ] **Step 2: ビルドを確認する**

```bash
npm run build
```

- [ ] **Step 3: 型チェックを確認する**

```bash
npm run check
```

プロジェクト全体でエラーが0件(このリファクタに起因するもの)であることを確認する。既存の無関係なエラー(`solitaire`・`hepburn-converter`・`vector3-visualizer`)が残っていても問題ない。

- [ ] **Step 4: 開発サーバーで手動確認する**

```bash
npm run dev
```

`http://localhost:5173/admin`を開き、以下を確認する:
- 「星詠みソリティア -Shidasu- 妨害行動設定」のリンクカードが表示され、`/admin/shidasu-sabotage`へ遷移できる
- 妨害行動32件が一覧表示され、idごとに表示名・対象カテゴリ(読み取り専用)・発動間隔ターン数・効果説明文が表示される
- 表示名・発動間隔ターン数・効果説明文を編集し、「保存」ボタンで保存できる(保存後、`shidasu.config.json`の該当箇所が更新されることを確認)
- 表示名または効果説明文を空にすると保存ボタンがdisabledになる
- `http://localhost:5173/game/shidasu`で実際にゲームをプレイし、妨害行動が発動した際の「次の妨害: XXX(あとNターン)」表示が正しく出ることを確認する(admin画面で`name`を変更した場合、変更後の名前が表示されることも確認できるとなお良い)
- `http://localhost:5173/admin/shidasu-debug`で妨害行動の直接発動ボタン一覧が正しく表示され、クリックで発動することを確認する

問題があれば修正し、該当タスクへ戻って再コミットする。

- [ ] **Step 5: この最終確認の結果を報告する**

テスト・ビルド・型チェック・手動確認の結果をまとめて報告する。
