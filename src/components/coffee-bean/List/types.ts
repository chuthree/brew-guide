import { CoffeeBean } from '@/types/app';
import { VIEW_OPTIONS, VIEW_LABELS, type ViewOption } from './constants';

// ExtendedCoffeeBean 已移除，直接使用 CoffeeBean
export type ExtendedCoffeeBean = CoffeeBean;

// Re-export constants for backward compatibility
export { VIEW_OPTIONS, VIEW_LABELS, type ViewOption };

// 咖啡豆分类模式
export type BeanFilterMode = 'roaster' | 'origin' | 'variety' | 'flavorPeriod';

// 分类模式显示名称
const BEAN_FILTER_LABELS: Record<BeanFilterMode, string> = {
  roaster: '按烘焙商',
  origin: '按产地',
  variety: '按品种',
  flavorPeriod: '按赏味期',
};

export interface CoffeeBeansProps {
  isOpen: boolean;
  showBeanForm?: (
    bean: ExtendedCoffeeBean | null,
    beanState?: 'green' | 'roasted'
  ) => void;
  onShowImport?: (beanState: 'green' | 'roasted') => void;
  // 添加外部视图控制相关props
  externalViewMode?: ViewOption;
  onExternalViewChange?: (view: ViewOption) => void;
  // 添加初始化参数支持
  initialViewMode?: ViewOption;
  // 添加设置参数
  settings?: {
    dateDisplayMode?: 'date' | 'flavorPeriod' | 'agingDays';
    showFlavorInfo?: boolean;
    showBeanNotes?: boolean;
    limitNotesLines?: boolean;
    notesMaxLines?: number;
    showPrice?: boolean;
    showTotalPrice?: boolean;
    showStatusDots?: boolean;
    simplifiedViewLabels?: boolean;
    immersiveAdd?: boolean; // 沉浸式添加模式
  };
}

// 导出工具函数 - 直接返回咖啡豆名称
export const generateBeanTitle = (bean: ExtendedCoffeeBean): string => {
  if (!bean || typeof bean !== 'object' || !bean.name) {
    return bean?.name || '未命名咖啡豆';
  }
  return bean.name;
};

export type BeanType = 'all' | 'espresso' | 'filter' | 'omni';
export type BeanState = 'green' | 'roasted';

// 豆子状态显示名称
export const BEAN_STATE_LABELS: Record<BeanState, string> = {
  green: '生豆',
  roasted: '咖啡豆',
};
