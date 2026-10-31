let reloadRequested = false;

export function isAppReloadRequested(): boolean {
  return reloadRequested;
}

/** 数据写入完成后使用，避免主动刷新被同步中的离开保护拦截。 */
export function reloadApp(): void {
  if (reloadRequested) return;
  reloadRequested = true;
  try {
    window.location.reload();
  } catch (error) {
    reloadRequested = false;
    throw error;
  }
}
