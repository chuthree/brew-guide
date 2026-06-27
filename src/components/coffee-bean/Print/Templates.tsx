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
  formattedPackDate,
}) => {
  const { fontSize, fontWeight } = config;
  const validFlavors = content.flavor.filter(f => f.trim());
  const displayBeanName = getDisplayBeanName(content);
  const showName = isPrintFieldVisible('name', config, content);
  const weightValue = content.weight
    ? content.weight.trim().toLowerCase().endsWith('g')
      ? content.weight
      : `${content.weight}g`
    : '';
  const rows = [
    {
      key: 'roastDate',
      label: PRINT_FIELD_LABELS.roastDate,
      value: formattedDate,
      show: isPrintFieldVisible('roastDate', config, content),
    },
    {
      key: 'packDate',
      label: '分装',
      value: formattedPackDate,
      show:
        config.fields.roastDate &&
        config.fields.packDate &&
        Boolean(content.packDate.trim()),
    },
    {
      key: 'origin',
      label: PRINT_FIELD_LABELS.origin,
      value: content.origin,
      show: isPrintFieldVisible('origin', config, content),
    },
    {
      key: 'estate',
      label: PRINT_FIELD_LABELS.estate,
      value: content.estate,
      show: isPrintFieldVisible('estate', config, content),
    },
    {
      key: 'process',
      label: PRINT_FIELD_LABELS.process,
      value: content.process,
      show: isPrintFieldVisible('process', config, content),
    },
    {
      key: 'variety',
      label: PRINT_FIELD_LABELS.variety,
      value: content.variety,
      show: isPrintFieldVisible('variety', config, content),
    },
    {
      key: 'roastLevel',
      label: PRINT_FIELD_LABELS.roastLevel,
      value: content.roastLevel,
      show: isPrintFieldVisible('roastLevel', config, content),
    },
    {
      key: 'flavor',
      label: PRINT_FIELD_LABELS.flavor,
      value: validFlavors.join('/'),
      show: isPrintFieldVisible('flavor', config, content),
    },
    {
      key: 'weight',
      label: PRINT_FIELD_LABELS.weight,
      value: weightValue,
      show: isPrintFieldVisible('weight', config, content),
    },
    {
      key: 'notes',
      label: PRINT_FIELD_LABELS.notes,
      value: content.notes,
      show: isPrintFieldVisible('notes', config, content),
    },
  ] as const;

  return (
    <div
      style={{
        display: 'flex',
        height: '100%',
        flexDirection: 'column',
      }}
    >
      {/* 标题 */}
      {showName && (
        <div
          style={{
            marginTop: '0.2rem',
            marginBottom: '0.35rem',
            flexShrink: 0,
          }}
        >
          <div
            style={{
              fontSize: `${fontSize}px`,
              fontWeight,
              lineHeight: 1.2,
            }}
          >
            {displayBeanName}
          </div>
        </div>
      )}

      {showName && config.fields.nameSeparator && (
        <div
          style={{
            borderTop: '1px solid currentColor',
            marginBottom: '0.35rem',
            flexShrink: 0,
          }}
        />
      )}

      {/* 字段列表 */}
      <div
        style={{
          display: 'flex',
          flex: config.fields.contentBottomAligned ? '1 1 0%' : undefined,
          flexWrap: 'wrap',
          alignContent: config.fields.contentBottomAligned
            ? 'flex-end'
            : 'flex-start',
          fontSize: `${fontSize}px`,
          gap: `${Math.max(fontSize * 0.4, 4)}px`,
          lineHeight: 1,
        }}
      >
        {rows.map(({ key, label, value, show }) => (
          <FieldRow key={key} show={show} label={label} value={value} />
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
