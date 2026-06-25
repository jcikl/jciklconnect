# 开发指南

## 概述

本指南为 JCI Kuala Lumpur 管理平台的开发者提供详细的开发环境设置、代码规范、最佳实践和贡献指南。

## 🛠️ 开发环境设置

### 系统要求
- **Node.js**: 18.0 或更高版本
- **npm**: 8.0 或更高版本
- **Git**: 2.30 或更高版本
- **VS Code**: 推荐的代码编辑器

### 推荐的 VS Code 扩展
```json
{
  "recommendations": [
    "bradlc.vscode-tailwindcss",
    "esbenp.prettier-vscode",
    "dbaeumer.vscode-eslint",
    "ms-vscode.vscode-typescript-next",
    "formulahendry.auto-rename-tag",
    "christian-kohler.path-intellisense",
    "ms-vscode.vscode-json",
    "redhat.vscode-yaml"
  ]
}
```

### 环境配置

#### 1. 克隆项目
```bash
git clone <repository-url>
cd jci-kl-management-platform
```

#### 2. 安装依赖
```bash
npm install
```

#### 3. 环境变量设置
```bash
# 复制环境变量模板
cp .env.example .env

# 编辑 .env 文件
nano .env
```

**环境变量说明：**
```env
# Firebase 配置
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abcdef

# 开发环境配置
NODE_ENV=development
VITE_APP_VERSION=1.0.0
VITE_API_BASE_URL=http://localhost:3000/api

# 功能开关
VITE_ENABLE_ANALYTICS=false
VITE_ENABLE_ERROR_REPORTING=true
```

#### 4. Firebase 设置
```bash
# 安装 Firebase CLI
npm install -g firebase-tools

# 登录 Firebase
firebase login

# 初始化项目
firebase init

# 选择以下服务：
# - Firestore
# - Functions
# - Hosting
# - Storage
```

#### 5. 启动开发服务器
```bash
# 启动前端开发服务器
npm run dev

# 启动 Firebase 模拟器（新终端）
npm run emulators

# 启动 Functions 开发服务器（新终端）
cd functions
npm run serve
```

## 📁 项目结构详解

```
├── src/
│   ├── components/          # React 组件
│   │   ├── ui/             # 基础 UI 组件
│   │   ├── modules/        # 功能模块组件
│   │   ├── accessibility/  # 无障碍组件
│   │   └── performance/    # 性能优化组件
│   ├── hooks/              # 自定义 React Hooks
│   │   ├── useAuth.ts      # 认证相关
│   │   ├── useFirestore.ts # Firestore 操作
│   │   └── useAccessibility.ts # 无障碍功能
│   ├── services/           # 业务逻辑服务
│   │   ├── authService.ts  # 认证服务
│   │   ├── firestoreService.ts # 数据库服务
│   │   └── cacheService.ts # 缓存服务
│   ├── utils/              # 工具函数
│   │   ├── helpers.ts      # 通用辅助函数
│   │   ├── validators.ts   # 数据验证
│   │   └── formatters.ts   # 数据格式化
│   ├── types/              # TypeScript 类型定义
│   │   ├── index.ts        # 主要类型导出
│   │   ├── api.ts          # API 相关类型
│   │   └── components.ts   # 组件相关类型
│   ├── styles/             # 样式文件
│   │   ├── globals.css     # 全局样式
│   │   └── accessibility.css # 无障碍样式
│   └── config/             # 配置文件
│       ├── firebase.ts     # Firebase 配置
│       └── constants.ts    # 应用常量
├── functions/              # Firebase Cloud Functions
│   ├── src/
│   │   ├── index.ts        # Functions 入口
│   │   ├── membership.ts   # 会员管理
│   │   ├── financial.ts    # 财务管理
│   │   └── notifications.ts # 通知服务
│   └── package.json
├── tests/                  # 测试文件
│   ├── unit/              # 单元测试
│   ├── integration/       # 集成测试
│   └── property/          # 属性测试
├── docs/                  # 文档
└── public/                # 静态资源
```

## 🎨 代码规范

### TypeScript 规范

#### 类型定义
```typescript
// ✅ 好的做法
interface User {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
  updatedAt: Date;
}

// ❌ 避免的做法
interface User {
  id: any;
  name: any;
  email: any;
}
```

#### 函数定义
```typescript
// ✅ 好的做法
const fetchUser = async (userId: string): Promise<User | null> => {
  try {
    const user = await userService.getById(userId);
    return user;
  } catch (error) {
    console.error('Failed to fetch user:', error);
    return null;
  }
};

// ❌ 避免的做法
const fetchUser = async (userId) => {
  const user = await userService.getById(userId);
  return user;
};
```

### React 组件规范

#### 函数组件
```typescript
// ✅ 好的做法
interface UserCardProps {
  user: User;
  onEdit?: (user: User) => void;
  className?: string;
}

export const UserCard: React.FC<UserCardProps> = ({ 
  user, 
  onEdit, 
  className = '' 
}) => {
  const handleEdit = useCallback(() => {
    onEdit?.(user);
  }, [user, onEdit]);

  return (
    <div className={`user-card ${className}`}>
      <h3>{user.name}</h3>
      <p>{user.email}</p>
      {onEdit && (
        <button onClick={handleEdit}>编辑</button>
      )}
    </div>
  );
};
```

#### Hooks 使用
```typescript
// ✅ 好的做法
const useUserData = (userId: string) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        setLoading(true);
        const userData = await userService.getById(userId);
        setUser(userData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    if (userId) {
      fetchUser();
    }
  }, [userId]);

  return { user, loading, error };
};
```

### CSS/Tailwind 规范

#### 组件样式
```typescript
// ✅ 好的做法
const Button: React.FC<ButtonProps> = ({ 
  variant = 'primary', 
  size = 'md',
  children,
  className = '',
  ...props 
}) => {
  const baseClasses = 'inline-flex items-center justify-center font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2';
  
  const variantClasses = {
    primary: 'bg-jci-blue text-white hover:bg-blue-700 focus:ring-jci-blue',
    secondary: 'bg-slate-200 text-slate-900 hover:bg-slate-300 focus:ring-slate-500',
    danger: 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500'
  };

  const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-6 py-3 text-lg'
  };

  return (
    <button
      className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};
```

## 🧪 测试策略

### 单元测试
```typescript
// components/__tests__/UserCard.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { UserCard } from '../UserCard';

const mockUser: User = {
  id: '1',
  name: '张三',
  email: 'zhang@example.com',
  createdAt: new Date(),
  updatedAt: new Date()
};

describe('UserCard', () => {
  it('should render user information', () => {
    render(<UserCard user={mockUser} />);
    
    expect(screen.getByText('张三')).toBeInTheDocument();
    expect(screen.getByText('zhang@example.com')).toBeInTheDocument();
  });

  it('should call onEdit when edit button is clicked', () => {
    const onEdit = jest.fn();
    render(<UserCard user={mockUser} onEdit={onEdit} />);
    
    fireEvent.click(screen.getByText('编辑'));
    expect(onEdit).toHaveBeenCalledWith(mockUser);
  });
});
```

### 集成测试
```typescript
// tests/integration/auth.test.ts
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../src/config/firebase';

describe('Authentication Integration', () => {
  it('should authenticate user with valid credentials', async () => {
    const email = 'test@example.com';
    const password = 'password123';
    
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    expect(userCredential.user).toBeDefined();
    expect(userCredential.user.email).toBe(email);
  });
});
```

### 属性测试
```typescript
// tests/property/validation.test.ts
import fc from 'fast-check';
import { validateEmail } from '../src/utils/validators';

describe('Email Validation Properties', () => {
  it('should validate email format correctly', () => {
    fc.assert(fc.property(
      fc.emailAddress(),
      (email) => {
        expect(validateEmail(email)).toBe(true);
      }
    ));
  });
});
```

## 🚀 部署流程

### 开发环境部署
```bash
# 构建项目
npm run build

# 预览构建结果
npm run preview

# 部署到 Firebase Hosting
firebase deploy --only hosting
```

### 生产环境部署
```bash
# 1. 运行所有测试
npm test

# 2. 构建生产版本
npm run build:prod

# 3. 部署 Functions
firebase deploy --only functions

# 4. 部署 Firestore 规则
firebase deploy --only firestore:rules

# 5. 部署 Hosting
firebase deploy --only hosting

# 6. 完整部署
firebase deploy
```

### CI/CD 配置
```yaml
# .github/workflows/deploy.yml
name: Deploy to Firebase

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run tests
        run: npm test
      
      - name: Build project
        run: npm run build
      
      - name: Deploy to Firebase
        uses: FirebaseExtended/action-hosting-deploy@v0
        with:
          repoToken: '${{ secrets.GITHUB_TOKEN }}'
          firebaseServiceAccount: '${{ secrets.FIREBASE_SERVICE_ACCOUNT }}'
          projectId: your-project-id
```

## 🔧 开发工具

### 调试工具
```typescript
// 开发环境调试配置
if (process.env.NODE_ENV === 'development') {
  // 启用 React DevTools
  window.__REACT_DEVTOOLS_GLOBAL_HOOK__ = window.__REACT_DEVTOOLS_GLOBAL_HOOK__ || {};
  
  // 启用 Firebase 调试
  import('./config/firebase-debug').then(({ enableFirebaseDebug }) => {
    enableFirebaseDebug();
  });
}
```

### 性能监控
```typescript
// utils/performance.ts
export const measurePerformance = (name: string, fn: () => void) => {
  if (process.env.NODE_ENV === 'development') {
    performance.mark(`${name}-start`);
    fn();
    performance.mark(`${name}-end`);
    performance.measure(name, `${name}-start`, `${name}-end`);
    
    const measure = performance.getEntriesByName(name)[0];
    console.log(`${name}: ${measure.duration}ms`);
  } else {
    fn();
  }
};
```

## 📝 代码审查清单

### 提交前检查
- [ ] 代码符合 ESLint 规则
- [ ] 所有 TypeScript 类型正确
- [ ] 单元测试通过
- [ ] 无障碍功能正常
- [ ] 性能影响评估
- [ ] 安全性检查

### Pull Request 清单
- [ ] 功能完整实现
- [ ] 测试覆盖率足够
- [ ] 文档已更新
- [ ] 变更日志已更新
- [ ] 向后兼容性检查

## 🤝 贡献指南

### 分支策略
```
main          # 生产分支
├── develop   # 开发分支
├── feature/* # 功能分支
├── hotfix/*  # 热修复分支
└── release/* # 发布分支
```

### 提交信息规范
```
type(scope): description

feat(auth): add social login support
fix(ui): resolve button alignment issue
docs(api): update authentication guide
style(components): format code with prettier
refactor(hooks): simplify useAuth implementation
test(utils): add validation tests
chore(deps): update dependencies
```

### 发布流程
1. 创建 release 分支
2. 更新版本号
3. 运行完整测试套件
4. 更新变更日志
5. 合并到 main 分支
6. 创建 Git 标签
7. 部署到生产环境

---

遵循这些开发指南将帮助您创建高质量、可维护的代码，并确保项目的长期成功。