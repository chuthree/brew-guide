'use client';

import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Edit3, GripVertical } from 'lucide-react';

import { SettingsOptions } from './Settings';
import { useSettingsStore } from '@/lib/stores/settingsStore';
import { motion, AnimatePresence, Reorder } from 'framer-motion';
import { FlavorDimension, DEFAULT_FLAVOR_DIMENSIONS } from '@/lib/core/db';
import {
  getSettingsStore,
  getFlavorDimensionsSync,
} from '@/lib/stores/settingsStore';
import hapticsUtils from '@/lib/ui/haptics';
import { useModalHistory, modalHistory } from '@/lib/hooks/useModalHistory';
import { SettingPage } from './atomic';
import DeleteConfirmDrawer from '@/components/common/ui/DeleteConfirmDrawer';

interface FlavorDimensionSettingsProps {
  settings: SettingsOptions;
  onClose: () => void;
  handleChange: <K extends keyof SettingsOptions>(
    key: K,
    value: SettingsOptions[K]
  ) => void | Promise<void>;
}

const FlavorDimensionSettings: React.FC<FlavorDimensionSettingsProps> = ({
  settings: _settings,
  onClose,
  handleChange: _handleChange,
}) => {
  // 使用 settingsStore 获取设置
  const settings = useSettingsStore(state => state.settings) as SettingsOptions;
  const updateSettings = useSettingsStore(state => state.updateSettings);

  // 使用 settingsStore 的 handleChange
  const handleChange = React.useCallback(
    async <K extends keyof SettingsOptions>(
      key: K,
      value: SettingsOptions[K]
    ) => {
      await updateSettings({ [key]: value } as any);
    },
    [updateSettings]
  );

  // 控制动画状态
  const [shouldRender, setShouldRender] = useState(true);
  const [isVisible, setIsVisible] = useState(false);

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
    id: 'flavor-dimension-settings',
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
  }, []);

  const [dimensions, setDimensions] = useState<FlavorDimension[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingLabel, setEditingLabel] = useState('');
  const [newDimensionLabel, setNewDimensionLabel] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);

  // 删除确认抽屉状态
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmData, setDeleteConfirmData] = useState<{
    id: string;
    label: string;
  } | null>(null);

  // 加载评分维度数据
  useEffect(() => {
    loadDimensions();
  }, []);

  const loadDimensions = () => {
    try {
      const loadedDimensions = getFlavorDimensionsSync();
      setDimensions(loadedDimensions);
    } catch (error) {
      console.error('加载评分维度失败:', error);
    }
  };

  // 添加新维度
  const handleAddDimension = async () => {
    if (!newDimensionLabel.trim()) return;

    try {
      await getSettingsStore().addFlavorDimension(newDimensionLabel.trim());
      loadDimensions();
      setNewDimensionLabel('');
      setShowAddForm(false);

      if (settings.hapticFeedback) {
        hapticsUtils.light();
      }
    } catch (error) {
      console.error('添加评分维度失败:', error);
      alert('添加评分维度失败，请重试');
    }
  };

  // 开始编辑
  const startEditing = (dimension: FlavorDimension) => {
    setEditingId(dimension.id);
    setEditingLabel(dimension.label);
  };

  // 保存编辑
  const saveEdit = async () => {
    if (!editingId || !editingLabel.trim()) return;

    try {
      await getSettingsStore().updateFlavorDimension(editingId, {
        label: editingLabel.trim(),
      });
      loadDimensions();
      setEditingId(null);
      setEditingLabel('');

      if (settings.hapticFeedback) {
        hapticsUtils.light();
      }
    } catch (error) {
      console.error('更新评分维度失败:', error);
      alert('更新评分维度失败，请重试');
    }
  };

  // 取消编辑
  const cancelEdit = () => {
    setEditingId(null);
    setEditingLabel('');
  };

  // 删除维度
  const handleDeleteDimension = async (id: string) => {
    const dimension = dimensions.find(d => d.id === id);
    if (!dimension) return;

    if (dimension.isDefault) {
      alert('不能删除默认评分维度');
      return;
    }

    setDeleteConfirmData({ id, label: dimension.label });
    setShowDeleteConfirm(true);
  };

  // 执行删除维度
  const executeDeleteDimension = async (id: string) => {
    try {
      await getSettingsStore().deleteFlavorDimension(id);
      loadDimensions();

      if (settings.hapticFeedback) {
        hapticsUtils.light();
      }
    } catch (error) {
      console.error('删除评分维度失败:', error);
      alert('删除评分维度失败，请重试');
    }
  };

  // 重置为默认
  const handleResetToDefault = async () => {
    setDeleteConfirmData({ id: '__reset__', label: '所有自定义维度' });
    setShowDeleteConfirm(true);
  };

  // 执行重置
  const executeResetToDefault = async () => {
    try {
      await getSettingsStore().resetFlavorDimensions();
      loadDimensions();

      if (settings.hapticFeedback) {
        hapticsUtils.medium();
      }
    } catch (error) {
      console.error('重置评分维度失败:', error);
      alert('重置评分维度失败，请重试');
    }
  };

  // 处理重新排序
  const handleReorder = async (newOrder: FlavorDimension[]) => {
    try {
      setDimensions(newOrder);
      await getSettingsStore().reorderFlavorDimensions(newOrder);

      if (settings.hapticFeedback) {
        hapticsUtils.light();
      }
    } catch (error) {
      console.error('重新排序失败:', error);
      alert('重新排序失败，请重试');
      // 出错时恢复原有顺序
      loadDimensions();
    }
  };

  if (!shouldRender) return null;

  return (
    <SettingPage
      title="评分维度设置"
      isVisible={isVisible}
      onClose={handleClose}
    >
      {/* 滚动内容区域 */}
      <div className="-mt-4 space-y-6 px-6">
        {/* 维度列表 */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
              当前维度 ({dimensions.length})
            </h3>
            <button
              onClick={handleResetToDefault}
              className="text-xs text-neutral-500 underline hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-300"
            >
              重置为默认
            </button>
          </div>

          <Reorder.Group
            axis="y"
            values={dimensions}
            onReorder={handleReorder}
            className="space-y-2"
          >
            {dimensions.map(dimension => (
              <Reorder.Item
                key={dimension.id}
                value={dimension}
                whileDrag={{
                  scale: 1.01,
                  transition: { duration: 0.1 },
                }}
                style={{
                  listStyle: 'none',
                }}
              >
                <motion.div
                  className="flex items-center py-3"
                  whileDrag={{
                    backgroundColor: 'rgba(0,0,0,0.05)',
                    transition: { duration: 0.1 },
                  }}
                  onPointerDown={e => {
                    const target = e.target as HTMLElement;
                    const isDragHandle = target.closest('.drag-handle');
                    if (!isDragHandle) {
                      e.preventDefault();
                    }
                  }}
                >
                  {/* 拖拽手柄 */}
                  <div className="drag-handle mr-3 cursor-grab p-1 pl-0 active:cursor-grabbing">
                    <motion.div
                      whileDrag={{
                        color: 'rgb(107 114 128)',
                        transition: { duration: 0.1 },
                      }}
                    >
                      <GripVertical className="h-4 w-4 text-neutral-400 dark:text-neutral-500" />
                    </motion.div>
                  </div>

                  {/* 维度内容 */}
                  <div className="flex-1">
                    {editingId === dimension.id ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={editingLabel}
                          onChange={e => setEditingLabel(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') saveEdit();
                            if (e.key === 'Escape') cancelEdit();
                          }}
                          className="flex-1 rounded bg-neutral-100 px-2 py-1 text-sm focus:ring-1 focus:ring-neutral-400 focus:outline-none dark:bg-neutral-700"
                          autoFocus
                        />
                        <button
                          onClick={saveEdit}
                          className="rounded bg-neutral-800 px-2 py-1 text-xs text-white hover:opacity-80 dark:bg-neutral-200 dark:text-neutral-800"
                        >
                          保存
                        </button>
                        <button
                          onClick={cancelEdit}
                          className="px-2 py-1 text-xs text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-300"
                        >
                          取消
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <motion.div
                          whileDrag={{
                            color: 'rgb(107 114 128)',
                            transition: { duration: 0.1 },
                          }}
                        >
                          <span className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
                            {dimension.label}
                          </span>
                          {dimension.isDefault && (
                            <span className="ml-2 text-xs text-neutral-500 dark:text-neutral-400">
                              (默认)
                            </span>
                          )}
                        </motion.div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => startEditing(dimension)}
                            className="p-1 text-neutral-400 hover:text-neutral-600 dark:text-neutral-500 dark:hover:text-neutral-300"
                          >
                            <Edit3 className="h-3 w-3" />
                          </button>
                          {!dimension.isDefault && (
                            <button
                              onClick={() =>
                                handleDeleteDimension(dimension.id)
                              }
                              className="p-1 text-neutral-400 hover:text-red-500 dark:text-neutral-500 dark:hover:text-red-400"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </motion.div>
              </Reorder.Item>
            ))}
          </Reorder.Group>
        </div>

        {/* 添加新维度 */}
        <div className="space-y-3">
          {/* <h3 className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
                            添加新维度
                        </h3>
                         */}
          <AnimatePresence>
            {showAddForm ? (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-3"
              >
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newDimensionLabel}
                    onChange={e => setNewDimensionLabel(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') handleAddDimension();
                      if (e.key === 'Escape') {
                        setShowAddForm(false);
                        setNewDimensionLabel('');
                      }
                    }}
                    placeholder="醇厚度、香气、余韵..."
                    className="flex-1 rounded border border-neutral-200/50 bg-neutral-100 px-3 py-2 text-sm focus:ring-1 focus:ring-neutral-400 focus:outline-none dark:border-neutral-700 dark:bg-neutral-800"
                    autoFocus
                  />
                  <button
                    onClick={handleAddDimension}
                    disabled={!newDimensionLabel.trim()}
                    className="rounded bg-neutral-800 px-4 py-2 text-sm text-white hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-neutral-200 dark:text-neutral-800"
                  >
                    添加
                  </button>
                  <button
                    onClick={() => {
                      setShowAddForm(false);
                      setNewDimensionLabel('');
                    }}
                    className="px-4 py-2 text-sm text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-300"
                  >
                    取消
                  </button>
                </div>
              </motion.div>
            ) : (
              <button
                onClick={() => setShowAddForm(true)}
                className="flex w-full items-center justify-center gap-2 rounded border border-dashed border-neutral-300 bg-neutral-100 px-4 py-3 text-sm font-medium text-neutral-600 transition-colors hover:border-neutral-400 hover:text-neutral-800 dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-400 dark:hover:border-neutral-500 dark:hover:text-neutral-300"
              >
                <Plus className="h-4 w-4" />
                添加新的评分维度
              </button>
            )}
          </AnimatePresence>
        </div>

        {/* 底部空间 */}
        <div className="h-20" />
      </div>

      {/* 删除确认抽屉 */}
      <DeleteConfirmDrawer
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={() => {
          if (deleteConfirmData) {
            if (deleteConfirmData.id === '__reset__') {
              executeResetToDefault();
            } else {
              executeDeleteDimension(deleteConfirmData.id);
            }
          }
        }}
        itemName={deleteConfirmData?.label || ''}
        itemType="评分维度"
        onExitComplete={() => setDeleteConfirmData(null)}
      />
    </SettingPage>
  );
};

export default FlavorDimensionSettings;
