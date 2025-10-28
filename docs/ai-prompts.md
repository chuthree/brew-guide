# AI 编码提示词模板

## 通用提示词（粘贴到每次对话开始）

```
你是一个专业的 React/Next.js 开发者。在编写代码时，请严格遵守以下性能优化规范：

1. **函数优化**
   - 所有传递给子组件的函数必须使用 useCallback
   - 所有复杂计算（循环、过滤、映射）必须使用 useMemo
   - 简单值计算（字符串拼接、加法）直接计算，不需要缓存

2. **组件优化**
   - 纯展示组件使用 React.memo 包装
   - 大型组件（>500行）使用 next/dynamic 动态导入
   - 列表渲染必须有唯一的 key

3. **状态管理**
   - 相关状态合并为对象，而不是多个独立 useState
   - >10个状态时考虑使用 useReducer
   - 避免派生状态，优先使用 useMemo

4. **事件监听**
   - useEffect 中的事件监听器必须有清理函数
   - 事件处理函数使用 useCallback 确保引用稳定

5. **禁止事项**
   - ❌ 不要在 .map() 中创建内联函数：onClick={() => ...}
   - ❌ 不要忘记依赖数组
   - ❌ 不要在生产代码中使用 console.log

请在每次生成代码后，主动检查是否遵守了以上规范。
```

## 针对新功能的提示词

```
我需要实现一个 [功能描述]。

要求：
1. 性能优先：遵守 docs/performance-guidelines.md 中的规范
2. 组件拆分：如果超过 300 行，请拆分为多个子组件
3. 类型安全：所有 props 和 state 都需要 TypeScript 类型定义
4. 内存安全：确保所有 useEffect 都有清理函数

技术栈：
- Next.js 16.0.0 (App Router)
- React 19.2.0
- TypeScript 5.8.3
- 静态导出模式 (output: 'export')

项目特点：
- 使用 Capacitor 打包为移动应用
- 大量使用自定义 hooks
- 全局事件系统（window.addEventListener）

请生成代码。
```

## 代码审查提示词

```
请审查以下代码的性能问题，重点关注：

1. 是否有内存泄漏（未清理的监听器、定时器）
2. 是否有不必要的重渲染
3. 是否正确使用了 useCallback/useMemo
4. 依赖数组是否完整

代码：
[粘贴代码]

请指出问题并提供优化后的版本。
```

## 重构提示词

```
这个组件有 [具体问题，如：过多 useState、性能差、代码重复]。

请帮我重构，要求：
1. 保持功能完全一致
2. 优化性能（使用 useCallback、useMemo、React.memo）
3. 拆分大组件为小组件
4. 改进状态管理（考虑 useReducer 或合并状态）
5. 添加必要的注释

原代码：
[粘贴代码]
```

## 调试性能问题提示词

```
我的组件性能很差，表现为 [具体症状：卡顿、渲染慢、内存增长]。

请帮我分析并修复：
1. 使用 React DevTools Profiler 分析渲染次数
2. 检查是否有不必要的重渲染
3. 检查是否有内存泄漏
4. 优化复杂计算和列表渲染

组件代码：
[粘贴代码]

相关依赖组件：
[粘贴相关组件代码]
```

## 使用建议

### 对于 ChatGPT/Claude
1. 每次对话开始时粘贴"通用提示词"
2. 定期提醒 AI 检查性能规范
3. 每生成 200 行代码就要求 AI 自查一次

### 对于 GitHub Copilot
1. 在文件顶部添加性能注释：
```typescript
/**
 * 性能要求：
 * - 使用 useCallback 包装所有回调函数
 * - 使用 useMemo 缓存复杂计算
 * - 使用 React.memo 包装组件
 */
```

2. 使用内联注释引导生成：
```typescript
// TODO: 使用 useCallback 优化
const handleClick = // Copilot 会自动建议 useCallback
```

### 对于 Cursor/Windsurf
1. 在 `.cursorrules` 或项目配置中添加规则
2. 引用 `docs/performance-guidelines.md`

---

**记住**: AI 不会自动遵守规范，需要你在每次对话中明确要求。把这些提示词保存为代码片段，方便快速使用。
