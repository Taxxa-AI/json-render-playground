'use client';

import { useCallback, useSyncExternalStore } from 'react';

/**
 * Guided mode: a single persisted flag shared by every task strip and
 * checklist. On, the click-by-click steps for the current task are open by
 * default; off, the learner asks for them with "guide me".
 *
 * Defaults to ON for a first visit — a newcomer should not have to discover
 * that help exists.
 */
const KEY = 'jr-guided';
const listeners = new Set<() => void>();

function read(): boolean {
  try {
    const v = localStorage.getItem(KEY);
    return v === null ? true : v === 'on';
  } catch {
    return true;
  }
}

function write(on: boolean) {
  try {
    localStorage.setItem(KEY, on ? 'on' : 'off');
  } catch {
    /* private mode */
  }
  for (const l of listeners) l();
}

function subscribe(l: () => void) {
  listeners.add(l);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) l();
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(l);
    window.removeEventListener('storage', onStorage);
  };
}

export function useGuided() {
  // Server snapshot is `true` so SSR and the first client render agree.
  const guided = useSyncExternalStore(subscribe, read, () => true);
  const setGuided = useCallback((on: boolean) => write(on), []);
  return { guided, setGuided };
}
