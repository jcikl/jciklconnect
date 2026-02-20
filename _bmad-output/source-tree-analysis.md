# 源码树与关键目录说明

## 项目根（App — Web）

```
project-root/
├── index.html              # SPA 入口
├── index.tsx               # React 入口
├── App.tsx                 # 根组件、路由
├── package.json            # 依赖与脚本 (React, Vite, Firebase, Vitest)
├── vite.config.ts          # Vite 配置、别名 @/*
├── tsconfig.json            # TypeScript 配置
├── tailwind.config.js       # Tailwind、JCI 主题色
├── components/              # UI 组件
│   ├── auth/               # 登录、注册弹窗
│   ├── dashboard/          # 仪表盘、分析、看板
│   ├── modules/            # 业务模块视图（会员、活动、财务、治理、游戏化、自动化等）
│   ├── ui/                 # 通用 UI（表单、表格、分页、加载、错误边界等）
│   ├── accessibility/      # 无障碍组件
│   ├── performance/        # 懒加载、虚拟列表、性能监控
│   └── dev/                # 开发工具（如角色模拟）
├── services/               # 数据访问与业务逻辑（Firestore、Auth）
├── hooks/                  # React hooks
├── config/                 # 全局配置（若存在）
├── utils/                  # 工具函数
├── types.ts                # 全局 TypeScript 类型与接口
├── docs/                   # 现有文档（README、架构、开发、API、用户指南）
└── _bmad-output/           # 本工作流生成的文档输出
```

## functions/（Backend — Cloud Functions）

```
functions/
├── package.json            # Node 18, firebase-admin, firebase-functions
├── tsconfig.json
├── src/
│   ├── index.ts            # 导出与 healthCheck
│   ├── notifications.ts    # 通知、提醒（onCall + pubsub）
│   ├── governance.ts       # 投票、选举（onCall）
│   ├── gamification.ts     # 徽章、成就、积分（onCall + firestore 触发器）
│   ├── automation.ts       # 工作流执行与规则（onCall + firestore）
│   ├── financial.ts        # 报表、对账（onCall + firestore）
│   └── membership.ts       # 会费续费、晋升（onCall + firestore）
└── lib/                    # 编译输出 (main: lib/index.js)
```

## 关键目录用途

| 路径 | 用途 |
|------|------|
| components/modules | 业务功能入口视图（Members, Events, Finance, Governance, Gamification, Automation 等） |
| services | Firestore/业务 API 封装，被组件与 hooks 调用 |
| types.ts | 单文件集中定义领域模型与枚举 |
| functions/src | 服务端逻辑与可调用接口、触发器 |

## 入口与构建

- **App**：`index.html` → `index.tsx` → `App.tsx`；开发 `npm run dev`，构建 `npm run build`。
- **Functions**：`npm run build` 编译 TypeScript → `lib/`；部署 `firebase deploy --only functions`。
