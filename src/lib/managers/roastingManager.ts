import { CoffeeBean, BrewingNoteData } from '@/types/app';
import {
  getCoffeeBeanStore,
  updateBeanRemaining,
  increaseBeanRemaining,
} from '@/lib/stores/coffeeBeanStore';
import { nanoid } from 'nanoid';
import {
  parseBeanName,
  getNextAvailableNumber,
} from '@/lib/utils/beanRepurchaseUtils';

// 辅助函数：格式化数字
function formatNumber(value: number): string {
  return Number.isInteger(value) ? value.toString() : value.toFixed(1);
}

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
      const greenBean = await getCoffeeBeanStore().getBeanById(greenBeanId);
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
      const updatedGreenBean = await getCoffeeBeanStore().updateBean(
        greenBeanId,
        {
          remaining: formatNumber(newRemaining),
        }
      );

      if (!updatedGreenBean) {
        return { success: false, error: '更新生豆容量失败' };
      }

      // 4. 如果提供了熟豆数据，创建或更新熟豆记录
      let roastedBean: CoffeeBean | undefined;
      if (roastedBeanData) {
        // 获取所有豆子用于生成名称
        const allBeans = getCoffeeBeanStore().beans;

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
          capacity: formatNumber(userCapacity),
          remaining: formatNumber(userRemaining),
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

        roastedBean = await getCoffeeBeanStore().addBean(newRoastedBean);

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
      const greenBean = await getCoffeeBeanStore().getBeanById(greenBeanId);
      if (!greenBean) {
        return { success: false, error: '找不到生豆记录' };
      }

      // 2. 检查剩余量是否为0（边界情况）
      const currentRemaining = parseFloat(greenBean.remaining || '0');
      if (currentRemaining <= 0) {
        return { success: false, error: '生豆已用完，无法继续烘焙' };
      }

      // 3. 获取所有豆子用于生成名称
      const allBeans = getCoffeeBeanStore().beans;

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
    const allBeans = getCoffeeBeanStore().beans;
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
        const greenBean = await getCoffeeBeanStore().getBeanById(greenBeanId);
        if (greenBean) {
          // 使用 increaseBeanRemaining 恢复容量
          const restored = await increaseBeanRemaining(
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
        const roastedBean =
          await getCoffeeBeanStore().getBeanById(roastedBeanId);
        if (roastedBean && roastedBean.sourceGreenBeanId) {
          const updated = await getCoffeeBeanStore().updateBean(roastedBeanId, {
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
        await getCoffeeBeanStore().updateBean(bean.id, {
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

  /**
   * 将熟豆转换为生豆（用于迁移用户之前当作生豆使用的熟豆数据）
   *
   * 转换逻辑：
   * 1. 创建生豆：继承原熟豆的所有信息，保持 capacity 和 remaining 不变
   * 2. 计算烘焙量：capacity - remaining（已使用的量等于已烘焙的量）
   * 3. 创建熟豆：烘焙量作为 capacity，减去普通笔记消耗后的量作为 remaining
   * 4. 创建烘焙记录：关联生豆和熟豆
   * 5. 迁移普通笔记：将 beanId 指向新熟豆
   * 6. 删除变动记录：快捷扣除、容量调整等记录
   * 7. 删除原熟豆
   *
   * @param roastedBeanId 要转换的熟豆ID
   * @returns 转换结果
   */
  async convertRoastedToGreen(roastedBeanId: string): Promise<{
    success: boolean;
    greenBean?: CoffeeBean;
    newRoastedBean?: CoffeeBean;
    roastingNote?: BrewingNoteData;
    migratedNotesCount?: number;
    deletedRecordsCount?: number;
    error?: string;
  }> {
    try {
      const { Storage } = await import('@/lib/core/storage');

      // 1. 获取原熟豆信息
      const originalBean =
        await getCoffeeBeanStore().getBeanById(roastedBeanId);
      if (!originalBean) {
        return { success: false, error: '找不到咖啡豆记录' };
      }

      // 确认是熟豆
      const beanState = originalBean.beanState || 'roasted';
      if (beanState !== 'roasted') {
        return { success: false, error: '只能将熟豆转换为生豆' };
      }

      // 确认没有来源生豆（避免转换已经是烘焙产生的熟豆）
      if (originalBean.sourceGreenBeanId) {
        return {
          success: false,
          error: '该熟豆已关联生豆来源，无法转换',
        };
      }

      // 2. 获取所有关联笔记
      const notesStr = await Storage.get('brewingNotes');
      const allNotes: BrewingNoteData[] = notesStr ? JSON.parse(notesStr) : [];

      // 筛选与原熟豆关联的笔记
      const relatedNotes = allNotes.filter(
        note => note.beanId === roastedBeanId
      );

      // 分类笔记
      const brewingNotes: BrewingNoteData[] = []; // 普通冲煮笔记
      const recordNotes: BrewingNoteData[] = []; // 变动记录（需删除）

      for (const note of relatedNotes) {
        if (
          note.source === 'quick-decrement' ||
          note.source === 'capacity-adjustment' ||
          note.source === 'roasting'
        ) {
          recordNotes.push(note);
        } else {
          // 普通冲煮笔记（包括导入的笔记）
          brewingNotes.push(note);
        }
      }

      // 3. 计算普通笔记消耗的咖啡量
      let noteUsageTotal = 0;
      for (const note of brewingNotes) {
        if (note.params?.coffee) {
          const match = note.params.coffee.match(/(\d+(?:\.\d+)?)/);
          if (match) {
            noteUsageTotal += parseFloat(match[0]);
          }
        }
      }

      // 4. 计算各项数值
      const capacity = parseFloat(originalBean.capacity || '0');
      const remaining = parseFloat(originalBean.remaining || '0');
      const roastedAmount = capacity - remaining; // 已使用量 = 已烘焙量

      // 计算新熟豆的剩余量
      const newRoastedRemaining = Math.max(0, roastedAmount - noteUsageTotal);

      // 5. 如果熟豆未使用（roastedAmount <= 0），直接转为生豆
      if (roastedAmount <= 0) {
        // 直接创建生豆，不需要烘焙记录和新熟豆
        const greenBeanData: Omit<CoffeeBean, 'id' | 'timestamp'> = {
          name: originalBean.name,
          beanState: 'green',
          beanType: originalBean.beanType,
          capacity: originalBean.capacity,
          remaining: originalBean.remaining,
          image: originalBean.image,
          roastLevel: originalBean.roastLevel,
          flavor: originalBean.flavor,
          notes: originalBean.notes,
          brand: originalBean.brand,
          price: originalBean.price,
          blendComponents: originalBean.blendComponents,
          purchaseDate: originalBean.roastDate,
        };

        const greenBean = await getCoffeeBeanStore().addBean(greenBeanData);

        // 删除原熟豆关联的所有变动记录（虽然未使用通常没有，但保险起见）
        if (recordNotes.length > 0) {
          const recordIdsToDelete = new Set(recordNotes.map(n => n.id));
          const updatedNotes = allNotes.filter(
            n => !recordIdsToDelete.has(n.id)
          );
          await Storage.set('brewingNotes', JSON.stringify(updatedNotes));
        }

        // 删除原熟豆 - 使用 store 的 deleteBean 方法确保触发同步事件
        await getCoffeeBeanStore().deleteBean(roastedBeanId);

        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('brewingNotesUpdated'));
        }

        return {
          success: true,
          greenBean,
          // 未使用的熟豆转换不会产生新熟豆和烘焙记录
          newRoastedBean: undefined,
          roastingNote: undefined,
          migratedNotesCount: 0,
          deletedRecordsCount: recordNotes.length,
        };
      }

      // 6. 创建生豆（有使用记录的情况）
      const greenBeanData: Omit<CoffeeBean, 'id' | 'timestamp'> = {
        name: originalBean.name,
        beanState: 'green',
        beanType: originalBean.beanType,
        capacity: originalBean.capacity,
        remaining: originalBean.remaining,
        image: originalBean.image,
        roastLevel: originalBean.roastLevel,
        flavor: originalBean.flavor,
        notes: originalBean.notes,
        brand: originalBean.brand,
        price: originalBean.price,
        blendComponents: originalBean.blendComponents,
        // 使用原熟豆的 roastDate 作为购买日期（如果有的话）
        purchaseDate: originalBean.roastDate,
      };

      const greenBean = await getCoffeeBeanStore().addBean(greenBeanData);

      // 6. 创建新熟豆
      // 直接使用原熟豆名称，因为原熟豆会被删除，不会产生重名
      const roastedBeanName = originalBean.name;

      // 计算熟豆价格（基于生豆单价和烘焙量）
      let roastedPrice: string | undefined;
      if (originalBean.price && capacity > 0) {
        const priceNum = parseFloat(originalBean.price);
        if (priceNum > 0) {
          roastedPrice = ((priceNum / capacity) * roastedAmount).toFixed(2);
        }
      }

      const newRoastedBeanData: Omit<CoffeeBean, 'id' | 'timestamp'> = {
        name: roastedBeanName,
        beanState: 'roasted',
        beanType: originalBean.beanType,
        capacity: formatNumber(roastedAmount),
        remaining: formatNumber(newRoastedRemaining),
        image: originalBean.image,
        roastLevel: originalBean.roastLevel,
        roastDate: originalBean.roastDate, // 保留原熟豆的烘焙日期
        flavor: originalBean.flavor,
        notes: originalBean.notes,
        brand: originalBean.brand,
        price: roastedPrice,
        blendComponents: originalBean.blendComponents,
        sourceGreenBeanId: greenBean.id, // 关联到新创建的生豆
      };

      const newRoastedBean =
        await getCoffeeBeanStore().addBean(newRoastedBeanData);

      // 7. 创建烘焙记录
      const roastingNote: BrewingNoteData = {
        id: nanoid(),
        timestamp: Date.now(),
        coffeeBeanInfo: {
          name: greenBean.name,
          roastLevel: greenBean.roastLevel || '未知',
          roastDate: greenBean.purchaseDate,
        },
        rating: 0,
        taste: {},
        notes: `从熟豆转换：烘焙了 ${formatNumber(roastedAmount)}g 生豆 → ${newRoastedBean.name}`,
        source: 'roasting',
        beanId: greenBean.id,
        changeRecord: {
          roastingRecord: {
            greenBeanId: greenBean.id,
            greenBeanName: greenBean.name,
            roastedAmount,
            roastedBeanId: newRoastedBean.id,
            roastedBeanName: newRoastedBean.name,
          },
        },
      };

      // 8. 更新笔记数据
      const updatedNotes: BrewingNoteData[] = [];
      const recordIdsToDelete = new Set(recordNotes.map(n => n.id));

      for (const note of allNotes) {
        // 跳过要删除的变动记录
        if (recordIdsToDelete.has(note.id)) {
          continue;
        }

        // 迁移普通冲煮笔记的 beanId
        if (note.beanId === roastedBeanId) {
          updatedNotes.push({
            ...note,
            beanId: newRoastedBean.id,
            coffeeBeanInfo: {
              ...note.coffeeBeanInfo,
              name: newRoastedBean.name,
            },
          });
        } else {
          updatedNotes.push(note);
        }
      }

      // 添加烘焙记录
      updatedNotes.unshift(roastingNote);

      // 保存笔记
      await Storage.set('brewingNotes', JSON.stringify(updatedNotes));

      // 9. 删除原熟豆 - 使用 store 的 deleteBean 方法确保触发同步事件
      await getCoffeeBeanStore().deleteBean(roastedBeanId);

      // 10. 触发笔记更新事件（咖啡豆事件已由 deleteBean 触发）
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('brewingNotesUpdated'));
      }

      return {
        success: true,
        greenBean,
        newRoastedBean,
        roastingNote,
        migratedNotesCount: brewingNotes.length,
        deletedRecordsCount: recordNotes.length,
      };
    } catch (error) {
      console.error('转换熟豆为生豆失败:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '转换失败',
      };
    }
  },

  /**
   * 预览熟豆转生豆的效果（不执行实际转换）
   *
   * @param roastedBeanId 要转换的熟豆ID
   * @returns 预览结果
   */
  async previewConvertRoastedToGreen(roastedBeanId: string): Promise<{
    success: boolean;
    preview?: {
      originalBean: {
        name: string;
        capacity: number;
        remaining: number;
      };
      greenBean: {
        capacity: number;
        remaining: number;
      };
      roastingAmount: number;
      newRoastedBean: {
        capacity: number;
        remaining: number;
      };
      brewingNotesCount: number;
      noteUsageTotal: number;
      recordsToDeleteCount: number;
      directConvert?: boolean; // 标记是否直接转换（未使用的熟豆）
    };
    error?: string;
  }> {
    try {
      const { Storage } = await import('@/lib/core/storage');

      // 获取原熟豆信息
      const originalBean =
        await getCoffeeBeanStore().getBeanById(roastedBeanId);
      if (!originalBean) {
        return { success: false, error: '找不到咖啡豆记录' };
      }

      const beanState = originalBean.beanState || 'roasted';
      if (beanState !== 'roasted') {
        return { success: false, error: '只能将熟豆转换为生豆' };
      }

      if (originalBean.sourceGreenBeanId) {
        return {
          success: false,
          error: '该熟豆已关联生豆来源，无法转换',
        };
      }

      // 获取所有关联笔记
      const notesStr = await Storage.get('brewingNotes');
      const allNotes: BrewingNoteData[] = notesStr ? JSON.parse(notesStr) : [];
      const relatedNotes = allNotes.filter(
        note => note.beanId === roastedBeanId
      );

      // 分类并统计
      let brewingNotesCount = 0;
      let recordsToDeleteCount = 0;
      let noteUsageTotal = 0;

      for (const note of relatedNotes) {
        if (
          note.source === 'quick-decrement' ||
          note.source === 'capacity-adjustment' ||
          note.source === 'roasting'
        ) {
          recordsToDeleteCount++;
        } else {
          brewingNotesCount++;
          if (note.params?.coffee) {
            const match = note.params.coffee.match(/(\d+(?:\.\d+)?)/);
            if (match) {
              noteUsageTotal += parseFloat(match[0]);
            }
          }
        }
      }

      // 计算数值
      const capacity = parseFloat(originalBean.capacity || '0');
      const remaining = parseFloat(originalBean.remaining || '0');
      const roastingAmount = capacity - remaining;

      const newRoastedRemaining = Math.max(0, roastingAmount - noteUsageTotal);

      // 如果未使用，直接转为生豆（不会产生烘焙记录和新熟豆）
      if (roastingAmount <= 0) {
        return {
          success: true,
          preview: {
            originalBean: {
              name: originalBean.name,
              capacity,
              remaining,
            },
            greenBean: {
              capacity,
              remaining,
            },
            roastingAmount: 0,
            newRoastedBean: {
              capacity: 0,
              remaining: 0,
            },
            brewingNotesCount: 0,
            noteUsageTotal: 0,
            recordsToDeleteCount,
            // 标记这是直接转换模式
            directConvert: true,
          },
        };
      }

      return {
        success: true,
        preview: {
          originalBean: {
            name: originalBean.name,
            capacity,
            remaining,
          },
          greenBean: {
            capacity,
            remaining,
          },
          roastingAmount,
          newRoastedBean: {
            capacity: roastingAmount,
            remaining: newRoastedRemaining,
          },
          brewingNotesCount,
          noteUsageTotal,
          recordsToDeleteCount,
        },
      };
    } catch (error) {
      console.error('预览转换失败:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '预览失败',
      };
    }
  },
};
