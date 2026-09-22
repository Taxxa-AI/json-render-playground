import type { Chapter } from '../types';

export const ch03: Chapter = {
  slug: 'registry',
  n: 3,
  title: 'lib/registry.tsx',
  goal: 'Join the catalog to the implementations and get back the object the Renderer walks.',
  minutes: 8,
  why: [
    'Create `lib/registry.tsx`. It is three lines of real work: hand `defineRegistry` the catalog and the component map, and destructure what comes back.',
    'What comes back is three things. `registry` is the map the `<Renderer>` walks — component name to renderer. `handlers` is a FACTORY that builds action handlers for the provider; you will use it in chapter seven. `executeAction` fires an action by name from outside React, which is how you run something during initial data loading.',
    'The `actions` option is conditionally required, and the condition is your catalog. With `actions: {}` in the catalog it is optional; add one action entry and this file stops compiling until you supply a handler for it. That is the compile-time join working in the direction you want.',
    'Also export a fallback component here. An element whose `type` is not in the registry renders as nothing at all — not an error, not a warning, a gap. A visible placeholder turns a silent failure into an obvious one.',
  ],
  files: [
    {
      path: 'lib/registry.tsx',
      lang: 'tsx',
      notes: [
        {
          lines: [1, 2],
          title: "'use client', again",
          body: 'The registry closes over your components and is consumed by hooks. It belongs on the client, and being explicit here means the page that imports it does not have to be the boundary.',
        },
        {
          lines: [3, 5],
          title: 'Three imports, one direction',
          body: 'catalog and components both flow in. Nothing flows back out to them. That one-way arrow is why a change to the catalog surfaces here rather than somewhere subtle.',
        },
        {
          lines: [6, 12],
          title: 'What defineRegistry returns',
          body: 'Not just a map. Keep this comment: in six weeks the question you will have is "where did `handlers` come from", and the answer is this call.',
        },
        {
          lines: [13, 15],
          title: 'The call, and the conditional requirement',
          body: 'Because our catalog has `actions: {}`, the `actions` option is optional and this compiles. In chapter seven the catalog gains `markPaid` and TypeScript makes `actions` required — the error appears in THIS file, which is exactly where the missing code goes.',
        },
        {
          lines: [16, 22],
          title: 'Why a fallback is not optional in practice',
          body: 'A spec can name a component you removed, or a model can invent one. Without a fallback the element renders as nothing, which is indistinguishable from a working page. Make the failure visible.',
        },
        {
          lines: [23, 23],
          title: 'The fallback signature',
          body: 'It receives the same render props every registry component gets, so `{ element }` is enough. Typing only the field you use keeps it assignable to the library\'s `ComponentRenderer`.',
        },
        {
          lines: [24, 29],
          title: 'Loud, and dashed',
          body: 'Red, dashed, monospace — it has to be impossible to mistake for real UI in a screenshot. Print the type name; that is the one piece of information you need to fix it.',
        },
      ],
    },
  ],
  mistakes: [
    {
      wrong: "const registry = { Page, Stack, Heading, Text };",
      lang: 'tsx',
      why: 'A hand-rolled object skips the catalog check entirely, and the renderer calls registry entries with `{ element, children, emit, … }` rather than the flat props your components expect. Go through `defineRegistry`.',
    },
    {
      wrong: "export const { registry } = defineRegistry(catalog, { components });\n// …later, in the page\n<JSONUIProvider registry={registry} handlers={{ markPaid: async () => {} }} />",
      lang: 'tsx',
      why: 'Handwriting the handler map next to the provider works, but it bypasses `handlers()` and with it the typed params from the catalog. Use the factory and let the catalog type the arguments.',
    },
    {
      wrong: "<Renderer spec={spec} registry={registry} />",
      lang: 'tsx',
      why: 'No fallback. Every unknown type renders as empty space with no console error. The first time a model invents a component name you will be looking for a CSS bug.',
    },
    {
      wrong: "defineRegistry(catalog, { components, actions: {} })",
      lang: 'tsx',
      why: 'Harmless now, misleading later: it reads as "this catalog has no actions" long after the catalog has three. Let the conditional type tell you when the key is needed.',
    },
  ],
  tryIt: {
    instruction: 'The preview lists the keys `defineRegistry` produced and renders the fallback beside them. Compare the key list with the four names in your catalog.',
    check: 'The registry has exactly the catalog\'s component names — no more, no fewer.',
  },
  refs: ['util-defineregistry', 'prov-renderer'],
  steps: ['registry', 'providers'],
};
