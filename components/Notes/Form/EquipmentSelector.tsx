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
    <div className="py-3">
      <div>
        <label className="text-xs font-medium text-neutral-800 dark:text-neutral-200 mb-6 block">
          选择器具
        </label>
        <div className="space-y-5">
          {/* 标准器具列表 */}
          {equipmentList.map((equipment) => (
            <div 
              key={equipment.id}
              className="group relative text-neutral-500 dark:text-neutral-400"
              onClick={() => onSelect(equipment.id)}
            >
              <div className={`group relative border-l ${selectedEquipment === equipment.id ? 'border-neutral-800 dark:border-white' : 'border-neutral-200 dark:border-neutral-800'} pl-6 cursor-pointer`}>
                {selectedEquipment === equipment.id && (
                  <div className="absolute -left-px top-0 h-full w-px bg-neutral-800 dark:bg-white"></div>
                )}
                <div className="cursor-pointer">
                  <div className="flex items-baseline justify-between">
                    <div className="flex items-baseline gap-3 min-w-0 overflow-hidden">
                      <h3 className="text-xs font-normal tracking-wider truncate">
                        {equipment.name}
                      </h3>
                    </div>
                  </div>
                  <div className="mt-2">
                    <p className="text-xs font-light">
                      {equipment.description}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ))}
          
          {/* 自定义器具列表 */}
          {customEquipments.map((equipment) => (
            <div 
              key={equipment.id}
              className="group relative text-neutral-500 dark:text-neutral-400"
              onClick={() => onSelect(equipment.id)}
            >
              <div className={`group relative border-l ${selectedEquipment === equipment.id ? 'border-neutral-800 dark:border-white' : 'border-neutral-200 dark:border-neutral-800'} pl-6 cursor-pointer`}>
                {selectedEquipment === equipment.id && (
                  <div className="absolute -left-px top-0 h-full w-px bg-neutral-800 dark:bg-white"></div>
                )}
                <div className="cursor-pointer">
                  <div className="flex items-baseline justify-between">
                    <div className="flex items-baseline gap-3 min-w-0 overflow-hidden">
                      <h3 className="text-xs font-normal tracking-wider truncate">
                        {equipment.name}
                      </h3>
                    </div>
                  </div>
                  <div className="mt-2">
                    <p className="text-xs font-light">
                      {equipment.description || '自定义器具'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default EquipmentSelector 