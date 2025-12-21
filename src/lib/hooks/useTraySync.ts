/**
 * Tauri 菜单栏同步 Hook
 * 将咖啡豆数据同步到 macOS 菜单栏显示
 */
import { useEffect, useRef, useCallback } from 'react';
import { useCoffeeBeanStore } from '@/lib/stores/coffeeBeanStore';

// 检查是否在 Tauri 环境中
const isTauri = () => {
  return typeof window !== 'undefined' && '__TAURI__' in window;
};

// 简化的咖啡豆数据结构（用于传递给 Tauri）
interface TrayBeanData {
  id: string;
  name: string;
  remaining: string | null;
  capacity: string | null;
  roastDate: string | null;
  startDay: number | null;
  endDay: number | null;
  isFrozen: boolean | null;
  isInTransit: boolean | null;
}

// 独立的同步函数，可以在任何地方调用
export async function syncBeansToTray(beans: TrayBeanData[]) {
  if (!isTauri()) return;

  try {
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('update_tray_menu', { beans });
    console.log('✅ 菜单栏同步成功，咖啡豆数量:', beans.length);
  } catch (error) {
    console.debug('Tray sync failed:', error);
  }
}

/**
 * 同步咖啡豆数据到 Tauri 菜单栏
 * @param onNavigateToBean 当用户点击菜单栏中的咖啡豆时调用的回调函数
 */
export function useTraySync(onNavigateToBean?: (beanId: string) => void) {
  const beans = useCoffeeBeanStore(state => state.beans);
  const lastSyncRef = useRef<string>('');
  const callbackRef = useRef(onNavigateToBean);

  // 保持回调引用最新
  useEffect(() => {
    callbackRef.current = onNavigateToBean;
  }, [onNavigateToBean]);

  // 监听 Tauri 事件
  useEffect(() => {
    if (!isTauri()) return;

    let unlisten: (() => void) | undefined;

    const setupListener = async () => {
      try {
        const { listen } = await import('@tauri-apps/api/event');
        unlisten = await listen<string>('navigate-to-bean', event => {
          const beanId = event.payload;
          console.log('📍 收到导航事件，咖啡豆 ID:', beanId);
          callbackRef.current?.(beanId);
        });
      } catch (error) {
        console.debug('Failed to setup Tauri event listener:', error);
      }
    };

    setupListener();

    return () => {
      unlisten?.();
    };
  }, []);

  useEffect(() => {
    if (!isTauri()) return;

    // 转换数据格式，确保类型正确
    const trayBeans: TrayBeanData[] = beans
      .filter(bean => bean.beanState !== 'green') // 只显示熟豆
      .map(bean => ({
        id: bean.id,
        name: bean.name,
        remaining: bean.remaining ?? null,
        capacity: bean.capacity ?? null,
        roastDate: bean.roastDate ?? null,
        // 确保 startDay 和 endDay 是数字类型
        startDay: bean.startDay != null ? Number(bean.startDay) : null,
        endDay: bean.endDay != null ? Number(bean.endDay) : null,
        isFrozen: bean.isFrozen ?? null,
        isInTransit: bean.isInTransit ?? null,
      }));

    // 简单的去重检查，避免重复同步
    const syncKey = JSON.stringify(
      trayBeans.map(
        b =>
          `${b.id}-${b.remaining}-${b.roastDate}-${b.isFrozen}-${b.isInTransit}`
      )
    );
    if (syncKey === lastSyncRef.current) return;
    lastSyncRef.current = syncKey;

    // 执行同步
    syncBeansToTray(trayBeans);
  }, [beans]);
}
