'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { CoffeeBean } from '@/app/types'
import { equipmentList } from '@/lib/config'
import { useToast } from './GlobalToast'

interface AIRecipeModalProps {
    showModal: boolean
    onClose: () => void
    coffeeBean: CoffeeBean | null
    onJumpToImport: () => void
}

const AIRecipeModal: React.FC<AIRecipeModalProps> = ({
    showModal,
    onClose,
    coffeeBean,
    onJumpToImport
}) => {
    const [selectedEquipment, setSelectedEquipment] = useState<string>('V60')
    const [userSuggestion, setUserSuggestion] = useState<string>('')
    const [showLocalCopySuccess, setShowLocalCopySuccess] = useState<boolean>(false)
    const { showToast } = useToast()

    // 计算烘焙天数
    const calculateRoastDays = (roastDate?: string) => {
        if (!roastDate) return null;

        const roastDay = new Date(roastDate);
        const today = new Date();

        // 检查日期是否有效
        if (isNaN(roastDay.getTime())) return null;

        const diffTime = Math.abs(today.getTime() - roastDay.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        return diffDays;
    };

    // 根据咖啡豆和选定的滤杯生成提示词
    const generatePrompt = () => {
        if (!coffeeBean) return ''

        // 计算烘焙天数
        const roastDays = calculateRoastDays(coffeeBean.roastDate);
        const roastDaysText = roastDays ? `烘焙后${roastDays}天` : '';

        // 用户补充建议部分
        const userSuggestionSection = userSuggestion.trim() ?
            `\n## 用户补充建议\n${userSuggestion.trim()}\n` : '';

        const prompt = `作为一位WBC冠军级咖啡师，请为以下咖啡豆设计合适冲煮方案：

## 咖啡豆信息
名称: ${coffeeBean.name}
烘焙度: ${coffeeBean.roastLevel || '未知'}
产地: ${coffeeBean.origin || '未知'} 
处理法: ${coffeeBean.process || '未知'}
品种: ${coffeeBean.variety || '未知'}
烘焙: ${roastDaysText || '未知'}
风味描述: ${(coffeeBean.flavor || []).join(', ')}

## 器具
${selectedEquipment}滤杯${userSuggestionSection}

## 返回格式
仅返回以下JSON格式数据：

\`\`\`json
{
  "equipment": "${selectedEquipment}",
  "method": "",
  "coffeeBeanInfo": {
    "name": "${coffeeBean.name}",
    "roastLevel": "${coffeeBean.roastLevel || ''}",
    "roastDate": "${coffeeBean.roastDate || ''}"
  },
  "params": {
    "coffee": "",
    "water": "",
    "ratio": "",
    "grindSize": "",
    "temp": "",
    "videoUrl": "",
    "stages": [
      {
        "time": 0,
        "pourTime": 0,
        "label": "",
        "water": "",
        "detail": "",
        "pourType": "circle"
      }
    ]
  }
}
\`\`\`

## 字段说明
- method: 方案名称，如"三段式冲煮法"
- params.coffee: 咖啡粉量，如"15g"
- params.water: 总水量，如"225g"
- params.ratio: 咖啡粉与水的比例，如"1:15"
- params.grindSize: 研磨度描述，如"中细"、"中细偏粗"
- params.temp: 精确水温，如"92°C"

stages数组中的每个阶段必须包含以下字段：
- time: 累计时间点（秒），表示该阶段结束时的时间点，约2分钟完成整个冲煮过程
- pourTime: 该阶段注水时间（秒），表示在该阶段需要花多少秒完成注水
- label: 操作简要描述，如"焖蒸"、"绕圈注水"、"中心注水"等
- water: 累计水量（克），表示到当前阶段结束时的总水量
- detail: 详细操作说明或补充信息
- pourType: 注水方式，必须是以下值之一：
  * "center": 中心注水
  * "circle": 绕圈注水
  * "ice": 冰滴
  * "other": 其他方式

参考实例：
三段式冲煮方案：第一阶段焖蒸25秒(注水时间10秒)，第二阶段注水到50秒(注水时间25秒)，第三阶段注水到2分钟(注水时间40秒)。
总冲煮时间约2分钟，按这个思路设计。

完整JSON示例:
\`\`\`json
{
  "equipment": "V60",
  "method": "三段式精品咖啡萃取法",
  "coffeeBeanInfo": {
    "name": "埃塞俄比亚耶加雪菲",
    "roastLevel": "中浅烘焙",
    "roastDate": "2025-03-23"
  },
  "params": {
    "coffee": "15g",
    "water": "225g",
    "ratio": "1:15",
    "grindSize": "中细",
    "temp": "92°C",
    "videoUrl": "",
    "stages": [
      {
        "time": 25,
        "pourTime": 10,
        "label": "焖蒸",
        "water": "30g",
        "detail": "中心向外绕圈注水，确保咖啡粉均匀湿润",
        "pourType": "circle"
      },
      {
        "time": 50,
        "pourTime": 25,
        "label": "绕圈注水",
        "water": "140g",
        "detail": "中心向外缓慢画圈注水，均匀萃取咖啡风味",
        "pourType": "circle"
      },
      {
        "time": 120,
        "pourTime": 40,
        "label": "中心注水",
        "water": "225g",
        "detail": "中心定点注水，降低萃取率，完成冲煮",
        "pourType": "center"
      }
    ]
  }
}
\`\`\`

只返回JSON数据，不要添加任何额外解释。`

        return prompt
    }

    // 复制提示词到剪贴板
    const copyPromptToClipboard = async () => {
        const prompt = generatePrompt()

        try {
            if (navigator.clipboard && navigator.clipboard.writeText) {
                await navigator.clipboard.writeText(prompt)
                setShowLocalCopySuccess(true)

                // 显示全局提示
                showToast({
                    type: 'success',
                    title: '提示词已复制!',
                    listItems: [
                        '将提示词发送给 DeepSeek',
                        '复制 AI 返回的 JSON 代码',
                        '粘贴到导入页面中'
                    ],
                    duration: 10000 // 10秒
                })

                // 设置一个定时器，1.5秒后重置按钮状态
                // 这确保即使用户没有点击跳转，按钮也会恢复
                setTimeout(() => {
                    setShowLocalCopySuccess(false)
                }, 1500)

                return true
            } else {
                // 使用传统方法复制
                const textArea = document.createElement('textarea')
                textArea.value = prompt
                document.body.appendChild(textArea)
                textArea.select()
                const successful = document.execCommand('copy')
                document.body.removeChild(textArea)

                if (successful) {
                    setShowLocalCopySuccess(true)

                    // 显示全局提示
                    showToast({
                        type: 'success',
                        title: '提示词已复制!',
                        listItems: [
                            '将提示词发送给 DeepSeek',
                            '复制 AI 返回的 JSON 代码',
                            '粘贴到导入页面中'
                        ],
                        duration: 10000 // 10秒
                    })

                    // 同样设置定时器重置状态
                    setTimeout(() => {
                        setShowLocalCopySuccess(false)
                    }, 1500)

                    return true
                } else {
                    showToast({
                        type: 'error',
                        title: '复制失败!',
                        listItems: ['请手动复制提示词']
                    })
                }
            }
        } catch {
            
            showToast({
                type: 'error',
                title: '复制失败!',
                listItems: ['请手动复制提示词']
            })
        }

        return false
    }

    // 跳转到方案导入页面
    const handleCopyAndJump = async () => {
        await copyPromptToClipboard()

        // 立即跳转，不等待
        onJumpToImport()
        onClose()

        // 设置一个延时器，确保在跳转完成后重置按钮状态
        // 这样当用户返回时，按钮不会显示"正在跳转"
        setTimeout(() => {
            setShowLocalCopySuccess(false)
        }, 500)
    }

    // 动画变体
    const fadeVariants = {
        hidden: { opacity: 0, y: 5 },
        visible: {
            opacity: 1,
            y: 0,
            transition: {
                duration: 0.26,
                ease: "easeOut"
            }
        },
        exit: {
            opacity: 0,
            y: 5,
            transition: {
                duration: 0.2,
                ease: "easeIn"
            }
        }
    };

    // 当模态框关闭时，重置状态
    useEffect(() => {
        if (!showModal) {
            // 短暂延迟后重置状态，确保动画完成后再重置
            const timer = setTimeout(() => {
                setShowLocalCopySuccess(false)
            }, 300)

            return () => clearTimeout(timer)
        }
    }, [showModal])

    return (
        <AnimatePresence>
            {showModal && (
                <div className="fixed inset-0 z-[100]">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.265 }}
                        className="fixed inset-0 bg-black/30 backdrop-blur-sm"
                        onClick={(e) => {
                            if (e.target === e.currentTarget) {
                                onClose()
                            }
                        }}
                    />

                    <motion.div
                        initial={{ y: '100%' }}
                        animate={{ y: 0 }}
                        exit={{ y: '100%' }}
                        transition={{
                            type: "tween",
                            ease: [0.33, 1, 0.68, 1],
                            duration: 0.265
                        }}
                        style={{
                            willChange: "transform"
                        }}
                        className="fixed inset-x-0 bottom-0 max-h-[85vh] overflow-hidden rounded-t-2xl bg-neutral-50 dark:bg-neutral-900 shadow-xl"
                    >
                        {/* 拖动条 */}
                        <div className="sticky top-0 z-10 flex justify-center py-2 bg-neutral-50 dark:bg-neutral-900">
                            <div className="h-1.5 w-12 rounded-full bg-neutral-200 dark:bg-neutral-700" />
                        </div>

                        {/* 内容区域 */}
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
                            className="px-6 px-safe pb-6 pb-safe overflow-auto max-h-[calc(85vh-40px)]"
                        >
                            <div className="flex flex-col">
                                {/* 顶部标题 */}
                                <div className="flex items-center justify-between mt-3 mb-6">
                                    <button
                                        type="button"
                                        onClick={onClose}
                                        className="rounded-full p-2 text-neutral-400 hover:text-neutral-600 dark:text-neutral-500 dark:hover:text-neutral-300 transition-colors"
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
                                    <h3 className="text-base font-medium tracking-wide text-neutral-800 dark:text-neutral-200">AI方案生成器</h3>
                                    <div className="w-8"></div>
                                </div>

                                {/* 主要内容 */}
                                <motion.div
                                    variants={fadeVariants}
                                    initial="hidden"
                                    animate="visible"
                                    className="space-y-5"
                                >
                                    {/* 咖啡豆信息 */}
                                    <div className="p-4 rounded-lg bg-neutral-100/80 dark:bg-neutral-800/60 border border-neutral-200/80 dark:border-neutral-700/60">
                                        <h4 className="text-sm font-medium mb-2 text-neutral-800 dark:text-neutral-200">已选咖啡豆</h4>
                                        <p className="text-sm text-neutral-600 dark:text-neutral-400">
                                            {coffeeBean?.name || '未选择咖啡豆'}
                                        </p>
                                        {coffeeBean && (
                                            <div className="mt-1 text-xs text-neutral-500 dark:text-neutral-500">
                                                {coffeeBean.roastLevel && (
                                                    <span className="inline-block mr-2">烘焙度: {coffeeBean.roastLevel}</span>
                                                )}
                                                {coffeeBean.process && (
                                                    <span className="inline-block mr-2">处理法: {coffeeBean.process}</span>
                                                )}
                                                {coffeeBean.roastDate && calculateRoastDays(coffeeBean.roastDate) && (
                                                    <span className="inline-block mr-2">
                                                        烘焙: 烘焙后{calculateRoastDays(coffeeBean.roastDate)}天
                                                    </span>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    {/* 选择滤杯 - 简化设计 */}
                                    <div className="space-y-2">
                                        <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">
                                            选择滤杯
                                        </label>
                                        <div className="flex">
                                            {equipmentList.map(item => (
                                                <button
                                                    key={item.id}
                                                    onClick={() => setSelectedEquipment(item.id)}
                                                    className={`mr-2 px-3 py-1.5 rounded text-xs transition-colors ${selectedEquipment === item.id
                                                        ? 'bg-neutral-800 dark:bg-white text-white dark:text-neutral-900'
                                                        : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700'
                                                        }`}
                                                >
                                                    {item.name}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* 用户补充建议 */}
                                    <div className="space-y-2">
                                        <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">
                                            补充建议（可选）
                                        </label>
                                        <textarea
                                            value={userSuggestion}
                                            onChange={(e) => setUserSuggestion(e.target.value)}
                                            placeholder="例如：我希望萃取时间在2分30秒左右，偏酸的风味，或者其他特殊要求..."
                                            className="w-full px-3 py-2 text-xs rounded-lg bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 placeholder-neutral-500 dark:placeholder-neutral-500 focus:outline-none focus:ring-1 focus:ring-neutral-400 dark:focus:ring-neutral-600"
                                            rows={3}
                                        />
                                    </div>

                                    {/* 说明文本 */}
                                    <div className="text-xs text-neutral-600 dark:text-neutral-400 space-y-1.5">
                                        <p>根据咖啡豆信息和你的补充建议生成个性化冲煮方案：</p>
                                        <div className="flex items-center space-x-2">
                                            <div className="flex-1 flex items-center">
                                                <span className="w-5 h-5 flex items-center justify-center rounded-full bg-neutral-200 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300 mr-1.5">1</span>
                                                <span>复制提示词</span>
                                            </div>
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-neutral-400">
                                                <path d="M9 6L15 12L9 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                            </svg>
                                            <div className="flex-1 flex items-center">
                                                <span className="w-5 h-5 flex items-center justify-center rounded-full bg-neutral-200 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300 mr-1.5">2</span>
                                                <span>发送给DeepSeek</span>
                                            </div>
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-neutral-400">
                                                <path d="M9 6L15 12L9 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                            </svg>
                                            <div className="flex-1 flex items-center">
                                                <span className="w-5 h-5 flex items-center justify-center rounded-full bg-neutral-200 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300 mr-1.5">3</span>
                                                <span>复制返回的代码导入进来</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* 提示词预览 - 缩短高度 */}
                                    {coffeeBean && (
                                        <div className="p-3 rounded-lg bg-neutral-100/80 dark:bg-neutral-800/60 border border-neutral-200/80 dark:border-neutral-700/60 max-h-[100px] overflow-auto text-xs font-mono">
                                            <div className="text-[10px] text-neutral-500 dark:text-neutral-400 mb-1">
                                                预览（点击下方按钮复制完整提示词）：
                                            </div>
                                            <pre className="whitespace-pre-wrap break-words text-neutral-700 dark:text-neutral-300">
                                                {generatePrompt().substring(0, 300)}...
                                            </pre>
                                        </div>
                                    )}

                                    {/* 操作按钮 - 优化样式 */}
                                    <div className="flex justify-end pt-2">
                                        <button
                                            onClick={handleCopyAndJump}
                                            disabled={!coffeeBean}
                                            className={`py-2 px-3.5 bg-neutral-800 hover:bg-neutral-700 dark:bg-neutral-200 dark:hover:bg-neutral-300 text-white dark:text-neutral-800 rounded text-xs font-medium transition-colors
                                                ${!coffeeBean ? 'opacity-50 cursor-not-allowed' : ''}`}
                                        >
                                            {showLocalCopySuccess ? '已复制，正在跳转...' : '复制并导入'}
                                        </button>
                                    </div>
                                </motion.div>
                            </div>
                        </motion.div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    )
}

export default AIRecipeModal 