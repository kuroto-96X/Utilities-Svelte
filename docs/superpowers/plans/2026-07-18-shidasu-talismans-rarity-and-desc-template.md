# Shidasu 護符管理画面: レア度・説明文テンプレート編集 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/admin/shidasu-talismans`で各護符のレア度(C/U/R)と説明文(パラメータ変数名を含むテンプレート)を編集できるようにする。

**Architecture:** `ShidasuParams.talismans`の各エントリに`rarity`・`desc`フィールドを追加し、`itemDesc`関数を90ケース近いswitch文から単純なプレースホルダー置換に置き換える。管理画面には「レア度」列(select)と「説明文テンプレート」列(編集可能)・「プレビュー」列(置換済み表示)を追加する。

**Tech Stack:** SvelteKit(Svelte 5 runes)、TypeScript、Vitest。

---

## 前提知識(実装前に把握しておくこと)

- 現在実装済みの護符は87種類(`ITEM_POOL.length === 87`)。`docs/shidasu-gofu-candidates.md`に記載の「100個」は未実装候補を含む数で、実装済みなのはその一部。
- `src/lib/game/shidasu/params.ts`(`DEFAULT_PARAMS`、型定義含む)と`src/lib/game/shidasu/shidasu.config.json`(`loadParams()`が実際に読み込む「ライブ」データ)は別ファイルで、数値パラメータの値が異なる場合がある(管理画面での調整結果が`shidasu.config.json`にのみ反映されているため)。本プランで追加する`rarity`・`desc`は両ファイルに同じ値を設定するが、既存の数値パラメータの値はどちらのファイルでも変更しない。
- 本プランのTask 2で使う`rarity`・`desc`の値は、既存の`itemDesc`のswitch文(87ケース中85ケース)から機械的に導出し、実際に`itemDesc()`の現在の出力と完全一致することを検証済み(「架橋」「寛容」の2護符のみ、設計spec通り簡素化した文言になる)。
- `npm run build`(esbuild)は型チェックをしないため、型エラーは`npm run check`(svelte-check)でのみ検出される。

---

## ファイル構成

- `src/lib/game/shidasu/params.ts`(修正): `ShidasuParams.talismans`の型定義・`DEFAULT_PARAMS.talismans`に`rarity`・`desc`を追加。
- `src/lib/game/shidasu/shidasu.config.json`(修正): 同上のデータを追加。
- `src/lib/game/shidasu/engine.ts`(修正): `itemDesc`関数をテンプレート置換方式に書き換え。
- `src/lib/game/shidasu/engine.test.ts`(修正): `itemDesc`の「架橋」「寛容」に関するテストを新仕様に合わせて更新。
- `src/routes/admin/shidasu-talismans/+page.svelte`(修正): レア度列・説明文テンプレート列・プレビュー列を追加。

---

### Task 1: `ShidasuParams.talismans`の型定義に`rarity`・`desc`を追加する

**Files:**
- Modify: `src/lib/game/shidasu/params.ts`

- [ ] **Step 1: 型定義を書き換える**

`src/lib/game/shidasu/params.ts`の`talismans: { ... }`型定義ブロック(`export interface ShidasuParams`内、`bridge: { name: string; m: number }`から`deadline: { name: string; n: number }`までの87行)を、以下の内容に置き換える。

```ts
    bridge: { name: string; m: number; rarity: 'C' | 'U' | 'R'; desc: string }
    grace: { name: string; m: number; rarity: 'C' | 'U' | 'R'; desc: string }
    patience: { name: string; x: number; rarity: 'C' | 'U' | 'R'; desc: string }
    purify: { name: string; n: number; rarity: 'C' | 'U' | 'R'; desc: string }
    temperance: { name: string; x: number; rarity: 'C' | 'U' | 'R'; desc: string }
    springBreeze: { name: string; n: number; rarity: 'C' | 'U' | 'R'; desc: string }
    summerBreeze: { name: string; n: number; rarity: 'C' | 'U' | 'R'; desc: string }
    autumnBreeze: { name: string; n: number; rarity: 'C' | 'U' | 'R'; desc: string }
    winterBreeze: { name: string; n: number; rarity: 'C' | 'U' | 'R'; desc: string }
    kinship: { name: string; n: number; rarity: 'C' | 'U' | 'R'; desc: string }
    thaw: { name: string; n: number; rarity: 'C' | 'U' | 'R'; desc: string }
    dusk: { name: string; n: number; rarity: 'C' | 'U' | 'R'; desc: string }
    dawn: { name: string; n: number; rarity: 'C' | 'U' | 'R'; desc: string }
    wit: { name: string; n: number; rarity: 'C' | 'U' | 'R'; desc: string }
    courage: { name: string; x: number; rarity: 'C' | 'U' | 'R'; desc: string }
    daybreak: { name: string; c: number; x: number; rarity: 'C' | 'U' | 'R'; desc: string }
    twilight: { name: string; c: number; x: number; rarity: 'C' | 'U' | 'R'; desc: string }
    cheerful: { name: string; n: number; rarity: 'C' | 'U' | 'R'; desc: string }
    conscience: { name: string; n: number; rarity: 'C' | 'U' | 'R'; desc: string }
    morningMist: { name: string; c: number; x: number; rarity: 'C' | 'U' | 'R'; desc: string }
    calm: { name: string; n: number; rarity: 'C' | 'U' | 'R'; desc: string }
    serenity: { name: string; x: number; rarity: 'C' | 'U' | 'R'; desc: string }
    destiny: { name: string; n: number; rarity: 'C' | 'U' | 'R'; desc: string }
    fate: { name: string; x: number; rarity: 'C' | 'U' | 'R'; desc: string }
    relief: { name: string; n: number; rarity: 'C' | 'U' | 'R'; desc: string }
    verdantGreen: { name: string; x: number; rarity: 'C' | 'U' | 'R'; desc: string }
    gem: { name: string; x: number; rarity: 'C' | 'U' | 'R'; desc: string }
    resolve: { name: string; x: number; rarity: 'C' | 'U' | 'R'; desc: string }
    grail: { name: string; x: number; rarity: 'C' | 'U' | 'R'; desc: string }
    moonlight: { name: string; x: number; rarity: 'C' | 'U' | 'R'; desc: string }
    sunlight: { name: string; x: number; rarity: 'C' | 'U' | 'R'; desc: string }
    crown: { name: string; x: number; rarity: 'C' | 'U' | 'R'; desc: string }
    cloverLeaf: { name: string; n: number; rarity: 'C' | 'U' | 'R'; desc: string }
    coin: { name: string; n: number; rarity: 'C' | 'U' | 'R'; desc: string }
    blade: { name: string; n: number; rarity: 'C' | 'U' | 'R'; desc: string }
    chalice: { name: string; n: number; rarity: 'C' | 'U' | 'R'; desc: string }
    balance: { name: string; n: number; rarity: 'C' | 'U' | 'R'; desc: string }
    harmony: { name: string; x: number; rarity: 'C' | 'U' | 'R'; desc: string }
    nobility: { name: string; n: number; rarity: 'C' | 'U' | 'R'; desc: string }
    tenacity: { name: string; x: number; rarity: 'C' | 'U' | 'R'; desc: string }
    determination: { name: string; x: number; rarity: 'C' | 'U' | 'R'; desc: string }
    cycle: { name: string; x: number; rarity: 'C' | 'U' | 'R'; desc: string }
    reincarnation: { name: string; x: number; rarity: 'C' | 'U' | 'R'; desc: string }
    majesty: { name: string; x: number; rarity: 'C' | 'U' | 'R'; desc: string }
    omen: { name: string; m: number; x: number; rarity: 'C' | 'U' | 'R'; desc: string }
    crescent: { name: string; m: number; x: number; rarity: 'C' | 'U' | 'R'; desc: string }
    blessing: { name: string; x: number; rarity: 'C' | 'U' | 'R'; desc: string }
    focus: { name: string; x: number; rarity: 'C' | 'U' | 'R'; desc: string }
    lapis: { name: string; x: number; rarity: 'C' | 'U' | 'R'; desc: string }
    jade: { name: string; n: number; rarity: 'C' | 'U' | 'R'; desc: string }
    emptyMind: { name: string; x: number; rarity: 'C' | 'U' | 'R'; desc: string }
    prologue: { name: string; n: number; rarity: 'C' | 'U' | 'R'; desc: string }
    interlude: { name: string; m: number; n: number; rarity: 'C' | 'U' | 'R'; desc: string }
    morningDew: { name: string; n: number; rarity: 'C' | 'U' | 'R'; desc: string }
    drizzle: { name: string; n: number; rarity: 'C' | 'U' | 'R'; desc: string }
    eternity: { name: string; rarity: 'C' | 'U' | 'R'; desc: string }
    abundance: { name: string; rarity: 'C' | 'U' | 'R'; desc: string }
    silence: { name: string; rarity: 'C' | 'U' | 'R'; desc: string }
    resilience: { name: string; p: number; rarity: 'C' | 'U' | 'R'; desc: string }
    gentleBreeze: { name: string; n: number; rarity: 'C' | 'U' | 'R'; desc: string }
    resonance: { name: string; x: number; rarity: 'C' | 'U' | 'R'; desc: string }
    azureSky: { name: string; x: number; rarity: 'C' | 'U' | 'R'; desc: string }
    amber: { name: string; x: number; rarity: 'C' | 'U' | 'R'; desc: string }
    composure: { name: string; n: number; rarity: 'C' | 'U' | 'R'; desc: string }
    clarity: { name: string; n: number; rarity: 'C' | 'U' | 'R'; desc: string }
    arrogance: { name: string; x: number; rarity: 'C' | 'U' | 'R'; desc: string }
    echo: { name: string; n: number; rarity: 'C' | 'U' | 'R'; desc: string }
    shootingStar: { name: string; c: number; p: number; rarity: 'C' | 'U' | 'R'; desc: string }
    naive: { name: string; rarity: 'C' | 'U' | 'R'; desc: string }
    intuition: { name: string; x: number; rarity: 'C' | 'U' | 'R'; desc: string }
    sincerity: { name: string; n: number; rarity: 'C' | 'U' | 'R'; desc: string }
    promise: { name: string; rarity: 'C' | 'U' | 'R'; desc: string }
    darkClouds: { name: string; r: number; rarity: 'C' | 'U' | 'R'; desc: string }
    regeneration: { name: string; p: number; rarity: 'C' | 'U' | 'R'; desc: string }
    benevolence: { name: string; rarity: 'C' | 'U' | 'R'; desc: string }
    healing: { name: string; rarity: 'C' | 'U' | 'R'; desc: string }
    guidance: { name: string; rarity: 'C' | 'U' | 'R'; desc: string }
    passion: { name: string; x: number; rarity: 'C' | 'U' | 'R'; desc: string }
    fightingSpirit: { name: string; x: number; rarity: 'C' | 'U' | 'R'; desc: string }
    sanctify: { name: string; rarity: 'C' | 'U' | 'R'; desc: string }
    protection: { name: string; c: number; rarity: 'C' | 'U' | 'R'; desc: string }
    earth: { name: string; c: number; rarity: 'C' | 'U' | 'R'; desc: string }
    golden: { name: string; rarity: 'C' | 'U' | 'R'; desc: string }
    morningStar: { name: string; x: number; rarity: 'C' | 'U' | 'R'; desc: string }
    mercy: { name: string; c: number; x: number; rarity: 'C' | 'U' | 'R'; desc: string }
    mirror: { name: string; rarity: 'C' | 'U' | 'R'; desc: string }
    deadline: { name: string; n: number; rarity: 'C' | 'U' | 'R'; desc: string }
```

- [ ] **Step 2: 型チェック**

Run: `npm run check`
Expected: `DEFAULT_PARAMS`(まだ`rarity`/`desc`を持たない)に対して「プロパティが不足している」旨の型エラーが多数出る。これは想定通り(Task 2で解消する)。エラー内容が`talismans`の`rarity`/`desc`不足に関するものであることを確認する。

- [ ] **Step 3: コミット**

```bash
git add src/lib/game/shidasu/params.ts
git commit -m "$(cat <<'EOF'
feat: ShidasuParamsのtalismans型にrarity・descを追加

各護符にレア度(C/U/R)と説明文テンプレートを持たせるための型定義を
追加した。この時点ではDEFAULT_PARAMS側にまだ値が無いため型エラーに
なるが、次タスクで解消する。
EOF
)"
```

---

### Task 2: `DEFAULT_PARAMS`・`shidasu.config.json`に`rarity`・`desc`の値を追加する

**Files:**
- Modify: `src/lib/game/shidasu/params.ts`
- Modify: `src/lib/game/shidasu/shidasu.config.json`

`rarity`の値は`docs/shidasu-gofu-candidates.md`のC/U/R分類(名前が一致する項目)から移行したもの。`desc`の値は既存の`itemDesc`のswitch文の出力と完全一致するよう機械的に導出したテンプレート(「架橋」「寛容」のみ設計spec通り簡素化)。

- [ ] **Step 1: `DEFAULT_PARAMS.talismans`を書き換える**

`src/lib/game/shidasu/params.ts`の`talismans: { ... }`(`DEFAULT_PARAMS`内、`bridge: { name: '架橋', m: 2 },`から`deadline: { name: '刻限', n: 10 },`までの87行)を、以下の内容に置き換える。

```ts
    bridge: { name: '架橋', m: 2, rarity: 'C', desc: '階段・同スート・同色の成立に必要な枚数を{m}枚緩和' },
    grace: { name: '寛容', m: 2, rarity: 'C', desc: '列一掃ボーナスに必要な枚数を{m}枚緩和' },
    patience: { name: '忍耐', x: 500, rarity: 'C', desc: '全消しボーナスに残り山札枚数×{x}点を加算' },
    purify: { name: '浄化', n: 10000, rarity: 'C', desc: '全消しボーナスに{n}点を加算' },
    temperance: { name: '節制', x: 0.1, rarity: 'U', desc: '全消しボーナスを残り山札枚数×{x}分だけ倍加' },
    springBreeze: { name: '春風', n: 100, rarity: 'C', desc: 'クラブ(♣)を取ったとき、{n}点加算' },
    summerBreeze: { name: '夏風', n: 100, rarity: 'C', desc: 'ダイヤ(♦)を取ったとき、{n}点加算' },
    autumnBreeze: { name: '秋風', n: 100, rarity: 'C', desc: 'ハート(♥)を取ったとき、{n}点加算' },
    winterBreeze: { name: '冬風', n: 100, rarity: 'C', desc: 'スペード(♠)を取ったとき、{n}点加算' },
    kinship: { name: '友愛', n: 200, rarity: 'C', desc: '他のスートからハート(♥)を取ったとき、{n}点加算' },
    thaw: { name: '雪解', n: 200, rarity: 'C', desc: 'スペード(♠)から別のスートを取ったとき、{n}点加算' },
    dusk: { name: '宵闇', n: 100, rarity: 'C', desc: '赤から黒に変わったとき、{n}点加算' },
    dawn: { name: '払暁', n: 100, rarity: 'C', desc: '黒から赤に変わったとき、{n}点加算' },
    wit: { name: '機知', n: 200, rarity: 'C', desc: 'ワイルドを取ったとき、{n}点加算' },
    courage: { name: '勇気', x: 0.1, rarity: 'R', desc: 'コンボ数×{x}分、獲得点を倍加' },
    daybreak: { name: '暁', c: 3, x: 2, rarity: 'C', desc: 'コンボ数が{c}以下のとき、獲得点を{x}倍' },
    twilight: { name: '黄昏', c: 8, x: 2, rarity: 'C', desc: 'コンボ数が{c}以上のとき、獲得点を{x}倍' },
    cheerful: { name: '快活', n: 50, rarity: 'C', desc: 'コンボ数が偶数のとき、{n}点加算' },
    conscience: { name: '良心', n: 50, rarity: 'C', desc: 'コンボ数が奇数のとき、{n}点加算' },
    morningMist: { name: '朝霧', c: 5, x: 3, rarity: 'C', desc: 'コンボ数が{c}未満のとき獲得点を1/{x}に、{c}以上のとき{x}倍に' },
    calm: { name: '平穏', n: 200, rarity: 'C', desc: 'コンボ内にJQKが無いとき、{n}点加算' },
    serenity: { name: '安寧', x: 1.5, rarity: 'U', desc: 'コンボ内にJQKが無いとき、獲得点を{x}倍' },
    destiny: { name: '運命', n: 300, rarity: 'C', desc: 'コンボ内がJQKのみのとき、{n}点加算' },
    fate: { name: '宿命', x: 2.0, rarity: 'U', desc: 'コンボ内がJQKのみのとき、獲得点を{x}倍' },
    relief: { name: '安堵', n: 100, rarity: 'C', desc: '取得したカード1枚のランクが1〜10のとき、{n}点加算' },
    verdantGreen: { name: '深緑', x: 3, rarity: 'C', desc: 'コンボがクラブ(♣)専有のとき、獲得点を{x}倍' },
    gem: { name: '宝石', x: 3, rarity: 'C', desc: 'コンボがダイヤ(♦)専有のとき、獲得点を{x}倍' },
    resolve: { name: '真剣', x: 3, rarity: 'C', desc: 'コンボがスペード(♠)専有のとき、獲得点を{x}倍' },
    grail: { name: '聖杯', x: 3, rarity: 'C', desc: 'コンボがハート(♥)専有のとき、獲得点を{x}倍' },
    moonlight: { name: '月光', x: 1.5, rarity: 'U', desc: 'コンボが黒専有のとき、獲得点を{x}倍' },
    sunlight: { name: '陽光', x: 1.5, rarity: 'U', desc: 'コンボが赤専有のとき、獲得点を{x}倍' },
    crown: { name: '王冠', x: 0.5, rarity: 'C', desc: 'コンボ内のK枚数×{x}分、獲得点を倍加' },
    cloverLeaf: { name: '青葉', n: 50, rarity: 'C', desc: 'コンボ内のクラブ(♣)枚数×{n}点を加算' },
    coin: { name: '硬貨', n: 50, rarity: 'C', desc: 'コンボ内のダイヤ(♦)枚数×{n}点を加算' },
    blade: { name: '武器', n: 50, rarity: 'C', desc: 'コンボ内のスペード(♠)枚数×{n}点を加算' },
    chalice: { name: '献杯', n: 50, rarity: 'C', desc: 'コンボ内のハート(♥)枚数×{n}点を加算' },
    balance: { name: '均衡', n: 200, rarity: 'C', desc: 'コンボ内の赤黒枚数が同数のとき、{n}点加算' },
    harmony: { name: '調和', x: 1.5, rarity: 'C', desc: 'コンボ内の赤黒枚数が同数のとき、獲得点を{x}倍' },
    nobility: { name: '高潔', n: 200, rarity: 'C', desc: '同スートパターン成立時、{n}点加算' },
    tenacity: { name: '執念', x: 0.1, rarity: 'R', desc: '同スートパターン成立時、コンボ内枚数×{x}分、獲得点を倍加' },
    determination: { name: '覚悟', x: 0.1, rarity: 'R', desc: '階段成立時、階段の長さ×{x}分、獲得点を倍加' },
    cycle: { name: '循環', x: 3, rarity: 'C', desc: 'KからA、またはAからKを取ったとき、獲得点を{x}倍' },
    reincarnation: { name: '輪廻', x: 10, rarity: 'U', desc: 'コンプリートラン(全ランク階段)にK↔Aループが含まれるとき、獲得点を{x}倍' },
    majesty: { name: '威光', x: 50, rarity: 'U', desc: '同スートかつ全ランク階段を達成したとき、獲得点を{x}倍' },
    omen: { name: '兆し', m: 20, x: 1.5, rarity: 'U', desc: '場札の残り枚数が{m}枚以下のとき、獲得点を{x}倍' },
    crescent: { name: '三日月', m: 10, x: 3, rarity: 'U', desc: '場札の残り枚数が{m}枚以下のとき、獲得点を{x}倍' },
    blessing: { name: '恩寵', x: 1.5, rarity: 'U', desc: '役が成立したとき、獲得点を{x}倍' },
    focus: { name: '集中', x: 3, rarity: 'U', desc: '同ランクの役が含まれるとき、獲得点を{x}倍' },
    lapis: { name: '瑠璃', x: 2, rarity: 'R', desc: '役ボーナス・パターンボーナス(同スート/同色・階段)をあわせて2種類以上成立したとき、獲得点を{x}倍' },
    jade: { name: '翡翠', n: 200, rarity: 'U', desc: '役の成立にワイルドが使われたとき、{n}点加算' },
    emptyMind: { name: '無心', x: 4, rarity: 'U', desc: '役・パターンがどちらも無いとき、獲得点を{x}倍' },
    prologue: { name: '序章', n: 500, rarity: 'C', desc: 'チェーン内でプレイ1枚目のとき、{n}点加算' },
    interlude: { name: '幕間', m: 5, n: 1000, rarity: 'C', desc: 'チェーン内でプレイちょうど{m}枚目のとき、{n}点加算' },
    morningDew: { name: '朝露', n: 5000, rarity: 'C', desc: 'ウェーブで最初にプレイしたカードのとき、{n}点加算' },
    drizzle: { name: '小雨', n: 50, rarity: 'C', desc: '場札を取るたび、{n}点加算' },
    eternity: { name: '永劫', rarity: 'U', desc: 'ウェーブ開始時、山札にワイルドを1枚追加(以後のウェーブにも引き継がれる)' },
    abundance: { name: '豊穣', rarity: 'U', desc: 'ウェーブ開始時、デッキ内の1枚がランダムにワイルドへ変換される(以後のウェーブにも引き継がれる)' },
    silence: { name: '静寂', rarity: 'U', desc: '山札めくりで取れる場札が無いままコンボがリセットされた時、めくった札をワイルドに変換する(デッキにも永続的に反映)' },
    resilience: { name: '不屈', p: 30, rarity: 'U', desc: '山札が無く場札も取れない手詰まり時、スコアの{p}%を消費して捨て札の半数を山札に戻す' },
    gentleBreeze: { name: '微風', n: 100, rarity: 'C', desc: '同じ列を連続でプレイしたとき(2回目以降)、連続回数×{n}点加算' },
    resonance: { name: '共鳴', x: 0.3, rarity: 'U', desc: '同じ列を連続でプレイしたとき(2回目以降)、連続回数×{x}分獲得点を倍加' },
    azureSky: { name: '蒼穹', x: 0.3, rarity: 'U', desc: 'ウェーブ内で列一掃した累計回数×{x}分、獲得点を倍加' },
    amber: { name: '琥珀', x: 0.1, rarity: 'R', desc: 'ウェーブ内の最大到達コンボ数×{x}分、獲得点を倍加' },
    composure: { name: '沈着', n: 500, rarity: 'C', desc: '山札めくりでコンボリセットされた時、取れる場札が無ければ直接{n}点加算' },
    clarity: { name: '冷静', n: 500, rarity: 'C', desc: 'コンボリセット時、そのチェーンで役が一つも成立していなければ直接{n}点加算' },
    arrogance: { name: '慢心', x: 50, rarity: 'C', desc: '山札が無くなった時、場札の残り枚数×{x}点を直接加算' },
    echo: { name: '残響', n: 200, rarity: 'U', desc: 'コンボがリセットされる瞬間、リセット前のコンボ数×{n}点を直接加算' },
    shootingStar: { name: '流星', c: 10, p: 10, rarity: 'R', desc: 'コンボ数が{c}に到達した瞬間、獲得点を加算した後の現在スコアの{p}%を直接加算' },
    naive: { name: '素朴', rarity: 'C', desc: '山札めくりがパターン継続だった場合、通常のプレイと同様に得点計算する(コンボ数も加算)' },
    intuition: { name: '直感', x: 0.3, rarity: 'U', desc: '(素朴と組み合わせて機能)現在のチェーン中に山札めくりでコンボ継続した回数×{x}分、獲得点を倍加' },
    sincerity: { name: '誠実', n: 300, rarity: 'C', desc: '山札めくりで同色パターンによりコンボ継続した時、直接{n}点加算' },
    promise: { name: '約束', rarity: 'R', desc: '山札の次のカードが、今のコンボが継続できるカードになる' },
    darkClouds: { name: '暗雲', r: 1, rarity: 'U', desc: 'ウェーブ開始時、場札が{r}行多く配られる' },
    regeneration: { name: '再生', p: 50, rarity: 'R', desc: '全消し時、スコアの{p}%を消費して捨て札から場札を復活させる(復活すればウェーブ継続)' },
    benevolence: { name: '博愛', rarity: 'R', desc: 'コンボごとに1回、コンボリセットを無効化する' },
    healing: { name: '治癒', rarity: 'U', desc: '列一掃時、捨て札から最大{rows}枚を空いた列へ戻す' },
    guidance: { name: '導き', rarity: 'U', desc: '山札の次のカードが見えるようになる' },
    passion: { name: '情熱', x: 1.5, rarity: 'U', desc: 'このコンボ中にフラッシュが成立していれば、獲得点を{x}倍' },
    fightingSpirit: { name: '闘志', x: 1.3, rarity: 'U', desc: 'このウェーブ中に列一掃が発生していれば、獲得点を{x}倍' },
    sanctify: { name: '祝福', rarity: 'R', desc: '役を揃えるたび基礎コンボ数+1。コンボリセット時、0ではなく基礎コンボ数から再開する' },
    protection: { name: '庇護', c: 3, rarity: 'U', desc: 'コンボ数(計算用)が{c}未満のとき、{c}として計算する' },
    earth: { name: '大地', c: 2, rarity: 'R', desc: 'コンボ数(計算用)に常に{c}を加算する' },
    golden: { name: '黄金', rarity: 'R', desc: 'コンボが1回進むたびに、通常の+1ではなく+2進む' },
    morningStar: { name: '明星', x: 0.2, rarity: 'R', desc: '役ボーナスの額を、その役のウェーブ内累積成立回数×{x}分だけ倍加' },
    mercy: { name: '慈悲', c: 3, x: 1.5, rarity: 'U', desc: 'コンボ数が{c}以下でリセットされたとき、次のコンボの間、獲得点を{x}倍' },
    mirror: { name: '水鏡', rarity: 'R', desc: '役が成立するたび(コンボ中1回、同ランクは枚数ごとに1回)、次のプレイで同じ役ボーナスを追加でもう一度加算する' },
    deadline: { name: '刻限', n: 10, rarity: 'U', desc: 'カードを取るたび、山札の残り枚数×{n}点加算' },
```

- [ ] **Step 2: `shidasu.config.json`の`talismans`を書き換える**

`src/lib/game/shidasu/shidasu.config.json`の`"talismans": { ... }`ブロック(55行目から401行目、`"bridge": {...}`から`"deadline": {...}`まで)を、以下の内容に置き換える。**数値パラメータの値はこのファイル(shidasu.config.json)に現在保存されている値をそのまま維持し、`rarity`・`desc`のみを追加すること**(`shidasu.config.json`はライブチューニング済みの値を持つため、Step 1の`DEFAULT_PARAMS`とは一部の数値が異なる。例えば`bridge.m`は`DEFAULT_PARAMS`では`2`だが`shidasu.config.json`では`1`のままにする)。

```json
  "talismans": {
    "bridge": {
      "name": "架橋",
      "m": 1,
      "rarity": "C",
      "desc": "階段・同スート・同色の成立に必要な枚数を{m}枚緩和"
    },
    "grace": {
      "name": "寛容",
      "m": 2,
      "rarity": "C",
      "desc": "列一掃ボーナスに必要な枚数を{m}枚緩和"
    },
    "patience": {
      "name": "忍耐",
      "x": 500,
      "rarity": "C",
      "desc": "全消しボーナスに残り山札枚数×{x}点を加算"
    },
    "purify": {
      "name": "浄化",
      "n": 10000,
      "rarity": "C",
      "desc": "全消しボーナスに{n}点を加算"
    },
    "temperance": {
      "name": "節制",
      "x": 0.1,
      "rarity": "U",
      "desc": "全消しボーナスを残り山札枚数×{x}分だけ倍加"
    },
    "springBreeze": {
      "name": "春風",
      "n": 100,
      "rarity": "C",
      "desc": "クラブ(♣)を取ったとき、{n}点加算"
    },
    "summerBreeze": {
      "name": "夏風",
      "n": 100,
      "rarity": "C",
      "desc": "ダイヤ(♦)を取ったとき、{n}点加算"
    },
    "autumnBreeze": {
      "name": "秋風",
      "n": 100,
      "rarity": "C",
      "desc": "ハート(♥)を取ったとき、{n}点加算"
    },
    "winterBreeze": {
      "name": "冬風",
      "n": 100,
      "rarity": "C",
      "desc": "スペード(♠)を取ったとき、{n}点加算"
    },
    "kinship": {
      "name": "友愛",
      "n": 200,
      "rarity": "C",
      "desc": "他のスートからハート(♥)を取ったとき、{n}点加算"
    },
    "thaw": {
      "name": "雪解",
      "n": 200,
      "rarity": "C",
      "desc": "スペード(♠)から別のスートを取ったとき、{n}点加算"
    },
    "dusk": {
      "name": "宵闇",
      "n": 100,
      "rarity": "C",
      "desc": "赤から黒に変わったとき、{n}点加算"
    },
    "dawn": {
      "name": "払暁",
      "n": 100,
      "rarity": "C",
      "desc": "黒から赤に変わったとき、{n}点加算"
    },
    "wit": {
      "name": "機知",
      "n": 200,
      "rarity": "C",
      "desc": "ワイルドを取ったとき、{n}点加算"
    },
    "courage": {
      "name": "勇気",
      "x": 0.1,
      "rarity": "R",
      "desc": "コンボ数×{x}分、獲得点を倍加"
    },
    "daybreak": {
      "name": "暁",
      "c": 3,
      "x": 2,
      "rarity": "C",
      "desc": "コンボ数が{c}以下のとき、獲得点を{x}倍"
    },
    "twilight": {
      "name": "黄昏",
      "c": 10,
      "x": 5,
      "rarity": "C",
      "desc": "コンボ数が{c}以上のとき、獲得点を{x}倍"
    },
    "cheerful": {
      "name": "快活",
      "n": 100,
      "rarity": "C",
      "desc": "コンボ数が偶数のとき、{n}点加算"
    },
    "conscience": {
      "name": "良心",
      "n": 100,
      "rarity": "C",
      "desc": "コンボ数が奇数のとき、{n}点加算"
    },
    "morningMist": {
      "name": "朝霧",
      "c": 6,
      "x": 4,
      "rarity": "C",
      "desc": "コンボ数が{c}未満のとき獲得点を1/{x}に、{c}以上のとき{x}倍に"
    },
    "calm": {
      "name": "平穏",
      "n": 200,
      "rarity": "C",
      "desc": "コンボ内にJQKが無いとき、{n}点加算"
    },
    "serenity": {
      "name": "安寧",
      "x": 1.5,
      "rarity": "U",
      "desc": "コンボ内にJQKが無いとき、獲得点を{x}倍"
    },
    "destiny": {
      "name": "運命",
      "n": 400,
      "rarity": "C",
      "desc": "コンボ内がJQKのみのとき、{n}点加算"
    },
    "fate": {
      "name": "宿命",
      "x": 2,
      "rarity": "U",
      "desc": "コンボ内がJQKのみのとき、獲得点を{x}倍"
    },
    "relief": {
      "name": "安堵",
      "n": 100,
      "rarity": "C",
      "desc": "取得したカード1枚のランクが1〜10のとき、{n}点加算"
    },
    "verdantGreen": {
      "name": "深緑",
      "x": 3,
      "rarity": "C",
      "desc": "コンボがクラブ(♣)専有のとき、獲得点を{x}倍"
    },
    "gem": {
      "name": "宝石",
      "x": 3,
      "rarity": "C",
      "desc": "コンボがダイヤ(♦)専有のとき、獲得点を{x}倍"
    },
    "resolve": {
      "name": "真剣",
      "x": 3,
      "rarity": "C",
      "desc": "コンボがスペード(♠)専有のとき、獲得点を{x}倍"
    },
    "grail": {
      "name": "聖杯",
      "x": 3,
      "rarity": "C",
      "desc": "コンボがハート(♥)専有のとき、獲得点を{x}倍"
    },
    "moonlight": {
      "name": "月光",
      "x": 1.5,
      "rarity": "U",
      "desc": "コンボが黒専有のとき、獲得点を{x}倍"
    },
    "sunlight": {
      "name": "陽光",
      "x": 1.5,
      "rarity": "U",
      "desc": "コンボが赤専有のとき、獲得点を{x}倍"
    },
    "crown": {
      "name": "王冠",
      "x": 0.5,
      "rarity": "C",
      "desc": "コンボ内のK枚数×{x}分、獲得点を倍加"
    },
    "cloverLeaf": {
      "name": "青葉",
      "n": 50,
      "rarity": "C",
      "desc": "コンボ内のクラブ(♣)枚数×{n}点を加算"
    },
    "coin": {
      "name": "硬貨",
      "n": 50,
      "rarity": "C",
      "desc": "コンボ内のダイヤ(♦)枚数×{n}点を加算"
    },
    "blade": {
      "name": "武器",
      "n": 50,
      "rarity": "C",
      "desc": "コンボ内のスペード(♠)枚数×{n}点を加算"
    },
    "chalice": {
      "name": "献杯",
      "n": 50,
      "rarity": "C",
      "desc": "コンボ内のハート(♥)枚数×{n}点を加算"
    },
    "balance": {
      "name": "均衡",
      "n": 200,
      "rarity": "C",
      "desc": "コンボ内の赤黒枚数が同数のとき、{n}点加算"
    },
    "harmony": {
      "name": "調和",
      "x": 1.5,
      "rarity": "C",
      "desc": "コンボ内の赤黒枚数が同数のとき、獲得点を{x}倍"
    },
    "nobility": {
      "name": "高潔",
      "n": 200,
      "rarity": "C",
      "desc": "同スートパターン成立時、{n}点加算"
    },
    "tenacity": {
      "name": "執念",
      "x": 0.1,
      "rarity": "R",
      "desc": "同スートパターン成立時、コンボ内枚数×{x}分、獲得点を倍加"
    },
    "determination": {
      "name": "覚悟",
      "x": 0.1,
      "rarity": "R",
      "desc": "階段成立時、階段の長さ×{x}分、獲得点を倍加"
    },
    "cycle": {
      "name": "循環",
      "x": 3,
      "rarity": "C",
      "desc": "KからA、またはAからKを取ったとき、獲得点を{x}倍"
    },
    "reincarnation": {
      "name": "輪廻",
      "x": 10,
      "rarity": "U",
      "desc": "コンプリートラン(全ランク階段)にK↔Aループが含まれるとき、獲得点を{x}倍"
    },
    "majesty": {
      "name": "威光",
      "x": 50,
      "rarity": "U",
      "desc": "同スートかつ全ランク階段を達成したとき、獲得点を{x}倍"
    },
    "omen": {
      "name": "兆し",
      "m": 20,
      "x": 1.5,
      "rarity": "U",
      "desc": "場札の残り枚数が{m}枚以下のとき、獲得点を{x}倍"
    },
    "crescent": {
      "name": "三日月",
      "m": 10,
      "x": 4,
      "rarity": "U",
      "desc": "場札の残り枚数が{m}枚以下のとき、獲得点を{x}倍"
    },
    "blessing": {
      "name": "恩寵",
      "x": 1.5,
      "rarity": "U",
      "desc": "役が成立したとき、獲得点を{x}倍"
    },
    "focus": {
      "name": "集中",
      "x": 3,
      "rarity": "U",
      "desc": "同ランクの役が含まれるとき、獲得点を{x}倍"
    },
    "lapis": {
      "name": "瑠璃",
      "x": 2,
      "rarity": "R",
      "desc": "役ボーナス・パターンボーナス(同スート/同色・階段)をあわせて2種類以上成立したとき、獲得点を{x}倍"
    },
    "jade": {
      "name": "翡翠",
      "n": 200,
      "rarity": "U",
      "desc": "役の成立にワイルドが使われたとき、{n}点加算"
    },
    "emptyMind": {
      "name": "無心",
      "x": 4,
      "rarity": "U",
      "desc": "役・パターンがどちらも無いとき、獲得点を{x}倍"
    },
    "prologue": {
      "name": "序章",
      "n": 500,
      "rarity": "C",
      "desc": "チェーン内でプレイ1枚目のとき、{n}点加算"
    },
    "interlude": {
      "name": "幕間",
      "m": 5,
      "n": 1000,
      "rarity": "C",
      "desc": "チェーン内でプレイちょうど{m}枚目のとき、{n}点加算"
    },
    "morningDew": {
      "name": "朝露",
      "n": 5000,
      "rarity": "C",
      "desc": "ウェーブで最初にプレイしたカードのとき、{n}点加算"
    },
    "drizzle": {
      "name": "小雨",
      "n": 50,
      "rarity": "C",
      "desc": "場札を取るたび、{n}点加算"
    },
    "eternity": {
      "name": "永劫",
      "rarity": "U",
      "desc": "ウェーブ開始時、山札にワイルドを1枚追加(以後のウェーブにも引き継がれる)"
    },
    "abundance": {
      "name": "豊穣",
      "rarity": "U",
      "desc": "ウェーブ開始時、デッキ内の1枚がランダムにワイルドへ変換される(以後のウェーブにも引き継がれる)"
    },
    "silence": {
      "name": "静寂",
      "rarity": "U",
      "desc": "山札めくりで取れる場札が無いままコンボがリセットされた時、めくった札をワイルドに変換する(デッキにも永続的に反映)"
    },
    "resilience": {
      "name": "不屈",
      "p": 30,
      "rarity": "U",
      "desc": "山札が無く場札も取れない手詰まり時、スコアの{p}%を消費して捨て札の半数を山札に戻す"
    },
    "gentleBreeze": {
      "name": "微風",
      "n": 300,
      "rarity": "C",
      "desc": "同じ列を連続でプレイしたとき(2回目以降)、連続回数×{n}点加算"
    },
    "resonance": {
      "name": "共鳴",
      "x": 1,
      "rarity": "U",
      "desc": "同じ列を連続でプレイしたとき(2回目以降)、連続回数×{x}分獲得点を倍加"
    },
    "azureSky": {
      "name": "蒼穹",
      "x": 0.5,
      "rarity": "U",
      "desc": "ウェーブ内で列一掃した累計回数×{x}分、獲得点を倍加"
    },
    "amber": {
      "name": "琥珀",
      "x": 0.1,
      "rarity": "R",
      "desc": "ウェーブ内の最大到達コンボ数×{x}分、獲得点を倍加"
    },
    "composure": {
      "name": "沈着",
      "n": 500,
      "rarity": "C",
      "desc": "山札めくりでコンボリセットされた時、取れる場札が無ければ直接{n}点加算"
    },
    "clarity": {
      "name": "冷静",
      "n": 500,
      "rarity": "C",
      "desc": "コンボリセット時、そのチェーンで役が一つも成立していなければ直接{n}点加算"
    },
    "arrogance": {
      "name": "慢心",
      "x": 50,
      "rarity": "C",
      "desc": "山札が無くなった時、場札の残り枚数×{x}点を直接加算"
    },
    "echo": {
      "name": "残響",
      "n": 200,
      "rarity": "U",
      "desc": "コンボがリセットされる瞬間、リセット前のコンボ数×{n}点を直接加算"
    },
    "shootingStar": {
      "name": "流星",
      "c": 10,
      "p": 10,
      "rarity": "R",
      "desc": "コンボ数が{c}に到達した瞬間、獲得点を加算した後の現在スコアの{p}%を直接加算"
    },
    "naive": {
      "name": "素朴",
      "rarity": "C",
      "desc": "山札めくりがパターン継続だった場合、通常のプレイと同様に得点計算する(コンボ数も加算)"
    },
    "intuition": {
      "name": "直感",
      "x": 0.3,
      "rarity": "U",
      "desc": "(素朴と組み合わせて機能)現在のチェーン中に山札めくりでコンボ継続した回数×{x}分、獲得点を倍加"
    },
    "sincerity": {
      "name": "誠実",
      "n": 300,
      "rarity": "C",
      "desc": "山札めくりで同色パターンによりコンボ継続した時、直接{n}点加算"
    },
    "promise": {
      "name": "約束",
      "rarity": "R",
      "desc": "山札の次のカードが、今のコンボが継続できるカードになる"
    },
    "darkClouds": {
      "name": "暗雲",
      "r": 1,
      "rarity": "U",
      "desc": "ウェーブ開始時、場札が{r}行多く配られる"
    },
    "regeneration": {
      "name": "再生",
      "p": 50,
      "rarity": "R",
      "desc": "全消し時、スコアの{p}%を消費して捨て札から場札を復活させる(復活すればウェーブ継続)"
    },
    "benevolence": {
      "name": "博愛",
      "rarity": "R",
      "desc": "コンボごとに1回、コンボリセットを無効化する"
    },
    "healing": {
      "name": "治癒",
      "rarity": "U",
      "desc": "列一掃時、捨て札から最大{rows}枚を空いた列へ戻す"
    },
    "guidance": {
      "name": "導き",
      "rarity": "U",
      "desc": "山札の次のカードが見えるようになる"
    },
    "passion": {
      "name": "情熱",
      "x": 1.5,
      "rarity": "U",
      "desc": "このコンボ中にフラッシュが成立していれば、獲得点を{x}倍"
    },
    "fightingSpirit": {
      "name": "闘志",
      "x": 1.3,
      "rarity": "U",
      "desc": "このウェーブ中に列一掃が発生していれば、獲得点を{x}倍"
    },
    "sanctify": {
      "name": "祝福",
      "rarity": "R",
      "desc": "役を揃えるたび基礎コンボ数+1。コンボリセット時、0ではなく基礎コンボ数から再開する"
    },
    "protection": {
      "name": "庇護",
      "c": 3,
      "rarity": "U",
      "desc": "コンボ数(計算用)が{c}未満のとき、{c}として計算する"
    },
    "earth": {
      "name": "大地",
      "c": 2,
      "rarity": "R",
      "desc": "コンボ数(計算用)に常に{c}を加算する"
    },
    "golden": {
      "name": "黄金",
      "rarity": "R",
      "desc": "コンボが1回進むたびに、通常の+1ではなく+2進む"
    },
    "morningStar": {
      "name": "明星",
      "x": 0.2,
      "rarity": "R",
      "desc": "役ボーナスの額を、その役のウェーブ内累積成立回数×{x}分だけ倍加"
    },
    "mercy": {
      "name": "慈悲",
      "c": 3,
      "x": 2,
      "rarity": "U",
      "desc": "コンボ数が{c}以下でリセットされたとき、次のコンボの間、獲得点を{x}倍"
    },
    "mirror": {
      "name": "水鏡",
      "rarity": "R",
      "desc": "役が成立するたび(コンボ中1回、同ランクは枚数ごとに1回)、次のプレイで同じ役ボーナスを追加でもう一度加算する"
    },
    "deadline": {
      "name": "刻限",
      "n": 10,
      "rarity": "U",
      "desc": "カードを取るたび、山札の残り枚数×{n}点加算"
    }
  },
```

- [ ] **Step 3: 型チェック・ビルド**

Run: `npm run check && npm run build`
Expected: どちらもエラーなく成功。`npm run test`も実行し、既存テストが壊れていないことを確認する(Task 3で更新するテスト1件のみ、この時点ではまだ失敗する可能性がある。Task 3で対応する)。

- [ ] **Step 4: コミット**

```bash
git add src/lib/game/shidasu/params.ts src/lib/game/shidasu/shidasu.config.json
git commit -m "$(cat <<'EOF'
feat: 全87護符にrarity・desc初期値を設定

レア度はdocs/shidasu-gofu-candidates.mdのC/U/R分類から移行した。
説明文テンプレートは既存のitemDesc switch文の出力と完全一致する
よう機械的に導出した(架橋・寛容の2護符のみ、次タスクでの簡素化に
合わせた文言にしている)。数値パラメータの既存値はどちらのファイルも
変更していない。
EOF
)"
```

---

### Task 3: `itemDesc`をテンプレート置換方式に書き換える

**Files:**
- Modify: `src/lib/game/shidasu/engine.ts`
- Modify: `src/lib/game/shidasu/engine.test.ts`

- [ ] **Step 1: 失敗するテストに更新する**

`src/lib/game/shidasu/engine.test.ts`の

```ts
  test('itemDescはパラメータの数値を埋め込んだ説明文を返す', () => {
    expect(itemDesc('bridge', DEFAULT_PARAMS)).toContain(String(DEFAULT_PARAMS.scoring.stairMinLen))
    expect(itemDesc('bridge', DEFAULT_PARAMS)).toContain(String(DEFAULT_PARAMS.scoring.stairMinLen - DEFAULT_PARAMS.talismans.bridge.m))
    expect(itemDesc('grace', DEFAULT_PARAMS)).toContain(String(DEFAULT_PARAMS.layout.rows))
    expect(itemDesc('grace', DEFAULT_PARAMS)).toContain(String(DEFAULT_PARAMS.layout.rows - DEFAULT_PARAMS.talismans.grace.m))
  })
```

を、以下に置き換える。

```ts
  test('itemDescはパラメータの数値を埋め込んだ説明文を返す', () => {
    expect(itemDesc('bridge', DEFAULT_PARAMS)).toContain(String(DEFAULT_PARAMS.talismans.bridge.m))
    expect(itemDesc('grace', DEFAULT_PARAMS)).toContain(String(DEFAULT_PARAMS.talismans.grace.m))
    expect(itemDesc('daybreak', DEFAULT_PARAMS)).toContain(String(DEFAULT_PARAMS.talismans.daybreak.c))
    expect(itemDesc('daybreak', DEFAULT_PARAMS)).toContain(String(DEFAULT_PARAMS.talismans.daybreak.x))
  })

  test('itemDescは未知のプレースホルダーがあってもクラッシュせずそのまま残す', () => {
    const params = JSON.parse(JSON.stringify(DEFAULT_PARAMS)) as typeof DEFAULT_PARAMS
    params.talismans.purify.desc = '全消しボーナスに{n}点を加算({typo}は置換されない)'
    expect(itemDesc('purify', params)).toBe(`全消しボーナスに${DEFAULT_PARAMS.talismans.purify.n}点を加算({typo}は置換されない)`)
  })
```

- [ ] **Step 2: テストを実行して失敗を確認する**

Run: `npx vitest run engine.test -t "itemDescはパラメータの数値を埋め込んだ説明文を返す"`
Expected: FAIL(現行の`itemDesc('bridge', ...)`はまだ`stairMinLen`の計算値を含む旧文言を返すため、新テストの「架橋・寛容はm値のみ含む」という期待とは一致するが、`daybreak`のテストはswitch文実装でも既にc/xを含むため実質PASSしてしまう可能性がある。**このタスクの本質的な検証は次のStep 4で「未知のプレースホルダー」テストが現行実装(switch文)に対して意味を持たない=型エラーになることで確認する**。`npx vitest run`ではなく`npm run check`で、`params.talismans.purify.desc`への代入が現行の型(`desc`フィールド無し)でエラーになることを確認すること。)

- [ ] **Step 3: `itemDesc`を実装する**

`src/lib/game/shidasu/engine.ts`の`itemDesc`関数全体(1318行目`export function itemDesc(id: ItemId, params: ShidasuParams): string {`から、対応する`}`まで、90ケース近いswitch文全体)を、以下に置き換える。

```ts
export function itemDesc(id: ItemId, params: ShidasuParams): string {
  const entry = params.talismans[id] as unknown as Record<string, unknown> & { desc: string }
  const context: Record<string, number> = { rows: params.layout.rows }
  for (const [key, value] of Object.entries(entry)) {
    if (typeof value === 'number') context[key] = value
  }
  return entry.desc.replace(/\{(\w+)\}/g, (match, key) => (key in context ? String(context[key]) : match))
}
```

- [ ] **Step 4: テストを実行して成功を確認する**

Run: `npm run test`
Expected: 全テスト成功

- [ ] **Step 5: 型チェック・ビルド**

Run: `npm run check && npm run build`
Expected: どちらもエラーなく成功

- [ ] **Step 6: コミット**

```bash
git add src/lib/game/shidasu/engine.ts src/lib/game/shidasu/engine.test.ts
git commit -m "$(cat <<'EOF'
feat: itemDescをテンプレート置換方式に書き換え

90ケース近いswitch文を、各護符のdescテンプレート内の{パラメータ名}を
実際の数値に置換する単純な処理に置き換えた。未知のプレースホルダーは
置換せずそのまま残す(クラッシュしない安全側の挙動)。
EOF
)"
```

---

### Task 4: 管理画面に「レア度」列を追加する

**Files:**
- Modify: `src/routes/admin/shidasu-talismans/+page.svelte`

- [ ] **Step 1: `TalismanEntry`型・`talismanParamKeys`・`hasValidationError`を変更する**

`src/routes/admin/shidasu-talismans/+page.svelte`の

```svelte
  type TalismanEntry = { name: string } & Record<string, number>

  function talismanEntry(id: ItemId): TalismanEntry {
    return config!.talismans[id] as unknown as TalismanEntry
  }

  function talismanParamKeys(id: ItemId): string[] {
    return Object.keys(talismanEntry(id)).filter(key => key !== 'name')
  }

  let hasValidationError = $derived.by(() => {
    if (!config) return false
    return ITEM_GROUPS.some(group => group.ids.some(id => {
      const entry = talismanEntry(id)
      if (!entry.name.trim()) return true
      return talismanParamKeys(id).some(key => !Number.isFinite(entry[key]))
    }))
  })
```

を、以下に置き換える。

```svelte
  type TalismanEntry = { name: string; rarity: 'C' | 'U' | 'R'; desc: string } & Record<string, number | string>

  function talismanEntry(id: ItemId): TalismanEntry {
    return config!.talismans[id] as unknown as TalismanEntry
  }

  function talismanParamKeys(id: ItemId): string[] {
    return Object.keys(talismanEntry(id)).filter(key => key !== 'name' && key !== 'rarity' && key !== 'desc')
  }

  let hasValidationError = $derived.by(() => {
    if (!config) return false
    return ITEM_GROUPS.some(group => group.ids.some(id => {
      const entry = talismanEntry(id)
      if (!entry.name.trim()) return true
      if (!entry.desc.trim()) return true
      return talismanParamKeys(id).some(key => !Number.isFinite(entry[key] as number))
    }))
  })
```

- [ ] **Step 2: バリデーションメッセージを変更する**

```svelte
        <p class="text-xs text-red-600 self-center">護符名またはパラメータが空(未入力)の項目があります</p>
```

を、以下に置き換える。

```svelte
        <p class="text-xs text-red-600 self-center">護符名・説明文テンプレートが空、またはパラメータが未入力の項目があります</p>
```

- [ ] **Step 3: テーブルヘッダーとレア度セルを追加する**

```svelte
              <thead>
                <tr class="bg-slate-50 text-slate-500">
                  <th class="px-2 py-1.5 text-left" style="width:9rem;">護符名</th>
                  <th class="px-2 py-1.5 text-left" style="width:11rem;">パラメータ</th>
                  <th class="px-2 py-1.5 text-left">説明文プレビュー</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100">
                {#each group.ids as id (id)}
                  {@const entry = talismanEntry(id)}
                  <tr>
                    <td class="px-2 py-1.5 align-top">
                      <input type="text" bind:value={entry.name} class="w-full border border-slate-200 rounded px-1.5 py-0.5" />
                    </td>
                    <td class="px-2 py-1.5 align-top">
```

を、以下に置き換える。

```svelte
              <thead>
                <tr class="bg-slate-50 text-slate-500">
                  <th class="px-2 py-1.5 text-left" style="width:9rem;">護符名</th>
                  <th class="px-2 py-1.5 text-left" style="width:4rem;">レア度</th>
                  <th class="px-2 py-1.5 text-left" style="width:11rem;">パラメータ</th>
                  <th class="px-2 py-1.5 text-left">説明文プレビュー</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100">
                {#each group.ids as id (id)}
                  {@const entry = talismanEntry(id)}
                  <tr>
                    <td class="px-2 py-1.5 align-top">
                      <input type="text" bind:value={entry.name} class="w-full border border-slate-200 rounded px-1.5 py-0.5" />
                    </td>
                    <td class="px-2 py-1.5 align-top">
                      <select bind:value={entry.rarity} class="w-full border border-slate-200 rounded px-1 py-0.5">
                        <option value="C">C</option>
                        <option value="U">U</option>
                        <option value="R">R</option>
                      </select>
                    </td>
                    <td class="px-2 py-1.5 align-top">
```

- [ ] **Step 4: 型チェック・ビルド**

Run: `npm run check && npm run build`
Expected: どちらもエラーなく成功

- [ ] **Step 5: ブラウザで確認する**

`npm run dev`で起動し、`/admin/shidasu-talismans`を開き、「レア度」列がC/U/Rの選択肢を持つセレクトボックスとして表示され、各護符に`docs/shidasu-gofu-candidates.md`と対応する初期値が入っていることを確認する(例: 架橋=C、勇気=R)。選択を変更できることも確認する。**保存(`保存`ボタン)は押さないこと**(`shidasu.config.json`への書き込みは最終タスクでまとめて確認する)。

- [ ] **Step 6: コミット**

```bash
git add src/routes/admin/shidasu-talismans/+page.svelte
git commit -m "$(cat <<'EOF'
feat: 護符管理画面にレア度編集列を追加

護符名の隣にC/U/Rを選択できるレア度列を追加した。バリデーションは
既存の護符名チェックと同様、説明文テンプレートの空文字チェックも
あわせて追加した(次タスクで使う説明文テンプレート編集のための準備)。
EOF
)"
```

---

### Task 5: 管理画面の説明文を「編集可能なテンプレート」と「プレビュー」に分割する

**Files:**
- Modify: `src/routes/admin/shidasu-talismans/+page.svelte`

- [ ] **Step 1: テーブルヘッダーを変更する**

`src/routes/admin/shidasu-talismans/+page.svelte`の(Task 4で変更済みの状態から)

```svelte
                  <th class="px-2 py-1.5 text-left" style="width:11rem;">パラメータ</th>
                  <th class="px-2 py-1.5 text-left">説明文プレビュー</th>
```

を、以下に置き換える。

```svelte
                  <th class="px-2 py-1.5 text-left" style="width:11rem;">パラメータ</th>
                  <th class="px-2 py-1.5 text-left" style="width:16rem;">説明文テンプレート</th>
                  <th class="px-2 py-1.5 text-left">プレビュー</th>
```

- [ ] **Step 2: 説明文プレビューのセルを、編集可能なテンプレート欄とプレビュー欄の2つに分割する**

```svelte
                    <td class="px-2 py-1.5 align-top text-slate-500">{itemDesc(id, config)}</td>
```

を、以下に置き換える。

```svelte
                    <td class="px-2 py-1.5 align-top">
                      <textarea
                        bind:value={entry.desc}
                        rows="2"
                        class="w-full border border-slate-200 rounded px-1.5 py-0.5 font-mono text-[11px]"
                      ></textarea>
                    </td>
                    <td class="px-2 py-1.5 align-top text-slate-500">{itemDesc(id, config)}</td>
```

- [ ] **Step 3: 型チェック・ビルド**

Run: `npm run check && npm run build`
Expected: どちらもエラーなく成功

- [ ] **Step 4: ブラウザで確認する**

`npm run dev`で起動し、`/admin/shidasu-talismans`を開き、以下を確認する。

- 各護符行に「説明文テンプレート」(編集可能、`{n}`等のプレースホルダーを含む現在のテンプレートが表示されている)と「プレビュー」(実際の数値に置換された文言)の2列があること
- 「説明文テンプレート」の内容を書き換えると、「プレビュー」列がリアルタイムに更新されること(例: 「春風」のテンプレートを`クラブ(♣)を取ったとき、{n}点加算(テスト編集)`に書き換えると、プレビューが`クラブ(♣)を取ったとき、100点加算(テスト編集)`のように即座に変わる)
- 説明文テンプレートを空にすると、ページ上部に赤いバリデーションエラーメッセージが表示され、「保存」ボタンが無効化されること
- 空にした内容を元に戻すとエラーが消え、「保存」ボタンが再度有効になること

**保存(`保存`ボタン)は押さないこと**(`shidasu.config.json`への書き込みは最終タスクでまとめて確認する)。

- [ ] **Step 5: コミット**

```bash
git add src/routes/admin/shidasu-talismans/+page.svelte
git commit -m "$(cat <<'EOF'
feat: 護符管理画面の説明文をテンプレート編集+プレビューに分割

これまで読み取り専用だった「説明文プレビュー」列を、編集可能な
「説明文テンプレート」(テキストエリア)と、置換済みの実際の表示文言を
リアルタイムに表示する「プレビュー」の2列に分割した。
EOF
)"
```

---

### Task 6: 最終確認

**Files:** なし(検証のみ)

- [ ] **Step 1: テスト・型チェック・ビルド**

Run: `npm run test && npm run check && npm run build`
Expected: `npm run test`は全テスト成功。`npm run check`・`npm run build`はどちらもエラーなく成功。

- [ ] **Step 2: ブラウザで受け入れ基準を確認する**

`npm run dev`で起動する前に、`src/lib/game/shidasu/shidasu.config.json`を一時的にバックアップする(例: `cp src/lib/game/shidasu/shidasu.config.json /tmp/shidasu.config.json.bak`)。これは`/admin/shidasu-talismans`の「保存」ボタンが`/api/admin/shidasu-config`経由でこのファイルを実際に書き換えるため、確認後に元の内容へ戻せるようにするための保険。

`npm run dev`で起動し、`docs/superpowers/specs/2026-07-18-shidasu-talismans-rarity-and-desc-template-design.md`の受け入れ基準8項目を順に確認する。

1. `/admin/shidasu-talismans`の各護符行に「レア度」列があり、C/U/Rを選択・保存できる
2. `DEFAULT_PARAMS`の87護符全てに`rarity`初期値が設定されている(`docs/shidasu-gofu-candidates.md`の分類を移行したもの)
3. `rollItemOffer`の抽選ロジック・確率が変更されていないこと(`src/lib/game/shidasu/engine.ts`の`rollItemOffer`関数の中身を確認し、本プランで変更していないことを確認する)
4. `/admin/shidasu-talismans`の各護符行に、編集可能な「説明文テンプレート」欄と「プレビュー」欄がある
5. 説明文テンプレートを編集すると、プレビューがリアルタイムに更新される
6. `itemDesc(id, params)`が、switch文ではなくテンプレート置換によって、既存とほぼ同じ文言を返す(「架橋」「寛容」のみ簡素化された文言になる) — `/game/shidasu`でプレイし、護符選択画面の説明文が正しく表示されることを確認する
7. 説明文テンプレートが空文字の場合、護符名が空の場合と同様に保存がブロックされる
8. `npm run test`・`npm run build`・`npm run check`が成功する(Step 1で確認済み)

確認後、`/admin/shidasu-talismans`でいずれかの護符のレア度または説明文テンプレートを実際に変更して「保存」を押し、リロード後も変更が保持されていることを確認する。確認が終わったら、バックアップした`shidasu.config.json`を元に戻す(`cp /tmp/shidasu.config.json.bak src/lib/game/shidasu/shidasu.config.json`)か、`git checkout -- src/lib/game/shidasu/shidasu.config.json`で元の内容に戻し、`git status`でこのファイルに意図しない差分が残っていないことを確認する。

- [ ] **Step 3: 完了報告**

問題があれば修正してから完了とする。新規コミットは不要(Task 1〜5で既にコミット済み)。

---

## 自己レビュー結果

- **spec カバレッジ:** spec 1.1(レア度データモデル)→ Task 1・2、1.2(レア度管理画面)→ Task 4、1.3(スコープ外・rollItemOffer不変)→ Task 6 Step 2の受け入れ基準3で確認、2.2(説明文データモデル)→ Task 1・2、2.3(itemDesc実装)→ Task 3、2.4(説明文管理画面)→ Task 5。受け入れ基準8項目は全てTask 6のブラウザ確認手順に列挙済み。
- **プレースホルダースキャン:** 「TBD」「後で実装」等の記述なし。全87護符分の`rarity`・`desc`データは実際に検証済みの値をそのまま埋め込んでいる(既存`itemDesc`出力との完全一致をvitestで検証済み)。
- **型・シグネチャ整合性:** `TalismanEntry`型(Task 4で`{ name: string; rarity: 'C'|'U'|'R'; desc: string } & Record<string, number | string>`に変更)・`talismanParamKeys`(rarity/descを除外するようTask 4で変更)・`hasValidationError`(desc空チェックをTask 4で追加)は、Task 5で参照する`entry.desc`と矛盾なく一貫している。`itemDesc`のシグネチャ(`(id: ItemId, params: ShidasuParams): string`)はTask 3前後で変更していない。
