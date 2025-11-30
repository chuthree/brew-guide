'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, X, AlertCircle, Camera } from 'lucide-react';
import { scanImageFile } from '@/lib/utils/qrScannerUtils';
import {
  isValidBeanQRCode,
  deserializeBeanFromQRCode,
} from '@/lib/utils/beanQRCodeUtils';
import type { CoffeeBean } from '@/types/app';
import { useThemeColor } from '@/lib/hooks/useThemeColor';
import { useModalHistory, modalHistory } from '@/lib/hooks/useModalHistory';

interface QRScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanSuccess: (bean: Partial<CoffeeBean>) => void;
}

type ScanMode = 'select' | 'camera' | 'upload';

// BarcodeDetector 类型定义
interface BarcodeDetectorResult {
  rawValue: string;
  format: string;
  boundingBox: DOMRectReadOnly;
}

interface BarcodeDetectorInterface {
  detect: (source: ImageBitmapSource) => Promise<BarcodeDetectorResult[]>;
}

declare global {
  interface Window {
    BarcodeDetector?: {
      new (options?: { formats?: string[] }): BarcodeDetectorInterface;
      getSupportedFormats?: () => Promise<string[]>;
    };
  }
}

const QRScannerModal: React.FC<QRScannerModalProps> = ({
  isOpen,
  onClose,
  onScanSuccess,
}) => {
  const [scanMode, setScanMode] = useState<ScanMode>('select');
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const hasScannedRef = useRef(false);
  const scannerRef = useRef<BarcodeDetectorInterface | null>(null);

  // 同步顶部安全区颜色
  useThemeColor({ useOverlay: true, enabled: isOpen });

  // 停止摄像头和扫描
  const stopCamera = useCallback(() => {
    // 停止动画帧
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    // 停止媒体流
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    // 清理视频
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    scannerRef.current = null;
  }, []);

  // 在关闭时重置状态
  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      setScanMode('select');
      setIsScanning(false);
      setError(null);
      setCameraError(null);
      hasScannedRef.current = false;
    }
  }, [isOpen, stopCamera]);

  // 使用统一的历史栈管理系统
  useModalHistory({
    id: 'qr-scanner',
    isOpen,
    onClose,
  });

  // 处理关闭
  const handleClose = useCallback(() => {
    stopCamera();
    modalHistory.back();
  }, [stopCamera]);

  // 处理扫描结果
  const handleScanResult = useCallback(
    (qrData: string) => {
      // 防止重复处理
      if (hasScannedRef.current) return;
      hasScannedRef.current = true;

      // 先停止摄像头
      stopCamera();

      // 验证是否为咖啡豆二维码
      if (!isValidBeanQRCode(qrData)) {
        setError('这不是有效的咖啡豆二维码');
        setIsScanning(false);
        hasScannedRef.current = false;
        return;
      }

      // 解析数据
      const bean = deserializeBeanFromQRCode(qrData);
      if (!bean) {
        setError('无法解析二维码数据');
        setIsScanning(false);
        hasScannedRef.current = false;
        return;
      }

      // 成功
      setIsScanning(false);
      onScanSuccess(bean);
      modalHistory.back();
    },
    [onScanSuccess, stopCamera]
  );

  // 使用 jsQR 作为后备扫描方案
  const scanWithJsQR = useCallback(
    async (
      canvas: HTMLCanvasElement,
      ctx: CanvasRenderingContext2D,
      video: HTMLVideoElement
    ) => {
      const jsQR = (await import('jsqr')).default;

      const scan = () => {
        if (hasScannedRef.current || !videoRef.current) return;

        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, canvas.width, canvas.height, {
          inversionAttempts: 'dontInvert',
        });

        if (code) {
          handleScanResult(code.data);
          return;
        }

        animationFrameRef.current = requestAnimationFrame(scan);
      };

      scan();
    },
    [handleScanResult]
  );

  // 使用原生 BarcodeDetector API 扫描
  const scanWithBarcodeDetector = useCallback(
    (detector: BarcodeDetectorInterface, video: HTMLVideoElement) => {
      const scan = async () => {
        if (hasScannedRef.current || !videoRef.current) return;

        try {
          const barcodes = await detector.detect(video);
          if (barcodes.length > 0) {
            handleScanResult(barcodes[0].rawValue);
            return;
          }
        } catch {
          // 忽略检测错误，继续扫描
        }

        animationFrameRef.current = requestAnimationFrame(scan);
      };

      scan();
    },
    [handleScanResult]
  );

  // 启动摄像头扫描
  const startCameraScanner = useCallback(async () => {
    setScanMode('camera');
    setCameraError(null);
    setError(null);
    hasScannedRef.current = false;

    try {
      // 请求摄像头权限
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });

      streamRef.current = stream;

      // 等待 video 元素准备好
      await new Promise(resolve => setTimeout(resolve, 50));

      if (!videoRef.current) {
        throw new Error('视频元素未就绪');
      }

      const video = videoRef.current;
      video.srcObject = stream;
      await video.play();

      setIsScanning(true);

      // 检查是否支持原生 BarcodeDetector API
      if (window.BarcodeDetector) {
        try {
          const formats = await window.BarcodeDetector.getSupportedFormats?.();
          if (formats?.includes('qr_code')) {
            const detector = new window.BarcodeDetector({
              formats: ['qr_code'],
            });
            scannerRef.current = detector;
            scanWithBarcodeDetector(detector, video);
            console.log('✅ 使用原生 BarcodeDetector API');
            return;
          }
        } catch {
          // 回退到 jsQR
        }
      }

      // 使用 jsQR 作为后备
      console.log('📱 使用 jsQR 库扫描');
      const canvas = canvasRef.current;
      if (!canvas) {
        throw new Error('Canvas 元素未就绪');
      }

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) {
        throw new Error('无法获取 Canvas 上下文');
      }

      scanWithJsQR(canvas, ctx, video);
    } catch (err) {
      console.error('启动摄像头失败:', err);
      setIsScanning(false);
      stopCamera();

      if (err instanceof Error) {
        if (
          err.name === 'NotAllowedError' ||
          err.message.includes('Permission')
        ) {
          setCameraError('请允许访问摄像头权限');
        } else if (
          err.name === 'NotFoundError' ||
          err.message.includes('not found')
        ) {
          setCameraError('未找到可用的摄像头');
        } else if (err.name === 'NotReadableError') {
          setCameraError('摄像头被其他应用占用');
        } else if (
          err.message.includes('SSL') ||
          err.message.includes('secure')
        ) {
          setCameraError('需要 HTTPS 环境才能使用摄像头');
        } else {
          setCameraError(`无法启动摄像头: ${err.message}`);
        }
      } else {
        setCameraError('无法启动摄像头，请尝试上传图片');
      }
    }
  }, [scanWithBarcodeDetector, scanWithJsQR, stopCamera]);

  // 返回选择界面
  const handleBackToSelect = useCallback(() => {
    stopCamera();
    setScanMode('select');
    setError(null);
    setCameraError(null);
    hasScannedRef.current = false;
  }, [stopCamera]);

  // 文件上传扫描
  const handleFileUpload = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      setError(null);
      setIsScanning(true);
      setScanMode('upload');

      try {
        const result = await scanImageFile(file);

        if (result.success && result.data) {
          hasScannedRef.current = true;

          if (!isValidBeanQRCode(result.data)) {
            setError('这不是有效的咖啡豆二维码');
            setIsScanning(false);
            hasScannedRef.current = false;
            return;
          }

          const bean = deserializeBeanFromQRCode(result.data);
          if (!bean) {
            setError('无法解析二维码数据');
            setIsScanning(false);
            hasScannedRef.current = false;
            return;
          }

          setIsScanning(false);
          onScanSuccess(bean);
          modalHistory.back();
        } else {
          setError(result.error || '未能识别二维码');
          setIsScanning(false);
        }
      } catch (err) {
        console.error('File scan error:', err);
        setError('识别失败，请重试');
        setIsScanning(false);
      }

      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    },
    [onScanSuccess]
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
            className="fixed inset-0 z-70 bg-black/50"
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
            className="fixed inset-x-0 bottom-0 z-70 mx-auto max-h-[90vh] max-w-[500px] overflow-hidden rounded-t-2xl bg-neutral-50 shadow-xl dark:bg-neutral-900"
          >
            {/* 拖动条 */}
            <div className="sticky top-0 z-10 flex justify-center bg-neutral-50 py-2 dark:bg-neutral-900">
              <div className="h-1.5 w-12 rounded-full bg-neutral-200 dark:bg-neutral-700" />
            </div>

            {/* 内容区域 */}
            <div className="pb-safe-bottom max-h-[calc(90vh-40px)] overflow-auto px-6">
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

              {/* 错误提示 */}
              {(error || cameraError) && (
                <div className="mb-6 flex items-start gap-2 rounded-lg bg-red-50 p-3 dark:bg-red-900/20">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />
                  <p className="text-sm text-red-600 dark:text-red-400">
                    {error || cameraError}
                  </p>
                </div>
              )}

              {/* 选择模式界面 */}
              {scanMode === 'select' && (
                <div className="mb-4 flex flex-col gap-3">
                  {/* 实时扫描按钮 */}
                  <button
                    onClick={startCameraScanner}
                    className="flex items-center justify-center gap-3 rounded-lg bg-neutral-900 py-4 text-neutral-100 transition-opacity hover:opacity-90 dark:bg-neutral-100 dark:text-neutral-900"
                  >
                    <Camera className="h-5 w-5" />
                    <span className="text-sm font-medium">打开摄像头扫描</span>
                  </button>

                  {/* 上传图片按钮 */}
                  <button
                    onClick={handleUploadClick}
                    disabled={isScanning}
                    className="flex items-center justify-center gap-3 rounded-lg bg-neutral-200 py-4 text-neutral-800 transition-opacity hover:opacity-90 disabled:opacity-50 dark:bg-neutral-800 dark:text-neutral-100"
                  >
                    <Upload className="h-5 w-5" />
                    <span className="text-sm font-medium">
                      {isScanning ? '识别中...' : '上传二维码图片'}
                    </span>
                  </button>
                </div>
              )}

              {/* 摄像头扫描界面 */}
              {scanMode === 'camera' && (
                <div className="mb-4">
                  {/* 扫描器容器 - 正方形 */}
                  <div className="relative mx-auto mb-4 aspect-square w-full max-w-[300px] overflow-hidden rounded-xl bg-black">
                    {/* 视频元素 */}
                    <video
                      ref={videoRef}
                      className="absolute inset-0 h-full w-full object-cover"
                      playsInline
                      muted
                      autoPlay
                    />

                    {/* 隐藏的 Canvas 用于 jsQR */}
                    <canvas ref={canvasRef} className="hidden" />

                    {/* 扫描框 */}
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                      <div className="relative h-48 w-48">
                        {/* 四个角 */}
                        <div className="absolute top-0 left-0 h-6 w-6 rounded-tl border-t-2 border-l-2 border-white/80" />
                        <div className="absolute top-0 right-0 h-6 w-6 rounded-tr border-t-2 border-r-2 border-white/80" />
                        <div className="absolute bottom-0 left-0 h-6 w-6 rounded-bl border-b-2 border-l-2 border-white/80" />
                        <div className="absolute right-0 bottom-0 h-6 w-6 rounded-br border-r-2 border-b-2 border-white/80" />

                        {/* 扫描线动画 */}
                        {isScanning && (
                          <div className="animate-scan absolute inset-x-2 top-2 h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent" />
                        )}
                      </div>
                    </div>

                    {/* 加载指示器 */}
                    {!isScanning && !cameraError && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                      </div>
                    )}
                  </div>

                  {/* 提示文字 */}
                  <p className="mb-4 text-center text-sm text-neutral-600 dark:text-neutral-400">
                    将二维码对准扫描框内
                  </p>

                  {/* 返回按钮 */}
                  <button
                    onClick={handleBackToSelect}
                    className="flex w-full items-center justify-center gap-3 rounded-lg bg-neutral-200 py-4 text-neutral-800 transition-opacity hover:opacity-90 dark:bg-neutral-800 dark:text-neutral-100"
                  >
                    <span className="text-sm font-medium">返回</span>
                  </button>
                </div>
              )}

              {/* 上传模式（显示返回按钮） */}
              {scanMode === 'upload' && (
                <div className="mb-4 flex flex-col gap-3">
                  <button
                    onClick={handleBackToSelect}
                    className="flex w-full items-center justify-center gap-3 rounded-lg bg-neutral-200 py-4 text-neutral-800 transition-opacity hover:opacity-90 dark:bg-neutral-800 dark:text-neutral-100"
                  >
                    <span className="text-sm font-medium">返回重新选择</span>
                  </button>
                </div>
              )}

              {/* 隐藏的文件输入 */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />

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
