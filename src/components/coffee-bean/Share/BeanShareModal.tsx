'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import { Download, Share2, X, FileText } from 'lucide-react';
import { CoffeeBean } from '@/types/app';
import { serializeBeanForQRCode } from '@/lib/utils/beanQRCodeUtils';
import { Capacitor } from '@capacitor/core';
import { useThemeColor } from '@/lib/hooks/useThemeColor';
import { useModalHistory, modalHistory } from '@/lib/hooks/useModalHistory';

interface BeanShareModalProps {
  isOpen: boolean;
  bean: CoffeeBean | null;
  onClose: () => void;
  onTextShare?: (bean: CoffeeBean) => void;
}

type ShareMode = 'qrcode' | 'text';

const BeanShareModal: React.FC<BeanShareModalProps> = ({
  isOpen,
  bean,
  onClose,
  onTextShare,
}) => {
  const [shareMode, setShareMode] = useState<ShareMode>('qrcode');
  const [qrData, setQrData] = useState<string>('');
  const [isSharing, setIsSharing] = useState(false);
  const [showBeanName, setShowBeanName] = useState(false);
  const qrContainerRef = useRef<HTMLDivElement>(null);

  // 同步顶部安全区颜色
  useThemeColor({ useOverlay: true, enabled: isOpen });

  // 生成二维码数据
  useEffect(() => {
    if (bean && isOpen && shareMode === 'qrcode') {
      const data = serializeBeanForQRCode(bean);
      setQrData(data);
    }
  }, [bean, isOpen, shareMode]);

  // 使用统一的历史栈管理
  useModalHistory({
    id: 'bean-share',
    isOpen,
    onClose,
  });

  // 处理关闭 - 使用统一的历史栈管理器
  const handleClose = () => {
    modalHistory.back();
  };

  // 下载二维码图片
  const handleDownloadQRCode = async () => {
    if (!qrContainerRef.current) return;

    try {
      setIsSharing(true);

      // 动态导入 html-to-image
      const { toPng } = await import('html-to-image');

      const dataUrl = await toPng(qrContainerRef.current, {
        quality: 1,
        pixelRatio: 3, // 高清晰度
        backgroundColor: '#ffffff',
      });

      if (Capacitor.isNativePlatform()) {
        // 移动端：使用分享功能
        const { Share } = await import('@capacitor/share');
        const { Filesystem, Directory } = await import('@capacitor/filesystem');

        // 将 base64 转换为文件
        const base64Data = dataUrl.split(',')[1];
        const fileName = `bean-qrcode-${bean?.name || 'unnamed'}-${Date.now()}.png`;

        await Filesystem.writeFile({
          path: fileName,
          data: base64Data,
          directory: Directory.Cache,
        });

        const fileUri = await Filesystem.getUri({
          path: fileName,
          directory: Directory.Cache,
        });

        await Share.share({
          title: '分享咖啡豆二维码',
          text: `${bean?.name || '咖啡豆'}的二维码`,
          url: fileUri.uri,
          dialogTitle: '分享二维码',
        });

        // 清理临时文件
        await Filesystem.deleteFile({
          path: fileName,
          directory: Directory.Cache,
        });
      } else {
        // Web 端：下载图片
        const link = document.createElement('a');
        link.download = `bean-qrcode-${bean?.name || 'unnamed'}.png`;
        link.href = dataUrl;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } catch (error) {
      console.error('Failed to download QR code:', error);
      alert('下载失败，请重试');
    } finally {
      setIsSharing(false);
    }
  };

  // 分享二维码功能
  const handleShareQRCode = async () => {
    if (Capacitor.isNativePlatform()) {
      // 在移动端，分享和下载是同一个操作
      await handleDownloadQRCode();
    } else if (typeof navigator !== 'undefined' && 'share' in navigator) {
      // Web 端使用 Web Share API
      try {
        setIsSharing(true);
        await handleDownloadQRCode();
      } catch (error) {
        console.error('Share failed:', error);
      } finally {
        setIsSharing(false);
      }
    } else {
      // 降级到下载
      await handleDownloadQRCode();
    }
  };

  // 处理文本分享
  const handleTextShare = () => {
    if (bean && onTextShare) {
      onTextShare(bean);
      handleClose();
    }
  };

  if (!bean) return null;

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
            className="fixed inset-0 z-[200] bg-black/50"
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
            className="fixed inset-x-0 bottom-0 z-[200] mx-auto max-h-[85vh] max-w-[500px] overflow-hidden rounded-t-2xl bg-neutral-50 shadow-xl dark:bg-neutral-900"
          >
            {/* 拖动条 */}
            <div className="sticky top-0 flex justify-center bg-neutral-50 py-2 dark:bg-neutral-900">
              <div className="h-1.5 w-12 rounded-full bg-neutral-200 dark:bg-neutral-700" />
            </div>

            {/* 内容区域 */}
            <div className="pb-safe-bottom max-h-[calc(85vh-40px)] overflow-auto px-6">
              {/* 标题栏 */}
              <div className="mt-3 mb-6 flex items-center justify-between">
                <h2 className="text-lg font-medium text-neutral-800 dark:text-neutral-100">
                  分享咖啡豆
                </h2>
                <button
                  onClick={handleClose}
                  className="-mr-2 rounded-full p-2 transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800"
                >
                  <X className="h-5 w-5 text-neutral-600 dark:text-neutral-400" />
                </button>
              </div>

              {/* 咖啡豆信息 */}
              <div className="mb-6">
                <h3 className="mb-2 text-base font-medium text-neutral-800 dark:text-neutral-100">
                  {bean.name}
                </h3>
                {bean.roastLevel && (
                  <p className="text-xs text-neutral-600 dark:text-neutral-400">
                    {bean.roastLevel}
                    {bean.roastDate && ` · ${bean.roastDate}`}
                  </p>
                )}
              </div>

              {/* 分享方式选择 */}
              <div className="mb-6">
                <div className="flex gap-2 rounded-lg bg-neutral-100 p-1 dark:bg-neutral-800">
                  <button
                    onClick={() => setShareMode('qrcode')}
                    className={`flex flex-1 items-center justify-center gap-2 rounded-md py-2 transition-all ${
                      shareMode === 'qrcode'
                        ? 'bg-white text-neutral-900 shadow-sm dark:bg-neutral-700 dark:text-neutral-100'
                        : 'text-neutral-600 dark:text-neutral-400'
                    }`}
                  >
                    <Share2 className="h-4 w-4" />
                    <span className="text-sm font-medium">二维码</span>
                  </button>
                  <button
                    onClick={() => setShareMode('text')}
                    className={`flex flex-1 items-center justify-center gap-2 rounded-md py-2 transition-all ${
                      shareMode === 'text'
                        ? 'bg-white text-neutral-900 shadow-sm dark:bg-neutral-700 dark:text-neutral-100'
                        : 'text-neutral-600 dark:text-neutral-400'
                    }`}
                  >
                    <FileText className="h-4 w-4" />
                    <span className="text-sm font-medium">文本</span>
                  </button>
                </div>
              </div>

              {/* 二维码模式 */}
              {shareMode === 'qrcode' && (
                <>
                  {/* 显示咖啡豆名称开关 */}
                  <div className="mb-4 flex items-center justify-between rounded-lg bg-neutral-100 p-3 dark:bg-neutral-800">
                    <div className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
                      显示咖啡豆名称
                    </div>
                    <label className="relative inline-flex cursor-pointer items-center">
                      <input
                        type="checkbox"
                        checked={showBeanName}
                        onChange={e => setShowBeanName(e.target.checked)}
                        className="peer sr-only"
                      />
                      <div className="peer h-6 w-11 rounded-full bg-neutral-200 peer-checked:bg-neutral-600 after:absolute after:top-[2px] after:left-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:after:translate-x-full dark:bg-neutral-700 dark:peer-checked:bg-neutral-500"></div>
                    </label>
                  </div>

                  {/* 二维码容器 */}
                  <div className="mb-6 flex justify-center">
                    <div
                      ref={qrContainerRef}
                      className="w-full max-w-[400px] rounded-lg bg-white p-6"
                    >
                      {/* 咖啡豆名称 - 可选显示 */}
                      {showBeanName && bean.name && (
                        <div className="mb-4">
                          <h3 className="text-center text-base font-medium text-neutral-800">
                            {bean.name}
                          </h3>
                        </div>
                      )}

                      <QRCodeSVG
                        value={qrData}
                        size={256}
                        level="Q" // 15% 容错率
                        marginSize={3} // 3个色块的边距
                        bgColor="#ffffff"
                        fgColor="#000000"
                        className="h-auto w-full"
                      />
                    </div>
                  </div>

                  {/* 操作按钮 */}
                  <div className="mb-4 flex gap-3">
                    <button
                      onClick={handleDownloadQRCode}
                      disabled={isSharing}
                      className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-neutral-900 py-3 text-neutral-100 transition-opacity hover:opacity-90 disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900"
                    >
                      <Download className="h-4 w-4" />
                      <span className="text-sm font-medium">
                        {Capacitor.isNativePlatform() ? '保存图片' : '下载图片'}
                      </span>
                    </button>
                    {!Capacitor.isNativePlatform() &&
                      typeof navigator !== 'undefined' &&
                      'share' in navigator && (
                        <button
                          onClick={handleShareQRCode}
                          disabled={isSharing}
                          className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-neutral-200 py-3 text-neutral-800 transition-opacity hover:opacity-90 disabled:opacity-50 dark:bg-neutral-800 dark:text-neutral-100"
                        >
                          <Share2 className="h-4 w-4" />
                          <span className="text-sm font-medium">分享</span>
                        </button>
                      )}
                  </div>

                  {/* 使用说明 */}
                  <div className="pb-4">
                    <p className="text-center text-xs text-neutral-500 dark:text-neutral-400">
                      扫描二维码可快速导入此咖啡豆的所有信息
                    </p>
                  </div>
                </>
              )}

              {/* 文本模式 */}
              {shareMode === 'text' && (
                <>
                  {/* 文本说明 */}
                  <div className="mb-6 rounded-lg bg-neutral-100 p-4 dark:bg-neutral-800">
                    <p className="text-center text-sm text-neutral-600 dark:text-neutral-400">
                      复制后可分享给朋友,或粘贴到【快速添加】中导入
                    </p>
                  </div>

                  {/* 分享按钮 */}
                  <div className="mb-4">
                    <button
                      onClick={handleTextShare}
                      className="flex w-full items-center justify-center gap-2 rounded-lg bg-neutral-900 py-3 text-neutral-100 transition-opacity hover:opacity-90 dark:bg-neutral-100 dark:text-neutral-900"
                    >
                      <FileText className="h-4 w-4" />
                      <span className="text-sm font-medium">复制为文本</span>
                    </button>
                  </div>

                  {/* 使用说明 */}
                  <div className="pb-4">
                    <p className="text-center text-xs text-neutral-500 dark:text-neutral-400">
                      文本格式包含咖啡豆的所有基本信息
                    </p>
                  </div>
                </>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default BeanShareModal;
