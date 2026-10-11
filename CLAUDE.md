# CLAUDE.md

本文件是 AI 在本项目工作的长期规则，每次对话自动读取。只放规则和指引；历史记录、当前任务、字段与权限细节都在各自的文档里（见第 7 节）。

---

## 1. 红线（必须遵守）

**以下操作必须先向用户说明并得到明确同意，才能执行：**

- 部署（`firebase deploy`、Netlify 发布等）——AI 永远不主动部署
- 修改权限：放宽 `firestore.rules`、改变角色边界
- 删除字段、集合或功能；数据迁移、批量回写或任何不可逆修改
- 改变数据结构、跨集合联动、公共 API 或整体架构
- 引入新的 npm 依赖（说明用途、压缩后体积、为何不能自己写）
- 超出用户要求或 `TODO.md` 当前任务范围的工作

**以下行为禁止：**

- 静默吞掉错误（失败必须记录并让用户看得到）
- 在功能目录里复制一份已有的 UI 组件或 hook
- 跳过文档同步就标记任务完成

**记忆文件规定：** 每次新建或删除记忆文件，必须同时更新 `MEMORY.md` 索引（一行一条：`- [标题](文件名.md) — 一句话摘要`），并检查没有孤立文件：目录里每个 `.md` 在索引里都有条目，索引里每个条目都指向存在的文件。

---

## 2. 项目简介与命令

JCI 吉隆坡分会管理系统（会员、活动、项目、财务、积分、治理、AI 分析）。
技术栈：React 19、TypeScript 5.8（strict）、Vite 6、Tailwind、React Router v7、Firebase（Firestore / Auth / Storage / FCM）、Netlify Functions、Cloudinary、ToyyibPay。

```bash
npm run dev          # 开发服务器，端口 3000
npm run build        # 生产构建（含 tsc 类型检查，这是唯一的 lint 关卡）
npm run preview      # 预览生产构建
npm run dev:a11y     # 带 axe-core 无障碍扫描的开发服务器
npm test             # Vitest 测试
npm run test:ui      # Vitest 浏览器界面
```

路径别名：`@/*` 指向项目根目录（如 `@/services/...`）。

---

## 3. 代码分层与数据流

```
index.tsx            → 全局 Provider（AuthContext、Toast、A11y）
App.tsx              → 路由、懒加载模块、布局
components/modules/  → 功能页面（必须用 React.lazy 懒加载）
hooks/               → 数据钩子：包装 service，管理 loading / error 状态
services/            → 业务逻辑 + 所有 Firestore 读写（静态类，不持有 React 状态）
config/firebase.ts   → Firebase 初始化
config/constants.ts  → 集合名称、角色常量
types.ts             → 所有业务类型定义
```

- **调用方向固定**：页面 → hook → service → Firestore。页面不能直接调用 service。
- **登录与权限**：`hooks/useAuth.tsx` 管登录状态；`hooks/usePermissions.ts` 管所有权限判断。角色：`GUEST → MEMBER → BOARD → ADMIN → SUPER_ADMIN / INACTIVE`。
- **全局状态**：不用 Redux / Zustand。只有 AuthContext + Firestore 实时监听，局部状态留在组件里。
- **开发模式**：`utils/devMode.ts` 的 `isDevMode()` 为真时，service 返回模拟数据，不连 Firebase。
- **缓存**：`cacheService.ts` 提供带过期时间（通常 3–5 分钟）的内存缓存，可按前缀清除。
- **错误处理**：异步操作用 `errorLoggingService` 记录；页面级错误用 `components/ui/` 里的 `ErrorBoundary` / `AsyncErrorBoundary`。
- **部署**：Netlify 为主（`netlify.toml`、`netlify/functions/`）；Firebase Hosting 为辅（`firebase.json`，含 rules 和 Cloud Functions）；PWA 推送用 `public/firebase-messaging-sw.js`。
- **会员数据结构**：`Member` 分为 `general / contact / business / jciCareer` 子对象，同时保留平铺别名以兼容旧数据。

---

## 4. 写数据库的强制规则

### 4.1 动手前先查有没有现成的

- 先在 `hooks/` 找已有的 hook：已有就直接用；缺一个方法就加在原 hook 里；只有不同集合或不同生命周期才新建 `hooks/useXxx.ts`。
- 先在 `services/` 找已有的方法：已有就调用；差一个参数就加可选参数，不要影响现有调用方。

### 4.2 新 service 方法的固定写法

1. 写成 service 类上的 `static async` 方法
2. 开头检查 `isDevMode()`，返回模拟数据
3. 先读缓存（`cacheService`，3–5 分钟），再查 Firestore
4. 写入多个文档时必须用 `writeBatch`，不能分开发送
5. 每个写入路径（包括批量版本）完成后都必须调用 `invalidateXxxCache()`
6. 错误要向上抛出，并用 `errorLoggingService` 记录，不能吞掉

### 4.3 新增或修改任何读写操作前，先回答这些问题

**写入（新建 / 更新）：**
- **联动写**：其他集合要不要同步写？是否放在同一个 `writeBatch` 里？
- **冗余字段**：被改的字段在别的集合有没有副本（如 `member.name` → `eventRegistrations.memberName`）？谁负责同步？
- **缓存**：要清哪些缓存？按 LO、按状态分组的缓存键有没有一起清？
- **前置校验**：状态变化是否合法（如付款申请必须是 `pending` 才能批准）？`firestore.rules` 里有没有对应的字段白名单 `hasOnly([...])` 和必填检查 `hasAll([...])`？

**删除：**
- 哪些集合还引用这条记录的 ID？（在 `types.ts` 搜 `xxxId`）这些记录应该一起删除、标记为已删除，还是保留但断开引用？
- 删除前要不要先检查它是否仍被引用？
- 能撤回吗？如果用软删除（`isDeleted: true`），所有读取这个集合的查询是否都已过滤掉软删记录？

**通用：**
- 附带操作（通知、积分、同步）必须在主文档写入成功之后再触发。
- service 层的权限判断改了，`firestore.rules` 必须同步改。

### 4.4 单个版与批量版必须一致

同一个操作有单个版和批量版（或多个入口）时，权限检查、撤回机制、联动写入、缓存清理四项必须完全一致。只修一个入口等于另一个入口还有漏洞。

---

## 5. UI 组件规则

- 写 UI 之前，先看 `components/ui/Common.tsx`（Button、Card、Modal、Badge、Drawer、Toast、ProgressBar、Table、Spinner、EmptyState、ConfirmDialog）、`components/ui/Form.tsx`（Input、Select、Checkbox、FormField、Textarea）和 `components/ui/Combobox.tsx`（可搜索下拉）。也扫一眼 `components/ui/` 里有没有新增的组件。
- **已有组件能用** → 直接用。
- **差一个属性或样式** → 在原组件上扩展，保持向后兼容。
- **全新需求且会在 2 处以上用到** → 在 `components/ui/` 新建，类型完整，并支持浅色和深色主题（用 CSS 变量）。
- **只用一次** → 写在功能组件里，不要抽出来。

**顺手改进的范围：** 修改某个组件或 hook 时，可以顺手补上同一文件里缺的加载状态（`Spinner` 或禁用按钮）、空状态（`EmptyState`）、错误提示（`useToast`）、手机布局（宽度 < 640px 不崩）和不完整的类型。前提是**只限同一文件、低风险、不改变功能**，并在汇报里列出来。其他发现一律登记到 `TODO.md`，不能顺手改。需要理解整个功能才能改的，留 `// TODO:` 注释。

**提交前自检：**
- 没有重复已有的 UI 组件或 hook 查询
- 新 service 方法都有开发模式路径
- 多文档写入都用了 `writeBatch`，写入后都清了缓存
- 新 UI 组件支持浅色和深色主题

---

## 6. Firestore 规则陷阱

- 列表查询（list / query）规则里**不能**用 `resource.data`，它只对单文档 get 有效。管理员批量扫描或迁移的规则必须在最前面加 `isAdmin() ||`。
- `allow read` 和 `allow update` 是两道独立的门，迁移（先读后改）两条规则都要单独加 `isAdmin()`。
- `transactions` 集合没有 `loId` 字段，LO 归属要通过 `bankAccountId → bankAccounts.loId` 间接判断。
- 集合名称统一在 `config/constants.ts` 里，不要在代码里写死。

---

## 7. 文档分工与工作流程

### 每次任务开始时的阅读顺序

1. `CLAUDE.md`：长期规则（本文件）
2. [`AGENT-EXECUTION.md`](AGENT-EXECUTION.md)：自动推进流程、必须暂停确认的情况、停止条件
3. [`TODO.md`](TODO.md)：当前目标、任务范围、待确认事项、完成记录
4. 相关代码和 `firestore.rules`：系统实际怎么运行的**第一手证据**
5. [`SCHEMA.md`](SCHEMA.md)：集合字段、类型和"来 / 往"字段流（填写规则见该文件开头）
6. [`SCHEMA-PERMISSIONS.md`](SCHEMA-PERMISSIONS.md)：各角色的读写权限矩阵

### 每份文档管什么

| 文档 | 负责内容 |
|---|---|
| `CLAUDE.md` | 长期规则、开发流程、范围控制、文档治理 |
| `AGENT-EXECUTION.md` | 自动推进循环的详细步骤 |
| `TODO.md` | 当前目标、验收标准、范围外发现、完成记录 |
| `SCHEMA.md` | 字段路径、类型、必填、枚举、"来 / 往"字段流 |
| `SCHEMA-PERMISSIONS.md` | 角色、操作权限、字段限制、权限风险 |
| `firestore.rules` | 实际生效的访问规则；文档不得声称规则里没有的权限 |
| [`docs/ANALYSIS-HISTORY.md`](docs/ANALYSIS-HISTORY.md) | 历次集合扫描结果与修复记录（只追加，不当规则用） |

### 工作规矩

- **来源冲突**：代码、rules 和文档说法不一致时，不要自己挑一个。以代码和 rules 为当前事实，把差异登记到 `TODO.md`，再按用户确认的意图修代码或文档。
- **范围外发现**：登记到 `TODO.md` 的"待确认"或"后续任务"，写明来源、影响、涉及文件、完成标准。
- **完成前检查**：列出这次影响到的代码、集合、权限和流程，确认对应文档都已更新。没有更新的，要在 `TODO.md` 里写明原因和后续任务。
- **新建文档**：先确认没有现成文档负责这个主题；在新文档开头写清楚用途；从本文件或相关文档加链接；在 `TODO.md` 的"文档创建记录"里登记原因。规则写在本文件，新文档只放细节。
- **用户说"继续"**：按 `AGENT-EXECUTION.md` 的流程执行。

---

## 8. 引入外部库或新方法的判断

| 问题类型 | 做法 |
|---|---|
| 复杂交互（日期选择、拖拽、富文本、虚拟滚动） | 优先评估现成库 |
| 简单 UI（按钮、卡片、表单） | 扩展 `components/ui/`，不引入库 |
| 数据处理（图表、Excel、PDF、CSV） | 先评估体积影响，再决定 |
| 业务逻辑（会籍、对账、积分计算） | 一律自己写 |
| Firebase / 登录 / 路由 | 沿用现有技术栈，不替换 |

评估一个库要看四点：体积（不能让页面加载超过 2 秒）、维护是否活跃且兼容 React 19、能否和 Tailwind / Firebase / hook 结构共存、至少用到它 30% 的功能。决定使用后**按红线先问用户**；获批后，大的库要懒加载，并在代码注释里写明选它的理由。拿不准时先自己写，并留 `// TODO: 若需求变复杂，评估 [库名]`。

**同类问题反复出现时**（同一种 bug 出现在多个 service、同一种分析要重复做），先找现成方案：依次查 `.claude/commands/` 里的 skill、成熟的 AI 工作流做法、业界通用方法（如 ADR、契约测试）。采用后必须沉淀下来：可重复执行的任务做成 `.claude/commands/` 里的 skill，长期规则写进本文件。不能只留在对话里。

---

## 9. 可用 skill

| 命令 | 用途 |
|---|---|
| `/start jciklconnect` | 读取 `TODO.md` 并执行当前目标 |
| `/analyze-collection [集合名]` | 对集合做完整的逻辑错误扫描（v3 七合一报告）；不带参数时扫描全部集合；多个集合会自动并行 |
| `/collection-deps [集合名]` | 分析某个集合和其他集合的联动关系与孤儿风险 |
| `/develop-feature` | 按项目规范开发新功能 |

分析报告里的"修复原因 / 修复建议"必须用大白话写，规则见 `.claude/commands/analyze-collection.md`。
