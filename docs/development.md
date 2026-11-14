# Popup Viewer V2 项目开发手册

> 面向新贡献者与维护者。适用版本：**v2.3.7**；默认分支：`main`；仓库：<https://github.com/coresZ/popup-viewer-v2.user>。
>
> 本手册以源码为唯一事实来源。若文档与实现不一致，请以 `src/`、`build.mjs`、`package.json` 为准，并顺手修正文档。

Popup Viewer V2 是一个 Tampermonkey 用户脚本：拦截页面中的帖子链接点击，在当前页面弹出面板加载目标内容，避免跳转离开列表页。项目采用原生 JavaScript（ES Modules）+ esbuild 构建，运行时无第三方依赖；除主脚本外，还产出可被其他用户脚本 `@require` 的 PopupKit 弹窗库。

## 目录

- [1. 项目概览](#1-项目概览)
- [2. 技术栈与环境要求](#2-技术栈与环境要求)
- [3. 快速开始](#3-快速开始)
- [4. 构建系统详解](#4-构建系统详解)
- [5. 目录结构与职责](#5-目录结构与职责)
- [6. 架构总览](#6-架构总览)
- [7. 初始化与数据流](#7-初始化与数据流)
- [8. 加载策略与站点策略](#8-加载策略与站点策略)
- [9. 安全模型](#9-安全模型)
- [10. 扩展开发指南](#10-扩展开发指南)
- [11. 测试与调试](#11-测试与调试)
- [12. 代码规范与提交约定](#12-代码规范与提交约定)
- [13. 发布流程](#13-发布流程)
- [14. GitHub 仓库维护建议](#14-github-仓库维护建议)
- [15. 常见开发问题与排障](#15-常见开发问题与排障)
- [16. 参考与延伸阅读](#16-参考与延伸阅读)

---

## 1. 项目概览

### 1.1 这是什么

Popup Viewer V2 的工作方式可以概括为「拦截 → 解析 → 加载 → 净化 → 渲染」：

1. 在 `document` 的捕获阶段监听 `click`，由站点适配器或用户规则判断这次点击是否是要预览的链接。
2. 命中后阻止默认跳转，通过事件总线发出 `open-page`，交给弹窗管理器。
3. 弹窗管理器按站点策略选择加载方式：iframe 直载、请求抓取后净化渲染、解析后直接注入，或 X 专用 GraphQL 渲染。
4. 抓取型内容（request / parser / cache）先经过 `Sanitizer`，再放入受限 `sandbox` iframe（或受控容器）；X 专用路径由 `XThreadLoader` 直接渲染结构化数据。最终内容都显示在 Shadow DOM 隔离的弹窗外壳里。

### 1.2 两个构建产物

| 产物 | 源入口 | 用途 |
|---|---|---|
| `dist/popup-viewer-v2.user.js` | `src/main.js` | 主用户脚本，Tampermonkey 安装此文件；带 `banner.txt` 油猴头 |
| `dist/popup-viewer-kit.js` | `src/kit/popupKit.js` | PopupKit 独立库（内部版本 `1.1.0`），供其他脚本 `@require`，暴露 `window.PopupKit` |

两个产物都是 IIFE、`target: es2019`、CSS 以文本方式内联。主脚本会注册 X 专用加载器并启动整套 UI；PopupKit 只提供弹窗 API，不初始化主脚本的工具栏、规则面板与站点适配器。

### 1.3 相关文档

| 文档 | 说明 |
|---|---|
| [项目 README](../README.md) | 项目定位、功能特性、支持站点、安装与命令速览 |
| [用户使用手册](user-guide.md) | 面向普通用户的安装、设置项、操作与故障排查 |
| [更新日志](../CHANGELOG.md) | 各版本新增、变更与修复记录 |
| [Git 工具说明](../tools/git-tools.md) | `tools/git-tools.mjs` 的安装、命令与常见问题 |
| [第三方组件声明](../THIRD_PARTY_NOTICES.md) | 第三方代码来源、许可与版权声明（X 支持部分参考/改写自 peek，MIT） |
| [文档索引](README.md) | 全部文档导航 |

---

## 2. 技术栈与环境要求

### 2.1 技术栈

| 项目 | 版本 / 要求 | 说明 |
|---|---|---|
| 语言 | 原生 JavaScript（ES Modules） | 不使用 TypeScript、框架或运行时库 |
| 模块系统 | ES Modules（`"type": "module"`） | 源码通过 `import` / `export` 组织 |
| 构建工具 | esbuild `^0.28.0`（devDependency） | 当前 `package-lock.json` 解析为 0.28.1 |
| Node.js | **≥ 18** | 开发验证使用 v22.17.0；CI 矩阵为 Node 20 / 22 |
| 包管理器 | npm | 仓库包含 `package-lock.json`，推荐 `npm ci` |
| 运行时依赖 | **无** | `dependencies` 为空，只有 esbuild 一个开发依赖 |
| 构建目标 | `es2019` | 兼容旧版 Safari / iOS 脚本管理器 |
| 测试 | Node 内置 `node:assert/strict` | 无 Jest/Vitest 等测试框架 |
| 分发格式 | IIFE 用户脚本 | 主脚本带油猴元数据头，库脚本无头部 |
| 浏览器 | Chrome / Edge / Firefox / Safari + Tampermonkey 等 | 开发调试建议 Chrome/Edge 桌面版 |

### 2.2 环境检查

```bash
node --version    # 应为 v18 或更高（本项目在 v22.17.0 验证）
npm --version     # 随 Node 安装
git --version     # 需要 Git 读取历史与推送
```

### 2.3 不需要什么

- 不需要全局安装 esbuild，`npm install` / `npm ci` 会装到本地 `node_modules/`。
- 不需要任何运行时环境变量、配置文件或后端服务。
- 运行用户脚本的普通用户不需要 Node.js，只需安装 `dist/popup-viewer-v2.user.js`。
- 项目没有 `engines` 字段强制版本，但请遵循 README 与 CI 的 Node ≥18 约定。

---

## 3. 快速开始

### 3.1 克隆与安装

```bash
git clone https://github.com/coresZ/popup-viewer-v2.user.git
cd popup-viewer-v2.user
npm ci            # 按 package-lock.json 安装（也可用 npm install）
npm test          # 先确认基线测试通过
npm run build     # 构建两个 dist 产物
```

如果本地目录名是 `popup-viewer-v2`（例如 `D:\source\favjs\popup-viewer-v2`），`cd` 到实际目录即可，后续命令不受影响。

### 3.2 常用命令速查

| 命令 | 作用 | 说明 |
|---|---|---|
| `npm install` / `npm ci` | 安装开发依赖 | `npm ci` 严格按锁文件安装，CI 使用 |
| `npm run build` | 构建主脚本 + PopupKit | 输出到 `dist/`，非压缩 |
| `npm run build:min` | 构建压缩版 | 给 `build.mjs` 传 `--minify`，适合体积敏感的分发 |
| `npm run dev` | 监听源码变化持续构建 | 等价 `node build.mjs --watch`，Ctrl+C 退出 |
| `npm test` | 运行全部回归测试 | 依次执行 `xModel` / `selector` / `xZoomMath` |
| `npm run build -- --only=main` | 只构建主脚本 | 等价 `node build.mjs --only=main` |
| `npm run build -- --only=kit` | 只构建 PopupKit | 等价 `node build.mjs --only=kit` |
| `npm run g -- status` | 查看工作区与最近提交 | `tools/git-tools.mjs` 封装 |
| `npm run g -- commit "信息"` | 构建 + 暂存 + 提交 | 默认先 `npm run build` |
| `npm run g -- push` | 推送当前分支 | 使用上游跟踪分支 |
| `npm run g -- publish "信息"` | 构建 + 提交 + 推送 | 日常发布最常用 |
| `npm run g -- setup <仓库地址>` | 配置 origin 并切到 `main` | 新克隆/新项目初始化用 |

> `npm run g -- ...` 只是 `tools/git-tools.mjs` 的 npm 封装，完整参数与 SSH 密钥说明见 [tools/git-tools.md](../tools/git-tools.md)。

### 3.3 首次构建与脚本安装

1. 执行 `npm run build`，确认 `dist/popup-viewer-v2.user.js` 与 `dist/popup-viewer-kit.js` 的修改时间已更新。
2. 打开 Tampermonkey 管理面板 →「实用工具」→「从文件导入」，选择 `dist/popup-viewer-v2.user.js`。
3. 打开一个支持站点（例如 `linux.do`），右下角出现 ⚙ 按钮即安装成功。
4. 修改源码后重新构建，再在 Tampermonkey 中覆盖安装/刷新脚本；调试时建议开启「调试标记」。

### 3.4 日常开发循环

```text
修改 src/** 或 src/ui/style.css
        │
        ▼
npm run dev  （或每轮手动 npm run build）
        │
        ▼
Tampermonkey 重新加载脚本 / 刷新目标页面
        │
        ▼
打开 ?pv2_debug 观察标记与日志 → 修复 → npm test → 构建
```

---

## 4. 构建系统详解

### 4.1 build.mjs 做什么

`build.mjs` 是一个很小的 esbuild 驱动脚本：

1. 读取 `banner.txt`（去掉末尾空行）与 `package.json`（取 `version`）。
2. 定义主脚本与 PopupKit 两套 `BuildOptions`。
3. 解析命令行参数 `--watch`、`--minify`、`--only=main|kit`。
4. 非监听模式并行执行构建；监听模式为每个目标创建 watch context，并在收到 stdin 数据时 dispose。

### 4.2 两个入口与产物

| 入口 | 产物 | 关键差异 |
|---|---|---|
| `src/main.js` | `dist/popup-viewer-v2.user.js` | `banner.txt` 作为 JS banner；注入 `src/bootMarker.js`；`define` 注入 `__PV2_VER__ = package.json.version` |
| `src/kit/popupKit.js` | `dist/popup-viewer-kit.js` | 无 banner、无 bootMarker 注入；不定义版本宏 |

`src/bootMarker.js` 是「引导标记 + 错误捕获」诊断模块，位于打包产物最前端、任何模块副作用之前执行。它只在调试模式下显示紫色 boot 版本、全局错误与初始化看门狗，默认完全静默。

### 4.3 关键构建选项

| 选项 | 值 | 原因 |
|---|---|---|
| `bundle` | `true` | 把 ES Modules 打成单文件用户脚本 |
| `format` | `'iife'` | 兼容脚本管理器注入方式，避免模块加载限制 |
| `target` | `'es2019'` | 向下兼容可选链、类静态字段等语法 |
| `loader` | `{ '.css': 'text' }` | `import style from './style.css'` 得到 CSS 字符串，由运行时注入 |
| `charset` | `'utf8'` | 保证中文 banner、界面文案不乱码 |
| `legalComments` | `'none'` | 产物不保留第三方注释 |
| `minify` | 由 `--minify` 决定 | `build:min` 使用 |
| `logLevel` | `'info'` | 显示构建输入/输出摘要 |

CSS 不是单独产物：主脚本的 `src/ui/style.css` 和 PopupKit 的 `src/kit/kit.css` 都通过 esbuild 的 text loader 变成字符串，打包进对应 JS。

### 4.4 命令行参数

```bash
# 只构建主脚本
npm run build -- --only=main

# 只构建 PopupKit
npm run build -- --only=kit

# 监听模式（两个目标都监听）
npm run dev

# 监听模式只监听主脚本
node build.mjs --watch --only=main

# 压缩版
npm run build:min
```

参数来自 `process.argv` 的字符串匹配：

- `--watch`：监听源码变化并持续重建；`build.mjs` 会挂 stdin 监听，收到数据时 dispose 所有 watch context。
- `--minify`：开启 esbuild 压缩。
- `--only=main` / `--only=kit`：只构建指定目标；不传则两个都构建。

### 4.5 dist 同步规则

- **不要手工编辑 `dist/` 下的文件**，它们由 `build.mjs` 生成。
- 修改 `src/**` 或 `build.mjs` 后，提交前必须运行 `npm run build`，确保 `dist/` 与源码一致。
- CI 在构建后执行 `git diff --exit-code -- dist`，产物不一致会直接失败。
- `npm run g -- commit` / `publish` 默认会先执行 `npm run build`；只有显式加 `--no-build` 才跳过。
- 若使用 `npm run build:min` 生成压缩版，注意 CI 的 `npm run build` 会按非压缩配置重新生成，`dist` 将出现差异。仓库提交的 `dist` 应使用与 CI 相同的 `npm run build` 产物；压缩版更适合作为 Release 附件或独立分发，不要直接覆盖仓库 `dist` 后提交（除非同步调整 CI 策略）。

### 4.6 版本号如何进入产物

版本号有四个落点，发布时必须保持一致：

| 位置 | 作用 |
|---|---|
| `package.json` → `version` | 构建宏 `__PV2_VER__` 的值，调试 boot 标记显示 |
| `package-lock.json` → 顶层与 `packages[""]` 的 `version` | 与 `package.json` 保持一致，否则 `npm ci` 会报不同步 |
| `banner.txt` → `@version` | 用户脚本管理器识别的版本，写在 `dist/popup-viewer-v2.user.js` 头部 |
| `CHANGELOG.md` 顶部条目 | 发布记录 |
| README 徽章（可选） | 项目门面展示的版本 |

`build.mjs` 读取 `package.json` 的 `version` 注入 `__PV2_VER__`，但 `banner.txt` 的 `@version` 是独立文本，必须手动同步。两者不一致时，Tampermonkey 显示的版本与调试标记会不一致。

三处文件用工具一次同步，避免漏改：

```bash
node tools/version.mjs            # 打印当前版本
node tools/version.mjs bump       # 2.3.7.1 → 2.3.7.2（三段版本则补成 2.3.7 → 2.3.7.1）
node tools/version.mjs set 2.3.8  # 指定版本（发版用）
# 追加 --build 可在改完后自动 npm run build
```

`@version` 支持四段（如 `2.3.7.1`），用户脚本管理器按段比较，`2.3.7.1 > 2.3.7`，可用于同一补丁线上的多次小更新；`npm` 也接受四段版本号，不会影响 `npm ci`。

---

## 5. 目录结构与职责

### 5.1 目录树

```text
popup-viewer-v2/
├── src/
│   ├── main.js               # 主入口：初始化、适配器注册、事件、油猴菜单
│   ├── config.js             # 全局配置：尺寸/手机型号/加载策略/缓存/sitePolicy
│   ├── bootMarker.js         # 构建时注入的调试引导标记
│   ├── adapters/             # 站点适配器（Base/Discuz/Tgb/Linux/Cili/X）
│   ├── core/                 # 核心管理器（事件/站点/加载/弹窗/设置/规则/存储/预热）
│   ├── kit/                  # PopupKit 独立弹窗库（popupKit.js / KitPopupPanel.js / kit.css）
│   ├── loaders/              # 加载器（iframe/request/parser/cache/xthread + IframeRenderer）
│   ├── security/             # 安全（Sanitizer/Sandbox/UrlResolver）
│   ├── ui/                   # 界面（弹窗/工具栏/设置/规则/点选/加载/错误 + style.css）
│   ├── utils/                # 工具（DOM/GM/Shadow 宿主/面板交互/日志/调试/选择器/防抖）
│   └── x/                    # X 阅读器（GraphQL 桥接/模型/渲染/灯箱/草稿/主题）
├── dist/                     # 构建产物（提交到仓库）
├── tests/                    # 回归测试与手动验证页
├── docs/                     # 用户手册、开发手册与文档索引
├── tools/                    # git-tools.mjs 与其说明
├── .github/                  # CI、Issue/PR 模板、Dependabot、CODEOWNERS
├── build.mjs                 # esbuild 构建脚本
├── banner.txt                # 油猴脚本头部（@name/@version/@grant）
├── package.json              # 依赖与 npm scripts
├── package-lock.json         # 锁定依赖版本
├── codemap.md                # 根级代码地图
└── AGENTS.md                 # 仓库级硬性约束
```

各代码目录下另有 `codemap.md`，描述该目录的职责、设计、数据流与集成关系；改目录内代码前先读对应 codemap，能快速定位边界。

### 5.2 职责表

| 路径 | 职责 | 关键点 |
|---|---|---|
| `src/main.js` | 主入口与装配层 | `bootstrap()` 初始化；`registerAdapters()`；`setupEvents()`；`setupObserver()`；`setupMenu()`；X 支持按需安装 |
| `src/config.js` | 静态配置 | 尺寸预设、手机型号与 UA、超时、缓存、预热、`sitePolicy`、存储键名、`ui.shadow` |
| `src/adapters/` | 站点适配器 | `BaseAdapter` 定义 `match` / `parseClick` / `enhance`；内置 Discuz、TGB、LinuxDo、Cili、X |
| `src/core/` | 核心编排 | `EventBus`、`SiteManager`、`LoaderManager`、`PopupManager`、`SettingsManager`、`RulesManager`、`StorageManager`、`PrefetchManager` |
| `src/kit/` | 独立弹窗库 | `popupKit.js` 工厂 + `KitPopupPanel` 面板 + `kit.css`；`pvk-` 前缀；暴露 `window.PopupKit` |
| `src/loaders/` | 内容加载策略 | `IframeLoader`、`RequestLoader`、`ParserLoader`、`CacheLoader`、`XThreadLoader`；`IframeRenderer` 负责写入 sandbox iframe 与后处理 |
| `src/security/` | 安全原语 | `Sanitizer` 净化 HTML；`Sandbox` 生成站点策略与 sandbox 属性；`UrlResolver` 校验协议/锚点 |
| `src/ui/` | 全部界面 | `PopupPanel`、`Toolbar`、`SettingsPanel`、`RulesPanel`、`ElementPicker`、`Loading`、`ErrorView`、`style.css` |
| `src/utils/` | 低层工具 | `dom.js`（含 Shadow 感知辅助）、`gm.js`、`uiHost.js`、`panelBehavior.js`、`logger.js`、`debugFlag.js`、`selector.js`、`debounce.js` |
| `src/x/` | X 阅读器 | `xBridge`（页面上下文 GraphQL 网络层）、`xModel`（数据模型）、`xRender` / `xCommentCard` / `xProfileCard`、`xZoomMath`、`xDrafts`、`xTheme`、`xIcons`、`xFormat` |
| `tests/` | 测试 | 三个 `.test.mjs` 纯逻辑回归；两个 `*-harness.html` 手动/无头 DOM 验证页 |
| `docs/` | 文档 | 用户手册、开发手册与文档索引；入口见 [docs/README.md](README.md) |
| `tools/` | 工具 | `git-tools.mjs`（构建/提交/推送封装）与 `git-tools.md` |
| `dist/` | 构建产物 | 只读遵守：由 `build.mjs` 生成，不手工编辑 |
| `build.mjs` | 构建脚本 | 两个入口、banner、CSS text loader、target ES2019、watch/minify/only |
| `banner.txt` | 用户脚本元数据 | `@name`、`@version`、`@include`、`@grant`、`@connect`、`@run-at` |
| `codemap.md` | 代码地图 | 根级架构、目录聚合、数据流；子目录另有 codemap |
| `AGENTS.md` | 仓库约束 | 禁止自动提交、版本号递增规则 |

### 5.3 codemap 的使用

`codemap.md` 是随代码维护的「地图」，不是产品文档。建议流程：

1. 先读根 `codemap.md` 了解系统入口与目录聚合。
2. 修改某个目录前读该目录的 `codemap.md`（如 `src/core/codemap.md`）。
3. 代码结构发生实质变化时同步更新对应 codemap，避免文档与实现漂移。

---

## 6. 架构总览

### 6.1 分层与依赖方向

```text
┌─────────────────────────────────────────────────────────────┐
│ main.js（装配层：初始化、事件绑定、适配器注册、油猴菜单）        │
└───────────────┬─────────────────────────────────────────────┘
                │
    ┌───────────▼───────────┐        ┌──────────────────────┐
    │ SiteManager           │◄───────│ RulesManager          │
    │  ├─ activeAdapters()  │        │ （用户规则优先）        │
    │  └─ resolveCandidate()│        └──────────────────────┘
    └───────────┬───────────┘
                │ eventBus.emit('open-page')
    ┌───────────▼───────────┐        ┌──────────────────────┐
    │ PopupManager          │───────►│ PopupPanel（UI）      │
    │  ├─ 导航历史           │        │ 工具栏/设置/规则面板   │
    │  └─ load(url)         │        └──────────────────────┘
    └───────────┬───────────┘
                │ loaderManager.load()
    ┌───────────▼───────────┐
    │ LoaderManager         │
    │  resolveMode()        │
    ├─ IframeLoader         │
    ├─ RequestLoader        │
    ├─ ParserLoader         │
    ├─ CacheLoader          │
    └─ XThreadLoader（仅 X） │
    └───────────┬───────────┘
                │
    ┌───────────▼───────────┐        ┌──────────────────────┐
    │ Sanitizer / Sandbox   │───────►│ IframeRenderer        │
    │ UrlResolver           │        │ 写入 sandbox iframe    │
    └───────────────────────┘        └──────────────────────┘
```

依赖方向总体是「入口 → core → loaders/security → utils」，UI 由 `PopupManager` 持有，加载器通过参数接收容器，不直接依赖 `PopupManager`。`utils/` 是最底层，不应反向依赖 `core/` 或 `ui/`（`debugFlag.js` 特意不依赖其它模块，保证模块加载标记可用）。

### 6.2 单例管理器

| 导出 | 模块 | 职责 |
|---|---|---|
| `eventBus` | `src/core/EventBus.js` | 发布-订阅；`on` 返回取消函数；`once` / `off` / `clear`；单个 handler 抛错只记录不中断其它订阅者 |
| `siteManager` | `src/core/SiteManager.js` | 适配器注册表、`activeAdapters()`、`resolveCandidate()`、`handleClick()`、`runEnhancements()` |
| `loaderManager` | `src/core/LoaderManager.js` | 持有 sandbox 策略与加载器表；`register` / `get` / `resolveMode` / `load` / `prefetch` |
| `popupManager` | `src/core/PopupManager.js` | 弹窗生命周期、加载令牌、弹窗内前进/后退历史、关闭清理 |
| `settingsManager` | `src/core/SettingsManager.js` | 全局 + 按站点设置、默认值、迁移、不变量、持久化 |
| `rulesManager` | `src/core/RulesManager.js` | 用户 CSS 选择器规则 CRUD、持久化、点击匹配 |
| `storageManager` | `src/core/StorageManager.js` | 历史与收藏的读写（JSON 序列化后存 GM 存储） |
| `sanitizer` | `src/security/Sanitizer.js` | HTML 净化 |
| `urlResolver` | `src/security/UrlResolver.js` | URL 绝对化、协议与同页锚点校验 |

`PrefetchManager` 不是全局单例，而是在 `main.js` 中 `new PrefetchManager(loaderManager)` 创建；它只做悬停防抖调度。

### 6.3 插件化适配器

`BaseAdapter` 定义三个核心钩子：

```js
export class BaseAdapter {
  match(hostname, pathname) { return false; }
  parseClick(event) { return null; }
  enhance(doc, hostname, pathname) { return false; }
  resolveHref(href, base) { /* URL 绝对化，拒绝 javascript: */ }
  matchDomain(hostname, domains) { /* 精确/子域名匹配 */ }
}
```

- `match` 决定当前页面是否启用该适配器。
- `parseClick` 从点击事件返回 `{ url, title, element }` 或 `null`。
- `enhance` 做视觉增强（加 `popup-trigger` 类、`pv-forum` 页面修饰等），由 MutationObserver 防抖触发。
- 适配器在 `main.js` 的 `registerAdapters()` 中按顺序注册；`SiteManager` 按注册顺序遍历，先命中先返回。**用户规则始终先于适配器匹配。**

### 6.4 事件总线

| 事件 | 触发方 | 载荷 | 订阅方 |
|---|---|---|---|
| `open-page` | `SiteManager.handleClick()`、`SettingsPanel` 的「最近」项 | `{ url, title, element? }` | `main.js`：写历史 + `popupManager.open()` |
| `settings-changed` | `SettingsPanel` 每次持久化后 | `settingsManager.get()` 的完整设置对象 | `main.js` 切换遮罩/悬浮；`SettingsPanel` 同步尺寸分段 |
| `picker-start` | `RulesPanel` 启动点选 | 无 | `PopupPanel` 隐藏弹窗/遮罩，露出页面 |
| `picker-end` | 点选完成/取消 | `{ selector }`（取消时 `selector: null`） | `PopupPanel` 恢复弹窗/遮罩 |

`EventBus.emit` 会捕获每个 handler 的异常并 `console.error`，不会让一个订阅者影响其它订阅者。

### 6.5 设置模型：全局 vs 按站点

`SettingsManager` 用两个存储键保存设置：

- `pv2:settings`：全局设置对象。
- `pv2:siteSettings`：`{ [hostname]: siteSettings }` 映射，按当前 `window.location.hostname` 读写。

分流规则：`GLOBAL_KEYS = ['theme', 'allowInFrame', 'handedness', 'mobileResize']` 命中则写全局，否则一律写当前站点。站点键不需要单独维护列表。

| 作用域 | 键 | 默认值 |
|---|---|---|
| 全局 | `theme` | `'auto'` |
| 全局 | `allowInFrame` | `false` |
| 全局 | `handedness` | `'right'` |
| 全局 | `mobileResize` | `false`（v2.3.1 迁移后默认关闭） |
| 全局（内部） | `uiRev` | `1`，用于设置结构迁移 |
| 站点 | `scrollbarVisible` | `true` |
| 站点 | `panelSize` | `'medium'` |
| 站点 | `windowMode` | `'coupled'` |
| 站点 | `linkIntercept` | `true` |
| 站点 | `popupLinksNewTab` | `true` |
| 站点 | `phoneModel` | `'iphone'` |
| 站点 | `phonePosition` | `null` |
| 站点 | `customSize` | `null` |
| 站点 | `locked` | `false` |

不变量：`linkIntercept === false` 时强制 `windowMode = 'float'`（关闭页面链接拦截后窗体只能悬浮）；无效的 `panelSize` / `phoneModel` 会回退到默认值。

### 6.6 持久化键一览

| 键 | 内容 | 写入方 |
|---|---|---|
| `pv2:settings` | 全局设置 | `SettingsManager._persist()` |
| `pv2:siteSettings` | 按站点设置映射 | `SettingsManager._persist()` |
| `pv2:rules` | `{ [hostname]: [{ selector, disabled? }] }` | `RulesManager._persist()` |
| `pv2:history` | 最近打开历史（最多 `config.maxHistoryEntries = 100` 条） | `StorageManager` |
| `pv2:favorites` | 收藏 | `StorageManager` |
| `pv2:debug` | 调试标记开关（`true` / `false`） | `SettingsPanel` 调试开关 |
| `pv2:xDrafts` | X 回复草稿（另见 `src/x/xDrafts.js`，最多 20 条、7 天过期） | `xDrafts` |

无 GM 环境时 `gm.getValue` / `gm.setValue` 回退到 `localStorage`，键名前缀为 `popup-viewer:`（例如 `popup-viewer:pv2:settings`）。

---

## 7. 初始化与数据流

### 7.1 启动流程

`src/main.js` 的启动分为三段：

```text
模块加载
  └─ debugMark('main-body ok')
       │
       ▼
bootstrap()
  ├─ document.readyState === 'loading'
  │    ├─ 监听 DOMContentLoaded → safeInit()
  │    └─ 1500ms 兜底定时器：仍未初始化则强制 safeInit()（兼容 iOS Userscripts 等 DOMContentLoaded 不触发的环境）
  └─ 否则立即 safeInit()
       │
       ▼
safeInit()
  └─ window.__PV2_INIT__ 防重复 → init()
```

`init()` 的顺序（数字为执行顺序）：

1. **自嵌套保护**：如果当前文档是脚本自己的弹窗 iframe（`window.__PV2_OWN_IFRAME__` 或 `frameElement.id === 'popup-panel-iframe'`），直接跳过。
2. `settingsManager.load()`：读取全局/站点设置并执行迁移。
3. **iframe 保护**：若当前在 iframe 中且 `allowInFrame !== true`，跳过（运行时等价 `@noframes`）。
4. `popupManager.popup.applyTheme(theme)`：先应用主题，UI 尚未创建时记录待用。
5. 延迟构建 UI：优先 `requestIdleCallback(buildUi, { timeout: 1200 })`，否则 `setTimeout(buildUi, 0)`。首屏不构建整套 UI，点击链接/齿轮/油猴菜单各自 `ensure()`。
6. `registerAdapters()`：注册 Discuz、Tgb、Linux、Cili、X。
7. `installXSupport()`：仅 `x.com` / `twitter.com` 页面注册 `xthread` 加载器并安装 GraphQL 网络桥；`__PV2_X__` 只在调试模式暴露。
8. `applyForumMarker()`：若当前站点有 `forumStyles` 适配器（如 Discuz），给 `<html>` 加 `pv-forum` 类。
9. `setupEvents()`：绑定 `click` / `mouseover`（均为捕获阶段）、`open-page`、`settings-changed`。
10. `setupObserver()`：`MutationObserver` 监听 `document.body` 的 `childList + subtree`，300ms 防抖执行 `siteManager.runEnhancements()`（首次立即执行）。
11. 顶层页面（非 iframe）执行 `setupMenu()`：注册「打开设置」「在此站点点选链接」「显示/隐藏右下角设置按钮（本站）」三个油猴菜单项。
12. `debugMark('init ok')` 与 `logger.log('Popup Viewer V2 已启用')`。

### 7.2 点击拦截流程

```text
document click（capture）
  │
  ├─ settingsManager.get().linkIntercept === false → 直接返回（不拦截）
  │
  ▼
siteManager.handleClick(event)
  ├─ event.defaultPrevented → false
  ├─ resolveCandidate(event)
  │    ├─ 点击落在脚本自己的 UI（含 shadow root）→ null
  │    ├─ rulesManager.match(event, hostname)  // 用户规则优先
  │    │    └─ URL 必须 isHttpUrl && !isDangerous && !isSamePageAnchor
  │    ├─ 遍历 activeAdapters(hostname, pathname)
  │    │    ├─ adapter.parseClick(event)
  │    │    ├─ urlResolver.resolve(parsed.url)
  │    │    ├─ isHttpUrl → 拒绝非 http(s)
  │    │    ├─ isDangerous → 拒绝 javascript:/data:/vbscript:/file:
  │    │    └─ isSamePageAnchor → 不拦截（锚点跳转交给浏览器）
  │    └─ 返回 { url, title, element } 或 null
  ├─ 命中：preventDefault + stopPropagation → eventBus.emit('open-page')
  └─ 未命中：返回 false，浏览器按原行为处理
```

`main.js` 的 `open-page` 处理：

1. `storageManager.addHistory({ url, title })`：写入最近历史（按 URL 去重，新的排前面）。
2. `popupManager.open({ url, title })`。

### 7.3 弹窗打开与加载流程

```text
PopupManager.open({ url, title })
  ├─ _pushHistory(url, title)        // 弹窗内历史栈（上限 50 条）
  ├─ popup.show(title, url)          // 外壳、遮罩、工具栏、标题、底部域名
  ├─ load(url)
  │    ├─ _flushDispose()            // 清理上一次延迟释放的加载器
  │    ├─ _abort?.()                 // 中止上一次加载
  │    ├─ token = ++_loadToken       // 防止旧请求迟到回调写进新内容
  │    ├─ 清空内容区 + showLoading()
  │    ├─ loaderManager.load(url, { container, hostname, onError, onLoad, onNavigate })
  │    └─ 保存返回的 abort/清理函数
  └─ _syncNavState()
```

加载器返回的 abort 同时承担清理职责（例如 X 加载器要断开观察器、清翻译队列）。`PopupManager` 在关窗或下一次加载前调用它；关窗时清理会延迟约 360ms，避免淡出动画中内容突然消失，期间重新打开则立即执行。

错误处理：`onError(message)` 经 `ErrorView.describeLoadError()` 把 HTTP 状态、超时、网络、解析错误翻译成用户能看懂的标题与说明，并按需显示「重试」「在新标签页打开」。加载超过 3 秒时 `Loading` 会补一句「还在加载」并提供新标签页出口。

### 7.4 悬停预热流程

```text
document mouseover（capture）
  ├─ linkIntercept === false → 返回
  ├─ 廉价前置判断：target 必须能 closest 到
  │    'a, [data-topic-url], [data-href], td.suh, .popup-trigger, .xst'
  ├─ siteManager.resolveCandidate(event)
  └─ candidate → prefetch.schedule(candidate.url, hostname)
       ├─ config.prefetch.enabled === false → 返回
       ├─ loaderManager.resolveMode(url, hostname) !== 'cache' → 返回
       ├─ 已缓存或正在预热同一 URL → 返回
       └─ 150ms 防抖后 loaderManager.prefetch(url)
            └─ CacheLoader.prefetch：抓取 + 净化 + 写内存缓存，并发同 URL 去重
```

预热只对 `cache` 模式生效；iframe 直载、parser、xthread 都不会预热。预热失败是正常情况（用户真正点击时会显示错误页），不会产生未处理 Promise 拒绝。

### 7.5 弹窗内导航历史

`PopupManager` 维护一个最多 50 条的 `_navHistory`，同时支持 iframe 原生历史：

- `open()` 每次向历史栈 push 当前 URL。
- 后退/前进优先调用 iframe 的 `history.back()` / `history.forward()`（仅同源可读时可用）；若 2 秒内没有产生 URL 变化，则回滚索引并按自维护栈重新加载。
- iframe 内部自主跳转（同源可读）通过 `onNavigate` 上报，新增历史条目并更新标题/地址；`document.write` 注入文档继承的宿主地址不会被误记成跳转。
- 关闭弹窗会清空弹窗内历史，下次打开不会残留「后退」可用状态。

---

## 8. 加载策略与站点策略

### 8.1 五种加载模式对比

| 模式 | 实现文件 | 工作方式 | 适用条件 | 安全边界 |
|---|---|---|---|---|
| `iframe` | `IframeLoader.js` | 创建 `<iframe>` 直接设置 `src` 加载目标页 | 目标站允许被 iframe 嵌入，且需要保留登录态/站点脚本 | `Sandbox.buildSandboxAttrs(hostname)`；只有 `sitePolicy.scripts === true` 才加 `allow-same-origin` + `allow-scripts` |
| `request` | `RequestLoader.js` | `GM_xmlhttpRequest` GET → `Sanitizer.sanitize()` → `renderIntoIframe()` | 不能/不希望 iframe 直载的普通抓取场景 | `contentSandboxAttrs(keepScripts)`：始终 `allow-same-origin`（注入需要），仅信任站点 `allow-scripts` |
| `parser` | `ParserLoader.js` | 抓取 → 净化 → `DOMParser` 解析 → 直接注入内容容器 | `config.loader.defaultMode === 'parser'` 的特殊站点 | 无 iframe sandbox 隔离；仅适合可信来源，且必须经过 Sanitizer |
| `cache` | `CacheLoader.js` | 与 request 相同的抓取/净化/渲染，额外使用内存缓存与并发去重 | `defaultMode === 'auto'` 且 `config.cache.enabled` | 与 request 相同；缓存的是已净化结果 |
| `xthread` | `XThreadLoader.js` | 页面上下文 GraphQL 读取帖子/评论，原生 DOM 渲染（双栏阅读器、互动、翻译、灯箱） | 仅 `x.com` / `twitter.com` 且已登录；加载器只在 X 页面注册 | 使用当前登录会话的页面内请求，不经过抓取净化；渲染内容来自 X 接口，需按不可信数据处理 |

补充说明：

- `IframeLoader` 无法设置移动端 UA（代码只在 debug 日志中说明）；`request` / `parser` / `cache` 在手机模式下会通过 `mobileUA()` 读取 `config.phone.sizes[phoneModel].ua` 并加入请求头。
- `CacheLoader` 的缓存是内存 `Map`：按插入顺序淘汰最旧条目，`ttl = 30 分钟`，`maxEntries = 50`；同一 URL 的并发请求复用同一个 in-flight Promise。
- `ParserLoader` 会把 `href/src/poster/data-src` 绝对化，并按 `popupLinksNewTab` 给链接加 `target="_blank"` / `rel="noopener noreferrer"`，图片补 `loading="lazy"`。
- `XThreadLoader` 不在 PopupKit 产物中：它依赖主脚本在 X 页面注册，PopupKit 的 `LoaderManager` 只有内置四种加载器。

### 8.2 模式解析顺序

`LoaderManager.resolveMode(url, hostname)` 的判定顺序（自上而下，先命中先返回）：

```js
const policy = this.sandbox.policyFor(hostname);
if (policy.xThread && this.loaders.xthread) return 'xthread';
if (policy.iframe) return 'iframe';

const mode = config.loader.defaultMode;
if (mode === 'iframe') return 'iframe';
if (mode === 'parser') return 'parser';
if (mode === 'request') return 'request';

if (config.cache.enabled) return 'cache';
return 'request';
```

注意 `xThread` 必须同时满足「站点策略开启」且「加载器已注册」。如果在非 X 页面点击 x.com 链接，当前页面没有注册 `xthread`，会继续按 `defaultMode` 走抓取路径（默认 `auto` 且缓存开启时为 `cache`）；这正是「X 加载器只在 X 页面注册」的预期行为，避免在缺少页面会话时静默失败。

### 8.3 sitePolicy 配置

`src/config.js` 的 `sitePolicy` 是「主机名 → 能力」映射：

```js
sitePolicy: {
  'linux.do': { iframe: true, scripts: true },
  'x.com': { xThread: true },
  'twitter.com': { xThread: true },
  '1cili.com': { iframe: false, scripts: true },
  's.9cili.mom': { iframe: false, scripts: true },
  unknown: { iframe: false, scripts: false }
}
```

| 字段 | 含义 | 影响 |
|---|---|---|
| `iframe: true` | 允许 iframe 直载 | `resolveMode()` 返回 `iframe`；`IframeLoader` 使用 `buildSandboxAttrs()` |
| `scripts: true` | 信任站点保留脚本 | `Sanitizer.sanitize(..., { keepScripts: true })`；`contentSandboxAttrs(true)` 加 `allow-scripts`；iframe 直载时 `buildSandboxAttrs` 加 `allow-same-origin` + `allow-scripts` |
| `xThread: true` | 使用 X GraphQL 渲染 | 仅当 `xthread` 加载器已注册（X 页面）时生效 |

匹配规则（`Sandbox.policyFor`）：精确匹配优先；否则遍历策略键做子域名匹配（`hostname.endsWith('.' + key)`，如 `www.1cili.com` 命中 `1cili.com`）；都不命中回退 `unknown`。`unknown` 是兜底策略，不建议删除。

### 8.4 新增站点策略

在 `src/config.js` 的 `sitePolicy` 中增加条目即可，无需改加载器：

```js
sitePolicy: {
  'example.com': { iframe: true, scripts: true },
  'another.example': { iframe: false, scripts: false },
  unknown: { iframe: false, scripts: false }
}
```

配置原则：

1. **默认不信任**：新站点先 `iframe: false, scripts: false`，走抓取净化路径；确认渲染正常后再考虑是否开 `scripts`。
2. **`scripts: true` 只给完全信任且必须执行脚本的站点**；它与 `allow-scripts` 绑定，等于允许目标站脚本在弹窗 iframe 内运行。
3. 需要保留登录态、且目标站允许被嵌入时，优先 `iframe: true`；若目标站设置 `X-Frame-Options` / CSP `frame-ancestors` 拒绝，则只能走抓取路径或让用户在新标签页打开。
4. X 类站点走 `xThread: true`，但加载器注册条件仍要求当前页面是 X 域名。

### 8.5 其他相关配置

| 配置 | 默认值 | 说明 |
|---|---|---|
| `popup.sizes` | small/medium/large/phone 四档 | 窗体尺寸预设；`phone` 使用 `min(92vw, 400px)` × `min(85vh, 720px)` |
| `popup.defaultSize` | `'medium'` | 默认窗体大小 |
| `popup.scrollbarVisible` | `true` | 默认显示窗体内滚动条 |
| `phone.sizes` | iPhone / iPhone Max / 安卓 / 小屏 | 手机模式尺寸与移动端 UA；`defaultModel='iphone'` |
| `loader.timeout` | `15000`（15 秒） | 所有抓取/iframe 加载超时 |
| `loader.defaultMode` | `'auto'` | 可选 `'auto'`、`'iframe'`、`'request'`、`'parser'` |
| `cache.enabled` | `true` | 是否启用内存缓存 |
| `cache.ttl` | 30 分钟 | 缓存条目过期时间 |
| `cache.maxEntries` | `50` | 缓存条目上限 |
| `prefetch.enabled` | `true` | 是否启用悬停预热 |
| `prefetch.hoverDebounceMs` | `150` | 悬停防抖毫秒数 |
| `observer.debounceMs` | `300` | DOM 增强 MutationObserver 防抖 |
| `storage.historyKey` / `favoritesKey` | `pv2:history` / `pv2:favorites` | 存储键 |
| `maxHistoryEntries` | `100` | 最近历史最大条数 |
| `ui.shadow` | `true` | 是否把外壳挂进 Shadow DOM；`false` 退回页面内挂载 |

---

## 9. 安全模型

### 9.1 威胁模型与防线

弹窗要展示的是**不可信的外部网页内容**。主要风险与对应防线：

| 风险 | 防线 |
|---|---|
| 恶意 HTML / XSS（`<script>`、事件属性、`javascript:` URL） | `Sanitizer` 清洗 + sandbox iframe 限制能力 |
| 危险协议（`javascript:` / `data:` / `vbscript:` / `file:`） | `Sanitizer` 属性清洗 + `UrlResolver` 拦截 |
| 目标站脚本访问父页面 | iframe `sandbox`；只有信任站点才授予 `allow-scripts` / `allow-same-origin` |
| 宿主网站 CSS 污染弹窗外壳 | Shadow DOM 隔离（不可用时回退） |
| 页面 CSP 拦截内联样式导致弹窗无样式 | `adoptedStyleSheets` 构造式样式表兜底 |
| 跨站请求权限过大 | `@connect *` 是 `GM_xmlhttpRequest` 抓取所需；脚本不经过中转服务器，数据留在本地 |

### 9.2 Sanitizer

`src/security/Sanitizer.js` 的 `sanitize(html, baseUrl, options)`：

1. `DOMParser.parseFromString(html, 'text/html')` 解析。
2. `_collectHead()` 收集样式：`link[rel]` 中 `rel` 含 `stylesheet`、`href` 以 `.css` 结尾、或 `rel=preload as=style` 的链接，以及 `head style`；样式链接绝对化后写入返回的 `head`。
3. `_purge()` 树遍历：
   - 删除注释节点。
   - 删除危险标签：`script`、`iframe`、`frame`、`frameset`、`object`、`embed`、`applet`、`form`、`link`、`meta`、`base`、`noscript`。
   - `keepScripts: true` 时仅保留 `<script>`，其它危险标签仍删除。
   - 删除所有 `on*` 事件属性、`srcdoc`。
   - `href` / `xlink:href` 删除 `javascript:`、`data:`、`vbscript:`、`file:` 协议。
   - `src` / `poster` / `background` 删除 `javascript:`、`vbscript:`、`file:`；**图片/海报允许 `data:` URI**。
4. `_resolveLazyImages()`：从 `REAL_SRC_ATTRS`（`zoomfile`、`file`、`data-src`、`data-original` 等）找真实图片地址，绝对化后写回 `src`，清掉懒加载属性并设 `loading='lazy'`；`data-srcset` / `data-original-set` 另由 `_resolveSrcset()` 处理。
5. 返回 `{ head, body, title }`；`title` 截取前 200 字符。

注意：Sanitizer 是「第一层」，不是唯一防线。即使净化遗漏，渲染 iframe 的 `sandbox`（无 `allow-scripts`）仍应能阻断脚本执行。

### 9.3 Sandbox

`src/security/Sandbox.js` 有两个层面：

**站点策略**（`Sandbox.policyFor(hostname)`）决定站点能力，支持子域名匹配，未知站点回退 `unknown`。

**iframe sandbox 属性**：

```js
// iframe 直载（IframeLoader）
buildSandboxAttrs(hostname, extra = []) {
  // 基础能力：allow-forms / allow-modals / allow-pointer-lock /
  //           allow-popups / allow-popups-to-escape-sandbox / allow-presentation
  // 仅当 policy.scripts === true 才追加 allow-same-origin + allow-scripts
}

// 抓取净化后写入内容（RequestLoader / CacheLoader）
contentSandboxAttrs(keepScripts = false) {
  // 始终包含 allow-same-origin（注入/后处理需要访问 iframe 文档）
  // 仅 keepScripts === true 才追加 allow-scripts
}
```

设计取舍：

- iframe 直载默认不给 `allow-same-origin`/`allow-scripts`，最大化隔离；信任站点才放开，以保留站点功能。
- 抓取渲染必须给 `allow-same-origin`（脚本要 `document.write` 与后处理），但**默认不给 `allow-scripts`**，所以即使 HTML 里混入漏网脚本也无法执行。
- `allow-popups-to-escape-sandbox` 让弹窗内「用新标签页打开」等操作真正跳出 iframe，而不是被目标站 `X-Frame-Options` 拒绝。

### 9.4 UrlResolver

`src/security/UrlResolver.js` 的实例以 `window.location.href` 为 base：

| 方法 | 作用 |
|---|---|
| `resolve(href)` | 绝对化；无法解析返回 `null` |
| `isSamePageAnchor(href)` | 同 origin + 同 pathname + 有 hash 且与当前 URL 不同 → 视为页内锚点，不拦截 |
| `isHttpUrl(href)` | 解析后协议必须是 `http:` / `https:` |
| `isDangerous(href)` | 协议属于 `javascript` / `data` / `vbscript` / `file` |

`SiteManager.resolveCandidate()` 对规则命中与适配器解析结果都做这套校验，`SiteManager` 不会把危险 URL 送进加载器。

### 9.5 Shadow DOM 隔离

`src/utils/uiHost.js` 负责外壳：

1. 创建 `<div id="pv2-ui-host">`，用内联 `all: initial !important; position: fixed; ...; z-index: 2147483000` 把宿主自身从页面布局与样式中剥离。
2. `attachShadow({ mode: 'open' })` 创建开放 shadow root。
3. 把 `style.css` 中 `:root` 令牌改写成 `:host`、主题类改成 `:host(.pv-theme-dark)` 等，再注入 shadow root。
4. 用 13px 宽的探针元素验证样式是否真的生效；失败则回退到页面内挂载（`setUiRoot(null)`，`gm.addStyle(style)`）。
5. 只把 `/* @pv-page-start */ … /* @pv-page-end */` 之间的「页面装饰」样式（如论坛链接提示图标）注入宿主页面；弹窗自身的样式全部留在 shadow root。

所有 `mountUi()` 挂载的 UI 节点都会进入 shadow root（若可用）；`uiQuery()` 在 shadow root 内查找；事件辅助 `eventTarget()` / `closestInPath()` / `isOwnUiNode()` 处理 shadow 事件重定向。这样宿主网站的 CSS 无法改变弹窗字号、行高、按钮外观，弹窗的 `--popup-*` 令牌也不会泄漏到网站。

### 9.6 CSP 兜底

严格 CSP 站点（例如 X）会拦截内联 `<style>`，表现为「整个弹窗没有样式」。项目用两条路并行：

- `gm.addStyle(css)`：先尝试 `GM_addStyle`，失败则 `<style>`，同时调用 `adoptStyle(css)` 用 `document.adoptedStyleSheets` 追加构造式样式表。构造式样式表走 CSSOM，不受 `style-src` 内联检查限制。
- `uiHost.injectInto(root, css)`：shadow root 优先 `adoptedStyleSheets`，不可用再 `<style>`；随后用探针验证，失败则整体回退。

`config.ui.shadow = false` 可强制回到 v2.2 的页面内挂载方式，用于排查 Shadow DOM 相关问题；正常情况下不要关闭。

### 9.7 @grant 权限

`banner.txt` 声明的权限与用途：

| 指令 | 用途 |
|---|---|
| `GM_xmlhttpRequest` | 跨域抓取目标页面（`request` / `parser` / `cache` 加载路径） |
| `GM_addStyle` | 注入样式（主脚本 + 页面装饰） |
| `GM_getValue` / `GM_setValue` | 读写设置、规则、历史、收藏、草稿 |
| `GM_registerMenuCommand` | 注册油猴菜单（打开设置、点选链接、显示/隐藏齿轮） |
| `unsafeWindow` | 在 X 页面安装页面上下文的 GraphQL 网络桥（`xBridge.js`） |
| `@include *://*/*` | 在所有站点运行（站点适配器/用户规则按需匹配） |
| `@connect *` | 允许 `GM_xmlhttpRequest` 访问任意目标域 |
| `@run-at document-idle` | DOM 就绪后初始化，降低对页面加载的影响 |
| `@license MIT` | 许可证声明 |

`banner.txt` 没有 `@noframes`，但 `main.js` 通过 `isInIframe()` + 设置项 `allowInFrame` 在运行时实现等价行为：默认在 iframe 内跳过初始化；脚本自己的弹窗 iframe 始终跳过，避免套娃。

无 GM 环境时，`utils/gm.js` 回退到 `fetch`、`localStorage` 和 `<style>` 注入。注意 `fetch` 受同源策略/CORS 限制，跨域抓取能力会弱于 `GM_xmlhttpRequest`。

### 9.8 贡献者的安全红线

- 不要绕过 `Sanitizer` 直接把抓取到的 HTML 塞进 `innerHTML`（主页面 DOM 或未沙箱容器）。
- 不要给未知站点默认开启 `scripts: true`；不要把 `allow-scripts` 加到非信任 iframe。
- 新增加载器必须提供 abort 清理函数，并说明内容是否经过净化、是否需要 sandbox。
- X 相关实现不得把鉴权头写入存储或日志；`xBridge` 只在内存保存捕获到的请求头，`captureState()` 只返回掩码状态。
- 不要引入运行时第三方依赖；如需新增开发依赖，先在 Issue 中说明理由。
- 处理用户输入（规则选择器、URL）时必须 try/catch，非法 CSS 选择器不能导致整页脚本崩溃。

---

## 10. 扩展开发指南

### 10.1 新增站点适配器

**步骤：**

1. 在 `src/adapters/` 新建 `FooAdapter.js`，继承 `BaseAdapter`。
2. 实现 `match(hostname, pathname)`、`parseClick(event)`、`enhance(doc, hostname, pathname)`。
3. 在 `src/main.js` 的 `registerAdapters()` 中注册。注册顺序影响匹配优先级：把更具体的站点放前面。
4. 如需「论坛链接美化」页面样式，设置 `this.forumStyles = true`，并在 `src/ui/style.css` 的 `@pv-page-start/end` 块内添加样式；`applyForumMarker()` 会给 `<html>` 加 `pv-forum`。
5. 如需 iframe 直载/保留脚本，在 `src/config.js` 的 `sitePolicy` 增加站点策略。
6. 补测试：纯 URL/归一化逻辑可放 `tests/*.test.mjs`；DOM 选择器行为用真实浏览器或 harness 页面验证。
7. `npm test` + `npm run build`，确认 `dist/` 同步。

**骨架：**

```js
import { BaseAdapter } from './BaseAdapter.js';

export class FooAdapter extends BaseAdapter {
  constructor() {
    super();
    this.name = 'Foo';
    // this.forumStyles = true; // 仅在需要页面装饰样式时开启
  }

  match(hostname, pathname) {
    // 精确/子域名匹配可用 this.matchDomain(hostname, ['example.com'])
    return hostname === 'example.com' && pathname.startsWith('/thread/');
  }

  parseClick(event) {
    // 只处理真正要预览的链接；返回 null 表示不拦截
    const link = event.target.closest?.('a.thread-title');
    if (!link) return null;
    const url = this.resolveHref(link.href, window.location.href);
    if (!url) return null;
    return { url, title: (link.textContent || '').trim() || '查看帖子', element: link };
  }

  enhance(doc) {
    // 可给命中元素加 popup-trigger 类；注意不要破坏站点自身的 React/Vue 渲染
    doc.querySelectorAll('a.thread-title').forEach((link) => {
      if (link.href && !link.href.startsWith('javascript:')) link.classList.add('popup-trigger');
    });
  }
}
```

```js
// src/main.js
function registerAdapters() {
  siteManager.register(new FooAdapter()); // 放在合适的位置，注意顺序
  siteManager.register(new DiscuzAdapter());
  // ...
}
```

**测试建议：**

- `parseClick` 依赖真实 DOM，最可靠的方式是在目标站点用 Tampermonkey + `?pv2_debug` 实测，并观察 `[click]` 日志与 debug 标记。
- `resolveHref` / URL 归一化等纯函数可以抽到独立模块并用 `node:assert` 测试。
- 引用帖/嵌套结构要防止重复拦截：参考 `XAdapter.isTopLevelTweet()` 与 `shouldSkipTarget()`。

### 10.2 新增加载器

**接口约定：**

```js
class MyLoader {
  /**
   * @param {Object} ctx {
   *   url, hostname, keepScripts, mobileUA, linkIntercept,
   *   loadingSelector, container, onError, onLoad, onNavigate
   * }
   * @returns {Function} abort / 清理函数
   */
  load(ctx) {
    // 1. 发起请求或建立渲染
    // 2. 成功后把内容渲染进 ctx.container
    // 3. 调用 ctx.onLoad?.()
    // 4. 失败调用 ctx.onError(message)
    return () => {
      // 中止请求、断开 observer、移除节点
    };
  }
}
```

**注册与接入：**

1. 在 `src/main.js` 中按需 `loaderManager.register('mymode', new MyLoader())`。参考 `installXSupport()`：`xthread` 只在 X 页面注册，其它页面不会实例化/使用 X 专用逻辑（PopupKit 产物也不包含它）。
2. 扩展 `LoaderManager.resolveMode()`，让它在合适条件下返回 `'mymode'`。注意顺序：`xThread`/`iframe` 策略优先，然后才是 `defaultMode` 分支。
3. 若加载的是外部 HTML，必须经过 `sanitizer.sanitize()`，并使用 `contentSandboxAttrs(keepScripts)` + `renderIntoIframe()`，或自己提供等价隔离。
4. `abort` 必须可重复调用且幂等；`PopupManager` 会在关窗、下一次加载前调用它。
5. 如需悬停预热，加载器必须与 `CacheLoader` 的缓存语义兼容；简单做法是直接复用 `CacheLoader` 或在 `LoaderManager.prefetch()` 中分流。
6. 注意 PopupKit 产物不会包含主脚本按需注册的加载器；如果该加载器需要给 PopupKit 使用，需要另行设计暴露方式，不能直接假设 `window.PopupKit` 能访问私有 `loaderManager`。

### 10.3 新增设置项

**第一步：确定作用域与默认值**

- **全局设置**：所有站点共享 → 加入 `src/core/SettingsManager.js` 的 `GLOBAL_KEYS` 常量，并在 `defaultGlobal()` 增加默认值。
- **按站点设置**：多数交互设置按站点独立 → 在 `defaultSite()` 增加默认值；`set()` 会自动把它归入当前站点，无需维护站点键列表。

```js
// src/core/SettingsManager.js
const GLOBAL_KEYS = ['theme', 'allowInFrame', 'handedness', 'mobileResize', 'myGlobalKey'];

function defaultGlobal() {
  return { theme: 'auto', allowInFrame: false, handedness: 'right', mobileResize: false, uiRev: 1, myGlobalKey: true };
}

function defaultSite() {
  return {
    // ...
    mySiteKey: 'default'
  };
}
```

**第二步：读写与持久化**

`settingsManager.set({ myGlobalKey: false })` 会根据键是否在 `GLOBAL_KEYS` 自动分流，并调用 `_persist()` 写入 `pv2:settings` 或 `pv2:siteSettings`。读取统一用 `settingsManager.get()`。如果新设置需要约束（例如互斥项），在 `_applyInvariants()` 中实现。

**第三步：SettingsPanel UI**

在 `src/ui/SettingsPanel.js` 中，按现有模式加控件：

- 开关：`rowBlock(label, sub, switchWrap, tip, settingKey)`。
- 分段控件：`makeSeg(...)` + `colBlock(...)`；`settingKey` 传给 `titleCol()` 后会自动显示「仅本站」标记（`settingsManager.isSiteKey(settingKey)`）。
- 每次变更：`settingsManager.set({...})` → `persist()`（内部调用 `onChange` 并 emit `settings-changed`）。
- 若控件需要随其他设置联动，监听 `eventBus.on('settings-changed', ...)` 或调用对应的 `sync()`。

```js
const mySwitch = el('input', { type: 'checkbox', id: 'pv-settings-my-key' });
mySwitch.checked = settingsManager.get().mySiteKey !== false;
mySwitch.addEventListener('change', () => {
  settingsManager.set({ mySiteKey: mySwitch.checked });
  persist();
});
commonPane.append(rowBlock('我的新设置', '说明文字', el('label', { class: 'pv-switch' }, mySwitch, el('span', { class: 'pv-switch-track' })), '提示文案', 'mySiteKey'));
```

**第四步：消费与清理**

- 面板相关设置由 `PopupPanel.applySettings(s)` 统一应用；新增的布局/行为类设置在这里读取并切换 class 或 CSS 变量。
- 「恢复默认」由 `settingsManager.reset()` 处理全局 + 本站设置；如果新控件是独立 DOM 状态，记得在 `resetBtn` 的点击处理中同步控件 UI。
- 迁移旧值：在 `SettingsManager.load()` 中读取旧存储并修正默认值（参考 `mobileResize` 的 `uiRev` 迁移与 `popupLinksNewTab` 迁移）。

### 10.4 新增 UI 组件

**命名与挂载约定：**

| 约定 | 说明 |
|---|---|
| `pv-` 前缀 | 主脚本 UI 的 id/class 前缀（如 `pv-settings-*`、`pv-rules-*`、`pv-picker-*`）；弹窗外壳的历史元素使用 `popup-panel-*` / `popup-content-*` |
| `pvk-` 前缀 | PopupKit 的独立前缀（`pvk-panel`、`pvk-overlay`、`pvk-content` 等），避免与主脚本/其他脚本冲突 |
| `mountUi(node)` | 顶层 UI 节点必须用它挂载：有 shadow root 时进 shadow，否则按 `pickMountPoint()` 挂 body/html |
| `uiQuery(selector)` | 查找脚本自己的 UI 时用它，而不是 `document.querySelector`（shadow 模式下后者找不到） |
| `eventTarget(e)` / `closestInPath(e, sel)` | 文档级事件监听中使用，穿透 shadow root；不要直接用 `e.target.closest` |
| `isOwnUiNode(node)` | 判断点击是否落在脚本自己的 UI 上（含 shadow 宿主） |
| `isEditableEvent(event)` | 快捷键处理前判断焦点是否在输入控件里 |

**样式约定：**

- 主脚本样式集中写在 `src/ui/style.css`；PopupKit 样式在 `src/kit/kit.css`。
- 主题/布局令牌使用 `--popup-*`（如 `--popup-bg`、`--popup-accent`、`--popup-width`、`--popup-height`）。
- 字体、动效、X 阅读器令牌使用 `--pv-*` / `--pv-x-*`（如 `--pv-font`、`--pv-z`、`--pv-x-bg`）。
- 只作用于宿主页面的样式必须放进 `/* @pv-page-start */ … /* @pv-page-end */` 块，`uiHost.extractPageCss()` 只会把这部分注入页面；其余样式留在 shadow root。

**可访问性与交互：**

- 隐藏中的面板/弹层设置 `inert` 与 `aria-hidden`，显示时移除（参考 `PopupPanel._syncInert()`）。
- 模态面板补 `role="dialog"`、`aria-modal="true"`、`aria-label`；Tab 焦点在面板内循环，关闭后焦点归还触发元素。
- 快捷键处理必须先排除输入控件与输入法组字（`e.isComposing || e.keyCode === 229`）。
- 新增按钮使用 `el('button', { type: 'button', ... })` 并补 `aria-label`/`title`；触屏热区不小于 44px。

**生命周期：**

- 在 `ensure()` 中按需创建 DOM，避免首屏构建全部 UI。
- 事件监听、`MutationObserver`、`ResizeObserver`、定时器在关闭/销毁时清理；X 阅读器的 `cleanup()` 是参考实现。
- 若组件需要读取设置，直接 `settingsManager.get()`；若需要响应用户改设置，订阅 `eventBus` 的 `settings-changed` 或通过 `PopupPanel.applySettings`。

### 10.5 扩展检查清单

- [ ] 新文件放在正确的目录，命名与现有风格一致（类文件 PascalCase，工具函数 camelCase）。
- [ ] 适配器已在 `main.js` 注册，或加载器已在 `LoaderManager` 注册并在 `resolveMode` 中可达。
- [ ] 所有外部 HTML 经过 `Sanitizer`；所有 iframe 使用 `Sandbox` 生成的属性。
- [ ] 设置项有默认值、有 UI、有 `persist()`，并考虑是否需要迁移。
- [ ] UI 使用 `pv-` / `pvk-` 前缀，顶层节点走 `mountUi()`。
- [ ] 有对应的测试或手工验证记录；`npm test` 与 `npm run build` 通过。
- [ ] 代码类改动已递增 `package.json` + `banner.txt` 版本，并重建 `dist/`。

---

## 11. 测试与调试

### 11.1 自动化测试

`npm test` 依次执行三个文件：

```bash
node tests/xModel.test.mjs && node tests/selector.test.mjs && node tests/xZoomMath.test.mjs
```

| 测试文件 | 覆盖范围 | 形式 |
|---|---|---|
| `tests/xModel.test.mjs` | X 数据层：帖子 ID 解析、`parseThreadSummary`、游标、引用帖、长文、媒体变体、实体区间、翻译判定、草稿、`mergeModel`、格式化 | 52 个 `check()` 用例，使用 `node:assert/strict` |
| `tests/selector.test.mjs` | 点选候选排序 `rankCandidates`、`describeCandidate`、`isStableClassName` | 纯逻辑断言 |
| `tests/xZoomMath.test.mjs` | 灯箱缩放/平移数学：`clampScale`、`zoomTowards`、`clampTranslate`、`maxScaleFor`、`fitPercent`、`sliderRatioToScale` / `sliderScaleToRatio` | 纯逻辑断言 |

当前基线的 `npm test` 输出：`54 passed`（xModel）+ selector tests passed + xZoomMath all assertions passed。

**新增测试：**

1. 在 `tests/` 新建 `yourFeature.test.mjs`，使用 `node:assert/strict`，可直接 `node tests/yourFeature.test.mjs` 运行。
2. 把新文件加入 `package.json` 的 `test` 脚本（用 `&&` 串联），否则 `npm test` 不会执行。
3. 尽量让被测逻辑保持纯函数（不依赖 DOM/`window`），便于在 Node 中直接测试；需要 DOM 的行为放到 harness 页面或真实浏览器验证。

### 11.2 手动测试页

`tests/` 下有两个 HTML harness：

| 文件 | 验证内容 |
|---|---|
| `tests/settings-harness.html` | 设置面板切 tab 宽度不抖、`scrollbar-gutter`、最近列表重开刷新 |
| `tests/lightbox-harness.html` | X 灯箱外置箭头、缩放/平移、滚轮兜底、窄面板布局 |

两个文件头部注释都给出了可直接执行的 headless Chrome 命令（含 `--allow-file-access-from-files` 等参数），结果输出在页面最后的 `<pre id="out">`。示例（Windows Chrome 路径，按本机调整）：

```bat
"C:\Program Files\Google\Chrome\Application\chrome.exe" --headless=new --disable-gpu --no-sandbox --allow-file-access-from-files --force-prefers-reduced-motion --window-size=1200,900 --virtual-time-budget=20000 --dump-dom "file:///D:/source/favjs/popup-viewer-v2/tests/settings-harness.html"
```

普通交互验证建议用真实浏览器 + Tampermonkey：安装 `dist/popup-viewer-v2.user.js`，在目标站点实际操作一遍（点击链接、设置、规则、X 阅读器、移动端/触屏）。

### 11.3 调试标记 pv2_debug

开启方式（两种，满足其一）：

- URL 查询串或 hash 带 `pv2_debug`，如 `https://example.com/?pv2_debug`、`https://example.com/#pv2_debug`。
- 设置 → 高级 →「调试标记」打开（写入 `pv2:debug`，下次刷新生效）。

开启后页面会显示：

| 标记 | 颜色 | 含义 |
|---|---|---|
| `[PV2] boot v2.3.7` | 紫色（左上） | 构建版本；来自 `__PV2_VER__` |
| `1. EventBus`、`2. SiteManager` … | 深灰（右侧） | 模块加载序号；最后一个序号是崩溃点定位线索 |
| `[PV2] init ok`、`click: HANDLED` 等 | 橙色 | `debugMark()` 状态 |
| `[PV2] xxx ERR: ...` | 红色 | `showErr()` 错误与栈前几帧 |
| `[PV2] 初始化未执行：模块级崩溃（被吞）` | 红色 | 2 秒看门狗：初始化未执行 |

控制台日志注意：`logger.log` / `logger.debug` 只在 **URL 查询串包含 `pv2_debug`** 时输出（如 `?pv2_debug`，对应 `src/utils/logger.js` 的 `configDebug()` 只检查 `location.search`）；`#pv2_debug` 只对 `debugFlag.js`（徽标与 `__PV2_X__` 暴露判定）生效，**不会**打开 logger 的 `log`/`debug` 输出。`warn` / `error` 始终输出，前缀 `[PopupViewer]`。需要同时看徽标和控制台日志时，请使用 `?pv2_debug`。

常用调试入口：

- `window.__PV2_INIT__`：初始化防重复标记，正常应为 `true`。
- `window.__PV2_OWN_IFRAME__`：脚本自己的弹窗 iframe 标记。
- 控制台筛选 `[PopupViewer]` / `[LoaderManager]` / `[PopupManager]` 查看加载路径。

### 11.4 X 专用调试入口 `__PV2_X__`

仅在 **X 域名页面 + 调试模式** 下暴露（`main.js` 的 `installXSupport()`）：

```js
// 控制台可用（需先开启 pv2_debug）
__PV2_X__.captureState()        // 已捕获的鉴权头/模板状态（掩码）
__PV2_X__.probe(tweetId)        // 读取帖子并返回摘要 + 耗时 + 状态
__PV2_X__.probeRaw(tweetId, cursor?) // 原始 GraphQL 响应
__PV2_X__.hasOperation(name)    // 页面 runtime 是否发现指定 GraphQL operation
__PV2_X__.theme()               // 当前 X 主题令牌（颜色/字体）
__PV2_X__.fontDiag()            // 弹窗正文与宿主 X 正文的字体/字重/抗锯齿对比
__PV2_X__.postDiag()            // 各帖子正文长度、是否拿到全文、是否需要「显示更多」
__PV2_X__.positionDiag()        // 面板 position/transform、是否被宿主 transform 影响
__PV2_X__.styleDiag()           // 样式是否生效、CSP 是否拦截、adoptedStyleSheets 状态
```

`theme()` / `fontDiag()` / `postDiag()` / `positionDiag()` / `styleDiag()` 用于排查「X 皮肤不对 / 字体发虚 / 长贴没显示全 / 弹窗不居中 / 整表样式没生效」等观感问题。`__PV2_X__` 含 `probeRaw`（可用当前登录会话发 GraphQL 读请求），因此只在调试模式暴露，生产模式会置为 `undefined`。

### 11.5 常用调试位置与存储键

| 目标 | 位置 |
|---|---|
| 加载模式选择 | 控制台 `[LoaderManager] mode=... scripts=...`（URL 带 `pv2_debug`） |
| 点击是否命中 | 橙色 `click: HANDLED` / `click: no-match` |
| 规则/适配器报错 | `[RulesManager]` / `[adapterName] parseClick error` |
| 设置持久化 | Tampermonkey 存储或 `localStorage` 的 `pv2:settings` / `pv2:siteSettings` |
| 规则持久化 | `pv2:rules` |
| 调试开关 | `pv2:debug` |
| X 网络层 | X 页面控制台 `__PV2_X__.captureState()` |

### 11.6 提交前验证清单

- [ ] `npm test` 全部通过。
- [ ] `npm run build` 成功，`dist/` 两个文件已更新。
- [ ] 在至少一个支持站点手工验证：点击链接、弹窗打开、关闭、刷新、后退/前进。
- [ ] 涉及设置/规则/X/移动端时，分别覆盖对应路径（建议开启 `?pv2_debug` 看标记）。
- [ ] 检查没有把 `node_modules/`、私钥、日志等无关文件加入提交。

---

## 12. 代码规范与提交约定

### 12.1 AGENTS.md 硬性约束

仓库根目录的 [AGENTS.md](../AGENTS.md) 规定了两条全局规则：

1. **禁止自动提交**：除非用户主动明确要求（如「提交」「commit」「push」），不得执行任何 `git commit` / `git push` / `git merge` / `git branch -d` 等写操作。所有变更停留在工作区，待用户确认。
2. **代码更新须递增版本号**：涉及代码更新的提交前，先更新版本号（`package.json` + `banner.txt`，随后重新构建 `dist/` 同步）；纯文档/配置类改动（README、CHANGELOG、`.gitignore` 等）无需递增版本号。

这两条优先于本手册其它流程描述；日常贡献默认只改工作区，不自行提交。

### 12.2 代码风格

- 原生 JavaScript（ES Modules），2 个空格缩进，语句以分号结尾，字符串优先单引号。
- 所有文本文件 UTF-8、LF 换行；编辑器配置见 `.editorconfig`（Markdown 保留行尾空格）。
- 用户可见文案使用简体中文；注释解释「为什么」而不是复述代码。
- 不引入运行时依赖；新增开发依赖需先在 Issue 说明理由。
- 不要手工修改 `dist/` 与 `package-lock.json`；依赖变更用 npm 命令重新生成锁文件。

### 12.3 命名与文案

| 对象 | 约定 | 示例 |
|---|---|---|
| 类文件 | PascalCase | `EventBus.js`、`XThreadLoader.js`、`KitPopupPanel.js` |
| 工具模块 | camelCase | `debugFlag.js`、`panelBehavior.js` |
| 单例导出 | lowerCamelCase | `eventBus`、`siteManager`、`loaderManager` |
| 主脚本 UI id/class | `pv-` / `popup-` 前缀 | `pv-settings-*`、`popup-panel-*` |
| PopupKit UI | `pvk-` 前缀 | `pvk-panel`、`pvk-overlay`、`pvk-content` |
| CSS 令牌 | `--popup-*` / `--pv-*` / `--pv-x-*` | `--popup-width`、`--pv-z` |
| 设置键 | lowerCamelCase | `panelSize`、`linkIntercept`、`popupLinksNewTab` |
| 用户文案 | 简体中文、短句、可操作 | 「加载超时或被阻止，请尝试在新标签页打开。」 |

### 12.4 分支规范

参考 [CONTRIBUTING.md](../CONTRIBUTING.md)：

- `main` 为默认分支，始终保持可构建、可发布；不要直接向 `main` 推送。
- 从最新 `main` 创建分支，命名建议：
  - `feat/<简短描述>`：新功能
  - `fix/<简短描述>`：缺陷修复
  - `docs/<简短描述>`：文档
  - `refactor/<简短描述>`、`chore/<简短描述>`：重构与工程配置
- 分支名使用小写英文、数字与连字符，如 `fix/linux-do-timeout`。
- 例外：**版本线维护分支**用「待发布版本号」命名，如 `2.3.7`。它承载一整轮迭代（可多个功能/修复），内部版本号用四段累计 `2.3.7.1`、`2.3.7.2`…，最后一并发布为 `2.3.8`（详见 [13.1](#131-版本策略)）。

### 12.5 提交信息

历史上的发布提交多采用「版本号 + 中文摘要」，例如：

```text
v2.3.5 UX修复: 移动端外壳/设置面板重做、规则面板焦点循环、X完整时间与回复图标入口...
docs: 移除已被 codemap 取代的 design 设计文档; .gitignore 忽略 .slim 工具产物
```

新贡献建议按 CONTRIBUTING 使用「类型: 摘要」：

```text
fix: 修复 linux.do iframe 已显示却被超时错误覆盖
docs: 补充链接规则的常见问题
```

类型可用：`feat`、`fix`、`docs`、`refactor`、`perf`、`test`、`build`、`ci`、`chore`。一次提交只做一件事，避免把无关格式化混入功能提交。

---

## 13. 发布流程

### 13.1 版本策略

- 对外发布版本号遵循 `MAJOR.MINOR.PATCH`，线上最新为 **2.3.7**。
- **维护分支内**（如 `2.3.7`）的每次版本更新使用四段 `2.3.7.N`，N 从 1 开始累计：`2.3.7.1` → `2.3.7.2` → `2.3.7.3`…。这些版本只在分支内迭代，不单独对外发版。
- 一轮迭代结束后**统一发版为下一个补丁号**（`2.3.7` 分支 → **`2.3.8`**）：版本号回到三段，合并进 `main` 并推送后对外生效。
- 代码类改动（`src/**`、`build.mjs`、样式、构建配置）必须递增版本号；纯文档/配置改动（README、CHANGELOG、`.gitignore` 等）不需要。
- 版本号至少同步 `package.json`、`banner.txt`、`package-lock.json`（见 [4.6](#46-版本号如何进入产物)）；发布记录同步 `CHANGELOG.md`。

### 13.2 发布步骤

以发布 `2.3.7` 为例（维护者在用户明确要求提交/推送时执行）：

1. **确认改动范围**：`git status` / `npm run g -- status`，确认只包含预期文件；`dist/` 的改动来自构建，不应手工编辑。
2. **递增版本号**：修改 `package.json` 的 `version` 与 `banner.txt` 的 `@version`，两处必须一致。
3. **更新 CHANGELOG**：在 `CHANGELOG.md` 顶部新增 `## [2.3.7] - YYYY-MM-DD`，按 `Added` / `Changed` / `Fixed` 分类记录。
4. **运行测试**：`npm test`。
5. **构建产物**：`npm run build`；确认 `dist/popup-viewer-v2.user.js` 头部 `@version` 已是新版本，且 `dist/popup-viewer-kit.js` 同步更新。
6. **可选压缩发布**：如果发布渠道需要压缩版，`npm run build:min`；注意仓库 CI 的 `npm run build` 校验，见 [4.5](#45-dist-同步规则)。
7. **手工冒烟**：在 Tampermonkey 中重新导入 `dist/popup-viewer-v2.user.js`，验证至少一个支持站点能正常弹窗。
8. **提交**：`npm run g -- commit "v2.3.7 ..."`（默认会先构建），或先 `git add` 后手动提交。
9. **推送**：`npm run g -- push`；或一步完成 `npm run g -- publish "v2.3.7 ..."`。
10. **验证 CI**：GitHub Actions 在 push/PR 到 `main` 时执行 Node 20/22 测试、构建与 `dist` 同步校验；全部通过后发布完成。
11. **GitHub Release（自动）**：给发版提交打 tag 并推送——`git tag -a vX.Y.Z -m "vX.Y.Z 主题" && git push origin vX.Y.Z`。`.github/workflows/release.yml` 会自动跑测试、构建、校验 tag 与版本一致，并创建附 `dist` 产物的 Release（notes 取自 `CHANGELOG.md` 对应条目）。

**从维护分支发版（`2.3.7` → `2.3.8`）**

分支内迭代时按普通流程走（`node tools/version.mjs bump` 得到 `2.3.7.2`、`2.3.7.3`…），发版时：

1. `node tools/version.mjs set 2.3.8` —— 三段版本，同时写入 `package.json`、`banner.txt`、`package-lock.json`。
2. `CHANGELOG.md` 顶部新增 `## [2.3.8] - YYYY-MM-DD`，把分支内 `2.3.7.N` 的改动合并归类。
3. `npm test && npm run build`，确认 `dist` 头部 `@version` 为 `2.3.8`。
4. 提交并在分支上推送（`npm run g -- publish "v2.3.8 ..."`），随后合并回 `main` 并推送；CI 仅在 `main` 的 push/PR 上运行，合并后必须确认通过。
5. 在合并后的 `main` 上打 tag 并推送（`git tag -a v2.3.8 -m "..." && git push origin v2.3.8`），触发 `release.yml` 自动创建 GitHub Release；tag 必须打在**包含 release.yml 的提交**上才会触发。
6. 合并完成后删除维护分支（本地与远端）。

### 13.3 git-tools.mjs 用法

`tools/git-tools.mjs` 统一入口：

```bash
npm run g -- status
npm run g -- commit "提交信息"
npm run g -- publish "提交信息"
npm run g -- push
npm run g -- setup git@github.com:coresZ/popup-viewer-v2.user.git
```

| 命令 | 行为 |
|---|---|
| `status` | 工作区变更 + 最近 5 条提交 |
| `commit` | 默认先 `npm run build` → `git add -A` → `git commit -m`；传 `--no-build` 跳过构建 |
| `push` | 推送到上游跟踪分支 |
| `publish` | 构建 → 提交 → 推送，一步到位 |
| `setup` | origin 不存在则添加，已存在跳过；始终把当前分支切到 `main` |

工具默认使用项目根目录的 SSH 私钥文件（文件名见 [tools/git-tools.md](../tools/git-tools.md) 与 `.gitignore`），通过 `GIT_SSH_COMMAND` 指定 `-i`、`IdentitiesOnly=yes`、`StrictHostKeyChecking=accept-new`。没有密钥文件时本地 commit/status 仍可用，push 走系统默认 SSH。私钥不要提交进 git。

```bash
# 只提交文档，不构建（纯文档改动）
npm run g -- commit "docs: 补充开发手册" --no-build

# 一步构建 + 提交 + 推送（需用户明确要求）
npm run g -- publish "v2.3.7 灯箱缩放"
```

### 13.4 发布后检查

- GitHub Actions 的 `CI` 工作流通过（Node 20/22、测试、构建、`dist` 同步）。
- `https://raw.githubusercontent.com/coresZ/popup-viewer-v2.user/main/dist/popup-viewer-v2.user.js` 可访问且 `@version` 正确。
- README 版本徽章（如有）与 `package.json` 一致。
- `CHANGELOG.md` 顶部日期与版本正确；`docs/README.md` 的「当前版本」如需更新也一并同步。
- 在至少一个真实站点完成安装/升级后的冒烟验证。

---

## 14. GitHub 仓库维护建议

### 14.1 仓库基础信息

- **仓库**：`https://github.com/coresZ/popup-viewer-v2.user`，默认分支 `main`。
- **建议描述**：`Tampermonkey 用户脚本：在页内弹窗中预览论坛帖子与链接，插件化站点适配、多加载策略与安全净化。`
- **建议 Topics**：`tampermonkey`、`userscript`、`popup`、`forum`、`discuz`、`x-twitter`、`javascript`、`esbuild`、`browser-extension`。
- **建议开启**：Issues、Pull Requests、Discussions（可选）；关闭空 Issue（由 `.github/ISSUE_TEMPLATE/config.yml` 引导）。
- **建议关闭**：Wiki（文档统一放 `docs/`，避免双份维护）。
- **Social preview**：上传一张弹窗截图，便于仓库分享。

### 14.2 分支保护

对 `main` 建议启用规则（GitHub Settings → Rules / Branches）：

- 禁止直接 push，要求通过 Pull Request 合并。
- 要求 CI 状态检查通过（`CI / Node 20`、`CI / Node 22`）。
- 要求分支与 `main` 保持最新（Require branches to be up to date）。
- 要求至少 1 个审批；合并后自动删除分支。
- 禁止 force push 与删除 `main`。
- 允许管理员在紧急修复时绕过（按团队约定）。

### 14.3 Issue / PR 模板

`.github/` 下已有：

| 文件 | 用途 |
|---|---|
| `ISSUE_TEMPLATE/bug_report.yml` | Bug 报告表单：环境、脚本版本、站点、复现步骤、期望/实际、日志截图 |
| `ISSUE_TEMPLATE/feature_request.yml` | 功能建议表单 |
| `ISSUE_TEMPLATE/config.yml` | 关闭空白 Issue，给出文档/讨论链接 |
| `pull_request_template.md` | PR 变更说明、类型、测试、检查清单（`npm test`、`npm run build`、`dist` 同步、版本号） |
| `dependabot.yml` | npm 依赖每周检查 |
| `CODEOWNERS` | 默认代码所有者（`* @coresZ`） |

维护建议：模板字段保持精简、必填项明确；Issue 中要求附「脚本版本 + 浏览器 + 站点 + 复现步骤 + 调试标记截图」，能显著减少往返。安全漏洞不要走公开 Issue，按 [SECURITY.md](../SECURITY.md) 私下报告。

### 14.4 CI 工作流

`.github/workflows/ci.yml`：

```yaml
name: CI
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
permissions:
  contents: read
jobs:
  test:
    strategy:
      fail-fast: false
      matrix:
        node-version: [20, 22]
    steps:
      - checkout
      - setup-node (cache: npm)
      - npm ci
      - npm test
      - npm run build
      - git diff --exit-code -- dist
```

关键点：

- 只在 push/PR 到 `main` 时触发，避免所有分支都跑。
- Node 20/22 矩阵覆盖最低维护版本；本地 Node ≥18 也能运行测试。
- `git diff --exit-code -- dist` 强制构建产物与源码同步：如果改了 `src/` 但忘记构建提交 `dist/`，CI 会失败。
- `permissions: contents: read` 是最小权限原则。

### 14.5 依赖与安全提醒

- 唯一开发依赖是 esbuild；Dependabot 每周检查 npm 依赖，升级后跑 `npm test` + `npm run build`，并把 `package-lock.json` 一起提交。
- 不在仓库中存放任何私钥、token、密码；`.gitignore` 已忽略本地 SSH 私钥与常见杂项。
- 第三方代码来源在 [THIRD_PARTY_NOTICES.md](../THIRD_PARTY_NOTICES.md) 中声明；引入新第三方代码时必须补充许可与来源说明。
- 安全漏洞按 [SECURITY.md](../SECURITY.md) 私下报告，不在 Issue/PR 中公开细节。

### 14.6 发布与标签

- 日常发版走「版本号 + CHANGELOG + CI」流程即可。
- GitHub Release 已自动化：推送与 `package.json` 一致的 `vX.Y.Z` tag 后，`release.yml` 自动跑测试、构建、校验版本一致，并创建 Release（notes 取 `CHANGELOG.md` 对应条目，附 `dist/popup-viewer-v2.user.js` 与 `dist/popup-viewer-kit.js`）。
- 首个自动发布的 tag 是 `v2.3.8`（2026-11-14）；tag 一律打在合并后的 `main` 提交上。

---

## 15. 常见开发问题与排障

### 15.1 构建与依赖

**Q：`npm run build` 报 `Cannot find package 'esbuild'`？**
A：依赖未安装。执行 `npm ci`（或 `npm install`）后重试；确认 `node_modules/esbuild` 存在。

**Q：Node 版本太低导致语法/工具报错？**
A：升级到 Node ≥18；项目在 v22.17.0 验证，CI 使用 Node 20/22。`node --version` 确认。

**Q：`npm run dev` 一直不退出？**
A：这是监听模式，正常持续运行；改完代码后按 Ctrl+C 结束。需要一次性构建用 `npm run build`。

**Q：`dist` 与 `src` 不一致 / CI 的 `git diff --exit-code -- dist` 失败？**
A：运行 `npm run build` 重新生成并提交 `dist/`；不要手工编辑 `dist/`。如果提交了 `build:min` 的压缩版，注意 CI 会用非压缩的 `npm run build` 重新生成导致差异，参见 [4.5](#45-dist-同步规则)。

### 15.2 运行与调试

**Q：脚本安装后没有任何反应？**
A：依次检查：Tampermonkey 中脚本已启用；页面 URL 是否在 `@include *://*/*` 范围内；`?pv2_debug` 是否显示 boot 标记；控制台是否有 `[PopupViewer]` 错误；`window.__PV2_INIT__` 是否为 `true`。若脚本在 iframe 内，确认设置「在 iframe 中运行」是否为预期状态。

**Q：点击链接仍然正常跳转，没有弹窗？**
A：检查：该站点是否有匹配的适配器/规则；`linkIntercept` 是否被关闭；点击的是否为同页锚点或危险协议；是否点在了脚本自己的 UI 上（会被忽略）。开启 `?pv2_debug` 看橙色 `click: no-match` 标记，并在控制台查看 `resolveCandidate` 相关错误。

**Q：设置面板显示「仅本站」是什么意思？**
A：该项按站点保存，只影响当前网站。修改后写入 `pv2:siteSettings[hostname]`；全局项（主题、在 iframe 中运行、惯用手、四角缩放把手）跨站共享。参见 [6.5](#65-设置模型全局-vs-按站点)。

**Q：页面里有多个悬浮齿轮按钮？**
A：通常是开启了「在 iframe 中运行」，脚本在页面内多个 iframe 中初始化。关闭该设置；脚本自己的弹窗 iframe 已做跳过保护，不会套娃。

### 15.3 加载与渲染

**Q：弹窗一直转圈，最后显示「加载超时或被阻止」？**
A：目标站可能通过 `X-Frame-Options` / CSP `frame-ancestors` 拒绝 iframe 嵌入。处理方式：检查该站点是否在 `sitePolicy` 中配置了 `iframe: true`，若是则改为 `iframe: false`，走抓取净化路径；或让用户「在新标签页打开」。`IframeLoader` 对同源已显示但 load 事件被拖住的情况有兜底，但跨域被拒仍会报错。

**Q：显示「请求超时」或「网络请求失败」？**
A：检查网络、目标站是否可达、`GM_xmlhttpRequest` 是否可用（Tampermonkey 正常；无 GM 环境回退 `fetch` 可能被 CORS 拦截）、`@connect *` 是否被其他脚本管理器限制。超时时间由 `config.loader.timeout`（15 秒）控制。

**Q：抓取到的页面图片不显示？**
A：懒加载图片的真实地址可能在 `data-*` 属性中。`Sanitizer.REAL_SRC_ATTRS` 已覆盖常见项（`zoomfile`、`file`、`data-src`、`data-original` 等），`data-srcset` / `data-original-set` 另有专门处理；新站点如有特殊属性，在 `REAL_SRC_ATTRS` 追加。`IframeRenderer.fixImages()` 会在渲染后 1.5s / 3.5s 再做兜底恢复。

**Q：弹窗完全没有样式（尤其 X）？**
A：严格 CSP 站点可能拦截内联 `<style>`。项目已用 `adoptedStyleSheets` 并行兜底；检查控制台是否有 `Shadow DOM 不可用，回退到页面内挂载` 或 `adoptedStyleSheets failed`。可用 `__PV2_X__.styleDiag()` 查看 `xRulesFound` / `adoptedSheets`。`config.ui.shadow = false` 仅用于排查，不建议长期关闭。

**Q：X 阅读器提示「X 网络层未安装」或内容为空？**
A：确认当前页面是 `x.com` / `twitter.com` 且已登录；安装/更新脚本后刷新一次页面让 `installXSupport()` 重新注入页面上下文网络桥。X 接口变更可能导致读取失败，可用 `__PV2_X__.probe(tweetId)` / `__PV2_X__.postDiag()` 排查；必要时更新 `src/x/xBridge.js` 与 `xModel.js`。

**Q：X 长贴显示不全，没有「显示更多」？**
A：用 `__PV2_X__.postDiag()` 查看 `textLength` / `hasFullText` / `needsExpand`；相关逻辑在 `XThreadLoader.expandPost()` 与 `xModel.fullTextFromPayload()`，注意 `display_text_range` 不得截断 `note_tweet` 全文。

### 15.4 设置与规则

**Q：新增的设置项不生效？**
A：确认键名拼写与 `settingsManager.get()` 读取一致；全局键必须加入 `GLOBAL_KEYS`，否则会被当作站点键。修改后重新构建并刷新页面。若 UI 控件没有调用 `persist()`，`settings-changed` 不会触发。

**Q：规则选择器无效或误伤？**
A：`RulesManager` 会 try/catch 非法选择器；点选时优先选择只命中链接本身的候选（`a.xxx`），避免容器选择器误伤同块内的其他链接。规则命中容器但点击落在容器内另一个链接时不会劫持（`RulesManager.match` 的 R1 逻辑）。

**Q：删除规则后想撤销？**
A：规则面板的删除有 4 秒撤销窗口（`UNDO_MS = 4000`），点击 toast 的「撤销」即可；超时后不可恢复。

### 15.5 Git 与发布

**Q：`npm run g -- push` 报 `Permission denied (publickey)`？**
A：确认项目根存在与 `tools/git-tools.md` 约定一致的 SSH 私钥文件、公钥已加到 GitHub；或按该文档改用 HTTPS remote。详见 [tools/git-tools.md](../tools/git-tools.md)。

**Q：为什么 `npm run g -- commit` 自动构建了？**
A：`commit` / `publish` 默认先 `npm run build`，保证 `dist/` 与源码同步；纯文档改动可加 `--no-build`。但按 AGENTS.md，除非用户明确要求，不应自行提交。

**Q：改了代码但 CI 失败提示版本不一致？**
A：检查 `package.json` 与 `banner.txt` 的版本是否同步递增，`dist/popup-viewer-v2.user.js` 头部 `@version` 是否已重建。纯文档改动不需要递增版本。

**Q：发布时 `dist` 应该提交压缩版还是非压缩版？**
A：仓库当前的 CI 校验以 `npm run build`（非压缩）为准；提交 `build:min` 的压缩产物会导致 `git diff --exit-code -- dist` 失败。保持仓库 `dist` 为非压缩构建产物，压缩版作为 Release 附件或独立分发渠道。

---

## 16. 参考与延伸阅读

| 文档 / 目录 | 内容 |
|---|---|
| [项目 README](../README.md) | 项目介绍、功能特性、支持站点、安装与开发命令 |
| [用户使用手册](user-guide.md) | 面向普通用户的安装、设置、操作与故障排查 |
| [更新日志](../CHANGELOG.md) | 版本历史与每次发布的详细变更 |
| [Git 工具说明](../tools/git-tools.md) | `git-tools.mjs` 的安装、命令、SSH 密钥与常见问题 |
| [第三方组件声明](../THIRD_PARTY_NOTICES.md) | 第三方代码来源、许可与版权声明 |
| [贡献指南](../CONTRIBUTING.md) | Issue/PR 流程、分支与提交规范、测试要求 |
| [安全策略](../SECURITY.md) | 支持版本、漏洞报告方式与响应预期 |
| [文档索引](README.md) | 全部文档导航 |
| [代码地图](../codemap.md) | 根级架构、目录聚合与数据流；子目录另有 codemap |

---

*本手册随 v2.3.7 编写。若你发现命令、路径或行为与当前源码不一致，请以源码为准并更新本文档；文档贡献同样遵循 [CONTRIBUTING.md](../CONTRIBUTING.md) 与 [AGENTS.md](../AGENTS.md)。*
