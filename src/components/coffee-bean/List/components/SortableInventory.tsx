'use client';

import React, { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  KeyboardSensor,
  closestCenter,
  defaultDropAnimationSideEffects,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
  type DropAnimationFunction,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import { CSS } from '@dnd-kit/utilities';
import {
  animate,
  motion,
  motionValue,
  useReducedMotion,
  useTransform,
  type MotionValue,
} from 'framer-motion';
import hapticsUtils from '@/lib/ui/haptics';
import { useSettingsStore } from '@/lib/stores/settingsStore';
import { showToast } from '@/components/common/feedback/LightToast';
import type { ExtendedCoffeeBean } from '../types';

export type ReorderBeans = (
  visibleIds: string[],
  activeId: string,
  overId: string
) => Promise<void>;

const ACTIVATION = { delay: 350, tolerance: 6 };
const MODIFIERS = [restrictToVerticalAxis];
const preventNativeDrag = (event: React.SyntheticEvent) =>
  event.preventDefault();
// 保存后的顺序已完成落位，不再对索引变化补做布局动画。
const animateLayoutChanges = () => false;
const LIFT_SPRING = { type: 'spring', duration: 0.3, bounce: 0 } as const;
const hideDropTarget = defaultDropAnimationSideEffects({
  styles: { active: { opacity: '0' } },
});

interface DragPreviewData {
  id: string;
  content: HTMLElement;
  lift: MotionValue<number>;
}

function DragPreview({ preview }: { preview: DragPreviewData }) {
  const contentRef = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotion();
  const transform = useTransform(
    preview.lift,
    value => `scale(${reducedMotion ? 1 : 1 + value * 0.015})`
  );
  useLayoutEffect(() => {
    // 复用同一份视觉快照，落位交接不重新挂载豆子组件或读取图片。
    contentRef.current?.appendChild(preview.content);
  }, [preview]);

  return (
    <div className="pointer-events-none" aria-hidden="true" inert>
      <motion.div className="relative isolate" style={{ transform }}>
        <motion.div
          className="absolute -inset-2 -z-10 rounded-xl bg-white shadow-[0_4px_16px_rgb(0_0_0/0.10)] dark:bg-neutral-800 dark:shadow-[0_4px_16px_rgb(0_0_0/0.30)]"
          style={{ opacity: preview.lift }}
        />
        <div ref={contentRef} />
      </motion.div>
    </div>
  );
}

export function SortableBeanRow({
  bean,
  children,
}: {
  bean: ExtendedCoffeeBean;
  children: React.ReactNode;
}) {
  const reducedMotion = useReducedMotion();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: bean.id,
    animateLayoutChanges,
    transition: reducedMotion ? null : { duration: 180, easing: 'ease' },
  });
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      aria-label={`${bean.name || '咖啡豆'}，调整顺序`}
      aria-roledescription="可排序的咖啡豆"
      className="relative cursor-grab select-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-neutral-400"
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0 : undefined,
        WebkitTouchCallout: 'none',
      }}
      onContextMenu={preventNativeDrag}
      onDragStart={preventNativeDrag}
    >
      {children}
    </div>
  );
}

interface SortableInventoryProps {
  disabled?: boolean;
  beans: ExtendedCoffeeBean[];
  onReorder?: ReorderBeans;
  children: React.ReactNode;
}

export default function SortableInventory(props: SortableInventoryProps) {
  return props.onReorder ? (
    <SortableInventoryContext {...props} onReorder={props.onReorder} />
  ) : (
    props.children
  );
}

function SortableInventoryContext({
  disabled = false,
  beans,
  onReorder,
  children,
}: SortableInventoryProps & { onReorder: ReorderBeans }) {
  const reducedMotion = useReducedMotion();
  const [preview, setPreview] = useState<DragPreviewData | null>(null);
  const suppressClick = useRef(false);
  const dragIds = useRef<string[]>([]);
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: ACTIVATION }),
    useSensor(TouchSensor, { activationConstraint: ACTIVATION }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleClickCapture = useCallback((event: React.MouseEvent) => {
    if (suppressClick.current) {
      event.preventDefault();
      event.stopPropagation();
    }
  }, []);
  const resetClickSuppression = useCallback(() => {
    suppressClick.current = false;
  }, []);
  const handleDragStart = useCallback(
    ({ active }: DragStartEvent) => {
      suppressClick.current = true;
      dragIds.current = beans.map(bean => bean.id);
      const source = document.querySelector<HTMLElement>(
        `[data-bean-item="${window.CSS.escape(String(active.id))}"]`
      );
      if (!source) return;
      const lift = motionValue(0);
      setPreview({
        id: String(active.id),
        content: source.cloneNode(true) as HTMLElement,
        lift,
      });
      void animate(lift, 1, reducedMotion ? { duration: 0.14 } : LIFT_SPRING);
      if (useSettingsStore.getState().settings.hapticFeedback)
        void hapticsUtils.medium();
    },
    [beans, reducedMotion]
  );
  const dropAnimation = useCallback<DropAnimationFunction>(
    async args => {
      if (!preview || preview.id !== String(args.active.id)) return;
      const { active, dragOverlay, transform } = args;
      const target = CSS.Transform.toString({
        ...transform,
        x: transform.x + active.rect.left - dragOverlay.rect.left,
        y: transform.y + active.rect.top - dragOverlay.rect.top,
      });
      const cleanup = hideDropTarget(args);
      try {
        await Promise.all([
          animate(
            dragOverlay.node,
            { transform: target },
            reducedMotion ? { duration: 0 } : LIFT_SPRING
          ),
          animate(
            preview.lift,
            0,
            reducedMotion ? { duration: 0.14 } : LIFT_SPRING
          ),
        ]);
      } finally {
        cleanup?.();
        setPreview(current => (current === preview ? null : current));
      }
    },
    [preview, reducedMotion]
  );
  const cancelDrop = useCallback(
    async ({ active, over }: DragEndEvent) => {
      if (!over || active.id === over.id) return true;
      if (!beans.some(bean => bean.id === over.id)) return true;
      if (
        beans.length !== dragIds.current.length ||
        beans.some((bean, index) => bean.id !== dragIds.current[index])
      )
        return true;
      try {
        await onReorder(dragIds.current, String(active.id), String(over.id));
        return false;
      } catch {
        showToast({ type: 'error', title: '排序保存失败，请重试' });
        return true;
      }
    },
    [beans, onReorder]
  );

  return (
    <div
      onClickCapture={handleClickCapture}
      onPointerDownCapture={resetClickSuppression}
      onKeyDownCapture={resetClickSuppression}
    >
      <DndContext
        sensors={sensors}
        modifiers={MODIFIERS}
        collisionDetection={closestCenter}
        accessibility={{
          screenReaderInstructions: {
            draggable:
              '按空格开始排序，使用上下方向键移动，再按空格保存，按 Escape 取消。',
          },
          announcements: {
            onDragStart: ({ active }) =>
              `开始移动${beans.find(bean => bean.id === active.id)?.name || '咖啡豆'}。`,
            onDragOver: ({ over }) =>
              over
                ? `移动到${beans.find(bean => bean.id === over.id)?.name || '咖啡豆'}的位置。`
                : '当前位置不能放置。',
            onDragEnd: () => '拖动结束。',
            onDragCancel: () => '已取消排序。',
          },
        }}
        onDragStart={handleDragStart}
        cancelDrop={cancelDrop}
      >
        <SortableContext
          items={beans.map(bean => bean.id)}
          strategy={verticalListSortingStrategy}
          disabled={disabled}
        >
          {children}
        </SortableContext>
        {typeof document !== 'undefined' &&
          createPortal(
            <DragOverlay dropAnimation={dropAnimation}>
              {preview && <DragPreview preview={preview} />}
            </DragOverlay>,
            document.body
          )}
      </DndContext>
    </div>
  );
}
