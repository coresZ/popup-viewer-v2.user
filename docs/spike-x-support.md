# Spike：X（x.com）弹窗支持 · 验证清单

分支：`spike/x-support` · 版本：`2.1.0` · 产物：`dist/popup-viewer-v2.user.js`
方案文档：`docs/plan-x-graphql.md` · 代码来源与许可：`THIRD_PARTY_NOTICES.md`

## 0. 已排除的路线（实测结论）

| 路线 | 结果 |
|---|---|
| iframe 直载（含同源） | ❌ 弹窗内「x.com 拒绝了我们的连接请求」；**裸 `<iframe src>` 同样被拒** → X 全站拒绝嵌入，与 `sandbox` 属性无关。用户脚本无法像扩展那样用 DNR 改写响应头 |
| 抓取净化 | ❌ X 由客户端 React 渲染，抓回来是空壳，评论为空 |
| **GraphQL 原生渲染（当前路线）** | ✅ 用当前登录会话读 X 内部 GraphQL，自渲染原帖 + 评论 |

对照证据：peek 历史版本 `67e6e20` 曾用**裸 iframe**（无 sandbox、无 DNR）成功同源嵌入，说明是 X 之后收紧了框架策略。

## 1. 本次改动

| 文件 | 改动 |
|---|---|
| `src/adapters/XAdapter.js` | X 帖子点击解析（引用帖优先、详情页避让、交互目标白名单） |
| `src/x/xBridge.js` | **新增**：页面上下文网络层——补丁 `fetch`/XHR 捕获鉴权头与模板、webpack runtime 动态发现 GraphQL operation、`readThread()` |
| `src/x/xModel.js` | **新增**：数据层——`unwrapResult` 解包、tweet 节点收集、`bottomCursor` 游标、`parseThreadSummary` 原帖/评论归属判定 |
| `src/loaders/XThreadLoader.js` | **新增**：`xthread` 加载方式，双栏阅读器 + X 皮肤 + 分页 |
| `src/x/xTheme.js` | **新增**：只读采样 X 实时样式 → `--pv-x-*` 令牌，跟随 X 主题切换 |
| `src/x/xIcons.js` | **新增**：只读克隆 X 实时 DOM 的 SVG 图标（回复/转推/喜欢/查看/认证） |
| `src/x/xRender.js` | **新增**：X 版式渲染（原帖 + 评论 + 双栏骨架） |
| `tests/xModel.test.mjs` | **新增**：数据层回归测试（`npm test`） |
| `src/core/LoaderManager.js` | 新增 `register(mode, loader)`；`xThread` 策略 → `xthread` 模式 |
| `src/config.js` | `x.com` / `twitter.com` 改为 `{ xThread: true }`（移除 iframe 策略） |
| `src/main.js` | x.com 页面安装网络层、注册加载器、暴露 `__PV2_X__` 自检入口 |
| `banner.txt` | 新增 `@grant unsafeWindow` |

## 2. 验证步骤

**先重新导入脚本并刷新 x.com**（补丁必须在页面早期装上，务必刷新）。

### ① 网络层是否装上

```js
__PV2_X__.captureState()
```

期望：`{ hasAuthorization: true, bearerSource: 'request' | 'webpack', authHeaders: [...], templates: [...], hasWebpackRuntime: true }`

- `hasAuthorization: false` → 还没捕获到 X 自身的请求。等几秒重试；`bearerSource: 'webpack'` 表示走了从打包代码里找 bearer 的兜底路径，同样可用
- `hasWebpackRuntime: false` → webpack runtime 没抓到，operation 发现会失败（见 ③ 的处置）

### ② operation 发现

```js
__PV2_X__.hasOperation('TweetDetail')
```

期望 `true`。这是**最脆弱**的一环（依赖 X 的打包结构）；若为 `false`，等待页面完全加载后重试。

### ③ 读一条帖子（数据层核心验证）

```js
await __PV2_X__.probe('20')          // 换成任意真实帖子 ID
```

期望返回：
```js
{ focalFound: true, focal: { id, handle, name, text, createdAt, counts, mediaCount }, replies: [...], replyCount: N, cursor: '...', ms: 300, state: {...} }
```

- `focalFound: false` → X 没返回这条帖子（或 ID 不存在/受保护）
- 抛「还没有捕获到 X 登录请求」→ 未登录，或捕获失败
- 抛「尚未加载 TweetDetail 操作」→ ② 失败，需刷新或等页面加载完

### ④ 弹窗内渲染与 X 观感

在时间线点一条帖子（不是点赞/转发按钮、不是图片）：弹窗内应是**左栏原帖 / 右栏评论**的双栏阅读器，两栏各自滚动：

- 头像 40px 圆形、昵称粗体、认证勾、`@handle`、`·` 时间
- 正文 15px / 行高 20px，与 X 时间线一致
- 操作行：回复 / 转推 / 喜欢 / 查看 图标 + 计数（图标是克隆 X 实时 DOM 的 SVG，应与 X 像素级一致）
- 评论：头像列 + X 的竖线、按嵌套层级缩进，右栏顶部「评论（N）· 在 X 打开」
- **颜色与字体应跟随 X 当前主题**（亮 / 微暗 / 熄灯）与 X 的字体栈；在 X 设置里切主题，弹窗应跟着变
- 把弹窗拖窄到 640px 以下 → 自动切成上下堆叠；拖宽回来 → 恢复双栏

同时确认：页面**没有跳转**、时间线位置不变（点击拦截是否抢在 X 的 React 路由之前）。

## 3. 预期内的行为（不是 bug）

- **详情页避让**：已在 `/status/...` 页面时点普通帖不拦截，只拦引用帖卡片
- **跨站不生效**：在 linux.do 等站点点 x.com 链接不会走 GraphQL——它需要 x.com 页面上下文（webpack runtime + 登录会话），此时退回抓取净化，只能得到一张卡片
- **评论是纯文本列表**：媒体（图片/视频）、引用帖、点赞回复等互动待 C4
- **分页是手动按钮**：滚动自动加载待 C3
- **无视觉增强**：`enhance()` 空实现，不给 X 页面里的帖子加高亮边框（避免与 X 虚拟化渲染冲突）
- **X 皮肤只作用于弹窗**：面板外壳与内容区在加载 X 帖子时套用 X 配色（`pv-x-skin`），关闭或加载其他站点内容时自动摘掉

## 4. 已知风险

| 风险 | 现象 | 处置 |
|---|---|---|
| 鉴权头捕获晚于 X 首个请求 | `hasAuthorization: false` | 刷新页面；webpack bearer 兜底；错误文案已提示刷新 |
| X 改打包结构 | `hasOperation` 为 false | 捕获到的 `TweetDetail` 模板可重放兜底（需先手动打开过一次帖子详情） |
| 用户脚本沙箱拿不到页面 fetch | 补丁无效 | 已加 `@grant unsafeWindow`，并用 `typeof` 安全探测回退 |
| X 风控/限流 | 弹窗内显示服务端错误原文 | 无重试（与 peek 一致），原文透传便于判断 |

## 5. 回滚

```bash
git checkout main          # spike 改动都在 spike/x-support 分支，未提交未推送
```
