'use client';

import React from 'react';
import type { BeanScreenProps } from '../../types';
import TopStatsList from '../BeanCategoryScreen/TopStatsList';

/**
 * 产地分类屏 - 单独展示产地统计
 */
const OriginCategoryScreen: React.FC<BeanScreenProps> = ({
  beans,
  onComplete,
}) => {
  return (
    <div className="absolute inset-0">
      <TopStatsList beans={beans} type="origin" onComplete={onComplete} />
    </div>
  );
};

export default OriginCategoryScreen;
