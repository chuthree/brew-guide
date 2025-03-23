'use client'

import React, { useState, useEffect, useMemo } from 'react'
import Image from 'next/image'
import { motion, AnimatePresence } from 'framer-motion'
import { Stage } from '@/lib/config'

// 定义动画配置类型
interface AnimationConfig {
    maxIndex: number;
    isStacking?: boolean;
}

interface PourVisualizerProps {
    isRunning: boolean
    currentStage: number
    stages: Stage[]
    countdownTime: number | null
    equipmentId?: string // 添加设备ID属性
    isWaiting?: boolean // 添加是否处于等待阶段的属性
}

const PourVisualizer: React.FC<PourVisualizerProps> = ({
    isRunning,
    currentStage,
    stages,
    countdownTime,
    equipmentId = 'V60', // 默认为V60
    isWaiting = false // 默认不是等待阶段
}) => {
    const [currentMotionIndex, setCurrentMotionIndex] = useState(1)
    const [isPouring, setIsPouring] = useState(false)
    const [valveStatus, setValveStatus] = useState<'open' | 'closed'>('closed') // 添加阀门状态
    const [imagesPreloaded, setImagesPreloaded] = useState(false)
    const [displayedIceIndices, setDisplayedIceIndices] = useState<number[]>([])

    // 定义可用的动画图片及其最大索引
    const availableAnimations = useMemo<Record<string, AnimationConfig>>(() => ({
        center: { maxIndex: 3 },  // center 只有3张图片
        circle: { maxIndex: 4 },   // circle 有4张图片
        ice: { maxIndex: 4, isStacking: true }  // 冰块动画，有4张图片，需要叠加显示
    }), [])

    // 需要预加载的图片列表
    const imagesToPreload = useMemo(() => [
        '/images/v60-base.svg',
        '/images/valve-open.svg',
        '/images/valve-closed.svg',
        // center 动画图片
        '/images/pour-center-motion-1.svg',
        '/images/pour-center-motion-2.svg',
        '/images/pour-center-motion-3.svg',
        // circle 动画图片
        '/images/pour-circle-motion-1.svg',
        '/images/pour-circle-motion-2.svg',
        '/images/pour-circle-motion-3.svg',
        '/images/pour-circle-motion-4.svg',
        // ice 动画图片
        '/images/pour-ice-motion-1.svg',
        '/images/pour-ice-motion-2.svg',
        '/images/pour-ice-motion-3.svg',
        '/images/pour-ice-motion-4.svg'
    ], [])

    // 预加载所有图像
    useEffect(() => {
        // 如果没有图像需要预加载，直接设置为完成
        if (imagesToPreload.length === 0) {
            setImagesPreloaded(true)
            return
        }

        let loadedCount = 0
        const errors: Record<string, boolean> = {}

        imagesToPreload.forEach(src => {
            const img = new globalThis.Image()
            img.onload = () => {
                loadedCount++
                if (loadedCount === imagesToPreload.length) {
                    setImagesPreloaded(true)
                }
            }
            img.onerror = () => {
                errors[src] = true
                loadedCount++
                if (loadedCount === imagesToPreload.length) {
                    setImagesPreloaded(true)
                }
            }
            img.src = src
        })

        return () => {
            // 清理加载中的图像
            imagesToPreload.forEach(() => {
                const img = new globalThis.Image()
                img.src = ''
            })
        }
    }, [imagesToPreload])

    // 跟踪当前阶段的经过时间，用于确定是否在注水时间内
    useEffect(() => {
        if (!isRunning || currentStage < 0 || countdownTime !== null || isWaiting) {
            setIsPouring(false)
            return
        }

        // 立即检查当前阶段是否有注水时间
        const currentPourTime = stages[currentStage]?.pourTime

        // 如果 pourTime 明确设置为 0，则不显示注水动画
        if (currentPourTime === 0) {
            setIsPouring(false)
            return
        }

        // 如果有注水时间，立即设置为注水状态
        if (currentPourTime && currentPourTime > 0) {
            setIsPouring(true)
        } else {
            setIsPouring(false)
            return
        }

        let secondsElapsed = 0

        const timer = setInterval(() => {
            secondsElapsed += 1

            // 判断是否在注水时间内
            setIsPouring(secondsElapsed <= currentPourTime)
        }, 1000)

        return () => clearInterval(timer)
    }, [isRunning, currentStage, countdownTime, stages, isWaiting])

    // 只有在注水时间内才切换动画图片
    useEffect(() => {
        if (!isRunning || !isPouring || currentStage < 0 || countdownTime !== null) return

        // 获取当前注水类型
        const pourType = stages[currentStage]?.pourType || 'center'
        // 获取该类型的动画配置
        const animationConfig = availableAnimations[pourType as keyof typeof availableAnimations]

        // 如果是叠加显示的动画类型（如冰块）
        if (animationConfig?.isStacking) {
            // 如果是冰块动画，每隔一段时间添加一个新的冰块
            const interval = setInterval(() => {
                setDisplayedIceIndices(prev => {
                    // 如果已经显示了所有冰块，不再添加
                    if (prev.length >= animationConfig.maxIndex) return prev
                    // 添加下一个冰块索引
                    return [...prev, prev.length + 1]
                })
            }, 1000) // 每1秒添加一个冰块，从1.5秒改为1秒

            return () => clearInterval(interval)
        } else {
            // 对于普通动画（center, circle），使用原有的切换逻辑
            const interval = setInterval(() => {
                setCurrentMotionIndex(prev => {
                    // 获取该类型的最大索引
                    const maxIndex = animationConfig?.maxIndex || 3
                    return prev >= maxIndex ? 1 : prev + 1
                })
            }, 1000)

            return () => clearInterval(interval)
        }
    }, [isRunning, isPouring, currentStage, countdownTime, stages, availableAnimations])

    // 当阶段变化时重置冰块显示
    useEffect(() => {
        setDisplayedIceIndices([])
    }, [currentStage])

    // 更新阀门状态 - 针对聪明杯
    useEffect(() => {
        if (equipmentId !== 'CleverDripper' || currentStage < 0) {
            return
        }

        // 使用阶段中的valveStatus字段
        const currentValveStatus = stages[currentStage]?.valveStatus
        if (currentValveStatus) {
            setValveStatus(currentValveStatus)
        } else {
            // 如果没有明确设置，则从标签中判断（向后兼容）
            const currentLabel = stages[currentStage]?.label || ''
            if (currentLabel.includes('[开阀]')) {
                setValveStatus('open')
            } else if (currentLabel.includes('[关阀]')) {
                setValveStatus('closed')
            }
        }
    }, [equipmentId, currentStage, stages])

    // 获取设备图片路径
    const getEquipmentImageSrc = () => {
        return '/images/v60-base.svg' // 始终使用相同的杯体图片
    }

    // 获取阀门图片路径
    const getValveImageSrc = () => {
        if (equipmentId !== 'CleverDripper') return null
        return valveStatus === 'open'
            ? '/images/valve-open.svg'
            : '/images/valve-closed.svg'
    }

    // 如果没有运行或者在倒计时，不显示动画
    if (!isRunning || currentStage < 0 || countdownTime !== null) {
        return (
            <div className="relative w-full aspect-square max-w-[300px] mx-auto px-safe">
                <Image
                    src={getEquipmentImageSrc()}
                    alt={equipmentId}
                    fill
                    className="object-contain invert-0 dark:invert opacity-50 transition-opacity duration-300"
                    priority
                    sizes="(max-width: 768px) 100vw, 300px"
                    quality={85}
                    onError={() => { }}
                />
                {equipmentId === 'CleverDripper' && (
                    <div className="absolute inset-0">
                        <Image
                            src={getValveImageSrc() || ''}
                            alt={`Valve ${valveStatus}`}
                            fill
                            className="object-contain invert-0 dark:invert opacity-50 transition-opacity duration-300"
                            sizes="(max-width: 768px) 100vw, 300px"
                            quality={85}
                            onError={() => { }}
                        />
                    </div>
                )}
            </div>
        )
    }

    // 当 pourType 未设置或 pourTime 为 0 时，默认使用 center 类型，但不会显示注水动画
    const currentPourType = stages[currentStage]?.pourType || 'center'
    const motionSrc = `/images/pour-${currentPourType}-motion-${currentMotionIndex}.svg`

    // 检查当前动画类型是否有效
    const isValidAnimation = availableAnimations[currentPourType as keyof typeof availableAnimations] !== undefined

    // 计算杯体透明度 - 在注水时为完全不透明，否则为半透明
    const equipmentOpacity = isPouring ? 'opacity-100' : 'opacity-50'

    return (
        <div className="relative w-full aspect-square max-w-[300px] mx-auto px-safe">
            {/* 底部杯体 */}
            <Image
                src={getEquipmentImageSrc()}
                alt={equipmentId}
                fill
                className={`object-contain invert-0 dark:invert ${equipmentOpacity} transition-opacity duration-300`}
                priority
                sizes="(max-width: 768px) 100vw, 300px"
                quality={85}
                onError={() => { }}
            />

            {/* 聪明杯阀门图层 */}
            {equipmentId === 'CleverDripper' && (
                <div className="absolute inset-0">
                    <Image
                        src={getValveImageSrc() || ''}
                        alt={`Valve ${valveStatus}`}
                        fill
                        className={`object-contain invert-0 dark:invert ${equipmentOpacity} transition-opacity duration-300`}
                        sizes="(max-width: 768px) 100vw, 300px"
                        quality={85}
                        onError={() => { }}
                    />
                </div>
            )}

            {/* 注水动画 - 只在注水时间内显示，且动画类型有效时 */}
            <AnimatePresence>
                {isPouring && imagesPreloaded && isValidAnimation && (
                    <>
                        {/* 对于普通动画类型（center, circle），显示单个动画 */}
                        {!availableAnimations[currentPourType as keyof typeof availableAnimations]?.isStacking && (
                            <motion.div
                                key={`${currentStage}-${currentMotionIndex}`}
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.26 }}
                                className="absolute inset-0"
                            >
                                <Image
                                    src={motionSrc}
                                    alt={`Pour ${currentPourType}`}
                                    fill
                                    className="object-contain invert-0 dark:invert"
                                    sizes="(max-width: 768px) 100vw, 300px"
                                    quality={85}
                                    loading="eager"
                                    onError={() => { }}
                                />
                            </motion.div>
                        )}

                        {/* 对于叠加动画类型（ice），显示多个叠加的动画 */}
                        {currentPourType === 'ice' && displayedIceIndices.map(index => (
                            <motion.div
                                key={`ice-${index}`}
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ duration: 0.26 }}
                                className="absolute inset-0"
                            >
                                <Image
                                    src={`/images/pour-ice-motion-${index}.svg`}
                                    alt={`Ice cube ${index}`}
                                    fill
                                    className="object-contain invert-0 dark:invert"
                                    sizes="(max-width: 768px) 100vw, 300px"
                                    quality={85}
                                    loading="eager"
                                    onError={() => { }}
                                />
                            </motion.div>
                        ))}
                    </>
                )}
            </AnimatePresence>
        </div>
    )
}

export default PourVisualizer 