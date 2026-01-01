# Implementation Plan: Brewing Stage Data Model Redesign

## Overview

本实现计划将冲煮步骤数据模型从累计时间/注水时间模式重构为阶段用时/阶段注水量模式，并将"等待"作为独立的注水方式类型。实现采用渐进式迁移策略，确保向后兼容。

## Tasks

- [x] 1. 更新核心类型定义
  - [x] 1.1 更新 Stage 接口定义
    - 在 `src/lib/core/config.ts` 中更新 Stage 接口
    - 添加 `duration` 字段，移除 `time` 和 `pourTime` 的必填要求
    - 添加 `wait` 到 PourType 类型
    - _Requirements: 1.1, 1.2, 1.3, 2.1_
  - [x] 1.2 更新 forms/components/types.ts 中的类型定义
    - 同步更新 Stage 扩展类型
    - 确保 PourType 包含 'wait'
    - _Requirements: 1.1, 2.1_

- [-] 2. 实现迁移服务
  - [x] 2.1 创建 stageMigration.ts 迁移服务
    - 在 `src/lib/brewing/` 目录创建 `stageMigration.ts`
    - 实现 `isLegacyFormat()` 检测函数
    - 实现 `migrateStages()` 迁移函数
    - 实现 `toLegacyFormat()` 反向转换函数
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_
  - [ ]\* 2.2 编写迁移服务属性测试
    - **Property 3: Migration Cumulative to Per-Stage Conversion**
    - **Property 4: Migration Wait Stage Extraction**
    - **Property 5: Migration Property Preservation**
    - **Validates: Requirements 4.1, 4.2, 4.3, 4.4**

- [-] 3. 实现阶段计算工具
  - [x] 3.1 创建 stageUtils.ts 工具函数
    - 在 `src/lib/brewing/` 目录创建 `stageUtils.ts`
    - 实现 `calculateCumulativeTime()` 累计时间计算
    - 实现 `calculateCumulativeWater()` 累计水量计算
    - 实现 `calculateTotalDuration()` 总时长计算
    - 实现 `calculateTotalWater()` 总水量计算
    - 实现 `getStageStartTime()` 和 `getStageEndTime()`
    - _Requirements: 7.1, 7.2_
  - [ ]\* 3.2 编写阶段计算属性测试
    - **Property 8: Timer Cumulative Calculations**
    - **Validates: Requirements 7.1, 7.2**

- [x] 4. Checkpoint - 核心服务测试
  - 确保所有测试通过，如有问题请询问用户

- [x] 5. 更新导入导出服务
  - [x] 5.1 更新 jsonUtils.ts 支持新格式
    - 更新 `parseMethodFromJson()` 支持新旧格式
    - 更新 `parseMethodText()` 支持新旧文本格式
    - 更新 `methodToJson()` 导出新格式
    - 更新 `methodToReadableText()` 导出新文本格式
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_
  - [ ]\* 5.2 编写导入导出属性测试
    - **Property 6: Import Legacy Format Compatibility**
    - **Property 7: Export New Format Structure**
    - **Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5**

- [x] 6. 更新表单组件
  - [x] 6.1 更新 StagesStep.tsx 表单逻辑
    - 添加 'wait' 注水方式选项
    - 实现字段动态显示逻辑
    - 将累计时间/水量输入改为阶段用时/注水量输入
    - 移除注水时间字段和等待时间计算显示
    - _Requirements: 2.2, 2.3, 2.4, 3.1, 3.2, 3.3, 3.4, 3.5_
  - [x] 6.2 更新表单验证逻辑
    - 实现 duration 非负整数验证
    - 实现 water 非负整数验证（非等待步骤）
    - 允许 bypass/beverage 的 duration 为 0
    - _Requirements: 8.1, 8.2, 8.4_
  - [ ]\* 6.3 编写表单验证属性测试
    - **Property 9: Validation Constraints**
    - **Validates: Requirements 8.1, 8.2, 8.4**

- [x] 7. 更新默认初始化
  - [x] 7.1 更新方案创建时的默认阶段
    - 手冲器具：预浸泡阶段 + 等待阶段
    - 意式咖啡机：萃取阶段
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

- [x] 8. Checkpoint - 表单功能测试
  - 确保所有测试通过，如有问题请询问用户

- [x] 9. 更新计时器组件
  - [x] 9.1 更新 Timer 相关组件适配新数据格式
    - 更新 `StageProcessor.ts` 使用新的阶段计算
    - 更新 `useBrewingContent.ts` 适配新格式
    - 更新 `useBrewingState.ts` 适配新格式
    - _Requirements: 7.1, 7.2, 7.3, 7.4_
  - [x] 9.2 处理等待阶段的显示逻辑
    - 等待阶段显示等待动画
    - 等待阶段不显示注水可视化
    - _Requirements: 7.3_

- [x] 10. 更新预设方案数据
  - [x] 10.1 迁移 config.ts 中的预设方案
    - 将 brewingMethods 中的所有预设方案转换为新格式
    - 确保等待阶段独立存在
    - _Requirements: 4.1, 4.2, 4.3_

- [x] 11. 数据迁移集成
  - [x] 11.1 在数据加载时自动迁移旧数据
    - 在 customMethodStore 加载时检测并迁移旧格式
    - 在导入方案时自动转换旧格式
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 5.1_

- [x] 12. Final Checkpoint - 完整功能测试
  - 确保所有测试通过，如有问题请询问用户

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
- 迁移策略采用渐进式，旧数据在读取时自动转换，不强制批量迁移
- 导出始终使用新格式，导入同时支持新旧格式
