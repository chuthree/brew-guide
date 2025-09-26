'use client'

import React from 'react'
import { ChevronLeft } from 'lucide-react'
import { SettingsOptions } from './Settings'
import { motion } from 'framer-motion'

interface FlavorPeriodSettingsProps {
    settings: SettingsOptions
    onClose: () => void
    handleChange: <K extends keyof SettingsOptions>(key: K, value: SettingsOptions[K]) => void | Promise<void>
}

const FlavorPeriodSettings: React.FC<FlavorPeriodSettingsProps> = ({
    settings,
    onClose,
    handleChange
}) => {

    // 辅助函数：更新自定义赏味期设置
    const updateCustomFlavorPeriod = (
        roastType: 'light' | 'medium' | 'dark',
        field: 'startDay' | 'endDay',
        value: number
    ) => {
        const current = settings.customFlavorPeriod || {
            light: { startDay: 0, endDay: 0 },
            medium: { startDay: 0, endDay: 0 },
            dark: { startDay: 0, endDay: 0 }
        };

        const newCustomFlavorPeriod = {
            ...current,
            [roastType]: {
                ...current[roastType],
                [field]: value
            }
        };
        handleChange('customFlavorPeriod', newCustomFlavorPeriod);
    };

    return (
        <motion.div
            className="fixed inset-0 z-50 flex flex-col bg-neutral-50 dark:bg-neutral-900 max-w-[500px] mx-auto"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{
                duration: 0.35,
                ease: [0.36, 0.66, 0.04, 1]
            }}
        >
            {/* 头部导航栏 */}
            <div className="relative flex items-center justify-center py-4 pt-safe-top">
                <button
                    onClick={onClose}
                    className="absolute left-4 flex items-center justify-center w-10 h-10 rounded-full text-neutral-700 dark:text-neutral-300"
                >
                    <ChevronLeft className="h-5 w-5" />
                </button>
                <h2 className="text-md font-medium text-neutral-800 dark:text-neutral-200">
                    自定义赏味期预设
                </h2>
            </div>

            {/* 滚动内容区域 */}
            <div className="relative flex-1 overflow-y-auto pb-safe-bottom divide-y divide-neutral-200 dark:divide-neutral-800">
                {/* 顶部渐变阴影 */}
                <div className="sticky top-0 z-10 h-12 w-full bg-linear-to-b from-neutral-50 dark:from-neutral-900 to-transparent pointer-events-none first:border-b-0"></div>

                {/* 设置内容 */}
                <div className="px-6 py-4 -mt-4">
                    <div className="space-y-3">
                        {/* 浅烘焙设置 */}
                        <div className="flex items-center justify-between">
                            <div className="text-sm font-medium text-neutral-800 dark:text-neutral-200 w-12">
                                浅烘
                            </div>
                            <div className="flex items-center space-x-3">
                                <div className="flex items-center space-x-1">
                                    <span className="text-sm text-neutral-500 dark:text-neutral-400">养豆</span>
                                    <input
                                        type="number"
                                        min="0"
                                        max="30"
                                        value={settings.customFlavorPeriod?.light?.startDay === 0 ? '' : settings.customFlavorPeriod?.light?.startDay || ''}
                                        placeholder="7"
                                        onChange={(e) => {
                                            const value = e.target.value === '' ? 0 : parseInt(e.target.value) || 0;
                                            updateCustomFlavorPeriod('light', 'startDay', value);
                                        }}
                                        className="w-12 py-1 px-2 text-xs text-center bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded focus:outline-hidden focus:ring-1 focus:ring-neutral-500"
                                    />
                                    <span className="text-sm text-neutral-500 dark:text-neutral-400">天</span>
                                </div>
                                <div className="flex items-center space-x-1">
                                    <span className="text-sm text-neutral-500 dark:text-neutral-400">赏味</span>
                                    <input
                                        type="number"
                                        min="1"
                                        max="90"
                                        value={settings.customFlavorPeriod?.light?.endDay === 0 ? '' : settings.customFlavorPeriod?.light?.endDay || ''}
                                        placeholder="30"
                                        onChange={(e) => {
                                            const value = e.target.value === '' ? 0 : parseInt(e.target.value) || 0;
                                            updateCustomFlavorPeriod('light', 'endDay', value);
                                        }}
                                        className="w-12 py-1 px-2 text-xs text-center bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded focus:outline-hidden focus:ring-1 focus:ring-neutral-500"
                                    />
                                    <span className="text-sm text-neutral-500 dark:text-neutral-400">天</span>
                                </div>
                            </div>
                        </div>

                        {/* 中烘焙设置 */}
                        <div className="flex items-center justify-between">
                            <div className="text-sm font-medium text-neutral-800 dark:text-neutral-200 w-12">
                                中烘
                            </div>
                            <div className="flex items-center space-x-3">
                                <div className="flex items-center space-x-1">
                                    <span className="text-sm text-neutral-500 dark:text-neutral-400">养豆</span>
                                    <input
                                        type="number"
                                        min="0"
                                        max="30"
                                        value={settings.customFlavorPeriod?.medium?.startDay === 0 ? '' : settings.customFlavorPeriod?.medium?.startDay || ''}
                                        placeholder="10"
                                        onChange={(e) => {
                                            const value = e.target.value === '' ? 0 : parseInt(e.target.value) || 0;
                                            updateCustomFlavorPeriod('medium', 'startDay', value);
                                        }}
                                        className="w-12 py-1 px-2 text-xs text-center bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded focus:outline-hidden focus:ring-1 focus:ring-neutral-500"
                                    />
                                    <span className="text-sm text-neutral-500 dark:text-neutral-400">天</span>
                                </div>
                                <div className="flex items-center space-x-1">
                                    <span className="text-sm text-neutral-500 dark:text-neutral-400">赏味</span>
                                    <input
                                        type="number"
                                        min="1"
                                        max="90"
                                        value={settings.customFlavorPeriod?.medium?.endDay === 0 ? '' : settings.customFlavorPeriod?.medium?.endDay || ''}
                                        placeholder="30"
                                        onChange={(e) => {
                                            const value = e.target.value === '' ? 0 : parseInt(e.target.value) || 0;
                                            updateCustomFlavorPeriod('medium', 'endDay', value);
                                        }}
                                        className="w-12 py-1 px-2 text-xs text-center bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded focus:outline-hidden focus:ring-1 focus:ring-neutral-500"
                                    />
                                    <span className="text-sm text-neutral-500 dark:text-neutral-400">天</span>
                                </div>
                            </div>
                        </div>

                        {/* 深烘焙设置 */}
                        <div className="flex items-center justify-between">
                            <div className="text-sm font-medium text-neutral-800 dark:text-neutral-200 w-12">
                                深烘
                            </div>
                            <div className="flex items-center space-x-3">
                                <div className="flex items-center space-x-1">
                                    <span className="text-sm text-neutral-500 dark:text-neutral-400">养豆</span>
                                    <input
                                        type="number"
                                        min="0"
                                        max="30"
                                        value={settings.customFlavorPeriod?.dark?.startDay === 0 ? '' : settings.customFlavorPeriod?.dark?.startDay || ''}
                                        placeholder="14"
                                        onChange={(e) => {
                                            const value = e.target.value === '' ? 0 : parseInt(e.target.value) || 0;
                                            updateCustomFlavorPeriod('dark', 'startDay', value);
                                        }}
                                        className="w-12 py-1 px-2 text-xs text-center bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded focus:outline-hidden focus:ring-1 focus:ring-neutral-500"
                                    />
                                    <span className="text-sm text-neutral-500 dark:text-neutral-400">天</span>
                                </div>
                                <div className="flex items-center space-x-1">
                                    <span className="text-sm text-neutral-500 dark:text-neutral-400">赏味</span>
                                    <input
                                        type="number"
                                        min="1"
                                        max="90"
                                        value={settings.customFlavorPeriod?.dark?.endDay === 0 ? '' : settings.customFlavorPeriod?.dark?.endDay || ''}
                                        placeholder="60"
                                        onChange={(e) => {
                                            const value = e.target.value === '' ? 0 : parseInt(e.target.value) || 0;
                                            updateCustomFlavorPeriod('dark', 'endDay', value);
                                        }}
                                        className="w-12 py-1 px-2 text-xs text-center bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded focus:outline-hidden focus:ring-1 focus:ring-neutral-500"
                                    />
                                    <span className="text-sm text-neutral-500 dark:text-neutral-400">天</span>
                                </div>
                            </div>
                        </div>
                    </div>
                     <h3 className="text-sm text-neutral-500 dark:text-neutral-400 mt-3">
                        添加咖啡豆时，会根据烘焙度自动设定赏味期。
                    </h3>
                </div>
            </div>
        </motion.div>
    )
}

export default FlavorPeriodSettings
