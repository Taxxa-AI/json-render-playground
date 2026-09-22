import type { Chapter } from '../types';

export const ch13: Chapter = {
  slug: 'compile',
  n: 13,
  title: 'Compile from your domain model',
  goal: 'Replace the hand-written spec with a pure function of your data — and a test that proves it.',
  minutes: 14,
  why: [
    'Hand-written specs do not survive contact with a real app, and generated specs cost money and latency. The third option is the one most production code ends up at: compile the spec from the domain model with an ordinary function.',
    'Chapter six used `repeat`, which keeps one template and lets the runtime iterate. A compiler does the opposite: it unrolls the list at build time, emitting one set of elements per invoice. You give up live array growth and you gain a spec that is a pure function of your data — diffable, cacheable, and testable without a browser.',
    'Two decisions carry the whole design. Derive element KEYS from stable ids, never from a loop counter, so two builds of the same data produce byte-identical output. And derive BINDING paths from the position in the state array, not from the position in the filtered output — that off-by-one is the bug this function exists to make impossible.',
    'Not everything should be baked. The filter still writes to state with `$bindState` and the flash still reads it with `$state`, because those change without the data changing. Compile what is fixed; leave expressions where there is genuinely something to resolve.',
  ],
  files: [
    { path: 'lib/build-spec.ts', lang: 'ts', notes: [] },
    { path: 'app/page.tsx', lang: 'tsx', notes: [] },
    { path: '__tests__/buildSpec.test.ts', lang: 'ts', notes: [] },
  ],
  mistakes: [
    {
      wrong: 'const visible = invoices.filter(i => i.status !== "paid");\nvisible.forEach((invoice, index) => {\n  …{ $bindState: `/invoices/${index}/note` }\n});',
      lang: 'ts',
      why: 'The classic. `index` is now the position in the FILTERED array, so row three writes its note onto invoice four. Iterate the full array with `entries()` and skip inside the loop.',
    },
    {
      wrong: 'const key = `row-${i}`;',
      lang: 'ts',
      why: 'Loop-counter keys change whenever the data is reordered or filtered, so a diff between two builds is meaningless and React re-mounts rows for no reason. Derive from the id.',
    },
    {
      wrong: 'elements[key] = { type: "Stack", props: {}, children: [`${key}-action`] };\n// …and the action element is only emitted when unpaid',
      lang: 'ts',
      why: 'A dangling child reference — the exact thing `validateSpec` reports as `missing_child`. When a compiler decides an element conditionally, it has to decide the reference at the same time.',
    },
    {
      wrong: 'return { root: "page", elements, state: { invoices } };',
      lang: 'ts',
      why: 'Still ignored. A compiled spec is no different: the renderer never reads `spec.state`. Your store already has the invoices — that is where the compiler read them from.',
    },
    {
      wrong: 'const spec = buildSpec(invoices, settings);   // in the component body',
      lang: 'tsx',
      why: 'A fresh spec object every render means the renderer re-resolves every prop of every element every time. Memoise on the inputs that actually change.',
    },
  ],
  tryIt: {
    instruction: 'Tick "Unpaid only" — the compiler re-runs and emits fewer elements, rather than the runtime hiding rows with `visible`. Then look at the note binding on the last row.',
    check: 'The visible row count changes the SPEC, not just what is rendered, and every note still points at its own invoice.',
  },
  refs: ['util-validatespec'],
  steps: ['patterns', 'formats'],
};
