import type { ReferenceEntry } from './types';

/**
 * Prop expressions. Verified against `resolvePropValue` in
 * node_modules/@json-render/core/dist/index.mjs (lines 321-401) and the
 * PropExpression union in dist/index.d.ts.
 */
export const EXPRESSION_ENTRIES: ReferenceEntry[] = [
  {
    id: 'expr-state',
    category: 'Expressions',
    name: '{ "$state": "/path" }',
    signature: `{ "props": { "value": { "$state": "/user/name" } } }`,
    summary: 'Read-only read from the global state model by JSON Pointer.',
    details: [
      'Resolved with `getByPath(stateModel, path)` — RFC 6901 pointers, so `/a/b` and array indices `/list/0/id`.',
      'A missing path resolves to `undefined`. No warning, no error: the prop simply is not there.',
      '`{ "$state": "" }` returns the WHOLE state object. That is a real RFC 6901 rule, and the reason a typo\'d condition key fails open.',
      'Dotted paths do not work. `"user.name"` resolves to undefined; a leading slash is optional (`"user/name"` works) but write it.',
      'One-way. To write back you need `$bindState`.',
    ],
    example: {
      spec: {
        root: 'screen',
        elements: {
          screen: { type: 'Screen', props: { title: null, subtitle: null }, children: ['hit', 'miss'] },
          hit: { type: 'Metric', props: { label: 'hit: /revenue', value: { $state: '/revenue' }, delta: null, tone: 'success' }, children: [] },
          miss: { type: 'Metric', props: { label: 'miss: /revenu (typo)', value: { $state: '/revenu' }, delta: null, tone: 'danger' }, children: [] },
        },
      },
      seed: { revenue: '€48,200' },
      note: 'The second metric gets `undefined` and renders blank. This is the most common silent failure in the whole library.',
    },
    related: ['expr-bindstate', 'expr-template', 'util-resolvepropvalue', 'el-props'],
    step: 'expressions',
    tags: ['$state', 'read', 'pointer'],
  },
  {
    id: 'expr-bindstate',
    category: 'Expressions',
    name: '{ "$bindState": "/path" }',
    signature: `{ "props": { "value": { "$bindState": "/form/email" } } }`,
    summary: 'Two-way binding to a global state path. Resolves to the value AND exposes the path so the component can write back.',
    details: [
      'The renderer runs `resolveBindings(props, ctx)` BEFORE resolving values, and hands the component `bindings = { value: "/form/email" }`.',
      'The component opts in: `const [v, setV] = useBoundProp(props.value, bindings?.value)`. A component that ignores `bindings` is read-only however you bind it.',
      'Only props that use `$bindState` or `$bindItem` appear in `bindings`; the map is `undefined` when none do.',
      'The write goes through the store\'s `set(path, value)`, which creates missing intermediate objects.',
    ],
    example: {
      spec: {
        root: 'screen',
        elements: {
          screen: { type: 'Screen', props: { title: null, subtitle: null }, children: ['in', 'out'] },
          in: { type: 'TextInput', props: { label: 'Email', value: { $bindState: '/form/email' }, placeholder: 'you@co.com', help: null, required: null, checks: null }, children: [] },
          out: { type: 'Text', props: { value: { $template: 'state now holds: ${/form/email}' }, tone: null, size: 'sm' }, children: [] },
        },
      },
      seed: { form: { email: '' } },
    },
    failure: {
      spec: {
        root: 'screen',
        elements: {
          screen: { type: 'Screen', props: { title: null, subtitle: null }, children: ['in', 'out'] },
          in: { type: 'TextInput', props: { label: 'Email (bound with $state, not $bindState)', value: { $state: '/form/email' }, placeholder: 'type here', help: null, required: null, checks: null }, children: [] },
          out: { type: 'Text', props: { value: { $template: 'state still holds: "${/form/email}"' }, tone: null, size: 'sm' }, children: [] },
        },
      },
      seed: { form: { email: '' } },
      note: 'With `$state` there is no bindings entry, so useBoundProp has no path and its setter is a no-op. The input looks like it works — React keeps the keystrokes — but state never changes and the mirror below stays empty.',
    },
    related: ['expr-state', 'expr-binditem', 'hook-useboundprop', 'ctx-bindings'],
    step: 'state',
    tags: ['$bindState', 'binding', 'two-way'],
  },
  {
    id: 'expr-binditem',
    category: 'Expressions',
    name: '{ "$bindItem": "field" }',
    signature: `{ "props": { "checked": { "$bindItem": "done" } } }`,
    summary: 'Two-way binding to a field on the current repeat item. Only meaningful inside a repeat.',
    details: [
      'The path is built as `repeatBasePath + "/" + field`, e.g. `/todos/2/done`, and that absolute path is what lands in `bindings`.',
      'Outside a repeat scope it resolves to `undefined` and logs `$bindItem used outside repeat scope: "<field>"`. One of the very few warnings the library prints.',
      'Because the write path is absolute, editing a row writes straight into the array in state — no per-row plumbing.',
      'Use `$item` when you only need to read.',
    ],
    example: {
      spec: {
        root: 'screen',
        elements: {
          screen: { type: 'Screen', props: { title: null, subtitle: null }, children: ['list', 'dump'] },
          list: {
            type: 'Stack',
            props: { direction: 'column', gap: 'sm', align: null, wrap: null },
            children: ['row'],
            repeat: { statePath: '/todos', key: 'id' },
          },
          row: { type: 'Checkbox', props: { label: { $item: 'title' }, checked: { $bindItem: 'done' } }, children: [] },
          dump: { type: 'Text', props: { value: { $template: 'first item done = ${/todos/0/done}' }, tone: null, size: 'sm' }, children: [] },
        },
      },
      seed: { todos: [{ id: 't1', title: 'File VAT', done: false }, { id: 't2', title: 'Reconcile bank', done: false }] },
      note: 'Tick the first box and the mirror under the list flips. The checkbox wrote to /todos/0/done.',
    },
    related: ['expr-item', 'el-repeat', 'hook-useboundprop', 'hook-userepeatscope'],
    step: 'lists',
    tags: ['$bindItem', 'repeat', 'binding'],
  },
  {
    id: 'expr-item',
    category: 'Expressions',
    name: '{ "$item": "field" }',
    signature: `{ "props": { "value": { "$item": "title" } } }
{ "props": { "value": { "$item": "" } } }`,
    summary: 'Read a field off the current repeat item. Empty string means the whole item.',
    details: [
      'Resolved as `getByPath(repeatItem, field)`, so nested fields work: `{ "$item": "author/name" }`.',
      'Outside a repeat scope it resolves to `undefined`, silently.',
      'In ACTION params it behaves differently: `resolveActionParam` turns `{ $item: "id" }` into the absolute state PATH (`/todos/0/id`), not the value — so it can be handed to setState.',
      'It is a path into the item, not an expression language: no arithmetic, no formatting.',
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
            repeat: { statePath: '/people', key: 'id' },
          },
          row: {
            type: 'Stack',
            props: { direction: 'row', gap: 'sm', align: 'center', wrap: null },
            children: ['name', 'city'],
          },
          name: { type: 'Text', props: { value: { $item: 'name' }, tone: null, size: null }, children: [] },
          city: { type: 'Badge', props: { label: { $item: 'address/city' }, tone: 'info' }, children: [] },
        },
      },
      seed: {
        people: [
          { id: 'p1', name: 'Ada', address: { city: 'London' } },
          { id: 'p2', name: 'Grace', address: { city: 'New York' } },
        ],
      },
    },
    related: ['expr-binditem', 'expr-index', 'cond-item', 'el-repeat'],
    step: 'lists',
    tags: ['$item', 'repeat', 'read'],
  },
  {
    id: 'expr-index',
    category: 'Expressions',
    name: '{ "$index": true }',
    signature: `{ "props": { "label": { "$index": true } } }`,
    summary: 'The zero-based index of the current repeat item. `true` is a sentinel, not a value.',
    details: [
      '`true` is used because the index is a scalar with no sub-path to navigate, unlike `$item`.',
      'Resolves to `ctx.repeatIndex` — a NUMBER. Outside a repeat scope it is `undefined`.',
      'Any other value for the key (`{ "$index": 0 }`) is not recognised and falls through to the literal branch.',
      'In conditions it works the same way: `{ "$index": true, "lt": 3 }` shows the first three rows.',
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
          row: {
            type: 'Stack',
            props: { direction: 'row', gap: 'sm', align: 'center', wrap: null },
            children: ['n', 'label'],
          },
          n: { type: 'Badge', props: { label: { $index: true }, tone: 'neutral' }, children: [] },
          label: { type: 'Text', props: { value: { $item: 'label' }, tone: null, size: null }, children: [] },
        },
      },
      seed: { rows: [{ id: 'a', label: 'first' }, { id: 'b', label: 'second' }, { id: 'c', label: 'third' }] },
      note: 'Indices start at 0. Add `"visible": { "$index": true, "lt": 2 }` to the row to cut the list short.',
    },
    related: ['expr-item', 'cond-index', 'el-repeat'],
    step: 'lists',
    tags: ['$index', 'repeat'],
  },
  {
    id: 'expr-cond',
    category: 'Expressions',
    name: '{ "$cond", "$then", "$else" }',
    signature: `{ "props": { "tone": { "$cond": { "$state": "/ok" }, "$then": "success", "$else": "danger" } } }`,
    summary: 'Pick one of two values by evaluating a visibility condition. All three keys are required.',
    details: [
      '`$cond` takes the full condition grammar — a boolean, a single condition, an array, `$and` or `$or`.',
      'The chosen branch is resolved recursively, so `$then` may itself be `{ "$state": … }` or another `$cond`.',
      'If any of the three keys is missing, this is NOT recognised as a `$cond` expression. It falls through to the plain-object branch and you get the object back as a literal prop.',
      'Unlike `visible`, the element still mounts — only the value changes.',
    ],
    example: {
      spec: {
        root: 'screen',
        elements: {
          screen: { type: 'Screen', props: { title: null, subtitle: null }, children: ['toggle', 'b'] },
          toggle: { type: 'Checkbox', props: { label: 'paid', checked: { $bindState: '/paid' } }, children: [] },
          b: {
            type: 'Badge',
            props: {
              label: { $cond: { $state: '/paid' }, $then: 'Paid', $else: 'Overdue' },
              tone: { $cond: { $state: '/paid' }, $then: 'success', $else: 'danger' },
            },
            children: [],
          },
        },
      },
      seed: { paid: false },
    },
    failure: {
      spec: {
        root: 'screen',
        elements: {
          screen: { type: 'Screen', props: { title: null, subtitle: null }, children: ['b'] },
          b: { type: 'Badge', props: { label: { $cond: { $state: '/paid' }, $then: 'Paid' } as never, tone: 'neutral' }, children: [] },
        },
      },
      seed: { paid: true },
      note: 'No `$else`. The object is not a $cond expression any more, so it is walked as a plain object and handed to Badge as `{ $cond: {...}, $then: "Paid" }`. The label renders as "[object Object]" or empty, depending on the component.',
    },
    related: ['cond-truthy', 'el-visible', 'expr-computed', 'util-resolvepropvalue'],
    step: 'expressions',
    tags: ['$cond', 'ternary'],
  },
  {
    id: 'expr-template',
    category: 'Expressions',
    name: '{ "$template": "…${/path}…" }',
    signature: '{ "props": { "value": { "$template": "Hello ${/user/name}, you have ${count} items" } } }',
    summary: 'String interpolation. ${/absolute} reads state; ${bare} tries the current repeat item first, then state at /bare.',
    details: [
      'Implemented as a single `String.replace(/\\$\\{([^}]+)\\}/g, …)`. No expressions inside the braces — paths only.',
      'A path that resolves to null or undefined becomes the EMPTY STRING. The rest of the template still renders, so a miss is invisible.',
      'Resolved values are coerced with `String(value)`, so objects become "[object Object]" and numbers lose formatting.',
      'The bare form is the only place a leading slash is optional, and the item-first lookup only applies inside a repeat.',
      'The result is always a string, even when the whole template is one path.',
    ],
    example: {
      spec: {
        root: 'screen',
        elements: {
          screen: { type: 'Screen', props: { title: null, subtitle: null }, children: ['ok', 'miss', 'obj'] },
          ok: { type: 'Text', props: { value: { $template: 'Hello ${/user/name} — ${/count} open items' }, tone: null, size: null }, children: [] },
          miss: { type: 'Text', props: { value: { $template: 'missing path renders as: [${/user/nickname}]' }, tone: 'warning', size: 'sm' }, children: [] },
          obj: { type: 'Text', props: { value: { $template: 'an object renders as: ${/user}' }, tone: 'warning', size: 'sm' }, children: [] },
        },
      },
      seed: { user: { name: 'Ada' }, count: 3 },
      note: 'Line two shows the empty-string miss. Line three shows String() coercion of an object.',
    },
    related: ['expr-state', 'expr-item', 'expr-computed'],
    step: 'expressions',
    tags: ['$template', 'interpolation', 'string'],
  },
  {
    id: 'expr-computed',
    category: 'Expressions',
    name: '{ "$computed": "fn", "args": { … } }',
    signature: `{ "props": { "value": { "$computed": "currency", "args": { "amount": { "$state": "/total" } } } } }`,
    summary: 'Call a host-registered function with resolved args. The only way to compute in a spec.',
    details: [
      'Functions come from `JSONUIProvider functions={{ … }}` (or `createRenderer`\'s `functions` prop). Signature: `(args: Record<string, unknown>) => unknown`.',
      'Every value in `args` is resolved first, so args may nest `$state`, `$item`, `$template` and other expressions.',
      'An unregistered name logs `Unknown $computed function: "<name>"` once per name and resolves to `undefined`.',
      'The model only knows about a function if you tell it — there is no catalog field for computed functions.',
      '`args` is optional; the function then gets `{}`.',
    ],
    example: {
      spec: {
        root: 'screen',
        elements: {
          screen: { type: 'Screen', props: { title: null, subtitle: null }, children: ['t'] },
          t: {
            type: 'Text',
            props: { value: { $computed: 'notRegisteredHere', args: { amount: { $state: '/total' } } }, tone: 'warning', size: null },
            children: [],
          },
        },
      },
      seed: { total: 4820 },
      note: 'This reference page registers no functions, so you are looking at the failure mode: undefined, plus one console warning. Wire `functions` on JSONUIProvider to make it work.',
    },
    related: ['expr-directive', 'prov-jsonuiprovider', 'util-resolvepropvalue'],
    step: 'expressions',
    tags: ['$computed', 'functions'],
  },
  {
    id: 'expr-directive',
    category: 'Expressions',
    name: 'custom directives ($yourKey)',
    signature: `defineDirective({ name: "$format", schema, resolve(value, ctx) { … } })`,
    summary: 'Register your own $-key. Checked only after every built-in expression, so built-ins always win.',
    details: [
      'Pass the array to `JSONUIProvider directives={[…]}`; it is turned into a Map by `createDirectiveRegistry`.',
      '`findDirective` scans the registry for a key present on the object — so `{ "$format": "date", "value": … }` matches.',
      '`defineDirective` THROWS at definition time if the name collides with a built-in: `Directive name "$state" conflicts with a built-in prop expression key`.',
      'Your `resolve` receives the raw object and the `PropResolutionContext`; call `resolvePropValue` on sub-values to compose with `$state`, `$item`, etc.',
      'Pass the same array to `catalog.prompt({ directives })` so the model knows the key exists.',
    ],
    failure: {
      spec: {
        root: 'screen',
        elements: {
          screen: { type: 'Screen', props: { title: null, subtitle: null }, children: ['t'] },
          t: { type: 'Text', props: { value: { $format: 'currency', amount: { $state: '/total' } } as never, tone: 'warning', size: null }, children: [] },
        },
      },
      seed: { total: 4820 },
      note: 'No directive is registered here, so `$format` is not an expression — it is an object literal. Note that its sub-value IS still resolved: the component receives { $format: "currency", amount: 4820 }. Unknown $-keys do not throw and do not warn.',
    },
    related: ['util-definedirective', 'expr-computed', 'prov-jsonuiprovider'],
    step: 'directives',
    tags: ['directive', 'custom', '$key'],
  },
];
