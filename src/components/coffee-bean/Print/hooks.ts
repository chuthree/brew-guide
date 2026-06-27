import { useState, useEffect, useCallback } from 'react';
import { CoffeeBean } from '@/types/app';
import { PrintConfig, PresetSize, EditableContent } from './types';
import {
  DEFAULT_CONFIG,
  DEFAULT_PRESET_SIZES,
  clearCustomPrintPackDate,
  loadConfig,
  loadCustomPrintPackDate,
  loadDefaultPrintWeight,
  loadPrintIcon,
  loadPrintIconSource,
  loadPresetSizes,
  saveConfig,
  saveCustomPrintPackDate,
  saveDefaultPrintWeight,
  savePrintIcon,
  savePrintIconSource,
  savePresetSizes,
} from './config';
import { createInitialContent, getLocalDateString } from './utils';
import { RoasterSettings } from '@/lib/utils/beanVarietyUtils';

// ============================================
// usePrintConfig - 打印配置管理
// ============================================

export function usePrintConfig() {
  const [config, setConfig] = useState<PrintConfig>(loadConfig);
  const [presetSizes, setPresetSizes] = useState<PresetSize[]>(loadPresetSizes);

  // 通用配置更新
  const updateConfig = useCallback(
    <K extends keyof PrintConfig>(key: K, value: PrintConfig[K]) => {
      setConfig(prev => {
        const next = { ...prev, [key]: value };
        // 字体大小变化时同步更新标题字体
        if (key === 'fontSize') {
          next.titleFontSize = (value as number) + 4;
        }
        saveConfig(next);
        return next;
      });
    },
    []
  );

  // 切换字段显示
  const toggleField = useCallback((field: keyof PrintConfig['fields']) => {
    setConfig(prev => {
      const next = {
        ...prev,
        fields: { ...prev.fields, [field]: !prev.fields[field] },
      };
      saveConfig(next);
      return next;
    });
  }, []);

  // 切换方向
  const toggleOrientation = useCallback(() => {
    setConfig(prev => {
      const next = {
        ...prev,
        orientation:
          prev.orientation === 'landscape'
            ? ('portrait' as const)
            : ('landscape' as const),
      };
      saveConfig(next);
      return next;
    });
  }, []);

  // 选择预设尺寸
  const selectPresetSize = useCallback((width: number, height: number) => {
    setConfig(prev => {
      const next = { ...prev, width, height };
      saveConfig(next);
      return next;
    });
  }, []);

  // 添加预设尺寸
  const addPresetSize = useCallback((width: number, height: number) => {
    setPresetSizes(prev => {
      if (prev.some(s => s.width === width && s.height === height)) return prev;
      const next = [...prev, { label: `${width}×${height}`, width, height }];
      savePresetSizes(next);
      return next;
    });
  }, []);

  // 删除预设尺寸
  const removePresetSize = useCallback((index: number) => {
    setPresetSizes(prev => {
      const next = prev.filter((_, i) => i !== index);
      savePresetSizes(next);
      return next;
    });
  }, []);

  // 重置预设尺寸
  const resetPresetSizes = useCallback(() => {
    savePresetSizes(DEFAULT_PRESET_SIZES);
    setPresetSizes(DEFAULT_PRESET_SIZES);
  }, []);

  // 重置配置
  const resetConfig = useCallback(() => {
    saveConfig(DEFAULT_CONFIG);
    setConfig(DEFAULT_CONFIG);
  }, []);

  return {
    config,
    presetSizes,
    updateConfig,
    toggleField,
    toggleOrientation,
    selectPresetSize,
    addPresetSize,
    removePresetSize,
    resetPresetSizes,
    resetConfig,
  };
}

// ============================================
// useEditableContent - 可编辑内容管理
// ============================================

const resolveInitialPackDate = (): string => {
  const today = getLocalDateString();
  const customPackDate = loadCustomPrintPackDate();

  if (!customPackDate) {
    return today;
  }

  if (customPackDate === today) {
    clearCustomPrintPackDate();
    return today;
  }

  return customPackDate;
};

export function useEditableContent(
  bean: CoffeeBean | null,
  roasterSettings: RoasterSettings
) {
  const [content, setContent] = useState<EditableContent>(() =>
    createInitialContent(
      bean,
      roasterSettings,
      loadPrintIcon(),
      loadPrintIconSource(),
      loadDefaultPrintWeight(),
      resolveInitialPackDate()
    )
  );

  // bean 或设置变化时重新初始化
  useEffect(() => {
    setContent(
      createInitialContent(
        bean,
        roasterSettings,
        loadPrintIcon(),
        loadPrintIconSource(),
        loadDefaultPrintWeight(),
        resolveInitialPackDate()
      )
    );
  }, [
    bean,
    roasterSettings.roasterFieldEnabled,
    roasterSettings.roasterSeparator,
  ]);

  // 更新字段
  const updateField = useCallback(
    <K extends keyof EditableContent>(field: K, value: EditableContent[K]) => {
      if (field === 'weight') {
        saveDefaultPrintWeight(value as string);
      }
      if (field === 'packDate') {
        const packDate = value as string;
        if (packDate === getLocalDateString()) {
          clearCustomPrintPackDate();
        } else {
          saveCustomPrintPackDate(packDate);
        }
      }
      setContent(prev => ({ ...prev, [field]: value }));
    },
    []
  );

  // 更新并持久化打印图标
  const updateIcon = useCallback((icon: string) => {
    savePrintIcon(icon);
    setContent(prev => ({ ...prev, icon }));
  }, []);

  const updateIconSource = useCallback(
    (iconSource: EditableContent['iconSource']) => {
      savePrintIconSource(iconSource);
      setContent(prev => ({ ...prev, iconSource }));
    },
    []
  );

  // 更新风味项
  const updateFlavorItem = useCallback((index: number, value: string) => {
    setContent(prev => {
      const flavor = [...prev.flavor];
      flavor[index] = value;
      return { ...prev, flavor };
    });
  }, []);

  // 添加风味
  const addFlavor = useCallback(() => {
    setContent(prev => ({ ...prev, flavor: [...prev.flavor, ''] }));
  }, []);

  // 删除风味
  const removeFlavor = useCallback((index: number) => {
    setContent(prev => ({
      ...prev,
      flavor: prev.flavor.filter((_, i) => i !== index),
    }));
  }, []);

  // 重置内容
  const resetContent = useCallback(() => {
    setContent(
      createInitialContent(
        bean,
        roasterSettings,
        loadPrintIcon(),
        loadPrintIconSource(),
        loadDefaultPrintWeight(),
        resolveInitialPackDate()
      )
    );
  }, [bean, roasterSettings]);

  return {
    content,
    updateField,
    updateIcon,
    updateIconSource,
    updateFlavorItem,
    addFlavor,
    removeFlavor,
    resetContent,
  };
}
