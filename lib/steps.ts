export type Group =
  | 'Foundations'
  | 'Data & binding'
  | 'Behaviour'
  | 'Your code'
  | 'Utilities'
  | 'AI'
  | 'Shipping';

export interface Step {
  slug: string;
  n: number;
  title: string;
  blurb: string;
  group: Group;
  /** Live generation steps need AI_GATEWAY_API_KEY; everything else runs offline. */
  needsKey?: boolean;
  /** What you actually do on the page. */
  does: string;
  /** Roughly how long the lab takes, in minutes. */
  minutes?: number;
}

/**
 * The learning path, in order. Numbers are display labels — never reference a
 * step by number in prose, use <StepRef slug="…"/> so renumbering is free.
 */
export const STEPS: Step[] = [
  // ---- Foundations: the three nouns ----
  {
    slug: 'shape',
    n: 1,
    title: 'The shape',
    blurb: 'A flat map of keyed elements, not a nested tree.',
    does: 'Build a tree by hand, break it four ways, watch it fail.',
    group: 'Foundations',
    minutes: 10,
  },
  {
    slug: 'catalog',
    n: 2,
    title: 'The catalog',
    blurb: 'The schema for every node in the JSON tree.',
    does: 'Read an entry, edit the node it permits, break its schema and see what happens.',
    group: 'Foundations',
    minutes: 10,
  },
  {
    slug: 'registry',
    n: 3,
    title: 'The registry',
    blurb: 'How each renderer answers a catalog entry.',
    does: 'One entry, two registries, side by side — same props, different React.',
    group: 'Foundations',
    minutes: 10,
  },

  // ---- Data & binding ----
  {
    slug: 'state',
    n: 4,
    title: 'State & binding',
    blurb: 'One JSON Pointer state model, read one way or two.',
    does: 'Bind inputs, watch every write, and find out what breaks a binding.',
    group: 'Data & binding',
    minutes: 12,
  },
  {
    slug: 'stores',
    n: 5,
    title: 'Stores',
    blurb: 'Uncontrolled, controlled, or your own state library.',
    does: 'Run one spec against three different stores and write in from outside.',
    group: 'Data & binding',
    minutes: 8,
  },
  {
    slug: 'expressions',
    n: 6,
    title: 'Expressions',
    blurb: 'The six $-forms the renderer resolves before your component runs.',
    does: 'A live REPL over resolvePropValue. Type an expression, see the value.',
    group: 'Data & binding',
    minutes: 12,
  },
  {
    slug: 'conditions',
    n: 7,
    title: 'Conditions',
    blurb: 'The visibility grammar, and how it fails.',
    does: 'Run a condition against six state models at once as a truth table.',
    group: 'Data & binding',
    minutes: 8,
  },
  {
    slug: 'lists',
    n: 8,
    title: 'Lists & repeat',
    blurb: '$item, $index, $bindItem, nested and filtered repeats.',
    does: 'Build a filtered list and a nested list, and bind inputs inside rows.',
    group: 'Data & binding',
    minutes: 15,
  },

  // ---- Behaviour ----
  {
    slug: 'actions',
    n: 9,
    title: 'Actions & watchers',
    blurb: 'Events, built-ins, confirm dialogs, success/error branches, and watch.',
    does: 'Seven tabs, one field each, plus a pane holding the app code that wires handlers into the provider.',
    group: 'Behaviour',
    minutes: 15,
  },
  {
    slug: 'validation',
    n: 10,
    title: 'Validation',
    blurb: 'Field checks, cross-field rules, and validateForm.',
    does: 'Add checks to a live form and discover what validateForm does not do.',
    group: 'Behaviour',
    minutes: 10,
  },

  // ---- Your code: the developer side ----
  {
    slug: 'hooks',
    n: 11,
    title: 'Hooks inside components',
    blurb: 'useBoundProp, useStateValue, useStateStore, useAction, useIsVisible.',
    does: 'Read and write the state model from inside a registry component, hook by hook.',
    group: 'Your code',
    minutes: 12,
  },
  {
    slug: 'providers',
    n: 12,
    title: 'Providers & the render tree',
    blurb: 'What JSONUIProvider is made of, and when to split it.',
    does: 'Assemble the provider stack piece by piece and see what each one unlocks.',
    group: 'Your code',
    minutes: 10,
  },
  {
    slug: 'build-catalog',
    n: 13,
    title: 'Add a component',
    blurb: 'A new catalog entry, and the three places it must land.',
    does: 'Declare a component and watch the prompt, the type contract and the registry requirement appear together.',
    group: 'Your code',
    minutes: 15,
  },
  {
    slug: 'build-component',
    n: 14,
    title: 'Write the implementation',
    blurb: 'From ComponentContext to rendered React.',
    does: 'Write a registry component in a live editor against a real spec.',
    group: 'Your code',
    minutes: 15,
  },
  {
    slug: 'directives',
    n: 15,
    title: 'Directives',
    blurb: 'Add your own $-keys to the expression language.',
    does: 'Compose four custom directives with built-ins, then write one of your own.',
    group: 'Your code',
    minutes: 12,
  },
  {
    slug: 'build-check',
    n: 16,
    title: 'Custom checks & handlers',
    blurb: 'validationFunctions, action handlers, onSuccess and onError.',
    does: 'Register a validation function and an action handler, then bind both from a spec.',
    group: 'Your code',
    minutes: 12,
  },

  // ---- Utilities ----
  {
    slug: 'repair',
    n: 17,
    title: 'Validate & repair',
    blurb: 'Eight real broken specs, and the tools that fix them.',
    does: 'Diagnose each one, then compare hand-repair against autoFixSpec.',
    group: 'Utilities',
    minutes: 12,
  },
  {
    slug: 'formats',
    n: 18,
    title: 'Other formats',
    blurb: 'Nested trees, database rows, and custom schemas.',
    does: 'Convert both directions into the canonical flat spec.',
    group: 'Utilities',
    minutes: 8,
  },

  // ---- AI ----
  {
    slug: 'streaming',
    n: 19,
    title: 'Streaming',
    blurb: 'The JSONL patch protocol.',
    does: 'Step through a stream frame by frame, then write your own patches.',
    group: 'AI',
    minutes: 12,
  },
  {
    slug: 'generate',
    n: 20,
    title: 'Live generation',
    blurb: 'streamText plus the catalog prompt, end to end.',
    does: 'Generate real UI and read the wire while it arrives.',
    group: 'AI',
    needsKey: true,
    minutes: 10,
  },
  {
    slug: 'chat',
    n: 21,
    title: 'Chat + inline UI',
    blurb: 'One response carrying both prose and patches.',
    does: 'Run the mixed-stream parser by hand, then a full chat loop.',
    group: 'AI',
    needsKey: true,
    minutes: 10,
  },
  {
    slug: 'refine',
    n: 22,
    title: 'Refinement',
    blurb: 'Editing an existing spec: patch, merge, diff.',
    does: 'Send the same edit three ways and compare what comes back.',
    group: 'AI',
    needsKey: true,
    minutes: 10,
  },

  // ---- Shipping ----
  {
    slug: 'patterns',
    n: 23,
    title: 'Production patterns',
    blurb: 'Compile specs from your domain model instead of generating them.',
    does: 'Edit a field definition and watch a real compiler rebuild the form.',
    group: 'Shipping',
    minutes: 10,
  },
  {
    slug: 'limitations',
    n: 24,
    title: 'Limits & risks',
    blurb: 'What breaks, what it costs, what to never let a model decide.',
    does: 'Read this before you ship.',
    group: 'Shipping',
    minutes: 8,
  },
];

export const GROUPS: readonly Group[] = [
  'Foundations',
  'Data & binding',
  'Behaviour',
  'Your code',
  'Utilities',
  'AI',
  'Shipping',
] as const;

/** One line per group, for the path page and checkpoints. */
export const GROUP_BLURB: Record<Group, string> = {
  Foundations: 'The three nouns: spec, catalog, registry. Everything else is detail on these.',
  'Data & binding': 'How a spec reads and writes the state model, and how it repeats and hides things.',
  Behaviour: 'How a spec triggers code it cannot contain: events, actions, validation.',
  'Your code': 'The developer side. What you write in your codebase to extend the renderer.',
  Utilities: 'Core helpers for validating, repairing and converting specs.',
  AI: 'Generating and editing specs with a model, over a streaming wire.',
  Shipping: 'Patterns that survive production, and the risks you sign up for.',
};

export function stepBySlug(slug: string) {
  return STEPS.find((s) => s.slug === slug);
}

export function neighbours(slug: string) {
  const i = STEPS.findIndex((s) => s.slug === slug);
  return { prev: i > 0 ? STEPS[i - 1] : null, next: i >= 0 && i < STEPS.length - 1 ? STEPS[i + 1] : null };
}

export function stepsInGroup(group: Group) {
  return STEPS.filter((s) => s.group === group);
}

/** Non-step pages that belong to the learning material. */
export const PAGES = [
  { href: '/path', title: 'Learning path', blurb: 'Where to start, what order, and checkpoints.' },
  { href: '/build', title: 'Build it from scratch', blurb: 'A real app written file by file, every line explained.' },
  { href: '/reference', title: 'Reference', blurb: 'Every field, form, operator and action, live.' },
  { href: '/cheatsheet', title: 'Cheat sheet', blurb: 'The whole library on one page.' },
] as const;
