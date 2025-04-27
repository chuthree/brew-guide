'use client'

import React from 'react'
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
    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center"
                    onClick={onClose}
                >
                    <motion.div
                        initial={{ scale: 0.9 }}
                        animate={{ scale: 1 }}
                        exit={{ scale: 0.9 }}
                        transition={{ duration: 0.2 }}
                        className="relative max-w-[90vw] max-h-[90vh] overflow-hidden rounded-lg"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="relative w-full h-full">
                            <Image
                                src={imageUrl}
                                alt={alt}
                                className="object-contain max-h-[90vh]"
                                width={1000}
                                height={1000}
                            />
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