import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import path from 'path';
import { readFileSync, writeFileSync } from 'fs';
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

function adminApiPlugin(): Plugin {
  return {
    name: 'admin-api',
    enforce: 'pre',
    configureServer(server) {
      const configPath = path.resolve('src/lib/site.config.json')
      server.middlewares.use('/api/admin/config', (req, res) => {
        if (req.method === 'GET') {
          try {
            res.setHeader('Content-Type', 'application/json')
            res.end(readFileSync(configPath, 'utf-8'))
          } catch {
            res.statusCode = 500
            res.end('error reading config')
          }
        } else if (req.method === 'POST') {
          let body = ''
          req.on('data', (chunk: Buffer) => { body += chunk.toString() })
          req.on('end', () => {
            try {
              const parsed = JSON.parse(body)
              writeFileSync(configPath, JSON.stringify(parsed, null, 2) + '\n')
              res.statusCode = 200
              res.end('ok')
            } catch {
              res.statusCode = 400
              res.end('invalid JSON')
            }
          })
        } else {
          res.statusCode = 405
          res.end('method not allowed')
        }
      })
    }
  }
}

export default defineConfig({
  plugins: [sveltekit(), kuromojiDictRawPlugin(), adminApiPlugin()],
  build: {
    outDir: 'dist'
  },
  server: {
    watch: {
      // 保存APIで書き換えるたびにHMRが発火してコンポーネントが再マウントされるのを防ぐ
      ignored: ['**/site.config.json']
    }
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