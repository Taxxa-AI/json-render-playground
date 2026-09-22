import type { Chapter } from '../types';

export const ch02: Chapter = {
  slug: 'components',
  n: 2,
  title: 'lib/components.tsx',
  goal: 'Write four ordinary React components and let the catalog type their props.',
  minutes: 12,
  why: [
    'Create `lib/components.tsx`. There is nothing json-render-specific in the bodies: these are the components you would have written anyway.',
    'The one thing worth internalising is that props arrive ALREADY RESOLVED. By the time your function runs, `{ $state: "/company" }` is the string, `{ $item: "status" }` is the row\'s status, and `{ $cond: … }` has already picked a branch. You never see an expression. That is the renderer\'s job and it happens before the call.',
    'The second thing: `Components<typeof catalog>` makes the map total. Miss a name and the object is not assignable; misspell a prop and the line is red. The catalog is the source of truth and this file is checked against it.',
    'Third, the guard: treat every prop as if it might be null, because a generated spec can hand you one whatever the Zod schema said — the renderer does not validate props against the catalog at render time.',
  ],
  files: [
    {
      path: 'lib/components.tsx',
      lang: 'tsx',
      notes: [
        {
          lines: [1, 2],
          title: "'use client'",
          body: 'Required. These functions run inside React context — the state store, the action dispatcher and the validation registry are all context — so they cannot be Server Components. Put the directive at the top of the file, not on each function.',
        },
        {
          lines: [3, 4],
          title: 'Components<typeof catalog>',
          body: 'A type-only import for the helper, and a VALUE import of the catalog, because `typeof catalog` needs the binding. It costs nothing at runtime: the reference is erased.',
        },
        {
          lines: [5, 12],
          title: 'What the type actually enforces',
          body: 'Three things: every catalog name is present, no extra names are, and each `props` is the Zod output type of that entry. Rename a catalog key and this file is the first thing that breaks — which is the point.',
        },
        {
          lines: [13, 14],
          title: 'The context object',
          body: 'Each function takes ONE argument. Destructure what you need: `props`, `children`, `slots`, `emit`, `on`, `bindings`, `loading`. It is not `(props, ref)` — do not reach for the React component signature here.',
        },
        {
          lines: [15, 16],
          title: 'props.title is a string, already',
          body: 'Whatever expression the spec wrote for `title`, this is the resolved value. There is no hook to call and nothing to await.',
        },
        {
          lines: [17, 17],
          title: 'The guard pattern',
          body: '`subtitle` is `.nullable()`, so it is `string | null`. Render nothing rather than an empty paragraph. Do this for every nullable prop: the renderer does NOT re-validate props against your Zod schema at render time, so a hand-edited or generated spec can hand you a shape the schema forbids.',
        },
        {
          lines: [18, 20],
          title: 'children, unconditionally',
          body: 'The renderer builds the children from the element\'s `children` array and hands them over. It does this whether or not the catalog entry declares `slots: [\'default\']` — the slots array is documentation for the model, not a gate.',
        },
        {
          lines: [21, 28],
          title: 'Enums as class lookups',
          body: 'Because `direction` and `gap` are Zod enums, these comparisons are exhaustive and TypeScript narrows them. Build the class string from an array join rather than template soup so the fallback branch is visible.',
        },
        {
          lines: [29, 32],
          title: 'A layout component is a div',
          body: 'No wrapper element per child, no cloning, no keys to manage. `children` is already a valid React node.',
        },
        {
          lines: [33, 35],
          title: 'A body, not an expression',
          body: 'Heading needs a local, so it uses a block. Note the `?? "h3"` fallback: `Number(props.level)` on an unexpected value gives `NaN`, and indexing an array with `NaN` gives `undefined`, which React would throw on.',
        },
        {
          lines: [36, 46],
          title: 'Level drives size and tag together',
          body: 'One prop, two consequences, decided here rather than in the spec. That is the division of labour: the spec says what, the component says how it looks.',
        },
        {
          lines: [47, 57],
          title: 'tone, with a default branch',
          body: 'Three tones and an else. The else is load-bearing — `tone` is nullable, so `null` has to land somewhere, and it lands on the neutral colour.',
        },
        {
          lines: [58, 62],
          title: 'The last guard',
          body: '`props.value ?? \'\'` even though the schema says `z.string()`. Cheap insurance: an element emitted mid-stream can arrive with props that are not filled in yet, and `undefined` inside a paragraph renders nothing anyway — but `{undefined}` inside a template string renders the word.',
        },
      ],
    },
  ],
  mistakes: [
    {
      wrong: "Page: (props) => <section>{props.title}</section>",
      lang: 'tsx',
      why: 'The single argument is the CONTEXT, not the props. `props.title` here is `undefined` and `props.props.title` is the value. Destructure: `({ props }) =>`.',
    },
    {
      wrong: "Text: ({ props }) => <p>{resolve(props.value)}</p>",
      lang: 'tsx',
      why: 'There is nothing to resolve. Props are resolved before your function is called; reaching for `useStateValue` to "look up" a prop means the spec should have used `$state` instead.',
    },
    {
      wrong: "Stack: ({ props, children }) => props.direction === 'row' ? <Row>{children}</Row> : null",
      lang: 'tsx',
      why: 'Returning null for a layout component silently deletes the whole subtree. Hiding belongs in the element\'s `visible` field, where the renderer can see it, not in your component.',
    },
    {
      wrong: "// lib/components.tsx with no 'use client'",
      lang: 'tsx',
      why: 'The first hook you add — `useBoundProp` in chapter five — fails at build time with a Server Component error pointing at a file that looks innocent.',
    },
  ],
  tryIt: {
    instruction: 'The preview calls these four functions directly, with hand-written props and no renderer in sight. Change the `tone` on the Text row and the `level` on the Heading row to see the branches you wrote.',
    check: 'You can produce a muted Text and a level-3 Heading without touching a spec.',
  },
  refs: ['prov-renderer', 'util-defineregistry'],
  steps: ['registry', 'build-component'],
};
