import { GROUPS, STEPS, type Group, type Step } from './steps';

/**
 * The learning path: URL slugs for groups, and the three goal-shaped tracks.
 *
 * Everything here is DERIVED from `lib/steps.ts`. Nothing is hardcoded — add a
 * step there and it appears in the right track, the right group and the right
 * minute total with no edit here.
 */

/** Group → URL slug. Used by /checkpoints/<slug>. */
export const GROUP_SLUG: Record<Group, string> = {
  Foundations: 'foundations',
  'Data & binding': 'data-binding',
  Behaviour: 'behaviour',
  'Your code': 'your-code',
  Utilities: 'utilities',
  AI: 'ai',
  Shipping: 'shipping',
};

/** The reverse map, for `/checkpoints/[group]`. */
export const GROUP_BY_SLUG: Record<string, Group> = Object.fromEntries(
  (Object.entries(GROUP_SLUG) as Array<[Group, string]>).map(([g, s]) => [s, g]),
) as Record<string, Group>;

export const GROUP_SLUGS: readonly string[] = GROUPS.map((g) => GROUP_SLUG[g]);

export function groupFromSlug(slug: string): Group | undefined {
  return GROUP_BY_SLUG[slug];
}

/** The group after this one, or null at the end. */
export function nextGroup(group: Group): Group | null {
  const i = GROUPS.indexOf(group);
  return i >= 0 && i < GROUPS.length - 1 ? GROUPS[i + 1] : null;
}

export type TrackId = 'a' | 'b' | 'c';

export interface Track {
  id: TrackId;
  /** The goal, in the learner's words. */
  title: string;
  /** One line on who this is for. */
  who: string;
  /** What you can do at the end. */
  outcome: string;
  /** Step slugs, in the order to do them. */
  slugs: string[];
}

/**
 * Track A is a hand-picked subset: enough to write a spec that a colleague's
 * app renders. B is "everything that does not need a model" — i.e. every
 * non-AI step. C is the whole path.
 *
 * Both are expressed as filters over STEPS so the ORDER always matches the
 * canonical order, and a new step lands in the right place automatically.
 */
const TRACK_A_SLUGS = new Set([
  'shape',
  'catalog',
  'state',
  'expressions',
  'conditions',
  'lists',
  'actions',
  'validation',
  'repair',
  'limitations',
]);

const orderedSlugs = (keep: (s: Step) => boolean) => STEPS.filter(keep).map((s) => s.slug);

export const TRACKS: Track[] = [
  {
    id: 'a',
    title: 'I write specs',
    who: 'Someone else owns the catalog and the React. You write the JSON.',
    outcome: 'You can write, bind, repeat, hide and repair a spec without opening the app code.',
    slugs: orderedSlugs((s) => TRACK_A_SLUGS.has(s.slug)),
  },
  {
    id: 'b',
    title: 'I integrate it in my app',
    who: 'You own the catalog, the registry and the components.',
    outcome: 'You can add a component, a directive, a check and a handler, and wire the provider stack.',
    slugs: orderedSlugs((s) => s.group !== 'AI'),
  },
  {
    id: 'c',
    title: 'I generate UI with AI',
    who: 'A model writes the specs. You own everything it is allowed to write.',
    outcome: 'You can stream, repair, refine and ship generated UI, and say what it must never decide.',
    slugs: orderedSlugs(() => true),
  },
];

export function trackById(id: string | undefined): Track {
  return TRACKS.find((t) => t.id === id) ?? TRACKS[0];
}

/** Total minutes for a list of step slugs. Steps without `minutes` count 0. */
export function minutesFor(slugs: string[]): number {
  const bySlug = new Map(STEPS.map((s) => [s.slug, s]));
  return slugs.reduce((n, slug) => n + (bySlug.get(slug)?.minutes ?? 0), 0);
}

/** "3 h 40 m" / "45 m". */
export function formatMinutes(total: number): string {
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m} m`;
  if (m === 0) return `${h} h`;
  return `${h} h ${m} m`;
}

/** The shape the path page hands its client components. Plain data only. */
export interface PathGroup {
  group: Group;
  slug: string;
  blurb: string;
  steps: Array<{
    slug: string;
    n: number;
    title: string;
    does: string;
    minutes: number;
    needsKey: boolean;
  }>;
}
