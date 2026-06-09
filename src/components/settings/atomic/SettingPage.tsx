import React from 'react';
import { ChevronLeft } from 'lucide-react';
import { getChildPageStyle } from '@/lib/navigation/pageTransition';
import { useSettingPageLayoutMode } from './SettingPageLayoutContext';

interface SettingPageProps {
  title: string;
  children: React.ReactNode;
  isVisible: boolean;
  onClose: () => void;
}

/**
 * 设置页面容器组件 - 统一的设置页面布局
 * 包含头部导航栏、返回按钮、滚动容器
 */
const SettingPage: React.FC<SettingPageProps> = ({
  title,
  children,
  isVisible,
  onClose,
}) => {
  const layoutMode = useSettingPageLayoutMode();
  const isEmbedded = layoutMode === 'embedded';
  const embeddedContentClass = 'mx-auto w-full max-w-xl min-w-0';

  return (
    <div
      className={
        isEmbedded
          ? 'flex h-full min-w-0 flex-col bg-neutral-50 dark:bg-neutral-900'
          : 'fixed inset-0 mx-auto flex flex-col bg-neutral-50 dark:bg-neutral-900'
      }
      style={isEmbedded ? undefined : getChildPageStyle(isVisible)}
    >
      {isEmbedded ? (
        <div className="pt-safe-top z-20">
          <div className={`${embeddedContentClass} pr-6 pl-3`}>
            <h2 className="pl-3.5 text-xl font-medium text-neutral-800 dark:text-neutral-200">
              {title}
            </h2>
          </div>
        </div>
      ) : (
        <div className="pt-safe-top z-20 flex items-center justify-between px-6">
          <button
            onClick={onClose}
            className="flex flex-5 cursor-pointer items-center rounded-full text-neutral-700 dark:text-neutral-300"
          >
            <ChevronLeft className="-ml-1 h-5 w-5" />
            <h2 className="pl-2.5 text-xl font-medium text-neutral-800 dark:text-neutral-200">
              {title}
            </h2>
          </button>
        </div>
      )}

      {/* 滚动内容区域 */}
      <div className="pb-safe-bottom relative flex-1 overflow-y-auto">
        {/* 顶部渐变阴影（随滚动粘附）*/}
        <div className="fade-mask-to-b pointer-events-none sticky top-0 z-10 h-12 w-full bg-neutral-50 first:border-b-0 dark:bg-neutral-900"></div>

        {isEmbedded ? (
          <div className={embeddedContentClass}>{children}</div>
        ) : (
          children
        )}
      </div>
    </div>
  );
};

export default SettingPage;
