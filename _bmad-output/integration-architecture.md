# 集成架构 — App 与 Functions

## 概览

- **App**：React SPA，通过 Firebase JS SDK 直连 Firestore、Auth、Storage。
- **Functions**：Firebase Cloud Functions，提供 Callable、HTTP 与 Firestore/PubSub 触发器。
- 二者共享同一 **Firebase 项目**，无独立 REST 网关。

## 数据流

```
用户浏览器
    │
    ├── Firebase Auth（登录/注册）
    ├── Firestore（读/写） ←→ services/*.ts
    ├── Storage（若使用）
    └── HTTPS Callable ──→ Cloud Functions (onCall)
                                │
                                └── Firestore (Admin SDK)、外部 API 等
```

## 前端 → 后端调用

- 前端通过 `getFunctions().httpsCallable('functionName')(data)` 调用 onCall 函数。
- 典型用途：投票/选举结果计算、财务报表生成、银行对账、会费续费、工作流执行、积分计算、通知发送等。
- 认证：Callable 自动携带 Id Token；函数内通过 `context.auth` 校验。

## 后端触发器

- **Firestore**：文档创建/更新时触发（如徽章发放、成就进度、自动化规则、交易拆分校验、会员晋升）。
- **PubSub**：定时任务（如会费提醒、活动提醒）。

## 安全与权限

- Firestore 安全规则控制客户端可读写集合与字段。
- Functions 内需根据 `context.auth` 与业务规则再次校验，避免越权。

## 部署关系

- App 部署到静态托管（如 Firebase Hosting 或其它 CDN）。
- Functions 独立部署：`firebase deploy --only functions`。
- 二者通过 Firebase 项目 ID 与区域关联，无需配置“后端 URL”。
