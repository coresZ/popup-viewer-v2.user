# AGENTS.md

## 全局约束

- **禁止自动提交**：除非用户主动明确要求（如「提交」「commit」「push」），不得执行任何 `git commit` / `git push` / `git merge` / `git branch -d` 等写操作。所有变更停留在工作区，待用户确认。
- **代码更新须递增版本号**：涉及代码更新的提交前，先更新版本号（`package.json` + `banner.txt`，随后重新构建 `dist/` 同步）；纯文档/配置类改动（README、CHANGELOG、.gitignore 等）无需递增版本号。

## Repository Map

A full codemap is available at `codemap.md` in the project root.

Before working on any task, read `codemap.md` to understand:
- Project architecture and entry points
- Directory responsibilities and design patterns
- Data flow and integration points between modules

For deep work on a specific folder, also read that folder's `codemap.md`.
