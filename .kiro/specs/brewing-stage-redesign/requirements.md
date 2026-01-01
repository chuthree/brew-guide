# Requirements Document

## Introduction

本文档定义了冲煮步骤数据模型重新设计的需求。当前的数据模型使用累计时间（time）和注水时间（pourTime）的组合方式，用户需要自行计算等待时间，体验不够直观。新设计将采用阶段用时（duration）和阶段注水量（water）的方式，并将"等待"作为独立的注水方式类型，使数据模型更加清晰、人性化。

## Glossary

- **Stage**: 冲煮步骤，表示冲煮过程中的一个阶段
- **Stage_Editor**: 冲煮步骤编辑器组件，用于创建和编辑冲煮步骤
- **Pour_Type**: 注水方式，如中心注水、绕圈注水、等待等
- **Duration**: 阶段用时，表示该阶段持续的时间（秒）
- **Water**: 阶段注水量，表示该阶段注入的水量（克）
- **Legacy_Stage**: 旧版数据模型的冲煮步骤格式
- **Migration_Service**: 数据迁移服务，负责将旧数据转换为新格式
- **Import_Export_Service**: 导入导出服务，负责方案的分享和导入

## Requirements

### Requirement 1: 新数据模型定义

**User Story:** As a 开发者, I want 一个清晰简洁的冲煮步骤数据模型, so that 代码更易维护且用户更容易理解。

#### Acceptance Criteria

1. THE Stage_Model SHALL define the following fields: pourType (注水方式), label (标题), water (阶段注水量), duration (阶段用时), detail (备注)
2. THE Stage_Model SHALL use duration to represent the time spent in this stage instead of cumulative time
3. THE Stage_Model SHALL use water to represent the water added in this stage instead of cumulative water
4. THE Stage_Model SHALL NOT include pourTime field in the new model
5. THE Stage_Model SHALL NOT include cumulative time field in the new model

### Requirement 2: 等待步骤作为独立注水方式

**User Story:** As a 用户, I want 将等待作为一种独立的注水方式选择, so that 我可以直接设置等待时间而不需要通过计算注水时间来间接实现。

#### Acceptance Criteria

1. THE Pour_Type SHALL include a "wait" (等待) option as a valid pour type
2. WHEN a user selects "wait" as pour type, THE Stage_Editor SHALL only display duration and detail fields
3. WHEN a user selects "wait" as pour type, THE Stage_Editor SHALL NOT display water field
4. WHEN a user selects any pour type other than "wait", THE Stage_Editor SHALL display pourType, label, water, duration, and detail fields

### Requirement 3: 表单字段动态显示

**User Story:** As a 用户, I want 根据选择的注水方式看到不同的输入字段, so that 我只需要填写与当前步骤相关的信息。

#### Acceptance Criteria

1. WHEN pourType is "wait", THE Stage_Editor SHALL display only: pourType selector, duration input, detail input
2. WHEN pourType is "center", "circle", "ice", or custom pour type, THE Stage_Editor SHALL display: pourType selector, label input, water input, duration input, detail input
3. WHEN pourType is "bypass", THE Stage_Editor SHALL display: pourType selector, label input, water input, detail input (no duration)
4. WHEN pourType is "extraction" (意式萃取), THE Stage_Editor SHALL display: pourType selector, label input, water input, duration input, detail input
5. WHEN pourType is "beverage" (意式饮料), THE Stage_Editor SHALL display: pourType selector, label input, water input, detail input (no duration)

### Requirement 4: 向后兼容 - 数据迁移

**User Story:** As a 用户, I want 我现有的冲煮方案能够自动迁移到新格式, so that 我不会丢失任何已保存的数据。

#### Acceptance Criteria

1. WHEN the application loads legacy stage data, THE Migration_Service SHALL convert cumulative time to duration by calculating the difference between consecutive stages
2. WHEN the application loads legacy stage data, THE Migration_Service SHALL convert cumulative water to stage water by calculating the difference between consecutive stages
3. WHEN legacy stage has pourTime equal to 0 or significantly less than stage duration, THE Migration_Service SHALL create a separate "wait" stage
4. THE Migration_Service SHALL preserve all other stage properties (label, detail, pourType, valveStatus) during migration
5. THE Migration_Service SHALL handle edge cases where legacy data has missing or invalid values

### Requirement 5: 向后兼容 - 导入导出

**User Story:** As a 用户, I want 能够导入旧格式的分享数据并导出新格式的数据, so that 我可以与使用不同版本的用户分享方案。

#### Acceptance Criteria

1. WHEN importing data in legacy format, THE Import_Export_Service SHALL automatically convert it to the new format
2. WHEN exporting data, THE Import_Export_Service SHALL export in the new format with duration and stage water
3. THE Import_Export_Service SHALL support importing both JSON format and text format
4. THE Import_Export_Service SHALL maintain backward compatibility with legacy text format parsing
5. WHEN parsing legacy text format with "[X分Y秒] (注水Z秒)", THE Import_Export_Service SHALL correctly calculate duration and create wait stages if needed

### Requirement 6: 预设方案初始化

**User Story:** As a 用户, I want 新建方案时自动预设预浸泡和等待阶段, so that 我可以快速开始编辑常见的冲煮流程。

#### Acceptance Criteria

1. WHEN creating a new brewing method for pour-over equipment, THE Stage_Editor SHALL initialize with a pre-infusion stage (预浸泡) and a wait stage (等待)
2. THE pre-infusion stage SHALL have default values: pourType="circle", label="预浸泡", water="30", duration="10", detail=""
3. THE wait stage SHALL have default values: pourType="wait", label="等待", duration="20", detail=""
4. WHEN creating a new brewing method for espresso equipment, THE Stage_Editor SHALL initialize with an extraction stage only

### Requirement 7: 计时器兼容性

**User Story:** As a 用户, I want 计时器能够正确处理新的数据格式, so that 冲煮过程中的时间和水量显示正确。

#### Acceptance Criteria

1. THE Timer_Component SHALL calculate cumulative time from stage durations for display purposes
2. THE Timer_Component SHALL calculate cumulative water from stage water amounts for display purposes
3. WHEN encountering a "wait" stage, THE Timer_Component SHALL display waiting animation without pour visualization
4. THE Timer_Component SHALL correctly handle the transition between pour stages and wait stages

### Requirement 8: 数据验证

**User Story:** As a 用户, I want 系统验证我输入的数据, so that 我不会创建无效的冲煮方案。

#### Acceptance Criteria

1. THE Stage_Editor SHALL validate that duration is a non-negative integer
2. THE Stage_Editor SHALL validate that water is a non-negative integer for non-wait stages
3. WHEN a required field is empty or invalid, THE Stage_Editor SHALL display appropriate error feedback
4. THE Stage_Editor SHALL allow duration to be 0 for bypass and beverage stages
