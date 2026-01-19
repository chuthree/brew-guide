'use client';

import React, { useMemo } from 'react';
import { PrintConfig, EditableContent } from './types';
import { formatDate, getPreviewDimensions } from './utils';
import { getTemplateComponent } from './Templates';

interface PrintPreviewProps {
  config: PrintConfig;
  content: EditableContent;
}

export const PrintPreview: React.FC<PrintPreviewProps> = ({
  config,
  content,
}) => {
  const dimensions = getPreviewDimensions(config);
  const formattedDate = useMemo(
    () => (content.roastDate ? formatDate(content.roastDate) : ''),
    [content.roastDate]
  );

  const TemplateComponent = getTemplateComponent(config.template);

  return (
    <div className="border-t border-neutral-200/50 pt-4 dark:border-neutral-800">
      <div className="mb-3 text-xs text-neutral-500 dark:text-neutral-400">
        预览
      </div>
      <div className="flex justify-center rounded bg-neutral-100 p-4 dark:bg-neutral-800">
        <div
          id="print-preview"
          style={{
            width: dimensions.width,
            height: dimensions.height,
            padding: `${config.margin}mm`,
            fontSize: `${config.fontSize}px`,
            backgroundColor: '#ffffff',
            color: '#000000',
            lineHeight: 1.4,
            fontFamily:
              '"Noto Sans SC Print", "Noto Sans SC", "Microsoft YaHei", "SimHei", "PingFang SC", Arial, sans-serif',
            fontWeight: config.fontWeight,
            letterSpacing: '0.02em',
            wordBreak: 'keep-all',
          }}
          className="overflow-hidden"
        >
          <TemplateComponent
            config={config}
            content={content}
            formattedDate={formattedDate}
          />
        </div>
      </div>
    </div>
  );
};
