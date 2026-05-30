'use client';

import { useEffect, useRef } from 'react';
import PhotoSwipe, { type EventCallback, type SlideData } from 'photoswipe';
import gsap from 'gsap';
import { useModalHistory } from '@/lib/hooks/useModalHistory';
import type { ImageViewerItem } from '@/lib/ui/imageViewer';

interface ImageViewerProps {
  id?: string;
  isOpen: boolean;
  imageUrl: string;
  backImageUrl?: string;
  alt: string;
  items?: ImageViewerItem[];
  initialIndex?: number;
  sourceElement?: HTMLElement | null;
  sourceElements?: Array<HTMLElement | null | undefined>;
  onClose: () => void;
  onExitComplete?: () => void;
}

type ImageSize = {
  width: number;
  height: number;
};

type PhotoSwipeItem = ImageViewerItem & {
  sourceElement?: HTMLElement | null;
  thumbnailCropped?: boolean;
};

type DualSideImage = {
  url: string;
  alt: string;
  size: ImageSize;
};

type DualSideImages = {
  front: DualSideImage;
  back: DualSideImage;
};

type DualSideState = {
  side: 'front' | 'back';
  isFlipping: boolean;
};

const DEFAULT_IMAGE_SIZE: ImageSize = {
  width: 1600,
  height: 1200,
};

const FLIP_DURATION = 0.5;
const FLIP_EASE = 'sine.inOut';

const imageSizeCache = new Map<string, Promise<ImageSize>>();

const getImageSize = (url: string): Promise<ImageSize> => {
  const cached = imageSizeCache.get(url);
  if (cached) return cached;

  const promise = new Promise<ImageSize>(resolve => {
    const image = new window.Image();
    const timeout = window.setTimeout(() => {
      cleanup();
      resolve(DEFAULT_IMAGE_SIZE);
    }, 2500);

    const cleanup = () => {
      window.clearTimeout(timeout);
      image.onload = null;
      image.onerror = null;
    };

    image.onload = () => {
      const width = image.naturalWidth || DEFAULT_IMAGE_SIZE.width;
      const height = image.naturalHeight || DEFAULT_IMAGE_SIZE.height;

      cleanup();
      resolve({ width, height });
    };

    image.onerror = () => {
      cleanup();
      resolve(DEFAULT_IMAGE_SIZE);
    };

    image.src = url;
  });

  imageSizeCache.set(url, promise);
  return promise;
};

const resolveSlideData = async (item: PhotoSwipeItem): Promise<SlideData> => {
  const explicitSize =
    item.width && item.height
      ? {
          width: item.width,
          height: item.height,
        }
      : null;
  const size = explicitSize ?? (await getImageSize(item.url));
  const thumbCropped =
    item.thumbnailCropped ?? isCroppedThumbnailElement(item.sourceElement);

  return {
    src: item.url,
    msrc: item.thumbnailUrl ?? item.url,
    alt: item.alt,
    width: size.width,
    height: size.height,
    element: item.sourceElement ?? undefined,
    ...(thumbCropped ? { thumbCropped: true } : {}),
  };
};

const normalizeItems = ({
  imageUrl,
  alt,
  items,
  sourceElement,
  sourceElements,
}: Pick<
  ImageViewerProps,
  'imageUrl' | 'alt' | 'items' | 'sourceElement' | 'sourceElements'
>): PhotoSwipeItem[] => {
  const normalizedItems =
    items && items.length > 0 ? items : [{ url: imageUrl, alt }];

  return normalizedItems.map((item, index) => ({
    ...item,
    sourceElement:
      item.sourceElement ?? sourceElements?.[index] ?? sourceElement ?? null,
  }));
};

const clampInitialIndex = (index: number, length: number) =>
  Math.min(Math.max(index, 0), Math.max(length - 1, 0));

const hasGalleryItems = (items?: ImageViewerItem[]) =>
  Boolean(items && items.length > 0);

const isImageActionTarget = (target: EventTarget | null) =>
  target instanceof HTMLElement && target.classList.contains('pswp__img');

const getThumbnailElement = (element?: HTMLElement | null) => {
  if (!element) return null;
  return element instanceof HTMLImageElement
    ? element
    : element.querySelector('img');
};

const isCroppedThumbnailElement = (element?: HTMLElement | null) => {
  const thumbnail = getThumbnailElement(element);
  return thumbnail
    ? window.getComputedStyle(thumbnail).objectFit === 'cover'
    : false;
};

const applyDualSideImage = (
  instance: PhotoSwipe,
  side: DualSideImage
): HTMLImageElement | null => {
  const slide = instance.currSlide;
  const content = slide?.content;
  const element = content?.element;

  if (!slide || !content || !(element instanceof HTMLImageElement)) {
    return null;
  }

  slide.data.src = side.url;
  slide.data.alt = side.alt;
  slide.data.width = side.size.width;
  slide.data.height = side.size.height;
  slide.width = side.size.width;
  slide.height = side.size.height;

  content.data.src = side.url;
  content.data.alt = side.alt;
  content.data.width = side.size.width;
  content.data.height = side.size.height;
  content.width = side.size.width;
  content.height = side.size.height;

  element.src = side.url;
  element.alt = side.alt;

  slide.calculateSize();
  slide.zoomAndPanToInitial();
  slide.applyCurrentZoomPan();
  slide.updateContentSize(true);

  return element;
};

const flipDualSideImage = async (
  instance: PhotoSwipe,
  images: DualSideImages,
  state: DualSideState
) => {
  if (state.isFlipping) {
    return;
  }

  const slide = instance.currSlide;
  const element = slide?.content.element;

  if (!slide || !(element instanceof HTMLImageElement)) {
    return;
  }

  const nextSide = state.side === 'front' ? 'back' : 'front';
  const nextImage = images[nextSide];

  state.isFlipping = true;
  slide.content.placeholder?.destroy();
  slide.content.placeholder = undefined;

  const previousTransformOrigin = element.style.transformOrigin;
  const previousBackfaceVisibility = element.style.backfaceVisibility;
  const reduceMotion = window.matchMedia(
    '(prefers-reduced-motion: reduce)'
  ).matches;

  try {
    if (reduceMotion) {
      if (applyDualSideImage(instance, nextImage)) {
        state.side = nextSide;
      }
      return;
    }

    await new Promise<void>(resolve => {
      gsap.set(element, {
        transformOrigin: 'center center',
        backfaceVisibility: 'hidden',
        rotateY: 0,
      });

      gsap.to(element, {
        rotateY: 90,
        duration: FLIP_DURATION / 2,
        ease: FLIP_EASE,
        onComplete: () => {
          if (instance.currSlide !== slide) {
            resolve();
            return;
          }

          const nextElement = applyDualSideImage(instance, nextImage);
          if (!nextElement) {
            resolve();
            return;
          }

          state.side = nextSide;
          gsap.set(nextElement, {
            transformOrigin: 'center center',
            backfaceVisibility: 'hidden',
            rotateY: -90,
          });

          gsap.to(nextElement, {
            rotateY: 0,
            duration: FLIP_DURATION / 2,
            ease: FLIP_EASE,
            onComplete: resolve,
          });
        },
      });
    });
  } finally {
    const currentElement = instance.currSlide?.content.element;
    if (currentElement instanceof HTMLImageElement) {
      gsap.killTweensOf(currentElement);
      gsap.set(currentElement, { rotateY: 0 });
      currentElement.style.transformOrigin = previousTransformOrigin;
      currentElement.style.backfaceVisibility = previousBackfaceVisibility;
    }
    state.isFlipping = false;
  }
};

const ImageViewer: React.FC<ImageViewerProps> = ({
  id = 'image-viewer',
  isOpen,
  imageUrl,
  backImageUrl,
  alt,
  items,
  initialIndex = 0,
  sourceElement,
  sourceElements,
  onClose,
  onExitComplete,
}) => {
  const pswpRef = useRef<PhotoSwipe | null>(null);
  const latestOnCloseRef = useRef(onClose);
  const latestOnExitCompleteRef = useRef(onExitComplete);
  const isDualSideViewer = Boolean(backImageUrl && !hasGalleryItems(items));

  useEffect(() => {
    latestOnCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    latestOnExitCompleteRef.current = onExitComplete;
  }, [onExitComplete]);

  useModalHistory({
    id,
    isOpen,
    onClose,
  });

  useEffect(() => {
    if (!isOpen || typeof window === 'undefined') {
      return;
    }

    let cancelled = false;
    let instance: PhotoSwipe | null = null;
    let shouldNotifyClose = true;
    let detachInstanceListeners = () => {};

    const openViewer = async () => {
      let dualSideImages: DualSideImages | null = null;
      let viewerItems: PhotoSwipeItem[];

      if (isDualSideViewer && backImageUrl) {
        const [frontSize, backSize] = await Promise.all([
          getImageSize(imageUrl),
          getImageSize(backImageUrl),
        ]);

        dualSideImages = {
          front: {
            url: imageUrl,
            alt,
            size: frontSize,
          },
          back: {
            url: backImageUrl,
            alt: `${alt} - 背面`,
            size: backSize,
          },
        };

        viewerItems = [
          {
            url: imageUrl,
            alt,
            width: frontSize.width,
            height: frontSize.height,
            sourceElement,
            thumbnailCropped: true,
          },
        ];
      } else {
        viewerItems = normalizeItems({
          imageUrl,
          alt,
          items,
          sourceElement,
          sourceElements,
        });
      }

      const safeInitialIndex = clampInitialIndex(
        initialIndex,
        viewerItems.length
      );
      const dataSource = await Promise.all(viewerItems.map(resolveSlideData));

      if (cancelled || viewerItems.length === 0) {
        return;
      }

      instance = new PhotoSwipe({
        dataSource,
        index: safeInitialIndex,
        mainClass: 'brew-image-viewer-pswp',
        bgOpacity: 1,
        spacing: 0.12,
        showHideAnimationType: 'zoom',
        showAnimationDuration: 200,
        hideAnimationDuration: 180,
        zoomAnimationDuration: 220,
        easing: 'cubic-bezier(.25,.1,.25,1)',
        padding: { top: 16, right: 16, bottom: 16, left: 16 },
        loop: viewerItems.length > 2,
        arrowPrev: viewerItems.length > 1,
        arrowNext: viewerItems.length > 1,
        counter: false,
        close: false,
        zoom: false,
        pinchToClose: true,
        closeOnVerticalDrag: true,
        bgClickAction: 'close',
        tapAction: 'close',
        doubleTapAction: false,
        imageClickAction: 'close',
        errorMsg: '图片加载失败',
        closeTitle: '关闭',
        zoomTitle: '缩放',
        arrowPrevTitle: '上一张',
        arrowNextTitle: '下一张',
        indexIndicatorSep: ' / ',
      });

      const dualSideState: DualSideState = {
        side: 'front',
        isFlipping: false,
      };

      const handleClose = () => {
        if (shouldNotifyClose) {
          latestOnCloseRef.current();
        }
      };

      const handleDestroy = () => {
        if (pswpRef.current === instance) {
          pswpRef.current = null;
        }
        latestOnExitCompleteRef.current?.();
        detachInstanceListeners();
      };

      const handleImageClickAction: EventCallback<
        'imageClickAction'
      > = event => {
        if (
          !dualSideImages ||
          !isImageActionTarget(event.originalEvent.target)
        ) {
          return;
        }

        event.preventDefault();
        void flipDualSideImage(instance!, dualSideImages, dualSideState);
      };

      const handleTapAction: EventCallback<'tapAction'> = event => {
        if (
          !dualSideImages ||
          !isImageActionTarget(event.originalEvent.target)
        ) {
          return;
        }

        event.preventDefault();
        void flipDualSideImage(instance!, dualSideImages, dualSideState);
      };

      const handleAfterSetContent: EventCallback<'afterSetContent'> = event => {
        if (!dualSideImages) {
          return;
        }

        const element = event.slide.content.element;
        if (element instanceof HTMLImageElement) {
          element.style.cursor = 'pointer';
        }
      };

      instance.on('close', handleClose);
      instance.on('destroy', handleDestroy);
      instance.on('imageClickAction', handleImageClickAction);
      instance.on('tapAction', handleTapAction);
      instance.on('afterSetContent', handleAfterSetContent);

      detachInstanceListeners = () => {
        instance?.off('close', handleClose);
        instance?.off('destroy', handleDestroy);
        instance?.off('imageClickAction', handleImageClickAction);
        instance?.off('tapAction', handleTapAction);
        instance?.off('afterSetContent', handleAfterSetContent);
      };

      pswpRef.current = instance;
      instance.init();
    };

    void openViewer();

    return () => {
      cancelled = true;

      if (instance && !instance.isDestroying) {
        shouldNotifyClose = false;
        instance.close();
      } else {
        detachInstanceListeners();
      }
    };
  }, [
    alt,
    backImageUrl,
    imageUrl,
    initialIndex,
    isDualSideViewer,
    isOpen,
    items,
    sourceElement,
    sourceElements,
  ]);

  return null;
};

export default ImageViewer;
