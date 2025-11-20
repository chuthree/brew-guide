'use client';

import React, { useEffect, useState } from 'react';

interface UpdateDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  currentVersion: string;
  latestVersion: string;
  downloadUrl: string;
  releaseNotes?: string;
}

const UpdateDrawer: React.FC<UpdateDrawerProps> = ({
  isOpen,
  onClose,
  latestVersion,
  downloadUrl,
  releaseNotes,
}) => {
  const [shouldRender, setShouldRender] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

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
      const timer = setTimeout(() => setShouldRender(false), 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const handleDownload = () => {
    window.open(downloadUrl, '_blank');
  };

  if (!shouldRender) return null;

  return (
    <>
      {/* 背景遮罩 */}
      <div
        className={`fixed inset-0 z-50 bg-black/50 transition-opacity duration-300 ${
          isVisible ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={onClose}
      />

      {/* 抽屉内容 */}
      <div
        className={`fixed inset-x-0 bottom-0 z-50 mx-auto max-w-[500px] transform rounded-t-2xl bg-white transition-transform duration-300 dark:bg-neutral-900 ${
          isVisible ? 'translate-y-0' : 'translate-y-full'
        }`}
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {/* 顶部拖拽条 */}
        <div className="flex justify-center py-3">
          <div className="h-1 w-12 rounded-full bg-neutral-300 dark:bg-neutral-700" />
        </div>

        {/* 内容区域 */}
        <div className="pb-safe-bottom flex flex-col gap-y-3 px-6 pt-2">
          {/* 标题和关闭按钮 */}
          <h3 className="text-md font-medium text-neutral-900 dark:text-white">
            发现新版本 · v{latestVersion}
          </h3>

          {/* 更新说明 - 带背景包裹 */}
          {releaseNotes && (
            <div className="rounded-2xl bg-neutral-50 p-5 text-sm leading-relaxed whitespace-pre-wrap text-neutral-600 dark:bg-neutral-800/50 dark:text-neutral-400">
              {releaseNotes}
            </div>
          )}

          {/* 操作按钮 */}
          <button
            onClick={handleDownload}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-neutral-900 px-4 py-3.5 text-sm font-medium text-white transition-transform active:scale-[0.98] dark:bg-white dark:text-neutral-900"
          >
            {/* <ExternalLink className="h-4 w-4" /> */}
            前往更新
          </button>
        </div>
      </div>
    </>
  );
};

export default UpdateDrawer;
