import { create } from 'zustand';
import { BrewingNote } from '@/lib/core/config';

interface BrewingNoteStore {
  notes: BrewingNote[];
  isLoading: boolean;
  error: string | null;

  // Actions
  loadNotes: () => Promise<void>;
  addNote: (note: BrewingNote) => Promise<void>;
  updateNote: (id: string, updates: Partial<BrewingNote>) => Promise<void>;
  deleteNote: (id: string) => Promise<void>;
  refreshNotes: () => Promise<void>;
}

export const useBrewingNoteStore = create<BrewingNoteStore>((set, get) => ({
  notes: [],
  isLoading: false,
  error: null,

  // 加载所有笔记
  loadNotes: async () => {
    set({ isLoading: true, error: null });
    try {
      const { Storage } = await import('@/lib/core/storage');
      const savedNotes = await Storage.get('brewingNotes');
      const parsedNotes: BrewingNote[] = savedNotes
        ? JSON.parse(savedNotes)
        : [];
      set({ notes: parsedNotes, isLoading: false });
    } catch (error) {
      set({ error: '加载笔记失败', isLoading: false });
      console.error('加载笔记失败:', error);
    }
  },

    // 添加笔记
  addNote: async (note: BrewingNote) => {
    try {
      const { Storage } = await import('@/lib/core/storage');
      const currentNotes = get().notes;
      const updatedNotes = [note, ...currentNotes];
      
      await Storage.set('brewingNotes', JSON.stringify(updatedNotes));
      set({ notes: updatedNotes });
    } catch (error) {
      console.error('添加笔记失败:', error);
      throw error;
    }
  },

  // 更新笔记
  updateNote: async (id: string, updates: Partial<BrewingNote>) => {
    try {
      const { Storage } = await import('@/lib/core/storage');
      const currentNotes = get().notes;
      
      // 🔥 找到要更新的笔记索引
      const noteIndex = currentNotes.findIndex(note => note.id === id);
      
      if (noteIndex === -1) {
        return;
      }
      
      // 🔥 创建新数组，替换指定位置的笔记（确保引用改变）
      const updatedNotes = [...currentNotes];
      updatedNotes[noteIndex] = { ...currentNotes[noteIndex], ...updates };
      
      await Storage.set('brewingNotes', JSON.stringify(updatedNotes));
      set({ notes: updatedNotes });
    } catch (error) {
      throw error;
    }
  },

  // 删除笔记
  deleteNote: async (id: string) => {
    try {
      const { Storage } = await import('@/lib/core/storage');
      const currentNotes = get().notes;
      const updatedNotes = currentNotes.filter(note => note.id !== id);
      
      await Storage.set('brewingNotes', JSON.stringify(updatedNotes));
      set({ notes: updatedNotes });
    } catch (error) {
      console.error('删除笔记失败:', error);
      throw error;
    }
  },

  // 刷新笔记数据
  refreshNotes: async () => {
    await get().loadNotes();
  },
}));
