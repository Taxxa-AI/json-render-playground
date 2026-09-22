'use client';

import type { Spec } from '@json-render/core';
import { autoFixSpec, createStateStore, formatSpecIssues, isNonEmptySpec, validateSpec } from '@json-render/core';
import { JSONUIProvider, Renderer } from '@json-render/react';
import { useEffect, useMemo, useState } from 'react';
import { demoRegistry, UnknownComponent } from '@/lib/demo/registry';
import { JsonEditor } from '../playground/json-editor';
import { Chip, CopyButton, Panel } from '../playground/ui';
import type { ChecklistItem } from './checklist';
import { StageFrame } from './stage-frame';
import { stagesFromChecklist } from '@/lib/labs/types';

/**
 * Every spec here is a REAL failure shape a model produces. Fixing them by
 * hand once is worth more than reading the list of issue codes.
 */
export const BROKEN: Array<{ label: string; why: string; spec: unknown; fixed: unknown }> = [
  {
    label: 'dangling child',
    why: 'children names an element that was never defined. The branch silently disappears.',
    spec: {
      root: 'screen',
      elements: {
        screen: { type: 'Screen', props: { title: 'Report', subtitle: null }, children: ['summary', 'missing'] },
        summary: { type: 'Text', props: { value: 'Everything reconciled.', tone: null, size: null }, children: [] },
      },
    },
    fixed: {
      root: 'screen',
      elements: {
        screen: { type: 'Screen', props: { title: 'Report', subtitle: null }, children: ['summary'] },
        summary: { type: 'Text', props: { value: 'Everything reconciled.', tone: null, size: null }, children: [] },
      },
    },
  },
  {
    label: 'visible inside props',
    why: 'The most common model mistake. Legal JSON, completely inert — the renderer never looks in props.',
    spec: {
      root: 'screen',
      elements: {
        screen: { type: 'Screen', props: { title: null, subtitle: null }, children: ['alert'] },
        alert: {
          type: 'Alert',
          props: { title: 'Attention', message: 'Should only show when flagged.', tone: 'warning', visible: { $state: '/flag' } },
          children: [],
        },
      },
    },
    fixed: {
      root: 'screen',
      elements: {
        screen: { type: 'Screen', props: { title: null, subtitle: null }, children: ['alert'] },
        alert: {
          type: 'Alert',
          props: { title: 'Attention', message: 'Should only show when flagged.', tone: 'warning' },
          visible: { $state: '/flag' },
          children: [],
        },
      },
    },
  },
  {
    label: 'on inside props',
    why: 'Same class of error. The button renders and does nothing at all.',
    spec: {
      root: 'screen',
      elements: {
        screen: { type: 'Screen', props: { title: null, subtitle: null }, children: ['btn'] },
        btn: {
          type: 'Button',
          props: { label: 'Mark reviewed', variant: 'primary', on: { press: { action: 'notify', params: { message: 'hi' } } } },
          children: [],
        },
      },
    },
    fixed: {
      root: 'screen',
      elements: {
        screen: { type: 'Screen', props: { title: null, subtitle: null }, children: ['btn'] },
        btn: {
          type: 'Button',
          props: { label: 'Mark reviewed', variant: 'primary' },
          on: { press: { action: 'notify', params: { message: 'hi' } } },
          children: [],
        },
      },
    },
  },
  {
    label: 'repeat without children',
    why: 'The model conflated the container with the item. Renders nothing, forever.',
    spec: {
      root: 'screen',
      elements: {
        screen: { type: 'Screen', props: { title: null, subtitle: null }, children: ['list'] },
        list: {
          type: 'Card',
          props: { title: 'Invoices', subtitle: null },
          repeat: { statePath: '/invoices', key: 'id' },
          children: [],
        },
      },
      state: { invoices: [{ id: '1' }, { id: '2' }] },
    },
    fixed: {
      root: 'screen',
      elements: {
        screen: { type: 'Screen', props: { title: null, subtitle: null }, children: ['list'] },
        list: {
          type: 'Card',
          props: { title: 'Invoices', subtitle: null },
          repeat: { statePath: '/invoices', key: 'id' },
          children: ['row'],
        },
        row: { type: 'Text', props: { value: { $item: 'id' }, tone: null, size: null }, children: [] },
      },
      state: { invoices: [{ id: '1' }, { id: '2' }] },
    },
  },
  {
    label: 'malformed visible',
    why: 'Uses an operator that does not exist. The evaluator ignores it and falls back to a truthiness check on /count, so the metric shows for any non-zero count — the rule you wrote is simply not applied. Only validateSpec notices.',
    spec: {
      root: 'screen',
      elements: {
        screen: { type: 'Screen', props: { title: null, subtitle: null }, children: ['m'] },
        m: {
          type: 'Metric',
          props: { label: 'Overdue', value: '4', delta: null, tone: 'danger' },
          visible: { $state: '/count', greaterThan: 2 },
          children: [],
        },
      },
      state: { count: 9 },
    },
    fixed: {
      root: 'screen',
      elements: {
        screen: { type: 'Screen', props: { title: null, subtitle: null }, children: ['m'] },
        m: {
          type: 'Metric',
          props: { label: 'Overdue', value: '4', delta: null, tone: 'danger' },
          visible: { $state: '/count', gt: 2 },
          children: [],
        },
      },
      state: { count: 9 },
    },
  },
  {
    label: 'dangling slot ref',
    why: 'A named slot points at a key that does not exist. The footer is simply absent.',
    spec: {
      root: 'card',
      elements: {
        card: { type: 'Card', props: { title: 'Summary', subtitle: null }, children: ['body'], slots: { footer: ['gone'] } },
        body: { type: 'Text', props: { value: 'Body text.', tone: null, size: null }, children: [] },
      },
    },
    fixed: {
      root: 'card',
      elements: {
        card: { type: 'Card', props: { title: 'Summary', subtitle: null }, children: ['body'], slots: { footer: ['foot'] } },
        body: { type: 'Text', props: { value: 'Body text.', tone: null, size: null }, children: [] },
        foot: { type: 'Button', props: { label: 'Export', variant: 'secondary' }, children: [] },
      },
    },
  },
  {
    label: 'missing children key',
    why: 'children is omitted entirely. validateSpec reports nothing and the element renders — but any code that walks spec.elements[k].children without a fallback throws on undefined. This one is about YOUR code, not the library\u2019s.',
    spec: {
      root: 'screen',
      elements: {
        screen: { type: 'Screen', props: { title: null, subtitle: null }, children: ['t'] },
        t: { type: 'Text', props: { value: 'No children array on me.', tone: null, size: null } },
      },
    },
    fixed: {
      root: 'screen',
      elements: {
        screen: { type: 'Screen', props: { title: null, subtitle: null }, children: ['t'] },
        t: { type: 'Text', props: { value: 'No children array on me.', tone: null, size: null }, children: [] },
      },
    },
  },
  {
    label: 'unknown component',
    why: 'Not in the registry. validateSpec passes it — structure is fine, and it never checks a type against your registry. You get the fallback, or nothing at all if you did not pass one.',
    spec: {
      root: 'screen',
      elements: {
        screen: { type: 'Screen', props: { title: null, subtitle: null }, children: ['c'] },
        c: { type: 'BarChart', props: { data: [1, 2, 3] }, children: [] },
      },
    },
    fixed: {
      root: 'screen',
      elements: {
        screen: { type: 'Screen', props: { title: null, subtitle: null }, children: ['c'] },
        c: { type: 'Metric', props: { label: 'Total', value: '6', delta: null, tone: null }, children: [] },
      },
    },
  },
];

/**
 * Not a ninth chip: this is the one shape `autoFixSpec` deliberately will NOT
 * prune, so it belongs to the lossy lesson rather than to the tour of the
 * eight. The repeat's whole child list is dangling, and pruning would leave
 * the template empty.
 */
const REPEAT_DANGLER: Spec = {
  root: 'screen',
  elements: {
    screen: { type: 'Screen', props: { title: null, subtitle: null }, children: ['list'] },
    list: {
      type: 'Card',
      props: { title: 'Invoices', subtitle: null },
      repeat: { statePath: '/invoices', key: 'id' },
      children: ['row'],
    },
  },
  state: { invoices: [{ id: '1' }, { id: '2' }] },
} as unknown as Spec;

/**
 * The only WARNING in the vocabulary, and the only issue you have to ask for.
 * `summary` is defined and rendered by nothing, which is invisible to the
 * default call.
 */
const ORPHANED: Spec = {
  root: 'screen',
  elements: {
    screen: { type: 'Screen', props: { title: 'Report', subtitle: null }, children: [] },
    summary: { type: 'Text', props: { value: 'Nothing references me.', tone: null, size: null }, children: [] },
  },
} as unknown as Spec;

/** Fails `isNonEmptySpec`: `elements` is an object, but it has no keys. */
const NO_ELEMENTS: Spec = { root: 'screen', elements: {} } as unknown as Spec;

/** PASSES `isNonEmptySpec` and still renders nothing — the guard never checks that root exists. */
const DANGLING_ROOT: Spec = {
  root: 'screen',
  elements: { body: { type: 'Text', props: { value: 'Nothing points at me.', tone: null, size: null }, children: [] } },
} as unknown as Spec;

/**
 * Did `autoFixSpec` hit its one built-in exception?
 *
 * The library refuses to prune a dangling child list when doing so would empty
 * an element that carries a `repeat` — the template is assumed to still be
 * streaming. Detecting the SHAPE here is what lets the checklist tell "lossy
 * found nothing to do" apart from "lossy declined".
 */
function hasProtectedRepeatDangler(spec: Spec): boolean {
  const els = (spec.elements ?? {}) as Record<string, { repeat?: unknown; children?: string[] }>;
  return Object.values(els).some((el) => {
    const kids = el.children ?? [];
    return Boolean(el.repeat) && kids.length > 0 && kids.every((k) => !(k in els));
  });
}

/**
 * An instrument this stage is not about.
 *
 * Same treatment as `registry-inspector`'s off-focus fields: the row stays, so
 * the learner keeps seeing that the loop has four readouts, but it costs one
 * dim line instead of a panel's worth of numbers to read past.
 */
function Dim({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-dashed bg-surface px-3 py-1.5 opacity-45">
      <span className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="text-[11px] text-muted-foreground">&middot; not this step</span>
    </div>
  );
}

/** The lesson half of each stage; `items` supplies the assignment half. */
const REPAIR_STAGES = [
  {
    id: 'look',
    focus: 'validate',
    title: 'Eight ways to be broken',
    when:
      'Validate anything a model produced, before it reaches the Renderer. Do not reach for it on a spec your own compiler built: a pure function does not need its output checked at runtime, and walking every element per render is exactly the cost the compiled path exists to avoid. It reads structure only, so it will never catch a wrong component name or a mistyped prop.',
    concept: 'validate-spec-structure',
    ref: 'util-validatespec',
  },
  {
    id: 'codes',
    focus: 'validate',
    title: 'The code is the diagnosis',
    when:
      'Switch on `code` when your own code has to decide something — retry, prune, refuse — and read the message when the reader is a person or the model. Turn `checkOrphans` on while you are hunting for UI the model described and never attached; leave it off in the request path, since an orphan is a warning and never a reason to reject a spec.',
    concept: 'issue-codes',
    summary:
      'Thirteen codes, one vocabulary — not thirteen lessons. What is worth learning is the shape of the REPORT: missing_root returns early, so one issue can be hiding five, and orphaned_element is the only warning, off unless you ask for it.',
  },
  {
    id: 'hand',
    focus: 'validate',
    title: 'Repair two by hand',
    when:
      'A repair loop earns its keep when generation happens in front of a user and one more turn is cheaper than a wrong page. When you are generating offline — a batch, a template someone will review — reject the spec and go read it instead: an automatic retry hides the pattern that a better prompt or a narrower catalog would have removed.',
    concept: 'repair-loop',
  },
  {
    id: 'safe',
    focus: 'autofix',
    title: 'autoFixSpec, safe and lossy',
    when:
      'Run the safe pass on every model-produced spec, always, because it cannot lose anything. Hold the lossy pass back until the final attempt and only when showing nothing is the alternative: it always yields something that renders, which is precisely the danger — the user gets a page missing the section they asked for, and the report does not say which one.',
    concept: 'autofix-lossy-vs-safe',
    ref: 'util-autofixspec',
    tasks: 2,
    summary:
      'One function, two modes. The safe pass only makes repairs that cannot lose anything; the lossy pass will drop whole elements to make a spec valid. Both always produce something that renders, which is what makes the second one dangerous.',
  },
  {
    id: 'exception',
    focus: 'autofix',
    title: 'The prune lossy refuses',
    when:
      'Read an unfixed spec here as "the stream is not finished" rather than "fix harder" — a repeat whose children are all dangling is what a half-arrived template looks like, not a broken one. Reaching for a manual prune to force it valid throws away the rows that were about to land.',
    concept: 'lossy-fix',
    summary:
      'Lossy is not "delete whatever is dangling". One shape is carved out: an element with a repeat whose entire child list is dangling is left alone, because that is what a half-streamed template looks like. You get an unfixed spec instead of an empty list.',
  },
  {
    id: 'handoff',
    focus: 'handoff',
    title: 'The paragraph you send back',
    when:
      'Format the issues when the next reader is the model; keep the issue objects when the next reader is your code or your logs. Test the string for emptiness to decide whether another turn is worth spending — not to decide whether the spec is clean, because every warning was dropped on the way into it.',
    ref: 'util-formatspecissues',
    summary:
      'What the model receives on a retry is not the issue objects, it is one string. formatSpecIssues drops every warning and returns the EMPTY STRING when no errors are left — so "it produced something" is the only safe test before you spend another turn.',
  },
  {
    id: 'guard',
    focus: 'guard',
    title: 'Is there a spec yet?',
    when:
      'This is the first gate on a stream, ahead of validation and rendering, and it costs three comparisons. Never make it the last one: it does not check that `root` exists in `elements`, so a spec it approves can still render an empty page.',
    ref: 'util-isnonemptyspec',
    summary:
      'The cheapest question in the loop, and the one that decides whether the next turn is a fresh generation or a refinement. Three conditions, and none of them is "root actually exists".',
  },
];

export function RepairLab() {
  const [idx, setIdx] = useState(0);
  const [text, setText] = useState(() => JSON.stringify(BROKEN[0].spec, null, 2));
  const [lossy, setLossy] = useState(false);
  const [checkOrphans, setCheckOrphans] = useState(false);
  const [applied, setApplied] = useState<Spec | null>(null);
  const [fixNotes, setFixNotes] = useState<Array<{ message: string; lossy: boolean }>>([]);
  const [visited, setVisited] = useState<Set<number>>(new Set([0]));
  const [handFixed, setHandFixed] = useState<Set<number>>(new Set());
  const [sawLossy, setSawLossy] = useState(false);
  const [sawSafe, setSawSafe] = useState(false);
  const [seenCodes, setSeenCodes] = useState<Set<string>>(new Set());
  const [sawRepeatException, setSawRepeatException] = useState(false);
  const [sawSilentEmpty, setSawSilentEmpty] = useState(false);
  const [guardFalse, setGuardFalse] = useState(false);
  const [guardBlindToRoot, setGuardBlindToRoot] = useState(false);

  const store = useMemo(() => createStateStore({ flag: true, count: 9, invoices: [{ id: '1' }, { id: '2' }] }), []);

  const parsed = useMemo(() => {
    try {
      return { ok: true as const, value: JSON.parse(text) as Spec };
    } catch (e) {
      return { ok: false as const, error: (e as Error).message };
    }
  }, [text]);

  const report = useMemo(() => (parsed.ok ? validateSpec(parsed.value, { checkOrphans }) : null), [parsed, checkOrphans]);

  /** The two loop inputs that are strings and booleans rather than issue objects. */
  const issueText = useMemo(() => (report ? formatSpecIssues(report.issues) : ''), [report]);
  const guard = parsed.ok ? isNonEmptySpec(parsed.value) : false;
  const rootIsMissing =
    parsed.ok && guard && !((parsed.value.root as string) in ((parsed.value.elements ?? {}) as Record<string, unknown>));

  // The vocabulary is learned by collecting it, so every code the learner has
  // made validateSpec emit is remembered across chips and across edits.
  useEffect(() => {
    if (!report || report.issues.length === 0) return;
    setSeenCodes((prev) => {
      const next = new Set(prev);
      for (const iss of report.issues) next.add(iss.code);
      return next.size === prev.size ? prev : next;
    });
  }, [report]);

  // formatSpecIssues filters warnings out, so an empty string does NOT mean a
  // clean spec. That gap only becomes visible when a warning is the only issue.
  useEffect(() => {
    if (report && report.issues.length > 0 && issueText === '') setSawSilentEmpty(true);
  }, [report, issueText]);

  useEffect(() => {
    if (!parsed.ok) return;
    if (!guard) setGuardFalse(true);
    else if (rootIsMissing) setGuardBlindToRoot(true);
  }, [parsed.ok, guard, rootIsMissing]);

  // A hand-fix counts when the edited text validates clean AND is not just the
  // preset reloaded — i.e. the learner changed something.
  const isHandFixed =
    report?.valid === true && !applied && text !== JSON.stringify(BROKEN[idx].spec, null, 2);
  useEffect(() => {
    if (!isHandFixed) return;
    setHandFixed((prev) => (prev.has(idx) ? prev : new Set(prev).add(idx)));
  }, [isHandFixed, idx]);

  const preview = applied ?? (parsed.ok ? parsed.value : null);

  function load(i: number) {
    setIdx(i);
    setVisited((prev) => new Set(prev).add(i));
    setText(JSON.stringify(BROKEN[i].spec, null, 2));
    setApplied(null);
    setFixNotes([]);
  }

  function runFix(input: Spec, withLossy: boolean) {
    // autoFixSpec repairs in place, and some of these inputs are module
    // constants the chips reload from.
    const out = autoFixSpec(structuredClone(input), { lossy: withLossy });
    setApplied(out.spec as Spec);
    const details = (out.fixDetails ?? []) as Array<{ message: string; lossy: boolean }>;
    setFixNotes(details);
    if (details.some((d) => d.lossy)) setSawLossy(true);
    if (details.some((d) => !d.lossy)) setSawSafe(true);
    // A lossy pass that declined to prune a dangling repeat template is the
    // library's one carve-out, and on screen it looks exactly like "nothing to fix".
    if (withLossy && hasProtectedRepeatDangler(input) && !details.some((d) => d.lossy)) setSawRepeatException(true);
  }

  function runAutoFix() {
    if (!parsed.ok) return;
    runFix(parsed.value, lossy);
  }

  /** Put an arbitrary spec in the editor, as the chips do, without an autoFix result. */
  function show(spec: Spec) {
    setText(JSON.stringify(spec, null, 2));
    setApplied(null);
    setFixNotes([]);
  }

  /**
   * What the checklist's "do it for me" buttons run: load a case and fix it in
   * one go. It cannot call load() then runAutoFix(), because runAutoFix reads
   * the PARSED text, which React has not re-rendered yet.
   */
  function autoFixCase(i: number, withLossy: boolean) {
    setIdx(i);
    setVisited((prev) => new Set(prev).add(i));
    setText(JSON.stringify(BROKEN[i].spec, null, 2));
    setLossy(withLossy);
    runFix(BROKEN[i].spec as Spec, withLossy);
  }

  /** Paste the repaired version of the case on screen into the editor. */
  function handFix() {
    setText(JSON.stringify(BROKEN[idx].fixed, null, 2));
    setApplied(null);
    setFixNotes([]);
  }

  /** Strip `root` from the case on screen, which is what makes validateSpec bail early. */
  function stripRoot() {
    const { root: _root, ...rest } = BROKEN[idx].spec as Record<string, unknown>;
    void _root;
    show(rest as unknown as Spec);
  }

  /** Load the protected shape and run the lossy pass on it in one press. */
  function runRepeatException() {
    setText(JSON.stringify(REPEAT_DANGLER, null, 2));
    setLossy(true);
    runFix(REPEAT_DANGLER, true);
  }

  const items: ChecklistItem[] = [
    {
      label: `Look at all eight broken specs (${visited.size}/8 seen).`,
      done: visited.size === BROKEN.length,
      steps: [
        <>
          Click the second chip, <strong>visible inside props</strong>.
        </>,
        <>
          Read the yellow-bordered line under the chip row — it says what this model got wrong.
        </>,
        <>
          Read the <strong>validateSpec</strong> panel on the right: the issue code (here{' '}
          <code>visible_in_props</code>) and the element it blames.
        </>,
        <>
          Work along the chip row one chip at a time, reading both of those for each.
        </>,
        <>
          This line counts them — it reads <strong>8/8 seen</strong> when every chip has been opened.
        </>,
      ],
      apply: {
        label: 'open the next one',
        run: () => {
          const next = BROKEN.findIndex((_, i) => !visited.has(i));
          load(next === -1 ? (idx + 1) % BROKEN.length : next);
        },
      },
    },
    {
      label: (
        <>
          Collect six distinct issue codes, one of them <code>missing_root</code> ({seenCodes.size} so far).
        </>
      ),
      done: seenCodes.size >= 6 && seenCodes.has('missing_root'),
      hint: 'missing_root returns early: you get that one issue and nothing else is checked, however broken the rest is.',
      steps: [
        <>
          Walk the chip row once. The five chips that report anything give you five codes:{' '}
          <code>missing_child</code>, <code>visible_in_props</code>, <code>on_in_props</code>,{' '}
          <code>repeat_without_children</code> and <code>invalid_visible</code>.
        </>,
        <>
          Now stay on any chip and delete the whole <code>&quot;root&quot;</code> line from the top of the
          editor.
        </>,
        <>
          <strong>validateSpec</strong> collapses to a single <code>missing_root</code> — the dangling child
          or the misplaced <code>visible</code> underneath it is no longer reported at all. It returned
          before it got there.
        </>,
        <>
          Tick <code>checkOrphans</code> in the toolbar to unlock the thirteenth code,{' '}
          <code>orphaned_element</code>. It is the only <em>warning</em>, and <code>valid</code> stays true
          when it is the only issue.
        </>,
      ],
      apply: { label: 'delete the root key for me', run: stripRoot },
    },
    {
      label: 'Repair at least two by hand, so validateSpec reports clean.',
      done: handFixed.size >= 2,
      hint: 'Edit the JSON on the left; the status turns green when it validates.',
      steps: [
        <>
          Click the <strong>dangling child</strong> chip — the smallest repair of the eight.
        </>,
        <>
          In <strong>spec (edit to repair by hand)</strong>, delete <code>"missing"</code> from{' '}
          <code>screen.children</code>, leaving <code>["summary"]</code>.
        </>,
        <>
          Watch the <strong>validateSpec</strong> header flip from <strong>1 issue(s)</strong> to{' '}
          <strong>valid</strong>.
        </>,
        <>
          Now click <strong>on inside props</strong> and move the whole <code>on</code> object out of{' '}
          <code>props</code>, so it sits beside <code>type</code>, <code>props</code> and{' '}
          <code>children</code>. Press the button afterwards — it dispatches now.
        </>,
        <>
          This line only counts an edit that validates clean, so two greens is two genuine repairs.
        </>,
      ],
      apply: { label: 'repair this one for me', run: handFix },
    },
    {
      label: <>Run <code>autoFixSpec</code> and get a <strong>safe</strong> fix.</>,
      done: sawSafe,
      hint: 'Try "visible inside props" — relocating a field loses nothing.',
      steps: [
        <>
          Click the <strong>visible inside props</strong> chip.
        </>,
        <>
          Leave the checkbox reading <code>lossy: false</code>.
        </>,
        <>
          Press <strong>autoFixSpec</strong>.
        </>,
        <>
          Read <strong>autoFixSpec — fixDetails</strong>: one green <strong>safe</strong> row —{' '}
          <em>Moved &ldquo;visible&rdquo; from props to element level on &ldquo;alert&rdquo;</em>.
        </>,
        <>
          The preview header now reads <strong>preview · after autoFix</strong>. Press{' '}
          <strong>keep result</strong> to write it back into the editor.
        </>,
      ],
      apply: { label: 'run it on "visible inside props"', run: () => autoFixCase(1, false) },
    },
    {
      label: <>Tick <code>lossy</code> and get a <strong>LOSSY</strong> fix. Note what it deleted.</>,
      done: sawLossy,
      hint: 'Try "dangling child" with lossy on. It prunes the reference and the spec now looks valid.',
      steps: [
        <>
          Click the <strong>dangling child</strong> chip.
        </>,
        <>
          Press <strong>autoFixSpec</strong> first with <code>lossy: false</code> —{' '}
          <strong>fixDetails</strong> stays empty. There is no safe repair for a missing element.
        </>,
        <>
          Tick the <code>lossy</code> checkbox so it reads <code>lossy: true</code>, then press{' '}
          <strong>autoFixSpec</strong> again.
        </>,
        <>
          Read the red <strong>LOSSY</strong> row: it removed the reference to{' '}
          <code>&quot;missing&quot;</code>. <strong>validateSpec</strong> is happy and the section the user
          asked for is gone.
        </>,
      ],
      apply: { label: 'run it lossy on "dangling child"', run: () => autoFixCase(0, true) },
    },
    {
      label: (
        <>
          Find the one prune <code>lossy: true</code> will not make.
        </>
      ),
      done: sawRepeatException,
      hint: 'A dangling child list on an element that HAS a repeat is left alone when pruning would empty it — a half-streamed template looks exactly like this.',
      steps: [
        <>
          Click the <strong>repeat without children</strong> chip.
        </>,
        <>
          In the editor, give <code>list</code> a child it does not have: change{' '}
          <code>&quot;children&quot;: []</code> to <code>&quot;children&quot;: [&quot;row&quot;]</code>. There
          is no <code>row</code> element, so that reference is dangling.
        </>,
        <>
          Tick <code>lossy</code> and press <strong>autoFixSpec</strong>.
        </>,
        <>
          <strong>fixDetails</strong> stays EMPTY and <strong>validateSpec</strong> still reports{' '}
          <code>missing_child</code>. The same dangling reference on a plain element was pruned two steps
          ago; here it is protected, because emptying a repeat template is how you delete a whole list.
        </>,
        <>
          That is the outcome to design for: lossy handed you back a still-broken spec, so the loop has to
          re-prompt rather than accept it.
        </>,
      ],
      apply: { label: 'set it up and run it lossy', run: runRepeatException },
    },
    {
      label: (
        <>
          Make <code>formatSpecIssues</code> return the empty string while issues remain.
        </>
      ),
      done: sawSilentEmpty,
      hint: 'It filters warnings out. No ERRORS means the empty string, however many warnings are left.',
      steps: [
        <>
          Read the <strong>repair loop inputs</strong> panel below while you click along the chip row: the{' '}
          <code>formatSpecIssues</code> box holds the exact paragraph you would paste into the retry turn,
          header line and all.
        </>,
        <>
          Tick <code>checkOrphans</code> in the toolbar.
        </>,
        <>
          Replace the spec with one whose only issue is a warning: an element defined in{' '}
          <code>elements</code> that nothing lists in <code>children</code>.
        </>,
        <>
          <strong>validateSpec</strong> shows one <code>orphaned_element</code> row and{' '}
          <code>formatSpecIssues</code> reads <code>&quot;&quot;</code>. Send that to the model and you have
          re-prompted with nothing.
        </>,
        <>
          The test in your loop is therefore on the STRING, not on{' '}
          <code>issues.length</code>.
        </>,
      ],
      apply: {
        label: 'load a warning-only spec',
        run: () => {
          setCheckOrphans(true);
          show(ORPHANED);
        },
      },
    },
    {
      label: (
        <>
          Get <code>isNonEmptySpec</code> to say <code>false</code>, then catch it saying{' '}
          <code>true</code> about a spec that renders nothing.
        </>
      ),
      done: guardFalse && guardBlindToRoot,
      hint: 'Three conditions: root is a string, elements is a non-null object, and it has at least one key. Whether root exists in elements is not one of them.',
      steps: [
        <>
          Watch the <code>isNonEmptySpec</code> row in <strong>repair loop inputs</strong> below.
        </>,
        <>
          Empty the elements map — <code>&quot;elements&quot;: &#123;&#125;</code>. The guard flips to{' '}
          <code>false</code>: no keys, so there is nothing to refine and the next turn is a fresh
          generation.
        </>,
        <>
          Now put one element back but point <code>root</code> at a key that is not in the map. The guard
          says <code>true</code> again.
        </>,
        <>
          Read the warning beside it: the spec passes the guard, renders nothing, and{' '}
          <code>validateSpec</code> is the one reporting <code>root_not_found</code>. The guard is a
          &ldquo;has anything arrived yet&rdquo; test, not a validity test.
        </>,
      ],
      apply: {
        label: 'show me the next case',
        run: () => show(guardFalse ? DANGLING_ROOT : NO_ELEMENTS),
      },
    },
  ];

  const stages = stagesFromChecklist(items, REPAIR_STAGES);

  /**
   * The spec, its `validateSpec` report and the preview are the instrument:
   * every stage here is "what does the checker say about this spec, and does it
   * render". What does NOT belong on every stage is the rest of the loop —
   * `autoFixSpec`'s fixDetails on the three stages before it exists, and the
   * two retry inputs on the five stages before the retry. Those follow `focus`.
   */
  const stagedBody = (focus: string | undefined) => {
    const showFix = !focus || focus === 'autofix';
    const showGuard = !focus || focus === 'guard';
    const showFormat = !focus || focus === 'handoff';

    return (
      <div className="flex flex-col gap-3">

        <div className="flex flex-wrap gap-1.5">
          {BROKEN.map((b, i) => (
            <Chip key={b.label} active={idx === i} onClick={() => load(i)}>
              {b.label}
            </Chip>
          ))}
        </div>

        <div className="rounded-lg border-l-2 border-l-yellow-500 bg-surface px-3.5 py-2 text-[13.5px] leading-relaxed text-muted-foreground">
          {BROKEN[idx].why}
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          <Panel title="spec (edit to repair by hand)" right={<CopyButton text={text} />} bodyClassName="flex flex-col">
            <div className="min-h-0 flex-1 overflow-hidden">
              <JsonEditor
                value={text}
                onChange={(v) => {
                  setText(v);
                  setApplied(null);
                  setFixNotes([]);
                }}
              />
            </div>
            <div className="flex flex-wrap items-center gap-2 border-t bg-muted px-3 py-1.5">
              {showFix ? (
                <>
                  <button
                    type="button"
                    onClick={runAutoFix}
                    disabled={!parsed.ok}
                    className="rounded bg-brand px-2 py-0.5 font-mono text-[11px] text-brand-foreground disabled:opacity-40"
                  >
                    autoFixSpec
                  </button>
                  <label className="flex cursor-pointer items-center gap-1.5 font-mono text-[11px] text-muted-foreground">
                    <input
                      type="checkbox"
                      className="size-3 accent-orange-500"
                      checked={lossy}
                      onChange={(e) => setLossy(e.target.checked)}
                    />
                    lossy: {String(lossy)}
                  </label>
                </>
              ) : (
                <span className="font-mono text-[11px] text-muted-foreground opacity-45">
                  autoFixSpec &middot; not this step
                </span>
              )}
              <label className="flex cursor-pointer items-center gap-1.5 font-mono text-[11px] text-muted-foreground">
                <input
                  type="checkbox"
                  className="size-3 accent-orange-500"
                  checked={checkOrphans}
                  onChange={(e) => setCheckOrphans(e.target.checked)}
                />
                checkOrphans: {String(checkOrphans)}
              </label>
              {applied && (
                <button
                  type="button"
                  onClick={() => {
                    setText(JSON.stringify(applied, null, 2));
                    setApplied(null);
                  }}
                  className="rounded border px-2 py-0.5 font-mono text-[11px] text-muted-foreground hover:text-foreground"
                >
                  keep result
                </button>
              )}
            </div>
          </Panel>

          <div className="flex flex-col gap-3">
            <Panel
              title="validateSpec"
              right={
                <span
                  className={`font-mono text-[11px] ${
                    report?.valid ? 'text-emerald-600 dark:text-emerald-400' : 'text-yellow-600 dark:text-yellow-400'
                  }`}
                >
                  {report ? (report.valid ? 'valid' : `${report.issues.length} issue(s)`) : 'unparseable'}
                </span>
              }
            >
              <div className="max-h-[150px] overflow-auto p-2.5 font-mono text-[12px] leading-relaxed">
                {!parsed.ok ? (
                  <span className="text-red-600 dark:text-red-400">{parsed.error}</span>
                ) : report?.valid ? (
                  <span className="text-emerald-600 dark:text-emerald-400">No structural issues.</span>
                ) : (
                  <ul className="flex flex-col gap-1.5">
                    {(report?.issues ?? []).map((iss, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span
                          className={`shrink-0 rounded px-1 py-px text-[10px] font-bold uppercase ${
                            iss.severity === 'error'
                              ? 'bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400'
                              : 'bg-yellow-50 dark:bg-yellow-950 text-yellow-600 dark:text-yellow-400'
                          }`}
                        >
                          {iss.code}
                        </span>
                        <span className="text-muted-foreground">{iss.message}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </Panel>

            {!showFix ? (
              <Dim label="autoFixSpec — fixDetails" />
            ) : (
            <Panel title="autoFixSpec — fixDetails">
              <div className="max-h-[130px] overflow-auto p-2.5 text-[12.5px] leading-relaxed">
                {fixNotes.length === 0 ? (
                  <span className="text-muted-foreground">Run autoFixSpec to see what it would change.</span>
                ) : (
                  <ul className="flex flex-col gap-1">
                    {fixNotes.map((f, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span
                          className={`shrink-0 rounded px-1 py-px font-mono text-[10px] font-bold ${
                            f.lossy
                              ? 'bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400'
                              : 'bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400'
                          }`}
                        >
                          {f.lossy ? 'LOSSY' : 'safe'}
                        </span>
                        <span className="text-muted-foreground">{f.message}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </Panel>
            )}

            <Panel title={applied ? 'preview · after autoFix' : 'preview · as written'} bodyClassName="overflow-auto">
              <div className="p-3" style={{ minHeight: 270, maxHeight: 340 }}>
                {preview?.root ? (
                  <JSONUIProvider registry={demoRegistry} store={store}>
                    <Renderer spec={preview} registry={demoRegistry} fallback={UnknownComponent} />
                  </JSONUIProvider>
                ) : (
                  <span className="text-[12px] text-muted-foreground">Nothing renderable.</span>
                )}
              </div>
            </Panel>
          </div>
        </div>

        {!showGuard && !showFormat ? (
          <Dim label="repair loop inputs" />
        ) : (
        <Panel title="repair loop inputs" right={showFormat ? <CopyButton text={issueText} /> : undefined}>
          <div className="flex flex-col gap-2 p-2.5 font-mono text-[12px] leading-relaxed">
            {!showGuard ? (
              <span className="text-[11px] text-muted-foreground opacity-45">
                isNonEmptySpec(spec) &middot; not this step
              </span>
            ) : (
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`shrink-0 rounded px-1 py-px text-[10px] font-bold uppercase ${
                  guard
                    ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400'
                    : 'bg-yellow-50 dark:bg-yellow-950 text-yellow-600 dark:text-yellow-400'
                }`}
              >
                {String(guard)}
              </span>
              <span className="text-muted-foreground">isNonEmptySpec(spec)</span>
              {rootIsMissing && (
                <span className="text-yellow-600 dark:text-yellow-400">
                  …and yet root &ldquo;{String(parsed.ok ? parsed.value.root : '')}&rdquo; is not in elements. The
                  guard never checks that.
                </span>
              )}
              {!guard && <span className="text-muted-foreground">→ treat the next turn as a fresh generation</span>}
            </div>
            )}
            {!showFormat ? (
              <span className="border-t pt-2 text-[11px] text-muted-foreground opacity-45">
                formatSpecIssues(issues) &middot; not this step
              </span>
            ) : (
            <div className="border-t pt-2">
              <div className="mb-1 text-[11px] text-muted-foreground">formatSpecIssues(issues)</div>
              <pre className="max-h-[110px] overflow-auto whitespace-pre-wrap break-words text-[11.5px]">
                <code className={issueText ? 'text-muted-foreground' : 'text-yellow-600 dark:text-yellow-400'}>
                  {issueText ||
                    `"" — no ERRORS to report${
                      report && report.issues.length > 0 ? `, though ${report.issues.length} warning(s) remain` : ''
                    }. Sending this is re-prompting with nothing.`}
                </code>
              </pre>
            </div>
            )}
          </div>
        </Panel>
        )}

        {showFix && (
        <div className="rounded-lg border bg-surface px-3.5 py-2.5 text-[13.5px] leading-relaxed text-muted-foreground">
          <strong className="text-foreground">Notice the split.</strong> Relocating a misplaced <code>visible</code> out of{' '}
          <code>props</code> is marked <span className="font-mono text-[12px] text-emerald-600 dark:text-emerald-400">safe</span> —
          nothing is lost. Pruning a dangling child is marked{' '}
          <span className="font-mono text-[12px] text-red-600 dark:text-red-400">LOSSY</span> and only happens with{' '}
          <code>lossy: true</code>, because it makes a broken spec <em>look</em> valid while quietly deleting a
          section the user asked for. In a retry loop: apply safe fixes immediately, re-prompt instead of pruning, and
          only pass <code>lossy: true</code> on the last attempt.
        </div>
        )}
      </div>
    );
  };

  return (
    <StageFrame slug="repair" stages={stages}>
      {(stage) => stagedBody(stage.focus)}
    </StageFrame>
  );
}
