# 用 Tailwind v4 重构 Popup Viewer UI/UX

日期：2026-08-07

## 背景

popup-viewer-v2 是一个 Tampermonkey 用户脚本，把弹窗阅读 UI 以 `gm.addStyle()` 注入宿主页面。现有样式为手写 CSS：`src/ui/style.css`（主脚本，`popup-`/`pv-` 前缀）与 `src/kit/kit.css`（PopupKit 独立库，`pvk-` 前缀），通过 esbuild 以 `loader: { '.css': 'text' }` 打包进产物。

目标：用 Tailwind CSS v4 重构全部 UI 组件，保持视觉基本不变、微调优化细节，同时维持用户脚本对宿主页面的零样式污染。

## 决策记录

- **版本**：Tailwind v4（CSS-first 配置，`@theme` 内联变量）
- **Preflight**：禁用（只引入 theme + utilities 层，跳过 base），避免污染宿主页面
- **前缀**：加前缀隔离。主脚本 `pv:`，PopupKit `pvk:`，与宿主页面及两个脚本之间零冲突
- **important**：所有 utilities 加 `important`，压过宿主页面无层级规则（现 `@layer` 无法完全挡住的场景）
- **构建**：方案 A，esbuild 插件集成（PostCSS + `@tailwindcss/postcss`），单流程支持 watch，保持单文件发布
- **视觉**：保持现有配色/圆角/阴影/设计令牌，微调间距/字体/动效/焦点态/对比度

## 依赖与构建

新增 devDependencies：

- `tailwindcss@^4`
- `@tailwindcss/postcss`
- `postcss`

`build.mjs` 新增一个 esbuild 插件：对 `.css` 文件先经 PostCSS（含 `@tailwindcss/postcss`）编译，再以文本内联。`src/ui/style.css` 与 `src/kit/kit.css` 两个入口均经该插件处理。`npm run build` / `npm run dev`（watch）行为不变，产物仍为 `dist/popup-viewer-v2.user.js` 与 `dist/popup-viewer-kit.js`。

## 样式架构

`src/ui/style.css` 与 `src/kit/kit.css` 结构对齐（前缀分别为 `pv` / `pvk`）：

```css
/* 保留轻量重置，作为宿主隔离兜底（内容同现有 @layer pv-reset） */
@layer pv-reset { ... }

@layer theme, base, components, utilities;
@import "tailwindcss/theme.css" layer(theme) prefix(pv);
@import "tailwindcss/utilities.css" layer(utilities) prefix(pv) important;

/* 设计令牌：现有 CSS 变量注册为 Tailwind 主题令牌（inline 引用变量本身） */
@theme inline {
  --color-accent: var(--popup-accent);
  --color-accent-hover: var(--popup-accent-hover);
  --color-accent-soft: var(--popup-accent-soft);
  --color-danger: var(--popup-danger);
  --color-danger-soft: var(--popup-danger-soft);
  --color-header-bg: var(--popup-header-bg);
  --color-border: var(--popup-border);
  --color-text: var(--popup-text);
  --color-muted: var(--popup-muted);
  --color-faint: var(--popup-faint);
  --color-bg: var(--popup-bg);
  --color-surface: var(--popup-surface);
  --color-btn-bg: var(--popup-btn-bg);
  --color-focus-ring: var(--popup-focus-ring);
  --shadow-popup: var(--popup-shadow);
}

/* 自定义组件类 + 动态状态类 */
@layer components { ... }
```

要点：

- **禁用 Preflight**：Tailwind 官方 `index.css` 只导入 `theme.css + preflight.css(base) + utilities.css` 三层。这里只导入 theme + utilities（跳过 base/preflight），即禁用 Preflight；层顺序声明 `@layer theme, base, components, utilities;` 保留以保证 utilities 排最后。
- **`@theme inline`**：令牌值引用其他变量（`--popup-*`）时必须用 `inline`，utility 才会直接引用 `var(--popup-accent)` 而非解析为静态值，从而工具类 `pv:bg-accent` 自动跟随主题切换。
- 主题切换（`:root.pv-theme-dark` / `:root.pv-theme-light` / `@media prefers-color-scheme`）沿用现有 `:root` 变量定义，逻辑零改动。
- `important` 通过 `@import "tailwindcss/utilities.css" ... important`（Tailwind v4 支持 import 级 important 标志）实现。
- 动态状态类（`.visible` / `.hidden` / `.active` / `.is-on` / `.confirming` / `.iframe-direct-load` / `.pv-hide-scrollbar`）保留为 `@layer components` 自定义规则，因为 JS 用 `classList.toggle` 控制、且 Tailwind 前缀类不便表达。
- spinner 动画、滚动条样式、`html.pv-forum` 链接视觉提示、`prefers-reduced-motion`、窄屏 `@media` 适配保留为自定义规则。

## 组件类名改造

- 保留功能性 ID（`#popup-content-panel`、`#popup-settings-popover`、`#pv-rules-panel`、`#pv-picker-*`、`#pvk-panel` 等），JS 依赖的查询选择器不变。
- 展示类改为 Tailwind 工具类组合，例如 `.popup-panel-btn` → `pv:flex pv:h-[34px] pv:w-[34px] pv:items-center pv:justify-center pv:rounded-lg pv:bg-btn-bg pv:text-muted hover:pv:bg-btn-hover hover:pv:text-text active:pv:scale-95`。
- 涉及组件：
  - 弹窗面板 `PopupPanel.js`：面板/头部/标题/工具栏按钮/内容区/底部状态栏/遮罩/悬浮按钮
  - 设置面板 `SettingsPanel.js`：分组/开关/分段控件/说明 tip/重置按钮
  - 规则面板 `RulesPanel.js`：头部/列表/删除按钮/取选按钮/toast
  - 取选器 `ElementPicker.js`：遮罩/提示条/高亮框/候选按钮/输入框/确认按钮
  - 加载 `Loading.js` 与错误 `ErrorView.js`
  - PopupKit `KitPopupPanel.js`（`pvk-` 前缀）
- `el()` / `svgIcon()` 工具不变。

## 视觉微调优化

- 统一间距/圆角/字号到 Tailwind 尺度（近似值对齐现有像素，如 54px 头部 → 使用 `h-[54px]` 或相近语义值）。
- 焦点可见态统一 `focus-visible:` 样式，对照现有 `--popup-focus-ring`。
- 深浅主题对比度在现有基础上小幅校准（保持既有值为主，不做大改）。
- 动效沿用现有 `transition` / `cubic-bezier` 曲率。

## 风险与验证

- 最大风险：宿主页面同值类名覆盖 → `important` + 前缀双重防护；宿主页面即便定义了 `.pv\:flex` 这类同名类也极小概率，且 `!important` 保证胜出。
- 验证：
  - `npm run build` 成功产出两个 dist 文件。
  - `npm run dev`（watch）下修改 style.css 能触发重建。
  - 产物 `dist/popup-viewer-v2.user.js` 内 CSS 段包含编译后的 Tailwind 规则（如 `.pv\:flex`）且不含 Preflight reset（无 `*,::before,::after` 全选重置）。
  - 手动验证（可选）：在目标站点打开弹窗，确认样式/主题/动效正常。

## 非目标

- 不改动站点适配器、加载器、安全、存储等核心逻辑。
- 不重做视觉语言（保持现有设计令牌与风格，仅微调）。
- 不引入 Shadow DOM。
