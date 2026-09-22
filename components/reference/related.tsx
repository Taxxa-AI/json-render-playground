'use client';

import { referenceEntry } from '@/lib/reference';

/**
 * Chips that jump to other entries. Plain anchors, not next/link: the target
 * is on this page, and the browser's own hash navigation is what drives the
 * highlight in the rail.
 */
export function Related({ ids }: { ids: string[] }) {
  const entries = ids.map((id) => referenceEntry(id)).filter((e) => e !== undefined);
  if (entries.length === 0) return null;

  return (
    <div className="mt-3 flex flex-wrap items-center gap-1.5">
      <span className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">see also</span>
      {entries.map((e) => (
        <a
          key={e.id}
          href={`#${e.id}`}
          className="shrink-0 whitespace-nowrap rounded-sm border bg-surface px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground no-underline transition-colors hover:bg-surface-hover hover:text-foreground"
        >
          {e.name.length > 30 ? `${e.name.slice(0, 29)}…` : e.name}
        </a>
      ))}
    </div>
  );
}
