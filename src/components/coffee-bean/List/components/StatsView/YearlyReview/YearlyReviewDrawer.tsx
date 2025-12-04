'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { Drawer } from 'vaul';
import { motion, AnimatePresence } from 'framer-motion';
import { GrainGradient } from '@paper-design/shaders-react';
import { X } from 'lucide-react';
import { useModalHistory } from '@/lib/hooks/useModalHistory';
import { useThemeColor } from '@/lib/hooks/useThemeColor';
import { useCoffeeBeanStore } from '@/lib/stores/coffeeBeanStore';
import { useBrewingNoteStore } from '@/lib/stores/brewingNoteStore';
import { Storage } from '@/lib/core/storage';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';

import {
  TOTAL_SCREENS,
  PROGRESS_SCREENS,
  WELCOME_THEME,
  SCREEN_THEMES,
  ENDING_THEME,
  REPORT_THEME,
  SCREEN_DURATIONS,
} from './constants';
import { useColorTransition } from './hooks';
import { ScreenContent } from './screens';

// 注册 GSAP React 插件
gsap.registerPlugin(useGSAP);

interface YearlyReviewDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * 年度回顾抽屉组件
 * 类似 Instagram/Spotify 年度回顾的 Stories 风格设计
 */
const YearlyReviewDrawer: React.FC<YearlyReviewDrawerProps> = ({
  isOpen,
  onClose,
}) => {
  // 当前进度（0-2，对应 3 个屏幕）
  const [currentScreen, setCurrentScreen] = useState(0);
  // 滑动方向：1 = 向右/下一个，-1 = 向左/上一个
  const [direction, setDirection] = useState(0);
  // 是否已经开始播放动画
  const [hasStarted, setHasStarted] = useState(false);
  // 用户名
  const [username, setUsername] = useState('COFFEE');

  // 获取咖啡豆数据
  const beans = useCoffeeBeanStore(state => state.beans);

  // 获取冲煮笔记数据
  const notes = useBrewingNoteStore(state => state.notes);

  // 提取有图片的咖啡豆图片列表（最少 5 张，不足时重复）
  const beanImages = useMemo(() => {
    const images = beans
      .filter(bean => bean.image && bean.image.trim() !== '')
      .slice(0, 5)
      .map(bean => bean.image as string);

    // 如果有图片但不足 5 张，重复填充
    if (images.length > 0 && images.length < 5) {
      const result: string[] = [];
      for (let i = 0; i < 5; i++) {
        result.push(images[i % images.length]);
      }
      return result;
    }

    return images;
  }, [beans]);

  // 计算今年购买的咖啡豆总重量（克）
  const totalWeight = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return beans
      .filter(bean => {
        const beanYear = new Date(bean.timestamp).getFullYear();
        return beanYear === currentYear;
      })
      .reduce((total, bean) => {
        if (bean.capacity) {
          const match = bean.capacity.match(/(\d+(?:\.\d+)?)/);
          if (match) {
            return total + parseFloat(match[1]);
          }
        }
        return total;
      }, 0);
  }, [beans]);

  // 生成稳定的唯一 ID
  const [autoId] = useState(
    () =>
      `yearly-review-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
  );

  // 同步顶部安全区颜色
  useThemeColor({ useOverlay: true, enabled: isOpen });

  // 集成历史栈管理，支持返回键关闭
  useModalHistory({
    id: autoId,
    isOpen,
    onClose,
  });

  // 处理打开状态变化
  const handleOpenChange = (open: boolean) => {
    if (!open) {
      onClose();
    }
  };

  // 获取用户名
  useEffect(() => {
    const loadUsername = async () => {
      try {
        const settingsStr = await Storage.get('brewGuideSettings');
        if (settingsStr) {
          const settings = JSON.parse(settingsStr);
          const name = settings.username?.trim();
          if (name) {
            setUsername(name.toUpperCase());
          }
        }
      } catch (e) {
        console.error('解析用户设置失败', e);
      }
    };
    loadUsername();
  }, []);

  // 重置进度当抽屉关闭后重新打开
  useEffect(() => {
    if (isOpen) {
      setCurrentScreen(0);
      setDirection(0);
      setHasStarted(false);
    }
  }, [isOpen]);

  // 开始播放动画
  const handleStart = () => {
    setHasStarted(true);
  };

  // 导航到上一屏
  const goToPrevScreen = () => {
    if (!hasStarted) return;
    if (currentScreen > 0) {
      setDirection(-1);
      setCurrentScreen(prev => prev - 1);
    }
  };

  // 导航到下一屏
  const goToNextScreen = () => {
    if (!hasStarted) return;
    if (currentScreen < TOTAL_SCREENS - 1) {
      setDirection(1);
      setCurrentScreen(prev => prev + 1);
    }
  };

  // 重播 - 重置到欢迎页
  const handleReplay = () => {
    setDirection(-1);
    setCurrentScreen(0);
    setHasStarted(false);
  };

  // 根据当前屏幕选择主题颜色
  const getCurrentTheme = () => {
    if (!hasStarted) return WELCOME_THEME;
    // 最后一屏使用报告主题（咖啡棕）
    if (currentScreen === TOTAL_SCREENS - 1) return REPORT_THEME;
    // 倒数第二屏使用结束主题（蓝色）
    if (currentScreen === TOTAL_SCREENS - 2) return ENDING_THEME;
    // 其他屏幕使用对应主题
    return SCREEN_THEMES[currentScreen] || WELCOME_THEME;
  };

  const currentTheme = getCurrentTheme();

  // 使用颜色过渡 Hook 实现平滑切换
  const transitionedColors = useColorTransition(currentTheme.colors, 800);

  return (
    <>
      {/* 预加载 GrainGradient - 1px 不可见像素提前初始化 WebGL shader */}
      {!isOpen && (
        <div
          style={{
            position: 'fixed',
            width: 1,
            height: 1,
            opacity: 0,
            pointerEvents: 'none',
            overflow: 'hidden',
          }}
          aria-hidden="true"
        >
          <GrainGradient
            colors={WELCOME_THEME.colors}
            colorBack={WELCOME_THEME.colors[2]}
            style={{ width: 1, height: 1 }}
          />
        </div>
      )}
      <Drawer.Root
        open={isOpen}
        onOpenChange={handleOpenChange}
        repositionInputs={false}
      >
        <Drawer.Portal>
          {/* 背景遮罩 */}
          <Drawer.Overlay
            className="fixed! inset-0 z-50 bg-black/50"
            style={{ position: 'fixed' }}
          />

          {/* 抽屉内容 - 固定高度，几乎占满屏幕 */}
          <Drawer.Content
            className="fixed inset-x-0 bottom-0 z-50 mx-auto flex max-w-[500px] flex-col rounded-t-3xl outline-none"
            style={{
              height: 'calc(100dvh - 24px)',
            }}
            aria-describedby={undefined}
          >
            {/* 无障碍标题 - 视觉隐藏 */}
            <Drawer.Title className="sr-only">年度回顾</Drawer.Title>

            {/* GrainGradient 背景 - 横向拉丝波浪效果 */}
            <div className="absolute inset-0 overflow-hidden rounded-t-3xl">
              <GrainGradient
                colors={transitionedColors}
                colorBack={transitionedColors[2]}
                shape="wave"
                speed={0.8}
                softness={0.8}
                intensity={0.5}
                noise={0.08}
                scale={2}
                rotation={90}
                style={{
                  position: 'absolute',
                  inset: 0,
                  width: '100%',
                  height: '100%',
                }}
              />
              {/* 底部渐变遮罩 */}
              <div
                className="pointer-events-none absolute inset-x-0 bottom-0 h-1/4"
                style={{
                  background: `linear-gradient(0deg, ${transitionedColors[2]}cc 0%, transparent 100%)`,
                }}
              />
            </div>

            {/* 主内容区域 */}
            <div className="relative flex h-full flex-col pt-4">
              {/* 关闭按钮 - 右上角固定 */}
              <div className="relative z-10 flex justify-end px-4">
                <motion.button
                  onClick={onClose}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-white/70 backdrop-blur-sm transition-colors hover:bg-black/50 hover:text-white"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <X size={18} />
                </motion.button>
              </div>

              {/* 进度条区域 - 仅在开始后显示，结束页和报告页不显示，带淡入动画 */}
              <AnimatePresence>
                {hasStarted && currentScreen < PROGRESS_SCREENS && (
                  <motion.div
                    className="relative z-10 mt-3 flex gap-1 px-4"
                    initial={{ opacity: 0, filter: 'blur(8px)' }}
                    animate={{ opacity: 1, filter: 'blur(0px)' }}
                    transition={{ duration: 0.4, ease: 'easeOut' }}
                  >
                    {Array.from({ length: PROGRESS_SCREENS }).map(
                      (_, index) => (
                        <div
                          key={index}
                          className="h-0.5 flex-1 overflow-hidden rounded-full bg-white/40"
                        >
                          {/* 已完成的进度条 - 直接显示满 */}
                          {index < currentScreen && (
                            <div className="h-full w-full bg-white/90" />
                          )}
                          {/* 当前进度条 - 带动画，时长跟随内容 */}
                          {index === currentScreen && (
                            <motion.div
                              key={`progress-${currentScreen}`}
                              className="h-full bg-white/90"
                              initial={{ width: '0%' }}
                              animate={{ width: '100%' }}
                              transition={{
                                duration: SCREEN_DURATIONS[currentScreen] || 5,
                                ease: 'linear',
                              }}
                            />
                          )}
                        </div>
                      )
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* 标识区域 - 仅在开始后显示，结束页和报告页不显示，带淡入动画 */}
              <AnimatePresence>
                {hasStarted && currentScreen < PROGRESS_SCREENS && (
                  <motion.div
                    className="relative z-10 mt-1 flex items-center justify-between px-4 text-lg font-medium text-neutral-100"
                    initial={{ opacity: 0, filter: 'blur(8px)' }}
                    animate={{ opacity: 1, filter: 'blur(0px)' }}
                    transition={{ duration: 0.4, ease: 'easeOut', delay: 0.1 }}
                  >
                    <span className="-ml-[0.05em] tracking-tight">
                      Replay'25
                    </span>
                    <span className="-mr-[0.05em] tracking-tight">
                      @{username}
                    </span>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* 内容区域 - 带切换动画 */}
              <div className="relative flex-1">
                <AnimatePresence mode="wait" custom={direction}>
                  <ScreenContent
                    key={hasStarted ? currentScreen : 'welcome'}
                    screenIndex={currentScreen}
                    direction={direction}
                    hasStarted={hasStarted}
                    onStart={handleStart}
                    onNextScreen={goToNextScreen}
                    onReplay={handleReplay}
                    beanImages={beanImages}
                    totalWeight={totalWeight}
                    beans={beans}
                    notes={notes}
                  />
                </AnimatePresence>
              </div>

              {/* 底部导航区域 - 点击左右切换（仅在开始后且在进度屏幕内显示） */}
              {hasStarted && currentScreen < PROGRESS_SCREENS && (
                <div className="absolute inset-x-0 top-24 bottom-0 z-20 flex">
                  {/* 左侧点击区域 - 上一屏 */}
                  <button
                    className="h-full w-1/3"
                    onClick={goToPrevScreen}
                    aria-label="上一屏"
                  />
                  {/* 右侧点击区域 - 下一屏 */}
                  <button
                    className="h-full w-2/3"
                    onClick={goToNextScreen}
                    aria-label="下一屏"
                  />
                </div>
              )}
            </div>
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>
    </>
  );
};

export default YearlyReviewDrawer;
