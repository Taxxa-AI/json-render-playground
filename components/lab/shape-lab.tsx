'use client';

import type { Spec } from '@json-render/core';
import { SpecPlayground } from '../playground/spec-playground';
import type { Task } from './task-list';
import { stagesFromTasks } from '@/lib/labs/types';
import { reachable } from '@/lib/demo/spec-query';

/**
 * A spec you can read in one screenful, with every structural idea in it:
 * a Heading and a Card under the Screen, a Divider splitting the card body.
 * Six elements, one of every relationship the format has.
 */
const START: Spec = {
  root: 'screen',
  elements: {
    screen: {
      type: 'Screen',
      props: { title: 'Q3 close', subtitle: null },
      children: ['heading', 'card'],
    },
    heading: {
      type: 'Heading',
      props: { text: 'VAT', level: '2' },
      children: [],
    },
    card: {
      type: 'Card',
      props: { title: 'VAT return', subtitle: 'Period 2026-07 → 2026-09' },
      children: ['body', 'rule', 'note'],
    },
    body: {
      type: 'Text',
      props: { value: 'Reverse-charge entries were reclassified after the last sync.', tone: null, size: null },
      children: [],
    },
    rule: { type: 'Divider', props: {}, children: [] },
    note: {
      type: 'Text',
      props: { value: 'Filed by Ada on 12 October.', tone: null, size: 'sm' },
      children: [],
    },
  },
};

/** The stub the add bar inserts for `+ Metric`: the catalog's own example props. */
const METRIC = {
  type: 'Metric',
  props: { label: 'Revenue', value: '€48,200', delta: '+12%', tone: 'success' },
  children: [] as string[],
};

const BADGE = {
  type: 'Badge',
  props: { label: 'Draft', tone: 'warning' },
  children: [] as string[],
};

const PAY = {
  type: 'Button',
  props: { label: 'Pay now', variant: 'primary' },
  children: [] as string[],
};

/** START + the Metric the add bar drops into the card. */
const AFTER_METRIC: Spec = {
  root: 'screen',
  elements: {
    ...START.elements,
    card: { ...START.elements.card, children: ['body', 'rule', 'note', 'metric'] },
    metric: METRIC,
  },
};

/** …+ the Badge, defined and referenced by hand. */
const AFTER_BADGE: Spec = {
  root: 'screen',
  elements: {
    ...AFTER_METRIC.elements,
    card: { ...START.elements.card, children: ['body', 'rule', 'note', 'metric', 'status'] },
    status: BADGE,
  },
};

/** …with "status" unhooked from children but still defined: an orphan. */
const AFTER_ORPHAN: Spec = {
  root: 'screen',
  elements: {
    ...AFTER_BADGE.elements,
    card: { ...START.elements.card, children: ['body', 'rule', 'note', 'metric'] },
  },
};

/** …plus a child key nothing defines. */
const AFTER_DANGLING: Spec = {
  root: 'screen',
  elements: {
    ...AFTER_ORPHAN.elements,
    card: { ...START.elements.card, children: ['body', 'rule', 'note', 'metric', 'ghost'] },
  },
};

/** Tidied up again, with a Button in the card's named footer slot. */
const AFTER_FOOTER: Spec = {
  root: 'screen',
  elements: {
    ...AFTER_BADGE.elements,
    card: {
      ...START.elements.card,
      children: ['body', 'rule', 'note', 'metric', 'status'],
      slots: { footer: ['pay'] },
    },
    pay: PAY,
  },
};

/** …and the Divider retyped to something the registry has never heard of. */
const AFTER_UNKNOWN: Spec = {
  root: 'screen',
  elements: {
    ...AFTER_FOOTER.elements,
    rule: { type: 'BarChart', props: {}, children: [] },
  },
};

export const SHAPE_TASKS: Task[] = [
  {
    id: 'orient',
    goal: (
      <>
        Get oriented: press <code>+ Metric</code> on the add bar with <code>card</code> as the target. Watch the spec
        grow in <strong>two</strong> places — that is the only way anything appears.
      </>
    ),
    hint: 'The bar defines a new element in the elements map AND appends its key to card.children. Do it by hand in the next task and you will do exactly those two edits.',
    steps: [
      <>
        Find the <strong>add</strong> bar above the two panes — the row of chips that starts <code>+ Screen</code>,{' '}
        <code>+ Stack</code>, <code>+ Card</code>.
      </>,
      <>
        At the right of that bar, open the <strong>into</strong> select and choose <code>card (Card)</code>.
      </>,
      <>
        Click the <code>+ Metric</code> chip. A bordered <strong>REVENUE</strong> tile appears at the bottom of the
        card in <strong>rendered output</strong>, with <code>€48,200</code> and a green <code>+12%</code>.
      </>,
      <>
        Open the <strong>spec json</strong> tab and scroll to the bottom: a new <code>{'"metric": {'}</code> block now
        sits in <code>elements</code>.
      </>,
      <>
        Scroll up to the <code>card</code> block: its <code>children</code> array has gained the string{' '}
        <code>"metric"</code>. Two edits, one node.
      </>,
      <>
        Click the <strong>tree</strong> tab and read the last row: <code>Metric metric</code>, indented under{' '}
        <code>card</code>.
      </>,
    ],
    solution: {
      spec: AFTER_METRIC,
      note: 'The add bar makes exactly these two edits: elements.metric is defined, and "metric" is appended to card.children.',
    },
    check: ({ spec }) => {
      const reach = reachable(spec);
      return Object.entries(spec?.elements ?? {}).some(([k, el]) => el.type === 'Metric' && reach.has(k));
    },
  },
  {
    id: 'add-badge',
    goal: (
      <>
        Now do it yourself. An element is <em>defined</em> in <code>elements</code> and <em>referenced</em> by key from
        a parent&rsquo;s <code>children</code> — add a <code>Badge</code> inside the card both ways.
      </>
    ),
    hint: 'Rule: children holds KEYS, never objects. Add "status": { "type": "Badge", "props": { "label": "Draft", "tone": "warning" }, "children": [] } to elements, then add the string "status" to card.children.',
    steps: [
      <>
        Open the <strong>spec json</strong> tab.
      </>,
      <>
        Find the last element in <code>elements</code> — the block that starts <code>{'"note": {'}</code> — and put a
        comma after its closing brace.
      </>,
      <>
        On the next line add the definition:{' '}
        <code>{'"status": { "type": "Badge", "props": { "label": "Draft", "tone": "warning" }, "children": [] }'}</code>.
      </>,
      <>
        Now find the <code>card</code> block and append the string <code>"status"</code> to its <code>children</code>{' '}
        array.
      </>,
      <>
        Look at <strong>rendered output</strong>: a yellow <code>Draft</code> pill sits at the bottom of the card.
      </>,
      <>
        Read the status bar under the editor: <code>validateSpec: clean</code>.
      </>,
    ],
    solution: {
      spec: AFTER_BADGE,
      note: 'elements.status defines the Badge; "status" in card.children mounts it. Miss either half and nothing renders.',
    },
    check: ({ spec }) => {
      const badge = Object.entries(spec?.elements ?? {}).find(([, el]) => el.type === 'Badge');
      if (!badge) return false;
      return reachable(spec).has(badge[0]);
    },
  },
  {
    id: 'orphan',
    goal: (
      <>
        Delete that key from <code>children</code> but leave the element defined. It disappears: only elements
        reachable from <code>root</code> exist, so this is how a generated page loses a whole branch.
      </>
    ),
    hint: 'Rule: defining is not mounting. Remove the string "status" from card.children and keep elements.status exactly as it is — the tree pane will call it out as unreachable.',
    steps: [
      <>
        Open the <strong>spec json</strong> tab.
      </>,
      <>
        In the <code>card</code> block, delete <code>"status"</code> from the <code>children</code> array — and the
        comma before it.
      </>,
      <>
        Leave the <code>{'"status": {'}</code> block in <code>elements</code> exactly where it is.
      </>,
      <>
        In <strong>rendered output</strong>, the <code>Draft</code> pill is gone.
      </>,
      <>
        Click the <strong>tree</strong> tab and read the yellow strip under the node list:{' '}
        <code>Defined but unreachable from root: status</code>.
      </>,
      <>
        Read the status bar under the editor: still <code>validateSpec: clean</code>. It only reports orphans when the
        host asks for them.
      </>,
    ],
    solution: {
      spec: AFTER_ORPHAN,
      note: 'elements.status survives untouched; dropping its key from card.children unmounts it. The tree pane lists it as unreachable and validateSpec stays quiet.',
    },
    check: ({ spec }) => {
      const keys = Object.keys(spec?.elements ?? {});
      const reach = reachable(spec);
      return keys.length > 6 && keys.some((k) => !reach.has(k));
    },
  },
  {
    id: 'dangling',
    goal: (
      <>
        Now the opposite mistake: reference a key nothing defines. Read the status bar under the editor to see what
        the one tool that catches it says.
      </>
    ),
    hint: 'Rule: a dangling child key is skipped, not an error. Add "ghost" to card.children without defining it — validateSpec reports missing_child in the bar under the spec editor.',
    steps: [
      <>
        Open the <strong>spec json</strong> tab.
      </>,
      <>
        Append the string <code>"ghost"</code> to the <code>card</code> block&rsquo;s <code>children</code> array.
      </>,
      <>
        Do <em>not</em> add a <code>ghost</code> entry to <code>elements</code>.
      </>,
      <>
        Look at <strong>rendered output</strong>: unchanged. The renderer skips a child it cannot find.
      </>,
      <>
        Read the status bar under the editor:{' '}
        <code>missing_child: Element "card" references child "ghost" which does not exist in the elements map.</code>
      </>,
      <>
        Click the <strong>tree</strong> tab: a red <code>ghost</code> row tagged <strong>missing</strong> sits under{' '}
        <code>card</code>.
      </>,
    ],
    solution: {
      spec: AFTER_DANGLING,
      note: 'A child key with no element is silently skipped at render time; validateSpec is the only thing that reports it, as missing_child. This spec is deliberately invalid.',
    },
    check: ({ spec }) => {
      const defined = new Set(Object.keys(spec?.elements ?? {}));
      return Object.values(spec?.elements ?? {}).some((el) =>
        [...(el.children ?? []), ...Object.values(el.slots ?? {}).flat()].some((c) => !defined.has(c)),
      );
    },
  },
  {
    id: 'footer',
    goal: (
      <>
        Put a <code>Button</code> in the card&rsquo;s <code>footer</code> slot and note where it lands — the grey bar,
        not the body. <code>children</code> is the default slot; every other slot goes in <code>slots</code>.
      </>
    ),
    hint: 'Rule: slots maps a declared slot name to an array of keys, and sits beside children. Define "pay": { "type": "Button", "props": { "label": "Pay now", "variant": "primary" }, "children": [] }, then add "slots": { "footer": ["pay"] } to the card.',
    steps: [
      <>
        Open the <strong>spec json</strong> tab and tidy up: in <code>card</code>&rsquo;s <code>children</code>,
        delete <code>"ghost"</code> and put <code>"status"</code> back.
      </>,
      <>
        Add one more element to <code>elements</code>:{' '}
        <code>{'"pay": { "type": "Button", "props": { "label": "Pay now", "variant": "primary" }, "children": [] }'}</code>.
      </>,
      <>
        In the <code>card</code> block, add a <code>slots</code> field directly after <code>children</code>:{' '}
        <code>{'"slots": { "footer": ["pay"] }'}</code>.
      </>,
      <>
        Look at <strong>rendered output</strong>: <strong>Pay now</strong> sits in the card&rsquo;s grey footer bar,
        below everything in the body.
      </>,
      <>
        Click the <strong>tree</strong> tab: <code>Button pay</code> is under <code>card</code> with a blue{' '}
        <strong>slot:footer</strong> tag; every other child has none.
      </>,
    ],
    solution: {
      spec: AFTER_FOOTER,
      note: 'The footer slot is a separate array on the element, so the Card implementation can place it in its own bar instead of the body.',
    },
    check: ({ spec }) => {
      const card = spec?.elements?.card;
      const footer = card?.slots?.footer;
      if (!footer?.length) return false;
      return footer.some((k) => spec?.elements?.[k]?.type === 'Button');
    },
  },
  {
    id: 'unknown',
    goal: (
      <>
        Finally, change any element&rsquo;s <code>type</code> to a name the registry has never heard of. You get the red
        fallback box — without a <code>fallback</code> prop you would get silence and a console warning.
      </>
    ),
    hint: 'Rule: type is looked up in the registry, and a miss renders the fallback. Change "Divider" to "BarChart" and look at the preview.',
    steps: [
      <>
        Open the <strong>spec json</strong> tab.
      </>,
      <>
        Find the <code>{'"rule": { "type": "Divider"'}</code> block.
      </>,
      <>
        Change <code>"Divider"</code> to <code>"BarChart"</code>.
      </>,
      <>
        Look at <strong>rendered output</strong>: the horizontal line is replaced by a dashed red box reading{' '}
        <code>unknown component: BarChart</code>.
      </>,
      <>
        Read the status bar under the editor: still <code>validateSpec: clean</code> — the spec format has no idea
        which components you registered.
      </>,
    ],
    solution: {
      spec: AFTER_UNKNOWN,
      note: 'The type is a registry lookup, so an unknown name renders the fallback passed to <Renderer>. validateSpec never checks types against a registry.',
    },
    check: ({ spec }) => {
      const known = new Set([
        'Screen', 'Stack', 'Card', 'Heading', 'Text', 'Badge', 'Metric',
        'Alert', 'Button', 'TextInput', 'Checkbox', 'Select', 'Divider',
      ]);
      return Object.values(spec?.elements ?? {}).some((el) => !known.has(el.type));
    },
  },
];

/**
 * The six stages, each arriving at the spec the previous one finished with:
 * START → AFTER_METRIC → AFTER_BADGE → AFTER_ORPHAN → AFTER_DANGLING →
 * AFTER_FOOTER, with AFTER_UNKNOWN as the finish line.
 */
const SHAPE_STAGES = stagesFromTasks(SHAPE_TASKS, [
  {
    title: 'Two edits, one node',
    concept: 'elements-flat-map',
    when:
      'You do not choose this — every spec has it. What you do choose is the keys, and a key is an address that a streaming patch and a refinement diff both aim at, so name them for the role the element plays rather than numbering them: a regenerated `card2` is a new element, a regenerated `header` is an edit.',
    also: ['spec', 'root'],
    ref: 'el-elements',
    refs: ['el-root'],
    panes: ['spec', 'tree'],
    spec: START,
  },
  {
    title: 'children holds keys',
    concept: 'children-are-keys',
    when:
      'Every element you add by hand or in a patch: define it, then reference it, or nothing renders. There is no nesting form to reach for instead — and the payoff for that is that adding a leaf is one `add` op that disturbs nothing above it, which is what makes streaming cheap.',
    ref: 'el-children',
    panes: ['spec', 'tree'],
    spec: AFTER_METRIC,
  },
  {
    title: 'Defined is not mounted',
    concept: 'reachability',
    when:
      'Check reachability first when something you can see in the JSON is not on screen: an unreferenced element and a `visible: false` one look identical in the output, and only one of them is in the tree. To park an element deliberately use `visible: false`, which says so out loud — `validateSpec` reports an orphan only when you pass `checkOrphans: true`, so an unhooked key can sit there for months.',
    panes: ['tree', 'spec'],
    spec: AFTER_BADGE,
  },
  {
    title: 'A child nothing defines',
    concept: 'element-vs-props',
    when:
      'Run `validateSpec` over every spec that arrives from a model or a patch stream: a dangling child key is exactly the failure it catches and the renderer never will, because the branch simply is not drawn. Do not read a clean result as correct — it knows nothing about your component names or prop types, which is `catalog.validate`.',
    also: ['validate-spec'],
    ref: 'util-validatespec',
    panes: ['spec', 'tree'],
    spec: AFTER_ORPHAN,
  },
  {
    title: 'Slots beside children',
    concept: 'slots-vs-children',
    when:
      'Only when the catalog entry declares a named slot and the content belongs in that structural position — a card footer, a header action. Everything else goes in `children`, which IS the default slot: there is no `slots.default`, and writing one puts the content nowhere at all.',
    panes: ['spec', 'tree'],
    spec: AFTER_DANGLING,
  },
  {
    title: 'type is a registry lookup',
    when:
      'Every element has a `type`, so the decision here is the `fallback` you pass to `<Renderer>`: pass one for anything a model wrote, where an invented component name is routine and a visible box beats a silent hole. Nothing else warns you — `validateSpec` passes an unknown type clean, and only `catalog.validate` compares names against the catalog.',
    ref: 'el-type',
    also: ['unknown-type-fallback'],
    panes: ['spec', 'catalog', 'impl'],
    summary:
      'An element’s `type` is a name looked up in the registry at render time. The spec format has no idea which components you registered, so a name nothing implements is not a spec error — it renders whatever `fallback` you passed, or silently nothing if you passed none.',
    spec: AFTER_FOOTER,
  },
]);

export function ShapeLab() {
  return (
    <SpecPlayground
      spec={START}
      seedState={{}}
      // The playground opens on panes[0] of THIS list, not of the stage it
      // lands on, so the first entry has to be a pane stage one actually shows
      // — otherwise arriving at the lab highlights no tab at all.
      panes={['spec', 'tree', 'catalog', 'impl']}
      height={540}
      stages={SHAPE_STAGES}
      labSlug="shape"
      hint={
        <>
          Edit the JSON on the right. Every keystroke that parses re-renders, and <code>validateSpec</code> reports in
          the status bar underneath. Click any node in the <strong>tree</strong> tab to see every field it carries.
        </>
      }
    />
  );
}
