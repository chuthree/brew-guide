import type { BrewingNote } from '@/lib/core/config';
import type { BrewingNoteData, CoffeeBean } from '@/types/app';

// 排序类型定义
export const SORT_OPTIONS = {
  TIME_DESC: 'time_desc',
  TIME_ASC: 'time_asc',
  RATING_DESC: 'rating_desc',
  RATING_ASC: 'rating_asc',
  // 搜索排序选项
  EXTRACTION_TIME_DESC: 'extraction_time_desc',
  EXTRACTION_TIME_ASC: 'extraction_time_asc',
} as const;

export type SortOption = (typeof SORT_OPTIONS)[keyof typeof SORT_OPTIONS];

// 日期分组粒度类型
export type DateGroupingMode = 'year' | 'month' | 'day';

// 日期分组粒度的显示名称
export const DATE_GROUPING_LABELS: Record<DateGroupingMode, string> = {
  year: '按年',
  month: '按月',
  day: '按日',
};

// 排序选项的显示名称
const SORT_LABELS: Record<SortOption, string> = {
  [SORT_OPTIONS.TIME_DESC]: '时间',
  [SORT_OPTIONS.TIME_ASC]: '时间',
  [SORT_OPTIONS.RATING_DESC]: '评分',
  [SORT_OPTIONS.RATING_ASC]: '评分',
  [SORT_OPTIONS.EXTRACTION_TIME_DESC]: '萃取时间',
  [SORT_OPTIONS.EXTRACTION_TIME_ASC]: '萃取时间',
};

// 消息提示状态接口
interface ToastState {
  visible: boolean;
  message: string;
  type: 'success' | 'error' | 'info';
}

// 笔记历史组件属性
export interface BrewingHistoryProps {
  isOpen: boolean;
  onClose: () => void;
  onAddNote?: () => void;
  setAlternativeHeaderContent?: (content: React.ReactNode | null) => void;
  setShowAlternativeHeader?: (show: boolean) => void;
  settings?: import('@/components/settings/Settings').SettingsOptions; // 添加可选的设置参数
}

// 单个笔记项属性
export interface NoteItemProps {
  note: BrewingNote;
  equipmentNames: Record<string, string>;
  onEdit: (note: BrewingNote) => void;
  onDelete: (noteId: string) => void;
  onCopy?: (noteId: string) => void;
  unitPriceCache: Record<string, number>;
  isShareMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: (noteId: string, enterShareMode?: boolean) => void;
  // 是否为列表中的最后一项（用于虚拟化下控制分割线）
  isLast?: boolean;
  // 评分维度评分处理函数（从父组件传入，避免每个子组件重复调用）
  getValidTasteRatings?: (
    taste: Record<string, number>
  ) => Array<{ id: string; label: string; value: number }>;
  // 咖啡豆列表（用于获取完整的咖啡豆信息，包括图片）
  coffeeBeans?: CoffeeBean[];
}

// 筛选标签页属性
export interface FilterTabsProps {
  filterMode: 'equipment' | 'date';
  selectedEquipment: string | null;
  selectedDate: string | null;
  dateGroupingMode: DateGroupingMode;
  availableEquipments: string[];
  availableDates: string[];
  equipmentNames: Record<string, string>;
  onFilterModeChange: (mode: 'equipment' | 'date') => void;
  onEquipmentClick: (equipment: string | null) => void;
  onDateClick: (date: string | null) => void;
  onDateGroupingModeChange: (mode: DateGroupingMode) => void;
  isSearching?: boolean;
  searchQuery?: string;
  onSearchClick?: () => void;
  onSearchChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSearchKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  // 新增排序相关props
  sortOption?: SortOption;
  onSortChange?: (option: SortOption) => void;
  // 新增显示模式相关props
  viewMode?: 'list' | 'gallery';
  onViewModeChange?: (mode: 'list' | 'gallery') => void;
  // 新增图片流模式相关props
  isImageFlowMode?: boolean;
  onToggleImageFlowMode?: () => void;
  // 新增带日期图片流模式相关props
  isDateImageFlowMode?: boolean;
  onToggleDateImageFlowMode?: () => void;
  // 智能切换图片流模式（用于双击"全部"）
  onSmartToggleImageFlow?: () => void;
  // 是否有图片笔记（用于禁用/启用图片流按钮）
  hasImageNotes?: boolean;
  // 新增设置参数（用于搜索排序功能）
  settings?: import('@/components/settings/Settings').SettingsOptions;
  // 搜索结果中是否包含萃取时间数据
  hasExtractionTimeData?: boolean;
  // 搜索排序相关props - 独立于普通排序
  searchSortOption?: SortOption;
  onSearchSortChange?: (option: SortOption | null) => void;
  // 搜索历史相关props
  searchHistory?: string[];
  onSearchHistoryClick?: (query: string) => void;
  // 笔记显示样式相关props
  noteDisplayStyle?: 'list' | 'card';
  onNoteDisplayStyleChange?: (style: 'list' | 'card') => void;
}

// 添加笔记按钮属性
export interface AddNoteButtonProps {
  onAddNote: () => void;
}

// 分享笔记按钮属性
interface ShareButtonsProps {
  selectedNotes: BrewingNote[];
  onCancel: () => void;
  onSave: () => void;
}

// 消息提示组件属性
export interface ToastProps {
  visible: boolean;
  message: string;
  type: 'success' | 'error' | 'info';
}

// 编辑笔记数据类型
interface EditingNoteData extends Partial<BrewingNoteData> {
  coffeeBean?: CoffeeBean | null;
}
