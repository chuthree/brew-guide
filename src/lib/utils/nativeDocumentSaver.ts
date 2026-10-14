import { Capacitor, registerPlugin } from '@capacitor/core';

interface BrewGuideDocumentPlugin {
  saveFile(options: {
    sourceUri: string;
    fileName: string;
    mimeType: string;
    sha256?: string;
  }): Promise<{ uri?: string; cancelled?: boolean }>;
}

const BrewGuideDocument =
  registerPlugin<BrewGuideDocumentPlugin>('BrewGuideDocument');

const DOCUMENT_PLUGIN_NAME = 'BrewGuideDocument';

class AndroidDocumentSaverUnavailableError extends Error {
  constructor(message = 'Android document saver plugin is unavailable') {
    super(message);
    this.name = 'AndroidDocumentSaverUnavailableError';
  }
}

const sanitizeFileName = (fileName: string): string =>
  fileName.replace(/[\\/:*?"<>|]/g, '-').trim() || 'brew-guide-export';

export async function saveFileWithIOSDocumentPicker(options: {
  sourceUri: string;
  fileName: string;
  mimeType: string;
  sha256: string;
}): Promise<'saved' | 'cancelled'> {
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'ios') {
    throw new Error('iOS document saver is only available on iOS');
  }
  const result = await BrewGuideDocument.saveFile({
    ...options,
    fileName: sanitizeFileName(options.fileName),
  });
  if (!result.cancelled && !result.uri)
    throw new Error('备份文件保存结果不完整');
  return result.cancelled ? 'cancelled' : 'saved';
}

export function isAndroidDocumentSaverUnavailable(error: unknown): boolean {
  if (error instanceof AndroidDocumentSaverUnavailableError) {
    return true;
  }

  const message = error instanceof Error ? error.message : String(error ?? '');

  return (
    message.includes(DOCUMENT_PLUGIN_NAME) &&
    /not implemented|not available|unavailable/i.test(message)
  );
}

export async function saveFileWithAndroidDocumentPicker(options: {
  sourceUri: string;
  fileName: string;
  mimeType: string;
}): Promise<'saved' | 'cancelled'> {
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') {
    throw new Error('Android document saver is only available on Android');
  }

  if (
    typeof Capacitor.isPluginAvailable === 'function' &&
    !Capacitor.isPluginAvailable(DOCUMENT_PLUGIN_NAME)
  ) {
    throw new AndroidDocumentSaverUnavailableError();
  }

  try {
    const result = await BrewGuideDocument.saveFile({
      sourceUri: options.sourceUri,
      fileName: sanitizeFileName(options.fileName),
      mimeType: options.mimeType,
    });
    return result.cancelled ? 'cancelled' : 'saved';
  } catch (error) {
    if (isAndroidDocumentSaverUnavailable(error)) {
      throw new AndroidDocumentSaverUnavailableError(
        error instanceof Error ? error.message : undefined
      );
    }

    throw error;
  }
}
