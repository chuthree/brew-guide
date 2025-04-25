'use client'

import React from 'react'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
} from '@/components/CoffeeBean/ui/select'
import { SortSelectorProps, SORT_OPTIONS, SORT_LABELS } from '../types'

const SortSelector: React.FC<SortSelectorProps> = ({ sortOption, onSortChange }) => {
    return (
        <Select
            value={sortOption}
            onValueChange={(value) => onSortChange(value as any)}
        >
            <SelectTrigger
                variant="minimal"
                className="w-auto min-w-[65px] tracking-wide text-neutral-800 dark:text-neutral-100 transition-colors hover:opacity-80 text-right"
            >
                <div className="flex items-center justify-end w-full">
                    {SORT_LABELS[sortOption]}
                    {!sortOption.includes('desc') ? (
                        <svg className="w-3 h-3 ml-1.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="4" y1="6" x2="11" y2="6" />
                            <line x1="4" y1="12" x2="11" y2="12" />
                            <line x1="4" y1="18" x2="13" y2="18" />
                            <polyline points="15 15 18 18 21 15" />
                            <line x1="18" y1="6" x2="18" y2="18" />
                        </svg>
                    ) : (
                        <svg className="w-3 h-3 ml-1.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="4" y1="6" x2="11" y2="6" />
                            <line x1="4" y1="12" x2="11" y2="12" />
                            <line x1="4" y1="18" x2="13" y2="18" />
                            <polyline points="15 9 18 6 21 9" />
                            <line x1="18" y1="6" x2="18" y2="18" />
                        </svg>
                    )}
                </div>
            </SelectTrigger>
            <SelectContent
                position="popper"
                sideOffset={5}
                className="border-neutral-200/70 dark:border-neutral-800/70 shadow-lg backdrop-blur-sm bg-white/95 dark:bg-neutral-900/95 rounded-lg overflow-hidden"
            >
                {Object.values(SORT_OPTIONS).map((value) => (
                    <SelectItem
                        key={value}
                        value={value}
                        className="tracking-wide text-neutral-800 dark:text-neutral-100 data-[highlighted]:opacity-80 transition-colors"
                    >
                        <div className="flex items-center justify-between w-full">
                            <span>{SORT_LABELS[value].split(' ')[0]}</span>
                            {!value.includes('desc') ? (
                                <svg className="w-3 h-3 ml-1.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="4" y1="6" x2="11" y2="6" />
                                    <line x1="4" y1="12" x2="11" y2="12" />
                                    <line x1="4" y1="18" x2="13" y2="18" />
                                    <polyline points="15 15 18 18 21 15" />
                                    <line x1="18" y1="6" x2="18" y2="18" />
                                </svg>
                            ) : (
                                <svg className="w-3 h-3 ml-1.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="4" y1="6" x2="11" y2="6" />
                                    <line x1="4" y1="12" x2="11" y2="12" />
                                    <line x1="4" y1="18" x2="13" y2="18" />
                                    <polyline points="15 9 18 6 21 9" />
                                    <line x1="18" y1="6" x2="18" y2="18" />
                                </svg>
                            )}
                        </div>
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    )
}

export default SortSelector 