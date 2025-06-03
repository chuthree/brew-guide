'use client'

import React from 'react'

interface NoteFormHeaderProps {
    isEditMode: boolean; // 是否是编辑模式（否则为新建模式）
    onBack?: () => void; // 返回按钮的回调
    onSave?: () => void; // 保存按钮的回调
    showSaveButton?: boolean; // 是否显示保存按钮
    timestamp?: Date; // 可选时间戳，默认为当前时间
}

const NoteFormHeader: React.FC<NoteFormHeaderProps> = ({
    isEditMode,
    onBack,
    onSave,
    showSaveButton = true,
    timestamp = new Date(),
}) => {
    return (
        <div className="flex items-center justify-between w-full">
            <div 
                className="cursor-pointer text-xs font-medium tracking-widest text-neutral-500 dark:text-neutral-400 flex items-center"
            >
                {`${isEditMode ? '编辑记录' : '新建记录'} · ${timestamp.toLocaleString('zh-CN', {
                    month: 'numeric',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: 'numeric',
                })}`}
            </div>
            <div className="flex items-center space-x-6">
                {isEditMode && onBack && (
                    <button
                        type="button"
                        onClick={onBack}
                        className="text-xs font-medium tracking-widest text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300 transition-colors"
                    >
                        返回
                    </button>
                )}
                {showSaveButton && onSave && (
                    <button
                        type="button" 
                        onClick={onSave}
                        className="text-xs font-medium tracking-widest text-emerald-600 dark:text-emerald-500 hover:text-emerald-700 dark:hover:text-emerald-400 font-medium transition-colors"
                    >
                        保存
                    </button>
                )}
            </div>
        </div>
    )
}

export default NoteFormHeader 