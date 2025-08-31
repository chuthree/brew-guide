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
        '/images/content/方案列表截图.PNG',
        '/images/content/冲煮方案步骤截图.PNG',
        '/images/content/豆仓截图.PNG',
        '/images/content/个人榜单截图.PNG',
        '/images/content/博主榜单截图.PNG',
        '/images/content/随机选豆截图.PNG',
        '/images/content/笔记列表截图.PNG',
        '/images/content/数据统计截图.PNG',
    ]
    
    const descriptions = [
        "可视化辅助冲煮",
        "丰富的冲煮方案库",
        "详细的冲煮步骤",
        "管理咖啡豆库存",
        "个人豆子榜单",
        "发现优质豆子",
        "随机选豆推荐",
        "记录冲煮笔记",
        "数据统计分析",
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
                                                className="object-contain max-h-[60vh] w-auto rounded-[20px] border border-neutral-200/50 dark:border-transparent"
                                                width={300}
                                                height={600}
                                                priority
                                            />
                                            
                                            {/* 图片序号指示器 - 左下角 */}
                                            {/* <div className="absolute -bottom-5 left-0 rounded-full text-xs text-neutral-500">
                                                {index + 1} / {images.length}
                                            </div> */}
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
                                    <p className="font-medium">(待发布)</p>
                                    <p className="text-xs text-neutral-500 mt-1">2025-08-31</p>
                                    <ul className="mt-2 text-xs text-neutral-500 list-disc pl-4 space-y-1">
                                        <li>(添加): 变动记录编辑中增加转普通笔记按钮</li> 
                                        <li>(添加): 数据备份提醒</li>
                                        <li>(添加): 支持自定义赏味期预设</li> 
                                        <li>(添加): 咖啡豆列表可选择显示总价格以及养豆时间</li>
                                        <li>(优化): 数据管理代码质量</li> 
                                        <li>(优化): 统一笔记的保存按钮样式</li>
                                        <li>(优化): 限制添加笔记界面的宽度</li> 
                                        <li>(优化): 同步咖啡豆详情中冲煮笔记样式</li> 
                                        <li>(优化): 笔记列表样式</li>
                                        <li>(优化): 咖啡豆详情中冲煮记录样式同步</li> 
                                        <li>(优化): 咖啡豆备注行数默认最大显示1行</li> 
                                        <li>(优化): 字体大小修改控件样式</li>
                                        <li>(优化): 个人榜单排版</li> 
                                        <li>(优化): 笔记列表排版</li> 
                                        <li>(优化): 快捷扣除值允许设小数点后一位</li> 
                                        <li>(修复): 快速点开咖啡豆详情时出现&quot;加载中...&quot;的问题</li>
                                        <li>(修复): 笔记编辑模态框保存按钮跟随滚动问题</li> 
                                        <li>(修复): 导入数据后个人榜单显示为空的问题</li>
                                        <li>(修复): 导致 PWA 应用部署后出现空白页面的关键问题</li> 
                                    </ul>
                                </div>
                                <div>
                                    <p className="font-medium">v1.3.9（最新版本）</p>
                                    <p className="text-xs text-neutral-500 mt-1">2025-08-06</p>
                                    <ul className="mt-2 text-xs text-neutral-500 list-disc pl-4 space-y-1">
                                        <li>(添加): 笔记支持图片查看（可选带日期），记录更直观</li>
                                        <li>(添加): 烘焙后天数显示，方便查看豆子新鲜度</li>
                                        <li>(添加): 删除笔记时增加确认提示，避免误删</li>
                                        <li>(添加): 博主榜单支持搜索功能，并新增矮人评测豆单</li>
                                        <li>(添加): 将榜单页面扩展映射到更多路径，便于访问</li>
                                        <li>(添加): 图片补压功能，解决之前未自动压缩的问题</li>
                                        <li>(添加): 编辑记录时支持修改咖啡豆</li>
                                        <li>(优化): 下载页面重构，提升内容切换与图片展示体验</li>
                                        <li>(优化): 长文本输入体验更流畅</li>
                                        <li>(优化): 咖啡豆详情界面微调，更清晰</li>
                                        <li>(优化): 添加笔记界面改为全屏，更方便操作</li>
                                        <li>(优化): 无咖啡豆时不再显示榜单和统计，避免空内容</li>
                                        <li>(优化): 拼配成分一行一个，信息更清晰</li>
                                        <li>(优化): 多处文案优化，让界面信息更准确</li>
                                        <li>(优化): 笔记列表和数据管理的显示逻辑更合理</li>
                                        <li>(修复): 切换笔记列表视图后分页加载异常的问题</li>
                                        <li>(修复): 笔记器具名称显示错误</li>
                                        <li>(修复): 冲煮咖啡豆和笔记列表加载问题</li>
                                        <li>(修复): 新建笔记时点击日期意外触发保存的问题</li>
                                        <li>(修复): 编辑记录时方案显示不完整</li>
                                        <li>(修复): 多次构建报错和安全漏洞问题，提升系统稳定性</li>
                                    </ul>
                                </div>
                                <div>
                                    <p className="font-medium">v1.3.8</p>
                                    <p className="text-xs text-neutral-500 mt-1">2025-06-28</p>
                                    <ul className="mt-2 text-xs text-neutral-500 list-disc pl-4 space-y-1">
                                        <li>(添加): 冲煮步骤界面&quot;极简显示模式&quot;，更适合专注操作</li>
                                        <li>(添加): 咖啡豆详情页&quot;去冲煮&quot;和&quot;记录&quot;快捷按钮</li>
                                        <li>(添加): 分类栏中的&quot;全部&quot;选项固定在左侧，切换更方便</li>
                                        <li>(添加): 支持添加&quot;烘焙商&quot;信息，记录更完整</li>
                                        <li>(添加): 自动清理临时文件，节省空间</li>
                                        <li>(添加): &quot;Bypass&quot;注水步骤，适配更多冲煮法</li>
                                        <li>(优化): 冲煮完成后参数栏不可修改，避免误操作</li>
                                        <li>(优化): 咖啡豆数据结构统一，为后续功能打基础</li>
                                        <li>(修复): 冲煮计时器提示音在阶段切换时失效问题</li>
                                        <li>(修复): 添加图片变黑的问题</li>
                                        <li>(修复): 统计视图序号与动画顺序问题</li>
                                    </ul>
                                </div>
                                <div>
                                    <p className="font-medium">v1.3.7</p>
                                    <p className="text-xs text-neutral-500 mt-1">2025-06-17</p>
                                    <ul className="mt-2 text-xs text-neutral-500 list-disc pl-4 space-y-1">
                                        <li>(添加): 全平台适配字体缩放</li>
                                        <li>(添加): 笔记支持修改冲煮方案</li>
                                        <li>(添加): 设置中可开启&quot;显示风味信息&quot;</li>
                                        <li>(添加): 咖啡豆支持按豆种、产地、赏味期、烘焙商分类</li>
                                        <li>(添加): 咖啡豆续购功能（仅编辑时显示）</li>
                                        <li>(添加): 修改笔记中的咖啡豆容量后将自动同步</li>
                                        <li>(添加): 更多&quot;温水细粉慢冲&quot;方案</li>
                                        <li>(修复): 页面布局错乱问题</li>
                                        <li>(修复): 图片添加后变黑的问题</li>
                                        <li>(修复): 使用&quot;拍照&quot;时误调用相册的问题</li>
                                    </ul>
                                </div>
                                <div>
                                    <p className="font-medium">v1.3.6</p>
                                    <p className="text-xs text-neutral-500 mt-1">2025-06-11</p>
                                    <ul className="mt-2 text-xs text-neutral-500 list-disc pl-4 space-y-1">
                                        <li>(添加): 咖啡豆续购功能（仅在编辑时出现）</li>
                                        <li>(优化): 导入咖啡豆后将会立即更新，无需手动刷新</li>
                                        <li>(优化): 输入咖啡豆总量后，改为失去焦点时再同步</li>
                                        <li>(修复): 咖啡豆列表信息更新不及时的问题</li>
                                        <li>(修复): 编辑预设方案时不保存仍会创建的问题</li>
                                        <li>(修复): 冲煮无法保存为笔记及跳过冲煮按钮的逻辑问题</li>
                                        <li>(修复): 自定义器具无法选择及方案显示异常的问题</li>
                                    </ul>
                                </div>
                                <div>
                                    <p className="font-medium">v1.3.5</p>
                                    <p className="text-xs text-neutral-500 mt-1">2025-06-08</p>
                                    <ul className="mt-2 text-xs text-neutral-500 list-disc pl-4 space-y-1">
                                        <li>(添加): 咖啡豆表单新增「简单模式」，填写更高效</li>
                                        <li>(添加): 统计视图功能支持按照时间区间显示</li>
                                        <li>(添加): 支持修改笔记日期，记录更灵活</li>
                                        <li>(添加): 只有一款咖啡豆时随机选豆会有特别动画</li>
                                        <li>(添加): 博主榜单同步添加处理法信息</li>
                                        <li>(添加): 导出为 Excel 文件</li>
                                        <li>(修复): 笔记编辑时日期无法更新的问题</li>
                                    </ul>
                                </div>
                                <div>
                                    <p className="font-medium">v1.3.0</p>
                                    <p className="text-xs text-neutral-500 mt-1">2025-05-26</p>
                                    <ul className="mt-2 text-xs text-neutral-500 list-disc pl-4 space-y-1">
                                        <li>(添加): 支持双击器具分类栏中的自定义器具直接进入编辑模式</li>
                                        <li>(添加): &quot;跳过方案选择&quot;功能，操作更快捷</li>
                                        <li>(添加): 咖啡豆仓库支持双击&quot;全部豆种&quot;切换为图片流展示</li>
                                        <li>(添加): 导航栏增加选择缓存功能，切换页面更便捷</li>
                                        <li>(添加): 自定义磨豆机功能</li>
                                        <li>(优化): 器具分类栏添加渐变阴影与过渡动画</li>
                                        <li>(修复): 自定义器具的预设方案选项无法使用的问题</li>
                                    </ul>
                                </div>
                                <div>
                                    <p className="font-medium">v1.2.5</p>
                                    <p className="text-xs text-neutral-500 mt-1">2025-05-21</p>
                                    <ul className="mt-2 text-xs text-neutral-500 list-disc pl-4 space-y-1">
                                        <li>(优化): 重置数据后页面将自动刷新，无需手动操作</li>
                                        <li>(修复): 计时器中&quot;显示流速&quot;设置不立即生效的问题</li>
                                        <li>(修复): 编辑方案时名称为空导致保存异常的问题</li>
                                        <li>(修复): 手动添加笔记时选择自定义方案后保存内容显示异常的问题</li>
                                    </ul>
                                </div>
                                <div>
                                    <p className="font-medium">v1.2.4.8</p>
                                    <p className="text-xs text-neutral-500 mt-1">2025-05-20</p>
                                    <ul className="mt-2 text-xs text-neutral-500 list-disc pl-4 space-y-1">
                                        <li>(添加): 极简模式功能，可隐藏咖啡豆列表中的风味标签和价格信息</li>
                                        <li>(添加): 为极简模式添加细粒度设置选项</li>
                                        <li>(优化): 调整咖啡豆基本信息组件中的容量和剩余显示</li>
                                        <li>(优化): 改进开始界面组件的视觉效果</li>
                                        <li>(修复): 咖啡豆排序失效问题</li>
                                        <li>(修复): 咖啡豆名称输入框意外弹出数字键盘的问题</li>
                                        <li>(修复): 方案咖啡粉量参数显示问题</li>
                                    </ul>
                                </div>
                                <div>
                                    <p className="font-medium">v1.2.4.7</p>
                                    <p className="text-xs text-neutral-500 mt-1">2025-05-20</p>
                                    <ul className="mt-2 text-xs text-neutral-500 list-disc pl-4 space-y-1">
                                        <li>(添加): 彩蛋动画功能，点击设置页面底部三角形触发效果</li>
                                        <li>(添加): 研磨度转化功能</li>
                                        <li>(添加): 意式机预设</li>
                                        <li>(添加): 咖啡豆表单支持自动填充年份</li>
                                        <li>(优化): 冲煮笔记表单布局调整为4列，输入更高效</li>
                                        <li>(优化): 加快统计视图的动画效果</li>
                                        <li>(修复): 方案拟态框滚动行为失效问题</li>
                                        <li>(优化): 导入咖啡豆识别准确度提升（换回OCR+LLM）</li>
                                    </ul>
                                </div>
                                <div>
                                    <p className="font-medium">v1.2.4.6</p>
                                    <p className="text-xs text-neutral-500 mt-1">2025-05-13</p>
                                    <ul className="mt-2 text-xs text-neutral-500 list-disc pl-4 space-y-1">
                                        <li>(添加): 咖啡豆新增&quot;冰冻&quot;保存状态</li>
                                        <li>(添加): 统计视图新增平均消耗与预计完成日期显示</li>
                                        <li>(优化): 笔记编辑流程更加顺畅，操作体验升级</li>
                                        <li>(优化): 调整安全区域的填充和位置，以改善界面适应性</li>
                                        <li>(优化): 将冰手冲咖啡研磨大小从&quot;细&quot;调整为&quot;中细&quot;</li>
                                        <li>(修复): 自定义器具无法被导入问题</li>
                                        <li>(修复): 自定义器具不显示通用方案问题</li>
                                        <li>(修复): 笔记搜索功能失效问题</li>
                                    </ul>
                                </div>
                                <div>
                                    <p className="font-medium">v1.2.4.5</p>
                                    <p className="text-xs text-neutral-500 mt-1">2025-05-12</p>
                                    <ul className="mt-2 text-xs text-neutral-500 list-disc pl-4 space-y-1">
                                        <li>(添加): 随机选择咖啡豆功能 &quot;今天喝什么豆子&quot;</li>
                                        <li>(添加): 图片上传时自动压缩（小于200KB保留原图）</li>
                                        <li>(添加): 快捷扣除库存也会自动创建冲煮笔记</li>
                                        <li>(优化): 自定义冲煮方案数据持久化，刷新页面不丢失</li>
                                        <li>(优化): 分类按钮布局更紧凑</li>
                                        <li>(优化): 风味评分笔记在有评价时自动展开</li>
                                        <li>(优化): 咖啡豆表单输入限制小数点后一位</li>
                                        <li>(修复): 冲煮完成后咖啡豆绑定错误问题</li>
                                        <li>(修复): 删除咖啡豆后统计信息残留问题</li>
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