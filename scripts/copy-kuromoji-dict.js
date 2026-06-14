import { cpSync, mkdirSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const src = join(__dirname, '..', 'node_modules', 'kuromoji', 'dict')
const dest = join(__dirname, '..', 'static', 'kuromoji', 'dict')

try {
  if (existsSync(src)) {
    mkdirSync(dest, { recursive: true })
    cpSync(src, dest, { recursive: true })
    console.log('✓ kuromoji dict copied to static/kuromoji/dict')
  } else {
    console.warn('⚠ kuromoji dict not found, skipping')
  }
} catch (err) {
  console.warn('⚠ Failed to copy kuromoji dict:', err.message)
}
