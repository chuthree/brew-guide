'use client';

import React from 'react';
import type { BeanScreenProps } from '../../types';
import TopStatsList from '../BeanCategoryScreen/TopStatsList';

/**
 * 处理法分类屏 - 单独展示处理法统计
 */
const ProcessCategoryScreen: React.FC<BeanScreenProps> = ({
  beans,
  onComplete,
}) => {
  return (
    <div className="absolute inset-0">
      <TopStatsList beans={beans} type="process" onComplete={onComplete} />
    </div>
  );
};

export default ProcessCategoryScreen;
