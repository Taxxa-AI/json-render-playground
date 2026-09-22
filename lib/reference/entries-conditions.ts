import type { ReferenceEntry } from './types';

/**
 * The visibility grammar. Verified against `evaluateCondition` /
 * `evaluateVisibility` in node_modules/@json-render/core/dist/index.mjs
 * (lines 116-240) and VisibilityConditionStrictSchema.
 */
export const CONDITION_ENTRIES: ReferenceEntry[] = [
  {
    id: 'cond-truthy',
    category: 'Conditions',
    name: 'bare condition (truthiness)',
    signature: `{ "visible": { "$state": "/open" } }`,
    summary: 'With no operator, the resolved value is passed through Boolean().',
    details: [
      'JavaScript truthiness, exactly: `0`, `""`, `false`, `null`, `undefined` and `NaN` are all hidden.',
      'An empty array `[]` and an empty object `{}` are TRUTHY, so "hide when the list is empty" needs `{ "$state": "/list/length" }`… which does not exist in JSON Pointer. Keep a count in state instead.',
      'A missing path resolves to `undefined` → hidden.',
      '`visibility.when(path)` builds this form; `visibility.unless(path)` adds `not: true`.',
    ],
    example: {
      spec: {
        root: 'screen',
        elements: {
          screen: { type: 'Screen', props: { title: null, subtitle: null }, children: ['t', 'a', 'b', 'c'] },
          t: { type: 'Checkbox', props: { label: 'flag', checked: { $bindState: '/flag' } }, children: [] },
          a: { type: 'Badge', props: { label: 'visible when /flag', tone: 'success' }, children: [], visible: { $state: '/flag' } },
          b: { type: 'Badge', props: { label: 'visible when /zero (0 → hidden)', tone: 'info' }, children: [], visible: { $state: '/zero' } },
          c: { type: 'Badge', props: { label: 'visible when /emptyList ([] → shown)', tone: 'warning' }, children: [], visible: { $state: '/emptyList' } },
        },
      },
      seed: { flag: false, zero: 0, emptyList: [] },
    },
    related: ['cond-not', 'cond-literal', 'util-evaluatevisibility', 'el-visible'],
    step: 'conditions',
    tags: ['truthy', 'visible'],
  },
  {
    id: 'cond-not',
    category: 'Conditions',
    name: 'not: true',
    signature: `{ "$state": "/open", "not": true }
{ "$state": "/count", "gt": 5, "not": true }`,
    summary: 'Inverts the FINAL result of the condition, whichever operator ran.',
    details: [
      'It is applied last: `return cond.not === true ? !result : result`.',
      'Only the literal `true` counts — the strict schema is `z.literal(true)`, so `"not": false` is rejected by validateSpec and ignored at runtime.',
      'Combined with a comparison it means "NOT greater than 5", which includes non-numbers: a string value makes `gt` false, so `not` flips it to visible.',
      'There is no top-level `$not` wrapper. Invert each leaf, or restructure with `$or`.',
    ],
    example: {
      spec: {
        root: 'screen',
        elements: {
          screen: { type: 'Screen', props: { title: null, subtitle: null }, children: ['t', 'a', 'b'] },
          t: { type: 'Checkbox', props: { label: 'dismissed', checked: { $bindState: '/dismissed' } }, children: [] },
          a: { type: 'Alert', props: { title: 'Shown until dismissed', message: 'visible: { $state: "/dismissed", not: true }', tone: 'info' }, children: [], visible: { $state: '/dismissed', not: true } },
          b: { type: 'Badge', props: { label: 'NOT gt 5 — a string is not > 5, so not:true shows it', tone: 'warning' }, children: [], visible: { $state: '/label', gt: 5, not: true } },
        },
      },
      seed: { dismissed: false, label: 'hello' },
    },
    related: ['cond-truthy', 'cond-gt', 'cond-helpers'],
    step: 'conditions',
    tags: ['not', 'invert'],
  },
  {
    id: 'cond-eq',
    category: 'Conditions',
    name: 'eq',
    signature: `{ "$state": "/tab", "eq": "billing" }
{ "$state": "/a", "eq": { "$state": "/b" } }`,
    summary: 'Strict === against the operand. The operand may itself be { "$state": "/path" }.',
    details: [
      'Comparison is `===`. `"5" === 5` is false; there is no coercion anywhere in the grammar.',
      'The right-hand side is resolved by `resolveComparisonValue`, which only understands `{ "$state": … }` — not `$item`, not `$template`.',
      'Objects and arrays compare by reference, so `eq: []` is never true.',
      'Operator precedence when several are present: eq > neq > gt > gte > lt > lte. Only the first match runs.',
    ],
    example: {
      spec: {
        root: 'screen',
        elements: {
          screen: { type: 'Screen', props: { title: null, subtitle: null }, children: ['pick', 'home', 'billing', 'typed'] },
          pick: {
            type: 'Select',
            props: {
              label: 'tab',
              value: { $bindState: '/tab' },
              options: [
                { label: 'home', value: 'home' },
                { label: 'billing', value: 'billing' },
              ],
            },
            children: [],
          },
          home: { type: 'Alert', props: { title: 'Home', message: null, tone: 'info' }, children: [], visible: { $state: '/tab', eq: 'home' } },
          billing: { type: 'Alert', props: { title: 'Billing', message: null, tone: 'success' }, children: [], visible: { $state: '/tab', eq: 'billing' } },
          typed: { type: 'Badge', props: { label: 'eq: 5 against the string "5" — never shown', tone: 'danger' }, children: [], visible: { $state: '/five', eq: 5 } },
        },
      },
      seed: { tab: 'home', five: '5' },
    },
    related: ['cond-neq', 'cond-literal', 'cond-helpers'],
    step: 'conditions',
    tags: ['eq', 'equality'],
  },
  {
    id: 'cond-neq',
    category: 'Conditions',
    name: 'neq',
    signature: `{ "$state": "/status", "neq": "archived" }`,
    summary: 'Strict !== against the operand.',
    details: [
      'Same resolution rules as `eq`: the operand may be `{ "$state": "/path" }`.',
      'A missing path resolves to `undefined`, so `neq: "archived"` is TRUE for a path that does not exist. Absent data reads as "not equal".',
      'Guard with an array: `[{ "$state": "/status" }, { "$state": "/status", "neq": "archived" }]` requires the value to exist AND differ.',
      'Runs only if `eq` is absent — precedence is eq > neq.',
    ],
    example: {
      spec: {
        root: 'screen',
        elements: {
          screen: { type: 'Screen', props: { title: null, subtitle: null }, children: ['a', 'b'] },
          a: { type: 'Badge', props: { label: 'neq on a missing path → shown', tone: 'warning' }, children: [], visible: { $state: '/nothing/here', neq: 'archived' } },
          b: { type: 'Badge', props: { label: 'guarded: exists AND neq → hidden', tone: 'success' }, children: [], visible: [{ $state: '/nothing/here' }, { $state: '/nothing/here', neq: 'archived' }] },
        },
      },
      seed: {},
    },
    related: ['cond-eq', 'cond-and', 'cond-truthy'],
    step: 'conditions',
    tags: ['neq', 'inequality'],
  },
  {
    id: 'cond-gt',
    category: 'Conditions',
    name: 'gt',
    signature: `{ "$state": "/count", "gt": 0 }
{ "$state": "/count", "gt": { "$state": "/threshold" } }`,
    summary: 'Numeric greater-than. BOTH sides must already be numbers — there is no coercion.',
    details: [
      'The implementation is `typeof value === "number" && typeof rhs === "number" ? value > rhs : false`.',
      'A numeric string is not a number: `"7" gt 5` is FALSE. Dates, too — compare ISO strings with eq/neq or store a timestamp.',
      'A missing path is `undefined`, so `gt` is false and the element hides.',
      'The schema only allows a number or `{ "$state": … }` on the right-hand side.',
    ],
    example: {
      spec: {
        root: 'screen',
        elements: {
          screen: { type: 'Screen', props: { title: null, subtitle: null }, children: ['a', 'b', 'c'] },
          a: { type: 'Badge', props: { label: 'count(7) gt 5 → shown', tone: 'success' }, children: [], visible: { $state: '/count', gt: 5 } },
          b: { type: 'Badge', props: { label: 'countText("7") gt 5 → hidden', tone: 'danger' }, children: [], visible: { $state: '/countText', gt: 5 } },
          c: { type: 'Badge', props: { label: 'count gt threshold (state ref)', tone: 'info' }, children: [], visible: { $state: '/count', gt: { $state: '/threshold' } } },
        },
      },
      seed: { count: 7, countText: '7', threshold: 3 },
    },
    related: ['cond-gte', 'cond-lt', 'cond-lte', 'cond-not'],
    step: 'conditions',
    tags: ['gt', 'numeric'],
  },
  {
    id: 'cond-gte',
    category: 'Conditions',
    name: 'gte',
    signature: `{ "$state": "/score", "gte": 60 }`,
    summary: 'Numeric >=. Same strict number rule as gt.',
    details: [
      'Runs only if `eq`, `neq` and `gt` are all absent.',
      'Non-number on either side → false, before `not` is applied.',
      'Right-hand side may be a literal number or `{ "$state": "/path" }`.',
    ],
    example: {
      spec: {
        root: 'screen',
        elements: {
          screen: { type: 'Screen', props: { title: null, subtitle: null }, children: ['a', 'b'] },
          a: { type: 'Badge', props: { label: 'score 60 gte 60 → shown', tone: 'success' }, children: [], visible: { $state: '/score', gte: 60 } },
          b: { type: 'Badge', props: { label: 'score 60 gt 60 → hidden', tone: 'danger' }, children: [], visible: { $state: '/score', gt: 60 } },
        },
      },
      seed: { score: 60 },
    },
    related: ['cond-gt', 'cond-lte'],
    step: 'conditions',
    tags: ['gte', 'numeric'],
  },
  {
    id: 'cond-lt',
    category: 'Conditions',
    name: 'lt',
    signature: `{ "$index": true, "lt": 3 }`,
    summary: 'Numeric <. Most useful with $index to cap a list.',
    details: [
      'Runs only if eq, neq, gt and gte are absent.',
      '`{ "$index": true, "lt": n }` on a repeated element renders only the first n rows — the rest are evaluated and dropped.',
      'The array is still iterated in full; this is a display filter, not a slice.',
    ],
    example: {
      spec: {
        root: 'screen',
        elements: {
          screen: { type: 'Screen', props: { title: null, subtitle: null }, children: ['list'] },
          list: {
            type: 'Stack',
            props: { direction: 'column', gap: 'sm', align: null, wrap: null },
            children: ['row'],
            repeat: { statePath: '/rows', key: 'id' },
          },
          row: { type: 'Badge', props: { label: { $item: 'label' }, tone: 'neutral' }, children: [], visible: { $index: true, lt: 3 } },
        },
      },
      seed: {
        rows: [
          { id: '1', label: 'one' },
          { id: '2', label: 'two' },
          { id: '3', label: 'three' },
          { id: '4', label: 'four (hidden)' },
          { id: '5', label: 'five (hidden)' },
        ],
      },
    },
    related: ['cond-lte', 'cond-index', 'el-repeat'],
    step: 'conditions',
    tags: ['lt', 'numeric', '$index'],
  },
  {
    id: 'cond-lte',
    category: 'Conditions',
    name: 'lte',
    signature: `{ "$state": "/stock", "lte": 0 }`,
    summary: 'Numeric <=. Last in the operator precedence chain.',
    details: [
      'Runs only when every other comparison key is absent.',
      'Same strict typing: a non-number on either side is false.',
      '`{ "$state": "/stock", "lte": 0 }` is the usual "out of stock" test — but a missing `/stock` hides the warning rather than showing it.',
    ],
    example: {
      spec: {
        root: 'screen',
        elements: {
          screen: { type: 'Screen', props: { title: null, subtitle: null }, children: ['a', 'b'] },
          a: { type: 'Alert', props: { title: 'Out of stock', message: 'stock lte 0', tone: 'danger' }, children: [], visible: { $state: '/stock', lte: 0 } },
          b: { type: 'Alert', props: { title: 'Would warn, but the path is missing', message: 'visible: { $state: "/stockCount", lte: 0 } — undefined is not a number, so this hides.', tone: 'warning' }, children: [], visible: { $state: '/stockCount', lte: 0 } },
        },
      },
      seed: { stock: 0 },
    },
    related: ['cond-lt', 'cond-gte'],
    step: 'conditions',
    tags: ['lte', 'numeric'],
  },
  {
    id: 'cond-item',
    category: 'Conditions',
    name: '{ "$item": "field", … }',
    signature: `{ "repeat": { "statePath": "/tasks", "key": "id" },
  "visible": { "$item": "status", "eq": "todo" } }`,
    summary: 'Condition against the current repeat item. Put it on the repeating element to filter rows.',
    details: [
      'Resolved as `getByPath(repeatItem, field)`; `""` means the whole item.',
      'Outside a repeat scope the value is `undefined`, so the condition is false and the element hides.',
      'When `$item` and `$state` are both present on one object, `$item` WINS — the check is `"$item" in cond`. The strict schema rejects it, so validateSpec reports `invalid_visible`.',
      'On a repeating element the renderer calls `splitRepeatVisibility(element.visible)`: `$state` parts gate the CONTAINER, `$item` / `$index` parts become the per-row filter. That is what makes one element both a list and a filter.',
      'This is how kanban columns and tabbed lists are built: one repeat element per column, each with a different `$item` filter.',
    ],
    example: {
      spec: {
        root: 'screen',
        elements: {
          screen: { type: 'Screen', props: { title: 'Two columns, one array', subtitle: null }, children: ['cols'] },
          cols: {
            type: 'Stack',
            props: { direction: 'row', gap: 'lg', align: 'start', wrap: null },
            children: ['todo', 'done'],
          },
          todo: {
            type: 'Stack',
            props: { direction: 'column', gap: 'sm', align: null, wrap: null },
            children: ['todoRow'],
            repeat: { statePath: '/tasks', key: 'id' },
            visible: { $item: 'status', eq: 'todo' },
          },
          todoRow: { type: 'Badge', props: { label: { $item: 'title' }, tone: 'warning' }, children: [] },
          done: {
            type: 'Stack',
            props: { direction: 'column', gap: 'sm', align: null, wrap: null },
            children: ['doneRow'],
            repeat: { statePath: '/tasks', key: 'id' },
            visible: { $item: 'status', eq: 'done' },
          },
          doneRow: { type: 'Badge', props: { label: { $item: 'title' }, tone: 'success' }, children: [] },
        },
      },
      seed: {
        tasks: [
          { id: '1', title: 'File VAT', status: 'todo' },
          { id: '2', title: 'Reconcile', status: 'done' },
          { id: '3', title: 'Chase invoice', status: 'todo' },
        ],
      },
    },
    failure: {
      spec: {
        root: 'screen',
        elements: {
          screen: { type: 'Screen', props: { title: null, subtitle: null }, children: ['b'] },
          b: { type: 'Badge', props: { label: '$item used outside any repeat', tone: 'danger' }, children: [], visible: { $item: 'status', eq: 'todo' } },
        },
      },
      seed: { status: 'todo' },
      note: 'There is no repeat here, so repeatItem is undefined and the condition is false. Note it does NOT fall back to state, even though /status exists.',
    },
    related: ['expr-item', 'el-repeat', 'cond-index', 'util-evaluatevisibility'],
    step: 'lists',
    tags: ['$item', 'filter', 'repeat'],
  },
  {
    id: 'cond-index',
    category: 'Conditions',
    name: '{ "$index": true, … }',
    signature: `{ "visible": { "$index": true, "eq": 0 } }`,
    summary: 'Condition against the current repeat index.',
    details: [
      'The key must be exactly `true`; the strict schema is `z.literal(true)`.',
      'Outside a repeat scope it is `undefined`, so any comparison is false.',
      '`{ "$index": true, "eq": 0 }` is "first row only"; `{ "$index": true, "lt": 3 }` is "first three".',
      '`$index` is checked before `$item`, so an object carrying both uses the index.',
    ],
    example: {
      spec: {
        root: 'screen',
        elements: {
          screen: { type: 'Screen', props: { title: null, subtitle: null }, children: ['list'] },
          list: {
            type: 'Stack',
            props: { direction: 'column', gap: 'sm', align: null, wrap: null },
            children: ['row', 'first'],
            repeat: { statePath: '/rows', key: 'id' },
          },
          row: { type: 'Text', props: { value: { $item: 'label' }, tone: null, size: null }, children: [] },
          first: { type: 'Badge', props: { label: 'newest', tone: 'success' }, children: [], visible: { $index: true, eq: 0 } },
        },
      },
      seed: { rows: [{ id: '1', label: 'one' }, { id: '2', label: 'two' }, { id: '3', label: 'three' }] },
    },
    related: ['expr-index', 'cond-lt', 'el-repeat'],
    step: 'lists',
    tags: ['$index', 'repeat'],
  },
  {
    id: 'cond-and',
    category: 'Conditions',
    name: '$and / implicit array AND',
    signature: `{ "visible": [ { "$state": "/a" }, { "$state": "/b" } ] }
{ "visible": { "$and": [ { "$state": "/a" }, { "$or": [ … ] } ] } }`,
    summary: 'All children must be true. The array form is the shorthand; $and is the form that can nest.',
    details: [
      'The array form runs `condition.every(evaluateCondition)`, and `evaluateCondition` does NOT understand `$and` / `$or`. Nest one inside a plain array and it reads `cond.$state` as undefined, which resolves to the whole state object and comes back TRUE. Use `$and` whenever you need to nest.',
      '`$and` runs `evaluateVisibility` per child, so its children may be arrays, `$and` or `$or`.',
      'An EMPTY array is true (`[].every` is true). An empty `$and` is also true.',
      '`visibility.and(...conditions)` builds the explicit form.',
    ],
    example: {
      spec: {
        root: 'screen',
        elements: {
          screen: { type: 'Screen', props: { title: null, subtitle: null }, children: ['a', 'b', 'both', 'nested'] },
          a: { type: 'Checkbox', props: { label: 'a', checked: { $bindState: '/a' } }, children: [] },
          b: { type: 'Checkbox', props: { label: 'b', checked: { $bindState: '/b' } }, children: [] },
          both: { type: 'Badge', props: { label: 'array AND: a && b', tone: 'success' }, children: [], visible: [{ $state: '/a' }, { $state: '/b' }] },
          nested: { type: 'Badge', props: { label: '$and with a nested $or: a && (b || c)', tone: 'info' }, children: [], visible: { $and: [{ $state: '/a' }, { $or: [{ $state: '/b' }, { $state: '/c' }] }] } },
        },
      },
      seed: { a: false, b: false, c: true },
    },
    related: ['cond-or', 'cond-helpers', 'util-evaluatevisibility'],
    step: 'conditions',
    tags: ['$and', 'AND', 'array'],
  },
  {
    id: 'cond-or',
    category: 'Conditions',
    name: '$or',
    signature: `{ "visible": { "$or": [ { "$state": "/admin" }, { "$state": "/owner" } ] } }`,
    summary: 'At least one child must be true. Children may nest.',
    details: [
      'Runs `condition.$or.some(evaluateVisibility)`, so children can be arrays, `$and`, or further `$or`.',
      'An EMPTY `$or` is FALSE (`[].some` is false) — the mirror image of an empty `$and`.',
      'There is no `$not` wrapper to pair with it. Invert leaves with `not: true`.',
      '`visibility.or(...conditions)` builds it.',
    ],
    example: {
      spec: {
        root: 'screen',
        elements: {
          screen: { type: 'Screen', props: { title: null, subtitle: null }, children: ['admin', 'owner', 'panel', 'empty'] },
          admin: { type: 'Checkbox', props: { label: 'admin', checked: { $bindState: '/admin' } }, children: [] },
          owner: { type: 'Checkbox', props: { label: 'owner', checked: { $bindState: '/owner' } }, children: [] },
          panel: { type: 'Alert', props: { title: 'Danger zone', message: 'admin || owner', tone: 'danger' }, children: [], visible: { $or: [{ $state: '/admin' }, { $state: '/owner' }] } },
          empty: { type: 'Badge', props: { label: 'empty $or → always hidden', tone: 'neutral' }, children: [], visible: { $or: [] } },
        },
      },
      seed: { admin: false, owner: false },
    },
    related: ['cond-and', 'cond-not', 'cond-helpers'],
    step: 'conditions',
    tags: ['$or', 'OR'],
  },
  {
    id: 'cond-literal',
    category: 'Conditions',
    name: 'true / false / undefined',
    signature: `{ "visible": true }
{ "visible": false }`,
    summary: 'Literal booleans short-circuit. Omitting visible entirely means visible.',
    details: [
      '`undefined` → true. There is no "hidden by default".',
      '`true` and `false` are returned as-is before any condition logic runs.',
      'A NULL or a string is not handled: `evaluateVisibility` reaches `"$index" in cond` and THROWS a TypeError, which surfaces as a React render error.',
      '`visibility.always` is `true` and `visibility.never` is `false` — they are constants, not functions.',
    ],
    example: {
      spec: {
        root: 'screen',
        elements: {
          screen: { type: 'Screen', props: { title: null, subtitle: null }, children: ['yes', 'no', 'none'] },
          yes: { type: 'Badge', props: { label: 'visible: true', tone: 'success' }, children: [], visible: true },
          no: { type: 'Badge', props: { label: 'visible: false — you cannot see this', tone: 'danger' }, children: [], visible: false },
          none: { type: 'Badge', props: { label: 'no visible field at all', tone: 'neutral' }, children: [] },
        },
      },
    },
    related: ['cond-truthy', 'cond-helpers', 'el-visible'],
    step: 'conditions',
    tags: ['boolean', 'literal'],
  },
  {
    id: 'cond-helpers',
    category: 'Conditions',
    name: 'visibility.* helpers',
    signature: `import { visibility } from "@json-render/core";

visibility.when("/open")        // { $state: "/open" }
visibility.unless("/open")      // { $state: "/open", not: true }
visibility.eq("/tab", "home")   // { $state: "/tab", eq: "home" }
visibility.and(a, b)            // { $and: [a, b] }`,
    summary: 'Typed builders for the condition grammar. They return plain JSON — nothing is hidden behind them.',
    details: [
      'Full set: `always`, `never`, `when`, `unless`, `eq`, `neq`, `gt`, `gte`, `lt`, `lte`, `and`, `or`.',
      '`always` and `never` are the constants `true` and `false`, not functions.',
      'Every builder is `$state`-based. There is no `visibility.item(...)` — write `$item` conditions by hand.',
      'Useful when you compile specs in TypeScript; useless to the model, which only sees JSON.',
    ],
    run: {
      label: 'condition',
      input: JSON.stringify({ $or: [{ $state: '/admin' }, { $state: '/count', gte: 3 }] }, null, 2),
      labelB: 'context',
      input2: JSON.stringify({ stateModel: { admin: false, count: 4 } }, null, 2),
      fn: 'evaluateVisibility',
    },
    related: ['cond-and', 'cond-or', 'util-evaluatevisibility'],
    step: 'conditions',
    tags: ['visibility', 'helpers', 'builders'],
  },
];
