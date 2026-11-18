# dsh-doc-pane

English | [简体中文](README.md)

`dsh-doc-pane` adds a document workspace to the DeepSeek Harness right sidebar. Open the Markdown file for the current session, edit it directly, or send a selection to a model for rewriting and questions.

Current version: `0.1.3`

## Features

- Open Markdown, MDX, and plain-text files in the DSH sidebar.
- Edit headings, lists, quotes, tables, task lists, code blocks, links, and common inline formatting.
- Use native single-click caret placement, double-click selection, drag selection, wrapped-line selection, and cross-block selection.
- Use an IME, undo and redo, copy and paste, and common Markdown shortcuts.
- Ask questions about selected text or request rewriting, shortening, expansion, translation, and other edits.
- See “Saved” only after the file has been written successfully.
- Detect external changes and save conflicts before overwriting content.

## Install

### Install from a checkout or GitHub release

```bash
git clone --branch v0.1.3 https://github.com/xvxianjin/dsh-doc-pane.git
```

Run `install_bundle` in DSH Plugin Manager with the checkout directory as the target, then restart DSH.

### Install from npm

Run `install_bundle` in DSH Plugin Manager with this target:

```text
dsh-doc-pane
```

The npm `latest` tag is updated separately by the maintainer. If npm is behind the latest GitHub Release, use the checkout or release archive above.

After installation, the session header shows a Documents button.

## First use

1. Open a DSH session.
2. Select Documents in the session header.
3. Choose a file from the list, or paste a file or directory path.
4. Edit the document directly, or select text and send a message in the sidebar composer.

Selecting a `.md`, `.mdx`, or `.txt` link in chat also opens it in the document tab.

## Editing

The editor uses ProseMirror while continuing to read and write the real Markdown file on disk.

| Action | Shortcut or input |
| --- | --- |
| Heading | `#` through `######`, then Space |
| Bullet list | `-` or `*`, then Space |
| Numbered list | `1.`, then Space |
| Quote | `>`, then Space |
| Code block | Three backticks |
| Divider | `---`, then Enter |
| Save | `Ctrl+S`, or wait 1.2 seconds after typing |
| Undo / redo | `Ctrl+Z` / `Ctrl+Shift+Z` |
| Bold / italic / strike | `Ctrl+B` / `Ctrl+I` / `Ctrl+Shift+X` |
| Heading level | `Ctrl+Alt+1` through `Ctrl+Alt+3` |
| Lists | `Ctrl+Shift+7` / `Ctrl+Shift+8` |
| Indent | `Tab` / `Shift+Tab` |
| Tables | `Tab` moves to the next cell and appends a row after the last cell |

Pasting keeps headings, lists, tables, quotes, and code blocks while removing unrelated external styling. Stable code-block views also ignore responsive attributes added by host plugins, so those decorations do not rebuild the editor DOM during a mouse selection.

## AI editing and questions

The sidebar composer has no separate rewrite or question mode. The model reads the message and quoted selection, then decides whether to edit the text or answer a question.

Examples:

```text
Shorten this paragraph without losing technical terms.
What does this sentence mean?
Translate this section into English.
Remove the duplicated second sentence.
```

An AI edit is applied to the document and marked for review. If the file changed while the response was being generated, the stale edit is rejected and a conflict is reported.

The model follows the current session by default. Another available model can be selected in the sidebar. Model and skill lists come from the current DSH session.

## Session context

When a document is opened from a `.md`, `.mdx`, or `.txt` link in chat, the pane binds it to the session that owns the link. Each question or rewrite request reads recent text messages from that centre session and includes them as model background.

- Up to the latest 8 turns are read, with a total limit of 6,000 characters and 1,200 characters per turn.
- The sidebar's own latest 10 exchanges are also sent to keep the side conversation continuous.
- If you switch the centre session while the document remains open, the document stays bound to its original session. Open it again from a link in the new session to use the new context.
- Closing the document, returning to the document list, or opening another document clears the sidebar's own transcript.
- Context loading is best effort. If DSH does not expose its session query service, or the read fails, questions and rewrites still work without centre-session background.

This context covers recent text messages. Full history, images, attachments, and tool-call results are not guaranteed to be included, and sidebar messages are not written back into the centre conversation.

## Saving and conflicts

- The pane reads and writes real files on disk.
- A document can contain up to 4 MiB of UTF-8 data.
- Saves compare file versions and report success only after the write finishes.
- Open documents are checked for external changes every six seconds.
- The pane refreshes automatically when there are no unsaved edits. If both copies changed, the pane reports a conflict.
- The pane never chooses a document to open on its own. Changing a session or directory only updates the available list.

## Configuration

The pane uses the current session working directory by default. To use a fixed directory, add this to the profile Cordis patch:

```yaml
- id: dsh-doc-pane
  name: dsh-doc-pane
  config:
    root: C:/path/to/notes
```

Supported document extensions are `.md`, `.markdown`, `.mdx`, and `.txt`.

## Compatibility

Version 0.1.3 was tested with DSH `0.2.2-rc.3` on Windows and the following plugin combination:

- `@linxin666/dsh-web-all`
- `dsh-quote-annotate-pro`
- `dsh-better-sidebar`
- DSH right-sidebar, quote-annotation, and theme plugins

`dsh-web-all` decorates editable regions with `data-dsh-responsive-part`. The document pane ignores this decoration inside code blocks through a stable ProseMirror node view, so text selection does not require disabling that plugin.

The compatibility result covers only the tested DSH version, operating system, and plugin combination.

## Troubleshooting

### The Documents button is missing

Confirm that the bundle is installed in the active profile, enabled, and loaded after a full DSH restart.

### The editor failed to load

Confirm that `vendor/editor.js` exists in the installed package or checkout. Copying only `index.js` and `client.js` is not sufficient.

### Saving reports a conflict

The file changed outside the pane. Review the new disk content before reloading or replacing it.

### DSH cannot start after installing the plugin

On Windows, close DSH and run `recover-profile.cmd`. It backs up the current profile and removes this plugin’s bundle entry so DSH can start again.

## Development

Install the editor build dependencies and run all checks:

```bash
npm --prefix tools/editor ci
npm test
```

`npm test` runs host/client syntax checks, Node tests, and the editor smoke suite.

After changing `tools/editor/`, rebuild the runtime artifact:

```bash
npm --prefix tools/editor run build
```

The build writes `vendor/editor.js`. Users run this prebuilt file and do not build the editor during installation.

Inspect npm package contents with:

```bash
npm pack --dry-run
```

## Repository layout

| Path | Purpose |
| --- | --- |
| `index.js` | DSH host half and HTTP API |
| `client.js` | Sidebar UI and document editor integration |
| `vendor/editor.js` | Prebuilt ProseMirror kernel |
| `tools/editor/` | Editor source, build script, and smoke tests |
| `tests/` | Host route, persistence, and state tests |
| `cordis.patch.yml` | DSH profile patch |
| `recover-profile.cmd` / `.ps1` | Windows profile recovery scripts |

## License

MIT © 2026 Xianjin Xv. See [LICENSE](LICENSE).
