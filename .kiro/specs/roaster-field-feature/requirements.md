# Requirements Document

## Introduction

本功能为咖啡豆添加独立的"烘焙商"字段，替代当前从咖啡豆名称中通过空格或分隔符自动识别烘焙商的方式。用户可以在设置中开启此功能，并选择烘焙商与名称之间的分隔符（空格或"/"）。开启后，咖啡豆表单将显示独立的烘焙商输入框，并支持从历史记录中选择。

## Glossary

- **Roaster_Field**: 咖啡豆数据模型中新增的烘焙商字段，用于存储烘焙商名称
- **Roaster_Separator**: 烘焙商分隔符设置，决定咖啡豆名称显示时烘焙商与名称之间的分隔方式（空格或"/"）
- **Roaster_Field_Enabled**: 设置项，控制是否启用独立烘焙商字段功能
- **Bean_Form**: 咖啡豆添加/编辑表单组件
- **Settings_Store**: Zustand 状态管理中的设置存储
- **Migration**: 数据迁移，将现有咖啡豆的烘焙商信息从名称中提取并存储到新字段

## Requirements

### Requirement 1: 烘焙商字段设置开关

**User Story:** As a user, I want to enable/disable the roaster field feature in bean settings, so that I can choose whether to use a separate roaster field or continue using the current name-based extraction.

#### Acceptance Criteria

1. WHEN a user navigates to "咖啡豆设置" > "添加" section, THE Settings_UI SHALL display a toggle for "烘焙商" field
2. THE Settings_Store SHALL persist the Roaster_Field_Enabled setting to IndexedDB
3. WHEN Roaster_Field_Enabled is true, THE Settings_UI SHALL display a Roaster_Separator selector below the toggle
4. THE Roaster_Separator selector SHALL offer two options: "空格" (space) and "/" (slash), with "空格" as default
5. THE Settings_Store SHALL persist the Roaster_Separator setting to IndexedDB

### Requirement 2: 咖啡豆数据模型扩展

**User Story:** As a developer, I want to extend the CoffeeBean data model with a roaster field, so that roaster information can be stored independently from the bean name.

#### Acceptance Criteria

1. THE CoffeeBean interface SHALL include an optional `roaster` field of type string
2. WHEN a CoffeeBean is serialized for storage, THE System SHALL include the roaster field if present
3. WHEN a CoffeeBean is deserialized from storage, THE System SHALL correctly restore the roaster field

### Requirement 3: 数据迁移

**User Story:** As a user, I want my existing coffee beans to automatically have their roaster information migrated to the new field when I enable the feature, so that I don't lose any data.

#### Acceptance Criteria

1. WHEN Roaster_Field_Enabled is set to true for the first time, THE System SHALL perform a one-time migration
2. THE Migration SHALL extract roaster names from existing bean names using the current Roaster_Separator setting
3. THE Migration SHALL populate the roaster field for all existing beans that don't already have one
4. THE Migration SHALL NOT modify beans that already have a roaster field value
5. THE Migration SHALL use the `extractRoasterFromName` utility function with the configured separator
6. WHEN migration completes, THE System SHALL mark the migration as complete to prevent re-running

### Requirement 4: 咖啡豆表单烘焙商输入

**User Story:** As a user, I want to see a separate roaster input field in the coffee bean form when the feature is enabled, so that I can easily enter and select roasters.

#### Acceptance Criteria

1. WHEN Roaster_Field_Enabled is true, THE Bean_Form SHALL display a roaster input field before the name field in the basic info step
2. THE roaster input field SHALL support autocomplete with suggestions from existing roasters
3. THE autocomplete suggestions SHALL be sourced from all unique roasters in the user's coffee bean collection
4. WHEN a user types in the roaster field, THE System SHALL filter suggestions based on the input
5. THE roaster input field SHALL allow free text entry for new roasters
6. WHEN Roaster_Field_Enabled is false, THE Bean_Form SHALL NOT display the roaster input field

### Requirement 5: 咖啡豆名称显示格式

**User Story:** As a user, I want coffee bean names to display with the roaster using my preferred separator, so that the display is consistent with my preference.

#### Acceptance Criteria

1. WHEN displaying a coffee bean with a roaster field AND Roaster_Separator is "空格", THE System SHALL display as "烘焙商 名称"
2. WHEN displaying a coffee bean with a roaster field AND Roaster_Separator is "/", THE System SHALL display as "烘焙商/名称"
3. WHEN displaying a coffee bean without a roaster field, THE System SHALL display only the name
4. THE display format SHALL be consistent across all UI components (list, detail, notes, etc.)

### Requirement 6: 烘焙商提取逻辑更新

**User Story:** As a developer, I want the roaster extraction logic to respect the new roaster field and separator settings, so that the system works correctly in both modes.

#### Acceptance Criteria

1. WHEN Roaster_Field_Enabled is true AND a bean has a roaster field, THE `extractRoasterFromName` function SHALL return the roaster field value
2. WHEN Roaster_Field_Enabled is true AND a bean does NOT have a roaster field, THE `extractRoasterFromName` function SHALL extract from name using the configured separator
3. WHEN Roaster_Field_Enabled is false, THE `extractRoasterFromName` function SHALL use the current space-based extraction logic
4. THE extraction logic SHALL support both space and "/" as separators based on the Roaster_Separator setting

### Requirement 7: 烘焙商列表获取

**User Story:** As a user, I want the system to provide a list of all roasters I've used, so that I can easily select from them when adding new beans.

#### Acceptance Criteria

1. THE System SHALL provide a function to extract unique roasters from all coffee beans
2. THE roaster list SHALL be sorted by frequency (most used first)
3. THE roaster list SHALL exclude "未知烘焙商" entries
4. WHEN Roaster_Field_Enabled is true, THE System SHALL prioritize roaster field values over name extraction
