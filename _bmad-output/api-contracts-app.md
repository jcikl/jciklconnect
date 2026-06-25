# API / 数据访问契约 — App (Web)

## 概述

前端不暴露 REST API，通过 **Firebase 客户端 SDK** 直接访问 Firestore、Auth、Storage。业务逻辑封装在 **services/** 层，对外表现为“数据访问 API”。

## 数据访问层（按服务）

| 服务文件 | 主要集合 (Firestore) | 典型操作 |
|----------|----------------------|----------|
| boardManagementService | boardMembers, boardTransitions | getDocs, addDoc, updateDoc |
| advertisementService | advertisements, promotionPackages | getDocs, getDoc, addDoc, updateDoc, deleteDoc |
| businessDirectoryService | members (companyName 等) | getDocs, getDoc |
| memberBenefitsService | memberBenefits, benefitUsage | getDocs, getDoc, addDoc, updateDoc, deleteDoc |
| automationService | workflows, automationRules, workflowExecutions | getDocs, getDoc, addDoc, updateDoc, deleteDoc |
| financeService | transactions, transactionSplits, bankAccounts, reconciliations | getDocs, getDoc, addDoc, updateDoc, deleteDoc |
| membersService | members | getDocs, getDoc, addDoc, updateDoc, deleteDoc |
| eventsService | events 相关 | 活动 CRUD、注册 |
| inventoryService | inventory 相关 | 库存 CRUD |
| surveysService | surveys 相关 | 问卷 CRUD |

## 认证与权限

- **Firebase Auth**：登录/注册（LoginModal, RegisterModal）。
- **UserRole**（types.ts）：GUEST, PROBATION_MEMBER, MEMBER, BOARD, ADMIN；权限控制基于角色。

## 集合命名

- 部分服务使用 `COLLECTIONS.*` 常量（可配置），回退为英文集合名（如 `advertisements`, `memberBenefits`, `workflowExecutions`）。

## 说明

- 无 HTTP 路径或请求体契约；“API”即上述服务导出的异步函数及所用 Firestore 集合与字段。
- 云端可调用逻辑见 **api-contracts-functions.md**。
