import type { Chapter } from '../types';

export const ch01: Chapter = {
  slug: 'catalog',
  n: 1,
  title: 'lib/catalog.ts',
  goal: 'Declare four components and their props, and get a system prompt for free.',
  minutes: 12,
  why: [
    'Create `lib/catalog.ts`. This is the vocabulary: the complete list of component names a spec is allowed to use, and the shape of the props each one takes.',
    'It is read by two very different readers. TypeScript reads it to type `props` inside your React and to force the registry to be complete. `catalog.prompt()` reads it to build the system prompt — every description and every Zod field is serialised into the text a model sees. The model never reads your components; it reads this file.',
    'That is why `description` is not documentation etiquette. It is the only instruction the model gets about when to use a component. A vague description produces a vague spec.',
    'Two components and two props is enough to render something. Four is enough to make the point. Resist adding more until a spec actually needs them — every entry widens what a model can emit.',
  ],
  files: [
    {
      path: 'lib/catalog.ts',
      lang: 'ts',
      notes: [
        {
          lines: [1, 1],
          title: 'defineCatalog',
          body: 'Comes from the framework-agnostic core. It takes a schema and your catalog data and returns an object with `prompt()`, `jsonSchema()`, `validate()` and the type information the registry needs.',
        },
        {
          lines: [2, 2],
          title: 'The React schema',
          body: 'A schema describes the SHAPE of a spec — here, `{ root, elements }` with flat keyed elements. It is imported from `@json-render/react/schema`, a separate entry point from the main package. Import it from `@json-render/react` and it is not there.',
        },
        {
          lines: [3, 4],
          title: 'Zod, and only Zod',
          body: 'Props are declared with Zod because the library walks the schema to describe each prop in the prompt. A hand-written TypeScript interface would type your React but tell the model nothing.',
        },
        {
          lines: [5, 11],
          title: 'Two readers, one file',
          body: 'Keep this comment in your own copy. The single most common catalog mistake is writing it for the compiler and forgetting the second reader.',
        },
        {
          lines: [12, 13],
          title: 'defineCatalog(schema, data)',
          body: 'Exported as a value, not a type: the registry needs it at runtime, and `typeof catalog` carries the component names into your component map. `components` is a map from NAME to definition, and the name is exactly what a spec puts in its `type` field.',
        },
        {
          lines: [14, 15],
          title: 'Page, and its description',
          body: 'The description says "exactly one per spec, always the root". That sentence exists to stop a model nesting a second Page inside the first — a rule the type system cannot express but the prompt can.',
        },
        {
          lines: [16, 19],
          title: 'props, and why nullable beats optional',
          body: '`z.object` is the prop contract. Prefer `.nullable()` over `.optional()`: structured output from most providers emits an explicit `null` far more reliably than it omits a key, and a nullable field survives a JSON round-trip unchanged. Your component then handles one case — null — instead of two.',
        },
        {
          lines: [20, 20],
          title: "slots: ['default']",
          body: 'Declares that this component wraps children. It documents the intent for the model and for you. Be aware of what it does NOT do: the renderer passes `children` to a component whether or not you declare a slot, so an omitted `slots` array does not stop children rendering.',
        },
        {
          lines: [21, 23],
          title: 'example',
          body: 'One valid props object. It is inlined into the prompt as a worked example, which is worth more to a model than the schema text alone. Give it realistic values from your domain, not "foo".',
        },
        {
          lines: [24, 32],
          title: 'Stack — the workhorse',
          body: 'Every layout decision a spec can make lives in this one entry. Two enums, not free strings: an enum becomes a closed list in the prompt, so the model cannot ask for `gap: "medium-ish"`.',
        },
        {
          lines: [33, 42],
          title: 'Heading, with a string level',
          body: "`level` is `z.enum(['1','2','3'])`, not `z.number()`. Numeric enums come back from models as strings often enough that a string enum removes a whole class of coercion bug — and levels are labels, not arithmetic.",
        },
        {
          lines: [43, 52],
          title: 'Text — one component for all prose',
          body: 'Resist Paragraph, Caption, Label and Hint as separate entries. One component with a `tone` enum gives the model one decision instead of four, and gives you one place to change type styles.',
        },
        {
          lines: [53, 54],
          title: 'Closing the components map',
          body: 'Four names. That is the entire vocabulary a spec may use until chapter five widens it.',
        },
        {
          lines: [55, 59],
          title: 'actions: {} is not optional',
          body: '`defineCatalog` requires the key even when it is empty — leave it out and the call does not type-check. An empty map also keeps `actions` optional in `defineRegistry`; the moment you put one entry here, the registry stops compiling until it has a handler.',
        },
      ],
    },
  ],
  mistakes: [
    {
      wrong: "import { schema } from '@json-render/react';",
      lang: 'ts',
      why: 'The schema lives at the `@json-render/react/schema` subpath. The main entry point does re-export it, but reaching for the subpath is the habit that keeps working when you define your own schema.',
    },
    {
      wrong: "props: z.object({ title: z.string().optional() })",
      lang: 'ts',
      why: 'Not wrong, but weaker than `.nullable()`. An optional key can be absent, null, or present — three states for your component to handle, and the least reliable one for a model to emit.',
    },
    {
      wrong: "Badge: { props: z.object({ label: z.string() }), slots: [] }",
      lang: 'ts',
      why: 'No `description`. It compiles, and the entry is effectively invisible to a model: the prompt will list a name with nothing to say about when to use it.',
    },
    {
      wrong: "export const catalog = defineCatalog(schema, { components: { … } });",
      lang: 'ts',
      why: 'Missing `actions`. The parameter type requires the key, so this fails to compile with a long inference error that never mentions the word "actions" first. Add `actions: {}`.',
    },
    {
      wrong: "props: z.object({ tone: z.string() })",
      lang: 'ts',
      why: 'A free string in the prompt is an invitation. Use `z.enum([...])` for anything with a fixed set of values, and your component gets an exhaustive switch for free.',
    },
  ],
  tryIt: {
    instruction: 'The preview below renders the prompt this catalog generates. Find the sentence you wrote as `description` for Stack, and find the `example` object. Then read what it says about Heading\'s `level`.',
    check: 'You can point at the exact line of prompt text that each catalog field produced.',
  },
  refs: ['util-definecatalog'],
  steps: ['catalog', 'build-catalog'],
};
