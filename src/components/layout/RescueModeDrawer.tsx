'use client';

import React, { useEffect, useReducer } from 'react';
import ActionDrawer from '@/components/common/ui/ActionDrawer';
import { showToast } from '@/components/common/feedback/LightToast';
import {
  exportRescueData,
  RESCUE_MODE_OPEN_EVENT,
} from '@/lib/rescue/rescueMode';

interface RescueModeDrawerState {
  isOpen: boolean;
  isExporting: boolean;
  isExportingLegacyPreferences: boolean;
  isRecompressing: boolean;
}

type RescueModeDrawerAction =
  | { type: 'open' }
  | { type: 'close' }
  | { type: 'exportStarted' }
  | { type: 'exportSucceeded' }
  | { type: 'exportFailed' }
  | { type: 'legacyPreferencesExportStarted' }
  | { type: 'legacyPreferencesExportSucceeded' }
  | { type: 'legacyPreferencesExportFailed' }
  | { type: 'recompressStarted' }
  | { type: 'recompressSucceeded' }
  | { type: 'recompressFailed' };

const initialState: RescueModeDrawerState = {
  isOpen: false,
  isExporting: false,
  isExportingLegacyPreferences: false,
  isRecompressing: false,
};

const rescueModeDrawerReducer = (
  state: RescueModeDrawerState,
  action: RescueModeDrawerAction
): RescueModeDrawerState => {
  switch (action.type) {
    case 'open':
      return { ...state, isOpen: true };
    case 'close':
      return { ...state, isOpen: false };
    case 'exportStarted':
      return { ...state, isExporting: true };
    case 'exportSucceeded':
      return {
        ...state,
        isExporting: false,
      };
    case 'exportFailed':
      return { ...state, isExporting: false };
    case 'legacyPreferencesExportStarted':
      return {
        ...state,
        isExportingLegacyPreferences: true,
      };
    case 'legacyPreferencesExportSucceeded':
      return {
        ...state,
        isExportingLegacyPreferences: false,
      };
    case 'legacyPreferencesExportFailed':
      return { ...state, isExportingLegacyPreferences: false };
    case 'recompressStarted':
      return {
        ...state,
        isRecompressing: true,
      };
    case 'recompressSucceeded':
      return {
        ...state,
        isRecompressing: false,
      };
    case 'recompressFailed':
      return { ...state, isRecompressing: false };
  }
};

const RescueModeDrawer: React.FC = () => {
  const [state, dispatch] = useReducer(rescueModeDrawerReducer, initialState);
  const { isOpen, isExporting, isExportingLegacyPreferences, isRecompressing } =
    state;

  useEffect(() => {
    const open = () => {
      dispatch({ type: 'open' });
    };

    window.addEventListener(RESCUE_MODE_OPEN_EVENT, open);
    return () => window.removeEventListener(RESCUE_MODE_OPEN_EVENT, open);
  }, []);

  const handleExport = async (includeImages: boolean) => {
    if (isExporting || isExportingLegacyPreferences || isRecompressing) return;

    dispatch({ type: 'exportStarted' });
    try {
      const [{ exportJsonFile }, jsonData] = await Promise.all([
        import('@/lib/utils/jsonExport'),
        includeImages
          ? import('@/lib/core/dataManager').then(({ DataManager }) =>
              DataManager.exportAllData({ collectDiagnostics: true })
            )
          : exportRescueData(),
      ]);
      const date = new Date().toISOString().slice(0, 10);
      const result = await exportJsonFile({
        jsonData,
        fileName: includeImages
          ? `brew-guide-rescue-${date}.json`
          : `brew-guide-rescue-no-images-${date}.json`,
        title: '导出抢救数据',
        text: '请选择保存位置',
        dialogTitle: '导出抢救数据',
        returnIncompleteResult: true,
      });

      if (
        result.mode === 'activation-required' ||
        result.mode === 'cancelled'
      ) {
        dispatch({ type: 'exportSucceeded' });
        showToast({
          type: 'info',
          title:
            result.mode === 'activation-required'
              ? '数据已准备好，请再次点击导出'
              : '已取消导出',
        });
        return;
      }

      dispatch({ type: 'exportSucceeded' });
      showToast({ type: 'success', title: '已导出数据' });
    } catch (error) {
      console.error('抢救导出失败:', error);
      dispatch({ type: 'exportFailed' });
      showToast({ type: 'error', title: '导出失败' });
    }
  };

  const handleRecompressImages = async () => {
    if (isRecompressing || isExporting || isExportingLegacyPreferences) return;

    dispatch({ type: 'recompressStarted' });
    try {
      const { recompressOversizedAppImages } =
        await import('@/lib/images/recompressAppImages');
      const stats = await recompressOversizedAppImages();

      dispatch({ type: 'recompressSucceeded' });
      showToast({
        type: stats.failedCount > 0 ? 'warning' : 'success',
        title:
          stats.failedCount > 0
            ? `补压完成，${stats.failedCount} 张失败`
            : stats.compressedCount > 0
              ? `已补压 ${stats.compressedCount} 张图片`
              : '没有需要补压的图片',
      });
    } catch (error) {
      console.error('图片补压失败:', error);
      dispatch({ type: 'recompressFailed' });
      showToast({ type: 'error', title: '图片补压失败' });
    }
  };

  const handleExportLegacyPreferences = async () => {
    if (isExportingLegacyPreferences || isExporting || isRecompressing) return;

    dispatch({ type: 'legacyPreferencesExportStarted' });
    try {
      const [{ exportJsonFile }, { exportLegacyPreferencesRescueData }] =
        await Promise.all([
          import('@/lib/utils/jsonExport'),
          import('@/lib/rescue/legacyPreferencesRescue'),
        ]);
      const jsonData = await exportLegacyPreferencesRescueData();
      const date = new Date().toISOString().slice(0, 10);

      const result = await exportJsonFile({
        jsonData,
        fileName: `brew-guide-legacy-preferences-rescue-${date}.json`,
        title: '导出旧版存储数据',
        text: '请选择保存位置',
        dialogTitle: '导出旧版存储数据',
        returnIncompleteResult: true,
      });

      if (
        result.mode === 'activation-required' ||
        result.mode === 'cancelled'
      ) {
        dispatch({ type: 'legacyPreferencesExportSucceeded' });
        showToast({
          type: 'info',
          title:
            result.mode === 'activation-required'
              ? '旧版存储数据已准备好，请再次点击导出'
              : '已取消导出',
        });
        return;
      }

      dispatch({ type: 'legacyPreferencesExportSucceeded' });
      showToast({ type: 'success', title: '已导出旧版存储数据' });
    } catch (error) {
      console.error('旧版存储数据导出失败:', error);
      dispatch({ type: 'legacyPreferencesExportFailed' });
      showToast({ type: 'error', title: '旧版存储导出失败' });
    }
  };

  return (
    <ActionDrawer
      isOpen={isOpen}
      onClose={() => dispatch({ type: 'close' })}
      historyId="rescue-mode"
    >
      <ActionDrawer.Content className="mb-6!">
        <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
          抢救模式
        </p>
      </ActionDrawer.Content>
      <ActionDrawer.Actions className="flex-col [&>button]:w-full [&>button]:flex-none [&>button]:text-left">
        <ActionDrawer.SecondaryButton
          onClick={() => handleExport(true)}
          disabled={
            isExporting || isExportingLegacyPreferences || isRecompressing
          }
        >
          {isExporting ? '正在导出' : '导出数据'}
        </ActionDrawer.SecondaryButton>
        <ActionDrawer.SecondaryButton
          onClick={() => handleExport(false)}
          disabled={
            isExporting || isExportingLegacyPreferences || isRecompressing
          }
        >
          导出数据（不带图片）
        </ActionDrawer.SecondaryButton>
        <ActionDrawer.SecondaryButton
          onClick={handleExportLegacyPreferences}
          disabled={
            isExporting || isExportingLegacyPreferences || isRecompressing
          }
        >
          {isExportingLegacyPreferences
            ? '正在导出旧版存储'
            : '导出旧版存储数据'}
        </ActionDrawer.SecondaryButton>
        <ActionDrawer.SecondaryButton
          onClick={handleRecompressImages}
          disabled={
            isRecompressing || isExporting || isExportingLegacyPreferences
          }
        >
          {isRecompressing ? '补压中' : '图片补压'}
        </ActionDrawer.SecondaryButton>
        <ActionDrawer.SecondaryButton
          onClick={() => dispatch({ type: 'close' })}
        >
          关闭
        </ActionDrawer.SecondaryButton>
      </ActionDrawer.Actions>
    </ActionDrawer>
  );
};

export default RescueModeDrawer;
