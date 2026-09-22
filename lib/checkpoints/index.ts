import { aiQuiz } from './ai';
import { behaviourQuiz } from './behaviour';
import { dataBindingQuiz } from './data-binding';
import { foundationsQuiz } from './foundations';
import { shippingQuiz } from './shipping';
import type { Quiz } from './types';
import { utilitiesQuiz } from './utilities';
import { yourCodeQuiz } from './your-code';

export type { ChoiceQuestion, FillQuestion, PredictQuestion, Question, Quiz, SpotQuestion } from './types';
export { FILL } from './types';

/** One quiz per group, keyed by the group slug from lib/path.ts. */
export const QUIZZES: Record<string, Quiz> = {
  [foundationsQuiz.slug]: foundationsQuiz,
  [dataBindingQuiz.slug]: dataBindingQuiz,
  [behaviourQuiz.slug]: behaviourQuiz,
  [yourCodeQuiz.slug]: yourCodeQuiz,
  [utilitiesQuiz.slug]: utilitiesQuiz,
  [aiQuiz.slug]: aiQuiz,
  [shippingQuiz.slug]: shippingQuiz,
};

export function quizFor(slug: string): Quiz | undefined {
  return QUIZZES[slug];
}
