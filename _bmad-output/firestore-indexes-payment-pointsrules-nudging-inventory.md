# 付款申请 / 财政 list / Points Rules / Behavioral Nudging / Inventory 索引檢查

## 1. 付款申请（paymentRequests）

| 查詢 | 條件 | 原有索引 | 本次補遺 |
|------|------|----------|----------|
| **generateReferenceNumber** | `where('loId')` + `where('createdAt', '>=')` + `orderBy('createdAt','desc')` | ✅ loId + createdAt | - |
| **list() 全部申请（财政）** | 可選 loId, activityRef, applicantId, status, referenceNumber + `orderBy('createdAt','desc')` | ✅ loId+createdAt, activityRef+createdAt, applicantId+createdAt, loId+activityRef+createdAt | 缺 status / referenceNumber / loId+status 組合 |
| **list() 依狀態篩選** | `where('status')` + orderBy createdAt | 缺 | ✅ **status + createdAt** |
| **list() 依參考編號** | `where('referenceNumber')` + orderBy createdAt | 缺 | ✅ **referenceNumber + createdAt** |
| **list() 依 LO + 狀態（财政常用）** | `where('loId')` + `where('status')` + orderBy createdAt | 缺 | ✅ **loId + status + createdAt** |

---

## 2. Points Rules（pointsRules / pointsRuleExecutions）

| 集合 | 查詢 | 索引狀態 |
|------|------|----------|
| **pointsRules** | `orderBy('weight','desc')` + `orderBy('name','asc')` | ✅ 已有 |
| **pointsRuleExecutions** | `where('ruleId')` + `orderBy('executedAt','desc')` | ✅ 已有 |

**結論：Points Rules 相關索引已齊，無需補遺。**

---

## 3. Behavioral Nudging（nudgeRules）

| 查詢 | 條件 | 需複合索引？ |
|------|------|--------------|
| **getAllNudgeRules** | `orderBy('createdAt', 'desc')` | 否（單一 orderBy，自動單欄索引） |

**結論：Behavioral Nudging 無需複合索引。**

---

## 4. Inventory maintenance（maintenance_schedules）

| 查詢 | 條件 | 索引狀態 |
|------|------|----------|
| **getMaintenanceSchedules** | `orderBy('scheduledDate', 'asc')` | ✅ 已有（scheduledDate ASC） |

**結論：Inventory maintenance 索引已齊。**

---

## 5. Inventory alerts（inventory_alerts）

| 查詢 | 條件 | 索引狀態 |
|------|------|----------|
| **getInventoryAlerts** 僅 orderBy | `orderBy('createdAt', 'desc')` | 單欄自動 |
| **getInventoryAlerts** + itemId | `where('itemId')` + orderBy createdAt | ✅ itemId + createdAt |
| **getInventoryAlerts** + acknowledged | `where('acknowledged')` + orderBy createdAt | ✅ acknowledged + createdAt |
| **getInventoryAlerts** itemId + acknowledged | 兩者都篩選 | ✅ itemId + acknowledged + createdAt |

**結論：Inventory alerts 索引已齊。**

---

## 本次已寫入 `firestore.indexes.json` 的索引

- **paymentRequests**: `status` ASC, `createdAt` DESC  
- **paymentRequests**: `referenceNumber` ASC, `createdAt` DESC  
- **paymentRequests**: `loId` ASC, `status` ASC, `createdAt` DESC  

其餘（pointsRules、pointsRuleExecutions、nudgeRules、maintenance_schedules、inventory_alerts）此前已齊，本次未改動。

部署：`npx firebase deploy --only firestore:indexes`
