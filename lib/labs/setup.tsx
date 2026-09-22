'use client';

import type { Spec } from '@json-render/core';
import { useEffect, useSyncExternalStore } from 'react';

/**
 * What json-render setup is behind the thing currently on screen.
 *
 * A lab knows its spec, its seed and what it handed the provider; the notes
 * drawer does not, because it lives up in the page frame. This carries it
 * across so the drawer can show the WHOLE setup for what you are looking at —
 * the spec, the catalog entries it uses, the React those names render as, and
 * the provider call that ties them together.
 */
export interface LabSetup {
  spec: Spec | null;
  seed?: Record<string, unknown>;
  /** Custom action names this lab registered, beyond the built-ins. */
  handlers?: string[];
  /** `$computed` function names. */
  functions?: string[];
  /** Custom directive keys. */
  directives?: string[];
  /**
   * Source this lab wants shown, for labs that build their own catalog and
   * registry instead of using the shared demo one.
   *
   * Without it the drawer showed the demo catalog beside a lab that never
   * used it — the wrong setup, presented as the setup.
   */
  sources?: Array<{ label: string; code: string; lang?: string }>;
}

const EMPTY: LabSetup = { spec: null };

/**
 * A module store rather than context state, written during the lab's RENDER.
 *
 * Context state has to be set from an effect, and effects do not run on the
 * server — so the drawer's first paint showed "no setup here" even though the
 * lab beside it was running one. The drawer sits after the lab in the tree, so
 * by the time it renders the lab has already written this, on the server and
 * in the browser alike.
 */
let current: LabSetup = EMPTY;
let owner: string | null = null;
let signature = '';
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Clear the store when a DIFFERENT step starts rendering.
 *
 * The store is module scope, which on the server is shared between requests
 * and in the browser survives navigation — so a lab that publishes nothing
 * inherited whatever the last one left behind, and the drawer showed a setup
 * belonging to a different step. The page frame renders before its lab, so
 * resetting here is always followed by the real publish when there is one.
 *
 * Keyed by slug, because the frame re-renders for its own reasons — opening
 * the notes drawer is one — while the lab beside it does not. An unconditional
 * reset wiped the published setup on exactly the click that goes to read it,
 * so the drawer opened on "no setup here" for every lab in the app.
 */
export function resetSetup(slug: string) {
  if (owner === slug) return;
  owner = slug;
  current = EMPTY;
}

export function useLabSetup(): LabSetup {
  return useSyncExternalStore(
    subscribe,
    () => current,
    () => current,
  );
}

/**
 * Publish from a lab.
 *
 * The signature is deliberately coarse — which component names are in play and
 * what the provider was given. The spec is re-parsed on every keystroke, so
 * comparing identity would notify on each one while the SETUP has not moved.
 */
export function usePublishSetup(next: LabSetup) {
  const sig = JSON.stringify([
    next.spec ? [...new Set(Object.values(next.spec.elements ?? {}).map((e) => e.type))].sort() : null,
    next.handlers,
    next.functions,
    next.directives,
    next.sources?.map((x) => x.label),
    Object.keys(next.seed ?? {}).sort(),
  ]);

  // Written during render so a server pass sees it; the effect only wakes
  // anyone already subscribed.
  current = next;

  useEffect(() => {
    if (sig === signature) return;
    signature = sig;
    for (const listener of listeners) listener();
  }, [sig]);
}
