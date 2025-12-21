import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { CoffeeBean } from '@/types/app';
import { db } from '@/lib/core/db';
import { nanoid } from 'nanoid';

interface CoffeeBeanStore {
  beans: CoffeeBean[];
  isLoading: boolean;
  error: string | null;
  initialized: boolean;

  loadBeans: () => Promise<void>;
  addBean: (bean: Omit<CoffeeBean, 'id' | 'timestamp'>) => Promise<CoffeeBean>;
  updateBean: (
    id: string,
    updates: Partial<CoffeeBean>
  ) => Promise<CoffeeBean | null>;
  deleteBean: (id: string) => Promise<boolean>;
  setBeans: (beans: CoffeeBean[]) => void;
  upsertBean: (bean: CoffeeBean) => Promise<void>;
  removeBean: (id: string) => Promise<void>;
  getBeanById: (id: string) => CoffeeBean | undefined;
  refreshBeans: () => Promise<void>;
}

export const useCoffeeBeanStore = create<CoffeeBeanStore>()(
  subscribeWithSelector((set, get) => ({
    beans: [],
    isLoading: false,
    error: null,
    initialized: false,

    loadBeans: async () => {
      if (get().isLoading) return;

      set({ isLoading: true, error: null });
      try {
        const beans = await db.coffeeBeans.toArray();
        set({ beans, isLoading: false, initialized: true });
      } catch (error) {
        console.error('[CoffeeBeanStore] loadBeans failed:', error);
        set({ error: 'Failed to load', isLoading: false, initialized: true });
      }
    },

    addBean: async beanData => {
      const newBean: CoffeeBean = {
        ...beanData,
        id: nanoid(),
        timestamp: Date.now(),
      } as CoffeeBean;

      try {
        await db.coffeeBeans.put(newBean);
        set(state => ({ beans: [...state.beans, newBean] }));

        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('coffeeBeanDataChanged', {
              detail: { action: 'create', beanId: newBean.id, bean: newBean },
            })
          );
        }
        return newBean;
      } catch (error) {
        console.error('[CoffeeBeanStore] addBean failed:', error);
        throw error;
      }
    },

    updateBean: async (id, updates) => {
      const { beans } = get();
      const existingBean = beans.find(b => b.id === id);
      if (!existingBean) return null;

      const updatedBean: CoffeeBean = {
        ...existingBean,
        ...updates,
        id,
        timestamp: Date.now(),
      };

      try {
        await db.coffeeBeans.put(updatedBean);
        set(state => ({
          beans: state.beans.map(b => (b.id === id ? updatedBean : b)),
        }));

        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('coffeeBeanDataChanged', {
              detail: { action: 'update', beanId: id, bean: updatedBean },
            })
          );
        }
        return updatedBean;
      } catch (error) {
        console.error('[CoffeeBeanStore] updateBean failed:', error);
        throw error;
      }
    },

    deleteBean: async id => {
      try {
        await db.coffeeBeans.delete(id);
        set(state => ({
          beans: state.beans.filter(b => b.id !== id),
        }));

        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('coffeeBeanDataChanged', {
              detail: { action: 'delete', beanId: id },
            })
          );
        }
        return true;
      } catch (error) {
        console.error('[CoffeeBeanStore] deleteBean failed:', error);
        return false;
      }
    },

    setBeans: beans => {
      set({ beans, initialized: true });
    },

    upsertBean: async bean => {
      try {
        await db.coffeeBeans.put(bean);
        set(state => {
          const exists = state.beans.some(b => b.id === bean.id);
          if (exists) {
            return {
              beans: state.beans.map(b => (b.id === bean.id ? bean : b)),
            };
          } else {
            return { beans: [...state.beans, bean] };
          }
        });
      } catch (error) {
        console.error('[CoffeeBeanStore] upsertBean failed:', error);
      }
    },

    removeBean: async id => {
      try {
        await db.coffeeBeans.delete(id);
        set(state => ({ beans: state.beans.filter(b => b.id !== id) }));
      } catch (error) {
        console.error('[CoffeeBeanStore] removeBean failed:', error);
      }
    },

    getBeanById: id => {
      return get().beans.find(b => b.id === id);
    },

    refreshBeans: async () => {
      set({ initialized: false });
      await get().loadBeans();
    },
  }))
);

export const getCoffeeBeanStore = () => useCoffeeBeanStore.getState();
