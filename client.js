window.__ModuleLoader__.load({
  id: 'dsh-doc-pane',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    const NS = 'dsh-doc-pane'
    const API = '/dsh-doc-pane/api'
    // The right-column tab: the type id is also the slot key its body and
    // title register under, and the kind is what the header button opens.
    const TAB_ID = 'dsh-doc-pane'
    const TAB_KIND = 'doc-pane'
    // Which files this panel claims when a link in the chat is clicked.
    const TEXT_EXT = /\.(md|markdown|mdx|txt)$/i
    const FILE_PREFIX = 'dsh-resource://file/'

    /**
     * A `dsh-resource://file/…` address, in the same grammar the shipped
     * document preview uses: `session/<id>/<path>` or an absolute path.
     */
    function parseFileAddress(address) {
      if (typeof address !== 'string' || !address.startsWith(FILE_PREFIX)) return null
      const rest = address.slice(FILE_PREFIX.length).split(/[?#]/)[0]
      const parts = rest.split('/').filter((part) => part.length > 0)
      if (!parts.length) return null
      const decode = (value) => {
        try {
          return decodeURIComponent(value)
        } catch {
          return value
        }
      }
      /**
       * A chat link to a line carries a `:<digits>` suffix (`README.md:41`),
       * which is not part of the file name. Split it off here so every
       * caller — canOpen, the link hook and the read path — sees the file.
       */
      const withLine = (value) => {
        const match = /^(.*?\.(?:[^/\\:]+)):(\d+)$/.exec(value)
        if (!match) return { path: value, line: undefined }
        return { path: match[1], line: Number(match[2]) }
      }
      if (parts[0] === 'session' && parts.length >= 3) {
        const file = withLine(parts.slice(2).map(decode).join('/'))
        return {
          scope: 'session',
          sessionId: decode(parts[1]),
          path: file.path,
          line: file.line,
        }
      }
      if (parts.length === 1 && /^[a-zA-Z]:$/.test(parts[0])) return null
      const file = withLine(parts.map(decode).join('/'))
      return { scope: 'absolute', path: file.path, line: file.line }
    }

    /* ------------------------------------------------------------------ */
    /* dictionaries                                                        */
    /* ------------------------------------------------------------------ */

    const zh = {
      panelTitle: '文档',
      panelSub: 'agent 正在改写的 Markdown',
      openButton: '文档侧栏',
      close: '关闭',
      save: '保存',
      saving: '保存中…',
      saved: '已保存',
      unsaved: '未保存',
      refresh: '刷新',
      toDoc: '文档',
      toSource: '源码',
      files: '文档列表',
      recent: '最近修改',
      emptyList: '这个目录里没有 Markdown。也可以在上面粘贴一个文档路径、回车直接打开。',
      filterPlaceholder: '粘贴文档或文件夹路径后回车',
      openFolder: '打开文件夹…',
      backToWorkspace: '回到工作区',
      openPath: '打开',
      folderUnsupported: '当前环境不支持选择文件夹，直接输入路径即可',
      loadFailed: '读取失败',
      openFailed: '打开失败',
      saveFailed: '保存失败',
      staleReply: '文档已更改，未应用这次 AI 回复。',
      conflict: '这个文档在磁盘上已经被改动过了。',
      overwrite: '用我的版本覆盖',
      loadLatest: '载入最新内容',
      externalReloaded: '文档已被外部修改，已载入最新内容',
      pendingHint: '待确认的修改：点一下这段文字就消掉高亮',
      pendingCount: (n) => `待确认 ${n}`,
      pendingClear: '全部标为已读',
      followChip: '回到当前会话',
      followHint: '这篇文档来自另一个对话：点一下关掉它，回到当前对话的文档列表。',
      chatResize: '拖动调整对话区高度',
      modelAuto: '默认模型',
      modelHint: '选择这次对话用的模型',
      modelDefault: '跟随会话默认',
      modelDefaultHint: '和中间对话同一个模型',
      modelEmpty: '这个部署没有可用的模型',
      skillPick: '技能',
      skillHint: '给这次对话加技能',
      skillPickCount: (n) => `技能 ${n}`,
      skillEmpty: '这个部署没有可用的技能',
      skillRemove: '移除这个技能',
      skillsUsed: (names) => `已自动加载技能：${names}`,
      markLost: '这处改动在文档里已经找不到了（可能被改过），刷新一下再试',
      chatThinking: '正在想…',
      chatPlaceholder: '发消息，回车发送，Shift+回车换行',
      chatPlaceholderQuote: '说说这段要怎么改，或者问它问题',
      chatSend: '发送',
      chatFailed: '没回应',
      defaultPrompt: '这段你看着改，改得更清楚一些',
      quoteRemove: '取消引用',
      markAccept: '接受',
      markRevert: '拒绝并还原',
      markAnnotate: '批注',
      editAppliedNote: '已经改到文档里了：点高亮那段可以接受、撤销，或者把它批注一番。',
      deleteAppliedNote: '已经删掉了：点高亮那段可以接受、还原，或者继续批注。',
      emptyReply: '它这次没有返回内容，再说一次试试。',
      markDeletedHint: '这段已经删掉了：接受就保持删除，还原就把它放回去',
      retry: '重试',
      changes: '差异',
      copy: '复制',
      copied: '已复制',
      zoomIn: '放大',
      zoomOut: '缩小',
      zoomReset: '恢复 100%',
      zoomHint: 'Ctrl + 滚轮缩放整个面板',
      quick: '快选',
      loading: '载入中…',
      opening: '正在打开…',
      noModel: '没有可用的模型',
      gotoFiles: '← 文档列表',
      chars: (n) => `${n} 字符`,
      discardConfirm: '当前文档有未保存的修改，确定要放弃吗？',
      noMatch: '没有匹配的文档',
      noSession: '先打开一个对话，再从这里查看该对话正在编辑的文档。',
      justNow: '刚刚',
      minutesAgo: (n) => `${n} 分钟前`,
      hoursAgo: (n) => `${n} 小时前`,
      daysAgo: (n) => `${n} 天前`,
      barBold: '加粗',
      barItalic: '斜体',
      barStrike: '删除线',
      barCode: '行内代码',
      barLink: '链接',
      barQuote: '引用到对话',
      barLinkPrompt: '链接地址（留空则取消链接）',
      barLinkApply: '确定',
      slashH1: '标题 1',
      slashH2: '标题 2',
      slashH3: '标题 3',
      slashBullet: '无序列表',
      slashOrdered: '有序列表',
      slashTodo: '待办',
      slashQuote: '引用',
      slashCode: '代码块',
      slashTable: '表格',
      slashDivider: '分割线',
      slashImage: '图片',
      slashEmpty: '没有匹配的块',
      slashParagraph: '正文',
      gripMenu: '块操作',
      gripUp: '上移',
      gripDown: '下移',
      gripCopy: '复制',
      gripDelete: '删除',
      tableRowBefore: '上方插入行',
      tableRowAfter: '下方插入行',
      tableColBefore: '左侧插入列',
      tableColAfter: '右侧插入列',
      tableRowDelete: '删除行',
      tableColDelete: '删除列',
      tableHeader: '表头行',
      tableDelete: '删除表格',
    }

    const en = {
      panelTitle: 'Document',
      panelSub: 'the Markdown the agent is editing',
      openButton: 'Document pane',
      close: 'Close',
      save: 'Save',
      saving: 'Saving…',
      saved: 'Saved',
      unsaved: 'Unsaved',
      refresh: 'Refresh',
      toDoc: 'Document',
      toSource: 'Source',
      files: 'Documents',
      recent: 'Recently modified',
      emptyList: 'No Markdown in this folder. Paste a document path above and press Enter to open it.',
      filterPlaceholder: 'Paste a document or folder path and press Enter',
      openFolder: 'Open folder…',
      backToWorkspace: 'Back to workspace',
      openPath: 'Open',
      folderUnsupported: 'This environment cannot pick folders — type the path instead',
      loadFailed: 'Could not read the file',
      openFailed: 'Could not open the document',
      saveFailed: 'Could not save the file',
      staleReply: 'The document changed. The AI reply was not applied.',
      conflict: 'This document changed on disk meanwhile.',
      overwrite: 'Overwrite with mine',
      loadLatest: 'Load latest',
      externalReloaded: 'The document changed on disk and was reloaded',
      pendingHint: 'Changed since you last read it: click the text to clear the highlight',
      pendingCount: (n) => `${n} pending`,
      pendingClear: 'Mark all as read',
      followChip: 'Back to this chat',
      followHint: 'This document belongs to another chat. Click to close it and browse the current folder.',
      chatResize: 'Drag to resize the chat area',
      modelAuto: 'Default model',
      modelHint: 'Pick the model for this conversation',
      modelDefault: 'Session default',
      modelDefaultHint: 'Same model as the centre chat',
      modelEmpty: 'No model is available in this deployment',
      skillPick: 'Skills',
      skillHint: 'Add skills to this conversation',
      skillPickCount: (n) => `Skills ${n}`,
      skillEmpty: 'No skill is available in this deployment',
      skillRemove: 'Remove this skill',
      skillsUsed: (names) => `Skill loaded on its own: ${names}`,
      markLost: 'That change is no longer in the document; reload and try again',
      chatThinking: 'Thinking…',
      chatPlaceholder: 'Message it — Enter sends, Shift+Enter breaks the line',
      chatPlaceholderQuote: 'Say how the quote should change, or ask about it',
      chatSend: 'Send',
      chatFailed: 'No answer',
      defaultPrompt: 'Tidy the quoted passage up',
      quoteRemove: 'Remove the quote',
      markAccept: 'Accept',
      markRevert: 'Reject and restore',
      markAnnotate: 'Comment',
      editAppliedNote: 'Written into the document — click the highlight to accept it, undo it, or comment on it.',
      deleteAppliedNote: 'Deleted — click the highlighted line to keep it gone, restore it, or comment on it.',
      emptyReply: 'The model returned nothing — try asking again.',
      markDeletedHint: 'Removed — accept to keep it deleted, or restore it',
      retry: 'Retry',
      changes: 'Changes',
      copy: 'Copy',
      copied: 'Copied',
      zoomIn: 'Zoom in',
      zoomOut: 'Zoom out',
      zoomReset: 'Back to 100%',
      zoomHint: 'Ctrl + wheel zooms the whole panel',
      quick: 'Quick',
      loading: 'Loading…',
      opening: 'Opening…',
      noModel: 'No model available',
      gotoFiles: '← Documents',
      chars: (n) => `${n} chars`,
      discardConfirm: 'This document has unsaved changes. Discard them?',
      noMatch: 'No matching documents',
      noSession: 'Open a conversation first, then come back to see the document it is editing.',
      justNow: 'just now',
      minutesAgo: (n) => `${n} min ago`,
      hoursAgo: (n) => `${n} h ago`,
      daysAgo: (n) => `${n} d ago`,
      barBold: 'Bold',
      barItalic: 'Italic',
      barStrike: 'Strikethrough',
      barCode: 'Inline code',
      barLink: 'Link',
      barQuote: 'Quote in chat',
      barLinkPrompt: 'Link address (leave empty to remove it)',
      barLinkApply: 'Apply',
      slashH1: 'Heading 1',
      slashH2: 'Heading 2',
      slashH3: 'Heading 3',
      slashBullet: 'Bullet list',
      slashOrdered: 'Numbered list',
      slashTodo: 'To-do',
      slashQuote: 'Quote',
      slashCode: 'Code block',
      slashTable: 'Table',
      slashDivider: 'Divider',
      slashImage: 'Image',
      slashEmpty: 'No matching block',
      slashParagraph: 'Text',
      gripMenu: 'Block actions',
      gripUp: 'Move up',
      gripDown: 'Move down',
      gripCopy: 'Duplicate',
      gripDelete: 'Delete',
      tableRowBefore: 'Insert row above',
      tableRowAfter: 'Insert row below',
      tableColBefore: 'Insert column left',
      tableColAfter: 'Insert column right',
      tableRowDelete: 'Delete row',
      tableColDelete: 'Delete column',
      tableHeader: 'Header row',
      tableDelete: 'Delete table',
    }

    /**
     * Read a service without declaring it (a plain `ctx.<name>` access throws in
     * this runtime when the name is not part of the fiber's inject list).
     */
    function service(ctx, name) {
      try {
        return typeof ctx.get === 'function' ? ctx.get(name) : undefined
      } catch {
        return undefined
      }
    }

    function makeTranslator(ctx, locale) {
      const base = (key) => (zh[key] !== undefined ? zh[key] : en[key] !== undefined ? en[key] : key)
      if (!locale || typeof locale.register !== 'function') return base
      try {
        ctx.effect(() => locale.register(NS, { zh, en }), 'dsh-doc-pane: dictionaries')
      } catch {
        return base
      }
      let bound
      try {
        bound = typeof locale.bind === 'function' ? locale.bind(NS) : undefined
      } catch {
        bound = undefined
      }
      if (typeof bound !== 'function') return base
      return (key, ...args) => {
        let value
        try {
          value = bound(key)
        } catch {
          value = undefined
        }
        if (value === undefined || value === null || value === '' || value === key) value = base(key)
        return typeof value === 'function' ? value(...args) : value
      }
    }

    /* ------------------------------------------------------------------ */
    /* transport                                                           */
    /* ------------------------------------------------------------------ */

    function endpoint(pathname) {
      const url = new URL(pathname.replace(/^\/+/, ''), document.baseURI)
      return url.pathname + url.search
    }

    async function request(pathname, options) {
      let response
      try {
        response = await fetch(endpoint(API + pathname), {
          credentials: 'same-origin',
          ...options,
          headers: { 'content-type': 'application/json', ...(options && options.headers) },
        })
      } catch (error) {
        throw new Error(`无法连接宿主：${error && error.message ? error.message : error}`)
      }
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        const failure = new Error(data && data.error ? data.error : `请求失败（${response.status}）`)
        failure.status = response.status
        failure.data = data
        throw failure
      }
      return data
    }

    function postJson(pathname, payload, sessionId) {
      const session = sessionId
      return request(pathname, {
        method: 'POST',
        body: JSON.stringify(session ? { ...payload, session } : payload),
      })
    }

    const listRecent = (folder, session) => postJson('/recent', folder ? { dir: folder } : {}, session)
    const readDoc = (path, sessionId) => postJson('/read', { path }, sessionId)
    const writeDoc = (payload, sessionId) => postJson('/write', payload, sessionId)
    const rewriteDoc = (payload) => postJson('/rewrite', payload)
    const chatDoc = (payload, sessionId) => postJson('/chat', payload, sessionId)
    const listModels = (session) => postJson('/models', {}, session)
    const listSkills = (session) => postJson('/skills', {}, session)
    const statPath = (path, session) => postJson('/stat', { path }, session)

    /* ------------------------------------------------------------------ */
    /* word-level diff                                                     */
    /* ------------------------------------------------------------------ */

    const TOKEN = /[A-Za-z0-9_]+|\s+|[\u3400-\u9fff]|[^\sA-Za-z0-9_\u3400-\u9fff]/g

    function tokenize(text) {
      const out = []
      TOKEN.lastIndex = 0
      let match
      while ((match = TOKEN.exec(text)) !== null) out.push(match[0])
      return out
    }

    function push(ops, type, text) {
      if (!text) return
      const last = ops[ops.length - 1]
      if (last && last.type === type) last.text += text
      else ops.push({ type, text })
    }

    function coarseDiff(before, after) {
      const ops = []
      let head = 0
      const max = Math.min(before.length, after.length)
      while (head < max && before[head] === after[head]) head++
      let tail = 0
      while (
        tail < max - head &&
        before[before.length - 1 - tail] === after[after.length - 1 - tail]
      ) tail++
      push(ops, 'same', before.slice(0, head))
      push(ops, 'del', before.slice(head, before.length - tail))
      push(ops, 'ins', after.slice(head, after.length - tail))
      push(ops, 'same', before.slice(before.length - tail))
      return ops
    }

    function diffText(before, after) {
      if (before === after) return [{ type: 'same', text: before }]
      const left = tokenize(before)
      const right = tokenize(after)
      const n = left.length
      const m = right.length
      if (n * m > 500000) return coarseDiff(before, after)

      const width = m + 1
      const table = new Int32Array((n + 1) * width)
      for (let i = n - 1; i >= 0; i--) {
        for (let j = m - 1; j >= 0; j--) {
          table[i * width + j] =
            left[i] === right[j]
              ? table[(i + 1) * width + j + 1] + 1
              : Math.max(table[(i + 1) * width + j], table[i * width + j + 1])
        }
      }

      const ops = []
      let i = 0
      let j = 0
      while (i < n && j < m) {
        if (left[i] === right[j]) {
          push(ops, 'same', left[i])
          i++
          j++
        } else if (table[(i + 1) * width + j] >= table[i * width + j + 1]) {
          push(ops, 'del', left[i])
          i++
        } else {
          push(ops, 'ins', right[j])
          j++
        }
      }
      while (i < n) push(ops, 'del', left[i++])
      while (j < m) push(ops, 'ins', right[j++])
      return ops
    }

    /* ------------------------------------------------------------------ */
    /* markdown preview                                                    */
    /* ------------------------------------------------------------------ */

    const INLINE = /(`[^`\n]+`)|(\*\*[^*\n]+\*\*)|(\*[^*\n]+\*)|(~~[^~\n]+~~)|(\[[^\]\n]+\]\([^\s)]+\))/g

    /**
     * A fenced code block with its own header: the language on the left, a
     * one-click copy on the right. Copying is best effort — a missing clipboard
     * API simply reports success so the button never becomes a dead end.
     */
    function CodeBlock(props) {
      const [copied, setCopied] = React.useState(false)
      const timer = React.useRef(0)
      React.useEffect(() => () => window.clearTimeout(timer.current), [])
      const copy = () => {
        const done = () => {
          setCopied(true)
          window.clearTimeout(timer.current)
          timer.current = window.setTimeout(() => setCopied(false), 1600)
        }
        try {
          const clipboard = typeof navigator !== 'undefined' ? navigator.clipboard : undefined
          if (clipboard && typeof clipboard.writeText === 'function') {
            clipboard.writeText(props.text || '').then(done, done)
            return
          }
        } catch {
          // fall through to the no-op path
        }
        done()
      }
      return h(
        'div',
        { className: 'dsp-code' },
        h(
          'div',
          { className: 'dsp-code-bar' },
          h('span', { className: 'dsp-code-lang' }, props.lang || 'text'),
          h(
            'button',
            { type: 'button', className: 'dsp-code-copy', onClick: copy },
            copied ? props.copiedLabel : props.copyLabel,
          ),
        ),
        h('pre', { className: 'dsp-code-pre', 'data-src': props.srcStart }, h('code', null, props.text)),
      )
    }

    /**
     * Pending-review ranges are part of the React tree instead of being painted
     * onto the DOM afterwards: React owns the preview, so a mark has to come out
     * of the render to survive the next update.
     */
    let RENDER_PENDING = null

    /**
     * Deletions have no text left to highlight, so the removed words come back
     * into the render as a struck-through ghost at the position they were cut
     * from — the way a suggestion-mode editor shows a deletion. Clicking the
     * ghost restores the original words.
     */
    let RENDER_GHOSTS = null

    /** The plain text of a rendered node, ignoring elements and keys. */
    function plainTextOf(node) {
      if (node === null || node === undefined || node === false) return ''
      if (typeof node === 'string' || typeof node === 'number') return String(node)
      if (Array.isArray(node)) return node.map(plainTextOf).join('')
      if (typeof node !== 'object') return ''
      const children = Array.isArray(node.children)
        ? node.children
        : node.props && node.props.children !== undefined
          ? Array.isArray(node.props.children)
            ? node.props.children
            : [node.props.children]
          : []
      return children.map(plainTextOf).join('')
    }

    function nodeChildren(node) {
      if (!node || typeof node !== 'object') return []
      if (Array.isArray(node.children)) return node.children
      const children = node.props ? node.props.children : undefined
      if (children === undefined) return []
      return Array.isArray(children) ? children : [children]
    }

    /** A copy of an element with extra props (children untouched). */
    function withProps(node, extra) {
      const props = { ...(node.props || {}), ...extra }
      const children = nodeChildren(node)
      return h(node.type, props, ...children)
    }

    function highlightRuns(text, keyBase) {
      const pending = RENDER_PENDING
      if (!pending || !pending.patterns || !pending.patterns.length || !text) return [text]
      const nodes = []
      let rest = text
      let counter = 0
      let guard = 0
      while (rest && guard < 50) {
        guard += 1
        let best = null
        pending.patterns.forEach((item) => {
          if (pending.used.has(item.entry.id)) return
          const found = item.pattern.exec(rest) || (item.plain ? item.plain.exec(rest) : null)
          if (!found) return
          if (!best || found.index < best.index) {
            best = { index: found.index, length: found[0].length, entry: item.entry }
          }
        })
        if (!best) break
        if (best.index > 0) nodes.push(rest.slice(0, best.index))
        nodes.push(
          h(
            'mark',
            {
              key: keyBase + '-pend' + counter,
              className: 'dsp-pending',
              'data-pending-id': best.entry.id,
              title: pending.hint || '',
            },
            rest.slice(best.index, best.index + best.length),
          ),
        )
        pending.used.add(best.entry.id)
        counter += 1
        rest = rest.slice(best.index + best.length)
      }
      if (rest) nodes.push(rest)
      return nodes
    }

    /** One struck-through deletion marker, positioned where the cut was made. */
    function ghostNode(ghost, key) {
      if (RENDER_GHOSTS && RENDER_GHOSTS.used) RENDER_GHOSTS.used.add(ghost.id)
      return h(
        'del',
        {
          key,
          className: 'dsp-ghost',
          'data-pending-id': ghost.id,
          title: (RENDER_GHOSTS && RENDER_GHOSTS.hint) || '',
        },
        String(ghost.display || ghost.before || ''),
      )
    }

    /**
     * The edit view shows raw Markdown in a textarea, so pending fragments are
     * painted by a mirror <pre> behind it: transparent text, only the changed
     * runs keep a band. Sharing highlightRuns keeps one fragment marked once,
     * exactly like the preview.
     */
    function mirrorLines(content, pending) {
      const previous = RENDER_PENDING
      const patterns = []
      if (pending && pending.items && pending.items.length) {
        pending.items.forEach((entry) => {
          if (!entry || !entry.text) return
          try {
            patterns.push({
              entry,
              pattern: new RegExp(
                entry.text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+'),
              ),
            })
          } catch {
            // an unescaped oddity is skipped rather than failing the render
          }
        })
      }
      RENDER_PENDING = { patterns, hint: pending && pending.hint, used: new Set() }
      const out = []
      try {
        const lines = String(content || '').replace(/\r\n?/g, '\n').split('\n')
        lines.forEach((line, index) => {
          highlightRuns(line, 'mirror' + index).forEach((node) => out.push(node))
          if (index < lines.length - 1) out.push('\n')
        })
      } finally {
        RENDER_PENDING = previous
      }
      return out
    }

    function renderInline(text, keyBase, base) {
      const nodes = []
      const known = base !== undefined && base !== null
      const at = (offset) => (known ? base + offset : undefined)
      // Each run carries the offset of its first character in the source, so a
      // selection in the preview can be turned back into source positions
      // without matching the visible text (markers are gone by then).
      const run = (slice, key, offset) => {
        const frame = RENDER_GHOSTS
        const nodes = []
        const abs = known ? base + offset : 0
        let cursor = 0
        let seq = 0
        if (known && frame && frame.items.length) {
          frame.items.forEach((ghost) => {
            if (frame.used.has(ghost.id)) return
            if (ghost.start < abs || ghost.start > abs + slice.length) return
            const local = ghost.start - abs
            if (local > cursor) {
              nodes.push(
                h(
                  'span',
                  { key: `${key}-s${seq}`, 'data-src': abs + cursor },
                  highlightRuns(slice.slice(cursor, local), `${key}-r${seq}`),
                ),
              )
              seq += 1
            }
            nodes.push(ghostNode(ghost, `${key}-g${seq}`))
            seq += 1
            cursor = local
          })
        }
        const rest = slice.slice(cursor)
        if (rest) {
          if (known) {
            nodes.push(
              h('span', { key: `${key}-s${seq}`, 'data-src': abs + cursor }, highlightRuns(rest, `${key}-r${seq}`)),
            )
          } else {
            highlightRuns(rest, `${key}-r${seq}`).forEach((node) => nodes.push(node))
          }
        }
        return nodes
      }
      let last = 0
      let index = 0
      // A private matcher: link labels recurse into renderInline, and a shared
      // global regex would have its lastIndex reset by the nested call and loop
      // forever.
      const pattern = new RegExp(INLINE.source, 'g')
      let match
      while ((match = pattern.exec(text)) !== null) {
        if (match.index > last) {
          run(text.slice(last, match.index), `${keyBase}-p${last}`, last).forEach((node) => nodes.push(node))
        }
        const raw = match[0]
        const key = `${keyBase}-i${index++}`
        if (raw.startsWith('`')) {
          nodes.push(h('code', { key, className: 'dsp-md-code', 'data-src': at(match.index + 1) }, raw.slice(1, -1)))
        } else if (raw.startsWith('**')) {
          nodes.push(h('strong', { key, 'data-src': at(match.index + 2) }, raw.slice(2, -2)))
        } else if (raw.startsWith('~~')) {
          nodes.push(h('del', { key, 'data-src': at(match.index + 2) }, raw.slice(2, -2)))
        } else if (raw.startsWith('*')) {
          nodes.push(h('em', { key, 'data-src': at(match.index + 1) }, raw.slice(1, -1)))
        } else {
          const close = raw.indexOf('](')
          nodes.push(
            h(
              'a',
              { key, href: raw.slice(close + 2, -1), target: '_blank', rel: 'noreferrer', 'data-src': at(match.index + 1) },
              renderInline(raw.slice(1, close), key, at(match.index + 1)),
            ),
          )
        }
        last = match.index + raw.length
      }
      if (last < text.length) {
        run(text.slice(last), `${keyBase}-p${last}`, last).forEach((node) => nodes.push(node))
      }
      return nodes
    }

    function isTableSeparator(line) {
      return /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(line)
    }

    function tableCells(line) {
      const cells = []
      let start = line.indexOf('|') + 1
      let text = ''
      const push = () => cells.push({ text: text.trim(), start: start + text.length - text.trimStart().length })
      for (let i = start; i < line.length; i++) {
        const ch = line[i]
        if (ch === '\\' && (line[i + 1] === '|' || line[i + 1] === '\\')) text += line[++i]
        else if (ch === '|') {
          push()
          text = ''
          start = i + 1
        } else text += ch
      }
      if (text.trim() || !cells.length) push()
      return cells
    }

    function translateOr(t, key, fallback) {
      if (typeof t !== 'function') return fallback
      const value = t(key)
      return typeof value === 'string' && value !== key ? value : fallback
    }

    function renderMarkdown(source, labels, pending, options) {
      // Patterns are compiled once per render, not once per text run: a long
      // document has hundreds of runs and a handful of pending fragments.
      RENDER_PENDING = null
      if (pending && pending.items && pending.items.length) {
        const patterns = []
        pending.items.forEach((entry) => {
          if (!entry || !entry.text) return
          try {
            const make = (text) => {
              const body = text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+')
              return body ? new RegExp(body) : null
            }
            const pattern = make(entry.text)
            if (!pattern) return
            // Rendered text carries no Markdown markers, so a fragment holding
            // `code` or **bold** also needs a marker-free pattern to match.
            const stripped = entry.text.replace(/(\*\*|~~|__|`|\*|_)/g, '')
            const plain = stripped !== entry.text ? make(stripped) : null
            // A rewrite may cover several paragraphs; no single block contains
            // all of it, so each changed line is matched on its own as well.
            const parts = []
            String(entry.text)
              .split(/\r?\n/)
              .map((line) => line.trim())
              .slice(0, 24)
              .forEach((line) => {
                const body = line.replace(/^(#{1,6}\s+|>\s?|[-*+]\s+(?:\[[ xX]\]\s+)?|\d+[.)]\s+)/, '')
                const bare = body.replace(/(\*\*|~~|__|`|\*|_)/g, '')
                ;[body, bare].forEach((candidate) => {
                  if (!candidate || candidate.length < 2) return
                  const regexp = make(candidate)
                  if (regexp) parts.push(regexp)
                })
              })
            patterns.push({ entry, pattern, plain, parts })
          } catch {
            // an unescaped oddity is skipped rather than failing the render
          }
        })
        RENDER_PENDING = { patterns, hint: pending.hint, used: new Set() }
      }
      // Deletions come back as ghosts; they carry an absolute offset, so they
      // need no per-line mapping.
      const previousGhosts = RENDER_GHOSTS
      const ghostItems =
        pending && pending.items
          ? pending.items.filter((item) => item && item.deleted && typeof item.start === 'number')
          : []
      RENDER_GHOSTS = ghostItems.length ? { items: ghostItems, hint: pending.hint, used: new Set() } : null
      const normalized = source.replace(/\r\n?/g, '\n')
      const lines = normalized.split('\n')
      // Where each line begins in the source, so every block can pass its own
      // starting offset down to the runs it renders.
      const lineStarts = []
      let lineOffset = 0
      lines.forEach((line) => {
        lineStarts.push(lineOffset)
        lineOffset += line.length + 1
      })
      // CRLF source would shift every offset; without offsets the selection
      // falls back to matching the visible text, which still works.
      const offsetsOk = normalized.length === source.length
      const srcOf = (index, base) => (offsetsOk ? lineStarts[index] + base : undefined)
      const blocks = []
      const copyLabel = translateOr(labels, 'copy', '复制')
      const copiedLabel = translateOr(labels, 'copied', '已复制')
      let i = 0
      let key = 0
      const nextKey = () => `md-${key++}`

      while (i < lines.length) {
        const line = lines[i]

        if (/^\s*$/.test(line)) {
          i++
          continue
        }

        const fence = line.match(/^\s*```([^\s`]*)\s*$/)
        if (fence) {
          const body = []
          i++
          const bodyStart = i
          while (i < lines.length && !/^\s*```\s*$/.test(lines[i])) body.push(lines[i++])
          i++
          const srcStart = offsetsOk ? lineStarts[Math.min(bodyStart, lines.length - 1)] : undefined
          if (options && options.bareCode) {
            // The ProseMirror document has its own code-block node, so the
            // fence is emitted in the plain `pre[data-lang]` shape it parses.
            blocks.push(
              h(
                'pre',
                { key: nextKey(), 'data-src': srcStart, 'data-lang': fence[1] || '' },
                h('code', null, body.join('\n')),
              ),
            )
            continue
          }
          if (options && options.plainCode) {
            // The editable document is written out as an HTML string, and a
            // string cannot hold a component: the card becomes plain markup.
            blocks.push(
              h(
                'div',
                { key: nextKey(), className: 'dsp-code' },
                h(
                  'div',
                  { className: 'dsp-code-bar' },
                  h('span', { className: 'dsp-code-lang' }, fence[1] || 'text'),
                  h('button', { key: 'copy', type: 'button', className: 'dsp-code-copy' }, copyLabel),
                ),
                h('pre', { key: 'pre', className: 'dsp-code-pre', 'data-src': srcStart }, h('code', null, body.join('\n'))),
              ),
            )
            continue
          }
          blocks.push(
            h(CodeBlock, {
              key: nextKey(),
              lang: fence[1] || '',
              text: body.join('\n'),
              copyLabel,
              copiedLabel,
              srcStart,
            }),
          )
          continue
        }

        const image = line.match(/^\s*!\[([^\]]*)\]\(([^)\s]+)\)\s*$/)
        if (image) {
          blocks.push(
            h('figure', { key: nextKey(), className: 'dsp-md-figure', 'data-src': srcOf(i, 0) }, [
              h('img', { key: 'img', src: image[2], alt: image[1], className: 'dsp-md-image' }),
              image[1] ? h('figcaption', { key: 'cap', className: 'dsp-md-caption' }, image[1]) : null,
            ]),
          )
          i++
          continue
        }

        const heading = line.match(/^(#{1,6})\s+(?:(?:#{1,6})\s+)*(.*)$/)
        if (heading) {
          const level = Math.min(heading[1].length, 6)
          const id = nextKey()
          blocks.push(
            h(
              `h${level}`,
              { key: id, className: `dsp-md-h dsp-md-h${level}`, 'data-src': srcOf(i, line.length - heading[2].length) },
              renderInline(heading[2], id, srcOf(i, line.length - heading[2].length)),
            ),
          )
          i++
          continue
        }

        if (/^\s*([-*_])\s*\1\s*\1[\s\-*_]*$/.test(line)) {
          blocks.push(h('hr', { key: nextKey(), className: 'dsp-md-hr' }))
          i++
          continue
        }

        if (/^\s*>/.test(line)) {
          const body = []
          const quoteStart = i
          while (i < lines.length && /^\s*>/.test(lines[i])) {
            body.push(lines[i].replace(/^\s*>\s?/, ''))
            i++
          }
          const id = nextKey()
          // The quote's lines are joined with a space, so the offsets inside it
          // would no longer line up; the block as a whole carries its position.
          blocks.push(
            h(
              'blockquote',
              { key: id, className: 'dsp-md-quote', 'data-src': srcOf(quoteStart, lines[quoteStart].length - body[0].length) },
              renderInline(body.join(' '), id),
            ),
          )
          continue
        }

        if (/^\s*([-*+]|\d+[.)])\s+/.test(line)) {
          const ordered = /^\s*\d+[.)]\s+/.test(line)
          const start = ordered ? Number(line.match(/^\s*(\d+)/)[1]) : undefined
          const items = []
          while (i < lines.length && (ordered ? /^\s*\d+[.)]\s+/ : /^\s*[-*+]\s+/).test(lines[i])) {
            const raw = lines[i]
            const id = nextKey()
            const indent = Math.min(3, Math.floor((raw.match(/^\s*/)[0].length || 0) / 2))
            let text = raw.replace(/^\s*([-*+]|\d+[.)])\s+/, '')
            const task = text.match(/^\[([ xX])\]\s+/)
            const textStart = raw.length - text.length
            if (task) {
              const done = task[1].toLowerCase() === 'x'
              text = text.replace(/^\[([ xX])\]\s+/, '')
              const afterTask = raw.length - text.length
              items.push(
                h(
                  'li',
                  { key: id, className: `dsp-md-li dsp-md-task${indent ? ` dsp-md-indent-${indent}` : ''}`, 'data-src': srcOf(i, afterTask) },
                  // In the editing kernel the box belongs to the kernel (it is
                  // clickable there), so the Markdown layer only passes it an
                  // empty box: a "✓" would become document text.
                  h(
                    'span',
                    { className: `dsp-md-check${done ? ' dsp-md-check-on' : ''}` },
                    options && options.kernelTask ? '' : done ? '✓' : '',
                  ),
                  h('span', { 'data-src': srcOf(i, afterTask) }, renderInline(text, id, srcOf(i, afterTask))),
                ),
              )
              i++
              continue
            }
            items.push(
              h(
                'li',
                { key: id, className: `dsp-md-li${indent ? ` dsp-md-indent-${indent}` : ''}`, 'data-src': srcOf(i, textStart) },
                renderInline(text, id, srcOf(i, textStart)),
              ),
            )
            i++
          }
          blocks.push(h(ordered ? 'ol' : 'ul', { key: nextKey(), className: 'dsp-md-list', start }, items))
          continue
        }

        if (/^\s*\|/.test(line) && i + 1 < lines.length && isTableSeparator(lines[i + 1])) {
          const headIndex = i
          const head = tableCells(lines[i])
          i += 2
          const rows = []
          while (i < lines.length && /^\s*\|/.test(lines[i])) {
            rows.push(tableCells(lines[i]))
            i++
          }
          const id = nextKey()
          blocks.push(
            h(
              'div',
              { key: id, className: 'dsp-md-tablewrap' },
              h(
                'table',
                { className: 'dsp-md-table' },
                h(
                  'thead',
                  null,
                  h(
                    'tr',
                    null,
                    head.map((cell, c) =>
                      h(
                        'th',
                        { key: `${id}-h${c}`, 'data-src': srcOf(headIndex, cell.start) },
                        renderInline(cell.text, `${id}-h${c}`, srcOf(headIndex, cell.start)),
                      ),
                    ),
                  ),
                ),
                h(
                  'tbody',
                  null,
                  rows.map((row, r) =>
                    h(
                      'tr',
                      { key: `${id}-r${r}` },
                      head.map((_, c) => {
                        const cell = row[c] || { text: '', start: 0 }
                        const offset = srcOf(headIndex + 2 + r, cell.start)
                        return h(
                          'td',
                          { key: `${id}-r${r}c${c}`, 'data-src': offset },
                          renderInline(cell.text, `${id}-r${r}c${c}`, offset),
                        )
                      }),
                    ),
                  ),
                ),
              ),
            ),
          )
          continue
        }

        const paragraphStart = i
        const paragraph = []
        while (
          i < lines.length &&
          !/^\s*$/.test(lines[i]) &&
          !/^\s*(```|#{1,6}\s|>|\||!\[)/.test(lines[i]) &&
          !/^\s*([-*+]|\d+[.)])\s+/.test(lines[i])
        ) {
          paragraph.push(lines[i])
          i++
        }
        if (!paragraph.length) {
          paragraph.push(lines[i++])
        }
        const id = nextKey()
        blocks.push(
          h('p', { key: id, className: 'dsp-md-p', 'data-src': srcOf(paragraphStart, 0) }, renderInline(paragraph.join('\n'), id, srcOf(paragraphStart, 0))),
        )
      }

      // A fragment that spans inline markup (`code`, **bold**) is split across
      // several runs, so no single run contains it and the run-level pass above
      // leaves it unmarked. Mark the whole block then: coarser, but it is the
      // text the reader can see and click.
      const pendingFrame = RENDER_PENDING
      if (pendingFrame && pendingFrame.patterns.length) {
        const wholeUsed = new Set()
        const inlineIds = (node, out = new Set()) => {
          if (!node || typeof node !== 'object') return out
          if (node.props && node.props['data-pending-id']) out.add(node.props['data-pending-id'])
          nodeChildren(node).forEach((child) => inlineIds(child, out))
          return out
        }
        const findHit = (text) => {
          if (!text) return null
          for (const item of pendingFrame.patterns) {
            const id = item.entry.id
            if (!wholeUsed.has(id) && (item.pattern.test(text) || (item.plain && item.plain.test(text)))) {
              wholeUsed.add(id)
              return item.entry
            }
            if (!item.parts || !item.parts.length) continue
            if (item.parts.some((part) => part.test(text))) return item.entry
          }
          return null
        }
        const decorate = (node) => {
          if (!node || typeof node !== 'object') return node
          const type = typeof node.type === 'string' ? node.type : ''
          if (type === 'ul' || type === 'ol') {
            const props = { ...(node.props || {}) }
            delete props.children
            return h(node.type, props, ...nodeChildren(node).map(decorate))
          }
          if (!type) return node
          const hit = findHit(plainTextOf(node))
          if (!hit) return node
          // The run-level pass may already have marked part of this block.
          if (inlineIds(node).has(hit.id)) return node
          const className = ((node.props && node.props.className) || '') + ' dsp-pending dsp-pending-block'
          return withProps(node, { className, 'data-pending-id': hit.id, title: pendingFrame.hint || '' })
        }
        for (let index = 0; index < blocks.length; index += 1) blocks[index] = decorate(blocks[index])
      }

      // A deletion of a whole line has no run to sit in, so its ghost becomes a
      // block of its own, placed where the line used to be.
      const ghostFrame = RENDER_GHOSTS
      if (ghostFrame && ghostFrame.items.length) {
        const firstSrc = (node, depth = 0) => {
          if (!node || typeof node !== 'object' || depth > 8) return null
          const own = node.props ? node.props['data-src'] : undefined
          if (typeof own === 'number') return own
          for (const child of nodeChildren(node)) {
            const found = firstSrc(child, depth + 1)
            if (found !== null) return found
          }
          return null
        }
        ghostFrame.items.forEach((ghost) => {
          if (ghostFrame.used.has(ghost.id)) return
          let at = blocks.length
          for (let index = 0; index < blocks.length; index += 1) {
            const src = firstSrc(blocks[index])
            if (src !== null && src > ghost.start) {
              at = index
              break
            }
          }
          const key = 'ghost-' + ghost.id
          blocks.splice(at, 0, h('div', { key, className: 'dsp-ghost-block' }, ghostNode(ghost, key + '-d')))
        })
      }
      RENDER_GHOSTS = previousGhosts
      RENDER_PENDING = null
      return blocks
    }

    /* ------------------------------------------------------------------ */
    /* small formatting helpers                                            */
    /* ------------------------------------------------------------------ */

    function timeAgo(value, t) {
      const seconds = Math.max(0, Math.round((Date.now() - value) / 1000))
      if (seconds < 60) return t('justNow')
      if (seconds < 3600) return t('minutesAgo', Math.round(seconds / 60))
      if (seconds < 86400) return t('hoursAgo', Math.round(seconds / 3600))
      return t('daysAgo', Math.round(seconds / 86400))
    }

    /* ------------------------------------------------------------------ */
    /* icons                                                               */
    /* ------------------------------------------------------------------ */

    function svg(children, props) {
      const { size, ...rest } = props || {}
      return h('svg', {
        viewBox: '0 0 24 24',
        width: size || 16,
        height: size || 16,
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 1.7,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
        'aria-hidden': 'true',
        ...rest,
        children,
      })
    }

    const DocIcon = (props) =>
      svg([h('path', { key: 'a', d: 'M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z' }), h('path', { key: 'b', d: 'M14 3v5h5' }), h('path', { key: 'c', d: 'M9 13h6M9 17h4' })], props)

    const PenIcon = (props) =>
      svg([h('path', { key: 'a', d: 'M12 20h9' }), h('path', { key: 'b', d: 'M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z' })], props)

    const EyeIcon = (props) =>
      svg([h('path', { key: 'a', d: 'M2 12s3.5-6.5 10-6.5S22 12 22 12s-3.5 6.5-10 6.5S2 12 2 12z' }), h('circle', { key: 'b', cx: 12, cy: 12, r: 2.6 })], props)

    const SparkIcon = (props) =>
      svg([h('path', { key: 'a', d: 'M12 3l1.8 4.9L18.7 9.7l-4.9 1.8L12 16.4l-1.8-4.9L5.3 9.7l4.9-1.8z' }), h('path', { key: 'b', d: 'M18 15l.9 2.4 2.4.9-2.4.9L18 21.6l-.9-2.4-2.4-.9 2.4-.9z' })], props)

    const RefreshIcon = (props) =>
      svg([h('path', { key: 'a', d: 'M20 11a8 8 0 1 0-2.3 5.7' }), h('path', { key: 'b', d: 'M20 5v6h-6' })], props)

    const CheckIcon = (props) =>
      svg([h('path', { key: 'a', d: 'M4 12.5l5 5L20 6.5' })], props)

    const XIcon = (props) =>
      svg([h('path', { key: 'a', d: 'M6 6l12 12M18 6L6 18' })], props)

    const BackIcon = (props) =>
      svg([h('path', { key: 'a', d: 'M15 5l-7 7 7 7' })], props)

    const CaretIcon = (props) =>
      svg([h('path', { key: 'a', d: 'M6.5 9.75L12 15l5.5-5.25' })], props)

    const SendIcon = (props) =>
      svg([h('path', { key: 'a', d: 'M12 19.5V5.2' }), h('path', { key: 'b', d: 'M5.8 11.2L12 5l6.2 6.2' })], props)

    /* ------------------------------------------------------------------ */
    /* display zoom                                                        */
    /* ------------------------------------------------------------------ */

    const ZOOM_KEY = 'dsh-doc-pane:zoom'
    const ZOOM_MIN = 0.8
    const ZOOM_MAX = 2
    const ZOOM_STEP = 0.1

    function clampZoom(value) {
      const number = typeof value === 'number' ? value : Number(value)
      if (!Number.isFinite(number)) return 1
      return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(number * 100) / 100))
    }

    // On a wide screen (and a 100% display scale) the default 14px document text
    // reads as small, so the first run starts slightly enlarged. Any explicit
    // choice in the header — or a reset to 100% — wins forever after.
    function readZoom() {
      try {
        const stored = window.localStorage.getItem(ZOOM_KEY)
        if (stored !== null) return clampZoom(stored)
      } catch {
        // storage may be unavailable; fall through to the default
      }
      try {
        if (window.innerWidth >= 1600 && (window.devicePixelRatio || 1) <= 1) return 1.15
      } catch {
        // ignore
      }
      return 1
    }

    function storeZoom(value) {
      try {
        window.localStorage.setItem(ZOOM_KEY, String(value))
      } catch {
        // ignore: zoom stays for this mount only
      }
    }

    // The chat area starts tall enough to read, and can be dragged taller; the
    // height in pixels is remembered across Sessions.
    const CHAT_KEY = 'dsh-doc-pane:chat'

    function readChatHeight() {
      try {
        const stored = Number(window.localStorage.getItem(CHAT_KEY))
        if (Number.isFinite(stored) && stored >= 140) return Math.round(stored)
      } catch {
        // ignore
      }
      return 0
    }

    function storeChatHeight(value) {
      try {
        window.localStorage.setItem(CHAT_KEY, String(Math.round(value)))
      } catch {
        // ignore
      }
    }

    /* ------------------------------------------------------------------ */
    /* remembered "pending review" marks                                  */
    /* ------------------------------------------------------------------ */

    /**
     * The pending marks are a reading state, not a copy of the document: they
     * are kept as the changed fragments themselves plus the file's mtime, and
     * only restored when that mtime still matches. A stale entry is therefore
     * impossible — either the file is unchanged (same marks) or it changed and
     * the next load recomputes the marks from scratch.
     */
    const PENDING_KEY = 'dsh-doc-pane:pending:'

    function readPending(filePath, mtime) {
      if (!filePath || !mtime) return null
      try {
        const raw = window.localStorage.getItem(PENDING_KEY + filePath)
        if (!raw) return null
        const data = JSON.parse(raw)
        // v2 stores the text each mark replaced, so every mark can be undone.
        if (!data || data.v !== 2 || data.mtime !== mtime || !Array.isArray(data.items)) return null
        const items = data.items
          .filter(
            (item) =>
              item &&
              typeof item.text === 'string' &&
              item.text.length <= 600 &&
              (item.text || item.deleted === true) &&
              typeof item.before === 'string',
          )
          .slice(-60)
          .map((item, index) => {
            const restored = { id: String(item.id || `r-${index}`), text: item.text, before: item.before }
            if (typeof item.display === 'string' && item.display) restored.display = item.display
            if (typeof item.anchor === 'string' && item.anchor) restored.anchor = item.anchor
            if (item.deleted === true) restored.deleted = true
            if (item.block === true) restored.block = true
            if (typeof item.start === 'number' && typeof item.end === 'number') {
              restored.start = item.start
              restored.end = item.end
            }
            return restored
          })
        return items.length ? items : null
      } catch {
        return null
      }
    }

    function storePending(filePath, mtime, items) {
      if (!filePath) return
      const key = PENDING_KEY + filePath
      try {
        if (!mtime || !items || !items.length) {
          window.localStorage.removeItem(key)
          return
        }
        window.localStorage.setItem(
          key,
          JSON.stringify({
            v: 2,
            mtime,
            items: items
              .slice(-60)
              .filter((item) => item.text.length <= 600 && (item.text || item.deleted === true))
              .map((item) => ({
                id: item.id,
                text: item.text,
                before: typeof item.before === 'string' ? item.before : '',
                ...(typeof item.display === 'string' && item.display ? { display: item.display } : {}),
                ...(typeof item.anchor === 'string' && item.anchor ? { anchor: item.anchor } : {}),
                ...(item.deleted === true ? { deleted: true } : {}),
                ...(item.block === true ? { block: true } : {}),
                ...(typeof item.start === 'number' && typeof item.end === 'number'
                  ? { start: item.start, end: item.end }
                  : {}),
              })),
          }),
        )
      } catch {
        // ignore: a full quota must never break the panel
      }
    }

    /* ------------------------------------------------------------------ */
    /* editable document: markdown <-> dom                                 */
    /* ------------------------------------------------------------------ */

    const VOID_TAGS = { img: 1, br: 1, hr: 1, input: 1, source: 1 }

    function escapeHtml(text) {
      return String(text === undefined || text === null ? '' : text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
    }

    function escapeAttr(text) {
      return escapeHtml(text).replace(/"/g, '&quot;')
    }

    /**
     * The preview is React, but the editable document is a plain HTML string:
     * React re-renders whenever the panel state moves, and re-rendering under a
     * caret throws the caret away. Writing the tree once per outside change and
     * serialising it back on input keeps the caret where the user put it.
     */
    function reactToHtml(node) {
      if (node === null || node === undefined || node === false || node === true) return ''
      if (typeof node === 'string' || typeof node === 'number') return escapeHtml(node)
      if (Array.isArray(node)) return node.map(reactToHtml).join('')
      if (typeof node !== 'object') return ''
      const type = node.type
      if (typeof type !== 'string') return ''
      const props = node.props || {}
      const classes = String(props.className || '')
      const attrs = []
      Object.keys(props).forEach((name) => {
        if (name === 'children' || name === 'key' || name === 'ref') return
        const value = props[name]
        if (value === undefined || value === null || value === false) return
        if (name === 'className') return
        if (name === 'href' || name === 'src' || name === 'alt' || name === 'title' || (type === 'ol' && name === 'start')) {
          attrs.push(name + '="' + escapeAttr(value) + '"')
          return
        }
        if (name === 'data-src' || name.indexOf('data-') === 0 || name.indexOf('aria-') === 0) {
          attrs.push(name + '="' + escapeAttr(value) + '"')
        }
      })
      if (classes) attrs.unshift('class="' + escapeAttr(classes) + '"')
      // Chrome inside the document (a code card's bar, a deletion ghost) is
      // not part of the text being edited, so the caret never lands in it.
      if (classes.indexOf('dsp-code-bar') >= 0 || classes.indexOf('dsp-ghost') >= 0) {
        attrs.push('contenteditable="false"')
      }
      const head = '<' + type + (attrs.length ? ' ' + attrs.join(' ') : '')
      if (VOID_TAGS[type]) return head + '>'
      const children = props.children !== undefined ? props.children : node.children
      const inner = Array.isArray(children)
        ? children.map(reactToHtml).join('')
        : children === undefined || children === null
          ? ''
          : reactToHtml(children)
      return head + '>' + inner + '</' + type + '>'
    }

    /** The rendered document as an HTML string, ready for contenteditable. */
    function markdownToHtml(source, labels, pending, options) {
      const blocks = renderMarkdown(source, labels, pending, { plainCode: true, ...(options || {}) })
      return blocks.map(reactToHtml).join('\n')
    }

    /**
     * Pasted HTML with the source page's own styling taken out: scripts, styles
     * and frames go, every attribute except a link target, an image source and
     * a cell span is dropped, so no foreign font or colour reaches the document.
     */
    function cleanPastedHtml(html) {
      if (typeof document === 'undefined') return ''
      const box = document.createElement('div')
      box.innerHTML = String(html || '')
      const drop = box.querySelectorAll('script,style,meta,link,noscript,iframe,object,embed,base')
      for (let i = 0; i < drop.length; i += 1) drop[i].remove()
      const all = box.querySelectorAll('*')
      for (let i = 0; i < all.length; i += 1) {
        const el = all[i]
        const tag = el.tagName.toLowerCase()
        const keep = {}
        if (tag === 'a' && el.getAttribute('href')) keep.href = el.getAttribute('href')
        if (tag === 'img') {
          const src = el.getAttribute('src') || ''
          if (src) keep.src = src
          const alt = el.getAttribute('alt')
          if (alt) keep.alt = alt
        }
        if (tag === 'td' || tag === 'th') {
          const colspan = el.getAttribute('colspan')
          const rowspan = el.getAttribute('rowspan')
          if (colspan) keep.colspan = colspan
          if (rowspan) keep.rowspan = rowspan
        }
        const names = el.getAttributeNames ? el.getAttributeNames() : []
        for (let n = 0; n < names.length; n += 1) el.removeAttribute(names[n])
        Object.keys(keep).forEach((name) => el.setAttribute(name, keep[name]))
      }
      return box.innerHTML
    }

    /** Markdown the paste handler should treat as blocks rather than text. */
    function looksLikeMarkdown(text) {
      return /(^|\n)\s*(#{1,6}\s|[-*+]\s|\d+[.)]\s|>\s|```|\||- \[[ xX]\]\s)|\n\s*\n/.test(String(text || ''))
    }

    /**
     * The "/" menu's blocks, each with the pinyin a Chinese keyboard types: the
     * menu filters on the label, the full pinyin and the initials, so "biaoti",
     * "bt", "标题" and "ge" all find something.
     */
    const SLASH_BLOCKS = [
      { kind: 'h1', key: 'slashH1', pinyin: 'biaoti biaoti1 bt' },
      { kind: 'h2', key: 'slashH2', pinyin: 'biaoti biaoti2 bt' },
      { kind: 'h3', key: 'slashH3', pinyin: 'biaoti biaoti3 bt' },
      { kind: 'bullet', key: 'slashBullet', pinyin: 'wuxuliebiao wuxu wxl wxlb' },
      { kind: 'ordered', key: 'slashOrdered', pinyin: 'youxuliebiao youxu yxl yxlb' },
      { kind: 'todo', key: 'slashTodo', pinyin: 'daiban db' },
      { kind: 'quote', key: 'slashQuote', pinyin: 'yinyong yy' },
      { kind: 'code', key: 'slashCode', pinyin: 'daimakuai daima dmk dm' },
      { kind: 'table', key: 'slashTable', pinyin: 'biaoge bg' },
      { kind: 'divider', key: 'slashDivider', pinyin: 'fengexian fenge fgx fg' },
      { kind: 'image', key: 'slashImage', pinyin: 'tupian tp' },
    ]

    function filterSlashBlocks(t, query) {
      const needle = String(query || '').trim().toLowerCase()
      if (!needle) return SLASH_BLOCKS
      return SLASH_BLOCKS.filter((item) => {
        const label = String(t(item.key) || '').toLowerCase()
        if (label.indexOf(needle) >= 0) return true
        return item.pinyin.split(' ').some((word) => word.indexOf(needle) >= 0)
      })
    }

    /**
     * The editing kernel ships as one prebuilt script (vendor/editor.js) served
     * by the host half: a single `require`-less bundle with no build step on the
     * client, loaded once per page.
     */
    let editorLibPromise = null
    function loadEditorLib() {
      if (editorLibPromise) return editorLibPromise
      editorLibPromise = new Promise((resolve) => {
        if (typeof window !== 'undefined' && window.DshDocEditor) {
          resolve(window.DshDocEditor)
          return
        }
        if (typeof document === 'undefined') {
          resolve(null)
          return
        }
        const url = new URL(`${API}/vendor/editor.js`.replace(/^\/+/, ''), document.baseURI)
        const script = document.createElement('script')
        script.src = url.pathname + url.search
        script.async = true
        script.onload = () => resolve(window.DshDocEditor || null)
        script.onerror = () => {
          console.error('dsh-doc-pane: 编辑器脚本加载失败，改用内置编辑')
          resolve(null)
        }
        document.head.appendChild(script)
      })
      return editorLibPromise
    }

    /** One node's inline Markdown, markers included. */
    function inlineMarkdown(node) {
      if (!node) return ''
      if (node.nodeType === 3) return node.nodeValue || ''
      if (node.nodeType !== 1) return ''
      const element = node
      if (element.classList && element.classList.contains('dsp-ghost')) return ''
      const tag = element.tagName.toLowerCase()
      if (tag === 'br') return '\n'
      const inner = Array.prototype.map.call(element.childNodes, inlineMarkdown).join('')
      if (tag === 'strong' || tag === 'b') return inner ? '**' + inner + '**' : ''
      if (tag === 'em' || tag === 'i') return inner ? '*' + inner + '*' : ''
      if (tag === 'del') return inner ? '~~' + inner + '~~' : ''
      if (tag === 'code') {
        if (inner.indexOf('\n') >= 0) return inner
        if (!inner) return ''
        const fence = inner.indexOf('`') >= 0 ? '``' : '`'
        return fence + inner + fence
      }
      if (tag === 'a') {
        const href = element.getAttribute('href') || ''
        return inner ? '[' + inner + '](' + href + ')' : ''
      }
      if (tag === 'img') {
        return '![' + (element.getAttribute('alt') || '') + '](' + (element.getAttribute('src') || '') + ')'
      }
      return inner
    }

    function listMarkdown(list, depth) {
      const ordered = list.tagName.toLowerCase() === 'ol'
      const pad = '  '.repeat(depth)
      const lines = []
      let counter = ordered ? list.start - 1 : 0
      Array.prototype.forEach.call(list.children, (item) => {
        if (item.tagName.toLowerCase() !== 'li') return
        counter += 1
        const clone = item.cloneNode(true)
        const check = clone.querySelector('.dsp-md-check')
        const task = check ? (check.classList.contains('dsp-md-check-on') ? '[x] ' : '[ ] ') : ''
        if (check) check.remove()
        const nested = []
        Array.prototype.forEach.call(clone.children, (child) => {
          const tag = child.tagName.toLowerCase()
          if (tag === 'ul' || tag === 'ol') nested.push(child)
        })
        nested.forEach((child) => clone.removeChild(child))
        const text = inlineMarkdown(clone).replace(/\s+$/, '')
        lines.push(pad + (ordered ? counter + '. ' : '- ') + task + text)
        nested.forEach((child) => lines.push(listMarkdown(child, depth + 1)))
      })
      return lines.join('\n')
    }

    function tableMarkdown(table) {
      const rows = []
      Array.prototype.forEach.call(table.querySelectorAll('tr'), (row) => {
        const cells = []
        Array.prototype.forEach.call(row.children, (cell) => {
          cells.push(inlineMarkdown(cell).replace(/\s*\n\s*/g, ' ').trim().replace(/[\\|]/g, '\\$&'))
        })
        if (cells.length) rows.push(cells)
      })
      if (!rows.length) return ''
      const width = rows[0].length
      const line = (cells) => {
        const padded = cells.slice(0, width)
        while (padded.length < width) padded.push('')
        return '| ' + padded.join(' | ') + ' |'
      }
      const out = [line(rows[0]), '| ' + new Array(width).fill('---').join(' | ') + ' |']
      rows.slice(1).forEach((cells) => out.push(line(cells)))
      return out.join('\n')
    }

    /** The whole editable document back as Markdown. */
    function serializeMarkdown(root) {
      if (!root) return ''
      const out = []
      Array.prototype.forEach.call(root.childNodes, (node) => {
        if (node.nodeType === 3) {
          const text = (node.nodeValue || '').trim()
          if (text) out.push(text)
          return
        }
        if (node.nodeType !== 1) return
        const element = node
        const tag = element.tagName.toLowerCase()
        const classes = element.classList
        if (classes.contains('dsp-ghost-block')) return
        if (tag === 'pre') {
          const lang = (element.getAttribute('data-lang') || '').trim()
          const codeNode = element.querySelector('code')
          const text = ((codeNode || element).textContent || '').replace(/\n+$/, '')
          out.push('```' + lang + '\n' + text + '\n```')
          return
        }
        if (classes.contains('dsp-code')) {
          const langNode = element.querySelector('.dsp-code-lang')
          const lang = langNode && langNode.textContent ? langNode.textContent.trim() : ''
          const code = element.querySelector('pre code') || element.querySelector('pre')
          const text = code ? code.textContent.replace(/\n+$/, '') : ''
          out.push('```' + (lang && lang !== 'text' ? lang : '') + '\n' + text + '\n```')
          return
        }
        const table = tag === 'table' ? element : element.querySelector && element.querySelector('table')
        if (table) {
          const body = tableMarkdown(table)
          if (body) out.push(body)
          return
        }
        if (/^h[1-6]$/.test(tag)) {
          out.push('#'.repeat(Number(tag.charAt(1))) + ' ' + inlineMarkdown(element).trim())
          return
        }
        if (tag === 'ul' || tag === 'ol') {
          const body = listMarkdown(element, 0)
          if (body) out.push(body)
          return
        }
        if (tag === 'blockquote') {
          const text = inlineMarkdown(element).trim()
          if (text) out.push(text.split('\n').map((line) => '> ' + line).join('\n'))
          return
        }
        if (tag === 'hr') {
          out.push('---')
          return
        }
        if (tag === 'figure' || tag === 'img') {
          const image = tag === 'img' ? element : element.querySelector('img')
          if (image) {
            out.push('![' + (image.getAttribute('alt') || '') + '](' + (image.getAttribute('src') || '') + ')')
          }
          return
        }
        const text = inlineMarkdown(element).replace(/\n+$/, '')
        if (text.trim()) out.push(text)
      })
      const body = out.filter((chunk) => chunk !== '').join('\n\n')
      return body ? body + '\n' : ''
    }

    /* --- editing helpers ---------------------------------------------- */

    /** The block (a direct child of the document host) holding a node. */
    function docBlockOf(host, node) {
      if (!host || !node) return null
      let current = node
      let guard = 0
      while (current && current !== host && current.parentNode !== host && guard < 40) {
        current = current.parentNode
        guard += 1
      }
      if (!current || current === host || current.parentNode !== host) return null
      return current.nodeType === 1 ? current : null
    }

    function textOffsetOf(element, node, offset) {
      try {
        const range = document.createRange()
        range.selectNodeContents(element)
        range.setEnd(node, offset)
        return range.toString().length
      } catch {
        return -1
      }
    }

    function pointAtOffset(element, target) {
      let rest = Math.max(0, target)
      const walker = document.createTreeWalker(element, 4, null)
      let last = null
      let node = walker.nextNode()
      while (node) {
        const length = node.nodeValue.length
        if (rest <= length) return { node, offset: rest }
        rest -= length
        last = node
        node = walker.nextNode()
      }
      if (last) return { node: last, offset: last.nodeValue.length }
      return { node: element, offset: 0 }
    }

    function selectOffsets(element, start, end) {
      const first = pointAtOffset(element, start)
      const second = pointAtOffset(element, end)
      const range = document.createRange()
      try {
        range.setStart(first.node, first.offset)
        range.setEnd(second.node, second.offset)
      } catch {
        return null
      }
      const selection = window.getSelection()
      if (!selection) return null
      selection.removeAllRanges()
      selection.addRange(range)
      return range
    }

    function placeCaret(element, offset) {
      selectOffsets(element, offset, offset)
    }

    function elementOf(tag, className, text) {
      const node = document.createElement(tag)
      if (className) node.className = className
      if (text !== undefined) node.textContent = text
      return node
    }

    const TYPING_MARKS = [
      { re: /\[([^\]\n]+)\]\(([^\s)]+)\)$/, tag: 'a' },
      { re: /\*\*([^*\n]+)\*\*$/, tag: 'strong' },
      { re: /~~([^~\n]+)~~$/, tag: 'del' },
      { re: /`([^`\n]+)`$/, tag: 'code' },
      { re: /\*([^*\n]+)\*$/, tag: 'em' },
    ]

    /**
     * Instant rendering for inline Markdown: the moment a closing marker is
     * typed (`**粗**`, `` `code` ``, `[t](u)`) the run becomes the real element,
     * so the document never shows raw asterisks while being written.
     */
    function convertTypingMarks(host) {
      const selection = window.getSelection()
      if (!selection || !selection.isCollapsed || !selection.anchorNode) return false
      const block = docBlockOf(host, selection.anchorNode)
      if (!block || block.classList.contains('dsp-code')) return false
      const caret = textOffsetOf(block, selection.anchorNode, selection.anchorOffset)
      if (caret < 2) return false
      const text = block.textContent || ''
      for (let index = 0; index < TYPING_MARKS.length; index += 1) {
        const rule = TYPING_MARKS[index]
        const match = rule.re.exec(text.slice(0, caret))
        if (!match || match.index + match[0].length !== caret) continue
        const element = document.createElement(rule.tag)
        if (rule.tag === 'a') {
          element.setAttribute('href', match[2])
          element.setAttribute('target', '_blank')
          element.setAttribute('rel', 'noreferrer')
          element.textContent = match[1]
        } else {
          element.textContent = match[1]
        }
        const start = caret - match[0].length
        const range = selectOffsets(block, start, caret)
        if (!range) return false
        range.deleteContents()
        range.insertNode(element)
        placeCaret(block, start + (match[1] || '').length)
        return true
      }
      return false
    }

    /**
     * Block shortcuts, the way a document editor behaves: `##` then space is a
     * heading, `-` a bullet, `1.` a numbered item, `>` a quote, ``` a code
     * card, `---` a divider.
     */
    function convertBlockShortcut(host, key) {
      const selection = window.getSelection()
      if (!selection || !selection.isCollapsed || !selection.anchorNode) return false
      const block = docBlockOf(host, selection.anchorNode)
      if (!block) return false
      const tag = block.tagName.toLowerCase()
      if (tag !== 'p' && !/^h[1-6]$/.test(tag)) return false
      const caret = textOffsetOf(block, selection.anchorNode, selection.anchorOffset)
      const head = (block.textContent || '').slice(0, caret)
      const tail = (block.textContent || '').slice(caret)
      if (tail.trim() || !head.trim()) return false
      const marker = head.trim()
      const replace = (node) => {
        block.parentNode.replaceChild(node, block)
        placeCaret(node, 0)
        return true
      }
      if (key === 'Enter' && /^-{3,}$/.test(marker)) {
        return replace(elementOf('hr', 'dsp-md-hr'))
      }
      if (/^```(\w*)$/.test(marker)) {
        const lang = /^```(\w*)$/.exec(marker)[1]
        const wrap = elementOf('div', 'dsp-code')
        const bar = elementOf('div', 'dsp-code-bar')
        bar.setAttribute('contenteditable', 'false')
        bar.appendChild(elementOf('span', 'dsp-code-lang', lang || 'text'))
        const pre = elementOf('pre', 'dsp-code-pre')
        const code = elementOf('code')
        code.appendChild(document.createTextNode('\n'))
        pre.appendChild(code)
        wrap.appendChild(bar)
        wrap.appendChild(pre)
        block.parentNode.replaceChild(wrap, block)
        placeCaret(code, 0)
        return true
      }
      if (key !== ' ') return false
      const heading = /^(#{1,6})$/.exec(marker)
      if (heading) {
        const level = heading[1].length
        return replace(elementOf('h' + level, 'dsp-md-h dsp-md-h' + level))
      }
      if (/^[-*+]$/.test(marker)) {
        const list = elementOf('ul', 'dsp-md-list')
        const item = elementOf('li', 'dsp-md-li')
        list.appendChild(item)
        return replace(list) && (placeCaret(item, 0), true)
      }
      if (/^\d+[.)]$/.test(marker)) {
        const list = elementOf('ol', 'dsp-md-list')
        const item = elementOf('li', 'dsp-md-li')
        list.appendChild(item)
        block.parentNode.replaceChild(list, block)
        placeCaret(item, 0)
        return true
      }
      if (/^>$/.test(marker)) {
        return replace(elementOf('blockquote', 'dsp-md-quote'))
      }
      return false
    }

    function insertPlainText(text) {
      const selection = window.getSelection()
      if (!selection || !selection.rangeCount) return
      const range = selection.getRangeAt(0)
      range.deleteContents()
      const node = document.createTextNode(text)
      range.insertNode(node)
      const after = document.createRange()
      after.setStart(node, text.length)
      after.collapse(true)
      selection.removeAllRanges()
      selection.addRange(after)
    }

    /**
     * Enter, Backspace and Tab inside the document. Everything stays structural
     * (blocks), so the serialiser keeps producing clean Markdown afterwards.
     */
    function editDocumentKey(event, host) {
      if (event.isComposing || event.keyCode === 229) return false
      const selection = window.getSelection()
      if (!selection || !selection.rangeCount || !selection.anchorNode) return false
      const block = docBlockOf(host, selection.anchorNode)
      if (!block) return false
      const tag = block.tagName.toLowerCase()

      if (event.key === 'Tab') {
        if (block.classList.contains('dsp-code')) {
          event.preventDefault()
          insertPlainText('  ')
          return true
        }
        if (tag === 'li') {
          event.preventDefault()
          return true
        }
        return false
      }

      if (event.key === 'Backspace' && selection.isCollapsed) {
        const caret = textOffsetOf(block, selection.anchorNode, selection.anchorOffset)
        if (caret !== 0) return false
        if (tag === 'li') {
          event.preventDefault()
          const list = block.parentNode
          const paragraph = elementOf('p', 'dsp-md-p')
          while (block.firstChild) paragraph.appendChild(block.firstChild)
          list.parentNode.insertBefore(paragraph, list)
          block.parentNode.removeChild(block)
          if (!list.children.length) list.parentNode.removeChild(list)
          placeCaret(paragraph, 0)
          return true
        }
        const previous = block.previousElementSibling
        if (!previous) return false
        if (previous.classList.contains('dsp-code') || block.classList.contains('dsp-code')) return false
        const previousTag = previous.tagName.toLowerCase()
        if (previousTag !== 'p' && !/^h[1-6]$/.test(previousTag) && previousTag !== 'blockquote') return false
        event.preventDefault()
        const offset = (previous.textContent || '').length
        while (block.firstChild) previous.appendChild(block.firstChild)
        block.parentNode.removeChild(block)
        placeCaret(previous, offset)
        return true
      }

      if (event.key !== 'Enter' || event.shiftKey) return false
      if (convertBlockShortcut(host, 'Enter')) {
        event.preventDefault()
        return true
      }
      event.preventDefault()

      if (block.classList.contains('dsp-code')) {
        insertPlainText('\n')
        return true
      }

      if (tag === 'li') {
        if (!(block.textContent || '').trim()) {
          const list = block.parentNode
          const paragraph = elementOf('p', 'dsp-md-p')
          list.parentNode.insertBefore(paragraph, list.nextSibling)
          block.parentNode.removeChild(block)
          if (!list.children.length) list.parentNode.removeChild(list)
          placeCaret(paragraph, 0)
          return true
        }
        const item = elementOf('li', block.className || 'dsp-md-li')
        const caret = textOffsetOf(block, selection.anchorNode, selection.anchorOffset)
        const range = selectOffsets(block, caret, (block.textContent || '').length)
        if (range) {
          const fragment = range.extractContents()
          item.appendChild(fragment)
        }
        block.parentNode.insertBefore(item, block.nextSibling)
        placeCaret(item, 0)
        return true
      }

      if (tag === 'blockquote') {
        const quote = elementOf('blockquote', 'dsp-md-quote')
        const caret = textOffsetOf(block, selection.anchorNode, selection.anchorOffset)
        const range = selectOffsets(block, caret, (block.textContent || '').length)
        if (range) quote.appendChild(range.extractContents())
        block.parentNode.insertBefore(quote, block.nextSibling)
        placeCaret(quote, 0)
        return true
      }

      const caret = textOffsetOf(block, selection.anchorNode, selection.anchorOffset)
      const paragraph = elementOf('p', 'dsp-md-p')
      if (/^h[1-6]$/.test(tag)) {
        // Enter at the end of a heading continues in body text, not in a heading.
        block.parentNode.insertBefore(paragraph, block.nextSibling)
        placeCaret(paragraph, 0)
        return true
      }
      const range = selectOffsets(block, caret, (block.textContent || '').length)
      if (range) paragraph.appendChild(range.extractContents())
      block.parentNode.insertBefore(paragraph, block.nextSibling)
      placeCaret(paragraph, 0)
      return true
    }

    /* ------------------------------------------------------------------ */
    /* panel visibility store                                              */
    /* ------------------------------------------------------------------ */

    const visibility = { open: false, session: '', link: null, browse: 0, listeners: new Set() }

    function notify() {
      for (const listener of Array.from(visibility.listeners)) {
        try {
          listener()
        } catch {
          // a broken listener must not stop the others
        }
      }
    }

    function setPanelOpen(next) {
      if (visibility.open === next) return
      visibility.open = next
      notify()
    }

    function setActiveSession(next) {
      if (typeof next !== 'string' || !next || visibility.session === next) return
      visibility.session = next
      notify()
    }

    function usePanelState() {
      const [, bump] = React.useState(0)
      React.useEffect(() => {
        const listener = () => bump((value) => value + 1)
        visibility.listeners.add(listener)
        return () => visibility.listeners.delete(listener)
      }, [])
      return { open: visibility.open, session: visibility.session }
    }

    // A document link clicked in the chat is opened by the right column through
    // `openResource(address)`. Our tab body never receives that address, so the
    // open call is recorded here and the panel follows the store instead.
    let linkSeq = 0

    function setLink(target) {
      linkSeq += 1
      visibility.link = { ...(target || {}), token: linkSeq }
      notify()
    }

    function useLinkTarget() {
      const [, bump] = React.useState(0)
      React.useEffect(() => {
        const listener = () => bump((value) => value + 1)
        visibility.listeners.add(listener)
        return () => visibility.listeners.delete(listener)
      }, [])
      return visibility.link
    }

    // Opening the panel from the header button means "browse": the panel drops
    // whatever document it showed and goes back to the file list. A counter is
    // used so two clicks in a row both count.
    let browseSeq = 0

    function requestBrowse() {
      browseSeq += 1
      visibility.browse = browseSeq
      // Browsing starts from the folder, not from whatever link was clicked
      // before: forgetting the link keeps a remount from reopening it.
      visibility.link = null
      notify()
    }

    function useBrowseRequest() {
      const [, bump] = React.useState(0)
      React.useEffect(() => {
        const listener = () => bump((value) => value + 1)
        visibility.listeners.add(listener)
        return () => visibility.listeners.delete(listener)
      }, [])
      return visibility.browse || 0
    }

    // The tab type's `title(address)` seat is the one place that is handed the
    // address. Record it there as well (deferred, because the title renders),
    // so the panel finds its document even if the service hook never installed.
    function rememberAddress(address, parsed) {
      if (!TEXT_EXT.test(parsed.path)) return
      const current = visibility.link
      if (current && current.address === address) return
      setTimeout(() => {
        setLink({
          address,
          path: parsed.path,
          session: parsed.scope === 'session' ? parsed.sessionId : '',
        })
      }, 0)
    }

    /* ------------------------------------------------------------------ */
    /* components                                                          */
    /* ------------------------------------------------------------------ */

    function IconButton(props) {
      return h(
        'button',
        {
          type: 'button',
          className: `dsp-icon-btn${props.active ? ' dsp-icon-btn-active' : ''}`,
          title: props.title,
          'aria-label': props.title,
          onClick: props.onClick,
          disabled: props.disabled,
        },
        props.children,
      )
    }

    function TextButton(props) {
      return h(
        'button',
        {
          type: 'button',
          className: `dsp-btn${props.primary ? ' dsp-btn-primary' : ''}${props.quiet ? ' dsp-btn-quiet' : ''}`,
          onClick: props.onClick,
          disabled: props.disabled,
          title: props.title,
        },
        props.children,
      )
    }

    /**
     * Map a text selection made on the rendered preview back onto the Markdown
     * source. The visible text drops syntax markers and line prefixes, so try
     * the raw string first and then a stripped copy that remembers, for every
     * kept character, where it came from in the original.
     */
    function locateSelection(content, text, hint) {
      const source = String(content || '')
      const wanted = String(text || '')
      if (!source || !wanted) return null
      const direct = source.indexOf(wanted)
      if (direct >= 0) {
        // Duplicates are common in a document under revision, so a hint (the
        // block the reader selected in) picks the nearest occurrence.
        if (typeof hint !== 'number' || !Number.isFinite(hint)) {
          return { start: direct, end: direct + wanted.length }
        }
        let best = direct
        let at = source.indexOf(wanted, best + 1)
        while (at >= 0) {
          if (Math.abs(at - hint) < Math.abs(best - hint)) best = at
          at = source.indexOf(wanted, at + 1)
        }
        return { start: best, end: best + wanted.length }
      }

      const inline = ['**', '~~', '__']
      const isWord = (ch) => !!ch && /[0-9A-Za-z\u4e00-\u9fa5]/.test(ch)
      const map = []
      let plain = ''
      let index = 0
      let tableRow = false
      while (index < source.length) {
        if (index === 0 || source[index - 1] === '\n') {
          // A fence line renders as a code card whose bar shows the language,
          // not as text: skip it entirely, or the plain copy below would carry
          // a `python` line that the browser selection never contains.
          if (source[index] !== '\n' && /^\s*(?:```|~~~)/.test(source.slice(index))) {
            const nextLine = source.indexOf('\n', index)
            index = nextLine < 0 ? source.length : nextLine
            continue
          }
          // A heading may carry a repeated marker (`## ## 四、生态工具`), and the
          // renderer collapses it, so every leading marker has to go too.
          const headingMarkers = /^(?:(?:#{1,6})\s+)+/.exec(source.slice(index))
          if (headingMarkers) {
            index += headingMarkers[0].length
            tableRow = false
            continue
          }
          const lineStart = /^(?:>\s?|[-*+]\s+(?:\[[ xX]\]\s+)?|\d+[.)]\s+)/.exec(source.slice(index))
          if (lineStart) {
            index += lineStart[0].length
            tableRow = false
            continue
          }
          // Table cells render as a row of cells, so the pipes are structure,
          // not text; dropping them lets a copied row match what is on screen.
          tableRow = /^\s*\|/.test(source.slice(index))
        }
        const marker = inline.find((token) => source.startsWith(token, index))
        if (marker) {
          index += marker.length
          continue
        }
        const char = source[index]
        if (char === '`') {
          index += 1
          continue
        }
        if (tableRow && char === '|') {
          index += 1
          continue
        }
        // A lone * _ ~ is markup only at a word boundary. Inside an identifier
        // such as `requires_grad` it belongs to the text: the rendering keeps it,
        // so dropping it here would make the selection unmatchable.
        if (char === '*' || char === '_' || char === '~') {
          if (!isWord(source[index - 1]) || !isWord(source[index + 1])) {
            index += 1
            continue
          }
        }
        if (char === '\n') tableRow = false
        plain += char
        map.push(index)
        index += 1
      }

      for (const needle of [wanted, wanted.replace(/\s+/g, ' ')]) {
        const hit = plain.indexOf(needle)
        if (hit < 0) continue
        const start = map[hit]
        const end = map[hit + needle.length - 1] + 1
        return { start, end }
      }

      // Last resort: collapsed whitespace on both sides, still index-mapped.
      const compactMap = []
      let compact = ''
      for (let i = 0; i < plain.length; i += 1) {
        const ch = plain[i]
        if (/\s/.test(ch)) {
          if (!compact || compact.endsWith(' ')) continue
          compact += ' '
        } else {
          compact += ch
        }
        compactMap.push(map[i])
      }
      const needle = wanted.replace(/\s+/g, ' ').trim()
      const hit = compact.indexOf(needle)
      if (hit < 0) return null
      return { start: compactMap[hit], end: compactMap[hit + needle.length - 1] + 1 }
    }

    /**
     * Where a DOM point sits in the source.
     *
     * The preview is not the source: markers are gone, and code cards, tables
     * and task lists are rebuilt, so a point can land on chrome that has no
     * source text of its own (a code card's language bar, a table row, the gap
     * between two blocks). Every rendered block and run carries `data-src`, and
     * they are read as a monotone stream: an anchored node gives an exact
     * offset, anything else snaps to the nearest anchored block on the side
     * requested. A selection therefore always maps to the closest text it
     * covers instead of failing and telling the reader to switch views.
     */
    function sourceAnchors(host) {
      if (!host || typeof host.querySelectorAll !== 'function') return []
      const found = []
      const nodes = host.querySelectorAll('[data-src]')
      for (let index = 0; index < nodes.length; index += 1) {
        const base = Number(nodes[index].getAttribute('data-src'))
        if (Number.isFinite(base)) found.push({ node: nodes[index], base })
      }
      return found
    }

    /** First source offset anchored inside this element, or null. */
    function anchorStart(element) {
      if (!element) return null
      const own = element.getAttribute ? element.getAttribute('data-src') : null
      const node = own ? element : element.querySelector ? element.querySelector('[data-src]') : null
      if (!node) return null
      const base = Number(node.getAttribute('data-src'))
      return Number.isFinite(base) ? base : null
    }

    /** Last source offset anchored inside this element, or null. */
    function anchorEnd(element) {
      if (!element) return null
      const own = element.getAttribute ? element.getAttribute('data-src') : null
      const nodes = own ? [element] : element.querySelectorAll ? Array.from(element.querySelectorAll('[data-src]')) : []
      let best = null
      nodes.forEach((node) => {
        const base = Number(node.getAttribute('data-src'))
        if (!Number.isFinite(base)) return
        const end = base + (node.textContent || '').length
        if (best === null || end > best) best = end
      })
      return best
    }

    /**
     * The offset of one selection endpoint. `edge` decides which way to snap
     * when the point is not anchored: 'start' takes the beginning of the block
     * it falls in (or the next one), 'end' takes the end of the block before it.
     */
    function sourceOffsetAt(container, offset, host, edge) {
      if (!container || !host) return null
      let element = container.nodeType === 1 ? container : container.parentElement
      // Exact: the point is inside a node that knows its own offset.
      while (element && element !== host) {
        const raw = typeof element.getAttribute === 'function' ? element.getAttribute('data-src') : null
        if (raw !== null && raw !== undefined && raw !== '') {
          const base = Number(raw)
          if (!Number.isFinite(base)) break
          try {
            const range = document.createRange()
            range.setStart(element, 0)
            range.setEnd(container, offset)
            return base + range.toString().length
          } catch {
            break
          }
        }
        element = element.parentElement
      }
      // Snapping: work out which rendered block holds the point.
      if (container === host) {
        // The browser reports "the preview itself, child N" at the edges.
        const children = host.children || []
        const child = children[Math.min(Math.max(offset, 0), Math.max(children.length - 1, 0))]
        if (!child) return null
        if (edge === 'start') return anchorStart(child)
        const tail = anchorEnd(child)
        return tail === null ? anchorStart(child) : tail
      }
      let block = container.nodeType === 1 ? container : container.parentElement
      while (block && block.parentElement && block.parentElement !== host) block = block.parentElement
      if (!block) return null
      if (edge === 'start') {
        const own = anchorStart(block)
        if (own !== null) return own
        let next = block.nextElementSibling
        while (next) {
          const found = anchorStart(next)
          if (found !== null) return found
          next = next.nextElementSibling
        }
        const previous = anchorEnd(block.previousElementSibling)
        return previous
      }
      const own = anchorEnd(block)
      if (own !== null) return own
      let previous = block.previousElementSibling
      while (previous) {
        const found = anchorEnd(previous)
        if (found !== null) return found
        previous = previous.previousElementSibling
      }
      return anchorStart(block)
    }

    /**
     * Lines that appeared in the newer version of a document. Used to mark
     * changes made outside the editor (the agent, another window) as pending
     * review, the way a collaborative document does.
     */
    function changedLinePairs(before, after) {
      const oldLines = String(before || '').split('\n')
      const newLines = String(after || '').split('\n')
      const pairs = []
      if (oldLines.length * newLines.length <= 400000) {
        const cols = newLines.length + 1
        const table = new Int32Array((oldLines.length + 1) * cols)
        for (let i = oldLines.length - 1; i >= 0; i -= 1) {
          for (let j = newLines.length - 1; j >= 0; j -= 1) {
            table[i * cols + j] = oldLines[i] === newLines[j]
              ? table[(i + 1) * cols + j + 1] + 1
              : Math.max(table[(i + 1) * cols + j], table[i * cols + j + 1])
          }
        }
        // A removed line is the previous text of whichever line replaces it;
        // an insert with nothing removed keeps an empty `old` (revert deletes it).
        const removed = []
        let i = 0
        let j = 0
        while (i < oldLines.length && j < newLines.length) {
          if (oldLines[i] === newLines[j]) {
            i += 1
            j += 1
          } else if (table[(i + 1) * cols + j] >= table[i * cols + j + 1]) {
            removed.push(oldLines[i])
            i += 1
          } else {
            pairs.push({ old: removed.shift() || '', next: newLines[j] })
            j += 1
          }
        }
        while (i < oldLines.length) {
          removed.push(oldLines[i])
          i += 1
        }
        while (j < newLines.length) {
          pairs.push({ old: removed.shift() || '', next: newLines[j] })
          j += 1
        }
        return pairs
      }
      const known = new Set(oldLines)
      newLines.forEach((line) => {
        if (!known.has(line)) pairs.push({ old: '', next: line })
      })
      return pairs
    }

    function changedLines(before, after) {
      return changedLinePairs(before, after).map((pair) => pair.next)
    }

    /** The readable part of a Markdown line, without its block syntax. */
    function fragmentText(line) {
      const text = String(line || '')
        .trim()
        .replace(/^\|/, '')
        .replace(/\|$/, '')
        .replace(/^(?:#{1,6}\s+|>\s?|[-*+]\s+(?:\[[ xX]\]\s+)?|\d+[.)]\s+)/, '')
        .replace(/^[-*_]{3,}$/, '')
        .trim()
      return text
    }

    /**
     * Pending-review fragments for one save: the changed lines, trimmed down to
     * something visible in the preview. Deletions produce nothing to highlight,
     * so only additions and replacements show up.
     */
    function pendingFragments(before, after, seed) {
      const stamp = Date.now().toString(36)
      const texts = []
      changedLinePairs(before, after).forEach((pair) => {
        const raw = String(pair.next || '').trim()
        const oldRaw = String(pair.old || '').trim()
        // A table row renders as separate cells, so a row-wide fragment would
        // never be found in the rendered text: mark the cells instead.
        if (raw.startsWith('|')) {
          tableCells(raw).forEach(({ text }) => {
            if (text.length >= 2) texts.push({ text, before: '' })
          })
          return
        }
        const text = fragmentText(raw)
        if (text.length >= 2) texts.push({ text, before: fragmentText(oldRaw) })
      })
      return texts
        .slice(0, 40)
        .map((entry, index) => ({
          id: 'p' + seed + '-' + stamp + '-' + index,
          text: entry.text.slice(0, 400),
          before: entry.before.slice(0, 400),
        }))
    }

    /**
     * A model answers a deletion request with an empty replacement. Cutting only
     * the quoted text would leave a bare marker ("## " or "- "), so when the quote
     * covered the visible part of a line the whole line goes too. Nothing is left
     * to highlight, so the call returns where the cut happened: the preview puts a
     * struck-through ghost of the removed words there.
     */
    function applyDeletion(content, start, end) {
      const source = String(content || '')
      const lineStart = source.lastIndexOf('\n', Math.max(start - 1, 0)) + 1
      let lineEnd = source.indexOf('\n', end)
      if (lineEnd < 0) lineEnd = source.length
      const head = source.slice(lineStart, start)
      const tail = source.slice(end, lineEnd)
      const bare = /^\s*(?:#{1,6}|[-*+]|\d+[.)]|>)?\s*$/.test(head) && /^\s*$/.test(tail)
      if (bare) {
        const after = lineEnd < source.length ? lineEnd + 1 : lineEnd
        let next = source.slice(0, lineStart) + source.slice(after)
        let at = lineStart
        // Removing a line leaves the blank line that separated it doubled.
        if (lineStart > 0 && next.slice(lineStart - 1, lineStart + 1) === '\n\n') {
          next = next.slice(0, lineStart - 1) + next.slice(lineStart)
          at = lineStart - 1
        }
        return { next, start: at, before: source.slice(at, after), block: true }
      }
      return {
        next: source.slice(0, start) + source.slice(end),
        start,
        before: source.slice(start, end),
        block: false,
      }
    }

    /**
     * Deleting a section heading should remove the section, not leave an empty
     * heading with its body orphaned under the previous section — the way a
     * document app behaves when the heading goes. The span runs from the heading
     * line to the next heading of the same or a higher level, with the trailing
     * blank lines trimmed so the neighbour keeps its one separator.
     */
    function sectionSpan(content, start, end) {
      const source = String(content || '')
      if (!source) return { start, end }
      const lineStart = source.lastIndexOf('\n', Math.max(start - 1, 0)) + 1
      const lineBreak = source.indexOf('\n', lineStart)
      const line = source.slice(lineStart, lineBreak < 0 ? source.length : lineBreak)
      const heading = /^(#{1,6})\s+/.exec(line)
      if (!heading) return { start, end }
      const level = heading[1].length
      let cursor = lineBreak < 0 ? source.length : lineBreak + 1
      let stop = source.length
      while (cursor < source.length) {
        const nextBreak = source.indexOf('\n', cursor)
        const row = source.slice(cursor, nextBreak < 0 ? source.length : nextBreak)
        const next = /^(#{1,6})\s+/.exec(row)
        if (next && next[1].length <= level) {
          stop = cursor
          break
        }
        cursor = nextBreak < 0 ? source.length : nextBreak + 1
      }
      let cut = stop
      while (cut > lineStart && /\s/.test(source[cut - 1])) cut -= 1
      return { start: lineStart, end: cut }
    }

    /** A short label for a ghost that may cover a whole section. */
    function ghostLabel(before) {
      const text = String(before || '')
      const rows = text.split('\n')
      const first = (rows.find((row) => row.trim()) || '').trim()
      const shown = first.length > 42 ? first.slice(0, 42) + '…' : first
      const more = rows.filter((row) => row.trim()).length > 1
      if (!shown) return rows.length ? '…' : ''
      return more ? shown + ' …' : shown
    }

    function makePanel(t, ctx) {
      return function DocPane(props) {
        const session = props && props.sessionId ? String(props.sessionId) : ''
        const open = true

        // A document link clicked in the chat opens this tab with a
        // `dsh-resource://file/…` address; the tab's hook is how the body
        // reads the address it was opened with.
        const useTabInfo = props && typeof props.useTabInfo === 'function' ? props.useTabInfo : null
        let tabInfo = null
        try {
          tabInfo = useTabInfo ? useTabInfo() : null
        } catch {
          // A body rendered outside a committed tab has no record to read.
          tabInfo = null
        }
        const tab = tabInfo && tabInfo.tab
        const navigation = tab && tab.navigation
        const tabAddress = (navigation && navigation.address) || (tab && tab.contentId) || ''
        const browse = !parseFileAddress(tabAddress) && navigation && navigation.params && navigation.params.browse ? navigation.revision : 0
        const linked = tabAddress ? parseFileAddress(tabAddress) : null
        const linkPath = linked ? linked.path : ''
        const linkSession = linked && linked.scope === 'session' ? linked.sessionId : ''

        const [files, setFiles] = React.useState(null)
        const [filesError, setFilesError] = React.useState('')
        const [listBusy, setListBusy] = React.useState(false)
        const [filter, setFilter] = React.useState('')
        const [folder, setFolder] = React.useState('')
        const [folderRoot, setFolderRoot] = React.useState('')
        const [refreshKey, setRefreshKey] = React.useState(0)

        const [path, setPath] = React.useState('')
        const [name, setName] = React.useState('')
        const [content, setContent] = React.useState('')
        const [saved, setSaved] = React.useState('')
        const [mtime, setMtime] = React.useState(0)
        const [docBusy, setDocBusy] = React.useState(false)
        const [docError, setDocError] = React.useState('')
        // Reading is the default: most of the time the document is opened to be
        // read, and one click on 编辑 brings the source back.
        const [mode, setMode] = React.useState('doc')
        // The document is a live contenteditable tree: React writes the HTML
        // once per outside change and never while the caret is inside it.
        const [docHtml, setDocHtml] = React.useState('')
        const docRef = React.useRef(null)
        const [editorLib, setEditorLib] = React.useState(null)
        const renderedRef = React.useRef('')
        const domDirtyRef = React.useRef(false)
        const pmRef = React.useRef(null)
        const pmHtmlRef = React.useRef('')
        const pmContentRef = React.useRef('')
        const pmTimerRef = React.useRef(0)
        const pmSyncRef = React.useRef(null)
        const pmSelectionRef = React.useRef(null)
        // The floating bar that follows the kernel's selection: formatting for a
        // picked range, table structure while the caret sits in a table.
        const [docBar, setDocBar] = React.useState(null)
        // While a link is being typed the bar holds the field instead of buttons.
        const [linkDraft, setLinkDraft] = React.useState(null)
        // The "/" insert menu: the block list, filtered as the query is typed.
        const [slashMenu, setSlashMenu] = React.useState(null)
        const slashRef = React.useRef(null)
        const slashNodeRef = React.useRef(null)
        const slashRunRef = React.useRef(null)
        const setSlash = React.useCallback((next) => {
          slashRef.current = next
          setSlashMenu(next)
        }, [])
        const pmBarRef = React.useRef(null)
        const barNodeRef = React.useRef(null)
        // The block handle: hovering a block shows a grip on its left edge, the
        // grip drags the block and opens a menu (move, copy, delete, convert).
        const [grip, setGrip] = React.useState(null)
        const [gripMenu, setGripMenu] = React.useState(null)
        const gripNodeRef = React.useRef(null)
        const gripMenuRef = React.useRef(null)
        const gripHideRef = React.useRef(0)
        const [zoom, setZoom] = React.useState(readZoom)
        const applyZoom = (next) => {
          const value = clampZoom(next)
          storeZoom(value)
          setZoom(value)
        }
        const nudgeZoom = (delta) => applyZoom(zoom + delta)

        const [chatHeight, setChatHeight] = React.useState(readChatHeight)
        const chatRef = React.useRef(null)
        /** Drag the strip above the chat to give it more (or less) room. */
        const beginChatDrag = (event) => {
          if (!event || event.button !== 0) return
          event.preventDefault()
          const startY = event.clientY
          const startHeight = chatRef.current ? chatRef.current.offsetHeight : 0
          const host = rootRef.current
          const limit = host && host.clientHeight ? Math.max(220, host.clientHeight - 200) : 900
          const onMove = (move) => {
            const next = Math.max(150, Math.min(limit, startHeight + (startY - move.clientY)))
            setChatHeight(next)
          }
          const onUp = () => {
            window.removeEventListener('mousemove', onMove)
            window.removeEventListener('mouseup', onUp)
            const node = chatRef.current
            if (node && node.offsetHeight) storeChatHeight(node.offsetHeight)
          }
          window.addEventListener('mousemove', onMove)
          window.addEventListener('mouseup', onUp)
        }

        const [selection, setSelection] = React.useState(null)
        /**
         * One transcript per open document, the way the centre chat works: the
         * user just talks, and a reply either answers or proposes an edit.
         */
        const [messages, setMessages] = React.useState([])
        /**
         * Ranges changed outside the editor, highlighted in the preview until
         * the reader has acknowledged them by clicking the highlighted text.
         */
        const [pending, setPending] = React.useState([])
        const [markMenu, setMarkMenu] = React.useState(null)
        const [composer, setComposer] = React.useState('')
        const [thinking, setThinking] = React.useState(false)
        /** Model and skill choices for this panel's composer, loaded from the Host. */
        const [modelRoutes, setModelRoutes] = React.useState(null)
        const [modelPick, setModelPick] = React.useState(null)
        const [skillOptions, setSkillOptions] = React.useState([])
        const [pickedSkills, setPickedSkills] = React.useState([])
        const [menu, setMenu] = React.useState('')
        const [conflict, setConflict] = React.useState(null)
        const [notice, setNotice] = React.useState('')

        const areaRef = React.useRef(null)
        const composerRef = React.useRef(null)
        const previewRef = React.useRef(null)
        const mirrorRef = React.useRef(null)
        const rootRef = React.useRef(null)
        // A global quote guard can cancel edits on protocol headings before the rich editor receives them.
        // Observe cancellation without interfering with the other plugin's handlers; source editing uses a textarea.
        React.useEffect(() => {
          if (mode !== 'doc' || !path) return
          const recover = (event) => {
            if (!event.isTrusted || event.defaultPrevented || !rootRef.current?.contains(event.target)) return
            const editor = event.target?.closest?.('[contenteditable="true"]')
            if (!editor) return
            const selection = window.getSelection()
            const anchor = selection?.anchorNode
            const row = (anchor?.nodeType === 1 ? anchor : anchor?.parentElement)?.closest('p,li,div')
            if (!row || !editor.contains(row) || !/^【(?:引用|批注)[^\n]*】$/.test(row.textContent.trim())) return
            queueMicrotask(() => { if (event.defaultPrevented && rootRef.current?.contains(editor)) setMode('source') })
          }
          window.addEventListener('beforeinput', recover, true)
          const key = event => { if (event.key.length === 1 || ['Backspace', 'Delete', 'Enter'].includes(event.key)) recover(event) }
          window.addEventListener('keydown', key, true)
          return () => { window.removeEventListener('beforeinput', recover, true); window.removeEventListener('keydown', key, true) }
        }, [mode, path])
        const dirty = content !== saved
        const dirtyRef = React.useRef(dirty)
        const mtimeRef = React.useRef(mtime)
        const pathRef = React.useRef(path)
        const contentRef = React.useRef(content)
        dirtyRef.current = dirty
        mtimeRef.current = mtime
        pathRef.current = path
        contentRef.current = content

        // Keep the reading state across restarts: the marks belong to this file
        // at this mtime, so they are stored beside it and dropped once it moves.
        React.useEffect(() => {
          storePending(path, mtime, pending)
        }, [path, mtime, pending])

        // Ctrl/Cmd + wheel zooms the whole panel. A native listener is used
        // because React installs wheel handlers as passive, where
        // preventDefault() is ignored and the column scrolls while zooming.
        const zoomRef = React.useRef(zoom)
        const applyZoomRef = React.useRef(applyZoom)
        zoomRef.current = zoom
        applyZoomRef.current = applyZoom
        React.useEffect(() => {
          const node = rootRef.current
          if (!node || typeof node.addEventListener !== 'function') return undefined
          const onWheel = (event) => {
            if (!event.ctrlKey && !event.metaKey) return
            event.preventDefault()
            applyZoomRef.current(zoomRef.current + (event.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP))
          }
          node.addEventListener('wheel', onWheel, { passive: false })
          return () => node.removeEventListener('wheel', onWheel)
        }, [])

        const flash = React.useCallback((message) => {
          setNotice(message)
          window.setTimeout(() => setNotice((current) => (current === message ? '' : current)), 2600)
        }, [])

        /**
         * A listed entry is relative to the folder being browsed, while the
         * host resolves a relative path against the Session workspace. Join the
         * entry onto the folder the list came from so a click always opens the
         * document the user sees.
         */
        const joinPath = (base, relative) => {
          const entry = String(relative || '')
          const root = String(base || '')
          if (!entry || !root) return entry
          if (/^[a-zA-Z]:[\\/]/.test(entry) || entry.startsWith('/') || entry.startsWith('\\\\')) return entry
          return `${root.replace(/[\\/]+$/, '')}/${entry.replace(/^[\\/]+/, '')}`
        }
        const resolveEntry = (file) => joinPath(folderRoot, file && file.path)

        // The Session that owns the open document. Reading a file while another
        // conversation is active must keep that conversation's working
        // directory: paths are often workspace-relative.
        const docSessionRef = React.useRef('')
        const [docSession, setDocSession] = React.useState('')
        // The panel edits LF text so positions in the preview match positions in
        // the buffer; a CRLF file is converted on the way in and back on save.
        const eolRef = React.useRef('\n')
        const toDisk = (text) => (eolRef.current === '\r\n' ? String(text).replace(/\n/g, '\r\n') : text)

        const life = React.useRef({})
        const savedRef = React.useRef(saved)
        savedRef.current = saved
        const adoptDisk = (result) => {
          const raw = String(result.content ?? '')
          eolRef.current = raw.includes('\r\n') ? '\r\n' : '\n'
          const text = raw.replace(/\r\n/g, '\n')
          life.current.version = result.version
          life.current.conflict = false
          contentRef.current = savedRef.current = text
          mtimeRef.current = result.mtime
          dirtyRef.current = false
          setContent(text)
          setSaved(text)
          setMtime(result.mtime)
          setConflict(null)
          return text
        }
        const flushEditor = () => {
          if (!pmTimerRef.current) return contentRef.current
          window.clearTimeout(pmTimerRef.current)
          pmTimerRef.current = 0
          if (pmRef.current) {
            const next = serializeMarkdown(pmRef.current.view.dom)
            domDirtyRef.current = true
            pmContentRef.current = contentRef.current = next
            dirtyRef.current = next !== savedRef.current
            setContent(next)
          }
          return contentRef.current
        }
        const leaveDocument = () => {
          flushEditor()
          if (dirtyRef.current && !window.confirm(t('discardConfirm'))) return false
          life.current = {}
          pathRef.current = ''
          dirtyRef.current = false
          setPath('')
          setName('')
          setContent('')
          setSaved('')
          setMtime(0)
          setMessages([])
          setPending([])
          setSelection(null)
          setConflict(null)
          setComposer('')
          setThinking(false)
          setNotice('')
          setDocBusy(false)
          setDocError('')
          return true
        }
        React.useEffect(() => () => {
          life.current = {}
          window.clearTimeout(pmTimerRef.current)
          pmTimerRef.current = 0
        }, [])

        const openFile = React.useCallback(
          async (nextPath, nextName, nextSession) => {
            if (!leaveDocument()) return false
            const owner = life.current
            const sourceSession = nextSession || session || ''
            setDocBusy(true)
            setDocError('')
            setMessages([])
            setSelection(null)
            setConflict(null)
            try {
              const result = await readDoc(nextPath, sourceSession)
              if (owner !== life.current) return false
              pathRef.current = result.path
              docSessionRef.current = sourceSession
              setDocSession(sourceSession)
              adoptDisk(result)
              setPath(result.path)
              setName(nextName || result.path.split('/').pop())
              setPending(readPending(result.path, result.mtime) || [])
              return true
            } catch (error) {
              if (owner === life.current) setDocError(error.message)
              return false
            } finally {
              if (owner === life.current) setDocBusy(false)
            }
          },
          [t, session],
        )

        /**
         * Lists the documents of a folder (the Session workspace by default).
         * Listing never opens anything by itself: a document is opened only by
         * a link in the conversation or by the user picking one.
         */
        const loadFiles = React.useCallback(async (nextFolder) => {
          setListBusy(true)
          setFilesError('')
          try {
            const result = await listRecent(nextFolder, session)
            const list = Array.isArray(result.files) ? result.files : []
            setFiles(list)
            setFolderRoot(result.root || '')
          } catch (error) {
            setFilesError(error.message)
          } finally {
            setListBusy(false)
          }
        }, [session])

        /** Reload the list even when the folder did not change. */
        const bumpRefresh = React.useCallback(() => setRefreshKey((key) => key + 1), [])

        /**
         * Drops the open document and goes back to the document list of the
         * active conversation. Nothing opens here: the user picks a file (or a
         * folder, or pastes a path) from the list.
         */
        const followSession = React.useCallback(() => {
          if (!leaveDocument()) return
          docSessionRef.current = session || ''
          setDocSession(docSessionRef.current)
          setFolder('')
          bumpRefresh()
        }, [bumpRefresh, t, session])

        // The header button means "browse": the panel shows the list instead of
        // whatever document a link opened earlier.
        const browseRef = React.useRef(0)
        React.useEffect(() => {
          if (!browse || browseRef.current === browse) return
          browseRef.current = browse
          followSession()
        }, [browse, followSession])

        /**
         * Pick any directory to browse. Its documents open by absolute path, so
         * the panel is no longer limited to the Session workspace.
         */
        const chooseFolder = React.useCallback(async () => {
          const workspace = service(ctx, 'uiWorkspace')
          const pick = workspace && typeof workspace.pickDirectory === 'function' ? workspace.pickDirectory : undefined
          if (!pick) {
            setFilesError(t('folderUnsupported'))
            return
          }
          try {
            const picked = await pick.call(workspace)
            if (typeof picked !== 'string' || !picked.trim()) return
            setFolder(picked)
            setFilter('')
            bumpRefresh()
          } catch (error) {
            setFilesError(error && error.message ? error.message : String(error))
          }
        }, [bumpRefresh, t])

        /**
         * One entry box for both kinds of target: a document opens, a directory
         * switches the list. Saves the user from the OS dialog's default folder.
         */
        const openAny = React.useCallback(async (value) => {
          const raw = String(value || '').trim()
          if (!raw) return
          setFilesError('')
          try {
            const info = await statPath(raw, session)
            if (info.kind === 'dir') {
              const target = info.absolute || raw
              setFolder(target)
              setFilter('')
              bumpRefresh()
              return
            }
            openFile(info.path || raw, info.name)
            setFilter('')
          } catch (error) {
            setFilesError(error && error.message ? error.message : String(error))
          }
        }, [bumpRefresh, openFile, session])


        // The panel follows the Session whose header opened it: a different
        // Session means a different working directory, so the open document
        // belongs to the previous one and is dropped. Runs before the load
        // effect below, which then opens the newest document of the new one.
        const sessionRef = React.useRef(session)
        // A Session switch caused by clicking a document link must not drop the
        // document it is about to open.
        const linkGuardRef = React.useRef('')
        React.useEffect(() => {
          if (sessionRef.current === session) return
          sessionRef.current = session
          if (linkGuardRef.current === session) {
            linkGuardRef.current = ''
            return
          }
          // Another conversation became active. A document being read stays
          // put: switching the centre chat is not a request to open a file.
          if (pathRef.current) return
          pathRef.current = ''
          dirtyRef.current = false
          setPath('')
          setName('')
          setContent('')
          setSaved('')
          setMtime(0)
          setMessages([])
          setPending([])
          setSelection(null)
          setConflict(null)
          setDocError('')
          setFolder('')
        }, [session])

        React.useEffect(() => {
          if (!open || !session) return
          loadFiles(folder)
        }, [open, session, folder, refreshKey, linkPath, loadFiles])

        // Clicking a document link in the conversation opens the tab with that
        // file's address; load it here instead of listing the workspace.
        const linkRef = React.useRef('')
        React.useEffect(() => {
          if (!linkPath || linkRef.current === tabAddress) return
          linkRef.current = tabAddress
          openFile(linkPath, linkPath.split('/').pop(), linkSession || session)
        }, [tabAddress, linkPath, linkSession, session, openFile])

        const line = Number(navigation?.params?.line ?? linked?.line)
        const jumpKey = JSON.stringify([tabAddress, navigation?.revision, line])
        const handledJump = React.useRef('')
        React.useEffect(() => {
          if (!linkPath || !path || docBusy || !Number.isSafeInteger(line) || line < 1 || handledJump.current === jumpKey || tab?.visible === false) return
          if (mode !== 'source') { setMode('source'); return }
          const area = areaRef.current
          if (!area) return
          handledJump.current = jumpKey
          const rows = area.value.split('\n')
          const index = Math.min(line, rows.length) - 1
          const offset = rows.slice(0, index).reduce((n, row) => n + row.length + 1, 0)
          area.focus({ preventScroll: true })
          area.setSelectionRange(offset, offset + rows[index].length)
          area.scrollTop = Math.max(0, index * (parseFloat(window.getComputedStyle(area).lineHeight) || 20) - area.clientHeight / 2)
        }, [jumpKey, line, mode, docBusy, path, linkPath, tab?.visible])

        const writeFileNow = React.useCallback((next, force = false) => {
          const owner = life.current
          const target = pathRef.current
          const sourceSession = docSessionRef.current
          if (!target) return Promise.resolve(false)
          const diskText = toDisk(next)
          const run = async () => {
            if (life.current !== owner || (!force && owner.conflict)) return false
            if (!force && savedRef.current === next) return true
            setDocBusy(true)
            try {
              const guard = force ? {} : { expectedVersion: owner.version, expectedMtime: mtimeRef.current }
              const result = await writeDoc({ path: target, content: diskText, ...guard }, sourceSession)
              if (life.current !== owner) return false
              owner.version = result.version
              owner.conflict = false
              savedRef.current = next
              mtimeRef.current = result.mtime
              setSaved(next)
              setMtime(result.mtime)
              setConflict(null)
              return true
            } catch (error) {
              if (life.current !== owner) return false
              if (error.status === 409 && error.data) {
                owner.conflict = true
                setConflict(error.data)
              } else {
                flash(error.message || t('saveFailed'))
              }
              return false
            }
          }
          const task = (owner.queue || Promise.resolve()).then(run)
          owner.queue = task
          return task.finally(() => {
            if (owner.queue !== task) return
            owner.queue = null
            if (life.current === owner) setDocBusy(false)
          })
        }, [flash, t])
        const save = React.useCallback((force) => writeFileNow(flushEditor(), force), [writeFileNow])

        /**
         * Where a mark sits in the current text: the offsets recorded when it
         * was created are used while they still hold, and the fragment is
         * re-located after any other edit moved it.
         */
        const markRange = React.useCallback((item) => {
          if (!item) return null
          if (
            typeof item.start === 'number' &&
            typeof item.end === 'number' &&
            content.slice(item.start, item.end) === item.text
          ) {
            return { start: item.start, end: item.end }
          }
          return locateSelection(content, item.text)
        }, [content])

        const acceptMark = React.useCallback((id) => {
          setMarkMenu(null)
          setPending((list) => list.filter((item) => item.id !== id))
        }, [])

        const revertMark = React.useCallback(
          (id) => {
            setMarkMenu(null)
            const item = pending.find((entry) => entry.id === id)
            if (!item || typeof item.before !== 'string') return
            const range = markRange(item)
            if (!range) {
              flash(t('markLost'))
              return
            }
            const next = content.slice(0, range.start) + item.before + content.slice(range.end)
            setContent(next)
            setPending((list) => list.filter((entry) => entry.id !== id))
            writeFileNow(next)
          },
          [pending, content, flash, t, markRange, writeFileNow],
        )

        const annotateMark = React.useCallback(
          (item) => {
            setMarkMenu(null)
            const range = item ? markRange(item) : null
            if (!range) {
              flash(t('markLost'))
              return
            }
            setSelection({ start: range.start, end: range.end, text: content.slice(range.start, range.end) })
            const area = composerRef.current
            if (area && typeof area.focus === 'function') area.focus()
          },
          [content, flash, t, markRange],
        )

        React.useEffect(() => {
          if (!markMenu) return undefined
          const onDown = (event) => {
            const target = event && event.target
            if (target && target.closest && (target.closest('.dsp-mark-menu') || target.closest('mark.dsp-pending'))) {
              return
            }
            setMarkMenu(null)
          }
          const onKey = (event) => {
            if (event.key === 'Escape') setMarkMenu(null)
          }
          window.document.addEventListener('mousedown', onDown)
          window.document.addEventListener('keydown', onKey)
          return () => {
            window.document.removeEventListener('mousedown', onDown)
            window.document.removeEventListener('keydown', onKey)
          }
        }, [markMenu])

        React.useEffect(() => {
          if (!open || !path) return undefined
          const owner = life.current
          let active = true
          let polling = false
          const timer = window.setInterval(async () => {
            if (!active || polling || owner.queue || life.current !== owner || pathRef.current !== path) return
            polling = true
            const stamp = mtimeRef.current
            const version = owner.version
            try {
              const result = await readDoc(path, docSessionRef.current || undefined)
              if (!active || life.current !== owner || owner.queue || stamp !== mtimeRef.current || version !== owner.version) return
              if (version && result.version ? version !== result.version : result.mtime !== stamp) {
                flushEditor()
                // Local edits are never thrown away silently: offer the newer
                // file instead of hiding the fact that the two versions differ.
                if (dirtyRef.current) {
                  owner.conflict = true
                  setConflict(result)
                  return
                }
                const previous = contentRef.current
                const normalizedFresh = adoptDisk(result)
                setMessages((list) => list.filter((item) => !item.edit))
                setPending((list) => [...list, ...pendingFragments(previous, normalizedFresh, 'x')].slice(-60))
                setNotice(t('externalReloaded'))
                window.setTimeout(() => setNotice(''), 2200)
              }
            } catch {
              // polling is best effort
            } finally {
              polling = false
            }
          }, 6000)
          return () => { active = false; window.clearInterval(timer) }
        }, [open, path, t])

        const trackSelection = React.useCallback(() => {
          const element = areaRef.current
          if (!element) return
          const start = element.selectionStart || 0
          const end = element.selectionEnd || 0
          if (end - start > 0) {
            setSelection({ start, end, text: content.slice(start, end) })
          } else {
            setSelection(null)
          }
        }, [content])

        /**
         * Reads the selection as source positions. Every rendered block carries
         * its offset, so an endpoint inside a block is exact; an endpoint on
         * chrome (a code card's bar, a table row, a block boundary) snaps to the
         * nearest block on that side. Only when neither works does the panel
         * match the visible text, and a selection that still cannot be placed is
         * dropped quietly rather than nagging the reader with an error.
         */
        const trackPreviewSelection = React.useCallback(() => {
          const host = previewRef.current
          if (!host || typeof window.getSelection !== 'function') return
          const picked = window.getSelection()
          if (!picked || picked.isCollapsed) return
          const text = String(picked.toString() || '')
          if (!text.trim()) return
          const node = picked.anchorNode
          const element = node ? (node.nodeType === 1 ? node : node.parentElement) : null
          if (!element || !host.contains(element)) return
          let located = null
          if (typeof picked.rangeCount === 'number' && picked.rangeCount > 0) {
            const range = picked.getRangeAt(0)
            const start = sourceOffsetAt(range.startContainer, range.startOffset, host, 'start')
            const end = sourceOffsetAt(range.endContainer, range.endOffset, host, 'end')
            if (start !== null && end !== null && end > start) located = { start, end }
          }
          if (!located) located = locateSelection(content, text)
          if (!located) {
            setSelection(null)
            return
          }
          const end = Math.min(located.end, content.length)
          setSelection({ start: located.start, end, text: content.slice(located.start, end) })
        }, [content])

        /** Whatever the document now holds goes back into the markdown. */
        const syncDocument = React.useCallback(() => {
          const host = docRef.current
          if (!host) return
          domDirtyRef.current = true
          setContent(serializeMarkdown(host))
        }, [])

        const docInput = React.useCallback(() => {
          const host = docRef.current
          if (!host) return
          convertTypingMarks(host)
          syncDocument()
        }, [syncDocument])

        const docKeyDown = React.useCallback((event) => {
          const host = docRef.current
          if (!host || event.isComposing) return
          if (event.key === ' ' && convertBlockShortcut(host, ' ')) {
            event.preventDefault()
            syncDocument()
            return
          }
          if (editDocumentKey(event, host)) syncDocument()
        }, [syncDocument])

        const docPaste = React.useCallback((event) => {
          const host = docRef.current
          if (!host) return
          event.preventDefault()
          const data = event.clipboardData || (typeof window !== 'undefined' ? window.clipboardData : null)
          const text = data ? String(data.getData('text/plain') || '') : ''
          if (text) insertPlainText(text)
          syncDocument()
        }, [syncDocument])


        /** Selecting inside the document quotes source, caret or not. */
        const trackDocSelection = React.useCallback(() => {
          const host = docRef.current
          if (!host || typeof window.getSelection !== 'function') return
          const picked = window.getSelection()
          if (!picked || picked.isCollapsed || !picked.rangeCount) return
          const text = String(picked.toString() || '')
          if (!text.trim()) return
          const node = picked.anchorNode
          const element = node ? (node.nodeType === 1 ? node : node.parentElement) : null
          if (!element || !host.contains(element)) return
          const range = picked.getRangeAt(0)
          let located = null
          if (renderedRef.current === content) {
            const start = sourceOffsetAt(range.startContainer, range.startOffset, host, 'start')
            const end = sourceOffsetAt(range.endContainer, range.endOffset, host, 'end')
            if (start !== null && end !== null && end > start) located = { start, end }
          }
          if (!located) {
            const block = docBlockOf(host, range.startContainer)
            const hint = block ? Number(block.getAttribute('data-src')) : NaN
            located = locateSelection(content, text, Number.isFinite(hint) ? hint : undefined)
          }
          if (!located) {
            setSelection(null)
            return
          }
          const end = Math.min(located.end, content.length)
          setSelection({ start: located.start, end, text: content.slice(located.start, end) })
        }, [content])

        /**
         * The editing kernel: ProseMirror owns the document DOM, keeps its own
         * undo history and translates Markdown as you type. React never rewrites
         * that HTML while it is mounted, so the caret survives every panel
         * re-render; a file that changed on disk is pushed in through `setHtml`.
         */
        const pmSourceOf = React.useCallback((blockText, text) => {
          const hint = blockText ? content.indexOf(String(blockText).slice(0, 24)) : -1
          return locateSelection(content, text, hint >= 0 ? hint : undefined)
        }, [content])

        /** Selecting inside the kernel's document quotes the matching source. */
        const trackPmSelection = React.useCallback(() => {
          const host = docRef.current
          if (!host || typeof window.getSelection !== 'function') return
          const picked = window.getSelection()
          if (!picked || !picked.rangeCount) return
          const node = picked.anchorNode
          const element = node ? (node.nodeType === 1 ? node : node.parentElement) : null
          if (picked.isCollapsed) {
            // A click inside the document means "I am done selecting"; a click
            // in the composer must keep the quote, and it never reaches here.
            if (element && host.contains(element)) setSelection(null)
            return
          }
          const text = String(picked.toString() || '')
          if (!text.trim()) return
          if (!element || !host.contains(element)) return
          const block = docBlockOf(host, node)
          const blockText = block ? String(block.textContent || '') : ''
          const located = pmSourceOf(blockText, text)
          if (!located) return
          const end = Math.min(located.end, content.length)
          setSelection({ start: located.start, end, text: content.slice(located.start, end) })
        }, [content, pmSourceOf])

        pmSyncRef.current = () => {
          window.clearTimeout(pmTimerRef.current)
          pmTimerRef.current = window.setTimeout(flushEditor, 220)
        }

        pmSelectionRef.current = (picked) => {
          const text = picked && picked.text ? String(picked.text) : ''
          if (!text.trim()) {
            setSelection(null)
            return
          }
          const located = pmSourceOf(picked.blockText, text)
          if (!located) return
          const end = Math.min(located.end, content.length)
          setSelection({ start: located.start, end, text: content.slice(located.start, end) })
        }

        /**
         * The kernel reports where the caret is: the bar is drawn next to that
         * range, and it is dropped as soon as nothing is selected or the caret
         * leaves a table.
         */
        pmBarRef.current = (picked) => {
          const instance = pmRef.current
          const info = picked || (instance && typeof instance.getSelection === 'function' ? instance.getSelection() : null)
          const rect = info && info.rect
          const hasText = !!(info && info.text && String(info.text).trim())
          const inTable = !!(info && info.inTable)
          if (!instance || !rect || (!hasText && !inTable)) {
            setDocBar(null)
            return
          }
          // The bar is 340px wide at most: keep it inside the window.
          const width = 340
          const left = Math.min(Math.max(8, rect.left), Math.max(8, window.innerWidth - width - 8))
          const above = rect.top > 64
          setDocBar({
            left,
            top: above ? rect.top - 8 : rect.bottom + 8,
            above,
            hasText,
            inTable,
            marks: (info && info.marks) || {},
            text: hasText ? String(info.text) : '',
            blockText: (info && info.blockText) || '',
          })
        }

        /** Run a kernel command from the bar, then redraw it from the new state. */
        const barRun = (run) => () => {
          const instance = pmRef.current
          if (!instance || typeof run !== 'function') return
          run(instance)
          if (pmBarRef.current) pmBarRef.current(null)
        }

        const barLink = () => setLinkDraft('https://')

        const applyBarLink = () => {
          const instance = pmRef.current
          if (instance && typeof instance.setLink === 'function') instance.setLink(linkDraft || '')
          setLinkDraft(null)
          if (pmBarRef.current) pmBarRef.current(null)
        }

        /** 引用到对话: the same quote the selection makes, on demand. */
        const barQuote = () => {
          const instance = pmRef.current
          const info = instance && typeof instance.getSelection === 'function' ? instance.getSelection() : null
          if (info && info.text && String(info.text).trim()) {
            const located = pmSourceOf(info.blockText, info.text)
            if (located) {
              const end = Math.min(located.end, content.length)
              setSelection({ start: located.start, end, text: content.slice(located.start, end) })
            }
          }
          setDocBar(null)
        }

        // A click on empty space puts the bar away; a click inside it or inside
        // the document leaves it to the kernel's own selection report.
        React.useEffect(() => {
          if (!docBar) return undefined
          const onDown = (event) => {
            const target = event.target
            const bar = barNodeRef.current
            const host = docRef.current
            if (bar && target && bar.contains(target)) return
            if (host && target && host.contains(target)) return
            setDocBar(null)
          }
          window.document.addEventListener('mousedown', onDown, true)
          return () => window.document.removeEventListener('mousedown', onDown, true)
        }, [docBar])

        React.useEffect(() => {
          if (!gripMenu) return undefined
          const onDown = (event) => {
            const target = event.target
            const menu = gripMenuRef.current
            const node = gripNodeRef.current
            if (menu && target && menu.contains(target)) return
            if (node && target && node.contains(target)) return
            setGripMenu(null)
          }
          window.document.addEventListener('mousedown', onDown, true)
          return () => window.document.removeEventListener('mousedown', onDown, true)
        }, [gripMenu])

        /** Inserting an image needs a source: pick a file and inline it. */
        const pickImage = (instance) => {
          const input = window.document.createElement('input')
          input.type = 'file'
          input.accept = 'image/*'
          input.addEventListener('change', () => {
            const file = input.files && input.files[0]
            if (!file) return
            const reader = new FileReader()
            reader.onload = () => {
              const target = pmRef.current || instance
              if (target && typeof target.insertImage === 'function') {
                target.insertImage(String(reader.result || ''), file.name)
              }
            }
            reader.readAsDataURL(file)
          })
          input.click()
        }

        /** The menu's choice: drop the "/query" first, then insert the block. */
        const runSlashItem = (item) => {
          const instance = pmRef.current
          setSlash(null)
          if (!instance || !item) return
          if (typeof instance.clearSlash === 'function') instance.clearSlash()
          if (item.kind === 'image') {
            pickImage(instance)
            return
          }
          if (typeof instance.insertBlock === 'function') instance.insertBlock(item.kind)
        }
        slashRunRef.current = runSlashItem

        /**
         * Pasting into the kernel: rich HTML keeps its blocks, bold and links but
         * not the page's fonts and colours; Markdown text becomes blocks too, and
         * a single line stays plain text. One paste is one undo step.
         */
        const pmPaste = (event) => {
          const instance = pmRef.current
          if (!instance) return
          const data = event.clipboardData || (typeof window !== 'undefined' ? window.clipboardData : null)
          if (!data) return
          const html = String(data.getData('text/html') || '')
          const text = String(data.getData('text/plain') || '')
          event.preventDefault()
          const cleaned = html ? cleanPastedHtml(html) : ''
          if (cleaned && /<(p|h[1-6]|ul|ol|li|table|blockquote|pre|div)[\s>]/i.test(cleaned) && typeof instance.pasteHtml === 'function') {
            instance.pasteHtml(cleaned)
            return
          }
          if (!text) return
          if (looksLikeMarkdown(text) && typeof instance.pasteHtml === 'function') {
            instance.pasteHtml(markdownToHtml(text, t, [], { bareCode: true }))
            return
          }
          if (typeof instance.pasteText === 'function') instance.pasteText(text)
        }

        /** The block under the pointer, with the grip's place beside it. */
        const gripSpot = (event) => {
          const instance = pmRef.current
          const host = docRef.current
          if (!instance || !host || !event || !event.target) return null
          // The kernel renders its blocks inside its own element under the host.
          const root = instance.view && instance.view.dom ? instance.view.dom : host
          let node = event.target
          while (node && node.parentNode !== root) node = node.parentNode
          if (!node || node.parentNode !== root) return null
          const pos = instance.blockPosAtDom(node)
          if (!(pos >= 0)) return null
          const rect = node.getBoundingClientRect()
          return { pos, left: rect.left, top: rect.top, height: rect.height }
        }

        /** Hovering a block brings its grip out; leaving hides it a moment later. */
        const trackGrip = (event) => {
          if (!editorLib || mode !== 'doc') return
          const spot = gripSpot(event)
          if (!spot) return
          if (gripHideRef.current) {
            window.clearTimeout(gripHideRef.current)
            gripHideRef.current = 0
          }
          const offset = Math.max(0, Math.min(6, spot.height / 2 - 12))
          setGrip({ pos: spot.pos, left: Math.round(spot.left - 28), top: Math.round(spot.top + offset) })
        }
        const leaveGrip = () => {
          if (gripHideRef.current) window.clearTimeout(gripHideRef.current)
          gripHideRef.current = window.setTimeout(() => {
            gripHideRef.current = 0
            const node = gripNodeRef.current
            if (node && node.matches && node.matches(':hover')) return
            setGrip(null)
            setGripMenu(null)
          }, 150)
        }

        /** Drag the grip to another block, or click it to open its menu. */
        const startGripDrag = (event) => {
          if (!event || event.button !== 0) return
          event.preventDefault()
          const current = grip
          if (!current) return
          const from = { x: event.clientX, y: event.clientY }
          let moved = false
          const onMove = (move) => {
            if (Math.abs(move.clientX - from.x) + Math.abs(move.clientY - from.y) > 4) moved = true
          }
          const onUp = (up) => {
            window.removeEventListener('mousemove', onMove)
            window.removeEventListener('mouseup', onUp)
            const instance = pmRef.current
            if (!instance) return
            if (!moved) {
              setGripMenu({ pos: current.pos, left: current.left, top: current.top })
              return
            }
            const host = docRef.current
            const root = instance.view && instance.view.dom ? instance.view.dom : host
            const under = window.document.elementFromPoint ? window.document.elementFromPoint(up.clientX, up.clientY) : null
            let node = under
            while (node && root && node.parentNode !== root) node = node.parentNode
            if (!node || !root || node.parentNode !== root) return
            const target = instance.blockPosAtDom(node)
            if (!(target >= 0)) return
            const rect = node.getBoundingClientRect()
            const before = up.clientY < rect.top + rect.height / 2
            if (instance.blockMoveTo(current.pos, target, before)) {
              setGrip(null)
              setGripMenu(null)
            }
          }
          window.addEventListener('mousemove', onMove)
          window.addEventListener('mouseup', onUp)
        }

        /** One entry of the grip's menu; the block position stays as it opened. */
        const gripAction = (run) => {
          const instance = pmRef.current
          const at = gripMenu ? gripMenu.pos : grip ? grip.pos : -1
          setGripMenu(null)
          if (!instance || !(at >= 0)) return
          run(instance, at)
        }

        /**
         * Typing "/" in an empty block opens the insert menu; the query is what
         * follows the slash, so filtering is just the block's own text. The keys
         * are taken in the capture phase: the kernel's own Enter/arrow keys must
         * not fire while the menu is open.
         */
        React.useEffect(() => {
          if (mode !== 'doc' || !editorLib || !open || !path) return undefined
          const host = docRef.current
          if (!host) return undefined
          const openItems = () => filterSlashBlocks(t, slashRef.current ? slashRef.current.query : '')
          const onOpen = (event) => {
            if (event.key !== '/' && event.code !== 'Slash') return
            const instance = pmRef.current
            if (!instance || typeof instance.getSelection !== 'function') return
            const info = instance.getSelection()
            const blockText = String((info && info.blockText) || '').trim()
            // Only an empty block: a "/" inside a sentence is just a character.
            if (blockText !== '/') return
            const rect = info && info.rect
            if (!rect) return
            setSlash({
              query: '',
              index: 0,
              left: Math.min(Math.max(8, rect.left), Math.max(8, window.innerWidth - 240)),
              top: rect.bottom + 6,
            })
          }
          const onSync = () => {
            const current = slashRef.current
            if (!current) return
            const instance = pmRef.current
            if (!instance || typeof instance.getSelection !== 'function') {
              setSlash(null)
              return
            }
            const info = instance.getSelection()
            const raw = String((info && info.blockText) || '')
            const at = raw.indexOf('/')
            if (at < 0) {
              setSlash(null)
              return
            }
            const query = raw.slice(at + 1).trim()
            if (query === current.query) return
            setSlash({ ...current, query, index: 0 })
          }
          const onKey = (event) => {
            const current = slashRef.current
            if (!current) return
            const list = openItems()
            if (event.key === 'Escape') {
              event.preventDefault()
              event.stopPropagation()
              setSlash(null)
              return
            }
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
              event.preventDefault()
              event.stopPropagation()
              if (!list.length) return
              const step = event.key === 'ArrowDown' ? 1 : -1
              setSlash({ ...current, index: (current.index + step + list.length) % list.length })
              return
            }
            if (event.key === 'Enter') {
              event.preventDefault()
              event.stopPropagation()
              if (slashRunRef.current) slashRunRef.current(list[current.index] || list[0])
            }
          }
          host.addEventListener('keyup', onOpen, true)
          host.addEventListener('keyup', onSync, true)
          host.addEventListener('keydown', onKey, true)
          return () => {
            host.removeEventListener('keyup', onOpen, true)
            host.removeEventListener('keyup', onSync, true)
            host.removeEventListener('keydown', onKey, true)
          }
        }, [mode, editorLib, open, path, t, setSlash])

        // A click anywhere else puts the insert menu away.
        React.useEffect(() => {
          if (!slashMenu) return undefined
          const onDown = (event) => {
            const node = slashNodeRef.current
            const target = event.target
            if (node && target && node.contains(target)) return
            setSlash(null)
          }
          window.document.addEventListener('mousedown', onDown, true)
          return () => window.document.removeEventListener('mousedown', onDown, true)
        }, [slashMenu, setSlash])

        React.useEffect(() => {
          if (!open || !path) return undefined
          let live = true
          loadEditorLib().then((lib) => {
            if (live && lib) setEditorLib(lib)
          })
          return () => {
            live = false
          }
        }, [open, path])

        React.useEffect(() => {
          if (mode !== 'doc' || !editorLib || !open || !path || docError) return undefined
          const host = docRef.current
          if (!host || pmRef.current) return undefined
          const html = markdownToHtml(content, t, [], { bareCode: true, kernelTask: true })
          let instance = null
          // The fallback may have rendered HTML into this node already.
          host.innerHTML = ''
          try {
            instance = editorLib.create({
              root: host,
              html,
              onChange: () => {
                if (pmSyncRef.current) pmSyncRef.current()
              },
              onSelection: (value) => {
                if (pmSelectionRef.current) pmSelectionRef.current(value)
                if (pmBarRef.current) pmBarRef.current(value)
              },
            })
          } catch (error) {
            console.error('dsh-doc-pane: 编辑器初始化失败，改用内置编辑', error)
            setEditorLib(null)
            return undefined
          }
          try {
            // React may have left a stale contenteditable on the host.
            instance.view.dom.setAttribute('contenteditable', 'true')
            if (host.hasAttribute('contenteditable')) host.removeAttribute('contenteditable')
          } catch (error) {
            console.error('dsh-doc-pane: 编辑器可编辑属性设置失败', error)
          }
          pmRef.current = instance
          pmHtmlRef.current = html
          pmContentRef.current = content
          return () => {
            if (pmRef.current === instance) pmRef.current = null
            setDocBar(null)
            try {
              instance.destroy()
            } catch (error) {
              console.error('dsh-doc-pane: 编辑器卸载失败', error)
            }
          }
          // eslint-disable-next-line react-hooks/exhaustive-deps
        }, [mode, editorLib, open, path, docError])

        /** A file that changed on disk replaces the document, but only then. */
        React.useEffect(() => {
          const instance = pmRef.current
          if (!instance || mode !== 'doc') return
          if (content === pmContentRef.current) return
          const html = markdownToHtml(content, t, [], { bareCode: true, kernelTask: true })
          if (html === pmHtmlRef.current) return
          pmHtmlRef.current = html
          pmContentRef.current = content
          instance.setHtml(html)
        }, [content, mode, t])

        /** Pending marks and deletion ghosts ride on decorations, not the text. */
        React.useEffect(() => {
          const instance = pmRef.current
          if (!instance || mode !== 'doc') return
          instance.setPending((pending || []).map((item) => ({ ...item, hint: t('pendingHint') })))
        }, [pending, mode, t])

        /** The HTML is rebuilt only when the document changed from outside. */
        React.useEffect(() => {
          if (!path || mode !== 'doc') return
          if (editorLib) return
          if (domDirtyRef.current) {
            domDirtyRef.current = false
            return
          }
          setDocHtml(markdownToHtml(content, t, { items: pending, hint: t('pendingHint') }))
          renderedRef.current = content
        }, [path, mode, content, pending, t])

        /** Feishu-style autosave: stop typing for a moment and the file follows. */
        React.useEffect(() => {
          if (!path || !dirty) return undefined
          const owner = life.current
          const timer = window.setTimeout(() => { if (life.current === owner) save() }, 1200)
          return () => window.clearTimeout(timer)
        }, [content, dirty, path, save])

        /**
         * Selection events arrive on mouseup, but a re-render between the
         * gesture and the handler can steal them (a mark under the cursor is
         * removed, the DOM is replaced, the selection collapses). Watching
         * `selectionchange` keeps the quote chip in step with whatever is
         * selected inside the preview, however the DOM moved.
         */
        React.useEffect(() => {
          if (!open || !path || mode !== 'doc') return undefined
          if (!window.document || typeof window.document.addEventListener !== 'function') return undefined
          let frame = 0
          const sync = () => {
            frame = 0
            trackPreviewSelection()
          }
          const onChange = () => {
            if (frame) return
            frame = typeof window.requestAnimationFrame === 'function'
              ? window.requestAnimationFrame(sync)
              : window.setTimeout(sync, 16)
          }
          window.document.addEventListener('selectionchange', onChange)
          return () => {
            window.document.removeEventListener('selectionchange', onChange)
            if (frame) {
              if (typeof window.cancelAnimationFrame === 'function') window.cancelAnimationFrame(frame)
              window.clearTimeout(frame)
            }
          }
        }, [open, path, mode, trackPreviewSelection])

        /**
         * Acknowledged: the mark disappears because the fragment leaves the
         * pending list and the preview re-renders without it.
         */

        /**
         * A plain click on a highlighted fragment opens its review menu. While
         * a passage is being selected the click belongs to that gesture, so
         * selecting text that happens to sit on a mark still fills the quote
         * chip instead of silently acknowledging the mark.
         */
        const openMarkMenu = React.useCallback((event) => {
          const target = event && event.target
          const mark = target && target.closest ? target.closest('[data-pending-id]') : null
          if (!mark) {
            setMarkMenu(null)
            return
          }
          if (typeof window.getSelection === 'function') {
            const picked = window.getSelection()
            if (picked && !picked.isCollapsed && String(picked.toString() || '').trim()) return
          }
          const id = mark.getAttribute('data-pending-id')
          const item = pending.find((entry) => entry.id === id)
          if (!item) return
          const rect = typeof mark.getBoundingClientRect === 'function' ? mark.getBoundingClientRect() : null
          const viewport = window.innerWidth || 1280
          const width = 236
          const left = rect ? Math.min(Math.max(8, rect.left), Math.max(8, viewport - width)) : 8
          setMarkMenu({ id: item.id, item, left, top: rect ? rect.bottom + 6 : 48 })
        }, [pending])
        /** Copy button and mark menu share one delegated click. */
        const docClick = React.useCallback((event) => {
          const target = event.target
          const copy = target && target.closest ? target.closest('.dsp-code-copy') : null
          if (copy) {
            const card = copy.closest('.dsp-code')
            const code = card ? card.querySelector('pre code') : null
            const text = code ? String(code.textContent || '') : ''
            try {
              if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text)
            } catch (error) {
              // a missing clipboard API must not break editing
            }
            const label = copy.textContent
            copy.textContent = t('copied')
            window.setTimeout(() => { copy.textContent = label }, 1600)
            return
          }
          openMarkMenu(event)
        }, [openMarkMenu, t])


        /**
         * In the edit view a mark cannot be clicked: the textarea sits above the
         * mirror. Placing the caret inside a changed fragment is the same
         * acknowledgement gesture as clicking the highlighted text in preview.
         */
        const releasePendingAtCaret = React.useCallback(() => {
          const element = areaRef.current
          if (!element || !pending.length) return
          const caret = element.selectionStart || 0
          const hit = pending.find((item) => {
            const located = locateSelection(content, item.text)
            return located && caret >= located.start && caret <= located.end
          })
          if (hit) setPending((list) => list.filter((item) => item.id !== hit.id))
        }, [pending, content])

        /**
         * A fresh batch of changes scrolls the reader to the first one, the way a
         * review request does; clearing a mark must not move the page again.
         */
        const firstPendingRef = React.useRef('')
        React.useEffect(() => {
          const first = pending.length ? pending[0].id : ''
          const fresh = first && first !== firstPendingRef.current
          firstPendingRef.current = first
          if (!fresh || mode !== 'doc') return
          const host = previewRef.current
          const node = host && host.querySelector ? host.querySelector('mark.dsp-pending') : null
          if (node && typeof node.scrollIntoView === 'function') node.scrollIntoView({ block: 'center' })
        }, [pending, mode])

        /** A picker closes as soon as the pointer or Esc leaves the composer. */
        React.useEffect(() => {
          if (!menu) return undefined
          const onDown = (event) => {
            const target = event.target
            if (target && target.closest && target.closest('.dsp-composer')) return
            setMenu('')
          }
          const onKey = (event) => {
            if (event.key === 'Escape') setMenu('')
          }
          document.addEventListener('mousedown', onDown)
          document.addEventListener('keydown', onKey)
          return () => {
            document.removeEventListener('mousedown', onDown)
            document.removeEventListener('keydown', onKey)
          }
        }, [menu])

        /**
         * One place to talk to the document: the reply either answers or
         * proposes an edit of the quoted selection. No mode switch.
         */
        React.useEffect(() => {
          if (!path) return undefined
          let live = true
          Promise.all([listModels(docSession), listSkills(docSession)])
            .then(([models, skills]) => {
              if (!live) return
              if (models && Array.isArray(models.providers)) setModelRoutes(models)
              if (skills && Array.isArray(skills.skills)) setSkillOptions(skills.skills)
            })
            .catch((error) => {
              console.error('dsh-doc-pane: loading model and skill options failed', error)
            })
          return () => {
            live = false
          }
        }, [path, docSession])

        React.useEffect(() => {
          setModelRoutes(null)
          setSkillOptions([])
          setPickedSkills([])
          setModelPick(null)
        }, [docSession])

        const modelLabel = () => {
          const pick = modelPick || (modelRoutes && modelRoutes.current) || null
          if (!pick) return t('modelAuto')
          const providers = (modelRoutes && modelRoutes.providers) || []
          for (const provider of providers) {
            if (provider.id !== pick.provider) continue
            for (const model of provider.models) {
              if (model.id === pick.model) return model.name || model.id
            }
          }
          return pick.model
        }

        const renderModelMenu = () => {
          const providers = (modelRoutes && modelRoutes.providers) || []
          const pick = modelPick || (modelRoutes && modelRoutes.current) || null
          const rows = [
            h(
              'button',
              {
                key: '@default',
                type: 'button',
                className: pick ? 'dsp-pop-item' : 'dsp-pop-item dsp-pop-item-on',
                onClick: () => {
                  setModelPick(null)
                  setMenu('')
                },
              },
              h('span', { className: 'dsp-pop-main' }, t('modelDefault')),
              h('span', { className: 'dsp-pop-sub' }, t('modelDefaultHint')),
            ),
          ]
          for (const provider of providers) {
            if (!provider.models || !provider.models.length) continue
            rows.push(h('div', { key: 'g-' + provider.id, className: 'dsp-pop-group' }, provider.name || provider.id))
            for (const model of provider.models) {
              const on = pick && pick.provider === provider.id && pick.model === model.id
              rows.push(
                h(
                  'button',
                  {
                    key: provider.id + '/' + model.id,
                    type: 'button',
                    className: on ? 'dsp-pop-item dsp-pop-item-on' : 'dsp-pop-item',
                    onClick: () => {
                      setModelPick({ provider: provider.id, model: model.id })
                      setMenu('')
                    },
                  },
                  h('span', { className: 'dsp-pop-main' }, model.name || model.id),
                  h('span', { className: 'dsp-pop-sub' }, provider.name || provider.id),
                ),
              )
            }
          }
          if (rows.length === 1) rows.push(h('div', { key: '@empty', className: 'dsp-pop-empty' }, t('modelEmpty')))
          return h('div', { className: 'dsp-pop' }, rows)
        }

        const renderSkillMenu = () => {
          if (!skillOptions.length) {
            return h('div', { className: 'dsp-pop' }, h('div', { className: 'dsp-pop-empty' }, t('skillEmpty')))
          }
          return h(
            'div',
            { className: 'dsp-pop' },
            skillOptions.map((option) => {
              const on = pickedSkills.includes(option.name)
              return h(
                'button',
                {
                  key: option.name,
                  type: 'button',
                  className: on ? 'dsp-pop-item dsp-pop-item-on' : 'dsp-pop-item',
                  title: option.description || option.name,
                  onClick: () =>
                    setPickedSkills((list) =>
                      list.includes(option.name)
                        ? list.filter((item) => item !== option.name)
                        : [...list, option.name].slice(0, 4),
                    ),
                },
                h('span', { className: on ? 'dsp-check dsp-check-on' : 'dsp-check' }, on ? '✓' : ''),
                h('span', { className: 'dsp-pop-main' }, option.name),
              )
            }),
          )
        }

        const sendChat = React.useCallback(async () => {
          const text = composer.trim()
          const quote = selection
          if (!text && !quote) return
          const owner = life.current
          if (!path || thinking || owner.thinking) return
          const content = flushEditor()
          const base = content
          if (quote && base.slice(quote.start, quote.end) !== quote.text) { flash(t('markLost')); return }
          const version = owner.version
          const stamp = mtimeRef.current
          owner.thinking = true
          const history = messages.map((item) => ({ role: item.role, text: item.text })).slice(-10)
          const prompt = text || t('defaultPrompt')
          const userItem = { id: 'u' + Date.now(), role: 'user', text: prompt, quote: quote ? quote.text : '' }
          setMessages((list) => [...list, userItem])
          setComposer('')
          setThinking(true)
          setDocError('')
          try {
            const result = await chatDoc({
              path,
              name,
              messages: history,
              prompt,
              ...(modelPick ? { provider: modelPick.provider, model: modelPick.model } : {}),
              ...(pickedSkills.length ? { skills: pickedSkills } : {}),
              selection: quote
                ? {
                    text: quote.text,
                    before: content.slice(Math.max(0, quote.start - 1500), quote.start),
                    after: content.slice(quote.end, quote.end + 1500),
                  }
                : null,
            }, docSessionRef.current || undefined)
            if (life.current !== owner) return
            if (flushEditor() !== base || version !== owner.version || stamp !== mtimeRef.current || owner.conflict) {
              flash(t('staleReply'))
              return
            }
            const reply = { id: 'a' + Date.now(), role: 'assistant', text: String(result.text || '') }
            const autoSkills = (Array.isArray(result.skills) ? result.skills : []).filter((item) => !pickedSkills.includes(item))
            if (autoSkills.length) reply.autoSkills = autoSkills
            if (result.kind === 'edit' && quote) {
              const replacement = String(reply.text || '')
              const deletedMark = !replacement
              const span = deletedMark ? sectionSpan(content, quote.start, quote.end) : null
              const applied = replacement
                ? {
                    next: content.slice(0, quote.start) + replacement + content.slice(quote.end),
                    start: quote.start,
                    block: false,
                  }
                : applyDeletion(content, span.start, span.end)
              const mark = {
                id: 'p' + Date.now(),
                text: replacement ? replacement : '',
                deleted: !replacement,
                block: applied.block === true,
                before: typeof applied.before === 'string' ? applied.before : quote.text,
                display: deletedMark ? ghostLabel(applied.before) : undefined,
                anchor: deletedMark
                  ? (content.slice(Math.max(0, applied.start - 40), applied.start).split('\n').filter(Boolean).pop() || '')
                  : undefined,
                start: applied.start,
                end: applied.start + (replacement ? replacement.length : 0),
              }
              setContent(applied.next)
              setPending((list) => [...list, mark].slice(-60))
              setSelection(null)
              const persisted = await writeFileNow(applied.next)
              if (life.current !== owner) return
              reply.text = ''
              reply.note = t(!persisted ? 'saveFailed' : deletedMark ? 'deleteAppliedNote' : 'editAppliedNote')
              reply.error = !persisted
            }
            setMessages((list) => [...list, reply])
          } catch (error) {
            if (life.current === owner) setMessages((list) => [...list, { id: 'e' + Date.now(), role: 'assistant', text: t('chatFailed') + '：' + error.message, error: true }])
          } finally {
            owner.thinking = false
            if (life.current === owner) setThinking(false)
          }
        }, [composer, selection, thinking, messages, path, name, content, t, modelPick, pickedSkills, writeFileNow])

        React.useEffect(() => {
          if (!open) return undefined
          const onKey = (event) => {
            if (event.key === 'Escape') {
              const target = event.target
              if (target && target.closest && target.closest('.dsp-root')) {
                setSelection(null)
              }
              return
            }
            if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
              const target = event.target
              if (!target || !target.closest || !target.closest('.dsp-root')) return
              event.preventDefault()
              save(false)
            }
          }
          window.addEventListener('keydown', onKey)
          return () => window.removeEventListener('keydown', onKey)
        }, [open, save])

        const filtered = (files || []).filter((file) => {
          if (!filter.trim()) return true
          const needle = filter.trim().toLowerCase()
          return file.path.toLowerCase().includes(needle) || file.name.toLowerCase().includes(needle)
        })

        const header = h(
          'header',
          { className: 'dsp-head' },
          h(
            'div',
            { className: 'dsp-head-main' },
            path
              ? h(IconButton, { title: t('files'), onClick: () => { if (leaveDocument()) loadFiles(folder) } }, h(BackIcon))
              : h(DocIcon),
            h(
              'div',
              { className: 'dsp-head-text' },
              h('div', { className: 'dsp-title' }, path ? name || path : t('panelTitle')),
              h(
                'div',
                { className: 'dsp-sub' },
                path
                  ? dirty
                    ? t('unsaved')
                    : mtime
                      ? t('saved')
                      : t('panelSub')
                  : t('panelSub'),
              ),
            ),
          ),
          h(
            'div',
            { className: 'dsp-head-actions' },
            path && session && docSession && docSession !== session
              ? h(
                  'button',
                  {
                    type: 'button',
                    className: 'dsp-follow-chip',
                    title: t('followHint'),
                    onClick: followSession,
                  },
                  t('followChip'),
                )
              : null,
            path && pending.length > 0
              ? h(
                  'button',
                  {
                    type: 'button',
                    className: 'dsp-pending-chip',
                    title: t('pendingClear'),
                    onClick: () => setPending([]),
                  },
                  t('pendingCount', pending.length),
                )
              : null,
            path
              ? h(
                  'div',
                  { className: 'dsp-seg', role: 'tablist' },
                  h(
                    'button',
                    {
                      type: 'button',
                      role: 'tab',
                      className: `dsp-seg-item${mode === 'source' ? ' dsp-seg-on' : ''}`,
                      'aria-selected': mode === 'source',
                      onClick: () => setMode('source'),
                    },
                    t('toSource'),
                  ),
                  h(
                    'button',
                    {
                      type: 'button',
                      role: 'tab',
                      className: `dsp-seg-item${mode === 'doc' ? ' dsp-seg-on' : ''}`,
                      'aria-selected': mode === 'doc',
                      onClick: () => setMode('doc'),
                    },
                    t('toDoc'),
                  ),
                )
              : h(IconButton, { title: t('refresh'), onClick: () => loadFiles(), disabled: listBusy }, h(RefreshIcon)),
            h(
              'div',
              { className: 'dsp-zoom', title: t('zoomHint') },
              h(
                'button',
                {
                  type: 'button',
                  className: 'dsp-zoom-btn',
                  disabled: zoom <= ZOOM_MIN,
                  title: t('zoomOut'),
                  'aria-label': t('zoomOut'),
                  onClick: () => nudgeZoom(-ZOOM_STEP),
                },
                '−',
              ),
              h(
                'button',
                {
                  type: 'button',
                  className: 'dsp-zoom-val',
                  title: t('zoomReset'),
                  onClick: () => applyZoom(1),
                },
                `${Math.round(zoom * 100)}%`,
              ),
              h(
                'button',
                {
                  type: 'button',
                  className: 'dsp-zoom-btn',
                  disabled: zoom >= ZOOM_MAX,
                  title: t('zoomIn'),
                  'aria-label': t('zoomIn'),
                  onClick: () => nudgeZoom(ZOOM_STEP),
                },
                '+',
              ),
            ),
            path
              ? h(TextButton, { onClick: () => save(false), disabled: !dirty || docBusy, primary: dirty, quiet: !dirty }, docBusy ? t('saving') : t('save'))
              : null,
          ),
        )

        let body
        if (!session) {
          body = h(
            'div',
            { className: 'dsp-body dsp-body-list' },
            h('div', { className: 'dsp-empty' }, t('noSession')),
          )
        } else if (docBusy && !path) {
          // V04: opening a document is a state of its own — a centred spinner
          // and a word, never a blank column while the file is read.
          body = h(
            'div',
            { className: 'dsp-body dsp-loading-page', role: 'status', 'aria-live': 'polite' },
            h('span', { className: 'dsp-spin' }),
            h('span', null, t('opening')),
          )
        } else if (!path) {
          body = h(
            'div',
            { className: 'dsp-body dsp-body-list' },
            h(
              'div',
              { className: 'dsp-list-head' },
              h('span', null, folder ? t('files') : t('recent')),
              h('span', { className: 'dsp-muted' }, files ? String(files.length) : ''),
              h(
                'span',
                { className: 'dsp-list-head-actions' },
                h(TextButton, { onClick: chooseFolder, title: t('openFolder') }, t('openFolder')),
                folder
                  ? h(
                      TextButton,
                      {
                        onClick: () => {
                          setFolder('')
                          setFilter('')
                        },
                        title: t('backToWorkspace'),
                      },
                      t('backToWorkspace'),
                    )
                  : null,
              ),
            ),
            folder
              ? h('div', { className: 'dsp-folder-path', title: folderRoot }, folderRoot || folder)
              : null,
            h(
              'div',
              { className: 'dsp-path-row' },
              h('input', {
                className: 'dsp-input dsp-filter',
                value: filter,
                placeholder: t('filterPlaceholder'),
                onChange: (event) => setFilter(event.target.value),
                onKeyDown: (event) => {
                  if (event.key !== 'Enter') return
                  event.preventDefault()
                  openAny(filter)
                },
              }),
              h(
                TextButton,
                {
                  onClick: () => openAny(filter),
                  disabled: !filter.trim(),
                  title: t('openPath'),
                },
                t('openPath'),
              ),
            ),
            filesError ? h('div', { className: 'dsp-error' }, `${t('loadFailed')}：${filesError}`) : null,
            !filesError && docError ? h('div', { className: 'dsp-error' }, `${t('openFailed')}：${docError}`) : null,
            !files && listBusy
              ? h(
                  'div',
                  { className: 'dsp-loading', role: 'status', 'aria-live': 'polite' },
                  h('div', { className: 'dsp-loading-line' }, h('span', { className: 'dsp-spin' }), h('span', null, t('loading'))),
                  h('div', { className: 'dsp-skel' }),
                  h('div', { className: 'dsp-skel' }),
                  h('div', { className: 'dsp-skel' }),
                )
              : null,
            files && !filtered.length
              ? h('div', { className: 'dsp-empty' }, files.length ? t('noMatch') : t('emptyList'))
              : null,
            h(
              'div',
              { className: 'dsp-file-list' },
              filtered.map((file) =>
                h(
                  'button',
                  { key: file.path, type: 'button', className: 'dsp-file', onClick: () => openFile(resolveEntry(file), file.name) },
                  h(DocIcon, { size: 15 }),
                  h(
                    'span',
                    { className: 'dsp-file-text' },
                    h('span', { className: 'dsp-file-name' }, file.name),
                    h('span', { className: 'dsp-file-dir' }, file.dir),
                  ),
                  h('span', { className: 'dsp-file-time' }, timeAgo(file.mtime, t)),
                ),
              ),
            ),
          )
        } else if (docError) {
          body = h(
            'div',
            { className: 'dsp-body' },
            h('div', { className: 'dsp-error dsp-error-block' }, docError),
            h(TextButton, { onClick: () => openFile(path, name) }, t('retry')),
          )
        } else if (mode === 'doc') {
          // The editing kernel owns the DOM once it is mounted; the fallback
          // below is the built-in `contentEditable` used when it cannot load.
          body = editorLib
            ? h('div', {
              key: 'dsp-doc-pm',
              ref: docRef,
              className: 'dsp-body dsp-preview dsp-wys dsp-pm',
              spellCheck: false,
              onMouseUp: trackPmSelection,
              onKeyUp: trackPmSelection,
              onPasteCapture: pmPaste,
              onMouseMove: trackGrip,
              onMouseLeave: leaveGrip,
              onClick: docClick,
            })
            : h('div', {
              key: 'dsp-doc-plain',
              ref: docRef,
              className: 'dsp-body dsp-preview dsp-wys',
              contentEditable: true,
              suppressContentEditableWarning: true,
              spellCheck: false,
              onInput: docInput,
              onKeyDown: docKeyDown,
              onPaste: docPaste,
              onMouseUp: trackDocSelection,
              onKeyUp: trackDocSelection,
              onClick: docClick,
              dangerouslySetInnerHTML: { __html: docHtml },
            })
        } else {
          body = h(
            'div',
            { className: 'dsp-body dsp-body-edit' },
            h(
              'div',
              { className: 'dsp-edit-wrap' },
              h(
                'pre',
                { ref: mirrorRef, className: 'dsp-edit-mirror', 'aria-hidden': 'true' },
                mirrorLines(content, { items: pending, hint: t('pendingHint') }),
              ),
              h('textarea', {
                ref: areaRef,
                className: 'dsp-editor',
                value: content,
                spellCheck: false,
                onChange: (event) => {
                  setContent(event.target.value)
                },
                onScroll: (event) => {
                  const mirror = mirrorRef.current
                  if (!mirror) return
                  mirror.scrollTop = event.target.scrollTop
                  mirror.scrollLeft = event.target.scrollLeft
                },
                onClick: releasePendingAtCaret,
                onSelect: trackSelection,
                onKeyUp: trackSelection,
                onMouseUp: trackSelection,
              }),
            ),
          )
        }

        // 工具条图标统一成 16px 线性 SVG（stroke 1.6、圆头圆角），不再混用字符与 emoji：
        // 字符的粗细/基线随字体变化，emoji 还带彩色，和飞书/Notion 的工具条观感差得最明显。
        const BAR_ICONS = {
          bold: [
            ['path', { d: 'M4.6 2.8h3.5c1.5 0 2.6 1.1 2.6 2.5s-1.1 2.5-2.6 2.5H4.6z' }],
            ['path', { d: 'M4.6 7.8h4.2c1.6 0 2.8 1.2 2.8 2.7s-1.2 2.7-2.8 2.7H4.6z' }],
          ],
          italic: [
            ['path', { d: 'M6.2 3.2h5.2' }],
            ['path', { d: 'M4.6 12.8h5.2' }],
            ['path', { d: 'M9.8 3.2 6.2 12.8' }],
          ],
          strike: [
            ['path', { d: 'M11.6 5.1C11.2 4 10 3.4 8.6 3.4 6.9 3.4 5.7 4.2 5.7 5.5c0 1.2 1 1.8 2.7 2.2 1.9.4 2.9 1.1 2.9 2.4 0 1.4-1.3 2.4-3.1 2.4-1.5 0-2.7-.6-3.2-1.7' }],
            ['path', { d: 'M2.8 8h10.4' }],
          ],
          code: [
            ['path', { d: 'M5.6 4.4 2.6 8l3 3.6' }],
            ['path', { d: 'M10.4 4.4 13.4 8l-3 3.6' }],
            ['path', { d: 'M9.2 3.2 6.8 12.8' }],
          ],
          link: [
            ['path', { d: 'M6.6 9.4a2.5 2.5 0 0 0 3.5 0l1.8-1.8a2.5 2.5 0 0 0-3.5-3.5l-1 1' }],
            ['path', { d: 'M9.4 6.6a2.5 2.5 0 0 0-3.5 0L4.1 8.4a2.5 2.5 0 0 0 3.5 3.5l1-1' }],
          ],
          quote: [
            ['path', { d: 'M13.2 9.1a1.9 1.9 0 0 1-1.9 1.9H6.6L3.6 13.6V4.6a1.9 1.9 0 0 1 1.9-1.9h5.8a1.9 1.9 0 0 1 1.9 1.9z' }],
            ['path', { d: 'M5.9 5.8h4.2' }],
            ['path', { d: 'M5.9 8.4h2.6' }],
          ],
          rowBefore: [
            ['path', { d: 'M2.8 3.2h10.4' }],
            ['path', { d: 'M8 13.2V6.6' }],
            ['path', { d: 'M5.6 9 8 6.6 10.4 9' }],
          ],
          rowAfter: [
            ['path', { d: 'M2.8 12.8h10.4' }],
            ['path', { d: 'M8 2.8v6.6' }],
            ['path', { d: 'M5.6 7 8 9.4 10.4 7' }],
          ],
          colBefore: [
            ['path', { d: 'M3.2 2.8v10.4' }],
            ['path', { d: 'M13.2 8H6.6' }],
            ['path', { d: 'M9 5.6 6.6 8 9 10.4' }],
          ],
          colAfter: [
            ['path', { d: 'M12.8 2.8v10.4' }],
            ['path', { d: 'M2.8 8h6.6' }],
            ['path', { d: 'M7 5.6 9.4 8 7 10.4' }],
          ],
          rowDelete: [
            ['path', { d: 'M2.8 4h10.4' }],
            ['path', { d: 'M5.8 7.6 10.2 12.4' }],
            ['path', { d: 'M10.2 7.6 5.8 12.4' }],
          ],
          colDelete: [
            ['path', { d: 'M4.4 2.8v10.4' }],
            ['path', { d: 'M7.8 5.8 12.2 10.2' }],
            ['path', { d: 'M12.2 5.8 7.8 10.2' }],
          ],
          header: [
            ['path', { d: 'M2.8 4.6h10.4v2.8H2.8z', fill: 'currentColor', stroke: 'none', opacity: 0.16 }],
            ['path', { d: 'M2.8 4.6h10.4v6.8H2.8z' }],
            ['path', { d: 'M2.8 7.4h10.4' }],
          ],
          tableDelete: [
            ['path', { d: 'M2.8 3.8h10.4v8.4H2.8z' }],
            ['path', { d: 'M2.8 6.6h10.4' }],
            ['path', { d: 'M6 9.2h4' }],
          ],
        }

        const barIcon = (name) =>
          h(
            'svg',
            {
              className: 'dsp-doc-bar-ico',
              viewBox: '0 0 16 16',
              width: 16,
              height: 16,
              fill: 'none',
              stroke: 'currentColor',
              strokeWidth: 1.6,
              strokeLinecap: 'round',
              strokeLinejoin: 'round',
              'aria-hidden': 'true',
              focusable: 'false',
            },
            (BAR_ICONS[name] || []).map(([tag, attrs], index) => h(tag, { key: index, ...attrs })),
          )

        const barButton = (key, label, content, onClick, active) =>
          h(
            'button',
            {
              key,
              type: 'button',
              className: `dsp-doc-bar-btn${active ? ' dsp-doc-bar-btn-on' : ''}`,
              title: label,
              'aria-label': label,
              onMouseDown: (event) => event.preventDefault(),
              onClick,
            },
            content,
          )

        const barNode = docBar
          ? h(
              'div',
              {
                ref: barNodeRef,
                className: 'dsp-doc-bar dsp-selection-bar',
                style: {
                  left: docBar.left + 'px',
                  top: docBar.top + 'px',
                  transform: docBar.above ? 'translateY(-100%)' : 'none',
                },
                onMouseDown: (event) => event.preventDefault(),
              },
              linkDraft === null
                ? null
                : h(
                    'span',
                    { key: 'link', className: 'dsp-doc-bar-link' },
                    h('input', {
                      className: 'dsp-doc-bar-input',
                      value: linkDraft,
                      autoFocus: true,
                      placeholder: 'https://',
                      onMouseDown: (event) => event.stopPropagation(),
                      onChange: (event) => setLinkDraft(event.target.value),
                      onKeyDown: (event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault()
                          applyBarLink()
                        } else if (event.key === 'Escape') {
                          event.preventDefault()
                          setLinkDraft(null)
                        }
                      },
                    }),
                    h(
                      'button',
                      { type: 'button', className: 'dsp-doc-bar-btn dsp-doc-bar-ok', onClick: applyBarLink },
                      t('barLinkApply'),
                    ),
                  ),
              linkDraft !== null
                ? null
                : docBar.hasText
                  ? [
                      barButton('bold', t('barBold'), barIcon('bold'), barRun((one) => one.toggleMark('strong')), docBar.marks.strong),
                      barButton('italic', t('barItalic'), barIcon('italic'), barRun((one) => one.toggleMark('em')), docBar.marks.em),
                      barButton('strike', t('barStrike'), barIcon('strike'), barRun((one) => one.toggleMark('strike')), docBar.marks.strike),
                      barButton('code', t('barCode'), barIcon('code'), barRun((one) => one.toggleMark('code')), docBar.marks.code),
                      h('span', { key: 'sepMark', className: 'dsp-doc-bar-sep' }),
                      barButton('link', t('barLink'), barIcon('link'), barLink, docBar.marks.link),
                      barButton('quote', t('barQuote'), barIcon('quote'), barQuote, false),
                    ]
                  : null,
              linkDraft === null && docBar.hasText && docBar.inTable
                ? h('span', { key: 'sep', className: 'dsp-doc-bar-sep' })
                : null,
              linkDraft !== null || !docBar.inTable
                ? null
                : [
                    barButton('rowBefore', t('tableRowBefore'), barIcon('rowBefore'), barRun((one) => one.tableCommand('rowBefore'))),
                    barButton('rowAfter', t('tableRowAfter'), barIcon('rowAfter'), barRun((one) => one.tableCommand('rowAfter'))),
                    barButton('colBefore', t('tableColBefore'), barIcon('colBefore'), barRun((one) => one.tableCommand('colBefore'))),
                    barButton('colAfter', t('tableColAfter'), barIcon('colAfter'), barRun((one) => one.tableCommand('colAfter'))),
                    barButton('rowDelete', t('tableRowDelete'), barIcon('rowDelete'), barRun((one) => one.tableCommand('deleteRow'))),
                    barButton('colDelete', t('tableColDelete'), barIcon('colDelete'), barRun((one) => one.tableCommand('deleteColumn'))),
                    barButton('header', t('tableHeader'), barIcon('header'), barRun((one) => one.tableCommand('headerRow'))),
                    barButton('tableDelete', t('tableDelete'), barIcon('tableDelete'), barRun((one) => one.tableCommand('deleteTable'))),
                  ],
            )
          : null

        const slashList = slashMenu ? filterSlashBlocks(t, slashMenu.query) : []
        const slashNode = slashMenu
          ? h(
              'div',
              {
                ref: slashNodeRef,
                className: 'dsp-slash-menu',
                style: { left: slashMenu.left + 'px', top: slashMenu.top + 'px' },
                onMouseDown: (event) => event.preventDefault(),
              },
              slashList.length
                ? slashList.map((item, index) =>
                    h(
                      'button',
                      {
                        key: item.kind,
                        type: 'button',
                        className: `dsp-slash-item${index === slashMenu.index ? ' dsp-slash-item-on' : ''}`,
                        onMouseDown: (event) => event.preventDefault(),
                        onClick: () => runSlashItem(item),
                      },
                      t(item.key),
                    ),
                  )
                : h('div', { className: 'dsp-slash-empty' }, t('slashEmpty')),
            )
          : null

        const gripNode = grip && editorLib && mode === 'doc'
          ? h(
              'div',
              {
                key: 'dsp-block-grip',
                ref: gripNodeRef,
                className: `dsp-block-grip${gripMenu ? ' dsp-block-grip-on' : ''}`,
                style: { left: grip.left + 'px', top: grip.top + 'px' },
                title: t('gripMenu'),
                contentEditable: false,
                onMouseDown: startGripDrag,
                onMouseEnter: () => {
                  if (gripHideRef.current) {
                    window.clearTimeout(gripHideRef.current)
                    gripHideRef.current = 0
                  }
                },
              },
              '⠿',
            )
          : null

        const gripMenuNode = gripMenu && editorLib
          ? h(
              'div',
              {
                key: 'dsp-block-menu',
                ref: gripMenuRef,
                className: 'dsp-slash-menu dsp-block-menu',
                style: { left: gripMenu.left + 'px', top: gripMenu.top + 'px' },
                onMouseDown: (event) => event.preventDefault(),
              },
              [
                ['gripUp', () => gripAction((one, at) => one.blockMove(at, 'up'))],
                ['gripDown', () => gripAction((one, at) => one.blockMove(at, 'down'))],
                ['gripCopy', () => gripAction((one, at) => one.blockCopy(at))],
                ['gripDelete', () => gripAction((one, at) => one.blockDelete(at))],
                ['slashParagraph', () => gripAction((one, at) => one.blockConvert(at, 'paragraph'))],
                ['slashH1', () => gripAction((one, at) => one.blockConvert(at, 'h1'))],
                ['slashH2', () => gripAction((one, at) => one.blockConvert(at, 'h2'))],
                ['slashH3', () => gripAction((one, at) => one.blockConvert(at, 'h3'))],
                ['slashQuote', () => gripAction((one, at) => one.blockConvert(at, 'quote'))],
                ['slashBullet', () => gripAction((one, at) => one.blockConvert(at, 'bullet'))],
                ['slashTodo', () => gripAction((one, at) => one.blockConvert(at, 'todo'))],
              ].map(([key, run]) =>
                h(
                  'button',
                  {
                    key,
                    type: 'button',
                    className: 'dsp-slash-item',
                    onMouseDown: (event) => event.preventDefault(),
                    onClick: run,
                  },
                  t(key),
                ),
              ),
            )
          : null

        const markMenuNode = markMenu
          ? h(
              'div',
              {
                className: 'dsp-mark-menu',
                style: { left: markMenu.left + 'px', top: markMenu.top + 'px' },
              },
              h('button', { type: 'button', className: 'dsp-mark-btn dsp-mark-accept', onClick: () => acceptMark(markMenu.id) }, t('markAccept')),
              typeof markMenu.item.before === 'string'
                ? h('button', { type: 'button', className: 'dsp-mark-btn', onClick: () => revertMark(markMenu.id) }, t('markRevert'))
                : null,
              markMenu.item && markMenu.item.deleted
                ? h('span', { className: 'dsp-mark-hint' }, t('markDeletedHint'))
                : h('button', { type: 'button', className: 'dsp-mark-btn', onClick: () => annotateMark(markMenu.item) }, t('markAnnotate')),
            )
          : null

        const aiBar = path && !docError
          ? h(
              'div',
              {
                className: messages.length || thinking ? 'dsp-chat' : 'dsp-chat dsp-chat-quiet',
                ref: chatRef,
                style: chatHeight && (messages.length || thinking) ? { height: chatHeight + 'px' } : undefined,
              },
              messages.length || thinking
                ? h('div', { className: 'dsp-chat-grip', onMouseDown: beginChatDrag, title: t('chatResize') })
                : null,
              messages.length || thinking
                ? h(
                'div',
                { className: 'dsp-chat-log' },
                messages.map((item) =>
                      h(
                        'div',
                        { key: item.id, className: `dsp-msg dsp-msg-${item.role}${item.error ? ' dsp-msg-error' : ''}` },
                        item.quote ? h('div', { className: 'dsp-msg-quote', title: item.quote }, item.quote) : null,
                        item.text
                          ? h(
                              'div',
                              { className: item.role === 'assistant' ? 'dsp-msg-body dsp-msg-md' : 'dsp-msg-body' },
                              item.role === 'assistant' ? renderMarkdown(item.text, t) : item.text,
                            )
                          : null,
                        item.note ? h('div', { className: 'dsp-msg-note' }, item.note) : null,
                        item.role === 'assistant' && !item.text && !item.note
                          ? h('div', { className: 'dsp-msg-note' }, t('emptyReply'))
                          : null,
                        item.autoSkills && item.autoSkills.length
                          ? h('div', { className: 'dsp-msg-note' }, t('skillsUsed', item.autoSkills.join('、')))
                          : null,
                      ),
                    ),
                thinking
                  ? h('div', { className: 'dsp-msg dsp-msg-assistant dsp-msg-pending' }, h('span', null, t('chatThinking')))
                  : null,
              )
                : null,
              h(
                'div',
                { className: 'dsp-composer' },
                selection
                  ? h(
                      'div',
                      { className: 'dsp-quote' },
                      h('span', { className: 'dsp-quote-text' }, selection.text.replace(/\s+/g, ' ').slice(0, 140)),
                      h(
                        'button',
                        { type: 'button', className: 'dsp-quote-x', title: t('quoteRemove'), onClick: () => setSelection(null) },
                        h(XIcon, { size: 15 }),
                      ),
                    )
                  : null,
                pickedSkills.length
                  ? h(
                      'div',
                      { className: 'dsp-tags' },
                      pickedSkills.map((name) =>
                        h(
                          'span',
                          { key: name, className: 'dsp-tag' },
                          h('span', { className: 'dsp-tag-text' }, name),
                          h(
                            'button',
                            {
                              type: 'button',
                              className: 'dsp-tag-x',
                              title: t('skillRemove'),
                              onClick: () => setPickedSkills((list) => list.filter((item) => item !== name)),
                            },
                            h(XIcon, { size: 11 }),
                          ),
                        ),
                      ),
                    )
                  : null,
                h('textarea', {
                  ref: composerRef,
                  className: 'dsp-chat-input',
                  rows: 1,
                  value: composer,
                  placeholder: selection ? t('chatPlaceholderQuote') : t('chatPlaceholder'),
                  onChange: (event) => setComposer(event.target.value),
                  onKeyDown: (event) => {
                    if (event.key === 'Enter' && !event.shiftKey) {
                      event.preventDefault()
                      sendChat()
                    }
                  },
                }),
                h(
                  'div',
                  { className: 'dsp-tools' },
                  h(
                    'button',
                    {
                      type: 'button',
                      className: menu === 'model' ? 'dsp-tool dsp-tool-on' : 'dsp-tool',
                      title: t('modelHint'),
                      onClick: () => setMenu(menu === 'model' ? '' : 'model'),
                    },
                    h('span', { className: 'dsp-tool-label' }, modelLabel()),
                    h(CaretIcon, { size: 13, className: 'dsp-caret' }),
                  ),
                  h(
                    'button',
                    {
                      type: 'button',
                      className: menu === 'skill' ? 'dsp-tool dsp-tool-on' : 'dsp-tool',
                      title: t('skillHint'),
                      onClick: () => setMenu(menu === 'skill' ? '' : 'skill'),
                    },
                    h(
                      'span',
                      { className: 'dsp-tool-label' },
                      pickedSkills.length ? t('skillPickCount', pickedSkills.length) : t('skillPick'),
                    ),
                    h(CaretIcon, { size: 13, className: 'dsp-caret' }),
                  ),
                  h('span', { className: 'dsp-tools-gap' }),
                  h(
                    'button',
                    {
                      type: 'button',
                      className: 'dsp-chat-send',
                      title: t('chatSend'),
                      disabled: thinking || (!composer.trim() && !selection),
                      onClick: () => sendChat(),
                    },
                    thinking ? h('span', { className: 'dsp-spin' }) : h(SendIcon, { size: 20, strokeWidth: 2.2 }),
                  ),
                ),
                menu === 'model' ? renderModelMenu() : null,
                menu === 'skill' ? renderSkillMenu() : null,
              ),
            )
          : null

        const conflictBar = conflict
          ? h(
              'div',
              { className: 'dsp-banner dsp-banner-warn' },
              h('span', null, t('conflict')),
              h(TextButton, { primary: true, onClick: () => save(true) }, t('overwrite')),
              h(
                TextButton,
                {
                  quiet: true,
                  onClick: () => {
                    flushEditor()
                    adoptDisk(conflict)
                    setPending([])
                  },
                },
                t('loadLatest'),
              ),
            )
          : null

        return h(
          'div',
          {
            className: 'dsp-root dsp-dock',
            'data-dsh-doc-pane': 'panel',
            ref: rootRef,
            // A unitless factor consumed by the document surfaces only: scaling
            // the whole frame with CSS `zoom` would overflow the column.
            style: { '--dsp-zoom': String(zoom) },
          },
          header,
          notice ? h('div', { className: 'dsp-banner' }, notice) : null,
          conflictBar,
          body,
          barNode,
          slashNode,
          gripNode,
          gripMenuNode,
          markMenuNode,
          aiBar,
        )
      }
    }

    function makeToggle(t, ctx) {
      return function DocPaneToggle(props) {
        return h(
          'button',
          {
            type: 'button',
            className: 'dsp-toggle',
            title: t('openButton'),
            'aria-label': t('openButton'),
            onClick: async () => {
              const right = service(ctx, 'sidebarRight')
              if (!right || typeof right.openTab !== 'function') {
                console.error('dsh-doc-pane: sidebarRight is unavailable')
                return
              }
              // The header button is the browsing entry: the panel shows the
              // document list, not a file it happens to have open.
              try {
                await right.openTab(TAB_KIND, { params: { browse: true } })
              } catch (error) {
                console.error('dsh-doc-pane: openTab failed', error)
              }
            },
          },
          h(DocIcon, { size: 16 }),
        )
      }
    }

    /* ------------------------------------------------------------------ */
    /* styles                                                              */
    /* ------------------------------------------------------------------ */

    const CSS = `
.dsp-root {
  /* A paper surface of its own: the panel stays white in every theme, the way a
     document reader is expected to look. Re-declaring the theme tokens here
     keeps every nested rule (inputs, borders, code cards, diff marks) on the
     same palette instead of inheriting a dark theme's light-on-dark text. */
  --dsw-alias-bg-base: #ffffff;
  --dsw-alias-bg-layer-1: #ffffff;
  --dsw-alias-bg-layer-2: #f5f6f7;
  --dsw-alias-bg-overlay: #ffffff;
  --dsw-alias-border-l1: #e6e8eb;
  --dsw-alias-border-l2: #d6d9df;
  --dsw-alias-label-primary: #1f2329;
  --dsw-alias-label-secondary: #646a73;
  --dsw-alias-brand-primary: #3370ff;
  --dsw-alias-state-error-primary: #d83931;
  --dsw-alias-state-success-primary: #2ea121;
  --dsw-alias-state-warn-primary: #de7802;
  --dsw-alias-state-idle-primary: #8f959e;
  /* V01: the white paper stays exactly as it is, but it is framed as a card the
     panel deliberately lays down, so the step from a dark host to this surface
     reads as an edge instead of a leak. One border, one shadow, one radius
     scale (--dsp-r-card / --dsp-r-ctl) shared by everything below. */
  --dsp-card-line: #2a2d33;
  --dsp-r-card: 12px;
  --dsp-r-ctl: 6px;
  --dsp-ctl-h: 26px;
  /* V03: one palette for every "pending suggestion" surface. The fill is deep
     enough to reach ~1.31:1 against the white paper (the old #fff3d1 sat at
     ~1.1:1 and needed effort to see). */
  --dsp-pending-bg: #f7dc9e;
  --dsp-pending-line: #e5a93c;
  --dsp-pending-ink: #7a5a12;
  background: var(--dsw-alias-bg-base);
  color-scheme: light;
  /* V01 (A): the paper stays white, but it is now a card laid on the host —
     5px of margin, a 12px radius, a hairline that matches the dark host it is
     most often framed by, and a medium shadow so the edge reads as an edge
     instead of a leak. No token changes, no dark branch: pure CSS, reversible. */
  margin: 5px;
  border: 1px solid var(--dsp-card-line);
  border-radius: var(--dsp-r-card);
  box-shadow: 0 8px 28px rgba(0, 0, 0, 0.22), 0 1px 2px rgba(0, 0, 0, 0.16);
  box-sizing: border-box;
  position: relative;
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  pointer-events: auto;
  color: var(--dsw-alias-label-primary);
  font-size: 13px;
  line-height: 1.6;
  -webkit-font-smoothing: antialiased;
}
.dsp-head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 9px 12px;
  border-bottom: 1px solid var(--dsw-alias-border-l1);
  flex: none;
  min-height: 44px;
  box-sizing: border-box;
}
.dsp-head-main {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  flex: 1;
}
.dsp-head-text { min-width: 0; flex: 1; }
.dsp-head-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: none;
}
.dsp-seg {
  display: inline-flex;
  align-items: center;
  height: var(--dsp-ctl-h);
  padding: 2px;
  border-radius: 8px;
  background: var(--dsw-alias-bg-layer-2);
  border: 1px solid var(--dsw-alias-border-l1);
  box-sizing: border-box;
}
.dsp-seg-item {
  display: inline-flex;
  align-items: center;
  height: 20px;
  padding: 0 10px;
  border: none;
  border-radius: var(--dsp-r-ctl);
  background: transparent;
  color: var(--dsw-alias-label-secondary);
  font-size: 12px;
  font-family: inherit;
  cursor: pointer;
}
.dsp-seg-item:hover { color: var(--dsw-alias-label-primary); }
.dsp-seg-on {
  background: var(--dsw-alias-bg-base);
  color: var(--dsw-alias-label-primary);
  font-weight: 600;
  box-shadow: 0 1px 2px rgba(31, 35, 41, 0.12);
}
.dsp-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--dsw-alias-label-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.dsp-sub {
  font-size: 11px;
  color: var(--dsw-alias-label-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
}
.dsp-head-actions { display: flex; align-items: center; gap: 6px; flex: none; }
.dsp-zoom {
  display: inline-flex;
  align-items: center;
  gap: 1px;
  height: var(--dsp-ctl-h);
  padding: 2px;
  border: 1px solid var(--dsw-alias-border-l1);
  border-radius: 8px;
  background: var(--dsw-alias-bg-layer-2);
  box-sizing: border-box;
}
.dsp-zoom-btn {
  width: 22px;
  height: 20px;
  border: 0;
  border-radius: var(--dsp-r-ctl);
  background: transparent;
  color: var(--dsw-alias-label-secondary);
  font-size: 13px;
  line-height: 1;
  cursor: pointer;
  padding: 0;
}
.dsp-zoom-btn:hover:not(:disabled) { background: var(--dsw-alias-bg-base); color: var(--dsw-alias-label-primary); }
.dsp-zoom-btn:disabled { opacity: 0.35; cursor: default; }
.dsp-zoom-val {
  min-width: 38px;
  height: 20px;
  border: 0;
  border-radius: var(--dsp-r-ctl);
  background: transparent;
  color: var(--dsw-alias-label-secondary);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  cursor: pointer;
  padding: 0 2px;
}
.dsp-zoom-val:hover { background: var(--dsw-alias-bg-base); color: var(--dsw-alias-label-primary); }
.dsp-icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: var(--dsp-ctl-h);
  height: var(--dsp-ctl-h);
  padding: 0;
  border: 0;
  border-radius: var(--dsp-r-ctl);
  background: transparent;
  color: var(--dsw-alias-label-secondary);
  cursor: pointer;
}
.dsp-icon-btn:hover:not(:disabled) { background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-label-primary); }
.dsp-icon-btn:disabled { opacity: 0.4; cursor: default; }
.dsp-icon-btn-active { color: var(--dsw-alias-brand-primary); }
.dsp-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: var(--dsp-ctl-h);
  padding: 0 10px;
  border-radius: var(--dsp-r-ctl);
  border: 1px solid var(--dsw-alias-border-l1);
  background: var(--dsw-alias-bg-layer-2);
  color: var(--dsw-alias-label-primary);
  font-size: 12px;
  font-family: inherit;
  cursor: pointer;
  white-space: nowrap;
  box-sizing: border-box;
}
.dsp-btn:hover:not(:disabled) { border-color: var(--dsw-alias-border-l2); }
.dsp-btn:disabled { opacity: 0.45; cursor: default; }
.dsp-btn-primary {
  background: var(--dsw-alias-brand-primary);
  border-color: var(--dsw-alias-brand-primary);
  color: #fff;
}
.dsp-btn-quiet { background: transparent; border-color: transparent; color: var(--dsw-alias-label-secondary); }
.dsp-btn-quiet:hover:not(:disabled) { color: var(--dsw-alias-label-primary); background: var(--dsw-alias-bg-layer-2); }
.dsp-body { flex: 1; min-height: 0; overflow: auto; display: flex; flex-direction: column; }
.dsp-body-list { padding: 10px; gap: 8px; }
.dsp-body-edit { padding: 0; }
.dsp-edit-wrap { position: relative; flex: 1; min-height: 0; }
.dsp-edit-wrap .dsp-editor { position: absolute; inset: 0; width: 100%; height: 100%; z-index: 1; }
.dsp-edit-mirror {
  position: absolute;
  inset: 0;
  z-index: 0;
  margin: 0;
  border: 0;
  box-sizing: border-box;
  padding: 12px 14px 16px;
  overflow: hidden;
  pointer-events: none;
  color: transparent;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: calc(12.5px * var(--dsp-zoom, 1));
  line-height: 1.7;
  tab-size: 2;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.dsp-edit-mirror mark.dsp-pending {
  background: var(--dsp-pending-bg);
  border-radius: 3px;
  box-shadow: inset 2px 0 0 var(--dsp-pending-line);
}
.dsp-list-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 11px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--dsw-alias-label-secondary);
  padding: 2px 2px 0;
}
.dsp-muted { color: var(--dsw-alias-label-secondary); font-size: 11px; }
.dsp-list-head-actions { display: flex; align-items: center; gap: 6px; margin-left: auto; text-transform: none; letter-spacing: 0; }
.dsp-list-head-actions .dsp-btn { height: 24px; padding: 0 8px; font-size: 11.5px; }
.dsp-folder-path {
  font-size: 11px;
  color: var(--dsw-alias-label-secondary);
  direction: rtl;
  text-align: left;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  padding: 0 2px;
}
.dsp-path-row { display: flex; align-items: center; gap: 6px; }
.dsp-path-row .dsp-input { flex: 1; min-width: 0; }
.dsp-path-row .dsp-btn { flex: none; height: 28px; }
.dsp-input {
  width: 100%;
  box-sizing: border-box;
  height: 28px;
  padding: 0 9px;
  border-radius: 7px;
  border: 1px solid var(--dsw-alias-border-l1);
  background: var(--dsw-alias-bg-base);
  color: var(--dsw-alias-label-primary);
  font-family: inherit;
  font-size: 12px;
  outline: none;
}
.dsp-input:focus { border-color: var(--dsw-alias-brand-primary); }
.dsp-input:disabled { opacity: 0.55; }
.dsp-file-list { display: flex; flex-direction: column; gap: 2px; }
.dsp-file {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 7px 8px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--dsw-alias-label-primary);
  text-align: left;
  font-family: inherit;
  font-size: 12px;
  cursor: pointer;
  min-width: 0;
}
.dsp-file:hover { background: var(--dsw-alias-bg-layer-2); }
.dsp-file svg { flex: none; color: var(--dsw-alias-label-secondary); }
.dsp-file-text { display: flex; flex-direction: column; min-width: 0; flex: 1; }
.dsp-file-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 500; }
.dsp-file-dir { font-size: 10.5px; color: var(--dsw-alias-label-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dsp-file-time { flex: none; font-size: 10.5px; color: var(--dsw-alias-label-secondary); }
.dsp-empty { padding: 18px 10px; text-align: center; color: var(--dsw-alias-label-secondary); font-size: 12px; }
/* V04: loading is its own state — spinner plus skeleton rows, never the same
   single grey line as "empty" or "no match". */
.dsp-loading {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 16px 10px;
  color: var(--dsw-alias-label-secondary);
  font-size: 12px;
}
.dsp-loading-line {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}
.dsp-skel {
  height: 34px;
  border-radius: var(--dsp-r-ctl);
  background: linear-gradient(90deg, #f2f3f5 25%, #e9ebef 37%, #f2f3f5 63%);
  background-size: 400% 100%;
  animation: dsp-skel 1.4s ease infinite;
}
@keyframes dsp-skel {
  0% { background-position: 100% 50%; }
  100% { background-position: 0 50%; }
}
.dsp-loading-page {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 24px;
  color: var(--dsw-alias-label-secondary);
  font-size: 12px;
}
.dsp-error { color: var(--dsw-alias-state-error-primary); font-size: 12px; padding: 4px 2px; }
.dsp-error-block { padding: 14px 12px; }
.dsp-banner {
  flex: none;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  font-size: 11.5px;
  background: color-mix(in srgb, var(--dsw-alias-state-success-primary) 16%, transparent);
  color: var(--dsw-alias-label-primary);
  border-bottom: 1px solid var(--dsw-alias-border-l1);
}
.dsp-banner-warn { background: color-mix(in srgb, var(--dsw-alias-state-warn-primary) 18%, transparent); }
.dsp-banner span { flex: 1; }
.dsp-editor {
  flex: 1;
  min-height: 0;
  width: 100%;
  box-sizing: border-box;
  resize: none;
  border: 0;
  outline: none;
  padding: 12px 14px 16px;
  background: transparent;
  color: var(--dsw-alias-label-primary);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: calc(12.5px * var(--dsp-zoom, 1));
  line-height: 1.7;
  tab-size: 2;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.dsp-preview {
  padding: 16px 22px 36px;
  font-size: calc(14px * var(--dsp-zoom, 1));
  line-height: 1.82;
  color: #1f2329;
}
.dsp-preview > *:first-child { margin-top: 0; }
/* The preview body is a flex column, and an item that scrolls horizontally has
   an automatic minimum size of zero — so a wide table was being squeezed down to
   its two borders whenever the document was taller than the panel. */
.dsp-preview > * { flex: none; }
.dsp-preview mark.dsp-pending {
  color: inherit;
  background: var(--dsp-pending-bg);
  border-radius: 3px;
  padding: 0 1px;
  box-shadow: inset 0 -1px 0 var(--dsp-pending-line);
  cursor: pointer;
  transition: background 140ms ease;
}
.dsp-preview mark.dsp-pending:hover { background: #efcf85; }
.dsp-preview .dsp-pending-block {
  background: var(--dsp-pending-bg);
  box-shadow: inset 3px 0 0 var(--dsp-pending-line);
  border-radius: var(--dsp-r-ctl);
  padding: 2px 10px;
  cursor: pointer;
}
.dsp-preview .dsp-pending-block:hover { background: #efcf85; }
.dsp-follow-chip {
  flex: none;
  display: inline-flex;
  align-items: center;
  height: var(--dsp-ctl-h);
  padding: 0 10px;
  border: 1px solid #cfe0ff;
  border-radius: 999px;
  background: #f2f6ff;
  color: #2a5bd7;
  font-size: 12px;
  cursor: pointer;
}
.dsp-follow-chip:hover { background: #e6eeff; border-color: #b6cbff; }
.dsp-preview .dsp-ghost {
  color: #b0463c;
  background: #fdecea;
  border-radius: 3px;
  padding: 0 2px;
  text-decoration: line-through;
  text-decoration-thickness: 1px;
  cursor: pointer;
}
.dsp-preview .dsp-ghost:hover { background: #fadbd8; }
.dsp-ghost-block {
  margin: calc(4px * var(--dsp-zoom, 1)) 0;
  line-height: 1.6;
}
.dsp-mark-hint {
  font-size: calc(11.5px * var(--dsp-zoom, 1));
  color: var(--dsw-alias-label-secondary);
  padding: 2px 6px;
  max-width: calc(200px * var(--dsp-zoom, 1));
}
.dsp-wys {
  outline: none;
  caret-color: #1f2329;
  cursor: text;
}
.dsp-wys:focus,
.dsp-wys:focus-visible { outline: none; }
.dsp-wys .dsp-code-bar { user-select: none; }
.dsp-wys p,
.dsp-wys h1,
.dsp-wys h2,
.dsp-wys h3,
.dsp-wys h4,
.dsp-wys h5,
.dsp-wys h6 { min-height: 1em; }
.dsp-wys .dsp-code-copy { cursor: pointer; }
/* The editing kernel's surface: same typography, its own caret. */
.dsp-body .ProseMirror {
  position: relative;
  outline: none;
  min-height: 100%;
  padding: 0;
  word-wrap: break-word;
  white-space: break-spaces;
  font-variant-ligatures: none;
  caret-color: #1f2329;
}
.dsp-body .ProseMirror > *:first-child { margin-top: 0; }
.dsp-body .ProseMirror .dsp-code { white-space: pre-wrap; }
.dsp-body .ProseMirror .dsp-md-table { table-layout: fixed; }
.dsp-body .ProseMirror .dsp-md-table th,
.dsp-body .ProseMirror .dsp-md-table td {
  position: relative;
  word-break: break-word;
  min-width: calc(72px * var(--dsp-zoom, 1));
  padding: calc(8px * var(--dsp-zoom, 1)) calc(10px * var(--dsp-zoom, 1));
}
.dsp-body .ProseMirror .selectedCell:after {
  content: '';
  position: absolute;
  inset: 0;
  z-index: 2;
  pointer-events: none;
  background: rgba(51, 112, 255, 0.12);
}
.dsp-body .ProseMirror .column-resize-handle {
  position: absolute;
  top: 0;
  right: -2px;
  bottom: -2px;
  width: 4px;
  pointer-events: none;
  background: #3370ff;
}
.dsp-body .ProseMirror .dsp-md-p { white-space: inherit; }
.dsp-body .ProseMirror [contenteditable="false"] { white-space: normal; }
.dsp-body .ProseMirror .ProseMirror-gapcursor { display: none; }
.dsp-body .ProseMirror-selectednode { outline: 2px solid var(--dsw-alias-brand-primary); }
.dsp-md-table td .dsp-md-p,
.dsp-md-table th .dsp-md-p { margin: 0; white-space: inherit; }
.dsp-md-table th,
.dsp-md-table td { vertical-align: top; }
.dsp-pending-chip {
  border: 1px solid var(--dsp-pending-line);
  background: var(--dsp-pending-bg);
  color: var(--dsp-pending-ink);
  border-radius: 999px;
  height: var(--dsp-ctl-h);
  padding: 0 10px;
  font-size: 12px;
  font-family: inherit;
  line-height: 1;
  cursor: pointer;
  white-space: nowrap;
  box-sizing: border-box;
}
.dsp-pending-chip:hover { background: #efcf85; }
.dsp-preview a { color: var(--dsw-alias-brand-primary); text-decoration: none; }
.dsp-preview a:hover { text-decoration: underline; }
.dsp-md-h { font-weight: 700; line-height: 1.4; margin: 20px 0 8px; letter-spacing: -0.01em; }
.dsp-md-h1 { font-size: 1.57em; margin-top: 10px; }
.dsp-md-h2 { font-size: 1.29em; }
.dsp-md-h3 { font-size: 1.11em; }
.dsp-md-h4, .dsp-md-h5, .dsp-md-h6 { font-size: 1em; }
.dsp-md-p { margin: 8px 0; white-space: pre-wrap; }
/* V02: a list item's own paragraph must not bring paragraph spacing with it,
   or three items read as three paragraphs (10 + 10 + 5 = 25px apart). */
.dsp-md-list li > .dsp-md-p,
.dsp-md-list li > p { margin: 0; }
.dsp-md-code {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: calc(0.86em);
  padding: 1px 5px;
  border-radius: 5px;
  border: 1px solid var(--dsw-alias-border-l1);
  background: var(--dsw-alias-bg-layer-2);
}
.dsp-code {
  margin: 12px 0;
  border: 1px solid #eceef2;
  border-radius: 10px;
  overflow: hidden;
  background: #f7f8fa;
}
.dsp-code-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 5px 10px;
  border-bottom: 1px solid #eceef2;
  background: #eff1f5;
  color: #646a73;
  font-size: 11.5px;
}
.dsp-code-lang { letter-spacing: 0.02em; font-size: 0.94em; }
.dsp-code-copy {
  appearance: none;
  border: 0;
  border-radius: 5px;
  padding: 2px 7px;
  background: transparent;
  color: inherit;
  font: inherit;
  cursor: pointer;
}
.dsp-code-copy:hover { background: var(--dsw-alias-bg-base); color: var(--dsw-alias-label-primary); }
.dsp-code-pre {
  margin: 0;
  padding: 10px 12px;
  overflow-x: auto;
  background: transparent;
  font-size: calc(0.87em);
  line-height: 1.65;
  tab-size: 2;
}
.dsp-code-pre code {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  white-space: pre;
}
.dsp-md-quote {
  margin: 12px 0;
  padding: 8px 12px;
  border-left: 3px solid var(--dsw-alias-border-l2);
  border-radius: 0 8px 8px 0;
  background: var(--dsw-alias-bg-layer-1);
  color: var(--dsw-alias-label-secondary);
}
.dsp-md-list { margin: 8px 0; padding-left: 22px; }
.dsp-md-list li { margin: 2px 0; }
.dsp-md-list li::marker { color: var(--dsw-alias-label-secondary); }
.dsp-md-indent-1 { margin-left: 14px; }
.dsp-md-indent-2 { margin-left: 28px; }
.dsp-md-indent-3 { margin-left: 42px; }
.dsp-md-task { list-style: none; display: flex; align-items: flex-start; gap: 6px; margin-left: -18px; }
.dsp-md-check {
  flex: none;
  width: 14px;
  height: 14px;
  margin-top: 3px;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 4px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  line-height: 1;
  color: #fff;
}
.dsp-md-check-on { border-color: var(--dsw-alias-brand-primary); background: var(--dsw-alias-brand-primary); }
/* In the editing kernel the box sits inside the item's paragraph. */
.dsp-md-task p > .dsp-md-check { margin-right: 6px; vertical-align: -2px; cursor: pointer; user-select: none; }
.dsp-md-task p > .dsp-md-check:hover { border-color: var(--dsw-alias-brand-primary); }
.dsp-md-hr { border: 0; border-top: 1px solid var(--dsw-alias-border-l1); margin: 18px 0; }
.dsp-md-tablewrap {
  margin: 12px 0;
  overflow-x: auto;
  border: 1px solid var(--dsw-alias-border-l1);
  border-radius: 8px;
}
.dsp-md-table { border-collapse: collapse; width: 100%; font-size: 0.89em; }
.dsp-md-table th,
.dsp-md-table td {
  padding: 7px 10px;
  text-align: left;
  border-bottom: 1px solid var(--dsw-alias-border-l1);
}
.dsp-md-table th {
  background: var(--dsw-alias-bg-layer-2);
  border-bottom-color: var(--dsw-alias-border-l2);
  font-weight: 600;
}
.dsp-md-table tbody tr:last-child td { border-bottom: 0; }
.dsp-md-table tbody tr:nth-child(even) td { background: var(--dsw-alias-bg-layer-1); }
.dsp-md-figure { margin: 12px 0; }
.dsp-md-image { display: block; max-width: 100%; border-radius: 8px; }
.dsp-md-caption {
  margin-top: 6px;
  text-align: center;
  font-size: 11.5px;
  color: var(--dsw-alias-label-secondary);
}
.dsp-chat {
  flex: none;
  max-height: 62%;
  min-height: calc(150px * var(--dsp-zoom, 1));
  display: flex;
  flex-direction: column;
  border-top: 1px solid #e6e8eb;
  background: #f7f8fa;
  padding-top: calc(6px * var(--dsp-zoom, 1));
  gap: calc(6px * var(--dsp-zoom, 1));
  position: relative;
}
.dsp-chat-grip {
  position: absolute;
  top: -3px;
  left: 0;
  right: 0;
  height: 7px;
  cursor: ns-resize;
}
.dsp-chat-grip::after {
  content: '';
  position: absolute;
  top: 3px;
  left: 50%;
  width: 26px;
  height: 2px;
  margin-left: -13px;
  border-radius: 1px;
  background: #dcdfe6;
  transition: background 120ms ease;
}
.dsp-chat-grip:hover::after { background: #b6bcc6; }
.dsp-chat-log {
  flex: 1;
  min-height: 0;
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: calc(8px * var(--dsp-zoom, 1));
  padding: 0 calc(12px * var(--dsp-zoom, 1));
}
.dsp-chat-quiet { min-height: 0; }
.dsp-msg {
  display: flex;
  flex-direction: column;
  gap: calc(4px * var(--dsp-zoom, 1));
  font-size: calc(13.5px * var(--dsp-zoom, 1));
  line-height: 1.78;
}
.dsp-msg-user { align-items: flex-end; }
.dsp-msg-body {
  white-space: pre-wrap;
  word-break: break-word;
  max-width: 88%;
  border-radius: calc(11px * var(--dsp-zoom, 1));
  padding: calc(6px * var(--dsp-zoom, 1)) calc(10px * var(--dsp-zoom, 1));
}
.dsp-msg-user .dsp-msg-body {
  background: #eaf1ff;
  color: #1f2329;
  border: 1px solid #d8e4ff;
}
.dsp-msg-assistant .dsp-msg-body { background: transparent; padding: 0 2px; max-width: 100%; }
.dsp-msg-error .dsp-msg-body { color: #d83931; background: #fdf3f2; border: 1px solid #f7dedb; }
.dsp-msg-note { font-size: calc(12px * var(--dsp-zoom, 1)); color: var(--dsw-alias-label-secondary); padding: 2px 2px; }
.dsp-msg-quote {
  font-size: calc(12px * var(--dsp-zoom, 1));
  color: #646a73;
  background: #f2f3f5;
  border-left: 2px solid #c9cdd4;
  border-radius: 4px;
  padding: 3px 7px;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.dsp-msg-pending {
  flex-direction: row;
  align-items: center;
  gap: 6px;
  color: var(--dsw-alias-label-secondary);
  font-size: calc(12px * var(--dsp-zoom, 1));
}
.dsp-quote {
  display: flex;
  align-items: center;
  gap: 6px;
  border: 1px solid #e2e6ec;
  border-left: 3px solid #3370ff;
  background: #f5f7fa;
  border-radius: 8px;
  padding: calc(6px * var(--dsp-zoom, 1)) calc(6px * var(--dsp-zoom, 1)) calc(6px * var(--dsp-zoom, 1)) calc(10px * var(--dsp-zoom, 1));
  font-size: calc(13px * var(--dsp-zoom, 1));
  color: #3a3f46;
}
.dsp-quote-text { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dsp-quote-x {
  flex: none;
  border: 0;
  background: transparent;
  color: #646a73;
  cursor: pointer;
  width: calc(26px * var(--dsp-zoom, 1));
  height: calc(26px * var(--dsp-zoom, 1));
  margin: -2px -3px -2px 0;
  border-radius: 6px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.dsp-quote-x:hover { color: #1f2329; background: #e4e9f0; }
.dsp-composer {
  position: relative;
  flex: none;
  display: flex;
  flex-direction: column;
  gap: calc(6px * var(--dsp-zoom, 1));
  margin: 0 calc(10px * var(--dsp-zoom, 1)) calc(10px * var(--dsp-zoom, 1));
  padding: calc(8px * var(--dsp-zoom, 1)) calc(8px * var(--dsp-zoom, 1)) calc(6px * var(--dsp-zoom, 1));
  border: 1px solid #e2e5ea;
  border-radius: calc(12px * var(--dsp-zoom, 1));
  background: #ffffff;
  box-shadow: 0 6px 18px rgba(31, 35, 41, 0.08);
}
.dsp-composer:focus-within { border-color: #b6cbff; box-shadow: 0 6px 20px rgba(51, 112, 255, 0.14); }
.dsp-chat-input {
  flex: 1;
  min-height: calc(38px * var(--dsp-zoom, 1));
  max-height: calc(150px * var(--dsp-zoom, 1));
  resize: none;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--dsw-alias-label-primary);
  font-family: inherit;
  font-size: calc(13.5px * var(--dsp-zoom, 1));
  line-height: 1.7;
  padding: calc(2px * var(--dsp-zoom, 1)) calc(4px * var(--dsp-zoom, 1));
  outline: none;
  overflow-y: auto;
}
.dsp-chat-input::placeholder { color: #a9aeb8; }
.dsp-tools {
  display: flex;
  align-items: center;
  gap: calc(4px * var(--dsp-zoom, 1));
}
.dsp-tools-gap { flex: 1; }
.dsp-tool {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  border: 1px solid transparent;
  background: transparent;
  color: #646a73;
  border-radius: 7px;
  padding: calc(3px * var(--dsp-zoom, 1)) calc(7px * var(--dsp-zoom, 1));
  font-family: inherit;
  font-size: calc(12px * var(--dsp-zoom, 1));
  cursor: pointer;
  max-width: 62%;
}
.dsp-tool:hover { background: #f2f4f7; color: #1f2329; }
.dsp-tool-on { background: #eef3ff; border-color: #d6e2ff; color: #1a47c9; }
.dsp-tool-label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dsp-caret { flex: none; opacity: 0.62; transition: transform 140ms ease; }
.dsp-tool-on .dsp-caret { opacity: 0.9; transform: rotate(180deg); }
.dsp-pop {
  position: absolute;
  bottom: calc(100% + 8px);
  left: calc(8px * var(--dsp-zoom, 1));
  min-width: calc(210px * var(--dsp-zoom, 1));
  max-width: calc(300px * var(--dsp-zoom, 1));
  max-height: calc(262px * var(--dsp-zoom, 1));
  overflow: auto;
  padding: 5px;
  border: 1px solid #e2e5ea;
  border-radius: 10px;
  background: #ffffff;
  box-shadow: 0 12px 32px rgba(31, 35, 41, 0.16);
  z-index: 6;
}
.dsp-pop-group {
  padding: calc(6px * var(--dsp-zoom, 1)) calc(8px * var(--dsp-zoom, 1)) calc(2px * var(--dsp-zoom, 1));
  font-size: calc(11px * var(--dsp-zoom, 1));
  color: #8f959e;
}
.dsp-pop-item {
  display: flex;
  align-items: center;
  gap: 7px;
  width: 100%;
  border: 0;
  background: transparent;
  color: #1f2329;
  text-align: left;
  padding: calc(6px * var(--dsp-zoom, 1)) calc(8px * var(--dsp-zoom, 1));
  border-radius: 7px;
  font-family: inherit;
  font-size: calc(12.5px * var(--dsp-zoom, 1));
  cursor: pointer;
}
.dsp-pop-item:hover { background: #f2f4f7; }
.dsp-pop-item-on { background: #eef3ff; color: #1a47c9; }
.dsp-pop-main { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dsp-pop-sub { flex: none; font-size: calc(11px * var(--dsp-zoom, 1)); color: #8f959e; }
.dsp-pop-empty { padding: 10px 8px; color: #8f959e; font-size: calc(12px * var(--dsp-zoom, 1)); }
.dsp-check {
  flex: none;
  width: calc(14px * var(--dsp-zoom, 1));
  height: calc(14px * var(--dsp-zoom, 1));
  border: 1px solid #c9ced6;
  border-radius: 4px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: calc(9px * var(--dsp-zoom, 1));
  color: #ffffff;
}
.dsp-check-on { background: #3370ff; border-color: #3370ff; }
.dsp-tags { display: flex; flex-wrap: wrap; gap: 5px; }
.dsp-tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: calc(2px * var(--dsp-zoom, 1)) calc(4px * var(--dsp-zoom, 1)) calc(2px * var(--dsp-zoom, 1)) 7px;
  border: 1px solid #d6e2ff;
  border-radius: 6px;
  background: #f0f5ff;
  color: #1a47c9;
  font-size: calc(11.5px * var(--dsp-zoom, 1));
}
.dsp-tag-text { max-width: calc(150px * var(--dsp-zoom, 1)); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dsp-tag-x {
  flex: none;
  border: 0;
  background: transparent;
  color: #7d96c8;
  cursor: pointer;
  width: calc(16px * var(--dsp-zoom, 1));
  height: calc(16px * var(--dsp-zoom, 1));
  border-radius: 4px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.dsp-tag-x:hover { background: #dbe6ff; color: #1a47c9; }
.dsp-chat-send {
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: calc(32px * var(--dsp-zoom, 1));
  height: calc(32px * var(--dsp-zoom, 1));
  padding: 0;
  border-radius: 50%;
  border: 1px solid #3370ff;
  background: linear-gradient(180deg, #4b83ff 0%, #3370ff 100%);
  color: #ffffff;
  cursor: pointer;
  box-shadow: 0 2px 6px rgba(51, 112, 255, 0.28);
  transition: box-shadow 140ms ease, transform 140ms ease, background 140ms ease;
}
.dsp-chat-send svg { display: block; width: calc(20px * var(--dsp-zoom, 1)); height: calc(20px * var(--dsp-zoom, 1)); }
.dsp-chat-send:hover:not(:disabled) { box-shadow: 0 3px 10px rgba(51, 112, 255, 0.38); transform: translateY(-1px); }
.dsp-chat-send:active:not(:disabled) { transform: translateY(0); box-shadow: 0 1px 4px rgba(51, 112, 255, 0.3); }
.dsp-chat-send:disabled {
  background: #eceef2;
  border-color: #eceef2;
  color: #b6bcc6;
  box-shadow: none;
  cursor: default;
}
.dsp-spin {
  width: calc(13px * var(--dsp-zoom, 1));
  height: calc(13px * var(--dsp-zoom, 1));
  border-radius: 50%;
  border: 2px solid var(--dsw-alias-border-l2);
  border-top-color: var(--dsw-alias-brand-primary);
  animation: dsp-spin 780ms linear infinite;
  flex: none;
}
/* The send button is the one dark surface a spinner sits on, so it keeps the
   white ring instead of the panel's brand colour. */
.dsp-chat-send .dsp-spin {
  border-color: rgba(255, 255, 255, 0.45);
  border-top-color: #ffffff;
}
@keyframes dsp-spin {
  to { transform: rotate(360deg); }
}
.dsp-msg-md { white-space: normal; }
.dsp-msg-md .dsp-md-p { margin: calc(5px * var(--dsp-zoom, 1)) 0; }
.dsp-msg-md .dsp-md-list > li { margin: 2px 0; }
.dsp-msg-md .dsp-md-code { font-size: 0.92em; }
.dsp-msg-md .dsp-md-p { margin: 0 0 6px; }
.dsp-msg-md > *:last-child { margin-bottom: 0; }
.dsp-msg-md .dsp-md-h1, .dsp-msg-md .dsp-md-h2, .dsp-msg-md .dsp-md-h3 { font-size: 1.06em; margin: 8px 0 4px; }
.dsp-msg .dsp-diff {
  border: 1px solid var(--dsw-alias-border-l1);
  border-radius: 8px;
  max-height: none;
  background: var(--dsw-alias-bg-base);
}
.dsp-diff {
  flex: none;
  max-height: 46%;
  display: flex;
  flex-direction: column;
  border-top: 1px solid var(--dsw-alias-border-l1);
  background: var(--dsw-alias-bg-base);
}
.dsp-diff-bar {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 7px 12px;
  font-size: 11.5px;
  color: var(--dsw-alias-label-secondary);
  border-bottom: 1px solid var(--dsw-alias-border-l1);
}
.dsp-diff-bar svg { color: var(--dsw-alias-brand-primary); }
.dsp-diff-title { color: var(--dsw-alias-label-primary); font-weight: 600; }
.dsp-diff-count { margin-left: auto; }
.dsp-diff-body {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 10px 14px;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
  line-height: 1.7;
}
.dsp-diff-del {
  background: color-mix(in srgb, var(--dsw-alias-state-error-primary) 24%, transparent);
  color: var(--dsw-alias-state-error-primary);
  text-decoration: line-through;
  border-radius: 3px;
}
.dsp-diff-ins {
  background: color-mix(in srgb, var(--dsw-alias-state-success-primary) 26%, transparent);
  color: var(--dsw-alias-label-primary);
  border-radius: 3px;
}
.dsp-diff-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  border-top: 1px solid var(--dsw-alias-border-l1);
}
.dsp-toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: 1px solid transparent;
  border-radius: 7px;
  background: transparent;
  color: var(--dsw-alias-label-secondary);
  cursor: pointer;
}
.dsp-toggle:hover { background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-label-primary); }
.dsp-toggle-on { color: var(--dsw-alias-brand-primary); border-color: var(--dsw-alias-border-l1); }

/* review menu for a highlighted fragment */
.dsp-mark-menu {
  position: fixed;
  z-index: 40;
  display: flex;
  gap: 2px;
  padding: 4px;
  border: 1px solid var(--dsw-alias-border-l1);
  border-radius: 9px;
  background: #ffffff;
  box-shadow: 0 6px 18px rgba(31, 35, 41, 0.14);
}
.dsp-mark-btn {
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: #1f2329;
  font-family: inherit;
  font-size: calc(12px * var(--dsp-zoom, 1));
  line-height: 1;
  padding: calc(6px * var(--dsp-zoom, 1)) calc(9px * var(--dsp-zoom, 1));
  cursor: pointer;
  white-space: nowrap;
}
.dsp-mark-btn:hover { background: #f2f4f7; }
.dsp-mark-accept { color: #2ea121; font-weight: 600; }
.dsp-mark-accept:hover { background: #eaf7e6; }
.dsp-doc-bar {
  position: fixed;
  z-index: 41;
  pointer-events: none;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  max-width: calc(100vw - 16px);
  gap: 2px;
  padding: 4px;
  border: 1px solid #e6e8eb;
  border-radius: 10px;
  background: #ffffff;
  box-shadow: 0 8px 24px rgba(31, 35, 41, 0.12), 0 1px 3px rgba(31, 35, 41, 0.08);
}
.dsp-doc-bar-btn {
  width: calc(30px * var(--dsp-zoom, 1));
  height: calc(30px * var(--dsp-zoom, 1));
  pointer-events: auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: #1f2329;
  font-family: inherit;
  font-size: calc(12px * var(--dsp-zoom, 1));
  line-height: 1;
  padding: 0;
  cursor: pointer;
  white-space: nowrap;
}
.dsp-doc-bar-ico {
  display: block;
  width: calc(16px * var(--dsp-zoom, 1));
  height: calc(16px * var(--dsp-zoom, 1));
}
.dsp-doc-bar-btn:hover { background: #f2f4f7; }
.dsp-doc-bar-btn-on { background: #e8f0fe; color: #1a56c4; }
.dsp-doc-bar-sep {
  width: 1px;
  align-self: stretch;
  margin: 3px 4px;
  background: #e6e8eb;
}
.dsp-doc-bar-link { display: flex; align-items: center; gap: 3px; }
.dsp-doc-bar-input {
  width: calc(160px * var(--dsp-zoom, 1));
  pointer-events: auto;
  border: 1px solid #e6e8eb;
  border-radius: 6px;
  padding: calc(4px * var(--dsp-zoom, 1)) calc(6px * var(--dsp-zoom, 1));
  font-family: inherit;
  font-size: calc(12px * var(--dsp-zoom, 1));
  color: #1f2329;
  outline: none;
}
.dsp-doc-bar-ok {
  width: auto;
  padding: 0 calc(10px * var(--dsp-zoom, 1));
  color: #1a56c4;
  font-weight: 600;
}
.dsp-slash-menu {
  position: fixed;
  z-index: 41;
  display: flex;
  flex-direction: column;
  min-width: calc(180px * var(--dsp-zoom, 1));
  max-height: calc(280px * var(--dsp-zoom, 1));
  overflow: auto;
  padding: 4px;
  border: 1px solid var(--dsw-alias-border-l1);
  border-radius: 9px;
  background: #ffffff;
  box-shadow: 0 8px 22px rgba(31, 35, 41, 0.16);
}
.dsp-slash-item {
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: #1f2329;
  font-family: inherit;
  font-size: calc(13px * var(--dsp-zoom, 1));
  line-height: 1.4;
  padding: calc(5px * var(--dsp-zoom, 1)) calc(9px * var(--dsp-zoom, 1));
  text-align: left;
  cursor: pointer;
  white-space: nowrap;
}
.dsp-slash-item-on { background: #e8f0fe; color: #1a56c4; }
.dsp-slash-empty {
  padding: calc(6px * var(--dsp-zoom, 1)) calc(9px * var(--dsp-zoom, 1));
  color: #8f959e;
  font-size: calc(12px * var(--dsp-zoom, 1));
}

.dsp-block-grip {
  position: fixed;
  z-index: 41;
  display: flex;
  align-items: center;
  justify-content: center;
  width: calc(20px * var(--dsp-zoom, 1));
  height: calc(24px * var(--dsp-zoom, 1));
  border-radius: 4px;
  color: #8f959e;
  font-size: calc(14px * var(--dsp-zoom, 1));
  line-height: 1;
  cursor: grab;
  user-select: none;
  opacity: 0.75;
}

.dsp-block-grip:hover,
.dsp-block-grip-on {
  background: #f2f4f7;
  color: #1f2329;
  opacity: 1;
}

.dsp-block-menu {
  min-width: calc(120px * var(--dsp-zoom, 1));
  max-height: calc(320px * var(--dsp-zoom, 1));
}
`

    /* ------------------------------------------------------------------ */
    /* apply                                                               */
    /* ------------------------------------------------------------------ */

    /**
     * Mount everything that needs the `slots` service.
     *
     * Activation is deliberately deferred (see `apply`): a client half that
     * *declares* `slots` in its inject list is held in the Cordis `loading`
     * state until the service arrives, and a boot-time activation audit that
     * samples the fiber in that window fails the whole Web boot
     * ("web boot: 1 entry did not activate"). Declaring nothing keeps this
     * entry immediately active; registering through `ctx.inject` subscribes to
     * the service without ever blocking activation.
     */
    function mount(c, slots, locale) {
      const t = makeTranslator(c, locale)

      const styleApi = typeof styles !== 'undefined' && styles && typeof styles.insert === 'function' ? styles : undefined
      try {
        if (styleApi) {
          c.effect(() => styleApi.insert(CSS), 'dsh-doc-pane: styles')
        } else {
          c.effect(() => {
            const element = document.createElement('style')
            element.setAttribute('data-dsh-doc-pane', 'styles')
            element.textContent = CSS
            document.head.appendChild(element)
            return () => {
              if (element.parentNode) element.parentNode.removeChild(element)
            }
          }, 'dsh-doc-pane: styles')
        }
      } catch (error) {
        // Styles are cosmetic: never let them block the panel's registration.
        console.error('dsh-doc-pane: failed to insert styles', error)
      }

      const Panel = makePanel(t, c)
      const Toggle = makeToggle(t, c)

      // `slots.register` throws when its target slot is not declared yet: the
      // owning entry must declare it in its children table first. We activate
      // immediately (empty inject list, see `apply`), so dsh-better-sidebar —
      // which declares `sidebar.right.pane.tab` — can still be activating when
      // this runs, and a direct `register` then aborts the whole mount (the
      // panel body, the header toggle and the tab type all disappear together).
      // Deferring through `slots.inject` waits for the declaration instead.
      const registerSlot = (name, spec, component) => {
        if (typeof slots.inject === 'function') return slots.inject(name, () => slots.register(spec, component))
        return slots.register(spec, component)
      }

      // Docked as a right-column tab, beside the chat instead of over it. The
      // type is a page type: it names no address pattern and is opened by kind.
      c.effect(
        () =>
          registerSlot(
            'sidebar.right.pane.tab',
            { name: 'sidebar.right.pane.tab', key: TAB_ID, locale: NS, inject: (sessionId) => ({ sessionId }) },
            Panel,
          ),
        'dsh-doc-pane: tab body',
      )

      c.effect(
        () =>
          registerSlot(
            'conversation.session.header.actions',
            { name: 'conversation.session.header.actions', id: 'dsh-doc-pane-open', order: 30 },
            Toggle,
          ),
        'dsh-doc-pane: header toggle',
      )

      // The tab type needs `sidebarRightTabs`, which may still be activating
      // when the panel is first mounted. Retry for a while instead of silently
      // dropping the type (a missing type makes `openTab` throw).
      const claimType = (host) => {
        const tabs = service(host, 'sidebarRightTabs')
        if (!tabs || typeof tabs.register !== 'function') return false
        host.effect(
          () =>
            tabs.register({
              id: TAB_ID,
              kind: TAB_KIND,
              // Claim document links the chat renders. The patterns name the
              // whole address on purpose: same-band types are ranked by the
              // length of the pattern that matched, and dsh-better-sidebar
              // claims every file with `dsh-resource://file/**`, so a bare
              // `*.md` (and even a bare `dsh-resource://file/**`) loses to it.
              patterns: [
                'dsh-resource://file/**/*.md',
                'dsh-resource://file/**/*.markdown',
                'dsh-resource://file/**/*.mdx',
                'dsh-resource://file/**/*.txt',
                // A link to a line arrives as `…README.md:41`, which the plain
                // patterns above do not match, so the suffix is spelled out.
                'dsh-resource://file/**/*.md:*',
                'dsh-resource://file/**/*.markdown:*',
                'dsh-resource://file/**/*.mdx:*',
                'dsh-resource://file/**/*.txt:*',
              ],
              priority: 'extension',
              canOpen: (address) => {
                const parsed = parseFileAddress(address)
                return Boolean(parsed) && TEXT_EXT.test(parsed.path)
              },
              title: (address) => {
                const parsed = parseFileAddress(address)
                if (parsed) {
                  const tail = parsed.path.split('/').filter(Boolean).pop()
                  if (tail) return tail
                }
                // Opened by kind (a chat link taken before the ranking), so the
                // address names no file: use the document just recorded.
                return t('panelTitle')
              },
              keepMounted: true,
            }),
          'dsh-doc-pane: tab type',
        )
      }

      c.inject(['sidebarRightTabs'], claimType)

    }

    return {
      // Declaring no services keeps activation synchronous and unconditional.
      inject: [],
      apply(ctx) {
        let mounted = false
        const start = (c) => {
          if (mounted) return true
          const slots = service(c, 'slots')
          if (!slots || typeof slots.register !== 'function') return false
          mount(c, slots, service(c, 'locale'))
          mounted = true
          return true
        }

        try {
          if (start(ctx)) return
        } catch (error) {
          console.error('dsh-doc-pane: failed to mount', error)
        }

        // Path 1: declare the dependency and mount when it arrives.
        try {
          if (typeof ctx.inject === 'function') {
            ctx.inject(['slots'], (scoped) => {
              try {
                start(scoped)
              } catch (error) {
                console.error('dsh-doc-pane: failed to mount', error)
              }
            })
          }
        } catch (error) {
          console.error('dsh-doc-pane: ctx.inject failed', error)
        }

        // Path 2: poll. Costs nothing and survives a runtime whose `inject` never fires.
        let attempts = 0
        const tick = () => {
          attempts += 1
          try {
            if (start(ctx)) return
          } catch (error) {
            console.error('dsh-doc-pane: failed to mount', error)
            return
          }
          if (attempts < 40) setTimeout(tick, 250)
        }
        setTimeout(tick, 250)
      },
    }
  },
})
