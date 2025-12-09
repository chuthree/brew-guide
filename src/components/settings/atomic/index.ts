/**
 * 设置组件原子化系统
 *
 * 这个文件导出所有原子化设置组件，方便统一导入
 * 符合新的设计语言规范，确保所有设置页面样式统一
 */

// 页面级组件
export { default as SettingPage } from './SettingPage';

// 布局组件
export { default as SettingSection } from './SettingSection';
export { default as SettingRow } from './SettingRow';

// 控件组件
export { default as SettingToggle } from './SettingToggle';
export { default as SettingSlider } from './SettingSlider';

// 辅助组件
export { default as SettingDescription } from './SettingDescription';

// 入口列表组件（用于主设置页）
export { default as SettingGroup } from '../SettingItem';
