'use client'

import React, { useState, useEffect, useMemo } from 'react'
import Image from 'next/image'
import { motion, AnimatePresence } from 'framer-motion'
import { Stage } from '@/lib/config'

// 定义扩展阶段类型
interface ExtendedStage extends Partial<Stage> {
    type?: "pour" | "wait";
    startTime?: number;
    endTime?: number;
    originalIndex?: number;
}

// 定义动画配置类型
interface AnimationConfig {
    maxIndex: number;
    isStacking?: boolean;
}

interface PourVisualizerProps {
    isRunning: boolean
    currentStage: number
    stages: (Stage | ExtendedStage)[]
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

    // 定义可用的动画图片及其最大索引 - 移到组件顶部
    const availableAnimations = useMemo<Record<string, AnimationConfig>>(() => ({
        center: { maxIndex: 3 },  // center 只有3张图片
        circle: { maxIndex: 4 },   // circle 有4张图片
        ice: { maxIndex: 4, isStacking: true }  // 冰块动画，有4张图片，需要叠加显示
    }), [])

    // 需要预加载的图片列表 - 移到组件顶部
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

    // 预加载所有图像 - 移到组件顶部
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

    // 跟踪当前阶段的经过时间，用于确定是否在注水时间内 - 移到组件顶部
    useEffect(() => {
        // 如果在倒计时状态，立即停止所有动画
        if (countdownTime !== null) {
            setIsPouring(false);
            setDisplayedIceIndices([]);
            setCurrentMotionIndex(1);
            return;
        }

        // 其他非活动状态的检查
        if (!isRunning || currentStage < 0) {
            setIsPouring(false);
            setDisplayedIceIndices([]);
            setCurrentMotionIndex(1); // 重置动画帧到初始状态
            return;
        }

        const currentStageData = stages[currentStage];
        if (!currentStageData) {
            setIsPouring(false);
            setDisplayedIceIndices([]);
            setCurrentMotionIndex(1);
            return;
        }

        // 检查当前阶段是否为等待阶段
        const currentStageType = (currentStageData as ExtendedStage)?.type || 'pour';
        const currentPourTime = currentStageData.pourTime;

        // 如果是等待阶段、isWaiting为true、或pourTime明确设为0，不显示注水动画
        if (currentStageType === 'wait' || isWaiting || currentPourTime === 0) {
            setIsPouring(false);
            setDisplayedIceIndices([]);
            setCurrentMotionIndex(1);
            return;
        }

        // 立即开始注水动画
        setIsPouring(true);

        // 设置定时器来控制动画时长
        const timer = setInterval(() => {
            // 再次检查倒计时状态，确保在倒计时期间不会更新动画
            if (countdownTime !== null) {
                setIsPouring(false);
                setDisplayedIceIndices([]);
                setCurrentMotionIndex(1);
                clearInterval(timer);
                return;
            }

            const pourType = currentStageData.pourType || 'center';
            const animationConfig = availableAnimations[pourType as keyof typeof availableAnimations];

            if (animationConfig?.isStacking) {
                setDisplayedIceIndices(prev => {
                    if (prev.length >= animationConfig.maxIndex) return prev;
                    return [...prev, prev.length + 1];
                });
            } else {
                setCurrentMotionIndex(prev => {
                    const maxIndex = animationConfig?.maxIndex || 3;
                    return prev >= maxIndex ? 1 : prev + 1;
                });
            }
        }, 1000);

        return () => {
            clearInterval(timer);
            if (!isRunning || countdownTime !== null) {
                setDisplayedIceIndices([]);
                setCurrentMotionIndex(1);
            }
        };
    }, [isRunning, currentStage, countdownTime, stages, isWaiting, availableAnimations]);

    // 更新阀门状态 - 针对聪明杯 - 移到组件顶部
    useEffect(() => {
        if (equipmentId !== 'CleverDripper' || currentStage < 0) {
            return
        }

        // 使用阶段中的valveStatus字段
        const currentValveStatus = stages[currentStage]?.valveStatus
        if (currentValveStatus) {
            setValveStatus(prev => {
                if (prev !== currentValveStatus) return currentValveStatus;
                return prev;
            })
        } else {
            // 如果没有明确设置，则从标签中判断（向后兼容）
            const currentLabel = stages[currentStage]?.label || ''
            if (currentLabel.includes('[开阀]')) {
                setValveStatus(prev => {
                    if (prev !== 'open') return 'open';
                    return prev;
                })
            } else if (currentLabel.includes('[关阀]')) {
                setValveStatus(prev => {
                    if (prev !== 'closed') return 'closed';
                    return prev;
                })
            }
        }
    }, [equipmentId, currentStage, stages])

    // 如果在倒计时期间，立即返回静态视图
    if (countdownTime !== null) {
        return (
            <div className="relative w-full aspect-square max-w-[300px] mx-auto px-safe">
                <Image
                    src={'/images/v60-base.svg'} // 直接使用静态路径，避免可能的路径错误
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
                            src={`/images/valve-${valveStatus}.svg`}
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
        );
    }

    // 如果不在运行中或阶段无效，也返回静态视图
    if (!isRunning || currentStage < 0) {
        return (
            <div className="relative w-full aspect-square max-w-[300px] mx-auto px-safe">
                <Image
                    src={'/images/v60-base.svg'} // 始终使用相同的杯体图片
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
                            src={'/images/valve-closed.svg'}
                            alt={`Valve closed`}
                            fill
                            className="object-contain invert-0 dark:invert opacity-50 transition-opacity duration-300"
                            sizes="(max-width: 768px) 100vw, 300px"
                            quality={85}
                            onError={() => { }}
                        />
                    </div>
                )}
            </div>
        );
    }

    // 检查当前阶段是否存在
    const currentStageData = stages[currentStage];
    if (!currentStageData) {
        return (
            <div className="relative w-full aspect-square max-w-[300px] mx-auto px-safe">
                <Image
                    src={'/images/v60-base.svg'} // 始终使用相同的杯体图片
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
                            src={'/images/valve-closed.svg'}
                            alt={`Valve closed`}
                            fill
                            className="object-contain invert-0 dark:invert opacity-50 transition-opacity duration-300"
                            sizes="(max-width: 768px) 100vw, 300px"
                            quality={85}
                            onError={() => { }}
                        />
                    </div>
                )}
            </div>
        );
    }

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

    // 当 pourType 未设置或 pourTime 为 0 时，默认使用 center 类型，但不会显示注水动画
    const currentPourType = stages[currentStage]?.pourType || 'center'
    const motionSrc = `/images/pour-${currentPourType}-motion-${currentMotionIndex}.svg`

    // 检查当前动画类型是否有效
    const isValidAnimation = availableAnimations[currentPourType as keyof typeof availableAnimations] !== undefined

    // 计算杯体透明度 - 在注水时为完全不透明，否则为半透明
    const equipmentOpacity = isPouring ? 'opacity-100' : 'opacity-50'

    // 再次检查倒计时状态，双重保险
    const shouldShowAnimation = isPouring && imagesPreloaded && isValidAnimation && countdownTime === null;

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

            {/* 注水动画 - 只在注水时间内显示，且动画类型有效时，且不在倒计时阶段 */}
            <AnimatePresence>
                {shouldShowAnimation && (
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