'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Reorder } from 'framer-motion';

import type { SettingsOptions } from './Settings';
import {
  SettingPage,
  SettingReorderableRow,
  SettingRow,
  SettingSection,
} from './atomic';
import { makeDynamicSettingSearchId } from './settingsSearch';
import PageStackDrawer from '@/components/common/ui/PageStackDrawer';
import ConfirmDrawer from '@/components/common/ui/ConfirmDrawer';
import DeleteConfirmDrawer from '@/components/common/ui/DeleteConfirmDrawer';
import { modalHistory, useModalHistory } from '@/lib/hooks/useModalHistory';
import type { FlavorDimension } from '@/lib/core/db';
import {
  getFlavorDimensionsSync,
  getSettingsStore,
  useSettingsStore,
} from '@/lib/stores/settingsStore';
import hapticsUtils from '@/lib/ui/haptics';

interface FlavorDimensionSettingsProps {
  settings: SettingsOptions;
  onClose: () => void;
  handleChange: <K extends keyof SettingsOptions>(
    key: K,
    value: SettingsOptions[K]
  ) => void | Promise<void>;
}

interface DimensionDraft {
  id: string | null;
  label: string;
  isDefault: boolean;
}

interface DimensionEditorDrawerProps {
  draft: DimensionDraft | null;
  onLabelChange: (label: string) => void;
  onCancel: () => void;
  onDone: () => void;
  onDelete: () => void;
}

const readFlavorDimensions = (): FlavorDimension[] => {
  try {
    return getFlavorDimensionsSync();
  } catch (error) {
    console.error('加载评分维度失败:', error);
    return [];
  }
};

const DimensionEditorDrawer: React.FC<DimensionEditorDrawerProps> = ({
  draft,
  onLabelChange,
  onCancel,
  onDone,
  onDelete,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!draft) return;

    const frame = requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });

    return () => cancelAnimationFrame(frame);
  }, [draft]);

  return (
    <PageStackDrawer
      isOpen={Boolean(draft)}
      title={draft?.id ? '编辑维度' : '新建维度'}
      activeKey={draft?.id || 'new'}
      canGoBack={false}
      doneDisabled={!draft?.label.trim()}
      onCancel={onCancel}
      onBack={onCancel}
      onDone={onDone}
      historyId="flavor-dimension-editor-drawer"
    >
      <div>
        <SettingSection title="维度名称">
          <SettingRow vertical>
            <input
              ref={inputRef}
              value={draft?.label || ''}
              onChange={event => onLabelChange(event.target.value)}
              onKeyDown={event => {
                if (event.key === 'Enter' && draft?.label.trim()) {
                  onDone();
                }
              }}
              placeholder="输入评分维度名称"
              className="w-full bg-transparent text-sm text-neutral-900 outline-none placeholder:text-neutral-400 dark:text-neutral-50 dark:placeholder:text-neutral-500"
              autoComplete="off"
              id="flavor-dimension-name-input"
            />
          </SettingRow>
        </SettingSection>

        {draft?.id && !draft.isDefault && (
          <SettingSection title="操作">
            <button
              type="button"
              onClick={onDelete}
              className="flex w-full cursor-pointer items-center px-3.5 py-3.5 text-left text-sm font-medium text-neutral-600 transition active:bg-black/5 dark:text-neutral-300 dark:active:bg-white/5"
            >
              删除维度
            </button>
          </SettingSection>
        )}
      </div>
    </PageStackDrawer>
  );
};

const FlavorDimensionSettings: React.FC<FlavorDimensionSettingsProps> = ({
  settings: _settings,
  onClose,
  handleChange: _handleChange,
}) => {
  const settings = useSettingsStore(state => state.settings) as SettingsOptions;
  const [shouldRender] = useState(true);
  const [isVisible, setIsVisible] = useState(false);
  const [dimensions, setDimensions] =
    useState<FlavorDimension[]>(readFlavorDimensions);
  const [isReorderMode, setIsReorderMode] = useState(false);
  const [draft, setDraft] = useState<DimensionDraft | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<FlavorDimension | null>(
    null
  );

  const onCloseRef = React.useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  const triggerLightHaptic = React.useCallback(() => {
    if (settings.hapticFeedback) {
      hapticsUtils.light();
    }
  }, [settings.hapticFeedback]);

  const handleCloseWithAnimation = React.useCallback(() => {
    setIsVisible(false);
    window.dispatchEvent(new CustomEvent('subSettingsClosing'));
    setTimeout(() => {
      onCloseRef.current();
    }, 350);
  }, []);

  useModalHistory({
    id: 'flavor-dimension-settings',
    isOpen: true,
    onClose: handleCloseWithAnimation,
    skipPageExitTransitionOnHistory: true,
  });

  const handleClose = () => {
    modalHistory.back();
  };

  useEffect(() => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setIsVisible(true);
      });
    });
  }, []);

  const loadDimensions = React.useCallback(() => {
    setDimensions(readFlavorDimensions());
  }, []);

  const openCreateDrawer = React.useCallback(() => {
    setDraft({
      id: null,
      label: '',
      isDefault: false,
    });
  }, []);

  const openEditDrawer = React.useCallback((dimension: FlavorDimension) => {
    setDraft({
      id: dimension.id,
      label: dimension.label,
      isDefault: Boolean(dimension.isDefault),
    });
  }, []);

  const closeEditor = React.useCallback(() => {
    setDraft(null);
  }, []);

  const saveDraft = React.useCallback(async () => {
    const trimmedLabel = draft?.label.trim();
    if (!draft || !trimmedLabel) return;

    try {
      if (draft.id) {
        await getSettingsStore().updateFlavorDimension(draft.id, {
          label: trimmedLabel,
        });
      } else {
        await getSettingsStore().addFlavorDimension(trimmedLabel);
      }

      loadDimensions();
      closeEditor();
      triggerLightHaptic();
    } catch (error) {
      console.error(
        draft.id ? '更新评分维度失败:' : '添加评分维度失败:',
        error
      );
      alert(draft.id ? '更新评分维度失败，请重试' : '添加评分维度失败，请重试');
    }
  }, [closeEditor, draft, loadDimensions, triggerLightHaptic]);

  const promptDeleteDimension = React.useCallback(() => {
    if (!draft?.id || draft.isDefault) return;

    const target = dimensions.find(dimension => dimension.id === draft.id);
    if (!target) return;

    setDeleteTarget(target);
    setShowDeleteConfirm(true);
  }, [dimensions, draft]);

  const executeDeleteDimension = React.useCallback(async () => {
    if (!deleteTarget) return;

    try {
      await getSettingsStore().deleteFlavorDimension(deleteTarget.id);
      loadDimensions();
      closeEditor();
      triggerLightHaptic();
    } catch (error) {
      console.error('删除评分维度失败:', error);
      alert('删除评分维度失败，请重试');
    }
  }, [closeEditor, deleteTarget, loadDimensions, triggerLightHaptic]);

  const executeResetToDefault = React.useCallback(async () => {
    try {
      await getSettingsStore().resetFlavorDimensions();
      loadDimensions();
      setIsReorderMode(false);

      if (settings.hapticFeedback) {
        hapticsUtils.medium();
      }
    } catch (error) {
      console.error('重置评分维度失败:', error);
      alert('重置评分维度失败，请重试');
    }
  }, [loadDimensions, settings.hapticFeedback]);

  const handleReorder = React.useCallback(
    async (newOrder: FlavorDimension[]) => {
      try {
        setDimensions(newOrder);
        await getSettingsStore().reorderFlavorDimensions(newOrder);
        triggerLightHaptic();
      } catch (error) {
        console.error('重新排序失败:', error);
        alert('重新排序失败，请重试');
        loadDimensions();
      }
    },
    [loadDimensions, triggerLightHaptic]
  );

  const toggleReorderMode = React.useCallback(() => {
    setIsReorderMode(current => !current);
    triggerLightHaptic();
  }, [triggerLightHaptic]);

  const dimensionSectionTitle = (
    <div className="flex items-center justify-between pl-3.5">
      <h3 className="text-sm font-semibold tracking-wider text-neutral-500 uppercase dark:text-neutral-400">
        当前维度
      </h3>
      {dimensions.length > 1 && (
        <button
          type="button"
          onClick={toggleReorderMode}
          className="flex cursor-pointer items-center rounded-full px-3 text-sm font-medium text-neutral-600 transition-transform active:scale-[0.96] dark:text-neutral-300"
        >
          {isReorderMode ? '完成' : '编辑'}
        </button>
      )}
    </div>
  );

  if (!shouldRender) return null;

  return (
    <>
      <SettingPage title="评分维度" isVisible={isVisible} onClose={handleClose}>
        <SettingSection title={dimensionSectionTitle} className="-mt-4">
          {dimensions.length === 0 ? (
            <button
              type="button"
              onClick={openCreateDrawer}
              className="flex w-full cursor-pointer items-center px-3.5 py-3.5 text-left transition active:bg-black/5 dark:active:bg-white/5"
            >
              <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                新建维度
              </span>
            </button>
          ) : (
            <div>
              <div className="px-3.5">
                <button
                  type="button"
                  onClick={openCreateDrawer}
                  className="flex w-full cursor-pointer items-center border-b border-black/5 py-3.5 text-left transition active:opacity-70 dark:border-white/5"
                >
                  <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                    新建维度
                  </span>
                </button>
              </div>

              <Reorder.Group
                axis="y"
                values={dimensions}
                onReorder={handleReorder}
                className="m-0 list-none p-0"
              >
                {dimensions.map((dimension, index) => (
                  <SettingReorderableRow
                    key={dimension.id}
                    value={dimension}
                    label={dimension.label}
                    settingId={makeDynamicSettingSearchId(
                      'dimension',
                      dimension.id
                    )}
                    isLast={index === dimensions.length - 1}
                    isReorderMode={isReorderMode}
                    onOpen={openEditDrawer}
                    onDragEnd={triggerLightHaptic}
                  />
                ))}
              </Reorder.Group>
            </div>
          )}
        </SettingSection>

        <SettingSection title="操作">
          <button
            type="button"
            onClick={() => setShowResetConfirm(true)}
            className="flex w-full cursor-pointer items-center px-3.5 py-3.5 text-left text-sm font-medium text-neutral-600 transition active:bg-black/5 dark:text-neutral-300 dark:active:bg-white/5"
          >
            重置为默认维度
          </button>
        </SettingSection>
      </SettingPage>

      <DimensionEditorDrawer
        draft={draft}
        onLabelChange={label =>
          setDraft(current => (current ? { ...current, label } : current))
        }
        onCancel={closeEditor}
        onDone={() => void saveDraft()}
        onDelete={promptDeleteDimension}
      />

      <DeleteConfirmDrawer
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={() => {
          void executeDeleteDimension();
        }}
        itemName={deleteTarget?.label || ''}
        itemType="评分维度"
        onExitComplete={() => setDeleteTarget(null)}
      />

      <ConfirmDrawer
        isOpen={showResetConfirm}
        onClose={() => setShowResetConfirm(false)}
        onConfirm={() => {
          void executeResetToDefault();
        }}
        confirmText="重置"
        isDanger
        message={
          <>
            确认将评分维度恢复为默认配置吗？
            <span className="text-neutral-800 dark:text-neutral-200">
              所有自定义维度都会被移除
            </span>
            ，此操作不可撤销。
          </>
        }
      />
    </>
  );
};

export default FlavorDimensionSettings;
