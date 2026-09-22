'use client';

import { createStateStore } from '@json-render/core';
import { JSONUIProvider, Renderer, useUIStream } from '@json-render/react';
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { StageFrame } from '@/components/lab/stage-frame';
import { type Stage, stagesFromChecklist } from '@/lib/labs/types';
import { useInitialStage } from '@/lib/labs/use-initial-stage';
import { demoRegistry, UnknownComponent } from '@/lib/demo/registry';
import { COMPONENT_NAMES } from '@/lib/demo/source.generated';
import type { ChecklistItem } from '../lab/checklist';
import { CopyButton, Panel, Tabs } from './ui';

/** The three panes of the right-hand panel. A stage is about exactly one of them. */
type Pane = 'wire' | 'spec' | 'state';

const EXAMPLES = [
  'A dashboard for a small accounting firm: three KPIs, then a card listing five overdue invoices with client, amount and days late.',
  'An expense claim form: description, amount, category dropdown, a receipt-attached checkbox, and a submit button that validates first.',
  'A project status page with a summary alert, a metric row, and a task list I can add to and delete from.',
];

/**
 * The lesson half of each stage; the demo's own checklist supplies the rest.
 *
 * `focus` is the pane the stage is ABOUT, and the panel opens on it. Without
 * that the tab is wherever the last stage left it, so a learner arriving at
 * "seeding what it invented" reads wire lines instead of the store.
 */
const GENERATE_STAGES: Array<{
  id: string;
  focus: Pane;
  title: string;
  concept?: string;
  ref?: string;
  when?: string;
  summary?: string;
}> = [
  {
    id: 'run',
    focus: 'wire',
    title: 'Read the wire',
    when:
      'Reach for `useUIStream` when a request produces one UI and no conversation — a prompt box, a "build me a view" button. `useChatUI` is the alternative once turns accumulate and old messages have to keep rendering their own UI; and the route must return text/plain, because an SSE or UI-message stream leaves this hook reading nothing.',
    concept: 'text-plain-wire',
    ref: 'hook-useuistream',
  },
  {
    id: 'patches',
    focus: 'wire',
    title: 'Patches, not a payload',
    when:
      'Patches are worth it when the seconds before the first paint would otherwise be a blank page. Ask the model for one complete object instead when nothing renders until you have validated and repaired it anyway — then progressive arrival buys you nothing and costs you a spec that is incomplete at every intermediate moment.',
    concept: 'jsonl-patches',
  },
  // The token counter this stage reads sits in the prompt box, not in a pane.
  // The wire is the closest the panel gets to it: those lines ARE the
  // completion half of the count, so leave them on screen beside it.
  {
    id: 'catalog',
    focus: 'wire',
    title: 'The catalog is the prompt',
    when:
      'Narrow the catalog per route as soon as cost or accuracy matters, which is immediately: you pay for every component you declare on every request, and a route that only ever needs six of them is paying for thirteen. Cache the prefix instead when the catalog genuinely cannot shrink — a whole design system shipped on every call is a default nobody chose.',
    concept: 'catalog-prompt-cost',
  },
  {
    id: 'state',
    focus: 'state',
    title: 'Seeding what it invented',
    when:
      'You need this for any generated spec that binds, repeats or conditions on state, because the renderer reads the store and never `spec.state`. When the data is yours rather than the model\'s to invent, seed the store from your own records and cancel the sample-data rule in `customRules` — that is the better trade, and then there is nothing to mirror.',
    concept: 'state-mirroring',
  },
  {
    id: 'guard',
    focus: 'wire',
    title: 'Never trust the first frame',
    when:
      'Guard every render path a model feeds, and treat `isNonEmptySpec` as the cheap first question rather than the last one — it does not check that `root` exists in `elements`, so it gates `validateSpec` instead of replacing it. A compiled spec needs neither, which is most of the argument for compiling.',
    ref: 'util-isnonemptyspec',
    summary:
      'A stream can stop halfway, and a half-arrived spec is still structurally a spec. Guard the render path before you show it: check it is non-empty, validate it, and keep a fallback in place.',
  },
];

/** The pane a stage opens on, tolerant of a stage that never named one. */
function paneOf(stage: Pick<Stage, 'focus'>): Pane {
  return (stage.focus as Pane | undefined) ?? 'wire';
}

export function GenerateDemo({ hasKey }: { hasKey: boolean }) {
  const initial = useInitialStage(GENERATE_STAGES.length);
  const [prompt, setPrompt] = useState(EXAMPLES[0]);
  // Seeded from the stage the lab OPENS on, not from a fixed 'wire'. A deep
  // link (`?stage=4`) is server-rendered, so a tab chosen only in
  // onStageChange would paint the wrong pane until hydration.
  const [tab, setTab] = useState<Pane>(() => paneOf(GENERATE_STAGES[initial]));

  const { spec, isStreaming, error, usage, rawLines, send, clear } = useUIStream({ api: '/api/generate' });

  // The store is ours, so anything can write into it. Here that "anything" is
  // the arriving spec.state — the renderer will never do this for us.
  const store = useMemo(() => createStateStore({}), []);
  const seeded = useRef('');

  useEffect(() => {
    const incoming = spec?.state;
    if (!incoming) return;
    const sig = JSON.stringify(incoming);
    if (sig === seeded.current) return;
    seeded.current = sig;
    store.update(Object.fromEntries(Object.entries(incoming).map(([k, v]) => [`/${k}`, v])));
  }, [spec?.state, store]);

  // Subscribe so the state tab stays live after streaming ends, when the user
  // starts typing into whatever bound inputs the model produced.
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);

  const hasRoot = Boolean(spec?.root && spec.elements?.[spec.root]);
  const elementCount = Object.keys(spec?.elements ?? {}).length;

  // Checklist signals — all derived from what actually happened on the wire.
  const sawStateLine = rawLines.some((l) => l.includes('"/state'));
  const knownTypes = new Set<string>(COMPONENT_NAMES);
  const sawUnknownType = Object.values(spec?.elements ?? {}).some((el) => el?.type && !knownTypes.has(el.type));
  const editedAfterStream =
    hasRoot && !isStreaming && seeded.current !== '' && JSON.stringify(snapshot) !== seeded.current;

  const items: ChecklistItem[] = [
    {
      label: 'Generate once and get a rendered root.',
      done: hasRoot,
      steps: [
        <>
          Click the first example chip under the prompt box — the accounting dashboard. It replaces the
          prompt text.
        </>,
        <>
          Press <strong>Generate</strong>. The button reads <strong>Generating…</strong> while the stream
          is open.
        </>,
        <>
          Watch the <strong>wire</strong> pane fill with one JSONL patch per line, and the{' '}
          <strong>lines</strong> counter climb beside it.
        </>,
        <>
          The left pane goes from <em>Waiting for the first patch…</em> to a rendered screen — it starts
          drawing long before the model has finished.
        </>,
      ],
      apply: { label: 'use the first example', run: () => setPrompt(EXAMPLES[0]) },
    },
    {
      label: <>Find a green <code>/state</code> line in the wire — the model seeding data the renderer will ignore.</>,
      done: sawStateLine,
      hint: 'The demo mirrors spec.state into its own store when the stream ends. In your app, you write that code.',
      steps: [
        <>
          The panel opens on <strong>wire</strong>; generate once and let the stream finish.
        </>,
        <>
          Scroll down the lines and find the green ones — their path starts <code>/state/</code>.
        </>,
        <>
          Switch to the <strong>spec</strong> tab and find the same data under <code>state</code>.
        </>,
        <>
          Compare the two panes: every line on the wire was a <em>path and a value</em> — <code>/root</code>,{' '}
          <code>/elements/…</code>, <code>/state/…</code> — and the spec is only what those lines added up
          to. The whole object never travels; where it lands is the path&rsquo;s business.
        </>,
      ],
      apply: { label: 'use the invoice example', run: () => setPrompt(EXAMPLES[0]) },
    },
    {
      label: 'Read the usage line at the end of the stream: prompt tokens → completion tokens.',
      done: Boolean(usage),
      steps: [
        <>
          Wait for the button to read <strong>Generate</strong> again — the stream is closed.
        </>,
        <>
          Look at the right end of the prompt box&rsquo;s bottom row, past{' '}
          <strong>lines</strong> and <strong>elements</strong>.
        </>,
        <>
          Read <strong>tokens N→M</strong>: the prompt side is the catalog, sent on every request; the
          completion side is the UI itself.
        </>,
      ],
    },
    {
      label: 'After the stream closes, type into a generated input and watch the state tab move.',
      done: editedAfterStream,
      hint: 'The store is yours (createStateStore), so bound inputs keep working after generation.',
      steps: [
        <>
          Click the second example chip — the expense claim form — and press <strong>Generate</strong>.
        </>,
        <>
          When the stream ends, read the <strong>state</strong> tab on the right — this stage opens it for
          you. It is the store, not the spec.
        </>,
        <>
          Type into one of the generated inputs on the left.
        </>,
        <>
          Watch the value appear under its bound path in <strong>state</strong>. The generation is over;
          the store is still yours.
        </>,
      ],
      apply: { label: 'use the form example', run: () => setPrompt(EXAMPLES[1]) },
    },
    {
      label: 'Ask for something the catalog cannot express — "a bar chart" — and watch the fallback render.',
      done: sawUnknownType,
      hint: 'The prompt lists only catalog components, but models still invent names. That is why fallback exists.',
      steps: [
        <>
          Replace the prompt with{' '}
          <em>&ldquo;A revenue bar chart by month, with a title above it.&rdquo;</em>
        </>,
        <>
          Press <strong>Generate</strong>.
        </>,
        <>
          Watch the <strong>wire</strong> for a line whose <code>"type"</code> is not one of the thirteen
          catalog names — <code>BarChart</code>, <code>Chart</code>, something invented.
        </>,
        <>
          In the rendered pane, that element is a dashed <em>unknown component</em> box instead of a hole.
          That box is the <code>fallback</code> prop; without it the element renders nothing at all.
        </>,
      ],
      apply: {
        label: 'ask for a bar chart',
        run: () => setPrompt('A revenue bar chart by month, with a title above it.'),
      },
    },
  ];

  const stagedBody = (
    <div className="flex flex-col gap-3">

      <div className="rounded-lg border bg-surface p-3">
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={3}
          placeholder="Describe a UI…"
          className="w-full resize-none bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
        />
        <div className="mt-2 flex flex-wrap items-center gap-2 border-t pt-2">
          <button
            type="button"
            disabled={!hasKey || isStreaming || !prompt.trim()}
            onClick={() => {
              seeded.current = '';
              void send(prompt);
            }}
            className="rounded-md bg-brand px-3 py-1.5 text-xs font-medium text-brand-foreground transition hover:opacity-90 disabled:opacity-40"
          >
            {isStreaming ? 'Generating…' : 'Generate'}
          </button>
          <button
            type="button"
            onClick={() => {
              clear();
              seeded.current = '';
            }}
            className="rounded-md border px-2.5 py-1.5 text-xs text-muted-foreground transition hover:text-foreground"
          >
            Clear
          </button>

          <div className="ml-auto flex items-center gap-3 font-mono text-[12px] text-muted-foreground">
            <span>
              lines <span className="tabular-nums text-foreground">{rawLines.length}</span>
            </span>
            <span>
              elements <span className="tabular-nums text-foreground">{elementCount}</span>
            </span>
            {usage && (
              <span title="prompt / completion tokens">
                tokens{' '}
                <span className="tabular-nums text-foreground">
                  {usage.promptTokens.toLocaleString()}→{usage.completionTokens.toLocaleString()}
                </span>
              </span>
            )}
          </div>
        </div>

        <div className="mt-2 flex flex-wrap gap-1.5">
          {EXAMPLES.map((e, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setPrompt(e)}
              className="max-w-full truncate rounded-sm border px-2 py-0.5 text-[12px] text-muted-foreground transition hover:border-orange-500 hover:text-foreground"
            >
              {e.slice(0, 54)}…
            </button>
          ))}
        </div>
      </div>

      {!hasKey && (
        <div className="rounded-lg border border-yellow-200 dark:border-yellow-900 bg-yellow-50 dark:bg-yellow-950 px-3.5 py-2.5 text-xs text-yellow-600 dark:text-yellow-400">
          <strong>No gateway key.</strong> Copy <code>.env.example</code> to <code>.env</code>, add{' '}
          <code>AI_GATEWAY_API_KEY</code>, and restart. Everything else on this page still describes exactly what
          would happen.
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950 px-3.5 py-2.5 font-mono text-[12px] text-red-600 dark:text-red-400">
          {error.message}
        </div>
      )}

      <div className="grid gap-3 lg:grid-cols-2">
        <Panel
          title={isStreaming ? 'rendering · live' : 'rendering'}
          right={
            isStreaming ? <span className="size-1.5 animate-pulse rounded-full bg-yellow-500" /> : null
          }
          bodyClassName="overflow-auto"
        >
          <div className="p-4" style={{ minHeight: 540, maxHeight: 640 }}>
            {hasRoot ? (
              <JSONUIProvider registry={demoRegistry} store={store}>
                <Renderer spec={spec} registry={demoRegistry} loading={isStreaming} fallback={UnknownComponent} />
              </JSONUIProvider>
            ) : (
              <div className="flex h-[380px] items-center justify-center text-center text-xs text-muted-foreground">
                {isStreaming ? 'Waiting for the first patch…' : 'Nothing generated yet.'}
              </div>
            )}
          </div>
        </Panel>

        <Panel
          title={
            <Tabs
              tabs={[
                { id: 'wire', label: 'wire' },
                { id: 'spec', label: 'spec' },
                { id: 'state', label: 'state' },
              ]}
              active={tab}
              onChange={(id) => setTab(id as typeof tab)}
            />
          }
          right={<CopyButton text={tab === 'wire' ? rawLines.join('\n') : JSON.stringify(spec, null, 2)} />}
        >
          <div className="overflow-auto p-2 font-mono text-[11.5px] leading-[1.6]" style={{ minHeight: 540, maxHeight: 640 }}>
            {tab === 'wire' &&
              (rawLines.length === 0 ? (
                <div className="p-2 text-muted-foreground">Patch lines appear here as the model emits them.</div>
              ) : (
                rawLines.map((l, i) => {
                  // The route emits {"__meta":"error"} in-stream when the
                  // provider fails after headers are gone. useUIStream has no
                  // notion of it, so it arrives here as an ordinary line.
                  const isError = l.includes('"__meta":"error"');
                  return (
                    <div
                      key={i}
                      className={`animate-in-soft flex gap-2 rounded px-1.5 py-0.5 ${
                        isError ? 'bg-red-50 dark:bg-red-950' : ''
                      }`}
                    >
                      <span className="shrink-0 tabular-nums text-muted-foreground">{String(i + 1).padStart(2, '0')}</span>
                      <span
                        className={`min-w-0 break-all ${
                          isError
                            ? 'font-medium text-red-600 dark:text-red-400'
                            : l.includes('"/state')
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-muted-foreground'
                        }`}
                      >
                        {l}
                      </span>
                    </div>
                  );
                })
              ))}
            {tab === 'spec' && <pre className="p-1 text-muted-foreground">{JSON.stringify(spec, null, 2)}</pre>}
            {tab === 'state' && <pre className="p-1 text-muted-foreground">{JSON.stringify(snapshot, null, 2)}</pre>}
          </div>
        </Panel>
      </div>
    </div>
  );

  return (
    <StageFrame
      slug="generate"
      stages={stagesFromChecklist(items, GENERATE_STAGES)}
      // The panel follows the stage. The tabs stay clickable on purpose —
      // stage two asks the learner to walk from the wire to the spec.
      onStageChange={(stage) => setTab(paneOf(stage))}
    >
      {() => stagedBody}
    </StageFrame>
  );
}
