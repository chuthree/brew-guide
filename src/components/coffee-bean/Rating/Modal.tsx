'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { CoffeeBean } from '@/types/app';
import ActionDrawer from '@/components/common/ui/ActionDrawer';

const StarIcon = ({ className }: { className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className}
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
  </svg>
);

interface CoffeeBeanRatingModalProps {
  showModal: boolean;
  coffeeBean: CoffeeBean | null;
  onClose: () => void;
  onSave: (id: string, ratings: Partial<CoffeeBean>) => void;
  onAfterSave?: () => void;
}

const CoffeeBeanRatingModal: React.FC<CoffeeBeanRatingModalProps> = ({
  showModal,
  coffeeBean,
  onClose,
  onSave,
  onAfterSave,
}) => {
  const [beanType, setBeanType] = useState<'espresso' | 'filter' | 'omni'>(
    'filter'
  );
  const [overallRating, setOverallRating] = useState<number>(0);
  const [ratingNotes, setRatingNotes] = useState<string>('');

  const ratingContainerRef = React.useRef<HTMLDivElement>(null);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height =
        textareaRef.current.scrollHeight + 'px';
    }
  }, [ratingNotes]);

  const [isDragging, setIsDragging] = useState(false);

  const handleRatingMove = (clientX: number) => {
    if (!ratingContainerRef.current) return;
    const rect = ratingContainerRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const width = rect.width;
    let percent = x / width;
    percent = Math.max(0, Math.min(1, percent));

    // Calculate rating 0-5, step 0.5
    let newRating = percent * 5;
    newRating = Math.round(newRating * 2) / 2;

    setOverallRating(newRating);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    e.stopPropagation();
    setIsDragging(true);
    handleRatingMove(e.touches[0].clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    e.stopPropagation();
    handleRatingMove(e.touches[0].clientX);
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    handleRatingMove(e.clientX);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      handleRatingMove(e.clientX);
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // 当咖啡豆数据加载时，初始化表单状态
  useEffect(() => {
    if (coffeeBean) {
      setBeanType(coffeeBean.beanType || 'filter');
      setOverallRating(coffeeBean.overallRating || 0);
      setRatingNotes(coffeeBean.ratingNotes || '');
    }
  }, [coffeeBean]);

  const handleSave = async () => {
    if (!coffeeBean) return;

    const ratings: Partial<CoffeeBean> = {
      beanType,
      overallRating,
      ratingNotes: ratingNotes.trim() || undefined,
    };

    try {
      // 保存数据
      await onSave(coffeeBean.id, ratings);

      // 保存成功后调用回调函数
      if (onAfterSave) {
        onAfterSave();
      }
      // 关闭模态框
      onClose();
    } catch (error) {
      console.error('保存评分失败:', error);
    }
  };

  // 当没有咖啡豆数据时不渲染
  if (!coffeeBean) return null;

  return (
    <ActionDrawer
      isOpen={showModal}
      onClose={onClose}
      historyId="bean-rating"
      repositionInputs={false}
    >
      {/* 图标区域 */}
      {/* <div className="mb-6 text-neutral-800 dark:text-neutral-200">
        <EmojiEventIcon width={128} height={128} />
      </div> */}

      {/* 总体评分 */}
      <div className="flex flex-col gap-3">
        <p className="font-medium text-neutral-500 dark:text-neutral-400">
          为
          <span className="mx-1 text-neutral-800 dark:text-neutral-200">
            {coffeeBean.name}
          </span>
          评分
        </p>
        <div className="relative">
          {/* 胶囊分数指示器 */}
          <motion.div
            className="pointer-events-none absolute -top-10 flex h-8 w-12 items-center justify-center rounded-full bg-neutral-800 text-sm font-bold text-white shadow-sm dark:bg-neutral-200 dark:text-neutral-900"
            initial={{ opacity: 0, scale: 0.8, y: 10 }}
            animate={{
              left: `${(overallRating / 5) * 100}%`,
              opacity: isDragging ? 1 : 0,
              scale: isDragging ? 1 : 0.8,
              y: isDragging ? 0 : 10,
            }}
            transition={{ type: 'spring', bounce: 0, duration: 0.2 }}
            style={{ x: '-50%' }}
          >
            {overallRating.toFixed(1)}
            {/* 小三角箭头 */}
            <div className="absolute -bottom-1 left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 bg-neutral-800 dark:bg-neutral-200" />
          </motion.div>

          <div
            ref={ratingContainerRef}
            className="relative h-10 w-full cursor-pointer touch-none overflow-hidden rounded-2xl bg-neutral-100 dark:bg-neutral-800"
            data-vaul-no-drag
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onTouchCancel={handleTouchEnd}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            {/* Fill */}
            <motion.div
              className="absolute top-0 left-0 h-full bg-linear-to-r from-neutral-300 to-neutral-400/70 dark:from-neutral-700 dark:to-neutral-600"
              animate={{ width: `${(overallRating / 5) * 100}%` }}
              transition={{ type: 'spring', bounce: 0, duration: 0.3 }}
            />

            {/* Stars Overlay */}
            <div className="pointer-events-none absolute inset-0 grid grid-cols-5 items-center justify-items-center">
              {[1, 2, 3, 4, 5].map(star => (
                <StarIcon
                  key={star}
                  className="h-5 w-5 text-neutral-200 dark:text-neutral-500"
                />
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className="mt-4 mb-8 flex flex-col gap-3">
        <p className="font-medium text-neutral-500 dark:text-neutral-400">
          写点你的想法？
        </p>
        {/* 评价备注 */}
        <textarea
          ref={textareaRef}
          value={ratingNotes}
          onChange={e => setRatingNotes(e.target.value)}
          placeholder="写点什么..."
          className="w-full resize-none rounded-2xl bg-neutral-100 px-4 py-3 text-sm text-neutral-800 placeholder:text-neutral-400 focus:ring-2 focus:ring-neutral-300 focus:outline-none dark:bg-neutral-800 dark:text-white dark:placeholder:text-neutral-500 dark:focus:ring-neutral-600"
          rows={1}
        />
      </div>

      <div className="flex gap-2">
        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={onClose}
          className="flex-1 rounded-full bg-neutral-100 px-4 py-3 text-sm font-medium text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300"
        >
          取消
        </motion.button>
        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={handleSave}
          className="flex-1 rounded-full bg-neutral-800 px-4 py-3 text-sm font-medium text-white transition-colors dark:bg-white dark:text-neutral-900"
        >
          保存
        </motion.button>
      </div>
    </ActionDrawer>
  );
};

export default CoffeeBeanRatingModal;
