# Firestore 索引檢查報告

## 已補上的複合索引（已寫入 `firestore.indexes.json`）

以下索引對應程式碼中的查詢，原本未定義或欄位名與現有索引不符，已全部補上。

| 集合 | 查詢用途 | 欄位 |
|------|----------|------|
| **members** | 排行榜 `getLeaderboard`（pointsService） | `leaderboardVisibility` ASC, `points` DESC |
| **members** | 商業名錄依產業（businessDirectoryService） | `industry` ASC, `companyName` ASC |
| **members** | 會費續會查詢（duesRenewalService） | `duesYear` ASC, `duesStatus` ASC, `name` ASC |
| **events** | 即將舉辦活動（date >= now, status == Upcoming） | `date` ASC, `status` ASC |
| **events** | 依類型查活動（eventsService.getEventsByType） | `type` ASC, `date` DESC |
| **tasks** | 專案任務依到期日（projectsService） | `projectId` ASC, `dueDate` ASC |
| **advertisements** | 依優先級與建立時間（advertisementService） | `priority` DESC, `createdAt` DESC |
| **transactions** | 依交易類型（financeService） | `transactionType` ASC, `date` DESC |
| **transactions** | 依類別（getTransactionsByCategory） | `category` ASC, `date` DESC |
| **notifications** | 會員通知依時間與已讀（communicationService） | `memberId` ASC, `timestamp` DESC, `read` ASC |
| **reconciliations** | 依銀行帳戶對帳（financeService） | `bankAccountId` ASC, `reconciliationDate` DESC |
| **benefitUsage** | 依 benefitId / memberId 與使用時間（memberBenefitsService） | `benefitId` ASC, `usedAt` DESC；`memberId` ASC, `usedAt` DESC |
| **workflow_executions** | 依 workflowId 與開始時間（automationService） | `workflowId` ASC, `startedAt` DESC |
| **inventory** | 依類別與名稱（inventoryService） | `category` ASC, `name` ASC |
| **inventory_alerts** | 依 itemId 與建立時間 | `itemId` ASC, `createdAt` DESC |
| **surveyResponses** | 依問卷與提交時間（surveysService） | `surveyId` ASC, `submittedAt` DESC |
| **documents** | 依類別與上傳日期（knowledgeService） | `category` ASC, `uploadedDate` DESC |
| **achievements** | 有效成就依 tier/name（achievementService） | `active` ASC, `tier` ASC, `name` ASC |
| **achievementAwards** | 會員成就依獲得時間 | `memberId` ASC, `earnedAt` DESC |
| **webhook_logs** | 依 webhook 與觸發時間（webhookService） | `webhookId` ASC, `triggeredAt` DESC |
| **duesRenewals** | 依會員/年度、依年度與建立時間（duesRenewalService） | `memberId` ASC, `duesYear` ASC；`duesYear` ASC, `createdAt` DESC |

## 與程式碼欄位不一致的既有索引（僅供參考）

- **events**：現有索引使用 `startDate` / `endDate`，程式使用 `date`。已另加 `date` 的複合索引，不刪除舊索引以免影響其他可能用法。
- **notifications**：現有索引為 `memberId` + `read` + `createdAt`，程式查詢為 `memberId` + `timestamp` + `read`。已補上 `memberId` + `timestamp` + `read`。

## 僅單一 orderBy 的查詢（無須複合索引）

下列查詢只使用單一欄位 `orderBy`，Firestore 會自動建單欄索引，無須在 `firestore.indexes.json` 中宣告：

- `communication`: orderBy('timestamp', 'desc')
- `projects`: orderBy('createdAt', 'desc')
- `financeService` 全部交易: orderBy('date', 'desc')
- `memberBenefits`: orderBy('createdAt', 'desc')
- `surveys`: orderBy('createdAt', 'desc')
- `documents`: orderBy('uploadedDate', 'desc')（無 where）
- `webhooks`: orderBy('createdAt', 'desc')
- `boardTransitions`: orderBy('transitionDate', 'desc')
- 其他僅 where 或僅單一 orderBy 的查詢

## 第二輪補遺（本次新增）

| 集合 | 查詢用途 | 欄位 |
|------|----------|------|
| **pointsRules** | 依權重與名稱排序（pointsRuleService） | `weight` DESC, `name` ASC |
| **pointsRuleExecutions** | 依規則查執行記錄 | `ruleId` ASC, `executedAt` DESC |
| **inventory_alerts** | 依已確認狀態篩選（inventoryService） | `acknowledged` ASC, `createdAt` DESC |
| **conversations** | 參與者的對話列表（array-contains + orderBy） | `participants` ASC, `lastActivity` DESC |
| **messages** | 對話訊息列表（getMessages / subscribe） | `conversationId` ASC, `createdAt` DESC/ASC |
| **documentVersions** | 文件版本列表（documentsService） | `documentId` ASC, `version` DESC |
| **emailLogs** | 依 to/status/provider 篩選（emailService） | `to`/`status`/`provider` ASC, `createdAt` DESC |
| **learningProgress** | 會員學習進度、依 pathId 篩選 | `memberId`+`startedAt`；`pathId`+`startedAt`；`memberId`+`pathId`+`startedAt` |
| **votes** | 依狀態與建立時間（votingService） | `status` ASC, `createdAt` DESC |
| **badges** | 依 tier 與 name（badgeService） | `tier` ASC, `name` ASC |
| **activityPlans** | 依狀態篩選（activityPlansService） | `status` ASC, `createdAt` DESC |
| **templates** | 依 templateType 與 name（templatesService） | `templateType` ASC, `name` ASC |

## 部署方式

更新 `firestore.indexes.json` 後，請執行：

```bash
npx firebase deploy --only firestore:indexes
```

索引建立可能需要數分鐘，可在 Firebase Console → Firestore → 索引 中查看狀態。
