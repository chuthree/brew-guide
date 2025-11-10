import React, { useMemo } from 'react';
import Image from 'next/image';
import { BeanImageGalleryProps } from './types';

const BeanImageGallery: React.FC<BeanImageGalleryProps> = ({
  beansWithImages,
  imagesLoaded,
}) => {
  // 使用useMemo计算所有豆子的位置和动画信息，避免重复计算
  const beanLayoutData = useMemo(() => {
    const totalBeans = beansWithImages.length;
    if (totalBeans === 0) return [];

    // 修改角度计算，使圆弧的角度范围更小（从-60°到60°，共120°范围）
    const angleRange = Math.PI / 2.5; // 约54度
    // 增大角度间隔系数，使卡片分布更分散
    const spacingFactor = 1; // 间距系数
    const radius = 180; // 半径大小
    const horizontalStretchFactor = 1.5; // 横向缩放因子

    // 计算每个豆子的位置数据
    const positionData = beansWithImages
      .map((bean, index) => {
        if (!bean.image) return null;

        // 从中间开始计算角度，使卡片从中间向两边扩散
        const centerOffset = index - (totalBeans - 1) / 2;
        // 计算角度：以0为中心，向两边扩散
        const angle =
          spacingFactor * ((2 * angleRange) / (totalBeans + 1)) * centerOffset;

        // 计算x和y位置
        const x = Math.sin(angle) * radius * horizontalStretchFactor;
        const y = -Math.cos(angle) * radius; // y轴向下为正，顶部为负

        // 计算旋转角度 - 使卡片垂直于半径向外
        const rotate = angle * (100 / Math.PI); // 调整旋转角度，使其指向外侧

        return {
          bean,
          position: { x, y, angle, rotate },
          index,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null); // 过滤掉没有图片的豆子，并确保类型安全

    // 按照从左到右的顺序排序（基于x坐标）
    const sortedPositions = [...positionData].sort(
      (a, b) => a.position.x - b.position.x
    );

    // 为每个豆子分配动画延迟，基于它们的排序位置
    const baseDelay = 60; // 基础延迟，每个豆子间隔
    return sortedPositions.map((item, sortedIndex) => ({
      ...item,
      animationDelay: sortedIndex * baseDelay,
    }));
  }, [beansWithImages]);

  return (
    <div className="relative mt-18 flex w-full justify-center pb-2">
      <div className="relative flex h-28 w-full items-center justify-center">
        {beanLayoutData.map(beanData => {
          const { bean, position, animationDelay, index } = beanData;

          // 确保 bean.image 存在，这在前面的过滤操作中应该已经保证了
          if (!bean.image) return null;

          return (
            <div
              key={`bean-card-${bean.id}`}
              className="absolute h-20 w-14 -translate-x-1/2 -translate-y-1/2 transform overflow-hidden rounded-sm border border-white/90 shadow-xs transition-all duration-500 dark:border-neutral-800/90"
              style={{
                left: `calc(50% + ${position.x}px + 28px)`,
                top: `calc(100% + ${position.y}px - -80px)`, // y 在顶部时为负，因此整体下移
                transform: `translate(-50%, 0%) rotate(${position.rotate}deg)`, // 使用新的旋转角度
                zIndex: index + 1,
                backgroundColor: '#fff',
                opacity: imagesLoaded ? 1 : 0,
                filter: imagesLoaded ? 'blur(0)' : 'blur(10px)',
                transitionDelay: `${animationDelay}ms`,
              }}
            >
              <Image
                src={bean.image}
                alt={bean.name || '咖啡豆图片'}
                fill
                sizes="48px"
                className="object-cover"
                priority={true} // 设置为高优先级加载
                loading="eager" // 使用即时加载而不是懒加载
              />
            </div>
          );
        })}

        {/* 添加底部渐变阴影效果 */}
        <div
          className="pointer-events-none absolute right-0 -bottom-16 left-0 h-32"
          style={{
            zIndex: 10,
          }}
        >
          <div
            className="pointer-events-none absolute right-0 bottom-0 left-0 h-32 dark:hidden"
            style={{
              background:
                'linear-gradient(to bottom, transparent, rgb(249, 249, 249) 100%, rgb(249, 249, 249) 100%)',
              opacity: 1,
            }}
          ></div>
          <div
            className="pointer-events-none absolute right-0 bottom-0 left-0 hidden h-32 dark:block"
            style={{
              background:
                'linear-gradient(to bottom, transparent, rgb(23, 23, 23) 100%, rgb(23, 23, 23) 100%)',
              opacity: 1,
            }}
          ></div>
        </div>
      </div>
    </div>
  );
};

export default BeanImageGallery;
