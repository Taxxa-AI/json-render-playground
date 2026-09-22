import type { Chapter } from '../types';

export const ch14: Chapter = {
  slug: 'ship',
  n: 14,
  title: 'Ship',
  goal: 'The whole app in one folder listing, and the list of things that bite in production.',
  minutes: 8,
  why: [
    'Eight files. `lib/invoices.ts` is your domain. `lib/catalog.ts` is the vocabulary. `lib/components.tsx` is the React. `lib/registry.tsx` joins the two. `lib/directives.ts` and `lib/store.ts` are the two extension points. `lib/build-spec.ts` compiles a spec from data, and `lib/prepare.ts` cleans one that arrived from a model. Plus `app/page.tsx` and, if you generate, `app/api/generate/route.ts` and `app/generate/page.tsx`.',
    'Everything that can fail silently in this stack has now bitten you once: `spec.state` is inert, a literal prop is read-only, a malformed `visible` fails open, a typo in a check type passes, built-ins ignore `confirm`, an unknown component renders nothing, and `validateForm` reports without blocking. That list is the real curriculum.',
    'The production checklist is short because most of it is ordinary web work. Cache the system prompt — `catalog.prompt()` is deterministic, so build it once per process rather than per request. Cap the user prompt, cap the element count, and put the route behind auth and a rate limit: it is a paid endpoint that a stranger can call.',
    'Then go deeper. Every chapter above has a lab that breaks the thing it just taught you, which is the part that makes it stick.',
  ],
  files: [],
  mistakes: [
    {
      wrong: 'export async function POST(req: Request) {\n  const system = catalog.prompt({ … });   // every request\n  …\n}',
      lang: 'ts',
      why: 'The prompt is deterministic and not cheap to build. Hoist it to module scope and build it once per process.',
    },
    {
      wrong: 'const { prompt } = await req.json();   // straight into the model',
      lang: 'ts',
      why: 'No length cap, no auth, no rate limit. A generation endpoint is a paid endpoint; treat it like one. `buildUserPrompt` takes `maxPromptLength`, which handles only the first of those three.',
    },
    {
      wrong: '<Renderer spec={specFromTheWire} registry={registry} />',
      lang: 'tsx',
      why: 'Straight from the network with no `prepare()` and no `fallback`. Both failure modes — a misplaced field and an invented component name — render as silence.',
    },
    {
      wrong: '// components/*.tsx with no error boundary',
      lang: 'tsx',
      why: 'One component that throws on a malformed prop blanks the whole page. Wrap each registry entry in its own boundary so a bad prop breaks one control. Note that the boundary must render `<Impl {...props} />` as a CHILD — calling `Impl(props)` inline puts the throw inside the boundary\'s own render, where it escapes.',
    },
  ],
  refs: ['util-validatespec', 'util-autofixspec', 'prov-jsonuiprovider'],
  steps: ['patterns', 'limitations'],
};
