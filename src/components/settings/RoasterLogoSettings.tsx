'use client';

import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, Upload, X, ImagePlus } from 'lucide-react';
import Image from 'next/image';
import RoasterLogoManager from '@/lib/managers/RoasterLogoManager';
import { extractUniqueRoasters } from '@/lib/utils/beanVarietyUtils';
import { CoffeeBeanManager } from '@/lib/managers/coffeeBeanManager';
import { ExtendedCoffeeBean } from '@/components/coffee-bean/List/types';
import hapticsUtils from '@/lib/ui/haptics';
import { getChildPageStyle } from '@/lib/navigation/pageTransition';

interface RoasterLogoSettingsProps {
  isOpen: boolean;
  onClose: () => void;
  hapticFeedback: boolean;
}

const RoasterLogoSettings: React.FC<RoasterLogoSettingsProps> = ({
  isOpen,
  onClose,
  hapticFeedback,
}) => {
  const [shouldRender, setShouldRender] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [roasters, setRoasters] = useState<string[]>([]);
  const [logos, setLogos] = useState<Map<string, string>>(new Map());
  const [uploading, setUploading] = useState<string | null>(null);
  const fileInputRefs = useRef<Map<string, HTMLInputElement>>(new Map());

  // 历史栈管理
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!isOpen) return;

    window.history.pushState({ modal: 'roasterLogoSettings' }, '');

    const handlePopState = () => onCloseRef.current();
    window.addEventListener('popstate', handlePopState);

    return () => window.removeEventListener('popstate', handlePopState);
  }, [isOpen]);

  // 处理显示/隐藏动画
  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      const timer = setTimeout(() => setIsVisible(true), 10);
      return () => clearTimeout(timer);
    } else {
      setIsVisible(false);
      const timer = setTimeout(() => setShouldRender(false), 350);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // 加载烘焙商列表和图标
  useEffect(() => {
    if (isOpen) {
      loadRoasters();
      loadLogos();
    }
  }, [isOpen]);

  const loadRoasters = async () => {
    try {
      const beans =
        (await CoffeeBeanManager.getAllBeans()) as ExtendedCoffeeBean[];
      const uniqueRoasters = extractUniqueRoasters(beans);
      // 过滤掉"未知烘焙商"
      const filteredRoasters = uniqueRoasters.filter(r => r !== '未知烘焙商');
      setRoasters(filteredRoasters);
    } catch (error) {
      console.error('Failed to load roasters:', error);
    }
  };

  const loadLogos = async () => {
    try {
      const allLogos = await RoasterLogoManager.getAllLogos();
      const logoMap = new Map<string, string>();
      allLogos.forEach(logo => {
        logoMap.set(logo.roasterName, logo.logoData);
      });
      setLogos(logoMap);
    } catch (error) {
      console.error('Failed to load logos:', error);
    }
  };

  const handleClose = () => {
    // 立即触发退出动画
    setIsVisible(false);

    // 立即通知父组件子设置正在关闭
    window.dispatchEvent(new CustomEvent('subSettingsClosing'));

    // 等待动画完成后再真正关闭
    setTimeout(() => {
      if (window.history.state?.modal === 'roasterLogoSettings') {
        window.history.back();
      } else {
        onClose();
      }
    }, 350); // 与 IOS_TRANSITION_CONFIG.duration 一致
  };

  const handleFileSelect = async (roasterName: string, file: File) => {
    if (!file) return;

    // 验证文件类型
    if (!file.type.startsWith('image/')) {
      alert('请选择图片文件');
      return;
    }

    // 验证文件大小（最大5MB）
    if (file.size > 5 * 1024 * 1024) {
      alert('图片文件不能超过5MB');
      return;
    }

    setUploading(roasterName);

    try {
      const success = await RoasterLogoManager.uploadLogo(roasterName, file);
      if (success) {
        // 重新加载图标
        await loadLogos();
        if (hapticFeedback) {
          hapticsUtils.success();
        }
      } else {
        alert('上传失败，请重试');
        if (hapticFeedback) {
          hapticsUtils.error();
        }
      }
    } catch (error) {
      console.error('Upload error:', error);
      alert('上传失败：' + (error as Error).message);
      if (hapticFeedback) {
        hapticsUtils.error();
      }
    } finally {
      setUploading(null);
    }
  };

  const handleDeleteLogo = async (roasterName: string) => {
    if (!confirm(`确定要删除 ${roasterName} 的图标吗？`)) {
      return;
    }

    try {
      const success = await RoasterLogoManager.deleteLogo(roasterName);
      if (success) {
        await loadLogos();
        if (hapticFeedback) {
          hapticsUtils.success();
        }
      }
    } catch (error) {
      console.error('Delete error:', error);
      if (hapticFeedback) {
        hapticsUtils.error();
      }
    }
  };

  const triggerFileInput = (roasterName: string) => {
    const input = fileInputRefs.current.get(roasterName);
    if (input) {
      input.click();
    }
  };

  if (!shouldRender) return null;

  return (
    <div
      className="fixed inset-0 mx-auto flex max-w-[500px] flex-col bg-neutral-50 dark:bg-neutral-900"
      style={getChildPageStyle(isVisible)}
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
          烘焙商图标设置
        </h2>
      </div>

      {/* 滚动内容区域 */}
      <div className="pb-safe-bottom relative flex-1 overflow-y-auto">
        {/* 顶部渐变阴影 */}
        <div className="pointer-events-none sticky top-0 z-10 h-12 w-full bg-linear-to-b from-neutral-50 to-transparent first:border-b-0 dark:from-neutral-900"></div>

        <div className="-mt-4 px-6">
          {roasters.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <ImagePlus className="mb-2 h-10 w-10 text-neutral-300 dark:text-neutral-600" />
              <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
                暂无烘焙商
              </p>
              <p className="mt-1 text-xs text-neutral-400 dark:text-neutral-500">
                添加咖啡豆后，烘焙商会自动出现在这里
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* 烘焙商列表标题 */}
              <h3 className="text-sm font-medium tracking-wider text-neutral-500 uppercase dark:text-neutral-400">
                烘焙商列表 ({roasters.length})
              </h3>

              {/* 烘焙商列表 */}
              <div className="space-y-2">
                {roasters.map(roaster => {
                  const hasLogo = logos.has(roaster);
                  const logoData = logos.get(roaster);
                  const isUploading = uploading === roaster;

                  return (
                    <div
                      key={roaster}
                      className="flex items-center justify-between rounded bg-neutral-100 p-1.5 dark:bg-neutral-800"
                    >
                      {/* 烘焙商名称和图标预览 */}
                      <div className="flex items-center gap-3">
                        {/* 图标预览 */}
                        <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded border border-neutral-200 bg-neutral-50/80 dark:border-neutral-700 dark:bg-neutral-900">
                          {hasLogo && logoData ? (
                            <Image
                              src={logoData}
                              alt={roaster}
                              fill
                              className="object-cover"
                              unoptimized
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-sm font-medium text-neutral-400 dark:text-neutral-600">
                              {roaster.charAt(0)}
                            </div>
                          )}
                        </div>

                        {/* 烘焙商名称 */}
                        <span className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
                          {roaster}
                        </span>
                      </div>

                      {/* 操作按钮 */}
                      <div className="flex items-center gap-1.5">
                        {hasLogo && (
                          <button
                            onClick={() => handleDeleteLogo(roaster)}
                            disabled={isUploading}
                            className="rounded p-1.5 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-red-500 disabled:opacity-50 dark:hover:bg-neutral-700"
                            title="删除图标"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        )}

                        <button
                          onClick={() => triggerFileInput(roaster)}
                          disabled={isUploading}
                          className="rounded px-2.5 py-1 text-xs font-medium text-neutral-600 transition-colors hover:bg-neutral-100 disabled:opacity-50 dark:text-neutral-400 dark:hover:bg-neutral-700"
                        >
                          {isUploading
                            ? '上传中...'
                            : hasLogo
                              ? '更换'
                              : '上传'}
                        </button>

                        {/* 隐藏的文件输入 */}
                        <input
                          ref={el => {
                            if (el) {
                              fileInputRefs.current.set(roaster, el);
                            }
                          }}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={e => {
                            const file = e.target.files?.[0];
                            if (file) {
                              handleFileSelect(roaster, file);
                            }
                            // 重置input值，允许选择同一文件
                            e.target.value = '';
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 使用说明 */}
          {roasters.length > 0 && (
            <div className="mt-6 space-y-3">
              <h3 className="text-sm font-medium tracking-wider text-neutral-500 uppercase dark:text-neutral-400">
                使用说明
              </h3>
              <div className="rounded bg-neutral-100 p-3.5 dark:bg-neutral-800">
                <ul className="space-y-1.5 text-xs text-neutral-600 dark:text-neutral-400">
                  <li className="flex items-start gap-2">
                    <span className="mt-0.5 text-neutral-400 dark:text-neutral-500">
                      •
                    </span>
                    <span>
                      当咖啡豆未设置图片时，会自动显示对应烘焙商的图标
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-0.5 text-neutral-400 dark:text-neutral-500">
                      •
                    </span>
                    <span>烘焙商名称从咖啡豆名称的第一个词自动识别</span>
                  </li>
                </ul>
              </div>
            </div>
          )}

          {/* 底部空间 */}
          <div className="h-16" />
        </div>
      </div>
    </div>
  );
};

export default RoasterLogoSettings;
