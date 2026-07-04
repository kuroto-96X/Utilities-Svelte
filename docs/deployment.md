# デプロイの仕組み

調査により判明したホスティング・CI/CDの構成をまとめる。

## ホスティング

- **ホスティング先**: Cloudflare Pages(Netlifyではない。`static/_redirects` / `static/_headers` はNetlify由来の記法だが、Cloudflare Pagesも同じフォーマットをサポートしているため利用している)
- **ドメイン**: `https://96xtools.dev/`(DNSはCloudflareでプロキシされている)
- **Cloudflareプロジェクト名**: `utilities-svelte`(プレビューURLは `https://<hash>.utilities-svelte.pages.dev` の形)
- **GitHubリポジトリ**: `kuroto-96X/Utilities-Svelte`

## CI/CDパイプライン

`.github/workflows/deploy.yml` が全体のビルド・デプロイを担っている。

```yaml
on:
  push:
    branches: [ master ]

jobs:
  deploy:
    steps:
      - checkout
      - npm install
      - npm run build          # dist/ に静的ファイルを生成
      - cp static/_redirects dist/_redirects   # (npm run buildで既にコピーされているため実質冗長)
      - peaceiris/actions-gh-pages で dist/ を deploy ブランチへpush
```

流れ:

1. **`master` ブランチへのpush**でのみワークフローが起動する(`feat`など他ブランチのpushでは何も起きない)
2. ビルド成果物(`dist/`)を丸ごと **`deploy` ブランチ**にpush(`deploy: <元コミットハッシュ>` というコミットメッセージで記録される)
3. **Cloudflare Pages は `deploy` ブランチをそのまま配信している**だけで、Cloudflare側では一切ビルドを行わない
   - Cloudflareのプロジェクト設定画面で「Build command」「Build output」「Root directory」が全て空欄になっているのはこのため(ビルド済みファイルが既に`deploy`ブランチに存在するので、Cloudflare側のビルドが不要)
   - Cloudflare側の **Production branch は `deploy`**(`master`ではない)

## ブランチの役割

| ブランチ | 役割 |
|---|---|
| `feat`(や他の作業ブランチ) | 開発作業用。pushしても何もデプロイされない |
| `master` | 開発のメインブランチ。**pushすると本番デプロイのワークフローが走る**(実質的に本番デプロイ操作そのもの) |
| `deploy` | ビルド済み静的ファイルを格納するブランチ。GitHub Actionsが自動生成・push。手動で触らない |

## 重要な注意点

- **プレビュー環境が存在しない**。`master`以外のブランチをCloudflare Pages側に直接pushしても、Cloudflareはビルドを行わないため、ソースツリーがそのまま配信されて404だらけになる(実際に`feat`で試して確認済み)。
- そのため、**`master`へのpush = 即本番反映**である。CLAUDE.mdの「masterへのマージ・プッシュはユーザーが手動で行う」という規約は、この実際のデプロイ挙動と直結しているため厳守すること。
- 安全に変更を試したい場合、現状は以下のいずれかが必要:
  - ローカルの `npm run build` + `npm run preview` である程度検証してから、覚悟を決めて`master`にpushする
  - `.github/workflows/deploy.yml` を改修し、`feat`などの別ブランチ用に別のdeployブランチ/別Cloudflareプロジェクトへ配信する仕組みを別途用意する(未実施)

## 既知の問題: フォールバックファイルの衝突(2026-07-04調査、未解決)

`svelte.config.js` は `@sveltejs/adapter-static` を使っており、`prerender = false` の非公開ツールページ(NISA計算機など)があるため `fallback` オプションの設定が必須になっている。

### 症状

トップページ(`/`)にだけ広告(`AdSlot.svelte`)が表示されない。他のページ(BPM Tapperなど)は正常。

### 原因

`fallback: 'index.html'` に設定すると、SvelteKitが生成する「空のSPA起動シェル」の出力先も `dist/index.html` になり、**トップページ本来のプリレンダー済みファイルと出力パスが衝突する**。ビルド時にフォールバック生成が後から実行され、本来の中身(広告タグ含む)を上書きしてしまう(ビルドログの `Overwriting dist\index.html with fallback page.` がこれ)。

比較:
- `.svelte-kit/output/prerendered/pages/index.html`(本来の中身): 10,661 bytes、広告タグを含む
- `dist/index.html`(実際に配信される中身): 1,922 bytes、空のSPAシェルのみ

### これまで試して失敗した対策

1. **`fallback: '200.html'` に変更** → Cloudflare Pagesは`.html`拡張子のURLを拡張子なしURLへ自動リダイレクトする仕様があり(`/200.html` → `/200`)、`_redirects`の`/* /200.html 200`ルールと組み合わさって**無限リダイレクトループ**が発生し、サイト全体がダウンした(トップページだけでなく、実ファイルが存在する他ページも巻き込まれた)。`6ed747a`で緊急ロールバック。
2. **`fallback: 'spa-fallback'`(拡張子なし)+ `static/_headers` で `/spa-fallback` に `Content-Type: text/html` を強制指定** → リダイレクトループは回避できたが、`_redirects`の書き換え(`/* /spa-fallback 200`)によって`/`へのリクエストが実際には`spa-fallback`の中身を返す際、`_headers`のパスマッチングが**書き換え後のパスではなくブラウザがリクエストした元のパス(`/`)に対して評価される**らしく、Content-Typeの上書きが適用されずブラウザがHTMLとして解釈できず**ダウンロードが発生**するようになった。ユーザーが手動でロールバック。

### 現在の状態

`fallback: 'index.html'`(衝突が起きる、最も枯れた安全策)に戻してある。トップページの広告非表示バグは未解決。

### 次に検討する方向性

`prerender: false` にしている非公開ページ(NISA計算機など)を全て `prerender: true` に変更すれば、`fallback` オプション自体が不要になり、この一連の衝突問題の発生源をなくせる可能性がある(要検証)。ただし、これらのページが意図的に「本番ビルドから除外」されている(`bed7fa4`コミット)経緯があるため、検索エンジンからの発見されやすさなど副作用の確認が必要。
