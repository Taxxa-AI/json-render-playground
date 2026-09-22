'use client';

import { createStateStore, defineCatalog } from '@json-render/core';
import type { Spec } from '@json-render/core';
import { defineRegistry, JSONUIProvider, Renderer, useBoundProp } from '@json-render/react';
import { schema } from '@json-render/react/schema';
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { z } from 'zod';
import {
  INSPECTOR_ACTION_WIRING,
  INSPECTOR_CATALOG,
  INSPECTOR_ENTRIES,
  LAB_SETUPS,
  WIREFRAME_ENTRIES,
} from '@/lib/demo/source.generated';
import { usePublishSetup } from '@/lib/labs/setup';
import { CodeBlock } from '../playground/code-block';
import { JsonEditor } from '../playground/json-editor';
import { CopyButton, Panel } from '../playground/ui';
import type { ChecklistItem } from './checklist';

/**
 * One component per stage, built to show that stage's key of the context.
 *
 * The earlier version of this lab had a single `Probe` that printed all seven
 * keys as text. It was honest and it taught almost nothing: reading
 * `children: [object Object]` is not seeing children render, and a spec that
 * demonstrates seven things at once demonstrates none of them.
 *
 * So each stage now has its own component, its own spec and its own state, and
 * the code that drew the box is on screen beside it. A stage is three views of
 * ONE thing: what it rendered, the document that produced it, and the function
 * that was called. Change the spec and the render changes, because there is
 * only ever one of each.
 */

const lessonCatalog = defineCatalog(schema, {
  components: {
    PropsPrinter: {
      description: 'Prints every prop it was handed, with the JS type of each value.',
      props: z.object({
        label: z.string(),
        owner: z.unknown().nullable(),
        badge: z.unknown().nullable(),
        caption: z.unknown().nullable(),
      }),
      slots: [],
    },
    BoundInput: {
      description: 'A text field. Writable only when its value prop arrives as a $bindState.',
      props: z.object({ label: z.string(), value: z.unknown().nullable() }),
      slots: [],
    },
    CardBox: {
      description: 'A titled card that renders whatever the spec nests inside it.',
      props: z.object({ title: z.string() }),
      slots: ['default'],
    },
    SlotCard: {
      description: 'A card with two named regions, header and footer, either side of its default content.',
      props: z.object({ title: z.string() }),
      slots: ['default', 'header', 'footer'],
    },
    EventButton: {
      description: 'A button that asks whether its press event is wired before it draws itself.',
      props: z.object({ label: z.string() }),
      slots: [],
    },
    CounterButton: {
      description: 'A button that emits "press". What that means is the spec’s business, not its own.',
      props: z.object({ label: z.string() }),
      slots: [],
    },
    Readout: {
      description: 'One value from the state model, in large type.',
      props: z.object({ label: z.string(), value: z.unknown().nullable() }),
      slots: [],
    },
    StreamCard: {
      description: 'A card that draws a skeleton for the parts of itself that have not arrived yet.',
      props: z.object({ title: z.string().nullable() }),
      slots: ['default'],
    },
    Row: {
      description: 'One line of content. Filler, so children and slots have something to hold.',
      props: z.object({ text: z.string() }),
      slots: [],
    },
  },
  actions: {
    bump: { description: 'Add one to /clicks.', params: z.object({}) },
  },
});

/**
 * Nothing here — in either shape the renderer uses.
 *
 * An element with no `children` key hands the component `undefined`; one with
 * `"children": []` hands it an empty array. Both mean "nobody nested anything",
 * and `node ?? placeholder` only catches the first of them.
 */
function isEmpty(node: React.ReactNode): boolean {
  return node === undefined || node === null || (Array.isArray(node) && node.length === 0);
}

/**
 * The registry: one function per catalog name.
 *
 * Every one of these is deliberately short enough to read in the panel under
 * its own output, because on these stages the function IS the lesson.
 */
const { registry: lessonRegistry, handlers: lessonHandlers } = defineRegistry(lessonCatalog, {
  components: {
    // props arrive RESOLVED. There is no $state, no $cond and no $template left
    // to deal with by the time this runs — only values.
    PropsPrinter: ({ props }) => (
      <div className="w-full overflow-hidden rounded-md border bg-background">
        <div className="border-b bg-muted px-3 py-1.5 font-mono text-[10.5px] uppercase tracking-wider text-muted-foreground">
          props, exactly as this function received them
        </div>
        <table className="w-full font-mono text-[12px]">
          <tbody>
            {Object.entries(props).map(([key, value]) => (
              <tr key={key} className="border-b last:border-0">
                <td className="px-3 py-1.5 align-top text-muted-foreground">{key}</td>
                <td className="px-3 py-1.5 align-top text-foreground">{JSON.stringify(value)}</td>
                <td className="px-3 py-1.5 align-top text-right text-[11px] text-muted-foreground">{typeof value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    ),

    // props.value is the VALUE; bindings.value is the PATH it came from. A
    // control that cannot write is a control that should not pretend it can,
    // so with no path this one is natively read-only.
    BoundInput: ({ props, bindings }) => {
      const path = bindings?.value;
      const [value, setValue] = useBoundProp<string>(props.value as string, path);

      return (
        <div className="flex w-full flex-col gap-2">
          <label className="text-[12px] text-muted-foreground">{props.label}</label>
          <input
            value={value ?? ''}
            readOnly={!path}
            onChange={(e) => setValue(e.target.value)}
            placeholder={path ? 'type here' : 'no binding — read only'}
            className="rounded-md border bg-background px-2.5 py-1.5 text-[13px] text-foreground outline-none read-only:cursor-not-allowed read-only:bg-muted read-only:text-muted-foreground"
          />
          <p className="font-mono text-[12.5px] text-foreground">
            you typed: {value ? <span>{value}</span> : <span className="text-muted-foreground">(empty)</span>}
          </p>
          <p className="font-mono text-[11.5px] text-muted-foreground">
            bindings.value ={' '}
            {path ? (
              <span className="text-emerald-600 dark:text-emerald-400">{path}</span>
            ) : (
              <span className="text-yellow-600 dark:text-yellow-400">undefined — setValue writes nowhere</span>
            )}
          </p>
        </div>
      );
    },

    // `children` is the default slot, already rendered. This component decides
    // WHERE to put it and can do nothing else with it.
    //
    // Two shapes mean "nothing nested": `undefined` when the element has no
    // children key at all, and an EMPTY ARRAY when it has `"children": []`.
    // `children ?? placeholder` catches only the first, which is why an
    // "empty state" so often never appears.
    CardBox: ({ props, children }) => (
      <div className="w-full overflow-hidden rounded-lg border bg-background">
        <div className="border-b bg-muted px-3 py-2 text-[13px] font-medium text-foreground">{props.title}</div>
        <div className="flex flex-col gap-2 p-3">
          {isEmpty(children) ? (
            <span className="text-[12px] italic text-muted-foreground">
              nothing is nested under this element — children is {children === undefined ? 'undefined' : 'an empty array'}
            </span>
          ) : (
            children
          )}
        </div>
      </div>
    ),

    // Every region is drawn whether or not it was filled, so an unfilled slot
    // is visible as itself rather than as an absence.
    SlotCard: ({ props, children, slots }) => (
      <div className="w-full overflow-hidden rounded-lg border bg-background">
        <div className="border-b bg-muted px-3 py-2 text-[13px] font-medium text-foreground">{props.title}</div>
        {(
          [
            ['slots.header', slots?.header],
            ['children — the default slot', children],
            ['slots.footer', slots?.footer],
          ] as const
        ).map(([name, node]) => (
          <div key={name} className="m-2.5 rounded-md border border-dashed p-2.5">
            <div className="mb-1.5 font-mono text-[10.5px] uppercase tracking-wider text-muted-foreground">{name}</div>
            {isEmpty(node) ? (
              <span className="font-mono text-[11.5px] text-yellow-600 dark:text-yellow-400">
                empty — the spec put nothing here
              </span>
            ) : (
              node
            )}
          </div>
        ))}
      </div>
    ),

    // on(name) REPORTS, it does not dispatch — `emit` still does the firing.
    // Asking first is how a component avoids drawing an affordance that
    // nothing is listening to.
    EventButton: ({ props, on, emit }) => {
      const press = on('press');

      return (
        <div className="flex w-full flex-col items-start gap-2.5">
          <button
            type="button"
            disabled={!press.bound}
            onClick={() => emit('press')}
            className="rounded-md bg-brand px-3 py-1.5 text-[13px] text-brand-foreground disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground"
          >
            {props.label}
          </button>
          <p className="font-mono text-[12.5px] text-foreground">
            on(&apos;press&apos;).bound ={' '}
            <span className={press.bound ? 'text-emerald-600 dark:text-emerald-400' : 'text-yellow-600 dark:text-yellow-400'}>
              {String(press.bound)}
            </span>
          </p>
          <p className="text-[12px] leading-relaxed text-muted-foreground">
            {press.bound
              ? 'the element names an action for press — press it, and the count above moves'
              : 'nothing is listening, so this button draws itself disabled rather than lying'}
          </p>
        </div>
      );
    },

    // The entire component. It has no idea a counter exists: `press` is the
    // name of what the user did, and the spec decides what that means.
    CounterButton: ({ props, emit }) => (
      <button
        type="button"
        onClick={() => emit('press')}
        className="rounded-md bg-brand px-3 py-1.5 text-[13px] text-brand-foreground"
      >
        {props.label}
      </button>
    ),

    Readout: ({ props }) => (
      <div className="flex w-full items-baseline gap-3 rounded-md border bg-background px-3 py-2">
        <span className="text-[12px] text-muted-foreground">{props.label}</span>
        <span className="ml-auto font-mono text-[22px] leading-none tabular-nums text-foreground">
          {String(props.value ?? 0)}
        </span>
      </div>
    ),

    // `loading` is true while a streamed spec is still arriving. Props already
    // present are real; the rest may simply not have landed, which is exactly
    // the difference between a skeleton and an empty box.
    StreamCard: ({ props, children, loading }) => (
      <div className="w-full overflow-hidden rounded-lg border bg-background">
        <div className="flex items-center border-b bg-muted px-3 py-2 text-[13px] font-medium text-foreground">
          {props.title ??
            (loading ? <span className="h-3.5 w-40 animate-pulse rounded bg-foreground/20" /> : 'untitled')}
        </div>
        <div className="flex flex-col gap-2 p-3">
          {children}
          {loading && (
            <div className="flex flex-col gap-2" aria-label="still arriving">
              <span className="h-6 w-full animate-pulse rounded bg-foreground/10" />
              <span className="h-6 w-2/3 animate-pulse rounded bg-foreground/10" />
            </div>
          )}
        </div>
      </div>
    ),

    Row: ({ props }) => (
      <div className="rounded-md border bg-surface px-2.5 py-1.5 text-[12.5px] text-foreground">{props.text}</div>
    ),
  },
  actions: {
    // The only action this lab declares. `emit('press')` reaches it only
    // because the ELEMENT says `on.press.action = "bump"`.
    bump: async (_params, setState) =>
      setState((prev) => ({ ...prev, clicks: Number(prev.clicks ?? 0) + 1 })),
  },
});

/**
 * A second answer to the same catalog, for the last stage.
 *
 * Same names, same props, same spec — different functions. This is what makes
 * `registry` an argument to the walk rather than a property of the document,
 * and it is how @json-render/react-pdf draws the identical spec to a PDF.
 */
const { registry: wireframeRegistry } = defineRegistry(lessonCatalog, {
  components: {
    PropsPrinter: ({ props }) => (
      <pre className="w-full font-mono text-[12px] text-foreground">{JSON.stringify(props, null, 2)}</pre>
    ),
    BoundInput: ({ props }) => (
      <div className="w-full font-mono text-[12px] text-foreground">
        {props.label}: [ {String(props.value ?? '')} ]
      </div>
    ),
    CardBox: ({ props, children }) => (
      <div className="w-full border-2 border-dashed p-2 font-mono text-[12px]">
        <div className="uppercase tracking-wider text-muted-foreground">{props.title}</div>
        <div className="mt-2 flex flex-col gap-1">{children}</div>
      </div>
    ),
    SlotCard: ({ props, children, slots }) => (
      <div className="w-full border-2 border-dashed p-2 font-mono text-[12px]">
        <div className="uppercase tracking-wider text-muted-foreground">{props.title}</div>
        {slots?.header}
        {children}
        {slots?.footer}
      </div>
    ),
    EventButton: ({ props, on }) => (
      <div className="font-mono text-[12px]">
        [ {props.label} ] {on('press').bound ? '(wired)' : '(dead)'}
      </div>
    ),
    CounterButton: ({ props, emit }) => (
      <button type="button" onClick={() => emit('press')} className="border px-2 py-0.5 font-mono text-[12px]">
        [ {props.label} ]
      </button>
    ),
    Readout: ({ props }) => (
      <div className="font-mono text-[12px]">
        {props.label} = {String(props.value ?? 0)}
      </div>
    ),
    StreamCard: ({ props, children, loading }) => (
      <div className="w-full border-2 border-dashed p-2 font-mono text-[12px]">
        <div className="uppercase tracking-wider text-muted-foreground">{props.title ?? '…'}</div>
        {children}
        {loading && <div className="text-muted-foreground">… still arriving</div>}
      </div>
    ),
    Row: ({ props }) => <div className="font-mono text-[12px] text-foreground">- {props.text}</div>,
  },
  actions: {
    bump: async (_params, setState) => setState((prev) => ({ ...prev, clicks: Number(prev.clicks ?? 0) + 1 })),
  },
});

/**
 * The `fallback` prop of `<Renderer>`, drawn wherever `registry[type]` misses.
 *
 * It is handed the ELEMENT rather than a component context, because there is
 * no catalog entry behind it to resolve props against — which is also how it
 * can name the type it could not find.
 */
function UnknownBox({ element }: { element?: { type?: string } }) {
  return (
    <div className="rounded-md border border-dashed border-red-300 bg-red-50 px-2.5 py-1.5 font-mono text-[12px] text-red-600 dark:border-red-900 dark:bg-red-950 dark:text-red-400">
      fallback — nothing named &ldquo;{element?.type ?? '?'}&rdquo; in this registry
    </div>
  );
}

const row = (text: string): Spec['elements'][string] => ({ type: 'Row', props: { text }, children: [] });

/* ------------------------------------------------------------ the specs --- */

const PROPS_SPEC: Spec = {
  root: 'printer',
  elements: {
    printer: {
      type: 'PropsPrinter',
      props: {
        label: 'a plain string',
        owner: { $state: '/user/name' },
        badge: { $cond: { $state: '/user/admin' }, $then: 'ADMIN', $else: 'guest' },
        caption: { $template: '${/user/name} has ${/user/msgs} messages' },
      },
      children: [],
    },
  },
};

const PROPS_PLUS: Spec = {
  root: 'printer',
  elements: {
    printer: {
      ...PROPS_SPEC.elements.printer,
      props: { ...PROPS_SPEC.elements.printer.props, yours: { $template: 'admin? ${/user/admin}' } },
    },
  },
};

const BIND_SPEC: Spec = {
  root: 'field',
  elements: {
    field: {
      type: 'BoundInput',
      props: { label: 'Draft', value: { $bindState: '/form/draft' } },
      children: [],
    },
  },
};

const BIND_LITERAL: Spec = {
  root: 'field',
  elements: {
    field: { ...BIND_SPEC.elements.field, props: { label: 'Draft', value: 'typed by hand' } },
  },
};

const CHILD_SPEC: Spec = {
  root: 'card',
  elements: {
    card: { type: 'CardBox', props: { title: 'Invoice #1042' }, children: ['r1', 'r2'] },
    r1: row('Subscription — $40.00'),
    r2: row('Support — $12.00'),
  },
};

const CHILD_PLUS: Spec = {
  root: 'card',
  elements: {
    ...CHILD_SPEC.elements,
    card: { ...CHILD_SPEC.elements.card, children: ['r1', 'r2', 'r3'] },
    r3: row('Tax — $5.20'),
  },
};

const SLOT_SPEC: Spec = {
  root: 'card',
  elements: {
    card: {
      type: 'SlotCard',
      props: { title: 'Invoice #1042' },
      children: ['body'],
      slots: { header: ['head'] },
    },
    head: row('filed 12 March'),
    body: row('Subscription — $40.00'),
    // Defined but referenced by nothing, ready for the slot you are about to fill.
    foot: row('Total — $57.20'),
  },
};

const SLOT_FOOTER: Spec = {
  root: 'card',
  elements: {
    ...SLOT_SPEC.elements,
    card: { ...SLOT_SPEC.elements.card, slots: { header: ['head'], footer: ['foot'] } },
  },
};

const SLOT_DEFAULT: Spec = {
  root: 'card',
  elements: {
    ...SLOT_FOOTER.elements,
    card: {
      ...SLOT_FOOTER.elements.card,
      children: [],
      slots: { header: ['head'], footer: ['foot'], default: ['body'] },
    },
  },
};

const ON_SPEC: Spec = {
  root: 'card',
  elements: {
    card: { type: 'CardBox', props: { title: 'on(press) — ask before you draw' }, children: ['count', 'btn'] },
    count: { type: 'Readout', props: { label: 'archived', value: { $state: '/clicks' } }, children: [] },
    btn: { type: 'EventButton', props: { label: 'Archive' }, children: [], on: { press: { action: 'bump' } } },
  },
};

const ON_UNWIRED: Spec = {
  root: 'card',
  elements: { ...ON_SPEC.elements, btn: { ...ON_SPEC.elements.btn, on: {} } },
};

const EMIT_SPEC: Spec = {
  root: 'card',
  elements: {
    card: { type: 'CardBox', props: { title: 'emit(press) → on.press → the bump handler' }, children: ['count', 'btn'] },
    count: { type: 'Readout', props: { label: 'clicks', value: { $state: '/clicks' } }, children: [] },
    btn: { type: 'CounterButton', props: { label: 'press me' }, children: [], on: { press: { action: 'bump' } } },
  },
};

const EMIT_RESET: Spec = {
  root: 'card',
  elements: {
    ...EMIT_SPEC.elements,
    btn: {
      ...EMIT_SPEC.elements.btn,
      on: { press: { action: 'setState', params: { statePath: '/clicks', value: 0 } } },
    },
  },
};

/**
 * A spec arriving one line at a time, as a generation does.
 *
 * Each frame is a complete spec, so what the renderer sees here is what it
 * sees from `useUIStream`: a document that is valid at every step and simply
 * has less in it than it will have.
 */
const STREAM_FRAMES: Spec[] = [
  { root: 'card', elements: { card: { type: 'StreamCard', props: { title: null }, children: [] } } },
  { root: 'card', elements: { card: { type: 'StreamCard', props: { title: 'Invoice #1042' }, children: [] } } },
  {
    root: 'card',
    elements: {
      card: { type: 'StreamCard', props: { title: 'Invoice #1042' }, children: ['r1'] },
      r1: row('Subscription — $40.00'),
    },
  },
  {
    root: 'card',
    elements: {
      card: { type: 'StreamCard', props: { title: 'Invoice #1042' }, children: ['r1', 'r2'] },
      r1: row('Subscription — $40.00'),
      r2: row('Support — $12.00'),
    },
  },
  {
    root: 'card',
    elements: {
      card: { type: 'StreamCard', props: { title: 'Invoice #1042' }, children: ['r1', 'r2', 'r3'] },
      r1: row('Subscription — $40.00'),
      r2: row('Support — $12.00'),
      r3: row('Total — $57.20'),
    },
  },
];

const HOLE_SPEC: Spec = {
  root: 'card',
  elements: {
    card: { type: 'CardBox', props: { title: 'A screen a model wrote' }, children: ['r1', 'r2', 'r3'] },
    r1: row('Subscription — $40.00'),
    r2: row('Support — $12.00'),
    r3: row('Total — $57.20'),
  },
};

const HOLE_BROKEN: Spec = {
  root: 'card',
  elements: {
    ...HOLE_SPEC.elements,
    r2: { type: 'Sparkline', props: { points: [3, 7, 4, 9] }, children: [] },
  },
};

const RENDERER_SPEC: Spec = {
  root: 'card',
  elements: {
    card: { type: 'StreamCard', props: { title: 'One spec, two registries' }, children: ['r1', 'count', 'btn'] },
    r1: row('the same three elements either way'),
    count: { type: 'Readout', props: { label: 'clicks', value: { $state: '/clicks' } }, children: [] },
    btn: { type: 'CounterButton', props: { label: 'press me' }, children: [], on: { press: { action: 'bump' } } },
  },
};

/* ----------------------------------------------------------- the stages --- */

interface Lesson {
  /** The registry entry this stage is about; the code panel shows it. */
  component: string;
  /** Everything on screen on arrival. */
  spec: Spec;
  seed: Record<string, unknown>;
  /** One line above the render: what to watch while you edit. */
  watch: string;
  /**
   * Also show the action path: catalog → registry → handlers → provider.
   *
   * The `on` and `emit` stages are the only ones where a component's own
   * source cannot explain what happens, because what happens is configured
   * in four places outside it.
   */
  wiring?: boolean;
}

const LESSONS: Record<string, Lesson> = {
  props: {
    component: 'PropsPrinter',
    spec: PROPS_SPEC,
    seed: { user: { name: 'Ada', admin: true, msgs: 4 } },
    watch: 'Four expression forms in the spec. Four plain values in the render. Nothing in between survives.',
  },
  bindings: {
    component: 'BoundInput',
    spec: BIND_SPEC,
    seed: { form: { draft: '' } },
    watch: 'Type in the field and watch /form/draft below it. The component never calls the store.',
  },
  children: {
    component: 'CardBox',
    spec: CHILD_SPEC,
    seed: {},
    watch: 'Everything in the card body arrived as ctx.children, already rendered.',
  },
  slots: {
    component: 'SlotCard',
    spec: SLOT_SPEC,
    seed: {},
    watch: 'Three regions, drawn whether or not the spec filled them.',
  },
  on: {
    component: 'EventButton',
    spec: ON_SPEC,
    seed: { clicks: 0 },
    watch: 'The button is enabled only because the element names an action for press. Press it — the count moves.',
    wiring: true,
  },
  emit: {
    component: 'CounterButton',
    spec: EMIT_SPEC,
    seed: { clicks: 0 },
    watch: 'Press the button: emit → on.press → the bump handler → /clicks → the readout above it.',
    wiring: true,
  },
  loading: {
    component: 'StreamCard',
    spec: STREAM_FRAMES[STREAM_FRAMES.length - 1],
    seed: {},
    watch: 'Run the stream. The pulsing bars are this component choosing what to draw while loading is true.',
  },
  fallback: {
    component: 'CardBox',
    spec: HOLE_SPEC,
    seed: {},
    watch: 'Retype one of the rows to a name this registry has never heard of.',
  },
  renderer: {
    component: 'StreamCard',
    spec: RENDERER_SPEC,
    seed: { clicks: 0 },
    watch: 'One spec, one state. Everything that changes below is an argument to <Renderer>, not a change to the document.',
  },
};

/** Per-stage view state, reset the moment the stage changes. */
interface Live {
  focus: string;
  text: string;
  /** null when not streaming; otherwise the frame index. */
  streamAt: number | null;
  streamed: boolean;
  withFallback: boolean;
  nullSpec: boolean;
  forceLoading: boolean;
  wireframe: boolean;
  sawUnbound: boolean;
  sawClicks: boolean;
  sawWireframe: boolean;
  sawNull: boolean;
  sawLoading: boolean;
}

function fresh(focus: string): Live {
  return {
    focus,
    text: JSON.stringify((LESSONS[focus] ?? LESSONS.props).spec, null, 2),
    streamAt: null,
    streamed: false,
    withFallback: false,
    nullSpec: false,
    forceLoading: false,
    wireframe: false,
    sawUnbound: false,
    sawClicks: false,
    sawWireframe: false,
    sawNull: false,
    sawLoading: false,
  };
}

export function useRegistryInspector(focus = 'props') {
  const lesson = LESSONS[focus] ?? LESSONS.props;

  /**
   * Derived, not stored.
   *
   * Arriving at a stage has to bring that stage's spec, state and toggles in
   * the SAME render, not in an effect afterwards — one frame of the previous
   * stage's spec is enough to tick the new stage's assignment by accident.
   */
  const [saved, setSaved] = useState<Live>(() => fresh(focus));
  const live = saved.focus === focus ? saved : fresh(focus);
  const patch = (p: Partial<Live>) => setSaved({ ...live, ...p });

  const store = useMemo(() => createStateStore(structuredClone(lesson.seed)), [lesson]);
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);

  /* The action handlers built by defineRegistry, given a way to write to this
     stage's store. This is the third thing defineRegistry returns. */
  const handlers = useMemo(
    () =>
      lessonHandlers(
        () => (updater) => {
          const next = updater(store.getSnapshot());
          store.update(Object.fromEntries(Object.entries(next).map(([k, v]) => [`/${k}`, v])));
        },
        store.getSnapshot,
      ),
    [store],
  );

  const streaming = live.streamAt !== null && live.streamAt < STREAM_FRAMES.length - 1;
  const specText = live.streamAt !== null ? JSON.stringify(STREAM_FRAMES[live.streamAt], null, 2) : live.text;

  const parsed = useMemo(() => {
    try {
      return JSON.parse(specText) as Spec;
    } catch {
      return null;
    }
  }, [specText]);

  /* Advance the emulated stream. Slow on purpose: the skeleton is the lesson,
     and at real speed it is one frame nobody sees. */
  useEffect(() => {
    if (live.streamAt === null || live.streamAt >= STREAM_FRAMES.length - 1) return;
    const at = live.streamAt;
    const t = setTimeout(() => setSaved((prev) => (prev.streamAt === at ? { ...prev, streamAt: at + 1 } : prev)), 900);
    return () => clearTimeout(t);
  }, [live.streamAt]);

  /* Two latches, so a stage that asks you to undo something stays cleared. */
  const rootEl = parsed?.elements?.[parsed.root];
  /* The `on` stage's subject is the button, which is a child of the card. */
  const eventEl = parsed?.elements?.btn ?? rootEl;
  const onEmpty = Object.keys((eventEl?.on ?? {}) as Record<string, unknown>).length === 0;
  const clicks = Number(snapshot.clicks ?? 0);

  useEffect(() => {
    if (focus === 'on' && onEmpty && !live.sawUnbound) patch({ sawUnbound: true });
    if (clicks > 0 && !live.sawClicks) patch({ sawClicks: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus, onEmpty, clicks]);

  const code = [
    `// the catalog entry — what a ${lesson.component} node may carry`,
    INSPECTOR_CATALOG[lesson.component] ?? '',
    '',
    `// the registry entry — what it renders as`,
    (live.wireframe ? WIREFRAME_ENTRIES : INSPECTOR_ENTRIES)[lesson.component] ?? '',
  ].join('\n');

  /* On the action stages the component is the small half: what a press MEANS
     is configured in four other places, and none of them is on screen unless
     this is. */
  const wiring = lesson.wiring ? INSPECTOR_ACTION_WIRING : null;

  usePublishSetup({
    spec: parsed,
    seed: lesson.seed,
    handlers: ['bump'],
    sources: [
      { label: `${lesson.component} · the catalog entry and the function that renders it`, code, lang: 'tsx' },
      ...(wiring
        ? [{ label: 'the action path · catalog → registry → handlers → provider', code: wiring, lang: 'tsx' }]
        : []),
      {
        label: "this lab's whole catalog + registry · components/lab/registry-inspector.tsx",
        code: LAB_SETUPS['components/lab/registry-inspector.tsx'] ?? '',
        lang: 'tsx',
      },
    ],
  });

  /* ---------------------------------------------------- the assignments --- */

  const propCount = Object.keys((rootEl?.props ?? {}) as Record<string, unknown>).length;
  const boundIsExpr = typeof (rootEl?.props as Record<string, unknown> | undefined)?.value === 'object';
  const childCount = (rootEl?.children ?? []).length;
  const slots = (rootEl?.slots ?? {}) as Record<string, string[]>;
  const draft = String((snapshot.form as Record<string, unknown> | undefined)?.draft ?? '');
  const pressAction = ((eventEl?.on?.press ?? {}) as { action?: string }).action;
  const emitAction = ((parsed?.elements?.btn?.on?.press ?? {}) as { action?: string }).action;
  const unknownTypes = Object.values(parsed?.elements ?? {}).filter((el) => !(el.type in lessonRegistry));

  const items: ChecklistItem[] = [
    /* ---- props ---- */
    {
      label: (
        <>
          The spec writes this component four props in four different forms. The render shows four plain values. Add a
          fifth prop, in any form you like, and watch it arrive as a plain value too.
        </>
      ),
      done: propCount >= 5,
      hint: 'Rule: the renderer resolves EVERY key of element.props before it calls you — including keys the catalog never declared. A component cannot tell a literal from a binding by looking at props, because by then there is nothing left to look at.',
      steps: [
        <>
          Read the spec: <code>label</code> is a literal, <code>owner</code> is <code>$state</code>,{' '}
          <code>badge</code> is <code>$cond</code>, <code>caption</code> is <code>$template</code>.
        </>,
        <>
          Read the render: four strings. <code>badge</code> is <code>&quot;ADMIN&quot;</code>, not the{' '}
          <code>$cond</code> object that produced it.
        </>,
        <>
          The <strong>state</strong> panel is where <code>$state</code> and <code>$template</code> read from —{' '}
          <code>/user/name</code> is <code>&quot;Ada&quot;</code>.
        </>,
        <>
          Add <code>{'"yours": { "$template": "admin? ${/user/admin}" }'}</code> to the props and watch a fifth row
          appear.
        </>,
      ],
      apply: { label: 'add a fifth prop', run: () => patch({ text: JSON.stringify(PROPS_PLUS, null, 2) }) },
    },

    /* ---- bindings, two parts ---- */
    {
      label: (
        <>
          Type in the field. <code>props.value</code> is the value; <code>bindings.value</code> is the path it came
          from — watch <code>/form/draft</code> in the state panel change on every keystroke.
        </>
      ),
      done: draft.length > 0,
      hint: 'Rule: useBoundProp(value, path) rejoins the two halves. The component never imports the store and never knows which path it wrote to.',
      steps: [
        <>
          Click the input and type. The <code>you typed:</code> line follows it.
        </>,
        <>
          Watch the <strong>state</strong> panel: <code>form.draft</code> is the same string.
        </>,
        <>
          The spec says <code>{'"value": { "$bindState": "/form/draft" }'}</code>. That is the entire wiring.
        </>,
      ],
      apply: { label: 'type it for me', run: () => store.set('/form/draft', 'written by the assignment') },
    },
    {
      label: (
        <>
          Now replace the <code>$bindState</code> with a plain string. <code>bindings</code> empties, and the input
          goes natively read-only.
        </>
      ),
      done: rootEl !== undefined && !boundIsExpr,
      hint: 'Rule: only $bindState (and $bindItem) populate bindings. With no entry there, useBoundProp has nowhere to write and setValue is a silent no-op — the "my input will not type" bug, seen from inside.',
      steps: [
        <>
          Find <code>{'"value": { "$bindState": "/form/draft" }'}</code>.
        </>,
        <>
          Replace it with <code>&quot;typed by hand&quot;</code>.
        </>,
        <>
          The field greys out: this component reads <code>bindings.value</code> and sets <code>readOnly</code> when
          there is none, rather than accepting keystrokes it cannot save.
        </>,
      ],
      apply: { label: 'make it a literal', run: () => patch({ text: JSON.stringify(BIND_LITERAL, null, 2) }) },
    },

    /* ---- children ---- */
    {
      label: (
        <>
          Everything in the card body arrived as <code>children</code>. Add a third row to the card&rsquo;s{' '}
          <code>children</code> array and watch it render.
        </>
      ),
      done: childCount >= 3,
      hint: 'Rule: children is already-rendered React, not element keys. Your component decides where to put it and can do nothing else with it — it cannot count it, filter it or read its props. Watch the two empty shapes: no children key gives you undefined, "children": [] gives you an empty array.',
      steps: [
        <>
          Add <code>&quot;r3&quot;</code> to the card&rsquo;s <code>children</code> array.
        </>,
        <>
          Define it: <code>{'"r3": { "type": "Row", "props": { "text": "Tax — $5.20" }, "children": [] }'}</code>.
        </>,
        <>
          A third line appears in the body. Read the component: it renders <code>{'{children}'}</code> in one place and
          that is all it does with them.
        </>,
        <>
          Now empty the array to <code>[]</code>. The card says <code>children is an empty array</code> — not{' '}
          <code>undefined</code>, which is what you get only when the element has no <code>children</code> key at
          all. A placeholder written as <code>{'children ?? <Empty/>'}</code> catches one of those two and silently
          never appears for the other.
        </>,
      ],
      apply: { label: 'add a third row', run: () => patch({ text: JSON.stringify(CHILD_PLUS, null, 2) }) },
    },

    /* ---- slots, two parts ---- */
    {
      label: (
        <>
          This card draws three regions, filled or not. Fill the empty <code>footer</code> one from the spec —{' '}
          <code>foot</code> is already defined and waiting.
        </>
      ),
      done: (slots.footer ?? []).length > 0,
      hint: 'Rule: slots maps a DECLARED slot name to child keys. An unfilled slot never reaches the component at all — slots.footer is undefined rather than an empty node — so a plain `slots?.footer ?? fallback` is enough here, unlike children.',
      steps: [
        <>
          Find <code>{'"slots": { "header": ["head"] }'}</code> on the card.
        </>,
        <>
          Make it <code>{'"slots": { "header": ["head"], "footer": ["foot"] }'}</code>.
        </>,
        <>
          The dashed <strong>slots.footer</strong> region fills. Where it sits on screen is the component&rsquo;s
          decision; that it exists at all is the catalog&rsquo;s.
        </>,
      ],
      apply: { label: 'fill the footer', run: () => patch({ text: JSON.stringify(SLOT_FOOTER, null, 2) }) },
    },
    {
      label: (
        <>
          Now the trap. Move the card&rsquo;s <code>children</code> into{' '}
          <code>{'"slots": { "default": [...] }'}</code> — the one slot name that is never yours to write.
        </>
      ),
      done: (slots.default ?? []).length > 0,
      hint: 'Rule: default content travels as children. The renderer does hand slots.default through (with a console warning), so the nodes are not lost — they are simply somewhere no component looks, which is why content "disappears" with no error anywhere.',
      steps: [
        <>
          Set the card&rsquo;s <code>&quot;children&quot;</code> to <code>[]</code>.
        </>,
        <>
          Add <code>&quot;default&quot;: [&quot;body&quot;]</code> to its <code>slots</code> map.
        </>,
        <>
          The middle region goes empty — and nothing else filled. Open the browser console:{' '}
          <code>Use &quot;children&quot; for default slot content</code>. The nodes were delivered; no component
          looks there.
        </>,
      ],
      apply: { label: 'write slots.default', run: () => patch({ text: JSON.stringify(SLOT_DEFAULT, null, 2) }) },
    },

    /* ---- on, two parts ---- */
    {
      label: (
        <>
          Delete the button&rsquo;s <code>on</code> map. It asks <code>on(&apos;press&apos;)</code> before drawing
          itself, so it goes disabled rather than lying.
        </>
      ),
      done: live.sawUnbound || onEmpty,
      hint: 'Rule: on(name) returns { bound, shouldPreventDefault } — it reports, it does not dispatch. Reach for it over emit when the component needs to know whether anything is listening.',
      steps: [
        <>
          Find <code>{'"on": { "press": { "action": "bump" } }'}</code>.
        </>,
        <>
          Change it to <code>{'"on": {}'}</code>.
        </>,
        <>
          <code>bound</code> reads <code>false</code> and the button greys out. The element named no action, so
          there is nothing for a press to mean — and <code>emit</code> would go nowhere if you could press it.
        </>,
      ],
      apply: { label: 'unwire press', run: () => patch({ text: JSON.stringify(ON_UNWIRED, null, 2), sawUnbound: true }) },
    },
    {
      label: (
        <>
          Put it back. The same JSON key is the difference between a live control and a dead one — and no React
          changed in between.
        </>
      ),
      done: live.sawUnbound && !onEmpty && pressAction !== undefined,
      hint: 'Rule: what a component offers is its own business; whether anything listens is the spec’s. That split is why the same button can be live on one screen and absent from another with no new code.',
      steps: [
        <>
          Restore <code>{'"on": { "press": { "action": "bump" } }'}</code>.
        </>,
        <>
          <code>bound</code> goes back to <code>true</code>, the button is enabled again, and pressing it moves the
          count. Same component, same React — one JSON key.
        </>,
      ],
      apply: { label: 'wire it again', run: () => patch({ text: JSON.stringify(ON_SPEC, null, 2) }) },
    },

    /* ---- emit, two parts ---- */
    {
      label: (
        <>
          Press the button. <code>emit(&apos;press&apos;)</code> is the whole component — the count above it moves
          because the SPEC says press means <code>bump</code>.
        </>
      ),
      done: clicks > 0,
      hint: 'Rule: emit is fire-and-forget. It carries no handler and no target, and your component never learns which action ran or whether one did — which is what keeps behaviour in the spec rather than in the React.',
      steps: [
        <>
          Press <strong>press me</strong>. The readout goes up and <code>/clicks</code> changes in the state panel.
        </>,
        <>
          Read the component in the code panel: four lines, and not one of them mentions a counter.
        </>,
        <>
          The increment lives in <code>defineRegistry(..., {'{ actions: { bump } }'})</code>, at the bottom of the
          code panel&rsquo;s file.
        </>,
      ],
      apply: { label: 'press it for me', run: () => void handlers.bump({}) },
    },
    {
      label: (
        <>
          Point the same press at the built-in <code>setState</code> action instead, then press again. The button did
          not change — the sentence about it did.
        </>
      ),
      done: live.sawClicks && emitAction === 'setState' && clicks === 0,
      hint: 'Rule: emit(name) names what the user DID; element.on names what that means. Swapping the second is a spec edit, which is why a model can rewire a screen it cannot recompile.',
      steps: [
        <>
          Press the button a few times first, so there is something to reset.
        </>,
        <>
          Change the button&rsquo;s binding to{' '}
          <code>{'{ "action": "setState", "params": { "statePath": "/clicks", "value": 0 } }'}</code>.
        </>,
        <>
          Press it again: the counter drops to zero. <code>setState</code> is built in — no handler of yours ran at
          all.
        </>,
      ],
      apply: { label: 'repoint it', run: () => patch({ text: JSON.stringify(EMIT_RESET, null, 2) }) },
    },

    /* ---- loading ---- */
    {
      label: (
        <>
          Run the stream. The spec arrives one element at a time with <code>loading</code> true, and the component
          draws pulsing bars for the parts that have not landed.
        </>
      ),
      done: live.streamed,
      hint: 'Rule: loading is one flag forwarded from <Renderer> to every component. Props already present are real; missing ones may simply not have arrived — so a skeleton is honest and an empty box is not.',
      steps: [
        <>
          Press <strong>stream it slowly</strong> above the render.
        </>,
        <>
          Watch the spec panel: each frame is a complete, valid spec with less in it than the next.
        </>,
        <>
          The title is a pulsing bar until it arrives, and two more sit under the rows until the stream ends.
        </>,
        <>
          When <code>loading</code> goes false the bars vanish. That branch is the only thing this component does with
          the flag.
        </>,
      ],
      apply: { label: 'stream it', run: () => patch({ streamAt: 0 }) },
    },

    /* ---- fallback, two parts ---- */
    {
      label: (
        <>
          Retype the middle row to something this registry has never heard of. It leaves a hole between its two
          siblings, with no error.
        </>
      ),
      done: unknownTypes.length > 0,
      hint: 'Rule: type is a registry lookup at render time — registry[element.type] ?? fallback. Nothing about the spec format knows which components you registered, so an unknown name is not a spec error and validateSpec will not catch it.',
      steps: [
        <>
          Change <code>r2</code>&rsquo;s <code>&quot;type&quot;</code> to <code>&quot;Sparkline&quot;</code>.
        </>,
        <>
          The middle row disappears. The card, its siblings and the rest of the page render exactly as before.
        </>,
        <>
          The only trace is a console warning: <code>No renderer for component type: Sparkline</code>.
        </>,
      ],
      apply: { label: 'break a type', run: () => patch({ text: JSON.stringify(HOLE_BROKEN, null, 2) }) },
    },
    {
      label: (
        <>
          Now tick <strong>pass fallback</strong>. The hole becomes a box that names the type it could not find.
        </>
      ),
      done: unknownTypes.length > 0 && live.withFallback,
      hint: 'Rule: fallback is a prop of <Renderer>, not of the provider or the registry, and it is handed the ELEMENT rather than a component context — which is how it can print the missing type. It is a last line, not a check: catalog.validate rejects an unknown name before you ever render.',
      steps: [
        <>
          Leave <code>r2</code> typed <code>&quot;Sparkline&quot;</code>.
        </>,
        <>
          Tick <strong>pass fallback</strong> above the render.
        </>,
        <>
          The red box appears in the hole and names <code>Sparkline</code>.
        </>,
        <>
          Untick it and the hole comes back. The spec never changed — only an argument to the renderer did.
        </>,
      ],
      apply: {
        label: 'wire a fallback',
        run: () => patch({ text: JSON.stringify(HOLE_BROKEN, null, 2), withFallback: true }),
      },
    },

    /* ---- <Renderer>, two parts ---- */
    {
      label: (
        <>
          Switch <code>registry</code> to the wireframe one. Same spec, same state, same props — different functions,
          and the code panel changes with it.
        </>
      ),
      done: live.sawWireframe,
      hint: 'Rule: registry is an argument to the walk, not a property of the document. This lab defines two registries over one catalog; @json-render/react-pdf is a third, drawing these same specs to a PDF.',
      steps: [
        <>
          Tick <strong>registry: wireframe</strong>.
        </>,
        <>
          Every box redraws in mono. Press the button — it still bumps the counter, because <code>on</code> lives in
          the spec, not in either registry.
        </>,
        <>
          Read the code panel: it is now the wireframe implementation of the same catalog entry.
        </>,
      ],
      apply: { label: 'swap the registry', run: () => patch({ wireframe: true, sawWireframe: true }) },
    },
    {
      label: (
        <>
          The other two props. Tick <code>loading</code> and confirm it reaches every component; tick{' '}
          <code>spec={'{null}'}</code> and confirm a spec that has not arrived is not an error.
        </>
      ),
      done: live.sawLoading && live.sawNull,
      hint: 'Rule: <Renderer> takes exactly four props and none of them is state — spec.state is never read and seeding the store is the provider’s job. spec: null renders null, which is the normal state before a generation arrives, so no guard of your own is needed.',
      steps: [
        <>
          Tick <strong>loading</strong>: the card grows skeleton bars. One flag, every component.
        </>,
        <>
          Tick <strong>spec={'{null}'}</strong>: the panel empties. No error, no placeholder, no exception.
        </>,
        <>
          Read the printed call beside the toggles — <code>spec</code>, <code>registry</code>, <code>loading</code>,{' '}
          <code>fallback</code>. That is the entire component.
        </>,
      ],
      apply: {
        label: 'flip both',
        run: () => patch({ forceLoading: true, nullSpec: true, sawLoading: true, sawNull: true }),
      },
    },
  ];

  /* ---------------------------------------------------------- the panels --- */

  const registry = live.wireframe ? wireframeRegistry : lessonRegistry;
  const loading = streaming || live.forceLoading;
  const renderSpec = live.nullSpec ? null : parsed;

  const controls =
    focus === 'loading' ? (
      <Bar>
        <button
          type="button"
          onClick={() => patch({ streamAt: 0, streamed: false })}
          disabled={streaming}
          className="rounded-md bg-brand px-2.5 py-1 text-[12px] text-brand-foreground disabled:bg-muted disabled:text-muted-foreground"
        >
          {streaming ? 'streaming…' : 'stream it slowly'}
        </button>
        <span className="font-mono text-[11.5px] text-muted-foreground">
          frame {(live.streamAt ?? STREAM_FRAMES.length - 1) + 1} of {STREAM_FRAMES.length} · loading={String(loading)}
        </span>
      </Bar>
    ) : focus === 'fallback' ? (
      <Bar>
        <Toggle checked={live.withFallback} onChange={(v) => patch({ withFallback: v })}>
          pass <code className="font-mono">fallback</code>
        </Toggle>
        <span className="ml-auto font-mono text-[11.5px] text-muted-foreground">
          {unknownTypes.length > 0
            ? `${unknownTypes.length} element(s) this registry cannot draw`
            : 'every type in this spec is in the registry'}
        </span>
      </Bar>
    ) : focus === 'renderer' ? (
      <div className="flex flex-col gap-2 rounded-lg border bg-surface px-3 py-2.5">
        <div className="flex flex-wrap items-center gap-4">
          <Toggle checked={live.wireframe} onChange={(v) => patch({ wireframe: v, sawWireframe: v || live.sawWireframe })}>
            registry: wireframe
          </Toggle>
          <Toggle checked={live.forceLoading} onChange={(v) => patch({ forceLoading: v, sawLoading: v || live.sawLoading })}>
            loading
          </Toggle>
          <Toggle checked={live.nullSpec} onChange={(v) => patch({ nullSpec: v, sawNull: v || live.sawNull })}>
            spec={'{null}'}
          </Toggle>
          <Toggle checked={live.withFallback} onChange={(v) => patch({ withFallback: v })}>
            fallback
          </Toggle>
        </div>
        <pre className="overflow-x-auto font-mono text-[11.5px] leading-relaxed text-muted-foreground">
          {[
            '<Renderer',
            pad(live.nullSpec ? 'spec={null}' : 'spec={spec}', 'the tree it walks, from spec.root down'),
            pad(
              live.wireframe ? 'registry={wireframeRegistry}' : 'registry={lessonRegistry}',
              'the lookup: registry[element.type] ?? fallback',
            ),
            pad(`loading={${String(loading)}}`, 'forwarded to every component as ctx.loading'),
            live.withFallback
              ? pad('fallback={UnknownBox}', 'drawn wherever the lookup misses')
              : pad('', 'no fallback → an unknown type is a warning and a hole'),
            '/>',
          ].join('\n')}
        </pre>
      </div>
    ) : null;

  const body = (
    <div className="flex flex-col gap-3">
      <div className="grid gap-3 lg:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-3">
          <Panel
            title={`rendered · <${lesson.component}/>`}
            right={
              <span className="font-mono text-[11px] text-muted-foreground">
                {live.wireframe ? 'wireframe registry' : 'this lab’s registry'}
              </span>
            }
          >
            <div className="border-b bg-muted px-3 py-1.5 text-[12px] leading-relaxed text-muted-foreground">
              {lesson.watch}
            </div>
            {/*
              The provider is keyed on the stage, because `ActionProvider` does
              `useState(initialHandlers)`: it reads `handlers` ONCE, on mount,
              and ignores a new map on every render after that. Each stage here
              builds its own store and its own handlers from it, so without a
              remount the emit stage dispatched into the PREVIOUS stage's store
              — the press ran, the counter did not move, and nothing was
              logged. `SpecPlayground` keys its provider for the same reason.
            */}
            <div className="jr-canvas flex items-start p-4" style={{ minHeight: 230 }}>
              {live.nullSpec || parsed ? (
                <JSONUIProvider key={focus} registry={registry} store={store} handlers={handlers}>
                  <Renderer
                    spec={renderSpec}
                    registry={registry}
                    loading={loading}
                    fallback={live.withFallback ? UnknownBox : undefined}
                  />
                </JSONUIProvider>
              ) : (
                <span className="text-[12px] text-red-600 dark:text-red-400">invalid JSON — the render is paused</span>
              )}
            </div>
          </Panel>

          {controls}

          <Panel title="state · the store this render reads and writes">
            <CodeBlock
              code={Object.keys(snapshot).length ? JSON.stringify(snapshot, null, 2) : '{}  // this stage reads no state'}
              lang="json"
              maxHeight={150}
              showLineNumbers={false}
            />
          </Panel>
        </div>

        <Panel
          title="the spec · edit this"
          right={
            streaming ? <span className="font-mono text-[11px] text-muted-foreground">arriving…</span> : undefined
          }
        >
          <div className="h-[520px]">
            <JsonEditor value={specText} onChange={(t) => patch({ text: t })} readOnly={streaming} />
          </div>
        </Panel>
      </div>

      <Panel
        title={`the code · ${lesson.component}, in this lab’s catalog and registry`}
        right={<CopyButton text={code} />}
      >
        <CodeBlock code={code} lang="tsx" maxHeight={360} />
      </Panel>

      {wiring && (
        <Panel
          title="the action path · what makes “bump” a thing a press can mean"
          right={<CopyButton text={wiring} />}
        >
          <div className="border-b bg-muted px-3 py-1.5 text-[12px] leading-relaxed text-muted-foreground">
            The component above has no idea any of this exists. Five places, and none of them is inside it.
          </div>
          <CodeBlock code={wiring} lang="tsx" maxHeight={420} />
        </Panel>
      )}
    </div>
  );

  return { items, body };
}

/** Props on the left, what each one does on the right. */
function pad(prop: string, note: string) {
  return `  ${prop}`.padEnd(32) + `// ${note}`;
}

function Bar({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-surface px-3 py-2">{children}</div>;
}

function Toggle({
  checked,
  onChange,
  children,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-1.5 text-[13px] text-muted-foreground">
      <input
        type="checkbox"
        className="size-3.5 accent-orange-500"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      {children}
    </label>
  );
}
