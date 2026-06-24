export function hasLocalStorageKey(key: string): boolean {
  if (typeof window === 'undefined') return false;

  try {
    for (let index = 0; index < window.localStorage.length; index += 1) {
      if (window.localStorage.key(index) === key) return true;
    }
  } catch {
    return false;
  }

  return false;
}
