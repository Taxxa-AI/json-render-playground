import type { Spec } from '@json-render/core';

/**
 * A concept card: the smallest unit of teaching in the playground.
 *
 * One card explains ONE thing a learner meets for the first time in a lab —
 * "children are keys", "$bindState", "repeat + $item filters". Cards render
 * as a collapsed strip above the lab and expand on click, so the lab is never
 * pushed below the fold.
 */
export interface Concept {
  /** Stable id, kebab-case. Referenced from step pages and the reference explorer. */
  id: string;
  /** Two to four words. */
  title: string;
  /** One or two sentences a newcomer can act on. Plain text. */
  summary: string;
  /** The exact JSON / TS shape, as code. Keep it under ten lines. */
  shape?: string;
  /** Language for `shape`. Defaults to json. */
  lang?: 'json' | 'typescript' | 'tsx' | 'text';
  /** A tiny live example the card can render with the demo registry. */
  example?: { spec: Spec; seed?: Record<string, unknown> };
  /** The silent failure or trap that goes with this concept, if any. */
  gotcha?: string;
  /** Slug of the step that exercises it fully. */
  step?: string;
  /** Id of the matching entry in /reference, if any. */
  ref?: string;
}
