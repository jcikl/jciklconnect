---
description: 实现财务交易与资产库存（衣服/外套及尺寸）的深度联动流程
---

# 财务与库存联动实现工作流

此工作流用于指导如何在系统中实现“以账带货”功能，即在记录财务流水的过程中自动完成库存的加减操作，特别针对衣服、外套等具有多种尺寸规格的资产。

## 1. 数据模型调整 (Data Model)
- [ ] 修改 `types.ts` 中的 `InventoryItem` 接口，增加 `variants` 支持：
    ```typescript
    variants?: { size: string; quantity: number; sku?: string }[];
    ```
- [ ] 修改 `Transaction` 和 `TransactionSplit` 接口，增加联动字段：
    ```typescript
    inventoryLinkId?: string; // 关联的库存物品ID
    inventoryVariant?: string; // 选中的规格（如：L, Unisex M）
    inventoryQuantity?: number; // 影响的数量
    ```

## 2. 后端服务逻辑 (Service Logic)
- [ ] 在 `FinanceService.ts` 的 `createTransaction` 和 `createProjectTransaction` 方法中增加钩子：
    - **逻辑识别**：
        - `type === 'Expense'` 且有 `inventoryLinkId` -> 调用库存服务增加相应规格的数量。
        - `type === 'Income'` 且有 `inventoryLinkId` -> 调用库存服务扣减相应规格的数量。
- [ ] 在 `FinanceService.ts` 的删除交易逻辑中增加回滚操作，确保库存数据的一致性。

## 3. 财务前端界面 (Transaction UI)
- [ ] 更新 `TransactionForm.tsx`：
    - 增加“联动库存”开关。
    - 当开关打开时，显示 `InventorySelector` 下拉框（列出所有库存项）。
    - 选中库存项后，根据该项的 `variants` 自动渲染“尺寸/规格”选择器。
    - **自动化逻辑**：
        - 填写完库存信息后，自动拼接 `purpose` 字段内容，例如：`"售卖 - [物品名] ([规格])"`。
        - 默认 `inventoryQuantity` 为 1。

## 4. 库存管理功能增强 (Inventory UI)
- [ ] 更新 `InventoryView.tsx`，支持在明细界面展示该物品关联的所有“财务流水历史”。
- [ ] 实现规格管理弹窗，允许用户为 T-Shirt 等物品定义不同的尺寸规格及每个规格的初始库存。

## 5. 验证与测试
- [ ] **测试路径 1（销售）**：记录一笔收入交易，选择 Pink Shirt M码，检查库存模块中该规格数量是否减少 1，且 `purpose` 是否自动填入。
- [ ] **测试路径 2（补货）**：记录一笔支出交易，选择 Jacket L码 数量 10，检查库存中 Jacket 的 L 码总数是否增加 10。
- [ ] **异常测试**：删除一笔已关联库存的交易，核实库存数量是否恢复到交易前状态。
