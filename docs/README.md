# JCI Kuala Lumpur 管理平台

## 概述

JCI Kuala Lumpur 管理平台是一个现代化的会员管理系统，专为 JCI（国际青年商会）吉隆坡分会设计。该平台提供全面的会员管理、活动组织、项目管理、财务跟踪和治理工具。

## 🚀 主要功能

### 核心模块
- **会员管理** - 完整的会员生命周期管理
- **活动管理** - 活动策划、注册和跟踪
- **项目管理** - 项目规划、执行和监控
- **财务管理** - 财务跟踪、报告和分析
- **治理工具** - 投票、选举和决策支持

### 增强功能
- **游戏化系统** - 积分、徽章和成就系统
- **自动化工作流** - 可视化工作流设计器
- **AI 洞察** - 智能数据分析和建议
- **性能优化** - 高性能数据处理和缓存
- **无障碍支持** - 完全符合 WCAG 标准

## 📋 系统要求

### 前端要求
- Node.js 18.0 或更高版本
- npm 8.0 或更高版本
- 现代浏览器（Chrome 90+, Firefox 88+, Safari 14+, Edge 90+）

### 后端要求
- Firebase 项目
- Cloud Functions 支持
- Firestore 数据库
- Firebase Storage

## 🛠️ 安装和设置

### 1. 克隆项目
```bash
git clone <repository-url>
cd jci-kl-management-platform
```

### 2. 安装依赖
```bash
npm install
```

### 3. 配置 Firebase
```bash
# 复制环境变量模板
cp .env.example .env

# 编辑 .env 文件，添加您的 Firebase 配置
```

### 4. 初始化 Firebase
```bash
# 安装 Firebase CLI
npm install -g firebase-tools

# 登录 Firebase
firebase login

# 初始化项目
firebase init
```

### 5. 部署 Firestore 规则和索引
```bash
firebase deploy --only firestore:rules
firebase deploy --only firestore:indexes
firebase deploy --only storage
```

### 6. 部署 Cloud Functions
```bash
cd functions
npm install
cd ..
firebase deploy --only functions
```

### 7. 启动开发服务器
```bash
npm run dev
```

## 📚 文档目录

### 用户文档
- [用户指南](./user-guide/README.md) - 平台使用指南
- [管理员指南](./admin-guide/README.md) - 管理员操作指南
- [常见问题](./faq/README.md) - 常见问题解答

### 开发者文档
- [API 文档](./api/README.md) - 完整的 API 参考
- [组件文档](./components/README.md) - React 组件文档
- [架构文档](./architecture/README.md) - 系统架构说明
- [开发指南](./development/README.md) - 开发环境设置和最佳实践

### 技术文档
- [性能优化](./performance/README.md) - 性能优化指南
- [无障碍指南](./accessibility/README.md) - 无障碍功能说明
- [安全指南](./security/README.md) - 安全最佳实践
- [部署指南](./deployment/README.md) - 生产环境部署

## 🏗️ 项目结构

```
├── components/           # React 组件
│   ├── ui/              # 基础 UI 组件
│   ├── modules/         # 功能模块组件
│   ├── accessibility/   # 无障碍组件
│   └── performance/     # 性能优化组件
├── hooks/               # 自定义 React Hooks
├── services/            # 业务逻辑服务
├── utils/               # 工具函数
├── types/               # TypeScript 类型定义
├── styles/              # 样式文件
├── functions/           # Firebase Cloud Functions
├── docs/                # 文档
└── tests/               # 测试文件
```

## 🧪 测试

### 运行测试
```bash
# 运行所有测试
npm test

# 运行单元测试
npm run test:unit

# 运行集成测试
npm run test:integration

# 运行属性测试
npm run test:property

# 生成测试覆盖率报告
npm run test:coverage
```

### 测试类型
- **单元测试** - 组件和函数的单元测试
- **集成测试** - 模块间集成测试
- **属性测试** - 基于属性的测试
- **端到端测试** - 完整用户流程测试

## 🚀 部署

### 开发环境
```bash
npm run dev
```

### 生产构建
```bash
npm run build
```

### Firebase 部署
```bash
# 部署所有服务
firebase deploy

# 仅部署 Hosting
firebase deploy --only hosting

# 仅部署 Functions
firebase deploy --only functions
```

## 🤝 贡献指南

### 开发流程
1. Fork 项目
2. 创建功能分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'Add some amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 创建 Pull Request

### 代码规范
- 使用 TypeScript 进行类型安全
- 遵循 ESLint 和 Prettier 配置
- 编写单元测试
- 添加适当的文档注释

### 提交规范
使用 [Conventional Commits](https://www.conventionalcommits.org/) 规范：
- `feat:` 新功能
- `fix:` 错误修复
- `docs:` 文档更新
- `style:` 代码格式化
- `refactor:` 代码重构
- `test:` 测试相关
- `chore:` 构建过程或辅助工具的变动

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。

## 📞 支持

如果您遇到问题或需要帮助：

1. 查看 [常见问题](./docs/faq/README.md)
2. 搜索 [Issues](../../issues)
3. 创建新的 Issue
4. 联系开发团队

## 🙏 致谢

感谢所有为这个项目做出贡献的开发者和 JCI Kuala Lumpur 的成员们。

---

**JCI Kuala Lumpur** - 赋能年轻积极公民创造积极变化