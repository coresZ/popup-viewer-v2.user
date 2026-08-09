# Changelog

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
