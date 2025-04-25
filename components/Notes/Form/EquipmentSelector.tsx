'use client'

import React from 'react'
import { type CustomEquipment } from '@/lib/config'

interface EquipmentSelectorProps {
  equipmentList: { id: string; name: string; description: string }[]
  customEquipments: CustomEquipment[]
  selectedEquipment: string
  onSelect: (equipmentId: string) => void
}

const EquipmentSelector: React.FC<EquipmentSelectorProps> = ({
  equipmentList,
  customEquipments,
  selectedEquipment,
  onSelect
}) => {
  return (
    <div className="space-y-6 py-4">
      <div className="space-y-2">
        <label className="block text-sm text-neutral-700 dark:text-neutral-300">
          选择器具
        </label>
        <div className="grid grid-cols-2 gap-2">
          {/* 标准器具列表 */}
          {equipmentList.map((equipment) => (
            <button
              key={equipment.id}
              type="button"
              onClick={() => onSelect(equipment.id)}
              className={`p-3 rounded-md text-sm text-left transition ${
                selectedEquipment === equipment.id
                  ? 'bg-neutral-800 dark:bg-neutral-200 text-neutral-100 dark:text-neutral-800'
                  : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300'
              }`}
            >
              <div className="font-medium">{equipment.name}</div>
              <div className="text-xs mt-1 line-clamp-1 opacity-80">
                {equipment.description}
              </div>
            </button>
          ))}
          
          {/* 自定义器具列表 */}
          {customEquipments.map((equipment) => (
            <button
              key={equipment.id}
              type="button"
              onClick={() => onSelect(equipment.id)}
              className={`p-3 rounded-md text-sm text-left transition ${
                selectedEquipment === equipment.id
                  ? 'bg-neutral-800 dark:bg-neutral-200 text-neutral-100 dark:text-neutral-800'
                  : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300'
              }`}
            >
              <div className="font-medium">{equipment.name}</div>
              <div className="text-xs mt-1 line-clamp-1 opacity-80">
                {equipment.description || '自定义器具'}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

export default EquipmentSelector 