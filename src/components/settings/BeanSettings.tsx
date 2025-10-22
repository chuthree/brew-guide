'use client';

import React from 'react';
import { ChevronLeft } from 'lucide-react';
import { SettingsOptions } from './Settings';
import { getChildPageStyle } from '@/lib/navigation/pageTransition';
import { ButtonGroup } from '../ui/ButtonGroup';

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
  // 历史栈管理
  const onCloseRef = React.useRef(onClose);
  onCloseRef.current = onClose;

  React.useEffect(() => {
    window.history.pushState({ modal: 'bean-settings' }, '');

    const handlePopState = () => onCloseRef.current();
    window.addEventListener('popstate', handlePopState);

    return () => window.removeEventListener('popstate', handlePopState);
  }, []); // 空依赖数组，确保只在挂载时执行一次

  // 关闭处理
  const handleClose = () => {
    // 立即触发退出动画
    setIsVisible(false);

    // 立即通知父组件子设置正在关闭
    window.dispatchEvent(new CustomEvent('subSettingsClosing'));

    // 等待动画完成后再真正关闭
    setTimeout(() => {
      if (window.history.state?.modal === 'bean-settings') {
        window.history.back();
      } else {
        onClose();
      }
    }, 350); // 与 IOS_TRANSITION_CONFIG.duration 一致
  };

  // 控制动画状态
  const [shouldRender, setShouldRender] = React.useState(false);
  const [isVisible, setIsVisible] = React.useState(false);

  // 处理显示/隐藏动画
  React.useEffect(() => {
    setShouldRender(true);
    const timer = setTimeout(() => setIsVisible(true), 10);
    return () => clearTimeout(timer);
  }, []);

  if (!shouldRender) return null;

  return (
    <div
      className="fixed inset-0 z-[60] mx-auto flex max-w-[500px] flex-col bg-neutral-50 dark:bg-neutral-900"
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
          豆仓列表显示设置
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

            {/* 显示风味信息 */}
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

            {/* 状态点颜色说明 - 只在开启时显示 */}
            {settings.showStatusDots && (
              <div className="ml-4 border-l-2 border-neutral-200 pl-4 dark:border-neutral-700">
                <div className="mb-2 text-xs font-medium text-neutral-600 dark:text-neutral-400">
                  状态颜色说明
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-xs text-neutral-600 dark:text-neutral-400">
                    <div className="h-2 w-2 rounded-full border border-neutral-200 bg-green-400 dark:border-neutral-700"></div>
                    <span>赏味期 - 最佳品尝时间</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-neutral-600 dark:text-neutral-400">
                    <div className="h-2 w-2 rounded-full border border-neutral-200 bg-amber-400 dark:border-neutral-700"></div>
                    <span>养豆期 - 等待最佳状态</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-neutral-600 dark:text-neutral-400">
                    <div className="h-2 w-2 rounded-full border border-neutral-200 bg-red-400 dark:border-neutral-700"></div>
                    <span>衰退期 - 风味开始衰减</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-neutral-600 dark:text-neutral-400">
                    <div className="h-2 w-2 rounded-full border border-neutral-200 bg-blue-400 dark:border-neutral-700"></div>
                    <span>在途 - 运输中咖啡豆</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-neutral-600 dark:text-neutral-400">
                    <div className="h-2 w-2 rounded-full border border-neutral-200 bg-cyan-400 dark:border-neutral-700"></div>
                    <span>冷冻 - 冷冻保存中</span>
                  </div>
                </div>
              </div>
            )}

            {/* 限制备注显示行数 */}
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

            {/* 备注最大显示行数 - 只有在开启限制时才显示 */}
            {settings.limitNotesLines && (
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
          </div>
        </div>
      </div>
    </div>
  );
};

export default BeanSettings;
