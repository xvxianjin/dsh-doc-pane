import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { Readable } from 'node:stream'
import test from 'node:test'
import { apply } from '../index.js'

const limit = 4 * 1024 * 1024
const hash = text => createHash('sha256').update(text).digest('hex')

async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'doc-pane-test-'))
  t.after(() => fs.rm(root, { recursive: true, force: true }))
  const routes = new Map()
  apply({ inject: (_, fn) => fn({ effect: fn => fn(), webServer: {
    register: ({ path, handler }) => { routes.set(path, handler); return () => {} },
  } }) }, { root })
  const file = path.join(root, 'doc.md')
  await fs.writeFile(file, 'initial')
  const request = async (route, payload) => {
    const req = Readable.from([Buffer.from(JSON.stringify({ path: 'doc.md', ...payload }))])
    Object.assign(req, { method: 'POST', url: '/dsh-doc-pane/api/' + route })
    let status, data
    await routes.get(req.url)(req, { writeHead: code => { status = code }, end: text => { data = JSON.parse(text) } })
    return { status, data }
  }
  return { root, file, request }
}

test('canonical paths serialize version checks, preserve atomic snapshots and return the winning version', async t => {
  const { root, file, request } = await fixture(t)
  const dir = path.join(root, 'docs')
  await fs.mkdir(dir)
  await fs.rename(file, path.join(dir, 'doc.md'))
  await fs.symlink(dir, path.join(root, 'alias'), process.platform === 'win32' ? 'junction' : 'dir')
  const initial = (await request('read', { path: 'alias/doc.md' })).data
  assert.equal(initial.version, hash('initial'))
  const before = await fs.stat(path.join(dir, 'doc.md'), { bigint: true })
  {
    const responses = await Promise.all(Array.from({ length: 8 }, (_, i) => request('write', {
      path: (i % 2 ? 'alias/' : 'docs/') + 'doc.md', content: String(i), expectedVersion: initial.version,
    })))
    assert.deepEqual(responses.map(r => r.status).sort(), [200, 409, 409, 409, 409, 409, 409, 409], JSON.stringify(responses))
    assert.notEqual((await fs.stat(path.join(dir, 'doc.md'), { bigint: true })).ino, before.ino)
    const current = (await request('read', { path: 'docs/doc.md' })).data
    const winner = responses.find(r => r.status === 200).data
    assert.equal(current.mtime, winner.mtime)
    assert.equal(winner.version, hash(current.content))
    assert.ok(responses.filter(r => r.status === 409).every(r => r.data.version === winner.version && r.data.content === current.content))
    assert.deepEqual(await fs.readdir(dir), ['doc.md'])
  }
})

test('version detects different bytes at identical mtime; legacy timestamp guard still works', async t => {
  const { request, file } = await fixture(t)
  const stamp = new Date('2020-01-01T00:00:00Z')
  await fs.utimes(file, stamp, stamp)
  const { data } = await request('read')
  await fs.writeFile(file, 'changed')
  await fs.utimes(file, stamp, stamp)
  assert.equal((await request('write', { content: 'lost', expectedVersion: data.version, expectedMtime: data.mtime })).status, 409)
  assert.equal((await request('write', { content: 'lost', expectedMtime: data.mtime - 1 })).status, 409)
  assert.equal((await request('write', { content: 'accepted', expectedMtime: data.mtime })).status, 200)
})

test('read and write allow exactly 4 MiB including escaped JSON, reject excess bytes', async t => {
  const { request, file } = await fixture(t)
  const content = '\u0000'.repeat(limit)
  assert.equal((await request('write', { content })).status, 200)
  assert.equal((await request('read')).data.content, content)
  assert.equal((await request('write', { content: '界'.repeat(Math.ceil(limit / 3)) })).status, 413)
  assert.equal((await fs.stat(file)).size, limit)
  await fs.appendFile(file, 'x')
  assert.equal((await request('read')).status, 413)
})

test('oversized POST input returns 413 on all file routes', async t => {
  const { request } = await fixture(t)
  for (const route of ['read', 'stat', 'recent', 'write']) {
    const pad = 'x'.repeat(route === 'write' ? limit * 6 + 65536 : limit)
    assert.equal((await request(route, { pad })).status, 413, route)
  }
})
