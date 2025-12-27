/**
 * 同步操作按钮组件
 *
 * 共享组件，用于 S3、WebDAV 的上传/下载/备份按钮
 */

'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, Download, History } from 'lucide-react';

interface SyncButtonsProps {
  enabled?: boolean;
  isConnected: boolean;
  isSyncing: boolean;
  onUpload: () => void;
  onDownload: () => void;
  onShowBackups?: () => void;
  isLoadingBackups?: boolean;
}

const AnimatedDots: React.FC = () => {
  const [dotCount, setDotCount] = useState(1);

  useEffect(() => {
    const interval = setInterval(() => {
      setDotCount(prev => (prev % 3) + 1);
    }, 400);
    return () => clearInterval(interval);
  }, []);

  return (
    <span className="inline-block w-4 text-left">{'.'.repeat(dotCount)}</span>
  );
};

/** Apple 风格的加载指示器 */
const AppleSpinner: React.FC<{ className?: string }> = ({ className = '' }) => {
  const lines = 8;
  return (
    <div className={`relative ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="absolute top-1/2 left-1/2 h-[30%] w-[8%] origin-[center_170%] rounded-full bg-current"
          style={{
            transform: `translateX(-50%) translateY(-170%) rotate(${i * (360 / lines)}deg)`,
            opacity: 1 - (i / lines) * 0.75,
            animation: `apple-spinner ${lines * 0.1}s linear infinite`,
            animationDelay: `${-i * 0.1}s`,
          }}
        />
      ))}
      <style jsx>{`
        @keyframes apple-spinner {
          0% {
            opacity: 1;
          }
          100% {
            opacity: 0.25;
          }
        }
      `}</style>
    </div>
  );
};

/** 图标切换动画配置 */
const iconTransition = {
  duration: 0.25,
  ease: [0.23, 1, 0.32, 1] as const,
};

const iconVariants = {
  initial: { opacity: 0, scale: 0.5, filter: 'blur(4px)' },
  animate: { opacity: 1, scale: 1, filter: 'blur(0px)' },
  exit: { opacity: 0, scale: 0.5, filter: 'blur(4px)' },
};

export const SyncButtons: React.FC<SyncButtonsProps> = ({
  enabled = true,
  isConnected,
  isSyncing,
  onUpload,
  onDownload,
  onShowBackups,
  isLoadingBackups = false,
}) => {
  const [syncDirection, setSyncDirection] = useState<
    'upload' | 'download' | null
  >(null);

  const handleUpload = () => {
    setSyncDirection('upload');
    onUpload();
  };

  const handleDownload = () => {
    setSyncDirection('download');
    onDownload();
  };

  useEffect(() => {
    if (!isSyncing) {
      setSyncDirection(null);
    }
  }, [isSyncing]);

  if (!enabled || !isConnected) {
    return null;
  }

  const isUploading = isSyncing && syncDirection === 'upload';
  const isDownloading = isSyncing && syncDirection === 'download';
  const isDisabled = isSyncing || isLoadingBackups;

  const buttonClass =
    'flex flex-1 items-center justify-center gap-1.5 rounded bg-neutral-100 px-3 py-3 text-sm font-medium text-neutral-800 transition-colors hover:bg-neutral-200 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700';

  return (
    <div className="flex gap-2">
      <button
        onClick={handleUpload}
        disabled={isDisabled}
        className={buttonClass}
      >
        <Upload className={`h-4 w-4 ${isUploading ? 'animate-pulse' : ''}`} />
        <span>
          {isUploading ? (
            <>
              上传
              <AnimatedDots />
            </>
          ) : (
            '上传'
          )}
        </span>
      </button>

      <button
        onClick={handleDownload}
        disabled={isDisabled}
        className={buttonClass}
      >
        <Download
          className={`h-4 w-4 ${isDownloading ? 'animate-pulse' : ''}`}
        />
        <span>
          {isDownloading ? (
            <>
              下载
              <AnimatedDots />
            </>
          ) : (
            '下载'
          )}
        </span>
      </button>

      {onShowBackups && (
        <button
          onClick={onShowBackups}
          disabled={isDisabled}
          className={buttonClass}
        >
          <div className="relative flex h-4 w-4 items-center justify-center">
            <AnimatePresence mode="popLayout" initial={false}>
              {isLoadingBackups ? (
                <motion.div
                  key="loader"
                  variants={iconVariants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  transition={iconTransition}
                  className="absolute inset-0 flex items-center justify-center"
                >
                  <AppleSpinner className="h-4 w-4" />
                </motion.div>
              ) : (
                <motion.div
                  key="history"
                  variants={iconVariants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  transition={iconTransition}
                  className="absolute inset-0 flex items-center justify-center"
                >
                  <History className="h-4 w-4" />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <span>备份</span>
        </button>
      )}
    </div>
  );
};
