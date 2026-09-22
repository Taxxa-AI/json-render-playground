import type { Chapter } from '../types';

export const ch04: Chapter = {
  slug: 'render',
  n: 4,
  title: 'The first render',
  goal: 'Write a spec by hand, seed a store, and get pixels on the screen.',
  minutes: 14,
  why: [
    'Two files. `lib/spec.ts` holds a spec written by hand; `app/page.tsx` wraps the renderer in the provider stack and gives it a store.',
    'A spec is FLAT. `elements` is a map from key to element, and nesting is expressed by an element listing other keys in its `children` array. It looks less natural than a tree until the first time you have to patch one field of one node in a stream — then the flat map is the only shape that works.',
    'The store is the part people get wrong. A spec may carry a `state` field, and the renderer NEVER reads it. State comes from the provider, which means you seed it — from your domain model, from a fetch, from anywhere. If a `$state` expression renders blank, the path is missing from the STORE, not from the spec.',
    '`JSONUIProvider` is a stack of four providers plus two context values: state, visibility, validation, actions, `functions` and `directives`. You can assemble them by hand when you need to interleave your own context; until then one component is enough.',
  ],
  files: [
    {
      path: 'lib/spec.ts',
      lang: 'ts',
      notes: [
        {
          lines: [1, 2],
          title: 'A type-only import',
          body: '`Spec` is the generic flat-spec shape: `{ root, elements, state? }` with `props` as an open record. It is deliberately loose — the catalog\'s typed spec exists too, but this one lets you write a spec before the props are settled.',
        },
        {
          lines: [3, 9],
          title: 'Flat, not nested',
          body: 'The single most important sentence about the format. A nested tree can be converted with `nestedToFlat`, and a stream of patches only makes sense against a flat map, so flat is the canonical form.',
        },
        {
          lines: [10, 11],
          title: 'root',
          body: 'A key into `elements`, not an element. Point it at a key that does not exist and `validateSpec` reports `root_not_found`; the renderer simply draws nothing.',
        },
        {
          lines: [12, 14],
          title: 'The elements map',
          body: 'Keys are yours to choose and they are the identity of each node. Keep them meaningful — they show up in validation messages, in stream patches, and in any diff you ever read.',
        },
        {
          lines: [15, 15],
          title: 'A literal and an expression, side by side',
          body: '`title` is a plain string. `subtitle` is `{ $state: "/company" }`, a JSON Pointer read against the store. Both arrive at your component as strings; only one of them changes when state changes.',
        },
        {
          lines: [16, 17],
          title: 'children is a list of KEYS',
          body: 'Not objects. This is what makes the format patchable: adding a child is one array push, and moving a subtree does not move any element definition.',
        },
        {
          lines: [18, 22],
          title: 'A leaf',
          body: '`children: []` is not required by the type, but writing it everywhere means you never have to ask whether a node is a leaf or just unfinished.',
        },
        {
          lines: [23, 27],
          title: 'Layout is an element too',
          body: 'There is no CSS in a spec. A Stack element is how a spec says "these two things are a column with a small gap", and your component decides what that means.',
        },
        {
          lines: [28, 39],
          title: 'Two Texts, two tones',
          body: 'Note `tone: null` rather than an omitted key. The schema is nullable; being explicit keeps the JSON shape stable across the hand-written, generated and compiled versions of this same spec.',
        },
      ],
    },
    {
      path: 'app/page.tsx',
      lang: 'tsx',
      notes: [
        {
          lines: [1, 2],
          title: 'The page is a Client Component',
          body: 'Every provider here is React context. Do your fetching in a Server Component above this one and pass the rows down as props; the boundary belongs here, not deeper.',
        },
        {
          lines: [3, 4],
          title: 'Three imports from the react package',
          body: '`JSONUIProvider` supplies the contexts, `Renderer` walks the spec, `createStateStore` builds a simple in-memory store. The store is framework-agnostic — you can build one in a test with no React at all.',
        },
        {
          lines: [5, 8],
          title: 'Relative imports, deliberately',
          body: 'These are the files you created in chapters zero to four. In your own project `@/lib/registry` reads better; the paths are what matters.',
        },
        {
          lines: [9, 15],
          title: 'Provider outside, Renderer inside',
          body: 'Always this order. `Renderer` uses the state and action contexts, so it has to be a descendant of the provider. Putting them as siblings fails at runtime with a context error, not a type error.',
        },
        {
          lines: [16, 19],
          title: 'Create the store once',
          body: 'This is the bug everybody writes. `createStateStore(...)` called directly in the body builds a new store on every render, so every keystroke is discarded on the render it triggers. `useState(factory)` runs the factory on the first render only.',
        },
        {
          lines: [20, 21],
          title: 'Seeding is YOUR job',
          body: 'The renderer never reads `spec.state`. Whatever a spec declares there is inert until you copy it into a store — which is exactly what chapter eleven has to do for a generated spec.',
        },
        {
          lines: [22, 25],
          title: 'The seed itself',
          body: '`/company` is what the spec\'s `$state` expression reads. `/invoices` is not used yet; it is here because chapter six repeats over it, and seeding early makes the list appear the moment the spec asks for it.',
        },
        {
          lines: [26, 28],
          title: 'The provider, minimally',
          body: 'Two props today: the registry and the store. Handlers, validation functions, `functions` and `directives` are added in later chapters, and each one is opt-in.',
        },
        {
          lines: [29, 32],
          title: 'The Renderer',
          body: '`registry` is passed twice — once to the provider, once to the renderer — and that is not a mistake. They are separate concerns: the provider registers contexts, the renderer resolves element types. `fallback` catches every name the registry does not know.',
        },
      ],
    },
  ],
  mistakes: [
    {
      wrong: '{\n  "root": "page",\n  "elements": { "page": { "type": "Page", "props": { "title": "Hi" }, "children": [{ "type": "Text" }] } }\n}',
      lang: 'json',
      why: 'children holds KEYS, not element objects. The nested object is not a key, so nothing renders and `validateSpec` cannot even name the missing child.',
    },
    {
      wrong: 'export const spec: Spec = {\n  root: "page",\n  elements: { … },\n  state: { company: "Ardmore Books" },\n};',
      lang: 'ts',
      why: 'The renderer never reads `spec.state`. The subtitle renders blank and nothing anywhere warns you. Seed the STORE instead.',
    },
    {
      wrong: 'const store = createStateStore({ company: "Ardmore Books" });',
      lang: 'tsx',
      why: 'In a component body this runs on every render. The first write re-renders, the re-render replaces the store, and the write is gone. Wrap it in `useState(() => …)`.',
    },
    {
      wrong: '<JSONUIProvider registry={registry} store={store} />\n<Renderer spec={spec} registry={registry} />',
      lang: 'tsx',
      why: 'Siblings, not nested. The renderer throws looking for the state context, and the message points at a hook rather than at this line.',
    },
    {
      wrong: 'props: { title: "Invoice review", subtitle: "$state:/company" }',
      lang: 'ts',
      why: 'Expressions are OBJECTS, not prefixed strings. This renders the literal text `$state:/company`.',
    },
  ],
  tryIt: {
    instruction: 'Edit the seed below. Change `/company`, and the subtitle follows. Then delete the `company` key entirely and watch the subtitle go blank rather than error.',
    check: 'You can make the subtitle change and disappear without touching the spec.',
  },
  refs: ['prov-jsonuiprovider', 'prov-renderer', 'expr-bindstate'],
  steps: ['shape', 'providers', 'state'],
};
