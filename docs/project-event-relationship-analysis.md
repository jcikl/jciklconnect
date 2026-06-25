# Projects Collection 与 Event List/Event Management 页面关系分析

## 需求概述

用户希望完善和修正 projects collection 和 event list 页面以及 event management 页面之间的关系。

## 需求详细分析

### 需求1：Event List 页面显示被理事审批通过的 Projects

**需求描述：**
- event list 页面（EventsView）的 upcoming 和 completed 标签页需要显示所有被理事审批通过的 project
- 需要显示 project collection 的字段：eventStartDate, eventEndDate

**当前状态：**
- EventsService.getAllEvents() 从 PROJECTS collection 查询
- 过滤条件：status in ['Approved', 'Active', 'Planning', 'Completed', 'Review', 'Upcoming']
- 使用 `date` 字段进行排序和过滤

**问题分析：**
1. ✅ 当前已经查询了 status='Approved' 的项目
2. ❌ 但使用的是 `date` 字段，而不是 `eventStartDate`/`eventEndDate`
3. ❌ 需要明确"被理事审批通过"的定义：status='Approved' 还是需要额外的审批字段？

**解决方案：**
- 修改 EventsService.getAllEvents() 使用 eventStartDate/eventEndDate 字段
- 明确"被理事审批通过" = status='Approved'
- EventsView 的 Upcoming/Completed 标签页基于 eventStartDate 进行过滤

---

### 需求2：Events Management 页面结构调整

**需求描述：**
- Events Management 页面（ProjectsView）使用 active projects 标签页为主要 CRUD 操作
- 弃用 activity plans 标签页
- 创建新 project 的入口按钮需要始终显示

**当前状态：**
- ProjectsView 有三个标签页：'Active Projects', 'Activity Plans', 'Templates'
- 创建新 project 的按钮在 ProjectGrid 组件中，只在 activeTab === 'projects' 时显示

**问题分析：**
1. ❌ Activity Plans 标签页需要移除
2. ❌ 创建新 project 的按钮需要始终显示（不管在哪个标签页）

**解决方案：**
- 移除 'Activity Plans' 标签页
- 将创建新 project 的按钮移到 ProjectsView 的顶部，始终显示
- 保留 'Templates' 标签页

---

### 需求3：Active Projects 标签页显示所有 Projects

**需求描述：**
- Events Management 页面（ProjectsView）的 active projects 标签页需要显示全部 project collections 的所有文档
- 不管任何 status

**当前状态：**
- ProjectsService.getAllProjects() 过滤掉了 status in ['Draft', 'Submitted', 'Under Review', 'Rejected']

**问题分析：**
1. ❌ 当前过滤掉了某些状态的 projects
2. ✅ 需要显示所有状态的 projects

**解决方案：**
- 修改 ProjectsService.getAllProjects() 移除状态过滤
- 显示所有状态的 projects

---

### 需求4：Project Detail 页面添加 Activity Plan 标签页

**需求描述：**
- Events Management 页面使用 active projects 标签页点击 open board 后
- 需要有一个标签页看见该点选 project 的 Activity Plan
- Activity Plan 字段：Title*, Description, Level, Pillar, Category, Type, Proposed Date*, Event Start Date, Event End Date, Event Start Time, Event End Time, Proposed Budget (RM)*, Target Audience, Objectives & Goals*, Expected Impact
- 允许做 Read, Update, Delete 操作
- 而不是另外创建 activity plan

**当前状态：**
- ProjectDetailTabs 有：'Kanban Board', 'Gantt Chart', 'Financial Account', 'Reports', 'AI Insights'
- ActivityPlan 有 parentProjectId 字段，可以关联到 Project
- ActivityPlansService 有 CRUD 操作

**问题分析：**
1. ❌ ProjectDetailTabs 没有 Activity Plan 标签页
2. ✅ ActivityPlan 已经有 parentProjectId 字段支持关联
3. ❌ 需要添加 Activity Plan 标签页，显示关联的 ActivityPlan
4. ❌ 需要支持 Read, Update, Delete 操作（不需要 Create，因为 ActivityPlan 应该从 Project 创建）

**解决方案：**
- 在 ProjectDetailTabs 中添加 'Activity Plan' 标签页
- 查询 parentProjectId === projectId 的 ActivityPlan
- 显示 Activity Plan 的所有字段
- 支持 Update 和 Delete 操作
- 如果不存在 ActivityPlan，显示创建表单（但这是从 Project 创建的，不是独立的）

---

## 数据关系梳理

### Project 与 ActivityPlan 的关系

**当前设计：**
- ActivityPlan 有 `parentProjectId` 字段，表示它属于某个 Project
- 一个 Project 可以有 0 或 1 个 ActivityPlan（一对一关系）

**建议关系：**
- Project 是主实体
- ActivityPlan 是 Project 的子资源（一对一关系）
- 创建 Project 时，可以选择创建关联的 ActivityPlan
- ActivityPlan 的字段应该映射到 Project 的相应字段

### Project Status 与审批流程

**Project Status 定义：**
- Proposal 阶段：'Draft', 'Submitted', 'Under Review', 'Rejected'
- Execution 阶段：'Approved', 'Planning', 'Active', 'Completed', 'Review', 'Upcoming', 'Cancelled'

**"被理事审批通过"的定义：**
- status = 'Approved' 表示已被理事审批通过
- 这是从 Proposal 阶段进入 Execution 阶段的标志

---

## 实施计划

### 阶段1：修改 EventsView（需求1）
1. 修改 EventsService.getAllEvents() 使用 eventStartDate/eventEndDate
2. 确保只查询 status='Approved' 的 projects
3. EventsView 的 Upcoming/Completed 基于 eventStartDate 过滤

### 阶段2：修改 ProjectsView 结构（需求2、3）
1. 移除 'Activity Plans' 标签页
2. 将创建新 project 按钮移到顶部，始终显示
3. 修改 ProjectsService.getAllProjects() 显示所有状态的 projects

### 阶段3：添加 Activity Plan 标签页（需求4）
1. 在 ProjectDetailTabs 中添加 'Activity Plan' 标签页
2. 查询并显示关联的 ActivityPlan
3. 实现 Update 和 Delete 操作
4. 如果不存在，提供创建表单

---

## 待确认问题

1. **ActivityPlan 的创建时机：**
   - 是在创建 Project 时同时创建？
   - 还是在 Project 创建后单独创建？
   - 还是从 Project 的字段自动生成？

2. **ActivityPlan 与 Project 字段的同步：**
   - 如果更新 Project 的 eventStartDate，是否同步更新 ActivityPlan？
   - 还是 ActivityPlan 是独立的，只关联但不同步？

3. **"被理事审批通过"的精确含义：**
   - 是否只有 status='Approved'？
   - 还是需要额外的审批字段（如 reviewedBy, reviewedDate）？

4. **Event List 页面的显示逻辑：**
   - 是否只显示有 eventStartDate 的 projects？
   - 还是所有 status='Approved' 的 projects 都要显示？
