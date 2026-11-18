/**
 * dsh-doc-pane — Host half.
 *
 * Serves the small HTTP API the browser half uses to list, read, and write the
 * Markdown documents of the current workspace, and to ask the configured model
 * for a rewrite of one selected passage.
 *
 * Everything is rooted at one directory: the working directory of the Session
 * that opened the panel (the browser half passes its Session id), else
 * config.root, else the host's default working directory. Every path is checked
 * against that root before it is touched, so the panel cannot escape it.
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import { createHash, randomUUID } from 'node:crypto'


const API = '/dsh-doc-pane/api'

/**
 * The editing kernel is a prebuilt script shipped inside the package. It is
 * read once and served from memory so the browser can load it as a plain
 * `<script>` — the panel itself is a static bundle with no build step.
 */
let vendorScript = null
async function readVendorScript() {
  if (!vendorScript) {
    const file = await fs.readFile(new URL('./vendor/editor.js', import.meta.url))
    vendorScript = file
  }
  return vendorScript
}
const SKIP_DIRS = new Set([
  'node_modules', 'dist', 'build', 'out', 'coverage', '__pycache__',
  '.venv', 'venv', 'target', '.cache', 'vendor',
])
const TEXT_EXT = new Set(['.md', '.markdown', '.mdx', '.txt'])
const MAX_DOCUMENT = 4 * 1024 * 1024
const MAX_BODY = MAX_DOCUMENT
const MAX_SAVE_BODY = MAX_DOCUMENT * 6 + 64 * 1024 // JSON control-character escapes plus metadata
const writes = new Map()
const versionOf = (bytes) => createHash('sha256').update(bytes).digest('hex')
const tooLarge = () => Object.assign(new Error('文档或请求超过大小上限（文档最多 4 MiB）'), { status: 413 })

async function snapshot(file) {
  const handle = await fs.open(file, 'r')
  try {
    const stat = await handle.stat()
    if (!stat.isFile()) throw new Error('不是普通文档')
    if (stat.size > MAX_DOCUMENT) throw tooLarge()
    const bytes = Buffer.alloc(stat.size + 1)
    let used = 0
    while (used < bytes.length) {
      const { bytesRead } = await handle.read(bytes, used, bytes.length - used, used)
      if (!bytesRead) break
      used += bytesRead
    }
    const after = await handle.stat()
    if (used !== stat.size || after.size !== used || after.ctimeMs !== stat.ctimeMs) throw new Error('读取期间文档已更改，请重试')
    const data = bytes.subarray(0, used)
    const content = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(data)
    return { content, mtime: after.mtimeMs, version: versionOf(data) }
  } finally { await handle.close() }
}

async function saveDocument(target, payload) {
  if (typeof payload.content !== 'string') throw new Error('缺少文档内容')
  if (Buffer.byteLength(payload.content) > MAX_DOCUMENT) throw tooLarge()
  const file = await fs.realpath(target.absolute)
  const key = process.platform === 'win32' ? file.toLowerCase() : file
  const job = (writes.get(key) ?? Promise.resolve()).catch(() => {}).then(async () => {
    await fs.access(file, fs.constants.W_OK)
    const meta = await fs.stat(file)
    if (meta.nlink > 1) throw new Error('为保留硬链接关系，此文档不支持原子保存')
    const temp = path.join(path.dirname(file), `.dsh-doc-${randomUUID()}.tmp`)
    const handle = await fs.open(temp, 'wx', 0o600)
    try {
      let mtime
      try {
        await handle.writeFile(payload.content, 'utf8')
        await handle.chmod(meta.mode & 0o777)
        await handle.sync()
        mtime = (await handle.stat()).mtimeMs
      } finally { await handle.close() }
      const current = await snapshot(file)
      if (payload.expectedVersion !== undefined ? current.version !== payload.expectedVersion :
          payload.expectedMtime !== undefined && current.mtime !== payload.expectedMtime) {
        return { status: 409, data: { conflict: true, ...current } }
      }
      await fs.rename(temp, file)
      return { status: 200, data: { path: target.relative, mtime, version: versionOf(payload.content) } }
    } finally { await fs.rm(temp, { force: true }) }
  })
  writes.set(key, job)
  try { return await job } finally { if (writes.get(key) === job) writes.delete(key) }
}

const REWRITE_SYSTEM = [
  '你是文档编辑器里的改写引擎。用户给出文档中的一段原文和一条修改要求。',
  '只输出一个完整 JSON 对象 {"kind":"edit","text":"替换文字"}，保留 text 首尾空白，删除时 text 为 ""。',
  '保留原文的 Markdown 标记、缩进和语言；除非要求明确改变结构或长度，尽量少改动无关的词。',
  '如果给了对话背景，让它影响用词、术语和详略，但不要复述背景。',
].join('\n')

const ASK_SYSTEM = [
  '你是文档阅读助手。用户选中了文档里的一段文字，并提出了一个问题。',
  '直接回答这个问题，用中文，可以引用片段里的内容，不要重写整段文字。',
  '不要输出 Markdown 代码围栏包裹整段回答；需要分点时用简短列表。',
  '如果给了对话背景，可以用它来理解术语和上下文，但不要复述背景。',
].join('\n')

/**
 * The side chat has no modes: the model reads the message and decides whether
 * it is being asked to change the quoted passage or to answer a question.
 */
const CHAT_SYSTEM = [
  '你是文档侧栏里的助手。用户可能向你提问，也可能让你改写他引用的那段文字。',
  '先判断意图：要求改变文字本身（润色、精简、扩写、翻译、改语气、纠错、调整结构）就是改写；',
  '询问含义、原因、用法、是否合理、下一步做什么就是回答。',
  '只输出一个 JSON 对象，不要代码围栏、不要额外说明，二选一：',
  '{"kind":"edit","text":"改写后的整段文字"}',
  '{"kind":"answer","text":"回答内容"}',
  '改写时 text 只放用来替换被引用片段的那段文字本身：不要重复片段前后的标题或段落，也不要顺手补上下文；',
  '片段本身包含标题、列表标记时，随片段一起返回并保留 Markdown 结构。',
  '要让被引用片段消失（删除），就返回 {"kind":"edit","text":""}；整行是标题或列表项时会连同标记一起删掉。',
  '回答时 text 用 Markdown，直接给结论，需要时再补充原因。',
  '如果消息里说明这次没有引用片段，kind 只能是 answer。',
  '如果给了对话背景，用它理解术语和上下文，不要复述背景。',
  '如果下面给了技能目录，而你确实需要某个技能的完整说明才能做好这次任务，',
  '只输出 {"kind":"skill","names":["技能名"]} 请求它（最多两个），我会补上说明再问你一次；',
  '目录里的名字和描述够用时就正常回答或改写，不要为了礼貌去请求技能。',
].join('\n')

/**
 * A JSON decision is preferred; a model that ignores the format still yields a
 * usable answer instead of an error.
 */
function readJsonObject(raw) {
  try { return JSON.parse(raw) } catch { return null }
}

function parseChatReply(raw, allowEdit) {
  const value = readJsonObject(raw)
  if (typeof value?.text === 'string') {
    if (value.kind === 'edit' && allowEdit) return { kind: 'edit', text: value.text }
    if (value.kind === 'answer' || value.kind === 'edit') return { kind: 'answer', text: value.text }
  }
  return { kind: 'answer', text: raw.trim() }
}

async function completedText(stream, signal) {
  let text = ''
  let stopped = false
  for await (const chunk of stream) {
    if (stopped) throw new Error('模型在结束后仍返回数据，请重试')
    if (chunk.type === 'text-delta') text += chunk.text
    if (chunk.type === 'finish') {
      if (chunk.reason?.kind !== 'stop') {
        throw new Error(`模型回复未完成：${chunk.reason?.failure?.message ?? chunk.reason?.kind ?? '未知原因'}`)
      }
      stopped = true
    }
  }
  signal.throwIfAborted()
  if (!stopped) throw new Error('模型回复未完整结束，请重试')
  return text
}

/**
 * A model may ask for full skill instructions instead of answering. Anything
 * that is not exactly that shape yields no names, so a normal reply passes
 * through untouched.
 */
function parseSkillRequest(raw) {
  const value = readJsonObject(raw)
  if (value?.kind !== 'skill' || !Array.isArray(value.names)) return []
  return normalizeSkillNames(value.names).slice(0, 2)
}

function normalizeSkillNames(names) {
  return [...new Set((Array.isArray(names) ? names : []).filter(name => typeof name === 'string').map(name => name.trim()).filter(Boolean))].slice(0, 4)
}

/** Per-turn and total caps for the conversation background sent with a rewrite. */
const CONTEXT_TURNS = 8
const CONTEXT_CHARS = 6000
const CONTEXT_TURN_CHARS = 1200

/**
 * Collect chat turns from a session surface.
 *
 * The surface event payload is only guaranteed to be a `SessionEvent`, so
 * nothing here depends on its exact shape: any object that carries a message
 * `role` and a `content` array is a turn, wherever it sits in the tree.
 */
function collectTurns(value, out, depth = 0) {
  if (!value || depth > 12 || out.length > 400) return
  if (Array.isArray(value)) {
    for (const item of value) collectTurns(item, out, depth + 1)
    return
  }
  if (typeof value !== 'object') return
  const role = value.role
  if ((role === 'user' || role === 'assistant') && Array.isArray(value.content)) {
    const parts = []
    for (const part of value.content) {
      if (part && part.type === 'text' && typeof part.text === 'string' && part.text.trim()) {
        parts.push(part.text.trim())
      }
    }
    const text = parts.join('\n')
    if (text) out.push({ role, text })
    return
  }
  for (const key of Object.keys(value)) collectTurns(value[key], out, depth + 1)
}

function sendJson(response, status, value) {
  const body = JSON.stringify(value)
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  })
  response.end(body)
}

function readJsonBody(request, limit = MAX_BODY) {
  return new Promise((resolve, reject) => {
    let size = 0
    const chunks = []
    request.on('data', (chunk) => {
      size += chunk.length
      if (size > limit) {
        chunks.length = 0
        reject(tooLarge())
        return
      }
      chunks.push(chunk)
    })
    request.on('end', () => {
      if (!chunks.length) {
        resolve({})
        return
      }
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')))
      } catch (error) {
        reject(new Error('请求体不是合法 JSON'))
      }
    })
    request.on('error', reject)
  })
}

function toPosix(value) {
  return value.split(path.sep).join('/')
}

// 读取路由参数：GET 用查询串，POST 用 JSON 体（这样中文路径不依赖 URL 编码）。
async function routeParams(request, url) {
  const params = {}
  for (const [key, value] of url.searchParams) params[key] = value
  if (request.method === 'POST') {
    const body = await readJsonBody(request)
    if (body && typeof body === 'object') {
      for (const [key, value] of Object.entries(body)) {
        if (typeof value === 'string') params[key] = value
      }
    }
  }
  return params
}

function cleanModelText(text) {
  let out = text.trim()
  const fence = out.match(/^```[a-zA-Z0-9_-]*\n([\s\S]*?)\n```$/)
  if (fence) out = fence[1]
  return out
}

function pickString(...values) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim()
    if (value && typeof value === 'object' && typeof value.id === 'string' && value.id.trim()) return value.id.trim()
    if (value && typeof value === 'object' && typeof value.model === 'string' && value.model.trim()) return value.model.trim()
  }
  return undefined
}

export function apply(ctx, config) {
  const configuredRoot = typeof config?.root === 'string' && config.root.trim()
    ? path.resolve(config.root.trim())
    : undefined


  // The newest live session, used only when the caller names none.
  function latestSessionId() {
    try {
      const sessions = ctx.get('sessions')
      if (!sessions || typeof sessions.list !== 'function') return ''
      const list = sessions.list()
      if (!Array.isArray(list) || list.length === 0) return ''
      let best = ''
      let bestAt = -Infinity
      for (const entry of list) {
        const id = entry && (entry.id || entry.sessionId)
        if (typeof id !== 'string' || !id) continue
        const stamp = Number(entry.updatedAt || entry.lastActivityAt || entry.createdAt || 0)
        if (stamp >= bestAt) {
          bestAt = stamp
          best = id
        }
      }
      return best
    } catch {
      return ''
    }
  }

  /**
   * The directory the panel works in: the session's own working directory when
   * the caller names a live session (the browser half does), otherwise the
   * newest live session, then the deployment default.
   */
  async function workspaceRoot(sessionId) {
    if (configuredRoot) return configuredRoot

    // A panel opened cold (or from a link whose address names no session) has
    // no session id; the newest live session is a far better guess than the
    // deployment default, which is the profile directory.
    const asked = sessionId || latestSessionId()
    if (asked) {
      const agents = ctx.get('agents')
      const workingDirectory = ctx.get('workingDirectory')
      const agent = agents && typeof agents.get === 'function' ? agents.get(asked) : undefined
      if (agent && workingDirectory && typeof workingDirectory.ensure === 'function') {
        try {
          const directory = await workingDirectory.ensure(agent)
          if (typeof directory === 'string' && directory.trim()) return path.resolve(directory)
        } catch {
          // a session that never started has no directory; fall through
        }
      }
    }

    const workingDirectory = ctx.get('workingDirectory')
    if (workingDirectory) {
      try {
        const direct = typeof workingDirectory.defaultDirectory === 'string'
          ? workingDirectory.defaultDirectory
          : undefined
        if (direct && direct.trim()) return path.resolve(direct)
      } catch {
        // fall through to the process directory
      }
    }
    return path.resolve(process.cwd())
  }

  async function resolvePath(relative, sessionId, options = {}) {
    const root = await workspaceRoot(sessionId)
    const raw = typeof relative === 'string' && relative.trim()
      ? relative.trim().replace(/^"(.*)"$/, '$1')
      : ''
    if (!raw) throw new Error('缺少文件路径')

    // An absolute path is taken as written: the panel also opens documents that
    // live outside the Session workspace (pasted by the user, or picked in a
    // folder). A relative path always stays inside that workspace.
    const outside = path.isAbsolute(raw)
    const absolute = outside ? path.resolve(raw) : path.resolve(root, raw)

    if (!outside) {
      const outsideCheck = path.relative(root, absolute)
      if (outsideCheck === '' || outsideCheck.startsWith('..') || path.isAbsolute(outsideCheck)) {
        throw new Error('文件不在当前工作区内')
      }
    }

    let stat
    try {
      stat = await fs.stat(absolute)
    } catch {
      throw new Error('路径不存在')
    }

    const back = path.relative(root, absolute)
    const inside = !back.startsWith('..') && !path.isAbsolute(back)
    const relativeToRoot = inside ? toPosix(back) || '.' : toPosix(absolute)

    if (stat.isDirectory()) {
      if (!options.allowDirectory) throw new Error('这是一个文件夹，不是文档')
      return { root, absolute, relative: relativeToRoot, outside, kind: 'dir' }
    }

    if (!TEXT_EXT.has(path.extname(absolute).toLowerCase())) {
      throw new Error('只支持 Markdown 或纯文本文件')
    }
    return { root, absolute, relative: relativeToRoot, outside, kind: 'file' }
  }

  /** Files only: the shape the read/write/rewrite routes expect. */
  async function resolveInside(relative, sessionId) {
    const target = await resolvePath(relative, sessionId)
    return {
      root: target.root,
      absolute: target.absolute,
      relative: target.relative,
      outside: target.outside,
    }
  }

  async function scanRecent(root) {
    const found = []
    let budget = 4000

    async function walk(directory, depth) {
      if (depth > 5 || budget <= 0) return
      let entries
      try {
        entries = await fs.readdir(directory, { withFileTypes: true })
      } catch {
        return
      }
      for (const entry of entries) {
        if (budget-- <= 0) return
        const absolute = path.join(directory, entry.name)
        if (entry.isDirectory()) {
          if (entry.name.startsWith('.') || SKIP_DIRS.has(entry.name)) continue
          await walk(absolute, depth + 1)
          continue
        }
        if (!TEXT_EXT.has(path.extname(entry.name).toLowerCase())) continue
        try {
          const stat = await fs.stat(absolute)
          found.push({
            path: toPosix(path.relative(root, absolute)),
            name: entry.name,
            dir: toPosix(path.relative(root, directory)) || '.',
            mtime: stat.mtimeMs,
            size: stat.size,
          })
        } catch {
          // a file that vanished mid-scan is simply not listed
        }
      }
    }

    await walk(root, 0)
    found.sort((left, right) => right.mtime - left.mtime)
    return found.slice(0, 40)
  }

  function sessionAgent(sessionId) {
    return sessionId ? ctx.get('agents')?.get(sessionId) : undefined
  }

  function selectedRoute(sessionId) {
    return sessionAgent(sessionId)?.model.current() ?? ctx.get('agentDefaultModel')?.currentSelection()
  }

  function resolveRoute(sessionId) {
    const route = selectedRoute(sessionId)
    if (!route) throw new Error('没有可用的模型：请先选择会话模型或默认模型')
    return route
  }

  /**
   * The recent chat of the Session whose panel this is, as plain text.
   *
   * The side panel edits documents the center conversation produced, so the
   * rewrite should know what was already agreed there. Best effort: any
   * missing service or malformed surface simply yields no background.
   */
  async function readConversation(sessionId) {
    if (!sessionId) return ''
    let query
    try {
      query = ctx.get('sessionQuery')
    } catch {
      return ''
    }
    if (!query || typeof query.readSurface !== 'function') return ''
    let surface
    try {
      surface = await query.readSurface(sessionId)
    } catch {
      return ''
    }
    const turns = []
    collectTurns(surface, turns)
    const lines = []
    let used = 0
    for (let index = turns.length - 1; index >= 0 && turns.length - index <= CONTEXT_TURNS; index -= 1) {
      const turn = turns[index]
      const text = turn.text.length > CONTEXT_TURN_CHARS ? `${turn.text.slice(0, CONTEXT_TURN_CHARS)}…` : turn.text
      const line = `${turn.role === 'user' ? '用户' : '助手'}：${text}`
      if (used + line.length > CONTEXT_CHARS) break
      used += line.length + 1
      lines.unshift(line)
    }
    return lines.join('\n')
  }

  async function rewrite(payload, signal) {
    const llm = ctx.get('llm')
    if (!llm) throw new Error('当前部署没有 llm 服务')

    const ask = payload?.mode === 'ask'
    const instruction = typeof payload?.instruction === 'string' ? payload.instruction.trim() : ''
    const selection = typeof payload?.selection === 'string' ? payload.selection : ''
    if (!ask && !instruction) throw new Error('请先写下改写要求')
    if (!selection.trim()) throw new Error(ask ? '请先选中要询问的文字' : '请先选中要改写的文字')

    const route = resolveRoute(payload?.session)
    const name = typeof payload?.name === 'string' && payload.name ? payload.name : '未命名文档'
    const before = typeof payload?.before === 'string' ? payload.before.slice(-1600) : ''
    const after = typeof payload?.after === 'string' ? payload.after.slice(0, 1600) : ''
    const context = await readConversation(payload?.session)

    const prompt = ask
      ? [
          `文档：${name}`,
          `问题：${instruction || '解释这段文字在讲什么'}`,
          context ? `\n【这次对话里已经聊过的内容，作为背景，不要复述】\n${context}` : '',
          '',
          '【选中的片段】',
          selection,
        ].join('\n')
      : [
          `文档：${name}`,
          `修改要求：${instruction}`,
          context ? `\n【这次对话里已经聊过的内容，作为背景，不要复述】\n${context}` : '',
          '',
          '【待改写片段】（只改写这一段）',
          selection,
          before ? `\n【片段前文，仅供参考，不要出现在输出里】\n${before}` : '',
          after ? `\n【片段后文，仅供参考，不要出现在输出里】\n${after}` : '',
        ].join('\n')

    const controller = new AbortController()
    if (signal?.aborted) controller.abort()
    else signal?.addEventListener('abort', () => controller.abort(), { once: true })
    const timer = setTimeout(() => controller.abort(), 150_000)

    let text = ''
    try {
      const stream = llm.stream({
        provider: route.provider,
        model: route.model,
        ...(route.reasoningEffort ? { reasoningEffort: route.reasoningEffort } : {}),
        system: ask ? ASK_SYSTEM : REWRITE_SYSTEM,
        messages: [{ role: 'user', content: [{ type: 'text', text: prompt }] }],
        maxTokens: ask ? 2000 : 4000,
        signal: controller.signal,
      })
      text = await completedText(stream, controller.signal)
    } finally {
      clearTimeout(timer)
    }

    const reply = parseChatReply(cleanModelText(text), !ask)
    if (!ask && reply.kind !== 'edit') throw new Error('改写结果格式不完整，请重试')
    if (ask && !reply.text.trim()) throw new Error('模型没有返回内容')
    return { text: reply.text, provider: route.provider, model: route.model, mode: ask ? 'ask' : 'rewrite' }
  }

  /**
   * One entry point for the side chat: the model decides whether the user is
   * asking a question or asking for the quoted passage to be rewritten, and
   * answers with `{ kind, text }`. A quote is required for an edit.
   */
  /** Providers and their models, for the composer's model picker. */
  async function listModelOptions(sessionId) {
    const llm = ctx.get('llm')
    if (!llm) throw new Error('当前部署没有 llm 服务')
    const providers = await llm.listProviders()
    const out = []
    for (const entry of Array.isArray(providers) ? providers : []) {
      if (!entry || !entry.id) continue
      let models = []
      try {
        models = await llm.listModels(entry.id)
      } catch (error) {
        console.error('dsh-doc-pane: listModels failed', entry.id, error)
      }
      out.push({
        id: String(entry.id),
        name: pickString(entry.name, entry.id),
        models: (Array.isArray(models) ? models : [])
          .filter((model) => model && model.id)
          .map((model) => ({ id: String(model.id), name: pickString(model.name, model.id) })),
      })
    }
    return { providers: out, current: selectedRoute(sessionId) ?? null }
  }

  async function skillView(sessionId, signal) {
    const scope = sessionAgent(sessionId)
    const cwd = scope ? await ctx.get('workingDirectory').ensure(scope, signal) : undefined
    const lookup = { scope, cwd, signal }
    const registry = ctx.get('skills')
    const entries = await registry?.list(lookup) ?? []
    return { registry, lookup, entries }
  }

  async function listSkillOptions(sessionId) {
    const { entries } = await skillView(sessionId)
    return { skills: entries.filter(item => item.invocation.userInvocable).map(({ name, description }) => ({ name, description })) }
  }

  async function loadSkills(view, names, policy) {
    const loaded = []
    for (const name of names) {
      if (!view.entries.some(item => item.name === name && item.invocation[policy])) {
        throw new Error(`当前无法调用技能 ${name}`)
      }
      const skill = await view.registry.get(name, view.lookup)
      if (!skill?.invocation[policy] || typeof skill.content !== 'string') throw new Error(`当前无法调用技能 ${name}`)
      loaded.push(`【技能 ${name}】\n${skill.content}`)
    }
    return loaded
  }

  async function chat(payload, signal) {
    const llm = ctx.get('llm')
    if (!llm) throw new Error('当前部署没有 llm 服务')

    const prompt = typeof payload?.prompt === 'string' ? payload.prompt.trim() : ''
    if (!prompt) throw new Error('请输入内容')
    const selection = payload?.selection && typeof payload.selection.text === 'string' ? payload.selection : null
    const quoted = selection ? selection.text : ''
    const history = Array.isArray(payload?.messages)
      ? payload.messages
          .filter((item) => item && typeof item.text === 'string' && (item.role === 'user' || item.role === 'assistant'))
          .slice(-10)
      : []
    const name = typeof payload?.name === 'string' && payload.name ? payload.name : '未命名文档'
    const picked = pickString(payload?.provider) && pickString(payload?.model)
      ? {
          provider: pickString(payload.provider),
          model: pickString(payload.model),
          reasoningEffort: pickString(payload?.reasoningEffort),
        }
      : null
    const route = picked ?? (resolveRoute(payload?.session))
    const context = await readConversation(payload?.session)

    const parts = [`文档：${name}`]
    if (context) parts.push(`\n【这次对话里已经聊过的内容，作为背景，不要复述】\n${context}`)
    if (quoted) {
      parts.push('\n【用户引用的片段】', quoted)
      if (typeof selection.before === 'string' && selection.before) {
        parts.push(`\n【片段前文，仅供参考】\n${selection.before.slice(-1500)}`)
      }
      if (typeof selection.after === 'string' && selection.after) {
        parts.push(`\n【片段后文，仅供参考】\n${selection.after.slice(0, 1500)}`)
      }
    } else {
      parts.push('\n【这次没有引用片段，只能回答，不能改写】')
    }
    if (history.length) {
      parts.push('\n【之前的往来】')
      for (const item of history) parts.push(`${item.role === 'user' ? '用户' : '助手'}：${String(item.text).slice(0, 1200)}`)
    }
    parts.push('\n【用户这次说】', prompt)

    const pickedSkills = normalizeSkillNames(payload?.skills)

    const controller = new AbortController()
    if (signal?.aborted) controller.abort()
    else signal?.addEventListener('abort', () => controller.abort(), { once: true })
    const timer = setTimeout(() => controller.abort(), 150_000)

    /** One model call; returns the raw text. */
    const ask = async (system) => {
      const stream = llm.stream({
        provider: route.provider,
        model: route.model,
        ...(route.reasoningEffort ? { reasoningEffort: route.reasoningEffort } : {}),
        system,
        messages: [{ role: 'user', content: [{ type: 'text', text: parts.join('\n') }] }],
        maxTokens: 4000,
        signal: controller.signal,
      })
      return cleanModelText(await completedText(stream, controller.signal))
    }

    let usedSkills = pickedSkills
    let cleaned = ''
    try {
      const view = await skillView(payload?.session, controller.signal)
      const loaded = await loadSkills(view, pickedSkills, 'userInvocable')
      const catalog = view.entries.filter(item => item.invocation.modelInvocable)
        .map(item => `- ${item.name}：${item.description}`).join('\n')
      cleaned = await ask([CHAT_SYSTEM, catalog && `【可用技能目录】\n${catalog}`, ...loaded].filter(Boolean).join('\n\n'))
      const wanted = parseSkillRequest(cleaned).filter(name => !usedSkills.includes(name))
      if (wanted.length) {
        const extra = await loadSkills(view, wanted, 'modelInvocable')
        usedSkills = [...usedSkills, ...wanted]
        cleaned = await ask([CHAT_SYSTEM, ...loaded, ...extra, '请直接给出最终回答或改写。'].join('\n\n'))
      }
    } finally {
      clearTimeout(timer)
    }

    if (!cleaned) throw new Error('模型没有返回内容')
    const decided = parseChatReply(cleaned, Boolean(quoted))
    return { ...decided, provider: route.provider, model: route.model, skills: usedSkills }
  }

  ctx.inject(['webServer'], (scope) => {
    const server = scope.webServer

    scope.effect(() => {
      let disposers = []
      try {
        disposers = [
          server.register({
            kind: 'exact',
            path: `${API}/vendor/editor.js`,
            handler: async (request, response) => {
              try {
                const file = await readVendorScript()
                response.writeHead(200, {
                  'content-type': 'text/javascript; charset=utf-8',
                  'cache-control': 'no-cache',
                  'content-length': String(file.length),
                })
                response.end(file)
              } catch (error) {
                sendJson(response, 404, { error: `编辑器资源不可用：${error?.message ?? error}` })
              }
            },
          }),
          server.register({
            kind: 'exact',
            path: `${API}/health`,
            handler: async (request, response) => {
              const url = new URL(request.url ?? '/', 'http://localhost')
              const sessionId = url.searchParams.get('session') ?? undefined
              sendJson(response, 200, {
                ok: true,
                api: 1,
                root: await workspaceRoot(sessionId),
                cwd: process.cwd(),
                session: sessionId ?? null,
              })
            },
          }),
          server.register({
            kind: 'exact',
            path: `${API}/stat`,
            handler: async (request, response) => {
              try {
                const url = new URL(request.url ?? '/', 'http://localhost')
                const params = await routeParams(request, url)
                const target = await resolvePath(
                  params.path,
                  params.session || undefined,
                  { allowDirectory: true },
                )
                sendJson(response, 200, {
                  kind: target.kind,
                  path: target.relative,
                  absolute: toPosix(target.absolute),
                  name: path.basename(target.absolute),
                })
              } catch (error) {
                sendJson(response, error?.status === 413 ? 413 : 400, { error: error instanceof Error ? error.message : String(error) })
              }
            },
          }),
          server.register({
            kind: 'exact',
            path: `${API}/recent`,
            handler: async (request, response) => {
              try {
                const url = new URL(request.url ?? '/', 'http://localhost')
                const params = await routeParams(request, url)
                const sessionId = params.session || undefined
                const asked = (params.dir ?? '').trim()
                const root = asked
                  ? (await resolvePath(asked, sessionId, { allowDirectory: true })).absolute
                  : await workspaceRoot(sessionId)
                const files = await scanRecent(root)
                sendJson(response, 200, { root, files })
              } catch (error) {
                sendJson(response, error?.status === 413 ? 413 : 500, { error: error instanceof Error ? error.message : String(error) })
              }
            },
          }),
          server.register({
            kind: 'exact',
            path: `${API}/read`,
            handler: async (request, response) => {
              try {
                const url = new URL(request.url ?? '/', 'http://localhost')
                const params = await routeParams(request, url)
                const target = await resolveInside(params.path, params.session || undefined)
                sendJson(response, 200, { path: target.relative, ...await snapshot(target.absolute) })
              } catch (error) {
                sendJson(response, error?.status === 413 ? 413 : 400, { error: error instanceof Error ? error.message : String(error) })
              }
            },
          }),
          server.register({
            kind: 'exact',
            path: `${API}/write`,
            handler: async (request, response) => {
              if (request.method !== 'POST') {
                response.writeHead(405, { allow: 'POST' })
                response.end()
                return
              }
              try {
                const payload = await readJsonBody(request, MAX_SAVE_BODY)
                const target = await resolveInside(payload.path, typeof payload.session === 'string' ? payload.session : undefined)
                const { status, data } = await saveDocument(target, payload)
                sendJson(response, status, data)
              } catch (error) {
                sendJson(response, error?.status === 413 ? 413 : 400, { error: error instanceof Error ? error.message : String(error) })
              }
            },
          }),
          server.register({
            kind: 'exact',
            path: `${API}/rewrite`,
            handler: async (request, response) => {
              if (request.method !== 'POST') {
                response.writeHead(405, { allow: 'POST' })
                response.end()
                return
              }
              const controller = new AbortController()
              response.on('close', () => controller.abort())
              try {
                const payload = await readJsonBody(request)
                const result = await rewrite(payload, controller.signal)
                sendJson(response, 200, result)
              } catch (error) {
                sendJson(response, error?.status === 413 ? 413 : 400, { error: error instanceof Error ? error.message : String(error) })
              }
            },
          }),
          server.register({
            kind: 'exact',
            path: `${API}/models`,
            handler: async (request, response) => {
              if (request.method !== 'POST' && request.method !== 'GET') {
                response.writeHead(405, { allow: 'GET, POST' })
                response.end()
                return
              }
              try {
                const params = await routeParams(request, new URL(request.url ?? '/', 'http://localhost'))
                sendJson(response, 200, await listModelOptions(params.session))
              } catch (error) {
                sendJson(response, error?.status === 413 ? 413 : 400, { error: error instanceof Error ? error.message : String(error) })
              }
            },
          }),
          server.register({
            kind: 'exact',
            path: `${API}/skills`,
            handler: async (request, response) => {
              if (request.method !== 'POST' && request.method !== 'GET') {
                response.writeHead(405, { allow: 'GET, POST' })
                response.end()
                return
              }
              try {
                const params = await routeParams(request, new URL(request.url ?? '/', 'http://localhost'))
                sendJson(response, 200, await listSkillOptions(params.session))
              } catch (error) {
                sendJson(response, error?.status === 413 ? 413 : 400, { error: error instanceof Error ? error.message : String(error) })
              }
            },
          }),
          server.register({
            kind: 'exact',
            path: `${API}/chat`,
            handler: async (request, response) => {
              if (request.method !== 'POST') {
                response.writeHead(405, { allow: 'POST' })
                response.end()
                return
              }
              const controller = new AbortController()
              response.on('close', () => controller.abort())
              try {
                const payload = await readJsonBody(request)
                const result = await chat(payload, controller.signal)
                sendJson(response, 200, result)
              } catch (error) {
                sendJson(response, error?.status === 413 ? 413 : 400, { error: error instanceof Error ? error.message : String(error) })
              }
            },
          }),
      ]
      } catch (error) {
        // Registering a route must never fail activation: a fibre that fails
        // here fails the Web boot audit, which takes the whole desktop app down.
        console.error('dsh-doc-pane: failed to register http routes', error)
        for (const dispose of disposers) {
          try {
            dispose()
          } catch {
            // already gone
          }
        }
        disposers = []
      }
      return () => {
        for (const dispose of disposers) {
          try {
            dispose()
          } catch {
            // already gone
          }
        }
      }
    }, 'dsh-doc-pane: http routes')
  })
}
