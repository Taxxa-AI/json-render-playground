'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { concept as conceptById } from '@/lib/concepts';
import { CodeBlock } from '@/components/playground/code-block';
import { Button } from '@/components/ui/button';
import { specChanges, type Stage } from '@/lib/labs/types';
import { cn } from '@/lib/utils';
import { useGuided } from './guided';
import type { TaskContext, TaskSolution } from './task-list';

/**
 * The lesson column.
 *
 * Shaped after a course lesson rather than a toolbar: a heading you can read,
 * prose at a size you can read it at, one ASSIGNMENT section, the list of
 * stages down the side, and Back / Next at the bottom. The first version of
 * this was a single horizontal strip of eight 11px mono chips, which is lab
 * chrome — it told you the feature existed without ever feeling like a course.
 *
 * Three controls, not eight. Everything else is either always visible (the
 * lesson, the assignment) or is navigation (the stage list, Back, Next).
 *
 * Serves both kinds of lab. A SPEC-DRIVEN lab passes `ctx` and each stage
 * carries a `check`; a BESPOKE lab computes completion itself and passes
 * `done`, exactly as it used to hand `Checklist` a flag per item.
 */
export function StageRail({
  slug,
  stages,
  index,
  onGo,
  ctx,
  onApply,
}: {
  /** Step slug of the lab being staged. */
  slug: string;
  stages: Stage[];
  index: number;
  onGo: (next: number) => void;
  /** Spec-driven labs: the live spec/state/log, against which a part's `check` runs. */
  ctx?: TaskContext;
  onApply?: (solution: TaskSolution) => void;
}) {
  const [showHint, setShowHint] = useState(false);
  const [showSolution, setShowSolution] = useState(false);
  const { guided, setGuided } = useGuided();

  const stage = stages[index];
  const card = stage.concept ? conceptById(stage.concept) : undefined;

  /**
   * A stage is one FEATURE; its parts are the steps that show it off. The
   * lesson above is about the feature, so only the current part's help is on
   * screen — the others are ticks.
   */
  const partDone = stage.parts.map((part) => (part.check ? runCheck(part.check, ctx) : Boolean(part.done)));
  const partIndex = partDone.findIndex((d) => !d);
  const work = stage.parts[partIndex === -1 ? stage.parts.length - 1 : partIndex];

  const summary = card?.summary ?? stage.summary;
  const gotcha = card?.gotcha;
  const shape = card?.shape;
  const changes = specChanges(stages[index - 1]?.spec, stage.spec);

  /**
   * Once cleared, a stage stays cleared — several stages ask you to undo the
   * previous one on purpose, and re-evaluating from scratch made the list jump
   * backwards. Same latch `TaskList` uses, for the same reason.
   */
  const latched = useRef<boolean[]>(stages.map(() => false));
  const passing = partDone.every(Boolean);
  if (passing) latched.current[index] = true;
  const cleared = latched.current;

  const first = index === 0;
  const last = index === stages.length - 1;

  const go = useCallback(
    (next: number) => {
      if (next < 0 || next >= stages.length) return;
      onGo(next);
    },
    [onGo, stages.length],
  );

  // A new stage closes the reveals, so a solution never lingers over the next goal.
  useEffect(() => {
    setShowHint(false);
    setShowSolution(false);
  }, [index, partIndex]);

  // Keyboard navigation, the way a course does it.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey) return;
      if (e.key === ',') {
        e.preventDefault();
        go(index - 1);
      } else if (e.key === '.') {
        e.preventDefault();
        go(index + 1);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go, index]);

  return (
    // The app already owns a 252px sidebar, so this column has to earn its width
    // back from the playground: narrow on a laptop, roomier above 1536.
    <aside className="flex w-full shrink-0 flex-col overflow-hidden rounded-lg border bg-card lg:h-full lg:w-[320px] 2xl:w-[380px]">
      {/* ---- The lesson ---- */}
      <div className="min-h-0 flex-1 overflow-auto">
        <div className="flex flex-col gap-5 px-5 py-5">
          <header>
            <p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
              Stage {index + 1} of {stages.length}
            </p>
            <h2 className="mt-2 font-display text-[22px] leading-[1.15] tracking-tight text-foreground">
              {stage.title}
            </h2>
          </header>

          {summary && <p className="text-[14.5px] leading-relaxed text-foreground">{summary}</p>}

          {shape && (
            <div className="overflow-hidden rounded-md border">
              <CodeBlock code={shape} lang={card?.lang ?? 'json'} maxHeight={190} showLineNumbers={false} />
            </div>
          )}

          {gotcha && (
            <div className="flex gap-2.5 rounded-md border border-red-200 bg-red-50/60 px-3 py-2.5 dark:border-red-900 dark:bg-red-950/40">
              <span className="mt-[7px] size-1.5 shrink-0 rounded-full bg-red-500" aria-hidden />
              <p className="text-[13.5px] leading-relaxed text-red-900 dark:text-red-200">{gotcha}</p>
            </div>
          )}

          {changes.length > 0 && (
            <p className="text-[13px] leading-relaxed text-muted-foreground">
              <span className="font-mono text-[11px] uppercase tracking-wider">changed since stage {index}</span>
              <br />
              {changes.map((c, i) => (
                <span key={c.key}>
                  {i > 0 && ', '}
                  <code
                    className={cn(
                      'font-mono',
                      c.kind === 'added'
                        ? 'text-emerald-700 dark:text-emerald-400'
                        : c.kind === 'removed'
                          ? 'text-red-700 dark:text-red-400'
                          : 'text-orange-700 dark:text-orange-400',
                    )}
                  >
                    {c.kind === 'added' ? 'new ' : c.kind === 'removed' ? 'gone ' : 'edited '}
                    {c.key}
                  </code>
                </span>
              ))}
            </p>
          )}

          {stage.when && (
            <div className="rounded-md border border-blue-200 bg-blue-50/60 px-3 py-2.5 dark:border-blue-900 dark:bg-blue-950/40">
              <p className="font-mono text-[10px] uppercase tracking-wider text-blue-700 dark:text-blue-300">
                when you reach for it
              </p>
              <p className="mt-1 text-[13.5px] leading-relaxed text-blue-900 dark:text-blue-200">{stage.when}</p>
            </div>
          )}

          {(stage.ref || stage.refs?.length) && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px]">
              <span className="uppercase tracking-wider text-muted-foreground">reference</span>
              {[stage.ref, ...(stage.refs ?? [])].filter(Boolean).map((id) => (
                <a
                  key={id}
                  href={`/reference#${id}`}
                  className="text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                >
                  {id}
                </a>
              ))}
            </div>
          )}

          {/* ---- The assignment ---- */}
          <section className="flex flex-col gap-3 border-t pt-4">
            <h3 className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">Assignment</h3>
            {stage.parts.length === 1 ? (
              <div className="text-[14.5px] leading-relaxed text-foreground">{work.goal}</div>
            ) : (
              <ol className="flex flex-col gap-2">
                {stage.parts.map((part, i) => (
                  <li
                    // biome-ignore lint/suspicious/noArrayIndexKey: fixed ordered list
                    key={i}
                    className="flex items-start gap-2.5"
                  >
                    <span
                      className={cn(
                        'mt-[3px] flex size-4 shrink-0 items-center justify-center rounded-full border text-[10px] font-bold',
                        partDone[i]
                          ? 'border-emerald-500 bg-emerald-500 text-white'
                          : i === partIndex
                            ? 'border-orange-500 text-orange-600 dark:text-orange-400'
                            : 'border-border text-muted-foreground',
                      )}
                    >
                      {partDone[i] ? '✓' : i + 1}
                    </span>
                    <span
                      className={cn(
                        'min-w-0 text-[14px] leading-relaxed',
                        partDone[i] ? 'text-muted-foreground' : 'text-foreground',
                      )}
                    >
                      {part.goal}
                    </span>
                  </li>
                ))}
              </ol>
            )}

            {guided && work.steps?.length ? (
              <ol className="flex flex-col gap-2">
                {work.steps.map((s, i) => (
                  <li
                    // biome-ignore lint/suspicious/noArrayIndexKey: fixed ordered list
                    key={i}
                    className="flex items-start gap-2.5 text-[13.5px] leading-relaxed text-muted-foreground"
                  >
                    <span className="mt-[1px] w-4 shrink-0 text-right font-mono text-[12px] tabular-nums text-orange-600 dark:text-orange-400">
                      {i + 1}
                    </span>
                    <span className="min-w-0">{s}</span>
                  </li>
                ))}
              </ol>
            ) : null}

            <div className="flex flex-wrap items-center gap-2 pt-0.5">
              {work.steps?.length ? (
                <Button type="button" variant="outline" size="sm" onClick={() => setGuided(!guided)}>
                  {guided ? 'Hide steps' : 'Step by step'}
                </Button>
              ) : null}
              {work.hint && (
                <Button type="button" variant="outline" size="sm" onClick={() => setShowHint((v) => !v)}>
                  {showHint ? 'Hide hint' : 'Hint'}
                </Button>
              )}
              {work.solution && (
                <Button type="button" variant="outline" size="sm" onClick={() => setShowSolution((v) => !v)}>
                  {showSolution ? 'Hide solution' : 'Solution'}
                </Button>
              )}
              {work.apply && (
                <Button type="button" variant="action" size="sm" onClick={work.apply.run}>
                  {work.apply.label ?? 'Do it for me'}
                </Button>
              )}
            </div>

            {showHint && work.hint && (
              <p className="rounded-md border bg-muted px-3 py-2.5 text-[13.5px] leading-relaxed text-muted-foreground">
                {work.hint}
              </p>
            )}

            {showSolution && work.solution && (
              <div className="overflow-hidden rounded-md border bg-muted">
                {work.solution.note && (
                  <p className="px-3 py-2.5 text-[13.5px] leading-relaxed text-muted-foreground">
                    {work.solution.note}
                  </p>
                )}
                {onApply && (work.solution.spec || work.solution.seed) && (
                  <div className="border-t px-3 py-2">
                    <Button type="button" variant="action" size="sm" onClick={() => onApply(work.solution!)}>
                      Apply to editor
                    </Button>
                  </div>
                )}
                {work.solution.spec && (
                  <div className="border-t">
                    <CodeBlock
                      code={JSON.stringify(work.solution.spec, null, 2)}
                      lang="json"
                      maxHeight={200}
                      showLineNumbers={false}
                    />
                  </div>
                )}
              </div>
            )}
          </section>
        </div>
      </div>

      {/* ---- Where you are ---- */}
      {/* A percentage cap only bites when the rail has a definite height, which
          it has only while the lab fills the frame. Unfilled — a lab with its own
          panels around the playground — an eighteen-stage list rendered at full
          length and pushed the page past the viewport. The vh cap always applies. */}
      <ol className="max-h-[min(34%,30vh)] shrink-0 overflow-auto border-t">
        {stages.map((s, i) => (
          <li key={s.id}>
            <button
              type="button"
              onClick={() => go(i)}
              className={cn(
                'flex w-full items-center gap-2.5 px-4 py-2 text-left transition-colors hover:bg-surface-hover',
                i === index && 'bg-surface',
              )}
            >
              <span
                className={cn(
                  'flex size-5 shrink-0 items-center justify-center rounded-full border font-mono text-[11px] font-bold',
                  cleared[i]
                    ? 'border-emerald-500 bg-emerald-500 text-white'
                    : i === index
                      ? 'border-orange-500 text-orange-600 dark:text-orange-400'
                      : 'border-border text-muted-foreground',
                )}
              >
                {cleared[i] ? '✓' : i + 1}
              </span>
              <span
                className={cn(
                  'min-w-0 truncate text-[13.5px] leading-snug',
                  i === index ? 'font-medium text-foreground' : 'text-muted-foreground',
                )}
              >
                {s.title}
              </span>
            </button>
          </li>
        ))}
      </ol>

      {/* ---- Back / Next ---- */}
      <div className="flex shrink-0 items-center gap-2 border-t bg-muted px-4 py-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={first}
          onClick={() => go(index - 1)}
          title="Previous stage (ctrl+,)"
        >
          ← Back
        </Button>

        {last ? (
          <span
            className={cn(
              'flex-1 text-center text-[13px] font-medium',
              passing ? 'text-emerald-700 dark:text-emerald-400' : 'text-muted-foreground',
            )}
          >
            {passing ? 'Lab complete' : 'Last stage'}
          </span>
        ) : (
          <Button
            type="button"
            variant={passing ? 'action' : 'outline'}
            size="sm"
            onClick={() => go(index + 1)}
            title={`${stages[index + 1].title} (ctrl+.)`}
            className="flex-1"
          >
            {passing ? 'Next →' : 'Skip ahead →'}
          </Button>
        )}
      </div>
    </aside>
  );
}

/** A check must never throw — a half-typed spec is the normal case. */
function runCheck(check: (ctx: TaskContext) => boolean, ctx?: TaskContext): boolean {
  if (!ctx) return false;
  try {
    return check(ctx);
  } catch {
    return false;
  }
}
