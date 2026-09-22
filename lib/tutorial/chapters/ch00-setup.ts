import type { Chapter } from '../types';

export const ch00: Chapter = {
  slug: 'setup',
  n: 0,
  title: 'Setup',
  goal: 'Install two packages, learn the four nouns, and write the one file json-render never reads.',
  minutes: 6,
  why: [
    'json-render renders JSON as UI. You do not ship a page; you ship a vocabulary and a renderer, and the page arrives as data — written by you, by a compiler, or by a model.',
    'Four nouns, in order. The CATALOG names every component and types its props with Zod. The REGISTRY gives each catalog name a React implementation. The SPEC is a flat map of keyed elements that picks names out of the catalog. The STORE holds the state that the spec reads with `$state` and writes with `$bindState`.',
    'The dependency arrow runs one way: spec → catalog → registry. The spec can only name what the catalog declares; the catalog will not compile until the registry implements it. Nothing in the chain can invent a component.',
    'Your domain model sits outside all four. It is plain TypeScript, you seed the store from it, and you will compile a spec out of it in the last chapter. Start there.',
  ],
  files: [
    {
      path: 'lib/invoices.ts',
      lang: 'ts',
      notes: [
        {
          lines: [1, 7],
          title: 'The layer json-render cannot see',
          body: 'The library has no idea this file exists. It sees the catalog, the registry, the spec, and whatever you put in the store. Keeping the domain separate is what lets you swap a hand-written spec for a generated one later without touching your data.',
        },
        {
          lines: [8, 9],
          title: 'A closed set, not a string',
          body: 'A union type here becomes an exhaustiveness check in every `switch` you write later. The catalog will mirror it as a Zod enum, which is what stops a model from inventing the status "pending".',
        },
        {
          lines: [10, 12],
          title: 'id, and why it earns its line',
          body: 'Three separate things key off this: the `repeat` block\'s `key`, the params you send to an action, and the element keys a compiled spec derives. A list without stable ids re-mounts every row on every change.',
        },
        {
          lines: [13, 14],
          title: 'Display fields',
          body: 'Plain strings the spec will read through `$item` inside a list, or interpolate with `$template`.',
        },
        {
          lines: [15, 16],
          title: 'Integer cents',
          body: 'Never floats, and never a pre-formatted string like "€482.50". A formatted string cannot be summed, cannot be re-localised, and forces the model to do arithmetic in prose. Chapter nine adds a `$money` directive that formats these at render time instead.',
        },
        {
          lines: [17, 19],
          title: 'status and note',
          body: '`status` drives a Badge and a visibility condition; `note` is the one field the user edits, so it is the one field a two-way binding will point at.',
        },
        {
          lines: [20, 25],
          title: 'The seed',
          body: 'Three rows, hard-coded. In a real app this is a database query on the server, passed into the Client Component as a prop. Everything after this chapter treats this array as the truth.',
        },
      ],
    },
  ],
  mistakes: [
    {
      wrong: "amount: '€482.50'",
      lang: 'ts',
      why: 'A formatted string cannot be summed, compared or re-localised, and every consumer has to parse it back. Store cents; format at the edge.',
    },
    {
      wrong: "status: string",
      lang: 'ts',
      why: 'The catalog will declare `z.enum([...])` for the status badge. If your domain type is a bare string, the two drift apart silently and the first bad value renders an empty Badge.',
    },
    {
      wrong: "// no id — the array index is the identity",
      lang: 'ts',
      why: 'A `repeat` without a stable `key` re-keys every row when the array changes order, so React throws away input state mid-edit. Actions also have nothing to send.',
    },
    {
      wrong: "import { catalog } from './catalog';  // inside lib/invoices.ts",
      lang: 'ts',
      why: 'The domain must not depend on the UI vocabulary. The arrow points the other way: the catalog and the compiler read the domain, never the reverse.',
    },
  ],
  tryIt: {
    instruction: 'Add a fourth invoice to the seed below and watch the preview grow a row. Then change its status to "paid" and see the badge change with it.',
    check: 'Four rows render, and the fourth carries the status you gave it.',
  },
  refs: ['util-definecatalog', 'prov-jsonuiprovider'],
  steps: ['shape', 'patterns'],
};
