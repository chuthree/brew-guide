'use client';

import React from 'react';
import { SettingsOptions } from './Settings';
import { ButtonGroup } from '../ui/ButtonGroup';
import { useModalHistory, modalHistory } from '@/lib/hooks/useModalHistory';
import {
  SettingPage,
  SettingSection,
  SettingRow,
  SettingToggle,
  SettingSlider,
} from './atomic';

import BeanPreview from './BeanPreview';

interface BeanSettingsProps {
  settings: SettingsOptions;
  onClose: () => void;
  handleChange: <K extends keyof SettingsOptions>(
    key: K,
    value: SettingsOptions[K]
  ) => void | Promise<void>;
}

const BeanSettings: React.FC<BeanSettingsProps> = ({
  settings,
  onClose,
  handleChange,
}) => {
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

    // 立即通知父组件子设置正在关闭
    window.dispatchEvent(new CustomEvent('subSettingsClosing'));

    // 等待动画完成后真正关闭
    setTimeout(() => {
      onCloseRef.current();
    }, 350); // 与 IOS_TRANSITION_CONFIG.duration 一致
  }, []);

  // 使用统一的历史栈管理系统
  useModalHistory({
    id: 'bean-settings',
    isOpen: true, // 子设置页面挂载即为打开状态
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
    <SettingPage title="豆仓设置" isVisible={isVisible} onClose={handleClose}>
      {/* 预览区域 */}
      <BeanPreview settings={settings} />

      <SettingSection title="列表显示" className="mt-6">
        <SettingRow label="简化咖啡豆名称">
          <SettingToggle
            checked={settings.showOnlyBeanName || false}
            onChange={checked => handleChange('showOnlyBeanName', checked)}
          />
        </SettingRow>

        <SettingRow label="日期显示模式">
          <div className="flex h-0 items-center">
            <ButtonGroup
              value={settings.dateDisplayMode || 'date'}
              options={[
                { value: 'date', label: '日期' },
                { value: 'flavorPeriod', label: '赏味期' },
                { value: 'agingDays', label: '养豆天数' },
              ]}
              onChange={value =>
                handleChange(
                  'dateDisplayMode',
                  value as 'date' | 'flavorPeriod' | 'agingDays'
                )
              }
            />
          </div>
        </SettingRow>

        <SettingRow label="显示总价格">
          <SettingToggle
            checked={settings.showTotalPrice || false}
            onChange={checked => handleChange('showTotalPrice', checked)}
          />
        </SettingRow>

        <SettingRow label="显示状态点">
          <SettingToggle
            checked={settings.showStatusDots || false}
            onChange={checked => handleChange('showStatusDots', checked)}
          />
        </SettingRow>

        <SettingRow
          label="显示备注区域"
          isLast={settings.showBeanNotes === false}
        >
          <SettingToggle
            checked={settings.showBeanNotes !== false}
            onChange={checked => handleChange('showBeanNotes', checked)}
          />
        </SettingRow>

        {settings.showBeanNotes !== false && (
          <>
            <SettingRow label="显示风味信息">
              <SettingToggle
                checked={settings.showFlavorInfo || false}
                onChange={checked => handleChange('showFlavorInfo', checked)}
              />
            </SettingRow>
            <SettingRow
              label="限制备注显示行数"
              isLast={!settings.limitNotesLines}
            >
              <SettingToggle
                checked={settings.limitNotesLines || false}
                onChange={checked => handleChange('limitNotesLines', checked)}
              />
            </SettingRow>
            {settings.limitNotesLines && (
              <SettingRow isLast vertical>
                <SettingSlider
                  min={1}
                  max={5}
                  step={1}
                  value={settings.notesMaxLines || 3}
                  onChange={val => handleChange('notesMaxLines', val)}
                  minLabel="1行"
                  maxLabel="5行"
                  showTicks
                />
              </SettingRow>
            )}
          </>
        )}
      </SettingSection>

      <SettingSection title="咖啡豆详情功能">
        <SettingRow label="标签打印功能">
          <SettingToggle
            checked={settings.enableBeanPrint || false}
            onChange={checked => handleChange('enableBeanPrint', checked)}
          />
        </SettingRow>
        <SettingRow label="显示信息分割线">
          <SettingToggle
            checked={settings.showBeanInfoDivider !== false}
            onChange={checked => handleChange('showBeanInfoDivider', checked)}
          />
        </SettingRow>
        <SettingRow label="启用评分功能" isLast>
          <SettingToggle
            checked={settings.showBeanRating || false}
            onChange={checked => handleChange('showBeanRating', checked)}
          />
        </SettingRow>
      </SettingSection>

      <SettingSection title="咖啡豆添加设置">
        <SettingRow
          label="自动填充识图图片"
          description="单张图片识别后自动填充到表单图片"
          isLast
        >
          <SettingToggle
            checked={settings.autoFillRecognitionImage || false}
            onChange={checked =>
              handleChange('autoFillRecognitionImage', checked)
            }
          />
        </SettingRow>
      </SettingSection>

      <SettingSection
        title="生豆库设置"
        footer="在咖啡豆库存概要中点击“咖啡豆”来切换生豆/熟豆库"
      >
        <SettingRow label="启用生豆库" isLast>
          <SettingToggle
            checked={settings.enableGreenBeanInventory || false}
            onChange={checked =>
              handleChange('enableGreenBeanInventory', checked)
            }
          />
        </SettingRow>
      </SettingSection>

      {settings.enableGreenBeanInventory && (
        <SettingSection
          footer={
            <div className="space-y-2 text-xs leading-relaxed text-neutral-500 dark:text-neutral-400">
              <p>
                在生豆库功能上线前，你可能用熟豆记录来管理生豆。此功能可将这些旧数据转换为正确的生豆库格式。
              </p>
              <p>
                转换后，已用掉的部分会变成「烘焙记录 +
                新熟豆」，剩余部分保留在生豆中。原有的冲煮笔记会自动迁移到新熟豆，快捷扣除等变动记录会被清理。
              </p>
              <p className="text-neutral-400 dark:text-neutral-500">
                仅限未关联生豆来源的熟豆使用，数据变动较大，建议先备份。
              </p>
            </div>
          }
        >
          <SettingRow label="启用熟豆转生豆" isLast>
            <SettingToggle
              checked={settings.enableConvertToGreen || false}
              onChange={checked =>
                handleChange('enableConvertToGreen', checked)
              }
            />
          </SettingRow>
        </SettingSection>
      )}
    </SettingPage>
  );
};

export default BeanSettings;
