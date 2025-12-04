'use client';

import React from 'react';
import type { BeanScreenProps } from '../../types';
import CategoryFlow from '../BeanCategoryScreen/CategoryFlow';

/**
 * 分类流动屏 - "每次买的咖啡豆都不一样" + "让我看看都买了些啥"
 */
const CategoryFlowScreen: React.FC<BeanScreenProps> = ({
  beanImages,
  onComplete,
}) => {
  return (
    <div className="absolute inset-0">
      <CategoryFlow images={beanImages} onComplete={onComplete} />
    </div>
  );
};

export default CategoryFlowScreen;
