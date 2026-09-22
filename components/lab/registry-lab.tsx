'use client';

import type { Spec } from '@json-render/core';
import { createStateStore } from '@json-render/core';
import { JSONUIProvider, Renderer } from '@json-render/react';
import { useMemo, useState } from 'react';
import { altRegistry } from '@/lib/demo/alt-registry';
import { demoRegistry, UnknownComponent } from '@/lib/demo/registry';
import { demoComponents, type DemoComponentName } from '@/lib/demo/catalog';
import { ALT_IMPL_ENTRIES, CATALOG_ENTRIES, COMPONENT_NAMES, IMPL_ENTRIES } from '@/lib/demo/source.generated';
import { CATALOG_EXAMPLES } from '@/lib/demo/source.generated';
import { CodeBlock } from '../playground/code-block';
import { Chip, Panel } from '../playground/ui';
import type { ChecklistItem } from './checklist';
import { StageFrame } from './stage-frame';
import { useInitialStage } from '@/lib/labs/use-initial-stage';
import { useRegistryInspector } from './registry-inspector';
import { stagesFromChecklist } from '@/lib/labs/types';

/**
 * What a registry IS: the per-renderer answer to a catalog entry.
 *
 * The catalog entry on the left is a contract — it says a `Metric` node in the
 * JSON tree carries `{ label, value, delta, tone }`. It says nothing about what
 * a Metric looks like. Each renderer answers that separately, and the two
 * columns on the right are two answers to the identical contract: same
 * catalog, same spec, same props, different output.
 *
 * That is also precisely how @json-render/react-pdf works — a third answer to
 * the same entry, drawing to a PDF instead of the DOM.
 */

/** One node of each type, built from the catalog's own `example` values. */
function specFor(name: string): Spec {
  const props = structuredClone((CATALOG_EXAMPLES[name] ?? {}) as Record<string, unknown>);

  /**
   * Fill every slot the entry declares, not just `children`.
   *
   * The entry is the contract, so a demo that leaves a declared slot empty
   * cannot show the thing this lab is about: both registries honour `footer`,
   * and the interesting part is WHERE each one puts it. With the slot unfilled
   * that branch is dead in both and the two columns look identical.
   */
  const declared = (demoComponents[name as DemoComponentName]?.slots ?? []) as string[];
  const named = declared.filter((slot) => slot !== 'default');
  const takesChildren = declared.includes('default');

  const elements: Spec['elements'] = {
    node: {
      type: name,
      props,
      children: takesChildren ? ['demo'] : [],
      ...(named.length > 0 ? { slots: Object.fromEntries(named.map((slot) => [slot, [`slot-${slot}`]])) } : {}),
    },
  };

  if (takesChildren) {
    elements.demo = { type: 'Text', props: { value: 'a child element', tone: null, size: null }, children: [] };
  }
  for (const slot of named) {
    elements[`slot-${slot}`] = {
      type: 'Button',
      props: { label: `in the ${slot} slot`, variant: 'secondary' },
      children: [],
    };
  }

  return { root: 'node', elements };
}

/** The lesson half of each stage; `items` below supplies the assignment half. */
const COMPARE_STAGES = [
  {
    id: 'compare-define',
    title: 'defineRegistry(catalog, components)',
    concept: 'registry-answers-catalog',
    when:
      'Once per renderer target. You need a second registry only when the same catalog has to draw somewhere else — a PDF, React Native, a wireframe mode for review — not to restyle a component, which is a change inside the one implementation you already have.',
    ref: 'util-defineregistry',
    tasks: 2,
    summary:
      'A registry is a plain object mapping each catalog name to a function `(ctx) => ReactNode`. It is one ANSWER to the catalog, not the catalog itself — which is why the same entry can have two of them side by side, and why @json-render/react-pdf is a third.',
  },
  {
    id: 'compare-container',
    title: 'A container places what it is given',
    when:
      'The decision this settles is where layout lives. Add a named slot when content belongs somewhere structurally different — a footer bar, a header action — and keep spacing, order and alignment inside the one implementation: a slot is a promise every renderer has to keep, so each extra one is paid for again in the PDF and the wireframe.',
    ref: 'prov-createrenderer',
    summary:
      'Both registries must honour `children` and every declared slot; WHERE they put them is each implementation\u2019s business. That division is the whole contract between a catalog and a registry.',
  },
];

/**
 * The component context, one key per stage.
 *
 * These are the arguments your function is actually handed, in the order you
 * meet them. Between them they are the entire surface a registry component
 * has — there is nothing else in the object.
 */
const CONTEXT_STAGES = [
  {
    id: 'context-props',
    focus: 'props',
    title: 'props — already resolved',
    concept: 'props-arrive-resolved',
    when:
      'Read `props` for everything you draw; it is already resolved and there is nothing to unwrap. Reach past it to `bindings` only when the component writes back — and put defaults in the component rather than assuming the spec supplied one, because a prop bound to a missing path arrives as `undefined`, indistinguishable from a prop nobody wrote.',
    ref: 'ctx-props',
  },
  {
    id: 'context-bindings',
    focus: 'bindings',
    title: 'bindings — the write path',
    concept: 'component-context',
    when:
      'Any component the user edits: pair it with `props` through `useBoundProp` and the control is writable. A display component can ignore `bindings` safely, but ignoring it in an editable one is the silent failure — the spec author writes `$bindState`, the value shows, nothing types, and no warning is printed anywhere.',
    ref: 'ctx-bindings',
    tasks: 2,
  },
  {
    id: 'context-children',
    focus: 'children',
    title: 'children — the default slot',
    when:
      'Render `children` in anything whose catalog entry lists `default` in `slots`; that declaration is the promise, and it is what to design against rather than whatever the current specs happen to nest. A leaf ignores it — a container that ignores it drops a whole subtree with nothing reporting the loss.',
    ref: 'ctx-children',
  },
  // Two parts, because they are two sides of one field: what the spec writes
  // (`slots`) and what the function receives (`ctx.slots`).
  {
    id: 'context-slots',
    focus: 'slots',
    title: 'slots — every named one, and never "default"',
    when:
      'Reach for a named slot when a component has a second, structurally distinct place for content, and stop at one or two: every name is another thing the model has to get right, and content sent to a slot you never render disappears in silence. A component that wants a long list of slots probably wants to be several components.',
    ref: 'ctx-slots',
    refs: ['el-slots'],
    tasks: 2,
  },
  {
    id: 'context-on',
    focus: 'on',
    title: 'on(name) — is it wired?',
    when:
      'Use `on(name)` over `emit(name)` when the component needs to know whether anything is listening — hiding an affordance nobody wired, or honouring `preventDefault` on a submit. For a plain click that should be a no-op when unbound, `emit` is shorter and reads better.',
    ref: 'ctx-on',
    tasks: 2,
  },
  {
    id: 'context-emit',
    focus: 'emit',
    title: 'emit(name) — the way out',
    when:
      'Every interaction the component offers, named for what the user did — `press`, `change` — never for what should happen, which is the spec decision in `on`. The catalog has no field for event names, so whatever you emit has to be written into the component description or nobody, model or human, will know to bind it.',
    ref: 'ctx-emit',
    tasks: 2,
  },
  {
    id: 'context-loading',
    focus: 'loading',
    title: 'loading — still streaming',
    when:
      'Only where a skeleton beats a half-built screen, which in practice means streaming: you hand the `isStreaming` flag from `useUIStream` to `<Renderer loading>` and every component gets the same value. It is not per-action — a button that should spin while its own handler runs wants `useAction(binding).isLoading` instead.',
    ref: 'ctx-loading',
  },
  {
    id: 'context-fallback',
    focus: 'fallback',
    title: 'An unknown type',
    concept: 'unknown-type-fallback',
    when:
      'Pass a `fallback` for any spec a model or a database can produce: a visible box turns an invented component name into a bug report instead of a hole in the page, and without one the element and its whole subtree render nothing. It is a last line, not a check — `catalog.validate` can tell you the name is unknown before you render at all.',
    ref: 'el-type',
    tasks: 2,
  },
  // The thing that produced every box above it: the renderer itself, whose
  // props are arguments to the walk rather than keys of the context.
  {
    id: 'context-renderer',
    focus: 'renderer',
    title: '<Renderer> — the four props',
    when:
      'Use `JSONUIProvider` with `<Renderer>` when you need the real wiring: per-action handlers, validation functions, navigation. `createRenderer` is the shorter path when one `onAction(name, params)` callback covers everything you do. Neither takes a state prop, so seeding the store from `spec.state` stays your job either way.',
    ref: 'prov-renderer',
    tasks: 2,
    summary:
      'The component that walked every element you have just met. It takes four props and nothing else: `spec`, `registry`, `loading`, `fallback`. This stage switches each one while the document and the store sit still — including `registry`, which swaps in a second implementation of this same catalog. That is the point the lab opened with, from the other end: the appearance of a screen is an argument to the walk, not a property of the JSON.',
  },
];

export function RegistryLab() {
  /**
   * Two halves of the same idea. "Two registries" shows that a catalog entry
   * has no opinion about its React; "component context" shows what the
   * renderer hands a component when it finally runs one.
   */
  /**
   * Stage two is about honouring `children` and declared slots, and Metric has
   * neither — so arriving there showed an entry that cannot demonstrate it.
   *
   * The opening entry therefore follows the opening stage, and moving to that
   * stage does the same. Both touch `name` only: `seen` still starts at Metric,
   * so the stage's own check (click through to Card or Screen) can never be
   * satisfied by arriving.
   */
  const opening = useInitialStage(COMPARE_STAGES.length + CONTEXT_STAGES.length);
  const [name, setName] = useState(COMPARE_STAGES[opening]?.id === 'compare-container' ? 'Card' : 'Metric');
  const [seen, setSeen] = useState<Set<string>>(new Set(['Metric']));

  const spec = useMemo(() => specFor(name), [name]);
  const storeA = useMemo(() => createStateStore({ form: { draft: '' } }), []);
  const storeB = useMemo(() => createStateStore({ form: { draft: '' } }), []);

  // The context pane owns its own tasks, so it hands them up rather than the
  // parent lumping them under one stage.
  /* The inspector's spec carries the component this stage is about, so it has
     to know the stage — not just the Field scoping, which is context-provided. */
  const [focus, setFocus] = useState<string | undefined>(
    () => (CONTEXT_STAGES[opening - COMPARE_STAGES.length] as { focus?: string } | undefined)?.focus,
  );
  const inspector = useRegistryInspector(focus);

  const contextBody = (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="flex items-center gap-2 overflow-x-auto rounded-lg border bg-card px-3 py-2">
        <span className="ml-2 text-[12.5px] text-muted-foreground">
          One component built for this stage, its own spec, its own state, and the function that drew it.
        </span>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        {inspector.body}
      </div>
    </div>
  );

  const items: ChecklistItem[] = [
        {
          label: (
            <>
              Get oriented: click through three entries. One catalog entry on the left, two answers to it on the
              right, rendering the <em>same</em> spec from the same props.
            </>
          ),
          done: seen.size >= 3,
          hint: 'Rule: the catalog is the contract, the registry is one implementation of it. @json-render/react-pdf is a third answer to these same entries, drawing to a PDF.',
          steps: [
            <>
              Read the three panels: <strong>catalog entry · Metric</strong> on the left,{' '}
              <strong>registry A · shadcn</strong> and <strong>registry B · wireframe</strong> beside it.
            </>,
            <>
              In each right-hand panel, the node is rendered at the top and the React that drew it sits
              underneath.
            </>,
            <>
              Click <strong>Text</strong> on the <strong>entry</strong> row at the top.
            </>,
            <>
              Click <strong>Badge</strong>: registry A draws a rounded pill, registry B prints{' '}
              <code>[Paid]</code> in mono.
            </>,
            <>
              Look back at the left panel: it changed once per click, and both renders changed with it — from the
              same four props.
            </>,
          ],
          apply: {
            label: 'click three for me',
            run: () => {
              setName('Badge');
              setSeen((prev) => new Set(prev).add('Text').add('Badge'));
            },
          },
        },
        {
          label: (
            <>
              Confirm the <strong>catalog entry never changes</strong> between the two columns. Nothing about a
              Metric node in the JSON says what a Metric looks like.
            </>
          ),
          done: seen.size >= 5,
          hint: 'Rule: a registry is a plain object, name → render function. You can filter it per user, per tenant or per feature flag without touching the catalog.',
          steps: [
            <>
              Click <strong>Alert</strong> on the <strong>entry</strong> row.
            </>,
            <>
              Read the left panel end to end: prop names, types, a description, an example. Not one word about
              colour, spacing or markup.
            </>,
            <>
              Click <strong>Checkbox</strong>, then <strong>Select</strong>, comparing the two renders each time.
            </>,
            <>
              Five entries in, the left panel has never described an appearance — and the two columns have never
              agreed on one.
            </>,
          ],
          apply: {
            label: 'click two more',
            run: () => {
              setName('Select');
              setSeen((prev) => new Set(prev).add('Alert').add('Checkbox').add('Select'));
            },
          },
        },
        {
          label: (
            <>
              Find a component where the two implementations disagree about <em>structure</em>, not just styling —
              proof that a slot is a contract, not a layout.
            </>
          ),
          done: seen.has('Card') || seen.has('Screen'),
          hint: 'Rule: both must honour children and the declared slots; where they put them is their business. Card: one uses shadcn Card/CardHeader/CardFooter, the other draws a box with a mono caption.',
          steps: [
            <>
              Click <strong>Card</strong> on the <strong>entry</strong> row.
            </>,
            <>
              Compare the two renders: A is a bordered card with a muted header bar; B is a double-ruled box with
              an uppercase mono caption.
            </>,
            <>
              Read the code under A: <code>CardHeader</code>, <code>CardContent</code>, <code>CardFooter</code>.
              Under B: three plain <code>div</code>s.
            </>,
            <>
              Look at what both do with <code>children</code> and <code>slots?.footer</code> — same two
              placements, entirely different markup. That is the whole contract.
            </>,
          ],
          apply: {
            label: 'open Card',
            run: () => {
              setName('Card');
              setSeen((prev) => new Set(prev).add('Card'));
            },
          },
        },
  ];

  const stages = [
    ...stagesFromChecklist(items, COMPARE_STAGES),
    ...stagesFromChecklist(inspector.items, CONTEXT_STAGES),
  ];

  const compareBody = (
    <div className="flex h-full min-h-0 flex-col gap-3">

      <div className="flex items-center gap-1.5 overflow-x-auto rounded-lg border bg-card px-3 py-2">
        <span className="ml-2 shrink-0 font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
          entry
        </span>
        {COMPONENT_NAMES.map((n) => (
          <Chip
            key={n}
            active={n === name}
            onClick={() => {
              setName(n);
              setSeen((prev) => new Set(prev).add(n));
            }}
          >
            {n}
          </Chip>
        ))}
      </div>

      <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-3">
        {/* THE CONTRACT */}
        <Panel
          title={
            <span className="flex items-center gap-1.5">
              <span className="size-1.5 rounded-full bg-blue-500" aria-hidden />
              catalog entry · {name}
            </span>
          }
          bodyClassName="flex flex-col overflow-hidden"
        >
          <div className="border-b bg-muted px-3 py-1.5 text-[12px] leading-relaxed text-muted-foreground">
            The schema for a <code className="font-mono text-foreground">{name}</code> node in the JSON tree. One
            per catalog — shared by every renderer below.
          </div>
          <div className="min-h-0 flex-1 overflow-auto">
            <CodeBlock code={CATALOG_ENTRIES[name] ?? '// not in the catalog'} lang="typescript" maxHeight="none" showLineNumbers={false} />
          </div>
        </Panel>

        {/* ANSWER A */}
        <RendererColumn
          label="registry A · shadcn"
          impl={IMPL_ENTRIES[name]}
          spec={spec}
          registry={demoRegistry}
          store={storeA}
        />

        {/* ANSWER B */}
        <RendererColumn
          label="registry B · wireframe"
          impl={ALT_IMPL_ENTRIES[name]}
          spec={spec}
          registry={altRegistry}
          store={storeB}
        />
      </div>
    </div>
  );

  return (
    <StageFrame
      slug="registry"
      stages={stages}
      onStageChange={(stage) => {
        if (stage.id === 'compare-container') setName('Card');
        setFocus(stage.focus);
      }}
    >
      {/* The pane AND everything in it are derived from the stage: its own
          component, its own spec, its own store, its own source. */}
      {(stage) => (stage.id.startsWith('context-') ? contextBody : compareBody)}
    </StageFrame>
  );
}

function RendererColumn({
  label,
  impl,
  spec,
  registry,
  store,
}: {
  label: string;
  impl?: string;
  spec: Spec;
  registry: typeof demoRegistry;
  store: ReturnType<typeof createStateStore>;
}) {
  return (
    <Panel
      title={
        <span className="flex items-center gap-1.5">
          <span className="size-1.5 rounded-full bg-emerald-500" aria-hidden />
          {label}
        </span>
      }
      bodyClassName="flex flex-col overflow-hidden"
    >
      <div className="shrink-0 border-b jr-canvas p-3">
        <JSONUIProvider registry={registry} store={store}>
          <Renderer spec={spec} registry={registry} fallback={UnknownComponent} />
        </JSONUIProvider>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        <CodeBlock code={impl ?? '// no implementation'} lang="tsx" maxHeight="none" showLineNumbers={false} />
      </div>
    </Panel>
  );
}
