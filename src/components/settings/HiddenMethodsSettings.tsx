'use client';

import React, { useState, useEffect } from 'react';
import { Eye } from 'lucide-react';
import { SettingsOptions } from './Settings';
import hapticsUtils from '@/lib/ui/haptics';
import { useModalHistory, modalHistory } from '@/lib/hooks/useModalHistory';
import { SettingPage } from './atomic';
import {
  commonMethods,
  equipmentList,
  CustomEquipment,
} from '@/lib/core/config';
import {
  getAllHiddenMethods,
  useSettingsStore,
} from '@/lib/stores/settingsStore';

interface HiddenMethodsSettingsProps {
  onClose: () => void;
  settings: SettingsOptions;
  onChange: (newSettings: SettingsOptions) => Promise<void>;
  customEquipments?: CustomEquipment[];
}

const HiddenMethodsSettings: React.FC<HiddenMethodsSettingsProps> = ({
  onClose,
  settings: _settings, // 保留 props 兼容性，但使用 store
  onChange: _onChange, // 保留 props 兼容性，但使用 store
  customEquipments = [],
}) => {
  // 使用 settingsStore 获取设置
  const settings = useSettingsStore(state => state.settings) as SettingsOptions;

  // 控制动画状态
  const [shouldRender, setShouldRender] = useState(true);
  const [isVisible, setIsVisible] = useState(false);
  const [hiddenMethods, setHiddenMethods] = useState<{
    [equipmentId: string]: string[];
  }>({});

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
    id: 'hidden-methods-settings',
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
    // 加载隐藏的方案
    const hidden = getAllHiddenMethods();
    setHiddenMethods(hidden);
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
      await useSettingsStore.getState().unhideMethod(equipmentId, methodId);

      // 更新本地状态
      const hidden = getAllHiddenMethods();
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
    <SettingPage
      title="隐藏的预设方案"
      isVisible={isVisible}
      onClose={handleClose}
    >
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
              {Object.entries(hiddenMethods).map(([equipmentId, methodIds]) => (
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
              ))}
            </div>
          </>
        )}

        {/* 底部空间 */}
        <div className="h-16" />
      </div>
    </SettingPage>
  );
};

export default HiddenMethodsSettings;
