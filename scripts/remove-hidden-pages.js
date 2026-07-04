import { readFileSync, rmSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const dist = join(__dirname, '..', 'dist')
const siteConfig = JSON.parse(
  readFileSync(join(__dirname, '..', 'src', 'lib', 'site.config.json'), 'utf-8')
)

const hiddenHrefs = Object.entries(siteConfig.toolVisibility ?? {})
  .filter(([, visible]) => visible === false)
  .map(([href]) => href)

for (const href of hiddenHrefs) {
  const target = join(dist, href)
  if (existsSync(target)) {
    rmSync(target, { recursive: true, force: true })
    console.log(`✓ removed hidden page from production build: ${href}`)
  }
}
