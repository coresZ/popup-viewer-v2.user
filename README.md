# Popup Viewer V2 · 页内弹窗打开新帖

[![CI](https://github.com/coresZ/popup-viewer-v2.user/actions/workflows/ci.yml/badge.svg)](https://github.com/coresZ/popup-viewer-v2.user/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-2.3.6-blue.svg)](CHANGELOG.md)
[![Tampermonkey](https://img.shields.io/badge/Tampermonkey-Userscript-orange.svg)](https://www.tampermonkey.net/)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18-brightgreen.svg)](package.json)

> 点击论坛/帖子链接，不离开当前页面，在页内弹窗中阅读内容。插件化架构、多站点内置适配、任意网站规则拦截、完整安全净化，桌面与移动端皆可用。

**Popup Viewer V2** 是一个 Tampermonkey 用户脚本。它拦截页面中的帖子链接点击，把目标内容加载到当前页面的弹窗面板里：既保留原页面的浏览位置，也让"扫帖"更连贯。对论坛类站点提供开箱即用的适配器；对任意网站，可以通过可视化"点选链接"生成拦截规则，无需编写代码。

---

## 目录

- [功能特性](#功能特性)
- [支持站点](#支持站点)
- [安装](#安装)
- [快速上手](#快速上手)
- [快捷键](#快捷键)
- [设置概览](#设置概览)
- [链接规则（任意网站）](#链接规则任意网站)
- [X（Twitter）阅读器](#xtwitter阅读器)
- [PopupKit 弹窗库](#popupkit-弹窗库)
- [项目结构](#项目结构)
- [开发](#开发)
- [文档](#文档)
- [安全与隐私](#安全与隐私)
- [贡献](#贡献)
- [License](#license)

---

## 功能特性

### 阅读体验

- **页内弹窗**：拦截链接点击，在当前页面弹出阅读窗口，不跳转、不丢失列表位置。
- **两种驻留方式**：**遮罩**（点击空白关闭，适合沉浸阅读）或 **悬浮**（无遮罩、不挡页面，可边看边操作）。
- **窗体自由调整**：拖动标题栏移动；拖拽四边/四角缩放（最小 260×200）；尺寸按站点记忆。重新点击大小预设即可恢复预设尺寸。
- **大小预设**：小 / 中 / 大 / 手机四档，另有拖拽后的「自定义」状态。
- **弹窗内前进后退**：底部 ← → 调用弹窗内 iframe 的原生历史，不影响顶层页面；SPA 站点也支持；快捷键 `Alt+←` / `Alt+→`。
- **全屏 / 刷新 / 新标签页**：工具栏一键切换；刷新保持窗体位置与尺寸；可随时把当前内容放到新标签页打开。
- **锁定窗体 / 惯用手**：锁定后不可拖动缩放；左手模式镜像工具栏，关闭按钮移到左上角。
- **视口自适应**：窗体尺寸与位置始终约束在可视区域内；打开 DevTools 或缩放浏览器窗口时自动收缩并拉回可视区。
- **明暗主题**：跟随系统或手动指定浅色 / 深色。

### 站点适配

- **内置多站点适配器**：Discuz 系论坛、淘股吧、linux.do、磁力站、X（Twitter），开箱即用。
- **规则化"统统拦截器"**：在任意网站「点选链接」即可生成 CSS 选择器规则，无需写代码；支持编辑、停用、删除与撤销。
- **多种加载策略**：按站点自动选择 iframe 直载（保留登录态与脚本）或抓取净化渲染（安全沙箱），并有内存缓存与悬停预热。
- **弹窗图片修复**：自动识别各站懒加载图片（`data-original` / `data-src` / `srcset` / Discuz `zoomfile` / `file` 等），1×1 占位图也能换入真实地址。
- **手机模式**：预置 iPhone / iPhone Max / 安卓 / 小屏尺寸，并携带对应移动端 UA 抓取。

### 安全与体验

- **安全净化**：抓取内容经过 Sanitizer 剥离 `<script>`、事件属性与危险协议，渲染在受限 sandbox iframe 中。
- **样式隔离**：界面挂载在 Shadow DOM，宿主网站 CSS 不会改变弹窗字号、行高与按钮外观。
- **设置持久化**：多数交互设置按站点独立保存，主题、惯用手等全局设置跨站共享；刷新不丢失。
- **移动端支持**：Android Firefox / Kiwi、iOS Safari（Tampermonkey / Userscripts 扩展）可用；触屏按钮热区 ≥ 44px，小屏自动铺近全屏。
- **调试模式**：设置 → 高级 →「调试标记」（或 URL 带 `pv2_debug`）可在页面上显示脚本运行状态、模块加载序号与错误信息；默认关闭、零痕迹。

### X（Twitter）阅读器

- 点击时间线里的帖子，在弹窗中阅读完整帖文与回复，不离开时间线。
- 引用帖可单独打开；回复列表支持「加载更多」、排序、点赞/转发/回复与翻译。
- 图片支持灯箱查看：滚轮/双指缩放、拖动平移、双击在 100% ↔ 200% 间切换、`+` / `-` / `0` 快捷键。
- 回复草稿按帖子暂存，关窗或刷新后可恢复；发送成功后清除。

---

## 支持站点

内置适配器（`src/adapters/`）：

| 适配器 | 站点 | 说明 |
|---|---|---|
| Discuz | `chiphell.com` · `wnflb2023.com` · `52pojie.cn` | 帖子列表标题链接、版块列表行 |
| 淘股吧 | `www.tgb.cn`（板块列表 / 博客 / 实盘比赛）· `shuo.tgb.cn`（`/livenews/`） | 多套新旧布局 |
| LinuxDo | `linux.do` | 直接 iframe，保留登录态与站点脚本 |
| 磁力 | `1cili.com` · `s.9cili.mom` | 表格首列链接，抓取时保留站点脚本 |
| X | `x.com` · `twitter.com` | GraphQL 原生渲染（需在页面登录） |

> 以上站点无需配置即可使用。其它任何网站都可以通过[链接规则](#链接规则任意网站)自行添加拦截规则。

---

## 安装

### 环境要求

- 浏览器：Chrome / Edge / Firefox / Safari（桌面或移动端）。
- 脚本管理器：[Tampermonkey](https://www.tampermonkey.net/)（推荐）；iOS 也可使用 [Userscripts](https://apps.apple.com/app/userscripts/id1463298887) 等支持 `GM_*` API 的扩展。
- 无需 Node.js —— 普通用户直接安装构建产物即可。

### 通过 Tampermonkey 安装

1. 安装并启用 Tampermonkey 扩展。
2. 安装脚本，任选一种方式：
   - **在线安装（推荐）**：打开 [`dist/popup-viewer-v2.user.js`](https://raw.githubusercontent.com/coresZ/popup-viewer-v2.user/main/dist/popup-viewer-v2.user.js)，Tampermonkey 会自动弹出安装页，点击「安装」。
   - **本地文件**：下载仓库中的 `dist/popup-viewer-v2.user.js`，打开 Tampermonkey 管理面板 →「实用工具」→「从文件导入」，选择该文件。
   - **手动粘贴**：Tampermonkey 管理面板 →「+」新建脚本 → 用 `dist/popup-viewer-v2.user.js` 的全部内容替换编辑器内容 → 保存。
3. 打开任意支持站点（例如 `linux.do`），页面右下角出现 ⚙ 按钮即安装成功。

### 更新与卸载

- **更新**：重新执行上面的安装步骤覆盖旧版本即可；Tampermonkey 也会根据脚本头部的 `@version` 自动检查更新。
- **卸载**：Tampermonkey 管理面板 → 找到「页内弹窗打开新帖」→ 删除。

> 安装后如未生效，请先确认脚本已启用、当前站点未被其他脚本或浏览器扩展拦截，再参考[用户使用手册](docs/user-guide.md)的「常见问题」。

---

## 快速上手

1. **正常浏览**：打开支持的论坛列表页，点击帖子标题，内容会在页内弹窗中打开。
2. **打开设置**：点击页面右下角 ⚙，或使用 Tampermonkey 菜单 →「打开设置」。
3. **调整窗体**：在设置「通用」页切换窗体大小、驻留方式、主题；拖动标题栏移动，拖拽边缘缩放。
4. **给任意网站加规则**：设置 →「链接规则」→「管理」→「点选链接」，在页面上点一下想拦截的链接，确认候选选择器即可。
5. **关闭弹窗**：点击 ✕、按 `Esc`，或在遮罩模式点击空白处。

> 首次使用建议先阅读[用户使用手册](docs/user-guide.md)，其中有完整设置项、移动端技巧与故障排查。

---

## 快捷键

| 快捷键 | 作用 | 说明 |
|---|---|---|
| `Esc` | 关闭设置 / 关闭弹窗 | 设置面板打开时先关设置；输入框中按 `Esc` 只失焦 |
| `F` | 全屏 / 退出全屏 | 输入框内不触发；浮动模式下需焦点在弹窗内 |
| `R` | 刷新当前内容 | 保持窗体位置与尺寸；输入框内不触发 |
| `Alt+←` | 弹窗内后退 | 调用弹窗 iframe 的原生历史 |
| `Alt+→` | 弹窗内前进 | 同上 |
| `+` / `-` / `0` | X 图片灯箱放大 / 缩小 / 复位到 100% | 仅 X 阅读器灯箱打开时 |
| 双击图片 | 100% ↔ 200% 切换 | 仅 X 阅读器灯箱 |

> `F` / `R` 只在焦点或最近一次点击位于弹窗内、或弹窗为遮罩模式时生效，避免抢占宿主网站自身的快捷键。

---

## 设置概览

完整说明见[用户使用手册 · 设置项参考](docs/user-guide.md#5-设置项参考)。下表为速查：

| 设置项 | 默认值 | 作用域 | 说明 |
|---|---|---|---|
| 窗体驻留方式 | 遮罩 | 仅本站 | 遮罩（点空白关闭）/ 悬浮（不挡页面） |
| 窗体大小 | 中 | 仅本站 | 小 / 中 / 大 / 手机 / 自定义 |
| 窗体滚动条 | 开 | 仅本站 | 显示或隐藏窗体内滚动条 |
| 锁定窗体 | 关 | 仅本站 | 锁定后不可拖动、缩放 |
| 页面链接拦截 | 开 | 仅本站 | 关闭后页面链接按原样打开，窗体只能悬浮 |
| 窗体内链接新标签页打开 | 开 | 仅本站 | 关闭则在弹窗内部跳转 |
| 链接规则 | — | 仅本站 | 管理当前站点的拦截规则 |
| 外观主题 | 跟随系统 | 全局 | 跟随系统 / 浅色 / 深色 |
| 在 iframe 中运行 | 关 | 全局 | 风险项：开启后脚本会在页面所有 iframe 中运行 |
| 调试标记 | 关 | 全局 | 排查问题时显示运行状态与错误标记 |
| 四角缩放把手 | 关 | 全局 | 触屏下显示四角缩放把手 |
| 惯用手 | 右手 | 全局 | 左手模式镜像工具栏 |
| 最近打开（本站） | — | 仅本站 | 列出当前站点最近 20 条记录，可清空 |

---

## 链接规则（任意网站）

链接规则让你在**任何网站**复用弹窗阅读能力，无需等待内置适配器：

1. 打开目标网站 → 点击右下角 ⚙ →「链接规则」→「管理」。
2. 点击「点选链接」，在页面上点一下要拦截的帖子链接。
3. 从候选框中选择最合适的选择器（悬停可看完整 CSS 选择器；「高级」可手动改写）。
4. 确认后，该站点这类链接就会在弹窗中打开。

规则支持**编辑选择器**、**停用**、**删除**（删除后 4 秒内可撤销），并提供「全部站点」视图集中管理。规则优先于内置适配器；只对当前域名生效。

> 提示：选择器越精准越好。点链接本身时优先选择 `a.xxx` 这类只命中链接的候选；「整行任意位置」适合需要点击行内任意区域才打开的列表。

---

## X（Twitter）阅读器

在 `x.com` / `twitter.com` 登录状态下使用：

- **打开帖子**：在时间线、列表、个人主页等非详情页点击帖子正文，弹窗展示主帖与回复。
- **引用帖**：点击引用卡片会打开被引用的帖子，而不是外层主帖。
- **详情页**：X 帖子详情页保留 X 原生交互，只有点击引用帖卡片时才在弹窗中打开被引用帖子。
- **回复**：支持「加载更多」、相关/最新/最多喜欢排序、回复、点赞、转发、翻译；加载失败可重试。
- **图片灯箱**：点击图片放大；滚轮 / 双指缩放，放大后拖动平移，双击切换 100% ↔ 200%，`+` / `-` / `0` 快捷键。
- **草稿**：回复框内容按帖子暂存（20 条上限、7 天过期），关窗或刷新后可恢复，发送成功后清除。

> X 的内容由客户端 React 渲染，且 X 的页面框架策略拒绝 iframe 加载，因此这里使用当前登录会话读取 X 内部 GraphQL 并原生渲染。X 若调整接口，相关功能可能需要更新适配器。

---

## PopupKit 弹窗库

`dist/popup-viewer-kit.js` 是把弹窗能力（多加载器 + 安全净化 + 增强面板）封装成的独立库，暴露 `window.PopupKit`，供其他油猴脚本通过 `@require` 引用。库不自动初始化、不创建工具栏/规则面板，仅提供弹窗 API；所有 DOM id/class 使用 `pvk-` 前缀，样式自包含，可与本脚本或 `page-picker-kit` 同页共存。

```js
// ==UserScript==
// @name         My Script
// @require    https://raw.githubusercontent.com/coresZ/popup-viewer-v2.user/main/dist/popup-viewer-kit.js
// ==/UserScript==

window.PopupKit.open({ url, title, width: '50%', height: '75%', linkIntercept: true });
```

| API | 说明 |
|---|---|
| `PopupKit.open({ url, title, width, height, linkIntercept })` | 打开弹窗并加载内容，返回是否成功 |
| `PopupKit.close()` | 关闭弹窗 |
| `PopupKit.refresh()` | 刷新当前内容（保持位置/尺寸） |
| `PopupKit.isOpen()` | 当前是否已打开 |
| `PopupKit.prefetch(url)` | 后台预热缓存 |
| `PopupKit.hasCached(url)` | 是否已有缓存 |
| `PopupKit.config` | 只读配置对象 |
| `PopupKit._onOpen` / `PopupKit._onClose` | 宿主脚本可设置的生命周期回调 |

---

## 项目结构

```text
.
├── src/                  # 源码（原生 JavaScript ES Modules）
│   ├── main.js           # 入口：初始化、事件、油猴菜单
│   ├── config.js         # 全局配置：尺寸/手机型号/加载策略/缓存
│   ├── adapters/         # 站点适配器（Discuz/TGB/LinuxDo/Cili/X）
│   ├── core/             # 核心管理器（事件/弹窗/站点/加载/存储/设置/规则/预热）
│   ├── kit/              # PopupKit 独立弹窗库
│   ├── loaders/          # 加载器（iframe/request/parser/cache/xthread）
│   ├── security/         # 安全（Sanitizer/Sandbox/UrlResolver）
│   ├── ui/               # 界面（弹窗/工具栏/设置/规则/点选/加载/错误）
│   ├── utils/            # 工具（DOM/GM/面板交互/日志/调试）
│   └── x/                # X 阅读器（GraphQL 桥接/模型/渲染/灯箱/草稿）
├── dist/                 # 构建产物（提交到仓库）
│   ├── popup-viewer-v2.user.js   # 主脚本（用户安装这个）
│   └── popup-viewer-kit.js       # PopupKit 库
├── tests/                # 回归测试与手动测试页
├── docs/                 # 用户手册、开发手册与文档索引
├── tools/                # 开发工具（git-tools.mjs）
├── .github/              # Issue/PR 模板、CI、Dependabot
├── build.mjs             # esbuild 构建脚本
├── banner.txt            # 油猴脚本头部（@name/@version/@grant）
├── package.json
├── CHANGELOG.md
├── CONTRIBUTING.md
├── SECURITY.md
└── LICENSE
```

---

## 开发

### 环境要求

- Node.js **≥ 18**（开发时使用 v22.17.0 验证）
- npm
- Git

### 常用命令

```bash
npm install                         # 安装开发依赖（esbuild）
npm run build                       # 构建主脚本 + PopupKit
npm run build:min                   # 构建压缩版（发布用）
npm run dev                         # 监听源码变化持续构建
npm test                            # 运行回归测试（X 数据层 / 选择器 / 缩放数学）
npm run build -- --only=main        # 只构建主脚本
npm run build -- --only=kit         # 只构建 PopupKit
```

构建产物：

| 产物 | 源入口 | 用途 |
|---|---|---|
| `dist/popup-viewer-v2.user.js` | `src/main.js` | 主用户脚本，Tampermonkey 安装 |
| `dist/popup-viewer-kit.js` | `src/kit/popupKit.js` | PopupKit 独立库，供其他脚本 `@require` |

> 修改源码后必须重新构建并提交 `dist/`，保持一致。版本号位于 `package.json` 与 `banner.txt`，代码类改动需同步递增；纯文档/配置改动无需递增版本。

详细的架构说明、扩展开发指南、测试与发布流程见[项目开发手册](docs/development.md)；Git 工具用法见 [tools/git-tools.md](tools/git-tools.md)。

---

## 文档

文档放置遵循 GitHub 仓库惯例：根目录保留 README、CHANGELOG、LICENSE、CONTRIBUTING、SECURITY、CODE_OF_CONDUCT、THIRD_PARTY_NOTICES 等仓库级文件；用户手册、开发手册与文档索引统一放在 `docs/`；`tools/git-tools.md` 随开发工具放置。

| 文档 | 说明 |
|---|---|
| [用户使用手册](docs/user-guide.md) | 安装、设置项详解、操作技巧、故障排查 |
| [项目开发手册](docs/development.md) | 架构、构建、扩展开发、测试、发布 |
| [文档索引](docs/README.md) | 全部文档导航 |
| [CHANGELOG.md](CHANGELOG.md) | 版本更新记录 |
| [CONTRIBUTING.md](CONTRIBUTING.md) | 贡献指南与开发约定 |
| [SECURITY.md](SECURITY.md) | 安全策略与漏洞报告方式 |
| [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) | 社区行为准则 |
| [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) | 第三方代码来源与许可声明 |

---

## 安全与隐私

- **本地运行**：脚本不经过任何中转服务器，数据（设置、历史、规则、草稿）保存在 Tampermonkey 的 `GM_*` 存储中；无 `GM_*` 环境时回退到 `localStorage`。
- **权限说明**：需要 `GM_xmlhttpRequest` 抓取目标页面内容，因此声明 `@connect *`；需要 `unsafeWindow` 在 X 页面安装 GraphQL 网络桥；其余为样式与存储相关权限。
- **内容净化**：抓取渲染路径统一经过 `Sanitizer`（去除脚本、事件属性、危险协议）并放入 sandbox iframe；仅对明确信任的站点保留脚本执行。
- **风险项**：设置中的「在 iframe 中运行」默认关闭（等价 `@noframes`）。开启后脚本会在页面所有 iframe（含广告、嵌入内容）中运行，可能增加开销、出现多个悬浮按钮或样式冲突，仅在确有需要时开启；脚本自己的弹窗 iframe 始终跳过，不会套娃。
- **第三方内容**：弹窗展示的是目标网站内容，请遵守对应网站的服务条款；脚本不绕过登录、不破解付费内容。

---

## 贡献

欢迎提交 Issue 与 Pull Request：

1. 先阅读 [CONTRIBUTING.md](CONTRIBUTING.md) 与 [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)。
2. Bug 请使用 [Bug 报告模板](https://github.com/coresZ/popup-viewer-v2.user/issues/new?template=bug_report.yml)，附上脚本版本、浏览器、站点与复现步骤。
3. 功能建议请使用 [功能请求模板](https://github.com/coresZ/popup-viewer-v2.user/issues/new?template=feature_request.yml)。
4. 安全漏洞**不要**公开提 Issue，请按 [SECURITY.md](SECURITY.md) 私下报告。

---

## License

本项目采用 [MIT License](LICENSE) 开源。

第三方组件与代码来源见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)（X 支持部分移植/改写自 [peek](https://github.com/DoraRabbitYan/peek)，MIT License）。
