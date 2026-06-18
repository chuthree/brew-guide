export const OFFICIAL_DEMO_MODE = true;

export const canUsePreviewMainTab = (tab: string) => tab === '咖啡豆';

export const canOpenPreviewSettings = (isPreviewMode: boolean) =>
  !isPreviewMode;

export const canMutatePreviewData = (isPreviewMode: boolean) =>
  !isPreviewMode;

export const shouldAutoRunPreviewImageRecognition = (isPreviewMode: boolean) =>
  isPreviewMode;

export const shouldOpenImportedBeanEditor = (isPreviewMode: boolean) =>
  !isPreviewMode;

export const shouldShowPreviewInventoryActions = (isPreviewMode: boolean) =>
  !isPreviewMode;

export const shouldRenderPreviewBeanDetailModal = (
  isPreviewMode: boolean,
  isLargeScreen: boolean
) => isPreviewMode && !isLargeScreen;
