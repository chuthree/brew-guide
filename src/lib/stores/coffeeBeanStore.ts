import {
  coordinateStoreActions,
  registerCoordinatedAction,
  callStoreActionInMutation,
} from '@/lib/data/storeMutationBoundary';
import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { CoffeeBean } from '@/types/app';
import {
  coffeeBeanImageRepository,
  coffeeBeanPersistence,
  coffeeBeanRepository,
} from '@/lib/data/repositories';
import { nanoid } from 'nanoid';
import {
  findCoffeeBeanByDisplayName,
  findCoffeeBeanByIdentity,
  normalizeCoffeeBean,
  normalizeCoffeeBeans,
} from '@/lib/utils/coffeeBeanUtils';
import { recordCrashCheckpoint } from '@/lib/app/crashDiagnostics';
import {
  clearExpectedCoreDataDeletion,
  markExpectedCoreDataDeletionIfEmpty,
} from '@/lib/app/dataIntegrity';
import { stripCoffeeBeanImages } from '@/lib/coffee-beans/imageRecords';
import { withDataMutation } from '@/lib/data/mutationCoordinator';
import {
  formatCoffeeBeanAmount,
  parseCoffeeBeanAmount,
} from '@/lib/coffee-beans/amount';
export { formatCoffeeBeanAmount } from '@/lib/coffee-beans/amount';

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
  setBeans: (beans: CoffeeBean[], initialized?: boolean) => void;
  upsertBean: (bean: CoffeeBean) => Promise<void>;
  removeBean: (id: string) => Promise<void>;
  getBeanById: (id: string) => CoffeeBean | undefined;
  refreshBeans: () => Promise<void>;
}

const collectBeanPayloadMetrics = (beans: CoffeeBean[]) => {
  let imageBeanCount = 0;
  let inlineImageChars = 0;

  for (const bean of beans) {
    if (bean.image) {
      imageBeanCount += 1;
      inlineImageChars += bean.image.length;
    }

    if (bean.backImage) {
      inlineImageChars += bean.backImage.length;
    }
  }

  return {
    beanCount: beans.length,
    imageBeanCount,
    inlineImageChars,
  };
};

const getImageRecordCountForDiagnostics = async (): Promise<
  number | undefined
> => {
  try {
    return (await coffeeBeanImageRepository.getRecordCounts()).records;
  } catch {
    // Diagnostic image counts must not make the primary bean load fail, such
    // as when another SQLite transaction is active.
    return undefined;
  }
};

let beanMutationVersion = 0;
let beanLoadPromise: Promise<void> | null = null;

export const useCoffeeBeanStore = create<CoffeeBeanStore>()(
  subscribeWithSelector((set, get) => {
    const updateBeanInMutation = async (
      id: string,
      updates: Partial<CoffeeBean>,
      existingBean: CoffeeBean | undefined
    ) => {
      if (!existingBean) return null;

      const updatedBean = normalizeCoffeeBean(
        {
          ...existingBean,
          ...updates,
          id,
          timestamp: Math.max(Date.now(), existingBean.timestamp + 1),
        },
        { ensureFlavorArray: true }
      ) as CoffeeBean;

      try {
        const savedBean = await coffeeBeanPersistence.saveWithImages(
          updatedBean,
          { expectedRecord: existingBean }
        );
        const savedEventBean =
          await coffeeBeanImageRepository.mergeBean(savedBean);
        beanMutationVersion += 1;
        set(state => ({
          beans: state.beans.map(b => (b.id === id ? savedBean : b)),
        }));

        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('coffeeBeanDataChanged', {
              detail: { action: 'update', beanId: id, bean: savedEventBean },
            })
          );
        }
        return savedEventBean;
      } catch (error) {
        console.error('[CoffeeBeanStore] updateBean failed:', error);
        throw error;
      }
    };
    const deleteBeanInMutation = async (
      id: string,
      expectedRecord: CoffeeBean | undefined
    ) => {
      try {
        await coffeeBeanPersistence.deleteWithImages(id, { expectedRecord });
        await markExpectedCoreDataDeletionIfEmpty();
        beanMutationVersion += 1;
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
    };
    return coordinateStoreActions<CoffeeBeanStore>(
      {
        beans: [],
        isLoading: false,
        error: null,
        initialized: false,

        loadBeans: () => {
          if (beanLoadPromise) return beanLoadPromise;
          beanLoadPromise = Promise.resolve().then(async () => {
            set({ isLoading: true, error: null });
            try {
              while (true) {
                const loadVersion = beanMutationVersion;
                const rawBeans = await coffeeBeanRepository.list();
                const imageRecordCount =
                  await getImageRecordCountForDiagnostics();
                recordCrashCheckpoint('coffee-beans:raw-loaded', {
                  ...collectBeanPayloadMetrics(rawBeans as CoffeeBean[]),
                  imageRecordCount,
                });
                const beans = normalizeCoffeeBeans(rawBeans, {
                  ensureFlavorArray: true,
                }).map(stripCoffeeBeanImages);
                // Read again if a write or explicit refresh overtook this snapshot.
                if (loadVersion !== beanMutationVersion) continue;

                recordCrashCheckpoint('coffee-beans:normalized', {
                  beanCount: beans.length,
                  imageRecordCount,
                });
                set({ beans, initialized: true });
                return;
              }
            } catch (error) {
              console.error('[CoffeeBeanStore] loadBeans failed:', error);
              set({ error: '加载咖啡豆失败', initialized: false });
              throw error;
            } finally {
              beanLoadPromise = null;
              set({ isLoading: false });
            }
          });
          return beanLoadPromise;
        },

        addBean: async beanData => {
          const newBean = normalizeCoffeeBean(
            {
              ...beanData,
              id: nanoid(),
              timestamp: Date.now(),
            } as CoffeeBean,
            { ensureFlavorArray: true }
          );

          try {
            const beanForStore =
              await coffeeBeanPersistence.saveWithImages(newBean);
            await clearExpectedCoreDataDeletion();
            beanMutationVersion += 1;
            set(state => ({
              beans: [
                ...state.beans.filter(bean => bean.id !== beanForStore.id),
                beanForStore,
              ],
            }));

            if (typeof window !== 'undefined') {
              window.dispatchEvent(
                new CustomEvent('coffeeBeanDataChanged', {
                  detail: {
                    action: 'create',
                    beanId: newBean.id,
                    bean: newBean,
                  },
                })
              );
            }
            return newBean;
          } catch (error) {
            console.error('[CoffeeBeanStore] addBean failed:', error);
            throw error;
          }
        },

        updateBean: registerCoordinatedAction(
          (id: string, updates: Partial<CoffeeBean>) => {
            const snapshot = get().beans.find(record => record.id === id);
            return withDataMutation(() =>
              updateBeanInMutation(id, updates, snapshot)
            );
          },
          (id: string, updates: Partial<CoffeeBean>) =>
            updateBeanInMutation(
              id,
              updates,
              get().beans.find(record => record.id === id)
            )
        ),

        deleteBean: registerCoordinatedAction(
          (id: string) => {
            const snapshot = get().beans.find(record => record.id === id);
            return withDataMutation(() => deleteBeanInMutation(id, snapshot));
          },
          (id: string) =>
            deleteBeanInMutation(
              id,
              get().beans.find(record => record.id === id)
            )
        ),

        setBeans: (beans, initialized = true) => {
          beanMutationVersion += 1;
          set({
            beans: normalizeCoffeeBeans(beans, { ensureFlavorArray: true }),
            initialized,
          });
        },

        upsertBean: async bean => {
          try {
            const normalizedBean = normalizeCoffeeBean(bean, {
              ensureFlavorArray: true,
            }) as CoffeeBean;
            const beanForStore =
              await coffeeBeanPersistence.saveWithImages(normalizedBean);
            await clearExpectedCoreDataDeletion();
            beanMutationVersion += 1;
            set(state => {
              const exists = state.beans.some(b => b.id === beanForStore.id);
              if (exists) {
                return {
                  beans: state.beans.map(b =>
                    b.id === beanForStore.id ? beanForStore : b
                  ),
                };
              } else {
                return { beans: [...state.beans, beanForStore] };
              }
            });
          } catch (error) {
            console.error('[CoffeeBeanStore] upsertBean failed:', error);
          }
        },

        removeBean: async id => {
          try {
            await coffeeBeanPersistence.deleteWithImages(id);
            await markExpectedCoreDataDeletionIfEmpty();
            beanMutationVersion += 1;
            set(state => ({ beans: state.beans.filter(b => b.id !== id) }));
          } catch (error) {
            console.error('[CoffeeBeanStore] removeBean failed:', error);
          }
        },

        getBeanById: id => {
          return get().beans.find(b => b.id === id);
        },

        refreshBeans: async () => {
          beanMutationVersion += 1;
          set({ initialized: false });
          await get().loadBeans();
        },
      },
      ['addBean', 'upsertBean', 'removeBean']
    );
  })
);

export const getCoffeeBeanStore = () => useCoffeeBeanStore.getState();

// ==================== 便捷工具函数 ====================

/**
 * 容量同步管理器 - 处理笔记与咖啡豆之间的双向数据同步
 */
export const CapacitySyncManager = {
  /**
   * 从笔记参数中提取咖啡粉量（纯数字）
   * @param coffeeParam 咖啡参数（如"15g"或"15"）
   * @returns 纯数字值
   */
  extractCoffeeAmount(coffeeParam: string): number {
    return parseCoffeeBeanAmount(coffeeParam) ?? 0;
  },

  /**
   * 格式化咖啡参数为带单位的字符串
   * @param amount 数量
   * @param unit 单位（默认为'g'）
   * @returns 格式化后的字符串
   */
  formatCoffeeParam(amount: number | string, unit: string = 'g'): string {
    const numAmount =
      typeof amount === 'number' ? amount : parseFloat(String(amount));
    if (isNaN(numAmount)) return `0${unit}`;
    return `${formatCoffeeBeanAmount(numAmount)}${unit}`;
  },
};

/**
 * 更新咖啡豆剩余量（减少）
 * @param id 咖啡豆ID
 * @param usedAmount 使用的咖啡量(g)
 * @returns 更新后的咖啡豆对象，如果不存在则返回null
 */
async function updateBeanRemainingInMutation(
  id: string,
  usedAmount: number
): Promise<CoffeeBean | null> {
  try {
    if (!id) return null;
    if (isNaN(usedAmount) || usedAmount <= 0) return null;

    const store = getCoffeeBeanStore();
    const bean = await coffeeBeanRepository.get(id);
    if (!bean) return null;
    // Compute against the latest persisted stock while holding the native lease.
    store.setBeans([...store.beans.filter(current => current.id !== id), bean]);

    const currentRemaining = bean.remaining ? parseFloat(bean.remaining) : 0;
    const newRemaining = Math.max(0, currentRemaining - usedAmount);
    const formattedNewRemaining = formatCoffeeBeanAmount(newRemaining);

    const result = await callStoreActionInMutation(store.updateBean, id, {
      remaining: formattedNewRemaining,
    });
    return result;
  } catch (error) {
    console.error('更新咖啡豆剩余量失败:', error);
    return null;
  }
}

/**
 * 增加咖啡豆剩余量（用于删除笔记时恢复容量）
 * @param id 咖啡豆ID
 * @param restoreAmount 要恢复的咖啡量(g)
 * @returns 更新后的咖啡豆对象，如果不存在则返回null
 */
async function increaseBeanRemainingInMutation(
  id: string,
  restoreAmount: number
): Promise<CoffeeBean | null> {
  try {
    if (!id || typeof id !== 'string' || id.trim() === '') return null;
    if (
      typeof restoreAmount !== 'number' ||
      isNaN(restoreAmount) ||
      restoreAmount <= 0
    )
      return null;

    const store = getCoffeeBeanStore();
    const bean = await coffeeBeanRepository.get(id);
    if (!bean) return null;
    store.setBeans([...store.beans.filter(current => current.id !== id), bean]);

    // 转换为数字计算
    let currentRemaining = 0;
    if (bean.remaining) {
      const remainingStr =
        typeof bean.remaining === 'string'
          ? bean.remaining.replace(/[^\d.-]/g, '')
          : String(bean.remaining);
      currentRemaining = parseFloat(remainingStr);
      if (isNaN(currentRemaining)) currentRemaining = 0;
    }

    // 增加剩余量
    let finalRemaining = currentRemaining + restoreAmount;

    // 如果有总容量限制，确保不超过总容量
    if (bean.capacity) {
      const capacityStr =
        typeof bean.capacity === 'string'
          ? bean.capacity.replace(/[^\d.-]/g, '')
          : String(bean.capacity);
      const totalCapacity = parseFloat(capacityStr);

      if (
        !isNaN(totalCapacity) &&
        totalCapacity > 0 &&
        finalRemaining > totalCapacity
      ) {
        finalRemaining = totalCapacity;
      }
    }

    const formattedNewRemaining = formatCoffeeBeanAmount(finalRemaining);
    const result = await callStoreActionInMutation(store.updateBean, id, {
      remaining: formattedNewRemaining,
    });
    return result;
  } catch (error) {
    console.error('恢复咖啡豆剩余量失败:', error);
    return null;
  }
}

/**
 * 根据名称/显示名称获取咖啡豆
 */
export async function getBeanByName(
  name: string,
  roaster?: string
): Promise<CoffeeBean | null> {
  const store = getCoffeeBeanStore();
  const beans =
    store.beans.length > 0 ? store.beans : await coffeeBeanRepository.list();

  if (roaster) {
    return findCoffeeBeanByIdentity(beans, { name, roaster });
  }

  return (
    findCoffeeBeanByDisplayName(beans, name) ??
    findCoffeeBeanByIdentity(beans, { name })
  );
}

export const { updateBeanRemaining, increaseBeanRemaining } =
  coordinateStoreActions(
    {
      updateBeanRemaining: updateBeanRemainingInMutation,
      increaseBeanRemaining: increaseBeanRemainingInMutation,
    },
    ['updateBeanRemaining', 'increaseBeanRemaining']
  );
