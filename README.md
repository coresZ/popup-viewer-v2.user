# Popup Viewer V2（页内弹窗打开新帖）

点击论坛/帖子链接，在页面内弹出阅读窗口加载内容，不跳转页面。插件化架构，内置多站点适配器，并支持「规则化统统拦截器」——任意网站都能自己配置要拦截的链接。

## 功能特性

- **弹窗阅读**：拦截页面链接点击，在弹窗中加载内容，支持遮罩/独立悬浮两种驻留方式
- **多站点适配**：内置 Discuz 系、淘股吧、linux.do、磁力站等适配器，开箱即用
- **规则化统统拦截器**：在任意网站「取选」链接即可生成拦截规则，无需写代码/CSS
- **多种加载方式**：自动选择直接 iframe（保留登录态/脚本）或抓取净化渲染（安全沙箱）
- **手机模式**：预置 iPhone / Max / 安卓 / 小屏尺寸，并携带对应移动端 UA 抓取
- **窗体大小预设**：小 / 中 / 大 / 手机，可记忆拖动位置
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
│   └── utils/            # 工具
├── dist/                 # 构建产物（用户脚本）
├── build.mjs             # esbuild 构建脚本
├── banner.txt            # 用户脚本头部（@match/@grant）
└── package.json
```

## 开发

```bash
npm install        # 安装依赖
npm run build      # 构建 → dist/popup-viewer-v2.user.js
npm run dev        # 监听模式构建
```

技术栈：原生 JavaScript（无运行时依赖）· esbuild 打包 · Tampermonkey GM API（`GM_xmlhttpRequest` / `GM_addStyle` / `GM_getValue` / `GM_setValue`，无 GM 时回退 `fetch`/`localStorage`）。

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
