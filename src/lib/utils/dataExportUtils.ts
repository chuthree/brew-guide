'use client';

import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

const ANDROID_EXPORT_DIR = 'BrewGuide/exports';

export type DataExportMode = 'web-download' | 'android-local' | 'native-share';

export interface DataExportResult {
  mode: DataExportMode;
  fileName: string;
  relativePath?: string;
  uri?: string;
}

const formatDatePart = (value: number): string => value.toString().padStart(2, '0');

export const createDataExportFileName = (date: Date = new Date()): string => {
  const year = date.getFullYear();
  const month = formatDatePart(date.getMonth() + 1);
  const day = formatDatePart(date.getDate());
  const hour = formatDatePart(date.getHours());
  const minute = formatDatePart(date.getMinutes());
  const second = formatDatePart(date.getSeconds());
  return `brew-guide-data-${year}-${month}-${day}_${hour}-${minute}-${second}.json`;
};

const downloadJsonInWeb = (jsonData: string, fileName: string): void => {
  const blob = new Blob([jsonData], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();

  setTimeout(() => {
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  }, 100);
};

const ensureAndroidStoragePermission = async (): Promise<void> => {
  const permissionStatus = await Filesystem.checkPermissions();
  if (permissionStatus.publicStorage === 'granted') {
    return;
  }

  const requestResult = await Filesystem.requestPermissions();
  if (requestResult.publicStorage !== 'granted') {
    throw new Error('未授予文件权限，无法导出到本地文档目录');
  }
};

const exportJsonToAndroidDocuments = async (
  jsonData: string,
  fileName: string
): Promise<DataExportResult> => {
  await ensureAndroidStoragePermission();

  const relativePath = `${ANDROID_EXPORT_DIR}/${fileName}`;
  const writeResult = await Filesystem.writeFile({
    path: relativePath,
    data: jsonData,
    directory: Directory.Documents,
    encoding: Encoding.UTF8,
    recursive: true,
  });

  return {
    mode: 'android-local',
    fileName,
    relativePath,
    uri: writeResult.uri,
  };
};

const exportJsonByNativeShare = async (
  jsonData: string,
  fileName: string
): Promise<DataExportResult> => {
  await Filesystem.writeFile({
    path: fileName,
    data: jsonData,
    directory: Directory.Cache,
    encoding: Encoding.UTF8,
  });

  const uriResult = await Filesystem.getUri({
    path: fileName,
    directory: Directory.Cache,
  });

  try {
    await Share.share({
      title: '导出数据',
      text: '请选择保存位置',
      files: [uriResult.uri],
      dialogTitle: '导出数据',
    });
  } finally {
    await Filesystem.deleteFile({
      path: fileName,
      directory: Directory.Cache,
    }).catch(() => undefined);
  }

  return {
    mode: 'native-share',
    fileName,
    uri: uriResult.uri,
  };
};

export async function exportDataAsJsonFile(
  jsonData: string
): Promise<DataExportResult> {
  const fileName = createDataExportFileName();

  if (!Capacitor.isNativePlatform()) {
    downloadJsonInWeb(jsonData, fileName);
    return { mode: 'web-download', fileName };
  }

  if (Capacitor.getPlatform() === 'android') {
    return exportJsonToAndroidDocuments(jsonData, fileName);
  }

  return exportJsonByNativeShare(jsonData, fileName);
}
