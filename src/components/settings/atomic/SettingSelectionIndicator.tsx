import React from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils/classNameUtils';

export type SettingSelectionIndicatorShape = 'circle' | 'square';

interface SettingSelectionIndicatorProps {
  selected: boolean;
  shape?: SettingSelectionIndicatorShape;
  className?: string;
}

const SettingSelectionIndicator: React.FC<SettingSelectionIndicatorProps> = ({
  selected,
  shape = 'circle',
  className,
}) => (
  <span
    aria-hidden="true"
    className={cn(
      'flex size-6 shrink-0 items-center justify-center transition-colors duration-200',
      shape === 'circle' ? 'rounded-full' : 'rounded-md',
      selected
        ? 'bg-neutral-600 text-white dark:bg-neutral-500'
        : 'bg-neutral-200 text-transparent dark:bg-neutral-700',
      className
    )}
  >
    {shape === 'circle' ? (
      <span
        className={cn(
          'size-2.5 rounded-full bg-white transition-transform duration-200',
          selected ? 'scale-100' : 'scale-0'
        )}
      />
    ) : (
      <Check
        className={cn(
          'size-4 transition-transform duration-200',
          selected ? 'scale-100' : 'scale-0'
        )}
        strokeWidth={2.5}
      />
    )}
  </span>
);

export default SettingSelectionIndicator;
