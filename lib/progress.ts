'use client';

import { useSyncExternalStore } from 'react';

/**
 * Learner progress, in localStorage.
 *
 * Deliberately tiny and deliberately defensive: every read and every write is
 * wrapped, because `localStorage` throws in Safari private mode and returns
 * null in a fresh profile. A playground that crashes because nobody has ever
 * ticked a checkbox is worse than one that forgets.
 *
 * Read it with `useProgress()` — a `useSyncExternalStore` over a cached
 * snapshot, so the object identity only changes when something actually
 * changed and React never tears between two reads in one render.
 */

const KEY = 'jr-progress';

export interface CheckpointScore {
  score: number;
  total: number;
  /** Epoch ms of the attempt. */
  at: number;
}

export interface Progress {
  /** step slug → done */
  done: Record<string, boolean>;
  /** group slug → last score */
  checkpoints: Record<string, CheckpointScore>;
  /** The track the learner picked, if any. */
  track?: string;
}

const EMPTY: Progress = { done: {}, checkpoints: {} };

let cache: Progress | null = null;
const listeners = new Set<() => void>();

function read(): Progress {
  if (cache) return cache;
  let next = EMPTY;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Progress>;
      next = {
        done: parsed.done && typeof parsed.done === 'object' ? parsed.done : {},
        checkpoints: parsed.checkpoints && typeof parsed.checkpoints === 'object' ? parsed.checkpoints : {},
        ...(typeof parsed.track === 'string' ? { track: parsed.track } : {}),
      };
    }
  } catch {
    next = EMPTY;
  }
  cache = next;
  return next;
}

function write(next: Progress) {
  cache = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* quota, private mode — the in-memory cache still works for this session */
  }
  for (const l of listeners) l();
}

/** Current progress. Safe to call on the server: returns the empty record. */
export function getProgress(): Progress {
  if (typeof window === 'undefined') return EMPTY;
  return read();
}

export function setStepDone(slug: string, done: boolean) {
  if (typeof window === 'undefined') return;
  const prev = read();
  const nextDone = { ...prev.done };
  if (done) nextDone[slug] = true;
  else delete nextDone[slug];
  write({ ...prev, done: nextDone });
}

export function setCheckpointScore(group: string, score: CheckpointScore) {
  if (typeof window === 'undefined') return;
  const prev = read();
  write({ ...prev, checkpoints: { ...prev.checkpoints, [group]: score } });
}

export function setTrack(track: string) {
  if (typeof window === 'undefined') return;
  const prev = read();
  if (prev.track === track) return;
  write({ ...prev, track });
}

export function resetProgress() {
  if (typeof window === 'undefined') return;
  write({ done: {}, checkpoints: {} });
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  // Another tab ticking a box should move this one too.
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      cache = null;
      listener();
    }
  };
  try {
    window.addEventListener('storage', onStorage);
  } catch {
    /* no window */
  }
  return () => {
    listeners.delete(listener);
    try {
      window.removeEventListener('storage', onStorage);
    } catch {
      /* no window */
    }
  };
}

/**
 * Progress in a component. Server-rendered as EMPTY, then hydrated — which is
 * why every consumer must render the same markup for "nothing done yet".
 */
export function useProgress(): Progress {
  return useSyncExternalStore(subscribe, read, () => EMPTY);
}
