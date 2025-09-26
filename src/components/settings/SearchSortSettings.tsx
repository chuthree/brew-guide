'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { ChevronLeft } from 'lucide-react'
import { SettingsOptions } from './Settings'

interface SearchSortSettingsProps {
    settings: SettingsOptions
    onClose: () => void
    handleChange: <K extends keyof SettingsOptions>(key: K, value: SettingsOptions[K]) => void
}

const SearchSortSettings: React.FC<SearchSortSettingsProps> = ({ 
    settings, 
    onClose, 
    handleChange 
}) => {
    return (
        <motion.div
            className="fixed inset-0 z-50 pt-safe-top  max-w-[640px] sm:max-w-full mx-auto bg-neutral-50 dark:bg-neutral-900 transition-opacity duration-200 opacity-100 pointer-events-auto flex flex-col "
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{
                duration: 0.35,
                ease: [0.36, 0.66, 0.04, 1]
            }}
        >
            {/* 头部导航栏 */}
            <div className="relative flex items-center justify-center pb-4  sm:max-w-sm w-full mx-auto">
                <button
                    onClick={onClose}
                    className="absolute left-4 flex items-center justify-center w-10 h-10 rounded-full text-neutral-700 dark:text-neutral-300"
                >
                    <ChevronLeft className="h-5 w-5" />
                </button>
                <h2 className="text-md font-medium text-neutral-800 dark:text-neutral-200">搜索排序设置</h2>
            </div>

            {/* 滚动内容区域 */}
            <div className="flex-1 overflow-y-auto pb-safe-bottom sm:max-w-sm w-full mx-auto">
                {/* 顶部渐变阴影 */}
                <div className="sticky top-0 z-10 h-12 w-full bg-linear-to-b from-neutral-50 dark:from-neutral-900 to-transparent pointer-events-none first:border-b-0"></div>
                
                <div className="px-6 py-4 -mt-4 space-y-6">
                    {/* 功能开关 */}
                    <div>
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <div className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                                        启用搜索排序
                                    </div>
                                    <div className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                                        在搜索时显示基于笔记内容的排序选项
                                    </div>
                                </div>
                                <label className="relative inline-flex cursor-pointer items-center">
                                    <input
                                        type="checkbox"
                                        checked={settings.searchSort?.enabled}
                                        onChange={(e) => handleChange('searchSort', {
                                            enabled: e.target.checked,
                                            time: settings.searchSort?.time ?? false,
                                            rating: settings.searchSort?.rating ?? false,
                                            extractionTime: settings.searchSort?.extractionTime ?? true
                                        })}
                                        className="peer sr-only"
                                    />
                                    <div className="peer h-6 w-11 rounded-full bg-neutral-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-neutral-600 peer-checked:after:translate-x-full dark:bg-neutral-700 dark:peer-checked:bg-neutral-500"></div>
                                </label>
                            </div>
                        </div>
                    </div>

                    {/* 排序项目设置 */}
                    {settings.searchSort?.enabled && (
                        <div>
                            <h3 className="text-sm uppercase font-medium tracking-wider text-neutral-500 dark:text-neutral-400 mb-3">
                                排序项目
                            </h3>
                            <div className="space-y-4">
                                {/* 时间排序 */}
                                <div className="flex items-center justify-between">
                                    <div>
                                        <div className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                                            时间排序
                                        </div>
                                        <div className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                                            根据笔记创建时间进行排序
                                        </div>
                                    </div>
                                    <label className="relative inline-flex cursor-pointer items-center">
                                        <input
                                            type="checkbox"
                                            checked={settings.searchSort?.time}
                                            onChange={(e) => handleChange('searchSort', {
                                                enabled: settings.searchSort?.enabled ?? true,
                                                time: e.target.checked,
                                                rating: settings.searchSort?.rating ?? false,
                                                extractionTime: settings.searchSort?.extractionTime ?? true
                                            })}
                                            className="peer sr-only"
                                        />
                                        <div className="peer h-6 w-11 rounded-full bg-neutral-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-neutral-600 peer-checked:after:translate-x-full dark:bg-neutral-700 dark:peer-checked:bg-neutral-500"></div>
                                    </label>
                                </div>

                                {/* 评分排序 */}
                                <div className="flex items-center justify-between">
                                    <div>
                                        <div className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                                            评分排序
                                        </div>
                                        <div className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                                            根据笔记评分进行排序
                                        </div>
                                    </div>
                                    <label className="relative inline-flex cursor-pointer items-center">
                                        <input
                                            type="checkbox"
                                            checked={settings.searchSort?.rating}
                                            onChange={(e) => handleChange('searchSort', {
                                                enabled: settings.searchSort?.enabled ?? true,
                                                time: settings.searchSort?.time ?? false,
                                                rating: e.target.checked,
                                                extractionTime: settings.searchSort?.extractionTime ?? true
                                            })}
                                            className="peer sr-only"
                                        />
                                        <div className="peer h-6 w-11 rounded-full bg-neutral-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-neutral-600 peer-checked:after:translate-x-full dark:bg-neutral-700 dark:peer-checked:bg-neutral-500"></div>
                                    </label>
                                </div>

                                {/* 萃取时间排序 */}
                                <div className="flex items-center justify-between">
                                    <div>
                                        <div className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                                            萃取时间排序
                                        </div>
                                        <div className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                                            根据笔记中的萃取时间信息进行排序（如：25s、30秒等）
                                        </div>
                                    </div>
                                    <label className="relative inline-flex cursor-pointer items-center">
                                        <input
                                            type="checkbox"
                                            checked={settings.searchSort?.extractionTime}
                                            onChange={(e) => handleChange('searchSort', {
                                                enabled: settings.searchSort?.enabled ?? true,
                                                time: settings.searchSort?.time ?? false,
                                                rating: settings.searchSort?.rating ?? false,
                                                extractionTime: e.target.checked
                                            })}
                                            className="peer sr-only"
                                        />
                                        <div className="peer h-6 w-11 rounded-full bg-neutral-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-neutral-600 peer-checked:after:translate-x-full dark:bg-neutral-700 dark:peer-checked:bg-neutral-500"></div>
                                    </label>
                                </div>
                                {/* 使用说明 */}
                                <div className="bg-neutral-100 dark:bg-neutral-800 rounded-lg p-4 space-y-3">
                                    <div className="text-xs text-neutral-600 dark:text-neutral-400">
                                        <p className="font-medium mb-2">萃取时间识别格式：</p>
                                        <ul className="space-y-1 ml-3">
                                            <li>• 数字+s：如 25s、30s</li>
                                            <li>• 数字+秒：如 25秒、30秒</li>
                                            <li>• 分:秒格式：如 0:25、1:30</li>
                                            <li>• 描述性文字：如 &ldquo;萃取25秒&rdquo;、&ldquo;extraction 30s&rdquo;</li>
                                        </ul>
                                    </div>
                                    <div className="text-xs text-neutral-500 dark:text-neutral-400">
                                        <p>搜索排序只在搜索模式下显示，并且只有当搜索结果中包含相应数据时才会出现排序选项。</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    
                </div>
            </div>
        </motion.div>
    )
}

export default SearchSortSettings