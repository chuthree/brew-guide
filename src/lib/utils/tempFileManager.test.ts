import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: vi.fn(() => false),
    getPlatform: vi.fn(() => 'web'),
  },
}));

vi.mock('@capacitor/share', () => ({
  Share: { share: vi.fn() },
}));

vi.mock('@capacitor/filesystem', () => ({
  Directory: { Cache: 'CACHE' },
  Encoding: { UTF8: 'utf8' },
  Filesystem: {
    writeFile: vi.fn().mockResolvedValue(undefined),
    appendFile: vi.fn().mockResolvedValue(undefined),
    getUri: vi.fn().mockResolvedValue({ uri: 'file:///cache/export.json' }),
    deleteFile: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('./nativeGallerySaver', () => ({
  saveImageToAndroidGallery: vi.fn(),
}));

vi.mock('./nativeDocumentSaver', () => ({
  isAndroidDocumentSaverUnavailable: vi.fn(),
  saveFileWithAndroidDocumentPicker: vi.fn(),
}));

import { TempFileManager } from './tempFileManager';
import { exportJsonFile } from './jsonExport';
import { Capacitor } from '@capacitor/core';
import { Filesystem } from '@capacitor/filesystem';
import { saveFileWithAndroidDocumentPicker } from './nativeDocumentSaver';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

beforeEach(() => {
  vi.mocked(Capacitor.isNativePlatform).mockReturnValue(false);
  vi.mocked(Capacitor.getPlatform).mockReturnValue('web');
  vi.mocked(saveFileWithAndroidDocumentPicker).mockReset();
  vi.mocked(Filesystem.writeFile).mockResolvedValue({
    uri: 'file:///cache/export.json',
  });
  vi.mocked(Filesystem.appendFile).mockResolvedValue(undefined);
  vi.mocked(Filesystem.getUri).mockResolvedValue({
    uri: 'file:///cache/export.json',
  });
  vi.mocked(Filesystem.deleteFile).mockResolvedValue(undefined);
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

describe('TempFileManager image sharing', () => {
  it('uses Web Share for exported images in an installed iOS PWA', async () => {
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

    const outcome = await TempFileManager.shareImageFile(
      'data:image/png;base64,iVBORw0KGgo=',
      'brew-notes',
      {
        title: '我的咖啡冲煮笔记',
        text: '我的咖啡冲煮笔记',
        dialogTitle: '分享我的咖啡冲煮笔记',
      }
    );

    const sharedFile = share.mock.calls[0]?.[0].files[0];
    expect(canShare).toHaveBeenCalledOnce();
    expect(share).toHaveBeenCalledOnce();
    expect(sharedFile).toBeInstanceOf(File);
    expect(sharedFile.name).toMatch(/^brew-notes-\d+\.png$/);
    expect(sharedFile.type).toBe('image/png');
    expect(downloadClick).not.toHaveBeenCalled();
    expect(outcome).toBe('shared');
  });

  it('keeps exported images when sharing needs a fresh user gesture', async () => {
    const share = vi.fn();
    const downloadClick = vi.fn();
    const userActivation = { isActive: false };
    let retryShare: ((event: Event) => void) | undefined;

    vi.stubGlobal('navigator', {
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)',
      platform: 'iPhone',
      maxTouchPoints: 5,
      standalone: true,
      userActivation,
      canShare: () => true,
      share,
    });
    vi.stubGlobal('window', {
      matchMedia: () => ({ matches: true }),
    });
    vi.stubGlobal('document', {
      createElement: () => ({ click: downloadClick }),
      addEventListener: vi.fn(
        (_type: string, listener: EventListenerOrEventListenerObject) => {
          retryShare =
            typeof listener === 'function'
              ? listener
              : listener.handleEvent.bind(listener);
        }
      ),
    });

    const outcome = await TempFileManager.shareImageFile(
      'data:image/png;base64,iVBORw0KGgo=',
      'brew-notes',
      {
        title: '我的咖啡冲煮笔记',
        text: '我的咖啡冲煮笔记',
        dialogTitle: '分享我的咖啡冲煮笔记',
      }
    );

    expect(outcome).toBe('activation-required');
    expect(share).not.toHaveBeenCalled();
    expect(downloadClick).not.toHaveBeenCalled();

    userActivation.isActive = true;
    retryShare?.(
      new Event('click', {
        bubbles: true,
        cancelable: true,
      })
    );
    await Promise.resolve();
    await Promise.resolve();

    expect(share).toHaveBeenCalledOnce();
  });
});

describe('TempFileManager binary sharing', () => {
  it('uses Web Share for binary files in an installed iOS PWA', async () => {
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

    const outcome = await TempFileManager.shareBinaryFile(
      new Blob(['zip'], { type: 'application/zip' }),
      'coffee-beans.zip',
      {
        title: '分享咖啡豆',
        text: '2 款咖啡豆',
        dialogTitle: '分享咖啡豆',
      }
    );

    const sharedFile = share.mock.calls[0]?.[0].files[0];
    expect(canShare).toHaveBeenCalledOnce();
    expect(share).toHaveBeenCalledOnce();
    expect(sharedFile).toBeInstanceOf(File);
    expect(sharedFile.name).toBe('coffee-beans.zip');
    expect(sharedFile.type).toBe('application/zip');
    expect(downloadClick).not.toHaveBeenCalled();
    expect(outcome).toBe('shared');
  });
});

describe('TempFileManager JSON saving', () => {
  it('returns Android document picker cancellation as an incomplete export', async () => {
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
    vi.mocked(Capacitor.getPlatform).mockReturnValue('android');
    vi.mocked(saveFileWithAndroidDocumentPicker).mockResolvedValue('cancelled');

    const result = await exportJsonFile({
      jsonData: '{"beans":[]}',
      fileName: 'brew-guide-data',
      returnIncompleteResult: true,
    });

    expect(result).toMatchObject({
      mode: 'cancelled',
      fileName: 'brew-guide-data.json',
    });
    expect(Filesystem.deleteFile).toHaveBeenCalledOnce();
  });

  it('uses Web Share with a JSON file in an installed iOS PWA', async () => {
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

    const mode = await TempFileManager.saveJsonFile(
      '{"beans":[]}',
      'brew-guide-data.json',
      {
        title: '导出数据',
        text: '请选择保存位置',
        dialogTitle: '导出数据',
      }
    );

    const sharedFile = share.mock.calls[0]?.[0].files[0];
    expect(canShare).toHaveBeenCalledOnce();
    expect(share).toHaveBeenCalledOnce();
    expect(sharedFile).toBeInstanceOf(File);
    expect(sharedFile.name).toBe('brew-guide-data.json');
    expect(sharedFile.type).toBe('application/json');
    expect(downloadClick).not.toHaveBeenCalled();
    expect(mode).toBe('native-share');
  });

  it('keeps JSON data when sharing needs a fresh user gesture', async () => {
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

    const mode = await TempFileManager.saveJsonFile(
      '{"beans":[]}',
      'brew-guide-data.json'
    );

    expect(mode).toBe('activation-required');
    expect(share).not.toHaveBeenCalled();
    expect(downloadClick).not.toHaveBeenCalled();
  });

  it('does not report incomplete JSON shares as exported by default', async () => {
    vi.stubGlobal('navigator', {
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)',
      platform: 'iPhone',
      maxTouchPoints: 5,
      standalone: true,
      userActivation: { isActive: false },
      canShare: () => true,
      share: vi.fn(),
    });
    vi.stubGlobal('window', {
      matchMedia: () => ({ matches: true }),
    });

    await expect(
      exportJsonFile({
        jsonData: '{"beans":[]}',
        fileName: 'brew-guide-data',
      })
    ).rejects.toThrow('分享需要再次点击');

    await expect(
      exportJsonFile({
        jsonData: '{"beans":[]}',
        fileName: 'brew-guide-data',
        returnIncompleteResult: true,
      })
    ).resolves.toMatchObject({
      mode: 'activation-required',
      fileName: 'brew-guide-data.json',
    });
  });
});
