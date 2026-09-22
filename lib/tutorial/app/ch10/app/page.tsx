'use client';

import { JSONUIProvider, Renderer, type SetState } from '@json-render/react';
import { useMemo, useSyncExternalStore } from 'react';
import { directives, functions } from '../lib/directives';
import { UnknownComponent, handlers, registry } from '../lib/registry';
import { spec } from '../lib/spec';
import { appStore, markEverythingPaid, resetAppState } from '../lib/store';

/**
 * THE PAGE. Provider on the outside, Renderer on the inside.
 *
 * This is a Client Component because every json-render provider is built on
 * React context and hooks. Fetch on the server, pass the data down, render
 * the spec here.
 */
export default function Page() {
  const store = appStore;

  // Your action handlers are written against a React-style setState. The
  // store speaks JSON Pointer, so this adapts one to the other: run the
  // updater on the current snapshot, then write the top-level keys back.
  const setState = useMemo<SetState>(
    () => (updater) => {
      const next = updater(store.getSnapshot());
      store.update(Object.fromEntries(Object.entries(next).map(([key, value]) => [`/${key}`, value])));
    },
    [store],
  );

  // `handlers` takes GETTERS, not values, so a handler always sees the
  // latest state rather than whatever was current when the page mounted.
  const actionHandlers = useMemo(() => handlers(() => setState, () => store.getSnapshot()), [setState, store]);

  return (
    <div className="flex flex-col gap-3 lg:flex-row">
      <Sidebar />
      <div className="min-w-0 flex-1">
        <JSONUIProvider
          registry={registry}
          store={store}
          handlers={actionHandlers}
          // Custom checks are plain predicates: (value, args) => boolean. They are
          // looked up by the `type` string in a field's `checks` array.
          validationFunctions={{
            notPlaceholder: (value) => String(value ?? '').trim().toUpperCase() !== 'TODO',
          }}
          // Both are resolution-time lookups. A `$computed` name missing from
          // `functions` warns and resolves to undefined; a `$`-key missing from
          // `directives` is not an expression at all, so the raw object reaches
          // your component and React throws on it.
          functions={functions}
          directives={directives}
        >
          <Renderer spec={spec} registry={registry} fallback={UnknownComponent} />
        </JSONUIProvider>
      </div>
    </div>
  );
}

/**
 * Plain React. No provider, no spec, no hook from json-render — it reads the
 * same store with React's own `useSyncExternalStore`, which is exactly the
 * API `StateStore` was shaped to satisfy.
 */
function Sidebar() {
  const state = useSyncExternalStore(appStore.subscribe, appStore.getSnapshot, appStore.getSnapshot);
  const invoices = (state.invoices as Array<{ status: string }>) ?? [];
  const unpaid = invoices.filter((invoice) => invoice.status !== 'paid').length;

  return (
    <aside className="flex w-full shrink-0 flex-col gap-2 rounded-xl border border-zinc-200 bg-zinc-50 p-3 lg:w-48 dark:border-zinc-800 dark:bg-zinc-900">
      <p className="font-mono text-[11px] uppercase tracking-wide text-zinc-500">outside the spec</p>
      <p className="text-[13px] text-zinc-800 dark:text-zinc-200">{unpaid} unpaid</p>
      <button
        type="button"
        onClick={markEverythingPaid}
        className="rounded-md border border-zinc-300 px-2 py-1 text-[12px] dark:border-zinc-700"
      >
        Mark all paid
      </button>
      <button
        type="button"
        onClick={resetAppState}
        className="rounded-md border border-zinc-300 px-2 py-1 text-[12px] dark:border-zinc-700"
      >
        Reset
      </button>
    </aside>
  );
}
