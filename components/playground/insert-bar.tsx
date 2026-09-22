'use client';

import type { Spec, UIElement } from '@json-render/core';
import { useState } from 'react';
import { CATALOG_EXAMPLES, COMPONENT_NAMES } from '@/lib/demo/source.generated';
import { Chip } from './ui';

/**
 * Add a component without hand-typing JSON.
 *
 * The lesson of the shape step is "an element must be DEFINED and REFERENCED" —
 * two places, or it does not render. Typing thirty characters of JSON into a
 * scrolling textarea without a bracket matcher teaches nothing about that and
 * fails on a missing comma. This inserts a correct stub, wires it into the
 * parent you choose, and leaves the interesting decision — where it goes, and
 * what happens if you unhook it — to the learner.
 */

function uniqueKey(spec: Spec, base: string) {
  const lower = base.charAt(0).toLowerCase() + base.slice(1);
  if (!spec.elements?.[lower]) return lower;
  let n = 2;
  while (spec.elements?.[`${lower}${n}`]) n += 1;
  return `${lower}${n}`;
}

/** Containers are the sensible insertion targets. */
function containerKeys(spec: Spec): string[] {
  return Object.entries(spec.elements ?? {})
    .filter(([, el]) => Array.isArray((el as UIElement).children))
    .map(([k]) => k);
}

export function InsertBar({
  spec,
  onInsert,
}: {
  spec: Spec | null;
  /** Receives the whole new spec; the playground re-serialises it. */
  onInsert: (next: Spec) => void;
}) {
  const [parent, setParent] = useState<string>('');

  if (!spec?.root) return null;
  const parents = containerKeys(spec);
  const target = parent && parents.includes(parent) ? parent : (parents[0] ?? spec.root);

  function add(name: string) {
    if (!spec) return;
    const key = uniqueKey(spec, name);
    const example = (CATALOG_EXAMPLES[name] ?? {}) as Record<string, unknown>;

    const next: Spec = {
      ...spec,
      elements: {
        ...spec.elements,
        // 1. DEFINE it.
        [key]: { type: name, props: structuredClone(example), children: [] } as UIElement,
        // 2. REFERENCE it. Miss this and it exists but never renders.
        [target]: {
          ...(spec.elements[target] as UIElement),
          children: [...((spec.elements[target] as UIElement).children ?? []), key],
        },
      },
    };
    onInsert(next);
  }

  return (
    <div className="flex items-center gap-1.5 rounded-lg border bg-card px-3 py-2">
      <span className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">add</span>

      {/* One scrolling row: wrapping to three lines pushed the playground itself
          below the fold, which is the problem this bar exists to avoid. */}
      <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto pb-0.5">
        {COMPONENT_NAMES.map((n) => (
          <Chip key={n} onClick={() => add(n)}>
            + {n}
          </Chip>
        ))}
      </div>

      <span className="flex shrink-0 items-center gap-1.5">
        <span className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">into</span>
        <select
          value={target}
          onChange={(e) => setParent(e.target.value)}
          className="rounded-sm border bg-surface px-1.5 py-0.5 font-mono text-[11.5px] text-foreground outline-none focus:border-orange-500"
        >
          {parents.map((k) => (
            <option key={k} value={k}>
              {k} ({(spec.elements[k] as UIElement).type})
            </option>
          ))}
        </select>
      </span>
    </div>
  );
}
