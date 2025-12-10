import React from 'react';
import { CoffeeBean } from '@/types/app';
import { cn } from '@/lib/utils/classNameUtils';
import { parseDateToTimestamp } from '@/lib/utils/dateUtils';
import { Select, SelectContent, SelectTrigger } from '../ui/select';
import * as SelectPrimitive from '@radix-ui/react-select';
import {
  SORT_OPTIONS as RANKING_SORT_OPTIONS,
  RankingSortOption,
} from '../Ranking';
import {
  sortBeansByFlavorPeriod,
  sortBeansByFlavorPeriodReverse,
} from '@/lib/utils/beanSortUtils';

// 自定义SelectItem，移除右侧指示器
const CustomSelectItem = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Item
    ref={ref}
    className={cn(
      'relative flex w-full cursor-default items-center rounded-md py-2 pr-8 pl-3 text-xs outline-hidden select-none data-disabled:pointer-events-none data-disabled:opacity-50 data-highlighted:bg-neutral-50 data-highlighted:text-neutral-600 dark:data-highlighted:bg-neutral-800/50 dark:data-highlighted:text-neutral-300',
      className
    )}
    {...props}
  >
    <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
  </SelectPrimitive.Item>
));
CustomSelectItem.displayName = SelectPrimitive.Item.displayName;

// 排序类型定义
export const SORT_OPTIONS = {
  REMAINING_DAYS_ASC: 'remaining_days_asc', // 赏味期剩余天数从少到多（升序）
  REMAINING_DAYS_DESC: 'remaining_days_desc', // 赏味期剩余天数从多到少（降序）
  NAME_ASC: 'name_asc', // 名称按字母顺序（A→Z）
  NAME_DESC: 'name_desc', // 名称按字母倒序（Z→A）
  RATING_ASC: 'rating_asc', // 评分从低到高（升序）
  RATING_DESC: 'rating_desc', // 评分从高到低（降序）
  ORIGINAL: 'original', // 博主榜单原始排序
  REMAINING_AMOUNT_ASC: 'remaining_amount_asc', // 剩余量从少到多（升序）
  REMAINING_AMOUNT_DESC: 'remaining_amount_desc', // 剩余量从多到少（降序）
  ROAST_DATE_ASC: 'roast_date_asc', // 烘焙日期从早到晚（升序）
  ROAST_DATE_DESC: 'roast_date_desc', // 烘焙日期从晚到早（降序）
  PRICE_ASC: 'price_asc', // 每克价格从低到高（升序）
  PRICE_DESC: 'price_desc', // 每克价格从高到低（降序）
  LAST_MODIFIED_DESC: 'last_modified_desc', // 最近变动（降序）
  LAST_MODIFIED_ASC: 'last_modified_asc', // 最早变动（升序）
} as const;

export type SortOption = (typeof SORT_OPTIONS)[keyof typeof SORT_OPTIONS];

// 计算咖啡豆的每克价格
const calculatePricePerGram = (bean: CoffeeBean): number => {
  if (!bean.price || !bean.capacity) return 0;

  // 提取数字
  const price = parseFloat(bean.price.replace(/[^\d.]/g, ''));
  const capacity = parseFloat(bean.capacity.replace(/[^\d.]/g, ''));

  if (isNaN(price) || isNaN(capacity) || capacity === 0) return 0;

  // 返回每克价格
  return price / capacity;
};

// 排序咖啡豆的函数
export const sortBeans = (
  beansToSort: CoffeeBean[],
  option: SortOption
): CoffeeBean[] => {
  const sorted = [...beansToSort];
  switch (option) {
    case SORT_OPTIONS.LAST_MODIFIED_DESC:
      // 最近变动排序（降序，最新的排在前面）
      return sorted.sort((a, b) => {
        // 使用 timestamp 字段作为最后修改时间
        // timestamp 越大，表示豆子越新
        return b.timestamp - a.timestamp;
      });
    case SORT_OPTIONS.LAST_MODIFIED_ASC:
      // 最早变动排序（升序，最早的排在前面）
      return sorted.sort((a, b) => {
        // 使用 timestamp 字段作为最后修改时间
        // timestamp 越小，表示豆子越早
        return a.timestamp - b.timestamp;
      });
    case SORT_OPTIONS.REMAINING_DAYS_ASC:
      // 使用统一的排序函数
      return sortBeansByFlavorPeriod(sorted);
    case SORT_OPTIONS.REMAINING_DAYS_DESC:
      // 使用统一的反向排序函数
      return sortBeansByFlavorPeriodReverse(sorted);
    case SORT_OPTIONS.NAME_ASC:
      return sorted.sort((a, b) => {
        // 安全地进行字符串比较（A → Z）
        const nameA = a.name || '';
        const nameB = b.name || '';
        return nameA.localeCompare(nameB);
      });
    case SORT_OPTIONS.NAME_DESC:
      return sorted.sort((a, b) => {
        // 安全地进行字符串比较（Z → A）
        const nameA = a.name || '';
        const nameB = b.name || '';
        return nameB.localeCompare(nameA);
      });
    case SORT_OPTIONS.RATING_ASC:
      return sorted.sort(
        (a, b) => (a.overallRating || 0) - (b.overallRating || 0)
      );
    case SORT_OPTIONS.RATING_DESC:
      return sorted.sort(
        (a, b) => (b.overallRating || 0) - (a.overallRating || 0)
      );
    case SORT_OPTIONS.REMAINING_AMOUNT_ASC:
      return sorted.sort((a, b) => {
        // 剩余量从少到多排序
        const remainingA = parseFloat(a.remaining || '0');
        const remainingB = parseFloat(b.remaining || '0');
        return remainingA - remainingB;
      });
    case SORT_OPTIONS.REMAINING_AMOUNT_DESC:
      return sorted.sort((a, b) => {
        // 剩余量从多到少排序
        const remainingA = parseFloat(a.remaining || '0');
        const remainingB = parseFloat(b.remaining || '0');
        return remainingB - remainingA;
      });
    case SORT_OPTIONS.ROAST_DATE_ASC:
      return sorted.sort((a, b) => {
        // 烘焙日期从早到晚排序
        // 处理无日期的情况
        if (!a.roastDate && !b.roastDate) return 0;
        if (!a.roastDate) return 1; // 无日期的排在后面
        if (!b.roastDate) return -1; // 无日期的排在后面

        // 使用日期工具函数解析日期
        const timeA = parseDateToTimestamp(a.roastDate);
        const timeB = parseDateToTimestamp(b.roastDate);

        // 检查解析结果是否有效
        if (isNaN(timeA) && isNaN(timeB)) return 0;
        if (isNaN(timeA)) return 1; // 无效日期排在后面
        if (isNaN(timeB)) return -1; // 无效日期排在后面

        return timeA - timeB;
      });
    case SORT_OPTIONS.ROAST_DATE_DESC:
      return sorted.sort((a, b) => {
        // 烘焙日期从晚到早排序
        // 处理无日期的情况
        if (!a.roastDate && !b.roastDate) return 0;
        if (!a.roastDate) return 1; // 无日期的排在后面
        if (!b.roastDate) return -1; // 无日期的排在后面

        // 使用日期工具函数解析日期
        const timeA = parseDateToTimestamp(a.roastDate);
        const timeB = parseDateToTimestamp(b.roastDate);

        // 检查解析结果是否有效
        if (isNaN(timeA) && isNaN(timeB)) return 0;
        if (isNaN(timeA)) return 1; // 无效日期排在后面
        if (isNaN(timeB)) return -1; // 无效日期排在后面

        return timeB - timeA;
      });
    case SORT_OPTIONS.PRICE_ASC:
      return sorted.sort((a, b) => {
        // 每克价格从低到高排序
        const pricePerGramA = calculatePricePerGram(a);
        const pricePerGramB = calculatePricePerGram(b);
        return pricePerGramA - pricePerGramB;
      });
    case SORT_OPTIONS.PRICE_DESC:
      return sorted.sort((a, b) => {
        // 每克价格从高到低排序
        const pricePerGramA = calculatePricePerGram(a);
        const pricePerGramB = calculatePricePerGram(b);
        return pricePerGramB - pricePerGramA;
      });
    default:
      return sorted;
  }
};

// 转换库存排序选项到榜单排序选项
export const convertToRankingSortOption = (
  option: SortOption,
  viewMode: 'inventory' | 'ranking' | 'blogger' | 'stats'
): RankingSortOption => {
  if (viewMode === 'blogger') {
    // 博主榜单视图的特殊处理
    switch (option) {
      case SORT_OPTIONS.REMAINING_DAYS_ASC:
        return RANKING_SORT_OPTIONS.ORIGINAL; // 在博主榜单视图中，第一个选项是原始排序
      case SORT_OPTIONS.REMAINING_DAYS_DESC:
        return RANKING_SORT_OPTIONS.RATING_DESC; // 评分降序
      case SORT_OPTIONS.RATING_ASC:
        return RANKING_SORT_OPTIONS.RATING_ASC; // 评分升序
      case SORT_OPTIONS.NAME_ASC:
        return RANKING_SORT_OPTIONS.NAME_ASC;
      case SORT_OPTIONS.NAME_DESC:
        return RANKING_SORT_OPTIONS.NAME_DESC;
      case SORT_OPTIONS.RATING_DESC:
        return RANKING_SORT_OPTIONS.RATING_DESC;
      case SORT_OPTIONS.ORIGINAL:
        return RANKING_SORT_OPTIONS.ORIGINAL;
      case SORT_OPTIONS.PRICE_ASC:
        return RANKING_SORT_OPTIONS.PRICE_ASC;
      case SORT_OPTIONS.PRICE_DESC:
        return RANKING_SORT_OPTIONS.PRICE_DESC;
      case SORT_OPTIONS.REMAINING_AMOUNT_ASC:
      case SORT_OPTIONS.REMAINING_AMOUNT_DESC:
      case SORT_OPTIONS.ROAST_DATE_ASC:
      case SORT_OPTIONS.ROAST_DATE_DESC:
      case SORT_OPTIONS.LAST_MODIFIED_ASC:
      case SORT_OPTIONS.LAST_MODIFIED_DESC:
        return RANKING_SORT_OPTIONS.ORIGINAL; // 默认使用原始排序
      default:
        return RANKING_SORT_OPTIONS.ORIGINAL;
    }
  } else {
    // 个人榜单视图
    switch (option) {
      case SORT_OPTIONS.NAME_ASC:
        return RANKING_SORT_OPTIONS.NAME_ASC;
      case SORT_OPTIONS.NAME_DESC:
        return RANKING_SORT_OPTIONS.NAME_DESC;
      case SORT_OPTIONS.REMAINING_DAYS_ASC:
      case SORT_OPTIONS.REMAINING_AMOUNT_ASC:
      case SORT_OPTIONS.ROAST_DATE_ASC:
        return RANKING_SORT_OPTIONS.RATING_DESC; // 评分从高到低
      case SORT_OPTIONS.REMAINING_DAYS_DESC:
      case SORT_OPTIONS.REMAINING_AMOUNT_DESC:
      case SORT_OPTIONS.ROAST_DATE_DESC:
        return RANKING_SORT_OPTIONS.RATING_ASC; // 评分从低到高
      case SORT_OPTIONS.RATING_ASC:
        return RANKING_SORT_OPTIONS.RATING_ASC;
      case SORT_OPTIONS.RATING_DESC:
        return RANKING_SORT_OPTIONS.RATING_DESC;
      case SORT_OPTIONS.PRICE_ASC:
        return RANKING_SORT_OPTIONS.RATING_DESC;
      case SORT_OPTIONS.PRICE_DESC:
        return RANKING_SORT_OPTIONS.RATING_ASC;
      case SORT_OPTIONS.LAST_MODIFIED_ASC:
        return RANKING_SORT_OPTIONS.RATING_DESC; // 最近变动升序，返回评分降序
      case SORT_OPTIONS.LAST_MODIFIED_DESC:
        return RANKING_SORT_OPTIONS.RATING_ASC; // 最近变动降序，返回评分升序
      case SORT_OPTIONS.ORIGINAL:
        return RANKING_SORT_OPTIONS.ORIGINAL;
      default:
        return RANKING_SORT_OPTIONS.RATING_DESC;
    }
  }
};

// 排序选项的显示名称
const SORT_LABELS: Record<SortOption, string> = {
  [SORT_OPTIONS.REMAINING_DAYS_ASC]: '赏味期',
  [SORT_OPTIONS.REMAINING_DAYS_DESC]: '赏味期',
  [SORT_OPTIONS.NAME_ASC]: '名称',
  [SORT_OPTIONS.NAME_DESC]: '名称',
  [SORT_OPTIONS.RATING_ASC]: '评分',
  [SORT_OPTIONS.RATING_DESC]: '评分',
  [SORT_OPTIONS.ORIGINAL]: '原始',
  [SORT_OPTIONS.REMAINING_AMOUNT_ASC]: '剩余量',
  [SORT_OPTIONS.REMAINING_AMOUNT_DESC]: '剩余量',
  [SORT_OPTIONS.ROAST_DATE_ASC]: '烘焙日期',
  [SORT_OPTIONS.ROAST_DATE_DESC]: '烘焙日期',
  [SORT_OPTIONS.PRICE_ASC]: '克价',
  [SORT_OPTIONS.PRICE_DESC]: '克价',
  [SORT_OPTIONS.LAST_MODIFIED_ASC]: '最近变动',
  [SORT_OPTIONS.LAST_MODIFIED_DESC]: '最近变动',
};

// 排序图标定义
const SORT_ICONS = {
  ASC: (
    <svg
      className="ml-1.5 h-3 w-3"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="4" y1="6" x2="11" y2="6" />
      <line x1="4" y1="12" x2="11" y2="12" />
      <line x1="4" y1="18" x2="13" y2="18" />
      <polyline points="15 9 18 6 21 9" />
      <line x1="18" y1="6" x2="18" y2="18" />
    </svg>
  ),
  DESC: (
    <svg
      className="ml-1.5 h-3 w-3"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="4" y1="6" x2="11" y2="6" />
      <line x1="4" y1="12" x2="11" y2="12" />
      <line x1="4" y1="18" x2="13" y2="18" />
      <polyline points="15 15 18 18 21 15" />
      <line x1="18" y1="6" x2="18" y2="18" />
    </svg>
  ),
  ORIGINAL: (
    <svg
      className="ml-1.5 h-3 w-3"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="4" y1="6" x2="11" y2="6" />
      <line x1="4" y1="12" x2="11" y2="12" />
      <line x1="4" y1="18" x2="13" y2="18" />
      <line x1="16" y1="6" x2="20" y2="6" />
      <line x1="16" y1="12" x2="20" y2="12" />
      <line x1="16" y1="18" x2="20" y2="18" />
    </svg>
  ),
};

// 排序方式定义
export const SORT_TYPES = {
  REMAINING_DAYS: 'remaining_days', // 赏味期
  NAME: 'name', // 名称
  RATING: 'rating', // 评分
  ORIGINAL: 'original', // 原始排序（仅用于博主榜单）
  REMAINING_AMOUNT: 'remaining_amount', // 剩余量
  ROAST_DATE: 'roast_date', // 烘焙日期
  PRICE: 'price', // 克价
  LAST_MODIFIED: 'last_modified', // 最近变动
} as const;

export type SortType = (typeof SORT_TYPES)[keyof typeof SORT_TYPES];

// 排序顺序定义
export const SORT_ORDERS = {
  ASC: 'asc',
  DESC: 'desc',
} as const;

export type SortOrder = (typeof SORT_ORDERS)[keyof typeof SORT_ORDERS];

// 排序方式的显示名称
export const SORT_TYPE_LABELS: Record<SortType, string> = {
  [SORT_TYPES.REMAINING_DAYS]: '赏味期',
  [SORT_TYPES.NAME]: '名称',
  [SORT_TYPES.RATING]: '评分',
  [SORT_TYPES.ORIGINAL]: '原始',
  [SORT_TYPES.REMAINING_AMOUNT]: '剩余量',
  [SORT_TYPES.ROAST_DATE]: '烘焙日期',
  [SORT_TYPES.PRICE]: '克价',
  [SORT_TYPES.LAST_MODIFIED]: '最近变动',
};

// 根据 beanState 获取排序方式的显示名称
export const getSortTypeLabelByState = (
  type: SortType,
  beanState: 'green' | 'roasted' = 'roasted'
): string => {
  // 生豆特殊处理
  if (beanState === 'green') {
    if (type === SORT_TYPES.ROAST_DATE) {
      return '购买日期';
    }
  }
  return SORT_TYPE_LABELS[type];
};

// 排序顺序的显示名称和图标
const SORT_ORDER_LABELS: Record<
  SortOrder,
  { label: string; icon: React.ReactNode }
> = {
  [SORT_ORDERS.ASC]: {
    label: '升序',
    icon: SORT_ICONS.DESC,
  },
  [SORT_ORDERS.DESC]: {
    label: '降序',
    icon: SORT_ICONS.ASC,
  },
};

// 获取排序类型对应的图标
const getSortOrderIcon = (
  type: SortType,
  order: SortOrder
): React.ReactNode => {
  // 对于名称排序，从A到Z使用箭头朝上图标，从Z到A使用箭头朝下图标
  if (type === SORT_TYPES.NAME) {
    return order === SORT_ORDERS.ASC ? SORT_ICONS.ASC : SORT_ICONS.DESC;
  }

  // 默认情况使用正常的映射（ASC 使用DESC图标，DESC使用ASC图标）
  return SORT_ORDER_LABELS[order].icon;
};

// 将排序选项转换为类型和顺序
export const getSortTypeAndOrder = (
  option: SortOption
): { type: SortType; order: SortOrder } => {
  switch (option) {
    case SORT_OPTIONS.REMAINING_DAYS_ASC:
      return { type: SORT_TYPES.REMAINING_DAYS, order: SORT_ORDERS.ASC };
    case SORT_OPTIONS.REMAINING_DAYS_DESC:
      return { type: SORT_TYPES.REMAINING_DAYS, order: SORT_ORDERS.DESC };
    case SORT_OPTIONS.NAME_ASC:
      return { type: SORT_TYPES.NAME, order: SORT_ORDERS.ASC };
    case SORT_OPTIONS.NAME_DESC:
      return { type: SORT_TYPES.NAME, order: SORT_ORDERS.DESC };
    case SORT_OPTIONS.RATING_ASC:
      return { type: SORT_TYPES.RATING, order: SORT_ORDERS.ASC };
    case SORT_OPTIONS.RATING_DESC:
      return { type: SORT_TYPES.RATING, order: SORT_ORDERS.DESC };
    case SORT_OPTIONS.ORIGINAL:
      return { type: SORT_TYPES.ORIGINAL, order: SORT_ORDERS.ASC };
    case SORT_OPTIONS.REMAINING_AMOUNT_ASC:
      return { type: SORT_TYPES.REMAINING_AMOUNT, order: SORT_ORDERS.ASC };
    case SORT_OPTIONS.REMAINING_AMOUNT_DESC:
      return { type: SORT_TYPES.REMAINING_AMOUNT, order: SORT_ORDERS.DESC };
    case SORT_OPTIONS.ROAST_DATE_ASC:
      return { type: SORT_TYPES.ROAST_DATE, order: SORT_ORDERS.ASC };
    case SORT_OPTIONS.ROAST_DATE_DESC:
      return { type: SORT_TYPES.ROAST_DATE, order: SORT_ORDERS.DESC };
    case SORT_OPTIONS.PRICE_ASC:
      return { type: SORT_TYPES.PRICE, order: SORT_ORDERS.ASC };
    case SORT_OPTIONS.PRICE_DESC:
      return { type: SORT_TYPES.PRICE, order: SORT_ORDERS.DESC };
    case SORT_OPTIONS.LAST_MODIFIED_ASC:
      return { type: SORT_TYPES.LAST_MODIFIED, order: SORT_ORDERS.ASC };
    case SORT_OPTIONS.LAST_MODIFIED_DESC:
      return { type: SORT_TYPES.LAST_MODIFIED, order: SORT_ORDERS.DESC };
    default:
      return { type: SORT_TYPES.REMAINING_DAYS, order: SORT_ORDERS.ASC };
  }
};

// 将类型和顺序转换为排序选项
export const getSortOption = (type: SortType, order: SortOrder): SortOption => {
  switch (type) {
    case SORT_TYPES.REMAINING_DAYS:
      return order === SORT_ORDERS.ASC
        ? SORT_OPTIONS.REMAINING_DAYS_ASC
        : SORT_OPTIONS.REMAINING_DAYS_DESC;
    case SORT_TYPES.NAME:
      return order === SORT_ORDERS.ASC
        ? SORT_OPTIONS.NAME_ASC
        : SORT_OPTIONS.NAME_DESC;
    case SORT_TYPES.RATING:
      return order === SORT_ORDERS.ASC
        ? SORT_OPTIONS.RATING_ASC
        : SORT_OPTIONS.RATING_DESC;
    case SORT_TYPES.ORIGINAL:
      return SORT_OPTIONS.ORIGINAL;
    case SORT_TYPES.REMAINING_AMOUNT:
      return order === SORT_ORDERS.ASC
        ? SORT_OPTIONS.REMAINING_AMOUNT_ASC
        : SORT_OPTIONS.REMAINING_AMOUNT_DESC;
    case SORT_TYPES.ROAST_DATE:
      return order === SORT_ORDERS.ASC
        ? SORT_OPTIONS.ROAST_DATE_ASC
        : SORT_OPTIONS.ROAST_DATE_DESC;
    case SORT_TYPES.PRICE:
      return order === SORT_ORDERS.ASC
        ? SORT_OPTIONS.PRICE_ASC
        : SORT_OPTIONS.PRICE_DESC;
    case SORT_TYPES.LAST_MODIFIED:
      return order === SORT_ORDERS.ASC
        ? SORT_OPTIONS.LAST_MODIFIED_ASC
        : SORT_OPTIONS.LAST_MODIFIED_DESC;
    default:
      return SORT_OPTIONS.REMAINING_DAYS_ASC;
  }
};

// 获取排序顺序的显示标签
export const getSortOrderLabel = (type: SortType, order: SortOrder): string => {
  if (type === SORT_TYPES.REMAINING_DAYS) {
    // 赏味期对应的排序顺序标签
    return order === SORT_ORDERS.ASC ? '从少到多' : '从多到少';
  } else if (type === SORT_TYPES.NAME) {
    // 名称对应的排序顺序标签
    return order === SORT_ORDERS.ASC ? '从A到Z' : '从Z到A';
  } else if (type === SORT_TYPES.RATING) {
    // 评分对应的排序顺序标签
    return order === SORT_ORDERS.ASC ? '从低到高' : '从高到低';
  } else if (type === SORT_TYPES.REMAINING_AMOUNT) {
    // 剩余量对应的排序顺序标签
    return order === SORT_ORDERS.ASC ? '从少到多' : '从多到少';
  } else if (type === SORT_TYPES.ROAST_DATE) {
    // 烘焙日期对应的排序顺序标签
    return order === SORT_ORDERS.ASC ? '从早到晚' : '从晚到早';
  } else if (type === SORT_TYPES.PRICE) {
    // 价格对应的排序顺序标签
    return order === SORT_ORDERS.ASC ? '从低到高' : '从高到低';
  } else if (type === SORT_TYPES.LAST_MODIFIED) {
    // 最近变动对应的排序顺序标签
    return order === SORT_ORDERS.ASC ? '从早到晚' : '从晚到早';
  }
  // 默认标签
  return order === SORT_ORDERS.ASC ? '升序' : '降序';
};

// 根据排序类型获取排序顺序的显示顺序
export const getSortOrdersForType = (type: SortType): SortOrder[] => {
  // 对于烘焙日期，从晚到早（DESC）更符合直觉（最近烘焙的豆子先显示）
  if (type === SORT_TYPES.ROAST_DATE) {
    return [SORT_ORDERS.DESC, SORT_ORDERS.ASC];
  }
  // 对于评分，从高到低（DESC）更符合直觉
  else if (type === SORT_TYPES.RATING) {
    return [SORT_ORDERS.DESC, SORT_ORDERS.ASC];
  }
  // 对于赏味期，从多到少（DESC）更符合直觉（剩余天数多的先显示）
  else if (type === SORT_TYPES.REMAINING_DAYS) {
    return [SORT_ORDERS.DESC, SORT_ORDERS.ASC];
  }
  // 对于剩余量，从多到少（DESC）更符合直觉
  else if (type === SORT_TYPES.REMAINING_AMOUNT) {
    return [SORT_ORDERS.DESC, SORT_ORDERS.ASC];
  }
  // 对于克价，从高到低（DESC）更符合直觉（通常先看更贵的豆子）
  else if (type === SORT_TYPES.PRICE) {
    return [SORT_ORDERS.DESC, SORT_ORDERS.ASC];
  }
  // 对于最近变动，从晚到早（DESC）更符合直觉（最近变动的豆子先显示）
  else if (type === SORT_TYPES.LAST_MODIFIED) {
    return [SORT_ORDERS.DESC, SORT_ORDERS.ASC];
  }
  // 对于名称，按字母顺序显示（A-Z为ASC，但图标使用向上箭头）
  else if (type === SORT_TYPES.NAME) {
    return [SORT_ORDERS.ASC, SORT_ORDERS.DESC];
  }
  // 默认顺序
  return [SORT_ORDERS.ASC, SORT_ORDERS.DESC];
};

// 根据视图模式和豆子状态获取可用的排序方式
export const getAvailableSortTypesForView = (
  viewMode: 'inventory' | 'ranking' | 'blogger' | 'stats',
  beanState: 'green' | 'roasted' = 'roasted'
) => {
  const isGreenBean = beanState === 'green';

  switch (viewMode) {
    case 'inventory':
      // 生豆不显示赏味期排序
      if (isGreenBean) {
        return [
          SORT_TYPES.LAST_MODIFIED,
          SORT_TYPES.ROAST_DATE, // 生豆显示为"购买日期"
          SORT_TYPES.REMAINING_AMOUNT,
          SORT_TYPES.PRICE,
        ];
      }
      return [
        SORT_TYPES.LAST_MODIFIED,
        SORT_TYPES.ROAST_DATE,
        SORT_TYPES.REMAINING_DAYS,
        SORT_TYPES.REMAINING_AMOUNT,
        SORT_TYPES.PRICE,
      ];
    case 'ranking':
      return [SORT_TYPES.RATING, SORT_TYPES.LAST_MODIFIED];
    case 'blogger':
      return [SORT_TYPES.ORIGINAL, SORT_TYPES.RATING, SORT_TYPES.PRICE];
    case 'stats':
      return [
        SORT_TYPES.REMAINING_DAYS,
        SORT_TYPES.REMAINING_AMOUNT,
        SORT_TYPES.ROAST_DATE,
        SORT_TYPES.PRICE,
        SORT_TYPES.LAST_MODIFIED,
      ];
    default:
      return [SORT_TYPES.REMAINING_DAYS, SORT_TYPES.LAST_MODIFIED];
  }
};

interface SortSelectorProps {
  viewMode: 'inventory' | 'ranking' | 'blogger' | 'stats';
  sortOption: SortOption;
  onSortChange: (value: SortOption) => void;
  showSelector?: boolean;
}

const SortSelector: React.FC<SortSelectorProps> = ({
  viewMode,
  sortOption,
  onSortChange,
  showSelector = true,
}) => {
  if (!showSelector) return null;

  const { type: currentType, order: currentOrder } =
    getSortTypeAndOrder(sortOption);

  // 处理排序方式变更
  const handleTypeChange = (newType: SortType) => {
    if (newType === SORT_TYPES.ORIGINAL) {
      onSortChange(SORT_OPTIONS.ORIGINAL);
    } else {
      // 保持当前的排序顺序
      onSortChange(getSortOption(newType, currentOrder));
    }
  };

  // 处理排序顺序变更
  const handleOrderChange = (newOrder: SortOrder) => {
    onSortChange(getSortOption(currentType, newOrder));
  };

  // 根据视图模式获取可用的排序方式
  const getAvailableSortTypes = (
    viewMode: 'inventory' | 'ranking' | 'blogger' | 'stats'
  ) => {
    return getAvailableSortTypesForView(viewMode);
  };

  // 根据排序类型判断是否显示排序顺序选项
  const shouldShowSortOrder = (type: SortType): boolean => {
    return type !== SORT_TYPES.ORIGINAL;
  };

  return (
    <Select value={sortOption} onValueChange={onSortChange}>
      <SelectTrigger
        variant="minimal"
        className="w-auto text-right tracking-wide text-neutral-800 transition-colors hover:opacity-80 dark:text-neutral-100"
      >
        <div className="flex w-full items-center justify-end">
          <span>{SORT_TYPE_LABELS[currentType]}</span>
          {currentType === SORT_TYPES.ORIGINAL
            ? SORT_ICONS.ORIGINAL
            : shouldShowSortOrder(currentType) &&
              getSortOrderIcon(currentType, currentOrder)}
        </div>
      </SelectTrigger>
      <SelectContent
        position="popper"
        sideOffset={5}
        className="min-w-[140px] overflow-hidden rounded-lg border-neutral-200/70 bg-white/95 shadow-lg backdrop-blur-xs dark:border-neutral-800/70 dark:bg-neutral-900/95"
      >
        <div className="py-1">
          <div className="px-2 py-1.5 text-xs text-neutral-500 dark:text-neutral-400">
            排序方式
          </div>
          {getAvailableSortTypes(viewMode).map(type => (
            <CustomSelectItem
              key={type}
              value={
                type === SORT_TYPES.ORIGINAL
                  ? SORT_OPTIONS.ORIGINAL
                  : getSortOption(type, currentOrder)
              }
              className="font-medium tracking-wide text-neutral-800 transition-colors data-highlighted:opacity-80 dark:text-neutral-100"
              onClick={() => handleTypeChange(type)}
            >
              <div className="flex items-center">
                <div className="mr-2 h-3 w-3">
                  {type === currentType && (
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M20 6L9 17L4 12" />
                    </svg>
                  )}
                </div>
                <span>{SORT_TYPE_LABELS[type]}</span>
              </div>
            </CustomSelectItem>
          ))}
        </div>
        {shouldShowSortOrder(currentType) && (
          <>
            <div className="border-t border-neutral-200 dark:border-neutral-800" />
            <div className="py-1">
              <div className="px-2 py-1.5 text-xs text-neutral-500 dark:text-neutral-400">
                排序顺序
              </div>
              {getSortOrdersForType(currentType).map(order => (
                <CustomSelectItem
                  key={order}
                  value={getSortOption(currentType, order)}
                  className="font-medium tracking-wide text-neutral-800 transition-colors data-highlighted:opacity-80 dark:text-neutral-100"
                  onClick={() => handleOrderChange(order)}
                >
                  <div className="flex items-center">
                    <div className="mr-2 h-3 w-3">
                      {order === currentOrder && (
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <path d="M20 6L9 17L4 12" />
                        </svg>
                      )}
                    </div>
                    <span>{getSortOrderLabel(currentType, order)}</span>
                    {getSortOrderIcon(currentType, order)}
                  </div>
                </CustomSelectItem>
              ))}
            </div>
          </>
        )}
      </SelectContent>
    </Select>
  );
};
