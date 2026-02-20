# Firebase 设置指南

## 问题说明

您遇到了 Firebase 权限错误，这是因为 Firestore 安全规则尚未配置。按照以下步骤设置 Firebase：

## 步骤 1: 部署 Firestore 安全规则

### 方法 A: 使用 Firebase CLI（推荐）

1. **安装 Firebase CLI**（如果尚未安装）：
```bash
npm install -g firebase-tools
```

2. **登录 Firebase**：
```bash
firebase login
```

3. **初始化 Firebase 项目**（如果尚未初始化）：
```bash
firebase init firestore
```
选择：
- 使用现有项目或创建新项目
- 选择 `firestore.rules` 作为规则文件
- 选择 `firestore.indexes.json` 作为索引文件（可选）

4. **部署安全规则**：
```bash
firebase deploy --only firestore:rules
```

### 方法 B: 在 Firebase Console 中手动设置规则（快速测试）

**快速测试（使用简化规则）**：

1. 打开 [Firebase Console](https://console.firebase.google.com/)
2. 选择您的项目
3. 进入 **Firestore Database** > **规则** 标签
4. 复制 `firestore.rules.simple` 文件的内容
5. 粘贴到规则编辑器中
6. 点击 **发布**

**⚠️ 警告**: `firestore.rules.simple` 允许所有认证用户进行读写操作，仅用于开发测试！

**生产环境（使用完整规则）**：

1. 在 Firebase Console 中，进入 **Firestore Database** > **规则** 标签
2. 复制 `firestore.rules` 文件的内容
3. 粘贴到规则编辑器中
4. 点击 **发布**

## 步骤 2: 在 Firebase Console 中手动设置规则（如果无法使用 CLI）

1. 打开 [Firebase Console](https://console.firebase.google.com/)
2. 选择您的项目
3. 进入 **Firestore Database** > **规则** 标签
4. 复制 `firestore.rules` 文件的内容（或使用 `firestore.rules.simple` 进行快速测试）
5. 粘贴到规则编辑器中
6. 点击 **发布**

**注意**: 如果您想快速测试，可以先使用 `firestore.rules.simple` 文件，它允许所有认证用户进行读写操作。部署到生产环境前，请使用完整的 `firestore.rules` 文件。

## 步骤 3: 启用 Firebase Authentication

1. 在 Firebase Console 中，进入 **Authentication**
2. 点击 **开始使用**
3. 在 **登录方法** 标签中，启用：
   - **电子邮件/密码**（必需）
   - **Google**（可选，如果使用 Google 登录）

## 步骤 4: 部署 Firebase Storage 规则

### 使用 Firebase CLI 部署 Storage 规则：
```bash
firebase deploy --only storage
```

### 或在 Firebase Console 中手动设置：
1. 打开 [Firebase Console](https://console.firebase.google.com/)
2. 选择您的项目
3. 进入 **Storage** > **规则** 标签
4. 复制 `storage.rules` 文件的内容
5. 粘贴到规则编辑器中
6. 点击 **发布**

## 步骤 5: 部署 Firestore 索引

### 使用 Firebase CLI 部署索引：
```bash
firebase deploy --only firestore:indexes
```

### 或在 Firebase Console 中手动创建索引：
1. 打开 [Firebase Console](https://console.firebase.google.com/)
2. 选择您的项目
3. 进入 **Firestore Database** > **索引** 标签
4. 根据 `firestore.indexes.json` 文件手动创建复合索引

## 步骤 6: 设置 Cloud Functions（可选）

### 安装 Cloud Functions 依赖：
```bash
cd functions
npm install
```

### 部署 Cloud Functions：
```bash
firebase deploy --only functions
```

## 步骤 7: 检查环境变量

确保您的 `.env` 文件包含所有必需的 Firebase 配置：

```env
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project_id.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

## 步骤 8: 测试注册流程

注册新用户时，系统会：
1. 在 Firebase Authentication 中创建用户
2. 在 Firestore `members` 集合中创建对应的会员文档

确保安全规则允许新用户创建自己的会员文档。

## 安全规则说明

已创建的安全规则提供以下权限：

- **会员 (Members)**: 
  - 所有认证用户可读取
  - 用户可创建自己的会员文档（注册时）
  - 用户可更新自己的资料，Board/Admin 可更新任何会员

- **通信 (Communication)**:
  - 所有认证用户可读取
  - 会员可创建帖子
  - 作者或 Board/Admin 可更新/删除

- **其他集合**: 根据角色提供相应权限

## 故障排除

### 错误: "Missing or insufficient permissions"

1. 确保已部署最新的安全规则
2. 检查用户是否已通过 Firebase Authentication 认证
3. 检查用户的会员文档是否存在且包含正确的 `role` 字段

### 错误: 注册时 400 Bad Request

1. 确保已启用 **电子邮件/密码** 登录方法
2. 检查 Firebase API 密钥是否正确
3. 检查密码是否符合 Firebase 要求（至少 6 个字符）
4. 检查 Firebase Console > Authentication > 设置 > 授权域，确保您的域名已添加
5. 如果使用本地开发，确保 `localhost` 在授权域列表中

### 开发模式

如果使用开发模式（`isDevMode()` 返回 `true`），代码会使用模拟数据，不会访问 Firebase。要测试 Firebase 集成，请确保开发模式已关闭。

## 下一步

部署规则后，重新尝试注册和登录。如果仍有问题，请检查：
1. Firebase Console 中的规则是否已更新
2. 浏览器控制台中的详细错误信息
3. Firebase Console > Firestore Database > 使用情况 中的权限拒绝日志

