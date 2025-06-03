import type { BrewingNote } from '@/lib/core/config'
import type { BrewingNoteData, CoffeeBean } from '@/types/app'

// 排序类型定义
export const SORT_OPTIONS = {
    TIME_DESC: 'time_desc',
    TIME_ASC: 'time_asc',
    RATING_DESC: 'rating_desc',
    RATING_ASC: 'rating_asc',
} as const;

export type SortOption = typeof SORT_OPTIONS[keyof typeof SORT_OPTIONS];

// 排序选项的显示名称
export const SORT_LABELS: Record<SortOption, string> = {
    [SORT_OPTIONS.TIME_DESC]: '时间',
    [SORT_OPTIONS.TIME_ASC]: '时间',
    [SORT_OPTIONS.RATING_DESC]: '评分',
    [SORT_OPTIONS.RATING_ASC]: '评分',
};

// 消息提示状态接口
export interface ToastState {
    visible: boolean;
    message: string;
    type: 'success' | 'error' | 'info';
}

// 笔记历史组件属性
export interface BrewingHistoryProps {
    isOpen: boolean
    onClose: () => void
    onAddNote?: () => void
    setAlternativeHeaderContent?: (content: React.ReactNode | null) => void
    setShowAlternativeHeader?: (show: boolean) => void
}

// 单个笔记项属性
export interface NoteItemProps {
    note: BrewingNote
    equipmentNames: Record<string, string>
    onEdit: (note: BrewingNote) => void
    onDelete: (noteId: string) => void
    unitPriceCache: Record<string, number>
    isShareMode?: boolean
    isSelected?: boolean
    onToggleSelect?: (noteId: string, enterShareMode?: boolean) => void
}

// 排序选择器属性
export interface SortSelectorProps {
    sortOption: SortOption
    onSortChange: (option: SortOption) => void
}

// 筛选标签页属性
export interface FilterTabsProps {
    filterMode: 'equipment' | 'bean'
    selectedEquipment: string | null
    selectedBean: string | null
    availableEquipments: string[]
    availableBeans: string[]
    equipmentNames: Record<string, string>
    onFilterModeChange: (mode: 'equipment' | 'bean') => void
    onEquipmentClick: (equipment: string | null) => void
    onBeanClick: (bean: string | null) => void
    isSearching?: boolean
    searchQuery?: string
    onSearchClick?: () => void
    onSearchChange?: (e: React.ChangeEvent<HTMLInputElement>) => void
    onSearchKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void
    // 新增排序相关props
    sortOption?: SortOption
    onSortChange?: (option: SortOption) => void
}

// 添加笔记按钮属性
export interface AddNoteButtonProps {
    onAddNote: () => void
}

// 分享笔记按钮属性
export interface ShareButtonsProps {
    selectedNotes: BrewingNote[]
    onCancel: () => void
    onSave: () => void
}

// 消息提示组件属性
export interface ToastProps {
    visible: boolean
    message: string
    type: 'success' | 'error' | 'info'
}

// 编辑笔记数据类型
export interface EditingNoteData extends Partial<BrewingNoteData> {
    coffeeBean?: CoffeeBean | null
} 