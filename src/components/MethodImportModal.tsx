'use client'

import React, { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { type Method, type CustomEquipment } from '@/lib/config'

interface MethodImportModalProps {
    showForm: boolean
    onImport: (method: Method) => void
    onClose: () => void
    existingMethods?: Method[]
    customEquipment?: CustomEquipment
}

const MethodImportModal: React.FC<MethodImportModalProps> = ({
    showForm,
    onImport,
    onClose,
    existingMethods = [],
    customEquipment
}) => {
    // 导入数据的状态
    const [importData, setImportData] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

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
        return `提取咖啡冲煮方案数据，返回JSON格式。

格式要求：
{
  "name": "方案名称",
  "params": {
    "coffee": "咖啡粉量，如15g",
    "water": "水量，如225g",
    "ratio": "比例，如1:15",
    "grindSize": "研磨度，如中细",
    "temp": "水温，如92°C",
    "stages": [
      {
        "time": 分钟*60+秒钟，纯数字,
        "pourTime": 注水时间，纯数字，单位秒,
        "label": "步骤操作简述（如焖蒸(绕圈注水)、绕圈注水、中心注水）",
        "water": "该步骤水量，如40g",
        "detail": "描述注水方式，如中心向外缓慢画圈注水，均匀萃取咖啡风味",
        "pourType": "注水方式严格按照center（中心注水）、circle（绕圈注水）、ice（冰水）、other（其他）"
      }
    ]
  }
}

要求：
0. 所有字段必须填写
1. stages数组必须包含至少一个步骤
2. time表示该步骤从开始到结束的总时间（秒），pourTime表示注水时长（秒）
3. 步骤的time值必须按递增顺序排列
4. 确保JSON格式有效，数值字段不包含单位

提示：一般焖蒸注水方式是center，label就是“焖蒸(绕圈注水)”，
`;
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

    // 处理导入数据
    const handleImport = () => {
        if (!importData) {
            setError('请输入要导入的数据');
            return;
        }

        try {
            // 尝试从文本中提取数据
            import('@/lib/jsonUtils').then(async ({ extractJsonFromText }) => {
                setError(null);
                // 解析导入数据，传递自定义器具配置
                const method = extractJsonFromText(importData, customEquipment) as Method;

                if (!method) {
                    setError('无法从输入中提取有效数据');
                    return;
                }

                // 验证方法对象是否有必要的字段
                if (!method.name) {
                    // 尝试获取method字段，使用接口扩展
                    interface ExtendedMethod extends Method {
                        method?: string;
                    }
                    const extendedMethod = method as ExtendedMethod;
                    if (typeof extendedMethod.method === 'string') {
                        // 如果有method字段，使用它作为name
                        method.name = extendedMethod.method;
                    } else {
                        setError('冲煮方案缺少名称');
                        return;
                    }
                }

                // 验证params
                if (!method.params) {
                    setError('冲煮方案格式不完整，缺少参数字段');
                    return;
                }

                // 验证stages
                if (!method.params.stages || method.params.stages.length === 0) {
                    setError('冲煮方案格式不完整，缺少冲煮步骤');
                    return;
                }

                // 检查是否已存在同名方案
                const existingMethod = existingMethods.find(m => m.name === method.name);
                if (existingMethod) {
                    setError(`已存在同名方案"${method.name}"，请修改后再导入`);
                    return;
                }

                // 确保method对象完全符合Method接口
                const validMethod: Method = {
                    id: method.id || `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                    name: method.name,
                    params: {
                        coffee: method.params.coffee || '15g',
                        water: method.params.water || '225g',
                        ratio: method.params.ratio || '1:15',
                        grindSize: method.params.grindSize || '中细',
                        temp: method.params.temp || '92°C',
                        videoUrl: method.params.videoUrl || '',
                        stages: method.params.stages,
                    }
                };

                // 导入方案
                onImport(validMethod);
                // 导入成功后清空输入框和错误信息
                setImportData('');
                setError(null);
                // 关闭模态框
                handleClose();
            }).catch(err => {
                setError('解析数据失败: ' + (err instanceof Error ? err.message : '未知错误'));
            });
        } catch (err) {
            setError('导入失败: ' + (err instanceof Error ? err.message : '未知错误'));
        }
    };

    // 渲染上传部分
    const renderUploadSection = () => (
        <div className="p-3 border border-neutral-200 dark:border-neutral-700 rounded-md bg-neutral-50 dark:bg-neutral-800">
            <div className="space-y-3 py-1">
                <div className="bg-neutral-100 dark:bg-neutral-800 p-3 rounded-md text-xs text-neutral-600 dark:text-neutral-400">
                    <p className="mb-2">使用《豆包》AI获取冲煮方案JSON数据：</p>
                    <ol className="list-decimal pl-6 space-y-1">
                        <li>把冲煮方案说明或截图发送给AI</li>
                        <li>将下方提示词与图片一并发送</li>
                        <li>将返回的JSON数据复制到下方文本框</li>
                    </ol>
                </div>
                <div className="bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 p-3 rounded-md text-xs">
                    <div className="flex justify-between mb-1">
                        <span className="text-neutral-500 dark:text-neutral-400">提示词：</span>
                        <button
                            onClick={() => {
                                clearMessages();
                                _copyTextToClipboard(_templatePrompt);
                            }}
                            className="text-neutral-500 dark:text-neutral-400 px-1.5 py-0.5 rounded text-[10px] border border-neutral-300 dark:border-neutral-700"
                        >
                            复制
                        </button>
                    </div>
                    <p className="text-neutral-800 dark:text-neutral-200 text-[10px] line-clamp-2">
                        提取咖啡冲煮方案数据，返回JSON格式。包含方案名称、参数和冲煮步骤...
                    </p>
                </div>
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
                            className="px-6  pb-safe-bottom overflow-auto max-h-[calc(90vh-40px)]"
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
                                    <h3 className="text-base font-medium">导入冲煮方案</h3>
                                    <div className="w-8"></div>
                                </div>

                                {/* 表单内容 */}
                                <div className="space-y-4 mt-2">
                                    {renderUploadSection()}
                                    <div className="flex flex-col space-y-2">
                                        <p className="text-xs text-neutral-500 dark:text-neutral-500">
                                            粘贴冲煮方案（支持分享的文本格式或JSON格式）：
                                        </p>
                                    </div>
                                    <textarea
                                        className="w-full h-40 p-3 border border-neutral-300 dark:border-neutral-700 rounded-md bg-transparent focus:border-neutral-800 dark:focus:border-neutral-400 focus:outline-none text-neutral-800 dark:text-neutral-200"
                                        placeholder='支持粘贴分享的文本或各种JSON格式，如{"name":"改良分段式一刀流",...} 或带有代码块的JSON'
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

export default MethodImportModal 