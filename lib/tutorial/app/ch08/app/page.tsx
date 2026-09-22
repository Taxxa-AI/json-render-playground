'use client';

import { JSONUIProvider, Renderer, type SetState, createStateStore } from '@json-render/react';
import { useMemo, useState } from 'react';
import { INVOICES } from '../lib/invoices';
import { UnknownComponent, handlers, registry } from '../lib/registry';
import { spec } from '../lib/spec';

/**
 * THE PAGE. Provider on the outside, Renderer on the inside.
 *
 * This is a Client Component because every json-render provider is built on
 * React context and hooks. Fetch on the server, pass the data down, render
 * the spec here.
 */
export default function Page() {
  // The store is created ONCE. `useState(factory)` runs the factory on the
  // first render only; `createStateStore(...)` written inline would build a
  // fresh store on every render and throw away every write.
  const [store] = useState(() =>
    createStateStore({
      company: 'Ardmore Books · March 2026',
      invoices: INVOICES,
      unpaidOnly: false,
      draft: { ref: '' },
      flash: '',
    }),
  );

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
    <JSONUIProvider
      registry={registry}
      store={store}
      handlers={actionHandlers}
      // Custom checks are plain predicates: (value, args) => boolean. They are
      // looked up by the `type` string in a field's `checks` array.
      validationFunctions={{
        notPlaceholder: (value) => String(value ?? '').trim().toUpperCase() !== 'TODO',
      }}
    >
      <Renderer spec={spec} registry={registry} fallback={UnknownComponent} />
    </JSONUIProvider>
  );
}
