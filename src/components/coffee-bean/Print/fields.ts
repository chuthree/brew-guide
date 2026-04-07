import { EditableContent, PrintConfig, PrintFieldKey } from './types';

export type PrintTextFieldKey = Exclude<
  keyof EditableContent,
  'roaster' | 'roastDate' | 'flavor' | 'notes'
>;

export const PRINT_FIELD_ORDER: PrintFieldKey[] = [
  'name',
  'roastDate',
  'origin',
  'estate',
  'process',
  'variety',
  'roastLevel',
  'flavor',
  'weight',
  'notes',
];

export const PRINT_FIELD_LABELS: Record<PrintFieldKey, string> = {
  name: '名称',
  roastDate: '日期',
  origin: '产地',
  estate: '庄园',
  process: '处理',
  variety: '品种',
  roastLevel: '烘焙',
  flavor: '风味',
  weight: '克重',
  notes: '备注',
};

export const PRINT_EDITOR_FIELD_LABELS: Record<PrintFieldKey, string> = {
  name: '名称',
  roastDate: '烘焙日期',
  origin: '产地',
  estate: '庄园',
  process: '处理法',
  variety: '品种',
  roastLevel: '烘焙度',
  flavor: '风味',
  weight: '克重',
  notes: '备注',
};

export const PRINT_TEXT_FIELD_PLACEHOLDERS: Record<PrintTextFieldKey, string> = {
  name: '例如：野草莓',
  origin: '产地信息',
  estate: '庄园信息',
  roastLevel: '烘焙度',
  process: '例如：水洗、日晒',
  variety: '例如：卡杜拉、瑰夏',
  weight: '例如：250',
};

const hasValue = (value: string): boolean => value.trim().length > 0;

export const hasPrintFieldContent = (
  field: PrintFieldKey,
  content: EditableContent,
  template: PrintConfig['template']
): boolean => {
  switch (field) {
    case 'name': {
      const beanName = content.name.trim();
      if (template === 'minimal') {
        return beanName.length > 0;
      }
      return beanName.length > 0 || content.roaster.trim().length > 0;
    }
    case 'flavor':
      return content.flavor.some(item => item.trim().length > 0);
    case 'roastDate':
      return hasValue(content.roastDate);
    case 'origin':
      return hasValue(content.origin);
    case 'estate':
      return hasValue(content.estate);
    case 'process':
      return hasValue(content.process);
    case 'variety':
      return hasValue(content.variety);
    case 'roastLevel':
      return hasValue(content.roastLevel);
    case 'weight':
      return hasValue(content.weight);
    case 'notes':
      return hasValue(content.notes);
    default:
      return false;
  }
};

export const isPrintFieldVisible = (
  field: PrintFieldKey,
  config: PrintConfig,
  content: EditableContent
): boolean => config.fields[field] && hasPrintFieldContent(field, content, config.template);
