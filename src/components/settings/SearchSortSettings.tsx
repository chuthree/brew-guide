'use client';

import React from 'react';

import { SettingsOptions } from './Settings';
import { useSettingsStore } from '@/lib/stores/settingsStore';
import { useModalHistory, modalHistory } from '@/lib/hooks/useModalHistory';
import {
  SettingPage,
  SettingSection,
  SettingRow,
  SettingToggle,
} from './atomic';

interface SearchSortSettingsProps {
  settings: SettingsOptions;
  onClose: () => void;
  handleChange: <K extends keyof SettingsOptions>(
    key: K,
    value: SettingsOptions[K]
  ) => void;
}

const SearchSortSettings: React.FC<SearchSortSettingsProps> = ({
  settings: _settings,
  onClose,
  handleChange: _handleChange,
}) => {
  // 使用 settingsStore 获取设置
  const settings = useSettingsStore(state => state.settings) as SettingsOptions;
  const updateSettings = useSettingsStore(state => state.updateSettings);

  // 使用 settingsStore 的 handleChange
  const handleChange = React.useCallback(
    async <K extends keyof SettingsOptions>(
      key: K,
      value: SettingsOptions[K]
    ) => {
      await updateSettings({ [key]: value } as any);
    },
    [updateSettings]
  );

  // 控制动画状态
  const [shouldRender, setShouldRender] = React.useState(true);
  const [isVisible, setIsVisible] = React.useState(false);

  // 用于保存最新的 onClose 引用
  const onCloseRef = React.useRef(onClose);
  onCloseRef.current = onClose;

  // 关闭处理函数（带动画）
  const handleCloseWithAnimation = React.useCallback(() => {
    setIsVisible(false);
    window.dispatchEvent(new CustomEvent('subSettingsClosing'));
    setTimeout(() => {
      onCloseRef.current();
    }, 350);
  }, []);

  // 使用统一的历史栈管理系统
  useModalHistory({
    id: 'search-sort-settings',
    isOpen: true,
    onClose: handleCloseWithAnimation,
  });

  // UI 返回按钮点击处理
  const handleClose = () => {
    modalHistory.back();
  };

  // 处理显示/隐藏动画（入场动画）
  React.useEffect(() => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setIsVisible(true);
      });
    });
  }, []);

  if (!shouldRender) return null;

  return (
    <SettingPage title="搜索排序" isVisible={isVisible} onClose={handleClose}>
      <SettingSection className="-mt-4">
        <SettingRow
          label="启用搜索排序"
          description="在搜索时显示基于笔记内容的排序选项"
        >
          <SettingToggle
            checked={settings.searchSort?.enabled ?? false}
            onChange={checked =>
              handleChange('searchSort', {
                enabled: checked,
                time: settings.searchSort?.time ?? false,
                rating: settings.searchSort?.rating ?? false,
                extractionTime: settings.searchSort?.extractionTime ?? true,
              })
            }
          />
        </SettingRow>
      </SettingSection>

      {settings.searchSort?.enabled && (
        <SettingSection
          title="排序项目"
          footer="在搜索结果中提供基于笔记内容的排序选项。系统会自动识别笔记中的萃取时间（如“25s”、“25秒”或“0:25”）以支持按萃取时长排序。"
        >
          <SettingRow label="时间排序" description="根据笔记创建时间进行排序">
            <SettingToggle
              checked={settings.searchSort?.time ?? false}
              onChange={checked =>
                handleChange('searchSort', {
                  enabled: settings.searchSort?.enabled ?? true,
                  time: checked,
                  rating: settings.searchSort?.rating ?? false,
                  extractionTime: settings.searchSort?.extractionTime ?? true,
                })
              }
            />
          </SettingRow>

          <SettingRow label="评分排序" description="根据笔记评分进行排序">
            <SettingToggle
              checked={settings.searchSort?.rating ?? false}
              onChange={checked =>
                handleChange('searchSort', {
                  enabled: settings.searchSort?.enabled ?? true,
                  time: settings.searchSort?.time ?? false,
                  rating: checked,
                  extractionTime: settings.searchSort?.extractionTime ?? true,
                })
              }
            />
          </SettingRow>

          <SettingRow
            label="萃取时间排序"
            description="根据笔记中的萃取时间信息进行排序（如：25s、30秒等）"
          >
            <SettingToggle
              checked={settings.searchSort?.extractionTime ?? false}
              onChange={checked =>
                handleChange('searchSort', {
                  enabled: settings.searchSort?.enabled ?? true,
                  time: settings.searchSort?.time ?? false,
                  rating: settings.searchSort?.rating ?? false,
                  extractionTime: checked,
                })
              }
            />
          </SettingRow>
        </SettingSection>
      )}
    </SettingPage>
  );
};

export default SearchSortSettings;
