# 方案 C：X 帖子弹窗（GraphQL 原生渲染）

分支：`spike/x-support` · 前置结论：**X 全站拒绝被嵌入（含同源）**，`<iframe>` 路线作废（裸 iframe 实测同样被拒）。

## 1. 为什么只能走这条路

| 路线 | 结论 |
|---|---|
| iframe 直载（原方案 A/B） | ❌ X 的框架策略拒绝，裸 iframe 也白屏 |
| 抓取净化 | ❌ X 内容由客户端 React 渲染，抓回来是空壳，评论为空 |
| **GraphQL 原生渲染（本方案）** | ✅ 用当前登录会话直接读 X 的内部 GraphQL，自己渲染帖子 + 评论 |

技术参照：本地 `D:\source\peek`（MIT，© 2026 xuntianx）已用这套机制做出完整实现，本方案移植其网络层与数据层，**不移植**其双栏 UI 与互动功能。

## 2. 用户脚本比扩展更简单

peek 之所以要「MAIN world 页面桥 + `window.postMessage` + requestId 关联」，是因为 Chrome 扩展的 content script 默认在隔离世界、拿不到页面 `fetch`/webpack。用户脚本不需要这层：

| peek（扩展） | 我们（用户脚本） |
|---|---|
| `content_scripts` 双脚本 + MAIN world | 单脚本；`unsafeWindow` 直接改页面 `fetch` / `XMLHttpRequest` |
| `postMessage` 桥 + `pendingRequests` + 超时 | 直接 `await` 调用，无桥、无 requestId |
| `chrome.storage` | 现有 `SettingsManager` / `GM_setValue` |
| `chrome.runtime.getURL(hls.worker.js)` | 去掉 `enableWorker` 或 Blob 化 |

需要给 `banner.txt` 补一个 `@grant unsafeWindow`（TM 下改页面 `fetch` 的唯一可靠途径）。

## 3. 模块划分

```
src/x/
  xBridge.js    页面上下文网络层：fetch/XHR 补丁、auth 捕获、webpack operation 发现、graphql()、readThread()
  xModel.js     纯数据层（移植 peek core.js）：解包 / tweetModel / parseThreadDetail / 游标 / 媒体
  xTheme.js     X 观感令牌：只读采样 X 实时样式（颜色/字体）→ --pv-x-* 变量
  xIcons.js     X 图标：只读克隆 X 实时 DOM 的 SVG
  xRender.js    X 版式渲染：原帖 / 评论 / 双栏阅读器骨架
  xSnapshot.js  点击瞬间 DOM 兜底（移植 peek snapshotArticle，C2 用）
src/loaders/XThreadLoader.js   与现有 LoaderManager 对接（渲染进弹窗内容区）
tests/xModel.test.mjs          纯数据层回归测试（夹具按 X 真实响应结构构造）
```

集成点（改动极小）：

- `config.sitePolicy`：`'x.com' / 'twitter.com'` → `{ xThread: true }`（**移除** iframe 策略，那条路已证明不可用）
- `LoaderManager.resolveMode()`：policy 带 `xThread` → 返回 `'xthread'`；`loaders.xthread = new XThreadLoader()`
- `XAdapter.parseClick()`：已能解析出 `https://x.com/{handle}/status/{id}`，直接复用
- 弹窗外壳、拖拽/缩放/全屏/历史/主题、设置面板：**全部复用现有 PopupPanel，不重写 UI**

## 4. 网络层要点（peek 已实测的机制，逐条移植）

1. **Operation 发现**：`Object.keys(window)` 找 `webpackChunk*`，`chunk.push([[name], {}, cb])` 拿到 `__webpack_require__`；在 `runtime.c`（模块缓存）与 `runtime.m`（工厂，先用 `Function.prototype.toString` 过滤含 operationName 的）里 `deepFind` 出 `{ operationName, queryId, metadata.featureSwitches, metadata.fieldToggles }`，深度上限 5
2. **端点**：`/i/api/graphql/{queryId}/{operationName}`；读操作 `GET`（`variables`/`features`/`fieldToggles` 三个 query 参数），写操作 `POST`（body `{variables, features, queryId}`，**不带 fieldToggles**）
3. **请求头**：`authorization`（**必须**，从页面真实请求捕获）、`x-twitter-active-user`、`x-twitter-auth-type`、`x-csrf-token`（读 `ct0` cookie，写操作必填）、`x-client-transaction-id`（best-effort，失败不阻断）
4. **auth 捕获**：`document-start` 补丁 `fetch` + `XMLHttpRequest.prototype.open/setRequestHeader/send`，只记 `AUTH_HEADER_NAMES` 白名单内的头；**必须早于 X 首个请求**
5. **兜底**：捕获到的 `TweetDetail` 模板可原样重放（只改 `variables.focalTweetId`/`cursor`）——operation 发现失败时的唯一退路
6. **错误口径**：`!response.ok || json.errors?.length` 都算失败；**无重试、无退避**；写操作绝不重发
7. **游标**：`cursorType === "Bottom"`（回退 `ShowMoreThreads`）；「无新增评论 / 游标为空 / 游标重复」三者任一即终止分页

## 5. 数据层要点

- `unwrapResult`（≤6 跳，`legacy && rest_id` 即命中）、`unwrapUser`（≤4 跳，`core.user_results` 优先）
- `tweetModel` 产出 `{id,url,text,entities,author,createdAt,conversationId,inReplyToId,counts,flags,media,attachment,quote}`；长文取 `note_tweet.note_tweet_results.result.text`；引用帖只递归 1 层
- `parseTweetDetail(json, focalId)`：**fail-closed**——找不到原帖就返回 `{focal:null,...}`（防 X 注入的推荐模块被当成评论）；评论用 `in_reply_to_status_id_str` 链回溯到原帖来判定归属；嵌套拍平为 `depth`（0–3）
- 媒体：五处 variant 位置兼容 + 去重、HLS（`.m3u8`）与 MP4 变体、按码率选档
- `mergeModelFallback`：GraphQL 缺字段时用点击瞬间 DOM 快照补齐（仅原帖）

## 6. 里程碑与验收

| 阶段 | 内容 | 验收标准 |
|---|---|---|
| **C1 数据层** ✅ 已完成 | `xBridge.js` + 补丁 + operation 发现 + `readThread`；`__PV2_X__.probe(id)` 暴露到控制台 | 控制台能打印原帖正文/作者/评论数与游标（待真机确认） |
| **C1.5 X 观感** ✅ 已完成 | `xTheme.js`（只读采样 X 实时样式做令牌）、`xIcons.js`（克隆 X 实时 SVG）、`xRender.js`（X 版式 + 双栏） | 弹窗内左原帖右评论、颜色字体跟随 X 主题、窄窗自动单列（待真机确认） |
| **C2 模型层** ✅ 已完成 | `xModel.js` 已补齐：`unwrapUser`（X 已迁移到 core/avatar）、媒体变体选档、互动 flags、回复上下文、分页终止规则 + 夹具回归测试 | `npm test` 15 项全绿 |
| **C3 渲染与集成** ✅ 已完成 | 双栏阅读器、X 皮肤、媒体宫格、滚动自动加载、评论排序、失败提示 | 滚到底自动加载下一页 |
| **C4 互动** ✅ 已完成（参照 peek） | 点赞/转推/收藏（乐观更新 + 回滚）、复制链接、纯文字回复、评论排序、回复上下文 | 交互按钮可用且状态正确 |
| **C5 待做** | 自动翻译（REST strato 接口）、作者资料卡与关注、HLS 自适应播放（hls.js ~200KB）、引用帖卡片 | 按需 |

### X 观感的设计取舍（已定）

| 做法 | 结论 |
|---|---|
| **读取 X 实时样式做令牌**（`xTheme.js`） | ✅ 采用。颜色/字体与 X 完全一致，且跟随 X 主题切换与未来改版；采样失败回退 X 官方三套主题固定值 |
| 直接套 X 的原子类名（`css-175oi2r` 之类） | ❌ 构建期哈希，随发版变化；peek 也刻意避开 |
| 克隆 X 的 React DOM 节点 | ❌ X 虚拟化会回收节点；peek 的 AGENTS 明令禁止 |
| 图标 | ✅ 只读 `cloneNode` X 实时 DOM 的 SVG（回复/转推/喜欢/查看/认证），取不到则省略该图标 |
| 版式 | ✅ 双栏（左原帖 / 右评论，各自滚动），与 peek 阅读器一致；窄窗自动上下堆叠 |

⚠️ 样式实现约束：X 的全局 CSS 是**无层级**的，而 CSS 层级优先级低于无层级规则 —— 所以 X 皮肤样式**不能**放进 `@layer`，必须用无层级 + `#popup-content-area` / `#popup-content-panel` 高特异性书写。

## 7. 风险与对策

| 风险 | 对策 |
|---|---|
| auth 捕获时机晚于 X 首个请求 → `authorization` 缺失 | `document-start` 安装补丁；报错文案明确提示「刷新 X 页面」；operation 发现与模板重放双路 |
| webpack operation 发现失效（X 改构建） | 捕获模板重放兜底；queryId 缓存到 `GM_setValue`（带 TTL），跨会话复用 |
| `x-client-transaction-id` 的 `kc` 函数发现脆弱（成员名 + arity 3） | 保持 best-effort，失败不阻断请求（与 peek 一致） |
| X 风控/限流 | 无重试；把服务端错误原文透传到弹窗错误态 |
| X 改版导致字段漂移 | 数据层纯函数 + 内联夹具测试；`findNamedValue` 这类深度搜索兜底 |
| 用户脚本沙箱拿不到页面 `fetch` | `@grant unsafeWindow`；`typeof unsafeWindow !== 'undefined'` 安全探测，回退 `window` |

## 8. 许可与归属

peek 为 MIT（Copyright (c) 2026 xuntianx）。移植其代码需保留版权声明：新增 `THIRD_PARTY_NOTICES.md` 记录来源（仓库地址 + 版本 + MIT 声明），移植文件头部注明出处。本仓库同为 MIT，兼容。
