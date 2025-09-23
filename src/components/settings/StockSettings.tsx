'use client'

import React, { useState, useEffect } from 'react'
import { ChevronLeft } from 'lucide-react'
import { motion } from 'framer-motion'
import { SettingsOptions } from './Settings'
import hapticsUtils from '@/lib/ui/haptics'

interface StockSettingsProps {
    settings: SettingsOptions
    onClose: () => void
    handleChange: <K extends keyof SettingsOptions>(key: K, value: SettingsOptions[K]) => void | Promise<void>
}

const StockSettings: React.FC<StockSettingsProps> = ({
    settings,
    onClose,
    handleChange
}) => {
    const [decrementValue, setDecrementValue] = useState<string>('')
    const [decrementPresets, setDecrementPresets] = useState<number[]>(
        settings.decrementPresets || []
    )

    useEffect(() => {
        if (settings.decrementPresets) {
            setDecrementPresets(settings.decrementPresets);
        }
    }, [settings.decrementPresets]);

    const addDecrementPreset = () => {
        const value = parseFloat(decrementValue)
        if (!isNaN(value) && value > 0) {
            const formattedValue = parseFloat(value.toFixed(1))
            if (!decrementPresets.includes(formattedValue)) {
                const newPresets = [...decrementPresets, formattedValue].sort((a, b) => a - b)
                setDecrementPresets(newPresets)
                handleChange('decrementPresets', newPresets)
                setDecrementValue('')
                if (settings.hapticFeedback) {
                    hapticsUtils.light()
                }
            }
        }
    }

    const removeDecrementPreset = (value: number) => {
        const newPresets = decrementPresets.filter(v => v !== value)
        setDecrementPresets(newPresets)
        handleChange('decrementPresets', newPresets)
        if (settings.hapticFeedback) {
            hapticsUtils.light()
        }
    }

    return (
        <motion.div
            className="fixed inset-0 z-50 flex flex-col bg-neutral-50 dark:bg-neutral-900 max-w-[500px] mx-auto"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
        >
            <div className="relative flex items-center justify-center py-4 pt-safe-top">
                <button
                    onClick={onClose}
                    className="absolute left-4 flex items-center justify-center w-10 h-10 rounded-full text-neutral-700 bg-neutral-100 dark:text-neutral-300 dark:bg-neutral-800 transition-colors"
                >
                    <ChevronLeft className="h-5 w-5" />
                </button>
                <h2 className="text-lg font-medium text-neutral-800 dark:text-neutral-200">
                    库存扣除预设值
                </h2>
            </div>

            <div className="relative flex-1 overflow-y-auto pb-safe-bottom">
                <div className="sticky top-0 z-10 h-12 w-full bg-linear-to-b from-neutral-50 dark:from-neutral-900 to-transparent pointer-events-none"></div>
                <div className="px-6 py-4 -mt-8">
                    <div className="flex gap-2 mb-3 flex-wrap">
                        {decrementPresets.map((value) => (
                            <button
                                key={value}
                                onClick={() => removeDecrementPreset(value)}
                                className="px-3 py-1.5 bg-neutral-100 dark:bg-neutral-800 rounded text-sm font-medium text-neutral-800 dark:text-neutral-200 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
                            >
                                -{value}g ×
                            </button>
                        ))}

                        <div className="flex h-9">
                            <input
                                type="text"
                                inputMode="decimal"
                                value={decrementValue}
                                onChange={(e) => {
                                    const value = e.target.value.replace(/[^0-9.]/g, '');
                                    const dotCount = (value.match(/\./g) || []).length;
                                    let sanitizedValue = dotCount > 1 ?
                                        value.substring(0, value.lastIndexOf('.')) :
                                        value;
                                    const dotIndex = sanitizedValue.indexOf('.');
                                    if (dotIndex !== -1 && dotIndex < sanitizedValue.length - 2) {
                                        sanitizedValue = sanitizedValue.substring(0, dotIndex + 2);
                                    }
                                    setDecrementValue(sanitizedValue);
                                }}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault()
                                        addDecrementPreset()
                                    }
                                }}
                                placeholder="克数"
                                className="w-16 py-1.5 px-2 text-sm bg-neutral-100 dark:bg-neutral-800  rounded-l rounded-r-none focus:outline-hidden focus:ring-1 focus:ring-neutral-500"
                            />
                            <button
                                onClick={addDecrementPreset}
                                disabled={!decrementValue || isNaN(parseFloat(decrementValue)) || parseFloat(decrementValue) <= 0}
                                className="py-1.5 px-2 bg-neutral-700 dark:bg-neutral-600 text-white rounded-r disabled:opacity-20 disabled:cursor-not-allowed text-sm"
                            >
                                +
                            </button>
                        </div>
                    </div>
                    <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-3">
                        点击预设值可以删除，输入克数后按回车或点击“+”可以添加新的预设值。
                    </p>
                </div>
            </div>
        </motion.div>
    )
}

export default StockSettings
