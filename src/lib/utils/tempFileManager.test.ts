import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: () => false,
    getPlatform: () => 'web',
  },
}));

vi.mock('@capacitor/share', () => ({
  Share: { share: vi.fn() },
}));

vi.mock('@capacitor/filesystem', () => ({
  Directory: { Cache: 'CACHE' },
  Encoding: { UTF8: 'utf8' },
  Filesystem: {},
}));

vi.mock('./nativeGallerySaver', () => ({
  saveImageToAndroidGallery: vi.fn(),
}));

vi.mock('./nativeDocumentSaver', () => ({
  isAndroidDocumentSaverUnavailable: vi.fn(),
  saveFileWithAndroidDocumentPicker: vi.fn(),
}));

import { TempFileManager } from './tempFileManager';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('TempFileManager image saving', () => {
  it('uses Web Share with a PNG file in an installed iOS PWA', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    const canShare = vi.fn().mockReturnValue(true);
    const downloadClick = vi.fn();

    vi.stubGlobal('navigator', {
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)',
      platform: 'iPhone',
      maxTouchPoints: 5,
      standalone: true,
      userActivation: { isActive: true },
      canShare,
      share,
    });
    vi.stubGlobal('window', {
      matchMedia: () => ({ matches: true }),
    });
    vi.stubGlobal('document', {
      createElement: () => ({ click: downloadClick }),
    });

    const outcome = await TempFileManager.saveImageToGallery(
      'data:image/png;base64,iVBORw0KGgo='
    );

    expect(canShare).toHaveBeenCalledOnce();
    expect(share).toHaveBeenCalledOnce();
    expect(share).toHaveBeenCalledWith({
      files: [expect.any(File)],
      title: 'Brew Guide 图片',
    });
    expect(downloadClick).not.toHaveBeenCalled();
    expect(outcome).toBe('shared');
  });

  it('keeps the generated image when sharing needs a fresh user gesture', async () => {
    const share = vi.fn();
    const downloadClick = vi.fn();

    vi.stubGlobal('navigator', {
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)',
      platform: 'iPhone',
      maxTouchPoints: 5,
      standalone: true,
      userActivation: { isActive: false },
      canShare: () => true,
      share,
    });
    vi.stubGlobal('window', {
      matchMedia: () => ({ matches: true }),
    });
    vi.stubGlobal('document', {
      createElement: () => ({ click: downloadClick }),
    });

    const outcome = await TempFileManager.saveImageToGallery(
      'data:image/png;base64,iVBORw0KGgo='
    );

    expect(outcome).toBe('activation-required');
    expect(share).not.toHaveBeenCalled();
    expect(downloadClick).not.toHaveBeenCalled();
  });

  it('treats closing the iOS share sheet as a cancellation', async () => {
    const share = vi
      .fn()
      .mockRejectedValue(new DOMException('Share cancelled', 'AbortError'));

    vi.stubGlobal('navigator', {
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)',
      platform: 'iPhone',
      maxTouchPoints: 5,
      standalone: true,
      userActivation: { isActive: true },
      canShare: () => true,
      share,
    });
    vi.stubGlobal('window', {
      matchMedia: () => ({ matches: true }),
    });

    const outcome = await TempFileManager.saveImageToGallery(
      'data:image/png;base64,iVBORw0KGgo='
    );

    expect(outcome).toBe('cancelled');
  });

  it('keeps direct downloads for regular web browsers', async () => {
    const downloadClick = vi.fn();
    const remove = vi.fn();
    const appendChild = vi.fn();
    const link = {
      click: downloadClick,
      download: '',
      href: '',
      remove,
      style: {},
    };

    vi.stubGlobal('navigator', {
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
      platform: 'MacIntel',
      maxTouchPoints: 0,
      standalone: false,
    });
    vi.stubGlobal('window', {
      matchMedia: () => ({ matches: false }),
    });
    vi.stubGlobal('document', {
      createElement: () => link,
      body: { appendChild },
    });

    const outcome = await TempFileManager.saveImageToGallery(
      'data:image/png;base64,iVBORw0KGgo='
    );

    expect(outcome).toBe('downloaded');
    expect(appendChild).toHaveBeenCalledWith(link);
    expect(downloadClick).toHaveBeenCalledOnce();
    expect(remove).toHaveBeenCalledOnce();
  });
});
