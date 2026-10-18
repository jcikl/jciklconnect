# CLAUDE.md 改版迁移对照（2026-10）

旧版 609 行 → 新版 180 行。没有任何规则被丢弃，只是换了位置；唯一删除的是「顺手改进规则」。

| 旧版章节（行号） | 去向 | 说明 |
|---|---|---|
| Memory File Protocol（5–12） | CLAUDE.md §7 | 保留 |
| Commands（14–25） | CLAUDE.md §1 | 保留 |
| Architecture Overview（27–100） | CLAUDE.md §1、§5.1、§6.1；细节以 `ARCHITECTURE.md` 为准 | 修正过时描述：`workflowExecutionService` 不存在；`types.ts` 已拆分到 `types/`；UI 元件清单改指向 CAPABILITIES §5，避免再次过时 |
| Skill & Tool Discovery（102–150） | `docs/development/DECISION_PROTOCOLS.md` | 原文搬移 |
| Library vs Self-Build（152–184） | `docs/development/DECISION_PROTOCOLS.md` | 原文搬移 |
| UI Component & Data Layer（186–245） | CLAUDE.md §4、§5.2、§5.4；完整版在 `docs/development/LAYER_RULES.md` | **删除「Iterative improvement rule」**：与外科手术式修改冲突 |
| Collection Analysis Framework（247–396） | `docs/collections/ANALYSIS_FRAMEWORK.md` | 原文搬移，只更新两处路径 |
| 已分析集合（398–547） | `docs/collections/ANALYSIS_LOG.md` | 原文搬移；以后分析结果只追加到这里 |
| CRUD 前置检查（549–603） | CLAUDE.md §5.3 摘要；完整版在 `docs/development/CRUD_CHECKLIST.md` | 原文搬移 |
| Firestore 权限规则注意事项（605–609） | CLAUDE.md §5.3 | 保留（高价值、短） |
| （新增） | CLAUDE.md §2 行为规范、§3 任务流程、§4 复用闸门、§6 文件索引 | Karpathy 四原则 + 复用优先 |
