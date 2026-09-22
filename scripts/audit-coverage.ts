/**
 * Does each topic's stages actually cover that topic?
 *
 * Both `Concept.step` and `ReferenceEntry.step` already name the step that
 * exercises them, so the expected feature surface of a lab is not a matter of
 * opinion: it is every concept and every reference entry pointing at that
 * slug. This reports what a lab's stages cover, what they miss, and what they
 * borrow from another topic.
 */
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { CONCEPTS } from '../lib/concepts';
import { REFERENCE_ENTRIES } from '../lib/reference';
import { STEPS } from '../lib/steps';

const DIRS = ['components/lab', 'components/playground', 'lib/labs'];

/** slug -> features its stages name. */
const covered = new Map<string, Set<string>>();
const stageCount = new Map<string, number>();

for (const dir of DIRS) {
  for (const name of readdirSync(dir)) {
    if (!/\.tsx?$/.test(name)) continue;
    const src = readFileSync(path.join(dir, name), 'utf8');
    // The lab's OWN slug, not a <StepRef slug="…"> in its prose.
    const slug =
      /<StageFrame[\s\S]{0,60}?\bslug="([a-z-]+)"/.exec(src)?.[1] ??
      /\blabSlug="([a-z-]+)"/.exec(src)?.[1] ??
      /\bslug:\s*'([a-z-]+)'/.exec(src)?.[1];
    if (!slug) continue;

    const lines = src.split('\n');
    let table: string | null = null;
    for (const [i, line] of lines.entries()) {
      // A stage table: a const named …STAGES…/STAGE_META/…_LAB, or a
      // build…Stages() factory for the labs that compute theirs.
      const decl = /^\s{0,2}(?:export )?(?:const|function)\s+(\w+)\s*[:=(]/.exec(line);
      if (decl) table = /STAGES|STAGE_META|_LAB$/i.test(decl[1]) ? decl[1] : null;
      if (!table || !/\btitle:\s*'/.test(line)) continue;

      const w = lines.slice(i, i + 12).join('\n').split(/\n\s{2,6}\},?\n/)[0];
      const set = covered.get(slug) ?? new Set<string>();
      for (const m of w.matchAll(/(?:concept|ref):\s*'([a-z0-9-]+)'/g)) set.add(m[1]);
      for (const m of w.matchAll(/refs:\s*\[([^\]]*)\]/g))
        for (const r of m[1].matchAll(/'([a-z0-9-]+)'/g)) set.add(r[1]);
      for (const m of w.matchAll(/also:\s*\[([^\]]*)\]/g))
        for (const a of m[1].matchAll(/'([a-z0-9-]+)'/g)) set.add(a[1]);
      covered.set(slug, set);
      stageCount.set(slug, (stageCount.get(slug) ?? 0) + 1);
    }
  }
}

let totalMissing = 0;
for (const step of STEPS) {
  const wantConcepts = Object.values(CONCEPTS).filter((c) => c.step === step.slug).map((c) => c.id);
  const wantRefs = REFERENCE_ENTRIES.filter((e) => e.step === step.slug).map((e) => e.id);
  const have = covered.get(step.slug) ?? new Set<string>();

  const missC = wantConcepts.filter((id) => !have.has(id));
  const missR = wantRefs.filter((id) => !have.has(id));
  const foreign = [...have].filter(
    (id) =>
      (CONCEPTS[id] && CONCEPTS[id].step && CONCEPTS[id].step !== step.slug) ||
      (!CONCEPTS[id] && REFERENCE_ENTRIES.find((e) => e.id === id && e.step !== step.slug)),
  );
  totalMissing += missC.length + missR.length;

  const n = stageCount.get(step.slug) ?? 0;
  const want = wantConcepts.length + wantRefs.length;
  const pct = want ? Math.round(((want - missC.length - missR.length) / want) * 100) : 100;
  console.log(`\n${step.slug}  (${n} stages, covers ${pct}% of ${want} features for this step)`);
  if (missC.length) console.log(`   missing concepts : ${missC.join(' ')}`);
  if (missR.length) console.log(`   missing reference: ${missR.join(' ')}`);
  if (foreign.length) console.log(`   from other steps : ${foreign.join(' ')}`);
}
console.log(`\n${totalMissing} features belong to a step whose lab never names them.`);
