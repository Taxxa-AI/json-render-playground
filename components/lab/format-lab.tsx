'use client';

import type { FlatElement, Spec } from '@json-render/core';
import { createStateStore, nestedToFlat } from '@json-render/core';
// NOTE: nestedToFlat lives in core, flatToTree in react. Easy half hour to lose.
import { flatToTree, JSONUIProvider, Renderer } from '@json-render/react';
import { useMemo, useState } from 'react';
import { demoRegistry, UnknownComponent } from '@/lib/demo/registry';
import { JsonEditor } from '../playground/json-editor';
import { Chip, Panel } from '../playground/ui';
import type { ChecklistItem } from './checklist';
import { StageFrame } from './stage-frame';
import { stagesFromChecklist } from '@/lib/labs/types';
import { useInitialStage } from '@/lib/labs/use-initial-stage';

/**
 * Two converters into the canonical flat format.
 *
 * Both exist because the flat map is awkward for humans and for models that
 * prefer nesting. You can let either produce a shape they find natural and
 * normalise on the way in.
 */

const NESTED = `{
  "type": "Card",
  "props": { "title": "Nested is easier to write", "subtitle": null },
  "children": [
    { "type": "Text", "props": { "value": "But harder to patch.", "tone": null, "size": null } },
    {
      "type": "Stack",
      "props": { "direction": "row", "gap": "sm", "align": "center", "wrap": null },
      "children": [
        { "type": "Badge", "props": { "label": "one", "tone": "info" } },
        { "type": "Badge", "props": { "label": "two", "tone": "success" } }
      ]
    }
  ],
  "state": { "ok": true }
}`;

const FLAT_LIST = `[
  { "key": "root",  "parentKey": null,   "type": "Card",  "props": { "title": "From a flat list", "subtitle": null } },
  { "key": "t1",    "parentKey": "root", "type": "Text",  "props": { "value": "Rows with key + parentKey.", "tone": null, "size": null } },
  { "key": "b1",    "parentKey": "root", "type": "Badge", "props": { "label": "from a DB table", "tone": "info" } }
]`;

/** The same inputs with one extra node — what the "add one for me" button loads. */
const NESTED_PLUS = NESTED.replace(
  `        { "type": "Badge", "props": { "label": "two", "tone": "success" } }`,
  `        { "type": "Badge", "props": { "label": "two", "tone": "success" } },
        { "type": "Badge", "props": { "label": "three", "tone": "danger" } }`,
);

const FLAT_LIST_PLUS = FLAT_LIST.replace(
  `  { "key": "b1",    "parentKey": "root", "type": "Badge", "props": { "label": "from a DB table", "tone": "info" } }`,
  `  { "key": "b1",    "parentKey": "root", "type": "Badge", "props": { "label": "from a DB table", "tone": "info" } },
  { "key": "b2",    "parentKey": "root", "type": "Badge", "props": { "label": "one more row", "tone": "success" } }`,
);

type Mode = 'nested' | 'list';

/** The lesson half of each stage; `items` below supplies the assignment half. */
const FORMAT_STAGES = [
  {
    id: 'nested',
    focus: 'nested',
    title: 'Nested tree to flat map',
    when:
      'Convert at the boundary when something upstream genuinely speaks trees — a CMS, a form builder, an older model, your own hand-written fixtures. Not for a spec anything downstream will patch: the keys are positional, so they renumber on the next edit and a patch aimed at `el-3` lands on a different element.',
    concept: 'nested-to-flat',
    ref: 'util-nestedtoflat',
  },
  {
    id: 'rows',
    focus: 'list',
    title: 'Database rows to a spec',
    when:
      'Reach for this when the UI already lives in a table — rows with a key and a parent key, maintained by an admin tool or a migration. It is the converter to prefer over `nestedToFlat` whenever the result must stay patchable, because the keys are the ones you chose rather than ones the walk invented.',
    concept: 'flat-to-tree',
    ref: 'util-flattotree',
  },
  /**
   * This stage used to be titled "Merging and diffing" and carried the
   * `merge-and-diff` concept — deepMergeSpec and diffToPatches — while its
   * assignment, its panes and its prose were all about the keys nestedToFlat
   * invents. Nothing on this screen merges or diffs anything, and that concept
   * names `refine` as its step, where `refine-demo` already teaches it. So the
   * stage now says what it actually shows: the gotcha on `nested-to-flat`.
   */
  {
    id: 'keys',
    focus: 'nested',
    title: 'The keys it invents for you',
    when:
      'This is the fact that decides whether nested authoring belongs in your pipeline at all. Author nested only for a spec compiled once and rendered; the moment anything streams into it, diffs it or refines it, write the flat map directly or come through `flatToTree` with keys of your own.',
    concept: 'nested-to-flat',
    ref: 'util-nestedtoflat',
  },
];

export function FormatLab() {
  /**
   * The opening converter is the opening STAGE's converter.
   *
   * `onStageChange` only fires on the client, so without this a deep link to
   * `?stage=2` server-renders the nested input for a stage about database rows
   * and only corrects itself after hydration.
   */
  const opening = useInitialStage(FORMAT_STAGES.length);
  const openingMode = (FORMAT_STAGES[opening].focus ?? 'nested') as Mode;
  const [mode, setMode] = useState<Mode>(openingMode);
  const [text, setText] = useState(openingMode === 'nested' ? NESTED : FLAT_LIST);
  const [tried, setTried] = useState<Set<Mode>>(new Set(['nested']));
  const [edited, setEdited] = useState(false);

  const out = useMemo(() => {
    try {
      const input = JSON.parse(text);
      const spec =
        mode === 'nested'
          ? nestedToFlat(input as Record<string, unknown>)
          : flatToTree(input as FlatElement[]);
      return { ok: true as const, spec };
    } catch (e) {
      return { ok: false as const, error: (e as Error).message };
    }
  }, [text, mode]);

  const store = useMemo(
    () => createStateStore(out.ok ? structuredClone(out.spec.state ?? {}) : {}),
    [out],
  );

  /** Put the lab on one converter, with that converter's input loaded. */
  function showMode(m: Mode) {
    setMode(m);
    setText(m === 'nested' ? NESTED : FLAT_LIST);
    setEdited(false);
  }

  /**
   * The same, from a CHIP — which also counts as having run that converter.
   *
   * Arriving at a stage must not count: stage one asks the learner to run both
   * converters, and a task that ticks itself when you walk past it teaches
   * nothing.
   */
  function switchMode(m: Mode) {
    showMode(m);
    setTried((prev) => new Set(prev).add(m));
  }

  const generatedKeys = out.ok ? Object.keys(out.spec.elements ?? {}) : [];
  const hasInventedKeys = generatedKeys.some((k) => /^el-\d+$/.test(k));

  const items: ChecklistItem[] = [
    {
      label: 'Run both converters.',
      done: tried.size === 2,
      steps: [
        <>
          The lab opens on the <strong>nestedToFlat(tree)</strong> chip, so the left pane is{' '}
          <strong>input · nested tree</strong>.
        </>,
        <>
          Read <strong>output · canonical Spec</strong> in the middle: the tree became{' '}
          <code>{'{ root, elements }'}</code>, one entry per node.
        </>,
        <>
          Click the <strong>flatToTree(rows)</strong> chip. The left pane becomes{' '}
          <strong>input · flat rows</strong>, three rows with <code>key</code> and <code>parentKey</code>.
        </>,
        <>
          Confirm the <strong>output · canonical Spec</strong> header now reads{' '}
          <strong>3 elements</strong> and the <strong>rendered</strong> pane draws the card.
        </>,
      ],
      apply: { label: 'run the other one', run: () => switchMode(mode === 'nested' ? 'list' : 'nested') },
    },
    {
      label: 'Add a node to the input and watch the flat spec grow.',
      done: edited && out.ok && generatedKeys.length > 3,
      steps: [
        <>
          This stage opens on <strong>flatToTree(rows)</strong>, so the input pane on the left is the row
          list — click into it and go to the last row (on the <strong>nestedToFlat</strong> chip, the
          innermost <code>children</code> array instead).
        </>,
        <>
          Add one node:{' '}
          <code>{'{ "type": "Badge", "props": { "label": "three", "tone": "danger" } }'}</code> — or, in flat
          mode, a row{' '}
          <code>{'{ "key": "b2", "parentKey": "root", "type": "Badge", "props": { … } }'}</code>.
        </>,
        <>
          Watch the element count in the <strong>output · canonical Spec</strong> header go up by one.
        </>,
        <>
          Look at <strong>rendered</strong>: the new badge is on screen, and it never went near a React
          child — only the flat map grew.
        </>,
      ],
      apply: {
        label: 'add one for me',
        run: () => {
          setText(mode === 'nested' ? NESTED_PLUS : FLAT_LIST_PLUS);
          setEdited(true);
        },
      },
    },
    {
      label: <>Spot the invented keys (<code>el-0</code>, <code>el-1</code>) in the nested output.</>,
      done: hasInventedKeys,
      hint: 'They are positional, so they move when you edit. Never patch a spec produced this way.',
      steps: [
        <>
          This stage opens on <strong>nestedToFlat(tree)</strong> — only that converter invents keys.
        </>,
        <>
          In <strong>output · canonical Spec</strong>, read the keys inside <code>elements</code>. Every one
          is invented, root included: <code>el-0</code> is the Card, <code>el-1</code> the Text,{' '}
          <code>el-3</code> and <code>el-4</code> the two badges.
        </>,
        <>
          In the input on the left, delete the first child — the whole <code>Text</code> node and its
          trailing comma.
        </>,
        <>
          Watch the numbering close up: <code>el-1</code> is now the Stack, and the badge that was{' '}
          <code>el-3</code> is <code>el-2</code>. Any patch you had written against those keys now hits the
          wrong node.
        </>,
      ],
      apply: { label: 'reload nestedToFlat', run: () => switchMode('nested') },
    },
  ];

  const stages = stagesFromChecklist(items, FORMAT_STAGES);

  const stagedBody = (
    <div className="flex h-full min-h-0 flex-col gap-3">

      <div className="flex items-center gap-2">
        {(
          [
            ['nested', 'nestedToFlat(tree)'],
            ['list', 'flatToTree(rows)'],
          ] as Array<[Mode, string]>
        ).map(([m, label]) => (
          <Chip key={m} active={mode === m} onClick={() => switchMode(m)}>
            {label}
          </Chip>
        ))}
      </div>

      <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-3">
        <Panel title={mode === 'nested' ? 'input · nested tree' : 'input · flat rows'}>
          <div className="min-h-0 flex-1 overflow-hidden">
            <JsonEditor
              value={text}
              onChange={(v) => {
                setText(v);
                setEdited(true);
              }}
            />
          </div>
        </Panel>

        <Panel
          title="output · canonical Spec"
          right={
            <span className={`font-mono text-[11px] ${out.ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
              {out.ok ? `${Object.keys(out.spec.elements ?? {}).length} elements` : 'error'}
            </span>
          }
        >
          <pre className="h-full overflow-auto p-3 font-mono text-[11.5px] leading-[1.55] text-muted-foreground">
            <code>{out.ok ? JSON.stringify(out.spec, null, 2) : out.error}</code>
          </pre>
        </Panel>

        <Panel title="rendered" bodyClassName="overflow-auto">
          <div className="p-3" style={{ height: 470 }}>
            {out.ok && out.spec.root ? (
              <JSONUIProvider registry={demoRegistry} store={store}>
                <Renderer spec={out.spec as Spec} registry={demoRegistry} fallback={UnknownComponent} />
              </JSONUIProvider>
            ) : (
              <span className="text-[12px] text-muted-foreground">Nothing renderable.</span>
            )}
          </div>
        </Panel>
      </div>

      <div className="rounded-lg border bg-surface px-3.5 py-2.5 text-[13.5px] leading-relaxed text-muted-foreground">
        <strong className="text-foreground">Where each one earns its keep.</strong>{' '}
        <code>nestedToFlat</code> lets you author specs as a readable tree — in tests, in fixtures, or in a prompt
        format you think a model handles better — and normalise before rendering. Note that it invents keys
        (<code>el-0</code>, <code>el-1</code>), so they are not stable across edits: fine for a one-shot render,
        wrong for anything you intend to patch later. <code>flatToTree</code> goes the other way, from rows with{' '}
        <code>key</code> and <code>parentKey</code> — which is exactly the shape a SQL table of UI elements has, and
        the cleanest path from a database-driven form builder to a rendered form.
      </div>
    </div>
  );

  /**
   * Both converters stay on the chip row on every stage, and that is deliberate:
   * the lab's whole point is that two shapes normalise into the one canonical
   * spec, the first stage's task is to run both, and the three panes below are
   * the same instrument either way. What follows the stage is which converter is
   * LOADED — a stage about database rows should not open on a nested tree.
   */
  return (
    <StageFrame
      slug="formats"
      stages={stages}
      onStageChange={(stage) => {
        if (stage.focus) showMode(stage.focus as Mode);
      }}
    >
      {() => stagedBody}
    </StageFrame>
  );
}
