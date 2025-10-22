/**
 * 浏览器兼容性检测工具
 * 用于检测当前浏览器是否支持Tailwind CSS v4所需的现代CSS特性
 */

/**
 * 检测浏览器是否支持现代CSS特性
 * @returns 是否支持
 */
export const isModernBrowser = (): boolean => {
  // 检测是否支持oklch颜色空间
  const supportsOklch = CSS.supports?.('color: oklch(0 0 0)') ?? false;

  // 检测是否支持CSS属性注册
  const supportsProperty = typeof CSSPropertyRule !== 'undefined';

  // 检测是否支持CSS层叠层（cascade layers）
  const supportsLayers = CSS.supports?.('@layer base {}') ?? false;

  // 返回是否支持所有特性
  return supportsOklch && (supportsProperty || supportsLayers);
};

/**
 * 添加浏览器兼容性类到文档根元素
 * 可用于在CSS中为不同浏览器提供不同的样式
 */
export const addBrowserCompatClass = (): void => {
  if (typeof document !== 'undefined') {
    const isModern = isModernBrowser();
    document.documentElement.classList.add(
      isModern ? 'modern-browser' : 'legacy-browser'
    );

    // 对于非现代浏览器，使用替代颜色方案
    if (!isModern) {
      // 使用简单的配色方案，避免使用不支持的CSS特性
      document.documentElement.style.setProperty('--legacy-mode', '1');
    }
  }
};

/**
 * 初始化浏览器兼容性检测
 */
export const initBrowserCompat = (): void => {
  addBrowserCompatClass();
};

export default initBrowserCompat;
