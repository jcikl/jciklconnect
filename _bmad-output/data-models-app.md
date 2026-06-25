# 数据模型 — App (Web)

## 概述

领域模型与 Firestore 文档形状由 **types.ts** 定义；前端通过 **services/** 读写对应集合。

## 核心类型与集合对应

（以下为逻辑对应，集合名以代码中实际使用的为准，部分来自 COLLECTIONS 或字面量。）

| 类型 (types.ts) | 说明 | 主要集合/用途 |
|-----------------|------|-------------------------------|
| UserRole, MemberTier | 枚举 | 会员角色与等级 |
| Member | 会员 | members |
| BoardMember, BoardTransition | 理事会与交接 | boardMembers, boardTransitions |
| Badge, BadgeCriteria, BadgeAward | 徽章 | 游戏化 |
| Achievement, AchievementCriteria, AchievementAward, AchievementMilestone | 成就 | 游戏化 |
| PointsRule, PointsRuleCondition, PointsRuleExecution | 积分规则 | 游戏化 |
| MentorMatch, CareerMilestone, BoardPosition | 导师与履历 | members 相关 |
| BusinessProfile, InternationalConnection | 商业目录 | members 子集/关联 |
| InventoryItem | 库存 | inventory |
| Transaction, TransactionSplit, BankAccount, Reconciliation | 财务 | transactions, transactionSplits, bankAccounts, reconciliations |
| Workflow, AutomationRule, WorkflowExecution | 自动化 | workflows, automationRules, workflowExecutions |
| MemberBenefit, BenefitUsage | 会员福利 | memberBenefits, benefitUsage |
| Advertisement, PromotionPackage | 广告与推广包 | advertisements, promotionPackages |

## 重要字段摘要

- **Member**：id, name, email, role, tier, points, joinDate, duesStatus, membershipType, boardHistory, probationTasks, 联系方式、商业信息、服装与物品等。
- **Transaction/Finance**：拆分与对账通过 transactionSplits 与 reconciliations 支持。
- **Governance**：投票与选举由 Cloud Functions 计算，数据存于 Firestore（具体集合见 governance 相关服务）。

## 说明

- 完整接口与可选字段见 **types.ts**（约 1388 行）。
- Firestore 无强制 schema；类型与校验在应用层（types + 服务层）维护。
