'use client';

import React, { useState, useEffect } from 'react';
import { ChevronLeft, Eye } from 'lucide-react';
import { SettingsOptions } from './Settings';
import { getChildPageStyle } from '@/lib/navigation/pageTransition';
import hapticsUtils from '@/lib/ui/haptics';
import { useModalHistory, modalHistory } from '@/lib/hooks/useModalHistory';
import { equipmentList, CustomEquipment } from '@/lib/core/config';
import {
  getHiddenEquipmentIds,
  unhideEquipment,
} from '@/lib/managers/hiddenEquipments';

interface HiddenEquipmentsSettingsProps {
  onClose: () => void;
  settings: SettingsOptions;
  onChange: (newSettings: SettingsOptions) => Promise<void>;
  customEquipments?: CustomEquipment[];
}

const HiddenEquipmentsSettings: React.FC<HiddenEquipmentsSettingsProps> = ({
  onClose,
  settings,
  onChange,
  customEquipments = [],
}) => {
  // 控制动画状态
  const [shouldRender, setShouldRender] = useState(true);
  const [isVisible, setIsVisible] = useState(false);
  const [hiddenEquipmentIds, setHiddenEquipmentIds] = useState<string[]>([]);

  // 用于保存最新的 onClose 引用
  const onCloseRef = React.useRef(onClose);
  onCloseRef.current = onClose;

  // 关闭处理函数（带动画）
  const handleCloseWithAnimation = React.useCallback(() => {
    setIsVisible(false);
    window.dispatchEvent(new CustomEvent('subSettingsClosing'));
    setTimeout(() => {
      onCloseRef.current();
    }, 350);
  }, []);

  // 使用统一的历史栈管理系统
  useModalHistory({
    id: 'hidden-equipments-settings',
    isOpen: true,
    onClose: handleCloseWithAnimation,
  });

  // UI 返回按钮点击处理
  const handleClose = () => {
    modalHistory.back();
  };

  // 处理显示/隐藏动画（入场动画）
  useEffect(() => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setIsVisible(true);
      });
    });
    // 加载隐藏的器具
    const hidden = getHiddenEquipmentIds(settings);
    setHiddenEquipmentIds(hidden);
  }, [settings]);

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

  // 检查是否为自定义器具
  const isCustomEquipment = (equipmentId: string): boolean => {
    return customEquipments.some(eq => eq.id === equipmentId);
  };

  // 恢复单个器具
  const handleUnhideEquipment = async (equipmentId: string) => {
    try {
      const updatedSettings = await unhideEquipment(equipmentId, settings);
      await onChange(updatedSettings);

      // 更新本地状态
      const hidden = getHiddenEquipmentIds(updatedSettings);
      setHiddenEquipmentIds(hidden);

      if (settings.hapticFeedback) {
        hapticsUtils.light();
      }
    } catch (error) {
      console.error('恢复器具失败:', error);
      alert('恢复器具失败，请重试');
    }
  };

  if (!shouldRender) return null;

  return (
    <div
      className="fixed inset-0 mx-auto flex max-w-[500px] flex-col bg-neutral-50 dark:bg-neutral-900"
      style={getChildPageStyle(isVisible)}
    >
      {/* 头部导航栏 */}
      <div className="pt-safe-top relative flex items-center justify-center py-4">
        <button
          onClick={handleClose}
          className="absolute left-4 flex h-10 w-10 items-center justify-center rounded-full text-neutral-700 dark:text-neutral-300"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <h2 className="text-md font-medium text-neutral-800 dark:text-neutral-200">
          隐藏的预设器具
        </h2>
      </div>

      {/* 滚动内容区域 */}
      <div className="pb-safe-bottom relative flex-1 overflow-y-auto">
        {/* 顶部渐变阴影 */}
        <div className="pointer-events-none sticky top-0 z-10 h-12 w-full bg-linear-to-b from-neutral-50 to-transparent first:border-b-0 dark:from-neutral-900"></div>

        <div className="-mt-4 space-y-4 px-6">
          {hiddenEquipmentIds.length === 0 ? (
            <div className="mt-12 flex flex-col items-center justify-center text-center">
              <Eye className="mb-2 h-10 w-10 text-neutral-300 dark:text-neutral-600" />
              <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
                没有隐藏的器具
              </p>
            </div>
          ) : (
            <>
              {/* 隐藏的器具列表 */}
              <div className="space-y-1.5">
                {hiddenEquipmentIds.map(equipmentId => (
                  <div
                    key={equipmentId}
                    className="flex w-full items-center justify-between rounded bg-neutral-100 px-4 py-3 dark:bg-neutral-800"
                  >
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
                        {getEquipmentName(equipmentId)}
                      </span>
                      {isCustomEquipment(equipmentId) && (
                        <span className="text-xs text-neutral-500 dark:text-neutral-400">
                          自定义器具
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => handleUnhideEquipment(equipmentId)}
                      className="text-xs font-medium text-neutral-500 transition-colors hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200"
                    >
                      恢复
                    </button>
                  </div>
                ))}
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

export default HiddenEquipmentsSettings;
