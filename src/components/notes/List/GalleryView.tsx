'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import dynamic from 'next/dynamic';
import { BrewingNote } from '@/lib/core/config';
import { formatNoteBeanDisplayName } from '@/lib/utils/beanVarietyUtils';
import { useSettingsStore } from '@/lib/stores/settingsStore';

// 动态导入 ImageViewer 组件
const ImageViewer = dynamic(
  () => import('@/components/common/ui/ImageViewer'),
  {
    ssr: false,
  }
);

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

  const [imageViewerOpen, setImageViewerOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState<{
    url: string;
    alt: string;
  } | null>(null);

  // 只显示有图片的笔记
  const notesWithImages = notes.filter(note => note.image);

  const handleImageClick = (note: BrewingNote, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isShareMode && note.image) {
      const beanName =
        formatNoteBeanDisplayName(note.coffeeBeanInfo, {
          roasterFieldEnabled,
          roasterSeparator,
        }) || '笔记图片';
      setSelectedImage({
        url: note.image,
        alt: beanName,
      });
      setImageViewerOpen(true);
    }
  };

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
                    onClick={e => handleImageClick(note, e)}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* 图片查看器 */}
      {selectedImage && (
        <ImageViewer
          id="gallery-image"
          isOpen={imageViewerOpen}
          imageUrl={selectedImage.url}
          alt={selectedImage.alt}
          onClose={() => {
            setImageViewerOpen(false);
            setSelectedImage(null);
          }}
        />
      )}
    </div>
  );
};

export default GalleryView;
