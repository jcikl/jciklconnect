# CLAUDE.md — JCIKL Connect

> 本文件是每次对话的入口：**行为规范 + 硬规则 + 文件索引**。细节不写在这里，写在索引指向的文件里。
> 行为规范基于 [andrej-karpathy-skills](https://github.com/multica-ai/andrej-karpathy-skills)，并按本项目定制。

---

## 1. 项目速览

JCI Kuala Lumpur 分会管理系统（PWA）：会员、活动、项目、财务、积分、治理。

| 项目 | 内容 |
|---|---|
| 技术栈 | React 19 · TypeScript 5.8 strict · Vite 6 · Tailwind · React Router v7 · Firebase（Firestore / Auth / Storage / FCM）· Capacitor（Android） |
| 后端 | Firebase Cloud Functions（`functions/src/`）+ Netlify Functions（`netlify/functions/*.mjs`） |
| 第三方 | Cloudinary · ToyyibPay · Zoom · Lark |
| 部署 | Netlify（主）· Firebase Hosting（副）· PWA via `vite-plugin-pwa` |
| 路径别名 | `@/*` → 项目根目录 |

```bash
npm run dev        # Vite :3000
npm run build      # 生产构建（Vite，不含类型检查）
npm run typecheck  # tsc 严格检查（见 §3 ⑤ 基线）
npm test           # Vitest
npm run dev:a11y   # 开启 axe 无障碍扫描
```

---

## 2. 行为规范（Karpathy 四原则 · 本项目版）

### 2.1 先想清楚再写（Think Before Coding）
- 不确定就问，不要猜。有多种理解时，列出来让我选。
- 发现更简单的做法，直接说出来；该反对时就反对。
- 看不懂某段代码的意图，停下来说明哪里不懂，不要"顺着猜下去"。

### 2.2 简单优先（Simplicity First）
- 只做被要求的事。不加没要求的功能、配置项、抽象层。
- 一次性的代码不做抽象。能 50 行解决的，不写 200 行。
- 检验：资深工程师看了会觉得"过度设计"吗？会就简化。

### 2.3 外科手术式修改（Surgical Changes）
- 每一行改动都必须能追溯到本次需求。
- 不"顺手改进"相邻代码、注释、格式；不重构没坏的东西；沿用现有风格。
- 发现无关的问题（死代码、缺 loading 状态、重复函数）→ **在交付说明里列出，不改**。
- 只清理**你这次改动**造成的无用 import / 变量 / 函数。
- 本项目有 5 个超过 1,500 行的大文件（见 CAPABILITIES §1.5），修改时只动目标函数，**禁止整文件重写**。

### 2.4 目标驱动执行（Goal-Driven Execution）
- 把任务转成可验证的目标：修 bug → 先写复现测试；加校验 → 先写失败用例；重构 → 前后测试都通过。
- 多步骤任务先给计划，每步附验证方式：
  ```
  1. [步骤] → 验证：[如何确认]
  2. [步骤] → 验证：[如何确认]
  ```

### 2.5 力度按风险调整
沿用 `MAINTENANCE_GUIDE.md` 的风险分级：

| 等级 | 例子 | 要求 |
|---|---|---|
| 低 | 文案、纯展示、小型纯函数 | 可直接做，跑 build |
| 中 | service 查询、一般表单、模块内重构 | 第 3 节流程 + build + 相关测试 |
| 高 | Firestore 写入、权限、会员数据、财务、付款、自动化、导入导出、serverless | 完整流程 + 测试 + 影响说明 + 回滚说明 |
| 极高 | 角色变更、Firebase Admin、密钥、正式付款回调、批量删除、`firestore.rules` | 同上，且**先提计划、等我确认再动手** |

---

## 3. 任务流程（每个任务都走）

```
① 理解 → ② 复用闸门 → ③ 计划 → ④ 修改 → ⑤ 验证 → ⑥ 同步文件 → ⑦ 交付说明
```

| 步骤 | 做什么 | 产出 |
|---|---|---|
| ① 理解 | 复述需求；列出假设与不确定点；判定风险等级 | 不清楚就提问，不进入下一步 |
| ② 复用闸门 | 见第 4 节 | ✅ / 🔧 / 🆕 结论 |
| ③ 计划 | 列出要改的文件与每步验证方式 | 中风险以上必须先给计划 |
| ④ 修改 | 遵守 2.3 与第 5 节硬规则 | 最小 diff |
| ⑤ 验证 | `npm run build` 通过；`npm run typecheck` 错误数 ≤ 基线 **123**；相关测试通过；涉及写入则补测试。基线只降不升，降低时同步更新此数字 | 贴出验证结果 |
| ⑥ 同步文件 | 按第 6 节「改了什么 → 更新哪里」 | 同一个 PR 内完成 |
| ⑦ 交付说明 | 改了什么、为什么、怎么验证、**发现但没改的问题** | 简短清单 |

---

## 4. 复用闸门（Reuse-First Gate，强制）

**写任何新的函数 / hook / service / UI 元件之前：**

1. 查 `CAPABILITIES.md`（能力地图），用关键字搜索，例如 member、payment、format、attendance、avatar。
2. 用代码验证：`grep -rn "关键字" services hooks utils components/ui components/shared`
3. 在计划中明确写出三者之一：
   - ✅ **复用**：`<路径>.<函数名>`
   - 🔧 **扩充**：`<路径>`，原因：<现有的为什么不够>（加可选参数，不破坏现有调用方）
   - 🆕 **新建**：已查 `<列出查过的文件>`，都不适用
4. 新建或扩充 export → 同一个 PR 内执行 `python scripts/gen-capabilities.py` 更新能力地图。
5. CAPABILITIES §1.4 列出的「疑似未使用」文件（例如 `reconciliationService`、`workflowService`）→ 新建同类功能前，**先确认它们是否就是你要的**。

已知不要再重写的：`formatCurrency`（`utils/formatUtils.ts`）、`formatDate` / `formatDateTime` / `isFuture`（`utils/dateUtils.ts`）。

---

## 5. 硬规则（违反即视为未完成）

### 5.1 分层
```
components → hooks → services → Firestore
```
- 元件**不得**直接 import `firebase/firestore`（现有 10 处违规见 CAPABILITIES §1.3，不要新增）。
- 元件调用 hook，不直接调用 service；hook 不持有业务规则；service 是无 React state 的 static class。
- 全局状态只有 AuthContext + Firestore 监听；不引入 Redux / Zustand。
- 新模块视图在 `App.tsx` 用 `React.lazy()` 加载。

### 5.2 新 service 方法的固定模式
- `static async` 方法
- 开头 `isDevMode()` 检查，dev 模式返回 mock 数据
- 读取前查 `cacheService`（TTL 3–5 分钟）
- 多文档写入必须用 `writeBatch`
- 每条写入路径（包括批量变体）都调用 `invalidateXxxCache()`，**含按 LO / 状态分组的缓存键**
- 错误必须抛出，并经 `errorLoggingService` 记录，不能吞掉
- 先写主文档，成功后才触发副作用（通知、积分、同步）

### 5.3 Firestore 写操作
- 动笔前必须回答 `docs/development/CRUD_CHECKLIST.md` 的四组问题：联动写、冗余字段同步、缓存清理、前置校验；删除时还要回答孤儿风险与退回路径。
- service 层的权限判断改了 → `firestore.rules` 同步改。
- 单个版与批量版必须对称：权限守卫、回滚、联动写、缓存清理四项一致。
- `resource.data` 不能用于 list/query 规则；批量扫描规则前面要加 `isAdmin() ||`。
- `read` 和 `update` 是两道独立的门，迁移操作两条都要放行。
- `transactions` 没有 `loId`，LO 归属经由 `bankAccountId → bankAccounts.loId`。

### 5.4 UI
- 先用 `components/ui/` 现有元件（清单见 CAPABILITIES §5）。缺一个 prop 或变体 → 在原元件上扩充，**不建** `MySpecialButton` 之类的副本。
- 新的通用元件放 `components/ui/`，必须支持亮色与暗色主题（CSS 变量），且在 640px 以下不破版。

### 5.5 不要提交的东西
- 暂存文件、编译错误输出、个人路径文件（例如根目录那个 `...tsc_errors.txt`）。
- 密钥与 `.env*`。

---

## 6. 文件索引：改了什么 → 读哪里 / 更新哪里

| 文件 | 职责（唯一事实来源） | 何时**读** | 何时**更新** |
|---|---|---|---|
| `CAPABILITIES.md` | 系统已有什么能力 | 每个任务的第 ② 步 | 新增 / 改名 / 删除 export（用脚本重新生成） |
| `ARCHITECTURE.md` | 分层与模块边界 | 跨模块改动 | 新增模块或改变分层 |
| `SCHEMA.md` | 集合字段与「来 / 往」流向 | 涉及字段读写 | 新增、改名、删除字段，或改变联动 |
| `SCHEMA-PERMISSIONS.md` | 各集合 get/list/create/update/delete 权限 | 涉及权限或规则 | 改 `firestore.rules` |
| `docs/PERMISSION_MATRIX.zh-CN.md` | 角色 × 功能权限矩阵 | 涉及角色可见性 | 改 `usePermissions` / 角色规则 |
| `docs/development/CRUD_CHECKLIST.md` | 写操作前置检查（完整版） | 任何 Firestore 写入 | 发现新的一类写入陷阱 |
| `docs/development/LAYER_RULES.md` | UI 与数据层协议（完整版） | 新 UI / hook / service | 协议变更 |
| `docs/development/DECISION_PROTOCOLS.md` | 引入第三方库 / 新 skill 的决策 | 考虑加依赖或建 skill | 协议变更 |
| `docs/collections/ANALYSIS_FRAMEWORK.md` | 集合系统性分析六步框架 | 被要求分析集合时 | 框架升级 |
| `docs/collections/ANALYSIS_LOG.md` | 集合分析结果与待修 P0 | 改动已分析过的集合前 | 每次分析完成后**追加** |
| `MAINTENANCE_GUIDE.md` | 风险分级、测试策略、安全清单 | 高 / 极高风险任务 | 流程变更 |
| `RISK_REGISTER.md` | 已知风险与技术债 | 改动相关区域前 | 发现新风险（交付说明里列出的问题） |

**原则：** 同一个事实只写在一个文件里；其他地方只放链接。本文件不记录分析结果、不记录进度。

### 6.1 Schema「来 / 往」栏位规则（摘要）
- **来**＝字段的实际写入来源（角色、服务、计算、导入、其他集合）；**往**＝写入后的实际使用目标。
- 跨集合关系写成 `` `collection.field` ``；冗余字段要注明复制来源，以及是否自动回写。
- 只有代码能证明时才标记「系统自动」；无法确认就留空，**不得按字段名猜测**。

---

## 7. Memory 文件协议

每次新增或删除 memory 文件，必须同时：
1. 更新 `MEMORY.md` 索引（一行：`- [标题](文件名.md) — 一句话摘要`）
2. 确认没有孤儿：目录里每个 `.md` 都在索引中，索引里每一项都指向存在的文件

---

## 8. 怎么判断这份规范有效

- diff 里只有被要求的改动
- 很少因为过度设计而重写
- 澄清问题出现在动手**之前**，而不是出错之后
- 不再出现新的重复函数（CAPABILITIES §1 的数量只减不增）
