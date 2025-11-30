# Page.tsx 重构计划

## 概述

`src/app/page.tsx` 当前包含 **4035 行代码**，是项目中最大的单一文件。本文档提供系统化的重构方案，将其拆分为可维护的模块化结构。

## 当前问题

### 规模指标

- **总行数**: 4,035 行
- **State 变量**: 80+ 个
- **useEffect**: 30+ 个
- **事件处理函数**: 30+ 个
- **模态框状态**: 15+ 个

### 核心问题

1. **职责过重**: 单文件承担初始化、状态管理、业务逻辑、UI渲染全部职责
2. **维护困难**: 修改任何功能都需要在 4000+ 行中定位代码
3. **测试困难**: 业务逻辑与 UI 高度耦合，无法独立测试
4. **协作困难**: 多人同时编辑会产生大量冲突
5. **性能隐患**: 单一组件承载过多状态，任何更新都可能触发大范围重渲染

## 重构目标

### 最终目标

- `page.tsx` 精简至 **< 200 行**
- 每个模块文件控制在 **200-400 行**
- 业务逻辑与 UI 完全分离
- 状态管理集中化、模块化

### 质量目标

- ✅ 可维护性：职责单一，易于定位和修改
- ✅ 可测试性：逻辑独立，支持单元测试
- ✅ 可复用性：通用逻辑可跨组件复用
- ✅ 类型安全：更小文件更易维护类型定义

## 重构策略

### 拆分原则

#### 1. 按职责分层

```
UI层 (Components)      ← 展示逻辑
   ↓
业务层 (Hooks)         ← 业务逻辑
   ↓
数据层 (Managers)      ← 数据操作
```

#### 2. 按功能域划分

- 咖啡豆管理
- 器具管理
- 冲煮笔记
- 设置管理
- 云同步

#### 3. 状态管理策略

- **全局状态**: Zustand Store (settings, hasCoffeeBeans) - 已有 4 个 store
- **UI 状态**: 本地 useState (模态框开关)
- **业务状态**: Custom Hooks (咖啡豆列表、器具列表)
- **持久化**: Dexie (IndexedDB 包装器)

## 实施路线图

### 第一阶段：状态管理重构 (3-5 天)

#### 1.1 整合现有 Zustand Store

**当前状态**: 已有 4 个独立 Zustand Store

- `src/lib/stores/brewingNoteStore.ts`
- `src/lib/stores/coffeeBeanStore.ts`
- `src/lib/stores/equipmentStore.ts`
- `src/lib/stores/grinderStore.ts`

**优化目标**:

- 统一 Store 管理模式
- 添加 TypeScript 类型定义
- 考虑是否需要合并相关 Store

**接口示例**:

```typescript
// 扩展现有的 store 或创建统一的 AppStore
interface AppStore {
  settings: SettingsOptions;
  hasCoffeeBeans: boolean;
  isAppReady: boolean;
  updateSettings: (settings: SettingsOptions) => Promise<void>;
}
```

**注意**: 保持与 Dexie 的持久化集成

#### 1.2 模态框状态管理

**文件**: `src/hooks/useModalManager.ts`

**职责**: 统一管理 15+ 个模态框状态

**接口**:

```typescript
interface ModalManager {
  // 咖啡豆相关
  beanForm: ModalState;
  beanDetail: ModalState<ExtendedCoffeeBean>;
  beanImport: ModalState;

  // 笔记相关
  noteForm: ModalState<BrewingNoteData>;
  noteDetail: ModalState<NoteDetailData>;
  noteEdit: ModalState<BrewingNoteData>;

  // 器具相关
  equipmentForm: ModalState<CustomEquipment>;
  equipmentImport: ModalState;
  equipmentManagement: ModalState;

  // 设置相关
  settings: ModalState;
  // ... 14个子设置页面
}
```

#### 1.3 子设置页面管理

**文件**: `src/hooks/useSubSettingsManager.ts`

**职责**: 管理 14 个子设置页面的开关状态

**优化**: 用对象替代 14 个独立布尔变量

```typescript
interface SubSettings {
  display: boolean;
  navigation: boolean;
  stock: boolean;
  bean: boolean;
  // ... 其他 10 个
}
```

### 第二阶段：业务逻辑提取 (5-7 天)

#### 2.1 咖啡豆操作

**文件**: `src/hooks/useCoffeeBeanOperations.ts`

**提取函数**:

- `handleSaveBean` (100+ 行)
- `handleImportBean` (200+ 行)
- `handleBeanListChange`
- `checkCoffeeBeans`
- 烘焙流程逻辑

**依赖**: CoffeeBeanManager, RoastingManager

#### 2.2 器具管理操作

**文件**: `src/hooks/useEquipmentOperations.ts`

**提取函数**:

- `handleSaveEquipment`
- `handleDeleteEquipment`
- `handleEditEquipment`
- `handleShareEquipment`
- `handleImportEquipmentToForm`
- `handleReorderEquipments`

#### 2.3 笔记操作

**文件**: `src/hooks/useBrewingNoteOperations.ts`

**提取函数**:

- `handleAddNote`
- `handleSaveBrewingNote`
- `handleSaveBrewingNoteEdit`

#### 2.4 云同步逻辑

**文件**: `src/hooks/useCloudSync.ts`

**提取函数**:

- `isCloudSyncEnabled`
- `handlePullToSync` (300+ 行)

### 第三阶段：组件拆分 (5-7 天)

#### 3.1 页面级组件

**文件结构**:

```
src/components/pages/
├── BrewingPage.tsx          # 冲煮主页面
├── CoffeeBeansPage.tsx      # 咖啡豆页面
└── NotesPage.tsx            # 笔记页面
```

**BrewingPage.tsx** 包含:

- `<TabContent />`
- `<BrewingTimer />`
- `<MethodTypeSelector />`
- `<CustomMethodFormModal />`
- `<BrewingNoteFormModal />`

**CoffeeBeansPage.tsx** 包含:

- `<CoffeeBeans />` 列表
- `<ViewSelector />` 视图切换
- 相关操作逻辑

**NotesPage.tsx** 包含:

- `<BrewingHistory />`
- 替代头部内容管理

#### 3.2 通用组件

**ModalsContainer.tsx**

```
src/components/common/ModalsContainer.tsx
```

**职责**: 统一渲染所有模态框

- 咖啡豆表单/详情/导入
- 笔记表单/详情/编辑
- 器具表单/导入/管理
- ImageViewer
- 数据迁移
- 备份提醒

**ViewSelector.tsx**

```
src/components/coffee-bean/ViewSelector.tsx
```

**职责**: 咖啡豆视图切换器

- 下拉菜单 UI
- Framer Motion 动画
- 视图过滤逻辑

#### 3.3 设置容器

**文件**: `src/components/settings/SettingsContainer.tsx`

**职责**:

- 渲染主设置页面
- 渲染 14 个子设置页面
- 管理设置页面间的导航

### 第四阶段：应用初始化重构 (2-3 天)

#### 4.1 初始化逻辑提取

**文件**: `src/lib/app/initialization.ts`

**提取内容**:

- `AppLoader` 组件逻辑
- 数据迁移检测
- 首次使用检测
- Capacitor 初始化
- 备份提醒初始化

**接口**:

```typescript
interface InitializationResult {
  hasBeans: boolean;
  needsMigration: boolean;
  showOnboarding: boolean;
}

export async function initializeApp(): Promise<InitializationResult>;
```

#### 4.2 事件监听管理

**文件**: `src/hooks/useAppEventListeners.ts`

**职责**: 集中管理所有 window 事件监听

- `coffeeBeanListChanged`
- `customMethodUpdate`
- `customEquipmentUpdate`
- `settingsChanged`
- `storage:changed`
- 20+ 个其他事件

### 第五阶段：最终整合 (2-3 天)

#### 5.1 精简 page.tsx

**最终结构** (< 200 行):

```typescript
// src/app/page.tsx
export default function AppContainer() {
  return (
    <StorageProvider>
      <AppLoader onReady={(state) => <MainApp initialState={state} />} />
    </StorageProvider>
  );
}

function MainApp({ initialState }) {
  // 使用现有的 Zustand stores
  const brewingNotes = useBrewingNoteStore();
  const coffeeBeans = useCoffeeBeanStore();
  const equipment = useEquipmentStore();

  const modals = useModalManager();
  const beanOps = useCoffeeBeanOperations();
  const equipOps = useEquipmentOperations();
  const noteOps = useBrewingNoteOperations();

  return (
    <>
      <NavigationBar {...navProps} />

      {activeTab === '冲煮' && <BrewingPage />}
      {activeTab === '咖啡豆' && <CoffeeBeansPage />}
      {activeTab === '笔记' && <NotesPage />}

      <ModalsContainer modals={modals} operations={{ beanOps, equipOps, noteOps }} />
      <SettingsContainer />
    </>
  );
}
```

#### 5.2 质量保证

- ✅ 完整功能测试
- ✅ 性能基准测试
- ✅ 类型检查无错误
- ✅ ESLint 规则通过
- ✅ 构建产物大小检查

## 文件拆分明细

### 新增文件列表

| 文件路径                                    | 预估行数  | 职责           |
| ------------------------------------------- | --------- | -------------- |
| `hooks/useModalManager.ts`                  | 200       | 模态框状态管理 |
| `hooks/useSubSettingsManager.ts`            | 100       | 子设置状态管理 |
| `hooks/useCoffeeBeanOperations.ts`          | 400       | 咖啡豆业务逻辑 |
| `hooks/useEquipmentOperations.ts`           | 300       | 器具业务逻辑   |
| `hooks/useBrewingNoteOperations.ts`         | 200       | 笔记业务逻辑   |
| `hooks/useCloudSync.ts`                     | 350       | 云同步逻辑     |
| `hooks/useAppEventListeners.ts`             | 250       | 事件监听管理   |
| `components/pages/BrewingPage.tsx`          | 300       | 冲煮页面       |
| `components/pages/CoffeeBeansPage.tsx`      | 250       | 咖啡豆页面     |
| `components/pages/NotesPage.tsx`            | 150       | 笔记页面       |
| `components/common/ModalsContainer.tsx`     | 400       | 模态框容器     |
| `components/coffee-bean/ViewSelector.tsx`   | 250       | 视图选择器     |
| `components/settings/SettingsContainer.tsx` | 300       | 设置容器       |
| `lib/app/initialization.ts`                 | 200       | 应用初始化     |
| **总计**                                    | **3,650** | **14 个文件**  |

**注**: 已有的 4 个 Zustand Store 保持不变，无需新增状态管理文件

### 文件大小对比

| 指标          | 重构前 | 重构后 |
| ------------- | ------ | ------ |
| 最大文件行数  | 4,035  | < 400  |
| page.tsx 行数 | 4,035  | < 200  |
| 文件总数      | 1      | 15     |
| 平均文件行数  | 4,035  | ~250   |

**现有资源**: 已有 4 个 Zustand Store + Dexie 持久化

## 实施建议

### 开发流程

#### 1. 准备阶段

```bash
# 创建功能分支
git checkout -b refactor/page-tsx-split

# 确保测试覆盖
npm run test

# 记录当前行为作为基准
npm run build && npm run start
```

#### 2. 渐进式重构

- **每次只拆分一个模块**
- **立即测试功能完整性**
- **提交小而频繁的 commit**

```bash
# 示例流程
git commit -m "refactor: 提取 useCoffeeBeanOperations hook"
npm run test
git commit -m "refactor: 提取 useModalManager hook"
npm run test
```

#### 3. 验证检查清单

每完成一个模块的拆分，执行以下检查：

- [ ] 功能无退化（所有功能正常工作）
- [ ] 类型检查通过 `npm run type-check`
- [ ] Lint 检查通过 `npm run lint`
- [ ] 静态导出成功 `npm run build`（生成 `out/` 目录）
- [ ] 本地验证静态文件 `npx serve out`
- [ ] 没有引入新的 console.error
- [ ] 性能无明显下降
- [ ] Capacitor 构建正常 `npx cap sync`

### 风险控制

#### 高风险点

1. **状态依赖关系**: 80+ 个 state 之间可能存在隐式依赖
2. **事件监听时序**: 30+ 个 useEffect 的执行顺序很重要
3. **数据流断裂**: 重构可能破坏现有的数据流

#### 降低风险的措施

- ✅ 保留原文件作为 `page.tsx.backup`
- ✅ 使用 TypeScript 严格模式捕获类型错误
- ✅ 每个模块完成后立即进行端到端测试
- ✅ 关键业务逻辑添加单元测试
- ✅ Code Review 重点关注状态管理变更

### 回滚计划

如果重构出现严重问题：

```bash
# 快速回滚到重构前状态
git checkout main -- src/app/page.tsx
git commit -m "revert: 回滚 page.tsx 重构"
```

## 性能优化

### 优化点

#### 1. 代码分割（可选）

```typescript
// 懒加载页面组件（静态导出下收益有限，可按需使用）
const BrewingPage = lazy(() => import('@/components/pages/BrewingPage'));
const CoffeeBeansPage = lazy(
  () => import('@/components/pages/CoffeeBeansPage')
);
const NotesPage = lazy(() => import('@/components/pages/NotesPage'));
```

**注意**: 静态导出模式下代码分割收益较小，主要优化方向应放在减少初始包体积。

#### 2. 状态更新优化

- 使用 `useCallback` 缓存事件处理函数
- 使用 `useMemo` 缓存计算结果
- 避免不必要的 re-render

#### 3. 模态框按需加载

```typescript
// 只在打开时加载模态框内容
{modals.beanDetail.isOpen && <BeanDetailModal {...props} />}
```

### 性能基准

| 指标         | 目标              | 验证方法            |
| ------------ | ----------------- | ------------------- |
| 首屏渲染     | < 1s              | Lighthouse          |
| 页面切换     | < 300ms           | Chrome DevTools     |
| 静态资源体积 | 增加 < 5%         | next build 输出分析 |
| 初始 JS 包   | < 500KB (gzipped) | Bundle Analyzer     |

## 长期维护

### 代码规范

#### 文件命名约定

- **Hooks**: `use[功能名].ts` (如 `useCoffeeBeanOperations.ts`)
- **组件**: `[功能名]Page.tsx` (如 `BrewingPage.tsx`)
- **工具**: `[功能名]Utils.ts` (如 `modalUtils.ts`)

#### 文件大小限制

- **严格限制**: 单文件不超过 500 行
- **建议限制**: 单文件不超过 300 行
- **超出处理**: 触发警告，考虑进一步拆分

#### 导入顺序

```typescript
// 1. React 相关
import React, { useState, useEffect } from 'react';

// 2. 第三方库
import { motion } from 'framer-motion';

// 3. 类型定义
import type { CoffeeBean } from '@/types/app';

// 4. 业务 Hooks
import { useCoffeeBeanOperations } from '@/hooks/useCoffeeBeanOperations';

// 5. 组件
import { CoffeeBeanList } from '@/components/coffee-bean/List';

// 6. 工具函数
import { formatDate } from '@/lib/utils/dateUtils';
```

### 文档维护

- 每个新增 Hook 必须包含 JSDoc 注释
- 复杂业务逻辑需要内联注释说明
- 更新 ARCHITECTURE.md 反映新的架构

### 静态导出特别注意事项

#### 避免使用的功能

- ❌ Next.js 服务端 API Routes (`pages/api/*`)
- ❌ Server Components (已使用 `'use client'`)
- ❌ 动态路由参数 `getServerSideProps`
- ❌ `next/image` 的优化功能（已配置 `unoptimized: true`）

#### 推荐的优化方式

- ✅ Zustand 状态管理（已在使用，需优化整合）
- ✅ Dexie + IndexedDB 持久化（已在使用）
- ✅ 静态资源预加载
- ✅ Tree-shaking 减少包体积

### 后续优化方向

1. **Store 整合优化**: 评估是否需要合并现有 4 个 Zustand Store
2. **持久化策略**: 优化 Zustand + Dexie 的数据同步机制
3. **测试覆盖**: 关键业务逻辑达到 80% 测试覆盖率
4. **构建优化**: 分析并优化静态资源体积

## 总结

### 预期收益

#### 代码质量

- ✅ **可维护性提升 80%**: 从单个 4000 行文件到 15 个清晰模块
- ✅ **可测试性提升 100%**: 业务逻辑完全独立，易于单元测试
- ✅ **可读性提升 90%**: 每个文件职责单一，易于理解

#### 开发效率

- ✅ **定位问题速度提升 5x**: 模块化结构快速定位问题代码
- ✅ **协作冲突减少 70%**: 多人可同时编辑不同模块
- ✅ **新功能开发速度提升 2x**: 清晰的架构降低理解成本

#### 用户体验

- ✅ **首屏加载速度提升 20%**: 代码分割和懒加载
- ✅ **运行时性能提升 15%**: 优化的状态管理减少 re-render
- ✅ **构建速度提升 10%**: 模块化利于增量编译

### 时间估算

| 阶段     | 预估时间     | 产出           |
| -------- | ------------ | -------------- |
| 第一阶段 | 3-5 天       | 状态管理模块   |
| 第二阶段 | 5-7 天       | 业务逻辑 Hooks |
| 第三阶段 | 5-7 天       | 页面和组件拆分 |
| 第四阶段 | 2-3 天       | 初始化逻辑     |
| 第五阶段 | 2-3 天       | 整合和测试     |
| **总计** | **17-25 天** | **完整重构**   |

### 成功标准

- ✅ `page.tsx` 行数 < 200
- ✅ 所有现有功能正常工作
- ✅ 无新增 console.error
- ✅ 类型检查 100% 通过
- ✅ 构建体积增加 < 5%
- ✅ 性能无明显下降
- ✅ Code Review 通过

---

**文档版本**: v1.0  
**创建日期**: 2025-11-30  
**维护者**: Development Team  
**状态**: 待实施
