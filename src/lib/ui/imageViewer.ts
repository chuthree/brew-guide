'use client';

export interface ImageViewerPayload {
  url: string;
  alt: string;
  backUrl?: string;
  items?: ImageViewerItem[];
  index?: number;
  sourceElement?: HTMLElement | null;
  sourceElements?: Array<HTMLElement | null | undefined>;
}

export interface ImageViewerItem {
  url: string;
  alt: string;
  width?: number;
  height?: number;
  thumbnailUrl?: string;
  sourceElement?: HTMLElement | null;
}

export const IMAGE_VIEWER_OPEN_EVENT = 'imageViewerOpen';

export const openImageViewer = (payload: ImageViewerPayload) => {
  if (typeof window === 'undefined') return;

  window.dispatchEvent(
    new CustomEvent<ImageViewerPayload>(IMAGE_VIEWER_OPEN_EVENT, {
      detail: payload,
    })
  );
};

declare global {
  interface WindowEventMap {
    imageViewerOpen: CustomEvent<ImageViewerPayload>;
  }
}
