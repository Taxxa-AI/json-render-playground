import { createStateStore } from '@json-render/core';
import type { StateStore } from '@json-render/core';

export interface StoreEvent {
  id: number;
  at: number;
  kind: 'set' | 'update';
  entries: Array<{ path: string; value: unknown }>;
}

/**
 * A `StateStore` decorator.
 *
 * This exists to power the playground's write log, but it doubles as the
 * smallest possible demonstration of the `StateStore` interface: five methods,
 * no React, no json-render imports beyond the type. Anything that implements
 * these five methods can back a renderer — Redux, Zustand, Jotai, XState, or a
 * store synced to a server.
 */
export function createLoggingStore(
  initial: Record<string, unknown>,
  onEvent: (e: StoreEvent) => void,
): StateStore {
  const inner = createStateStore(initial);
  let seq = 0;

  return {
    get: (path) => inner.get(path),
    getSnapshot: () => inner.getSnapshot(),
    subscribe: (listener) => inner.subscribe(listener),
    set: (path, value) => {
      // createStateStore ignores a write that does not change the value, so
      // compare snapshot identity rather than logging a no-op.
      const before = inner.getSnapshot();
      inner.set(path, value);
      if (inner.getSnapshot() === before) return;
      onEvent({ id: ++seq, at: Date.now(), kind: 'set', entries: [{ path, value }] });
    },
    update: (updates) => {
      const before = inner.getSnapshot();
      inner.update(updates);
      if (inner.getSnapshot() === before) return;
      onEvent({
        id: ++seq,
        at: Date.now(),
        kind: 'update',
        entries: Object.entries(updates).map(([path, value]) => ({ path, value })),
      });
    },
  };
}
