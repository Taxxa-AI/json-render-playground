'use client';

import { useSearchParams } from 'next/navigation';
import { useState } from 'react';

/**
 * Open a lab at a given stage: `/steps/<slug>?stage=3` (1-based).
 *
 * Staged labs are deep in client state, so without this the only way to reach
 * stage nine is to click through eight. It makes a stage addressable — for a
 * bug report, for a link into the middle of a lesson, and for checking that
 * the panel beside a stage really is that stage's subject.
 *
 * Read through `useSearchParams` rather than `window.location` so the SERVER
 * render lands on the right stage too; otherwise the first paint is always
 * stage one and only hydration corrects it.
 */
export function useInitialStage(count: number): number {
  const params = useSearchParams();
  const raw = params.get('stage');
  const [index] = useState(() => {
    const n = raw ? Number.parseInt(raw, 10) : Number.NaN;
    return Number.isFinite(n) ? Math.min(Math.max(n - 1, 0), Math.max(count - 1, 0)) : 0;
  });
  return index;
}
