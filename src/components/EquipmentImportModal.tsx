'use client'

import React, { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { type CustomEquipment, type Method } from '@/lib/config'
import { Capacitor } from '@capacitor/core'
import { FilePicker } from '@capawesome/capacitor-file-picker'
import { showToast } from './ui/toast'

interface EquipmentImportModalProps {
    showForm: boolean
    onImport: (equipment: CustomEquipment, methods?: Method[]) => void
    onClose: () => void
    existingEquipments?: CustomEquipment[]
}

const EquipmentImportModal: React.FC<EquipmentImportModalProps> = ({
    showForm,
    onImport,
    onClose,
    existingEquipments = []
}) => {
    // 导入数据的状态
    const [importData, setImportData] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [isImporting, setIsImporting] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const dropZoneRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const isNative = Capacitor.isNativePlatform();

    // 监听showForm变化，当表单关闭时清除输入框内容
    useEffect(() => {
        if (!showForm) {
            setImportData('');
            setError(null);
            setIsImporting(false);
            setIsDragging(false);
        }
    }, [showForm]);

    // 设置拖放事件监听器
    useEffect(() => {
        const dropZone = dropZoneRef.current;
        if (!dropZone || isNative) return;

        const handleDragOver = (e: DragEvent) => {
            e.preventDefault();
            e.stopPropagation();
            setIsDragging(true);
        };

        const handleDragEnter = (e: DragEvent) => {
            e.preventDefault();
            e.stopPropagation();
            setIsDragging(true);
        };

        const handleDragLeave = (e: DragEvent) => {
            e.preventDefault();
            e.stopPropagation();
            setIsDragging(false);
        };

        const handleDrop = (e: DragEvent) => {
            e.preventDefault();
            e.stopPropagation();
            setIsDragging(false);

            if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
                const file = e.dataTransfer.files[0];
                handleFile(file);
            } else if (e.dataTransfer?.items && e.dataTransfer.items.length > 0) {
                // 尝试获取文本内容
                for (let i = 0; i < e.dataTransfer.items.length; i++) {
                    if (e.dataTransfer.items[i].kind === 'string') {
                        e.dataTransfer.items[i].getAsString((text) => {
                            setImportData(text);
                        });
                        break;
                    }
                }
            }
        };

        dropZone.addEventListener('dragover', handleDragOver);
        dropZone.addEventListener('dragenter', handleDragEnter);
        dropZone.addEventListener('dragleave', handleDragLeave);
        dropZone.addEventListener('drop', handleDrop);

        return () => {
            dropZone.removeEventListener('dragover', handleDragOver);
            dropZone.removeEventListener('dragenter', handleDragEnter);
            dropZone.removeEventListener('dragleave', handleDragLeave);
            dropZone.removeEventListener('drop', handleDrop);
        };
    }, [isNative, showForm]);

    // 关闭并清除输入
    const handleClose = () => {
        setImportData('');
        setError(null);
        onClose();
    };

    // 处理文件选择按钮点击
    const handleFileButtonClick = () => {
        if (isNative) {
            handleNativeFilePicker();
        } else if (fileInputRef.current) {
            fileInputRef.current.click();
        }
    };

    // 处理原生平台的文件选择
    const handleNativeFilePicker = async () => {
        try {
            setIsImporting(true);
            setError(null);

            // 使用FilePicker插件选择文件
            const result = await FilePicker.pickFiles({
                types: ['application/json']
            });

            if (result.files.length > 0) {
                const file = result.files[0];
                // 读取文件内容
                if (file.path) {
                    const response = await fetch(file.path);
                    const text = await response.text();
                    processImportData(text);
                } else {
                    setError('无法读取文件');
                    setIsImporting(false);
                }
            } else {
                setIsImporting(false);
            }
        } catch (_error) {
            setError('选择文件失败，请重试');
            setIsImporting(false);
        }
    };

    // 处理文件输入变化（Web平台）
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) {
            setIsImporting(false);
            return;
        }
        handleFile(file);
    };

    // 处理文件
    const handleFile = (file: File) => {
        if (!file.name.endsWith('.json') && file.type !== 'application/json') {
            setError('请选择JSON文件');
            return;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
            const text = event.target?.result as string;
            processImportData(text);
        };
        reader.onerror = () => {
            setError('读取文件失败，请重试');
            setIsImporting(false);
        };
        reader.readAsText(file);
    };

    // 处理导入数据
    const processImportData = (jsonText: string) => {
        try {
            setIsImporting(true);
            // 尝试从文本中提取数据
            import('@/lib/jsonUtils').then(async ({ extractJsonFromText }) => {
                setError(null);
                try {
                    // 解析导入数据
                    const data = extractJsonFromText(jsonText);

                    // 检查数据是否有效
                    if (!data) {
                        setError('无效的导入数据格式');
                        setIsImporting(false);
                        return;
                    }

                    // 检查是否是有效的器具导出文件
                    const exportData = data as { equipment?: CustomEquipment; methods?: Method[] };
                    if (!exportData.equipment) {
                        setError('无效的器具导出文件格式，缺少equipment字段');
                        setIsImporting(false);
                        return;
                    }

                    const equipment = exportData.equipment;

                    // 检查是否已存在同名器具
                    const existingEquipment = existingEquipments.find(e => e.name === equipment.name);
                    if (existingEquipment) {
                        setError(`已存在同名器具"${equipment.name}"，请修改后再导入`);
                        setIsImporting(false);
                        return;
                    }

                    console.log('导入器具数据:', equipment);
                    console.log('导入方案数据:', exportData.methods);

                    // 确保equipment对象完全符合CustomEquipment接口
                    const validEquipment: CustomEquipment = {
                        // 优先使用原始ID，如果没有则生成新ID
                        id: equipment.id || `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
                        name: equipment.name,
                        description: equipment.description || '',
                        isCustom: true,
                        animationType: equipment.animationType,
                        hasValve: equipment.hasValve || false,
                        customShapeSvg: equipment.customShapeSvg,
                        customValveSvg: equipment.customValveSvg,
                        customValveOpenSvg: equipment.customValveOpenSvg,
                        customPourAnimations: equipment.customPourAnimations || [],
                    };

                    console.log('处理后的器具数据:', validEquipment);

                    // 提取方案（如果有）
                    const methods = exportData.methods && Array.isArray(exportData.methods)
                        ? exportData.methods as Method[]
                        : undefined;

                    console.log('最终要导入的方案数量:', methods?.length || 0);

                    // 导入器具和方案
                    onImport(validEquipment, methods);

                    // 显示成功消息
                    showToast({
                        type: 'success',
                        title: '器具导入成功',
                        duration: 2000
                    });

                    // 关闭模态框
                    handleClose();
                } catch (error) {
                    setError((error as Error).message || '处理导入数据失败');
                    setIsImporting(false);
                }
            });
        } catch (error) {
            setError((error as Error).message || '导入失败');
            setIsImporting(false);
        }
    };

    return (
        <AnimatePresence>
            {showForm && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.265 }}
                    className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm"
                    onClick={(e) => {
                        if (e.target === e.currentTarget) {
                            handleClose();
                        }
                    }}
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
                        className={`absolute inset-x-0 bottom-0 max-w-[500px] mx-auto max-h-[90vh] overflow-hidden rounded-t-2xl bg-neutral-50 dark:bg-neutral-900 shadow-xl`}
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
                            className="px-6  pb-safe-bottom overflow-auto max-h-[calc(90vh-40px)]"
                        >
                            {/* 标题栏 */}
                            <div className="flex items-center justify-between py-4 mb-4">
                                <button
                                    type="button"
                                    onClick={handleClose}
                                    className="p-1.5 text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800"
                                >
                                    <svg
                                        width="16"
                                        height="16"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        xmlns="http://www.w3.org/2000/svg"
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
                                <h3 className="text-base font-medium text-neutral-900 dark:text-neutral-100">导入器具</h3>
                                <div className="w-8"></div>
                            </div>

                            {/* 拖放区域 */}
                            <div
                                ref={dropZoneRef}
                                className={`relative mb-4 p-6 border-2 border-dashed rounded-lg transition-colors ${isDragging
                                    ? 'border-neutral-800 dark:border-neutral-200 bg-neutral-100/60 dark:bg-neutral-800/30'
                                    : 'border-neutral-300 dark:border-neutral-700 hover:border-neutral-400 dark:hover:border-neutral-600'
                                    }`}
                            >
                                <div className="text-center">
                                    <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-2">
                                        拖放JSON文件到此处，或
                                    </p>
                                    <button
                                        onClick={handleFileButtonClick}
                                        className="inline-flex items-center justify-center px-4 py-2 text-sm text-neutral-800 dark:text-neutral-200 bg-neutral-100/60 dark:bg-neutral-800/30 rounded-lg hover:opacity-80 transition-opacity"
                                    >
                                        <svg
                                            className="w-4 h-4 mr-2"
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            xmlns="http://www.w3.org/2000/svg"
                                        >
                                            <path
                                                d="M12 4v16m0-16l-4 4m4-4l4 4"
                                                stroke="currentColor"
                                                strokeWidth="2"
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                            />
                                        </svg>
                                        选择文件
                                    </button>
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept=".json,application/json"
                                        onChange={handleFileChange}
                                        className="hidden"
                                    />
                                </div>
                            </div>

                            {/* 分隔线 */}
                            <div className="flex items-center mb-4">
                                <div className="flex-grow h-px bg-neutral-200 dark:bg-neutral-700"></div>
                                <span className="px-3 text-xs text-neutral-500 dark:text-neutral-400">或粘贴JSON数据</span>
                                <div className="flex-grow h-px bg-neutral-200 dark:bg-neutral-700"></div>
                            </div>

                            {/* 文本输入区域 */}
                            <div className="space-y-4">
                                <textarea
                                    className="w-full h-40 p-3 text-sm border rounded-lg bg-neutral-100/60 dark:bg-neutral-800/30 border-neutral-200 dark:border-neutral-700 focus:border-neutral-800 dark:focus:border-neutral-200 focus:outline-none text-neutral-800 dark:text-neutral-200 placeholder-neutral-500 dark:placeholder-neutral-400 transition-colors"
                                    placeholder='粘贴器具数据，支持JSON格式，如{"name":"自定义V60","animationType":"v60",...}'
                                    value={importData}
                                    onChange={(e) => setImportData(e.target.value)}
                                />

                                {/* 错误提示 */}
                                {error && (
                                    <div className="p-3 rounded-lg bg-red-100/60 dark:bg-red-900/30 text-sm text-red-600 dark:text-red-400">
                                        {error}
                                    </div>
                                )}

                                {/* 导入按钮 */}
                                <button
                                    onClick={() => processImportData(importData)}
                                    disabled={!importData.trim() || isImporting}
                                    className={`w-full py-2.5 px-4 rounded-lg transition-colors ${!importData.trim() || isImporting
                                        ? 'bg-neutral-400 dark:bg-neutral-700 cursor-not-allowed'
                                        : 'bg-neutral-800 dark:bg-neutral-200 text-neutral-100 dark:text-neutral-800 hover:opacity-80'
                                        }`}
                                >
                                    {isImporting ? '导入中...' : '导入'}
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default EquipmentImportModal;
