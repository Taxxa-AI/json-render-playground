import type { Spec } from '@json-render/core';

/**
 * The nine buckets the reference is grouped into. Order here is the order the
 * rail and the main column use, so it doubles as the reading order.
 */
export const REFERENCE_CATEGORIES = [
  'Spec & elements',
  'Expressions',
  'Conditions',
  'Actions',
  'Validation',
  'Component context',
  'Hooks',
  'Providers & components',
  'Core utilities',
] as const;

export type ReferenceCategory = (typeof REFERENCE_CATEGORIES)[number];

/** A live example: a spec the reader can edit, plus the state it starts with. */
export interface ReferenceExample {
  spec: Spec;
  /** Seed for the store. The renderer never reads `spec.state` — the host seeds. */
  seed?: Record<string, unknown>;
  note?: string;
}

/** The same thing, broken on purpose. Rendered live next to its explanation. */
export interface ReferenceFailure extends ReferenceExample {
  note: string;
}

/** A utility entry runs a real function in the browser instead of rendering. */
export interface ReferenceRun {
  label: string;
  /** JSON (or plain text) prefilled into the first editor. */
  input: string;
  /** Second input, for functions that take two arguments. */
  input2?: string;
  labelB?: string;
  /** Key into RUNNERS (lib/reference/runners.ts). */
  fn: string;
}

export interface ReferenceEntry {
  /** Stable anchor id. Other pages deep-link to `/reference#<id>`. */
  id: string;
  category: ReferenceCategory;
  /** The name as you write it in a spec or import it from the package. */
  name: string;
  /** The exact JSON or TS shape. */
  signature: string;
  lang?: 'json' | 'typescript' | 'tsx' | 'text';
  /** One or two sentences. */
  summary: string;
  /** Verified facts, one per line. */
  details: string[];
  example?: ReferenceExample;
  failure?: ReferenceFailure;
  run?: ReferenceRun;
  /** Ids of other entries worth reading next. */
  related: string[];
  /** Slug of the step that exercises this fully. */
  step: string;
  tags?: string[];
}

export interface ReferenceIndexItem {
  id: string;
  name: string;
  category: ReferenceCategory;
  href: string;
}
