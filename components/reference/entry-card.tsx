'use client';

import { CodeBlock } from '@/components/playground/code-block';
import { CopyButton } from '@/components/playground/ui';
import { StepRef } from '@/components/shell/step-ref';
import type { ReferenceEntry } from '@/lib/reference';
import { cn } from '@/lib/utils';
import { MiniRun } from './mini-run';
import { MiniSpec } from './mini-spec';
import { Related } from './related';

/**
 * One entry. The section id IS the deep link — `/reference#el-visible` — so
 * nothing here may change without updating whoever links to it.
 */
export function EntryCard({ entry, current }: { entry: ReferenceEntry; current: boolean }) {
  return (
    <section
      id={entry.id}
      className={cn(
        // scroll-mt keeps the heading clear of the sticky category bar.
        'scroll-mt-20 rounded-lg border bg-card transition-colors',
        current && 'border-orange-300 dark:border-orange-800',
      )}
    >
      <header className="flex flex-wrap items-center gap-2 border-b bg-muted px-3 py-2">
        <h3 className="min-w-0 break-all font-mono text-[13px] font-medium text-foreground">{entry.name}</h3>
        <span className="shrink-0 rounded-sm border bg-surface px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
          {entry.category}
        </span>
        <div className="ml-auto flex shrink-0 items-center gap-1.5">
          <StepRef slug={entry.step} short />
          <CopyButton text={`/reference#${entry.id}`} label="link" />
        </div>
      </header>

      <div className="px-3 py-3">
        <p className="text-[14px] leading-relaxed text-foreground">{entry.summary}</p>

        <div className="my-3 overflow-hidden rounded-md border">
          <CodeBlock code={entry.signature} lang={entry.lang ?? 'json'} maxHeight={280} />
        </div>

        <ul className="flex flex-col gap-1">
          {entry.details.map((d, i) => (
            <li key={i} className="flex gap-2">
              <span className="mt-[8px] size-1 shrink-0 rounded-full bg-muted-foreground/50" aria-hidden />
              <span className="text-[13.5px] leading-relaxed text-muted-foreground">{d}</span>
            </li>
          ))}
        </ul>

        {(entry.example || entry.failure) && <MiniSpec example={entry.example} failure={entry.failure} />}
        {entry.run && <MiniRun run={entry.run} />}
        <Related ids={entry.related} />
      </div>
    </section>
  );
}
