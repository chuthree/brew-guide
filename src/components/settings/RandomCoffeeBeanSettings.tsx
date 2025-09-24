'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { ChevronLeft } from 'lucide-react'
import { SettingsOptions, defaultSettings } from './Settings'

interface RandomCoffeeBeanSettingsProps {
    settings: SettingsOptions
    onClose: () => void
    handleChange: <K extends keyof SettingsOptions>(key: K, value: SettingsOptions[K]) => void
}

const RandomCoffeeBeanSettings: React.FC<RandomCoffeeBeanSettingsProps> = ({
    settings,
    onClose,
    handleChange,
}) => {
    // 获取当前随机咖啡豆设置，如果不存在则使用默认值
    const randomSettings = settings.randomCoffeeBeans || defaultSettings.randomCoffeeBeans!

    // 处理长按随机类型设置变更
    const handleLongPressRandomChange = (enabled: boolean) => {
        const newSettings = {
            ...randomSettings,
            enableLongPressRandomType: enabled
        }
        handleChange('randomCoffeeBeans', newSettings)
    }

    // 处理默认随机类型设置变更
    const handleDefaultRandomTypeChange = (type: 'espresso' | 'filter') => {
        const newSettings = {
            ...randomSettings,
            defaultRandomType: type
        }
        handleChange('randomCoffeeBeans', newSettings)
    }

    // 处理赏味期范围设置变更
    const handleFlavorPeriodRangeChange = (period: keyof typeof randomSettings.flavorPeriodRanges, enabled: boolean) => {
        const newSettings = {
            ...randomSettings,
            flavorPeriodRanges: {
                ...randomSettings.flavorPeriodRanges,
                [period]: enabled
            }
        }
        handleChange('randomCoffeeBeans', newSettings)
    }

    return (
        <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'tween', duration: 0.25 }}
            className="fixed inset-0 z-50 flex flex-col bg-neutral-50 dark:bg-neutral-900 max-w-[500px] mx-auto"
        >
            {/* 头部导航栏 */}
            <div className="relative flex items-center justify-center py-4 pt-safe-top">
                <button
                    onClick={onClose}
                    className="absolute left-4 flex items-center justify-center w-10 h-10 rounded-full text-neutral-700 bg-neutral-100 dark:text-neutral-300 dark:bg-neutral-800 transition-colors"
                >
                    <ChevronLeft className="h-5 w-5" />
                </button>
                <h2 className="text-md font-medium text-neutral-800 dark:text-neutral-200">随机咖啡豆设置</h2>
            </div>

            {/* 滚动内容区域 */}
            <div className="flex-1 overflow-y-auto pb-safe-bottom divide-y divide-neutral-200 dark:divide-neutral-800">
                {/* 顶部渐变阴影 */}
                <div className="sticky top-0 z-10 h-12 w-full bg-linear-to-b from-neutral-50 dark:from-neutral-900 to-transparent pointer-events-none first:border-b-0"></div>
                
                {/* 长按随机类型设置 */}
                <div className="px-6 py-4 -mt-8">
                    <h3 className="text-sm uppercase font-medium tracking-wider text-neutral-500 dark:text-neutral-400 mb-3">
                        随机类型
                    </h3>
                    <div className="flex items-center justify-between">
                        <div>
                            <label className="block text-sm font-medium text-neutral-800 dark:text-neutral-200">
                                长按切换咖啡豆类型
                            </label>
                            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                                开启后，点击随机按钮选择一种类型，长按随机按钮选择另一种类型
                            </p>
                        </div>
                        <label className="relative inline-flex cursor-pointer items-center ml-4">
                            <input
                                type="checkbox"
                                checked={randomSettings.enableLongPressRandomType}
                                onChange={(e) => handleLongPressRandomChange(e.target.checked)}
                                className="peer sr-only"
                            />
                            <div className="peer h-6 w-11 rounded-full bg-neutral-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-neutral-600 peer-checked:after:translate-x-full dark:bg-neutral-700 dark:peer-checked:bg-neutral-500"></div>
                        </label>
                    </div>

                    {/* 默认随机类型设置 - 仅在启用长按功能时显示 */}
                    {randomSettings.enableLongPressRandomType && (
                        <div className="mt-4 p-4 bg-neutral-100 dark:bg-neutral-800 rounded-lg">
                            <label className="block text-sm font-medium text-neutral-800 dark:text-neutral-200 mb-3">
                                长按时选择的类型
                            </label>
                            <div className="flex space-x-3">
                                <button
                                    type="button"
                                    onClick={() => handleDefaultRandomTypeChange('espresso')}
                                    className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
                                        randomSettings.defaultRandomType === 'espresso'
                                            ? 'bg-neutral-800 text-white dark:bg-neutral-100 dark:text-neutral-900'
                                            : 'bg-neutral-200 text-neutral-700 dark:bg-neutral-700 dark:text-neutral-300'
                                    }`}
                                >
                                    意式
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleDefaultRandomTypeChange('filter')}
                                    className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
                                        randomSettings.defaultRandomType === 'filter'
                                            ? 'bg-neutral-800 text-white dark:bg-neutral-100 dark:text-neutral-900'
                                            : 'bg-neutral-200 text-neutral-700 dark:bg-neutral-700 dark:text-neutral-300'
                                    }`}
                                >
                                    手冲
                                </button>
                            </div>
                            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-2">
                                点击随机：选择{randomSettings.defaultRandomType === 'espresso' ? '手冲' : '意式'}豆 • 长按随机：选择{randomSettings.defaultRandomType === 'espresso' ? '意式' : '手冲'}豆
                            </p>
                        </div>
                    )}
                </div>

                {/* 赏味期范围设置 */}
                <div className="px-6 py-4">
                    <h3 className="text-sm uppercase font-medium tracking-wider text-neutral-500 dark:text-neutral-400 mb-3">
                        赏味期范围
                    </h3>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-4">
                        选择随机咖啡豆的赏味期状态范围，不选择任何项目时将包含所有状态
                    </p>
                    
                    <div className="space-y-4">
                        {/* 养豆期 */}
                        <div className="flex items-center justify-between">
                            <div>
                                <span className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
                                    养豆期
                                </span>
                                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                                    正在养豆阶段的咖啡豆
                                </p>
                            </div>
                            <label className="relative inline-flex cursor-pointer items-center">
                                <input
                                    type="checkbox"
                                    checked={randomSettings.flavorPeriodRanges.aging}
                                    onChange={(e) => handleFlavorPeriodRangeChange('aging', e.target.checked)}
                                    className="peer sr-only"
                                />
                                <div className="peer h-6 w-11 rounded-full bg-neutral-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-neutral-600 peer-checked:after:translate-x-full dark:bg-neutral-700 dark:peer-checked:bg-neutral-500"></div>
                            </label>
                        </div>

                        {/* 赏味期 */}
                        <div className="flex items-center justify-between">
                            <div>
                                <span className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
                                    赏味期
                                </span>
                                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                                    处于最佳赏味期的咖啡豆
                                </p>
                            </div>
                            <label className="relative inline-flex cursor-pointer items-center">
                                <input
                                    type="checkbox"
                                    checked={randomSettings.flavorPeriodRanges.optimal}
                                    onChange={(e) => handleFlavorPeriodRangeChange('optimal', e.target.checked)}
                                    className="peer sr-only"
                                />
                                <div className="peer h-6 w-11 rounded-full bg-neutral-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-neutral-600 peer-checked:after:translate-x-full dark:bg-neutral-700 dark:peer-checked:bg-neutral-500"></div>
                            </label>
                        </div>

                        {/* 衰退期 */}
                        <div className="flex items-center justify-between">
                            <div>
                                <span className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
                                    衰退期
                                </span>
                                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                                    已过赏味期的咖啡豆
                                </p>
                            </div>
                            <label className="relative inline-flex cursor-pointer items-center">
                                <input
                                    type="checkbox"
                                    checked={randomSettings.flavorPeriodRanges.decline}
                                    onChange={(e) => handleFlavorPeriodRangeChange('decline', e.target.checked)}
                                    className="peer sr-only"
                                />
                                <div className="peer h-6 w-11 rounded-full bg-neutral-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-neutral-600 peer-checked:after:translate-x-full dark:bg-neutral-700 dark:peer-checked:bg-neutral-500"></div>
                            </label>
                        </div>

                        {/* 冰冻 */}
                        <div className="flex items-center justify-between">
                            <div>
                                <span className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
                                    冰冻
                                </span>
                                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                                    冷冻保存的咖啡豆
                                </p>
                            </div>
                            <label className="relative inline-flex cursor-pointer items-center">
                                <input
                                    type="checkbox"
                                    checked={randomSettings.flavorPeriodRanges.frozen}
                                    onChange={(e) => handleFlavorPeriodRangeChange('frozen', e.target.checked)}
                                    className="peer sr-only"
                                />
                                <div className="peer h-6 w-11 rounded-full bg-neutral-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-neutral-600 peer-checked:after:translate-x-full dark:bg-neutral-700 dark:peer-checked:bg-neutral-500"></div>
                            </label>
                        </div>

                        {/* 在途 */}
                        <div className="flex items-center justify-between">
                            <div>
                                <span className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
                                    在途
                                </span>
                                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                                    运输中的咖啡豆
                                </p>
                            </div>
                            <label className="relative inline-flex cursor-pointer items-center">
                                <input
                                    type="checkbox"
                                    checked={randomSettings.flavorPeriodRanges.inTransit}
                                    onChange={(e) => handleFlavorPeriodRangeChange('inTransit', e.target.checked)}
                                    className="peer sr-only"
                                />
                                <div className="peer h-6 w-11 rounded-full bg-neutral-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-neutral-600 peer-checked:after:translate-x-full dark:bg-neutral-700 dark:peer-checked:bg-neutral-500"></div>
                            </label>
                        </div>

                        {/* 未知 */}
                        <div className="flex items-center justify-between">
                            <div>
                                <span className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
                                    未知状态
                                </span>
                                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                                    无法确定赏味期状态的咖啡豆
                                </p>
                            </div>
                            <label className="relative inline-flex cursor-pointer items-center">
                                <input
                                    type="checkbox"
                                    checked={randomSettings.flavorPeriodRanges.unknown}
                                    onChange={(e) => handleFlavorPeriodRangeChange('unknown', e.target.checked)}
                                    className="peer sr-only"
                                />
                                <div className="peer h-6 w-11 rounded-full bg-neutral-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-neutral-600 peer-checked:after:translate-x-full dark:bg-neutral-700 dark:peer-checked:bg-neutral-500"></div>
                            </label>
                        </div>
                    </div>
                </div>
            </div>
        </motion.div>
    )
}

export default RandomCoffeeBeanSettings