# 架构与 UX 规格对齐检查

**日期：** 2025-02-16  
**项目：** JCI LO 管理应用

---

## 1. 对齐总览

| UX 需求 | 架构/实现支持 | 状态 |
|---------|---------------|------|
| 选会员即带出（MemberSelector） | components/ui/MemberSelector.tsx、membersService | ✅ 已实现 |
| 付款申请列表 + 编号搜索 + 状态 | paymentRequestService、PaymentRequestsView | ✅ 已实现 |
| 对账视图、编号勾稽 | financeService、transactions、reconciliations | ✅ 已实现 |
| 角色驱动导航 | DashboardHome 快捷入口、权限 | ✅ 已实现 |
| 状态标签 + 去重提示 | StatusBadge、DuplicateHint Badge | ✅ 已实现 |
| 首次引导、帮助入口 | FirstUseBanner、Epic 5 | ✅ 已实现（帮助链接已接 Help modal） |
| WCAG 2.1 AA | accessibility.css、aria-*、axe 扫描、键盘测试 | ✅ 核心项已实施，人工键盘测试与 axe 验收已通过 |
| 响应式 sm/md/lg | Tailwind 断点 | 已支持 |

---

## 2. 组件映射

| UX 组件 | 现有实现 | 状态 |
|---------|----------|------|
| MemberSelector | components/ui/MemberSelector.tsx | ✅ 已实现（搜索、带出、键盘、aria） |
| PaymentRequestList | PaymentRequestsView | ✅ 编号搜索、状态筛选、去重提示已集成 |
| ReferenceNumberSearch | FinanceView 对账 Tab | ✅ 编号输入与勾稽已实现 |
| DuplicateHint | PaymentRequestsView 中 Badge 展示 | ✅ 已实现 |
| StatusBadge | 语义色（待审/已批/已拒/已取消） | ✅ 已实现 |

---

## 3. 服务与数据

| UX 能力 | 服务/集合 | 备注 |
|---------|-----------|------|
| 主档带出 | membersService、members | 带出字段由 config/常量维护 |
| 付款申请 CRUD | paymentRequestService、paymentRequests | 含 referenceNumber、status |
| 对账与勾稽 | financeService、transactions、reconciliations | 支持 referenceNumber 关联 |
| 角色与 loId 过滤 | Firestore 规则、request.auth | 活动财政仅本活动 |

---

## 4. 待办项（按 UX 规格）

1. ~~**MemberSelector**~~：✅ 已实现（components/ui/MemberSelector.tsx）
2. ~~**去重提示**~~：✅ 已实现（PaymentRequestsView DuplicateHint Badge）
3. ~~**首次引导**~~：✅ 已实现（FirstUseBanner，流式 flowId 可复用）
4. ~~**角色入口**~~：✅ 已实现（DashboardHome「您的快捷入口」按角色展示）
5. ~~**无障碍验收**~~：✅ 核心流程人工键盘测试、axe 扫描已完成（见 accessibility-checklist-wcag-aa.md）

---

## 5. 结论

架构（React + Firebase + 现有服务与组件）足以支撑 UX 规格中的核心能力。**MemberSelector**、**DuplicateHint**、**FirstUseBanner**（含帮助链接）、**角色快捷入口** 均已实现，**WCAG 2.1 AA** 核心项（axe 扫描、人工键盘测试）已验收通过。
