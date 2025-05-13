'use client'

import React, { useState, useEffect } from 'react'
import BrewingNoteForm from './BrewingNoteForm'
import { MethodSelector, CoffeeBeanSelector, EquipmentSelector } from '@/components/notes/Form'
import { useMethodManagement } from '@/components/notes/Form/hooks/useMethodManagement'
import type { BrewingNoteData, CoffeeBean } from '@/types/app'
import { equipmentList } from '@/lib/core/config'
import SteppedFormModal, { Step } from '@/components/common/modals/SteppedFormModal'
import { type Method, type CustomEquipment } from '@/lib/core/config'
import { CoffeeBeanManager } from '@/lib/managers/coffeeBeanManager'
import { loadCustomEquipments } from '@/lib/managers/customEquipments'
// 导入随机选择器组件
import CoffeeBeanRandomPicker from '@/components/coffee-bean/RandomPicker/CoffeeBeanRandomPicker'

interface BrewingNoteFormModalProps {
  showForm: boolean
  initialNote?: Partial<BrewingNoteData> & {
    coffeeBean?: CoffeeBean | null;
    id?: string;
  }
  onSave: (note: BrewingNoteData) => void
  onClose: () => void
  skipToLastStep?: boolean
  onSaveSuccess?: () => void
}

const BrewingNoteFormModal: React.FC<BrewingNoteFormModalProps> = ({
  showForm,
  initialNote,
  onSave,
  onClose,
  skipToLastStep = false,
  onSaveSuccess
}) => {
  // 咖啡豆状态
  const [selectedCoffeeBean, setSelectedCoffeeBean] = useState<CoffeeBean | null>(initialNote?.coffeeBean || null)
  const [coffeeBeans, setCoffeeBeans] = useState<CoffeeBean[]>([])

  // 器具状态
  const [selectedEquipment, setSelectedEquipment] = useState<string>(initialNote?.equipment || '')
  const [customEquipments, setCustomEquipments] = useState<CustomEquipment[]>([])

  // 步骤控制
  const [currentStep, setCurrentStep] = useState<number>(0)
  
  // 随机选择器状态
  const [isRandomPickerOpen, setIsRandomPickerOpen] = useState(false)

  // 使用方法管理Hook
  const {
    methodType,
    selectedMethod,
    availableMethods,
    handleMethodTypeChange,
    setSelectedMethod
  } = useMethodManagement({
    selectedEquipment,
    initialMethod: initialNote?.method,
    customEquipments
  })

  // 处理关闭
  const handleClose = () => {
    setSelectedCoffeeBean(null)
    setSelectedEquipment('')
    setSelectedMethod('')
    onClose()
  }

  // 加载咖啡豆列表
  useEffect(() => {
    if (showForm) {
      CoffeeBeanManager.getAllBeans()
        .then(beans => {
          setCoffeeBeans(beans)
          // 如果没有咖啡豆，自动跳过咖啡豆步骤
          if (beans.length === 0 && currentStep === 0) {
            setCurrentStep(1)
          }
        })
        .catch(error => console.error('加载咖啡豆失败:', error))
    }
  }, [showForm, currentStep])

  // 加载自定义器具列表
  useEffect(() => {
    if (showForm) {
      loadCustomEquipments()
        .then(equipments => setCustomEquipments(equipments))
        .catch(error => console.error('加载自定义器具失败:', error))
    }
  }, [showForm])

  // 处理器具选择
  const handleEquipmentSelect = (equipmentId: string) => {
    if (equipmentId === selectedEquipment) return
    setSelectedEquipment(equipmentId)
    // 选择器具后自动进入下一步
    setCurrentStep(2)
  }

  // 处理咖啡豆选择
  const handleCoffeeBeanSelect = (bean: CoffeeBean | null) => {
    setSelectedCoffeeBean(bean)
    // 选择咖啡豆后自动进入下一步（无论是选择豆子还是不选择都跳转）
    setCurrentStep(1)
  }
  
  // 打开随机选择器
  const handleOpenRandomPicker = () => {
    setIsRandomPickerOpen(true)
  }
  
  // 处理随机选择咖啡豆
  const handleRandomBeanSelect = (bean: CoffeeBean) => {
    setSelectedCoffeeBean(bean)
    // 选择咖啡豆后自动进入下一步
    setCurrentStep(1)
  }

  // 处理方法参数变化
  const handleMethodParamsChange = (method: Method) => {
    // 强制重新渲染
    setSelectedMethod(methodType === 'common' ? method.name : (method.id || method.name))
  }

  // 计算咖啡粉量
  const getCoffeeAmount = () => {
    if (selectedMethod && availableMethods.length > 0) {
      const method = availableMethods.find(m => {
        return methodType === 'common' ?
          m.name === selectedMethod :
          (m.id === selectedMethod || m.name === selectedMethod)
      })

      if (method && method.params.coffee) {
        const match = method.params.coffee.match(/(\d+(\.\d+)?)/);
        if (match) {
          return parseFloat(match[0])
        }
      }
    }
    return 0
  }

  // 获取方案参数
  const getMethodParams = () => {
    if (selectedEquipment && selectedMethod) {
      const methodObj = availableMethods.find(m =>
        methodType === 'common' ? m.name === selectedMethod : m.id === selectedMethod)
      if (methodObj) {
        return {
          coffee: methodObj.params.coffee,
          water: methodObj.params.water,
          ratio: methodObj.params.ratio,
          grindSize: methodObj.params.grindSize,
          temp: methodObj.params.temp
        }
      }
    }
    return {
      coffee: '15g',
      water: '225g',
      ratio: '1:15',
      grindSize: '中细',
      temp: '92°C'
    }
  }

  // 设置默认值
  const getDefaultNote = (): Partial<BrewingNoteData> => {
    const params = getMethodParams()
    const isNewNote = !initialNote?.id
    
    return {
      equipment: selectedEquipment,
      method: selectedMethod,
      coffeeBean: selectedCoffeeBean,
      coffeeBeanInfo: selectedCoffeeBean ? {
        name: selectedCoffeeBean.name || '',
        roastLevel: selectedCoffeeBean.roastLevel || '中度烘焙',
        roastDate: selectedCoffeeBean.roastDate || ''
      } : {
        name: initialNote?.coffeeBeanInfo?.name || '',
        roastLevel: initialNote?.coffeeBeanInfo?.roastLevel || '中度烘焙',
        roastDate: initialNote?.coffeeBeanInfo?.roastDate || ''
      },
      params: initialNote?.params || params,
      rating: initialNote?.rating || 3,
      taste: initialNote?.taste || {
        acidity: 3,
        sweetness: 3,
        bitterness: 3,
        body: 3
      },
      notes: initialNote?.notes || '',
      ...(isNewNote ? {} : { id: initialNote?.id })
    }
  }

  // 处理步骤完成
  const handleStepComplete = () => {
    const form = document.querySelector('form')
    if (form) {
      form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }))
    }
  }

  // 处理保存笔记
  const handleSaveNote = (note: BrewingNoteData) => {
    // 获取方案名称
    let methodName = selectedMethod
    if (methodType === 'custom' && selectedMethod) {
      const methodObj = availableMethods.find(m =>
        m.id === selectedMethod || m.name === selectedMethod
      )
      if (methodObj) {
        methodName = methodObj.name
      }
    }

    // 创建完整笔记
    const completeNote: BrewingNoteData = {
      ...note,
      equipment: selectedEquipment,
      method: methodName
    }

    // 处理咖啡豆关联
    if (selectedCoffeeBean?.id) {
      completeNote["beanId"] = selectedCoffeeBean.id
      // 移除保存完整咖啡豆对象的代码，只保留beanId
      // 确保coffeeBeanInfo中有必要的信息
      if (!completeNote.coffeeBeanInfo) {
        completeNote.coffeeBeanInfo = {
          name: selectedCoffeeBean.name || '',
          roastLevel: selectedCoffeeBean.roastLevel || '中度烘焙',
          roastDate: selectedCoffeeBean.roastDate
        }
      }

      // 减少咖啡豆剩余量
      const coffeeAmount = getCoffeeAmount()
      if (coffeeAmount > 0) {
        CoffeeBeanManager.updateBeanRemaining(selectedCoffeeBean.id, coffeeAmount)
          .catch(error => console.error('减少咖啡豆剩余量失败:', error))
      }
    }

    // 保存并关闭
    onSave(completeNote)
    handleClose()
    
    // 如果提供了保存成功回调，则调用它
    if (onSaveSuccess) {
      onSaveSuccess()
    }
  }

  // 定义步骤
  const steps: Step[] = [
    {
      id: 'coffeeBean',
      label: '选择咖啡豆',
      content: (
        <CoffeeBeanSelector
          coffeeBeans={coffeeBeans}
          selectedCoffeeBean={selectedCoffeeBean}
          onSelect={handleCoffeeBeanSelect}
        />
      ),
      isValid: true // 咖啡豆选择为可选
    },
    {
      id: 'equipment',
      label: '选择器具',
      content: (
        <EquipmentSelector
          equipmentList={equipmentList}
          customEquipments={customEquipments}
          selectedEquipment={selectedEquipment}
          onSelect={handleEquipmentSelect}
        />
      ),
      isValid: !!selectedEquipment
    },
    {
      id: 'method',
      label: '选择方案',
      content: (
        <MethodSelector
          selectedEquipment={selectedEquipment}
          methodType={methodType}
          selectedMethod={selectedMethod}
          availableMethods={availableMethods}
          onMethodTypeChange={handleMethodTypeChange}
          onMethodSelect={setSelectedMethod}
          onParamsChange={handleMethodParamsChange}
        />
      ),
      isValid: !!selectedMethod
    },
    {
      id: 'note-form',
      label: '冲煮笔记',
      content: (
        <BrewingNoteForm
          id={initialNote?.id}
          isOpen={true}
          onClose={() => {}} // 不提供关闭功能，由模态框控制
          onSave={handleSaveNote}
          initialData={getDefaultNote()}
          inBrewPage={true}
          showSaveButton={false}
          onSaveSuccess={onSaveSuccess}
        />
      ),
      isValid: true
    }
  ]

  return (
    <>
      <SteppedFormModal
        showForm={showForm}
        onClose={handleClose}
        onComplete={handleStepComplete}
        steps={steps}
        initialStep={skipToLastStep ? steps.length - 1 : (coffeeBeans.length === 0 ? 1 : 0)}
        preserveState={false}
        currentStep={currentStep}
        setCurrentStep={setCurrentStep}
        onRandomBean={handleOpenRandomPicker} // 添加随机选择器触发函数
      />
      
      {/* 随机选择器 */}
      <CoffeeBeanRandomPicker
        beans={coffeeBeans}
        isOpen={isRandomPickerOpen}
        onClose={() => setIsRandomPickerOpen(false)}
        onSelect={handleRandomBeanSelect}
      />
    </>
  )
}

export default BrewingNoteFormModal 