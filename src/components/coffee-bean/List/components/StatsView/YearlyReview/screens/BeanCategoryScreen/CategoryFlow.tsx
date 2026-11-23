'use client';

import React, { useRef, useMemo } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';

interface CategoryFlowProps {
  images: string[];
  onComplete?: () => void;
}

const CategoryFlow: React.FC<CategoryFlowProps> = ({ images, onComplete }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const text1Ref = useRef<HTMLDivElement>(null);
  const text2Ref = useRef<HTMLDivElement>(null);
  const imagesRef = useRef<(HTMLDivElement | null)[]>([]);

  // Ensure we have 7 images for the visual effect
  const displayImages = useMemo(() => {
    if (images.length === 0) return [];
    let imgs = [...images];
    while (imgs.length < 7) {
      imgs = [...imgs, ...images];
    }
    return imgs.slice(0, 7);
  }, [images]);

  useGSAP(
    () => {
      if (!containerRef.current || !text1Ref.current || !text2Ref.current)
        return;

      const screenHeight = containerRef.current.clientHeight;
      const screenWidth = containerRef.current.clientWidth;

      // Configuration
      const maxImageWidth = screenWidth; // Largest image width (at bottom)
      const verticalGap = screenHeight * 0.16; // Increased gap to reduce stacking density

      // Initial State
      const progress = { value: 0 }; // 0 to 1 representing flow progress

      // Helper to update image positions and scales based on a virtual "scroll" position
      const updateImages = (scrollY: number) => {
        imagesRef.current.forEach((img, i) => {
          if (!img) return;

          // Calculate base Y position for this image in the sequence
          // We want index 0 at top, index 6 at bottom
          // But they move up, so we add scrollY (which will be negative to move up)

          const startY = screenHeight + i * verticalGap + maxImageWidth / 2;
          const currentY = startY + scrollY;

          // Calculate Scale based on Y position
          // Map Y from 0 (top) to screenHeight (bottom)
          // Top: Scale 0.3, Bottom: Scale 1.0 (Non-linear for better perspective)
          const normalizedY =
            Math.max(0, Math.min(currentY, screenHeight)) / screenHeight;
          const scale = 0.3 + 0.7 * Math.pow(normalizedY, 1.5);

          // Apply transforms
          // We use fixed width/height in CSS, so scale affects visual size
          gsap.set(img, {
            y: currentY - maxImageWidth / 2, // Center the image
            scale: scale,
            zIndex: i, // Lower index (top in list) is behind higher index (bottom in list) - Standard perspective
            opacity: currentY < -maxImageWidth ? 0 : 1, // Hide if too far up
          });
        });
      };

      // Initial render
      updateImages(0);

      // Initial Text States
      gsap.set(text1Ref.current, { opacity: 0, y: 20 });
      gsap.set(text2Ref.current, { opacity: 0, y: 50 });

      const tl = gsap.timeline({
        onUpdate: () => {
          updateImages(progress.value);
        },
        onComplete: onComplete,
      });

      // --- Animation Sequence ---

      // 1. Text 1 Appears
      tl.to(text1Ref.current, {
        opacity: 1,
        y: 0,
        duration: 0.5,
        ease: 'power2.out',
      });

      // --- Animation Sequence ---

      // 1. Text 1 Appears
      tl.to(text1Ref.current, {
        opacity: 1,
        y: 0,
        duration: 0.5,
        ease: 'power2.out',
      });

      // --- Phase 1: Show first 4 images with Text 1 ---
      // Target: Index 3 (4th image) is near bottom of screen
      // Adjusted: Move lower so subsequent images are hidden/barely visible
      // We want Index 4 to be mostly off-screen

      const index3InitialY = screenHeight + 3 * verticalGap + maxImageWidth / 2;
      // Push target lower. Center of Index 3 is below screen bottom.
      const index3TargetY = screenHeight + maxImageWidth * 0.15;
      const scrollDistance1 = index3TargetY - index3InitialY;

      // Fast Entry
      tl.to(
        progress,
        {
          value: scrollDistance1,
          duration: 2.0, // Increased duration for better visibility during slow-down
          ease: 'power2.out',
        },
        '<'
      ); // Start at the same time as text appears

      // --- Phase 2: Transition to Text 2 ---
      // Start transition slightly before Phase 1 ends to avoid full stop
      tl.addLabel('phase2', '-=0.5');

      // Text 1 Leaves
      tl.to(
        text1Ref.current,
        {
          opacity: 0,
          y: -50,
          duration: 0.5,
          ease: 'power2.in',
        },
        'phase2'
      );

      // Text 2 Enters
      tl.to(
        text2Ref.current,
        {
          opacity: 1,
          y: 0,
          duration: 0.5,
          ease: 'power2.out',
        },
        'phase2+=0.3'
      );

      // Images Move Up Fast to clear bottom area
      // Target: Index 6 (Last image) should be high enough to leave bottom 1/4 empty
      // Center of Index 6 should be around screenHeight * 0.6
      const index6InitialY = screenHeight + 6 * verticalGap + maxImageWidth / 2;
      const index6TargetY = screenHeight * 0.55;
      const scrollDistance2 = index6TargetY - index6InitialY;

      tl.to(
        progress,
        {
          value: scrollDistance2,
          duration: 2.5, // Increased duration for better visibility
          ease: 'power2.out', // Changed to 'out' (Fast -> Slow) to give reading time at the end
        },
        'phase2'
      );

      // --- Phase 3: Exit ---
      // Start exit slightly before Phase 2 ends
      tl.addLabel('exit', '-=0.2'); // Reduced overlap to preserve the slow-down phase

      // Text 2 Leaves
      tl.to(
        text2Ref.current,
        {
          y: -screenHeight * 0.5,
          opacity: 0,
          duration: 0.8,
          ease: 'power2.in',
        },
        'exit'
      );

      // Images Exit Completely
      const index6ExitY = -maxImageWidth; // Last image off top
      const finalTargetValue = index6ExitY - index6InitialY;

      tl.to(
        progress,
        {
          value: finalTargetValue,
          duration: 1.2,
          ease: 'power2.in',
        },
        'exit'
      );
    },
    { scope: containerRef }
  );

  return (
    <div
      ref={containerRef}
      className="relative flex h-full w-full flex-col items-center overflow-hidden"
    >
      {/* Text 1: Top Position (Higher up) */}
      <div
        ref={text1Ref}
        className="absolute top-[8%] z-20 w-full px-3 text-left"
      >
        <h2 className="text-4xl leading-tight font-bold tracking-tight text-white">
          今年买了很多种
          <br />
          咖啡豆
        </h2>
      </div>

      {/* Images Container */}
      <div className="pointer-events-none absolute inset-0">
        {displayImages.map((img, index) => (
          <div
            key={index}
            ref={el => {
              imagesRef.current[index] = el;
            }}
            className="absolute right-0 left-0 mx-auto overflow-hidden rounded-full shadow"
            style={{
              width: '100%', // Base width is full container width
              paddingBottom: '100%', // Aspect ratio 1:1
              height: 0,
              willChange: 'transform',
              // Initial position off-screen handled by GSAP
            }}
          >
            <div className="absolute inset-0">
              <img
                src={img}
                alt={`Coffee Bean ${index}`}
                className="h-full w-full object-cover"
              />
            </div>
          </div>
        ))}
      </div>

      {/* Text 2: Bottom Position */}
      <div
        ref={text2Ref}
        className="absolute bottom-[15%] z-20 w-full px-6 text-center"
      >
        <h2 className="text-3xl leading-tight font-bold tracking-tight text-white">
          来看看你的喜好
        </h2>
      </div>
    </div>
  );
};

export default CategoryFlow;
