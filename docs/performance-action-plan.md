# 性能优化行动计划

> **生成时间**: 2025年10月29日  
> **检测到的问题**: 103个性能改进点

## 🔴 高优先级问题（立即修复）

### 1. src/app/page.tsx - 49个 useState ⚠️⚠️⚠️

**问题**: 主文件过于复杂，有 3427 行和 49 个 useState  
**影响**: 每次状态更新都可能触发大量重渲染

**解决方案**:
```bash
# 第一步：拆分为多个组件
src/app/
  page.tsx (保留路由和布局)
  components/
    AppContainer.tsx
    BrewingFlow.tsx
    SettingsPanel.tsx
    BeanManagement.tsx
```

**具体任务**:
- [ ] 将设置相关状态提取到独立组件
- [ ] 将咖啡豆管理提取到独立组件
- [ ] 将冲煮流程提取到独立组件
- [ ] 使用 useReducer 管理复杂状态

**AI 提示词**:
```
请帮我将 src/app/page.tsx 中的以下状态拆分为独立的 hook：
- 设置相关的 12 个 useState
- 咖啡豆表单相关的 5 个 useState
- 笔记编辑相关的 3 个 useState

要求：
1. 创建 useSettingsState.ts hook
2. 创建 useBeanFormState.ts hook  
3. 创建 useNoteEditState.ts hook
4. 每个 hook 使用 useReducer 或合并的 useState
5. 保持原有功能完全一致
```

### 2. 大文件拆分（16个文件 >1000行）

**优先拆分列表**:
1. ✅ `src/components/brewing/BrewingTimer.tsx` (2007行) - **最高优先级**
2. ⚠️ `src/components/coffee-bean/Print/BeanPrintModal.tsx` (1705行)
3. ⚠️ `src/components/settings/DataSettings.tsx` (1673行)
4. ⚠️ `src/components/layout/TabContent.tsx` (1103行)
5. ⚠️ `src/components/settings/Settings.tsx` (1088行)

**拆分原则**:
- 每个文件不超过 500 行
- 相关逻辑放在同一目录
- 使用 barrel exports (index.ts)

**AI 提示词**:
```
请帮我拆分 src/components/brewing/BrewingTimer.tsx (2007行)。

拆分策略：
1. 提取计时器逻辑到 hooks/useBrewingTimer.ts
2. 提取音频逻辑到 hooks/useAudioControl.ts
3. 提取阶段管理到 components/StageManager.tsx
4. 提取设置面板到 components/TimerSettings.tsx
5. 主组件保留布局和组合逻辑

要求：
- 每个文件 <500 行
- 保持功能完全一致
- 使用 TypeScript 类型定义
- 遵守性能优化规范（useCallback/useMemo）
```

### 3. 77% 的事件处理器未使用 useCallback

**影响**: 子组件不必要的重渲染

**修复策略**:
```typescript
// ❌ 修复前
const handleClick = () => {
  doSomething(data);
};

// ✅ 修复后
const handleClick = useCallback(() => {
  doSomething(data);
}, [data]);
```

**批量修复脚本**:
```bash
# 找出所有未优化的处理器
grep -rn "const handle" src/components | grep -v "useCallback" > handlers-to-fix.txt

# 手动或用 AI 批量修复
```

## 🟡 中优先级问题（本周完成）

### 4. console.log 清理（15处）

**查找所有 console.log**:
```bash
grep -rn "console.log" src
```

**替换策略**:
```typescript
// 开发环境可用的 logger
const logger = {
  log: (...args: unknown[]) => {
    if (process.env.NODE_ENV === 'development') {
      console.log(...args);
    }
  },
  warn: console.warn,
  error: console.error,
};
```

### 5. React key 优化（154处潜在问题）

大部分应该已经有 key，但需要检查是否使用了稳定的 key：

```typescript
// ❌ 不稳定的 key
{items.map((item, index) => <Item key={index} />)}

// ✅ 稳定的 key
{items.map(item => <Item key={item.id} />)}
```

## 🟢 低优先级问题（逐步优化）

### 6. 添加 React.memo

对纯展示组件添加 memo：
```typescript
// 识别纯展示组件的特征
// 1. 只接收 props，不使用内部状态
// 2. 不使用 useEffect
// 3. 渲染结果只依赖 props

const PureComponent = React.memo(({ title, value }) => (
  <div>{title}: {value}</div>
));
```

### 7. 优化复杂计算

使用 useMemo 缓存：
```typescript
const expensiveValue = useMemo(() => {
  // 复杂计算
  return computeExpensiveValue(data);
}, [data]);
```

## 📊 进度跟踪

| 任务 | 优先级 | 状态 | 预计工作量 |
|------|--------|------|------------|
| page.tsx 状态拆分 | 🔴 高 | ⏳ 待开始 | 4-6 小时 |
| BrewingTimer 拆分 | 🔴 高 | ⏳ 待开始 | 3-4 小时 |
| 其他大文件拆分 | 🔴 高 | ⏳ 待开始 | 8-10 小时 |
| useCallback 优化 | 🔴 高 | ⏳ 待开始 | 2-3 小时 |
| console.log 清理 | 🟡 中 | ⏳ 待开始 | 30 分钟 |
| React key 检查 | 🟡 中 | ⏳ 待开始 | 1-2 小时 |
| React.memo 添加 | 🟢 低 | ⏳ 待开始 | 2-3 小时 |

**总计预估**: 20-30 小时

## 🎯 分阶段执行计划

### 第一周: 紧急修复
1. 修复 page.tsx 状态管理
2. 拆分 BrewingTimer.tsx
3. 添加 useCallback 到事件处理器

### 第二周: 代码拆分
1. 拆分其余大文件
2. 清理 console.log
3. 优化 React key

### 第三周: 性能优化
1. 添加 React.memo
2. 优化复杂计算
3. 性能测试和验证

## 🔧 每次 AI 编码时的检查清单

复制这个清单到每次与 AI 的对话中：

```
在编写代码前，请确认：
- [ ] 所有事件处理函数使用 useCallback
- [ ] 复杂计算使用 useMemo
- [ ] 列表渲染使用稳定的 key
- [ ] 纯展示组件使用 React.memo
- [ ] useEffect 有清理函数
- [ ] 依赖数组完整
- [ ] 没有 console.log
- [ ] 单个文件 <500 行
```

## 📈 衡量改进效果

### 构建前
```bash
pnpm perf:check
# 记录问题数量
```

### 构建后
```bash
pnpm perf:check
pnpm perf:analyze
# 对比包大小和问题数量
```

### 运行时性能
1. 使用 React DevTools Profiler
2. 记录关键操作的渲染次数
3. 监控内存使用情况

---

**开始执行**: 建议从 `src/app/page.tsx` 的状态拆分开始，这是最大的性能瓶颈。

**需要帮助时**: 参考 `docs/ai-prompts.md` 中的提示词模板。
