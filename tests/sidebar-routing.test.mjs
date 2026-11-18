import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'

const source = readFileSync(new URL('../client.js', import.meta.url), 'utf8')
test('registers file claims without replacing native navigation; header opens only its own page', async () => {
  let plugin, type, toggle
  const requests = []
  const api = Object.freeze({ openResource(address, options) { requests.push([address, options]) }, openTab(kind, options) { requests.push([kind, options]) } })
  const ctx = {
    slots: { register(spec, component) { if (spec.id === 'dsh-doc-pane-open') toggle = component; return () => {} }, inject(_, callback) { return callback() } },
    sidebarRightTabs: { register(def) { type = def; return () => {} } }, sidebarRight: api,
    get(key) { return this[key] }, effect(callback) { return callback() }, inject(_, callback) { return callback(this) },
  }
  const react = { createElement: (tag, props) => ({tag, props}) }
  vm.runInNewContext(source, { window: { __ModuleLoader__: {load({factory}) {plugin = factory(() => react)} } }, styles: {insert() {}}, console })
  plugin.apply(ctx)
  assert.equal(type.kind, 'doc-pane')
  assert.equal(type.canOpen('dsh-resource://file/session/s/A.md:42'), true)
  assert.equal(type.canOpen('dsh-resource://file/session/s/A.pdf'), false)
  assert.equal(type.title('dsh-resource://file/session/s/A.md:42'), 'A.md')
  const opts = { params: { line: 42 }, destination: 'float', kind: 'editor' }
  api.openResource('dsh-resource://file/session/s/A.md', opts)
  assert.equal(requests[0][1], opts)
  await toggle({sessionId:'s'}).props.onClick()
  assert.deepEqual(JSON.parse(JSON.stringify(requests[1])), ['doc-pane', {params:{browse:true}}])
})
