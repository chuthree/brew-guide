import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
  useImperativeHandle,
  forwardRef,
} from 'react';
import { CustomEquipment, equipmentList } from '@/lib/core/config';
import { isEquipmentNameAvailable } from '@/lib/stores/customEquipmentStore';
import { getSettingsStore } from '@/lib/stores/settingsStore';
import DrawingCanvas, { DrawingCanvasRef } from '../../common/ui/DrawingCanvas';
import AnimationEditor, {
  AnimationEditorRef,
  AnimationFrame,
} from '../../brewing/AnimationEditor';
import hapticsUtils from '@/lib/ui/haptics';
import { AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import { modalHistory } from '@/lib/hooks/useModalHistory';
import {
  resolveCupReference,
  type CupShapeType,
} from '@/lib/equipment/cupReference';
import {
  ChevronRight,
  Minus,
  Pause,
  Pencil,
  Play,
  Plus,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import {
  SettingSection,
  SettingRow,
  SettingVerticalSelector,
  SettingCardSelector,
} from '@/components/settings/atomic';

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
  activeDrawerPage?: 'form' | 'equipment-picker';
  onOpenEquipmentPicker?: () => void;
  onChromeChange?: (chrome: EquipmentFormDrawerChrome) => void;
  onImport?: () => void;
}

export interface EquipmentFormDrawerChrome {
  key?: string;
  title: string;
  doneDisabled?: boolean;
  canGoBack?: boolean;
}

export interface CustomEquipmentFormHandle {
  back: () => void;
  done: () => void;
}

type EquipmentAnimationType = CustomEquipment['animationType'];

interface EquipmentPresetOption {
  value: EquipmentAnimationType;
  label: string;
  animationType: EquipmentAnimationType;
  hasValve?: boolean;
  defaultShapeIcon?: string;
}

// 器具选项和保存值保持同源，避免 UI 漏展示已支持的系统器具。
const PRESET_OPTIONS = [
  {
    value: 'v60',
    label: 'V60',
    animationType: 'v60',
    hasValve: false,
    defaultShapeIcon: '/images/icons/ui/v60-base.svg',
  },
  {
    value: 'kalita',
    label: 'Kalita',
    animationType: 'kalita',
    hasValve: false,
    defaultShapeIcon: '/images/icons/ui/kalita-base.svg',
  },
  {
    value: 'origami',
    label: 'Origami',
    animationType: 'origami',
    hasValve: false,
    defaultShapeIcon: '/images/icons/ui/origami-base.svg',
  },
  {
    value: 'orea',
    label: 'OREA',
    animationType: 'orea',
    hasValve: false,
    defaultShapeIcon: '/images/icons/ui/orea-base.svg',
  },
  {
    value: 'clever',
    label: '聪明杯',
    animationType: 'clever',
    hasValve: true,
    defaultShapeIcon: '/images/icons/ui/v60-base.svg',
  },
  {
    value: 'espresso',
    label: '意式咖啡机',
    animationType: 'espresso',
    hasValve: false,
  },
  {
    value: 'custom',
    label: '自定义器具',
    animationType: 'custom',
  },
] as const satisfies readonly EquipmentPresetOption[];

type EquipmentPresetValue = (typeof PRESET_OPTIONS)[number]['value'];

const getEquipmentPreset = (
  value: EquipmentPresetValue
): EquipmentPresetOption =>
  PRESET_OPTIONS.find(preset => preset.value === value) || PRESET_OPTIONS[0];

const getPresetValueFromAnimationType = (
  animationType?: EquipmentAnimationType
): EquipmentPresetValue => {
  const matchedPreset = PRESET_OPTIONS.find(
    preset => preset.animationType === animationType
  );

  return matchedPreset?.value || 'v60';
};

const isPresetEquipmentNameAvailable = (
  name: string,
  currentId?: string
): boolean => {
  const normalizedName = name.trim();
  if (!normalizedName) return false;

  const nameOverrides =
    getSettingsStore().settings.equipmentNameOverrides || {};

  return !equipmentList.some(equipment => {
    if (equipment.id === currentId) return false;

    const displayName = nameOverrides[equipment.id]?.trim() || equipment.name;
    return displayName === normalizedName;
  });
};

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

const CustomEquipmentForm = forwardRef<
  CustomEquipmentFormHandle,
  CustomEquipmentFormProps
>(
  (
    {
      onSave,
      onCancel,
      initialEquipment,
      activeDrawerPage = 'form',
      onOpenEquipmentPicker,
      onChromeChange,
      onImport,
    },
    ref
  ) => {
    const windowSize = useWindowSize();
    const canvasContainerRef = useRef<HTMLDivElement>(null);
    const [canvasSize, setCanvasSize] = useState(300);
    const [strokeWidth, setStrokeWidth] = useState(3);
    const canvasRef = useRef<DrawingCanvasRef>(null);
    const animationEditorRef = useRef<AnimationEditorRef>(null);
    const [isPlaying, setIsPlaying] = useState(false);

    // 器具类型状态 - 根据初始值设置
    const [selectedPreset, setSelectedPreset] = useState<EquipmentPresetValue>(
      () => getPresetValueFromAnimationType(initialEquipment?.animationType)
    );

    // 添加杯型选择状态（默认/自定义）
    // 初始化逻辑：只有在既有customShapeSvg数据，且当前器具不是espresso时，才显示为自定义
    const [cupShapeType, setCupShapeType] = useState<CupShapeType>(() => {
      // espresso不支持杯型选择，始终为default
      if (initialEquipment?.animationType === 'espresso') {
        return 'default';
      }
      // 只有同时满足两个条件才判定为custom：1) 有customShapeSvg数据 2) 器具支持自定义
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

    // 更新表单字段值的处理函数
    const handleChange = <K extends keyof CustomEquipment>(
      key: K,
      value: CustomEquipment[K]
    ) => {
      setEquipment(prev => ({ ...prev, [key]: value }));
    };

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
    const [draftValveSvgs, setDraftValveSvgs] = useState<{
      closed?: string;
      open?: string;
    }>({});

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

      // 根据初始器具的animationType判断是否为自定义器具
      const isCustomPreset = initialEquipment?.animationType === 'custom';

      // 如果是自定义器具，只返回用户自定义的注水动画
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

    const [showPourAnimationCanvas, setShowPourAnimationCanvas] =
      useState(false);
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
          onClose: () => {
            setShowValveDrawingCanvas(false);
            setDraftValveSvgs({});
          },
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

    const handlePresetSelect = (value: EquipmentPresetValue) => {
      const preset = getEquipmentPreset(value);

      setSelectedPreset(value);
      setEquipment(prev => ({
        ...prev,
        animationType: preset.animationType,
        ...(preset.hasValve === undefined ? {} : { hasValve: preset.hasValve }),
      }));
      if (preset.animationType === 'espresso') {
        // 意式机不支持杯型绘制
        setCupShapeType('default');
      } else if (preset.animationType === 'custom') {
        // 自定义器具强制使用自定义杯型
        setCupShapeType('custom');
        // 自定义器具只保留用户自定义注水方式
        setCustomPourAnimations(prev =>
          prev.filter(anim => !anim.isSystemDefault)
        );
      }
    };

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

    // 验证表单
    const validateForm = async () => {
      const newErrors: Record<string, string> = {};

      if (!equipment.name?.trim()) {
        newErrors.name = '请输入器具名称';
      } else if (
        !isPresetEquipmentNameAvailable(equipment.name, initialEquipment?.id) ||
        !(await isEquipmentNameAvailable(equipment.name, initialEquipment?.id))
      ) {
        newErrors.name = '器具名称已存在';
      }

      setErrors(newErrors);
      return Object.keys(newErrors).length === 0;
    };

    const submitForm = async () => {
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
            customPourAnimations: shouldShowPourAnimationControls
              ? processedAnimations
              : undefined,
            // 只有自定义器具保留杯型/阀门绘制数据，预设器具始终使用固定外观。
            customShapeSvg:
              shouldShowCustomShapeControls && cupShapeType === 'custom'
                ? equipment.customShapeSvg
                : '',
            customValveSvg:
              shouldShowCustomShapeControls && cupShapeType === 'custom'
                ? equipment.customValveSvg
                : '',
            customValveOpenSvg:
              shouldShowCustomShapeControls && cupShapeType === 'custom'
                ? equipment.customValveOpenSvg
                : '',
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

    // 处理表单提交
    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      await submitForm();
    };

    // 处理杯型绘制完成
    const handleDrawingComplete = (svg: string) => {
      if (svg && svg.trim() !== '') {
        // 更新equipment状态
        setEquipment(prev => ({
          ...prev,
          customShapeSvg: svg,
        }));
        setCupShapeType('custom');
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
    const handleValveDrawingComplete = (svgs: {
      closed?: string;
      open?: string;
    }) => {
      const closedSvg = svgs.closed?.trim();
      const openSvg = svgs.open?.trim();

      if (closedSvg || openSvg) {
        // 确保自定义阀门与杯型一起显示
        setEquipment(prev => {
          // 创建一个更新后的设备对象
          const updatedEquipment = {
            ...prev,
            ...(closedSvg ? { customValveSvg: closedSvg } : {}),
            ...(openSvg ? { customValveOpenSvg: openSvg } : {}),
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
          const nextDraftValveSvgs = {
            ...draftValveSvgs,
            ...(svgString.trim() ? { [valveEditMode]: svgString } : {}),
          };

          handleValveDrawingComplete(nextDraftValveSvgs);
          setDraftValveSvgs({});
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

    // 切换到绘图界面
    const handleShowDrawingCanvas = () => {
      hapticsUtils.light();
      setShowDrawingCanvas(true);
    };

    const saveCurrentValveDraft = () => {
      if (!canvasRef.current) return;

      const svgString = canvasRef.current.save();
      if (!svgString.trim()) return;

      setDraftValveSvgs(prev => ({
        ...prev,
        [valveEditMode]: svgString,
      }));
    };

    const handleCupShapeChange = (nextCupShapeType: CupShapeType) => {
      setCupShapeType(nextCupShapeType);
    };

    const handleCustomCupShapePreviewClick = () => {
      handleShowDrawingCanvas();
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

    const selectedPresetInfo = getEquipmentPreset(selectedPreset);
    const isEditingPresetEquipment = Boolean(
      initialEquipment?.id &&
      equipmentList.some(preset => preset.id === initialEquipment.id)
    );
    const canEditEquipmentType = !isEditingPresetEquipment;
    const shouldShowCustomShapeControls = selectedPreset === 'custom';
    const shouldShowPourAnimationControls = selectedPreset === 'custom';

    // 获取自定义杯型SVG
    const customShapeSvg = useMemo(() => {
      const svg =
        equipment.customShapeSvg || equipmentRef.current.customShapeSvg;
      return svg;
    }, [equipment.customShapeSvg]); // 只依赖于 equipment.customShapeSvg

    const activeCupReference = useMemo(
      () =>
        resolveCupReference({
          presetValue: selectedPreset,
          cupShapeType,
          customShapeSvg,
          defaultShapeIcon: selectedPresetInfo.defaultShapeIcon,
          hasValve: equipment.hasValve,
        }),
      [
        cupShapeType,
        customShapeSvg,
        equipment.hasValve,
        selectedPreset,
        selectedPresetInfo.defaultShapeIcon,
      ]
    );

    const activeCupReferenceSvg =
      activeCupReference?.kind === 'custom' ? activeCupReference.svg : '';

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
        return _svgToAnimationFrames(
          currentEditingAnimation.customAnimationSvg
        );
      }
      return [{ id: 'frame-1', svgData: '' }];
    }, [currentEditingAnimation]);

    // 生成编辑器key - 添加 showPourAnimationCanvas 作为依赖
    const editorKey = useMemo(
      () =>
        currentEditingAnimation
          ? `animation-editor-${currentEditingAnimation.id}-${activeCupReferenceSvg.length}-${showPourAnimationCanvas}`
          : '',
      [
        activeCupReferenceSvg.length,
        currentEditingAnimation,
        showPourAnimationCanvas,
      ]
    );

    const drawerChrome = useMemo<EquipmentFormDrawerChrome>(() => {
      if (activeDrawerPage === 'equipment-picker') {
        return {
          key: 'equipment-picker',
          title: '选择器具',
          doneDisabled: false,
          canGoBack: true,
        };
      }

      if (showPourAnimationCanvas && currentEditingAnimation) {
        return {
          key: `animation-${currentEditingAnimation.id}`,
          title: currentEditingAnimation.id.startsWith('system-')
            ? `编辑${currentEditingAnimation.name}动画`
            : currentEditingAnimation.customAnimationSvg
              ? '编辑注水动画'
              : '添加注水动画',
          doneDisabled: !currentEditingAnimation.name.trim(),
          canGoBack: true,
        };
      }

      if (showDrawingCanvas) {
        return {
          key: 'drawing',
          title: '绘制自定义杯型',
          doneDisabled: false,
          canGoBack: true,
        };
      }

      if (showValveDrawingCanvas) {
        return {
          key: `valve-${valveEditMode}`,
          title:
            valveEditMode === 'closed'
              ? '绘制阀门关闭状态'
              : '绘制阀门开启状态',
          doneDisabled: false,
          canGoBack: true,
        };
      }

      return {
        key: 'form',
        title: initialEquipment ? '编辑器具' : '添加器具',
        doneDisabled: !equipment.name?.trim() || isSubmitting,
        canGoBack: false,
      };
    }, [
      activeDrawerPage,
      currentEditingAnimation,
      equipment.name,
      initialEquipment,
      isSubmitting,
      showDrawingCanvas,
      showPourAnimationCanvas,
      showValveDrawingCanvas,
      valveEditMode,
    ]);

    useEffect(() => {
      onChromeChange?.(drawerChrome);
    }, [drawerChrome, onChromeChange]);

    const handleDrawerBack = () => {
      if (
        showPourAnimationCanvas ||
        showDrawingCanvas ||
        showValveDrawingCanvas
      ) {
        modalHistory.back();
        return;
      }

      onCancel();
    };

    const handleDrawerDone = () => {
      if (showPourAnimationCanvas) {
        handleSavePourAnimation();
        return;
      }

      if (showDrawingCanvas) {
        handleSaveDrawing();
        return;
      }

      if (showValveDrawingCanvas) {
        handleSaveValveDrawing();
        return;
      }

      void submitForm();
    };

    useImperativeHandle(ref, () => ({
      back: handleDrawerBack,
      done: handleDrawerDone,
    }));

    // 渲染注水动画画布
    const renderPourAnimationCanvas = useCallback(() => {
      if (!currentEditingAnimation) return null;

      return (
        <div>
          <SettingSection
            title="注水方式名称"
            footer={
              currentEditingAnimation.isSystemDefault
                ? '系统注水方式只能调整动画，名称不可修改。'
                : '用于在注水方式卡片中显示，建议简短明确。'
            }
          >
            <SettingRow vertical>
              <input
                type="text"
                value={currentEditingAnimation.name}
                onChange={handlePourAnimationNameChange}
                className="w-full bg-transparent text-sm leading-none text-neutral-900 outline-none placeholder:text-neutral-400 read-only:text-neutral-500 dark:text-neutral-50 dark:placeholder:text-neutral-500 dark:read-only:text-neutral-400"
                placeholder="例如：中心注水"
                readOnly={currentEditingAnimation.isSystemDefault}
                maxLength={20}
              />
            </SettingRow>
          </SettingSection>

          <SettingSection
            title="动画帧"
            contentShape="none"
            footer="在画布上绘制水流轨迹，使用帧缩略图切换帧，多帧会按顺序播放。"
          >
            <div
              ref={canvasContainerRef}
              className="mx-auto w-full overflow-hidden rounded-xl"
            >
              {canvasSize > 0 && (
                <div className="animation-editor-custom">
                  <style jsx>{`
                    .animation-editor-custom
                      :global(
                        .flex.flex-col.space-y-2 > div.flex.justify-between
                      ) {
                      display: none;
                    }
                    .animation-editor-custom
                      :global(.flex.flex-col.space-y-2 > div.mt-2) {
                      display: none;
                    }
                  `}</style>
                  <AnimationEditor
                    ref={animationEditorRef}
                    width={canvasSize}
                    height={canvasSize}
                    initialFrames={initialFrames}
                    referenceImages={referenceImageUrls}
                    referenceSvg={activeCupReferenceSvg}
                    key={editorKey}
                  />
                </div>
              )}
            </div>
          </SettingSection>

          <SettingSection contentShape="none">
            <div className="flex justify-between">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    if (animationEditorRef.current) {
                      animationEditorRef.current.setStrokeWidth(
                        strokeWidth - 1
                      );
                      setStrokeWidth(prev => Math.max(1, prev - 1));
                    }
                  }}
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-neutral-200/50 bg-white dark:border-neutral-700 dark:bg-neutral-800"
                  aria-label="减小线条粗细"
                >
                  <Minus className="size-4" strokeWidth={2.2} />
                </button>

                <div className="flex h-10 w-10 items-center justify-center rounded-full border border-neutral-200/50 bg-white dark:border-neutral-700 dark:bg-neutral-800">
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
                      animationEditorRef.current.setStrokeWidth(
                        strokeWidth + 1
                      );
                      setStrokeWidth(prev => Math.min(10, prev + 1));
                    }
                  }}
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-neutral-200/50 bg-white dark:border-neutral-700 dark:bg-neutral-800"
                  aria-label="增加线条粗细"
                >
                  <Plus className="size-4" strokeWidth={2.2} />
                </button>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleTogglePlayback}
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-neutral-200/50 bg-white dark:border-neutral-700 dark:bg-neutral-800"
                  aria-label={isPlaying ? '暂停' : '播放'}
                >
                  {isPlaying ? (
                    <Pause className="size-4" strokeWidth={2.2} />
                  ) : (
                    <Play className="size-4" strokeWidth={2.2} />
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => animationEditorRef.current?.undo()}
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-neutral-200/50 bg-white dark:border-neutral-700 dark:bg-neutral-800"
                  aria-label="撤销"
                >
                  <RotateCcw className="size-4" strokeWidth={2.2} />
                </button>

                <button
                  type="button"
                  onClick={handleDeleteCurrentFrame}
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-neutral-200/50 bg-white dark:border-neutral-700 dark:bg-neutral-800"
                  aria-label="删除帧"
                >
                  <Trash2 className="size-4" strokeWidth={2.2} />
                </button>
              </div>
            </div>
          </SettingSection>
        </div>
      );
    }, [
      strokeWidth,
      handleTogglePlayback,
      handleDeleteCurrentFrame,
      currentEditingAnimation,
      canvasSize,
      activeCupReferenceSvg,
      editorKey,
      handlePourAnimationNameChange,
      initialFrames,
      isPlaying,
      referenceImageUrls,
    ]);

    // 渲染绘图界面
    const renderDrawingCanvas = () => (
      <div className="px-6 pb-5">
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
              className="flex h-10 w-10 items-center justify-center rounded-full border border-neutral-200/50 bg-white dark:border-neutral-700 dark:bg-neutral-800"
              aria-label="减小线条粗细"
            >
              <span className="text-lg font-medium">−</span>
            </button>

            <div className="flex h-10 w-10 items-center justify-center rounded-full border border-neutral-200/50 bg-white dark:border-neutral-700 dark:bg-neutral-800">
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
              className="flex h-10 w-10 items-center justify-center rounded-full border border-neutral-200/50 bg-white dark:border-neutral-700 dark:bg-neutral-800"
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
              className="flex h-10 w-10 items-center justify-center rounded-full border border-neutral-200/50 bg-white dark:border-neutral-700 dark:bg-neutral-800"
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
              className="flex h-10 w-10 items-center justify-center rounded-full border border-neutral-200/50 bg-white dark:border-neutral-700 dark:bg-neutral-800"
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
              className="flex h-10 w-10 items-center justify-center rounded-full border border-neutral-200/50 bg-white dark:border-neutral-700 dark:bg-neutral-800"
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
      </div>
    );

    // 渲染阀门绘图界面
    const renderValveDrawingCanvas = () => (
      <div className="px-6 pb-5">
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
                  ? draftValveSvgs.closed || equipment.customValveSvg
                  : draftValveSvgs.open || equipment.customValveOpenSvg
              }
              showReference={showReference}
              // 设置参考图像的优先级：
              // 1. customReferenceSvg: 器具SVG (作为主背景)
              // 2. referenceSvg: 另一状态的阀门SVG (作为参考)
              _customReferenceSvg={equipment.customShapeSvg || undefined}
              // 另一状态的阀门作为参考
              referenceSvg={
                valveEditMode === 'closed'
                  ? draftValveSvgs.open || equipment.customValveOpenSvg // 如果当前是绘制关闭状态，则显示开启状态作为参考
                  : draftValveSvgs.closed || equipment.customValveSvg // 如果当前是绘制开启状态，则显示关闭状态作为参考
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
              className="flex h-10 w-10 items-center justify-center rounded-full border border-neutral-200/50 bg-white dark:border-neutral-700 dark:bg-neutral-800"
              aria-label="减小线条粗细"
            >
              <span className="text-lg font-medium">−</span>
            </button>

            <div className="flex h-10 w-10 items-center justify-center rounded-full border border-neutral-200/50 bg-white dark:border-neutral-700 dark:bg-neutral-800">
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
              className="flex h-10 w-10 items-center justify-center rounded-full border border-neutral-200/50 bg-white dark:border-neutral-700 dark:bg-neutral-800"
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
                saveCurrentValveDraft();
                // 切换到另一个状态
                setValveEditMode(newMode);
              }}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-neutral-200/50 bg-white dark:border-neutral-700 dark:bg-neutral-800"
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
              className="flex h-10 w-10 items-center justify-center rounded-full border border-neutral-200/50 bg-white dark:border-neutral-700 dark:bg-neutral-800"
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
              className="flex h-10 w-10 items-center justify-center rounded-full border border-neutral-200/50 bg-white dark:border-neutral-700 dark:bg-neutral-800"
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
              className="flex h-10 w-10 items-center justify-center rounded-full border border-neutral-200/50 bg-white dark:border-neutral-700 dark:bg-neutral-800"
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
      </div>
    );

    const renderPourBaseLayer = () => {
      if (!activeCupReference) {
        return null;
      }

      return (
        <div className="absolute inset-0 flex items-center justify-center opacity-60">
          {activeCupReference.kind === 'custom' ? (
            <div
              className="custom-cup-shape outline-only flex h-full w-full items-center justify-center"
              dangerouslySetInnerHTML={{
                __html: activeCupReference.svg.replace(
                  /<svg/,
                  '<svg width="100%" height="100%"'
                ),
              }}
            />
          ) : (
            <div className="relative h-full w-full">
              <Image
                src={activeCupReference.iconUrl}
                alt="杯型背景"
                fill
                className="object-contain invert-0 dark:invert"
                sizes="(max-width: 768px) 100vw, 300px"
                quality={85}
              />
              {activeCupReference.hasValve && (
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
          )}
        </div>
      );
    };

    const renderPourAnimationPreview = (animation: CustomPourAnimation) => (
      <div className="relative h-full w-full">
        {renderPourBaseLayer()}
        {animation.isSystemDefault ? (
          <div className="absolute inset-0 flex items-center justify-center">
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
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            {(() => {
              const hasFrames =
                animation.frames &&
                Array.isArray(animation.frames) &&
                animation.frames.length > 0;
              const frameIndex = (previewFrameIndexes[animation.id] || 1) - 1;

              if (
                hasFrames &&
                frameIndex >= 0 &&
                frameIndex < animation.frames!.length
              ) {
                const svgData = animation.frames![frameIndex].svgData;

                if (svgData && svgData.trim() !== '') {
                  return (
                    <div
                      className="custom-cup-shape outline-only flex h-full w-full items-center justify-center"
                      dangerouslySetInnerHTML={{
                        __html: svgData.replace(
                          /<svg/,
                          '<svg width="100%" height="100%"'
                        ),
                      }}
                    />
                  );
                }
              }

              if (
                animation.customAnimationSvg &&
                animation.customAnimationSvg.trim() !== ''
              ) {
                return (
                  <div
                    className="custom-cup-shape outline-only flex h-full w-full items-center justify-center"
                    dangerouslySetInnerHTML={{
                      __html: animation.customAnimationSvg.replace(
                        /<svg/,
                        '<svg width="100%" height="100%"'
                      ),
                    }}
                  />
                );
              }

              return (
                <div className="px-3 text-center text-xs text-neutral-400 dark:text-neutral-500">
                  预览注水动画
                </div>
              );
            })()}
          </div>
        )}
      </div>
    );

    const renderEquipmentPickerContent = () => (
      <div>
        <SettingSection contentShape="card">
          <SettingVerticalSelector
            ariaLabel="器具类型"
            value={selectedPreset}
            options={PRESET_OPTIONS}
            onChange={handlePresetSelect}
            indicator="circle"
          />
        </SettingSection>
      </div>
    );

    // 渲染主要表单内容
    const renderFormContent = () => (
      <div>
        <SettingSection title="器具名称">
          <SettingRow vertical>
            <input
              type="text"
              value={equipment.name || ''}
              onChange={e => handleChange('name', e.target.value)}
              className="w-full bg-transparent text-sm leading-none text-neutral-900 outline-none placeholder:text-neutral-400 dark:text-neutral-50 dark:placeholder:text-neutral-500"
              placeholder="输入器具名称"
              autoComplete="off"
            />
            {errors.name && (
              <p className="mt-2 text-xs text-red-500 dark:text-red-400">
                {errors.name}
              </p>
            )}
          </SettingRow>
        </SettingSection>

        <SettingSection title="器具">
          {canEditEquipmentType ? (
            <button
              type="button"
              onClick={onOpenEquipmentPicker}
              className="flex w-full cursor-pointer items-center gap-3 px-3.5 py-3.5 text-left transition active:bg-black/5 dark:active:bg-white/5"
            >
              <span className="min-w-0 flex-1 text-sm font-medium text-neutral-900 dark:text-neutral-100">
                类型
              </span>
              <span className="shrink-0 text-sm font-medium text-neutral-500 dark:text-neutral-400">
                {selectedPresetInfo.label}
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-neutral-400 dark:text-neutral-500" />
            </button>
          ) : (
            <SettingRow label="类型">
              <span className="text-sm font-medium text-neutral-500 dark:text-neutral-400">
                {selectedPresetInfo.label}
              </span>
            </SettingRow>
          )}
        </SettingSection>

        {shouldShowCustomShapeControls && (
          <SettingSection title="杯型" contentShape="none">
            <SettingCardSelector<CupShapeType>
              ariaLabel="杯型"
              value={cupShapeType}
              options={[
                ...(selectedPreset === 'custom'
                  ? []
                  : [{ value: 'default' as const, label: '默认杯型' }]),
                {
                  value: 'custom' as const,
                  label: equipment.customShapeSvg ? '自定义杯型' : '添加杯型',
                },
              ]}
              onChange={handleCupShapeChange}
              getPreviewAction={option =>
                option.value === 'custom'
                  ? {
                      ariaLabel: equipment.customShapeSvg
                        ? '编辑杯型'
                        : '绘制杯型',
                      onClick: handleCustomCupShapePreviewClick,
                    }
                  : undefined
              }
              renderPreview={option => {
                if (option.value === 'custom') {
                  return equipment.customShapeSvg ? (
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
                      className="text-neutral-400 dark:text-neutral-500"
                    >
                      <path
                        d="M12 5V19M5 12H19"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  );
                }

                return (
                  <div className="relative h-3/4 w-3/4">
                    <Image
                      src={
                        selectedPresetInfo.defaultShapeIcon ||
                        '/images/icons/ui/v60-base.svg'
                      }
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
                );
              }}
            />
          </SettingSection>
        )}

        {shouldShowPourAnimationControls && (
          <SettingSection title="注水方式" contentShape="none">
            <div className="grid grid-cols-2 gap-3">
              {customPourAnimations.map(animation => (
                <div
                  key={animation.id}
                  className="flex min-w-0 flex-col rounded-lg bg-neutral-100 p-2.5 text-left dark:bg-neutral-800/80"
                >
                  <div className="mb-2 flex min-h-5 min-w-0 items-center gap-2">
                    <span className="min-w-0 flex-1 truncate text-sm leading-none font-medium text-neutral-800 dark:text-neutral-200">
                      {animation.name || '未命名注水方式'}
                    </span>
                    {animation.isSystemDefault && (
                      <span className="shrink-0 rounded-full bg-neutral-200 px-1.5 py-0.5 text-[10px] leading-none font-medium text-neutral-500 dark:bg-neutral-700 dark:text-neutral-300">
                        系统
                      </span>
                    )}
                    {!animation.isSystemDefault && (
                      <button
                        type="button"
                        onClick={() => handleEditPourAnimation(animation)}
                        className="flex size-5 shrink-0 items-center justify-center rounded-full text-neutral-400 focus-visible:ring-2 focus-visible:ring-neutral-400/60 focus-visible:outline-none dark:text-neutral-500 dark:focus-visible:ring-neutral-500/70"
                        aria-label={`编辑${animation.name || '注水方式'}`}
                      >
                        <Pencil className="size-3.5" strokeWidth={2.2} />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleDeletePourAnimation(animation.id)}
                      className="flex size-5 shrink-0 items-center justify-center rounded-full text-neutral-400 focus-visible:ring-2 focus-visible:ring-neutral-400/60 focus-visible:outline-none dark:text-neutral-500 dark:focus-visible:ring-neutral-500/70"
                      aria-label={`删除${animation.name || '注水方式'}`}
                    >
                      <Trash2 className="size-3.5" strokeWidth={2.2} />
                    </button>
                  </div>
                  {!animation.isSystemDefault ? (
                    <button
                      type="button"
                      onClick={() => handleEditPourAnimation(animation)}
                      className="flex aspect-square w-full cursor-pointer items-center justify-center overflow-hidden rounded-md bg-neutral-50 focus-visible:ring-2 focus-visible:ring-neutral-400/60 focus-visible:outline-none dark:bg-neutral-900/80 dark:focus-visible:ring-neutral-500/70"
                      aria-label={`编辑${animation.name || '注水方式'}预览`}
                    >
                      {renderPourAnimationPreview(animation)}
                    </button>
                  ) : (
                    <span className="flex aspect-square w-full items-center justify-center overflow-hidden rounded-md bg-neutral-50 dark:bg-neutral-900/80">
                      {renderPourAnimationPreview(animation)}
                    </span>
                  )}
                </div>
              ))}

              <div className="flex min-w-0 flex-col rounded-lg bg-neutral-100 p-2.5 text-left dark:bg-neutral-800/80">
                <div className="mb-2 flex min-h-5 min-w-0 items-center gap-2">
                  <span className="min-w-0 flex-1 truncate text-sm leading-none font-medium text-neutral-800 dark:text-neutral-200">
                    添加注水方式
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleAddPourAnimation}
                  className="flex aspect-square w-full cursor-pointer items-center justify-center overflow-hidden rounded-md bg-neutral-50 focus-visible:ring-2 focus-visible:ring-neutral-400/60 focus-visible:outline-none dark:bg-neutral-900/80 dark:focus-visible:ring-neutral-500/70"
                  aria-label="添加注水方式"
                >
                  <div className="relative h-full w-full">
                    {renderPourBaseLayer()}
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Plus
                        className="size-6 text-neutral-400 dark:text-neutral-500"
                        strokeWidth={2}
                      />
                    </div>
                  </div>
                </button>
              </div>
            </div>
          </SettingSection>
        )}

        {onImport && (
          <SettingSection title="操作">
            <button
              type="button"
              onClick={onImport}
              className="flex w-full cursor-pointer items-center px-3.5 py-3.5 text-left text-sm font-medium text-neutral-600 transition active:bg-black/5 dark:text-neutral-300 dark:active:bg-white/5"
            >
              导入器具
            </button>
          </SettingSection>
        )}
      </div>
    );

    return (
      <form onSubmit={handleSubmit}>
        <AnimatePresence mode="wait">
          {showPourAnimationCanvas
            ? renderPourAnimationCanvas()
            : showDrawingCanvas
              ? renderDrawingCanvas()
              : showValveDrawingCanvas
                ? renderValveDrawingCanvas()
                : activeDrawerPage === 'equipment-picker'
                  ? renderEquipmentPickerContent()
                  : renderFormContent()}
        </AnimatePresence>
      </form>
    );
  }
);

CustomEquipmentForm.displayName = 'CustomEquipmentForm';

export default CustomEquipmentForm;
