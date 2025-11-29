import { CoffeeBean, BrewingNoteData } from '@/types/app';
import { CoffeeBeanManager } from './coffeeBeanManager';
import { nanoid } from 'nanoid';
import {
  parseBeanName,
  getNextAvailableNumber,
} from '@/lib/utils/beanRepurchaseUtils';

/**
 * 烘焙管理器 - 处理生豆到熟豆的转换
 */
export const RoastingManager = {
  /**
   * 生成熟豆名称（使用续购逻辑）
   * @param greenBeanName 生豆名称
   * @param allBeans 所有咖啡豆列表
   * @returns 熟豆名称
   */
  generateRoastedBeanName(
    greenBeanName: string,
    allBeans: CoffeeBean[]
  ): string {
    const { baseName } = parseBeanName(greenBeanName);

    // 检查是否已存在同名的熟豆
    const existingRoastedBeans = allBeans.filter(bean => {
      const beanState = bean.beanState || 'roasted';
      if (beanState !== 'roasted') return false;

      const { baseName: beanBaseName } = parseBeanName(bean.name);
      return beanBaseName === baseName;
    });

    // 如果没有同名熟豆，直接使用基础名称
    if (existingRoastedBeans.length === 0) {
      return baseName;
    }

    // 如果已有同名熟豆，使用编号
    const nextNumber = getNextAvailableNumber(baseName, allBeans);
    return `${baseName} #${nextNumber}`;
  },

  /**
   * 烘焙生豆并生成烘焙记录
   * @param greenBeanId 生豆ID
   * @param roastedAmount 烘焙的重量(g)
   * @param roastedBeanData 烘焙后的熟豆数据（可选，如果不提供则不创建熟豆记录）
   * @returns 操作结果
   */
  async roastGreenBean(
    greenBeanId: string,
    roastedAmount: number,
    roastedBeanData?: Partial<CoffeeBean>
  ): Promise<{
    success: boolean;
    greenBean?: CoffeeBean;
    roastedBean?: CoffeeBean;
    note?: BrewingNoteData;
    error?: string;
  }> {
    try {
      // 1. 获取生豆信息
      const greenBean = await CoffeeBeanManager.getBeanById(greenBeanId);
      if (!greenBean) {
        return { success: false, error: '找不到生豆记录' };
      }

      // 确认是生豆
      const beanState = greenBean.beanState || 'roasted';
      if (beanState !== 'green') {
        return { success: false, error: '只能烘焙生豆' };
      }

      // 2. 检查剩余量是否足够
      const currentRemaining = parseFloat(greenBean.remaining || '0');
      if (currentRemaining < roastedAmount) {
        return { success: false, error: '生豆剩余量不足' };
      }

      // 2.1 检查剩余量是否为0（边界情况）
      if (currentRemaining <= 0) {
        return { success: false, error: '生豆已用完，无法继续烘焙' };
      }

      // 3. 扣除生豆容量
      const newRemaining = currentRemaining - roastedAmount;
      const updatedGreenBean = await CoffeeBeanManager.updateBean(greenBeanId, {
        remaining: CoffeeBeanManager.formatNumber(newRemaining),
      });

      if (!updatedGreenBean) {
        return { success: false, error: '更新生豆容量失败' };
      }

      // 4. 如果提供了熟豆数据，创建或更新熟豆记录
      let roastedBean: CoffeeBean | undefined;
      if (roastedBeanData) {
        // 获取所有豆子用于生成名称
        const allBeans = await CoffeeBeanManager.getAllBeans();

        // 使用续购逻辑生成熟豆名称（如果用户没有修改名称）
        const userProvidedName = roastedBeanData.name;
        const shouldAutoRename =
          !userProvidedName || userProvidedName === greenBean.name;
        const roastedBeanName = shouldAutoRename
          ? this.generateRoastedBeanName(greenBean.name, allBeans)
          : userProvidedName;

        // 解析用户填写的容量和剩余量
        const userCapacity = parseFloat(
          roastedBeanData.capacity || String(roastedAmount)
        );
        const userRemaining = parseFloat(
          roastedBeanData.remaining || String(userCapacity)
        );

        // 基于生豆信息创建熟豆，但使用提供的数据覆盖
        const newRoastedBean: Omit<CoffeeBean, 'id' | 'timestamp'> = {
          name: roastedBeanName,
          beanState: 'roasted',
          beanType: roastedBeanData.beanType || greenBean.beanType,
          capacity: CoffeeBeanManager.formatNumber(userCapacity),
          remaining: CoffeeBeanManager.formatNumber(userRemaining),
          // 继承生豆的其他属性
          image: roastedBeanData.image || greenBean.image,
          roastLevel: roastedBeanData.roastLevel || greenBean.roastLevel,
          roastDate: roastedBeanData.roastDate,
          flavor: roastedBeanData.flavor || greenBean.flavor,
          notes: roastedBeanData.notes || greenBean.notes,
          brand: roastedBeanData.brand || greenBean.brand,
          price: roastedBeanData.price,
          blendComponents:
            roastedBeanData.blendComponents || greenBean.blendComponents,
          // 添加生豆来源追溯
          sourceGreenBeanId: greenBeanId,
        };

        roastedBean = await CoffeeBeanManager.addBean(newRoastedBean);

        // 4.1 如果容量和剩余量不同，为熟豆创建一个变动记录
        if (roastedBean && userCapacity !== userRemaining) {
          const decrementAmount = userCapacity - userRemaining;
          const decrementNote: BrewingNoteData = {
            id: nanoid(),
            timestamp: Date.now() + 1, // +1ms 确保在烘焙记录之后
            coffeeBeanInfo: {
              name: roastedBean.name,
              roastLevel: roastedBean.roastLevel || '未知',
              roastDate: roastedBean.roastDate,
            },
            rating: 0,
            taste: {},
            notes: '烘焙时已使用',
            source: 'quick-decrement',
            beanId: roastedBean.id,
            quickDecrementAmount: decrementAmount,
          };

          // 保存变动记录
          const { Storage } = await import('@/lib/core/storage');
          const notesStr = await Storage.get('brewingNotes');
          const notes: BrewingNoteData[] = notesStr ? JSON.parse(notesStr) : [];
          notes.unshift(decrementNote);
          await Storage.set('brewingNotes', JSON.stringify(notes));
        }
      }

      // 5. 生成烘焙记录笔记
      const roastingNote: BrewingNoteData = {
        id: nanoid(),
        timestamp: Date.now(),
        coffeeBeanInfo: {
          name: greenBean.name,
          roastLevel: greenBean.roastLevel || '未知',
          roastDate: greenBean.roastDate,
        },
        rating: 0,
        taste: {},
        notes: `烘焙了 ${roastedAmount}g 生豆${roastedBean ? ` → ${roastedBean.name}` : ''}`,
        source: 'roasting',
        beanId: greenBeanId,
        changeRecord: {
          roastingRecord: {
            greenBeanId,
            greenBeanName: greenBean.name,
            roastedAmount,
            roastedBeanId: roastedBean?.id,
            roastedBeanName: roastedBean?.name,
          },
        },
      };

      // 6. 保存烘焙记录
      const { Storage } = await import('@/lib/core/storage');
      const notesStr = await Storage.get('brewingNotes');
      const notes: BrewingNoteData[] = notesStr ? JSON.parse(notesStr) : [];
      notes.unshift(roastingNote);
      await Storage.set('brewingNotes', JSON.stringify(notes));

      // 7. 触发更新事件
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('brewingNotesUpdated'));
      }

      return {
        success: true,
        greenBean: updatedGreenBean,
        roastedBean,
        note: roastingNote,
      };
    } catch (error) {
      console.error('烘焙生豆失败:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '烘焙失败',
      };
    }
  },

  /**
   * 简单烘焙 - 自动创建熟豆记录
   * @param greenBeanId 生豆ID
   * @param roastedAmount 烘焙的重量(g)
   * @param options 可选配置
   * @returns 操作结果
   */
  async simpleRoast(
    greenBeanId: string,
    roastedAmount: number,
    options?: {
      customRoastedBeanName?: string; // 可选：自定义熟豆名称
      roastDate?: string; // 可选：自定义烘焙日期，默认为当前时间
    }
  ): Promise<{
    success: boolean;
    greenBean?: CoffeeBean;
    roastedBean?: CoffeeBean;
    note?: BrewingNoteData;
    error?: string;
  }> {
    try {
      // 1. 获取生豆信息（用于生成熟豆名称）
      const greenBean = await CoffeeBeanManager.getBeanById(greenBeanId);
      if (!greenBean) {
        return { success: false, error: '找不到生豆记录' };
      }

      // 2. 检查剩余量是否为0（边界情况）
      const currentRemaining = parseFloat(greenBean.remaining || '0');
      if (currentRemaining <= 0) {
        return { success: false, error: '生豆已用完，无法继续烘焙' };
      }

      // 3. 获取所有豆子用于生成名称
      const allBeans = await CoffeeBeanManager.getAllBeans();

      // 4. 生成熟豆名称
      const roastedBeanName =
        options?.customRoastedBeanName ||
        this.generateRoastedBeanName(greenBean.name, allBeans);

      // 5. 生成烘焙日期（默认为当前日期）
      const roastDate =
        options?.roastDate || new Date().toISOString().split('T')[0]; // YYYY-MM-DD 格式

      // 6. 自动计算价格：熟豆价格 = 生豆单价 × 烘焙量
      let roastedPrice: string | undefined;
      if (greenBean.price && greenBean.capacity) {
        const greenPrice = parseFloat(greenBean.price);
        const greenCapacity = parseFloat(greenBean.capacity);
        if (greenPrice > 0 && greenCapacity > 0) {
          roastedPrice = ((greenPrice / greenCapacity) * roastedAmount).toFixed(
            2
          );
        }
      }

      // 7. 调用完整烘焙方法，自动创建熟豆
      const result = await this.roastGreenBean(greenBeanId, roastedAmount, {
        name: roastedBeanName,
        roastDate: roastDate,
        price: roastedPrice,
      });

      return result;
    } catch (error) {
      console.error('简单烘焙失败:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '烘焙失败',
      };
    }
  },

  /**
   * 获取生豆派生的所有熟豆
   * @param greenBeanId 生豆ID
   * @returns 熟豆列表
   */
  async getDerivedRoastedBeans(greenBeanId: string): Promise<CoffeeBean[]> {
    const allBeans = await CoffeeBeanManager.getAllBeans();
    return allBeans.filter(bean => bean.sourceGreenBeanId === greenBeanId);
  },

  /**
   * 获取生豆的烘焙记录
   * @param greenBeanId 生豆ID
   * @returns 烘焙记录列表
   */
  async getRoastingRecords(greenBeanId: string): Promise<BrewingNoteData[]> {
    const { Storage } = await import('@/lib/core/storage');
    const notesStr = await Storage.get('brewingNotes');
    if (!notesStr) return [];

    const notes: BrewingNoteData[] = JSON.parse(notesStr);
    return notes.filter(
      note =>
        note.source === 'roasting' &&
        note.changeRecord?.roastingRecord?.greenBeanId === greenBeanId
    );
  },

  /**
   * 删除烘焙记录
   * 策略：
   * 1. 恢复生豆容量
   * 2. 清除关联熟豆的 sourceGreenBeanId（不删除熟豆）
   * 3. 删除烘焙记录本身
   *
   * @param noteId 烘焙记录ID
   * @returns 操作结果
   */
  async deleteRoastingRecord(noteId: string): Promise<{
    success: boolean;
    restoredGreenBean?: CoffeeBean;
    updatedRoastedBean?: CoffeeBean;
    error?: string;
  }> {
    try {
      const { Storage } = await import('@/lib/core/storage');

      // 1. 获取烘焙记录
      const notesStr = await Storage.get('brewingNotes');
      if (!notesStr) {
        return { success: false, error: '找不到笔记数据' };
      }

      const notes: BrewingNoteData[] = JSON.parse(notesStr);
      const noteIndex = notes.findIndex(n => n.id === noteId);

      if (noteIndex === -1) {
        return { success: false, error: '找不到烘焙记录' };
      }

      const note = notes[noteIndex];

      // 确认是烘焙记录
      if (note.source !== 'roasting') {
        return { success: false, error: '该记录不是烘焙记录' };
      }

      const roastingRecord = note.changeRecord?.roastingRecord;
      if (!roastingRecord) {
        return { success: false, error: '烘焙记录数据不完整' };
      }

      let restoredGreenBean: CoffeeBean | undefined;
      let updatedRoastedBean: CoffeeBean | undefined;

      // 2. 恢复生豆容量
      const { greenBeanId, roastedAmount, roastedBeanId } = roastingRecord;

      if (greenBeanId && roastedAmount > 0) {
        const greenBean = await CoffeeBeanManager.getBeanById(greenBeanId);
        if (greenBean) {
          // 使用 increaseBeanRemaining 恢复容量
          const restored = await CoffeeBeanManager.increaseBeanRemaining(
            greenBeanId,
            roastedAmount
          );
          if (restored) {
            restoredGreenBean = restored;
          }
        }
        // 如果生豆已被删除，静默跳过（符合宽松策略）
      }

      // 3. 清除关联熟豆的 sourceGreenBeanId
      if (roastedBeanId) {
        const roastedBean = await CoffeeBeanManager.getBeanById(roastedBeanId);
        if (roastedBean && roastedBean.sourceGreenBeanId) {
          const updated = await CoffeeBeanManager.updateBean(roastedBeanId, {
            sourceGreenBeanId: undefined,
          });
          if (updated) {
            updatedRoastedBean = updated;
          }
        }
        // 如果熟豆已被删除，静默跳过
      }

      // 4. 删除烘焙记录
      notes.splice(noteIndex, 1);
      await Storage.set('brewingNotes', JSON.stringify(notes));

      // 5. 触发更新事件
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('brewingNotesUpdated'));
        window.dispatchEvent(new CustomEvent('coffeeBeansUpdated'));
      }

      return {
        success: true,
        restoredGreenBean,
        updatedRoastedBean,
      };
    } catch (error) {
      console.error('删除烘焙记录失败:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '删除失败',
      };
    }
  },

  /**
   * 处理熟豆被删除时的关联清理
   * 策略：清除烘焙记录中的 roastedBeanId（保留记录本身）
   *
   * @param roastedBeanId 被删除的熟豆ID
   */
  async onRoastedBeanDeleted(roastedBeanId: string): Promise<void> {
    try {
      const { Storage } = await import('@/lib/core/storage');
      const notesStr = await Storage.get('brewingNotes');
      if (!notesStr) return;

      const notes: BrewingNoteData[] = JSON.parse(notesStr);
      let updated = false;

      // 查找并清理关联的烘焙记录
      for (const note of notes) {
        if (
          note.source === 'roasting' &&
          note.changeRecord?.roastingRecord?.roastedBeanId === roastedBeanId
        ) {
          // 清除 roastedBeanId，但保留其他信息（如 roastedBeanName）
          note.changeRecord.roastingRecord.roastedBeanId = undefined;
          updated = true;
        }
      }

      if (updated) {
        await Storage.set('brewingNotes', JSON.stringify(notes));
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('brewingNotesUpdated'));
        }
      }
    } catch (error) {
      console.error('清理熟豆关联的烘焙记录失败:', error);
    }
  },

  /**
   * 处理生豆被删除时的关联清理
   * 策略：
   * 1. 清除派生熟豆的 sourceGreenBeanId
   * 2. 清除烘焙记录中的 greenBeanId（保留记录本身和快照数据）
   *
   * @param greenBeanId 被删除的生豆ID
   */
  async onGreenBeanDeleted(greenBeanId: string): Promise<void> {
    try {
      // 1. 清除派生熟豆的 sourceGreenBeanId
      const derivedBeans = await this.getDerivedRoastedBeans(greenBeanId);
      for (const bean of derivedBeans) {
        await CoffeeBeanManager.updateBean(bean.id, {
          sourceGreenBeanId: undefined,
        });
      }

      // 2. 清除烘焙记录中的 greenBeanId
      const { Storage } = await import('@/lib/core/storage');
      const notesStr = await Storage.get('brewingNotes');
      if (!notesStr) return;

      const notes: BrewingNoteData[] = JSON.parse(notesStr);
      let updated = false;

      for (const note of notes) {
        if (
          note.source === 'roasting' &&
          note.changeRecord?.roastingRecord?.greenBeanId === greenBeanId
        ) {
          // 清除 greenBeanId，但保留 greenBeanName 等快照数据
          note.changeRecord.roastingRecord.greenBeanId =
            undefined as unknown as string;
          // 同时清除 beanId
          note.beanId = undefined;
          updated = true;
        }
      }

      if (updated) {
        await Storage.set('brewingNotes', JSON.stringify(notes));
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('brewingNotesUpdated'));
          window.dispatchEvent(new CustomEvent('coffeeBeansUpdated'));
        }
      }
    } catch (error) {
      console.error('清理生豆关联数据失败:', error);
    }
  },
};
