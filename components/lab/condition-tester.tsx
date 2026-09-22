'use client';

import type { Spec, UIElement, VisibilityCondition } from '@json-render/core';
import { createStateStore, defineCatalog, evaluateVisibility, validateSpec } from '@json-render/core';
import { defineRegistry, JSONUIProvider, Renderer, useBoundProp } from '@json-render/react';
import { schema } from '@json-render/react/schema';
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { z } from 'zod';
import { COND_CATALOG, COND_ENTRIES, LAB_SETUPS, LIB_BLOCKS } from '@/lib/demo/source.generated';
import { usePublishSetup } from '@/lib/labs/setup';
import { CodeBlock } from '../playground/code-block';
import { JsonEditor } from '../playground/json-editor';
import { CopyButton, Panel } from '../playground/ui';
import type { ChecklistItem } from './checklist';
import { StageFrame } from './stage-frame';
import { stagesFromChecklist } from '@/lib/labs/types';
import { useInitialStage } from '@/lib/labs/use-initial-stage';

/**
 * One way of DEFINING a condition per stage, on a tree you can operate.
 *
 * This lab used to be a truth table: one condition textarea, evaluated against
 * six fixed state models. It was compact and it taught the grammar, but every
 * row was a word — `shown` / `hidden` — for an element that never existed, and
 * the state it ran against was a constant you could not touch.
 *
 * Now the condition sits on a real element in a real spec, and the state it
 * reads is driven by controls in the render beside it. Flip the switch and the
 * element leaves the page. The component behind it contains no `if`: the
 * renderer asks `evaluateVisibility` before it ever calls one, which is the
 * whole point and is on screen in the code panel.
 */

const condCatalog = defineCatalog(schema, {
  components: {
    Board: {
      description: 'A titled column. Everything in this lab hangs off one.',
      props: z.object({ title: z.string() }),
      slots: ['default'],
    },
    Toggle: {
      description: 'A checkbox bound to a boolean path, so a condition has something to react to.',
      props: z.object({ label: z.string(), checked: z.unknown().nullable() }),
      slots: [],
    },
    Choice: {
      description: 'A row of buttons writing one of its options to a bound path.',
      props: z.object({ label: z.string(), value: z.unknown().nullable(), options: z.array(z.string()) }),
      slots: [],
    },
    Stepper: {
      description: 'A number with plus and minus, bound to a path.',
      props: z.object({ label: z.string(), value: z.unknown().nullable() }),
      slots: [],
    },
    Note: {
      description: 'The thing whose existence is in question. Carries no condition of its own.',
      props: z.object({ text: z.string(), tone: z.enum(['plain', 'good']).nullable() }),
      slots: [],
    },
    Row: {
      description: 'One row of a repeat, for conditions scoped to an item.',
      props: z.object({ text: z.unknown().nullable(), badge: z.unknown().nullable() }),
      slots: [],
    },
  },
  actions: {},
});

const { registry: condRegistry } = defineRegistry(condCatalog, {
  components: {
    Board: ({ props, children }) => (
      <div className="w-full overflow-hidden rounded-lg border bg-background">
        <div className="border-b bg-muted px-3 py-2 text-[13px] font-medium text-foreground">{props.title}</div>
        <div className="flex flex-col gap-2 p-3">{children}</div>
      </div>
    ),

    Toggle: ({ props, bindings }) => {
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

    Choice: ({ props, bindings }) => {
      const [value, setValue] = useBoundProp<string>(props.value as string, bindings?.value);
      return (
        <div className="flex w-full flex-wrap items-center gap-2 rounded-md border bg-surface px-3 py-2 text-[13px]">
          <span className="text-muted-foreground">{props.label}</span>
          {props.options.map((option) => (
            <button
              key={option || '(unset)'}
              type="button"
              onClick={() => setValue(option === '' ? (null as unknown as string) : option)}
              className={`rounded-sm border px-2 py-0.5 font-mono text-[12px] ${
                (value ?? '') === option ? 'bg-brand text-brand-foreground' : 'bg-background text-muted-foreground'
              }`}
            >
              {option === '' ? '(unset)' : option}
            </button>
          ))}
        </div>
      );
    },

    Stepper: ({ props, bindings }) => {
      const [value, setValue] = useBoundProp<number>(props.value as number, bindings?.value);
      const n = Number(value ?? 0);
      return (
        <div className="flex w-full items-center gap-2 rounded-md border bg-surface px-3 py-2 text-[13px]">
          <span className="text-muted-foreground">{props.label}</span>
          <button
            type="button"
            onClick={() => setValue(n - 1)}
            className="rounded-sm border bg-background px-2 py-0.5 font-mono text-[12px]"
          >
            −
          </button>
          <span className="w-8 text-center font-mono tabular-nums text-foreground">{n}</span>
          <button
            type="button"
            onClick={() => setValue(n + 1)}
            className="rounded-sm border bg-background px-2 py-0.5 font-mono text-[12px]"
          >
            +
          </button>
        </div>
      );
    },

    // Not one `if` in here, and no access to the condition that decided
    // whether it runs at all. By the time this function is called the answer
    // was already yes.
    Note: ({ props }) => (
      <div
        className={`w-full rounded-md border px-3 py-2 text-[13px] ${
          props.tone === 'good'
            ? 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300'
            : 'bg-surface text-foreground'
        }`}
      >
        {props.text}
      </div>
    ),

    Row: ({ props }) => (
      <div className="flex w-full items-center gap-3 rounded-md border bg-surface px-2.5 py-1.5 font-mono text-[12.5px] text-foreground">
        <span>{String(props.text ?? '')}</span>
        {props.badge != null && (
          <span className="ml-auto rounded-sm border px-1.5 py-0.5 text-[11px] text-muted-foreground">
            {String(props.badge)}
          </span>
        )}
      </div>
    ),
  },
});

const SEED = {
  flag: true,
  status: 'active',
  count: 5,
  tab: null,
  invoices: [
    { id: 'a', ref: 'INV-041', status: 'unpaid' },
    { id: 'b', ref: 'INV-042', status: 'paid' },
    { id: 'c', ref: 'INV-043', status: 'unpaid' },
  ],
};

/* --------------------------------------------------------- spec helpers --- */

const toggle = (label: string, path: string): UIElement => ({
  type: 'Toggle',
  props: { label, checked: { $bindState: path } },
  children: [],
});

const choice = (label: string, path: string, options: string[]): UIElement => ({
  type: 'Choice',
  props: { label, value: { $bindState: path }, options },
  children: [],
});

const stepper = (label: string, path: string): UIElement => ({
  type: 'Stepper',
  props: { label, value: { $bindState: path } },
  children: [],
});

const note = (text: string, visible?: VisibilityCondition): UIElement => ({
  type: 'Note',
  props: { text, tone: 'good' },
  children: [],
  ...(visible === undefined ? {} : { visible }),
});

/** A board with controls and one conditional note under them. */
function board(title: string, controls: Record<string, UIElement>, target: UIElement): Spec {
  return {
    root: 'board',
    elements: {
      board: { type: 'Board', props: { title }, children: [...Object.keys(controls), 'target'] },
      ...controls,
      target,
    },
  };
}

/* ---------------------------------------------------------- the lessons --- */

const WHERE = board('visible sits beside props, not inside it', { flag: toggle('/flag', '/flag') }, note('I am here while /flag is true', { $state: '/flag' }));

/** …with the condition moved into props, where nothing reads it. */
const WHERE_WRONG: Spec = {
  root: 'board',
  elements: {
    ...WHERE.elements,
    target: {
      type: 'Note',
      props: { text: 'I am here while /flag is true', tone: 'good', visible: { $state: '/flag' } },
      children: [],
    },
  },
};

const TRUTHY = board('a bare pointer is a truthiness test', { count: stepper('/count', '/count') }, note('/count is truthy', { $state: '/count' }));

const OPERATOR = board(
  'one operator key per condition',
  { status: choice('/status', '/status', ['active', 'draft', 'void']) },
  note('/status is exactly "active"', { $state: '/status', eq: 'active' }),
);

const OPERATOR_NEQ: Spec = {
  root: 'board',
  elements: {
    ...OPERATOR.elements,
    target: note('/status is anything but "draft"', { $state: '/status', neq: 'draft' }),
  },
};

const NOT = board(
  'not: true flips the whole test',
  { flag: toggle('/flag', '/flag') },
  note('/flag is NOT truthy', { $state: '/flag', not: true }),
);

const NOT_OPERATOR: Spec = {
  root: 'board',
  elements: {
    ...NOT.elements,
    flag: choice('/status', '/status', ['active', 'draft', 'void']),
    target: note('/status is NOT "active"', { $state: '/status', eq: 'active', not: true }),
  },
};

const ARRAY = board(
  'an array is an implicit AND',
  { flag: toggle('/flag', '/flag'), count: stepper('/count', '/count') },
  note('/flag AND /count > 4', [{ $state: '/flag' }, { $state: '/count', gt: 4 }]),
);

const NESTED = board(
  '$or and $and nest as deep as you like',
  { status: choice('/status', '/status', ['active', 'draft', 'void']), count: stepper('/count', '/count') },
  note('draft, OR active with more than 4', {
    $or: [{ $state: '/status', eq: 'draft' }, { $and: [{ $state: '/status', eq: 'active' }, { $state: '/count', gt: 4 }] }],
  }),
);

const UNSET = board(
  'the unset-path idiom',
  { tab: choice('/tab', '/tab', ['', 'home', 'settings']) },
  note('the Home pane — shown when /tab is "home" OR nothing at all', {
    $or: [{ $state: '/tab', eq: 'home' }, { $state: '/tab', not: true }],
  }),
);

/** A repeat, so a condition can be scoped to the row it is on. */
function list(title: string, rowVisible: VisibilityCondition, badge: unknown = { $item: 'status' }): Spec {
  return {
    root: 'board',
    elements: {
      board: { type: 'Board', props: { title }, children: ['list'] },
      list: {
        type: 'Board',
        props: { title: 'repeat over /invoices' },
        children: ['row'],
        repeat: { statePath: '/invoices', key: 'id' },
      },
      row: {
        type: 'Row',
        props: { text: { $item: 'ref' }, badge },
        children: [],
        visible: rowVisible,
      },
    },
  };
}

const ITEM = list('$item reads the row this element is on', { $item: 'status', eq: 'unpaid' });
const ITEM_PAID: Spec = {
  root: 'board',
  elements: { ...ITEM.elements, row: { ...ITEM.elements.row, visible: { $item: 'status', eq: 'paid' } } },
};

const INDEX = list('$index reads the position', { $index: true, gt: 0 }, { $index: true });
const INDEX_FIRST: Spec = {
  root: 'board',
  elements: { ...INDEX.elements, row: { ...INDEX.elements.row, visible: { $index: true, eq: 0 } } },
};

const LITERAL = board(
  'a literal true or false',
  { flag: toggle('/flag — ignored by this condition', '/flag') },
  note('visible: true — nothing can hide me', true),
);

const LITERAL_FALSE: Spec = {
  root: 'board',
  elements: { ...LITERAL.elements, target: note('visible: false — nothing can show me', false) },
};

const MALFORMED = board(
  'two ways to be malformed, neither of them an error',
  { count: stepper('/count', '/count') },
  note('an operator nobody implemented', { $state: '/count', greaterThan: 4 } as unknown as VisibilityCondition),
);

const MALFORMED_2: Spec = {
  root: 'board',
  elements: {
    ...MALFORMED.elements,
    target: note('no $-key at all', { status: 'active' } as unknown as VisibilityCondition),
  },
};

interface Lesson {
  /** Which registry entries the code panel shows. */
  components: string[];
  spec: Spec;
  /** One line above the render: what to watch. */
  watch: string;
  /** Also show `evaluateVisibility` itself — the function doing the deciding. */
  source?: boolean;
}

const LESSONS: Record<string, Lesson> = {
  where: {
    components: ['Note', 'Toggle'],
    spec: WHERE,
    watch: 'Flip the switch. The note is not hidden with CSS — it is never rendered.',
    source: true,
  },
  truthy: {
    components: ['Note'],
    spec: TRUTHY,
    watch: 'Step the count down to 0 and watch a number become a boolean.',
  },
  operator: { components: ['Choice', 'Note'], spec: OPERATOR, watch: 'One key does the comparing. Change which key it is.' },
  not: { components: ['Note'], spec: NOT, watch: '`not` is a sibling key, not a wrapper — it flips whatever the rest decided.' },
  array: { components: ['Note'], spec: ARRAY, watch: 'Two conditions in a list. Both have to hold.' },
  nested: { components: ['Note'], spec: NESTED, watch: 'Draft always shows it; active needs the count as well.' },
  unset: { components: ['Choice', 'Note'], spec: UNSET, watch: 'Press (unset): the pane is still there, because nothing chose a tab yet.' },
  item: { components: ['Row'], spec: ITEM, watch: 'One Row element, three invoices, and only the rows whose own status matches.' },
  index: { components: ['Row'], spec: INDEX, watch: 'The condition is on the row; $index is what tells the copies apart.' },
  literal: { components: ['Note'], spec: LITERAL, watch: 'No pointer, no state, nothing to flip.' },
  malformed: {
    components: ['Note'],
    spec: MALFORMED,
    watch: 'Both of these are wrong. Neither throws, and neither is hidden — read the strip under the render.',
  },
};

const CONDITION_STAGES = [
  {
    id: 'where',
    focus: 'where',
    title: 'visible is an element field',
    concept: 'visible-grammar',
    when:
      'Use `visible` when the element should not exist — a panel for admins, a row for unpaid invoices. Use a `$cond` prop when it should exist and merely read differently, and do the work in the host when the data itself should not reach the browser: a hidden element is absent from the DOM but its condition, and therefore the shape of your state, is right there in the spec.',
    ref: 'el-visible',
    refs: ['util-evaluatevisibility'],
    // What "not visible" actually means: absent, not display:none.
    also: ['hidden-is-unmounted'],
    tasks: 2,
  },
  {
    id: 'truthy',
    focus: 'truthy',
    title: 'A bare pointer is truthiness',
    when:
      'The shortest form, and right whenever the path already holds a boolean. Reach for an explicit operator the moment it holds a number or a string, because `0` and `""` are falsy and will hide an element that you meant to show — the reason a count of zero is the classic disappearing panel.',
    ref: 'cond-truthy',
  },
  {
    id: 'operator',
    focus: 'operator',
    title: 'One operator key, six choices',
    concept: 'one-operator',
    when:
      'Pick the operator that says what you mean and stop there: a condition object holds exactly one of `eq`, `neq`, `gt`, `gte`, `lt`, `lte`. Two in one object is not an AND — the first match wins and the other is ignored silently, so an array is the only way to say "and".',
    ref: 'cond-eq',
    refs: ['cond-neq', 'cond-gt', 'cond-gte', 'cond-lt', 'cond-lte'],
    tasks: 2,
  },
  {
    id: 'not',
    focus: 'not',
    title: 'not: true negates the rest',
    when:
      'Cheaper than inventing the opposite operator, and the only way to negate a truthiness test. Prefer the direct operator when one exists — `neq` reads better than `eq` plus `not` — and never stack `not` with `$or` expecting De Morgan: it negates only the object it sits in.',
    ref: 'cond-not',
    tasks: 2,
  },
  {
    id: 'array',
    focus: 'array',
    title: 'An array is an implicit AND',
    when:
      'Two or three independent requirements that all have to hold. Past that, `$and` reads better because it can be named and nested; and if you find yourself writing the same array on six elements, put the answer in state once and point at it instead.',
    ref: 'cond-and',
  },
  {
    id: 'nested',
    focus: 'nested',
    title: '$or and $and nest',
    when:
      'Any rule that is genuinely a sentence: "draft, or active with a balance". Keep it to two levels — a model has to produce this, and a three-level condition is where generated specs start being wrong in ways nothing reports. Deeper than that belongs in a computed flag in state.',
    ref: 'cond-or',
    refs: ['cond-helpers'],
  },
  {
    id: 'unset',
    focus: 'unset',
    title: 'The unset-path idiom',
    concept: 'first-tab-idiom',
    when:
      'Whenever "nothing chosen yet" has to mean the same as one of the choices — the first tab, the default filter, an empty search. The alternative is seeding the state so the path is never unset, which is usually better when you control the seed and impossible when a model wrote the spec.',
    ref: 'cond-truthy',
  },
  {
    id: 'item',
    focus: 'item',
    title: '$item reads the repeat row',
    when:
      'Filtering rows inside a repeat, where the test is about the row itself. Outside a repeat it is `undefined` and the row quietly vanishes; and when the list is long, filtering the array in state beats rendering a hundred elements that evaluate to hidden.',
    ref: 'cond-item',
  },
  {
    id: 'index',
    focus: 'index',
    title: '$index reads the position',
    when:
      'Position-only rules: hiding a separator on the first row, showing a "more" row after the fifth. Never use it to single out a record — the index moves the moment the array changes, where a test on the row’s own id does not.',
    ref: 'cond-index',
  },
  {
    id: 'literal',
    focus: 'literal',
    title: 'A literal true or false',
    when:
      '`false` is the useful one: a kill switch on an element you are not ready to delete, and the fastest way to bisect a spec that renders wrong. `true` is worth writing only to say "deliberately unconditional" — omitting `visible` entirely means exactly the same thing.',
    ref: 'cond-literal',
    tasks: 2,
  },
  {
    id: 'malformed',
    focus: 'malformed',
    title: 'Two ways to be malformed',
    concept: 'malformed-is-truthy',
    when:
      'Nothing to reach for — this is the check to run. `validateSpec` is the only thing in the library that reports a malformed condition, so run it on every spec you did not write by hand, and treat `invalid_visible` as a hard failure rather than a warning: the alternative is an element that is visible to everyone.',
    ref: 'util-validatespec',
    // The second malformed case IS a pointer edge case: no $-key means no
    // path, and no path means the whole state model.
    also: ['pointer-edge-cases'],
    tasks: 2,
  },
];

/** Per-stage view state, reset the moment the stage changes. */
interface Live {
  focus: string;
  text: string;
  /** Latches, for stages that ask you to see both answers. */
  sawTrue: boolean;
  sawFalse: boolean;
}

function fresh(focus: string): Live {
  return { focus, text: JSON.stringify((LESSONS[focus] ?? LESSONS.where).spec, null, 2), sawTrue: false, sawFalse: false };
}

function useConditionsLab(focus = 'where') {
  const lesson = LESSONS[focus] ?? LESSONS.where;

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

  /** The element this stage's condition sits on. */
  const targetKey = parsed?.elements?.target ? 'target' : parsed?.elements?.row ? 'row' : null;
  const condition = targetKey ? (parsed?.elements?.[targetKey] as UIElement | undefined)?.visible : undefined;

  /**
   * The same call the renderer makes, on the same state — so the strip under
   * the render cannot disagree with the render.
   */
  const verdict = useMemo(() => {
    if (!parsed || targetKey === 'row') return null;
    try {
      return evaluateVisibility(condition, { stateModel: snapshot });
    } catch (e) {
      return (e as Error).message;
    }
  }, [condition, snapshot, parsed, targetKey]);

  /** validateSpec is the only thing that reports a malformed condition. */
  const issues = useMemo(() => {
    if (!parsed) return [];
    try {
      return (validateSpec(parsed).issues ?? []).filter((i) => /visible/.test(i.code));
    } catch {
      return [];
    }
  }, [parsed]);

  useEffect(() => {
    if (verdict === true && !live.sawTrue) patch({ sawTrue: true });
    if (verdict === false && !live.sawFalse) patch({ sawFalse: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [verdict]);

  const code = [
    ...lesson.components.flatMap((name) => [
      `// the catalog entry — what a ${name} node may carry`,
      COND_CATALOG[name] ?? '',
      '',
      `// the registry entry — and note there is no 'if' anywhere in it`,
      COND_ENTRIES[name] ?? '',
      '',
    ]),
    ...(lesson.source
      ? [
          '// @json-render/core — the function that decides, before any of the above runs',
          LIB_BLOCKS.evaluateVisibility ?? '',
        ]
      : []),
  ]
    .join('\n')
    .trim();

  usePublishSetup({
    spec: parsed,
    seed: SEED,
    sources: [
      { label: `${lesson.components.join(' + ')} · the entries behind this render`, code, lang: 'tsx' },
      {
        label: "this lab's whole catalog + registry · components/lab/condition-tester.tsx",
        code: LAB_SETUPS['components/lab/condition-tester.tsx'] ?? '',
        lang: 'tsx',
      },
    ],
  });

  /* ---------------------------------------------------- the assignments --- */

  const cond = (condition ?? null) as Record<string, unknown> | boolean | null;
  const isObj = typeof cond === 'object' && cond !== null && !Array.isArray(cond);
  const keys = isObj ? Object.keys(cond as Record<string, unknown>) : [];
  const rowVisible = (parsed?.elements?.row?.visible ?? null) as Record<string, unknown> | null;
  const propsHasVisible = Object.values(parsed?.elements ?? {}).some(
    (el) => el.props !== undefined && 'visible' in (el.props as Record<string, unknown>),
  );
  const shownRows = (() => {
    if (targetKey !== 'row' || !parsed) return [];
    const rows = (snapshot.invoices ?? []) as Array<Record<string, unknown>>;
    return rows.filter((item, index) => {
      try {
        return evaluateVisibility(parsed.elements.row.visible, {
          stateModel: snapshot,
          repeatItem: item,
          repeatIndex: index,
        });
      } catch {
        return false;
      }
    });
  })();

  const items: ChecklistItem[] = [
    /* ---- where, two parts ---- */
    {
      label: (
        <>
          Flip the switch and watch the note leave the page. <code>visible</code> decides whether the element
          exists at all — the component behind it is never called.
        </>
      ),
      done: live.sawTrue && live.sawFalse,
      hint: 'Rule: visible is a top-level element field, evaluated by evaluateVisibility before the renderer looks anything up in the registry. A hidden element is not display:none — it and its whole subtree are absent.',
      steps: [
        <>
          Press the <code>/flag</code> switch. The green note disappears.
        </>,
        <>
          Read the strip under the render: <code>evaluateVisibility</code> went to <code>false</code>.
        </>,
        <>
          Open the code panel: the <code>Note</code> component has no condition, no <code>if</code>, and no way to
          ask. That decision happened above it.
        </>,
      ],
      apply: { label: 'flip it for me', run: () => store.set('/flag', !snapshot.flag) },
    },
    {
      label: (
        <>
          Now move <code>&quot;visible&quot;</code> inside <code>props</code>. Nothing reads it there, so the note
          becomes unconditional — and only <code>validateSpec</code> notices.
        </>
      ),
      done: propsHasVisible,
      hint: 'Rule: visible, on, repeat and watch are element fields, never props. Put one in props and it is inert data handed to your component, which is why a generated spec with this mistake renders "fine" and ignores every rule you wrote.',
      steps: [
        <>
          Cut the <code>&quot;visible&quot;</code> line off the <code>target</code> element.
        </>,
        <>
          Paste it inside that element&rsquo;s <code>&quot;props&quot;</code> object instead.
        </>,
        <>
          The note is now always there — flip the switch and nothing happens.
        </>,
        <>
          Read the red strip: <code>visible_in_props</code>. That is the only report you get anywhere.
        </>,
      ],
      apply: { label: 'put it in props', run: () => patch({ text: JSON.stringify(WHERE_WRONG, null, 2) }) },
    },

    /* ---- truthy ---- */
    {
      label: (
        <>
          Step <code>/count</code> down to <code>0</code>. A bare pointer is a JavaScript truthiness test, so a
          perfectly good number hides the element.
        </>
      ),
      done: live.sawFalse && Number(snapshot.count) === 0,
      hint: 'Rule: { "$state": path } with no operator is Boolean(value). 0, "", null and undefined are all falsy — [] and {} are not. If the path holds anything but a boolean, say what you mean with an operator.',
      steps: [
        <>
          Press <strong>−</strong> until the count reads <code>0</code>.
        </>,
        <>
          The note vanishes, and the strip reads <code>false</code>.
        </>,
        <>
          Fix it honestly: change the condition to <code>{'{ "$state": "/count", "gte": 0 }'}</code> and it stays.
        </>,
      ],
      apply: { label: 'zero it', run: () => store.set('/count', 0) },
    },

    /* ---- operator, two parts ---- */
    {
      label: (
        <>
          Press each status. The condition tests <code>eq: &quot;active&quot;</code> — change it to{' '}
          <code>neq: &quot;draft&quot;</code> and watch which selections keep the note.
        </>
      ),
      done: isObj && 'neq' in (cond as Record<string, unknown>),
      hint: 'Rule: one condition object carries exactly one comparison key — eq, neq, gt, gte, lt, lte. They are vocabulary, not six different features: the shape never changes.',
      steps: [
        <>
          With <code>eq: &quot;active&quot;</code>, only <strong>active</strong> shows the note.
        </>,
        <>
          Change the key to <code>&quot;neq&quot;</code> and the value to <code>&quot;draft&quot;</code>.
        </>,
        <>
          Now <strong>active</strong> and <strong>void</strong> both show it, and only <strong>draft</strong> hides
          it.
        </>,
      ],
      apply: { label: 'switch to neq', run: () => patch({ text: JSON.stringify(OPERATOR_NEQ, null, 2) }) },
    },
    {
      label: (
        <>
          Now put <em>two</em> operators in one object — <code>eq</code> and <code>neq</code> together. It is not an
          AND, and nothing tells you which one lost.
        </>
      ),
      done: keys.filter((k) => ['eq', 'neq', 'gt', 'gte', 'lt', 'lte'].includes(k)).length >= 2,
      hint: 'Rule: evaluateCondition checks the operator keys in order and returns on the first one present. A second operator in the same object is dead JSON — the array form is the only way to say "and".',
      steps: [
        <>
          Add <code>&quot;neq&quot;: &quot;void&quot;</code> beside the existing operator.
        </>,
        <>
          Press <strong>void</strong>: the note behaves as if you had written only the first key.
        </>,
        <>
          To mean both, write them as two objects in an array — that is the next stage but one.
        </>,
      ],
      apply: {
        label: 'add a second operator',
        run: () =>
          patch({
            text: JSON.stringify(
              {
                root: 'board',
                elements: {
                  ...OPERATOR.elements,
                  target: note('two operators, one of them ignored', {
                    $state: '/status',
                    eq: 'active',
                    neq: 'void',
                  } as VisibilityCondition),
                },
              },
              null,
              2,
            ),
          }),
      },
    },

    /* ---- not, two parts ---- */
    {
      label: (
        <>
          <code>not: true</code> is a sibling key. Flip the switch: the note is here exactly when <code>/flag</code>{' '}
          is <em>not</em> truthy.
        </>
      ),
      done: live.sawTrue && live.sawFalse,
      hint: 'Rule: `not` negates whatever the rest of the object decided, including an operator. It is the only way to negate a bare truthiness test, since there is no "falsy" operator.',
      steps: [
        <>
          <code>/flag</code> starts <code>true</code>, so the note starts hidden.
        </>,
        <>
          Press the switch: <code>/flag</code> goes false and the note appears.
        </>,
      ],
      apply: { label: 'flip it', run: () => store.set('/flag', !snapshot.flag) },
    },
    {
      label: (
        <>
          Now negate an <em>operator</em>: <code>{'{ "$state": "/status", "eq": "active", "not": true }'}</code>.
          Same key, applied to the comparison instead of the truthiness.
        </>
      ),
      done: isObj && (cond as Record<string, unknown>).not === true && keys.some((k) => k === 'eq' || k === 'neq'),
      hint: 'Rule: `not` wraps the whole object, so eq + not is exactly neq. Prefer the direct operator when one exists — this form earns its place when negating $or, $and or a bare pointer.',
      steps: [
        <>
          Replace the condition with an <code>eq</code> test on <code>/status</code> plus <code>not: true</code>.
        </>,
        <>
          Press each status: it now shows for everything except <strong>active</strong>.
        </>,
        <>
          That is <code>neq: &quot;active&quot;</code> written the long way.
        </>,
      ],
      apply: { label: 'negate an operator', run: () => patch({ text: JSON.stringify(NOT_OPERATOR, null, 2) }) },
    },

    /* ---- array ---- */
    {
      label: (
        <>
          Two conditions in a list. Turn the switch off, or drop the count to 4, and the note goes — either one is
          enough.
        </>
      ),
      done: live.sawTrue && live.sawFalse,
      hint: 'Rule: an array is evaluated with .every(), so it is an AND with no keyword. There is no implicit OR — that needs $or by name.',
      steps: [
        <>
          Both hold on arrival: <code>/flag</code> is true and <code>/count</code> is 5.
        </>,
        <>
          Press <strong>−</strong> once. <code>/count</code> is 4, <code>gt: 4</code> is false, the note goes.
        </>,
        <>
          Put it back and turn the switch off instead. Same result, other reason.
        </>,
      ],
      apply: { label: 'break one of them', run: () => store.set('/count', 4) },
    },

    /* ---- nested ---- */
    {
      label: (
        <>
          A real sentence: <em>draft, or active with more than four</em>. Find the two different ways to make it
          appear.
        </>
      ),
      done: live.sawTrue && live.sawFalse,
      hint: 'Rule: $or takes .some(), $and takes .every(), and both recurse through evaluateVisibility — so either can hold arrays, objects or more $or/$and. Keep it to two levels; a model has to produce this.',
      steps: [
        <>
          Press <strong>draft</strong>: shown, whatever the count says.
        </>,
        <>
          Press <strong>active</strong> and drop the count to 4: hidden.
        </>,
        <>
          Step the count back to 5: shown again, through the other branch.
        </>,
      ],
      apply: { label: 'take the other branch', run: () => store.set('/status', 'draft') },
    },

    /* ---- unset ---- */
    {
      label: (
        <>
          Press <strong>(unset)</strong>, then <strong>settings</strong>, then <strong>home</strong>. The Home pane
          is there for two of the three — which is the whole trick.
        </>
      ),
      done: live.sawTrue && live.sawFalse,
      hint: 'Rule: "no tab chosen" and "the first tab" have to mean the same thing, and no pointer says that on its own. $or of an eq and a not-truthy is the idiom; seeding /tab in the store is the alternative, and is not available when a model wrote the spec.',
      steps: [
        <>
          On arrival <code>/tab</code> is <code>null</code> and the pane is shown — by the second branch.
        </>,
        <>
          Press <strong>settings</strong>: hidden. Neither branch holds.
        </>,
        <>
          Press <strong>home</strong>: shown again, by the first branch this time.
        </>,
      ],
      apply: { label: 'go to settings', run: () => store.set('/tab', 'settings') },
    },

    /* ---- item ---- */
    {
      label: (
        <>
          One <code>Row</code> element, three invoices, and a condition about the row itself. Flip it to{' '}
          <code>paid</code> and the other row appears instead.
        </>
      ),
      done: rowVisible !== null && rowVisible.eq === 'paid',
      hint: 'Rule: inside a repeat, $item resolves against the current row, so one element with one condition filters the list. Outside a repeat $item is undefined and the element quietly vanishes.',
      steps: [
        <>
          Two rows are on screen: <code>INV-041</code> and <code>INV-043</code>, the unpaid ones.
        </>,
        <>
          Change <code>&quot;eq&quot;: &quot;unpaid&quot;</code> to <code>&quot;paid&quot;</code>.
        </>,
        <>
          Now only <code>INV-042</code> is there. The spec still holds exactly one Row.
        </>,
      ],
      apply: { label: 'show the paid one', run: () => patch({ text: JSON.stringify(ITEM_PAID, null, 2) }) },
    },

    /* ---- index ---- */
    {
      label: (
        <>
          <code>$index</code> is position. Change <code>gt: 0</code> to <code>eq: 0</code> and keep only the first
          row.
        </>
      ),
      done: rowVisible !== null && rowVisible.eq === 0,
      hint: 'Rule: $index is zero-based and only exists inside a repeat. Use it for position — a separator, a "first" badge — never to identify a record, because it moves when the array does.',
      steps: [
        <>
          <code>{'{ "$index": true, "gt": 0 }'}</code> drops row zero: two rows remain, badged 1 and 2.
        </>,
        <>
          Change <code>&quot;gt&quot;</code> to <code>&quot;eq&quot;</code>.
        </>,
        <>
          One row, badged <code>0</code>.
        </>,
      ],
      apply: { label: 'keep only the first', run: () => patch({ text: JSON.stringify(INDEX_FIRST, null, 2) }) },
    },

    /* ---- literal, two parts ---- */
    {
      label: (
        <>
          <code>visible: true</code> reads no state at all — the switch does nothing. Change it to{' '}
          <code>false</code> and the element is gone for good.
        </>
      ),
      done: condition === false,
      hint: 'Rule: evaluateVisibility returns a boolean condition as-is, and an absent one as true. So `visible: true` and no `visible` key are the same thing, and `false` is a kill switch you can leave in the document.',
      steps: [
        <>
          Press the switch a few times: nothing moves.
        </>,
        <>
          Change <code>&quot;visible&quot;: true</code> to <code>false</code>.
        </>,
        <>
          The note is gone and no state can bring it back.
        </>,
      ],
      apply: { label: 'set it to false', run: () => patch({ text: JSON.stringify(LITERAL_FALSE, null, 2) }) },
    },
    {
      label: (
        <>
          Now delete the <code>&quot;visible&quot;</code> key entirely. Identical to <code>true</code> — which is
          why writing <code>true</code> is only ever a note to the next reader.
        </>
      ),
      done: condition === undefined && parsed?.elements?.target !== undefined,
      hint: 'Rule: `if (condition === undefined) return true` is the first line of evaluateVisibility. An element with no condition is unconditional, so the only reason to write `true` is to say you meant it.',
      steps: [
        <>
          Remove the whole <code>&quot;visible&quot;</code> line from <code>target</code>.
        </>,
        <>
          The note is back, and the strip under the render says <code>true</code>.
        </>,
      ],
      apply: {
        label: 'delete the key',
        run: () =>
          patch({
            text: JSON.stringify(
              { root: 'board', elements: { ...LITERAL.elements, target: note('no visible key at all') } },
              null,
              2,
            ),
          }),
      },
    },

    /* ---- malformed, two parts ---- */
    {
      label: (
        <>
          An operator nobody implemented. It is not an error and it is not hidden — the unknown key is ignored and
          the condition degrades to a truthiness test on the path.
        </>
      ),
      done: live.sawTrue && Number(snapshot.count) === 0,
      hint: 'Rule: evaluateCondition looks for the operators it knows and falls through to Boolean(value) when it finds none. A misspelt operator therefore behaves like a bare pointer, which is right about half the time by accident.',
      steps: [
        <>
          <code>greaterThan: 4</code> is not an operator. The note is shown because <code>/count</code> is 5 —
          truthy.
        </>,
        <>
          Step the count to <code>0</code> and it hides. That is the truthiness test, not your comparison.
        </>,
        <>
          Read the red strip: <code>invalid_visible</code>, from <code>validateSpec</code>. Nothing else reports it.
        </>,
      ],
      apply: { label: 'zero the count', run: () => store.set('/count', 0) },
    },
    {
      label: (
        <>
          The worse one: an object with no <code>$</code>-key at all. It tests the whole state model, which is
          always truthy — <strong>visible to everyone, forever</strong>.
        </>
      ),
      done: isObj && keys.length > 0 && !keys.some((k) => k.startsWith('$')),
      hint: 'Rule: with no $state, $item or $index, there is no path to read, so the value under test is the state model itself — an object, and therefore truthy. This is the shape a model produces when it guesses, and it is the reason to run validateSpec on generated specs.',
      steps: [
        <>
          Replace the condition with <code>{'{ "status": "active" }'}</code>.
        </>,
        <>
          The note is shown. Change <code>/status</code> with the controls — nothing you do hides it.
        </>,
        <>
          <code>invalid_visible</code> again, and again it is the only warning anywhere.
        </>,
      ],
      apply: { label: 'drop the $-key', run: () => patch({ text: JSON.stringify(MALFORMED_2, null, 2) }) },
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
            <div className="jr-canvas flex items-start p-4" style={{ minHeight: 230 }}>
              {parsed ? (
                <JSONUIProvider registry={condRegistry} store={store}>
                  <Renderer spec={parsed} registry={condRegistry} />
                </JSONUIProvider>
              ) : (
                <span className="text-[12px] text-red-600 dark:text-red-400">invalid JSON — the render is paused</span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2 border-t bg-surface px-3 py-1.5 font-mono text-[11.5px]">
              <span className="text-muted-foreground">evaluateVisibility →</span>
              {targetKey === 'row' ? (
                <span className="text-foreground">
                  {shownRows.length} of {((snapshot.invoices ?? []) as unknown[]).length} rows pass
                </span>
              ) : typeof verdict === 'string' ? (
                <span className="text-red-600 dark:text-red-400">threw: {verdict}</span>
              ) : (
                <span className={verdict ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}>
                  {String(verdict)}
                </span>
              )}
              <span className="ml-auto truncate text-muted-foreground">
                {condition === undefined ? 'no visible key — unconditional' : JSON.stringify(condition)}
              </span>
            </div>
            {issues.length > 0 && (
              <div className="border-t bg-red-50 px-3 py-1.5 font-mono text-[11.5px] text-red-600 dark:bg-red-950 dark:text-red-400">
                {issues.map((i) => (
                  <div key={i.code + i.message}>
                    {i.code}: {i.message}
                  </div>
                ))}
              </div>
            )}
          </Panel>

          <Panel title="state · what these conditions read">
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
        <CodeBlock code={code} lang="tsx" maxHeight={380} />
      </Panel>
    </div>
  );

  return { items, body };
}

/**
 * The lab, staged.
 *
 * One hook for the whole page: the rail's assignment and the panels beside it
 * are computed from the same parsed spec and the same store.
 */
export function ConditionTester() {
  const opening = useInitialStage(CONDITION_STAGES.length);
  const [focus, setFocus] = useState<string>(() => CONDITION_STAGES[opening]?.focus ?? 'where');
  const lab = useConditionsLab(focus);
  const stages = stagesFromChecklist(lab.items, CONDITION_STAGES);

  return (
    <StageFrame slug="conditions" stages={stages} onStageChange={(stage) => setFocus(stage.focus ?? 'where')}>
      {() => lab.body}
    </StageFrame>
  );
}
