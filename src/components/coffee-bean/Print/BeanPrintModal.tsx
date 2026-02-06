'use client';

import React, { useState, useEffect } from 'react';
import { X, Save } from 'lucide-react';
import { BeanPrintModalProps } from './types';
import { usePrintConfig, useEditableContent } from './hooks';
import { extractBrandName, savePreviewAsImage } from './utils';
import { injectPrintStyles } from './styles';
import { SizeSettings } from './SizeSettings';
import { LayoutSettings } from './LayoutSettings';
import { ContentEditor } from './ContentEditor';
import { PrintPreview } from './PrintPreview';
import { modalHistory } from '@/lib/hooks/useModalHistory';
import ResponsiveModal from '@/components/common/ui/ResponsiveModal';
import { useSettingsStore } from '@/lib/stores/settingsStore';

const BeanPrintModal: React.FC<BeanPrintModalProps> = ({
  isOpen,
  bean,
  onClose,
}) => {
  useEffect(() => {
    injectPrintStyles();
  }, []);

  const settings = useSettingsStore(state => state.settings);
  const roasterSettings = {
    roasterFieldEnabled: settings.roasterFieldEnabled ?? false,
    roasterSeparator: settings.roasterSeparator ?? ' ',
  } as const;

  const {
    config,
    presetSizes,
    updateConfig,
    toggleField,
    toggleOrientation,
    selectPresetSize,
    addPresetSize,
    removePresetSize,
    resetPresetSizes,
    resetConfig,
  } = usePrintConfig();

  const {
    content,
    updateField,
    updateFlavorItem,
    addFlavor,
    removeFlavor,
    resetContent,
  } = useEditableContent(bean, roasterSettings);

  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const handleClose = () => modalHistory.back();

  const handleSaveImage = async () => {
    try {
      await savePreviewAsImage('print-preview', bean);
    } catch (error) {
      console.error('保存图片失败:', error);
      const { showToast } =
        await import('@/components/common/feedback/LightToast');
      showToast({ type: 'error', title: '保存图片失败，请重试' });
    }
  };

  const handleResetConfig = () => setShowResetConfirm(true);

  const confirmReset = () => {
    resetConfig();
    setShowResetConfirm(false);
  };

  const extractedBrandName = extractBrandName(content.name, config.brandName);

  if (!bean) return null;

  return (
    <ResponsiveModal
      isOpen={isOpen}
      onClose={onClose}
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
              onClick={handleClose}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700"
            >
              <X className="h-4 w-4" />
            </button>
            <h2 className="pointer-events-none absolute left-1/2 -translate-x-1/2 text-sm text-neutral-600 dark:text-neutral-400">
              打印标签
            </h2>
            <button
              onClick={handleSaveImage}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-neutral-800 hover:bg-neutral-700 dark:bg-neutral-700 dark:hover:bg-neutral-600"
              title="保存图片"
            >
              <Save className="h-4 w-4 text-white" />
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
                onUpdateTemplate={t => updateConfig('template', t)}
                onUpdateMargin={m => updateConfig('margin', m)}
                onUpdateFontSize={s => updateConfig('fontSize', s)}
                onUpdateFontWeight={w => updateConfig('fontWeight', w)}
                onReset={handleResetConfig}
              />

              <ContentEditor
                config={config}
                content={content}
                extractedBrandName={extractedBrandName}
                onToggleField={toggleField}
                onUpdateField={updateField}
                onUpdateFlavorItem={updateFlavorItem}
                onAddFlavor={addFlavor}
                onRemoveFlavor={removeFlavor}
                onResetContent={resetContent}
                onUpdateBrandName={b => updateConfig('brandName', b)}
              />

              <PrintPreview config={config} content={content} />
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
                    onClick={() => setShowResetConfirm(false)}
                    className="flex-1 rounded-lg bg-neutral-100 py-2 text-sm font-medium hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700"
                  >
                    取消
                  </button>
                  <button
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
