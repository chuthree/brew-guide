'use client';

import React, { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { compressBase64Image } from '@/lib/utils/imageCapture';

interface ToolsSectionProps {
  onDataChange?: () => void;
}

export const ToolsSection: React.FC<ToolsSectionProps> = ({ onDataChange }) => {
  const [isCompressing, setIsCompressing] = useState(false);
  const [status, setStatus] = useState<{
    type: 'success' | 'error' | 'info' | null;
    message: string;
  }>({ type: null, message: '' });

  const getBase64ImageSize = (base64: string): number => {
    if (!base64 || !base64.includes(',')) return 0;
    const base64Data = base64.split(',')[1];
    return Math.floor(base64Data.length * 0.75);
  };

  const handleCompressImages = async () => {
    try {
      setIsCompressing(true);
      setStatus({ type: 'info', message: '正在检测需要压缩的图片...' });

      const { Storage } = await import('@/lib/core/storage');
      const coffeeBeansData = await Storage.get('coffeeBeans');
      
      if (!coffeeBeansData) {
        setStatus({ type: 'info', message: '没有找到咖啡豆数据' });
        return;
      }

      const coffeeBeans = JSON.parse(coffeeBeansData);
      
      if (!Array.isArray(coffeeBeans)) {
        setStatus({ type: 'error', message: '咖啡豆数据格式错误' });
        return;
      }

      const beansNeedCompression = coffeeBeans.filter(
        (bean: { id: string; name: string; image?: string }) => {
          if (!bean.image) return false;
          const imageSize = getBase64ImageSize(bean.image);
          return imageSize > 200 * 1024;
        }
      );

      if (beansNeedCompression.length === 0) {
        setStatus({ type: 'success', message: '所有图片都已经是压缩状态，无需处理' });
        return;
      }

      setStatus({
        type: 'info',
        message: `发现 ${beansNeedCompression.length} 张图片需要压缩，正在处理...`,
      });

      for (let i = 0; i < beansNeedCompression.length; i++) {
        const bean = beansNeedCompression[i];
        setStatus({
          type: 'info',
          message: `正在压缩第 ${i + 1}/${beansNeedCompression.length} 张图片: ${bean.name}`,
        });

        try {
          const compressedImage = await compressBase64Image(bean.image!);
          const beanIndex = coffeeBeans.findIndex((b: { id: string }) => b.id === bean.id);
          
          if (beanIndex !== -1) {
            coffeeBeans[beanIndex].image = compressedImage;
          }

          await new Promise((resolve) => setTimeout(resolve, 100));
        } catch (error) {
          console.error(`压缩图片失败: ${bean.name}`, error);
        }
      }

      await Storage.set('coffeeBeans', JSON.stringify(coffeeBeans));
      setStatus({
        type: 'success',
        message: `图片压缩完成！已处理 ${beansNeedCompression.length} 张图片`,
      });

      onDataChange?.();
    } catch (error) {
      console.error('图片压缩失败:', error);
      setStatus({
        type: 'error',
        message: `图片压缩失败: ${(error as Error).message}`,
      });
    } finally {
      setIsCompressing(false);
    }
  };

  return (
    <div className="px-6 py-4">
      <h3 className="mb-3 text-sm font-medium tracking-wider text-neutral-500 uppercase dark:text-neutral-400">
        工具
      </h3>

      {status.type && (
        <div
          className={`mb-4 rounded-md p-3 text-sm ${
            status.type === 'success'
              ? 'bg-green-50 text-green-800 dark:bg-green-900/20 dark:text-green-400'
              : status.type === 'error'
                ? 'bg-red-50 text-red-800 dark:bg-red-900/20 dark:text-red-400'
                : 'bg-blue-50 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400'
          }`}
        >
          {status.message}
        </div>
      )}

      <div className="space-y-5">
        <button
          onClick={handleCompressImages}
          disabled={isCompressing}
          className="flex w-full items-center justify-between rounded bg-neutral-100 px-4 py-3 text-sm font-medium text-neutral-800 transition-colors hover:bg-neutral-200 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700"
        >
          <span>{isCompressing ? '压缩中...' : '图片补压'}</span>
          <ChevronRight className="h-4 w-4 text-neutral-400" />
        </button>
      </div>
    </div>
  );
};
