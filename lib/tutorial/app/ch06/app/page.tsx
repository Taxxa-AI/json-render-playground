'use client';

import { JSONUIProvider, Renderer, createStateStore } from '@json-render/react';
import { useState } from 'react';
import { INVOICES } from '../lib/invoices';
import { UnknownComponent, registry } from '../lib/registry';
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
    }),
  );

  return (
    <JSONUIProvider registry={registry} store={store}>
      <Renderer spec={spec} registry={registry} fallback={UnknownComponent} />
    </JSONUIProvider>
  );
}
