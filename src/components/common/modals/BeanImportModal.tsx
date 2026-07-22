'use client';

import React, {
  useState,
  useCallback,
  useRef,
  useEffect,
  useMemo,
} from 'react';
import { motion } from 'framer-motion';
import { Flashlight, FlashlightOff } from 'lucide-react';
import ActionDrawer from '@/components/common/ui/ActionDrawer';
import { showToast } from '@/components/common/feedback/LightToast';
import { useCopy } from '@/lib/hooks/useCopy';
import CopyFailureDrawer from '@/components/common/feedback/CopyFailureDrawer';
import { useModalHistory } from '@/lib/hooks/useModalHistory';
import AddCircleIcon from '@public/images/icons/ui/add-circle.svg';
import AddBoxIcon from '@public/images/icons/ui/add-box.svg';
import { SettingsOptions } from '@/components/settings/Settings';
import {
  buildBeanRecognitionPrompt,
  DEFAULT_BEAN_RECOGNITION_PROMPT,
  type CustomBeanRecognitionConfig,
} from '@/lib/api/beanRecognition';
import { normalizeCoffeeBeanPayloadForFieldConfig } from '@/lib/coffee-beans/beanFields';
import { isSupportedSourceImageFile } from '@/lib/images/imageFormat';
import {
  isImageSelectionCancelled,
  pickNativeGalleryImageFiles,
  shouldUseNativeGalleryPicker,
} from '@/lib/utils/imageCapture';

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
  onImport: (
    jsonData: string,
    options?: { recognitionImage?: string }
  ) => Promise<void>;
  onClose: () => void;
  /** 设置项，用于控制是否自动填充识图图片 */
  settings?: SettingsOptions;
}

interface ImportedBean {
  capacity?: number | string;
  remaining?: number | string;
  price?: number | string | null;
  [key: string]: unknown;
}

// 步骤类型定义
type ImportStep =
  | 'main'
  | 'json-input'
  | 'camera-preview'
  | 'recognizing'
  | 'multi-preview';

// 最大同时选择图片数
const MAX_IMAGES = 5;
// 最大并发识别数（服务器已优化并发控制，可提高到 5）
const MAX_CONCURRENT = 5;
const IMAGE_FILE_ACCEPT =
  'image/jpeg,image/png,image/webp,image/heic,image/heif';
const BEAN_PACKAGE_FILE_ACCEPT =
  '.brewbeans.zip,.zip,application/zip,application/x-zip-compressed';

// 单张图片的识别状态
interface ImageRecognitionState {
  id: string;
  file: File;
  previewUrl: string;
  status: 'pending' | 'processing' | 'success' | 'error';
  result?: unknown;
  error?: string;
}

type CameraStatus = 'idle' | 'starting' | 'ready' | 'error';
type TorchMediaTrackCapabilities = MediaTrackCapabilities & {
  torch?: boolean;
};
type TorchMediaTrackConstraintSet = MediaTrackConstraintSet & {
  torch?: boolean;
};
type ZoomMediaTrackCapabilities = TorchMediaTrackCapabilities & {
  zoom?: {
    min?: number;
    max?: number;
    step?: number;
  };
};
type ZoomMediaTrackConstraintSet = TorchMediaTrackConstraintSet & {
  zoom?: number;
};
type CameraZoomRange = {
  min: number;
  max: number;
  step: number;
};

const CAMERA_PHOTO_TYPE = 'image/jpeg';
const CAMERA_BASE_ZOOM = 1;
const DEFAULT_CAMERA_ZOOM_RANGE: CameraZoomRange = {
  min: CAMERA_BASE_ZOOM,
  max: 3,
  step: 0.05,
};

function clampZoom(value: number, range: CameraZoomRange) {
  return Math.min(range.max, Math.max(range.min, value));
}

function getPointerDistance(
  first: { x: number; y: number },
  second: { x: number; y: number }
) {
  return Math.hypot(first.x - second.x, first.y - second.y);
}

function createCameraPhotoFile(canvas: HTMLCanvasElement): Promise<File> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      blob => {
        if (!blob) {
          reject(new Error('拍照失败，请重试'));
          return;
        }

        resolve(
          new File([blob], `bean-camera-${Date.now()}.jpg`, {
            type: CAMERA_PHOTO_TYPE,
            lastModified: Date.now(),
          })
        );
      },
      CAMERA_PHOTO_TYPE,
      0.92
    );
  });
}

function getCameraErrorMessage(error: unknown) {
  if (error instanceof DOMException) {
    switch (error.name) {
      case 'NotAllowedError':
      case 'PermissionDeniedError':
        return '没有获得摄像头权限';
      case 'NotFoundError':
      case 'DevicesNotFoundError':
        return '没有找到可用摄像头';
      case 'NotReadableError':
      case 'TrackStartError':
        return '摄像头正在被其他应用占用';
      case 'OverconstrainedError':
      case 'ConstraintNotSatisfiedError':
        return '当前摄像头不支持预览参数';
      case 'SecurityError':
        return '当前环境无法使用应用内相机';
      default:
        return '无法打开摄像头';
    }
  }

  return error instanceof Error ? error.message : '无法打开摄像头';
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
  settings,
}) => {
  // 统一的复制功能
  const { copyText, failureDrawerProps } = useCopy({
    successMessage: '提示词已复制',
  });

  // 当前步骤
  const [currentStep, setCurrentStep] = useState<ImportStep>('main');
  // 图片识别加载状态
  const [, setIsRecognizing] = useState(false);
  // 识别中的图片 URL
  const [recognizingImageUrl, setRecognizingImageUrl] = useState<string | null>(
    null
  );
  // JSON 输入内容
  const [jsonInputValue, setJsonInputValue] = useState('');
  // 图片输入 ref
  const fileInputRef = useRef<HTMLInputElement>(null);
  // 摄像头预览 ref
  const videoRef = useRef<HTMLVideoElement>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const activeCameraPointersRef = useRef(
    new Map<number, { x: number; y: number }>()
  );
  const pinchStartRef = useRef<{
    distance: number;
    zoom: number;
  } | null>(null);
  // JSON 输入框 ref
  const jsonTextareaRef = useRef<HTMLTextAreaElement>(null);
  // 多图选择状态
  const [selectedImages, setSelectedImages] = useState<ImageRecognitionState[]>(
    []
  );
  // 多图识别是否正在进行
  const [isMultiRecognizing, setIsMultiRecognizing] = useState(false);
  // 应用内相机状态
  const [cameraStatus, setCameraStatus] = useState<CameraStatus>('idle');
  const [cameraError, setCameraError] = useState('');
  const [isCameraCapturing, setIsCameraCapturing] = useState(false);
  const [isTorchSupported, setIsTorchSupported] = useState(false);
  const [isTorchOn, setIsTorchOn] = useState(false);
  const [isHardwareZoomSupported, setIsHardwareZoomSupported] = useState(false);
  const [cameraZoomRange, setCameraZoomRange] = useState<CameraZoomRange>(
    DEFAULT_CAMERA_ZOOM_RANGE
  );
  const [cameraZoom, setCameraZoom] = useState(1);
  const [showZoomIndicator, setShowZoomIndicator] = useState(false);

  const baseRecognitionPrompt = (
    settings?.experimentalBeanRecognitionPrompt || ''
  ).trim()
    ? (settings?.experimentalBeanRecognitionPrompt as string).trim()
    : DEFAULT_BEAN_RECOGNITION_PROMPT;
  const fieldSettings = useMemo(
    () => ({
      beanFieldConfig: settings?.beanFieldConfig,
      showEstateField: settings?.showEstateField,
    }),
    [settings?.beanFieldConfig, settings?.showEstateField]
  );
  const effectiveRecognitionPrompt = useMemo(
    () => buildBeanRecognitionPrompt(baseRecognitionPrompt, fieldSettings),
    [baseRecognitionPrompt, fieldSettings]
  );

  const customRecognitionConfig: CustomBeanRecognitionConfig | undefined =
    useMemo(
      () =>
        settings?.experimentalBeanRecognitionEnabled
          ? {
              enabled: true,
              apiBaseUrl: settings.experimentalBeanRecognitionApiBaseUrl || '',
              apiKey: settings.experimentalBeanRecognitionApiKey || '',
              model: settings.experimentalBeanRecognitionModel || '',
              prompt: baseRecognitionPrompt,
            }
          : undefined,
      [
        baseRecognitionPrompt,
        settings?.experimentalBeanRecognitionApiBaseUrl,
        settings?.experimentalBeanRecognitionApiKey,
        settings?.experimentalBeanRecognitionEnabled,
        settings?.experimentalBeanRecognitionModel,
      ]
    );
  const fileInputAccept = settings?.experimentalBeanSharePackageEnabled
    ? `${IMAGE_FILE_ACCEPT},${BEAN_PACKAGE_FILE_ACCEPT}`
    : IMAGE_FILE_ACCEPT;
  const isDrawerDismissible =
    currentStep !== 'camera-preview' && currentStep !== 'recognizing';

  const stopCamera = useCallback(() => {
    activeCameraPointersRef.current.clear();
    pinchStartRef.current = null;
    cameraStreamRef.current?.getTracks().forEach(track => track.stop());
    cameraStreamRef.current = null;

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setCameraStatus('idle');
    setCameraError('');
    setIsCameraCapturing(false);
    setIsTorchSupported(false);
    setIsTorchOn(false);
    setIsHardwareZoomSupported(false);
    setCameraZoomRange(DEFAULT_CAMERA_ZOOM_RANGE);
    setCameraZoom(1);
    setShowZoomIndicator(false);
  }, []);

  // 返回主界面
  const goBackToMain = useCallback(() => {
    stopCamera();
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
  }, [recognizingImageUrl, selectedImages, stopCamera]);

  // 使用 modalHistory 管理 JSON 输入步骤的返回行为
  useModalHistory({
    id: 'bean-import-json-input',
    isOpen: showForm && currentStep === 'json-input',
    onClose: goBackToMain,
  });

  // 使用 modalHistory 管理相机预览步骤的返回行为
  useModalHistory({
    id: 'bean-import-camera-preview',
    isOpen: showForm && currentStep === 'camera-preview',
    onClose: goBackToMain,
  });

  // 使用 modalHistory 管理多图预览步骤的返回行为
  useModalHistory({
    id: 'bean-import-multi-preview',
    isOpen: showForm && currentStep === 'multi-preview',
    onClose: goBackToMain,
  });

  const resetImportState = useCallback(() => {
    stopCamera();
    setCurrentStep('main');
    setJsonInputValue('');
    setIsRecognizing(false);
    setIsMultiRecognizing(false);
    if (recognizingImageUrl) {
      URL.revokeObjectURL(recognizingImageUrl);
      setRecognizingImageUrl(null);
    }
    selectedImages.forEach(img => URL.revokeObjectURL(img.previewUrl));
    setSelectedImages([]);
  }, [recognizingImageUrl, selectedImages, stopCamera]);

  useEffect(() => {
    if (!showForm || currentStep !== 'camera-preview') {
      stopCamera();
      return;
    }

    let cancelled = false;
    let requestedStream: MediaStream | null = null;

    const startCamera = async () => {
      setCameraStatus('starting');
      setCameraError('');

      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
        setCameraStatus('error');
        setCameraError('当前环境无法使用应用内相机');
        return;
      }

      try {
        requestedStream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: false,
        });

        if (cancelled) {
          requestedStream.getTracks().forEach(track => track.stop());
          return;
        }

        cameraStreamRef.current = requestedStream;
        const [videoTrack] = requestedStream.getVideoTracks();
        const capabilities =
          videoTrack?.getCapabilities?.() as ZoomMediaTrackCapabilities;
        setIsTorchSupported(Boolean(capabilities?.torch));
        setIsTorchOn(false);
        const zoomCapability = capabilities?.zoom;
        const hardwareZoomMin =
          typeof zoomCapability?.min === 'number'
            ? zoomCapability.min
            : CAMERA_BASE_ZOOM;
        const hardwareZoomMax =
          typeof zoomCapability?.max === 'number'
            ? zoomCapability.max
            : undefined;
        const hasHardwareZoom =
          typeof hardwareZoomMax === 'number' && hardwareZoomMax > 1;
        const nextZoomRange = hasHardwareZoom
          ? {
              min: Math.max(CAMERA_BASE_ZOOM, hardwareZoomMin),
              max: Math.min(hardwareZoomMax, 5),
              step:
                typeof zoomCapability?.step === 'number'
                  ? zoomCapability.step
                  : 0.05,
            }
          : DEFAULT_CAMERA_ZOOM_RANGE;
        const initialZoom = clampZoom(CAMERA_BASE_ZOOM, nextZoomRange);
        setIsHardwareZoomSupported(hasHardwareZoom);
        setCameraZoomRange(nextZoomRange);
        setCameraZoom(initialZoom);
        setShowZoomIndicator(false);

        const video = videoRef.current;
        if (!video) {
          throw new Error('相机预览初始化失败');
        }

        video.srcObject = requestedStream;
        await video.play();
        if (hasHardwareZoom) {
          void videoTrack
            ?.applyConstraints({
              advanced: [{ zoom: initialZoom } as ZoomMediaTrackConstraintSet],
            })
            .catch(() => {
              setIsHardwareZoomSupported(false);
            });
        }

        if (!cancelled) {
          setCameraStatus('ready');
        }
      } catch (error) {
        requestedStream?.getTracks().forEach(track => track.stop());

        if (cancelled) return;

        cameraStreamRef.current = null;
        setCameraStatus('error');
        setCameraError(getCameraErrorMessage(error));
      }
    };

    void startCamera();

    return () => {
      cancelled = true;
      stopCamera();
    };
  }, [showForm, currentStep, stopCamera]);

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
    async (data: unknown, options?: { recognitionImage?: string }) => {
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
        const normalizedData = normalizeCoffeeBeanPayloadForFieldConfig(
          dataArray,
          fieldSettings
        ) as ImportedBean[];

        const processedBeans = normalizedData.map(bean => ({
          ...ensureStringFields(bean),
          timestamp: Date.now(),
        }));

        await onImport(JSON.stringify(processedBeans), options);
        onClose();
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : '未知错误';
        showToast({ type: 'error', title: `添加失败: ${errorMessage}` });
      }
    },
    [ensureStringFields, fieldSettings, onImport, onClose]
  );

  // 进入 JSON 输入步骤
  const openJsonInput = useCallback((initialValue = '') => {
    setJsonInputValue(initialValue);
    setCurrentStep('json-input');
    // 等待动画完成后聚焦输入框
    setTimeout(() => {
      jsonTextareaRef.current?.focus();
    }, 300);
  }, []);

  // 处理输入入口：先尝试读取一次剪切板，无法识别再进入手动输入。
  const handleInputJSON = useCallback(async () => {
    try {
      const clipboardText = await navigator.clipboard.readText();
      if (!clipboardText.trim()) {
        openJsonInput();
        return;
      }

      const { extractJsonFromText } = await import('@/lib/utils/jsonUtils');
      const beanData = extractJsonFromText(clipboardText);

      if (beanData) {
        await handleImportData(beanData);
      } else {
        openJsonInput();
      }
    } catch (_error) {
      openJsonInput();
    }
  }, [handleImportData, openJsonInput]);

  // 识别单张图片的核心函数
  const recognizeSingleImage = useCallback(
    async (file: File): Promise<{ data: unknown; file: File }> => {
      let beanData: unknown;

      if (USE_MOCK_API) {
        await new Promise(resolve =>
          setTimeout(resolve, MOCK_RECOGNITION_DELAY)
        );
        beanData = MOCK_BEAN_DATA;
      } else {
        const [{ smartCompress }, { recognizeBeanImage }] = await Promise.all([
          import('@/lib/utils/imageCompression'),
          import('@/lib/api/beanRecognition'),
        ]);
        const compressedFile = await smartCompress(file);
        beanData = await recognizeBeanImage(
          compressedFile,
          undefined,
          customRecognitionConfig,
          fieldSettings
        );
      }

      return { data: beanData, file };
    },
    [customRecognitionConfig, fieldSettings]
  );

  const handleRecognizeImageFile = useCallback(
    async (file: File) => {
      const imageUrl = URL.createObjectURL(file);
      setRecognizingImageUrl(imageUrl);
      setCurrentStep('recognizing');
      setIsRecognizing(true);

      try {
        const { data: beanData } = await recognizeSingleImage(file);

        // 识别成功后，检查是否为单个豆子，如果是则传递识别图片（无论设置如何，都传递给表单，由表单决定是否自动填充）
        const isSingleBean =
          !Array.isArray(beanData) ||
          (Array.isArray(beanData) && beanData.length === 1);

        let recognitionImage: string | undefined;

        if (isSingleBean) {
          await new Promise<void>(resolve => {
            const reader = new FileReader();
            reader.onload = async () => {
              const base64 = reader.result as string;
              if (base64) {
                try {
                  const { compressBase64Image } =
                    await import('@/lib/utils/imageCapture');
                  const compressedBase64 = await compressBase64Image(base64, {
                    maxSizeMB: 0.1,
                    maxWidthOrHeight: 1200,
                    initialQuality: 0.8,
                  });
                  recognitionImage = compressedBase64;
                } catch (_error) {
                  recognitionImage = undefined;
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

        await handleImportData(beanData, { recognitionImage });
      } catch (error) {
        showToast({
          type: 'error',
          title: error instanceof Error ? error.message : '图片识别失败',
        });
        setIsRecognizing(false);
        URL.revokeObjectURL(imageUrl);
        setRecognizingImageUrl(null);
        setCurrentStep('main');
      }
    },
    [handleImportData, recognizeSingleImage]
  );

  // 处理图片文件识别（支持单张和多张）
  const processImageFiles = useCallback(
    async (files: File[]) => {
      if (files.length === 0) return;
      const validFiles: File[] = [];
      for (let i = 0; i < Math.min(files.length, MAX_IMAGES); i++) {
        const file = files[i];
        if (!isSupportedSourceImageFile(file)) {
          continue;
        }
        if (file.size > 10 * 1024 * 1024) {
          continue;
        }
        validFiles.push(file);
      }

      if (validFiles.length === 0) {
        showToast({
          type: 'error',
          title: '请上传 JPG、PNG、WebP 或 HEIF 格式的图片',
        });
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
        await handleRecognizeImageFile(validFiles[0]);
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
    },
    [handleRecognizeImageFile]
  );

  const handleImportPackageFile = useCallback(
    async (file: File) => {
      if (!settings?.experimentalBeanSharePackageEnabled) {
        showToast({ type: 'error', title: '请先开启“分享导入压缩包”' });
        return;
      }

      try {
        const { readCoffeeBeanSharePackage } =
          await import('@/lib/coffee-beans/beanSharePackage');
        const beanData = await readCoffeeBeanSharePackage(file);
        await handleImportData(beanData);
      } catch (error) {
        showToast({
          type: 'error',
          title:
            error instanceof Error ? error.message : '咖啡豆压缩包导入失败',
        });
      }
    },
    [handleImportData, settings?.experimentalBeanSharePackageEnabled]
  );

  // 处理图片上传识别（支持单张和多张）
  const handleImageUpload = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = event.target.files;
      if (!files || files.length === 0) return;

      const selectedFiles = Array.from(files);
      const packageFiles = selectedFiles.filter(file => {
        const name = file.name.toLowerCase();
        return name.endsWith('.brewbeans.zip') || name.endsWith('.zip');
      });

      if (packageFiles.length > 0) {
        if (selectedFiles.length > 1 || packageFiles.length > 1) {
          showToast({ type: 'error', title: '一次只能导入一个压缩包' });
        } else {
          await handleImportPackageFile(packageFiles[0]);
        }
      } else {
        await processImageFiles(selectedFiles);
      }

      // 清除文件输入，以便可以再次选择同一文件
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    },
    [handleImportPackageFile, processImageFiles]
  );

  // 删除预览中的图片
  const handleRemoveImage = useCallback(
    (id: string) => {
      setSelectedImages(prev => {
        const toRemove = prev.find(img => img.id === id);
        if (toRemove) {
          URL.revokeObjectURL(toRemove.previewUrl);
        }
        const remaining = prev.filter(img => img.id !== id);
        // 如果删到只剩一张或没有了，返回主界面；相机模式保留取景器。
        if (remaining.length === 0 && currentStep !== 'camera-preview') {
          setCurrentStep('main');
        }
        return remaining;
      });
    },
    [currentStep]
  );

  // 压缩图片为 base64
  const compressImageToBase64 = useCallback(
    async (file: File): Promise<string | null> => {
      return new Promise(resolve => {
        const reader = new FileReader();
        reader.onload = async () => {
          const base64 = reader.result as string;
          if (base64) {
            try {
              const { compressBase64Image } =
                await import('@/lib/utils/imageCapture');
              const compressedBase64 = await compressBase64Image(base64, {
                maxSizeMB: 0.1,
                maxWidthOrHeight: 1200,
                initialQuality: 0.8,
              });
              resolve(compressedBase64);
            } catch (_error) {
              resolve(null);
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
          recognizeSingleImage(img.file),
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
  const handleUploadImageClick = useCallback(async () => {
    if (!shouldUseNativeGalleryPicker()) {
      fileInputRef.current?.click();
      return;
    }

    try {
      const files = await pickNativeGalleryImageFiles({ limit: MAX_IMAGES });
      await processImageFiles(files);
    } catch (error) {
      if (isImageSelectionCancelled(error)) return;

      showToast({
        type: 'error',
        title: error instanceof Error ? error.message : '无法打开系统相册',
      });
    }
  }, [processImageFiles]);

  const handleUploadPackageClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleOpenCamera = useCallback(() => {
    setCurrentStep('camera-preview');
  }, []);

  const handleToggleTorch = useCallback(async () => {
    if (!isTorchSupported) return;

    const [videoTrack] = cameraStreamRef.current?.getVideoTracks() || [];
    if (!videoTrack) return;

    const nextTorchState = !isTorchOn;

    try {
      await videoTrack.applyConstraints({
        advanced: [{ torch: nextTorchState } as TorchMediaTrackConstraintSet],
      });
      setIsTorchOn(nextTorchState);
    } catch (_error) {
      setIsTorchSupported(false);
      setIsTorchOn(false);
      showToast({ type: 'error', title: '当前设备无法控制闪光灯' });
    }
  }, [isTorchOn, isTorchSupported]);

  const applyCameraZoom = useCallback(
    (value: number) => {
      const nextZoom = Number(clampZoom(value, cameraZoomRange).toFixed(2));

      setCameraZoom(nextZoom);
      setShowZoomIndicator(nextZoom > cameraZoomRange.min + 0.01);

      if (!isHardwareZoomSupported) return;

      const [videoTrack] = cameraStreamRef.current?.getVideoTracks() || [];
      if (!videoTrack) return;

      void videoTrack
        .applyConstraints({
          advanced: [{ zoom: nextZoom } as ZoomMediaTrackConstraintSet],
        })
        .catch(() => {
          setIsHardwareZoomSupported(false);
        });
    },
    [cameraZoomRange, isHardwareZoomSupported]
  );

  const handleCameraPointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (cameraStatus !== 'ready') return;
      if (event.target instanceof Element && event.target.closest('button')) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      event.currentTarget.setPointerCapture(event.pointerId);
      activeCameraPointersRef.current.set(event.pointerId, {
        x: event.clientX,
        y: event.clientY,
      });

      const pointers = Array.from(activeCameraPointersRef.current.values());
      if (pointers.length === 2) {
        pinchStartRef.current = {
          distance: getPointerDistance(pointers[0], pointers[1]),
          zoom: cameraZoom,
        };
      }
    },
    [cameraStatus, cameraZoom]
  );

  const handleCameraPointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!activeCameraPointersRef.current.has(event.pointerId)) return;

      event.preventDefault();
      event.stopPropagation();
      activeCameraPointersRef.current.set(event.pointerId, {
        x: event.clientX,
        y: event.clientY,
      });

      const pinchStart = pinchStartRef.current;
      const pointers = Array.from(activeCameraPointersRef.current.values());
      if (!pinchStart || pointers.length < 2 || pinchStart.distance <= 0) {
        return;
      }

      const distance = getPointerDistance(pointers[0], pointers[1]);
      applyCameraZoom((pinchStart.zoom * distance) / pinchStart.distance);
    },
    [applyCameraZoom]
  );

  const handleCameraPointerEnd = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      event.stopPropagation();
      activeCameraPointersRef.current.delete(event.pointerId);

      if (activeCameraPointersRef.current.size < 2) {
        pinchStartRef.current = null;
      }
    },
    []
  );

  const captureCameraPhotoFile = useCallback(async () => {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0 || video.videoHeight === 0) {
      throw new Error('相机画面还未准备好');
    }

    const captureZoom = isHardwareZoomSupported ? 1 : cameraZoom;
    const outputSize = Math.min(video.videoWidth, video.videoHeight);
    const sourceSize = Math.max(1, Math.floor(outputSize / captureZoom));
    const sourceX = Math.floor((video.videoWidth - sourceSize) / 2);
    const sourceY = Math.floor((video.videoHeight - sourceSize) / 2);

    const canvas = document.createElement('canvas');
    canvas.width = outputSize;
    canvas.height = outputSize;

    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('无法创建拍照画布');
    }

    context.drawImage(
      video,
      sourceX,
      sourceY,
      sourceSize,
      sourceSize,
      0,
      0,
      outputSize,
      outputSize
    );

    return createCameraPhotoFile(canvas);
  }, [cameraZoom, isHardwareZoomSupported]);

  const handleCaptureCameraPhoto = useCallback(async () => {
    if (cameraStatus !== 'ready' || isCameraCapturing || isMultiRecognizing) {
      return;
    }

    if (selectedImages.length >= MAX_IMAGES) {
      showToast({ type: 'info', title: `最多保留 ${MAX_IMAGES} 张照片` });
      return;
    }

    setIsCameraCapturing(true);

    try {
      const file = await captureCameraPhotoFile();
      const previewUrl = URL.createObjectURL(file);

      setSelectedImages(prev => [
        ...prev,
        {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          file,
          previewUrl,
          status: 'pending',
        },
      ]);
    } catch (error) {
      showToast({
        type: 'error',
        title: error instanceof Error ? error.message : '拍照失败',
      });
    } finally {
      setIsCameraCapturing(false);
    }
  }, [
    captureCameraPhotoFile,
    cameraStatus,
    isCameraCapturing,
    isMultiRecognizing,
    selectedImages.length,
  ]);

  const handleRecognizeCameraImages = useCallback(async () => {
    if (selectedImages.length === 0 || isMultiRecognizing) return;

    await handleMultiRecognition();
  }, [handleMultiRecognition, isMultiRecognizing, selectedImages.length]);

  // 复制提示词 - 使用统一的 useCopy hook
  const handleCopyPrompt = useCallback(async () => {
    await copyText(effectiveRecognitionPrompt);
  }, [copyText, effectiveRecognitionPrompt]);

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
    if (!isDrawerDismissible) {
      return;
    }

    stopCamera();
    setCurrentStep('main');
    setJsonInputValue('');
    setIsRecognizing(false);
    if (recognizingImageUrl) {
      URL.revokeObjectURL(recognizingImageUrl);
      setRecognizingImageUrl(null);
    }
    onClose();
  }, [isDrawerDismissible, onClose, recognizingImageUrl, stopCamera]);

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
            type="button"
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
        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={handleOpenCamera}
          className="w-full rounded-full bg-neutral-100 px-4 py-3 text-left text-sm font-medium text-neutral-800 dark:bg-neutral-800 dark:text-white"
        >
          拍照识别图片
        </motion.button>
        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={handleUploadImageClick}
          className="w-full rounded-full bg-neutral-100 px-4 py-3 text-left text-sm font-medium text-neutral-800 dark:bg-neutral-800 dark:text-white"
        >
          相册识别图片
        </motion.button>
        {settings?.experimentalBeanSharePackageEnabled && (
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={handleUploadPackageClick}
            className="w-full rounded-full bg-neutral-100 px-4 py-3 text-left text-sm font-medium text-neutral-800 dark:bg-neutral-800 dark:text-white"
          >
            选择压缩包
          </motion.button>
        )}
        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={handleInputJSON}
          className="w-full rounded-full bg-neutral-100 px-4 py-3 text-left text-sm font-medium text-neutral-800 dark:bg-neutral-800 dark:text-white"
        >
          输入 JSON
        </motion.button>
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
          输入或粘贴
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

  const cameraPreviewContent = (
    <>
      <div className="mb-4">
        <div
          data-vaul-no-drag
          className="relative aspect-square w-full touch-none overflow-hidden rounded-3xl bg-neutral-950 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.1)]"
          onPointerDown={handleCameraPointerDown}
          onPointerMove={handleCameraPointerMove}
          onPointerUp={handleCameraPointerEnd}
          onPointerCancel={handleCameraPointerEnd}
        >
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className={`h-full w-full object-cover transition-[opacity,filter] duration-300 ease-out ${
              cameraStatus === 'ready'
                ? 'blur-0 opacity-100'
                : 'opacity-0 blur-sm'
            }`}
            style={{
              transform: isHardwareZoomSupported
                ? undefined
                : `scale(${cameraZoom})`,
            }}
          />

          {cameraStatus === 'starting' && (
            <div className="pointer-events-none absolute inset-4 opacity-25">
              <CornerBorder position="top-left" />
              <CornerBorder position="top-right" />
              <CornerBorder position="bottom-left" />
              <CornerBorder position="bottom-right" />
            </div>
          )}

          {cameraStatus === 'error' && (
            <div className="absolute inset-0 flex items-center justify-center px-8 text-center">
              <p className="text-sm leading-relaxed text-white/70">
                {cameraError || '无法打开摄像头'}
              </p>
            </div>
          )}

          {cameraStatus === 'ready' && (
            <>
              <div className="pointer-events-none absolute inset-4">
                <CornerBorder position="top-left" />
                {!isTorchSupported && <CornerBorder position="top-right" />}
                <CornerBorder position="bottom-left" />
                <CornerBorder position="bottom-right" />
              </div>

              {isTorchSupported && (
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.96 }}
                  onClick={handleToggleTorch}
                  aria-label={isTorchOn ? '关闭闪光灯' : '打开闪光灯'}
                  aria-pressed={isTorchOn}
                  className={`absolute top-4 right-4 flex h-10 w-10 items-center justify-center rounded-full backdrop-blur-md transition-colors ${
                    isTorchOn
                      ? 'bg-white text-neutral-900'
                      : 'bg-black/45 text-white'
                  }`}
                >
                  {isTorchOn ? (
                    <FlashlightOff className="h-5 w-5" strokeWidth={2.25} />
                  ) : (
                    <Flashlight className="h-5 w-5" strokeWidth={2.25} />
                  )}
                </motion.button>
              )}

              {showZoomIndicator && (
                <div className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 text-xs font-medium text-white tabular-nums">
                  {cameraZoom.toFixed(1)}x
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <div className="relative mb-5 h-16">
        <div
          className={`absolute inset-0 flex items-center transition-opacity duration-200 ease-out ${
            selectedImages.length > 0
              ? 'pointer-events-none opacity-0'
              : 'opacity-100'
          }`}
        >
          <p className="w-full text-sm leading-6 text-neutral-500 dark:text-neutral-400">
            将
            <span className="text-neutral-800 dark:text-neutral-200">
              咖啡豆包装
            </span>
            放入取景框后拍照；画面发灰时，轻拭镜头会更容易识别。
          </p>
        </div>

        <div
          className={`absolute inset-0 flex items-center justify-center transition-opacity duration-200 ease-out ${
            selectedImages.length > 0
              ? 'opacity-100'
              : 'pointer-events-none opacity-0'
          }`}
        >
          <div className="flex max-w-full items-center justify-center gap-2 px-1">
            {selectedImages.map(img => (
              <motion.div
                layout
                key={img.id}
                initial={{ opacity: 0, scale: 0.94 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: 'spring', duration: 0.2, bounce: 0 }}
                className={`relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-neutral-100 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.1)] dark:bg-neutral-800 dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.1)] ${
                  img.status === 'processing'
                    ? 'ring-2 ring-neutral-400 ring-offset-1 ring-offset-white dark:ring-neutral-500 dark:ring-offset-neutral-900'
                    : ''
                }`}
              >
                <img
                  src={img.previewUrl}
                  alt="已拍照"
                  className={`h-full w-full object-cover transition-[filter,transform] duration-200 ${
                    img.status === 'error' ? 'brightness-50 grayscale' : ''
                  }`}
                />
                {img.status === 'success' && (
                  <div className="absolute right-1 bottom-1 flex h-4 w-4 items-center justify-center rounded-full bg-neutral-900/80 dark:bg-white/90">
                    <svg
                      className="h-2.5 w-2.5 text-white dark:text-neutral-900"
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
                {img.status === 'error' && (
                  <div className="absolute right-1 bottom-1 flex h-4 w-4 items-center justify-center rounded-full bg-neutral-500/80">
                    <svg
                      className="h-2.5 w-2.5 text-white"
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
                {!isMultiRecognizing && img.status === 'pending' && (
                  <button
                    type="button"
                    onClick={() => handleRemoveImage(img.id)}
                    className="absolute top-0 right-0 flex h-5 w-5 items-center justify-center rounded-bl-[8px] bg-neutral-900/55 text-white backdrop-blur-sm"
                    aria-label="移除照片"
                  >
                    <svg
                      className="h-2.5 w-2.5"
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
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {cameraStatus === 'error' ? (
        <div className="flex gap-2">
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={goBackToMain}
            className="flex-1 rounded-full bg-neutral-100 px-4 py-3 text-sm font-medium text-neutral-800 dark:bg-neutral-800 dark:text-white"
          >
            取消
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={handleUploadImageClick}
            className="flex-1 rounded-full bg-neutral-900 px-4 py-3 text-sm font-medium text-white dark:bg-white dark:text-neutral-900"
          >
            选择图片
          </motion.button>
        </div>
      ) : (
        <div className="flex gap-2">
          <motion.button
            whileTap={isMultiRecognizing ? undefined : { scale: 0.98 }}
            onClick={goBackToMain}
            disabled={isMultiRecognizing}
            className="flex-1 rounded-full bg-neutral-100 px-4 py-3 text-sm font-medium text-neutral-800 dark:bg-neutral-800 dark:text-white"
          >
            取消
          </motion.button>
          <div className="flex flex-[1.45] overflow-hidden rounded-full bg-neutral-100 text-sm font-medium text-neutral-800 dark:bg-neutral-800 dark:text-white">
            <button
              type="button"
              onClick={handleCaptureCameraPhoto}
              disabled={
                cameraStatus !== 'ready' ||
                isCameraCapturing ||
                isMultiRecognizing ||
                selectedImages.length >= MAX_IMAGES
              }
              className={`min-w-0 flex-1 px-4 py-3 transition-opacity active:scale-[0.98] disabled:active:scale-100 ${
                cameraStatus === 'ready' &&
                !isCameraCapturing &&
                !isMultiRecognizing &&
                selectedImages.length < MAX_IMAGES
                  ? ''
                  : 'opacity-40'
              }`}
            >
              拍照
            </button>
            <div className="my-3 w-px bg-neutral-300 dark:bg-neutral-700" />
            <button
              type="button"
              onClick={handleRecognizeCameraImages}
              disabled={selectedImages.length === 0 || isMultiRecognizing}
              className={`min-w-0 flex-1 px-4 py-3 transition-opacity active:scale-[0.98] disabled:active:scale-100 ${
                selectedImages.length > 0 && !isMultiRecognizing
                  ? ''
                  : 'opacity-40'
              }`}
            >
              入库
            </button>
          </div>
        </div>
      )}
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
                  type="button"
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
      case 'camera-preview':
        return cameraPreviewContent;
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
        onExitComplete={resetImportState}
        historyId="bean-import"
        dismissible={isDrawerDismissible}
      >
        <ActionDrawer.Switcher activeKey={currentStep}>
          {renderContent()}
        </ActionDrawer.Switcher>
      </ActionDrawer>

      {/* 隐藏的文件输入 - 支持多选 */}
      <input
        ref={fileInputRef}
        type="file"
        accept={fileInputAccept}
        multiple
        className="hidden"
        onChange={handleImageUpload}
      />

      {/* 复制失败抽屉 */}
      <CopyFailureDrawer {...failureDrawerProps} />
    </>
  );
};

export default BeanImportModal;
