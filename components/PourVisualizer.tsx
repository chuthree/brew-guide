'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import Image from 'next/image'
import { motion, AnimatePresence, useAnimation } from 'framer-motion'
import { Stage } from '@/lib/config'
import { AnimationFrame } from './AnimationEditor'

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
    frames?: AnimationFrame[]; // 添加支持自定义帧
}

interface PourVisualizerProps {
    isRunning: boolean
    currentStage: number
    stages: (Stage | ExtendedStage)[]
    countdownTime: number | null
    equipmentId?: string // 添加设备ID属性
    isWaiting?: boolean // 添加是否处于等待阶段的属性
    customEquipment?: {
        animationType: "v60" | "kalita" | "origami" | "clever" | "custom";
        hasValve?: boolean;
        customShapeSvg?: string; // 添加自定义杯型SVG
        customPourAnimations?: {
            id: string;
            pourType?: 'center' | 'circle' | 'ice';
            customAnimationSvg: string;
            frames?: AnimationFrame[];
        }[];
    };
}

const PourVisualizer: React.FC<PourVisualizerProps> = ({
    isRunning,
    currentStage,
    stages,
    countdownTime,
    equipmentId = 'V60', // 默认为V60
    isWaiting = false, // 默认不是等待阶段
    customEquipment
}) => {
    const [currentMotionIndex, setCurrentMotionIndex] = useState(1)
    const [isPouring, setIsPouring] = useState(false)
    const [valveStatus, setValveStatus] = useState<'open' | 'closed'>('closed') // 添加阀门状态
    const [imagesPreloaded, setImagesPreloaded] = useState(false)
    const [displayedIceIndices, setDisplayedIceIndices] = useState<number[]>([])
    const [isEasterEggActive, setIsEasterEggActive] = useState(false)

    // 添加动画控制器
    const controls = useAnimation()

    // 定义彩蛋动画变体
    const easterEggVariants = {
        normal: {
            scale: 1,
            rotate: 0,
            filter: 'hue-rotate(0deg)',
        },
        active: {
            scale: [1, 1.1, 0.9, 1.05, 1],
            rotate: [0, 10, -10, 5, 0],
            filter: ['hue-rotate(0deg)', 'hue-rotate(90deg)', 'hue-rotate(180deg)', 'hue-rotate(270deg)', 'hue-rotate(360deg)'],
            transition: {
                duration: 1.5,
                ease: "easeInOut",
                times: [0, 0.2, 0.4, 0.6, 1],
            }
        }
    }

    // 处理彩蛋触发
    const handleEasterEgg = useCallback(async () => {
        if (!isEasterEggActive) {
            setIsEasterEggActive(true)
            await controls.start('active')
            setIsEasterEggActive(false)
        }
    }, [controls, isEasterEggActive])

    // 移除旧的样式定义
    useEffect(() => {
        // 动态添加深色模式样式
        const style = document.createElement('style');
        style.innerHTML = `
            /* 移除所有旧的样式定义，现在使用全局 CSS */
        `;
        document.head.appendChild(style);
        return () => {
            document.head.removeChild(style);
        };
    }, []);

    // 获取设备图片路径
    const getEquipmentImageSrc = () => {
        try {
            // 如果是自定义器具且有自定义SVG路径，使用自定义SVG
            if (customEquipment?.customShapeSvg) {
                // 自定义杯型的SVG数据直接返回，作为内联SVG使用
                return null;
            }

            // 如果是自定义器具，使用对应的基础动画类型
            if (customEquipment && customEquipment.animationType) {
                const type = customEquipment.animationType.toLowerCase();
                return `/images/${type}-base.svg`;
            }

            // 当设备ID为CleverDripper时，使用v60的图片
            if (equipmentId === 'CleverDripper') {
                return '/images/v60-base.svg';
            }

            // 检查equipmentId是否是预定义器具ID
            const standardEquipmentIds = ['V60', 'Kalita', 'Origami', 'CleverDripper'];
            const isStandardEquipment = standardEquipmentIds.includes(equipmentId);

            if (isStandardEquipment) {
                // 对于标准器具，使用小写ID作为图片名
                return `/images/${equipmentId.toLowerCase()}-base.svg`;
            }

            // 如果是自定义器具但找不到animationType，使用默认V60图片
            return '/images/v60-base.svg';
        } catch (_error) {
            return '/images/v60-base.svg';
        }
    }

    // 获取阀门图片路径
    const getValveImageSrc = () => {
        try {
            // 检查是否是需要显示阀门的器具（自定义带阀门的器具或标准聪明杯）
            const hasValveSupport = equipmentId === 'CleverDripper' || customEquipment?.hasValve;

            if (!hasValveSupport) return null;

            return valveStatus === 'open'
                ? '/images/valve-open.svg'
                : '/images/valve-closed.svg';
        } catch (_error) {
            return '/images/valve-closed.svg'; // 默认返回关闭阀门图片
        }
    }

    // 获取当前注水类型，优化错误处理和回退逻辑
    const getCurrentPourType = useCallback(() => {
        try {
            if (!stages[currentStage]) return 'center';

            // 获取当前阶段的pourType，如果未设置，默认使用center
            const pourType = stages[currentStage]?.pourType || 'center';

            // 检查是否是自定义动画ID
            if (customEquipment?.customPourAnimations?.some(anim => anim.id === pourType)) {
                return pourType;
            }

            // 检查是否是标准注水类型
            if (pourType === 'center' || pourType === 'circle' || pourType === 'ice' || pourType === 'other') {
                return pourType;
            }

            // 如果是其他自定义动画ID，直接返回
            return pourType;
        } catch (_error) {
            return 'center';
        }
    }, [stages, currentStage, customEquipment]);

    // 定义可用的动画图片及其最大索引 - 移到组件顶部
    const availableAnimations = useMemo<Record<string, AnimationConfig>>(() => {
        // 基础动画配置
        const baseAnimations: Record<string, AnimationConfig> = {
            center: { maxIndex: 3 },  // center 只有3张图片
            circle: { maxIndex: 4 },   // circle 有4张图片
            ice: { maxIndex: 4, isStacking: true }  // 冰块动画，有4张图片，需要叠加显示
        };

        // 如果有自定义器具，添加自定义动画配置
        if (customEquipment?.customPourAnimations?.length) {
            customEquipment.customPourAnimations.forEach(animation => {
                // 使用动画ID作为键
                const animationId = animation.id;
                if (animation.frames && animation.frames.length > 0) {
                    // 使用自定义帧
                    baseAnimations[animationId] = {
                        maxIndex: animation.frames.length,
                        frames: animation.frames
                    };
                } else if (animation.customAnimationSvg) {
                    // 兼容旧版单帧自定义动画
                    baseAnimations[animationId] = {
                        maxIndex: 1,
                        frames: [{ id: 'frame-1', svgData: animation.customAnimationSvg }]
                    };
                }
            });
        }

        return baseAnimations;
    }, [customEquipment]);

    // 优化预加载图片逻辑
    const imagesToPreload = useMemo(() => {
        // 基础设备图片
        const baseImages = [
            '/images/v60-base.svg',
            '/images/kalita-base.svg',
            '/images/origami-base.svg',
        ];

        // 聪明杯相关图片（阀门控制）
        const valveImages = [
            '/images/valve-open.svg',
            '/images/valve-closed.svg',
        ];

        // 动画类型图片
        const animationImages = [
            // center 动画图片
            ...Array.from({ length: availableAnimations.center.maxIndex },
                (_, i) => `/images/pour-center-motion-${i + 1}.svg`),
            // circle 动画图片
            ...Array.from({ length: availableAnimations.circle.maxIndex },
                (_, i) => `/images/pour-circle-motion-${i + 1}.svg`),
            // ice 动画图片
            ...Array.from({ length: availableAnimations.ice.maxIndex },
                (_, i) => `/images/pour-ice-motion-${i + 1}.svg`),
        ];

        return [...baseImages, ...valveImages, ...animationImages];
    }, [availableAnimations]);

    // 优化预加载效果
    useEffect(() => {
        // 如果没有图像需要预加载，直接设置为完成
        if (imagesToPreload.length === 0) {
            setImagesPreloaded(true);
            return;
        }

        let loadedCount = 0;
        const totalImages = imagesToPreload.length;
        const images: HTMLImageElement[] = [];

        const onImageLoad = () => {
            loadedCount++;
            if (loadedCount >= totalImages) {
                setImagesPreloaded(true);
            }
        };

        // 创建并加载所有图像
        imagesToPreload.forEach(src => {
            const img = new globalThis.Image();
            images.push(img);
            img.onload = onImageLoad;
            img.onerror = onImageLoad; // 即使加载失败也继续处理
            img.src = src;
        });

        return () => {
            // 清理加载中的图像
            images.forEach(img => {
                img.onload = null;
                img.onerror = null;
                img.src = '';
            });
        };
    }, [imagesToPreload]);

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

            const pourType = getCurrentPourType();
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

    // 更新阀门状态 - 针对聪明杯或带阀门的自定义器具
    useEffect(() => {
        // 检查当前器具是否支持阀门功能（聪明杯或自定义带阀门的器具）
        const hasValveSupport = equipmentId === 'CleverDripper' || customEquipment?.hasValve;

        if (!hasValveSupport || currentStage < 0) {
            return;
        }

        // 使用阶段中的valveStatus字段
        const currentValveStatus = stages[currentStage]?.valveStatus;
        if (currentValveStatus) {
            setValveStatus(prev => {
                if (prev !== currentValveStatus) return currentValveStatus;
                return prev;
            });
        } else {
            // 如果没有明确设置，则从标签中判断（向后兼容）
            const currentLabel = stages[currentStage]?.label || '';
            if (currentLabel.includes('[开阀]')) {
                setValveStatus(prev => {
                    if (prev !== 'open') return 'open';
                    return prev;
                });
            } else if (currentLabel.includes('[关阀]')) {
                setValveStatus(prev => {
                    if (prev !== 'closed') return 'closed';
                    return prev;
                });
            }
        }
    }, [equipmentId, currentStage, stages, customEquipment]);

    // 检查是否使用自定义SVG
    const hasCustomSvg = Boolean(customEquipment?.customShapeSvg);
    const equipmentImageSrc = getEquipmentImageSrc();

    // 计算杯体透明度 - 在注水时为完全不透明，否则为半透明
    const equipmentOpacity = isPouring ? 'opacity-100' : 'opacity-50';

    // 获取当前动画图片路径
    const getMotionSrc = useCallback(() => {
        try {
            if (!isRunning) return null;

            const pourType = getCurrentPourType();

            // 检查对应的动画类型是否存在
            if (!pourType || !(pourType in availableAnimations)) return null;

            // 如果是冰块动画类型(isStacking=true)，使用特殊处理
            if (availableAnimations[pourType]?.isStacking) return null;

            // 如果是自定义动画，使用 frames
            if (availableAnimations[pourType]?.frames) {
                const frame = availableAnimations[pourType].frames?.[currentMotionIndex - 1];
                if (frame?.svgData) {
                    return processCustomSvg(frame.svgData);
                }
            }

            return `/images/pour-${pourType}-motion-${currentMotionIndex}.svg`;
        } catch (_error) {
            return null;
        }
    }, [isRunning, getCurrentPourType, currentMotionIndex, availableAnimations]);

    // 更新 processCustomSvg 函数
    const processCustomSvg = (svgContent: string) => {
        if (!svgContent) return '';

        // 处理 SVG 内容，确保使用 CSS 变量
        let processedSvg = svgContent;

        // 替换所有颜色相关的属性为 CSS 变量
        processedSvg = processedSvg
            .replace(/stroke="black"/g, 'stroke="var(--custom-shape-color)"')
            .replace(/stroke="white"/g, 'stroke="var(--custom-shape-color)"')
            .replace(/stroke="#000000"/g, 'stroke="var(--custom-shape-color)"')
            .replace(/stroke="#FFFFFF"/g, 'stroke="var(--custom-shape-color)"')
            .replace(/stroke="#ffffff"/g, 'stroke="var(--custom-shape-color)"')
            .replace(/stroke="#000"/g, 'stroke="var(--custom-shape-color)"')
            .replace(/stroke="#fff"/g, 'stroke="var(--custom-shape-color)"')
            .replace(/stroke="currentColor"/g, 'stroke="var(--custom-shape-color)"')
            .replace(/fill="black"/g, 'fill="none"')
            .replace(/fill="white"/g, 'fill="none"')
            .replace(/fill="#000000"/g, 'fill="none"')
            .replace(/fill="#FFFFFF"/g, 'fill="none"')
            .replace(/fill="#ffffff"/g, 'fill="none"')
            .replace(/fill="#000"/g, 'fill="none"')
            .replace(/fill="#fff"/g, 'fill="none"')
            .replace(/fill="currentColor"/g, 'fill="none"');

        // 检查是否已经包含 viewBox
        const hasViewBox = /viewBox="[^"]*"/.test(processedSvg);

        // 添加 SVG 属性和类名
        processedSvg = processedSvg.replace(/<svg([^>]*)>/, (match, attributes) => {
            // 添加缺失的 viewBox
            const viewBoxAttr = hasViewBox ? '' : ' viewBox="0 0 300 300"';
            // 添加统一的宽高和类名
            return `<svg${attributes}${viewBoxAttr} width="300" height="300" class="custom-cup-shape outline-only">`;
        });

        // 确保所有路径使用统一的线条粗细（保持原有的stroke-width属性）
        processedSvg = processedSvg.replace(/<path([^>]*)>/g, (match, attributes) => {
            // 如果属性中没有stroke属性，添加默认stroke
            if (!attributes.includes('stroke=')) {
                attributes += ' stroke="var(--custom-shape-color)"';
            }
            
            // 如果属性中没有stroke-width属性，添加默认stroke-width
            if (!attributes.includes('stroke-width=')) {
                attributes += ' stroke-width="1.5"';
            }
            
            // 如果属性中没有fill属性，或者fill不是none，设置为none
            if (!attributes.includes('fill=') || !attributes.includes('fill="none"')) {
                attributes = attributes.replace(/fill="[^"]*"/g, 'fill="none"');
                if (!attributes.includes('fill=')) {
                    attributes += ' fill="none"';
                }
            }
            
            return `<path${attributes}>`;
        });

        return processedSvg;
    };

    // 如果在倒计时期间，立即返回静态视图
    if (countdownTime !== null) {
        return (
            <div className="relative w-full aspect-square max-w-[300px] mx-auto px-safe">
                {/* 底部杯体 - 使用自定义SVG或图片 */}
                {hasCustomSvg ? (
                    <div
                        className={`absolute inset-0 ${equipmentOpacity} transition-opacity duration-300 custom-shape-svg-container outline-only custom-cup-shape`}
                        dangerouslySetInnerHTML={{
                            __html: processCustomSvg(customEquipment?.customShapeSvg || '')
                        }}
                    />
                ) : (
                    <Image
                        src={equipmentImageSrc || '/images/v60-base.svg'}
                        alt={equipmentId}
                        fill
                        className={`object-contain invert-0 dark:invert ${equipmentOpacity} transition-opacity duration-300`}
                        priority
                        sizes="(max-width: 768px) 100vw, 300px"
                        quality={85}
                        onError={() => { }}
                    />
                )}
                {/* 显示阀门（如果器具支持） */}
                {(equipmentId === 'CleverDripper' || customEquipment?.hasValve) && getValveImageSrc() && (
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
        );
    }

    // 如果不在运行中或阶段无效，也返回静态视图
    if (!isRunning || currentStage < 0) {
        return (
            <div className="relative w-full aspect-square max-w-[300px] mx-auto px-safe">
                {/* 底部杯体 - 使用自定义SVG或图片 */}
                {hasCustomSvg ? (
                    <div
                        className={`absolute inset-0 ${equipmentOpacity} transition-opacity duration-300 custom-shape-svg-container outline-only custom-cup-shape`}
                        dangerouslySetInnerHTML={{
                            __html: processCustomSvg(customEquipment?.customShapeSvg || '')
                        }}
                    />
                ) : (
                    <Image
                        src={equipmentImageSrc || '/images/v60-base.svg'}
                        alt={equipmentId}
                        fill
                        className={`object-contain invert-0 dark:invert ${equipmentOpacity} transition-opacity duration-300`}
                        priority
                        sizes="(max-width: 768px) 100vw, 300px"
                        quality={85}
                        onError={() => { }}
                    />
                )}
                {/* 显示阀门（如果器具支持） */}
                {(equipmentId === 'CleverDripper' || customEquipment?.hasValve) && getValveImageSrc() && (
                    <div className="absolute inset-0">
                        <Image
                            src={getValveImageSrc() || ''}
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
                {/* 底部杯体 - 使用自定义SVG或图片 */}
                {hasCustomSvg ? (
                    <div
                        className={`absolute inset-0 ${equipmentOpacity} transition-opacity duration-300 custom-shape-svg-container outline-only custom-cup-shape`}
                        dangerouslySetInnerHTML={{
                            __html: processCustomSvg(customEquipment?.customShapeSvg || '')
                        }}
                    />
                ) : (
                    <Image
                        src={equipmentImageSrc || '/images/v60-base.svg'}
                        alt={equipmentId}
                        fill
                        className={`object-contain invert-0 dark:invert ${equipmentOpacity} transition-opacity duration-300`}
                        priority
                        sizes="(max-width: 768px) 100vw, 300px"
                        quality={85}
                        onError={() => { }}
                    />
                )}
                {/* 显示阀门（如果器具支持） */}
                {(equipmentId === 'CleverDripper' || customEquipment?.hasValve) && getValveImageSrc() && (
                    <div className="absolute inset-0">
                        <Image
                            src={getValveImageSrc() || ''}
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

    // 当 pourType 未设置或 pourTime 为 0 时，默认使用 center 类型
    const currentPourType = getCurrentPourType();
    const motionSrc = getMotionSrc();

    // 检查当前动画类型是否有效
    const isValidAnimation = availableAnimations[currentPourType as keyof typeof availableAnimations] !== undefined;

    // 再次检查倒计时状态，双重保险
    const shouldShowAnimation = isPouring && imagesPreloaded && isValidAnimation && countdownTime === null;

    return (
        <motion.div 
            className={`relative aspect-square w-full max-w-[300px] mx-auto px-safe overflow-hidden ${isRunning ? 'bg-transparent' : 'bg-neutral-900'} ${isPouring ? 'isPouring' : ''}`}
            variants={easterEggVariants}
            animate={controls}
            initial="normal"
            onDoubleClick={handleEasterEgg}
            onContextMenu={(e) => {
                e.preventDefault()
                handleEasterEgg()
            }}
        >
            {/* 基础杯型 */}
            <AnimatePresence mode='wait'>
                <motion.div
                    key={`equipment-${equipmentId}`}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="absolute inset-0"
                >
                    {!customEquipment?.customShapeSvg ? (
                        // 标准SVG图像文件
                        <Image
                            src={equipmentImageSrc || '/images/v60-base.svg'}
                            alt={equipmentId || 'V60'}
                            fill
                            className={`object-contain invert-0 dark:invert ${equipmentOpacity}`}
                            sizes="(max-width: 768px) 100vw, 300px"
                            quality={85}
                            priority={true}
                            onError={() => { }}
                        />
                    ) : (
                        // 自定义SVG内联数据
                        <div className={`w-full h-full custom-cup-shape outline-only ${equipmentOpacity}`}
                            dangerouslySetInnerHTML={{
                                __html: processCustomSvg(customEquipment.customShapeSvg)
                            }}
                        />
                    )}
                </motion.div>
            </AnimatePresence>

            {/* 阀门（如果适用） */}
            {valveStatus === 'open' && getValveImageSrc() && (
                <div className="absolute inset-x-0 bottom-0 h-1/4 flex items-center justify-center">
                    <Image
                        src={getValveImageSrc() || ''}
                        alt={`Valve ${valveStatus}`}
                        width={40}
                        height={8}
                        className="object-contain invert-0 dark:invert"
                        quality={90}
                        onError={() => { }}
                    />
                </div>
            )}

            {/* 注水动画 */}
            <AnimatePresence mode="sync">
                {shouldShowAnimation && (
                    <>
                        {/* 对于普通动画类型 */}
                        {!availableAnimations[currentPourType as keyof typeof availableAnimations]?.isStacking && (
                            <motion.div
                                key={`${currentStage}-${currentMotionIndex}`}
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.26 }}
                                className="absolute inset-0"
                            >
                                {availableAnimations[currentPourType as keyof typeof availableAnimations]?.frames ? (
                                    // 使用自定义帧
                                    <div
                                        className="w-full h-full flex items-center justify-center custom-cup-shape outline-only"
                                        dangerouslySetInnerHTML={{
                                            __html: processCustomSvg(availableAnimations[currentPourType as keyof typeof availableAnimations]?.frames?.[currentMotionIndex - 1]?.svgData || '')
                                        }}
                                    />
                                ) : (
                                    // 使用标准图片
                                    <Image
                                        src={motionSrc || ''}
                                        alt={`Pour ${currentPourType}`}
                                        fill
                                        className="object-contain invert-0 dark:invert"
                                        sizes="(max-width: 768px) 100vw, 300px"
                                        quality={85}
                                        loading="eager"
                                        onError={() => { }}
                                    />
                                )}
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
        </motion.div>
    )
}

export default PourVisualizer
