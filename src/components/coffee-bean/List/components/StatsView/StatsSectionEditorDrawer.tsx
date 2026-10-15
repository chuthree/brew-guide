'use client';

import React, { useEffect, useState } from 'react';
import { Drawer } from 'vaul';
import { Reorder, useDragControls } from 'framer-motion';
import { GripVertical } from 'lucide-react';
import SettingToggle from '@/components/settings/atomic/SettingToggle';
import { useModalHistory } from '@/lib/hooks/useModalHistory';
import { useThemeColor } from '@/lib/hooks/useThemeColor';
import { StatsViewSectionPreference } from '../../preferences';

export interface StatsSectionOption extends StatsViewSectionPreference {
  label: string;
}

interface StatsSectionEditorDrawerProps {
  isOpen: boolean;
  title: string;
  sections: StatsSectionOption[];
  onClose: () => void;
  onChange: (sections: StatsSectionOption[]) => void;
}

interface StatsSectionRowProps {
  section: StatsSectionOption;
  isLast: boolean;
  onVisibilityChange: (key: string, visible: boolean) => void;
  onDragStateChange: (isDragging: boolean) => void;
}

const StatsSectionRow: React.FC<StatsSectionRowProps> = ({
  section,
  isLast,
  onVisibilityChange,
  onDragStateChange,
}) => {
  const dragControls = useDragControls();

  const startDrag = (event: React.PointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    onDragStateChange(true);
    dragControls.start(event);
  };

  return (
    <Reorder.Item
      value={section}
      dragControls={dragControls}
      dragListener={false}
      className="px-3.5 select-none"
      style={{ listStyle: 'none' }}
      onDragStart={() => onDragStateChange(true)}
      onDragEnd={() => onDragStateChange(false)}
      whileDrag={{
        scale: 1.01,
        transition: { duration: 0.1 },
      }}
    >
      <div
        className={`flex items-center gap-3 py-1 select-none ${
          isLast ? '' : 'border-b border-black/5 dark:border-white/5'
        }`}
      >
        <button
          type="button"
          aria-label={`拖动调整 ${section.label} 排序`}
          title="拖动排序"
          onPointerDown={startDrag}
          onPointerUp={() => onDragStateChange(false)}
          onPointerCancel={() => onDragStateChange(false)}
          className="-ml-2 flex size-10 shrink-0 cursor-grab touch-none items-center justify-center rounded-lg text-neutral-400 transition-[background-color,transform] select-none active:scale-[0.96] active:cursor-grabbing active:bg-black/5 dark:text-neutral-500 dark:active:bg-white/5"
          data-vaul-no-drag
        >
          <GripVertical className="size-4" strokeWidth={2.25} />
        </button>

        <span className="min-w-0 flex-1 truncate text-sm font-medium text-neutral-900 select-none dark:text-neutral-100">
          {section.label}
        </span>

        <SettingToggle
          checked={section.visible}
          onChange={visible => onVisibilityChange(section.key, visible)}
        />
      </div>
    </Reorder.Item>
  );
};

const StatsSectionEditorDrawer: React.FC<StatsSectionEditorDrawerProps> = ({
  isOpen,
  title,
  sections,
  onClose,
  onChange,
}) => {
  const [draftSections, setDraftSections] =
    useState<StatsSectionOption[]>(sections);
  const [isDraggingSection, setIsDraggingSection] = useState(false);

  const themeColorOverlayRef = useThemeColor({
    useOverlay: true,
    enabled: isOpen,
  });

  useModalHistory({
    id: 'stats-section-editor',
    isOpen,
    onClose,
  });

  useEffect(() => {
    if (isOpen) {
      setDraftSections(sections);
    }
  }, [isOpen, sections]);

  const isDraggingActive = isOpen && isDraggingSection;

  const updateDraftSections = (nextSections: StatsSectionOption[]) => {
    setDraftSections(nextSections);
  };

  const handleVisibilityChange = (key: string, visible: boolean) => {
    updateDraftSections(
      draftSections.map(section =>
        section.key === key ? { ...section, visible } : section
      )
    );
  };

  const handleCancel = () => {
    setIsDraggingSection(false);
    setDraftSections(sections);
    onClose();
  };

  const handleDone = () => {
    setIsDraggingSection(false);
    onChange(draftSections);
    onClose();
  };

  return (
    <Drawer.Root
      open={isOpen}
      onOpenChange={open => !open && handleCancel()}
      repositionInputs={false}
    >
      <Drawer.Portal>
        <Drawer.Overlay
          ref={themeColorOverlayRef}
          className="fixed inset-0 z-50 bg-black/50"
        />
        <Drawer.Content
          className="fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[82vh] max-w-md flex-col rounded-t-3xl bg-neutral-50 outline-none select-none dark:bg-neutral-900"
          style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
          aria-describedby={undefined}
        >
          <div className="flex min-h-0 flex-col">
            <div className="flex shrink-0 items-center justify-between px-6 py-5">
              <button
                type="button"
                onClick={handleCancel}
                className="min-h-10 min-w-16 cursor-pointer rounded-full bg-neutral-100 px-4 text-sm font-medium text-neutral-600 transition-transform active:scale-[0.96] dark:bg-neutral-800 dark:text-neutral-300"
              >
                取消
              </button>
              <Drawer.Title className="truncate px-3 text-center text-base font-semibold text-neutral-900 dark:text-neutral-50">
                {title}
              </Drawer.Title>
              <button
                type="button"
                onClick={handleDone}
                className="min-h-10 min-w-16 cursor-pointer rounded-full bg-neutral-100 px-4 text-sm font-semibold text-neutral-800 transition-transform active:scale-[0.96] dark:bg-neutral-800 dark:text-neutral-100"
              >
                完成
              </button>
            </div>

            <div
              className={`min-h-0 px-6 pb-6 ${
                isDraggingActive
                  ? 'touch-none overflow-y-hidden'
                  : 'overflow-y-auto overscroll-contain'
              }`}
              data-vaul-no-drag
            >
              <div className="overflow-hidden rounded-xl bg-neutral-100 select-none dark:bg-neutral-800/40">
                <Reorder.Group
                  axis="y"
                  values={draftSections}
                  onReorder={updateDraftSections}
                  className="m-0 list-none p-0 select-none"
                >
                  {draftSections.map((section, index) => (
                    <StatsSectionRow
                      key={section.key}
                      section={section}
                      isLast={index === draftSections.length - 1}
                      onVisibilityChange={handleVisibilityChange}
                      onDragStateChange={setIsDraggingSection}
                    />
                  ))}
                </Reorder.Group>
              </div>
            </div>
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
};

export default StatsSectionEditorDrawer;
