'use client'

import React from 'react'
import { AddNoteButtonProps } from '../types'

const AddNoteButton: React.FC<AddNoteButtonProps> = ({ onAddNote }) => {
    return (
        <div className="bottom-action-bar">
            <div className="absolute bottom-full left-0 right-0 h-12 bg-linear-to-t from-neutral-50 dark:from-neutral-900 to-transparent pointer-events-none"></div>
            <div className="relative max-w-[500px] mx-auto flex items-center bg-neutral-50 dark:bg-neutral-900 pb-safe-bottom">
                <div className="grow border-t border-neutral-200 dark:border-neutral-800"></div>
                <button
                    onClick={onAddNote}
                    className="flex items-center justify-center text-xs font-medium text-neutral-600 dark:text-neutral-400 px-3"
                >
                    <span className="mr-1">+</span> 手动添加
                </button>
                <div className="grow border-t border-neutral-200 dark:border-neutral-800"></div>
            </div>
        </div>
    )
}

export default AddNoteButton 