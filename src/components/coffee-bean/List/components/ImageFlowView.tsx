'use client';

import React, { useMemo } from 'react';
import Image from 'next/image';
import { ExtendedCoffeeBean } from '../types';
import { isBeanEmpty } from '../preferences';

interface ImageFlowViewProps {
  filteredBeans: ExtendedCoffeeBean[];
  emptyBeans: ExtendedCoffeeBean[];
  showEmptyBeans: boolean;
  onEdit?: (bean: ExtendedCoffeeBean) => void;
  onDelete?: (bean: ExtendedCoffeeBean) => void;
  onShare?: (bean: ExtendedCoffeeBean) => void;
  onRate?: (bean: ExtendedCoffeeBean) => void;
}

const ImageFlowView: React.FC<ImageFlowViewProps> = ({
  filteredBeans,
  emptyBeans,
  showEmptyBeans,
}) => {
  // 处理详情点击 - 通过事件打开
  const handleDetailClick = (bean: ExtendedCoffeeBean) => {
    window.dispatchEvent(
      new CustomEvent('beanDetailOpened', {
        detail: { bean },
      })
    );
  };

  // 合并正常豆子和用完的豆子（如果显示），然后过滤出有图片的
  const beansWithImages = useMemo(() => {
    const normalBeans = filteredBeans.filter(
      bean => bean.image && bean.image.trim() !== ''
    );

    if (!showEmptyBeans) {
      return normalBeans;
    }

    const emptyBeansWithImages = emptyBeans.filter(
      bean => bean.image && bean.image.trim() !== ''
    );

    // 正常豆子在前，用完的豆子在后
    return [...normalBeans, ...emptyBeansWithImages];
  }, [filteredBeans, emptyBeans, showEmptyBeans]);

  // 将咖啡豆分组，每排3个
  const rows = useMemo(() => {
    const result = [];
    for (let i = 0; i < beansWithImages.length; i += 3) {
      result.push(beansWithImages.slice(i, i + 3));
    }
    return result;
  }, [beansWithImages]);

  if (beansWithImages.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center text-[10px] tracking-widest text-neutral-500 dark:text-neutral-400">
        [ 没有找到带图片的咖啡豆 ]
      </div>
    );
  }

  return (
    <div className="scroll-with-bottom-bar h-full w-full overflow-y-auto">
      <div className="min-h-full px-3 pb-20">
        <div className="flex flex-col gap-8 pt-8">
          {rows.map((row, rowIndex) => (
            <div key={rowIndex} className="relative">
              {/* 架子容器 - 包含图片和架子 */}
              <div className="relative px-3">
                {/* 咖啡豆图片 - 使用 grid 布局 */}
                <div className="relative grid grid-cols-3 items-end gap-4">
                  {row.map(bean => {
                    const isEmpty = isBeanEmpty(bean);
                    return (
                      <div key={bean.id} className="relative pb-0.5">
                        <Image
                          src={bean.image!}
                          alt={bean.name || '咖啡豆图片'}
                          width={0}
                          height={0}
                          className={`w-full cursor-pointer rounded-t-xs border border-b-0 border-neutral-200 transition-opacity dark:border-neutral-800 ${
                            isEmpty ? 'opacity-40' : ''
                          }`}
                          style={{
                            height: 'auto',
                          }}
                          sizes="33vw"
                          priority={false}
                          loading="lazy"
                          unoptimized
                          onClick={() => handleDetailClick(bean)}
                          onKeyDown={(e: React.KeyboardEvent) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              handleDetailClick(bean);
                            }
                          }}
                          tabIndex={0}
                          role="button"
                          aria-label={`查看 ${bean.name || '咖啡豆'} 详情`}
                        />
                      </div>
                    );
                  })}
                </div>

                {/* 架子 - 3D透视效果，向后向上延伸 */}
                <div className="absolute inset-x-0 bottom-0 -z-10 h-3">
                  {/* 台面 - 使用transform让它向后向上倾斜 */}
                  <div
                    className="absolute inset-x-0 bottom-0 h-1 origin-bottom scale-y-[3] transform bg-neutral-200 before:absolute before:inset-x-0 before:top-0 before:h-[2px] before:bg-gradient-to-b before:from-white/60 before:to-transparent dark:bg-neutral-800 dark:before:from-black/40"
                    style={{ transform: 'perspective(200px) rotateX(45deg)' }}
                  />

                  {/* 厚度 - 与台面同色，顶部添加90度拐角的光影效果 */}
                  <div className="absolute inset-x-0 top-full h-1 bg-neutral-200 before:absolute before:inset-x-0 before:top-0 before:h-full before:bg-gradient-to-b before:from-neutral-300/40 before:to-neutral-200 dark:bg-neutral-800 dark:before:from-neutral-700/20 dark:before:to-neutral-800" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ImageFlowView;
