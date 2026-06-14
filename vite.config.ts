import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import path from 'path';
import { readFileSync } from 'fs';
import type { Plugin } from 'vite';

/**
 * Vite dev サーバーは .gz ファイルを Content-Encoding: gzip 付きで返すため、
 * ブラウザが自動展開してしまい kuromoji の zlibjs が二重展開で失敗する。
 * このプラグインで /kuromoji/dict/* を横取りし、生バイナリとして返す。
 */
function kuromojiDictRawPlugin(): Plugin {
  return {
    name: 'kuromoji-dict-raw',
    enforce: 'pre',  // SvelteKit の sirv より前にミドルウェアを登録する
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url?.startsWith('/kuromoji/dict/')) { next(); return }
        const filename = decodeURIComponent(req.url.slice('/kuromoji/dict/'.length).split('?')[0])
        if (!filename || filename.includes('..')) { next(); return }
        try {
          const data = readFileSync(path.resolve('./static/kuromoji/dict', filename))
          res.statusCode = 200
          res.setHeader('Content-Type', 'application/octet-stream')
          res.setHeader('Content-Length', data.length)
          res.end(data)
        } catch {
          next()
        }
      })
    }
  }
}

export default defineConfig({
  plugins: [sveltekit(), kuromojiDictRawPlugin()],
  build: {
    outDir: 'dist'
  },
  resolve: {
    alias: {
      // kuromoji の browser field 置換が Vite/esbuild で機能しないため、
      // browserify 済みのブラウザ用バンドル（BrowserDictionaryLoader 組み込み）を直接使う
      kuromoji: path.resolve('node_modules/kuromoji/build/kuromoji.js')
    }
  },
  optimizeDeps: {
    include: ['kuromoji']
  }
});