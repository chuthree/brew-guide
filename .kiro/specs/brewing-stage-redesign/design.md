# Design Document: Brewing Stage Data Model Redesign

## Overview

本设计文档描述了冲煮步骤数据模型的重新设计方案。核心目标是将复杂的累计时间/注水时间模型简化为更直观的阶段用时/阶段注水量模型，并将"等待"作为独立的注水方式类型。

### 设计目标

1. **简化数据模型**: 使用 `duration`（阶段用时）替代 `time`（累计时间）+ `pourTime`（注水时间）
2. **提升用户体验**: 用户直接输入每个阶段的用时和注水量，无需计算
3. **等待步骤独立化**: 将等待作为独立的 `pourType`，而非通过 `pourTime=0` 隐式表达
4. **向后兼容**: 支持旧数据迁移和旧格式导入

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Application Layer                         │
├─────────────────────────────────────────────────────────────────┤
│  StagesStep.tsx          │  BrewingTimer.tsx                    │
│  (Stage Editor UI)       │  (Timer Display)                     │
├─────────────────────────────────────────────────────────────────┤
│                        Service Layer                             │
├─────────────────────────────────────────────────────────────────┤
│  stageMigration.ts       │  stageUtils.ts                       │
│  (Legacy → New)          │  (Calculations)                      │
├─────────────────────────────────────────────────────────────────┤
│  jsonUtils.ts                                                    │
│  (Import/Export with backward compatibility)                     │
├─────────────────────────────────────────────────────────────────┤
│                        Data Layer                                │
├─────────────────────────────────────────────────────────────────┤
│  config.ts               │  types.ts                            │
│  (Stage interface)       │  (Type definitions)                  │
└─────────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### 1. 新的 Stage 接口定义

```typescript
// src/lib/core/config.ts

export interface Stage {
  // 核心字段
  pourType: PourType; // 注水方式（必填）
  label: string; // 步骤标题
  water?: string; // 阶段注水量（克），等待步骤可选
  duration?: number; // 阶段用时（秒），bypass/beverage 可选
  detail: string; // 备注说明

  // 特殊字段
  valveStatus?: 'open' | 'closed'; // 阀门状态（聪明杯等）

  // 兼容字段（仅用于迁移过渡期）
  _legacyTime?: number; // 旧版累计时间（迁移后删除）
  _legacyPourTime?: number; // 旧版注水时间（迁移后删除）
}

export type PourType =
  | 'center' // 中心注水
  | 'circle' // 绕圈注水
  | 'ice' // 添加冰块
  | 'bypass' // Bypass
  | 'wait' // 等待（新增）
  | 'other' // 其他
  | 'extraction' // 意式萃取
  | 'beverage' // 意式饮料
  | string; // 自定义注水方式 ID
```

### 2. 旧版 Stage 接口（用于迁移）

```typescript
// src/lib/brewing/stageMigration.ts

export interface LegacyStage {
  time: number; // 累计时间（秒）
  pourTime?: number; // 注水时间（秒）
  label: string;
  water: string; // 累计水量
  detail: string;
  pourType?: string;
  valveStatus?: 'open' | 'closed';
}
```

### 3. 迁移服务接口

```typescript
// src/lib/brewing/stageMigration.ts

export interface MigrationService {
  /**
   * 检测是否为旧版数据格式
   */
  isLegacyFormat(stages: unknown[]): boolean;

  /**
   * 将旧版 stages 转换为新版格式
   */
  migrateStages(legacyStages: LegacyStage[]): Stage[];

  /**
   * 将新版 stages 转换为旧版格式（用于导出兼容）
   */
  toLegacyFormat(stages: Stage[]): LegacyStage[];
}
```

### 4. Stage 工具函数接口

```typescript
// src/lib/brewing/stageUtils.ts

export interface StageUtils {
  /**
   * 计算累计时间（用于显示）
   */
  calculateCumulativeTime(stages: Stage[], upToIndex: number): number;

  /**
   * 计算累计水量（用于显示）
   */
  calculateCumulativeWater(stages: Stage[], upToIndex: number): number;

  /**
   * 计算总时长
   */
  calculateTotalDuration(stages: Stage[]): number;

  /**
   * 计算总水量
   */
  calculateTotalWater(stages: Stage[]): number;

  /**
   * 获取阶段开始时间
   */
  getStageStartTime(stages: Stage[], index: number): number;

  /**
   * 获取阶段结束时间
   */
  getStageEndTime(stages: Stage[], index: number): number;
}
```

## Data Models

### 新旧数据模型对比

#### 旧版模型示例

```json
{
  "stages": [
    {
      "time": 25,
      "pourTime": 10,
      "label": "焖蒸",
      "water": "30g",
      "detail": "中心向外绕圈",
      "pourType": "circle"
    },
    {
      "time": 120,
      "pourTime": 65,
      "label": "绕圈注水",
      "water": "225g",
      "detail": "均匀萃取",
      "pourType": "circle"
    }
  ]
}
```

**问题分析**:

- 第一阶段：累计时间25秒，注水10秒 → 等待15秒（需要用户计算）
- 第二阶段：累计时间120秒，注水65秒 → 阶段时长95秒，等待30秒（更复杂的计算）
- 水量是累计的：30g → 225g，第二阶段实际注水195g（需要计算）

#### 新版模型示例

```json
{
  "stages": [
    {
      "pourType": "circle",
      "label": "焖蒸",
      "water": "30",
      "duration": 10,
      "detail": "中心向外绕圈"
    },
    {
      "pourType": "wait",
      "label": "等待",
      "duration": 15,
      "detail": ""
    },
    {
      "pourType": "circle",
      "label": "绕圈注水",
      "water": "195",
      "duration": 65,
      "detail": "均匀萃取"
    },
    {
      "pourType": "wait",
      "label": "等待",
      "duration": 30,
      "detail": ""
    }
  ]
}
```

**优势**:

- 每个阶段的用时和注水量一目了然
- 等待步骤显式存在，可独立编辑
- 无需任何计算

### 迁移算法

```typescript
function migrateStages(legacyStages: LegacyStage[]): Stage[] {
  const newStages: Stage[] = [];
  let prevCumulativeTime = 0;
  let prevCumulativeWater = 0;

  for (const legacy of legacyStages) {
    const stageDuration = legacy.time - prevCumulativeTime;
    const stageWater = parseWater(legacy.water) - prevCumulativeWater;
    const pourTime = legacy.pourTime ?? stageDuration;
    const waitTime = stageDuration - pourTime;

    // 添加注水阶段
    if (pourTime > 0) {
      newStages.push({
        pourType: legacy.pourType || 'circle',
        label: legacy.label,
        water: String(stageWater),
        duration: pourTime,
        detail: legacy.detail,
        valveStatus: legacy.valveStatus,
      });
    }

    // 添加等待阶段（如果有）
    if (waitTime > 0) {
      newStages.push({
        pourType: 'wait',
        label: '等待',
        duration: waitTime,
        detail: '',
      });
    }

    prevCumulativeTime = legacy.time;
    prevCumulativeWater = parseWater(legacy.water);
  }

  return newStages;
}
```

### 字段显示规则

| pourType                | label | water | duration | detail |
| ----------------------- | ----- | ----- | -------- | ------ |
| wait                    | ❌    | ❌    | ✅       | ✅     |
| center/circle/ice/other | ✅    | ✅    | ✅       | ✅     |
| bypass                  | ✅    | ✅    | ❌       | ✅     |
| extraction              | ✅    | ✅    | ✅       | ✅     |
| beverage                | ✅    | ✅    | ❌       | ✅     |

### 默认初始化值

#### 手冲器具（V60, Kalita, Origami 等）

```typescript
const defaultPourOverStages: Stage[] = [
  {
    pourType: 'circle',
    label: '预浸泡',
    water: '30',
    duration: 10,
    detail: '',
  },
  {
    pourType: 'wait',
    label: '等待',
    duration: 20,
    detail: '',
  },
];
```

#### 意式咖啡机

```typescript
const defaultEspressoStages: Stage[] = [
  {
    pourType: 'extraction',
    label: '萃取浓缩',
    water: '36',
    duration: 25,
    detail: '',
  },
];
```

## Correctness Properties

_A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees._

### Property 1: New Stage Model Structure

_For any_ valid Stage object in the new format, it SHALL contain pourType (string), label (string), detail (string), and optionally water (string) and duration (number), but SHALL NOT contain time or pourTime fields.

**Validates: Requirements 1.1, 1.4, 1.5**

### Property 2: Field Visibility by PourType

_For any_ pourType value, the Stage_Editor SHALL display exactly the fields specified in the field display rules table: wait shows only duration/detail; bypass/beverage show no duration; all others show all fields.

**Validates: Requirements 2.2, 2.3, 2.4, 3.1, 3.2, 3.3, 3.4, 3.5**

### Property 3: Migration Cumulative to Per-Stage Conversion

_For any_ sequence of legacy stages with cumulative time values [t1, t2, ..., tn], the migration SHALL produce stages with durations [t1, t2-t1, ..., tn-t(n-1)], and similarly for water values.

**Validates: Requirements 4.1, 4.2**

### Property 4: Migration Wait Stage Extraction

_For any_ legacy stage where (time - previousTime) > pourTime, the migration SHALL create a separate wait stage with duration equal to (stageDuration - pourTime).

**Validates: Requirements 4.3**

### Property 5: Migration Property Preservation

_For any_ legacy stage, the migration SHALL preserve label, detail, pourType, and valveStatus values in the corresponding new stage(s).

**Validates: Requirements 4.4**

### Property 6: Import Legacy Format Compatibility

_For any_ valid legacy format input (JSON or text), the Import_Export_Service SHALL successfully parse it and produce valid new format stages.

**Validates: Requirements 5.1, 5.3, 5.4, 5.5**

### Property 7: Export New Format Structure

_For any_ exported method, the output SHALL contain stages with duration and per-stage water values, not cumulative values.

**Validates: Requirements 5.2**

### Property 8: Timer Cumulative Calculations

_For any_ sequence of stages with durations [d1, d2, ..., dn], the Timer SHALL calculate cumulative time at stage i as sum(d1..di), and similarly for water.

**Validates: Requirements 7.1, 7.2, 7.4**

### Property 9: Validation Constraints

_For any_ stage input, duration SHALL be validated as non-negative integer, and water SHALL be validated as non-negative integer for non-wait stages. Duration of 0 SHALL be allowed for bypass and beverage stages.

**Validates: Requirements 8.1, 8.2, 8.4**

## Error Handling

### 迁移错误处理

1. **缺失时间值**: 如果 legacy stage 缺少 time 字段，使用前一阶段时间 + 30秒作为默认值
2. **无效水量格式**: 如果水量无法解析，保留原始字符串并记录警告
3. **负数时长**: 如果计算出负数时长（数据异常），设置为 0 并记录警告

### 导入错误处理

1. **JSON 解析失败**: 尝试清理 JSON 字符串后重试，失败则返回 null
2. **格式不匹配**: 自动检测格式（新版/旧版/文本），选择合适的解析器
3. **必填字段缺失**: 使用默认值填充，确保不会产生无效数据

### 表单验证错误

1. **duration 为负数**: 显示错误提示，阻止保存
2. **water 为空（非等待步骤）**: 显示警告，允许保存但提示用户
3. **pourType 未选择**: 显示错误提示，阻止保存

## Testing Strategy

### 单元测试

1. **stageMigration.ts**
   - 测试单阶段迁移
   - 测试多阶段迁移
   - 测试等待阶段提取
   - 测试边界情况（空数组、单元素等）

2. **stageUtils.ts**
   - 测试累计时间计算
   - 测试累计水量计算
   - 测试总时长/总水量计算

3. **jsonUtils.ts**
   - 测试旧版 JSON 导入
   - 测试旧版文本导入
   - 测试新版导出格式

### 属性测试

使用 fast-check 进行属性测试，每个属性测试至少运行 100 次迭代。

1. **Property 1**: 生成随机 Stage 对象，验证结构符合新模型
2. **Property 3**: 生成随机旧版 stages，验证迁移后时长计算正确
3. **Property 4**: 生成带有等待时间的旧版 stages，验证等待阶段正确提取
4. **Property 5**: 生成随机旧版 stages，验证属性保留
5. **Property 6**: 生成随机旧版格式输入，验证导入成功
6. **Property 8**: 生成随机 stages，验证累计计算正确
7. **Property 9**: 生成随机输入，验证验证规则正确

### 集成测试

1. 完整的创建方案流程测试
2. 导入旧版分享数据测试
3. 计时器与新数据格式集成测试
