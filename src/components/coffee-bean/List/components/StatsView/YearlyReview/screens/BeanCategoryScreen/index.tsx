'use client';

import React, { useState } from 'react';
import type { BeanScreenProps } from '../../types';
import CategoryFlow from './CategoryFlow';
import TopStatsList from './TopStatsList';
import { AnimatePresence, motion } from 'framer-motion';

const BeanCategoryScreen: React.FC<BeanScreenProps> = ({
  beans,
  beanImages,
  onComplete,
}) => {
  // 0: CategoryFlow, 1: 产地, 2: 品种, 3: 处理法
  const [step, setStep] = useState(0);

  const handleFlowComplete = () => {
    setStep(1);
  };

  const handleOriginComplete = () => {
    setStep(2);
  };

  const handleVarietyComplete = () => {
    setStep(3);
  };

  return (
    <div className="absolute inset-0">
      <AnimatePresence mode="wait">
        {step === 0 && (
          <motion.div
            key="flow"
            className="absolute inset-0"
            exit={{ opacity: 0, transition: { duration: 0.3 } }}
          >
            <CategoryFlow images={beanImages} onComplete={handleFlowComplete} />
          </motion.div>
        )}
        {step === 1 && (
          <motion.div
            key="origin"
            className="absolute inset-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.3 } }}
            transition={{ duration: 0.3 }}
          >
            <TopStatsList
              beans={beans}
              type="origin"
              onComplete={handleOriginComplete}
            />
          </motion.div>
        )}
        {step === 2 && (
          <motion.div
            key="variety"
            className="absolute inset-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.3 } }}
            transition={{ duration: 0.3 }}
          >
            <TopStatsList
              beans={beans}
              type="variety"
              onComplete={handleVarietyComplete}
            />
          </motion.div>
        )}
        {step === 3 && (
          <motion.div
            key="process"
            className="absolute inset-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
          >
            <TopStatsList
              beans={beans}
              type="process"
              onComplete={onComplete}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default BeanCategoryScreen;
