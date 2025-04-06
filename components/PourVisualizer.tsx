'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import Image from 'next/image'
import { motion, AnimatePresence } from 'framer-motion'
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

    // 添加深色模式CSS样式
    useEffect(() => {
        // 动态添加深色模式样式
        const style = document.createElement('style');
        style.innerHTML = `
            @media (prefers-color-scheme: dark) {
                .dark-mode-svg {
                    color: white !important;
                }
            }
            .dark .dark-mode-svg {
                color: white !important;
            }
            /* 确保自定义杯型只显示轮廓而不填充 */
            .custom-shape-svg-container svg {
                fill: none !important;
            }
            .custom-shape-svg-container .cup-shape-outline * {
                fill: none !important;
                stroke: currentColor !important;
            }
            /* 移除深色模式下的强制白色描边，使用invert替代 */
            /* .dark .custom-shape-svg-container .cup-shape-outline * {
                stroke: white !important;
            } */
            /* 额外确保outline-only类的元素永远不会被填充 */
            .outline-only svg *, 
            .outline-only .cup-shape-outline * {
                fill: none !important;
                stroke-width: 1.5px;
            }
            /* 针对注水动画状态的特殊处理 */
            .isPouring .custom-shape-svg-container svg *,
            .isPouring .outline-only svg * {
                fill: none !important;
            }
            
            /* 自定义杯型的深色模式处理 - 直接设置颜色不使用invert */
            @media (prefers-color-scheme: dark) {
                .custom-cup-shape svg *,
                .custom-cup-shape .cup-shape-outline * {
                    stroke: #ffffff !important; /* 深色模式中使用白色描边 */
                }
            }
            .dark .custom-cup-shape svg *,
            .dark .custom-cup-shape .cup-shape-outline * {
                stroke: #ffffff !important; /* 深色模式中使用白色描边 */
            }
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
                console.log('使用自定义杯型SVG:', 
                    customEquipment.customShapeSvg.substring(0, 30) + '... (长度:' + 
                    customEquipment.customShapeSvg.length + '字符)');
                // 自定义杯型的SVG数据直接返回，作为内联SVG使用
                return null;
            }
            
            // 如果是自定义器具，使用对应的基础动画类型
            if (customEquipment && customEquipment.animationType) {
                const type = customEquipment.animationType.toLowerCase();
                console.log('使用自定义器具动画类型:', type);
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
            console.warn('无法识别的器具类型或缺少动画类型，使用默认V60图片', {
                equipmentId,
                customEquipment
            });
            return '/images/v60-base.svg';
        } catch (error) {
            console.error('获取器具图片路径出错，使用默认V60图片', error);
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
        } catch (error) {
            console.error('获取阀门图片路径出错', error);
            return '/images/valve-closed.svg'; // 默认返回关闭阀门图片
        }
    }

    // 获取当前注水类型，优化错误处理和回退逻辑
    const getCurrentPourType = useCallback(() => {
        try {
            if (!stages[currentStage]) return 'center';
            
            // 获取当前阶段的pourType，如果未设置，默认使用center
            const pourType = stages[currentStage]?.pourType || 'center';
            
            console.log('[PourVisualizer] 当前注水类型:', {
                pourType,
                customAnimations: customEquipment?.customPourAnimations,
                hasCustomAnimation: customEquipment?.customPourAnimations?.some(anim => anim.id === pourType)
            });
            
            // 检查是否是自定义动画ID
            if (customEquipment?.customPourAnimations?.some(anim => anim.id === pourType)) {
                console.log('[PourVisualizer] 使用自定义动画:', pourType);
                return pourType;
            }
            
            // 检查是否是标准注水类型
            if (pourType === 'center' || pourType === 'circle' || pourType === 'ice' || pourType === 'other') {
                console.log('[PourVisualizer] 使用标准注水类型:', pourType);
                return pourType;
            }
            
            // 如果是其他自定义动画ID，直接返回
            console.log('[PourVisualizer] 使用其他注水类型:', pourType);
            return pourType;
        } catch (error) {
            console.error('获取注水类型出错，使用默认center类型', error);
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

    // 添加调试日志
    if (hasCustomSvg) {
        console.log('检测到自定义SVG:', {
            hasCustomSvg,
            svgLength: customEquipment?.customShapeSvg?.length || 0,
            equipmentId,
            animationType: customEquipment?.animationType
        });
    }

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
            
            return `/images/pour-${pourType}-motion-${currentMotionIndex}.svg`;
        } catch (error) {
            console.error('获取动画图片路径出错', error);
            return null;
        }
    }, [isRunning, getCurrentPourType, currentMotionIndex, availableAnimations]);

    // 生成注入SVG标签时的共享函数
    const processCustomSvg = (svgContent: string) => {
        if (!svgContent) return '';
        
        // 如果SVG内容中没有style标签，添加一个
        const hasStyleTag = svgContent.includes('<style>') || svgContent.includes('<style ');
        
        // 提供基础样式，确保不填充且使用当前文本颜色作为描边
        const baseStyle = `
            <style>
                /* 确保SVG元素不被填充，并使用继承的颜色作为描边 */
                svg * { 
                    fill: none !important; 
                    stroke: currentColor !important;
                }
            </style>
        `;
        
        // 在SVG标签中添加宽高属性和cup-shape-outline类
        let processedSvg = svgContent.replace(/<svg([^>]*)>/, (match, attributes) => {
            if (hasStyleTag) {
                // 如果已有style标签，仅添加类名
                return `<svg${attributes} width="100%" height="100%" class="cup-shape-outline">`;
            } else {
                // 如果没有style标签，添加类名和基础样式
                return `<svg${attributes} width="100%" height="100%" class="cup-shape-outline">${baseStyle}`;
            }
        });
        
        // 如果存在style标签，修改它以确保不填充
        if (hasStyleTag) {
            processedSvg = processedSvg.replace(/<style([^>]*)>/, (match, attributes) => {
                return `<style${attributes}> 
                    /* 确保SVG元素不被填充，并使用继承的颜色作为描边 */
                    svg * { 
                        fill: none !important; 
                        stroke: currentColor !important;
                    }
                `;
            });
        }
        
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
                        onError={(e) => { 
                            console.error('图片加载失败:', e);
                        }}
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
                        onError={(e) => { 
                            console.error('图片加载失败:', e);
                        }}
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
        <div className={`relative aspect-square w-full max-w-[300px] mx-auto px-safe overflow-hidden ${isRunning ? 'bg-transparent' : 'bg-neutral-900'} ${isPouring ? 'isPouring' : ''}`}>
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
                            className="object-contain invert-0 dark:invert"
                            sizes="(max-width: 768px) 100vw, 300px"
                            quality={85}
                            priority={true}
                            onError={() => { }}
                        />
                    ) : (
                        // 自定义SVG内联数据 - 使用custom-cup-shape类，不再使用dark:invert
                        <div className="w-full h-full custom-shape-svg-container outline-only custom-cup-shape" 
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
                        {/* 对于普通动画类型（center, circle或自定义帧动画） */}
                        {!availableAnimations[currentPourType as keyof typeof availableAnimations]?.isStacking && (
                            <motion.div
                                key={`${currentStage}-${currentMotionIndex}`}
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.26 }}
                                className="absolute inset-0"
                            >
                                {/* 如果有自定义帧，优先使用帧 */}
                                {availableAnimations[currentPourType as keyof typeof availableAnimations]?.frames ? (
                                    // 使用自定义帧 - 使用custom-cup-shape类，不再使用dark:invert
                                    <div 
                                        className="w-full h-full flex items-center justify-center outline-only custom-cup-shape"
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
        </div>
    )
}

export default PourVisualizer
