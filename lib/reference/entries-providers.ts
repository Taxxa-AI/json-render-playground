import type { ReferenceEntry } from './types';

/**
 * Providers and render components. Every prop below is copied from the Props
 * interfaces in node_modules/@json-render/react/dist/index.d.ts.
 */
export const PROVIDER_ENTRIES: ReferenceEntry[] = [
  {
    id: 'prov-jsonuiprovider',
    category: 'Providers & components',
    name: 'JSONUIProvider',
    signature: `interface JSONUIProviderProps {
  registry: ComponentRegistry;
  store?: StateStore;
  initialState?: Record<string, unknown>;
  handlers?: Record<string, (params: Record<string, unknown>) => Promise<unknown> | unknown>;
  navigate?: (path: string) => void;
  validationFunctions?: Record<string, (value: unknown, args?: Record<string, unknown>) => boolean>;
  functions?: Record<string, ComputedFunction>;
  directives?: DirectiveDefinition[];
  onStateChange?: (changes: Array<{ path: string; value: unknown }>) => void;
  children: ReactNode;
}`,
    lang: 'typescript',
    summary: 'One provider that mounts all five contexts. This is what you use in an app.',
    details: [
      'The order it nests is State → Visibility → Validation → Action → functions → directives, then your children.',
      'Controlled vs uncontrolled: pass `store` and `initialState` / `onStateChange` are IGNORED. Pass neither and it creates its own store.',
      '`registry` is required here AND on `<Renderer>` — the provider does not hand it down.',
      '`handlers` are the custom actions; the six built-ins work with no handlers at all.',
      '`functions` feeds `$computed`, `directives` feeds custom `$`-keys, `validationFunctions` feeds custom check types.',
      '`navigate` is only ever called by an action binding\'s `onSuccess: { navigate }`.',
    ],
    example: {
      spec: {
        root: 'screen',
        elements: {
          screen: { type: 'Screen', props: { title: 'All five contexts at once', subtitle: null }, children: ['in', 'go', 'panel', 'out'] },
          in: {
            type: 'TextInput',
            props: {
              label: 'Email (ValidationProvider)',
              value: { $bindState: '/form/email' },
              placeholder: 'you@co.com',
              help: null,
              required: null,
              checks: [{ type: 'email', args: null, message: 'Not an email' }],
            },
            children: [],
          },
          go: {
            type: 'Button',
            props: { label: 'setState (ActionProvider)', variant: 'primary' },
            children: [],
            on: { press: { action: 'setState', params: { statePath: '/open', value: true } } },
          },
          panel: { type: 'Alert', props: { title: 'VisibilityProvider', message: 'visible: { $state: "/open" }', tone: 'success' }, children: [], visible: { $state: '/open' } },
          out: { type: 'Text', props: { value: { $template: 'StateProvider holds: ${/form/email}' }, tone: null, size: 'sm' }, children: [] },
        },
      },
      seed: { form: { email: '' }, open: false },
      note: 'Every example on this page is wrapped in exactly this: JSONUIProvider with the demo registry and a fresh createStateStore(seed).',
    },
    related: ['prov-renderer', 'prov-stateprovider', 'util-createstatestore', 'expr-computed'],
    step: 'providers',
    tags: ['JSONUIProvider', 'setup'],
  },
  {
    id: 'prov-stateprovider',
    category: 'Providers & components',
    name: 'StateProvider',
    signature: `interface StateProviderProps {
  store?: StateStore;
  initialState?: StateModel;
  onStateChange?: (changes: Array<{ path: string; value: unknown }>) => void;
  children: ReactNode;
}`,
    lang: 'typescript',
    summary: 'Owns the state model. Controlled by an external store, or uncontrolled with an initial state.',
    details: [
      'Controlled mode: pass `store`. It becomes the single source of truth and `initialState` / `onStateChange` are ignored — that is stated in the type docs and matches the implementation.',
      'Uncontrolled mode: it builds a `createStateStore(initialState)` internally.',
      '`onStateChange` fires ONCE per `set` or `update`, with ALL changed entries in one array.',
      'It reads the store through `useSyncExternalStore`, so `getServerSnapshot` on your store matters for SSR.',
    ],
    related: ['prov-jsonuiprovider', 'util-createstatestore', 'util-createstoreadapter', 'hook-usestatestore'],
    step: 'stores',
    tags: ['StateProvider', 'store'],
  },
  {
    id: 'prov-actionprovider',
    category: 'Providers & components',
    name: 'ActionProvider',
    signature: `interface ActionProviderProps {
  handlers?: Record<string, ActionHandler>;
  navigate?: (path: string) => void;
  children: ReactNode;
}`,
    lang: 'typescript',
    summary: 'Dispatches action bindings. Implements the six built-ins itself and renders the confirm dialog.',
    details: [
      'Built-ins are handled inline and RETURN before handler lookup: setState, pushState, removeState, push, pop, validateForm.',
      'That early return is why `confirm`, `onSuccess` and `onError` never run for a built-in.',
      'It uses `useOptionalValidation`, so `validateForm` degrades to a console warning when no ValidationProvider is present.',
      'It must sit inside a StateProvider — it calls `useStateStore()` for get / set / getSnapshot.',
      'Every dispatch emits an observer event pair (dispatch + settle) with an id, name, params, duration and error.',
    ],
    related: ['act-binding', 'act-confirm', 'hook-useactions', 'util-registeractionobserver'],
    step: 'providers',
    tags: ['ActionProvider', 'actions'],
  },
  {
    id: 'prov-visibilityprovider',
    category: 'Providers & components',
    name: 'VisibilityProvider',
    signature: `interface VisibilityProviderProps { children: ReactNode }

function useVisibility(): {
  isVisible: (condition: VisibilityCondition | undefined) => boolean;
  ctx: VisibilityContext;
};`,
    lang: 'typescript',
    summary: 'Supplies condition evaluation to the tree. Takes no configuration.',
    details: [
      'It reads the state model from the state context and exposes `evaluateVisibility` bound to it.',
      '`ctx` is the raw `{ stateModel, repeatItem?, repeatIndex? }` — the same object the core functions take.',
      'The renderer DOES depend on it: each element reads `useVisibility().ctx`, extends it with the repeat scope, and calls `evaluateVisibility` directly. Without this provider the renderer throws.',
      'No props at all, which is why it rarely appears in application code — `JSONUIProvider` mounts it.',
    ],
    related: ['hook-useisvisible', 'util-evaluatevisibility', 'el-visible'],
    step: 'providers',
    tags: ['VisibilityProvider', 'conditions'],
  },
  {
    id: 'prov-validationprovider',
    category: 'Providers & components',
    name: 'ValidationProvider',
    signature: `interface ValidationProviderProps {
  customFunctions?: Record<string, ValidationFunction>;
  children: ReactNode;
}`,
    lang: 'typescript',
    summary: 'Holds the registry of validated fields and their results. validateForm talks to this.',
    details: [
      '`customFunctions` are checked AFTER the fourteen built-ins, so you cannot override `required` or `email`.',
      'Fields register themselves through `useFieldValidation`; `validateAll()` loops over exactly those registrations.',
      '`fieldStates` is exposed through a getter over a ref, so a synchronous read after `validateAll()` sees fresh results.',
      'Registration is deduplicated by a deep-ish config comparison, so passing a new config object every render does not loop.',
      'Field paths are whatever the component passed — usually the `$bindState` path.',
    ],
    related: ['hook-usefieldvalidation', 'act-validateform', 'val-helpers'],
    step: 'providers',
    tags: ['ValidationProvider', 'validation'],
  },
  {
    id: 'prov-renderer',
    category: 'Providers & components',
    name: 'Renderer',
    signature: `interface RendererProps {
  spec: Spec | null;
  registry: ComponentRegistry;
  loading?: boolean;
  fallback?: ComponentRenderer;
}`,
    lang: 'typescript',
    summary: 'Walks the spec from root and renders it. Four props, and one of them is the whole registry again.',
    details: [
      'There is NO state prop. `spec.state` is not read — seeding is the provider\'s job.',
      'Lookup is `registry[element.type] ?? fallback`. Without a fallback, an unknown type renders nothing.',
      '`loading` is forwarded to every component as `ctx.loading`, unchanged.',
      '`spec: null` renders null, which is the normal state before a generation arrives.',
      'It must be inside the providers — it calls the state, visibility and action contexts for each element.',
    ],
    example: {
      spec: {
        root: 'screen',
        elements: {
          screen: { type: 'Screen', props: { title: 'Rendered by <Renderer>', subtitle: null }, children: ['t', 'x'] },
          t: { type: 'Text', props: { value: 'Every example on this page is one of these.', tone: null, size: null }, children: [] },
          x: { type: 'NotInTheRegistry', props: {}, children: [] },
        },
      },
      note: 'The red box is the `fallback` prop doing its job. Remove it in your own app and that element renders nothing at all.',
    },
    related: ['prov-jsonuiprovider', 'prov-createrenderer', 'el-type', 'ctx-loading'],
    step: 'registry',
    tags: ['Renderer', 'render'],
  },
  {
    id: 'prov-createrenderer',
    category: 'Providers & components',
    name: 'createRenderer',
    signature: `function createRenderer(catalog, components): ComponentType<CreateRendererProps>;

interface CreateRendererProps {
  spec: Spec | null;
  store?: StateStore;
  state?: Record<string, unknown>;
  onAction?: (actionName: string, params?: Record<string, unknown>) => void;
  onStateChange?: (changes: Array<{ path: string; value: unknown }>) => void;
  functions?: Record<string, ComputedFunction>;
  directives?: DirectiveDefinition[];
  loading?: boolean;
  fallback?: ComponentRenderer;
}`,
    lang: 'typescript',
    summary: 'Build a self-contained renderer component from a catalog and a component map. Providers included.',
    details: [
      'The alternative to wiring `JSONUIProvider` + `Renderer` yourself: it mounts the providers internally.',
      'Actions collapse to ONE callback, `onAction(name, params)` — no per-action handler map, no confirm dialog wiring.',
      'Like the provider, `store` puts it in controlled mode and `state` / `onStateChange` are then ignored.',
      'The component map is typed from the catalog, so a missing component is a compile error.',
      'Choose it for a drop-in surface; choose `JSONUIProvider` when you need handlers, validation functions or navigation.',
    ],
    related: ['prov-jsonuiprovider', 'prov-renderer', 'util-defineregistry'],
    step: 'providers',
    tags: ['createRenderer', 'setup'],
  },
];
