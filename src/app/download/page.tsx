'use client'

import React, { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Image from 'next/image'

/**
 * 极简下载页面组件
 */
export default function DownloadPage(): React.ReactNode {
    const [showContent, setShowContent] = useState(false)
    const [activeTab, setActiveTab] = useState<'intro' | 'download' | 'changelog'>('intro')
    const [imageIndex, setImageIndex] = useState(0)
    const scrollRef = useRef<HTMLDivElement>(null)
    
    const images = [
        '/images/content/辅助冲煮可视化截图.PNG',
        '/images/content/豆仓截图.PNG',
        '/images/content/笔记列表截图.PNG',
        '/images/content/个人榜单截图.PNG',
        '/images/content/数据统计截图.PNG',
        '/images/content/随机选豆截图.PNG',
        '/images/content/方案列表截图.PNG',
        '/images/content/冲煮方案步骤截图.PNG',
        '/images/content/博主榜单截图.PNG',
    ]
    
    const descriptions = [
        "可视化辅助冲煮，让每一次冲煮都更精准。",
        "管理你的咖啡豆库存，记录每一颗豆子。",
        "记录每次冲煮的详细笔记和感受。",
        "个人咖啡豆评分榜单，发现最爱。",
        "详细的冲煮数据统计和分析。",
        "今天喝什么豆子？让随机选择帮你决定。",
        "丰富的冲煮方案库，探索不同的冲煮方法。",
        "详细的冲煮步骤指导，新手也能轻松上手。",
        "发现优质咖啡豆，探索博主推荐。",
    ]

    // 内容切换处理函数
    const handleTabClick = (tab: 'intro' | 'download' | 'changelog') => {
        setShowContent(true)
        setActiveTab(tab)
    }

    // 监听滚动，更新当前显示的图片索引
    useEffect(() => {
        const scrollElement = scrollRef.current
        if (!scrollElement || !showContent) return

        const handleScroll = () => {
            if (!scrollElement) return
            
            const scrollPosition = scrollElement.scrollLeft
            const containerWidth = scrollElement.clientWidth
            
            // 计算当前可见的图片索引
            // 对于宽度为85%的图片，每个图片占据大约85%的容器宽度，但与下一张有重叠
            let index = 0;
            
            if (images.length > 1) {
                // 估算每个图片的实际宽度和位置
                const slideWidth = containerWidth * 0.85; // 85% 的容器宽度
                const effectiveWidth = slideWidth - 50; // 减去重叠部分
                
                // 根据滚动位置计算当前索引
                index = Math.round(scrollPosition / effectiveWidth);
                
                // 确保索引在有效范围内
                index = Math.max(0, Math.min(index, images.length - 1));
            }
            
            if (index !== imageIndex) {
                setImageIndex(index);
            }
        }

        // 初始化时执行一次
        handleScroll();

        scrollElement.addEventListener('scroll', handleScroll)
        return () => {
            scrollElement.removeEventListener('scroll', handleScroll)
        }
    }, [showContent, images.length, imageIndex])

    // 渲染不同标签页的内容
    const renderTabContent = () => {
        switch (activeTab) {
            case 'intro':
                return (
                    <motion.div
                        key="intro"
                        initial={{ opacity: 0, scale: 0.98 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.98 }}
                        transition={{ duration: 0.3 }}
                        className="w-full"
                    >
                        <div 
                            ref={scrollRef}
                            className="w-full overflow-x-auto overflow-y-hidden snap-x snap-mandatory flex scrollbar-none [scrollbar-width:none] [-ms-overflow-style:none]"
                            style={{ scrollbarWidth: 'none' }}
                        >
                            <style jsx>{`
                                div::-webkit-scrollbar {
                                    display: none;
                                }
                            `}</style>
                            {images.map((image, index) => (
                                <motion.div 
                                    key={index}
                                    className={`${
                                        index === images.length - 1 
                                            ? 'w-full' 
                                            : 'w-[85%] mr-[-50px]'
                                    } flex-shrink-0 snap-start relative`}
                                    initial={{ opacity: 0, filter: 'blur(10px)' }}
                                    animate={{ opacity: 1, filter: 'blur(0px)' }}
                                    transition={{ delay: index * 0.1, duration: 0.3 }}
                                >
                                    <div className="relative w-full h-[65vh] flex items-center justify-start pl-6">
                                        <div className="relative inline-block">
                                            <Image 
                                                src={image}
                                                alt={`App screenshot ${index + 1}`}
                                                className="object-contain max-h-[60vh] w-auto"
                                                width={300}
                                                height={600}
                                                priority
                                            />
                                            
                                            {/* 图片序号指示器 - 左下角 */}
                                            <div className="absolute -bottom-5 left-0 rounded-full text-xs text-neutral-500">
                                                {index + 1}
                                            </div>
                                        </div>
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    </motion.div>
                );
            case 'download':
                return (
                    <motion.div 
                        key="download"
                        className="w-full h-[65vh] flex flex-col items-start justify-start pl-6 pr-6"
                        initial={{ opacity: 0, scale: 0.98 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.98 }}
                        transition={{ duration: 0.3 }}
                    >
                        <h2 className="text-lg font-medium mb-6 mt-20">下载链接</h2>
                        <div className="flex flex-col gap-6 text-sm">
                            <a 
                                href="https://www.123912.com/s/prGKTd-HpJWA" 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 hover:opacity-70 transition-opacity"
                            >
                                <div className="flex items-center whitespace-nowrap">
                                    <span className="text-neutral-800 dark:text-neutral-200">🔗 国内下载</span>
                                </div>
                                <span className="text-xs text-neutral-500 truncate">(https://www.123912.com/s/prGKTd-HpJWA)</span>
                            </a>
                            <a 
                                href="https://github.com/chu3/brew-guide/releases" 
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 hover:opacity-70 transition-opacity"
                            >
                                <div className="flex items-center whitespace-nowrap">
                                    <span className="text-neutral-800 dark:text-neutral-200">🔗 海外下载</span>
                                </div>
                                <span className="text-xs text-neutral-500 truncate">(https://github.com/chu3/brew-guide/releases)</span>
                            </a>
                        </div>
                    </motion.div>
                );
            case 'changelog':
                return (
                    <motion.div 
                        key="changelog"
                        className="w-full h-[65vh] flex flex-col items-start justify-start pl-6 pr-6 relative bg-neutral-50 dark:bg-neutral-900"
                        initial={{ opacity: 0, scale: 0.98 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.98 }}
                        transition={{ duration: 0.3 }}
                    >
                        <div className="absolute top-0 left-0 w-full h-[120px] bg-gradient-to-b from-neutral-50 dark:from-neutral-900 to-transparent z-[1] pointer-events-none" />
                        
                        <div className="w-full h-full overflow-y-auto scrollbar-none relative" 
                             style={{ scrollbarWidth: 'none' }}>
                            <style jsx>{`
                                div::-webkit-scrollbar {
                                    display: none;
                                }
                            `}</style>
                            
                            <div className="flex flex-col gap-6 text-sm pb-20 pt-20">
                                <h2 className="text-lg font-medium mb-6">更新记录</h2>
                                
                                <div>
                                    <p className="font-medium">即将发布的更新（尚未推送）</p>
                                    <ul className="mt-2 text-xs text-neutral-500 list-disc pl-4 space-y-1">
                                        <li>修复：笔记搜索功能失效问题 <span className="text-xs opacity-70">chu3 © main</span></li>
                                        <li>优化：调整安全区域的填充和位置，以改善界面适应性 <span className="text-xs opacity-70">chus</span></li>
                                        <li>修复：替换数据时，自定义器具没有正常更新 <span className="text-xs opacity-70">chu3</span></li>
                                        <li>优化：将冰手冲咖啡研磨大小从"细"调整为"中细" <span className="text-xs opacity-70">chu3</span></li>
                                        <li>更新赞助榜 <span className="text-xs opacity-70">chu3</span></li>
                                    </ul>
                                </div>
                                
                                <div>
                                    <p className="font-medium">v1.2.4.5（最新版本）</p>
                                    <p className="text-xs text-neutral-500 mt-1">2025-05-12</p>
                                    <ul className="mt-2 text-xs text-neutral-500 list-disc pl-4 space-y-1">
                                        <li>新增随机选择咖啡豆功能 "今天喝什么豆子"</li>
                                        <li>图片上传时自动压缩（小于200KB保留原图）</li>
                                        <li>快捷扣除库存也会自动创建冲煮笔记</li>
                                        <li>自定义冲煮方案数据持久化，刷新页面不丢失</li>
                                        <li>分类按钮布局更紧凑</li>
                                        <li>风味评分笔记在有评价时自动展开</li>
                                        <li>咖啡豆表单输入限制小数点后一位</li>
                                        <li>修复冲煮完成后咖啡豆绑定错误问题</li>
                                        <li>修复删除咖啡豆后统计信息残留问题</li>
                                    </ul>
                                </div>
                                
                                <div>
                                    <p className="font-medium">v1.2.4.4</p>
                                    <p className="text-xs text-neutral-500 mt-1">2025-05-08</p>
                                    <ul className="mt-2 text-xs text-neutral-500 list-disc pl-4 space-y-1">
                                        <li>修复多项问题：咖啡豆导入异常、成分信息丢失、筛选栏右侧不可点击等</li>
                                        <li>修复笔记保存失败报错信息不明确问题</li>
                                        <li>修复计时器倒计时音效缺失与频繁操作异常</li>
                                        <li>设置页面改版</li>
                                        <li>手动添加笔记界面统一</li>
                                        <li>咖啡豆列表不同信息下的排版优化</li>
                                    </ul>
                                </div>
                                
                                <div>
                                    <p className="font-medium">v1.2.3-fix</p>
                                    <p className="text-xs text-neutral-500 mt-1">2025-04-23</p>
                                    <ul className="mt-2 text-xs text-neutral-500 list-disc pl-4 space-y-1">
                                        <li>彻底解决低版本系统适配问题（界面样式缺失等）</li>
                                        <li>兼容了更多设备</li>
                                        <li>支持快速修改库存</li>
                                        <li>添加小彩蛋（双击注水时的器具图像，会有动画）</li>
                                    </ul>
                                </div>
                                
                                <div>
                                    <p className="font-medium">v1.2.0</p>
                                    <p className="text-xs text-neutral-500 mt-1">2025-04-12</p>
                                    <ul className="mt-2 text-xs text-neutral-500 list-disc pl-4 space-y-1">
                                        <li>新增流速显示</li>
                                        <li>注水步骤添加分隔线显示</li>
                                        <li>笔记新增咖啡豆和器具分类</li>
                                        <li>新增 Peter 2024 咖啡豆榜单和精准跳转功能</li>
                                        <li>最后注水阶段时支持跳过</li>
                                        <li>新增10款磨豆机支持</li>
                                        <li>修复自定义方案水量计算问题等</li>
                                    </ul>
                                </div>
                                
                                <div className="pb-10">
                                    <a 
                                        href="https://github.com/chu3/brew-guide/releases" 
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-xs text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 transition-colors"
                                    >
                                        查看更多历史版本记录 →
                                    </a>
                                </div>
                            </div>
                        </div>
                        
                        <div className="absolute bottom-0 left-0 w-full h-[120px] bg-gradient-to-t from-neutral-50 dark:from-neutral-900 to-transparent z-[1] pointer-events-none" />
                    </motion.div>
                );
            default:
                return null;
        }
    };

    return (
        <div className="relative flex min-h-full w-full flex-col">
            {/* 内容区域 */}
            <AnimatePresence mode="wait">
                {showContent && (
                    <motion.div 
                        className="flex-1 flex items-center justify-center w-full pb-28"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.3 }}
                    >
                        {renderTabContent()}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* 左下角的APP简介 */}
            <div className="absolute bottom-8 left-6 max-w-[200px] pb-safe-bottom">
                <div className="h-[20px] mb-6">
                    {showContent ? (
                        <AnimatePresence mode="wait">
                            <motion.p
                                key={imageIndex}
                                className="text-xs text-neutral-500 dark:text-neutral-400"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.2 }}
                            >
                                {activeTab === 'intro' ? descriptions[imageIndex] : ''}
                            </motion.p>
                        </AnimatePresence>
                    ) : (
                        <p className="text-xs text-neutral-500 dark:text-neutral-400">
                            Brew Guide 一站式管理器具、方案、咖啡豆以及笔记的小工具。
                        </p>
                    )}
                </div>
                <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400 flex gap-5">
                    <a 
                        onClick={() => handleTabClick('intro')} 
                        className={`cursor-pointer relative ${showContent ? '' : 'underline'}`}
                    >
                        {showContent ? (
                            <>
                                <span className={`transition-opacity duration-300 ${activeTab === 'intro' ? 'opacity-100' : 'opacity-0'}`}>[</span>
                                介绍
                                <span className={`transition-opacity duration-300 ${activeTab === 'intro' ? 'opacity-100' : 'opacity-0'}`}>]</span>
                            </>
                        ) : '前往'}
                    </a>
                    {showContent && (
                        <>
                            <motion.a 
                                onClick={() => handleTabClick('download')}
                                className="cursor-pointer relative"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 0.1, duration: 0.3 }}
                            >
                                <span className={`transition-opacity duration-300 ${activeTab === 'download' ? 'opacity-100' : 'opacity-0'}`}>[</span>
                                下载
                                <span className={`transition-opacity duration-300 ${activeTab === 'download' ? 'opacity-100' : 'opacity-0'}`}>]</span>
                            </motion.a>
                            <motion.a 
                                onClick={() => handleTabClick('changelog')}
                                className="cursor-pointer relative"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 0.2, duration: 0.3 }}
                            >
                                <span className={`transition-opacity duration-300 ${activeTab === 'changelog' ? 'opacity-100' : 'opacity-0'}`}>[</span>
                                更新记录
                                <span className={`transition-opacity duration-300 ${activeTab === 'changelog' ? 'opacity-100' : 'opacity-0'}`}>]</span>
                            </motion.a>
                        </>
                    )}
                </p>
            </div>
        </div>
    )
} 