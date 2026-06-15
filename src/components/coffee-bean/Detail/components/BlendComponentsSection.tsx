'use client';

import React from 'react';
import { CoffeeBean } from '@/types/app';

interface BlendComponentsSectionProps {
  bean: CoffeeBean | null;
  isAddMode: boolean;
  handleUpdateField: (updates: Partial<CoffeeBean>) => Promise<void>;
}

const BlendComponentsSection: React.FC<BlendComponentsSectionProps> = ({
  bean,
  isAddMode,
  handleUpdateField,
}) => {
  if (isAddMode || !bean?.blendComponents || bean.blendComponents.length <= 1) {
    return null;
  }

  const visibleComponents = bean.blendComponents
    .map((component, index) => ({
      index,
      origin: component.origin?.trim() || '',
      region: component.region?.trim() || '',
      estate: component.estate?.trim() || '',
      lot: component.lot?.trim() || '',
      batch: component.batch?.trim() || '',
      station: component.station?.trim() || '',
      altitude: component.altitude?.trim() || '',
      season: component.season?.trim() || '',
      variety: component.variety?.trim() || '',
      process: component.process?.trim() || '',
      agtron: component.agtron?.trim() || '',
      percentage: component.percentage,
    }))
    .filter(
      component =>
        component.origin ||
        component.region ||
        component.estate ||
        component.lot ||
        component.batch ||
        component.station ||
        component.altitude ||
        component.season ||
        component.variety ||
        component.process ||
        component.agtron ||
        component.percentage !== undefined
    );

  if (visibleComponents.length <= 1) {
    return null;
  }

  // 处理拼配成分字段编辑
  const handleBlendFieldEdit = (
    index: number,
    field: 'origin' | 'region' | 'estate' | 'lot' | 'batch' | 'station' | 'altitude' | 'season' | 'process' | 'variety' | 'agtron',
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
        {visibleComponents.map(comp => (
          <div
            key={comp.index}
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
                    handleBlendFieldEdit(comp.index, 'origin', newValue);
                  }
                }}
                className="cursor-text outline-none"
              >
                {comp.origin}
              </span>
            )}
            {/* 分隔符 */}
            {comp.origin && comp.region && (
              <span className="text-neutral-400 dark:text-neutral-600">·</span>
            )}
            {/* 产区 */}
            {comp.region && (
              <span
                contentEditable
                suppressContentEditableWarning
                onBlur={e => {
                  const newValue = e.currentTarget.textContent?.trim() || '';
                  if (newValue !== comp.region) {
                    handleBlendFieldEdit(comp.index, 'region', newValue);
                  }
                }}
                className="cursor-text outline-none"
              >
                {comp.region}
              </span>
            )}
            {/* 分隔符 */}
            {(comp.origin || comp.region) && comp.estate && (
              <span className="text-neutral-400 dark:text-neutral-600">·</span>
            )}
            {/* 庄园 */}
            {comp.estate && (
              <span
                contentEditable
                suppressContentEditableWarning
                onBlur={e => {
                  const newValue = e.currentTarget.textContent?.trim() || '';
                  if (newValue !== comp.estate) {
                    handleBlendFieldEdit(comp.index, 'estate', newValue);
                  }
                }}
                className="cursor-text outline-none"
              >
                {comp.estate}
              </span>
            )}
            {/* 分隔符 */}
            {(comp.origin || comp.region || comp.estate) && comp.lot && (
              <span className="text-neutral-400 dark:text-neutral-600">·</span>
            )}
            {/* 地块 */}
            {comp.lot && (
              <span
                contentEditable
                suppressContentEditableWarning
                onBlur={e => {
                  const newValue = e.currentTarget.textContent?.trim() || '';
                  if (newValue !== comp.lot) {
                    handleBlendFieldEdit(comp.index, 'lot', newValue);
                  }
                }}
                className="cursor-text outline-none"
              >
                {comp.lot}
              </span>
            )}
            {/* 分隔符 */}
            {(comp.origin || comp.region || comp.estate || comp.lot) && comp.batch && (
              <span className="text-neutral-400 dark:text-neutral-600">·</span>
            )}
            {/* 批次 */}
            {comp.batch && (
              <span
                contentEditable
                suppressContentEditableWarning
                onBlur={e => {
                  const newValue = e.currentTarget.textContent?.trim() || '';
                  if (newValue !== comp.batch) {
                    handleBlendFieldEdit(comp.index, 'batch', newValue);
                  }
                }}
                className="cursor-text outline-none"
              >
                {comp.batch}
              </span>
            )}
            {/* 分隔符 */}
            {(comp.origin || comp.region || comp.estate || comp.lot || comp.batch) && comp.station && (
              <span className="text-neutral-400 dark:text-neutral-600">·</span>
            )}
            {/* 处理站 */}
            {comp.station && (
              <span
                contentEditable
                suppressContentEditableWarning
                onBlur={e => {
                  const newValue = e.currentTarget.textContent?.trim() || '';
                  if (newValue !== comp.station) {
                    handleBlendFieldEdit(comp.index, 'station', newValue);
                  }
                }}
                className="cursor-text outline-none"
              >
                {comp.station}
              </span>
            )}
            {/* 分隔符 */}
            {(comp.origin || comp.region || comp.estate || comp.lot || comp.batch || comp.station) && comp.process && (
              <span className="text-neutral-400 dark:text-neutral-600">·</span>
            )}
            {/* 处理法 */}
            {comp.process && (
              <span
                contentEditable
                suppressContentEditableWarning
                onBlur={e => {
                  const newValue = e.currentTarget.textContent?.trim() || '';
                  if (newValue !== comp.process) {
                    handleBlendFieldEdit(comp.index, 'process', newValue);
                  }
                }}
                className="cursor-text outline-none"
              >
                {comp.process}
              </span>
            )}
            {/* 分隔符 */}
            {(comp.origin || comp.region || comp.estate || comp.lot || comp.batch || comp.station || comp.process) && comp.variety && (
              <span className="text-neutral-400 dark:text-neutral-600">·</span>
            )}
            {/* 品种 */}
            {comp.variety && (
              <span
                contentEditable
                suppressContentEditableWarning
                onBlur={e => {
                  const newValue = e.currentTarget.textContent?.trim() || '';
                  if (newValue !== comp.variety) {
                    handleBlendFieldEdit(comp.index, 'variety', newValue);
                  }
                }}
                className="cursor-text outline-none"
              >
                {comp.variety}
              </span>
            )}
            {/* 分隔符 */}
            {(comp.origin || comp.region || comp.estate || comp.lot || comp.batch || comp.station || comp.process || comp.variety) && comp.altitude && (
              <span className="text-neutral-400 dark:text-neutral-600">·</span>
            )}
            {/* 海拔 */}
            {comp.altitude && (
              <span
                contentEditable
                suppressContentEditableWarning
                onBlur={e => {
                  const newValue = e.currentTarget.textContent?.trim() || '';
                  if (newValue !== comp.altitude) {
                    handleBlendFieldEdit(comp.index, 'altitude', newValue);
                  }
                }}
                className="cursor-text outline-none"
              >
                {comp.altitude}
              </span>
            )}
            {/* 分隔符 */}
            {(comp.origin || comp.region || comp.estate || comp.lot || comp.batch || comp.station || comp.process || comp.variety || comp.altitude) && comp.season && (
              <span className="text-neutral-400 dark:text-neutral-600">·</span>
            )}
            {/* 产季 */}
            {comp.season && (
              <span
                contentEditable
                suppressContentEditableWarning
                onBlur={e => {
                  const newValue = e.currentTarget.textContent?.trim() || '';
                  if (newValue !== comp.season) {
                    handleBlendFieldEdit(comp.index, 'season', newValue);
                  }
                }}
                className="cursor-text outline-none"
              >
                {comp.season}
              </span>
            )}
            {/* 分隔符 */}
            {(comp.origin || comp.region || comp.estate || comp.lot || comp.batch || comp.station || comp.process || comp.variety || comp.altitude || comp.season) && comp.agtron && (
              <span className="text-neutral-400 dark:text-neutral-600">·</span>
            )}
            {/* Agtron值 */}
            {comp.agtron && (
              <span
                contentEditable
                suppressContentEditableWarning
                onBlur={e => {
                  const newValue = e.currentTarget.textContent?.trim() || '';
                  if (newValue !== comp.agtron) {
                    handleBlendFieldEdit(comp.index, 'agtron', newValue);
                  }
                }}
                className="cursor-text outline-none"
              >
                {comp.agtron}
              </span>
            )}
            {/* 百分比 */}
            {comp.percentage !== undefined && comp.percentage !== null && (
              <span className="ml-1 text-neutral-600 dark:text-neutral-400">
                {comp.percentage}%
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default BlendComponentsSection;
