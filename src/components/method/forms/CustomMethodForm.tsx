'use client'

import React, { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowRight } from 'lucide-react'
import { type Method, CustomEquipment } from '@/lib/core/config'
import { formatGrindSize } from '@/lib/utils/grindUtils'
import { isEspressoMachine, getDefaultPourType, getPourTypeName } from '@/lib/utils/equipmentUtils'
import { SettingsOptions, defaultSettings } from '@/components/settings/Settings'
import { Storage } from '@/lib/core/storage'
import { 
    Steps, 
    NameStep, 
    ParamsStep, 
    StagesStep, 
    CompleteStep,
    MethodWithStages, 
    Stage
} from './components'
import type { Step } from './components'


// 数据规范化辅助函数
const normalizeMethodData = (method: any): MethodWithStages => {
    const normalizedMethod = { ...method };
    
    // 确保params存在
    if (!normalizedMethod.params) {
        normalizedMethod.params = {
            coffee: '',
            water: '',
            ratio: '',
            grindSize: '',
            temp: '',
            videoUrl: '',
            stages: []
        };
    } else {
        // 规范化params对象
        normalizedMethod.params = { ...normalizedMethod.params };
        
        // 确保水量、咖啡粉量是字符串格式
        ['water', 'coffee'].forEach(field => {
            if (normalizedMethod.params[field] !== undefined) {
                if (typeof normalizedMethod.params[field] === 'number') {
                    normalizedMethod.params[field] = `${normalizedMethod.params[field]}g`;
                } else if (typeof normalizedMethod.params[field] === 'string' && !normalizedMethod.params[field].endsWith('g')) {
                    normalizedMethod.params[field] = `${normalizedMethod.params[field]}g`;
                }
            }
        });
        
        // 确保温度是字符串格式
        if (normalizedMethod.params.temp !== undefined) {
            if (typeof normalizedMethod.params.temp === 'number') {
                normalizedMethod.params.temp = `${normalizedMethod.params.temp}°C`;
            } else if (typeof normalizedMethod.params.temp === 'string' && !normalizedMethod.params.temp.endsWith('°C')) {
                normalizedMethod.params.temp = `${normalizedMethod.params.temp}°C`;
            }
        }
        
        // 规范化每个阶段的水量
        if (Array.isArray(normalizedMethod.params.stages)) {
            normalizedMethod.params.stages = normalizedMethod.params.stages.map((stage: Record<string, any>) => {
                const normalizedStage = { ...stage };
                if (normalizedStage.water !== undefined) {
                    if (typeof normalizedStage.water === 'number') {
                        normalizedStage.water = `${normalizedStage.water}g`;
                    } else if (typeof normalizedStage.water === 'string' && !normalizedStage.water.endsWith('g')) {
                        normalizedStage.water = `${normalizedStage.water}g`;
                    }
                }
                return normalizedStage;
            });
        }
    }
    
    return normalizedMethod as MethodWithStages;
};

// 使用从 types.ts 导入的类型定义
// MethodWithStages 替代 _Method
// Stage 替代 _Stage

// 定义步骤类型
// type Step = 'name' | 'params' | 'stages' | 'complete'; // 已在Steps.tsx中定义并导出

// 修改组件 props 类型
interface CustomMethodFormProps {
    initialMethod?: MethodWithStages;
    customEquipment: CustomEquipment;
    onSave: (method: MethodWithStages) => void;
    onBack: () => void;
}

/**
 * 自定义冲泡方案表单组件
 */
const CustomMethodForm: React.FC<CustomMethodFormProps> = ({
  initialMethod,
  customEquipment,
  onSave,
  onBack,
}) => {
  // ===== 状态管理 =====
  const [currentStep, setCurrentStep] = useState<Step>('name');
  const [editingCumulativeTime, setEditingCumulativeTime] = useState<{index: number, value: string} | null>(null);
  const [editingCumulativeWater, setEditingCumulativeWater] = useState<{index: number, value: string} | null>(null);
  const [showWaterTooltip, setShowWaterTooltip] = useState<number | null>(null);
  
  // ===== DOM引用 =====
  const inputRef = useRef<HTMLInputElement>(null);
  const stagesContainerRef = useRef<HTMLDivElement>(null);
  const newStageRef = useRef<HTMLDivElement>(null);
  
  // ===== 工具函数 =====
  
  // 初始化新方法
  const initializeNewMethod = (): MethodWithStages => {
    const isCustomPreset = customEquipment.animationType === 'custom';
    const isEspresso = isEspressoMachine(customEquipment);

    // 自定义预设类型 - 不设置初始步骤
    if (isCustomPreset) {
      return {
        name: '',
        params: {
          coffee: '15g',
          water: '225g',
          ratio: '1:15',
          grindSize: '中细',
          temp: '92°C',
          videoUrl: '',
          stages: [],
        },
      };
    }
    
    // 意式机类型
    if (isEspresso) {
      return {
        name: '',
        params: {
          coffee: '18g',
          water: '36g',
          ratio: '1:2',
          grindSize: '细',
          temp: '93°C',
          videoUrl: '',
          stages: [{
            time: 25,
            label: '萃取浓缩',
            water: '36g',
            detail: '标准意式浓缩',
            pourType: 'extraction'
          }],
        },
      };
    }

    // 手冲类型 - 获取默认注水方式
    const defaultPourType = getDefaultPourType(customEquipment);
    
    // 创建初始步骤
    const initialStage: Stage = {
      time: 25,
      pourTime: 10,
      label: '焖蒸',
      water: '30g',
      detail: '使咖啡粉充分吸水并释放气体，提升萃取效果',
      pourType: defaultPourType,
      ...(customEquipment.hasValve ? { valveStatus: 'closed' as 'closed' | 'open' } : {})
    };

    return {
      name: '',
      params: {
        coffee: '15g',
        water: '225g',
        ratio: '1:15',
        grindSize: '中细',
        temp: '92°C',
        videoUrl: '',
        stages: [initialStage],
      },
    };
  };
  
  // 初始化方法状态
  const [method, setMethod] = useState<MethodWithStages>(() => {
    if (initialMethod) {
      // 使用初始方法
      const normalizedMethod = normalizeMethodData(initialMethod);
      
      // 处理聪明杯标签特殊情况
      if (customEquipment.hasValve && normalizedMethod.params.stages) {
        normalizedMethod.params.stages = normalizedMethod.params.stages.map(stage => ({
          ...stage,
          label: stage.label.replace(/\s*\[开阀\]|\s*\[关阀\]/g, '').trim()
        }));
      }
      
      return normalizedMethod;
    }

    // 创建新方法
    return initializeNewMethod();
    });
  
  // 获取设置
  const [localSettings, setLocalSettings] = useState<SettingsOptions>(defaultSettings);

  // ===== 步骤配置 =====
  const steps: { id: Step; label: string }[] = [
    { id: 'name', label: '方案名称' },
    { id: 'params', label: '基本参数' },
    { id: 'stages', label: '冲泡步骤' },
    { id: 'complete', label: '完成' }
  ];

  // ===== 基本功能函数 =====
  const getCurrentStepIndex = () => steps.findIndex(step => step.id === currentStep);
  
  const handleNextStep = () => {
    const currentIndex = getCurrentStepIndex();
    if (currentIndex < steps.length - 1) {
      setCurrentStep(steps[currentIndex + 1].id);
    }
  };
  
  const handleBack = () => {
    const currentIndex = getCurrentStepIndex();
    if (currentIndex > 0) {
      setCurrentStep(steps[currentIndex - 1].id);
    } else {
      onBack();
    }
  };
  
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };
  
  const formatWater = (water: string | number | undefined) => {
    if (water === undefined || water === null || water === '') return '0g';
    if (typeof water === 'number') return `${water}g`;
    return water.endsWith('g') ? water : `${water}g`;
  };
  
  // ===== 注水步骤辅助函数 =====
  const getDefaultStageLabel = (pourType: string) => {
    const isCustomPreset = customEquipment.animationType === 'custom';
    
    // 特殊情况处理
    if (isCustomPreset && pourType === 'other') return '';
    
    // 检查自定义注水动画
    if (customEquipment.customPourAnimations) {
      // 先检查ID匹配
      const idMatch = customEquipment.customPourAnimations.find(anim => anim.id === pourType);
      if (idMatch) return idMatch.name;
      
      // 再检查pourType匹配
      const typeMatch = customEquipment.customPourAnimations.find(anim => anim.pourType === pourType);
      if (typeMatch?.name) return typeMatch.name;
    }
    
    // 默认标签
    switch (pourType) {
      case 'circle': return '绕圈注水';
      case 'center': return '中心注水';
      case 'ice': return '添加冰块';
      case 'other': return '';
      default: return '注水';
    }
  };

  const getDefaultStageDetail = (pourType: string) => {
    const isCustomPreset = customEquipment.animationType === 'custom';
    
    // 特殊情况处理
    if (isCustomPreset && pourType === 'other') return '';
    
    // 检查自定义注水动画
    if (customEquipment.customPourAnimations) {
      const customAnimation = customEquipment.customPourAnimations.find(anim => anim.id === pourType);
      if (customAnimation) return `使用${customAnimation.name}注水`;
    }
    
    // 默认详情
    switch (pourType) {
      case 'circle': return '中心向外缓慢画圈注水，均匀萃取咖啡风味';
      case 'center': return '中心定点注水，降低萃取率';
      case 'ice': return '添加冰块，降低温度进行冷萃';
      case 'other': return '';
      default: return '注水';
    }
  };
  
  // ===== 副作用 =====
  
  // 加载设置
  useEffect(() => {
    const loadSettings = async () => {
      const savedSettings = await Storage.get('brewGuideSettings');
      if (!savedSettings) return;
      
      try {
        const parsedSettings = JSON.parse(savedSettings) as SettingsOptions;
        // 确保必要设置存在
        if (!parsedSettings.layoutSettings) {
          parsedSettings.layoutSettings = defaultSettings.layoutSettings;
        }
        if (!parsedSettings.language) {
          parsedSettings.language = defaultSettings.language;
        }
        setLocalSettings(parsedSettings);
      } catch (e) {
        console.error("Failed to parse settings from storage:", e);
      }
    };
    
    loadSettings();
  }, []);

  // 自动聚焦输入框
  useEffect(() => {
    if (currentStep === 'name' && inputRef.current) {
      inputRef.current.focus();
    }
  }, [currentStep]);
  
  // 监听器具变化，重新初始化方法
  useEffect(() => {
    // 忽略初始加载时的处理（已在初始 state 中处理）
    // 或者已经有初始方案的情况（编辑现有方案）
    if (initialMethod) return;
    
    // 重新初始化方法
    setMethod(initializeNewMethod());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customEquipment.animationType, customEquipment.hasValve, customEquipment.customPourAnimations, initialMethod]); // 监听器具相关属性的变化
  
  // ===== 数据计算函数 =====
  
  // 计算总冲泡时间
  const calculateTotalTime = () => {
    if (method.params.stages.length === 0) return 0;
    
    // 检查是否为意式咖啡方案
    const isEspresso = isEspressoMachine(customEquipment);
    
    if (isEspresso) {
      // 意式咖啡只计算萃取步骤的时间
      const extractionStage = method.params.stages.find(stage => stage.pourType === 'extraction');
      return extractionStage?.time || 0;
    } else {
      // 常规方案返回最后一个有时间的步骤的时间
      for (let i = method.params.stages.length - 1; i >= 0; i--) {
        if (method.params.stages[i].time !== undefined) {
          return method.params.stages[i].time as number;
        }
      }
    }
    
    return 0;
  };
  
  // 计算当前已使用的水量
  const calculateCurrentWater = () => {
    if (method.params.stages.length === 0) return 0;
    
    // 找到最后一个有水量的步骤
    for (let i = method.params.stages.length - 1; i >= 0; i--) {
      const stage = method.params.stages[i];
      if (stage.water) {
        if (typeof stage.water === 'number') {
          return stage.water;
        } else if (typeof stage.water === 'string') {
          return parseInt(stage.water.replace('g', ''));
        }
      }
    }
    
    return 0;
  };
  
  // ===== 事件处理函数 =====
  
  // 处理步骤变更
  const handleStageChange = (index: number, field: keyof Stage, value: string | number) => {
    const newStages = [...method.params.stages];
    const stage = { ...newStages[index] };

    // 水量特殊处理 - 更新总水量
    if (field === 'water') {
      const oldWater = stage.water ? parseInt(stage.water) : 0;
      const newWater = typeof value === 'string' && value ? parseInt(value) : 0;
      const diff = newWater - oldWater;

      if (method.params.water) {
        const totalWater = parseInt(method.params.water);
        setMethod({
          ...method,
          params: {
            ...method.params,
            water: `${totalWater + diff}g`,
          },
        });
      }
    }

    // 根据字段类型处理值
    if (field === 'time' || field === 'pourTime') {
      // 数值类型
      stage[field] = value as number;
      // 确保注水时间不超过总时间
      if (field === 'pourTime' && stage.time !== undefined && (stage.pourTime ?? 0) > stage.time) {
        stage.pourTime = stage.time;
      }
    } else if (field === 'label' || field === 'detail' || field === 'water') {
      // 字符串类型
      if (field === 'water' && typeof value === 'string' && value) {
        stage[field] = `${value}g`;
      } else {
        stage[field] = value as string;
      }
    } else if (field === 'pourType') {
      // 注水类型
      stage[field] = value as string;
    }

    // 更新method状态
    newStages[index] = stage;
    setMethod({
      ...method,
      params: {
        ...method.params,
        stages: newStages,
      },
    });
  };

    const addStage = () => {
        // 获取器具类型
        const equipmentType = customEquipment.animationType;
        const isEspresso = isEspressoMachine(customEquipment);
        
        // 确定默认注水方式
        let defaultPourType = getDefaultPourType(customEquipment);
        
        // 对于意式机，检查是否已有步骤，有则新步骤默认为"饮料"类型
        if (isEspresso && method.params.stages.length > 0) {
            defaultPourType = 'beverage';
        }
        
        // 根据器具类型和阶段设置默认时间
        const defaultTime = (() => {
            if (isEspresso) {
                // 意式咖啡机：只有萃取类型有时间，饮料类型时间为0
                return defaultPourType === 'extraction' ? 25 : 0;
            } else if (method.params.stages.length === 0) {
                return 30; // 第一个阶段默认30秒
            } else {
                // 获取上一个阶段的时间
                const lastStage = method.params.stages[method.params.stages.length - 1];
                return (lastStage.time || 0) + 30; // 默认比上一阶段多30秒
            }
        })();
            
        // 创建新阶段
            const newStage: Stage = {
            time: defaultTime,
            // 当是意式机且为饮料类型时，不自动设置标签名称，留空让用户自行填写
            // 非意式机则使用默认的步骤名称
            label: isEspresso 
                ? (defaultPourType === 'beverage' ? '' : getPourTypeName(defaultPourType)) 
                : getDefaultStageLabel(defaultPourType),
                water: '',
                // 非意式机设置默认的详细说明
                detail: isEspresso ? '' : getDefaultStageDetail(defaultPourType),
            pourType: defaultPourType,
        };
        
        // 为意式机和非意式机配置特殊属性
        if (isEspresso) {
            // 如果是饮料类型，清除时间
            if (defaultPourType !== 'extraction') {
                newStage.time = 0;
                newStage.pourTime = undefined;
            }
        } else {
            // 非意式机默认添加pourTime
            newStage.pourTime = 10;
        }
        
        // 更新方法
            setMethod({
                ...method,
                params: {
                    ...method.params,
                    stages: [...method.params.stages, newStage],
                },
            });

        // 使用setTimeout确保DOM已更新后再滚动
        setTimeout(() => {
            // 首先尝试使用直接引用的方式滚动到新步骤
            if (newStageRef.current) {
                newStageRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
                
                // 额外向上滚动一些距离，确保底部阴影不会遮挡新添加的步骤
                setTimeout(() => {
                    const container = stagesContainerRef.current?.parentElement;
                    if (container) {
                        container.scrollTop += 20; // 向下额外滚动20px，确保新步骤完全可见
                    }
                }, 300);
            } 
            // 如果没有直接引用，则尝试使用容器的最后一个子元素
            else if (stagesContainerRef.current) {
                const newStageElement = stagesContainerRef.current.lastElementChild as HTMLElement;
                if (newStageElement) {
                    newStageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    
                    // 额外向上滚动一些距离，确保底部阴影不会遮挡新添加的步骤
                    setTimeout(() => {
                        const container = stagesContainerRef.current?.parentElement;
                        if (container) {
                            container.scrollTop += 20; // 向下额外滚动20px，确保新步骤完全可见
                        }
                    }, 300);
                }
            }
        }, 100);
    }

    const removeStage = (index: number) => {
        const newStages = [...method.params.stages]
        newStages.splice(index, 1)
        setMethod({
            ...method,
            params: {
                ...method.params,
                stages: newStages,
            },
        })
    }

    const handleSubmit = () => {
        // 创建一个方法的深拷贝，以便修改
        const finalMethod = JSON.parse(JSON.stringify(method)) as MethodWithStages;

        // 如果是聪明杯，将阀门状态添加到步骤名称中
        if (customEquipment.hasValve && finalMethod.params.stages) {
            finalMethod.params.stages = finalMethod.params.stages.map(stage => {
                if (stage.valveStatus) {
                    const valveStatusText = stage.valveStatus === 'open' ? '[开阀]' : '[关阀]';
                    // 确保没有重复添加
                    const baseLabel = stage.label.replace(/\s*\[开阀\]|\s*\[关阀\]/g, '').trim();
                    return {
                        ...stage,
                        label: `${valveStatusText}${baseLabel}`.trim()
                    };
                }
                return stage;
            });
        }

        // 保存意式机饮料名称到localStorage
        if (isEspressoMachine(customEquipment)) {
            try {
                // 获取所有饮料类型步骤的饮料名称
                const beverageNames = finalMethod.params.stages
                    .filter(stage => stage.pourType === 'beverage')
                    .map(stage => stage.label)
                    .filter(label => label.trim() !== ''); // 排除空名称
                
                if (beverageNames.length > 0) {
                    // 从localStorage读取已保存的饮料名称
                    const savedSuggestions = localStorage.getItem('userBeverageSuggestions');
                    let userBeverages: string[] = [];
                    
                    if (savedSuggestions) {
                        userBeverages = JSON.parse(savedSuggestions);
                    }
                    
                    // 添加新的饮料名称，去重
                    const uniqueBeverages = Array.from(
                        new Set([...userBeverages, ...beverageNames])
                    );
                    
                    // 保存回localStorage
                    localStorage.setItem('userBeverageSuggestions', JSON.stringify(uniqueBeverages));
                }
            } catch (error) {
                console.error('保存饮料名称失败:', error);
                // 继续执行，不影响主要功能
            }
        }

        try {
            // 保存方法
            onSave(finalMethod);
        } catch {
            // 可以在这里添加用户友好的错误提示
            alert('保存方案失败，请重试');
        }
    }

    const handleCoffeeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const coffee = e.target.value
        // 根据咖啡粉量和水粉比计算总水量
        const ratio = method.params.ratio.replace('1:', '')
        let totalWater = ''

        if (coffee && ratio) {
            totalWater = `${Math.round(parseFloat(coffee) * parseFloat(ratio))}g`
        }

        // 更新第一个步骤的水量
        const newStages = [...method.params.stages];
        
        if (isEspressoMachine(customEquipment)) {
            // 意式机：第一个萃取步骤的液重与总水量相同
            if (newStages.length > 0 && coffee && ratio) {
                newStages[0].water = totalWater;
            }
        } else {
            // 手冲：第一个步骤的水量是咖啡粉量的2倍
        if (newStages.length > 0 && coffee) {
            const waterAmount = Math.round(parseFloat(coffee) * 2);
            newStages[0].water = `${waterAmount}g`;
            }
        }

        setMethod({
            ...method,
            params: {
                ...method.params,
                coffee: `${coffee}g`,
                water: totalWater, // 更新总水量
                stages: newStages, // 更新步骤
            },
        })
    }

    const handleRatioChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const ratio = e.target.value
        // 根据咖啡粉量和水粉比计算总水量
        const coffee = method.params.coffee.replace('g', '')
        let totalWater = ''

        if (coffee && ratio) {
            totalWater = `${Math.round(parseFloat(coffee) * parseFloat(ratio))}g`
        }

        // 更新第一个步骤的水量
        const newStages = [...method.params.stages];
        
        if (isEspressoMachine(customEquipment)) {
            // 意式机：第一个萃取步骤的液重与总水量相同
            if (newStages.length > 0 && coffee && ratio) {
                newStages[0].water = totalWater;
            }
        } else {
            // 手冲：第一个步骤的水量是咖啡粉量的2倍
        if (newStages.length > 0 && coffee) {
            const waterAmount = Math.round(parseFloat(coffee) * 2);
            newStages[0].water = `${waterAmount}g`;
            }
        }

        setMethod({
            ...method,
            params: {
                ...method.params,
                ratio: `1:${ratio}`,
                water: totalWater, // 更新总水量
                stages: newStages, // 更新步骤
            },
        })
    }

    const handleTempChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const temp = e.target.value;
        setMethod({
            ...method,
            params: {
                ...method.params,
                temp: temp ? `${temp}°C` : '',
            },
        })
    }

    // 意式机特有 - 处理萃取时间变更
    const handleExtractionTimeChange = (time: number) => {
        if (!isEspressoMachine(customEquipment) || method.params.stages.length === 0) return;
        
        // 更新第一个萃取步骤的时间
        const newStages = [...method.params.stages];
        const firstStage = { ...newStages[0] };
        firstStage.time = time;
        newStages[0] = firstStage;

        setMethod({
            ...method,
            params: {
                ...method.params,
                stages: newStages
            }
        });
    }

    // 意式机特有 - 处理液重变更
    const handleLiquidWeightChange = (liquidWeight: string) => {
        if (!isEspressoMachine(customEquipment) || method.params.stages.length === 0) return;

        // 更新第一个萃取步骤的液重以及方法的总水量
        const newStages = [...method.params.stages];
        const firstStage = { ...newStages[0] };
        firstStage.water = liquidWeight;
        newStages[0] = firstStage;

        // 根据咖啡粉量和液重计算新的水粉比
        const coffee = parseFloat(method.params.coffee.replace('g', ''));
        const liquid = parseFloat(liquidWeight.replace('g', ''));
        
        // 计算比值
        const ratio = liquid / coffee;
        // 如果比值是整数，则不显示小数点
        const newRatio = coffee > 0 ? `1:${Number.isInteger(ratio) ? ratio.toString() : ratio.toFixed(1)}` : method.params.ratio;

        setMethod({
            ...method,
            params: {
                ...method.params,
                water: liquidWeight, // 更新总水量与萃取液重同步
                ratio: newRatio, // 更新水粉比
                stages: newStages
            }
        });
    }

    // 此处原calculateTotalTime函数已移至上方统一管理

    // 处理所有器具类型的注水方式变更
    const handlePourTypeChange = (index: number, value: string) => {
        const newStages = [...method.params.stages];
        const stage = { ...newStages[index] } as Stage;
        const isCustomPreset = customEquipment.animationType === 'custom';
        const isEspresso = isEspressoMachine(customEquipment);
        
        // 设置pourType，对所有器具类型通用
        stage.pourType = value;
        
        // 对于意式机的特殊处理
        if (isEspresso) {
            // 获取注水方式的显示名称
            const pourTypeName = getPourTypeName(value);
            
            // 获取所有可能的默认注水方式标签
            const allDefaultLabels = ['萃取浓缩', '饮料', '其他', ''];
            
            // 检查当前标签是否与任何默认标签匹配，或者是否为特定切换场景（从饮料切换到萃取，或从萃取切换到饮料）
            const isLabelDefault = !stage.label || 
                                stage.label === '' || 
                                allDefaultLabels.includes(stage.label) || 
                                (value === 'extraction' && stage.label === '饮料') || 
                                (value === 'beverage' && stage.label === '萃取浓缩');
            
            // 根据不同的注水方式处理默认值
            switch (value) {
                case 'extraction':
                    // 萃取模式，需要时间和液重
                    if (isLabelDefault) {
                        stage.label = pourTypeName;
                    }
                    // 确保有时间字段，萃取模式需要
                    if (!stage.time) {
                        stage.time = 25;
                    }
                    break;
                case 'beverage':
                    // 饮料模式，只需要名称和液重，不需要时间
                    if (isLabelDefault) {
                        stage.label = pourTypeName;
                    }
                    // 饮料阶段不需要时间
                    stage.time = 0;
                    stage.pourTime = undefined;
                    break;
                default:
                    // 其他模式，根据实际情况设置
                    if (isLabelDefault) {
                        stage.label = pourTypeName;
                    }
                break;
            }
        }
        // 检查是否选择了自定义注水动画（自定义注水动画的值是ID而不是pourType类型）
        else if (isCustomPreset) {
            // 获取所有可能的默认注水方式标签
            const allDefaultLabels = ['绕圈注水', '中心注水', '添加冰块', '注水', ''];
            // 获取所有可能的默认注水方式详细信息
            const allDefaultDetails = ['中心向外缓慢画圈注水，均匀萃取咖啡风味', '中心定点注水，降低萃取率', '添加冰块，降低温度进行冷萃', '注水', ''];
            
            // 如果有自定义注水动画，将它们的名称添加到默认标签列表中
            if (customEquipment.customPourAnimations) {
                customEquipment.customPourAnimations.forEach(anim => {
                    if (anim.name) allDefaultLabels.push(anim.name);
                    if (anim.name) allDefaultDetails.push(`使用${anim.name}注水`);
                });
            }
            
            const isCustomAnimation = value !== 'center' && value !== 'circle' && value !== 'ice' && value !== 'other';
            
            // 检查当前标签是否与任何默认标签匹配
            const isLabelDefault = !stage.label || stage.label === '' || allDefaultLabels.includes(stage.label);
            // 检查当前详细说明是否与任何默认详细说明匹配
            const isDetailDefault = !stage.detail || stage.detail === '' || allDefaultDetails.includes(stage.detail);
            
            if (isCustomAnimation) {
                // 查找对应的自定义注水动画
                const customAnimation = customEquipment.customPourAnimations?.find(anim => anim.id === value);
                
                if (customAnimation) {
                    // 更新标签和详细信息，如果它们是默认值之一或为空
                    if (isLabelDefault) {
                        stage.label = customAnimation.name || getDefaultStageLabel(value);
                    }
                    
                    if (isDetailDefault) {
                        stage.detail = getDefaultStageDetail(value);
                    }
                }
            } else {
                // 常规注水方式
                if (isLabelDefault) {
                    stage.label = getDefaultStageLabel(value);
                }
                
                if (isDetailDefault) {
                    stage.detail = getDefaultStageDetail(value);
                }
            }
        } 
        // 常规器具处理
        else {
            // 获取所有可能的默认注水方式标签
            const allDefaultLabels = ['绕圈注水', '中心注水', '添加冰块', '注水', ''];
            // 获取所有可能的默认注水方式详细信息
            const allDefaultDetails = ['中心向外缓慢画圈注水，均匀萃取咖啡风味', '中心定点注水，降低萃取率', '添加冰块，降低温度进行冷萃', '注水', ''];
            
            // 如果有自定义注水动画，将它们的名称添加到默认标签列表中
            if (customEquipment.customPourAnimations) {
                customEquipment.customPourAnimations.forEach(anim => {
                    if (anim.name) allDefaultLabels.push(anim.name);
                    if (anim.name) allDefaultDetails.push(`使用${anim.name}注水`);
                });
            }
            
            // 检查当前标签是否与任何默认标签匹配
            const isLabelDefault = !stage.label || stage.label === '' || allDefaultLabels.includes(stage.label);
            // 检查当前详细说明是否与任何默认详细说明匹配
            const isDetailDefault = !stage.detail || stage.detail === '' || allDefaultDetails.includes(stage.detail);
            
            // 如果标签是默认值之一或为空，更新它
            if (isLabelDefault) {
                stage.label = getDefaultStageLabel(value);
            }

            // 如果详细说明是默认值之一或为空，更新它
            if (isDetailDefault) {
                stage.detail = getDefaultStageDetail(value);
            }
        }

        // 更新stages
        newStages[index] = stage;
        
        // 更新方法
        setMethod({
            ...method,
            params: {
                ...method.params,
                stages: newStages,
            },
        });
    };

    // 处理阀门状态变更 - 直接切换开关状态
    const toggleValveStatus = (index: number) => {
        const newStages = [...method.params.stages]
        const stage = { ...newStages[index] }

        // 切换阀门状态
        const newStatus = stage.valveStatus === 'open' ? 'closed' : 'open'
        stage.valveStatus = newStatus

        // 保留原始的标签内容，移除可能已存在的阀门状态标记
        const baseLabel = stage.label.replace(/\s*\[开阀\]|\s*\[关阀\]/g, '')
        stage.label = baseLabel.trim()

        newStages[index] = stage
        setMethod({
            ...method,
            params: {
                ...method.params,
                stages: newStages,
            },
        })
    }

    // 此处原calculateCurrentWater函数已移至上方统一管理

    // 格式化意式咖啡的总水量，显示为各阶段的累加
    const formatEspressoTotalWater = () => {
        if (!method.params.stages || method.params.stages.length === 0) {
            return "0g";
        }

        const isEspresso = isEspressoMachine(customEquipment);
        if (!isEspresso) return "0g";

        // 计算总水量：提取步骤的水量 + 饮料步骤的水量
        const allStages = [...method.params.stages];

        // 找到萃取步骤
        const extractionStage = allStages.find(stage => stage.pourType === 'extraction');
        const extractionAmount = extractionStage ? parseFloat(extractionStage.water) || 0 : 0;
            
        // 找到饮料步骤
        const beverageStages = allStages
            .filter(stage => stage.pourType === 'beverage')
            .map(stage => parseFloat(stage.water) || 0);
        const beverageAmount = beverageStages.length > 0 ? Math.max(...beverageStages) : 0;
        
        // 使用较大的值
        return `${Math.max(extractionAmount, beverageAmount)}g`;
    };

    // ===== 渲染函数 =====
    
    // 渲染步骤内容
    const renderStepContent = () => {
        switch (currentStep) {
            case 'name':
                return (
                    <NameStep 
                        name={method.name}
                        onChange={(name) => setMethod({ ...method, name })}
                        isEdit={!!initialMethod}
                    />
                );

            case 'params':
                return (
                    <ParamsStep 
                        params={{
                            coffee: method.params.coffee,
                            water: method.params.water,
                            ratio: method.params.ratio,
                            grindSize: method.params.grindSize,
                            temp: method.params.temp,
                            // 添加意式机特有参数
                            extractionTime: isEspressoMachine(customEquipment) 
                                ? method.params.stages[0]?.time 
                                : undefined,
                            liquidWeight: isEspressoMachine(customEquipment) 
                                ? method.params.stages[0]?.water 
                                : undefined
                        }}
                        onCoffeeChange={handleCoffeeChange}
                        onRatioChange={handleRatioChange}
                        onGrindSizeChange={(grindSize) => setMethod({
                            ...method,
                            params: {
                                ...method.params,
                                grindSize
                            }
                        })}
                        onTempChange={handleTempChange}
                        // 添加意式机特有参数处理函数
                        onExtractionTimeChange={isEspressoMachine(customEquipment) 
                            ? handleExtractionTimeChange 
                            : undefined}
                        onLiquidWeightChange={isEspressoMachine(customEquipment) 
                            ? handleLiquidWeightChange 
                            : undefined}
                        settings={localSettings}
                        customEquipment={customEquipment}
                    />
                );

            case 'stages':
                return (
                    <StagesStep 
                        stages={method.params.stages}
                        totalWater={method.params.water}
                        customEquipment={customEquipment}
                        onStageChange={handleStageChange}
                        onPourTypeChange={handlePourTypeChange}
                        toggleValveStatus={toggleValveStatus}
                        addStage={addStage}
                        removeStage={removeStage}
                        calculateTotalTime={calculateTotalTime}
                        calculateCurrentWater={calculateCurrentWater}
                        formatTime={formatTime}
                        editingCumulativeTime={editingCumulativeTime}
                        setEditingCumulativeTime={setEditingCumulativeTime}
                        editingCumulativeWater={editingCumulativeWater}
                        setEditingCumulativeWater={setEditingCumulativeWater}
                        showWaterTooltip={showWaterTooltip}
                        setShowWaterTooltip={setShowWaterTooltip}
                        stagesContainerRef={stagesContainerRef}
                        newStageRef={newStageRef}
                    />
                );

            case 'complete':
                return (
                    <CompleteStep 
                        methodName={method.name}
                        coffee={method.params.coffee}
                        water={method.params.water}
                        ratio={method.params.ratio}
                        totalTime={calculateTotalTime()}
                        isEdit={!!initialMethod}
                        formatTime={formatTime}
                        isEspressoMachine={isEspressoMachine(customEquipment)}
                        formattedEspressoWater={isEspressoMachine(customEquipment) ? formatEspressoTotalWater() : undefined}
                    />
                );

            default:
                return null;
        }
    };

    // 渲染下一步按钮
    const renderNextButton = () => {
        const isLastStep = getCurrentStepIndex() === steps.length - 1;
        const isCustomPreset = customEquipment.animationType === 'custom';
        const isEspresso = isEspressoMachine(customEquipment);

        // 验证当前步骤是否可进行下一步
        const isStepValid = () => {
            switch (currentStep) {
                case 'name':
                    return !!method.name.trim();
                    
                case 'params':
                    // 基本参数验证
                    return !!method.params.coffee.trim() &&
                           !!method.params.water.trim() &&
                           !!method.params.ratio.trim() &&
                           !!method.params.temp.trim() &&
                           !!method.params.grindSize.trim();
                    
                case 'stages':
                    if (method.params.stages.length === 0) return false;
                    
                    return method.params.stages.every(stage => {
                        // 意式机特殊验证
                        if (isEspresso) {
                            switch (stage.pourType) {
                                case 'extraction': // 萃取类型
                                    return (stage.time ?? 0) > 0 && 
                                           !!stage.label.trim() && 
                                           !!stage.water.trim();
                                case 'beverage': // 饮料类型
                                    return !!stage.label.trim() && 
                                           !!stage.water.trim();
                                case 'other': // 其他类型
                                    return true;
                                default:
                                    return !!stage.pourType;
                            }
                        }
                        
                        // 自定义预设验证
                        if (isCustomPreset) {
                            const basicValidation = (stage.time ?? 0) > 0 && !!stage.water.trim();
                            
                            // 聪明杯验证阀门状态
                            if (customEquipment.hasValve) {
                                return basicValidation &&
                                    (stage.valveStatus === 'open' || stage.valveStatus === 'closed');
                            }
                            
                            return basicValidation;
                        } 
                        
                        // 标准器具验证
                        const basicValidation =
                          (stage.time ?? 0) > 0 &&
                          !!stage.label.trim() &&
                          !!stage.water.trim() &&
                          !!stage.pourType;
                        
                        // 聪明杯验证阀门状态
                        if (customEquipment.hasValve) {
                          return basicValidation &&
                              (stage.valveStatus === 'open' || stage.valveStatus === 'closed');
                        }
                        
                        return basicValidation;
                    });
                    
                case 'complete':
                    return true;
                    
                default:
                    return true;
            }
        };

        // 检查步骤有效性
        const stepValid = isStepValid();

        // 按钮点击处理
        const handleButtonClick = () => {
            if (isLastStep) {
                try {
                    handleSubmit();
                } catch (error) {
                    console.error('提交表单失败', error);
                }
            } else {
                handleNextStep();
            }
        };

        return (
            <div className="modal-bottom-button flex items-center justify-center">
                <button
                    type="button"
                    onClick={handleButtonClick}
                    disabled={!stepValid}
                    className={`
                        flex items-center justify-center p-4
                        ${!stepValid ? 'opacity-50 cursor-not-allowed' : ''}
                        ${isLastStep ? 'bg-neutral-800 dark:bg-neutral-200 text-neutral-100 dark:text-neutral-800 px-6 py-3 rounded-full' : ''}
                    `}
                >
                    {isLastStep ? (
                        <span className="font-medium">完成</span>
                    ) : (
                        <div className="flex items-center relative">
                            <div className="w-24 h-0.5 bg-neutral-800 dark:bg-neutral-200"></div>
                            <div className="absolute -right-1 transform translate-x-0">
                                <ArrowRight className="w-5 h-5 text-neutral-800 dark:text-neutral-200" />
                            </div>
                        </div>
                    )}
                </button>
            </div>
        );
    };

    // 最终渲染
    return (
        <>
            {/* 顶部导航栏 */}
            <Steps 
                steps={steps}
                currentStep={currentStep}
                onBack={handleBack}
            />

            {/* 步骤内容 */}
            <div className="flex-1 overflow-y-auto pr-2">
                {renderStepContent()}
            </div>

            {/* 下一步按钮 */}
            {renderNextButton()}
        </>
    );
}

export default CustomMethodForm