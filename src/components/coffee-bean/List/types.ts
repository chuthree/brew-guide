import { CoffeeBean } from '@/types/app';
import {
  getBeanOrigins,
  getBeanProcesses,
  getBeanVarieties,
} from '@/lib/utils/beanVarietyUtils';

// ExtendedCoffeeBean 已移除，直接使用 CoffeeBean
export type ExtendedCoffeeBean = CoffeeBean;

// 视图模式定义
export const VIEW_OPTIONS = {
  INVENTORY: 'inventory',
  RANKING: 'ranking',
  BLOGGER: 'blogger', // 新增博主榜单视图
  STATS: 'stats', // 新增统计视图
} as const;

export type ViewOption = (typeof VIEW_OPTIONS)[keyof typeof VIEW_OPTIONS];

// 视图选项的显示名称
export const VIEW_LABELS: Record<ViewOption, string> = {
  [VIEW_OPTIONS.INVENTORY]: '咖啡豆库存',
  [VIEW_OPTIONS.RANKING]: '个人榜单',
  [VIEW_OPTIONS.BLOGGER]: '博主榜单',
  [VIEW_OPTIONS.STATS]: '统计视图',
};

// 咖啡豆分类模式
export type BeanFilterMode = 'variety' | 'origin' | 'flavorPeriod' | 'roaster';

// 分类模式显示名称
export const BEAN_FILTER_LABELS: Record<BeanFilterMode, string> = {
  variety: '按品种',
  origin: '按产地',
  flavorPeriod: '按赏味期',
  roaster: '按烘焙商',
};

export interface CoffeeBeansProps {
  isOpen: boolean;
  showBeanForm?: (bean: ExtendedCoffeeBean | null) => void;
  onShowImport?: () => void;
  // 添加外部视图控制相关props
  externalViewMode?: ViewOption;
  onExternalViewChange?: (view: ViewOption) => void;
  // 添加初始化参数支持
  initialViewMode?: ViewOption;
  initialBloggerType?: BloggerType;
  onBloggerTypeChange?: (type: BloggerType) => void;
  // 添加设置参数
  settings?: {
    dateDisplayMode?: 'date' | 'flavorPeriod' | 'agingDays';
    showOnlyBeanName?: boolean;
    showFlavorInfo?: boolean;
    limitNotesLines?: boolean;
    notesMaxLines?: number;
    showTotalPrice?: boolean;
    showStatusDots?: boolean;
  };
}

// 导出工具函数
export const generateBeanTitle = (
  bean: ExtendedCoffeeBean,
  showOnlyName: boolean = false
): string => {
  // 安全检查：确保bean是有效对象且有名称
  if (!bean || typeof bean !== 'object' || !bean.name) {
    return bean?.name || '未命名咖啡豆';
  }

  // 如果只显示名称，直接返回名称
  if (showOnlyName) {
    return bean.name;
  }

  // 将豆子名称转换为小写以便比较
  const nameLower = bean.name.toLowerCase();

  // 创建一个函数来检查参数是否已包含在名称中
  const isIncluded = (param?: string | null): boolean => {
    // 如果参数为空或不是字符串类型，视为已包含
    if (!param || typeof param !== 'string') return true;

    // 将参数转换为小写并分割成单词
    const paramWords = param.toLowerCase().split(/\s+/);

    // 检查每个单词是否都包含在名称中
    return paramWords.every(word => nameLower.includes(word));
  };

  // 收集需要添加的参数
  const additionalParams: string[] = [];

  // 如果是拼配咖啡且有拼配成分，将成分添加到标题中
  if (
    bean.blendComponents &&
    Array.isArray(bean.blendComponents) &&
    bean.blendComponents.length > 0
  ) {
    // 拼配豆情况下，不再在标题中添加拼配成分信息
    if (bean.blendComponents.length > 1) {
      // 不添加拼配成分到标题
    } else {
      // 单品豆的情况，仍然添加信息到标题
      // 获取成分信息
      const comp = bean.blendComponents[0];
      if (comp) {
        // 检查并添加烘焙度
        if (bean.roastLevel && !isIncluded(bean.roastLevel)) {
          additionalParams.push(bean.roastLevel);
        }

        // 检查并添加产地
        if (comp.origin && !isIncluded(comp.origin)) {
          additionalParams.push(comp.origin);
        }

        // 检查并添加处理法
        if (comp.process && !isIncluded(comp.process)) {
          additionalParams.push(comp.process);
        }

        // 检查并添加品种
        if (comp.variety && !isIncluded(comp.variety)) {
          additionalParams.push(comp.variety);
        }
      }
    }
  } else {
    // 单品咖啡的情况，使用新的工具函数
    // 检查并添加烘焙度
    if (bean.roastLevel && !isIncluded(bean.roastLevel)) {
      additionalParams.push(bean.roastLevel);
    }

    // 使用工具函数获取产地信息
    const origins = getBeanOrigins(bean);
    origins.forEach(origin => {
      if (!isIncluded(origin)) {
        additionalParams.push(origin);
      }
    });

    // 使用工具函数获取处理法信息
    const processes = getBeanProcesses(bean);
    processes.forEach(process => {
      if (!isIncluded(process)) {
        additionalParams.push(process);
      }
    });

    // 使用工具函数获取品种信息
    const varieties = getBeanVarieties(bean);
    varieties.forEach(variety => {
      if (!isIncluded(variety)) {
        additionalParams.push(variety);
      }
    });
  }

  // 如果有额外参数，将它们添加到名称后面
  return additionalParams.length > 0
    ? `${bean.name} ${additionalParams.join(' ')}`
    : bean.name;
};

export type BloggerBeansYear = 2023 | 2024 | 2025;
export type BeanType = 'all' | 'espresso' | 'filter' | 'omni';
export type BloggerType = 'peter' | 'fenix';

// 博主显示名称
export const BLOGGER_LABELS: Record<BloggerType, string> = {
  peter: 'Peter',
  fenix: '矮人',
};
