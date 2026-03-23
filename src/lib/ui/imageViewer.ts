'use client';

export interface ImageViewerPayload {
  url: string;
  alt: string;
  backUrl?: string;
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
c