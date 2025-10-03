'use client'

import React from 'react'

interface ButtonGroupProps<T extends string> {
    value: T
    options: { value: T; label: string }[]
    onChange: (value: T) => void
    className?: string
}

export function ButtonGroup<T extends string>({ 
    value, 
    options, 
    onChange, 
    className = '' 
}: ButtonGroupProps<T>) {
    return (
        <div className={`inline-flex rounded bg-neutral-100/60 p-0.5 dark:bg-neutral-800/60 ${className}`}>
            {options.map((option) => (
                <button
                    key={option.value}
                    className={`px-2.5 py-1 text-xs font-medium rounded transition-all ${
                        value === option.value
                            ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100'
                            : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200'
                    }`}
                    onClick={() => {
                        console.log('[ButtonGroup] 🔘 按钮点击', {
                            clickedValue: option.value,
                            currentValue: value,
                            historyStateBefore: window.history.state,
                            historyLengthBefore: window.history.length
                        })
                        
                        onChange(option.value)
                        
                        // 异步检查历史状态变化
                        setTimeout(() => {
                            console.log('[ButtonGroup] ✅ 按钮点击后状态', {
                                newValue: option.value,
                                historyStateAfter: window.history.state,
                                historyLengthAfter: window.history.length
                            })
                        }, 0)
                    }}
                >
                    {option.label}
                </button>
            ))}
        </div>
    )
}