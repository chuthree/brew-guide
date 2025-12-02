'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import ActionDrawer from '@/components/common/ui/ActionDrawer';
import { showToast } from '@/components/common/feedback/LightToast';
import { useModalHistory } from '@/lib/hooks/useModalHistory';
import AddCircleIcon from '@public/images/icons/ui/add-circle.svg';
import AddBoxIcon from '@public/images/icons/ui/add-box.svg';

// 模拟 API 开关 - 设置为 true 时使用模拟数据
const USE_MOCK_API = false;

// 模拟识别延迟时间（毫秒）
const MOCK_RECOGNITION_DELAY = 100;

// 模拟返回的咖啡豆数据
const MOCK_BEAN_DATA = {
  name: '西可 洪都拉斯水洗瑰夏',
  roastLevel: '浅度烘焙',
  roastDate: '2024-11-15',
  capacity: '200',
  remaining: '200',
  flavor: ['橘子', '荔枝', '蜂蜜'],
  beanType: 'filter',
  blendComponents: [
    {
      origin: '洪都拉斯',
      process: '水洗',
      variety: '瑰夏',
    },
  ],
};

interface BeanImportModalProps {
  showForm: boolean;
  onImport: (jsonData: string) => Promise<void>;
  onClose: () => void;
  /** 识别图片成功后回调，传递原始图片的 base64 */
  onRecognitionImage?: (imageBase64: string) => void;
}

interface ImportedBean {
  capacity?: number | string;
  remaining?: number | string;
  price?: number | string | null;
  [key: string]: unknown;
}

// 咖啡豆识别提示词
const BEAN_RECOGNITION_PROMPT = `提取图片中的咖啡豆信息,直接返回JSON(单豆返回对象{},多豆返回数组[])。

必填: name (品牌+豆名,如"西可 洪都拉斯水洗瑰夏")

可选(图片有明确信息才填):
- capacity/remaining/price: 纯数字
- roastDate: YYYY-MM-DD
- roastLevel: 极浅烘焙|浅度烘焙|中浅烘焙|中度烘焙|中深烘焙|深度烘焙
- beanType: espresso|filter|omni
- flavor: 风味数组["橘子","荔枝"]
- startDay/endDay: 养豆天数
- blendComponents: 产地/处理法/品种 [{origin:"埃塞俄比亚",process:"日晒",variety:"原生种"}]
- notes: 庄园/处理站/海拔 (产地信息放blendComponents,这里只放补充信息)

规则: 数值不带单位/不编造/不确定不填/直接返回JSON`;

// 步骤类型定义
type ImportStep = 'main' | 'json-input' | 'recognizing';

// 扫描线动画组件
// 四角边框装饰组件
const CornerBorder: React.FC<{
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
}> = ({ position }) => {
  const baseClasses = 'absolute w-6 h-6 border-white/80';
  const positionClasses = {
    'top-left': 'top-0 left-0 border-t-2 border-l-2 rounded-tl-xl',
    'top-right': 'top-0 right-0 border-t-2 border-r-2 rounded-tr-xl',
    'bottom-left': 'bottom-0 left-0 border-b-2 border-l-2 rounded-bl-xl',
    'bottom-right': 'bottom-0 right-0 border-b-2 border-r-2 rounded-br-xl',
  };

  return <div className={`${baseClasses} ${positionClasses[position]}`} />;
};

const ScanningOverlay: React.FC<{ imageUrl: string }> = ({ imageUrl }) => {
  return (
    <div className="relative w-full overflow-hidden rounded-3xl bg-neutral-900">
      {/* 背景图片 - 保持原始比例，变暗处理 */}
      <img
        src={imageUrl}
        alt="正在识别的图片"
        className="w-full rounded-3xl brightness-75"
        style={{ maxHeight: '50vh', objectFit: 'cover' }}
      />

      {/* 四角边框装饰 */}
      <div className="absolute inset-4">
        <CornerBorder position="top-left" />
        <CornerBorder position="top-right" />
        <CornerBorder position="bottom-left" />
        <CornerBorder position="bottom-right" />
      </div>

      {/* 扫描线效果 - 简洁的白色扫描线 */}
      <motion.div
        className="absolute right-0 left-0 h-px"
        style={{
          background:
            'linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.6) 20%, rgba(255, 255, 255, 0.9) 50%, rgba(255, 255, 255, 0.6) 80%, transparent 100%)',
          boxShadow: '0 0 12px 2px rgba(255, 255, 255, 0.3)',
        }}
        initial={{ top: '0%' }}
        animate={{
          top: ['0%', '100%', '0%'],
        }}
        transition={{
          duration: 2,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />
    </div>
  );
};

const BeanImportModal: React.FC<BeanImportModalProps> = ({
  showForm,
  onImport,
  onClose,
  onRecognitionImage,
}) => {
  // 当前步骤
  const [currentStep, setCurrentStep] = useState<ImportStep>('main');
  // 图片识别加载状态
  const [isRecognizing, setIsRecognizing] = useState(false);
  // 识别中的图片 URL
  const [recognizingImageUrl, setRecognizingImageUrl] = useState<string | null>(
    null
  );
  // JSON 输入内容
  const [jsonInputValue, setJsonInputValue] = useState('');
  // 图片输入 ref
  const fileInputRef = useRef<HTMLInputElement>(null);
  // JSON 输入框 ref
  const jsonTextareaRef = useRef<HTMLTextAreaElement>(null);
  // 剪贴板识别状态
  const [clipboardStatus, setClipboardStatus] = useState<'idle' | 'error'>(
    'idle'
  );

  // 返回主界面
  const goBackToMain = useCallback(() => {
    setCurrentStep('main');
    setJsonInputValue('');
    // 清理图片 URL
    if (recognizingImageUrl) {
      URL.revokeObjectURL(recognizingImageUrl);
      setRecognizingImageUrl(null);
    }
    setIsRecognizing(false);
  }, [recognizingImageUrl]);

  // 使用 modalHistory 管理 JSON 输入步骤的返回行为
  useModalHistory({
    id: 'bean-import-json-input',
    isOpen: showForm && currentStep === 'json-input',
    onClose: goBackToMain,
  });

  // 重置状态（当弹窗关闭或重新打开时）
  useEffect(() => {
    if (showForm) {
      setClipboardStatus('idle');
      setCurrentStep('main');
      setJsonInputValue('');
      setIsRecognizing(false);
      if (recognizingImageUrl) {
        URL.revokeObjectURL(recognizingImageUrl);
        setRecognizingImageUrl(null);
      }
    }
  }, [showForm]); // eslint-disable-line react-hooks/exhaustive-deps

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

  // 处理添加数据（通用）
  const handleImportData = useCallback(
    async (data: unknown) => {
      try {
        const isArray = Array.isArray(data);
        const dataArray = isArray ? data : [data];

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
          showToast({
            type: 'error',
            title: isArray ? '部分数据缺少咖啡豆名称' : '数据缺少咖啡豆名称',
          });
          return;
        }

        // 处理数据
        const processedBeans = dataArray.map(bean => ({
          ...ensureStringFields(bean as unknown as ImportedBean),
          timestamp: Date.now(),
        }));

        await onImport(JSON.stringify(processedBeans));
        onClose();
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : '未知错误';
        showToast({ type: 'error', title: `添加失败: ${errorMessage}` });
      }
    },
    [ensureStringFields, onImport, onClose]
  );

  // 处理输入JSON - 进入 JSON 输入步骤
  const handleInputJSON = useCallback(() => {
    setCurrentStep('json-input');
    // 等待动画完成后聚焦输入框
    setTimeout(() => {
      jsonTextareaRef.current?.focus();
    }, 300);
  }, []);

  // 处理剪贴板识别
  const handleClipboardRecognition = useCallback(async () => {
    // 如果当前是错误状态，切换到 JSON 输入模式
    if (clipboardStatus === 'error') {
      setClipboardStatus('idle');
      handleInputJSON();
      return;
    }

    try {
      const clipboardText = await navigator.clipboard.readText();
      if (!clipboardText.trim()) {
        setClipboardStatus('error');
        return;
      }

      // 尝试提取JSON数据
      const { extractJsonFromText } = await import('@/lib/utils/jsonUtils');
      const beanData = extractJsonFromText(clipboardText);

      if (beanData) {
        await handleImportData(beanData);
      } else {
        setClipboardStatus('error');
      }
    } catch (_error) {
      setClipboardStatus('error');
    }
  }, [handleImportData, clipboardStatus, handleInputJSON]);

  // 处理图片上传识别
  const handleImageUpload = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      // 验证文件类型
      if (!file.type.startsWith('image/')) {
        showToast({ type: 'error', title: '请上传图片文件' });
        return;
      }

      // 验证文件大小（最大 10MB）
      if (file.size > 10 * 1024 * 1024) {
        showToast({ type: 'error', title: '图片大小不能超过 10MB' });
        return;
      }

      // 创建图片预览 URL
      const imageUrl = URL.createObjectURL(file);
      setRecognizingImageUrl(imageUrl);
      setCurrentStep('recognizing');
      setIsRecognizing(true);

      try {
        let beanData: unknown;

        if (USE_MOCK_API) {
          // 模拟 API 请求
          await new Promise(resolve =>
            setTimeout(resolve, MOCK_RECOGNITION_DELAY)
          );
          beanData = MOCK_BEAN_DATA;
        } else {
          // 真实 API 请求
          // 压缩图片
          const { smartCompress } = await import(
            '@/lib/utils/imageCompression'
          );
          const compressedFile = await smartCompress(file);

          // 识别图片
          const { recognizeBeanImage } = await import(
            '@/lib/api/beanRecognition'
          );

          beanData = await recognizeBeanImage(compressedFile);
        }

        // 识别成功后，检查是否为单个豆子（非批量），如果是则传递识别图片
        // 判断条件：不是数组，或者是只有一个元素的数组
        const isSingleBean =
          !Array.isArray(beanData) ||
          (Array.isArray(beanData) && beanData.length === 1);
        if (isSingleBean && onRecognitionImage) {
          // 将原始图片文件转换为 base64 并压缩
          // 使用 Promise 确保图片处理完成后再继续
          await new Promise<void>(resolve => {
            const reader = new FileReader();
            reader.onload = async () => {
              const base64 = reader.result as string;
              if (base64) {
                try {
                  // 压缩图片，与表单中的压缩参数保持一致
                  const { compressBase64Image } = await import(
                    '@/lib/utils/imageCapture'
                  );
                  const compressedBase64 = await compressBase64Image(base64, {
                    maxSizeMB: 0.1, // 100KB
                    maxWidthOrHeight: 1200,
                    initialQuality: 0.8,
                  });
                  onRecognitionImage(compressedBase64);
                } catch (error) {
                  // 压缩失败时使用原图
                  if (process.env.NODE_ENV === 'development') {
                    console.error('识别图片压缩失败:', error);
                  }
                  onRecognitionImage(base64);
                }
              }
              resolve();
            };
            reader.onerror = () => resolve();
            reader.readAsDataURL(file);
          });
        }

        // 清理状态
        setIsRecognizing(false);
        URL.revokeObjectURL(imageUrl);
        setRecognizingImageUrl(null);
        setCurrentStep('main');

        await handleImportData(beanData);
      } catch (error) {
        console.error('图片识别失败:', error);
        showToast({
          type: 'error',
          title: error instanceof Error ? error.message : '图片识别失败',
        });
        setIsRecognizing(false);
        URL.revokeObjectURL(imageUrl);
        setRecognizingImageUrl(null);
        setCurrentStep('main');
      }

      // 清除文件输入，以便可以再次选择同一文件
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    },
    [handleImportData, onRecognitionImage]
  );

  // 触发图片选择
  const handleUploadImageClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  // 复制提示词 - 使用兼容性更好的方法
  const handleCopyPrompt = useCallback(async () => {
    try {
      // 首先尝试使用现代API
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(BEAN_RECOGNITION_PROMPT);
        showToast({ type: 'success', title: '提示词已复制' });
        return;
      }

      // 回退方法：创建临时textarea元素
      const textArea = document.createElement('textarea');
      textArea.value = BEAN_RECOGNITION_PROMPT;

      // 设置样式使其不可见
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      textArea.style.top = '-999999px';
      document.body.appendChild(textArea);

      // 选择文本并复制
      textArea.focus();
      textArea.select();

      const successful = document.execCommand('copy');
      if (successful) {
        showToast({ type: 'success', title: '提示词已复制' });
      } else {
        showToast({ type: 'error', title: '复制失败' });
      }

      // 清理临时元素
      document.body.removeChild(textArea);
    } catch (error) {
      console.error('复制提示词失败:', error);
      showToast({ type: 'error', title: '复制失败' });
    }
  }, []);

  // 提交 JSON 输入
  const handleSubmitJson = useCallback(async () => {
    if (!jsonInputValue.trim()) {
      showToast({ type: 'error', title: '请输入咖啡豆数据' });
      return;
    }

    try {
      const { extractJsonFromText } = await import('@/lib/utils/jsonUtils');
      const beanData = extractJsonFromText(jsonInputValue);

      if (beanData) {
        await handleImportData(beanData);
        setJsonInputValue('');
        setCurrentStep('main');
      } else {
        showToast({ type: 'error', title: '无法解析输入的数据' });
      }
    } catch (_error) {
      showToast({ type: 'error', title: '数据格式错误' });
    }
  }, [jsonInputValue, handleImportData]);

  // 取消输入 - 返回主界面
  const handleCancelJsonInput = useCallback(() => {
    goBackToMain();
  }, [goBackToMain]);

  // 关闭时重置状态
  const handleClose = useCallback(() => {
    setCurrentStep('main');
    setJsonInputValue('');
    setIsRecognizing(false);
    if (recognizingImageUrl) {
      URL.revokeObjectURL(recognizingImageUrl);
      setRecognizingImageUrl(null);
    }
    onClose();
  }, [onClose, recognizingImageUrl]);

  // 操作项配置
  const actions = [
    {
      id: 'image',
      label: '图片识别咖啡豆（推荐）',
      onClick: handleUploadImageClick,
    },
    {
      id: 'clipboard',
      label: clipboardStatus === 'error' ? '识别失败，再试一次' : '识别剪切板',
      onClick: handleClipboardRecognition,
    },
    {
      id: 'json',
      label: '输入 JSON',
      onClick: handleInputJSON,
    },
  ];

  // 主界面内容
  const mainContent = (
    <>
      {/* 图标区域 */}
      <div className="mb-6 text-neutral-800 dark:text-neutral-200">
        <AddCircleIcon width={128} height={128} />
      </div>

      {/* 内容区域 */}
      <ActionDrawer.Content>
        <p className="text-neutral-500 dark:text-neutral-400">
          推荐使用
          <span className="text-neutral-800 dark:text-neutral-200">
            图片识别
          </span>
          添加咖啡豆，也可将图片和
          <button
            onClick={handleCopyPrompt}
            className="mx-0.5 text-neutral-800 underline decoration-neutral-400 underline-offset-2 hover:opacity-80 dark:text-neutral-200"
          >
            提示词
          </button>
          发给 AI 生成 JSON 后粘贴导入。
        </p>
      </ActionDrawer.Content>

      {/* 操作按钮列表 */}
      <div className="flex flex-col gap-2">
        {actions.map(action => (
          <motion.button
            key={action.id}
            whileTap={{ scale: 0.98 }}
            onClick={action.onClick}
            className="w-full rounded-full bg-neutral-100 px-4 py-3 text-left text-sm font-medium text-neutral-800 dark:bg-neutral-800 dark:text-white"
          >
            {action.label}
          </motion.button>
        ))}
      </div>
    </>
  );

  // JSON 输入界面内容
  const jsonInputContent = (
    <>
      {/* 图标区域 */}
      <div className="mb-6 text-neutral-800 dark:text-neutral-200">
        <AddBoxIcon width={128} height={128} />
      </div>

      {/* 内容区域 */}
      <ActionDrawer.Content>
        <p className="text-neutral-500 dark:text-neutral-400">
          粘贴
          <span className="text-neutral-800 dark:text-neutral-200">
            {' '}
            AI 生成或他人分享
          </span>
          的咖啡豆 JSON 数据，支持单个或批量导入。
        </p>
      </ActionDrawer.Content>

      {/* JSON 输入区域 */}
      <div className="flex flex-col gap-2">
        <textarea
          ref={jsonTextareaRef}
          value={jsonInputValue}
          onChange={e => setJsonInputValue(e.target.value)}
          placeholder='{"name": "咖啡豆名称", ...}'
          className="h-24 w-full resize-none rounded-2xl bg-neutral-100 px-4 py-3 text-sm text-neutral-800 placeholder:text-neutral-400 focus:ring-2 focus:ring-neutral-300 focus:outline-none dark:bg-neutral-800 dark:text-white dark:placeholder:text-neutral-500 dark:focus:ring-neutral-600"
        />
        <div className="flex gap-2">
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={handleCancelJsonInput}
            className="flex-1 rounded-full bg-neutral-100 px-4 py-3 text-sm font-medium text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300"
          >
            取消
          </motion.button>
          <motion.button
            whileTap={!jsonInputValue.trim() ? undefined : { scale: 0.98 }}
            onClick={handleSubmitJson}
            disabled={!jsonInputValue.trim()}
            className={`flex-1 rounded-full px-4 py-3 text-sm font-medium transition-colors ${
              jsonInputValue.trim()
                ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900'
                : 'bg-neutral-100 text-neutral-400 dark:bg-neutral-800 dark:text-neutral-500'
            }`}
          >
            确认导入
          </motion.button>
        </div>
      </div>
    </>
  );

  // 识别中界面内容
  const recognizingContent = (
    <>
      {/* 图片扫描区域 */}
      <div className="mb-6">
        {recognizingImageUrl && (
          <ScanningOverlay imageUrl={recognizingImageUrl} />
        )}
      </div>

      {/* 内容区域 */}
      <ActionDrawer.Content>
        <p className="text-neutral-500 dark:text-neutral-400">
          正在
          <span className="text-neutral-800 dark:text-neutral-200">
            识别咖啡豆信息
          </span>
          ，请稍候...
        </p>
      </ActionDrawer.Content>
    </>
  );

  // 根据步骤渲染内容
  const renderContent = () => {
    switch (currentStep) {
      case 'recognizing':
        return recognizingContent;
      case 'json-input':
        return jsonInputContent;
      default:
        return mainContent;
    }
  };

  return (
    <>
      <ActionDrawer
        isOpen={showForm}
        onClose={handleClose}
        historyId="bean-import"
      >
        <ActionDrawer.Switcher activeKey={currentStep}>
          {renderContent()}
        </ActionDrawer.Switcher>
      </ActionDrawer>

      {/* 隐藏的文件输入 */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleImageUpload}
      />
    </>
  );
};

export default BeanImportModal;
