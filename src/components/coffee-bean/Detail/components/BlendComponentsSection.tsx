'use client';

import React from 'react';
import { BlendComponent, CoffeeBean } from '@/types/app';
import { hasStructuredOriginFields } from '@/lib/coffee-beans/beanFields';

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
    .map((component, index) => {
      const hasStructuredOrigin = hasStructuredOriginFields(component);

      return {
        index,
        origin: hasStructuredOrigin ? '' : component.origin?.trim() || '',
        country: component.country?.trim() || '',
        region: component.region?.trim() || '',
        estate: component.estate?.trim() || '',
        altitude: component.altitude?.trim() || '',
        batch: component.batch?.trim() || '',
        variety: component.variety?.trim() || '',
        process: component.process?.trim() || '',
        percentage: component.percentage,
      };
    })
    .filter(
      component =>
        component.origin ||
        component.country ||
        component.region ||
        component.estate ||
        component.altitude ||
        component.batch ||
        component.variety ||
        component.process ||
        component.percentage !== undefined
    );

  if (visibleComponents.length <= 1) {
    return null;
  }

  // 处理拼配成分字段编辑
  const handleBlendFieldEdit = (
    index: number,
    field: Exclude<keyof BlendComponent, 'percentage'>,
    value: string
  ) => {
    const updatedComponents = [...bean.blendComponents!];
    updatedComponents[index] = {
      ...updatedComponents[index],
      [field]: value.trim(),
    };
    handleUpdateField({ blendComponents: updatedComponents });
  };

  const renderFieldValue = (
    comp: (typeof visibleComponents)[number],
    field: Exclude<keyof BlendComponent, 'percentage'>,
    label: string,
    value: string
  ) => {
    if (!value) return null;

    return (
      <span className="inline-flex items-center gap-0.5">
        <span className="text-neutral-500 dark:text-neutral-400">{label}</span>
        <span
          contentEditable
          suppressContentEditableWarning
          onBlur={e => {
            const newValue = e.currentTarget.textContent?.trim() || '';
            if (newValue !== value) {
              handleBlendFieldEdit(comp.index, field, newValue);
            }
          }}
          className="cursor-text outline-none"
        >
          {value}
        </span>
      </span>
    );
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
            className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-medium text-neutral-800 dark:text-neutral-100"
          >
            {renderFieldValue(comp, 'origin', '产地', comp.origin)}
            {renderFieldValue(comp, 'country', '产国', comp.country)}
            {renderFieldValue(comp, 'region', '产区', comp.region)}
            {renderFieldValue(comp, 'estate', '庄园', comp.estate)}
            {renderFieldValue(comp, 'altitude', '海拔', comp.altitude)}
            {renderFieldValue(comp, 'process', '处理法', comp.process)}
            {renderFieldValue(comp, 'batch', '批次', comp.batch)}
            {renderFieldValue(comp, 'variety', '品种', comp.variety)}
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
