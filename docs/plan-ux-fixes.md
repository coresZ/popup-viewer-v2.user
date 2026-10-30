# 修复计划：UX 评审问题（v2.2.0 → 2.4.x）

> 问题编号对应 [review-ux-2.2.0.md](review-ux-2.2.0.md)
> 状态：阶段 1–5 已在 2.3.0 完成（未提交）。版本只升一次（2.2.0 → 2.3.0），CHANGELOG 合并为一段；帖内链接保持新标签页打开。
> 未做：X 回复按服务端排序（需改网络层，无法测试）；PopupKit 迁入 Shadow DOM 与 kit.css 共用源码（避免影响引用 PopupKit 的其他脚本）。

## 约定

- 不自动提交。每个阶段改完停在工作区，用户确认后再提交
- 改代码的阶段递增版本号：`package.json` + `banner.txt`，然后 `npm run build` 重建 `dist/`，并补 `CHANGELOG.md`
- 每阶段验证：`npm test`（xModel 单测）+ 外部测试台 `%TEMP%\pv2-ux` 对应脚本（`measure.mjs`、`verify2.mjs`）复测
- 验收数字都来自评审实测，修复后复测同一项

---

## 阶段 1 · P0 与数据丢失（2.2.1）

只做最小改动，尽快发布。

| # | 问题 | 改动 | 文件 | 验收 |
|---|---|---|---|---|
| 1.1 | K1 | 新增 `isEditableTarget(e)`（input/textarea/select/contenteditable，含 `composedPath()`）；keydown 开头遇到 `defaultPrevented`、`isComposing`、可编辑目标直接 return；`f`/`r` 要求无 Ctrl/Meta/Alt；Alt+←/→ 在可编辑目标里放行；Esc 在可编辑目标里只 `blur()` | `src/utils/dom.js`、`src/ui/PopupPanel.js:566–588`、`src/kit/KitPopupPanel.js:219` | verify2：点选输入框得到 `forum` 且不全屏；X 回复框按 r 后值为 `okr`、阅读器不重建；宿主搜索框得到 `fork`；Ctrl+F 不切全屏 |
| 1.2 | K1 | 回复框有草稿时，关窗和刷新前确认；或按 tweet id 暂存草稿，重开时恢复 | `src/x/xRender.js`、`src/loaders/XThreadLoader.js` | 输入草稿后按 Esc/刷新，草稿不丢 |
| 1.3 | K2 | 隐藏态加 `visibility:hidden`，过渡写成 `opacity …, visibility 0s linear <淡出时长>`，`.visible` 里延迟为 0；show/hide 时同步 `el.inert` | `src/ui/style.css`（面板、设置弹层、规则遮罩、规则面板、toast）、`PopupPanel.js`、`RulesPanel.js` | a11y-tab-walk：隐藏状态下可聚焦元素为 0；淡入淡出动画不变 |
| 1.4 | S1 | 「恢复默认」加确认，写明会重置全局和本站设置 | `src/ui/SettingsPanel.js:196–211` | 点一次不生效，确认后才重置 |
| 1.5 | E2 | `.finally()` 改为 `entry.promise.then(cleanup, cleanup)` | `src/loaders/CacheLoader.js:42` | verify2 的 error-copy 步骤控制台无未处理异常 |

---

## 阶段 2 · 核心流程缺陷（2.2.2）

| # | 问题 | 改动 | 文件 | 验收 |
|---|---|---|---|---|
| 2.1 | N1 | `readIframeLocation` 上报前若 iframe 地址等于宿主 `location.href` 则返回 null；`buildDocument` 用抓到的 `<title>`；`PopupManager` 收到空标题或占位标题时保留原标题 | `src/loaders/IframeRenderer.js:10–24, 57–80`、`src/core/PopupManager.js` | verify-extra：打开后标题为帖子标题、后退禁用、底部提示为帖子地址；帖内真实跳转仍进历史 |
| 2.2 | R1 | 点到的元素在 `a[href]` 内时，优先推荐匹配链接本身的选择器，「整行可点」单列；`_extractLink` 命中容器但点击目标在另一个链接上时不拦截 | `src/utils/selector.js:120–130`、`src/core/RulesManager.js:91–96` | f07 默认候选为 `a.thread-title` 或 `.thread-title`；rule-container-hijack 点作者链接不打开帖子 |
| 2.3 | R2 | 点选期间隐藏弹窗和遮罩，结束后恢复 | `src/ui/RulesPanel.js:105–121`、`PopupPanel.js` | 点选时页面中央无遮挡 |
| 2.4 | R3 | touchstart 记录坐标，位移 >10px 的 touchend 不算点选；coarse 下用触屏文案；提示条内加 `pointer-events:auto` 的「取消」 | `src/ui/ElementPicker.js` | m-picker-swipe：滑动后不弹确认框；能取消 |
| 2.5 | K3 | 同源 iframe 加载后给其 document 挂 keydown，按 1.1 的规则转发 Esc/R/F/Alt+←→ | `IframeRenderer.js`、`PopupPanel.js` | 焦点在帖子里时 Esc 能关窗 |
| 2.6 | K4 | 设置弹层自己处理 Esc；打开时焦点移入，关闭时还给触发按钮 | `SettingsPanel.js`、`PopupPanel.js` | f03b：Esc 后设置关闭，焦点回到齿轮 |
| 2.7 | X1 | 加载失败时哨兵换成「加载失败 · 重试」按钮；最后一页显示「已显示全部 N 条」 | `src/loaders/XThreadLoader.js:377, 391–396, 540–545` | x07：失败后出现重试，点击后能继续加载 |
| 2.8 | E1 | `PopupManager` 分开保存 abort 和 dispose；关窗和下一次 load 前调用 dispose | `src/core/PopupManager.js:189–222`、`XThreadLoader.js` | 关窗后主题观察器断开、翻译队列清空 |

---

## 阶段 3 · 视觉与可访问性（2.3.0）

先建变量，再替换用法。

| # | 问题 | 改动 | 文件 | 验收 |
|---|---|---|---|---|
| 3.1 | V1、V2、V6 | 新增 `--popup-on-accent`（浅 #fff / 深 #0f172a）、`--popup-border-strong`（浅 #7c8ba1 / 深 #64748b）；文字不再用 `--popup-faint`；最小字号 12px；禁用态去掉 `opacity:.35` | `src/ui/style.css` | contrast-light/dark：文字 ≥4.5:1，图形和边框 ≥3:1 |
| 3.2 | K5 | 删掉重置层 `outline:0`；外壳根统一 `:focus-visible` 实色描边；`forced-colors` 兜底 | `src/ui/style.css:32` 等 | focus-rings：所有可交互元素都有可见焦点框 |
| 3.3 | V4 | `(pointer:coarse)` 下热区 ≥44px（视觉尺寸可用 `::before` 扩热区）；开关整行做成 `<label>` 或加 `aria-labelledby` | `style.css`、`SettingsPanel.js:152, 239–244` | m-popup / m-settings 的 under44 为空 |
| 3.4 | V5 | 窄屏默认关闭四角把手，开启时改为半透明小角标 | `style.css:224–253`、`SettingsManager.js` | 手机上四角不再被遮挡 |
| 3.5 | V3 | 外壳根固定 `font`、`line-height`、`letter-spacing`、`text-transform`；错误、加载视图显式写颜色和 px 字号；`.spinner` 改名 `.pv-spinner` | `style.css`、`ErrorView.js`、`Loading.js` | 宿主 body 字号变化时，错误页标题和设置按钮尺寸不变 |
| 3.6 | X5、X6、X8 | 阅读器两栏和卡片用细滚动条（遵从「窗体滚动条」设置）并加渐隐；卡片边框和箭头用 `var(--pv-x-border)`；错误色变量化；`.pv-x-*` 操作在 coarse 下扩热区 | `style.css`（`pv-x-` 段） | x-dark-card-border 为主题色；x-targets 在 coarse 下 ≥40px |
| 3.7 | S4、V16 | 设置弹层细滚动条 + 底部 sticky；规则面板关闭按钮套用图标按钮基础样式 | `style.css:326–372, 442–474` | 弹层底部内容可发现 |
| 3.8 | V15 | 拖拽阈值 3–4px，坐标取整 | `src/utils/panelBehavior.js:85–113` | 单击标题栏后 transform 不变 |

---

## 阶段 4 · X 阅读器体验（2.3.x，可拆成多个小版本）

| # | 问题 | 改动 |
|---|---|---|
| 4.1 | X2 | 入口改为正文下方文字链接"查看 N 条回复 ›"；计数口径统一 |
| 4.2 | X3 | 卡片上沿不超过回复框下沿；或点卡内「回复」时先关卡片 |
| 4.3 | X4 | 单栏改为单个滚动容器，或加"帖子 \| 回复 N"切换；卡片 maxHeight 取栏可用高度 |
| 4.4 | X7 | 行内用相对时间（`cardStamp`），完整时间放 title；@handle 先截断 |
| 4.5 | X9 | 渲染后把焦点帖滚到左栏顶部；焦点帖放大字号 |
| 4.6 | X10 | 卡片加载态、失败重试；toast 按 tone 区分并加 `role` |
| 4.7 | X11 | 卡外点击判断排除资料卡和大图；滚动监听改挂 `.pv-x-reply-list`；资料卡键盘可进入，取关确认 |
| 4.8 | X12 | 加载更多只追加；同 id 共用一个模型对象；发回复后用接口返回的真实推文 |
| 4.9 | X13、X14、X15 | 视觉细节、文案统一（"回复"、"…"、数字格式）、aria 补全 |

---

## 阶段 5 · 产品与结构（2.4.0，先确认方向）

| # | 问题 | 改动 | 待定 |
|---|---|---|---|
| 5.1 | V17 | 注册油猴菜单「打开设置」「在此站点点选链接」（banner 加 `@grant GM_registerMenuCommand`）；齿轮可隐藏 | 菜单项内容 |
| 5.2 | S2、N3 | 「页面链接拦截」拆成两个开关；帖内链接默认在弹窗内打开，Ctrl/中键新开 | 默认值 |
| 5.3 | N2 | 底部栏显示域名，没有历史时隐藏 ← → | — |
| 5.4 | R4、R5 | 确认框高亮全部命中、通俗描述；规则面板编辑、停用、撤销删除 | — |
| 5.5 | S1、S3、S5、L1、L2 | 作用范围标注、自定义尺寸状态、文案、错误原因映射与重试、慢加载提示 | 文案定稿 |
| 5.6 | E3 | "最近看过"列表 | 是否要做 |
| 5.7 | V3、V7–V14 | 外壳迁入 Shadow DOM；成对设计变量（文字三级、强调上文字、强边框、阴影三级、字号、圆角、时长）；z-index 单一基准；kit.css 从同一源码生成 | 是否连 kit 一起迁 |

---

## 待用户决定

1. 帖内链接默认在弹窗内打开，还是保持新标签页
2. 「页面链接拦截」拆分后的命名和默认值
3. Shadow DOM 迁移是否包含 PopupKit（kit.css）
4. 阶段 1、2 是否合并成一个版本发布
