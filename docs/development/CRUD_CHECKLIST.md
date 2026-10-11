# CRUD 写操作前置检查清单（完整版）

> 从 CLAUDE.md 迁出（原第 549–609 行），内容未改动。CLAUDE.md 只保留摘要；涉及 Firestore 写入的任务必须读本文件。

**每次新增或修改任何 Firestore 读写操作（Create / Read / Update / Delete），必须在动笔写代码前，逐项回答以下四组问题。这是强制步骤，不能跳过。**

### 写入前（Create / Update）

**联动写：**
- 这个操作写入集合 A 时，其他哪些集合需要同步写入？（例：创建 paymentRequest → 要不要同时写 notifications？）
- 这些联动写是否放在同一个 `writeBatch` 里？如果不是，中途失败会导致什么数据不一致？

**冗余字段同步：**
- 被更新的字段，在其他集合里有没有冗余副本？（例：更新 member.name → eventRegistrations.memberName 是否跟着改？）
- 如果有冗余副本，同步逻辑写在哪里？遗漏了会怎样？

**缓存清理：**
- 写完之后，必须调用哪些 `invalidateXxxCache()`？
- 有没有按 LO / 按状态分组的独立缓存键也需要一起清？（只清主键、漏清分组键 = 分组查询读到旧数据）

**前置校验：**
- 写入前是否需要验证状态合法性？（例：paymentRequest 必须是 `pending` 才能 approve，不能从 `rejected` 直接跳）
- Firestore 规则里有没有对应的字段白名单（`hasOnly([])`）或必填校验（`hasAll([])`）？

### 删除前（Delete）

**孤儿风险：**
- 删除这条记录后，哪些其他集合里还有指向它 ID 的字段？（在 `types.ts` 里搜本集合的 `xxxId` 字段出现在哪些其他类型里）
- 这些关联记录应该：级联删除 / 软标记为已删除 / 保留但断开引用？
- 删除前是否需要先检查"这条记录是否仍被引用"？（例：删除 bankAccount 前先查是否有未结算 transactions 指向它）

**退回路径：**
- 删除操作可以撤回吗？（软删 vs 硬删）
- 如果用软删（`isDeleted: true`），所有读取这个集合的查询是否都过滤了软删记录？

### 任何写操作的通用规则

| 规则 | 要求 |
|------|------|
| 多文档写入 | 必须用 `writeBatch`，绝不分开发送 |
| 缓存清理 | 每个写路径（包括 batch 变体）都必须调用 `invalidateXxxCache()` |
| 错误处理 | 失败必须通过 `errorLoggingService` 记录，不能静默吞掉 |
| 副作用顺序 | 主文档写入成功后再触发副作用（通知、积分、同步），不能先触副作用再写主文档 |
| Firestore 规则同步 | Service 层的权限判断改了，对应的 `firestore.rules` 必须同步改 |
| Dev 模式路径 | 新增的 service 方法必须有 `isDevMode()` 检查和 mock 数据返回 |

### 变体对称检查

如果这个操作有"单个版"和"批量版"（或多个入口），两者必须对称：
- 权限守卫相同？
- 退回机制相同？
- 联动写相同？
- 缓存清理相同？

不对称 = 修好了一个入口，另一个入口还有洞。

---

### Firestore 权限规则注意事项

- `resource.data` **不能**用于 collection-level list/query 规则（仅 document-level get 可用）。批量扫描/迁移规则必须在最前加 `isAdmin() ||` 绕过 resource.data 检查。
- `allow read` 与 `allow update` 是独立的门。迁移操作（scan = read + migrate = update）两条规则都必须独立加 `isAdmin()`。
- `Transaction` 集合无 `loId` 字段，LO 归属通过 `bankAccountId → bankAccounts.loId` 间接表达。
