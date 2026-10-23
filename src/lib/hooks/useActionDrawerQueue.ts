'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';

const queue: { token: symbol; priority: number }[] = [];
let activeToken: symbol | undefined;
let transitionTimer: ReturnType<typeof setTimeout> | undefined;
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
const getSnapshot = () => activeToken;
const getServerSnapshot = () => undefined;

function notify() {
  listeners.forEach(listener => listener());
}

function nextToken() {
  return queue.reduce<(typeof queue)[number] | undefined>(
    (next, entry) =>
      !next || entry.priority > next.priority ? entry : next,
    undefined
  )?.token;
}

function schedule() {
  if (transitionTimer !== undefined) return;
  const next = nextToken();
  if (next === activeToken) return;

  if (activeToken !== undefined) {
    activeToken = undefined;
    // Let the current drawer finish closing before presenting its replacement.
    transitionTimer = setTimeout(() => {
      transitionTimer = undefined;
      schedule();
    }, 500);
  } else {
    activeToken = next;
  }
  notify();
}

function remove(token: symbol) {
  const index = queue.findIndex(entry => entry.token === token);
  if (index === -1) return;
  queue.splice(index, 1);
  schedule();
}

/** Higher priorities interrupt lower ones, which resume after the interruption. */
export function useActionDrawerQueue(isOpen: boolean, priority = 0) {
  const [token] = useState(() => Symbol('action-drawer'));
  const active = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  useEffect(() => {
    if (isOpen) {
      const entry = queue.find(entry => entry.token === token);
      if (entry) entry.priority = priority;
      else queue.push({ token, priority });
      schedule();
      return;
    }

    remove(token);
  }, [isOpen, token, priority]);

  useEffect(() => () => remove(token), [token]);

  return isOpen && active === token;
}
