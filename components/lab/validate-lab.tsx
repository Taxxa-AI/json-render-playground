'use client';

import { useMemo, useState } from 'react';
import { demoCatalog } from '@/lib/demo/catalog';
import { Chip, Panel, Pill } from '../playground/ui';
import { JsonEditor } from '../playground/json-editor';
import type { ChecklistItem } from './checklist';
import { StepRef } from '@/components/shell/step-ref';

/**
 * The third thing a catalog is — and the limit of it.
 *
 * `catalog.prompt()` is the famous one. `defineRegistry` uses the same object
 * for compile-time types. The third is `catalog.validate(spec)`, which checks a
 * spec against the generated Zod schema at runtime.
 *
 * The lesson here is what it does NOT check — verified against 0.20.0:
 *
 *   - component names   → rejected when unknown. This is what it is for.
 *   - spec structure    → rejected when an element has no `children` array.
 *   - action names      → NOT checked. `launchMissiles` validates clean.
 *   - prop types        → narrowed to the component's own Zod schema ONLY when
 *                         the catalog holds exactly one component. With two or
 *                         more the generated schema widens to an open object,
 *                         so `label: 123` on a `label: z.string()` component
 *                         validates clean. This catalog has thirteen.
 */

const CASES: Array<{ label: string; spec: string }> = [
  {
    label: 'valid',
    spec: `{
  "root": "a",
  "elements": {
    "a": { "type": "Metric",
           "props": { "label": "Revenue", "value": "€48,200", "delta": null, "tone": "success" },
           "children": [] }
  }
}`,
  },
  {
    label: 'unknown component',
    spec: `{
  "root": "a",
  "elements": {
    "a": { "type": "BarChart", "props": { "data": [1, 2, 3] }, "children": [] }
  }
}`,
  },
  {
    label: 'props of the WRONG TYPE',
    spec: `{
  "root": "a",
  "elements": {
    "a": { "type": "Metric",
           "props": { "label": 123, "value": null, "tone": "purple", "nonsense": true },
           "children": [] }
  }
}`,
  },
  {
    label: 'an ACTION THAT DOES NOT EXIST',
    spec: `{
  "root": "a",
  "elements": {
    "a": { "type": "Button", "props": { "label": "Go", "variant": "primary" },
           "on": { "press": { "action": "launchMissiles" } },
           "children": [] }
  }
}`,
  },
];

export function useValidateLab() {
  const [idx, setIdx] = useState(0);
  const [text, setText] = useState(CASES[0].spec);
  const [seen, setSeen] = useState<Set<string>>(new Set([CASES[0].label]));

  const result = useMemo(() => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch (e) {
      return { kind: 'syntax' as const, message: (e as Error).message };
    }
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const r = (demoCatalog as any).validate(parsed);
      if (r.success) return { kind: 'pass' as const };
      const issues = (r.errors?.issues ?? r.error?.issues ?? []) as Array<{ path: unknown[]; message: string }>;
      return {
        kind: 'fail' as const,
        issues: issues.slice(0, 6).map((i) => ({ path: (i.path ?? []).join('.'), message: i.message })),
      };
    } catch (e) {
      return { kind: 'syntax' as const, message: (e as Error).message };
    }
  }, [text]);

  const isPropCase = idx === 2;
  const isActionCase = idx === 3;

  const items: ChecklistItem[] = [
    {
      label: 'Run all four cases and read what each one reports.',
      done: seen.size >= 4,
      steps: [
        <>
          Click the <strong>valid</strong> chip and read the right-hand panel:{' '}
          <code>{'{ success: true }'}</code> with a green <strong>success</strong> pill.
        </>,
        <>
          Click <strong>unknown component</strong>: the pill turns to <strong>rejected</strong> and the panel
          lists the issue, with the full set of valid names.
        </>,
        <>
          Click <strong>props of the WRONG TYPE</strong>. Read the pill before you read anything else.
        </>,
        <>
          Click <strong>an ACTION THAT DOES NOT EXIST</strong>, the last chip.
        </>,
        <>
          Count the verdicts: one rejection out of four. Only the unknown <em>name</em> was caught.
        </>,
      ],
      apply: {
        label: 'run all four',
        run: () => {
          setSeen(new Set(CASES.map((c) => c.label)));
          setIdx(3);
          setText(CASES[3].spec);
        },
      },
    },
    {
      label: (
        <>
          Confirm the <strong>props of the WRONG TYPE</strong> case <em>passes</em> — then the{' '}
          <strong>action that does not exist</strong> case, which also passes.
        </>
      ),
      done: seen.has('props of the WRONG TYPE') && seen.has('an ACTION THAT DOES NOT EXIST'),
      hint: 'Rule: prop types are only narrowed when a catalog holds exactly one component; with thirteen the schema is an open object. Action names are never checked.',
      steps: [
        <>
          Click the <strong>props of the WRONG TYPE</strong> chip.
        </>,
        <>
          Read the spec on the left: <code>label</code> is a number, <code>value</code> is <code>null</code>,{' '}
          <code>tone</code> is not in the enum, and <code>nonsense</code> is not a prop at all.
        </>,
        <>
          Read the panel on the right: <code>{'{ success: true }'}</code>, and a red paragraph explaining why.
        </>,
        <>
          Click <strong>an ACTION THAT DOES NOT EXIST</strong> and read the same green result for{' '}
          <code>launchMissiles</code>.
        </>,
      ],
      apply: {
        label: 'show the props case',
        run: () => {
          setIdx(2);
          setText(CASES[2].spec);
          setSeen((prev) => new Set(prev).add(CASES[2].label));
        },
      },
    },
    {
      label: (
        <>
          Break a <em>name</em> in the valid case — rename <code>Metric</code> to <code>Metrics</code> — and
          watch it get rejected instead.
        </>
      ),
      done: /"type"\s*:\s*"(?!Metric"|BarChart"|Button")/.test(text),
      hint: 'Rule: that is the line catalog.validate draws. It knows your component names and the shape of a spec, and essentially nothing else.',
      steps: [
        <>
          Click the <strong>valid</strong> chip to load the clean spec back into the editor.
        </>,
        <>
          In the <strong>spec</strong> editor, change <code>"type": "Metric"</code> to{' '}
          <code>"type": "Metrics"</code> — one character.
        </>,
        <>
          Watch the pill on the <strong>catalog.validate(spec)</strong> panel turn to{' '}
          <strong>rejected</strong>.
        </>,
        <>
          Read the issue it lists: the unknown name, and every name it would have accepted. That is the one
          line this function draws.
        </>,
      ],
      apply: {
        label: 'rename it for me',
        run: () => {
          setIdx(0);
          setText(CASES[0].spec.replace('"Metric"', '"Metrics"'));
          setSeen((prev) => new Set(prev).add(CASES[0].label));
        },
      },
    },
  ];

  const body = (
    <div className="flex flex-col gap-3">

      <div className="flex flex-wrap gap-1.5">
        {CASES.map((c, i) => (
          <Chip
            key={c.label}
            active={idx === i}
            danger={c.label.includes('WRONG') || c.label.includes('DOES NOT EXIST')}
            onClick={() => {
              setIdx(i);
              setText(c.spec);
              setSeen((prev) => new Set(prev).add(c.label));
            }}
          >
            {c.label}
          </Chip>
        ))}
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <Panel title="spec" bodyClassName="flex flex-col overflow-hidden" className="h-80">
          <JsonEditor value={text} onChange={setText} />
        </Panel>

        <Panel
          title="catalog.validate(spec)"
          className="h-80"
          bodyClassName="min-h-0 overflow-hidden"
          right={
            result.kind === 'pass' ? (
              <Pill tone="ok">success</Pill>
            ) : result.kind === 'fail' ? (
              <Pill tone="bad">rejected</Pill>
            ) : (
              <Pill tone="warn">bad json</Pill>
            )
          }
        >
          <div className="h-full overflow-auto p-3 font-mono text-[12px] leading-relaxed">
            {result.kind === 'pass' && (
              <>
                <div className="text-emerald-600 dark:text-emerald-400">{'{ success: true }'}</div>
                {isPropCase && (
                  <p className="mt-3 font-sans text-[13px] leading-relaxed text-red-600 dark:text-red-400">
                    <strong>Read that again.</strong> <code>label</code> is a number, <code>value</code> is null,{' '}
                    <code>tone</code> is not in the enum, and there is an extra prop that does not exist — and it
                    passed. The per-component Zod schemas are used for the <em>prompt</em> and for{' '}
                    <em>TypeScript</em>. They are not enforced here.
                  </p>
                )}
                {isActionCase && (
                  <p className="mt-3 font-sans text-[13px] leading-relaxed text-red-600 dark:text-red-400">
                    <strong>Also passed.</strong> <code>launchMissiles</code> is in neither this catalog&rsquo;s
                    three actions nor the four built-ins. Action names are not checked at all — at runtime the
                    press logs <code>No handler registered for action: launchMissiles</code> to the console and the
                    button does nothing.
                  </p>
                )}
              </>
            )}
            {result.kind === 'syntax' && <div className="text-yellow-600 dark:text-yellow-400">{result.message}</div>}
            {result.kind === 'fail' && (
              <ul className="flex flex-col gap-1.5">
                {result.issues.map((i) => (
                  <li key={i.path + i.message} className="text-red-600 dark:text-red-400">
                    <span className="text-muted-foreground">{i.path || '(root)'}</span> — {i.message}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Panel>
      </div>

      <div className="overflow-hidden rounded-lg border">
        <div className="border-b bg-muted px-3 py-1.5 font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
          what catalog.validate actually checks
        </div>
        <div className="prose-doc px-3.5 py-2.5 text-[14px]">
          <ul>
            <li>
              <strong>Component name is in the catalog</strong> —{' '}
              <span className="text-emerald-600 dark:text-emerald-400">yes</span>. An unknown <code>type</code> is
              rejected with the full list of valid names. This is the one thing it reliably does.
            </li>
            <li>
              <strong>Spec structure</strong> (root, elements, a <code>children</code> array on every element) —{' '}
              <span className="text-emerald-600 dark:text-emerald-400">yes</span>.
            </li>
            <li>
              <strong>Action names</strong> —{' '}
              <span className="text-red-600 dark:text-red-400">no</span>. Try the <em>unknown action</em> case:{' '}
              <code>launchMissiles</code> is in neither the catalog nor the built-ins, and it passes. At runtime you
              get <code>console.warn(&apos;No handler registered for action&apos;)</code> and nothing else.
            </li>
            <li>
              <strong>Prop types against each component&rsquo;s Zod schema</strong> —{' '}
              <span className="text-red-600 dark:text-red-400">not for any real catalog</span>. The generated schema
              narrows props to the component&rsquo;s own Zod schema only when the catalog holds exactly{' '}
              <em>one</em> component; with two or more it widens to an open object and anything goes. This catalog
              has thirteen.
            </li>
          </ul>
          <p>
            So three separate things guard you, and none of them is the one people assume:{' '}
            <code>validateSpec</code> (structure, <StepRef slug="repair" />), <code>catalog.validate</code>{' '}
            (component names), and <strong>your own component code</strong> (prop shapes). If a wrong prop type
            matters, parse it in the component — <code>props.checks</code> on this playground&rsquo;s TextInput does
            exactly that.
          </p>
        </div>
      </div>
    </div>
  );

  return { items, body };
}

/** The view on its own, for anywhere that does not stage it. */
export function ValidateLab() {
  return useValidateLab().body;
}
