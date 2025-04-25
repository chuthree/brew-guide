'use client'

import React from 'react'
import type { CoffeeBean } from '@/app/types'

interface CoffeeBeanSelectorProps {
  coffeeBeans: CoffeeBean[]
  selectedCoffeeBean: CoffeeBean | null
  onSelect: (bean: CoffeeBean | null) => void
}

const CoffeeBeanSelector: React.FC<CoffeeBeanSelectorProps> = ({
  coffeeBeans,
  selectedCoffeeBean,
  onSelect
}) => {
  return (
    <div className="space-y-6 py-4">
      <div className="space-y-2">
        <label className="block text-sm text-neutral-700 dark:text-neutral-300">
          选择咖啡豆
        </label>
        <div className="space-y-2">
          {/* 添加不选择咖啡豆的选项 */}
          <button
            type="button"
            onClick={() => onSelect(null)}
            className={`w-full p-3 rounded-md text-sm text-left transition ${
              selectedCoffeeBean === null
                ? 'bg-neutral-800 dark:bg-neutral-200 text-neutral-100 dark:text-neutral-800'
                : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300'
            }`}
          >
            <div className="font-medium">不选择咖啡豆</div>
            <div className="text-xs mt-1 opacity-80">
              不记录咖啡豆信息，也不会减少咖啡豆剩余量
            </div>
          </button>

          {coffeeBeans.length > 0 ? (
            coffeeBeans.map((bean) => (
              <button
                key={bean.id}
                type="button"
                onClick={() => onSelect(bean)}
                className={`w-full p-3 rounded-md text-sm text-left transition ${
                  selectedCoffeeBean?.id === bean.id
                    ? 'bg-neutral-800 dark:bg-neutral-200 text-neutral-100 dark:text-neutral-800'
                    : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300'
                }`}
              >
                <div className="font-medium">{bean.name}</div>
                <div className="text-xs mt-1 opacity-80 flex flex-wrap gap-1">
                  <span>{bean.roastLevel || '未知烘焙度'}</span>
                  <span>·</span>
                  <span>剩余: {bean.remaining}g</span>
                  {bean.roastDate && (
                    <>
                      <span>·</span>
                      <span>烘焙日期: {bean.roastDate}</span>
                    </>
                  )}
                </div>
              </button>
            ))
          ) : (
            <div className="text-sm text-neutral-500 dark:text-neutral-400 p-3 bg-neutral-100 dark:bg-neutral-800 rounded-md">
              没有可用的咖啡豆，请先添加咖啡豆
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default CoffeeBeanSelector 