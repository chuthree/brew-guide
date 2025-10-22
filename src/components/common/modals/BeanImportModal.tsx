'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronLeft, ChevronRight, Clipboard, Code, ExternalLink, ScanLine } from 'lucide-react'
import BeanSearchModal from './BeanSearchModal'
import QRScannerModal from '@/components/coffee-bean/Scanner/QRScannerModal'
import type { CoffeeBean } from '@/types/app'
import { getChildPageStyle } from '@/lib/navigation/pageTransition'

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

const BeanImportModal: React.FC<BeanImportModalProps> = ({
    showForm,
    onImport,
    onClose
}) => {
    // 状态管理
    const [importData, setImportData] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [currentMode, setCurrentMode] = useState<'buttons' | 'input'>('buttons');
    const [inputType, setInputType] = useState<'clipboard' | 'json' | 'search' | 'qr'>('clipboard');
    // 搜索模态框状态
    const [showSearchModal, setShowSearchModal] = useState(false);
    // 二维码扫描模态框状态
    const [showQRScannerModal, setShowQRScannerModal] = useState(false);
    
    // 转场动画状态
    const [shouldRender, setShouldRender] = useState(false)
    const [isVisible, setIsVisible] = useState(false)

    // 清除消息状态
    const clearMessages = useCallback(() => {
        setError(null);
        setSuccess(null);
    }, []);

    // 重置所有状态
    const resetAllStates = useCallback(() => {
        setImportData('');
        setCurrentMode('buttons');
        setInputType('clipboard');
        setShowSearchModal(false);
        clearMessages();
    }, [clearMessages]);

    // 关闭处理
    const handleClose = useCallback(() => {
        setIsVisible(false) // 触发退出动画
        window.dispatchEvent(new CustomEvent('beanImportClosing')) // 通知父组件
        
        setTimeout(() => {
            resetAllStates();
            
            // 如果历史栈中有我们添加的模态框记录，先返回一步
            if (window.history.state?.modal === 'bean-import') {
                window.history.back()
            } else {
                // 否则直接调用 onClose
                onClose()
            }
        }, 350) // 350ms 后真正关闭
    }, [resetAllStates, onClose]);

    // 处理显示/隐藏动画
    useEffect(() => {
        if (showForm) {
            setShouldRender(true)
            // 使用 requestAnimationFrame 触发动画（比 setTimeout 更快更流畅）
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    setIsVisible(true)
                })
            })
        } else {
            setIsVisible(false)
            const timer = setTimeout(() => {
                setShouldRender(false)
            }, 350) // 与动画时长匹配
            return () => clearTimeout(timer)
        }
    }, [showForm])

    // 历史栈管理 - 支持硬件返回键和浏览器返回按钮
    useEffect(() => {
        if (!showForm) return

        // 添加模态框历史记录
        window.history.pushState({ modal: 'bean-import' }, '')

        // 监听返回事件
        const handlePopState = (event: PopStateEvent) => {
            // 检查是否是我们的模态框状态
            if (event.state?.modal !== 'bean-import') {
                // 如果当前还显示模态框，说明用户按了返回键，关闭模态框
                if (showForm) {
                    handleClose()
                }
            }
        }

        window.addEventListener('popstate', handlePopState)

        return () => {
            window.removeEventListener('popstate', handlePopState)
        }
    }, [showForm, handleClose])

    // 表单关闭时重置状态
    useEffect(() => {
        if (!showForm) {
            resetAllStates();
        }
    }, [showForm, resetAllStates]);



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

            // 验证数据 - 只验证是否有咖啡豆名称
            if (!dataArray.every(item => 
                typeof item === 'object' && item !== null && 
                'name' in item && typeof (item as Record<string, unknown>).name === 'string' &&
                ((item as Record<string, unknown>).name as string).trim() !== ''
            )) {
                setError(isArray ? '部分数据缺少咖啡豆名称' : '数据缺少咖啡豆名称');
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



    // 从搜索组件选择咖啡豆
    const handleSelectFromSearch = useCallback((bean: CoffeeBean) => {
        setImportData(JSON.stringify(bean, null, 2));
        setSuccess('✨ 已选择咖啡豆，请检查信息是否正确');
        setInputType('search');
        setCurrentMode('input');
    }, []);

    // 从二维码扫描获取咖啡豆
    const handleScanSuccess = useCallback((bean: Partial<CoffeeBean>) => {
        setImportData(JSON.stringify(bean, null, 2));
        setSuccess('✨ 已扫描二维码，请检查信息是否正确');
        setInputType('qr');
        setCurrentMode('input');
        setShowQRScannerModal(false); // 关闭扫描器模态框
    }, []);

    // 处理剪贴板识别
    const handleClipboardRecognition = useCallback(async () => {
        clearMessages();
        setInputType('clipboard');
        setCurrentMode('input');
        
        try {
            const clipboardText = await navigator.clipboard.readText();
            if (!clipboardText.trim()) {
                setError('剪贴板为空');
                return;
            }
            
            // 尝试提取JSON数据
            const { extractJsonFromText } = await import('@/lib/utils/jsonUtils');
            const beanData = extractJsonFromText(clipboardText);
            
            if (beanData) {
                setImportData(JSON.stringify(beanData, null, 2));
                setSuccess('✨ 从剪贴板识别到咖啡豆数据');
            } else {
                setImportData(clipboardText);
                setSuccess('已粘贴剪贴板内容，请检查数据格式');
            }
        } catch (_error) {
            setError('无法访问剪贴板，请手动粘贴数据');
        }
    }, [clearMessages]);

    // 处理搜索咖啡豆
    // const handleSearchBeans = useCallback(() => {
    //     setShowSearchModal(true);
    // }, []);

    // 处理扫描二维码
    const handleScanQRCode = useCallback(() => {
        setShowQRScannerModal(true);
    }, []);

    // 处理输入JSON
    const handleInputJSON = useCallback(() => {
        clearMessages();
        setInputType('json');
        setCurrentMode('input');
    }, [clearMessages]);

    // 返回到按钮界面
    const handleBackToButtons = useCallback(() => {
        setCurrentMode('buttons');
        setImportData('');
        clearMessages();
    }, [clearMessages]);

    // 重新识别剪切板
    const handleRetryClipboard = useCallback(async () => {
        await handleClipboardRecognition();
    }, [handleClipboardRecognition]);





    return (
        <>
            {shouldRender && (
                <div
                    className="fixed inset-0 bg-neutral-50 dark:bg-neutral-900 z-[60] flex flex-col max-w-[500px] mx-auto"
                    style={getChildPageStyle(isVisible)}
                >
                    {/* 头部 - 只有左上角返回按钮 */}
                    <div className="flex items-center px-4 py-4 pt-safe-top">
                        <button
                            onClick={handleClose}
                            className="flex items-center justify-center w-8 h-8 rounded-full text-neutral-800 dark:text-white hover:opacity-80 transition-opacity"
                        >
                            <ChevronLeft className="w-5 h-5" />
                        </button>
                    </div>

                    {/* 内容区域 */}
                    <div 
                        className="flex-1 mt-16 px-6 pb-safe-bottom"
                        style={{
                            // 正常情况下允许垂直滚动
                            overflowY: 'auto',
                            // 使用 CSS 来处理触摸行为
                            touchAction: 'pan-y pinch-zoom'
                        }}
                    >
                        {/* 大标题 */}
                        <div className="mb-8">
                            <h1 className="text-md font-bold text-neutral-800 dark:text-white mb-4">
                                添加咖啡豆
                            </h1>
                            <AnimatePresence mode="wait">
                                <motion.p 
                                    key={currentMode}
                                    initial={{ opacity: 0, x: 5 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -5 }}
                                    transition={{ duration: 0.2, ease: "easeInOut" }}
                                    className='text-sm text-neutral-600 dark:text-neutral-400'
                                >
                                    {currentMode === 'buttons' ? (
                                        <>
                                            <span>将包含咖啡豆信息的图片发送至</span>
                                            <a 
                                                href="https://doubao.com/bot/duJYQEFd" 
                                                target="_blank" 
                                                rel="noopener noreferrer"
                                                className="ml-1 text-neutral-800 dark:text-white hover:opacity-80 inline-flex items-center gap-1 underline underline-offset-2 decoration-neutral-400"
                                            >
                                                豆包定制智能体
                                                <ExternalLink className="w-3 h-3" />
                                            </a>
                                            <span>，并复制返回的 JSON 数据后点击下方按钮。</span>
                                        </>
                                    ) : (
                                        <>
                                            {inputType === 'clipboard' && '已自动识别剪切板内容，请检查数据格式是否正确'}
                                            {inputType === 'json' && '请粘贴咖啡豆的 JSON 数据或文本信息'}
                                            {inputType === 'search' && '从搜索结果自动填入，请检查信息是否正确'}
                                            {inputType === 'qr' && '已扫描二维码，请检查信息是否正确'}
                                        </>
                                    )}
                                </motion.p>
                            </AnimatePresence>
                        </div>

                        {/* 动态内容区域 */}
                        <AnimatePresence mode="wait">
                            {currentMode === 'buttons' ? (
                                <motion.div
                                    key="buttons"
                                    initial={{ opacity: 0, x: 8 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -8 }}
                                    transition={{ duration: 0.25, ease: "easeInOut" }}
                                    className="space-y-3"
                                >
                                    {/* 识别剪切板 */}
                                    <button
                                        onClick={handleClipboardRecognition}
                                        className="w-full flex items-center justify-between p-4 bg-neutral-200/50 dark:bg-neutral-800 transition-colors rounded"
                                    >
                                        <div className="flex items-center space-x-3">
                                            <Clipboard className="w-5 h-5 text-neutral-600 dark:text-neutral-400" />
                                            <span className="text-neutral-800 dark:text-white font-medium">识别剪切板</span>
                                        </div>
                                        <ChevronRight className="w-5 h-5 text-neutral-500" />
                                    </button>

                                    {/* 输入JSON */}
                                    <button
                                        onClick={handleInputJSON}
                                        className="w-full flex items-center justify-between p-4 bg-neutral-200/50 dark:bg-neutral-800 transition-colors rounded"
                                    >
                                        <div className="flex items-center space-x-3">
                                            <Code className="w-5 h-5 text-neutral-600 dark:text-neutral-400" />
                                            <span className="text-neutral-800 dark:text-white font-medium">输入 JSON</span>
                                        </div>
                                        <ChevronRight className="w-5 h-5 text-neutral-500" />
                                    </button>

                                    {/* 扫描二维码 */}
                                    <button
                                        onClick={handleScanQRCode}
                                        className="w-full flex items-center justify-between p-4 bg-neutral-200/50 dark:bg-neutral-800 transition-colors rounded"
                                    >
                                        <div className="flex items-center space-x-3">
                                            <ScanLine className="w-5 h-5 text-neutral-600 dark:text-neutral-400" />
                                            <span className="text-neutral-800 dark:text-white font-medium">扫描二维码</span>
                                        </div>
                                        <ChevronRight className="w-5 h-5 text-neutral-500" />
                                    </button>

                                    {/* 搜索咖啡豆：暂时禁用*/}
                                    {/* <button
                                        onClick={handleSearchBeans}
                                        className="w-full flex items-center justify-between p-4 bg-neutral-200/50 dark:bg-neutral-800 transition-colors rounded"
                                    >
                                        <div className="flex items-center space-x-3">
                                            <Search className="w-5 h-5 text-neutral-600 dark:text-neutral-400" />
                                            <span className="text-neutral-800 dark:text-white font-medium">搜索咖啡豆</span>
                                        </div>
                                        <ChevronRight className="w-5 h-5 text-neutral-500" />
                                    </button> */}
                                </motion.div>
                            ) : (
                                <motion.div
                                    key="input"
                                    initial={{ opacity: 0, x: 8 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -8 }}
                                    transition={{ duration: 0.25, ease: "easeInOut" }}
                                    className="space-y-3"
                                >
                                    {/* 返回按钮 */}
                                    <button
                                        onClick={handleBackToButtons}
                                        className="w-full flex items-center justify-between p-4 bg-neutral-200/50 dark:bg-neutral-800 transition-colors rounded"
                                    >
                                        <div className="flex items-center space-x-3">
                                            <ChevronLeft className="w-5 h-5 text-neutral-600 dark:text-neutral-400" />
                                            <span className="text-neutral-800 dark:text-white font-medium">返回上一步</span>
                                        </div>
                                    </button>

                                    {/* 输入框 */}
                                    <div className="relative">
                                        <textarea
                                            className="w-full p-4 rounded focus:outline-none focus:ring-2 text-neutral-800 dark:text-white text-sm placeholder:text-neutral-400 dark:placeholder:text-neutral-500 transition-all resize-none bg-neutral-200/50 dark:bg-neutral-800 border border-transparent focus:ring-neutral-300 dark:focus:ring-neutral-700"
                                            placeholder={
                                                success ? `✅ ${success}` :
                                                inputType === 'clipboard' ? '识别剪切板内容中...' :
                                                inputType === 'json' ? '粘贴咖啡豆数据...' :
                                                '咖啡豆信息'
                                            }
                                            value={importData}
                                            onChange={(e) => setImportData(e.target.value)}
                                            rows={12}
                                        />
                                        {/* 错误提示 - 左下角 */}
                                        {error && (
                                            <div className="absolute bottom-3 left-3 flex items-center gap-2 text-xs text-neutral-600 dark:text-neutral-400">
                                                <span className="w-1.5 h-1.5 rounded-full bg-red-400/60"></span>
                                                <span>{error}</span>
                                            </div>
                                        )}
                                    </div>


                                    {/* 底部按钮区域 */}
                                    <div className="space-y-3">
                                        {/* 重新识别剪切板按钮 - 只在剪切板模式且有错误时显示 */}
                                        {error && inputType === 'clipboard' && (
                                            <button
                                                onClick={handleRetryClipboard}
                                                className="w-full flex items-center justify-between p-4 bg-neutral-200/50 dark:bg-neutral-800 hover:bg-neutral-200/70 dark:hover:bg-neutral-800/70 transition-colors rounded"
                                            >
                                                <div className="flex items-center space-x-3">
                                                    <Clipboard className="w-5 h-5 text-neutral-600 dark:text-neutral-400" />
                                                    <span className="text-neutral-800 dark:text-white font-medium">重新识别剪切板</span>
                                                </div>
                                            </button>
                                        )}
                                        
                                        {/* 添加按钮 */}
                                        <button
                                            onClick={handleImport}
                                            disabled={!importData.trim()}
                                            className={`w-full flex items-center justify-center p-4 transition-colors rounded ${
                                                importData.trim()
                                                    ? 'bg-neutral-200/50 dark:bg-neutral-800 hover:bg-neutral-200/70 dark:hover:bg-neutral-800/70'
                                                    : 'bg-neutral-100 dark:bg-neutral-900/50 cursor-not-allowed'
                                            }`}
                                        >
                                            <span className={`font-medium ${
                                                importData.trim()
                                                    ? 'text-neutral-800 dark:text-white'
                                                    : 'text-neutral-400 dark:text-neutral-600'
                                            }`}>
                                                {importData.trim() ? '添加咖啡豆' : '请输入数据'}
                                            </span>
                                        </button>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>
            )}
            
            {/* 搜索模态框 */}
            <BeanSearchModal
                isOpen={showSearchModal}
                onClose={() => setShowSearchModal(false)}
                onSelectBean={handleSelectFromSearch}
            />

            {/* 二维码扫描模态框 */}
            <QRScannerModal
                isOpen={showQRScannerModal}
                onClose={() => setShowQRScannerModal(false)}
                onScanSuccess={handleScanSuccess}
            />
        </>
    )
}

export default BeanImportModal 