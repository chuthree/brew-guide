# 磨豆机系统设计文档

## 概述

在研磨度输入框聚焦时，显示一个简单的下拉选择列表，用户可以快速选择已配置的磨豆机刻度或手动输入。

## 数据结构

### 磨豆机

```typescript
// 使用 Zustand store 管理，持久化到 settings.grinders
interface Grinder {
  id: string;
  name: string;
  currentGrindSize?: string; // 当前刻度
}
```

### 研磨度值

直接存储为字符串，不区分来源：

```typescript
grindSize: string; // 例如: "中细" 或 "C40 24"
```

## 状态管理

使用 Zustand 实现跨组件实时同步：

```typescript
// src/lib/stores/grinderStore.ts
interface GrinderState {
  grinders: Grinder[];
  initialized: boolean;
  setGrinders: (grinders: Grinder[]) => void;
  addGrinder: (grinder: Grinder) => void;
  updateGrinder: (id: string, updates: Partial<Grinder>) => void;
  deleteGrinder: (id: string) => void;
  updateGrinderScaleByName: (name: string, scale: string) => void;
  initialize: () => Promise<void>;
  persist: () => Promise<void>;
}
```

### 使用方式

```typescript
import { useGrinderStore } from '@/lib/stores/grinderStore';

// 在组件中使用
const { grinders, initialize, updateGrinder } = useGrinderStore();

// 初始化
useEffect(() => {
  if (!initialized) {
    initialize();
  }
}, [initialized, initialize]);
```

## 下拉组件设计

### 组件名称

`GrindSizeInput` ✅ 已实现

### Props

```typescript
interface GrindSizeInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
}
```

### 交互逻辑

1. **默认状态**: 显示输入框，值为当前研磨度
2. **聚焦输入框**: 显示下拉列表
3. **下拉列表内容**:
   - 磨豆机选项: `{磨豆机名} {刻度}` （用空格分隔）
   - 还原选项（如有修改）: `还原: {初始值}`
4. **选择选项**: 填充到输入框，关闭下拉
5. **直接输入**: 正常输入，下拉保持显示但不阻断
6. **失焦/点击外部**: 关闭下拉

### 自动还原功能

组件会自动记录初始值，当用户修改后：

- 下拉列表会显示"还原: {初始值}"选项
- 点击可快速恢复到初始值
- 无需外部传入任何预设值，自动适配所有使用场景

### 显示格式

```
输入框: [C40 25          ]  ← 用户修改后的值
         ↓ 下拉列表
        ┌─────────────────┐
        │ C40 24          │  ← 磨豆机当前刻度（与输入值不同则显示）
        │ 幻刺Pro 32      │  ← 其他磨豆机
        │ 还原: 中细       │  ← 初始值（修改后显示）
        └─────────────────┘
```

## 使用位置

| 文件                  | 说明                  | 状态      |
| --------------------- | --------------------- | --------- |
| `ParamsStep.tsx`      | 方案编辑 - 研磨度     | ✅ 已完成 |
| `BrewingNoteForm.tsx` | 笔记编辑 - 研磨度     | ✅ 已完成 |
| `MethodSelector.tsx`  | 笔记方案选择 - 研磨度 | ✅ 已完成 |
| `NavigationBar.tsx`   | 冲煮导航栏 - 参数编辑 | ✅ 已完成 |

## 磨豆机刻度同步

### 同步逻辑

当保存笔记或方案时，如果研磨度值匹配 `{磨豆机名} {刻度}` 格式：

1. 解析出磨豆机名称和刻度
2. 在 store 中查找对应磨豆机
3. 更新该磨豆机的 currentGrindSize
4. 自动持久化到 storage

### 同步工具

位置: `src/lib/stores/grinderStore.ts`

```typescript
// 解析研磨度字符串，提取磨豆机名和刻度
parseGrinderFromGrindSize(
  grindSize: string,
  grinderNames: string[]
): { grinderName: string; scale: string } | null

// 同步磨豆机刻度（自动解析和更新）
syncGrinderScale(grindSize: string): Promise<boolean>
```

### 同步时机

- ✅ 保存冲煮笔记时 (`BrewingNoteForm.handleSubmit`)
- ✅ 保存自定义方案时 (`CustomMethodForm.handleSubmit`)

## 文件结构

```
src/
├── lib/
│   ├── stores/
│   │   └── grinderStore.ts      # Zustand store（核心）
│   └── grinder/
│       └── index.ts             # 模块导出（便捷导入）
└── components/
    ├── ui/
    │   └── GrindSizeInput.tsx   # 研磨度输入组件
    └── settings/
        └── GrinderSettings.tsx  # 磨豆机设置页面
```

## 注意事项

- 下拉只做选择，不做添加/编辑磨豆机
- 磨豆机管理在设置页面完成
- 保持输入框的完整编辑能力
- 使用 Zustand store 实现跨组件实时同步
- 研磨度格式使用空格分隔（如 "C40 24"），不使用 `·` 符号
