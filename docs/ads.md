# 広告の仕様

現段階(2026-07-04時点)で導入済みの広告(忍者AdMax)の仕様をまとめる。

## 全体方針

- 広告ネットワークは **忍者AdMax** のみ使用(Google AdSenseは審査落ちのため未使用。`src/app.html`にAdSense用スクリプトタグは残っているが、審査未承認のため広告は配信されない)
- 全ての広告表示は `src/lib/site.config.json` の `adsEnabled` フラグで一括ON/OFFできる
- `adsEnabled` は `/admin/menu` の管理画面(「広告を表示する」チェックボックス)から切り替え可能
- ⚠️ **このサイトは静的サイトのため、管理画面での切り替えは即座に本番へ反映されない**。切り替え後は `npm run build` → `master`へマージ・デプロイが必要(詳細は[deployment.md](./deployment.md)参照)

## 広告コンポーネント

### 1. `AdSlot.svelte` — 下部広告(正方形型)

パス: `src/lib/components/AdSlot.svelte`

- ページ下部に「スポンサーリンク」ラベル付きで表示する**正方形型**広告(横長バナーではない)
- PC用・スマホ用で別々の広告タグをCSS(`hidden sm:block` / `sm:hidden`、`sm`ブレークポイント=640px)で出し分け。両方のタグは常にDOM上に存在し、表示のみCSSで切り替える方式(レスポンシブ広告の標準的なやり方)
- `flex justify-center` で中央寄せ
- PC用・スマホ用とも`div.admax-ads` + `admaxads.push(...)` + `t.js`読み込みの非同期形式(type: `banner`)。スマホ用は`width`/`height`が指定されておらず、広告配信されるまでは0×0のプレースホルダーになる(仕様通り)

| 用途 | admax_id | サイズ |
|---|---|---|
| PC用 | `ffea59a79b77bc4160ffc29d36cc7305` | 300×250 |
| スマホ用 | `09107acc80b232772e6dd49af94b902f` | 指定なし(可変) |

**設置ページ**: トップページ(`/`)、BPM Tapper、Note Duration、Color32/Color変換(説明文の直前)、ソリティア(説明文の直前)

**設置方法**: 該当ページの`<script>`部で `import AdSlot from '$lib/components/AdSlot.svelte'` し、ページ下部に `<AdSlot />` を置くだけ。

### 2. `AdSlotBanner.svelte` — 横長バナー広告(PC 728×90 / スマホ可変)

パス: `src/lib/components/AdSlotBanner.svelte`

- PC用は728×90のインライン横長バナー(`hidden sm:flex sm:justify-center`)、スマホ用は`AdSlot`のスマホ用タグと同じ広告ユニット(`09107acc80b232772e6dd49af94b902f`、`flex justify-center sm:hidden`)を再利用
- ドキュメントフロー内にそのまま配置する(`AdSlotSide`と違い`fixed`ではない)ので、コンテンツの一部として置きたい場所に置く

| 用途 | admax_id | サイズ |
|---|---|---|
| PC用 | `cf791649e9fcf5651a3fd3f50faa8366` | banner(728×90) |
| スマホ用 | `09107acc80b232772e6dd49af94b902f` | `AdSlot`と共通、指定なし(可変) |

**設置ページ**: Scale Visualizer(旧`AdSlot`から差し替え)、ヘボン式変換(変換表の直前)

### 3. `AdSlotSide.svelte` — 右サイド縦バー広告(PCのみ)

パス: `src/lib/components/AdSlotSide.svelte`

- 160×600のインライン縦バー広告(admax type: `banner`)
- `position: fixed`(画面右端から16px、上端から80px)で自前配置。ドキュメントフローに影響しないため、ページ全体のレイアウトシフトは起きない
- PCのみ表示(`hidden sm:block`)。スマホでは非表示(ただしタグ自体はDOMに存在するため、広告リクエスト自体はスマホでも発生する)

| admax_id | 種別 |
|---|---|
| `6ad394d0af0dc87e305be228ab209d78` | banner(160×600) |

**設置ページ**: トップページ(`/`)、BPM Tapper、Note Duration、ヘボン式変換、Color32/Color変換、ソリティア

**経緯**: 当初は非同期の`type: "action"`広告(admax_id: `3d1c39d315c6f0ce03951ff6bc2e34f6`)を使っていたが、その広告自体がページ全体を左にずらすレイアウト崩れを起こしたため、自前でfixed配置できるインライン広告タグに差し替えた。

### 4. `AdSlotSideLeft.svelte` — 左サイド縦バー広告(PCのみ)

パス: `src/lib/components/AdSlotSideLeft.svelte`

- `AdSlotSide`と同一構造(160×600、`position: fixed`、上端から80px)で、左右を反転して画面左端から16pxに配置(`left-4`)
- PCのみ表示(`hidden sm:block`)

| admax_id | 種別 |
|---|---|
| `dd3a4be55bd43292951788645b89bdad` | banner(160×600) |

**設置ページ**: トップページ(`/`)、BPM Tapper、Note Duration、ヘボン式変換、Color32/Color変換、ソリティア

## `ads.txt`

パス: `src/routes/ads.txt/+server.ts`

- `/ads.txt` へのアクセス時、`adsEnabled` が `true` なら忍者AdMax指定の販売者リスト(684行)を、`false` なら空文字列を返す
- なりすまし広告枠を防ぐため、AdMax側から発行された内容をそのまま組み込んでいる(admax_id等ではなく販売者ドメインの一覧なので、上記の個別広告ユニットIDとは無関係)
- `export const prerender = true` によりビルド時に静的ファイルとして生成される

## 広告表示の技術的な注意点

- 各ページの`+page.svelte`に直接`<AdSlot />`/`<AdSlotBanner />`/`<AdSlotSide />`/`<AdSlotSideLeft />`を置く設計にしている(共通レイアウトの`+layout.svelte`には置いていない)。これは、SvelteKitのクライアントサイド遷移(SPAナビゲーション)ではページコンポーネントごと破棄・再生成されるため、ページに広告タグを直接置くだけで遷移のたびに正しく再読み込みされることをPlaywrightで実測確認済みのため。仮に`+layout.svelte`側に広告を移動する場合は、レイアウトはページ遷移時に再生成されないため、`onMount`でのスクリプト動的挿入や`afterNavigate`での再読み込み処理が別途必要になる。
- 全ページをprerenderする構成([deployment.md](./deployment.md)参照)になっているため、トップページも含めて広告タグはビルド時に静的HTMLへ直接埋め込まれる(以前は`fallback`ファイルとの衝突でトップページの広告だけ消えるバグがあったが解消済み)。

## 新しいページに広告を追加する手順

1. 対象の`+page.svelte`で、使いたい広告コンポーネント(`AdSlot` / `AdSlotBanner` / `AdSlotSide` / `AdSlotSideLeft`)をimportする
2. 表示したい位置に配置するだけ。`adsEnabled`の判定は各コンポーネント内で完結しているので呼び出し側で気にする必要はない
