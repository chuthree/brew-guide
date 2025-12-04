'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { CoffeeBean } from '@/types/app';
import WelcomeScreen from './WelcomeScreen';
import IntroScreen from './IntroScreen';
import BeanCategoryScreen from './BeanCategoryScreen';
import CategoryFlowScreen from './CategoryFlowScreen';
import OriginCategoryScreen from './OriginCategoryScreen';
import VarietyCategoryScreen from './VarietyCategoryScreen';
import ProcessCategoryScreen from './ProcessCategoryScreen';
import FavoriteRoasterScreen from './FavoriteRoasterScreen';
import OriginDetailScreen from './OriginDetailScreen';
import VarietyDetailScreen from './VarietyDetailScreen';
import EndingScreen from './EndingScreen';

interface ScreenContentProps {
  screenIndex: number;
  direction: number;
  hasStarted: boolean;
  onStart: () => void;
  onNextScreen: () => void;
  onReplay: () => void;
  beanImages: string[];
  totalWeight: number;
  beans: CoffeeBean[];
}

/**
 * 屏幕内容组件 - 带过渡动画
 */
const ScreenContent: React.FC<ScreenContentProps> = ({
  screenIndex,
  direction,
  hasStarted,
  onStart,
  onNextScreen,
  onReplay,
  beanImages,
  totalWeight,
  beans,
}) => {
  // 滑动变体动画
  const variants = {
    enter: (dir: number) => ({
      x: dir > 0 ? 100 : -100,
      opacity: 0,
      scale: 0.95,
    }),
    center: {
      x: 0,
      opacity: 1,
      scale: 1,
    },
    exit: (dir: number) => ({
      x: dir > 0 ? -100 : 100,
      opacity: 0,
      scale: 0.95,
    }),
  };

  // 根据屏幕索引渲染不同内容
  const renderContent = () => {
    // 如果还没开始，显示欢迎屏幕
    if (!hasStarted && screenIndex === 0) {
      return <WelcomeScreen onComplete={onStart} />;
    }

    switch (screenIndex) {
      case 0:
        return (
          <IntroScreen
            beanImages={beanImages}
            totalWeight={totalWeight}
            beans={beans}
            onComplete={onNextScreen}
          />
        );
      case 1:
        return (
          <FavoriteRoasterScreen beans={beans} onComplete={onNextScreen} />
        );
      case 2:
        return (
          <CategoryFlowScreen
            beanImages={beanImages}
            totalWeight={totalWeight}
            beans={beans}
            onComplete={onNextScreen}
          />
        );
      case 3:
        return (
          <OriginCategoryScreen
            beanImages={beanImages}
            totalWeight={totalWeight}
            beans={beans}
            onComplete={onNextScreen}
          />
        );
      case 4:
        return (
          <VarietyCategoryScreen
            beanImages={beanImages}
            totalWeight={totalWeight}
            beans={beans}
            onComplete={onNextScreen}
          />
        );
      case 5:
        return (
          <ProcessCategoryScreen
            beanImages={beanImages}
            totalWeight={totalWeight}
            beans={beans}
            onComplete={onNextScreen}
          />
        );
      case 6:
        return (
          <OriginDetailScreen
            beanImages={beanImages}
            totalWeight={totalWeight}
            beans={beans}
            onComplete={onNextScreen}
          />
        );
      case 7:
        return (
          <VarietyDetailScreen
            beanImages={beanImages}
            totalWeight={totalWeight}
            beans={beans}
            onComplete={onNextScreen}
          />
        );
      case 8:
        return <EndingScreen onReplay={onReplay} />;
      default:
        return (
          <div className="flex h-full items-center justify-center">
            <span className="text-2xl font-bold text-white/80">
              第 {screenIndex + 1} 页
            </span>
          </div>
        );
    }
  };

  return (
    <motion.div
      className="absolute inset-0 pt-24"
      custom={direction}
      variants={variants}
      initial="enter"
      animate="center"
      exit="exit"
      transition={{
        x: { type: 'spring', stiffness: 300, damping: 30 },
        opacity: { duration: 0.3 },
        scale: { duration: 0.3 },
      }}
    >
      {renderContent()}
    </motion.div>
  );
};

export default ScreenContent;
