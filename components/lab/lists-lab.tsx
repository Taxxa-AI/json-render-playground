'use client';

import type { Spec } from '@json-render/core';
import { SpecPlayground } from '../playground/spec-playground';
import { stagesFromTasks } from '@/lib/labs/types';
import type { Task } from './task-list';
import { deepFind, usesExpression } from '@/lib/demo/spec-query';

/** Starting point: a plain repeat over a flat array. */
const BASIC: Spec = {
  root: 'screen',
  elements: {
    screen: { type: 'Screen', props: { title: null, subtitle: null }, children: ['all'] },
    all: {
      type: 'Card',
      props: { title: 'All invoices', subtitle: null },
      // The container renders ONCE; its children expand per item.
      repeat: { statePath: '/invoices', key: 'id' },
      children: ['row'],
    },
    row: {
      type: 'Stack',
      props: { direction: 'row', gap: 'md', align: 'center', wrap: null },
      children: ['who', 'amt', 'st'],
    },
    who: { type: 'Text', props: { value: { $item: 'client' }, tone: null, size: null }, children: [] },
    amt: { type: 'Text', props: { value: { $item: 'amount' }, tone: null, size: null }, children: [] },
    st: { type: 'Badge', props: { label: { $item: 'status' }, tone: 'neutral' }, children: [] },
  },
};

/** Two-way binding INTO a row, plus per-row removal by index. */
const EDITABLE: Spec = {
  root: 'screen',
  elements: {
    screen: { type: 'Screen', props: { title: 'Editable rows', subtitle: 'Edits land inside the array' }, children: ['all'] },
    all: {
      type: 'Card',
      props: { title: 'Invoices', subtitle: null },
      repeat: { statePath: '/invoices', key: 'id' },
      children: ['row'],
    },
    row: {
      type: 'Stack',
      props: { direction: 'row', gap: 'md', align: 'center', wrap: null },
      children: ['note', 'flag', 'del'],
    },
    // $bindItem writes to the CURRENT item's field, not a global path.
    note: {
      type: 'TextInput',
      props: { label: 'Note', value: { $bindItem: 'note' }, placeholder: 'add a note', help: null, required: null, checks: null },
      children: [],
    },
    flag: { type: 'Checkbox', props: { label: 'Chase', checked: { $bindItem: 'chase' } }, children: [] },
    del: {
      type: 'Button',
      props: { label: 'remove', variant: 'ghost' },
      on: { press: { action: 'removeState', params: { statePath: '/invoices', index: { $index: true } } } },
      children: [],
    },
  },
};

/** A list of lists. */
const NESTED: Spec = {
  root: 'screen',
  elements: {
    screen: { type: 'Screen', props: { title: 'Nested repeat', subtitle: 'An array on each item' }, children: ['outer'] },
    outer: {
      type: 'Card',
      props: { title: { $item: 'client' }, subtitle: null },
      repeat: { statePath: '/invoices', key: 'id' },
      children: ['inner'],
    },
    inner: {
      type: 'Stack',
      props: { direction: 'row', gap: 'sm', align: 'center', wrap: true },
      // An inner repeat reads an array off the ENCLOSING item.
      repeat: { statePath: { $item: 'lines' }, key: 'sku' },
      children: ['line'],
    },
    line: { type: 'Badge', props: { label: { $item: 'sku' }, tone: 'info' }, children: [] },
  },
};

export const LISTS_SEED = {
  invoices: [
    { id: 'a', client: 'Acme Oy', amount: '€1,200', status: 'paid', note: '', chase: false, lines: [{ sku: 'A-1' }, { sku: 'A-2' }] },
    { id: 'b', client: 'Borealis AB', amount: '€3,480', status: 'unpaid', note: '', chase: false, lines: [{ sku: 'B-7' }] },
    { id: 'c', client: 'Cygnus AS', amount: '€760', status: 'unpaid', note: '', chase: false, lines: [{ sku: 'C-3' }, { sku: 'C-4' }, { sku: 'C-9' }] },
  ],
};

/** The repeat pointed at a path that holds no array. */
const BROKEN_PATH: Spec = {
  root: 'screen',
  elements: {
    ...BASIC.elements,
    all: { ...BASIC.elements.all, repeat: { statePath: '/nope', key: 'id' } },
  },
};

/** Back to /invoices, with the repeat index printed in every row. */
const WITH_INDEX: Spec = {
  root: 'screen',
  elements: {
    ...BASIC.elements,
    row: { ...BASIC.elements.row, children: ['idx', 'who', 'amt', 'st'] },
    idx: { type: 'Text', props: { value: { $index: true }, tone: null, size: 'sm' }, children: [] },
  },
};

/** …filtered down to the unpaid items by an $item condition on the container. */
const FILTERED: Spec = {
  root: 'screen',
  elements: {
    ...WITH_INDEX.elements,
    all: { ...BASIC.elements.all, visible: { $item: 'status', eq: 'unpaid' } },
  },
};

/** …with one $template replacing two separate Texts. */
const TEMPLATED: Spec = (() => {
  const { amt: _dropped, ...rest } = FILTERED.elements;
  return {
    root: 'screen',
    elements: {
      ...rest,
      row: { ...BASIC.elements.row, children: ['idx', 'who', 'st'] },
      who: { type: 'Text', props: { value: { $template: '${client} owes ${amount}' }, tone: null, size: null }, children: [] },
    },
  };
})();

/** The editable preset with its React key thrown away. */
const NO_KEY: Spec = {
  root: 'screen',
  elements: {
    ...EDITABLE.elements,
    all: { ...EDITABLE.elements.all, repeat: { statePath: '/invoices' } },
  },
};

export const LISTS_TASKS: Task[] = [
  {
    id: 'orient',
    goal: (
      <>
        Start by breaking it: point <code>all.repeat.statePath</code> at <code>/nope</code>. All three rows vanish and
        the card still draws — proof the container renders once and only its <code>children</code> repeat.
      </>
    ),
    hint: 'Rule: a repeat over a missing or non-array path renders zero children, never an error. Set "statePath": "/nope" and read repeat ×0 in the tree tab. The status bar stays clean: validateSpec only emits repeat_state_mismatch when the spec carries its own "state" object to compare against, and this one seeds the store instead. Put "/invoices" back when you are done.',
    steps: [
      <>
        Click the <strong>tree</strong> tab. The list is the element graph, root first: <code>Screen screen</code>,
        then <code>Card all</code>, then <code>Stack row</code> with three leaves under it.
      </>,
      <>
        Read the green tag on the <code>Card all</code> row: <code>repeat ×3</code>. One card, three copies of its
        children.
      </>,
      <>
        Open the <strong>spec json</strong> tab and find{' '}
        <code>{'"repeat": { "statePath": "/invoices", "key": "id" }'}</code> on the <code>all</code> element — a
        top-level field, beside <code>props</code>, not inside it.
      </>,
      <>
        Change <code>"/invoices"</code> to <code>"/nope"</code>.
      </>,
      <>
        Look at <strong>rendered output</strong>: the card and its <strong>All invoices</strong> title still draw, and
        every row is gone.
      </>,
      <>
        Back on the <strong>tree</strong> tab, the <code>all</code> row now reads <code>repeat ×0</code> in yellow, and{' '}
        <code>row</code> is still listed once underneath.
      </>,
    ],
    solution: {
      spec: BROKEN_PATH,
      seed: LISTS_SEED,
      note: 'A repeat over a path that holds no array renders zero children and no error. Put "/invoices" back when you have seen it.',
    },
    check: ({ spec }) =>
      Object.values(spec?.elements ?? {}).some(
        (el) => typeof (el.repeat as { statePath?: unknown } | undefined)?.statePath === 'string'
          && (el.repeat as { statePath: string }).statePath !== '/invoices',
      ),
  },
  {
    id: 'index',
    goal: (
      <>
        Add a <code>Text</code> to each row showing <code>{'{ "$index": true }'}</code>. You get 0, 1, 2 from a single
        element definition — that is what &ldquo;the children are expanded&rdquo; means in practice.
      </>
    ),
    hint: 'Rule: $index must be exactly true; any other value makes it an ordinary object. Add "idx": { "type": "Text", "props": { "value": { "$index": true }, "tone": null, "size": "sm" }, "children": [] } and put "idx" first in row.children.',
    steps: [
      <>
        Add a new element to <code>elements</code>:{' '}
        <code>{'"idx": { "type": "Text", "props": { "value": { "$index": true }, "tone": null, "size": "sm" }, "children": [] }'}</code>
        .
      </>,
      <>
        Change the <code>row</code> element&rsquo;s <code>children</code> to{' '}
        <code>{'["idx", "who", "amt", "st"]'}</code>.
      </>,
      <>
        Look at <strong>rendered output</strong>: the three rows now start <code>0</code>, <code>1</code>,{' '}
        <code>2</code>.
      </>,
      <>
        Click the <strong>tree</strong> tab: there is still exactly one <code>Text idx</code> node. One definition,
        three renders.
      </>,
    ],
    solution: {
      spec: WITH_INDEX,
      seed: LISTS_SEED,
      note: '{ "$index": true } resolves to the current zero-based position, supplied by the renderer — the element itself is defined once.',
    },
    check: ({ spec }) => Boolean(deepFind(spec?.elements ?? {}, (n) => n.$index === true)),
  },
  {
    id: 'filter',
    goal: (
      <>
        Show only the unpaid invoices. There is no filter field — the trick is a <code>$item</code> condition on the
        <em> same</em> element that carries <code>repeat</code>.
      </>
    ),
    hint: 'Rule: the renderer splits a repeat container\'s visible condition — $item conjuncts pick items, $state conjuncts gate the container. Add "visible": { "$item": "status", "eq": "unpaid" } to the "all" element, beside repeat.',
    steps: [
      <>
        Open the <strong>spec json</strong> tab and find the <code>all</code> element.
      </>,
      <>
        Directly after its <code>repeat</code> field, add{' '}
        <code>{'"visible": { "$item": "status", "eq": "unpaid" }'}</code>.
      </>,
      <>
        Look at <strong>rendered output</strong>: <strong>Acme Oy</strong> — the paid one — is gone, and two rows
        remain.
      </>,
      <>
        Click the <strong>tree</strong> tab: <code>all</code> now reads <code>repeat ×2</code> and carries{' '}
        <em>no</em> <strong>hidden</strong> tag — the card itself is still shown.
      </>,
      <>
        Click the <code>Card all</code> row and read the <code>visible</code> entry in the inspector: it splits into{' '}
        <code>container</code> (<code>no gate — always shown</code>) and <code>item filter</code> (
        <code>run once per item</code>).
      </>,
    ],
    solution: {
      spec: FILTERED,
      seed: LISTS_SEED,
      note: 'On a repeat container the visible condition is split: $item conjuncts filter the items, anything else gates the container. Here there is no gate, so the card stays and two of three items survive.',
    },
    check: ({ spec }) =>
      Object.values(spec?.elements ?? {}).some(
        (el) => el.repeat && el.visible && usesExpression(el.visible, '$item'),
      ),
  },
  {
    id: 'template',
    goal: (
      <>
        Replace a row&rsquo;s two separate Texts with one <code>$template</code>. Bare <code>${'{name}'}</code> holes
        read the current item first, so a row template needs no paths at all.
      </>
    ),
    hint: 'Rule: ${/absolute} reads state, ${bare} reads the repeat item then falls back to /bare in state. Set who.props.value to { "$template": "${client} owes ${amount}" }.',
    steps: [
      <>
        Open the <strong>spec json</strong> tab and find the <code>who</code> element.
      </>,
      <>
        Change its <code>{'"value": { "$item": "client" }'}</code> to{' '}
        <code>{'"value": { "$template": "${client} owes ${amount}" }'}</code>.
      </>,
      <>
        Delete <code>"amt"</code> from the <code>row</code> element&rsquo;s <code>children</code>, and delete the{' '}
        <code>amt</code> element itself — one hole already prints the amount.
      </>,
      <>
        Look at <strong>rendered output</strong>: each row reads{' '}
        <code>Borealis AB owes €3,480</code> on one line.
      </>,
      <>
        Click the <strong>tree</strong> tab, click the <code>Text who</code> row, and read the inspector:{' '}
        <code>in spec</code> the template, <code>resolves to</code> <strong>undefined</strong> — the tree walks the
        graph with no row scope, so bare holes have nothing to read. The preview is the honest view.
      </>,
    ],
    solution: {
      spec: TEMPLATED,
      seed: LISTS_SEED,
      note: 'A bare ${name} hole reads the current repeat item first, so a row template needs no pointers; the amt element is no longer needed.',
    },
    check: ({ spec }) =>
      Boolean(
        deepFind(spec?.elements ?? {}, (n) => typeof n.$template === 'string' && /\$\{[a-zA-Z]/.test(n.$template)),
      ),
  },
  {
    id: 'binditem',
    goal: (
      <>
        Type a note into the second row of this <strong>editable rows</strong> spec. Read the write in the{' '}
        <strong>log</strong>: it went to <code>/invoices/1/note</code>, not to one shared path.
      </>
    ),
    hint: 'Rule: $bindItem is joined to the repeat base path, so the binding each row receives is an absolute, per-row pointer. Read it in the log tab: the write lands on /invoices/1/note. The tree inspector cannot show it — it resolves elements without a repeat scope, so $bindItem there reads as undefined.',
    steps: [
      <>
        In <strong>rendered output</strong>, click into the <em>second</em> <strong>Note</strong> field down.
      </>,
      <>
        Type <code>chase this</code>.
      </>,
      <>
        Click the <strong>log</strong> tab and read the newest line:{' '}
        <code>write /invoices/1/note = "chase this"</code> — an absolute pointer carrying the row index.
      </>,
      <>
        Click the <strong>state</strong> tab: only the second object in <code>invoices</code> has a note; the other
        two are still <code>""</code>.
      </>,
    ],
    check: ({ written }) => written.some((p) => /^\/invoices\/\d+\/(note|chase)$/.test(p)),
  },
  {
    id: 'nested',
    goal: (
      <>
        A list of lists needs no new syntax: the inner <code>statePath</code> is an <code>$item</code> expression,
        which reads an array off the enclosing row.
      </>
    ),
    hint: 'Rule: { "$item": … } as a statePath is legal only inside another repeat — elsewhere validateSpec reports repeat_item_outside_scope. Inside the inner repeat, $item now means the INNER item; the outer one is out of reach.',
    steps: [
      <>
        Look at <strong>rendered output</strong>: three cards, one per client, each holding its own row of SKU
        badges — 2, then 1, then 3.
      </>,
      <>
        Open the <strong>spec json</strong> tab and read the <code>inner</code> element:{' '}
        <code>{'"repeat": { "statePath": { "$item": "lines" }, "key": "sku" }'}</code>.
      </>,
      <>
        Read the <code>line</code> element below it: <code>{'{ "$item": "sku" }'}</code> — inside the inner repeat,{' '}
        <code>$item</code> means the inner item, and the invoice is out of reach.
      </>,
      <>
        Click the <strong>tree</strong> tab: <code>outer</code> reads <code>repeat ×3</code> and <code>inner</code>{' '}
        reads <code>repeat ×0</code> — the tree has no row scope, so it cannot resolve an <code>$item</code>{' '}
        statePath. The preview is the honest count.
      </>,
    ],
    solution: {
      spec: NESTED,
      seed: LISTS_SEED,
      note: 'The inner repeat takes its array from { "$item": "lines" } on the enclosing row — the same $item form, used as a statePath.',
    },
    check: ({ spec }) =>
      Object.values(spec?.elements ?? {}).some(
        (el) => el.repeat && typeof el.repeat === 'object' && usesExpression((el.repeat as { statePath?: unknown }).statePath, '$item'),
      ),
  },
  {
    id: 'nokey',
    goal: (
      <>
        Delete <code>key</code> from a <code>repeat</code>, then try to catch it failing. You will not manage it
        here — and understanding <em>why</em> is the point: nothing in this lab holds state React owns.
      </>
    ),
    hint: 'Rule: key names a field on the item to use as the React key; omit it and the array index is used. That changes which INSTANCE survives a removal, not which props it gets — so a row whose every field is $bindItem looks perfect either way, and only state React owns lands on the wrong row.',
    steps: [
      <>
        Open the <strong>spec json</strong> tab and find <code>all.repeat</code>.
      </>,
      <>
        Delete <code>, "key": "id"</code> so it reads <code>{'"repeat": { "statePath": "/invoices" }'}</code>.
      </>,
      <>
        Type <code>keep me</code> into the <em>second</em> <strong>Note</strong> field, then press{' '}
        <strong>remove</strong> on the <em>first</em> row.
      </>,
      <>
        The note is on the right row. Put the <code>key</code> back and do it again: identical. Every field here is{' '}
        <code>$bindItem</code>, so its value lives at <code>/invoices/1/note</code> — and a reused instance is still
        handed the correct props.
      </>,
      <>
        What did change is invisible from the page. With the key, React unmounts the removed row and moves the
        others; without it, it keeps the first two component instances and unmounts the <em>last</em> — so the
        instance that was row&nbsp;2 is now driving row&nbsp;1.
      </>,
      <>
        That is why the bug is so hard to catch: it only shows once a row holds something the spec does not — the
        caret, an uncontrolled input, <code>useState</code> inside your own component, a running transition. Then
        row&nbsp;2&rsquo;s internals are sitting on row&nbsp;1&rsquo;s data.
      </>,
      <>
        Read the status bar under the editor: <code>validateSpec: clean</code>. Nothing reports the missing key, so
        set it on any repeat whose rows hold anything.
      </>,
    ],
    solution: {
      spec: NO_KEY,
      seed: LISTS_SEED,
      note: 'The editable preset with key removed. Nothing on screen changes, because every row field is $bindItem and reads from the state model; what changes is which component instances survive a removal, and nothing warns either way.',
    },
    check: ({ spec }) =>
      Object.values(spec?.elements ?? {}).some(
        (el) => el.repeat && typeof el.repeat === 'object' && !('key' in (el.repeat as object)),
      ),
  },
];

/**
 * Seven stages. Not strictly monotonic, because this lab genuinely branches:
 * stages five to seven each arrive at one of the three presets rather than
 * building on the last. Every stage still carries a COMPLETE spec, which is
 * what matters — and it is why the "click the preset chip" instructions came
 * out of the steps above.
 */
const LISTS_STAGES = stagesFromTasks(
  LISTS_TASKS,
  [
    {
      title: 'repeat is an element field',
      concept: 'repeat-container',
      when:
        'One element definition drawing N times from an array in state. It is not for a fixed handful of things that merely look alike: three cards with different copy are three elements, and a repeat over them means inventing an array in state whose only job is to hold their text.',
      ref: 'el-repeat',
      panes: ['spec', 'tree'],
      spec: BASIC,
    },
    {
      title: 'The row index',
      concept: 'repeat-key',
      when:
        'Display and position — a row number, an "N of M" caption, a first-or-last rule. Use a field on the item whenever the number means something to the reader, because `$index` is the position in the array as it stands and moves with any sort or filter.',
      ref: 'expr-index',
      refs: ['cond-index'],
      panes: ['spec', 'tree'],
      spec: BASIC,
    },
    {
      title: 'Filtering with $item',
      concept: 'filtered-repeat',
      when:
        'One array feeding several views — kanban columns, paid and unpaid tabs — as one repeat element per view with a different `$item` condition. Filter the data before it reaches the store when the rows are simply never wanted: the split filter still walks the whole array on every render and only drops the rows on the way out.',
      ref: 'expr-item',
      refs: ['cond-item'],
      panes: ['spec', 'tree'],
      spec: WITH_INDEX,
    },
    {
      title: 'One $template, two Texts',
      when:
        'When a value belongs inside a sentence rather than filling a prop, which saves an element per fragment. Not for formatting: the result is `String(value)`, so numbers lose their grouping and objects become "[object Object]", and a path that misses becomes an empty string with no gap to notice. Formatting is `$computed`, or the component.',
      ref: 'expr-template',
      // 'tree': the last step reads the template's `resolves to undefined` in
      // the tree inspector — the point being that the tree has no row scope.
      panes: ['spec', 'tree', 'state'],
      summary:
        '`$template` interpolates `${…}` holes in a string, so one Text can say what two used to. Inside a repeat the holes resolve against the row, which is why it pairs with lists rather than living with the other expressions.',
      spec: FILTERED,
    },
    {
      title: '$bindItem writes per row',
      concept: 'bind-item',
      when:
        'Editable rows — a note, a chase checkbox, a quantity — where each row writes into its own slot in the array rather than a shared path. Use `$item` when the row only displays the field; `$bindItem` outside a repeat resolves to undefined, and is one of the very few things the library bothers to warn about.',
      ref: 'expr-binditem',
      panes: ['log', 'state', 'spec'],
      spec: EDITABLE,
    },
    {
      title: 'A list of lists',
      concept: 'nested-repeat',
      when:
        'When the data is genuinely nested — invoices with lines, groups with members — and the inner array hangs off the row rather than off state. Flatten in the host instead when you only want one level of output: inside the inner repeat `$item` means the INNER item and the outer row is out of reach, so anything needing both has to be joined before the spec sees it.',
      panes: ['spec', 'tree'],
      spec: NESTED,
    },
    {
      title: 'The key you must not drop',
      concept: 'repeat-key',
      when:
        'Set `key` on every repeat whose rows hold state the spec does not — focus, an uncontrolled input, a component with its own `useState`, anything animating. You can omit it for a read-only list, and for rows built entirely from `$bindItem` you will not see a difference at all, which is exactly what makes it dangerous to rely on: the day one component grows internal state, the bug arrives somewhere else entirely and looks nothing like a missing key.',
      panes: ['spec', 'state'],
      spec: EDITABLE,
    },
  ],
  LISTS_SEED,
);

export function ListsLab() {
  return (
    <SpecPlayground
      spec={BASIC}
      seedState={LISTS_SEED}
      // The playground opens on panes[0] of THIS list, not of the stage it
      // lands on, so the first entry has to be a pane stage one actually shows
      // — otherwise arriving at the lab highlights no tab at all.
      panes={['spec', 'tree', 'state', 'log', 'catalog', 'impl']}
      height={540}
      stages={LISTS_STAGES}
      labSlug="lists"
      presets={[
        { label: 'basic repeat', spec: BASIC, seedState: LISTS_SEED },
        { label: 'editable rows ($bindItem)', spec: EDITABLE, seedState: LISTS_SEED },
        { label: 'nested repeat', spec: NESTED, seedState: LISTS_SEED },
      ]}
      hint={
        <>
          <code>repeat</code> is a top-level element field, never inside <code>props</code>. The container renders
          once; its <code>children</code> are expanded per item.
        </>
      }
    />
  );
}
