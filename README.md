# Popup Viewer V2（页内弹窗打开新帖）

点击论坛/帖子链接，在页面内弹出阅读窗口加载内容，不跳转页面。插件化架构，内置多站点适配器，并支持「规则化统统拦截器」——任意网站都能自己配置要拦截的链接。

## 功能特性

- **弹窗阅读**：拦截页面链接点击，在弹窗中加载内容，支持遮罩/独立悬浮两种驻留方式
- **多站点适配**：内置 Discuz 系、淘股吧、linux.do、磁力站等适配器，开箱即用
- **规则化统统拦截器**：在任意网站「取选」链接即可生成拦截规则，无需写代码/CSS
- **多种加载方式**：自动选择直接 iframe（保留登录态/脚本）或抓取净化渲染（安全沙箱）
- **弹窗图片显示**：自动识别各站懒加载图片（`data-original`/`data-src`/`srcset`/Discuz `zoomfile`/`file` 等），1x1 占位图（如 Discuz `none.gif`）也能正确换入真实地址
- **手机模式**：预置 iPhone / Max / 安卓 / 小屏尺寸，并携带对应移动端 UA 抓取
- **窗体大小预设**：小 / 中 / 大 / 手机，可记忆拖动位置
- **窗体自由缩放**：拖拽窗体四边/四角任意调整大小（最小 260×200），自定义尺寸按站点记忆；重新点击大小预设即恢复预设尺寸
- **视口自适应**：窗体尺寸与位置始终约束在可视区域内（`max-width/height` 用 `min()` 联动视口），打开 DevTools 或缩放窗口时自动收缩并拉回可视区
- **页面链接拦截开关**：一键切换页面链接是否在弹窗内打开
- **高级：在 iframe 中运行**（默认关闭）：默认只在顶层页面运行（等同 `@noframes`），可按需开启（见下方风险说明）
- **设置按站点持久化**：各站独立记录；主题全局共享；刷新不丢失
- **快捷键**：`Esc` 关闭 · `F` 全屏 · `R` 刷新
- **明暗主题**：跟随系统或手动指定

## 支持的网站

内置适配器（`src/adapters/`）：

| 适配器 | 站点 |
|---|---|
| Discuz | chiphell.com · wnflb2023.com · 52pojie.cn |
| 淘股吧 | www.tgb.cn（含 /bbs/ 板块列表、博客、实盘比赛）· shuo.tgb.cn 资讯 |
| LinuxDo | linux.do |
| 磁力 | 1cili.com · s.9cili.mom |

除此之外，通过「链接规则」功能可在**任意网站**自行添加拦截规则。

## 快速开始

### 安装

1. 安装 [Tampermonkey](https://www.tampermonkey.net/)
2. 打开 Tampermonkey → 管理面板 → 实用工具 → 导入，选择 `dist/popup-viewer-v2.user.js`；或新建脚本后粘贴该文件内容
3. 打开支持的站点即可使用

### 配置拦截规则（任意网站）

1. 点击右下角 ⚙ 设置按钮 → 链接规则 → 管理
2. 点击「取选新链接」，在页面上点一下要拦截的帖子链接
3. 选择候选选择器（或手动改写）→ 确认

之后该站点这类链接都会在弹窗中打开。

## 项目结构

```
├── src/                  # 源码
│   ├── main.js           # 入口
│   ├── config.js         # 全局配置
│   ├── core/             # 核心：事件/弹窗/站点/加载/存储/设置/规则管理
│   ├── ui/               # 界面：弹窗面板/工具栏/设置面板/规则面板/取选器
│   ├── loaders/          # 加载器：iframe/请求/解析/缓存/渲染
│   ├── adapters/         # 站点适配器
│   ├── security/         # 安全：净化/URL 校验/沙箱
│   ├── kit/              # 弹窗库：PopupKit 入口 + 精简增强面板
│   └── utils/            # 工具
├── dist/                 # 构建产物（用户脚本 + 弹窗库）
├── build.mjs             # esbuild 构建脚本
├── banner.txt            # 用户脚本头部（@match/@grant）
└── package.json
```

## 开发

```bash
npm install        # 安装依赖
npm run build      # 构建 → dist/popup-viewer-v2.user.js + dist/popup-viewer-kit.js
npm run build:min  # 构建压缩版（体积更小，产物不可读，适合发布）
npm run build -- --only=main   # 只构建主脚本
npm run build -- --only=kit    # 只构建弹窗库
npm run dev        # 监听模式构建
```

技术栈：原生 JavaScript（无运行时依赖）· esbuild 打包 · Tampermonkey GM API（`GM_xmlhttpRequest` / `GM_addStyle` / `GM_getValue` / `GM_setValue`，无 GM 时回退 `fetch`/`localStorage`）。

### 弹窗库（PopupKit）

`dist/popup-viewer-kit.js` 是把弹窗能力（多加载器 + 安全净化 + 增强面板）封装成的独立库脚本，暴露全局 `window.PopupKit`，供其他油猴脚本通过 `@require` 引用：

```js
window.PopupKit.open({ url, title, width, height, linkIntercept })
window.PopupKit.close()
window.PopupKit.refresh()            // 刷新当前内容（保持位置/尺寸）
window.PopupKit.isOpen()
window.PopupKit.prefetch(url)        // 后台预热
window.PopupKit.hasCached(url)
window.PopupKit.config

// 生命周期回调（宿主脚本设置）
window.PopupKit._onOpen  = ({ url, title }) => {}
window.PopupKit._onClose = ({ url }) => {}
```

库不自动初始化、不创建工具栏/规则面板，仅提供弹窗 API。

**隔离设计**：所有 DOM id/class 使用 `pvk-` 前缀，样式自包含（`src/kit/kit.css`），不依赖主脚本的 SettingsManager / Loading / ErrorView，可与 popup-viewer-v2 主脚本或 page-picker-kit 同页共存而不冲突。加载行为通过 `open` 参数注入（`linkIntercept`、`loadingSelector` 等），无需共享设置。

内置增强面板（`src/kit/KitPopupPanel.js`）：

- **拖拽**：按住头部拖动，释放时自动约束回视口内
- **全屏**：按钮或快捷键 `F` 切换
- **刷新**：按钮或快捷键 `R`，刷新保持窗体位置与尺寸
- **新标签页打开**：保留当前 URL 在新页打开
- **快捷键**：`Esc` 关闭 · `F` 全屏 · `R` 刷新
- **尺寸可配**：`open({ width, height })` 自定义窗体大小（默认 50% × 75%）
- **视口自适应**：打开 DevTools 或缩放窗口时，窗体自动收缩（`min()` 联动 `100vw/100dvh`）并 clamp 回可视区域，不会被压缩出屏幕
- **安全渲染**：非直载站点走抓取净化，剥离 `<script>`/事件属性，绝对化链接与懒加载图片

## Git 管理工具

内置 `tools/git-tools.mjs`，一键完成构建、提交、推送（自动使用项目内 SSH 密钥 `id_ed25519_coresz`）：

```bash
npm run g -- status                            # 工作区状态 + 最近提交
npm run g -- commit "提交信息"                   # 构建 + 暂存 + 提交
npm run g -- push                              # 推送
npm run g -- publish "提交信息"                  # 构建 + 提交 + 推送（一步到位）
npm run g -- setup git@github.com:user/repo.git # 配置远程并切 main
```

说明：`commit`/`publish` 会先执行 `npm run build`，保证 `dist/` 与 `src/` 一致；加 `--no-build` 可跳过。提交信息未传时会在终端交互提示输入。

## 配置说明（`src/config.js`）

- `popup`：窗体尺寸预设、默认大小、圆角、z-index
- `phone`：手机模式预置尺寸与对应移动端 UA
- `loader`：加载超时与默认方式
- `cache`：内容缓存开关、TTL、上限
- `prefetch`：悬停预热开关与防抖
- `sitePolicy`：站点加载策略（`iframe`/`scripts` 白名单，如 linux.do 直接 iframe）
- `storage`：历史/收藏存储键

> **风险提示**：设置中「在 iframe 中运行」默认关闭，脚本只在顶层页面运行（等价于 `@noframes`）。开启后脚本会在页面内**所有 iframe**（广告、嵌入内容等）中运行，可能增加页面开销、出现多个悬浮按钮，或与嵌入页面产生样式冲突，仅在确有需要时开启。

## License

MIT
