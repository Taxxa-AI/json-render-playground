import type { Concept } from './types';
import { CORE_CONCEPTS } from './core';
import { PIPELINE_CONCEPTS } from './pipeline';
import { REFERENCE_CONCEPTS } from './reference';
import { RUNTIME_CONCEPTS } from './runtime';
import { YOURCODE_CONCEPTS } from './yourcode';

export type { Concept } from './types';

/**
 * All concepts, merged. Each file is owned by one area of the playground so
 * they can grow independently:
 *   core.ts       — spec grammar, expressions, binding, lists, actions, validation
 *   yourcode.ts   — catalog, registry, components, directives, handlers
 *   runtime.ts    — hooks, providers, stores, watchers
 *   pipeline.ts   — utilities, streaming/AI, shipping
 *   reference.ts  — anything the reference explorer needs that is not above
 */
const ALL: Concept[] = [
  ...CORE_CONCEPTS,
  ...YOURCODE_CONCEPTS,
  ...RUNTIME_CONCEPTS,
  ...PIPELINE_CONCEPTS,
  ...REFERENCE_CONCEPTS,
];

if (process.env.NODE_ENV !== 'production') {
  const seen = new Set<string>();
  for (const c of ALL) {
    if (seen.has(c.id)) console.warn(`[concepts] duplicate concept id: ${c.id}`);
    seen.add(c.id);
  }
}

export const CONCEPTS: Record<string, Concept> = Object.fromEntries(ALL.map((c) => [c.id, c]));

export function concept(id: string): Concept | undefined {
  return CONCEPTS[id];
}

export function concepts(ids: string[]): Concept[] {
  return ids.map((id) => CONCEPTS[id]).filter((c): c is Concept => Boolean(c));
}
