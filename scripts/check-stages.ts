/**
 * Every stage must teach a REAL json-render feature.
 *
 * A stage that names no feature is almost always a permutation of the one
 * before it — "shrink the catalog" then "put it back" is one lesson about
 * `catalog.prompt()`, not two. Those belong in one stage as two `parts`.
 *
 * So every stage declares `concept` (an id in lib/concepts) or `ref` (an
 * anchor on /reference), and this fails the build when one does not. It reads
 * the stage tables statically rather than rendering the labs, because those
 * tables are plain literals on purpose.
 */
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { CONCEPTS } from '../lib/concepts';
import { REFERENCE_ENTRIES } from '../lib/reference';

const DIRS = ['components/lab', 'components/playground', 'lib/labs'];
const anchors = new Set(REFERENCE_ENTRIES.map((e) => e.id));

interface Row {
  file: string;
  title: string;
  concept?: string;
  ref?: string;
  /** Does the stage say WHEN to reach for the feature, not just what it is? */
  when?: boolean;
}

const rows: Row[] = [];
for (const dir of DIRS) {
  for (const name of readdirSync(dir)) {
    if (!/\.tsx?$/.test(name)) continue;
    const lines = readFileSync(path.join(dir, name), 'utf8').split('\n');

    /**
     * A stage title, told apart from a spec's `props.title` by its ENCLOSING
     * table: stage tables are the consts named `…STAGES…` or `STAGE_META`, and
     * nothing else in these files is.
     */
    let table: string | null = null;
    for (const [i, line] of lines.entries()) {
      // A stage table: a const named …STAGES…/STAGE_META/…_LAB, or a
      // build…Stages() factory for the labs that compute theirs.
      const decl = /^\s{0,2}(?:export )?(?:const|function)\s+(\w+)\s*[:=(]/.exec(line);
      if (decl) table = /STAGES|STAGE_META|_LAB$/i.test(decl[1]) ? decl[1] : null;
      if (!table) continue;

      const t = /\btitle:\s*'((?:[^'\\]|\\.)*)'/.exec(line);
      if (!t) continue;

      // The stage's own object: this line and the few that follow, which is as
      // far as its own concept/ref can be before the next sibling starts.
      const window = lines.slice(i, i + 12).join('\n').split(/\n\s{2,6}\},?\n/)[0];
      rows.push({
        file: `${dir}/${name}`,
        title: t[1],
        concept: /concept:\s*'([a-z0-9-]+)'/.exec(window)?.[1],
        ref: /\bref:\s*'([a-z0-9-]+)'/.exec(window)?.[1],
        when: /\bwhen:/.test(window),
      });
    }
  }
}

const problems: string[] = [];
for (const r of rows) {
  if (!r.concept && !r.ref) problems.push(`${r.file}: "${r.title}" names no feature (add concept or ref)`);
  // Knowing what a feature does is the easy half; knowing when to reach for it
  // is the half a reference page cannot teach. Every stage owes both.
  if (!r.when) problems.push(`${r.file}: "${r.title}" does not say WHEN to reach for it (add \`when\`)`);
  if (r.concept && !CONCEPTS[r.concept]) problems.push(`${r.file}: "${r.title}" -> unknown concept "${r.concept}"`);
  if (r.ref && !anchors.has(r.ref)) problems.push(`${r.file}: "${r.title}" -> unknown reference anchor "${r.ref}"`);
}

const mapped = rows.filter((r) => r.concept || r.ref).length;
const timed = rows.filter((r) => r.when).length;
console.log(`check-stages: ${rows.length} stages, ${mapped} naming a feature, ${rows.length - mapped} not`);
console.log(`              ${timed} say WHEN to reach for it, ${rows.length - timed} do not`);

if (problems.length > 0) {
  console.error(`\ncheck-stages: ${problems.length} problem(s):`);
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}
