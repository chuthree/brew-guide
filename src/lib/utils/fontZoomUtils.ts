'use client';

/**
 * 网页版字体缩放工具
 * 使用 CSS 自定义属性实现字体大小的动态调整
 */

/**
 * 检查字体缩放功能是否可用
 * 现在统一使用 CSS 方案，在所有环境中都可用
 * @returns 返回是否支持字体缩放功能
 */
export const isFontZoomAvailable = (): boolean => {
  return typeof window !== 'undefined';
};

/**
 * 获取当前字体缩放级别
 * @returns 返回当前字体缩放比例，默认为1.0
 */
export const getFontZoom = (): number => {
  if (typeof window === 'undefined') return 1.0;

  try {
    // 从 localStorage 获取保存的缩放级别
    const savedZoom = localStorage.getItem('fontZoomLevel');
    if (savedZoom) {
      const zoomLevel = parseFloat(savedZoom);
      return isNaN(zoomLevel) ? 1.0 : Math.min(Math.max(zoomLevel, 0.8), 1.4);
    }

    // 从 CSS 变量获取当前值
    const rootStyle = getComputedStyle(document.documentElement);
    const currentScale = rootStyle.getPropertyValue('--font-scale').trim();
    if (currentScale) {
      const scale = parseFloat(currentScale);
      return isNaN(scale) ? 1.0 : scale;
    }

    return 1.0;
  } catch {
    return 1.0;
  }
};

/**
 * 设置字体缩放级别
 * @param value 缩放级别，范围0.8-1.4，1.0为标准大小
 */
export const setFontZoom = (value: number): void => {
  if (typeof window === 'undefined') return;

  try {
    // 确保缩放值在合理范围内
    const safeValue = Math.min(Math.max(value, 0.8), 1.4);

    // 设置 CSS 变量
    document.documentElement.style.setProperty(
      '--font-scale',
      safeValue.toString()
    );

    // 保存到 localStorage
    localStorage.setItem('fontZoomLevel', safeValue.toString());

    // 触发自定义事件，通知其他组件字体大小已改变
    window.dispatchEvent(
      new CustomEvent('fontZoomChange', {
        detail: { zoomLevel: safeValue },
      })
    );
  } catch (error) {
    // Log warning in development only
    if (process.env.NODE_ENV === 'development') {
      console.warn('Failed to set font zoom:', error);
    }
  }
};

/**
 * 初始化字体缩放
 * 从存储中恢复之前保存的缩放级别
 */
export const initFontZoom = (): void => {
  if (typeof window === 'undefined') return;

  try {
    const savedZoom = getFontZoom();
    if (savedZoom !== 1.0) {
      setFontZoom(savedZoom);
    }
  } catch (error) {
    console.warn('Failed to initialize font zoom:', error);
  }
};

/**
 * 重置字体缩放到默认值
 */
export const resetFontZoom = (): void => {
  setFontZoom(1.0);
};

/**
 * 获取字体缩放的显示文本
 * @param zoomLevel 缩放级别
 * @returns 格式化的显示文本
 */
export const getZoomDisplayText = (zoomLevel: number): string => {
  if (zoomLevel < 0.9) return '小';
  if (zoomLevel > 1.1) return '大';
  return '标准';
};

// 导出默认对象
const fontZoomUtils = {
  isAvailable: isFontZoomAvailable,
  get: getFontZoom,
  set: setFontZoom,
  init: initFontZoom,
  reset: resetFontZoom,
  getDisplayText: getZoomDisplayText,
};

export default fontZoomUtils;
