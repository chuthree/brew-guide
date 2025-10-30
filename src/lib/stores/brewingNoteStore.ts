import { create } from 'zustand';
import { BrewingNote } from '@/lib/core/config';

interface BrewingNoteStore {
  notes: BrewingNote[];
  isLoading: boolean;
  error: string | null;
  initialized: boolean; // 🔥 新增：标记数据是否已初始化

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
  initialized: false, // 🔥 初始为未初始化

  // 加载所有笔记
  loadNotes: async () => {
    set({ isLoading: true, error: null });
    try {
      const { Storage } = await import('@/lib/core/storage');
      const savedNotes = await Storage.get('brewingNotes');
      const parsedNotes: BrewingNote[] = savedNotes
        ? JSON.parse(savedNotes)
        : [];
      set({ notes: parsedNotes, isLoading: false, initialized: true }); // 🔥 标记已初始化
    } catch (error) {
      set({ error: '加载笔记失败', isLoading: false, initialized: true }); // 🔥 即使失败也标记为已初始化
      console.error('加载笔记失败:', error);
    }
  },

  // 添加笔记
  addNote: async (note: BrewingNote) => {
    try {
      const { Storage } = await import('@/lib/core/storage');

      // 🔥 关键修复：如果未初始化，先加载数据
      const state = get();
      if (!state.initialized) {
        console.warn('⚠️ 检测到未初始化就尝试添加笔记，先加载现有数据...');
        const savedNotes = await Storage.get('brewingNotes');
        const existingNotes: BrewingNote[] = savedNotes
          ? JSON.parse(savedNotes)
          : [];
        // 添加新笔记到现有数据
        const updatedNotes = [note, ...existingNotes];
        await Storage.set('brewingNotes', JSON.stringify(updatedNotes));
        set({ notes: updatedNotes, initialized: true });
        return;
      }

      // 正常流程：已初始化，从内存获取
      const currentNotes = state.notes;
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

      // 🔥 关键修复：如果未初始化，先加载数据
      const state = get();
      if (!state.initialized) {
        console.warn('⚠️ 检测到未初始化就尝试更新笔记，先加载现有数据...');
        const savedNotes = await Storage.get('brewingNotes');
        const existingNotes: BrewingNote[] = savedNotes
          ? JSON.parse(savedNotes)
          : [];
        const noteIndex = existingNotes.findIndex(note => note.id === id);

        if (noteIndex !== -1) {
          existingNotes[noteIndex] = {
            ...existingNotes[noteIndex],
            ...updates,
          };
          await Storage.set('brewingNotes', JSON.stringify(existingNotes));
          set({ notes: existingNotes, initialized: true });
        }
        return;
      }

      const currentNotes = state.notes;

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

      // 🔥 关键修复：如果未初始化，先加载数据
      const state = get();
      if (!state.initialized) {
        console.warn('⚠️ 检测到未初始化就尝试删除笔记，先加载现有数据...');
        const savedNotes = await Storage.get('brewingNotes');
        const existingNotes: BrewingNote[] = savedNotes
          ? JSON.parse(savedNotes)
          : [];
        const updatedNotes = existingNotes.filter(note => note.id !== id);
        await Storage.set('brewingNotes', JSON.stringify(updatedNotes));
        set({ notes: updatedNotes, initialized: true });
        return;
      }

      const currentNotes = state.notes;
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
