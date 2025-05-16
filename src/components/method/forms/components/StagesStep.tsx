import React, { useRef, forwardRef, useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Info } from 'lucide-react';
import AutoResizeTextarea from '@/components/common/forms/AutoResizeTextarea';
import AutocompleteInput from '@/components/common/forms/AutocompleteInput';
import { CustomEquipment } from '@/lib/core/config';
import { Stage } from './types';
import { isEspressoMachine, getEspressoPourTypeName } from '@/lib/utils/equipmentUtils';

// 预设饮料列表
const PRESET_BEVERAGES = [
  '饮用水',
  '冰块',
  '纯牛奶',
  '厚椰乳',
  '燕麦奶'
];

// 动画变体
const pageVariants = {
  initial: {
    opacity: 0,
  },
  in: {
    opacity: 1,
  },
  out: {
    opacity: 0,
  }
};

const pageTransition = {
  type: "tween",
  ease: "anticipate",
  duration: 0.26
};

interface StagesStepProps {
  stages: Stage[];
  totalWater: string;
  customEquipment: CustomEquipment;
  onStageChange: (index: number, field: keyof Stage, value: string | number) => void;
  onPourTypeChange: (index: number, value: string) => void;
  toggleValveStatus: (index: number) => void;
  addStage: () => void;
  removeStage: (index: number) => void;
  calculateTotalTime: () => number;
  calculateCurrentWater: () => number;
  formatTime: (seconds: number) => string;
  editingCumulativeTime: { index: number, value: string } | null;
  setEditingCumulativeTime: React.Dispatch<React.SetStateAction<{ index: number, value: string } | null>>;
  editingCumulativeWater: { index: number, value: string } | null;
  setEditingCumulativeWater: React.Dispatch<React.SetStateAction<{ index: number, value: string } | null>>;
  showWaterTooltip: number | null;
  setShowWaterTooltip: React.Dispatch<React.SetStateAction<number | null>>;
  stagesContainerRef: React.RefObject<HTMLDivElement>;
  newStageRef?: React.RefObject<HTMLDivElement>;
}

const StagesStep: React.FC<StagesStepProps> = ({
  stages,
  totalWater,
  customEquipment,
  onStageChange,
  onPourTypeChange,
  toggleValveStatus,
  addStage,
  removeStage,
  calculateTotalTime,
  calculateCurrentWater,
  formatTime,
  editingCumulativeTime,
  setEditingCumulativeTime,
  editingCumulativeWater,
  setEditingCumulativeWater,
  showWaterTooltip,
  setShowWaterTooltip,
  stagesContainerRef,
  newStageRef
}) => {
  const innerNewStageRef = useRef<HTMLDivElement>(null);
  const isCustomPreset = customEquipment.animationType === 'custom';
  
  // 添加状态来存储用户自定义的饮料建议列表
  const [beverageSuggestions, setBeverageSuggestions] = useState<string[]>(PRESET_BEVERAGES);
  
  // 初始化时从 localStorage 读取用户自定义的饮料建议
  useEffect(() => {
    const loadBeverageSuggestions = () => {
      try {
        const savedSuggestions = localStorage.getItem('userBeverageSuggestions');
        if (savedSuggestions) {
          const parsedSuggestions = JSON.parse(savedSuggestions) as string[];
          // 合并预设和用户自定义饮料，去除重复
          const uniqueSuggestions = Array.from(
            new Set([...PRESET_BEVERAGES, ...parsedSuggestions])
          );
          setBeverageSuggestions(uniqueSuggestions);
        }
      } catch (error) {
        console.error('Failed to load beverage suggestions:', error);
      }
    };
    
    loadBeverageSuggestions();
  }, []);
  
  // 当用户输入新的饮料名称时，保存到建议列表和localStorage
  const handleBeverageChange = (index: number, value: string) => {
    // 只将值传递给 onStageChange，不进行本地保存
    onStageChange(index, 'label', value);
  };

  // 从suggestions中删除指定的饮料名称
  const handleRemoveBeverage = (value: string) => {
    // 不能删除预设饮料
    if (PRESET_BEVERAGES.includes(value)) {
      return;
    }
    
    try {
      // 从localStorage中读取用户自定义饮料
      const savedSuggestions = localStorage.getItem('userBeverageSuggestions');
      if (savedSuggestions) {
        const userBeverages = JSON.parse(savedSuggestions) as string[];
        // 过滤掉要删除的饮料
        const updatedBeverages = userBeverages.filter(item => item !== value);
        // 保存回localStorage
        localStorage.setItem('userBeverageSuggestions', JSON.stringify(updatedBeverages));
        
        // 更新本地状态
        const newSuggestions = beverageSuggestions.filter(item => item !== value);
        setBeverageSuggestions(newSuggestions);
      }
    } catch (error) {
      console.error('删除饮料名称失败:', error);
    }
  };
  
  // 判断是否为自定义饮料（可删除）
  const isCustomBeverage = (value: string) => {
    return !PRESET_BEVERAGES.includes(value);
  };

  // 格式化意式咖啡的总水量，显示为各阶段的累加
  const formatEspressoTotalWater = () => {
    if (!stages || stages.length === 0) return "0g";
    
    // 收集不同类型的水量信息，按espressoPourType分类合并
    const waterByTypeMap: Record<string, { label: string; water: number; count: number }> = {};
    
    stages.forEach(stage => {
      if (!stage.water) return;
      
      const waterValue = typeof stage.water === 'number' 
        ? stage.water 
        : parseInt(stage.water.toString().replace('g', '') || '0');
      
      if (waterValue <= 0) return;
      
      // 使用espressoPourType作为分组键
      const type = stage.espressoPourType || stage.pourType || 'other';
      
      // 获取显示的标签
      const displayLabel = stage.espressoPourType === 'extraction' ? '萃取' : 
                          stage.espressoPourType === 'beverage' ? stage.label || '饮料' : 
                          stage.label || '其他';
      
      // 如果该类型已存在，则累加水量
      if (waterByTypeMap[type]) {
        waterByTypeMap[type].water += waterValue;
        waterByTypeMap[type].count += 1;
        // 如果是饮料类型且有不同的标签，更新标签
        if (type === 'beverage' && waterByTypeMap[type].label !== displayLabel) {
          waterByTypeMap[type].label = '饮料';  // 简化为通用标签
        }
      } else {
        // 否则创建新条目
        waterByTypeMap[type] = {
          label: displayLabel,
          water: waterValue,
          count: 1
        };
      }
    });
    
    // 将Map转换为数组
    const waterItems = Object.values(waterByTypeMap);
    
    // 如果没有有效数据，返回零
    if (waterItems.length === 0) return "0g";
    
    // 构建显示字符串：水量g(标签) + 水量g(标签) + ...
    return waterItems.map(item => {
      // 如果同类型有多个且标签不是简单的'萃取'/'饮料'，则添加数量
      const countSuffix = item.count > 1 ? `×${item.count}` : '';
      return `${item.water}g(${item.label}${countSuffix})`;
    }).join(' + ');
  };

  return (
    <motion.div
      key="stages-step"
      initial="initial"
      animate="in"
      exit="out"
      variants={pageVariants}
      transition={pageTransition}
      className="space-y-8 max-w-md mx-auto relative"
    >
      {/* 顶部固定导航 */}
      <div className="sticky top-0 pt-2 pb-4 bg-neutral-50 dark:bg-neutral-900 z-10 flex flex-col border-b border-neutral-200 dark:border-neutral-700">
        <div className="flex justify-between items-center mb-2">
          <h3 className="text-base font-medium text-neutral-800 dark:text-neutral-200">
            冲煮步骤
          </h3>
          <button
            type="button"
            onClick={addStage}
            className="text-sm text-neutral-600 dark:text-neutral-400"
          >
            + 添加步骤
          </button>
        </div>

        <div className="flex justify-between text-xs text-neutral-500 dark:text-neutral-400">
          <div className="flex-shrink-0">
            总时间: {formatTime(calculateTotalTime())}
          </div>
          <div className={`${isEspressoMachine(customEquipment) ? 'flex-1 ml-4 text-right truncate relative group' : 'flex-shrink-0'}`}>
            <span className="truncate">总水量: {isEspressoMachine(customEquipment) 
                  ? formatEspressoTotalWater() 
                  : `${calculateCurrentWater()}g / ${parseInt(totalWater)}g`}</span>
            
            {/* 当水量文本溢出时显示的提示框 */}
            {isEspressoMachine(customEquipment) && (
              <div className="absolute right-0 -bottom-8 hidden group-hover:block z-20 bg-white dark:bg-neutral-800 py-1 px-2 rounded shadow-md text-xs">
                {formatEspressoTotalWater()}
              </div>
            )}
          </div>
        </div>

        {/* 顶部渐变阴影 - 作为导航的伪元素 */}
        <div className="absolute mt-[72px] left-0 right-0 h-12 -bottom-12 bg-gradient-to-b from-neutral-50 dark:from-neutral-900 to-transparent pointer-events-none"></div>
      </div>

      {/* 步骤内容 */}
      <div className="space-y-10 pt-2 m-0" ref={stagesContainerRef}>
        {stages.map((stage, index) => (
          <div
            key={index}
            className="space-y-6 pb-6 border-neutral-200 dark:border-neutral-700 transition-colors duration-200"
            ref={index === stages.length - 1 ? (newStageRef || innerNewStageRef) : null}
          >
            <div className="flex justify-between items-center">
              <h4 className="text-sm font-medium text-neutral-800 dark:text-neutral-200 flex items-center">
                步骤 {index + 1}
              </h4>
              {stages.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeStage(index)}
                  className="text-xs text-neutral-500 dark:text-neutral-400"
                >
                  删除
                </button>
              )}
            </div>

            <div className="space-y-6">
              <div className="grid grid-cols-3 gap-6">
                <div className="space-y-2">
                  <label className="block text-xs font-medium text-neutral-500 dark:text-neutral-400">
                    注水方式
                  </label>
                  <select
                    value={stage.pourType}
                    onChange={(e) => onPourTypeChange(index, e.target.value)}
                    className={`w-full py-2 bg-transparent outline-none border-b border-neutral-300 dark:border-neutral-700 focus:border-neutral-800 dark:focus:border-neutral-400 appearance-none ${!stage.pourType ? 'text-neutral-500 dark:text-neutral-400' : ''}`}
                  >
                    <option value="" disabled>请选择注水方式</option>
                    {/* 意式机特有的注水方式 */}
                    {isEspressoMachine(customEquipment) ? (
                      <>
                        <option value="extraction">萃取</option>
                        <option value="beverage">饮料</option>
                        <option value="other">其他</option>
                      </>
                    ) : (
                      /* 普通器具的注水方式 */
                      <>
                        {/* 显示自定义器具的自定义注水动画 */}
                        {customEquipment.customPourAnimations && customEquipment.customPourAnimations.length > 0 ? (
                          <>
                            {/* 用户创建的自定义注水动画 */}
                            {customEquipment.customPourAnimations
                              .filter(anim => !anim.isSystemDefault)
                              .map(animation => (
                                <option key={animation.id} value={animation.id}>
                                  {animation.name}
                                </option>
                              ))
                            }
                            {/* 如果不是自定义预设，才显示系统默认注水方式 */}
                            {customEquipment.animationType !== 'custom' && (
                              <>
                                {/* 系统默认注水方式 */}
                                {customEquipment.customPourAnimations
                                  .filter(anim => anim.isSystemDefault && anim.pourType)
                                  .map(animation => (
                                    <option key={animation.id} value={animation.pourType || ''}>
                                      {animation.name}
                                    </option>
                                  ))
                                }
                                {/* 如果没有中心注水/绕圈注水/添加冰块的系统预设，添加它们 */}
                                {!customEquipment.customPourAnimations.some(a => a.pourType === 'center') && 
                                  <option value="center">中心注水</option>
                                }
                                {!customEquipment.customPourAnimations.some(a => a.pourType === 'circle') && 
                                  <option value="circle">绕圈注水</option>
                                }
                                {!customEquipment.customPourAnimations.some(a => a.pourType === 'ice') && 
                                  <option value="ice">添加冰块</option>
                                }
                                <option value="other">其他方式</option>
                              </>
                            )}
                            {/* 为自定义预设添加其他方式选项 */}
                            {customEquipment.animationType === 'custom' && (
                              <option value="other">其他方式</option>
                            )}
                          </>
                        ) : (
                          <>
                            {/* 自定义预设器具显示更简化的选项列表 */}
                            {customEquipment.animationType === 'custom' ? (
                              <>
                                <option value="other">其他方式</option>
                                {/* 添加提示信息 */}
                                <option value="" disabled style={{ fontStyle: 'italic', color: '#999' }}>
                                  提示：可在器具设置中添加自定义注水动画
                                </option>
                              </>
                            ) : (
                              <>
                                <option value="center">中心注水</option>
                                <option value="circle">绕圈注水</option>
                                <option value="ice">添加冰块</option>
                                <option value="other">其他方式</option>
                              </>
                            )}
                          </>
                        )}
                      </>
                    )}
                  </select>
                </div>
                <div className="col-span-2 space-y-2">
                  <label className="block text-xs font-medium text-neutral-500 dark:text-neutral-400">
                    步骤名称
                  </label>
                  <div className="relative">
                    {customEquipment.hasValve && (
                      <button
                        type="button"
                        onClick={() => toggleValveStatus(index)}
                        className={`absolute left-0 bottom-2 px-2 py-1 text-xs rounded ${stage.valveStatus === 'open'
                          ? 'text-green-600 dark:text-green-400'
                          : 'text-red-600 dark:text-red-400'
                          }`}
                      >
                        {stage.valveStatus === 'open' ? '[开阀]' : '[关阀]'}
                      </button>
                    )}
                    {/* 只有意式机的饮料类型步骤才使用AutocompleteInput */}
                    {isEspressoMachine(customEquipment) && stage.espressoPourType === 'beverage' ? (
                      <AutocompleteInput
                        value={stage.label}
                        onChange={(value) => handleBeverageChange(index, value)}
                        suggestions={beverageSuggestions}
                        placeholder="请选择或输入饮料名称"
                        className={`w-full py-2 bg-transparent outline-none border-b border-neutral-300 dark:border-neutral-700 focus:border-neutral-800 dark:focus:border-neutral-400 ${customEquipment.hasValve ? 'pl-12' : ''}`}
                        onRemovePreset={handleRemoveBeverage}
                        isCustomPreset={isCustomBeverage}
                      />
                    ) : (
                      <input
                        type="text"
                        value={stage.label}
                        onChange={(e) => onStageChange(index, 'label', e.target.value)}
                        placeholder="请输入步骤名称"
                        className={`w-full py-2 bg-transparent outline-none border-b border-neutral-300 dark:border-neutral-700 focus:border-neutral-800 dark:focus:border-neutral-400 ${customEquipment.hasValve ? 'pl-12' : ''}`}
                      />
                    )}
                  </div>
                </div>
              </div>

              {/* 普通器具显示标准字段 */}
              {!isEspressoMachine(customEquipment) && (
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <label className="block text-xs font-medium text-neutral-500 dark:text-neutral-400">
                      累计时间
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={
                        editingCumulativeTime && editingCumulativeTime.index === index
                          ? editingCumulativeTime.value
                          : stage.time
                      }
                      onChange={(e) => {
                        // 先更新本地状态，保留用户输入的值
                        setEditingCumulativeTime({
                          index,
                          value: e.target.value
                        });

                        // 确保输入的值为正整数
                        const timeValue = parseInt(e.target.value) || 0;
                        if (timeValue >= 0) {
                          onStageChange(index, 'time', timeValue);
                        }
                      }}
                      onBlur={() => setEditingCumulativeTime(null)} // 失去焦点时清除本地状态
                      placeholder="0"
                      className="w-full py-2 bg-transparent outline-none border-b border-neutral-300 dark:border-neutral-700 focus:border-neutral-800 dark:focus:border-neutral-400"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="block text-xs font-medium text-neutral-500 dark:text-neutral-400">
                      注水时间
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={stage.pourTime || ''}
                      onChange={(e) => {
                        const pourTime = parseInt(e.target.value) || 0;
                        const stageTime = stage.time;
                        
                        // 如果注水时间大于阶段总时间，则将注水时间设置为阶段总时间
                        if (pourTime > stageTime) {
                          onStageChange(index, 'pourTime', stageTime);
                        } else {
                          onStageChange(index, 'pourTime', pourTime);
                        }
                      }}
                      placeholder="默认全部"
                      className="w-full py-2 bg-transparent outline-none border-b border-neutral-300 dark:border-neutral-700 focus:border-neutral-800 dark:focus:border-neutral-400"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="block text-xs font-medium text-neutral-500 dark:text-neutral-400 flex items-center">
                      累计水量
                      <button 
                        type="button"
                        className="ml-1 flex items-center justify-center text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 focus:outline-none relative" 
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          // 切换提示的显示状态
                          if (showWaterTooltip === index) {
                            setShowWaterTooltip(null);
                          } else {
                            setShowWaterTooltip(index);
                          }
                        }}
                        onMouseEnter={() => setShowWaterTooltip(index)}
                        onMouseLeave={() => setShowWaterTooltip(null)}
                        aria-label="水量输入格式说明"
                      >
                        <Info className="w-[12px] h-[12px]" />
                        {/* 悬浮提示 */}
                        {showWaterTooltip === index && (
                          <div className="absolute z-10 -right-1 -translate-y-full -top-3 w-[110px] p-2 bg-white dark:bg-neutral-800 shadow-lg rounded text-xs text-neutral-700 dark:text-neutral-300">
                            <p className="font-medium mb-1">带后缀自动转换:</p>
                            <ul className="space-y-1">
                              <li>% : 水量百分比</li>
                              <li>倍, x : 粉量倍数</li>
                            </ul>
                            {/* 小三角形箭头 */}
                            <div className="absolute right-1 bottom-[-6px] w-3 h-3 rotate-45 bg-white dark:bg-neutral-800"></div>
                          </div>
                        )}
                      </button>
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        min="0"
                        step="1"
                        placeholder=""
                        value={
                          editingCumulativeWater && editingCumulativeWater.index === index
                            ? editingCumulativeWater.value
                            : stage.water 
                              ? (typeof stage.water === 'number' 
                                ? String(stage.water) 
                                : String(parseInt((stage.water as string).replace('g', ''))))
                              : ''
                        }
                        onChange={(e) => {
                          // 更新本地编辑状态
                          setEditingCumulativeWater({
                            index,
                            value: e.target.value
                          });

                          // 如果输入为空，允许清空
                          if (!e.target.value.trim()) {
                            onStageChange(index, 'water', '');
                            return;
                          }

                          // 检查是否是百分比输入格式
                          if (e.target.value.endsWith('%')) {
                            // 在输入过程中保持原始输入值，不进行转换
                            // 转换将在onBlur时进行
                            return;
                          }

                          // 如果不是百分比，按原有逻辑处理
                          // 直接使用用户输入的值
                          let water;
                          if (e.target.value.includes('.')) {
                            // 处理小数点输入，并四舍五入到整数
                            water = Math.round(parseFloat(e.target.value));
                          } else {
                            water = parseInt(e.target.value) || 0;
                          }

                          // 确保累计水量不超过总水量
                          const totalWaterValue = parseInt(totalWater.replace('g', '') || '0');
                                
                          if (water > totalWaterValue) {
                            onStageChange(index, 'water', `${totalWaterValue}`);
                          } else {
                            onStageChange(index, 'water', `${water}`);
                          }
                        }}
                        onBlur={(e) => {
                          // 清除编辑状态
                          setEditingCumulativeWater(null);

                          // 在失去焦点时进行验证和调整
                          const value = e.target.value;

                          // 如果输入为空，清空水量
                          if (!value.trim()) {
                            onStageChange(index, 'water', '');
                            return;
                          }

                          // 获取总水量（用于计算和验证）
                          const totalWaterValue = parseInt(totalWater.replace('g', '') || '0');

                          // 检查是否是百分比输入 (例如 "50%")
                          const percentMatch = value.match(/^(\d+(\.\d+)?)%$/);
                          if (percentMatch) {
                            // 提取百分比值
                            const percentValue = parseFloat(percentMatch[1]);
                            
                            // 计算实际克数 (百分比 * 总水量)
                            const calculatedWater = Math.round((percentValue / 100) * totalWaterValue);
                            
                            // 确保计算的水量不超过总水量
                            const finalWater = Math.min(calculatedWater, totalWaterValue);
                            
                            // 更新水量
                            onStageChange(index, 'water', `${finalWater}`);
                            return;
                          }

                          // 检查是否是倍数输入 (例如 "2倍"、"2x"、"x2"等)
                          // 匹配：数字+倍、数字+x/X、x/X+数字 格式
                          const multipleMatch = value.match(/^(\d+(\.\d+)?)(倍|[xX])$/) || 
                                              value.match(/^(\d+(\.\d+)?)[\s]*(倍|[xX])[\s]*$/) || 
                                              value.match(/^[xX][\s]*(\d+(\.\d+)?)[\s]*$/);
                          if (multipleMatch) {
                            // 提取倍数值 - 根据匹配组的位置确定数值在哪个捕获组
                            const multipleValue = parseFloat(multipleMatch[1]);
                            
                                                     // 使用总水量
                             const coffeeAmount = parseInt(totalWater.replace('g', '')) / 15; // 这是一个估计值，假设水粉比大约是1:15
                            
                            // 计算实际克数 (倍数 * 咖啡粉量)
                            const calculatedWater = Math.round(multipleValue * coffeeAmount);
                            
                            // 确保计算的水量不超过总水量
                            const finalWater = Math.min(calculatedWater, totalWaterValue);
                            
                            // 更新水量
                            onStageChange(index, 'water', `${finalWater}`);
                            return;
                          }

                          // 如果不是百分比或倍数，按原有逻辑处理
                          // 直接使用用户输入的值
                          let water;
                          if (value.includes('.')) {
                            // 处理小数点输入，并四舍五入到整数
                            water = Math.round(parseFloat(value));
                          } else {
                            water = parseInt(value) || 0;
                          }

                          // 确保累计水量不超过总水量
                          if (water > totalWaterValue) {
                            onStageChange(index, 'water', `${totalWaterValue}`);
                          } else {
                            onStageChange(index, 'water', `${water}`);
                          }
                        }}
                        onFocus={(e) => e.target.select()}
                        className="w-full py-2 bg-transparent outline-none border-b border-neutral-300 dark:border-neutral-700 focus:border-neutral-800 dark:focus:border-neutral-400"
                      />
                      <span className="absolute right-0 bottom-2 text-neutral-500 dark:text-neutral-400">g</span>
                    </div>
                  </div>
                </div>
              )}

              {/* 意式机 - 萃取类型 */}
              {isEspressoMachine(customEquipment) && stage.espressoPourType === 'extraction' && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="block text-xs font-medium text-neutral-500 dark:text-neutral-400">
                      时间
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={
                        editingCumulativeTime && editingCumulativeTime.index === index
                          ? editingCumulativeTime.value
                          : stage.time
                      }
                      onChange={(e) => {
                        setEditingCumulativeTime({
                          index,
                          value: e.target.value
                        });
                        const timeValue = parseInt(e.target.value) || 0;
                        if (timeValue >= 0) {
                          onStageChange(index, 'time', timeValue);
                        }
                      }}
                      onBlur={() => setEditingCumulativeTime(null)}
                      placeholder="0"
                      className="w-full py-2 bg-transparent outline-none border-b border-neutral-300 dark:border-neutral-700 focus:border-neutral-800 dark:focus:border-neutral-400"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="block text-xs font-medium text-neutral-500 dark:text-neutral-400 flex items-center">
                      液重
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        min="0"
                        step="1"
                        placeholder=""
                        value={
                          editingCumulativeWater && editingCumulativeWater.index === index
                            ? editingCumulativeWater.value
                            : stage.water 
                              ? (typeof stage.water === 'number' 
                                ? String(stage.water) 
                                : String(parseInt((stage.water as string).replace('g', ''))))
                              : ''
                        }
                        onChange={(e) => {
                          setEditingCumulativeWater({
                            index,
                            value: e.target.value
                          });
                          if (!e.target.value.trim()) {
                            onStageChange(index, 'water', '');
                            return;
                          }
                          const water = parseInt(e.target.value) || 0;
                          onStageChange(index, 'water', `${water}`);
                        }}
                        onBlur={() => setEditingCumulativeWater(null)}
                        onFocus={(e) => e.target.select()}
                        className="w-full py-2 bg-transparent outline-none border-b border-neutral-300 dark:border-neutral-700 focus:border-neutral-800 dark:focus:border-neutral-400"
                      />
                      <span className="absolute right-0 bottom-2 text-neutral-500 dark:text-neutral-400">g</span>
                    </div>
                  </div>
                </div>
              )}

              {/* 意式机 - 饮料类型 */}
              {isEspressoMachine(customEquipment) && stage.espressoPourType === 'beverage' && (
                <div className="grid grid-cols-1 gap-4">
                  <div className="space-y-2">
                    <label className="block text-xs font-medium text-neutral-500 dark:text-neutral-400 flex items-center">
                      水量
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        min="0"
                        step="1"
                        placeholder=""
                        value={
                          editingCumulativeWater && editingCumulativeWater.index === index
                            ? editingCumulativeWater.value
                            : stage.water 
                              ? (typeof stage.water === 'number' 
                                ? String(stage.water) 
                                : String(parseInt((stage.water as string).replace('g', ''))))
                              : ''
                        }
                        onChange={(e) => {
                          setEditingCumulativeWater({
                            index,
                            value: e.target.value
                          });
                          if (!e.target.value.trim()) {
                            onStageChange(index, 'water', '');
                            return;
                          }
                          const water = parseInt(e.target.value) || 0;
                          onStageChange(index, 'water', `${water}`);
                        }}
                        onBlur={() => setEditingCumulativeWater(null)}
                        onFocus={(e) => e.target.select()}
                        className="w-full py-2 bg-transparent outline-none border-b border-neutral-300 dark:border-neutral-700 focus:border-neutral-800 dark:focus:border-neutral-400"
                      />
                      <span className="absolute right-0 bottom-2 text-neutral-500 dark:text-neutral-400">g</span>
                    </div>
                  </div>
                </div>
              )}

              {/* 所有类型都有的详细说明字段 */}
              <div className="space-y-2">
                <label className="block text-xs font-medium text-neutral-500 dark:text-neutral-400">
                  详细说明
                </label>
                <AutoResizeTextarea
                  value={stage.detail}
                  onChange={(e) => onStageChange(index, 'detail', e.target.value)}
                  placeholder="描述这个阶段的注水方式"
                  className="w-full py-2 bg-transparent outline-none border-b border-neutral-300 dark:border-neutral-700 focus:border-neutral-800 dark:focus:border-neutral-400"
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 底部渐变阴影 - 提示有更多内容 */}
      <div className="sticky bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-neutral-50 dark:from-neutral-900 to-transparent pointer-events-none"></div>
    </motion.div>
  );
};

export default StagesStep; 