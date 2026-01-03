'use client';

import { CoffeeBean } from '@/types/app';
import { BrewingNote } from '@/lib/core/config';

// 烘焙度选项
export const ROAST_LEVELS = [
  '极浅烘焙',
  '浅度烘焙',
  '中浅烘焙',
  '中度烘焙',
  '中深烘焙',
  '深度烘焙',
] as const;

// 咖啡豆类型选项
export const BEAN_TYPES = [
  { value: 'filter' as const, label: '手冲' },
  { value: 'espresso' as const, label: '意式' },
  { value: 'omni' as const, label: '全能' },
];

// 信息项类型定义
export interface InfoItem {
  key: string;
  label: string;
  value: string | React.ReactNode;
  type?: 'normal' | 'status';
  color?: string;
}

export interface BeanDetailModalProps {
  isOpen: boolean;
  bean: CoffeeBean | null;
  onClose: () => void;
  searchQuery?: string;
  onEdit?: (bean: CoffeeBean) => void;
  onDelete?: (bean: CoffeeBean) => void;
  onShare?: (bean: CoffeeBean) => void;
  onRate?: (bean: CoffeeBean) => void;
  onRepurchase?: (bean: CoffeeBean) => void;
  /** 去烘焙回调 - 将生豆转换为熟豆 */
  onRoast?: (
    greenBean: CoffeeBean,
    roastedBeanTemplate: Omit<CoffeeBean, 'id' | 'timestamp'>
  ) => void;
  /** 转为生豆回调 - 将熟豆转换为生豆（用于迁移旧数据） */
  onConvertToGreen?: (bean: CoffeeBean) => void;
  /** 模式：view 查看/编辑现有豆子，add 添加新豆子 */
  mode?: 'view' | 'add';
  /** 添加模式下的保存回调 */
  onSaveNew?: (bean: Omit<CoffeeBean, 'id' | 'timestamp'>) => void;
  /** 添加模式下的初始豆子状态 */
  initialBeanState?: 'green' | 'roasted';
}

// 共享的上下文类型
export interface BeanDetailContextValue {
  bean: CoffeeBean | null;
  tempBean: Partial<CoffeeBean>;
  isAddMode: boolean;
  isGreenBean: boolean;
  searchQuery: string;
  handleUpdateField: (updates: Partial<CoffeeBean>) => Promise<void>;
  setTempBean: React.Dispatch<React.SetStateAction<Partial<CoffeeBean>>>;
}

// 相关记录的 props
export interface RelatedRecordsProps {
  relatedNotes: BrewingNote[];
  relatedBeans: CoffeeBean[];
  equipmentNames: Record<string, string>;
  isGreenBean: boolean;
  allBeans: CoffeeBean[];
  bean: CoffeeBean | null;
}

// 判断是否为简单的变动记录
export const isSimpleChangeRecord = (note: BrewingNote): boolean => {
  return (
    note.source === 'quick-decrement' || note.source === 'capacity-adjustment'
  );
};

// 判断是否为烘焙记录
export const isRoastingRecord = (note: BrewingNote): boolean => {
  return note.source === 'roasting';
};
