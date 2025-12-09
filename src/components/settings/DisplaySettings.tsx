'use client';

import React from 'react';
import { SettingsOptions } from './Settings';
import { useTheme } from 'next-themes';
import fontZoomUtils from '@/lib/utils/fontZoomUtils';
import hapticsUtils from '@/lib/ui/haptics';
import { ButtonGroup } from '@/components/ui/ButtonGroup';
import { useModalHistory, modalHistory } from '@/lib/hooks/useModalHistory';
import {
  SettingPage,
  SettingSection,
  SettingRow,
  SettingSlider,
  SettingDescription,
} from './atomic';

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
    <SettingPage title="外观与字体" isVisible={isVisible} onClose={handleClose}>
      {/* 外观设置组 */}
      <SettingSection title="外观" className="-mt-4">
        <SettingRow label="外观模式" isLast>
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
        </SettingRow>
      </SettingSection>

      {/* 字体设置组 - 独立分组 */}
      {isFontZoomEnabled && (
        <>
          <SettingSection title="字体">
            <SettingRow isLast vertical>
              <SettingSlider
                value={zoomLevel}
                min={0.8}
                max={1.2}
                step={0.1}
                onChange={handleFontZoomChange}
                minLabel="小"
                maxLabel="大"
                showTicks
              />
            </SettingRow>
          </SettingSection>
        </>
      )}

      {/* 安全区域边距设置组 */}
      <SettingSection title="安全区域边距">
        <SettingRow label="顶部边距" vertical>
          <SettingSlider
            value={settings.safeAreaMargins?.top || 38}
            min={12}
            max={84}
            step={2}
            onChange={value => {
              const currentMargins = settings.safeAreaMargins || {
                top: 38,
                bottom: 38,
              };
              const newMargins = {
                ...currentMargins,
                top: value,
              };
              handleChange('safeAreaMargins', newMargins);
            }}
            minLabel="12px"
            maxLabel="84px"
          />
        </SettingRow>

        <SettingRow label="底部边距" isLast vertical>
          <SettingSlider
            value={settings.safeAreaMargins?.bottom || 38}
            min={20}
            max={80}
            step={2}
            onChange={value => {
              const currentMargins = settings.safeAreaMargins || {
                top: 38,
                bottom: 38,
              };
              const newMargins = {
                ...currentMargins,
                bottom: value,
              };
              handleChange('safeAreaMargins', newMargins);
            }}
            minLabel="20px"
            maxLabel="80px"
          />
        </SettingRow>
      </SettingSection>
    </SettingPage>
  );
};

export default DisplaySettings;
