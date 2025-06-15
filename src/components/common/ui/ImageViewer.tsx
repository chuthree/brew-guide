'use client'

import React, { useState } from 'react'
import Image from 'next/image'
import { motion, AnimatePresence } from 'framer-motion'

interface ImageViewerProps {
    isOpen: boolean
    imageUrl: string
    alt: string
    onClose: () => void
}

const ImageViewer: React.FC<ImageViewerProps> = ({
    isOpen,
    imageUrl,
    alt,
    onClose
}) => {
    const [hasError, setHasError] = useState(false);

    // 重置错误状态当弹窗打开时
    React.useEffect(() => {
        if (isOpen) {
            setHasError(false);
        }
    }, [isOpen]);

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="fixed inset-0 z-100 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4"
                    onClick={(e) => {
                        e.stopPropagation()
                        onClose()
                    }}
                >
                    <motion.div
                        initial={{ scale: 0.9 }}
                        animate={{ scale: 1 }}
                        exit={{ scale: 0.9 }}
                        transition={{ duration: 0.2 }}
                        className="relative max-h-[90vh] overflow-hidden"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="relative flex items-center justify-center min-h-[280px]">
                            {hasError ? (
                                <div className="text-white text-center p-4">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto mb-2 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    <p>图片加载失败</p>
                                </div>
                            ) : (
                                <Image
                                    src={imageUrl}
                                    alt={alt}
                                    className="max-h-[80vh] w-auto"
                                    width={0}
                                    height={1000}
                                    style={{ 
                                        background: 'transparent'
                                    }}
                                    onError={() => setHasError(true)}
                                    priority
                                />
                            )}
                        </div>
                        
                        <button
                            className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-full bg-neutral-800/50 text-white"
                            onClick={(e) => {
                                e.stopPropagation()
                                onClose()
                            }}
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    )
}

export default ImageViewer 