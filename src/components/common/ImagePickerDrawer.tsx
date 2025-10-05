'use client'

import React, { useEffect, useState } from 'react'

interface ImagePickerDrawerProps {
    isOpen: boolean
    onClose: () => void
    onSelectCamera: () => void
    onSelectGallery: () => void
}

const ImagePickerDrawer: React.FC<ImagePickerDrawerProps> = ({
    isOpen,
    onClose,
    onSelectCamera,
    onSelectGallery
}) => {
    const [isVisible, setIsVisible] = useState(false)
    const [shouldRender, setShouldRender] = useState(false)

    useEffect(() => {
        if (isOpen) {
            setShouldRender(true)
            // 短暂延迟以确保组件挂载后再显示动画
            const timer = setTimeout(() => setIsVisible(true), 10)
            return () => clearTimeout(timer)
        } else {
            setIsVisible(false)
            // 等待退出动画完成后再卸载组件
            const timer = setTimeout(() => setShouldRender(false), 300)
            return () => clearTimeout(timer)
        }
    }, [isOpen])

    if (!shouldRender) return null

    return (
        <div 
            className={`
                fixed inset-0 z-40 transition-all duration-300
                ${isVisible 
                    ? 'opacity-100 pointer-events-auto' 
                    : 'opacity-0 pointer-events-none'
                }
            `}
        >
            {/* 遮罩层 */}
            <div 
                className="absolute inset-0 bg-black/20"
                onClick={onClose}
            />
            
            {/* 抽屉内容 */}
            <div className={`
                absolute inset-x-0 bottom-0 max-w-[500px] mx-auto
                bg-white dark:bg-neutral-900 rounded-t-lg shadow-lg
                transition-transform duration-300 ease-[cubic-bezier(0.33,1,0.68,1)]
                ${isVisible ? 'translate-y-0' : 'translate-y-full'}
            `}>
                <div className={`
                    transition-all duration-300 ease-out mt-4 mx-4
                    ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}
                `}>
                    
                    {/* 主要选项 */}
                    <button
                        type="button"
                        onClick={onSelectCamera}
                        className="w-full flex items-center justify-center py-3 mb-2 rounded bg-neutral-100 dark:bg-neutral-800 transition-colors "
                    >
                        <span className="text-sm font-medium text-neutral-800 dark:text-neutral-200">拍照</span>
                    </button>
                    
                    <button
                        type="button"
                        onClick={onSelectGallery}
                        className="w-full flex items-center justify-center py-3 rounded bg-neutral-100 dark:bg-neutral-800 transition-colors"
                    >
                        <span className="text-sm font-medium text-neutral-800 dark:text-neutral-200">相册</span>
                    </button>

                    {/* 取消按钮 - 包含底部安全区域 */}
                    <div className="mx-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="w-full"
                        >
                            <div className="py-4 pb-safe-bottom">
                                <span className="text-sm font-medium text-neutral-600 dark:text-neutral-400">取消</span>
                            </div>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default ImagePickerDrawer