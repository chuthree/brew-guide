'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import ActionDrawer from '@/components/common/ui/ActionDrawer';
import { showToast } from '@/components/common/feedback/LightToast';
import { useModalHistory } from '@/lib/hooks/useModalHistory';
import AddCircleIcon from '@public/images/icons/ui/add-circle.svg';
import AddBoxIcon from '@public/images/icons/ui/add-box.svg';
import { SettingsOptions } from '@/components/settings/Settings';

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
  /** 设置项，用于控制是否自动填充识图图片 */
  settings?: SettingsOptions;
}

interface ImportedBean {
  capacity?: number | string;
  remaining?: number | string;
  price?: number | string | null;
  [key: string]: unknown;
}

// 咖啡豆识别提示词
const BEAN_RECOGNITION_PROMPT = `你是咖啡豆信息提取专家。仔细阅读图片中所有文字，提取咖啡豆信息并返回JSON。

## 输出格式（严格遵守）
{
  "name": "品牌 产品名",
  "blendComponents": [{"origin": "产地", "estate": "庄园", "process": "处理法", "variety": "品种"}],
  "flavor": ["风味1", "风味2"],
  "roastLevel": "烘焙度",
  "roastDate": "YYYY-MM-DD",
  "capacity": 数字,
  "price": 数字,
  "beanType": "filter|espresso|omni",
  "notes": "海拔/处理站/批次号等补充信息，用/分隔"
}

## 字段说明
- name: 必填，格式"烘焙商 豆名"如"少数派 花月夜"
- blendComponents: 【必须是数组】产地/庄园/处理法/品种，如[{"origin":"巴拿马","estate":"赏花","process":"日晒","variety":"瑰夏"}]，单品豆也要用数组包裹
- flavor: 风味描述数组，如["柑橘","蜂蜜","花香"]
- roastLevel: 极浅烘焙|浅度烘焙|中浅烘焙|中度烘焙|中深烘焙|深度烘焙
- roastDate: 仅图片有明确日期时填写，缺年份补2025，无日期则不填
- capacity/price: 纯数字不带单位，未知时不填
- beanType: 根据包装标注、容量、烘焙度综合判断。大包装(≥300g)/深烘/意式拼配倾向espresso；小包装(≤200g)/浅烘/单品倾向filter；明确标注全能选omni；无法判断默认filter

## 规则
1. 只提取图片中明确可见的信息，没有的字段不填
2. blendComponents 必须是数组格式 [{...}]`;

// 步骤类型定义
type ImportStep = 'main' | 'json-input' | 'recognizing' | 'multi-preview';

// 最大同时选择图片数
const MAX_IMAGES = 5;
// 最大并发识别数（服务器已优化并发控制，可提高到 5）
const MAX_CONCURRENT = 5;

// 单张图片的识别状态
interface ImageRecognitionState {
  id: string;
  file: File;
  previewUrl: string;
  status: 'pending' | 'processing' | 'success' | 'error';
  result?: unknown;
  error?: string;
}

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
  settings,
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
  // 多图选择状态
  const [selectedImages, setSelectedImages] = useState<ImageRecognitionState[]>(
    []
  );
  // 多图识别是否正在进行
  const [isMultiRecognizing, setIsMultiRecognizing] = useState(false);

  // 返回主界面
  const goBackToMain = useCallback(() => {
    setCurrentStep('main');
    setJsonInputValue('');
    // 清理图片 URL
    if (recognizingImageUrl) {
      URL.revokeObjectURL(recognizingImageUrl);
      setRecognizingImageUrl(null);
    }
    // 清理多图选择
    selectedImages.forEach(img => URL.revokeObjectURL(img.previewUrl));
    setSelectedImages([]);
    setIsMultiRecognizing(false);
    setIsRecognizing(false);
  }, [recognizingImageUrl, selectedImages]);

  // 使用 modalHistory 管理 JSON 输入步骤的返回行为
  useModalHistory({
    id: 'bean-import-json-input',
    isOpen: showForm && currentStep === 'json-input',
    onClose: goBackToMain,
  });

  // 使用 modalHistory 管理多图预览步骤的返回行为
  useModalHistory({
    id: 'bean-import-multi-preview',
    isOpen: showForm && currentStep === 'multi-preview',
    onClose: goBackToMain,
  });

  // 重置状态（当弹窗关闭或重新打开时）
  useEffect(() => {
    if (showForm) {
      setClipboardStatus('idle');
      setCurrentStep('main');
      setJsonInputValue('');
      setIsRecognizing(false);
      setIsMultiRecognizing(false);
      if (recognizingImageUrl) {
        URL.revokeObjectURL(recognizingImageUrl);
        setRecognizingImageUrl(null);
      }
      // 清理多图选择
      selectedImages.forEach(img => URL.revokeObjectURL(img.previewUrl));
      setSelectedImages([]);
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

  // 识别单张图片的核心函数
  const recognizeSingleImage = useCallback(
    async (
      file: File,
      imageUrl: string
    ): Promise<{ data: unknown; file: File }> => {
      let beanData: unknown;

      if (USE_MOCK_API) {
        await new Promise(resolve =>
          setTimeout(resolve, MOCK_RECOGNITION_DELAY)
        );
        beanData = MOCK_BEAN_DATA;
      } else {
        const { smartCompress } = await import('@/lib/utils/imageCompression');
        const compressedFile = await smartCompress(file);
        const { recognizeBeanImage } = await import(
          '@/lib/api/beanRecognition'
        );
        beanData = await recognizeBeanImage(compressedFile);
      }

      return { data: beanData, file };
    },
    []
  );

  // 处理图片上传识别（支持单张和多张）
  const handleImageUpload = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = event.target.files;
      if (!files || files.length === 0) return;

      // 过滤有效图片文件
      const validFiles: File[] = [];
      for (let i = 0; i < Math.min(files.length, MAX_IMAGES); i++) {
        const file = files[i];
        if (!file.type.startsWith('image/')) {
          continue;
        }
        if (file.size > 10 * 1024 * 1024) {
          continue;
        }
        validFiles.push(file);
      }

      if (validFiles.length === 0) {
        showToast({ type: 'error', title: '请上传有效的图片文件' });
        return;
      }

      // 如果选择超过限制，提示
      if (files.length > MAX_IMAGES) {
        showToast({
          type: 'info',
          title: `最多选择 ${MAX_IMAGES} 张图片`,
        });
      }

      // 单张图片：使用原有的单图流程
      if (validFiles.length === 1) {
        const file = validFiles[0];
        const imageUrl = URL.createObjectURL(file);
        setRecognizingImageUrl(imageUrl);
        setCurrentStep('recognizing');
        setIsRecognizing(true);

        try {
          const { data: beanData } = await recognizeSingleImage(file, imageUrl);

          // 识别成功后，检查是否为单个豆子，如果是则传递识别图片（无论设置如何，都传递给表单，由表单决定是否自动填充）
          const isSingleBean =
            !Array.isArray(beanData) ||
            (Array.isArray(beanData) && beanData.length === 1);

          if (isSingleBean && onRecognitionImage) {
            await new Promise<void>(resolve => {
              const reader = new FileReader();
              reader.onload = async () => {
                const base64 = reader.result as string;
                if (base64) {
                  try {
                    const { compressBase64Image } = await import(
                      '@/lib/utils/imageCapture'
                    );
                    const compressedBase64 = await compressBase64Image(base64, {
                      maxSizeMB: 0.1,
                      maxWidthOrHeight: 1200,
                      initialQuality: 0.8,
                    });
                    onRecognitionImage(compressedBase64);
                  } catch (error) {
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
      } else {
        // 多张图片：进入预览模式
        const imageStates: ImageRecognitionState[] = validFiles.map(file => ({
          id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          file,
          previewUrl: URL.createObjectURL(file),
          status: 'pending' as const,
        }));
        setSelectedImages(imageStates);
        setCurrentStep('multi-preview');
      }

      // 清除文件输入，以便可以再次选择同一文件
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    },
    [handleImportData, onRecognitionImage, recognizeSingleImage]
  );

  // 删除预览中的图片
  const handleRemoveImage = useCallback((id: string) => {
    setSelectedImages(prev => {
      const toRemove = prev.find(img => img.id === id);
      if (toRemove) {
        URL.revokeObjectURL(toRemove.previewUrl);
      }
      const remaining = prev.filter(img => img.id !== id);
      // 如果删到只剩一张或没有了，返回主界面
      if (remaining.length === 0) {
        setCurrentStep('main');
      }
      return remaining;
    });
  }, []);

  // 压缩图片为 base64
  const compressImageToBase64 = useCallback(
    async (file: File): Promise<string | null> => {
      return new Promise(resolve => {
        const reader = new FileReader();
        reader.onload = async () => {
          const base64 = reader.result as string;
          if (base64) {
            try {
              const { compressBase64Image } = await import(
                '@/lib/utils/imageCapture'
              );
              const compressedBase64 = await compressBase64Image(base64, {
                maxSizeMB: 0.1,
                maxWidthOrHeight: 1200,
                initialQuality: 0.8,
              });
              resolve(compressedBase64);
            } catch (error) {
              if (process.env.NODE_ENV === 'development') {
                console.error('图片压缩失败:', error);
              }
              resolve(base64);
            }
          } else {
            resolve(null);
          }
        };
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(file);
      });
    },
    []
  );

  // 并行识别多张图片（带限流）
  const handleMultiRecognition = useCallback(async () => {
    if (selectedImages.length === 0) return;

    setIsMultiRecognizing(true);

    // 创建一个 Promise 队列来控制并发
    const results: Array<{
      id: string;
      data: unknown;
      imageBase64: string | null;
      success: boolean;
    }> = [];
    const queue = [...selectedImages];
    const processing: Promise<void>[] = [];

    const processImage = async (img: ImageRecognitionState) => {
      // 更新状态为处理中
      setSelectedImages(prev =>
        prev.map(i => (i.id === img.id ? { ...i, status: 'processing' } : i))
      );

      try {
        // 并行执行识别和图片压缩
        const [{ data }, imageBase64] = await Promise.all([
          recognizeSingleImage(img.file, img.previewUrl),
          compressImageToBase64(img.file),
        ]);
        // 更新状态为成功
        setSelectedImages(prev =>
          prev.map(i =>
            i.id === img.id ? { ...i, status: 'success', result: data } : i
          )
        );
        results.push({ id: img.id, data, imageBase64, success: true });
      } catch (error) {
        // 更新状态为失败
        setSelectedImages(prev =>
          prev.map(i =>
            i.id === img.id
              ? {
                  ...i,
                  status: 'error',
                  error: error instanceof Error ? error.message : '识别失败',
                }
              : i
          )
        );
        results.push({
          id: img.id,
          data: null,
          imageBase64: null,
          success: false,
        });
      }
    };

    // 使用限流并发
    while (queue.length > 0 || processing.length > 0) {
      // 填充到最大并发数
      while (processing.length < MAX_CONCURRENT && queue.length > 0) {
        const img = queue.shift()!;
        const promise = processImage(img).then(() => {
          // 移除已完成的 promise
          const index = processing.indexOf(promise);
          if (index > -1) processing.splice(index, 1);
        });
        processing.push(promise);
      }

      // 等待任意一个完成
      if (processing.length > 0) {
        await Promise.race(processing);
      }
    }

    setIsMultiRecognizing(false);

    // 统计结果
    const successResults = results.filter(r => r.success);
    const failedCount = results.filter(r => !r.success).length;

    if (successResults.length === 0) {
      showToast({ type: 'error', title: '所有图片识别失败' });
      return;
    }

    // 合并所有识别结果，并将图片添加到每个豆子数据中
    const allBeanData: unknown[] = [];
    for (const r of successResults) {
      const addImageToBean = (bean: unknown) => {
        if (bean && typeof bean === 'object' && r.imageBase64) {
          return { ...bean, image: r.imageBase64 };
        }
        return bean;
      };

      if (Array.isArray(r.data)) {
        // 如果一张图识别出多个豆子，只给第一个豆子添加图片
        r.data.forEach((bean, index) => {
          allBeanData.push(index === 0 ? addImageToBean(bean) : bean);
        });
      } else if (r.data) {
        allBeanData.push(addImageToBean(r.data));
      }
    }

    if (allBeanData.length === 0) {
      showToast({ type: 'error', title: '未能识别到咖啡豆信息' });
      return;
    }

    // 清理
    selectedImages.forEach(img => URL.revokeObjectURL(img.previewUrl));
    setSelectedImages([]);
    setCurrentStep('main');

    // 导入数据
    await handleImportData(allBeanData);

    // 提示结果
    if (failedCount > 0) {
      showToast({
        type: 'info',
        title: `成功识别 ${successResults.length} 张，${failedCount} 张失败`,
      });
    }
  }, [
    selectedImages,
    recognizeSingleImage,
    handleImportData,
    compressImageToBase64,
  ]);

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

  // 多图预览界面内容
  const multiPreviewContent = (
    <>
      {/* 图片网格预览 */}
      <div className="mb-6">
        <div className="grid grid-cols-3 gap-3">
          {selectedImages.map(img => (
            <div
              key={img.id}
              className="relative aspect-square overflow-hidden rounded-2xl bg-neutral-100 dark:bg-neutral-800"
            >
              <img
                src={img.previewUrl}
                alt="预览"
                className={`h-full w-full object-cover transition-all duration-300 ${
                  img.status === 'processing'
                    ? 'scale-[1.02] brightness-90'
                    : ''
                } ${img.status === 'success' ? 'brightness-100' : ''} ${
                  img.status === 'error' ? 'brightness-50 grayscale' : ''
                }`}
              />

              {/* 处理中 - 简洁的边框动画 */}
              {img.status === 'processing' && (
                <div className="absolute inset-0 rounded-2xl ring-2 ring-neutral-400 ring-offset-1 ring-offset-transparent dark:ring-neutral-500" />
              )}

              {/* 成功状态 - 右下角小勾 */}
              {img.status === 'success' && (
                <div className="absolute right-1.5 bottom-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-neutral-900/80 dark:bg-white/90">
                  <svg
                    className="h-3 w-3 text-white dark:text-neutral-900"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={3}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </div>
              )}

              {/* 失败状态 - 右下角小叉 */}
              {img.status === 'error' && (
                <div className="absolute right-1.5 bottom-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-neutral-500/80">
                  <svg
                    className="h-3 w-3 text-white"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={3}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </div>
              )}

              {/* 删除按钮 - 仅待处理时显示 */}
              {!isMultiRecognizing && img.status === 'pending' && (
                <button
                  onClick={() => handleRemoveImage(img.id)}
                  className="absolute top-1.5 right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-neutral-900/60 text-white backdrop-blur-sm transition-all hover:bg-neutral-900/80 dark:bg-white/60 dark:text-neutral-900 dark:hover:bg-white/80"
                >
                  <svg
                    className="h-3 w-3"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 内容区域 */}
      <ActionDrawer.Content>
        {isMultiRecognizing ? (
          <p className="text-neutral-500 dark:text-neutral-400">
            正在识别
            <span className="text-neutral-800 dark:text-neutral-200">
              {' '}
              {selectedImages.filter(i => i.status === 'success').length}/
              {selectedImages.length}{' '}
            </span>
            张图片...
          </p>
        ) : (
          <p className="text-neutral-500 dark:text-neutral-400">
            已选择
            <span className="text-neutral-800 dark:text-neutral-200">
              {' '}
              {selectedImages.length}{' '}
            </span>
            张，批量导入不进入编辑
          </p>
        )}
      </ActionDrawer.Content>

      {/* 操作按钮 */}
      <div className="flex gap-2">
        <motion.button
          whileTap={isMultiRecognizing ? undefined : { scale: 0.98 }}
          onClick={goBackToMain}
          disabled={isMultiRecognizing}
          className={`flex-1 rounded-full px-4 py-3 text-sm font-medium transition-colors ${
            isMultiRecognizing
              ? 'bg-neutral-100 text-neutral-400 dark:bg-neutral-800 dark:text-neutral-500'
              : 'bg-neutral-100 text-neutral-800 dark:bg-neutral-800 dark:text-white'
          }`}
        >
          取消
        </motion.button>
        <motion.button
          whileTap={isMultiRecognizing ? undefined : { scale: 0.98 }}
          onClick={handleMultiRecognition}
          disabled={isMultiRecognizing}
          className={`flex-1 rounded-full px-4 py-3 text-sm font-medium transition-colors ${
            isMultiRecognizing
              ? 'bg-neutral-200 text-neutral-500 dark:bg-neutral-700 dark:text-neutral-400'
              : 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900'
          }`}
        >
          {isMultiRecognizing ? '识别中...' : '开始识别'}
        </motion.button>
      </div>
    </>
  );

  // 根据步骤渲染内容
  const renderContent = () => {
    switch (currentStep) {
      case 'recognizing':
        return recognizingContent;
      case 'json-input':
        return jsonInputContent;
      case 'multi-preview':
        return multiPreviewContent;
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

      {/* 隐藏的文件输入 - 支持多选 */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleImageUpload}
      />
    </>
  );
};

export default BeanImportModal;
