# 贡献指南

感谢你对 Popup Viewer V2（页内弹窗打开新帖）的关注！本文档说明如何报告问题、提交代码与文档，以及项目的开发约定。

参与本项目即表示你同意遵守 [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)。开始开发前，请先阅读 [AGENTS.md](AGENTS.md) 与 [docs/development.md](docs/development.md)。

## 目录

- [报告问题](#报告问题)
- [功能建议](#功能建议)
- [开发环境](#开发环境)
- [分支规范](#分支规范)
- [提交规范](#提交规范)
- [代码风格](#代码风格)
- [测试要求](#测试要求)
- [文档贡献](#文档贡献)
- [Pull Request 流程](#pull-request-流程)
- [禁止事项](#禁止事项)
- [许可](#许可)

## 报告问题

1. 先搜索[现有 Issues](https://github.com/coresZ/popup-viewer-v2.user/issues)，确认问题没有被报告过。
2. 使用 [Bug 报告模板](https://github.com/coresZ/popup-viewer-v2.user/issues/new?template=bug_report.yml) 提交，并尽量填写完整：
   - 脚本版本（Tampermonkey 管理面板或脚本头部 `@version`，当前版本为 2.3.6）
   - 浏览器、操作系统、用户脚本管理器及版本
   - 出现问题的网站与页面 URL
   - 最小复现步骤、期望行为、实际行为
   - 控制台报错、截图或录屏（可先在「设置 → 高级 → 调试标记」打开调试标记）
3. 一个 Issue 只描述一个问题，标题请写清现象，不要只写「有 Bug」。
4. **安全漏洞请不要公开提 Issue**，请按 [SECURITY.md](SECURITY.md) 的流程私下报告。

## 功能建议

- 使用 [功能建议模板](https://github.com/coresZ/popup-viewer-v2.user/issues/new?template=feature_request.yml) 提交，说明使用场景、期望行为与可选方案。
- 提交前请确认该功能未在 [README.md](README.md)、[docs/user-guide.md](docs/user-guide.md) 中提供，也没有重复的 Issue。
- 大型功能（新站点适配器、加载器、架构调整）建议先开 Issue 讨论，达成一致后再实现，避免 PR 返工。

## 开发环境

- Node.js ≥ 18（CI 使用 Node 20 与 22）
- npm（仓库包含 `package-lock.json`，推荐使用 `npm ci` 安装依赖）
- Git
- 浏览器 + Tampermonkey（用于手工验证用户脚本）

```bash
git clone https://github.com/coresZ/popup-viewer-v2.user.git
cd popup-viewer-v2.user
npm ci
npm test          # 运行单元测试
npm run build     # 构建 dist/popup-viewer-v2.user.js 与 dist/popup-viewer-kit.js
npm run dev       # 监听模式构建
```

项目使用原生 JavaScript（ES Modules）+ esbuild 打包，无运行时依赖。更多构建、目录结构与架构说明见 [docs/development.md](docs/development.md)。

## 分支规范

- `main` 为默认分支，始终保持可构建、可发布；请勿直接向 `main` 推送。
- 从最新 `main` 创建分支，命名建议：
  - `feat/<简短描述>`：新功能
  - `fix/<简短描述>`：缺陷修复
  - `docs/<简短描述>`：文档
  - `refactor/<简短描述>`、`chore/<简短描述>`：重构与工程配置
- 分支名使用小写英文、数字与连字符，例如 `fix/linux-do-timeout`。

## 提交规范

提交信息使用中文或英文均可，建议采用「类型: 摘要」格式，一行说明改了什么、为什么改：

```text
fix: 修复 linux.do iframe 已显示却被超时错误覆盖
docs: 补充链接规则的常见问题
```

- 类型可用 `feat`、`fix`、`docs`、`refactor`、`perf`、`test`、`build`、`ci`、`chore`。
- 一次提交只做一件事，避免把无关的格式化、重排混入功能提交。
- **代码改动**（`src/**`、`build.mjs` 等）提交前必须递增版本号：同步修改 `package.json` 与 `banner.txt`，并重新执行 `npm run build` 更新 `dist/`；纯文档/配置改动（README、CHANGELOG、`.gitignore` 等）无需递增版本号。
- 按 [AGENTS.md](AGENTS.md) 约定，除非维护者明确要求，不要自行执行 `git commit` / `git push` 等写操作；PR 由贡献者在自己的 fork 中提交。

## 代码风格

- 原生 JavaScript（ES Modules），缩进 2 个空格，语句以分号结尾，字符串优先使用单引号（与现有代码保持一致）。
- 遵循现有目录分层：站点适配器放 `src/adapters/`，加载器放 `src/loaders/`，安全相关放 `src/security/`，UI 放 `src/ui/`，工具函数放 `src/utils/`。
- UI 相关的 DOM id/class 使用 `pv-` / `pvk-` 前缀，样式通过 Shadow DOM 隔离，避免污染宿主页面。
- 用户可见文案使用简体中文；注释解释「为什么」，不要复述代码。
- 不引入运行时依赖；新增开发依赖需先在 Issue 中说明理由。
- 所有文本文件使用 UTF-8、LF 换行，编辑器配置见 [.editorconfig](.editorconfig)。

## 测试要求

- 提交 PR 前必须运行 `npm test`，并确保全部通过。
- 涉及源码或构建的改动，必须运行 `npm run build`，并确认 `dist/` 与源码同步（CI 会执行 `git diff --exit-code -- dist`，产物不一致将失败）。
- 新增或修改纯逻辑模块时，请在 `tests/` 下补充对应的 `*.test.mjs` 单元测试；界面与交互改动请附截图或录屏，并在真实浏览器 + Tampermonkey 中手工验证。
- 不要手工编辑 `dist/` 下的文件，它们由 `build.mjs` 生成。

## 文档贡献

- 文档使用简体中文、GitHub Markdown，H2/H3 分节，表格用于设置项、快捷键等结构化内容。
- 新增或调整文档后，请同步更新 [docs/README.md](docs/README.md) 文档索引。
- 修改用户可见功能时，同步更新 [README.md](README.md)、[docs/user-guide.md](docs/user-guide.md) 与 [CHANGELOG.md](CHANGELOG.md)；开发流程变化同步更新 [docs/development.md](docs/development.md)。
- 文档中的命令、路径、版本号必须与仓库实际内容一致，不允许出现占位符或未实现的功能。

## Pull Request 流程

1. Fork 仓库并从 `main` 创建分支。
2. 按上述规范完成代码/文档改动，运行 `npm test` 与 `npm run build`。
3. 提交 PR，使用 PR 模板填写变更说明、变更类型与测试情况，并关联相关 Issue（如 `Closes #12`）。
4. 确保 CI（Node 20 / 22）全部通过；根据评审意见修改时，在原分支追加提交即可。
5. 合并由维护者完成；合并后请删除已合并的分支。

## 禁止事项

- 禁止提交任何私钥、令牌、密码等敏感信息。项目根目录下的本地 SSH 私钥文件（见 `.gitignore` 中的忽略规则）请勿取消忽略或上传。
- 禁止提交 `node_modules/`、日志、编辑器配置等无关文件（见 [.gitignore](.gitignore)）。
- 禁止手工修改 `dist/` 与 `package-lock.json`（依赖变更请通过 npm 命令重新生成锁文件）。
- 禁止在公开 Issue / PR 中披露未修复的安全漏洞细节，请按 [SECURITY.md](SECURITY.md) 私下报告。
- 禁止提交混淆代码、恶意代码、采集用户数据或与功能无关的第三方脚本。
- 禁止大规模无关格式化、重命名或重构；必要时请单独提交。
- 禁止强制推送受保护分支或修改仓库历史。

## 许可

提交贡献即表示你同意将贡献以 [MIT License](LICENSE) 授权给本项目。
