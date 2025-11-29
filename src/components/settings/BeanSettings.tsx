'use client';

import React from 'react';
import { ChevronLeft } from 'lucide-react';
import { SettingsOptions } from './Settings';
import { getChildPageStyle } from '@/lib/navigation/pageTransition';
import { ButtonGroup } from '../ui/ButtonGroup';
import { useModalHistory, modalHistory } from '@/lib/hooks/useModalHistory';

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
          豆仓设置
        </h2>
      </div>

      {/* 滚动内容区域 */}
      <div className="pb-safe-bottom relative flex-1 overflow-y-auto">
        {/* 预览区域 */}
        <BeanPreview settings={settings} />

        {/* 设置内容 */}
        <div className="mt-8 px-6">
          <div className="space-y-5">
            {/* 简化咖啡豆名称 */}
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
                简化咖啡豆名称
              </div>
              <label className="relative inline-flex cursor-pointer items-center">
                <input
                  type="checkbox"
                  checked={settings.showOnlyBeanName || false}
                  onChange={e =>
                    handleChange('showOnlyBeanName', e.target.checked)
                  }
                  className="peer sr-only"
                />
                <div className="peer h-6 w-11 rounded-full bg-neutral-200 peer-checked:bg-neutral-600 after:absolute after:top-[2px] after:left-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:after:translate-x-full dark:bg-neutral-700 dark:peer-checked:bg-neutral-500"></div>
              </label>
            </div>

            {/* 日期显示模式 */}
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
                日期显示模式
              </div>
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

            {/* 显示总价格 */}
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
                显示总价格
              </div>
              <label className="relative inline-flex cursor-pointer items-center">
                <input
                  type="checkbox"
                  checked={settings.showTotalPrice || false}
                  onChange={e =>
                    handleChange('showTotalPrice', e.target.checked)
                  }
                  className="peer sr-only"
                />
                <div className="peer h-6 w-11 rounded-full bg-neutral-200 peer-checked:bg-neutral-600 after:absolute after:top-[2px] after:left-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:after:translate-x-full dark:bg-neutral-700 dark:peer-checked:bg-neutral-500"></div>
              </label>
            </div>

            {/* 显示状态点 */}
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
                显示状态点
              </div>
              <label className="relative inline-flex cursor-pointer items-center">
                <input
                  type="checkbox"
                  checked={settings.showStatusDots || false}
                  onChange={e =>
                    handleChange('showStatusDots', e.target.checked)
                  }
                  className="peer sr-only"
                />
                <div className="peer h-6 w-11 rounded-full bg-neutral-200 peer-checked:bg-neutral-600 after:absolute after:top-[2px] after:left-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:after:translate-x-full dark:bg-neutral-700 dark:peer-checked:bg-neutral-500"></div>
              </label>
            </div>

            {/* 显示备注区域 */}
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
                显示备注区域
              </div>
              <label className="relative inline-flex cursor-pointer items-center">
                <input
                  type="checkbox"
                  checked={settings.showBeanNotes !== false}
                  onChange={e =>
                    handleChange('showBeanNotes', e.target.checked)
                  }
                  className="peer sr-only"
                />
                <div className="peer h-6 w-11 rounded-full bg-neutral-200 peer-checked:bg-neutral-600 after:absolute after:top-[2px] after:left-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:after:translate-x-full dark:bg-neutral-700 dark:peer-checked:bg-neutral-500"></div>
              </label>
            </div>

            {/* 显示风味信息 - 只有在开启备注显示时才显示 */}
            {settings.showBeanNotes !== false && (
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
                  显示风味信息
                </div>
                <label className="relative inline-flex cursor-pointer items-center">
                  <input
                    type="checkbox"
                    checked={settings.showFlavorInfo || false}
                    onChange={e =>
                      handleChange('showFlavorInfo', e.target.checked)
                    }
                    className="peer sr-only"
                  />
                  <div className="peer h-6 w-11 rounded-full bg-neutral-200 peer-checked:bg-neutral-600 after:absolute after:top-[2px] after:left-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:after:translate-x-full dark:bg-neutral-700 dark:peer-checked:bg-neutral-500"></div>
                </label>
              </div>
            )}

            {/* 限制备注显示行数 - 只有在开启备注显示时才显示 */}
            {settings.showBeanNotes !== false && (
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
                  限制备注显示行数
                </div>
                <label className="relative inline-flex cursor-pointer items-center">
                  <input
                    type="checkbox"
                    checked={settings.limitNotesLines || false}
                    onChange={e =>
                      handleChange('limitNotesLines', e.target.checked)
                    }
                    className="peer sr-only"
                  />
                  <div className="peer h-6 w-11 rounded-full bg-neutral-200 peer-checked:bg-neutral-600 after:absolute after:top-[2px] after:left-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:after:translate-x-full dark:bg-neutral-700 dark:peer-checked:bg-neutral-500"></div>
                </label>
              </div>
            )}

            {/* 备注最大显示行数 - 只有在开启备注显示和限制行数时才显示 */}
            {settings.showBeanNotes !== false && settings.limitNotesLines && (
              <div className="ml-4 border-l-2 border-neutral-200 pl-4 dark:border-neutral-700">
                <div className="mb-2 flex items-center justify-between">
                  <div className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
                    最大显示行数
                  </div>
                  <div className="text-sm text-neutral-400 dark:text-neutral-500">
                    {settings.notesMaxLines || 3}行
                  </div>
                </div>
                <div className="px-1">
                  <input
                    type="range"
                    min="1"
                    max="6"
                    step="1"
                    value={settings.notesMaxLines || 3}
                    onChange={e =>
                      handleChange('notesMaxLines', parseInt(e.target.value))
                    }
                    className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-neutral-200 dark:bg-neutral-700"
                  />
                  <div className="mt-1 flex justify-between text-xs text-neutral-500">
                    <span>1行</span>
                    <span>6行</span>
                  </div>
                </div>
              </div>
            )}

            {/* 咖啡豆详情功能区分割线 */}
            <div className="mt-4 border-t border-neutral-200 pt-4 dark:border-neutral-700">
              <div className="mb-4 text-xs font-medium text-neutral-500 dark:text-neutral-400">
                咖啡豆详情功能
              </div>

              <div className="space-y-5">
                {/* 启用标签保存功能 */}
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
                    标签打印功能
                  </div>
                  <label className="relative inline-flex cursor-pointer items-center">
                    <input
                      type="checkbox"
                      checked={settings.enableBeanPrint || false}
                      onChange={e =>
                        handleChange('enableBeanPrint', e.target.checked)
                      }
                      className="peer sr-only"
                    />
                    <div className="peer h-6 w-11 rounded-full bg-neutral-200 peer-checked:bg-neutral-600 after:absolute after:top-[2px] after:left-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:after:translate-x-full dark:bg-neutral-700 dark:peer-checked:bg-neutral-500"></div>
                  </label>
                </div>

                {/* 显示信息分割线 */}
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
                    显示信息分割线
                  </div>
                  <label className="relative inline-flex cursor-pointer items-center">
                    <input
                      type="checkbox"
                      checked={settings.showBeanInfoDivider !== false}
                      onChange={e =>
                        handleChange('showBeanInfoDivider', e.target.checked)
                      }
                      className="peer sr-only"
                    />
                    <div className="peer h-6 w-11 rounded-full bg-neutral-200 peer-checked:bg-neutral-600 after:absolute after:top-[2px] after:left-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:after:translate-x-full dark:bg-neutral-700 dark:peer-checked:bg-neutral-500"></div>
                  </label>
                </div>

                {/* 显示评分功能 */}
                <div className="flex items-center justify-between">
                  <div className="flex flex-col">
                    <div className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
                      显示空评分区域
                    </div>
                  </div>
                  <label className="relative inline-flex flex-shrink-0 cursor-pointer items-center">
                    <input
                      type="checkbox"
                      checked={settings.showBeanRating || false}
                      onChange={e =>
                        handleChange('showBeanRating', e.target.checked)
                      }
                      className="peer sr-only"
                    />
                    <div className="peer h-6 w-11 rounded-full bg-neutral-200 peer-checked:bg-neutral-600 after:absolute after:top-[2px] after:left-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:after:translate-x-full dark:bg-neutral-700 dark:peer-checked:bg-neutral-500"></div>
                  </label>
                </div>
              </div>
            </div>

            {/* 生豆库设置区域分割线 */}
            <div className="mt-4 border-t border-neutral-200 pt-4 dark:border-neutral-700">
              <div className="mb-4 text-xs font-medium text-neutral-500 dark:text-neutral-400">
                生豆库设置
              </div>

              <div className="space-y-5">
                {/* 启用生豆库功能 */}
                <div className="flex items-center justify-between">
                  <div className="flex flex-col">
                    <div className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
                      启用生豆库
                    </div>
                    <div className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
                      关闭后将隐藏生豆/熟豆切换功能
                    </div>
                  </div>
                  <label className="relative inline-flex shrink-0 cursor-pointer items-center">
                    <input
                      type="checkbox"
                      checked={settings.enableGreenBeanInventory || false}
                      onChange={e =>
                        handleChange(
                          'enableGreenBeanInventory',
                          e.target.checked
                        )
                      }
                      className="peer sr-only"
                    />
                    <div className="peer h-6 w-11 rounded-full bg-neutral-200 peer-checked:bg-neutral-600 after:absolute after:top-[2px] after:left-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:after:translate-x-full dark:bg-neutral-700 dark:peer-checked:bg-neutral-500"></div>
                  </label>
                </div>

                {/* 转为生豆功能 - 仅在生豆库启用时显示 */}
                {settings.enableGreenBeanInventory && (
                  <div className="ml-4 border-l-2 border-neutral-200 pl-4 dark:border-neutral-700">
                    {/* 开关 */}
                    <div className="flex items-center justify-between">
                      <div className="flex flex-col">
                        <div className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
                          启用熟豆转生豆
                        </div>
                        <div className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
                          在熟豆详情页显示转换入口
                        </div>
                      </div>
                      <label className="relative inline-flex shrink-0 cursor-pointer items-center">
                        <input
                          type="checkbox"
                          checked={settings.enableConvertToGreen || false}
                          onChange={e =>
                            handleChange(
                              'enableConvertToGreen',
                              e.target.checked
                            )
                          }
                          className="peer sr-only"
                        />
                        <div className="peer h-6 w-11 rounded-full bg-neutral-200 peer-checked:bg-neutral-600 after:absolute after:top-[2px] after:left-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:after:translate-x-full dark:bg-neutral-700 dark:peer-checked:bg-neutral-500"></div>
                      </label>
                    </div>

                    {/* 功能介绍卡片 */}
                    <div className="mt-4 rounded-lg bg-neutral-100 p-3 dark:bg-neutral-800">
                      <div className="text-xs leading-relaxed text-neutral-600 dark:text-neutral-400">
                        <p className="mb-2">
                          在生豆库功能上线前，你可能用熟豆记录来管理生豆。此功能可将这些旧数据转换为正确的生豆库格式。
                        </p>
                        <p className="mb-2">
                          转换后，已用掉的部分会变成「烘焙记录 +
                          新熟豆」，剩余部分保留在生豆中。原有的冲煮笔记会自动迁移到新熟豆，快捷扣除等变动记录会被清理。
                        </p>
                        <p className="text-neutral-500 dark:text-neutral-500">
                          仅限未关联生豆来源的熟豆使用，数据变动较大，建议先备份。
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BeanSettings;
