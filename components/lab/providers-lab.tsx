'use client';

import type { ActionDispatchInfo, Spec } from '@json-render/core';
import { createStateStore, defineDirective, registerActionObserver, resolvePropValue } from '@json-render/core';
import type { ComponentMap } from '@json-render/react';
import {
  ActionProvider,
  createRenderer,
  JSONUIProvider,
  Renderer,
  StateProvider,
  useActions,
  ValidationProvider,
  VisibilityProvider,
} from '@json-render/react';
import { Component, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { z } from 'zod';
import { demoCatalog, demoComponents } from '@/lib/demo/catalog';
import { demoRegistry, UnknownComponent } from '@/lib/demo/registry';
import { CodeBlock } from '../playground/code-block';
import { Chip, Panel, Pill, Tabs } from '../playground/ui';
import type { ChecklistItem } from './checklist';
import { StageFrame } from './stage-frame';
import { stagesFromChecklist } from '@/lib/labs/types';

/**
 * JSONUIProvider, taken apart.
 *
 * Verified against node_modules/@json-render/react/dist/index.mjs,
 * `JSONUIProvider`, which renders exactly this, outermost first:
 *
 *   StateProvider store/initialState/onStateChange
 *     VisibilityProvider
 *       ValidationProvider customFunctions={validationFunctions}
 *         ActionProvider handlers/navigate
 *           FunctionsContext.Provider  value={functions ?? {}}
 *             DirectivesContext.Provider value={createDirectiveRegistry(directives)}
 *               {children}
 *               <ConfirmationDialogManager />
 *
 * Four of those six are exported. The last two — and the dialog manager — are
 * not, which is the single most useful thing on this page: assemble the stack
 * by hand and `$computed`, custom directives and `confirm` all stop working,
 * silently.
 *
 * `registry` is destructured by JSONUIProvider and then never used. The
 * registry only matters to <Renderer>.
 */

const upper = defineDirective({
  name: '$upper',
  description: 'Uppercase a resolved value.',
  schema: z.object({ $upper: z.unknown() }),
  resolve: (value, ctx) => String(resolvePropValue((value as { $upper: unknown }).$upper, ctx) ?? '').toUpperCase(),
});

const FUNCTIONS = {
  sum: (args: Record<string, unknown>) => String(Number(args.a ?? 0) + Number(args.b ?? 0)),
};

/** One spec that needs every layer at once. */
const SPEC: Spec = {
  root: 'screen',
  elements: {
    screen: {
      type: 'Screen',
      props: { title: 'One spec, six layers', subtitle: null },
      children: ['email', 'buttons', 'alert', 'metric', 'shout'],
    },
    // StateProvider (binding) + ValidationProvider (checks).
    email: {
      type: 'TextInput',
      props: {
        label: 'Email',
        value: { $bindState: '/form/email' },
        placeholder: 'you@co.com',
        help: 'bound + validated',
        required: true,
        checks: [{ type: 'email', args: null, message: 'Enter a valid email' }],
      },
      children: [],
    },
    // ActionProvider: one built-in, one custom handler, one confirmed action.
    buttons: {
      type: 'Stack',
      props: { direction: 'row', gap: 'sm', align: 'center', wrap: true },
      children: ['setBtn', 'notifyBtn', 'validateBtn', 'confirmBtn'],
    },
    setBtn: {
      type: 'Button',
      props: { label: 'setState', variant: 'secondary' },
      on: { press: { action: 'setState', params: { statePath: '/status', value: 'written by a built-in' } } },
      children: [],
    },
    notifyBtn: {
      type: 'Button',
      props: { label: 'notify', variant: 'secondary' },
      on: { press: { action: 'notify', params: { message: 'from a handler' } } },
      children: [],
    },
    validateBtn: {
      type: 'Button',
      props: { label: 'check the form', variant: 'primary' },
      on: { press: { action: 'validateForm', params: { statePath: '/formValidation' } } },
      children: [],
    },
    confirmBtn: {
      type: 'Button',
      props: { label: 'delete (confirm)', variant: 'danger' },
      on: {
        press: {
          action: 'deleteAll',
          confirm: { title: 'Delete everything?', message: 'Rendered by ConfirmationDialogManager.', variant: 'danger' },
        },
      },
      children: [],
    },
    // VisibilityProvider.
    alert: {
      type: 'Alert',
      props: { title: 'visible', message: { $state: '/status' }, tone: 'success' },
      visible: { $state: '/status' },
      children: [],
    },
    // FunctionsContext.
    metric: {
      type: 'Metric',
      props: {
        label: '$computed sum',
        value: { $computed: 'sum', args: { a: { $state: '/a' }, b: { $state: '/b' } } },
        delta: null,
        tone: null,
      },
      children: [],
    },
    // DirectivesContext.
    shout: {
      type: 'Text',
      props: { value: { $upper: { $state: '/status' } }, tone: 'info', size: null },
      children: [],
    },
  },
};

const SEED = { form: { email: 'not-an-email' }, status: '', a: 17, b: 25 };

/**
 * The other door into the same six layers.
 *
 * Verified against `createRenderer` in @json-render/react/dist/index.mjs: it
 * renders State → Visibility → Validation → Action → Functions → Directives,
 * the Renderer and ConfirmationDialogManager — the full stack, dialog
 * included. What it drops is the wiring surface: `handlers` becomes a Proxy
 * over one `onAction` callback, and there is no `validationFunctions` and no
 * `navigate` to pass at all. The registry is the component map itself, which
 * is why nothing here passes one.
 *
 * The cast is the one wart: `demoRegistry` already IS this map at runtime —
 * defineRegistry keyed it by every catalog component and adapted each one to
 * the `element` signature createRenderer expects — but its declared type is
 * the index-signature `ComponentRegistry`, which will not line up with the
 * catalog's named keys.
 */
const DemoRenderer = createRenderer(demoCatalog, demoRegistry as ComponentMap<typeof demoComponents>);

// ------------------------------------------------------------ boundaries ---

/**
 * The renderer's own ElementErrorBoundary swallows per-element throws, but a
 * missing context throws inside ElementRenderer itself — above every element —
 * so it escapes to whatever boundary you put around <Renderer>. This is it.
 */
class StackBoundary extends Component<
  { children: React.ReactNode; onError: (message: string) => void },
  { message: string | null }
> {
  state = { message: null as string | null };

  static getDerivedStateFromError(error: unknown) {
    return { message: error instanceof Error ? error.message : String(error) };
  }

  componentDidCatch(error: unknown) {
    this.props.onError(error instanceof Error ? error.message : String(error));
  }

  render() {
    if (this.state.message !== null) {
      return (
        <div className="flex flex-col gap-1 rounded-md border border-red-200 bg-red-50 px-3 py-2.5 dark:border-red-900 dark:bg-red-950">
          <span className="font-mono text-[10.5px] uppercase tracking-wider text-red-600 dark:text-red-400">
            the whole tree threw
          </span>
          <span className="font-mono text-[12.5px] text-red-700 dark:text-red-300">{this.state.message}</span>
        </div>
      );
    }
    return this.props.children;
  }
}

/** Lives inside the assembled ActionProvider so it can show what nobody renders. */
function PendingProbe({ onPending }: { onPending: () => void }) {
  const { pendingConfirmation, confirm, cancel, loadingActions } = useActions();
  useEffect(() => {
    if (pendingConfirmation) onPending();
  }, [pendingConfirmation, onPending]);

  if (!pendingConfirmation) {
    return (
      <div className="font-mono text-[11.5px] text-muted-foreground">
        pendingConfirmation: null · loading: {[...loadingActions].join(', ') || '(none)'}
      </div>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border border-yellow-200 bg-yellow-50 px-2.5 py-1.5 font-mono text-[11.5px] text-yellow-800 dark:border-yellow-900 dark:bg-yellow-950 dark:text-yellow-300">
      <span>
        pendingConfirmation: <strong>{pendingConfirmation.action.action}</strong> — and no dialog on screen, because{' '}
        <code>ConfirmationDialogManager</code> is not exported.
      </span>
      <button type="button" onClick={confirm} className="rounded-sm border px-1.5 py-0.5">
        confirm()
      </button>
      <button type="button" onClick={cancel} className="rounded-sm border px-1.5 py-0.5">
        cancel()
      </button>
    </div>
  );
}

// ---------------------------------------------------------------- tables ---

interface PropRow {
  prop: string;
  type: string;
  note: string;
}

const PROP_TABLES: Array<{ name: string; blurb: string; rows: PropRow[] }> = [
  {
    name: 'JSONUIProvider',
    blurb: 'Composes the five contexts below plus the confirm dialog. Everything is optional except children.',
    rows: [
      { prop: 'registry', type: 'ComponentRegistry', note: 'Accepted, destructured — and never used. Pass it to <Renderer> as well or nothing renders.' },
      { prop: 'store', type: 'StateStore', note: 'Controlled mode. Wins over initialState/onStateChange, which are then ignored.' },
      { prop: 'initialState', type: 'Record<string, unknown>', note: 'Uncontrolled mode only. Flattened to JSON Pointers; later changes to the object are diffed in.' },
      { prop: 'handlers', type: 'Record<string, (params) => Promise<unknown> | unknown>', note: 'Custom action names. A handler gets params and nothing else — no setState, no store.' },
      { prop: 'navigate', type: '(path: string) => void', note: 'Used only by onSuccess: { navigate }.' },
      { prop: 'validationFunctions', type: 'Record<string, (value, args?) => boolean>', note: 'Passed to ValidationProvider as customFunctions — note the rename.' },
      { prop: 'functions', type: 'Record<string, ComputedFunction>', note: 'Named functions for { $computed }. Missing name → console.warn and undefined.' },
      { prop: 'directives', type: 'DirectiveDefinition[]', note: 'Custom $-keys. Compiled once with createDirectiveRegistry, memoised on the array identity.' },
      { prop: 'onStateChange', type: '(changes: Array<{ path, value }>) => void', note: 'Uncontrolled mode only. One call per set/update, with every changed entry.' },
      { prop: 'children', type: 'ReactNode', note: 'Your tree. <Renderer> goes in here.' },
    ],
  },
  {
    name: 'StateProvider',
    blurb: 'Owns the state model. Everything else in the stack reads it through useStateStore.',
    rows: [
      { prop: 'store', type: 'StateStore', note: 'Controlled. Captured once: switching modes later warns in dev and is unsupported.' },
      { prop: 'initialState', type: 'StateModel', note: 'Uncontrolled. A new object identity is diffed against the previous one and applied with update().' },
      { prop: 'onStateChange', type: '(changes) => void', note: 'Uncontrolled only, and only when the snapshot identity actually changed.' },
      { prop: 'children', type: 'ReactNode', note: '' },
    ],
  },
  {
    name: 'VisibilityProvider',
    blurb: 'children only. Builds { stateModel } from the state context and memoises an evaluator on it.',
    rows: [{ prop: 'children', type: 'ReactNode', note: 'Requires a StateProvider above it — it calls useStateStore itself.' }],
  },
  {
    name: 'ValidationProvider',
    blurb: 'Holds field registrations and results. None of it lives in the state model.',
    rows: [
      { prop: 'customFunctions', type: 'Record<string, ValidationFunction>', note: 'Your own check types, merged with the built-ins at runValidation time.' },
      { prop: 'children', type: 'ReactNode', note: 'Must sit ABOVE ActionProvider: that is how validateForm finds validateAll.' },
    ],
  },
  {
    name: 'ActionProvider',
    blurb: 'Dispatches. Handles the built-ins itself and forwards the rest to your handlers.',
    rows: [
      { prop: 'handlers', type: 'Record<string, ActionHandler>', note: 'Read ONCE into state (useState(initialHandlers)). A new object later is ignored — build handlers in a useMemo and read changing values through refs.' },
      { prop: 'navigate', type: '(path: string) => void', note: 'For onSuccess: { navigate }. Without it that branch is skipped silently.' },
      { prop: 'children', type: 'ReactNode', note: 'Needs StateProvider above it; reads validation through useOptionalValidation, so that one is genuinely optional.' },
    ],
  },
  {
    name: 'Renderer',
    blurb: 'Walks the spec. Needs State, Visibility and Action above it — ElementRenderer calls all three hooks unconditionally.',
    rows: [
      { prop: 'spec', type: 'Spec | null', note: 'null, missing root, or a root key that is not in elements → renders null, no error.' },
      { prop: 'registry', type: 'ComponentRegistry', note: 'name → component. Unknown type → the fallback, or a console.warn and nothing.' },
      { prop: 'loading', type: 'boolean', note: 'Passed to every component as ctx.loading, and silences the "missing element" warnings while a spec streams in.' },
      { prop: 'fallback', type: 'ComponentRenderer', note: 'Rendered for any type the registry does not have. Always pass one.' },
    ],
  },
  {
    name: 'createRenderer(catalog, components)',
    blurb: 'A one-component shortcut: assembles the same six layers and the Renderer for you.',
    rows: [
      { prop: 'spec / loading / fallback', type: 'same as Renderer', note: '' },
      { prop: 'store / state / onStateChange', type: 'same as StateProvider', note: 'Note the prop is called `state`, not `initialState`.' },
      { prop: 'onAction', type: '(name, params?) => void', note: 'A Proxy stands in for the handlers map: every action name resolves, so nothing is ever "unhandled".' },
      { prop: 'functions / directives', type: 'same as JSONUIProvider', note: 'No validationFunctions and no navigate — ValidationProvider is rendered bare.' },
    ],
  },
  {
    name: 'RepeatScopeProvider',
    blurb: 'The seventh layer, rendered per row by the renderer itself. You only need it in tests.',
    rows: [
      { prop: 'item / index / basePath', type: 'unknown / number / string', note: 'What useRepeatScope returns. basePath is the absolute path of the row, e.g. /todos/2.' },
      { prop: 'children', type: 'ReactNode', note: '' },
    ],
  },
];

// ------------------------------------------------------------------- lab ---

type LayerKey = 'state' | 'visibility' | 'validation' | 'action';

/** Three ways to get the same six layers on screen — or, for 'hand', to fail to. */
type Mode = 'hand' | 'combined' | 'created';

/**
 * A stage's `focus` → the prop tables it is about, so the props tab reads as
 * the one API being taught. The combined stage keeps `Renderer` open beside
 * the provider on purpose: its lesson is that those two registry props are
 * different props.
 */
const FOCUS_TABLES: Record<string, string[]> = {
  state: ['StateProvider'],
  visibility: ['VisibilityProvider'],
  validation: ['ValidationProvider'],
  action: ['ActionProvider'],
  combined: ['JSONUIProvider', 'Renderer'],
  created: ['createRenderer(catalog, components)'],
};

const LAYERS: Array<{ key: LayerKey; name: string; breaks: string }> = [
  { key: 'state', name: 'StateProvider', breaks: 'fatal — nothing renders' },
  { key: 'visibility', name: 'VisibilityProvider', breaks: 'fatal — nothing renders' },
  { key: 'validation', name: 'ValidationProvider', breaks: 'partial — validated fields vanish' },
  { key: 'action', name: 'ActionProvider', breaks: 'fatal — nothing renders' },
];

/** The lesson half of each stage; `items` supplies the assignment half. */
const PROVIDER_STAGES = [
  {
    id: 'no-state', title: 'Without StateProvider', concept: 'provider-stack', also: ['store-prop'], focus: 'state',
    when:
      'You almost never mount this layer by hand; what it really decides is `store` versus `initialState`. Pass a `store` when something outside React must read or write the same model — persistence, a test, a second tree — and leave it off otherwise, since the uncontrolled store it builds is unreachable from outside. The mode is captured on the first render, so switching later is not something you can do.',
  },
  {
    id: 'no-visibility',
    title: 'Without VisibilityProvider',
    when:
      'There is nothing to choose here: every element asks it for a context, so it is mount-it-or-render-nothing, and `JSONUIProvider` already has. Its value is diagnostic — a screen that goes completely blank with no error, static text included, is this layer missing rather than a condition written wrong.',
    ref: 'prov-visibilityprovider',
    focus: 'visibility',
    summary:
      'The only provider with nothing to configure: it takes `children`, reads the state model out of the state context and hands the tree an evaluator bound to it. One Alert in this spec has a `visible` condition — and yet ElementRenderer asks for `useVisibility().ctx` on every element, so dropping it takes out a screen of static text too.',
  },
  {
    id: 'no-action',
    title: 'Without ActionProvider',
    when:
      'Same rule, and worth saying because the instinct is the other way: a read-only screen with no buttons still needs it, since the renderer asks for action context on every element. Never drop it to trim a static page — the saving is nothing and the failure is the whole tree.',
    ref: 'prov-actionprovider',
    focus: 'action',
    summary:
      'Every element dies, not only the buttons. The renderer resolves an element through context that assumes the whole stack is present, so one missing provider takes out the tree rather than degrading the parts that needed it.',
  },
  {
    id: 'no-validation',
    title: 'Without ValidationProvider',
    when:
      'The one layer with a real choice: leave it out when nothing in the tree validates and the screen still renders. Mount one per FORM rather than one per page as soon as two forms share a screen — registrations are keyed by state path in a single registry, so otherwise `validateForm` in one form reports on the other form’s fields too.',
    ref: 'prov-validationprovider',
    focus: 'validation',
    summary:
      'The one layer you can drop and still get a screen. It holds the field registrations and their results, and none of that lives in the state model — so the casualties are exactly the controls that called `useFieldValidation`, and nothing else notices.',
  },
  {
    id: 'confirm',
    title: 'The confirm nobody renders',
    when:
      'Spec-level `confirm` is available to you only under `JSONUIProvider` or `createRenderer`, which mount the dialog manager; hand-assemble the four exported providers and the dispatch parks forever with nothing on screen to answer it. So reach for `confirm` on a custom destructive action in a normal app, and if you have a reason to build the stack yourself, move the confirmation into your own handler instead.',
    ref: 'act-confirm',
    summary:
      '`confirm` on an action binding parks the dispatch and waits for the host to answer. A hand-built stack has nothing to ask with: `ConfirmationDialogManager` is not exported, so `pendingConfirmation` is set, nothing on screen renders it, and the action settles neither way. The four exported providers are not the whole stack.',
  },
  {
    id: 'order',
    title: 'Order inside the stack',
    when:
      'Only split the stack to share one state model across trees a single provider cannot wrap — two Renderers in different parts of the page, or a ValidationProvider per form so two forms do not share a field registry. For everything else one JSONUIProvider with many Renderers inside it is cheaper and cannot get the order wrong.',
    concept: 'when-to-split-providers',
    focus: 'order',
    summary:
      'The providers nest, so ValidationProvider has to sit inside ActionProvider for `validateForm` to find the fields it is meant to report on. Get the order wrong and the action runs, writes nothing, and reports success.',
  },
  {
    id: 'combined',
    title: 'What JSONUIProvider adds',
    when:
      'The default answer for an app, and the only one that can supply `$computed` functions, custom directives and the confirm dialog, because those three contexts are not exported. Mind which `registry` prop matters — the one on `Renderer`; the provider takes one and never reads it — and that several `Renderer`s can share a provider, which is how a chat log draws many specs against one state model.',
    concept: 'renderer-props',
    ref: 'prov-jsonuiprovider',
    focus: 'combined',
  },
  {
    id: 'created',
    title: 'createRenderer instead',
    when:
      'Prototypes, demos and embeds, where one component with one `onAction` callback is exactly the point. Outgrow it the moment you need per-action handlers rather than a single switch, `validationFunctions`, or `navigate` for an `onSuccess` — it takes none of the three, and at that point `JSONUIProvider` plus `Renderer` is a dozen more lines for the whole surface.',
    ref: 'prov-createrenderer',
    focus: 'created',
    summary:
      'Catalog and components in, one component out — the same six layers and the same dialog, assembled for you. The wiring is what changes: every action collapses into a single `onAction(name, params)`, the state prop is called `state` rather than `initialState`, and there is no `validationFunctions` and no `navigate` to pass.',
  },
];

export function ProvidersLab() {
  const [tab, setTab] = useState<'stack' | 'props'>('stack');
  const [on, setOn] = useState<Record<LayerKey, boolean>>({
    state: true,
    visibility: true,
    validation: true,
    action: true,
  });
  const [validationAbove, setValidationAbove] = useState(true);
  const [mode, setMode] = useState<Mode>('hand');
  const [nonce, setNonce] = useState(0);
  const [errors, setErrors] = useState<Array<{ id: number; message: string }>>([]);
  const [log, setLog] = useState<Array<{ id: string; text: string }>>([]);
  const [seen, setSeen] = useState<Set<string>>(() => new Set());
  const [pendingSeen, setPendingSeen] = useState(false);
  const [blindValidate, setBlindValidate] = useState(false);
  /** Only createRenderer can set this: it is the single callback taking a dispatch. */
  const [proxySeen, setProxySeen] = useState(false);

  const store = useMemo(() => createStateStore(structuredClone(SEED)), []);
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);

  const mark = useCallback((id: string) => setSeen((prev) => (prev.has(id) ? prev : new Set(prev).add(id))), []);

  const handlers = useMemo(
    () => ({
      notify: async (params: Record<string, unknown>) => {
        setLog((prev) => [{ id: `${Date.now()}-${Math.random()}`, text: `notify ${JSON.stringify(params)}` }, ...prev].slice(0, 12));
      },
      deleteAll: async () => {
        setLog((prev) => [{ id: `${Date.now()}-${Math.random()}`, text: 'deleteAll ran' }, ...prev].slice(0, 12));
      },
    }),
    [],
  );

  /**
   * validateForm is a built-in, so it never reaches `handlers` — the action
   * observer is the only way to see it. We use it to prove the ordering rule:
   * dispatched while ActionProvider sits above ValidationProvider, it writes
   * nothing at all.
   */
  const orderRef = useRef(validationAbove);
  orderRef.current = validationAbove;
  const handBuiltRef = useRef(mode === 'hand');
  handBuiltRef.current = mode === 'hand';
  useEffect(
    () =>
      registerActionObserver({
        onDispatch: (e: ActionDispatchInfo) => {
          setLog((prev) => [{ id: e.id, text: `dispatch ${e.name}` }, ...prev].slice(0, 12));
          if (e.name === 'validateForm' && !orderRef.current && handBuiltRef.current) setBlindValidate(true);
        },
      }),
    [],
  );

  /** createRenderer's whole action surface: one callback, the name as an argument. */
  const onAction = useCallback((name: string, params?: Record<string, unknown>) => {
    setProxySeen(true);
    setLog((prev) =>
      [{ id: `${Date.now()}-${Math.random()}`, text: `onAction ${name} ${JSON.stringify(params ?? {})}` }, ...prev].slice(0, 12),
    );
  }, []);

  // Record each failure mode the learner has actually put on screen.
  useEffect(() => {
    if (mode !== 'hand') {
      mark(mode);
      return;
    }
    if (!on.state) mark('no-state');
    if (!on.visibility) mark('no-visibility');
    if (!on.action) mark('no-action');
    if (!on.validation && on.state && on.visibility && on.action) mark('no-validation');
    if (!validationAbove && on.validation && on.action) mark('swapped');
  }, [on, validationAbove, mode, mark]);

  const errSeq = useRef(0);
  const onError = useCallback((message: string) => {
    setErrors((prev) => {
      if (prev[0]?.message === message) return prev;
      errSeq.current += 1;
      return [{ id: errSeq.current, message }, ...prev].slice(0, 6);
    });
  }, []);

  const markPending = useCallback(() => setPendingSeen(true), []);
  const ignorePending = useCallback(() => {}, []);

  const allOn = on.state && on.visibility && on.validation && on.action && validationAbove;
  const assembled = mode !== 'hand';

  /**
   * What the checklist's "do it for me" buttons run: put the stack in exactly
   * the configuration the task describes, in one click, and reset the boundary
   * so a previous throw does not linger.
   */
  const setStack = useCallback(
    (next: Partial<Record<LayerKey, boolean>>, opts?: { above?: boolean; mode?: Mode }) => {
      setMode(opts?.mode ?? 'hand');
      setValidationAbove(opts?.above ?? true);
      setOn({ state: true, visibility: true, validation: true, action: true, ...next });
      setErrors([]);
      setNonce((n) => n + 1);
    },
    [],
  );

  /** Rebuilt on every toggle so the boundary resets instead of staying broken. */
  const configKey = `${nonce}|${mode}|${on.state}${on.visibility}${on.validation}${on.action}|${validationAbove}`;

  let tree: React.ReactNode = (
    <>
      <Renderer spec={SPEC} registry={demoRegistry} fallback={UnknownComponent} />
      {on.action && <PendingProbe onPending={markPending} />}
    </>
  );
  if (mode === 'hand') {
    if (validationAbove) {
      if (on.action) tree = <ActionProvider handlers={handlers}>{tree}</ActionProvider>;
      if (on.validation) tree = <ValidationProvider>{tree}</ValidationProvider>;
    } else {
      if (on.validation) tree = <ValidationProvider>{tree}</ValidationProvider>;
      if (on.action) tree = <ActionProvider handlers={handlers}>{tree}</ActionProvider>;
    }
    if (on.visibility) tree = <VisibilityProvider>{tree}</VisibilityProvider>;
    if (on.state) tree = <StateProvider store={store}>{tree}</StateProvider>;
  }

  const stackSource = mode === 'created'
    ? `// one component, built once from the catalog and the component map
const DemoRenderer = createRenderer(demoCatalog, components);

<DemoRenderer
  spec={spec}
  store={store}
  onAction={(name, params) => log(name, params)}   // every action, one callback
  functions={{ sum }}
  directives={[upper]}
  fallback={Unknown}
/>
// no registry prop — the component map IS the registry
// no handlers, no validationFunctions, no navigate`
    : mode === 'combined'
    ? `<JSONUIProvider
  registry={registry}        // accepted and ignored
  store={store}
  handlers={handlers}
  functions={{ sum }}
  directives={[upper]}
>
  <Renderer spec={spec} registry={registry} fallback={Unknown} />
</JSONUIProvider>`
    : [
        on.state ? '<StateProvider store={store}>' : '// StateProvider — OFF',
        on.visibility ? '  <VisibilityProvider>' : '  // VisibilityProvider — OFF',
        ...(validationAbove
          ? [
              on.validation ? '    <ValidationProvider>' : '    // ValidationProvider — OFF',
              on.action ? '      <ActionProvider handlers={handlers}>' : '      // ActionProvider — OFF',
            ]
          : [
              on.action ? '    <ActionProvider handlers={handlers}>  // ← above validation' : '    // ActionProvider — OFF',
              on.validation ? '      <ValidationProvider>' : '      // ValidationProvider — OFF',
            ]),
        '        {/* FunctionsContext  — not exported, so no $computed */}',
        '        {/* DirectivesContext — not exported, so no $upper    */}',
        '        {/* ConfirmationDialogManager — not exported either   */}',
        '        <Renderer spec={spec} registry={registry} fallback={Unknown} />',
      ].join('\n');

  const items: ChecklistItem[] = [
    {
      label: (
        <>
          Turn off <strong>StateProvider</strong> and read the message the tree throws.
        </>
      ),
      done: seen.has('no-state'),
      hint: 'VisibilityProvider calls useStateStore itself, so it throws before a single element renders.',
      steps: [
        <>
          Stay on <strong>the stack</strong> tab with mode set to <strong>hand-assembled</strong>.
        </>,
        <>
          In the <strong>layers</strong> panel, untick <strong>StateProvider</strong>.
        </>,
        <>
          The render panel becomes one red box: <strong>the whole tree threw</strong>. Not one control —
          all of it.
        </>,
        <>
          Read the message in <strong>thrown</strong> below:{' '}
          <code>useStateStore must be used within a StateProvider</code>. It came from{' '}
          <code>VisibilityProvider</code>, which calls that hook before any element renders.
        </>,
        <>
          Check <strong>what you are rendering</strong>: the line now reads{' '}
          <code>// StateProvider — OFF</code>.
        </>,
      ],
      apply: { label: 'turn StateProvider off', run: () => setStack({ state: false }) },
    },
    {
      label: (
        <>
          Turn off <strong>VisibilityProvider</strong> — the one provider with nothing to configure — and watch a
          render that was not using it die anyway.
        </>
      ),
      done: seen.has('no-visibility'),
      hint: 'Its only prop is children: it reads the state model and exposes evaluateVisibility bound to it. ElementRenderer takes that ctx for every element, condition or no condition.',
      steps: [
        <>
          Press <strong>restore all</strong>, then untick <strong>VisibilityProvider</strong> in the{' '}
          <strong>layers</strong> panel.
        </>,
        <>
          Everything is gone. The only element here with a <code>visible</code> condition is the Alert — and it was
          not even on screen, because <code>/status</code> is still empty. Nothing in the render was using this
          provider, and the render died anyway.
        </>,
        <>
          Read <strong>thrown</strong>: <code>useVisibility must be used within a VisibilityProvider</code>. The
          StateProvider message came from a provider; this one comes from <code>ElementRenderer</code> itself, on
          its second line.
        </>,
        <>
          Open the <strong>every prop</strong> tab and read the one row it has: <code>children</code>. A provider
          you never configure is still one you can never leave out.
        </>,
      ],
      apply: { label: 'turn VisibilityProvider off', run: () => setStack({ visibility: false }) },
    },
    {
      label: (
        <>
          Turn off <strong>ActionProvider</strong>. Every element dies — not just the buttons.
        </>
      ),
      done: seen.has('no-action'),
      hint: 'ElementRenderer calls useActions() unconditionally, whether or not the element has an `on` field.',
      steps: [
        <>
          Press <strong>restore all</strong> to put every layer back, then untick <strong>ActionProvider</strong>.
        </>,
        <>
          Everything is gone again — including the Email field and the Metric, which have no{' '}
          <code>on</code> binding at all.
        </>,
        <>
          Read <strong>thrown</strong>:{' '}
          <code>useActions must be used within an ActionProvider</code>.
        </>,
        <>
          That is <code>ElementRenderer</code> calling <code>useActions()</code> for every element
          unconditionally — a hook cannot be called only when an element happens to have events.
        </>,
      ],
      apply: { label: 'turn ActionProvider off', run: () => setStack({ action: false }) },
    },
    {
      label: (
        <>
          Turn off <strong>ValidationProvider</strong> only. Nothing reaches the top boundary — one control
          dies and the rest of the form carries on.
        </>
      ),
      done: seen.has('no-validation'),
      hint: 'useFieldValidation throws inside TextInput. This registry guards each component, so you get a red chip; without a guard the renderer’s own ElementErrorBoundary renders null and the field vanishes for good.',
      steps: [
        <>
          Tick the other three back on and untick <strong>ValidationProvider</strong> alone. The counter
          pill reads <strong>3/4 layers</strong>.
        </>,
        <>
          Look at the render: the four buttons, the Metric and the Text are all still there. Only the
          Email field is a red box.
        </>,
        <>
          <strong>thrown</strong> stays empty — nothing reached the top boundary. The throw happened
          inside one component and was caught below.
        </>,
        <>
          That red box only exists because this registry wraps every component in a guard. The
          renderer&rsquo;s own boundary renders <em>null</em>, so in a plain app the field simply
          disappears.
        </>,
      ],
      apply: { label: 'turn ValidationProvider off', run: () => setStack({ validation: false }) },
    },
    {
      label: (
        <>
          Press <strong>delete (confirm)</strong> on the hand-built stack and find the confirmation nobody
          renders.
        </>
      ),
      done: pendingSeen,
      steps: [
        <>
          Press <strong>restore all</strong> at the right of the mode row, so all four layers are on and{' '}
          <strong>hand-assembled</strong> is selected.
        </>,
        <>
          Press the red <strong>delete (confirm)</strong> button in the render.
        </>,
        <>
          No dialog appears. Instead the line under the render turns yellow:{' '}
          <code>pendingConfirmation: deleteAll</code> — the dispatch is parked, waiting for an answer
          nobody asked for.
        </>,
        <>
          Press <strong>confirm()</strong> on that yellow strip and watch{' '}
          <code>deleteAll ran</code> arrive in <strong>dispatches</strong>.
        </>,
        <>
          <code>ConfirmationDialogManager</code> is not exported, so a hand-built stack has no UI for
          this. That strip is a probe this lab wrote, not something the library gives you.
        </>,
      ],
      apply: { label: 'restore the hand-built stack', run: () => setStack({}) },
    },
    {
      label: (
        <>
          Put <strong>ActionProvider above ValidationProvider</strong> and press <strong>check the form</strong>:{' '}
          <code>/formValidation</code> is never written.
        </>
      ),
      done: blindValidate,
      hint: 'ActionProvider reads validation with useOptionalValidation — above it, that is null, and validateForm warns and returns.',
      steps: [
        <>
          With all four layers on, untick <strong>Validation above Action</strong> — the last row of the{' '}
          <strong>layers</strong> panel.
        </>,
        <>
          Check <strong>what you are rendering</strong>: <code>ActionProvider</code> is now the outer of
          the two, marked <code>← above validation</code>.
        </>,
        <>
          The form still renders and the Email field still validates on blur — the control found its own
          provider.
        </>,
        <>
          Press <strong>check the form</strong>. <strong>dispatches</strong> shows{' '}
          <code>dispatch validateForm</code>…
        </>,
        <>
          …and the <strong>state</strong> panel never gains a <code>/formValidation</code> key. Same
          layers, wrong order, silent no-op.
        </>,
      ],
      apply: {
        label: 'put Action above Validation',
        run: () => setStack({}, { above: false }),
      },
    },
    {
      label: (
        <>
          Restore all four in the right order, then switch to <strong>JSONUIProvider</strong> — only there do{' '}
          <code>$computed</code> and <code>$upper</code> resolve.
        </>
      ),
      done: seen.has('combined'),
      steps: [
        <>
          Press <strong>restore all</strong> — four layers on, <strong>Validation above Action</strong>{' '}
          ticked.
        </>,
        <>
          Read the <strong>symptoms</strong> panel: <code>$computed sum</code>, the{' '}
          <code>$upper</code> directive and the confirm dialog are all still marked{' '}
          <strong>broken</strong>. Those three contexts are not exported, so no hand-built stack can have
          them.
        </>,
        <>
          Click the <strong>JSONUIProvider</strong> chip in the mode row.
        </>,
        <>
          Every symptom flips to <strong>works</strong>: the Metric reads <code>42</code>, the shout line
          renders uppercase, and <strong>delete (confirm)</strong> now opens a real dialog.
        </>,
        <>
          Read <strong>what you are rendering</strong> once more: the provider takes a <code>registry</code> and
          ignores it, and the <code>&lt;Renderer&gt;</code> inside still needs its own <code>registry</code> and{' '}
          <code>fallback</code>. The two props are not the same prop.
        </>,
        <>
          One component, six layers, in the only order that works. That is the reason to use it.
        </>,
      ],
      apply: {
        label: 'switch to JSONUIProvider',
        run: () => setStack({}, { mode: 'combined' }),
      },
    },
    {
      label: (
        <>
          Switch to <strong>createRenderer</strong> and press <strong>notify</strong>: the handler map has
          collapsed into one <code>onAction(name, params)</code>.
        </>
      ),
      done: proxySeen,
      hint: 'createRenderer(catalog, components) mounts the same six layers and the dialog, but stands a Proxy in for handlers — every name resolves, so an action is never "unhandled" and never warns.',
      steps: [
        <>
          Click the <strong>createRenderer</strong> chip in the mode row. The layer tickboxes grey out: there is no
          stack left to assemble.
        </>,
        <>
          Read <strong>what you are rendering</strong> — no providers at all. One component built from{' '}
          <code>demoCatalog</code> plus the component map, taking <code>store</code>, <code>functions</code> and{' '}
          <code>directives</code> straight on its props.
        </>,
        <>
          Press <strong>notify</strong> in the render. <strong>dispatches</strong> gains{' '}
          <code>onAction notify</code> — the action name arrived as an argument, not as a key you registered
          anywhere.
        </>,
        <>
          Press <strong>delete (confirm)</strong>: a real dialog opens, exactly as under JSONUIProvider. Confirm
          it and <code>onAction deleteAll</code> follows it into the log.
        </>,
        <>
          What you gave up is on the <strong>every prop</strong> tab: no <code>handlers</code>, no{' '}
          <code>validationFunctions</code>, no <code>navigate</code>, and the uncontrolled prop is called{' '}
          <code>state</code> rather than <code>initialState</code>. Need any of those and you want
          JSONUIProvider.
        </>,
      ],
      apply: {
        label: 'switch to createRenderer',
        run: () => setStack({}, { mode: 'created' }),
      },
    },
  ];

  const stages = stagesFromChecklist(items, PROVIDER_STAGES);

  /**
   * The body, scoped to the stage.
   *
   * A stage teaches one provider, so `focus` dims the other layers and folds
   * the other prop tables down to their one-line blurb — reachable, but not
   * something to read past on the way to the one that matters.
   */
  const body = (focus?: string) => {
    const layerFocus = focus === 'order' || LAYERS.some((l) => l.key === focus) ? focus : undefined;
    const orderOff = layerFocus !== undefined && layerFocus !== 'order';
    const tableFocus = focus ? FOCUS_TABLES[focus] : undefined;

    return (
    <div className="flex flex-col gap-3">

      <div className="flex flex-wrap items-center gap-1.5">
        <Tabs
          tabs={[
            { id: 'stack', label: 'the stack' },
            { id: 'props', label: 'every prop' },
          ]}
          active={tab}
          onChange={(id) => setTab(id as 'stack' | 'props')}
        />
        {tab === 'stack' && (
          <>
            <span className="ml-2 font-mono text-[11px] uppercase tracking-wide text-muted-foreground">mode:</span>
            <Chip active={mode === 'hand'} onClick={() => setMode('hand')}>
              hand-assembled
            </Chip>
            <Chip active={mode === 'combined'} onClick={() => setMode('combined')}>
              JSONUIProvider
            </Chip>
            <Chip active={mode === 'created'} onClick={() => setMode('created')}>
              createRenderer
            </Chip>
            <button
              type="button"
              onClick={() => setStack({})}
              className="ml-auto rounded-sm border bg-surface px-2 py-0.5 font-mono text-[11px] text-muted-foreground hover:bg-surface-hover hover:text-foreground"
            >
              restore all
            </button>
          </>
        )}
      </div>

      {tab === 'props' ? (
        <div className="grid gap-3 lg:grid-cols-2">
          {PROP_TABLES.map((t) => {
            if (tableFocus && !tableFocus.includes(t.name)) {
              return (
                <Panel key={t.name} title={t.name}>
                  <div className="px-3 py-1.5 text-[13px] leading-relaxed text-muted-foreground opacity-45">
                    {t.blurb} · not this step
                  </div>
                </Panel>
              );
            }
            return (
            <Panel key={t.name} title={t.name} bodyClassName="overflow-auto">
              <div className="border-b bg-background px-3 py-1.5 text-[13px] leading-relaxed text-muted-foreground">
                {t.blurb}
              </div>
              <table className="w-full table-fixed">
                <tbody className="divide-y">
                  {t.rows.map((r) => (
                    <tr key={r.prop} className="align-top">
                      <td className="w-[38%] bg-muted px-3 py-1.5 font-mono text-[11.5px] text-foreground">
                        {r.prop}
                        <div className="mt-0.5 break-words text-[10.5px] text-muted-foreground">{r.type}</div>
                      </td>
                      <td className="px-3 py-1.5 text-[13px] leading-relaxed text-muted-foreground">{r.note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Panel>
            );
          })}
        </div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
          <div className="flex flex-col gap-3">
            <Panel title="layers">
              <div className="flex flex-col divide-y">
                {LAYERS.map((l) => {
                  const off = layerFocus !== undefined && layerFocus !== l.key;
                  return (
                    <label
                      key={l.key}
                      className={`flex cursor-pointer items-center gap-2.5 px-3 py-2 text-[13px] ${
                        assembled || off ? 'opacity-40' : ''
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="size-3.5 accent-orange-500"
                        disabled={assembled}
                        checked={assembled || on[l.key]}
                        onChange={(e) => setOn((prev) => ({ ...prev, [l.key]: e.target.checked }))}
                      />
                      <span className="font-mono text-[12.5px] text-foreground">{l.name}</span>
                      <span className="ml-auto text-[11.5px] text-muted-foreground">
                        {off ? '· not this step' : l.breaks}
                      </span>
                    </label>
                  );
                })}
                <label
                  className={`flex cursor-pointer items-center gap-2.5 px-3 py-2 text-[13px] ${
                    assembled || orderOff ? 'opacity-40' : ''
                  }`}
                >
                  <input
                    type="checkbox"
                    className="size-3.5 accent-orange-500"
                    disabled={assembled}
                    checked={validationAbove}
                    onChange={(e) => setValidationAbove(e.target.checked)}
                  />
                  <span className="font-mono text-[12.5px] text-foreground">Validation above Action</span>
                  <span className="ml-auto text-[11.5px] text-muted-foreground">
                    {orderOff ? '· not this step' : 'off → validateForm goes quiet'}
                  </span>
                </label>
                <div className="flex items-center gap-2.5 px-3 py-2 text-[13px] opacity-70">
                  <span className="size-3.5 shrink-0 rounded-sm border border-dashed" aria-hidden />
                  <span className="font-mono text-[12.5px] text-muted-foreground">
                    FunctionsContext · DirectivesContext
                  </span>
                  <span className="ml-auto text-[11.5px] text-muted-foreground">not exported</span>
                </div>
              </div>
            </Panel>

            <Panel title="what you are rendering">
              <CodeBlock code={stackSource} lang="tsx" maxHeight={230} showLineNumbers={false} />
            </Panel>

            <Panel title={`state${snapshot.formValidation ? ' · validateForm wrote /formValidation' : ''}`}>
              <CodeBlock code={JSON.stringify(snapshot, null, 2)} lang="json" maxHeight={170} showLineNumbers={false} />
            </Panel>
          </div>

          <div className="flex flex-col gap-3">
            <Panel
              title={
                mode === 'combined'
                  ? 'rendered under JSONUIProvider'
                  : mode === 'created'
                  ? 'rendered by createRenderer'
                  : 'rendered under your stack'
              }
              right={
                <span className="flex items-center gap-1.5">
                  <Pill tone={allOn || assembled ? 'ok' : 'warn'}>
                    {assembled ? 'all six' : `${Object.values(on).filter(Boolean).length}/4 layers`}
                  </Pill>
                </span>
              }
              bodyClassName="overflow-auto jr-canvas"
            >
              <div className="flex flex-col gap-2 p-3">
                <StackBoundary key={configKey} onError={onError}>
                  {mode === 'combined' ? (
                    <JSONUIProvider
                      registry={demoRegistry}
                      store={store}
                      handlers={handlers}
                      functions={FUNCTIONS}
                      directives={[upper]}
                    >
                      <Renderer spec={SPEC} registry={demoRegistry} fallback={UnknownComponent} />
                      <PendingProbe onPending={ignorePending} />
                    </JSONUIProvider>
                  ) : mode === 'created' ? (
                    // No children prop, so no PendingProbe here: the dialog manager it comes with renders the confirm itself.
                    <DemoRenderer
                      spec={SPEC}
                      store={store}
                      onAction={onAction}
                      functions={FUNCTIONS}
                      directives={[upper]}
                      fallback={UnknownComponent}
                    />
                  ) : (
                    tree
                  )}
                </StackBoundary>
              </div>
            </Panel>

            <Panel title="symptoms">
              <ul className="divide-y text-[13px]">
                <Symptom
                  label="$computed sum"
                  ok={assembled}
                  good="42 — FunctionsContext supplied the function"
                  bad="empty Metric + one console.warn: Unknown $computed function"
                />
                <Symptom
                  label="$upper directive"
                  ok={assembled}
                  good="the status, uppercased"
                  bad='"Text threw" — the unknown $-key stays an object and React refuses it as a child'
                />
                <Symptom
                  label="confirm dialog"
                  ok={assembled}
                  good="ConfirmDialog renders and resolves the promise"
                  bad="pendingConfirmation is set and nothing renders it — the dispatch never settles"
                />
                <Symptom
                  label="validateForm"
                  ok={assembled || (on.validation && on.action && validationAbove)}
                  good="writes { valid, errors } to /formValidation"
                  bad="console.warn, no write, no error"
                />
              </ul>
            </Panel>

            <Panel title={`thrown · ${errors.length}`} bodyClassName="overflow-auto">
              <div className="max-h-[110px] overflow-auto p-2 font-mono text-[11.5px]">
                {errors.length === 0 ? (
                  <span className="text-muted-foreground">Nothing has thrown yet. Turn a layer off.</span>
                ) : (
                  errors.map((e) => (
                    <div key={e.id} className="break-all px-1 py-0.5 text-red-600 dark:text-red-400">
                      {e.message}
                    </div>
                  ))
                )}
              </div>
            </Panel>

            <Panel title={`dispatches · ${log.length}`} bodyClassName="overflow-auto">
              <div className="max-h-[110px] overflow-auto p-2 font-mono text-[11.5px]">
                {log.length === 0 ? (
                  <span className="text-muted-foreground">No dispatches yet.</span>
                ) : (
                  log.map((l) => (
                    <div key={l.id} className="px-1 py-0.5 text-muted-foreground">
                      {l.text}
                    </div>
                  ))
                )}
              </div>
            </Panel>
          </div>
        </div>
      )}
    </div>
    );
  };

  return (
    <StageFrame slug="providers" stages={stages}>
      {(stage) => body(stage.focus)}
    </StageFrame>
  );
}

function Symptom({ label, ok, good, bad }: { label: string; ok: boolean; good: string; bad: string }) {
  return (
    <li className="flex items-start gap-2.5 px-3 py-1.5">
      <span className="mt-[3px] shrink-0">
        <Pill tone={ok ? 'ok' : 'bad'}>{ok ? 'works' : 'broken'}</Pill>
      </span>
      <span className="min-w-0">
        <span className="font-mono text-[12px] text-foreground">{label}</span>
        <span className="block text-[12.5px] leading-relaxed text-muted-foreground">{ok ? good : bad}</span>
      </span>
    </li>
  );
}
