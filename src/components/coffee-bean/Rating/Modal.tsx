'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { CornerDownRight } from 'lucide-react';
import { CoffeeBean } from '@/types/app';
import ActionDrawer from '@/components/common/ui/ActionDrawer';
import ElasticSlider from '@/components/common/ui/ElasticSlider';
import { formatBeanDisplayName } from '@/lib/utils/beanVarietyUtils';
import { useSettingsStore } from '@/lib/stores/settingsStore';
import { ratingSteps } from '@/lib/ratings';
import DeleteIcon from '@public/images/icons/ui/delete.svg';

const StarIcon = ({
  className,
  halfClass,
}: {
  className?: string;
  halfClass?: string;
}) => {
  const starPath =
    'M12 2.5c.4 0 .8.2 1 .6l2.4 4.9 5.4.8c.4.1.8.4.9.8.1.4 0 .9-.3 1.2l-3.9 3.8.9 5.4c.1.4-.1.9-.4 1.1-.4.3-.8.3-1.2.1L12 18.8l-4.8 2.5c-.4.2-.9.2-1.2-.1-.4-.3-.5-.7-.4-1.1l.9-5.4-3.9-3.8c-.3-.3-.4-.8-.3-1.2.1-.4.5-.7.9-.8l5.4-.8 2.4-4.9c.2-.4.6-.6 1-.6z';
  return (
    <svg viewBox="0 0 24 24" className={className}>
      {halfClass ? (
        <>
          <defs>
            <clipPath id="leftHalf">
              <rect x="0" y="0" width="12" height="24" />
            </clipPath>
            <clipPath id="rightHalf">
              <rect x="12" y="0" width="12" height="24" />
            </clipPath>
          </defs>
          <path fill="currentColor" clipPath="url(#leftHalf)" d={starPath} />
          <path
            fill="currentColor"
            clipPath="url(#rightHalf)"
            d={starPath}
            className={halfClass}
          />
        </>
      ) : (
        <path fill="currentColor" d={starPath} />
      )}
    </svg>
  );
};

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
  const roasterFieldEnabled = useSettingsStore(
    state => state.settings.roasterFieldEnabled
  );
  const roasterSeparator = useSettingsStore(
    state => state.settings.roasterSeparator
  );
  const beanRatingTenthStep = useSettingsStore(
    state => state.settings.beanRatingTenthStep ?? false
  );
  const [beanType, setBeanType] = useState<'espresso' | 'filter' | 'omni'>(
    'filter'
  );
  const [overallRating, setOverallRating] = useState<number>(0);
  const [ratingNotes, setRatingNotes] = useState<string>('');
  const [deleteConfirmingBeanId, setDeleteConfirmingBeanId] = useState<
    string | null
  >(null);

  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const hasExistingRating =
    (coffeeBean?.overallRating ?? 0) > 0 ||
    Boolean(coffeeBean?.ratingNotes?.trim());
  const isDeleteConfirming = deleteConfirmingBeanId === coffeeBean?.id;
  const beanDisplayName = coffeeBean
    ? formatBeanDisplayName(coffeeBean, {
        roasterFieldEnabled,
        roasterSeparator,
      })
    : '';

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height =
        textareaRef.current.scrollHeight + 'px';
    }
  }, [ratingNotes]);

  useEffect(() => {
    if (coffeeBean) {
      setBeanType(coffeeBean.beanType || 'filter');
      setOverallRating(coffeeBean.overallRating || 0);
      setRatingNotes(coffeeBean.ratingNotes || '');
    }
  }, [coffeeBean]);

  const formatRatingValue = React.useCallback((value: number) => {
    return value.toFixed(1);
  }, []);

  const handleDrawerClose = () => {
    setDeleteConfirmingBeanId(null);
    onClose();
  };

  const handleSave = async () => {
    if (!coffeeBean) return;

    const ratings: Partial<CoffeeBean> = {
      beanType,
      overallRating: beanRatingTenthStep
        ? Number(overallRating.toFixed(1))
        : overallRating,
      ratingNotes: ratingNotes.trim() || undefined,
    };

    try {
      await onSave(coffeeBean.id, ratings);
      if (onAfterSave) {
        onAfterSave();
      }
      handleDrawerClose();
    } catch (error) {
      console.error('保存评分失败:', error);
    }
  };

  const handleCancel = () => {
    if (isDeleteConfirming) {
      setDeleteConfirmingBeanId(null);
      return;
    }

    handleDrawerClose();
  };

  const handleDelete = async () => {
    if (!coffeeBean) return;

    try {
      await onSave(coffeeBean.id, {
        overallRating: undefined,
        ratingNotes: undefined,
      });
      if (onAfterSave) {
        onAfterSave();
      }
      handleDrawerClose();
    } catch (error) {
      console.error('删除评分失败:', error);
    }
  };

  if (!coffeeBean) return null;

  return (
    <ActionDrawer
      isOpen={showModal}
      onClose={handleDrawerClose}
      historyId="bean-rating"
      repositionInputs={false}
    >
      <ActionDrawer.Switcher
        activeKey={isDeleteConfirming ? 'delete-confirm' : 'edit-rating'}
      >
        {isDeleteConfirming ? (
          <>
            <ActionDrawer.Icon icon={DeleteIcon} />
            <ActionDrawer.Content>
              <p className="text-neutral-500 dark:text-neutral-400">
                确认删除
                <span className="text-neutral-800 dark:text-neutral-200">
                  「{beanDisplayName}」
                </span>
                的评分吗？此操作不可撤销。
              </p>
            </ActionDrawer.Content>
            <ActionDrawer.Actions>
              <ActionDrawer.SecondaryButton onClick={handleCancel}>
                取消
              </ActionDrawer.SecondaryButton>
              <ActionDrawer.DangerButton onClick={handleDelete}>
                确认删除
              </ActionDrawer.DangerButton>
            </ActionDrawer.Actions>
          </>
        ) : (
          <div className="flex flex-col">
            {/* 总体评分 */}
            <div className="flex flex-col gap-3">
              <p className="font-medium text-neutral-500 dark:text-neutral-400">
                为
                <span className="mx-1 text-neutral-800 dark:text-neutral-200">
                  {beanDisplayName}
                </span>
                评分
              </p>
              {beanRatingTenthStep ? (
                <div data-vaul-no-drag>
                  <ElasticSlider
                    label="评分"
                    min={0}
                    max={5}
                    step={ratingSteps({ beanRatingTenthStep }).bean}
                    value={overallRating}
                    onValueChange={setOverallRating}
                    formatValue={formatRatingValue}
                    aria-label="评分"
                  />
                </div>
              ) : (
                <div className="flex justify-between" data-vaul-no-drag>
                  {[1, 2, 3, 4, 5].map(star => {
                    const isHalf = overallRating === star - 0.5;
                    const isFull = star <= overallRating;
                    return (
                      <motion.button
                        key={star}
                        whileTap={{ scale: 0.9 }}
                        onClick={() =>
                          setOverallRating(
                            overallRating === star ? star - 0.5 : star
                          )
                        }
                        className="cursor-pointer p-2"
                      >
                        <StarIcon
                          halfClass={
                            isHalf
                              ? 'text-neutral-200 dark:text-neutral-700'
                              : undefined
                          }
                          className={`h-8 w-8 ${
                            isFull || isHalf
                              ? 'text-amber-400'
                              : 'text-neutral-200 dark:text-neutral-700'
                          }`}
                        />
                      </motion.button>
                    );
                  })}
                </div>
              )}
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
                onClick={handleCancel}
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

            {hasExistingRating && (
              <button
                type="button"
                onClick={() => setDeleteConfirmingBeanId(coffeeBean.id)}
                className="mt-2 flex items-center self-start px-1 py-1 text-xs font-medium text-red-500 transition-colors hover:text-red-600 dark:text-red-400 dark:hover:text-red-300"
              >
                <CornerDownRight className="mr-1 h-3.5 w-3.5" />
                删除评分
              </button>
            )}
          </div>
        )}
      </ActionDrawer.Switcher>
    </ActionDrawer>
  );
};

export default CoffeeBeanRatingModal;
