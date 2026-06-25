# 数据模型 — Firebase Cloud Functions (Backend)

## 概述

Functions 与 **App** 共享同一 Firestore 项目，无独立数据库。读写的数据模型与 **data-models-app.md** 及 **types.ts** 一致；此处仅说明后端触发的集合与用途。

## 触发器涉及的集合/数据

| 功能 | 文件 | 涉及数据 |
|------|------|----------|
| checkBadgeAwards | gamification.ts | 徽章/成就相关文档变更 |
| updateAchievementProgress | gamification.ts | 成就进度相关文档 |
| evaluateAutomationRules | automation.ts | 工作流/规则相关文档 |
| validateTransactionSplits | financial.ts | transactionSplits, transactions |
| checkMemberPromotion | membership.ts | members（晋升逻辑） |

## Callable 输入/输出

- 输入/输出形状未在仓库中集中定义为 OpenAPI；具体见各 `onCall` 函数实现。
- 财务报表、对账、会费续费等返回结构由 financial/membership 模块定义。

## 说明

- 数据模型定义以 **types.ts** 与 **data-models-app.md** 为准；Functions 仅消费与更新同一 Firestore 数据。
