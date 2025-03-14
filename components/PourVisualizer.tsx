'use client'

import React, { useState, useEffect } from 'react'
import Image from 'next/image'
import { motion, AnimatePresence } from 'framer-motion'
import { Stage } from '@/lib/config'

interface PourVisualizerProps {
    isRunning: boolean
    currentStage: number
    stages: Stage[]
    countdownTime: number | null
    equipmentId?: string // 添加设备ID属性
}

const PourVisualizer: React.FC<PourVisualizerProps> = ({
    isRunning,
    currentStage,
    stages,
    countdownTime,
    equipmentId = 'V60' // 默认为V60
}) => {
    const [currentMotionIndex, setCurrentMotionIndex] = useState(1)
    const [isPouring, setIsPouring] = useState(false)
    const [valveStatus, setValveStatus] = useState<'open' | 'closed'>('closed') // 添加阀门状态
    const [imagesPreloaded, setImagesPreloaded] = useState(false)

    // 预加载所有可能用到的图像
    useEffect(() => {
        const imagesToPreload = [
            '/images/v60-base.svg',
            '/images/valve-open.svg',
            '/images/valve-closed.svg',
            '/images/pour-center-motion-1.svg',
            '/images/pour-center-motion-2.svg',
            '/images/pour-center-motion-3.svg',
            '/images/pour-circle-motion-1.svg',
            '/images/pour-circle-motion-2.svg',
            '/images/pour-circle-motion-3.svg',
            '/images/pour-circle-motion-4.svg'
        ]

        Promise.all(
            imagesToPreload.map(src => {
                return new Promise((resolve, reject) => {
                    const img = new globalThis.Image()
                    img.src = src
                    img.onload = resolve
                    img.onerror = reject
                })
            })
        )
            .then(() => setImagesPreloaded(true))
            .catch(err => console.error('图像预加载失败:', err))
    }, [])

    // 跟踪当前阶段的经过时间，用于确定是否在注水时间内
    useEffect(() => {
        if (!isRunning || currentStage < 0 || countdownTime !== null) {
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
    }, [isRunning, currentStage, countdownTime, stages])

    // 只有在注水时间内才切换动画图片
    useEffect(() => {
        if (!isRunning || !isPouring || currentStage < 0 || countdownTime !== null) return

        const interval = setInterval(() => {
            setCurrentMotionIndex(prev => {
                // 根据注水类型决定最大索引
                const maxIndex = stages[currentStage]?.pourType === 'center' ? 3 : 4
                return prev >= maxIndex ? 1 : prev + 1
            })
        }, 1000)

        return () => clearInterval(interval)
    }, [isRunning, isPouring, currentStage, countdownTime, stages])

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
            <div className="relative w-full aspect-square max-w-[300px] mx-auto">
                <Image
                    src={getEquipmentImageSrc()}
                    alt={equipmentId}
                    fill
                    className="object-contain invert dark:invert-0"
                    priority
                    sizes="(max-width: 768px) 100vw, 300px"
                    quality={85}
                />
                {equipmentId === 'CleverDripper' && (
                    <div className="absolute inset-0">
                        <Image
                            src={getValveImageSrc() || ''}
                            alt={`Valve ${valveStatus}`}
                            fill
                            className="object-contain invert dark:invert-0"
                            sizes="(max-width: 768px) 100vw, 300px"
                            quality={85}
                        />
                    </div>
                )}
            </div>
        )
    }

    // 当 pourType 未设置或 pourTime 为 0 时，默认使用 center 类型，但不会显示注水动画
    const currentPourType = stages[currentStage]?.pourType || 'center'
    const motionSrc = `/images/pour-${currentPourType}-motion-${currentMotionIndex}.svg`

    return (
        <div
            className="relative w-full aspect-square max-w-[300px] mx-auto"
        >
            {/* 底部杯体 */}
            <Image
                src={getEquipmentImageSrc()}
                alt={equipmentId}
                fill
                className="object-contain invert dark:invert-0"
                priority
                sizes="(max-width: 768px) 100vw, 300px"
                quality={85}
            />

            {/* 聪明杯阀门图层 */}
            {equipmentId === 'CleverDripper' && (
                <div className="absolute inset-0">
                    <Image
                        src={getValveImageSrc() || ''}
                        alt={`Valve ${valveStatus}`}
                        fill
                        className="object-contain invert dark:invert-0"
                        sizes="(max-width: 768px) 100vw, 300px"
                        quality={85}
                    />
                </div>
            )}

            {/* 注水动画 - 只在注水时间内显示 */}
            <AnimatePresence>
                {isPouring && imagesPreloaded && (
                    <motion.div
                        key={`${currentStage}-${currentMotionIndex}`}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="absolute inset-0"
                    >
                        <Image
                            src={motionSrc}
                            alt={`Pour ${currentPourType}`}
                            fill
                            className="object-contain invert dark:invert-0"
                            sizes="(max-width: 768px) 100vw, 300px"
                            quality={85}
                            loading="eager"
                        />
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}

export default PourVisualizer 