import React, { useState, useEffect } from 'react';
import {
  useIsDesktopLayout,
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
  const isDesktopLayout = useIsDesktopLayout();
  const isLargeScreen = useIsLargeScreen();
  const [hasDetailPanel, setHasDetailPanel] = useState(false);

  // 监听详情面板状态变化
  useEffect(() => {
    return pageStackManager.subscribe(setHasDetailPanel);
  }, []);

  return (
    <div
      className={`fixed bottom-0 left-0 transition-[right,left] duration-350 ease-in-out ${className}`}
      style={{
        left: isDesktopLayout ? 'var(--nav-panel-width, 144px)' : 0,
        right:
          isLargeScreen && hasDetailPanel
            ? 'var(--detail-panel-width, 384px)'
            : 0,
      }}
    >
      <div className="fade-mask-to-t pointer-events-none absolute right-0 bottom-full left-0 h-12 bg-neutral-50 dark:bg-neutral-900"></div>
      <div className="pb-safe-bottom relative mx-auto flex items-center bg-neutral-50 dark:bg-neutral-900">
        <div className="grow border-t border-neutral-200/50 dark:border-neutral-800/50"></div>
        <div className="mx-3 flex items-center space-x-3">
          {buttons.map((button, index) => (
            <React.Fragment key={index}>
              {index > 0 && (
                <div className="w-4 border-t border-neutral-200/50 dark:border-neutral-800/50"></div>
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
        <div className="grow border-t border-neutral-200/50 dark:border-neutral-800/50"></div>
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
