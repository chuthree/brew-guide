import React from 'react';

export interface ButtonConfig {
  text: string;
  onClick: () => void;
  icon?: string; // 可选的图标，默认为 '+'
  active?: boolean; // 是否激活状态
  highlight?: boolean; // 是否高亮显示（使用深色）
  position?: 'left' | 'center' | 'right'; // 按钮位置，用于特殊布局
  className?: string; // 添加自定义类名
  id?: string; // 按钮标识，用于自定义预设模式下过滤按钮
}

interface BottomActionBarProps {
  buttons: ButtonConfig[] | ButtonConfig[][];
  className?: string;
  fixed?: boolean; // 是否固定在页面底部
  specialLayout?: boolean; // 特殊布局，用于方案选择器
  customPresetMode?: boolean; // 自定义预设模式，仅显示【新建方案】和【导入方案】按钮
}

/**
 * 底部操作栏组件
 * 
 * 可以接受单个按钮数组或按钮组数组：
 * 1. 单个按钮数组: [按钮1, 按钮2, ...]
 * 2. 按钮组数组: [[按钮1, 按钮2], [按钮3, 按钮4]]
 *    每个数组内的按钮之间用小分隔线分开，数组之间用大分隔线分开
 */
const BottomActionBar: React.FC<BottomActionBarProps> = ({ 
  buttons, 
  className = '',
  fixed = true, // 默认固定在底部
  specialLayout = false, // 默认使用标准布局
  customPresetMode = false, // 默认非自定义预设模式
}) => {
  // 判断是否是按钮组数组
  const isGroupedButtons = Array.isArray(buttons[0]) && Array.isArray(buttons);
  
  // 基础类名，根据fixed决定是否添加bottom-action-bar类
  const baseClassName = fixed 
    ? `bottom-action-bar ${className}` 
    : className;
  
  // 如果是自定义预设模式，过滤掉【通用方案】和【自定义方案】按钮
  const processButtons = (btns: ButtonConfig[] | ButtonConfig[][]) => {
    if (!customPresetMode) return btns;
    
    if (isGroupedButtons) {
      // 按钮组数组
      return (btns as ButtonConfig[][]).map(group => 
        group.filter(btn => 
          btn.id === 'new' || btn.id === 'import' || 
          (!btn.id && (btn.text === '新建方案' || btn.text === '导入方案'))
        )
      ).filter(group => group.length > 0);
    } else {
      // 单个按钮数组
      return (btns as ButtonConfig[]).filter(btn => 
        btn.id === 'new' || btn.id === 'import' || 
        (!btn.id && (btn.text === '新建方案' || btn.text === '导入方案'))
      );
    }
  };
  
  const processedButtons = processButtons(buttons);
  
  // 处理特殊布局（方案选择器专用）
  if (specialLayout && !isGroupedButtons) {
    // 将按钮分为左侧、中间和右侧
    const leftButtons = (processedButtons as ButtonConfig[]).filter(btn => btn.position === 'left' || !btn.position);
    const centerButtons = (processedButtons as ButtonConfig[]).filter(btn => btn.position === 'center');
    const rightButtons = (processedButtons as ButtonConfig[]).filter(btn => btn.position === 'right');
    
    return (
      <div className={baseClassName}>
        <div className="absolute bottom-full left-0 right-0 h-12 bg-gradient-to-t from-neutral-50 dark:from-neutral-900 to-transparent pointer-events-none"></div>
        <div className="relative flex items-center justify-between bg-neutral-50 dark:bg-neutral-900 py-4">
          {/* 左侧按钮 */}
          <div className="flex items-center space-x-3 mx-6">
            {leftButtons.map((button, index) => (
              <React.Fragment key={`left-${index}`}>
                {index > 0 && (
                  <span className="mx-2 text-neutral-300 dark:text-neutral-600 text-xs">|</span>
                )}
                <button
                  onClick={button.onClick}
                  className={`flex items-center justify-center text-[11px] ${
                    button.highlight || button.active
                      ? 'text-neutral-800 dark:text-white'
                      : 'text-neutral-500 dark:text-neutral-400'
                  } ${button.className || ''}`}
                >
                  {button.icon && <span className="mr-1">{button.icon}</span>}
                  {button.text}
                </button>
              </React.Fragment>
            ))}
          </div>
          
          {/* 中间按钮 */}
          {centerButtons.length > 0 && (
            <div className="flex items-center space-x-3">
              {centerButtons.map((button, index) => (
                <React.Fragment key={`center-${index}`}>
                  {index > 0 && (
                    <div className="w-4 border-t border-neutral-200 dark:border-neutral-800"></div>
                  )}
                  <button
                    onClick={button.onClick}
                    className={`flex items-center justify-center text-[11px] ${
                      button.highlight || button.active
                        ? 'text-neutral-800 dark:text-white'
                        : 'text-neutral-500 dark:text-neutral-400'
                    } ${button.className || ''}`}
                  >
                    {button.icon && <span className="mr-1">{button.icon}</span>}
                    {button.text}
                  </button>
                </React.Fragment>
              ))}
            </div>
          )}
          
          {/* 右侧按钮 */}
          {rightButtons.length > 0 && (
            <div className="flex items-center space-x-3 mx-6">
              {rightButtons.map((button, index) => (
                <React.Fragment key={`right-${index}`}>
                  {index > 0 && (
                    <div className="w-4 border-t border-neutral-200 dark:border-neutral-800"></div>
                  )}
                  <button
                    onClick={button.onClick}
                    className={`flex items-center justify-center text-[11px] ${
                      button.highlight || button.active
                        ? 'text-neutral-800 dark:text-white'
                        : 'text-neutral-500 dark:text-neutral-400'
                    } ${button.className || ''}`}
                  >
                    {button.icon && <span className="mr-1">{button.icon}</span>}
                    {button.text}
                  </button>
                </React.Fragment>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }
  
  // 处理单个按钮的情况
  if (!isGroupedButtons && processedButtons.length === 1) {
    const button = processedButtons[0] as ButtonConfig;
    return (
      <div className={baseClassName}>
        <div className="absolute bottom-full left-0 right-0 h-12 bg-gradient-to-t from-neutral-50 dark:from-neutral-900 to-transparent pointer-events-none"></div>
        <div className="relative flex items-center bg-neutral-50 dark:bg-neutral-900 py-4">
          <div className="flex-grow border-t border-neutral-200 dark:border-neutral-800"></div>
          <button
            onClick={button.onClick}
            className="flex items-center justify-center text-[11px] text-neutral-800 dark:text-white hover:opacity-80 mx-3"
          >
            <span className="mr-1">{button.icon || '+'}</span> {button.text}
          </button>
          <div className="flex-grow border-t border-neutral-200 dark:border-neutral-800"></div>
        </div>
      </div>
    );
  }

  // 处理多个按钮的情况
  if (!isGroupedButtons) {
    // 单组多个按钮
    return (
      <div className={baseClassName}>
        <div className="absolute bottom-full left-0 right-0 h-12 bg-gradient-to-t from-neutral-50 dark:from-neutral-900 to-transparent pointer-events-none"></div>
        <div className="relative flex items-center bg-neutral-50 dark:bg-neutral-900 py-4">
          <div className="flex-grow border-t border-neutral-200 dark:border-neutral-800"></div>
          <div className="flex items-center space-x-3 mx-3">
            {(processedButtons as ButtonConfig[]).map((button, index) => (
              <React.Fragment key={`button-${index}`}>
                {index > 0 && (
                  <div className="flex-grow w-4 border-t border-neutral-200 dark:border-neutral-800"></div>
                )}
                <button
                  onClick={button.onClick}
                  className={`flex items-center justify-center text-[11px] ${
                    button.highlight || button.active
                      ? 'text-neutral-800 dark:text-white' 
                      : 'text-neutral-500 dark:text-neutral-400'
                  } ${button.className || ''}`}
                >
                  {button.icon && <span className="mr-1">{button.icon}</span>}
                  {button.text}
                </button>
              </React.Fragment>
            ))}
          </div>
          <div className="flex-grow border-t border-neutral-200 dark:border-neutral-800"></div>
        </div>
      </div>
    );
  }

  // 处理按钮组数组的情况
  return (
    <div className={baseClassName}>
      <div className="absolute bottom-full left-0 right-0 h-12 bg-gradient-to-t from-neutral-50 dark:from-neutral-900 to-transparent pointer-events-none"></div>
      <div className="relative flex items-center bg-neutral-50 dark:bg-neutral-900 py-4">
        <div className="flex-grow border-t border-neutral-200 dark:border-neutral-800"></div>
        <div className="flex items-center">
          {(processedButtons as ButtonConfig[][]).map((buttonGroup, groupIndex) => (
            <React.Fragment key={`group-${groupIndex}`}>
              {groupIndex > 0 && (
                <span className="mx-3 text-neutral-300 dark:text-neutral-600 text-xs">|</span>
              )}
              <div className="flex items-center space-x-3 mx-3">
                {buttonGroup.map((button, buttonIndex) => (
                  <React.Fragment key={`button-${groupIndex}-${buttonIndex}`}>
                    {buttonIndex > 0 && (
                      <div className="flex-grow w-4 border-t border-neutral-200 dark:border-neutral-800"></div>
                    )}
                    <button
                      onClick={button.onClick}
                      className={`flex items-center justify-center text-[11px] ${
                        button.highlight || button.active
                          ? 'text-neutral-800 dark:text-white' 
                          : 'text-neutral-500 dark:text-neutral-400'
                      } ${button.className || ''}`}
                    >
                      {button.icon && <span className="mr-1">{button.icon}</span>}
                      {button.text}
                    </button>
                  </React.Fragment>
                ))}
              </div>
            </React.Fragment>
          ))}
        </div>
        <div className="flex-grow border-t border-neutral-200 dark:border-neutral-800"></div>
      </div>
    </div>
  );
};

export default BottomActionBar; 