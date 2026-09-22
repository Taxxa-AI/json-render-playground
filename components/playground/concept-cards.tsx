'use client';

import { createStateStore } from '@json-render/core';
import { JSONUIProvider, Renderer } from '@json-render/react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { concepts } from '@/lib/concepts';
import type { Concept } from '@/lib/concepts';
import { demoRegistry, UnknownComponent } from '@/lib/demo/registry';
import { stepBySlug } from '@/lib/steps';
import { cn } from '@/lib/utils';
import { CodeBlock } from './code-block';

/**
 * The concept strip: one chip per concept a lab introduces, collapsed by
 * default, one open at a time. Sits between the app bar and the lab so a
 * newcomer reads the definition BEFORE the task asks them to use it.
 *
 * Per-lab dismissal is remembered in localStorage — a returning learner does
 * not want to see "children are keys" on every visit.
 */
export function ConceptCards({ ids, storageKey }: { ids: string[]; storageKey: string }) {
  const list = useMemo(() => concepts(ids), [ids]);
  const [open, setOpen] = useState<string | null>(null);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    try {
      setHidden(localStorage.getItem(`jr-concepts:${storageKey}`) === 'hidden');
    } catch {
      /* private mode */
    }
  }, [storageKey]);

  function dismiss(next: boolean) {
    setHidden(next);
    try {
      localStorage.setItem(`jr-concepts:${storageKey}`, next ? 'hidden' : 'shown');
    } catch {
      /* private mode */
    }
  }

  if (list.length === 0) return null;

  if (hidden) {
    return (
      <div className="flex items-center gap-2 px-0.5 pb-2">
        <span className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">concepts</span>
        <button
          type="button"
          onClick={() => dismiss(false)}
          className="rounded-sm border bg-surface px-1.5 py-px font-mono text-[10px] text-muted-foreground hover:bg-surface-hover hover:text-foreground"
        >
          show {list.length}
        </button>
      </div>
    );
  }

  const active = open ? list.find((c) => c.id === open) ?? null : null;

  return (
    <div className="mb-3 overflow-hidden rounded-lg border bg-card">
      <div className="flex items-center gap-1.5 overflow-x-auto px-3 py-1.5">
        <span className="shrink-0 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
          before you start
        </span>
        {list.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setOpen((cur) => (cur === c.id ? null : c.id))}
            className={cn(
              'shrink-0 whitespace-nowrap rounded-sm border px-2 py-0.5 font-mono text-[11.5px] transition-colors',
              open === c.id
                ? 'border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-900 dark:bg-orange-950 dark:text-orange-300'
                : 'bg-surface text-muted-foreground hover:bg-surface-hover hover:text-foreground',
            )}
          >
            {c.title}
          </button>
        ))}
        <button
          type="button"
          onClick={() => dismiss(true)}
          title="Hide these for this lab"
          className="ml-auto shrink-0 rounded-sm border bg-surface px-1.5 py-px font-mono text-[10px] text-muted-foreground hover:bg-surface-hover hover:text-foreground"
        >
          hide
        </button>
      </div>

      {active && <ConceptBody c={active} currentStep={storageKey} />}
    </div>
  );
}

function ConceptBody({ c, currentStep }: { c: Concept; currentStep?: string }) {
  // On a staged lab the concept is shown INSIDE the lab it points at, so the
  // "full lab" link would just reload the page you are on.
  const step = c.step && c.step !== currentStep ? stepBySlug(c.step) : undefined;
  const store = useMemo(() => createStateStore(structuredClone(c.example?.seed ?? {})), [c]);

  return (
    <div className="grid gap-0 border-t lg:grid-cols-[1fr_1fr]">
      <div className="flex flex-col gap-2 px-3.5 py-3">
        <p className="text-[14px] leading-relaxed text-foreground">{c.summary}</p>
        {c.gotcha && (
          <p className="flex gap-2 text-[13px] leading-relaxed text-muted-foreground">
            <span className="mt-[7px] size-1 shrink-0 rounded-full bg-red-500" aria-hidden />
            <span>{c.gotcha}</span>
          </p>
        )}
        <div className="mt-auto flex flex-wrap items-center gap-2 pt-1 font-mono text-[11px]">
          {step && (
            <Link href={`/steps/${step.slug}`} className="text-muted-foreground hover:text-foreground">
              full lab → step {step.n} · {step.title}
            </Link>
          )}
          {c.ref && (
            <Link href={`/reference#${c.ref}`} className="text-muted-foreground hover:text-foreground">
              reference → {c.ref}
            </Link>
          )}
        </div>
      </div>

      <div className="flex min-w-0 flex-col border-t lg:border-l lg:border-t-0">
        {c.shape && (
          <CodeBlock code={c.shape} lang={c.lang ?? 'json'} maxHeight={220} showLineNumbers={false} />
        )}
        {c.example && (
          <div className="jr-canvas border-t p-3">
            <JSONUIProvider registry={demoRegistry} store={store}>
              <Renderer spec={c.example.spec} registry={demoRegistry} fallback={UnknownComponent} />
            </JSONUIProvider>
          </div>
        )}
      </div>
    </div>
  );
}
