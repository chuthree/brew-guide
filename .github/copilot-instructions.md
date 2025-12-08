# Brew Guide - AI Coding Agent Instructions

## Project Overview

Brew Guide 是一个全栈的咖啡冲煮辅助应用，支持 Web/PWA、iOS、Android 和桌面平台。核心功能包括计时器辅助冲煮、咖啡豆库存管理、冲煮笔记记录和数据同步。

**技术栈**: Next.js 15 (App Router) + React 19 + TypeScript + Tailwind CSS 4 + Capacitor 7 + Dexie (IndexedDB)

**后端**: Node.js + Express (独立 API 服务器，位于 `server/` 目录)

## 核心架构要点

### 1. 静态导出 + PWA 模式

- **关键配置**: `next.config.mjs` 使用 `output: 'export'` 生成静态站点
- **所有组件默认使用 `'use client'`** - 这是 Client Components，因为 App Router 配合静态导出无法使用 Server Components
- Service Worker 由 `scripts/generate-sw.mjs` 在构建后用 Workbox 生成（**不要**手动编辑 `sw.js`）
- **构建命令**: `pnpm build` 会执行 Next.js 构建 + SW 生成，输出到 `out/` 目录

### 2. 数据持久化分层架构

```
Components → Zustand Stores → Managers → Dexie (IndexedDB)
                    ↓
          localStorage (仅配置/设置)
```

**关键模式**:

- **数据库**: `src/lib/core/db.ts` (Dexie) - 存储 `coffeeBeans`, `brewingNotes`, `customEquipments`, `customMethods`, `settings`
- **状态管理**: `src/lib/stores/*Store.ts` (Zustand) - 内存中缓存 + 操作方法
- **业务逻辑**: `src/lib/managers/*Manager.ts` - 封装 CRUD 操作，连接 Store 和 DB
- **初始化流程**: `src/providers/StorageProvider.tsx` 在应用启动时初始化 DB 并迁移 localStorage 遗留数据

**存储规则**:

- ✅ 咖啡豆、冲煮笔记、自定义器具/方案 → IndexedDB
- ✅ 用户设置（主题、语言、缩放等） → localStorage
- ❌ 不要在 Store 外直接操作 `db.*` - 必须通过 Manager 或 Store 方法

### 3. Capacitor 原生能力集成

- **配置**: `capacitor.config.ts` - 定义 `appId: 'com.brewguide.app'`，输出目录 `webDir: 'out'`
- **能力检测**: 使用 `Capacitor.isNativePlatform()` 判断是否在原生环境
- **动态导入**: Capacitor 插件通过 `await import('@capacitor/...')` 动态加载，避免 Web 端报错
  ```typescript
  const { Haptics } = await import('@capacitor/haptics');
  if (Capacitor.isNativePlatform()) {
    await Haptics.impact({ style: ImpactStyle.Light });
  }
  ```
- **常用插件**: `@capacitor/haptics`, `@capacitor/share`, `@capacitor/camera`, `@capacitor-community/safe-area`

### 4. 路径别名和导入规范

**`tsconfig.json` 配置**:

```jsonc
{
  "paths": {
    "@/*": ["./src/*"],
    "@public/*": ["./public/*"],
    "@images/*": ["./public/images/*"]
  }
}
```

**导入顺序**（参考现有代码）:

1. React/Next.js 核心库
2. 第三方库（Zustand、Dexie、Capacitor 等）
3. `@/components/*`
4. `@/lib/*` (hooks, stores, utils)
5. `@/types/*`
6. 样式文件

### 5. 同步机制 (WebDAV / S3)

- **基类**: `src/lib/sync/BaseSyncManager.ts` - 定义统一的同步逻辑
- **实现**: `src/lib/webdav/` 和 `src/lib/s3/` - 分别实现 WebDAV 和 S3 客户端
- **冲突策略**: `SyncPlanner` 根据时间戳和文件哈希计算增量同步方案
- **元数据**: 本地和远程分别维护 `SyncMetadataV2`，记录设备 ID、文件哈希、最后同步时间

**关键点**:

- 同步前必须调用 `testConnection()` 验证配置
- 使用 `deviceId` 区分不同设备，避免循环同步
- 同步时加锁（`syncInProgress`）防止并发冲突

## 开发工作流

### 启动开发环境

```bash
pnpm install        # 安装依赖
pnpm dev            # 启动 Web 开发服务器 (localhost:3000)
```

### 移动端开发

```bash
pnpm build          # 先构建 Web 静态文件
pnpm cap:build      # 同步到 Capacitor 项目
pnpm cap:ios        # 打开 Xcode (macOS)
pnpm cap:android    # 打开 Android Studio
```

### 后端 API 开发

```bash
cd server
pnpm install
pnpm dev            # 启动后端服务 (localhost:3100)
```

**API 服务器结构** (`server/`):

- `routes/` - Express 路由（咖啡豆识别、年度报告、反馈系统）
- `services/ai.js` - 调用阿里云通义千问 API (流式/非流式)
- `middlewares/` - 限流、CORS、文件上传验证、错误处理
- `utils/logger.js` - Winston 日志系统（文件轮转）

## 编码规范和模式

### 组件模式

```typescript
'use client'; // 必须添加，因为使用静态导出

import { useState, useEffect } from 'react';
import { useCoffeeBeanStore } from '@/lib/stores/coffeeBeanStore';

export default function MyComponent() {
  const { beans, loadBeans } = useCoffeeBeanStore();

  useEffect(() => {
    loadBeans(); // 组件挂载时加载数据
  }, [loadBeans]);

  // ...
}
```

### Store 模式 (Zustand)

```typescript
import { create } from 'zustand';
import { Manager } from '@/lib/managers/manager';

interface Store {
  items: Item[];
  loadItems: () => Promise<void>;
  addItem: (item: Item) => Promise<void>;
}

export const useStore = create<Store>((set, get) => ({
  items: [],

  loadItems: async () => {
    const items = await Manager.getAll();
    set({ items });
  },

  addItem: async (item: Item) => {
    const newItem = await Manager.add(item);
    set(state => ({ items: [...state.items, newItem] }));
  },
}));
```

### Manager 模式 (业务逻辑层)

```typescript
import { db } from '@/lib/core/db';

export const Manager = {
  async getAll(): Promise<Item[]> {
    return await db.items.toArray();
  },

  async add(item: Item): Promise<Item> {
    await db.items.add(item);
    return item;
  },

  async update(id: string, updates: Partial<Item>): Promise<Item> {
    await db.items.update(id, updates);
    return (await db.items.get(id))!;
  },
};
```

### 样式约定

- **Tailwind CSS 4**: 使用最新语法（如 `dvh`、`@tailwindcss/postcss`）
- **CSS 变量**: 主题色通过 `var(--background)`, `var(--foreground)` 定义
- **安全区域**: 使用 `padding-safe-top` 等工具类适配 iOS 刘海屏（通过 `@capacitor-community/safe-area` 插件注入 CSS 变量）
- **字体**: 正文使用系统字体栈 `--font-sans`，计时器使用等宽字体 `--font-timer` (Geist Mono)

### 类型定义

- **全局类型**: `src/types/app.d.ts` - `CoffeeBean`, `BrewingNote`, `BlendComponent` 等
- **配置类型**: `src/lib/core/config.ts` - `Stage`, `Method`, `Equipment`, `BrewingMethods`
- **避免 `any`**: 优先使用 `unknown` 或具体类型，必要时用 `as` 断言

## 常见任务指南

### 添加新的设置项

1. 在 `src/lib/core/storage.ts` 添加读写方法
2. 在 `src/components/settings/` 创建设置组件
3. 在 `Settings.tsx` 引入组件

### 添加新的咖啡豆字段

1. 修改 `src/types/app.d.ts` 的 `CoffeeBean` 接口
2. 更新 `src/components/coffee-bean/Form/` 表单逻辑
3. 更新 `src/components/coffee-bean/Detail/` 详情展示

### 添加新的冲煮器具

1. 在 `src/lib/core/config.ts` 的 `equipmentList` 添加器具配置
2. 在 `brewingMethods` 添加对应的冲煮方案
3. 在 `public/images/equipment/` 添加器具图标（SVG 优先）
4. (可选) 在 `src/components/brewing/animations/` 添加自定义动画

### 修改计时器逻辑

- **主组件**: `src/components/brewing/BrewingTimer.tsx`
- **阶段控制**: `src/components/brewing/stages/`
- **可视化**: `src/components/brewing/PourVisualizer.tsx` (SVG 动画)

## 性能和优化

- **虚拟滚动**: 长列表使用 `react-virtuoso` (见 `src/components/coffee-bean/List/`)
- **图片懒加载**: `<img loading="lazy" />` 或 Next.js `<Image />` (需配置 `unoptimized: true`)
- **动画优化**: Framer Motion 使用 `layoutId` 实现共享元素动画，避免重新渲染
- **数据库查询**: Dexie 索引字段见 `db.ts` 的 `version().stores()` - 按索引字段查询可提升性能

## 测试和调试

- **浏览器控制台**: `console.warn()` 用于记录关键信息（如数据库初始化、迁移）
- **Dexie 调试**: 使用 `await db.open()` 后调用 `dbUtils.logStorageInfo()` 查看存储统计
- **性能检查**: 运行 `./scripts/perf-check.sh` 检查包大小和构建性能
- **React Compiler**: 已启用 Babel 插件 `babel-plugin-react-compiler`，减少不必要的重新渲染

## 部署和发布

- **Web/PWA**: `pnpm build` → 部署 `out/` 目录到静态托管（Vercel、Cloudflare Pages 等）
- **Android**: 在 Android Studio 打包 APK/AAB
- **iOS**: 在 Xcode 打包 IPA（需 Apple Developer 账号）
- **桌面端**: 使用 Pake (Rust + WebView) 打包（见 `build-desktop.sh`）

## 关键文件速查

| 文件路径                                  | 作用                                  |
| ----------------------------------------- | ------------------------------------- |
| `src/app/page.tsx`                        | 应用主页面入口                        |
| `src/lib/core/db.ts`                      | Dexie 数据库定义                      |
| `src/lib/core/config.ts`                  | 器具、方案、类型定义                  |
| `src/lib/core/storage.ts`                 | localStorage 读写工具                 |
| `src/providers/StorageProvider.tsx`       | 数据库初始化和迁移                    |
| `src/components/brewing/BrewingTimer.tsx` | 计时器核心组件                        |
| `server/server.js`                        | 后端 API 入口                         |
| `capacitor.config.ts`                     | Capacitor 配置（App ID、插件等）      |
| `next.config.mjs`                         | Next.js 配置（静态导出、SVG 处理等）  |
| `docs/ARCHITECTURE.md`                    | 详细架构文档（中文）                  |
| `.env` (server/)                          | 后端环境变量（API Key、管理员密钥等） |

## 注意事项

- ❌ **不要**在 `use client` 组件中使用 Server Actions
- ❌ **不要**手动编辑 `sw.js` - 由 `scripts/generate-sw.mjs` 自动生成
- ❌ **不要**在组件中直接操作 `db.*` - 必须通过 Store 或 Manager
- ✅ **务必**在移动端测试 Capacitor 功能（相机、分享、触觉反馈等）
- ✅ **务必**使用 `Capacitor.isNativePlatform()` 条件执行原生 API
- ✅ **务必**在修改数据库结构后更新 `db.ts` 的 `version().stores()` 版本号

## 相关资源

- [架构文档 (中文)](../docs/ARCHITECTURE.md)
- [README (中文)](../README.md)
- [Server README](../server/README.md)
- [Next.js App Router 文档](https://nextjs.org/docs/app)
- [Capacitor 文档](https://capacitorjs.com/)
- [Dexie 文档](https://dexie.org/)
