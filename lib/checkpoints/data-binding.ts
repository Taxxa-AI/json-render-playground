import type { Spec } from '@json-render/core';
import type { Quiz } from './types';

/**
 * Data & binding.
 *
 * Every answer verified against @json-render/core 0.20.0 with
 * scratchpad/verify-checkpoints.ts (D1–D23) and verify-checkpoints-2.ts
 * (D24–D32) — `getByPath`, `resolvePropValue`, `evaluateVisibility`,
 * `splitRepeatVisibility`, `validateSpec` — plus verify-malformed.ts, which
 * enumerates what each malformed `visible` shape really does.
 */
export const dataBindingQuiz: Quiz = {
  group: 'Data & binding',
  slug: 'data-binding',
  intro: 'Reading state, writing it back, repeating over it, and hiding things because of it.',
  questions: [
    {
      kind: 'fill',
      id: 'd-pointer',
      prompt: 'Fill the blank so the metric shows €480. Three of these render an empty value or the wrong one.',
      // Verified with getByPath: '/invoice.total' -> undefined (dot notation is
      // not a pointer), '/items/length' -> undefined (no property access), and a
      // bare string is a literal (D24, F1).
      spec: {
        root: 'm',
        elements: {
          m: { type: 'Metric', props: { label: 'Invoice total', value: '___', delta: null, tone: null }, children: [] },
        },
      } as unknown as Spec,
      seed: { invoice: { total: '€480' }, items: ['a', 'b', 'c'] },
      options: [
        '{ "$state": "/invoice/total" }',
        '{ "$state": "/invoice.total" }',
        '{ "$state": "/items/length" }',
        '"/invoice/total"',
      ],
      fills: [
        '{"$state":"/invoice/total"}',
        '{"$state":"/invoice.total"}',
        '{"$state":"/items/length"}',
        '"/invoice/total"',
      ],
      answer: 0,
      explain:
        'Paths are RFC 6901 JSON Pointers, not JavaScript. Segments are separated by slashes, so "/invoice.total" is one key named "invoice.total" and resolves to undefined. There is no property access either: "length" is looked up as a key on the array, is not there, and resolves to undefined — if you need a count, use $computed or put it in state. And a bare string is a literal: it renders as the text of the path.',
      step: 'state',
      ref: 'expr-state',
    },
    {
      kind: 'choice',
      id: 'd-state-vs-bind',
      prompt: 'What does { "$bindState": "/form/email" } give a component that { "$state": "/form/email" } does not?',
      options: [
        'The write-back path, in a separate `bindings` map',
        'A different value — $bindState reads the draft, $state the committed value',
        'Automatic re-rendering when the path changes',
        'Validation of the path against the state schema',
      ],
      answer: 0,
      explain:
        'Both resolve to exactly the same value. The difference is that the renderer also scans raw props for $bindState / $bindItem and hands the component bindings = { <propName>: "/form/email" }. The value goes in props, the path goes in bindings, and useBoundProp pairs them back up. Without it a control is read-only and nobody gets an error.',
      step: 'state',
      ref: 'expr-bindstate',
    },
    {
      kind: 'fill',
      id: 'd-fill-bind',
      prompt: 'Fill the blank so this input reads AND writes /form/email. Try the wrong ones — they render too.',
      spec: {
        root: 'card',
        elements: {
          card: { type: 'Card', props: { title: 'Contact', subtitle: null }, children: ['email'] },
          email: {
            type: 'TextInput',
            props: {
              label: 'Email',
              value: '___',
              placeholder: 'you@co.com',
              help: 'Type here after answering.',
              required: true,
              checks: null,
            },
            children: [],
          },
        },
      } as unknown as Spec,
      seed: { form: { email: 'ada@example.com' } },
      options: [
        '{ "$bindState": "/form/email" }',
        '{ "$state": "/form/email" }',
        '{ "$bindItem": "email" }',
        '"/form/email"',
      ],
      fills: ['{"$bindState":"/form/email"}', '{"$state":"/form/email"}', '{"$bindItem":"email"}', '"/form/email"'],
      answer: 0,
      explain:
        '$state reads and renders the current value, but with no binding path useBoundProp\'s setter is a no-op — the field looks fine and refuses to accept keystrokes. $bindItem outside a repeat warns and resolves to undefined. The bare string is a literal: the box shows the text "/form/email".',
      step: 'state',
      ref: 'expr-bindstate',
    },
    {
      kind: 'choice',
      id: 'd-store-modes',
      prompt: 'You pass BOTH `store` and `initialState` to JSONUIProvider. What happens?',
      options: [
        'The store wins; initialState and onStateChange are ignored',
        'initialState seeds the store once, then the store takes over',
        'They are merged, with initialState as the base',
        'It throws — the two modes are mutually exclusive',
      ],
      answer: 0,
      explain:
        'StateProvider has two modes. Pass a store and you are in controlled mode: the store is the single source of truth and initialState / onStateChange are ignored outright. Omit it and you get uncontrolled mode over an internal createStateStore. Seed a controlled store when you build it, not at the provider.',
      step: 'stores',
      ref: 'prov-stateprovider',
    },
    {
      kind: 'predict',
      id: 'd-template-miss',
      prompt: 'State has /user/name but no /user/email. What does this heading say?',
      // Verified: resolvePropValue({$template:'Hi ${/user/email}!'}, …) === 'Hi !' (D3).
      spec: {
        root: 'stack',
        elements: {
          stack: {
            type: 'Stack',
            props: { direction: 'column', gap: 'sm', align: null, wrap: null },
            children: ['h', 'p'],
          },
          h: { type: 'Heading', props: { text: { $template: 'Welcome ${/user/name} <${/user/email}>' }, level: '2' }, children: [] },
          p: { type: 'Text', props: { value: { $template: 'Account: ${/user/name}' }, tone: null, size: null }, children: [] },
        },
      } as unknown as Spec,
      seed: { user: { name: 'Ada' } },
      options: [
        'Welcome Ada <>',
        'Welcome Ada <undefined>',
        'Welcome Ada <${/user/email}>',
        'Nothing — the whole template resolves to undefined',
      ],
      answer: 0,
      explain:
        '$template interpolates each ${…} independently and substitutes the empty string for anything null or undefined. A missing path therefore shows as a gap, not as "undefined" and not as an error — which is how a half-seeded state model produces a page of stray punctuation.',
      step: 'expressions',
      ref: 'expr-template',
    },
    {
      kind: 'choice',
      id: 'd-computed-unknown',
      prompt: 'A prop is { "$computed": "formatEuro", args: { v: { "$state": "/total" } } } and no such function is registered. What does the component receive?',
      // Verified: resolvePropValue returns undefined and warns once per name (D4).
      options: [
        'undefined, plus one console warning',
        'The string "formatEuro"',
        'The resolved args object',
        'An error thrown inside the renderer',
      ],
      answer: 0,
      explain:
        'Unregistered $computed resolves to undefined and warns once per function name, then never again — so the warning is easy to miss in a long session. The args are still resolved first; they are just thrown away. Register functions through JSONUIProvider functions.',
      step: 'expressions',
      ref: 'expr-computed',
    },
    {
      kind: 'choice',
      id: 'd-one-operator',
      prompt: 'State is { count: 3 }. Is { "$state": "/count", "eq": 99, "gt": 1 } true?',
      // Verified: evaluateVisibility(...) === false — eq is checked first and wins (D10).
      options: [
        'No — eq is evaluated and gt is ignored',
        'Yes — gt: 1 passes, and any operator passing is enough',
        'No — both must pass, and eq fails',
        'Yes — later keys override earlier ones',
      ],
      answer: 0,
      explain:
        'Use at most ONE comparison operator per condition object. If several are present only the first match is evaluated, in the fixed precedence eq, neq, gt, gte, lt, lte — the rest are silently dead. To combine comparisons, use an array (implicit AND) or $and.',
      step: 'conditions',
      ref: 'cond-eq',
    },
    {
      kind: 'predict',
      id: 'd-malformed-visible',
      prompt:
        'The author meant "greater than 2" but wrote greaterThan instead of gt. /overBudget is 1. Does the alert render?',
      // Verified in scratchpad/verify-malformed.ts against evaluateVisibility:
      // { $state:"/overBudget", greaterThan:2 } is TRUE at overBudget=1 and
      // FALSE at overBudget=0 — the unknown operator is dropped and
      // evaluateCondition falls through to Boolean(value). validateSpec reports
      // invalid_visible for the same object.
      spec: {
        root: 'stack',
        elements: {
          stack: {
            type: 'Stack',
            props: { direction: 'column', gap: 'sm', align: null, wrap: null },
            children: ['a', 'ok'],
          },
          a: {
            type: 'Alert',
            props: { title: 'Budget exceeded', message: 'More than 2 invoices are over budget.', tone: 'danger' },
            children: [],
            visible: { $state: '/overBudget', greaterThan: 2 },
          },
          ok: { type: 'Text', props: { value: 'Exactly 1 invoice is over budget.', tone: null, size: null }, children: [] },
        },
      } as unknown as Spec,
      seed: { overBudget: 1 },
      options: [
        'Yes — the unknown operator is dropped and the condition degrades to a truthiness check on /overBudget',
        'No — 1 is not greater than 2',
        'No — a malformed condition evaluates to false',
        'No — the renderer throws and the error boundary swallows the element',
      ],
      answer: 0,
      explain:
        'A malformed condition is not an error, and it is not reliably hidden either. Which way it goes depends on the shape: an unrecognised operator is ignored and the path is checked for truthiness (so this alert appears at 1 and vanishes at 0, and the number 2 is never read at all), an object with no $-key at all is always visible, and a typo in the $state key itself compares the whole state model and is always false. A null or string condition actually throws. Nothing in the UI tells you which case you are in — run validateSpec, which rejects every unrecognised shape as invalid_visible.',
      step: 'conditions',
      ref: 'cond-helpers',
    },
    {
      kind: 'choice',
      id: 'd-hidden-unmounted',
      prompt: 'An element\'s visible condition flips to false. What happens to it?',
      options: [
        'It unmounts — the renderer returns null, so any component state is gone',
        'It is hidden with display:none and keeps its state',
        'It stays mounted but receives loading: true',
        'It unmounts, but its bound state paths are cleared too',
      ],
      answer: 0,
      explain:
        'Hidden means not rendered. Any local React state in that component — an open dropdown, a scroll position, an uncommitted draft — is destroyed and rebuilt when the condition flips back. The state MODEL is untouched: hiding a bound input does not clear the path behind it.',
      step: 'conditions',
      ref: 'el-visible',
    },
    {
      kind: 'predict',
      id: 'd-repeat-filter',
      prompt: 'repeat and a $item visible condition are on the same element. How many rows render?',
      // Verified: splitRepeatVisibility puts a pure $item condition entirely in
      // itemFilter, leaving container undefined → the container renders and the
      // items are filtered (D17, and splitRepeatVisibility source).
      spec: {
        root: 'list',
        elements: {
          list: {
            type: 'Stack',
            props: { direction: 'column', gap: 'sm', align: null, wrap: null },
            children: ['row'],
            repeat: { statePath: '/tasks', key: 'id' },
            visible: { $item: 'status', eq: 'todo' },
          },
          row: { type: 'Badge', props: { label: { $item: 'title' }, tone: 'warning' }, children: [] },
        },
      } as unknown as Spec,
      seed: {
        tasks: [
          { id: '1', title: 'Send invoice', status: 'todo' },
          { id: '2', title: 'File VAT', status: 'done' },
          { id: '3', title: 'Chase payment', status: 'todo' },
        ],
      },
      options: [
        'Two — the condition filters items instead of hiding the container',
        'None — the condition is evaluated outside the repeat scope and fails',
        'Three — visible does not apply to repeated children',
        'One — only the first matching item renders',
      ],
      answer: 0,
      explain:
        'A repeat container\'s visible condition is split: conjuncts referencing $item or $index become a per-item filter, everything else gates the container. That is what makes kanban columns and tabbed lists expressible without a second state array.',
      step: 'lists',
      ref: 'el-repeat',
    },
    {
      kind: 'spot',
      id: 'd-nested-repeat',
      prompt: 'This element repeats over { "$item": "comments" } but has no repeat above it. What does validateSpec say?',
      // Verified: ['repeat_item_outside_scope'] (D21).
      spec: {
        root: 'list',
        elements: {
          list: {
            type: 'Stack',
            props: { direction: 'column', gap: 'sm', align: null, wrap: null },
            children: ['c'],
            repeat: { statePath: { $item: 'comments' } },
          },
          c: { type: 'Text', props: { value: { $item: 'body' }, tone: null, size: null }, children: [] },
        },
      } as unknown as Spec,
      options: [
        'repeat_item_outside_scope',
        'repeat_state_mismatch',
        'repeat_without_children',
        'no issue — it renders wrong silently',
      ],
      answer: 0,
      explain:
        'The { "$item": "path" } form of repeat.statePath is relative to the enclosing repeat item, so it is only meaningful inside another repeat. Outside one it cannot be resolved to an absolute path; the renderer warns and renders nothing.',
      step: 'lists',
      ref: 'el-repeat',
    },
    {
      kind: 'choice',
      id: 'd-binditem-key',
      prompt: 'Inside a repeat over /todos, { "$bindItem": "done" } binds a checkbox to what, and what is repeat.key for?',
      // Verified: resolveBindItemPath = repeatBasePath + '/' + path, e.g.
      // '/todos/0/done'; RepeatChildren uses item[key] as the React key (D20).
      options: [
        'The absolute path /todos/<i>/done — and key names an item field used as the React key',
        'A copy of the item, discarded on the next render — and key is the state path to write to',
        'The item object itself — and key is the prop name to bind',
        'The path /done on the global model — and key is the sort order',
      ],
      answer: 0,
      explain:
        '$bindItem resolves against the repeat\'s base path, so writing back goes to the real array element, not to a copy. repeat.key names a field on each item to use as the React key; without it the index is used, and reordering the array then reuses the wrong DOM nodes.',
      step: 'lists',
      ref: 'expr-binditem',
    },
  ],
};
