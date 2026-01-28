'use client';

import React from 'react';
import { ChevronRight } from 'lucide-react';

export interface FeatureListItemProps {
  /** 左侧标签文字 */
  label: string;
  /** 右侧值文字（可选） */
  value?: string;
  /** 点击事件 */
  onClick?: () => void;
  /** 是否显示右侧箭头，默认 true */
  showArrow?: boolean;
  /** 额外的预览内容（如风味评分标签） */
  preview?: React.ReactNode;
  /** 是否是第一项（控制上边框） */
  isFirst?: boolean;
  /** 是否是最后一项（控制下边框） */
  isLast?: boolean;
  /** 自定义类名 */
  className?: string;
}

/**
 * 功能列表项组件 - 用于笔记表单底部的功能列表
 * 参考 iOS 设计规范，类似 SettingItem 的样式
 */
const FeatureListItem: React.FC<FeatureListItemProps> = ({
  label,
  value,
  onClick,
  showArrow = true,
  preview,
  isFirst = false,
  isLast = false,
  className = '',
}) => {
  return (
    <div className={className}>
      {/* 上边框（仅第一项） */}
      {isFirst && (
        <div className="border-t border-neutral-200/50 dark:border-neutral-800/50" />
      )}

      <button
        type="button"
        onClick={onClick}
        className="flex w-full items-center justify-between py-3 text-sm transition-colors"
      >
        {/* 左侧标签 */}
        <span className="font-medium text-neutral-600 dark:text-neutral-400">
          {label}
        </span>

        {/* 右侧内容 */}
        <div className="flex items-center gap-1.5">
          {value && (
            <span className="max-w-[180px] truncate font-medium text-neutral-600 dark:text-neutral-400">
              {value}
            </span>
          )}
          {showArrow && (
            <ChevronRight className="h-4 w-4 shrink-0 text-neutral-300 dark:text-neutral-600" />
          )}
        </div>
      </button>

      {/* 预览内容（如风味评分标签） */}
      {preview && <div className="pb-3">{preview}</div>}

      {/* 分隔线（非最后一项）或下边框（最后一项） */}
      <div className="border-b border-neutral-200/50 dark:border-neutral-800/50" />
    </div>
  );
};

export default FeatureListItem;
