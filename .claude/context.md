# Utilities-Svelte - Claude Code コンテキスト

## プロジェクト概要
SvelteKit（Svelte 5 / TypeScript）で作られた単機能ツール集サイト。
日本語・英語ユーザー向けに様々な便利ツールを提供する。

## リポジトリ・公開情報
- リポジトリ: https://github.com/kuroto-96X/Utilities-Svelte
- 公開URL: https://96xtools.dev
- ホスティング: Cloudflare Pages（プロジェクト名: utilities-svelte）
- デプロイ: masterブランチへのpushで自動デプロイ（GitHub Actions）

## 技術スタック
- SvelteKit（Svelte 5）
- TypeScript
- Tailwind CSS v3
- Vite（ビルドツール）
- `@sveltejs/adapter-static`（静的サイト出力）
- GitHub Actions（自動ビルド・デプロイ）
- Cloudflare Pages（ホスティング・CDN・Git連携）
- 独自ドメイン: 96xtools.dev（Cloudflare Pagesのカスタムドメインで設定済み）

## デプロイの仕組み
1. `master` ブランチに push すると GitHub Actions が起動
2. `npm install && npm run build` でビルド（出力先: `dist/`）
3. `static/_redirects` を `dist/_redirects` にコピー（SPA用リダイレクト）
4. `peaceiris/actions-gh-pages` が `dist/` の中身を `deploy` ブランチに push
5. Cloudflare Pages が `deploy` ブランチを検知して自動デプロイ
6. 公開URL: https://96xtools.dev に反映される

※ Cloudflare Pages は `deploy` ブランチをビルドなしで直接配信する設定（ビルドは GitHub Actions 側で完結）

## プロジェクト構成
```
Utilities-Svelte/
├── src/
│   ├── app.html              ← HTMLエントリーポイント
│   ├── app.css               ← グローバルCSS（Tailwind含む）
│   ├── app.d.ts
│   ├── lib/
│   │   ├── index.ts          ← 共通エクスポート
│   │   └── assets/
│   │       └── favicon.svg
│   └── routes/
│       ├── +layout.ts        ← prerender=true, trailingSlash='always'
│       ├── +layout.svelte    ← 共通レイアウト
│       ├── +page.svelte      ← トップページ
│       └── bpm-tapper/
│           └── +page.svelte  ← BPMタッパーツール
├── static/
│   └── _redirects            ← Cloudflare Pages用SPAリダイレクト
├── .github/
│   └── workflows/
│       └── deploy.yml        ← GitHub Actionsデプロイ設定
└── .claude/
    └── context.md            ← このファイル
```

## 新しいツールの追加ルール
- `src/routes/ツール名/+page.svelte` を作成する（SvelteKitのファイルベースルーティング）
- ルートパスは自動的にディレクトリ名になる（例: `src/routes/json-formatter/` → `/json-formatter/`）
- 1ファイルで完結させる（外部依存は最小限に）
- トップページ（`src/routes/+page.svelte`）にツールへのリンクを追加する

## コーディング規約
- 言語: TypeScript（Svelte 5 の runes 構文を使用）
- スタイリング: Tailwind CSS（インラインクラス優先）
- コメント: 日本語でOK
- コンポーネント名: PascalCase
- ルートパス: kebab-case（例: `/bpm-tapper/`）
- Svelte 5 runes: `$state()`, `$derived()`, `$effect()`, `$props()` を使う（`let` + `$:` は使わない）

## タスク完了条件
以下をすべて満たしてからコミットすること：
1. `npm run check` がエラーなく通る
2. `npm run build` を実行してビルドが成功することを確認する
3. `npm run preview` でビルド成果物を起動し、対象ツールのURL（例: `http://localhost:4173/bpm-tapper/`）をブラウザで開いて動作確認する
4. `git add . && git commit -m "メッセージ"` まで完了（pushは行わない）
5. push・デプロイが必要な場合は作業者に伝えて判断を委ねる
