'use client';

import type { ComputedFunction, DirectiveDefinition, Spec } from '@json-render/core';
import { validateSpec } from '@json-render/core';
import { JSONUIProvider, Renderer } from '@json-render/react';
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { demoRegistry, UnknownComponent } from '@/lib/demo/registry';
import { createLoggingStore, type StoreEvent } from '@/lib/demo/logging-store';
import { TaskList, type Task, type TaskContext, type TaskSolution } from '@/components/lab/task-list';
import { StageRail } from '@/components/lab/stage-rail';
import type { Stage } from '@/lib/labs/types';
import { useInitialStage } from '@/lib/labs/use-initial-stage';
import { usePublishSetup } from '@/lib/labs/setup';
import { InsertBar } from './insert-bar';
import { JsonEditor } from './json-editor';
import { SourcePane } from './source-pane';
import { WiringPane, type WiringBlock } from './wiring-pane';
import { ResolveInspector, SpecTree } from './spec-tree';
import { cn } from '@/lib/utils';
import { CodeBlock } from './code-block';
import { CopyButton, Panel, Tabs } from './ui';

export interface SpecPlaygroundProps {
  spec: Spec;
  /**
   * Initial state model. The renderer does NOT read `spec.state` — seeding is
   * the host app's job, and this is where we do it.
   */
  seedState?: Record<string, unknown>;
  functions?: Record<string, ComputedFunction>;
  directives?: DirectiveDefinition[];
  handlers?: Record<string, (params: Record<string, unknown>) => unknown>;
  /** Extra action names (beyond the catalog's) to log. */
  extraActions?: string[];
  editable?: boolean;
  panes?: Array<'tree' | 'spec' | 'state' | 'log' | 'catalog' | 'impl' | 'wiring'>;
  /**
   * Host-side source for the `wiring` pane: the handlers, validation functions
   * and other code this lab hands to the provider. The provider call itself is
   * added by the pane — only pass what is specific to this lab.
   */
  wiring?: WiringBlock[];
  height?: number;
  hint?: React.ReactNode;
  /** Checked live against the spec, state, fired actions and written paths. */
  tasks?: Task[];
  /**
   * The lab as an ordered chain of complete snapshots (see `lib/labs/types`).
   *
   * Takes the place of `tasks`: arriving at a stage loads that stage's WHOLE
   * spec and seed, so the panes always show the entire setup as it stands at
   * that point rather than wherever the learner's own edits left it.
   */
  stages?: Stage[];
  /** Step slug, used by the stage rail. Required when `stages` is set. */
  labSlug?: string;
  /** Fill the parent instead of using a fixed pane height. */
  fill?: boolean;
  /** Show the add-a-component bar. */
  insert?: boolean;
  /** Reports task completion outwards, for a stage rail owned by the lab. */
  onProgress?: (done: number, total: number) => void;
  /** Called when the learner moves to a stage, so the lab can scope itself to it. */
  onStageChange?: (stage: Stage, index: number) => void;
  /**
   * The lab's own chrome, rendered INSIDE the playground column.
   *
   * A lab that renders its toggles or readouts as siblings of the playground
   * puts them above and below the stage rail as well, which pushes the rail
   * down and gives that page a shape no other lab has. Passing them here keeps
   * the rail flush to the top, like every other lab.
   */
  toolbar?: React.ReactNode;
  below?: React.ReactNode;
  /** Presets the learner can load into the editor with one click. */
  presets?: Array<{ label: string; spec: Spec; seedState?: Record<string, unknown> }>;
}

interface LogLine {
  id: number;
  kind: 'action' | 'write';
  text: string;
}

export function SpecPlayground({
  spec: initialSpec,
  seedState,
  functions,
  directives,
  handlers,
  extraActions = [],
  editable = true,
  panes = ['tree', 'spec', 'state', 'catalog', 'impl'],
  wiring,
  height = 540,
  hint,
  tasks,
  stages,
  labSlug,
  onProgress,
  onStageChange,
  toolbar,
  below,
  presets,
  insert = true,
  fill = true,
}: SpecPlaygroundProps) {
  /**
   * Everything the FIRST stage decides has to be decided here, not in an
   * effect.
   *
   * A staged lab can open on any stage (`?stage=N`, and stage one is just
   * N=1), so seeding the editor, the store and the open tab from `initialSpec`
   * and `panes[0]` put stage nine's lesson beside stage one's spec, on a tab
   * that stage does not even list — no tab highlighted, wrong pane rendered.
   */
  const initialStage = useInitialStage(stages?.length ?? 1);
  const opening = stages?.[initialStage];

  const [text, setText] = useState(() => JSON.stringify(opening?.spec ?? initialSpec, null, 2));
  const [activeSeed, setActiveSeed] = useState(opening?.seed ?? seedState);
  const [tab, setTab] = useState(opening?.panes?.[0] ?? panes[0]);
  const [log, setLog] = useState<LogLine[]>([]);
  const [fired, setFired] = useState<string[]>([]);
  const [written, setWritten] = useState<string[]>([]);
  const logSeq = useRef(0);
  const [nonce, setNonce] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [stageIndex, setStageIndex] = useState(initialStage);
  const stage = stages?.[stageIndex];
  const staged = Boolean(stages && stages.length > 0);

  /**
   * The panes this stage needs, not every pane the lab owns.
   *
   * A stage teaches one feature, so the tabs beside it should be the ones that
   * feature is visible in — reading past four irrelevant panes to find the one
   * the lesson is about is the same problem as a lab that shows every topic.
   */
  const shownPanes = stage?.panes ?? panes;

  const pushLog = useCallback((kind: LogLine['kind'], t: string) => {
    logSeq.current += 1;
    const id = logSeq.current;
    setLog((prev) => [{ id, kind, text: t }, ...prev].slice(0, 80));
  }, []);

  const store = useMemo(
    () =>
      createLoggingStore(structuredClone(activeSeed ?? {}), (e: StoreEvent) => {
        for (const entry of e.entries) {
          pushLog('write', `${entry.path} = ${shortJson(entry.value)}`);
        }
        setWritten((prev) => [...prev, ...e.entries.map((x) => x.path)].slice(-200));
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [nonce, activeSeed, pushLog],
  );

  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);

  const parsed = useMemo(() => {
    try {
      const value = JSON.parse(text) as Spec;
      return { ok: true as const, value, report: validateSpec(value) };
    } catch (e) {
      return { ok: false as const, error: (e as Error).message };
    }
  }, [text]);

  /**
   * Keep the last spec that parsed.
   *
   * Half-typed JSON is invalid JSON, so blanking the preview on every parse
   * failure means the learner edits blind from the first keystroke — they lose
   * the very thing they are editing against. Show the last good render instead,
   * dimmed, with the error on a strip. This is the single biggest usability
   * difference in the whole playground.
   */
  const lastGood = useRef<Spec | null>(null);
  if (parsed.ok) lastGood.current = parsed.value;
  const renderSpec = parsed.ok ? parsed.value : lastGood.current;

  const mergedHandlers = useMemo(() => {
    const base: Record<string, (p: Record<string, unknown>) => unknown> = {};
    const names = new Set(['submit', 'notify', 'reset', ...extraActions, ...Object.keys(handlers ?? {})]);
    for (const name of names) {
      base[name] = (params) => {
        pushLog('action', `${name}(${params && Object.keys(params).length ? shortJson(params) : ''})`);
        setFired((prev) => [...prev, name].slice(-200));
        return handlers?.[name]?.(params);
      };
    }
    return base;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handlers, pushLog, extraActions.join('|')]);

  const reset = useCallback(
    (nextSpec?: Spec, nextSeed?: Record<string, unknown>) => {
      // In a staged lab "reset" means back to THIS stage, not back to the
      // start of the lab — otherwise the button silently throws away five
      // stages of progress.
      setText(JSON.stringify(nextSpec ?? stage?.spec ?? initialSpec, null, 2));
      if (nextSpec) setActiveSeed(nextSeed);
      else setActiveSeed(stage?.seed ?? seedState);
      setLog([]);
      setFired([]);
      setWritten([]);
      setNonce((n) => n + 1);
    },
    [initialSpec, seedState, stage],
  );

  /** Load a stage's complete snapshot: spec, seed, and a clean log. */
  const goToStage = useCallback(
    (next: number) => {
      const target = stages?.[next];
      if (!target) return;
      setStageIndex(next);
      setText(JSON.stringify(target.spec, null, 2));
      setActiveSeed(target.seed);
      setLog([]);
      setFired([]);
      setWritten([]);
      setNonce((n) => n + 1);
      const allowed = target.panes ?? panes;
      setTab((cur) => (allowed.includes(cur) ? cur : allowed[0]));
      onStageChange?.(target, next);
    },
    [stages, onStageChange, panes],
  );

  /**
   * Scope the lab to the FIRST stage too.
   *
   * `goToStage` only runs when the learner navigates, so without this a lab
   * that keeps its own view in step with the stage opens on whatever it
   * defaulted to — correct only by accident.
   */
  const announced = useRef(false);
  useEffect(() => {
    if (announced.current || !stage) return;
    announced.current = true;
    onStageChange?.(stage, stageIndex);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * In fill mode the panes take whatever height the app frame leaves. Inner
   * widgets still want a NUMBER (CodeMirror, the code blocks, the source
   * panes), so measure the grid rather than guessing — otherwise every pane
   * needs its own magic constant and they disagree at every viewport.
   */
  const gridRef = useRef<HTMLDivElement>(null);
  const [measured, setMeasured] = useState<number | null>(null);

  useEffect(() => {
    if (!fill) return;
    const el = gridRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const h = Math.round(entry.contentRect.height);
      setMeasured((prev) => (prev !== null && Math.abs(prev - h) < 2 ? prev : h));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [fill]);

  const paneHeight = fill && measured ? Math.max(320, measured) : height;
  /* Hand the notes drawer the setup behind what is on screen, so a learner can
     read the catalog, the React and the provider call for THIS panel. */
  usePublishSetup({
    spec: renderSpec,
    seed: activeSeed,
    handlers: Object.keys(mergedHandlers),
    functions: Object.keys(functions ?? {}),
    directives: (directives ?? []).map((d) => d.name),
  });

  const issues = parsed.ok ? parsed.report.issues : [];
  const taskCtx: TaskContext = {
    spec: parsed.ok ? parsed.value : null,
    state: snapshot,
    fired,
    written,
  };

  return (
    <div
      className={cn(
        'flex gap-3',
        staged ? 'flex-col lg:flex-row lg:gap-4' : 'flex-col',
        // `my-6` is for the old document-flow usage. A staged lab always sits in
        // a gapped column, where that margin just doubles the spacing.
        fill ? 'h-full min-h-0' : staged ? '' : 'my-6',
      )}
    >
      {staged && stages ? (
        <StageRail
          slug={labSlug ?? ''}
          stages={stages}
          index={stageIndex}
          onGo={goToStage}
          ctx={taskCtx}
          onApply={(sol: TaskSolution) => {
            if (sol.spec) setText(JSON.stringify(sol.spec, null, 2));
            if (sol.seed) {
              setActiveSeed(sol.seed);
              setNonce((n) => n + 1);
            }
          }}
        />
      ) : null}

      <div className={cn('flex min-w-0 flex-1 flex-col gap-3', fill && 'min-h-0')}>
        {!staged && tasks && tasks.length > 0 && (
          <TaskList
            tasks={tasks}
            ctx={taskCtx}
            onApply={(sol: TaskSolution) => {
              // Load the finished answer into the editor. A new seed means a new
              // store, so the render starts from the solution's state too.
              if (sol.spec) setText(JSON.stringify(sol.spec, null, 2));
              if (sol.seed) {
                setActiveSeed(sol.seed);
                setNonce((n) => n + 1);
              }
            }}
          />
        )}

        {toolbar && <div className="shrink-0">{toolbar}</div>}

        {presets && presets.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">load:</span>
            {presets.map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => reset(p.spec, p.seedState)}
                className="rounded-sm border px-2 py-0.5 text-[12px] text-muted-foreground transition hover:border-orange-500 hover:text-foreground"
              >
                {p.label}
              </button>
            ))}
          </div>
        )}

        {insert && (
          <InsertBar spec={renderSpec} onInsert={(next) => setText(JSON.stringify(next, null, 2))} />
        )}

        <div
          ref={gridRef}
          className={cn('grid gap-3 lg:grid-cols-2', fill && 'min-h-0 flex-1')}
          style={fill ? undefined : { minHeight: height }}
        >
          <Panel
            title={
              <span className="flex items-center gap-1.5">
                <span className="size-1.5 rounded-full bg-emerald-500" aria-hidden />
                rendered output
              </span>
            }
            right={
              <button
                type="button"
                onClick={() => reset()}
                className="rounded-sm border bg-surface px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground"
              >
                reset
              </button>
            }
            bodyClassName="overflow-auto jr-canvas"
          >
            {!parsed.ok && (
              <div className="flex items-center gap-2 border-b border-yellow-200 bg-yellow-50 px-3 py-1.5 text-[12.5px] text-yellow-800 dark:border-yellow-900 dark:bg-yellow-950 dark:text-yellow-300">
                <span className="shrink-0 font-medium">Showing last valid render.</span>
                <span className="min-w-0 truncate font-mono text-[11.5px] opacity-80">{parsed.error}</span>
              </div>
            )}
            <div
              className={cn('p-4 transition-opacity', !parsed.ok && 'opacity-45')}
              style={{ minHeight: Math.min(paneHeight - 44, 360) }}
            >
              {renderSpec ? (
                <JSONUIProvider
                  key={nonce}
                  registry={demoRegistry}
                  store={store}
                  handlers={mergedHandlers}
                  functions={functions}
                  directives={directives}
                >
                  <Renderer spec={renderSpec} registry={demoRegistry} fallback={UnknownComponent} />
                </JSONUIProvider>
              ) : (
                <div className="font-mono text-[12px] text-muted-foreground">Nothing to render yet.</div>
              )}
            </div>
            {hint && <div className="border-t bg-muted px-4 py-2 text-[12px] text-muted-foreground">{hint}</div>}
          </Panel>

          <Panel
            title={<Tabs tabs={paneTabs(shownPanes, log.length)} active={tab} onChange={(id) => setTab(id as typeof tab)} />}
            right={
              tab === 'spec' ? (
                <CopyButton text={text} />
              ) : tab === 'log' ? (
                <button
                  type="button"
                  onClick={() => setLog([])}
                  className="rounded border bg-surface px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground hover:text-foreground"
                >
                  clear
                </button>
              ) : null
            }
            bodyClassName="flex flex-col min-h-0"
          >
            {tab === 'spec' && (
              <>
                <div className="min-h-0 flex-1 overflow-hidden">
                  <JsonEditor value={text} onChange={editable ? setText : undefined} readOnly={!editable} />
                </div>
                <div className="shrink-0 border-t bg-muted px-3 py-1.5 font-mono text-[11px]">
                  {!parsed.ok ? (
                    <span className="text-red-600 dark:text-red-400">invalid JSON</span>
                  ) : issues.length === 0 ? (
                    <span className="text-emerald-600 dark:text-emerald-400">validateSpec: clean</span>
                  ) : (
                    <div className="flex flex-col gap-0.5 text-yellow-600 dark:text-yellow-400">
                      {issues.slice(0, 4).map((i, idx) => (
                        <span key={idx}>
                          {i.code}: {i.message}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}

            {tab === 'state' && (
              <div className="min-h-0 flex-1 overflow-auto">
                {Object.keys(snapshot).length === 0 ? (
                  <div className="p-3 text-[13px] text-muted-foreground">
                    The state model is empty. Bind an input, or seed it.
                  </div>
                ) : (
                  <CodeBlock code={JSON.stringify(snapshot, null, 2)} lang="json" maxHeight={paneHeight - 34} fill />
                )}
              </div>
            )}

            {tab === 'tree' && (
              <div className="flex min-h-0 flex-1 flex-col">
                <SpecTree
                  spec={renderSpec}
                  state={snapshot}
                  functions={functions}
                  directives={directives}
                  selected={selected}
                  onSelect={setSelected}
                />
                <ResolveInspector
                  spec={renderSpec}
                  state={snapshot}
                  elementKey={selected}
                  functions={functions}
                  directives={directives}
                />
              </div>
            )}

            {tab === 'catalog' && <SourcePane spec={renderSpec} mode="catalog" height={paneHeight} />}

            {tab === 'impl' && <SourcePane spec={renderSpec} mode="impl" height={paneHeight} />}

            {tab === 'wiring' && <WiringPane blocks={wiring ?? []} height={paneHeight} />}

            {tab === 'log' && (
              <div className="min-h-0 flex-1 overflow-auto p-2 font-mono text-[12px]" style={{ maxHeight: paneHeight }}>
                {log.length === 0 ? (
                  <div className="p-2 text-muted-foreground">No activity yet. Interact with the preview.</div>
                ) : (
                  log.map((l) => (
                    <div key={l.id} className="animate-in-soft flex gap-2 rounded px-2 py-1 hover:bg-muted">
                      <span className={l.kind === 'action' ? 'text-orange-600 dark:text-orange-400' : 'text-emerald-600 dark:text-emerald-400'}>
                        {l.kind === 'action' ? 'action' : 'write '}
                      </span>
                      <span className="min-w-0 break-all text-muted-foreground">{l.text}</span>
                    </div>
                  ))
                )}
              </div>
            )}
          </Panel>
        </div>

        {/* Capped and separately scrolling, so a lab's own readouts never grow
            the page or squeeze the panes above them. */}
        {below && <div className="flex max-h-[38vh] shrink-0 flex-col gap-3 overflow-auto">{below}</div>}
      </div>
    </div>
  );
}

function paneTabs(
  panes: Array<'tree' | 'spec' | 'state' | 'log' | 'catalog' | 'impl' | 'wiring'>,
  logCount: number,
) {
  const LABEL: Record<string, string> = {
    tree: 'tree',
    spec: 'spec json',
    state: 'state',
    log: 'log',
    catalog: 'catalog',
    impl: 'component code',
    wiring: 'your app code',
  };
  return panes.map((p) => ({ id: p, label: LABEL[p] ?? p, badge: p === 'log' ? logCount : undefined }));
}

function shortJson(v: unknown) {
  const s = JSON.stringify(v);
  if (s === undefined) return String(v);
  return s.length > 70 ? `${s.slice(0, 70)}…` : s;
}
