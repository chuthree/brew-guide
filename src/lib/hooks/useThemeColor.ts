/**
 * useThemeColor Hook & Utilities
 * 统一管理移动设备的 theme-color meta 标签
 * 解决安全区域颜色与半透明背景不匹配的问题
 */

import { useEffect } from 'react';
import { useTheme } from 'next-themes';

// 颜色配置 - 与 Tailwind 配置保持一致
export const THEME_COLORS = {
  light: {
    base: '#fafafa', // bg-neutral-50
    overlay: '#7D7D7D', // bg-black/50 在浅色背景上的混合效果
  },
  dark: {
    base: '#171717', // bg-neutral-900
    overlay: '#0B0B0B', // bg-black/50 在深色背景上的混合效果
  },
} as const;

interface UseThemeColorOptions {
  /** 是否使用叠加层颜色（用于半透明背景的弹窗） */
  useOverlay?: boolean;
  /** 组件是否已挂载/可见 */
  enabled?: boolean;
}

/**
 * 获取当前实际生效的主题（考虑系统主题）
 */
export const getResolvedTheme = (
  theme: string | undefined,
  systemTheme: string | undefined
): 'light' | 'dark' => {
  if (theme === 'system' || !theme) {
    return systemTheme === 'dark' ? 'dark' : 'light';
  }
  return theme as 'light' | 'dark';
};

/**
 * 更新 theme-color meta 标签（单个颜色）
 */
export const updateThemeColorMeta = (color: string) => {
  // 移除所有现有的 theme-color meta 标签
  const existingMetas = document.querySelectorAll('meta[name="theme-color"]');
  existingMetas.forEach(meta => meta.remove());

  // 创建新的 meta 标签
  const meta = document.createElement('meta');
  meta.name = 'theme-color';
  meta.content = color;
  document.head.appendChild(meta);
};

/**
 * 恢复默认的 theme-color（考虑当前主题）
 * 用于弹窗关闭或组件卸载时恢复正常状态
 */
export const restoreDefaultThemeColor = (
  theme: string | undefined,
  systemTheme: string | undefined
) => {
  // 移除所有现有的 theme-color meta 标签
  const existingMetas = document.querySelectorAll('meta[name="theme-color"]');
  existingMetas.forEach(meta => meta.remove());

  if (theme === 'system') {
    // 系统模式：创建两个带 media query 的 meta 标签
    const lightMeta = document.createElement('meta');
    lightMeta.name = 'theme-color';
    lightMeta.content = THEME_COLORS.light.base;
    lightMeta.media = '(prefers-color-scheme: light)';
    document.head.appendChild(lightMeta);

    const darkMeta = document.createElement('meta');
    darkMeta.name = 'theme-color';
    darkMeta.content = THEME_COLORS.dark.base;
    darkMeta.media = '(prefers-color-scheme: dark)';
    document.head.appendChild(darkMeta);
  } else {
    // 固定主题：创建单个 meta 标签
    const resolvedTheme = getResolvedTheme(theme, systemTheme);
    updateThemeColorMeta(THEME_COLORS[resolvedTheme].base);
  }
};

/**
 * Hook: 动态管理 theme-color
 *
 * @example
 * ```tsx
 * // 在底部弹窗组件中使用
 * const Modal = () => {
 *   const [isVisible, setIsVisible] = useState(false);
 *
 *   // 弹窗可见时使用叠加层颜色
 *   useThemeColor({
 *     useOverlay: true,
 *     enabled: isVisible
 *   });
 *
 *   return <div>...</div>;
 * };
 * ```
 */
export const useThemeColor = (options: UseThemeColorOptions = {}) => {
  const { useOverlay = false, enabled = true } = options;
  const { theme, systemTheme } = useTheme();

  useEffect(() => {
    // 仅在浏览器环境中执行
    if (typeof window === 'undefined') return;
    if (!enabled) return;

    const resolvedTheme = getResolvedTheme(theme, systemTheme);
    const targetColor = useOverlay
      ? THEME_COLORS[resolvedTheme].overlay
      : THEME_COLORS[resolvedTheme].base;

    // 应用目标颜色
    updateThemeColorMeta(targetColor);

    // 清理函数：恢复默认颜色
    return () => {
      restoreDefaultThemeColor(theme, systemTheme);
    };
  }, [theme, systemTheme, useOverlay, enabled]);
};
