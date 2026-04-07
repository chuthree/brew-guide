'use client';

import React from 'react';
import { TemplateProps } from './types';
import { PRINT_FIELD_LABELS, isPrintFieldVisible } from './fields';
import { getFlavorLine, getBottomInfoLine, getDisplayBeanName } from './utils';

// ============================================
// 简洁模板
// ============================================

export const MinimalTemplate: React.FC<TemplateProps> = ({
  config,
  content,
  formattedDate: _formattedDate,
}) => {
  const roaster = content.roaster.trim();
  const beanName = content.name.trim();
  const flavorLine = getFlavorLine(content.flavor);
  const bottomLine = getBottomInfoLine(content, config);
  const showName = isPrintFieldVisible('name', config, content);
  const showFlavor = isPrintFieldVisible('flavor', config, content);

  const textStyle = {
    fontSize: `${config.fontSize}px`,
    fontWeight: config.fontWeight,
    lineHeight: 1.4,
  };

  return (
    <div
      style={{
        display: 'flex',
        height: '100%',
        flexDirection: 'column',
        justifyContent: 'space-between',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        {showName && roaster && (
          <div
            style={{
              ...textStyle,
              letterSpacing: '0.05em',
              textAlign: 'center',
            }}
          >
            [ {roaster} ]
          </div>
        )}
        {showName && beanName && <div style={textStyle}>{beanName}</div>}
        {showFlavor && <div style={textStyle}>{flavorLine}</div>}
      </div>
      {bottomLine && <div style={textStyle}>{bottomLine}</div>}
    </div>
  );
};

// ============================================
// 详细模板
// ============================================

const FieldRow: React.FC<{
  show: boolean;
  label: string;
  value?: string;
}> = ({ show, label, value }) => {
  if (!show || !value) return null;
  return (
    <div style={{ display: 'flex', width: '100%', gap: '0.25rem' }}>
      <span style={{ flexShrink: 0 }}>{label}:</span>
      <span style={{ wordBreak: 'keep-all' }}>{value}</span>
    </div>
  );
};

export const DetailedTemplate: React.FC<TemplateProps> = ({
  config,
  content,
  formattedDate,
}) => {
  const { fontSize, titleFontSize, fontWeight } = config;
  const validFlavors = content.flavor.filter(f => f.trim());
  const displayBeanName = getDisplayBeanName(content);
  const weightValue = content.weight
    ? content.weight.trim().toLowerCase().endsWith('g')
      ? content.weight
      : `${content.weight}g`
    : '';
  const rows = [
    { field: 'roastDate', value: formattedDate },
    { field: 'origin', value: content.origin },
    { field: 'estate', value: content.estate },
    { field: 'process', value: content.process },
    { field: 'variety', value: content.variety },
    { field: 'roastLevel', value: content.roastLevel },
    { field: 'flavor', value: validFlavors.join(' / ') },
    { field: 'weight', value: weightValue },
    { field: 'notes', value: content.notes },
  ] as const;

  return (
    <div style={{ display: 'flex', height: '100%', flexDirection: 'column' }}>
      {/* 标题 */}
      {isPrintFieldVisible('name', config, content) && (
        <div
          style={{
            marginBottom: '0.375rem',
            flexShrink: 0,
          }}
        >
          <div
            style={{
              fontSize: `${titleFontSize}px`,
              fontWeight,
              lineHeight: 1.2,
            }}
          >
            {displayBeanName}
          </div>
          <div
            style={{
              marginTop: '0.25rem',
              width: '100%',
              borderBottom: '1.5px solid #000',
            }}
          />
        </div>
      )}

      {/* 字段列表 */}
      <div
        style={{
          display: 'flex',
          flex: '1 1 0%',
          flexWrap: 'wrap',
          alignContent: 'flex-start',
          fontSize: `${fontSize}px`,
          gap: `${Math.max(fontSize * 0.4, 4)}px`,
          lineHeight: 1.3,
        }}
      >
        {rows.map(({ field, value }) => (
          <FieldRow
            key={field}
            show={isPrintFieldVisible(field, config, content)}
            label={PRINT_FIELD_LABELS[field]}
            value={value}
          />
        ))}
      </div>
    </div>
  );
};

// ============================================
// 模板选择器
// ============================================

export const getTemplateComponent = (
  templateId: string
): React.FC<TemplateProps> => {
  return templateId === 'minimal' ? MinimalTemplate : DetailedTemplate;
};
