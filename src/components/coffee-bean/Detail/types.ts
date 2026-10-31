'use client';

import { CoffeeBean } from '@/types/app';
import { BrewingNote } from '@/lib/core/config';
import { ROAST_LEVELS } from '@/lib/utils/roastProfileUtils';

export { ROAST_LEVELS };

// 咖啡豆类型选项
export const BEAN_TYPES = [
  { value: 'filter' as const, label: '手冲' },
  { value: 'espresso' as const, label: '意式' },
  { value: 'omni' as const, label: '全能' },
];

export interface BeanDetailModalProps {
  isOpen: boolean;
  bean: CoffeeBean | null;
  onClose: () => void;
  onCreateNoteFromBean?: (bean: CoffeeBean) => void;
  onOpenRelatedBean?: (bean: CoffeeBean) => void;
  onOpenRelatedNote?: (detail: {
    note: BrewingNote;
    equipmentName: string;
    beanUnitPrice: number;
    beanInfo?: CoffeeBean | null;
  }) => void;
  onEditRelatedNote?: (note: BrewingNote) => void;
  onEdit?: (bean: CoffeeBean) => void;
  onDelete?: (bean: CoffeeBean) => void;
  onShare?: (bean: CoffeeBean) => void;
  onRate?: (bean: CoffeeBean) => void;
  onRepurchase?: (bean: CoffeeBean) => void;
  /** 去烘焙回调 - 将生豆转换为熟豆 */
  onRoast?: (greenBean: CoffeeBean) => void;
  /** 转为生豆回调 - 将熟豆转换为生豆（用于迁移旧数据） */
  onConvertToGreen?: (bean: CoffeeBean) => void;
  /** 模式：view 查看现有豆子，add 添加新豆子，edit 编辑现有豆子 */
  mode?: 'view' | 'add' | 'edit';
  /** 添加模式下的保存回调 */
  onSaveNew?: (bean: Omit<CoffeeBean, 'id' | 'timestamp'>) => void;
  /** 编辑模式下的保存回调 */
  onSaveEdit?: (
    bean: CoffeeBean,
    updates: Omit<CoffeeBean, 'id' | 'timestamp'>
  ) => void | Promise<void>;
  /** 从详情页编辑模式返回详情页 */
  onExitEdit?: () => void;
  /** 添加模式下的初始豆子状态 */
  initialBeanState?: 'green' | 'roasted';
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
