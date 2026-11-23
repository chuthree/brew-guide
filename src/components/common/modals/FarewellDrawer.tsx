'use client';

import { useCallback, useEffect, useState } from 'react';
import ActionDrawer from '@/components/common/ui/ActionDrawer';
import { useCoffeeBeanStore } from '@/lib/stores/coffeeBeanStore';
import { useBrewingNoteStore } from '@/lib/stores/brewingNoteStore';

import { AuthorMessage } from './SupportDrawer';
import { useSettingsStore } from '@/lib/stores/settingsStore';

const dismissedKey = 'farewellDrawerDismissed';
const eligibilityCutoff = Date.parse('2026-10-01T00:00:00+08:00');
const day = 24 * 60 * 60 * 1000;
const title = '短暂的离别为了更好的相见';

export default function FarewellDrawer() {
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(dismissedKey) === '1';
    } catch {
      return true;
    }
  });
  useEffect(() => {
    const store = useBrewingNoteStore.getState();
    if (!dismissed && !store.initialized) void store.loadNotes();
  }, [dismissed]);
  const [now] = useState(Date.now);
  const username = useSettingsStore(state => state.settings.username?.trim());
  const greeting = username ? `Hi ${username}` : 'Hi';
  const firstBean = useCoffeeBeanStore(state =>
    state.initialized
      ? state.beans.reduce((min, bean) => {
          const added = bean.createdAt ?? bean.timestamp;
          return added > 0 ? Math.min(min, added) : min;
        }, Infinity)
      : null
  );
  const firstNote = useBrewingNoteStore(state =>
    state.initialized
      ? state.notes.reduce(
          (min, note) =>
            !note.source && note.timestamp > 0
              ? Math.min(min, note.timestamp)
              : min,
          Infinity
        )
      : null
  );
  const close = useCallback(() => {
    setDismissed(true);
    try {
      localStorage.setItem(dismissedKey, '1');
    } catch {
      // 存储不可写时，本次打开首页仍然可以关闭。
    }
  }, []);
  if (firstBean === null || firstNote === null) return null;
  const firstRecord = Math.min(firstBean, firstNote);
  if (firstRecord >= eligibilityCutoff) return null;
  const elapsed = now - firstRecord;

  return (
    <ActionDrawer
      title={title}
      historyId="farewell"
      priority={0}
      isOpen={!dismissed}
      onClose={close}
    >
      <div className="max-h-[calc(100dvh-7rem)] overflow-y-auto overscroll-contain pb-2">
        <AuthorMessage
          readingPace
          compact
          messages={[
            `${greeting}，如果看到这条信息，恭喜升级到最新版啦！`,
            '……',
            '只不过嘛，这个小工具就要告一段落了～',
            `感谢你这${Math.floor(elapsed / day)}天的陪伴，再见👋～`,
            '( 现有的功能我也会尽量维护的)',
          ]}
          reply="下次见～"
          onClose={close}
        />
      </div>
    </ActionDrawer>
  );
}
