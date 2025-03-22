'use client'

import React, { useState, useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'
import { X } from 'lucide-react'

interface AutocompleteInputProps {
    value: string
    onChange: (value: string) => void
    placeholder?: string
    suggestions: string[]
    label?: string
    className?: string
    required?: boolean
    unit?: string
    clearable?: boolean
    matchStartsWith?: boolean // 是否只匹配开头
    onBlur?: () => void
    containerClassName?: string
    inputType?: 'text' | 'number' | 'tel' | 'email' // 新增输入框类型属性
}

const AutocompleteInput: React.FC<AutocompleteInputProps> = ({
    value,
    onChange,
    placeholder = '',
    suggestions = [],
    label,
    className,
    required = false,
    unit,
    clearable = false,
    matchStartsWith = false,
    onBlur,
    containerClassName,
    inputType = 'text' // 默认为text类型
}) => {
    const [open, setOpen] = useState(false)
    const [inputValue, setInputValue] = useState(value)
    const [filteredSuggestions, setFilteredSuggestions] = useState<string[]>([])
    const [justSelected, setJustSelected] = useState(false) // 跟踪用户是否刚选择过建议项
    const inputRef = useRef<HTMLInputElement>(null)
    const dropdownRef = useRef<HTMLDivElement>(null)
    const containerRef = useRef<HTMLDivElement>(null)

    // 当外部value变化时更新内部state
    useEffect(() => {
        setInputValue(value)
    }, [value])

    // 过滤建议列表
    useEffect(() => {
        if (!inputValue.trim()) {
            setFilteredSuggestions(suggestions.slice(0, 10))
            return
        }

        const lowerCaseInput = inputValue.toLowerCase()
        const filtered = suggestions.filter(suggestion => {
            const lowerCaseSuggestion = suggestion.toLowerCase()
            return matchStartsWith
                ? lowerCaseSuggestion.startsWith(lowerCaseInput)
                : lowerCaseSuggestion.includes(lowerCaseInput)
        }).slice(0, 10)

        setFilteredSuggestions(filtered)
    }, [inputValue, suggestions, matchStartsWith])

    // 处理点击外部关闭下拉菜单
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setOpen(false)
            }
        }

        // 移动端touch事件特殊处理
        function handleTouchOutside(event: TouchEvent) {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setOpen(false)
            }
        }

        document.addEventListener('mousedown', handleClickOutside)
        document.addEventListener('touchstart', handleTouchOutside)

        return () => {
            document.removeEventListener('mousedown', handleClickOutside)
            document.removeEventListener('touchstart', handleTouchOutside)
        }
    }, [])

    // 处理输入变化
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newValue = e.target.value;
        setInputValue(newValue);
        setJustSelected(false); // 用户输入时，重置选择状态

        // 立即调用onChange以确保父组件及时获取新值
        onChange(newValue);

        if (newValue.trim()) {
            setOpen(true);
        }
    };

    // 处理选择建议
    const handleSelectSuggestion = (selectedValue: string) => {
        setInputValue(selectedValue)
        onChange(selectedValue)
        setOpen(false)
        setFilteredSuggestions([]) // 清空过滤后的建议列表
        setJustSelected(true) // 标记用户刚选择过建议项

        // 防止选择后立即失焦导致值丢失
        setTimeout(() => {
            inputRef.current?.focus()
        }, 10)
    }

    // 处理失去焦点
    const handleBlur = () => {
        // 延迟关闭下拉菜单，避免点击选项时错过点击事件
        setTimeout(() => {
            // 检查当前文档焦点是否在下拉菜单内，避免点击下拉菜单项时立即关闭
            if (
                dropdownRef.current &&
                !dropdownRef.current.contains(document.activeElement) &&
                document.activeElement !== inputRef.current
            ) {
                setOpen(false)
                onChange(inputValue) // 确保更新外部值
                onBlur?.()
            }
        }, 150)
    }

    // 处理清除
    const handleClear = (e: React.MouseEvent) => {
        e.stopPropagation()
        e.preventDefault()
        setInputValue('')
        onChange('')
        setOpen(false)
        inputRef.current?.focus()
    }

    // 处理键盘事件
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && inputValue) {
            onChange(inputValue)
            setOpen(false)
        } else if (e.key === 'Escape') {
            setOpen(false)
        } else if (e.key === 'ArrowDown' && !open && filteredSuggestions.length > 0) {
            setOpen(true)
        }
    }

    // 处理聚焦
    const handleFocus = () => {
        // 如果用户刚选择过建议项，则不打开下拉菜单
        if (justSelected) {
            setJustSelected(false)
            return
        }

        // 否则，如果有建议项，则打开下拉菜单
        if (filteredSuggestions.length > 0) {
            setOpen(true)
        }
    }

    // 处理标签点击
    const handleLabelClick = (e: React.MouseEvent) => {
        e.preventDefault()
        inputRef.current?.focus()
    }

    // 阻止下拉菜单的触摸事件传播
    const handleDropdownTouch = (e: React.TouchEvent) => {
        e.stopPropagation()
    }

    // 阻止滑动默认行为
    const handleTouchMove = (e: React.TouchEvent) => {
        if (open) {
            e.stopPropagation()
        }
    }

    // 处理下拉菜单项点击
    const handleItemClick = (suggestion: string, e: React.MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()
        handleSelectSuggestion(suggestion)
    }

    return (
        <div
            ref={containerRef}
            className={cn("space-y-2", containerClassName)}
            onTouchMove={handleTouchMove}
        >
            {label && (
                <label
                    onClick={handleLabelClick}
                    className="block text-xs font-medium text-neutral-500 dark:text-neutral-400 cursor-pointer"
                >
                    {label} {required && <span className="text-red-500">*</span>}
                </label>
            )}

            <div className="relative">
                <div className="relative w-full">
                    <input
                        ref={inputRef}
                        type={inputType}
                        value={inputValue}
                        onChange={handleInputChange}
                        onFocus={handleFocus}
                        onBlur={handleBlur}
                        onKeyDown={handleKeyDown}
                        placeholder={placeholder}
                        className={cn(
                            "w-full py-2 bg-transparent outline-none border-b border-neutral-300 dark:border-neutral-700 focus:border-neutral-800 dark:focus:border-neutral-400",
                            className
                        )}
                    />
                    {unit && !clearable && (
                        <span className="absolute right-0 bottom-2 text-neutral-500 dark:text-neutral-400">
                            {unit}
                        </span>
                    )}
                    {unit && clearable && (
                        <span className="absolute right-6 bottom-2 text-neutral-500 dark:text-neutral-400">
                            {unit}
                        </span>
                    )}
                    {clearable && inputValue && (
                        <button
                            type="button"
                            onClick={handleClear}
                            className="absolute right-0 bottom-2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    )}
                </div>

                {open && filteredSuggestions.length > 0 && (
                    <div
                        ref={dropdownRef}
                        onTouchStart={handleDropdownTouch}
                        className="absolute left-0 right-0 mt-1 z-50 max-h-[200px] overflow-auto rounded-md border border-neutral-200 dark:border-neutral-800 shadow-lg bg-white dark:bg-neutral-900"
                    >
                        <ul className="py-1">
                            {filteredSuggestions.map((suggestion, index) => (
                                <li
                                    key={index}
                                    className="px-3 py-3 text-sm cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800 active:bg-neutral-200 dark:active:bg-neutral-700"
                                    onClick={(e) => handleItemClick(suggestion, e)}
                                    onTouchStart={(e) => e.stopPropagation()}
                                >
                                    {suggestion}
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>
        </div>
    )
}

export default AutocompleteInput 