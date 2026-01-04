# Implementation Plan: Roaster Field Feature

## Overview

本实现计划将烘焙商字段功能分解为增量式的编码任务，确保每个步骤都能独立验证并逐步构建完整功能。

## Tasks

- [x] 1. 扩展数据模型和类型定义
  - [x] 1.1 在 `src/lib/core/db.ts` 的 `AppSettings` 接口中添加 `roasterFieldEnabled`、`roasterSeparator`、`roasterMigrationCompleted` 字段
    - 添加类型定义和默认值
    - _Requirements: 1.2, 1.5_
  - [x] 1.2 在 `src/types/app.d.ts` 的 `CoffeeBean` 接口中添加可选的 `roaster` 字段
    - _Requirements: 2.1_
  - [x] 1.3 在 `src/lib/stores/settingsStore.ts` 的 `defaultSettings` 中添加新字段的默认值
    - `roasterFieldEnabled: false`
    - `roasterSeparator: ' '`
    - `roasterMigrationCompleted: false`
    - _Requirements: 1.2, 1.5_

- [x] 2. 实现烘焙商提取和显示工具函数
  - [x] 2.1 更新 `src/lib/utils/beanVarietyUtils.ts` 中的 `extractRoasterFromName` 函数，支持分隔符参数
    - 添加 `separator` 参数，默认为空格
    - 支持 "/" 分隔符
    - _Requirements: 6.3, 6.4_
  - [x] 2.2 添加 `getRoasterName` 函数，优先使用 roaster 字段
    - 如果启用了烘焙商字段且有值，返回字段值
    - 否则调用 `extractRoasterFromName`
    - _Requirements: 6.1, 6.2_
  - [x] 2.3 添加 `formatBeanDisplayName` 函数，格式化咖啡豆显示名称
    - 根据设置和分隔符格式化显示
    - _Requirements: 5.1, 5.2, 5.3_
  - [ ]\* 2.4 编写属性测试：Roaster Extraction Logic
    - **Property 5: Roaster Extraction Logic**
    - **Validates: Requirements 6.1, 6.2, 6.3, 6.4**
  - [ ]\* 2.5 编写属性测试：Display Name Formatting
    - **Property 4: Display Name Formatting**
    - **Validates: Requirements 5.1, 5.2, 5.3**

- [x] 3. 实现数据迁移模块
  - [x] 3.1 创建 `src/lib/utils/roasterMigration.ts` 文件
    - 实现 `migrateRoasterField` 函数
    - 从现有咖啡豆名称中提取烘焙商
    - 只处理没有 roaster 字段的咖啡豆
    - 迁移完成后标记 `roasterMigrationCompleted`
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.6_
  - [ ]\* 3.2 编写属性测试：Migration Correctness
    - **Property 3: Migration Correctness**
    - **Validates: Requirements 3.2, 3.3, 3.4**

- [x] 4. Checkpoint - 确保所有测试通过
  - 确保所有测试通过，如有问题请询问用户

- [x] 5. 实现设置 UI
  - [x] 5.1 更新 `src/components/settings/BeanSettings.tsx`，在"添加"部分添加烘焙商开关
    - 添加 "烘焙商" 开关
    - 开关切换时触发迁移（如果首次启用）
    - _Requirements: 1.1, 3.1_
  - [x] 5.2 添加烘焙商分隔符选择器（条件显示）
    - 仅在 `roasterFieldEnabled` 为 true 时显示
    - 提供 "空格" 和 "/" 两个选项
    - _Requirements: 1.3, 1.4_

- [x] 6. 更新咖啡豆表单
  - [x] 6.1 更新 `src/components/coffee-bean/Form/index.tsx`，添加烘焙商状态管理
    - 添加 roaster 字段到 bean 状态
    - 添加 roasterSuggestions 状态
    - _Requirements: 4.1_
  - [x] 6.2 更新 `src/components/coffee-bean/Form/components/BasicInfo.tsx`，添加烘焙商输入框
    - 在名称输入框前添加烘焙商输入框（条件显示）
    - 使用 AutocompleteInput 组件
    - 传入烘焙商建议列表
    - _Requirements: 4.1, 4.2, 4.5, 4.6_
  - [x] 6.3 实现烘焙商自动补全建议
    - 从所有咖啡豆中提取唯一烘焙商
    - 按使用频率排序
    - 排除 "未知烘焙商"
    - _Requirements: 4.3, 7.1, 7.2, 7.3, 7.4_
  - [ ]\* 6.4 编写属性测试：Unique Roasters Extraction
    - **Property 6: Unique Roasters Extraction**
    - **Validates: Requirements 7.1, 7.2, 7.3, 7.4**
  - [ ]\* 6.5 编写属性测试：Autocomplete Suggestions Filtering
    - **Property 7: Autocomplete Suggestions Filtering**
    - **Validates: Requirements 4.3, 4.4**

- [x] 7. 更新咖啡豆显示组件
  - [x] 7.1 更新 `src/components/coffee-bean/List/components/BeanListItem.tsx`，使用 `formatBeanDisplayName`
    - 根据设置格式化显示名称
    - _Requirements: 5.1, 5.2, 5.3, 5.4_
  - [x] 7.2 更新其他显示咖啡豆名称的组件
    - 检查并更新 BeanDetailModal、笔记相关组件等
    - 确保显示格式一致
    - _Requirements: 5.4_

- [x] 8. 更新烘焙商相关功能
  - [x] 8.1 更新 `extractUniqueRoasters` 函数，支持新的烘焙商字段
    - 优先使用 roaster 字段
    - 回退到名称提取
    - _Requirements: 7.4_
  - [x] 8.2 更新 `beanHasRoaster` 函数，支持新的烘焙商字段
    - 优先检查 roaster 字段
    - _Requirements: 6.1_

- [x] 9. Final Checkpoint - 确保所有测试通过
  - 确保所有测试通过，如有问题请询问用户
  - 验证功能完整性

- [x] 10. 更新笔记中的咖啡豆显示
  - [x] 10.1 在 `src/types/app.d.ts` 的 `BrewingNoteData.coffeeBeanInfo` 中添加可选的 `roaster` 字段
    - 用于存储笔记创建时的烘焙商信息
    - _Requirements: 5.4_
  - [x] 10.2 添加 `formatNoteBeanDisplayName` 工具函数到 `src/lib/utils/beanVarietyUtils.ts`
    - 根据当前设置动态格式化笔记中的咖啡豆显示名称
    - _Requirements: 5.1, 5.2, 5.3_
  - [x] 10.3 更新 `src/components/notes/Form/BrewingNoteForm.tsx` 的 `handleCoffeeBeanSelect`
    - 分别存储 `name` 和 `roaster`，不在选择时格式化
    - _Requirements: 5.4_
  - [x] 10.4 更新笔记列表组件使用 `formatNoteBeanDisplayName`
    - `NoteItem.tsx`
    - `NoteItemCard.tsx`
    - `ChangeRecordNoteItem.tsx`
    - `GalleryView.tsx`
    - `DateImageFlowView.tsx`
    - _Requirements: 5.4_
  - [x] 10.5 更新 `NoteDetailModal.tsx` 使用 `formatNoteBeanDisplayName`
    - _Requirements: 5.4_
  - [x] 10.6 更新 `ArtisticShareDrawer.tsx` 使用 `formatNoteBeanDisplayName`
    - _Requirements: 5.4_
  - [x] 10.7 更新 `ChangeRecordEditForm.tsx` 使用 `formatNoteBeanDisplayName`
    - _Requirements: 5.4_
  - [x] 10.8 更新 `BrewingNoteFormModal.tsx` 保存时包含 `roaster` 字段
    - _Requirements: 5.4_

## Notes

- 任务标记 `*` 的为可选测试任务，可跳过以加快 MVP 开发
- 每个任务都引用了具体的需求以便追溯
- Checkpoint 任务用于确保增量验证
- 属性测试验证通用正确性属性
