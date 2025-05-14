import React, { useRef } from 'react';
import { motion } from 'framer-motion';
import { Info } from 'lucide-react';
import AutoResizeTextarea from '@/components/common/forms/AutoResizeTextarea';
import { CustomEquipment } from '@/lib/core/config';
import { Stage } from './types';

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
  setShowWaterTooltip
}) => {
  const stagesContainerRef = useRef<HTMLDivElement>(null);
  const newStageRef = useRef<HTMLDivElement>(null);
  const isCustomPreset = customEquipment.animationType === 'custom';

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
          <div>
            总时间: {formatTime(calculateTotalTime())}
          </div>
          <div>
            总水量: {calculateCurrentWater()}g / {parseInt(totalWater)}g
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
            ref={index === stages.length - 1 ? newStageRef : null}
          >
            <div className="flex justify-between items-center">
              <h4 className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
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
                    <input
                      type="text"
                      value={stage.label}
                      onChange={(e) => onStageChange(index, 'label', e.target.value)}
                      placeholder="请输入步骤名称"
                      className={`w-full py-2 bg-transparent outline-none border-b border-neutral-300 dark:border-neutral-700 focus:border-neutral-800 dark:focus:border-neutral-400 ${customEquipment.hasValve ? 'pl-12' : ''}`}
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <label className="block text-xs font-medium text-neutral-500 dark:text-neutral-400">
                    累计时间（秒）
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={
                      editingCumulativeTime && editingCumulativeTime.index === index
                        ? editingCumulativeTime.value
                        : stage.time ? stage.time.toString() : ''
                    }
                    onChange={(e) => {
                      // 更新本地编辑状态
                      setEditingCumulativeTime({
                        index,
                        value: e.target.value
                      });

                      // 如果输入为空，允许清空
                      if (!e.target.value.trim()) {
                        onStageChange(index, 'time', 0);
                        return;
                      }

                      // 直接使用用户输入的值
                      const time = parseInt(e.target.value);
                      onStageChange(index, 'time', time);
                    }}
                    onBlur={(e) => {
                      // 清除编辑状态
                      setEditingCumulativeTime(null);

                      // 在失去焦点时进行验证和调整
                      const value = e.target.value;

                      // 如果输入为空，设置为0
                      if (!value.trim()) {
                        onStageChange(index, 'time', 0);
                        return;
                      }

                      // 直接使用用户输入的值
                      const time = parseInt(value) || 0;
                      onStageChange(index, 'time', time);

                      // 自动设置注水时间
                      // 计算本阶段的时间（当前累计时间减去前一阶段的累计时间）
                      const previousTime = index > 0 ? stages[index - 1].time || 0 : 0;
                      const stageTime = time - previousTime;

                      // 如果时长有效且注水时长未设置或超出合理范围，则自动设置注水时长
                      if (stageTime > 0 && (!stage.pourTime || stage.pourTime > stageTime)) {
                        onStageChange(index, 'pourTime', stageTime);
                      }
                    }}
                    onFocus={(e) => e.target.select()}
                    className="w-full py-2 bg-transparent outline-none border-b border-neutral-300 dark:border-neutral-700 focus:border-neutral-800 dark:focus:border-neutral-400"
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-xs font-medium text-neutral-500 dark:text-neutral-400">
                    注水时间（秒）
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={stage.pourTime !== undefined && stage.pourTime !== null ? stage.pourTime : ''}
                    onChange={(e) => {
                      const value = e.target.value;
                      // 允许为真正的空值
                      if (value === '') {
                        onStageChange(index, 'pourTime', 0);
                        return;
                      }

                      // 获取用户输入的值
                      const pourTime = parseInt(value);

                      // 计算当前阶段的实际可用时长
                      const previousTime = index > 0 ? stages[index - 1].time || 0 : 0;
                      const stageTime = stage.time - previousTime;

                      // 如果注水时长超过阶段时长，则修正为阶段时长
                      if (pourTime > stageTime && stageTime > 0) {
                        onStageChange(index, 'pourTime', stageTime);
                      } else {
                        onStageChange(index, 'pourTime', pourTime);
                      }
                    }}
                    onBlur={(e) => {
                      // 在失去焦点时再次验证和调整
                      const value = e.target.value;

                      // 如果输入为空，则删除pourTime属性
                      if (!value.trim()) {
                        onStageChange(index, 'pourTime', 0);
                        return;
                      }

                      // 如果有值，确保不超过阶段时长
                      const pourTime = parseInt(value);
                      const previousTime = index > 0 ? stages[index - 1].time || 0 : 0;
                      const stageTime = stage.time - previousTime;

                      if (pourTime > stageTime && stageTime > 0) {
                        onStageChange(index, 'pourTime', stageTime);
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