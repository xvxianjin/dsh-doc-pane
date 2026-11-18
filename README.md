# dsh-doc-pane

[English](README.en.md) | 简体中文

`dsh-doc-pane` 是 DeepSeek Harness 的右栏文档插件。它让当前会话正在处理的 Markdown 文件直接出现在 DSH 侧栏里，可以像普通文档一样编辑，也可以把选中的文字交给模型改写或提问。

当前版本：`0.1.3`

## 主要能力

- 在右栏打开 Markdown、MDX 和纯文本，不需要单独的编辑页面。
- 支持标题、列表、引用、表格、任务列表、代码块、链接和常用行内格式。
- 单击定位、双击选词、拖动选择、跨行选择、跨段落和跨块选择均使用浏览器原生选区。
- 中文输入法、撤销重做、复制粘贴和常用 Markdown 快捷键可直接使用。
- 选中文字后可直接向模型提问，或让它润色、精简、扩写、翻译和改写。
- AI 修改与磁盘保存分开反馈，写盘成功后才显示“已保存”。
- 检测外部修改和保存冲突，避免静默覆盖。

## 安装

### 从源码或 GitHub 发布包安装

```bash
git clone --branch v0.1.3 https://github.com/xvxianjin/dsh-doc-pane.git
```

在 DSH 的插件管理器中执行 `install_bundle`，把 target 指向该目录，然后重启 DSH。

### 从 npm 安装

在 DSH 插件管理器中执行 `install_bundle`，target 填：

```text
dsh-doc-pane
```

npm 上的 `latest` 版本由维护者单独发布。如果这里显示的版本落后于 GitHub Release，请优先按上面的源码或发布包方式安装。

安装后，会话标题栏会出现“文档”按钮。

## 开始使用

1. 打开一个 DSH 会话。
2. 点击会话标题栏中的“文档”按钮。
3. 从文件列表选择文档，或在路径输入框中粘贴文件或目录路径。
4. 直接在正文中编辑，或者选中一段文字后在侧栏底部发送消息。

点击对话中的 `.md`、`.mdx` 或 `.txt` 链接时，文档也会在侧栏标签中打开。

## 文档编辑

编辑器使用 ProseMirror，文件仍是磁盘上的真实 Markdown。常见功能包括：

| 操作 | 方式 |
| --- | --- |
| 标题 | 输入 `#` 到 `######` 后按空格 |
| 无序列表 | 输入 `-` 或 `*` 后按空格 |
| 有序列表 | 输入 `1.` 后按空格 |
| 引用 | 输入 `>` 后按空格 |
| 代码块 | 输入三个反引号 |
| 分隔线 | 输入 `---` 后回车 |
| 保存 | `Ctrl+S`，停止输入 1.2 秒后也会自动保存 |
| 撤销/重做 | `Ctrl+Z` / `Ctrl+Shift+Z` |
| 加粗/斜体/删除线 | `Ctrl+B` / `Ctrl+I` / `Ctrl+Shift+X` |
| 标题级别 | `Ctrl+Alt+1` 到 `Ctrl+Alt+3` |
| 列表 | `Ctrl+Shift+7` / `Ctrl+Shift+8` |
| 缩进 | `Tab` / `Shift+Tab` |
| 表格 | `Tab` 跳到下一格，末格继续前进时追加一行 |

粘贴会保留标题、列表、表格、引用和代码块等结构，同时移除无关的外部样式。编辑器会忽略宿主插件添加的响应式属性变化，避免代码块被反复重建并打断鼠标选区。

## AI 改写与提问

底部的侧栏对话区没有“改写/询问”模式切换。模型会读取你的消息和引用内容，并判断应该修改文字还是回答问题。

示例：

```text
把这段精简一下，保留技术术语。
这句话是什么意思？
将这一节翻译成英文。
删掉重复的第二句。
```

AI 改写会直接写回文档，并把改动标记为待确认。若文件在生成期间发生变化，插件会拒绝应用旧修改并提示冲突。

模型默认跟随当前会话，也可以在侧栏中指定其他可用模型。模型和技能列表来自当前 DSH 会话。

## 保存与冲突

- 插件读取和保存真实磁盘文件。
- 单篇文档上限为 4 MiB，按 UTF-8 字节计算。
- 保存前比较文件版本，写入成功后才更新“已保存”状态。
- 文档打开期间每 6 秒检查一次外部变化。
- 没有未保存修改时会自动刷新；存在冲突时停止覆盖并提示处理。
- 面板不会自行打开用户的某个文档。切换会话或目录只会更新可用列表。

## 配置

默认使用当前会话的工作目录。需要固定目录时，可在 profile 的 Cordis patch 中设置：

```yaml
- id: dsh-doc-pane
  name: dsh-doc-pane
  config:
    root: C:/path/to/notes
```

可访问的文档类型为 `.md`、`.markdown`、`.mdx` 和 `.txt`。

## 兼容性

v0.1.3 已在 DSH `0.2.2-rc.3`、Windows 桌面端和当前完整插件组合中验证，包括：

- `@linxin666/dsh-web-all`
- `dsh-quote-annotate-pro`
- `dsh-better-sidebar`
- DSH 右侧栏、引用批注和主题相关插件

`dsh-web-all` 会向编辑区添加 `data-dsh-responsive-part` 属性。文档插件通过稳定代码块 NodeView 忽略这类装饰变化，因此鼠标选择不依赖关闭该插件。

兼容性结论只覆盖实际测试过的 DSH 版本、操作系统和插件组合。

## 常见问题

### 安装后没有“文档”按钮

确认 bundle 已安装到当前 profile，并在安装后完整重启 DSH。检查 profile 中的 `dsh-doc-pane` 条目是否启用。

### 文档编辑器没有加载

确认 npm 包或安装目录中包含 `vendor/editor.js`。不要只复制 `index.js` 和 `client.js`。

### 保存提示冲突

文件在面板打开期间被其他程序修改。先查看磁盘上的新内容，再决定重新载入或覆盖保存。

### DSH 因插件配置无法启动

Windows 用户可以退出 DSH 后运行 `recover-profile.cmd`。脚本会备份当前 profile，并移除本插件的 bundle 条目，让 DSH 可以重新启动。

## 开发

安装编辑器构建依赖并运行全部验证：

```bash
npm --prefix tools/editor ci
npm test
```

`npm test` 会执行 host/client 语法检查、Node 测试和编辑器 smoke test。

修改 `tools/editor/` 后需要重建并提交运行产物：

```bash
npm --prefix tools/editor run build
```

构建输出是 `vendor/editor.js`。插件运行时使用这个预构建文件，不在用户机器上构建。

检查 npm 包内容：

```bash
npm pack --dry-run
```

## 仓库结构

| 路径 | 用途 |
| --- | --- |
| `index.js` | DSH host half 和 HTTP API |
| `client.js` | 右栏界面、文档列表和编辑集成 |
| `vendor/editor.js` | 预构建的 ProseMirror 内核 |
| `tools/editor/` | 编辑器源码、构建脚本和 smoke test |
| `tests/` | Host 路由、保存和状态测试 |
| `cordis.patch.yml` | DSH profile patch |
| `recover-profile.cmd` / `.ps1` | Windows 配置恢复脚本 |

## License

MIT © 2026 Xianjin Xv，见 [LICENSE](LICENSE)。
