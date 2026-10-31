## 变更说明

<!-- 请简要说明这个 PR 做了什么、为什么需要 -->

## 关联 Issue

<!-- 如：Closes #12；没有关联 Issue 可写「无」 -->

## 变更类型

- [ ] 缺陷修复（fix）
- [ ] 新功能（feat）
- [ ] 重构 / 性能优化（refactor / perf）
- [ ] 文档（docs）
- [ ] 构建 / CI / 工程配置（build / ci / chore）
- [ ] 其他（请在下方说明）

## 测试情况

- [ ] 已运行 `npm test`，全部通过
- [ ] 已运行 `npm run build`，`dist/` 与源码同步（CI 会执行 `git diff --exit-code -- dist` 校验）
- [ ] 已在真实浏览器 + Tampermonkey 中手工验证（请注明浏览器/版本与测试站点）
- [ ] 涉及界面改动，已附截图或录屏

手工验证说明：

## 检查清单

- [ ] 变更范围聚焦，未包含无关格式化或重排
- [ ] 代码符合 [CONTRIBUTING.md](https://github.com/coresZ/popup-viewer-v2.user/blob/main/CONTRIBUTING.md) 与 [.editorconfig](https://github.com/coresZ/popup-viewer-v2.user/blob/main/.editorconfig) 的约定
- [ ] 涉及代码改动时，已递增版本号（`package.json` + `banner.txt`）并重新构建 `dist/`
- [ ] 纯文档 / 配置改动未递增版本号
- [ ] 未手工修改 `dist/`，未提交 `node_modules/`、私钥或其他敏感信息
- [ ] 文档已同步更新（README / docs / CHANGELOG，如适用）
- [ ] 未在公开 PR 中披露未修复的安全漏洞（见 [SECURITY.md](https://github.com/coresZ/popup-viewer-v2.user/blob/main/SECURITY.md)）
