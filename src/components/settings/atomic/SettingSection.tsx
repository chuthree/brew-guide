import React from 'react';

interface SettingSectionProps {
  title?: string | React.ReactNode;
  footer?: string | React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

/**
 * 设置分组区域组件 - 统一的设置分组样式
 * 包含标题和内容区域，符合 iOS 设计规范
 */
const SettingSection: React.FC<SettingSectionProps> = ({
  title,
  footer,
  children,
  className = '',
}) => {
  // 判断是否需要胶囊样式：只有一个子元素且没有描述
  const isCapsule = React.useMemo(() => {
    const validChildren = React.Children.toArray(children);
    if (validChildren.length !== 1) return false;

    const child = validChildren[0];
    if (!React.isValidElement(child)) return false;

    // 如果是原生 div 容器，通常包含复杂内容，不应作为胶囊处理
    if (child.type === 'div') return false;

    // 检查 props.description 是否存在
    return !(child.props as any).description;
  }, [children]);

  // 处理子元素，自动注入 isLast 属性
  const renderChildren = () => {
    const validChildren = React.Children.toArray(children);
    return validChildren.map((child, index) => {
      if (!React.isValidElement(child)) return child;

      // 检查是否是最后一个元素
      const isLast = index === validChildren.length - 1;

      // 如果子组件已经有 isLast 属性，则不覆盖（允许手动控制）
      if ('isLast' in (child.props as any)) {
        return child;
      }

      // 注入 isLast 属性
      return React.cloneElement(child as React.ReactElement<any>, { isLast });
    });
  };

  return (
    <div className={`px-6 pb-5 ${className}`}>
      {title && (
        <div className="mb-3">
          {typeof title === 'string' ? (
            <h3 className="pl-3.5 text-sm font-semibold tracking-wider text-neutral-500 uppercase dark:text-neutral-400">
              {title}
            </h3>
          ) : (
            title
          )}
        </div>
      )}
      <div
        className={`overflow-hidden bg-neutral-100 dark:bg-neutral-800/40 ${
          isCapsule ? 'rounded-full' : 'rounded-xl'
        }`}
      >
        {renderChildren()}
      </div>
      {footer && (
        <div className="mt-2 px-3.5">
          {typeof footer === 'string' ? (
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              {footer}
            </p>
          ) : (
            footer
          )}
        </div>
      )}
    </div>
  );
};

export default SettingSection;
