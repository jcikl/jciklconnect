# 项目概览 — JCI LO 管理应用

## 项目名称与用途

**JCI LO 管理应用**（jci-kl）为吉隆坡国际青年商会（JCI Kuala Lumpur）的组织官网与管理系统：

- **对外**：使命/愿景/价值观、组织架构、活动、历史、赞助商广告等。
- **管理端**：会员（准/新/旧/校友）、活动与活动财务、组织财务、会员商业目录、爱好、商品、会员福利、赞助广告、活动参与等。

## 仓库类型

**Monorepo**：同一仓库内两个部分

| 部分 | 类型 | 技术 |
|------|------|------|
| App | Web | React 19, Vite 6, TypeScript, Tailwind, Firebase Client |
| Functions | Backend | Node 18, TypeScript, Firebase Cloud Functions |

## 架构类型

- 前端：SPA + 服务层直连 Firestore。
- 后端：无状态 Cloud Functions（Callable + 触发器）。
- 集成：共享 Firebase 项目，见 [integration-architecture.md](./integration-architecture.md)。

## 文档索引

- **主入口**：[index.md](./index.md)
- **架构**：[architecture-app.md](./architecture-app.md)、[architecture-functions.md](./architecture-functions.md)
- **API/数据**：[api-contracts-app.md](./api-contracts-app.md)、[api-contracts-functions.md](./api-contracts-functions.md)、[data-models-app.md](./data-models-app.md)、[data-models-functions.md](./data-models-functions.md)
- **开发**：[development-guide.md](./development-guide.md)、[source-tree-analysis.md](./source-tree-analysis.md)
- **集成**：[integration-architecture.md](./integration-architecture.md)

## 现有项目文档（docs/）

- docs/README.md — 平台概述与安装
- docs/architecture/README.md — 系统架构
- docs/development/README.md — 开发
- docs/api/README.md — API
- docs/user-guide/README.md — 用户指南
