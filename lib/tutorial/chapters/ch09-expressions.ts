import type { Chapter } from '../types';

export const ch09: Chapter = {
  slug: 'expressions',
  n: 9,
  title: 'Expressions & directives',
  goal: 'Interpolate, branch, compute — then add a $money expression of your own.',
  minutes: 14,
  why: [
    'You have used `$state`, `$item`, `$bindState`, `$bindItem` and `$cond`. Two more complete the built-in set. `$template` interpolates: `${/path}` reads the state model, a bare `${name}` reads the current repeat item and falls back to `/name`. `$computed` calls a named function with resolved args and returns whatever it returns.',
    'Then there are directives. `defineDirective` registers a new `$`-prefixed key with a Zod schema and a resolver, and the resolver gets the same resolution context, so it can call `resolvePropValue` on its own sub-values. That is what makes `$money` compose with `$item` and `$computed` instead of only accepting literals.',
    'The dividing line: a directive is for a PRESENTATIONAL transform that belongs in the spec — formatting, pluralising, truncating. A `$computed` function is for business logic. Both end up as one prop value; only one of them is worth teaching a model about.',
    'Pass the same directives array to the provider AND to `catalog.prompt({ directives })`. The provider makes them work; the prompt makes the model know they exist. Do one without the other and you get either a silent failure or an unused feature.',
  ],
  files: [
    { path: 'lib/directives.ts', lang: 'ts', notes: [] },
    { path: 'lib/spec.ts', lang: 'ts', notes: [] },
    { path: 'app/page.tsx', lang: 'tsx', notes: [] },
  ],
  mistakes: [
    {
      wrong: '{ "value": { "$money": { "$item": "amountCents" } } }   // provider has no directives prop',
      lang: 'json',
      why: 'With no matching directive the object is not an expression at all, so the raw `{ $money: … }` object reaches your component and React throws "Objects are not valid as a React child".',
    },
    {
      wrong: '{ "value": { "$computed": "unpaidTotals", "args": { … } } }',
      lang: 'json',
      why: 'A `$computed` name that is not in `functions` logs a warning and resolves to `undefined`. The text renders empty — quieter than the directive failure, and harder to spot.',
    },
    {
      wrong: '{ "$cond": { "$computed": "unpaidCount", "args": { … } }, "$then": "a", "$else": "b" }',
      lang: 'json',
      why: '`$cond` takes a CONDITION — the `visible` grammar — not an arbitrary expression. An unrecognised shape falls through to a truthiness check on the object itself, which is always true, so you always get `$then`.',
    },
    {
      wrong: '{ "$template": "Total: ${invoices.length}" }',
      lang: 'json',
      why: '`$template` interpolates paths, not JavaScript. There is no expression language inside the braces. Compute it with `$computed` and interpolate the result.',
    },
    {
      wrong: 'defineDirective({ name: "money", schema: …, resolve: … })',
      lang: 'ts',
      why: 'The name must be the `$`-prefixed key that triggers it. Without the `$` nothing ever matches, and `defineDirective` will not save you — it only rejects names that collide with built-ins.',
    },
  ],
  tryIt: {
    instruction: 'Change `currency: "EUR"` to `"USD"` on the row amount in the spec and watch every row reformat. Then delete the `directives` prop from the provider.',
    check: 'With the directive registered the amounts format; without it the page throws on an object child.',
  },
  refs: ['util-definedirective', 'expr-bindstate'],
  steps: ['expressions', 'directives'],
};
