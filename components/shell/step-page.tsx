'use client';

import Link from 'next/link';
import { useState } from 'react';
import { neighbours, stepBySlug } from '@/lib/steps';
import { cn } from '@/lib/utils';
import { ConceptCards } from '@/components/playground/concept-cards';
import { SetupPane } from '@/components/playground/setup-pane';
import { resetSetup } from '@/lib/labs/setup';

/**
 * An app frame, not an article.
 *
 * This used to be a scrolling document: title, paragraph, a sixteen-line code
 * block, THEN the thing you came to use. You had to scroll past the docs to
 * reach the playground, which is exactly backwards — so it read as
 * documentation with a widget in it.
 *
 * Now the lab owns the viewport and never scrolls out of view. The prose,
 * tables and gotchas live in a notes panel you open when you want them.
 */
export function StepPage({
  slug,
  lab,
  concepts,
  children,
}: {
  slug: string;
  /** The interactive part. Fills the frame. */
  lab?: React.ReactNode;
  /** Concept ids (lib/concepts) this lab introduces. Rendered as a strip above the lab. */
  concepts?: string[];
  /** Reference material. Lives in the notes panel. */
  children: React.ReactNode;
}) {
  /* Start each STEP with an empty setup; the lab below fills it if it has one.
     Keyed by slug: this frame re-renders whenever the drawer opens, and the
     lab does not, so an unconditional reset would wipe what it published. */
  resetSetup(slug);

  const [notes, setNotes] = useState(false);
  /* The drawer opens on the SOURCE, not the prose: the question a learner has
     mid-lab is almost always "what is actually running here". */
  const [drawer, setDrawer] = useState<'setup' | 'notes'>('setup');
  const step = stepBySlug(slug);
  const { prev, next } = neighbours(slug);
  if (!step) return null;

  // Pages that have not been converted to `lab` still render top-to-bottom.
  if (!lab) {
    return (
      <article className="mx-auto w-full max-w-[1760px] px-5 py-8 lg:px-10 lg:py-10">
        <Header step={step} />
        {concepts && concepts.length > 0 && <ConceptCards ids={concepts} storageKey={slug} />}
        <div className="prose-doc">{children}</div>
        <Footer prev={prev} next={next} />
      </article>
    );
  }

  return (
    <div className="flex h-dvh min-w-0 flex-col overflow-hidden">
      {/* App bar */}
      <header className="flex shrink-0 items-center gap-3 border-b px-5 py-2.5 lg:px-6">
        <span className="font-mono text-[14px] tabular-nums text-muted-foreground">
          {String(step.n).padStart(2, '0')}
        </span>
        <h1 className="font-display text-[20px] leading-none tracking-tight text-foreground">{step.title}</h1>
        <span className="hidden text-[13px] text-muted-foreground xl:block">· {step.blurb}</span>

        <div className="ml-auto flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setNotes((v) => !v)}
            className={cn(
              'rounded-md border px-2.5 py-1 font-mono text-[11px] uppercase tracking-wide transition-colors',
              notes ? 'bg-surface-hover text-foreground' : 'bg-surface text-muted-foreground hover:bg-surface-hover',
            )}
          >
            notes
          </button>
          {prev && (
            <Link
              href={`/steps/${prev.slug}`}
              title={prev.title}
              className="rounded-md border bg-surface px-2 py-1 font-mono text-[11px] text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground"
            >
              ←
            </Link>
          )}
          {next && (
            <Link
              href={`/steps/${next.slug}`}
              className="flex items-center gap-1.5 rounded-md border bg-surface px-2.5 py-1 font-mono text-[11px] text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground"
            >
              <span className="hidden truncate sm:inline">{next.title}</span> →
            </Link>
          )}
        </div>
      </header>

      {/* The lab owns everything below the bar. Labs that fill (`h-full`) get
          the whole frame; labs taller than the frame scroll instead of clipping. */}
      <div className="flex min-h-0 flex-1 flex-col overflow-auto px-5 py-4 lg:px-6">
        {concepts && concepts.length > 0 && <ConceptCards ids={concepts} storageKey={slug} />}
        <div className="min-h-0 flex-1">{lab}</div>
      </div>

      {/* Notes: a panel, not the page. */}
      {notes && (
        <>
          <button
            type="button"
            aria-label="Close notes"
            onClick={() => setNotes(false)}
            className="fixed inset-0 z-40 cursor-default bg-black/20"
          />
          <aside className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[640px] flex-col border-l bg-background shadow-lg">
            <div className="flex shrink-0 items-center justify-between border-b bg-muted px-4 py-2">
              <div className="flex items-center gap-1">
                {(['setup', 'notes'] as const).map((id) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setDrawer(id)}
                    className={cn(
                      'rounded-sm border px-2 py-0.5 font-mono text-[11px] transition-colors',
                      drawer === id
                        ? 'bg-surface-hover text-foreground'
                        : 'bg-surface text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {id === 'setup' ? 'the setup' : 'notes'}
                  </button>
                ))}
                <span className="ml-2 font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
                  {step.title}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setNotes(false)}
                className="rounded-sm border bg-surface px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground hover:bg-surface-hover hover:text-foreground"
              >
                close
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-auto px-5 py-4">
              {drawer === 'setup' ? <SetupPane /> : <div className="prose-doc">{children}</div>}
            </div>
          </aside>
        </>
      )}
    </div>
  );
}

function Header({ step }: { step: NonNullable<ReturnType<typeof stepBySlug>> }) {
  return (
    <header className="mb-6 flex items-baseline gap-3 border-b pb-4">
      <span className="font-mono text-[14px] tabular-nums text-muted-foreground">
        {String(step.n).padStart(2, '0')}
      </span>
      <h1 className="font-display text-[30px] leading-tight tracking-tight text-foreground">{step.title}</h1>
      <span className="ml-auto hidden font-mono text-[11px] uppercase tracking-wide text-muted-foreground sm:block">
        {step.group}
      </span>
    </header>
  );
}

function Footer({
  prev,
  next,
}: {
  prev: ReturnType<typeof neighbours>['prev'];
  next: ReturnType<typeof neighbours>['next'];
}) {
  return (
    <nav className="mt-12 flex items-stretch justify-between gap-2 border-t pt-5">
      {prev ? (
        <Link
          href={`/steps/${prev.slug}`}
          className="flex max-w-[48%] flex-col rounded-md border bg-surface px-3 py-2 transition-colors hover:bg-surface-hover"
        >
          <span className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">← prev</span>
          <span className="mt-0.5 truncate font-mono text-[14px] text-foreground">{prev.title}</span>
        </Link>
      ) : (
        <span />
      )}
      {next ? (
        <Link
          href={`/steps/${next.slug}`}
          className="flex max-w-[48%] flex-col items-end rounded-md border bg-surface px-3 py-2 text-right transition-colors hover:bg-surface-hover"
        >
          <span className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">next →</span>
          <span className="mt-0.5 truncate font-mono text-[14px] text-foreground">{next.title}</span>
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}
