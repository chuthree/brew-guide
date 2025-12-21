'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  type Method,
  type CustomEquipment,
  brewingMethods,
} from '@/lib/core/config';
import { SettingsOptions } from '@/components/settings/Settings';

interface UseMethodManagementProps {
  selectedEquipment: string;
  initialMethod?: string;
  customEquipments: CustomEquipment[];
  settings?: SettingsOptions;
}

interface UseMethodManagementResult {
  methodType: 'common' | 'custom';
  selectedMethod: string;
  availableMethods: Method[];
  customMethods: Method[];
  commonMethodsOnly: Method[]; // 新增：仅返回通用方案，不受 methodType 影响
  handleMethodTypeChange: (type: 'common' | 'custom') => void;
  setSelectedMethod: (method: string) => void;
  initMethodParams: (method: Method) => void;
}

export function useMethodManagement({
  selectedEquipment,
  initialMethod,
  customEquipments,
  settings,
}: UseMethodManagementProps): UseMethodManagementResult {
  const [methodType, setMethodType] = useState<'common' | 'custom'>('common');
  const [selectedMethod, setSelectedMethod] = useState<string>(
    initialMethod || ''
  );
  const [customMethods, setCustomMethods] = useState<Method[]>([]);

  // 计算可用方法
  const availableMethods = useMemo(() => {
    if (!selectedEquipment) {
      return [];
    }

    const customEquipment = customEquipments.find(
      e => e.id === selectedEquipment || e.name === selectedEquipment
    );
    const isCustomEquipment = !!customEquipment;
    const isCustomPresetEquipment =
      isCustomEquipment && customEquipment.animationType === 'custom';

    let methods: Method[] = [];

    if (methodType === 'common') {
      if (isCustomPresetEquipment) {
        // 自定义预设器具没有通用方案
        return [];
      } else if (isCustomEquipment) {
        // 基于预设的自定义器具
        let baseEquipmentId = '';
        if (customEquipment) {
          const animationType = customEquipment.animationType.toLowerCase();
          switch (animationType) {
            case 'v60':
              baseEquipmentId = 'V60';
              break;
            case 'clever':
              baseEquipmentId = 'CleverDripper';
              break;
            case 'espresso':
              baseEquipmentId = 'Espresso';
              break;
            default:
              baseEquipmentId = 'V60';
          }
        }
        methods = brewingMethods[baseEquipmentId] || [];
      } else {
        // 预定义器具
        methods = brewingMethods[selectedEquipment] || [];
      }

      // 过滤掉隐藏的通用方案
      if (settings && settings.hiddenCommonMethods) {
        const hiddenIds = settings.hiddenCommonMethods[selectedEquipment] || [];
        if (hiddenIds.length > 0) {
          methods = methods.filter(method => {
            const methodId = method.id || method.name;
            return !hiddenIds.includes(methodId);
          });
        }
      }

      return methods;
    } else if (methodType === 'custom') {
      // 对于自定义方案，直接使用已加载的当前设备的自定义方案列表
      return customMethods;
    }

    return [];
  }, [
    selectedEquipment,
    methodType,
    customEquipments,
    customMethods,
    settings,
  ]);

  // 计算通用方案（不受 methodType 影响，专门用于同时显示自定义和通用方案的场景）
  const commonMethodsOnly = useMemo(() => {
    if (!selectedEquipment) {
      return [];
    }

    const customEquipment = customEquipments.find(
      e => e.id === selectedEquipment || e.name === selectedEquipment
    );
    const isCustomEquipment = !!customEquipment;
    const isCustomPresetEquipment =
      isCustomEquipment && customEquipment.animationType === 'custom';

    // 如果是自定义预设器具，不返回任何通用方案
    if (isCustomPresetEquipment) {
      return [];
    }

    let methods: Method[] = [];

    if (isCustomEquipment) {
      // 基于预设的自定义器具
      let baseEquipmentId = '';
      if (customEquipment) {
        const animationType = customEquipment.animationType.toLowerCase();
        switch (animationType) {
          case 'v60':
            baseEquipmentId = 'V60';
            break;
          case 'clever':
            baseEquipmentId = 'CleverDripper';
            break;
          case 'espresso':
            baseEquipmentId = 'Espresso';
            break;
          default:
            baseEquipmentId = 'V60';
        }
      }
      methods = brewingMethods[baseEquipmentId] || [];
    } else {
      // 预定义器具
      methods = brewingMethods[selectedEquipment] || [];
    }

    // 过滤掉隐藏的通用方案
    if (settings && settings.hiddenCommonMethods) {
      const hiddenIds = settings.hiddenCommonMethods[selectedEquipment] || [];
      if (hiddenIds.length > 0) {
        methods = methods.filter(method => {
          const methodId = method.id || method.name;
          return !hiddenIds.includes(methodId);
        });
      }
    }

    return methods;
  }, [selectedEquipment, customEquipments, settings]);

  // 加载自定义方案
  useEffect(() => {
    const fetchCustomMethods = async () => {
      try {
        if (selectedEquipment) {
          // 新版API尝试加载
          try {
            const methodsModule = await import('@/lib/managers/customMethods');
            const methods =
              await methodsModule.loadCustomMethodsForEquipment(
                selectedEquipment
              );
            if (methods && methods.length > 0) {
              setCustomMethods(methods);
              return;
            }
          } catch (_error) {
            // 静默处理，继续尝试其他方式
          }

          // 尝试从localStorage加载
          const { Storage } = await import('@/lib/core/storage');
          const customMethodsStr = await Storage.get('customMethods');
          if (customMethodsStr) {
            const parsedData = JSON.parse(customMethodsStr);

            // 检查是否是按设备分组的对象格式
            if (typeof parsedData === 'object' && !Array.isArray(parsedData)) {
              if (parsedData[selectedEquipment]) {
                setCustomMethods(parsedData[selectedEquipment]);
                return;
              }
            }

            // 处理旧版扁平数组格式
            if (Array.isArray(parsedData)) {
              const filteredMethods = parsedData.filter(
                method =>
                  method &&
                  method.id &&
                  typeof method.params === 'object' &&
                  method.params.coffee &&
                  method.name
              );
              setCustomMethods(filteredMethods);
              return;
            }
          }

          // 尝试从旧版存储格式加载
          try {
            const storageKey = `customMethods_${selectedEquipment}`;
            const methodsJson = await Storage.get(storageKey);
            if (methodsJson) {
              const methods = JSON.parse(methodsJson);
              if (Array.isArray(methods) && methods.length > 0) {
                setCustomMethods(methods);
                return;
              }
            }
          } catch (_error) {
            // 静默处理
          }

          // 没有找到方案
          setCustomMethods([]);
        } else {
          // 没有选择器具时清空方案
          setCustomMethods([]);
        }
      } catch (error) {
        console.error('加载自定义方案失败:', error);
        setCustomMethods([]);
      }
    };

    fetchCustomMethods();
  }, [selectedEquipment]);

  // 监听自定义方案数据变化，确保及时更新
  useEffect(() => {
    const handleCustomMethodsChange = async (e: Event) => {
      const customEvent = e as CustomEvent;
      // 检查变化是否与当前选择的器具相关
      if (
        customEvent.detail?.equipmentId === selectedEquipment ||
        !customEvent.detail?.equipmentId
      ) {
        try {
          if (selectedEquipment) {
            const methodsModule = await import('@/lib/managers/customMethods');
            const methods =
              await methodsModule.loadCustomMethodsForEquipment(
                selectedEquipment
              );
            setCustomMethods(methods);
          }
        } catch (error) {
          console.error('响应方案变化时重新加载失败:', error);
        }
      }
    };

    // 监听自定义方案变化事件（监听多个事件名以确保兼容）
    window.addEventListener('customMethodsChanged', handleCustomMethodsChange);
    window.addEventListener(
      'customMethodDataChanged',
      handleCustomMethodsChange
    );

    return () => {
      window.removeEventListener(
        'customMethodsChanged',
        handleCustomMethodsChange
      );
      window.removeEventListener(
        'customMethodDataChanged',
        handleCustomMethodsChange
      );
    };
  }, [selectedEquipment]);

  // 处理器具变化时的方案类型调整
  useEffect(() => {
    if (selectedEquipment && customEquipments.length > 0) {
      const customEquipment = customEquipments.find(
        e => e.id === selectedEquipment
      );
      const isCustomPresetEquipment =
        customEquipment?.animationType === 'custom';

      // 如果是自定义预设器具，强制使用自定义方案类型
      if (isCustomPresetEquipment && methodType === 'common') {
        setMethodType('custom');
      }
      // 如果不是自定义预设器具，且当前是自定义方案类型，可以切换回通用方案
      else if (!isCustomPresetEquipment && methodType === 'custom') {
        // 检查是否有通用方案可用
        let hasCommonMethods = false;
        if (customEquipment) {
          // 自定义器具，检查基础器具是否有通用方案
          const animationType = customEquipment.animationType.toLowerCase();
          let baseEquipmentId = '';
          switch (animationType) {
            case 'v60':
              baseEquipmentId = 'V60';
              break;
            case 'clever':
              baseEquipmentId = 'CleverDripper';
              break;
            case 'espresso':
              baseEquipmentId = 'Espresso';
              break;
            default:
              baseEquipmentId = 'V60';
          }
          hasCommonMethods = (brewingMethods[baseEquipmentId]?.length || 0) > 0;
        } else {
          // 预定义器具
          hasCommonMethods =
            (brewingMethods[selectedEquipment]?.length || 0) > 0;
        }

        // 如果有通用方案，切换到通用方案类型
        if (hasCommonMethods) {
          setMethodType('common');
        }
      }
    }
  }, [selectedEquipment, customEquipments, methodType]);

  // 切换方案类型
  const handleMethodTypeChange = (type: 'common' | 'custom') => {
    // 检查是否是自定义预设器具
    if (selectedEquipment) {
      const customEquipment = customEquipments.find(
        e => e.id === selectedEquipment
      );
      const isCustomPresetEquipment =
        customEquipment?.animationType === 'custom';

      // 如果是自定义预设器具，只能使用自定义方案
      if (isCustomPresetEquipment && type === 'common') {
        // 强制切换到自定义方案
        if (methodType !== 'custom') {
          setMethodType('custom');
          if (customMethods.length > 0) {
            setSelectedMethod(
              customMethods[0]?.id || customMethods[0]?.name || ''
            );
          }
        }
        return;
      }
    }

    // 只有当类型实际变化时才执行操作
    if (type !== methodType) {
      setMethodType(type);

      // 确保有选择的器具
      if (!selectedEquipment) return;

      // 当切换方案类型时，根据新类型重置选中的方案
      if (type === 'common') {
        // 切换到通用方案
        const customEquipment = customEquipments.find(
          e => e.id === selectedEquipment
        );
        let targetEquipmentId = selectedEquipment;

        // 如果是自定义器具，需要找到对应的基础器具ID
        if (customEquipment) {
          const animationType = customEquipment.animationType.toLowerCase();
          switch (animationType) {
            case 'v60':
              targetEquipmentId = 'V60';
              break;
            case 'clever':
              targetEquipmentId = 'CleverDripper';
              break;
            case 'espresso':
              targetEquipmentId = 'Espresso';
              break;
            default:
              targetEquipmentId = 'V60';
          }
        }

        if (brewingMethods[targetEquipmentId]?.length > 0) {
          const firstMethod = brewingMethods[targetEquipmentId][0];
          setSelectedMethod(firstMethod.id || firstMethod.name);
        } else {
          setSelectedMethod(''); // 没有通用方案，清空选择
        }
      } else {
        // 切换到自定义方案
        if (customMethods.length > 0) {
          const firstMethod = customMethods[0];
          setSelectedMethod(firstMethod?.id || firstMethod?.name || '');
        } else {
          setSelectedMethod(''); // 没有自定义方案，清空选择
        }
      }
    }
  };

  // 初始化方法参数
  const initMethodParams = (_method: Method) => {
    // 该方法由父组件实现具体逻辑
    // 在此仅提供接口
  };

  return {
    methodType,
    selectedMethod,
    availableMethods,
    customMethods,
    commonMethodsOnly,
    handleMethodTypeChange,
    setSelectedMethod,
    initMethodParams,
  };
}
