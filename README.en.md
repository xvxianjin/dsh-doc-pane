# dsh-doc-pane

English | [简体中文](README.md)

Open, edit and rewrite the Markdown document the current session is working on, in a side panel of the DSH Web GUI. Select text and hand it to the model: it decides whether to rewrite it or answer about it. A rewrite lands in the document and is highlighted as pending — click the highlight to accept, undo, or comment on it. Every request carries the conversation so far as context.

## Install

Requires DeepSeek Harness (DSH) desktop.

**From npm (recommended)**

In DSH, run `plugin_manager` → `install_bundle` with target `dsh-doc-pane`, then restart DSH.

**From source**

1. Clone this repository anywhere.
2. Run `plugin_manager` → `install_bundle` with the directory as target.
3. Restart DSH.

After install, a "Docs" button appears in the session header.

Manual install: merge the entry from `cordis.patch.yml` into the profile's Cordis config and add `"dsh-doc-pane": "^0.1.0"` (or `"link:<this directory>"` for a local checkout) to the profile `package.json` dependencies.

## Usage

1. Open a session and click the "Docs" button next to the session title (`conversation.session.header.actions`).
2. The panel opens as a tab in the right sidebar (alongside "Start / Files / Git"), without covering the conversation. Which document opens depends on two things only: **click a document link in the conversation** and that document opens; **click the "Docs" button** and you get the list — there is no "follow whatever the agent is editing" auto-jump. The list shows the most recently modified Markdown files in the session working directory (newest first); click one to start editing.
2b. Clicking a `.md` / `.txt` link in the conversation also opens that file in this panel's tab, titled with the file name. It claims the whole address family (`dsh-resource://file/**/*.md` etc.): within the same tier, rules are ordered by matched pattern length, which is longer than `dsh-better-sidebar`'s file type (`dsh-resource://file/**`), so it sorts first. The panel parses path and session out of the address and opens it; if the sidebar never hands the address to the tab content, the panel falls back to the recently modified list.
3. To open another document, paste a path into the input above the list and press Enter. A **document** opens; a **folder** switches the list to that folder (absolute and workspace-relative paths both work). You can also click "Open folder…" to pick a directory with the system dialog, or "Back to workspace" to return to the session working directory.
4. What opens is a **directly editable document** (like Feishu Docs), with no separate edit page; the header keeps a "Source" toggle for the raw Markdown.
   - The document view is driven by a built-in editor kernel (ProseMirror, `vendor/editor.js`, served by the host at `/dsh-doc-pane/api/vendor/editor.js`): undo/redo, IME input, three levels of list indentation, `Tab` to move between table cells (one more `Tab` in the last cell appends a row), drag to select multiple cells and `Delete` to clear them, Backspace at the start of a cell never merges the table away, cell widths are evenly distributed per column instead of squeezed by content, dragging text inside a cell is a normal text selection (no whole-cell selection, no cursor stuck outside the table), and line breaks inside code blocks are all handled by the kernel — the panel no longer keeps its own editing state.
   - Type and formatting applies immediately: `##` + space becomes a heading (`#`…`######` alike), `-` or `*` + space an unordered list, `1.` + space an ordered list, `>` + space a quote, three backticks a code block, `---` + Enter a horizontal rule.
   - Inline marks are immediate too: typing `**bold**`, `*italic*`, `` `code` ``, `~~strike~~`, `[link](url)` and closing it turns it into the mark. Paste takes plain text only, without external styling.
   - Shortcuts: `Ctrl+Z` / `Ctrl+Shift+Z` undo/redo, `Ctrl+B` bold, `Ctrl+I` italic, `Ctrl+Shift+X` strikethrough, `Ctrl+Alt+1..3` headings, `Ctrl+Shift+7/8` ordered/unordered list, `Tab` / `Shift+Tab` indent.
   - Autosaves 1.2 s after you stop typing; `Ctrl+S` saves at once. Layout is preserved: heading levels, lists, quotes, tables, images, task lists, code blocks with a language label. If the kernel is unavailable the panel falls back to a built-in editable view — same features, minus the undo stack.
5. The panel is not stolen by other conversations: while you read document A and switch to another conversation that is editing a document, the panel stays on A (read, save and chat all keep using the working directory of the session that owns it). When the document belongs to another session, a "Back to current session" button appears in the header: it closes the document and returns to the current conversation's document list (just the list — it never opens a file for you).
6. If the font size is off, use the header's `−  110%  +` zoom: click the percentage to reset to 100%, or `Ctrl + wheel` on the panel; zoom applies to body text, code, tables, the editor and the bottom chat area (never pushing the panel out of the sidebar) and the choice is remembered. Wide screens start at 115%.
7. The bottom of the panel is a chat area: one input box, like the main chat, with no "rewrite / ask" mode — say "shorten this" and it edits; ask "what does this sentence mean" and it answers. The model decides. The input sits in its own white card (a grey backdrop separates chat from document): the quote is above the card, and a row of tools below picks the **model** (follows the session by default, or pin e.g. deepseek-v4-pro) and **skills** (multi-select, up to 4, shown as removable tags). With no messages yet the chat area takes only one card's height; after the first message the transcript appears and its top edge can be dragged to resize, and the height is remembered.
8. Skills work as in the main chat — the model decides whether to use them: every request carries the skill catalog (name + one-line description), and when the model replies `{"kind":"skill","names":[…]}` the panel inlines the full skill text and asks again (at most two, and only one extra round-trip when actually used). Skills you tick manually are always included and shown as tags. The difference: skills only supply instruction text; the panel runs no scripts or tools from them (it is a single model call, not a full agent session) — work that needs scripts belongs in the main chat.
9. Select text **in the document** and a quote appears above the input (click × to drop it, or click empty space in the document); the quote travels with the message and the model decides whether to rewrite that text or answer about it. For a rewrite, the new text is **written into the document and saved**, the changed passage is highlighted as pending, and the chat only shows "Applied and saved" — no accept-first diff card. **The selection is a location, not a string**: the built-in view renders every block and inline fragment with its source offset (`data-src`), so a selection from a heading through a code block to the next paragraph still lands on the right range; the editor kernel has no such offsets, so it locates the selection by "block containing the selection + visible text + nearby position" (nearest to the current block when the same sentence appears more than once). Neither side requires an exact string: `**`, code-fence language lines, table `|`, doubled heading markers like `## ##` are skipped; when it still cannot be located, no quote is produced and no error is shown. The document is edited as LF and saved with the file's original line endings, so CRLF files locate correctly too. When a change contains inline marks such as `code` or **bold**, or several blocks change at once, each block is marked pending separately (the highlight covers the whole block) and clicking any of them opens the same menu. **Deletion** uses the same suggestion mode: quote the passage, say "delete it", the model returns an empty replacement and the panel removes it — a heading or list item loses its `## ` / `- ` marker too, and blank lines do not double up; the deleted text is **put back in place as red strikethrough** (like Google Docs / Feishu suggestion mode, so you can still see it), and clicking it offers "Accept / Reject and restore": accept removes it for real, restore puts the original back character for character (newlines included). A deleted whole line gets its own strikethrough line where it was. Quoting a **heading** deletes the whole section (from that heading to the next heading of the same or higher level), not just the heading line, and the following headings are not orphaned; the strikethrough shows a short summary (first line plus an ellipsis) and clicking it still restores the whole section exactly. Selecting text never opens the highlight menu by mistake (selection wins).
10. If the agent (or another window) changes the file while the panel is open, reloading highlights the **changed lines as pending**: click a highlight in the preview to get "Accept / Reject and restore / Comment" — accept dismisses that change; reject restores that passage to its previous text and saves; comment puts it in the quote above the input so you can say how to change it. In the editor view, putting the cursor in that text also counts as accepting, with a colour band on the left; the header's "Pending N" marks everything read at once; a new batch of changes scrolls to the first one. Highlights are never written to the file or left permanently in the document. Marks are kept per file in browser local storage (`localStorage`, only the changed fragments, originals and positions): reopen the same document after restarting DSH and, if the file has not changed again, the pending marks return; once the file changes they are recomputed from the new content, never left stale.
11. Requests include the conversation so far and earlier panel exchanges, so the model understands the document's context; `Ctrl+S` saves; the sidebar owns its splitter width and tab closing.

Documents opened in the panel are real files on disk, and saving writes them directly; if the agent changes the same file while the panel is open, the panel checks every 6 seconds and refreshes automatically when there are no unsaved edits, and saving reports a conflict otherwise. Documents outside the workspace can be opened and edited too, limited to Markdown / plain text (`.md` `.markdown` `.mdx` `.txt`).

The panel never opens a document on its own: switching sessions, switching directories and opening the panel only list; only three explicit actions open a file — "click a link", "click a list item", "paste a path and press Enter".

## Structure

| File | Purpose |
| --- | --- |
| `index.js` | Host half: registers the `/dsh-doc-pane/api/{health,recent,stat,read,write,rewrite,chat,models,skills}` routes, resolves the root per session, scans Markdown (any directory can be given), reads and writes files, calls `llm.stream` for rewriting/chat, pulls conversation context with `sessionQuery.readSurface` and assembles skill descriptions with the `skills` service |
| `client.js` | Browser half: the right-sidebar tab type `doc-pane`, its tab panel and the session header button — the directly editable document view (ProseMirror kernel plus Markdown↔DOM conversion), the source view, pending highlights and their menu, and the chat area |
| `vendor/editor.js` | Prebuilt editor kernel (ProseMirror, ~320 KB, `window.DshDocEditor`), served on demand by a host route; rebuild it when you change it, see below |
| `tools/editor/` | Kernel source and build scripts (`entry.js`, `build.mjs`, `smoke.cjs`, locked dependencies) — only needed when changing the kernel |
| `cordis.patch.yml` | Inserts `dsh-doc-pane` into the profile's Cordis config |
| `recover-profile.cmd` / `recover-profile.ps1` | Rescue script for when DSH will not start: restore `cordis.patch.yml` from a backup and remove this plugin from the profile bundles so the app opens again |

How the panel attaches to the sidebar: `ctx.sidebarRightTabs.register({ id, kind: 'doc-pane', patterns: ['dsh-resource://file/**/*.md', …], priority: 'extension', canOpen, title })` declares a tab type, the tab content is registered at `sidebar.right.pane.tab` (same key as the type id), and the header button calls `ctx.sidebarRight.openTab('doc-pane')`. With `patterns` it also takes over document links in the conversation: the sidebar picks the type by address and, within the same tier, compares matched pattern length (ours are 28–33 characters, `dsh-better-sidebar`'s `dsh-resource://file/**` only 23), and the `extension` tier itself outranks the built-in preview's `fallback` tier.

How addresses reach the panel: the sidebar does not inject the address into the tab content, so the panel wraps every entry point on `ctx.get('sidebarRight')` — `openResource(address)`, `placeResource(session, actions, address, options)`, `openResourceIn(pane, address, options)` (different callers do not all use the same one): on a text-like address it records path/session in the panel module's `visibility.link` (with an incrementing sequence so two clicks in the same millisecond are not mistaken for one) and then opens its own tab directly with `openTab('doc-pane')` (rather than handing it to address ordering, which could let another plugin take it before the type is registered at early boot); non-text addresses pass through untouched. `title(address)` also records the address as a fallback. The panel subscribes to that record, parses path and session with `parseFileAddress` and opens it; if the tab still shows a previous document, the new record replaces it.

Root resolution order: `config.root` → session working directory (host `workingDirectory.ensure(agent)`) → the most recently active session's working directory → `workingDirectory.defaultDirectory` → `process.cwd()`. With no session it no longer falls back to the profile directory. Optional config:

```yaml
- id: dsh-doc-pane
  name: 'dsh-doc-pane'
  config:
    root: 'C:/path/to/notes'
```

## Development

After changing `index.js`, disable and re-enable the plugin in plugin management so the host half reloads; restarting DSH once also picks up the new version. `client.js` likewise takes effect after a restart.

To change the editor kernel (shortcuts, schema, and pending-highlight position calculation live there):

```bash
cd tools/editor
npm install          # first time, or after upgrading dependencies
node build.mjs       # regenerates ../../vendor/editor.js (commit this artifact)
node build.mjs --test # also runs the jsdom smoke tests
```

`vendor/editor.js` is a committed artifact: the plugin has no build step at runtime; the host serves it to the page as a static script.

## When it will not start

The third button in the crash dialog ("disable third-party plugins, back up the profile patch and restart") truncates `cordis.patch.yml` to about 700 bytes while recovering, losing the `agent-default-model`, `web-ui-pet`, `dsh-ops-file` and `dsh-ops-shell` blocks. The middle "restart" button merely restarts on the same config, so if the cause is still there you cannot get back in.

So: **quit DSH first**, then double-click `recover-profile.cmd`. It

1. saves the current `cordis.patch.yml` as `cordis.patch.yml.bak-before-recover-<timestamp>`;
2. restores the newest `cordis.patch.yml.bak-*` in the directory that is larger than 1000 bytes (the truncated one is only a few hundred bytes and will not be chosen);
3. removes this plugin from `dsh.profile.bundles` in `package.json` (the `link:` in `dependencies` stays), then reopen DSH.

To install the plugin again: `plugin_manager install_bundle` pointing at this directory. The host half's route registration is wrapped in try/catch, so a failed registration only loses an endpoint, never activation.

The client half declares no `inject`: declaring a service that is not ready yet makes Cordis leave the entry in `loading`, and the web boot audit treats that as fatal (`web boot: 1 entry did not activate`). Always get services with `ctx.get` and register later, when the service appears.

## License

MIT © 2026 Xianjin Xv, see [LICENSE](LICENSE).
