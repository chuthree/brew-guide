import { Capacitor, registerPlugin } from '@capacitor/core';

interface BrewGuideGalleryPlugin {
  savePngDataUrl(options: {
    dataUrl: string;
    fileName: string;
    albumName: string;
  }): Promise<{ uri?: string }>;
}

const BrewGuideGallery =
  registerPlugin<BrewGuideGalleryPlugin>('BrewGuideGallery');

const ensurePngDataUrl = (imageData: string): string =>
  imageData.startsWith('data:') ? imageData : `data:image/png;base64,${imageData}`;

const sanitizeFileName = (fileName: string): string =>
  fileName.replace(/[\\/:*?"<>|]/g, '-').trim() || 'brew-guide';

export async function saveImageToAndroidGallery(
  imageData: string,
  fileName = `brew-guide-${Date.now()}`
): Promise<void> {
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') {
    throw new Error('Android native gallery saver is only available on Android');
  }

  await BrewGuideGallery.savePngDataUrl({
    dataUrl: ensurePngDataUrl(imageData),
    fileName: sanitizeFileName(fileName),
    albumName: 'BrewGuide',
  });
}
