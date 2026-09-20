# Changelog

## [2.1.0] - 2026-09-20 · spike/x-support 分支（未合并）

### Added

- **X（x.com / twitter.com）支持验证版**：新增 `src/adapters/XAdapter.js`，在 x.com 时间线/通知等帖子列表里点击帖子时用弹窗打开，不再跳走
  - 解析 `article[data-testid="tweet"]` 内的帖子链接，统一规范化为 `https://x.com/{handle}/status/{id}`
  - **引用帖优先**：点引用卡片打开被引用的那条，不误开外层主帖（识别 `[role="link"][tabindex="0"]` 引用卡片 + 按作者 handle 归属选链接）
  - **详情页避让**：已在 `/status/...` 详情页时保留 X 原生交互，只拦引用帖卡片
  - 交互目标白名单：点赞/转发/收藏按钮、输入框、视频、图片灯箱、非帖子链接一律不拦
  - 标题取 `User-Name` + `tweetText`
  - 不做 DOM 视觉增强（X 是虚拟化 React 树，避免与其渲染冲突）
- **X GraphQL 网络层**（`src/x/xBridge.js`，移植自 peek 的 `page-bridge.js`）：页面上下文补丁 `fetch`/`XMLHttpRequest` 捕获 X 自身请求的鉴权头与 `TweetDetail` 模板；从页面 webpack runtime 动态发现 GraphQL operation（`queryId`/`featureSwitches`/`fieldToggles`，不硬编码）；`/i/api/graphql/{queryId}/{operationName}` 读 GET、写 POST；`ct0` 取 CSRF；`x-client-transaction-id` best-effort。鉴权头只留内存、不打日志，`captureState()` 只回掩码状态
- **X 数据层**（`src/x/xModel.js`，移植自 peek 的 `core.js`）：`unwrapResult` 解包、tweet 节点收集、`bottomCursor` 游标、`parseThreadSummary` 原帖/评论归属判定（fail-closed，防 X 注入的推荐模块被当成评论）。C2 补齐媒体变体/引用帖/长文
- **X 帖子加载器**（`src/loaders/XThreadLoader.js`）：`LoaderManager` 新增 `xthread` 模式，把原帖 + 评论渲染进现有弹窗内容区，支持「加载更多评论」游标分页；复用现有弹窗外壳/主题/拖拽/历史
- **控制台自检入口**：x.com 页面上 `window.__PV2_X__.probe('<帖子ID>')` / `.probeRaw()` / `.captureState()` / `.hasOperation()`
- **X 原生观感（皮肤）**：`src/x/xTheme.js` 从 x.com 页面**只读采样**真实生效的样式（正文色 / 次要色 / 边框色 / 强调蓝 / 字体族，并用 body 背景判定亮-微暗-熄灯），注入为 `--pv-x-*` 变量并跟随 X 主题切换；采样失败回退 X 官方三套主题固定值。**不套用 X 的哈希类名**（构建期生成，随发版变化），也不克隆 X 的 React DOM
- **X 图标克隆**：`src/x/xIcons.js` 只读 `cloneNode` X 实时 DOM 里的回复/转推/喜欢/收藏/分享/查看/认证 SVG，与 X 像素级一致；取不到时该图标自动省略
- **双栏阅读器**：`src/x/xRender.js` 左栏原帖（头像、认证勾、@handle、时间、操作行图标+计数），右栏评论（头像列 + X 竖线、按 depth 缩进、独立滚动）；弹窗内容区宽度 < 640px 时自动切成上下堆叠，缩放时由 ResizeObserver 跟随
- **纯逻辑回归测试**：新增 `tests/xModel.test.mjs` 与 `npm test`，覆盖链接解析、解包、游标、原帖字段、评论归属（推荐内容排除）、depth 拍平、fail-closed
- **X 媒体渲染**：图片 1-4 宫格（X 的 16px 圆角 + 1px 描边、单图 contain、alt 文本）；视频用海报 + **按码率选档的 MP4**（不超过 1.2Mbps 的最高档，避免直接拉最高码率），原生支持 HLS 的浏览器（Safari）直接播 m3u8，仅 HLS 无 MP4 时给「在 X 播放」出口；GIF 归为 `animated_gif` 同样走视频分支
- **X 互动（行为参照 peek）**：
  - **点赞 / 转推 / 收藏**：GraphQL `FavoriteTweet`/`UnfavoriteTweet`、`CreateRetweet`/`DeleteRetweet`、`CreateBookmark`/`DeleteBookmark`。**先改本地状态再发请求，X 拒绝则回滚并提示**，写操作绝不重发（peek 策略）。注意转推的变量名不对称：`DeleteRetweet` 用 `source_tweet_id`、`CreateRetweet` 用 `tweet_id`——peek 实测如此，照抄不「修正」
  - 按钮激活色用 X 官方色：喜欢 `#f91880`、转推 `#00ba7c`、收藏 X 蓝；悬停变色
  - **复制链接**：`navigator.clipboard` 写入帖子地址，失败时把链接显示在提示里
  - **纯文字回复**：右栏顶部回复框（高度自适应、`Ctrl/Cmd+Enter` 发布、无内容禁用提交），走 `CreateTweet` + `reply.in_reply_to_tweet_id`；发布成功后新回复固定显示在评论最前
  - **评论排序**：相关（原始顺序）/ 最新 / 最多喜欢，纯客户端重排、不重新请求（与 peek 一致）
  - **滚动自动加载评论**：滚到底由 IntersectionObserver 自动拉下一页，替换原手动按钮；终止规则沿用 peek 的「无新增 / 游标为空 / 游标重复」
  - **回复上下文**：从通知等入口点开一条回复时，左栏带出它之前的对话链
- 主题令牌新增 `--pv-x-like` / `--pv-x-repost`
- **X 自动翻译（行为参照 peek）**：用当前登录会话调 X 自己的翻译服务（REST `strato/.../translateTweet`，优先复用捕获到的真实请求模板、替换 `tweetId`，否则用固定兜底路径），目标语言 `zh-cn`
  - 原帖与回复上下文**优先翻译**；评论在滚动到附近时才翻译，**并发上限 2**，按 `帖子ID:语言` 缓存，避免打爆接口
  - 译文为空或与原文相同时标记为「不需要翻译」，不显示噪音
  - 正文上方显示状态行：`正在翻译…` / `翻译自英语 · 显示原文` / `显示翻译` / `重试翻译`
  - 语言判定沿用 peek 的字符集规则（中日韩、西里尔、拉丁与汉字比例），中文帖与纯链接/纯提及不请求翻译
- **图片改为弹窗内放大**：点图片不再跳新页面，改为覆盖阅读器区域的灯箱（点背景/✕/Esc 关闭，多图可左右切换或方向键切换，保留「在 X 打开」出口）；Esc 优先关灯箱、不关弹窗
- 去掉昵称/头像/媒体链接的下划线（与 X 一致）
- **阅读器双栏各自独立滚动**：左栏（原帖）与右栏（评论列表）互不绑定，**两栏滚动条均隐藏**；右栏结构改为「工具行 + 回复框固定 + 评论列表滚动」，回复框不再随列表滚走。自动加载与翻译的可见性判定以评论列表为滚动根
- **X 长文（Article）支持**：此前只读 `note_tweet`，长文帖在弹窗里只有一条 t.co 链接、基本是空的。现解析 `article` 字段（兼容四种包装形态）：
  - 封面图 + 标题 + 摘要 + **正文排版**：段落 / 各级标题 / 引用 / 有序无序列表 / 内嵌图片（走 `content_state` 块与 `entityMap`），无 `content_state` 时退化为 `plain_text` 按空行分段
  - 正文缺失时用 `TweetResultByRestId`（`readArticle`）补全一次，并用 `articleContentFromPayload` 从响应里深挖 `content_state`/`plain_text`；失败静默、不影响其它内容
  - 长文帖正文里那条 t.co 链接会被去掉（正文另有排版）
  - 评论/上下文里的长文渲染为紧凑卡片（封面 + 标题 + 摘要 + 在 X 阅读）
- **资料卡悬停延时改为 1 秒**（原 350ms），避免鼠标扫过时误弹出；移开仍是 650ms 收起
- **加载状态居中**：新增 `.pv-x-loading-layer` 绝对定位居中层。此前 loading 视图作为 flex 子项被挤到左侧（阅读器模式下内容区是 flex/滚动容器）
- **定向回复 + 视觉反馈**：点某条评论的「回复」时记录回复目标，回复框显示「回复 @xxx」并可取消、**目标帖高亮**（左侧蓝条 + 淡底），发送时用目标的 `in_reply_to_tweet_id`。此前无论点哪条评论的「回复」，实际都回到主帖且没有任何提示
- **资料卡定位修正**：卡片改为相对 `.pv-x-reader` 绝对定位。面板用 `transform: translate(-50%,-50%)` 居中，会成为 `position: fixed` 后代的包含块，按视口坐标算会导致卡片跑到别处
- **作者资料卡（悬停，与 X 一致；行为参照 peek）**：鼠标移到头像/昵称/@handle 上**停顿 1 秒**弹出，移开 650ms 消失，鼠标移到卡片上不闪；卡片含大头像、关注按钮、昵称+认证勾、`@handle`、「关注了你」、简介、正在关注/关注者计数、「个人资料概要」入口
  - **关注/取关**：REST `/i/api/1.1/friendships/{create,destroy}.json`（form-urlencoded + CSRF）。写入成功后若响应缺少关系字段，做一次**有界读回**（`UserByRestId`，4s 超时）核对；**核对失败绝不把已提交的写入报成失败**，而是标记未确认、按钮变「查看状态」并跳 X 个人资料页
  - 关注状态会写回所有同一作者的模型（原帖、上下文、评论、引用帖），计数同步更新
  - 作者节点新增字段：`id` / `description` / `followers` / `followingCount` / `viewerFollowing` / `followRequestSent` / `followsViewer`（兼容 `legacy` 与新的 `relationship_counts`/`profile_bio` 结构）

### Fixed

- **X 用户名丢失**：解用户节点时误用了 `unwrapResult`（要求 `legacy` + `rest_id` 同时存在），而 X 的用户节点已迁移到 `core`/`avatar` 结构、很多不带 `legacy`，解包得到 null 导致作者整行为空。改为移植 peek 的 `unwrapUser`（判 `core.screen_name` / `avatar.image_url` / `__typename === 'User'`），并补回归测试
- **X 弹窗内出现黑色边框线**：边框色原先从 `[data-testid="cellInnerDiv"]` 采 `borderBottomColor`，但 X 的分隔线多由背景色/伪元素实现，**元素本身没有边框**，此时 Chrome 返回的是初始值 `rgb(0, 0, 0)`（它既不等于正文色也不等于次要色，所以按颜色校验也拦不住）→ 画出来是黑线。现改为**不采样、直接用主题固定值**（亮 `#eff3f4` / 微暗 `#38444d` / 熄灯 `#2f3336`），与 peek 的做法一致
- **X 弹窗内 @handle / 时间 / 操作图标整片变蓝**：次要文字色原先从 `[data-testid="User-Name"]` 里的 `@handle` 链接采样，但页面上第一个 `User-Name` 未必是普通时间线帖子（可能是推荐模块/资料卡），取到的是 X 的链接蓝，于是所有用 `--pv-x-muted` 的地方（@handle、时间、操作图标与计数、排序按钮、工具行）一起变蓝。现次要色也改为**查表**，采样只保留来源可靠的四项（body 背景、帖子正文色、话题链接色、body 字体）
- **视频黑块**：无可播源时不再渲染 `<video>`（黑底方块），改用海报图 + 「在 X 播放」出口
- **弹窗在 X 上不居中（根因治理）**：UI 原先一律挂到 `document.body`。若宿主页面给 `body`（或 `html`）加了 `transform` / `filter` / `perspective` / `will-change:transform` / `contain`，该祖先就成为 `position: fixed` 后代的**包含块**，CSS 里 `top/left:50%` 会按它而非视口计算 → 弹窗跑偏。新增 `pickMountPoint()`：挂载点自动避开这类祖先（body 受影响就退到 html），弹窗/遮罩/悬浮按钮/设置面板/规则面板统一走它
- **居中兜底校正**：新增 `PopupPanel._fixCentering()`，实测「窗体中心」与「视口中心」偏差并换算成显式像素（用中心点计算，不受打开动画 scale 影响；按祖先缩放折算），仅在居中模式（用户没拖过、非全屏）生效，偏差 <1px 时不动；其它站点为无操作

### Changed

- **X 站点策略改为 GraphQL 原生渲染**：`sitePolicy` 中 `x.com` / `twitter.com` 标记 `xThread: true`。iframe 路线已实测作废——X 的框架策略**全站拒绝嵌入（含同源）**，裸 `<iframe src>` 同样白屏（对照：peek 历史版本 `67e6e20` 曾用裸 iframe 同源嵌入成功，说明是 X 后来收紧了策略）；抓取净化路线也拿不到内容（X 由客户端 React 渲染，评论为空）
- `IframeLoader` 补 `allow="clipboard-read; clipboard-write; fullscreen; picture-in-picture"` 与 `referrerpolicy`
- `banner.txt` 新增 `@grant unsafeWindow`（页面上下文改 `fetch`/XHR 的唯一可靠途径）
- **X 皮肤样式写在 `style.css` 的无层级区**（不用 `@layer`）：X 的全局 CSS 是无层级的，而 CSS 层级优先级低于无层级规则，故必须用无层级 + `#popup-content-area` / `#popup-content-panel` 高特异性来压过宿主样式

### 说明

- 本分支为 spike 验证版，未合并。方案文档见 `docs/plan-x-graphql.md`，真机验证清单见 `docs/spike-x-support.md`
- 代码来源与 MIT 归属见 `THIRD_PARTY_NOTICES.md`（peek，Copyright (c) 2026 xuntianx）
- 当前限制：**尚未实现** HLS 自适应播放（hls.js，会加约 200KB）；引用帖卡片待做；回复仅纯文字（图片/GIF/投票等富回复仍走 X 原生）；翻译默认开启、目标语言固定 `zh-cn`（未做设置项）；评论里的长文只显示紧凑卡片，正文不展开


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
