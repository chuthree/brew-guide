'use client'

import React, { useState, useEffect } from 'react'
import BrewingNoteForm from './BrewingNoteForm'
import { MethodSelector, CoffeeBeanSelector, EquipmentSelector } from '@/components/Notes/Form'
import { useMethodManagement } from '@/components/Notes/Form/hooks/useMethodManagement'
import type { BrewingNoteData, CoffeeBean } from '@/app/types'
import { equipmentList } from '@/lib/config'
import SteppedFormModal, { Step } from '@/components/SteppedFormModal'
import { type Method, type CustomEquipment } from '@/lib/config'
import { CoffeeBeanManager } from '@/lib/coffeeBeanManager'
import { loadCustomEquipments } from '@/lib/customEquipments'

interface BrewingNoteFormModalProps {
  showForm: boolean
  initialNote?: Partial<BrewingNoteData> & {
    coffeeBean?: CoffeeBean | null;
    id?: string;
  }
  onSave: (note: BrewingNoteData) => void
  onClose: () => void
  skipToLastStep?: boolean
}

const BrewingNoteFormModal: React.FC<BrewingNoteFormModalProps> = ({
  showForm,
  initialNote,
  onSave,
  onClose,
  skipToLastStep = false
}) => {
  // 咖啡豆状态
  const [selectedCoffeeBean, setSelectedCoffeeBean] = useState<CoffeeBean | null>(initialNote?.coffeeBean || null)
  const [coffeeBeans, setCoffeeBeans] = useState<CoffeeBean[]>([])

  // 器具状态
  const [selectedEquipment, setSelectedEquipment] = useState<string>(initialNote?.equipment || '')
  const [customEquipments, setCustomEquipments] = useState<CustomEquipment[]>([])

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
        .then(beans => setCoffeeBeans(beans))
        .catch(error => console.error('加载咖啡豆失败:', error))
    }
  }, [showForm])

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
      completeNote["coffeeBean"] = selectedCoffeeBean

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
          onSelect={setSelectedCoffeeBean}
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
        />
      ),
      isValid: true
    }
  ]

  // 获取表单标题
  const getFormTitle = () => {
    if (skipToLastStep) {
      return initialNote?.id ? "编辑冲煮笔记" : "创建冲煮笔记"
    }
    return "创建冲煮笔记"
  }

  return (
    <SteppedFormModal
      showForm={showForm}
      onClose={handleClose}
      onComplete={handleStepComplete}
      steps={steps}
      initialStep={skipToLastStep ? steps.length - 1 : 0}
      title={getFormTitle()}
      preserveState={false}
    />
  )
}

export default BrewingNoteFormModal 