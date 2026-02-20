# 架构文档 — App (Web)

## 执行摘要

JCI LO 管理应用前端为 **React 19 SPA**，使用 **Vite 6** 构建、**TypeScript** 编写，通过 **Firebase 客户端 SDK** 直接访问 Firestore、Auth、Storage。采用分层与组件化架构，无独立 REST 后端；复杂逻辑由 Cloud Functions 提供。

## 技术栈

| 类别 | 技术 |
|------|------|
| 语言 | TypeScript 5.8 |
| 框架 | React 19 |
| 构建/开发 | Vite 6 |
| 路由 | React Router 7 |
| 样式 | Tailwind CSS 3.4 |
| 数据/后端 | Firebase (Firestore, Auth, Storage) |
| 测试 | Vitest 4 |

## 架构模式

- **前端**：组件分层（ui / modules / dashboard / auth）+ 服务层（services/）封装 Firestore 与业务逻辑。
- **数据**：直连 Firestore；类型与校验在 types.ts + 服务层。
- **状态**：以 React 组件状态与 Firestore 实时数据为主；无全局 Redux 等（具体见代码）。

## 数据架构

- 见 **data-models-app.md**；集合与 types.ts 对应。
- 认证与权限见 **api-contracts-app.md**（Firebase Auth + UserRole）。

## 源码结构与入口

- 见 **source-tree-analysis.md**。
- 入口：index.html → index.tsx → App.tsx；路径别名 `@/*`。

## 开发与部署

- 见 **development-guide.md**。
- 部署：静态构建产物部署至 Hosting/CDN；环境变量与 Firebase 配置需在构建/运行环境中设置。

## 相关文档

- [API/数据访问](./api-contracts-app.md)
- [数据模型](./data-models-app.md)
- [源码树](./source-tree-analysis.md)
- [集成架构](./integration-architecture.md)
