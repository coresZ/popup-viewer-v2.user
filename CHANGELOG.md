# Changelog

## [2.0.41] - 2026-08-16

### Fixed

- **弹窗内右键搜索被拦截**：直连 iframe 的 sandbox 缺少 `allow-popups-to-escape-sandbox`，弹窗内右键「在 Google 搜索」等新标签页操作被拒——`buildSandboxAttrs` 已补充该标记

## [2.0.40] - 2026-08-16

> 2.0.8～2.0.40 为同一批未发布改动，合并记录于此。

### Fixed

- **iOS Userscripts 不运行（根因）**：环境未声明 GM_* 全局变量，`has(GM_addStyle)` 直接引用标识符抛 `ReferenceError: Can't find variable` 且被管理器吞掉，整脚本静默死亡。`gm.js` 全部改为 `globalThis` 属性 + `typeof` 安全探测，GM 失败回退 `fetch`/`localStorage`/`<style>`
- **元数据兼容**：移除 `@match` 仅保留 `@include *://*/*`，加 `@run-at document-idle`；构建转译 ES2019（`?.`/类静态字段降级）
- **初始化双保险**：DOMContentLoaded + 1.5s 超时强制初始化
- **设置弹窗系列问题**：锚点遮挡、PC 全屏误触发（全屏式面板仅限小屏/触屏）、高度被内联 maxHeight 压扁、切「手机」档后内容显隐导致尺寸错乱、滚动条显式隐藏、窗口缩放不跟随重定位——定位逻辑重写为四档（下方/上方/移动全屏/PC 贴顶），桌面限高 560px 内部滚动，设置变化与窗口缩放自动重新定位，新增 ✕ 关闭按钮与 Esc 优先关闭
- **触屏页脚按钮溢出**：44px 触控放大规则误伤 38px 高的页脚按钮，已单独限定
- **悬浮设置按钮**：抬高到 `env(safe-area-inset-bottom)` 之上，不被 iPhone 底部横条遮挡
- **原生前进后退自愈**：iframe 原生 history 已到头/被拒导致索引错位时，2 秒无 URL 变化自动回滚索引
- **弹窗套弹窗（iframes 无限嵌套）**：开启「在 iframe 中运行」时脚本会注入自己的弹窗 iframe，导致弹窗递归嵌套。现弹窗 iframe 内通过 `window.frameElement` + 内容标记双重识别自身并跳过初始化
- **手机小屏缩放无效**：近全屏尺寸由 CSS 硬编码覆盖了 `--popup-width/height` 变量，拖把手改变量不生效——改为 JS 写入变量，缩放实时生效
- **四角把手遮挡按钮**：把手原位置压在工具栏/页脚按钮上，已偏移避开标题栏与底部栏

### Added

- **移动端触屏支持**：拖拽/缩放基于 Pointer Events（老浏览器回退 mouse）；触屏加大触控目标；小屏触屏弹窗铺近全屏；双击全屏在触屏禁用
- **触屏四角缩放把手**：触屏下窗体四角常驻可见缩放把手（图标方向随角位），拖动自由调整大小；设置 → 移动端 →「四角缩放把手」开关（默认开）
- **设置面板分区**：「通用 / 移动端」两个标签页（胶囊样式与现有分段控件一致、滚动吸顶）；移动端页仅放移动端专属设置（四角把手、惯用手）
- **调试模式开关**：设置 → 高级 →「调试标记」（默认关）；或 URL 带 `pv2_debug`。开启后显示 boot 版本、模块加载序号、初始化状态、错误与看门狗；关闭零痕迹
- **底部导航栏**：URL 文本改为链接图标（点击新标签页打开）、移除冗余的新窗口按钮；新增 **← → 前进后退**——优先调用弹窗内 iframe 的**原生浏览器历史**（只作用于弹窗内），SPA 客户端跳转经 800ms URL 轮询追踪，无 iframe/跨域时回退自维护栈重载；快捷键 `Alt+←/→`
- **锁定窗体**：设置 → 窗体行为 →「锁定窗体」（按站点记忆），锁定后不可拖动/缩放，手柄隐藏
- **惯用手**：设置 → 移动端 →「左手」模式镜像工具栏，✕ 关闭按钮移到左上角
- **移除下滑关闭手势**（曾加入后按需移除，现无该功能）

## [2.0.7] - 2026-08-09

### Added

- **弹窗自由缩放**：窗体新增 8 向边缘/角落拖拽手柄，可任意调整大小（最小 260×200），从左边/上边缩放时对边锚定不漂移，释放后自动约束回视口；自定义尺寸按站点持久化，重新打开/刷新不丢失。设置面板中重新点击「小/中/大/手机」预设可退出自定义尺寸
- **拖拽手感优化**：拖拽 mousemove 用 rAF 合并避免高频重排；拖拽中全页 grabbing 光标 + 窗体高亮描边阴影反馈

### Fixed

- **缩放后切换大小预设不生效**：缩放此前写内联 `width/height` 覆盖 CSS 变量，导致点「小/中/大」窗体不变；现缩放全程改写 `--popup-width/height` 变量，与预设共用同一数据源，切换即时生效

## [2.0.6] - 2026-08-09

### Security

- **非信任站点渲染不再授予脚本权限**：抓取净化注入的 iframe 此前始终带 `allow-same-origin + allow-scripts`，一旦净化遗漏即可同源访问父页面。现按 `keepScripts` 动态生成 sandbox——非信任站点仅 `allow-same-origin`（无 `allow-scripts`），脚本无法执行
- **Sanitizer 补齐协议校验**：新增 `xlink:href`、`background` 的危险协议拦截（javascript:/data:/vbscript:/file:）

### Fixed

- **adapter 域名匹配过宽**：Discuz/Cili 从 `hostname.includes` 改为后缀精确匹配，避免误匹配 `evil-chiphell.com` 之类
- **Esc 键盘冲突**：规则面板、取选模式打开时按 Esc 只关闭当前层，不再连带关闭弹窗

### Changed

- **构建**：新增 `--minify` 开关（默认不压缩），`npm run build:min` 产出压缩版；去掉 kit 多余的 `globalName`
- **性能**：全页面 `mouseover` 增加廉价前置判断，非链接元素不再进入完整解析；`logger.log` 改为 `pv2_debug` 门控
- **去重/清理**：主面板与 Kit 面板的拖拽/视口约束/滚动链抽为共享工具 `utils/panelBehavior.js`；懒加载图片属性列表单一来源；`LoaderManager` 私有方法公开化；移除死代码（`registerEnhancer`、`getEnhanceSelectors`、`config.popup` 未用字段、`logger.info`）

## [2.0.5] - 2026-08-09

### Fixed

- **Discuz 系论坛图片不显示**：52pojie / wnflb2023 / chiphell 等论坛附件图 `src` 为 1x1 占位图 `none.gif`，真实地址在 `zoomfile`/`file` 属性中。此前 `REAL_SRC_ATTRS`/`IMG_REAL_ATTRS` 未识别这两个属性，且 `fixImages` 仅按 `naturalWidth === 0` 判断，占位图 naturalWidth=1 被误判为"正常"，导致图片有宽高却不显示。现已在净化阶段与渲染兜底阶段识别并换入真实地址，同时 `fixImages` 增加占位图文件名判定（`none.gif`/`placeholder`/`loading` 等）。

### Docs

- `AGENTS.md` 增加约束：每次修改提交必须递增版本号（`package.json` + `banner.txt`，随后构建 `dist/` 同步）
- 版本号 2.0.1 → 2.0.5

## [2.0.1]

### Fixed

- 修复任意站点弹窗内图片不显示：懒加载属性识别扩展 + `data-srcset` 支持 + `data:` URI 保留 + 渲染后图片恢复兜底

## [2.0.0] 版本前主要里程碑

- 2.0.x 系列：弹窗库 PopupKit、滚动链修复、Tailwind UI/UX 设计规格
- 1.x → 2.0 重构：模块化架构（core/ui/loaders/adapters/security/utils）+ esbuild 构建流程
