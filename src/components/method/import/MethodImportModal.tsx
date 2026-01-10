'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import ActionDrawer from '@/components/common/ui/ActionDrawer';
import { showToast } from '@/components/common/feedback/LightToast';
import { useCopy } from '@/lib/hooks/useCopy';
import CopyFailureDrawer from '@/components/common/feedback/CopyFailureDrawer';
import AddCircleIcon from '@public/images/icons/ui/add-circle.svg';
import AddBoxIcon from '@public/images/icons/ui/add-box.svg';
import { type Method, type CustomEquipment } from '@/lib/core/config';

// 模拟 API 开关 - 设置为 true 时使用模拟数据
const USE_MOCK_API = false;

// 模拟识别延迟时间（毫秒）
const MOCK_RECOGNITION_DELAY = 100;

// 模拟返回的方案数据
const MOCK_METHOD_DATA = {
  name: '四六法',
  params: {
    coffee: '20g',
    water: '300g',
    ratio: '1:15',
    grindSize: '中细',
    temp: '92°C',
    stages: [
      {
        pourType: 'center',
        label: '焖蒸',
        water: '50',
        duration: 45,
        detail: '小水流注水',
      },
      {
        pourType: 'circle',
        label: '第一段',
        water: '70',
        duration: 10,
        detail: '绕圈注水',
      },
      { pourType: 'wait', label: '等待', duration: 35 },
      {
        pourType: 'circle',
        label: '第二段',
        water: '60',
        duration: 10,
        detail: '绕圈注水',
      },
      { pourType: 'wait', label: '等待', duration: 35 },
      {
        pourType: 'circle',
        label: '第三段',
        water: '60',
        duration: 10,
        detail: '绕圈注水',
      },
      { pourType: 'wait', label: '等待', duration: 35 },
      {
        pourType: 'circle',
        label: '第四段',
        water: '60',
        duration: 10,
        detail: '绕圈注水',
      },
    ],
  },
};

interface MethodImportModalProps {
  showForm: boolean;
  onImport: (method: Method) => void;
  onClose: () => void;
  existingMethods?: Method[];
  customEquipment?: CustomEquipment;
}

// 冲煮方案识别提示词
const METHOD_RECOGNITION_PROMPT = `你是OCR工具，提取图片中的咖啡冲煮方案，直接返回JSON。

关键规则：
1. 每个注水动作是独立步骤，duration=注水时长（秒）
2. 焖蒸/等待必须拆成两步：注水步骤 + wait步骤
   例：焖蒸30秒注水50g(10秒注完) → 注水10秒50g + 等待20秒
3. wait步骤只有label和duration字段，无water和detail

JSON格式：
{
  "name":"方案名",
  "params":{
    "coffee":"咖啡粉量如15g",
    "water":"总水量如225g",
    "ratio":"粉水比如1:15",
    "grindSize":"研磨度如中细",
    "temp":"水温如92°C",
    "stages":[
      {"pourType":"center|circle|ice|bypass|wait|other","label":"步骤名","water":"注水量(纯数字)","duration":秒数,"detail":"说明"}
    ]
  }
}

规则：数值不带单位/不编造/不确定不填/直接返回JSON`;

// 步骤类型定义
type ImportStep = 'main' | 'json-input' | 'recognizing';

// 扫描线动画组件
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

const MethodImportModal: React.FC<MethodImportModalProps> = ({
  showForm,
  onImport,
  onClose,
  existingMethods = [],
  customEquipment,
}) => {
  // 统一的复制功能
  const { copyText, failureDrawerProps } = useCopy({
    successMessage: '提示词已复制',
  });

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

  // 关闭抽屉
  const handleClose = useCallback(() => {
    // 清理图片 URL 资源
    if (recognizingImageUrl) {
      URL.revokeObjectURL(recognizingImageUrl);
      setRecognizingImageUrl(null);
    }
    onClose();
  }, [onClose, recognizingImageUrl]);

  // 处理添加数据（通用）
  const handleImportData = useCallback(
    async (data: unknown) => {
      try {
        const methodData = data as Record<string, unknown>;

        // 验证数据 - 检查是否有名称和参数
        if (!methodData.name) {
          // 尝试从 method 字段获取名称
          if (typeof methodData.method === 'string') {
            methodData.name = methodData.method;
          } else {
            showToast({ type: 'error', title: '方案缺少名称' });
            return;
          }
        }

        if (!methodData.params) {
          showToast({ type: 'error', title: '方案缺少参数' });
          return;
        }

        const params = methodData.params as Record<string, unknown>;
        if (!params.stages || !Array.isArray(params.stages)) {
          showToast({ type: 'error', title: '方案缺少冲煮步骤' });
          return;
        }

        // 检查是否已存在同名方案
        const existingMethod = existingMethods.find(
          m => m.name === methodData.name
        );
        if (existingMethod) {
          showToast({
            type: 'error',
            title: `已存在同名方案"${methodData.name}"`,
          });
          return;
        }

        // 构建有效的方案对象
        const validMethod: Method = {
          id:
            (methodData.id as string) ||
            `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          name: methodData.name as string,
          params: {
            coffee: (params.coffee as string) || '15g',
            water: (params.water as string) || '225g',
            ratio: (params.ratio as string) || '1:15',
            grindSize: (params.grindSize as string) || '中细',
            temp: (params.temp as string) || '92°C',
            stages: params.stages as Method['params']['stages'],
          },
        };

        onImport(validMethod);
        onClose();
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : '未知错误';
        showToast({ type: 'error', title: `添加失败: ${errorMessage}` });
      }
    },
    [existingMethods, onImport, onClose]
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
      const methodData = extractJsonFromText(clipboardText, customEquipment);

      if (methodData && 'params' in methodData && 'name' in methodData) {
        await handleImportData(methodData);
      } else {
        setClipboardStatus('error');
      }
    } catch (_error) {
      setClipboardStatus('error');
    }
  }, [handleImportData, clipboardStatus, handleInputJSON, customEquipment]);

  // 识别单张图片的核心函数
  const recognizeSingleImage = useCallback(
    async (file: File, _imageUrl: string): Promise<{ data: unknown }> => {
      let methodData: unknown;

      if (USE_MOCK_API) {
        await new Promise(resolve =>
          setTimeout(resolve, MOCK_RECOGNITION_DELAY)
        );
        methodData = MOCK_METHOD_DATA;
      } else {
        const { smartCompress } = await import('@/lib/utils/imageCompression');
        const compressedFile = await smartCompress(file);
        const { recognizeMethodImage } = await import(
          '@/lib/api/methodRecognition'
        );
        methodData = await recognizeMethodImage(compressedFile);
      }

      return { data: methodData };
    },
    []
  );

  // 处理图片上传识别
  const handleImageUpload = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = event.target.files;
      if (!files || files.length === 0) return;

      const file = files[0];
      if (!file.type.startsWith('image/')) {
        showToast({ type: 'error', title: '请上传有效的图片文件' });
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        showToast({ type: 'error', title: '图片大小不能超过10MB' });
        return;
      }

      const imageUrl = URL.createObjectURL(file);
      setRecognizingImageUrl(imageUrl);
      setCurrentStep('recognizing');
      setIsRecognizing(true);

      try {
        const { data: methodData } = await recognizeSingleImage(file, imageUrl);
        // 成功后 handleImportData 会调用 handleClose 处理状态重置和资源清理
        await handleImportData(methodData);
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
    [handleImportData, recognizeSingleImage]
  );

  // 触发图片选择
  const handleUploadImageClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  // 复制提示词 - 使用统一的 useCopy hook
  const handleCopyPrompt = useCallback(async () => {
    await copyText(METHOD_RECOGNITION_PROMPT);
  }, [copyText]);

  // 提交 JSON 输入
  const handleSubmitJson = useCallback(async () => {
    if (!jsonInputValue.trim()) {
      showToast({ type: 'error', title: '请输入方案数据' });
      return;
    }

    try {
      const { extractJsonFromText } = await import('@/lib/utils/jsonUtils');
      const methodData = extractJsonFromText(jsonInputValue, customEquipment);

      if (methodData && 'params' in methodData && 'name' in methodData) {
        await handleImportData(methodData);
      } else {
        showToast({ type: 'error', title: '无法解析输入的数据' });
      }
    } catch (_error) {
      showToast({ type: 'error', title: '数据格式错误' });
    }
  }, [jsonInputValue, handleImportData, customEquipment]);

  // 取消输入 - 返回主界面
  const handleCancelJsonInput = useCallback(() => {
    goBackToMain();
  }, [goBackToMain]);

  // 操作项配置
  const actions = [
    {
      id: 'image',
      label: '图片识别冲煮方案（推荐）',
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
          添加冲煮方案，也可将图片和
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
          的冲煮方案 JSON 数据。
        </p>
      </ActionDrawer.Content>

      {/* JSON 输入区域 */}
      <div className="flex flex-col gap-2">
        <textarea
          ref={jsonTextareaRef}
          value={jsonInputValue}
          onChange={e => setJsonInputValue(e.target.value)}
          placeholder='{"name": "方案名称", "params": {...}}'
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
            识别冲煮方案
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
      <ActionDrawer isOpen={showForm} onClose={handleClose} disableHistory>
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

      {/* 复制失败抽屉 */}
      <CopyFailureDrawer {...failureDrawerProps} />
    </>
  );
};

export default MethodImportModal;
