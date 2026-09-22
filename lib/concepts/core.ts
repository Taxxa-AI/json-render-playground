import type { Concept } from './types';

/**
 * Spec grammar, expressions, binding, lists, actions, validation.
 * Owned by the concepts agent.
 *
 * Every claim in here — every `gotcha` especially — was run against the
 * installed @json-render/core and @json-render/react 0.20.0 before it was
 * written down. Where the README and the runtime disagree, the runtime wins
 * and the card says so.
 */
export const CORE_CONCEPTS: Concept[] = [
  // ───────────────────────────────────────────── the shape ──────────────
  {
    id: 'spec',
    title: 'What a spec is',
    summary:
      'A spec is a JSON document with three top-level fields: the key of the root element, a flat map of every element by key, and optional seed data. That is the whole format.',
    shape: `{
  "root": "screen",                 // a KEY, not an object
  "elements": { "screen": { … } },  // flat map, key → element
  "state": { }                      // optional, and ignored by <Renderer>
}`,
    example: {
      spec: {
        root: 'card',
        elements: {
          card: { type: 'Card', props: { title: 'A whole spec', subtitle: null }, children: ['t'] },
          t: { type: 'Text', props: { value: 'Three fields. Two of them matter.', tone: null, size: null }, children: [] },
        },
      },
    },
    gotcha: 'There is no fourth field. Anything else you add to the top level is carried around and never read.',
    step: 'shape',
    ref: 'el-root',
  },
  {
    id: 'root',
    title: 'root is a key',
    summary:
      '`root` names one entry in `elements`. The renderer looks that key up and starts walking; nothing else is an entry point.',
    shape: `{ "root": "screen", "elements": { "screen": { … } } }

// root pointing at a key that does not exist:
// nothing renders, nothing throws.`,
    gotcha:
      'A root that names a missing key renders an empty tree in silence. The tree pane shows a single "missing" node — that is your only signal.',
    step: 'shape',
    ref: 'el-root',
  },
  {
    id: 'elements-flat-map',
    title: 'Flat, not nested',
    summary:
      'Elements live side by side in one map instead of nesting inside each other. Every element therefore has a stable address like /elements/header that never moves when the tree changes.',
    shape: `"elements": {
  "screen": { "type": "Screen", "props": {…}, "children": ["card"] },
  "card":   { "type": "Card",   "props": {…}, "children": ["body"] },
  "body":   { "type": "Text",   "props": {…}, "children": [] }
}`,
    gotcha:
      'Flat means keys are global. Two elements cannot share a key — the second one silently replaces the first when the JSON is parsed.',
    step: 'shape',
    ref: 'el-elements',
  },
  {
    id: 'children-are-keys',
    title: 'children are keys',
    summary:
      'An element never contains its children. `children` is an array of strings, and each string is a key to look up in `elements`. The tree is assembled by pointer-chasing from root.',
    shape: `"card": { "type": "Card", "props": {…}, "children": ["badge"] },
"badge": { "type": "Badge", "props": { "label": "Draft", "tone": "warning" },
           "children": [] }

// two edits to add one element: DEFINE it, then REFERENCE it.`,
    example: {
      spec: {
        root: 'card',
        elements: {
          card: { type: 'Card', props: { title: 'Invoice', subtitle: null }, children: ['badge'] },
          badge: { type: 'Badge', props: { label: 'Draft', tone: 'warning' }, children: [] },
        },
      },
    },
    gotcha:
      'A key in `children` that no element defines deletes that branch silently. validateSpec calls it missing_child; the renderer just skips it.',
    step: 'shape',
    ref: 'el-children',
  },
  {
    id: 'reachability',
    title: 'Defined ≠ mounted',
    summary:
      'An element exists for the renderer only if you can reach it from root by following children and slots. Defining it in `elements` is not enough.',
    shape: `"elements": {
  "screen": { …, "children": ["card"] },   // reachable
  "card":   { …, "children": [] },         // reachable
  "ghost":  { …, "children": [] }          // defined — and never rendered
}`,
    gotcha:
      'validateSpec does NOT report unreachable elements; they are legal. The tree pane flags them as "defined but unreachable from root".',
    step: 'shape',
    ref: 'el-children',
  },
  {
    id: 'element-vs-props',
    title: 'Element vs props',
    summary:
      '`visible`, `repeat`, `on` and `watch` are fields of the element, siblings of `type` and `props`. They are instructions to the renderer, not data for your component.',
    shape: `{
  "type": "Alert",
  "props": { "title": "Overdue", "message": null, "tone": "danger" },
  "visible": { "$state": "/late" },   // ← element field
  "on":      { "press": { … } },      // ← element field
  "children": []
}`,
    gotcha:
      'Put `visible` inside `props` and the element is always shown — your component just receives an extra prop it ignores. validateSpec reports visible_in_props; autoFixSpec lifts it back out.',
    step: 'shape',
    ref: 'el-type',
  },
  {
    id: 'slots-vs-children',
    title: 'children IS default',
    summary:
      '`children` fills the component’s default slot. Every other slot the catalog declares is filled through the `slots` map, keyed by name.',
    shape: `{
  "type": "Card",
  "props": { "title": "Invoice", "subtitle": null },
  "children": ["body"],              // the default slot
  "slots": { "footer": ["pay"] }     // every other declared slot
}`,
    example: {
      spec: {
        root: 'card',
        elements: {
          card: {
            type: 'Card',
            props: { title: 'Invoice', subtitle: null },
            children: ['body'],
            slots: { footer: ['pay'] },
          },
          body: { type: 'Text', props: { value: 'Body goes in children.', tone: null, size: null }, children: [] },
          pay: { type: 'Button', props: { label: 'Pay now', variant: 'primary' }, children: [] },
        },
      },
    },
    gotcha:
      'Writing slots.default is not an error and not empty: the content is delivered as slots.default, with a console warning, so a component that only reads `children` renders nothing while one that reads slots?.default renders it in the wrong place. Use children.',
    step: 'shape',
    ref: 'el-slots',
  },
  {
    id: 'unknown-type-fallback',
    title: 'Unknown type',
    summary:
      'An element whose `type` is not in the registry renders the `fallback` component you passed to <Renderer>. Without a fallback it renders nothing at all.',
    shape: `<Renderer spec={spec} registry={registry} fallback={UnknownComponent} />

// no fallback → console.warn("No renderer for component type: BarChart")
//             → and an empty hole where the element was`,
    example: {
      spec: {
        root: 'stack',
        elements: {
          stack: { type: 'Stack', props: { direction: 'column', gap: 'sm', align: null, wrap: null }, children: ['ok', 'bad'] },
          ok: { type: 'Text', props: { value: 'This type is in the registry.', tone: null, size: null }, children: [] },
          bad: { type: 'BarChart', props: {}, children: [] },
        },
      },
    },
    gotcha:
      'The warning goes to the console, not to the UI. One hallucinated component name deletes a branch of a generated page and nothing on screen says so. Always pass a fallback.',
    step: 'shape',
    ref: 'el-type',
  },
  {
    id: 'spec-state-ignored',
    title: 'spec.state is ignored',
    summary:
      '<Renderer> never reads `spec.state`. Seeding the state model is the host app’s job — you pass the data to the store or to the provider yourself.',
    shape: `// the spec carries state…
{ "root": "r", "state": { "user": { "first": "Ada" } }, "elements": { … } }

// …and you still have to do this:
const store = createStateStore(spec.state ?? {});
<JSONUIProvider registry={registry} store={store}>`,
    gotcha:
      'The stock prompt tells the model to fill spec.state with sample data, so generated specs always have it — and every {"$state": …} resolves to undefined until you seed the store from it yourself.',
    step: 'state',
    ref: 'el-state',
  },
  {
    id: 'validate-spec',
    title: 'validateSpec',
    summary:
      'A structural check on a spec, separate from the catalog. It reports dangling child and slot references, malformed `visible` conditions, and broken `repeat` containers.',
    shape: `const { valid, issues } = validateSpec(spec);
// codes: missing_child · invalid_visible · visible_in_props
//        repeat_without_children · repeat_item_outside_scope
//        repeat_state_mismatch`,
    gotcha:
      'It does not check prop types and it does not report unreachable elements — an orphan element is valid. Run it over everything a model generates, but do not mistake "clean" for "correct".',
    step: 'shape',
    ref: 'util-validatespec',
  },

  // ───────────────────────────────────────────── the catalog ────────────
  {
    id: 'catalog-is-schema',
    title: 'Catalog is a schema',
    summary:
      'A catalog declares, per component, which props a node of that type may carry and of what type. Everything else — the AI prompt, the registry’s TypeScript, catalog.validate — is generated from that one declaration.',
    shape: `Metric: {
  description: 'A single big number with a caption. Use for KPIs.',
  props: z.object({ label: z.string(), value: z.string(),
                    delta: z.string().nullable() }),
  slots: [],                       // [] = no children, ['default'] = children
  example: { label: 'Revenue', value: '€48,200', delta: '+12%' },
}`,
    gotcha:
      'Nothing enforces that Zod schema at render time. A node with label: 123 renders happily — the schema types your code and writes the prompt, it does not guard the tree.',
    step: 'catalog',
    ref: 'el-props',
  },
  {
    id: 'description-is-prompt',
    title: 'description is the doc',
    summary:
      'catalog.prompt() serialises every description and Zod schema into the system prompt. That string is the only documentation a model will ever get about your component.',
    shape: `const systemPrompt = catalog.prompt({
  system: 'You are a finance dashboard builder.',
  customRules: ['Never invent monetary figures.'],
});
// → AVAILABLE COMPONENTS / AVAILABLE ACTIONS + fixed scaffolding`,
    gotcha:
      'Changing a description changes model behaviour globally and silently — no test fails. Review these like a public API.',
    step: 'catalog',
    ref: 'util-catalogprompt',
  },
  {
    id: 'nullable-not-optional',
    title: '.nullable() not .optional()',
    summary:
      'Prefer z.string().nullable() over .optional() in catalog props. Providers emit an explicit null more reliably than they omit a key, and a null survives a JSON round-trip unchanged.',
    shape: `props: z.object({
  title: z.string(),
  subtitle: z.string().nullable(),   // model writes "subtitle": null
})

// in every spec, write the null explicitly:
"props": { "title": "Invoice", "subtitle": null }`,
    gotcha:
      'Mixed .optional() and .nullable() teaches the model two conventions at once, and it will use both. Pick nullable and be consistent.',
    step: 'catalog',
    ref: 'el-props',
  },
  {
    id: 'validate-names-only',
    title: 'catalog.validate',
    summary:
      'catalog.validate(spec) checks a spec against the generated schema. In practice that means component names and spec structure — and very little else.',
    shape: `const r = catalog.validate(spec);
// rejected: { "type": "BarChart" }        ← not a known component
// rejected: an element with no "children" array
// PASSES:   { "label": 123, "tone": "purple", "nonsense": true }
// PASSES:   { "on": { "press": { "action": "launchMissiles" } } }`,
    gotcha:
      'Prop types are only narrowed when the catalog has exactly ONE component; with two or more the schema widens to an open object and anything passes. Action names are never checked. Three things guard you — validateSpec for structure, catalog.validate for component names, your own component for prop shapes.',
    step: 'catalog',
    ref: 'util-catalogvalidate',
  },

  // ───────────────────────────────────────────── the registry ───────────
  {
    id: 'registry-answers-catalog',
    title: 'Registry answers it',
    summary:
      'The catalog says a Metric node may exist and what it carries. The registry says what a Metric renders as. One catalog can have many registries — shadcn, wireframe, PDF.',
    shape: `export const { registry, handlers, executeAction } =
  defineRegistry(catalog, {
    components: { Metric: ({ props }) => <Kpi {...props} /> },
    actions:    { submit: async () => save() },   // must be async
  });`,
    gotcha:
      'In the catalog only → TypeScript refuses to compile. In the registry only → renders by hand, but it is absent from catalog.prompt(), so no model can ever emit it. That second case is a useful way to hide internal components from generation.',
    step: 'registry',
    ref: 'ctx-props',
  },
  {
    id: 'props-arrive-resolved',
    title: 'Props arrive resolved',
    summary:
      'By the time your component runs, every $state, $cond, $template and $computed in its props has already been evaluated. You receive plain values.',
    shape: `// in the spec
"props": { "message": { "$state": "/user/first" } }

// in your component
({ props }) => <p>{props.message}</p>   // props.message === "Ada"`,
    example: {
      spec: {
        root: 'alert',
        elements: {
          alert: {
            type: 'Alert',
            props: { title: 'Resolved before the component runs', message: { $state: '/user/first' }, tone: 'info' },
            children: [],
          },
        },
      },
      seed: { user: { first: 'Ada' } },
    },
    gotcha:
      'Resolution is eager and per render, for every visible element. Fine for forms and dashboards; not for a ten-thousand-row table — precompute into state and read it with plain $state.',
    step: 'registry',
    ref: 'ctx-props',
  },
  // ───────────────────────────────────────────── state & binding ────────
  {
    id: 'json-pointer',
    title: 'JSON Pointer paths',
    summary:
      'Every path into the state model is RFC 6901: a leading slash, then segments. Array indices are segments too.',
    shape: `"/user/first"          ✓
"/invoices/0/amount"   ✓
"user.first"           ✗ — a key literally named "user.first"
"invoices[0].amount"   ✗ — not JavaScript`,
    gotcha:
      '/user/first/length looks up a key named "length" and resolves to undefined. There is no property access, no arithmetic and no method calls — $computed is the only escape.',
    step: 'state',
    ref: 'expr-state',
  },
  {
    id: 'state-read',
    title: '$state reads',
    summary:
      '{"$state": "/path"} is a one-way read. The prop reflects whatever is at that path; the component cannot write back through it.',
    shape: `"props": { "message": { "$state": "/user/first" } }

// missing path → undefined → the prop renders blank.`,
    example: {
      spec: {
        root: 'stack',
        elements: {
          stack: { type: 'Stack', props: { direction: 'column', gap: 'sm', align: null, wrap: null }, children: ['a', 'b'] },
          a: { type: 'Text', props: { value: { $state: '/user/first' }, tone: null, size: null }, children: [] },
          b: { type: 'Text', props: { value: { $state: '/user/nope' }, tone: 'danger', size: 'sm' }, children: [] },
        },
      },
      seed: { user: { first: 'Ada' } },
    },
    gotcha:
      'A missing path is not an error. It resolves to undefined and renders as nothing, which looks exactly like a styling bug. The second line above is bound to a path that does not exist.',
    step: 'state',
    ref: 'expr-state',
  },
  {
    id: 'bind-state',
    title: '$bindState writes',
    summary:
      '{"$bindState": "/path"} is two-way. The renderer hands your component the value in `props` and the path in `bindings`, and useBoundProp pairs them back up.',
    shape: `"props": { "value": { "$bindState": "/user/first" } }

// in the component
const [value, setValue] =
  useBoundProp<string>(props.value, bindings?.value);
// props.value    === "Ada"          ← the VALUE
// bindings.value === "/user/first"  ← the PATH`,
    example: {
      spec: {
        root: 'stack',
        elements: {
          stack: { type: 'Stack', props: { direction: 'column', gap: 'sm', align: null, wrap: null }, children: ['in', 'out'] },
          in: {
            type: 'TextInput',
            props: { label: 'Type here', value: { $bindState: '/user/first' }, placeholder: 'Ada', help: null, required: null, checks: null },
            children: [],
          },
          out: { type: 'Badge', props: { label: { $template: '/user/first = ${/user/first}' }, tone: 'info' }, children: [] },
        },
      },
      seed: { user: { first: 'Ada' } },
    },
    gotcha:
      'Writing to a path whose parents do not exist creates them. Nothing declares the state shape, so a typo silently grows a new branch instead of failing.',
    step: 'state',
    ref: 'expr-bindstate',
  },
  {
    id: 'natural-value-prop',
    title: 'Bind the value prop',
    summary:
      'A binding goes on the component’s natural value prop — `value` for a text field, `checked` for a checkbox, `pressed` for a toggle. There is no statePath prop.',
    shape: `{ "type": "TextInput", "props": { "value":   { "$bindState": "/form/email" } } }
{ "type": "Checkbox",  "props": { "checked": { "$bindState": "/form/news"  } } }

// bindings arrives keyed by prop name:
//   { value: "/form/email" }   /   { checked: "/form/news" }`,
    example: {
      spec: {
        root: 'stack',
        elements: {
          stack: { type: 'Stack', props: { direction: 'column', gap: 'sm', align: null, wrap: null }, children: ['c', 'e'] },
          c: { type: 'Checkbox', props: { label: 'Monthly digest', checked: { $bindState: '/form/news' } }, children: [] },
          e: { type: 'Badge', props: { label: { $template: 'news = ${/form/news}' }, tone: 'neutral' }, children: [] },
        },
      },
      seed: { form: { news: false } },
    },
    gotcha:
      'Bind the wrong prop name and the control reads a literal instead: it renders, it just never updates. Which prop is "natural" is a fact about your registry component, so put it in the catalog description.',
    step: 'state',
    ref: 'expr-bindstate',
  },
  {
    id: 'literal-is-readonly',
    title: 'Literal = read-only',
    summary:
      'A control whose value prop is a plain literal has no binding path. useBoundProp has nowhere to write, so setValue is a no-op and the field will not accept typing.',
    shape: `"props": { "value": "Lovelace" }      // literal → bindings is undefined
"props": { "value": { "$state": … } } // one-way → bindings is undefined
"props": { "value": { "$bindState": … } } // ← the only writable form`,
    example: {
      spec: {
        root: 'stack',
        elements: {
          stack: { type: 'Stack', props: { direction: 'column', gap: 'sm', align: null, wrap: null }, children: ['ok', 'stuck'] },
          ok: {
            type: 'TextInput',
            props: { label: 'Bound — types fine', value: { $bindState: '/a' }, placeholder: null, help: null, required: null, checks: null },
            children: [],
          },
          stuck: {
            type: 'TextInput',
            props: { label: 'Literal — will not type', value: 'Lovelace', placeholder: null, help: null, required: null, checks: null },
            children: [],
          },
        },
      },
      seed: { a: '' },
    },
    gotcha:
      'This is the number-one cause of "my input will not type". Note that {"$state": …} fails the same way — reading is not binding.',
    step: 'state',
    ref: 'expr-bindstate',
  },

  // ───────────────────────────────────────────── stores ─────────────────
  {
    id: 'store-uncontrolled',
    title: 'Uncontrolled state',
    summary:
      'Pass `initialState` and the provider owns the state model. You can observe changes through onStateChange, but you cannot read it on demand and nothing outside React can write to it.',
    shape: `<JSONUIProvider
  registry={registry}
  initialState={{ name: 'Ada' }}
  onStateChange={(changes) => log(changes)}   // push-only
/>`,
    gotcha:
      'A dead end the moment anything outside the tree needs to write — a websocket, a background job, or an agent filling a form field by field. Default to controlled instead.',
    step: 'stores',
    ref: 'util-createstatestore',
  },
  {
    id: 'store-controlled',
    title: 'Controlled state',
    summary:
      'Create the store yourself with createStateStore and pass it as `store`. You can now read and write the state model from anywhere, and the renderer re-renders on its own.',
    shape: `const store = createStateStore({ name: 'Ada' });

<JSONUIProvider registry={registry} store={store} />

store.get('/name');          // "Ada"
store.set('/name', 'Grace'); // the input updates. No event, no ref.`,
    gotcha:
      'When `store` is provided, `initialState` and `onStateChange` are ignored entirely. Pass both and the initialState silently does nothing.',
    step: 'stores',
    ref: 'util-createstatestore',
  },
  {
    id: 'store-adapter',
    title: 'Any store adapter',
    summary:
      'createStoreAdapter turns { getSnapshot, setSnapshot, subscribe } into a full StateStore. That is the whole integration surface for Redux, Zustand, Jotai or XState.',
    shape: `import { createStoreAdapter } from '@json-render/core/store-utils';

const adapter = createStoreAdapter({
  getSnapshot: () => myStore.getState(),
  setSnapshot: (next) => myStore.setState(next),
  subscribe:   (listener) => myStore.subscribe(listener),
});`,
    gotcha:
      '`set` no-ops when the value is unchanged and subscribers are not notified. If you wrap a store for telemetry, compare snapshot identity rather than counting calls.',
    step: 'stores',
    ref: 'util-createstoreadapter',
  },

  // ───────────────────────────────────────────── expressions ────────────
  {
    id: 'cond-expression',
    title: '$cond picks a value',
    summary:
      '{ "$cond": …, "$then": …, "$else": … } evaluates a condition — the same grammar as `visible` — and returns one branch. Both branches may themselves be expressions.',
    shape: `{
  "$cond": { "$state": "/user/plan", "eq": "pro" },
  "$then": "Pro member",
  "$else": { "$state": "/user/plan" }
}`,
    example: {
      spec: {
        root: 'b',
        elements: {
          b: {
            type: 'Badge',
            props: {
              label: { $cond: { $state: '/plan', eq: 'pro' }, $then: 'Pro member', $else: 'Free tier' },
              tone: { $cond: { $state: '/plan', eq: 'pro' }, $then: 'success', $else: 'neutral' },
            },
            children: [],
          },
        },
      },
      seed: { plan: 'pro' },
    },
    gotcha:
      'All three keys are required. Omit $else and it stops being a $cond: the object falls through as a literal, and your component receives { "$cond": true, "$then": "…" } instead of a string.',
    step: 'expressions',
    ref: 'expr-cond',
  },
  {
    id: 'template',
    title: '$template interpolates',
    summary:
      '{ "$template": "…" } fills ${…} holes. An absolute ${/path} reads the state model; a bare ${name} reads the current repeat item first, then falls back to /name in state.',
    shape: `{ "$template": "Hello \${/user/first}, \${/cart/count} items" }
{ "$template": "\${client} owes \${amount}" }   // bare → repeat item first`,
    example: {
      spec: {
        root: 't',
        elements: {
          t: {
            type: 'Text',
            props: { value: { $template: 'Hello ${/user/first} — ${/cart/count} items, ${/nope} left' }, tone: null, size: null },
            children: [],
          },
        },
      },
      seed: { user: { first: 'Ada' }, cart: { count: 3 } },
    },
    gotcha:
      'A missing hole becomes an empty string, not "undefined" — so a mistyped path just quietly shortens the sentence. The example above contains one.',
    step: 'expressions',
    ref: 'expr-template',
  },
  {
    id: 'computed',
    title: '$computed calls you',
    summary:
      '{ "$computed": "fn", "args": {…} } calls a function you registered on the provider, with every arg resolved first. It is the escape hatch for anything pointers cannot express.',
    shape: `{ "$computed": "initials",
  "args": { "first": { "$state": "/user/first" },
            "last":  { "$state": "/user/last"  } } }

<JSONUIProvider functions={{ initials: (a) => … }} …>`,
    gotcha:
      'An unregistered function resolves to undefined and logs "Unknown $computed function" — the one place this library warns you. catalog.prompt() does not list your functions, so a model cannot know they exist unless you say so in customRules.',
    step: 'expressions',
    ref: 'expr-computed',
  },
  {
    id: 'item',
    title: '$item reads the row',
    summary:
      '{ "$item": "field" } reads a field off the current repeat item. Use "" to get the whole item object.',
    shape: `{ "$item": "client" }   // the field
{ "$item": "" }         // the whole item object

// outside a repeat: undefined, silently.`,
    example: {
      spec: {
        root: 'list',
        elements: {
          list: {
            type: 'Stack',
            props: { direction: 'column', gap: 'sm', align: null, wrap: null },
            repeat: { statePath: '/invoices', key: 'id' },
            children: ['row'],
          },
          row: { type: 'Text', props: { value: { $item: 'client' }, tone: null, size: null }, children: [] },
        },
      },
      seed: { invoices: [{ id: 'a', client: 'Acme Oy' }, { id: 'b', client: 'Borealis AB' }] },
    },
    gotcha:
      '$item outside a repeat scope is undefined with no warning at all. It looks identical to a missing field on a real item.',
    step: 'expressions',
    ref: 'expr-item',
  },
  {
    id: 'index',
    title: '$index is a flag',
    summary:
      '{ "$index": true } resolves to the current zero-based repeat index. `true` is a sentinel — the index is a scalar with no sub-path to navigate, unlike $item.',
    shape: `{ "$index": true }        // ✓  0, 1, 2 …
{ "$index": 0 }           // ✗  not an $index expression at all
{ "$index": true, "gt": 0 }   // as a visibility condition`,
    example: {
      spec: {
        root: 'list',
        elements: {
          list: {
            type: 'Stack',
            props: { direction: 'column', gap: 'sm', align: null, wrap: null },
            repeat: { statePath: '/rows', key: 'id' },
            children: ['row'],
          },
          row: { type: 'Text', props: { value: { $index: true }, tone: null, size: 'sm' }, children: [] },
        },
      },
      seed: { rows: [{ id: 'a' }, { id: 'b' }, { id: 'c' }] },
    },
    gotcha:
      'Any value other than exactly `true` makes it an ordinary object, which passes through as a literal. { "$index": 1 } is not "the second item".',
    step: 'expressions',
    ref: 'expr-index',
  },
  {
    id: 'unknown-dollar-key',
    title: 'Unknown $-keys',
    summary:
      'A $-key the resolver does not recognise is not an error and not undefined. The object passes through as a literal, with its sub-expressions already resolved.',
    shape: `{ "$bogus": { "$state": "/user/first" }, "opt": 1 }
// resolves to
{ "$bogus": "Ada", "opt": 1 }     // an OBJECT, handed to your component`,
    gotcha:
      'Your component then receives an object where it expected a string, and React throws "Objects are not valid as a React child". A misspelt $stat is the usual cause.',
    step: 'expressions',
    ref: 'expr-computed',
  },

  // ───────────────────────────────────────────── conditions ─────────────
  {
    id: 'visible-grammar',
    title: 'The visible grammar',
    summary:
      '`visible` is the only branching a spec has. One scope per object — $state, $item or $index — plus at most one comparison operator, composed with arrays, $and and $or.',
    shape: `{ "$state": "/path" }                  // truthy
{ "$state": "/path", "not": true }     // inverts whatever follows
{ "$state": "/path", "eq": "active" }  // also neq gt gte lt lte
{ "$item": "status", "eq": "unpaid" }  // a field on the repeat item
{ "$index": true, "gt": 0 }            // the repeat index
[ condA, condB ]                       // implicit AND
{ "$and": [ … ] }  { "$or": [ … ] }  true  false`,
    example: {
      spec: {
        root: 'stack',
        elements: {
          stack: { type: 'Stack', props: { direction: 'column', gap: 'sm', align: null, wrap: null }, children: ['on', 'off'] },
          on: { type: 'Badge', props: { label: 'visible: /late is truthy', tone: 'success' }, visible: { $state: '/late' }, children: [] },
          off: { type: 'Badge', props: { label: 'you will never see this', tone: 'danger' }, visible: { $state: '/late', not: true }, children: [] },
        },
      },
      seed: { late: true },
    },
    gotcha:
      'gt/gte/lt/lte are numeric only: if either side is not a number the comparison is false, so {"$state":"/name","gt":0} hides everything.',
    step: 'conditions',
    ref: 'cond-eq',
  },
  {
    id: 'one-operator',
    title: 'One operator only',
    summary:
      'A condition object may carry one comparison. Give it two and only the first by precedence is evaluated: eq, then neq, gt, gte, lt, lte. `not` inverts the result of whichever one ran.',
    shape: `{ "$state": "/count", "gt": 99, "eq": 3 }
// eq wins by precedence — the gt is ignored, not AND-ed.

{ "$and": [ { "$state": "/count", "gt": 3 },
            { "$state": "/count", "lt": 9 } ] }   // ← a real range`,
    gotcha:
      'The ignored operator is not reported anywhere. A range written as one object silently becomes a single comparison.',
    step: 'conditions',
    ref: 'cond-and',
  },
  {
    id: 'hidden-is-unmounted',
    title: 'Hidden means absent',
    summary:
      'A false condition removes the element from the tree. It is not display:none — children never mount, effects never run, and nothing inside it can register.',
    shape: `{ "type": "Card", "visible": false, "children": ["email"] }
// the TextInput under "email" never mounts,
// so it never calls useFieldValidation,
// so validateForm cannot see it.`,
    gotcha:
      'Bound state keeps its last value when an element hides. Hiding a form section does not clear the answers underneath it — you cannot use unmounting to reset anything.',
    step: 'conditions',
    ref: 'el-visible',
  },
  {
    id: 'first-tab-idiom',
    title: 'The first-tab idiom',
    summary:
      'Before anything is clicked, /tab is undefined, so {"$state":"/tab","eq":"home"} is false and the default panel is missing. OR it with a falsy check.',
    shape: `{ "$or": [ { "$state": "/tab", "eq": "home" },
           { "$state": "/tab", "not": true } ] }

// or seed the state model with { "tab": "home" } and skip the idiom.`,
    gotcha:
      'This is the most common generated-UI bug there is: a tab bar where the first tab shows nothing until you click away and back.',
    step: 'conditions',
    ref: 'cond-or',
  },
  {
    id: 'malformed-is-truthy',
    title: 'Malformed ≠ hidden',
    summary:
      'A malformed condition is not an error — and not reliably hidden either. Every broken shape fails a different way, and none of them tells you.',
    shape: `{ "$state": "/count", "greaterThan": 4 }  // unknown op IGNORED →
                                          // truthiness of /count
{ "status": "active" }   // no $-key → tests the whole state model
{ }                      // → always visible
{ "state": "/x", "gt": 2 }  // typo'd $ + an operator → always FALSE
null / "yes" / 5         // THROWS, and takes the render with it`,
    gotcha:
      'validateSpec rejects all five as invalid_visible, and it is the only thing that will. Run it over every generated spec — at runtime a typo turns your condition into a different condition rather than into an error.',
    step: 'conditions',
    ref: 'cond-literal',
  },

  // ───────────────────────────────────────────── lists ──────────────────
  {
    id: 'repeat-container',
    title: 'repeat expands children',
    summary:
      '`repeat` is an element field. The container renders once; its `children` are expanded once per item in the array at `statePath`.',
    shape: `{
  "type": "Stack",
  "repeat": { "statePath": "/invoices", "key": "id" },
  "children": ["row"]        // ONE definition, N renders
}`,
    example: {
      spec: {
        root: 'card',
        elements: {
          card: {
            type: 'Card',
            props: { title: 'One container, three rows', subtitle: null },
            repeat: { statePath: '/invoices', key: 'id' },
            children: ['row'],
          },
          row: { type: 'Badge', props: { label: { $item: 'client' }, tone: 'info' }, children: [] },
        },
      },
      seed: { invoices: [{ id: 'a', client: 'Acme' }, { id: 'b', client: 'Borealis' }, { id: 'c', client: 'Cygnus' }] },
    },
    gotcha:
      'A statePath that is missing or is not an array renders the container with zero children — visually identical to a filter that matched nothing, or to a bug somewhere else. validateSpec reports repeat_state_mismatch and repeat_without_children.',
    step: 'lists',
    ref: 'el-repeat',
  },
  {
    id: 'filtered-repeat',
    title: 'Filtering a repeat',
    summary:
      'There is no filter field. Put `repeat` and an `$item` condition on the SAME element: the renderer splits the condition, using $item conjuncts to pick items and the rest to gate the container.',
    shape: `{
  "repeat":  { "statePath": "/invoices", "key": "id" },
  "visible": { "$item": "status", "eq": "unpaid" },
  "children": ["row"]
}
// splitRepeatVisibility() → { container: undefined,
//                             itemFilter: { $item: … } }`,
    example: {
      spec: {
        root: 'card',
        elements: {
          card: {
            type: 'Card',
            props: { title: 'Unpaid only', subtitle: null },
            repeat: { statePath: '/invoices', key: 'id' },
            visible: { $item: 'status', eq: 'unpaid' },
            children: ['row'],
          },
          row: { type: 'Badge', props: { label: { $item: 'client' }, tone: 'warning' }, children: [] },
        },
      },
      seed: {
        invoices: [
          { id: 'a', client: 'Acme', status: 'paid' },
          { id: 'b', client: 'Borealis', status: 'unpaid' },
          { id: 'c', client: 'Cygnus', status: 'unpaid' },
        ],
      },
    },
    gotcha:
      'An $or that mixes $item and $state cannot be partitioned, so the whole condition is applied per item and the container can no longer be hidden by it. Use an array or $and to keep the two scopes separable.',
    step: 'lists',
    ref: 'el-repeat',
  },
  {
    id: 'bind-item',
    title: '$bindItem writes a row',
    summary:
      '{ "$bindItem": "field" } is two-way binding into the CURRENT item. The renderer joins it to the repeat base path, so each row writes to /invoices/1/note rather than a shared global path.',
    shape: `"props": { "value": { "$bindItem": "note" } }

// bindings.value === "/invoices/1/note"   ← per row, absolute`,
    example: {
      spec: {
        root: 'card',
        elements: {
          card: {
            type: 'Card',
            props: { title: 'Type in a row', subtitle: null },
            repeat: { statePath: '/invoices', key: 'id' },
            children: ['note'],
          },
          note: {
            type: 'TextInput',
            props: { label: { $item: 'client' }, value: { $bindItem: 'note' }, placeholder: 'add a note', help: null, required: null, checks: null },
            children: [],
          },
        },
      },
      seed: { invoices: [{ id: 'a', client: 'Acme', note: '' }, { id: 'b', client: 'Borealis', note: '' }] },
    },
    gotcha:
      '$bindItem outside a repeat resolves to undefined and logs "$bindItem used outside repeat scope". The control then has no binding and goes read-only.',
    step: 'lists',
    ref: 'expr-binditem',
  },
  {
    id: 'nested-repeat',
    title: 'Nested repeats',
    summary:
      'An inner repeat can iterate an array that lives on the enclosing item by giving `statePath` an $item expression instead of a string.',
    shape: `{ "repeat": { "statePath": { "$item": "lines" }, "key": "sku" } }

// valid ONLY inside another repeat.
// outside → validateSpec: repeat_item_outside_scope`,
    example: {
      spec: {
        root: 'outer',
        elements: {
          outer: {
            type: 'Card',
            props: { title: { $item: 'client' }, subtitle: null },
            repeat: { statePath: '/invoices', key: 'id' },
            children: ['inner'],
          },
          inner: {
            type: 'Stack',
            props: { direction: 'row', gap: 'sm', align: 'center', wrap: true },
            repeat: { statePath: { $item: 'lines' }, key: 'sku' },
            children: ['line'],
          },
          line: { type: 'Badge', props: { label: { $item: 'sku' }, tone: 'info' }, children: [] },
        },
      },
      seed: {
        invoices: [
          { id: 'a', client: 'Acme Oy', lines: [{ sku: 'A-1' }, { sku: 'A-2' }] },
          { id: 'b', client: 'Borealis AB', lines: [{ sku: 'B-7' }] },
        ],
      },
    },
    gotcha:
      'Inside the inner repeat, $item refers to the INNER item. The outer item is out of reach — copy what you need down into the inner objects, or read it from an absolute $state path.',
    step: 'lists',
    ref: 'el-repeat',
  },
  {
    id: 'repeat-key',
    title: 'repeat.key',
    summary:
      '`key` names a field on each item to use as the React key. Omit it and the renderer keys by array index.',
    shape: `{ "repeat": { "statePath": "/invoices", "key": "id" } }   // stable
{ "repeat": { "statePath": "/invoices" } }               // index keys`,
    gotcha:
      'With index keys, removing a row makes React reuse the component instance that sat at that position rather than unmounting it — measurably: the surviving DOM nodes are the FIRST ones, not the ones that belonged to the surviving rows. Props still arrive correctly, so anything driven by $bindItem looks right; what goes to the wrong row is whatever React owns and the spec does not — focus and caret, an uncontrolled input, useState inside your component, a running transition.',
    step: 'lists',
    ref: 'el-repeat',
  },

  // ───────────────────────────────────────────── actions & watch ────────
  {
    id: 'on-and-emit',
    title: 'on and emit',
    summary:
      'An element’s `on` field maps an event name to an action binding. Your component fires it with emit("press"); the name is a contract between the two, and nothing checks that they agree.',
    shape: `// spec                            // component
"on": { "press": {                 ({ props, emit }) =>
  "action": "submit",                <button onClick={() => emit('press')}>
  "params": {}                         {props.label}
} }                                  </button>`,
    gotcha:
      'emit() for an event with no binding is a silent no-op, and a binding for an event your component never emits is dead JSON. Neither is reported — use on("press").bound if you need to know.',
    step: 'actions',
    ref: 'el-on',
  },
  {
    id: 'built-in-actions',
    title: 'Built-in actions',
    summary:
      'setState, pushState, removeState and validateForm are handled by ActionProvider itself. They need no handler, and they are injected into the AI prompt without appearing in your catalog.',
    shape: `{ "action": "setState",    "params": { "statePath": "/tab", "value": "home" } }
{ "action": "pushState",   "params": { "statePath": "/todos", "value": {…},
                                       "clearStatePath": "/draft" } }
{ "action": "removeState", "params": { "statePath": "/todos",
                                       "index": { "$index": true } } }
{ "action": "validateForm","params": { "statePath": "/result" } }`,
    example: {
      spec: {
        root: 'stack',
        elements: {
          stack: { type: 'Stack', props: { direction: 'column', gap: 'sm', align: 'start', wrap: null }, children: ['b', 'out'] },
          b: {
            type: 'Button',
            props: { label: 'setState /tab = settings', variant: 'primary' },
            on: { press: { action: 'setState', params: { statePath: '/tab', value: 'settings' } } },
            children: [],
          },
          out: { type: 'Badge', props: { label: { $template: '/tab = ${/tab}' }, tone: 'info' }, children: [] },
        },
      },
      seed: { tab: 'home' },
    },
    gotcha:
      'They return before the confirm, onSuccess and onError machinery runs, so those three fields are ignored on a built-in action. Wrap the write in a handler of your own if you need them.',
    step: 'actions',
    ref: 'act-setstate',
  },
  {
    id: 'push-state-id',
    title: 'pushState and $id',
    summary:
      'pushState appends to an array. Inside its `value`, a lone "$id" becomes a generated unique id and a lone {"$state": "/path"} is replaced by that value — and `clearStatePath` empties the input afterwards.',
    shape: `{ "action": "pushState", "params": {
  "statePath": "/todos",
  "value": { "id": "$id", "text": { "$state": "/draft" }, "done": false },
  "clearStatePath": "/draft"
} }`,
    gotcha:
      'The substitution is only made for an object with exactly one key — { "$state": "/draft", "fallback": "" } is pushed verbatim, expression and all. clearStatePath writes "" , not null.',
    step: 'actions',
    ref: 'act-pushstate',
  },
  {
    id: 'binding-array',
    title: 'An array of bindings',
    summary:
      'One EVENT may carry an array of action bindings instead of a single one. They run in order, each awaited before the next begins. This is an `on` feature: in a `watch` entry the same array is unreliable.',
    shape: `"on": { "press": [
  { "action": "validateForm", "params": { "statePath": "/result" } },
  { "action": "submit" }
] }`,
    gotcha:
      'Sequential is not conditional. Nothing in the array can stop the rest — if the first action fails or reports the form invalid, the second still runs. Branching lives in onSuccess/onError, not in the array. And do not reach for this inside `watch`: there the first binding that writes state cancels the effect running the loop, so the rest are dropped with no warning.',
    step: 'actions',
    ref: 'act-array',
  },
  {
    id: 'confirm-success-error',
    title: 'confirm / onSuccess / onError',
    summary:
      'A binding can gate itself behind a confirm dialog and branch afterwards: onSuccess can navigate, set state paths or chain an action; onError can set paths or chain an action.',
    shape: `{
  "action": "deleteInvoice",
  "confirm": { "title": "Delete?", "message": "Delete \${/inv/ref}?",
               "variant": "danger" },
  "onSuccess": { "set": { "/toast": "Deleted" } },
  "onError":   { "set": { "/error": "$error.message" } }
}`,
    gotcha:
      'onError swallows the error. With no onError the handler’s throw propagates; with one, it is caught and only your `set` runs — so a failed action can look exactly like a successful one.',
    step: 'actions',
    ref: 'act-confirm',
  },

  // ───────────────────────────────────────────── validation ─────────────
  {
    id: 'checks-prop',
    title: 'checks is a prop',
    summary:
      'Validation has no field in the spec schema. Checks travel as an ordinary prop on the control, and the catalog is what declares their shape.',
    shape: `{ "type": "TextInput", "props": {
  "value": { "$bindState": "/form/email" },
  "checks": [
    { "type": "required", "args": null, "message": "Email is required" },
    { "type": "email",    "args": null, "message": "That is not an email" }
  ]
} }`,
    example: {
      spec: {
        root: 'f',
        elements: {
          f: {
            type: 'TextInput',
            props: {
              label: 'Email — focus, then click away',
              value: { $bindState: '/form/email' },
              placeholder: 'you@company.com',
              help: null,
              required: true,
              checks: [{ type: 'required', args: null, message: 'Email is required' }],
            },
            children: [],
          },
        },
      },
      seed: { form: { email: '' } },
    },
    gotcha:
      'Because it is a prop, it is bound by the same rules as any other: a component that never reads `checks` validates nothing, and no error says so.',
    step: 'validation',
    ref: 'val-required',
  },
  {
    id: 'use-field-validation',
    title: 'useFieldValidation',
    summary:
      'The component registers its own checks by calling useFieldValidation(path, config). Registration is what makes a field visible to the built-in validateForm action.',
    shape: `const v = useFieldValidation(bindings?.value ?? \`unbound:\${props.label}\`, {
  checks: props.checks ?? [],
  validateOn: 'blur',
});
v.errors;  v.isValid;  v.validate();  v.touch();  v.clear();`,
    gotcha:
      'Fields are keyed by state path. Two unbound controls that fall back to the same key overwrite each other, so give every unbound control a distinct synthetic key.',
    step: 'validation',
    ref: 'val-usefieldvalidation',
  },
  {
    id: 'cross-field-check',
    title: 'Cross-field checks',
    summary:
      'matches, equalTo, lessThan, greaterThan and requiredIf take another field as an argument, written as a $state expression and resolved against the live model when the check runs.',
    shape: `{ "type": "matches",
  "args": { "other": { "$state": "/form/password" } },
  "message": "Passwords do not match" }

// TypeScript: check.matches('/form/password', 'Passwords do not match')`,
    gotcha:
      'The check runs on ITS OWN field’s events. Editing /form/password does not re-run the confirm field’s matches check, so a form can sit showing a stale "passwords match" state.',
    step: 'validation',
    ref: 'val-matches',
  },
  {
    id: 'validate-form-reports',
    title: 'validateForm reports',
    summary:
      'The built-in validateForm runs every registered field and writes { valid, errors } to a state path — /formValidation unless you pass statePath. Then it returns.',
    shape: `"on": { "press": [
  { "action": "validateForm", "params": { "statePath": "/result" } },
  { "action": "submit" }        // ← runs even when /result.valid is false
] }
// /result = { "valid": false, "errors": { "/form/email": ["…"] } }`,
    gotcha:
      'It reports, it does not block. It fails open: the next action in the array still runs and your submit handler still fires. Gate on /result yourself — and re-validate on the server regardless.',
    step: 'validation',
    ref: 'val-result',
  },
  {
    id: 'unknown-check-silent',
    title: 'Unknown checks pass',
    summary:
      'There are fourteen built-in check types. A check whose type is not one of them — or not registered in validationFunctions — is reported as VALID.',
    shape: `required  email  url  numeric  minLength  maxLength  min  max
pattern   matches  equalTo  lessThan  greaterThan  requiredIf

{ "type": "iban", … }  →  { valid: true }  + console.warn`,
    gotcha:
      'A field carrying a check type you never registered validates clean forever. This is exactly the check a model is most likely to invent, so whitelist check types before you trust a generated form.',
    step: 'validation',
    ref: 'val-result',
  },
];
