'use client'

import React, { useState, useEffect, useRef } from 'react'
import Image from 'next/image'

import type { BrewingNoteData, CoffeeBean } from '@/types/app'
import AutoResizeTextarea from '@/components/common/forms/AutoResizeTextarea'
import NoteFormHeader from '@/components/notes/ui/NoteFormHeader'

interface TasteRatings {
    acidity: number;
    sweetness: number;
    bitterness: number;
    body: number;
}

interface FormData {
    coffeeBeanInfo: {
        name: string;
        roastLevel: string;
    };
    image?: string;
    rating: number;
    taste: TasteRatings;
    notes: string;
}

interface BrewingNoteFormProps {
    id?: string;
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: BrewingNoteData) => void;
    initialData: Partial<BrewingNoteData> & {
        coffeeBean?: CoffeeBean | null;
    };
    inBrewPage?: boolean; // 添加属性，标识是否在冲煮页面中
    showSaveButton?: boolean; // 是否显示保存按钮
    onSaveSuccess?: () => void; // 添加保存成功的回调函数
    hideHeader?: boolean; // 添加属性，控制是否隐藏头部
}

// 二次压缩函数：将base64图片再次压缩
function compressBase64(base64: string, quality = 0.7, maxWidth = 800): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      // 计算base64字符串大小（近似值）
      // base64字符串长度 * 0.75 = 字节数，因为base64编码会使文件大小增加约33%
      const approximateSizeInBytes = base64.length * 0.75;
      
      // 如果图片小于200kb，直接返回原图，不进行压缩
      if (approximateSizeInBytes <= 200 * 1024) {
        resolve(base64);
        return;
      }
      
      const img = document.createElement('img');
      
      img.onerror = () => {
        reject(new Error('图片加载失败'));
      };
      
      const imgLoadTimeout = setTimeout(() => {
        reject(new Error('图片加载超时'));
      }, 10000);
      
      img.onload = () => {
        clearTimeout(imgLoadTimeout);
        
        try {
          let width = img.width;
          let height = img.height;

          if (width > maxWidth) {
            height = height * (maxWidth / width);
            width = maxWidth;
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            throw new Error('无法获取canvas上下文');
          }
          
          ctx.drawImage(img, 0, 0, width, height);

          try {
            const compressedBase64 = canvas.toDataURL('image/jpeg', quality);
            resolve(compressedBase64);
          } catch (toDataURLError) {
            reject(toDataURLError);
          }
        } catch (canvasError) {
          reject(canvasError);
        }
      };
      
      img.src = base64;
      
      if (img.complete) {
        clearTimeout(imgLoadTimeout);
        if (img.onload) {
          const event = new Event('load');
          img.onload(event);
        }
      }
    } catch (error) {
      reject(error);
    }
  });
}

const BrewingNoteForm: React.FC<BrewingNoteFormProps> = ({
    id,
    isOpen,
    onClose,
    onSave,
    initialData,
    inBrewPage = false, // 默认不在冲煮页面
    showSaveButton = true, // 默认显示保存按钮
    onSaveSuccess, // 保存成功的回调
    hideHeader = false, // 默认显示头部
}) => {
    // 处理咖啡豆数据，如果有提供coffeeBean则使用，否则使用coffeeBeanInfo
    const initialCoffeeBeanInfo = initialData.coffeeBean
        ? {
            name: initialData.coffeeBean.name || '',
            roastLevel: initialData.coffeeBean.roastLevel || '中度烘焙',
        }
        : {
            name: initialData.coffeeBeanInfo?.name || '',
            roastLevel: initialData.coffeeBeanInfo?.roastLevel || '中度烘焙',
        };

    // 标准化烘焙度值，确保与下拉列表选项匹配
    const normalizeRoastLevel = (roastLevel?: string): string => {
        if (!roastLevel) return '中度烘焙';
        
        // 如果已经是完整格式，直接返回
        if (roastLevel.endsWith('烘焙')) return roastLevel;
        
        // 否则添加\"烘焙\"后缀
        if (roastLevel === '极浅') return '极浅烘焙';
        if (roastLevel === '浅度') return '浅度烘焙';
        if (roastLevel === '中浅') return '中浅烘焙';
        if (roastLevel === '中度') return '中度烘焙';
        if (roastLevel === '中深') return '中深烘焙';
        if (roastLevel === '深度') return '深度烘焙';
        
        // 尝试匹配部分字符串
        if (roastLevel.includes('极浅')) return '极浅烘焙';
        if (roastLevel.includes('浅度')) return '浅度烘焙';
        if (roastLevel.includes('中浅')) return '中浅烘焙';
        if (roastLevel.includes('中度')) return '中度烘焙';
        if (roastLevel.includes('中深')) return '中深烘焙';
        if (roastLevel.includes('深度')) return '深度烘焙';
        
        return '中度烘焙';
    };

    // 确保初始咖啡豆信息的烘焙度是标准化的
    if (initialCoffeeBeanInfo.roastLevel) {
        initialCoffeeBeanInfo.roastLevel = normalizeRoastLevel(initialCoffeeBeanInfo.roastLevel);
    }

    const [formData, setFormData] = useState<FormData>({
        coffeeBeanInfo: initialCoffeeBeanInfo,
        image: typeof initialData.image === 'string' ? initialData.image : '', // 修复类型错误
        rating: initialData?.rating || 3,
        taste: {
            acidity: initialData?.taste?.acidity || 0,
            sweetness: initialData?.taste?.sweetness || 0,
            bitterness: initialData?.taste?.bitterness || 0,
            body: initialData?.taste?.body || 0
        },
        notes: initialData?.notes || ''
    });
    
    // 添加方案参数状态
    const [methodParams, setMethodParams] = useState({
        coffee: initialData?.params?.coffee || '15g',
        water: initialData?.params?.water || '225g',
        ratio: initialData?.params?.ratio || '1:15',
        grindSize: initialData?.params?.grindSize || '中细',
        temp: initialData?.params?.temp || '92°C',
    });
    
    // 添加表单ref
    const formRef = useRef<HTMLFormElement>(null)

    // 移除之前的滑动按钮相关函数和状态
    const sliderRef = useRef<HTMLDivElement>(null);
    
    // 处理总体评分的滑动
    const [ratingCurrentValue, setRatingCurrentValue] = useState<number | null>(null);
    
    const handleRatingTouchStart = (value: number) => (e: React.TouchEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setRatingCurrentValue(value);
    }
    
    const handleRatingTouchMove = (e: React.TouchEvent) => {
        if (ratingCurrentValue === null) return;
        
        const touch = e.touches[0];
        const target = e.currentTarget as HTMLInputElement;
        const rect = target.getBoundingClientRect();
        const width = rect.width;
        const x = touch.clientX - rect.left;
        const percentage = Math.max(0, Math.min(1, x / width));
        
        // 计算0.5步进的评分值
        const newValue = 1 + Math.round(percentage * 8) / 2;
        
        if (newValue !== formData.rating) {
            setFormData({
                ...formData,
                rating: newValue,
            });
            setRatingCurrentValue(newValue);
        }
    }
    
    const handleRatingTouchEnd = () => {
        setRatingCurrentValue(null);
    }
    
    // 更新effect钩子，添加总体评分的触摸事件处理
    useEffect(() => {
        // 添加全局触摸事件处理
        document.addEventListener('touchend', handleTouchEnd);
        document.addEventListener('touchend', handleRatingTouchEnd);
        
        return () => {
            document.removeEventListener('touchend', handleTouchEnd);
            document.removeEventListener('touchend', handleRatingTouchEnd);
        }
    }, []);

    // 使用useRef保存上一次的initialData，用于比较变化
    const prevInitialDataRef = useRef<typeof initialData>(initialData);
    
    // Update form data when initialData changes
    useEffect(() => {
        // 检查咖啡豆信息变化
        const prevCoffeeBean = prevInitialDataRef.current.coffeeBean;
        const currentCoffeeBean = initialData.coffeeBean;
        
        const hasCoffeeBeanChanged = 
            (prevCoffeeBean?.id !== currentCoffeeBean?.id) || 
            (prevCoffeeBean?.name !== currentCoffeeBean?.name) ||
            (!prevCoffeeBean && currentCoffeeBean) ||
            (prevCoffeeBean && !currentCoffeeBean);
            
        const prevCoffeeBeanInfo = prevInitialDataRef.current.coffeeBeanInfo;
        const currentCoffeeBeanInfo = initialData.coffeeBeanInfo;
        
        const hasCoffeeBeanInfoChanged = 
            (prevCoffeeBeanInfo?.name !== currentCoffeeBeanInfo?.name) ||
            (prevCoffeeBeanInfo?.roastLevel !== currentCoffeeBeanInfo?.roastLevel) ||
            (!prevCoffeeBeanInfo && currentCoffeeBeanInfo) ||
            (prevCoffeeBeanInfo && !currentCoffeeBeanInfo);
            
        // 只有当咖啡豆信息真的变化时，才更新表单数据
        if (hasCoffeeBeanChanged || hasCoffeeBeanInfoChanged) {
            const updatedCoffeeBeanInfo = currentCoffeeBean
                ? {
                    name: currentCoffeeBean.name || '',
                    roastLevel: normalizeRoastLevel(currentCoffeeBean.roastLevel || '中度烘焙'),
                }
                : currentCoffeeBeanInfo
                    ? {
                        name: currentCoffeeBeanInfo.name || '',
                        roastLevel: normalizeRoastLevel(currentCoffeeBeanInfo.roastLevel || '中度烘焙'),
                    }
                    : {
                        name: '',
                        roastLevel: '中度烘焙'
                    };
            
            setFormData(prev => ({
                ...prev,
                coffeeBeanInfo: updatedCoffeeBeanInfo
            }));
        }
        
        // 检查其他字段变化
        const hasOtherDataChanged = 
            (prevInitialDataRef.current.rating !== initialData.rating) ||
            (prevInitialDataRef.current.notes !== initialData.notes) ||
            (prevInitialDataRef.current.image !== initialData.image) ||
            JSON.stringify(prevInitialDataRef.current.taste) !== JSON.stringify(initialData.taste);
            
        if (hasOtherDataChanged) {
            setFormData(prev => ({
                ...prev,
                image: typeof initialData.image === 'string' ? initialData.image : prev.image,
                rating: initialData.rating || prev.rating,
                taste: {
                    acidity: initialData.taste?.acidity ?? prev.taste.acidity,
                    sweetness: initialData.taste?.sweetness ?? prev.taste.sweetness,
                    bitterness: initialData.taste?.bitterness ?? prev.taste.bitterness,
                    body: initialData.taste?.body ?? prev.taste.body
                },
                notes: initialData.notes || prev.notes
            }));
        }
        
        // 检查方法参数变化
        const hasParamsChanged = JSON.stringify(prevInitialDataRef.current.params) !== JSON.stringify(initialData.params);
        
        if (hasParamsChanged && initialData.params) {
            setMethodParams(initialData.params);
        }
        
        // 更新引用
        prevInitialDataRef.current = initialData;
    }, [initialData]);

    const [currentValue, setCurrentValue] = useState<number | null>(null)

    const handleTouchStart = (key: string, value: number) => (e: React.TouchEvent) => {
        e.preventDefault()
        e.stopPropagation()
        setCurrentValue(value)
    }

    const handleTouchMove = (key: string) => (e: React.TouchEvent) => {
        if (currentValue === null) return

        const touch = e.touches[0]
        const target = e.currentTarget as HTMLInputElement
        const rect = target.getBoundingClientRect()
        const width = rect.width
        const x = touch.clientX - rect.left
        const percentage = Math.max(0, Math.min(1, x / width))
        const newValue = Math.round(percentage * 5)

        if (newValue !== currentValue) {
            setFormData({
                ...formData,
                taste: {
                    ...formData.taste,
                    [key]: newValue,
                },
            })
            setCurrentValue(newValue)
        }
    }

    const handleTouchEnd = () => {
        setCurrentValue(null)
    }

    useEffect(() => {
        // 添加全局触摸事件处理
        document.addEventListener('touchend', handleTouchEnd)

        return () => {
            document.removeEventListener('touchend', handleTouchEnd)
        }
    }, [])

    // 处理咖啡粉量变化
    const handleCoffeeChange = (value: string) => {
        const newMethodParams = {
            ...methodParams,
            coffee: value,
        };
        
        // 根据新的咖啡粉量和当前粉水比计算水量
        const coffeeMatch = value.match(/(\d+(\.\d+)?)/);
        const ratioMatch = methodParams.ratio.match(/1:(\d+(\.\d+)?)/);
        
        if (coffeeMatch && ratioMatch) {
            const coffeeValue = parseFloat(coffeeMatch[0]);
            const ratioValue = parseFloat(ratioMatch[1]);
            
            if (!isNaN(coffeeValue) && !isNaN(ratioValue) && coffeeValue > 0) {
                const waterValue = Math.round(coffeeValue * ratioValue);
                newMethodParams.water = `${waterValue}g`;
            }
        }
        
        setMethodParams(newMethodParams);
    };

    // Inside the component, add a new state for showing/hiding flavor ratings
    const [showFlavorRatings, setShowFlavorRatings] = useState(() => {
        // 初始化时检查是否有任何风味评分大于0
        const hasTasteValues = initialData?.taste && (
            (initialData.taste.acidity > 0) || 
            (initialData.taste.sweetness > 0) || 
            (initialData.taste.bitterness > 0) || 
            (initialData.taste.body > 0)
        );
        
        // 如果有风味评分，默认展开
        return hasTasteValues || false;
    });
    
    // 监听风味评分变化
    useEffect(() => {
        // 检查任何风味评分是否大于0
        const hasTasteValues = 
            formData.taste.acidity > 0 || 
            formData.taste.sweetness > 0 || 
            formData.taste.bitterness > 0 || 
            formData.taste.body > 0;
        
        // 如果有任何风味评分大于0，自动展开风味评分区域
        if (hasTasteValues && !showFlavorRatings) {
            setShowFlavorRatings(true);
        }
    }, [formData.taste, showFlavorRatings]);

    // 处理图片上传
    const handleImageUpload = async (file: File) => {
        try {
            if (!file.type.startsWith('image/')) return;
            
            const reader = new FileReader();
            
            const readerTimeout = setTimeout(() => {
                try {
                    const objectUrl = URL.createObjectURL(file);
                    setFormData(prev => ({...prev, image: objectUrl}));
                    setTimeout(() => URL.revokeObjectURL(objectUrl), 30000);
                } catch (_error) {
                    console.error('处理图片失败');
                }
            }, 5000);
            
            reader.onloadend = async () => {
                clearTimeout(readerTimeout);
                try {
                    const originalBase64 = reader.result as string;
                    
                    if (!originalBase64 || typeof originalBase64 !== 'string') return;
                    
                    try {
                        const compressedBase64 = await compressBase64(originalBase64, 0.5, 800);
                        setFormData(prev => ({...prev, image: compressedBase64}));
                    } catch (_error) {
                        setFormData(prev => ({...prev, image: originalBase64}));
                    }
                } catch (_error) {
                    try {
                        const objectUrl = URL.createObjectURL(file);
                        setFormData(prev => ({...prev, image: objectUrl}));
                        setTimeout(() => URL.revokeObjectURL(objectUrl), 30000);
                    } catch (error) {
                        console.error('处理图片失败', error);
                    }
                }
            };
            
            reader.onerror = () => {
                clearTimeout(readerTimeout);
                try {
                    const objectUrl = URL.createObjectURL(file);
                    setFormData(prev => ({...prev, image: objectUrl}));
                    setTimeout(() => URL.revokeObjectURL(objectUrl), 30000);
                } catch (error) {
                    console.error('处理图片失败', error);
                }
            };
            
            reader.readAsDataURL(file);
        } catch (_error) {
            console.error('处理图片失败', _error);
        }
    };
    
    // 处理图片选择逻辑 (相册或拍照)
    const handleImageSelect = (source: 'camera' | 'gallery') => {
        try {
            const fileInput = document.createElement('input');
            fileInput.type = 'file';
            fileInput.accept = 'image/*';
            
            // 根据来源设置不同的capture属性
            if (source === 'camera') {
                fileInput.setAttribute('capture', 'environment');
            }
            
            fileInput.onchange = (e) => {
                const input = e.target as HTMLInputElement;
                if (!input.files || input.files.length === 0) return;
                
                const file = input.files[0];
                if (file.type.startsWith('image/')) {
                    // 先预览一下图片，以便用户知道已经选择了图片
                    const tempUrl = URL.createObjectURL(file);
                    // 临时设置图片预览
                    setFormData(prev => ({
                        ...prev,
                        image: tempUrl
                    }));
                    // 然后正常处理添加
                    handleImageUpload(file);
                    // 释放URL对象
                    setTimeout(() => URL.revokeObjectURL(tempUrl), 5000);
                }
            };
            fileInput.click();
        } catch (error) {
            console.error('打开相机/相册失败:', error);
        }
    };

    // 保存笔记的处理函数
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()

        // 创建完整的笔记数据
        const noteData: BrewingNoteData = {
            id: id || Date.now().toString(),
            timestamp: Date.now(),
            ...formData,
            equipment: initialData.equipment,
            method: initialData.method,
            params: methodParams,
            totalTime: initialData.totalTime,
        };

        try {
            // 保存笔记
            onSave(noteData);
            
            // 如果提供了保存成功的回调，则调用它
            if (onSaveSuccess) {
                onSaveSuccess();
            }
        } catch (error) {
            console.error('保存笔记时出错:', error);
            alert('保存笔记时出错，请重试');
        }
    }

    if (!isOpen) return null

    // 动态设置容器 padding，在冲煮页面时不需要额外 padding
    // 当hideHeader为true时，添加足够的顶部边距，确保表单内容不会位于导航栏下面
    const containerClassName = `relative flex flex-col ${!inBrewPage ? 'p-6 pt-6' : ''} ${hideHeader ? 'pt-6' : ''} h-full overflow-y-auto overscroll-contain`;

    return (
        <form 
            id={id} 
            ref={formRef}
            onSubmit={handleSubmit}
            className={containerClassName}
        >
            {/* 根据hideHeader属性决定是否显示头部 */}
            {!hideHeader && (
                <div className="shrink-0 mb-4">
                    <NoteFormHeader
                        isEditMode={!!initialData?.id}
                        onBack={onClose}
                        onSave={() => formRef.current?.requestSubmit()}
                        showSaveButton={showSaveButton}
                    />
                </div>
            )}

            {/* Form content - 更新内容区域样式以确保正确滚动 */}
            <div className="grow space-y-6 pb-20">
                {/* 笔记图片 */}
                <div className="space-y-2 w-full">
                    <label className="block text-[10px] tracking-widest text-neutral-500 dark:text-neutral-400">
                        笔记图片
                    </label>
                    <div className="flex items-center justify-center relative">
                        <div className="w-32 h-32 rounded-lg border-2 border-dashed border-neutral-300 dark:border-neutral-700 flex flex-col items-center justify-center overflow-hidden relative">
                            {formData.image ? (
                                <div className="relative w-full h-full">
                                    <Image
                                        src={formData.image}
                                        alt="笔记图片"
                                        className="object-contain"
                                        fill
                                        sizes="(max-width: 768px) 100vw, 300px"
                                    />
                                    {/* 操作按钮组 */}
                                    <div className="absolute top-1 right-1 flex space-x-1">
                                        {/* 删除按钮 */}
                                        <button
                                            type="button"
                                            className="w-6 h-6 bg-neutral-800 dark:bg-neutral-200 text-white dark:text-neutral-800 rounded-full flex items-center justify-center shadow-md hover:bg-red-500 dark:hover:bg-red-500 dark:hover:text-white transition-colors z-10"
                                            onClick={() => setFormData(prev => ({...prev, image: ''}))}
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                                                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                            </svg>
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-between h-full w-full">
                                    <div className="flex-1 flex flex-col items-center justify-center">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-neutral-400 dark:text-neutral-600 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                        </svg>
                                        <span className="text-xs text-neutral-500 dark:text-neutral-400">选择图片</span>
                                        <span className="text-[9px] text-neutral-400 dark:text-neutral-500 mt-1">200kb以上将自动压缩</span>
                                    </div>
                                    
                                    {/* 图片上传按钮组 */}
                                    <div className="flex w-full mt-auto">
                                        <button
                                            type="button"
                                            onClick={() => handleImageSelect('camera')}
                                            className="flex-1 py-1 text-xs text-neutral-600 dark:text-neutral-400 border-t-2 border-r-2 border-dashed border-neutral-300 dark:border-neutral-700"
                                        >
                                            <span className="flex items-center justify-center">
                                                <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                                                </svg>
                                                拍照
                                            </span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleImageSelect('gallery')}
                                            className="flex-1 py-1 text-xs text-neutral-600 dark:text-neutral-400 border-t-2 border-dashed border-neutral-300 dark:border-neutral-700"
                                        >
                                            <span className="flex items-center justify-center">
                                                <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                                </svg>
                                                相册
                                            </span>
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* 咖啡豆信息 */}
                <div className="space-y-4">
                    <div className="text-[10px] tracking-widest text-neutral-500 dark:text-neutral-400">
                        咖啡豆信息
                    </div>
                    <div className="grid gap-6">
                        <div className="grid grid-cols-2 gap-6">
                            <div>
                                <input
                                    type="text"
                                    value={formData.coffeeBeanInfo.name}
                                    onChange={(e) =>
                                        setFormData({
                                            ...formData,
                                            coffeeBeanInfo: {
                                                ...formData.coffeeBeanInfo,
                                                name: e.target.value,
                                            },
                                        })
                                    }
                                    className="w-full border-b border-neutral-200 bg-transparent py-2 text-xs outline-hidden transition-colors focus:border-neutral-400 dark:border-neutral-800 dark:focus:border-neutral-600 placeholder:text-neutral-300 dark:placeholder:text-neutral-600 text-neutral-800 dark:text-neutral-300 rounded-none"
                                    placeholder="咖啡豆名称"
                                />
                            </div>
                            <div>
                                <select
                                    value={formData.coffeeBeanInfo.roastLevel}
                                    onChange={(e) =>
                                        setFormData({
                                            ...formData,
                                            coffeeBeanInfo: {
                                                ...formData.coffeeBeanInfo,
                                                roastLevel: e.target.value,
                                            },
                                        })
                                    }
                                    className="w-full border-b border-neutral-200 bg-transparent py-2 text-xs outline-hidden transition-colors focus:border-neutral-400 dark:border-neutral-800 dark:focus:border-neutral-600 text-neutral-800 dark:text-neutral-300"
                                >
                                    <option value="极浅烘焙">极浅烘焙</option>
                                    <option value="浅度烘焙">浅度烘焙</option>
                                    <option value="中浅烘焙">中浅烘焙</option>
                                    <option value="中度烘焙">中度烘焙</option>
                                    <option value="中深烘焙">中深烘焙</option>
                                    <option value="深度烘焙">深度烘焙</option>
                                </select>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 添加方案参数编辑 - 只在编辑记录时显示 */}
                {initialData?.id && (
                <div className="space-y-4">
                    <div className="text-[10px] tracking-widest text-neutral-500 dark:text-neutral-400">
                        方案参数
                    </div>
                    <div className="grid grid-cols-2 gap-6">
                        <div>
                            <input
                                type="text"
                                value={methodParams.coffee}
                                onChange={(e) => handleCoffeeChange(e.target.value)}
                                className="w-full border-b border-neutral-200 bg-transparent py-2 text-xs outline-hidden transition-colors focus:border-neutral-400 dark:border-neutral-800 dark:focus:border-neutral-600 placeholder:text-neutral-300 dark:placeholder:text-neutral-600 text-neutral-800 dark:text-neutral-300 rounded-none"
                                placeholder="咖啡粉量 (如: 15g)"
                            />
                        </div>
                        <div>
                            <input
                                type="text"
                                value={methodParams.ratio}
                                onChange={(e) => {
                                    const newRatio = e.target.value;
                                    const newMethodParams = {
                                        ...methodParams,
                                        ratio: newRatio,
                                    };
                                    
                                    // 根据新的粉水比和当前咖啡粉量计算水量
                                    const coffeeMatch = methodParams.coffee.match(/(\d+(\.\d+)?)/);
                                    if (coffeeMatch && newRatio) {
                                        const coffeeValue = parseFloat(coffeeMatch[0]);
                                        const ratioValue = parseFloat(newRatio.replace('1:', ''));
                                        if (!isNaN(coffeeValue) && !isNaN(ratioValue) && coffeeValue > 0) {
                                            const waterValue = Math.round(coffeeValue * ratioValue);
                                            newMethodParams.water = `${waterValue}g`;
                                        }
                                    }
                                    
                                    setMethodParams(newMethodParams);
                                }}
                                className="w-full border-b border-neutral-200 bg-transparent py-2 text-xs outline-hidden transition-colors focus:border-neutral-400 dark:border-neutral-800 dark:focus:border-neutral-600 placeholder:text-neutral-300 dark:placeholder:text-neutral-600 text-neutral-800 dark:text-neutral-300 rounded-none"
                                placeholder="粉水比 (如: 1:15)"
                            />
                        </div>
                    </div>
                    <div className="grid grid-cols-3 gap-6">
                        <div>
                            <input
                                type="text"
                                value={methodParams.grindSize}
                                onChange={(e) => setMethodParams({...methodParams, grindSize: e.target.value})}
                                className="w-full border-b border-neutral-200 bg-transparent py-2 text-xs outline-hidden transition-colors focus:border-neutral-400 dark:border-neutral-800 dark:focus:border-neutral-600 placeholder:text-neutral-300 dark:placeholder:text-neutral-600 text-neutral-800 dark:text-neutral-300 rounded-none"
                                placeholder="研磨度 (如: 中细)"
                            />
                        </div>
                        <div>
                            <input
                                type="text"
                                value={methodParams.temp}
                                onChange={(e) => setMethodParams({...methodParams, temp: e.target.value})}
                                className="w-full border-b border-neutral-200 bg-transparent py-2 text-xs outline-hidden transition-colors focus:border-neutral-400 dark:border-neutral-800 dark:focus:border-neutral-600 placeholder:text-neutral-300 dark:placeholder:text-neutral-600 text-neutral-800 dark:text-neutral-300 rounded-none"
                                placeholder="水温 (如: 92°C)"
                            />
                        </div>
                    </div>
                </div>
                )}

                {/* 风味评分 */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="text-[10px] tracking-widest text-neutral-500 dark:text-neutral-400">
                            风味评分
                        </div>
                        <button
                            type="button"
                            onClick={() => setShowFlavorRatings(!showFlavorRatings)}
                            className="text-[10px] tracking-widest text-neutral-600 dark:text-neutral-400"
                        >
                            [ {showFlavorRatings ? '收起' : '展开'} ]
                        </button>
                    </div>
                    
                    {showFlavorRatings && (
                        <div className="grid grid-cols-2 gap-8">
                            {Object.entries(formData.taste).map(([key, value]) => (
                                <div key={key} className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <div className="text-[10px] tracking-widest text-neutral-500 dark:text-neutral-400">
                                            {
                                                {
                                                    acidity: '酸度',
                                                    sweetness: '甜度',
                                                    bitterness: '苦度',
                                                    body: '口感',
                                                }[key]
                                            }
                                        </div>
                                        <div className="text-[10px] tracking-widest text-neutral-600 dark:text-neutral-400">
                                            [ {value || 0} ]
                                        </div>
                                    </div>
                                    <div className="relative py-4 -my-4">
                                        <input
                                            type="range"
                                            min="0"
                                            max="5"
                                            step="1"
                                            value={value || 0}
                                            onChange={(e) =>
                                                setFormData({
                                                    ...formData,
                                                    taste: {
                                                        ...formData.taste,
                                                        [key]: parseInt(e.target.value),
                                                    },
                                                })
                                            }
                                            onTouchStart={handleTouchStart(key, value)}
                                            onTouchMove={handleTouchMove(key)}
                                            onTouchEnd={handleTouchEnd}
                                            className="relative h-px w-full appearance-none bg-neutral-300 dark:bg-neutral-600 cursor-pointer touch-none 
                                            [&::-webkit-slider-thumb]:h-4 
                                            [&::-webkit-slider-thumb]:w-4
                                            [&::-webkit-slider-thumb]:appearance-none 
                                            [&::-webkit-slider-thumb]:rounded-full 
                                            [&::-webkit-slider-thumb]:border 
                                            [&::-webkit-slider-thumb]:border-solid
                                            [&::-webkit-slider-thumb]:border-neutral-300
                                            [&::-webkit-slider-thumb]:bg-neutral-50
                                            dark:[&::-webkit-slider-thumb]:border-neutral-600
                                            dark:[&::-webkit-slider-thumb]:bg-neutral-900
                                            
                                            [&::-moz-range-thumb]:h-4 
                                            [&::-moz-range-thumb]:w-4
                                            [&::-moz-range-thumb]:appearance-none 
                                            [&::-moz-range-thumb]:rounded-full 
                                            [&::-moz-range-thumb]:border
                                            [&::-moz-range-thumb]:border-solid
                                            [&::-moz-range-thumb]:border-neutral-300
                                            [&::-moz-range-thumb]:bg-neutral-50
                                            dark:[&::-moz-range-thumb]:border-neutral-600
                                            dark:[&::-moz-range-thumb]:bg-neutral-900"
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* 总体评分 */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="text-[10px] tracking-widest text-neutral-500 dark:text-neutral-400">
                            总体评分
                        </div>
                        <div className="text-[10px] tracking-widest text-neutral-600 dark:text-neutral-400">
                            [ {formData.rating.toFixed(1)} ]
                        </div>
                    </div>
                    <div className="relative py-3">
                        {/* 滑块 - 参考风味评分的滑块实现 */}
                        <div className="relative py-4 -my-4" ref={sliderRef}>
                            <input
                                type="range"
                                min="1"
                                max="5"
                                step="0.5"
                                value={formData.rating}
                                onChange={(e) =>
                                    setFormData({
                                        ...formData,
                                        rating: parseFloat(e.target.value),
                                    })
                                }
                                onTouchStart={handleRatingTouchStart(formData.rating)}
                                onTouchMove={handleRatingTouchMove}
                                onTouchEnd={handleRatingTouchEnd}
                                className="relative h-px w-full appearance-none bg-neutral-300 dark:bg-neutral-600 cursor-pointer touch-none 
                                [&::-webkit-slider-thumb]:h-4 
                                [&::-webkit-slider-thumb]:w-4
                                [&::-webkit-slider-thumb]:appearance-none 
                                [&::-webkit-slider-thumb]:rounded-full 
                                [&::-webkit-slider-thumb]:border 
                                [&::-webkit-slider-thumb]:border-solid
                                [&::-webkit-slider-thumb]:border-neutral-300
                                [&::-webkit-slider-thumb]:bg-neutral-50
                                dark:[&::-webkit-slider-thumb]:border-neutral-500
                                dark:[&::-webkit-slider-thumb]:bg-neutral-900
                                
                                [&::-moz-range-thumb]:h-4 
                                [&::-moz-range-thumb]:w-4
                                [&::-moz-range-thumb]:appearance-none 
                                [&::-moz-range-thumb]:rounded-full 
                                [&::-moz-range-thumb]:border
                                [&::-moz-range-thumb]:border-solid
                                [&::-moz-range-thumb]:border-neutral-300
                                [&::-moz-range-thumb]:bg-neutral-50
                                dark:[&::-moz-range-thumb]:border-neutral-500
                                dark:[&::-moz-range-thumb]:bg-neutral-900"
                            />
                        </div>
                    </div>
                </div>

                {/* 笔记 */}
                <div className="space-y-4">
                    <div className="text-[10px] tracking-widest text-neutral-500 dark:text-neutral-400">
                        笔记
                    </div>
                    <AutoResizeTextarea
                        value={formData.notes}
                        onChange={(e) =>
                            setFormData({
                                ...formData,
                                notes: e.target.value,
                            })
                        }
                        className="text-xs border-b border-neutral-200 focus:border-neutral-400 dark:border-neutral-800 dark:focus:border-neutral-600 placeholder:text-neutral-300 dark:placeholder:text-neutral-600 text-neutral-800 dark:text-neutral-300 pb-4"
                        placeholder="记录一下这次冲煮的感受、改进点等..."
                    />
                </div>
            </div>
        </form>
    )
}

export default BrewingNoteForm 