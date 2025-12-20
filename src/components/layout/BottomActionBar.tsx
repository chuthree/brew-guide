import React, { useState, useEffect } from 'react';
import {
  useIsLargeScreen,
  pageStackManager,
} from '@/lib/navigation/pageTransition';

export interface ButtonConfig {
  text: string;
  onClick: () => void;
  icon?: React.ReactNode;
  className?: string;
}

interface BottomActionBarProps {
  buttons: ButtonConfig[];
  className?: string;
  bottomHint?: string;
}

const BottomActionBar: React.FC<BottomActionBarProps> = ({
  buttons,
  className = '',
  bottomHint,
}) => {
  const isLargeScreen = useIsLargeScreen();
  const [hasDetailPanel, setHasDetailPanel] = useState(false);

  // 监听详情面板状态变化
  useEffect(() => {
    return pageStackManager.subscribe(setHasDetailPanel);
  }, []);

  // 计算 right 值：大屏幕时如果有详情面板，需要留出 384px (w-96) 的空间
  const rightOffset = isLargeScreen && hasDetailPanel ? 'right-96' : 'right-0';

  return (
    <div
      className={`fixed bottom-0 left-0 transition-[right] duration-350 ease-[cubic-bezier(0.4,0,0.2,1)] md:left-36 ${rightOffset} ${className}`}
    >
      <div className="pointer-events-none absolute right-0 bottom-full left-0 h-12 bg-linear-to-t from-neutral-50 to-transparent dark:from-neutral-900"></div>
      <div className="pb-safe-bottom relative mx-auto flex items-center bg-neutral-50 dark:bg-neutral-900">
        <div className="grow border-t border-neutral-200 dark:border-neutral-800"></div>
        <div className="mx-3 flex items-center space-x-3">
          {buttons.map((button, index) => (
            <React.Fragment key={index}>
              {index > 0 && (
                <div className="w-4 border-t border-neutral-200 dark:border-neutral-800"></div>
              )}
              <button
                onClick={button.onClick}
                className={`flex items-center justify-center text-xs font-medium text-neutral-600 dark:text-neutral-400 ${button.className || ''}`}
              >
                {button.icon && <span className="mr-1">{button.icon}</span>}
                {button.text}
              </button>
            </React.Fragment>
          ))}
        </div>
        <div className="grow border-t border-neutral-200 dark:border-neutral-800"></div>
      </div>
      {bottomHint && (
        <div className="mt-2 mb-2 text-center">
          <p className="text-[10px] text-neutral-500 dark:text-neutral-500">
            {bottomHint}
          </p>
        </div>
      )}
    </div>
  );
};

export default BottomActionBar;
