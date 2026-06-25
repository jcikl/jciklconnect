# 系统架构文档

## 概述

JCI Kuala Lumpur 管理平台采用现代化的微服务架构，基于 React + Firebase 技术栈构建，提供高可用性、可扩展性和安全性的解决方案。

## 🏗️ 整体架构

### 架构图
```
┌─────────────────────────────────────────────────────────────┐
│                        用户界面层                              │
├─────────────────────────────────────────────────────────────┤
│  React SPA  │  Mobile Web  │  PWA  │  Admin Dashboard      │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                        API 网关层                             │
├─────────────────────────────────────────────────────────────┤
│  Firebase Functions  │  REST API  │  GraphQL  │  WebSocket  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                        业务逻辑层                              │
├─────────────────────────────────────────────────────────────┤
│  会员管理  │  活动管理  │  项目管理  │  财务管理  │  治理工具    │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                        数据访问层                              │
├─────────────────────────────────────────────────────────────┤
│  Firestore  │  Storage  │  Cache  │  External APIs         │
└─────────────────────────────────────────────────────────────┘
```

### 技术栈

#### 前端技术
- **React 18** - 用户界面框架
- **TypeScript** - 类型安全的 JavaScript
- **Vite** - 快速构建工具
- **Tailwind CSS** - 实用优先的 CSS 框架
- **React Router** - 客户端路由
- **React Query** - 数据获取和缓存
- **Zustand** - 状态管理

#### 后端技术
- **Firebase Functions** - 无服务器计算
- **Firestore** - NoSQL 文档数据库
- **Firebase Storage** - 文件存储服务
- **Firebase Auth** - 身份认证服务
- **Node.js** - JavaScript 运行时
- **Express.js** - Web 应用框架

#### 开发工具
- **ESLint** - 代码质量检查
- **Prettier** - 代码格式化
- **Jest** - 单元测试框架
- **Cypress** - 端到端测试
- **Storybook** - 组件开发环境

## 🔧 核心模块架构

### 1. 认证和授权模块

```typescript
// 认证架构
interface AuthModule {
  // 认证服务
  authService: {
    login(credentials: LoginCredentials): Promise<User>;
    logout(): Promise<void>;
    register(userData: RegisterData): Promise<User>;
    resetPassword(email: string): Promise<void>;
  };
  
  // 授权服务
  authorizationService: {
    checkPermission(user: User, resource: string, action: string): boolean;
    getRoles(user: User): Role[];
    hasRole(user: User, role: string): boolean;
  };
  
  // 会话管理
  sessionService: {
    createSession(user: User): Session;
    validateSession(token: string): Promise<Session>;
    refreshToken(refreshToken: string): Promise<string>;
  };
}
```

### 2. 数据管理模块

```typescript
// 数据层架构
interface DataModule {
  // 仓储模式
  repositories: {
    memberRepository: MemberRepository;
    eventRepository: EventRepository;
    projectRepository: ProjectRepository;
    financialRepository: FinancialRepository;
  };
  
  // 缓存层
  cacheService: {
    get<T>(key: string): Promise<T | null>;
    set<T>(key: string, value: T, ttl?: number): Promise<void>;
    invalidate(pattern: string): Promise<void>;
  };
  
  // 数据同步
  syncService: {
    syncToCloud(data: any): Promise<void>;
    syncFromCloud(): Promise<any>;
    handleConflicts(conflicts: Conflict[]): Promise<void>;
  };
}
```

### 3. 业务逻辑模块

```typescript
// 业务服务架构
interface BusinessModule {
  // 会员服务
  memberService: {
    createMember(data: CreateMemberData): Promise<Member>;
    updateMember(id: string, data: UpdateMemberData): Promise<Member>;
    promoteMember(id: string): Promise<void>;
    calculatePoints(memberId: string): Promise<number>;
  };
  
  // 活动服务
  eventService: {
    createEvent(data: CreateEventData): Promise<Event>;
    registerForEvent(eventId: string, memberId: string): Promise<void>;
    checkInMember(eventId: string, memberId: string): Promise<void>;
    generateCertificate(eventId: string, memberId: string): Promise<string>;
  };
  
  // 项目服务
  projectService: {
    createProject(data: CreateProjectData): Promise<Project>;
    assignMember(projectId: string, memberId: string, role: string): Promise<void>;
    updateProgress(projectId: string, progress: number): Promise<void>;
    generateReport(projectId: string): Promise<ProjectReport>;
  };
}
```

## 📊 数据模型设计

### 核心实体关系图

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│    Member   │────│ Membership  │────│    Role     │
│             │    │             │    │             │
│ - id        │    │ - memberId  │    │ - id        │
│ - name      │    │ - type      │    │ - name      │
│ - email     │    │ - status    │    │ - permissions│
│ - phone     │    │ - startDate │    │             │
└─────────────┘    └─────────────┘    └─────────────┘
        │                                      │
        │                                      │
        ▼                                      ▼
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│    Event    │────│ Registration│────│   Project   │
│             │    │             │    │             │
│ - id        │    │ - eventId   │    │ - id        │
│ - title     │    │ - memberId  │    │ - name      │
│ - date      │    │ - status    │    │ - status    │
│ - location  │    │ - checkIn   │    │ - budget    │
└─────────────┘    └─────────────┘    └─────────────┘
```

### Firestore 集合结构

```typescript
// Firestore 数据结构
interface FirestoreSchema {
  // 会员集合
  members: {
    [memberId: string]: {
      personalInfo: PersonalInfo;
      membershipInfo: MembershipInfo;
      preferences: UserPreferences;
      activity: ActivityLog[];
      createdAt: Timestamp;
      updatedAt: Timestamp;
    };
  };
  
  // 活动集合
  events: {
    [eventId: string]: {
      basicInfo: EventBasicInfo;
      logistics: EventLogistics;
      registration: RegistrationInfo;
      attendance: AttendanceRecord[];
      feedback: EventFeedback[];
    };
  };
  
  // 项目集合
  projects: {
    [projectId: string]: {
      overview: ProjectOverview;
      team: TeamMember[];
      milestones: Milestone[];
      budget: BudgetInfo;
      documents: DocumentReference[];
    };
  };
  
  // 财务集合
  financial: {
    transactions: Transaction[];
    budgets: Budget[];
    reports: FinancialReport[];
  };
}
```

## 🔄 数据流架构

### 单向数据流

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   Action    │───▶│   Service   │───▶│  Database   │
│             │    │             │    │             │
│ - type      │    │ - validate  │    │ - store     │
│ - payload   │    │ - process   │    │ - index     │
│ - metadata  │    │ - transform │    │ - backup    │
└─────────────┘    └─────────────┘    └─────────────┘
        ▲                                      │
        │                                      │
        │                                      ▼
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│     UI      │◀───│    State    │◀───│  Listener   │
│             │    │             │    │             │
│ - render    │    │ - update    │    │ - onChange  │
│ - interact  │    │ - notify    │    │ - onError   │
│ - feedback  │    │ - persist   │    │ - onSuccess │
└─────────────┘    └─────────────┘    └─────────────┘
```

### 状态管理架构

```typescript
// 状态管理结构
interface AppState {
  // 用户状态
  auth: {
    user: User | null;
    isAuthenticated: boolean;
    permissions: Permission[];
    loading: boolean;
  };
  
  // 应用状态
  app: {
    theme: 'light' | 'dark';
    language: 'en' | 'zh' | 'ms';
    notifications: Notification[];
    loading: boolean;
  };
  
  // 业务状态
  business: {
    members: Member[];
    events: Event[];
    projects: Project[];
    financial: FinancialData;
  };
  
  // UI 状态
  ui: {
    modals: ModalState[];
    sidebar: SidebarState;
    filters: FilterState;
    pagination: PaginationState;
  };
}
```

## 🚀 性能优化架构

### 缓存策略

```typescript
// 多层缓存架构
interface CacheArchitecture {
  // 浏览器缓存
  browserCache: {
    localStorage: LocalStorageCache;
    sessionStorage: SessionStorageCache;
    indexedDB: IndexedDBCache;
  };
  
  // 应用缓存
  applicationCache: {
    memoryCache: MemoryCache;
    queryCache: ReactQueryCache;
    componentCache: ComponentCache;
  };
  
  // 服务端缓存
  serverCache: {
    redisCache: RedisCache;
    firestoreCache: FirestoreCache;
    cdnCache: CDNCache;
  };
}
```

### 代码分割策略

```typescript
// 代码分割配置
const routeBasedSplitting = {
  // 路由级别分割
  routes: [
    { path: '/members', component: lazy(() => import('./MembersView')) },
    { path: '/events', component: lazy(() => import('./EventsView')) },
    { path: '/projects', component: lazy(() => import('./ProjectsView')) }
  ],
  
  // 功能级别分割
  features: [
    { name: 'charts', loader: () => import('./charts') },
    { name: 'pdf', loader: () => import('./pdf-generator') },
    { name: 'excel', loader: () => import('./excel-export') }
  ],
  
  // 第三方库分割
  vendors: [
    { name: 'firebase', chunks: ['firebase-app', 'firebase-auth', 'firebase-firestore'] },
    { name: 'ui', chunks: ['react', 'react-dom', 'react-router'] }
  ]
};
```

## 🔒 安全架构

### 安全层级

```
┌─────────────────────────────────────────────────────────────┐
│                        网络安全层                              │
├─────────────────────────────────────────────────────────────┤
│  HTTPS  │  CORS  │  CSP  │  Rate Limiting  │  DDoS Protection│
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                        应用安全层                              │
├─────────────────────────────────────────────────────────────┤
│  Authentication  │  Authorization  │  Input Validation      │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                        数据安全层                              │
├─────────────────────────────────────────────────────────────┤
│  Encryption  │  Access Control  │  Audit Logging  │  Backup │
└─────────────────────────────────────────────────────────────┘
```

### 权限控制模型

```typescript
// RBAC 权限模型
interface SecurityModel {
  // 角色定义
  roles: {
    admin: {
      permissions: ['*'];
      description: '系统管理员';
    };
    president: {
      permissions: ['members:*', 'events:*', 'projects:*', 'financial:read'];
      description: '会长';
    };
    treasurer: {
      permissions: ['financial:*', 'members:read', 'events:read'];
      description: '财务';
    };
    member: {
      permissions: ['profile:update', 'events:register', 'projects:view'];
      description: '普通会员';
    };
  };
  
  // 权限检查
  checkPermission: (user: User, resource: string, action: string) => boolean;
  
  // 数据过滤
  filterData: (data: any[], user: User) => any[];
}
```

## 📱 响应式架构

### 设备适配策略

```typescript
// 响应式设计架构
interface ResponsiveArchitecture {
  // 断点定义
  breakpoints: {
    mobile: '0-767px';
    tablet: '768-1023px';
    desktop: '1024px+';
  };
  
  // 组件适配
  components: {
    navigation: {
      mobile: 'MobileNavigation';
      tablet: 'TabletNavigation';
      desktop: 'DesktopNavigation';
    };
    layout: {
      mobile: 'SingleColumnLayout';
      tablet: 'TwoColumnLayout';
      desktop: 'ThreeColumnLayout';
    };
  };
  
  // 功能适配
  features: {
    touch: boolean;
    hover: boolean;
    keyboard: boolean;
    screenReader: boolean;
  };
}
```

## 🔄 微服务架构

### 服务拆分策略

```typescript
// 微服务架构
interface MicroservicesArchitecture {
  // 核心服务
  coreServices: {
    authService: AuthenticationService;
    userService: UserManagementService;
    notificationService: NotificationService;
  };
  
  // 业务服务
  businessServices: {
    membershipService: MembershipManagementService;
    eventService: EventManagementService;
    projectService: ProjectManagementService;
    financialService: FinancialManagementService;
  };
  
  // 支持服务
  supportServices: {
    fileService: FileStorageService;
    emailService: EmailService;
    smsService: SMSService;
    analyticsService: AnalyticsService;
  };
}
```

## 📊 监控和日志架构

### 监控体系

```typescript
// 监控架构
interface MonitoringArchitecture {
  // 性能监控
  performance: {
    metrics: ['response_time', 'throughput', 'error_rate'];
    alerts: AlertRule[];
    dashboards: Dashboard[];
  };
  
  // 业务监控
  business: {
    kpis: ['active_users', 'event_attendance', 'member_growth'];
    reports: BusinessReport[];
    analytics: AnalyticsData[];
  };
  
  // 系统监控
  system: {
    health: HealthCheck[];
    resources: ResourceUsage[];
    logs: LogEntry[];
  };
}
```

## 🚀 部署架构

### 部署策略

```
┌─────────────────────────────────────────────────────────────┐
│                        CDN 层                                │
├─────────────────────────────────────────────────────────────┤
│  CloudFlare  │  Static Assets  │  Global Distribution       │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                        应用层                                 │
├─────────────────────────────────────────────────────────────┤
│  Firebase Hosting  │  React SPA  │  Service Worker         │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                        服务层                                 │
├─────────────────────────────────────────────────────────────┤
│  Cloud Functions  │  API Gateway  │  Load Balancer         │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                        数据层                                 │
├─────────────────────────────────────────────────────────────┤
│  Firestore  │  Cloud Storage  │  Redis Cache  │  Backup    │
└─────────────────────────────────────────────────────────────┘
```

## 📈 扩展性设计

### 水平扩展策略

```typescript
// 扩展性架构
interface ScalabilityArchitecture {
  // 数据库扩展
  database: {
    sharding: ShardingStrategy;
    replication: ReplicationStrategy;
    caching: CachingStrategy;
  };
  
  // 应用扩展
  application: {
    loadBalancing: LoadBalancingStrategy;
    autoScaling: AutoScalingStrategy;
    containerization: ContainerStrategy;
  };
  
  // 存储扩展
  storage: {
    distribution: StorageDistributionStrategy;
    compression: CompressionStrategy;
    archiving: ArchivingStrategy;
  };
}
```

---

这个架构文档为 JCI Kuala Lumpur 管理平台提供了全面的技术架构指导，确保系统的可维护性、可扩展性和高性能。