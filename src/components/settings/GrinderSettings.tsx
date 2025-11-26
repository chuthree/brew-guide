'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ChevronLeft, Plus } from 'lucide-react';
import { SettingsOptions } from './Settings';
import hapticsUtils from '@/lib/ui/haptics';
import { getChildPageStyle } from '@/lib/navigation/pageTransition';
import { useModalHistory, modalHistory } from '@/lib/hooks/useModalHistory';

interface Grinder {
  id: string;
  name: string;
  currentGrindSize?: string;
}

interface GrinderSettingsProps {
  settings: SettingsOptions;
  onClose: () => void;
  handleChange: <K extends keyof SettingsOptions>(
    key: K,
    value: SettingsOptions[K]
  ) => void | Promise<void>;
}

const GrinderSettings: React.FC<GrinderSettingsProps> = ({
  settings,
  onClose,
  handleChange,
}) => {
  // 控制动画状态
  const [shouldRender, setShouldRender] = useState(true);
  const [isVisible, setIsVisible] = useState(false);

  // 用于保存最新的 onClose 引用
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

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
  const grinders = settings.grinders || [];

  const handleAddGrinder = () => {
    if (!newGrinderName.trim() || !newGrindSize.trim()) return;

    handleChange('grinders', [
      ...grinders,
      {
        id: `grinder_${Date.now()}`,
        name: newGrinderName.trim(),
        currentGrindSize: newGrindSize.trim(),
      },
    ]);

    setNewGrinderName('');
    setNewGrindSize('');
    setAddingStep('none');
    settings.hapticFeedback && hapticsUtils.light();
  };

  const handleGrindSizeBlur = (grinderId: string) => {
    const newSize = tempGrindSizeRef.current[grinderId];
    if (newSize !== undefined) {
      handleChange(
        'grinders',
        grinders.map(g =>
          g.id === grinderId
            ? { ...g, currentGrindSize: newSize.trim() || undefined }
            : g
        )
      );
      delete tempGrindSizeRef.current[grinderId];
      settings.hapticFeedback && hapticsUtils.light();
    }
    setEditingId(null);
  };

  const handleDeleteGrinder = (grinderId: string) => {
    handleChange(
      'grinders',
      grinders.filter(g => g.id !== grinderId)
    );
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

  if (!shouldRender) return null;

  const pageStyle = getChildPageStyle(isVisible);

  return (
    <div
      className="fixed inset-0 mx-auto flex max-w-[500px] flex-col bg-neutral-50 dark:bg-neutral-900"
      style={pageStyle}
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
          磨豆机设置（Beta）
        </h2>
      </div>

      {/* 滚动内容区域 */}
      <div className="pb-safe-bottom relative flex-1 overflow-y-auto">
        {/* 顶部渐变阴影 */}
        <div className="pointer-events-none sticky top-0 z-10 h-12 w-full bg-linear-to-b from-neutral-50 to-transparent first:border-b-0 dark:from-neutral-900"></div>

        <div className="-mt-4 space-y-4 px-6">
          {/* 磨豆机列表 */}
          {grinders.map(grinder => {
            const isEditing = editingId === grinder.id;
            return (
              <div
                key={grinder.id}
                className="flex items-center justify-between gap-3 rounded bg-neutral-100 px-4 py-3 text-sm font-medium text-neutral-800 dark:bg-neutral-800 dark:text-neutral-200"
              >
                <div className="flex flex-1 items-center gap-2">
                  {grinder.name}
                  <span>·</span>
                  {isEditing ? (
                    <input
                      type="text"
                      defaultValue={grinder.currentGrindSize || ''}
                      onChange={e =>
                        (tempGrindSizeRef.current[grinder.id] = e.target.value)
                      }
                      onBlur={() => handleGrindSizeBlur(grinder.id)}
                      placeholder="当前刻度"
                      autoFocus
                      className="flex-1 appearance-none bg-transparent text-sm font-medium text-neutral-900 placeholder:text-neutral-400 focus:outline-none dark:text-neutral-100 dark:placeholder:text-neutral-500"
                    />
                  ) : (
                    <span
                      onClick={() => {
                        setEditingId(grinder.id);
                        tempGrindSizeRef.current[grinder.id] =
                          grinder.currentGrindSize || '';
                      }}
                      className="cursor-pointer"
                    >
                      {grinder.currentGrindSize || '点击设置刻度'}
                    </span>
                  )}
                </div>
                <button
                  onClick={e => {
                    e.stopPropagation();
                    if (deletingId === grinder.id) {
                      handleDeleteGrinder(grinder.id);
                    } else {
                      setDeletingId(grinder.id);
                    }
                  }}
                  className={`text-xs font-medium transition-colors ${
                    deletingId === grinder.id
                      ? 'text-red-600 dark:text-red-400'
                      : 'text-neutral-500 hover:text-red-600 dark:text-neutral-400 dark:hover:text-red-400'
                  }`}
                >
                  {deletingId === grinder.id ? '确认删除' : '删除'}
                </button>
              </div>
            );
          })}

          {/* 添加新磨豆机 */}
          {addingStep === 'name' ? (
            <div className="flex items-center gap-2 rounded bg-neutral-100 px-4 py-3 dark:bg-neutral-800">
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
                placeholder="输入磨豆机名称"
                autoFocus
                className="flex-1 appearance-none bg-transparent text-sm font-medium text-neutral-900 placeholder:text-neutral-400 focus:outline-none dark:text-neutral-100 dark:placeholder:text-neutral-500"
              />
              <button
                onClick={() =>
                  newGrinderName.trim() && setAddingStep('grindSize')
                }
                disabled={!newGrinderName.trim()}
                className="text-xs font-medium text-neutral-800 transition-colors hover:text-neutral-900 disabled:cursor-not-allowed disabled:opacity-40 dark:text-neutral-200 dark:hover:text-neutral-100"
              >
                下一步
              </button>
            </div>
          ) : addingStep === 'grindSize' ? (
            <div className="flex items-center gap-2 rounded bg-neutral-100 px-4 py-3 dark:bg-neutral-800">
              <span className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
                {newGrinderName}
              </span>
              <span className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
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
                placeholder="输入当前刻度"
                autoFocus
                className="flex-1 appearance-none bg-transparent text-sm font-medium text-neutral-900 placeholder:text-neutral-400 focus:outline-none dark:text-neutral-100 dark:placeholder:text-neutral-500"
              />
              <button
                onClick={handleAddGrinder}
                disabled={!newGrindSize.trim()}
                className="ml-auto text-xs font-medium text-neutral-800 transition-colors hover:text-neutral-900 disabled:cursor-not-allowed disabled:opacity-40 dark:text-neutral-200 dark:hover:text-neutral-100"
              >
                添加
              </button>
            </div>
          ) : (
            <button
              onClick={() => setAddingStep('name')}
              className="flex w-full items-center justify-center gap-2 rounded bg-neutral-100 px-4 py-3 text-sm font-medium text-neutral-800 transition-colors hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700"
            >
              <Plus className="h-4 w-4" />
              添加磨豆机
            </button>
          )}

          {/* 底部空间 */}
          <div className="h-16" />
        </div>
      </div>
    </div>
  );
};

export default GrinderSettings;
