# 生豆库存功能实现方案

## 需求概述

在现有咖啡豆库存基础上，添加生豆/熟豆切换功能。生豆可通过烘焙操作（快捷扣除）自动转换为熟豆。

## 数据模型变更

### 1. CoffeeBean 接口扩展 (`src/types/app.d.ts`)

```typescript
export interface CoffeeBean {
  // ... 现有字段
  beanState?: 'green' | 'roasted'; // 生豆/熟豆状态，默认 'roasted' (向后兼容)

  // 生豆专用字段
  purchaseDate?: string; // 购买日期（生豆使用）

  // 生豆来源追溯（仅烘焙产生的熟豆使用）
  sourceGreenBeanId?: string; // 来源生豆ID
}
```

### 2. 类型定义扩展 (`src/components/coffee-bean/List/types.ts`)

```typescript
export type BeanState = 'green' | 'roasted';

export const BEAN_STATE_LABELS: Record<BeanState, string> = {
  green: '生豆',
  roasted: '熟豆',
};
```

## 核心功能实现

### 1. 烘焙管理器 (`src/lib/managers/roastingManager.ts`)

烘焙管理器负责处理生豆到熟豆的转换：

```typescript
export const RoastingManager = {
  // 生成熟豆名称（使用续购逻辑）
  // 如果不存在同名熟豆，直接使用生豆名称
  // 如果已存在，则添加编号 #N
  generateRoastedBeanName(greenBeanName: string, allBeans: CoffeeBean[]): string,

  // 完整烘焙方法
  async roastGreenBean(
    greenBeanId: string,
    roastedAmount: number,
    roastedBeanData?: Partial<CoffeeBean>
  ): Promise<{
    success: boolean;
    greenBean?: CoffeeBean;
    roastedBean?: CoffeeBean;
    note?: BrewingNoteData;
    error?: string;
  }>,

  // 简单烘焙（快捷扣除时自动调用）
  // 自动创建熟豆、设置烘焙日期为当前日期
  async simpleRoast(
    greenBeanId: string,
    roastedAmount: number,
    options?: {
      customRoastedBeanName?: string;
      roastDate?: string;
    }
  ): Promise<...>,

  // 获取生豆派生的所有熟豆
  async getDerivedRoastedBeans(greenBeanId: string): Promise<CoffeeBean[]>,

  // 获取生豆的烘焙记录
  async getRoastingRecords(greenBeanId: string): Promise<BrewingNoteData[]>,
};
```

### 2. 烘焙转熟豆流程

当用户对生豆执行快捷扣除时：

1. 检查生豆剩余量是否充足（如果为0，显示错误提示）
2. 扣除生豆容量
3. 自动创建熟豆记录
   - 名称：使用续购逻辑（首次使用原名，后续加 #N）
   - 烘焙日期：设置为当前日期
   - 容量/剩余量：设置为烘焙量
   - 继承生豆的产地、处理法、品种等信息
   - 设置 `sourceGreenBeanId` 用于追溯
4. 创建烘焙记录笔记（`source: 'roasting'`）
5. 触发数据更新事件

### 3. 笔记类型扩展 (`src/types/app.d.ts`)

```typescript
export interface ChangeRecordDetails {
  // ... 现有字段
  roastingRecord?: {
    greenBeanId: string; // 生豆ID
    greenBeanName: string; // 生豆名称
    roastedAmount: number; // 烘焙的重量(g)
    roastedBeanId?: string; // 烘焙后的熟豆ID
    roastedBeanName?: string; // 烘焙后的熟豆名称
  };
}

export interface BrewingNoteData {
  // ... 现有字段
  source?: 'quick-decrement' | 'capacity-adjustment' | 'roasting';
}
```

## UI 交互变更

### 1. 表单调整 (`src/components/coffee-bean/Form/components/BasicInfo.tsx`)

- 生豆表单：显示「购买日期」，绑定 `purchaseDate` 字段
- 熟豆表单：显示「烘焙日期」，绑定 `roastDate` 字段
- 「在途」状态按钮仅对熟豆显示

### 2. 详情页调整 (`src/components/coffee-bean/Detail/BeanDetailModal.tsx`)

**日期显示**：

- 生豆：显示购买日期
- 熟豆：显示烘焙日期/在途状态

**记录标签**：

- 生豆：显示「烘焙记录」Tab + 「变动记录」Tab
- 熟豆：显示「冲煮记录」Tab + 「变动记录」Tab

**烘焙记录卡片**：

- 烘焙量标签（琥珀色背景）
- 显示转换后的熟豆名称
- 日期

### 3. 错误提示

当生豆剩余量为0时尝试烘焙：

- 显示 Toast 提示：「烘焙失败: 生豆已用完，无法继续烘焙」

## 可追溯性设计

### 正向追溯（生豆 → 熟豆）

1. 通过烘焙记录的 `roastedBeanId` 找到对应熟豆
2. 或通过 `RoastingManager.getDerivedRoastedBeans(greenBeanId)` 查询

### 反向追溯（熟豆 → 生豆）

通过熟豆的 `sourceGreenBeanId` 字段直接查找来源生豆

## 向后兼容策略

1. 所有现有咖啡豆数据默认为 `beanState: 'roasted'`
2. 不设置 `beanState` 的豆子视为熟豆
3. `purchaseDate` 和 `sourceGreenBeanId` 为可选字段，不影响现有数据
4. 现有功能完全不受影响

## 实现文件清单

### 已修改的文件

1. `src/types/app.d.ts` - 添加 `purchaseDate`、`sourceGreenBeanId` 字段
2. `src/lib/managers/roastingManager.ts` - 完整实现烘焙转熟豆逻辑
3. `src/components/coffee-bean/Form/components/BasicInfo.tsx` - 根据豆子状态显示购买/烘焙日期
4. `src/components/coffee-bean/Form/components/Complete.tsx` - 预览页适配
5. `src/components/coffee-bean/Detail/BeanDetailModal.tsx` - 生豆显示烘焙记录Tab
6. `src/components/coffee-bean/List/components/InventoryView.tsx` - 添加错误提示

### 之前已实现的文件

1. `src/components/coffee-bean/List/types.ts` - 类型定义和标签
2. `src/components/coffee-bean/List/index.tsx` - 状态管理和筛选
3. `src/components/coffee-bean/List/globalCache.ts` - 缓存支持
4. `src/components/coffee-bean/List/components/ViewSwitcher.tsx` - UI 切换实现

- 标签切换动画和布局

### 豆子类型筛选参考

- `src/components/coffee-bean/List/components/ViewSwitcher.tsx:768-893`
- 意式豆/手冲豆/全能豆切换逻辑

### 容量管理参考

- `src/lib/managers/coffeeBeanManager.ts:294-428`
- updateBeanRemaining / increaseBeanRemaining

## 实现优先级

1. P0: 数据模型和类型定义
2. P0: UI 切换功能
3. P1: 烘焙转换功能
4. P1: 笔记记录功能
5. P2: 统计优化
