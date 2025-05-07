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
│   │   ├── equipment/   # 器具相关组件
│   │   │   ├── forms/   # 器具表单
│   │   │   ├── import/  # 器具导入功能
│   │   │   └── share/   # 器具分享功能
│   │   ├── method/      # 冲煮方法相关组件
│   │   │   ├── forms/   # 方法表单
│   │   │   ├── import/  # 方法导入功能
│   │   │   └── share/   # 方法分享功能
│   │   ├── brewing/     # 冲煮过程相关组件
│   │   │   ├── stages/  # 冲煮阶段组件
│   │   │   └── Timer/   # 计时器及相关功能
│   │   ├── onboarding/   # 引导相关组件
│   │   ├── settings/    # 设置相关组件
│   │   ├── notes/       # 笔记相关组件
│   │   │   ├── Form/    # 笔记表单
│   │   │   ├── List/    # 笔记列表
│   │   │   └── Share/   # 笔记分享功能
│   │   ├── layout/      # 布局相关组件
│   │   └── coffee-bean/ # 咖啡豆相关组件
│   │       ├── Form/    # 咖啡豆表单
│   │       ├── List/    # 咖啡豆列表
│   │       └── import/  # 咖啡豆导入功能
│   │
│   ├── hooks/           # 自定义 Hooks
│   ├── lib/             # 工具函数和通用库
│   │   ├── core/        # 核心功能
│   │   ├── utils/       # 工具函数
│   │   │   ├── jsonUtils.ts  # JSON处理和数据转换工具
│   │   │   └── exportUtils.ts # 数据导出相关工具
│   │   ├── managers/    # 管理器
│   │   │   ├── customMethods.ts  # 自定义方法管理
│   │   │   └── coffeeBeans.ts    # 咖啡豆数据管理
│   │   ├── brewing/     # 冲煮相关功能
│   │   └── app/         # 应用程序相关功能
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
  - 错误处理组件
  - 手势交互组件
  - 画布组件
  - PWA 提示组件
  - 其他通用组件
- `equipment/`: 器具相关组件
  - 器具列表
  - 器具表单
  - 器具导入导出
    - `EquipmentImportModal.tsx` - 导入器具的模态框
    - `EquipmentShareModal.tsx` - 分享器具的模态框
- `method/`: 冲煮方法相关组件
  - 方法选择器
  - 方法表单
  - 方法导入导出
    - `MethodImportModal.tsx` - 导入方法的模态框
    - `MethodShareModal.tsx` - 分享方法的模态框
    - 支持文本和JSON格式的数据交换
    - 与AI助手集成的导入提示词
- `brewing/`: 冲煮过程相关组件
  - 计时器
    - `Timer/StageProcessor.ts` - 处理冲煮阶段的扩展和计算
    - `Timer/types.ts` - 定义计时器相关类型
    - `Timer/utils.ts` - 计时器辅助函数
  - 动画编辑器
  - 冲煮步骤
    - `stages/StageItem.tsx` - 单个冲煮步骤的展示
    - 支持注水方式、水量和时间的可视化
- `onboarding/`: 引导相关组件
  - 引导流程
  - 引导页面
- `settings/`: 设置相关组件
  - 使用单一Settings组件管理所有应用程序设置
  - 支持声音、触感反馈、研磨器类型、文本缩放、界面布局、语言等设置
  - 支持暗色/亮色主题切换
  - 库存扣除量预设管理
- `notes/`: 笔记相关组件
  - 笔记列表
  - 笔记表单
  - 笔记详情
  - 笔记分享功能
    - `Share/NoteShareModal.tsx` - 分享笔记的模态框
    - 支持文本和图片格式分享
- `layout/`: 布局相关组件
  - 导航栏
  - 底部操作栏
  - 标签页内容
  - 其他布局组件
- `coffee-bean/`: 咖啡豆相关组件
  - 咖啡豆列表
  - 咖啡豆表单
  - 咖啡豆导入导出
    - `import/BeanImportModal.tsx` - 导入咖啡豆的模态框
    - `share/BeanShareModal.tsx` - 分享咖啡豆的模态框

#### hooks/
- 自定义 React Hooks
- 按功能分类组织
- 包含单元测试
- `useBrewingState.ts` - 冲煮状态管理Hook
- `useBrewingParameters.ts` - 冲煮参数管理Hook
- `useMethodSelector.ts` - 方法选择器Hook

#### lib/
- 工具函数和通用库
  - `core/` - 核心功能模块
    - `config.ts` - 应用程序配置和数据结构定义
    - `storage.ts` - 存储工具
    - `constants.ts` - 应用程序常量
  - `utils/` - 工具函数
    - `jsonUtils.ts` - JSON处理和数据转换工具
      - 数据文本化 - 将结构化数据转换为易读文本
      - 数据解析 - 从文本中提取结构化数据
      - JSON清理 - 处理和格式化JSON字符串
    - `formatUtils.ts` - 格式化工具
    - `validationUtils.ts` - 验证工具
  - `managers/` - 管理器
    - `customMethods.ts` - 冲煮方法管理
      - 加载、保存、删除、复制和分享方法
    - `coffeeBeans.ts` - 咖啡豆数据管理
    - `brewingNotes.ts` - 冲煮笔记管理
  - `ui/` - UI 相关
  - `platform/` - 平台相关
  - `hooks/` - 自定义 Hooks
  - `brewing/` - 冲煮相关功能
    - `constants.ts` - 冲煮常量
    - `events.ts` - 冲煮事件系统
    - `parameters.ts` - 冲煮参数处理
    - `analysis.ts` - 冲煮数据分析工具
  - `app/` - 应用程序相关功能

工具函数组织规范：
1. 按功能分类到不同的文件中
2. 文件名应该以 `Utils` 结尾
3. 每个工具函数文件应该专注于单一功能领域
4. 工具函数应该有完整的 JSDoc 注释
5. 避免使用通用的 `utils.ts` 文件

示例：
```typescript
// utils/classNameUtils.ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * 合并 Tailwind 类名
 * @param inputs - 要合并的类名数组
 * @returns 合并后的类名字符串
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
```

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

7. ESLint 规范
   - 使用 ESLint 进行代码质量检查
   - 提交代码前必须通过 ESLint 检查
   - 遵循以下规则：
     - 未使用的变量必须以下划线 `_` 开头或删除
     - 组件必须使用 PascalCase 命名
     - 函数和变量必须使用 camelCase 命名
     - 常量必须使用 UPPER_SNAKE_CASE 命名
     - 导入必须按类型分组并排序
     - 禁止使用 console.log 等调试语句
     - 必须使用分号结束语句
     - 使用单引号而不是双引号
     - 使用 2 个空格缩进
     - 最大行长度限制为 100 个字符
     - 必须使用 TypeScript 类型注解
     - 禁止使用 any 类型
     - 组件必须使用 React.FC 类型
     - 必须处理所有可能的错误情况
     - 必须为复杂逻辑添加注释
     - 必须为公共 API 添加 JSDoc 注释

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
/images/
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
import logo from '@/images/logos/logo.png'
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

## 数据导入导出规范

### 1. 数据格式

1. JSON 格式
   - 用于数据交换和导入导出
   - 结构化数据，便于程序处理
   - 支持完整数据模型

2. 文本格式
   - 用于人类可读的分享
   - 结构化文本，便于复制粘贴
   - 支持主要字段的摘要

### 2. 导入导出流程

1. 导出流程
   ```
   数据对象 → JSON转换 → (可选)文本化处理 → 复制到剪贴板/保存文件
   ```

2. 导入流程
   ```
   文本输入 → JSON提取 → 数据验证 → 类型转换 → 保存到存储
   ```

### 3. 数据转换工具

1. `jsonUtils.ts` - 包含核心转换功能
   - `extractJsonFromText` - 从文本中提取JSON
   - `methodToReadableText` - 方法转可读文本
   - `parseMethodFromJson` - 从JSON解析方法
   - `brewingNoteToReadableText` - 冲煮笔记转可读文本

2. 导入验证和处理
   - 验证必要字段
   - 补充默认值
   - 添加唯一ID
   - 处理兼容性问题

### 4. 导入导出组件

1. 导入组件
   - 模态框设计
   - 文本输入区域
   - 验证反馈
   - AI助手集成

2. 导出/分享组件
   - 模态框设计
   - 文本和图片格式选项
   - 复制到剪贴板功能
   - 社交分享功能

### 5. AI助手集成

1. 提示词模板
   - 为冲煮方法导入提供结构化提示词
   - 定义JSON格式和字段要求
   - 提供数据转换指导

2. 数据处理
   - 支持从自然语言描述中提取结构化数据
   - 处理不同格式的输入
   - 转换为应用可用的数据结构