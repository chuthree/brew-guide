import React from 'react'
import Image from 'next/image'
import { BeanImageGalleryProps } from './types'

const BeanImageGallery: React.FC<BeanImageGalleryProps> = ({ beansWithImages, imagesLoaded }) => {
    return (
        <div className="relative w-full flex justify-center pt-8 pb-2">
            <div className="flex justify-center items-center relative w-full h-28">
                {beansWithImages.map((bean, index) => {
                    // 如果没有图片，跳过渲染
                    if (!bean.image) return null

                    // 计算半圆形的位置
                    const totalBeans = beansWithImages.length
                    // 修改角度计算，使圆弧的角度范围更小（从-60°到60°，共120°范围）
                    const angleRange = Math.PI / 2.5 // 约54度
                    // 增大角度间隔系数，使卡片分布更分散
                    const spacingFactor = 1 // 增加间距的系数
                    
                    // 从中间开始计算角度，使卡片从中间向两边扩散
                    // 计算相对于中心的偏移量（偶数个时中点在最中间两个之间，奇数个时中点在正中间）
                    const centerOffset = (index - (totalBeans - 1) / 2)
                    // 计算角度：以0为中心，向两边扩散
                    const angle = spacingFactor * ((2 * angleRange) / (totalBeans + 1)) * centerOffset
                    
                    const radius = 180 // 半径大小
                    
                    // 计算x和y位置 (使用 sin/cos 相对顶部顺时针角度计算)
                    // 添加横向缩放因子1.5，增加图片之间的横向距离
                    const horizontalStretchFactor = 1.5
                    const x = Math.sin(angle) * radius * horizontalStretchFactor
                    const y = -Math.cos(angle) * radius // y轴向下为正，顶部为负
                    
                    // 计算旋转角度 - 使卡片垂直于半径向外
                    const rotate = (angle * (100 / Math.PI)) // 调整旋转角度，使其指向外侧

                    // 计算动画延迟 - 按照从左到右的顺序
                    // 先获取所有豆子的x坐标，按照从左到右排序后获取当前豆子的序号
                    const allXPositions = beansWithImages.map((_, i) => {
                        const offset = (i - (totalBeans - 1) / 2)
                        return Math.sin(spacingFactor * ((2 * angleRange) / (totalBeans + 1)) * offset) * radius * horizontalStretchFactor
                    })
                    const sortedIndices = [...allXPositions].map((x, i) => ({x, i})).sort((a, b) => a.x - b.x).map(item => item.i)
                    const orderIndex = sortedIndices.indexOf(index)
                    const animationDelay = orderIndex * 150 // 每个豆子延迟150ms
                    
                    return (
                        <div 
                            key={`bean-card-${bean.id}`}
                            className="absolute w-14 h-20 transform -translate-x-1/2 -translate-y-1/2 shadow-xs rounded-sm border border-white/90 dark:border-neutral-700/90 overflow-hidden transition-all duration-700"
                            style={{
                                left: `calc(50% + ${x}px)`,
                                top: `calc(100% + ${y}px - -80px)`, // y 在顶部时为负，因此整体下移
                                transform: `translate(-50%, 0%) rotate(${rotate}deg)`, // 使用新的旋转角度
                                zIndex: index + 1,
                                backgroundColor: '#fff',
                                opacity: imagesLoaded ? 1 : 0,
                                filter: imagesLoaded ? 'blur(0)' : 'blur(10px)',
                                transitionDelay: `${animationDelay}ms`,
                            }}
                        >
                            <Image
                                src={bean.image}
                                alt={bean.name || '咖啡豆图片'}
                                fill
                                sizes="48px"
                                className="object-cover"
                                priority={false}
                                loading="lazy"
                            />
                            <div className="absolute inset-0 border-2 border-white/30 dark:border-neutral-700/30 rounded-sm"></div>
                        </div>
                    )
                })}
                
                {/* 添加底部渐变阴影效果 */}
                <div className="absolute -bottom-16 left-0 right-0 h-32 pointer-events-none" 
                    style={{
                        zIndex: 10
                    }}
                >
                    <div className="absolute bottom-0 left-0 right-0 h-32 pointer-events-none dark:hidden" 
                        style={{
                            background: 'linear-gradient(to bottom, transparent, rgb(249, 249, 249) 100%, rgb(249, 249, 249) 100%)',
                            opacity: 1
                        }}
                    ></div>
                    <div className="absolute bottom-0 left-0 right-0 h-32 pointer-events-none hidden dark:block" 
                        style={{
                            background: 'linear-gradient(to bottom, transparent, rgb(23, 23, 23) 100%, rgb(23, 23, 23) 100%)',
                            opacity: 1
                        }}
                    ></div>
                </div>
            </div>
        </div>
    )
}

export default BeanImageGallery 