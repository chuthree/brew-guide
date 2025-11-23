import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import {
  SettingsOptions,
  defaultSettings,
} from '@/components/settings/Settings';

interface SettingsState {
  settings: SettingsOptions;
  setSettings: (settings: SettingsOptions) => void;
  updateSettings: (key: keyof SettingsOptions, value: any) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    set => ({
      settings: defaultSettings,
      setSettings: newSettings => set({ settings: newSettings }),
      updateSettings: (key, value) =>
        set(state => ({
          settings: {
            ...state.settings,
            [key]: value,
          },
        })),
    }),
    {
      name: 'brewGuideSettings', // 保持与原有 key 一致，或者需要迁移数据
      storage: createJSONStorage(() => localStorage), // 使用 localStorage 进行同步读取
      // 可以在这里处理版本迁移等
    }
  )
);
