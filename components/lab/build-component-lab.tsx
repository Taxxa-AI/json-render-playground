'use client';

import type { Spec } from '@json-render/core';
import { createStateStore, defineCatalog } from '@json-render/core';
import {
  defineRegistry,
  JSONUIProvider,
  Renderer,
  useBoundProp,
  useFieldValidation,
  useStateValue,
  type BaseComponentProps,
  type SetState,
} from '@json-render/react';
import { schema } from '@json-render/react/schema';
import React, { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { z } from 'zod';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CodeEditor } from '@/lib/build/code-editor';
import { compileComponent, type LearnerComponent } from '@/lib/build/compile-component';
import { guardOne } from '@/lib/build/reporting-guard';
import { DEFAULT_TEMPLATE, TEMPLATES } from '@/lib/build/templates';
import { demoActions, demoComponents } from '@/lib/demo/catalog';
import { demoComponentImpls } from '@/lib/demo/components';
import { UnknownComponent } from '@/lib/demo/registry';
import { at } from '@/lib/demo/spec-query';
import { cn } from '@/lib/utils';
import { Chip, ChromeButton, Panel, Pill } from '../playground/ui';
import type { ChecklistItem } from './checklist';
import { StageFrame } from './stage-frame';
import { stagesFromChecklist, type Stage } from '@/lib/labs/types';

/**
 * Write the other half.
 *
 * <StepRef slug="build-catalog"/> declared a name. This lab implements it — in
 * the browser, against a fixed spec that exercises every field of the context
 * object at once: a literal prop, a `$state` prop, a `$bindState` prop,
 * children, a named slot and a bound event.
 */

const CALLOUT = {
  description:
    'A highlighted note with a tone, an editable draft field and a named "actions" slot for buttons.',
  props: z.object({
    title: z.string(),
    body: z.string().nullable(),
    tone: z.enum(['info', 'success', 'warning', 'danger']).nullable(),
    dismissible: z.boolean().nullable(),
    draft: z.unknown().nullable(),
  }),
  slots: ['default', 'actions'],
  example: { title: 'Heads up', body: null, tone: 'info', dismissible: null, draft: null },
};

const buildCatalog = defineCatalog(schema, {
  components: { ...demoComponents, Callout: CALLOUT },
  actions: demoActions,
});

const SPEC: Spec = {
  root: 'screen',
  elements: {
    screen: {
      type: 'Screen',
      props: { title: 'Close checklist', subtitle: 'One element, every context field' },
      children: ['callout'],
    },
    callout: {
      type: 'Callout',
      props: {
        title: 'Quarterly close',
        body: { $state: '/invoice/note' },
        tone: 'warning',
        dismissible: true,
        draft: { $bindState: '/form/draft' },
      },
      children: ['line1', 'line2'],
      slots: { actions: ['ack'] },
      on: { press: { action: 'notify', params: { message: 'Callout emitted press' } } },
    },
    line1: { type: 'Text', props: { value: 'First line', tone: null, size: 'sm' }, children: [] },
    line2: { type: 'Text', props: { value: 'Second line', tone: null, size: 'sm' }, children: [] },
    ack: {
      type: 'Button',
      props: { label: 'Acknowledge', variant: 'secondary' },
      on: { press: { action: 'submit' } },
      children: [],
    },
  },
};

const SEED = { invoice: { note: 'Three ledgers are still unreconciled.' }, form: { draft: '' } };

interface LogLine {
  id: number;
  text: string;
}

/**
 * The lesson half of each stage; `items` supplies the assignment half.
 *
 * `focus` is a space-separated list of the things on this page the stage is
 * about — the same contract `hooks-lab` uses. The tokens are the keys the
 * probe prints (`props`, `children`, `slots`, `slots.default`, `bindings`,
 * `on`) plus the readouts beside them (`log`, `store`, `wiring`, `guard`).
 * Every token here is named by that stage's own steps, which is the test: a
 * stage may not dim a panel its instructions tell you to read.
 */
const BUILD_COMPONENT_STAGES = [
  {
    id: 'title',
    title: 'Props arrive resolved',
    concept: 'props-resolved',
    when:
      'Read `props.x` directly for anything you only display: the renderer has already evaluated every `$state`, `$template` and directive, so a hook here buys nothing and a `useState` copy of a prop goes stale the moment state moves. Reach past `props` only when you must write BACK, which is `bindings` plus `useBoundProp`. Resolved is not validated, so parse anything load-bearing yourself rather than trusting the type the catalog inferred.',
    focus: 'props',
  },
  {
    id: 'children',
    title: 'children is the default slot',
    concept: 'component-context',
    when:
      'Render `children` whenever the contents are the spec author’s business and position is not yours to decide — it is the cheapest container you can write, and the catalog only needs `default` in its slots. Take a named slot instead when your component has to place that content somewhere particular. Never look in `slots.default`: it is always undefined, because the default slot arrives as `children` and nowhere else.',
    // Both keys: the step reads `children`, then reads `slots.default` to find
    // out the default slot is NOT in `slots`. That contrast is the lesson.
    focus: 'children slots.default',
  },
  {
    id: 'slots',
    title: 'Every other slot is named',
    when:
      'Take a named slot when your component owns the placement — a footer row, an actions bar — and leave it as children when it does not. The price is that you must render every slot the catalog declares: the renderer does not check slot names against the catalog, so a slot you forget to place is content that disappears with no error anywhere. Two named slots beat one slot plus a prop that says where to put it.',
    ref: 'ctx-slots',
    focus: 'slots',
    summary:
      '`children` is the one slot with its own field; everything else the catalog declares arrives under `slots`, keyed by name. Your component decides where each one goes, which is the whole reason slots exist rather than a second children array.',
    also: ['define-registry'],
  },
  // The store snapshot is the proof that the write landed, so it travels with
  // `bindings` rather than standing on every stage.
  {
    id: 'bound',
    title: 'Making it writable',
    concept: 'use-bound-prop',
    when:
      'Every control the user edits. A local `useState` would hold a value nothing else in the spec can read, condition on or validate, so keep it for genuinely private UI state such as whether a popover is open. Pass the binding path as the second argument or the setter is a silent no-op — your component is then permanently read-only and the spec author has no way to tell.',
    focus: 'bindings store',
  },
  {
    id: 'emit',
    title: 'Emitting an event',
    concept: 'emit-event',
    when:
      'Emit for anything the spec should be allowed to wire — it fires whatever `element.on.press` holds, which leaves the choice of action with whoever writes the spec instead of baking it into your component. Call a function directly only for behaviour that belongs to the component itself, like toggling its own disclosure. Emitting an unbound event is a deliberate no-op, so use `on(name).bound` when you want to hide the affordance rather than guessing.',
    focus: 'on log',
  },
  {
    id: 'wiring',
    title: 'A registry is more than components',
    when:
      'Hand the provider `defineRegistry`’s own `handlers` whenever the catalog declares actions: a hand-written handlers object beside the registry drifts from the catalog silently, while the registry’s is the one call TypeScript already makes you complete. It takes GETTERS, so a handler always reads the latest state — a hand-rolled map closing over `state` is the classic stale-read bug. `executeAction` is the third return and belongs outside the tree, never inside a component.',
    ref: 'util-defineregistry',
    focus: 'log wiring',
    summary:
      '`defineRegistry(catalog, …)` returns three things: the `registry` the Renderer takes, a `handlers(getSetState, getState)` factory a provider can use, and an imperative `executeAction`. The components map is the half you have been writing; the actions map is the other half, and TypeScript requires it whenever the catalog declares actions.',
  },
  {
    id: 'guard',
    title: 'One red box, not a blank page',
    concept: 'guard-boundary',
    when:
      'Around every registry entry, and that is the point — one boundary at the top of the page still blanks the page, which is the failure you were trying to avoid. It earns its keep because props are never re-checked at runtime, so a model can hand your component a shape the catalog type promised was impossible. Wrap the implementation as an ELEMENT inside the boundary; calling `Impl(props)` inline puts the throw in the boundary’s own render and it escapes.',
    focus: 'guard',
  },
];

/**
 * The template each stage's steps tell you to start from.
 *
 * Kept OUT of `Stage.focus`: loading it on arrival would hand over the answer
 * and tick the stage before the learner had read anything, which is why the
 * chips stay a manual choice. Marking which one this step is written against
 * is the part that was missing — the other chips dim, but stay one click away
 * for anyone comparing implementations.
 */
const STAGE_TEMPLATE: Record<string, string> = {
  title: 'display',
  children: 'container',
  slots: 'container',
  bound: 'input',
  emit: 'button',
  wiring: 'button',
  guard: 'broken',
};

/** Context keys the probe prints, mapped to the `focus` token that opens them. */
const CTX_TOKEN: Record<string, string> = {
  props: 'props',
  bindings: 'bindings',
  children: 'children',
  slots: 'slots',
  'slots.default': 'slots.default',
  loading: 'loading',
  "on('press')": 'on',
};

const CTX_TOKENS = Object.values(CTX_TOKEN);

/** Is `token` one of the things this stage is about? A stage without `focus` shows everything. */
function shows(stage: Stage, token: string): boolean {
  return !stage.focus || stage.focus.split(' ').includes(token);
}

/**
 * One key of the printed context.
 *
 * Off-focus keys keep their name and lose their body — the same bargain
 * `registry-inspector` strikes, for the same reason: a learner on the
 * `children` stage should not read past six other keys to reach it.
 */
function CtxKey({ name, value, mine }: { name: string; value: unknown; mine: boolean }) {
  if (!mine) {
    return (
      <div className="flex items-center gap-2 opacity-45">
        <span className="font-mono text-[10.5px] uppercase tracking-wider text-muted-foreground">{name}</span>
        <span className="font-mono text-[11px] text-muted-foreground">· not this step</span>
      </div>
    );
  }
  return (
    <div>
      <div className="mb-0.5 font-mono text-[10.5px] uppercase tracking-wider text-orange-600 dark:text-orange-400">
        {name}
      </div>
      <pre className="whitespace-pre-wrap rounded border border-orange-200 bg-background px-2 py-1 font-mono text-[11.5px] leading-relaxed text-foreground dark:border-orange-900">
        {typeof value === 'string' ? value : JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
}

/** A readout no step on this stage mentions: still named, still there, one dim line. */
function NotThisStep({ title }: { title: string }) {
  return (
    <Panel title={title} bodyClassName="px-3 py-1.5 opacity-45">
      <span className="font-mono text-[11px] text-muted-foreground">· not this step</span>
    </Panel>
  );
}

export function BuildComponentLab() {
  const [templateId, setTemplateId] = useState(DEFAULT_TEMPLATE.id);
  const [code, setCode] = useState(DEFAULT_TEMPLATE.code);
  const [live, setLive] = useState(DEFAULT_TEMPLATE.code);
  const [ctxText, setCtxText] = useState('(not rendered yet)');
  /** Keyed by the source that threw, so fixing the code clears the banner. */
  const [caught, setCaught] = useState<{ key: string; message: string } | null>(null);
  const [renderedText, setRenderedText] = useState('');
  const [log, setLog] = useState<LogLine[]>([]);
  const [fired, setFired] = useState<string[]>([]);
  const logSeq = useRef(0);

  /** 300ms: long enough to stop compiling mid-identifier, short enough to feel live. */
  useEffect(() => {
    const t = setTimeout(() => setLive(code), 300);
    return () => clearTimeout(t);
  }, [code]);

  /**
   * The parameter list of the generated function — the entire world the
   * learner's code can reach. `h` is React.createElement because sucrase is
   * told to use the classic JSX runtime; `new Function` bodies cannot import.
   */
  const scope = useMemo(
    () => ({
      React,
      h: React.createElement,
      Fragment: React.Fragment,
      useBoundProp,
      useStateValue,
      useFieldValidation,
      cn,
      Badge,
      Button,
      Input,
    }),
    [],
  );

  const compiled = useMemo(() => compileComponent(live, scope), [live, scope]);

  // Keep the last implementation that compiled, so a half-typed edit does not
  // blank the preview you are editing against.
  const lastGood = useRef<LearnerComponent | null>(null);
  if (compiled.ok && compiled.component) lastGood.current = compiled.component;
  const impl = compiled.ok ? compiled.component : lastGood.current;

  const store = useMemo(() => createStateStore(structuredClone(SEED)), []);
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);

  /** One logger for both wirings, so the only thing that differs in the log is the name. */
  const record = useCallback((name: string, params?: Record<string, unknown>) => {
    setFired((prev) => [...prev, name].slice(-100));
    setLog((prev) => {
      logSeq.current += 1;
      const text = `${name}(${params && Object.keys(params).length ? JSON.stringify(params) : ''})`;
      return [{ id: logSeq.current, text }, ...prev].slice(0, 40);
    });
  }, []);

  const handlers = useMemo(
    () => ({
      notify: async (params: Record<string, unknown>) => record('notify', params),
      submit: async (params: Record<string, unknown>) => record('submit', params),
      reset: async (params: Record<string, unknown>) => record('reset', params),
    }),
    [record],
  );

  /**
   * registry = demo implementations + the learner's function, each in its own
   * boundary. The probe wrapper sits OUTSIDE the boundary so it still reports
   * the context when the implementation throws.
   */
  const bundle = useMemo(() => {
    if (!impl) return null;
    const Guarded = guardOne(
      'Callout',
      impl as unknown as React.ComponentType<Record<string, unknown>>,
      live,
      (message) => setCaught({ key: live, message }),
    );
    const Probe = (ctx: BaseComponentProps<Record<string, unknown>>) => {
      const summary = JSON.stringify(
        {
          props: ctx.props,
          bindings: ctx.bindings ?? null,
          children: ctx.children === undefined ? 'undefined' : 'rendered (the default slot)',
          slots: ctx.slots ? Object.keys(ctx.slots) : [],
          'slots.default': ctx.slots?.default === undefined ? 'undefined — use children' : 'defined?! the spec wrote slots.default',
          loading: Boolean(ctx.loading),
          "on('press')": { bound: ctx.on('press').bound, shouldPreventDefault: ctx.on('press').shouldPreventDefault },
        },
        null,
        2,
      );
      // setState with an identical string is a bail-out, so this cannot loop.
      useEffect(() => setCtxText(summary), [summary]);
      return <Guarded {...(ctx as unknown as Record<string, unknown>)} />;
    };
    Probe.displayName = 'ProbedCallout';

    /* The actions map is the other half of the same call, and the functions
     * `bundle.handlers(…)` wraps. They log under their own names so the two
     * wirings are told apart in the log below. */
    return defineRegistry(buildCatalog, {
      components: { ...demoComponentImpls, Callout: Probe } as never,
      actions: {
        submit: async () => record('registry:submit'),
        notify: async (params: Record<string, unknown>) => record('registry:notify', params),
        reset: async () => record('registry:reset'),
      } as never,
    });
  }, [impl, live, record]);

  const registry = bundle?.registry ?? null;

  /** A `SetState` over the store — exactly what `handlers(getSetState, …)` asks for. */
  const setState = useCallback<SetState>(
    (updater) => {
      const next = updater(store.getSnapshot());
      store.update(Object.fromEntries(Object.entries(next).map(([k, v]) => [`/${k}`, v])));
    },
    [store],
  );

  /**
   * Which handler map the provider gets. `handlers` takes GETTERS rather than
   * values, so an action reads the state as it is when it runs, not as it was
   * when the registry was built.
   */
  const [wiring, setWiring] = useState<'lab' | 'registry'>('lab');
  const registryHandlers = useMemo(
    () => bundle?.handlers(() => setState, () => store.getSnapshot()) ?? {},
    [bundle, setState, store],
  );

  /** Read what actually landed in the DOM — the checklist below asserts on it. */
  const renderRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = renderRef.current;
    if (!el) return;
    const read = () => setRenderedText(el.textContent ?? '');
    read();
    const mo = new MutationObserver(read);
    mo.observe(el, { childList: true, subtree: true, characterData: true });
    return () => mo.disconnect();
  }, [registry]);

  const draft = at(state, '/form/draft');

  /** Same thing the chip row does — the checklist's "do it for me" buttons reuse it. */
  const loadTemplate = (id: string) => {
    const t = TEMPLATES.find((x) => x.id === id);
    if (!t) return;
    setTemplateId(t.id);
    setCode(t.code);
    setCaught(null);
  };

  const items: ChecklistItem[] = [
    {
      label: (
        <>
          Render <code>props.title</code> — it reaches you as a plain string, already resolved.
        </>
      ),
      done: renderedText.includes('Quarterly close'),
      steps: [
        <>
          Click the <strong>display</strong> chip in the <strong>start from:</strong> row. The editor on
          the left fills with a props-only implementation.
        </>,
        <>
          Find <code>{'{props.title}'}</code> in that code — no hook, no resolution, just a string.
        </>,
        <>
          Look at <strong>rendered through the real Renderer</strong>: it reads{' '}
          <em>Quarterly close</em>.
        </>,
        <>
          Open <strong>the context your function receives</strong> below it: <code>props.body</code> is
          already the sentence from <code>/invoice/note</code>. The spec said{' '}
          <code>{'{ "$state": "/invoice/note" }'}</code>; your function never sees the expression.
        </>,
      ],
      apply: { label: 'load the display template', run: () => loadTemplate('display') },
    },
    {
      label: (
        <>
          Render <code>children</code>. That is the <code>default</code> slot, and the only one that is not
          in <code>slots</code>.
        </>
      ),
      done: renderedText.includes('First line') && renderedText.includes('Second line'),
      hint: 'slots holds the NAMED slots only. The default slot arrives separately, as children.',
      steps: [
        <>
          Click the <strong>container</strong> chip in the <strong>start from:</strong> row.
        </>,
        <>
          Find <code>{'{children}'}</code> in the editor — one expression, no mapping over anything.
        </>,
        <>
          <em>First line</em> and <em>Second line</em> now render inside your box: those are the two{' '}
          <code>Text</code> elements the spec put in <code>callout.children</code>.
        </>,
        <>
          In <strong>the context your function receives</strong>, read{' '}
          <code>"slots.default"</code>: it says <code>undefined — use children</code>. The default slot
          never appears in <code>slots</code>.
        </>,
      ],
      apply: { label: 'load the container template', run: () => loadTemplate('container') },
    },
    {
      label: (
        <>
          Render <code>slots.actions</code> and the Acknowledge button appears.
        </>
      ),
      done: renderedText.includes('Acknowledge'),
      steps: [
        <>
          Stay on the <strong>container</strong> template — it already renders{' '}
          <code>{'{slots?.actions}'}</code> in its footer row.
        </>,
        <>
          Find that block in the editor and delete it. The <em>Acknowledge</em> button disappears from the
          render, even though the spec still lists it.
        </>,
        <>
          Put it back: <code>{'{slots?.actions && <div>{slots.actions}</div>}'}</code>.
        </>,
        <>
          In <strong>the context your function receives</strong>, <code>slots</code> reads{' '}
          <code>["actions"]</code> — a named slot renders only where your component puts it.
        </>,
      ],
      apply: { label: 'load the container template', run: () => loadTemplate('container') },
    },
    {
      label: (
        <>
          Make typing write to state: <code>useBoundProp(props.draft, bindings?.draft)</code>.
        </>
      ),
      done: typeof draft === 'string' && draft.length > 0,
      hint: 'Try the "input" template. Without the binding path, setValue is a silent no-op.',
      steps: [
        <>
          Click the <strong>input</strong> chip in the <strong>start from:</strong> row.
        </>,
        <>
          Read the first line of the body:{' '}
          <code>useBoundProp(props.draft, bindings?.draft)</code> — the value and the path it came from,
          rejoined.
        </>,
        <>
          Type into the field in <strong>rendered through the real Renderer</strong>.
        </>,
        <>
          Watch <strong>store snapshot</strong> at the bottom right: <code>/form/draft</code> now holds
          what you typed.
        </>,
        <>
          Delete <code>bindings?.draft</code> from the call, leaving{' '}
          <code>useBoundProp(props.draft)</code>, and try typing again: nothing moves. Without the path,{' '}
          <code>setDraft</code> has nowhere to write.
        </>,
      ],
      apply: { label: 'load the input template', run: () => loadTemplate('input') },
    },
    {
      label: (
        <>
          Call <code>emit(&apos;press&apos;)</code> from your component and find it in the log.
        </>
      ),
      done: fired.includes('notify'),
      hint: 'The "button" template does it. Acknowledge fires submit, not notify — it will not count.',
      steps: [
        <>
          Click the <strong>button</strong> chip in the <strong>start from:</strong> row.
        </>,
        <>
          Press the <code>emit(&apos;press&apos;)</code> button inside the rendered Callout — not the{' '}
          <em>Acknowledge</em> button beside it.
        </>,
        <>
          Read <strong>dispatch log</strong>: a row appears reading{' '}
          <code>notify({'{"message":"Callout emitted press"}'})</code>.
        </>,
        <>
          That message is in the <em>spec</em>, not your code: <code>emit(&apos;press&apos;)</code> only
          resolves whatever <code>element.on.press</code> holds.
        </>,
        <>
          Press <em>Acknowledge</em> too: it logs <code>submit()</code>, because it is a different element
          with a different binding.
        </>,
      ],
      apply: { label: 'load the button template', run: () => loadTemplate('button') },
    },
    {
      label: (
        <>
          Hand the provider <code>defineRegistry</code>&rsquo;s own <code>handlers</code> and emit again —
          the same event, a different function.
        </>
      ),
      done: fired.includes('registry:notify'),
      hint: 'defineRegistry returns registry, handlers and executeAction. handlers(getSetState, getState) takes getters, so an action always reads the latest state.',
      steps: [
        <>
          Stay on the <strong>button</strong> template — you need something that emits.
        </>,
        <>
          Press <strong>○ registry handlers</strong> in the <strong>dispatch log</strong> header. The
          provider is now handed{' '}
          <code>handlers(() =&gt; setState, () =&gt; store.getSnapshot())</code> instead of the
          lab&rsquo;s own map.
        </>,
        <>
          Press <code>emit(&apos;press&apos;)</code> inside the Callout again. The row reads{' '}
          <code>registry:notify</code>: the spec still names <code>notify</code>, but the function that
          ran is the one you passed to <code>defineRegistry</code>.
        </>,
        <>
          Press <em>Acknowledge</em> too — <code>registry:submit</code>. Both halves of the registry come
          from one call, and a catalog that declares actions makes the <code>actions</code> key required,
          each one <code>async</code>, because the dispatcher awaits it.
        </>,
      ],
      apply: { label: 'switch to registry handlers', run: () => setWiring('registry') },
    },
    {
      label: (
        <>
          Throw on purpose and watch the guard turn a blank page into one red box.
        </>
      ),
      done: compiled.ok && caught?.key === live,
      hint: 'The "broken" template reads a prop the entry never declared.',
      steps: [
        <>
          Click the red <strong>broken</strong> chip in the <strong>start from:</strong> row.
        </>,
        <>
          Note the header still reads <strong>compiled</strong> — the code is valid JavaScript. It reads{' '}
          <code>props.tags</code>, which the catalog entry never declared.
        </>,
        <>
          Wait the ~300ms debounce for the editor to go live. A red box reading{' '}
          <code>Callout threw: …</code> takes the component&rsquo;s place, and the{' '}
          <strong>guard caught</strong> banner appears under the panels.
        </>,
        <>
          Look at what survived: the Screen and its title are still there. The boundary contained the
          throw to one subtree — without it the whole page would be blank.
        </>,
      ],
      apply: { label: 'load the broken template', run: () => loadTemplate('broken') },
    },
  ];

  const stages = stagesFromChecklist(items, BUILD_COMPONENT_STAGES);

  /**
   * The printed context, back as an object.
   *
   * The probe still hands over ONE string, because `setState` with an
   * identical string is a bail-out and that is what stops the reporting loop.
   * Parsing it here costs nothing and lets each key be scoped on its own.
   */
  const ctx = useMemo<Record<string, unknown> | null>(() => {
    try {
      return JSON.parse(ctxText) as Record<string, unknown>;
    } catch {
      return null;
    }
  }, [ctxText]);

  const stagedBody = (stage: Stage) => {
    const wanted = STAGE_TEMPLATE[stage.id];
    /* Read off the STAGE, never off the parsed context — before the first
     * render there is no context yet, and an empty probe is not the same thing
     * as a stage this readout does not belong to. */
    const ctxOn = CTX_TOKENS.some((t) => shows(stage, t));

    return (
    <div className="flex flex-col gap-3 pb-6">

      <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-surface px-3 py-2">
        <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">start from:</span>
        {TEMPLATES.map((t) => {
          // Dim the templates this step is not written against — never the one
          // you are actually editing, which would make the row lie about where
          // you are.
          const off = t.id !== wanted && t.id !== templateId;
          return (
            <span key={t.id} className={cn(off && 'opacity-40')}>
              <Chip
                active={templateId === t.id}
                danger={t.id === 'broken' && templateId !== t.id}
                onClick={() => {
                  setTemplateId(t.id);
                  setCode(t.code);
                  setCaught(null);
                }}
              >
                {t.label}
              </Chip>
            </span>
          );
        })}
        <span className="ml-auto truncate font-mono text-[11px] text-muted-foreground">
          {templateId === wanted
            ? TEMPLATES.find((t) => t.id === templateId)?.blurb
            : `this step is written against “${TEMPLATES.find((t) => t.id === wanted)?.label}”`}
        </span>
      </div>

      <div className="grid gap-3 xl:grid-cols-2">
        <Panel
          title="Callout — your registry implementation"
          right={
            compiled.ok ? (
              <Pill tone="ok">compiled</Pill>
            ) : (
              <Pill tone="bad">{compiled.phase === 'transform' ? 'syntax' : 'eval'} error</Pill>
            )
          }
          bodyClassName="flex flex-col"
        >
          <div className="h-[420px] min-h-0 overflow-auto border-b">
            <CodeEditor value={code} onChange={setCode} />
          </div>
          {compiled.error ? (
            <div className="bg-red-50 px-3 py-1.5 font-mono text-[12px] leading-relaxed text-red-700 dark:bg-red-950 dark:text-red-300">
              {compiled.phase}: {compiled.error}
              {lastGood.current && <span className="ml-2 opacity-70">· still showing the last version that built</span>}
            </div>
          ) : (
            <div className="px-3 py-1.5 font-mono text-[11px] text-muted-foreground">
              in scope: React · h · Fragment · useBoundProp · useStateValue · useFieldValidation · cn · Badge ·
              Button · Input
            </div>
          )}
        </Panel>

        <div className="flex flex-col gap-3">
          <Panel title="rendered through the real Renderer" bodyClassName="p-3">
            <div ref={renderRef}>
              {registry ? (
                <JSONUIProvider
                  registry={registry}
                  store={store}
                  handlers={wiring === 'registry' ? registryHandlers : handlers}
                >
                  <Renderer spec={SPEC} registry={registry} fallback={UnknownComponent} />
                </JSONUIProvider>
              ) : (
                <span className="font-mono text-[12px] text-muted-foreground">nothing has compiled yet</span>
              )}
            </div>
          </Panel>

          <div className="grid gap-3 sm:grid-cols-2">
            {ctxOn ? (
              <Panel title="the context your function receives" bodyClassName="p-0">
                <div className="flex max-h-[260px] flex-col gap-1.5 overflow-auto px-3 py-2">
                  {ctx === null ? (
                    <span className="font-mono text-[11.5px] text-muted-foreground">{ctxText}</span>
                  ) : (
                    Object.entries(ctx).map(([key, value]) => (
                      <CtxKey
                        key={key}
                        name={key}
                        value={value}
                        mine={shows(stage, CTX_TOKEN[key] ?? key)}
                      />
                    ))
                  )}
                </div>
              </Panel>
            ) : (
              <NotThisStep title="the context your function receives" />
            )}

            <div className="flex flex-col gap-3">
              {shows(stage, 'log') ? (
                <Panel
                  title="dispatch log"
                  right={
                    <div className="flex items-center gap-1.5">
                      {/* Shown on the wiring stage — and on any stage where it is
                          already flipped, because leaving it on with no way back
                          would silently break the earlier stage's `notify` check. */}
                      {(shows(stage, 'wiring') || wiring === 'registry') && (
                        <ChromeButton
                          active={wiring === 'registry'}
                          title="hand JSONUIProvider the handlers defineRegistry returned, instead of the lab's own"
                          onClick={() => setWiring((w) => (w === 'lab' ? 'registry' : 'lab'))}
                        >
                          {wiring === 'registry' ? '● registry handlers' : '○ registry handlers'}
                        </ChromeButton>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setLog([]);
                          setFired([]);
                        }}
                        className="rounded-sm border bg-surface px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground hover:bg-surface-hover hover:text-foreground"
                      >
                        clear
                      </button>
                    </div>
                  }
                  bodyClassName="p-0"
                >
                  <ul className="max-h-[120px] divide-y overflow-auto">
                    {log.length === 0 && (
                      <li className="px-3 py-1.5 font-mono text-[11.5px] text-muted-foreground">
                        nothing dispatched
                      </li>
                    )}
                    {log.map((l) => (
                      <li key={l.id} className="px-3 py-1 font-mono text-[11.5px] text-foreground">
                        {l.text}
                      </li>
                    ))}
                  </ul>
                </Panel>
              ) : (
                <NotThisStep title="dispatch log" />
              )}

              {shows(stage, 'store') ? (
                <Panel title="store snapshot" bodyClassName="p-0">
                  <pre className="max-h-[120px] overflow-auto px-3 py-2 font-mono text-[11.5px] text-foreground">
                    {JSON.stringify(state, null, 2)}
                  </pre>
                </Panel>
              ) : (
                <NotThisStep title="store snapshot" />
              )}
            </div>
          </div>

          {caught?.key === live && (
            <div
              className={cn(
                'rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[13px] leading-relaxed dark:border-red-900 dark:bg-red-950',
              )}
            >
              <span className="font-mono text-[11px] uppercase tracking-wider text-red-700 dark:text-red-300">
                guard caught
              </span>
              <p className="mt-0.5 text-red-700 dark:text-red-300">{caught.message}</p>
              <p className="mt-1 text-[12.5px] text-red-700/80 dark:text-red-300/80">
                The boundary replaced this element with the red marker, and the rest of the tree — the Screen
                around it — rendered normally. The subtree goes with it: children and named slots are rendered by
                the component that threw, so they are gone too. Without the boundary the whole page would be blank,
                and a boundary still catches nothing during server rendering.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
    );
  };

  return (
    <StageFrame slug="build-component" stages={stages}>
      {(stage) => stagedBody(stage)}
    </StageFrame>
  );
}
