'use client';

import React, { useState, useRef, useCallback } from 'react';
import ActionDrawer from '@/components/common/ui/ActionDrawer';
import { useGrinderStore, type Grinder } from '@/lib/stores/grinderStore';
import { ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import hapticsUtils from '@/lib/ui/haptics';
import { getEquipmentNameById } from '@/lib/utils/equipmentUtils';
import { useCustomEquipmentStore } from '@/lib/stores/customEquipmentStore';
import { useCustomMethodStore } from '@/lib/stores/customMethodStore';
import { brewingMethods } from '@/lib/core/config';
import {
  formatNoteBeanDisplayName,
  type RoasterSettings,
} from '@/lib/utils/beanVarietyUtils';
import { useSettingsStore } from '@/lib/stores/settingsStore';
import GrinderScaleWheel, {
  type GrinderScaleWheelHandle,
  type WheelPointer,
} from './GrinderScaleWheel';

interface GrindSizeDrawerProps {
  /** 是否打开抽屉 */
  isOpen: boolean;
  /** 关闭抽屉的回调 */
  onClose: () => void;
  /** 初始选中的磨豆机ID */
  initialGrinderId?: string;
  /** 磨豆机切换回调 */
  onGrinderChange?: (grinderId: string) => void;
  quickSession: number;
  openingPointer: WheelPointer | null;
  hapticFeedback: boolean;
}

/**
 * 研磨度抽屉组件
 *
 * 功能：
 * - 显示当前研磨度，支持编辑
 * - 显示最近使用的研磨度历史
 * - 支持切换磨豆机
 */
const GrindSizeDrawer: React.FC<GrindSizeDrawerProps> = ({
  isOpen,
  onClose,
  initialGrinderId,
  onGrinderChange,
  quickSession,
  openingPointer,
  hapticFeedback,
}) => {
  const { grinders, saveGrinderScale } = useGrinderStore();
  const { equipments: customEquipments } = useCustomEquipmentStore();
  const { methodsByEquipment } = useCustomMethodStore();
  const roasterFieldEnabled = useSettingsStore(
    state => state.settings.roasterFieldEnabled
  );
  const roasterSeparator = useSettingsStore(
    state => state.settings.roasterSeparator
  );
  const [selectedGrinderId, setSelectedGrinderId] = useState<string | null>(
    initialGrinderId || null
  );
  const [showGrinderSelector, setShowGrinderSelector] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const saveInProgress = useRef(false);
  const wheel = useRef<GrinderScaleWheelHandle>(null);
  const roasterSettings: RoasterSettings = {
    roasterFieldEnabled,
    roasterSeparator,
  };

  // 选中的磨豆机
  const selectedGrinder =
    grinders.find(g => g.id === selectedGrinderId) ??
    grinders.find(g => g.id === initialGrinderId) ??
    grinders[0];

  /**
   * 获取方案名称（支持系统预设和自定义方案）
   */
  const getMethodName = useCallback(
    (methodId: string, equipmentId?: string): string => {
      // 如果没有方案ID，返回空
      if (!methodId) return '';

      // 如果有器具ID，先在自定义方案中查找
      if (equipmentId) {
        const customMethods = methodsByEquipment[equipmentId] || [];
        const customMethod = customMethods.find(m => m.id === methodId);
        if (customMethod) {
          return customMethod.name;
        }
      }

      // 在所有自定义方案中查找（如果没有器具ID或在指定器具中没找到）
      for (const methods of Object.values(methodsByEquipment)) {
        const method = methods.find(m => m.id === methodId);
        if (method) {
          return method.name;
        }
      }

      // 在系统预设方案中查找
      for (const [, methods] of Object.entries(brewingMethods)) {
        const method = methods.find(m => m.name === methodId);
        if (method) {
          return method.name;
        }
      }

      // 如果都找不到，返回ID本身
      return methodId;
    },
    [methodsByEquipment]
  );

  const close = () => {
    setSaveFailed(false);
    setShowGrinderSelector(false);
    onClose();
  };

  const leaveGrinder = async (afterSave: () => void) => {
    if (!selectedGrinder || saveInProgress.current || !wheel.current) return;
    const change = wheel.current.readChanges();
    if (change === false) return;
    if (!change) {
      afterSave();
      return;
    }

    saveInProgress.current = true;
    setSaving(true);
    setSaveFailed(false);
    try {
      await saveGrinderScale(selectedGrinder.id, change.value, change.settings);
      if (hapticFeedback) hapticsUtils.light();
      afterSave();
    } catch {
      setSaveFailed(true);
    } finally {
      saveInProgress.current = false;
      setSaving(false);
    }
  };

  const requestClose = () => void leaveGrinder(close);
  const clearSaveError = () => setSaveFailed(false);

  // 切换磨豆机
  const handleSelectGrinder = useCallback(
    (grinder: Grinder) => {
      setSelectedGrinderId(grinder.id);
      setShowGrinderSelector(false);
      setSaveFailed(false);
      onGrinderChange?.(grinder.id);
      if (hapticFeedback) hapticsUtils.light();
    },
    [hapticFeedback, onGrinderChange]
  );

  if (!selectedGrinder) return null;

  return (
    <ActionDrawer
      title="研磨刻度"
      isOpen={isOpen}
      onClose={requestClose}
      autoFocus={false}
      dismissible={!saving}
      repositionInputs={false}
    >
      {/* 磨豆机选择器 - 左上角紧凑布局 */}
      <div className="relative">
        <div>
          <div className="flex items-start justify-between pr-16">
            {/* 磨豆机名称按钮 */}
            {grinders.length > 1 ? (
              <button
                type="button"
                disabled={saving}
                onClick={() => setShowGrinderSelector(!showGrinderSelector)}
                className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2.5 py-1.5 text-xs font-medium text-neutral-700 transition-colors active:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:active:bg-neutral-700"
              >
                <span>{selectedGrinder.name}</span>
                <ChevronDown
                  className={`h-3.5 w-3.5 transition-transform ${
                    showGrinderSelector ? 'rotate-180' : ''
                  }`}
                />
              </button>
            ) : (
              <div className="inline-flex items-center rounded-full bg-neutral-100 px-2.5 py-1.5 text-xs font-medium text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">
                <span>{selectedGrinder.name}</span>
              </div>
            )}
          </div>

          {/* 磨豆机列表 */}
          <AnimatePresence>
            {showGrinderSelector && grinders.length > 1 && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {grinders
                    .filter(g => g.id !== selectedGrinder.id)
                    .map(grinder => (
                      <button
                        type="button"
                        key={grinder.id}
                        disabled={saving}
                        onClick={() =>
                          void leaveGrinder(() => handleSelectGrinder(grinder))
                        }
                        className="inline-flex items-center rounded-full bg-neutral-100 px-2.5 py-1.5 text-xs font-medium text-neutral-700 transition-colors active:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:active:bg-neutral-700"
                      >
                        {grinder.name}
                      </button>
                    ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {saveFailed && (
          <p
            role="alert"
            className="mt-3 text-sm text-red-600 dark:text-red-400"
          >
            刻度保存失败，请再次关闭抽屉以重试。
          </p>
        )}
        <GrinderScaleWheel
          ref={wheel}
          key={`${selectedGrinder.id}:${quickSession}`}
          grinder={selectedGrinder}
          openingPointer={openingPointer}
          saving={saving}
          onClose={requestClose}
          onRestore={clearSaveError}
        >
          {/* 最近使用 */}
          {selectedGrinder.grindSizeHistory &&
            selectedGrinder.grindSizeHistory.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-medium text-neutral-500 dark:text-neutral-400">
                  最近使用
                </p>
                <div className="flex flex-col gap-1.5">
                  {selectedGrinder.grindSizeHistory
                    .slice(0, 3)
                    .map((item, index) => {
                      // 获取器具名称
                      const equipmentName = item.equipment
                        ? getEquipmentNameById(item.equipment, customEquipments)
                        : '';

                      // 获取方案名称
                      const methodName = item.method
                        ? getMethodName(item.method, item.equipment)
                        : '';

                      const coffeeBeanName = formatNoteBeanDisplayName(
                        {
                          name: item.coffeeBeanName || item.coffeeBean || '',
                          roaster: item.coffeeBeanRoaster,
                        },
                        roasterSettings
                      );

                      // 智能截断：限制每个字段的最大长度，确保所有字段都能显示
                      const truncateText = (
                        text: string,
                        maxLength: number
                      ) => {
                        if (text.length <= maxLength) return text;
                        return text.slice(0, maxLength) + '…';
                      };

                      // 构建左侧信息（咖啡豆 · 器具 · 方案），每个字段限制长度
                      const leftParts = [
                        coffeeBeanName ? truncateText(coffeeBeanName, 8) : '',
                        equipmentName ? truncateText(equipmentName, 6) : '',
                        methodName ? truncateText(methodName, 6) : '',
                      ].filter(Boolean);

                      return (
                        <div
                          key={index}
                          className="flex w-full items-center justify-between gap-2 rounded-full bg-neutral-100 px-3 py-1.5 text-xs dark:bg-neutral-800"
                        >
                          <span className="min-w-0 flex-1 truncate">
                            <span className="font-medium text-neutral-800 dark:text-neutral-100">
                              {item.grindSize}
                            </span>
                            {leftParts.length > 0 && (
                              <span className="text-neutral-500 dark:text-neutral-500">
                                {' · ' + leftParts.join(' · ')}
                              </span>
                            )}
                          </span>
                          <span className="shrink-0 text-neutral-500 dark:text-neutral-500">
                            {formatTimestamp(item.timestamp)}
                          </span>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}
        </GrinderScaleWheel>
      </div>
    </ActionDrawer>
  );
};

/**
 * 格式化时间戳
 */
function formatTimestamp(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;

  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diff < minute) {
    return '刚刚';
  } else if (diff < hour) {
    const minutes = Math.floor(diff / minute);
    return `${minutes}分钟前`;
  } else if (diff < day) {
    const hours = Math.floor(diff / hour);
    return `${hours}小时前`;
  } else if (diff < 7 * day) {
    const days = Math.floor(diff / day);
    return `${days}天前`;
  } else {
    const date = new Date(timestamp);
    return `${date.getMonth() + 1}/${date.getDate()}`;
  }
}

export default GrindSizeDrawer;
