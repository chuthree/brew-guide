# 项目结构规范

## 目录结构

```
brew-guide/
├── src/                    # 源代码目录
│   ├── app/               # Next.js 应用主目录
│   │   ├── (auth)/       # 认证相关路由
│   │   ├── (dashboard)/  # 仪表板相关路由
│   │   ├── api/          # API 路由
│   │   ├── layout.tsx    # 根布局
│   │   └── page.tsx      # 首页
│   │
│   ├── components/       # 共享组件
│   │   ├── common/      # 通用组件
│   │   ├── forms/       # 表单组件
│   │   ├── layout/      # 布局组件
│   │   └── ui/          # UI 基础组件
│   │
│   ├── features/        # 功能模块
│   │   ├── auth/        # 认证功能
│   │   ├── recognition/ # 识别功能
│   │   └── settings/    # 设置功能
│   │
│   ├── hooks/           # 自定义 Hooks
│   ├── lib/             # 工具函数和通用库
│   ├── locales/         # 国际化文件
│   │   ├── en/         # 英文翻译
│   │   └── zh/         # 中文翻译
│   ├── providers/       # 全局状态和上下文
│   ├── services/        # API 服务
│   ├── styles/          # 全局样式
│   └── types/           # TypeScript 类型定义
│
├── public/              # 静态资源
│   ├── images/         # 图片资源
│   │   ├── icons/     # 图标资源
│   │   │   ├── app/   # 应用图标
│   │   │   └── ui/    # UI 图标
│   │   ├── logos/     # Logo 图片
│   │   ├── backgrounds/ # 背景图片
│   │   ├── avatars/   # 头像图片
│   │   └── content/   # 内容图片
│   └── fonts/          # 字体文件
│
├── tests/              # 测试文件
│   ├── unit/          # 单元测试
│   ├── integration/   # 集成测试
│   └── e2e/           # 端到端测试
│
├── docs/              # 项目文档
│   ├── api/          # API 文档
│   ├── guides/       # 开发指南
│   └── examples/     # 示例代码
│
├── scripts/          # 构建和部署脚本
├── .github/         # GitHub 配置
├── android/         # Android 平台相关
├── ios/            # iOS 平台相关
└── config/         # 项目配置文件
```

## 目录说明

### src/
源代码主目录，包含所有业务逻辑和功能实现。

#### app/
- 使用 Next.js 13+ 的 App Router
- 按功能模块组织路由
- 使用路由组（Route Groups）组织相关路由

#### components/
- `common/`: 跨功能模块的通用组件
- `forms/`: 表单相关组件
- `layout/`: 布局相关组件
- `ui/`: 基础 UI 组件（按钮、输入框等）

#### features/
按功能模块组织的代码，每个模块包含：
- 组件
- 状态管理
- 类型定义
- 工具函数
- 测试文件

#### hooks/
- 自定义 React Hooks
- 按功能分类组织
- 包含单元测试

#### lib/
- 工具函数
- 常量定义
- 通用类型
- 第三方库封装

#### locales/
- 按语言分类的翻译文件
- 支持多语言切换
- 使用 JSON 或 YAML 格式
- 按功能模块组织翻译内容

#### providers/
- 全局状态管理
- 主题配置
- 国际化配置
- 认证状态

#### services/
- API 客户端
- 数据获取和缓存
- 错误处理
- 请求拦截器

### public/
静态资源目录，包含不需要处理的文件。

### tests/
- `unit/`: 单元测试
- `integration/`: 集成测试
- `e2e/`: 端到端测试

### docs/
项目文档和指南。

### scripts/
构建、部署和开发工具脚本。

## 文件命名规范

1. 组件文件
   - 使用 PascalCase
   - 例如：`UserProfile.tsx`

2. 工具函数
   - 使用 camelCase
   - 例如：`formatDate.ts`

3. 样式文件
   - 使用 kebab-case
   - 例如：`user-profile.module.css`

4. 测试文件
   - 与源文件同名，添加 `.test` 或 `.spec`
   - 例如：`UserProfile.test.tsx`

## 导入规范

1. 导入顺序
   ```typescript
   // 1. 外部依赖
   import { useState } from 'react';
   import { motion } from 'framer-motion';

   // 2. 内部模块
   import { useAuth } from '@/hooks/useAuth';
   import { Button } from '@/components/ui/Button';

   // 3. 类型导入
   import type { User } from '@/types';

   // 4. 样式导入
   import styles from './Component.module.css';
   ```

2. 路径别名
   ```typescript
   // 使用 @ 作为 src 目录的别名
   import { Button } from '@/components/ui/Button';
   ```

## 模块组织原则

1. 关注点分离
   - 每个模块只负责一个功能
   - 避免模块间的循环依赖

2. 可重用性
   - 提取通用逻辑到独立模块
   - 使用组合而不是继承

3. 可测试性
   - 保持模块的独立性
   - 便于单元测试

4. 可维护性
   - 清晰的目录结构
   - 统一的命名规范
   - 完整的文档注释

## 开发规范

1. 组件开发
   - 使用函数式组件
   - 遵循 React Hooks 规范
   - 保持组件的单一职责

2. 样式管理
   - 使用 Tailwind CSS
   - 遵循移动优先原则
   - 保持样式的一致性

3. 状态管理
   - 使用 React Context 进行全局状态管理
   - 合理使用本地状态
   - 避免过度使用全局状态

4. 类型定义
   - 严格使用 TypeScript
   - 为所有组件和函数定义类型
   - 避免使用 any 类型

5. 文件命名
   - 使用 PascalCase 命名组件文件
   - 使用 camelCase 命名工具函数
   - 使用 kebab-case 命名样式文件

6. 代码组织
   - 相关文件放在同一目录
   - 保持目录结构清晰
   - 避免过深的目录嵌套

## 移动端适配

- 使用 Capacitor 进行跨平台开发
- 支持 Android 和 iOS 平台
- 遵循移动端设计规范

## 性能优化

- 使用 Next.js 的图片优化
- 实现组件懒加载
- 优化资源加载顺序
- 实现适当的缓存策略

## 图片资源规范

### 1. 图片目录结构

```
public/images/
├── icons/              # 图标资源
│   ├── app/           # 应用图标（favicon, PWA 图标等）
│   └── ui/            # UI 图标（按钮、菜单等）
├── logos/             # Logo 图片
├── backgrounds/       # 背景图片
├── avatars/          # 头像图片
└── content/          # 内容图片
```

### 2. 图片命名规范

1. 使用小写字母
2. 使用连字符（-）分隔单词
3. 使用有意义的名称
4. 包含尺寸信息（可选）

示例：
```
button-primary.png
logo-dark-200x200.png
background-hero-1920x1080.jpg
avatar-user-128x128.png
```

### 3. 图片格式选择

1. 图标
   - SVG（首选）
   - PNG（需要透明背景时）
   - ICO（favicon）

2. 照片/插图
   - WebP（首选）
   - JPEG（照片）
   - PNG（需要透明背景时）

### 4. 图片优化

1. 使用 Next.js Image 组件
```tsx
import Image from 'next/image'

<Image
  src="/images/content/coffee-brewing.jpg"
  alt="咖啡冲煮过程"
  width={800}
  height={600}
  priority={false}
  loading="lazy"
/>
```

2. 响应式图片
```tsx
<Image
  src="/images/backgrounds/hero.jpg"
  alt="Hero 背景"
  sizes="100vw"
  style={{
    width: '100%',
    height: 'auto',
  }}
/>
```

### 5. 图片导入规范

1. 使用路径别名
```tsx
// 使用 @public 别名
import logo from '@public/images/logos/logo.png'
```

2. 类型定义
```typescript
// types/images.d.ts
declare module '*.png' {
  const content: string
  export default content
}

declare module '*.jpg' {
  const content: string
  export default content
}

declare module '*.svg' {
  const content: string
  export default content
}
```

### 6. 图片缓存策略

1. 静态资源缓存
```typescript
// next.config.mjs
export default {
  images: {
    minimumCacheTTL: 60, // 缓存时间（秒）
  },
}
```

2. 图片优化配置
```typescript
// next.config.mjs
export default {
  images: {
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    formats: ['image/webp'],
  },
}
```

### 7. 图片加载优化

1. 懒加载
```tsx
<Image
  src="/images/content/coffee.jpg"
  alt="咖啡图片"
  loading="lazy"
/>
```

2. 预加载关键图片
```tsx
<Image
  src="/images/hero.jpg"
  alt="Hero 图片"
  priority={true}
/>
```

### 8. 图片错误处理

```tsx
<Image
  src="/images/content/coffee.jpg"
  alt="咖啡图片"
  onError={(e) => {
    e.currentTarget.src = '/images/fallback.jpg'
  }}
/>
``` 