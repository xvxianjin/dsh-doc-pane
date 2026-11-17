/**
 * DshDocEditor — the editing kernel for the document pane.
 *
 * Why this exists: the pane used to edit one big `contentEditable` and convert
 * the whole document back to Markdown on every keystroke. Undo, IME, tables and
 * selection all had to be re-invented that way. This bundle wraps a real editor
 * kernel (ProseMirror) so those come from the engine, while the Markdown layer
 * stays in the pane (it renders Markdown to HTML and parses that HTML back), so
 * the file format keeps exactly one implementation.
 *
 * Contract:
 *   const editor = DshDocEditor.create({ root, html, onChange, onSelection })
 *   editor.setHtml(html)        // document replaced from outside
 *   editor.getHtml()            // what the pane turns back into Markdown
 *   editor.setPending(items)    // 待确认 highlights and deletion ghosts
 *   editor.getSelection()       // { text, blockText }
 *   editor.focus() / undo() / redo() / destroy()
 *
 * The HTML in and out uses the pane's own markup (h1–h6, p, ul/ol/li, pre>code,
 * blockquote, table, strong/em/code/del/a, img), so `serializeMarkdown` keeps
 * working untouched.
 */
const { Schema } = require('prosemirror-model')
const { EditorState, Plugin, PluginKey, TextSelection } = require('prosemirror-state')
const { EditorView, Decoration, DecorationSet } = require('prosemirror-view')
const { DOMParser: DOMDocParser } = require('prosemirror-model')
const { keymap } = require('prosemirror-keymap')
const { history, undo, redo } = require('prosemirror-history')
const {
  inputRules,
  wrappingInputRule,
  textblockTypeInputRule,
  InputRule,
  smartQuotes,
  ellipsis,
  emDash,
} = require('prosemirror-inputrules')
const {
  baseKeymap,
  chainCommands,
  exitCode,
  joinBackward,
  selectNodeBackward,
  createParagraphNear,
  liftEmptyBlock,
  splitBlock,
  toggleMark,
  setBlockType,
  wrapIn,
} = require('prosemirror-commands')
const { wrapInList, splitListItem, liftListItem, sinkListItem } = require('prosemirror-schema-list')
const {
  tableNodes,
  tableEditing,
  goToNextCell,
  addRowBefore,
  addRowAfter,
  addColumnBefore,
  addColumnAfter,
  deleteRow,
  deleteColumn,
  deleteTable,
  toggleHeaderRow,
  CellSelection,
} = require('prosemirror-tables')
const { schema: basicSchema } = require('prosemirror-schema-basic')

/* ------------------------------------------------------------------ */
/* schema                                                              */
/* ------------------------------------------------------------------ */

const codeLanguage = (dom) => {
  if (!dom) return ''
  const own = dom.getAttribute('data-lang')
  if (own) return own
  const code = dom.querySelector ? dom.querySelector('code') : null
  if (!code) return ''
  const match = /language-([^\s]+)/.exec(code.className || '')
  return match ? match[1] : ''
}

let nodes = basicSchema.spec.nodes

// A code block that remembers its fence language.
nodes = nodes.update('code_block', {
  attrs: { params: { default: '' } },
  content: 'text*',
  marks: '',
  group: 'block',
  code: true,
  defining: true,
  parseDOM: [{ tag: 'pre', preserveWhitespace: 'full', getAttrs: (dom) => ({ params: codeLanguage(dom) }) }],
  toDOM: (node) => [
    'pre',
    { 'data-lang': node.attrs.params || '' },
    ['code', node.attrs.params ? { class: 'language-' + node.attrs.params } : {}, 0],
  ],
})

const { addListNodes } = require('prosemirror-schema-list')
nodes = addListNodes(nodes, 'paragraph block*', 'block')
nodes = nodes.append(
  tableNodes({ tableGroup: 'block', cellContent: 'block+', cellAttributes: {} }),
)

const marks = basicSchema.spec.marks.addBefore('em', 'strike', {
  parseDOM: [{ tag: 'del' }, { tag: 's' }, { tag: 'strike' }],
  toDOM: () => ['del', 0],
})


/* The pane's stylesheet is class based, so the kernel's nodes carry the same
   classes the Markdown renderer uses — the document looks identical whether it
   is rendered or edited. */
function addClass(spec, className) {
  const original = spec.toDOM
  return {
    ...spec,
    toDOM(node, options) {
      const out = original ? original(node, options) : ['div', 0]
      if (!Array.isArray(out) || typeof out[0] !== 'string') return out
      const rest = out.slice(1)
      if (rest.length && rest[0] && typeof rest[0] === 'object' && !Array.isArray(rest[0]) && rest[0].nodeType === undefined) {
        const attrs = { ...rest[0], class: className + (rest[0].class ? ' ' + rest[0].class : '') }
        return [out[0], attrs, ...rest.slice(1)]
      }
      return [out[0], { class: className }, ...rest]
    },
  }
}

/**
 * A to-do item keeps its state in an attribute, so the box the pane draws is
 * part of the editor's own DOM: a click on it flips the item, Enter on it opens
 * the next one, and the Markdown layer still sees `- [ ]` / `- [x]`.
 */
function taskBox(dom) {
  if (!dom || !dom.children) return null
  for (let i = 0; i < dom.children.length; i += 1) {
    const child = dom.children[i]
    if (child.classList && child.classList.contains('dsp-md-check')) return child
  }
  return null
}

function listItemAttrs(dom) {
  const box = taskBox(dom)
  if (!box) return { task: null }
  return { task: box.classList.contains('dsp-md-check-on') ? 'done' : 'todo' }
}

function listItemDOM(node) {
  const task = node.attrs.task
  return ['li', { class: 'dsp-md-li' + (task ? ' dsp-md-task' : '') }, 0]
}

const withClasses = (value) => {
  let out = value
  const paint = (name, className) => {
    const spec = out.get(name)
    if (spec) out = out.update(name, addClass(spec, className))
  }
  paint('paragraph', 'dsp-md-p')
  paint('blockquote', 'dsp-md-quote')
  paint('horizontal_rule', 'dsp-md-hr')
  paint('code_block', 'dsp-code dsp-code-pre')
  paint('bullet_list', 'dsp-md-list')
  paint('ordered_list', 'dsp-md-list')
  out = out.update('list_item', {
    ...out.get('list_item'),
    attrs: { task: { default: null } },
    parseDOM: [{ tag: 'li', getAttrs: (dom) => listItemAttrs(dom) }],
    toDOM: (node) => listItemDOM(node),
  })
  paint('image', 'dsp-md-image')
  paint('table', 'dsp-md-table')
  out = out.update('heading', {
    ...out.get('heading'),
    toDOM: (node) => ['h' + node.attrs.level, { class: 'dsp-md-h dsp-md-h' + node.attrs.level }, 0],
  })
  return out
}

nodes = withClasses(nodes)

const withMarkClasses = (value) => {
  let out = value
  const paint = (name, className) => {
    const spec = out.get(name)
    if (spec) out = out.update(name, addClass(spec, className))
  }
  paint('code', 'dsp-md-code')
  return out
}

const schema = new Schema({ nodes, marks: withMarkClasses(marks) })

/* ------------------------------------------------------------------ */
/* pending decorations                                                 */
/* ------------------------------------------------------------------ */

const pendingKey = new PluginKey('dsh-pending')

function textBlocks(doc) {
  const blocks = []
  doc.descendants((node, pos) => {
    if (!node.isTextblock) return true
    blocks.push({ node, pos, text: node.textBetween(0, node.content.size, '\n', '\ufffc') })
    return false
  })
  return blocks
}

function buildDecorations(doc, items) {
  if (!items || !items.length) return DecorationSet.empty
  const blocks = textBlocks(doc)
  const decorations = []
  const seen = new Set()

  for (const item of items) {
    if (!item || seen.has(item.id)) continue
    seen.add(item.id)

    if (item.deleted) {
      // A deletion has no text left to highlight: put the struck-through ghost
      // where the removed text used to be, located by the text before it.
      const anchor = typeof item.anchor === 'string' ? item.anchor : ''
      if (!anchor) continue
      const block = blocks.find((entry) => entry.text.indexOf(anchor) >= 0)
      if (!block) continue
      const at = block.pos + 1 + block.text.indexOf(anchor) + anchor.length
      const widget = document.createElement('del')
      widget.className = 'dsp-ghost'
      widget.setAttribute('data-pending-id', item.id)
      widget.setAttribute('title', item.hint || (item.text === '' ? 'deleted' : item.text))
      widget.textContent = String(item.display || item.before || '')
      decorations.push(Decoration.widget(at, () => widget, { side: 1 }))
      continue
    }

    const text = typeof item.text === 'string' ? item.text : ''
    if (!text) continue
    for (const block of blocks) {
      let from = block.text.indexOf(text)
      let guard = 0
      while (from >= 0 && guard < 20) {
        guard += 1
        const start = block.pos + 1 + from
        const mark = document.createElement('mark')
        mark.className = 'dsp-pending'
        mark.setAttribute('data-pending-id', item.id)
        mark.setAttribute('title', item.hint || '')
        decorations.push(
          Decoration.inline(start, start + text.length, {
            nodeName: 'mark',
            class: 'dsp-pending',
            'data-pending-id': item.id,
            title: item.hint || '',
          }),
        )
        from = block.text.indexOf(text, from + text.length)
      }
    }
  }

  return DecorationSet.create(doc, decorations)
}

function pendingPlugin() {
  return new Plugin({
    key: pendingKey,
    state: {
      init: (_, state) => ({ items: [], set: DecorationSet.empty, doc: state.doc }),
      apply(tr, value, oldState, newState) {
        const meta = tr.getMeta(pendingKey)
        if (meta) return { items: meta.items || [], set: buildDecorations(newState.doc, meta.items || []), doc: newState.doc }
        if (tr.docChanged) return { items: value.items, set: buildDecorations(newState.doc, value.items), doc: newState.doc }
        return value
      },
    },
    props: {
      decorations(state) {
        return pendingKey.getState(state).set
      },
    },
  })
}

/* ------------------------------------------------------------------ */
/* to-do boxes                                                         */
/* ------------------------------------------------------------------ */

const taskKey = new PluginKey('dsh-task')

function taskBoxWidget(task) {
  const box = document.createElement('span')
  box.className = 'dsp-md-check' + (task === 'done' ? ' dsp-md-check-on' : '')
  box.setAttribute('contenteditable', 'false')
  box.setAttribute('data-task', task)
  if (task === 'done') box.textContent = '\u2713'
  return box
}

/**
 * The box is drawn as a widget, not as part of the item's own markup: a to-do
 * item's content stays a plain paragraph, so Markdown round-trips and nested
 * lists keep working, while the box is still a real element to click.
 */
function taskPlugin() {
  return new Plugin({
    key: taskKey,
    props: {
      decorations(state) {
        const decorations = []
        state.doc.descendants((node, pos) => {
          if (node.type !== schema.nodes.list_item || !node.attrs.task) return true
          if (!node.firstChild) return true
          decorations.push(Decoration.widget(pos + 2, () => taskBoxWidget(node.attrs.task), { side: -1 }))
          return true
        })
        return DecorationSet.create(state.doc, decorations)
      },
    },
    /**
     * A paragraph that reads "- [ ] text" becomes a to-do item even when the
     * text did not arrive one keystroke at a time (a paste, an IME composition
     * or a scripted edit), which is what the typing shortcut alone misses.
     */
    appendTransaction(transactions, oldState, newState) {
      if (!transactions.some((tr) => tr.docChanged)) return null
      let target = null
      newState.doc.forEach((node, offset) => {
        if (target || node.type !== schema.nodes.paragraph) return
        const match = /^\s*[-*+]\s\[([ xX])\]\s([\s\S]*)$/.exec(node.textContent)
        if (!match) return
        target = { offset, node, task: match[1] === ' ' ? 'todo' : 'done', rest: match[2] }
      })
      if (!target) return null
      const text = target.rest ? schema.text(target.rest) : null
      const item = schema.nodes.list_item.create({ task: target.task }, [schema.nodes.paragraph.create(null, text)])
      const list = schema.nodes.bullet_list.create(null, [item])
      return newState.tr.replaceWith(target.offset, target.offset + target.node.nodeSize, list).scrollIntoView()
    },
  })
}

/* ------------------------------------------------------------------ */
/* markdown shortcuts                                                  */
/* ------------------------------------------------------------------ */

function markRule(regexp, markType) {
  return new InputRule(regexp, (state, match, start, end) => {
    if (!match[1]) return null
    const head = match[0].indexOf(match[1])
    const len = match[1].length
    const tr = state.tr
    if (start + head + len < end) tr.delete(start + head + len, end)
    if (head > 0) tr.delete(start, start + head)
    return tr.addMark(start, start + len, markType.create())
  })
}

function markdownRules() {
  const rules = [
    textblockTypeInputRule(/^(#{1,6})\s$/, schema.nodes.heading, (match) => ({ level: match[1].length })),
    wrappingInputRule(/^\s*>\s$/, schema.nodes.blockquote),
    // `- [ ] ` / `- [x] ` starts a to-do item, the way Feishu and every
    // Markdown editor do; the list is wrapped first, then its item is marked.
    new InputRule(/^\s*[-*+]\s\[([ xX])\]\s$/, (state, match, start, end) => {
      const task = match[1].toLowerCase() === 'x' ? 'done' : 'todo'
      const tr = state.tr.delete(start, end)
      let wrapped = null
      const done = wrapInList(schema.nodes.bullet_list)(state.apply(tr), (next) => {
        wrapped = next
      })
      if (!done || !wrapped) return tr
      wrapped.steps.forEach((step) => tr.step(step))
      const at = Math.min(start, tr.doc.content.size)
      const $pos = tr.doc.resolve(at)
      const after = $pos.nodeAfter
      if (after && after.type === schema.nodes.list_item) {
        tr.setNodeMarkup(at, null, { ...after.attrs, task })
      } else {
        for (let depth = $pos.depth; depth > 0; depth -= 1) {
          const node = $pos.node(depth)
          if (node.type !== schema.nodes.list_item) continue
          tr.setNodeMarkup($pos.before(depth), null, { ...node.attrs, task })
          break
        }
      }
      return tr.scrollIntoView()
    }),
    wrappingInputRule(/^\s*([-+*])\s$/, schema.nodes.bullet_list),
    wrappingInputRule(/^(\d+)\.\s$/, schema.nodes.ordered_list, (match) => ({ order: Number(match[1]) })),
    textblockTypeInputRule(/^```([a-zA-Z0-9+#-]*)\s$/, schema.nodes.code_block, (match) => ({ params: match[1] || '' })),
    textblockTypeInputRule(/^```([a-zA-Z0-9+#-]*)$/, schema.nodes.code_block, (match) => ({ params: match[1] || '' })),
    new InputRule(/^---$/, (state, match, start, end) =>
      state.tr.delete(start, end).replaceSelectionWith(schema.nodes.horizontal_rule.create()),
    ),
    markRule(/(?:\*\*)([^*]+)(?:\*\*)$/, schema.marks.strong),
    markRule(/(?:__)([^_]+)(?:__)$/, schema.marks.strong),
    markRule(/(?:\*)([^*]+)(?:\*)$/, schema.marks.em),
    markRule(/(?:_)([^_]+)(?:_)$/, schema.marks.em),
    markRule(/(?:`)([^`]+)(?:`)$/, schema.marks.code),
    markRule(/(?:~~)([^~]+)(?:~~)$/, schema.marks.strike),
    ...smartQuotes,
    ellipsis,
    emDash,
  ]
  return inputRules({ rules })
}

/* ------------------------------------------------------------------ */
/* keyboard                                                            */
/* ------------------------------------------------------------------ */

function markShortcut(mark) {
  return (state, dispatch) => {
    if (!mark) return false
    return toggleMark(mark)(state, dispatch)
  }
}

function headingShortcut(state, dispatch, level) {
  const type = schema.nodes.heading
  return setBlockType(type, { level })(state, dispatch)
}

/** Tab indents a list item, inserts a tab in code, otherwise does nothing. */
function indentCommand(state, dispatch) {
  if (sinkListItem(schema.nodes.list_item)(state, dispatch)) return true
  const { $from } = state.selection
  if ($from.parent.type === schema.nodes.code_block) {
    if (dispatch) dispatch(state.tr.insertText('  '))
    return true
  }
  return false
}

function dedentCommand(state, dispatch) {
  return liftListItem(schema.nodes.list_item)(state, dispatch)
}

/* ------------------------------------------------------------------ */
/* block insertion (the "/" menu)                                      */
/* ------------------------------------------------------------------ */

/** A fresh table: one header row and `rows - 1` body rows of `cols` cells. */
function tableOf(rows, cols) {
  const width = Math.max(1, cols || 3)
  const cell = (type) => type.create(null, schema.nodes.paragraph.create())
  const rowOf = (type) => schema.nodes.table_row.create(null, Array.from({ length: width }, () => cell(type)))
  const body = Array.from({ length: Math.max(0, (rows || 3) - 1) }, () => rowOf(schema.nodes.table_cell))
  return schema.nodes.table.create(null, [rowOf(schema.nodes.table_header), ...body])
}

/** Wrap the block in a bullet list and mark its item as an open to-do. */
function wrapTaskList() {
  return (state, dispatch) => {
    let inner = null
    const done = wrapInList(schema.nodes.bullet_list)(state, (tr) => {
      inner = tr
    })
    if (!done || !inner) return false
    if (dispatch) {
      const at = Math.min(inner.selection.from, inner.doc.content.size)
      const $pos = inner.doc.resolve(at)
      for (let depth = $pos.depth; depth > 0; depth -= 1) {
        const node = $pos.node(depth)
        if (node.type !== schema.nodes.list_item) continue
        inner.setNodeMarkup($pos.before(depth), null, { ...node.attrs, task: 'todo' })
        break
      }
      dispatch(inner.scrollIntoView())
    }
    return true
  }
}

const blockCommand = (kind) => {
  const insert = (node) => (state, dispatch) => {
    if (dispatch) dispatch(state.tr.replaceSelectionWith(node).scrollIntoView())
    return true
  }
  switch (kind) {
    case 'h1':
    case 'h2':
    case 'h3':
      return setBlockType(schema.nodes.heading, { level: Number(kind.charAt(1)) })
    case 'bullet':
      return wrapInList(schema.nodes.bullet_list)
    case 'ordered':
      return wrapInList(schema.nodes.ordered_list)
    case 'todo':
      return wrapTaskList()
    case 'quote':
      return wrapIn(schema.nodes.blockquote)
    case 'code':
      return setBlockType(schema.nodes.code_block, { params: '' })
    case 'divider':
      return insert(schema.nodes.horizontal_rule.create())
    case 'table':
      return insert(tableOf(3, 3))
    default:
      return null
  }
}

/**
 * Enter inside a to-do item starts another to-do item — never a done one, and
 * never a plain bullet. Every other item splits with its own attributes.
 */
function splitItemCommand(state, dispatch) {
  const { $from } = state.selection
  const item = $from.depth >= 2 ? $from.node($from.depth - 1) : null
  const attrs = item && item.attrs && item.attrs.task ? { task: 'todo' } : null
  return splitListItem(schema.nodes.list_item, attrs)(state, dispatch)
}

/* ------------------------------------------------------------------ */
/* table editing                                                       */
/* ------------------------------------------------------------------ */

const cellType = (node) =>
  node && (node.type === schema.nodes.table_cell || node.type === schema.nodes.table_header)

/** True when the caret sits at the very start of the first block of a cell. */
function atCellStart(state) {
  const { $from, empty } = state.selection
  if (!empty || $from.parentOffset !== 0 || $from.depth < 2) return false
  if (!cellType($from.node($from.depth - 1))) return false
  return $from.index($from.depth - 1) === 0
}

/** True when the caret sits at the very end of the last block of a cell. */
function atCellEnd(state) {
  const { $from, empty } = state.selection
  if (!empty || $from.depth < 2) return false
  if ($from.parentOffset !== $from.parent.content.size) return false
  const cell = $from.node($from.depth - 1)
  if (!cellType(cell)) return false
  return $from.index($from.depth - 1) === cell.childCount - 1
}

/** Clicking and dragging across cells selects them; Delete empties them. */
function clearCellSelection(state, dispatch) {
  const selection = state.selection
  if (!(selection instanceof CellSelection)) return false
  if (dispatch) {
    const tr = state.tr
    const cells = []
    selection.forEachCell((node, pos) => cells.push({ node, pos }))
    cells.sort((left, right) => right.pos - left.pos)
    for (const cell of cells) {
      tr.replaceWith(cell.pos + 1, cell.pos + cell.node.nodeSize - 1, schema.nodes.paragraph.create())
    }
    tr.setSelection(TextSelection.near(tr.doc.resolve(selection.$anchorCell.pos + 1)))
    dispatch(tr.scrollIntoView())
  }
  return true
}

/**
 * Tab moves to the next cell and, in the last cell, appends a row first — the
 * same dead end Feishu and Word avoid. Shift-Tab walks back.
 */
function nextCellCommand(state, dispatch) {
  if (goToNextCell(1)(state, dispatch)) return true
  if (!addRowAfter(state, dispatch)) return false
  return goToNextCell(1)(state, dispatch)
}

function tableKeymap() {
  return {}
}

function buildKeymap() {
  const custom = {
    'Mod-z': undo,
    'Shift-Mod-z': redo,
    'Mod-y': redo,
    'Mod-b': markShortcut(schema.marks.strong),
    'Mod-i': markShortcut(schema.marks.em),
    'Mod-Shift-x': markShortcut(schema.marks.strike),
    'Mod-Alt-1': (state, dispatch) => headingShortcut(state, dispatch, 1),
    'Mod-Alt-2': (state, dispatch) => headingShortcut(state, dispatch, 2),
    'Mod-Alt-3': (state, dispatch) => headingShortcut(state, dispatch, 3),
    'Mod-Shift-8': (state, dispatch) => wrapInList(schema.nodes.bullet_list)(state, dispatch),
    'Mod-Shift-7': (state, dispatch) => wrapInList(schema.nodes.ordered_list)(state, dispatch),
    Enter: chainCommands(
      exitCode,
      splitItemCommand,
      createParagraphNear,
      liftEmptyBlock,
      splitBlock,
    ),
    Tab: chainCommands(nextCellCommand, indentCommand),
    'Shift-Tab': chainCommands(goToNextCell(-1), dedentCommand),
    Backspace: chainCommands(
      clearCellSelection,
      (state) => atCellStart(state),
      (state, dispatch) => {
        const { $from, empty } = state.selection
        if (!empty || $from.parentOffset !== 0) return false
        const parent = $from.parent
        if (parent.type === schema.nodes.code_block) return false
        const node = $from.node($from.depth)
        if (node.type === schema.nodes.list_item) {
          return liftListItem(schema.nodes.list_item)(state, dispatch)
        }
        return joinBackward(state, dispatch)
      },
      selectNodeBackward,
    ),
    Delete: chainCommands(clearCellSelection, (state) => atCellEnd(state)),
  }
  return [keymap(custom), keymap(tableKeymap()), keymap(baseKeymap)]
}

/* ------------------------------------------------------------------ */
/* editor                                                              */
/* ------------------------------------------------------------------ */

function parseHtml(html) {
  const holder = document.createElement('div')
  holder.innerHTML = html || ''
  return DOMDocParser.fromSchema(schema).parse(holder)
}

function create(options) {
  const root = options && options.root
  if (!root) throw new Error('DshDocEditor: root is required')

  let onChange = typeof options.onChange === 'function' ? options.onChange : null
  let onSelection = typeof options.onSelection === 'function' ? options.onSelection : null
  let muted = false

  const state = EditorState.create({
    doc: parseHtml(options.html || ''),
    plugins: [history(), markdownRules(), ...buildKeymap(), tableEditing(), pendingPlugin(), taskPlugin()],
  })

  const view = new EditorView(root, {
    state,
    attributes: {
      class: 'dsp-pm',
      spellcheck: 'false',
      'aria-label': 'document',
    },
    dispatchTransaction(transaction) {
      const next = view.state.apply(transaction)
      view.updateState(next)
      if (!transaction.docChanged) return
      onSelectionChange()
      if (onChange && !muted) onChange()
    },
    handleDOMEvents: {
      mousedown: (view, event) => {
        const target = event.target
        const box = target && target.closest ? target.closest('.dsp-md-check') : null
        if (!box || !view.dom.contains(box)) return false
        const item = taskItemAt(view, box)
        if (!item) return false
        event.preventDefault()
        const next = item.node.attrs.task === 'done' ? 'todo' : 'done'
        view.dispatch(view.state.tr.setNodeMarkup(item.pos, null, { ...item.node.attrs, task: next }))
        return true
      },
      mouseup: (view, event) => {
        onSelectionChange()
        // Give the view's own mouseup handling the first word, then make sure
        // the state selection matches what the browser actually selected.
        if (typeof window !== 'undefined' && typeof window.setTimeout === 'function') {
          window.setTimeout(() => syncFromDom(view, event), 0)
        }
        return false
      },
      keyup: () => {
        onSelectionChange()
        return false
      },
    },
  })

  /**
   * The browser owns the drag; the editor state has to follow it. A click with
   * no caret (Chromium refuses one after a host lost its editable flag) also
   * gets a text caret here, so the pane never has to guess.
   */
  function syncFromDom(view, event) {
    const picked = typeof window !== 'undefined' && window.getSelection ? window.getSelection() : null
    if (!picked || !picked.rangeCount) return
    const anchor = picked.anchorNode
    const focus = picked.focusNode
    if (!anchor || !focus || !view.dom.contains(anchor) || !view.dom.contains(focus)) return
    let from = null
    let to = null
    try {
      from = view.posAtDOM(anchor, picked.anchorOffset)
      to = view.posAtDOM(focus, picked.focusOffset)
    } catch (error) {
      return
    }
    const size = view.state.doc.content.size
    const a = Math.min(Math.max(Math.min(from, to), 0), size)
    const b = Math.min(Math.max(Math.max(from, to), 0), size)
    if (!picked.isCollapsed && b > a) {
      const firstCell = cellPosAt(view.state.doc, a)
      const lastCell = cellPosAt(view.state.doc, b)
      if (firstCell >= 0 && lastCell >= 0 && firstCell !== lastCell) return
      const current = view.state.selection
      if (current.from !== a || current.to !== b || current instanceof CellSelection) {
        commitSelection(TextSelection.create(view.state.doc, a, b))
      }
      return
    }
    const hit = typeof view.posAtCoords === 'function'
      ? view.posAtCoords({ left: event.clientX, top: event.clientY })
      : null
    if (!hit || typeof hit.pos !== 'number') return
    const caret = Math.min(Math.max(hit.pos, 0), size)
    const current = view.state.selection
    if (current instanceof CellSelection || current.from !== caret || current.to !== caret) {
      commitSelection(TextSelection.near(view.state.doc.resolve(caret)))
    }
  }

  /** The selection's box on screen, so the pane can hang a bar off it. */
  function selectionRect(from, to) {
    try {
      const start = view.coordsAtPos(from)
      const end = to > from ? view.coordsAtPos(to) : start
      if (!start || !end) return null
      return {
        left: Math.min(start.left, end.left),
        right: Math.max(start.right, end.right),
        top: Math.min(start.top, end.top),
        bottom: Math.max(start.bottom, end.bottom),
      }
    } catch (error) {
      return null
    }
  }

  /** Which marks the caret or the selection currently carries. */
  function activeMarks(from, to, empty) {
    const out = {}
    const names = ['strong', 'em', 'code', 'strike', 'link']
    for (let i = 0; i < names.length; i += 1) {
      const type = schema.marks[names[i]]
      if (!type) continue
      if (empty) {
        const stored = view.state.storedMarks || view.state.selection.$from.marks()
        out[names[i]] = !!type.isInSet(stored)
      } else {
        out[names[i]] = view.state.doc.rangeHasMark(from, to, type)
      }
    }
    return out
  }

  function selectionInfo() {
    const { from, to, empty } = view.state.selection
    const text = empty ? '' : view.state.doc.textBetween(from, to, '\n', '\ufffc')
    const $from = view.state.doc.resolve(from)
    const parent = $from.parent
    const blockText = parent.textBetween(0, parent.content.size, '\n', '\ufffc')
    return {
      text,
      blockText,
      empty,
      inTable: cellPosAt(view.state.doc, from) >= 0,
      rect: selectionRect(from, to),
      marks: activeMarks(from, to, empty),
    }
  }

  function onSelectionChange() {
    if (!onSelection) return
    try {
      onSelection(selectionInfo())
    } catch (error) {
      // a listener must never break typing
    }
  }

  const TABLE_CELLS = ['table_cell', 'table_header']

  /** The start position of the table cell holding `pos`, or -1 outside tables. */
  function cellPosAt(doc, pos) {
    const $pos = doc.resolve(Math.min(Math.max(pos, 0), doc.content.size))
    for (let depth = $pos.depth; depth > 0; depth -= 1) {
      if (TABLE_CELLS.indexOf($pos.node(depth).type.name) >= 0) return $pos.before(depth)
    }
    return -1
  }

  function commitSelection(selection) {
    try {
      view.dispatch(view.state.tr.setSelection(selection))
      view.focus()
      return true
    } catch (error) {
      return false
    }
  }

  /* ------------------------------------------------------------------ */
  /* top-level blocks (the hover handle)                                 */
  /* ------------------------------------------------------------------ */

  /** The document position where top-level child `index` starts. */
  function childStart(doc, index) {
    let pos = 0
    for (let i = 0; i < index; i += 1) pos += doc.child(i).nodeSize
    return pos
  }

  /** The top-level child holding `pos`, as an index, or -1. */
  function blockIndex(doc, pos) {
    const value = Number(pos)
    if (!Number.isFinite(value) || value < 0) return -1
    let start = 0
    for (let i = 0; i < doc.childCount; i += 1) {
      const size = doc.child(i).nodeSize
      // A block's own start position sits on the boundary, which resolves at
      // depth 0: compare offsets instead of asking for the index.
      if (value < start + size) return i
      start += size
    }
    return doc.childCount - 1
  }

  /** Move the top-level child at `from` so that it sits at index `target`. */
  function moveChild(from, target) {
    const doc = view.state.doc
    if (from === target || from < 0 || target < 0) return false
    if (from >= doc.childCount || target >= doc.childCount) return false
    // Reorder the top-level blocks and swap the whole content in one step, so
    // the new order cannot drift from the positions the delete would shift.
    const children = []
    doc.forEach((child) => { children.push(child) })
    const node = children.splice(from, 1)[0]
    children.splice(target, 0, node)
    const next = doc.type.create(null, children)
    view.dispatch(view.state.tr.replaceWith(0, doc.content.size, next.content).scrollIntoView())
    return true
  }

  /** The to-do item a checkbox belongs to, as { pos, node }, or null. */
  function taskItemAt(view, box) {
    const li = box && box.closest ? box.closest('li') : null
    if (!li || !view.dom.contains(li)) return null
    let pos = -1
    try {
      pos = view.posAtDOM(li, 0)
    } catch (error) {
      return null
    }
    const size = view.state.doc.content.size
    const $pos = view.state.doc.resolve(Math.min(Math.max(pos, 0), size))
    const after = $pos.nodeAfter
    if (after && after.type === schema.nodes.list_item) {
      return after.attrs.task ? { pos, node: after } : null
    }
    for (let depth = $pos.depth; depth > 0; depth -= 1) {
      const node = $pos.node(depth)
      if (node.type !== schema.nodes.list_item) continue
      return node.attrs.task ? { pos: $pos.before(depth), node } : null
    }
    return null
  }

  return {
    setHtml(html) {
      const doc = parseHtml(html)
      muted = true
      view.updateState(EditorState.create({
        doc,
        plugins: [history(), markdownRules(), ...buildKeymap(), tableEditing(), pendingPlugin(), taskPlugin()],
      }))
      muted = false
    },
    getHtml() {
      return view.dom.innerHTML
    },
    setPending(items) {
      view.dispatch(view.state.tr.setMeta(pendingKey, { items: items || [] }))
    },
    getSelection() {
      return selectionInfo()
    },
    /** Table structure, driven by the pane's table bar. */
    tableCommand(name) {
      const commands = {
        rowBefore: addRowBefore,
        addRowBefore,
        rowAfter: addRowAfter,
        addRowAfter,
        colBefore: addColumnBefore,
        addColumnBefore,
        colAfter: addColumnAfter,
        addColumnAfter,
        deleteRow,
        deleteColumn,
        deleteTable,
        headerRow: toggleHeaderRow,
        toggleHeaderRow,
      }
      const command = commands[name]
      if (!command) return false
      const handled = command(view.state, view.dispatch)
      if (handled) onSelectionChange()
      return handled
    },
    /** Toggle one mark on the selection (the floating bar's buttons). */
    toggleMark(name) {
      const type = schema.marks[name]
      if (!type) return false
      return toggleMark(type)(view.state, view.dispatch)
    },
    /** 1–6 turns the block into that heading, 0 back into a paragraph. */
    setBlock(level) {
      const value = Number(level) || 0
      const command = value >= 1 && value <= 6
        ? setBlockType(schema.nodes.heading, { level: value })
        : setBlockType(schema.nodes.paragraph)
      return command(view.state, view.dispatch)
    },
    /** Give the selection a link; an empty href removes it. */
    setLink(href) {
      const type = schema.marks.link
      if (!type) return false
      const { from, to, empty } = view.state.selection
      if (empty) return false
      const url = typeof href === 'string' ? href.trim() : ''
      const tr = view.state.tr
      if (url) tr.addMark(from, to, type.create({ href: url }))
      else tr.removeMark(from, to, type)
      view.dispatch(tr.scrollIntoView())
      return true
    },
    /** Insert a block from the "/" menu: h1–h3, bullet, ordered, todo, quote,
        code, divider, table. */
    insertBlock(kind) {
      const command = blockCommand(kind)
      if (!command) return false
      const handled = command(view.state, view.dispatch)
      if (handled) onSelectionChange()
      return handled
    },
    insertImage(src, alt) {
      const url = typeof src === 'string' ? src.trim() : ''
      if (!url) return false
      const node = schema.nodes.image.create({ src: url, alt: typeof alt === 'string' ? alt : '' })
      view.dispatch(view.state.tr.replaceSelectionWith(node).scrollIntoView())
      return true
    },
    /** The top-level block holding a DOM element, as a document position. */
    blockPosAtDom(el) {
      if (!el || !view.dom.contains(el)) return -1
      let node = el
      while (node && node.parentNode !== view.dom) node = node.parentNode
      if (!node || node.parentNode !== view.dom) return -1
      let inner = -1
      try {
        inner = view.posAtDOM(node, 0)
      } catch (error) {
        return -1
      }
      const size = view.state.doc.content.size
      const $pos = view.state.doc.resolve(Math.min(Math.max(inner, 0), size))
      return $pos.depth > 0 ? $pos.before(1) : Math.max(0, inner)
    },
    /** Move the block at `pos` one place up or down. */
    blockMove(pos, direction) {
      const doc = view.state.doc
      const index = blockIndex(doc, pos)
      if (index < 0) return false
      const target = direction === 'up' ? index - 1 : index + 1
      if (target < 0 || target >= doc.childCount) return false
      return moveChild(index, target)
    },
    /** Move the block at `from` next to the block at `to` (before, or after). */
    blockMoveTo(from, to, before) {
      const doc = view.state.doc
      const fromIndex = blockIndex(doc, from)
      const toIndex = blockIndex(doc, to)
      if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return false
      let target = before === false ? toIndex + 1 : toIndex
      if (target > fromIndex) target -= 1
      if (target === fromIndex) return false
      return moveChild(fromIndex, target)
    },
    /** Put a copy of the block at `pos` right after it. */
    blockCopy(pos) {
      const doc = view.state.doc
      const index = blockIndex(doc, pos)
      if (index < 0) return false
      const node = doc.child(index)
      const at = childStart(doc, index) + node.nodeSize
      view.dispatch(view.state.tr.insert(at, node.copy(node.content)).scrollIntoView())
      return true
    },
    blockDelete(pos) {
      const doc = view.state.doc
      const index = blockIndex(doc, pos)
      if (index < 0) return false
      const node = doc.child(index)
      const start = childStart(doc, index)
      const tr = view.state.tr
      // A document always keeps one block: the last one empties instead.
      if (doc.childCount === 1) tr.replaceWith(start, start + node.nodeSize, schema.nodes.paragraph.create())
      else tr.delete(start, start + node.nodeSize)
      view.dispatch(tr.scrollIntoView())
      return true
    },
    /** Turn a top-level block into another kind, keeping its text. */
    blockConvert(pos, kind) {
      const doc = view.state.doc
      const index = blockIndex(doc, pos)
      if (index < 0) return false
      const node = doc.child(index)
      const start = childStart(doc, index)
      const tr = view.state.tr
      const asText = (inner) => (inner.isTextblock ? inner : schema.nodes.paragraph.create(null, inner.content))
      if (kind === 'paragraph') tr.setNodeMarkup(start, schema.nodes.paragraph, {})
      else if (kind === 'h1' || kind === 'h2' || kind === 'h3') tr.setNodeMarkup(start, schema.nodes.heading, { level: Number(kind.charAt(1)) })
      else if (kind === 'quote') tr.replaceWith(start, start + node.nodeSize, schema.nodes.blockquote.create(null, [asText(node)]))
      else if (kind === 'bullet' || kind === 'todo') {
        const item = schema.nodes.list_item.create({ task: kind === 'todo' ? 'todo' : null }, [asText(node)])
        tr.replaceWith(start, start + node.nodeSize, schema.nodes.bullet_list.create(null, [item]))
      } else return false
      view.dispatch(tr.scrollIntoView())
      return true
    },
    /** Drop the "/query" the insert menu was opened with, caret at its end. */
    clearSlash() {
      const { $from, empty } = view.state.selection
      if (!empty || !$from.parent.isTextblock) return false
      const text = $from.parent.textBetween(0, $from.parent.content.size, '\n', '\n')
      const at = text.lastIndexOf('/')
      if (at < 0) return false
      const from = $from.start() + at
      if ($from.pos <= from) return false
      view.dispatch(view.state.tr.delete(from, $from.pos).scrollIntoView())
      return true
    },
    /** Paste as if it came from the clipboard: the pane converts Markdown or
        HTML into blocks here, so one code path owns the conversion. */
    pasteHtml(html) {
      const value = String(html || '')
      if (!value) return false
      return view.pasteHTML(value)
    },
    pasteText(text) {
      const value = String(text || '')
      if (!value) return false
      view.dispatch(view.state.tr.insertText(value).scrollIntoView())
      return true
    },
    /**
     * Put a caret at `pos` as a text selection. The pane calls this when a
     * click produced no caret of its own, and it must never turn the previous
     * selection's shape into a cell selection.
     */
    placeCaret(pos) {
      const size = view.state.doc.content.size
      const at = Math.min(Math.max(typeof pos === 'number' ? pos : size, 0), size)
      return commitSelection(TextSelection.near(view.state.doc.resolve(at)))
    },
    /**
     * Select the characters between two positions. A range that spans two
     * different table cells is left to the table plugin (cell selection);
     * everything else becomes an ordinary text selection.
     */
    selectText(from, to) {
      const size = view.state.doc.content.size
      const a = Math.min(Math.max(Math.min(from, to), 0), size)
      const b = Math.min(Math.max(Math.max(from, to), 0), size)
      if (b <= a) return false
      const firstCell = cellPosAt(view.state.doc, a)
      const lastCell = cellPosAt(view.state.doc, b)
      if (firstCell >= 0 && lastCell >= 0 && firstCell !== lastCell) return false
      return commitSelection(TextSelection.create(view.state.doc, a, b))
    },
    focus() {
      view.focus()
    },
    undo() {
      return undo(view.state, view.dispatch)
    },
    redo() {
      return redo(view.state, view.dispatch)
    },
    destroy() {
      view.destroy()
    },
    get view() {
      return view
    },
    get state() {
      return view.state
    },
    schema,
  }
}

module.exports = { create, schema }
