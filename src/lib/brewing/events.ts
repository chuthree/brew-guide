/**
 * 发送事件通知
 * @param eventName 事件名称
 * @param data 事件数据
 */
export const emitEvent = <T>(eventName: string, data: T): void => {
  if (typeof window === 'undefined') return;

  const event = new CustomEvent(eventName, { detail: data });
  window.dispatchEvent(event);
};

/**
 * 监听事件
 * @param eventName 事件名称
 * @param handler 事件处理函数
 * @returns 清理函数
 */
export const listenToEvent = <T>(
  eventName: string,
  handler: (data: T) => void
): (() => void) => {
  if (typeof window === 'undefined') return () => {};

  const wrappedHandler = (e: CustomEvent<T>) => handler(e.detail);
  window.addEventListener(eventName, wrappedHandler as EventListener);

  return () => {
    window.removeEventListener(eventName, wrappedHandler as EventListener);
  };
};
