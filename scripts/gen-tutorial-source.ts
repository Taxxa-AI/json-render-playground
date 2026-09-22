/**
 * Emit lib/tutorial/source.generated.ts from the real chapter sources.
 *
 * /build promises that the code it shows is the code it runs. The chapter
 * apps live under lib/tutorial/app/chNN/ as real TypeScript that the preview
 * components import; this script reads those same files and emits their text
 * so a client component can display them without an fs read.
 *
 * It also does two things gen-source.ts does not:
 *
 *  1. DIFFS each file against its previous chapter to produce `added` — the
 *     lines the chapter page highlights.
 *  2. RESOLVES annotations. A chapter only authors notes for the lines it
 *     added or changed; notes on surviving lines are inherited from the
 *     previous chapter with their ranges remapped through the diff. Then it
 *     checks that EVERY line of every displayed file is covered, and exits
 *     non-zero if any line is not.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { Chapter, Note } from '../lib/tutorial/types';

const ROOT = process.cwd();
const APP_DIR = path.join(ROOT, 'lib/tutorial/app');

const { CHAPTERS } = (await import(path.join(ROOT, 'lib/tutorial/index.ts'))) as { CHAPTERS: Chapter[] };

const dirOf = (n: number) => `ch${String(n).padStart(2, '0')}`;

function readLines(abs: string): string[] | null {
  if (!existsSync(abs)) return null;
  return readFileSync(abs, 'utf8').replace(/\n+$/, '').split('\n');
}

/**
 * Longest common subsequence over lines. Returns, for each line of `prev`,
 * the 1-based line of `next` it survives as — or 0 when it did not survive.
 *
 * Line-based rather than token-based on purpose: the highlight and the note
 * ranges are both line-granular, so anything finer would have to be thrown
 * away again.
 */
function lineMap(prev: string[], next: string[]): number[] {
  const n = prev.length;
  const m = next.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = prev[i] === next[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const map = new Array(n).fill(0);
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (prev[i] === next[j]) {
      map[i] = j + 1;
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) i++;
    else j++;
  }
  return map;
}

/** Split an inherited note's range into the contiguous runs it survives as. */
function remapNote(note: Note, map: number[]): Note[] {
  const targets: number[] = [];
  for (let line = note.lines[0]; line <= note.lines[1]; line++) {
    const to = map[line - 1] ?? 0;
    if (to > 0) targets.push(to);
  }
  if (targets.length === 0) return [];

  const runs: Note[] = [];
  let start = targets[0];
  let end = targets[0];
  for (const t of targets.slice(1)) {
    if (t === end + 1) end = t;
    else {
      runs.push({ ...note, lines: [start, end] });
      start = t;
      end = t;
    }
  }
  runs.push({ ...note, lines: [start, end] });
  return runs;
}

interface Tracked {
  lines: string[];
  notes: Note[];
}

interface OutFile {
  path: string;
  lang: string;
  code: string;
  added: number[];
  notes: Note[];
}

const tracked = new Map<string, Tracked>();
const out: Record<string, OutFile[]> = {};
const problems: string[] = [];
let totalLines = 0;
let totalNotes = 0;
let inheritedNotes = 0;

for (const chapter of CHAPTERS) {
  const dir = path.join(APP_DIR, dirOf(chapter.n));
  const displayed = new Set(chapter.files.map((f) => f.path));

  // Every path we have ever tracked, plus everything this chapter displays.
  const paths = new Set<string>([...tracked.keys(), ...displayed]);
  const files: OutFile[] = [];

  for (const rel of [...paths].sort()) {
    const lines = readLines(path.join(dir, rel));
    if (!lines) {
      // The file was deleted in this chapter. Stop tracking it.
      if (!displayed.has(rel)) tracked.delete(rel);
      else problems.push(`${chapter.slug}: displays ${rel}, which does not exist in ${dirOf(chapter.n)}/`);
      continue;
    }

    const prev = tracked.get(rel);
    const map = prev ? lineMap(prev.lines, lines) : null;

    const carried: Note[] = [];
    if (prev && map) for (const note of prev.notes) carried.push(...remapNote(note, map));

    const authored = chapter.files.find((f) => f.path === rel)?.notes ?? [];
    for (const note of authored) {
      if (note.lines[0] < 1 || note.lines[1] > lines.length || note.lines[0] > note.lines[1]) {
        problems.push(
          `${chapter.slug} · ${rel}: note "${note.title}" has range ${note.lines[0]}-${note.lines[1]}, outside 1-${lines.length}`,
        );
      }
    }

    // Authored notes win: drop any inherited range that an authored note
    // already speaks for, so a chapter can rewrite an explanation.
    const claimed = new Set<number>();
    for (const note of authored) for (let l = note.lines[0]; l <= note.lines[1]; l++) claimed.add(l);
    const kept: Note[] = [];
    for (const note of carried) {
      const free: number[] = [];
      for (let l = note.lines[0]; l <= note.lines[1]; l++) if (!claimed.has(l)) free.push(l);
      if (free.length === 0) continue;
      let start = free[0];
      let end = free[0];
      for (const l of free.slice(1)) {
        if (l === end + 1) end = l;
        else {
          kept.push({ ...note, lines: [start, end] });
          start = l;
          end = l;
        }
      }
      kept.push({ ...note, lines: [start, end] });
    }

    const notes = [...kept, ...authored].sort((a, b) => a.lines[0] - b.lines[0] || a.lines[1] - b.lines[1]);
    tracked.set(rel, { lines, notes });

    if (!displayed.has(rel)) continue;

    // Changed / new lines, for the emerald gutter bar. A file that did not
    // exist before is entirely new, so highlighting every line says nothing.
    const survived = new Set<number>();
    if (map) for (const to of map) if (to > 0) survived.add(to);
    const added = map ? lines.map((_, i) => i + 1).filter((l) => !survived.has(l)) : [];

    const covered = new Set<number>();
    for (const note of notes) {
      for (let l = Math.max(1, note.lines[0]); l <= Math.min(lines.length, note.lines[1]); l++) covered.add(l);
    }
    const uncovered = lines.map((_, i) => i + 1).filter((l) => !covered.has(l));
    if (uncovered.length > 0) {
      problems.push(
        `${chapter.slug} · ${rel}: ${uncovered.length} line(s) with no annotation: ${summarise(uncovered)}`,
      );
    }

    totalLines += lines.length;
    totalNotes += notes.length;
    inheritedNotes += kept.length;

    files.push({
      path: rel,
      lang: chapter.files.find((f) => f.path === rel)?.lang ?? 'ts',
      code: lines.join('\n'),
      added,
      notes,
    });
  }

  out[chapter.slug] = chapter.files
    .map((f) => files.find((o) => o.path === f.path))
    .filter((f): f is OutFile => Boolean(f));
}

/** "3-7, 12, 40-44" — a report you can act on without counting. */
function summarise(nums: number[]): string {
  const parts: string[] = [];
  let start = nums[0];
  let end = nums[0];
  for (const n of nums.slice(1)) {
    if (n === end + 1) end = n;
    else {
      parts.push(start === end ? `${start}` : `${start}-${end}`);
      start = n;
      end = n;
    }
  }
  parts.push(start === end ? `${start}` : `${start}-${end}`);
  return parts.join(', ');
}

const body = `// GENERATED by scripts/gen-tutorial-source.ts — do not edit.
// Regenerated on every \`bun dev\` and \`bun build\`. The code below IS the code
// that lib/tutorial/app/chNN/** runs in each chapter's live preview.

import type { Note } from './types';

export interface TutorialFile {
  path: string;
  lang: string;
  code: string;
  /** 1-based line numbers new or changed since the previous chapter. */
  added: number[];
  /** Every line of \`code\` falls inside at least one of these. */
  notes: Note[];
}

export const TUTORIAL_SOURCE: Record<string, TutorialFile[]> = ${JSON.stringify(out, null, 2)};

export function tutorialFiles(slug: string): TutorialFile[] {
  return TUTORIAL_SOURCE[slug] ?? [];
}
`;

mkdirSync(path.join(ROOT, 'lib/tutorial'), { recursive: true });
writeFileSync(path.join(ROOT, 'lib/tutorial/source.generated.ts'), body);

const chapters = Object.keys(out).length;
console.log(
  `gen-tutorial: ${chapters} chapters, ${Object.values(out).reduce((n, f) => n + f.length, 0)} files, ` +
    `${totalLines} lines, ${totalNotes} notes (${inheritedNotes} inherited)`,
);

if (problems.length > 0) {
  console.error(`\ngen-tutorial: ${problems.length} problem(s):`);
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}
