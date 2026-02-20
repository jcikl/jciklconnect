# 无障碍验收清单 - WCAG 2.1 Level AA

**项目：** JCI LO 管理应用  
**日期：** 2025-02-16  
**适用范围：** 主档、付款申请、对账（NFR-A1/A2）

---

## 1. 验收范围

| 流程 | 页面/组件 | 优先级 |
|------|-----------|--------|
| 主档 | MembersView、MemberEditForm、主档带出 | P0 |
| 付款申请 | PaymentRequestsView（列表、表单、MemberSelector） | P0 |
| 对账 | FinanceView 对账 Tab、编号搜索 | P0 |
| 导航 | 侧栏、角色快捷入口、帮助 | P1 |

---

## 2. 检查项（WCAG 2.1 AA）

### 2.1  perceivable 可感知

| 检查项 | 标准 | 验收方法 | 状态 |
|--------|------|----------|------|
| 文本对比度 | 1.4.3 正文 ≥4.5:1、大标题 ≥3:1 | 工具（axe、Contrast Checker） | 待验 |
| 不单靠颜色 | 1.4.1 成功/失败/警告有文字或图标 | 人工检查 StatusBadge、Toast | 已满足（Badge 有文字） |
| 焦点可见 | 2.4.7 键盘焦点有可见指示 | 键盘 Tab 遍历 | 待验 |
| 表单标签 | 1.3.1、3.3.2 控件有 label 或 aria-label | 屏幕阅读器测试 | 部分已有 |

### 2.2 operable 可操作

| 检查项 | 标准 | 验收方法 | 状态 |
|--------|------|----------|------|
| 键盘可操作 | 2.1.1 核心流程仅键盘可完成 | Tab/Enter/Esc 完成流程 | 已验 |
| 无键盘陷阱 | 2.1.2 焦点不卡在 Modal/下拉内 | 键盘在 Modal 内循环 | 已验 |
| 跳过导航 | 2.4.1 有跳过主内容链接（可选） | 检查 skip-link | 已有样式 |
| 表单错误 | 3.3.1 错误有明确说明 | 校验失败提示 | 待验 |

### 2.3 understandable 可理解

| 检查项 | 标准 | 验收方法 | 状态 |
|--------|------|----------|------|
| 页面标题 | 2.4.2 有 title | document.title 按视图更新 | 已有 |
| 错误识别 | 3.3.1 错误与控件关联 | aria-describedby/errormessage | 待验 |
| 标签与说明 | 3.3.2 必填有标识 | required、* 或 aria-required | 已有 |

### 2.4 robust 健壮

| 检查项 | 标准 | 验收方法 | 状态 |
|--------|------|----------|------|
| 语义 HTML | 4.1.2 角色、属性正确 | axe 扫描 | 已通过 |
| 表单 name | 4.1.2 控件可被 assistive tech 识别 | aria-label/name | 待验 |

---

## 3. 核心组件检查清单

### PaymentRequestsView

- [x] 编号搜索 input：aria-label ✓
- [x] 状态筛选 Select：aria-label ✓
- [x] 搜索按钮：可键盘触发
- [x] Modal 表单：Esc 关闭 ✓
- [x] StatusBadge：有文字，不单靠颜色 ✓
- [x] 批准/拒绝按钮：可键盘操作

### MemberSelector

- [x] 输入框：aria-label、aria-expanded、aria-activedescendant ✓
- [x] 下拉列表：role="listbox" ✓
- [x] 键盘：上下选、Enter 确认、Esc 关闭 ✓
- [x] 带出区域：语义化

### FinanceView 对账

- [x] 编号输入：aria-label ✓
- [x] 查询按钮：可键盘触发
- [x] 列表：语义 list
- [x] 标记已对账：可键盘

### FirstUseBanner

- [x] 关闭按钮：aria-label ✓
- [x] region：aria-label ✓

---

## 4. 自动化建议

- **axe-core**：已集成。运行 `npm run dev:a11y` 启动开发服务器，axe 将在控制台输出违规项
- **Lighthouse**：Chrome DevTools → Lighthouse → Accessibility 审计
- **Playwright**：`page.accessibility.snapshot()` 或 axe 集成

---

## 5. 已实施改进（2025-02-16）

1. 引入 `styles/accessibility.css`（focus、prefers-reduced-motion、高对比度）
2. MemberSelector：aria-expanded、aria-activedescendant、role="listbox"
3. FirstUseBanner：role="region"、aria-label
4. PaymentRequestsView 编号搜索：aria-label
5. StatusBadge：文字 + 颜色（不单靠颜色）
6. 导入 `accessibility.css` 至 index.tsx
7. Modal：role="dialog"、aria-modal、aria-labelledby、Esc 关闭、关闭按钮 aria-label
8. FinanceView 对账：编号输入 aria-label
9. PaymentRequestsView：状态筛选 Select aria-label
10. App：Skip to main content 链接、main#main-content、topbar 按钮/输入 aria-label
11. FirstUseBanner「查看详细说明」：已接 Help modal（HelpModalContext、FinanceView、PaymentRequestsView）
12. 表格边框：已移除（accessibility.css + 各模块 tbody/tr/thead）
13. document.title 按视图更新（WCAG 2.4.2）
14. axe-core 集成：`npm run dev:a11y` 运行 axe 扫描，违规输出到控制台
15. 键盘测试清单：`_bmad-output/keyboard-testing-checklist.md`
16. axe 违规修复：landmark-one-main（guest 页添加 main）、page-has-heading-one（auth 页 sr-only h1）、region（main 包裹内容、overlay role="presentation"）、guest 页添加 Skip 链接

---

## 6. 待办

1. ~~将 accessibility.css 导入入口（若未导入）~~ ✓ 已导入 index.tsx
2. ~~人工键盘测试：按 `_bmad-output/keyboard-testing-checklist.md` 执行~~ ✓ 已完成
3. ~~运行 `npm run dev:a11y` 扫描核心页面，修复 axe 违规~~ ✓ 已通过（landmark、h1、region 已修复）
4. ~~可选：添加 Skip to main content 链接~~ ✓ 已添加 App.tsx
