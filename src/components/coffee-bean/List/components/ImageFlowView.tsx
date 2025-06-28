'use client'

import React, { useMemo, useState, useEffect } from 'react'
import Image from 'next/image'
import { ExtendedCoffeeBean } from '../types'
import BeanDetailModal from '../../Detail/BeanDetailModal'

interface ImageFlowViewProps {
    filteredBeans: ExtendedCoffeeBean[]
    onEdit?: (bean: ExtendedCoffeeBean) => void
    onDelete?: (bean: ExtendedCoffeeBean) => void
    onShare?: (bean: ExtendedCoffeeBean) => void
}

// 图片尺寸缓存
const imageSizeCache = new Map<string, { width: number; height: number }>()

// 获取图片尺寸的 Promise
const getImageSize = (src: string): Promise<{ width: number; height: number }> => {
    if (imageSizeCache.has(src)) {
        return Promise.resolve(imageSizeCache.get(src)!)
    }

    return new Promise((resolve) => {
        const img = new window.Image()
        img.onload = () => {
            const size = { width: img.naturalWidth, height: img.naturalHeight }
            imageSizeCache.set(src, size)
            resolve(size)
        }
        img.onerror = () => {
            // 如果图片加载失败，返回默认比例
            const size = { width: 300, height: 400 }
            imageSizeCache.set(src, size)
            resolve(size)
        }
        img.src = src
    })
}

const ImageFlowView: React.FC<ImageFlowViewProps> = ({
    filteredBeans,
    onEdit,
    onDelete,
    onShare
}) => {
    // 添加详情弹窗状态
    const [detailBean, setDetailBean] = useState<ExtendedCoffeeBean | null>(null);
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [imageSizes, setImageSizes] = useState<Map<string, { width: number; height: number }>>(new Map())
    const [isLoading, setIsLoading] = useState(true)

    // 处理详情点击
    const handleDetailClick = (bean: ExtendedCoffeeBean) => {
        setDetailBean(bean);
        setShowDetailModal(true);
    };

    // 处理详情弹窗关闭
    const handleDetailClose = () => {
        setShowDetailModal(false);
        // 延迟清除 bean 数据，让 Drawer 有时间播放关闭动画
        setTimeout(() => {
            setDetailBean(null);
        }, 300); // 300ms 应该足够 Drawer 的关闭动画
    };

    // 过滤出有图片的咖啡豆 - 使用 useMemo 避免每次渲染都创建新数组
    const beansWithImages = useMemo(() =>
        filteredBeans.filter(bean => bean.image && bean.image.trim() !== ''),
        [filteredBeans]
    )

    // 创建一个稳定的图片URL列表用于依赖比较
    const imageUrls = useMemo(() =>
        beansWithImages.map(bean => bean.image).filter(Boolean).sort(),
        [beansWithImages]
    )

    // 预加载所有图片尺寸
    useEffect(() => {
        if (beansWithImages.length === 0) {
            setIsLoading(false)
            return
        }

        const loadImageSizes = async () => {
            setIsLoading(true)

            // 只加载尚未缓存的图片
            const uncachedBeans = beansWithImages.filter(bean =>
                bean.image && !imageSizeCache.has(bean.image)
            )

            if (uncachedBeans.length === 0) {
                // 所有图片都已缓存，直接从缓存构建 Map
                const newSizes = new Map<string, { width: number; height: number }>()
                beansWithImages.forEach(bean => {
                    if (bean.image && imageSizeCache.has(bean.image)) {
                        newSizes.set(bean.id, imageSizeCache.get(bean.image)!)
                    }
                })
                setImageSizes(newSizes)
                setIsLoading(false)
                return
            }

            const sizePromises = uncachedBeans.map(async (bean) => {
                if (bean.image) {
                    const size = await getImageSize(bean.image)
                    return { id: bean.id, size }
                }
                return null
            })

            const results = await Promise.all(sizePromises)
            const newSizes = new Map<string, { width: number; height: number }>()

            // 添加所有相关图片的尺寸（包括已缓存的）
            beansWithImages.forEach(bean => {
                if (bean.image && imageSizeCache.has(bean.image)) {
                    newSizes.set(bean.id, imageSizeCache.get(bean.image)!)
                }
            })

            // 添加新加载的尺寸
            results.forEach((result) => {
                if (result) {
                    newSizes.set(result.id, result.size)
                }
            })

            setImageSizes(newSizes)
            setIsLoading(false)
        }

        loadImageSizes()
    }, [imageUrls, beansWithImages]) // 使用稳定的 imageUrls 作为依赖



    // 智能瀑布流分配算法
    const { leftColumn, rightColumn } = useMemo(() => {
        if (isLoading || imageSizes.size === 0) {
            // 加载中时使用简单分配
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
        }

        const left: ExtendedCoffeeBean[] = []
        const right: ExtendedCoffeeBean[] = []
        let leftHeight = 0
        let rightHeight = 0

        // 计算每列的实际宽度
        // 容器总宽度 = 屏幕宽度 - 左右 padding (48px) - 列间距 (16px)
        // 每列宽度 = (总宽度 - 间距) / 2
        const screenWidth = typeof window !== 'undefined' ? window.innerWidth : 375
        const totalPadding = 48 // px-6 = 24px * 2
        const columnGap = 16 // gap-4 = 16px
        const containerWidth = Math.floor((screenWidth - totalPadding - columnGap) / 2)

        // 为了更好的视觉效果，先按图片高宽比排序
        // 将图片按高宽比分组，避免连续的长图片都分配到同一列
        const beansWithRatio = beansWithImages.map((bean) => {
            const imageSize = imageSizes.get(bean.id)
            if (!imageSize) return { bean, ratio: 1.33, displayHeight: containerWidth * 1.33 }

            const ratio = imageSize.height / imageSize.width
            const displayHeight = ratio * containerWidth
            return { bean, ratio, displayHeight }
        }).filter(item => item !== null)

        // 使用更智能的分配策略
        beansWithRatio.forEach((item) => {
            // 选择当前高度较小的列
            if (leftHeight <= rightHeight) {
                left.push(item.bean)
                leftHeight += item.displayHeight + 16 // 16px 是 gap-4 的间距
            } else {
                right.push(item.bean)
                rightHeight += item.displayHeight + 16
            }
        })

        return { leftColumn: left, rightColumn: right }
    }, [beansWithImages, isLoading, imageSizes])

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
                {isLoading ? (
                    <div className="flex h-32 items-center justify-center text-[10px] tracking-widest text-neutral-500 dark:text-neutral-400">
                        [ 正在优化布局... ]
                    </div>
                ) : (
                    <div className="flex gap-4 pt-4">
                        {/* 左列 */}
                        <div className="flex-1 flex flex-col gap-4">
                            {leftColumn.map((bean) => (
                                <div key={bean.id} className="w-full cursor-pointer" onClick={() => handleDetailClick(bean)}>
                                    <Image
                                        src={bean.image!}
                                        alt={bean.name || '咖啡豆图片'}
                                        width={0}
                                        height={0}
                                        className="w-full h-auto rounded-[2px] hover:opacity-90 transition-opacity"
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
                                <div key={bean.id} className="w-full cursor-pointer" onClick={() => handleDetailClick(bean)}>
                                    <Image
                                        src={bean.image!}
                                        alt={bean.name || '咖啡豆图片'}
                                        width={0}
                                        height={0}
                                        className="w-full h-auto rounded-[2px] hover:opacity-90 transition-opacity"
                                        sizes="50vw"
                                        priority={false}
                                        loading="lazy"
                                        unoptimized
                                    />
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* 详情弹窗 */}
            <BeanDetailModal
                isOpen={showDetailModal}
                bean={detailBean}
                onClose={handleDetailClose}
                onEdit={onEdit}
                onDelete={onDelete}
                onShare={onShare}
            />
        </div>
    )
}

export default ImageFlowView
