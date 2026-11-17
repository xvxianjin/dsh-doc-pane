/* Smoke test for the ProseMirror vendor bundle, run in jsdom. */
const { JSDOM } = require('jsdom')

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
  pretendToBeVisual: true,
})
const { window } = dom
global.window = window
global.document = window.document
global.navigator = window.navigator
global.Node = window.Node
global.getSelection = window.getSelection.bind(window)
global.MutationObserver = window.MutationObserver
global.DOMParser = window.DOMParser
global.HTMLElement = window.HTMLElement
// jsdom has no layout: text nodes and ranges have no client rects, which the
// view asks for when it scrolls the caret into view.
const noRects = () => []
if (typeof window.Node.prototype.getClientRects !== 'function') {
  window.Node.prototype.getClientRects = noRects
}
if (typeof window.Range.prototype.getClientRects !== 'function') {
  window.Range.prototype.getClientRects = noRects
  window.Range.prototype.getBoundingClientRect = () => ({ left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 })
}
// The view builds a ClipboardEvent when a paste is applied programmatically.
if (!global.ClipboardEvent) {
  global.ClipboardEvent = window.ClipboardEvent || class ClipboardEvent extends window.Event {
    constructor(type, init) {
      super(type, init)
      this.clipboardData = (init && init.clipboardData) || null
    }
  }
}

const editorLib = require('./editor.cjs')

let failed = 0
const check = (name, ok, extra) => {
  if (ok) {
    console.log('ok   ' + name)
    return
  }
  failed += 1
  console.log('FAIL ' + name + (extra ? '  ' + JSON.stringify(extra) : ''))
}

const html = [
  '<h2>二、核心概念</h2>',
  '<p>关键点：<code>requires_grad=True</code> 会开启梯度追踪。</p>',
  '<ul><li><p>第一项</p></li><li><p>第二项</p></li></ul>',
  '<pre data-lang="python"><code>import torch\nmodel = nn.Linear(10, 1)</code></pre>',
  '<table><tbody><tr><th><p>概念</p></th><th><p>作用</p></th></tr><tr><td><p>Tensor</p></td><td><p>多维数组</p></td></tr></tbody></table>',
].join('')

const root = document.getElementById('root')
const editor = editorLib.create({ root, html })

const out = editor.getHtml()
check('heading survives', /<h2[^>]*>二、核心概念<\/h2>/.test(out), out.slice(0, 120))
check('inline code survives', /<code[^>]*>requires_grad=True<\/code>/.test(out))
check('list survives', /<li[^>]*>/.test(out))
check('code block keeps language', /data-lang="python"/.test(out) || /language-python/.test(out))
check('code block content', /model = nn\.Linear\(10, 1\)/.test(out))
check('table survives', /<table/.test(out) && /Tensor/.test(out), out.slice(-200))

/* typing a markdown shortcut turns the block into a heading */
const state = editor.state
editor.view.dispatch(state.tr.insertText('## ', 1))
const after = editor.getHtml()
check('## shortcut becomes a heading', /<h2/.test(after.slice(0, 200)), after.slice(0, 200))

/* pending decorations */
editor.setPending([
  { id: 'p1', text: '第一项', before: '旧的第一项' },
  { id: 'p2', deleted: true, before: '## 删掉的标题', display: '## 删掉的标题 …', anchor: '第一项' },
])
const marks = root.querySelectorAll('mark.dsp-pending')
check('pending highlight rendered', marks.length >= 1, marks.length)
const ghosts = root.querySelectorAll('del.dsp-ghost')
check('deletion ghost rendered', ghosts.length >= 1, ghosts.length)

/* undo restores the shortcut */
editor.undo()
check('undo works', !/<h2[^>]*>\s*##<\/h2>/.test(editor.getHtml()))

/* ------------------------------------------------------------------ */
/* table editing                                                       */
/* ------------------------------------------------------------------ */

const rows = (html) => (html.match(/<tr/g) || []).length
const press = (view, key, keyCode) => {
  const event = new window.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })
  Object.defineProperty(event, 'keyCode', { value: keyCode })
  Object.defineProperty(event, 'which', { value: keyCode })
  view.dom.dispatchEvent(event)
  return event.defaultPrevented
}
const caretAt = (view, node, offset) => {
  const pos = view.posAtDOM(node, offset)
  view.dispatch(view.state.tr.setSelection(view.state.selection.constructor.near(view.state.doc.resolve(pos))))
}

const tableRoot = document.createElement('div')
document.body.appendChild(tableRoot)
const tableEditor = editorLib.create({
  root: tableRoot,
  html: '<table><tbody><tr><th><p>库</p></th><th><p>覆盖</p></th></tr><tr><td><p>torchvision</p></td><td><p>图像</p></td></tr></tbody></table>',
})
const before = rows(tableEditor.getHtml())
const lastCell = tableRoot.querySelectorAll('td')[1]
caretAt(tableEditor.view, lastCell.querySelector('p'), 0)
const tabHandled = press(tableEditor.view, 'Tab', 9)
const afterTab = rows(tableEditor.getHtml())
check('tab in the last cell appends a row', afterTab === before + 1, { before, afterTab, tabHandled })

const firstCell = tableRoot.querySelectorAll('td')[0]
caretAt(tableEditor.view, firstCell.querySelector('p').firstChild, 0)
press(tableEditor.view, 'Backspace', 8)
check('backspace at a cell start keeps the table', /<table/.test(tableEditor.getHtml()) && rows(tableEditor.getHtml()) === afterTab)

/* selecting cells and pressing Delete empties them, the table stays */
const cellSelection = tableEditor.state.selection.constructor.create(
  tableEditor.state.doc,
  tableEditor.view.posAtDOM(tableRoot.querySelectorAll('td')[0], 0) + 1,
  tableEditor.view.posAtDOM(tableRoot.querySelectorAll('td')[1], 0) + 1,
)
tableEditor.view.dispatch(tableEditor.state.tr.setSelection(cellSelection))
press(tableEditor.view, 'Delete', 46)
const cleared = tableEditor.getHtml()
check('deleting a cell selection keeps the table', /<table/.test(cleared), cleared.slice(-160))

tableEditor.destroy()
tableRoot.remove()

/* the pane's caret helpers must produce TEXT selections, never cell ones */
const caretRoot = document.createElement('div')
document.body.appendChild(caretRoot)
const caretEditor = editorLib.create({
  root: caretRoot,
  html: '<table><tbody><tr><th><p>库</p></th><th><p>覆盖</p></th></tr><tr><td><p>torchvision</p></td><td><p>图像数据</p></td></tr></tbody></table>',
})
const caretCells = caretRoot.querySelectorAll('td')
const posInCell = (cell, offset) => caretEditor.view.posAtDOM(cell.querySelector('p').firstChild, offset)
caretEditor.placeCaret(posInCell(caretCells[0], 0))
const caret = caretEditor.view.state.selection
check('placeCaret makes a text caret inside a cell', caret.empty && !('$anchorCell' in caret), caret.from)

const spanned = caretEditor.selectText(posInCell(caretCells[0], 0), posInCell(caretCells[1], 1))
check('selecting across cells is left to the table plugin', spanned === false)

const wordFrom = posInCell(caretCells[0], 0)
const wordTo = posInCell(caretCells[0], 3)
const wordSelected = caretEditor.selectText(wordFrom, wordTo)
const wordSel = caretEditor.view.state.selection
check(
  'selecting characters inside a cell stays a text selection',
  wordSelected && wordSel.from === wordFrom && wordSel.to === wordTo && !('$anchorCell' in wordSel),
  { from: wordSel.from, to: wordSel.to, expected: [wordFrom, wordTo] },
)
caretEditor.destroy()
caretRoot.remove()

/* ------------------------------------------------------------------ */
/* to-do items                                                         */
/* ------------------------------------------------------------------ */

const taskRoot = document.createElement('div')
document.body.appendChild(taskRoot)
const taskEditor = editorLib.create({
  root: taskRoot,
  html: '<ul class="dsp-md-list"><li class="dsp-md-li dsp-md-task"><span class="dsp-md-check"></span><span>买菜</span></li><li class="dsp-md-li dsp-md-task"><span class="dsp-md-check dsp-md-check-on"></span><span>洗碗</span></li></ul>',
})
check('to-do items keep their box', taskRoot.querySelectorAll('li.dsp-md-task').length === 2 && taskRoot.querySelectorAll('.dsp-md-check').length === 2, taskRoot.innerHTML)
check('a done item renders a checked box', !!taskRoot.querySelector('li.dsp-md-task .dsp-md-check-on'))
check('the check mark is not document text', !/\u2713/.test(taskEditor.state.doc.textContent), taskEditor.state.doc.textContent)

const taskBox = taskRoot.querySelector('li.dsp-md-task .dsp-md-check')
taskBox.dispatchEvent(new window.MouseEvent('mousedown', { bubbles: true, cancelable: true }))
check('clicking the box checks the item', !!taskRoot.querySelector('li.dsp-md-task .dsp-md-check-on'), taskRoot.innerHTML)

const firstTask = taskRoot.querySelector('li.dsp-md-task')
const firstPara = firstTask.querySelector('p')
const firstText = firstPara.lastChild
caretAt(taskEditor.view, firstText, firstText.nodeValue.length)
press(taskEditor.view, 'Enter', 13)
const taskItems = taskRoot.querySelectorAll('li.dsp-md-task')
check('Enter opens another to-do item', taskItems.length === 3, taskRoot.innerHTML)
check(
  'the new to-do item starts unchecked',
  !!taskItems[1] && !taskItems[1].querySelector('.dsp-md-check-on') && (taskItems[1].textContent || '').trim() === '',
  taskItems[1] && taskItems[1].innerHTML,
)

taskEditor.destroy()
taskRoot.remove()

/* typing `- [ ] ` starts a to-do item, the way the Markdown shorthand does */
const typeRoot = document.createElement('div')
document.body.appendChild(typeRoot)
const typeEditor = editorLib.create({ root: typeRoot, html: '<p></p>' })
typeEditor.placeCaret(1)
const typed = typeEditor.view.someProp('handleTextInput', (rule) => rule(typeEditor.view, typeEditor.view.state.selection.from, typeEditor.view.state.selection.from, '- [ ] '))
check('typing "- [ ] " starts a to-do item', typed === true && !!typeRoot.querySelector('li.dsp-md-task'), typeRoot.innerHTML)
check('the typed to-do item is unchecked', !!typeRoot.querySelector('li.dsp-md-task') && !typeRoot.querySelector('.dsp-md-check-on'), typeRoot.innerHTML)
typeEditor.destroy()
typeRoot.remove()

/* ------------------------------------------------------------------ */
/* table structure                                                     */
/* ------------------------------------------------------------------ */

const gridRoot = document.createElement('div')
document.body.appendChild(gridRoot)
const grid = editorLib.create({
  root: gridRoot,
  html: '<table><tbody><tr><th><p>库</p></th><th><p>覆盖</p></th></tr><tr><td><p>torchvision</p></td><td><p>图像</p></td></tr></tbody></table>',
})
const gridRows = () => gridRoot.querySelectorAll('tr').length
const gridCells = () => (gridRoot.querySelector('tr') ? gridRoot.querySelector('tr').children.length : 0)
const cellCaret = () => {
  const cell = gridRoot.querySelector('th,td')
  const block = cell.querySelector('p') || cell
  const text = block.firstChild || block
  caretAt(grid.view, text, 0)
}
cellCaret()
check('the caret reports being in a table', grid.getSelection().inTable === true)
check('rowAfter adds a row', grid.tableCommand('rowAfter') === true && gridRows() === 3, gridRows())
cellCaret()
check('rowBefore adds a row', grid.tableCommand('rowBefore') === true && gridRows() === 4, gridRows())
cellCaret()
check('colAfter adds a column', grid.tableCommand('colAfter') === true && gridCells() === 3, gridCells())
cellCaret()
check('colBefore adds a column', grid.tableCommand('colBefore') === true && gridCells() === 4, gridCells())
cellCaret()
check('deleteColumn removes a column', grid.tableCommand('deleteColumn') === true && gridCells() === 3, gridCells())
cellCaret()
check('deleteRow removes a row', grid.tableCommand('deleteRow') === true && gridRows() === 3, gridRows())
const headerBefore = gridRoot.querySelector('tr').children[0].tagName.toLowerCase()
cellCaret()
grid.tableCommand('headerRow')
const headerAfter = gridRoot.querySelector('tr').children[0].tagName.toLowerCase()
check('headerRow switches the header row', headerBefore === 'th' && headerAfter === 'td', { headerBefore, headerAfter })
grid.undo()
check('undo brings the header back', gridRoot.querySelector('tr').children[0].tagName.toLowerCase() === 'th')
cellCaret()
grid.tableCommand('deleteTable')
check('deleteTable removes the table', !/<table/.test(grid.getHtml()), grid.getHtml().slice(0, 120))
grid.undo()
check('undo brings the table back', /<table/.test(grid.getHtml()))
grid.destroy()
gridRoot.remove()

/* ------------------------------------------------------------------ */
/* blocks, marks and pasting                                           */
/* ------------------------------------------------------------------ */

const blockCase = (kind, expect, label) => {
  const node = document.createElement('div')
  document.body.appendChild(node)
  const instance = editorLib.create({ root: node, html: '<p>正文</p>' })
  instance.placeCaret(1)
  const ok = instance.insertBlock(kind)
  check(label, ok === true && !!expect(node), node.innerHTML)
  instance.destroy()
  node.remove()
}
blockCase('h1', (n) => !!n.querySelector('h1'), 'insertBlock h1 makes a heading')
blockCase('h3', (n) => !!n.querySelector('h3'), 'insertBlock h3 makes a heading')
blockCase('bullet', (n) => !!n.querySelector('ul > li'), 'insertBlock bullet makes a list')
blockCase('ordered', (n) => !!n.querySelector('ol > li'), 'insertBlock ordered makes a numbered list')
blockCase('todo', (n) => !!n.querySelector('li.dsp-md-task'), 'insertBlock todo makes a to-do item')
blockCase('quote', (n) => !!n.querySelector('blockquote'), 'insertBlock quote makes a quote')
blockCase('code', (n) => !!n.querySelector('pre'), 'insertBlock code makes a code block')
blockCase('divider', (n) => !!n.querySelector('hr'), 'insertBlock divider makes a divider')
blockCase('table', (n) => !!n.querySelector('table') && n.querySelectorAll('tr').length === 3, 'insertBlock table makes a table')

const markRoot = document.createElement('div')
document.body.appendChild(markRoot)
const markEditor = editorLib.create({ root: markRoot, html: '<p>改这段</p>' })
const markText = markRoot.querySelector('p').firstChild
const markFrom = markEditor.view.posAtDOM(markText, 0)
const markTo = markEditor.view.posAtDOM(markText, 3)
markEditor.selectText(markFrom, markTo)
check('toggleMark bolds the selection', markEditor.toggleMark('strong') === true && /<strong/.test(markRoot.innerHTML), markRoot.innerHTML)
markEditor.selectText(markFrom, markTo)
check('setLink links the selection', markEditor.setLink('https://example.com') === true && /href="https:\/\/example.com"/.test(markRoot.innerHTML), markRoot.innerHTML)
markEditor.selectText(markFrom, markTo)
check('an empty link removes it', markEditor.setLink('') === true && !/<a /.test(markRoot.innerHTML), markRoot.innerHTML)
markEditor.placeCaret(4)
check('pasteHtml turns HTML into blocks', markEditor.pasteHtml('<p>粘贴的一段</p>') === true && /粘贴的一段/.test(markRoot.innerHTML), markRoot.innerHTML)
check('pasteText inserts the text', markEditor.pasteText('纯文本') === true && /纯文本/.test(markRoot.innerHTML), markRoot.innerHTML)
markEditor.placeCaret(markEditor.state.doc.content.size - 1)
markEditor.view.dispatch(markEditor.view.state.tr.insertText('/biaoti'))
check('clearSlash drops the typed slash', markEditor.clearSlash() === true && !/\/biaoti/.test(markEditor.getHtml()), markEditor.getHtml())
check('insertBlock after clearSlash still works', markEditor.insertBlock('h2') === true && /<h2/.test(markRoot.innerHTML), markRoot.innerHTML)
markEditor.destroy()
markRoot.remove()

/* ------------------------------------------------------------------ */
/* block handle: move, copy, delete, convert                           */
/* ------------------------------------------------------------------ */

const gripRoot = document.createElement('div')
document.body.appendChild(gripRoot)
const gripEditor = editorLib.create({ root: gripRoot, html: '<p>第一段</p><p>第二段</p><p>第三段</p>' })
const posOf = (text) => {
  const found = Array.from(gripRoot.querySelectorAll('p')).filter((p) => p.textContent.indexOf(text) >= 0)
  return found.length ? gripEditor.blockPosAtDom(found[0]) : -1
}
check('blockPosAtDom finds a block', posOf('第二段') > 0, String(posOf('第二段')))
check('blockMove up swaps two blocks', gripEditor.blockMove(posOf('第二段'), 'up') === true
  && gripEditor.getHtml().indexOf('第二段') < gripEditor.getHtml().indexOf('第一段'), gripEditor.getHtml())
check('blockMove down swaps back', gripEditor.blockMove(posOf('第二段'), 'down') === true
  && gripEditor.getHtml().indexOf('第一段') < gripEditor.getHtml().indexOf('第二段'), gripEditor.getHtml())
check('blockCopy duplicates the block', gripEditor.blockCopy(posOf('第二段')) === true
  && (gripEditor.getHtml().match(/第二段/g) || []).length === 2, gripEditor.getHtml())
check('blockMoveTo puts a block first', gripEditor.blockMoveTo(posOf('第三段'), posOf('第一段'), true) === true
  && gripEditor.getHtml().indexOf('第三段') < gripEditor.getHtml().indexOf('第一段'), gripEditor.getHtml())
check('blockConvert makes a heading', gripEditor.blockConvert(posOf('第一段'), 'h2') === true
  && /<h2[^>]*>第一段<\/h2>/.test(gripEditor.getHtml()), gripEditor.getHtml())
check('blockConvert makes a to-do item', gripEditor.blockConvert(posOf('第二段'), 'todo') === true
  && /<li[^>]*dsp-md-task[^>]*>[\s\S]*?第二段/.test(gripEditor.getHtml()), gripEditor.getHtml())
check('blockDelete removes the block', gripEditor.blockDelete(posOf('第三段')) === true
  && !/第三段/.test(gripEditor.getHtml()), gripEditor.getHtml())
check('undo brings the deleted block back', gripEditor.undo() === true && /第三段/.test(gripEditor.getHtml()), gripEditor.getHtml())
gripEditor.destroy()
gripRoot.remove()

if (failed) {
  console.log(failed + ' failure(s)')
  process.exit(1)
}
console.log('vendor editor cases passed')
