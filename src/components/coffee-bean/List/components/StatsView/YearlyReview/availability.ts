import { useSyncExternalStore } from 'react';
import { useCoffeeBeanStore } from '@/lib/stores/coffeeBeanStore';
import { useBrewingNoteStore } from '@/lib/stores/brewingNoteStore';
import { REVIEW_YEAR } from './constants';

const releaseTime = Date.parse(`${REVIEW_YEAR}-12-01T00:00:00+08:00`);
const isReleased = () => Date.now() >= releaseTime;
const serverSnapshot = () => false;

function subscribeToRelease(notify: () => void) {
  let timer: number;
  const schedule = () => {
    window.clearTimeout(timer);
    notify();
    const remaining = releaseTime - Date.now();
    if (remaining > 0) {
      // 浏览器定时器的最长延迟为 2^31 - 1 毫秒。
      timer = window.setTimeout(schedule, Math.min(remaining, 2_147_483_647));
    }
  };
  schedule();
  document.addEventListener('visibilitychange', schedule);
  return () => {
    window.clearTimeout(timer);
    document.removeEventListener('visibilitychange', schedule);
  };
}

export function useYearlyReviewAvailable() {
  const released = useSyncExternalStore(
    subscribeToRelease,
    isReleased,
    serverSnapshot
  );
  const hasEnoughBeans = useCoffeeBeanStore(state => state.beans.length >= 5);
  const hasNotes = useBrewingNoteStore(state => state.notes.length > 0);
  return released && hasEnoughBeans && hasNotes;
}
