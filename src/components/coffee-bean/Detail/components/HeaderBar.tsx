'use client';

import React, { useMemo } from 'react';
import { CoffeeBean } from '@/types/app';
import ActionMenu from '@/components/coffee-bean/ui/action-menu';
import { ArrowRight, ChevronLeft } from 'lucide-react';
import {
  DEFAULT_ORIGINS,
  DEFAULT_PROCESSES,
  DEFAULT_VARIETIES,
  addCustomPreset,
} from '@/components/coffee-bean/Form/constants';
import { useSettingsStore } from '@/lib/stores/settingsStore';
import { formatBeanDisplayName } from '@/lib/utils/beanVarietyUtils';

interface HeaderBarProps {
  isAddMode: boolean;
  isGreenBean: boolean;
  isTitleVisible: boolean;
  bean: CoffeeBean | null;
  tempBean: Partial<CoffeeBean>;
  printEnabled: boolean;
  onClose: () => void;
  onGoToBrewing: () => void;
  onGoToNotes: () => void;
  onGoToRoast: () => void;
  onPrint: () => void;
  onEdit?: (bean: CoffeeBean) => void;
  onDelete?: (bean: CoffeeBean) => void;
  onShare?: (bean: CoffeeBean) => void;
  onRoast?: (
    greenBean: CoffeeBean,
    roastedBeanTemplate: Omit<CoffeeBean, 'id' | 'timestamp'>
  ) => void;
  onConvertToGreen?: (bean: CoffeeBean) => void;
  onSaveNew?: (bean: Omit<CoffeeBean, 'id' | 'timestamp'>) => void;
  onShowDeleteConfirm: () => void;
}

const HeaderBar: React.FC<HeaderBarProps> = ({
  isAddMode,
  isGreenBean,
  isTitleVisible,
  bean,
  tempBean,
  printEnabled,
  onClose,
  onGoToBrewing,
  onGoToNotes,
  onGoToRoast,
  onPrint,
  onEdit,
  onDelete,
  onShare,
  onRoast,
  onConvertToGreen,
  onSaveNew,
  onShowDeleteConfirm,
}) => {
  const canSave = !!tempBean.name?.trim();

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

  // 获取显示名称
  const displayName = bean
    ? formatBeanDisplayName(bean, roasterSettings)
    : tempBean.name || '添加咖啡豆';

  const handleSave = () => {
    if (!canSave) return;

    // 保存自定义的预设值
    const components = tempBean.blendComponents || [];

    components.forEach(component => {
      if (component.origin && !DEFAULT_ORIGINS.includes(component.origin)) {
        addCustomPreset('origins', component.origin);
      }
      if (component.process && !DEFAULT_PROCESSES.includes(component.process)) {
        addCustomPreset('processes', component.process);
      }
      if (component.variety && !DEFAULT_VARIETIES.includes(component.variety)) {
        addCustomPreset('varieties', component.variety);
      }
    });

    onSaveNew?.(tempBean as Omit<CoffeeBean, 'id' | 'timestamp'>);
    onClose();
  };

  return (
    <div className="pt-safe-top sticky top-0 flex items-center gap-3 bg-neutral-50 p-4 dark:bg-neutral-900">
      {/* 左侧关闭按钮 */}
      <button
        onClick={onClose}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-neutral-100 transition-colors hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700"
      >
        <ChevronLeft className="-ml-px h-4.5 w-4.5 text-neutral-600 dark:text-neutral-400" />
      </button>

      {/* 居中标题 */}
      <div
        className={`flex min-w-0 flex-1 justify-center transition-all duration-300 ${
          isTitleVisible
            ? 'pointer-events-none opacity-0 blur-xs'
            : 'blur-0 opacity-100'
        }`}
        style={{
          transitionProperty: 'opacity, filter, transform',
          transitionTimingFunction: 'cubic-bezier(0.32, 0.72, 0, 1)',
          willChange: 'opacity, filter, transform',
        }}
      >
        <h2 className="max-w-full truncate px-2 text-center text-sm font-medium text-neutral-800 dark:text-neutral-100">
          {isAddMode ? tempBean.name || '添加咖啡豆' : displayName || '未命名'}
        </h2>
      </div>

      {/* 右侧操作按钮 */}
      <div className="flex shrink-0 items-center gap-3">
        {/* 添加模式：显示保存按钮 */}
        {isAddMode && (
          <button
            onClick={handleSave}
            disabled={!canSave}
            className={`px-3 py-1 text-xs font-medium transition-colors ${
              canSave
                ? 'text-neutral-800 dark:text-neutral-100'
                : 'cursor-not-allowed text-neutral-300 dark:text-neutral-600'
            }`}
          >
            保存
          </button>
        )}

        {/* 查看模式：生豆显示"去烘焙"按钮 */}
        {!isAddMode && bean && isGreenBean && onRoast && (
          <button
            onClick={onGoToRoast}
            className="flex h-8 items-center justify-center rounded-full bg-neutral-100 px-3 transition-colors hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700"
          >
            <span className="text-xs font-medium text-neutral-600 dark:text-neutral-400">
              去烘焙
            </span>
          </button>
        )}

        {/* 查看模式：熟豆通过菜单显示"去冲煮/去记录" */}
        {!isAddMode && bean && !isGreenBean && (
          <ActionMenu
            items={[
              {
                id: 'brewing',
                label: '去冲煮',
                onClick: onGoToBrewing,
                color: 'default' as const,
              },
              {
                id: 'notes',
                label: '去记录',
                onClick: onGoToNotes,
                color: 'default' as const,
              },
            ]}
            useMorphingAnimation={true}
            triggerClassName="w-8 h-8 rounded-full bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
            triggerChildren={
              <ArrowRight className="h-4 w-4 text-neutral-600 dark:text-neutral-400" />
            }
          />
        )}

        {/* 查看模式：原有的操作按钮 */}
        {!isAddMode &&
          bean &&
          (onEdit ||
            onShare ||
            onDelete ||
            printEnabled ||
            onConvertToGreen) && (
            <ActionMenu
              items={[
                ...(onDelete
                  ? [
                      {
                        id: 'delete',
                        label: '删除',
                        onClick: onShowDeleteConfirm,
                        color: 'danger' as const,
                      },
                    ]
                  : []),
                ...(!isGreenBean && !bean.sourceGreenBeanId && onConvertToGreen
                  ? [
                      {
                        id: 'convertToGreen',
                        label: '转为生豆',
                        onClick: () => onConvertToGreen(bean),
                        color: 'default' as const,
                      },
                    ]
                  : []),
                ...(printEnabled
                  ? [
                      {
                        id: 'print',
                        label: '打印',
                        onClick: onPrint,
                        color: 'default' as const,
                      },
                    ]
                  : []),
                ...(onShare
                  ? [
                      {
                        id: 'share',
                        label: '分享',
                        onClick: () => {
                          onClose();
                          setTimeout(() => {
                            window.dispatchEvent(
                              new CustomEvent('beanShareTriggered', {
                                detail: { beanId: bean.id },
                              })
                            );
                          }, 300);
                        },
                        color: 'default' as const,
                      },
                    ]
                  : []),
                ...(onEdit
                  ? [
                      {
                        id: 'edit',
                        label: '编辑',
                        onClick: () => onEdit(bean),
                        color: 'default' as const,
                      },
                    ]
                  : []),
              ].filter(item => item)}
              useMorphingAnimation={true}
              triggerClassName="w-8 h-8 rounded-full bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
            />
          )}
      </div>
    </div>
  );
};

export default HeaderBar;
