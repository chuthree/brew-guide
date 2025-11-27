import { ExtendedCoffeeBean } from '../../types';

export interface StatsViewProps {
  beans: ExtendedCoffeeBean[];
  showEmptyBeans: boolean;
}

// 时间分组模式
export type DateGroupingMode = 'year' | 'month' | 'day';

// 豆子类型
export type BeanType = 'espresso' | 'filter' | 'omni';

// 统一的消耗数据结构（适用于概览和各类型）
export interface ConsumptionStats {
  consumption: number; // 消耗量（克）
  cost: number; // 花费（元）
  percentage?: number; // 占比（百分比，仅类型统计使用）
}

// 库存数据（仅实时视图使用）
export interface InventoryStats {
  remaining: number; // 剩余量（克）
  remainingValue: number; // 剩余价值（元）
  estimatedDays: number; // 预计可用天数
}

// 按类型分类的消耗统计
export interface TypeConsumptionStats {
  espresso: ConsumptionStats;
  filter: ConsumptionStats;
  omni: ConsumptionStats;
}

// 按类型分类的库存预测
export interface TypeInventoryStats {
  type: BeanType;
  label: string;
  remaining: number; // 剩余量（克）
  dailyConsumption: number; // 日均消耗（克）
  estimatedDays: number; // 预计可用天数
}

// 冲煮明细记录（用于单日视图）
export interface BrewingDetailItem {
  id: string;
  timestamp: number; // 冲煮时间戳
  beanName: string; // 咖啡豆名称
  amount: number; // 用量（克）
  cost: number; // 花费（元）
}

// 统一的统计数据结构
export interface UnifiedStatsData {
  // 概览：总消耗数据
  overview: ConsumptionStats & {
    dailyConsumption: number; // 日均消耗
    dailyCost: number; // 日均花费
  };
  // 按类型分类
  byType: TypeConsumptionStats;
  // 库存数据（仅实时视图有效）
  inventory: InventoryStats | null;
  // 按类型分类的库存预测（仅实时视图有效）
  inventoryByType: TypeInventoryStats[] | null;
}
