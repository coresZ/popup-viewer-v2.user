# AGENTS.md

## 全局约束

- **禁止自动提交**：除非用户主动明确要求（如「提交」「commit」「push」），不得执行任何 `git commit` / `git push` / `git merge` / `git branch -d` 等写操作。所有变更停留在工作区，待用户确认。
- **每次修改提交必须递增版本号**：任何涉及提交的改动（代码、文档、配置等）前，先更新版本号（`package.json` + `banner.txt`，随后重新构建 `dist/` 同步）。
