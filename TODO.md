# TODO

本文件记录当前开发目标、已确认的后续任务，以及 agent 在执行过程中发现但不属于当前范围的问题。

## 使用规则

- 每次开始任务时，先读取 `CLAUDE.md`，再读取本文件和任务相关的代码、schema 与权限规则。
- 当前任务只处理“进行中”或用户明确指定的事项。
- 发现范围外问题时，先登记到“待确认”或“后续任务”，不得自动扩大当前任务。
- 每项任务必须写明来源和完成标准；涉及架构、数据迁移、删除字段或权限变化时，标记为“需要确认”。
- 完成代码后，同时检查是否需要更新 `SCHEMA.md`、`SCHEMA-PERMISSIONS.md` 或本文件。
- 任务完成后，将项目移到“已完成”，保留一句验证结果。

## 当前目标

- 目标：让代码、实际系统行为、`CLAUDE.md`、`SCHEMA.md` 和 `SCHEMA-PERMISSIONS.md` 保持一致，并通过已批准任务持续推进。
- 范围：字段结构、集合联动、权限规则、废弃字段清理、文档同步和相关验证。
- 不包含：未经确认的新业务功能、数据迁移、批量回写、权限扩大和大范围架构重构。
- 完成标准：
  - [ ] 当前登记任务全部完成或明确标记为需要确认。
  - [ ] 代码不再使用已确认废弃的字段或功能。
  - [ ] `SCHEMA.md` 与实际 TypeScript 字段及字段流一致。
  - [ ] `SCHEMA-PERMISSIONS.md` 与 `firestore.rules` 及代码权限判断一致。
  - [ ] 受影响代码、集合、权限、工作流和文档均已检查。
  - [ ] 没有未登记的缺失、过期、重复、矛盾或断链文档。
  - [ ] 必要的新 Markdown 文档已创建并加入链接和创建记录。
  - [ ] 相关类型检查、Lint、Build、测试或文档校验通过。

建议格式：

```md
- 目标：
- 范围：
- 不包含：
- 完成标准：
  - [ ]
```

## 进行中

<!-- 当前无进行中任务；下一步见”待确认”和”后续任务” -->

## 待确认

> 以下事项涉及 Firestore 安全规则变更，需用户确认后才能执行。

- [ ] **P0 nudges：为 `nudges` 集合添加 Firestore 规则块**
  - 来源：SCHEMA-PERMISSIONS.md #1；基线扫描 2026-09-16 确认规则块缺失
  - 现状：`firestore.rules` 中无 `match /nudges/{docId}` 块，所有客户端写入（包括 dismiss 标记）均 PERMISSION_DENIED 静默失败
  - 建议修复：添加规则允许登录用户读取自己的 nudge，Board/Admin 创建，用户自己可更新 `dismissed` 字段
  - 涉及文件：`firestore.rules`、`services/nudgesService.ts`（如存在）
  - 完成标准：`firestore.rules` 有 nudges 规则块；dismiss 操作不再静默失败

- [ ] **P0 conversations：为 `conversations` 集合添加 Firestore 规则块**
  - 来源：SCHEMA-PERMISSIONS.md #5；基线扫描 2026-09-16 确认规则块缺失
  - 现状：`firestore.rules` 中无 `match /conversations/{docId}` 块；无规则 = 默认拒绝，但 SCHEMA-PERMISSIONS.md 记录为”任意用户可读所有私信”（可能已是默认拒绝而非 allow true，需确认实际行为）
  - 建议修复：添加规则，仅允许会话参与双方读取，Board/Admin 可管理
  - 涉及文件：`firestore.rules`、`services/messagingService.ts`（如存在）
  - 完成标准：`firestore.rules` 有 conversations 规则块；只有参与方可访问

- [ ] **P0 certificates：收紧 `certificates` 集合 create 规则**
  - 来源：SCHEMA-PERMISSIONS.md #10；基线扫描 2026-09-16 确认 `allow create: if isAuthenticated()` 仍存在
  - 现状：`firestore.rules` L1011 任意已登录用户可自颁证书，绕过课程完成校验
  - 建议修复：限制 create 为 Admin 或通过 Netlify/Cloud Function 生成（服务端签发）；或增加必填字段校验（courseId、completionDate）
  - 涉及文件：`firestore.rules` L1009-1013
  - 完成标准：create 规则收紧；普通用户无法自颁证书

- [ ] **P0 RADAR_CONTRIBUTIONS：确认 `pointsService.ts` L2438 使用的集合名称**
  - 来源：SCHEMA-PERMISSIONS.md #14；基线扫描 2026-09-16 确认 `COLLECTIONS.RADAR_CONTRIBUTIONS` 不存在于 `config/constants.ts`
  - 现状：`services/pointsService.ts:2438` 引用 `COLLECTIONS.RADAR_CONTRIBUTIONS`，但该 key 未在 `config/constants.ts` 中定义；TypeScript `as const` 会报编译错误；运行时会崩溃导致雷达统计永不更新
  - 需要确认：此集合的实际 Firestore 集合名称是什么？是 `radarContributions`，还是应改用 `COLLECTIONS.REGISTRATION_HISTORY`？
  - 涉及文件：`services/pointsService.ts:2438`、`config/constants.ts`
  - 完成标准：`COLLECTIONS.RADAR_CONTRIBUTIONS` 存在于 constants.ts，或代码改用正确常量；TypeScript 编译不报错

## 后续任务

- [ ] 同步更新 `SCHEMA-PERMISSIONS.md` 汇总表中已修复的行（nudges/conversations/certificates 规则修复后）
  - 来源：基线扫描 2026-09-16
  - 涉及文件：`SCHEMA-PERMISSIONS.md`
  - 完成标准：汇总表与 `firestore.rules` 和代码权限判断一致

## 文档创建记录

<!-- 新建 Markdown 文档时记录：文档、创建原因、所属主题、入口链接。 -->

## 已完成

- [x] P0 建立当前一致性基线（2026-09-16；扫描验证：4条P0已修（counters/auditLog/emailLogs/sponsorships），4条P0待确认，SCHEMA-PERMISSIONS.md P0速查表已同步更新）
