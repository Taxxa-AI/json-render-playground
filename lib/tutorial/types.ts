/**
 * Types for the /build tutorial.
 *
 * Everything here is SERIALISABLE on purpose. The chapter index is a server
 * component and the chapter view is a client component, so a chapter object
 * has to survive the boundary. The live previews are React components, which
 * cannot — they live in `components/tutorial/previews.tsx`, keyed by slug.
 */

export type Lang = 'ts' | 'tsx' | 'json' | 'jsonl' | 'bash' | 'text';

/**
 * One annotation, anchored to an inclusive 1-based line range of the file as
 * it stands AFTER this chapter.
 *
 * You only author notes for lines this chapter added or changed. Lines that
 * survive unchanged from an earlier chapter inherit that chapter's note, with
 * the range remapped by `scripts/gen-tutorial-source.ts`. Every line of every
 * displayed file must end up covered or the generator fails.
 */
export interface Note {
  lines: [number, number];
  title: string;
  body: string;
}

export interface ChapterFile {
  /** Path as the reader would create it, relative to their project root. */
  path: string;
  lang: Lang;
  notes: Note[];
}

/** A thing readers get wrong at this point, with the reason it fails. */
export interface Mistake {
  wrong: string;
  lang?: Lang;
  why: string;
}

export interface TryIt {
  instruction: string;
  check: string;
}

export interface Chapter {
  slug: string;
  n: number;
  title: string;
  /** One sentence. What you will have when the chapter ends. */
  goal: string;
  minutes: number;
  /** Two to four short paragraphs of plain prose. */
  why: string[];
  files: ChapterFile[];
  mistakes: Mistake[];
  tryIt?: TryIt;
  /** Anchor ids on /reference. */
  refs: string[];
  /** Step slugs (lib/steps.ts) for the deep-dive lab. */
  steps: string[];
}

/** The directory under lib/tutorial/app that holds this chapter's real files. */
export function chapterDir(n: number): string {
  return `ch${String(n).padStart(2, '0')}`;
}
