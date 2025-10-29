/**
 * 方案模块统一类型定义
 * 集中管理所有方案相关的类型，避免重复定义
 */

import { Method, Stage } from '@/lib/core/config';

/**
 * 方案类型：通用方案或自定义方案
 */
export type MethodType = 'common' | 'custom';

/**
 * 扩展的方案接口，包含额外的元数据
 */
interface ExtendedMethod extends Method {
  /** 是否来自通用方案（用于标识转换来的方案） */
  _isFromCommonMethod?: boolean;
  /** 方案类型 */
  _methodType?: MethodType;
}

/**
 * 带冲泡步骤的方案接口
 * 替代组件中重复定义的 MethodWithStages
 */
export interface MethodWithStages extends Omit<Method, 'params'> {
  params: {
    coffee: string;
    water: string;
    ratio: string;
    grindSize: string;
    temp: string;
    stages: Stage[];
    // 意式机特有参数
    extractionTime?: number;
    liquidWeight?: string;
  };
}

/**
 * 方案步骤配置
 * 用于方案选择器和内容渲染
 */
export interface MethodStepConfig {
  /** 步骤标题 */
  title: string;
  /** 步骤描述 */
  description?: string;
  /** 步骤项目列表 */
  items?: string[];
  /** 备注信息 */
  note?: string;
  /** 方案在数组中的索引 */
  methodIndex?: number;
  /** 是否为通用方案 */
  isCommonMethod?: boolean;
  /** 显式指定的方案类型 */
  explicitMethodType?: MethodType;
  /** 自定义参数（用于覆盖方案默认参数） */
  customParams?: Record<string, string>;
  /** 是否为分隔符 */
  isDivider?: boolean;
  /** 分隔符文本 */
  dividerText?: string;
  /** 是否固定显示 */
  isPinned?: boolean;
  /** 图标 */
  icon?: string;
}

/**
 * 冲泡步骤接口
 * 包含完整的冲泡阶段信息
 */
interface BrewingStepData extends Stage {
  /** 阶段在数组中的原始索引 */
  originalIndex?: number;
  /** 步骤类型：注水或等待 */
  type?: 'pour' | 'wait';
  /** 开始时间（毫秒） */
  startTime?: number;
  /** 结束时间（毫秒） */
  endTime?: number;
}

/**
 * 方案选择回调参数
 */
interface MethodSelectParams {
  /** 选中的器具ID */
  equipmentId: string;
  /** 方案索引 */
  methodIndex: number;
  /** 方案类型 */
  methodType: MethodType;
  /** 步骤配置（可选） */
  step?: MethodStepConfig;
}
