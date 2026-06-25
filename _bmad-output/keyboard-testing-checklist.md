# 键盘测试清单 - WCAG 2.1.1 Keyboard Accessible

**项目：** JCI LO 管理应用  
**日期：** 2025-02-16  
**目标：** 核心流程仅用键盘可完成（Tab、Enter、Esc、Arrow keys）

---

## 1. 前置条件

- 使用 **Tab** 在可聚焦元素间移动
- 使用 **Shift+Tab** 反向移动
- 使用 **Enter** 激活按钮/链接
- 使用 **Esc** 关闭 Modal、下拉
- 使用 **Arrow Up/Down** 在 MemberSelector、Select 内选择
- 使用 **Space** 勾选 checkbox、切换开关

---

## 2. 主档流程 (MembersView)

| 步骤 | 操作 | 预期 | 通过 |
|------|------|------|------|
| 1 | Tab 进入侧栏 | 焦点到 Dashboard/Members 等 | ☐ |
| 2 | Tab 到 Members | 聚焦 Members 菜单项 | ☐ |
| 3 | Enter 进入 Members | 进入主档列表 | ☐ |
| 4 | Tab 遍历列表 | 每行可聚焦、Enter 可打开详情 | ☐ |
| 5 | 打开会员详情 | Modal 打开，焦点在 Modal 内 | ☐ |
| 6 | Tab 在 Modal 内循环 | 焦点不逃出 Modal | ☐ |
| 7 | Esc 关闭 Modal | Modal 关闭，焦点回到触发元素 | ☐ |
| 8 | 新建/编辑会员 | 表单各字段可 Tab 聚焦，提交可 Enter | ☐ |

---

## 3. 付款申请流程 (PaymentRequestsView)

| 步骤 | 操作 | 预期 | 通过 |
|------|------|------|------|
| 1 | Tab 到 Payment Requests | 进入付款申请视图 | ☐ |
| 2 | Tab 到「Submit」按钮 | 可 Enter 打开提交表单 | ☐ |
| 3 | 打开提交 Modal | 表单内 Tab 可遍历所有输入 | ☐ |
| 4 | MemberSelector | Tab 进入输入框，Arrow 选会员，Enter 确认 | ☐ |
| 5 | 编号搜索 input | Tab 聚焦，输入后 Enter 触发搜索 | ☐ |
| 6 | 状态筛选 Select | Tab 聚焦，Arrow 切换选项 | ☐ |
| 7 | 批准/拒绝按钮 | Tab 聚焦，Enter 执行 | ☐ |
| 8 | Esc 关闭 Modal | Modal 关闭 | ☐ |
| 9 | FirstUseBanner「查看详细说明」 | Tab 到链接，Enter 打开 Help modal | ☐ |

---

## 4. 对账流程 (FinanceView 对账 Tab)

| 步骤 | 操作 | 预期 | 通过 |
|------|------|------|------|
| 1 | Tab 到 Finance | 进入财政视图 | ☐ |
| 2 | Tab 到「对账」Tab | 切换到对账 Tab | ☐ |
| 3 | Tab 到编号输入框 | 可输入参考编号 | ☐ |
| 4 | Enter 或 Tab 到查询按钮 | 执行查询 | ☐ |
| 5 | Tab 到「标记已对账」 | 可 Enter 执行 | ☐ |
| 6 | Esc（若有 Modal） | 关闭 | ☐ |

---

## 5. 导航与跳过链接

| 步骤 | 操作 | 预期 | 通过 |
|------|------|------|------|
| 1 | 页面加载后 Tab | 首个焦点到 Skip to main content | ☐ |
| 2 | Enter 跳过链接 | 焦点跳到 main#main-content | ☐ |
| 3 | Tab 遍历 Topbar | 搜索框、通知、用户菜单可聚焦 | ☐ |
| 4 | Tab 遍历侧栏 | 所有菜单项可聚焦、Enter 切换视图 | ☐ |
| 5 | Help 侧栏项 | Tab 到 Help，Enter 打开 Help modal | ☐ |

---

## 6. 无键盘陷阱检查

- [ ] Modal 打开时焦点在 Modal 内
- [ ] Tab 在 Modal 内循环，不跳回背景
- [ ] MemberSelector 下拉打开时，Arrow 可选，Esc 可关闭
- [ ] 关闭 Modal 后焦点回到触发元素（或合理位置）

---

## 7. 执行记录

| 日期 | 执行人 | 主档 | 付款申请 | 对账 | 备注 |
|------|--------|------|----------|------|------|
|      |        | ☐    | ☐        | ☐    |      |
