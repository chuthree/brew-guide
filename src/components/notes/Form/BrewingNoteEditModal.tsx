'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ArrowLeft } from 'lucide-react';
import BrewingNoteForm from './BrewingNoteForm';
import { BrewingNoteData } from '@/types/app';
import { SettingsOptions } from '@/components/settings/Settings';
import { Calendar } from '@/components/common/ui/Calendar';
import { getChildPageStyle } from '@/lib/navigation/pageTransition';
import { useModalHistory, modalHistory } from '@/lib/hooks/useModalHistory';

interface BrewingNoteEditModalProps {
  showModal: boolean;
  initialData: BrewingNoteData | null;
  onSave: (data: BrewingNoteData) => void;
  onClose: () => void;
  settings?: SettingsOptions;
  isCopy?: boolean; // 标记是否是复制操作
}

const BrewingNoteEditModal: React.FC<BrewingNoteEditModalProps> = ({
  showModal,
  initialData,
  onSave,
  onClose,
  settings,
  isCopy = false, // 默认不是复制操作
}) => {
  // 显示控制状态
  const [shouldRender, setShouldRender] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  // 时间戳状态管理
  const [timestamp, setTimestamp] = useState<Date>(
    new Date(initialData?.timestamp || Date.now())
  );

  // 日期选择器状态
  const [showDatePicker, setShowDatePicker] = useState(false);
  const datePickerRef = useRef<HTMLDivElement>(null);

  // 重置时间戳当初始数据变化时
  useEffect(() => {
    if (initialData) {
      setTimestamp(new Date(initialData.timestamp));
    }
  }, [initialData]);

  // 处理显示/隐藏动画
  useEffect(() => {
    if (showModal) {
      setShouldRender(true);
      // 使用 requestAnimationFrame 触发动画
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setIsVisible(true);
        });
      });
    } else {
      setIsVisible(false);
      const timer = setTimeout(() => {
        setShouldRender(false);
      }, 350); // 与动画时长匹配
      return () => clearTimeout(timer);
    }
  }, [showModal]);

  // 处理时间戳变化
  const handleTimestampChange = useCallback((newTimestamp: Date) => {
    setTimestamp(newTimestamp);
  }, []);

  // 处理日期变化
  const handleDateChange = useCallback(
    (newDate: Date) => {
      // 保持原有的时分秒，只修改年月日
      const updatedTimestamp = new Date(timestamp);
      updatedTimestamp.setFullYear(newDate.getFullYear());
      updatedTimestamp.setMonth(newDate.getMonth());
      updatedTimestamp.setDate(newDate.getDate());

      setTimestamp(updatedTimestamp);
      setShowDatePicker(false);
    },
    [timestamp]
  );

  // 点击外部关闭日期选择器
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;

      // 检查是否点击在日期选择器容器内
      if (datePickerRef.current && datePickerRef.current.contains(target)) {
        return;
      }

      // 检查是否点击在 Radix Popover 内容中（年份/月份选择器通过 Portal 渲染）
      const popoverContent = (target as Element).closest?.(
        '[data-radix-popper-content-wrapper]'
      );
      if (popoverContent) {
        return;
      }

      setShowDatePicker(false);
    };

    if (showDatePicker) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showDatePicker]);

  // 处理保存
  const handleSave = useCallback(
    (updatedData: BrewingNoteData) => {
      // 确保使用最新的时间戳
      const finalData = {
        ...updatedData,
        timestamp: timestamp.getTime(),
      };
      onSave(finalData);
    },
    [onSave, timestamp]
  );

  // 使用统一的历史栈管理
  useModalHistory({
    id: 'brewing-note-edit',
    isOpen: showModal,
    onClose: () => {
      // 通知父组件编辑页正在关闭
      window.dispatchEvent(new CustomEvent('brewingNoteEditClosing'));
      onClose();
    },
  });

  // 处理关闭 - 使用统一的历史栈管理器
  const handleClose = useCallback(() => {
    // 动画由 showModal 状态变化触发，无需手动设置 isVisible
    modalHistory.back();
  }, []);

  // 移动端优化：防止背景滚动
  useEffect(() => {
    if (showModal && isVisible) {
      // 防止背景页面滚动
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.width = '100%';
    } else {
      // 恢复背景页面滚动
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
    }

    return () => {
      // 清理函数
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
    };
  }, [showModal, isVisible]);

  // 处理保存按钮点击
  const handleSaveClick = useCallback(() => {
    if (!initialData) return;
    // 触发表单提交
    const form = document.querySelector(
      `form[id="${initialData.id}"]`
    ) as HTMLFormElement;
    if (form) {
      form.dispatchEvent(
        new Event('submit', { cancelable: true, bubbles: true })
      );
    }
  }, [initialData]);

  if (!shouldRender) return null;

  return (
    <div
      className="pt-safe-top pb-safe-bottom fixed inset-0 z-10 mx-auto overflow-auto bg-neutral-50 px-6 dark:bg-neutral-900"
      style={getChildPageStyle(isVisible)}
    >
      {/* 顶部标题栏 */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={handleClose}
          className="-m-3 p-3 text-neutral-800 dark:text-neutral-200"
        >
          <ArrowLeft size={16} />
        </button>

        {/* 中间的时间戳编辑区域 */}
        <div className="flex items-baseline">
          <span className="text-xs font-medium tracking-widest text-neutral-500 dark:text-neutral-400">
            编辑记录 ·
          </span>

          {/* 可点击的日期部分 */}
          <div className="relative ml-1" ref={datePickerRef}>
            <button
              type="button"
              onClick={() => setShowDatePicker(!showDatePicker)}
              className="cursor-pointer border-b border-dashed border-neutral-400 text-xs font-medium tracking-widest text-neutral-500 transition-colors hover:border-neutral-600 hover:text-neutral-700 dark:border-neutral-500 dark:text-neutral-400 dark:hover:border-neutral-400 dark:hover:text-neutral-300"
            >
              {`${timestamp.getFullYear()}-${String(timestamp.getMonth() + 1).padStart(2, '0')}-${String(timestamp.getDate()).padStart(2, '0')}`}
            </button>

            {/* 日期选择器 */}
            {showDatePicker && (
              <div
                className="absolute top-full left-1/2 z-50 mt-2 -translate-x-1/2 transform rounded-lg border border-neutral-200 bg-white shadow-lg dark:border-neutral-800 dark:bg-neutral-900"
                style={{ width: '280px' }}
              >
                <Calendar
                  selected={timestamp}
                  onSelect={handleDateChange}
                  locale="zh-CN"
                  initialFocus
                />
              </div>
            )}
          </div>
        </div>

        {/* 占位元素，保持布局平衡 */}
        <div className="w-12"></div>
      </div>

      {/* 表单内容容器 */}
      <div className="mt-6 flex-1">
        {initialData && (
          <BrewingNoteForm
            id={initialData.id}
            onClose={handleClose}
            onSave={handleSave}
            initialData={initialData}
            inBrewPage={true}
            showSaveButton={false}
            hideHeader={true}
            onTimestampChange={handleTimestampChange}
            settings={settings}
            isCopy={isCopy}
          />
        )}
      </div>

      {/* 底部保存按钮 - 使用sticky定位相对于容器固定 */}
      <div className="modal-bottom-button flex items-center justify-center">
        <button
          type="button"
          onClick={handleSaveClick}
          className="flex items-center justify-center rounded-full bg-neutral-100 px-6 py-3 text-neutral-800 dark:bg-neutral-800 dark:text-neutral-100"
        >
          <span className="font-medium">保存笔记</span>
        </button>
      </div>
    </div>
  );
};

export default BrewingNoteEditModal;
