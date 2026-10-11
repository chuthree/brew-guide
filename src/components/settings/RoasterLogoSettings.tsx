'use client';

import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from 'react';
import Image from 'next/image';
import { getSettingsStore, useSettingsStore } from '@/lib/stores/settingsStore';
import type { RoasterConfig } from '@/lib/data/models';
import { extractUniqueRoasters } from '@/lib/utils/beanVarietyUtils';
import { useCoffeeBeanStore } from '@/lib/stores/coffeeBeanStore';
import { ExtendedCoffeeBean } from '@/components/coffee-bean/List/types';
import hapticsUtils from '@/lib/ui/haptics';
import { useModalHistory, modalHistory } from '@/lib/hooks/useModalHistory';
import { openImageViewer } from '@/lib/ui/imageViewer';
import {
  SettingPage,
  SettingSection,
  SettingRow,
  useScrollToHighlightedSetting,
} from './atomic';
import DeleteConfirmDrawer from '@/components/common/ui/DeleteConfirmDrawer';
import ConfirmDrawer from '@/components/common/ui/ConfirmDrawer';
import RoasterLogoImportExport from './RoasterLogoImportExport';
import { renameRoasters } from '@/lib/utils/roasterRename';
import DataAlertIcon from '@public/images/icons/ui/data-alert.svg';
import { compressBase64Image } from '@/lib/utils/imageCapture';
import { TempFileManager } from '@/lib/utils/tempFileManager';
import { showToast } from '@/components/common/feedback/LightToast';
import { makeDynamicSettingSearchId } from './settingsSearch';
import SettingsSearchBar from './SettingsSearchBar';

interface RoasterLogoSettingsProps {
  isOpen: boolean;
  onClose: () => void;
  hapticFeedback: boolean;
}

interface RoasterEditState {
  isEditing: boolean;
  drafts: Record<string, string>;
  isSaving: boolean;
}

const RoasterLogoSettings: React.FC<RoasterLogoSettingsProps> = ({
  isOpen,
  onClose,
  hapticFeedback,
}) => {
  const [shouldRender, setShouldRender] = useState(isOpen);
  const [isVisible, setIsVisible] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const [roasterEditState, setRoasterEditState] = useState<RoasterEditState>({
    isEditing: false,
    drafts: {},
    isSaving: false,
  });
  const {
    isEditing: isEditingRoasters,
    drafts: draftRoasterNames,
    isSaving: isSavingRoasters,
  } = roasterEditState;
  const fileInputRefs = useRef<Map<string, HTMLInputElement>>(new Map());
  const nameInputRefs = useRef<Map<string, HTMLInputElement>>(new Map());
  const [focusedRoasterName, setFocusedRoasterName] = useState<string | null>(
    null
  );
  const beans = useCoffeeBeanStore(
    state => state.beans as ExtendedCoffeeBean[]
  );
  const roasterFieldEnabled = useSettingsStore(
    state => state.settings.roasterFieldEnabled
  );
  const roasterSeparator = useSettingsStore(
    state => state.settings.roasterSeparator
  );
  const roasterConfigList = useSettingsStore(
    state => state.settings.roasterConfigs || []
  );
  const [searchQuery, setSearchQuery] = useState('');
  const roasters = useMemo(
    () =>
      extractUniqueRoasters(beans, {
        roasterFieldEnabled,
        roasterSeparator,
      }),
    [beans, roasterFieldEnabled, roasterSeparator]
  );
  const roasterConfigs = useMemo(() => {
    const configMap = new Map<string, RoasterConfig>();
    roasterConfigList.forEach(config => {
      configMap.set(config.roasterName, config);
    });
    return configMap;
  }, [roasterConfigList]);
  const filteredRoasters = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return roasters;

    return roasters.filter(roaster => roaster.toLowerCase().includes(query));
  }, [roasters, searchQuery]);
  useScrollToHighlightedSetting(filteredRoasters.join('\n'));

  // 删除确认抽屉状态
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteRoasterName, setDeleteRoasterName] = useState<string | null>(
    null
  );
  const [showRenameConfirm, setShowRenameConfirm] = useState(false);

  // 导入导出抽屉状态
  const [showImportExport, setShowImportExport] = useState(false);
  const [importExportMode, setImportExportMode] = useState<'import' | 'export'>(
    'export'
  );

  // 用于保存最新的 onClose 引用
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  // 关闭处理函数（带动画）
  const handleCloseWithAnimation = React.useCallback(() => {
    setIsVisible(false);
    window.dispatchEvent(new CustomEvent('subSettingsClosing'));
    setTimeout(() => {
      onCloseRef.current();
    }, 350);
  }, []);

  // 使用统一的历史栈管理系统
  useModalHistory({
    id: 'roaster-logo-settings',
    isOpen,
    onClose: handleCloseWithAnimation,
    skipPageExitTransitionOnHistory: true,
  });

  // 处理显示/隐藏动画
  useEffect(() => {
    if (isOpen) {
      setShouldRender(isOpen);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setIsVisible(true);
        });
      });
      setFocusedRoasterName(null);
    } else {
      setIsVisible(isOpen);
      const timer = setTimeout(() => setShouldRender(false), 350);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const handleClose = () => {
    if (isEditingRoasters) {
      setRoasterEditState({
        isEditing: false,
        drafts: {},
        isSaving: false,
      });
    }
    modalHistory.back();
  };

  // 将文件转换为 base64
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleFileSelect = async (roasterName: string, file: File) => {
    if (!file) return;

    // 仅支持 JPG、PNG、WebP、HEIC 格式
    const allowedTypes = [
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/heic',
      'image/heif',
    ];
    if (!allowedTypes.includes(file.type)) {
      alert('请上传 JPG、PNG 或 WebP 格式的图片');
      return;
    }

    // 验证文件大小（最大5MB）
    if (file.size > 5 * 1024 * 1024) {
      alert('图片文件不能超过5MB');
      return;
    }

    setUploading(roasterName);

    try {
      const base64 = await fileToBase64(file);
      const compressedBase64 = await compressBase64Image(base64, {
        maxSizeMB: 0.12,
        maxWidthOrHeight: 512,
        initialQuality: 0.9,
      });
      await getSettingsStore().updateRoasterConfig(roasterName, {
        logoData: compressedBase64,
      });
      if (hapticFeedback) {
        hapticsUtils.success();
      }
    } catch (error) {
      console.error('Upload error:', error);
      alert('添加失败：' + (error as Error).message);
      if (hapticFeedback) {
        hapticsUtils.error();
      }
    } finally {
      setUploading(null);
    }
  };

  const handleDeleteLogo = async (roasterName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleteRoasterName(roasterName);
    setShowDeleteConfirm(true);
  };

  const executeDeleteLogo = async (roasterName: string) => {
    try {
      const currentConfig = roasterConfigs.get(roasterName);
      if (currentConfig) {
        await getSettingsStore().updateRoasterConfig(roasterName, {
          logoData: undefined,
          flavorPeriod: currentConfig.flavorPeriod,
        });
      }
      if (hapticFeedback) {
        hapticsUtils.success();
      }
    } catch (error) {
      console.error('Delete error:', error);
      if (hapticFeedback) {
        hapticsUtils.error();
      }
    }
  };

  const triggerFileInput = (roasterName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const input = fileInputRefs.current.get(roasterName);
    if (input) {
      input.click();
    }
  };

  const handleLogoPreviewClick = useCallback(
    (
      roasterName: string,
      logoData: string,
      sourceElement: HTMLElement | null
    ) => {
      openImageViewer({
        url: logoData,
        alt: `${roasterName} 图标`,
        sourceElement,
        action: {
          label: '保存到相册',
          loadingLabel: '保存中...',
          ariaLabel: `保存 ${roasterName} 图标到相册`,
          onClick: async () => {
            try {
              const outcome =
                await TempFileManager.saveImageToGallery(logoData);
              if (outcome === 'saved' || outcome === 'downloaded') {
                showToast({
                  type: 'success',
                  title: outcome === 'saved' ? '已保存到相册' : '图片已保存',
                });
                if (hapticFeedback) {
                  hapticsUtils.success();
                }
              }
            } catch (error) {
              console.error('Save roaster logo error:', error);
              showToast({ type: 'error', title: '保存失败' });
              if (hapticFeedback) {
                hapticsUtils.error();
              }
            }
          },
        },
      });
    },
    [hapticFeedback]
  );

  // 打开导出抽屉
  const handleOpenExport = useCallback(() => {
    setImportExportMode('export');
    setShowImportExport(true);
  }, []);

  // 打开导入抽屉
  const handleOpenImport = useCallback(() => {
    setImportExportMode('import');
    setShowImportExport(true);
  }, []);

  // 导入后 settings store 会触发配置刷新
  const handleImportComplete = useCallback(() => {}, []);

  const handleStartEditRoasters = useCallback(() => {
    setRoasterEditState({
      isEditing: true,
      drafts: roasters.reduce<Record<string, string>>((drafts, roaster) => {
        drafts[roaster] = roaster;
        return drafts;
      }, {}),
      isSaving: false,
    });
    setFocusedRoasterName(null);
  }, [roasters]);

  const handleCancelEditRoasters = useCallback(() => {
    setRoasterEditState({
      isEditing: false,
      drafts: {},
      isSaving: false,
    });
    setFocusedRoasterName(null);
  }, []);

  const hasInvalidDraftRoasterName = React.useMemo(
    () =>
      roasters.some(roaster => {
        const draftName = draftRoasterNames[roaster] ?? roaster;
        return draftName.trim().length === 0;
      }),
    [draftRoasterNames, roasters]
  );

  const hasDraftRoasterChanges = React.useMemo(
    () =>
      roasters.some(roaster => {
        const draftName = draftRoasterNames[roaster] ?? roaster;
        return draftName.trim() !== roaster;
      }),
    [draftRoasterNames, roasters]
  );

  const pendingRenameCount = React.useMemo(
    () =>
      roasters.reduce((count, roaster) => {
        const draftName = draftRoasterNames[roaster] ?? roaster;
        return draftName.trim() !== roaster ? count + 1 : count;
      }, 0),
    [draftRoasterNames, roasters]
  );

  const buildRenameEntries = useCallback(
    () =>
      roasters.reduce<Record<string, string>>((entries, roaster) => {
        entries[roaster] = draftRoasterNames[roaster] ?? roaster;
        return entries;
      }, {}),
    [draftRoasterNames, roasters]
  );

  const focusRoasterNameInput = useCallback((roasterName: string) => {
    setFocusedRoasterName(roasterName);
    requestAnimationFrame(() => {
      nameInputRefs.current.get(roasterName)?.focus();
    });
  }, []);

  const handleRequestSaveRoasters = useCallback(() => {
    if (isSavingRoasters || hasInvalidDraftRoasterName) {
      return;
    }

    if (!hasDraftRoasterChanges) {
      handleCancelEditRoasters();
      return;
    }

    setShowRenameConfirm(true);
  }, [
    handleCancelEditRoasters,
    hasDraftRoasterChanges,
    hasInvalidDraftRoasterName,
    isSavingRoasters,
  ]);

  const executeSaveRoasters = useCallback(async () => {
    if (isSavingRoasters || hasInvalidDraftRoasterName) {
      return;
    }

    const renameEntries = buildRenameEntries();

    if (!hasDraftRoasterChanges) {
      handleCancelEditRoasters();
      return;
    }

    setRoasterEditState(current => ({
      ...current,
      isSaving: true,
    }));

    try {
      const result = await renameRoasters(renameEntries);

      setRoasterEditState({
        isEditing: false,
        drafts: {},
        isSaving: false,
      });

      setFocusedRoasterName(null);

      if (hapticFeedback) {
        result.updatedBeanCount > 0
          ? hapticsUtils.success()
          : hapticsUtils.light();
      }
    } catch (error) {
      console.error('Rename roasters error:', error);
      alert('保存失败：' + (error as Error).message);
      if (hapticFeedback) {
        hapticsUtils.error();
      }
    } finally {
      setRoasterEditState(current => ({
        ...current,
        isSaving: false,
      }));
    }
  }, [
    buildRenameEntries,
    handleCancelEditRoasters,
    hasDraftRoasterChanges,
    hasInvalidDraftRoasterName,
    hapticFeedback,
    isSavingRoasters,
  ]);

  if (!shouldRender) return null;

  return (
    <SettingPage
      title="烘焙商图标"
      isVisible={isVisible}
      onClose={handleClose}
      bottomContent={
        <SettingsSearchBar
          isVisible={isVisible}
          query={searchQuery}
          firstResult={null}
          placeholder="搜索烘焙商"
          onQueryChange={setSearchQuery}
          onSelect={() => {}}
        />
      }
    >
      <SettingSection
        title={
          <div className="flex min-w-0 items-center justify-between gap-3 pl-3.5">
            <h3 className="text-sm leading-none font-semibold tracking-wider text-neutral-500 uppercase dark:text-neutral-400">
              烘焙商 ({filteredRoasters.length})
            </h3>
            {(isEditingRoasters || filteredRoasters.length > 0) &&
              (isEditingRoasters ? (
                <div className="flex shrink-0 items-center">
                  <button
                    type="button"
                    onClick={handleCancelEditRoasters}
                    disabled={isSavingRoasters}
                    className="flex shrink-0 cursor-pointer items-center rounded-full px-3 text-sm font-medium whitespace-nowrap text-neutral-600 transition-transform active:scale-[0.96] disabled:opacity-40 dark:text-neutral-300"
                  >
                    取消
                  </button>
                  <button
                    type="button"
                    onClick={handleRequestSaveRoasters}
                    disabled={
                      isSavingRoasters ||
                      hasInvalidDraftRoasterName ||
                      !hasDraftRoasterChanges
                    }
                    className="flex shrink-0 cursor-pointer items-center rounded-full px-3 text-sm font-medium whitespace-nowrap text-neutral-600 transition-transform active:scale-[0.96] disabled:opacity-40 dark:text-neutral-300"
                  >
                    {isSavingRoasters ? '保存中…' : '保存'}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleStartEditRoasters}
                  className="flex shrink-0 cursor-pointer items-center rounded-full px-3 text-sm font-medium whitespace-nowrap text-neutral-600 transition-transform active:scale-[0.96] dark:text-neutral-300"
                >
                  编辑
                </button>
              ))}
          </div>
        }
        className="-mt-4"
        contentShape="card"
        footer={
          isEditingRoasters
            ? hasInvalidDraftRoasterName
              ? '烘焙商名称不能为空。'
              : '修改名称会同步更新相关咖啡豆、冲煮记录和图标配置。'
            : roasters.length === 0
              ? '添加咖啡豆后，烘焙商会自动出现在这里。'
              : undefined
        }
      >
        {filteredRoasters.length === 0 ? (
          <SettingRow
            label={
              roasters.length === 0 ? '暂无烘焙商' : '没有找到匹配的烘焙商'
            }
            isLast
          >
            {null}
          </SettingRow>
        ) : (
          filteredRoasters.map((roaster, index) => {
            const logoData = roasterConfigs.get(roaster)?.logoData;
            const isUploading = uploading === roaster;
            const draftName = draftRoasterNames[roaster] ?? roaster;
            const normalizedDraftName = draftName.trim();
            const hasDraftNameChange =
              normalizedDraftName.length > 0 && normalizedDraftName !== roaster;
            const shouldShowRenamePreview =
              isEditingRoasters &&
              !isSavingRoasters &&
              hasDraftNameChange &&
              focusedRoasterName !== roaster;
            return (
              <SettingRow
                key={roaster}
                settingId={makeDynamicSettingSearchId('roaster', roaster)}
                vertical
                isLast={index === filteredRoasters.length - 1}
              >
                <div className="flex h-4 min-w-0 items-center justify-between gap-3">
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    {logoData ? (
                      <button
                        type="button"
                        onClick={event =>
                          handleLogoPreviewClick(
                            roaster,
                            logoData,
                            event.currentTarget
                          )
                        }
                        disabled={isUploading}
                        className="relative size-6 shrink-0 cursor-zoom-in overflow-hidden rounded-sm active:opacity-70 disabled:opacity-40"
                        aria-label={`放大 ${roaster} 的图标`}
                      >
                        <Image
                          src={logoData}
                          alt={roaster}
                          fill
                          sizes="24px"
                          className="object-cover"
                          unoptimized
                        />
                      </button>
                    ) : (
                      <span
                        aria-hidden="true"
                        className="flex size-6 shrink-0 items-center justify-center text-sm leading-none font-normal text-neutral-400 dark:text-neutral-500"
                      >
                        {roaster.charAt(0)}
                      </span>
                    )}
                    {isEditingRoasters ? (
                      <div className="relative flex h-4 min-w-0 flex-1 items-center">
                        <input
                          ref={el => {
                            if (el) {
                              nameInputRefs.current.set(roaster, el);
                            } else {
                              nameInputRefs.current.delete(roaster);
                            }
                          }}
                          value={draftName}
                          onFocus={() => setFocusedRoasterName(roaster)}
                          onBlur={() =>
                            setFocusedRoasterName(current =>
                              current === roaster ? null : current
                            )
                          }
                          onChange={e =>
                            setRoasterEditState(current => ({
                              ...current,
                              drafts: {
                                ...current.drafts,
                                [roaster]: e.target.value,
                              },
                            }))
                          }
                          disabled={isSavingRoasters}
                          className={`block h-4 w-full min-w-0 bg-transparent p-0 text-sm leading-none font-medium text-neutral-800 transition-[color,opacity] duration-150 outline-none placeholder:text-neutral-400 disabled:opacity-60 dark:text-neutral-200 dark:placeholder:text-neutral-600 ${
                            shouldShowRenamePreview
                              ? 'pointer-events-none opacity-0'
                              : 'opacity-100'
                          }`}
                          aria-label={`编辑 ${roaster} 的烘焙商名称`}
                          aria-invalid={draftName.trim().length === 0}
                          autoComplete="off"
                          spellCheck={false}
                        />

                        {shouldShowRenamePreview && (
                          <button
                            type="button"
                            onMouseDown={e => e.preventDefault()}
                            onClick={() => focusRoasterNameInput(roaster)}
                            className="roaster-rename-preview absolute inset-0 flex min-w-0 cursor-text items-center gap-2 text-left"
                            aria-label={`继续编辑 ${roaster}，当前目标名称为 ${normalizedDraftName}`}
                          >
                            <span className="roaster-rename-preview-old relative max-w-[42%] min-w-0 truncate text-sm leading-none font-medium text-neutral-500/60 dark:text-neutral-400/60">
                              {roaster}
                              <span
                                aria-hidden="true"
                                className="roaster-rename-preview-line"
                              />
                            </span>
                            <span
                              aria-hidden="true"
                              className="h-px w-3 shrink-0 bg-neutral-300/70 dark:bg-neutral-600/70"
                            />
                            <span className="roaster-rename-preview-new min-w-0 flex-1 truncate text-sm leading-none font-medium text-neutral-800 dark:text-neutral-200">
                              {normalizedDraftName}
                            </span>
                          </button>
                        )}
                      </div>
                    ) : (
                      <span className="min-w-0 truncate text-sm leading-none font-medium text-neutral-800 dark:text-neutral-200">
                        {roaster}
                      </span>
                    )}
                  </div>
                  {!isEditingRoasters && (
                    <div className="flex h-4 shrink-0 items-center gap-3">
                      {logoData && (
                        <button
                          type="button"
                          onClick={e => handleDeleteLogo(roaster, e)}
                          disabled={isUploading}
                          aria-label={`删除 ${roaster} 的图标`}
                          className="-my-3.5 flex h-11 items-center text-sm leading-none font-normal text-neutral-600 active:opacity-70 disabled:opacity-40 dark:text-neutral-300"
                        >
                          删除
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={e => triggerFileInput(roaster, e)}
                        disabled={isUploading}
                        aria-label={`${logoData ? '更换' : '添加'} ${roaster} 的图标`}
                        className="-my-3.5 flex h-11 items-center text-sm leading-none font-normal text-neutral-600 active:opacity-70 disabled:opacity-40 dark:text-neutral-300"
                      >
                        {isUploading ? '添加中…' : logoData ? '更换' : '添加'}
                      </button>
                      <input
                        ref={el => {
                          if (el) fileInputRefs.current.set(roaster, el);
                          else fileInputRefs.current.delete(roaster);
                        }}
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
                        className="hidden"
                        onChange={e => {
                          const file = e.target.files?.[0];
                          if (file) void handleFileSelect(roaster, file);
                          e.target.value = '';
                        }}
                      />
                    </div>
                  )}
                </div>
              </SettingRow>
            );
          })
        )}
      </SettingSection>
      {roasters.length > 0 && !isEditingRoasters && !searchQuery.trim() && (
        <SettingSection title="图标管理" contentShape="card">
          <SettingRow
            label="导入图标"
            onClick={handleOpenImport}
            isLast={false}
          >
            {null}
          </SettingRow>
          <SettingRow label="导出图标" onClick={handleOpenExport} isLast>
            {null}
          </SettingRow>
        </SettingSection>
      )}
      <div className="h-28" />

      {/* 删除确认抽屉 */}
      <DeleteConfirmDrawer
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={() => {
          if (deleteRoasterName) {
            executeDeleteLogo(deleteRoasterName);
          }
        }}
        itemName={`${deleteRoasterName || ''} 的图标`}
        itemType=""
        onExitComplete={() => setDeleteRoasterName(null)}
      />

      <ConfirmDrawer
        isOpen={showRenameConfirm}
        onClose={() => setShowRenameConfirm(false)}
        onConfirm={() => {
          void executeSaveRoasters();
        }}
        icon={DataAlertIcon}
        confirmText="确认"
        message={
          <>
            本次会统一修改
            <span className="text-neutral-800 dark:text-neutral-200">
              {' '}
              {pendingRenameCount} 个烘焙商名称{' '}
            </span>
            ，并同步更新咖啡豆、冲煮记录快照、烘焙商图标配置等。保存后无法还原。
          </>
        }
      />

      {/* 导入导出抽屉 */}
      <RoasterLogoImportExport
        isOpen={showImportExport}
        onClose={() => setShowImportExport(false)}
        mode={importExportMode}
        hapticFeedback={hapticFeedback}
        existingRoasters={roasters}
        onImportComplete={handleImportComplete}
      />
      <style>{`
        .roaster-rename-preview {
          animation: roaster-preview-in 160ms cubic-bezier(0.23, 1, 0.32, 1)
            both;
        }

        .roaster-rename-preview-old {
          animation: roaster-old-dim 180ms cubic-bezier(0.23, 1, 0.32, 1) 40ms
            both;
        }

        .roaster-rename-preview-line {
          position: absolute;
          top: 50%;
          left: 0;
          right: 0;
          height: 1px;
          background: currentColor;
          opacity: 0.8;
          transform: scaleX(0);
          transform-origin: left center;
          animation: roaster-strike 180ms cubic-bezier(0.23, 1, 0.32, 1) 90ms
            both;
        }

        .roaster-rename-preview-new {
          animation: roaster-new-in 180ms cubic-bezier(0.23, 1, 0.32, 1) 120ms
            both;
        }

        @keyframes roaster-preview-in {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        @keyframes roaster-old-dim {
          from {
            opacity: 1;
          }
          to {
            opacity: 0.72;
          }
        }

        @keyframes roaster-strike {
          from {
            transform: scaleX(0);
          }
          to {
            transform: scaleX(1);
          }
        }

        @keyframes roaster-new-in {
          from {
            opacity: 0;
            transform: translateX(-4px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .roaster-rename-preview,
          .roaster-rename-preview-old,
          .roaster-rename-preview-line,
          .roaster-rename-preview-new {
            animation: none;
          }

          .roaster-rename-preview-line {
            transform: scaleX(1);
          }
        }
      `}</style>
    </SettingPage>
  );
};

export default RoasterLogoSettings;
