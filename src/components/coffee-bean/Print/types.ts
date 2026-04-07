'use client';

import { CoffeeBean } from '@/types/app';

// 可编辑内容
export interface EditableContent {
  name: string;
  roaster: string;
  origin: string;
  estate: string;
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
    estate: boolean;
    roastLevel: boolean;
    roastDate: boolean;
    flavor: boolean;
    process: boolean;
    variety: boolean;
    notes: boolean;
    weight: boolean;
  };
  margin: number;
  fontSize: number;
  titleFontSize: number;
  fontWeight: number;
  template: 'minimal' | 'detailed';
}

export type PrintFieldKey = keyof PrintConfig['fields'];

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

// 模板选项
export const TEMPLATE_OPTIONS = [
  { id: 'minimal' as const, name: '简洁' },
  { id: 'detailed' as const, name: '详细' },
];
