'use client'

import React from 'react'
import { motion } from 'framer-motion'

interface StarRatingProps {
    value: number
    maxValue?: number
    size?: 'sm' | 'md' | 'lg'
    color?: string
    onChange?: (value: number) => void
    readonly?: boolean
}

const StarRating: React.FC<StarRatingProps> = ({
    value,
    maxValue = 5,
    size = 'md',
    color = 'text-amber-400',
    onChange,
    readonly = false
}) => {
    const starSizes = {
        sm: 'w-3 h-3',
        md: 'w-4 h-4',
        lg: 'w-5 h-5'
    }

    const containerSizes = {
        sm: 'gap-1',
        md: 'gap-1.5',
        lg: 'gap-2'
    }

    const handleStarClick = (rating: number) => {
        if (readonly) return
        // 允许取消选择（如果点击当前选中的星星）
        const newRating = rating === value ? 0 : rating
        onChange?.(newRating)
    }

    return (
        <div className={`flex items-center ${containerSizes[size]}`}>
            {[...Array(maxValue)].map((_, index) => {
                const starValue = index + 1
                const isFilled = starValue <= value

                return (
                    <motion.button
                        key={index}
                        type="button"
                        whileTap={readonly ? {} : { scale: 0.9 }}
                        className={`${starSizes[size]} transition-colors focus:outline-none ${readonly ? 'cursor-default' : 'cursor-pointer'}`}
                        onClick={() => handleStarClick(starValue)}
                    >
                        <svg
                            viewBox="0 0 24 24"
                            fill={isFilled ? 'currentColor' : 'none'}
                            stroke="currentColor"
                            strokeWidth="2"
                            className={`${isFilled ? color : 'text-neutral-300 dark:text-neutral-700'}`}
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
                            />
                        </svg>
                    </motion.button>
                )
            })}
        </div>
    )
}

export default StarRating 