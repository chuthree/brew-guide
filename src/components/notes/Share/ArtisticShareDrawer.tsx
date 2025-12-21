'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import ActionDrawer from '@/components/common/ui/ActionDrawer';
import { BrewingNote, equipmentList, CustomEquipment } from '@/lib/core/config';
import { useCoffeeBeanStore } from '@/lib/stores/coffeeBeanStore';
import { loadCustomEquipments } from '@/lib/managers/customEquipments';
import { CoffeeBean } from '@/types/app';
import { TempFileManager } from '@/lib/utils/tempFileManager';
import { showToast } from '@/components/common/feedback/LightToast';
import { copyToClipboard } from '@/lib/utils/exportUtils';
import { Loader2 } from 'lucide-react';

interface ArtisticShareDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  note: BrewingNote;
}

type Tab = 'text' | 'bean-image' | 'note-image';

const ArtisticShareDrawer: React.FC<ArtisticShareDrawerProps> = ({
  isOpen,
  onClose,
  note,
}) => {
  const [activeTab, setActiveTab] = useState<Tab>('text');
  const [bean, setBean] = useState<CoffeeBean | null>(null);
  const [equipmentName, setEquipmentName] = useState(note.equipment);
  const [isEspresso, setIsEspresso] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const textRef = useRef<HTMLDivElement>(null);

  // 从 Store 获取咖啡豆数据
  const allBeans = useCoffeeBeanStore(state => state.beans);

  const handleTextClick = () => {
    if (textRef.current) {
      const range = document.createRange();
      range.selectNodeContents(textRef.current);
      const selection = window.getSelection();
      if (selection) {
        selection.removeAllRanges();
        selection.addRange(range);
      }
    }
  };

  // Load equipment name
  useEffect(() => {
    const loadEquipmentName = async () => {
      // Reset first
      setIsEspresso(note.equipment === 'Espresso');

      // 1. Check system equipment
      const systemEquipment = equipmentList.find(e => e.id === note.equipment);
      if (systemEquipment) {
        setEquipmentName(systemEquipment.name);
        return;
      }

      // 2. Check custom equipment
      try {
        const customEquipments = await loadCustomEquipments();
        const customEquipment = customEquipments.find(
          (e: CustomEquipment) => e.id === note.equipment
        );
        if (customEquipment) {
          setEquipmentName(customEquipment.name);
          if (customEquipment.animationType === 'espresso') {
            setIsEspresso(true);
          }
        }
      } catch (error) {
        console.error('Failed to load custom equipment:', error);
      }
    };
    loadEquipmentName();
  }, [note.equipment]);

  // Load bean data
  useEffect(() => {
    if (isOpen) {
      if (note.beanId) {
        setIsLoading(true);
        // 直接从 Store 查找
        const loadedBean = allBeans.find(b => b.id === note.beanId) || null;
        setBean(loadedBean);
        setIsLoading(false);
      } else {
        setBean(null);
      }
    } else {
      // Reset to text tab when closed
      setTimeout(() => setActiveTab('text'), 300);
    }
  }, [isOpen, note.beanId, allBeans]);

  const tabs = useMemo(() => {
    const list: { id: Tab; label: string }[] = [{ id: 'text', label: '文案' }];
    if (note.image) list.push({ id: 'note-image', label: '记录图片' });
    if (bean?.image) list.push({ id: 'bean-image', label: '豆子图片' });
    return list;
  }, [bean, note.image]);

  /**
   * 使用纯 Canvas API 生成图片
   * 这是最可靠的跨平台方案，不依赖任何 DOM 转图片库
   */
  const generateImageWithCanvas = async (imageSrc: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new window.Image();
      img.crossOrigin = 'anonymous';

      img.onload = () => {
        // Canvas 尺寸（3x 高清）
        const scale = 3;
        const canvasSize = 280 * scale;
        const padding = 24 * scale;

        const canvas = document.createElement('canvas');
        canvas.width = canvasSize;
        canvas.height = canvasSize;
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          reject(new Error('无法创建 Canvas 上下文'));
          return;
        }

        // 1. 绘制背景
        ctx.fillStyle = '#f5f5f5';
        ctx.fillRect(0, 0, canvasSize, canvasSize);

        // 2. 计算图片尺寸（保持比例，适应容器）
        const maxImgSize = canvasSize - padding * 2;
        let imgWidth = img.naturalWidth;
        let imgHeight = img.naturalHeight;

        const imgRatio = imgWidth / imgHeight;
        if (imgRatio > 1) {
          // 宽图
          imgWidth = maxImgSize;
          imgHeight = maxImgSize / imgRatio;
        } else {
          // 高图或方图
          imgHeight = maxImgSize;
          imgWidth = maxImgSize * imgRatio;
        }

        const imgX = (canvasSize - imgWidth) / 2;
        const imgY = (canvasSize - imgHeight) / 2;

        // 3. 绘制图片
        ctx.drawImage(img, imgX, imgY, imgWidth, imgHeight);

        // 导出为 PNG
        const dataUrl = canvas.toDataURL('image/png', 1.0);
        resolve(dataUrl);
      };

      img.onerror = () => {
        reject(new Error('图片加载失败'));
      };

      img.src = imageSrc;
    });
  };

  const handleSaveImage = async () => {
    const imageSrc =
      activeTab === 'bean-image'
        ? bean?.image
        : activeTab === 'note-image'
          ? note.image
          : null;
    const filename =
      activeTab === 'bean-image' ? `bean-${note.id}` : `note-${note.id}`;

    if (!imageSrc || isGenerating) return;

    setIsGenerating(true);
    try {
      const dataUrl = await generateImageWithCanvas(imageSrc);

      await TempFileManager.shareImageFile(dataUrl, filename, {
        title: '分享图片',
        text: '分享图片',
        dialogTitle: '保存图片',
      });

      showToast({ type: 'success', title: '图片已生成' });
    } catch (error) {
      console.error('Failed to generate image:', error);
      showToast({ type: 'error', title: '生成图片失败' });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopyText = async () => {
    const text = generateShareText();
    const result = await copyToClipboard(text);

    if (result.success) {
      showToast({ type: 'success', title: '文案已复制' });
    } else {
      showToast({ type: 'error', title: '复制失败' });
    }
  };

  const generateShareText = () => {
    const parts = [];

    // Title - 单独一行作为标题
    parts.push(`${note.coffeeBeanInfo?.name || '咖啡分享'}`);
    parts.push(''); // 空行分隔标题和内容

    // Basic Info - Combine Equipment and Method
    const metaInfo = [];
    if (equipmentName) metaInfo.push(equipmentName);
    if (note.method) metaInfo.push(note.method);

    if (metaInfo.length > 0) {
      parts.push(metaInfo.join(' · '));
    }

    // Params
    const cleanValue = (val: string) => val.replace(/[a-zA-Z°]+$/, '').trim();
    const params = [];

    if (isEspresso) {
      // 意式：粉量、研磨度、萃取时间、液重
      if (note.params?.coffee && note.params.coffee !== '0')
        params.push(`粉量 ${cleanValue(note.params.coffee)}g`);

      if (note.params?.grindSize)
        params.push(`研磨度 ${note.params.grindSize}`);

      if (note.totalTime && note.totalTime > 0)
        params.push(`时间 ${note.totalTime}s`);

      if (note.params?.water && note.params.water !== '0')
        params.push(`液重 ${cleanValue(note.params.water)}g`);
    } else {
      // 手冲：粉量、粉水比、研磨度、水温
      if (note.params?.coffee && note.params.coffee !== '0')
        params.push(`粉量 ${cleanValue(note.params.coffee)}g`);

      if (note.params?.ratio && note.params.ratio !== '1:0')
        params.push(`粉水比 ${note.params.ratio}`);

      if (note.params?.grindSize)
        params.push(`研磨度 ${note.params.grindSize}`);

      if (note.params?.temp && note.params.temp !== '0')
        params.push(`水温 ${cleanValue(note.params.temp)}°C`);
    }

    if (params.length > 0) {
      parts.push(params.join('  |  '));
    }

    // Taste - 2 columns
    if (note.taste) {
      // 检查是否有任何评分大于0
      const hasAnyRating = Object.values(note.taste).some(value => value > 0);

      if (hasAnyRating) {
        parts.push(''); // 在参数和风味之间加空行分组
        const {
          acidity = 0,
          sweetness = 0,
          bitterness = 0,
          body = 0,
        } = note.taste;

        parts.push(
          `酸度 ${'●'.repeat(acidity)}${'○'.repeat(5 - acidity)}   甜度 ${'●'.repeat(sweetness)}${'○'.repeat(5 - sweetness)}`
        );
        parts.push(
          `苦度 ${'●'.repeat(bitterness)}${'○'.repeat(5 - bitterness)}   醇厚 ${'●'.repeat(body)}${'○'.repeat(5 - body)}`
        );
      }
    }

    // Rating
    if (note.rating && note.rating > 0) {
      parts.push(`评分：${note.rating}/5`);
    }

    // Notes
    if (note.notes && note.notes.trim()) {
      parts.push('');
      parts.push(note.notes.trim());
    }

    parts.push('');
    parts.push('#咖啡 #手冲咖啡 #咖啡笔记 #BrewGuide');

    return parts.join('\n');
  };

  const renderImagePreview = (imageSrc: string | undefined) => {
    if (!imageSrc) return null;

    return (
      <div className="w-full">
        <div className="relative flex aspect-square w-full items-center justify-center overflow-hidden bg-[#f5f5f5]">
          <div className="relative flex h-full w-full items-center justify-center p-8">
            <img
              src={imageSrc}
              alt="Preview"
              className="max-h-full max-w-full object-contain"
              crossOrigin="anonymous"
            />
          </div>
        </div>
      </div>
    );
  };

  return (
    <ActionDrawer isOpen={isOpen} onClose={onClose} historyId="artistic-share">
      {isLoading ? (
        <div className="flex h-[300px] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-neutral-400" />
        </div>
      ) : (
        <>
          {/* Tabs */}
          {tabs.length > 1 && (
            <div className="mb-4 flex justify-start">
              <div className="inline-flex rounded-full bg-neutral-100 p-1 dark:bg-neutral-800">
                {tabs.map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`rounded-full px-4 py-1.5 text-xs font-medium transition-all ${
                      activeTab === tab.id
                        ? 'bg-white text-neutral-900 shadow-sm dark:bg-neutral-700 dark:text-white'
                        : 'text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Content */}
          <ActionDrawer.Switcher activeKey={activeTab}>
            {activeTab === 'text' ? (
              <div
                ref={textRef}
                onClick={handleTextClick}
                data-vaul-no-drag
                className="max-h-[300px] w-full cursor-text overflow-y-auto rounded-2xl bg-neutral-50 p-5 font-mono text-xs leading-relaxed whitespace-pre-wrap text-neutral-600 select-text dark:bg-neutral-800/50 dark:text-neutral-400"
              >
                {generateShareText()}
              </div>
            ) : activeTab === 'bean-image' ? (
              renderImagePreview(bean?.image)
            ) : (
              renderImagePreview(note.image)
            )}
          </ActionDrawer.Switcher>

          {/* Actions */}
          <div className="mt-6 grid grid-cols-2 gap-3">
            <ActionDrawer.SecondaryButton onClick={onClose} className="w-full">
              取消
            </ActionDrawer.SecondaryButton>
            <ActionDrawer.PrimaryButton
              onClick={activeTab === 'text' ? handleCopyText : handleSaveImage}
              disabled={isGenerating}
              className="w-full"
            >
              {isGenerating
                ? '生成中...'
                : activeTab === 'text'
                  ? '复制文案'
                  : '保存图片'}
            </ActionDrawer.PrimaryButton>
          </div>
        </>
      )}
    </ActionDrawer>
  );
};

export default ArtisticShareDrawer;
