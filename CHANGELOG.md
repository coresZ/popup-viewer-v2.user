# Changelog

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
