# Design Document: Roaster Field Feature

## Overview

本设计文档描述了为咖啡豆添加独立"烘焙商"字段功能的技术实现方案。该功能允许用户在设置中启用独立的烘焙商字段，替代当前从咖啡豆名称中自动提取烘焙商的方式。

主要变更包括：

1. 扩展 `AppSettings` 类型，添加 `roasterFieldEnabled` 和 `roasterSeparator` 设置项
2. 扩展 `CoffeeBean` 类型，添加可选的 `roaster` 字段
3. 实现数据迁移逻辑，首次启用时自动提取现有咖啡豆的烘焙商信息
4. 修改咖啡豆表单，添加烘焙商输入框（带自动补全）
5. 更新烘焙商提取和显示逻辑，支持新字段和分隔符设置

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Settings Layer                            │
│  ┌─────────────────┐  ┌─────────────────┐                       │
│  │ BeanSettings.tsx│  │ settingsStore.ts│                       │
│  │ (UI Toggle)     │──│ (State + DB)    │                       │
│  └─────────────────┘  └─────────────────┘                       │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        Data Layer                                │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │ db.ts           │  │ app.d.ts        │  │ roasterMigration│  │
│  │ (AppSettings)   │  │ (CoffeeBean)    │  │ (Migration)     │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        UI Layer                                  │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │ BasicInfo.tsx   │  │ BeanListItem.tsx│  │ beanVarietyUtils│  │
│  │ (Form Input)    │  │ (Display)       │  │ (Extraction)    │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### 1. Settings Store 扩展

在 `src/lib/core/db.ts` 的 `AppSettings` 接口中添加：

```typescript
interface AppSettings {
  // ... existing fields ...

  // 烘焙商字段设置
  roasterFieldEnabled?: boolean; // 是否启用独立烘焙商字段，默认 false
  roasterSeparator?: ' ' | '/'; // 烘焙商分隔符，默认空格
  roasterMigrationCompleted?: boolean; // 迁移是否已完成
}
```

### 2. CoffeeBean 类型扩展

在 `src/types/app.d.ts` 的 `CoffeeBean` 接口中添加：

```typescript
interface CoffeeBean {
  // ... existing fields ...

  roaster?: string; // 烘焙商名称（可选）
}
```

### 3. 烘焙商提取工具函数

更新 `src/lib/utils/beanVarietyUtils.ts`：

```typescript
/**
 * 获取烘焙商名称
 * 优先使用 roaster 字段，否则从名称中提取
 */
export function getRoasterName(
  bean: CoffeeBean,
  settings: { roasterFieldEnabled?: boolean; roasterSeparator?: ' ' | '/' }
): string {
  // 如果启用了烘焙商字段且有值，直接返回
  if (settings.roasterFieldEnabled && bean.roaster) {
    return bean.roaster;
  }

  // 否则从名称中提取
  return extractRoasterFromName(bean.name, settings.roasterSeparator);
}

/**
 * 从名称中提取烘焙商
 * @param beanName 咖啡豆名称
 * @param separator 分隔符，默认空格
 */
export function extractRoasterFromName(
  beanName: string,
  separator: ' ' | '/' = ' '
): string {
  if (!beanName || typeof beanName !== 'string') {
    return '未知烘焙商';
  }

  const trimmedName = beanName.trim();
  if (!trimmedName) {
    return '未知烘焙商';
  }

  // 根据分隔符分割
  const parts =
    separator === '/' ? trimmedName.split('/') : trimmedName.split(/\s+/);

  if (parts.length === 1) {
    if (parts[0].length <= 6) {
      return parts[0];
    }
    return '未知烘焙商';
  }

  const firstPart = parts[0];
  const excludeWords = ['豆', 'bean', 'beans', '手冲', '意式', '咖啡豆'];
  if (
    excludeWords.some(word => firstPart.toLowerCase() === word.toLowerCase()) ||
    firstPart.toLowerCase() === 'coffee'
  ) {
    return '未知烘焙商';
  }

  return firstPart;
}

/**
 * 格式化咖啡豆显示名称
 */
export function formatBeanDisplayName(
  bean: CoffeeBean,
  settings: { roasterFieldEnabled?: boolean; roasterSeparator?: ' ' | '/' }
): string {
  if (!settings.roasterFieldEnabled || !bean.roaster) {
    return bean.name;
  }

  const separator = settings.roasterSeparator === '/' ? '/' : ' ';
  return `${bean.roaster}${separator}${bean.name}`;
}
```

### 4. 数据迁移模块

新建 `src/lib/utils/roasterMigration.ts`：

```typescript
import { db } from '@/lib/core/db';
import { extractRoasterFromName } from './beanVarietyUtils';
import { getSettingsStore } from '@/lib/stores/settingsStore';

/**
 * 执行烘焙商字段迁移
 * 从现有咖啡豆名称中提取烘焙商并填充到 roaster 字段
 */
export async function migrateRoasterField(): Promise<void> {
  const settings = getSettingsStore().settings;

  // 检查是否已完成迁移
  if (settings.roasterMigrationCompleted) {
    return;
  }

  const separator = settings.roasterSeparator || ' ';

  // 获取所有咖啡豆
  const beans = await db.coffeeBeans.toArray();

  // 批量更新
  const updates = beans
    .filter(bean => !bean.roaster) // 只处理没有 roaster 字段的
    .map(bean => ({
      ...bean,
      roaster: extractRoasterFromName(bean.name, separator),
    }));

  if (updates.length > 0) {
    await db.coffeeBeans.bulkPut(updates);
  }

  // 标记迁移完成
  await getSettingsStore().updateSettings({
    roasterMigrationCompleted: true,
  });
}
```

### 5. 设置 UI 组件

更新 `src/components/settings/BeanSettings.tsx`，在"添加"部分添加：

```typescript
<SettingSection title="添加">
  {/* 现有设置项 */}
  <SettingRow label="自动填充图片">
    <SettingToggle
      checked={settings.autoFillRecognitionImage || false}
      onChange={checked => handleChange('autoFillRecognitionImage', checked)}
    />
  </SettingRow>

  {/* 新增：烘焙商字段开关 */}
  <SettingRow label="烘焙商">
    <SettingToggle
      checked={settings.roasterFieldEnabled || false}
      onChange={async checked => {
        await handleChange('roasterFieldEnabled', checked);
        // 首次启用时执行迁移
        if (checked && !settings.roasterMigrationCompleted) {
          await migrateRoasterField();
        }
      }}
    />
  </SettingRow>

  {/* 烘焙商分隔符选择器（仅在启用时显示） */}
  {settings.roasterFieldEnabled && (
    <SettingRow label="烘焙商分隔符" isSubSetting>
      <ButtonGroup
        value={settings.roasterSeparator || ' '}
        options={[
          { value: ' ', label: '空格' },
          { value: '/', label: '/' },
        ]}
        onChange={value => handleChange('roasterSeparator', value as ' ' | '/')}
      />
    </SettingRow>
  )}

  <SettingRow label="庄园" isLast>
    <SettingToggle
      checked={settings.showEstateField || false}
      onChange={checked => handleChange('showEstateField', checked)}
    />
  </SettingRow>
</SettingSection>
```

### 6. 咖啡豆表单更新

更新 `src/components/coffee-bean/Form/components/BasicInfo.tsx`：

```typescript
// 在名称输入框前添加烘焙商输入框
{settings.roasterFieldEnabled && (
  <div className="w-full space-y-2">
    <label className="block text-xs font-medium text-neutral-500 dark:text-neutral-400">
      烘焙商
    </label>
    <AutocompleteInput
      value={bean.roaster || ''}
      onChange={onBeanChange('roaster')}
      placeholder="输入烘焙商名称"
      suggestions={roasterSuggestions}
      clearable
      inputMode="text"
    />
  </div>
)}
```

## Data Models

### AppSettings 扩展

| 字段                      | 类型       | 默认值 | 描述                   |
| ------------------------- | ---------- | ------ | ---------------------- |
| roasterFieldEnabled       | boolean    | false  | 是否启用独立烘焙商字段 |
| roasterSeparator          | ' ' \| '/' | ' '    | 烘焙商与名称的分隔符   |
| roasterMigrationCompleted | boolean    | false  | 迁移是否已完成         |

### CoffeeBean 扩展

| 字段    | 类型   | 默认值    | 描述               |
| ------- | ------ | --------- | ------------------ |
| roaster | string | undefined | 烘焙商名称（可选） |

## Correctness Properties

_A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees._

### Property 1: Settings Persistence Round-Trip

_For any_ valid settings object containing `roasterFieldEnabled` and `roasterSeparator` values, storing to IndexedDB and then reading back SHALL produce an equivalent settings object.

**Validates: Requirements 1.2, 1.5**

### Property 2: CoffeeBean Serialization Round-Trip

_For any_ valid CoffeeBean object with a `roaster` field, serializing to JSON and deserializing back SHALL produce an equivalent CoffeeBean object with the roaster field preserved.

**Validates: Requirements 2.2, 2.3**

### Property 3: Migration Correctness

_For any_ set of coffee beans where some have roaster fields and some don't:

- After migration, all beans without existing roaster fields SHALL have roaster fields populated
- Beans with existing roaster fields SHALL remain unchanged
- The populated roaster values SHALL match the result of `extractRoasterFromName` with the configured separator

**Validates: Requirements 3.2, 3.3, 3.4**

### Property 4: Display Name Formatting

_For any_ coffee bean and separator setting:

- If the bean has a roaster field and feature is enabled with space separator, display SHALL be "roaster name"
- If the bean has a roaster field and feature is enabled with "/" separator, display SHALL be "roaster/name"
- If the bean has no roaster field or feature is disabled, display SHALL be just the name

**Validates: Requirements 5.1, 5.2, 5.3**

### Property 5: Roaster Extraction Logic

_For any_ coffee bean and settings configuration:

- If feature is enabled and bean has roaster field, extraction SHALL return the roaster field value
- If feature is enabled and bean has no roaster field, extraction SHALL use separator-based extraction from name
- If feature is disabled, extraction SHALL use space-based extraction from name

**Validates: Requirements 6.1, 6.2, 6.3, 6.4**

### Property 6: Unique Roasters Extraction

_For any_ set of coffee beans:

- The unique roasters list SHALL contain no duplicates
- The list SHALL be sorted by frequency (most used first)
- The list SHALL NOT contain "未知烘焙商"
- When feature is enabled, roaster field values SHALL be prioritized over name extraction

**Validates: Requirements 7.1, 7.2, 7.3, 7.4**

### Property 7: Autocomplete Suggestions Filtering

_For any_ input string and list of roaster suggestions:

- Filtered suggestions SHALL only contain items that include the input string (case-insensitive)
- The filtered list SHALL maintain the original frequency-based ordering

**Validates: Requirements 4.3, 4.4**

## Error Handling

### 迁移错误处理

- 如果迁移过程中发生错误，不标记迁移完成，允许下次重试
- 单个咖啡豆迁移失败不影响其他咖啡豆
- 迁移失败时记录错误日志但不阻塞用户操作

### 设置读取错误处理

- 如果设置读取失败，使用默认值（roasterFieldEnabled: false, roasterSeparator: ' '）
- 确保向后兼容，旧版本数据不会导致崩溃

### 表单输入验证

- 烘焙商字段允许为空（可选字段）
- 烘焙商名称不做长度限制，但建议保持简短

## Testing Strategy

### Unit Tests

1. **Settings Store Tests**
   - 测试 roasterFieldEnabled 设置的读写
   - 测试 roasterSeparator 设置的读写
   - 测试默认值行为

2. **Extraction Function Tests**
   - 测试空格分隔符提取
   - 测试 "/" 分隔符提取
   - 测试边界情况（空名称、单词名称等）

3. **Display Formatting Tests**
   - 测试各种分隔符和字段组合的显示格式

### Property-Based Tests

使用 fast-check 库进行属性测试，每个属性测试至少运行 100 次迭代。

1. **Property 1: Settings Round-Trip**
   - 生成随机设置对象
   - 存储并读取
   - 验证等价性

2. **Property 3: Migration Correctness**
   - 生成随机咖啡豆集合（部分有 roaster 字段）
   - 执行迁移
   - 验证迁移结果符合预期

3. **Property 5: Roaster Extraction**
   - 生成随机咖啡豆和设置
   - 调用提取函数
   - 验证结果符合规则

### Integration Tests

1. **设置 UI 集成测试**
   - 验证开关切换正确更新设置
   - 验证分隔符选择器条件显示

2. **表单集成测试**
   - 验证烘焙商输入框条件显示
   - 验证自动补全功能

3. **迁移集成测试**
   - 验证首次启用触发迁移
   - 验证迁移后数据正确
