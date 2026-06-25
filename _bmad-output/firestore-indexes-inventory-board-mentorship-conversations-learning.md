# Inventory / Board of Directors / Mentorship / Conversations / Learning Path — 索引檢查

## 1. Inventory 相關

| 集合 | 查詢 | 原有索引 | 本次補遺 |
|------|------|----------|----------|
| **inventory** | `orderBy('name')` | 單欄自動 | - |
| **inventory** | `where('category')` + `orderBy('name')` | ✅ category + name | - |
| **inventory_alerts** | `orderBy('createdAt')` + 可選 `where('itemId')` | ✅ itemId + createdAt | - |
| **inventory_alerts** | 可選 `where('acknowledged')` | ✅ acknowledged + createdAt | - |
| **inventory_alerts** | 同時 `where('itemId')` 與 `where('acknowledged')` | 缺 | ✅ **itemId + acknowledged + createdAt** |
| **maintenance_schedules** | `orderBy('scheduledDate')` | 缺（單欄可自動） | ✅ **scheduledDate**（可選，便於明確列出） |

## 2. Board of Directors 相關

| 集合 | 查詢 | 需複合索引？ |
|------|------|--------------|
| **boardMembers** | `where('isActive', '==', true)` | 否（單一 where） |
| **boardMembers** | `where('term', '==', year)` | 否（單一 where） |
| **boardTransitions** | `orderBy('transitionDate', 'desc')` | 否（單一 orderBy，自動單欄索引） |

**結論：Board of Director 無需額外複合索引。**

## 3. Mentorship 相關

| 集合 | 查詢 | 原有索引 | 本次補遺 |
|------|------|----------|----------|
| **mentorMatches** | `where('mentorId')` + `orderBy('createdAt', 'desc')` | 缺 | ✅ **mentorId + createdAt** |
| **mentorMatches** | `where('menteeId')` + `orderBy('createdAt', 'desc')` | 缺 | ✅ **menteeId + createdAt** |
| **mentorMatches** | `where('status', '==', 'completed')` | 單一 where | - |

## 4. Conversations / Messages 相關

| 集合 | 查詢 | 原有索引 | 本次補遺 |
|------|------|----------|----------|
| **conversations** | `where('participants', 'array-contains')` + `orderBy('lastActivity', 'desc')` | ✅ participants + lastActivity | - |
| **conversations** | `where('type', '==', 'direct')` + `where('participants', 'array-contains')` | 缺 | ✅ **type + participants** |
| **messages** | `where('conversationId')` + `orderBy('createdAt', 'desc'/'asc')` | ✅ 已有 | - |

## 5. Learning Path 相關

| 集合 | 查詢 | 原有索引 | 本次補遺 |
|------|------|----------|----------|
| **learningPaths** | `orderBy('createdAt', 'desc')` | 單欄自動 | - |
| **learningProgress** | `where('memberId')` + `orderBy('startedAt', 'desc')` | ✅ memberId + startedAt | - |
| **learningProgress** | 同上 + `where('pathId')` | ✅ memberId + pathId + startedAt | - |
| **certificates** | `where('memberId')` + `where('status')` + `orderBy('issuedAt', 'desc')` | 缺 | ✅ **memberId + status + issuedAt** |
| **certificates** | `where('certificateNumber')` + `where('verificationCode')` + `where('status')` | 缺 | ✅ **certificateNumber + verificationCode + status** |

---

## 已寫入 `firestore.indexes.json` 的新索引

- **mentorMatches**: mentorId ASC, createdAt DESC  
- **mentorMatches**: menteeId ASC, createdAt DESC  
- **conversations**: type ASC, participants ASC  
- **certificates**: memberId ASC, status ASC, issuedAt DESC  
- **certificates**: certificateNumber ASC, verificationCode ASC, status ASC  
- **inventory_alerts**: itemId ASC, acknowledged ASC, createdAt DESC  
- **maintenance_schedules**: scheduledDate ASC  

部署：`npx firebase deploy --only firestore:indexes`
