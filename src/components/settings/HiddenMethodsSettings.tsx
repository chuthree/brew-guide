'use client';

import React, { useState, useEffect } from 'react';
import { ChevronLeft, Eye } from 'lucide-react';
import { SettingsOptions } from './Settings';
import { getChildPageStyle } from '@/lib/navigation/pageTransition';
import hapticsUtils from '@/lib/ui/haptics';
import {
  commonMethods,
  equipmentList,
  CustomEquipment,
} from '@/lib/core/config';
import {
  getAllHiddenMethods,
  unhideCommonMethod,
} from '@/lib/managers/hiddenMethods';

interface HiddenMethodsSettingsProps {
  onClose: () => void;
  settings: SettingsOptions;
  onChange: (newSettings: SettingsOptions) => Promise<void>;
  customEquipments?: CustomEquipment[];
}

const HiddenMethodsSettings: React.FC<HiddenMethodsSettingsProps> = ({
  onClose,
  settings,
  onChange,
  customEquipments = [],
}) => {
  // 历史栈管理
  const onCloseRef = React.useRef(onClose);
  onCloseRef.current = onClose;

  React.useEffect(() => {
    window.history.pushState({ modal: 'hidden-methods-settings' }, '');

    const handlePopState = () => onCloseRef.current();
    window.addEventListener('popstate', handlePopState);

    return () => window.removeEventListener('popstate', handlePopState);
  }, []); // 空依赖数组，确保只在挂载时执行一次

  // 控制动画状态
  const [shouldRender, setShouldRender] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [hiddenMethods, setHiddenMethods] = useState<{
    [equipmentId: string]: string[];
  }>({});

  // 处理显示/隐藏动画
  useEffect(() => {
    setShouldRender(true);
    // 短暂延迟确保 DOM 渲染，然后触发滑入动画
    const timer = setTimeout(() => setIsVisible(true), 10);
    // 加载隐藏的方案
    const hidden = getAllHiddenMethods(settings);
    setHiddenMethods(hidden);
    return () => clearTimeout(timer);
  }, [settings]);

  // 关闭处理
  const handleClose = () => {
    // 立即触发退出动画
    setIsVisible(false);

    // 立即通知父组件子设置正在关闭
    window.dispatchEvent(new CustomEvent('subSettingsClosing'));

    // 等待动画完成后再真正关闭
    setTimeout(() => {
      if (window.history.state?.modal === 'hidden-methods-settings') {
        window.history.back();
      } else {
        onClose();
      }
    }, 350); // 与 IOS_TRANSITION_CONFIG.duration 一致
  };

  // 获取器具名称
  const getEquipmentName = (equipmentId: string): string => {
    // 先查找预定义器具
    const presetEquipment = equipmentList.find(eq => eq.id === equipmentId);
    if (presetEquipment) return presetEquipment.name;

    // 查找自定义器具
    const customEquipment = customEquipments.find(eq => eq.id === equipmentId);
    if (customEquipment) return customEquipment.name;

    return equipmentId;
  };

  // 获取方案名称
  const getMethodName = (equipmentId: string, methodId: string): string => {
    const methods = commonMethods[equipmentId];
    if (!methods) return methodId;

    const method = methods.find(m => (m.id || m.name) === methodId);
    return method?.name || methodId;
  };

  // 恢复单个方案
  const handleUnhideMethod = async (equipmentId: string, methodId: string) => {
    try {
      const updatedSettings = await unhideCommonMethod(
        equipmentId,
        methodId,
        settings
      );
      await onChange(updatedSettings);

      // 更新本地状态
      const hidden = getAllHiddenMethods(updatedSettings);
      setHiddenMethods(hidden);

      if (settings.hapticFeedback) {
        hapticsUtils.light();
      }
    } catch (error) {
      console.error('恢复方案失败:', error);
      alert('恢复方案失败，请重试');
    }
  };

  // 计算隐藏方案的总数
  const totalHiddenCount = Object.values(hiddenMethods).reduce(
    (sum, methods) => sum + methods.length,
    0
  );

  if (!shouldRender) return null;

  return (
    <div
      className="pt-safe-top pb-safe-bottom fixed inset-0 z-[60] mx-auto flex max-w-[640px] flex-col bg-neutral-50 sm:max-w-full dark:bg-neutral-900"
      style={getChildPageStyle(isVisible)}
    >
      {/* 头部导航栏 */}
      <div className="relative mx-auto flex w-full items-center justify-center pb-4 sm:max-w-sm">
        <button
          onClick={handleClose}
          className="absolute left-4 flex h-10 w-10 items-center justify-center rounded-full text-neutral-700 dark:text-neutral-300"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <h2 className="text-md font-medium text-neutral-800 dark:text-neutral-200">
          隐藏的通用方案
        </h2>
      </div>

      {/* 滚动内容区域 */}
      <div className="mx-auto w-full flex-1 overflow-y-auto sm:max-w-sm">
        <div className="pointer-events-none sticky top-0 z-10 h-12 w-full bg-linear-to-b from-neutral-50 to-transparent first:border-b-0 dark:from-neutral-900"></div>

        <div className="-mt-4 space-y-4 px-6">
          {totalHiddenCount === 0 ? (
            <div className="mt-12 flex flex-col items-center justify-center text-center">
              <Eye className="mb-2 h-10 w-10 text-neutral-300 dark:text-neutral-600" />
              <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
                没有隐藏的方案
              </p>
            </div>
          ) : (
            <>
              {/* 隐藏的方案列表 */}
              <div className="space-y-4">
                {Object.entries(hiddenMethods).map(
                  ([equipmentId, methodIds]) => (
                    <div key={equipmentId}>
                      <h3 className="mb-2 text-xs font-medium text-neutral-500 dark:text-neutral-400">
                        {getEquipmentName(equipmentId)}
                      </h3>
                      <div className="space-y-1.5">
                        {methodIds.map(methodId => (
                          <div
                            key={methodId}
                            className="flex w-full items-center justify-between rounded bg-neutral-100 px-4 py-3 dark:bg-neutral-800"
                          >
                            <span className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
                              {getMethodName(equipmentId, methodId)}
                            </span>
                            <button
                              onClick={() =>
                                handleUnhideMethod(equipmentId, methodId)
                              }
                              className="text-xs font-medium text-neutral-500 transition-colors hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200"
                            >
                              恢复
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                )}
              </div>
            </>
          )}

          {/* 底部空间 */}
          <div className="h-16" />
        </div>
      </div>
    </div>
  );
};

export default HiddenMethodsSettings;
