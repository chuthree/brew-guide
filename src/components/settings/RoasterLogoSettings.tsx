'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ImagePlus, X } from 'lucide-react';
import Image from 'next/image';
import {
  getRoasterConfigsSync,
  getSettingsStore,
} from '@/lib/stores/settingsStore';
import { RoasterConfig } from '@/lib/core/db';
import {
  extractUniqueRoasters,
  RoasterSettings,
} from '@/lib/utils/beanVarietyUtils';
import { useCoffeeBeanStore } from '@/lib/stores/coffeeBeanStore';
import { ExtendedCoffeeBean } from '@/components/coffee-bean/List/types';
import hapticsUtils from '@/lib/ui/haptics';
import { useModalHistory, modalHistory } from '@/lib/hooks/useModalHistory';
import SettingPage from './atomic/SettingPage';
import DeleteConfirmDrawer from '@/components/common/ui/DeleteConfirmDrawer';
import ConfirmDrawer from '@/components/common/ui/ConfirmDrawer';
import RoasterLogoImportExport from './RoasterLogoImportExport';
import { renameRoasters } from '@/lib/utils/roasterRename';
import DataAlertIcon from '@public/images/icons/ui/data-alert.svg';
import { compressBase64Image } from '@/lib/utils/imageCapture';

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
  const [shouldRender, setShouldRender] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [roasters, setRoasters] = useState<string[]>([]);
  const [roasterConfigs, setRoasterConfigs] = useState<
    Map<string, RoasterConfig>
  >(new Map());
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
  onCloseRef.current = onClose;

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
  });

  // 处理显示/隐藏动画
  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setIsVisible(true);
        });
      });
    } else {
      setIsVisible(false);
      const timer = setTimeout(() => setShouldRender(false), 350);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // 加载烘焙商列表
  const loadRoasters = useCallback(() => {
    try {
      const beans = useCoffeeBeanStore.getState().beans as ExtendedCoffeeBean[];
      const settings = getSettingsStore().settings;
      const roasterSettings: RoasterSettings = {
        roasterFieldEnabled: settings.roasterFieldEnabled,
        roasterSeparator: settings.roasterSeparator,
      };
      const uniqueRoasters = extractUniqueRoasters(beans, roasterSettings);
      setRoasters(uniqueRoasters);
    } catch (error) {
      console.error('Failed to load roasters:', error);
    }
  }, []);

  // 加载烘焙商配置
  const loadConfigs = useCallback(() => {
    try {
      const allConfigs = getRoasterConfigsSync();
      const configMap = new Map<string, RoasterConfig>();
      allConfigs.forEach(config => {
        configMap.set(config.roasterName, config);
      });
      setRoasterConfigs(configMap);
    } catch (error) {
      console.error('Failed to load configs:', error);
    }
  }, []);

  // 加载烘焙商列表和配置
  useEffect(() => {
    if (isOpen) {
      loadRoasters();
      loadConfigs();
    }
  }, [isOpen, loadRoasters, loadConfigs]);

  const handleClose = () => {
    if (isEditingRoasters) {
      setRoasterEditState({
        isEditing: false,
        drafts: {},
        isSaving: false,
      });
      setFocusedRoasterName(null);
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
      // 重新加载配置
      loadConfigs();
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
      loadConfigs();
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

  // 导入完成后刷新配置
  const handleImportComplete = useCallback(() => {
    loadConfigs();
  }, [loadConfigs]);

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

      loadRoasters();
      loadConfigs();
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
    loadConfigs,
    loadRoasters,
  ]);

  if (!shouldRender) return null;

  return (
    <SettingPage title="烘焙商图标" isVisible={isVisible} onClose={handleClose}>
      <div className="-mt-4 px-6">
        {roasters.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <ImagePlus className="mb-2 size-10 text-neutral-300 dark:text-neutral-600" />
            <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
              暂无烘焙商
            </p>
            <p className="mt-1 text-xs text-neutral-400 dark:text-neutral-500">
              添加咖啡豆后，烘焙商会自动出现在这里
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* 烘焙商列表标题 */}
            <div className="flex items-center justify-between gap-3 pl-3.5">
              <h3 className="text-sm font-medium tracking-wider text-neutral-500 uppercase tabular-nums dark:text-neutral-400">
                烘焙商列表 ({roasters.length})
              </h3>

              {isEditingRoasters ? (
                <div className="flex items-center">
                  <button
                    type="button"
                    onClick={handleCancelEditRoasters}
                    disabled={isSavingRoasters}
                    className="flex cursor-pointer items-center rounded-full px-3 text-sm font-medium text-neutral-500 transition-transform active:scale-[0.96] disabled:cursor-default disabled:opacity-40 disabled:active:scale-100 dark:text-neutral-400"
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
                    className="flex cursor-pointer items-center rounded-full px-3 text-sm font-medium text-neutral-800 transition-transform active:scale-[0.96] disabled:cursor-default disabled:opacity-40 disabled:active:scale-100 dark:text-neutral-100"
                  >
                    {isSavingRoasters ? '保存中' : '保存'}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleStartEditRoasters}
                  className="flex cursor-pointer items-center rounded-full px-3 text-sm font-medium text-neutral-600 transition-transform active:scale-[0.96] dark:text-neutral-300"
                >
                  编辑
                </button>
              )}
            </div>

            {/* 烘焙商列表 */}
            <div className="space-y-2">
              {roasters.map(roaster => {
                const config = roasterConfigs.get(roaster);
                const hasLogo = !!config?.logoData;
                const logoData = config?.logoData;
                const isUploading = uploading === roaster;
                const draftName = draftRoasterNames[roaster] ?? roaster;
                const normalizedDraftName = draftName.trim();
                const hasDraftNameChange =
                  normalizedDraftName.length > 0 &&
                  normalizedDraftName !== roaster;
                const shouldShowRenamePreview =
                  isEditingRoasters &&
                  !isSavingRoasters &&
                  hasDraftNameChange &&
                  focusedRoasterName !== roaster;

                return (
                  <div
                    key={roaster}
                    className="flex items-center justify-between rounded bg-neutral-100 p-2 transition-colors dark:bg-neutral-800"
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      {/* 图标预览 */}
                      <div className="relative size-10 shrink-0 overflow-hidden rounded border border-neutral-200/50 bg-neutral-50/80 dark:border-neutral-700 dark:bg-neutral-900">
                        {hasLogo && logoData ? (
                          <Image
                            src={logoData}
                            alt={roaster}
                            fill
                            sizes="40px"
                            className="object-cover"
                            unoptimized
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-sm font-medium text-neutral-400 dark:text-neutral-600">
                            {roaster.charAt(0)}
                          </div>
                        )}
                      </div>

                      {/* 烘焙商名称 */}
                      {isEditingRoasters ? (
                        <div className="relative flex h-5 min-w-0 flex-1 items-center">
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
                            className={`block h-5 w-full min-w-0 bg-transparent p-0 text-sm leading-5 font-medium text-neutral-800 transition-[color,opacity] duration-150 outline-none placeholder:text-neutral-400 disabled:opacity-60 dark:text-neutral-200 dark:placeholder:text-neutral-600 ${
                              shouldShowRenamePreview
                                ? 'pointer-events-none opacity-0'
                                : 'opacity-100'
                            }`}
                            aria-label={`编辑 ${roaster} 的烘焙商名称`}
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
                              <span className="roaster-rename-preview-old relative max-w-[42%] min-w-0 truncate text-sm leading-5 font-medium text-neutral-500/60 dark:text-neutral-400/60">
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
                              <span className="roaster-rename-preview-new min-w-0 flex-1 truncate text-sm leading-5 font-medium text-neutral-800 dark:text-neutral-200">
                                {normalizedDraftName}
                              </span>
                            </button>
                          )}
                        </div>
                      ) : (
                        <span className="min-w-0 truncate text-sm leading-5 font-medium text-neutral-800 dark:text-neutral-200">
                          {roaster}
                        </span>
                      )}
                    </div>

                    {/* 操作按钮 */}
                    <div
                      className={
                        isEditingRoasters
                          ? 'pointer-events-none flex items-center gap-1.5 opacity-0 transition-opacity'
                          : 'flex items-center gap-1.5 opacity-100 transition-opacity'
                      }
                    >
                      {hasLogo && (
                        <button
                          onClick={e => handleDeleteLogo(roaster, e)}
                          disabled={isUploading}
                          className="rounded p-1.5 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-red-500 disabled:opacity-50 dark:hover:bg-neutral-700"
                          title="删除图标"
                        >
                          <X className="size-4" />
                        </button>
                      )}

                      <button
                        onClick={e => triggerFileInput(roaster, e)}
                        disabled={isUploading}
                        className="rounded px-2.5 py-1 text-xs font-medium text-neutral-600 transition-colors hover:bg-neutral-100 disabled:opacity-50 dark:text-neutral-400 dark:hover:bg-neutral-700"
                      >
                        {isUploading ? '添加中...' : hasLogo ? '更换' : '添加'}
                      </button>

                      {/* 隐藏的文件输入 */}
                      <input
                        ref={el => {
                          if (el) {
                            fileInputRefs.current.set(roaster, el);
                          }
                        }}
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
                        className="hidden"
                        onChange={e => {
                          const file = e.target.files?.[0];
                          if (file) {
                            handleFileSelect(roaster, file);
                          }
                          e.target.value = '';
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 使用说明和导入导出 */}
        {roasters.length > 0 && (
          <div className="mt-6 space-y-3">
            <h3 className="text-sm font-medium tracking-wider text-neutral-500 uppercase dark:text-neutral-400">
              使用说明
            </h3>
            <div className="rounded bg-neutral-100 p-3.5 dark:bg-neutral-800">
              <ul className="space-y-1.5 text-xs text-neutral-600 dark:text-neutral-400">
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 text-neutral-400 dark:text-neutral-500">
                    •
                  </span>
                  <span>当咖啡豆未设置图片时，会自动显示对应烘焙商的图标</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 text-neutral-400 dark:text-neutral-500">
                    •
                  </span>
                  <span>烘焙商名称从咖啡豆名称的第一个词自动识别</span>
                </li>
              </ul>
            </div>

            {/* 导入导出 */}
            <div className="flex gap-2">
              <button
                onClick={handleOpenImport}
                className="rounded bg-neutral-100 px-3 py-2 text-xs text-neutral-600 transition-colors hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-400 dark:hover:bg-neutral-700"
              >
                导入图标
              </button>
              <button
                onClick={handleOpenExport}
                className="rounded bg-neutral-100 px-3 py-2 text-xs text-neutral-600 transition-colors hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-400 dark:hover:bg-neutral-700"
              >
                导出图标
              </button>
            </div>
          </div>
        )}

        {/* 底部空间 */}
        <div className="h-16" />
      </div>

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
