'use client';

import React, { useCallback, useMemo, useSyncExternalStore } from 'react';
import Image from 'next/image';
import { ExtendedCoffeeBean } from '../types';
import { isBeanEmpty } from '../preferences';
import {
  type CoffeeBeanImageFlowSource,
  useCoffeeBeanImageFlowSources,
} from '@/lib/hooks/useCoffeeBeanImageFlowSources';

interface ImageFlowViewProps {
  filteredBeans: ExtendedCoffeeBean[];
  emptyBeans: ExtendedCoffeeBean[];
  showEmptyBeans: boolean;
  onEdit?: (bean: ExtendedCoffeeBean) => void;
  onDelete?: (bean: ExtendedCoffeeBean) => void;
  onShare?: (bean: ExtendedCoffeeBean) => void;
  onRate?: (bean: ExtendedCoffeeBean) => void;
}

const DEFAULT_COLUMNS_PER_ROW = 3;

const getColumnsPerRowForWidth = (width: number): number => {
  if (width >= 1280) return 6;
  if (width >= 1024) return 5;
  if (width >= 768) return 4;
  return DEFAULT_COLUMNS_PER_ROW;
};

const getColumnsPerRowSnapshot = (): number => {
  if (typeof window === 'undefined') {
    return DEFAULT_COLUMNS_PER_ROW;
  }

  return getColumnsPerRowForWidth(window.innerWidth);
};

const subscribeToColumnsPerRow = (onStoreChange: () => void): (() => void) => {
  if (typeof window === 'undefined') {
    return () => {};
  }

  window.addEventListener('resize', onStoreChange);
  return () => window.removeEventListener('resize', onStoreChange);
};

const ImageFlowView: React.FC<ImageFlowViewProps> = ({
  filteredBeans,
  emptyBeans,
  showEmptyBeans,
}) => {
  const columnsPerRow = useSyncExternalStore(
    subscribeToColumnsPerRow,
    getColumnsPerRowSnapshot,
    () => DEFAULT_COLUMNS_PER_ROW
  );

  const allCandidateBeans = useMemo(
    () => (showEmptyBeans ? [...filteredBeans, ...emptyBeans] : filteredBeans),
    [filteredBeans, emptyBeans, showEmptyBeans]
  );
  const candidateBeanIds = useMemo(
    () => allCandidateBeans.map(bean => bean.id),
    [allCandidateBeans]
  );
  const { sources: imageSources, isLoading } =
    useCoffeeBeanImageFlowSources(candidateBeanIds);

  // 合并正常豆子和用完的豆子（如果显示），然后过滤出有图片的
  const beansWithImages = useMemo(() => {
    const normalBeans = filteredBeans.filter(bean => imageSources.has(bean.id));

    if (!showEmptyBeans) {
      return normalBeans;
    }

    const emptyBeansWithImages = emptyBeans.filter(bean =>
      imageSources.has(bean.id)
    );

    // 正常豆子在前，用完的豆子在后
    return [...normalBeans, ...emptyBeansWithImages];
  }, [filteredBeans, emptyBeans, showEmptyBeans, imageSources]);

  // 将咖啡豆分组，每排根据屏幕大小显示不同数量
  const rows = useMemo(() => {
    const result = [];
    for (let i = 0; i < beansWithImages.length; i += columnsPerRow) {
      result.push(beansWithImages.slice(i, i + columnsPerRow));
    }
    return result;
  }, [beansWithImages, columnsPerRow]);

  if (beansWithImages.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center text-[10px] tracking-widest text-neutral-500 dark:text-neutral-400">
        {isLoading ? '[ 正在加载咖啡豆图片 ]' : '[ 没有找到带图片的咖啡豆 ]'}
      </div>
    );
  }

  return (
    <div className="scroll-with-bottom-bar h-full w-full overflow-y-auto">
      <div className="min-h-full px-3 pb-20">
        <div className="flex flex-col gap-8 pt-8">
          {rows.map((row, rowIndex) => (
            <div key={row[0]?.id || rowIndex} className="relative">
              {/* 架子容器 - 包含图片和架子 */}
              <div className="relative px-3">
                {/* 咖啡豆图片 - 使用 grid 布局，底部对齐 */}
                <div
                  className="relative grid items-end gap-4"
                  style={{
                    gridTemplateColumns: `repeat(${columnsPerRow}, minmax(0, 1fr))`,
                  }}
                >
                  {row.map(bean => {
                    const isEmpty = isBeanEmpty(bean);
                    return (
                      <div key={bean.id} className="relative pb-0.5">
                        <ImageFlowBeanImage
                          bean={bean}
                          source={imageSources.get(bean.id)}
                          columnsPerRow={columnsPerRow}
                          isEmpty={isEmpty}
                        />
                      </div>
                    );
                  })}
                </div>

                {/* 架子 - 3D透视效果，向后向上延伸，横跨整排 */}
                <div className="absolute inset-x-0 bottom-0 -z-10 h-3">
                  {/* 台面 - 使用transform让它向后向上倾斜 */}
                  <div
                    className="before:fade-mask-to-b absolute inset-x-0 bottom-0 h-1 origin-bottom scale-y-[3] transform bg-neutral-200 before:absolute before:inset-x-0 before:top-0 before:h-[2px] before:bg-white/60 dark:bg-neutral-800 dark:before:bg-black/40"
                    style={{ transform: 'perspective(200px) rotateX(45deg)' }}
                  />

                  {/* 厚度 - 与台面同色，顶部添加90度拐角的光影效果 */}
                  <div className="absolute inset-x-0 top-full h-1 bg-neutral-200 before:absolute before:inset-x-0 before:top-0 before:h-full before:bg-linear-to-b before:from-neutral-300/40 before:to-neutral-200 dark:bg-neutral-800 dark:before:from-neutral-700/20 dark:before:to-neutral-800" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const ImageFlowBeanImage = React.memo(function ImageFlowBeanImage({
  bean,
  source,
  columnsPerRow,
  isEmpty,
}: {
  bean: ExtendedCoffeeBean;
  source: CoffeeBeanImageFlowSource | undefined;
  columnsPerRow: number;
  isEmpty: boolean;
}) {
  const openBeanDetail = useCallback(() => {
    window.dispatchEvent(
      new CustomEvent('beanDetailOpened', {
        detail: { bean },
      })
    );
  }, [bean]);

  if (!source) {
    return null;
  }

  return (
    <button
      type="button"
      className={`relative block w-full cursor-pointer overflow-hidden rounded-t-xs border border-b-0 border-neutral-200/50 transition-opacity dark:border-neutral-800/50 ${
        isEmpty ? 'opacity-40' : ''
      }`}
      onClick={openBeanDetail}
      aria-label={`查看 ${bean.name || '咖啡豆'} 详情`}
    >
      <Image
        src={source.src}
        alt={bean.name || '咖啡豆图片'}
        width={source.dimensions.width}
        height={source.dimensions.height}
        className="block h-auto w-full"
        sizes={`${Math.floor(100 / columnsPerRow)}vw`}
        priority={false}
        loading="lazy"
        unoptimized
      />
    </button>
  );
});

export default ImageFlowView;
