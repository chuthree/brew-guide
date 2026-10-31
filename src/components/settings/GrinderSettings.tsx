'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { SettingsOptions } from './Settings';
import { useSettingsStore } from '@/lib/stores/settingsStore';
import hapticsUtils from '@/lib/ui/haptics';
import { useModalHistory, modalHistory } from '@/lib/hooks/useModalHistory';
import { useGrinderStore } from '@/lib/stores/grinderStore';
import {
  SettingPage,
  SettingSection,
  SettingRow,
  useScrollToHighlightedSetting,
} from './atomic';
import {
  makeDynamicSettingSearchId,
  makeSettingRowSearchId,
} from './settingsSearch';

interface GrinderSettingsProps {
  onClose: () => void;
}

const GrinderSettings: React.FC<GrinderSettingsProps> = ({ onClose }) => {
  // 使用 settingsStore 获取设置
  const settings = useSettingsStore(state => state.settings) as SettingsOptions;

  // 控制动画状态
  const [isVisible, setIsVisible] = useState(false);

  // 用于保存最新的 onClose 引用
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  // 关闭处理函数（带动画）
  const handleCloseWithAnimation = useCallback(() => {
    setIsVisible(false);
    window.dispatchEvent(new CustomEvent('subSettingsClosing'));
    setTimeout(() => {
      onCloseRef.current();
    }, 350);
  }, []);

  // 使用统一的历史栈管理系统
  useModalHistory({
    id: 'grinder-settings',
    isOpen: true,
    onClose: handleCloseWithAnimation,
    skipPageExitTransitionOnHistory: true,
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

  // 编辑状态
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [addingStep, setAddingStep] = useState<'none' | 'name' | 'grindSize'>(
    'none'
  );
  const [newGrinderName, setNewGrinderName] = useState('');
  const [newGrindSize, setNewGrindSize] = useState('');

  // 临时输入值存储
  const tempGrindSizeRef = useRef<{ [key: string]: string }>({});

  // 使用 Zustand store 管理磨豆机数据
  const {
    grinders,
    initialized,
    initialize,
    addGrinder: storeAddGrinder,
    updateGrinder,
    deleteGrinder,
  } = useGrinderStore();
  useScrollToHighlightedSetting(
    `${grinders.map(grinder => grinder.id).join('\n')}:${addingStep}`
  );
  // 初始化 store
  useEffect(() => {
    if (!initialized) {
      initialize();
    }
  }, [initialized, initialize]);

  const handleAddGrinder = () => {
    if (!newGrinderName.trim() || !newGrindSize.trim()) return;

    storeAddGrinder({
      name: newGrinderName.trim(),
      currentGrindSize: newGrindSize.trim(),
    });

    setNewGrinderName('');
    setNewGrindSize('');
    setAddingStep('none');
    settings.hapticFeedback && hapticsUtils.light();
  };

  const handleGrindSizeBlur = (grinderId: string) => {
    const newSize = tempGrindSizeRef.current[grinderId];
    if (newSize !== undefined) {
      updateGrinder(grinderId, {
        currentGrindSize: newSize.trim() || undefined,
      });
      delete tempGrindSizeRef.current[grinderId];
      settings.hapticFeedback && hapticsUtils.light();
    }
    setEditingId(null);
  };

  const handleDeleteGrinder = (grinderId: string) => {
    deleteGrinder(grinderId);
    setDeletingId(null);
    settings.hapticFeedback && hapticsUtils.medium();
  };

  // 点击容器外重置删除状态
  useEffect(() => {
    if (deletingId) {
      const handleClick = () => setDeletingId(null);
      // 延迟添加监听器，避免立即触发
      const timer = setTimeout(() => {
        document.addEventListener('click', handleClick);
      }, 0);
      return () => {
        clearTimeout(timer);
        document.removeEventListener('click', handleClick);
      };
    }
  }, [deletingId]);

  return (
    <SettingPage title="磨豆机" isVisible={isVisible} onClose={handleClose}>
      <SettingSection title="磨豆机" className="-mt-4">
        {/* 添加新磨豆机 */}
        {addingStep === 'name' ? (
          <SettingRow
            vertical
            isLast={grinders.length === 0}
            settingId={makeSettingRowSearchId('添加磨豆机')}
          >
            <div className="flex h-4 min-w-0 items-center gap-2">
              <input
                type="text"
                value={newGrinderName}
                onChange={e => setNewGrinderName(e.target.value)}
                onBlur={() => {
                  if (!newGrinderName.trim()) {
                    setAddingStep('none');
                  }
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter' && newGrinderName.trim()) {
                    setAddingStep('grindSize');
                  } else if (e.key === 'Escape') {
                    setAddingStep('none');
                    setNewGrinderName('');
                  }
                }}
                aria-label="磨豆机名称"
                placeholder="输入磨豆机名称"
                autoFocus
                className="h-4 min-w-0 flex-1 appearance-none bg-transparent p-0 text-sm leading-none font-medium text-neutral-900 placeholder:text-neutral-400 focus:outline-none dark:text-neutral-100 dark:placeholder:text-neutral-500"
              />
              <button
                type="button"
                onClick={() =>
                  newGrinderName.trim() && setAddingStep('grindSize')
                }
                disabled={!newGrinderName.trim()}
                className="shrink-0 cursor-pointer text-sm leading-none font-medium text-neutral-600 active:opacity-70 disabled:cursor-not-allowed disabled:opacity-40 dark:text-neutral-300"
              >
                下一步
              </button>
            </div>
          </SettingRow>
        ) : addingStep === 'grindSize' ? (
          <SettingRow
            vertical
            isLast={grinders.length === 0}
            settingId={makeSettingRowSearchId('添加磨豆机')}
          >
            <div className="flex h-4 min-w-0 items-center gap-2">
              <span className="max-w-[50%] truncate text-sm leading-none font-medium text-neutral-900 dark:text-neutral-100">
                {newGrinderName}
              </span>
              <span className="shrink-0 text-sm leading-none font-medium text-neutral-900 dark:text-neutral-100">
                ·
              </span>
              <input
                type="text"
                value={newGrindSize}
                onChange={e => setNewGrindSize(e.target.value)}
                onBlur={() => {
                  if (!newGrindSize.trim()) {
                    setAddingStep('name');
                  }
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    handleAddGrinder();
                  } else if (e.key === 'Escape') {
                    setAddingStep('name');
                    setNewGrindSize('');
                  }
                }}
                aria-label="当前刻度"
                placeholder="输入当前刻度"
                autoFocus
                className="h-4 min-w-0 flex-1 appearance-none bg-transparent p-0 text-sm leading-none font-medium text-neutral-900 placeholder:text-neutral-400 focus:outline-none dark:text-neutral-100 dark:placeholder:text-neutral-500"
              />
              <button
                type="button"
                onClick={handleAddGrinder}
                disabled={!newGrindSize.trim()}
                className="ml-auto shrink-0 cursor-pointer text-sm leading-none font-medium text-neutral-600 active:opacity-70 disabled:cursor-not-allowed disabled:opacity-40 dark:text-neutral-300"
              >
                添加
              </button>
            </div>
          </SettingRow>
        ) : (
          <SettingRow
            settingId={makeSettingRowSearchId('添加磨豆机')}
            onClick={() => setAddingStep('name')}
            isLast={grinders.length === 0}
          >
            <span className="flex h-4 items-center text-sm leading-none font-medium text-neutral-900 dark:text-neutral-100">
              添加磨豆机
            </span>
          </SettingRow>
        )}

        {/* 磨豆机列表 */}
        {grinders.map((grinder, index) => (
          <SettingRow
            key={grinder.id}
            settingId={makeDynamicSettingSearchId('grinder', grinder.id)}
            vertical
            isLast={index === grinders.length - 1}
          >
            <div className="flex h-4 min-w-0 items-center justify-between gap-3 text-sm leading-none font-medium text-neutral-900 dark:text-neutral-100">
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <span className="max-w-[50%] truncate">{grinder.name}</span>
                <span>·</span>
                {editingId === grinder.id ? (
                  <input
                    type="text"
                    defaultValue={grinder.currentGrindSize || ''}
                    onChange={e =>
                      (tempGrindSizeRef.current[grinder.id] = e.target.value)
                    }
                    onBlur={() => handleGrindSizeBlur(grinder.id)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') e.currentTarget.blur();
                      if (e.key === 'Escape') {
                        delete tempGrindSizeRef.current[grinder.id];
                        setEditingId(null);
                      }
                    }}
                    aria-label={`${grinder.name} 的当前刻度`}
                    placeholder="当前刻度"
                    autoFocus
                    className="h-4 min-w-0 flex-1 appearance-none bg-transparent p-0 text-sm leading-none font-medium text-neutral-900 placeholder:text-neutral-400 focus:outline-none dark:text-neutral-100 dark:placeholder:text-neutral-500"
                  />
                ) : (
                  <button
                    type="button"
                    aria-label={`修改 ${grinder.name} 的当前刻度`}
                    onClick={() => {
                      setEditingId(grinder.id);
                      tempGrindSizeRef.current[grinder.id] =
                        grinder.currentGrindSize || '';
                    }}
                    className="min-w-0 truncate text-left active:opacity-70"
                  >
                    {grinder.currentGrindSize || '点击设置刻度'}
                  </button>
                )}
              </div>
              <button
                type="button"
                aria-label={`${deletingId === grinder.id ? '确认删除' : '删除'} ${grinder.name}`}
                onClick={e => {
                  e.stopPropagation();
                  if (deletingId === grinder.id) {
                    handleDeleteGrinder(grinder.id);
                  } else {
                    setDeletingId(grinder.id);
                  }
                }}
                className={`shrink-0 cursor-pointer text-sm leading-none font-medium active:opacity-70 ${
                  deletingId === grinder.id
                    ? 'text-red-500 dark:text-red-400'
                    : 'text-neutral-600 dark:text-neutral-300'
                }`}
              >
                {deletingId === grinder.id ? '确认删除' : '删除'}
              </button>
            </div>
          </SettingRow>
        ))}
      </SettingSection>
      <div className="h-16" />
    </SettingPage>
  );
};

export default GrinderSettings;
