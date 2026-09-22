'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { useGuided } from './guided';

/**
 * The lightweight sibling of TaskList, for labs that are not spec-driven.
 * Same one-row guided shape: progress dots, the task you are on, hint,
 * click-by-click steps ("guide me"), and an optional one-click "do it for me".
 * A lab must never push its own playground below the fold.
 */
export interface ChecklistItem {
  /** What to do and why it matters. */
  label: React.ReactNode;
  done: boolean;
  /** The rule first, then the concrete action. */
  hint?: React.ReactNode;
  /** Click-by-click instructions, one action per entry, imperative. */
  steps?: React.ReactNode[];
  /** Performs the task for the learner (loads a preset, toggles a switch…). */
  apply?: { label?: string; run: () => void };
}

export function Checklist({
  items,
  title = 'your turn',
  onProgress,
}: {
  items: ChecklistItem[];
  title?: string;
  /** Reports completion outwards, for a stage rail that sits above this lab. */
  onProgress?: (done: number, total: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [showSteps, setShowSteps] = useState(false);
  const { guided, setGuided } = useGuided();

  // Latch, for the same reason as TaskList: some labs ask you to undo a step.
  const latched = useRef<boolean[]>(items.map(() => false));
  useEffect(() => {
    for (const [i, it] of items.entries()) if (it.done) latched.current[i] = true;
  });
  const status = items.map((it, i) => it.done || latched.current[i]);

  const done = status.filter(Boolean).length;
  const all = done === items.length;

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => onProgress?.(done, items.length), [done, items.length]);
  const currentIndex = status.findIndex((v) => !v);
  const current = currentIndex === -1 ? null : items[currentIndex];

  useEffect(() => {
    setShowHint(false);
    setShowSteps(false);
  }, [currentIndex]);

  const stepsOpen = Boolean(current?.steps?.length) && (guided || showSteps);

  return (
    <div
      className={cn(
        'overflow-hidden rounded-lg border transition-colors',
        all ? 'border-emerald-300 bg-emerald-50/40 dark:border-emerald-800 dark:bg-emerald-950/30' : 'bg-card',
      )}
    >
      <div className="flex items-center gap-3 px-3 py-2">
        <span className="shrink-0 font-mono text-[11px] uppercase tracking-wide text-muted-foreground">{title}</span>

        <div className="flex shrink-0 items-center gap-1">
          {items.map((it, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: fixed ordered list
            <span
              key={i}
              className={cn(
                'size-2 rounded-full transition-colors',
                status[i] ? 'bg-emerald-500' : i === currentIndex ? 'bg-orange-500' : 'bg-border',
              )}
            />
          ))}
        </div>

        <div className="min-w-0 flex-1 text-[14px] leading-snug">
          {all ? (
            <span className="font-medium text-emerald-700 dark:text-emerald-400">
              All {items.length} done — on you go.
            </span>
          ) : (
            <span className="text-foreground">{current?.label}</span>
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
            {current.apply && (
              <button
                type="button"
                onClick={current.apply.run}
                className="shrink-0 rounded-sm border border-orange-200 bg-orange-50 px-1.5 py-0.5 font-mono text-[11px] text-orange-700 transition-colors hover:bg-orange-100 dark:border-orange-900 dark:bg-orange-950 dark:text-orange-300 dark:hover:bg-orange-900"
              >
                {current.apply.label ?? 'do it for me'}
              </button>
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
          {open ? 'hide all' : `all ${items.length}`}
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

      {open && (
        <ol className="divide-y border-t">
          {items.map((it, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: fixed ordered list
            <li key={i} className="flex items-start gap-2.5 px-3 py-1.5">
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
                {it.label}
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
