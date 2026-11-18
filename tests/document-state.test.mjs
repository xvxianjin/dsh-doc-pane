import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'

// Exercise the panel callbacks with deterministic Host responses, without mounting DSH.
const src = readFileSync(new URL('../client.js', import.meta.url), 'utf8')
const block = (from, to) => {
  const i = src.indexOf(from), j = src.indexOf(to, i + from.length)
  assert.ok(i >= 0 && j > i, from)
  return src.slice(i, j)
}
const deferred = () => Promise.withResolvers()
const ref = current => ({current})
function panel() {
  const s = { React: {useCallback: cb => cb, useEffect: () => {}}, window: {clearTimeout(){}, confirm: () => false}, t: x => x,
    life: ref({version:'a'}), path:'a.md', pathRef: ref('a.md'), mtimeRef:ref(1), savedRef:ref('old'), contentRef:ref('old'), dirtyRef:ref(false), docSessionRef:ref('s'), eolRef:ref('\n'),
    pmTimerRef:ref(0), pmRef:ref(null), domDirtyRef:ref(false), pmContentRef:ref(''), serializeMarkdown: x => x,
    flash:x => s.notice=x, composer:'edit', selection:{text:'old', start:0,end:3}, thinking:false, messages:[], name:'a.md', content:'old', modelPick:null, pickedSkills:[], session:'s', readPending:()=>[], toDisk:x=>x }
  for (const k of ['Path','Name','Content','Saved','Mtime','Messages','Pending','Selection','Conflict','Composer','Thinking','Notice','DocBusy','DocError','DocSession']) s['set'+k] = x => { s[k] = typeof x === 'function' ? x(s[k] || []) : x }
  vm.runInNewContext(block('const adoptDisk =', '        /**\n         * Lists the documents') + block('const writeFileNow =', '        /**\n         * Where a mark') + block('const sendChat =', '        React.useEffect(') + 'Object.assign(globalThis,{openFile,leaveDocument,writeFileNow,sendChat})', s)
  return s
}
test('pending PM edits block navigation, and older opens cannot replace a newer document', async () => {
  const s=panel(), a=deferred(), b=deferred()
  s.pmTimerRef.current=1; s.pmRef.current={view:{dom:'edited'}}
  assert.equal(s.leaveDocument(),false); assert.equal(s.contentRef.current,'edited')
  s.window.confirm=()=>true; s.readDoc=p=>p==='A'?a.promise:b.promise
  const first=s.openFile('A'), second=s.openFile('B')
  b.resolve({path:'B',version:'b',mtime:2,content:'new\r\n'}); assert.equal(await second,true)
  a.resolve({path:'A',version:'a',mtime:1,content:'old'}); assert.equal(await first,false)
  assert.equal(s.Path,'B'); assert.equal(s.Saved,'new\n'); assert.equal(s.life.current.version,'b')
})
test('polling continues after an unchanged read, catches same-mtime changes and ignores late reads', async () => {
  const s=panel(), late=deferred(); let tick, cleanup
  Object.assign(s,{open:true,pendingFragments:()=>[],readDoc:async()=>({version:'a',mtime:1,content:'old'})})
  Object.assign(s.window,{setInterval:cb=>{tick=cb},clearInterval(){},setTimeout(){}})
  s.React.useEffect=cb=>{cleanup=cb()}
  vm.runInNewContext(block('React.useEffect(() => {\n          if (!open || !path) return undefined\n          const owner', '        const trackSelection'),s)
  await tick(); assert.equal(s.Saved,undefined)
  s.readDoc=async()=>({version:'b',mtime:1,content:'external'}); await tick(); assert.equal(s.Saved,'external')
  s.dirtyRef.current=true; s.readDoc=async()=>({version:'c',mtime:1,content:'newer'}); await tick(); assert.equal(s.Conflict.version,'c'); assert.equal(s.Saved,'external')
  s.readDoc=()=>late.promise; const pending=tick(); cleanup(); late.resolve({version:'d',mtime:4,content:'late'}); await pending; assert.equal(s.Conflict.version,'c')
})
test('queued saves use the last committed version; a late save cannot update another document', async () => {
  const s=panel(), a=deferred(), b=deferred(), calls=[]
  s.writeDoc=p=>{calls.push(p); return calls.length===1?a.promise:b.promise}
  const first=s.writeFileNow('one'), second=s.writeFileNow('two'); await Promise.resolve()
  assert.equal(calls.length,1); assert.equal(calls[0].expectedVersion,'a')
  a.resolve({version:'v2',mtime:2}); await first; await Promise.resolve()
  assert.equal(calls[1].expectedVersion,'v2'); assert.equal(calls[1].expectedMtime,2)
  s.leaveDocument(); b.resolve({version:'v3',mtime:3}); assert.equal(await second,false); assert.equal(s.Saved,'')
})
test('AI rejects changed buffers and reports success only after writing, including whitespace replacements', async () => {
  const s=panel(), ai=deferred(), write=deferred(); s.chatDoc=()=>ai.promise
  const stale=s.sendChat(); s.contentRef.current='edited'; ai.resolve({kind:'edit',text:'wrong'}); await stale
  assert.equal(s.notice,'staleReply'); assert.equal(s.Saved,undefined)
  s.contentRef.current='old'; s.chatDoc=async()=>({kind:'edit',text:'  '}); let sent
  s.writeDoc=p=>{sent=p; return write.promise}; const run=s.sendChat()
  await new Promise(resolve=>setImmediate(resolve)); assert.equal(sent.content,'  '); assert.equal(s.Messages.at(-1).role,'user')
  write.reject(Error('disk full')); await run; assert.equal(s.Messages.at(-1).note,'saveFailed'); assert.equal(s.Messages.at(-1).error,true)
})
