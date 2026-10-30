# 修复记录：v2.3.0 UX 评审 → v2.3.1 / v2.3.2 / v2.3.3 / v2.3.4 / v2.3.5

> 对应 [review-ux-2.3.0.md](review-ux-2.3.0.md) 的「建议的修复顺序」。
> 本文件记录已落地项与验证方式；未列入的 P2 仍保留在评审报告里，按迭代继续。
> 2.3.2 追加：最近列表按当前 `hostname` 过滤，清空只清本站；移除窗体大小/外观主题等分段控件的默认值小圆点，选中态不再挤压文字。
> 2.3.3 追加：X 主贴/回复卡片恢复完整发布时间；「查看 N 条回复」回到时间右侧的图标入口；设置/规则面板改为按需创建，减少页面初始化 DOM。
> 2.3.4 追加：修复 linux.do 等 iframe 站点「内容已显示但被超时错误覆盖」。
> 2.3.5 追加：点选候选可见文本改为实际选择器，中文说明移入 `title` tooltip，保持单行紧凑。

## 已完成（P1）

| 编号 | 修复 | 改动文件 | 验证 |
|---|---|---|---|
| M1 | 移动端头部改两行：标题独占首行（最多两行），5 个操作按钮在第二行平分 44px 高度 | `style.css` 手机断点 | 390×844：header 103px，标题宽 321px（原 65px），按钮 68×44 |
| M2 | 四角缩放把手默认关闭；旧版已持久化 `mobileResize:true` 的用户首次加载按新默认迁移 | `SettingsManager.js`、`SettingsPanel.js`、`style.css` | 移动端 knobs 可见数 0；设置开关可重新开启 |
| M3 | 移动端设置改全宽底部 sheet，最高 85dvh，切 tab 保持贴底 | `PopupPanel.showSettingsNear`、`style.css` | 390×844：390×717、bottom=844；切「最近」仍 bottom=844 |
| S1 | 桌面设置宽度 280→340，修复「窗体驻留方式」横向溢出；标题+关闭+tab 合并为 sticky 头部 | `style.css`、`SettingsPanel.js`、`PopupPanel.js` | 1440：`clientW=328/scrollW=328`，无横向滚动条；滚动后 headTop≥panelTop |
| S4 | 设置浮层高度限制在弹窗底边内；800px 视口不再盖住弹窗头 | `PopupPanel.js` | 1280/1024/900/800：settings bottom 均不超过 popup bottom；800 时 top=128 |
| R1 | 规则面板先同步 `inert=false` 再聚焦；加入 Tab 循环、`aria-modal`、关闭焦点归还到工具栏设置按钮 | `RulesPanel.js`、`PopupPanel.js` | 打开后 active 在规则面板内；连续 Tab 不逃逸；Esc 后回到可见入口 |
| X1 | X 操作栏改 `space-between` + 4px gap，左栏 `overflow-x:hidden` | `style.css` | 720 双栏：pane 372/372、actions 288/288，无横向滚动条 |
| X2 | X 浅色链接改 `#0b6bcb`、回复按钮改 `#0f6fbf` 填充；新增 scrollbar/accent 填充令牌 | `xTheme.js`、`style.css` | 链接 `rgb(11,107,203)`、按钮 `rgb(15,111,191)`；对比度约 5.2/5.4:1 |
| X3 | X 回复草稿持久化到 GM/localStorage，300ms 防抖、20 条、7 天过期 | `xDrafts.js` | 输入后 `popup-viewer:pv2:xDrafts` 有记录；刷新后恢复 |
| V1 | iframe 改 `display:block`，`.iframe-direct-load` 只允许 iframe 自己滚动 | `style.css` | 内容区 `clientH=581/scrollH=581`，仅 iframe 内一条滚动条 |

## 同批完成的 P2

- **S2**：设置头部与 tabs 合并 sticky，移动端滚动不再只剩 tab、不再漏内容。
- **R2（部分）**：设置 `role=dialog`、tablist/tabpanel/aria-controls、方向键切换；规则面板 `aria-modal`。
- **X4（部分）**：X 滚动条 thumb 改独立 `--pv-x-scrollbar`，浅色 #a9b4c0 / 深色 #4a5568；最近列表标题两行截断。
- **V4（部分）**：规则/点选器字体栈统一到 `--pv-font`，规则面板圆角统一到 `--pv-radius-lg`。

## 验证

- `npm test`：52 + 1 组 selector 测试通过。
- 真实无头 Chrome（1440/1280/1024/900/800/390×844）截图与 DOM 指标见 `%TEMP%\dsh-ePaSbm\pv2-review2\shots\fix*.png`、`fixcheck.json`、`resp5.json`；修复后的关键截图在 `docs/review-assets-2.3.1/`（mobile-popup-fixed / mobile-settings-fixed / settings-desktop-fixed / x-reader-fixed）。
- 构建：`package.json` / `banner.txt` 2.3.1，`dist/popup-viewer-v2.user.js` + `dist/popup-viewer-kit.js` 已重建（未提交）。

## 未做（仍按 P2 迭代）

- 深色主题 iframe 内容主题桥（需决定「跟随主题/保持原网页」产品默认）
- 加载/错误态骨架化
- 设置信息架构（单页分组/搜索、把「最近」移出设置）
- 最近列表 favicon、条目删除、清空撤销
- 无规则站点首次使用引导、点选候选通俗描述
- 全屏阅读列上限、X 分栏比例/密度预设、X 服务端排序
