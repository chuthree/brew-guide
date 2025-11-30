import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
} from 'react';
import { CustomEquipment } from '@/lib/core/config';
import { isEquipmentNameAvailable } from '@/lib/managers/customEquipments';
import DrawingCanvas, { DrawingCanvasRef } from '../../common/ui/DrawingCanvas';
import AnimationEditor, {
  AnimationEditorRef,
  AnimationFrame,
} from '../../brewing/AnimationEditor';
import hapticsUtils from '@/lib/ui/haptics';
import { AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import { modalHistory } from '@/lib/hooks/useModalHistory';

// 从CustomEquipment类型中提取PourAnimation类型
type CustomPourAnimation = NonNullable<
  CustomEquipment['customPourAnimations']
>[number];

// 用于处理服务器端/客户端的窗口尺寸
const useWindowSize = () => {
  const [size, setSize] = useState({
    width: 0,
    height: 0,
  });

  useEffect(() => {
    // 客户端才执行
    if (typeof window !== 'undefined') {
      const handleResize = () => {
        setSize({
          width: window.innerWidth,
          height: window.innerHeight,
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
    description: '适用于锥形、蛋糕杯、折纸等常规器具',
    equipmentId: 'V60',
  },
  {
    value: 'clever',
    label: '聪明杯预设',
    description: '带阀门控制，可以控制咖啡液流出的时间',
    equipmentId: 'CleverDripper',
  },
  {
    value: 'espresso',
    label: '意式机',
    description: '适用于意式咖啡机，关注萃取时间和液重',
    equipmentId: 'Espresso',
  },
  {
    value: 'custom',
    label: '自定义预设',
    description: '完全自定义器具，创建您自己的独特设置',
    equipmentId: '',
  },
] as const;

// 意式机已整合到PRESET_OPTIONS数组中

// 修改默认注水类型常量
const DEFAULT_POUR_TYPES = [
  {
    id: 'system-center',
    name: '中心注水',
    pourType: 'center' as const,
    description: '中心定点注水，降低萃取率',
    isSystemDefault: true,
    previewFrames: 3,
  },
  {
    id: 'system-circle',
    name: '绕圈注水',
    pourType: 'circle' as const,
    description: '中心向外缓慢画圈注水，均匀萃取咖啡风味',
    isSystemDefault: true,
    previewFrames: 4,
  },
  {
    id: 'system-ice',
    name: '添加冰块',
    pourType: 'ice' as const,
    description: '适用于冰滴和冰手冲咖啡',
    isSystemDefault: true,
    previewFrames: 4,
  },
  {
    id: 'system-bypass',
    name: 'Bypass',
    pourType: 'bypass' as const,
    description: '冲煮完成后添加到咖啡液中，调节浓度和口感',
    isSystemDefault: true,
    previewFrames: 1,
  },
];

// 表单字段组件
interface FormFieldProps {
  label: string;
  error?: string;
  children: React.ReactNode;
  hint?: string;
}

const FormField: React.FC<FormFieldProps> = ({
  label,
  error,
  children,
  hint,
}) => (
  <div className="mb-4">
    <label className="mb-1 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
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

const TopNav: React.FC<TopNavProps> = ({
  title,
  onBack,
  onSave,
  saveDisabled = false,
}) => (
  <div className="fixed top-0 right-0 left-0 z-10 flex items-center justify-between bg-neutral-50 px-4 py-3 dark:bg-neutral-900">
    <button type="button" onClick={onBack} className="rounded-full p-2 pl-0">
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M19 12H5M5 12L12 19M5 12L12 5"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
    <h3 className="font-medium text-neutral-800 dark:text-neutral-100">
      {title}
    </h3>
    {onSave ? (
      <button
        type="button"
        onClick={onSave}
        disabled={saveDisabled}
        className={`rounded-full p-2 ${saveDisabled ? 'text-neutral-400 dark:text-neutral-600' : 'text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20'}`}
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M5 13L9 17L19 7"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
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
  initialEquipment,
}) => {
  const windowSize = useWindowSize();
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const [canvasSize, setCanvasSize] = useState(300);
  const [strokeWidth, setStrokeWidth] = useState(3);
  const canvasRef = useRef<DrawingCanvasRef>(null);
  const animationEditorRef = useRef<AnimationEditorRef>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  // 预设方案状态 - 根据初始值设置
  const [selectedPreset, setSelectedPreset] = useState<
    (typeof PRESET_OPTIONS)[number]['value'] | 'espresso'
  >(() => {
    if (!initialEquipment) return 'v60';

    // 根据animationType确定预设类型
    switch (initialEquipment.animationType) {
      case 'espresso':
        return 'espresso';
      case 'clever':
        return 'clever';
      case 'custom':
        return 'custom';
      case 'v60':
      default:
        return 'v60';
    }
  });

  // 添加杯型选择状态（默认/自定义）
  // 初始化逻辑：只有在既有customShapeSvg数据，且当前预设不是espresso时，才显示为自定义
  const [cupShapeType, setCupShapeType] = useState<'default' | 'custom'>(() => {
    // espresso预设不支持杯型选择，始终为default
    if (initialEquipment?.animationType === 'espresso') {
      return 'default';
    }
    // 只有同时满足两个条件才判定为custom：1) 有customShapeSvg数据 2) 预设不禁止自定义
    return initialEquipment?.customShapeSvg ? 'custom' : 'default';
  });

  // 添加阀门样式选择状态（默认/自定义）
  const [_valveShapeType, setValveShapeType] = useState<string>('default');
  const [_valvePreviewState, setValvePreviewState] = useState<
    'open' | 'closed'
  >('closed');

  const [equipment, setEquipment] = useState<Partial<CustomEquipment>>({
    name: '',
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
  const [_hasValveDrawn, setHasValveDrawn] = useState(
    !!equipment.customValveSvg
  );
  const [valveEditMode, setValveEditMode] = useState<'closed' | 'open'>(
    'closed'
  );

  // 添加对设备数据的引用，用于确保最新数据在各个视图间同步
  const equipmentRef = useRef<Partial<CustomEquipment>>(equipment);

  // 当equipment状态更新时，同步更新引用
  useEffect(() => {
    equipmentRef.current = equipment;
  }, [equipment]);

  // 添加当前预览帧状态
  const [previewFrameIndexes, setPreviewFrameIndexes] = useState<
    Record<string, number>
  >({});

  // 初始化注水方式，合并系统默认和用户自定义
  const [customPourAnimations, setCustomPourAnimations] = useState<
    CustomPourAnimation[]
  >(() => {
    // 处理用户自定义的注水动画
    const userCustom = initialEquipment?.customPourAnimations || [];

    // 为自定义动画计算previewFrames
    const processedUserCustom = userCustom
      .filter(anim => !anim.isSystemDefault)
      .map(anim => {
        // 如果有frames属性，则将previewFrames设置为frames的长度
        if (anim.frames && anim.frames.length > 0) {
          return {
            ...anim,
            previewFrames: anim.frames.length,
          };
        }
        // 否则保持原样
        return anim;
      });

    // 根据初始器具的animationType判断是否为自定义预设
    const isCustomPreset = initialEquipment?.animationType === 'custom';

    // 如果是自定义预设，只返回用户自定义的注水动画
    if (isCustomPreset) {
      return processedUserCustom;
    }

    // 否则包含系统默认注水方式
    const defaults: CustomPourAnimation[] = DEFAULT_POUR_TYPES.map(type => ({
      id: type.id,
      name: type.name,
      customAnimationSvg: '',
      isSystemDefault: true,
      pourType: type.pourType,
      previewFrames: type.previewFrames,
    }));

    return [...defaults, ...processedUserCustom];
  });

  // 添加一个ref用于跟踪最新的customPourAnimations
  const customPourAnimationsRef =
    useRef<CustomPourAnimation[]>(customPourAnimations);

  // 更新ref中的值
  useEffect(() => {
    customPourAnimationsRef.current = customPourAnimations;

    // 检查并初始化新的自定义动画的预览帧索引
    setPreviewFrameIndexes(prev => {
      const newIndexes = { ...prev };

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
        const newIndexes = { ...prev };

        // 使用ref中的最新值
        customPourAnimationsRef.current.forEach(anim => {
          const currentIndex = prev[anim.id] || 1;

          // 获取最大帧数
          let maxFrames = 1;
          if (
            anim.frames &&
            Array.isArray(anim.frames) &&
            anim.frames.length > 1
          ) {
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
          newIndexes[anim.id] =
            currentIndex >= maxFrames ? 1 : currentIndex + 1;
        });

        return newIndexes;
      });

      // 切换阀门预览状态
      setValvePreviewState(prev => (prev === 'closed' ? 'open' : 'closed'));
    }, 800); // 每800ms更新一次

    return () => clearInterval(previewTimer);
  }, [customPourAnimations]); // 添加缺失的依赖

  const [showPourAnimationCanvas, setShowPourAnimationCanvas] = useState(false);
  const [currentEditingAnimation, setCurrentEditingAnimation] =
    useState<CustomPourAnimation | null>(null);

  // 为子页面注册独立的历史条目
  // 绘制杯型子页面
  useEffect(() => {
    if (showDrawingCanvas) {
      return modalHistory.register({
        id: 'equipment-form-drawing',
        onClose: () => setShowDrawingCanvas(false),
      });
    }
  }, [showDrawingCanvas]);

  // 绘制阀门子页面
  useEffect(() => {
    if (showValveDrawingCanvas) {
      return modalHistory.register({
        id: 'equipment-form-valve',
        onClose: () => setShowValveDrawingCanvas(false),
      });
    }
  }, [showValveDrawingCanvas]);

  // 编辑注水动画子页面
  useEffect(() => {
    if (showPourAnimationCanvas) {
      return modalHistory.register({
        id: 'equipment-form-animation',
        onClose: () => {
          setShowPourAnimationCanvas(false);
          setCurrentEditingAnimation(null);
          setIsPlaying(false);
        },
      });
    }
  }, [showPourAnimationCanvas]);

  // 监听预设方案变化
  useEffect(() => {
    if (selectedPreset === 'v60') {
      handleChange('animationType', 'v60');
      handleChange('hasValve', false);
    } else if (selectedPreset === 'clever') {
      handleChange('animationType', 'clever');
      handleChange('hasValve', true);
    } else if (selectedPreset === 'espresso') {
      handleChange('animationType', 'espresso');
      handleChange('hasValve', false);
      // espresso预设强制使用默认杯型
      setCupShapeType('default');
    } else if (selectedPreset === 'custom') {
      handleChange('animationType', 'custom');
      // 自定义预设强制使用自定义杯型
      setCupShapeType('custom');
      // 自定义预设时，过滤掉系统默认注水方式
      setCustomPourAnimations(prev =>
        prev.filter(anim => !anim.isSystemDefault)
      );
      // 自定义预设不自动设置阀门，保持当前值
    }
  }, [selectedPreset]);

  // 计算画布尺寸
  useEffect(() => {
    if (
      (showDrawingCanvas ||
        showPourAnimationCanvas ||
        showValveDrawingCanvas) &&
      canvasContainerRef.current &&
      windowSize.width > 0
    ) {
      // 获取容器宽度，不再减去padding
      const containerWidth = canvasContainerRef.current.clientWidth;
      setCanvasSize(containerWidth);
    }
  }, [
    showDrawingCanvas,
    showPourAnimationCanvas,
    showValveDrawingCanvas,
    windowSize.width,
  ]);

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
    } else if (
      !(await isEquipmentNameAvailable(equipment.name, initialEquipment?.id))
    ) {
      newErrors.name = '器具名称已存在';
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
              // 多帧动画处理逻辑
              if (process.env.NODE_ENV === 'development') {
                console.warn(
                  `处理多帧动画: ${animation.name}, 帧数: ${animation.frames.length}`
                );
              }
            }
            return animation;
          });

        const equipmentToSave = {
          ...(equipment as CustomEquipment),
          isCustom: true as const,
          customPourAnimations:
            selectedPreset === 'custom' ? processedAnimations : undefined,
          // 根据杯型选择，清空或保留customShapeSvg
          customShapeSvg:
            cupShapeType === 'custom' ? equipment.customShapeSvg : '',
          // 如果使用默认杯型，同时清空阀门自定义数据
          customValveSvg:
            cupShapeType === 'custom' ? equipment.customValveSvg : '',
          customValveOpenSvg:
            cupShapeType === 'custom' ? equipment.customValveOpenSvg : '',
        };

        // 检查杯型SVG数据是否存在
        if (
          equipmentToSave.customShapeSvg &&
          process.env.NODE_ENV === 'development'
        ) {
          console.warn('保存自定义杯型SVG数据');
        }

        // 检查自定义阀门SVG数据是否存在
        if (
          equipmentToSave.customValveSvg &&
          process.env.NODE_ENV === 'development'
        ) {
          console.warn('保存自定义阀门SVG数据');
        }

        // 检查自定义阀门开启状态SVG数据是否存在
        if (
          equipmentToSave.customValveOpenSvg &&
          process.env.NODE_ENV === 'development'
        ) {
          console.warn('保存自定义阀门开启状态SVG数据');
        }

        // 检查最终传递的自定义注水动画数据
        if (
          equipmentToSave.customPourAnimations &&
          process.env.NODE_ENV === 'development'
        ) {
          console.warn(
            `保存${equipmentToSave.customPourAnimations.length}个自定义注水动画`
          );
        }

        onSave(equipmentToSave);
      }
    } catch (error) {
      // Log error in development only
      if (process.env.NODE_ENV === 'development') {
        console.error('保存设备时发生错误:', error);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // 处理杯型绘制完成
  const handleDrawingComplete = (svg: string) => {
    if (svg && svg.trim() !== '') {
      // 更新equipment状态
      setEquipment(prev => ({
        ...prev,
        customShapeSvg: svg,
      }));
      setHasDrawn(true);

      // 确保在绘制完成后立即更新引用值，避免状态延迟同步问题
      equipmentRef.current = {
        ...equipmentRef.current,
        customShapeSvg: svg,
      };
    } else {
      // Log warning in development only
      if (process.env.NODE_ENV === 'development') {
        console.warn('绘制完成但SVG数据为空');
      }
    }
  };

  // 处理阀门绘制完成
  const handleValveDrawingComplete = (svg: string) => {
    if (svg && svg.trim() !== '') {
      // 确保自定义阀门与杯型一起显示
      setEquipment(prev => {
        // 创建一个更新后的设备对象
        const updatedEquipment = {
          ...prev,
          ...(valveEditMode === 'closed'
            ? { customValveSvg: svg }
            : { customValveOpenSvg: svg }),
        };

        // 确保设备对象有customShapeSvg, hasValve等属性
        if (!updatedEquipment.hasValve) {
          updatedEquipment.hasValve = true;
        }

        return updatedEquipment;
      });

      setHasValveDrawn(true);
      setValveShapeType('custom');
    } else {
      // Log warning in development only
      if (process.env.NODE_ENV === 'development') {
        console.warn('阀门绘制完成但SVG数据为空');
      }
    }
  };

  // 保存绘图并返回表单界面
  const handleSaveDrawing = () => {
    hapticsUtils.medium();

    if (canvasRef.current) {
      try {
        const svgString = canvasRef.current.save();
        handleDrawingComplete(svgString);
        // 使用 modalHistory.back() 正确清理历史栈条目
        modalHistory.back();
      } catch (error) {
        // Log error in development only
        if (process.env.NODE_ENV === 'development') {
          console.error('保存绘图时发生错误:', error);
        }
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
        // 使用 modalHistory.back() 正确清理历史栈条目
        modalHistory.back();
      } catch (error) {
        // Log error in development only
        if (process.env.NODE_ENV === 'development') {
          console.error('保存阀门绘图时发生错误:', error);
        }
      }
    }
  };

  // 返回表单界面 - 通过历史栈返回
  const handleBackToForm = () => {
    modalHistory.back();
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
      name: '', // 不设置默认名称，要求用户必须输入
      customAnimationSvg: '',
      isSystemDefault: false,
    };
    setCurrentEditingAnimation(newAnimation);
    setShowPourAnimationCanvas(true);
  };

  const handleEditPourAnimation = (animation: CustomPourAnimation) => {
    // 记录当前杯型状态，有助于调试

    // 确保引用数据是最新的
    if (equipment.customShapeSvg) {
      equipmentRef.current = {
        ...equipmentRef.current,
        customShapeSvg: equipment.customShapeSvg,
      };
    }

    setCurrentEditingAnimation({ ...animation });
    setShowPourAnimationCanvas(true);
  };

  // 修改handleDeletePourAnimation函数
  const handleDeletePourAnimation = (id: string) => {
    hapticsUtils.medium();
    setCustomPourAnimations(prev => prev.filter(a => a.id !== id));
  };

  // 获取注水动画参考图像
  const getPourAnimationReferenceImages = (
    animation: CustomPourAnimation
  ): { url: string; label: string }[] => {
    if (
      animation.isSystemDefault &&
      animation.pourType &&
      animation.previewFrames
    ) {
      // 获取系统默认动画的参考图像
      const frames = [];
      for (let i = 0; i < animation.previewFrames; i++) {
        frames.push({
          url: `/images/pour-animations/${animation.pourType}/frame-${i + 1}.png`,
          label: `帧 ${i + 1}`,
        });
      }
      return frames;
    }
    return [];
  };

  // 将SVG文本转换为AnimationFrame
  const _svgToAnimationFrames = (svgText: string) => {
    if (!svgText || svgText.trim() === '') {
      return [{ id: 'frame-1', svgData: '' }];
    }

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
  const handleSavePourAnimation = useCallback(() => {
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
            previewFrames: frames.length, // 确保设置正确的预览帧数量
          };

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
            [updatedAnimation.id]: 1,
          }));

          // 使用 modalHistory.back() 正确清理历史栈条目
          // 这会触发 onClose 回调，自动执行 setShowPourAnimationCanvas(false) 和 setCurrentEditingAnimation(null)
          modalHistory.back();
        }
      } catch (error) {
        // Log error in development only
        if (process.env.NODE_ENV === 'development') {
          console.error('保存注水动画时发生错误:', error);
        }
      }
    }
  }, [
    currentEditingAnimation,
    setCustomPourAnimations,
    setPreviewFrameIndexes,
    setShowPourAnimationCanvas,
    setCurrentEditingAnimation,
  ]);

  // 处理注水动画名称变更
  const handlePourAnimationNameChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (currentEditingAnimation) {
        setCurrentEditingAnimation(prev => ({
          ...prev!,
          name: e.target.value, // 直接使用输入值，不做trim，让用户可以输入空格
        }));
      }
    },
    [currentEditingAnimation, setCurrentEditingAnimation]
  );

  // 添加播放状态切换函数 - 使用useCallback以便可以用于依赖数组
  const handleTogglePlayback = useCallback(() => {
    if (animationEditorRef.current) {
      const newPlayingState = !isPlaying;
      animationEditorRef.current.togglePlayback();
      // 使用 requestAnimationFrame 确保状态更新在 DOM 更新之后
      requestAnimationFrame(() => {
        setIsPlaying(newPlayingState);
      });
    }
  }, [isPlaying]);

  // 添加删除帧函数 - 使用useCallback
  const handleDeleteCurrentFrame = useCallback(() => {
    if (animationEditorRef.current) {
      animationEditorRef.current.deleteFrame();
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
        // 确保设备引用是最新的
      }
    }
  }, [
    showPourAnimationCanvas,
    currentEditingAnimation?.id,
    currentEditingAnimation,
  ]);

  // 获取参考图像
  const referenceImageUrls = useMemo(
    () =>
      currentEditingAnimation
        ? getPourAnimationReferenceImages(currentEditingAnimation)
        : [],
    [currentEditingAnimation]
  );

  // 获取自定义杯型SVG
  const customShapeSvg = useMemo(() => {
    const svg = equipment.customShapeSvg || equipmentRef.current.customShapeSvg;
    return svg;
  }, [equipment.customShapeSvg]); // 只依赖于 equipment.customShapeSvg

  // 获取初始帧数据
  const initialFrames = useMemo(() => {
    if (!currentEditingAnimation) return [{ id: 'frame-1', svgData: '' }];

    if (process.env.NODE_ENV === 'development') {
      console.warn('开发模式：初始化帧数据', currentEditingAnimation);
    }

    if (
      currentEditingAnimation.frames &&
      currentEditingAnimation.frames.length > 0
    ) {
      return currentEditingAnimation.frames;
    }
    if (currentEditingAnimation.customAnimationSvg) {
      return _svgToAnimationFrames(currentEditingAnimation.customAnimationSvg);
    }
    return [{ id: 'frame-1', svgData: '' }];
  }, [currentEditingAnimation]);

  // 生成编辑器key - 添加 showPourAnimationCanvas 作为依赖
  const editorKey = useMemo(
    () =>
      currentEditingAnimation
        ? `animation-editor-${currentEditingAnimation.id}-${customShapeSvg?.length || 0}-${showPourAnimationCanvas}`
        : '',
    [currentEditingAnimation, customShapeSvg, showPourAnimationCanvas]
  );

  // 渲染注水动画画布
  const renderPourAnimationCanvas = useCallback(() => {
    if (!currentEditingAnimation) return null;

    // 检查是否可以保存（名称不能为空）
    const canSave = currentEditingAnimation.name.trim() !== '';

    return (
      <>
        <TopNav
          title={
            currentEditingAnimation.id.startsWith('system-')
              ? `编辑${currentEditingAnimation.name}动画`
              : currentEditingAnimation.customAnimationSvg
                ? '编辑注水动画'
                : '添加注水动画'
          }
          onBack={() => {
            modalHistory.back();
          }}
          onSave={handleSavePourAnimation}
          saveDisabled={!canSave}
        />

        <div className="mb-4">
          <FormField
            label="动画名称"
            error={
              !currentEditingAnimation.name.trim()
                ? '请输入注水动画名称'
                : undefined
            }
            hint="例如：中心注水、绕圈注水等"
          >
            <input
              type="text"
              value={currentEditingAnimation.name}
              onChange={handlePourAnimationNameChange}
              className="mt-1 block w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:ring-blue-500 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
              placeholder="请输入注水动画名称"
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
          <h3 className="mb-2 text-sm font-medium text-neutral-600 dark:text-neutral-400">
            绘制注水动画
          </h3>
          <p className="mb-2 text-xs text-neutral-500 dark:text-neutral-400">
            请在画布上绘制咖啡滴落的动画效果，创建多个帧以实现动态效果。点击上方帧缩略图可切换帧。
          </p>
        </div>

        <div
          ref={canvasContainerRef}
          className="mx-auto w-full overflow-hidden rounded-xl"
        >
          {canvasSize > 0 && (
            <div className="animation-editor-custom">
              <style jsx>{`
                .animation-editor-custom
                  :global(.flex.flex-col.space-y-2 > div.flex.justify-between) {
                  display: none;
                }
                .animation-editor-custom
                  :global(.flex.flex-col.space-y-2 > div.mt-2) {
                  display: none;
                }
                .animation-editor-custom
                  :global(
                    .flex-shrink-0.w-16.h-16.bg-neutral-200.dark\\:bg-neutral-700.rounded-md.border-2.border-dashed
                  ) {
                  display: none;
                }
              `}</style>
              <AnimationEditor
                ref={animationEditorRef}
                width={canvasSize}
                height={canvasSize}
                initialFrames={initialFrames}
                referenceImages={referenceImageUrls}
                maxFrames={currentEditingAnimation.previewFrames || 4}
                referenceSvg={customShapeSvg}
                key={editorKey}
              />
            </div>
          )}
        </div>

        {/* 工具栏区域 - 不再需要自定义添加帧按钮，使用AnimationEditor原生的帧管理功能 */}
        <div className="mt-6 flex justify-between">
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
              className="flex h-10 w-10 items-center justify-center rounded-full border border-neutral-200 bg-white dark:border-neutral-700 dark:bg-neutral-800"
              aria-label="减小线条粗细"
            >
              <span className="text-lg font-medium">−</span>
            </button>

            <div className="flex h-10 w-10 items-center justify-center rounded-full border border-neutral-200 bg-white dark:border-neutral-700 dark:bg-neutral-800">
              <div
                className="rounded-full bg-neutral-900 dark:bg-white"
                style={{
                  width: `${strokeWidth}px`,
                  height: `${strokeWidth}px`,
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
              className="flex h-10 w-10 items-center justify-center rounded-full border border-neutral-200 bg-white dark:border-neutral-700 dark:bg-neutral-800"
              aria-label="增加线条粗细"
            >
              <span className="text-lg font-medium">+</span>
            </button>
          </div>

          {/* 右侧：播放/暂停、撤销、删除 */}
          <div className="flex items-center space-x-3">
            <button
              type="button"
              onClick={handleTogglePlayback}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-neutral-200 bg-white dark:border-neutral-700 dark:bg-neutral-800"
              aria-label={isPlaying ? '暂停' : '播放'}
            >
              {isPlaying ? (
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M10 9V15M14 9V15"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              ) : (
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M6 4.75L17.25 12L6 19.25V4.75Z"
                    fill="currentColor"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
            </button>

            <button
              type="button"
              onClick={() => animationEditorRef.current?.undo()}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-neutral-200 bg-white dark:border-neutral-700 dark:bg-neutral-800"
              aria-label="撤销"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M8 10L4 14M4 14L8 18M4 14H16C18.2091 14 20 12.2091 20 10C20 7.79086 18.2091 6 16 6H12"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>

            <button
              type="button"
              onClick={handleDeleteCurrentFrame}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-neutral-200 bg-white dark:border-neutral-700 dark:bg-neutral-800"
              aria-label="删除帧"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M19 7L18.1327 19.1425C18.0579 20.1891 17.187 21 16.1378 21H7.86224C6.81296 21 5.94208 20.1891 5.86732 19.1425L5 7M10 11V17M14 11V17M15 7V4C15 3.44772 14.5523 3 14 3H10C9.44772 3 9 3.44772 9 4V7M4 7H20"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>
        </div>
      </>
    );
  }, [
    strokeWidth,
    handleTogglePlayback,
    handleDeleteCurrentFrame,
    currentEditingAnimation,
    canvasSize,
    customShapeSvg,
    editorKey,
    handlePourAnimationNameChange,
    handleSavePourAnimation,
    initialFrames,
    isPlaying,
    referenceImageUrls,
  ]);

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
        className="mx-auto w-full rounded-xl bg-neutral-50 dark:bg-neutral-800"
      >
        {canvasSize > 0 && (
          <DrawingCanvas
            ref={canvasRef}
            width={canvasSize}
            height={canvasSize}
            defaultSvg={equipment.customShapeSvg}
            onDrawingComplete={svg => {
              handleDrawingComplete(svg);
              setHasDrawn(true);
            }}
            showReference={showReference}
            referenceSvgUrl="/images/icons/ui/v60-base.svg"
          />
        )}
      </div>

      <div className="mt-6 flex justify-between">
        {/* 左侧：画笔大小控制 */}
        <div className="flex items-center space-x-3">
          <button
            type="button"
            onClick={() => handleStrokeWidthChange(strokeWidth - 1)}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-neutral-200 bg-white dark:border-neutral-700 dark:bg-neutral-800"
            aria-label="减小线条粗细"
          >
            <span className="text-lg font-medium">−</span>
          </button>

          <div className="flex h-10 w-10 items-center justify-center rounded-full border border-neutral-200 bg-white dark:border-neutral-700 dark:bg-neutral-800">
            <div
              className="rounded-full bg-neutral-900 dark:bg-white"
              style={{
                width: `${strokeWidth}px`,
                height: `${strokeWidth}px`,
              }}
              aria-label={`笔触大小: ${strokeWidth}`}
            />
          </div>

          <button
            type="button"
            onClick={() => handleStrokeWidthChange(strokeWidth + 1)}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-neutral-200 bg-white dark:border-neutral-700 dark:bg-neutral-800"
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
            className="flex h-10 w-10 items-center justify-center rounded-full border border-neutral-200 bg-white dark:border-neutral-700 dark:bg-neutral-800"
            aria-label={showReference ? '隐藏底图' : '显示底图'}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              {showReference ? (
                <path
                  d="M12.5 4.5H18C19.1046 4.5 20 5.39543 20 6.5V12M20 18V16M6 20H12M4 6V12M4 16V18C4 19.1046 4.89543 20 6 20M18 4.5H16M8 4H6C4.89543 4 4 4.89543 4 6"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ) : (
                <path
                  d="M4 6V12M4 16V18C4 19.1046 4.89543 20 6 20H12M18 20H20M8 4H6C4.89543 4 4 4.89543 4 6M18 4H16M12 4H8M20 12V6C20 4.89543 19.1046 4 18 4"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}
            </svg>
          </button>

          <button
            type="button"
            onClick={() => canvasRef.current?.undo()}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-neutral-200 bg-white dark:border-neutral-700 dark:bg-neutral-800"
            aria-label="撤销"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M8 10L4 14M4 14L8 18M4 14H16C18.2091 14 20 12.2091 20 10C20 7.79086 18.2091 6 16 6H12"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>

          <button
            type="button"
            onClick={() => canvasRef.current?.clear()}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-neutral-200 bg-white dark:border-neutral-700 dark:bg-neutral-800"
            aria-label="清除"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M4 7H20M10 11V17M14 11V17M5 7L6 19C6 20.1 6.9 21 8 21H16C17.1 21 18 20.1 18 19L19 7M9 7V4C9 3.45 9.45 3 10 3H14C14.55 3 15 3.45 15 4V7M4 7H20"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
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
        title={
          valveEditMode === 'closed' ? '绘制阀门关闭状态' : '绘制阀门开启状态'
        }
        onBack={handleBackToForm}
        onSave={handleSaveValveDrawing}
      />
      <div
        ref={canvasContainerRef}
        className="mx-auto w-full rounded-xl bg-neutral-50 dark:bg-neutral-800"
      >
        {canvasSize > 0 && (
          <DrawingCanvas
            ref={canvasRef}
            width={canvasSize}
            height={canvasSize}
            defaultSvg={
              valveEditMode === 'closed'
                ? equipment.customValveSvg
                : equipment.customValveOpenSvg
            }
            onDrawingComplete={svg => {
              handleValveDrawingComplete(svg);
              setHasValveDrawn(true);
            }}
            showReference={showReference}
            // 设置参考图像的优先级：
            // 1. customReferenceSvg: 器具SVG (作为主背景)
            // 2. referenceSvg: 另一状态的阀门SVG (作为参考)
            _customReferenceSvg={equipment.customShapeSvg || undefined}
            // 另一状态的阀门作为参考
            referenceSvg={
              valveEditMode === 'closed'
                ? equipment.customValveOpenSvg // 如果当前是绘制关闭状态，则显示开启状态作为参考
                : equipment.customValveSvg // 如果当前是绘制开启状态，则显示关闭状态作为参考
            }
            // 如果没有自定义器具，使用默认V60器具作为底图
            referenceSvgUrl={
              !equipment.customShapeSvg
                ? '/images/icons/ui/v60-base.svg'
                : undefined
            }
          />
        )}
      </div>

      <div className="mt-6 flex justify-between">
        {/* 左侧：画笔大小控制 */}
        <div className="flex items-center space-x-3">
          <button
            type="button"
            onClick={() => handleStrokeWidthChange(strokeWidth - 1)}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-neutral-200 bg-white dark:border-neutral-700 dark:bg-neutral-800"
            aria-label="减小线条粗细"
          >
            <span className="text-lg font-medium">−</span>
          </button>

          <div className="flex h-10 w-10 items-center justify-center rounded-full border border-neutral-200 bg-white dark:border-neutral-700 dark:bg-neutral-800">
            <div
              className="rounded-full bg-neutral-900 dark:bg-white"
              style={{
                width: `${strokeWidth}px`,
                height: `${strokeWidth}px`,
              }}
              aria-label={`笔触大小: ${strokeWidth}`}
            />
          </div>

          <button
            type="button"
            onClick={() => handleStrokeWidthChange(strokeWidth + 1)}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-neutral-200 bg-white dark:border-neutral-700 dark:bg-neutral-800"
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
                  // Log error in development only
                  if (process.env.NODE_ENV === 'development') {
                    console.error('切换阀门状态时保存失败:', error);
                  }
                }
              }
              // 切换到另一个状态
              setValveEditMode(newMode);
            }}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-neutral-200 bg-white dark:border-neutral-700 dark:bg-neutral-800"
            aria-label={`切换到${valveEditMode === 'closed' ? '开启' : '关闭'}状态`}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M14.6 15.5l4.6-4.6c.4-.4.4-1 0-1.4l-4.6-4.6M9.4 15.5L4.8 10.9c-.4-.4-.4-1 0-1.4l4.6-4.6"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span className="absolute top-0 right-0 flex h-4 w-4 items-center justify-center rounded-full bg-blue-500 text-[8px] text-neutral-100 dark:bg-blue-600">
              {valveEditMode === 'closed' ? 'O' : 'C'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setShowReference(!showReference)}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-neutral-200 bg-white dark:border-neutral-700 dark:bg-neutral-800"
            aria-label={showReference ? '隐藏底图' : '显示底图'}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              {showReference ? (
                <path
                  d="M12.5 4.5H18C19.1046 4.5 20 5.39543 20 6.5V12M20 18V16M6 20H12M4 6V12M4 16V18C4 19.1046 4.89543 20 6 20M18 4.5H16M8 4H6C4.89543 4 4 4.89543 4 6"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ) : (
                <path
                  d="M4 6V12M4 16V18C4 19.1046 4.89543 20 6 20H12M18 20H20M8 4H6C4.89543 4 4 4.89543 4 6M18 4H16M12 4H8M20 12V6C20 4.89543 19.1046 4 18 4"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}
            </svg>
          </button>

          <button
            type="button"
            onClick={() => canvasRef.current?.undo()}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-neutral-200 bg-white dark:border-neutral-700 dark:bg-neutral-800"
            aria-label="撤销"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M8 10L4 14M4 14L8 18M4 14H16C18.2091 14 20 12.2091 20 10C20 7.79086 18.2091 6 16 6H12"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>

          <button
            type="button"
            onClick={() => canvasRef.current?.clear()}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-neutral-200 bg-white dark:border-neutral-700 dark:bg-neutral-800"
            aria-label="清除"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M4 7H20M10 11V17M14 11V17M5 7L6 19C6 20.1 6.9 21 8 21H16C17.1 21 18 20.1 18 19L19 7M9 7V4C9 3.45 9.45 3 10 3H14C14.55 3 15 3.45 15 4V7M4 7H20"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
      </div>

      <div className="mt-4 rounded-lg bg-neutral-100 p-3 text-xs text-neutral-500 dark:bg-neutral-900 dark:text-neutral-400">
        <h4 className="mb-1 font-medium">阀门绘制提示</h4>
        <ul className="list-disc space-y-1 pl-4">
          <li>
            当前绘制：{valveEditMode === 'closed' ? '关闭' : '开启'}状态的阀门
          </li>
          <li>
            使用
            <span className="mx-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-neutral-200 dark:bg-neutral-700">
              <svg
                width="10"
                height="10"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M14.6 15.5l4.6-4.6c.4-.4.4-1 0-1.4l-4.6-4.6M9.4 15.5L4.8 10.9c-.4-.4-.4-1 0-1.4l4.6-4.6"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            按钮切换阀门状态
          </li>
          <li>器具显示为底图，另一状态的阀门显示为参考</li>
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
        <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white dark:border-neutral-700 dark:bg-neutral-800">
          <div className="border-b border-neutral-200 bg-neutral-50 px-4 py-2.5 dark:border-neutral-700 dark:bg-neutral-800">
            <h3 className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
              基本信息
            </h3>
          </div>
          <div className="space-y-4 p-4">
            {/* 器具名称 */}
            <FormField label="器具名称" error={errors.name}>
              <input
                type="text"
                value={equipment.name || ''}
                onChange={e => handleChange('name', e.target.value)}
                className="block w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm transition-colors focus:border-blue-500 focus:ring-blue-500 dark:border-neutral-600 dark:bg-neutral-700 dark:text-neutral-100"
                placeholder="例如：双层器具"
              />
            </FormField>
          </div>
        </div>

        {/* 器具类型和杯型设置 */}
        <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white dark:border-neutral-700 dark:bg-neutral-800">
          <div className="border-b border-neutral-200 bg-neutral-50 px-4 py-2.5 dark:border-neutral-700 dark:bg-neutral-800">
            <h3 className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
              器具设置
            </h3>
          </div>
          <div className="divide-y divide-neutral-200 dark:divide-neutral-700">
            {/* 器具类型选择 */}
            <div className="p-4">
              <h4 className="mb-3 text-sm font-medium text-neutral-700 dark:text-neutral-300">
                选择器具类型
              </h4>
              <div className="grid grid-cols-2 gap-3">
                {PRESET_OPTIONS.map(preset => (
                  <label
                    key={preset.value}
                    className={`relative flex flex-col rounded-lg border p-3 ${
                      selectedPreset === preset.value
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-neutral-200 hover:border-blue-200 dark:border-neutral-700 dark:hover:border-blue-800'
                    } cursor-pointer transition-all`}
                  >
                    <div className="mb-1.5 flex items-center">
                      <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                        {preset.label}
                      </span>
                      {selectedPreset === preset.value && (
                        <div className="ml-2 h-3.5 w-3.5 text-blue-500">
                          <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                          >
                            <path
                              d="M5 13L9 17L19 7"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </div>
                      )}
                    </div>
                    <span className="line-clamp-2 text-xs text-neutral-500 dark:text-neutral-400">
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
            {selectedPreset !== 'espresso' && (
              <div className="p-4">
                <h4 className="mb-3 text-sm font-medium text-neutral-700 dark:text-neutral-300">
                  杯型设置
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  {/* 默认杯型选项 */}
                  {selectedPreset !== 'custom' && (
                    <label
                      className={`relative flex flex-col rounded-lg border p-3 ${
                        cupShapeType === 'default'
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                          : 'border-neutral-200 hover:border-blue-200 dark:border-neutral-700 dark:hover:border-blue-800'
                      } cursor-pointer transition-all`}
                    >
                      <div className="mb-2 flex items-center">
                        <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                          默认杯型
                        </span>
                        {cupShapeType === 'default' && (
                          <div className="ml-2 h-3.5 w-3.5 text-blue-500">
                            <svg
                              viewBox="0 0 24 24"
                              fill="none"
                              xmlns="http://www.w3.org/2000/svg"
                            >
                              <path
                                d="M5 13L9 17L19 7"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                          </div>
                        )}
                      </div>
                      <div className="relative flex aspect-square w-full items-center justify-center rounded-md bg-neutral-50 dark:bg-neutral-900">
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="relative h-3/4 w-3/4">
                            {/* 默认杯型始终显示默认图像，不管customShapeSvg是否存在 */}
                            <Image
                              src="/images/icons/ui/v60-base.svg"
                              alt="杯型背景"
                              fill
                              className="object-contain invert-0 dark:invert"
                              sizes="(max-width: 768px) 100vw, 300px"
                              quality={85}
                            />
                            {equipment.hasValve && (
                              <Image
                                src="/images/icons/ui/valve-closed.svg"
                                alt="阀门背景"
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
                    className={`relative flex flex-col rounded-lg border p-3 ${
                      cupShapeType === 'custom'
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-neutral-200 hover:border-blue-200 dark:border-neutral-700 dark:hover:border-blue-800'
                    } cursor-pointer transition-all`}
                  >
                    <input
                      type="radio"
                      name="cupShapeType"
                      value="custom"
                      checked={cupShapeType === 'custom'}
                      onChange={() => setCupShapeType('custom')}
                      className="hidden"
                    />
                    <div className="mb-2 flex items-center">
                      <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                        {equipment.customShapeSvg
                          ? '自定义杯型'
                          : '添加自定义杯型'}
                      </span>
                      {cupShapeType === 'custom' && (
                        <div className="ml-2 h-3.5 w-3.5 text-blue-500">
                          <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                          >
                            <path
                              d="M5 13L9 17L19 7"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={e => {
                        e.preventDefault();
                        handleShowDrawingCanvas();
                      }}
                      className="flex aspect-square w-full items-center justify-center overflow-hidden rounded-md bg-neutral-50 transition-colors hover:bg-neutral-100 dark:bg-neutral-900 dark:hover:bg-neutral-800"
                    >
                      {equipment.customShapeSvg ? (
                        <div
                          className="flex h-full w-full items-center justify-center"
                          dangerouslySetInnerHTML={{
                            __html: equipment.customShapeSvg.replace(
                              /<svg/,
                              '<svg width="100%" height="100%"'
                            ),
                          }}
                        />
                      ) : (
                        <svg
                          width="24"
                          height="24"
                          viewBox="0 0 24 24"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                          className="text-neutral-400"
                        >
                          <path
                            d="M12 5V19M5 12H19"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      )}
                    </button>
                  </label>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 注水方式管理 */}
        {selectedPreset === 'custom' && (
          <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white dark:border-neutral-700 dark:bg-neutral-800">
            <div className="flex items-center justify-between border-b border-neutral-200 bg-neutral-50 px-4 py-2.5 dark:border-neutral-700 dark:bg-neutral-800">
              <h3 className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                注水方式
              </h3>
            </div>
            <div className="p-4">
              <div className="grid grid-cols-2 gap-3">
                {customPourAnimations.map(animation => (
                  <div
                    key={animation.id}
                    className="relative flex flex-col rounded-lg border border-neutral-200 bg-white p-3 transition-colors hover:border-blue-200 dark:border-neutral-700 dark:bg-neutral-800 dark:hover:border-blue-800"
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                          {animation.name}
                        </span>
                        {animation.isSystemDefault && (
                          <span className="rounded-full bg-blue-50 px-1.5 py-0.5 text-xs text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                            系统
                          </span>
                        )}
                      </div>
                      <div className="flex items-center space-x-1">
                        {!animation.isSystemDefault && (
                          <button
                            type="button"
                            onClick={() => handleEditPourAnimation(animation)}
                            className="rounded-full p-1.5 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-blue-500 dark:hover:bg-neutral-700"
                          >
                            <svg
                              width="14"
                              height="14"
                              viewBox="0 0 24 24"
                              fill="none"
                              xmlns="http://www.w3.org/2000/svg"
                            >
                              <path
                                d="M11 4H4C3.44772 4 3 4.44772 3 5V19C3 19.5523 3.44772 20 4 20H18C18.5523 20 19 19.5523 19 19V12M17.5858 3.58579C18.3668 2.80474 19.6332 2.80474 20.4142 3.58579C21.1953 4.36683 21.1953 5.63316 20.4142 6.41421L11.8284 15H9L9 12.1716L17.5858 3.58579Z"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() =>
                            handleDeletePourAnimation(animation.id)
                          }
                          className="rounded-full p-1.5 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-red-500 dark:hover:bg-neutral-700"
                        >
                          <svg
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                          >
                            <path
                              d="M19 7L18.1327 19.1425C18.0579 20.1891 17.187 21 16.1378 21H7.86224C6.81296 21 5.94208 20.1891 5.86732 19.1425L5 7M10 11V17M14 11V17M15 7V4C15 3.44772 14.5523 3 14 3H10C9.44772 3 9 3.44772 9 4V7M4 7H20"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </button>
                      </div>
                    </div>
                    <div className="relative aspect-square w-full overflow-hidden rounded-md bg-neutral-50 dark:bg-neutral-900">
                      {/* 底部显示杯型 */}
                      <div className="absolute inset-0 flex items-center justify-center opacity-60">
                        {cupShapeType === 'custom' &&
                        equipment.customShapeSvg ? (
                          <div
                            className="custom-cup-shape outline-only flex h-full w-full items-center justify-center"
                            dangerouslySetInnerHTML={{
                              __html: equipment.customShapeSvg.replace(
                                /<svg/,
                                '<svg width="100%" height="100%"'
                              ),
                            }}
                          />
                        ) : (
                          <>
                            <div className="flex h-full w-full items-center justify-center">
                              <div className="relative h-full w-full">
                                <Image
                                  src="/images/icons/ui/v60-base.svg"
                                  alt="杯型背景"
                                  fill
                                  className="object-contain invert-0 dark:invert"
                                  sizes="(max-width: 768px) 100vw, 300px"
                                  quality={85}
                                />
                                {equipment.hasValve && (
                                  <Image
                                    src="/images/icons/ui/valve-closed.svg"
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
                          <div className="flex h-full w-full items-center justify-center">
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
                            const hasFrames =
                              animation.frames &&
                              Array.isArray(animation.frames) &&
                              animation.frames.length > 0;
                            const frameIndex =
                              (previewFrameIndexes[animation.id] || 1) - 1;

                            if (
                              hasFrames &&
                              frameIndex >= 0 &&
                              frameIndex < animation.frames!.length
                            ) {
                              const svgData =
                                animation.frames![frameIndex].svgData;
                              if (svgData && svgData.trim() !== '') {
                                return (
                                  <div className="flex h-full w-full items-center justify-center">
                                    <div
                                      className="custom-cup-shape outline-only flex h-full w-full items-center justify-center"
                                      dangerouslySetInnerHTML={{
                                        __html: svgData.replace(
                                          /<svg/,
                                          '<svg width="100%" height="100%"'
                                        ),
                                      }}
                                    />
                                  </div>
                                );
                              }
                            }

                            if (
                              animation.customAnimationSvg &&
                              animation.customAnimationSvg.trim() !== ''
                            ) {
                              return (
                                <div className="flex h-full w-full items-center justify-center">
                                  <div
                                    className="custom-cup-shape outline-only flex h-full w-full items-center justify-center"
                                    dangerouslySetInnerHTML={{
                                      __html:
                                        animation.customAnimationSvg.replace(
                                          /<svg/,
                                          '<svg width="100%" height="100%"'
                                        ),
                                    }}
                                  />
                                </div>
                              );
                            }

                            return (
                              <div className="p-4 text-center text-xs text-neutral-400 dark:text-neutral-500">
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
                  className="relative flex flex-col rounded-lg border border-dashed border-neutral-300 bg-white p-3 transition-colors hover:border-blue-500 dark:border-neutral-600 dark:bg-neutral-800 dark:hover:border-blue-400"
                >
                  <div className="mb-2 flex items-center">
                    <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                      添加注水方式
                    </span>
                  </div>
                  <div className="relative aspect-square w-full overflow-hidden rounded-md bg-neutral-50 dark:bg-neutral-900">
                    {/* 底部显示杯型 */}
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="relative h-full w-full opacity-60">
                        {cupShapeType === 'custom' &&
                        equipment.customShapeSvg ? (
                          <div
                            className="flex h-full w-full items-center justify-center"
                            dangerouslySetInnerHTML={{
                              __html: equipment.customShapeSvg.replace(
                                /<svg/,
                                '<svg width="100%" height="100%"'
                              ),
                            }}
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center">
                            <div className="relative h-3/4 w-3/4">
                              <Image
                                src="/images/icons/ui/v60-base.svg"
                                alt="杯型背景"
                                fill
                                className="object-contain invert-0 dark:invert"
                                sizes="(max-width: 768px) 100vw, 300px"
                                quality={85}
                              />
                              {equipment.hasValve && (
                                <Image
                                  src="/images/icons/ui/valve-closed.svg"
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
                        <svg
                          width="24"
                          height="24"
                          viewBox="0 0 24 24"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <path
                            d="M12 5V19M5 12H19"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
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
          className="rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-50 dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700"
        >
          取消
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-neutral-100 transition-colors hover:bg-blue-700 disabled:opacity-50 disabled:hover:bg-blue-600"
        >
          {isSubmitting ? '保存中...' : '保存'}
        </button>
      </div>
    </div>
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <AnimatePresence mode="wait">
        {showPourAnimationCanvas
          ? renderPourAnimationCanvas()
          : showDrawingCanvas
            ? renderDrawingCanvas()
            : showValveDrawingCanvas
              ? renderValveDrawingCanvas()
              : renderFormContent()}
      </AnimatePresence>
    </form>
  );
};

export default CustomEquipmentForm;
