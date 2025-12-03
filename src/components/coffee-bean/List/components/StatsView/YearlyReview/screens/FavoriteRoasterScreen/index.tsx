'use client';

import React, { useRef, useMemo, useState, useEffect } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import type { CoffeeBean } from '@/types/app';
import { extractRoasterFromName } from '@/lib/utils/beanVarietyUtils';
import RoasterLogoManager from '@/lib/managers/RoasterLogoManager';

// 预加载图片的工具函数
const preloadImages = (urls: string[]): Promise<void[]> => {
  return Promise.all(
    urls.map(
      url =>
        new Promise<void>(resolve => {
          const img = new Image();
          img.onload = () => resolve();
          img.onerror = () => resolve(); // 即使失败也继续
          img.src = url;
        })
    )
  );
};

// 重复图片数组到指定数量
const repeatImages = (images: string[], targetCount: number): string[] => {
  if (images.length === 0) return [];
  const result: string[] = [];
  for (let i = 0; i < targetCount; i++) {
    result.push(images[i % images.length]);
  }
  return result;
};

interface FavoriteRoasterScreenProps {
  beans: CoffeeBean[];
  onComplete?: () => void;
}

/**
 * 第二屏：最爱的烘焙商
 * Segment 1: 左上角文案 + 中间三张大圆形图片重叠动画
 * Segment 2: "这就是爱" + 两列图片往左下依次重叠
 */
const FavoriteRoasterScreen: React.FC<FavoriteRoasterScreenProps> = ({
  beans,
  onComplete,
}) => {
  const [currentSegment, setCurrentSegment] = useState<number>(0);
  const [roasterLogo, setRoasterLogo] = useState<string | null>(null);

  // 计算最爱的烘焙商和对应图片
  const { roasterName, beanCount, rawRoasterImages } = useMemo(() => {
    const roasterCount = new Map<string, number>();
    const roasterBeans = new Map<string, CoffeeBean[]>();

    beans.forEach(bean => {
      const roaster = extractRoasterFromName(bean.name);
      if (roaster !== '未知烘焙商') {
        roasterCount.set(roaster, (roasterCount.get(roaster) || 0) + 1);
        if (!roasterBeans.has(roaster)) {
          roasterBeans.set(roaster, []);
        }
        roasterBeans.get(roaster)!.push(bean);
      }
    });

    // 找出数量最多的烘焙商
    let maxRoaster = '未知';
    let maxCount = 0;

    roasterCount.forEach((count, roaster) => {
      if (count > maxCount) {
        maxCount = count;
        maxRoaster = roaster;
      }
    });

    // 获取该烘焙商的咖啡豆图片
    const beanList = roasterBeans.get(maxRoaster) || [];
    const images = beanList
      .filter(bean => bean.image && bean.image.trim() !== '')
      .map(bean => bean.image as string);

    return {
      roasterName: maxRoaster,
      beanCount: maxCount,
      rawRoasterImages: images,
    };
  }, [beans]);

  // 加载烘焙商图标
  useEffect(() => {
    if (roasterName && roasterName !== '未知') {
      RoasterLogoManager.getLogoByRoaster(roasterName).then(logo => {
        setRoasterLogo(logo);
      });
    }
  }, [roasterName]);

  // 构建最终的图片列表：如果有烘焙商图标，优先使用；然后用咖啡豆图片填充，不够则重复
  const roasterImages = useMemo(() => {
    const allImages: string[] = [];

    // 如果有烘焙商图标，放在第一位
    if (roasterLogo) {
      allImages.push(roasterLogo);
    }

    // 添加咖啡豆图片
    allImages.push(...rawRoasterImages);

    // 如果有图片但不足 6 张，重复填充
    if (allImages.length > 0) {
      return repeatImages(allImages, 6);
    }

    return allImages;
  }, [roasterLogo, rawRoasterImages]);

  // 预加载所有图片
  const [imagesLoaded, setImagesLoaded] = useState(false);

  useEffect(() => {
    if (roasterImages.length > 0) {
      preloadImages(roasterImages).then(() => {
        setImagesLoaded(true);
      });
    } else {
      setImagesLoaded(true);
    }
  }, [roasterImages]);

  // 图片未加载完成时不渲染内容
  if (!imagesLoaded) {
    return <div className="absolute inset-0 overflow-hidden" />;
  }

  return (
    <div className="absolute inset-0 overflow-hidden">
      {currentSegment === 0 && (
        <Segment1
          roasterName={roasterName}
          beanCount={beanCount}
          roasterImages={roasterImages.slice(0, 3)}
          onComplete={() => setCurrentSegment(1)}
        />
      )}
      {currentSegment === 1 && (
        <Segment2 roasterImages={roasterImages} onComplete={onComplete} />
      )}
    </div>
  );
};

/**
 * Segment 1: 最爱烘焙商 + 中间图片重叠
 */
interface Segment1Props {
  roasterName: string;
  beanCount: number;
  roasterImages: string[];
  onComplete?: () => void;
}

const Segment1: React.FC<Segment1Props> = ({
  roasterName,
  beanCount,
  roasterImages,
  onComplete,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const imageRefs = useRef<(HTMLDivElement | null)[]>([]);
  const blurRef = useRef<SVGFEGaussianBlurElement>(null);

  const lastXRef = useRef<number>(0);
  const velocityRef = useRef<number>(0);

  const updateBlur = () => {
    if (textRef.current && blurRef.current) {
      const transform = getComputedStyle(textRef.current).transform;
      if (transform !== 'none') {
        const matrix = new DOMMatrix(transform);
        const currentX = matrix.m41;
        const velocity = Math.abs(currentX - lastXRef.current);
        lastXRef.current = currentX;
        velocityRef.current = velocityRef.current * 0.7 + velocity * 0.3;
        const blurAmount = Math.min(velocityRef.current * 0.6, 30);
        blurRef.current.setAttribute('stdDeviation', `${blurAmount}, 0`);
      }
    }
  };

  useGSAP(
    () => {
      if (!containerRef.current || !textRef.current) return;

      const containerWidth = containerRef.current.clientWidth;
      const containerHeight = containerRef.current.clientHeight;
      const IMAGE_SIZE = Math.min(containerWidth - 32, containerHeight * 0.5);
      const centerX = (containerWidth - IMAGE_SIZE) / 2;
      const centerY = (containerHeight - IMAGE_SIZE) / 2;

      gsap.ticker.add(updateBlur);

      const tl = gsap.timeline({
        onComplete: () => {
          gsap.ticker.remove(updateBlur);
          if (blurRef.current)
            blurRef.current.setAttribute('stdDeviation', '0, 0');
          onComplete?.();
        },
      });

      tl.set(textRef.current, { x: '100%', opacity: 0 }).to(textRef.current, {
        x: '0%',
        opacity: 1,
        duration: 0.5,
        ease: 'power3.out',
      });

      const imageCount = roasterImages.length;
      if (imageCount > 0) {
        imageRefs.current.forEach(ref => {
          if (!ref) return;
          ref.style.width = `${IMAGE_SIZE}px`;
          ref.style.height = `${IMAGE_SIZE}px`;
          gsap.set(ref, { x: containerWidth + 50, y: centerY, opacity: 0 });
        });

        imageRefs.current.forEach((ref, index) => {
          if (!ref) return;
          tl.to(
            ref,
            { x: centerX, opacity: 1, duration: 0.35, ease: 'power3.out' },
            0.1 + index * 0.12
          );
        });
      }

      tl.to(textRef.current, { x: '-5%', duration: 2.0, ease: 'none' }, 0.5);

      if (imageCount > 0) {
        const reversedRefs = [...imageRefs.current].reverse();
        reversedRefs.forEach((ref, index) => {
          if (!ref) return;
          tl.to(
            ref,
            {
              x: -containerWidth - 50,
              opacity: 0,
              duration: 0.35,
              ease: 'power3.in',
            },
            2.3 + index * 0.1
          );
        });
      }

      tl.to(
        textRef.current,
        { x: '-120%', opacity: 0, duration: 0.5, ease: 'power3.in' },
        2.5
      );
    },
    {
      scope: containerRef,
      dependencies: [roasterImages, roasterName, beanCount],
    }
  );

  return (
    <div ref={containerRef} className="absolute inset-0 overflow-hidden">
      <svg className="absolute h-0 w-0" aria-hidden="true">
        <defs>
          <filter
            id="motion-blur-s1"
            x="-50%"
            y="-50%"
            width="200%"
            height="200%"
          >
            <feGaussianBlur
              ref={blurRef}
              in="SourceGraphic"
              stdDeviation="0, 0"
            />
          </filter>
        </defs>
      </svg>

      <div
        ref={textRef}
        className="absolute top-8 left-0 flex flex-col pl-4"
        style={{
          filter: 'url(#motion-blur-s1)',
          willChange: 'transform, opacity',
        }}
      >
        <span className="text-lg leading-tight font-medium tracking-tight text-white">
          最爱烘焙商
        </span>
        <span className="mt-1 text-[2.75rem] leading-tight font-bold tracking-tight text-white">
          {roasterName}
        </span>
        <span className="mt-2 text-xl leading-tight font-medium tracking-tight text-white">
          {beanCount} 款
        </span>
      </div>

      {roasterImages.map((image, index) => (
        <div
          key={index}
          ref={el => {
            imageRefs.current[index] = el;
          }}
          className="absolute overflow-hidden rounded-full"
          style={{
            zIndex: index + 1,
            willChange: 'transform, opacity',
          }}
        >
          <img
            src={image}
            alt="咖啡豆"
            loading="eager"
            decoding="async"
            className="h-full w-full object-cover"
          />
        </div>
      ))}
    </div>
  );
};

/**
 * Segment 2: "这就是爱" + 两列图片往左下依次重叠
 */
interface Segment2Props {
  roasterImages: string[];
  onComplete?: () => void;
}

const Segment2: React.FC<Segment2Props> = ({ roasterImages, onComplete }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const imageRefs = useRef<(HTMLDivElement | null)[]>([]);
  const blurRef = useRef<SVGFEGaussianBlurElement>(null);

  const lastXRef = useRef<number>(0);
  const velocityRef = useRef<number>(0);

  // 每列6张图片，重复使用图片
  const IMAGES_PER_COL = 6;
  const getRepeatedImages = (count: number) => {
    if (roasterImages.length === 0) return [];
    const result: string[] = [];
    for (let i = 0; i < count; i++) {
      result.push(roasterImages[i % roasterImages.length]);
    }
    return result;
  };

  const col1 = getRepeatedImages(IMAGES_PER_COL);
  const col2 = getRepeatedImages(IMAGES_PER_COL);
  const allImages = [...col1, ...col2];

  const updateBlur = () => {
    if (textRef.current && blurRef.current) {
      const transform = getComputedStyle(textRef.current).transform;
      if (transform !== 'none') {
        const matrix = new DOMMatrix(transform);
        const currentX = matrix.m41;
        const velocity = Math.abs(currentX - lastXRef.current);
        lastXRef.current = currentX;
        velocityRef.current = velocityRef.current * 0.7 + velocity * 0.3;
        const blurAmount = Math.min(velocityRef.current * 0.6, 30);
        blurRef.current.setAttribute('stdDeviation', `${blurAmount}, 0`);
      }
    }
  };

  useGSAP(
    () => {
      if (!containerRef.current || !textRef.current) return;

      const containerWidth = containerRef.current.clientWidth;
      const containerHeight = containerRef.current.clientHeight;

      // 图片大小
      const IMAGE_SIZE = Math.min(
        containerWidth * 0.58,
        containerHeight * 0.38
      );

      // 重叠偏移（60%，重叠更多）
      const overlapOffsetX = IMAGE_SIZE * 0.4; // X方向偏移
      const overlapOffsetY = IMAGE_SIZE * 0.25; // Y方向偏移更小，角度更偏向水平

      // 第一列：第一张圆的中心在右侧边缘垂直中间偏上
      // 圆心在右边缘，所以 X 位置是 containerWidth - IMAGE_SIZE/2
      const col1TargetX = containerWidth - IMAGE_SIZE / 2; // 圆心在右边缘
      const col1TargetY = containerHeight * 0.25 - IMAGE_SIZE / 2; // 第一列起始Y位置（垂直中间偏上）

      // 第二列：第一张圆的中心在右侧边缘垂直中间偏下（再往下一点）
      const col2TargetX = containerWidth - IMAGE_SIZE / 2; // 圆心在右边缘
      const col2TargetY = containerHeight * 0.7 - IMAGE_SIZE / 2; // 第二列起始Y位置（更靠下）

      gsap.ticker.add(updateBlur);

      const tl = gsap.timeline({
        onComplete: () => {
          gsap.ticker.remove(updateBlur);
          if (blurRef.current)
            blurRef.current.setAttribute('stdDeviation', '0, 0');
          onComplete?.();
        },
      });

      // 文字动画
      tl.set(textRef.current, { x: '100%', opacity: 0 }).to(textRef.current, {
        x: '0%',
        opacity: 1,
        duration: 0.5,
        ease: 'power3.out',
      });

      // 设置图片初始状态和大小（都从右边屏幕外开始）
      imageRefs.current.forEach((ref, index) => {
        if (!ref) return;
        ref.style.width = `${IMAGE_SIZE}px`;
        ref.style.height = `${IMAGE_SIZE}px`;

        const isCol1 = index < col1.length;
        const colIndex = isCol1 ? index : index - col1.length;

        // 初始位置：从右边屏幕外，按照最终位置的Y坐标排列
        const startX = containerWidth + 50 + colIndex * 30; // 稍微错开起始位置
        const startY = isCol1
          ? col1TargetY + colIndex * overlapOffsetY
          : col2TargetY + colIndex * overlapOffsetY;

        gsap.set(ref, { x: startX, y: startY, opacity: 0 });
      });

      // 第一列图片依次滑入（从边缘往左下重叠）
      col1.forEach((_, index) => {
        const ref = imageRefs.current[index];
        if (!ref) return;

        // 目标位置：每张往左下偏移，从右边边缘开始排列
        const targetX = col1TargetX - index * overlapOffsetX;
        const targetY = col1TargetY + index * overlapOffsetY;

        tl.to(
          ref,
          {
            x: targetX,
            y: targetY,
            opacity: 1,
            duration: 0.25,
            ease: 'power3.out',
          },
          0.1 + index * 0.08
        );
      });

      // 第二列图片依次滑入（从边缘往左下重叠）
      col2.forEach((_, index) => {
        const ref = imageRefs.current[col1.length + index];
        if (!ref) return;

        const targetX = col2TargetX - index * overlapOffsetX;
        const targetY = col2TargetY + index * overlapOffsetY;

        tl.to(
          ref,
          {
            x: targetX,
            y: targetY,
            opacity: 1,
            duration: 0.25,
            ease: 'power3.out',
          },
          0.15 + index * 0.08
        );
      });

      // 文字缓慢移动
      tl.to(textRef.current, { x: '-5%', duration: 1.8, ease: 'none' }, 0.5);

      // 图片依次滑出（沿着排列的角度继续向左下移动）
      const exitStartTime = 2.0;

      // 退出偏移量（继续沿着入场时的排列角度）
      const exitOffsetX = overlapOffsetX * IMAGES_PER_COL; // 继续向左
      const exitOffsetY = overlapOffsetY * IMAGES_PER_COL; // 继续向下

      // 第一列退出（从最上面的开始，即最后滑入的先走）
      [...col1].reverse().forEach((_, revIndex) => {
        const index = col1.length - 1 - revIndex;
        const ref = imageRefs.current[index];
        if (!ref) return;

        // 计算当前位置
        const currentX = col1TargetX - index * overlapOffsetX;
        const currentY = col1TargetY + index * overlapOffsetY;

        // 退出位置：沿着排列角度继续移动
        const exitX = currentX - exitOffsetX;
        const exitY = currentY + exitOffsetY;

        tl.to(
          ref,
          {
            x: exitX,
            y: exitY,
            opacity: 0,
            duration: 0.3,
            ease: 'power3.in',
          },
          exitStartTime + revIndex * 0.06
        );
      });

      // 第二列退出
      [...col2].reverse().forEach((_, revIndex) => {
        const index = col1.length + col2.length - 1 - revIndex;
        const colIndex = index - col1.length;
        const ref = imageRefs.current[index];
        if (!ref) return;

        // 计算当前位置
        const currentX = col2TargetX - colIndex * overlapOffsetX;
        const currentY = col2TargetY + colIndex * overlapOffsetY;

        // 退出位置：沿着排列角度继续移动
        const exitX = currentX - exitOffsetX;
        const exitY = currentY + exitOffsetY;

        tl.to(
          ref,
          {
            x: exitX,
            y: exitY,
            opacity: 0,
            duration: 0.3,
            ease: 'power3.in',
          },
          exitStartTime + 0.03 + revIndex * 0.06
        );
      });

      // 文字滑出
      tl.to(
        textRef.current,
        { x: '-120%', opacity: 0, duration: 0.5, ease: 'power3.in' },
        exitStartTime + 0.2
      );
    },
    { scope: containerRef, dependencies: [allImages] }
  );

  return (
    <div ref={containerRef} className="absolute inset-0 overflow-hidden">
      <svg className="absolute h-0 w-0" aria-hidden="true">
        <defs>
          <filter
            id="motion-blur-s2"
            x="-50%"
            y="-50%"
            width="200%"
            height="200%"
          >
            <feGaussianBlur
              ref={blurRef}
              in="SourceGraphic"
              stdDeviation="0, 0"
            />
          </filter>
        </defs>
      </svg>

      <div
        ref={textRef}
        className="absolute top-8 left-0 flex flex-col pl-4"
        style={{
          filter: 'url(#motion-blur-s2)',
          willChange: 'transform, opacity',
        }}
      >
        <span className="text-[3rem] leading-tight font-bold tracking-tight text-white">
          这就是爱
        </span>
      </div>

      {allImages.map((image, index) => {
        // 计算每列内的索引
        const isCol1 = index < col1.length;
        const colIndex = isCol1 ? index : index - col1.length;
        // 内层（colIndex大，后滑入的，在左下角）zIndex 最高
        // colIndex 越大，zIndex 越高
        const zIndex = colIndex + 1;

        return (
          <div
            key={index}
            ref={el => {
              imageRefs.current[index] = el;
            }}
            className="absolute overflow-hidden rounded-full shadow"
            style={{
              zIndex,
              willChange: 'transform, opacity',
            }}
          >
            <img
              src={image}
              alt="咖啡豆"
              loading="eager"
              decoding="async"
              className="h-full w-full object-cover"
            />
          </div>
        );
      })}
    </div>
  );
};

export default FavoriteRoasterScreen;
