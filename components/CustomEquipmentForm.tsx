import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { CustomEquipment } from '@/lib/config';
import { isEquipmentNameAvailable } from '@/lib/customEquipments';
import DrawingCanvas, { DrawingCanvasRef } from './DrawingCanvas';
import AnimationEditor, { AnimationEditorRef, AnimationFrame } from './AnimationEditor';
import hapticsUtils from '@/lib/haptics';
import { AnimatePresence } from 'framer-motion';
import Image from 'next/image';

// 修改CustomPourAnimation接口，添加previewSrc字段来显示预览图
interface CustomPourAnimation {
  id: string;
  name: string; // 自定义名称，如"中心注水"、"绕圈注水" 
  customAnimationSvg: string;
  isSystemDefault?: boolean; // 标记是否是系统默认类型
  pourType?: 'center' | 'circle' | 'ice'; // 对应系统默认类型
  previewFrames?: number; // 该类型动画有几帧
  frames?: AnimationFrame[]; // 动画帧数据
}

// 扩展CustomEquipment类型以包含注水动画
declare module '@/lib/config' {
  interface CustomEquipment {
    customPourAnimations?: CustomPourAnimation[];
  }
}

// 用于处理服务器端/客户端的窗口尺寸
const useWindowSize = () => {
    const [size, setSize] = useState({
        width: 0,
        height: 0
    });

    useEffect(() => {
        // 客户端才执行
        if (typeof window !== 'undefined') {
            const handleResize = () => {
                setSize({
                    width: window.innerWidth,
                    height: window.innerHeight
                });
            };

            // 初始设置
            handleResize();

            // 监听尺寸变化
            window.addEventListener('resize', handleResize);
            return () => window.removeEventListener('resize', handleResize);
        }
    }, []);

    return size;
};

interface CustomEquipmentFormProps {
    onSave: (equipment: CustomEquipment) => void;
    onCancel: () => void;
    initialEquipment?: CustomEquipment;
}

// 预设方案选项 - 简化为三种基本类型
const PRESET_OPTIONS = [
    { 
        value: 'v60', 
        label: 'V60预设', 
        description: '适用于锥形、蛋糕杯、折纸等常规滤杯',
        equipmentId: 'V60', 
    },
    { 
        value: 'clever', 
        label: '聪明杯预设', 
        description: '带阀门控制，可以控制咖啡液流出的时间',
        equipmentId: 'CleverDripper', 
    },
    { 
        value: 'custom', 
        label: '自定义预设', 
        description: '完全自定义器具，创建您自己的独特设置',
        equipmentId: '', 
    }
] as const;

// 修改默认注水类型常量
const DEFAULT_POUR_TYPES = [
    {
        id: 'system-center',
        name: '中心注水',
        pourType: 'center' as const,
        description: '中心定点注水，降低萃取率',
        isSystemDefault: true,
        previewFrames: 3
    },
    {
        id: 'system-circle',
        name: '绕圈注水',
        pourType: 'circle' as const,
        description: '中心向外缓慢画圈注水，均匀萃取咖啡风味',
        isSystemDefault: true,
        previewFrames: 4
    },
    {
        id: 'system-ice',
        name: '冰块注水',
        pourType: 'ice' as const,
        description: '适用于冰滴和冰手冲咖啡',
        isSystemDefault: true,
        previewFrames: 4
    }
];

// 表单字段组件
interface FormFieldProps {
    label: string;
    error?: string;
    children: React.ReactNode;
    hint?: string;
}

const FormField: React.FC<FormFieldProps> = ({ label, error, children, hint }) => (
    <div className="mb-4">
        <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
            {label}
        </label>
        {children}
        {hint && (
            <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                {hint}
            </p>
        )}
        {error && (
            <p className="mt-1 text-sm text-red-600 dark:text-red-400">{error}</p>
        )}
    </div>
);

// 顶部导航组件
interface TopNavProps {
    title: string;
    onBack: () => void;
    onSave?: () => void;
    saveDisabled?: boolean;
}

const TopNav: React.FC<TopNavProps> = ({ title, onBack, onSave, saveDisabled = false }) => (
    <div className="fixed top-0 left-0 right-0 z-10 bg-neutral-50 dark:bg-neutral-900 px-4 py-3 flex justify-between items-center">
        <button
            onClick={onBack}
            className="rounded-full p-2"
        >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M19 12H5M5 12L12 19M5 12L12 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
        </button>
        <h3 className="font-medium text-neutral-800 dark:text-white">{title}</h3>
        {onSave ? (
            <button
                onClick={onSave}
                disabled={saveDisabled}
                className={`p-2 rounded-full ${saveDisabled ? 'text-neutral-400 dark:text-neutral-600' : 'text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20'}`}
            >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M5 13L9 17L19 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
            </button>
        ) : (
            <div className="w-7" />
        )}
    </div>
);

const CustomEquipmentForm: React.FC<CustomEquipmentFormProps> = ({
    onSave,
    onCancel,
    initialEquipment
}) => {
    const windowSize = useWindowSize();
    const canvasContainerRef = useRef<HTMLDivElement>(null);
    const [canvasSize, setCanvasSize] = useState(300);
    const [strokeWidth, setStrokeWidth] = useState(3);
    const canvasRef = useRef<DrawingCanvasRef>(null);
    const animationEditorRef = useRef<AnimationEditorRef>(null);
    const [isPlaying, setIsPlaying] = useState(false);

    // 预设方案状态 - 根据初始值设置，如果是聪明杯则设置为clever
    const [selectedPreset, setSelectedPreset] = useState<(typeof PRESET_OPTIONS)[number]['value']>(
        initialEquipment?.hasValve ? 'clever' :
        initialEquipment?.animationType === 'custom' ? 'custom' : 'v60'
    );
    
    // 添加杯型选择状态（默认/自定义）
    const [cupShapeType, setCupShapeType] = useState<'default' | 'custom'>(
        initialEquipment?.customShapeSvg ? 'custom' : 'default'
    );
    
    // 添加阀门样式选择状态（默认/自定义）
    const [valveShapeType, setValveShapeType] = useState<'default' | 'custom'>(
        initialEquipment?.customValveSvg ? 'custom' : 'default'
    );
    
    const [equipment, setEquipment] = useState<Partial<CustomEquipment>>({
        name: '',
        description: '',
        animationType: 'v60',
        hasValve: false,
        customShapeSvg: '',
        customValveSvg: '',
        customValveOpenSvg: '',
        ...initialEquipment,
    });

    const [errors, setErrors] = useState<Record<string, string>>({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showDrawingCanvas, setShowDrawingCanvas] = useState(false);
    const [_hasDrawn, setHasDrawn] = useState(!!equipment.customShapeSvg);
    const [showReference, setShowReference] = useState(true);
    
    // 添加阀门绘制状态
    const [showValveDrawingCanvas, setShowValveDrawingCanvas] = useState(false);
    const [_hasValveDrawn, setHasValveDrawn] = useState(!!equipment.customValveSvg);
    const [valveEditMode, setValveEditMode] = useState<'closed' | 'open'>('closed');
    const [valvePreviewState, setValvePreviewState] = useState<'closed' | 'open'>('closed');
    
    // 添加对设备数据的引用，用于确保最新数据在各个视图间同步
    const equipmentRef = useRef<Partial<CustomEquipment>>(equipment);
    
    // 当equipment状态更新时，同步更新引用
    useEffect(() => {
        equipmentRef.current = equipment;
    }, [equipment]);
    
    // 添加当前预览帧状态
    const [previewFrameIndexes, setPreviewFrameIndexes] = useState<Record<string, number>>({});
    
    // 初始化注水方式，合并系统默认和用户自定义
    const [customPourAnimations, setCustomPourAnimations] = useState<CustomPourAnimation[]>(() => {
        // 处理用户自定义的注水动画
        const userCustom = initialEquipment?.customPourAnimations || [];
        
        // 为自定义动画计算previewFrames
        const processedUserCustom = userCustom.filter(anim => !anim.isSystemDefault).map(anim => {
            // 如果有frames属性，则将previewFrames设置为frames的长度
            if (anim.frames && anim.frames.length > 0) {
                return {
                    ...anim,
                    previewFrames: anim.frames.length
                };
            }
            // 否则保持原样
            return anim;
        });
        
        // 如果是自定义预设，只返回用户自定义的注水动画
        if (selectedPreset === 'custom') {
            return processedUserCustom;
        }
        
        // 否则包含系统默认注水方式
        const defaults: CustomPourAnimation[] = DEFAULT_POUR_TYPES.map(type => ({
            id: type.id,
            name: type.name,
            customAnimationSvg: '',
            isSystemDefault: true,
            pourType: type.pourType,
            previewFrames: type.previewFrames
        }));
        
        return [...defaults, ...processedUserCustom];
    });

    // 添加一个ref用于跟踪最新的customPourAnimations
    const customPourAnimationsRef = useRef<CustomPourAnimation[]>(customPourAnimations);

    // 更新ref中的值
    useEffect(() => {
        customPourAnimationsRef.current = customPourAnimations;
        
        // 检查并初始化新的自定义动画的预览帧索引
        setPreviewFrameIndexes(prev => {
            const newIndexes = {...prev};
            
            customPourAnimations.forEach(anim => {
                // 如果动画还没有预览帧索引，初始化为1
                if (!newIndexes[anim.id]) {
                    newIndexes[anim.id] = 1;
                }
            });
            
            return newIndexes;
        });
    }, [customPourAnimations]);

    // 初始化预览帧并设置循环定时器
    useEffect(() => {
        // 设置初始预览帧
        const initialPreviewFrames: Record<string, number> = {};
        
        // 为所有动画设置预览帧
        customPourAnimations.forEach(anim => {
            initialPreviewFrames[anim.id] = 1;
        });
        
        setPreviewFrameIndexes(initialPreviewFrames);
        
        // 设置定时器循环播放预览动画
        const previewTimer = setInterval(() => {
            setPreviewFrameIndexes(prev => {
                const newIndexes = {...prev};
                
                // 使用ref中的最新值
                customPourAnimationsRef.current.forEach(anim => {
                    const currentIndex = prev[anim.id] || 1;
                    
                    // 获取最大帧数
                    let maxFrames = 1;
                    if (anim.frames && Array.isArray(anim.frames) && anim.frames.length > 1) {
                        maxFrames = anim.frames.length;
                    } else if (anim.previewFrames && anim.previewFrames > 1) {
                        maxFrames = anim.previewFrames;
                    } else {
                        // 只有一帧，不需要更新索引，但仍需继续处理其他动画
                        return;
                    }
                    
                    // 确保最大帧数至少为1
                    maxFrames = Math.max(1, maxFrames);
                    
                    // 更新到下一帧，或循环回第一帧
                    newIndexes[anim.id] = currentIndex >= maxFrames ? 1 : currentIndex + 1;
                });
                
                return newIndexes;
            });
            
            // 切换阀门预览状态
            setValvePreviewState(prev => prev === 'closed' ? 'open' : 'closed');
        }, 800); // 每800ms更新一次
        
        return () => clearInterval(previewTimer);
    }, []); // 保持空依赖数组

    const [showPourAnimationCanvas, setShowPourAnimationCanvas] = useState(false);
    const [currentEditingAnimation, setCurrentEditingAnimation] = useState<CustomPourAnimation | null>(null);
    
    // 监听预设方案变化
    useEffect(() => {
        if (selectedPreset === 'v60') {
            handleChange('animationType', 'v60');
            handleChange('hasValve', false);
        } else if (selectedPreset === 'clever') {
            handleChange('animationType', 'clever');
            handleChange('hasValve', true);
        } else if (selectedPreset === 'custom') {
            handleChange('animationType', 'custom');
            // 自定义预设强制使用自定义杯型
            setCupShapeType('custom');
            // 自定义预设时，过滤掉系统默认注水方式
            setCustomPourAnimations(prev => prev.filter(anim => !anim.isSystemDefault));
            // 自定义预设不自动设置阀门，保持当前值
        }
    }, [selectedPreset]);

    // 计算画布尺寸
    useEffect(() => {
        if ((showDrawingCanvas || showPourAnimationCanvas || showValveDrawingCanvas) && canvasContainerRef.current && windowSize.width > 0) {
            // 获取容器宽度，不再减去padding
            const containerWidth = canvasContainerRef.current.clientWidth;
            setCanvasSize(containerWidth);
        }
    }, [showDrawingCanvas, showPourAnimationCanvas, showValveDrawingCanvas, windowSize.width]);

    // 处理笔触宽度变化
    const handleStrokeWidthChange = (newWidth: number) => {
        const width = Math.min(Math.max(newWidth, 1), 10);
        setStrokeWidth(width);
        if (canvasRef.current) {
            canvasRef.current.setStrokeWidth(width);
        }
    };

    // 更新表单字段值的处理函数
    const handleChange = <K extends keyof CustomEquipment>(
        key: K, 
        value: CustomEquipment[K]
    ) => {
        setEquipment(prev => ({ ...prev, [key]: value }));
    };

    // 验证表单
    const validateForm = async () => {
        const newErrors: Record<string, string> = {};

        if (!equipment.name?.trim()) {
            newErrors.name = '请输入器具名称';
        } else if (!(await isEquipmentNameAvailable(equipment.name, initialEquipment?.id))) {
            newErrors.name = '器具名称已存在';
        }

        if (!equipment.description?.trim()) {
            newErrors.description = '请输入器具描述';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    // 处理表单提交
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);

        try {
            if (await validateForm()) {
                // 检查自定义注水动画的帧数据
                const processedAnimations = customPourAnimations
                    .filter(animation => !animation.isSystemDefault) // 确保过滤掉系统默认注水方式
                    .map(animation => {
                        if (animation.frames && animation.frames.length > 1) {
                            console.log(`[提交] 注水动画 ${animation.id} (${animation.name}): ${animation.frames.length} 帧, previewFrames: ${animation.previewFrames || 0}`);
                        }
                        return animation;
                    });
                
                const equipmentToSave = {
                    ...equipment as CustomEquipment,
                    isCustom: true as const,
                    customPourAnimations: selectedPreset === 'custom' 
                        ? processedAnimations
                        : undefined,
                };
                
                // 检查杯型SVG数据是否存在
                if (equipmentToSave.customShapeSvg) {
                    console.log('保存设备时包含自定义杯型SVG，长度:', 
                        equipmentToSave.customShapeSvg.length);
                }
                
                // 检查自定义阀门SVG数据是否存在
                if (equipmentToSave.customValveSvg) {
                    console.log('保存设备时包含自定义阀门关闭状态SVG，长度:',
                        equipmentToSave.customValveSvg.length);
                }
                
                // 检查自定义阀门开启状态SVG数据是否存在
                if (equipmentToSave.customValveOpenSvg) {
                    console.log('保存设备时包含自定义阀门开启状态SVG，长度:',
                        equipmentToSave.customValveOpenSvg.length);
                }
                
                // 检查最终传递的自定义注水动画数据
                if (equipmentToSave.customPourAnimations) {
                    console.log(`[提交] 最终包含 ${equipmentToSave.customPourAnimations.length} 个注水动画`);
                    equipmentToSave.customPourAnimations.forEach(anim => {
                        if (anim.frames && anim.frames.length > 1) {
                            console.log(`[提交] 传递动画 ${anim.id} (${anim.name}): ${anim.frames.length} 帧, previewFrames: ${anim.previewFrames || 0}`);
                        }
                    });
                }
                
                onSave(equipmentToSave);
            }
        } catch (error) {
            console.error('保存器具失败:', error);
        } finally {
            setIsSubmitting(false);
        }
    };

    // 处理杯型绘制完成
    const handleDrawingComplete = (svg: string) => {
        console.log('杯型绘制完成，获取到SVG数据，长度:', svg.length);
        if (svg && svg.trim() !== '') {
            // 更新equipment状态
            setEquipment(prev => ({
                ...prev,
                customShapeSvg: svg
            }));
            setHasDrawn(true);
            console.log('已保存自定义杯型SVG到设备数据中');
            
            // 确保在绘制完成后立即更新引用值，避免状态延迟同步问题
            equipmentRef.current = {
                ...equipmentRef.current,
                customShapeSvg: svg
            };
        } else {
            console.error('绘制完成但SVG数据为空');
        }
    };

    // 处理阀门绘制完成
    const handleValveDrawingComplete = (svg: string) => {
        console.log(`阀门(${valveEditMode}状态)绘制完成，获取到SVG数据，长度:`, svg.length);
        if (svg && svg.trim() !== '') {
            // 确保自定义阀门与杯型一起显示
            setEquipment(prev => {
                // 创建一个更新后的设备对象
                const updatedEquipment = {
                    ...prev,
                    ...(valveEditMode === 'closed' 
                        ? { customValveSvg: svg }
                        : { customValveOpenSvg: svg })
                };
                
                // 确保设备对象有customShapeSvg, hasValve等属性
                if (!updatedEquipment.hasValve) {
                    updatedEquipment.hasValve = true;
                }
                
                console.log(`已保存自定义阀门${valveEditMode}状态SVG到设备数据中`);
                return updatedEquipment;
            });
            
            setHasValveDrawn(true);
            setValveShapeType('custom');
        } else {
            console.error('绘制完成但SVG数据为空');
        }
    };

    // 保存绘图并返回表单界面
    const handleSaveDrawing = () => {
        hapticsUtils.medium();
        
        if (canvasRef.current) {
            try {
                const svgString = canvasRef.current.save();
                handleDrawingComplete(svgString);
                setShowDrawingCanvas(false);
            } catch (error) {
                console.error('无法获取绘图数据:', error);
            }
        }
    };

    // 保存阀门绘图并返回表单界面
    const handleSaveValveDrawing = () => {
        hapticsUtils.medium();
        
        if (canvasRef.current) {
            try {
                const svgString = canvasRef.current.save();
                handleValveDrawingComplete(svgString);
                setShowValveDrawingCanvas(false);
            } catch (error) {
                console.error(`无法获取阀门${valveEditMode}状态绘图数据:`, error);
            }
        }
    };

    // 返回表单界面
    const handleBackToForm = () => {
        setShowDrawingCanvas(false);
        setShowValveDrawingCanvas(false);
    };

    // 切换到绘图界面
    const handleShowDrawingCanvas = () => {
        hapticsUtils.light();
        setShowDrawingCanvas(true);
    };

    // 切换到阀门绘图界面
    const handleShowValveDrawingCanvas = (mode: 'closed' | 'open' = 'closed') => {
        hapticsUtils.light();
        setValveEditMode(mode);
        setShowValveDrawingCanvas(true);
    };

    // 注水动画相关函数
    const handleAddPourAnimation = () => {
        // 创建新的注水动画
        const newAnimation: CustomPourAnimation = {
            id: `pour-${Date.now()}`,
            name: '自定义注水',
            customAnimationSvg: '',
            isSystemDefault: false
        };
        setCurrentEditingAnimation(newAnimation);
        setShowPourAnimationCanvas(true);
    };

    const handleEditPourAnimation = (animation: CustomPourAnimation) => {
        // 记录当前杯型状态，有助于调试
        console.log('[编辑注水] 开始编辑注水动画时的杯型状态:', {
            hasCustomShape: !!equipment.customShapeSvg,
            svgLength: equipment.customShapeSvg?.length || 0,
            animationId: animation.id,
            animationName: animation.name
        });
        
        // 确保引用数据是最新的
        if (equipment.customShapeSvg) {
            equipmentRef.current = {
                ...equipmentRef.current,
                customShapeSvg: equipment.customShapeSvg
            };
            
            console.log('[编辑注水] 已更新设备引用数据');
        }
        
        setCurrentEditingAnimation({...animation});
        setShowPourAnimationCanvas(true);
    };

    // 修改handleDeletePourAnimation函数
    const handleDeletePourAnimation = (id: string) => {
        hapticsUtils.medium();
        setCustomPourAnimations(prev => prev.filter(a => a.id !== id));
    };

    // 获取注水动画参考图像
    const getPourAnimationReferenceImages = (animation: CustomPourAnimation): { url: string; label: string }[] => {
        if (animation.isSystemDefault && animation.pourType && animation.previewFrames) {
            // 获取系统默认动画的参考图像
            const frames = [];
            for (let i = 0; i < animation.previewFrames; i++) {
                frames.push({
                    url: `/images/pour-animations/${animation.pourType}/frame-${i + 1}.png`,
                    label: `帧 ${i + 1}`
                });
            }
            return frames;
        }
        return [];
    };

    // 将SVG文本转换为AnimationFrame
    const _svgToAnimationFrames = (svgText: string) => {
        if (!svgText || svgText.trim() === '') {
            console.log('[转换] SVG文本为空，创建空帧');
            return [{ id: 'frame-1', svgData: '' }];
        }
        
        console.log(`[转换] 转换SVG文本为动画帧，长度: ${svgText.length}`);
        // 如果是单个SVG文本（旧版本的动画），将其转为单帧数据
        return [{ id: 'frame-1', svgData: svgText }];
    };
    
    // 将AnimationFrame数组转换为SVG文本
    const animationFramesToSvg = (frames: AnimationFrame[]) => {
        // 对于新版本多帧动画，我们需要存储全部帧数据
        // 但为了兼容旧版，目前我们仅使用第一帧作为customAnimationSvg
        if (!frames || frames.length === 0) {
            return '';
        }
        
        // 使用第一帧的SVG数据
        return frames[0].svgData || '';
    };

    // 处理保存动画编辑
    const handleSavePourAnimation = () => {
        hapticsUtils.medium();
        
        if (animationEditorRef.current && currentEditingAnimation) {
            try {
                // 获取所有动画帧
                const frames = animationEditorRef.current.save();
                
                // 转换为SVG文本用于兼容旧版
                const svgString = animationFramesToSvg(frames);
                
                if (frames.length > 0) {
                    const updatedAnimation = {
                        ...currentEditingAnimation,
                        customAnimationSvg: svgString,
                        frames: frames, // 保存所有帧数据
                        previewFrames: frames.length // 确保设置正确的预览帧数量
                    };
                    
                    console.log(`[保存] 动画ID: ${updatedAnimation.id}, 保存帧数: ${frames.length}, 第一帧SVG长度: ${svgString.length}, previewFrames: ${updatedAnimation.previewFrames}`);
                    
                    // 更新或添加注水动画
                    setCustomPourAnimations(prev => {
                        const index = prev.findIndex(a => a.id === updatedAnimation.id);
                        if (index >= 0) {
                            const newAnimations = [...prev];
                            newAnimations[index] = updatedAnimation;
                            return newAnimations;
                        } else {
                            return [...prev, updatedAnimation];
                        }
                    });
                    
                    // 确保此动画的预览帧索引被设置为1，以便从头开始播放动画
                    setPreviewFrameIndexes(prev => ({
                        ...prev,
                        [updatedAnimation.id]: 1
                    }));
                    
                    setShowPourAnimationCanvas(false);
                    setCurrentEditingAnimation(null);
                }
            } catch (error) {
                console.error('无法获取注水动画数据:', error);
            }
        }
    };

    // 处理注水动画名称变更
    const handlePourAnimationNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (currentEditingAnimation) {
            setCurrentEditingAnimation(prev => ({
                ...prev!,
                name: e.target.value // 直接使用输入值，不做trim，让用户可以输入空格
            }));
        }
    };

    // 添加播放状态切换函数 - 使用useCallback以便可以用于依赖数组
    const handleTogglePlayback = useCallback(() => {
        if (animationEditorRef.current) {
            animationEditorRef.current.togglePlayback();
            setIsPlaying(prev => !prev);
        }
    }, []);
    
    // 添加删除帧函数 - 使用useCallback
    const handleDeleteCurrentFrame = useCallback(() => {
        if (animationEditorRef.current) {
            animationEditorRef.current.deleteFrame();
        }
    }, []);
    
    // 添加创建新帧函数 - 使用useCallback
    const handleAddNewFrame = useCallback((e: React.MouseEvent) => {
        // 阻止事件冒泡，确保不会关闭模态框
        e.stopPropagation();
        e.preventDefault();
        if (animationEditorRef.current) {
            animationEditorRef.current.addFrame();
        }
    }, []);
    
    // 退出编辑器时重置播放状态
    useEffect(() => {
        if (!showPourAnimationCanvas) {
            setIsPlaying(false);
        }
    }, [showPourAnimationCanvas]);

    // 添加监听器，确保在打开注水动画编辑器时使用最新的杯型数据
    useEffect(() => {
        if (showPourAnimationCanvas && currentEditingAnimation) {
            if (process.env.NODE_ENV === 'development') {
                console.debug('[注水动画编辑] 监测到编辑器打开');
                // 确保设备引用是最新的
                if (equipment.customShapeSvg) {
                    console.debug('[注水动画编辑] 杯型数据状态:', {
                        hasCustomShape: true,
                        svgLength: equipment.customShapeSvg.length,
                        equipmentId: equipment.id || '未保存设备',
                        animationId: currentEditingAnimation.id
                    });
                }
            }
        }
    }, [showPourAnimationCanvas, currentEditingAnimation?.id]);

    // 获取参考图像
    const referenceImageUrls = useMemo(() => 
        currentEditingAnimation 
            ? getPourAnimationReferenceImages(currentEditingAnimation)
            : [],
        [currentEditingAnimation]
    );
    
    // 获取自定义杯型SVG
    const customShapeSvg = useMemo(() => {
        const svg = equipment.customShapeSvg || equipmentRef.current.customShapeSvg;
        if (svg) {
            console.log('[注水动画编辑] 初始化杯型数据:', svg.length);
        }
        return svg;
    }, [equipment.customShapeSvg]); // 只依赖于 equipment.customShapeSvg
    
    // 获取初始帧数据
    const initialFrames = useMemo(() => {
        if (!currentEditingAnimation) return [{ id: 'frame-1', svgData: '' }];
        
        if (process.env.NODE_ENV === 'development') {
            console.debug('[注水动画编辑] 帧数据状态:', {
                hasFrames: Boolean(currentEditingAnimation.frames?.length),
                hasCustomAnimation: Boolean(currentEditingAnimation.customAnimationSvg),
                framesCount: currentEditingAnimation.frames?.length || 0,
                animationId: currentEditingAnimation.id
            });
        }
        
        if (currentEditingAnimation.frames && currentEditingAnimation.frames.length > 0) {
            return currentEditingAnimation.frames;
        }
        if (currentEditingAnimation.customAnimationSvg) {
            return _svgToAnimationFrames(currentEditingAnimation.customAnimationSvg);
        }
        return [{ id: 'frame-1', svgData: '' }];
    }, [currentEditingAnimation]);
    
    // 生成编辑器key - 添加 showPourAnimationCanvas 作为依赖
    const editorKey = useMemo(() => 
        currentEditingAnimation
            ? `animation-editor-${currentEditingAnimation.id}-${customShapeSvg?.length || 0}-${showPourAnimationCanvas}`
            : '',
        [currentEditingAnimation, customShapeSvg, showPourAnimationCanvas]
    );

    // 渲染注水动画画布
    const renderPourAnimationCanvas = useCallback(() => {
        if (!currentEditingAnimation) return null;
        
        return (
            <>
                <TopNav 
                    title={currentEditingAnimation.id.startsWith('system-') 
                        ? `编辑${currentEditingAnimation.name}动画`
                        : currentEditingAnimation.customAnimationSvg 
                            ? "编辑注水动画" 
                            : "添加注水动画"
                    }
                    onBack={() => {
                        setShowPourAnimationCanvas(false);
                        setIsPlaying(false);
                    }}
                    onSave={handleSavePourAnimation}
                />
                
                <div className="mb-4">
                    <FormField label="动画名称">
                        <input
                            type="text"
                            value={currentEditingAnimation.name}
                            onChange={handlePourAnimationNameChange}
                            className="mt-1 block w-full rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-3 py-2 text-sm focus:border-blue-500 focus:ring-blue-500 dark:text-white"
                            placeholder="例如：中心注水"
                            readOnly={currentEditingAnimation.isSystemDefault}
                            maxLength={20}
                        />
                    </FormField>
                    
                    {currentEditingAnimation.isSystemDefault && (
                        <p className="mt-2 text-xs text-blue-600 dark:text-blue-400">
                            这是系统默认注水方式，您可以自定义其动画效果，但名称不可修改。
                        </p>
                    )}
                </div>
                
                <div className="mb-2">
                    <h3 className="text-sm font-medium text-neutral-600 dark:text-neutral-400 mb-2">绘制注水动画</h3>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-2">
                        请在画布上绘制咖啡滴落的动画效果，创建多个帧以实现动态效果。点击上方帧缩略图可切换帧。
                    </p>
                </div>
                
                <div 
                    ref={canvasContainerRef}
                    className="w-full rounded-xl mx-auto overflow-hidden"
                >
                    {canvasSize > 0 && (
                        <div className="animation-editor-custom">
                            <style jsx>{`
                                .animation-editor-custom :global(.flex.flex-col.space-y-2 > div.flex.justify-between) {
                                    display: none;
                                }
                                .animation-editor-custom :global(.flex.flex-col.space-y-2 > div.mt-2) {
                                    display: none;
                                }
                                .animation-editor-custom :global(.flex-shrink-0.w-16.h-16.bg-neutral-200.dark\\:bg-neutral-700.rounded-md.border-2.border-dashed) {
                                    display: none;
                                }
                            `}</style>
                            <AnimationEditor
                                ref={animationEditorRef}
                                width={canvasSize}
                                height={canvasSize}
                                initialFrames={initialFrames}
                                referenceImages={referenceImageUrls}
                                strokeColor="white"
                                maxFrames={currentEditingAnimation.previewFrames || 4}
                                referenceSvg={customShapeSvg}
                                key={editorKey}
                            />
                        </div>
                    )}
                </div>
                
                {/* 工具栏区域 - 不再需要自定义添加帧按钮，使用AnimationEditor原生的帧管理功能 */}
                <div className="flex justify-between mt-6">
                    {/* 左侧：画笔大小控制 */}
                    <div className="flex items-center space-x-3">
                        <button
                            type="button"
                            onClick={() => {
                                if (animationEditorRef.current) {
                                    animationEditorRef.current.setStrokeWidth(strokeWidth - 1);
                                    setStrokeWidth(prev => Math.max(1, prev - 1));
                                }
                            }}
                            className="w-10 h-10 rounded-full bg-white dark:bg-neutral-800 flex items-center justify-center border border-neutral-200 dark:border-neutral-700"
                            aria-label="减小线条粗细"
                        >
                            <span className="text-lg font-medium">−</span>
                        </button>
                        
                        <div className="flex items-center justify-center h-10 w-10 bg-white dark:bg-neutral-800 rounded-full border border-neutral-200 dark:border-neutral-700">
                            <div 
                                className="rounded-full bg-neutral-900 dark:bg-white"
                                style={{ 
                                    width: `${strokeWidth}px`, 
                                    height: `${strokeWidth}px`
                                }}
                                aria-label={`笔触大小: ${strokeWidth}`}
                            />
                        </div>
                        
                        <button
                            type="button"
                            onClick={() => {
                                if (animationEditorRef.current) {
                                    animationEditorRef.current.setStrokeWidth(strokeWidth + 1);
                                    setStrokeWidth(prev => Math.min(10, prev + 1));
                                }
                            }}
                            className="w-10 h-10 rounded-full bg-white dark:bg-neutral-800 flex items-center justify-center border border-neutral-200 dark:border-neutral-700"
                            aria-label="增加线条粗细"
                        >
                            <span className="text-lg font-medium">+</span>
                        </button>
                    </div>
                    
                    {/* 右侧：播放/暂停、撤销、删除 */}
                    <div className="flex items-center space-x-3">
                        {/* 添加帧按钮 */}
                        <button
                            type="button"
                            onClick={handleAddNewFrame}
                            className="w-10 h-10 rounded-full bg-white dark:bg-neutral-800 flex items-center justify-center border border-neutral-200 dark:border-neutral-700"
                            aria-label="添加帧"
                        >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M12 5V19M5 12H19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                        </button>

                        <button
                            type="button"
                            onClick={handleTogglePlayback}
                            className="w-10 h-10 rounded-full bg-white dark:bg-neutral-800 flex items-center justify-center border border-neutral-200 dark:border-neutral-700"
                            aria-label={isPlaying ? "暂停" : "播放"}
                        >
                            {isPlaying ? (
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M10 9V15M14 9V15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                            ) : (
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M6 4.75L17.25 12L6 19.25V4.75Z" fill="currentColor" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                            )}
                        </button>
                        
                        <button
                            type="button"
                            onClick={() => animationEditorRef.current?.undo()}
                            className="w-10 h-10 rounded-full bg-white dark:bg-neutral-800 flex items-center justify-center border border-neutral-200 dark:border-neutral-700"
                            aria-label="撤销"
                        >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M8 10L4 14M4 14L8 18M4 14H16C18.2091 14 20 12.2091 20 10C20 7.79086 18.2091 6 16 6H12" 
                                    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                        </button>
                        
                        <button
                            type="button"
                            onClick={handleDeleteCurrentFrame}
                            className="w-10 h-10 rounded-full bg-white dark:bg-neutral-800 flex items-center justify-center border border-neutral-200 dark:border-neutral-700"
                            aria-label="删除帧"
                        >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M19 7L18.1327 19.1425C18.0579 20.1891 17.187 21 16.1378 21H7.86224C6.81296 21 5.94208 20.1891 5.86732 19.1425L5 7M10 11V17M14 11V17M15 7V4C15 3.44772 14.5523 3 14 3H10C9.44772 3 9 3.44772 9 4V7M4 7H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                        </button>
                    </div>
                </div>
                
                {/* 绘图提示 */}
                <div className="mt-4 text-xs text-neutral-500 dark:text-neutral-400 bg-neutral-100 dark:bg-neutral-900 p-3 rounded-lg">
                    <h4 className="font-medium mb-1">动画绘制提示</h4>
                    <ul className="list-disc pl-4 space-y-1">
                        <li>点击上方的缩略图切换帧</li>
                        <li>点击 + 按钮添加新帧</li>
                        <li>使用播放按钮预览动画效果</li>
                        <li>左右箭头键可以快速切换帧</li>
                        <li>可以复制现有帧作为起点</li>
                        <li>绘制完成后点击右上角保存按钮</li>
                    </ul>
                </div>
            </>
        );
    }, [strokeWidth, handleTogglePlayback, handleDeleteCurrentFrame, handleAddNewFrame, currentEditingAnimation, canvasSize, customShapeSvg, showPourAnimationCanvas]);

    // 渲染绘图界面
    const renderDrawingCanvas = () => (
        <>
            <TopNav 
                title="绘制自定义杯型" 
                onBack={handleBackToForm}
                onSave={handleSaveDrawing}
            />
                <div 
                    ref={canvasContainerRef}
                    className="w-full bg-neutral-50 dark:bg-neutral-800 rounded-xl mx-auto"
                >
                    {canvasSize > 0 && (
                        <DrawingCanvas
                            ref={canvasRef}
                            width={canvasSize}
                            height={canvasSize}
                            defaultSvg={equipment.customShapeSvg}
                            onDrawingComplete={(svg) => {
                                handleDrawingComplete(svg);
                                setHasDrawn(true);
                            }}
                            showReference={showReference}
                            referenceSvgUrl="/images/v60-base.svg"
                        />
                    )}
                </div>
                
                <div className="flex justify-between mt-6">
                    {/* 左侧：画笔大小控制 */}
                    <div className="flex items-center space-x-3">
                        <button
                            type="button"
                            onClick={() => handleStrokeWidthChange(strokeWidth - 1)}
                            className="w-10 h-10 rounded-full bg-white dark:bg-neutral-800 flex items-center justify-center border border-neutral-200 dark:border-neutral-700"
                            aria-label="减小线条粗细"
                        >
                            <span className="text-lg font-medium">−</span>
                        </button>
                        
                        <div className="flex items-center justify-center h-10 w-10 bg-white dark:bg-neutral-800 rounded-full border border-neutral-200 dark:border-neutral-700">
                            <div 
                                className="rounded-full bg-neutral-900 dark:bg-white"
                                style={{ 
                                    width: `${strokeWidth}px`, 
                                    height: `${strokeWidth}px`
                                }}
                                aria-label={`笔触大小: ${strokeWidth}`}
                            />
                        </div>
                        
                        <button
                            type="button"
                            onClick={() => handleStrokeWidthChange(strokeWidth + 1)}
                            className="w-10 h-10 rounded-full bg-white dark:bg-neutral-800 flex items-center justify-center border border-neutral-200 dark:border-neutral-700"
                            aria-label="增加线条粗细"
                        >
                            <span className="text-lg font-medium">+</span>
                        </button>
                    </div>
                    
                    {/* 右侧：撤销、清除和底图切换 */}
                    <div className="flex items-center space-x-3">
                        <button
                            type="button"
                            onClick={() => setShowReference(!showReference)}
                            className="w-10 h-10 rounded-full bg-white dark:bg-neutral-800 flex items-center justify-center border border-neutral-200 dark:border-neutral-700"
                            aria-label={showReference ? "隐藏底图" : "显示底图"}
                        >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                {showReference ? (
                                    <path d="M12.5 4.5H18C19.1046 4.5 20 5.39543 20 6.5V12M20 18V16M6 20H12M4 6V12M4 16V18C4 19.1046 4.89543 20 6 20M18 4.5H16M8 4H6C4.89543 4 4 4.89543 4 6" 
                                        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                ) : (
                                    <path d="M4 6V12M4 16V18C4 19.1046 4.89543 20 6 20H12M18 20H20M8 4H6C4.89543 4 4 4.89543 4 6M18 4H16M12 4H8M20 12V6C20 4.89543 19.1046 4 18 4" 
                                        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                )}
                            </svg>
                        </button>
                        
                        <button
                            type="button"
                            onClick={() => canvasRef.current?.undo()}
                            className="w-10 h-10 rounded-full bg-white dark:bg-neutral-800 flex items-center justify-center border border-neutral-200 dark:border-neutral-700"
                            aria-label="撤销"
                        >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M8 10L4 14M4 14L8 18M4 14H16C18.2091 14 20 12.2091 20 10C20 7.79086 18.2091 6 16 6H12" 
                                    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                        </button>
                        
                        <button
                            type="button"
                            onClick={() => canvasRef.current?.clear()}
                            className="w-10 h-10 rounded-full bg-white dark:bg-neutral-800 flex items-center justify-center border border-neutral-200 dark:border-neutral-700"
                            aria-label="清除"
                        >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M4 7H20M10 11V17M14 11V17M5 7L6 19C6 20.1 6.9 21 8 21H16C17.1 21 18 20.1 18 19L19 7M9 7V4C9 3.45 9.45 3 10 3H14C14.55 3 15 3.45 15 4V7M4 7H20" 
                                    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                        </button>
                    </div>
                </div>
        </>
    );

    // 渲染阀门绘图界面
    const renderValveDrawingCanvas = () => (
        <>
            <TopNav 
                title={valveEditMode === 'closed' ? "绘制阀门关闭状态" : "绘制阀门开启状态"} 
                onBack={handleBackToForm}
                onSave={handleSaveValveDrawing}
            />
                <div 
                    ref={canvasContainerRef}
                    className="w-full bg-neutral-50 dark:bg-neutral-800 rounded-xl mx-auto"
                >
                    {canvasSize > 0 && (
                        <DrawingCanvas
                            ref={canvasRef}
                            width={canvasSize}
                            height={canvasSize}
                            defaultSvg={valveEditMode === 'closed' ? equipment.customValveSvg : equipment.customValveOpenSvg}
                            onDrawingComplete={(svg) => {
                                handleValveDrawingComplete(svg);
                                setHasValveDrawn(true);
                            }}
                            showReference={showReference}
                            // 设置参考图像的优先级：
                            // 1. customReferenceSvg: 滤杯SVG (作为主背景)
                            // 2. referenceSvg: 另一状态的阀门SVG (作为参考)
                            customReferenceSvg={equipment.customShapeSvg || undefined}
                            // 另一状态的阀门作为参考
                            referenceSvg={valveEditMode === 'closed' 
                                ? equipment.customValveOpenSvg  // 如果当前是绘制关闭状态，则显示开启状态作为参考
                                : equipment.customValveSvg      // 如果当前是绘制开启状态，则显示关闭状态作为参考
                            }
                            // 如果没有自定义滤杯，使用默认V60滤杯作为底图
                            referenceSvgUrl={!equipment.customShapeSvg ? "/images/v60-base.svg" : undefined}
                        />
                    )}
                </div>
                
                <div className="flex justify-between mt-6">
                    {/* 左侧：画笔大小控制 */}
                    <div className="flex items-center space-x-3">
                        <button
                            type="button"
                            onClick={() => handleStrokeWidthChange(strokeWidth - 1)}
                            className="w-10 h-10 rounded-full bg-white dark:bg-neutral-800 flex items-center justify-center border border-neutral-200 dark:border-neutral-700"
                            aria-label="减小线条粗细"
                        >
                            <span className="text-lg font-medium">−</span>
                        </button>
                        
                        <div className="flex items-center justify-center h-10 w-10 bg-white dark:bg-neutral-800 rounded-full border border-neutral-200 dark:border-neutral-700">
                            <div 
                                className="rounded-full bg-neutral-900 dark:bg-white"
                                style={{ 
                                    width: `${strokeWidth}px`, 
                                    height: `${strokeWidth}px`
                                }}
                                aria-label={`笔触大小: ${strokeWidth}`}
                            />
                        </div>
                        
                        <button
                            type="button"
                            onClick={() => handleStrokeWidthChange(strokeWidth + 1)}
                            className="w-10 h-10 rounded-full bg-white dark:bg-neutral-800 flex items-center justify-center border border-neutral-200 dark:border-neutral-700"
                            aria-label="增加线条粗细"
                        >
                            <span className="text-lg font-medium">+</span>
                        </button>
                    </div>
                    
                    {/* 右侧：阀门状态切换、撤销、清除和底图切换 */}
                    <div className="flex items-center space-x-3">
                        {/* 切换阀门状态按钮 */}
                        <button
                            type="button"
                            onClick={() => {
                                const newMode = valveEditMode === 'closed' ? 'open' : 'closed';
                                // 保存当前绘制内容
                                if (canvasRef.current) {
                                    try {
                                        const svgString = canvasRef.current.save();
                                        handleValveDrawingComplete(svgString);
                                    } catch (error) {
                                        console.error(`无法保存当前阀门${valveEditMode}状态绘图数据:`, error);
                                    }
                                }
                                // 切换到另一个状态
                                setValveEditMode(newMode);
                            }}
                            className="w-10 h-10 rounded-full bg-white dark:bg-neutral-800 flex items-center justify-center border border-neutral-200 dark:border-neutral-700"
                            aria-label={`切换到${valveEditMode === 'closed' ? '开启' : '关闭'}状态`}
                        >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M14.6 15.5l4.6-4.6c.4-.4.4-1 0-1.4l-4.6-4.6M9.4 15.5L4.8 10.9c-.4-.4-.4-1 0-1.4l4.6-4.6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                            <span className="absolute top-0 right-0 bg-blue-500 dark:bg-blue-600 text-white text-[8px] w-4 h-4 flex items-center justify-center rounded-full">
                                {valveEditMode === 'closed' ? 'O' : 'C'}
                            </span>
                        </button>

                        <button
                            type="button"
                            onClick={() => setShowReference(!showReference)}
                            className="w-10 h-10 rounded-full bg-white dark:bg-neutral-800 flex items-center justify-center border border-neutral-200 dark:border-neutral-700"
                            aria-label={showReference ? "隐藏底图" : "显示底图"}
                        >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                {showReference ? (
                                    <path d="M12.5 4.5H18C19.1046 4.5 20 5.39543 20 6.5V12M20 18V16M6 20H12M4 6V12M4 16V18C4 19.1046 4.89543 20 6 20M18 4.5H16M8 4H6C4.89543 4 4 4.89543 4 6" 
                                        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                ) : (
                                    <path d="M4 6V12M4 16V18C4 19.1046 4.89543 20 6 20H12M18 20H20M8 4H6C4.89543 4 4 4.89543 4 6M18 4H16M12 4H8M20 12V6C20 4.89543 19.1046 4 18 4" 
                                        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                )}
                            </svg>
                        </button>
                        
                        <button
                            type="button"
                            onClick={() => canvasRef.current?.undo()}
                            className="w-10 h-10 rounded-full bg-white dark:bg-neutral-800 flex items-center justify-center border border-neutral-200 dark:border-neutral-700"
                            aria-label="撤销"
                        >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M8 10L4 14M4 14L8 18M4 14H16C18.2091 14 20 12.2091 20 10C20 7.79086 18.2091 6 16 6H12" 
                                    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                        </button>
                        
                        <button
                            type="button"
                            onClick={() => canvasRef.current?.clear()}
                            className="w-10 h-10 rounded-full bg-white dark:bg-neutral-800 flex items-center justify-center border border-neutral-200 dark:border-neutral-700"
                            aria-label="清除"
                        >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M4 7H20M10 11V17M14 11V17M5 7L6 19C6 20.1 6.9 21 8 21H16C17.1 21 18 20.1 18 19L19 7M9 7V4C9 3.45 9.45 3 10 3H14C14.55 3 15 3.45 15 4V7M4 7H20" 
                                    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                        </button>
                    </div>
                </div>
                
                <div className="mt-4 text-xs text-neutral-500 dark:text-neutral-400 bg-neutral-100 dark:bg-neutral-900 p-3 rounded-lg">
                    <h4 className="font-medium mb-1">阀门绘制提示</h4>
                    <ul className="list-disc pl-4 space-y-1">
                        <li>当前绘制：{valveEditMode === 'closed' ? "关闭" : "开启"}状态的阀门</li>
                        <li>使用<span className="inline-flex items-center justify-center bg-neutral-200 dark:bg-neutral-700 rounded-full w-5 h-5 mx-1"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M14.6 15.5l4.6-4.6c.4-.4.4-1 0-1.4l-4.6-4.6M9.4 15.5L4.8 10.9c-.4-.4-.4-1 0-1.4l4.6-4.6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg></span>按钮切换阀门状态</li>
                        <li>滤杯显示为底图，另一状态的阀门显示为参考</li>
                        <li>简单明了的形状更易于识别</li>
                        <li>完成后点击右上角保存</li>
                    </ul>
                </div>
        </>
    );

    // 渲染主要表单内容
    const renderFormContent = () => (
        <div className="space-y-4 pt-2">
            {/* 所有区域使用统一的卡片样式 */}
            <div className="space-y-4">
                {/* 基本信息区域 */}
                <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 overflow-hidden">
                    <div className="px-4 py-2.5 bg-neutral-50 dark:bg-neutral-800/50 border-b border-neutral-200 dark:border-neutral-700">
                        <h3 className="text-sm font-medium text-neutral-900 dark:text-neutral-100">基本信息</h3>
                    </div>
                    <div className="p-4 space-y-4">
                        {/* 器具名称 */}
                        <FormField label="器具名称" error={errors.name}>
                            <input
                                type="text"
                                value={equipment.name || ''}
                                onChange={(e) => handleChange('name', e.target.value)}
                                className="block w-full rounded-md border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-700 px-3 py-2 text-sm focus:border-blue-500 focus:ring-blue-500 dark:text-white transition-colors"
                                placeholder="例如：双层滤杯"
                            />
                        </FormField>

                        {/* 器具描述 */}
                        <FormField label="器具描述" error={errors.description}>
                            <textarea
                                value={equipment.description || ''}
                                onChange={(e) => handleChange('description', e.target.value)}
                                rows={3}
                                className="block w-full rounded-md border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-700 px-3 py-2 text-sm focus:border-blue-500 focus:ring-blue-500 dark:text-white transition-colors"
                                placeholder="描述器具的特点和用途"
                            />
                        </FormField>
                    </div>
                </div>

                {/* 器具类型和杯型设置 */}
                <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 overflow-hidden">
                    <div className="px-4 py-2.5 bg-neutral-50 dark:bg-neutral-800/50 border-b border-neutral-200 dark:border-neutral-700">
                        <h3 className="text-sm font-medium text-neutral-900 dark:text-neutral-100">器具设置</h3>
                    </div>
                    <div className="divide-y divide-neutral-200 dark:divide-neutral-700">
                        {/* 器具类型选择 */}
                        <div className="p-4">
                            <h4 className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-3">选择器具类型</h4>
                            <div className="grid grid-cols-2 gap-3">
                                {PRESET_OPTIONS.map(preset => (
                                    <label
                                        key={preset.value}
                                        className={`relative flex flex-col p-3 rounded-lg border ${
                                            selectedPreset === preset.value
                                                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                                                : 'border-neutral-200 dark:border-neutral-700 hover:border-blue-200 dark:hover:border-blue-800'
                                        } cursor-pointer transition-all`}
                                    >
                                        <div className="flex items-center mb-1.5">
                                            <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                                                {preset.label}
                                            </span>
                                            {selectedPreset === preset.value && (
                                                <div className="ml-2 w-3.5 h-3.5 text-blue-500">
                                                    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                        <path d="M5 13L9 17L19 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                                    </svg>
                                                </div>
                                            )}
                                        </div>
                                        <span className="text-xs text-neutral-500 dark:text-neutral-400 line-clamp-2">
                                            {preset.description}
                                        </span>
                                        <input
                                            type="radio"
                                            name="presetOption"
                                            value={preset.value}
                                            checked={selectedPreset === preset.value}
                                            onChange={() => setSelectedPreset(preset.value)}
                                            className="hidden"
                                        />
                                    </label>
                                ))}
                            </div>
                        </div>

                        {/* 杯型设置 */}
                        <div className="p-4">
                            <h4 className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-3">杯型设置</h4>
                            <div className="grid grid-cols-2 gap-3">
                                {/* 默认杯型选项 */}
                                {selectedPreset !== 'custom' && (
                                    <label
                                        className={`relative flex flex-col p-3 rounded-lg border ${
                                            cupShapeType === 'default'
                                                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                                                : 'border-neutral-200 dark:border-neutral-700 hover:border-blue-200 dark:hover:border-blue-800'
                                        } cursor-pointer transition-all`}
                                    >
                                        <div className="flex items-center mb-2">
                                            <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100">默认杯型</span>
                                            {cupShapeType === 'default' && (
                                                <div className="ml-2 w-3.5 h-3.5 text-blue-500">
                                                    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                        <path d="M5 13L9 17L19 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                                    </svg>
                                                </div>
                                            )}
                                        </div>
                                        <div className="w-full aspect-square flex items-center justify-center bg-neutral-50 dark:bg-neutral-900 rounded-md relative">
                                            <div className="absolute inset-0 flex items-center justify-center">
                                                <div className="w-3/4 h-3/4 relative">
                                                    <Image
                                                        src="/images/v60-base.svg"
                                                        alt={selectedPreset === 'v60' ? 'V60' : '聪明杯'}
                                                        fill
                                                        className="object-contain invert-0 dark:invert"
                                                        sizes="(max-width: 768px) 100vw, 300px"
                                                        quality={85}
                                                    />
                                                    {selectedPreset === 'clever' && (
                                                        <Image
                                                            src="/images/valve-closed.svg"
                                                            alt="阀门"
                                                            fill
                                                            className="object-contain invert-0 dark:invert"
                                                            sizes="(max-width: 768px) 100vw, 300px"
                                                            quality={85}
                                                        />
                                                    )}
                                                </div>
                                            </div>
                                            <input
                                                type="radio"
                                                name="cupShapeType"
                                                value="default"
                                                checked={cupShapeType === 'default'}
                                                onChange={() => setCupShapeType('default')}
                                                className="hidden"
                                            />
                                        </div>
                                    </label>
                                )}

                                {/* 自定义杯型选项/按钮 */}
                                <label
                                    className={`relative flex flex-col p-3 rounded-lg border ${
                                        cupShapeType === 'custom'
                                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                                            : 'border-neutral-200 dark:border-neutral-700 hover:border-blue-200 dark:hover:border-blue-800'
                                    } transition-all cursor-pointer`}
                                >
                                    <input
                                        type="radio"
                                        name="cupShapeType"
                                        value="custom"
                                        checked={cupShapeType === 'custom'}
                                        onChange={() => setCupShapeType('custom')}
                                        className="hidden"
                                    />
                                    <div className="flex items-center mb-2">
                                        <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                                            {equipment.customShapeSvg ? '自定义杯型' : '添加自定义杯型'}
                                        </span>
                                        {cupShapeType === 'custom' && (
                                            <div className="ml-2 w-3.5 h-3.5 text-blue-500">
                                                <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                    <path d="M5 13L9 17L19 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                                </svg>
                                            </div>
                                        )}
                                    </div>
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.preventDefault();
                                            handleShowDrawingCanvas();
                                        }}
                                        className="w-full aspect-square flex items-center justify-center bg-neutral-50 dark:bg-neutral-900 rounded-md overflow-hidden hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                                    >
                                        {equipment.customShapeSvg ? (
                                            <div 
                                                className="w-full h-full flex items-center justify-center"
                                                dangerouslySetInnerHTML={{
                                                    __html: equipment.customShapeSvg.replace(/<svg/, '<svg width="100%" height="100%"')
                                                }}
                                            />
                                        ) : (
                                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-neutral-400">
                                                <path d="M12 5V19M5 12H19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                            </svg>
                                        )}
                                    </button>
                                </label>
                            </div>

                            {/* 阀门控制选项 */}
                            {selectedPreset === 'custom' && (
                                <div className="mt-4 space-y-4">
                                    <div className="flex items-center">
                                        <label className="inline-flex items-center cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={equipment.hasValve || false}
                                                onChange={(e) => handleChange('hasValve', e.target.checked)}
                                                className="form-checkbox h-4 w-4 text-blue-500 border-neutral-300 dark:border-neutral-600 rounded transition-colors"
                                            />
                                            <span className="ml-2 text-sm text-neutral-700 dark:text-neutral-300">
                                                支持阀门控制（类似聪明杯）
                                            </span>
                                        </label>
                                    </div>
                                    
                                    {equipment.hasValve && (
                                        <div className="pl-6 border-l-2 border-neutral-200 dark:border-neutral-700">
                                            <h5 className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">阀门控制样式</h5>
                                            
                                            <div className="mb-3">
                                                {/* 阀门状态提示 - 改为自动切换 */}
                                                <div className="py-1.5 px-2 text-xs bg-neutral-100 dark:bg-neutral-900 rounded-md text-neutral-600 dark:text-neutral-400">
                                                    默认阀门样式会自动在开启和关闭状态之间切换
                                                </div>
                                            </div>
                                            
                                            <div className="grid grid-cols-2 gap-3">
                                                {/* 默认阀门样式 */}
                                                <label
                                                    className="relative flex flex-col p-3 rounded-lg border border-neutral-200 dark:border-neutral-700 hover:border-blue-200 dark:hover:border-blue-800 transition-all cursor-pointer"
                                                >
                                                    <div className="flex items-center mb-2">
                                                        <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100">默认阀门样式</span>
                                                    </div>
                                                    <div className="w-full aspect-square flex items-center justify-center bg-neutral-50 dark:bg-neutral-900 rounded-md relative">
                                                        {/* 滤杯底图层 */}
                                                        <div className="absolute inset-0 flex items-center justify-center">
                                                            <div className="w-3/4 h-3/4 relative">
                                                                <Image
                                                                    src="/images/v60-base.svg"
                                                                    alt="滤杯背景"
                                                                    fill
                                                                    className="object-contain invert-0 dark:invert opacity-60"
                                                                    sizes="(max-width: 768px) 100vw, 300px"
                                                                    quality={85}
                                                                />
                                                            </div>
                                                        </div>
                                                        {/* 阀门图层 */}
                                                        <div className="absolute inset-0 flex items-center justify-center">
                                                            <div className="w-3/4 h-3/4 relative">
                                                                <Image
                                                                    src={valvePreviewState === 'closed' ? "/images/valve-closed.svg" : "/images/valve-open.svg"}
                                                                    alt={valvePreviewState === 'closed' ? "默认阀门关闭状态" : "默认阀门开启状态"}
                                                                    fill
                                                                    className="object-contain invert-0 dark:invert"
                                                                    sizes="(max-width: 768px) 100vw, 300px"
                                                                    quality={85}
                                                                />
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <input
                                                        type="radio"
                                                        name="valveShapeType"
                                                        value="default"
                                                        checked={valveShapeType === 'default'}
                                                        onChange={() => setValveShapeType('default')}
                                                        className="hidden"
                                                    />
                                                </label>
                                                
                                                {/* 自定义阀门样式 */}
                                                <label
                                                    className={`relative flex flex-col p-3 rounded-lg border ${
                                                        valveShapeType === 'custom'
                                                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                                                            : 'border-neutral-200 dark:border-neutral-700 hover:border-blue-200 dark:hover:border-blue-800'
                                                    } transition-all cursor-pointer`}
                                                >
                                                    <input
                                                        type="radio"
                                                        name="valveShapeType"
                                                        value="custom"
                                                        checked={valveShapeType === 'custom'}
                                                        onChange={() => setValveShapeType('custom')}
                                                        className="hidden"
                                                    />
                                                    <div className="flex items-center mb-2">
                                                        <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                                                            {equipment.customValveSvg && equipment.customValveOpenSvg ? '自定义阀门' : '添加自定义阀门'}
                                                        </span>
                                                        {valveShapeType === 'custom' && (
                                                            <div className="ml-2 w-3.5 h-3.5 text-blue-500">
                                                                <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                                    <path d="M5 13L9 17L19 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                                                </svg>
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-2">
                                                        {/* 关闭状态 */}
                                                        <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.preventDefault();
                                                                handleShowValveDrawingCanvas('closed');
                                                            }}
                                                            className="w-full aspect-square flex items-center justify-center bg-neutral-50 dark:bg-neutral-900 rounded-md overflow-hidden hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                                                        >
                                                            <div className="w-full h-full relative">
                                                                {equipment.customValveSvg ? (
                                                                    <>
                                                                        <div className="absolute inset-0 flex items-center justify-center opacity-60">
                                                                            {equipment.customShapeSvg ? (
                                                                                <div 
                                                                                    className="w-full h-full flex items-center justify-center"
                                                                                    dangerouslySetInnerHTML={{
                                                                                        __html: equipment.customShapeSvg.replace(/<svg/, '<svg width="100%" height="100%" class="invert-0 dark:invert opacity-60"')
                                                                                    }}
                                                                                />
                                                                            ) : (
                                                                                <Image
                                                                                    src="/images/v60-base.svg"
                                                                                    alt="滤杯背景"
                                                                                    fill
                                                                                    className="object-contain invert-0 dark:invert opacity-60"
                                                                                    sizes="(max-width: 768px) 100vw, 300px"
                                                                                    quality={85}
                                                                                />
                                                                            )}
                                                                        </div>
                                                                        <div 
                                                                            className="w-full h-full flex items-center justify-center"
                                                                            dangerouslySetInnerHTML={{
                                                                                __html: equipment.customValveSvg?.replace(/<svg/, '<svg width="100%" height="100%"') || ''
                                                                            }}
                                                                        />
                                                                    </>
                                                                ) : (
                                                                    <>
                                                                        <div className="absolute inset-0 flex items-center justify-center opacity-60">
                                                                            {equipment.customShapeSvg ? (
                                                                                <div 
                                                                                    className="w-full h-full flex items-center justify-center"
                                                                                    dangerouslySetInnerHTML={{
                                                                                        __html: equipment.customShapeSvg.replace(/<svg/, '<svg width="100%" height="100%" class="invert-0 dark:invert opacity-60"')
                                                                                    }}
                                                                                />
                                                                            ) : (
                                                                                <Image
                                                                                    src="/images/v60-base.svg"
                                                                                    alt="滤杯背景"
                                                                                    fill
                                                                                    className="object-contain invert-0 dark:invert opacity-60"
                                                                                    sizes="(max-width: 768px) 100vw, 300px"
                                                                                    quality={85}
                                                                                />
                                                                            )}
                                                                        </div>
                                                                        <div 
                                                                            className="w-full h-full flex items-center justify-center"
                                                                            dangerouslySetInnerHTML={{
                                                                                __html: equipment.customValveSvg?.replace(/<svg/, '<svg width="100%" height="100%"') || ''
                                                                            }}
                                                                        />
                                                                    </>
                                                                )}
                                                                <div className="absolute left-0 bottom-0 bg-black/60 text-white text-xs p-1 rounded-tr">关闭</div>
                                                            </div>
                                                        </button>
                                                        
                                                        {/* 开启状态 */}
                                                        <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.preventDefault();
                                                                handleShowValveDrawingCanvas('open');
                                                            }}
                                                            className="w-full aspect-square flex items-center justify-center bg-neutral-50 dark:bg-neutral-900 rounded-md overflow-hidden hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                                                        >
                                                            <div className="w-full h-full relative">
                                                                {equipment.customValveOpenSvg ? (
                                                                    <>
                                                                        <div className="absolute inset-0 flex items-center justify-center opacity-60">
                                                                            {equipment.customShapeSvg ? (
                                                                                <div 
                                                                                    className="w-full h-full flex items-center justify-center"
                                                                                    dangerouslySetInnerHTML={{
                                                                                        __html: equipment.customShapeSvg.replace(/<svg/, '<svg width="100%" height="100%" class="invert-0 dark:invert opacity-60"')
                                                                                    }}
                                                                                />
                                                                            ) : (
                                                                                <Image
                                                                                    src="/images/v60-base.svg"
                                                                                    alt="滤杯背景"
                                                                                    fill
                                                                                    className="object-contain invert-0 dark:invert opacity-60"
                                                                                    sizes="(max-width: 768px) 100vw, 300px"
                                                                                    quality={85}
                                                                                />
                                                                            )}
                                                                        </div>
                                                                        <div 
                                                                            className="w-full h-full flex items-center justify-center"
                                                                            dangerouslySetInnerHTML={{
                                                                                __html: equipment.customValveOpenSvg?.replace(/<svg/, '<svg width="100%" height="100%"') || ''
                                                                            }}
                                                                        />
                                                                    </>
                                                                ) : (
                                                                    <>
                                                                        <div className="absolute inset-0 flex items-center justify-center opacity-60">
                                                                            {equipment.customShapeSvg ? (
                                                                                <div 
                                                                                    className="w-full h-full flex items-center justify-center"
                                                                                    dangerouslySetInnerHTML={{
                                                                                        __html: equipment.customShapeSvg.replace(/<svg/, '<svg width="100%" height="100%" class="invert-0 dark:invert opacity-60"')
                                                                                    }}
                                                                                />
                                                                            ) : (
                                                                                <Image
                                                                                    src="/images/v60-base.svg"
                                                                                    alt="滤杯背景"
                                                                                    fill
                                                                                    className="object-contain invert-0 dark:invert opacity-60"
                                                                                    sizes="(max-width: 768px) 100vw, 300px"
                                                                                    quality={85}
                                                                                />
                                                                            )}
                                                                        </div>
                                                                        <div 
                                                                            className="w-full h-full flex items-center justify-center"
                                                                            dangerouslySetInnerHTML={{
                                                                                __html: equipment.customValveOpenSvg?.replace(/<svg/, '<svg width="100%" height="100%"') || ''
                                                                            }}
                                                                        />
                                                                    </>
                                                                )}
                                                                <div className="absolute left-0 bottom-0 bg-blue-600/70 text-white text-xs p-1 rounded-tr">开启</div>
                                                            </div>
                                                        </button>
                                                    </div>
                                                </label>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* 注水方式管理 */}
                {selectedPreset === 'custom' && (
                    <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 overflow-hidden">
                        <div className="px-4 py-2.5 bg-neutral-50 dark:bg-neutral-800/50 border-b border-neutral-200 dark:border-neutral-700 flex justify-between items-center">
                            <h3 className="text-sm font-medium text-neutral-900 dark:text-neutral-100">注水方式</h3>
                        </div>
                        <div className="p-4">
                            <div className="grid grid-cols-2 gap-3">
                                {customPourAnimations.map(animation => (
                                    <div 
                                        key={animation.id}
                                        className="relative flex flex-col p-3 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 hover:border-blue-200 dark:hover:border-blue-800 transition-colors"
                                    >
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center space-x-2">
                                                <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                                                    {animation.name}
                                                </span>
                                                {animation.isSystemDefault && (
                                                    <span className="px-1.5 py-0.5 text-xs bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full">
                                                        系统
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex items-center space-x-1">
                                                {!animation.isSystemDefault && (
                                                    <button
                                                        type="button"
                                                        onClick={() => handleEditPourAnimation(animation)}
                                                        className="p-1.5 text-neutral-400 hover:text-blue-500 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
                                                    >
                                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                            <path d="M11 4H4C3.44772 4 3 4.44772 3 5V19C3 19.5523 3.44772 20 4 20H18C18.5523 20 19 19.5523 19 19V12M17.5858 3.58579C18.3668 2.80474 19.6332 2.80474 20.4142 3.58579C21.1953 4.36683 21.1953 5.63316 20.4142 6.41421L11.8284 15H9L9 12.1716L17.5858 3.58579Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                                        </svg>
                                                    </button>
                                                )}
                                                <button
                                                    type="button"
                                                    onClick={() => handleDeletePourAnimation(animation.id)}
                                                    className="p-1.5 text-neutral-400 hover:text-red-500 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
                                                >
                                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                        <path d="M19 7L18.1327 19.1425C18.0579 20.1891 17.187 21 16.1378 21H7.86224C6.81296 21 5.94208 20.1891 5.86732 19.1425L5 7M10 11V17M14 11V17M15 7V4C15 3.44772 14.5523 3 14 3H10C9.44772 3 9 3.44772 9 4V7M4 7H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                                    </svg>
                                                </button>
                                            </div>
                                        </div>
                                        <div className="w-full aspect-square bg-neutral-50 dark:bg-neutral-900 rounded-md overflow-hidden relative">
                                            {/* 底部显示杯型 */}
                                            <div className="absolute inset-0 flex items-center justify-center opacity-60">
                                                {equipment.customShapeSvg ? (
                                                    <div 
                                                        className="w-full h-full flex items-center justify-center"
                                                        dangerouslySetInnerHTML={{
                                                            __html: equipment.customShapeSvg.replace(/<svg/, '<svg width="100%" height="100%" class="invert-0 dark:invert"')
                                                        }}
                                                    />
                                                ) : (
                                                    <>
                                                        <div className="w-full h-full flex items-center justify-center">
                                                            <div className="w-full h-full relative">
                                                                <Image
                                                                    src="/images/v60-base.svg"
                                                                    alt="杯型背景"
                                                                    fill
                                                                    className="object-contain invert-0 dark:invert"
                                                                    sizes="(max-width: 768px) 100vw, 300px"
                                                                    quality={85}
                                                                />
                                                                {equipment.hasValve && (
                                                                    <Image
                                                                        src="/images/valve-closed.svg"
                                                                        alt="阀门背景"
                                                                        fill
                                                                        className="object-contain invert-0 dark:invert"
                                                                        sizes="(max-width: 768px) 100vw, 300px"
                                                                        quality={85}
                                                                    />
                                                                )}
                                                            </div>
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                            
                                            {/* 注水动画 */}
                                            {animation.isSystemDefault ? (
                                                <div className="absolute inset-0 flex items-center justify-center">
                                                    <div className="w-full h-full flex items-center justify-center">
                                                        {animation.pourType && (
                                                            <Image
                                                                src={`/images/pour-${animation.pourType}-motion-${previewFrameIndexes[animation.id] || 1}.svg`}
                                                                alt={animation.name}
                                                                fill
                                                                className="object-contain invert-0 dark:invert"
                                                                sizes="(max-width: 768px) 100vw, 300px"
                                                                quality={85}
                                                            />
                                                        )}
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="absolute inset-0 flex items-center justify-center">
                                                    {(() => {
                                                        const hasFrames = animation.frames && Array.isArray(animation.frames) && animation.frames.length > 0;
                                                        const frameIndex = (previewFrameIndexes[animation.id] || 1) - 1;
                                                        
                                                        if (hasFrames && frameIndex >= 0 && frameIndex < animation.frames!.length) {
                                                            const svgData = animation.frames![frameIndex].svgData;
                                                            if (svgData && svgData.trim() !== '') {
                                                                return (
                                                                    <div className="w-full h-full flex items-center justify-center">
                                                                        <div
                                                                            className="w-full h-full flex items-center justify-center"
                                                                            dangerouslySetInnerHTML={{
                                                                                __html: svgData.replace(/<svg/, '<svg width="100%" height="100%" class="invert-0 dark:invert"')
                                                                            }}
                                                                        />
                                                                    </div>
                                                                );
                                                            }
                                                        }
                                                        
                                                        if (animation.customAnimationSvg && animation.customAnimationSvg.trim() !== '') {
                                                            return (
                                                                <div className="w-full h-full flex items-center justify-center">
                                                                    <div
                                                                        className="w-full h-full flex items-center justify-center"
                                                                        dangerouslySetInnerHTML={{
                                                                            __html: animation.customAnimationSvg.replace(/<svg/, '<svg width="100%" height="100%" class="invert-0 dark:invert"')
                                                                        }}
                                                                    />
                                                                </div>
                                                            );
                                                        }
                                                        
                                                        return (
                                                            <div className="text-xs text-neutral-400 dark:text-neutral-500 text-center p-4">
                                                                预览注水动画
                                                            </div>
                                                        );
                                                    })()}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                                
                                {/* 添加按钮 */}
                                <button
                                    onClick={handleAddPourAnimation}
                                    className="relative flex flex-col p-3 rounded-lg border border-dashed border-neutral-300 dark:border-neutral-600 hover:border-blue-500 dark:hover:border-blue-400 bg-white dark:bg-neutral-800 transition-colors"
                                >
                                    <div className="flex items-center mb-2">
                                        <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                                            添加注水方式
                                        </span>
                                    </div>
                                    <div className="w-full aspect-square bg-neutral-50 dark:bg-neutral-900 rounded-md overflow-hidden relative">
                                        {/* 底部显示杯型 */}
                                        <div className="absolute inset-0 flex items-center justify-center">
                                            <div className="w-full h-full relative opacity-60">
                                                {equipment.customShapeSvg ? (
                                                    <div 
                                                        className="w-full h-full flex items-center justify-center"
                                                        dangerouslySetInnerHTML={{
                                                            __html: equipment.customShapeSvg.replace(/<svg/, '<svg width="100%" height="100%" class="invert-0 dark:invert"')
                                                        }}
                                                    />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center">
                                                        <div className="w-3/4 h-3/4 relative">
                                                            <Image
                                                                src="/images/v60-base.svg"
                                                                alt="杯型背景"
                                                                fill
                                                                className="object-contain invert-0 dark:invert"
                                                                sizes="(max-width: 768px) 100vw, 300px"
                                                                quality={85}
                                                            />
                                                            {equipment.hasValve && (
                                                                <Image
                                                                    src="/images/valve-closed.svg"
                                                                    alt="阀门背景"
                                                                    fill
                                                                    className="object-contain invert-0 dark:invert"
                                                                    sizes="(max-width: 768px) 100vw, 300px"
                                                                    quality={85}
                                                                />
                                                            )}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        {/* 添加图标 */}
                                        <div className="absolute inset-0 flex items-center justify-center">
                                            <div className="text-neutral-400 dark:text-neutral-500">
                                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                    <path d="M12 5V19M5 12H19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                                </svg>
                                            </div>
                                        </div>
                                    </div>
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* 底部按钮组 */}
            <div className="flex justify-end space-x-3 pt-4">
                <button
                    type="button"
                    onClick={onCancel}
                    className="px-4 py-2 text-sm font-medium text-neutral-700 dark:text-neutral-300 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-600 hover:bg-neutral-50 dark:hover:bg-neutral-700 rounded-md transition-colors"
                >
                    取消
                </button>
                <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:hover:bg-blue-600 rounded-md transition-colors"
                >
                    {isSubmitting ? '保存中...' : '保存'}
                </button>
            </div>
        </div>
    );

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            <AnimatePresence mode="wait">
                {showPourAnimationCanvas ? renderPourAnimationCanvas() :
                 showDrawingCanvas ? renderDrawingCanvas() : 
                 showValveDrawingCanvas ? renderValveDrawingCanvas() : 
                 renderFormContent()}
            </AnimatePresence>
        </form>
    );
};

export default CustomEquipmentForm;