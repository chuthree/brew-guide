'use client';

import { exportJsonFile, type JsonExportResult } from '@/lib/utils/jsonExport';

export type DataExportResult = JsonExportResult;

export interface DataExportOptions {
  returnIncompleteResult?: boolean;
}

const formatDatePart = (value: number): string =>
  value.toString().padStart(2, '0');

export const createDataExportFileName = (date: Date = new Date()): string => {
  const year = date.getFullYear();
  const month = formatDatePart(date.getMonth() + 1);
  const day = formatDatePart(date.getDate());
  const hour = formatDatePart(date.getHours());
  const minute = formatDatePart(date.getMinutes());
  const second = formatDatePart(date.getSeconds());
  return `brew-guide-data-${year}-${month}-${day}_${hour}-${minute}-${second}.json`;
};

export async function exportDataAsJsonFile(
  jsonData: string,
  options: DataExportOptions = {}
): Promise<DataExportResult> {
  return exportJsonFile({
    jsonData,
    fileName: createDataExportFileName(),
    title: '导出数据',
    text: '请选择保存位置',
    dialogTitle: '导出数据',
    returnIncompleteResult: options.returnIncompleteResult,
  });
}
