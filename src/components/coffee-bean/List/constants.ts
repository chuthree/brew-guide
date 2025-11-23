// 视图模式定义 - 独立常量文件，避免循环依赖
export const VIEW_OPTIONS = {
  INVENTORY: 'inventory',
  RANKING: 'ranking',
  BLOGGER: 'blogger',
  STATS: 'stats',
} as const;

export type ViewOption = (typeof VIEW_OPTIONS)[keyof typeof VIEW_OPTIONS];

// 视图选项的显示名称
export const VIEW_LABELS: Record<ViewOption, string> = {
  [VIEW_OPTIONS.INVENTORY]: '咖啡豆库存',
  [VIEW_OPTIONS.RANKING]: '个人榜单',
  [VIEW_OPTIONS.BLOGGER]: '博主榜单',
  [VIEW_OPTIONS.STATS]: '统计视图',
};
