import type { Concept } from './types';

/**
 * Hooks, providers, stores, watchers. Owned by the runtime-labs agent.
 *
 * Every claim here was checked against 0.20.0:
 *   watch        → react/dist/index.mjs, ElementRenderer's watch useEffect
 *   the stack    → react/dist/index.mjs, JSONUIProvider
 *   the hooks    → react/dist/index.d.ts + their implementations in index.mjs
 *   set() no-op  → core/dist/chunk-7V7ZCHEJ.mjs, createStateStore
 */
export const RUNTIME_CONCEPTS: Concept[] = [
  // ------------------------------------------------------------- watchers ---
  {
    id: 'watch',
    title: 'watch',
    summary:
      'A top-level element field mapping a state path to ONE action binding: when the watched value changes, the binding fires. To express "when the country changes, refill the cities, reset the city and load them", give each step its own entry on the element that owns it, chained through the paths — not an array on one element.',
    lang: 'json',
    shape: `// on "country" — refill the list
"watch": { "/form/country": { "action": "setState",
  "params": { "statePath": "/cities", "value": { "$cond": … } } } }

// on "city" — reset yourself when the list changes under you
"watch": { "/cities": { "action": "setState",
  "params": { "statePath": "/form/city", "value": "" } } }

// on a third element — the side effect
"watch": { "/cities": { "action": "loadCities", "params": { … } } }`,
    example: {
      spec: {
        root: 'stack',
        elements: {
          stack: {
            type: 'Stack',
            props: { direction: 'column', gap: 'sm', align: null, wrap: null },
            children: ['toggle', 'note'],
          },
          toggle: {
            type: 'Checkbox',
            props: { label: 'Ship internationally', checked: { $bindState: '/intl' } },
            // Fires on change only — the note is empty until you tick the box.
            watch: {
              '/intl': { action: 'setState', params: { statePath: '/note', value: 'a watcher wrote this' } },
            },
            children: [],
          },
          note: { type: 'Badge', props: { label: { $state: '/note' }, tone: 'warning' }, children: [] },
        },
      },
      seed: { intl: false, note: '' },
    },
    gotcha:
      'Two traps. Watchers never fire on the first render — the effect stores the watched values and returns, so seeding a path a watcher depends on does nothing until something changes it. And an ARRAY of bindings on one watch entry silently drops its tail: the first binding that actually writes state tears down the effect running them, and everything queued behind it is skipped. Measured: [reset, fill, loadCities] fires two of three, every time. Nothing warns.',
    step: 'actions',
    ref: 'el-watch',
  },
  {
    id: 'watcher-loop',
    title: 'Watcher loops',
    summary:
      'Nothing in the library detects a cycle. /a writes /b, /b writes /a, and the only brake is the store: set() returns early when the value is identical, so a watcher that writes a constant converges and a watcher that writes something new every hop does not.',
    lang: 'json',
    shape: `// converges after 3 dispatches: the 3rd write is a no-op
"watch": { "/a": { "action": "setState",
  "params": { "statePath": "/b", "value": "B" } } }

// never converges: every hop produces a new string
"watch": { "/a": { "action": "setState",
  "params": { "statePath": "/b", "value": { "$template": "\${/a}!" } } } }`,
    gotcha:
      'Values are compared with !==, so a fresh array or object counts as a change even when it is deep-equal. A watcher that rebuilds a list on every hop loops forever. Strip watch from model output before you trust it.',
    step: 'actions',
    ref: 'el-watch',
  },

  // ---------------------------------------------------------------- hooks ---
  {
    id: 'hooks-vs-props',
    title: 'Props or hooks',
    summary:
      'A registry component is handed resolved props, rendered children and an emit function — that covers most components with no hooks at all. Reach for a hook only to read a path nobody passed you, write back, or dispatch something the spec did not ask for.',
    lang: 'tsx',
    shape: `// props: already resolved. No hook needed.
const Badge = ({ props }) => <span>{props.label}</span>;

// hooks: the other direction — read/write state, dispatch, validate.
const Input = ({ props, bindings }) => {
  const [value, setValue] = useBoundProp(props.value, bindings?.value);
  return <input value={value ?? ''} onChange={(e) => setValue(e.target.value)} />;
};`,
    gotcha:
      'Every hook except useOptionalValidation and useRepeatScope throws outside its provider. Wrap components in error boundaries and that throw becomes one control silently missing.',
    step: 'hooks',
    ref: 'hook-useboundprop',
  },
  {
    id: 'use-bound-prop-hook',
    title: 'useBoundProp',
    summary:
      'Pairs a resolved prop value with the state path it came from, and returns [value, setValue]. It is the only hook that reads the renderer’s bindings map, so it handles $bindState and $bindItem alike.',
    lang: 'tsx',
    shape: `const [value, setValue] = useBoundProp<string>(props.value, bindings?.value);
// props.value      -> the resolved VALUE
// bindings?.value  -> the PATH it was resolved from, or undefined
// setValue         -> set(path, v), or a no-op when there is no path`,
    example: {
      spec: {
        root: 'stack',
        elements: {
          stack: {
            type: 'Stack',
            props: { direction: 'column', gap: 'sm', align: null, wrap: null },
            children: ['bound', 'echo'],
          },
          bound: {
            type: 'TextInput',
            props: {
              label: 'Bound',
              value: { $bindState: '/name' },
              placeholder: 'type here',
              help: null,
              required: null,
              checks: null,
            },
            children: [],
          },
          echo: { type: 'Badge', props: { label: { $template: '/name = ${/name}' }, tone: 'info' }, children: [] },
        },
      },
      seed: { name: '' },
    },
    gotcha:
      'It holds no state of its own. Bind the prop to a literal instead of a $bindState expression and setValue silently does nothing — the input simply will not type.',
    step: 'hooks',
    ref: 'hook-useboundprop',
  },
  {
    id: 'use-state-value',
    title: 'useStateValue',
    summary:
      'Reads one JSON Pointer out of the state model from anywhere inside the provider. Returns T | undefined and re-renders the component when the model changes.',
    lang: 'tsx',
    shape: `const items = useStateValue<CartItem[]>('/cart/items');
// undefined until something writes the path — there is no default argument.`,
    gotcha:
      'There is no per-path subscription. StateProvider rebuilds its whole context value on every write, so a component reading /a re-renders when /b changes.',
    step: 'hooks',
    ref: 'hook-usestatevalue',
  },
  {
    id: 'use-state-store',
    title: 'useStateStore',
    summary:
      'The whole state context: state, get, set, update and getSnapshot. Use update() when you write several paths at once — it is one notify, and one re-render, instead of several.',
    lang: 'tsx',
    shape: `const { state, get, set, update, getSnapshot } = useStateStore();
set('/count', (get('/count') as number) + 1);
update({ '/form/city': '', '/form/zip': '' });   // one notify
getSnapshot();                                   // live, not the render snapshot`,
    gotcha:
      'state is the React render snapshot and is stale inside any async callback; getSnapshot() is the live one. Both throw "useStateStore must be used within a StateProvider" outside the provider.',
    step: 'hooks',
    ref: 'hook-usestatestore',
  },
  {
    id: 'use-action',
    title: 'useAction',
    summary:
      'Dispatches one action binding from inside a component, with an isLoading flag, without the spec declaring an `on` binding for it. Takes a binding object — not an action name.',
    lang: 'tsx',
    shape: `const binding = useMemo(() => ({ action: 'save', params: { id: { $state: '/id' } } }), []);
const { execute, isLoading } = useAction(binding);
// useActions() gives you the rest: handlers, execute(any binding),
// pendingConfirmation, confirm, cancel, registerHandler.`,
    gotcha:
      'Its params are resolved by resolveAction, which understands { $state } and nothing else — no $template, no $item, because the renderer is not involved. isLoading keys off the action name, so two buttons firing the same action both look busy.',
    step: 'hooks',
    ref: 'hook-useaction',
  },
  {
    id: 'use-is-visible',
    title: 'useIsVisible',
    summary:
      'Evaluates a visibility condition with the same evaluator the renderer uses for an element’s `visible` field, so your component can branch on the spec’s own condition grammar instead of inventing a second one.',
    lang: 'tsx',
    shape: `const isUrgent = useIsVisible({ $state: '/priority', eq: 'high' });
const { isVisible, ctx } = useVisibility();   // the evaluator plus { stateModel }`,
    gotcha:
      'An undefined condition returns true — "no condition" means visible. The context it evaluates against holds only stateModel, so $item and $index resolve only when your component is inside a repeat.',
    step: 'hooks',
    ref: 'hook-useisvisible',
  },
  {
    id: 'use-repeat-scope',
    title: 'useRepeatScope',
    summary:
      'Inside a repeated element, returns { item, index, basePath } — the current row, its position, and the absolute state path of the row. basePath is what makes $bindItem writable.',
    lang: 'tsx',
    shape: `const scope = useRepeatScope();          // null outside a repeat
if (!scope) return null;
scope.item      // unknown — narrow it yourself
scope.index     // 2
scope.basePath  // "/todos/2"`,
    example: {
      spec: {
        root: 'list',
        elements: {
          list: {
            type: 'Stack',
            props: { direction: 'column', gap: 'sm', align: null, wrap: null },
            repeat: { statePath: '/todos' },
            children: ['row'],
          },
          row: { type: 'Badge', props: { label: { $item: 'title' }, tone: 'neutral' }, children: [] },
        },
      },
      seed: { todos: [{ title: 'read the catalog' }, { title: 'write a component' }] },
    },
    gotcha:
      'It returns null rather than throwing, so a component that assumes a scope crashes on scope.item instead of telling you it is outside a repeat.',
    step: 'hooks',
    ref: 'hook-userepeatscope',
  },

  // ------------------------------------------------------------ providers ---
  {
    id: 'provider-stack',
    title: 'The provider stack',
    summary:
      'JSONUIProvider is six nested contexts and a dialog: State, Visibility, Validation, Action, Functions, Directives, plus ConfirmationDialogManager. The last two contexts and the dialog are not exported, so only this provider (or createRenderer) can supply them.',
    lang: 'tsx',
    shape: `<StateProvider store={store}>
  <VisibilityProvider>
    <ValidationProvider customFunctions={validationFunctions}>
      <ActionProvider handlers={handlers} navigate={navigate}>
        <FunctionsContext.Provider value={functions}>     {/* not exported */}
          <DirectivesContext.Provider value={directives}> {/* not exported */}
            {children}
            <ConfirmationDialogManager />                 {/* not exported */}`,
    gotcha:
      'ElementRenderer calls useStateStore, useVisibility and useActions for every element, bound or not — remove any one of those three providers and the whole tree throws, even a spec of static text.',
    step: 'providers',
    ref: 'prov-jsonuiprovider',
  },
  {
    id: 'store-prop',
    title: 'store beats initialState',
    summary:
      'Pass a store and the provider is controlled: that store is the single source of truth and initialState/onStateChange are ignored. Omit it and the provider creates one for you that nothing outside React can read or write.',
    lang: 'tsx',
    shape: `// controlled — default to this
<JSONUIProvider store={createStateStore({ form: {} })} …>

// uncontrolled — observe only
<JSONUIProvider initialState={{ form: {} }} onStateChange={(changes) => …} …>`,
    gotcha:
      'The mode is captured on the first render. Switching between controlled and uncontrolled later is unsupported and only warns in development.',
    step: 'providers',
    ref: 'prov-stateprovider',
  },
  {
    id: 'renderer-props',
    title: 'Renderer props',
    summary:
      'Renderer takes spec, registry, loading and fallback, and is a consumer — it must sit inside the providers. The registry prop that matters is this one: JSONUIProvider accepts a registry prop and never reads it.',
    lang: 'tsx',
    shape: `<Renderer
  spec={spec}                 // null / missing root -> renders null, no error
  registry={registry}         // name -> component
  loading={isStreaming}       // becomes ctx.loading; silences missing-child warnings
  fallback={UnknownComponent} // for any type the registry lacks — always pass one
/>`,
    gotcha:
      'Without a fallback, one hallucinated component name deletes that branch with nothing but a console.warn. Several Renderers can share one provider — that is how a chat log renders many specs against one state model.',
    step: 'providers',
    ref: 'prov-renderer',
  },
  {
    id: 'when-to-split-providers',
    title: 'When to split',
    summary:
      'Split the stack only to share state across trees the combined provider cannot wrap, and keep the order State → Visibility → Validation → Action. For everything else, one JSONUIProvider with many Renderers inside it is the cheaper answer.',
    lang: 'tsx',
    shape: `// ValidationProvider must stay ABOVE ActionProvider:
// ActionProvider reads it with useOptionalValidation, and that is the
// only way the built-in validateForm action finds validateAll().
<ValidationProvider>
  <ActionProvider handlers={handlers}>
    <Renderer … />`,
    gotcha:
      'Swap Validation and Action and nothing throws: fields still validate on blur, but validateForm logs a warning and writes nothing. A hand-assembled stack also loses $computed, custom directives and the confirm dialog entirely.',
    step: 'providers',
    ref: 'prov-jsonuiprovider',
  },
];
