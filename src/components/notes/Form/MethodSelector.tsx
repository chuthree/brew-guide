'use client'

import React, { useState, useEffect } from 'react'
import { Method } from '@/lib/core/config'

interface MethodSelectorProps {
  selectedEquipment: string
  selectedMethod: string
  customMethods: Method[]
  commonMethods: Method[]
  onMethodSelect: (methodId: string) => void
  onParamsChange: (method: Method) => void
}

const MethodSelector: React.FC<MethodSelectorProps> = ({
  selectedEquipment,
  selectedMethod,
  customMethods,
  commonMethods,
  onMethodSelect,
  onParamsChange
}) => {
  // 本地状态管理参数
  const [coffeeAmount, setCoffeeAmount] = useState<string>('15')
  const [ratioAmount, setRatioAmount] = useState<string>('15')
  const [waterAmount, setWaterAmount] = useState<string>('225g')
  const [grindSize, setGrindSize] = useState<string>('中细')
  const [_tempValue, setTempValue] = useState<string>('92')

  // 处理咖啡粉量变化
  const handleCoffeeAmountChange = (value: string, method: Method) => {
    // 允许输入数字和小数点的正则表达式
    const regex = /^$|^[0-9]*\.?[0-9]*$/;
    if (regex.test(value)) {
      setCoffeeAmount(value)
      
      // 更新方法参数
      method.params.coffee = `${value}g`
      
      // 计算并更新水量
      if (value && ratioAmount && value !== '.') {
        const coffeeValue = parseFloat(value)
        const ratioValue = parseFloat(ratioAmount)
        
        if (!isNaN(coffeeValue) && !isNaN(ratioValue) && coffeeValue > 0) {
          const waterValue = coffeeValue * ratioValue
          // 四舍五入到整数
          const roundedWaterValue = Math.round(waterValue)
          method.params.water = `${roundedWaterValue}g`
          setWaterAmount(`${roundedWaterValue}g`)
        }
      }
      
      // 通知父组件参数已更改
      onParamsChange(method)
    }
  }

  // 处理水粉比变化
  const handleRatioAmountChange = (value: string, method: Method) => {
    // 允许输入数字和小数点的正则表达式
    const regex = /^$|^[0-9]*\.?[0-9]*$/;
    if (regex.test(value)) {
      setRatioAmount(value)
      
      // 更新方法参数
      method.params.ratio = `1:${value}`
      
      // 计算并更新水量
      if (coffeeAmount && value && value !== '.') {
        const coffeeValue = parseFloat(coffeeAmount)
        const ratioValue = parseFloat(value)
        
        if (!isNaN(coffeeValue) && !isNaN(ratioValue) && coffeeValue > 0) {
          const waterValue = coffeeValue * ratioValue
          // 四舍五入到整数
          const roundedWaterValue = Math.round(waterValue)
          method.params.water = `${roundedWaterValue}g`
          setWaterAmount(`${roundedWaterValue}g`)
        }
      }
      
      // 通知父组件参数已更改
      onParamsChange(method)
    }
  }

  // 处理研磨度变化
  const handleGrindSizeChange = (value: string, method: Method) => {
    setGrindSize(value)
    
    // 更新方法参数
    method.params.grindSize = value
    
    // 通知父组件参数已更改
    onParamsChange(method)
  }
  
  // 处理水温变化
  // 未使用的水温变更处理函数，可以在将来实现

  // 当选择的方法变化时，初始化参数
  useEffect(() => {
    if (selectedMethod) {
      // 在所有方案中查找选中的方案
      const allMethods = [...customMethods, ...commonMethods];
      const method = allMethods.find(m => m.id === selectedMethod || m.name === selectedMethod);
      
      if (method) {
        // 提取参数到本地状态
        const coffee = extractNumber(method.params.coffee)
        const ratio = extractRatioNumber(method.params.ratio)
        const temp = method.params.temp.replace('°C', '')
        
        setCoffeeAmount(coffee)
        setRatioAmount(ratio)
        setWaterAmount(method.params.water)
        setGrindSize(method.params.grindSize)
        setTempValue(temp)
      }
    }
  }, [selectedMethod, customMethods, commonMethods])

  // 辅助函数：提取数字部分
  function extractNumber(str: string): string {
    const match = str.match(/(\d+(\.\d+)?)/);
    return match ? match[0] : '';
  }
  
  // 辅助函数：从水粉比中提取数字部分
  function extractRatioNumber(ratio: string): string {
    const match = ratio.match(/1:(\d+(\.\d+)?)/);
    return match ? match[1] : '';
  }

  // 判断方法是否选中
  const isMethodSelected = (method: Method) => {
    return selectedMethod === method.id || selectedMethod === method.name;
  }

  // 创建分隔符
  const divider = (customMethods.length > 0 && commonMethods.length > 0) ? (
    <div className="py-3 flex items-center">
      <div className="grow h-px bg-neutral-200 dark:bg-neutral-800"></div>
      <span className="px-2 text-xs text-neutral-500 dark:text-neutral-400">通用方案</span>
      <div className="grow h-px bg-neutral-200 dark:bg-neutral-800"></div>
    </div>
  ) : null;

  // 渲染单个方案
  const renderMethod = (method: Method, isCustom: boolean) => {
    const isSelected = isMethodSelected(method);
    
    return (
      <div
        key={isCustom ? (method.id || method.name) : method.name}
        className="group relative text-neutral-500 dark:text-neutral-400"
      >
        <div 
          className={`group relative border-l ${isSelected ? 'border-neutral-800 dark:border-white' : 'border-neutral-200 dark:border-neutral-800'} pl-6 cursor-pointer`}
          onClick={() => {
            // 统一优先使用ID作为标识符，确保一致性
            const methodIdentifier = method.id || method.name;
            onMethodSelect(methodIdentifier);
          }}
        >
          {isSelected && (
            <div className="absolute -left-px top-0 h-full w-px bg-neutral-800 dark:bg-white"></div>
          )}
          <div className="flex items-baseline justify-between">
            <div className="flex items-baseline gap-3 min-w-0 overflow-hidden">
              <h3 className={`text-xs ${isSelected ? 'font-medium' : 'font-normal'} tracking-wider truncate`}>
                {method.name}
              </h3>
            </div>
          </div>
          
          {!isSelected && (
            <div className="mt-1.5 space-y-0.5">
              <div className="flex items-center">
                <span className="text-xs font-light w-14">咖啡粉:</span>
                <span className="text-xs font-light">{method.params.coffee}</span>
              </div>
              <div className="flex items-center">
                <span className="text-xs font-light w-14">水量:</span>
                <span className="text-xs font-light">{method.params.water}</span>
              </div>
              <div className="flex items-center">
                <span className="text-xs font-light w-14">粉水比:</span>
                <span className="text-xs font-light">{method.params.ratio}</span>
              </div>
              <div className="flex items-center">
                <span className="text-xs font-light w-14">研磨度:</span>
                <span className="text-xs font-light">{method.params.grindSize}</span>
              </div>
            </div>
          )}
          
          {isSelected && (
            <div className="mt-2 pt-2 border-t border-dashed border-neutral-200 dark:border-neutral-700" onClick={(e) => e.stopPropagation()}>
              <div className="space-y-2">
                {/* 咖啡粉量 */}
                <div className="flex items-center">
                  <label className="text-xs text-neutral-600 dark:text-neutral-400 w-14">咖啡粉:</label>
                  <div className="w-20 flex justify-end">
                    <input
                      type="text"
                      value={coffeeAmount}
                      onChange={(e) => handleCoffeeAmountChange(e.target.value, method)}
                      className="w-12 py-0.5 px-1 border border-neutral-300 dark:border-neutral-700 rounded-sm bg-white dark:bg-neutral-800 text-neutral-800 dark:text-neutral-100 text-right text-xs focus:outline-hidden focus:ring-1 focus:ring-neutral-500"
                      placeholder="15"
                    />
                    <span className="ml-0.5 text-xs text-neutral-600 dark:text-neutral-400">g</span>
                  </div>
                </div>
                
                {/* 水量 - 不可编辑，仅显示计算结果 */}
                <div className="flex items-center">
                  <label className="text-xs text-neutral-600 dark:text-neutral-400 w-14">水量:</label>
                  <div className="w-20 flex justify-end">
                    <span className="text-xs text-neutral-700 dark:text-neutral-300">{waterAmount}</span>
                  </div>
                </div>
                
                {/* 粉水比 */}
                <div className="flex items-center">
                  <label className="text-xs text-neutral-600 dark:text-neutral-400 w-14">粉水比:</label>
                  <div className="w-20 flex justify-end items-center">
                    <span className="mr-0.5 text-xs text-neutral-600 dark:text-neutral-400">1:</span>
                    <input
                      type="text"
                      value={ratioAmount}
                      onChange={(e) => handleRatioAmountChange(e.target.value, method)}
                      className="w-10 py-0.5 px-1 border border-neutral-300 dark:border-neutral-700 rounded-sm bg-white dark:bg-neutral-800 text-neutral-800 dark:text-neutral-100 text-right text-xs focus:outline-hidden focus:ring-1 focus:ring-neutral-500"
                      placeholder="15"
                    />
                  </div>
                </div>
                
                {/* 研磨度 */}
                <div className="flex items-center">
                  <label className="text-xs text-neutral-600 dark:text-neutral-400 w-14">研磨度:</label>
                  <div className="w-20 flex justify-end">
                    <input
                      type="text"
                      value={grindSize}
                      onChange={(e) => handleGrindSizeChange(e.target.value, method)}
                      className="w-16 py-0.5 px-1 border border-neutral-300 dark:border-neutral-700 rounded-sm bg-white dark:bg-neutral-800 text-neutral-800 dark:text-neutral-100 text-right text-xs focus:outline-hidden focus:ring-1 focus:ring-neutral-500"
                      placeholder="中细"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="py-3">
      <div>
        <label className="text-xs font-medium text-neutral-800 dark:text-neutral-200 mb-6 block">
          选择冲煮方案
        </label>
        {selectedEquipment ? (
          <div className="space-y-5">
            {/* 自定义方案 */}
            {customMethods.length > 0 && (
              customMethods.map((method) => renderMethod(method, true))
            )}
            
            {/* 分隔符 */}
            {divider}
            
            {/* 通用方案 */}
            {commonMethods.length > 0 ? (
              commonMethods.map((method) => renderMethod(method, false))
            ) : (
              !customMethods.length && (
                <div className="text-xs text-neutral-500 dark:text-neutral-400 border-l border-neutral-200 dark:border-neutral-800 pl-6">
                  没有可用的冲煮方案
                </div>
              )
            )}
          </div>
        ) : (
          <div className="text-xs text-neutral-500 dark:text-neutral-400 border-l border-neutral-200 dark:border-neutral-800 pl-6">
            请先选择器具
          </div>
        )}
      </div>
    </div>
  )
}

export default MethodSelector 
