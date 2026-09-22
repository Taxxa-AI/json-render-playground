import type { Chapter } from '../types';

export const ch10: Chapter = {
  slug: 'stores',
  n: 10,
  title: 'Stores',
  goal: 'Hoist the store out of the page so plain React — and code with no React at all — can share it.',
  minutes: 10,
  why: [
    '`StateStore` is a tiny interface: `get`, `set`, `update`, `getSnapshot`, `subscribe`, and an optional `getServerSnapshot`. That shape is not arbitrary — it is exactly what React\'s `useSyncExternalStore` wants, which is why an ordinary component can read the same model with no json-render import.',
    '`createStoreAdapter` builds the whole interface from three callbacks: read a snapshot, write a snapshot, subscribe. Point those three at Redux, Zustand, XState or a plain module variable and everything else — pointer paths, batched updates, no-op detection — is handled.',
    'The one rule the store enforces is reference equality. `set` and `update` compare with `===`, so mutating an object in place and writing it back changes nothing and notifies nobody. Always build a new object.',
    'A module-level store is the honest trade: shared everywhere, and it outlives the component. Give yourself a reset function or you will spend an afternoon wondering why a page you navigated away from remembers what you typed.',
  ],
  files: [
    { path: 'lib/store.ts', lang: 'ts', notes: [] },
    { path: 'app/page.tsx', lang: 'tsx', notes: [] },
  ],
  mistakes: [
    {
      wrong: 'const invoices = store.get("/invoices");\ninvoices[0].status = "paid";\nstore.set("/invoices", invoices);',
      lang: 'ts',
      why: 'Same array reference in, same reference out. The store compares with `===`, sees no change, and notifies nobody. Map to a new array.',
    },
    {
      wrong: 'useSyncExternalStore(appStore.subscribe, () => appStore.getSnapshot().invoices)',
      lang: 'tsx',
      why: 'A getSnapshot that returns a derived value is fine only if the value is reference-stable. This one is, because it is the stored array — but `.filter(…)` there would loop React forever with a new array every call.',
    },
    {
      wrong: '<JSONUIProvider store={appStore} initialState={{ company: "…" }} />',
      lang: 'tsx',
      why: 'In controlled mode `initialState` and `onStateChange` are ignored outright. Seed the store itself; the prop is silently dead.',
    },
    {
      wrong: 'export const appStore = createStoreAdapter({ getSnapshot, setSnapshot, subscribe: (l) => { listeners.add(l); } });',
      lang: 'ts',
      why: '`subscribe` must return an UNSUBSCRIBE function. Returning undefined makes React throw on unmount, and in dev the double-mount means you see it immediately.',
    },
  ],
  tryIt: {
    instruction: 'Press "Mark all paid" in the sidebar. It is plain React calling `appStore.set` — no provider, no spec, no dispatch.',
    check: 'Every badge flips and the count updates, from code that imports nothing from json-render but the store.',
  },
  refs: ['prov-jsonuiprovider'],
  steps: ['stores', 'hooks'],
};
