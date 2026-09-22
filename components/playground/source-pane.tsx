'use client';

import type { Spec } from '@json-render/core';
import { useMemo, useState } from 'react';
import { ACTION_NAMES, CATALOG_ENTRIES, COMPONENT_NAMES, IMPL_ENTRIES } from '@/lib/demo/source.generated';
import { CodeBlock } from './code-block';
import { Chip } from './ui';

/**
 * Shows the catalog entries and registry implementations behind whatever the
 * current spec actually uses — so a lab is self-contained. You never have to
 * leave the page to find out what `Metric` is declared as or how it renders.
 *
 * Source text comes from lib/demo/source.generated.ts, emitted from the real
 * files by scripts/gen-source.ts, so it cannot drift.
 */

/** Component types reachable in the spec, in first-seen order. */
export function usedComponentTypes(spec: Spec | null): string[] {
  const seen: string[] = [];
  for (const el of Object.values(spec?.elements ?? {})) {
    if (el?.type && !seen.includes(el.type)) seen.push(el.type);
  }
  return seen;
}

/** Action names referenced by any `on` or `watch` binding. */
export function usedActionNames(spec: Spec | null): string[] {
  const found = new Set<string>();
  const walk = (v: unknown) => {
    if (Array.isArray(v)) {
      for (const x of v) walk(x);
      return;
    }
    if (v && typeof v === 'object') {
      const o = v as Record<string, unknown>;
      if (typeof o.action === 'string') found.add(o.action);
      for (const x of Object.values(o)) walk(x);
    }
  };
  for (const el of Object.values(spec?.elements ?? {})) {
    walk((el as { on?: unknown }).on);
    walk((el as { watch?: unknown }).watch);
  }
  return [...found];
}

const BUILT_IN_ACTIONS = new Set(['setState', 'pushState', 'removeState', 'validateForm', 'push', 'pop']);

export function SourcePane({ spec, mode, height }: { spec: Spec | null; mode: 'catalog' | 'impl'; height: number }) {
  /**
   * "used here" is the useful default, but it made the labs unlearnable: a task
   * saying "add a Badge" showed a catalog containing everything EXCEPT Badge,
   * because Badge was not in the spec yet. The one component you need was the
   * one filtered out. Hence the toggle.
   */
  const [scope, setScope] = useState<'used' | 'all'>('used');

  const { blocks, missing } = useMemo(() => {
    const source = mode === 'catalog' ? CATALOG_ENTRIES : IMPL_ENTRIES;
    const types = scope === 'all' ? COMPONENT_NAMES.filter((t) => source[t]) : usedComponentTypes(spec);
    const known = types.filter((t) => source[t]);
    const unknown = types.filter((t) => !CATALOG_ENTRIES[t]);

    const out: Array<{ name: string; code: string; kind: 'component' | 'action' }> = known.map((t) => ({
      name: t,
      code: source[t],
      kind: 'component' as const,
    }));

    if (mode === 'catalog') {
      for (const a of scope === 'all' ? ACTION_NAMES : usedActionNames(spec)) {
        if (BUILT_IN_ACTIONS.has(a)) continue;
        if (ACTION_NAMES.includes(a) && CATALOG_ENTRIES[a]) {
          out.push({ name: a, code: CATALOG_ENTRIES[a], kind: 'action' });
        }
      }
    }
    return { blocks: out, missing: scope === 'all' ? [] : unknown };
  }, [spec, mode, scope]);

  return (
    <div className="overflow-y-auto" style={{ maxHeight: height }}>
      <div className="flex flex-wrap items-center gap-2 border-b bg-muted px-3 py-1.5">
        <Chip active={scope === 'used'} onClick={() => setScope('used')}>
          used here
        </Chip>
        <Chip active={scope === 'all'} onClick={() => setScope('all')}>
          all {COMPONENT_NAMES.length}
        </Chip>
        <span className="text-[12px] text-muted-foreground">
          {scope === 'used'
            ? 'Only what this spec references.'
            : 'Every component in the catalog — browse before you add one.'}
        </span>
      </div>

      <div className="border-b bg-muted px-3 py-1.5 text-[12px] leading-relaxed text-muted-foreground">
        {mode === 'catalog' ? (
          <>
            From <code className="font-mono text-foreground">lib/demo/catalog.ts</code> — the declarations the AI
            prompt is generated from, for the components this spec uses.
          </>
        ) : (
          <>
            From <code className="font-mono text-foreground">lib/demo/components.tsx</code> — the React that these
            component names render as.
          </>
        )}
      </div>

      {blocks.length === 0 && (
        <div className="p-3 text-[13px] text-muted-foreground">Nothing to show — the spec has no known components.</div>
      )}

      {blocks.map((b) => (
        <div key={`${b.kind}:${b.name}`} className="border-b last:border-b-0">
          <div className="flex items-center gap-2 bg-card px-3 py-1">
            <span className="font-mono text-[12px] font-medium text-foreground">{b.name}</span>
            <span className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">{b.kind}</span>
          </div>
          <CodeBlock
            code={b.code}
            lang={mode === 'catalog' ? 'typescript' : 'tsx'}
            maxHeight="none"
            showLineNumbers={false}
          />
        </div>
      ))}

      {missing.length > 0 && (
        <div className="border-t bg-red-50 px-3 py-2 text-[12px] text-red-700 dark:bg-red-950 dark:text-red-300">
          Not in the catalog: <span className="font-mono">{missing.join(', ')}</span> — these render the fallback.
        </div>
      )}
    </div>
  );
}
