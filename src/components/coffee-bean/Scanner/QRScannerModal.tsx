'use client';

import React, { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, X, AlertCircle } from 'lucide-react';
import { scanImageFile } from '@/lib/utils/qrScannerUtils';
import {
  isValidBeanQRCode,
  deserializeBeanFromQRCode,
} from '@/lib/utils/beanQRCodeUtils';
import type { CoffeeBean } from '@/types/app';
import { useThemeColor } from '@/lib/hooks/useThemeColor';

interface QRScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanSuccess: (bean: Partial<CoffeeBean>) => void;
}

const QRScannerModal: React.FC<QRScannerModalProps> = ({
  isOpen,
  onClose,
  onScanSuccess,
}) => {
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 同步顶部安全区颜色
  useThemeColor({ useOverlay: true, enabled: isOpen });

  // 在关闭时重置状态
  React.useEffect(() => {
    if (!isOpen) {
      // 关闭时重置所有状态
      setIsScanning(false);
      setError(null);
    }
  }, [isOpen]);

  // 历史栈管理
  React.useEffect(() => {
    if (!isOpen) return;

    window.history.pushState({ modal: 'qr-scanner' }, '');

    const handlePopState = () => {
      onClose();
    };

    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [isOpen, onClose]);

  // 处理关闭
  const handleClose = useCallback(() => {
    if (window.history.state?.modal === 'qr-scanner') {
      window.history.back();
    } else {
      onClose();
    }
  }, [onClose]);

  // 处理扫描结果
  const handleScanResult = useCallback(
    (qrData: string) => {
      // 验证是否为咖啡豆二维码
      if (!isValidBeanQRCode(qrData)) {
        setError('这不是有效的咖啡豆二维码');
        setIsScanning(false);
        return;
      }

      // 解析数据
      const bean = deserializeBeanFromQRCode(qrData);
      if (!bean) {
        setError('无法解析二维码数据');
        setIsScanning(false);
        return;
      }

      // 成功 - 先重置状态再关闭
      setIsScanning(false);
      onScanSuccess(bean);
      handleClose();
    },
    [onScanSuccess, handleClose]
  );

  // 文件上传扫描
  const handleFileUpload = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      setError(null);
      setIsScanning(true);

      try {
        const result = await scanImageFile(file);

        if (result.success && result.data) {
          handleScanResult(result.data);
        } else {
          setError(result.error || '未能识别二维码');
          setIsScanning(false);
        }
      } catch (error) {
        console.error('File scan error:', error);
        setError('识别失败，请重试');
        setIsScanning(false);
      }

      // 清空 input，允许重新选择同一文件
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    },
    [handleScanResult]
  );

  // 触发文件选择
  const handleUploadClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* 背景遮罩 */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.265 }}
            onClick={handleClose}
            className="fixed inset-0 z-[70] bg-black/50"
          />

          {/* 模态框内容 */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{
              
              ease: [0.33, 1, 0.68, 1],
              duration: 0.265,
            }}
            style={{ willChange: 'transform' }}
            className="fixed inset-x-0 bottom-0 z-[70] mx-auto max-h-[85vh] max-w-[500px] overflow-hidden rounded-t-2xl bg-neutral-50 shadow-xl dark:bg-neutral-900"
          >
            {/* 拖动条 */}
            <div className="sticky top-0 z-10 flex justify-center bg-neutral-50 py-2 dark:bg-neutral-900">
              <div className="h-1.5 w-12 rounded-full bg-neutral-200 dark:bg-neutral-700" />
            </div>

            {/* 内容区域 */}
            <div className="pb-safe-bottom max-h-[calc(85vh-40px)] overflow-auto px-6">
              {/* 标题栏 */}
              <div className="mt-3 mb-6 flex items-center justify-between">
                <h2 className="text-lg font-medium text-neutral-800 dark:text-neutral-100">
                  扫描二维码
                </h2>
                <button
                  onClick={handleClose}
                  className="-mr-2 rounded-full p-2 transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800"
                >
                  <X className="h-5 w-5 text-neutral-600 dark:text-neutral-400" />
                </button>
              </div>

              {/* 说明文字 */}
              <div className="mb-6">
                <p className="mb-3 text-sm text-neutral-600 dark:text-neutral-400">
                  上传包含咖啡豆二维码的图片进行识别
                </p>
              </div>

              {/* 错误提示 */}
              {error && (
                <div className="mb-6 flex items-start gap-2 rounded-lg bg-red-50 p-3 dark:bg-red-900/20">
                  <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-600 dark:text-red-400" />
                  <p className="text-sm text-red-600 dark:text-red-400">
                    {error}
                  </p>
                </div>
              )}

              {/* 操作按钮 */}
              <div className="mb-4 flex flex-col gap-3">
                {/* 上传图片 */}
                <button
                  onClick={handleUploadClick}
                  disabled={isScanning}
                  className="flex items-center justify-center gap-3 rounded-lg bg-neutral-900 py-4 text-neutral-100 transition-opacity hover:opacity-90 disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900"
                >
                  <Upload className="h-5 w-5" />
                  <span className="text-sm font-medium">
                    {isScanning ? '识别中...' : '上传图片'}
                  </span>
                </button>

                {/* 隐藏的文件输入 */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </div>

              {/* 使用提示 */}
              <div className="pb-4">
                <p className="text-center text-xs text-neutral-500 dark:text-neutral-400">
                  支持从咖啡豆分享功能生成的二维码
                </p>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default QRScannerModal;
