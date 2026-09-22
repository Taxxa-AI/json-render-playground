'use client';

import { defineRegistry } from '@json-render/react';
import { catalog } from './catalog';
import { components } from './components';

/**
 * THE REGISTRY. Where the catalog and the React meet.
 *
 * `defineRegistry` returns three things. You need the first one today and
 * the second one the moment your catalog declares an action.
 */
export const { registry, handlers, executeAction } = defineRegistry(catalog, {
  components,
});

/**
 * Rendered for any element whose `type` is not in the registry.
 *
 * Pass it to <Renderer fallback={...} />. Without it an unknown type renders
 * nothing at all, which looks exactly like a working page with a missing row.
 */
export function UnknownComponent({ element }: { element: { type: string } }) {
  return (
    <div className="rounded-md border border-dashed border-red-300 bg-red-50 px-2.5 py-1.5 font-mono text-[12px] text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
      unknown component: {element.type}
    </div>
  );
}
