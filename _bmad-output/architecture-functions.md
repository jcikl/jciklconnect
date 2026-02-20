# 架构文档 — Firebase Cloud Functions (Backend)

## 执行摘要

后端为 **Firebase Cloud Functions**（Node 18、TypeScript），提供 **HTTPS Callable**、**HTTP** 及 **Firestore/PubSub 触发器**，与前端共享同一 Firestore 项目，无独立数据库或 REST 网关。

## 技术栈

| 类别 | 技术 |
|------|------|
| 运行时 | Node.js 18 |
| 语言 | TypeScript 5.9 |
| 框架 | firebase-functions 4.9, firebase-admin 12.7 |

## 架构模式

- **无状态**：每次调用独立；通过 Firestore 与 Admin SDK 访问数据。
- **触发方式**：onRequest（HTTP）、onCall（Callable）、firestore.onDocumentWritten、pubsub.schedule 等。

## API 设计

- 见 **api-contracts-functions.md**（Callable 列表、触发器、调用约定）。

## 数据架构

- 与 App 共用 Firestore；模型见 **data-models-app.md**、**data-models-functions.md**。

## 源码结构

- 见 **source-tree-analysis.md**（functions/ 树）。
- 入口：functions/src/index.ts 导出各模块函数。

## 开发与部署

- 见 **development-guide.md**（functions 脚本：build, serve, deploy）。
- 部署：`firebase deploy --only functions`。

## 相关文档

- [API 契约](./api-contracts-functions.md)
- [数据模型](./data-models-functions.md)
- [集成架构](./integration-architecture.md)
