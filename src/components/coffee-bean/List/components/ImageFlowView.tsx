'use client';

import React, { useMemo, useState, useEffect } from 'react';
import Image from 'next/image';
import { ExtendedCoffeeBean } from '../types';

interface ImageFlowViewProps {
  filteredBeans: ExtendedCoffeeBean[];
  onEdit?: (bean: ExtendedCoffeeBean) => void;
  onDelete?: (bean: ExtendedCoffeeBean) => void;
  onShare?: (bean: ExtendedCoffeeBean) => void;
  onRate?: (bean: ExtendedCoffeeBean) => void;
}

const ImageFlowView: React.FC<ImageFlowViewProps> = ({ filteredBeans }) => {
  // 添加方形尺寸状态
  const [squareSize, setSquareSize] = useState<number>(0);

  // 计算正方形尺寸
  useEffect(() => {
    const calculateSquareSize = () => {
      // 获取视口宽度，减去左右 padding (24px * 2) 和格子间距
      const viewportWidth = window.innerWidth;
      const totalPadding = 48; // 左右各 24px
      const gap = 16; // 格子之间的间距 (约4%)
      const availableWidth = viewportWidth - totalPadding - gap;
      const size = Math.floor(availableWidth / 2);
      setSquareSize(size);
    };

    calculateSquareSize();
    window.addEventListener('resize', calculateSquareSize);

    return () => window.removeEventListener('resize', calculateSquareSize);
  }, []);

  // 处理详情点击 - 通过事件打开
  const handleDetailClick = (bean: ExtendedCoffeeBean) => {
    window.dispatchEvent(
      new CustomEvent('beanDetailOpened', {
        detail: { bean },
      })
    );
  };

  // 过滤出有图片的咖啡豆 - 使用 useMemo 避免每次渲染都创建新数组
  const beansWithImages = useMemo(
    () => filteredBeans.filter(bean => bean.image && bean.image.trim() !== ''),
    [filteredBeans]
  );

  if (beansWithImages.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center text-[10px] tracking-widest text-neutral-500 dark:text-neutral-400">
        [ 没有找到带图片的咖啡豆 ]
      </div>
    );
  }

  return (
    <div className="scroll-with-bottom-bar h-full w-full overflow-y-auto">
      <div className="min-h-full px-6 pb-20">
        <div className="flex flex-wrap justify-between gap-y-4 pt-4">
          {beansWithImages.map(bean => (
            <div
              key={bean.id}
              className="cursor-pointer bg-neutral-200/30 p-4 dark:bg-neutral-800/40"
              style={{
                width: squareSize,
                height: squareSize,
              }}
              onClick={() => handleDetailClick(bean)}
              onKeyDown={e => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleDetailClick(bean);
                }
              }}
              tabIndex={0}
              role="button"
              aria-label={`查看 ${bean.name || '咖啡豆'} 详情`}
            >
              <Image
                src={bean.image!}
                alt={bean.name || '咖啡豆图片'}
                width={0}
                height={0}
                className="h-full w-full object-contain"
                sizes="50vw"
                priority={false}
                loading="lazy"
                unoptimized
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ImageFlowView;
