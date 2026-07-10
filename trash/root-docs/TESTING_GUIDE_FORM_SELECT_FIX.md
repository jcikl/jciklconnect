# Form Select 修复测试指南

## 测试目标
验证 Form Select 组件的修复是否解决了选择无效的问题。

## 测试环境准备

### 1. 启动开发服务器
```bash
npm run dev
```

### 2. 打开浏览器开发者工具
- 按 F12 打开开发者工具
- 切换到 Console 标签页
- 准备观察日志输出

## 测试场景

### 场景 1：TransactionSplitModal - 类别选择

**测试步骤**：
1. 导航到 Finance 模块
2. 点击任意交易的 "Split" 按钮（或创建新交易并选择 Split）
3. 在 Split 表格中，点击某一行的编辑按钮（铅笔图标）
4. 点击 "Category" 下拉框
5. 选择一个类别（如 "Membership" 或 "Administrative"）
6. 观察以下内容：

**预期结果**：
- ✅ 下拉框应该关闭
- ✅ 选中的类别应该显示在下拉框中
- ✅ 相关的字段应该根据类别变化（如选择 Membership 时显示 Member 字段）
- ✅ Console 中不应该有错误信息

**失败标志**：
- ❌ 下拉框不关闭
- ❌ 选择后显示的仍是旧值
- ❌ 相关字段没有更新
- ❌ Console 中出现错误

### 场景 2：TransactionSplitModal - 年份选择

**测试步骤**：
1. 在编辑模式下
2. 点击 "Year" 下拉框（如果类别是 Membership 或 Administrative）
3. 选择一个年份
4. 观察年份是否正确更新

**预期结果**：
- ✅ 年份正确显示
- ✅ 如果是 Membership 类别，Purpose 字段应该自动更新为 "{year} {membershipType} membership"

### 场景 3：FinanceView - 筛选器选择

**测试步骤**：
1. 在 Finance Dashboard 中
2. 找到任何使用 Select 组件的筛选器
3. 点击下拉框并选择一个选项
4. 观察筛选结果是否正确更新

**预期结果**：
- ✅ 筛选器值正确更新
- ✅ 显示的数据根据筛选条件变化
- ✅ 下拉框关闭

### 场景 4：编辑交易 - 类别选择

**测试步骤**：
1. 在 Transactions 标签页
2. 点击任意交易的编辑按钮
3. 如果有类别下拉框，尝试更改类别
4. 点击保存

**预期结果**：
- ✅ 类别正确更新
- ✅ 交易保存成功
- ✅ 刷新后类别仍然正确

## 调试技巧

### 添加临时日志

如果测试失败，可以在 `components/ui/Form.tsx` 中添加临时日志：

```typescript
onClick={(e) => {
  e.stopPropagation();
  console.log('[Form Select] Clicked option:', opt.value);
  
  const syntheticEvent = {
    target: { 
      value: opt.value,
      name: props.name || ''
    },
    currentTarget: { 
      value: opt.value,
      name: props.name || ''
    },
    preventDefault: () => {},
    stopPropagation: () => {}
  } as React.ChangeEvent<HTMLSelectElement>;
  
  console.log('[Form Select] Calling onChange with:', syntheticEvent);
  props.onChange?.(syntheticEvent);
  console.log('[Form Select] After onChange, closing dropdown');
  setIsOpen(false);
}}
```

### 检查父组件的 onChange 处理

在 `TransactionSplitModal.tsx` 中，检查 onChange 是否正确处理：

```typescript
// 在 Select 组件的 onChange 中添加日志
onChange={(e) => {
  console.log('[TransactionSplitModal] Category changed:', e.target.value);
  setEditForm({ ...editForm!, category: e.target.value as CategoryType });
}}
```

### 验证状态更新

在 `TransactionSplitModal.tsx` 中添加 useEffect 监听状态变化：

```typescript
useEffect(() => {
  console.log('[TransactionSplitModal] editForm updated:', editForm);
}, [editForm]);
```

## 常见问题排查

### 问题 1：选择后值没有更新

**可能原因**：
- onChange 没有被调用
- 父组件的状态更新逻辑有问题
- 组件没有重新渲染

**排查步骤**：
1. 检查 Console 中的日志
2. 确认 onChange 被调用
3. 确认 e.target.value 包含正确的值
4. 检查父组件的状态更新代码

### 问题 2：下拉框不关闭

**可能原因**：
- setIsOpen(false) 没有执行
- 事件冒泡导致重新打开

**排查步骤**：
1. 检查 e.stopPropagation() 是否执行
2. 检查是否有其他事件监听器干扰
3. 确认 isOpen 状态正确更新

### 问题 3：相关字段没有联动更新

**可能原因**：
- 这不是 Form Select 的问题
- 是父组件的业务逻辑问题

**排查步骤**：
1. 确认 Form Select 的 onChange 正确触发
2. 检查父组件中类别变化后的处理逻辑
3. 查看 TransactionSplitModal 中的 useEffect 依赖

## 测试结果记录

### 场景 1：TransactionSplitModal - 类别选择
- [ ] 通过
- [ ] 失败
- 备注：_______________________

### 场景 2：TransactionSplitModal - 年份选择
- [ ] 通过
- [ ] 失败
- 备注：_______________________

### 场景 3：FinanceView - 筛选器选择
- [ ] 通过
- [ ] 失败
- 备注：_______________________

### 场景 4：编辑交易 - 类别选择
- [ ] 通过
- [ ] 失败
- 备注：_______________________

## 下一步行动

### 如果所有测试通过 ✅
- 修复成功！
- 可以考虑改进 Combobox 组件（如果仍有问题）
- 移除临时调试日志
- 提交代码

### 如果部分测试失败 ⚠️
- 记录失败的场景
- 收集 Console 日志
- 检查是否是 Combobox 的问题（而非 Select）
- 根据失败场景决定是否需要进一步修复

### 如果所有测试失败 ❌
- 检查修复是否正确应用
- 重新阅读 `components/ui/Form.tsx` 确认代码
- 检查是否有其他文件覆盖了修复
- 考虑回滚并重新分析问题

## 性能测试（可选）

### 测试大量选项的性能
1. 创建一个包含 100+ 选项的 Select
2. 打开下拉框
3. 选择一个选项
4. 观察是否有明显延迟

**预期**：
- 下拉框应该流畅打开
- 选择应该立即响应
- 没有明显的性能问题

## 浏览器兼容性测试（可选）

测试以下浏览器：
- [ ] Chrome/Edge (Chromium)
- [ ] Firefox
- [ ] Safari (如果可用)

确保在所有浏览器中行为一致。

---

## 测试完成后

请将测试结果反馈给我，包括：
1. 哪些场景通过了
2. 哪些场景失败了
3. Console 中的任何错误或警告
4. 是否需要进一步修复 Combobox 组件

这将帮助我决定下一步的优化方向。
