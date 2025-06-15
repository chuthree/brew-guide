'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import ReactCrop, { Crop } from 'react-image-crop'
import 'react-image-crop/dist/ReactCrop.css'
import { recognizeImage, RecognitionError } from '@/services/recognition'
import { debounce } from 'lodash'
import { captureImage } from '@/lib/utils/imageCapture'

interface BeanImportModalProps {
    showForm: boolean
    onImport: (jsonData: string) => Promise<void>
    onClose: () => void
}

interface ImportedBean {
    capacity?: number | string;
    remaining?: number | string;
    price?: number | string | null;
    [key: string]: unknown;
}

// 常量定义
const DEFAULT_CROP: Crop = {
    unit: '%',
    width: 60,
    height: 60,
    x: 20,
    y: 20
}

const EMPTY_CROP: Crop = {
    unit: '%',
    width: 0,
    height: 0,
    x: 0,
    y: 0
}

const IMAGE_COMPRESSION_CONFIG = {
    maxSizeMB: 2,
    maxDimension: 2048,
    quality: 0.9,
    minQuality: 0.1,
    format: 'image/jpeg' as const
}

// 样式常量
const STYLES = {
    button: {
        primary: "px-4 py-2 bg-neutral-800 dark:bg-neutral-200 text-neutral-100 dark:text-neutral-800 rounded-md text-sm",
        secondary: "px-4 py-2 border border-neutral-300 dark:border-neutral-700 text-neutral-800 dark:text-neutral-200 rounded-md text-sm",
        small: "px-3 py-1 text-sm",
        upload: "flex-1 py-2 px-4 border border-dashed border-neutral-300 dark:border-neutral-600 rounded-md text-sm text-neutral-600 dark:text-neutral-400"
    },
    text: {
        muted: "text-neutral-600 dark:text-neutral-400",
        small: "text-xs",
        error: "text-sm text-red-500 dark:text-red-400",
        success: "text-sm text-green-500 dark:text-green-400"
    },
    container: {
        modal: "p-3 border text-xs font-medium relative border-neutral-200 dark:border-neutral-700 rounded-md bg-neutral-100/80 dark:bg-neutral-800"
    }
} as const;

// 图片压缩工具函数
const compressImage = async (file: File, maxSizeMB: number = IMAGE_COMPRESSION_CONFIG.maxSizeMB): Promise<Blob> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target?.result as string;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let { width, height } = img;

                // 缩放图片尺寸
                if (width > IMAGE_COMPRESSION_CONFIG.maxDimension || height > IMAGE_COMPRESSION_CONFIG.maxDimension) {
                    const scale = IMAGE_COMPRESSION_CONFIG.maxDimension / Math.max(width, height);
                    width = Math.round(width * scale);
                    height = Math.round(height * scale);
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    reject(new Error('无法创建canvas上下文'));
                    return;
                }

                ctx.drawImage(img, 0, 0, width, height);

                // 递归压缩
                let quality = IMAGE_COMPRESSION_CONFIG.quality;
                const compress = () => {
                    canvas.toBlob(
                        (blob) => {
                            if (!blob) {
                                reject(new Error('压缩失败'));
                                return;
                            }

                            if (blob.size > maxSizeMB * 1024 * 1024 && quality > IMAGE_COMPRESSION_CONFIG.minQuality) {
                                quality -= 0.1;
                                compress();
                            } else {
                                resolve(blob);
                            }
                        },
                        IMAGE_COMPRESSION_CONFIG.format,
                        quality
                    );
                };

                compress();
            };
            img.onerror = () => reject(new Error('图片加载失败'));
        };
        reader.onerror = () => reject(new Error('文件读取失败'));
    });
};

// 工具函数：重置图片相关状态
const resetImageStates = (
    setSelectedImage: (value: string | null) => void,
    setCroppedImage: (value: string | null) => void,
    setIsCropActive: (value: boolean) => void,
    setCrop: (value: Crop) => void
) => {
    setSelectedImage(null);
    setCroppedImage(null);
    setIsCropActive(false);
    setCrop(EMPTY_CROP);
};

// 工具函数：设置默认裁剪区域
const setDefaultCrop = (
    setCrop: (value: Crop) => void,
    setIsCropActive: (value: boolean) => void
) => {
    setCrop(DEFAULT_CROP);
    setIsCropActive(true);
};

const BeanImportModal: React.FC<BeanImportModalProps> = ({
    showForm,
    onImport,
    onClose
}) => {
    // 状态管理
    const [importData, setImportData] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [selectedImage, setSelectedImage] = useState<string | null>(null);
    const [crop, setCrop] = useState<Crop>(EMPTY_CROP);
    const [croppedImage, setCroppedImage] = useState<string | null>(null);
    const [isCropActive, setIsCropActive] = useState(false);
    const [manualMode, setManualMode] = useState(false);

    const imgRef = useRef<HTMLImageElement>(null);

    // 裁剪处理逻辑
    const handleCropComplete = useCallback(
        debounce(async (crop: Crop) => {
            if (!selectedImage || !imgRef.current || !isCropActive || !crop.width || !crop.height) {
                setCroppedImage(null);
                return;
            }

            const image = new Image();
            image.src = selectedImage;

            // 等待图片加载
            await new Promise<void>((resolve) => {
                if (image.complete) resolve();
                else image.onload = () => resolve();
            });

            const canvas = document.createElement('canvas');
            const displayedImage = imgRef.current;
            const scaleX = image.naturalWidth / displayedImage.width;
            const scaleY = image.naturalHeight / displayedImage.height;

            // 计算裁剪区域
            const isPercentage = crop.unit === '%';
            const cropWidth = isPercentage ? (crop.width / 100) * displayedImage.width : crop.width;
            const cropHeight = isPercentage ? (crop.height / 100) * displayedImage.height : crop.height;
            const cropX = isPercentage ? (crop.x / 100) * displayedImage.width : crop.x;
            const cropY = isPercentage ? (crop.y / 100) * displayedImage.height : crop.y;

            // 优化画布尺寸
            const maxCanvasSize = 800;
            let finalWidth = cropWidth * scaleX;
            let finalHeight = cropHeight * scaleY;

            if (finalWidth > maxCanvasSize || finalHeight > maxCanvasSize) {
                const scale = maxCanvasSize / Math.max(finalWidth, finalHeight);
                finalWidth *= scale;
                finalHeight *= scale;
            }

            canvas.width = finalWidth;
            canvas.height = finalHeight;

            const ctx = canvas.getContext('2d');
            if (!ctx) return;

            ctx.drawImage(
                image,
                cropX * scaleX, cropY * scaleY,
                cropWidth * scaleX, cropHeight * scaleY,
                0, 0, finalWidth, finalHeight
            );

            setCroppedImage(canvas.toDataURL('image/jpeg', 0.8));
        }, 150),
        [selectedImage, isCropActive]
    );

    const handleCropStart = () => setIsCropActive(true);
    const handleCropChange = (newCrop: Crop) => {
        setCrop(newCrop);
        setIsCropActive(true);
    };

    // 清除消息状态
    const clearMessages = useCallback(() => {
        setError(null);
        setSuccess(null);
    }, []);

    // 重置所有状态
    const resetAllStates = useCallback(() => {
        setImportData('');
        resetImageStates(setSelectedImage, setCroppedImage, setIsCropActive, setCrop);
        clearMessages();
    }, []);

    // 自动触发裁剪完成
    useEffect(() => {
        if (selectedImage && isCropActive && crop.width && crop.height) {
            const imageElement = imgRef.current;
            if (imageElement?.complete) {
                handleCropComplete(crop);
            } else if (imageElement) {
                imageElement.onload = () => handleCropComplete(crop);
            }
        }
    }, [selectedImage, crop, handleCropComplete, isCropActive]);

    // 设置默认裁剪区域
    useEffect(() => {
        if (selectedImage && !isCropActive) {
            setDefaultCrop(setCrop, setIsCropActive);
        }
    }, [selectedImage, isCropActive]);

    // 表单关闭时重置状态
    useEffect(() => {
        if (!showForm) {
            resetAllStates();
        }
    }, [showForm, resetAllStates]);

    // 关闭处理
    const handleClose = useCallback(() => {
        resetAllStates();
        onClose();
    }, [resetAllStates, onClose]);

// 模板提示词常量
const TEMPLATE_PROMPT = `提取咖啡豆信息，返回JSON格式。

单个咖啡豆使用：{...}
多个咖啡豆使用：[{...},{...}]

字段说明：
- name: 咖啡豆名称（必填）
- capacity: 总容量数字
- remaining: 剩余容量数字
- price: 价格数字
- roastLevel: 极浅烘焙/浅度烘焙/中浅烘焙/中度烘焙/中深烘焙/深度烘焙
- roastDate: YYYY-MM-DD格式
- flavor: 风味数组
- notes: 备注信息
- startDay: 养豆期天数
- endDay: 赏味期天数
- blendComponents: 成分数组

成分格式：
单品：[{"origin":"埃塞俄比亚","process":"水洗","variety":"瑰夏"}]
拼配：[
  {"percentage":60,"origin":"巴西","process":"日晒","variety":"红波旁"},
  {"percentage":40,"origin":"埃塞俄比亚","process":"水洗","variety":"铁皮卡"}
]

成分字段说明：
- percentage: 比例数字（有比例信息时填写，没有时可省略该字段）
- origin: 产地
- process: 处理法
- variety: 品种

注意：
- 每个成分的origin/process/variety只能填一个值，不能用逗号连接
- 不确定的字段留空字符串""或空数组[]
- 产地、处理法、品种信息请放在blendComponents数组中`;

    // 复制文本到剪贴板
    const copyTextToClipboard = useCallback(async (text: string) => {
        try {
            if (navigator.clipboard?.writeText) {
                await navigator.clipboard.writeText(text);
                setSuccess('复制成功');
                setTimeout(() => setSuccess(null), 2000);
                return;
            }

            // 降级方案
            const textArea = document.createElement('textarea');
            textArea.value = text;
            textArea.style.cssText = 'position:fixed;left:-999999px;top:-999999px;';
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();

            try {
                document.execCommand('copy');
                setSuccess('复制成功');
            } catch {
                setError('复制失败');
            } finally {
                document.body.removeChild(textArea);
                setTimeout(() => {
                    setSuccess(null);
                    setError(null);
                }, 2000);
            }
        } catch {
            setError('复制失败');
            setTimeout(() => setError(null), 2000);
        }
    }, []);

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

            // 验证数据
            if (!dataArray.every(item => typeof item === 'object' && item !== null && 'roastLevel' in item)) {
                setError(isArray ? '部分数据不是有效的咖啡豆信息' : '提取的数据不是有效的咖啡豆信息');
                return;
            }

            // 处理数据
            const processedBeans = dataArray.map(bean => ({
                ...ensureStringFields(bean as unknown as ImportedBean),
                timestamp: Date.now()
            }));

            setSuccess(isArray ? '正在批量添加咖啡豆数据...' : '正在添加咖啡豆数据...');
            await onImport(JSON.stringify(processedBeans));
            handleClose();

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : '未知错误';
            setError(`添加失败: ${errorMessage}`);
            setSuccess(null);
        }
    }, [importData, ensureStringFields, onImport, handleClose]);

    // 图片选择处理
    const handleImageSelect = useCallback(async (source: 'camera' | 'gallery') => {
        try {
            const result = await captureImage({ source });
            setSelectedImage(result.dataUrl);
            setCroppedImage(null);
            setIsCropActive(false); // 将在 useEffect 中自动设置为 true
        } catch (error) {
            // Log error in development only
            if (process.env.NODE_ENV === 'development') {
                console.error('打开相机/相册失败:', error);
            }
            setError('打开相机/相册失败，请重试');
        }
    }, []);

    // 图片识别处理
    const handleImageRecognition = useCallback(async () => {
        if (!selectedImage) return;

        setIsUploading(true);
        clearMessages();

        try {
            const imageToUse = (isCropActive && croppedImage) ? croppedImage : selectedImage;

            // 转换为 Blob 并压缩
            const response = await fetch(imageToUse);
            const originalBlob = await response.blob();
            const compressedBlob = await compressImage(
                new File([originalBlob], 'coffee-bean.jpg', { type: 'image/jpeg' })
            );

            const formData = new FormData();
            formData.append('file', compressedBlob, 'coffee-bean.jpg');

            const data = await recognizeImage(formData);

            if (data.result) {
                setImportData(JSON.stringify(data.result, null, 2));
                setSuccess('✨ AI识别成功！请检查识别结果是否正确');
            }
        } catch (err) {
            // Log error in development only
            if (process.env.NODE_ENV === 'development') {
                console.error('识别失败:', err);
            }
            setError(err instanceof RecognitionError ? err.message : '图片识别失败，请重试');
        } finally {
            setIsUploading(false);
            resetImageStates(setSelectedImage, setCroppedImage, setIsCropActive, setCrop);
        }
    }, [selectedImage, isCropActive, croppedImage, clearMessages]);

    // 手动模式切换
    const toggleManualMode = useCallback(() => {
        setManualMode(prev => !prev);
        clearMessages();
    }, [clearMessages]);

    // 渲染上传部分
    const renderUploadSection = () => (
        <div className={STYLES.container.modal}>
            <button
                onClick={toggleManualMode}
                className="px-2 py-1 absolute right-0 top-0 rounded-bl bg-neutral-200 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300"
            >
                {manualMode ? '切换识图' : '切换手动'}
            </button>
            <div className="flex flex-col space-y-3">
                <div className="flex justify-between items-center">
                    <p className={STYLES.text.muted}>
                        {manualMode ? '手动填写咖啡豆信息' : '上传咖啡豆包装图片，AI自动识别信息'}
                    </p>
                </div>

                {manualMode ? (
                    <div className="space-y-4 py-1">
                        <div className="bg-neutral-100 dark:bg-neutral-800 rounded-lg text-neutral-600 dark:text-neutral-400">
                            <ol className="list-decimal pl-4 space-y-1">
                                <li>准备好咖啡豆商品图、excel表格等</li>
                                <li>
                                    <span>发送至</span>
                                    <a 
                                    href="https://doubao.com/bot/duJYQEFd" 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="pb-1.5 relative text-neutral-600 dark:text-neutral-400"
                                >
                                    <span className="relative underline underline-offset-2 decoration-sky-600 ml-1">豆包定制智能体</span>
                                    <svg viewBox="0 0 24 24" className="inline-block ml-1 w-3 h-3" fill="none" xmlns="http://www.w3.org/2000/svg" stroke="currentColor">
                                        <path d="M7 17L17 7M17 7H7M17 7V17" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                </a></li>
                                <li>将返回的 JSON 数据粘贴到下方文本框</li>
                                
                            </ol>
                            <details className="mt-3 p-2 bg-neutral-50 dark:bg-neutral-900/60 border border-neutral-200 dark:border-neutral-700 rounded-md">
                                <summary className="text-neutral-500 dark:text-neutral-400 cursor-pointer">提示词（点击展开）</summary>
                                <textarea
                                    readOnly
                                    value={TEMPLATE_PROMPT}
                                    className="w-full text-neutral-700 dark:text-neutral-300 p-2 mt-2 bg-neutral-50 dark:bg-neutral-900/60 border border-neutral-200 dark:border-neutral-700 rounded-md h-20 overflow-auto"
                                    onFocus={(e) => e.target.select()}
                                />
                                <div className="flex justify-end mt-1">
                                    <button
                                        onClick={() => {
                                            clearMessages();
                                            copyTextToClipboard(TEMPLATE_PROMPT);
                                        }}
                                        className="text-neutral-500 dark:text-neutral-400 px-2 py-0.5 rounded-sm  bg-neutral-200/80 dark:bg-neutral-800/80 hover:bg-neutral-300 dark:hover:bg-neutral-700 transition-colors"
                                    >
                                        复制
                                    </button>
                                </div>
                            </details>
                        </div>
                    </div>
                ) : !manualMode && selectedImage ? (
                    <div className="space-y-3">
                        <div className="relative w-full flex flex-col items-center">
                            <div className="w-full">
                                <ReactCrop
                                    crop={crop}
                                    onChange={handleCropChange}
                                    onComplete={handleCropComplete}
                                    onDragStart={handleCropStart}
                                    aspect={undefined}
                                    className="w-full flex justify-center"
                                    ruleOfThirds={true}
                                >
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                        ref={imgRef}
                                        src={selectedImage}
                                        alt="Upload preview"
                                        className="rounded-md max-h-[60vh] w-auto"
                                        style={{ 
                                            objectFit: 'contain',
                                            maxWidth: '100%'
                                        }}
                                    />
                                </ReactCrop>
                            </div>
                            <div className="w-full flex items-center justify-between mt-2">
                                <p className="text-[10px] text-neutral-500 dark:text-neutral-400">
                                    {isCropActive ? "已框选区域进行精确识别" : "可在图片上框选区域进行精确识别"}
                                </p>
                                {isCropActive && (
                                    <button
                                        onClick={() => {
                                            setIsCropActive(false);
                                            setCroppedImage(null);
                                            setCrop(EMPTY_CROP);
                                        }}
                                        className="text-[10px] px-2 py-0.5 bg-neutral-200 dark:bg-neutral-700 rounded-sm text-neutral-700 dark:text-neutral-300"
                                    >
                                        取消框选
                                    </button>
                                )}
                            </div>
                        </div>
                        <div className="flex justify-end space-x-2">
                            <button
                                onClick={() => {
                                    setSelectedImage(null);
                                    setCroppedImage(null);
                                    setIsCropActive(false);
                                }}
                                className={`${STYLES.button.small} border border-neutral-300 dark:border-neutral-600 rounded-sm`}
                            >
                                重新选择
                            </button>
                            <button
                                onClick={handleImageRecognition}
                                className={`${STYLES.button.small} bg-neutral-800 dark:bg-neutral-200 text-neutral-100 dark:text-neutral-800 rounded-sm`}
                            >
                                确认裁剪并识别
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="flex space-x-2">
                        <button
                            onClick={() => handleImageSelect('camera')}
                            disabled={isUploading}
                            className={STYLES.button.upload}
                        >
                            <span className="flex items-center justify-center space-x-2">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                                <span>拍照</span>
                            </span>
                        </button>
                        <button
                            onClick={() => handleImageSelect('gallery')}
                            disabled={isUploading}
                            className={STYLES.button.upload}
                        >
                            <span className="flex items-center justify-center space-x-2">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                                <span>相册</span>
                            </span>
                        </button>
                    </div>
                )}

                {isUploading && (
                    <div className="flex items-center justify-center space-x-2">
                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        <span className="text-sm">处理中...</span>
                    </div>
                )}
            </div>
        </div>
    );

    return (
        <AnimatePresence>
            {showForm && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.265 }}
                    className="fixed inset-0 z-50 bg-black/30 backdrop-blur-xs"
                >
                    <motion.div
                        initial={{ y: '100%' }}
                        animate={{ y: 0 }}
                        exit={{ y: '100%' }}
                        transition={{
                            type: "tween",
                            ease: [0.33, 1, 0.68, 1], // cubic-bezier(0.33, 1, 0.68, 1) - easeOutCubic
                            duration: 0.265
                        }}
                        style={{
                            willChange: "transform"
                        }}
                        className="absolute inset-x-0 bottom-0 max-w-[500px] mx-auto max-h-[90vh] overflow-hidden rounded-t-2xl bg-neutral-50 dark:bg-neutral-900 shadow-xl"
                    >
                        {/* 拖动条 */}
                        <div className="sticky top-0 z-10 flex justify-center py-2 bg-neutral-50 dark:bg-neutral-900">
                            <div className="h-1.5 w-12 rounded-full bg-neutral-200 dark:bg-neutral-700" />
                        </div>

                        {/* 表单内容 */}
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{
                                type: "tween",
                                ease: "easeOut",
                                duration: 0.265,
                                delay: 0.05
                            }}
                            style={{
                                willChange: "opacity, transform"
                            }}
                            className="px-6 pb-safe-bottom overflow-auto max-h-[calc(90vh-40px)]"
                        >
                            <div className="flex flex-col">
                                {/* 顶部标题 */}
                                <div className="flex items-center justify-between mt-3 mb-6">
                                    <button
                                        type="button"
                                        onClick={handleClose}
                                        className="rounded-full p-2"
                                    >
                                        <svg
                                            width="16"
                                            height="16"
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            xmlns="http://www.w3.org/2000/svg"
                                            className="text-neutral-800 dark:text-neutral-200"
                                        >
                                            <path
                                                d="M19 12H5M5 12L12 19M5 12L12 5"
                                                stroke="currentColor"
                                                strokeWidth="2"
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                            />
                                        </svg>
                                    </button>
                                    <h3 className="text-base font-medium">添加咖啡豆数据</h3>
                                    <div className="w-8"></div>
                                </div>

                                {/* 表单内容 */}
                                <div className="space-y-4 mt-2">
                                    {renderUploadSection()}
                                    <div className="flex items-center mb-1">
                                        <p className="text-xs text-neutral-300 dark:text-neutral-700 flex-1">
                                            JSON 数据或分享的文本
                                        </p>
                                    </div>
                                    <textarea
                                        className="w-full p-3 border border-neutral-300/50 dark:border-neutral-700/80 rounded-md bg-transparent focus:outline-hidden text-neutral-800 dark:text-neutral-200"
                                        placeholder=""
                                        value={importData}
                                        onChange={(e) => setImportData(e.target.value)}
                                    />
                                    {error && (
                                        <div className={STYLES.text.error}>
                                            {error}
                                        </div>
                                    )}
                                    {success && (
                                        <div className={STYLES.text.success}>
                                            {success}
                                        </div>
                                    )}
                                    <div className="flex justify-end space-x-3 my-4">
                                        <button
                                            onClick={handleClose}
                                            className={STYLES.button.secondary}
                                        >
                                            取消
                                        </button>
                                        <button
                                            onClick={handleImport}
                                            className={STYLES.button.primary}
                                        >
                                            添加
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    )
}

export default BeanImportModal 