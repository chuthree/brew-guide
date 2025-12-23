'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Plus, ChevronDown, Info, Link2, Unlink } from 'lucide-react';
import { SettingsOptions } from './Settings';
import { useSettingsStore } from '@/lib/stores/settingsStore';
import hapticsUtils from '@/lib/ui/haptics';
import { useModalHistory, modalHistory } from '@/lib/hooks/useModalHistory';
import { useGrinderStore, type Grinder } from '@/lib/stores/grinderStore';
import { SettingPage } from './atomic';

interface GrinderSettingsProps {
  settings: SettingsOptions;
  onClose: () => void;
  handleChange: <K extends keyof SettingsOptions>(
    key: K,
    value: SettingsOptions[K]
  ) => void | Promise<void>;
}

const GrinderSettings: React.FC<GrinderSettingsProps> = ({
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

  // 使用 Zustand store 管理磨豆机数据
  const {
    grinders,
    initialized,
    initialize,
    addGrinder: storeAddGrinder,
    updateGrinder,
    deleteGrinder,
  } = useGrinderStore();

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

  if (!shouldRender) return null;

  return (
    <SettingPage title="磨豆机设置" isVisible={isVisible} onClose={handleClose}>
      {/* 顶部渐变阴影 */}
      <div className="-mt-4 space-y-4 px-6">
        {/* 使用指南 - 可展开收起（仅在有磨豆机时显示） */}
        {grinders.length > 0 && (
          <details className="group rounded bg-neutral-100 dark:bg-neutral-800">
            <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-medium text-neutral-600 dark:text-neutral-300">
              <Info className="h-3.5 w-3.5 shrink-0" />
              <span>磨豆机系统使用指南</span>
              <ChevronDown className="ml-auto h-3.5 w-3.5 shrink-0 transition-transform group-open:rotate-180" />
            </summary>
            <div className="space-y-2.5 px-4 pt-1 pb-3 text-xs leading-relaxed text-neutral-500 dark:text-neutral-400">
              <p>
                新增磨豆机后，点击任意研磨度输入框都会弹出选择器，点击即可填入当前刻度。
              </p>
              <p>
                选中的磨豆机会用胶囊显示，左侧图标（
                <Link2 className="mx-0.5 inline h-3 w-3 -translate-y-px" />
                /
                <Unlink className="mx-0.5 inline h-3 w-3 -translate-y-px" />
                ）表示同步开关，开启时保存记录会自动更新刻度。
              </p>
              <p>你也可以在这里直接修改刻度，系统会记住最新值。</p>
              <div className="h-px bg-neutral-200 dark:bg-neutral-700" />
              <p>
                目前功能处于 MVP
                实现阶段，若有任何体验不足的地方或建议反馈，欢迎来
                <a
                  href="https://help.chu3.top/docs/contact"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline underline-offset-2"
                >
                  群里交流
                </a>
                ～
              </p>
            </div>
          </details>
        )}

        {/* 默认同步设置（仅在有磨豆机时显示） */}
        {grinders.length > 0 && (
          <details className="group rounded bg-neutral-100 dark:bg-neutral-800">
            <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-medium text-neutral-600 dark:text-neutral-300">
              <Link2 className="h-3.5 w-3.5 shrink-0" />
              <span>默认同步设置</span>
              <ChevronDown className="ml-auto h-3.5 w-3.5 shrink-0 transition-transform group-open:rotate-180" />
            </summary>
            <div className="space-y-3 px-4 pt-1 pb-4">
              <p className="text-xs leading-relaxed text-neutral-500 dark:text-neutral-400">
                设置各场景下同步开关的默认状态
              </p>
              {/* 导航栏参数栏 */}
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-neutral-600 dark:text-neutral-400">
                  导航栏参数栏
                </span>
                <label className="relative inline-flex cursor-pointer items-center">
                  <input
                    type="checkbox"
                    checked={settings.grinderDefaultSync?.navigationBar ?? true}
                    onChange={() => {
                      const current = settings.grinderDefaultSync || {
                        navigationBar: true,
                        methodForm: false,
                        manualNote: true,
                        noteEdit: false,
                      };
                      handleChange('grinderDefaultSync', {
                        ...current,
                        navigationBar: !current.navigationBar,
                      });
                      settings.hapticFeedback && hapticsUtils.light();
                    }}
                    className="peer sr-only"
                  />
                  <div className="peer h-6 w-11 rounded-full bg-neutral-200 peer-checked:bg-neutral-600 after:absolute after:top-0.5 after:left-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:after:translate-x-full dark:bg-neutral-700 dark:peer-checked:bg-neutral-500"></div>
                </label>
              </div>
              {/* 方案表单 */}
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-neutral-600 dark:text-neutral-400">
                  方案表单
                </span>
                <label className="relative inline-flex cursor-pointer items-center">
                  <input
                    type="checkbox"
                    checked={settings.grinderDefaultSync?.methodForm ?? false}
                    onChange={() => {
                      const current = settings.grinderDefaultSync || {
                        navigationBar: true,
                        methodForm: false,
                        manualNote: true,
                        noteEdit: false,
                      };
                      handleChange('grinderDefaultSync', {
                        ...current,
                        methodForm: !current.methodForm,
                      });
                      settings.hapticFeedback && hapticsUtils.light();
                    }}
                    className="peer sr-only"
                  />
                  <div className="peer h-6 w-11 rounded-full bg-neutral-200 peer-checked:bg-neutral-600 after:absolute after:top-0.5 after:left-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:after:translate-x-full dark:bg-neutral-700 dark:peer-checked:bg-neutral-500"></div>
                </label>
              </div>
              {/* 手动添加笔记 */}
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-neutral-600 dark:text-neutral-400">
                  手动添加笔记
                </span>
                <label className="relative inline-flex cursor-pointer items-center">
                  <input
                    type="checkbox"
                    checked={settings.grinderDefaultSync?.manualNote ?? true}
                    onChange={() => {
                      const current = settings.grinderDefaultSync || {
                        navigationBar: true,
                        methodForm: false,
                        manualNote: true,
                        noteEdit: false,
                      };
                      handleChange('grinderDefaultSync', {
                        ...current,
                        manualNote: !current.manualNote,
                      });
                      settings.hapticFeedback && hapticsUtils.light();
                    }}
                    className="peer sr-only"
                  />
                  <div className="peer h-6 w-11 rounded-full bg-neutral-200 peer-checked:bg-neutral-600 after:absolute after:top-0.5 after:left-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:after:translate-x-full dark:bg-neutral-700 dark:peer-checked:bg-neutral-500"></div>
                </label>
              </div>
              {/* 笔记编辑表单 */}
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-neutral-600 dark:text-neutral-400">
                  笔记编辑表单
                </span>
                <label className="relative inline-flex cursor-pointer items-center">
                  <input
                    type="checkbox"
                    checked={settings.grinderDefaultSync?.noteEdit ?? false}
                    onChange={() => {
                      const current = settings.grinderDefaultSync || {
                        navigationBar: true,
                        methodForm: false,
                        manualNote: true,
                        noteEdit: false,
                      };
                      handleChange('grinderDefaultSync', {
                        ...current,
                        noteEdit: !current.noteEdit,
                      });
                      settings.hapticFeedback && hapticsUtils.light();
                    }}
                    className="peer sr-only"
                  />
                  <div className="peer h-6 w-11 rounded-full bg-neutral-200 peer-checked:bg-neutral-600 after:absolute after:top-0.5 after:left-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:after:translate-x-full dark:bg-neutral-700 dark:peer-checked:bg-neutral-500"></div>
                </label>
              </div>
            </div>
          </details>
        )}

        {/* 刻度指示器显示设置（仅在有磨豆机时显示） */}
        {grinders.length > 0 && (
          <div className="flex items-center justify-between rounded bg-neutral-100 px-4 py-3 dark:bg-neutral-800">
            <div className="flex flex-col gap-1">
              <span className="text-sm font-medium text-neutral-600 dark:text-neutral-300">
                显示刻度指示器
              </span>
              <span className="text-xs text-neutral-500 dark:text-neutral-400">
                在冲煮页面显示当前磨豆机刻度，点击可编辑，长按切换磨豆机
              </span>
            </div>
            <label className="relative inline-flex cursor-pointer items-center">
              <input
                type="checkbox"
                checked={settings.showGrinderScale ?? true}
                onChange={() => {
                  handleChange(
                    'showGrinderScale',
                    !(settings.showGrinderScale ?? true)
                  );
                  settings.hapticFeedback && hapticsUtils.light();
                }}
                className="peer sr-only"
              />
              <div className="peer h-6 w-11 rounded-full bg-neutral-200 peer-checked:bg-neutral-600 after:absolute after:top-0.5 after:left-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:after:translate-x-full dark:bg-neutral-700 dark:peer-checked:bg-neutral-500"></div>
            </label>
          </div>
        )}

        {/* 分割线（仅在有磨豆机时显示） */}
        {grinders.length > 0 && (
          <div className="my-6 h-px bg-neutral-100 dark:bg-neutral-800" />
        )}

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
    </SettingPage>
  );
};

export default GrinderSettings;
