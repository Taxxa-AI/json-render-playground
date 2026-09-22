import type { ReferenceEntry } from './types';

/**
 * Spec and element fields. Verified against
 * node_modules/@json-render/core/dist/store-utils-CGwRAVOR.d.ts (Spec, UIElement)
 * and the renderer in node_modules/@json-render/react/dist/index.mjs.
 */
export const SPEC_ENTRIES: ReferenceEntry[] = [
  {
    id: 'el-root',
    category: 'Spec & elements',
    name: 'spec.root',
    signature: `{ "root": "screen", "elements": { "screen": { … } } }`,
    summary: 'The KEY of the element the renderer starts from. Not the element itself.',
    details: [
      'A string key into `elements`. The renderer walks the tree by chasing keys from here.',
      'Empty string → `validateSpec` returns one issue, `missing_root`, and stops.',
      'A key that is not in `elements` → issue code `root_not_found`, and `<Renderer>` renders nothing.',
      'Anything not reachable from root does not mount, however well-formed it is.',
    ],
    example: {
      spec: {
        root: 'screen',
        elements: {
          screen: {
            type: 'Screen',
            props: { title: 'Reachable from root', subtitle: null },
            children: ['hello'],
          },
          hello: { type: 'Text', props: { value: 'This element is a child of root.', tone: null, size: null }, children: [] },
          orphan: { type: 'Badge', props: { label: 'never rendered', tone: 'danger' }, children: [] },
        },
      },
      note: 'Point root at "orphan" and the Screen disappears instead. Both elements are valid; only one is reachable.',
    },
    failure: {
      spec: {
        root: 'main',
        elements: {
          screen: { type: 'Screen', props: { title: 'Hi', subtitle: null }, children: [] },
        },
      },
      note: 'root is "main" but the elements map only has "screen". Nothing renders, no error is thrown. validateSpec is the only thing that tells you.',
    },
    related: ['el-elements', 'util-validatespec', 'util-autofixspec'],
    step: 'shape',
    tags: ['spec', 'root', 'tree'],
  },
  {
    id: 'el-elements',
    category: 'Spec & elements',
    name: 'spec.elements',
    signature: `"elements": {
  "<key>": { "type": "…", "props": { … }, "children": ["<key>", …] }
}`,
    summary: 'A flat map of key → element. The tree is assembled by following children keys, not by nesting objects.',
    details: [
      'Keys are yours to choose. They are addresses, so `/elements/header` is a stable JSON Pointer for a patch.',
      'Flat is what makes streaming cheap: adding an element is one `add` op that disturbs nothing above it.',
      'An empty map → `validateSpec` issue code `empty_spec`.',
      'The catalog rules tell the model every element MUST carry a `children` array, `[]` for leaves.',
    ],
    example: {
      spec: {
        root: 'screen',
        elements: {
          screen: { type: 'Screen', props: { title: 'Flat, not nested', subtitle: null }, children: ['card'] },
          card: { type: 'Card', props: { title: 'Three keys, one tree', subtitle: null }, children: ['a', 'b'] },
          a: { type: 'Text', props: { value: 'card lists ["a","b"] — these two.', tone: null, size: null }, children: [] },
          b: { type: 'Badge', props: { label: 'b', tone: 'info' }, children: [] },
        },
      },
    },
    related: ['el-root', 'el-children', 'util-nestedtoflat', 'util-flattotree'],
    step: 'shape',
    tags: ['spec', 'flat', 'elements'],
  },
  {
    id: 'el-state',
    category: 'Spec & elements',
    name: 'spec.state',
    signature: `"state": { "user": { "name": "Ada" }, "todos": [] }`,
    summary: 'Optional seed data on the spec. The renderer never reads it — seeding the store is the host app\'s job.',
    details: [
      '`<Renderer>` takes `spec`, `registry`, `loading`, `fallback`. There is no state parameter, and nothing in the render path touches `spec.state`.',
      'You pass the seed yourself: `JSONUIProvider initialState={spec.state}` or `store={createStateStore(spec.state)}`.',
      '`validateSpec` does read it: repeat paths are checked against `spec.state`, which is how you get `repeat_state_mismatch`.',
      'The generation prompt tells the model to emit `state` with realistic sample data, so specs that arrive from an LLM usually have it.',
    ],
    example: {
      spec: {
        root: 'screen',
        elements: {
          screen: { type: 'Screen', props: { title: null, subtitle: null }, children: ['t'] },
          t: { type: 'Text', props: { value: { $template: 'Hello ${/user/name}' }, tone: null, size: null }, children: [] },
        },
        state: { user: { name: 'IGNORED — this object is never read' } },
      },
      seed: { user: { name: 'Ada' } },
      note: 'spec.state says "IGNORED" and the seed says "Ada". You see Ada, because the store is seeded from the host, not from the spec.',
    },
    related: ['prov-jsonuiprovider', 'util-createstatestore', 'el-repeat'],
    step: 'state',
    tags: ['state', 'seed', 'gotcha'],
  },
  {
    id: 'el-type',
    category: 'Spec & elements',
    name: 'element.type',
    signature: `{ "type": "Card", "props": { … }, "children": [] }`,
    summary: 'The component name, looked up in the registry you passed to <Renderer>.',
    details: [
      'Lookup is `registry[element.type] ?? fallback`. Exact string match, case-sensitive.',
      'No fallback and an unknown type → the renderer returns null for that element and its whole subtree never mounts.',
      '`validateSpec` does NOT check types against a catalog. `catalog.validate(spec)` does, through Zod.',
      'The type must be a key of the catalog you generated the prompt from, or the model invents components you never wrote.',
    ],
    example: {
      spec: {
        root: 'screen',
        elements: {
          screen: { type: 'Screen', props: { title: null, subtitle: null }, children: ['ok', 'ghost'] },
          ok: { type: 'Badge', props: { label: 'Badge is in the registry', tone: 'success' }, children: [] },
          ghost: { type: 'Sparkline', props: {}, children: [] },
        },
      },
      note: 'Sparkline is not in the demo registry, so the `fallback` component renders instead. Remove the fallback and you get silence.',
    },
    related: ['prov-renderer', 'util-catalogvalidate', 'el-props'],
    step: 'registry',
    tags: ['type', 'registry', 'fallback'],
  },
  {
    id: 'el-props',
    category: 'Spec & elements',
    name: 'element.props',
    signature: `{ "props": { "label": "Total", "value": { "$state": "/total" } } }`,
    summary: 'The component\'s props. Every value is walked by resolvePropValue before your component sees it.',
    details: [
      'Resolution is recursive: arrays are mapped, plain objects are walked key by key.',
      'An object whose shape matches a known expression ($state, $item, $index, $bindState, $bindItem, $cond, $computed, $template) is replaced by its value.',
      'Anything else passes through as a literal — including objects with unknown `$` keys, whose sub-values are still resolved.',
      '`visible`, `on`, `repeat` and `watch` are ELEMENT fields. Put them in props and validateSpec reports `visible_in_props`, `on_in_props`, `repeat_in_props`, `watch_in_props`.',
    ],
    example: {
      spec: {
        root: 'screen',
        elements: {
          screen: { type: 'Screen', props: { title: null, subtitle: null }, children: ['m'] },
          m: {
            type: 'Metric',
            props: { label: 'Revenue', value: { $state: '/revenue' }, delta: { $template: '${/delta}% vs last month' }, tone: 'success' },
            children: [],
          },
        },
      },
      seed: { revenue: '€48,200', delta: 12 },
    },
    failure: {
      spec: {
        root: 'screen',
        elements: {
          screen: { type: 'Screen', props: { title: null, subtitle: null }, children: ['b'] },
          b: { type: 'Badge', props: { label: 'I should be hidden', tone: 'danger', visible: false }, children: [] },
        },
      },
      note: '`visible: false` sits inside props, so the renderer never sees it and the badge shows anyway. The prop is handed to the component, which ignores it. validateSpec reports visible_in_props; autoFixSpec relocates it losslessly.',
    },
    related: ['expr-state', 'util-resolvepropvalue', 'util-autofixspec', 'el-visible'],
    step: 'expressions',
    tags: ['props', 'expressions'],
  },
  {
    id: 'el-children',
    category: 'Spec & elements',
    name: 'element.children',
    signature: `{ "children": ["header", "body"] }`,
    summary: 'Child element KEYS, in render order. This array is the default slot.',
    details: [
      'There is no `slots.default`. `children` IS the default slot — the catalog rules say so explicitly.',
      'A key with no matching element is dropped silently: that branch of the UI just is not there.',
      '`validateSpec` reports `missing_child` per dangling key; `autoFixSpec` prunes them, and marks that fix `lossy: true`.',
      'Leaves still need `children: []`. Omitting it is legal at runtime but violates the rule the prompt gives the model.',
    ],
    example: {
      spec: {
        root: 'screen',
        elements: {
          screen: { type: 'Screen', props: { title: null, subtitle: null }, children: ['stack'] },
          stack: {
            type: 'Stack',
            props: { direction: 'row', gap: 'sm', align: 'center', wrap: null },
            children: ['one', 'two', 'three'],
          },
          one: { type: 'Badge', props: { label: 'first', tone: 'info' }, children: [] },
          two: { type: 'Badge', props: { label: 'second', tone: 'neutral' }, children: [] },
          three: { type: 'Badge', props: { label: 'third', tone: 'success' }, children: [] },
        },
      },
      note: 'Reorder the children array and the badges reorder. The element definitions never move.',
    },
    failure: {
      spec: {
        root: 'screen',
        elements: {
          screen: { type: 'Screen', props: { title: null, subtitle: null }, children: ['card'] },
          card: { type: 'Card', props: { title: 'Where is the body?', subtitle: null }, children: ['body'] },
        },
      },
      note: 'The card points at "body", which does not exist. The card renders empty — no warning, no error boundary. This is the single most common failure in AI-generated specs.',
    },
    related: ['el-slots', 'el-elements', 'util-validatespec', 'util-autofixspec'],
    step: 'shape',
    tags: ['children', 'keys', 'slots'],
  },
  {
    id: 'el-slots',
    category: 'Spec & elements',
    name: 'element.slots',
    signature: `{ "children": ["body"], "slots": { "footer": ["actions"] } }`,
    summary: 'Named slots: slot name → child keys. Separate from children, and never called "default".',
    details: [
      'The component receives them as `slots.footer` (a ReactNode), alongside `children`.',
      'Which names exist is declared per component in the catalog (`slots: ["default", "footer"]`), and the prompt lists them.',
      'Slot keys are validated like children: a dangling key is `missing_child`, and the message names the slot.',
      'Writing `slots: { default: [...] }` does nothing — the demo Card reads `slots.footer` and `children`, so that content vanishes.',
    ],
    example: {
      spec: {
        root: 'screen',
        elements: {
          screen: { type: 'Screen', props: { title: null, subtitle: null }, children: ['card'] },
          card: {
            type: 'Card',
            props: { title: 'Default slot vs named slot', subtitle: null },
            children: ['body'],
            slots: { footer: ['actions'] },
          },
          body: { type: 'Text', props: { value: 'This came through children.', tone: null, size: null }, children: [] },
          actions: {
            type: 'Stack',
            props: { direction: 'row', gap: 'sm', align: 'center', wrap: null },
            children: ['ok'],
          },
          ok: { type: 'Button', props: { label: 'This came through slots.footer', variant: 'primary' }, children: [] },
        },
      },
    },
    failure: {
      spec: {
        root: 'screen',
        elements: {
          screen: { type: 'Screen', props: { title: null, subtitle: null }, children: ['card'] },
          card: {
            type: 'Card',
            props: { title: 'slots.default does not exist', subtitle: null },
            children: [],
            slots: { default: ['body'] },
          },
          body: { type: 'Text', props: { value: 'You cannot see me.', tone: null, size: null }, children: [] },
        },
      },
      note: 'The Card implementation reads `children` and `slots.footer`. A slot called "default" is handed to it and ignored. validateSpec is happy: the key exists, so there is no missing_child.',
    },
    related: ['el-children', 'ctx-slots', 'util-definecatalog'],
    step: 'registry',
    tags: ['slots', 'named slots'],
  },
  {
    id: 'el-visible',
    category: 'Spec & elements',
    name: 'element.visible',
    signature: `{ "visible": { "$state": "/tab", "eq": "billing" } }`,
    summary: 'A condition evaluated before render. False means the element and its whole subtree return null.',
    details: [
      'Undefined means visible. `true`/`false` are literal. Otherwise it is a condition object, an array of them (implicit AND), or `$and` / `$or`.',
      'Hidden is unmounted, not hidden with CSS: children never run, their hooks never run, their bound state is untouched.',
      'A condition object must use exactly ONE of `$state`, `$item`, `$index`. Two of them → `invalid_visible` from validateSpec.',
      'Inside a repeat you can filter rows by putting `repeat` and a `$item` condition on the same element.',
    ],
    example: {
      spec: {
        root: 'screen',
        elements: {
          screen: { type: 'Screen', props: { title: null, subtitle: null }, children: ['toggle', 'panel', 'else'] },
          toggle: { type: 'Checkbox', props: { label: 'Show the panel', checked: { $bindState: '/open' } }, children: [] },
          panel: {
            type: 'Alert',
            props: { title: 'Visible', message: 'visible: { $state: "/open" }', tone: 'info' },
            children: [],
            visible: { $state: '/open' },
          },
          else: {
            type: 'Text',
            props: { value: 'The inverse, via not: true.', tone: null, size: 'sm' },
            children: [],
            visible: { $state: '/open', not: true },
          },
        },
      },
      seed: { open: false },
    },
    failure: {
      spec: {
        root: 'screen',
        elements: {
          screen: { type: 'Screen', props: { title: null, subtitle: null }, children: ['a'] },
          a: {
            type: 'Alert',
            props: { title: 'I am always visible', message: 'The condition key is misspelled: "state" not "$state".', tone: 'danger' },
            children: [],
            visible: { state: '/never' } as never,
          },
        },
      },
      note: 'A typo\'d key means `cond.$state` is undefined. getByPath(state, undefined) returns the WHOLE state object, which is truthy, so the element is visible. Malformed conditions fail open, not closed — except when an operator is present, which compares against that object and fails.',
    },
    related: ['cond-truthy', 'cond-not', 'util-evaluatevisibility', 'hook-useisvisible'],
    step: 'conditions',
    tags: ['visible', 'conditions'],
  },
  {
    id: 'el-repeat',
    category: 'Spec & elements',
    name: 'element.repeat',
    signature: `{ "repeat": { "statePath": "/todos", "key": "id" } }
{ "repeat": { "statePath": { "$item": "comments" }, "key": "id" } }`,
    summary: 'Render this element\'s children once per item in a state array. statePath is absolute, or { $item } for a nested array on the enclosing row.',
    details: [
      '`statePath: string` is a JSON Pointer into the state model. `statePath: { $item: "field" }` reads an array off the current repeat item, and is only legal inside another repeat.',
      '`key` names the field used as the React key. Omit it and the array index is used: on a removal or a reorder React reuses the instance sitting at each position instead of moving it, so state React owns — focus, an uncontrolled input, a component\'s own useState — stays with the position rather than with the row.',
      'Repeat with no children is an error: `repeat_without_children`. The repeated template must be a child element.',
      'A `{ $item }` statePath outside a repeat scope is `repeat_item_outside_scope`.',
      'When `spec.state` is present, validateSpec resolves the path and reports `repeat_state_mismatch` if it is not an array.',
      'Children inside the scope get `$item`, `$index` and `$bindItem`, and a `basePath` like `/todos/0` for write-back.',
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
            repeat: { statePath: '/todos', key: 'id' },
          },
          row: {
            type: 'Stack',
            props: { direction: 'row', gap: 'sm', align: 'center', wrap: null },
            children: ['n', 'title'],
          },
          n: { type: 'Badge', props: { label: { $item: 'id' }, tone: 'neutral' }, children: [] },
          title: { type: 'Text', props: { value: { $item: 'title' }, tone: null, size: null }, children: [] },
        },
      },
      seed: { todos: [{ id: 't1', title: 'File VAT' }, { id: 't2', title: 'Reconcile bank' }] },
      note: 'Two elements describe the whole list. Add a third todo to the seed and a third row appears; nothing in elements changes.',
    },
    failure: {
      spec: {
        root: 'screen',
        elements: {
          screen: { type: 'Screen', props: { title: null, subtitle: null }, children: ['list'] },
          list: {
            type: 'Stack',
            props: { direction: 'column', gap: 'sm', align: null, wrap: null },
            children: [],
            repeat: { statePath: '/todos', key: 'id' },
          },
        },
      },
      seed: { todos: [{ id: 't1' }, { id: 't2' }] },
      note: 'repeat with an empty children array. Nothing to repeat, so nothing renders. validateSpec reports repeat_without_children — one of the few structural errors it can see.',
    },
    related: ['expr-item', 'expr-index', 'expr-binditem', 'cond-item', 'hook-userepeatscope'],
    step: 'lists',
    tags: ['repeat', 'lists', '$item'],
  },
  {
    id: 'el-on',
    category: 'Spec & elements',
    name: 'element.on',
    signature: `{ "on": { "press": { "action": "setState", "params": { "statePath": "/tab", "value": "b" } } } }
{ "on": { "press": [ { "action": "…" }, { "action": "…" } ] } }`,
    summary: 'Event name → action binding, or an array of them. The component fires an event with emit(name); the renderer resolves it to actions.',
    details: [
      'Event names are a contract between the element and the component, not a fixed list. The demo Button calls `emit("press")`.',
      'An array runs every binding for that event, in order.',
      'A binding whose `action` has no handler and is not a built-in logs `No handler registered for action: <name>` and does nothing.',
      '`on` belongs on the element. Inside props it is inert, and validateSpec reports `on_in_props`.',
    ],
    example: {
      spec: {
        root: 'screen',
        elements: {
          screen: { type: 'Screen', props: { title: null, subtitle: null }, children: ['row', 'out'] },
          row: {
            type: 'Stack',
            props: { direction: 'row', gap: 'sm', align: 'center', wrap: null },
            children: ['inc', 'clear'],
          },
          inc: {
            type: 'Button',
            props: { label: 'Set tab = billing', variant: 'primary' },
            children: [],
            on: { press: { action: 'setState', params: { statePath: '/tab', value: 'billing' } } },
          },
          clear: {
            type: 'Button',
            props: { label: 'Two actions at once', variant: 'secondary' },
            children: [],
            on: {
              press: [
                { action: 'setState', params: { statePath: '/tab', value: 'home' } },
                { action: 'setState', params: { statePath: '/touched', value: true } },
              ],
            },
          },
          out: { type: 'Text', props: { value: { $template: 'tab = ${/tab} · touched = ${/touched}' }, tone: null, size: 'sm' }, children: [] },
        },
      },
      seed: { tab: 'home', touched: false },
    },
    related: ['act-binding', 'act-setstate', 'ctx-emit', 'hook-useaction'],
    step: 'actions',
    tags: ['on', 'events', 'actions'],
  },
  {
    id: 'el-watch',
    category: 'Spec & elements',
    name: 'element.watch',
    signature: `{ "watch": { "/form/country": { "action": "loadCities", "params": { "country": { "$state": "/form/country" } } } } }`,
    summary: 'State path → action binding. The actions fire when the value at that path changes.',
    details: [
      'Fires on CHANGE only. The effect stores the first snapshot and returns without dispatching, so nothing runs on mount.',
      'Comparison is `!==` against the previous snapshot of that path — reference equality for objects and arrays.',
      'Params are re-resolved against a live snapshot at fire time, not against the render-time state.',
      'The element carrying `watch` must be mounted. Hide it with `visible` and the watcher is gone too.',
      'Inside props it is inert: validateSpec reports `watch_in_props`.',
      'Prefer ONE binding per entry. An array is only reliable up to and including its first state-changing binding: that write rebuilds the context the effect depends on, React tears the effect down, its cleanup sets `cancelled`, and the loop stops at the next `await`. Chain steps by having each element watch the path the step before it wrote.',
    ],
    example: {
      spec: {
        root: 'screen',
        elements: {
          screen: { type: 'Screen', props: { title: null, subtitle: null }, children: ['pick', 'mirror'] },
          pick: {
            type: 'Select',
            props: {
              label: 'Country',
              value: { $bindState: '/country' },
              options: [
                { label: 'Finland', value: 'fi' },
                { label: 'Ireland', value: 'ie' },
              ],
            },
            children: [],
          },
          mirror: {
            type: 'Text',
            props: { value: { $template: 'last change seen: ${/seen}' }, tone: null, size: 'sm' },
            children: [],
            watch: { '/country': { action: 'setState', params: { statePath: '/seen', value: { $state: '/country' } } } },
          },
        },
      },
      seed: { country: 'fi', seen: '(nothing yet)' },
      note: 'On first render "seen" stays at its seed. Change the select once and the watcher fires.',
    },
    related: ['el-on', 'act-binding', 'act-setstate'],
    step: 'actions',
    tags: ['watch', 'effects', 'cascade'],
  },
];
