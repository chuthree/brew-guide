'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft,
  ChevronRight,
  Clipboard,
  Code,
  ExternalLink,
  ScanLine,
  Image as ImageIcon,
} from 'lucide-react';
import BeanSearchModal from './BeanSearchModal';
import QRScannerModal from '@/components/coffee-bean/Scanner/QRScannerModal';
import type { CoffeeBean } from '@/types/app';
import { getChildPageStyle } from '@/lib/navigation/pageTransition';

interface BeanImportModalProps {
  showForm: boolean;
  onImport: (jsonData: string) => Promise<void>;
  onClose: () => void;
}

interface ImportedBean {
  capacity?: number | string;
  remaining?: number | string;
  price?: number | string | null;
  [key: string]: unknown;
}

const BeanImportModal: React.FC<BeanImportModalProps> = ({
  showForm,
  onImport,
  onClose,
}) => {
  // 状态管理
  const [importData, setImportData] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [currentMode, setCurrentMode] = useState<'buttons' | 'input'>(
    'buttons'
  );
  const [inputType, setInputType] = useState<
    'clipboard' | 'json' | 'search' | 'qr' | 'image'
  >('clipboard');
  // 搜索模态框状态
  const [showSearchModal, setShowSearchModal] = useState(false);
  // 二维码扫描模态框状态
  const [showQRScannerModal, setShowQRScannerModal] = useState(false);
  // 图片识别加载状态
  const [isRecognizing, setIsRecognizing] = useState(false);

  // 转场动画状态
  const [shouldRender, setShouldRender] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  // 清除消息状态
  const clearMessages = useCallback(() => {
    setError(null);
    setSuccess(null);
  }, []);

  // 重置所有状态
  const resetAllStates = useCallback(() => {
    setImportData('');
    setCurrentMode('buttons');
    setInputType('clipboard');
    setShowSearchModal(false);
    clearMessages();
  }, [clearMessages]);

  // 关闭处理
  const handleClose = useCallback(() => {
    setIsVisible(false); // 触发退出动画
    window.dispatchEvent(new CustomEvent('beanImportClosing')); // 通知父组件

    setTimeout(() => {
      resetAllStates();

      // 如果历史栈中有我们添加的模态框记录，先返回一步
      if (window.history.state?.modal === 'bean-import') {
        window.history.back();
      } else {
        // 否则直接调用 onClose
        onClose();
      }
    }, 350); // 350ms 后真正关闭
  }, [resetAllStates, onClose]);

  // 处理显示/隐藏动画
  useEffect(() => {
    if (showForm) {
      setShouldRender(true);
      // 使用 requestAnimationFrame 触发动画（比 setTimeout 更快更流畅）
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setIsVisible(true);
        });
      });
    } else {
      setIsVisible(false);
      const timer = setTimeout(() => {
        setShouldRender(false);
      }, 350); // 与动画时长匹配
      return () => clearTimeout(timer);
    }
  }, [showForm]);

  // 历史栈管理 - 支持硬件返回键和浏览器返回按钮
  useEffect(() => {
    if (!showForm) return;

    // 添加模态框历史记录
    window.history.pushState({ modal: 'bean-import' }, '');

    // 监听返回事件
    const handlePopState = (event: PopStateEvent) => {
      // 检查是否是我们的模态框状态
      if (event.state?.modal !== 'bean-import') {
        // 如果当前还显示模态框，说明用户按了返回键，关闭模态框
        if (showForm) {
          handleClose();
        }
      }
    };

    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [showForm, handleClose]);

  // 表单关闭时重置状态
  useEffect(() => {
    if (!showForm) {
      resetAllStates();
    }
  }, [showForm, resetAllStates]);

  // 确保字段为字符串类型
  const ensureStringFields = useCallback((item: ImportedBean): ImportedBean => {
    const result = { ...item };
    ['capacity', 'remaining', 'price'].forEach(field => {
      if (result[field] !== undefined && result[field] !== null) {
        result[field] = String(result[field]);
      }
    });
    return result;
  }, []);

  // 处理添加数据
  const handleImport = useCallback(async () => {
    if (!importData.trim()) {
      setError('请输入要添加的数据');
      return;
    }

    try {
      const { extractJsonFromText } = await import('@/lib/utils/jsonUtils');
      setError(null);
      const beanData = extractJsonFromText(importData);

      if (!beanData) {
        setError('无法从输入中提取有效数据');
        return;
      }

      const isArray = Array.isArray(beanData);
      const dataArray = isArray ? beanData : [beanData];

      // 验证数据 - 只验证是否有咖啡豆名称
      if (
        !dataArray.every(
          item =>
            typeof item === 'object' &&
            item !== null &&
            'name' in item &&
            typeof (item as Record<string, unknown>).name === 'string' &&
            ((item as Record<string, unknown>).name as string).trim() !== ''
        )
      ) {
        setError(isArray ? '部分数据缺少咖啡豆名称' : '数据缺少咖啡豆名称');
        return;
      }

      // 处理数据
      const processedBeans = dataArray.map(bean => ({
        ...ensureStringFields(bean as unknown as ImportedBean),
        timestamp: Date.now(),
      }));

      setSuccess(
        isArray ? '正在批量添加咖啡豆数据...' : '正在添加咖啡豆数据...'
      );
      await onImport(JSON.stringify(processedBeans));
      handleClose();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      setError(`添加失败: ${errorMessage}`);
      setSuccess(null);
    }
  }, [importData, ensureStringFields, onImport, handleClose]);

  // 从搜索组件选择咖啡豆
  const handleSelectFromSearch = useCallback((bean: CoffeeBean) => {
    setImportData(JSON.stringify(bean, null, 2));
    setSuccess('✨ 已选择咖啡豆，请检查信息是否正确');
    setInputType('search');
    setCurrentMode('input');
  }, []);

  // 从二维码扫描获取咖啡豆
  const handleScanSuccess = useCallback((bean: Partial<CoffeeBean>) => {
    setImportData(JSON.stringify(bean, null, 2));
    setSuccess('✨ 已扫描二维码，请检查信息是否正确');
    setInputType('qr');
    setCurrentMode('input');
    setShowQRScannerModal(false); // 关闭扫描器模态框
  }, []);

  // 处理剪贴板识别
  const handleClipboardRecognition = useCallback(async () => {
    clearMessages();
    setInputType('clipboard');
    setCurrentMode('input');

    try {
      const clipboardText = await navigator.clipboard.readText();
      if (!clipboardText.trim()) {
        setError('剪贴板为空');
        return;
      }

      // 尝试提取JSON数据
      const { extractJsonFromText } = await import('@/lib/utils/jsonUtils');
      const beanData = extractJsonFromText(clipboardText);

      if (beanData) {
        setImportData(JSON.stringify(beanData, null, 2));
        setSuccess('✨ 从剪贴板识别到咖啡豆数据');
      } else {
        setImportData(clipboardText);
        setSuccess('已粘贴剪贴板内容，请检查数据格式');
      }
    } catch (_error) {
      setError('无法访问剪贴板，请手动粘贴数据');
    }
  }, [clearMessages]);

  // 处理扫描二维码
  const handleScanQRCode = useCallback(() => {
    setShowQRScannerModal(true);
  }, []);

  // 处理图片上传识别
  const handleImageUpload = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      // 验证文件类型
      if (!file.type.startsWith('image/')) {
        setError('请上传图片文件');
        return;
      }

      // 验证文件大小（最大 10MB）
      if (file.size > 10 * 1024 * 1024) {
        setError('图片大小不能超过 10MB');
        return;
      }

      clearMessages();
      setIsRecognizing(true);
      setInputType('image');
      setCurrentMode('input');
      setImportData('');

      try {
        // 压缩图片
        console.log('📸 开始压缩图片...');
        const { smartCompress } = await import('@/lib/utils/imageCompression');
        const compressedFile = await smartCompress(file);

        // 识别图片
        const { recognizeBeanImage } = await import(
          '@/lib/api/beanRecognition'
        );
        const beanData = await recognizeBeanImage(compressedFile);

        setImportData(JSON.stringify(beanData, null, 2));
        setSuccess('✨ 图片识别成功，请检查信息是否正确');
        setIsRecognizing(false);
      } catch (error) {
        console.error('图片识别失败:', error);
        setError(
          error instanceof Error ? error.message : '图片识别失败，请重试'
        );
        setIsRecognizing(false);
      }
    },
    [clearMessages]
  );

  // 触发图片选择
  const handleUploadImageClick = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = e => handleImageUpload(e as any);
    input.click();
  }, [handleImageUpload]);

  // 处理输入JSON
  const handleInputJSON = useCallback(() => {
    clearMessages();
    setInputType('json');
    setCurrentMode('input');
  }, [clearMessages]);

  // 返回到按钮界面
  const handleBackToButtons = useCallback(() => {
    setCurrentMode('buttons');
    setImportData('');
    clearMessages();
  }, [clearMessages]);

  // 重新识别剪切板
  const handleRetryClipboard = useCallback(async () => {
    await handleClipboardRecognition();
  }, [handleClipboardRecognition]);

  return (
    <>
      {shouldRender && (
        <div
          className="fixed inset-0 mx-auto flex max-w-[500px] flex-col bg-neutral-50 dark:bg-neutral-900"
          style={getChildPageStyle(isVisible)}
        >
          {/* 头部 - 只有左上角返回按钮 */}
          <div className="pt-safe-top flex items-center px-4 py-4">
            <button
              onClick={handleClose}
              className="flex h-8 w-8 items-center justify-center rounded-full text-neutral-800 transition-opacity hover:opacity-80 dark:text-white"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
          </div>

          {/* 内容区域 */}
          <div
            className="pb-safe-bottom mt-16 flex-1 px-6"
            style={{
              // 正常情况下允许垂直滚动
              overflowY: 'auto',
              // 使用 CSS 来处理触摸行为
              touchAction: 'pan-y pinch-zoom',
            }}
          >
            {/* 大标题 */}
            <div className="mb-8">
              <h1 className="text-md mb-4 font-bold text-neutral-800 dark:text-white">
                添加咖啡豆
              </h1>
              <AnimatePresence mode="wait">
                <motion.p
                  key={currentMode}
                  initial={{ opacity: 0, x: 5 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -5 }}
                  transition={{ duration: 0.2, ease: 'easeInOut' }}
                  className="text-sm text-neutral-600 dark:text-neutral-400"
                >
                  {currentMode === 'buttons' ? (
                    <>
                      <span>将包含咖啡豆信息的图片发送至</span>
                      <a
                        href="https://doubao.com/bot/duJYQEFd"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ml-1 inline-flex items-center gap-1 text-neutral-800 underline decoration-neutral-400 underline-offset-2 hover:opacity-80 dark:text-white"
                      >
                        豆包定制智能体
                        <ExternalLink className="h-3 w-3" />
                      </a>
                      <span>，并复制返回的 JSON 数据后点击下方按钮。</span>
                    </>
                  ) : (
                    <>
                      {inputType === 'clipboard' &&
                        '已自动识别剪切板内容，请检查数据格式是否正确'}
                      {inputType === 'json' &&
                        '请粘贴咖啡豆的 JSON 数据或文本信息'}
                      {inputType === 'search' &&
                        '从搜索结果自动填入，请检查信息是否正确'}
                      {inputType === 'qr' && '已扫描二维码，请检查信息是否正确'}
                      {inputType === 'image' && '请检查识别结果是否正确'}
                    </>
                  )}
                </motion.p>
              </AnimatePresence>
            </div>

            {/* 动态内容区域 */}
            <AnimatePresence mode="wait">
              {currentMode === 'buttons' ? (
                <motion.div
                  key="buttons"
                  initial={{ opacity: 0, x: 8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -8 }}
                  transition={{ duration: 0.25, ease: 'easeInOut' }}
                  className="space-y-3"
                >
                  {/* 识别剪切板 */}
                  <button
                    onClick={handleClipboardRecognition}
                    className="flex w-full items-center justify-between rounded bg-neutral-200/50 p-4 transition-colors dark:bg-neutral-800"
                  >
                    <div className="flex items-center space-x-3">
                      <Clipboard className="h-5 w-5 text-neutral-600 dark:text-neutral-400" />
                      <span className="font-medium text-neutral-800 dark:text-white">
                        识别剪切板
                      </span>
                    </div>
                    <ChevronRight className="h-5 w-5 text-neutral-500" />
                  </button>

                  {/* 输入JSON */}
                  <button
                    onClick={handleInputJSON}
                    className="flex w-full items-center justify-between rounded bg-neutral-200/50 p-4 transition-colors dark:bg-neutral-800"
                  >
                    <div className="flex items-center space-x-3">
                      <Code className="h-5 w-5 text-neutral-600 dark:text-neutral-400" />
                      <span className="font-medium text-neutral-800 dark:text-white">
                        输入 JSON
                      </span>
                    </div>
                    <ChevronRight className="h-5 w-5 text-neutral-500" />
                  </button>

                  {/* 扫描二维码 */}
                  <button
                    onClick={handleScanQRCode}
                    className="flex w-full items-center justify-between rounded bg-neutral-200/50 p-4 transition-colors dark:bg-neutral-800"
                  >
                    <div className="flex items-center space-x-3">
                      <ScanLine className="h-5 w-5 text-neutral-600 dark:text-neutral-400" />
                      <span className="font-medium text-neutral-800 dark:text-white">
                        扫描二维码
                      </span>
                    </div>
                    <ChevronRight className="h-5 w-5 text-neutral-500" />
                  </button>

                  {/* 分隔线 */}
                  <div className="py-2">
                    <div className="h-px bg-neutral-100 dark:bg-neutral-800/50"></div>
                  </div>

                  {/* 拍照识别咖啡豆 */}
                  <button
                    onClick={handleUploadImageClick}
                    className="flex w-full items-center justify-between rounded bg-neutral-200/50 p-4 transition-colors dark:bg-neutral-800"
                  >
                    <div className="flex items-center space-x-3">
                      <ImageIcon className="h-5 w-5 text-neutral-600 dark:text-neutral-400" />
                      <span className="font-medium text-neutral-800 dark:text-white">
                        拍照识别咖啡豆
                      </span>
                    </div>
                    <ChevronRight className="h-5 w-5 text-neutral-500" />
                  </button>
                </motion.div>
              ) : (
                <motion.div
                  key="input"
                  initial={{ opacity: 0, x: 8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -8 }}
                  transition={{ duration: 0.25, ease: 'easeInOut' }}
                  className="space-y-3"
                >
                  {/* 返回按钮 */}
                  <button
                    onClick={handleBackToButtons}
                    className="flex w-full items-center justify-between rounded bg-neutral-200/50 p-4 transition-colors dark:bg-neutral-800"
                  >
                    <div className="flex items-center space-x-3">
                      <ChevronLeft className="h-5 w-5 text-neutral-600 dark:text-neutral-400" />
                      <span className="font-medium text-neutral-800 dark:text-white">
                        返回上一步
                      </span>
                    </div>
                  </button>

                  {/* 输入框 */}
                  <div className="relative">
                    <textarea
                      className="w-full resize-none rounded border border-transparent bg-neutral-200/50 p-4 text-sm text-neutral-800 transition-all placeholder:text-neutral-400 focus:ring-2 focus:ring-neutral-300 focus:outline-none dark:bg-neutral-800 dark:text-white dark:placeholder:text-neutral-500 dark:focus:ring-neutral-700"
                      placeholder={
                        isRecognizing
                          ? '识别中...'
                          : success
                            ? `✅ ${success}`
                            : inputType === 'clipboard'
                              ? '识别剪切板内容中...'
                              : inputType === 'json'
                                ? '粘贴咖啡豆数据...'
                                : inputType === 'image'
                                  ? '图片识别结果将显示在这里'
                                  : '咖啡豆信息'
                      }
                      value={importData}
                      onChange={e => setImportData(e.target.value)}
                      rows={12}
                      disabled={isRecognizing}
                    />
                    {/* 错误提示 - 左下角 */}
                    {error && (
                      <div className="absolute bottom-3 left-3 flex items-center gap-2 text-xs text-neutral-600 dark:text-neutral-400">
                        <span className="h-1.5 w-1.5 rounded-full bg-red-400/60"></span>
                        <span>{error}</span>
                      </div>
                    )}
                  </div>

                  {/* 底部按钮区域 */}
                  <div className="space-y-3">
                    {/* 重新识别剪切板按钮 - 只在剪切板模式且有错误时显示 */}
                    {error && inputType === 'clipboard' && (
                      <button
                        onClick={handleRetryClipboard}
                        className="flex w-full items-center justify-between rounded bg-neutral-200/50 p-4 transition-colors hover:bg-neutral-200/70 dark:bg-neutral-800 dark:hover:bg-neutral-800/70"
                      >
                        <div className="flex items-center space-x-3">
                          <Clipboard className="h-5 w-5 text-neutral-600 dark:text-neutral-400" />
                          <span className="font-medium text-neutral-800 dark:text-white">
                            重新识别剪切板
                          </span>
                        </div>
                      </button>
                    )}

                    {/* 添加按钮 - 只在有数据时显示 */}
                    {importData.trim() && !isRecognizing && (
                      <button
                        onClick={handleImport}
                        className="flex w-full items-center justify-center rounded bg-neutral-200/50 p-4 transition-colors hover:bg-neutral-200/70 dark:bg-neutral-800 dark:hover:bg-neutral-800/70"
                      >
                        <span className="font-medium text-neutral-800 dark:text-white">
                          添加咖啡豆
                        </span>
                      </button>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      )}

      {/* 搜索模态框 */}
      <BeanSearchModal
        isOpen={showSearchModal}
        onClose={() => setShowSearchModal(false)}
        onSelectBean={handleSelectFromSearch}
      />

      {/* 二维码扫描模态框 */}
      <QRScannerModal
        isOpen={showQRScannerModal}
        onClose={() => setShowQRScannerModal(false)}
        onScanSuccess={handleScanSuccess}
      />
    </>
  );
};

export default BeanImportModal;
