'use client';

import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import Image from 'next/image';
import {
  AnimatePresence,
  LazyMotion,
  domAnimation,
  m,
  type Transition,
  type Variants,
} from 'framer-motion';
import gsap from 'gsap';
import { createPortal } from 'react-dom';
import { useModalHistory } from '@/lib/hooks/useModalHistory';

interface ImageViewerProps {
  id?: string;
  isOpen: boolean;
  imageUrl: string;
  backImageUrl?: string;
  alt: string;
  onClose: () => void;
  onExitComplete?: () => void;
}

const MODAL_ENTER_TRANSITION: Transition = {
  duration: 0.2,
  ease: [0.25, 0.1, 0.25, 1],
};

const MODAL_EXIT_TRANSITION: Transition = {
  duration: 0.18,
  ease: [0.4, 0, 1, 1] as const,
};

const overlayVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: MODAL_ENTER_TRANSITION,
  },
  exit: {
    opacity: 0,
    transition: MODAL_EXIT_TRANSITION,
  },
};

const panelVariants: Variants = {
  hidden: {
    opacity: 0,
    scale: 0.975,
    y: 8,
  },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: MODAL_ENTER_TRANSITION,
  },
  exit: {
    opacity: 0,
    scale: 0.975,
    y: 8,
    transition: MODAL_EXIT_TRANSITION,
  },
};

const FLIP_DURATION = 0.5;
const FLIP_EASE = 'sine.inOut';
const CARD_PERSPECTIVE = 1000;

const TRANSPARENT_IMAGE_STYLE: CSSProperties = {
  background: 'transparent',
};

const FLIP_SCENE_STYLE: CSSProperties = {
  perspective: CARD_PERSPECTIVE,
};

const FLIP_CARD_STYLE: CSSProperties = {
  transformStyle: 'preserve-3d',
};

const FACE_STYLE: CSSProperties = {
  backfaceVisibility: 'hidden',
};

const BACK_FACE_STYLE: CSSProperties = {
  ...FACE_STYLE,
  transform: 'rotateY(180deg)',
};

const ErrorState = () => (
  <div className="flex h-full w-full items-center justify-center p-4 text-center">
    <div>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="mx-auto mb-2 h-12 w-12 text-red-500"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
      <p className="text-neutral-500 dark:text-neutral-400">图片加载失败</p>
    </div>
  </div>
);

const baseImageClassName = 'max-h-[80vh] w-auto max-w-[92vw]';
const flippableImageClassName = `${baseImageClassName} cursor-pointer select-none`;

interface ImageViewerPanelProps {
  imageUrl: string;
  backImageUrl?: string;
  alt: string;
  onClose: () => void;
}

const ImageViewerPanel: React.FC<ImageViewerPanelProps> = ({
  imageUrl,
  backImageUrl,
  alt,
  onClose,
}) => {
  const [frontError, setFrontError] = useState(false);
  const [backError, setBackError] = useState(false);
  const hasBackImage = Boolean(backImageUrl);
  const cardRef = useRef<HTMLDivElement>(null);
  const currentRotation = useRef(0);
  const isFlippingRef = useRef(false);

  useEffect(() => {
    return () => {
      if (cardRef.current) {
        gsap.killTweensOf(cardRef.current);
      }
      currentRotation.current = 0;
      isFlippingRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!cardRef.current) return;

    gsap.set(cardRef.current, { rotateY: 0 });
  }, []);

  const flip = useCallback(() => {
    if (!cardRef.current || isFlippingRef.current) return;

    const targetRotation = currentRotation.current + 180;
    isFlippingRef.current = true;

    gsap.to(cardRef.current, {
      rotateY: targetRotation,
      duration: FLIP_DURATION,
      ease: FLIP_EASE,
      onComplete: () => {
        currentRotation.current = targetRotation;
        isFlippingRef.current = false;
      },
    });
  }, []);

  const handleFlipClick = useCallback(() => {
    if (!backImageUrl) return;
    flip();
  }, [backImageUrl, flip]);

  return (
    <m.div
      initial="hidden"
      animate="visible"
      exit="exit"
      variants={panelVariants}
      className="relative max-h-[90vh] overflow-visible"
      onClick={event => {
        if (!hasBackImage) {
          onClose();
        } else {
          event.stopPropagation();
        }
      }}
      role="dialog"
      aria-modal="true"
      aria-label={alt}
    >
      {hasBackImage ? (
        <div style={FLIP_SCENE_STYLE}>
          <div ref={cardRef} className="relative" style={FLIP_CARD_STYLE}>
            <div style={FACE_STYLE}>
              {frontError ? (
                <ErrorState />
              ) : (
                <Image
                  src={imageUrl}
                  alt={alt}
                  className={flippableImageClassName}
                  width={0}
                  height={1000}
                  style={TRANSPARENT_IMAGE_STYLE}
                  onError={() => setFrontError(true)}
                  onClick={handleFlipClick}
                  draggable={false}
                  priority
                />
              )}
            </div>

            <div
              className="absolute inset-0 flex items-center justify-center"
              style={BACK_FACE_STYLE}
            >
              {backError ? (
                <ErrorState />
              ) : (
                <Image
                  src={backImageUrl!}
                  alt={`${alt} - 背面`}
                  className={flippableImageClassName}
                  width={0}
                  height={1000}
                  style={TRANSPARENT_IMAGE_STYLE}
                  onError={() => setBackError(true)}
                  onClick={handleFlipClick}
                  draggable={false}
                  priority
                />
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="relative flex min-h-70 items-center justify-center">
          {frontError ? (
            <ErrorState />
          ) : (
            <Image
              src={imageUrl}
              alt={alt}
              className={baseImageClassName}
              width={0}
              height={1000}
              style={TRANSPARENT_IMAGE_STYLE}
              onError={() => setFrontError(true)}
              priority
            />
          )}
        </div>
      )}
    </m.div>
  );
};

const ImageViewer: React.FC<ImageViewerProps> = ({
  id = 'image-viewer',
  isOpen,
  imageUrl,
  backImageUrl,
  alt,
  onClose,
  onExitComplete,
}) => {
  useModalHistory({
    id,
    isOpen,
    onClose,
  });

  useEffect(() => {
    if (!isOpen) return;

    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };

    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <LazyMotion features={domAnimation}>
      <AnimatePresence onExitComplete={onExitComplete}>
        {isOpen ? (
          <m.div
            initial="hidden"
            animate="visible"
            exit="exit"
            variants={overlayVariants}
            className="fixed inset-0 z-100 flex items-center justify-center bg-neutral-50/90 p-4 backdrop-blur-xs dark:bg-neutral-900/90"
            onClick={onClose}
            role="presentation"
          >
            <ImageViewerPanel
              key={`${imageUrl}::${backImageUrl ?? ''}`}
              imageUrl={imageUrl}
              backImageUrl={backImageUrl}
              alt={alt}
              onClose={onClose}
            />
          </m.div>
        ) : null}
      </AnimatePresence>
    </LazyMotion>,
    document.body
  );
};

export default ImageViewer;
