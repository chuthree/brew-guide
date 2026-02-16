'use client';

import React from 'react';
import Image from 'next/image';
import { BrewingNote } from '@/lib/core/config';
import { formatNoteBeanDisplayName } from '@/lib/utils/beanVarietyUtils';
import { useSettingsStore } from '@/lib/stores/settingsStore';

interface GalleryViewProps {
  notes: BrewingNote[];
  onNoteClick: (note: BrewingNote) => void;
  isShareMode?: boolean;
  selectedNotes?: string[];
  onToggleSelect?: (noteId: string, enterShareMode?: boolean) => void;
}

const GalleryView: React.FC<GalleryViewProps> = ({
  notes,
  onNoteClick,
  isShareMode = false,
  selectedNotes = [],
  onToggleSelect,
}) => {
  // 获取烘焙商相关设置
  const roasterFieldEnabled = useSettingsStore(
    state => state.settings.roasterFieldEnabled
  );
  const roasterSeparator = useSettingsStore(
    state => state.settings.roasterSeparator
  );

  // 只显示有图片的笔记
  const notesWithImages = notes.filter(note => note.image);

  const handleNoteClick = (note: BrewingNote) => {
    if (isShareMode && onToggleSelect) {
      onToggleSelect(note.id, !selectedNotes.includes(note.id));
    } else {
      onNoteClick(note);
    }
  };

  return (
    <div className="pb-20">
      {/* 图片数量统计 */}
      {/* <div className="px-6 py-3 text-center">
                <div className="text-xs text-neutral-500 dark:text-neutral-400">
                    共 {notesWithImages.length} 张图片
                </div>
            </div> */}

      {/* 图片网格 - 响应式布局，简洁的相册风格 */}
      <div className="grid grid-cols-3 gap-1 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        {notesWithImages.map(note => {
          const beanName =
            formatNoteBeanDisplayName(note.coffeeBeanInfo, {
              roasterFieldEnabled,
              roasterSeparator,
            }) || '未知豆子';

          return (
            <div
              key={note.id}
              className="relative aspect-square cursor-pointer"
              onClick={() => handleNoteClick(note)}
            >
              {/* 图片容器 */}
              <div className="relative h-full w-full overflow-hidden bg-neutral-100 dark:bg-neutral-800">
                {note.image && (
                  <Image
                    src={note.image}
                    alt={beanName}
                    fill
                    className="object-cover"
                    sizes="(min-width: 1280px) 16vw, (min-width: 1024px) 20vw, (min-width: 768px) 25vw, 33vw"
                    loading="lazy"
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>

    </div>
  );
};

export default GalleryView;
