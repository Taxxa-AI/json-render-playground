import type { Spec, UIElement } from '@json-render/core';

/** Every element in a spec, as [key, element] pairs. */
export function entries(spec: Spec | null): Array<[string, UIElement]> {
  return Object.entries(spec?.elements ?? {}) as Array<[string, UIElement]>;
}

export function byType(spec: Spec | null, type: string): UIElement[] {
  return entries(spec)
    .map(([, el]) => el)
    .filter((el) => el.type === type);
}

export function find(spec: Spec | null, pred: (el: UIElement, key: string) => boolean): UIElement | undefined {
  return entries(spec).find(([k, el]) => pred(el, k))?.[1];
}

export function some(spec: Spec | null, pred: (el: UIElement, key: string) => boolean): boolean {
  return entries(spec).some(([k, el]) => pred(el, k));
}

/** Read a JSON Pointer out of any object. Returns undefined rather than throwing. */
export function at(obj: unknown, pointer: string): unknown {
  if (!pointer || pointer === '/') return obj;
  let cur: unknown = obj;
  for (const rawSeg of pointer.replace(/^\//, '').split('/')) {
    const seg = rawSeg.replace(/~1/g, '/').replace(/~0/g, '~');
    if (cur === null || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[seg];
  }
  return cur;
}

/** Deep search any JSON value for a node matching a predicate. */
export function deepFind(value: unknown, pred: (node: Record<string, unknown>) => boolean): Record<string, unknown> | null {
  if (Array.isArray(value)) {
    for (const v of value) {
      const hit = deepFind(v, pred);
      if (hit) return hit;
    }
    return null;
  }
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    if (pred(obj)) return obj;
    for (const v of Object.values(obj)) {
      const hit = deepFind(v, pred);
      if (hit) return hit;
    }
  }
  return null;
}

/** True when the value contains an expression object with this `$` key anywhere. */
export function usesExpression(value: unknown, key: string, expected?: unknown): boolean {
  return Boolean(
    deepFind(value, (n) => key in n && (expected === undefined || n[key] === expected)),
  );
}

/** Walk from root following `children` and `slots`, returning reachable keys. */
export function reachable(spec: Spec | null): Set<string> {
  const seen = new Set<string>();
  if (!spec?.root) return seen;
  const queue = [spec.root];
  while (queue.length) {
    const key = queue.shift() as string;
    if (seen.has(key)) continue;
    const el = spec.elements?.[key] as UIElement | undefined;
    if (!el) continue;
    seen.add(key);
    for (const c of el.children ?? []) queue.push(c);
    for (const list of Object.values(el.slots ?? {})) for (const c of list ?? []) queue.push(c);
  }
  return seen;
}
