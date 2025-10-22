import React from 'react';
import { Method, CustomEquipment } from '@/lib/core/config';

interface MethodPreviewCardProps {
  method: Method;
  customEquipment?: CustomEquipment;
}

const MethodPreviewCard: React.FC<MethodPreviewCardProps> = () => {
  return (
    <div className="flex aspect-square w-full max-w-md items-center justify-center bg-white dark:bg-neutral-900">
      <div className="text-xl text-neutral-500 dark:text-neutral-400">
        开发中...
      </div>
    </div>
  );
};

export default MethodPreviewCard;
