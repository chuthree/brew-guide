import React from 'react';

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
  return (
    <div
      className={`fixed inset-x-0 bottom-0 md:right-[var(--detail-panel-offset,0px)] md:left-[var(--nav-panel-width,144px)] ${className}`}
    >
      <div className="fade-mask-to-t pointer-events-none absolute right-0 bottom-full left-0 h-12 bg-neutral-50 dark:bg-neutral-900"></div>
      <div className="pb-safe-bottom bg-neutral-50 dark:bg-neutral-900">
        <div className="relative mx-auto flex items-center">
          <div className="grow border-t border-neutral-200/50 dark:border-neutral-800/50"></div>
          <div className="mx-3 flex items-center space-x-3">
            {buttons.map((button, index) => (
              <React.Fragment key={index}>
                {index > 0 && (
                  <div className="w-4 border-t border-neutral-200/50 dark:border-neutral-800/50"></div>
                )}
                <button
                  type="button"
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
