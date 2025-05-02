'use client'

import { useState, useEffect } from 'react'
import { type Method, type CustomEquipment, brewingMethods } from '@/lib/core/config'
import { Storage } from '@/lib/core/storage'

interface UseMethodManagementProps {
  selectedEquipment: string
  initialMethod?: string
  customEquipments: CustomEquipment[]
}

interface UseMethodManagementResult {
  methodType: 'common' | 'custom'
  selectedMethod: string
  availableMethods: Method[]
  customMethods: Method[]
  handleMethodTypeChange: (type: 'common' | 'custom') => void
  setSelectedMethod: (method: string) => void
  initMethodParams: (method: Method) => void
}

export function useMethodManagement({
  selectedEquipment,
  initialMethod,
  customEquipments
}: UseMethodManagementProps): UseMethodManagementResult {
  const [methodType, setMethodType] = useState<'common' | 'custom'>('common')
  const [selectedMethod, setSelectedMethod] = useState<string>(initialMethod || '')
  const [customMethods, setCustomMethods] = useState<Method[]>([])
  
  // 计算可用方法
  const availableMethods = (() => {
    if (!selectedEquipment) {
      return []
    }

    const customEquipment = customEquipments.find(e => e.id === selectedEquipment || e.name === selectedEquipment)
    const isCustomEquipment = !!customEquipment
    const isCustomPresetEquipment = isCustomEquipment && customEquipment.animationType === 'custom'

    if (methodType === 'common') {
      if (isCustomPresetEquipment) {
        // 自定义预设器具没有通用方案
        return []
      } else if (isCustomEquipment) {
        // 基于预设的自定义器具
        let baseEquipmentId = ''
        if (customEquipment) {
          const animationType = customEquipment.animationType.toLowerCase()
          switch (animationType) {
            case 'v60': baseEquipmentId = 'V60'; break
            case 'clever': baseEquipmentId = 'CleverDripper'; break
            default: baseEquipmentId = 'V60'
          }
        }
        return brewingMethods[baseEquipmentId] || []
      } else {
        // 预定义器具
        return brewingMethods[selectedEquipment] || []
      }
    } else if (methodType === 'custom') {
      // 对于自定义方案，直接使用已加载的当前设备的自定义方案列表
      return customMethods
    }

    return []
  })()

  // 加载自定义方案
  useEffect(() => {
    const fetchCustomMethods = async () => {
      try {
        if (selectedEquipment) {
          // 新版API尝试加载
          try {
            const methodsModule = await import('@/lib/managers/customMethods')
            const methods = await methodsModule.loadCustomMethodsForEquipment(selectedEquipment)
            if (methods && methods.length > 0) {
              setCustomMethods(methods)
              return
            }
          } catch (error) {
            console.error('新版API加载自定义方案失败:', error)
          }

          // 尝试从localStorage加载
          const customMethodsStr = await Storage.get('customMethods')
          if (customMethodsStr) {
            const parsedData = JSON.parse(customMethodsStr)
            
            // 检查是否是按设备分组的对象格式
            if (typeof parsedData === 'object' && !Array.isArray(parsedData)) {
              if (parsedData[selectedEquipment]) {
                setCustomMethods(parsedData[selectedEquipment])
                return
              }
            } 
            
            // 处理旧版扁平数组格式
            if (Array.isArray(parsedData)) {
              const filteredMethods = parsedData.filter(
                method => method && method.id && typeof method.params === 'object'
                  && method.params.coffee && method.name
              )
              setCustomMethods(filteredMethods)
              return
            }
          }
          
          // 没有找到方案
          setCustomMethods([])
        }
      } catch (error) {
        console.error('加载自定义方案失败:', error)
        setCustomMethods([])
      }
    }

    fetchCustomMethods()
  }, [selectedEquipment])

  // 切换方案类型
  const handleMethodTypeChange = (type: 'common' | 'custom') => {
    // 检查是否是自定义预设器具
    if (selectedEquipment) {
      const customEquipment = customEquipments.find(e => e.id === selectedEquipment)
      const isCustomPresetEquipment = customEquipment?.animationType === 'custom'

      // 如果是自定义预设器具，只能使用自定义方案
      if (isCustomPresetEquipment && type === 'common') {
        console.log('自定义预设器具仅支持自定义方案')
        return
      }
    }

    // 只有当类型实际变化时才执行操作
    if (type !== methodType) {
      setMethodType(type)

      // 确保有选择的器具
      if (!selectedEquipment) return

      // 当切换方案类型时，根据新类型重置选中的方案
      if (type === 'common') {
        // 切换到通用方案
        if (brewingMethods[selectedEquipment]?.length > 0) {
          setSelectedMethod(brewingMethods[selectedEquipment][0].name)
        } else {
          setSelectedMethod('') // 没有通用方案，清空选择
        }
      } else {
        // 切换到自定义方案
        if (customMethods.length > 0) {
          setSelectedMethod(customMethods[0]?.id || customMethods[0]?.name || '')
        } else {
          setSelectedMethod('') // 没有自定义方案，清空选择
        }
      }
    }
  }

  // 初始化方法参数
  const initMethodParams = (_method: Method) => {
    // 该方法由父组件实现具体逻辑
    // 在此仅提供接口
  }

  return {
    methodType,
    selectedMethod,
    availableMethods,
    customMethods,
    handleMethodTypeChange,
    setSelectedMethod,
    initMethodParams
  }
} 