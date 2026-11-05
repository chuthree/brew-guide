'use client';

import { useCallback, useEffect, useState } from 'react';
import ActionDrawer from './ActionDrawer';
import { showToast } from '@/components/common/feedback/LightToast';
import { readFileAsDataUrl } from '@/lib/utils/imageCompression';
import { TempFileManager } from '@/lib/utils/tempFileManager';

interface ImageSaveDrawerProps {
  imageUrl: string | null;
  historyId: string;
  portalContainer?: HTMLElement | null;
  onClose: () => void;
}

export default function ImageSaveDrawer({
  imageUrl,
  historyId,
  portalContainer,
  onClose,
}: ImageSaveDrawerProps) {
  const [preparedImage, setPreparedImage] = useState<{
    url: string;
    data: string;
  } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const imageData = imageUrl?.startsWith('data:')
    ? imageUrl
    : preparedImage?.url === imageUrl
      ? preparedImage.data
      : null;

  useEffect(() => {
    if (!imageUrl || imageUrl.startsWith('data:')) return;

    const controller = new AbortController();
    const prepareImage = async () => {
      try {
        const response = await fetch(imageUrl, { signal: controller.signal });
        if (!response.ok) throw new Error('图片读取失败');
        const data = await readFileAsDataUrl(await response.blob());
        if (!controller.signal.aborted) {
          setPreparedImage({ url: imageUrl, data });
        }
      } catch (error) {
        if (controller.signal.aborted) return;
        console.error('[ImageSaveDrawer] Failed to read image:', error);
        showToast({ type: 'error', title: '图片读取失败，请重试' });
        onClose();
      }
    };

    // Prepare before the button click so iOS keeps the activation needed to share.
    void prepareImage();
    return () => controller.abort();
  }, [imageUrl, onClose]);

  const handleSave = useCallback(async () => {
    if (!imageData || isSaving) return;

    setIsSaving(true);
    try {
      const outcome = await TempFileManager.saveImageToGallery(imageData);
      if (outcome === 'activation-required') {
        showToast({ type: 'info', title: '请再次点击保存图片' });
        return;
      }
      if (outcome === 'cancelled') return;
      if (outcome === 'saved' || outcome === 'downloaded') {
        showToast({
          type: 'success',
          title:
            outcome === 'downloaded'
              ? '已开始下载图片'
              : '__TAURI__' in window
                ? '图片已保存'
                : '已保存到系统相册',
        });
      }
      onClose();
    } catch (error) {
      console.error('[ImageSaveDrawer] Failed to save image:', error);
      showToast({ type: 'error', title: '保存图片失败，请重试' });
    } finally {
      setIsSaving(false);
    }
  }, [imageData, isSaving, onClose]);

  return (
    <ActionDrawer
      title="保存图片"
      historyId={historyId}
      isOpen={Boolean(imageUrl)}
      onClose={onClose}
      dismissible={!isSaving}
      portalContainer={portalContainer}
      autoFocus
      style={{
        paddingBottom:
          'max(var(--safe-area-bottom, 0px), env(safe-area-inset-bottom, 0px))',
      }}
    >
      <div className="-m-6 flex flex-col overflow-hidden rounded-t-3xl">
        <button
          type="button"
          onClick={handleSave}
          disabled={!imageData || isSaving}
          className="min-h-14 w-full bg-white px-6 py-4 text-base text-neutral-900 transition-colors focus-visible:-outline-offset-2 active:bg-neutral-100 disabled:opacity-50 dark:bg-neutral-900 dark:text-neutral-100 dark:active:bg-neutral-800"
        >
          {isSaving ? '保存中…' : '保存图片'}
        </button>
        <div
          aria-hidden="true"
          className="h-2 bg-neutral-100 dark:bg-neutral-800"
        />
        <button
          type="button"
          onClick={onClose}
          disabled={isSaving}
          className="min-h-14 w-full bg-white px-6 py-4 text-base text-neutral-900 transition-colors focus-visible:-outline-offset-2 active:bg-neutral-100 disabled:opacity-50 dark:bg-neutral-900 dark:text-neutral-100 dark:active:bg-neutral-800"
        >
          取消
        </button>
      </div>
    </ActionDrawer>
  );
}
