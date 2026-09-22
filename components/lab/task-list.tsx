'use client';

import type { Spec } from '@json-render/core';
import { useEffect, useRef, useState } from 'react';
import { CodeBlock } from '@/components/playground/code-block';
import { cn } from '@/lib/utils';
import { useGuided } from './guided';

export interface TaskContext {
  spec: Spec | null;
  state: Record<string, unknown>;
  /** Names of actions dispatched so far this session. */
  fired: string[];
  /** State paths written so far this session. */
  written: string[];
}

/** A finished answer the learner can load into the editor. */
export interface TaskSolution {
  /** The whole spec after the task is done. */
  spec?: Spec;
  /** A replacement seed, when the task needs different state. */
  seed?: Record<string, unknown>;
  /** One or two sentences: what changed and why it works. */
  note?: React.ReactNode;
}

export interface Task {
  id: string;
  /** What to do and why it matters. One or two sentences. */
  goal: React.ReactNode;
  /** The rule first, then the concrete JSON. */
  hint?: React.ReactNode;
  /**
   * Click-by-click instructions, one action per entry, imperative:
   * "Open the spec json tab." "Find the card element." "Add "status" to its children."
   * Shown when guided mode is on, or when the learner presses "guide me".
   */
  steps?: React.ReactNode[];
  /** The finished answer. "apply" loads it into the editor. */
  solution?: TaskSolution;
  /** Return true once the learner has done it. Must not throw. */
  check: (ctx: TaskContext) => boolean;
}

export function safeCheck(task: Task, ctx: TaskContext): boolean {
  try {
    return task.check(ctx);
  } catch {
    return false;
  }
}

/**
 * A guided strip, not a wall.
 *
 * Shows ONE task (the first incomplete one) plus a dot for each, and expands
 * on demand. Three levels of help, in order of how much they give away:
 *   hint      — the rule, then the JSON
 *   guide me  — click-by-click steps
 *   solution  — the finished spec, with an "apply" button
 * Guided mode (persisted) opens the steps automatically for every task.
 */
export function TaskList({
  tasks,
  ctx,
  onApply,
  onProgress,
}: {
  tasks: Task[];
  ctx: TaskContext;
  /** Supplied by the playground: loads a solution into the editor. */
  onApply?: (solution: TaskSolution) => void;
  /** Reports completion outwards, for a stage rail that sits above this lab. */
  onProgress?: (done: number, total: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [showSteps, setShowSteps] = useState(false);
  const [showSolution, setShowSolution] = useState(false);
  const { guided, setGuided } = useGuided();

  /**
   * Once achieved, a task stays achieved.
   *
   * Several labs ask you to UNDO the previous step on purpose. Re-evaluating
   * from scratch made step 1 un-tick when you did step 2, and the guided strip
   * jumped backwards. Latching keeps the sequence honest.
   */
  const latched = useRef<boolean[]>(tasks.map(() => false));
  const live = tasks.map((t) => safeCheck(t, ctx));
  const status = live.map((v, i) => v || latched.current[i]);

  useEffect(() => {
    for (const [i, v] of live.entries()) if (v) latched.current[i] = true;
  });
  const done = status.filter(Boolean).length;
  const all = done === tasks.length;

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => onProgress?.(done, tasks.length), [done, tasks.length]);
  const currentIndex = status.findIndex((s) => !s);
  const current = currentIndex === -1 ? null : tasks[currentIndex];

  // A new task closes the reveal panels, so a solution never lingers over the next goal.
  const currentId = current?.id ?? null;
  useEffect(() => {
    setShowHint(false);
    setShowSolution(false);
    setShowSteps(false);
  }, [currentId]);

  const stepsOpen = Boolean(current?.steps?.length) && (guided || showSteps);

  return (
    <div
      className={cn(
        'overflow-hidden rounded-lg border transition-colors',
        all ? 'border-emerald-300 bg-emerald-50/40 dark:border-emerald-800 dark:bg-emerald-950/30' : 'bg-card',
      )}
    >
      {/* One row. Progress dots + the task you are on. */}
      <div className="flex items-center gap-3 px-3 py-2">
        <span className="shrink-0 font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
          your turn
        </span>

        <div className="flex shrink-0 items-center gap-1" aria-label={`${done} of ${tasks.length} done`}>
          {status.map((s, i) => (
            <span
              // biome-ignore lint/suspicious/noArrayIndexKey: fixed ordered list
              key={i}
              className={cn(
                'size-2 rounded-full transition-colors',
                s ? 'bg-emerald-500' : i === currentIndex ? 'bg-orange-500' : 'bg-border',
              )}
            />
          ))}
        </div>

        <div className="min-w-0 flex-1 text-[14px] leading-snug">
          {all ? (
            <span className="font-medium text-emerald-700 dark:text-emerald-400">
              All {tasks.length} done — on you go.
            </span>
          ) : (
            <span className="text-foreground">{current?.goal}</span>
          )}
        </div>

        {!all && current && (
          <div className="flex shrink-0 items-center gap-1">
            {current.hint && (
              <StripButton active={showHint} onClick={() => setShowHint((v) => !v)}>
                hint
              </StripButton>
            )}
            {current.steps?.length ? (
              <StripButton
                active={stepsOpen}
                onClick={() => (guided ? setGuided(false) : setShowSteps((v) => !v))}
                title={guided ? 'Guided mode is on. Click to turn it off.' : 'Show click-by-click steps'}
              >
                guide me
              </StripButton>
            ) : null}
            {current.solution && (
              <StripButton active={showSolution} onClick={() => setShowSolution((v) => !v)}>
                solution
              </StripButton>
            )}
          </div>
        )}

        <button
          type="button"
          onClick={() => setGuided(!guided)}
          title="Guided mode opens the steps for every task automatically"
          className={cn(
            'shrink-0 rounded-sm border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide transition-colors',
            guided
              ? 'border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-900 dark:bg-orange-950 dark:text-orange-300'
              : 'bg-surface text-muted-foreground hover:bg-surface-hover hover:text-foreground',
          )}
        >
          guided {guided ? 'on' : 'off'}
        </button>

        <StripButton active={open} onClick={() => setOpen((v) => !v)}>
          {open ? 'hide all' : `all ${tasks.length}`}
        </StripButton>
      </div>

      {showHint && current?.hint && !all && (
        <div className="border-t bg-muted px-3 py-1.5 text-[13px] leading-relaxed text-muted-foreground">
          {current.hint}
        </div>
      )}

      {stepsOpen && current && !all && (
        <ol className="flex flex-col gap-1 border-t bg-muted px-3 py-2">
          {current.steps!.map((s, i) => (
            <li
              // biome-ignore lint/suspicious/noArrayIndexKey: fixed ordered list
              key={i}
              className="flex items-start gap-2 text-[13px] leading-relaxed text-foreground"
            >
              <span className="mt-[2px] w-4 shrink-0 text-right font-mono text-[11px] tabular-nums text-orange-600 dark:text-orange-400">
                {i + 1}
              </span>
              <span className="min-w-0">{s}</span>
            </li>
          ))}
        </ol>
      )}

      {showSolution && current?.solution && !all && (
        <div className="border-t bg-muted">
          <div className="flex items-center gap-2 px-3 py-1.5">
            <span className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">solution</span>
            {current.solution.note && (
              <span className="min-w-0 flex-1 text-[13px] leading-relaxed text-muted-foreground">
                {current.solution.note}
              </span>
            )}
            {onApply && (current.solution.spec || current.solution.seed) && (
              <button
                type="button"
                onClick={() => onApply(current.solution!)}
                className="ml-auto shrink-0 rounded-sm border border-orange-200 bg-orange-50 px-2 py-0.5 font-mono text-[11px] text-orange-700 transition-colors hover:bg-orange-100 dark:border-orange-900 dark:bg-orange-950 dark:text-orange-300 dark:hover:bg-orange-900"
              >
                apply to editor
              </button>
            )}
          </div>
          {current.solution.spec && (
            <div className="border-t">
              <CodeBlock
                code={JSON.stringify(current.solution.spec, null, 2)}
                lang="json"
                maxHeight={220}
                showLineNumbers={false}
              />
            </div>
          )}
        </div>
      )}

      {open && (
        <ol className="divide-y border-t">
          {tasks.map((t, i) => (
            <li key={t.id} className="flex items-start gap-2.5 px-3 py-1.5">
              <span
                className={cn(
                  'mt-[3px] flex size-4 shrink-0 items-center justify-center rounded-full border text-[10px] font-bold',
                  status[i]
                    ? 'border-emerald-500 bg-emerald-500 text-white'
                    : i === currentIndex
                      ? 'border-orange-500 text-orange-600 dark:text-orange-400'
                      : 'border-border text-transparent',
                )}
              >
                {status[i] ? '✓' : i + 1}
              </span>
              <span
                className={cn(
                  'text-[13.5px] leading-snug',
                  status[i] ? 'text-muted-foreground line-through' : 'text-foreground',
                )}
              >
                {t.goal}
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function StripButton({
  children,
  active,
  onClick,
  title,
}: {
  children: React.ReactNode;
  active?: boolean;
  onClick: () => void;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={cn(
        'shrink-0 rounded-sm border px-1.5 py-0.5 font-mono text-[11px] transition-colors',
        active
          ? 'bg-surface-hover text-foreground'
          : 'bg-surface text-muted-foreground hover:bg-surface-hover hover:text-foreground',
      )}
    >
      {children}
    </button>
  );
}
