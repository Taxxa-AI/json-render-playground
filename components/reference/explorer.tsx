'use client';

import { useEffect, useMemo, useState } from 'react';
import { REFERENCE_CATEGORIES, REFERENCE_ENTRIES, categorySlug, searchEntries, type ReferenceCategory } from '@/lib/reference';
import { cn } from '@/lib/utils';
import { EntryCard } from './entry-card';

/**
 * The rail, the search box and the main column.
 *
 * Hash handling is manual and deliberate. The browser scrolls to `#id` on
 * load only if that element is already in the DOM — with 117 entries and a
 * filter above them, it may not be. So we read the hash on mount and on
 * `hashchange`, clear the filter if it hides the target, and scroll it into
 * view ourselves on the next frame.
 */
export function ReferenceExplorer() {
  const [query, setQuery] = useState('');
  const [current, setCurrent] = useState('');

  useEffect(() => {
    const apply = () => {
      const id = decodeURIComponent(window.location.hash.replace(/^#/, ''));
      if (!id) return;
      setCurrent(id);
      // A filtered-out target cannot be scrolled to, so drop the filter when
      // the current query would hide it.
      setQuery((q) => {
        if (!q) return q;
        if (!REFERENCE_ENTRIES.some((e) => e.id === id)) return q;
        return searchEntries(q).some((e) => e.id === id) ? q : '';
      });
      // Two frames: one for the filter change to commit, one for layout.
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          document.getElementById(id)?.scrollIntoView({ block: 'start' });
        });
      });
    };
    apply();
    window.addEventListener('hashchange', apply);
    return () => window.removeEventListener('hashchange', apply);
  }, []);

  const matches = useMemo(() => searchEntries(query), [query]);
  const matchIds = useMemo(() => new Set(matches.map((m) => m.id)), [matches]);

  const groups = useMemo(
    () =>
      REFERENCE_CATEGORIES.map((category) => ({
        category,
        entries: matches.filter((e) => e.category === category),
      })).filter((g) => g.entries.length > 0),
    [matches],
  );

  const counts = useMemo(() => {
    const map = new Map<ReferenceCategory, { total: number; shown: number }>();
    for (const c of REFERENCE_CATEGORIES) map.set(c, { total: 0, shown: 0 });
    for (const e of REFERENCE_ENTRIES) {
      const row = map.get(e.category);
      if (!row) continue;
      row.total += 1;
      if (matchIds.has(e.id)) row.shown += 1;
    }
    return map;
  }, [matchIds]);

  return (
    <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:gap-8">
      {/* Rail. On mobile it collapses to a select, which is the only shape
          that stays usable at 360px with nine groups. */}
      <aside className="lg:sticky lg:top-6 lg:w-[232px] lg:shrink-0">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="search names, tags, summaries"
          className="w-full rounded-md border bg-surface px-2.5 py-1.5 font-mono text-[12px] text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
        <p className="mt-1.5 font-mono text-[11px] text-muted-foreground">
          {matches.length} of {REFERENCE_ENTRIES.length} entries
        </p>

        <select
          value={current}
          onChange={(e) => {
            const id = e.target.value;
            if (id) window.location.hash = id;
          }}
          className="mt-3 w-full rounded-md border bg-surface px-2.5 py-1.5 font-mono text-[12px] text-foreground lg:hidden"
        >
          <option value="">jump to…</option>
          {groups.map((g) => (
            <optgroup key={g.category} label={g.category}>
              {g.entries.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </optgroup>
          ))}
        </select>

        <nav className="mt-3 hidden max-h-[calc(100dvh-160px)] flex-col gap-3 overflow-auto lg:flex">
          {groups.map((g) => {
            const count = counts.get(g.category);
            return (
              <div key={g.category} className="flex flex-col gap-px">
                <div className="flex items-baseline justify-between px-1 pb-1">
                  <span className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
                    {g.category}
                  </span>
                  <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
                    {count && count.shown !== count.total ? `${count.shown}/${count.total}` : count?.total}
                  </span>
                </div>
                {g.entries.map((e) => (
                  <a
                    key={e.id}
                    href={`#${e.id}`}
                    onClick={() => setCurrent(e.id)}
                    className={cn(
                      'truncate rounded-sm px-1.5 py-0.5 font-mono text-[11.5px] no-underline transition-colors',
                      current === e.id
                        ? 'bg-orange-50 text-orange-700 dark:bg-orange-950 dark:text-orange-300'
                        : 'text-muted-foreground hover:bg-surface-hover hover:text-foreground',
                    )}
                  >
                    {e.name}
                  </a>
                ))}
              </div>
            );
          })}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col gap-8">
        {groups.length === 0 && (
          <p className="rounded-lg border bg-card px-3 py-6 text-center font-mono text-[12px] text-muted-foreground">
            Nothing matches &ldquo;{query}&rdquo;.
          </p>
        )}
        {groups.map((g) => (
          <section key={g.category} id={categorySlug(g.category)} className="flex min-w-0 scroll-mt-4 flex-col gap-3">
            <h2 className="sticky top-0 z-10 -mx-1 border-b bg-background/95 px-1 pb-1.5 pt-2 font-mono text-[11px] uppercase tracking-wide text-muted-foreground backdrop-blur">
              {g.category}
              <span className="ml-2 tabular-nums opacity-60">{g.entries.length}</span>
            </h2>
            {g.entries.map((e) => (
              <EntryCard key={e.id} entry={e} current={current === e.id} />
            ))}
          </section>
        ))}
      </div>
    </div>
  );
}
