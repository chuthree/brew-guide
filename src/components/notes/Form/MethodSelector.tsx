'use client'

import React, { useState, useEffect } from 'react'
import { Method } from '@/lib/core/config'

interface MethodSelectorProps {
  selectedEquipment: string
  methodType: 'common' | 'custom'
  selectedMethod: string
  availableMethods: Method[]
  onMethodTypeChange: (type: 'common' | 'custom') => void
  onMethodSelect: (methodId: string) => void
  onParamsChange: (method: Method) => void
}

const MethodSelector: React.FC<MethodSelectorProps> = ({
  selectedEquipment,
  methodType,
  selectedMethod,
  availableMethods,
  onMethodTypeChange,
  onMethodSelect,
  onParamsChange
}) => {
  // 本地状态管理参数
  const [coffeeAmount, setCoffeeAmount] = useState<string>('15')
  const [ratioAmount, setRatioAmount] = useState<string>('15')
  const [waterAmount, setWaterAmount] = useState<string>('225g')
  const [grindSize, setGrindSize] = useState<string>('中细')
  const [tempValue, setTempValue] = useState<string>('92')

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
  const handleTempChange = (value: string, method: Method) => {
    // 允许输入数字和小数点的正则表达式
    const regex = /^$|^[0-9]*\.?[0-9]*$/;
    if (regex.test(value)) {
      setTempValue(value)
      
      // 更新方法参数
      method.params.temp = `${value}°C`
      
      // 通知父组件参数已更改
      onParamsChange(method)
    }
  }

  // 当选择的方法变化时，初始化参数
  useEffect(() => {
    if (selectedMethod && availableMethods.length > 0) {
      const method = availableMethods.find(m => 
        methodType === 'common' ? m.name === selectedMethod : (m.id === selectedMethod || m.name === selectedMethod)
      )
      
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
  }, [selectedMethod, availableMethods, methodType])

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
    return (methodType === 'common' && selectedMethod === method.name) ||
      (methodType === 'custom' && (selectedMethod === method.id || selectedMethod === method.name));
  }

  return (
    <div className="py-3">
      {/* 方案类型选择器 */}
      <div className="flex justify-start items-center mb-3 border-b border-neutral-200 dark:border-neutral-800 pb-2">
        <button
          onClick={() => onMethodTypeChange('common')}
          className={`text-xs transition-colors ${methodType === 'common'
            ? 'text-neutral-800 dark:text-neutral-100 font-medium'
            : 'text-neutral-500 dark:text-neutral-400'
            }`}
        >
          通用方案
        </button>
        <span className="mx-3 text-neutral-300 dark:text-neutral-600 text-xs">|</span>
        <button
          onClick={() => onMethodTypeChange('custom')}
          className={`text-xs transition-colors ${methodType === 'custom'
            ? 'text-neutral-800 dark:text-neutral-100 font-medium'
            : 'text-neutral-500 dark:text-neutral-400'
            }`}
        >
          自定义方案
        </button>
      </div>

      <div>
        <label className="text-xs font-medium text-neutral-800 dark:text-neutral-200 mb-6 block">
          选择{methodType === 'common' ? '通用' : '自定义'}冲煮方案
        </label>
        {selectedEquipment ? (
          <div className="space-y-5">
            {availableMethods.length > 0 ? (
              availableMethods.map((method) => {
                const isSelected = isMethodSelected(method);
                
                // 准备方法参数信息列表
                const items = [];
                items.push(`咖啡粉量 ${method.params.coffee}`);
                items.push(`水量 ${method.params.water}`);
                items.push(`粉水比 ${method.params.ratio}`);
                items.push(`研磨度 ${method.params.grindSize}`);
                items.push(`水温 ${method.params.temp}`);
                
                return (
                <div
                  key={methodType === 'common' ? method.name : (method.id || method.name)}
                  className="group relative text-neutral-500 dark:text-neutral-400"
                >
                  <div 
                    className={`group relative border-l ${isSelected ? 'border-neutral-800 dark:border-white' : 'border-neutral-200 dark:border-neutral-800'} pl-6 cursor-pointer`}
                  >
                    {isSelected && (
                      <div className="absolute -left-px top-0 h-full w-px bg-neutral-800 dark:bg-white"></div>
                    )}
                    <div className="cursor-pointer" onClick={() => onMethodSelect(methodType === 'common' ? method.name : (method.id || method.name))}>
                      <div className="flex items-baseline justify-between">
                        <div className="flex items-baseline gap-3 min-w-0 overflow-hidden">
                          <h3 className="text-xs font-normal tracking-wider truncate">
                            {method.name}
                          </h3>
                        </div>
                      </div>
                      <div className="mt-2">
                        <ul className="space-y-1">
                          {items.map((item, i) => (
                            <li key={i} className="text-xs font-light">
                              {item}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                    
                    {isSelected && (
                      <div 
                        className="mt-4 pt-3 border-t border-neutral-200 dark:border-neutral-700"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="text-xs font-medium mb-3 text-neutral-700 dark:text-neutral-300">
                          调整参数
                        </div>
                        <div className="space-y-3">
                          {/* 咖啡粉量 */}
                          <div className="flex items-center justify-between">
                            <label className="text-xs text-neutral-600 dark:text-neutral-400">咖啡粉量</label>
                            <div className="flex items-center">
                              <input
                                type="text"
                                value={coffeeAmount}
                                onChange={(e) => handleCoffeeAmountChange(e.target.value, method)}
                                className="w-16 py-1 px-2 border border-neutral-300 dark:border-neutral-700 rounded bg-white dark:bg-neutral-800 text-neutral-800 dark:text-neutral-100 text-right text-xs"
                                placeholder="15"
                              />
                              <span className="ml-1 text-xs text-neutral-600 dark:text-neutral-400">g</span>
                            </div>
                          </div>
                          
                          {/* 粉水比 */}
                          <div className="flex items-center justify-between">
                            <label className="text-xs text-neutral-600 dark:text-neutral-400">粉水比</label>
                            <div className="flex items-center">
                              <span className="mr-1 text-xs text-neutral-600 dark:text-neutral-400">1:</span>
                              <input
                                type="text"
                                value={ratioAmount}
                                onChange={(e) => handleRatioAmountChange(e.target.value, method)}
                                className="w-16 py-1 px-2 border border-neutral-300 dark:border-neutral-700 rounded bg-white dark:bg-neutral-800 text-neutral-800 dark:text-neutral-100 text-right text-xs"
                                placeholder="15"
                              />
                            </div>
                          </div>
                          
                          {/* 研磨度 */}
                          <div className="flex items-center justify-between">
                            <label className="text-xs text-neutral-600 dark:text-neutral-400">研磨度</label>
                            <div className="flex items-center">
                              <input
                                type="text"
                                value={grindSize}
                                onChange={(e) => handleGrindSizeChange(e.target.value, method)}
                                className="w-24 py-1 px-2 border border-neutral-300 dark:border-neutral-700 rounded bg-white dark:bg-neutral-800 text-neutral-800 dark:text-neutral-100 text-right text-xs"
                                placeholder="中细"
                              />
                            </div>
                          </div>
                          
                          {/* 水温 */}
                          <div className="flex items-center justify-between">
                            <label className="text-xs text-neutral-600 dark:text-neutral-400">水温</label>
                            <div className="flex items-center">
                              <input
                                type="text"
                                value={tempValue}
                                onChange={(e) => handleTempChange(e.target.value, method)}
                                className="w-16 py-1 px-2 border border-neutral-300 dark:border-neutral-700 rounded bg-white dark:bg-neutral-800 text-neutral-800 dark:text-neutral-100 text-right text-xs"
                                placeholder="92"
                              />
                              <span className="ml-1 text-xs text-neutral-600 dark:text-neutral-400">°C</span>
                            </div>
                          </div>
                        </div>
                        <div className="mt-2 flex items-center gap-1 text-xs text-neutral-500 dark:text-neutral-400">
                          <span>计算出的水量:</span>
                          <span className="font-medium">{waterAmount}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                )
              })
            ) : (
              <div className="text-xs text-neutral-500 dark:text-neutral-400 border-l border-neutral-200 dark:border-neutral-800 pl-6">
                {methodType === 'common' ? '没有可用的通用冲煮方案' : '没有可用的自定义冲煮方案'}
              </div>
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