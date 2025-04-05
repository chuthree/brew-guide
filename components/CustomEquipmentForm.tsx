import React, { useState, useRef, useEffect } from 'react';
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
    <div>
        <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">
            {label}
        </label>
        {children}
        {hint && (
            <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                {hint}
            </p>
        )}
        {error && (
            <p className="mt-1 text-sm text-red-600">{error}</p>
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

    // 预设方案状态 - 根据初始值设置，如果是聪明杯则设置为clever
    const [selectedPreset, setSelectedPreset] = useState<(typeof PRESET_OPTIONS)[number]['value']>(
        initialEquipment?.hasValve ? 'clever' :
        initialEquipment?.animationType === 'custom' ? 'custom' : 'v60'
    );
    
    // 添加杯型选择状态（默认/自定义）
    const [cupShapeType, setCupShapeType] = useState<'default' | 'custom'>(
        initialEquipment?.customShapeSvg ? 'custom' : 'default'
    );
    
    const [equipment, setEquipment] = useState<Partial<CustomEquipment>>({
        name: '',
        description: '',
        animationType: 'v60',
        hasValve: false,
        customShapeSvg: '',
        ...initialEquipment,
    });

    const [errors, setErrors] = useState<Record<string, string>>({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showDrawingCanvas, setShowDrawingCanvas] = useState(false);
    const [_hasDrawn, setHasDrawn] = useState(!!equipment.customShapeSvg);
    
    // 添加当前预览帧状态
    const [previewFrameIndexes, setPreviewFrameIndexes] = useState<Record<string, number>>({});
    
    // 初始化注水方式，合并系统默认和用户自定义
    const [customPourAnimations, setCustomPourAnimations] = useState<CustomPourAnimation[]>(() => {
        // 先获取默认的注水方式
        const defaults: CustomPourAnimation[] = DEFAULT_POUR_TYPES.map(type => ({
            id: type.id,
            name: type.name,
            customAnimationSvg: '',
            isSystemDefault: true,
            pourType: type.pourType,
            previewFrames: type.previewFrames
        }));
        
        // 如果有用户自定义的注水动画，添加到列表中
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
        DEFAULT_POUR_TYPES.forEach(type => {
            initialPreviewFrames[type.id] = 1; // 初始显示第一帧
        });
        
        // 为初始的自定义动画设置预览帧
        customPourAnimations.filter(anim => !anim.isSystemDefault).forEach(anim => {
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
            // 自定义预设不自动设置阀门，保持当前值
        }
    }, [selectedPreset]);

    // 监听杯型选择变化
    useEffect(() => {
        if (cupShapeType === 'default') {
            // 如果选择默认杯型，清除自定义SVG
            handleChange('customShapeSvg', '');
            setHasDrawn(false);
        }
    }, [cupShapeType]);

    // 计算画布尺寸
    useEffect(() => {
        if (showDrawingCanvas && canvasContainerRef.current && windowSize.width > 0) {
            // 获取容器宽度，不再减去padding
            const containerWidth = canvasContainerRef.current.clientWidth;
            setCanvasSize(containerWidth);
        }
    }, [showDrawingCanvas, windowSize.width]);

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
                const processedAnimations = customPourAnimations.map(animation => {
                    if (animation.frames && animation.frames.length > 1) {
                        console.log(`[提交] 注水动画 ${animation.id} (${animation.name}): ${animation.frames.length} 帧, previewFrames: ${animation.previewFrames || 0}`);
                    }
                    return animation;
                });
                
                const equipmentToSave = {
                    ...equipment as CustomEquipment,
                    isCustom: true as const,
                    customPourAnimations: selectedPreset === 'custom' 
                        ? processedAnimations.filter(anim => !anim.isSystemDefault || anim.customAnimationSvg)
                        : undefined,
                };
                
                // 检查杯型SVG数据是否存在
                if (equipmentToSave.customShapeSvg) {
                    console.log('保存设备时包含自定义杯型SVG，长度:', 
                        equipmentToSave.customShapeSvg.length);
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
            setEquipment(prev => ({
                ...prev,
                customShapeSvg: svg
            }));
            setHasDrawn(true);
            console.log('已保存自定义杯型SVG到设备数据中');
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

    // 返回表单界面
    const handleBackToForm = () => {
        setShowDrawingCanvas(false);
    };

    // 切换到绘图界面
    const handleShowDrawingCanvas = () => {
        hapticsUtils.light();
        setShowDrawingCanvas(true);
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

    const _handleEditPourAnimation = (animation: CustomPourAnimation) => {
        setCurrentEditingAnimation({...animation});
        setShowPourAnimationCanvas(true);
    };

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
            setCurrentEditingAnimation({
                ...currentEditingAnimation,
                name: e.target.value
            });
        }
    };

    // 渲染注水动画编辑画布
    const renderPourAnimationCanvas = () => {
        if (!currentEditingAnimation) return null;
        
        // 获取参考图像，格式为{ url: string; label: string }[]
        const referenceImageUrls = getPourAnimationReferenceImages(currentEditingAnimation);
        
        // 将现有SVG转换为动画帧
        let initialFrames: AnimationFrame[] = [];
        if (currentEditingAnimation.frames && currentEditingAnimation.frames.length > 0) {
            initialFrames = currentEditingAnimation.frames;
            console.log(`[编辑动画] 使用已有的${initialFrames.length}帧数据`);
        } else if (currentEditingAnimation.customAnimationSvg) {
            initialFrames = _svgToAnimationFrames(currentEditingAnimation.customAnimationSvg);
            console.log(`[编辑动画] 从SVG创建新帧，SVG长度: ${currentEditingAnimation.customAnimationSvg.length}`);
        } else {
            initialFrames = [{ id: 'frame-1', svgData: '' }];
            console.log(`[编辑动画] 创建空帧`);
        }
        
        return (
            <>
                <TopNav 
                    title={`编辑${currentEditingAnimation.name}`}
                    onBack={() => setShowPourAnimationCanvas(false)}
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
                        请在画布上绘制咖啡滴落的动画效果，创建多个帧以实现动态效果。
                    </p>
                </div>
                
                <div 
                    ref={canvasContainerRef}
                    className="w-full rounded-xl mx-auto overflow-hidden"
                >
                    {canvasSize > 0 && (
                        <AnimationEditor
                            ref={animationEditorRef}
                            width={canvasSize}
                            height={canvasSize}
                            initialFrames={initialFrames}
                            referenceImages={referenceImageUrls}
                            strokeColor="white"
                            maxFrames={currentEditingAnimation.previewFrames || 4}
                        />
                    )}
                </div>
                
                {/* 绘图提示 */}
                <div className="mt-4 text-xs text-neutral-500 dark:text-neutral-400 bg-neutral-100 dark:bg-neutral-900 p-3 rounded-lg">
                    <h4 className="font-medium mb-1">动画绘制提示</h4>
                    <ul className="list-disc pl-4 space-y-1">
                        <li>创建多个帧来实现流畅的动画效果</li>
                        <li>使用参考图像作为绘制指南</li>
                        <li>使用播放按钮预览动画效果</li>
                        <li>左右箭头键可以快速切换帧</li>
                        <li>可以复制现有帧作为起点</li>
                        <li>绘制完成后点击右上角保存按钮</li>
                    </ul>
                </div>
            </>
        );
    };

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
                        />
                    )}
                </div>
                
                <div className="flex justify-between mt-6 "> {/* 调整间距和边距 */}
                    {/* 左侧：画笔大小控制 */}
                    <div className="flex items-center space-x-3 bg-white dark:bg-neutral-800 p-2 rounded-full shadow-sm border border-neutral-200 dark:border-neutral-700">
                        <button
                            type="button"
                            onClick={() => handleStrokeWidthChange(strokeWidth - 1)}
                            className="w-8 h-8 rounded-full bg-neutral-100 dark:bg-neutral-700 flex items-center justify-center"
                            aria-label="减小线条粗细"
                        >
                            <span className="text-lg font-medium">−</span>
                        </button>
                        
                        <div className="flex items-center justify-center h-9 w-9">
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
                            className="w-8 h-8 rounded-full bg-neutral-100 dark:bg-neutral-700 flex items-center justify-center"
                            aria-label="增加线条粗细"
                        >
                            <span className="text-lg font-medium">+</span>
                        </button>
                    </div>
                    
                    {/* 右侧：撤销和清除 */}
                    <div className="flex items-center space-x-3">
                        <button
                            type="button"
                            onClick={() => canvasRef.current?.undo()}
                            className="w-10 h-10 rounded-full bg-white dark:bg-neutral-800 flex items-center justify-center shadow-sm border border-neutral-200 dark:border-neutral-700 active:bg-neutral-100 dark:active:bg-neutral-700"
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
                            className="w-10 h-10 rounded-full bg-white dark:bg-neutral-800 flex items-center justify-center shadow-sm border border-neutral-200 dark:border-neutral-700 active:bg-neutral-100 dark:active:bg-neutral-700"
                            aria-label="清除"
                        >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M4 7H20M10 11V17M14 11V17M5 7L6 19C6 20.1 6.9 21 8 21H16C17.1 21 18 20.1 18 19L19 7M9 7V4C9 3.45 9.45 3 10 3H14C14.55 3 15 3.45 15 4V7" 
                                    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                        </button>
                    </div>
                </div>
        </>
    );

    // 添加恢复系统默认注水方式的函数
    const handleAddDefaultPourAnimation = () => {
        hapticsUtils.light();
        
        // 显示系统默认注水方式选择菜单
        // 获取当前已存在的系统默认动画类型
        const existingDefaultTypes = customPourAnimations
            .filter(anim => anim.isSystemDefault)
            .map(anim => anim.pourType);
        
        // 获取缺失的系统默认类型
        const missingDefaultTypes = DEFAULT_POUR_TYPES.filter(
            type => !existingDefaultTypes.includes(type.pourType)
        );
        
        // 如果所有默认类型都已存在，则不做任何操作
        if (missingDefaultTypes.length === 0) {
            return;
        }
        
        // 添加缺失的默认注水方式
        missingDefaultTypes.forEach(type => {
            const newDefaultAnimation: CustomPourAnimation = {
                id: type.id,
                name: type.name,
                customAnimationSvg: '',
                isSystemDefault: true,
                pourType: type.pourType,
                previewFrames: type.previewFrames
            };
            
            setCustomPourAnimations(prev => [...prev, newDefaultAnimation]);
        });
    };

    // 渲染主要表单内容
    const renderFormContent = () => (
        <div className="space-y-6 pt-2">
            {/* 基本信息区域 */}
            <div className="pb-2">
                <h3 className="text-sm font-medium text-neutral-600 dark:text-neutral-400 pb-2">基本信息</h3>
                <div className="bg-neutral-50 dark:bg-neutral-800/50 rounded-lg p-4 space-y-5">
                    {/* 器具名称 */}
                    <FormField label="器具名称" error={errors.name}>
                        <input
                            type="text"
                            value={equipment.name || ''}
                            onChange={(e) => handleChange('name', e.target.value)}
                            className="mt-1 block w-full rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-3 py-2 text-sm focus:border-blue-500 focus:ring-blue-500 dark:text-white"
                            placeholder="例如：双层滤杯"
                        />
                    </FormField>

                    {/* 器具描述 */}
                    <FormField label="器具描述" error={errors.description}>
                        <textarea
                            value={equipment.description || ''}
                            onChange={(e) => handleChange('description', e.target.value)}
                            rows={3}
                            className="mt-1 block w-full rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-3 py-2 text-sm focus:border-blue-500 focus:ring-blue-500 dark:text-white"
                            placeholder="描述器具的特点和用途"
                        />
                    </FormField>
                </div>
            </div>

            {/* 器具类型选择 - 简化为单选按钮组 */}
            <div className="pb-2">
                <h3 className="text-sm font-medium text-neutral-600 dark:text-neutral-400 pb-2">选择器具类型</h3>
                <div className="bg-neutral-50 dark:bg-neutral-800/50 rounded-lg p-4">
                    <div className="space-y-3">
                        {PRESET_OPTIONS.map(preset => (
                            <label
                                key={preset.value}
                                className={`flex items-center p-2 rounded-md transition-colors ${
                                    selectedPreset === preset.value
                                        ? 'bg-neutral-100/60 dark:bg-neutral-800/30'
                                        : ''
                                }`}
                            >
                                <input
                                    type="radio"
                                    name="presetOption"
                                    value={preset.value}
                                    checked={selectedPreset === preset.value}
                                    onChange={() => setSelectedPreset(preset.value)}
                                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-neutral-300 dark:border-neutral-700"
                                />
                                <div className="flex items-center ml-3">
                                    <div>
                                        <h4 className="text-sm font-medium text-neutral-800 dark:text-white">{preset.label}</h4>
                                        <p className="text-xs text-neutral-500 dark:text-neutral-400">
                                            {preset.description}
                                        </p>
                                    </div>
                                </div>
                            </label>
                        ))}
                    </div>
                </div>
            </div>

            {/* 自定义杯型 - 添加默认和自定义选项 */}
            <div className="pb-2">
                <h3 className="text-sm font-medium text-neutral-600 dark:text-neutral-400 pb-2">杯型设置</h3>
                <div className="bg-neutral-50 dark:bg-neutral-800/50 rounded-lg p-4">
                    {/* 仅在非自定义预设时显示杯型选择 */}
                    {selectedPreset !== 'custom' && (
                        <div className="space-y-3 mb-4">
                            <label className="flex items-center p-2 rounded-md transition-colors">
                                <input
                                    type="radio"
                                    name="cupShapeType"
                                    value="default"
                                    checked={cupShapeType === 'default'}
                                    onChange={() => setCupShapeType('default')}
                                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-neutral-300 dark:border-neutral-700"
                                />
                                <div className="ml-3">
                                    <h4 className="text-sm font-medium text-neutral-800 dark:text-white">默认杯型</h4>
                                    <p className="text-xs text-neutral-500 dark:text-neutral-400">
                                        使用系统默认的杯型图案
                                    </p>
                                </div>
                            </label>
                            
                            <label className="flex items-center p-2 rounded-md transition-colors">
                                <input
                                    type="radio"
                                    name="cupShapeType"
                                    value="custom"
                                    checked={cupShapeType === 'custom'}
                                    onChange={() => setCupShapeType('custom')}
                                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-neutral-300 dark:border-neutral-700"
                                />
                                <div className="ml-3">
                                    <h4 className="text-sm font-medium text-neutral-800 dark:text-white">自定义杯型</h4>
                                    <p className="text-xs text-neutral-500 dark:text-neutral-400">
                                        绘制您的自定义杯型，将在冲煮过程中显示
                                    </p>
                                </div>
                            </label>
                        </div>
                    )}
                    
                    {/* 当选择自定义杯型或使用自定义预设时显示绘制按钮 */}
                    {(cupShapeType === 'custom' || selectedPreset === 'custom') && (
                        <div className={selectedPreset !== 'custom' ? "mt-4" : ""}>
                            <div className="flex items-center space-x-2">
                                <button
                                    type="button"
                                    onClick={handleShowDrawingCanvas}
                                    className="inline-flex items-center px-3 py-2 border border-neutral-300 dark:border-neutral-700 shadow-sm text-sm leading-4 font-medium rounded-md text-neutral-700 dark:text-neutral-200 bg-white dark:bg-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                                >
                                    <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                        <path d="M4 20H8L18.5 9.5C19.0304 8.96956 19.3284 8.2582 19.3284 7.5142C19.3284 6.7702 19.0304 6.05884 18.5 5.52839C17.9696 4.99794 17.2582 4.7 16.5142 4.7C15.7702 4.7 15.0588 4.99794 14.5284 5.52839L4 16V20Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                    </svg>
                                    {equipment.customShapeSvg ? '修改自定义杯型' : '绘制自定义杯型'}
                                </button>
                                {equipment.customShapeSvg && (
                                    <div className="text-sm text-green-600 dark:text-green-400 flex items-center">
                                        <svg className="mr-1 h-4 w-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                            <path d="M5 13L9 17L19 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                        </svg>
                                        已保存自定义杯型
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* 阀门控制选项 - 仅在自定义预设或需要手动设置时显示 */}
                    {selectedPreset === 'custom' && (
                        <div className="flex items-center mt-4">
                            <input
                                type="checkbox"
                                id="hasValve"
                                checked={equipment.hasValve || false}
                                onChange={(e) => handleChange('hasValve', e.target.checked)}
                                className="h-4 w-4 rounded border-neutral-300 text-blue-600 focus:ring-blue-500"
                            />
                            <label
                                htmlFor="hasValve"
                                className="ml-2 block text-sm text-neutral-700 dark:text-neutral-300"
                            >
                                支持阀门控制（类似聪明杯）
                            </label>
                        </div>
                    )}
                </div>
            </div>

            {/* 注水方式管理 - 仅在自定义预设时显示 */}
            {selectedPreset === 'custom' && (
                <div className="pb-2">
                    <h3 className="text-sm font-medium text-neutral-600 dark:text-neutral-400 pb-2">注水方式</h3>
                    <div className="bg-neutral-50 dark:bg-neutral-800/50 rounded-lg p-4">
                        <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-4">
                            管理各种注水方式，点击项目进行编辑或添加新的注水动画。
                        </p>
                        
                        {/* 注水方式网格 */}
                        <div className="grid grid-cols-2 gap-3 mb-4">
                            {customPourAnimations.map(animation => (
                                <div 
                                    key={animation.id}
                                    className="rounded-lg overflow-hidden border border-neutral-300 dark:border-neutral-700"
                                    style={{ aspectRatio: '1/1' }}
                                >
                                    <div className="flex justify-between items-center p-2 bg-white dark:bg-neutral-800">
                                        <span className="text-sm font-medium text-neutral-800 dark:text-white flex items-center">
                                            {animation.name}
                                            {animation.isSystemDefault && (
                                                <span className="ml-1 px-1.5 py-0.5 text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-sm">
                                                    系统
                                                </span>
                                            )}
                                        </span>
                                        <div className="flex space-x-1">
                                            <button
                                                type="button"
                                                onClick={() => handleDeletePourAnimation(animation.id)}
                                                className="p-1.5 text-neutral-600 dark:text-neutral-400 hover:text-red-600 dark:hover:text-red-400 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-700"
                                            >
                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                    <path d="M19 7L18.1327 19.1425C18.0579 20.1891 17.187 21 16.1378 21H7.86224C6.81296 21 5.94208 20.1891 5.86732 19.1425L5 7M10 11V17M14 11V17M15 7V4C15 3.44772 14.5523 3 14 3H10C9.44772 3 9 3.44772 9 4V7M4 7H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                                </svg>
                                            </button>
                                        </div>
                                    </div>
                                    <div 
                                        className="w-full h-0 pb-[100%] bg-neutral-700 dark:bg-neutral-600 relative flex items-center justify-center cursor-default overflow-hidden"
                                    >
                                        {animation.isSystemDefault ? (
                                            // 系统默认类型，显示其动画序列
                                            <div className="absolute inset-0 flex items-center justify-center">
                                                {animation.pourType && (
                                                    <Image
                                                        src={`/images/pour-${animation.pourType}-motion-${previewFrameIndexes[animation.id] || 1}.svg`}
                                                        alt={animation.name}
                                                        fill
                                                        className="object-contain invert"
                                                    />
                                                )}
                                            </div>
                                        ) : (
                                            // 自定义类型（有无SVG数据都使用这个分支）
                                            <div className="absolute inset-0 flex items-center justify-center">
                                                {(() => {
                                                    // 检查是否有多帧动画
                                                    const hasFrames = animation.frames && Array.isArray(animation.frames) && animation.frames.length > 0;
                                                    const frameIndex = (previewFrameIndexes[animation.id] || 1) - 1;
                                                    
                                                    if (hasFrames && frameIndex >= 0 && frameIndex < animation.frames!.length) {
                                                        // 使用frames中的指定帧
                                                        const svgData = animation.frames![frameIndex].svgData;
                                                        console.log(`[渲染] 动画ID=${animation.id}, 名称=${animation.name}, 帧索引=${frameIndex}, 帧总数=${animation.frames!.length}, SVG长度=${svgData?.length || 0}`);
                                                        
                                                        if (svgData && svgData.trim() !== '') {
                                                            return (
                                                                <div
                                                                    className="w-full h-full"
                                                                    dangerouslySetInnerHTML={{
                                                                        __html: svgData.replace(/<svg/, '<svg width="100%" height="100%"')
                                                                    }}
                                                                />
                                                            );
                                                        }
                                                    }
                                                    
                                                    // 回退到单帧SVG或显示提示
                                                    if (animation.customAnimationSvg && animation.customAnimationSvg.trim() !== '') {
                                                        console.log(`[渲染] 动画ID=${animation.id}, 使用单帧SVG, 长度=${animation.customAnimationSvg.length}`);
                                                        
                                                        return (
                                                            <div
                                                                className="w-full h-full"
                                                                dangerouslySetInnerHTML={{
                                                                    __html: animation.customAnimationSvg.replace(/<svg/, '<svg width="100%" height="100%"')
                                                                }}
                                                            />
                                                        );
                                                    } else {
                                                        return (
                                                            <div className="text-xs text-white opacity-50 text-center p-4">
                                                                预览注水动画
                                                            </div>
                                                        );
                                                    }
                                                })()}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                            
                            {/* 添加新注水方式按钮 */}
                            <div 
                                className="rounded-lg border border-dashed border-neutral-300 dark:border-neutral-700 w-full h-0 pb-[100%] relative flex flex-col items-center justify-center cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                                onClick={handleAddPourAnimation}
                            >
                                <div className="absolute inset-0 flex flex-col items-center justify-center">
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="mb-2 text-neutral-500">
                                        <path d="M12 5V19M5 12H19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                    </svg>
                                    <span className="text-sm text-neutral-500 dark:text-neutral-400">添加注水方式</span>
                                </div>
                            </div>
                            
                            {/* 恢复系统默认注水方式按钮 */}
                            <div 
                                className="rounded-lg border border-dashed border-neutral-300 dark:border-neutral-700 w-full h-0 pb-[100%] relative flex flex-col items-center justify-center cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                                onClick={handleAddDefaultPourAnimation}
                            >
                                <div className="absolute inset-0 flex flex-col items-center justify-center">
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="mb-2 text-neutral-500">
                                        <path d="M4 4V9H4.58152M19.9381 11C19.446 7.05369 16.0796 4 12 4C8.64262 4 5.76829 6.06817 4.58152 9M4.58152 9H9M20 20V15H19.4185M19.4185 15C18.2317 17.9318 15.3574 20 12 20C7.92038 20 4.55399 16.9463 4.06189 13M19.4185 15H15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                    </svg>
                                    <span className="text-sm text-neutral-500 dark:text-neutral-400">恢复系统默认</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* 按钮组 */}
            <div className="flex justify-end space-x-3 pt-4">
                <button
                    type="button"
                    onClick={onCancel}
                    className="px-4 py-2 text-sm font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-md transition-colors"
                >
                    取消
                </button>
                <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors disabled:opacity-50"
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
                 renderFormContent()}
            </AnimatePresence>
        </form>
    );
};

export default CustomEquipmentForm;