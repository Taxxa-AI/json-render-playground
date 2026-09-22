'use client';

import type { DirectiveDefinition, PropResolutionContext, Spec } from '@json-render/core';
import { defineDirective, resolvePropValue } from '@json-render/core';
import { useEffect, useMemo, useRef, useState } from 'react';
import { z } from 'zod';
import { CodeEditor } from '@/lib/build/code-editor';
import { compileBody } from '@/lib/build/compile-fn';
import { deepFind } from '@/lib/demo/spec-query';
import { StepRef } from '@/components/shell/step-ref';
import { SpecPlayground } from '../playground/spec-playground';
import { Code, Panel, Pill } from '../playground/ui';
import type { Task } from './task-list';
import { stagesFromTasks, type Stage } from '@/lib/labs/types';
import { useInitialStage } from '@/lib/labs/use-initial-stage';

/**
 * Directives are the extension point for the expression language itself.
 *
 * `$state`, `$cond`, `$template` and friends are built in and fixed. A
 * directive lets you add your own `$`-prefixed key with its own Zod schema and
 * resolver — and because the resolver receives the resolution context, it can
 * call `resolvePropValue` on its own sub-values and compose with everything
 * else.
 *
 * The bottom half of this lab compiles a directive the learner types, with the
 * same `new Function` caveat as every other editor here: fine locally, never
 * in a product.
 */

const money = defineDirective({
  name: '$money',
  description: 'Format a number as currency.',
  schema: z.object({ $money: z.unknown(), currency: z.string().optional() }),
  resolve: (value, ctx) => {
    const v = value as { $money: unknown; currency?: string };
    const n = Number(resolvePropValue(v.$money, ctx) ?? 0);
    return new Intl.NumberFormat('en-IE', { style: 'currency', currency: v.currency ?? 'EUR' }).format(n);
  },
});

const relative = defineDirective({
  name: '$relative',
  description: 'Render an ISO date as "3 days ago".',
  schema: z.object({ $relative: z.unknown() }),
  resolve: (value, ctx) => {
    const raw = resolvePropValue((value as { $relative: unknown }).$relative, ctx);
    const then = new Date(String(raw)).getTime();
    if (Number.isNaN(then)) return '—';
    const days = Math.round((then - Date.now()) / 86_400_000);
    return new Intl.RelativeTimeFormat('en', { numeric: 'auto' }).format(days, 'day');
  },
});

const join = defineDirective({
  name: '$join',
  description: 'Join an array from state with a separator.',
  schema: z.object({ $join: z.unknown(), sep: z.string().optional() }),
  resolve: (value, ctx) => {
    const v = value as { $join: unknown; sep?: string };
    const arr = resolvePropValue(v.$join, ctx);
    return Array.isArray(arr) ? arr.join(v.sep ?? ', ') : '';
  },
});

const pluralize = defineDirective({
  name: '$plural',
  description: 'Pick a word form based on a count.',
  schema: z.object({ $plural: z.unknown(), one: z.string(), other: z.string() }),
  resolve: (value, ctx) => {
    const v = value as { $plural: unknown; one: string; other: string };
    const n = Number(resolvePropValue(v.$plural, ctx) ?? 0);
    return n === 1 ? v.one : v.other;
  },
});

const AVAILABLE: Array<{ def: DirectiveDefinition; label: string }> = [
  { def: money as DirectiveDefinition, label: '$money' },
  { def: relative as DirectiveDefinition, label: '$relative' },
  { def: join as DirectiveDefinition, label: '$join' },
  { def: pluralize as DirectiveDefinition, label: '$plural' },
];

const SPEC: Spec = {
  root: 'card',
  elements: {
    card: { type: 'Card', props: { title: 'Invoice INV-2041', subtitle: null }, children: ['total', 'due', 'tags', 'count'] },
    total: {
      type: 'Metric',
      props: {
        label: 'Total',
        value: { $money: { $state: '/invoice/total' }, currency: 'EUR' },
        delta: null,
        tone: null,
      },
      children: [],
    },
    due: {
      type: 'Text',
      props: { value: { $template: 'Due ' }, tone: null, size: null },
      children: [],
    },
    tags: {
      type: 'Text',
      props: { value: { $join: { $state: '/invoice/tags' }, sep: ' · ' }, tone: 'info', size: 'sm' },
      children: [],
    },
    count: {
      type: 'Badge',
      props: {
        label: { $plural: { $state: '/invoice/lines' }, one: '1 line item', other: 'several line items' },
        tone: 'neutral',
      },
      children: [],
    },
  },
};

const SEED = {
  invoice: {
    total: 3480.5,
    dueDate: '2026-10-04',
    tags: ['reverse-charge', 'EU', 'Q3'],
    lines: 4,
    collected: 0.734,
  },
};

/** Task 2 finished: the `due` placeholder replaced by the real `$relative` call. */
const SPEC_RELATIVE: Spec = {
  ...SPEC,
  elements: {
    ...SPEC.elements,
    due: {
      type: 'Text',
      props: { value: { $relative: { $state: '/invoice/dueDate' } }, tone: null, size: null },
      children: [],
    },
  },
};

/** Task 3 finished: a directive nested inside the built-in `$cond`. */
const SPEC_COMPOSE: Spec = {
  ...SPEC_RELATIVE,
  elements: {
    ...SPEC_RELATIVE.elements,
    total: {
      type: 'Metric',
      props: {
        label: 'Total',
        value: {
          $cond: { $state: '/invoice/total', gt: 0 },
          $then: { $money: { $state: '/invoice/total' }, currency: 'EUR' },
          $else: 'nothing due',
        },
        delta: null,
        tone: null,
      },
      children: [],
    },
  },
};

const DEFAULT_BODY = `// value is the whole directive object — NOT schema-checked.
// resolvePropValue calls resolve() directly; the schema is prompt
// documentation, never a runtime guard. Validate here if you need it.
// ctx is the full PropResolutionContext — pass it down so sub-values
// can themselves be $state / $item / $cond expressions.
const n = Number(resolvePropValue(value.$pct, ctx) ?? 0);
const digits = Number(value.digits ?? 0);
return (n * 100).toFixed(digits) + '%';`;

/**
 * The five tasks, built outside the component so a script can assert that
 * every `solution` satisfies its own `check` (see the scratchpad verifier).
 * The checks that read lab state — a toggle cycled, a refusal seen — take it
 * through `opts` instead of a closure.
 */
/**
 * Which tabs each stage's feature is visible in, in stage order.
 *
 * Module-level rather than inline because the lab has to hand the SAME list
 * for the stage it OPENS on as the lab's own `panes` prop: `SpecPlayground`
 * seeds its tab from `panes[0]` and only narrows to `stage.panes` when you
 * navigate, so a deep link to `?stage=4` would otherwise land on a tab the
 * stage does not show.
 */
const STAGE_PANES: Array<NonNullable<Stage['panes']>> = [
  ['tree'], // what an unregistered key leaves in resolveElementProps
  ['spec', 'tree'], // write the directive in, read what it resolved to
  ['spec', 'tree'],
  ['spec'], // the lesson is the write-your-own panel; the spec never moves
  ['spec'],
];

/**
 * What this stage is about, beyond the playground.
 *
 * Tokens: a directive label (`$money`, `$relative`, … , `custom`) for the
 * chips in the `registered:` bar, plus `own` (the write-your-own panel),
 * `source` (the generated source), `resolve` (the `$relative` definition),
 * `literal` and `vs-computed` (the two notes at the bottom).
 */
function shows(stage: Stage | undefined, token: string): boolean {
  return !stage?.focus || stage.focus.split(' ').includes(token);
}

/** A panel this stage is not about: named, dimmed, one line — never gone. */
function NotThisStep({ title }: { title: string }) {
  return (
    <Panel title={title} bodyClassName="px-3 py-1.5 opacity-45">
      <span className="font-mono text-[11px] text-muted-foreground">· not this step</span>
    </Panel>
  );
}

/**
 * The lesson half of each stage. Kept beside the task factory because the last
 * stage's snapshot is the learner's OWN directive spec, which only exists once
 * the component has compiled it — so the stages are built per render too.
 */
export function buildDirectiveStages(tasks: Task[], customSpec: Spec) {
  return stagesFromTasks(
    tasks,
    [
      {
        title: 'An unregistered directive',
        when:
          'Add a `$` key to the language when the same transform is vocabulary across many specs and you want a model to write it — `catalog.prompt()` teaches it from the `description`. For a one-off, keep the value formatted in state or use `$computed`. Until it is registered the key is not an error: it falls through as a literal object, which is why an unexplained object in a prop is worth checking against the registry first.',
        concept: 'directive',
        ref: 'expr-directive',
        focus: '$money literal',
        panes: STAGE_PANES[0],
        spec: SPEC,
      },
      {
        title: 'What resolve() is handed',
        when:
          'This settles a design rule: everything a directive needs has to be a key of its own object — `$money` carrying its `currency` — because the resolver gets the expression and the resolution context and no element at all. When the value genuinely depends on a sibling prop, a directive is the wrong shape; pass the inputs explicitly through `$computed`, or do the work in the component that already holds both props.',
        ref: 'util-definedirective',
        // Corrected. This stage used to claim the resolver "resolves with the
        // element it sits on in scope, so it can read sibling props" — the
        // library passes no element at all (`PropResolutionContext` is the
        // state model, the repeat scope, `functions` and `directives`), and
        // nothing on this page ever showed one. The `$relative` source below
        // the playground is the same two arguments, on screen.
        summary:
          '`resolve` is called with two things and no more: the raw object from the spec, and the `PropResolutionContext` — the state model, the repeat scope (`repeatItem`, `repeatIndex`, `repeatBasePath`), the `$computed` functions and the directive registry. There is no element in it, so a directive cannot read a sibling prop; anything it needs has to be a key of its own object. That is why `$money` carries its own `currency`.',
        focus: '$relative resolve',
        panes: STAGE_PANES[1],
        spec: SPEC,
      },
      {
        title: 'Directives compose',
        when:
          'Call `resolvePropValue` on your sub-values unless you can guarantee they are literals — and you cannot, because the next author to touch the spec will nest a `$state` in there. Reading `value.$money` directly works right until they do, and then hands your formatter an expression object instead of a number.',
        concept: 'directive-compose',
        focus: '$money',
        panes: STAGE_PANES[2],
        spec: SPEC_RELATIVE,
      },
      {
        title: 'Shadowing a built-in',
        when:
          'The answer is "do not, and you cannot": `defineDirective` throws on the eight built-in names. Where a built-in almost fits, wrap it under a new name of your own rather than trying to replace it — a page where `$state` means two different things in two corners would be far worse than the error you get.',
        ref: 'util-definedirective',
        summary:
          'Registering a name the library already owns is refused rather than silently honoured. The built-in wins, your definition is dropped, and the error says so — better than a page where `$state` means something different in one corner.',
        focus: 'own',
        panes: STAGE_PANES[3],
        spec: SPEC_COMPOSE,
      },
      {
        title: 'Write your own',
        when:
          'Choose a directive when the thing is a vocabulary item the product reuses — money, dates, units, i18n — since only then does it earn a name, a schema and a line in the prompt. Choose `$computed` for one-off application logic, where a flat call with named args is less ceremony and an unknown name at least warns. The failure modes point the same way: a typo in a `$computed` name logs, a typo in a directive key silently becomes an object React refuses to render.',
        concept: 'directive-vs-computed',
        focus: 'custom own source vs-computed',
        panes: STAGE_PANES[4],
        spec: customSpec,
      },
    ],
    SEED,
  );
}

export function buildDirectiveTasks(opts: {
  moneyCycled: boolean;
  sawShadowError: boolean;
  customOn: boolean;
  customOk: boolean;
  dirName: string;
  customSpec: Spec;
}): Task[] {
  const { moneyCycled, sawShadowError, customOn, customOk, dirName, customSpec } = opts;
  return [
    {
      id: 'cycle-money',
      goal: (
        <>
          Turn <code>$money</code> <strong>off</strong>, read what the Total metric does, then turn it back{' '}
          <strong>on</strong>.
        </>
      ),
      hint: 'An unregistered directive is not undefined — it falls through as a literal object and the component throws.',
      steps: [
        <>
          In the <strong>registered:</strong> bar at the top of the page, click the green{' '}
          <strong>● $money</strong> chip. It turns red and reads <strong>○ $money</strong>.
        </>,
        <>
          Look at <strong>rendered output</strong> on the left: the Total metric is now a red{' '}
          <strong>Metric threw</strong> box, and the three lines under it still render.
        </>,
        <>
          In the <strong>tree</strong> pane on the right, click the <code>total</code> node. In{' '}
          <strong>resolveElementProps · total</strong>, the <code>value</code> row says it{' '}
          <em>resolves to</em> <code>{'{"$money":3480.5,"currency":"EUR"}'}</code> — an object, not a string.
        </>,
        <>
          Click <strong>○ $money</strong> again to register it back.
        </>,
        <>
          Confirm the Total metric reads <code>€3,480.50</code> again and the counter on the right of the{' '}
          <strong>registered:</strong> bar goes up by one.
        </>,
      ],
      check: () => moneyCycled,
    },
    {
      id: 'use-relative',
      goal: (
        <>
          Make the <code>due</code> element use <code>$relative</code> on <code>/invoice/dueDate</code> instead of
          its placeholder <code>$template</code>.
        </>
      ),
      hint: 'Replace the whole props.value with { "$relative": { "$state": "/invoice/dueDate" } }.',
      steps: [
        <>
          Open the <strong>spec json</strong> tab in the right-hand pane.
        </>,
        <>
          Find the <code>due</code> element. Its <code>props.value</code> is the placeholder{' '}
          <code>{'{ "$template": "Due " }'}</code>.
        </>,
        <>
          Replace that whole value with <code>{'{ "$relative": { "$state": "/invoice/dueDate" } }'}</code>.
        </>,
        <>
          Read the status bar under the editor: it stays <strong>validateSpec: clean</strong>.
        </>,
        <>
          Look at <strong>rendered output</strong>: the line under Total now reads a relative date such as{' '}
          <code>in 13 days</code>.
        </>,
      ],
      solution: {
        spec: SPEC_RELATIVE,
        seed: SEED,
        note: (
          <>
            <code>$relative</code> resolves its own sub-value, so <code>$state</code> nests straight inside it.
          </>
        ),
      },
      check: ({ spec }) => {
        const el = spec?.elements?.due;
        return Boolean(el && deepFind(el.props, (n) => '$relative' in n));
      },
    },
    {
      id: 'compose',
      goal: (
        <>
          Nest a directive inside a built-in: put a <code>$money</code> expression in the <code>$then</code>{' '}
          branch of a <code>$cond</code> anywhere in the spec.
        </>
      ),
      hint: 'Directives resolve through resolvePropValue, so they compose in both directions.',
      steps: [
        <>
          Open the <strong>spec json</strong> tab and find the <code>total</code> element.
        </>,
        <>
          Wrap its <code>props.value</code> in a condition:{' '}
          <code>
            {'{ "$cond": { "$state": "/invoice/total", "gt": 0 }, "$then": { "$money": { "$state": "/invoice/total" }, "currency": "EUR" }, "$else": "nothing due" }'}
          </code>
          .
        </>,
        <>
          The status bar under the editor stays <strong>validateSpec: clean</strong>.
        </>,
        <>
          Open the <strong>tree</strong> tab and click <code>total</code>: under{' '}
          <strong>resolveElementProps · total</strong> the <code>value</code> row shows the <code>$cond</code>{' '}
          object <em>in spec</em> and <code>€3,480.50</code> as what it <em>resolves to</em>.
        </>,
      ],
      solution: {
        spec: SPEC_COMPOSE,
        seed: SEED,
        note: (
          <>
            The built-in <code>$cond</code> resolves its branches with <code>resolvePropValue</code>, which is the
            same function that dispatches to your directive — so either can hold the other.
          </>
        ),
      },
      check: ({ spec }) =>
        Boolean(deepFind(spec?.elements ?? {}, (n) => '$cond' in n && deepFind(n.$then, (m) => '$money' in m) !== null)),
    },
    {
      id: 'shadow',
      goal: (
        <>
          Rename your directive to <code>$state</code> and read the refusal. Registration is where that is
          caught, not render.
        </>
      ),
      hint: 'Then put the name back. Any of the eight built-in keys will do it.',
      steps: [
        <>
          Scroll to the <strong>write your own</strong> panel below the playground.
        </>,
        <>
          In the <strong>name · must start with $</strong> field, type <code>$state</code> over{' '}
          <code>{dirName || '$pct'}</code>.
        </>,
        <>
          Watch the pill in that panel&rsquo;s header flip from{' '}
          <strong>defineDirective accepted</strong> to <strong>rejected</strong>.
        </>,
        <>
          Read the red line under the <strong>resolve(value, ctx) — the body only</strong> editor: it says the
          name conflicts with a built-in.
        </>,
        <>
          Type the name back to <code>$pct</code> and confirm the header pill reads{' '}
          <strong>defineDirective accepted $pct</strong> again.
        </>,
      ],
      check: () => sawShadowError,
    },
    {
      id: 'own',
      goal: (
        <>
          Register your own directive and use its key in the spec — the <strong>{dirName}</strong> preset is one
          click away.
        </>
      ),
      hint: 'Edit the resolve body and watch the metric change without touching the spec.',
      steps: [
        <>
          In the <strong>registered:</strong> bar, check the orange <strong>● {dirName || '$…'}</strong> chip is
          on. Click it if it reads <strong>○ {dirName || '$…'}</strong>.
        </>,
        <>
          Click the <strong>your {dirName}</strong> chip in the <strong>load:</strong> row above the editor.
        </>,
        <>
          Read the rendered <strong>Collected</strong> metric: <code>73.4%</code>.
        </>,
        <>
          In <strong>resolve(value, ctx) — the body only</strong>, change the last line to{' '}
          <code>{"return (n * 100).toFixed(digits) + ' %';"}</code>.
        </>,
        <>
          The metric becomes <code>73.4 %</code> while the <strong>spec json</strong> tab is untouched — the
          directive body is the only thing that moved.
        </>,
      ],
      solution: {
        spec: customSpec,
        seed: SEED,
        note: (
          <>
            The same preset the <strong>load: your {dirName}</strong> chip loads. The key in{' '}
            <code>props.value</code> is whatever you named the directive, so renaming it renames the spec.
          </>
        ),
      },
      check: ({ spec }) => customOn && customOk && Boolean(deepFind(spec?.elements ?? {}, (n) => dirName in n)),
    },
  ];
}

export function DirectiveLab() {
  // Starts registered. Turning one OFF and back ON is task 1 — and it has to
  // happen client-side, because an error boundary does not catch during SSR.
  const [on, setOn] = useState<Set<string>>(new Set(['$money', '$relative', '$join', '$plural']));

  /** Task 1 is a round trip, so it needs a memory of having been off. */
  const everOff = useRef(false);
  const [moneyCycled, setMoneyCycled] = useState(false);

  const [dirName, setDirName] = useState('$pct');
  const [dirArgs, setDirArgs] = useState('digits');
  const [dirDesc, setDirDesc] = useState('Render a 0–1 ratio as a percentage.');
  const [dirBody, setDirBody] = useState(DEFAULT_BODY);
  const [customOn, setCustomOn] = useState(true);
  const [sawShadowError, setSawShadowError] = useState(false);

  /** Compile the body, then hand it to the real defineDirective. */
  const custom = useMemo(() => {
    const compiled = compileBody<
      (value: Record<string, unknown>, ctx: PropResolutionContext, resolve: typeof resolvePropValue) => unknown
    >(['value', 'ctx', 'resolvePropValue'], dirBody);
    if (!compiled.ok || !compiled.fn) return { ok: false as const, error: compiled.error ?? 'compile failed' };

    const fn = compiled.fn;
    try {
      const args = dirArgs
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const shape: Record<string, z.ZodTypeAny> = { [dirName]: z.unknown() };
      for (const a of args) shape[a] = z.unknown().optional();

      // defineDirective is where a bad name is rejected — not at render time.
      const def = defineDirective({
        name: dirName,
        description: dirDesc,
        schema: z.object(shape),
        resolve: (value, ctx) => fn(value as Record<string, unknown>, ctx, resolvePropValue),
      });
      return { ok: true as const, def: def as DirectiveDefinition };
    } catch (e) {
      return { ok: false as const, error: (e as Error).message };
    }
  }, [dirName, dirArgs, dirDesc, dirBody]);

  useEffect(() => {
    if (!custom.ok && custom.error.includes('conflicts with a built-in')) setSawShadowError(true);
  }, [custom]);

  const directives = useMemo(() => {
    const base = AVAILABLE.filter((d) => on.has(d.label)).map((d) => d.def);
    return customOn && custom.ok ? [...base, custom.def] : base;
  }, [on, customOn, custom]);

  /** A preset spec that always matches whatever the directive is called now. */
  const customSpec = useMemo<Spec>(
    () => ({
      root: 'card',
      elements: {
        card: {
          type: 'Card',
          props: { title: 'Your directive', subtitle: `props.value uses ${dirName}` },
          children: ['pct'],
        },
        pct: {
          type: 'Metric',
          props: {
            label: 'Collected',
            value: { [dirName]: { $state: '/invoice/collected' }, digits: 1 },
            delta: null,
            tone: null,
          },
          children: [],
        },
      },
    }),
    [dirName],
  );

  const presets = useMemo(
    () => [
      { label: 'the four built-in-ish ones', spec: SPEC, seedState: SEED },
      { label: `your ${dirName}`, spec: customSpec, seedState: SEED },
    ],
    [customSpec, dirName],
  );

  /**
   * Tasks live inside the component so their checks can read lab state, not
   * just the spec. The first one used to be `check: () => true`, which meant
   * it ticked before you had done anything.
   */
  const tasks = useMemo<Task[]>(
    () =>
      buildDirectiveTasks({
        moneyCycled,
        sawShadowError,
        customOn,
        customOk: custom.ok,
        dirName,
        customSpec,
      }),
    [moneyCycled, sawShadowError, customOn, custom.ok, dirName, customSpec],
  );

  const stages = buildDirectiveStages(tasks, customSpec);

  /**
   * Which stage the page as a whole is on.
   *
   * The rail lives inside `SpecPlayground`, but half of this lab does not —
   * the `registered:` bar above it and the write-your-own panel below it are
   * the subject of particular stages and noise on the others. Seeded from
   * `useInitialStage` rather than from the first `onStageChange`, which only
   * fires in an effect, so the SERVER render is already on the right stage.
   */
  const [stageIndex, setStageIndex] = useState(useInitialStage(stages.length));
  const stage = stages[stageIndex];

  const chips = AVAILABLE.filter((d) => shows(stage, d.label));
  const customChip = shows(stage, 'custom');
  const hiddenChips = AVAILABLE.length + 1 - chips.length - (customChip ? 1 : 0);

  /* The lab's own chrome belongs INSIDE the playground column. Rendered as
   * siblings it sat above and below the stage rail too, pushing the rail down
   * and giving this page a shape no other lab has. */
  const toolbar = (
    <div className="flex shrink-0 flex-wrap items-center gap-2 rounded-lg border bg-surface px-3 py-2">
      <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">registered:</span>
      {chips.map((d) => {
        const active = on.has(d.label);
        return (
          <button
            key={d.label}
            type="button"
            onClick={() => {
              const next = new Set(on);
              if (active) {
                next.delete(d.label);
                if (d.label === '$money') everOff.current = true;
              } else {
                next.add(d.label);
                if (d.label === '$money' && everOff.current) setMoneyCycled(true);
              }
              setOn(next);
            }}
            className={`rounded-sm border px-2 py-0.5 font-mono text-[12px] transition-colors ${
              active
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300'
                : 'border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300'
            }`}
          >
            {active ? '● ' : '○ '}
            {d.label}
          </button>
        );
      })}
      {customChip && (
        <button
          type="button"
          onClick={() => setCustomOn((v) => !v)}
          disabled={!custom.ok}
          className={`rounded-sm border px-2 py-0.5 font-mono text-[12px] transition-colors disabled:opacity-40 ${
            customOn && custom.ok
              ? 'border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-900 dark:bg-orange-950 dark:text-orange-300'
              : 'bg-card text-muted-foreground'
          }`}
        >
          {customOn && custom.ok ? '● ' : '○ '}
          {dirName || '$…'}
        </button>
      )}
      {/* The toggles this stage does not use stay REGISTERED — they are off
          the lesson, not off the provider, and the count says so. */}
      {hiddenChips > 0 && (
        <span className="font-mono text-[11px] text-muted-foreground">
          · {hiddenChips} more, registered and not this step
        </span>
      )}
      <span className="ml-auto font-mono text-[11px] text-muted-foreground">{directives.length} active</span>
    </div>
  );

  const below = (
    <>
      {shows(stage, 'resolve') && (
        <Code lang="typescript" title="the $relative this lab registered — the two arguments, and what is in them">{`const relative = defineDirective({
  name: '$relative',
  description: 'Render an ISO date as "3 days ago".',
  schema: z.object({ $relative: z.unknown() }),

  resolve: (value, ctx) => {
    // value — the WHOLE object from props.value, unparsed. The schema above
    //   never runs, so this is literally { $relative: { $state: '…' } }.
    // ctx   — a PropResolutionContext, and nothing else:
    //     stateModel     the store snapshot $state reads from
    //     repeatItem     \\
    //     repeatIndex     > the repeat scope, when there is one
    //     repeatBasePath /
    //     functions      the $computed map
    //     directives     the registry, so nesting works
    //   There is NO element here. A directive cannot see the props beside it,
    //   which is why $money carries its own 'currency' key.
    const raw = resolvePropValue(value.$relative, ctx);
    …
  },
});`}</Code>
      )}

      {/* ------------------------------------------------- write your own --- */}
      {shows(stage, 'own') ? (
      <Panel
        title="write your own"
        right={
          custom.ok ? (
            <Pill tone="ok">defineDirective accepted {dirName}</Pill>
          ) : (
            <Pill tone="bad">rejected</Pill>
          )
        }
        bodyClassName="grid gap-3 p-3 lg:grid-cols-[280px_1fr]"
      >
        <div className="flex flex-col gap-2.5">
          <label className="flex flex-col gap-1">
            <span className="font-mono text-[10.5px] uppercase tracking-wider text-muted-foreground">
              name · must start with $
            </span>
            <input
              value={dirName}
              onChange={(e) => setDirName(e.target.value)}
              className="rounded-sm border bg-background px-2 py-1 font-mono text-[13px] text-foreground outline-none focus:border-orange-400"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="font-mono text-[10.5px] uppercase tracking-wider text-muted-foreground">
              extra args · z.unknown().optional() each
            </span>
            <input
              value={dirArgs}
              placeholder="digits, locale"
              onChange={(e) => setDirArgs(e.target.value)}
              className="rounded-sm border bg-background px-2 py-1 font-mono text-[13px] text-foreground outline-none focus:border-orange-400"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="font-mono text-[10.5px] uppercase tracking-wider text-muted-foreground">
              description · reaches the model via prompt({'{ directives }'})
            </span>
            <textarea
              value={dirDesc}
              rows={2}
              onChange={(e) => setDirDesc(e.target.value)}
              className="resize-none rounded-sm border bg-background px-2 py-1 text-[13px] leading-relaxed text-foreground outline-none focus:border-orange-400"
            />
          </label>

          <div className="rounded-sm border bg-surface px-2 py-1.5">
            <div className="font-mono text-[10.5px] uppercase tracking-wider text-muted-foreground">
              the schema this builds
            </div>
            <pre className="mt-0.5 whitespace-pre-wrap font-mono text-[11.5px] text-foreground">
              {`z.object({
  '${dirName}': z.unknown(),${dirArgs
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((a) => `\n  ${a}: z.unknown().optional(),`)
    .join('')}
})`}
            </pre>
          </div>
        </div>

        <div className="flex min-h-0 flex-col overflow-hidden rounded-md border">
          <div className="border-b bg-muted px-3 py-1 font-mono text-[11px] text-muted-foreground">
            resolve(value, ctx) — the body only
          </div>
          <div className="h-[220px]">
            <CodeEditor value={dirBody} onChange={setDirBody} jsx={false} />
          </div>
          <div
            className={`px-3 py-1.5 font-mono text-[12px] leading-relaxed ${
              custom.ok
                ? 'text-muted-foreground'
                : 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300'
            }`}
          >
            {custom.ok
              ? `registered as ${dirName} · in scope: value, ctx, resolvePropValue`
              : custom.error}
          </div>
        </div>
      </Panel>
      ) : (
        <NotThisStep title="write your own" />
      )}

      {/* The whole artifact, built from what they just typed. A fixed $money
          example answered "what does one look like"; this answers "how do I
          make mine", which is the question the lab is actually for. Only on the
          stage that writes it: on the shadow stage the name is deliberately
          wrong, and printing "paste this into a file" over a rejected
          definition would be a lie. */}
      {shows(stage, 'source') && (
      <Code lang="typescript" title={`your directive, as source — paste this into a file`}>{`import { defineDirective, resolvePropValue } from '@json-render/core';
import { z } from 'zod';

export const ${(dirName || '$pct').replace(/^\$/, '')} = defineDirective({
  // Must start with "$" and must not be one of the eight built-ins.
  // defineDirective throws on both, at module load — not at render.
  name: '${dirName || '$pct'}',

  // Never runs. It is read by catalog.prompt() to teach the model this
  // key, and by nothing else at runtime.
  description: '${dirDesc.replace(/'/g, "\\'")}',
  schema: z.object({
    '${dirName || '$pct'}': z.unknown(),${dirArgs
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean)
      .map((a) => `\n    ${a}: z.unknown().optional(),`)
      .join('')}
  }),

  resolve: (value, ctx) => {
${dirBody
  .split('\n')
  .map((line) => (line ? `    ${line}` : ''))
  .join('\n')}
  },
});

// Register it — same array on the provider, and the same array into the
// prompt so the model learns the new vocabulary.
<JSONUIProvider registry={registry} directives={[${(dirName || '$pct').replace(/^\$/, '')}]}>

catalog.prompt({ directives: [${(dirName || '$pct').replace(/^\$/, '')}] });`}</Code>
      )}

      {shows(stage, 'literal') && (
      <div className="overflow-hidden rounded-lg border">
        <div className="border-b bg-muted px-3 py-1.5 font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
          an unregistered directive is worse than undefined
        </div>
        <div className="prose-doc px-3.5 py-2.5 text-[14px]">
          <p>
            An unknown <code>$computed</code> resolves to <code>undefined</code> and logs a console warning. An
            unknown directive does neither. It falls through to the <strong>literal passthrough</strong> branch, so
            your component receives the raw object — with its sub-expressions already resolved:
          </p>
          <p>
            <code>{'{ "$money": { "$state": "/invoice/total" }, "currency": "EUR" }'}</code> arrives as{' '}
            <code>{'{ $money: 3480.5, currency: "EUR" }'}</code>.
          </p>
          <p>
            React cannot render an object, so the control throws. The red <strong>&ldquo;Metric threw&rdquo;</strong>{' '}
            marker is the per-component error boundary from <StepRef slug="registry" /> doing its job — without it
            the whole page would be blank.
          </p>
          <p>
            One caveat that cost this playground a debugging round: <strong>error boundaries do not catch during
            server rendering.</strong> A component that throws on the server takes out the whole response, boundary
            or not. That is why this lab starts with the directive registered — the break has to happen after
            hydration.
          </p>
        </div>
      </div>
      )}

      {shows(stage, 'vs-computed') && (
      <div className="rounded-lg border bg-surface px-3.5 py-2.5 text-[13.5px] leading-relaxed text-muted-foreground">
        <strong className="text-foreground">Directive or <code>$computed</code>?</strong> A <code>$computed</code> function is
        a flat call with named args and no schema. A directive gets its own key, a Zod schema that validates its
        shape, and a <code>description</code> that can be surfaced to the model. Reach for <code>$computed</code> for
        one-off app logic (<StepRef slug="expressions" short /> is the REPL for it); reach for a directive when you
        are adding a <em>vocabulary item</em> that specs across your product will use — formatting, i18n, unit
        conversion. Built-ins always win a name collision, and <code>defineDirective</code> throws at registration
        if you try.
      </div>
      )}
    </>
  );

  return (
      <SpecPlayground
        spec={SPEC}
        seedState={SEED}
        directives={directives}
        /* The preset row reloads a whole spec, which is stage five's one click
         * ("load: your $pct") and a way to lose your work on every other. */
        presets={shows(stage, 'custom') ? presets : undefined}
        panes={STAGE_PANES[stageIndex] ?? STAGE_PANES[0]}
        height={540}
        stages={stages}
        labSlug="directives"
        onStageChange={(_s, i) => setStageIndex(i)}
        /* The hint is stage one's instruction ("toggle one off"), not a
         * standing note — on the stages whose chips are dimmed there is
         * nothing above to toggle. */
        hint={
          stage?.id === 'cycle-money' ? (
            <>
              Toggle directives above, and read what an <em>unregistered</em> one does before you switch it on.
            </>
          ) : undefined
        }
      toolbar={toolbar}
      below={below}
    />
  );
}