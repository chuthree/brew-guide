'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import ActionDrawer from '@/components/common/ui/ActionDrawer';
import { useGrinderStore, type Grinder } from '@/lib/stores/grinderStore';
import { ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import hapticsUtils from '@/lib/ui/haptics';
import { getEquipmentNameById } from '@/lib/utils/equipmentUtils';
import { useCustomEquipmentStore } from '@/lib/stores/customEquipmentStore';
import { useCustomMethodStore } from '@/lib/stores/customMethodStore';
import { brewingMethods } from '@/lib/core/config';

interface GrindSizeDrawerProps {
  /** 是否打开抽屉 */
  isOpen: boolean;
  /** 关闭抽屉的回调 */
  onClose: () => void;
  /** 初始选中的磨豆机ID */
  initialGrinderId?: string;
  /** 磨豆机切换回调 */
  onGrinderChange?: (grinderId: string) => void;
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
}) => {
  const { grinders, updateGrinder } = useGrinderStore();
  const { equipments: customEquipments } = useCustomEquipmentStore();
  const { methodsByEquipment } = useCustomMethodStore();
  const [selectedGrinderId, setSelectedGrinderId] = useState<string | null>(
    initialGrinderId || null
  );
  const [editValue, setEditValue] = useState('');
  const [showGrinderSelector, setShowGrinderSelector] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // 选中的磨豆机
  const selectedGrinder = grinders.find(g => g.id === selectedGrinderId);

  /**
   * 获取方案名称（支持系统预设和自定义方案）
   */
  const getMethodName = useCallback((methodId: string, equipmentId?: string): string => {
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
  }, [methodsByEquipment]);

  // 初始化选中的磨豆机
  useEffect(() => {
    if (!selectedGrinderId && grinders.length > 0) {
      setSelectedGrinderId(grinders[0].id);
    }
  }, [grinders, selectedGrinderId]);

  // 同步编辑值
  useEffect(() => {
    if (selectedGrinder) {
      setEditValue(selectedGrinder.currentGrindSize || '');
    }
  }, [selectedGrinder]);

  // 自动聚焦输入框
  useEffect(() => {
    if (isOpen && inputRef.current) {
      // 动画完成后自动聚焦输入框
      const focusTimer = setTimeout(() => {
        inputRef.current?.focus();
      }, 400);
      return () => clearTimeout(focusTimer);
    }
  }, [isOpen]);

  // 保存研磨度
  const handleSave = useCallback(async () => {
    if (!selectedGrinder || !editValue.trim()) return;

    const newGrindSize = editValue.trim();
    const oldGrindSize = selectedGrinder.currentGrindSize;

    // 如果研磨度没有变化，直接关闭
    if (newGrindSize === oldGrindSize) {
      onClose();
      return;
    }

    // 更新历史记录
    const history = selectedGrinder.grindSizeHistory || [];
    const newHistory = [
      { grindSize: newGrindSize, timestamp: Date.now() },
      ...history.filter(h => h.grindSize !== newGrindSize), // 去重
    ].slice(0, 3); // 最多保留3条

    await updateGrinder(selectedGrinder.id, {
      currentGrindSize: newGrindSize,
      grindSizeHistory: newHistory,
    });

    hapticsUtils.light();
    onClose();
  }, [selectedGrinder, editValue, updateGrinder, onClose]);

  // 切换磨豆机
  const handleSelectGrinder = useCallback((grinder: Grinder) => {
    setSelectedGrinderId(grinder.id);
    setShowGrinderSelector(false);
    onGrinderChange?.(grinder.id);
    hapticsUtils.light();
  }, [onGrinderChange]);

  // 处理输入键盘事件
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        handleSave();
      }
    },
    [handleSave]
  );

  if (!selectedGrinder) return null;

  return (
    <ActionDrawer
      isOpen={isOpen}
      onClose={onClose}
    >
      <ActionDrawer.Content>
        {/* 磨豆机选择器 - 左上角紧凑布局 */}
        <div>
          <div className="flex items-start justify-between">
            {/* 磨豆机名称按钮 */}
            {grinders.length > 1 ? (
              <button
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
                    .filter(g => g.id !== selectedGrinderId)
                    .map(grinder => (
                      <button
                        key={grinder.id}
                        onClick={() => handleSelectGrinder(grinder)}
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

        {/* 研磨度输入 */}
        <div className="text-center my-8">
          <input
            ref={inputRef}
            type="text"
            inputMode="decimal"
            value={editValue}
            onChange={e => setEditValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入研磨度"
            style={{ fontFamily: 'ui-rounded, "SF Pro Rounded", system-ui, sans-serif' }}
            className="w-full bg-transparent text-center text-5xl font-bold text-neutral-800 outline-none placeholder:text-neutral-300 dark:text-neutral-100 dark:placeholder:text-neutral-700"
          />
        </div>

        {/* 最近使用 */}
        {selectedGrinder.grindSizeHistory &&
          selectedGrinder.grindSizeHistory.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-medium text-neutral-500 dark:text-neutral-400">
                最近使用
              </p>
              <div className="flex flex-col gap-1.5">
                {selectedGrinder.grindSizeHistory.slice(0, 3).map((item, index) => {
                  // 获取器具名称
                  const equipmentName = item.equipment
                    ? getEquipmentNameById(item.equipment, customEquipments)
                    : '';
                  
                  // 获取方案名称
                  const methodName = item.method
                    ? getMethodName(item.method, item.equipment)
                    : '';
                  
                  // 获取咖啡豆名称
                  const coffeeBeanName = item.coffeeBean || '';
                  
                  // 智能截断：限制每个字段的最大长度，确保所有字段都能显示
                  const truncateText = (text: string, maxLength: number) => {
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
                      className="w-full flex items-center justify-between gap-2 rounded-full bg-neutral-100 px-3 py-1.5 text-xs dark:bg-neutral-800"
                    >
                      <span className="min-w-0 flex-1">
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
      </ActionDrawer.Content>

      <ActionDrawer.Actions>
        <ActionDrawer.SecondaryButton onClick={handleSave}>
          关闭
        </ActionDrawer.SecondaryButton>
      </ActionDrawer.Actions>
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
