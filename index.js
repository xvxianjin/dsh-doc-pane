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
const MAX_BODY = 4 * 1024 * 1024

const REWRITE_SYSTEM = [
  '你是文档编辑器里的改写引擎。用户给出文档中的一段原文和一条修改要求。',
  '只输出改写后的这段文字：不要解释、不要加引号、不要用代码围栏包裹整段结果。',
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
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start < 0 || end <= start) return null
  try {
    const value = JSON.parse(raw.slice(start, end + 1))
    return value && typeof value === 'object' ? value : null
  } catch {
    return null
  }
}

/**
 * A model that writes JSON by hand often breaks it with a raw newline inside the
 * string, so a strict parse fails and the whole object used to be shown to the
 * user as the answer. This reads the two fields out of the raw text instead.
 */
function readLooseReply(raw) {
  const kindMatch = /"kind"\s*:\s*"(edit|answer)"/.exec(raw)
  const textStart = /"text"\s*:\s*"/.exec(raw)
  if (!kindMatch || !textStart || textStart.index < kindMatch.index) return null
  let index = textStart.index + textStart[0].length
  let body = ''
  while (index < raw.length) {
    const char = raw[index]
    if (char === '\\') {
      body += raw.slice(index, index + 2)
      index += 2
      continue
    }
    if (char === '"') break
    body += char
    index += 1
  }
  let text = body
  try {
    text = JSON.parse(`"${body}"`)
  } catch {
    text = body.replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\')
  }
  // An empty text is meaningful for a deletion, so only answers require content.
  if (!text.trim() && kindMatch[1] !== 'edit') return null
  return { kind: kindMatch[1], text }
}

function parseChatReply(raw, allowEdit) {
  let value = readJsonObject(raw)
  // Some models nest the JSON object inside the text field; unwrap a few levels.
  for (let depth = 0; depth < 3 && value; depth += 1) {
    const text = typeof value.text === 'string' ? value.text.trim() : ''
    if (!text || !text.startsWith('{')) break
    const inner = readJsonObject(text)
    if (!inner || typeof inner.text !== 'string') break
    value = inner
  }
  const text = typeof value?.text === 'string' ? value.text.trim() : ''
  const deleting = value?.kind === 'edit' && allowEdit && typeof value?.text === 'string' && !text
  if (text || deleting) {
    const kind = value.kind === 'edit' && allowEdit ? 'edit' : 'answer'
    return { kind, text }
  }
  const loose = readLooseReply(raw)
  if (loose) {
    const kind = loose.kind === 'edit' && allowEdit ? 'edit' : 'answer'
    if (kind === 'answer' && !loose.text.trim()) return { kind: 'answer', text: '' }
    return { kind, text: loose.text.trim() }
  }
  return { kind: 'answer', text: raw.trim() }
}

/**
 * A model may ask for full skill instructions instead of answering. Anything
 * that is not exactly that shape yields no names, so a normal reply passes
 * through untouched.
 */
function parseSkillRequest(raw) {
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start < 0 || end <= start) return []
  try {
    const value = JSON.parse(raw.slice(start, end + 1))
    if (value?.kind !== 'skill') return []
    const names = Array.isArray(value?.names) ? value.names : [value?.name]
    return names.filter((item) => typeof item === 'string' && item.trim()).map((item) => item.trim())
  } catch {
    return []
  }
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

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    let size = 0
    const chunks = []
    request.on('data', (chunk) => {
      size += chunk.length
      if (size > MAX_BODY) {
        reject(new Error('请求体过大'))
        request.destroy()
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
    const body = await readJsonBody(request).catch(() => ({}))
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

  let cachedRoute

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

  async function resolveRoute(llm) {
    if (cachedRoute && cachedRoute.expires > Date.now()) return cachedRoute.route

    let route
    const holder = ctx.get('agentDefaultModel')
    const selection = holder && typeof holder.currentSelection === 'function'
      ? holder.currentSelection()
      : undefined

    const provider = pickString(selection?.provider, selection?.providerId, selection?.route?.provider)
    const model = pickString(selection?.model, selection?.modelId, selection?.route?.model, selection?.modelName)
    const reasoningEffort = pickString(selection?.reasoningEffort, selection?.reasoning, selection?.effort)
    if (provider && model) route = { provider, model, reasoningEffort }

    if (!route) {
      const providers = await llm.listProviders()
      for (const entry of providers) {
        const models = await llm.listModels(entry.id)
        if (models.length) {
          route = { provider: entry.id, model: models[0].id }
          break
        }
      }
    }
    if (!route) throw new Error('没有可用的模型：请先在设置里选择默认模型')

    cachedRoute = { route, expires: Date.now() + 60_000 }
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

    const route = await resolveRoute(llm)
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
    if (signal) signal.addEventListener('abort', () => controller.abort(), { once: true })
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
      for await (const chunk of stream) {
        if (chunk?.type === 'text-delta') text += chunk.text
        else if (chunk?.type === 'finish') {
          const kind = chunk.reason?.kind
          if (kind === 'error' || kind === 'aborted') {
            const detail = chunk.reason?.failure?.message ?? kind
            throw new Error(`模型调用失败：${detail}`)
          }
        }
      }
    } finally {
      clearTimeout(timer)
    }

    const cleaned = cleanModelText(text)
    if (!cleaned) throw new Error('模型没有返回内容')
    return { text: cleaned, provider: route.provider, model: route.model, mode: ask ? 'ask' : 'rewrite' }
  }

  /**
   * One entry point for the side chat: the model decides whether the user is
   * asking a question or asking for the quoted passage to be rewritten, and
   * answers with `{ kind, text }`. A quote is required for an edit.
   */
  /** Providers and their models, for the composer's model picker. */
  async function listModelOptions() {
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
    let current = null
    const holder = ctx.get('agentDefaultModel')
    const selection = holder && typeof holder.currentSelection === 'function' ? holder.currentSelection() : undefined
    const provider = pickString(selection?.provider, selection?.providerId, selection?.route?.provider)
    const model = pickString(selection?.model, selection?.modelId, selection?.route?.model, selection?.modelName)
    if (provider && model) current = { provider, model }
    return { providers: out, current }
  }

  /** The skill catalog, for the composer's skill picker. */
  async function listSkillOptions() {
    const registry = ctx.get('skills')
    if (!registry || typeof registry.list !== 'function') return { skills: [] }
    const list = await registry.list()
    return {
      skills: (Array.isArray(list) ? list : [])
        .map((item) => ({
          name: pickString(item?.name, item?.id) ?? '',
          description: pickString(item?.description, item?.summary) ?? '',
        }))
        .filter((item) => item.name),
    }
  }

  /** A skill's instructions as text, whatever field the definition keeps them in. */
  async function readSkill(name) {
    const registry = ctx.get('skills')
    if (!registry || typeof registry.get !== 'function') return ''
    let definition
    try {
      definition = await registry.get(name)
    } catch (error) {
      console.error('dsh-doc-pane: skill lookup failed', name, error)
      return ''
    }
    if (!definition) return ''
    for (const key of ['content', 'instructions', 'body', 'text', 'markdown', 'prompt']) {
      const value = definition[key]
      if (typeof value === 'string' && value.trim()) return value
    }
    const file = pickString(definition.path, definition.file, definition.filePath)
    if (file) {
      try {
        const target = await ctx.fs.resolve(file)
        const text = await ctx.fs.readText(target)
        if (typeof text === 'string' && text.trim()) return text
      } catch (error) {
        console.error('dsh-doc-pane: skill file read failed', file, error)
      }
    }
    return pickString(definition.description, definition.summary) ?? ''
  }

  /** Name + one-line description of every skill, so the model can ask for one. */
  async function skillCatalog() {
    const { skills } = await listSkillOptions()
    const lines = []
    for (const item of skills) {
      const description = item.description.replace(/\s+/g, ' ').slice(0, 180)
      lines.push(description ? `- ${item.name}：${description}` : `- ${item.name}`)
    }
    return lines.join('\n').slice(0, 2400)
  }

  /** Deduplicated, capped name list out of whatever the client sent. */
  function normalizeSkills(names) {
    const out = []
    for (const item of Array.isArray(names) ? names : []) {
      const name = typeof item === 'string' ? item.trim() : ''
      if (name && !out.includes(name)) out.push(name)
      if (out.length >= 4) break
    }
    return out
  }

  /**
   * The system prompt, the skill catalog, and the full text of the skills that
   * are in play. The catalog is always sent: in the centre chat the agent sees
   * it and picks skills on its own, and this panel copies that behaviour by
   * letting the model ask for the full instructions.
   */
  async function composeSystem(names, options = {}) {
    const picked = normalizeSkills(names)
    const chunks = []
    for (const name of picked) {
      const body = await readSkill(name)
      if (body) chunks.push(`【技能 ${name}】\n${body.slice(0, 6000)}`)
    }
    const lines = [CHAT_SYSTEM]
    if (options.catalog !== false) {
      const catalog = await skillCatalog()
      if (catalog) lines.push('', '【可用技能目录】', catalog)
    }
    if (chunks.length) {
      lines.push(
        '',
        '下面这些技能的完整说明已经加载。按技能的步骤、术语和风格处理这次请求，',
        '但输出格式不变：仍然只能是一个 {kind, text} 的 JSON 对象。',
        '',
        chunks.join('\n\n'),
      )
    }
    return lines.join('\n')
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
    const route = picked ?? (await resolveRoute(llm))
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

    const pickedSkills = normalizeSkills(payload?.skills)

    const controller = new AbortController()
    if (signal) signal.addEventListener('abort', () => controller.abort(), { once: true })
    const timer = setTimeout(() => controller.abort(), 150_000)

    /** One model call; returns the raw text. */
    const ask = async (system) => {
      let text = ''
      const stream = llm.stream({
        provider: route.provider,
        model: route.model,
        ...(route.reasoningEffort ? { reasoningEffort: route.reasoningEffort } : {}),
        system,
        messages: [{ role: 'user', content: [{ type: 'text', text: parts.join('\n') }] }],
        maxTokens: 4000,
        signal: controller.signal,
      })
      for await (const chunk of stream) {
        if (chunk?.type === 'text-delta') text += chunk.text
        else if (chunk?.type === 'finish') {
          const kind = chunk.reason?.kind
          if (kind === 'error' || kind === 'aborted') {
            const detail = chunk.reason?.failure?.message ?? kind
            throw new Error(`模型调用失败：${detail}`)
          }
        }
      }
      return cleanModelText(text)
    }

    let usedSkills = pickedSkills
    let cleaned = ''
    try {
      cleaned = await ask(await composeSystem(pickedSkills, { catalog: true }))
      const wanted = parseSkillRequest(cleaned).filter((name) => !usedSkills.includes(name)).slice(0, 2)
      if (wanted.length) {
        usedSkills = normalizeSkills([...usedSkills, ...wanted])
        cleaned = await ask(await composeSystem(usedSkills, { catalog: true }))
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
                sendJson(response, 400, { error: error instanceof Error ? error.message : String(error) })
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
                sendJson(response, 500, { error: error instanceof Error ? error.message : String(error) })
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
                const [content, stat] = await Promise.all([
                  fs.readFile(target.absolute, 'utf8'),
                  fs.stat(target.absolute),
                ])
                sendJson(response, 200, { path: target.relative, content, mtime: stat.mtimeMs })
              } catch (error) {
                sendJson(response, 400, { error: error instanceof Error ? error.message : String(error) })
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
                const payload = await readJsonBody(request)
                const target = await resolveInside(payload.path, typeof payload.session === 'string' ? payload.session : undefined)
                const content = typeof payload.content === 'string' ? payload.content : ''
                const expected = typeof payload.expectedMtime === 'number' ? payload.expectedMtime : undefined
                if (expected !== undefined) {
                  const current = await fs.stat(target.absolute).catch(() => undefined)
                  if (current && Math.abs(current.mtimeMs - expected) > 1) {
                    const latest = await fs.readFile(target.absolute, 'utf8').catch(() => '')
                    sendJson(response, 409, { conflict: true, content: latest, mtime: current.mtimeMs })
                    return
                  }
                }
                await fs.writeFile(target.absolute, content, 'utf8')
                const stat = await fs.stat(target.absolute)
                sendJson(response, 200, { path: target.relative, mtime: stat.mtimeMs })
              } catch (error) {
                sendJson(response, 400, { error: error instanceof Error ? error.message : String(error) })
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
              request.on('close', () => controller.abort())
              try {
                const payload = await readJsonBody(request)
                const result = await rewrite(payload, controller.signal)
                sendJson(response, 200, result)
              } catch (error) {
                sendJson(response, 400, { error: error instanceof Error ? error.message : String(error) })
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
                sendJson(response, 200, await listModelOptions())
              } catch (error) {
                sendJson(response, 400, { error: error instanceof Error ? error.message : String(error) })
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
                sendJson(response, 200, await listSkillOptions())
              } catch (error) {
                sendJson(response, 400, { error: error instanceof Error ? error.message : String(error) })
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
              request.on('close', () => controller.abort())
              try {
                const payload = await readJsonBody(request)
                const result = await chat(payload, controller.signal)
                sendJson(response, 200, result)
              } catch (error) {
                sendJson(response, 400, { error: error instanceof Error ? error.message : String(error) })
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
