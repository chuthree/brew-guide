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
    const [isImageLoading, setIsImageLoading] = useState(true);
    const [hasError, setHasError] = useState(false);

    // 重置状态当弹窗打开时
    React.useEffect(() => {
        if (isOpen) {
            setIsImageLoading(true);
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
                    className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
                    onClick={onClose}
                >
                    <motion.div
                        initial={{ scale: 0.9 }}
                        animate={{ scale: 1 }}
                        exit={{ scale: 0.9 }}
                        transition={{ duration: 0.2 }}
                        className="relative max-w-[90vw] max-h-[90vh] overflow-hidden"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="relative flex items-center justify-center min-w-[280px] min-h-[280px]">
                            {isImageLoading && !hasError && (
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <div className="w-10 h-10 border-4 border-neutral-300 border-t-white rounded-full animate-spin"></div>
                                </div>
                            )}
                            
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
                                    className={`max-w-full max-h-[80vh] object-contain transition-opacity duration-300 ${isImageLoading ? 'opacity-0' : 'opacity-100'}`}
                                    width={1000}
                                    height={1000}
                                    style={{ 
                                        objectFit: 'contain',
                                        background: 'transparent'
                                    }}
                                    onLoadingComplete={() => setIsImageLoading(false)}
                                    onError={() => {
                                        setIsImageLoading(false);
                                        setHasError(true);
                                    }}
                                    priority
                                />
                            )}
                        </div>
                        
                        <button 
                            className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-full bg-neutral-800/50 text-white"
                            onClick={onClose}
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