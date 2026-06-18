import { describe, expect, it } from 'vitest';
import {
  OFFICIAL_DEMO_MODE,
  canOpenPreviewSettings,
  canMutatePreviewData,
  canUsePreviewMainTab,
  shouldAutoRunPreviewImageRecognition,
  shouldOpenImportedBeanEditor,
  shouldShowPreviewInventoryActions,
  shouldRenderPreviewBeanDetailModal,
} from './previewMode';

describe('preview mode', () => {
  it('runs as the official demo build without URL flags', () => {
    expect(OFFICIAL_DEMO_MODE).toBe(true);
  });

  it('keeps navigation labels visible but only enables coffee beans', () => {
    expect(canUsePreviewMainTab('咖啡豆')).toBe(true);
    expect(canUsePreviewMainTab('冲煮')).toBe(false);
    expect(canUsePreviewMainTab('笔记')).toBe(false);
  });

  it('disables settings in preview mode', () => {
    expect(canOpenPreviewSettings(true)).toBe(false);
    expect(canOpenPreviewSettings(false)).toBe(true);
  });

  it('keeps the bean detail modal mounted on non-large preview screens', () => {
    expect(shouldRenderPreviewBeanDetailModal(true, false)).toBe(true);
    expect(shouldRenderPreviewBeanDetailModal(true, true)).toBe(false);
    expect(shouldRenderPreviewBeanDetailModal(false, false)).toBe(false);
  });

  it('keeps preview data read-only', () => {
    expect(canMutatePreviewData(true)).toBe(false);
    expect(canMutatePreviewData(false)).toBe(true);
  });

  it('runs image recognition directly in preview mode', () => {
    expect(shouldAutoRunPreviewImageRecognition(true)).toBe(true);
    expect(shouldAutoRunPreviewImageRecognition(false)).toBe(false);
  });

  it('skips the imported bean editor in preview mode', () => {
    expect(shouldOpenImportedBeanEditor(true)).toBe(false);
    expect(shouldOpenImportedBeanEditor(false)).toBe(true);
  });

  it('hides inventory actions that mutate or export preview content', () => {
    expect(shouldShowPreviewInventoryActions(true)).toBe(false);
    expect(shouldShowPreviewInventoryActions(false)).toBe(true);
  });
});
