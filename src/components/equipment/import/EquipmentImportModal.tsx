'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { type CustomEquipment, type Method } from '@/lib/core/config';
import { Capacitor } from '@capacitor/core';
import { FilePicker } from '@capawesome/capacitor-file-picker';
import { showToast } from '../../common/feedback/LightToast';

interface EquipmentImportModalProps {
  showForm: boolean;
  onImport: (equipment: CustomEquipment, methods?: Method[]) => void;
  onClose: () => void;
  existingEquipments?: CustomEquipment[];
}

const EquipmentImportModal: React.FC<EquipmentImportModalProps> = ({
  showForm,
  onImport,
  onClose,
  existingEquipments = [],
}) => {
  // 导入数据的状态
  const [importData, setImportData] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const dropZoneRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isNative = Capacitor.isNativePlatform();

  // 关闭并清除输入
  const handleClose = useCallback(() => {
    // 如果历史栈中有我们添加的条目，触发返回
    if (window.history.state?.modal === 'equipment-import') {
      window.history.back();
    } else {
      // 否则直接关闭
      setImportData('');
      setError(null);
      onClose();
    }
  }, [onClose, setImportData, setError]);

  // 历史栈管理 - 支持硬件返回键和浏览器返回按钮
  useEffect(() => {
    if (!showForm) {
      // 模态框关闭时，确保清理历史栈中的模态框状态
      if (window.history.state?.modal === 'equipment-import') {
        window.history.replaceState(null, '');
      }
      return;
    }

    // 添加模态框历史记录
    window.history.pushState({ modal: 'equipment-import' }, '');

    const handlePopState = () => {
      window.__modalHandlingBack = true;
      onClose();
      setTimeout(() => {
        window.__modalHandlingBack = false;
      }, 50);
    };
    window.addEventListener('popstate', handlePopState);

    return () => window.removeEventListener('popstate', handlePopState);
  }, [showForm, onClose]);

  // 处理导入数据
  const processImportData = useCallback(
    (jsonText: string) => {
      try {
        setIsImporting(true);
        // 尝试从文本中提取数据
        import('@/lib/utils/jsonUtils').then(
          async ({ extractJsonFromText }) => {
            setError(null);
            try {
              // 解析导入数据
              const data = extractJsonFromText(jsonText);

              // 检查数据是否有效
              if (!data) {
                setError('无效的导入数据格式');
                setIsImporting(false);
                return;
              }

              // 检查是否是有效的器具导出文件
              const exportData = data as {
                equipment?: CustomEquipment;
                methods?: Method[];
              };
              if (!exportData.equipment) {
                setError('无效的器具导出文件格式，缺少equipment字段');
                setIsImporting(false);
                return;
              }

              const equipment = exportData.equipment;

              // 检查是否已存在同名器具
              const existingEquipment = existingEquipments.find(
                e => e.name === equipment.name
              );
              if (existingEquipment) {
                setError(`已存在同名器具"${equipment.name}"，请修改后再导入`);
                setIsImporting(false);
                return;
              }

              // 确保equipment对象完全符合CustomEquipment接口
              const validEquipment: CustomEquipment = {
                // 优先使用原始ID，如果没有则生成新ID
                id:
                  equipment.id ||
                  `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
                name: equipment.name,
                isCustom: true,
                animationType: equipment.animationType,
                hasValve: equipment.hasValve || false,
                customShapeSvg: equipment.customShapeSvg,
                customValveSvg: equipment.customValveSvg,
                customValveOpenSvg: equipment.customValveOpenSvg,
                customPourAnimations: equipment.customPourAnimations || [],
              };

              // 提取方案（如果有）
              const methods =
                exportData.methods && Array.isArray(exportData.methods)
                  ? exportData.methods.map(method => ({
                      ...method,
                      // 确保每个方案有ID，优先使用原有ID
                      id:
                        method.id ||
                        `method-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
                    }))
                  : undefined;

              // 导入器具和方案
              onImport(validEquipment, methods);

              // 显示成功消息
              showToast({
                type: 'success',
                title: '器具导入成功',
                duration: 2000,
              });

              // 关闭模态框
              handleClose();
            } catch (error) {
              setError((error as Error).message || '处理导入数据失败');
              setIsImporting(false);
            }
          }
        );
      } catch (error) {
        setError((error as Error).message || '导入失败');
        setIsImporting(false);
      }
    },
    [existingEquipments, onImport, handleClose, setError, setIsImporting]
  );

  // 处理文件
  const handleFile = useCallback(
    (file: File) => {
      if (!file.name.endsWith('.json') && file.type !== 'application/json') {
        setError('请选择JSON文件');
        return;
      }

      const reader = new FileReader();
      reader.onload = event => {
        const text = event.target?.result as string;
        processImportData(text);
      };
      reader.onerror = () => {
        setError('读取文件失败，请重试');
        setIsImporting(false);
      };
      reader.readAsText(file);
    },
    [processImportData, setError, setIsImporting]
  );

  // 监听showForm变化，当表单关闭时清除输入框内容
  useEffect(() => {
    if (!showForm) {
      setImportData('');
      setError(null);
      setIsImporting(false);
      setIsDragging(false);
    }
  }, [showForm]);

  // 设置拖放事件监听器
  useEffect(() => {
    const dropZone = dropZoneRef.current;
    if (!dropZone || isNative) return;

    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(true);
    };

    const handleDragEnter = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(true);
    };

    const handleDragLeave = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
    };

    const handleDrop = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
        const file = e.dataTransfer.files[0];
        handleFile(file);
      } else if (e.dataTransfer?.items && e.dataTransfer.items.length > 0) {
        // 尝试获取文本内容
        for (let i = 0; i < e.dataTransfer.items.length; i++) {
          if (e.dataTransfer.items[i].kind === 'string') {
            e.dataTransfer.items[i].getAsString(text => {
              setImportData(text);
            });
            break;
          }
        }
      }
    };

    dropZone.addEventListener('dragover', handleDragOver);
    dropZone.addEventListener('dragenter', handleDragEnter);
    dropZone.addEventListener('dragleave', handleDragLeave);
    dropZone.addEventListener('drop', handleDrop);

    return () => {
      dropZone.removeEventListener('dragover', handleDragOver);
      dropZone.removeEventListener('dragenter', handleDragEnter);
      dropZone.removeEventListener('dragleave', handleDragLeave);
      dropZone.removeEventListener('drop', handleDrop);
    };
  }, [isNative, showForm, handleFile]);

  // 处理文件选择按钮点击
  const handleFileButtonClick = () => {
    if (isNative) {
      handleNativeFilePicker();
    } else if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  // 处理原生平台的文件选择
  const handleNativeFilePicker = async () => {
    try {
      setIsImporting(true);
      setError(null);

      // 使用FilePicker插件选择文件
      const result = await FilePicker.pickFiles({
        types: ['application/json'],
      });

      if (result.files.length > 0) {
        const file = result.files[0];
        // 读取文件内容
        if (file.path) {
          const response = await fetch(file.path);
          const text = await response.text();
          processImportData(text);
        } else {
          setError('无法读取文件');
          setIsImporting(false);
        }
      } else {
        setIsImporting(false);
      }
    } catch (_error) {
      setError('选择文件失败，请重试');
      setIsImporting(false);
    }
  };

  // 处理文件输入变化（Web平台）
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      setIsImporting(false);
      return;
    }
    handleFile(file);
  };

  return (
    <AnimatePresence>
      {showForm && (
        <motion.div
          data-modal="equipment-import"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.265 }}
          className="fixed inset-0 z-50 bg-black/50"
        >
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{
              type: 'tween',
              ease: [0.33, 1, 0.68, 1], // cubic-bezier(0.33, 1, 0.68, 1) - easeOutCubic
              duration: 0.265,
            }}
            style={{
              willChange: 'transform',
            }}
            className={`absolute inset-x-0 bottom-0 mx-auto max-h-[90vh] max-w-[500px] overflow-hidden rounded-t-2xl bg-neutral-50 shadow-xl dark:bg-neutral-900`}
          >
            {/* 拖动条 */}
            <div className="sticky top-0 z-10 flex justify-center bg-neutral-50 py-2 dark:bg-neutral-900">
              <div className="h-1.5 w-12 rounded-full bg-neutral-200 dark:bg-neutral-700" />
            </div>

            {/* 表单内容 */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                type: 'tween',
                ease: 'easeOut',
                duration: 0.265,
                delay: 0.05,
              }}
              style={{
                willChange: 'opacity, transform',
              }}
              className="pb-safe-bottom max-h-[calc(90vh-40px)] overflow-auto px-6"
            >
              {/* 标题栏 */}
              <div className="mb-4 flex items-center justify-between py-4">
                <button
                  type="button"
                  onClick={handleClose}
                  className="rounded-full p-1.5 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M19 12H5M5 12L12 19M5 12L12 5"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
                <h3 className="text-base font-medium text-neutral-900 dark:text-neutral-100">
                  导入器具
                </h3>
                <div className="w-8"></div>
              </div>

              {/* 拖放区域 */}
              <div
                ref={dropZoneRef}
                className={`relative mb-4 rounded-lg border-2 border-dashed p-6 transition-colors ${
                  isDragging
                    ? 'border-neutral-800 bg-neutral-100/60 dark:border-neutral-200 dark:bg-neutral-800/30'
                    : 'border-neutral-300 hover:border-neutral-400 dark:border-neutral-700 dark:hover:border-neutral-600'
                }`}
              >
                <div className="text-center">
                  <p className="mb-2 text-sm font-medium text-neutral-600 dark:text-neutral-400">
                    拖放JSON文件到此处，或
                  </p>
                  <button
                    onClick={handleFileButtonClick}
                    className="inline-flex items-center justify-center rounded-lg bg-neutral-100/60 px-4 py-2 text-sm font-medium text-neutral-800 transition-opacity hover:opacity-80 dark:bg-neutral-800/30 dark:text-neutral-200"
                  >
                    <svg
                      className="mr-2 h-4 w-4"
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M12 4v16m0-16l-4 4m4-4l4 4"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    选择文件
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".json,application/json"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </div>
              </div>

              {/* 分隔线 */}
              <div className="mb-4 flex items-center">
                <div className="h-px grow bg-neutral-200 dark:bg-neutral-700"></div>
                <span className="px-3 text-xs text-neutral-500 dark:text-neutral-400">
                  或粘贴JSON数据
                </span>
                <div className="h-px grow bg-neutral-200 dark:bg-neutral-700"></div>
              </div>

              {/* 文本输入区域 */}
              <div className="space-y-4">
                <textarea
                  className="h-40 w-full rounded-lg border border-neutral-200 bg-neutral-100/60 p-3 text-sm text-neutral-800 placeholder-neutral-500 transition-colors focus:border-neutral-800 focus:outline-hidden dark:border-neutral-700 dark:bg-neutral-800/30 dark:text-neutral-200 dark:placeholder-neutral-400 dark:focus:border-neutral-200"
                  placeholder='粘贴器具数据，支持JSON格式，如{"name":"自定义V60","animationType":"v60",...}'
                  value={importData}
                  onChange={e => setImportData(e.target.value)}
                />

                {/* 错误提示 */}
                {error && (
                  <div className="rounded-lg bg-red-100/60 p-3 text-sm text-red-600 dark:bg-red-900/30 dark:text-red-400">
                    {error}
                  </div>
                )}

                {/* 导入按钮 */}
                <button
                  onClick={() => processImportData(importData)}
                  disabled={!importData.trim() || isImporting}
                  className={`w-full rounded-lg px-4 py-2.5 transition-colors ${
                    !importData.trim() || isImporting
                      ? 'cursor-not-allowed bg-neutral-400 dark:bg-neutral-700'
                      : 'bg-neutral-800 text-neutral-100 hover:opacity-80 dark:bg-neutral-200 dark:text-neutral-800'
                  }`}
                >
                  {isImporting ? '导入中...' : '导入'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default EquipmentImportModal;
