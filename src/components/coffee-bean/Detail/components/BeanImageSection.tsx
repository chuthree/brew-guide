'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Image from 'next/image';
import { CoffeeBean } from '@/types/app';
import { Camera, Image as ImageIcon } from 'lucide-react';
import { captureImage } from '@/lib/utils/imageCapture';
import { compressImage } from '@/lib/utils/imageCompression';
import { getRoasterName, RoasterSettings } from '@/lib/utils/beanVarietyUtils';
import {
  getRoasterLogoSync,
  useSettingsStore,
} from '@/lib/stores/settingsStore';

// 获取烘焙商名称用于 alt 文本的辅助函数
const getRoasterAltText = (
  beanData: CoffeeBean | Partial<CoffeeBean> | null,
  roasterSettings: RoasterSettings
): string => {
  if (!beanData) return '烘焙商图标';
  return (
    getRoasterName(beanData as CoffeeBean, roasterSettings) || '烘焙商图标'
  );
};

interface BeanImageSectionProps {
  bean: CoffeeBean | null;
  tempBean: Partial<CoffeeBean>;
  isAddMode: boolean;
  roasterLogo: string | null;
  imageError: boolean;
  setImageError: (error: boolean) => void;
  setTempBean: React.Dispatch<React.SetStateAction<Partial<CoffeeBean>>>;
  handleUpdateField: (updates: Partial<CoffeeBean>) => Promise<void>;
  onImageClick: (imageUrl: string, backImageUrl?: string) => void;
}

// 小尺寸咖啡豆图片组件（用于关联豆子卡片）
export const BeanImageSmall: React.FC<{ bean: CoffeeBean }> = ({ bean }) => {
  const [imageError, setImageError] = useState(false);
  const [roasterLogo, setRoasterLogo] = useState<string | null>(null);

  // 获取烘焙商字段设置
  const roasterFieldEnabled = useSettingsStore(
    state => state.settings.roasterFieldEnabled
  );
  const roasterSeparator = useSettingsStore(
    state => state.settings.roasterSeparator
  );
  const roasterSettings = useMemo(
    () => ({
      roasterFieldEnabled,
      roasterSeparator,
    }),
    [roasterFieldEnabled, roasterSeparator]
  );

  useEffect(() => {
    if (!bean.name || bean.image) {
      setRoasterLogo(null);
      return;
    }

    const roasterName = getRoasterName(bean, roasterSettings);
    if (roasterName && roasterName !== '未知烘焙商') {
      const logo = getRoasterLogoSync(roasterName);
      setRoasterLogo(logo || null);
    } else {
      setRoasterLogo(null);
    }
  }, [bean.name, bean.image, bean.roaster, roasterSettings]);

  const roasterName = getRoasterName(bean, roasterSettings);

  return (
    <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-xs bg-neutral-200/30 dark:bg-neutral-800/40">
      {bean.image && !imageError ? (
        <Image
          src={bean.image}
          alt={bean.name}
          fill
          className="object-cover"
          onError={() => setImageError(true)}
        />
      ) : roasterLogo && !imageError ? (
        <Image
          src={roasterLogo}
          alt={roasterName || '烘焙商图标'}
          fill
          className="object-cover"
          onError={() => setImageError(true)}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-[10px] font-medium text-neutral-400 dark:text-neutral-600">
          {bean.name ? bean.name.charAt(0) : '豆'}
        </div>
      )}
    </div>
  );
};

const BeanImageSection: React.FC<BeanImageSectionProps> = ({
  bean,
  tempBean,
  isAddMode,
  roasterLogo,
  imageError,
  setImageError,
  setTempBean,
  handleUpdateField,
  onImageClick,
}) => {
  // 获取烘焙商字段设置
  const roasterFieldEnabled = useSettingsStore(
    state => state.settings.roasterFieldEnabled
  );
  const roasterSeparator = useSettingsStore(
    state => state.settings.roasterSeparator
  );
  const roasterSettings = useMemo(
    () => ({
      roasterFieldEnabled,
      roasterSeparator,
    }),
    [roasterFieldEnabled, roasterSeparator]
  );

  // 处理图片选择
  const handleImageSelect = async (
    source: 'camera' | 'gallery',
    imageType: 'front' | 'back' = 'front'
  ) => {
    try {
      const result = await captureImage({ source });

      const response = await fetch(result.dataUrl);
      const blob = await response.blob();
      const file = new File([blob], `image.${result.format}`, {
        type: `image/${result.format}`,
      });

      const compressedFile = await compressImage(file, {
        maxWidth: 1024,
        maxHeight: 1024,
        quality: 0.8,
        maxSizeMB: 0.3,
      });

      const reader = new FileReader();
      reader.onload = e => {
        const base64 = e.target?.result as string;
        const fieldName = imageType === 'back' ? 'backImage' : 'image';
        if (isAddMode) {
          setTempBean(prev => ({ ...prev, [fieldName]: base64 }));
        } else if (bean) {
          handleUpdateField({ [fieldName]: base64 });
        }
      };
      reader.readAsDataURL(compressedFile);
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('图片选择失败:', error);
      }
    }
  };

  // 不显示图片区域的条件
  if (!isAddMode && !bean?.image && !bean?.backImage && !roasterLogo) {
    return null;
  }

  if (!isAddMode && imageError) {
    return null;
  }

  return (
    <div className="mb-4">
      <div className="flex cursor-pointer items-end justify-center gap-3 bg-neutral-200/30 px-6 py-3 dark:bg-neutral-800/40">
        {isAddMode ? (
          <AddModeImages
            tempBean={tempBean}
            roasterLogo={roasterLogo}
            imageError={imageError}
            setImageError={setImageError}
            setTempBean={setTempBean}
            handleImageSelect={handleImageSelect}
            onImageClick={onImageClick}
            roasterSettings={roasterSettings}
          />
        ) : (
          <ViewModeImages
            bean={bean}
            roasterLogo={roasterLogo}
            imageError={imageError}
            setImageError={setImageError}
            onImageClick={onImageClick}
            roasterSettings={roasterSettings}
          />
        )}
      </div>
    </div>
  );
};

// 添加模式的图片组件
const AddModeImages: React.FC<{
  tempBean: Partial<CoffeeBean>;
  roasterLogo: string | null;
  imageError: boolean;
  setImageError: (error: boolean) => void;
  setTempBean: React.Dispatch<React.SetStateAction<Partial<CoffeeBean>>>;
  handleImageSelect: (
    source: 'camera' | 'gallery',
    imageType: 'front' | 'back'
  ) => void;
  onImageClick: (imageUrl: string, backImageUrl?: string) => void;
  roasterSettings: RoasterSettings;
}> = ({
  tempBean,
  roasterLogo,
  imageError,
  setImageError,
  setTempBean,
  handleImageSelect,
  onImageClick,
  roasterSettings,
}) => {
  // 状态: 用户正面图 + 用户背面图
  if (tempBean.image && tempBean.backImage) {
    return (
      <>
        <div className="relative h-32 overflow-hidden bg-neutral-100 dark:bg-neutral-800">
          <Image
            src={tempBean.image}
            alt={tempBean.name || '咖啡豆正面'}
            height={192}
            width={192}
            className="h-full w-auto object-cover"
            onError={() => setImageError(true)}
            onClick={() => {
              if (!imageError && tempBean.image) {
                onImageClick(tempBean.image, tempBean.backImage);
              }
            }}
          />
          <button
            type="button"
            onClick={e => {
              e.stopPropagation();
              setTempBean(prev => ({ ...prev, image: undefined }));
            }}
            className="absolute top-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-neutral-800/80 text-white transition-colors hover:bg-red-500"
          >
            <span className="text-xs">×</span>
          </button>
        </div>
        <div className="relative h-20 shrink-0 self-end overflow-hidden bg-neutral-100 dark:bg-neutral-800">
          <Image
            src={tempBean.backImage}
            alt={tempBean.name || '咖啡豆背面'}
            height={80}
            width={80}
            className="h-full w-auto object-cover"
            onError={() => setImageError(true)}
            onClick={() => {
              if (!imageError && tempBean.backImage) {
                onImageClick(tempBean.backImage, tempBean.image);
              }
            }}
          />
          <button
            type="button"
            onClick={e => {
              e.stopPropagation();
              setTempBean(prev => ({ ...prev, backImage: undefined }));
            }}
            className="absolute top-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-neutral-800/80 text-white transition-colors hover:bg-red-500"
          >
            <span className="text-xs">×</span>
          </button>
        </div>
      </>
    );
  }

  // 状态: 用户正面图 + 添加背面按钮
  if (tempBean.image && !tempBean.backImage) {
    return (
      <>
        <div className="relative h-32 overflow-hidden bg-neutral-100 dark:bg-neutral-800">
          <Image
            src={tempBean.image}
            alt={tempBean.name || '咖啡豆正面'}
            height={192}
            width={192}
            className="h-full w-auto object-cover"
            onError={() => setImageError(true)}
            onClick={() => {
              if (!imageError && tempBean.image) {
                onImageClick(tempBean.image, undefined);
              }
            }}
          />
          <button
            type="button"
            onClick={e => {
              e.stopPropagation();
              setTempBean(prev => ({ ...prev, image: undefined }));
            }}
            className="absolute top-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-neutral-800/80 text-white transition-colors hover:bg-red-500"
          >
            <span className="text-xs">×</span>
          </button>
        </div>
        <div className="relative h-20 w-20 shrink-0 self-end overflow-hidden bg-neutral-200/50 dark:bg-neutral-800">
          <button
            type="button"
            onClick={() => handleImageSelect('gallery', 'back')}
            className="flex h-full w-full items-center justify-center transition-colors hover:bg-neutral-200/80 dark:hover:bg-neutral-700/80"
            title="添加背面图片"
          >
            <ImageIcon className="h-5 w-5 text-neutral-300 dark:text-neutral-600" />
          </button>
        </div>
      </>
    );
  }

  // 状态: 烘焙商图标作为正面
  if (!tempBean.image && roasterLogo) {
    return (
      <>
        <div
          className="relative h-32 cursor-pointer overflow-hidden bg-neutral-100 dark:bg-neutral-800"
          onClick={() => handleImageSelect('gallery', 'front')}
          title="点击替换为自定义图片"
        >
          <Image
            src={roasterLogo}
            alt={getRoasterAltText(tempBean, roasterSettings)}
            height={192}
            width={192}
            className="h-full w-auto object-cover"
            onError={() => setImageError(true)}
          />
          <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 transition-opacity hover:opacity-100">
            <Camera className="h-6 w-6 text-white drop-shadow-md" />
          </div>
        </div>
        {tempBean.backImage ? (
          <div className="relative h-20 shrink-0 self-end overflow-hidden bg-neutral-100 dark:bg-neutral-800">
            <Image
              src={tempBean.backImage}
              alt={tempBean.name || '咖啡豆背面'}
              height={80}
              width={80}
              className="h-full w-auto object-cover"
              onError={() => setImageError(true)}
              onClick={() => {
                if (!imageError && tempBean.backImage) {
                  onImageClick(tempBean.backImage, roasterLogo);
                }
              }}
            />
            <button
              type="button"
              onClick={e => {
                e.stopPropagation();
                setTempBean(prev => ({ ...prev, backImage: undefined }));
              }}
              className="absolute top-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-neutral-800/80 text-white transition-colors hover:bg-red-500"
            >
              <span className="text-xs">×</span>
            </button>
          </div>
        ) : (
          <div className="relative h-20 w-20 shrink-0 self-end overflow-hidden bg-neutral-200/50 dark:bg-neutral-800">
            <button
              type="button"
              onClick={() => handleImageSelect('gallery', 'back')}
              className="flex h-full w-full items-center justify-center transition-colors hover:bg-neutral-200/80 dark:hover:bg-neutral-700/80"
              title="添加背面图片"
            >
              <ImageIcon className="h-5 w-5 text-neutral-300 dark:text-neutral-600" />
            </button>
          </div>
        )}
      </>
    );
  }

  // 状态: 无正面图 + 有用户背面图
  if (!tempBean.image && tempBean.backImage) {
    return (
      <>
        <div className="relative h-32 overflow-hidden bg-neutral-200/50 dark:bg-neutral-800">
          <button
            type="button"
            onClick={() => handleImageSelect('gallery', 'front')}
            className="flex h-full w-32 items-center justify-center transition-colors hover:bg-neutral-200/80 dark:hover:bg-neutral-700/80"
            title="添加正面图片"
          >
            <ImageIcon className="h-6 w-6 text-neutral-300 dark:text-neutral-600" />
          </button>
        </div>
        <div className="relative h-20 shrink-0 self-end overflow-hidden bg-neutral-100 dark:bg-neutral-800">
          <Image
            src={tempBean.backImage}
            alt={tempBean.name || '咖啡豆背面'}
            height={80}
            width={80}
            className="h-full w-auto object-cover"
            onError={() => setImageError(true)}
            onClick={() => {
              if (!imageError && tempBean.backImage) {
                onImageClick(tempBean.backImage, undefined);
              }
            }}
          />
          <button
            type="button"
            onClick={e => {
              e.stopPropagation();
              setTempBean(prev => ({ ...prev, backImage: undefined }));
            }}
            className="absolute top-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-neutral-800/80 text-white transition-colors hover:bg-red-500"
          >
            <span className="text-xs">×</span>
          </button>
        </div>
      </>
    );
  }

  // 状态: 无任何图片 → 拍照 + 相册
  return (
    <>
      <div className="relative h-20 shrink-0 overflow-hidden bg-neutral-200/50 dark:bg-neutral-800">
        <button
          type="button"
          onClick={() => handleImageSelect('camera', 'front')}
          className="flex h-full w-20 items-center justify-center transition-colors hover:bg-neutral-200/80 dark:hover:bg-neutral-700/80"
          title="拍照"
        >
          <Camera className="h-5 w-5 text-neutral-300 dark:text-neutral-600" />
        </button>
      </div>
      <div className="relative h-32 overflow-hidden bg-neutral-200/50 dark:bg-neutral-800">
        <button
          type="button"
          onClick={() => handleImageSelect('gallery', 'front')}
          className="flex h-full w-32 items-center justify-center transition-colors hover:bg-neutral-200/80 dark:hover:bg-neutral-700/80"
          title="从相册选择"
        >
          <ImageIcon className="h-6 w-6 text-neutral-300 dark:text-neutral-600" />
        </button>
      </div>
    </>
  );
};

// 查看模式的图片组件
const ViewModeImages: React.FC<{
  bean: CoffeeBean | null;
  roasterLogo: string | null;
  imageError: boolean;
  setImageError: (error: boolean) => void;
  onImageClick: (imageUrl: string, backImageUrl?: string) => void;
  roasterSettings: RoasterSettings;
}> = ({
  bean,
  roasterLogo,
  imageError,
  setImageError,
  onImageClick,
  roasterSettings,
}) => {
  if (bean?.image && !imageError) {
    return (
      <>
        <div className="relative h-32 overflow-hidden bg-neutral-100 dark:bg-neutral-800">
          <Image
            src={bean.image}
            alt={bean.name || '咖啡豆正面'}
            height={192}
            width={192}
            className="h-full w-auto object-cover"
            onError={() => setImageError(true)}
            onClick={() => {
              if (!imageError && bean.image) {
                onImageClick(bean.image, bean.backImage);
              }
            }}
          />
        </div>
        {bean.backImage && (
          <div className="relative h-20 shrink-0 self-end overflow-hidden bg-neutral-100 dark:bg-neutral-800">
            <Image
              src={bean.backImage}
              alt={bean.name || '咖啡豆背面'}
              height={80}
              width={80}
              className="h-full w-auto object-cover"
              onError={() => setImageError(true)}
              onClick={() => {
                if (!imageError && bean.backImage) {
                  onImageClick(bean.backImage, bean.image);
                }
              }}
            />
          </div>
        )}
      </>
    );
  }

  if (roasterLogo && !imageError) {
    return (
      <>
        <div className="relative h-32 overflow-hidden bg-neutral-100 dark:bg-neutral-800">
          <Image
            src={roasterLogo}
            alt={getRoasterAltText(bean, roasterSettings)}
            height={192}
            width={192}
            className="h-full w-auto object-cover"
            onError={() => setImageError(true)}
            onClick={() => {
              if (!imageError && roasterLogo) {
                onImageClick(roasterLogo, bean?.backImage);
              }
            }}
          />
        </div>
        {bean?.backImage && (
          <div className="relative h-20 shrink-0 self-end overflow-hidden bg-neutral-100 dark:bg-neutral-800">
            <Image
              src={bean.backImage}
              alt={bean.name || '咖啡豆背面'}
              height={80}
              width={80}
              className="h-full w-auto object-cover"
              onError={() => setImageError(true)}
              onClick={() => {
                if (!imageError && bean.backImage) {
                  onImageClick(bean.backImage, roasterLogo);
                }
              }}
            />
          </div>
        )}
      </>
    );
  }

  return null;
};

export default BeanImageSection;
