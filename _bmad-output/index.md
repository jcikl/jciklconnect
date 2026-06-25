# JCI LO 管理应用 — 项目文档索引

👆 **AI 辅助开发的主入口**：本目录为棕地项目文档化工作流生成的索引与产出。

---

## 项目概览

- **类型**：Monorepo（App Web + Functions Backend）
- **主要语言**：TypeScript
- **架构**：React SPA + Firebase（Firestore, Auth, Cloud Functions）

详见：[Project Overview](./project-overview.md)

---

## 快速参考

### App (Web)

- **技术栈**：React 19, Vite 6, Tailwind, Firebase Client
- **入口**：index.html → index.tsx → App.tsx
- **架构模式**：组件分层 + 服务层直连 Firestore

### Functions (Backend)

- **技术栈**：Node 18, TypeScript, Firebase Functions
- **根路径**：`functions/`
- **架构模式**：无状态 Callable + Firestore/PubSub 触发器

---

## 生成文档列表

| 文档 | 说明 |
|------|------|
| [Project Overview](./project-overview.md) | 项目名称、用途、仓库类型、文档索引 |
| [Architecture — App](./architecture-app.md) | 前端架构、技术栈、数据与入口 |
| [Architecture — Functions](./architecture-functions.md) | 后端架构、API 与触发器 |
| [Source Tree Analysis](./source-tree-analysis.md) | 源码树与关键目录 |
| [API Contracts — App](./api-contracts-app.md) | 前端数据访问与集合 |
| [API Contracts — Functions](./api-contracts-functions.md) | Cloud Functions 接口与触发器 |
| [Data Models — App](./data-models-app.md) | 前端领域模型与 Firestore 对应 |
| [Data Models — Functions](./data-models-functions.md) | 后端涉及集合与数据 |
| [Integration Architecture](./integration-architecture.md) | App 与 Functions 集成与数据流 |
| [Component Inventory](./component-inventory.md) | 前端组件清单 |
| [Development Guide](./development-guide.md) | 环境、脚本、测试与规范 |
| [UX Design Specification](./ux-design-specification.md) | UX 设计规格（2025-02-16 完成） |
| [Wireframe Specification](./wireframe-specification.md) | 线框图规格 |
| [Architecture-UX Alignment](./architecture-ux-alignment.md) | 架构与 UX 对齐检查 |
| [Implementation Readiness Report](./implementation-readiness-report-2025-02-16.md) | 实施就绪评估（含 UX 对齐） |
| [Accessibility Checklist WCAG AA](./accessibility-checklist-wcag-aa.md) | 无障碍验收清单 |
| [Keyboard Testing Checklist](./keyboard-testing-checklist.md) | 键盘测试清单 |

**可交互与视觉产出：**
- [ux-design-directions.html](./ux-design-directions.html) — 设计方向展示
- [ux-interactive-prototype.html](./ux-interactive-prototype.html) — 可点击原型（付款申请、选会员即带出、对账）

---

## 现有项目文档（docs/）

- [docs/README.md](../docs/README.md) — 平台概述与安装
- [docs/architecture/README.md](../docs/architecture/README.md) — 系统架构
- [docs/development/README.md](../docs/development/README.md) — 开发
- [docs/api/README.md](../docs/api/README.md) — API
- [docs/user-guide/README.md](../docs/user-guide/README.md) — 用户指南

---

## 快速开始

1. 安装依赖：根目录与 `functions/` 各执行 `npm install`。
2. 配置 Firebase 与环境变量（.env / Firebase 配置）。
3. 前端：`npm run dev`；Functions：`cd functions && npm run build && npm run serve`。
4. 详细步骤见 [Development Guide](./development-guide.md)。

---

## 棕地 PRD 与后续规划

- 撰写或更新 PRD 时，可将本 **index.md** 或 `_bmad-output/` 作为上下文输入。
- UI 功能可参考 [architecture-app.md](./architecture-app.md) 与 [component-inventory.md](./component-inventory.md)。
- 全栈功能可参考 App + Functions 架构与 [integration-architecture.md](./integration-architecture.md)。
