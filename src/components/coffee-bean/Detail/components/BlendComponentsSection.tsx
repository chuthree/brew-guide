'use client';

import React from 'react';
import { CoffeeBean } from '@/types/app';

interface BlendComponentsSectionProps {
  bean: CoffeeBean | null;
  handleUpdateField: (updates: Partial<CoffeeBean>) => Promise<void>;
}

const BlendComponentsSection: React.FC<BlendComponentsSectionProps> = ({
  bean,
  handleUpdateField,
}) => {
  if (!bean?.blendComponents || bean.blendComponents.length <= 1) {
    return null;
  }

  // 处理拼配成分字段编辑
  const handleBlendFieldEdit = (
    index: number,
    field: 'origin' | 'estate' | 'process' | 'variety',
    value: string
  ) => {
    const updatedComponents = [...bean.blendComponents!];
    updatedComponents[index] = {
      ...updatedComponents[index],
      [field]: value.trim(),
    };
    handleUpdateField({ blendComponents: updatedComponents });
  };

  return (
    <div className="flex items-start">
      <div className="w-16 shrink-0 text-xs font-medium text-neutral-500 dark:text-neutral-400">
        拼配成分
      </div>
      <div className="space-y-2">
        {bean.blendComponents.map(
          (
            comp: {
              origin?: string;
              estate?: string;
              variety?: string;
              process?: string;
              percentage?: number;
            },
            index: number
          ) => (
            <div
              key={index}
              className="flex items-center gap-1 text-xs font-medium text-neutral-800 dark:text-neutral-100"
            >
              {/* 产地 */}
              {comp.origin && (
                <span
                  contentEditable
                  suppressContentEditableWarning
                  onBlur={e => {
                    const newValue = e.currentTarget.textContent?.trim() || '';
                    if (newValue !== comp.origin) {
                      handleBlendFieldEdit(index, 'origin', newValue);
                    }
                  }}
                  className="cursor-text outline-none"
                >
                  {comp.origin}
                </span>
              )}
              {/* 分隔符 */}
              {comp.origin && comp.estate && (
                <span className="text-neutral-400 dark:text-neutral-600">
                  ·
                </span>
              )}
              {/* 庄园 */}
              {comp.estate && (
                <span
                  contentEditable
                  suppressContentEditableWarning
                  onBlur={e => {
                    const newValue = e.currentTarget.textContent?.trim() || '';
                    if (newValue !== comp.estate) {
                      handleBlendFieldEdit(index, 'estate', newValue);
                    }
                  }}
                  className="cursor-text outline-none"
                >
                  {comp.estate}
                </span>
              )}
              {/* 分隔符 */}
              {(comp.origin || comp.estate) &&
                (comp.variety || comp.process) && (
                  <span className="text-neutral-400 dark:text-neutral-600">
                    ·
                  </span>
                )}
              {/* 品种 */}
              {comp.variety && (
                <span
                  contentEditable
                  suppressContentEditableWarning
                  onBlur={e => {
                    const newValue = e.currentTarget.textContent?.trim() || '';
                    if (newValue !== comp.variety) {
                      handleBlendFieldEdit(index, 'variety', newValue);
                    }
                  }}
                  className="cursor-text outline-none"
                >
                  {comp.variety}
                </span>
              )}
              {/* 分隔符 */}
              {comp.variety && comp.process && (
                <span className="text-neutral-400 dark:text-neutral-600">
                  ·
                </span>
              )}
              {/* 处理法 */}
              {comp.process && (
                <span
                  contentEditable
                  suppressContentEditableWarning
                  onBlur={e => {
                    const newValue = e.currentTarget.textContent?.trim() || '';
                    if (newValue !== comp.process) {
                      handleBlendFieldEdit(index, 'process', newValue);
                    }
                  }}
                  className="cursor-text outline-none"
                >
                  {comp.process}
                </span>
              )}
              {/* 百分比 */}
              {comp.percentage !== undefined && comp.percentage !== null && (
                <span className="ml-1 text-neutral-600 dark:text-neutral-400">
                  {comp.percentage}%
                </span>
              )}
            </div>
          )
        )}
      </div>
    </div>
  );
};

export default BlendComponentsSection;
