# 项目开发规范

## 代码规范

### TypeScript 规范

1. 类型定义
   - 必须为所有变量、函数参数和返回值定义类型
   - 避免使用 `any` 类型，必要时使用 `unknown`
   - 优先使用接口（interface）而不是类型别名（type）
   - 使用类型推断时确保类型安全

2. 命名规范
   - 使用小驼峰命名法（camelCase）
   - 接口和类型别名使用大驼峰命名法（PascalCase）
   - 枚举值使用大驼峰命名法（PascalCase）
   ```typescript
   // 接口命名
   interface UserProfile {
     id: string;
     name: string;
   }

   // 类型别名
   type UserRole = 'admin' | 'user' | 'guest';

   // 枚举
   enum Status {
     Active = 'active',
     Inactive = 'inactive'
   }

   // 变量和函数命名
   const userName = 'John';
   const getUserProfile = (id: string): UserProfile => {
     // ...
   };
   ```

### React 组件规范

1. 组件结构
   ```typescript
   // 导入顺序
   import { useState, useEffect } from 'react';
   import type { FC } from 'react';
   import styles from './Component.module.css';

   // 类型定义
   interface Props {
     title: string;
     onAction: () => void;
   }

   // 组件定义
   export const Component: FC<Props> = ({ title, onAction }) => {
     // hooks
     const [state, setState] = useState<StateType>(initialState);

     // 副作用
     useEffect(() => {
       // 副作用逻辑
     }, [dependencies]);

     // 渲染
     return (
       <div>
         {title}
       </div>
     );
   };
   ```

2. Hooks 使用规范
   - 自定义 Hook 必须以 `use` 开头
   - 在组件顶层调用 Hooks
   - 确保 Hooks 的依赖数组完整

### 样式规范

1. Tailwind CSS
   ```tsx
   // 推荐
   <div className="flex items-center justify-between p-4 bg-white rounded-lg shadow-md">
     <h1 className="text-xl font-bold text-gray-800">标题</h1>
   </div>

   // 不推荐
   <div className="flex items-center justify-between p-4 bg-white rounded-lg shadow-md text-xl font-bold text-gray-800">
     <h1>标题</h1>
   </div>
   ```

2. CSS Modules
   - 使用 camelCase 命名类名
   - 避免过深的嵌套
   - 使用 BEM 命名规范

## 代码质量工具

### ESLint 配置

```json
{
  "extends": [
    "next/core-web-vitals",
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:react/recommended",
    "plugin:react-hooks/recommended"
  ],
  "rules": {
    "no-console": ["warn", { "allow": ["warn", "error"] }],
    "@typescript-eslint/explicit-function-return-type": "warn",
    "@typescript-eslint/no-explicit-any": "error",
    "react/prop-types": "off"
  }
}
```

### Prettier 配置

```json
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": true,
  "printWidth": 100,
  "tabWidth": 2,
  "useTabs": false
}
```

## Git 工作流

### 分支管理

1. 主分支
   - `main`: 生产环境分支
   - `develop`: 开发环境分支

2. 功能分支
   - `feature/*`: 新功能开发
   - `bugfix/*`: 问题修复
   - `hotfix/*`: 紧急修复

### 提交规范

```
<type>(<scope>): <subject>

<body>

<footer>
```

类型（type）：
- feat: 新功能
- fix: 修复
- docs: 文档
- style: 格式
- refactor: 重构
- test: 测试
- chore: 构建过程或辅助工具的变动

## 测试规范

### 单元测试

```typescript
import { render, screen } from '@testing-library/react';
import { Component } from './Component';

describe('Component', () => {
  it('should render correctly', () => {
    render(<Component title="Test" onAction={() => {}} />);
    expect(screen.getByText('Test')).toBeInTheDocument();
  });
});
```

### 测试覆盖率要求

- 语句覆盖率 > 80%
- 分支覆盖率 > 70%
- 函数覆盖率 > 80%
- 行覆盖率 > 80%

## 性能优化

### 代码分割

```typescript
// 使用动态导入
const DynamicComponent = dynamic(() => import('./DynamicComponent'), {
  loading: () => <LoadingSpinner />,
  ssr: false
});
```

### 图片优化

```tsx
// 使用 Next.js Image 组件
import Image from 'next/image';

<Image
  src="/images/example.jpg"
  alt="Example"
  width={500}
  height={300}
  priority={false}
  loading="lazy"
/>
```

## 文档规范

### 代码注释

```typescript
/**
 * 计算两个数字的和
 * @param a - 第一个数字
 * @param b - 第二个数字
 * @returns 两个数字的和
 */
function add(a: number, b: number): number {
  return a + b;
}
```

### README 规范

每个组件目录应包含：
- 组件说明
- 使用示例
- Props 说明
- 注意事项

## 安全规范

1. 数据安全
   - 敏感信息加密存储
   - 使用环境变量管理密钥
   - 实现请求限流

2. 代码安全
   - 避免使用 `eval`
   - 防止 XSS 攻击
   - 实现 CSRF 防护

## 发布流程

1. 版本号规范
   - 遵循语义化版本（Semantic Versioning）
   - 格式：`主版本号.次版本号.修订号`

2. 发布检查清单
   - 代码审查通过
   - 测试覆盖率达标
   - 文档更新完成
   - 性能测试通过