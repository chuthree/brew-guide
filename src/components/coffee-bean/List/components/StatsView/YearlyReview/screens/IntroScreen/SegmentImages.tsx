'use client';

import React, { useRef, useState, useEffect } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';

interface SegmentImagesProps {
  beanImages: string[];
  onComplete?: () => void;
}

/**
 * Segment 1.5: 咖啡豆图片展示 - 每张图片依次从右向左滑过
 */
const SegmentImages: React.FC<SegmentImagesProps> = ({
  beanImages,
  onComplete,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRefs = useRef<(HTMLDivElement | null)[]>([]);

  // 间距配置
  const GAP = 8;
  const PADDING = 32;

  // 根据容器高度和图片数量计算图片大小
  const getLayoutInfo = () => {
    const containerHeight = containerRef.current?.clientHeight || 600;
    const availableHeight = containerHeight - PADDING * 2;
    const totalGaps = (beanImages.length - 1) * GAP;
    const imageSize = Math.floor(
      (availableHeight - totalGaps) / beanImages.length
    );
    return { imageSize: Math.min(imageSize, 150), containerHeight };
  };

  const getImageStyle = (index: number, imageSize: number) => {
    const bottom = PADDING + index * (imageSize + GAP);
    return {
      left: '50%',
      bottom: `${bottom}px`,
      transform: 'translateX(-50%)',
      width: `${imageSize}px`,
      height: `${imageSize}px`,
      zIndex: index,
    };
  };

  const [imageSize, setImageSize] = useState(120);

  useEffect(() => {
    if (containerRef.current) {
      const { imageSize } = getLayoutInfo();
      setImageSize(imageSize);
    }
  }, [beanImages.length]);

  useGSAP(
    () => {
      if (!containerRef.current || beanImages.length === 0) {
        onComplete?.();
        return;
      }

      const { imageSize } = getLayoutInfo();
      setImageSize(imageSize);

      const tl = gsap.timeline({
        onComplete: () => {
          onComplete?.();
        },
      });

      const containerWidth = containerRef.current.clientWidth;
      const staggerDelay = 0.05;

      imageRefs.current.forEach((ref, index) => {
        if (!ref) return;

        gsap.set(ref, {
          x: containerWidth,
          opacity: 0,
        });

        tl.to(
          ref,
          {
            x: 20,
            opacity: 1,
            duration: 0.3,
            ease: 'power3.out',
          },
          index * staggerDelay
        )
          .to(
            ref,
            {
              x: -20,
              duration: 0.5,
              ease: 'none',
            },
            0.3 + index * staggerDelay
          )
          .to(
            ref,
            {
              x: -containerWidth,
              opacity: 0,
              duration: 0.3,
              ease: 'power3.in',
            },
            0.8 + index * staggerDelay
          );
      });
    },
    { scope: containerRef, dependencies: [beanImages] }
  );

  return (
    <div ref={containerRef} className="absolute inset-0 overflow-hidden">
      {beanImages.map((image, index) => {
        const style = getImageStyle(index, imageSize);
        return (
          <div
            key={index}
            ref={el => {
              imageRefs.current[index] = el;
            }}
            className="absolute overflow-hidden rounded shadow ring-1 ring-white/20"
            style={{
              ...style,
              willChange: 'transform',
            }}
          >
            <img
              src={image}
              alt="咖啡豆"
              className="h-full w-full object-cover"
            />
          </div>
        );
      })}
    </div>
  );
};

export default SegmentImages;
