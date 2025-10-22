/**
 * 器具排序事件总线
 * 用于在器具排序更新后通知所有器具栏组件刷新
 */

type EventHandler = () => void;

class EquipmentEventBus {
  private listeners: Set<EventHandler> = new Set();

  /**
   * 订阅器具排序更新事件
   */
  subscribe(handler: EventHandler): () => void {
    this.listeners.add(handler);
    return () => {
      this.listeners.delete(handler);
    };
  }

  /**
   * 发布器具排序更新事件
   */
  notify(): void {
    this.listeners.forEach(handler => {
      try {
        handler();
      } catch (error) {
        console.error('器具排序事件处理失败:', error);
      }
    });
  }
}

// 创建全局事件总线实例
export const equipmentEventBus = new EquipmentEventBus();
