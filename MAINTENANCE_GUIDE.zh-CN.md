# JCI KL 未来开发与维护规范

生成时间：2026-08-24。来源：对当前代码库进行只读扫描。

## 维护原则

- Firestore Rules 和服务端函数才是安全边界；UI 权限只是体验层。
- 每个业务能力尽量只有一个 canonical 实现。
- 业务不变量优先放在纯工具函数或服务端 command handler，再由 UI/service 调用。
- 高风险状态变更必须幂等、可审计。
- 权限、财务、支付、自动化、会员身份、导入导出变更必须有测试。
- 重大功能变更后更新架构文档。

## 变更风险分类

开始开发前先分类：

- 低风险：纯 UI 展示、文案、小型纯工具函数且有测试。
- 中风险：service 读/query、非敏感表单、模块内组件重构。
- 高风险：Firestore 写入、权限、会员数据、财务、支付、集成、自动化/workflow、导入导出、serverless functions。
- 严重风险：角色变更、Firebase Admin、密钥/环境变量、生产支付 callback、批量破坏性操作、Firestore Rules。

高风险和严重风险变更必须包含影响说明、测试和回滚说明。

## AI 辅助开发必走流程

编辑前：

- 确认涉及领域：members、finance、events、projects、automation、integrations、system config 或 UI。
- 阅读对应 service、hook、component、type、Firestore rule 区块，以及相关 Netlify/Firebase function。
- 明确预期数据写入和权限边界。
- 检查是否已有相同逻辑，避免重复实现。

编辑中：

- 将变更限制在一个领域，除非明确做跨领域重构。
- 不新增第二套 workflow/payment/member rule engine。
- 不把密钥放进浏览器可见的 `VITE_` 变量。
- 不只依赖组件里的角色判断。
- 保留用户已有工作区改动，不随意 revert。

编辑后：

- 先跑最小相关测试。
- 修改 app 代码后跑 `npm run build` 验证 TypeScript/Vite。
- 修改 `firestore.rules` 或 service 写入形状后，增加或运行 Firestore rules tests。
- 新增/删除 runtime、模块、collection、主要 service 或 integration 后更新 `ARCHITECTURE.md`。
- 解决或发现风险后更新 `RISK_REGISTER.md`。

## 职责边界

### 前端组件

负责渲染、输入收集、loading/empty/error 状态和用户反馈。不应拥有授权规则、支付真相、workflow 真相或不可逆业务决策。

### Hooks

负责 React 状态编排和调用 services。不应重复 services 或 utils 已有的业务计算。

### Services

负责模块级应用操作。规则简单的读写可以直接访问 Firestore；特权写入应迁移到服务端函数。

### Netlify Functions

负责浏览器到服务端的特权 HTTP 操作、外部 API 调用、webhook 验证、Firebase Auth 管理操作、依赖密钥的行为。

### Firebase Cloud Functions

负责 Firestore 触发的后台行为、定时/异步领域处理、Firebase 原生事件。

### Firestore Rules

负责直接客户端 Firestore 访问的最终授权边界。

## Canonical 化优先级

1. 权限矩阵：定义每个角色在 UI、Rules、Functions 中的读写权限。
2. Workflow 引擎：从 `workflowService`、`automationService` 或服务端实现中选一个 canonical。
3. 会员写入路径：导入、注册链接、管理员编辑、promotion、email dedup 统一经过一个路径。
4. 支付真相：定义 Toyyib bills、callbacks、payment requests、finance transactions、reversal state 的唯一事实来源。
5. Webhook delivery：outbound webhook 执行和签名迁移到服务端。
6. 编码：源码和文档统一 UTF-8，修复用户可见乱码。

## 测试策略

### 单元测试

用于纯逻辑：

- 权限矩阵 helper
- membership type 计算
- board membership 与 finance operator 判断
- reference number 生成
- payment request 状态流转
- workflow condition evaluation
- import normalization
- 日期和 Malaysian ID 工具

### Firestore Rules Tests

使用 Firebase emulator 测试：

- `GUEST` 不能 list 敏感会员数据。
- `MEMBER` 只能读写预期个人资料字段。
- `BOARD` 不能提升用户为 `ADMIN` 或 `SUPER_ADMIN`。
- `INACTIVE` 不能 self-write 或访问 workspace 数据。
- finance collections 拒绝未授权写入。
- 多 LO 文档不能跨 `loId` 读写。

### Function Integration Tests

Mock Firebase Admin 和第三方 API，覆盖：

- ToyyibPay create bill 与 callback 幂等。
- Zoom create/cancel/webhook。
- Cloudinary delete。
- Lark sync 授权。
- Auth admin functions。
- Social AI rewrite 限制与授权。
- Send email/invite 的频率和 payload validation。

### 端到端 Smoke Tests

建议使用 Playwright 或同类工具覆盖：

- 访客 landing/events/projects/about 页面。
- login/logout。
- dashboard navigation。
- 不同角色模块可见性。
- member search/detail。
- payment request 创建/审批 happy path。
- ToyyibPay payment return 展示。

## 安全检查清单

- 除有意公开的 Firebase/browser config 外，不把密钥放进 `VITE_` 变量。
- service account JSON 不进入 Git 历史。
- 所有写特权数据的 Netlify Function 都验证 Firebase ID token。
- 所有特权函数都在服务端检查 Firestore 角色或 custom claims。
- Webhook 必须验证 signature 或 shared secret。
- Payment callback 必须幂等。
- 外部 URL 必须 allowlist 或 validate。
- 日志不包含 token、private key、银行资料、IC/passport number、完整支付 payload。
- 涉及金钱、状态流转、去重的 Firestore 写入使用 transaction/batch。
- Bulk import/export 仅 admin 可用且写 audit log。

## 文档规则

保持这些根目录文档为当前状态：

- `ARCHITECTURE.md`：当前实现地图。
- `RISK_REGISTER.md`：已知风险与缓解状态。
- `MAINTENANCE_GUIDE.md`：开发规则与质量门槛。

建议新增：

- `docs/PERMISSION_MATRIX.zh-CN.md`
- `docs/SERVER_FUNCTIONS.md`
- `docs/FIRESTORE_COLLECTIONS.md`
- `docs/WORKFLOW_ENGINE_DECISION.md`
- `docs/PAYMENT_STATE_MACHINE.md`

## 建议下一步

1. 初始化 Codegraph，用于未来影响面分析。
2. 检查 `.env` 与 `serviceAccountKey.json` 是否曾进入 Git 历史。
3. 建立权限矩阵。
4. 为 member 和 finance 边界增加 Firebase Rules tests。
5. 决定 canonical workflow/automation engine。
6. 修复用户可见字符串中的编码乱码。
7. 拆分 `App.tsx`，降低导航和权限变更的影响面。
