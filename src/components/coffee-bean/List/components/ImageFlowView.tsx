'use client'

import React, { useMemo } from 'react'
import Image from 'next/image'
import { ExtendedCoffeeBean } from '../types'

interface ImageFlowViewProps {
    filteredBeans: ExtendedCoffeeBean[]
}

const ImageFlowView: React.FC<ImageFlowViewProps> = ({
    filteredBeans
}) => {
    // 过滤出有图片的咖啡豆
    const beansWithImages = filteredBeans.filter(bean => bean.image && bean.image.trim() !== '')

    // 简单的两列分配：奇数索引放左列，偶数索引放右列
    const { leftColumn, rightColumn } = useMemo(() => {
        const left: ExtendedCoffeeBean[] = []
        const right: ExtendedCoffeeBean[] = []

        beansWithImages.forEach((bean, index) => {
            if (index % 2 === 0) {
                left.push(bean)
            } else {
                right.push(bean)
            }
        })

        return { leftColumn: left, rightColumn: right }
    }, [beansWithImages])

    if (beansWithImages.length === 0) {
        return (
            <div className="flex h-32 items-center justify-center text-[10px] tracking-widest text-neutral-500 dark:text-neutral-400">
                [ 没有找到带图片的咖啡豆 ]
            </div>
        )
    }

    return (
        <div className="w-full h-full overflow-y-auto scroll-with-bottom-bar">
            <div className="min-h-full pb-20 px-6">
                <div className="flex gap-4 pt-4">
                    {/* 左列 */}
                    <div className="flex-1 flex flex-col gap-4">
                        {leftColumn.map((bean) => (
                            <div key={bean.id} className="w-full">
                                <Image
                                    src={bean.image!}
                                    alt={bean.name || '咖啡豆图片'}
                                    width={0}
                                    height={0}
                                    className="w-full h-auto"
                                    sizes="50vw"
                                    priority={false}
                                    loading="lazy"
                                    unoptimized
                                />
                            </div>
                        ))}
                    </div>

                    {/* 右列 */}
                    <div className="flex-1 flex flex-col gap-4">
                        {rightColumn.map((bean) => (
                            <div key={bean.id} className="w-full">
                                <Image
                                    src={bean.image!}
                                    alt={bean.name || '咖啡豆图片'}
                                    width={0}
                                    height={0}
                                    className="w-full h-auto"
                                    sizes="50vw"
                                    priority={false}
                                    loading="lazy"
                                    unoptimized
                                />
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    )
}

export default ImageFlowView
