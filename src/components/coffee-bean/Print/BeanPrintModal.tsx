'use client';

import React, { useCallback, useState, useEffect, useMemo } from 'react';
import { flushSync } from 'react-dom';
import { X } from 'lucide-react';
import {
  BeanPrintModalProps,
  EditableContent,
  PrintConfig,
  PrintIconPlacement,
} from './types';
import { usePrintConfig, useEditableContent } from './hooks';
import { getResolvedPrintIcon, savePreviewAsImage } from './utils';
import { injectPrintStyles } from './styles';
import { SizeSettings } from './SizeSettings';
import { LayoutSettings } from './LayoutSettings';
import { ContentEditor } from './ContentEditor';
import { PrintPreview } from './PrintPreview';
import { modalHistory } from '@/lib/hooks/useModalHistory';
import ResponsiveModal from '@/components/common/ui/ResponsiveModal';
import { useRoasterLogo, useSettingsStore } from '@/lib/stores/settingsStore';

const BeanPrintModal: React.FC<BeanPrintModalProps> = ({
  isOpen,
  bean,
  onClose,
}) => {
  useEffect(() => {
    injectPrintStyles();
  }, []);

  const settings = useSettingsStore(state => state.settings);
  const roasterSettings = useMemo(
    () =>
      ({
        roasterFieldEnabled: settings.roasterFieldEnabled ?? false,
        roasterSeparator: settings.roasterSeparator ?? ' ',
      }) as const,
    [settings.roasterFieldEnabled, settings.roasterSeparator]
  );

  const {
    config,
    presetSizes,
    updateConfig,
    previewConfig,
    toggleField,
    toggleOrientation,
    selectPresetSize,
    addPresetSize,
    removePresetSize,
    resetPresetSizes,
    resetConfig,
  } = usePrintConfig();

  const { content, updateField, updateIcon, updateIconSource, resetContent } =
    useEditableContent(bean, roasterSettings);

  const roasterLogo = useRoasterLogo(content.roaster.trim() || null);
  const previewContent = useMemo(
    () => ({
      ...content,
      icon: getResolvedPrintIcon(content, roasterLogo),
    }),
    [content, roasterLogo]
  );
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [preparedImage, setPreparedImage] = useState<{
    data: string;
    config: PrintConfig;
    content: EditableContent;
  }>();
  const [isSavingImage, setIsSavingImage] = useState(false);
  const preparedImageData =
    preparedImage?.config === config && preparedImage.content === previewContent
      ? preparedImage.data
      : undefined;

  const handleClose = useCallback(() => {
    setPreparedImage(undefined);
    modalHistory.back();
  }, []);
  const handleModalClose = useCallback(() => {
    setPreparedImage(undefined);
    onClose();
  }, [onClose]);

  const handleSaveImage = useCallback(async () => {
    if (isSavingImage) return;

    setIsSavingImage(true);
    try {
      const result = await savePreviewAsImage(
        'print-preview',
        bean,
        preparedImageData
      );
      if (
        result.outcome === 'activation-required' ||
        result.outcome === 'cancelled'
      ) {
        setPreparedImage({
          data: result.imageData,
          config,
          content: previewContent,
        });
      } else {
        setPreparedImage(undefined);
      }
    } catch (error) {
      console.error('保存图片失败:', error);
      const { showToast } =
        await import('@/components/common/feedback/LightToast');
      showToast({ type: 'error', title: '保存图片失败，请重试' });
    } finally {
      setIsSavingImage(false);
    }
  }, [bean, config, isSavingImage, preparedImageData, previewContent]);

  const handleResetConfig = useCallback(() => setShowResetConfirm(true), []);

  const handleCancelReset = useCallback(() => {
    setShowResetConfirm(false);
  }, []);

  const confirmReset = useCallback(() => {
    resetConfig();
    setShowResetConfirm(false);
  }, [resetConfig]);

  const handleUpdateTemplate = useCallback(
    (template: PrintConfig['template']) => updateConfig('template', template),
    [updateConfig]
  );

  const handlePreviewMargin = useCallback(
    (margin: number) => {
      flushSync(() => previewConfig('margin', margin));
    },
    [previewConfig]
  );

  const handleCommitMargin = useCallback(
    (margin: number) => updateConfig('margin', margin),
    [updateConfig]
  );

  const handlePreviewFontSize = useCallback(
    (fontSize: number) => {
      flushSync(() => previewConfig('fontSize', fontSize));
    },
    [previewConfig]
  );

  const handleCommitFontSize = useCallback(
    (fontSize: number) => updateConfig('fontSize', fontSize),
    [updateConfig]
  );

  const handlePreviewFontWeight = useCallback(
    (fontWeight: number) => {
      flushSync(() => previewConfig('fontWeight', fontWeight));
    },
    [previewConfig]
  );

  const handleCommitFontWeight = useCallback(
    (fontWeight: number) => updateConfig('fontWeight', fontWeight),
    [updateConfig]
  );

  const handleUpdateIconPlacement = useCallback(
    (placement: PrintIconPlacement) => updateConfig('iconPlacement', placement),
    [updateConfig]
  );

  if (!bean) return null;

  return (
    <ResponsiveModal
      isOpen={isOpen}
      onClose={handleModalClose}
      historyId="bean-print"
      drawerMaxWidth="480px"
      drawerHeight="90vh"
    >
      {({ isMediumScreen }) => (
        <div className="flex h-full flex-col overflow-hidden">
          {/* 顶部栏 */}
          <div
            className={`sticky top-0 z-10 flex items-center justify-between bg-neutral-50 px-4 py-3 dark:bg-neutral-900 ${
              isMediumScreen ? 'rounded-t-3xl pt-3' : 'pt-safe-top'
            }`}
          >
            <button
              type="button"
              onClick={handleClose}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700"
            >
              <X className="h-4 w-4" />
            </button>
            <h2 className="pointer-events-none absolute left-1/2 -translate-x-1/2 text-sm text-neutral-600 dark:text-neutral-400">
              打印标签
            </h2>
            <button
              type="button"
              onClick={handleSaveImage}
              disabled={isSavingImage}
              className="flex h-8 items-center justify-center rounded-full bg-neutral-100 px-3 text-xs font-medium text-neutral-700 hover:bg-neutral-200 hover:text-neutral-900 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700 dark:hover:text-neutral-100"
              title={preparedImageData ? '分享图片' : '保存图片'}
            >
              {isSavingImage ? '生成中' : preparedImageData ? '分享' : '保存'}
            </button>
          </div>

          {/* 内容 */}
          <div
            className={`flex-1 overflow-y-auto ${
              isMediumScreen ? 'pb-4' : 'pb-safe-bottom'
            }`}
          >
            <div className="space-y-4 p-4">
              <SizeSettings
                config={config}
                presetSizes={presetSizes}
                onSelectSize={selectPresetSize}
                onAddSize={addPresetSize}
                onRemoveSize={removePresetSize}
                onResetSizes={resetPresetSizes}
              />

              <LayoutSettings
                config={config}
                onToggleOrientation={toggleOrientation}
                onUpdateTemplate={handleUpdateTemplate}
                onUpdateMargin={handlePreviewMargin}
                onCommitMargin={handleCommitMargin}
                onUpdateFontSize={handlePreviewFontSize}
                onCommitFontSize={handleCommitFontSize}
                onUpdateFontWeight={handlePreviewFontWeight}
                onCommitFontWeight={handleCommitFontWeight}
                onReset={handleResetConfig}
              />

              <ContentEditor
                config={config}
                content={content}
                roasterIcon={roasterLogo}
                onToggleField={toggleField}
                onUpdateField={updateField}
                onUpdateIcon={updateIcon}
                onUpdateIconSource={updateIconSource}
                onUpdateIconPlacement={handleUpdateIconPlacement}
                onResetContent={resetContent}
              />

              <PrintPreview
                config={config}
                content={previewContent}
                onUpdateIconPlacement={handleUpdateIconPlacement}
              />
            </div>
          </div>

          {/* 重置确认 */}
          {showResetConfirm && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
              <div className="mx-4 w-full max-w-sm rounded-2xl bg-white p-6 dark:bg-neutral-900">
                <h3 className="mb-2 text-lg font-medium">重置配置</h3>
                <p className="mb-4 text-sm text-neutral-600 dark:text-neutral-400">
                  确定要重置所有布局设置吗？
                </p>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={handleCancelReset}
                    className="flex-1 rounded-lg bg-neutral-100 py-2 text-sm font-medium hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700"
                  >
                    取消
                  </button>
                  <button
                    type="button"
                    onClick={confirmReset}
                    className="flex-1 rounded-lg bg-red-500 py-2 text-sm font-medium text-white hover:bg-red-600"
                  >
                    重置
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </ResponsiveModal>
  );
};

export default BeanPrintModal;
