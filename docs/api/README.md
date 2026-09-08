# API 文档

## 概述

JCI Kuala Lumpur 管理平台提供了一套完整的 API，用于管理会员、活动、项目、财务和治理等功能。所有 API 都基于 Firebase Cloud Functions 构建，提供实时数据同步和高可用性。

## 🔐 认证

所有 API 请求都需要有效的 Firebase 认证令牌。

### 获取认证令牌
```javascript
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';

const auth = getAuth();
const userCredential = await signInWithEmailAndPassword(auth, email, password);
const token = await userCredential.user.getIdToken();
```

### 使用认证令牌
```javascript
const response = await fetch('/api/endpoint', {
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
});
```

## 📚 API 端点

### 会员管理 API

#### 获取会员列表
```http
GET /api/members
```

**查询参数：**
- `page` (number): 页码，默认为 1
- `limit` (number): 每页数量，默认为 20
- `status` (string): 会员状态筛选
- `membershipType` (string): 会员类型筛选
- `search` (string): 搜索关键词

**响应示例：**
```json
{
  "success": true,
  "data": {
    "members": [
      {
        "id": "member_123",
        "name": "张三",
        "email": "zhang.san@example.com",
        "membershipType": "Full",
        "status": "Active",
        "joinDate": "2023-01-15T00:00:00Z",
        "points": 1250
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 150,
      "totalPages": 8
    }
  }
}
```

#### 创建新会员
```http
POST /api/members
```

**请求体：**
```json
{
  "name": "李四",
  "email": "li.si@example.com",
  "phone": "+60123456789",
  "membershipType": "Associate",
  "dateOfBirth": "1990-05-15",
  "nationality": "Malaysian",
  "occupation": "Software Engineer",
  "company": "Tech Corp"
}
```

#### 更新会员信息
```http
PUT /api/members/{memberId}
```

#### 删除会员
```http
DELETE /api/members/{memberId}
```

### 活动管理 API

#### 获取活动列表
```http
GET /api/events
```

**查询参数：**
- `startDate` (string): 开始日期 (ISO 8601)
- `endDate` (string): 结束日期 (ISO 8601)
- `type` (string): 活动类型
- `status` (string): 活动状态

**响应示例：**
```json
{
  "success": true,
  "data": {
    "events": [
      {
        "id": "event_456",
        "title": "领导力培训工作坊",
        "description": "提升领导技能的互动工作坊",
        "date": "2024-02-15T09:00:00Z",
        "endDate": "2024-02-15T17:00:00Z",
        "location": "JCI KL 办公室",
        "type": "Training",
        "status": "Upcoming",
        "maxAttendees": 50,
        "currentAttendees": 32,
        "organizer": "member_123"
      }
    ]
  }
}
```

#### 创建新活动
```http
POST /api/events
```

#### 活动报名
```http
POST /api/events/{eventId}/register
```

**请求体：**
```json
{
  "memberId": "member_123",
  "notes": "期待参加这个活动"
}
```

### 项目管理 API

#### 获取项目列表
```http
GET /api/projects
```

#### 创建新项目
```http
POST /api/projects
```

**请求体：**
```json
{
  "name": "社区服务项目",
  "description": "为当地社区提供志愿服务",
  "startDate": "2024-03-01T00:00:00Z",
  "endDate": "2024-06-30T23:59:59Z",
  "budget": 5000,
  "teamLeader": "member_123",
  "category": "Community Service"
}
```

#### 更新项目状态
```http
PATCH /api/projects/{projectId}/status
```

### 财务管理 API

#### 获取交易记录
```http
GET /api/financial/transactions
```

**查询参数：**
- `startDate` (string): 开始日期
- `endDate` (string): 结束日期
- `type` (string): 交易类型
- `category` (string): 交易分类

#### 创建交易记录
```http
POST /api/financial/transactions
```

**请求体：**
```json
{
  "type": "Income",
  "amount": 100.00,
  "currency": "MYR",
  "description": "会员费收入",
  "category": "Membership",
  "date": "2024-01-15T00:00:00Z",
  "memberId": "member_123"
}
```

#### 生成财务报告
```http
POST /api/financial/reports
```

**请求体：**
```json
{
  "type": "monthly",
  "startDate": "2024-01-01T00:00:00Z",
  "endDate": "2024-01-31T23:59:59Z",
  "format": "pdf"
}
```

## 🔄 实时数据

### Firestore 实时监听

使用 Firestore 的实时监听功能获取数据更新：

```javascript
import { onSnapshot, collection, query, where } from 'firebase/firestore';

// 监听会员数据变化
const unsubscribe = onSnapshot(
  query(collection(db, 'members'), where('status', '==', 'Active')),
  (snapshot) => {
    const members = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    console.log('会员数据更新:', members);
  }
);
```

### WebSocket 连接

对于需要实时通信的功能，平台提供 WebSocket 连接：

```javascript
const ws = new WebSocket('wss://your-domain.com/ws');

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('实时消息:', data);
};
```

## 📊 数据模型

### 会员 (Member)
```typescript
interface Member {
  id: string;
  name: string;
  email: string;
  phone?: string;
  membershipType: 'Full' | 'Associate' | 'Honorary' | 'Visiting' | 'Senator';
  status: 'Active' | 'Inactive' | 'Pending' | 'Suspended';
  joinDate: string;
  dateOfBirth?: string;
  nationality?: string;
  occupation?: string;
  company?: string;
  points: number;
  badges: string[];
  achievements: string[];
  createdAt: string;
  updatedAt: string;
}
```

### 活动 (Event)
```typescript
interface Event {
  id: string;
  title: string;
  description: string;
  date: string;
  endDate?: string;
  location: string;
  type: 'Training' | 'Social' | 'Meeting' | 'Conference' | 'Workshop';
  status: 'Draft' | 'Published' | 'Upcoming' | 'Ongoing' | 'Completed' | 'Cancelled';
  maxAttendees?: number;
  currentAttendees: number;
  organizer: string;
  attendees: string[];
  budget?: number;
  expenses?: number;
  createdAt: string;
  updatedAt: string;
}
```

### 项目 (Project)
```typescript
interface Project {
  id: string;
  name: string;
  description: string;
  startDate: string;
  endDate: string;
  status: 'Planning' | 'Active' | 'On Hold' | 'Completed' | 'Cancelled';
  budget: number;
  spent: number;
  teamLeader: string;
  teamMembers: string[];
  category: string;
  milestones: Milestone[];
  createdAt: string;
  updatedAt: string;
}
```

## ⚠️ 错误处理

### 错误响应格式
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "输入数据验证失败",
    "details": {
      "field": "email",
      "message": "邮箱格式不正确"
    }
  }
}
```

### 常见错误代码
- `AUTHENTICATION_REQUIRED` - 需要认证
- `PERMISSION_DENIED` - 权限不足
- `VALIDATION_ERROR` - 数据验证失败
- `RESOURCE_NOT_FOUND` - 资源不存在
- `RATE_LIMIT_EXCEEDED` - 请求频率超限
- `INTERNAL_SERVER_ERROR` - 服务器内部错误

## 🚀 性能优化

### 缓存策略
- API 响应缓存 5 分钟
- 静态数据缓存 1 小时
- 用户数据缓存 15 分钟

### 分页和限制
- 默认页面大小：20 条记录
- 最大页面大小：100 条记录
- 请求频率限制：每分钟 100 次

### 批量操作
```http
POST /api/batch
```

**请求体：**
```json
{
  "operations": [
    {
      "method": "POST",
      "path": "/api/members",
      "body": { "name": "张三", "email": "zhang@example.com" }
    },
    {
      "method": "PUT",
      "path": "/api/members/123",
      "body": { "status": "Active" }
    }
  ]
}
```

## 📝 API 版本控制

当前 API 版本：`v1`

所有 API 端点都包含版本前缀：
```
https://your-domain.com/api/v1/members
```

### 版本兼容性
- `v1` - 当前稳定版本
- 向后兼容性保证至少 6 个月
- 废弃功能会提前 3 个月通知

## 🔍 调试和监控

### 请求日志
所有 API 请求都会被记录，包括：
- 请求时间戳
- 用户 ID
- 请求路径和方法
- 响应状态码
- 响应时间

### 健康检查
```http
GET /api/health
```

**响应：**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00Z",
  "services": {
    "database": "healthy",
    "storage": "healthy",
    "functions": "healthy"
  }
}
```

---

更多详细信息请参考各个模块的具体 API 文档。
