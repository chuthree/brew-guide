'use client';

import React from 'react';

import { ChevronLeft } from 'lucide-react';
import { SettingsOptions } from './Settings';
import { getChildPageStyle } from '@/lib/navigation/pageTransition';

interface SearchSortSettingsProps {
  settings: SettingsOptions;
  onClose: () => void;
  handleChange: <K extends keyof SettingsOptions>(
    key: K,
    value: SettingsOptions[K]
  ) => void;
}

const SearchSortSettings: React.FC<SearchSortSettingsProps> = ({
  settings,
  onClose,
  handleChange,
}) => {
  // 历史栈管理
  const onCloseRef = React.useRef(onClose);
  onCloseRef.current = onClose;

  React.useEffect(() => {
    window.history.pushState({ modal: 'search-sort-settings' }, '');

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
      if (window.history.state?.modal === 'search-sort-settings') {
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
          搜索排序设置
        </h2>
      </div>

      {/* 滚动内容区域 */}
      <div className="pb-safe-bottom flex-1 overflow-y-auto">
        {/* 顶部渐变阴影 */}
        <div className="pointer-events-none sticky top-0 z-10 h-12 w-full bg-linear-to-b from-neutral-50 to-transparent first:border-b-0 dark:from-neutral-900"></div>

        <div className="-mt-4 space-y-6 px-6 py-4">
          {/* 功能开关 */}
          <div>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                    启用搜索排序
                  </div>
                  <div className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                    在搜索时显示基于笔记内容的排序选项
                  </div>
                </div>
                <label className="relative inline-flex cursor-pointer items-center">
                  <input
                    type="checkbox"
                    checked={settings.searchSort?.enabled}
                    onChange={e =>
                      handleChange('searchSort', {
                        enabled: e.target.checked,
                        time: settings.searchSort?.time ?? false,
                        rating: settings.searchSort?.rating ?? false,
                        extractionTime:
                          settings.searchSort?.extractionTime ?? true,
                      })
                    }
                    className="peer sr-only"
                  />
                  <div className="peer h-6 w-11 rounded-full bg-neutral-200 peer-checked:bg-neutral-600 after:absolute after:top-[2px] after:left-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:after:translate-x-full dark:bg-neutral-700 dark:peer-checked:bg-neutral-500"></div>
                </label>
              </div>
            </div>
          </div>

          {/* 排序项目设置 */}
          {settings.searchSort?.enabled && (
            <div>
              <h3 className="mb-3 text-sm font-medium tracking-wider text-neutral-500 uppercase dark:text-neutral-400">
                排序项目
              </h3>
              <div className="space-y-4">
                {/* 时间排序 */}
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                      时间排序
                    </div>
                    <div className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                      根据笔记创建时间进行排序
                    </div>
                  </div>
                  <label className="relative inline-flex cursor-pointer items-center">
                    <input
                      type="checkbox"
                      checked={settings.searchSort?.time}
                      onChange={e =>
                        handleChange('searchSort', {
                          enabled: settings.searchSort?.enabled ?? true,
                          time: e.target.checked,
                          rating: settings.searchSort?.rating ?? false,
                          extractionTime:
                            settings.searchSort?.extractionTime ?? true,
                        })
                      }
                      className="peer sr-only"
                    />
                    <div className="peer h-6 w-11 rounded-full bg-neutral-200 peer-checked:bg-neutral-600 after:absolute after:top-[2px] after:left-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:after:translate-x-full dark:bg-neutral-700 dark:peer-checked:bg-neutral-500"></div>
                  </label>
                </div>

                {/* 评分排序 */}
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                      评分排序
                    </div>
                    <div className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                      根据笔记评分进行排序
                    </div>
                  </div>
                  <label className="relative inline-flex cursor-pointer items-center">
                    <input
                      type="checkbox"
                      checked={settings.searchSort?.rating}
                      onChange={e =>
                        handleChange('searchSort', {
                          enabled: settings.searchSort?.enabled ?? true,
                          time: settings.searchSort?.time ?? false,
                          rating: e.target.checked,
                          extractionTime:
                            settings.searchSort?.extractionTime ?? true,
                        })
                      }
                      className="peer sr-only"
                    />
                    <div className="peer h-6 w-11 rounded-full bg-neutral-200 peer-checked:bg-neutral-600 after:absolute after:top-[2px] after:left-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:after:translate-x-full dark:bg-neutral-700 dark:peer-checked:bg-neutral-500"></div>
                  </label>
                </div>

                {/* 萃取时间排序 */}
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                      萃取时间排序
                    </div>
                    <div className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                      根据笔记中的萃取时间信息进行排序（如：25s、30秒等）
                    </div>
                  </div>
                  <label className="relative inline-flex cursor-pointer items-center">
                    <input
                      type="checkbox"
                      checked={settings.searchSort?.extractionTime}
                      onChange={e =>
                        handleChange('searchSort', {
                          enabled: settings.searchSort?.enabled ?? true,
                          time: settings.searchSort?.time ?? false,
                          rating: settings.searchSort?.rating ?? false,
                          extractionTime: e.target.checked,
                        })
                      }
                      className="peer sr-only"
                    />
                    <div className="peer h-6 w-11 rounded-full bg-neutral-200 peer-checked:bg-neutral-600 after:absolute after:top-[2px] after:left-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:after:translate-x-full dark:bg-neutral-700 dark:peer-checked:bg-neutral-500"></div>
                  </label>
                </div>
                {/* 使用说明 */}
                <div className="space-y-3 rounded-lg bg-neutral-100 p-4 dark:bg-neutral-800">
                  <div className="text-xs text-neutral-600 dark:text-neutral-400">
                    <p className="mb-2 font-medium">萃取时间识别格式：</p>
                    <ul className="ml-3 space-y-1">
                      <li>• 数字+s：如 25s、30s</li>
                      <li>• 数字+秒：如 25秒、30秒</li>
                      <li>• 分:秒格式：如 0:25、1:30</li>
                      <li>
                        • 描述性文字：如
                        &ldquo;萃取25秒&rdquo;、&ldquo;extraction 30s&rdquo;
                      </li>
                    </ul>
                  </div>
                  <div className="text-xs text-neutral-500 dark:text-neutral-400">
                    <p>
                      搜索排序只在搜索模式下显示，并且只有当搜索结果中包含相应数据时才会出现排序选项。
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SearchSortSettings;
