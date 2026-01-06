import { useCoffeeBeanStore } from '@/lib/stores/coffeeBeanStore';
import { ExtendedCoffeeBean } from '../types';

export const useBeanOperations = () => {
  const store = useCoffeeBeanStore();

  const handleSaveBean = async (
    bean: Omit<ExtendedCoffeeBean, 'id' | 'timestamp'>,
    editingBean: ExtendedCoffeeBean | null
  ) => {
    try {
      if (editingBean) {
        const updatedBean = await store.updateBean(editingBean.id, bean);
        if (!updatedBean) {
          return { success: false, error: new Error('Update failed') };
        }
        return { success: true, bean: updatedBean as ExtendedCoffeeBean };
      } else {
        const newBean = await store.addBean(bean);
        return { success: true, bean: newBean as ExtendedCoffeeBean };
      }
    } catch (error) {
      console.error('Save bean failed:', error);
      return { success: false, error };
    }
  };

  const handleDelete = async (bean: ExtendedCoffeeBean) => {
    try {
      const success = await store.deleteBean(bean.id);
      if (!success) {
        return { success: false, error: new Error('Delete failed') };
      }
      return { success: true };
    } catch (error) {
      console.error('Delete bean failed:', error);
      return { success: false, error };
    }
  };

  const handleSaveRating = async (
    id: string,
    ratings: Partial<ExtendedCoffeeBean>
  ) => {
    try {
      const updatedBean = await store.updateBean(id, ratings);
      if (updatedBean) {
        return { success: true, bean: updatedBean };
      }
      return { success: false, error: new Error('Update rating failed') };
    } catch (error) {
      console.error('Save rating failed:', error);
      return { success: false, error };
    }
  };

  const handleQuickDecrement = async (
    beanId: string,
    currentValue: string,
    decrementAmount: number
  ) => {
    try {
      const currentNum = parseFloat(currentValue);
      if (isNaN(currentNum)) {
        return { success: false, error: new Error('Invalid current value') };
      }

      const actualDecrement = Math.min(decrementAmount, currentNum);
      const newValue = Math.max(0, currentNum - actualDecrement);
      const formattedValue = newValue.toFixed(1);
      const reducedToZero = currentNum < decrementAmount;

      await store.updateBean(beanId, { remaining: formattedValue });

      return {
        success: true,
        value: formattedValue,
        actualDecrementAmount: actualDecrement,
        reducedToZero,
      };
    } catch (error) {
      console.error('Quick decrement failed:', error);
      return { success: false, error };
    }
  };

  const handleShare = async (
    bean: ExtendedCoffeeBean,
    copyFunction: (text: string) => void
  ) => {
    try {
      const shareableBean = {
        name: bean.name,
        roaster: bean.roaster,
        capacity: bean.capacity,
        roastLevel: bean.roastLevel,
        roastDate: bean.roastDate,
        flavor: bean.flavor,
        blendComponents: bean.blendComponents,
        price: bean.price,
        beanType: bean.beanType,
        notes: bean.notes,
        startDay: bean.startDay,
        endDay: bean.endDay,
      };

      try {
        const { beanToReadableText } = await import('@/lib/utils/jsonUtils');
        const readableText = beanToReadableText(
          shareableBean as Parameters<typeof beanToReadableText>[0]
        );
        copyFunction(readableText);
        return { success: true };
      } catch {
        const jsonString = JSON.stringify(shareableBean, null, 2);
        copyFunction(jsonString);
        return { success: true, usedFallback: true };
      }
    } catch (error) {
      return { success: false, error };
    }
  };

  return {
    handleSaveBean,
    handleDelete,
    handleSaveRating,
    handleQuickDecrement,
    handleShare,
  };
};
