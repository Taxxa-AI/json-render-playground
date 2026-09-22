import { ch00 } from './chapters/ch00-setup';
import { ch01 } from './chapters/ch01-catalog';
import { ch02 } from './chapters/ch02-components';
import { ch03 } from './chapters/ch03-registry';
import { ch04 } from './chapters/ch04-render';
import { ch05 } from './chapters/ch05-state';
import { ch06 } from './chapters/ch06-lists';
import { ch07 } from './chapters/ch07-actions';
import { ch08 } from './chapters/ch08-validation';
import { ch09 } from './chapters/ch09-expressions';
import { ch10 } from './chapters/ch10-stores';
import { ch11 } from './chapters/ch11-generate';
import { ch12 } from './chapters/ch12-repair';
import { ch13 } from './chapters/ch13-compile';
import { ch14 } from './chapters/ch14-ship';
import type { Chapter } from './types';

/**
 * The /build tutorial, in order.
 *
 * Chapter `n` maps to `lib/tutorial/app/ch{nn}/`, which holds the WHOLE app
 * as it stands after that chapter. `scripts/gen-tutorial-source.ts` reads
 * those files, diffs each one against the previous chapter, and emits
 * `source.generated.ts`. Nothing here contains a copy of the code.
 */
export const CHAPTERS: Chapter[] = [
  ch00,
  ch01,
  ch02,
  ch03,
  ch04,
  ch05,
  ch06,
  ch07,
  ch08,
  ch09,
  ch10,
  ch11,
  ch12,
  ch13,
  ch14,
];

export function chapterBySlug(slug: string): Chapter | undefined {
  return CHAPTERS.find((c) => c.slug === slug);
}

export function neighbours(slug: string): { prev?: Chapter; next?: Chapter } {
  const i = CHAPTERS.findIndex((c) => c.slug === slug);
  if (i === -1) return {};
  return { prev: CHAPTERS[i - 1], next: CHAPTERS[i + 1] };
}

/** Total reading/doing time, for the index page. */
export const TOTAL_MINUTES = CHAPTERS.reduce((n, c) => n + c.minutes, 0);

export type { Chapter } from './types';
