'use client';

import React from 'react';
import { ChevronLeft } from 'lucide-react';
import { SettingsOptions } from './Settings';
import { useTheme } from 'next-themes';
import fontZoomUtils from '@/lib/utils/fontZoomUtils';
import hapticsUtils from '@/lib/ui/haptics';
import { ButtonGroup } from '@/components/ui/ButtonGroup';
import { getChildPageStyle } from '@/lib/navigation/pageTransition';
import { useModalHistory, modalHistory } from '@/lib/hooks/useModalHistory';

interface DisplaySettingsProps {
  settings: SettingsOptions;
  onClose: () => void;
  handleChange: <K extends keyof SettingsOptions>(
    key: K,
    value: SettingsOptions[K]
  ) => void | Promise<void>;
}

const DisplaySettings: React.FC<DisplaySettingsProps> = ({
  settings,
  onClose,
  handleChange,
}) => {
  const { theme, setTheme } = useTheme();
  const [zoomLevel, setZoomLevel] = React.useState(
    settings.textZoomLevel || 1.0
  );
  const [isFontZoomEnabled, setIsFontZoomEnabled] = React.useState(false);

  // 控制动画状态
  const [shouldRender, setShouldRender] = React.useState(true);
  const [isVisible, setIsVisible] = React.useState(false);

  // 用于保存最新的 onClose 引用
  const onCloseRef = React.useRef(onClose);
  onCloseRef.current = onClose;

  // 关闭处理函数（带动画）
  const handleCloseWithAnimation = React.useCallback(() => {
    // 立即触发退出动画
    setIsVisible(false);

    // 立即通知父组件子设置正在关闭（用于同步 Settings 的恢复动画）
    window.dispatchEvent(new CustomEvent('subSettingsClosing'));

    // 等待动画完成后真正关闭
    setTimeout(() => {
      onCloseRef.current();
    }, 350); // 与 IOS_TRANSITION_CONFIG.duration 一致
  }, []);

  // 使用统一的历史栈管理系统
  // 注意：onClose 回调会在 popstate 时触发，我们需要在这里处理动画
  useModalHistory({
    id: 'display-settings',
    isOpen: true, // 子设置页面挂载即为打开状态
    onClose: handleCloseWithAnimation, // 使用带动画的关闭函数
  });

  // UI 返回按钮点击处理
  const handleClose = () => {
    // 调用 modalHistory.back() 会触发 popstate，进而调用 handleCloseWithAnimation
    modalHistory.back();
  };

  // 处理显示/隐藏动画（入场动画）
  React.useEffect(() => {
    // 使用 requestAnimationFrame 确保 DOM 已渲染，比 setTimeout 更快更流畅
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setIsVisible(true);
      });
    });
  }, []);

  // 检查字体缩放功能是否可用
  React.useEffect(() => {
    setIsFontZoomEnabled(fontZoomUtils.isAvailable());
  }, []);

  // 监控主题变化
  React.useEffect(() => {
    // Theme change effect
  }, [theme]);

  // 处理字体缩放变更
  const handleFontZoomChange = async (newValue: number) => {
    setZoomLevel(newValue);
    fontZoomUtils.set(newValue);
    await handleChange('textZoomLevel', newValue);

    // 触发震动反馈
    if (settings.hapticFeedback) {
      hapticsUtils.light();
    }
  };

  if (!shouldRender) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 mx-auto flex max-w-[500px] flex-col bg-neutral-50 dark:bg-neutral-900"
      style={getChildPageStyle(isVisible)}
    >
      {/* 头部导航栏 */}
      <div className="pt-safe-top relative flex items-center justify-center py-4">
        <button
          onClick={handleClose}
          className="absolute left-4 flex h-10 w-10 items-center justify-center rounded-full text-neutral-700 dark:text-neutral-300"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <h2 className="text-md font-medium text-neutral-800 dark:text-neutral-200">
          显示设置
        </h2>
      </div>

      {/* 滚动内容区域 */}
      <div className="pb-safe-bottom relative flex-1 overflow-y-auto">
        {/* 顶部渐变阴影 */}
        <div className="pointer-events-none sticky top-0 z-10 h-12 w-full bg-linear-to-b from-neutral-50 to-transparent first:border-b-0 dark:from-neutral-900"></div>

        {/* 外观设置组 */}
        <div className="-mt-4 px-6 py-4">
          <h3 className="mb-3 text-sm font-medium tracking-wider text-neutral-500 uppercase dark:text-neutral-400">
            外观
          </h3>
          <div className="space-y-4 rounded-lg bg-neutral-100 p-4 dark:bg-neutral-800">
            {/* 外观模式 */}
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
                外观模式
              </span>
              <ButtonGroup
                value={theme || 'system'}
                options={[
                  { value: 'light', label: '浅色' },
                  { value: 'dark', label: '深色' },
                  { value: 'system', label: '系统' },
                ]}
                onChange={(value: string) => {
                  setTheme(value);
                  if (settings.hapticFeedback) {
                    hapticsUtils.light();
                  }
                }}
              />
            </div>

            {/* 字体缩放设置 */}
            {isFontZoomEnabled && (
              <>
                <div className="border-t border-neutral-200 pt-4 dark:border-neutral-700">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
                      字体大小
                    </span>
                    <span className="text-sm text-neutral-400 dark:text-neutral-500">
                      {zoomLevel.toFixed(1)}×
                    </span>
                  </div>
                  <div className="px-1">
                    <input
                      type="range"
                      min="0.8"
                      max="1.2"
                      step="0.1"
                      value={zoomLevel}
                      onChange={e =>
                        handleFontZoomChange(parseFloat(e.target.value))
                      }
                      className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-neutral-200 dark:bg-neutral-600"
                    />
                    <div className="mt-1 flex justify-between text-xs text-neutral-500">
                      <span>小</span>
                      <span>大</span>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
          {isFontZoomEnabled && (
            <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
              调整应用的字体大小，设置会自动保存
            </p>
          )}
        </div>

        {/* 安全区域边距设置组 */}
        <div className="px-6 py-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-medium tracking-wider text-neutral-500 uppercase dark:text-neutral-400">
              安全区域边距
            </h3>
            <button
              onClick={() => {
                const defaultMargins = {
                  top: 38,
                  bottom: 38,
                };
                handleChange('safeAreaMargins', defaultMargins);
                if (settings.hapticFeedback) {
                  hapticsUtils.light();
                }
              }}
              className="rounded-md px-2 py-1 text-xs text-neutral-600 transition-colors hover:bg-neutral-200 hover:text-neutral-800 dark:text-neutral-400 dark:hover:bg-neutral-700 dark:hover:text-neutral-200"
            >
              还原默认
            </button>
          </div>

          <div className="space-y-4 rounded-lg bg-neutral-100 p-4 dark:bg-neutral-800">
            {/* 顶部边距 */}
            <div>
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
                  顶部边距
                </span>
                <button
                  onClick={() => {
                    const currentMargins = settings.safeAreaMargins || {
                      top: 38,
                      bottom: 38,
                    };
                    const newMargins = {
                      ...currentMargins,
                      top: 38,
                    };
                    handleChange('safeAreaMargins', newMargins);
                    if (settings.hapticFeedback) {
                      hapticsUtils.light();
                    }
                  }}
                  className="rounded px-1.5 py-0.5 text-sm text-neutral-500 transition-colors hover:bg-neutral-200 hover:text-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-700 dark:hover:text-neutral-300"
                  title="点击重置为默认值"
                >
                  {settings.safeAreaMargins?.top || 38}px
                </button>
              </div>
              <div className="px-1">
                <input
                  type="range"
                  min="12"
                  max="84"
                  step="2"
                  value={settings.safeAreaMargins?.top || 38}
                  onChange={e => {
                    const currentMargins = settings.safeAreaMargins || {
                      top: 38,
                      bottom: 38,
                    };
                    const newMargins = {
                      ...currentMargins,
                      top: parseInt(e.target.value),
                    };
                    handleChange('safeAreaMargins', newMargins);
                  }}
                  className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-neutral-200 dark:bg-neutral-600"
                />
                <div className="mt-1 flex justify-between text-xs text-neutral-500">
                  <span>12px</span>
                  <span>84px</span>
                </div>
              </div>
            </div>

            {/* 底部边距 */}
            <div className="border-t border-neutral-200 pt-4 dark:border-neutral-700">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
                  底部边距
                </span>
                <button
                  onClick={() => {
                    const currentMargins = settings.safeAreaMargins || {
                      top: 38,
                      bottom: 38,
                    };
                    const newMargins = {
                      ...currentMargins,
                      bottom: 38,
                    };
                    handleChange('safeAreaMargins', newMargins);
                    if (settings.hapticFeedback) {
                      hapticsUtils.light();
                    }
                  }}
                  className="rounded px-1.5 py-0.5 text-sm text-neutral-500 transition-colors hover:bg-neutral-200 hover:text-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-700 dark:hover:text-neutral-300"
                  title="点击重置为默认值"
                >
                  {settings.safeAreaMargins?.bottom || 38}px
                </button>
              </div>
              <div className="px-1">
                <input
                  type="range"
                  min="20"
                  max="80"
                  step="2"
                  value={settings.safeAreaMargins?.bottom || 38}
                  onChange={e => {
                    const currentMargins = settings.safeAreaMargins || {
                      top: 38,
                      bottom: 38,
                    };
                    const newMargins = {
                      ...currentMargins,
                      bottom: parseInt(e.target.value),
                    };
                    handleChange('safeAreaMargins', newMargins);
                  }}
                  className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-neutral-200 dark:bg-neutral-600"
                />
                <div className="mt-1 flex justify-between text-xs text-neutral-500">
                  <span>20px</span>
                  <span>80px</span>
                </div>
              </div>
            </div>
          </div>
          <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
            调整应用界面的上下边距，影响导航栏和内容区域的间距
          </p>
        </div>
      </div>
    </div>
  );
};

export default DisplaySettings;
