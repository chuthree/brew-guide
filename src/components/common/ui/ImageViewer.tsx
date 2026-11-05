'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import PhotoSwipe, { type EventCallback, type SlideData } from 'photoswipe';
import gsap from 'gsap';
import { useModalHistory } from '@/lib/hooks/useModalHistory';
import type { ImageViewerAction, ImageViewerItem } from '@/lib/ui/imageViewer';
import ImageSaveDrawer from './ImageSaveDrawer';

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
  action?: ImageViewerAction;
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

type FlipStageRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

type FlipStageElements = {
  stage: HTMLDivElement;
  card: HTMLDivElement;
  shadow: HTMLDivElement;
};

const FLIP_DURATION = 0.64;
const FLIP_LIFT_Y = -6;
const FLIP_Z = 32;
const FLIP_SCALE = 1.01;
const FLIP_ROTATE_Z = 0.4;
const FLIP_EDGE_SWITCH = 0.48;
const FLIP_EDGE_PRE_ANGLE = 87;
const FLIP_EDGE_POST_ANGLE = 93;
const FLIP_SIZE_MORPH_DURATION = 0.2;

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

const setActionElementPending = (element: HTMLElement, pending: boolean) => {
  const idleLabel = element.dataset.label || '';
  const loadingLabel = element.dataset.loadingLabel || idleLabel;

  element.textContent = pending ? loadingLabel : idleLabel;
  element.classList.toggle('is-loading', pending);
  element.setAttribute('aria-busy', pending ? 'true' : 'false');

  if (element instanceof HTMLButtonElement) {
    element.disabled = pending;
  }
};

const registerViewerAction = (
  instance: PhotoSwipe,
  action: ImageViewerAction
) => {
  let isPending = false;

  instance.on('uiRegister', () => {
    instance.ui?.registerElement({
      name: 'brewImageViewerAction',
      className: 'brew-image-viewer-action-button',
      isButton: true,
      appendTo: 'root',
      order: 30,
      html: action.label,
      title: action.label,
      ariaLabel: action.ariaLabel ?? action.label,
      onInit: element => {
        element.dataset.label = action.label;
        element.dataset.loadingLabel = action.loadingLabel ?? action.label;
      },
      onClick: async (event, element) => {
        event.preventDefault();
        event.stopPropagation();

        if (isPending) {
          return;
        }

        isPending = true;
        setActionElementPending(element, true);

        try {
          await action.onClick();
        } catch (error) {
          console.error('[ImageViewer] Action failed:', error);
        } finally {
          isPending = false;
          setActionElementPending(element, false);
        }
      },
    });
  });
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

const getFlipStageRect = (
  element: HTMLImageElement,
  root: HTMLElement
): FlipStageRect | null => {
  const imageRect = element.getBoundingClientRect();
  const rootRect = root.getBoundingClientRect();

  if (imageRect.width < 1 || imageRect.height < 1) {
    return null;
  }

  return {
    left: imageRect.left - rootRect.left,
    top: imageRect.top - rootRect.top,
    width: imageRect.width,
    height: imageRect.height,
  };
};

const setFlipStageRect = (stage: HTMLDivElement, rect: FlipStageRect) => {
  stage.style.left = `${rect.left}px`;
  stage.style.top = `${rect.top}px`;
  stage.style.width = `${rect.width}px`;
  stage.style.height = `${rect.height}px`;
};

const createFlipFaceImage = (image: DualSideImage) => {
  const element = new window.Image();
  element.src = image.url;
  element.alt = image.alt;
  element.decoding = 'async';
  element.draggable = false;

  return element;
};

const createFlipStage = (
  root: HTMLElement,
  currentImage: DualSideImage,
  nextImage: DualSideImage,
  rect: FlipStageRect
): FlipStageElements => {
  const stage = document.createElement('div');
  stage.className = 'brew-image-viewer-flip-stage';
  stage.setAttribute('aria-hidden', 'true');
  setFlipStageRect(stage, rect);

  const shadow = document.createElement('div');
  shadow.className = 'brew-image-viewer-flip-shadow';

  const card = document.createElement('div');
  card.className = 'brew-image-viewer-flip-card';

  const frontFace = document.createElement('div');
  frontFace.className = 'brew-image-viewer-flip-face';
  frontFace.appendChild(createFlipFaceImage(currentImage));

  const backFace = document.createElement('div');
  backFace.className =
    'brew-image-viewer-flip-face brew-image-viewer-flip-back';
  backFace.appendChild(createFlipFaceImage(nextImage));

  card.append(frontFace, backFace);
  stage.append(shadow, card);
  root.appendChild(stage);

  return { stage, card, shadow };
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
  const root = instance.element;

  if (!slide || !root || !(element instanceof HTMLImageElement)) {
    return;
  }

  const nextSide = state.side === 'front' ? 'back' : 'front';
  const currentImage = images[state.side];
  const nextImage = images[nextSide];

  state.isFlipping = true;
  slide.content.placeholder?.destroy();
  slide.content.placeholder = undefined;

  const previousVisibility = element.style.visibility;
  const previousPointerEvents = element.style.pointerEvents;
  const reduceMotion = window.matchMedia(
    '(prefers-reduced-motion: reduce)'
  ).matches;
  let stageElements: FlipStageElements | null = null;
  let finishAnimation: (() => void) | null = null;
  const handleFlipCancel = () => finishAnimation?.();

  try {
    if (reduceMotion) {
      if (applyDualSideImage(instance, nextImage)) {
        state.side = nextSide;
      }
      return;
    }

    const initialRect = getFlipStageRect(element, root);
    if (!initialRect) {
      if (applyDualSideImage(instance, nextImage)) {
        state.side = nextSide;
      }
      return;
    }

    const direction = state.side === 'front' ? 1 : -1;
    stageElements = createFlipStage(root, currentImage, nextImage, initialRect);
    element.style.visibility = 'hidden';
    element.style.pointerEvents = 'none';

    await new Promise<void>(resolve => {
      const { stage, card, shadow } = stageElements!;
      let isFinished = false;
      let timeline: ReturnType<typeof gsap.timeline> | null = null;
      const finish = () => {
        if (isFinished) return;

        isFinished = true;
        timeline?.kill();
        gsap.killTweensOf([stage, card, shadow]);
        resolve();
      };

      finishAnimation = finish;
      instance.on('close', handleFlipCancel);
      instance.on('destroy', handleFlipCancel);

      gsap.set(card, {
        rotateY: 0,
        rotateZ: 0,
        scale: 1,
        y: 0,
        z: 0,
      });

      timeline = gsap.timeline({ onComplete: finish });
      timeline.to(
        card,
        {
          rotateY: direction * FLIP_EDGE_PRE_ANGLE,
          duration: FLIP_DURATION * FLIP_EDGE_SWITCH,
          ease: 'power2.in',
        },
        0
      );
      timeline.set(
        card,
        {
          rotateY: direction * FLIP_EDGE_POST_ANGLE,
        },
        FLIP_DURATION * FLIP_EDGE_SWITCH
      );
      timeline.to(
        card,
        {
          rotateY: direction * 180,
          duration: FLIP_DURATION * (1 - FLIP_EDGE_SWITCH),
          ease: 'power2.out',
        },
        FLIP_DURATION * FLIP_EDGE_SWITCH
      );
      timeline.to(
        card,
        {
          rotateZ: direction * FLIP_ROTATE_Z,
          scale: FLIP_SCALE,
          y: FLIP_LIFT_Y,
          z: FLIP_Z,
          duration: FLIP_DURATION / 2,
          ease: 'power2.out',
        },
        0
      );
      timeline.to(
        card,
        {
          rotateZ: 0,
          scale: 1,
          y: 0,
          z: 0,
          duration: FLIP_DURATION / 2,
          ease: 'power2.inOut',
        },
        FLIP_DURATION / 2
      );
      timeline.to(
        shadow,
        {
          opacity: 0.34,
          scaleX: 0.82,
          scaleY: 0.88,
          duration: FLIP_DURATION / 2,
          ease: 'power2.out',
        },
        0
      );
      timeline.to(
        shadow,
        {
          opacity: 0.16,
          scaleX: 1,
          scaleY: 1,
          duration: FLIP_DURATION / 2,
          ease: 'power2.inOut',
        },
        FLIP_DURATION / 2
      );
      timeline.call(
        () => {
          if (instance.currSlide !== slide || instance.isDestroying) {
            finish();
            return;
          }

          const nextElement = applyDualSideImage(instance, nextImage);
          if (!nextElement) {
            finish();
            return;
          }

          state.side = nextSide;
          nextElement.style.visibility = 'hidden';
          nextElement.style.pointerEvents = 'none';

          const nextRect = getFlipStageRect(nextElement, root);
          if (nextRect) {
            gsap.to(stage, {
              left: nextRect.left,
              top: nextRect.top,
              width: nextRect.width,
              height: nextRect.height,
              duration: FLIP_SIZE_MORPH_DURATION,
              ease: 'power2.out',
            });
          }
        },
        [],
        FLIP_DURATION * FLIP_EDGE_SWITCH
      );
    });
  } finally {
    instance.off('close', handleFlipCancel);
    instance.off('destroy', handleFlipCancel);
    finishAnimation = null;
    stageElements?.stage.remove();

    const currentElement = instance.currSlide?.content.element;
    element.style.visibility = previousVisibility;
    element.style.pointerEvents = previousPointerEvents;

    if (currentElement instanceof HTMLImageElement) {
      currentElement.style.visibility = previousVisibility;
      currentElement.style.pointerEvents = previousPointerEvents;
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
  action,
  onClose,
  onExitComplete,
}) => {
  const pswpRef = useRef<PhotoSwipe | null>(null);
  const latestOnCloseRef = useRef(onClose);
  const latestOnExitCompleteRef = useRef(onExitComplete);
  const saveDrawerOpenRef = useRef(false);
  const [saveTarget, setSaveTarget] = useState<{
    url: string | null;
    container: HTMLElement;
  } | null>(null);
  const isDualSideViewer = Boolean(backImageUrl && !hasGalleryItems(items));

  const closeSaveDrawer = useCallback(() => {
    saveDrawerOpenRef.current = false;
    setSaveTarget(target => (target ? { ...target, url: null } : null));
  }, []);

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
        padding: { top: 16, right: 16, bottom: action ? 88 : 16, left: 16 },
        loop: viewerItems.length > 2,
        arrowPrev: false,
        arrowNext: false,
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
      let pressTimer: ReturnType<typeof setTimeout> | undefined;
      let pressStart: { x: number; y: number } | null = null;
      let suppressImageAction = false;

      const clearPressTimer = () => {
        clearTimeout(pressTimer);
        pressTimer = undefined;
        pressStart = null;
      };

      const openSaveDrawer = () => {
        const element = instance?.currSlide?.content.element;
        if (
          !instance?.opener.isOpen ||
          !instance.element ||
          instance.gestures.isDragging ||
          instance.gestures.isZooming ||
          dualSideState.isFlipping ||
          saveDrawerOpenRef.current ||
          !(element instanceof HTMLImageElement) ||
          !element.naturalWidth
        ) {
          return;
        }

        suppressImageAction = true;
        saveDrawerOpenRef.current = true;
        setSaveTarget({
          url: element.currentSrc || element.src,
          container: instance.element,
        });
      };

      const handlePointerDown: EventCallback<'pointerDown'> = event => {
        clearPressTimer();
        suppressImageAction = false;
        const pointer = event.originalEvent;
        if (
          pointer.isPrimary === false ||
          pointer.button !== 0 ||
          !isImageActionTarget(pointer.target) ||
          dualSideState.isFlipping ||
          saveDrawerOpenRef.current
        ) {
          return;
        }

        // Block native image dragging without cancelling PhotoSwipe's gestures.
        pointer.preventDefault();
        pressStart = { x: pointer.clientX, y: pointer.clientY };
        pressTimer = setTimeout(openSaveDrawer, 500);
      };

      const handlePointerMove: EventCallback<'pointerMove'> = event => {
        if (!pressStart) return;
        const pointer = event.originalEvent;
        if (
          Math.hypot(
            pointer.clientX - pressStart.x,
            pointer.clientY - pressStart.y
          ) > 8
        ) {
          clearPressTimer();
        }
      };

      const handlePointerUp: EventCallback<'pointerUp'> = event => {
        clearPressTimer();
        // PhotoSwipe has released the pointer; skip the tap that closes or flips it.
        if (suppressImageAction || saveDrawerOpenRef.current) {
          event.preventDefault();
        }
      };

      const handleContextMenu = (event: Event) => {
        if (!isImageActionTarget(event.target)) return;
        event.preventDefault();
        clearPressTimer();
        openSaveDrawer();
      };

      const handleDragStart = (event: Event) => {
        if (isImageActionTarget(event.target)) event.preventDefault();
      };

      const handleKeyDown: EventCallback<'keydown'> = event => {
        if (saveDrawerOpenRef.current) {
          event.preventDefault();
          return;
        }
        const key = event.originalEvent;
        if (key.key === 'ContextMenu' || (key.shiftKey && key.key === 'F10')) {
          key.preventDefault();
          openSaveDrawer();
        }
      };

      const handleBindSaveEvents = () => {
        instance?.events.add(instance.element, 'contextmenu', handleContextMenu);
        instance?.events.add(instance.element, 'dragstart', handleDragStart);
        instance?.events.add(window, 'blur', clearPressTimer);
      };

      const handleSlideChange = () => {
        clearPressTimer();
        closeSaveDrawer();
      };

      if (action) {
        registerViewerAction(instance, action);
      }

      const handleClose = () => {
        clearPressTimer();
        closeSaveDrawer();
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
        if (suppressImageAction || saveDrawerOpenRef.current) {
          event.preventDefault();
          return;
        }
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
        if (suppressImageAction || saveDrawerOpenRef.current) {
          event.preventDefault();
          return;
        }
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
        const element = event.slide.content.element;
        if (element instanceof HTMLImageElement) {
          element.draggable = false;
          if (dualSideImages) element.style.cursor = 'pointer';
        }
      };

      instance.on('close', handleClose);
      instance.on('destroy', handleDestroy);
      instance.on('imageClickAction', handleImageClickAction);
      instance.on('tapAction', handleTapAction);
      instance.on('afterSetContent', handleAfterSetContent);
      instance.on('pointerDown', handlePointerDown);
      instance.on('pointerMove', handlePointerMove);
      instance.on('pointerUp', handlePointerUp);
      instance.on('keydown', handleKeyDown);
      instance.on('bindEvents', handleBindSaveEvents);
      instance.on('change', handleSlideChange);

      detachInstanceListeners = () => {
        clearPressTimer();
        instance?.off('close', handleClose);
        instance?.off('destroy', handleDestroy);
        instance?.off('imageClickAction', handleImageClickAction);
        instance?.off('tapAction', handleTapAction);
        instance?.off('afterSetContent', handleAfterSetContent);
        instance?.off('pointerDown', handlePointerDown);
        instance?.off('pointerMove', handlePointerMove);
        instance?.off('pointerUp', handlePointerUp);
        instance?.off('keydown', handleKeyDown);
        instance?.off('bindEvents', handleBindSaveEvents);
        instance?.off('change', handleSlideChange);
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
    action,
    alt,
    backImageUrl,
    closeSaveDrawer,
    imageUrl,
    initialIndex,
    isDualSideViewer,
    isOpen,
    items,
    sourceElement,
    sourceElements,
  ]);

  return (
    <ImageSaveDrawer
      imageUrl={isOpen ? (saveTarget?.url ?? null) : null}
      historyId={`${id}-save-image`}
      portalContainer={saveTarget?.container}
      onClose={closeSaveDrawer}
    />
  );
};

export default ImageViewer;
