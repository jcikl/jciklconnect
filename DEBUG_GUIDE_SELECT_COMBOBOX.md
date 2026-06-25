# Select 和 Combobox 调试指南

## 已添加的调试日志

我已经在以下位置添加了详细的调试日志：

### 1. Form Select 组件 (`components/ui/Form.tsx`)

**位置 1：Props 变化监听**
```typescript
useEffect(() => {
  console.log('[Select] Props changed:', { value: props.value, selectedOption, options });
}, [props.value, selectedOption, options]);
```

**位置 2：选项点击处理**
```typescript
onClick={(e) => {
  console.log('[Select] Option clicked:', opt.value);
  // ... 创建事件对象
  console.log('[Select] Calling onChange with:', syntheticEvent);
  console.log('[Select] props.onChange exists?', !!props.onChange);
  props.onChange?.(syntheticEvent);
  console.log('[Select] Closing dropdown');
  setIsOpen(false);
}}
```

### 2. Combobox 组件 (`components/ui/Combobox.tsx`)

**handleSelect 函数**
```typescript
const handleSelect = (e: React.MouseEvent, val: string) => {
  console.log('[Combobox] handleSelect called:', { val, currentValue: value, currentInputValue: inputValue });
  e.stopPropagation();
  setInputValue(val);
  console.log('[Combobox] Calling onChange with:', val);
  onChange(val);
  console.log('[Combobox] Closing dropdown');
  setOpen(false);
};
```

### 3. TransactionSplitModal (`components/modules/Finance/TransactionSplitModal.tsx`)

**位置 1：editForm 变化监听**
```typescript
useEffect(() => {
  if (editForm) {
    console.log('[TransactionSplitModal] editForm changed:', editForm);
  }
}, [editForm]);
```

**位置 2：splits 变化监听**
```typescript
useEffect(() => {
  console.log('[TransactionSplitModal] splits changed:', splits);
}, [splits]);
```

**位置 3：Category Select onChange**
```typescript
onChange={(e) => {
  console.log('[TransactionSplitModal] Category onChange:', e.target.value);
  console.log('[TransactionSplitModal] Current editForm:', editForm);
  setEditForm({ ...editForm!, category: e.target.value as CategoryType });
  console.log('[TransactionSplitModal] After setEditForm');
}}
```

## 调试步骤

### 步骤 1：启动应用并打开控制台

1. 启动开发服务器：
   ```bash
   npm run dev
   ```

2. 打开浏览器（推荐 Chrome）

3. 按 F12 打开开发者工具

4. 切换到 **Console** 标签页

5. 清空控制台（点击 🚫 图标）

### 步骤 2：测试 Select 组件

1. 导航到 Finance 模块

2. 找到任意交易，点击 Split 按钮

3. 在表格中点击某一行的编辑按钮（铅笔图标）

4. 点击 **Category** 下拉框

5. **观察控制台输出**：
   ```
   [Select] Props changed: { value: "Projects & Activities", selectedOption: {...}, options: [...] }
   ```

6. 选择一个选项（如 "Membership"）

7. **观察控制台输出**：
   ```
   [Select] Option clicked: Membership
   [Select] Calling onChange with: { target: { value: "Membership", name: "" }, ... }
   [Select] props.onChange exists? true
   [Select] Closing dropdown
   [TransactionSplitModal] Category onChange: Membership
   [TransactionSplitModal] Current editForm: { category: "Projects & Activities", ... }
   [TransactionSplitModal] After setEditForm
   [TransactionSplitModal] editForm changed: { category: "Membership", ... }
   [Select] Props changed: { value: "Membership", selectedOption: {...}, options: [...] }
   ```

### 步骤 3：分析日志输出

#### 场景 A：正常工作（预期输出）

如果一切正常，你应该看到：

1. ✅ `[Select] Option clicked` - 确认点击被捕获
2. ✅ `[Select] props.onChange exists? true` - 确认 onChange 存在
3. ✅ `[TransactionSplitModal] Category onChange` - 确认父组件收到事件
4. ✅ `[TransactionSplitModal] editForm changed` - 确认状态更新
5. ✅ `[Select] Props changed` - 确认组件重新渲染，value 已更新

**如果看到这些日志但下拉框仍显示旧值**，问题可能在于：
- 显示逻辑有问题
- CSS 样式覆盖
- 浏览器缓存

#### 场景 B：onChange 未被调用

如果你看到：
```
[Select] Option clicked: Membership
[Select] Calling onChange with: ...
[Select] props.onChange exists? false  ❌
```

**问题**：父组件没有传递 onChange 函数
**解决**：检查 TransactionSplitModal 中 Select 的 props

#### 场景 C：onChange 被调用但状态未更新

如果你看到：
```
[Select] Option clicked: Membership
[TransactionSplitModal] Category onChange: Membership
[TransactionSplitModal] Current editForm: { category: "Projects & Activities", ... }
[TransactionSplitModal] After setEditForm
// 但没有看到 "editForm changed"
```

**问题**：setEditForm 没有触发重新渲染
**可能原因**：
- editForm 是 null
- React 状态更新被批处理延迟
- 组件卸载或条件渲染问题

#### 场景 D：状态更新了但 Select 没有重新渲染

如果你看到：
```
[TransactionSplitModal] editForm changed: { category: "Membership", ... }
// 但没有看到 "[Select] Props changed"
```

**问题**：Select 组件没有收到新的 props
**可能原因**：
- `data` 变量没有正确引用 editForm
- 条件渲染逻辑有问题
- React key 导致组件没有更新

### 步骤 4：检查特定问题

#### 问题 1：检查 `data` 变量

在 TransactionSplitModal 中，找到这行代码：
```typescript
const data = isEditing && editForm ? editForm : split;
```

在控制台中，当你选择选项后，检查：
```
[TransactionSplitModal] editForm changed: { category: "Membership", ... }
```

然后看看 Select 的 value prop 是否更新：
```
[Select] Props changed: { value: "Membership", ... }
```

如果 editForm 更新了但 Select 的 value 没有更新，说明 `data` 变量的计算有问题。

#### 问题 2：检查 isEditing 状态

添加临时日志到 TransactionSplitModal：
```typescript
console.log('[TransactionSplitModal] Rendering row:', { 
  index, 
  isEditing: editingIndex === index, 
  editingIndex, 
  editForm,
  data 
});
```

确认 `isEditing` 为 true 时，`data` 确实指向 `editForm`。

#### 问题 3：检查 React 渲染

如果状态更新了但 UI 没有变化，可能是 React 没有重新渲染。

在 TransactionSplitModal 的顶部添加：
```typescript
console.log('[TransactionSplitModal] Component rendering, editForm:', editForm);
```

每次组件渲染时都会输出。如果状态更新后没有看到这个日志，说明组件没有重新渲染。

### 步骤 5：测试 Combobox

对于 Combobox（如项目选择），执行类似的测试：

1. 在编辑模式下点击项目下拉框
2. 选择一个项目
3. 观察控制台输出：
   ```
   [Combobox] handleSelect called: { val: "Project Name", currentValue: "", currentInputValue: "" }
   [Combobox] Calling onChange with: Project Name
   [Combobox] Closing dropdown
   ```

## 常见问题诊断

### 问题：下拉框不关闭

**日志特征**：
- 看到 `[Select] Closing dropdown`
- 但下拉框仍然打开

**可能原因**：
- `setIsOpen(false)` 被其他代码覆盖
- 事件冒泡导致重新打开
- Portal 渲染问题

**解决方法**：
检查是否有其他事件监听器干扰。

### 问题：选择后显示空白

**日志特征**：
- `[Select] Props changed: { value: "Membership", selectedOption: undefined, ... }`

**原因**：
- `options` 数组中没有匹配的选项
- `opt.value` 和 `props.value` 类型不匹配（字符串 vs 数字）

**解决方法**：
检查 `categoryOptions` 的定义，确保 value 匹配。

### 问题：选择后显示旧值

**日志特征**：
- 所有日志都正常
- 但 UI 显示旧值

**可能原因**：
1. **CSS 问题**：检查是否有 CSS 覆盖了显示
2. **浏览器缓存**：强制刷新（Ctrl+Shift+R）
3. **React DevTools**：使用 React DevTools 检查组件的实际 props

**调试方法**：
```javascript
// 在浏览器控制台中执行
document.querySelector('button[type="button"]').textContent
```
查看按钮的实际文本内容。

## 下一步行动

根据控制台输出，确定问题类型：

### 类型 A：onChange 未被调用
→ 检查 Select 组件的 props 传递
→ 确认父组件正确传递了 onChange

### 类型 B：状态未更新
→ 检查 setEditForm 的调用
→ 确认 editForm 不是 null
→ 检查 React 状态更新逻辑

### 类型 C：组件未重新渲染
→ 检查 `data` 变量的计算
→ 确认 isEditing 状态正确
→ 检查条件渲染逻辑

### 类型 D：显示逻辑问题
→ 检查 selectedOption 的计算
→ 确认 options 数组包含正确的值
→ 检查 value 类型匹配

## 收集信息

测试完成后，请提供以下信息：

1. **完整的控制台日志**（从点击下拉框到选择选项的所有日志）
2. **问题类型**（A/B/C/D）
3. **浏览器信息**（Chrome/Firefox/Safari 版本）
4. **是否有错误信息**（红色的错误日志）
5. **React DevTools 截图**（如果可能）

这将帮助我精确定位问题并提供针对性的修复方案。
