# 性能优化规范

> **重要**: AI 生成代码时必须遵守以下规范,防止性能退化

## 核心原则

### 1. 组件优化三板斧

```tsx
// ✅ 正确示例
import React, { useState, useCallback, useMemo } from 'react';

const MyComponent = ({ data, onUpdate }) => {
  // 1️⃣ 使用 useCallback 包装事件处理函数
  const handleClick = useCallback(() => {
    onUpdate(data.id);
  }, [data.id, onUpdate]);

  // 2️⃣ 使用 useMemo 缓存计算结果
  const filteredData = useMemo(() => {
    return data.filter(item => item.active);
  }, [data]);

  // 3️⃣ 简单的派生状态直接计算,无需缓存
  const count = data.length;

  return <div onClick={handleClick}>{count}</div>;
};

// 4️⃣ 对纯展示组件使用 React.memo
export default React.memo(MyComponent);
```

### 2. 何时使用优化

| 场景 | 使用 | 不使用 |
|------|------|--------|
| 传递给子组件的函数 | ✅ useCallback | ❌ 直接定义 |
| 复杂计算(循环、过滤、映射) | ✅ useMemo | ❌ 每次渲染重新计算 |
| 简单值(字符串拼接、加法) | ❌ | ✅ 直接计算 |
| 纯展示组件 | ✅ React.memo | ❌ |

### 3. 状态管理规范

```tsx
// ❌ 错误: 过多的独立状态
const [field1, setField1] = useState('');
const [field2, setField2] = useState('');
const [field3, setField3] = useState('');
// ... 10+ 个状态

// ✅ 正确: 合并相关状态
const [formData, setFormData] = useState({
  field1: '',
  field2: '',
  field3: '',
});

// ✅ 或使用 useReducer
const [state, dispatch] = useReducer(reducer, initialState);
```

### 4. 事件监听器规范

```tsx
// ✅ 正确: 使用 useCallback 确保引用稳定
useEffect(() => {
  const handleEvent = () => { /* ... */ };
  window.addEventListener('event', handleEvent);
  return () => window.removeEventListener('event', handleEvent);
}, []); // 依赖数组为空

// ❌ 错误: 每次渲染创建新函数
useEffect(() => {
  window.addEventListener('event', () => { /* ... */ });
  // 忘记清理!
}, []);
```

### 5. 动态导入大组件

```tsx
// ✅ 对大型组件使用 dynamic
import dynamic from 'next/dynamic';

const HeavyComponent = dynamic(
  () => import('@/components/HeavyComponent'),
  { 
    ssr: false,
    loading: () => <div>加载中...</div>
  }
);

// ❌ 不要对小组件使用 dynamic
const Button = dynamic(() => import('@/components/Button')); // 过度优化
```

## 常见性能陷阱

### ❌ 陷阱 1: 在循环中创建函数

```tsx
// ❌ 错误
{items.map(item => (
  <Item 
    key={item.id}
    onClick={() => handleClick(item.id)} // 每次渲染创建新函数!
  />
))}

// ✅ 正确方案 1: 使用 data 属性
{items.map(item => (
  <Item 
    key={item.id}
    data-id={item.id}
    onClick={handleClick} // 单一函数引用
  />
))}

const handleClick = useCallback((e) => {
  const id = e.currentTarget.dataset.id;
  // 处理逻辑
}, []);

// ✅ 正确方案 2: 子组件内部处理
const Item = React.memo(({ id, onItemClick }) => {
  const handleClick = useCallback(() => {
    onItemClick(id);
  }, [id, onItemClick]);
  
  return <div onClick={handleClick}>...</div>;
});
```

### ❌ 陷阱 2: 过度使用 useEffect

```tsx
// ❌ 错误: 不需要 useEffect 的派生状态
const [users, setUsers] = useState([]);
const [activeUsers, setActiveUsers] = useState([]);

useEffect(() => {
  setActiveUsers(users.filter(u => u.active));
}, [users]);

// ✅ 正确: 直接计算或使用 useMemo
const activeUsers = useMemo(
  () => users.filter(u => u.active),
  [users]
);
```

### ❌ 陷阱 3: 忘记依赖数组

```tsx
// ❌ 错误: 缺少依赖
const handleSubmit = useCallback(() => {
  saveData(formData); // formData 未在依赖数组中
}, []);

// ✅ 正确: 包含所有依赖
const handleSubmit = useCallback(() => {
  saveData(formData);
}, [formData]);
```

## 检查清单 (AI 生成代码后必查)

### 组件级别
- [ ] 所有传递给子组件的函数都使用了 `useCallback`
- [ ] 复杂计算(>10行代码)使用了 `useMemo`
- [ ] 纯展示组件使用了 `React.memo`
- [ ] 大型组件(>500行)使用了 `dynamic` 导入

### Hook 级别
- [ ] `useCallback` 和 `useMemo` 的依赖数组完整且准确
- [ ] `useEffect` 中的事件监听器都有清理函数
- [ ] 没有不必要的 `useEffect`(能直接计算的不要用 effect)

### 状态管理
- [ ] 相关状态已合并为对象
- [ ] 没有冗余的派生状态
- [ ] 全局状态使用了适当的缓存机制

### 列表渲染
- [ ] 所有 `.map()` 都有正确的 `key`
- [ ] 列表项的 `onClick` 等回调已优化(不在循环中创建函数)
- [ ] 长列表考虑使用虚拟滚动(如 react-virtuoso)

## 自动化工具推荐

### 1. ESLint 规则
```json
{
  "rules": {
    "react-hooks/exhaustive-deps": "warn",
    "react/jsx-no-bind": ["warn", {
      "allowArrowFunctions": false,
      "allowBind": false
    }]
  }
}
```

### 2. 性能检查脚本
```bash
# 在 package.json 中添加
"scripts": {
  "perf:check": "grep -r 'onClick={() =>' src/components && echo '⚠️  发现内联函数定义!'",
  "perf:analyze": "ANALYZE=true pnpm build"
}
```

## 项目特定规范

### 你的项目已经做得好的地方 ✅
1. ✅ `src/app/page.tsx` - 大量使用 useCallback
2. ✅ `BrewingTimer` 和 `BrewingHistory` - 使用 dynamic 导入
3. ✅ `StageItem` - 使用 React.memo
4. ✅ 全局缓存机制 - globalCache 模式

### 需要重点关注的文件 ⚠️
1. ⚠️ `src/app/page.tsx` (3427行) - **文件过大,需拆分**
2. ⚠️ `src/components/notes/Form/BrewingNoteForm.tsx` - 检查 useEffect 数量
3. ⚠️ `src/components/layout/TabContent.tsx` - 检查是否需要 memo

### AI 生成新组件时的模板

```tsx
'use client';

import React, { useState, useCallback, useMemo } from 'react';

interface Props {
  // 定义 props 类型
}

const ComponentName: React.FC<Props> = ({ prop1, prop2 }) => {
  // 1. 状态声明
  const [state, setState] = useState(initialValue);

  // 2. 派生数据 (useMemo)
  const derivedData = useMemo(() => {
    // 复杂计算
    return computed;
  }, [dependencies]);

  // 3. 事件处理 (useCallback)
  const handleEvent = useCallback(() => {
    // 处理逻辑
  }, [dependencies]);

  // 4. 副作用 (useEffect)
  useEffect(() => {
    // 副作用逻辑
    return () => {
      // 清理函数
    };
  }, [dependencies]);

  // 5. 渲染
  return <div>{/* JSX */}</div>;
};

// 6. 根据需要添加 memo
export default React.memo(ComponentName);
```

## 紧急修复优先级

### 🔴 高优先级 (立即修复)
- 事件监听器泄漏
- 缺失的依赖数组
- 循环中创建的函数

### 🟡 中优先级 (计划修复)
- 大型组件拆分
- 添加 React.memo
- 优化复杂计算

### 🟢 低优先级 (可选优化)
- 添加 useMemo 到简单计算
- 细粒度的状态拆分

## 性能测试

```bash
# 1. 构建分析
ANALYZE=true pnpm build

# 2. 开发环境 - React DevTools Profiler
# 在浏览器中打开 React DevTools > Profiler
# 记录交互并查看渲染次数

# 3. 生产环境测试
pnpm build
pnpm start
# 使用 Lighthouse 测试
```

---

**记住**: 过度优化是万恶之源。优先修复明显的问题,然后用 Profiler 测量实际性能瓶颈。
