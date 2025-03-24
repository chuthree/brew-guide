'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { generateBeanTemplateJson } from '@/lib/jsonUtils'

interface ImportBeanModalProps {
    showForm: boolean
    onImport: (jsonData: string) => Promise<void>
    onClose: () => void
}

const ImportBeanModal: React.FC<ImportBeanModalProps> = ({
    showForm,
    onImport,
    onClose
}) => {
    // 导入数据的状态
    const [importData, setImportData] = useState('');
    const [error, setError] = useState<string | null>(null);

    // 监听showForm变化，当表单关闭时清除输入框内容
    useEffect(() => {
        if (!showForm) {
            setImportData('');
            if (error) setError(null);
        }
    }, [showForm, error]);

    // 关闭并清除输入
    const handleClose = () => {
        setImportData('');
        if (error) setError(null);
        onClose();
    };

    // 生成模板提示词
    const templatePrompt = (() => {
        const templateJson = generateBeanTemplateJson();
        return `
我有一张咖啡豆的包装袋（或商品详情页）的照片，请根据图片中的信息，帮我提取咖啡豆的详细信息，并按照以下JSON格式输出：

\`\`\`json
${templateJson}
\`\`\`

数据格式说明：
- name: 咖啡豆名称，通常包含产地/品种信息
- price: 价格，纯数字（如68，不要包含货币符号）
- capacity: 包装总容量，纯数字（如200，不要包含单位）
- remaining: 剩余容量，纯数字（如果图片中没有明确标示，请与capacity填相同的值）
- roastLevel: 烘焙程度（浅/中/深）
- roastDate: 烘焙日期
- flavor: 风味描述标签数组
- origin: 咖啡豆原产地
- process: 处理法（如水洗、日晒等）
- variety: 咖啡豆品种
- type: 咖啡豆类型（单品/拼配）
- notes: 其他备注信息

使用说明：
1. 请填充所有可以从图片中辨识的字段
2. 对于无法辨识的字段，请保留为空字符串或空数组
3. flavor数组请填入所有从图片中可识别的风味标签
4. roastDate请按YYYY-MM-DD格式填写
5. remaining与capacity字段：如果包装上只标注了总容量，请在两个字段中填写相同的值
6. 请确保返回的是有效的JSON格式
7. 如果有多个咖啡豆，可以返回JSON数组格式，例如：[${templateJson}, ${templateJson}]

请在回复中只包含JSON内容，不需要其他解释，这样我可以直接复制使用。
`;
    })();

    // 兼容性更好的复制文本方法
    const copyTextToClipboard = async (text: string) => {
        // 首先尝试使用现代API
        if (navigator.clipboard && navigator.clipboard.writeText) {
            return navigator.clipboard.writeText(text);
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

        return new Promise<void>((resolve, reject) => {
            try {
                const successful = document.execCommand('copy');
                if (successful) {
                    resolve();
                } else {
                    reject(new Error('复制命令执行失败'));
                }
            } catch (_err) {
                reject(_err);
            } finally {
                document.body.removeChild(textArea);
            }
        });
    }

    // 处理导入数据，添加时间戳
    const handleImport = () => {
        if (!importData) {
            setError('请输入要导入的数据');
            return;
        }

        try {
            // 解析JSON数据
            const jsonData = JSON.parse(importData);

            // 如果是数组，为每个对象添加时间戳
            if (Array.isArray(jsonData)) {
                const dataWithTimestamp = jsonData.map(item => ({
                    ...item,
                    timestamp: Date.now()
                }));
                onImport(JSON.stringify(dataWithTimestamp))
                    .then(() => {
                        // 导入成功后清空输入框
                        setImportData('');
                        setError(null);
                    })
                    .catch(() => {
                        setError('导入失败，请重试');
                    });
            } else {
                // 为单个对象添加时间戳
                const dataWithTimestamp = {
                    ...jsonData,
                    timestamp: Date.now()
                };
                onImport(JSON.stringify(dataWithTimestamp))
                    .then(() => {
                        // 导入成功后清空输入框
                        setImportData('');
                        setError(null);
                    })
                    .catch(() => {
                        setError('导入失败，请重试');
                    });
            }
        } catch {
            setError('JSON格式错误，请检查导入的数据');
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
                            handleClose()
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
                        className="absolute inset-x-0 bottom-0 max-h-[75vh] overflow-hidden rounded-t-2xl bg-neutral-50 dark:bg-neutral-900 shadow-xl"
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
                            className="px-6 px-safe pb-6 pb-safe overflow-auto max-h-[calc(75vh-40px)]"
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
                                    <div className="flex flex-col space-y-2">
                                        <div className="p-3 border border-neutral-200 dark:border-neutral-700 rounded-md bg-neutral-50 dark:bg-neutral-800/50">
                                            <div className="flex justify-between items-center">
                                                <p className="text-xs text-neutral-600 dark:text-neutral-400">
                                                    使用AI识别导入咖啡豆信息(推荐使用豆包)
                                                </p>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        copyTextToClipboard(templatePrompt)
                                                            .then(() => {
                                                                setError('✅ 提示词已复制到剪贴板，请打开豆包应用，将此提示词和咖啡豆商品页一起发送');
                                                                setTimeout(() => setError(null), 3000); // 3秒后自动清除提示
                                                            })
                                                            .catch(() => {
                                                                setError('❌ 复制失败，请手动复制');
                                                                setTimeout(() => setError(null), 3000); // 3秒后自动清除提示
                                                            });
                                                    }}
                                                    className="text-xs text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300"
                                                >
                                                    复制提示词
                                                </button>
                                            </div>
                                        </div>
                                        <p className="text-xs text-neutral-500 dark:text-neutral-500">
                                            粘贴咖啡豆数据（支持分享的文本格式或JSON格式）：
                                        </p>
                                    </div>
                                    <textarea
                                        className="w-full h-40 p-3 border border-neutral-300 dark:border-neutral-700 rounded-md bg-transparent focus:border-neutral-800 dark:focus:border-neutral-400 focus:outline-none text-neutral-800 dark:text-neutral-200"
                                        placeholder='支持粘贴分享的文本或JSON格式，例如："【咖啡豆】埃塞俄比亚耶加雪菲"或{"name":"埃塞俄比亚耶加雪菲",...}'
                                        value={importData}
                                        onChange={(e) => setImportData(e.target.value)}
                                    />
                                    {error && (
                                        <div className="text-sm text-red-500 dark:text-red-400">
                                            {error}
                                        </div>
                                    )}
                                    <div className="flex justify-end space-x-3 mt-4">
                                        <button
                                            onClick={handleClose}
                                            className="px-4 py-2 border border-neutral-300 dark:border-neutral-700 text-neutral-800 dark:text-neutral-200 rounded-md text-sm"
                                        >
                                            取消
                                        </button>
                                        <button
                                            onClick={handleImport}
                                            className="px-4 py-2 bg-neutral-800 dark:bg-neutral-200 text-white dark:text-neutral-800 rounded-md text-sm"
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

export default ImportBeanModal 