import { CoffeeBean } from '@/types/app';
import { EditableContent, PrintConfig } from './types';
import { parseDateToTimestamp } from '@/lib/utils/dateUtils';
import {
  formatBeanDisplayName,
  RoasterSettings,
} from '@/lib/utils/beanVarietyUtils';
import { TempFileManager } from '@/lib/utils/tempFileManager';

// 格式化日期
export const formatDate = (dateStr: string): string => {
  try {
    const timestamp = parseDateToTimestamp(dateStr);
    const date = new Date(timestamp);
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  } catch {
    return dateStr;
  }
};

// 提取品牌名（空格前的部分）
export const extractBrandName = (name: string, configBrand: string): string => {
  if (configBrand) return configBrand;
  if (!name) return '';
  const idx = name.indexOf(' ');
  return idx > 0 ? name.substring(0, idx) : '';
};

// 提取豆子名（去除品牌后）
export const extractBeanName = (name: string, configBrand: string): string => {
  if (!name) return '';
  if (configBrand) return name;
  const idx = name.indexOf(' ');
  return idx > 0 ? name.substring(idx + 1) : name;
};

// 生成风味行
export const getFlavorLine = (flavors: string[]): string =>
  flavors.filter(f => f.trim()).join(' / ');

// 生成底部信息行（简洁模板用）
export const getBottomInfoLine = (c: EditableContent): string => {
  const parts: string[] = [];
  if (c.weight) parts.push(`${c.weight}g`);
  if (c.roastDate) parts.push(formatDate(c.roastDate));
  if (c.process) parts.push(c.process);
  if (c.variety) parts.push(c.variety);
  if (c.origin) parts.push(c.origin);
  if (c.roastLevel) parts.push(c.roastLevel);
  if (c.notes) parts.push(c.notes);
  return parts.join(' / ');
};

// 计算预览尺寸
export const getPreviewDimensions = (config: PrintConfig) => {
  const isLandscape = config.orientation === 'landscape';
  return {
    width: isLandscape ? `${config.height}mm` : `${config.width}mm`,
    height: isLandscape ? `${config.width}mm` : `${config.height}mm`,
  };
};

// 从 bean 提取组件信息
const extractComponentInfo = (
  bean: CoffeeBean,
  field: 'origin' | 'process' | 'variety'
): string => {
  if (!bean.blendComponents?.length) return '';
  const values = new Set(
    bean.blendComponents
      .map(c => c[field])
      .filter((v): v is string => typeof v === 'string' && v.trim() !== '')
  );
  return Array.from(values).join(', ');
};

// 从 bean 创建初始内容
export const createInitialContent = (
  bean: CoffeeBean | null,
  roasterSettings: RoasterSettings
): EditableContent => {
  if (!bean) {
    return {
      name: '',
      origin: '',
      roastLevel: '',
      roastDate: '',
      process: '',
      variety: '',
      flavor: [],
      notes: '',
      weight: '',
    };
  }
  return {
    name: formatBeanDisplayName(bean, roasterSettings),
    origin: extractComponentInfo(bean, 'origin'),
    roastLevel: bean.roastLevel || '',
    roastDate: bean.roastDate || '',
    process: extractComponentInfo(bean, 'process'),
    variety: extractComponentInfo(bean, 'variety'),
    flavor: bean.flavor || [],
    notes: bean.notes || '',
    weight: '',
  };
};

// 保存预览为图片
export async function savePreviewAsImage(
  elementId: string,
  bean: CoffeeBean | null
): Promise<void> {
  const el = document.getElementById(elementId);
  if (!el) throw new Error('预览元素未找到');

  const { toPng } = await import('html-to-image');
  const dataUrl = await toPng(el, {
    backgroundColor: '#ffffff',
    pixelRatio: 6.37,
    quality: 0.95,
  });

  const { Capacitor } = await import('@capacitor/core');
  const { showToast } = await import('@/components/common/feedback/LightToast');

  if (Capacitor.isNativePlatform()) {
    try {
      await TempFileManager.saveImageToGallery(dataUrl);
      showToast({ type: 'success', title: '已保存到相册' });
    } catch (error) {
      console.error('保存到相册失败:', error);
      const fileName = `${bean?.name || '咖啡豆标签'}-${new Date().toISOString().split('T')[0]}`;
      await TempFileManager.shareImageFile(dataUrl, fileName, {
        title: '咖啡豆标签',
        text: `${bean?.name || '咖啡豆'}标签图片`,
        dialogTitle: '保存标签图片',
      });
    }
  } else {
    await TempFileManager.saveImageToGallery(dataUrl);
    showToast({ type: 'success', title: '图片已保存' });
  }
}
