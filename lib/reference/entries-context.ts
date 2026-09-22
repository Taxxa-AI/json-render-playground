import type { ReferenceEntry } from './types';

/**
 * What a registry component receives. Verified against
 * `BaseComponentProps` / `ComponentRenderProps` in
 * node_modules/@json-render/react/dist/index.d.ts and the renderer's
 * call site in dist/index.mjs.
 */
export const CONTEXT_ENTRIES: ReferenceEntry[] = [
  {
    id: 'ctx-props',
    category: 'Component context',
    name: 'ctx.props',
    signature: `const Metric: ComponentFn<typeof catalog, "Metric"> = ({ props }) => (
  <div>{props.label}: {props.value}</div>
);`,
    lang: 'tsx',
    summary: 'The element\'s props with every expression already resolved. Typed from the catalog\'s Zod schema.',
    details: [
      'The renderer runs `resolveElementProps(element.props, ctx)` and only then calls your component.',
      'You never see `{ $state: … }`. A prop bound to a missing path arrives as `undefined`, indistinguishable from an omitted prop.',
      'Types come from `InferComponentProps<C, K>` — the catalog entry\'s `props` schema, not from Zod parsing at runtime. Nothing validates props before render.',
      'When nothing resolved, the renderer passes the ORIGINAL props object by reference, so identity is stable across renders for static elements.',
    ],
    example: {
      spec: {
        root: 'screen',
        elements: {
          screen: { type: 'Screen', props: { title: null, subtitle: null }, children: ['m'] },
          m: { type: 'Metric', props: { label: 'Resolved before render', value: { $state: '/total' }, delta: null, tone: 'info' }, children: [] },
        },
      },
      seed: { total: '€48,200' },
      note: 'The Metric component receives props.value as the string "€48,200". It never sees { $state: … }.',
    },
    related: ['el-props', 'ctx-bindings', 'util-resolvepropvalue'],
    step: 'registry',
    tags: ['props', 'component'],
  },
  {
    id: 'ctx-children',
    category: 'Component context',
    name: 'ctx.children',
    signature: `const Card = ({ props, children }) => (
  <section><h3>{props.title}</h3>{children}</section>
);`,
    lang: 'tsx',
    summary: 'The rendered default slot, as ReactNode. Already elements, not keys.',
    details: [
      'Built from `element.children`, in order. Hidden children are already gone — `visible: false` returns null before this point.',
      'A component that never renders `children` silently drops that whole subtree, and nothing reports it.',
      'Inside a repeat, `children` is rendered once per item, each wrapped in a `RepeatScopeProvider`.',
      'The catalog declares which components accept children by listing `"default"` in `slots`; the renderer does not enforce it.',
    ],
    example: {
      spec: {
        root: 'screen',
        elements: {
          screen: { type: 'Screen', props: { title: null, subtitle: null }, children: ['stack'] },
          stack: {
            type: 'Stack',
            props: { direction: 'column', gap: 'sm', align: null, wrap: null },
            children: ['a', 'hidden', 'b'],
          },
          a: { type: 'Text', props: { value: 'Stack renders ctx.children in order.', tone: null, size: null }, children: [] },
          hidden: { type: 'Badge', props: { label: 'visible: false — never reaches children', tone: 'danger' }, children: [], visible: false },
          b: { type: 'Text', props: { value: 'The hidden one is already gone by the time Stack runs.', tone: null, size: 'sm' }, children: [] },
        },
      },
    },
    related: ['el-children', 'ctx-slots', 'el-repeat'],
    step: 'registry',
    tags: ['children', 'component'],
  },
  {
    id: 'ctx-slots',
    category: 'Component context',
    name: 'ctx.slots',
    signature: `const Card = ({ children, slots }) => (
  <section>{children}<footer>{slots?.footer}</footer></section>
);`,
    lang: 'tsx',
    summary: 'Named slots as a Record<string, ReactNode>. Optional, and never contains "default".',
    details: [
      '`slots` is undefined when the element declared none.',
      'Slot names are whatever the element used — the renderer does not check them against the catalog.',
      'A slot your component does not render is content that vanishes with no warning. That is the failure demo on `element.slots`.',
      'Slot children get the same repeat scope as default children.',
    ],
    example: {
      spec: {
        root: 'screen',
        elements: {
          screen: { type: 'Screen', props: { title: null, subtitle: null }, children: ['card'] },
          card: {
            type: 'Card',
            props: { title: 'Card reads slots?.footer', subtitle: null },
            children: ['body'],
            slots: { footer: ['btn'] },
          },
          body: { type: 'Text', props: { value: 'ctx.children', tone: null, size: null }, children: [] },
          btn: { type: 'Button', props: { label: 'ctx.slots.footer', variant: 'secondary' }, children: [] },
        },
      },
      note: 'Rename "footer" to "header" in the editor. The button vanishes: Card only renders the slot it knows about.',
    },
    related: ['el-slots', 'ctx-children'],
    step: 'registry',
    tags: ['slots', 'component'],
  },
  {
    id: 'ctx-emit',
    category: 'Component context',
    name: 'ctx.emit',
    signature: `const Button = ({ props, emit }) => (
  <button onClick={() => emit("press")}>{props.label}</button>
);`,
    lang: 'tsx',
    summary: 'Fire a named event. The renderer looks it up in element.on and dispatches the bindings.',
    details: [
      'Always provided, even when the element has no `on` field — emitting an unbound event is a silent no-op.',
      'Event names are a convention between your component and whoever writes the spec. The catalog has no field for them, so document them in the component `description`.',
      'Returns void. For metadata (`shouldPreventDefault`, `bound`) use `on(event)` instead.',
      'All bindings for the event fire; an array runs every one.',
    ],
    example: {
      spec: {
        root: 'screen',
        elements: {
          screen: { type: 'Screen', props: { title: null, subtitle: null }, children: ['bound', 'unbound', 'out'] },
          bound: {
            type: 'Button',
            props: { label: 'bound to press', variant: 'primary' },
            children: [],
            on: { press: { action: 'setState', params: { statePath: '/fired', value: 'yes' } } },
          },
          unbound: { type: 'Button', props: { label: 'emits "press" into the void', variant: 'ghost' }, children: [] },
          out: { type: 'Text', props: { value: { $template: 'fired = ${/fired}' }, tone: null, size: 'sm' }, children: [] },
        },
      },
      seed: { fired: 'no' },
      note: 'Both buttons call emit("press"). The second element has no `on` field, so the call returns immediately — no error, no log.',
    },
    related: ['ctx-on', 'el-on', 'act-binding'],
    step: 'registry',
    tags: ['emit', 'events'],
  },
  {
    id: 'ctx-on',
    category: 'Component context',
    name: 'ctx.on',
    signature: `interface EventHandle {
  emit: () => void;
  shouldPreventDefault: boolean;
  bound: boolean;
}

const Link = ({ props, on }) => {
  const press = on("press");
  return <a href={props.href} onClick={(e) => {
    if (press.shouldPreventDefault) e.preventDefault();
    press.emit();
  }}>{props.label}</a>;
};`,
    lang: 'tsx',
    summary: 'The long form of emit: a handle that also tells you whether anything is bound and whether to preventDefault.',
    details: [
      '`bound` is true when the element has at least one binding for that event — use it to hide a disabled affordance.',
      '`shouldPreventDefault` is true when ANY binding for that event set `preventDefault: true`.',
      'Calling `handle.emit()` is identical to `emit(name)`.',
      'This is the only way a spec can influence browser default behaviour, and only because your component honours it.',
    ],
    related: ['ctx-emit', 'act-preventdefault', 'el-on'],
    step: 'registry',
    tags: ['on', 'EventHandle'],
  },
  {
    id: 'ctx-bindings',
    category: 'Component context',
    name: 'ctx.bindings',
    signature: `const Input = ({ props, bindings }) => {
  const [value, setValue] = useBoundProp<string>(props.value, bindings?.value);
  return <input value={value ?? ""} onChange={(e) => setValue(e.target.value)} />;
};`,
    lang: 'tsx',
    summary: 'Prop name → absolute state path, for props written with $bindState or $bindItem. Undefined when there are none.',
    details: [
      'Produced by `resolveBindings(rawProps, ctx)` BEFORE props are resolved, so you get both the value and the write path.',
      'Only `$bindState` and `$bindItem` produce entries. `$state` never does — that is why a `$state`-bound input looks editable and is not.',
      '`$bindItem` entries are already absolute: `/todos/2/done`, not `done`.',
      'Ignoring `bindings` makes your component permanently read-only, and the spec author has no way to tell.',
    ],
    example: {
      spec: {
        root: 'screen',
        elements: {
          screen: { type: 'Screen', props: { title: null, subtitle: null }, children: ['writable', 'readonly', 'out'] },
          writable: { type: 'TextInput', props: { label: '$bindState — in bindings, writable', value: { $bindState: '/a' }, placeholder: null, help: null, required: null, checks: null }, children: [] },
          readonly: { type: 'TextInput', props: { label: '$state — not in bindings, dead', value: { $state: '/b' }, placeholder: null, help: null, required: null, checks: null }, children: [] },
          out: { type: 'Text', props: { value: { $template: 'a="${/a}" b="${/b}"' }, tone: null, size: 'sm' }, children: [] },
        },
      },
      seed: { a: '', b: '' },
      note: 'Type in both. Only the first changes state — the second has no entry in `bindings`, so its setter is a no-op.',
    },
    related: ['expr-bindstate', 'expr-binditem', 'hook-useboundprop'],
    step: 'state',
    tags: ['bindings', 'two-way'],
  },
  {
    id: 'ctx-loading',
    category: 'Component context',
    name: 'ctx.loading',
    signature: `<Renderer spec={spec} registry={registry} loading={isStreaming} />

const Card = ({ children, loading }) => (
  <section aria-busy={loading}>{children}</section>
);`,
    lang: 'tsx',
    summary: 'A boolean passed straight down from <Renderer loading>. Every component gets the same value.',
    details: [
      'It is the renderer-level `loading` prop, forwarded to every element — not per-element, and not per-action.',
      'Meant for streaming: `useUIStream` gives you `isStreaming`, you pass it in, and components can render skeletons.',
      'Per-ACTION loading is a different thing: `useAction(binding).isLoading`, or `useActions().loadingActions`.',
      'Nothing sets it for you. Omit the prop and it is undefined everywhere.',
    ],
    related: ['prov-renderer', 'hook-useaction', 'hook-useuistream'],
    step: 'streaming',
    tags: ['loading', 'streaming'],
  },
];
