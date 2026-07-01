'use client';

import React, { useCallback, useState } from 'react';
import { ArrowLeft, CornerDownRight } from 'lucide-react';
import BrewingNoteForm from './BrewingNoteForm';
import { BrewingNoteData } from '@/types/app';
import { SettingsOptions } from '@/components/settings/Settings';
import AdaptiveModal from '@/components/common/ui/AdaptiveModal';
import { deriveNavigationSettings } from '@/lib/navigation/navigationSettings';
import type { BrewingNoteDraftData } from './brewingNoteDraft';
import { canSwitchPlainNoteToQuickRecord } from './quickRecordConversion';

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
  const navigationState = deriveNavigationSettings(
    settings?.navigationSettings
  );
  const canUseNotesModule = navigationState.visibleTabs.notes;
  const canUseCoffeeBeanModule = navigationState.visibleTabs.coffeeBean;
  const isChangeRecordEdit =
    !isCopy &&
    (initialData?.source === 'quick-decrement' ||
      initialData?.source === 'capacity-adjustment');
  const noteId = initialData?.id;
  const [draftSnapshot, setDraftSnapshot] =
    useState<BrewingNoteDraftData | null>(null);
  const [quickModeOverride, setQuickModeOverride] = useState<{
    noteId: string;
    isQuickMode: boolean;
  } | null>(null);
  const isQuickMode =
    quickModeOverride && quickModeOverride.noteId === noteId
      ? quickModeOverride.isQuickMode
      : isChangeRecordEdit;
  const currentDraft =
    draftSnapshot && draftSnapshot.id === noteId ? draftSnapshot : null;
  const currentContent = currentDraft || initialData;
  const canShowQuickRecordConversionButton = canSwitchPlainNoteToQuickRecord({
    noteId,
    isCopy,
    source: initialData?.source,
    canUseNotesModule,
    canUseCoffeeBeanModule,
    notes: currentContent?.notes,
  });
  const isPlainNoteQuickMode =
    !isChangeRecordEdit && !initialData?.source && isQuickMode;
  const canShowQuickModeToggle =
    canUseNotesModule &&
    (isChangeRecordEdit ||
      canShowQuickRecordConversionButton ||
      isPlainNoteQuickMode);
  const quickModeToggleLabel = isQuickMode
    ? '记录更多'
    : isChangeRecordEdit
      ? initialData?.source === 'capacity-adjustment'
        ? '返回变动记录'
        : '返回快捷记录'
      : '转为快捷记录';
  const saveButtonLabel =
    isQuickMode &&
    (isChangeRecordEdit ||
      canShowQuickRecordConversionButton ||
      isPlainNoteQuickMode)
      ? '保存记录'
      : canUseNotesModule
        ? '保存笔记'
        : '保存记录';

  // 处理切换快捷记录模式
  const handleToggleQuickMode = useCallback(() => {
    if (!noteId) return;

    setQuickModeOverride(current => ({
      noteId,
      isQuickMode:
        current?.noteId === noteId ? !current.isQuickMode : !isChangeRecordEdit,
    }));
  }, [isChangeRecordEdit, noteId, setQuickModeOverride]);
  // 处理保存
  const handleSave = useCallback(
    (updatedData: BrewingNoteData) => {
      setQuickModeOverride(null);
      setDraftSnapshot(null);
      onSave(updatedData);
    },
    [onSave, setDraftSnapshot, setQuickModeOverride]
  );

  // 处理关闭
  const handleClose = useCallback(() => {
    // 通知父组件编辑页正在关闭
    window.dispatchEvent(new CustomEvent('brewingNoteEditClosing'));
    setQuickModeOverride(null);
    setDraftSnapshot(null);
    onClose();
  }, [onClose, setDraftSnapshot, setQuickModeOverride]);

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
                isQuickMode={isQuickMode}
                onDraftChange={setDraftSnapshot}
              />
            )}
          </div>

          {/* 底部保存按钮 */}
          <div className="modal-bottom-button flex shrink-0 items-center justify-center gap-3">
            {canShowQuickModeToggle && (
              <button
                type="button"
                onClick={handleToggleQuickMode}
                className="flex items-center justify-center gap-1.5 rounded-full bg-neutral-100 px-5 py-3 text-neutral-800 transition-colors hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-100 dark:hover:bg-neutral-700"
              >
                {!isChangeRecordEdit && !isQuickMode && (
                  <CornerDownRight className="h-4 w-4" />
                )}
                <span className="font-medium">{quickModeToggleLabel}</span>
              </button>
            )}

            {/* 保存按钮 */}
            <button
              type="button"
              onClick={handleSaveClick}
              className="flex items-center justify-center rounded-full bg-neutral-100 px-6 py-3 text-neutral-800 dark:bg-neutral-800 dark:text-neutral-100"
            >
              <span className="font-medium">{saveButtonLabel}</span>
            </button>
          </div>
        </div>
      )}
    </AdaptiveModal>
  );
};

export default BrewingNoteEditModal;
