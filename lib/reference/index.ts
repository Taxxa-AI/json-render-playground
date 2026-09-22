import { ACTION_ENTRIES } from './entries-actions';
import { CONDITION_ENTRIES } from './entries-conditions';
import { CONTEXT_ENTRIES } from './entries-context';
import { EXPRESSION_ENTRIES } from './entries-expressions';
import { HOOK_ENTRIES } from './entries-hooks';
import { PROVIDER_ENTRIES } from './entries-providers';
import { SPEC_ENTRIES } from './entries-spec';
import { UTILITY_ENTRIES } from './entries-utilities';
import { VALIDATION_ENTRIES } from './entries-validation';
import { REFERENCE_CATEGORIES, type ReferenceCategory, type ReferenceEntry, type ReferenceIndexItem } from './types';

export type { ReferenceCategory, ReferenceEntry, ReferenceIndexItem, ReferenceExample, ReferenceFailure, ReferenceRun } from './types';
export { REFERENCE_CATEGORIES } from './types';

/**
 * The whole 0.20.0 surface, in reading order. Ids are the public contract:
 * other pages deep-link to `/reference#<id>`, so renaming one breaks them.
 */
export const REFERENCE_ENTRIES: ReferenceEntry[] = [
  ...SPEC_ENTRIES,
  ...EXPRESSION_ENTRIES,
  ...CONDITION_ENTRIES,
  ...ACTION_ENTRIES,
  ...VALIDATION_ENTRIES,
  ...CONTEXT_ENTRIES,
  ...HOOK_ENTRIES,
  ...PROVIDER_ENTRIES,
  ...UTILITY_ENTRIES,
];

export const REFERENCE_INDEX: ReferenceIndexItem[] = REFERENCE_ENTRIES.map((e) => ({
  id: e.id,
  name: e.name,
  category: e.category,
  href: `/reference#${e.id}`,
}));

const BY_ID = new Map(REFERENCE_ENTRIES.map((e) => [e.id, e]));

/** Anchor for a category heading. "Spec & elements" -> "spec-elements". */
export function categorySlug(category: ReferenceCategory): string {
  return category
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function referenceEntry(id: string): ReferenceEntry | undefined {
  return BY_ID.get(id);
}

/** Entries grouped by category, in REFERENCE_CATEGORIES order, empties dropped. */
export function entriesByCategory(): Array<{ category: ReferenceCategory; entries: ReferenceEntry[] }> {
  return REFERENCE_CATEGORIES.map((category) => ({
    category,
    entries: REFERENCE_ENTRIES.filter((e) => e.category === category),
  })).filter((g) => g.entries.length > 0);
}

export interface CoverageRow {
  category: ReferenceCategory;
  total: number;
  /** Entries that render a live, editable spec. */
  live: number;
  /** Entries that render the broken version too. */
  failures: number;
  /** Entries that run a real function in the browser. */
  runs: number;
}

/** Feeds the coverage matrix at the top of the page. Counted, never hand-written. */
export function coverage(): CoverageRow[] {
  return entriesByCategory().map(({ category, entries }) => ({
    category,
    total: entries.length,
    live: entries.filter((e) => e.example).length,
    failures: entries.filter((e) => e.failure).length,
    runs: entries.filter((e) => e.run).length,
  }));
}

/** Case-insensitive match over name, id, summary and tags. */
export function searchEntries(query: string): ReferenceEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return REFERENCE_ENTRIES;
  return REFERENCE_ENTRIES.filter((e) => {
    const haystack = [e.name, e.id, e.summary, ...(e.tags ?? [])].join(' ').toLowerCase();
    return haystack.includes(q);
  });
}
