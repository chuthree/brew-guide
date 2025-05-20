'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import ReactCrop, { Crop } from 'react-image-crop'
import 'react-image-crop/dist/ReactCrop.css'
import { recognizeImage, RecognitionError } from '@/services/recognition'
import { debounce } from 'lodash'

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

// 添加图片压缩函数
const compressImage = async (file: File, maxSizeMB: number = 2): Promise<Blob> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target?.result as string;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;
                
                // 如果图片尺寸太大，先缩小尺寸
                const maxDimension = 2048; // 最大尺寸
                if (width > maxDimension || height > maxDimension) {
                    if (width > height) {
                        height = Math.round((height * maxDimension) / width);
                        width = maxDimension;
                    } else {
                        width = Math.round((width * maxDimension) / height);
                        height = maxDimension;
                    }
                }
                
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    reject(new Error('无法创建canvas上下文'));
                    return;
                }
                
                ctx.drawImage(img, 0, 0, width, height);
                
                // 压缩图片质量
                let quality = 0.9;
                const compress = () => {
                    canvas.toBlob(
                        (blob) => {
                            if (!blob) {
                                reject(new Error('压缩失败'));
                                return;
                            }
                            
                            // 检查大小
                            if (blob.size > maxSizeMB * 1024 * 1024 && quality > 0.1) {
                                quality -= 0.1;
                                compress();
                            } else {
                                resolve(blob);
                            }
                        },
                        'image/jpeg',
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

const BeanImportModal: React.FC<BeanImportModalProps> = ({
    showForm,
    onImport,
    onClose
}) => {
    // 导入数据的状态
    const [importData, setImportData] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const _fileInputRef = useRef<HTMLInputElement>(null);
    const [selectedImage, setSelectedImage] = useState<string | null>(null);
    const [crop, setCrop] = useState<Crop>({
        unit: '%',
        width: 0,
        height: 0,
        x: 0,
        y: 0
    });
    const [croppedImage, setCroppedImage] = useState<string | null>(null);
    const [_showCropper, setShowCropper] = useState(false);
    // 添加状态标记用户是否进行了裁剪操作
    const [isCropActive, setIsCropActive] = useState(false);
    const imgRef = useRef<HTMLImageElement>(null);

    // 添加手动模式状态
    const [manualMode, setManualMode] = useState(false);

    // Function to handle crop complete - 移到前面并使用useCallback并添加防抖处理
    const handleCropComplete = useCallback(
        debounce(async (crop: Crop) => {
            if (!selectedImage || !imgRef.current || !isCropActive) return;

            // 检查用户是否实际进行了裁剪
            if (crop.width === 0 || crop.height === 0) {
                setCroppedImage(null);
                return;
            }

            const image = new Image();
            image.src = selectedImage;

            // 等待图片加载完成
            await new Promise((resolve) => {
                if (image.complete) {
                    resolve(true);
                } else {
                    image.onload = () => resolve(true);
                }
            });

            const canvas = document.createElement('canvas');
            // 获取显示的图片元素
            const displayedImage = imgRef.current;

            // 计算实际比例
            const scaleX = image.naturalWidth / displayedImage.width;
            const scaleY = image.naturalHeight / displayedImage.height;

            // 根据单位计算裁剪区域的实际尺寸
            let cropWidth, cropHeight, cropX, cropY;
            if (crop.unit === '%') {
                cropWidth = (crop.width! / 100) * displayedImage.width;
                cropHeight = (crop.height! / 100) * displayedImage.height;
                cropX = (crop.x! / 100) * displayedImage.width;
                cropY = (crop.y! / 100) * displayedImage.height;
            } else {
                cropWidth = crop.width!;
                cropHeight = crop.height!;
                cropX = crop.x!;
                cropY = crop.y!;
            }

            // 降低画布分辨率以提升性能，减小输出图片的尺寸
            const maxCanvasSize = 800; // 最大尺寸限制，防止生成过大的图片
            const aspectRatio = cropWidth / cropHeight;
            
            let finalWidth = cropWidth * scaleX;
            let finalHeight = cropHeight * scaleY;
            
            // 如果图片过大，则按比例缩小
            if (finalWidth > maxCanvasSize || finalHeight > maxCanvasSize) {
                if (aspectRatio >= 1) {
                    finalWidth = maxCanvasSize;
                    finalHeight = finalWidth / aspectRatio;
                } else {
                    finalHeight = maxCanvasSize;
                    finalWidth = finalHeight * aspectRatio;
                }
            }
            
            // 设置画布尺寸为调整后的大小
            canvas.width = finalWidth;
            canvas.height = finalHeight;

            const ctx = canvas.getContext('2d');
            if (!ctx) return;

            // 使用更高效的绘图方式
            ctx.drawImage(
                image,
                cropX * scaleX,
                cropY * scaleY,
                cropWidth * scaleX,
                cropHeight * scaleY,
                0,
                0,
                finalWidth,
                finalHeight
            );

            // 使用较低的图片质量来提高性能
            const croppedDataUrl = canvas.toDataURL('image/jpeg', 0.8);
            setCroppedImage(croppedDataUrl);
        }, 150), // 150毫秒的防抖延迟
        [selectedImage, isCropActive]
    );

    // 用户开始裁剪时激活裁剪状态
    const handleCropStart = () => {
        setIsCropActive(true);
    };

    // 用户修改裁剪区域时
    const handleCropChange = (newCrop: Crop) => {
        setCrop(newCrop);
        setIsCropActive(true); // 确保裁剪状态激活
    };

    // Automatically trigger crop complete when cropper is shown
    useEffect(() => {
        if (selectedImage && isCropActive && crop.width && crop.height) {
            const imageElement = imgRef.current;
            if (imageElement && imageElement.complete) {
                handleCropComplete(crop);
            } else if (imageElement) {
                imageElement.onload = () => handleCropComplete(crop);
            }
        }
    }, [selectedImage, crop, handleCropComplete, isCropActive]);

    // 增加图片加载后自动设置裁剪区域的效果
    useEffect(() => {
        if (selectedImage && !isCropActive) {
            // 设置默认裁切框为图片中心的一个区域
            setCrop({
                unit: '%',
                width: 60,
                height: 60,
                x: 20,
                y: 20
            });
            setIsCropActive(true);
        }
    }, [selectedImage, isCropActive]);

    // 清除所有状态消息
    const clearMessages = () => {
        setError(null);
        setSuccess(null);
    };

    // 监听showForm变化，当表单关闭时清除输入框内容
    useEffect(() => {
        if (!showForm) {
            setImportData('');
            clearMessages();
        }
    }, [showForm]);

    // 关闭并清除输入
    const handleClose = () => {
        setImportData('');
        clearMessages();
        onClose();
    };

    // 生成模板提示词
    const _templatePrompt = (() => {
        // 不再使用模板生成
        // const templateJson = generateBeanTemplateJson();
        return `提取咖啡豆数据，返回JSON格式，支持批量导入。

单个咖啡豆使用：{...}
多个咖啡豆使用：[{...},{...}]

数据字段：
- id: 留空
- name: 咖啡豆名称（必填）
- capacity: 总容量，纯数字
- remaining: 剩余容量，纯数字（若无标注则与capacity相同）
- price: 价格，纯数字
- roastLevel: 烘焙度（极浅烘焙/浅度烘焙/中浅烘焙/中度烘焙/中深烘焙/深度烘焙）
- roastDate: 烘焙日期，格式YYYY-MM-DD
- flavor: 风味描述标签数组
- origin: 产地
- process: 处理法
- variety: 品种（如瑰夏）
- type: 类型，必须为"单品"或"拼配"
- notes: 备注信息
- startDay: 养豆期天数，纯数字
- endDay: 赏味期天数，纯数字
- blendComponents: 拼配成分，格式[{"percentage":比例(纯数字),"origin":"产地","process":"处理法","variety":"品种"}]

要求：
0. 不要包含任何其他字段以及注释，请严格按照获取到的内容进行JSON格式化
1. 不确定的字段留空或为[]
2. 确保JSON格式有效，数值字段不包含单位`;
    })();

    // 兼容性更好的复制文本方法
    const _copyTextToClipboard = async (text: string) => {
        try {
            // 首先尝试使用现代API
            if (navigator.clipboard && navigator.clipboard.writeText) {
                await navigator.clipboard.writeText(text);
                setSuccess('复制成功');
                setTimeout(() => setSuccess(null), 2000);
                return;
            }

            // 回退方法：创建临时textarea元素
            const textArea = document.createElement('textarea');
            textArea.value = text;

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
                setSuccess('复制成功');
                setTimeout(() => setSuccess(null), 2000);
            } else {
                setError('复制失败');
                setTimeout(() => setError(null), 2000);
            }
        } catch (_err) {
            setError('复制失败');
            setTimeout(() => setError(null), 2000);
        } finally {
            if (document.querySelector('textarea[style*="-999999px"]')) {
                document.body.removeChild(document.querySelector('textarea[style*="-999999px"]')!);
            }
        }
    }

    // 处理导入数据，添加时间戳
    const handleImport = () => {
        if (!importData) {
            setError('请输入要导入的数据');
            return;
        }

        // 确保某些字段始终是字符串类型
        const ensureStringFields = (item: ImportedBean) => {
            const result = { ...item };
            // 确保 capacity 和 remaining 是字符串
            if (result.capacity !== undefined && result.capacity !== null) {
                result.capacity = String(result.capacity);
            }
            if (result.remaining !== undefined && result.remaining !== null) {
                result.remaining = String(result.remaining);
            }
            // 确保 price 是字符串
            if (result.price !== undefined && result.price !== null) {
                result.price = String(result.price);
            }
            return result;
        };

        try {
            // 尝试从文本中提取数据
            import('@/lib/utils/jsonUtils').then(async ({ extractJsonFromText }) => {
                setError(null);
                const beanData = extractJsonFromText(importData);

                if (!beanData) {
                    setError('无法从输入中提取有效数据');
                    return;
                }

                // 处理单个或多个咖啡豆数据
                if (Array.isArray(beanData)) {
                    // 处理多个咖啡豆
                    // 验证每个条目都是咖啡豆
                    if (!beanData.every(item => 'roastLevel' in item)) {
                        setError('部分数据不是有效的咖啡豆信息');
                        return;
                    }
                    
                    // 处理数组中的每个咖啡豆对象
                    const processedBeans = beanData.map(bean => ({
                        ...ensureStringFields(bean as unknown as ImportedBean),
                        timestamp: Date.now()
                    }));
                    
                    try {
                        setSuccess('正在批量导入咖啡豆数据...');
                        await onImport(JSON.stringify(processedBeans));
                        handleClose();
                    } catch (error) {
                        setError('导入失败: ' + (error instanceof Error ? error.message : '未知错误'));
                        setSuccess(null);
                    }
                } else {
                    // 处理单个咖啡豆
                    if (!('roastLevel' in beanData)) {
                        setError('提取的数据不是有效的咖啡豆信息');
                        return;
                    }
                    
                    const dataWithTimestamp = {
                        ...ensureStringFields(beanData as unknown as ImportedBean),
                        timestamp: Date.now()
                    };
                    
                    try {
                        setSuccess('正在导入咖啡豆数据...');
                        await onImport(JSON.stringify([dataWithTimestamp])); // 始终返回数组格式
                        handleClose();
                    } catch (error) {
                        setError('导入失败: ' + (error instanceof Error ? error.message : '未知错误'));
                        setSuccess(null);
                    }
                }
            }).catch(err => {
                setError('数据处理失败: ' + (err instanceof Error ? err.message : '未知错误'));
                setSuccess(null);
            });
        } catch (err) {
            setError('处理数据时出错: ' + (err instanceof Error ? err.message : '未知错误'));
            setSuccess(null);
        }
    };

    // Function to handle image selection from camera or gallery
    const handleImageSelect = (source: 'camera' | 'gallery') => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        if (source === 'camera') {
            input.capture = 'environment';
        }

        input.onchange = (e) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = () => {
                    setSelectedImage(reader.result as string);
                    // 重置裁剪状态
                    setIsCropActive(false);
                    setCroppedImage(null);
                    // 设置默认裁切框为图片中心的一个区域
                    setCrop({
                        unit: '%',
                        width: 60,
                        height: 60,
                        x: 20,
                        y: 20
                    });
                    // 设置裁剪状态为激活
                    setIsCropActive(true);
                };
                reader.readAsDataURL(file);
            }
        };

        input.click();
    };

    // Function to handle image recognition process
    const handleImageRecognition = async () => {
        if (!selectedImage) return;

        setIsUploading(true);
        clearMessages();

        try {
            // 仅当用户进行了裁剪操作且裁剪图片存在时使用裁剪图片
            const imageToUse = (isCropActive && croppedImage) ? croppedImage : selectedImage;
            
            // 将 base64 转换为 Blob
            const response = await fetch(imageToUse);
            const originalBlob = await response.blob();
            
            // 压缩图片
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
            console.error('识别失败:', err);
            if (err instanceof RecognitionError) {
                setError(err.message);
            } else {
                setError('图片识别失败，请重试');
            }
        } finally {
            setIsUploading(false);
            setSelectedImage(null);
            setCroppedImage(null);
            setShowCropper(false);
            setIsCropActive(false);
        }
    };

    // 手动模式切换
    const toggleManualMode = () => {
        setManualMode(!manualMode);
        clearMessages();
    };

    // 渲染上传部分
    const renderUploadSection = () => (
        <div className="p-3 border relative border-neutral-200 dark:border-neutral-700 rounded-md bg-neutral-50 dark:bg-neutral-800">
            <button
                onClick={toggleManualMode}
                className="text-xs px-2 py-1 absolute right-0 top-0 rounded-bl bg-neutral-200 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300"
            >
                {manualMode ? '切换识图' : '切换手动'}
            </button>
            <div className="flex flex-col space-y-3">
                <div className="flex justify-between items-center">
                    <p className="text-xs text-neutral-600 dark:text-neutral-400">
                        {manualMode ? '手动填写咖啡豆信息' : '上传咖啡豆包装图片，自动识别信息'}
                    </p>
                </div>

                {manualMode ? (
                    <div className="space-y-4 py-1">
                        <div className="bg-neutral-100 dark:bg-neutral-800 p-4 rounded-lg text-xs text-neutral-600 dark:text-neutral-400">
                            <ol className="list-decimal pl-5 space-y-1 text-[11px]">
                                <li>准备好咖啡豆商品图、excel表格等</li>
                                <li>
                                    <span>发送至</span>
                                    <a 
                                    href="https://doubao.com/bot/duJYQEFd" 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="pb-1.5 text-[11px] relative text-neutral-600 dark:text-neutral-400"
                                >
                                    <span className="relative underline underline-offset-2 decoration-sky-600 ml-1">豆包定制智能体</span>
                                    <svg viewBox="0 0 24 24" className="inline-block ml-1 w-3 h-3" fill="none" xmlns="http://www.w3.org/2000/svg" stroke="currentColor">
                                        <path d="M7 17L17 7M17 7H7M17 7V17" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                </a></li>
                                <li>将返回的 JSON 数据粘贴到下方文本框</li>
                                
                            </ol>
                            <details className="mt-3 p-2 bg-neutral-50 dark:bg-neutral-900/60 border border-neutral-200 dark:border-neutral-700 rounded-md text-[10px]">
                                <summary className="text-neutral-500 dark:text-neutral-400 cursor-pointer">提示词（点击展开）</summary>
                                <textarea
                                    readOnly
                                    value={_templatePrompt}
                                    className="w-full text-neutral-700 dark:text-neutral-300 text-[10px] p-2 mt-2 bg-neutral-50 dark:bg-neutral-900/60 border border-neutral-200 dark:border-neutral-700 rounded-md h-20 overflow-auto"
                                    onFocus={(e) => e.target.select()}
                                />
                                <div className="flex justify-end mt-1">
                                    <button
                                        onClick={() => {
                                            clearMessages();
                                            _copyTextToClipboard(_templatePrompt);
                                        }}
                                        className="text-neutral-500 dark:text-neutral-400 px-2 py-0.5 rounded-sm text-[10px] bg-neutral-200/80 dark:bg-neutral-800/80 hover:bg-neutral-300 dark:hover:bg-neutral-700 transition-colors"
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
                                            setCrop({
                                                unit: '%',
                                                width: 0,
                                                height: 0,
                                                x: 0,
                                                y: 0
                                            });
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
                                className="px-3 py-1 text-sm border border-neutral-300 dark:border-neutral-600 rounded-sm"
                            >
                                重新选择
                            </button>
                            <button
                                onClick={handleImageRecognition}
                                className="px-3 py-1 text-sm bg-neutral-800 dark:bg-neutral-200 text-neutral-100 dark:text-neutral-800 rounded-sm"
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
                            className="flex-1 py-2 px-4 border border-dashed border-neutral-300 dark:border-neutral-600 rounded-md text-sm text-neutral-600 dark:text-neutral-400"
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
                            className="flex-1 py-2 px-4 border border-dashed border-neutral-300 dark:border-neutral-600 rounded-md text-sm text-neutral-600 dark:text-neutral-400"
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
                                    <h3 className="text-base font-medium">导入咖啡豆数据</h3>
                                    <div className="w-8"></div>
                                </div>

                                {/* 表单内容 */}
                                <div className="space-y-4 mt-2">
                                    {renderUploadSection()}
                                    <div className="flex items-center mb-1">
                                        <p className="text-xs text-neutral-500 dark:text-neutral-400 flex-1">
                                            {manualMode ? 'JSON 数据' : 'JSON 数据'}
                                        </p>
                                    </div>
                                    <textarea
                                        className="w-full h-40 p-3 border border-neutral-300 dark:border-neutral-700 rounded-md bg-transparent focus:border-neutral-800 dark:focus:border-neutral-400 focus:outline-hidden text-neutral-800 dark:text-neutral-200"
                                        placeholder={manualMode ? 
                                            '单个：{"name":"埃塞俄比亚耶加雪菲", "capacity":"200",...}\n多个：[{"name":"耶加雪菲",...},{"name":"瑰夏",...}]' : 
                                            '支持单个或多个咖啡豆数据，多个豆使用数组格式[{},{},...]'}
                                        value={importData}
                                        onChange={(e) => setImportData(e.target.value)}
                                    />
                                    {error && (
                                        <div className="text-sm text-red-500 dark:text-red-400">
                                            {error}
                                        </div>
                                    )}
                                    {success && (
                                        <div className="text-sm text-green-500 dark:text-green-400">
                                            {success}
                                        </div>
                                    )}
                                    <div className="flex justify-end space-x-3 my-4">
                                        <button
                                            onClick={handleClose}
                                            className="px-4 py-2 border border-neutral-300 dark:border-neutral-700 text-neutral-800 dark:text-neutral-200 rounded-md text-sm"
                                        >
                                            取消
                                        </button>
                                        <button
                                            onClick={handleImport}
                                            className="px-4 py-2 bg-neutral-800 dark:bg-neutral-200 text-neutral-100 dark:text-neutral-800 rounded-md text-sm"
                                        >
                                            导入
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