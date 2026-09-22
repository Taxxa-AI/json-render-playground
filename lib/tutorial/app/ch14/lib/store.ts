import type { StateModel } from '@json-render/core';
import { createStoreAdapter } from '@json-render/core/store-utils';
import { INVOICES } from './invoices';

/**
 * THE STORE, hoisted out of the page.
 *
 * Until now the store lived inside the component, so only the spec could see
 * it. A module-level store is still a controlled store — but now a plain
 * React sidebar, a websocket, or a test can read and write the same model.
 */
function seed(): StateModel {
  return {
    company: 'Ardmore Books · March 2026',
    invoices: INVOICES,
    unpaidOnly: false,
    draft: { ref: '' },
    flash: '',
  };
}

let snapshot: StateModel = seed();
const listeners = new Set<() => void>();

/**
 * `createStoreAdapter` wants three callbacks and gives you the whole
 * StateStore: get, set, update, no-op detection, getServerSnapshot, subscribe.
 * Swap these three for Redux, Zustand or XState and nothing else changes.
 */
export const appStore = createStoreAdapter({
  getSnapshot: () => snapshot,

  // A NEW OBJECT every time. The store compares by reference (===), so
  // mutating `snapshot` in place would notify nobody.
  setSnapshot: (next) => {
    snapshot = next;
    for (const listener of listeners) listener();
  },

  subscribe: (listener) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
});

/** Written from outside React entirely. The spec re-renders anyway. */
export function markEverythingPaid() {
  const invoices = (appStore.get('/invoices') as Array<Record<string, unknown>>) ?? [];
  appStore.set(
    '/invoices',
    invoices.map((invoice) => ({ ...invoice, status: 'paid' })),
  );
}

/** Module state outlives the component, so give yourself a way back. */
export function resetAppState() {
  const next = seed();
  appStore.update(Object.fromEntries(Object.entries(next).map(([key, value]) => [`/${key}`, value])));
}
