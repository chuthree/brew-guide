'use client'

import React, { useRef, useEffect, useCallback } from 'react'
import { equipmentList, type CustomEquipment } from '@/lib/core/config'

interface EquipmentCategoryBarProps {
  selectedEquipment: string | null
  customEquipments: CustomEquipment[]
  onEquipmentSelect: (equipmentId: string) => void
}

// TabButton 组件 - 与导航栏样式完全一致
interface TabButtonProps {
  tab: string
  isActive: boolean
  onClick?: () => void
  dataTab?: string
}

const TabButton: React.FC<TabButtonProps> = ({
  tab, isActive, onClick, dataTab
}) => {
  const baseClasses = 'text-xs font-medium tracking-widest whitespace-nowrap pb-3'
  const stateClasses = isActive
    ? 'text-neutral-800 dark:text-neutral-100'
    : 'cursor-pointer text-neutral-500 dark:text-neutral-400'

  const indicatorClasses = `absolute -bottom-3 left-0 right-0 z-10 h-px bg-neutral-800 dark:bg-neutral-100 ${
    isActive ? 'opacity-100 w-full' : 'opacity-0 w-0'
  }`

  return (
    <div
      onClick={onClick}
      className={`${baseClasses} ${stateClasses}`}
      data-tab={dataTab}
    >
      <span className="relative inline-block">
        {tab}
        <span className={indicatorClasses} />
      </span>
    </div>
  )
}

const EquipmentCategoryBar: React.FC<EquipmentCategoryBarProps> = ({
  selectedEquipment,
  customEquipments,
  onEquipmentSelect
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  // 合并所有器具数据
  const allEquipments = [
    ...equipmentList.map((eq) => ({ ...eq, isCustom: false })),
    ...customEquipments
  ]

  // 构建所有项目数据
  const allItems = allEquipments.map(equipment => ({
    type: 'equipment' as const,
    id: equipment.id,
    name: equipment.name,
    isSelected: selectedEquipment === equipment.id,
    isCustom: equipment.isCustom || false,
    onClick: () => onEquipmentSelect(equipment.id)
  }))

  // 滚动到选中项的函数
  const scrollToSelected = useCallback(() => {
    if (!scrollContainerRef.current || !selectedEquipment) return

    const selectedElement = scrollContainerRef.current.querySelector(`[data-tab="${selectedEquipment}"]`)
    if (!selectedElement) return

    const container = scrollContainerRef.current
    const containerRect = container.getBoundingClientRect()
    const elementRect = selectedElement.getBoundingClientRect()

    // 计算元素相对于容器的位置
    const elementLeft = elementRect.left - containerRect.left + container.scrollLeft
    const elementWidth = elementRect.width
    const containerWidth = containerRect.width

    // 计算目标滚动位置（将选中项居中）
    const targetScrollLeft = elementLeft - (containerWidth - elementWidth) / 2

    // 平滑滚动到目标位置
    container.scrollTo({
      left: Math.max(0, targetScrollLeft),
      behavior: 'smooth'
    })
  }, [selectedEquipment])

  // 当选中项变化时滚动到选中项
  useEffect(() => {
    // 延迟执行以确保DOM已更新
    const timer = setTimeout(scrollToSelected, 100)
    return () => clearTimeout(timer)
  }, [selectedEquipment, scrollToSelected])

  return (
    <div className="relative w-full overflow-hidden mb-3">
      <div
        ref={scrollContainerRef}
        className="flex items-center gap-4 overflow-x-auto border-b border-neutral-200 dark:border-neutral-800"
        style={{
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          WebkitOverflowScrolling: 'touch'
        }}
      >
        <style jsx>{`
          div::-webkit-scrollbar {
            display: none;
          }
        `}</style>

        {allItems.map((item) => (
          <div key={item.id} className="flex-shrink-0 flex items-center">
            <div className="whitespace-nowrap flex items-center relative">
              <TabButton
                tab={item.name}
                isActive={item.isSelected}
                onClick={item.onClick}
                dataTab={item.id}
              />
            </div>
          </div>
        ))}

        {/* 右侧渐变效果 - 当器具过多时显示 */}
        {allItems.length > 3 && (
          <div className="absolute top-0 right-0 w-6 h-full bg-gradient-to-l from-white/95 dark:from-neutral-900/95 to-transparent pointer-events-none" />
        )}
      </div>
    </div>
  )
}

export default EquipmentCategoryBar
