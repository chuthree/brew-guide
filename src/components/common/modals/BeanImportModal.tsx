'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import ActionDrawer from '@/components/common/ui/ActionDrawer';
import { showToast } from '@/components/common/feedback/LightToast';
import { useModalHistory } from '@/lib/hooks/useModalHistory';
import AddCircleIcon from '@public/images/icons/ui/add-circle.svg';
import AddBoxIcon from '@public/images/icons/ui/add-box.svg';

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
type ImportStep = 'main' | 'json-input';

const BeanImportModal: React.FC<BeanImportModalProps> = ({
  showForm,
  onImport,
  onClose,
}) => {
  // 当前步骤
  const [currentStep, setCurrentStep] = useState<ImportStep>('main');
  // 图片识别加载状态
  const [isRecognizing, setIsRecognizing] = useState(false);
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
  }, []);

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
    }
  }, [showForm]);

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

      setIsRecognizing(true);

      try {
        // 压缩图片
        const { smartCompress } = await import('@/lib/utils/imageCompression');
        const compressedFile = await smartCompress(file);

        // 识别图片
        const { recognizeBeanImage } = await import(
          '@/lib/api/beanRecognition'
        );

        const beanData = await recognizeBeanImage(compressedFile);
        setIsRecognizing(false);
        await handleImportData(beanData);
      } catch (error) {
        console.error('图片识别失败:', error);
        showToast({
          type: 'error',
          title: error instanceof Error ? error.message : '图片识别失败',
        });
        setIsRecognizing(false);
      }

      // 清除文件输入，以便可以再次选择同一文件
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    },
    [handleImportData]
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
    onClose();
  }, [onClose]);

  // 操作项配置
  const actions = [
    {
      id: 'image',
      label: isRecognizing ? '识别中...' : '图片识别咖啡豆（推荐）',
      onClick: handleUploadImageClick,
      disabled: isRecognizing,
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
            disabled={action.disabled}
            className="w-full rounded-full bg-neutral-100 px-4 py-3 text-left text-sm font-medium text-neutral-800 disabled:opacity-50 dark:bg-neutral-800 dark:text-white"
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

  return (
    <>
      <ActionDrawer
        isOpen={showForm}
        onClose={handleClose}
        historyId="bean-import"
      >
        <ActionDrawer.Switcher activeKey={currentStep}>
          {currentStep === 'main' ? mainContent : jsonInputContent}
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
