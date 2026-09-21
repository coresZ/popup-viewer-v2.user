# Changelog

## [2.1.1] - 2026-09-21 · spike/x-support 分支（未合并）

### Fixed

- **引用帖（quote）完全没处理（修复）**：数据层此前只解原帖与评论，被引用的帖子躺在 `quoted_status_result` 里没人读，弹窗里就只剩一段孤零零的正文。现在：
  - 数据层新增 `quotedModel()`：从 `quoted_status_result.result`（兼容 `quoted_tweet_results` 与 `TweetWithVisibilityResults` 包装）解出被引用帖，产出与普通帖同构的模型（作者/正文/实体/媒体/计数），挂在 `model.quote`；**只解一层**（引用帖自己再引用时 X 界面同样只显示一层），且被引用帖**不会混进评论与节点统计**
  - 渲染层新增**紧凑引用卡** `quoteCard()`：作者行（头像/昵称/认证/@handle）+ 正文**截两行**（`-webkit-line-clamp: 2`）+ 右侧 56×56 缩略图；整卡高度约 110px（完整版约 340px），不再把正文区撑得很高
  - **整卡点击在新窗口打开**被引用帖；卡内的 @提及/链接保持各自可点（不触发整卡跳转）
  - 位置：**放在帖子内容的最后**（正文 → 图片 → 引用卡），不夹在正文与图片之间
  - 新增 3 条回归断言（解包、可见性包装、无引用为 null，并验证只解一层且不计入节点数）

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
- **多图改为固定比例马赛克（X 原生思路）**：此前 1-4 图共用一套两列网格且无宽高比，导致三个问题——图片加载前容器高度为 0（加载后整块跳动）、整体高度随原图比例变化（竖图把弹窗撑很高）、3 图"首图跨两行"在比例差异大时明显不齐。现改为：
  - **单图**：宽高比按原图 `original_info` 由 JS 写入容器（加载前即占位、无跳动），`object-fit: contain` **不裁切**
  - **2 图**：容器 `aspect-ratio: 2/1`；**3 图**：`3/2` 且左格跨两行；**4 图**：`1/1` 方阵；多图统一 `cover` 填满格子
  - 均加 `max-height`（2 图 300px / 3 图 380px / 4 图 420px / 单图 460px）兜住窄弹窗下的高度
  - 视频与海报改为 flex 填满格子 + `contain`，不再被 `max-height` 截断
- **正文实体识别（@提及 / #话题 / $代码 / 链接）**：此前正文一律按纯文本渲染，@提及既不是链接、也无法悬停看资料卡。现按 X 的实体区间（`legacy.entities` / 长贴的 `note_tweet.entity_set`）渲染为可点链接：
  - **码点 → UTF-16 偏移换算**：X 的 `indices` 按码点计，含 emoji（代理对）的帖子直接切片会整体错位，现建映射表换算
  - **实体在全文坐标系计算后再裁到显示窗口**：`display_text_range` 起点可以不为 0（回复帖会把开头的 @提及 从显示文本里跳掉），此前实体索引仍按原文坐标使用 → 把无关字符渲染成提及链接（**帖子里没有 @ 却出现标记**）。现只保留完全落在窗口内的实体并平移偏移
  - **渲染层再做类型校验**：切片文字必须是该类型（`@`/`#`/`$` 开头、链接须是 `http(s)://`），否则**降级为纯文本**，绝不画出假链接
  - **可见正文按 `display_text_range` 截断**：媒体帖末尾那条 t.co 链接不再显示；无该字段时按首个媒体实体起点截断
  - **@提及可悬停看资料卡**（作者信息取自 `entities.user_mentions` 的 `id_str`/`name`/`screen_name`）
  - `$代码` 链接到 X 搜索，`#话题` 链接到话题页，普通链接用 `expanded_url`
- **长贴正文被 legacy 显示范围截断（回归修复）**：`legacy.display_text_range` 是**截断版 legacy 文本**的坐标，此前被套用到 `note_tweet` 的**全文**上，把全文按 legacy 范围（约 280 字）又截了一刀；同时因 `hasFullText` 为真而不出「显示更多」——表现为**长贴既没显示全、也没有展开入口**。现显示窗口与正文来源配对：用 note 全文时不套 legacy 范围，实体也只用 `entity_set`
- **正文截断的「显示更多」**：X 用 `legacy.truncated` + 「显示更多」表示正文被截断，此前弹窗只显示 `legacy.full_text`（截断版）且没有任何补全入口。现：
  - 数据层标记 `hasFullText` / `needsExpand`（`truncated` 为真且没有 `note_tweet` 全文时）
  - 正文下方出现「**显示更多**」，点击用 `TweetResultByRestId`（复用 `readArticle`）补一次全文并**就地替换**正文与实体，同时作废旧译文
  - 补全失败给出提示并引导走「在 X 打开」，不静默失败
  - `note_tweet` 已带全文的长贴**不出现**该按钮（我们直接显示全文，比 X 时间线的折叠更完整）
  - 新增 `fullTextFromPayload()` 从补全响应里取全文与实体（复用同一套解析）
  - 新增 `__PV2_X__.postDiag()`：列出当前阅读器各帖子的正文长度 / `hasFullText` / `needsExpand` / 实体数与结尾片段，便于排查「没显示全」类问题
- **作者资料卡（悬停，与 X 一致；行为参照 peek）**：鼠标移到头像/昵称/@handle 上**停顿 1 秒**弹出，移开 650ms 消失，鼠标移到卡片上不闪；卡片含大头像、关注按钮、昵称+认证勾、`@handle`、「关注了你」、简介、正在关注/关注者计数、「个人资料概要」入口
  - **关注/取关**：REST `/i/api/1.1/friendships/{create,destroy}.json`（form-urlencoded + CSRF）。写入成功后若响应缺少关系字段，做一次**有界读回**（`UserByRestId`，4s 超时）核对；**核对失败绝不把已提交的写入报成失败**，而是标记未确认、按钮变「查看状态」并跳 X 个人资料页
  - 关注状态会写回所有同一作者的模型（原帖、上下文、评论、引用帖），计数同步更新
  - 作者节点新增字段：`id` / `description` / `followers` / `followingCount` / `viewerFollowing` / `followRequestSent` / `followsViewer`（兼容 `legacy` 与新的 `relationship_counts`/`profile_bio` 结构）

### Fixed（代码评审修复）

> 三轮独立评审（数据/网络层、表现层、集成与共享文件）后的修复；每项都补了能拦住该 bug 的回归断言。

- **手机模式切回小/中/大时窗体跑到左上角（回归修复）**：`centerPanel()` 清掉位置后立刻调 `_fixCentering()`，但面板的 `transform` 有 0.3s 过渡——从手机模式/拖动后的 `none` 切回居中时，`-50%` **本身正在过渡中**，此刻 `getBoundingClientRect()` 量到的是**还没偏移**的位置，偏差正好是半个宽高，于是被当成误差写进 `left/top`；过渡结束后 CSS 再叠一次 `-50%`，窗体就落到左上角（右下角停在屏幕中心）。现改为**等位移过渡结束（340ms）再量**，并把该计时器纳入 `show()`/`close()` 的清理
- **窗体定位错乱（回归修复）**：为抗锯齿做的「取整位移」原先用一个布尔标记 `_snapped` 判断「这个 transform 是不是自己写的」，但该标记不会随用户拖动同步——拖动会把居中 transform 物化成 `left/top`（左上角坐标）+ `transform: none`，标记却仍是 `true`，于是**下次打开弹窗时用户拖出来的位置被当成自己的位移清掉**，CSS 的 `translate(-50%,-50%)` 又叠在左上角坐标上，窗体偏移半个宽高（切换尺寸会触发取整从而置位该标记，所以这条路径最容易撞上）。现改为**无状态的字符串判定**（只清以 `translate(calc(-50%` 开头的自写位移），用户拖动/手机模式写入的 `none` 原样保留，永不与实际情况失同步
- **P0 渲染在销毁之后发生**：`XThreadLoader` 在 `await hydrateArticle()` 之后没有复查 `aborted`——用户在长文补全在途时关闭弹窗，会继续把阅读器渲染进已关闭的面板，并留下无人回收的 `ResizeObserver` / `translationObserver` / 资料卡，`onLoad` 还会在关闭后触发。现在每个 await 后都复查；翻译流水线也加了 `aborted` 守卫，并在 cleanup 清空队列与缓存
- **P0 面板位移过期**：`_snapTransform` 原先把 CSS 居中替换成**写死的像素位移**，尺寸一变就必然偏离居中（切大小预设、缩放窗口），且该内联值跨开关持久、还会压掉开场 scale 动画。改为 `calc(-50% + 余数)`（几何始终自洽，取整失效也只是抗锯齿退化）+ 尺寸变化后重算 + 跨次不恢复自写值
- **P0 灯箱键盘监听泄漏**：`openLightbox` 只移除旧节点、不注销监听，而该监听是 **document 捕获态** → 带灯箱关闭弹窗后会吞掉宿主页面（x.com）的 Esc/方向键，且每开关一次累积一个。现在有 `closeLightbox()` 契约：打开前先 teardown，cleanup 也会调用
- **P0 已认证能力暴露给页面脚本**：`__PV2_X_BRIDGE__` 挂着 `createReply` / `toggleAction` / `toggleFollow` 等**写操作**，`__PV2_X__` 挂着 `probeRaw`——x.com 上任何脚本都能以你的登录身份发帖/删帖。现在不再挂全局（api 经返回值传递），自检入口只在调试模式下暴露
- **媒体变体字段名写错**：读 `variant.contentType` 而 X 发的是 `content_type` → content-type 判据实际是死的，URL 无扩展名的变体会直接丢掉播放地址。现有测试恰好因 fixture URL 都带 `.mp4` 而通过（过拟合断言），已补无扩展名用例
- **只有正文的长文被整个丢掉**：`articleResult` 原先只认标题/摘要/封面，现在也认 `content_state` / `plain_text`；封面只在真正的封面节点里找（此前会回退到整个 article，可能把正文内联图当成封面并带上无关宽高）
- **operation 永久负缓存**：`findOperation` 把未命中结果永久缓存，页面早期查一次失败就整会话退化到模板重放（而模板重放又要求先抓到过请求）；改为命中永久缓存、未命中只缓存 5 秒。`x-client-transaction-id` 的探测同样不再一次性放弃
- **部分成功被当成彻底失败**：`readJson` 只要 `errors` 非空就抛错，而 X 会返回 200 + `errors` + 可用 `data`（典型：某条引用帖已删除）→ 整条帖子硬失败。现在只在拿不到 `data` 时才抛，其余记日志继续
- **图标负缓存**：未命中被缓存成 `null` → 从时间线首次打开后「查看」图标整会话消失。现在不缓存未命中，且每次打开重探
- **`onLoad` 之后可能再 `onError`**：渲染与 `onLoad` 原先共用 fetch 的 `try`，渲染期异常会被当成加载失败并摘掉已渲染的布局。现在 `onLoad` 在 `try` 之外；计数访问也加了守卫（模型缺 `counts` 不再抛）
- **帖子按 id 去重**：X 会在推荐模块里重复同一条帖子，此前节点数与评论数虚高
- **为 X 做的改动不再泄漏到其它站点**：撤掉 `IframeLoader` 上只为 X 加的 `allow`（clipboard/fullscreen——X 永远走不到 iframe 路径）；`resolveMode` 返回 `xthread` 前检查加载器是否已注册，避免非 X 页面静默降级并连带关掉这些链接的悬停预热
- **死代码清理**：`.pv-x-more`（无发射方）、`renderReader` 的 `replyPane` 与 composer 的 `input` 返回值、`autoTranslate` 常量、`isNoteTweet`、`attachment.sourceUrl`/`domain`、`bottomCursor` 的死参数；7 个 `xBridge` 与 2 个 `xModel` 的内部符号不再导出

### Fixed

- **X 用户名丢失**：解用户节点时误用了 `unwrapResult`（要求 `legacy` + `rest_id` 同时存在），而 X 的用户节点已迁移到 `core`/`avatar` 结构、很多不带 `legacy`，解包得到 null 导致作者整行为空。改为移植 peek 的 `unwrapUser`（判 `core.screen_name` / `avatar.image_url` / `__typename === 'User'`），并补回归测试
- **X 弹窗内出现黑色边框线**：边框色原先从 `[data-testid="cellInnerDiv"]` 采 `borderBottomColor`，但 X 的分隔线多由背景色/伪元素实现，**元素本身没有边框**，此时 Chrome 返回的是初始值 `rgb(0, 0, 0)`（它既不等于正文色也不等于次要色，所以按颜色校验也拦不住）→ 画出来是黑线。现改为**不采样、直接用主题固定值**（亮 `#eff3f4` / 微暗 `#38444d` / 熄灯 `#2f3336`），与 peek 的做法一致
- **X 弹窗内 @handle / 时间 / 操作图标整片变蓝**：次要文字色原先从 `[data-testid="User-Name"]` 里的 `@handle` 链接采样，但页面上第一个 `User-Name` 未必是普通时间线帖子（可能是推荐模块/资料卡），取到的是 X 的链接蓝，于是所有用 `--pv-x-muted` 的地方（@handle、时间、操作图标与计数、排序按钮、工具行）一起变蓝。现次要色也改为**查表**，采样只保留来源可靠的四项（body 背景、帖子正文色、话题链接色、body 字体）
- **视频黑块**：无可播源时不再渲染 `<video>`（黑底方块），改用海报图 + 「在 X 播放」出口
- **媒体列表空数组短路**：`extended_entities.media` 为空数组时会因 `||` 短路（空数组是真值）而漏掉 `entities.media` 里的媒体，表现为有图却 `mediaCount: 0`、媒体帖末尾的 t.co 链接也没被截掉。改为在多个候选位置里选**第一个非空**的数组（peek 原写法同样存在该问题）
- **弹窗在 X 上不居中（根因治理）**：UI 原先一律挂到 `document.body`。若宿主页面给 `body`（或 `html`）加了 `transform` / `filter` / `perspective` / `will-change:transform` / `contain`，该祖先就成为 `position: fixed` 后代的**包含块**，CSS 里 `top/left:50%` 会按它而非视口计算 → 弹窗跑偏。新增 `pickMountPoint()`：挂载点自动避开这类祖先（body 受影响就退到 html），弹窗/遮罩/悬浮按钮/设置面板/规则面板统一走它
- **居中兜底校正**：新增 `PopupPanel._fixCentering()`，实测「窗体中心」与「视口中心」偏差并换算成显式像素（用中心点计算，不受打开动画 scale 影响；按祖先缩放折算），仅在居中模式（用户没拖过、非全屏）生效，偏差 <1px 时不动；其它站点为无操作

### Changed

- **图片区去掉黑底**：轮播窗体原先固定 `background-color: #000`，图片按比例缩放后留白处是黑边、加载瞬间也是一块黑。现在窗体背景改透明（留白处露出页面/浮层背景），覆盖式灯箱的**黑色遮罩改为磨砂玻璃**（`rgba(128,128,128,.28)` + `backdrop-filter: blur(14px)`，深浅色主题下都成立），大图加 12px 圆角，浮层里的图再加一层投影从磨砂背景上浮起来
- **栏内图片改回「单图逻辑」（多图不再偏小）**：此前栏内的帧高被「栏可见高」封顶（单栏时栏只有约 32vh），竖图会被压成很窄的一条（实测只占 28% 宽），看起来明显偏小。现在栏内帧**按单图的方式**排布——宽度铺满、高度 = 宽度 × 首图比例（inline `aspect-ratio`），**不做任何封顶**，所以竖图就是整幅大图，需要时由栏自身滚动（与单图帖完全一致）；灯箱逻辑（两侧固定箭头、轨道滑动、拖拽、计数器）原样保留，点图仍弹出覆盖式大图（浮层内按浮层可用区域与首图比例算像素宽高）
- **正文里的链接只显示 t.co 短链（修复）**：X 的正文文本里放的是 `https://t.co/xxxx`，界面显示的是 `display_url`（如 `github.com/foo/bar`）。渲染层此前直接用**切片文字**当链接文字，所以弹窗里只剩短链。现在链接文字取实体自带的 `label`（= `display_url`，缺失时退回 `expanded_url`），`href` 仍用 `expanded_url`；@提及 / #话题 / $代码 仍用切片文字并保留前缀校验（防止偏移错位时画出假链接）。新增两条回归断言
- **灯箱形状跟随首图比例（竖形/横向）**：此前只按「宽度铺满 + 压高度」算帧，竖图会变成「横向大框 + 左右黑边」。现在**宽高都按首图比例算成像素**，在可用区域内做 contain 适配：
  - 首图是横图 → **横向灯箱**（宽度铺满，高度按比例）
  - 首图是竖图 → **竖形灯箱**（高度顶到可用高，宽度按比例收窄并**水平居中**，两侧留白而不是黑边）
  - 切换图片时窗体尺寸不变（固定窗体）；每张图在窗体内按自身比例缩小、`contain` **完整显示**
  - 容器改为延迟解析（浮层 layer 在创建后才 append），并把 `syncFrame` 暴露给调用方在挂载后立即调用一次，不依赖 `ResizeObserver` 首次回调
- **窗体越大图片反而被裁得越多（修复）**：帧高原先靠「CSS `max-height` + `aspect-ratio`」间接得出，而**帧一旦被截断，轨道与幻灯片的 `height: 100%` 百分比解析就不再可靠**（Chrome 会退化成按图片原始尺寸渲染），图片于是超出窗体、被 `overflow: hidden` 裁掉——表现就是窗体越大帧越容易被截断、图反而裁得越多；窗体小时帧没被截断，所以显示完整。现在**由 JS 把帧高直接算成像素**（`min(栏可见高 − 12px, 可用宽 × 首图比例)`），盒子高度是确定值，下面所有百分比都按确定高度解析，不再依赖浏览器对 `aspect-ratio` + `max-height` 组合的处理；横图贴合比例不留黑边、竖图按可用高度封顶但完整可见。容器改为**延迟解析**（浮层的 layer 是轮播创建之后才 append 的），并在首次回调时补上 `ResizeObserver` 观察
- **灯箱图片显示不全（修复）**：帧高原先用**视口单位**（栏内 `70vh`、浮层 `86vh`），但容器是「栏」而不是视口——单栏模式下栏只有阅读器的一半（约 `32vh`），`70vh` 的帧让图片比可视区高一倍多，只能看到一部分；浮层 `86vh` 也超出浮层，上下两端被 `#popup-content-area` 的 `overflow: hidden` 裁掉。现在：
  - 栏内：把**栏的可见高**写进 `--pv-media-max`（在已有的 `ResizeObserver` 里随面板缩放/切预设/单双栏切换重算），帧高取 `min(70vh, 栏高 − 12px)`
  - 浮层：帧高改为相对浮层自身（`max-height: 100%`），不再超出被裁
  - 图片本身也从 `max-height: 70vh` 改为 `max-height: 100%`（相对所在 slide）——否则矮栏里图片会超出窗体被 `overflow: hidden` 裁掉
  - 结果：**图片永远完整可见**，不需要滚动；竖图自动缩小
- **图片轮播：栏内默认灯箱态 + 点击弹出覆盖式大图**：轮播抽成可复用组件 `createMediaCarousel()`，两处共用（`variant: 'inline' | 'overlay'`）：
  - **主贴多图默认就是灯箱态**：不再先显示九宫格、也不需要点一下，直接是「固定窗体 + 两侧固定箭头 + 图片左右滑动」
  - **点图弹出覆盖式大图灯箱**：浮层覆盖阅读器（`z-index: 6`，半透明黑底），内部是同一个轮播、从当前这张开始；点背景 / `✕` / `Esc` 关闭（`Esc` 先关大图、不关弹窗）
  - 单图与含视频的混合媒体仍走原来的网格，点图片同样弹出覆盖式灯箱
  - 浮层的键盘事件挂在窗体自己身上（不注册 document 全局监听），随 DOM 回收；顺带把 `.pv-x-toast` 的 `z-index` 提到 8（原先 2，低于灯箱，导致灯箱开着时「链接已复制」这类提示看不见）
- **图片放大改为「栏内就地展开 + 滑动切换」**：此前点图会打开一个覆盖**整个阅读器**的浮层（两栏都被盖住），且该浮层的键盘监听是 document 捕获态、关闭弹窗后不注销会吞掉宿主页面的 Esc/方向键。现在改为**在该栏内**把图片网格换成固定窗体的轮播：
  - **窗体与两侧箭头固定不动，只有中间的图片轨道左右滑动**（`translateX`），不是替换 `img.src`；窗体宽高比取自第一张图，切换时不改变窗体大小
  - **滑动用 rAF 弹簧而不是 CSS transition**：手势驱动的位移必须能中途抓住并反向，CSS 过渡做不到（反向时会出现速度断层的「撞墙感」）。抓住正在滑动的轨道会从**当前屏幕值**继续，收尾时把手势**释放速度交接**给弹簧，拖拽与动画之间没有缝
  - **动量投影**决定落到哪一张（`current + (v/1000)·d/(1−d)`，d≈0.998），而不是从释放点就近吸附；带速度释放时略欠阻尼（一点回弹），按钮/键盘切换则临界阻尼（无过冲）
  - **支持拖拽/触屏左右滑**（Pointer Events + `setPointerCapture`，1:1 跟手）；首尾不循环，越界用**橡皮筋**衰减；`touch-action: pan-y` 保留纵向滚动
  - 到边界时箭头**位置不动**，只降透明度并禁用；左上角序号、右上角「在 X 打开」与 ✕
  - `prefers-reduced-motion: reduce` 时改为直接落位（不做位移动画）；窗体尺寸变化（面板缩放/切预设）后按新宽度重新落位
  - 键盘事件挂在展开容器上（**不注册任何全局监听**），弹窗关闭后零残留——顺带彻底消除了上面那条泄漏
  - 覆盖式浮层代码与其 CSS 一并删除（约 60 行 JS + 80 行 CSS），`onMedia` / `handleMedia` 接线随之移除
- **X 站点策略改为 GraphQL 原生渲染**：`sitePolicy` 中 `x.com` / `twitter.com` 标记 `xThread: true`。iframe 路线已实测作废——X 的框架策略**全站拒绝嵌入（含同源）**，裸 `<iframe src>` 同样白屏（对照：peek 历史版本 `67e6e20` 曾用裸 iframe 同源嵌入成功，说明是 X 后来收紧了策略）；抓取净化路线也拿不到内容（X 由客户端 React 渲染，评论为空）
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
