'use client';

import React from 'react';
import type { BeanScreenProps } from '../../types';
import TopStatsList from '../BeanCategoryScreen/TopStatsList';

/**
 * 品种分类屏 - 单独展示品种统计
 */
const VarietyCategoryScreen: React.FC<BeanScreenProps> = ({
  beans,
  onComplete,
}) => {
  return (
    <div className="absolute inset-0">
      <TopStatsList beans={beans} type="variety" onComplete={onComplete} />
    </div>
  );
};

export default VarietyCategoryScreen;
