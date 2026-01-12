'use client';

import { CoffeeBean } from '@/types/app';

// 可编辑内容
export interface EditableContent {
  name: string;
  origin: string;
  roastLevel: string;
  roastDate: string;
  process: string;
  variety: string;
  flavor: string[];
  notes: string;
  weight: string;
}

// 打印配置
export interface PrintConfig {
  width: number;
  height: number;
  orientation: 'landscape' | 'portrait';
  fields: {
    name: boolean;
    origin: boolean;
    roastLevel: boolean;
    roastDate: boolean;
    flavor: boolean;
    process: boolean;
    variety: boolean;
    notes: boolean;
  };
  margin: number;
  fontSize: number;
  titleFontSize: number;
  fontWeight: number;
  template: 'minimal' | 'detailed';
  brandName: string;
}

// 预设尺寸
export interface PresetSize {
  label: string;
  width: number;
  height: number;
}

// Modal Props
export interface BeanPrintModalProps {
  isOpen: boolean;
  bean: CoffeeBean | null;
  onClose: () => void;
}

// 模板 Props
export interface TemplateProps {
  config: PrintConfig;
  content: EditableContent;
  formattedDate: string;
}

// 字段顺序和标签（统一顺序：名称→日期→产地→处理法→品种→烘焙度→风味→备注）
export const FIELD_ORDER: (keyof PrintConfig['fields'])[] = [
  'name',
  'roastDate',
  'origin',
  'process',
  'variety',
  'roastLevel',
  'flavor',
  'notes',
];

export const FIELD_LABELS: Record<keyof PrintConfig['fields'], string> = {
  name: '名称',
  roastDate: '日期',
  origin: '产地',
  process: '处理法',
  variety: '品种',
  roastLevel: '烘焙',
  flavor: '风味',
  notes: '备注',
};

// 模板选项
export const TEMPLATE_OPTIONS = [
  { id: 'minimal' as const, name: '简洁' },
  { id: 'detailed' as const, name: '详细' },
];
