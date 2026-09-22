'use client';

import type { ComputedFunction, DirectiveDefinition, Spec, UIElement } from '@json-render/core';
import {
  createDirectiveRegistry,
  evaluateVisibility,
  resolveBindings,
  resolveElementProps,
  resolvePropValue,
  splitRepeatVisibility,
} from '@json-render/core';
import { useMemo } from 'react';
import { cn } from '@/lib/utils';

/**
 * The element graph, drawn.
 *
 * A spec is a flat map, so the tree it describes is invisible until you walk
 * it. This walks it and annotates every node with what the renderer is
 * actually about to do: hidden by a condition, repeated N times, bound to a
 * state path, carrying an event, missing entirely.
 *
 * Everything here calls the same core functions the renderer calls
 * (`evaluateVisibility`, `resolveElementProps`, `resolveBindings`,
 * `splitRepeatVisibility`) — it is a window on the real pipeline, not a model
 * of it.
 */

export interface TreeNode {
  key: string;
  element: UIElement | null;
  slot: string | null;
  depth: number;
  missing: boolean;
  hidden: boolean;
  repeatCount: number | null;
  cycle: boolean;
}

export function buildTree(
  spec: Spec | null,
  state: Record<string, unknown>,
  functions?: Record<string, ComputedFunction>,
  directives?: DirectiveDefinition[],
): { nodes: TreeNode[]; orphans: string[] } {
  const nodes: TreeNode[] = [];
  if (!spec?.root) return { nodes, orphans: [] };

  const ctx = {
    stateModel: state,
    functions,
    ...(directives?.length ? { directives: createDirectiveRegistry(directives) } : {}),
  };
  const seen = new Set<string>();

  const walk = (key: string, depth: number, slot: string | null, ancestry: Set<string>) => {
    const element = (spec.elements?.[key] ?? null) as UIElement | null;

    if (ancestry.has(key)) {
      nodes.push({ key, element, slot, depth, missing: false, hidden: false, repeatCount: null, cycle: true });
      return;
    }
    if (!element) {
      nodes.push({ key, element: null, slot, depth, missing: true, hidden: false, repeatCount: null, cycle: false });
      return;
    }
    seen.add(key);

    // Repeat splits its condition: $item conjuncts filter items, the rest gate
    // the container. Mirror that so the count is honest.
    const repeat = element.repeat as { statePath?: unknown; key?: string } | undefined;
    let repeatCount: number | null = null;
    let hidden = false;

    if (repeat) {
      const { container, itemFilter } = splitRepeatVisibility(element.visible);
      hidden = container !== undefined && !evaluateVisibility(container, ctx);
      const path = typeof repeat.statePath === 'string' ? repeat.statePath : null;
      const arr = path ? resolvePropValue({ $state: path }, ctx) : null;
      if (Array.isArray(arr)) {
        repeatCount = itemFilter
          ? arr.filter((item, index) => evaluateVisibility(itemFilter, { ...ctx, repeatItem: item, repeatIndex: index }))
              .length
          : arr.length;
      } else {
        repeatCount = 0;
      }
    } else {
      hidden = element.visible !== undefined && !evaluateVisibility(element.visible, ctx);
    }

    nodes.push({ key, element, slot, depth, missing: false, hidden, repeatCount, cycle: false });

    const nextAncestry = new Set(ancestry).add(key);
    for (const c of element.children ?? []) walk(c, depth + 1, null, nextAncestry);
    for (const [slotName, list] of Object.entries(element.slots ?? {})) {
      for (const c of list ?? []) walk(c, depth + 1, slotName, nextAncestry);
    }
  };

  walk(spec.root, 0, null, new Set());

  const orphans = Object.keys(spec.elements ?? {}).filter((k) => !seen.has(k));
  return { nodes, orphans };
}

export function SpecTree({
  spec,
  state,
  functions,
  directives,
  selected,
  onSelect,
}: {
  spec: Spec | null;
  state: Record<string, unknown>;
  functions?: Record<string, ComputedFunction>;
  directives?: DirectiveDefinition[];
  selected: string | null;
  onSelect: (key: string) => void;
}) {
  const { nodes, orphans } = useMemo(
    () => buildTree(spec, state, functions, directives),
    [spec, state, functions, directives],
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 border-b bg-muted px-3 py-1.5 text-[12px] text-muted-foreground">
        The tree the renderer will walk, from <code className="font-mono text-foreground">root</code>. Click a node
        to inspect its props.
      </div>

      <div className="min-h-0 flex-1 overflow-auto p-1.5 font-mono text-[12px]">
        {nodes.length === 0 && <div className="p-2 text-muted-foreground">No root — nothing renders.</div>}

        {nodes.map((n, i) => (
          <button
            // biome-ignore lint/suspicious/noArrayIndexKey: the same key can legitimately appear twice
            key={`${n.key}-${i}`}
            type="button"
            onClick={() => onSelect(n.key)}
            className={cn(
              'flex w-full items-center gap-1.5 rounded-sm px-1.5 py-[3px] text-left transition-colors',
              selected === n.key ? 'bg-surface-hover' : 'hover:bg-surface',
              n.hidden && 'opacity-45',
            )}
            style={{ paddingLeft: 6 + n.depth * 14 }}
          >
            <span className="text-muted-foreground">{n.depth > 0 ? '└' : '•'}</span>

            {n.missing ? (
              <>
                <span className="text-red-600 dark:text-red-400">{n.key}</span>
                <Tag tone="bad">missing</Tag>
              </>
            ) : n.cycle ? (
              <>
                <span className="text-red-600 dark:text-red-400">{n.key}</span>
                <Tag tone="bad">cycle</Tag>
              </>
            ) : (
              <>
                <span className="text-foreground">{n.element?.type}</span>
                <span className="truncate text-muted-foreground">{n.key}</span>
                {n.slot && <Tag tone="info">slot:{n.slot}</Tag>}
                {n.repeatCount !== null && (
                  <Tag tone={n.repeatCount === 0 ? 'warn' : 'ok'}>repeat ×{n.repeatCount}</Tag>
                )}
                {n.hidden && <Tag tone="warn">hidden</Tag>}
                {n.element?.on && <Tag tone="info">on</Tag>}
                {n.element?.watch && <Tag tone="info">watch</Tag>}
                {hasBind(n.element) && <Tag tone="ok">bound</Tag>}
              </>
            )}
          </button>
        ))}

        {orphans.length > 0 && (
          <div className="mt-2 rounded-sm border border-yellow-200 bg-yellow-50 px-2 py-1.5 text-[11.5px] text-yellow-700 dark:border-yellow-900 dark:bg-yellow-950 dark:text-yellow-300">
            Defined but unreachable from root: {orphans.join(', ')} — these never render.
          </div>
        )}
      </div>
    </div>
  );
}

function hasBind(el: UIElement | null) {
  if (!el?.props) return false;
  return Object.values(el.props).some(
    (v) => v && typeof v === 'object' && ('$bindState' in v || '$bindItem' in v),
  );
}

function Tag({ tone, children }: { tone: 'ok' | 'bad' | 'warn' | 'info'; children: React.ReactNode }) {
  const map = {
    ok: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300',
    bad: 'border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300',
    warn: 'border-yellow-200 bg-yellow-50 text-yellow-700 dark:border-yellow-900 dark:bg-yellow-950 dark:text-yellow-300',
    info: 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-300',
  };
  return (
    <span className={cn('shrink-0 rounded-sm border px-1 text-[10px] leading-[1.4]', map[tone])}>{children}</span>
  );
}

/** Handled by ActionProvider itself — no handler needed, and declared in the React schema. */
const BUILT_IN_ACTIONS = new Set(['setState', 'pushState', 'removeState', 'validateForm']);

function bindingList(v: unknown): Array<{ action: string; params?: unknown }> {
  if (!v) return [];
  const arr = Array.isArray(v) ? v : [v];
  return arr.filter((b): b is { action: string } => Boolean(b) && typeof b === 'object').map((b) => b as { action: string });
}

/**
 * Raw prop → resolved value → binding path, for one element, plus every
 * element-level field underneath. This IS the pipeline: the renderer calls
 * exactly these functions before your component sees anything.
 *
 * The props half answers "what will my component receive". The element half
 * answers the question that actually blocks people — "why is this node not
 * here / not repeating / not firing" — by showing `visible`, `repeat`, `on`,
 * `watch` and `slots` raw and evaluated, side by side.
 */
export function ResolveInspector({
  spec,
  state,
  elementKey,
  functions,
  directives,
}: {
  spec: Spec | null;
  state: Record<string, unknown>;
  elementKey: string | null;
  functions?: Record<string, ComputedFunction>;
  directives?: DirectiveDefinition[];
}) {
  const data = useMemo(() => {
    const el = elementKey ? (spec?.elements?.[elementKey] as UIElement | undefined) : undefined;
    if (!el) return null;
    const ctx = {
      stateModel: state,
      functions,
      ...(directives?.length ? { directives: createDirectiveRegistry(directives) } : {}),
    };
    const raw = (el.props ?? {}) as Record<string, unknown>;
    let resolved: Record<string, unknown> = {};
    let bindings: Record<string, string> | undefined;
    let error: string | null = null;
    try {
      resolved = resolveElementProps(raw, ctx);
      bindings = resolveBindings(raw, ctx);
    } catch (e) {
      error = (e as Error).message;
    }

    // `repeat` changes what `visible` means: the renderer splits the condition
    // into a container gate and a per-item filter, so report both.
    const repeat = el.repeat as { statePath?: unknown; key?: string } | undefined;
    const split = repeat ? splitRepeatVisibility(el.visible) : null;
    const gate = split ? split.container : el.visible;
    const visible = gate === undefined ? null : evaluateVisibility(gate, ctx);

    let repeatValue: unknown;
    if (repeat) {
      repeatValue =
        typeof repeat.statePath === 'string'
          ? resolvePropValue({ $state: repeat.statePath }, ctx)
          : resolvePropValue(repeat.statePath, ctx);
    }

    const defined = new Set(Object.keys(spec?.elements ?? {}));
    const slots = Object.entries(el.slots ?? {}).map(([name, keys]) => ({
      name,
      keys: keys ?? [],
      missing: (keys ?? []).filter((k) => !defined.has(k)),
    }));

    return { el, raw, resolved, bindings, error, visible, repeat, split, repeatValue, slots };
  }, [spec, state, elementKey, functions, directives]);

  if (!data) {
    return (
      <div className="border-t bg-muted px-3 py-2 text-[12px] text-muted-foreground">
        Select a node above to see its props resolve.
      </div>
    );
  }

  const keys = Object.keys(data.raw);

  return (
    <div className="shrink-0 border-t bg-card">
      <div className="flex items-center gap-2 border-b bg-muted px-3 py-1">
        <span className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
          resolveElementProps · {elementKey}
        </span>
        {data.visible !== null && (
          <Tag tone={data.visible ? 'ok' : 'warn'}>{data.visible ? 'visible' : 'hidden'}</Tag>
        )}
      </div>

      {data.error && (
        <div className="px-3 py-1.5 font-mono text-[11.5px] text-red-600 dark:text-red-400">{data.error}</div>
      )}

      <div className="max-h-[260px] overflow-auto">
        {keys.length === 0 ? (
          <div className="px-3 py-2 text-[12px] text-muted-foreground">No props.</div>
        ) : (
          <ul className="divide-y">
            {keys.map((k) => {
              const isExpr = data.raw[k] !== null && typeof data.raw[k] === 'object';
              const out = data.resolved[k];
              const bind = data.bindings?.[k];
              return (
                <li key={k} className="px-3 py-1.5 font-mono text-[11.5px]">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground">{k}</span>
                    {bind && (
                      <span className="rounded-sm border border-emerald-200 bg-emerald-50 px-1 text-[10px] text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300">
                        ⇄ {bind}
                      </span>
                    )}
                  </div>

                  {isExpr ? (
                    <div className="mt-0.5 grid grid-cols-[74px_1fr] gap-x-2 gap-y-0.5">
                      <span className="text-muted-foreground">in spec</span>
                      <span className="break-all text-blue-600 dark:text-blue-400">{short(data.raw[k])}</span>
                      <span className="text-muted-foreground">resolves to</span>
                      <span
                        className={cn(
                          'break-all',
                          out === undefined ? 'text-yellow-600 dark:text-yellow-400' : 'text-foreground',
                        )}
                      >
                        {out === undefined ? 'undefined' : short(out)}
                      </span>
                    </div>
                  ) : (
                    <div className="mt-0.5 grid grid-cols-[74px_1fr] gap-x-2">
                      <span className="text-muted-foreground">literal</span>
                      <span className="break-all text-muted-foreground">{short(data.raw[k])}</span>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        <ElementFields data={data} />
      </div>
    </div>
  );
}

/**
 * Everything on the element that is NOT a prop.
 *
 * Props are the easy half — the hard half is the four fields that decide
 * whether the element exists at all, how many times, and what it can trigger.
 * Same two-column grid as the prop rows so it reads as one list.
 */
function ElementFields({
  data,
}: {
  data: {
    el: UIElement;
    visible: boolean | null;
    repeat?: { statePath?: unknown; key?: string };
    split: { container: unknown; itemFilter: unknown } | null;
    repeatValue: unknown;
    slots: Array<{ name: string; keys: string[]; missing: string[] }>;
  };
}) {
  const { el, visible, repeat, split, repeatValue, slots } = data;
  const on = Object.entries(el.on ?? {});
  const watch = Object.entries(el.watch ?? {});
  const has = el.visible !== undefined || repeat || on.length > 0 || watch.length > 0 || slots.length > 0;

  return (
    <div className="border-t">
      <div className="bg-muted px-3 py-1 font-mono text-[10.5px] uppercase tracking-wide text-muted-foreground">
        element fields · beside type and props
      </div>

      {!has ? (
        <div className="px-3 py-2 font-mono text-[11.5px] text-muted-foreground">
          none — no visible, repeat, on, watch or slots on this element.
        </div>
      ) : (
        <ul className="divide-y">
          {el.visible !== undefined && (
            <Row name="visible" tag={visible === null ? undefined : visible ? 'ok' : 'warn'} tagText={visible === null ? undefined : visible ? 'shown' : 'hidden'}>
              {repeat && split ? (
                <>
                  <Cell k="in spec" v={short(el.visible)} tone="expr" />
                  <Cell
                    k="container"
                    v={split.container === undefined ? 'no gate — always shown' : `${short(split.container)} → ${String(visible)}`}
                  />
                  <Cell
                    k="item filter"
                    v={
                      split.itemFilter === undefined
                        ? 'none — every item renders'
                        : `${short(split.itemFilter)} → run once per item`
                    }
                    tone={split.itemFilter === undefined ? undefined : 'expr'}
                  />
                </>
              ) : (
                <>
                  <Cell k="in spec" v={short(el.visible)} tone="expr" />
                  <Cell k="evaluates to" v={String(visible)} tone={visible ? undefined : 'warn'} />
                </>
              )}
            </Row>
          )}

          {repeat && (
            <Row name="repeat" tag={Array.isArray(repeatValue) ? 'ok' : 'bad'} tagText={Array.isArray(repeatValue) ? `×${repeatValue.length}` : 'not an array'}>
              <Cell k="statePath" v={short(repeat.statePath)} tone="expr" />
              <Cell
                k="resolves to"
                v={
                  Array.isArray(repeatValue)
                    ? `array of ${repeatValue.length}`
                    : repeatValue === undefined
                      ? 'undefined — not an array, so zero children render'
                      : `${typeof repeatValue} — not an array, so zero children render`
                }
                tone={Array.isArray(repeatValue) ? undefined : 'warn'}
              />
              <Cell k="key" v={repeat.key ? repeat.key : 'none — React keys by index'} tone={repeat.key ? undefined : 'warn'} />
            </Row>
          )}

          {on.length > 0 && (
            <Row name="on" tagText={`${on.length} event${on.length === 1 ? '' : 's'}`}>
              {on.map(([event, binding]) => (
                <Cell
                  key={event}
                  k={event}
                  v={bindingList(binding)
                    .map((b) => `${b.action}${BUILT_IN_ACTIONS.has(b.action) ? ' (built-in)' : ' (your handler)'}`)
                    .join(' → ') || 'no action'}
                />
              ))}
            </Row>
          )}

          {watch.length > 0 && (
            <Row name="watch" tagText={`${watch.length} path${watch.length === 1 ? '' : 's'}`}>
              {watch.map(([path, binding]) => (
                <Cell
                  key={path}
                  k={path}
                  v={bindingList(binding)
                    .map((b) => `${b.action}${BUILT_IN_ACTIONS.has(b.action) ? ' (built-in)' : ' (your handler)'}`)
                    .join(' → ') || 'no action'}
                />
              ))}
            </Row>
          )}

          {slots.length > 0 && (
            <Row name="slots" tag={slots.some((s) => s.missing.length) ? 'bad' : undefined} tagText={slots.some((s) => s.missing.length) ? 'missing keys' : undefined}>
              {slots.map((s) => (
                <Cell
                  key={s.name}
                  k={s.name}
                  v={
                    s.keys.length === 0
                      ? 'empty — the component gets undefined'
                      : s.missing.length
                        ? `${s.keys.join(', ')} — missing: ${s.missing.join(', ')}`
                        : s.keys.join(', ')
                  }
                  tone={s.missing.length ? 'warn' : undefined}
                />
              ))}
            </Row>
          )}
        </ul>
      )}
    </div>
  );
}

function Row({
  name,
  tag,
  tagText,
  children,
}: {
  name: string;
  tag?: 'ok' | 'bad' | 'warn';
  tagText?: string;
  children: React.ReactNode;
}) {
  return (
    <li className="px-3 py-1.5 font-mono text-[11.5px]">
      <div className="flex items-center gap-2">
        <span className="font-medium text-foreground">{name}</span>
        {tagText && <Tag tone={tag ?? 'info'}>{tagText}</Tag>}
      </div>
      <div className="mt-0.5 grid grid-cols-[74px_1fr] gap-x-2 gap-y-0.5">{children}</div>
    </li>
  );
}

function Cell({ k, v, tone }: { k: string; v: string; tone?: 'expr' | 'warn' }) {
  return (
    <>
      <span className="truncate text-muted-foreground" title={k}>
        {k}
      </span>
      <span
        className={cn(
          'break-all',
          tone === 'expr'
            ? 'text-blue-600 dark:text-blue-400'
            : tone === 'warn'
              ? 'text-yellow-600 dark:text-yellow-400'
              : 'text-foreground',
        )}
      >
        {v}
      </span>
    </>
  );
}

function short(v: unknown) {
  if (v === undefined) return 'undefined';
  const s = JSON.stringify(v);
  if (s === undefined) return String(v);
  return s.length > 64 ? `${s.slice(0, 64)}…` : s;
}
