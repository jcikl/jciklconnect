# API 契约 — Firebase Cloud Functions (Backend)

## 概述

后端为 **Firebase Cloud Functions**（Node 18, TypeScript），提供 **HTTPS Callable** 与 **HTTP** 接口，以及 **Firestore/PubSub 触发器**。

## HTTPS 接口

### HTTP Request (REST)

| 函数名 | 路径/用途 | 说明 |
|--------|-----------|------|
| healthCheck | onRequest | 健康检查 |

### Callable (onCall) — 由前端 `httpsCallable()` 调用

| 函数名 | 文件 | 用途 |
|--------|------|------|
| sendNotification | notifications.ts | 发送单条通知 |
| sendBulkNotifications | notifications.ts | 批量发送通知 |
| markNotificationRead | notifications.ts | 标记通知已读 |
| castVote | governance.ts | 投票 |
| calculateVoteResults | governance.ts | 计算投票结果 |
| castElectionBallot | governance.ts | 选举投票 |
| calculateElectionResults | governance.ts | 计算选举结果 |
| calculatePointsFromRules | gamification.ts | 按规则计算积分 |
| executeWorkflow | automation.ts | 执行工作流 |
| generateFinancialReport | financial.ts | 生成财务报表 |
| performBankReconciliation | financial.ts | 银行对账 |
| generateDuesRenewal | membership.ts | 生成会费续费 |

## 触发器（无直接 HTTP 入口）

| 函数名 | 类型 | 文件 | 触发条件 |
|--------|------|------|----------|
| sendDuesRenewalReminders | pubsub | notifications.ts | 定时 |
| sendEventReminders | pubsub | notifications.ts | 定时 |
| checkBadgeAwards | firestore | gamification.ts | 文档变更 |
| updateAchievementProgress | firestore | gamification.ts | 文档变更 |
| evaluateAutomationRules | firestore | automation.ts | 文档变更 |
| validateTransactionSplits | firestore | financial.ts | 文档变更 |
| checkMemberPromotion | firestore | membership.ts | 文档变更 |

## 调用约定

- **onCall**：前端使用 `getFunctions().httpsCallable('functionName')(data)`，参数与返回见各函数实现。
- **onRequest**：标准 HTTP，如 `healthCheck` 用于存活探测。

## 认证

- Callable 与 Request 可通过 `context.auth` 获取当前用户；需在安全规则与函数内做权限校验。
