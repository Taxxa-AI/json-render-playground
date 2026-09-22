'use client';

import type { ComputedFunction, Spec, UIElement } from '@json-render/core';
import { createStateStore, defineCatalog } from '@json-render/core';
import { defineRegistry, JSONUIProvider, Renderer, useBoundProp } from '@json-render/react';
import { schema } from '@json-render/react/schema';
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { z } from 'zod';
import { EXPR_CATALOG, EXPR_ENTRIES, EXPR_FUNCTIONS, LAB_SETUPS } from '@/lib/demo/source.generated';
import { usePublishSetup } from '@/lib/labs/setup';
import { CodeBlock } from '../playground/code-block';
import { JsonEditor } from '../playground/json-editor';
import { CopyButton, Panel } from '../playground/ui';
import type { ChecklistItem } from './checklist';
import { StageFrame } from './stage-frame';
import { stagesFromChecklist } from '@/lib/labs/types';
import { useInitialStage } from '@/lib/labs/use-initial-stage';

/**
 * One expression form per stage, each on a real tree.
 *
 * This lab used to be a REPL beside a separate demo: you read what
 * `resolvePropValue` returned for an expression in one tab, and a spec that
 * used all six forms at once in another. Neither showed the thing that
 * matters — THIS expression, in THIS prop, reaching THIS component.
 *
 * So every stage now carries its own spec, its own state and its own
 * components, and each component prints the value it was handed next to that
 * value's JS type. The expression is in the spec you edit; the result is in
 * the box beside it; the function that received it is underneath.
 */

/** Registered `$computed` functions. A name that is not here resolves to undefined. */
const FUNCTIONS: Record<string, ComputedFunction> = {
  initials: (a) => `${String(a.first ?? '').charAt(0)}${String(a.last ?? '').charAt(0)}`.toUpperCase(),
  money: (a) =>
    new Intl.NumberFormat('en-IE', { style: 'currency', currency: String(a.currency ?? 'EUR') }).format(
      Number(a.value ?? 0),
    ),
};

const exprCatalog = defineCatalog(schema, {
  components: {
    Stack: {
      description: 'A titled column. Repeats its children when the element carries a repeat.',
      props: z.object({ title: z.string() }),
      slots: ['default'],
    },
    Field: {
      description: 'Prints one resolved prop and its JS type. Never renders it — so an object is visible, not fatal.',
      props: z.object({ label: z.string(), value: z.unknown().nullable() }),
      slots: [],
    },
    Sentence: {
      description: 'A line of prose built from a prop.',
      props: z.object({ text: z.unknown().nullable() }),
      slots: [],
    },
    Row: {
      description: 'One row of a repeat: a position and a value.',
      props: z.object({ position: z.unknown().nullable(), text: z.unknown().nullable() }),
      slots: [],
    },
    Switch: {
      description: 'A checkbox bound to a boolean path, so the state an expression reads can be changed on screen.',
      props: z.object({ label: z.string(), checked: z.unknown().nullable() }),
      slots: [],
    },
  },
  actions: {},
});

/**
 * What the component was handed, printed rather than rendered.
 *
 * `undefined` has to be visible as itself: it is the outcome of three
 * different mistakes and it renders as nothing at all, which is exactly why
 * people read it as a styling bug.
 */
function shown(value: unknown) {
  if (value === undefined) return <span className="text-yellow-600 dark:text-yellow-400">undefined</span>;
  if (value === '') return <span className="text-muted-foreground">&quot;&quot; (empty string)</span>;
  if (typeof value === 'string') return <span className="text-foreground">{value}</span>;
  return <span className="text-foreground">{JSON.stringify(value)}</span>;
}

function typeOf(value: unknown) {
  if (value === undefined) return 'undefined';
  if (value === null) return 'null';
  return Array.isArray(value) ? 'array' : typeof value;
}

const { registry: exprRegistry } = defineRegistry(exprCatalog, {
  components: {
    Stack: ({ props, children }) => (
      <div className="w-full overflow-hidden rounded-lg border bg-background">
        <div className="border-b bg-muted px-3 py-2 text-[13px] font-medium text-foreground">{props.title}</div>
        <div className="flex flex-col gap-2 p-3">{children}</div>
      </div>
    ),

    // The prop is already a value. This component cannot tell which expression
    // produced it, or whether one did — so printing its type is the closest
    // anything gets to seeing the resolution from the inside.
    Field: ({ props }) => (
      <div className="flex w-full items-baseline gap-3 rounded-md border bg-surface px-3 py-2 font-mono text-[12.5px]">
        <span className="shrink-0 text-muted-foreground">{props.label}</span>
        <span className="ml-auto truncate">{shown(props.value)}</span>
        <span className="w-[68px] shrink-0 text-right text-[11px] text-muted-foreground">{typeOf(props.value)}</span>
      </div>
    ),

    Sentence: ({ props }) => (
      <p className="w-full rounded-md border bg-surface px-3 py-2 text-[13px] leading-relaxed text-foreground">
        {String(props.text ?? '')}
      </p>
    ),

    Row: ({ props }) => (
      <div className="flex w-full items-baseline gap-3 rounded-md border bg-surface px-2.5 py-1.5 font-mono text-[12.5px]">
        <span className="w-8 shrink-0 text-muted-foreground">{shown(props.position)}</span>
        <span>{shown(props.text)}</span>
      </div>
    ),

    Switch: ({ props, bindings }) => {
      const [on, setOn] = useBoundProp<boolean>(props.checked as boolean, bindings?.checked);
      return (
        <label className="flex w-full cursor-pointer items-center gap-2 rounded-md border bg-surface px-3 py-2 text-[13px] text-foreground">
          <input
            type="checkbox"
            checked={Boolean(on)}
            onChange={(e) => setOn(e.target.checked)}
            className="size-3.5 accent-orange-500"
          />
          {props.label}
        </label>
      );
    },

  },
});

const SEED = {
  user: { first: 'Ada', last: 'Lovelace', plan: 'pro', admin: true },
  cart: { count: 3, total: 42.5 },
  invoices: [
    { id: 'a', ref: 'INV-041', client: { name: 'Acme Oy' }, amount: 40 },
    { id: 'b', ref: 'INV-042', client: { name: 'Borealis AB' }, amount: 12 },
  ],
};

const field = (label: string, value: unknown): UIElement => ({ type: 'Field', props: { label, value }, children: [] });

/* ------------------------------------------------------------- the specs --- */

const STATE_SPEC: Spec = {
  root: 'stack',
  elements: {
    stack: { type: 'Stack', props: { title: '$state — one path, read-only' }, children: ['a', 'b', 'c'] },
    a: field('"/user/first"', { $state: '/user/first' }),
    b: field('"" — the whole model', { $state: '' }),
    c: field('"/user/nope/deep"', { $state: '/user/nope/deep' }),
  },
};

const STATE_PLUS: Spec = {
  root: 'stack',
  elements: {
    ...STATE_SPEC.elements,
    stack: { ...STATE_SPEC.elements.stack, children: ['a', 'b', 'c', 'd'] },
    d: field('"/cart/total"', { $state: '/cart/total' }),
  },
};

const STATE_DOTTED: Spec = {
  root: 'stack',
  elements: {
    ...STATE_PLUS.elements,
    stack: { ...STATE_SPEC.elements.stack, children: ['a', 'b', 'c', 'd', 'e'] },
    e: field('"user.first" — not a pointer', { $state: 'user.first' }),
  },
};

const TEMPLATE_SPEC: Spec = {
  root: 'stack',
  elements: {
    stack: { type: 'Stack', props: { title: '$template — text with holes in it' }, children: ['line', 'num'] },
    line: {
      type: 'Sentence',
      props: { text: { $template: 'Hi ${/user/first}, you have ${/cart/count} items' } },
      children: [],
    },
    num: field('/cart/count via $state', { $state: '/cart/count' }),
  },
};

const TEMPLATE_PLUS: Spec = {
  root: 'stack',
  elements: {
    ...TEMPLATE_SPEC.elements,
    line: {
      ...TEMPLATE_SPEC.elements.line,
      props: { text: { $template: 'Hi ${/user/first}, you have ${/cart/count} items worth ${/cart/total}' } },
    },
  },
};

const TEMPLATE_TYPE: Spec = {
  root: 'stack',
  elements: {
    ...TEMPLATE_PLUS.elements,
    stack: { ...TEMPLATE_SPEC.elements.stack, children: ['line', 'num', 'str'] },
    str: field('/cart/count via $template', { $template: '${/cart/count}' }),
  },
};

const COND_SPEC: Spec = {
  root: 'stack',
  elements: {
    stack: { type: 'Stack', props: { title: '$cond — one condition, two values' }, children: ['sw', 'badge'] },
    sw: { type: 'Switch', props: { label: '/user/admin', checked: { $bindState: '/user/admin' } }, children: [] },
    badge: field('role', { $cond: { $state: '/user/admin' }, $then: 'ADMIN', $else: 'guest' }),
  },
};

const COND_NO_ELSE: Spec = {
  root: 'stack',
  elements: {
    ...COND_SPEC.elements,
    badge: field('role', { $cond: { $state: '/user/admin' }, $then: 'ADMIN' }),
  },
};

const COMPUTED_SPEC: Spec = {
  root: 'stack',
  elements: {
    stack: { type: 'Stack', props: { title: '$computed — your function, called by name' }, children: ['ini'] },
    ini: field('initials(first, last)', {
      $computed: 'initials',
      args: { first: { $state: '/user/first' }, last: { $state: '/user/last' } },
    }),
  },
};

const COMPUTED_PLUS: Spec = {
  root: 'stack',
  elements: {
    ...COMPUTED_SPEC.elements,
    stack: { ...COMPUTED_SPEC.elements.stack, children: ['ini', 'mon'] },
    mon: field('money(total)', { $computed: 'money', args: { value: { $state: '/cart/total' }, currency: 'EUR' } }),
  },
};

const COMPUTED_MISSING: Spec = {
  root: 'stack',
  elements: {
    ...COMPUTED_PLUS.elements,
    ini: field('initialz(first, last) — not registered', {
      $computed: 'initialz',
      args: { first: { $state: '/user/first' }, last: { $state: '/user/last' } },
    }),
  },
};

const ITEM_SPEC: Spec = {
  root: 'page',
  elements: {
    page: { type: 'Stack', props: { title: '$item — the row you are already inside' }, children: ['list'] },
    list: {
      type: 'Stack',
      props: { title: 'repeat over /invoices' },
      children: ['row'],
      repeat: { statePath: '/invoices' },
    },
    row: { type: 'Row', props: { position: null, text: { $item: 'ref' } }, children: [] },
  },
};

const ITEM_NESTED: Spec = {
  root: 'page',
  elements: {
    ...ITEM_SPEC.elements,
    row: { type: 'Row', props: { position: null, text: { $item: 'client/name' } }, children: [] },
  },
};

const ITEM_OUTSIDE: Spec = {
  root: 'page',
  elements: {
    ...ITEM_NESTED.elements,
    page: { ...ITEM_SPEC.elements.page, children: ['list', 'outside'] },
    outside: field('$item, outside any repeat', { $item: 'ref' }),
  },
};

const INDEX_SPEC: Spec = {
  root: 'page',
  elements: {
    page: { type: 'Stack', props: { title: '$index — position, not identity' }, children: ['list'] },
    list: {
      type: 'Stack',
      props: { title: 'repeat over /invoices' },
      children: ['row'],
      repeat: { statePath: '/invoices' },
    },
    row: { type: 'Row', props: { position: null, text: { $item: 'ref' } }, children: [] },
  },
};

const INDEX_ON: Spec = {
  root: 'page',
  elements: {
    ...INDEX_SPEC.elements,
    row: { type: 'Row', props: { position: { $index: true }, text: { $item: 'ref' } }, children: [] },
  },
};

const INDEX_ZERO: Spec = {
  root: 'page',
  elements: {
    ...INDEX_SPEC.elements,
    row: { type: 'Row', props: { position: { $index: 0 }, text: { $item: 'ref' } }, children: [] },
  },
};

/* ------------------------------------------------------------ the stages --- */

interface Lesson {
  /** Which registry entries the code panel shows for this stage. */
  components: string[];
  spec: Spec;
  /** One line above the render: what to watch. */
  watch: string;
  /** Show the registered `$computed` functions under the components. */
  functions?: boolean;
}

const LESSONS: Record<string, Lesson> = {
  state: {
    components: ['Field'],
    spec: STATE_SPEC,
    watch: 'Three pointers, one component. The type column is what your function actually received.',
  },
  template: {
    components: ['Sentence', 'Field'],
    spec: TEMPLATE_SPEC,
    watch: 'The sentence is one prop. Compare its type with the number below it.',
  },
  cond: {
    components: ['Switch', 'Field'],
    spec: COND_SPEC,
    watch: 'Tick the switch: the state changes, the expression re-resolves, the badge follows.',
  },
  computed: {
    components: ['Field'],
    spec: COMPUTED_SPEC,
    watch: 'The value is whatever your JavaScript returned. The args were resolved before it ran.',
    functions: true,
  },
  item: {
    components: ['Stack', 'Row'],
    spec: ITEM_SPEC,
    watch: 'One Row element in the spec, one per invoice on screen — each resolving $item against its own row.',
  },
  index: {
    components: ['Row'],
    spec: INDEX_SPEC,
    watch: 'The left column prints null until you give it something to resolve.',
  },
};

const EXPR_STAGES = [
  {
    id: 'state',
    title: '$state reads the model',
    when:
      'The default for showing a value that lives outside the element. Reach for `$bindState` the moment a control has to write it back, `$item` when the value belongs to the repeat row you are already inside, and `$template` when the prop is a sentence rather than the value itself. A pointer that leads nowhere gives `undefined` in silence.',
    ref: 'expr-state',
    // `resolvePropValue` is the function behind every stage here, and
    // `el-props` is the field they all live in.
    refs: ['el-props', 'util-resolvepropvalue'],
    focus: 'state',
    tasks: 2,
    summary:
      '`{ "$state": "/a/b" }` is `getByPath(stateModel, pointer)` — RFC 6901 and nothing else. It is the only way a prop reads global state, and it is read-only: writing back needs `$bindState`.',
  },
  {
    id: 'template', title: '$template interpolates', concept: 'template', ref: 'expr-template', focus: 'template',
    tasks: 2,
    when:
      'A prop that mixes literal text with values — a sentence, a label, a summary line. It always produces a STRING, so do not reach for it to feed a number, a boolean or an enum prop like `tone`; plain `$state` keeps the type. A hole that resolves to nothing becomes an empty string rather than an error, so a mistyped pointer merely shortens the sentence.',
  },
  {
    id: 'cond', title: '$cond picks a value', concept: 'cond-expression', ref: 'expr-cond', focus: 'cond',
    tasks: 2,
    // Dropping the $else is the unknown-$-key mechanism in miniature: an
    // object that is not a known form is handed over as itself.
    also: ['unknown-dollar-key'],
    when:
      'Two known alternatives for one prop, chosen with the same condition grammar `visible` uses. If the whole element should come and go, `element.visible` says that better. If there are more than two outcomes, or the branch needs arithmetic, `$computed` is the honest tool — `$cond` nested inside `$cond` turns unreadable fast, and omitting `$else` silently demotes the whole thing to a literal object.',
  },
  {
    id: 'computed', title: '$computed calls your code', concept: 'computed', ref: 'expr-computed', focus: 'computed',
    tasks: 2,
    when:
      'The escape hatch for what pointers cannot say: arithmetic, formatting, date maths, anything derived. Prefer `$template` or `$cond` for anything a MODEL has to produce, because `catalog.prompt()` does not list your functions, so nothing tells it they exist unless you say so in `customRules`. An unregistered name resolves to `undefined` and logs — the one expression failure this library announces.',
  },
  {
    id: 'item', title: '$item reads the row', concept: 'item', ref: 'expr-item', focus: 'item',
    tasks: 2,
    when:
      'Reading a field of the row you are already inside, within a `repeat` and nowhere else. Use an absolute `$state` pointer for anything outside the row, and `$bindItem` when the field is edited rather than displayed. Outside a repeat it resolves to `undefined` with no warning, which looks exactly like a missing field on a real row.',
  },
  {
    id: 'index', title: '$index is a flag', concept: 'index', ref: 'expr-index', focus: 'index',
    tasks: 2,
    when:
      'Position, not identity: numbering a list, hiding a separator on the first row, and the `index` param `removeState` needs. Never use it as a key or to look a record up — it shifts the moment the array changes, where the row’s own id does not. Only exactly `true` makes it an expression; `{ "$index": 1 }` is an ordinary object.',
  },
];

/* ------------------------------------------------------- reading the spec --- */

function props(spec: Spec | null, key: string): Record<string, unknown> {
  return (spec?.elements?.[key]?.props ?? {}) as Record<string, unknown>;
}

/** Every prop value in the spec, so a check can ask "is there one of these anywhere". */
function allValues(spec: Spec | null): unknown[] {
  return Object.values(spec?.elements ?? {}).flatMap((el) => Object.values(el.props ?? {}));
}

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Per-stage view state, reset the moment the stage changes. */
interface Live {
  focus: string;
  text: string;
  /** `$cond` is about state changing under a fixed expression; the latch records that it did. */
  sawToggle: boolean;
}

function fresh(focus: string): Live {
  return {
    focus,
    text: JSON.stringify((LESSONS[focus] ?? LESSONS.state).spec, null, 2),
    sawToggle: false,
  };
}

/**
 * The lab.
 *
 * Written as one hook so the assignment and the panels are computed from the
 * same parsed spec and the same store — the checks below are literally reading
 * what is on screen.
 */
function useExprLab(focus = 'state') {
  const lesson = LESSONS[focus] ?? LESSONS.state;

  /* Derived, not stored: arriving at a stage brings that stage's spec and
     state in the SAME render, so a check cannot tick on the previous one. */
  const [saved, setSaved] = useState<Live>(() => fresh(focus));
  const live = saved.focus === focus ? saved : fresh(focus);
  const patch = (p: Partial<Live>) => setSaved({ ...live, ...p });

  const store = useMemo(() => createStateStore(structuredClone(SEED)), [focus]);
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);

  const parsed = useMemo(() => {
    try {
      return JSON.parse(live.text) as Spec;
    } catch {
      return null;
    }
  }, [live.text]);

  const admin = Boolean((snapshot.user as Record<string, unknown> | undefined)?.admin);
  useEffect(() => {
    if (!admin && !live.sawToggle) patch({ sawToggle: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [admin]);

  const code = [
    ...lesson.components.flatMap((name) => [
      `// the catalog entry — what a ${name} node may carry`,
      EXPR_CATALOG[name] ?? '',
      '',
      `// the registry entry — what it renders as`,
      EXPR_ENTRIES[name] ?? '',
      '',
    ]),
    ...(lesson.functions
      ? ['// the functions map, handed to <JSONUIProvider functions={…}>', EXPR_FUNCTIONS]
      : []),
  ]
    .join('\n')
    .trim();

  usePublishSetup({
    spec: parsed,
    seed: SEED,
    functions: Object.keys(FUNCTIONS),
    sources: [
      { label: `${lesson.components.join(' + ')} · the entries behind this render`, code, lang: 'tsx' },
      {
        label: "this lab's whole catalog + registry · components/lab/expression-repl.tsx",
        code: LAB_SETUPS['components/lab/expression-repl.tsx'] ?? '',
        lang: 'tsx',
      },
    ],
  });

  /* ----------------------------------------------------- the assignments --- */

  const stackChildren = (parsed?.elements?.stack?.children ?? []).length;
  const values = allValues(parsed);
  const templates = values.filter((v) => isObj(v) && typeof v.$template === 'string') as Array<{ $template: string }>;
  const computeds = values.filter((v) => isObj(v) && typeof v.$computed === 'string') as Array<{ $computed: string }>;
  const rowProps = props(parsed, 'row');
  const position = rowProps.position;

  const items: ChecklistItem[] = [
    /* ---- $state, two parts ---- */
    {
      label: (
        <>
          Read the three fields, then add a fourth reading <code>/cart/total</code>. One pointer in, one plain value
          out — and a pointer that leads nowhere gives <code>undefined</code> with no complaint.
        </>
      ),
      done: stackChildren >= 4,
      hint: 'Rule: $state is getByPath(stateModel, pointer) and nothing more. It is read-only — a control that writes back needs $bindState, which is the state step.',
      steps: [
        <>
          Read row one: <code>{'{ "$state": "/user/first" }'}</code> arrives as <code>Ada</code>, type{' '}
          <code>string</code>.
        </>,
        <>
          Row two is the empty pointer <code>&quot;&quot;</code> — the whole state model, type <code>object</code>.
        </>,
        <>
          Row three points at a branch that does not exist: <code>undefined</code>, and nothing anywhere says so.
        </>,
        <>
          Add a fourth element reading <code>/cart/total</code> and put its key in the stack&rsquo;s{' '}
          <code>children</code>.
        </>,
      ],
      apply: { label: 'add /cart/total', run: () => patch({ text: JSON.stringify(STATE_PLUS, null, 2) }) },
    },
    {
      label: (
        <>
          Now add one written the JavaScript way — <code>&quot;user.first&quot;</code>, no leading slash. It is a
          valid pointer for a key that does not exist.
        </>
      ),
      done: values.some((v) => isObj(v) && typeof v.$state === 'string' && v.$state !== '' && !v.$state.startsWith('/')),
      hint: 'Rule: RFC 6901 is key lookup only — no property access, no arithmetic, no method calls. "user.first" asks for a key literally named "user.first", finds nothing, and resolves to undefined.',
      steps: [
        <>
          Add a field whose value is <code>{'{ "$state": "user.first" }'}</code>.
        </>,
        <>
          It renders <code>undefined</code>, exactly like the missing path above it — same symptom, different
          mistake.
        </>,
        <>
          <code>/user/first/length</code> fails the same way: <code>length</code> is looked up as a key on a string.
        </>,
      ],
      apply: { label: 'add the dotted path', run: () => patch({ text: JSON.stringify(STATE_DOTTED, null, 2) }) },
    },

    /* ---- $template, two parts ---- */
    {
      label: (
        <>
          Add a third hole to the sentence — <code>{'${/cart/total}'}</code>. Every <code>${'{…}'}</code> is a
          pointer; everything else is literal text.
        </>
      ),
      done: templates.some((t) => (t.$template.match(/\$\{/g) ?? []).length >= 3),
      hint: 'Rule: ${/absolute} reads the state model; ${bare} reads the repeat item first. A hole that resolves to nothing becomes an empty string, so a typo shortens the sentence instead of breaking it.',
      steps: [
        <>
          Find the <code>$template</code> on the <code>line</code> element.
        </>,
        <>
          Add <code>{' worth ${/cart/total}'}</code> to the end of the string.
        </>,
        <>
          The sentence grows. Now mistype one of the pointers — the hole simply empties.
        </>,
      ],
      apply: { label: 'add a third hole', run: () => patch({ text: JSON.stringify(TEMPLATE_PLUS, null, 2) }) },
    },
    {
      label: (
        <>
          Add a field whose value is <code>{'{ "$template": "${/cart/count}" }'}</code> and compare its type column
          with the <code>$state</code> row above it.
        </>
      ),
      done: templates.length >= 2,
      hint: 'Rule: $template always returns a string. Feeding it to a number prop, a boolean or an enum like `tone` sends the wrong type into a component that will not complain — plain $state keeps the type.',
      steps: [
        <>
          Add a third element to the stack with a <code>$template</code> holding one hole and nothing else.
        </>,
        <>
          Read the two type columns: <code>number</code> for <code>$state</code>, <code>string</code> for{' '}
          <code>$template</code>.
        </>,
        <>
          Same value on screen, different type in the component. That is the whole trap.
        </>,
      ],
      apply: { label: 'add the string one', run: () => patch({ text: JSON.stringify(TEMPLATE_TYPE, null, 2) }) },
    },

    /* ---- $cond, two parts ---- */
    {
      label: (
        <>
          Tick the switch. The expression never changes — the state under it does, and the badge re-resolves on the
          same render.
        </>
      ),
      done: live.sawToggle,
      hint: 'Rule: $cond takes the same condition grammar as element.visible, and all three keys are required. Use it for two known alternatives to ONE prop; when the whole element should come and go, visible says that better.',
      steps: [
        <>
          Read the badge: <code>ADMIN</code>, because <code>/user/admin</code> is <code>true</code>.
        </>,
        <>
          Tick the switch above it — it is a <code>$bindState</code> control writing to that same path.
        </>,
        <>
          The badge becomes <code>guest</code>, and the state panel shows <code>admin: false</code>.
        </>,
      ],
      apply: { label: 'toggle it for me', run: () => store.set('/user/admin', !admin) },
    },
    {
      label: (
        <>
          Delete the <code>$else</code>. The object stops being an expression and falls through to the component as
          itself.
        </>
      ),
      done: values.some((v) => isObj(v) && '$cond' in v && !('$else' in v)),
      hint: 'Rule: $cond, $then and $else are all required. Two out of three is not a partial expression — it is a plain object, resolved key by key and handed over as an object.',
      steps: [
        <>
          Remove the <code>&quot;$else&quot;: &quot;guest&quot;</code> line from the badge.
        </>,
        <>
          The field now prints the raw object, type <code>object</code> — and its sub-values were still resolved, so{' '}
          <code>$cond</code> holds the boolean it read rather than <code>{'{ "$state": … }'}</code>.
        </>,
        <>
          Nothing warned. A component expecting a string just got an object.
        </>,
      ],
      apply: { label: 'drop the $else', run: () => patch({ text: JSON.stringify(COND_NO_ELSE, null, 2) }) },
    },

    /* ---- $computed, two parts ---- */
    {
      label: (
        <>
          Add a second one: <code>money</code>, over <code>/cart/total</code>. Its <code>args</code> are resolved
          before your function is called.
        </>
      ),
      done: computeds.length >= 2,
      hint: 'Rule: $computed names a function in the map you handed the provider, and args are resolved first — so a function only ever sees plain values. catalog.prompt() does not list them, so a model will not use one unless customRules says it exists.',
      steps: [
        <>
          Read the registered functions in the code panel: <code>initials</code> and <code>money</code>.
        </>,
        <>
          Add an element whose value is{' '}
          <code>{'{ "$computed": "money", "args": { "value": { "$state": "/cart/total" }, "currency": "EUR" } }'}</code>
          .
        </>,
        <>
          It renders <code>€42.50</code> — your `Intl.NumberFormat`, run on a number that was a pointer a moment
          earlier.
        </>,
      ],
      apply: { label: 'add money()', run: () => patch({ text: JSON.stringify(COMPUTED_PLUS, null, 2) }) },
    },
    {
      label: (
        <>
          Misspell a function name. This is the one expression failure the library announces — open the console
          beside the blank.
        </>
      ),
      done: computeds.some((c) => !(c.$computed in FUNCTIONS)),
      hint: 'Rule: an unregistered $computed resolves to undefined AND logs the name. Every other road to undefined is silent, which makes a clean console real evidence.',
      steps: [
        <>
          Change <code>&quot;$computed&quot;: &quot;initials&quot;</code> to <code>&quot;initialz&quot;</code>.
        </>,
        <>
          The field goes blank, type <code>undefined</code>.
        </>,
        <>
          Open the browser console: the name you typed is in the warning.
        </>,
      ],
      apply: { label: 'misspell it', run: () => patch({ text: JSON.stringify(COMPUTED_MISSING, null, 2) }) },
    },

    /* ---- $item, two parts ---- */
    {
      label: (
        <>
          One <code>Row</code> element, two rows on screen. Point it at a nested field —{' '}
          <code>{'{ "$item": "client/name" }'}</code>.
        </>
      ),
      done: values.some((v) => isObj(v) && typeof v.$item === 'string' && v.$item.includes('/')),
      hint: 'Rule: $item takes a path INSIDE the current row, with the same slash segments a pointer uses — no leading slash, because it is relative to the item.',
      steps: [
        <>
          Read the spec: <code>list</code> carries <code>{'"repeat": { "statePath": "/invoices" }'}</code>, and{' '}
          <code>row</code> is its only child.
        </>,
        <>
          The renderer renders that one element once per item, resolving <code>$item</code> against a different row
          each time.
        </>,
        <>
          Change <code>{'{ "$item": "ref" }'}</code> to <code>{'{ "$item": "client/name" }'}</code>.
        </>,
      ],
      apply: { label: 'go nested', run: () => patch({ text: JSON.stringify(ITEM_NESTED, null, 2) }) },
    },
    {
      label: (
        <>
          Now use <code>$item</code> where there is no repeat above it. It resolves to <code>undefined</code> — and
          says nothing.
        </>
      ),
      done: parsed?.elements?.outside !== undefined,
      hint: 'Rule: $item is resolved against the repeat scope, and outside one there is no scope to resolve against. The symptom is identical to a field the row does not have, which is why it is worth checking the nesting first.',
      steps: [
        <>
          Add a field to the outer <code>page</code> stack, with the value <code>{'{ "$item": "ref" }'}</code>.
        </>,
        <>
          It renders <code>undefined</code> while the identical expression inside the repeat renders a reference.
        </>,
        <>
          The console stays clean. Nothing in the library considers this a mistake.
        </>,
      ],
      apply: { label: 'put one outside', run: () => patch({ text: JSON.stringify(ITEM_OUTSIDE, null, 2) }) },
    },

    /* ---- $index, two parts ---- */
    {
      label: (
        <>
          Number the rows: set the row&rsquo;s <code>position</code> to <code>{'{ "$index": true }'}</code>.
        </>
      ),
      done: isObj(position) && position.$index === true,
      hint: 'Rule: $index is the row’s position in the repeat, zero-based. Use it for numbering and for the index param removeState needs — never as a key, because it shifts the moment the array changes.',
      steps: [
        <>
          Find <code>&quot;position&quot;: null</code> on the <code>row</code> element.
        </>,
        <>
          Change it to <code>{'{ "$index": true }'}</code>.
        </>,
        <>
          The left column fills with <code>0</code> and <code>1</code> — type <code>number</code>.
        </>,
      ],
      apply: { label: 'number them', run: () => patch({ text: JSON.stringify(INDEX_ON, null, 2) }) },
    },
    {
      label: (
        <>
          Now write <code>{'{ "$index": 0 }'}</code> instead. Only exactly <code>true</code> makes it an expression;
          anything else is an ordinary object.
        </>
      ),
      done: isObj(position) && '$index' in position && position.$index !== true,
      hint: 'Rule: the check is `value.$index === true`, not "has an $index key". { "$index": 0 } looks like it asks for the first row and is in fact a literal object arriving at your component.',
      steps: [
        <>
          Change <code>{'{ "$index": true }'}</code> to <code>{'{ "$index": 0 }'}</code>.
        </>,
        <>
          The column shows the object itself, type <code>object</code>, on every row.
        </>,
        <>
          Same key, one different value, and it stopped being an expression. Nothing warned.
        </>,
      ],
      apply: { label: 'write $index: 0', run: () => patch({ text: JSON.stringify(INDEX_ZERO, null, 2) }) },
    },

  ];

  const body = (
    <div className="flex flex-col gap-3">
      <div className="grid gap-3 lg:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-3">
          <Panel
            title={`rendered · ${lesson.components.map((c) => `<${c}/>`).join(' ')}`}
            right={<span className="font-mono text-[11px] text-muted-foreground">one spec, one store</span>}
          >
            <div className="border-b bg-muted px-3 py-1.5 text-[12px] leading-relaxed text-muted-foreground">
              {lesson.watch}
            </div>
            {/* Keyed on the spec text so an edit rebuilds the tree.
                `ElementErrorBoundary` has no reset: once an element throws it
                renders null for that boundary's whole life, so without a
                remount the crash stage would be a dead end. */}
            <div className="jr-canvas flex items-start p-4" style={{ minHeight: 230 }} key={live.text}>
              {parsed ? (
                <JSONUIProvider registry={exprRegistry} store={store} functions={FUNCTIONS}>
                  <Renderer spec={parsed} registry={exprRegistry} />
                </JSONUIProvider>
              ) : (
                <span className="text-[12px] text-red-600 dark:text-red-400">invalid JSON — the render is paused</span>
              )}
            </div>
          </Panel>

          <Panel title="state · what every pointer here reads">
            <CodeBlock code={JSON.stringify(snapshot, null, 2)} lang="json" maxHeight={190} showLineNumbers={false} />
          </Panel>
        </div>

        <Panel title="the spec · edit this">
          <div className="h-[520px]">
            <JsonEditor value={live.text} onChange={(t) => patch({ text: t })} />
          </div>
        </Panel>
      </div>

      <Panel
        title={`the code · ${lesson.components.join(', ')} in this lab’s catalog and registry`}
        right={<CopyButton text={code} />}
      >
        <CodeBlock code={code} lang="tsx" maxHeight={360} />
      </Panel>
    </div>
  );

  return { items, body };
}

/**
 * The lab, staged.
 *
 * One `useExprLab` for the whole page: the rail's assignment and the panels
 * beside it have to be computed from the same parsed spec and the same store,
 * or a check would be reading something other than what is on screen.
 */
export function ExpressionsLab() {
  const opening = useInitialStage(EXPR_STAGES.length);
  const [focus, setFocus] = useState<string>(() => EXPR_STAGES[opening]?.focus ?? 'state');
  const lab = useExprLab(focus);
  const stages = stagesFromChecklist(lab.items, EXPR_STAGES);

  return (
    <StageFrame slug="expressions" stages={stages} onStageChange={(stage) => setFocus(stage.focus ?? 'state')}>
      {() => lab.body}
    </StageFrame>
  );
}
