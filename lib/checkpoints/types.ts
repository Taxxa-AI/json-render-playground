import type { Spec } from '@json-render/core';
import type { Group } from '@/lib/steps';

/**
 * Checkpoint question data.
 *
 * PLAIN DATA ONLY. These files are imported by a server component and handed
 * to a client component, so nothing here may be a function or a React node —
 * spec objects and strings cross the boundary; closures do not.
 *
 * Every `answer` in these files was verified against the installed library with
 * the scripts in the session scratchpad (`verify-checkpoints.ts`,
 * `verify-checkpoints-2.ts`); each question cites the function checked.
 */

interface Base {
  id: string;
  /** The question. One sentence where possible. */
  prompt: string;
  /** 3–4 options. */
  options: string[];
  /** Index into `options`. Exactly one is defensible. */
  answer: number;
  /** Why. Shown after answering, above the step + reference links. */
  explain: string;
  /** Step slug — rendered as <StepRef>. Never write "step N" in `explain`. */
  step: string;
  /** Anchor id on /reference, e.g. "el-children". */
  ref: string;
}

/** Plain multiple choice. */
export interface ChoiceQuestion extends Base {
  kind: 'choice';
}

/**
 * Show a spec, ask what it renders, then render it for real with
 * `demoRegistry` so the learner sees the truth rather than our claim.
 */
export interface PredictQuestion extends Base {
  kind: 'predict';
  spec: Spec;
  /** Seed state. Passed as `initialState` — the renderer never reads spec.state. */
  seed?: Record<string, unknown>;
}

/** Show a broken spec, ask which `validateSpec` issue code applies. */
export interface SpotQuestion extends Base {
  kind: 'spot';
  spec: Spec;
  /** Run validateSpec with orphan checking on. */
  checkOrphans?: boolean;
}

/**
 * A spec with the string `"___"` somewhere. Each option is an expression;
 * on answer the chosen one is substituted and the result rendered live.
 */
export interface FillQuestion extends Base {
  kind: 'fill';
  spec: Spec;
  seed?: Record<string, unknown>;
  /** One JSON snippet per option, in the same order. Parsed and substituted for "___". */
  fills: string[];
}

export type Question = ChoiceQuestion | PredictQuestion | SpotQuestion | FillQuestion;

export interface Quiz {
  group: Group;
  /** Group url slug — must match lib/path.ts. */
  slug: string;
  /** One line on what this checkpoint proves. */
  intro: string;
  questions: Question[];
}

/** The placeholder a `fill` question substitutes. */
export const FILL = '___';
