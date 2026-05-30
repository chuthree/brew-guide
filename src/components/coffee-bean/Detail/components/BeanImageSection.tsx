'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Image from 'next/image';
import { CoffeeBean } from '@/types/app';
import { Camera, Image as ImageIcon } from 'lucide-react';
import { captureImage } from '@/lib/utils/imageCapture';
import { compressImage } from '@/lib/utils/imageCompression';
import {
  getBeanDisplayInitial,
  getRoasterName,
  RoasterSettings,
} from '@/lib/utils/beanVarietyUtils';
import { useRoasterLogo, useSettingsStore } from '@/lib/stores/settingsStore';
import { useCoffeeBeanImage } from '@/lib/hooks/useCoffeeBeanImage';
import {
  getCoffeeBeanImageSource,
  type CoffeeBeanImageSide,
} from '@/lib/coffee-beans/imageRepository';

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
  onImageClick: (
    imageUrl: string,
    backImageUrl?: string,
    sourceElement?: HTMLElement | null
  ) => void;
}

// 小尺寸咖啡豆图片组件（用于关联豆子卡片）
export const BeanImageSmall: React.FC<{
  bean: CoffeeBean;
  onClick?: (sourceElement: HTMLElement) => void;
}> = ({ bean, onClick }) => {
  const [imageError, setImageError] = useState(false);

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
  const beanImage = useCoffeeBeanImage(bean.id, {
    fallback: bean.image,
    preferThumbnail: true,
  });

  const roasterName = useMemo(
    () => getRoasterName(bean, roasterSettings),
    [bean, roasterSettings]
  );
  const configuredRoasterLogo = useRoasterLogo(roasterName);
  const roasterLogo = useMemo(() => {
    if (!bean.name || beanImage) {
      return null;
    }

    if (roasterName && roasterName !== '未知烘焙商') {
      return configuredRoasterLogo;
    }

    return null;
  }, [bean.name, beanImage, configuredRoasterLogo, roasterName]);

  return (
    <div
      className={`relative h-10 w-10 shrink-0 overflow-hidden rounded-xs bg-neutral-200/30 dark:bg-neutral-800/40 ${
        onClick ? 'cursor-pointer' : ''
      }`}
      onClick={event => {
        event.stopPropagation();
        onClick?.(event.currentTarget);
      }}
    >
      {beanImage && !imageError ? (
        <Image
          src={beanImage}
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
          {getBeanDisplayInitial(bean)}
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
  const storedFrontImage = useCoffeeBeanImage(bean?.id, {
    fallback: bean?.image,
    preferThumbnail: true,
  });
  const storedBackImage = useCoffeeBeanImage(bean?.id, {
    side: 'back',
    fallback: bean?.backImage,
    preferThumbnail: true,
  });
  const viewBean = useMemo(
    () =>
      bean
        ? {
            ...bean,
            image: storedFrontImage,
            backImage: storedBackImage,
          }
        : null,
    [bean, storedFrontImage, storedBackImage]
  );
  const hasTempFrontImage = Object.prototype.hasOwnProperty.call(
    tempBean,
    'image'
  );
  const hasTempBackImage = Object.prototype.hasOwnProperty.call(
    tempBean,
    'backImage'
  );
  const formBean = useMemo(
    () => ({
      ...tempBean,
      image: hasTempFrontImage ? tempBean.image : storedFrontImage,
      backImage: hasTempBackImage ? tempBean.backImage : storedBackImage,
    }),
    [
      hasTempBackImage,
      hasTempFrontImage,
      storedBackImage,
      storedFrontImage,
      tempBean,
    ]
  );

  const getOriginalImage = async (
    side: CoffeeBeanImageSide,
    fallback?: string
  ): Promise<string | undefined> => {
    if (!bean?.id) {
      return fallback;
    }

    try {
      return (
        (await getCoffeeBeanImageSource(bean.id, {
          side,
          preferThumbnail: false,
        })) || fallback
      );
    } catch (error) {
      console.warn('[BeanImageSection] 加载咖啡豆原图失败:', error);
      return fallback;
    }
  };

  const handleStoredImageClick = async (
    side: CoffeeBeanImageSide,
    sourceElement?: HTMLElement | null
  ) => {
    if (!viewBean) return;

    const primaryFallback =
      side === 'front' ? viewBean.image : viewBean.backImage;
    const secondaryFallback =
      side === 'front' ? viewBean.backImage : viewBean.image;

    const [primaryImage, secondaryImage] = await Promise.all([
      getOriginalImage(side, primaryFallback),
      getOriginalImage(side === 'front' ? 'back' : 'front', secondaryFallback),
    ]);

    if (primaryImage) {
      onImageClick(primaryImage, secondaryImage, sourceElement);
    }
  };

  const handleRoasterLogoClick = async (
    sourceElement?: HTMLElement | null
  ) => {
    if (!roasterLogo) return;

    const backImage = await getOriginalImage('back', viewBean?.backImage);
    onImageClick(roasterLogo, backImage, sourceElement);
  };

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
  if (!isAddMode && !viewBean?.image && !viewBean?.backImage && !roasterLogo) {
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
            tempBean={formBean}
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
            bean={viewBean}
            roasterLogo={roasterLogo}
            imageError={imageError}
            setImageError={setImageError}
            onStoredImageClick={handleStoredImageClick}
            onRoasterLogoClick={handleRoasterLogoClick}
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
  onImageClick: (
    imageUrl: string,
    backImageUrl?: string,
    sourceElement?: HTMLElement | null
  ) => void;
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
            onClick={e => {
              if (!imageError && tempBean.image) {
                onImageClick(tempBean.image, tempBean.backImage, e.currentTarget);
              }
            }}
          />
          <button
            type="button"
            onClick={e => {
              e.stopPropagation();
              setTempBean(prev => ({ ...prev, image: '' }));
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
            onClick={e => {
              if (!imageError && tempBean.backImage) {
                onImageClick(tempBean.backImage, tempBean.image, e.currentTarget);
              }
            }}
          />
          <button
            type="button"
            onClick={e => {
              e.stopPropagation();
              setTempBean(prev => ({ ...prev, backImage: '' }));
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
            onClick={e => {
              if (!imageError && tempBean.image) {
                onImageClick(tempBean.image, undefined, e.currentTarget);
              }
            }}
          />
          <button
            type="button"
            onClick={e => {
              e.stopPropagation();
              setTempBean(prev => ({ ...prev, image: '' }));
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
        <button
          type="button"
          className="relative block h-32 cursor-pointer overflow-hidden bg-neutral-100 p-0 dark:bg-neutral-800"
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
        </button>
        {tempBean.backImage ? (
          <div className="relative h-20 shrink-0 self-end overflow-hidden bg-neutral-100 dark:bg-neutral-800">
            <Image
              src={tempBean.backImage}
              alt={tempBean.name || '咖啡豆背面'}
              height={80}
              width={80}
              className="h-full w-auto object-cover"
              onError={() => setImageError(true)}
              onClick={e => {
                if (!imageError && tempBean.backImage) {
                  onImageClick(tempBean.backImage, roasterLogo, e.currentTarget);
                }
              }}
            />
            <button
              type="button"
              onClick={e => {
                e.stopPropagation();
                setTempBean(prev => ({ ...prev, backImage: '' }));
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
            onClick={e => {
              if (!imageError && tempBean.backImage) {
                onImageClick(tempBean.backImage, undefined, e.currentTarget);
              }
            }}
          />
          <button
            type="button"
            onClick={e => {
              e.stopPropagation();
              setTempBean(prev => ({ ...prev, backImage: '' }));
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
  onStoredImageClick: (
    side: CoffeeBeanImageSide,
    sourceElement?: HTMLElement | null
  ) => void;
  onRoasterLogoClick: (sourceElement?: HTMLElement | null) => void;
  roasterSettings: RoasterSettings;
}> = ({
  bean,
  roasterLogo,
  imageError,
  setImageError,
  onStoredImageClick,
  onRoasterLogoClick,
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
            onClick={e => {
              if (!imageError && bean.image) {
                onStoredImageClick('front', e.currentTarget);
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
              onClick={e => {
                if (!imageError && bean.backImage) {
                  onStoredImageClick('back', e.currentTarget);
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
            onClick={e => {
              if (!imageError && roasterLogo) {
                onRoasterLogoClick(e.currentTarget);
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
              onClick={e => {
                if (!imageError && bean.backImage) {
                  onStoredImageClick('back', e.currentTarget);
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
