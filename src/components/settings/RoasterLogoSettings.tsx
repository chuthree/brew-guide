'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, ImagePlus } from 'lucide-react';
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
import { SettingPage } from './atomic';
import DeleteConfirmDrawer from '@/components/common/ui/DeleteConfirmDrawer';
import RoasterLogoImportExport from './RoasterLogoImportExport';

interface RoasterLogoSettingsProps {
  isOpen: boolean;
  onClose: () => void;
  hapticFeedback: boolean;
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
  const fileInputRefs = useRef<Map<string, HTMLInputElement>>(new Map());

  // 删除确认抽屉状态
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteRoasterName, setDeleteRoasterName] = useState<string | null>(
    null
  );

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

    // 验证文件类型
    if (!file.type.startsWith('image/')) {
      alert('请选择图片文件');
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
      await getSettingsStore().updateRoasterConfig(roasterName, {
        logoData: base64,
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

  if (!shouldRender) return null;

  return (
    <SettingPage title="烘焙商图标" isVisible={isVisible} onClose={handleClose}>
      <div className="-mt-4 px-6">
        {roasters.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <ImagePlus className="mb-2 h-10 w-10 text-neutral-300 dark:text-neutral-600" />
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
            <h3 className="text-sm font-medium tracking-wider text-neutral-500 uppercase dark:text-neutral-400">
              烘焙商列表 ({roasters.length})
            </h3>

            {/* 烘焙商列表 */}
            <div className="space-y-2">
              {roasters.map(roaster => {
                const config = roasterConfigs.get(roaster);
                const hasLogo = !!config?.logoData;
                const logoData = config?.logoData;
                const isUploading = uploading === roaster;

                return (
                  <div
                    key={roaster}
                    className="flex items-center justify-between rounded bg-neutral-100 p-2 dark:bg-neutral-800"
                  >
                    <div className="flex items-center gap-3">
                      {/* 图标预览 */}
                      <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded border border-neutral-200/50 bg-neutral-50/80 dark:border-neutral-700 dark:bg-neutral-900">
                        {hasLogo && logoData ? (
                          <Image
                            src={logoData}
                            alt={roaster}
                            fill
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
                      <span className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
                        {roaster}
                      </span>
                    </div>

                    {/* 操作按钮 */}
                    <div className="flex items-center gap-1.5">
                      {hasLogo && (
                        <button
                          onClick={e => handleDeleteLogo(roaster, e)}
                          disabled={isUploading}
                          className="rounded p-1.5 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-red-500 disabled:opacity-50 dark:hover:bg-neutral-700"
                          title="删除图标"
                        >
                          <X className="h-4 w-4" />
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
                        accept="image/*"
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

      {/* 导入导出抽屉 */}
      <RoasterLogoImportExport
        isOpen={showImportExport}
        onClose={() => setShowImportExport(false)}
        mode={importExportMode}
        hapticFeedback={hapticFeedback}
        existingRoasters={roasters}
        onImportComplete={handleImportComplete}
      />
    </SettingPage>
  );
};

export default RoasterLogoSettings;
