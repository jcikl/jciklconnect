---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8]
status: complete
completedAt: '2025-02-16'
inputDocuments:
  - _bmad-output/prd.md
  - _bmad-output/index.md
  - _bmad-output/project-overview.md
workflowType: 'architecture'
lastStep: 8
project_name: 'JCI LO 管理应用'
user_name: 'User'
date: '2025-02-16'
---

# Architecture Decision Document

_This document builds collaboratively through step-by-step discovery. Sections are appended as we work through each architectural decision together._

---

## Project Context Analysis

### Requirements Overview

**Functional Requirements:**

PRD 定义 37 条功能需求（FR1–FR37），按能力域组织为 8 类，对架构的涵义如下：

- **会员主档与数据（FR1–FR6）**：主档为单一数据源；需「选会员即带出」在至少两个场景（如活动报名、付款申请）落地；管理员/组织秘书全量维护、会员仅本人；Growth 阶段含导出与迁移。架构需：主档集合与索引、带出 API/查询、迁移与清洗入口。
- **付款申请与工作流（FR7–FR12）**：申请提交、唯一参考编号、列表与去重提示、状态查询与审核、活动财政仅见本活动。架构需：付款申请集合、编号生成/存储、按角色/活动过滤的查询与安全规则。
- **编号与对账（FR13–FR17）**：唯一参考编号贯穿流水与业务记录；组织财政/活动财政按编号勾稽；Growth 含分类/拆分与多户口。架构需：编号格式与存储、流水与业务记录的关联模型、对账查询与可选半自动匹配。
- **权限与可见性（FR18–FR22）**：组织财政 vs 活动财政 vs 会员 vs 管理员/组织秘书的边界明确；多 LO 启用后须租户上下文（LO/Area/Country）。架构需：角色与租户模型、Firestore 安全规则按角色与 loId/areaId/countryId 限制。
- **活动与参与（FR23–FR28）**：活动场景下主档带出、名单与缴费/签到一致（Growth）、参与与筹委经历写回主档（Growth）。架构需：活动与参与集合、与主档/流水的关联、事件流或一致写。
- **会费与状态联动（FR29–FR31，Growth）**：会费状态计算与展示、会员可查、财政可导出。架构需：会费与状态数据模型、与主档/流水的联动。
- **新流程采纳与引导（FR32–FR35）**：宣导、首次使用引导、文档与交接。架构需：引导/帮助入口、可配置说明或链接。
- **数据与迁移（FR36–FR37）**：迁移范围与验收、半自动对账。架构需：迁移脚本/流程、对账匹配逻辑的可扩展点。

**Non-Functional Requirements:**

- **Performance（NFR-P1–P3）**：关键操作 3 秒内可感知、对账查询 ≤5 秒、≥5 并发用户无阻塞。驱动：分页/懒加载、索引与查询优化、避免 N+1。
- **Security（NFR-S1–S4）**：TLS、敏感字段保护、角色访问控制、多 LO 租户校验、审计与保留策略。驱动：Firestore 规则、Auth 与角色、审计字段/日志。
- **Accessibility（NFR-A1–A2）**：核心流程 WCAG 2.1 AA、明确成功/失败反馈。驱动：前端组件与表单可访问性、不依赖颜色传达状态。
- **Integration（NFR-I1–I3）**：Firestore/Auth 数据模型与规则开发前确认；多 LO 时规则按 loId/areaId/countryId；银行流水人工/粘贴为主、导出与迁移约定格式。驱动：集合与规则设计、导出 API/格式。
- **Reliability（NFR-R1–R3）**：可用率目标、数据持久性与成功确认定义、可观测性（correlation id/审计 ID）。驱动：写入确认与 UI 更新顺序、审计与排障字段。
- **Scalability（NFR-SC1–SC3）**：预留多 LO：Country→Area→LO；数据模型与 API 支持 countryId/areaId/loId 隔离与安全规则。驱动：从 MVP 起数据模型含租户维度、规则与查询可按 LO 隔离。

**Scale & Complexity:**

- **Primary domain:** Full-stack Web（React SPA + Firebase/Firestore + Cloud Functions）
- **Complexity level:** 中高 — 多模块联动、工作流与权限、多租户预留、棕地扩展
- **Architectural components (estimated):** 会员主档与带出、付款申请与工作流、编号与对账、权限与多 LO 隔离、活动与参与、会费与状态、审计与可观测、迁移与导出

### Technical Constraints & Dependencies

- **技术栈（棕地）**：React 19, Vite 6, TypeScript, Tailwind, Firebase Client（App）；Node 18, TypeScript, Firebase Cloud Functions（Backend）；SPA 直连 Firestore，Functions 为 Callable + 触发器。
- **PRD 约束**：与现有 Firestore 集合及 Auth 规则兼容与扩展须在架构中约定；不破坏现有关键流程；多 LO 扩展时数据模型与规则须支持租户隔离。
- **试点策略**：先在一个 LO 或该 LO 内少量活动跑通，数据模型与规则从第一天起预留 countryId/areaId/loId，避免日后大规模重构。
- **依赖**：Firebase 项目（Firestore、Auth）、现有文档（architecture-app、architecture-functions、data-models、api-contracts）为扩展基线。

### Cross-Cutting Concerns Identified

- **权限与可见性**：组织财政 / 活动财政 / 会员 / 管理员·组织秘书 的边界贯穿主档、付款申请、流水、活动；多 LO 时叠加租户上下文。影响：安全规则、查询过滤、UI 条件渲染。
- **唯一参考编号**：贯穿付款申请、流水、活动/会费/商品，支撑对账与勾稽。影响：编号生成策略、存储字段、查询与索引。
- **主档单一来源与带出**：多处场景「选会员即带出」，主档为权威数据。影响：主档集合设计、带出 API 或查询复用、一致性。
- **审计与可观测性**：付款申请、主档关键更新、对账操作可追溯。影响：文档字段（如 updatedBy/updatedAt）、可选 correlation id、日志策略。
- **多 LO 预留**：MVP 可单 LO，但数据模型与规则须支持 Country/Area/LO 隔离。影响：集合 schema、安全规则、未来 API 与索引扩展。

---

## Starter Template Evaluation

### Primary Technology Domain

Full-stack Web（棕地）：现有 React SPA + Firebase（Firestore, Auth, Cloud Functions）。架构决策在现有技术栈上扩展，不更换框架或引入新 scaffold。

### Starter Options Considered

- **新 Vite/React starter**：不采用；项目已有 React 19 + Vite 6 + Tailwind 与成熟目录结构，新 starter 会与现有代码冲突。
- **现有代码库（棕地基线）**：采用。以当前 Monorepo（App + Functions）、现有集合与 Auth 为唯一基础，PRD 能力通过新增/扩展集合、安全规则与模块实现。

### Selected Starter: Existing codebase (brownfield baseline)

**Rationale for Selection:**

- PRD 与 Project Context 均按棕地增强定义；技术约束明确为「与现有 Firestore/Auth 兼容与扩展」。
- 现有栈（React 19, Vite 6, TypeScript, Tailwind, Firebase, Vitest）已满足 NFR 与开发体验需求；无需通过新 starter 引入额外技术选型。
- 架构工作重点为：数据模型与安全规则扩展、多 LO 预留（countryId/areaId/loId）、主档/付款申请/对账等新能力在现有 App 与 Functions 中的落点。
- **架构原则**：所有 PRD 新能力均在现有 Monorepo（App + Functions）内以扩展方式实现，不新增独立应用或仓库。

**Initialization Command:**

不适用 — 无新项目初始化。后续实施首项应为「在现有 repo 中实现首个 PRD 能力（如主档带出或付款申请集合/规则）」，而非运行任何 create-* 命令。

**Architectural Decisions Provided by Baseline:**

- **Language & Runtime:** TypeScript（App + Functions）；React 19 + Vite 6（App）；Node 18（Functions）。
- **Styling:** Tailwind；现有组件与布局沿用。
- **Build & Tooling:** Vite 6（App）；Firebase build（Functions）；无新增构建工具。
- **Testing:** Vitest（已存在）；新模块按现有模式补测试。
- **Code Organization:** 现有组件分层 + 服务层直连 Firestore；新能力按领域（会员主档、付款申请、对账等）增加模块/服务与集合。新模块沿用现有目录与命名约定（如 `components/`、`services/`、`functions/` 下按领域划分子目录）；可参考 `architecture-app.md`、`source-tree-analysis.md` 与现有服务层模式。
- **Development Experience:** 现有 `npm run dev` / Functions 本地与部署流程不变；环境与 Firebase 配置沿用。

**Note:** 首条实施 Story 须在**现有代码库与部署环境**内交付某一 PRD 能力（如主档带出或付款申请 MVP），验收在现有产品上进行，不依赖新 scaffold 或新仓库。

---

## Core Architectural Decisions

### Decision Priority Analysis

**Already Decided (Baseline / Starter):**

- 数据库：Firestore；客户端直连 + Cloud Functions 读写。
- 认证：Firebase Auth；授权与角色在应用层与安全规则中实现。
- 前端：React 19, Vite 6, TypeScript, Tailwind；组件分层 + 服务层。
- 后端：Node 18, Firebase Cloud Functions（Callable + 触发器）。
- 部署：Firebase Hosting（App）+ Firebase Functions；环境与配置沿用现有。

**Critical Decisions (Block Implementation):**

- 会员主档与现有 `members` 集合的关系：扩展 `members` 为主档权威来源，新增/约定「主档带出」所需字段与索引；不新增独立主档集合，避免双源。
- 付款申请：新增集合（建议 `paymentRequests` 或与现有命名一致如 `payment_requests`），字段含：申请人、活动/用途、金额、唯一参考编号、状态、审核人/时间、及租户维度（见下）。
- 唯一参考编号：格式与存储策略（如 `{loId}-{type}-{yyyyMMdd}-{seq}` 或组织内约定）；在付款申请、流水、活动/会费/商品等文档中统一字段名（如 `referenceNumber`），便于对账与勾稽。
- 多 LO 预留：在需隔离的集合（如 `members`、`paymentRequests`、活动、流水）文档中增加 `loId`（必填）；可选 `areaId`、`countryId`。安全规则与查询从第一天起按 `loId` 过滤；MVP 可单 LO，单值时仍带该字段。
- Firestore 安全规则：扩展现有规则，使组织财政可读组织级数据、活动财政仅可读本活动相关数据、会员仅本人；多 LO 时在规则中校验 `request.auth` 与文档的 `loId`（及可选 areaId/countryId）一致。

**Important Decisions (Shape Architecture):**

- 对账与流水：沿用现有 `transactions` / `transactionSplits` / `reconciliations`；新增或扩展字段以承载 `referenceNumber` 及与付款申请/活动/会费的关联；对账查询支持按编号与时间范围筛选。
- 审计与可观测：关键文档（付款申请、主档关键字段更新）含 `updatedBy`、`updatedAt`；可选 `correlationId` 或审计日志集合；保留策略在实施/运维规范中约定。
- 状态与去重：付款申请状态机（如 draft / submitted / approved / rejected）；去重提示基于业务规则（同一活动+金额+申请人+时间窗）在查询或 UI 层实现，可不持久化去重记录。

**Deferred (Post-MVP):**

- 多币种、复杂审批链、银行 API 实时对接、公开页 SEO、全量离线能力；按 PRD Growth/Vision 再议。

### Data Architecture

- **主档**：以现有 `members` 集合为会员主档单一来源；新增/约定带出所需字段与复合索引（如按 loId + 姓名/届别查询）；迁移与清洗入口在实施计划中约定。
- **付款申请**：新集合 `paymentRequests`（或 `payment_requests`）；必填：applicantId, amount, purpose/activityRef, referenceNumber, status, loId；可选：areaId, countryId, reviewedBy, reviewedAt, createdAt, updatedAt, updatedBy。
- **流水与对账**：沿用 `transactions`、`transactionSplits`、`reconciliations`；扩展 `referenceNumber` 及与 paymentRequests/events/dues 的关联；索引支持按 loId + referenceNumber、loId + 时间范围查询。
- **多 LO 模型**：需隔离的文档含 `loId`（必填）；可选 `areaId`、`countryId`。MVP 单 LO 时仍写入当前 LO 的 id，便于日后扩展。

### Authentication & Security

- **认证**：Firebase Auth（已定）；无新增 IdP。
- **授权**：角色（组织财政、活动财政、会员、管理员、组织秘书）与文档/查询可见性一致；多 LO 时校验 `request.auth` 的租户上下文与文档 `loId` 匹配。
- **Firestore 规则**：在开发前与数据模型一并确认；读/写规则按角色 + loId（及可选 areaId/countryId）限制；禁止跨 LO 访问。

### API & Communication

- **App ↔ Firestore**：现有服务层直连 Firestore；新能力在 `services/` 下新增或扩展（如 `paymentRequestService`、主档带出复用 `membersService`）。
- **App ↔ Functions**：现有 Callable 模式保留；编号生成、批量对账等若需服务端逻辑则经 Callable 调用。
- **错误与反馈**：关键操作返回明确成功/失败；敏感错误不向前端暴露内部细节；审计与排障依赖服务端日志与文档审计字段。

### Frontend Architecture

- **状态**：沿用现有模式（组件状态 + 服务层读 Firestore）；付款申请列表、对账视图等使用分页或懒加载，满足 NFR-P1/P2。
- **新模块**：会员主档带出、付款申请、对账相关 UI 置于现有路由与布局下；新组件/页符合现有目录约定与可访问性要求（NFR-A1/A2）。

### Infrastructure & Deployment

- **托管**：Firebase Hosting + Functions（已定）；无新增基础设施。
- **环境**：沿用现有 .env 与 Firebase 配置；多 LO 时可通过配置或 Auth 声明注入当前 loId。
- **可观测**：依赖 Firebase 控制台与现有日志；关键操作具备可追踪标识（NFR-R3），便于排障与审计。

### Decision Impact Analysis

- **实施顺序建议**：① 数据模型与安全规则扩展（members 主档字段与索引、paymentRequests 集合、loId 及 referenceNumber 约定）→ ② 付款申请 MVP（提交、列表、状态、审核）→ ③ 主档带出（至少 2 个场景）→ ④ 对账与编号勾稽。
- **跨组件依赖**：主档带出依赖 members 与权限；付款申请依赖 paymentRequests、referenceNumber 生成与规则；对账依赖 transactions/transactionSplits 与 referenceNumber 关联；权限与多 LO 影响所有上述集合的规则与查询。

---

## Implementation Patterns & Consistency Rules

以下规则确保在现有代码库上扩展时，不同实现角色（或 AI agent）在命名、结构、格式与流程上一致，避免冲突。

### Naming Conventions

- **Firestore 集合**：与现有风格一致；新集合使用 camelCase（如 `paymentRequests`）或与现有 `members`、`transactions` 一致；文档 ID 使用 Firestore 自动 ID 或约定业务 ID，不在同一集合内混用多种 ID 策略。
- **文档字段**：camelCase；多 LO 必填字段 `loId`，可选 `areaId`、`countryId`；参考编号统一字段名 `referenceNumber`；审计字段 `createdAt`、`updatedAt`、`createdBy`、`updatedBy`（或与现有项目已有约定一致）。
- **服务与模块**：`services/` 下按领域命名（如 `paymentRequestService.ts`、现有 `membersService.ts`）；函数与组件名 PascalCase/camelCase 与现有代码风格一致。
- **路由与组件**：新页面/路由与现有 `App.tsx` 路由风格一致；组件文件与目录沿用现有约定（见 `source-tree-analysis.md`）。

### Structure & Organization

- **新功能模块**：在 `components/`、`services/` 下按领域划分子目录或前缀，不散落单文件；与付款申请、主档带出、对账相关的 UI 与逻辑集中放置，便于查找与权限收敛。
- **测试**：新代码沿用现有 Vitest 位置与命名（与现有 test 结构一致）；关键路径（付款申请、主档带出、对账）需有可自动化验证的测试或明确验收条件。
- **配置与常量**：环境变量与 Firebase 配置沿用现有方式；多 LO 的当前 `loId` 来源（Auth 声明或配置）在架构与实现中统一约定，不在多处硬编码。

### Data & API Consistency

- **日期时间**：存储与 API 使用 ISO 8601 或 Firestore Timestamp；展示层使用现有 date 库（如 date-fns）与全局日期配置（若存在）。
- **错误与加载**：异步操作提供 loading/disabled 状态与明确成功/失败反馈（符合 NFR-A2）；错误信息对用户简洁、对日志可追踪；不向前端暴露敏感内部细节。
- **列表与分页**：列表类界面使用分页或懒加载，单页大小与现有表格/列表约定一致；查询带 `limit` 与合理索引，满足 NFR-P1/P2。

### Security & Access Patterns

- **权限校验**：服务层与 UI 均按角色与（多 LO 时）租户上下文校验；禁止仅靠前端隐藏按钮实现权限，须有 Firestore 规则或服务端校验兜底。
- **审计**：付款申请、主档关键更新等写操作写入 `updatedBy`、`updatedAt`（及可选 correlation id）；日志不记录密码或支付凭证。

### Process Conventions

- **主档带出**：从 `members` 按权限查询；带出字段列表在配置或常量中统一维护，不在多处硬编码字段名。
- **唯一参考编号**：生成逻辑集中（如单一 service 或 Callable）；格式与存储约定见 Core Architectural Decisions，全库统一 `referenceNumber` 字段名与格式。
- **多 LO**：所有需隔离的读写均带 `loId`（及可选 areaId/countryId）；安全规则与查询从第一天起按租户过滤，MVP 单 LO 时仍写入当前 LO 的 id。

---

## Project Structure & Boundaries

### Requirements to Structure Mapping

| FR 能力域 | App 组件/视图 | 服务层 | Firestore 集合 | Functions（若需） |
|-----------|----------------|--------|----------------|-------------------|
| 会员主档与数据（FR1–FR6） | components/modules/（Members 及相关）、主档带出选择器/表单 | membersService（扩展）、现有 members 查询 | members（扩展字段与索引） | 迁移/清洗可经 Callable 或脚本 |
| 付款申请与工作流（FR7–FR12） | components/modules/ 下付款申请列表、提交、审核视图 | paymentRequestService（新建） | paymentRequests（新建） | 编号生成或审批通知可经 Callable |
| 编号与对账（FR13–FR17） | components/modules/Finance 或对账相关视图 | financeService（扩展）、paymentRequestService | transactions, transactionSplits, reconciliations, paymentRequests | financial.ts（扩展对账/编号） |
| 权限与可见性（FR18–FR22） | 各模块内条件渲染、路由守卫 | 各 service 按角色/loId 过滤 | 所有相关集合；安全规则 | — |
| 活动与参与（FR23–FR28） | components/modules/Events 及相关 | eventsService（扩展）、membersService | events、members、参与相关子集 | — |
| 会费与状态（FR29–FR31） | 会员/财务相关视图 | membersService、financeService、duesRenewalService | members、transactions | membership.ts |
| 新流程采纳与引导（FR32–FR35） | 引导条、帮助入口、文档链接（可在 ui/ 或各模块） | — | 可配置文案或链接（可选集合） | — |
| 数据与迁移（FR36–FR37） | 管理/设置或独立工具视图 | dataImportExportService（扩展）、financeService | 各集合 | Callable 或脚本 |

### Complete Project Directory Structure (Relevant to PRD Extensions)

以下为与 PRD 扩展相关的目录与新增/扩展点；完整树见 `_bmad-output/source-tree-analysis.md`。

**App（项目根）**

```
project-root/
├── App.tsx                    # 路由：新增付款申请、对账相关路由
├── components/
│   ├── modules/               # 业务模块
│   │   ├── MembersView.tsx    # 主档维护、带出入口（扩展）
│   │   ├── FinanceView.tsx    # 组织财政；扩展：付款申请列表、对账、编号勾稽
│   │   ├── Finance/           # 财务子组件（TransactionSplitModal 等）；扩展：付款申请表单、审核、对账视图
│   │   └── ...                # 其他现有模块
│   └── ui/                    # 通用 UI：表单、表格、分页、加载、错误（主档带出选择器可放此或 modules 内）
├── services/
│   ├── membersService.ts      # 主档 CRUD、带出查询（扩展 loId/字段）
│   ├── financeService.ts      # 流水、对账、reconciliations（扩展 referenceNumber、关联 paymentRequests）
│   ├── paymentRequestService.ts  # 【新建】付款申请 CRUD、列表、状态、按 loId/活动过滤
│   └── ...                    # 其他现有 services
├── config/                    # 全局配置：主档带出字段列表、编号格式常量（若集中配置）
├── types.ts                   # 扩展：PaymentRequest、referenceNumber、loId/areaId/countryId 类型
└── _bmad-output/
```

**Functions**

```
functions/
├── src/
│   ├── index.ts               # 导出；新增 Callable 若需（如 generateReferenceNumber）
│   ├── financial.ts            # 扩展：对账、编号关联、报表（与 paymentRequests/transactions 联动）
│   └── membership.ts           # 会费、晋升（现有）；迁移/清洗可在此或独立脚本
└── lib/
```

### Integration Boundaries

- **App ↔ Firestore**：所有读写经 `services/`；付款申请、主档、流水/对账均通过对应 service，禁止在组件内直接写 `getDocs`/`setDoc` 等。
- **App ↔ Functions**：仅通过 Callable 或 HTTP 约定；编号生成、批量对账等若在服务端实现则经 Callable，参数与返回格式在 api-contracts 或本架构文档中约定。
- **权限边界**：UI 按角色与 loId 显示/隐藏；Firestore 规则强制按角色 + loId 限制读写；敏感操作（审批、主档批量更新）须有规则或 Callable 校验。
- **数据边界**：`members` 为主档唯一权威来源；`paymentRequests` 与 `transactions`/`transactionSplits` 通过 `referenceNumber` 与业务关联；多 LO 数据仅通过 `loId`（及 areaId/countryId）隔离，不跨租户查询。

---

## Architecture Validation Results

### Coherence Validation

- **Decision compatibility**：技术栈（React 19, Vite 6, Firestore, Functions）与棕地基线一致；数据架构（members 主档、paymentRequests、referenceNumber、loId）与安全规则、多 LO 预留一致；无冲突版本或选型。
- **Pattern consistency**：命名（camelCase、referenceNumber、loId）、审计字段、权限与多 LO 约定在 Core Decisions 与 Implementation Patterns 中一致；服务层边界与 Project Structure 映射一致。
- **Structure alignment**：FR 能力域已映射到 components/modules、services、集合与 Functions；新增 paymentRequestService 与扩展 financeService/membersService 与目录约定一致；集成边界（App↔Firestore、App↔Functions、权限与数据隔离）已定义。

### Requirements Coverage

- **FR 覆盖**：会员主档与数据（FR1–FR6）→ members 扩展与带出、membersService；付款申请与工作流（FR7–FR12）→ paymentRequests、paymentRequestService、规则与审核；编号与对账（FR13–FR17）→ referenceNumber、financeService、financial.ts；权限与可见性（FR18–FR22）→ 规则与 loId；活动/会费/采纳/迁移（FR23–FR37）→ 已映射到现有或扩展模块与服务。
- **NFR 覆盖**：Performance（分页、索引、NFR-P1–P3）在 Data Architecture 与 Patterns 中约定；Security（规则、租户、审计 NFR-S1–S4）在 Decisions 与 Patterns 中约定；Scalability（多 LO、NFR-SC1–SC3）在数据模型与规则中预留；Accessibility、Integration、Reliability 在 Decisions 与 Patterns 中有对应约束。

### Implementation Readiness

- **决策与模式**：关键决策（集合、字段、规则策略、实施顺序）已记录；Implementation Patterns 覆盖命名、结构、数据与 API、安全与流程；实施顺序建议明确（数据模型与规则 → 付款申请 MVP → 主档带出 → 对账勾稽）。
- **结构与边界**：Project Structure 指明新增/扩展文件与目录；FR 与组件/服务/集合的映射表可供实现与 Epic 拆解使用；集成边界与数据边界明确，可实现一致实现。

### Gap Analysis

- **Critical**：无阻塞性缺口；Firestore 安全规则具体语法与索引需在首次实现时随数据模型落地并写入 firestore.rules / firestore.indexes.json。
- **Important**：referenceNumber 具体格式（如 `{loId}-{type}-{yyyyMMdd}-{seq}`）可在首次实现时与业务方敲定并写入架构或 config；主档带出字段列表建议在 config 或常量中集中维护，便于多场景复用。
- **Nice-to-have**：可补充示例（如 paymentRequest 文档示例、规则片段示例）于实施阶段按需加入文档或代码注释。

---

## Architecture Completion Summary

### Workflow Completion

**Architecture Decision Workflow:** COMPLETED  
**Total Steps Completed:** 8  
**Date Completed:** 2025-02-16  
**Document Location:** _bmad-output/architecture.md  

### Final Architecture Deliverables

- **完整架构决策文档**：项目上下文、Starter 评估（棕地基线）、核心架构决策（数据/安全/API/前端/基础设施）、实施模式与一致性规则、项目结构与边界、验证结果。
- **实施就绪基础**：数据模型与安全规则扩展点、paymentRequests 与 referenceNumber 与多 LO（loId）约定、实施顺序建议（数据与规则 → 付款申请 MVP → 主档带出 → 对账勾稽）。
- **AI Agent 实施指引**：技术栈与命名/结构/流程约定、FR 与目录映射、集成与数据边界；首条实施 Story 在现有代码库内交付主档带出或付款申请 MVP。

### Implementation Handoff

**对实现与 AI Agent：** 本架构文档为 JCI LO 管理应用扩展的权威指引。实现时请严格遵循文档中的决策、模式与结构。

**首条实施优先级：** 在现有 repo 内实现某一 PRD 能力（如主档带出或付款申请 MVP），不运行新 scaffold；具体顺序见 Core Architectural Decisions → Decision Impact Analysis。

**建议开发顺序：** ① 扩展数据模型与 Firestore 规则（members、paymentRequests、loId、referenceNumber）→ ② 付款申请 MVP（提交、列表、状态、审核）→ ③ 主档带出（至少 2 个场景）→ ④ 对账与编号勾稽。

### Quality Assurance Checklist

- [x] 决策一致、技术选型兼容、模式与结构对齐  
- [x] FR 与 NFR 均有架构支撑  
- [x] 决策可执行、模式可防冲突、结构与边界明确  
- [x] 验证通过，无阻塞性缺口
