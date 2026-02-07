import { CoffeeBean } from '@/types/app';
import { EditableContent, PrintConfig } from './types';
import { parseDateToTimestamp } from '@/lib/utils/dateUtils';
import {
  formatBeanDisplayName,
  getBeanEstates,
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
      estate: '',
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
    estate: getBeanEstates(bean).join(', '),
    roastLevel: bean.roastLevel || '',
    roastDate: bean.roastDate || '',
    process: extractComponentInfo(bean, 'process'),
    variety: extractComponentInfo(bean, 'variety'),
    flavor: bean.flavor || [],
    notes: bean.notes || '',
    weight: '',
  };
};

// 等待字体加载完成
const waitForFonts = async (): Promise<void> => {
  if (typeof document === 'undefined') return;
  try {
    // 等待所有字体加载，最多等待 2 秒
    await Promise.race([
      document.fonts.ready,
      new Promise(resolve => setTimeout(resolve, 2000)),
    ]);
  } catch {
    // 字体加载 API 不支持时忽略
  }
};

// 将 Tailwind 类名转换为内联样式的映射表
// 这确保了在所有设备上样式的一致性
const inlineStylesFromClasses = (element: HTMLElement): void => {
  const classMap: Record<string, Partial<CSSStyleDeclaration>> = {
    // Flex 布局
    flex: { display: 'flex' },
    'flex-col': { flexDirection: 'column' },
    'flex-1': { flex: '1 1 0%' },
    'flex-wrap': { flexWrap: 'wrap' },
    'content-start': { alignContent: 'flex-start' },
    'justify-between': { justifyContent: 'space-between' },
    'h-full': { height: '100%' },
    'w-full': { width: '100%' },
    // 间距
    'space-y-1': { gap: '0.25rem' },
    'gap-1': { gap: '0.25rem' },
    'mb-1': { marginBottom: '0.25rem' },
    'mb-1.5': { marginBottom: '0.375rem' },
    'mt-1': { marginTop: '0.25rem' },
    'pb-1': { paddingBottom: '0.25rem' },
    // 文本
    'text-center': { textAlign: 'center' },
    'overflow-hidden': { overflow: 'hidden' },
    'shrink-0': { flexShrink: '0' },
  };

  // 递归处理所有子元素
  const processElement = (el: HTMLElement) => {
    if (el.classList) {
      el.classList.forEach(className => {
        const styles = classMap[className];
        if (styles) {
          Object.assign(el.style, styles);
        }
      });
    }
    // 处理子元素
    Array.from(el.children).forEach(child => {
      if (child instanceof HTMLElement) {
        processElement(child);
      }
    });
  };

  processElement(element);
};

// 归一化文本节点空白，避免导出时意外换行
const normalizeTextNodes = (element: HTMLElement): void => {
  if (typeof document === 'undefined') return;
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node) {
    if (node.nodeValue) {
      const normalized = node.nodeValue.replace(/[\t\r\n]+/g, ' ');
      if (normalized !== node.nodeValue) {
        node.nodeValue = normalized;
      }
    }
    node = walker.nextNode();
  }
};

// 保存预览为图片
export async function savePreviewAsImage(
  elementId: string,
  bean: CoffeeBean | null
): Promise<void> {
  const el = document.getElementById(elementId);
  if (!el) throw new Error('预览元素未找到');

  // 1. 等待字体加载完成
  await waitForFonts();

  // 2. 等待浏览器渲染完成
  await new Promise(resolve => requestAnimationFrame(resolve));
  await new Promise(resolve => setTimeout(resolve, 100));

  // 3. 克隆元素以避免修改原始 DOM
  const clonedEl = el.cloneNode(true) as HTMLElement;

  // 4. 将 Tailwind 类名转换为内联样式，确保跨设备一致性
  inlineStylesFromClasses(clonedEl);

  // 5. 复制原始元素的计算样式到克隆元素
  const computedStyle = window.getComputedStyle(el);
  clonedEl.style.width = computedStyle.width;
  clonedEl.style.height = computedStyle.height;
  clonedEl.style.padding = computedStyle.padding;
  clonedEl.style.fontSize = computedStyle.fontSize;
  clonedEl.style.fontWeight = computedStyle.fontWeight;
  clonedEl.style.fontFamily = computedStyle.fontFamily;
  clonedEl.style.lineHeight = computedStyle.lineHeight;
  clonedEl.style.letterSpacing = computedStyle.letterSpacing;
  clonedEl.style.wordBreak = computedStyle.wordBreak;
  clonedEl.style.whiteSpace = 'normal';
  clonedEl.style.backgroundColor = '#ffffff';
  clonedEl.style.color = '#000000';

  // 5.1 归一化文本节点空白，避免导出时因隐藏换行导致提前换行
  normalizeTextNodes(clonedEl);

  // 6. 创建离屏容器
  const offscreenContainer = document.createElement('div');
  offscreenContainer.style.cssText = `
    position: fixed;
    top: -9999px;
    left: -9999px;
    z-index: -1;
    pointer-events: none;
    visibility: visible;
  `;
  offscreenContainer.appendChild(clonedEl);
  document.body.appendChild(offscreenContainer);

  // 7. 再次等待渲染
  await new Promise(resolve => requestAnimationFrame(resolve));
  await new Promise(resolve => setTimeout(resolve, 50));

  try {
    const { toPng } = await import('html-to-image');
    const dataUrl = await toPng(clonedEl, {
      backgroundColor: '#ffffff',
      pixelRatio: 6.37,
      quality: 0.95,
      // 跳过隐藏元素
      filter: node => {
        if (node instanceof HTMLElement) {
          const style = getComputedStyle(node);
          if (style.display === 'none' || style.visibility === 'hidden') {
            return false;
          }
        }
        return true;
      },
      // 确保样式被正确捕获
      style: {
        transform: 'none',
      },
    });

    // 清理离屏容器
    document.body.removeChild(offscreenContainer);

    const { Capacitor } = await import('@capacitor/core');
    const { showToast } =
      await import('@/components/common/feedback/LightToast');

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
  } catch (error) {
    // 确保清理离屏容器
    if (document.body.contains(offscreenContainer)) {
      document.body.removeChild(offscreenContainer);
    }
    throw error;
  }
}
