import type { Chapter } from '../types';

export const ch06: Chapter = {
  slug: 'lists',
  n: 6,
  title: 'Lists & conditions',
  goal: 'Repeat one row template over the invoices and filter it with a condition.',
  minutes: 14,
  why: [
    '`repeat` goes on the element that OWNS the list, and it repeats that element\'s CHILDREN. The owner renders once; each child renders once per array item. Getting this backwards produces either one row or N copies of the whole list.',
    'Inside a repeat scope three expressions come alive: `$item` reads a field of the current row, `$index` is its position, and `$bindItem` is the two-way version of `$item` — it resolves to `/invoices/2/note` and hands that path to your component. `$template` joins in too: a bare `${ref}` reads the item first and falls back to state.',
    'Filtering is done with `visible`, not by pre-filtering the array. A `visible` condition on the repeated child can mix state and item scope, so "show everything unless the filter is on, and then only unpaid" is one `$or`.',
    'One warning that will save you an afternoon: a MALFORMED `visible` is not reliably hidden. An unrecognised operator falls back to a truthiness check on the value, and an object with no `$`-key is treated as always-visible. Broken conditions fail open.',
  ],
  files: [
    {
      path: 'lib/catalog.ts',
      lang: 'ts',
      notes: [
        {
          lines: [53, 55],
          title: 'Badge, with a boundary in its description',
          body: '"never for prose" is the useful half. Every description should say what the component is NOT for, because that is the sentence that stops a model using a Badge as a label.',
        },
        {
          lines: [56, 59],
          title: 'A required enum',
          body: '`tone` has no `.nullable()` here: a status pill with no tone is meaningless, so the schema refuses it and your component needs no default branch for null.',
        },
        {
          lines: [60, 63],
          title: 'An example that reads like real data',
          body: '`{ label: "unpaid", tone: "warning" }` uses a real status from the domain. A model copies the shape of examples, so "unpaid" teaches it the vocabulary as well as the structure.',
        },
      ],
    },
    {
      path: 'lib/components.tsx',
      lang: 'tsx',
      notes: [
        {
          lines: [62, 65],
          title: 'Badge takes props only',
          body: 'No children, no bindings, no emit. Destructure exactly what you use; the context object carries seven fields and ignoring six of them is normal.',
        },
        {
          lines: [66, 74],
          title: 'A chain of enum branches',
          body: 'Four tones, four class strings, with the neutral one as the final else. Because the Zod enum is closed, adding a fifth tone to the catalog makes this chain incomplete — which TypeScript will not flag, so keep the else honest.',
        },
        {
          lines: [75, 79],
          title: 'One span',
          body: 'The whole component. This is the level of ceremony a catalog entry should cost; if an implementation needs a file of its own, the catalog entry is probably doing too much.',
        },
      ],
    },
    {
      path: 'lib/spec.ts',
      lang: 'ts',
      notes: [
        {
          lines: [4, 4],
          title: 'The same file, one list bigger',
          body: 'Everything from the previous chapter is still here. The diff bar on the left marks what this chapter changed.',
        },
        {
          lines: [6, 8],
          title: 'The rule to memorise',
          body: 'The element carrying `repeat` renders once; its children render once per item. Two bugs disappear the moment you believe this: the list that renders a single row, and the list that renders itself N times.',
        },
        {
          lines: [16, 16],
          title: 'The note field moved into the list',
          body: 'The standalone draft note and its echo are gone. Each row now owns its own note, which is what `$bindItem` is for.',
        },
        {
          lines: [28, 35],
          title: 'repeat: statePath and key',
          body: '`statePath` is a JSON Pointer to an ARRAY in state. `key` names a field on each item to use as React\'s key — pass it, or reordering the array re-mounts every row and steals focus mid-edit.',
        },
        {
          lines: [36, 39],
          title: 'The row template',
          body: 'One element, rendered once per invoice. It has no idea which one it is; every reference to the current invoice goes through `$item`, `$index` or `$bindItem`.',
        },
        {
          lines: [40, 46],
          title: '$or, mixing two scopes',
          body: 'The first branch reads global state, the second reads the current item. A condition may mix them freely. `eq: false` is not the same as leaving the operator off: with no operator the check is truthiness, and `false` is falsy, so the row would vanish whenever the filter was off.',
        },
        {
          lines: [47, 48],
          title: 'visible sits beside props',
          body: 'Not inside it. `type`, `props`, `children`, `visible`, `repeat`, `on` and `watch` are all siblings. This is the single most common structural error in generated specs, and chapter twelve automates the repair.',
        },
        {
          lines: [49, 53],
          title: 'Nesting inside a row',
          body: 'A repeat scope reaches every descendant, not just direct children. `rowTop` is two levels down and `$item` still resolves.',
        },
        {
          lines: [54, 58],
          title: '$template with bare names',
          body: '`${ref}` has no leading slash, so it resolves against the current ITEM first and falls back to `/ref` in state. `${/company}` with a slash always means the state model. Mixing both in one template is fine.',
        },
        {
          lines: [59, 66],
          title: '$item and $cond together',
          body: '`label` reads the raw status. `tone` maps it to a colour with `$cond`, whose condition uses the same grammar as `visible`. Doing this in the spec rather than in the Badge keeps the component ignorant of invoices.',
        },
        {
          lines: [67, 75],
          title: '$bindItem, the write path',
          body: 'The relative field name `note` resolves to `/invoices/2/note` for the third row, and THAT is what lands in `bindings.value`. The component from chapter five does not change at all — it never knew whether its path came from state or from an item.',
        },
      ],
    },
  ],
  mistakes: [
    {
      wrong: '{\n  "type": "Stack",\n  "repeat": { "statePath": "/invoices" },\n  "children": []\n}',
      lang: 'json',
      why: 'Nothing to repeat. `repeat` iterates the children, so an empty array renders the wrapper once and nothing inside it. `validateSpec` reports `repeat_without_children`.',
    },
    {
      wrong: '{ "type": "Text", "props": { "value": { "$item": "ref" } } }   // outside any repeat',
      lang: 'json',
      why: 'There is no item scope, so `$item` resolves to undefined and the text renders empty. `validateSpec` catches this one as `repeat_item_outside_scope`.',
    },
    {
      wrong: '{ "props": { "visible": { "$item": "status", "neq": "paid" } } }',
      lang: 'json',
      why: '`visible` is a SIBLING of props, not a member of it. Inside props it is just an unknown prop your component ignores, so the row never hides. `autoFixSpec` moves it for you; `validateSpec` reports `visible_in_props`.',
    },
    {
      wrong: '{ "visible": { "$item": "status", "equals": "paid" } }',
      lang: 'json',
      why: 'The operator is `eq`, not `equals`. An unrecognised operator falls back to a truthiness check on the item value — a non-empty status string is truthy, so the row stays visible and the filter appears to do nothing.',
    },
    {
      wrong: '{ "props": { "value": { "$bindItem": "/invoices/0/note" } } }',
      lang: 'json',
      why: '`$bindItem` takes a path RELATIVE to the current item — just `note`. An absolute path is appended to the item base path and resolves to nothing.',
    },
  ],
  tryIt: {
    instruction: 'Tick "Unpaid only" and watch the paid row disappear. Then type in a row\'s note field and untick the filter: the note you typed is still there, because `$bindItem` wrote it into `/invoices/N/note`.',
    check: 'Filtering hides rows without losing edits, and each note lands on its own invoice.',
  },
  refs: ['el-repeat', 'expr-bindstate'],
  steps: ['lists', 'conditions'],
};
