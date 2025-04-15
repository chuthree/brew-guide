'use client'

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CustomEquipment, Method } from '@/lib/config';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { showToast } from './ui/toast';

interface EquipmentShareModalProps {
    isOpen: boolean;
    onClose: () => void;
    equipment: CustomEquipment;
    methods: Method[];
}

const EquipmentShareModal: React.FC<EquipmentShareModalProps> = ({
    isOpen,
    onClose,
    equipment,
    methods
}) => {
    const [selectedMethods, setSelectedMethods] = useState<string[]>([]);
    const [isSharing, setIsSharing] = useState(false);
    const isNative = Capacitor.isNativePlatform();
    const isIOS = Capacitor.getPlatform() === 'ios';
    const isAndroid = Capacitor.getPlatform() === 'android';

    // Reset selected methods when modal opens
    useEffect(() => {
        if (isOpen) {
            setSelectedMethods([]);
        }
    }, [isOpen]);

    // Handle select all toggle
    const handleSelectAll = () => {
        if (selectedMethods.length === methods.length) {
            // If all are selected, deselect all
            setSelectedMethods([]);
        } else {
            // Otherwise select all
            setSelectedMethods(methods.map(method => method.id || method.name));
        }
    };

    // Toggle a single method selection
    const handleToggleMethod = (methodId: string) => {
        if (selectedMethods.includes(methodId)) {
            setSelectedMethods(selectedMethods.filter(id => id !== methodId));
        } else {
            setSelectedMethods([...selectedMethods, methodId]);
        }
    };

    // Handle share button click
    const handleShare = async () => {
        try {
            setIsSharing(true);

            // Prepare export data
            const exportData = {
                equipment: {
                    ...equipment,
                    // 确保包含自定义注水动画配置
                    customPourAnimations: equipment.customPourAnimations || []
                },
                methods: methods.length > 0 ? methods.filter(method =>
                    selectedMethods.includes(method.id || method.name)
                ).map(method => ({
                    ...method,
                    // 不再删除id，保留原有ID以确保关联性
                    // id: undefined
                })) : []
            };

            // 不再删除设备ID，保留原始ID
            // delete (exportData.equipment as Partial<CustomEquipment>).id;

            // Convert to JSON
            const jsonData = JSON.stringify(exportData, null, 2);

            // Generate filename based on equipment name
            const fileName = `brew-guide-equipment-${equipment.name.replace(/\s+/g, '-')}.json`;

            if (isNative) {
                try {
                    // Write file to temporary directory
                    await Filesystem.writeFile({
                        path: fileName,
                        data: jsonData,
                        directory: Directory.Cache,
                        encoding: Encoding.UTF8
                    });

                    // Get URI for the temporary file
                    const uriResult = await Filesystem.getUri({
                        path: fileName,
                        directory: Directory.Cache
                    });

                    // Use share functionality to let user choose save location
                    await Share.share({
                        title: '分享器具',
                        text: '请选择保存位置',
                        url: uriResult.uri,
                        dialogTitle: '分享器具'
                    });

                    // Clean up temporary file
                    await Filesystem.deleteFile({
                        path: fileName,
                        directory: Directory.Cache
                    });

                    showToast({
                        type: 'success',
                        title: '器具已成功导出',
                        duration: 2000
                    });

                    onClose();
                } catch (_error) {
                    showToast({
                        type: 'error',
                        title: '导出失败，请重试',
                        duration: 2000
                    });
                }
            } else {
                // Web platform handling
                const blob = new Blob([jsonData], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = fileName;
                document.body.appendChild(a);
                a.click();

                // Clean up
                setTimeout(() => {
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                }, 100);

                showToast({
                    type: 'success',
                    title: '器具已成功导出',
                    duration: 2000
                });

                onClose();
            }
        } catch (_error) {
            showToast({
                type: 'error',
                title: '导出失败，请重试',
                duration: 2000
            });
        } finally {
            setIsSharing(false);
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.265 }}
                    className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm"
                    onClick={(e) => {
                        if (e.target === e.currentTarget) {
                            onClose();
                        }
                    }}
                >
                    <motion.div
                        initial={{ y: '100%' }}
                        animate={{ y: 0 }}
                        exit={{ y: '100%' }}
                        transition={{
                            type: "tween",
                            ease: [0.33, 1, 0.68, 1], // easeOutCubic
                            duration: 0.265
                        }}
                        style={{
                            willChange: "transform"
                        }}
                        className={`absolute inset-x-0 bottom-0 max-w-[500px] mx-auto max-h-[85vh] overflow-auto rounded-t-2xl bg-neutral-50 dark:bg-neutral-900 shadow-xl ${isAndroid ? 'android-modal' : ''} ${isIOS ? 'ios-modal' : ''}`}
                    >
                        {/* 拖动条 */}
                        <div className="sticky top-0 z-10 flex justify-center py-2 bg-neutral-50 dark:bg-neutral-900">
                            <div className="h-1.5 w-12 rounded-full bg-neutral-200 dark:bg-neutral-700" />
                        </div>

                        {/* 内容 */}
                        <div className="px-6 px-safe pb-6 pb-safe">
                            {/* 标题栏 */}
                            <div className="flex items-center justify-between py-4 mb-2">
                                <h3 className="text-base font-medium text-neutral-900 dark:text-neutral-100">
                                    分享 {equipment.name}
                                </h3>
                                <button
                                    onClick={onClose}
                                    className="p-1.5 text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800"
                                >
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                        <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                </button>
                            </div>

                            {/* 方案选择 */}
                            {methods.length > 0 ? (
                                <div className="space-y-3">
                                    <div className="flex justify-between items-center">
                                        <span className="text-sm text-neutral-600 dark:text-neutral-400">
                                            选择要包含的自定义方案
                                        </span>
                                        <button
                                            onClick={handleSelectAll}
                                            className="text-xs text-blue-600 dark:text-blue-400 hover:opacity-80"
                                        >
                                            {selectedMethods.length === methods.length ? '取消全选' : '全选'}
                                        </button>
                                    </div>

                                    <div className="space-y-2">
                                        {methods.map(method => (
                                            <label
                                                key={method.id || method.name}
                                                className="flex items-center p-2.5 rounded-lg bg-neutral-100/60 dark:bg-neutral-800/30 hover:opacity-80 cursor-pointer"
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={selectedMethods.includes(method.id || method.name)}
                                                    onChange={() => handleToggleMethod(method.id || method.name)}
                                                    className="w-4 h-4 rounded border-neutral-300 dark:border-neutral-600 text-blue-600 dark:text-blue-400 focus:ring-blue-500 dark:focus:ring-blue-400"
                                                />
                                                <span className="ml-3 text-sm text-neutral-800 dark:text-neutral-200">
                                                    {method.name}
                                                </span>
                                            </label>
                                        ))}
                                    </div>

                                    <p className="text-xs text-neutral-500 dark:text-neutral-500 bg-neutral-100/60 dark:bg-neutral-800/30 p-2.5 rounded-lg">
                                        通用方案会根据器具类型自动加载，无需包含
                                    </p>
                                </div>
                            ) : (
                                <div className="p-4 bg-neutral-100/60 dark:bg-neutral-800/30 rounded-lg">
                                    <p className="text-sm text-neutral-600 dark:text-neutral-400 text-center">
                                        该器具没有自定义方案
                                    </p>
                                </div>
                            )}

                            {/* 按钮 */}
                            <button
                                onClick={handleShare}
                                disabled={isSharing}
                                className={`w-full mt-6 py-2.5 px-4 rounded-lg transition-colors ${isSharing
                                    ? 'bg-neutral-400 dark:bg-neutral-700 cursor-not-allowed'
                                    : 'bg-neutral-800 dark:bg-neutral-200 text-neutral-100 dark:text-neutral-800 hover:opacity-80'
                                    }`}
                            >
                                {isSharing ? '导出中...' : '导出为文件'}
                            </button>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default EquipmentShareModal;
