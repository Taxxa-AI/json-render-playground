'use client';

import { defineRegistry } from '@json-render/react';
import { demoCatalog } from './catalog';
import { demoComponentImpls } from './components';
import { guardAll } from './guard';

/**
 * `defineRegistry` is the compile-time join between catalog and code.
 *
 * It returns three things:
 *   - registry:      what <Renderer registry={...}> consumes
 *   - handlers:      ActionProvider-compatible handlers built from `actions`
 *   - executeAction: fire an action imperatively, outside the React tree
 *
 * Because our catalog declares `actions`, TypeScript REQUIRES the `actions`
 * key here. Delete it and this file stops compiling. A catalog with
 * `actions: {}` may omit it.
 */
export const { registry: demoRegistry } = defineRegistry(demoCatalog, {
  // Every component in its own error boundary — see step 3. One bad prop
  // should break one control, not the page.
  components: guardAll(demoComponentImpls),
  /**
   * Action handlers MUST be async — `ActionFn` returns `Promise<void>`, so a
   * plain `() => {}` fails to compile. That is deliberate: an action binding
   * can declare `onSuccess`/`onError`, and the dispatcher needs something to
   * await before deciding which one to run.
   *
   * These are stubs. The playground routes real behaviour through
   * `JSONUIProvider handlers` instead, so it can log every dispatch — see
   * `SpecPlayground`. In a normal app you would put the behaviour here and
   * pass `handlers` (also returned by defineRegistry) to the provider.
   */
  actions: {
    submit: async () => {},
    notify: async () => {},
    reset: async () => {},
  },
});

/** Rendered in place of any element whose `type` is not in the registry. */
export function UnknownComponent({ element }: { element?: { type?: string } }) {
  return (
    <div className="rounded-md border border-dashed border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950 px-2.5 py-1.5 font-mono text-[12px] text-red-600 dark:text-red-400">
      unknown component: {element?.type ?? '?'}
    </div>
  );
}
