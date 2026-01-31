'use client';

import React, { useCallback, useState, useEffect } from 'react';
import { ArrowLeft } from 'lucide-react';
import BrewingNoteForm from './BrewingNoteForm';
import { BrewingNoteData } from '@/types/app';
import { SettingsOptions } from '@/components/settings/Settings';
import AdaptiveModal from '@/components/common/ui/AdaptiveModal';

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
  // 快捷记录模式状态
  const [isQuickDecrementEdit, setIsQuickDecrementEdit] = useState(false);
  const [isQuickMode, setIsQuickMode] = useState(false);

  // 监听表单挂载事件，获取快捷扣除状态
  useEffect(() => {
    const handleFormMounted = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail?.noteId === initialData?.id) {
        setIsQuickDecrementEdit(customEvent.detail.isQuickDecrementEdit);
        setIsQuickMode(customEvent.detail.isQuickMode);
      }
    };

    window.addEventListener('brewingNoteFormMounted', handleFormMounted);
    return () => {
      window.removeEventListener('brewingNoteFormMounted', handleFormMounted);
    };
  }, [initialData?.id]);

  // 处理切换快捷记录模式
  const handleToggleQuickMode = useCallback(() => {
    window.dispatchEvent(
      new CustomEvent('toggleQuickMode', {
        detail: { noteId: initialData?.id },
      })
    );
    setIsQuickMode(!isQuickMode);
  }, [initialData?.id, isQuickMode]);
  // 处理保存
  const handleSave = useCallback(
    (updatedData: BrewingNoteData) => {
      onSave(updatedData);
    },
    [onSave]
  );

  // 处理关闭
  const handleClose = useCallback(() => {
    // 通知父组件编辑页正在关闭
    window.dispatchEvent(new CustomEvent('brewingNoteEditClosing'));
    onClose();
  }, [onClose]);

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

  return (
    <AdaptiveModal
      isOpen={showModal}
      onClose={handleClose}
      historyId="brewing-note-edit"
      drawerMaxWidth="448px"
      drawerHeight="90vh"
    >
      {({ isMediumScreen }) => (
        <div
          className={`flex h-full flex-col overflow-hidden px-6 ${isMediumScreen ? 'pt-4' : 'pt-2'}`}
        >
          {/* 顶部标题栏 */}
          <div className="flex shrink-0 items-center justify-between">
            <button
              type="button"
              onClick={handleClose}
              className="-m-3 cursor-pointer rounded-full p-3"
            >
              <ArrowLeft className="h-5 w-5 text-neutral-800 dark:text-neutral-200" />
            </button>

            {/* 占位元素，保持布局平衡 */}
            <div className="w-12"></div>
          </div>

          {/* 表单内容容器 */}
          <div className="mt-6 min-h-0 flex-1 overflow-y-auto">
            {initialData && (
              <BrewingNoteForm
                id={initialData.id}
                onClose={handleClose}
                onSave={handleSave}
                initialData={initialData}
                inBrewPage={true}
                showSaveButton={false}
                hideHeader={true}
                settings={settings}
                isCopy={isCopy}
              />
            )}
          </div>

          {/* 底部保存按钮 */}
          <div className="modal-bottom-button flex shrink-0 items-center justify-center gap-3">
            {/* 切换按钮 - 仅快捷扣除记录显示 */}
            {isQuickDecrementEdit && (
              <button
                type="button"
                onClick={handleToggleQuickMode}
                className="flex items-center justify-center rounded-full bg-neutral-100 px-6 py-3 text-neutral-800 dark:bg-neutral-800 dark:text-neutral-100"
              >
                <span className="font-medium">
                  {isQuickMode ? '记录更多' : '返回快捷记录'}
                </span>
              </button>
            )}

            {/* 保存按钮 */}
            <button
              type="button"
              onClick={handleSaveClick}
              className="flex items-center justify-center rounded-full bg-neutral-100 px-6 py-3 text-neutral-800 dark:bg-neutral-800 dark:text-neutral-100"
            >
              <span className="font-medium">保存笔记</span>
            </button>
          </div>
        </div>
      )}
    </AdaptiveModal>
  );
};

export default BrewingNoteEditModal;
