/**
 * 本地变更监听器
 *
 * 职责：监听 Store 发出的数据变更事件，触发同步到云端
 *
 * 设计说明：
 * - 只处理包含完整数据对象的事件（来自 Store）
 * - 忽略 UI 组件发出的纯通知事件（无数据对象）
 * - 忽略 source === 'remote' 的事件（避免循环）
 */

import { SYNC_TABLES } from '../../syncOperations';
import type { RealtimeSyncTable } from '../types';
import type { Method } from '@/lib/core/config';

/**
 * 同步回调函数类型
 */
export type SyncCallback = (
  table: RealtimeSyncTable,
  action: 'create' | 'update' | 'delete',
  recordId: string,
  data?: Record<string, unknown>
) => void;

/**
 * 设置同步回调函数类型
 */
export type SettingsSyncCallback = () => void;

/**
 * 本地变更监听器类
 */
export class LocalChangeListener {
  private cleanup: (() => void) | null = null;

  /**
   * 开始监听本地变更事件
   *
   * @param onSync - 数据变更时的同步回调
   * @param onSettingsSync - 设置变更时的同步回调
   */
  start(onSync: SyncCallback, onSettingsSync: SettingsSyncCallback): void {
    if (typeof window === 'undefined') return;
    if (this.cleanup) {
      this.stop(); // 先清理旧的监听器
    }

    // 咖啡豆变更
    const handleBeanChange = (e: CustomEvent) => {
      const { action, beanId, bean, source } = e.detail;
      if (source === 'remote') return;

      // 只有非删除操作才需要数据对象
      if (action !== 'delete' && !bean) return;

      const id = beanId || (bean as { id?: string })?.id;
      if (!id) {
        console.warn('[LocalListener] bean 事件缺少 id');
        return;
      }

      const normalizedAction = action === 'add' ? 'create' : action;
      onSync(SYNC_TABLES.COFFEE_BEANS, normalizedAction, id, bean);
    };

    // 冲煮记录变更
    const handleNoteChange = (e: CustomEvent) => {
      const { action, noteId, note, source } = e.detail;
      if (source === 'remote') return;

      // 只有非删除操作才需要数据对象
      if (action !== 'delete' && !note) return;

      const id = noteId || (note as { id?: string })?.id;
      if (!id) {
        console.warn('[LocalListener] note 事件缺少 id');
        return;
      }

      const normalizedAction = action === 'add' ? 'create' : action;
      onSync(SYNC_TABLES.BREWING_NOTES, normalizedAction, id, note);
    };

    // 器具变更
    const handleEquipmentChange = (e: CustomEvent) => {
      const { action, equipmentId, equipment, source } = e.detail;
      if (source === 'remote') return;

      // 只有非删除操作才需要数据对象
      if (action !== 'delete' && !equipment) return;

      const id = equipmentId || (equipment as { id?: string })?.id;
      if (!id) {
        console.warn('[LocalListener] equipment 事件缺少 id');
        return;
      }

      const normalizedAction = action === 'add' ? 'create' : action;
      onSync(SYNC_TABLES.CUSTOM_EQUIPMENTS, normalizedAction, id, equipment);
    };

    // 方案变更
    // custom_methods 表结构特殊：{ equipmentId, methods[] }
    // 只有当 methods 数组为空且 action 为 delete 时，才是真正删除
    const handleMethodChange = (e: CustomEvent) => {
      const { action, equipmentId, methods, source } = e.detail;
      if (source === 'remote') return;
      if (!equipmentId) {
        console.warn('[LocalListener] 方案变更缺少 equipmentId');
        return;
      }

      const methodsArray = (methods || []) as Method[];
      const data = { equipmentId, methods: methodsArray };
      const isRealDelete = action === 'delete' && methodsArray.length === 0;

      onSync(
        SYNC_TABLES.CUSTOM_METHODS,
        isRealDelete ? 'delete' : 'update',
        equipmentId,
        data
      );
    };

    // 设置变更
    const handleSettingsChange = (e: Event) => {
      const customEvent = e as CustomEvent;
      // 如果是远程同步触发的变更，忽略之
      if (customEvent.detail?.source === 'remote') return;
      onSettingsSync();
    };

    // 添加监听器
    window.addEventListener(
      'coffeeBeanDataChanged',
      handleBeanChange as EventListener
    );
    window.addEventListener(
      'brewingNoteDataChanged',
      handleNoteChange as EventListener
    );
    window.addEventListener(
      'customEquipmentDataChanged',
      handleEquipmentChange as EventListener
    );
    window.addEventListener(
      'customMethodDataChanged',
      handleMethodChange as EventListener
    );
    window.addEventListener('settingsChanged', handleSettingsChange);
    window.addEventListener('grinderDataChanged', handleSettingsChange);

    // 保存清理函数
    this.cleanup = () => {
      window.removeEventListener(
        'coffeeBeanDataChanged',
        handleBeanChange as EventListener
      );
      window.removeEventListener(
        'brewingNoteDataChanged',
        handleNoteChange as EventListener
      );
      window.removeEventListener(
        'customEquipmentDataChanged',
        handleEquipmentChange as EventListener
      );
      window.removeEventListener(
        'customMethodDataChanged',
        handleMethodChange as EventListener
      );
      window.removeEventListener('settingsChanged', handleSettingsChange);
      window.removeEventListener('grinderDataChanged', handleSettingsChange);
    };
  }

  /**
   * 停止监听
   */
  stop(): void {
    if (this.cleanup) {
      this.cleanup();
      this.cleanup = null;
    }
  }
}

// 导出单例
export const localChangeListener = new LocalChangeListener();
