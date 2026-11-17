/**
 * Rebuilds `vendor/editor.js`, the editing kernel the panel loads as a script.
 *
 *   npm install            # once, inside this folder
 *   node build.mjs         # -> ../../vendor/editor.js (the artifact that ships)
 *   node build.mjs --test  # also emits editor.cjs and runs the smoke test
 *
 * The pane itself has no build step: this folder exists only so the kernel can
 * be changed without a bundler in the plugin's runtime path.
 */
import { build } from 'esbuild'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

const here = path.dirname(fileURLToPath(import.meta.url))
const entry = path.join(here, 'entry.js')
const target = path.resolve(here, '..', '..', 'vendor', 'editor.js')
const testTarget = path.join(here, 'editor.cjs')

await build({
  entryPoints: [entry],
  bundle: true,
  format: 'iife',
  globalName: 'DshDocEditor',
  minify: true,
  target: 'chrome110',
  outfile: target,
  logLevel: 'warning',
})
console.log('built ' + path.relative(process.cwd(), target))

if (process.argv.includes('--test')) {
  await build({
    entryPoints: [entry],
    bundle: true,
    format: 'cjs',
    platform: 'node',
    outfile: testTarget,
    logLevel: 'warning',
  })
  execFileSync(process.execPath, [path.join(here, 'smoke.cjs')], { stdio: 'inherit' })
  console.log('editor smoke test passed')
}
