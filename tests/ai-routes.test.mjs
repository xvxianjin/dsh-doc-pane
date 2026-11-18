import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { Readable } from 'node:stream'
import test from 'node:test'
import { apply } from '../index.js'

const stop = { type: 'finish', reason: { kind: 'stop' } }
const reply = (text, finish = stop) => [{ type: 'text-delta', text }, ...(finish ? [finish] : [])]
const quote = { text: 'original' }

function fixture() {
  const routes = new Map(), calls = [], streams = [], loads = []
  let model = 'm1'
  const agent = { model: { current: () => ({ provider: 'session', model, reasoningEffort: 'high' }) } }
  const skills = [ ['user', true, false], ['model', false, true], ['hidden', false, false] ]
    .map(([name, userInvocable, modelInvocable]) => ({ name, description: name, content: `instructions-${name}`, invocation: { userInvocable, modelInvocable } }))
  const checkLookup = ({ scope, cwd }) => { assert.equal(scope, agent); assert.equal(cwd, 'session-dir') }
  const services = {
    agents: { get: id => id === 's' ? agent : undefined },
    workingDirectory: { ensure: scope => { assert.equal(scope, agent); return 'session-dir' } },
    agentDefaultModel: { currentSelection: () => ({ provider: 'deployment', model: 'fallback' }) },
    llm: { listProviders: () => [], stream: request => { calls.push(request); return streams.shift() } },
    skills: { list: lookup => { checkLookup(lookup); return skills }, get: (name, lookup) => {
      checkLookup(lookup); loads.push(name); return skills.find(item => item.name === name)
    } },
  }
  apply({ get: key => services[key], inject: (_, fn) => fn({ effect: f => f(), webServer: { register: ({ path, handler }) => routes.set(path, handler) } }) }, {})
  async function post(route, payload = {}) {
    const req = Object.assign(Readable.from([Buffer.from(JSON.stringify({ session: 's', ...payload }))]), { method: 'POST', url: '/dsh-doc-pane/api/' + route })
    let status, data
    const res = Object.assign(new EventEmitter(), { writeHead: code => { status = code }, end: text => { data = JSON.parse(text) } })
    await routes.get(req.url)(req, res)
    return { status, ...data }
  }
  return { post, calls, streams, loads, setModel: value => { model = value } }
}

test('chat and rewrite require stop and a complete edit, preserving whitespace and explicit deletion', async () => {
  const { post, streams } = fixture()
  for (const route of ['chat', 'rewrite']) {
    const request = () => post(route, route === 'chat' ? { prompt: 'edit', selection: quote } : { instruction: 'edit', selection: quote.text })
    for (const text of ['\n  line  \n', '  ', '']) {
      streams.push(reply(JSON.stringify({ kind: 'edit', text })))
      const res = await request(); assert.equal(res.status, 200); assert.equal(res.text, text)
    }
    for (const reason of ['max-tokens', 'error', 'aborted', 'tool-calls', null]) {
      streams.push(reply('{"kind":"edit","text":""}', reason && { type: 'finish', reason: { kind: reason } }))
      assert.equal((await request()).status, 400)
    }
    for (const invalid of ['{"kind":"edit","text":"', '{"kind":"edit","text":""', '{"kind":"edit"}', 'prefix {"kind":"edit","text":""}']) {
      streams.push(reply(invalid)); const res = await request()
      if (route === 'chat') assert.equal(res.kind, 'answer'); else assert.equal(res.status, 400)
    }
  }
})

test('model follows the session on each call; explicit chat route takes precedence', async () => {
  const { post, calls, streams, setModel } = fixture()
  assert.equal((await post('models')).current.model, 'm1')
  setModel('m2')
  streams.push(reply('answer')); await post('chat', { prompt: 'ask' })
  assert.equal(calls[0].provider, 'session'); assert.equal(calls[0].model, 'm2'); assert.equal(calls[0].reasoningEffort, 'high')
  streams.push(reply('answer')); await post('chat', { prompt: 'ask', provider: 'override', model: 'other' })
  assert.equal(calls[1].provider, 'override'); assert.equal(calls[1].reasoningEffort, undefined)
  assert.equal((await post('models', { session: '' })).current.provider, 'deployment')
})

test('skill listing and loading use session cwd/scope and the invocation source', async () => {
  const { post, calls, streams, loads } = fixture()
  assert.deepEqual((await post('skills')).skills.map(s => s.name), ['user'])
  assert.equal((await post('chat', { prompt: 'ask', skills: ['model'] })).status, 400)
  streams.push(reply('{"kind":"skill","names":["model"]}'), reply('answer'))
  const result = await post('chat', { prompt: 'ask', skills: ['user'] })
  assert.deepEqual(result.skills, ['user', 'model']); assert.deepEqual(loads, ['user', 'model'])
  assert.match(calls[0].system, /- model：/); assert.doesNotMatch(calls[0].system, /- (?:user|hidden)：/)
  assert.match(calls[1].system, /instructions-model/)
  streams.push(reply('{"kind":"skill","names":["user"]}'))
  assert.equal((await post('chat', { prompt: 'ask' })).status, 400)
  assert.deepEqual(loads, ['user', 'model'])
})
