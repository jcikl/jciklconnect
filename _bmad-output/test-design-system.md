# System-Level Test Design

**Date:** 2025-02-16  
**Project:** JCI LO 管理应用  
**Mode:** System-Level (Phase 3 – Testability Review)  
**Author:** TEA (Test Architect)

---

## Testability Assessment

### Controllability: PASS (with notes)

- **System state for testing:** Firestore 数据可通过 Emulator 或测试项目进行 seeding；members、paymentRequests、transactions 等集合可由测试脚本或 Callable 写入，满足「按角色/loId 构造场景」的需求。编号生成若经 Callable，可 mock 或使用固定种子。
- **External dependencies:** Firebase Auth 可配合 Emulator 或测试账号；银行流水为人工上传/粘贴（NFR-I2），无实时银行 API，无需 mock 第三方支付。Firestore 规则在 Emulator 中可测。
- **Error conditions:** 可构造规则拒绝、网络失败、无效 loId 等场景；建议在服务层或 E2E 中显式覆盖「无权限访问」「跨 LO 访问被拒」等用例。

**Note:** 需在 CI/本地统一约定使用 Firestore Emulator 或独立测试项目，避免与开发/生产数据混用。

### Observability: PASS (with notes)

- **Inspect system state:** Firestore 文档含 updatedBy/updatedAt、可选 correlation id（NFR-R3）；审计与排障可依赖文档字段与 Firebase 控制台/日志。
- **Deterministic results:** 列表分页与懒加载、按 referenceNumber/时间范围查询有明确契约；建议 E2E 使用固定测试数据或 HAR/seed，避免时间敏感断言导致 flakiness。
- **NFR validation:** 性能目标（NFR-P1/P2）可经工具测量（如 Lighthouse、自定义 timing）；安全与权限可通过规则测试 + E2E 验证；可访问性（NFR-A1/A2）可结合 axe 或等价工具做自动化检查。

**Note:** 若尚未引入前端性能与可访问性自动化，建议在 Sprint 0 或首个 Epic 中纳入基础套件。

### Reliability: PASS (with notes)

- **Test isolation:** 现有 Vitest 用于 property/unit；新增测试应无共享可变状态、并行安全；Firestore Emulator 每个 suite 或 worker 使用独立项目/清空数据，避免交叉影响。
- **Reproducibility:** 使用 seed 数据与约定编号格式便于复现；对账与列表查询建议避免「最近 N 条」等非确定性断言。
- **Loose coupling:** 服务层直连 Firestore，边界清晰；规则与业务逻辑分离，规则可在 Emulator 中独立验证；Callable 可 mock 以隔离 E2E。

**Note:** 现有代码库已有 `tests/property/*.test.ts`（Vitest）；E2E 若引入 Playwright，需与 Vitest 分工明确（如 Vitest = unit + 部分 integration，Playwright = E2E 关键路径）。

---

## Architecturally Significant Requirements (ASRs)

从 PRD NFR 与架构决策提取、并对测试策略有直接影响的品质需求如下；风险评分采用 Probability × Impact（1–3），Score ≥6 为高优先级。

| ASR ID | NFR / 架构来源 | 描述 | Prob | Impact | Score | 测试策略 |
|--------|----------------|------|------|--------|-------|----------|
| ASR-1 | NFR-S2, 架构权限 | 组织财政 / 活动财政 / 会员 / 多 LO 租户边界在规则与 UI 中落实 | 2 | 3 | 6 | Firestore 规则测试（Emulator）+ E2E 角色视角 |
| ASR-2 | NFR-P1, 架构列表 | 关键操作（列表、按编号查询）首屏/结果 3 秒内可感知；分页/懒加载 | 2 | 2 | 4 | 性能采样 + E2E 超时与列表加载断言 |
| ASR-3 | NFR-P2 | 对账/流水查询（典型数据量）响应 ≤5 秒 | 1 | 2 | 2 | 集成或 E2E 下带量数据 + 计时 |
| ASR-4 | NFR-R2, 架构写入 | 付款申请与主档更新「成功确认后不丢失」、前端先收后端成功再更新 UI | 2 | 3 | 6 | E2E 提交流程 + 刷新验证；单元/集成验证写入顺序 |
| ASR-5 | NFR-S4, 架构审计 | 付款申请状态变更、主档关键修改可追溯（updatedBy/updatedAt）；不记录支付凭证 | 1 | 2 | 2 | 单元/集成检查文档字段；安全测试不泄露敏感内容 |
| ASR-6 | NFR-SC1/SC3, 架构多 LO | 数据模型与规则支持 loId（及 areaId/countryId）隔离；多 LO 时跨 LO 访问被拒 | 2 | 3 | 6 | 规则测试跨租户拒绝；E2E 单 LO 与多 LO 场景（若启用） |
| ASR-7 | NFR-A1/A2 | 核心流程 WCAG 2.1 AA；关键操作有明确成功/失败反馈 | 2 | 2 | 4 | 可访问性自动化（axe 等）+ E2E 反馈断言 |

**High-priority ASRs (Score ≥6):** ASR-1（权限与租户）、ASR-4（持久化与成功确认）、ASR-6（多 LO 隔离）。建议在 Epic 1（主档与访问控制）、Epic 2（付款申请）的测试设计中优先覆盖。

---

## Test Levels Strategy

基于架构（React SPA + Firestore + Functions、棕地、Vitest 已存在）：

| 层级 | 建议比例 | 说明 | 工具/环境 |
|------|----------|------|-----------|
| **Unit** | 50% | 业务逻辑、编号生成、校验、状态机、带出字段映射；纯函数与可隔离服务方法 | Vitest（现有） |
| **Integration** | 30% | Firestore 规则（Emulator）、服务层与集合读写、Callable 契约；不跑完整 UI | Vitest + Firestore Emulator（或 @firebase/rules-unit-testing） |
| **E2E** | 20% | 关键用户旅程：登录→主档查看/编辑、付款申请提交与状态查询、财政列表与去重、对账按编号勾稽；多角色与权限边界 | Playwright（建议新增）或 Cypress；Staging 或 Emulator+Test Auth |

**Rationale:** 权限与多 LO（ASR-1、ASR-6）依赖规则与端到端角色验证；持久化与反馈（ASR-4、ASR-7）适合 E2E；大量分支与计算适合 Unit；规则与服务契约适合 Integration，避免 E2E 膨胀。

**Avoid duplication:** 同一行为不在 Unit、Integration、E2E 三层重复覆盖；例如「活动财政仅见本活动」在规则测试中验证一次，在 E2E 中仅做少量代表性场景。

---

## NFR Testing Approach

| NFR 类别 | 测试方法 | 工具/备注 |
|----------|----------|-----------|
| **Security** | 认证/授权、多 LO 租户、审计不泄密 | Firestore 规则单元测试（Emulator）；E2E 未登录/错误角色访问被拒；检查响应与日志不包含密码/凭证 |
| **Performance** | 关键操作 3s、对账查询 5s（NFR-P1/P2）；≥5 并发（NFR-P3） | 前端：Lighthouse 或 Playwright 的 performance 与 timing；对账/列表：集成测试带量数据 + 计时；并发可后期用 k6 或简单脚本 |
| **Reliability** | 写入成功确认、不丢失（NFR-R2）；可追踪操作（NFR-R3） | E2E 提交后刷新验证；单元/集成验证写入顺序与审计字段 |
| **Maintainability** | 覆盖率目标、可观测性 | 关键路径覆盖率 ≥80%；Vitest coverage；新模块随 PR 增加测试 |

---

## Test Environment Requirements

- **Local:** Vitest 已配置；需 Firestore Emulator 与（可选）Auth Emulator 用于规则与集成测试；环境变量或脚本区分 test vs dev。
- **E2E:** 建议独立测试 Firebase 项目或 Staging；Test Auth 账号（组织财政、活动财政、会员各一）与固定 loId，避免依赖生产数据。
- **CI:** 可先跑 Vitest（unit + integration）；E2E 可后置为单独 job（如 PR 或 nightly），并配置 Emulator 或测试环境。

---

## Testability Concerns (if any)

- **无阻塞性问题。** 架构支持通过 Emulator、测试账号与 seed 数据控制状态；规则与角色边界可测； observability 与审计字段已约定。
- **建议补齐：**  
  - **E2E 框架：** 当前仅有 Vitest；若未引入 Playwright/Cypress，关键用户旅程（主档、付款申请、对账）建议在首个 MVP Epic 中引入 E2E 并纳入 CI。  
  - **Firestore Emulator 规范：** 在 README 或 dev 文档中明确「如何启动 Emulator、如何 seed 测试数据、CI 如何复用」，保证所有开发者与 CI 一致。  
  - **可访问性与性能自动化：** NFR-A1/A2、NFR-P1 建议在框架与 CI 中落地（如 axe、Lighthouse 或 Playwright 的 accessibility/performance API），避免仅靠手工检查。

---

## Recommendations for Sprint 0 / Framework & CI

1. **引入 Playwright（若尚未有 E2E）**  
   用于关键路径：登录、主档查看/编辑、付款申请提交与状态查询、财政列表与去重、对账按编号查询；与 Vitest 分工明确（Vitest = unit + integration）。

2. **统一 Firestore Emulator 使用**  
   文档化启动与 seed 步骤；CI 中 rules 与 integration 测试均对 Emulator 运行；可选 Auth Emulator 生成测试 token。

3. **测试标签与分层**  
   使用 tags 或目录区分 unit / integration / e2e 与 P0/P1；Smoke 为 P0 子集（如登录 + 主档列表 + 付款申请列表加载），<5 min。

4. **NFR 自动化节奏**  
   安全与权限：每 PR 运行规则测试 + 至少 1 条 E2E 权限场景；性能与可访问性：可在 nightly 或按 Epic 逐步加入，首阶段以「可运行、可复现」为主。

5. **Epic 级测试设计**  
   每个 Epic 实施前可运行 **test-design（Epic-Level Mode）** 产出 `test-design-epic-{N}.md`，将本系统级策略细化为该 Epic 的风险矩阵、场景清单与执行顺序。

---

## Related Documents

- PRD: `_bmad-output/prd.md`
- Architecture: `_bmad-output/architecture.md`
- Epics: `_bmad-output/epics.md`
- Implementation Readiness: `_bmad-output/implementation-readiness-report-2025-02-16.md`

---

**Generated by:** BMad TEA Agent – Test Architect (testarch-test-design)  
**Workflow:** `_bmad/bmm/workflows/testarch/test-design` (System-Level Mode)  
**Version:** 4.0 (BMad v6)
