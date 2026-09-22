'use client';

import { defineRegistry } from '@json-render/react';
import { catalog } from './catalog';
import { components } from './components';
import type { Invoice } from './invoices';

/**
 * THE REGISTRY. Where the catalog and the React meet.
 *
 * `defineRegistry` returns three things: the `registry` the Renderer walks,
 * a `handlers` factory for the provider, and `executeAction` for firing an
 * action imperatively from outside the tree.
 */
export const { registry, handlers, executeAction } = defineRegistry(catalog, {
  components,

  // Required now, because the catalog declares `markPaid`. Delete this key
  // and the file stops compiling — that is the catalog doing its job.
  actions: {
    /**
     * Handlers MUST be async: the type is `Promise<void>`. The dispatcher
     * awaits the promise to decide between `onSuccess` and `onError`, so a
     * synchronous handler would leave it nothing to wait for.
     */
    markPaid: async (params, setState) => {
      const id = params?.id;
      // Throwing is how you reach `onError`. Returning early looks like success.
      if (!id) throw new Error('markPaid was dispatched without an invoice id.');

      await new Promise((resolve) => setTimeout(resolve, 350));

      setState((prev) => ({
        ...prev,
        invoices: (prev.invoices as Invoice[]).map((invoice) =>
          invoice.id === id
            ? { ...invoice, status: 'paid' as const, note: params?.note ?? invoice.note }
            : invoice,
        ),
      }));
    },
  },
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
