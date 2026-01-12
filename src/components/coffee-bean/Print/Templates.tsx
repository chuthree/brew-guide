'use client';

import React from 'react';
import { TemplateProps, PrintConfig } from './types';
import {
  extractBrandName,
  extractBeanName,
  getFlavorLine,
  getBottomInfoLine,
} from './utils';

// ============================================
// 简洁模板
// ============================================

export const MinimalTemplate: React.FC<TemplateProps> = ({
  config,
  content,
  formattedDate: _formattedDate,
}) => {
  const brandName = extractBrandName(content.name, config.brandName);
  const beanName = extractBeanName(content.name, config.brandName);
  const flavorLine = getFlavorLine(content.flavor);
  const bottomLine = getBottomInfoLine(content);

  const textStyle = {
    fontSize: `${config.fontSize}px`,
    fontWeight: config.fontWeight,
    lineHeight: 1.4,
  };

  return (
    <div className="flex h-full flex-col justify-between">
      <div className="space-y-1">
        {brandName && (
          <div
            style={{ ...textStyle, letterSpacing: '0.05em' }}
            className="text-center"
          >
            [ {brandName} ]
          </div>
        )}
        {beanName && <div style={textStyle}>{beanName}</div>}
        {flavorLine && <div style={textStyle}>{flavorLine}</div>}
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
    <div className="flex w-full gap-1">
      <span className="shrink-0">{label}:</span>
      <span className="wrap-break-word">{value}</span>
    </div>
  );
};

const shouldShow = (
  config: PrintConfig,
  field: keyof PrintConfig['fields'],
  value: unknown
): boolean => config.fields[field] && !!value;

export const DetailedTemplate: React.FC<TemplateProps> = ({
  config,
  content,
  formattedDate,
}) => {
  const { fields, fontSize, titleFontSize, fontWeight } = config;
  const validFlavors = content.flavor.filter(f => f.trim());

  return (
    <div className="flex h-full flex-col">
      {/* 标题 */}
      {shouldShow(config, 'name', content.name) && (
        <div className="mb-1.5 shrink-0 pb-1">
          <div
            style={{
              fontSize: `${titleFontSize}px`,
              fontWeight,
              lineHeight: 1.2,
            }}
          >
            {content.name}
          </div>
          <div
            className="mt-1 w-full"
            style={{ borderBottom: '1.5px solid #000' }}
          />
        </div>
      )}

      {/* 字段列表 */}
      <div
        className="flex flex-1 flex-wrap content-start"
        style={{
          fontSize: `${fontSize}px`,
          gap: `${Math.max(fontSize * 0.4, 4)}px`,
          lineHeight: 1.3,
        }}
      >
        <FieldRow
          show={shouldShow(config, 'roastDate', content.roastDate)}
          label="日期"
          value={formattedDate}
        />
        <FieldRow
          show={shouldShow(config, 'origin', content.origin)}
          label="产地"
          value={content.origin}
        />
        <FieldRow
          show={shouldShow(config, 'process', content.process)}
          label="处理"
          value={content.process}
        />
        <FieldRow
          show={shouldShow(config, 'variety', content.variety)}
          label="品种"
          value={content.variety}
        />
        <FieldRow
          show={shouldShow(config, 'roastLevel', content.roastLevel)}
          label="烘焙"
          value={content.roastLevel}
        />
        <FieldRow
          show={fields.flavor && validFlavors.length > 0}
          label="风味"
          value={validFlavors.join(' / ')}
        />
        <FieldRow
          show={shouldShow(config, 'notes', content.notes)}
          label="备注"
          value={content.notes}
        />
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
