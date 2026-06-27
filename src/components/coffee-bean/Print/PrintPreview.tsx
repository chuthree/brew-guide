'use client';

import React, { useMemo } from 'react';
import { PrintConfig, EditableContent, PrintIconPlacement } from './types';
import { formatDate, getPreviewDimensions } from './utils';
import { DetailedTemplate, MinimalTemplate } from './Templates';
import { isPrintFieldVisible } from './fields';
import { PrintIconLayer } from './PrintIconLayer';

interface PrintPreviewProps {
  config: PrintConfig;
  content: EditableContent;
  onUpdateIconPlacement: (placement: PrintIconPlacement) => void;
}

export const PrintPreview: React.FC<PrintPreviewProps> = ({
  config,
  content,
  onUpdateIconPlacement,
}) => {
  const dimensions = getPreviewDimensions(config);
  const formattedDate = useMemo(
    () => (content.roastDate ? formatDate(content.roastDate) : ''),
    [content.roastDate]
  );
  const formattedPackDate = useMemo(
    () => (content.packDate ? formatDate(content.packDate) : ''),
    [content.packDate]
  );

  return (
    <div className="border-t border-neutral-200/50 pt-4 dark:border-neutral-800">
      <div className="flex justify-center rounded bg-neutral-100 p-4 dark:bg-neutral-800">
        <div
          id="print-preview"
          className="select-text"
          style={{
            width: dimensions.width,
            height: dimensions.height,
            padding: `${config.margin}mm`,
            position: 'relative',
            fontSize: `${config.fontSize}px`,
            backgroundColor: '#ffffff',
            color: '#000000',
            lineHeight: 1.4,
            fontFamily:
              '"Noto Sans SC Print", "Noto Sans SC", "Microsoft YaHei", "SimHei", "PingFang SC", Arial, sans-serif',
            fontWeight: config.fontWeight,
            letterSpacing: '0.02em',
            wordBreak: 'keep-all',
            whiteSpace: 'normal',
            overflow: 'hidden',
            cursor: 'text',
            userSelect: 'text',
            WebkitUserSelect: 'text',
          }}
        >
          {config.template === 'minimal' ? (
            <MinimalTemplate
              config={config}
              content={content}
              formattedDate={formattedDate}
              formattedPackDate={formattedPackDate}
            />
          ) : (
            <DetailedTemplate
              config={config}
              content={content}
              formattedDate={formattedDate}
              formattedPackDate={formattedPackDate}
            />
          )}
          {isPrintFieldVisible('icon', config, content) && (
            <PrintIconLayer
              icon={content.icon}
              margin={config.margin}
              placement={config.iconPlacement}
              onPlacementChange={onUpdateIconPlacement}
            />
          )}
        </div>
      </div>
    </div>
  );
};
