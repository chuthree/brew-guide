'use client';

import React, { useState, useEffect } from 'react';
import { CoffeeBean } from '@/types/app';
import { X, Save, RotateCcw, Edit, Check, Plus, Minus } from 'lucide-react';
import { parseDateToTimestamp } from '@/lib/utils/dateUtils';
import { DatePicker } from '@/components/common/ui/DatePicker';
import { TempFileManager } from '@/lib/utils/tempFileManager';
import {
  PrintConfig,
  getPrintConfigPreference,
  getShowCustomSizePreference,
  saveShowCustomSizePreference,
  resetConfigToDefault,
  toggleConfigField,
  updateConfigSize,
  toggleConfigOrientation,
  updateConfigMargin,
  updateConfigFontSize,
  updateConfigFontWeight,
  updateConfigTemplate,
  updateConfigBrandName,
  setPresetSize,
} from './printConfig';
import { useModalHistory, modalHistory } from '@/lib/hooks/useModalHistory';

interface BeanPrintModalProps {
  isOpen: boolean;
  bean: CoffeeBean | null;
  onClose: () => void;
}

interface EditableContent {
  name: string;
  origin: string;
  roastLevel: string;
  roastDate: string;
  process: string;
  variety: string;
  flavor: string[];
  notes: string;
  weight: string; // 克数
}

const BeanPrintModal: React.FC<BeanPrintModalProps> = ({
  isOpen,
  bean,
  onClose,
}) => {
  const [config, setConfig] = useState<PrintConfig>(() => {
    const initialConfig = getPrintConfigPreference();
    return initialConfig;
  });

  // 统一样式常量
  const INPUT_CLASS =
    'w-full rounded border border-neutral-200 bg-white px-2 py-1.5 text-xs transition-all focus:ring-2 focus:ring-neutral-400 focus:outline-none dark:border-neutral-700 dark:bg-neutral-800';
  const LABEL_CLASS =
    'mb-1 block text-xs text-neutral-500 dark:text-neutral-400';

  // 提取 bean 组件信息的通用函数
  const extractBeanComponentInfo = (
    bean: CoffeeBean | null,
    field: 'origin' | 'process' | 'variety'
  ): string => {
    if (!bean?.blendComponents || bean.blendComponents.length === 0) return '';
    const values = Array.from(
      new Set(
        bean.blendComponents
          .map(comp => comp[field])
          .filter(
            (value): value is string =>
              typeof value === 'string' && value.trim() !== ''
          )
      )
    );
    return values.join(', ');
  };

  // 从咖啡豆名称中提取品牌名（空格前的部分）
  const extractBrandName = (): string => {
    if (!editableContent.name) return config.brandName || '';

    // 如果已手动设置品牌名，优先使用
    if (config.brandName) return config.brandName;

    // 否则自动提取：取第一个空格前的内容
    const spaceIndex = editableContent.name.indexOf(' ');
    if (spaceIndex > 0) {
      return editableContent.name.substring(0, spaceIndex);
    }

    return '';
  };

  // 从咖啡豆名称中提取实际名称（空格后的部分，如果设置了品牌名则返回完整名称）
  const extractBeanName = (): string => {
    if (!editableContent.name) return '';

    // 如果已手动设置品牌名，返回完整名称（不分割）
    if (config.brandName) {
      return editableContent.name;
    }

    // 否则尝试分割：取空格后的内容
    const spaceIndex = editableContent.name.indexOf(' ');
    if (spaceIndex > 0) {
      return editableContent.name.substring(spaceIndex + 1);
    }

    // 如果没有空格，返回完整名称
    return editableContent.name;
  };

  // 生成简洁模板的风味行
  const getFlavorLine = (): string => {
    if (!editableContent.flavor || editableContent.flavor.length === 0)
      return '';
    const flavors = editableContent.flavor.filter(f => f.trim()).join(' / ');
    return flavors;
  };

  // 生成简洁模板的底部信息行（克数 / 烘焙日期 / 其他可选信息）
  const getBottomInfoLine = (): string => {
    const parts: string[] = [];

    // 克数（第一位）
    if (editableContent.weight) {
      parts.push(`${editableContent.weight}g`);
    }

    // 烘焙日期（第二位）
    if (editableContent.roastDate) {
      parts.push(formatDate(editableContent.roastDate));
    }

    // 以下为可选信息，只在有内容时显示
    if (editableContent.process) {
      parts.push(editableContent.process);
    }

    if (editableContent.variety) {
      parts.push(editableContent.variety);
    }

    if (editableContent.origin) {
      parts.push(editableContent.origin);
    }

    if (editableContent.roastLevel) {
      parts.push(editableContent.roastLevel);
    }

    if (editableContent.notes) {
      parts.push(editableContent.notes);
    }

    return parts.join(' / ');
  };

  // 同步自定义尺寸输入状态与config
  useEffect(() => {
    setCustomSizeInputs({
      width: config.width.toString(),
      height: config.height.toString(),
    });
  }, [config.width, config.height]);
  const [shouldRender, setShouldRender] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [showCustomSize, setShowCustomSize] = useState(() =>
    getShowCustomSizePreference()
  );
  const [isEditMode, setIsEditMode] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [customSizeInputs, setCustomSizeInputs] = useState({
    width: '',
    height: '',
  });
  const [editableContent, setEditableContent] = useState<EditableContent>({
    name: '',
    origin: '',
    roastLevel: '',
    roastDate: '',
    process: '',
    variety: '',
    flavor: [],
    notes: '',
    weight: '',
  });

  // 初始化编辑内容
  useEffect(() => {
    if (bean) {
      setEditableContent({
        name: bean.name || '',
        origin: extractBeanComponentInfo(bean, 'origin'),
        roastLevel: bean.roastLevel || '',
        roastDate: bean.roastDate || '',
        process: extractBeanComponentInfo(bean, 'process'),
        variety: extractBeanComponentInfo(bean, 'variety'),
        flavor: bean.flavor || [],
        notes: bean.notes || '',
        weight: '',
      });
    }
  }, [bean]);

  // 处理显示/隐藏动画
  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setIsVisible(true);
        });
      });
    } else {
      setIsVisible(false);
      const timer = setTimeout(() => setShouldRender(false), 350);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // 使用统一的历史栈管理系统
  useModalHistory({
    id: 'bean-print',
    isOpen,
    onClose,
  });

  // 关闭处理
  const handleClose = () => {
    // 重置编辑模式
    setIsEditMode(false);
    modalHistory.back();
  };

  // 格式化日期
  const formatDate = (dateStr: string): string => {
    try {
      const timestamp = parseDateToTimestamp(dateStr);
      const date = new Date(timestamp);
      return `${date.getFullYear()}-${(date.getMonth() + 1)
        .toString()
        .padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;
    } catch {
      return dateStr;
    }
  };

  // 保存图片（优先保存到相册，降级到分享）
  const handleSaveImage = async () => {
    try {
      const previewElement = document.getElementById('print-preview');
      if (!previewElement) {
        console.error('预览元素未找到');
        return;
      }

      // 动态导入 html-to-image
      const { toPng } = await import('html-to-image');

      // 生成图片数据URL
      const dataUrl = await toPng(previewElement, {
        backgroundColor: '#ffffff',
        pixelRatio: 3, // 提高分辨率
        quality: 0.95,
      });

      // 原生平台：优先保存到相册
      const { Capacitor } = await import('@capacitor/core');
      if (Capacitor.isNativePlatform()) {
        try {
          await TempFileManager.saveImageToGallery(dataUrl);
          const { showToast } = await import(
            '@/components/common/feedback/LightToast'
          );
          showToast({ type: 'success', title: '已保存到相册' });
          return;
        } catch (error) {
          console.error('保存到相册失败:', error);
          const { showToast } = await import(
            '@/components/common/feedback/LightToast'
          );
          showToast({
            type: 'error',
            title: `保存失败: ${error instanceof Error ? error.message : '未知错误'}`,
          });
          // 降级到分享方式
          const fileName = `${bean?.name || '咖啡豆标签'}-${
            new Date().toISOString().split('T')[0]
          }`;
          await TempFileManager.shareImageFile(dataUrl, fileName, {
            title: '咖啡豆标签',
            text: `${bean?.name || '咖啡豆'}标签图片`,
            dialogTitle: '保存标签图片',
          });
          return;
        }
      }

      // Web 平台：直接下载
      await TempFileManager.saveImageToGallery(dataUrl);
      const { showToast } = await import(
        '@/components/common/feedback/LightToast'
      );
      showToast({ type: 'success', title: '图片已保存' });
    } catch (error) {
      console.error('保存图片失败:', error);
      const { showToast } = await import(
        '@/components/common/feedback/LightToast'
      );
      showToast({ type: 'error', title: '保存图片失败，请重试' });
    }
  };

  // 更新字段显示状态
  const toggleField = (field: keyof PrintConfig['fields']) => {
    const newConfig = toggleConfigField(config, field);
    setConfig(newConfig);
  };

  // 重置配置
  const handleResetConfig = () => {
    setShowResetConfirm(true);
  };

  const confirmReset = () => {
    const newConfig = resetConfigToDefault();
    setConfig(newConfig);
    setShowResetConfirm(false);
  };

  const cancelReset = () => {
    setShowResetConfirm(false);
  };

  // 预设尺寸 - 常用标签尺寸
  const presetSizes = [
    { label: '50×80', width: 50, height: 80 },
    { label: '40×30', width: 40, height: 30 },
    { label: '40×60', width: 40, height: 60 },
  ];

  // 布局方向切换
  const toggleOrientation = () => {
    const newConfig = toggleConfigOrientation(config);
    setConfig(newConfig);
  };

  // 添加风味标签
  const addFlavorTag = () => {
    setEditableContent(prev => ({
      ...prev,
      flavor: [...prev.flavor, ''],
    }));
  };

  // 删除风味标签
  const removeFlavorTag = (index: number) => {
    setEditableContent(prev => ({
      ...prev,
      flavor: prev.flavor.filter((_, i) => i !== index),
    }));
  };

  // 切换编辑模式
  const toggleEditMode = () => {
    setIsEditMode(!isEditMode);
  };

  // 处理自定义尺寸显示状态变化
  const handleShowCustomSizeChange = (show: boolean) => {
    setShowCustomSize(show);
    saveShowCustomSizePreference(show);
  };

  // 重置编辑内容为原始数据
  const resetEditableContent = () => {
    if (bean) {
      setEditableContent({
        name: bean.name || '',
        origin: extractBeanComponentInfo(bean, 'origin'),
        roastLevel: bean.roastLevel || '',
        roastDate: bean.roastDate || '',
        process: extractBeanComponentInfo(bean, 'process'),
        variety: extractBeanComponentInfo(bean, 'variety'),
        flavor: bean.flavor || [],
        notes: bean.notes || '',
        weight: '',
      });
    }
  };

  // 渲染风味编辑器（复用逻辑）
  const renderFlavorEditor = () => (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <label className={LABEL_CLASS}>风味</label>
        <button
          onClick={addFlavorTag}
          className="flex h-5 w-5 items-center justify-center rounded bg-neutral-200 transition-colors hover:bg-neutral-300 dark:bg-neutral-700 dark:hover:bg-neutral-600"
        >
          <Plus className="h-3 w-3" />
        </button>
      </div>
      <div className="space-y-2">
        {editableContent.flavor.map((flavor, index) => (
          <div key={index} className="flex items-center gap-2">
            <input
              type="text"
              value={flavor}
              onChange={e => {
                const value = e.target.value;
                setEditableContent(prev => {
                  const newFlavor = [...prev.flavor];
                  newFlavor[index] = value;
                  return { ...prev, flavor: newFlavor };
                });
              }}
              className={INPUT_CLASS}
              placeholder="风味描述"
            />
            <button
              onClick={() => removeFlavorTag(index)}
              className="flex h-5 w-5 items-center justify-center rounded bg-red-100 transition-colors hover:bg-red-200 dark:bg-red-900/30 dark:hover:bg-red-900/50"
            >
              <Minus className="h-3 w-3 text-red-600 dark:text-red-400" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );

  // 渲染通用文本输入框
  const renderTextInput = (
    label: string,
    field: keyof EditableContent,
    placeholder: string
  ) => (
    <div>
      <label className={LABEL_CLASS}>{label}</label>
      <input
        type="text"
        value={editableContent[field] as string}
        onChange={e => {
          const value = e.target.value;
          setEditableContent(prev => ({ ...prev, [field]: value }));
        }}
        className={INPUT_CLASS}
        placeholder={placeholder}
      />
    </div>
  );

  // 渲染烘焙日期选择器
  const renderDatePicker = () => (
    <div>
      <label className={LABEL_CLASS}>烘焙日期</label>
      <div className="text-xs">
        <DatePicker
          date={
            editableContent.roastDate
              ? new Date(editableContent.roastDate)
              : undefined
          }
          onDateChange={date => {
            const formattedDate = date.toISOString().split('T')[0];
            setEditableContent(prev => ({
              ...prev,
              roastDate: formattedDate,
            }));
          }}
          placeholder="选择烘焙日期"
          locale="zh-CN"
          className=""
        />
      </div>
    </div>
  );

  if (!shouldRender || !bean) return null;

  return (
    <>
      <div
        className={`fixed inset-0 mx-auto flex max-w-[500px] flex-col overflow-hidden bg-neutral-50 transition-transform duration-[350ms] ease-[cubic-bezier(0.36,0.66,0.04,1)] dark:bg-neutral-900 ${isVisible ? 'translate-x-0' : 'translate-x-full'} `}
      >
        {/* 顶部按钮栏 */}
        <div className="pt-safe-top sticky top-0 flex items-center justify-between bg-neutral-50 px-4 py-3 dark:bg-neutral-900">
          <button
            onClick={handleClose}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-neutral-100 transition-colors hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700"
          >
            <X className="h-4 w-4" />
          </button>

          <h2 className="pointer-events-none absolute left-1/2 -translate-x-1/2 transform text-sm text-neutral-600 dark:text-neutral-400">
            打印标签
          </h2>

          <button
            onClick={handleSaveImage}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-neutral-800 transition-colors hover:bg-neutral-700 dark:bg-neutral-700 dark:hover:bg-neutral-600"
            title="保存图片"
          >
            <Save className="h-4 w-4 text-white" />
          </button>
        </div>

        {/* 内容区域 */}
        <div className="pb-safe-bottom flex-1 overflow-y-auto">
          <div className="space-y-4 p-4">
            {/* 尺寸设置 */}
            <div className="space-y-3">
              <div className="text-xs font-medium text-neutral-600 dark:text-neutral-300">
                尺寸设置
              </div>

              <div className="grid grid-cols-4 gap-2">
                {/* 预设尺寸按钮 */}
                {presetSizes.map(size => (
                  <button
                    key={size.label}
                    onClick={() => {
                      const newConfig = setPresetSize(
                        config,
                        size.width,
                        size.height
                      );
                      setConfig(newConfig);
                    }}
                    className={`rounded px-3 py-2 text-xs font-medium transition-all ${
                      config.width === size.width &&
                      config.height === size.height
                        ? 'bg-neutral-800 text-white dark:bg-neutral-700'
                        : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700'
                    }`}
                  >
                    {size.label}
                  </button>
                ))}

                {/* 自定义按钮 */}
                <button
                  onClick={() => handleShowCustomSizeChange(!showCustomSize)}
                  className={`rounded px-3 py-2 text-xs font-medium transition-all ${
                    showCustomSize
                      ? 'bg-neutral-800 text-white dark:bg-neutral-700'
                      : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700'
                  }`}
                >
                  自定义
                </button>
              </div>

              {/* 自定义尺寸输入框 - 仅在点击自定义后显示 */}
              {showCustomSize && (
                <div className="flex items-center gap-2 rounded bg-neutral-50 p-3 dark:bg-neutral-800/50">
                  <input
                    type="number"
                    value={customSizeInputs.width}
                    onChange={e => {
                      const value = e.target.value;
                      // 更新本地输入状态，允许空值
                      setCustomSizeInputs(prev => ({ ...prev, width: value }));

                      // 如果是有效数字，即时更新config用于预览
                      if (value !== '') {
                        const numValue = parseInt(value);
                        if (
                          !isNaN(numValue) &&
                          numValue >= 40 &&
                          numValue <= 200
                        ) {
                          setConfig(prev => ({ ...prev, width: numValue }));
                        }
                      }
                    }}
                    onBlur={e => {
                      // 失去焦点时验证并保存
                      const value = e.target.value;
                      let finalValue = 80; // 默认值

                      if (value !== '') {
                        const numValue = parseInt(value);
                        if (!isNaN(numValue)) {
                          finalValue = Math.max(40, Math.min(200, numValue)); // 限制在范围内
                        }
                      }

                      const newConfig = updateConfigSize(
                        config,
                        'width',
                        finalValue
                      );
                      setConfig(newConfig);
                      setCustomSizeInputs(prev => ({
                        ...prev,
                        width: finalValue.toString(),
                      }));
                    }}
                    className="flex-1 rounded border border-neutral-200 bg-white px-3 py-2 text-xs transition-all focus:ring-2 focus:ring-neutral-400 focus:outline-none dark:border-neutral-700 dark:bg-neutral-800"
                    placeholder="宽度"
                    min="40"
                    max="200"
                  />
                  <span className="text-xs text-neutral-400">×</span>
                  <input
                    type="number"
                    value={customSizeInputs.height}
                    onChange={e => {
                      const value = e.target.value;
                      // 更新本地输入状态，允许空值
                      setCustomSizeInputs(prev => ({ ...prev, height: value }));

                      // 如果是有效数字，即时更新config用于预览
                      if (value !== '') {
                        const numValue = parseInt(value);
                        if (
                          !isNaN(numValue) &&
                          numValue >= 30 &&
                          numValue <= 150
                        ) {
                          setConfig(prev => ({ ...prev, height: numValue }));
                        }
                      }
                    }}
                    onBlur={e => {
                      // 失去焦点时验证并保存
                      const value = e.target.value;
                      let finalValue = 50; // 默认值

                      if (value !== '') {
                        const numValue = parseInt(value);
                        if (!isNaN(numValue)) {
                          finalValue = Math.max(30, Math.min(150, numValue)); // 限制在范围内
                        }
                      }

                      const newConfig = updateConfigSize(
                        config,
                        'height',
                        finalValue
                      );
                      setConfig(newConfig);
                      setCustomSizeInputs(prev => ({
                        ...prev,
                        height: finalValue.toString(),
                      }));
                    }}
                    className="flex-1 rounded border border-neutral-200 bg-white px-3 py-2 text-xs transition-all focus:ring-2 focus:ring-neutral-400 focus:outline-none dark:border-neutral-700 dark:bg-neutral-800"
                    placeholder="高度"
                    min="30"
                    max="150"
                  />
                  <span className="text-xs text-neutral-500 dark:text-neutral-400">
                    mm
                  </span>
                </div>
              )}
            </div>

            {/* 布局与字体设置 */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="text-xs font-medium text-neutral-600 dark:text-neutral-300">
                  布局设置
                </div>
                <button
                  onClick={handleResetConfig}
                  className="flex items-center gap-1 px-2 py-1 text-xs text-neutral-500 transition-colors hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-300"
                >
                  <RotateCcw className="h-3 w-3" />
                  重置配置
                </button>
              </div>

              {/* 方向选择 */}
              <div>
                <div className="mb-2 text-xs text-neutral-500 dark:text-neutral-400">
                  方向
                </div>
                <button
                  onClick={toggleOrientation}
                  className="w-full rounded bg-neutral-100 px-3 py-2 text-xs font-medium transition-all hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700"
                >
                  {config.orientation === 'landscape' ? '横向 ↔' : '纵向 ↕'}
                </button>
              </div>

              {/* 模板选择 */}
              <div>
                <div className="mb-2 text-xs text-neutral-500 dark:text-neutral-400">
                  模板
                </div>
                <select
                  value={config.template}
                  onChange={e => {
                    const newConfig = updateConfigTemplate(
                      config,
                      e.target.value as PrintConfig['template']
                    );
                    setConfig(newConfig);
                  }}
                  className="w-full cursor-pointer rounded bg-neutral-100 px-3 py-2 text-xs font-medium transition-all hover:bg-neutral-200 focus:ring-2 focus:ring-neutral-400 focus:outline-none dark:bg-neutral-800 dark:hover:bg-neutral-700"
                >
                  <option value="detailed">详细模板</option>
                  <option value="minimal">简洁模板</option>
                </select>
              </div>

              {/* 滑块设置 */}
              <div className="grid grid-cols-3 gap-3">
                {/* 边距 */}
                <div>
                  <div className="mb-2 text-xs text-neutral-500 dark:text-neutral-400">
                    边距 {config.margin}mm
                  </div>
                  <div className="px-1">
                    <input
                      type="range"
                      min="1"
                      max="8"
                      value={config.margin}
                      onChange={e => {
                        const newConfig = updateConfigMargin(
                          config,
                          parseInt(e.target.value)
                        );
                        setConfig(newConfig);
                      }}
                      className="slider h-2 w-full cursor-pointer appearance-none rounded-full bg-neutral-200 dark:bg-neutral-700"
                    />
                  </div>
                </div>

                {/* 字体大小 */}
                <div>
                  <div className="mb-2 text-xs text-neutral-500 dark:text-neutral-400">
                    字体 {config.fontSize}px
                  </div>
                  <div className="px-1">
                    <input
                      type="range"
                      min="6"
                      max="24"
                      value={config.fontSize}
                      onChange={e => {
                        const size = parseInt(e.target.value);
                        const newConfig = updateConfigFontSize(config, size);
                        setConfig(newConfig);
                      }}
                      className="slider h-2 w-full cursor-pointer appearance-none rounded-full bg-neutral-200 dark:bg-neutral-700"
                    />
                  </div>
                </div>

                {/* 字体粗细 */}
                <div>
                  <div className="mb-2 text-xs text-neutral-500 dark:text-neutral-400">
                    粗细 {config.fontWeight}
                  </div>
                  <div className="px-1">
                    <input
                      type="range"
                      min="300"
                      max="900"
                      step="100"
                      value={config.fontWeight}
                      onChange={e => {
                        const weight = parseInt(e.target.value);
                        const newConfig = updateConfigFontWeight(
                          config,
                          weight
                        );
                        setConfig(newConfig);
                      }}
                      className="slider h-2 w-full cursor-pointer appearance-none rounded-full bg-neutral-200 dark:bg-neutral-700"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* 显示内容 */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-xs font-medium text-neutral-600 dark:text-neutral-300">
                  {config.template === 'minimal' ? '编辑内容' : '显示内容'}
                </div>
                <button
                  onClick={toggleEditMode}
                  className={`flex items-center gap-1 rounded px-2 py-1 text-xs font-medium transition-all ${
                    isEditMode
                      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                      : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-400 dark:hover:bg-neutral-700'
                  }`}
                >
                  {isEditMode ? (
                    <>
                      <Check className="h-3 w-3" />
                      完成
                    </>
                  ) : (
                    <>
                      <Edit className="h-3 w-3" />
                      编辑
                    </>
                  )}
                </button>
              </div>

              {/* 现代化按钮式选择器 - 仅详细模板显示 */}
              {config.template === 'detailed' && (
                <div className="grid grid-cols-4 gap-1.5">
                  {Object.entries(config.fields).map(([field, enabled]) => {
                    const fieldLabels = {
                      name: '名称',
                      origin: '产地',
                      roastLevel: '烘焙',
                      roastDate: '日期',
                      flavor: '风味',
                      process: '处理法',
                      variety: '品种',
                      notes: '备注',
                    };

                    return (
                      <button
                        key={field}
                        onClick={() =>
                          toggleField(field as keyof PrintConfig['fields'])
                        }
                        className={`rounded px-2.5 py-2 text-center text-xs font-medium transition-all ${
                          enabled
                            ? 'bg-neutral-800 text-white dark:bg-neutral-700'
                            : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-400 dark:hover:bg-neutral-700'
                        }`}
                      >
                        {fieldLabels[field as keyof typeof fieldLabels]}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* 编辑区域 - 仅在编辑模式下显示 */}
              {isEditMode && (
                <div className="mt-4 space-y-3 rounded bg-neutral-50 p-3 dark:bg-neutral-800/50">
                  <div className="mb-3 flex items-center justify-between">
                    <div className="text-xs font-medium text-neutral-600 dark:text-neutral-300">
                      编辑内容
                    </div>
                    <button
                      onClick={resetEditableContent}
                      className="px-2 py-1 text-xs text-neutral-500 transition-colors hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-300"
                    >
                      重置
                    </button>
                  </div>

                  {config.template === 'minimal' ? (
                    // 简洁模板编辑区 - 按新布局排列字段
                    <>
                      {/* 品牌名称编辑 */}
                      <div>
                        <label className={LABEL_CLASS}>
                          品牌名称（可选，留空则自动从名称中提取）
                        </label>
                        <input
                          type="text"
                          value={config.brandName}
                          onChange={e => {
                            const newConfig = updateConfigBrandName(
                              config,
                              e.target.value
                            );
                            setConfig(newConfig);
                          }}
                          className={INPUT_CLASS}
                          placeholder={`自动提取: ${extractBrandName() || '名称空格前的部分'}`}
                        />
                      </div>

                      {renderTextInput('名称', 'name', '例如：辛鹿 野草莓')}
                      {renderFlavorEditor()}

                      {/* 分隔线 */}
                      <div className="my-2 border-t border-neutral-200 dark:border-neutral-700"></div>

                      {renderTextInput('克数', 'weight', '例如：250')}
                      {renderDatePicker()}
                      {renderTextInput(
                        '处理法（可选）',
                        'process',
                        '例如：水洗、日晒'
                      )}
                      {renderTextInput(
                        '品种（可选）',
                        'variety',
                        '例如：卡杜拉、瑰夏'
                      )}
                      {renderTextInput('产地（可选）', 'origin', '产地信息')}
                      {renderTextInput(
                        '烘焙度（可选）',
                        'roastLevel',
                        '烘焙度'
                      )}

                      {/* 备注编辑 */}
                      <div>
                        <label className={LABEL_CLASS}>备注（可选）</label>
                        <textarea
                          value={editableContent.notes}
                          onChange={e => {
                            const value = e.target.value;
                            setEditableContent(prev => ({
                              ...prev,
                              notes: value,
                            }));
                          }}
                          className={INPUT_CLASS + ' resize-none'}
                          placeholder="其他备注信息"
                          rows={2}
                        />
                      </div>
                    </>
                  ) : (
                    // 详细模板编辑区 - 显示所有字段
                    <>
                      {config.fields.name &&
                        renderTextInput('名称', 'name', '咖啡豆名称')}
                      {config.fields.origin &&
                        renderTextInput('产地', 'origin', '产地信息')}
                      {config.fields.roastLevel &&
                        renderTextInput('烘焙度', 'roastLevel', '烘焙度')}
                      {config.fields.roastDate && renderDatePicker()}
                      {config.fields.process &&
                        renderTextInput('处理法', 'process', '处理法')}
                      {config.fields.variety &&
                        renderTextInput('品种', 'variety', '咖啡品种')}
                      {config.fields.flavor && renderFlavorEditor()}

                      {/* 备注编辑 */}
                      {config.fields.notes && (
                        <div>
                          <label className={LABEL_CLASS}>备注</label>
                          <textarea
                            value={editableContent.notes}
                            onChange={e => {
                              const value = e.target.value;
                              setEditableContent(prev => ({
                                ...prev,
                                notes: value,
                              }));
                            }}
                            className={INPUT_CLASS + ' resize-none'}
                            placeholder="备注信息"
                            rows={2}
                          />
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>

            {/* 预览区域 */}
            <div className="border-t border-neutral-200 pt-4 dark:border-neutral-800">
              <div className="mb-3 text-xs text-neutral-500 dark:text-neutral-400">
                预览
              </div>
              <div className="flex justify-center rounded bg-neutral-100 p-4 dark:bg-neutral-800">
                <div
                  id="print-preview"
                  style={{
                    width:
                      config.orientation === 'landscape'
                        ? `${config.height}mm`
                        : `${config.width}mm`,
                    height:
                      config.orientation === 'landscape'
                        ? `${config.width}mm`
                        : `${config.height}mm`,
                    padding: `${config.margin}mm`,
                    fontSize: `${config.fontSize}px`,
                    backgroundColor: '#ffffff',
                    color: '#000000',
                    lineHeight: '1.4', // 增加行距提高可读性
                    fontFamily:
                      '"Noto Sans SC Print", "Noto Sans SC", "Microsoft YaHei", "SimHei", "PingFang SC", Arial, sans-serif', // 使用默认字体
                    fontWeight: config.fontWeight, // 使用用户设置的字体粗细
                    letterSpacing: '0.02em', // 稍微增加字符间距
                  }}
                  className="overflow-hidden"
                >
                  {config.template === 'minimal' ? (
                    // 简洁模板 - 优化布局
                    <div className="flex h-full flex-col justify-between">
                      {/* 上部分：主要信息 */}
                      <div
                        className="space-y-1"
                        style={{
                          fontSize: `${config.fontSize}px`,
                          fontWeight: config.fontWeight,
                        }}
                      >
                        {/* 第一行：品牌名（可选，居中） */}
                        {extractBrandName() && (
                          <div
                            style={{
                              fontSize: `${config.fontSize}px`,
                              fontWeight: config.fontWeight,
                              letterSpacing: '0.05em',
                              textAlign: 'center',
                              marginBottom: `${config.fontSize * 0.3}px`,
                            }}
                          >
                            [ {extractBrandName()} ]
                          </div>
                        )}

                        {/* 第二行：名称 */}
                        {extractBeanName() && (
                          <div
                            style={{
                              fontSize: `${config.fontSize}px`,
                              fontWeight: config.fontWeight,
                              lineHeight: '1.4',
                              marginBottom: `${config.fontSize * 0.2}px`,
                            }}
                          >
                            {extractBeanName()}
                          </div>
                        )}

                        {/* 第三行：风味 */}
                        {getFlavorLine() && (
                          <div
                            style={{
                              fontSize: `${config.fontSize}px`,
                              fontWeight: config.fontWeight,
                              lineHeight: '1.4',
                            }}
                          >
                            {getFlavorLine()}
                          </div>
                        )}
                      </div>

                      {/* 下部分：补充信息（克数 / 烘焙日期 / 其他） */}
                      {getBottomInfoLine() && (
                        <div
                          style={{
                            fontSize: `${config.fontSize}px`,
                            fontWeight: config.fontWeight,
                            lineHeight: '1.4',
                          }}
                        >
                          {getBottomInfoLine()}
                        </div>
                      )}
                    </div>
                  ) : (
                    // 详细模板（原有布局）
                    <div className="flex h-full flex-col">
                      {/* 标题区域 */}
                      {config.fields.name && editableContent.name && (
                        <div
                          className="mb-1.5 flex-shrink-0 border-b-0 border-black pb-1 text-left"
                          style={{
                            fontSize: `${config.titleFontSize}px`,
                            fontWeight: config.fontWeight,
                            lineHeight: '1.2',
                            borderBottomWidth: '1.5px',
                            borderBottomStyle: 'solid',
                            borderBottomColor: '#000000',
                          }}
                        >
                          {editableContent.name}
                        </div>
                      )}

                      {/* 主要信息区域 - 自动流式布局 */}
                      <div
                        className="flex flex-1 flex-wrap content-start"
                        style={{
                          fontSize: `${config.fontSize}px`,
                          gap: `${Math.max(config.fontSize * 0.4, 4)}px`,
                          lineHeight: '1.3',
                        }}
                      >
                        {/* 按顺序渲染所有字段，自动换行 */}
                        {config.fields.origin && editableContent.origin && (
                          <div className="flex w-full gap-1">
                            <span className="shrink-0">产地:</span>
                            <span className="break-words">
                              {editableContent.origin}
                            </span>
                          </div>
                        )}
                        {config.fields.roastLevel &&
                          editableContent.roastLevel && (
                            <div className="flex w-full gap-1">
                              <span className="shrink-0">烘焙:</span>
                              <span>{editableContent.roastLevel}</span>
                            </div>
                          )}
                        {config.fields.roastDate &&
                          editableContent.roastDate && (
                            <div className="flex w-full gap-1">
                              <span className="shrink-0">日期:</span>
                              <span>
                                {formatDate(editableContent.roastDate)}
                              </span>
                            </div>
                          )}
                        {config.fields.process && editableContent.process && (
                          <div className="flex w-full gap-1">
                            <span className="shrink-0">处理:</span>
                            <span className="break-words">
                              {editableContent.process}
                            </span>
                          </div>
                        )}
                        {config.fields.variety && editableContent.variety && (
                          <div className="flex w-full gap-1">
                            <span className="shrink-0">品种:</span>
                            <span className="break-words">
                              {editableContent.variety}
                            </span>
                          </div>
                        )}
                        {config.fields.flavor &&
                          editableContent.flavor &&
                          editableContent.flavor.length > 0 &&
                          editableContent.flavor.filter(f => f.trim()).length >
                            0 && (
                            <div className="flex w-full gap-1">
                              <span className="shrink-0">风味:</span>
                              <span className="break-words">
                                {editableContent.flavor
                                  .filter(f => f.trim())
                                  .join(' / ')}
                              </span>
                            </div>
                          )}
                        {config.fields.notes && editableContent.notes && (
                          <div className="flex w-full gap-1">
                            <span className="shrink-0">备注:</span>
                            <span className="break-words">
                              {editableContent.notes}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 重置确认对话框 */}
        {showResetConfirm && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/20 p-4 backdrop-blur-sm">
            <div className="mx-4 w-full max-w-sm rounded-lg bg-white p-4 shadow-lg dark:bg-neutral-800">
              <div className="mb-2 text-sm font-medium text-neutral-800 dark:text-neutral-200">
                重置配置
              </div>
              <div className="mb-4 text-xs text-neutral-600 dark:text-neutral-400">
                这将重置所有打印设置到默认值，确定要继续吗？
              </div>
              <div className="flex justify-end gap-2">
                <button
                  onClick={cancelReset}
                  className="px-3 py-1.5 text-xs font-medium text-neutral-600 transition-colors hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200"
                >
                  取消
                </button>
                <button
                  onClick={confirmReset}
                  className="rounded bg-neutral-800 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-neutral-700 dark:bg-neutral-700 dark:hover:bg-neutral-600"
                >
                  确定重置
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default BeanPrintModal;

// CSS样式定义 - 极简圆形风格
const sliderStyles = `
.slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: #525252;
    cursor: pointer;
    border: none;
    transition: all 0.2s ease;
}

.slider::-webkit-slider-thumb:hover {
    background: #404040;
}

.slider::-moz-range-thumb {
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: #525252;
    cursor: pointer;
    border: none;
    transition: all 0.2s ease;
}

.slider::-moz-range-thumb:hover {
    background: #404040;
}

@media (prefers-color-scheme: dark) {
    .slider::-webkit-slider-thumb {
        background: #a3a3a3;
    }
    
    .slider::-webkit-slider-thumb:hover {
        background: #d4d4d4;
    }
    
    .slider::-moz-range-thumb {
        background: #a3a3a3;
    }
    
    .slider::-moz-range-thumb:hover {
        background: #d4d4d4;
    }
}
`;

// 添加样式到页面
if (
  typeof window !== 'undefined' &&
  !document.getElementById('bean-print-modal-styles')
) {
  const styleSheet = document.createElement('style');
  styleSheet.id = 'bean-print-modal-styles';
  styleSheet.textContent = sliderStyles;
  document.head.appendChild(styleSheet);
}
