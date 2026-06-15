export type TableColumnKey =
  | 'roaster'
  | 'name'
  | 'flavorPeriod'
  | 'capacity'
  | 'price'
  | 'beanType'
  | 'origin'
  | 'region'
  | 'estate'
  | 'lot'
  | 'batch'
  | 'station'
  | 'altitude'
  | 'season'
  | 'process'
  | 'variety'
  | 'agtron'
  | 'roastLevel'
  | 'flavor'
  | 'rating'
  | 'notes';

export type DateDisplayMode = 'date' | 'flavorPeriod' | 'agingDays';

export const getDateDisplayColumnLabel = (
  dateDisplayMode: DateDisplayMode,
  hasGreenBeans: boolean
): string => {
  if (hasGreenBeans) return '购买日期';

  switch (dateDisplayMode) {
    case 'flavorPeriod':
      return '赏味期';
    case 'agingDays':
      return '养豆天数';
    case 'date':
    default:
      return '日期';
  }
};

export const TABLE_COLUMN_CONFIG: {
  key: TableColumnKey;
  label: string;
  greenBeanLabel?: string;
  defaultVisible: boolean;
}[] = [
  { key: 'roaster', label: '烘焙商', defaultVisible: false },
  { key: 'name', label: '名称', defaultVisible: true },
  {
    key: 'flavorPeriod',
    label: '赏味期',
    greenBeanLabel: '购买日期',
    defaultVisible: true,
  },
  { key: 'capacity', label: '容量', defaultVisible: true },
  { key: 'price', label: '价格', defaultVisible: true },
  { key: 'beanType', label: '类型', defaultVisible: false },
  { key: 'origin', label: '产地', defaultVisible: false },
  { key: 'region', label: '产区', defaultVisible: false },
  { key: 'estate', label: '庄园', defaultVisible: false },
  { key: 'lot', label: '地块', defaultVisible: false },
  { key: 'batch', label: '批次', defaultVisible: false },
  { key: 'station', label: '处理站', defaultVisible: false },
  { key: 'altitude', label: '海拔', defaultVisible: false },
  { key: 'season', label: '产季', defaultVisible: false },
  { key: 'process', label: '处理法', defaultVisible: false },
  { key: 'variety', label: '品种', defaultVisible: false },
  { key: 'agtron', label: 'Agtron值', defaultVisible: false },
  { key: 'roastLevel', label: '烘焙度', defaultVisible: false },
  { key: 'flavor', label: '风味', defaultVisible: false },
  { key: 'rating', label: '评分', defaultVisible: false },
  { key: 'notes', label: '备注', defaultVisible: true },
];

export const getDefaultVisibleColumns = (): TableColumnKey[] =>
  TABLE_COLUMN_CONFIG.filter(c => c.defaultVisible).map(c => c.key);
