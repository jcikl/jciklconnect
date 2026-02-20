# 开发指南

## 前置要求

- **Node.js** 18+（App 与 Functions 均需）
- **npm** 8+
- **Firebase 项目**（Firestore、Auth、Storage、Cloud Functions 已启用）
- 现代浏览器（Chrome 90+, Firefox 88+, Safari 14+, Edge 90+）

## 环境配置

1. 克隆仓库并安装依赖（根目录与 functions 分别安装）：
   ```bash
   npm install
   cd functions && npm install && cd ..
   ```
2. 配置 Firebase：
   - 在项目根目录配置 `firebase.json`、`.env` / `.env.local`（如 `VITE_*`、Firebase 配置）。
   - 根目录可配置 `GEMINI_API_KEY` 等（见 vite.config.ts define）。
3. 本地开发：
   ```bash
   npm run dev          # 前端 dev server（如 port 3000）
   npm run build        # 前端生产构建
   npm run preview      # 预览构建结果
   ```
4. Functions 本地：
   ```bash
   cd functions
   npm run build
   npm run serve        # 使用 Firebase 模拟器
   ```

## 常用脚本（根目录）

| 脚本 | 说明 |
|------|------|
| dev | Vite 开发服务器 |
| build | Vite 生产构建 |
| preview | 预览构建 |
| test | Vitest 单元测试 |
| test:ui | Vitest UI |

## 常用脚本（functions）

| 脚本 | 说明 |
|------|------|
| build | 编译 TypeScript → lib/ |
| serve | 构建并启动 Firebase 模拟器（仅 functions） |
| deploy | 部署到 Firebase |

## 测试

- 前端：Vitest（`npm run test` / `test:ui`）。
- 后端：见 functions 内是否有测试脚本或 Jest 配置。

## 代码规范与路径

- TypeScript 严格模式；路径别名 `@/*` 指向项目根（见 vite.config.ts、tsconfig.json）。
- 样式：Tailwind；主题色在 tailwind.config.js（jci.blue, navy, teal 等）。

## 文档入口

- 项目与架构概览：`docs/README.md`、`docs/architecture/README.md`。
- 生成文档索引：`_bmad-output/index.md`。
