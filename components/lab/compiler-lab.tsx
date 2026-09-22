'use client';

import type { Spec } from '@json-render/core';
import { createStateStore } from '@json-render/core';
import { JSONUIProvider, Renderer } from '@json-render/react';
import { useMemo, useState, useSyncExternalStore } from 'react';
import { demoRegistry, UnknownComponent } from '@/lib/demo/registry';
import { JsonEditor } from '../playground/json-editor';
import { Panel } from '../playground/ui';
import type { ChecklistItem } from './checklist';
import { StageFrame } from './stage-frame';
import { type Stage, stagesFromChecklist } from '@/lib/labs/types';
import { useInitialStage } from '@/lib/labs/use-initial-stage';

/**
 * The fixed-spec pattern, live.
 *
 * Edit the FIELD DEFINITIONS on the left — your domain model, the thing your
 * business owns — and watch the spec recompile. No model, no network, no
 * randomness. This is what most production json-render code actually is.
 */

/** The two halves of the middle panel's toggle. */
type View = 'spec' | 'answers';

interface FieldDef {
  id: string;
  kind: 'text' | 'number' | 'choice' | 'boolean' | 'date';
  label: string;
  required: boolean;
  options?: string[];
  section: string;
}

const DEFAULT_FIELDS: FieldDef[] = [
  { id: 'legalName', kind: 'text', label: 'Legal name', required: true, section: 'Identity' },
  { id: 'email', kind: 'text', label: 'Billing email', required: true, section: 'Identity' },
  { id: 'country', kind: 'choice', label: 'Country', required: true, options: ['Finland', 'Sweden', 'Norway'], section: 'Tax' },
  { id: 'vat', kind: 'text', label: 'VAT number', required: false, section: 'Tax' },
  { id: 'reverseCharge', kind: 'boolean', label: 'Reverse charge applies', required: false, section: 'Tax' },
];

/** Exhaustive by type: add a kind and TypeScript fails here until you map it. */
const CONTROL_FOR: Record<FieldDef['kind'], string> = {
  text: 'TextInput',
  number: 'TextInput',
  choice: 'Select',
  boolean: 'Checkbox',
  date: 'TextInput',
};

/**
 * THE COMPILER. A pure function: FieldDef[] -> Spec.
 * Snapshot-testable, reviewable, and incapable of inventing a binding.
 */
function buildSpec(fields: FieldDef[], title: string): Spec {
  const elements: Spec['elements'] = {};
  const sections = [...new Set(fields.map((f) => f.section))];

  elements.form = {
    type: 'Screen',
    props: { title, subtitle: `${fields.length} fields · ${sections.length} sections` },
    children: sections.map((s) => `section:${s}`),
  };

  for (const section of sections) {
    const inSection = fields.filter((f) => f.section === section);
    elements[`section:${section}`] = {
      type: 'Card',
      props: { title: section, subtitle: null },
      children: inSection.map((f) => `field:${f.id}`),
    };

    for (const f of inSection) {
      const type = CONTROL_FOR[f.kind];
      // The binding is DERIVED from the field id. A model never gets to pick
      // a state path, so a spec cannot write into a record that does not exist.
      const binding = { $bindState: `/answers/${f.id}` };

      elements[`field:${f.id}`] = {
        type,
        props:
          type === 'Select'
            ? {
                label: f.label,
                value: binding,
                options: (f.options ?? []).map((o) => ({ label: o, value: o.toLowerCase() })),
              }
            : type === 'Checkbox'
              ? { label: f.label, checked: binding }
              : {
                  label: f.label,
                  value: binding,
                  placeholder: null,
                  help: null,
                  required: f.required,
                  checks: f.required ? [{ type: 'required', args: null, message: `${f.label} is required` }] : null,
                },
        children: [],
      };
    }
  }

  return { root: 'form', elements };
}

/**
 * The field lists behind the checklist's "do it for me" buttons. Each one is
 * the previous list plus exactly the row the task asks for, so pressing them
 * in order builds the form the checklist describes.
 */
const WITH_PHONE: FieldDef[] = [
  ...DEFAULT_FIELDS,
  { id: 'phone', kind: 'text', label: 'Phone', required: false, section: 'Identity' },
];

const WITH_SECTION: FieldDef[] = [
  ...WITH_PHONE,
  { id: 'startDate', kind: 'date', label: 'Engagement starts', required: false, section: 'Engagement' },
];

const WITH_NUMBER: FieldDef[] = [
  ...WITH_SECTION,
  { id: 'headcount', kind: 'number', label: 'Headcount', required: false, section: 'Engagement' },
];

const WITH_REQUIRED: FieldDef[] = WITH_NUMBER.map((f) =>
  f.id === 'vat' ? { ...f, required: true } : f,
);

/**
 * The lesson half of each stage; `items` supplies the assignment half.
 *
 * The three panels are NOT scoped per stage, and deliberately so: the lesson
 * here is the pipeline itself — edit the field list, read the compiled spec,
 * look at the form — and a stage that hid either end would be teaching half a
 * compiler. The one thing a stage does scope is the middle panel's toggle,
 * through `focus`: four of the five stages read the compiled spec, so arriving
 * at one puts the spec back on screen rather than leaving the answers pane the
 * last stage opened.
 */
const PATTERN_STAGES: Array<{
  id: string;
  focus?: View;
  title: string;
  concept?: string;
  ref?: string;
  also?: string[];
  when?: string;
  summary?: string;
}> = [
  {
    id: 'add-field',
    focus: 'spec',
    title: 'One row in, one control out',
    when:
      'Compile rather than generate whenever the set of screens is knowable — forms over a schema you own, settings, dashboards. Keep a model for the shape that genuinely cannot be known in advance; a compiled spec costs no tokens, comes out the same every time and can be snapshot-tested, which is most of the value of json-render with none of the risk.',
    concept: 'fixed-spec-compiler',
  },
  {
    id: 'section',
    focus: 'spec',
    title: 'A section becomes a Card',
    when:
      'Let the compiler build the containers when the grouping is already in the data — sections in a schema, fieldsets in a config. Hand-write the layout when there is exactly one of it and it will never move: a compiler that invents structure its input does not carry is a more expensive way to write the JSX you were avoiding.',
    ref: 'el-children',
    summary:
      'Grouping is data too. The compiler turns each section into a Card with its own children, so the shape of the form follows the shape of the field list and nothing about the layout is hand-written.',
  },
  {
    id: 'kind',
    focus: 'spec',
    title: 'The exhaustive control map',
    when:
      'Use a record over a union, rather than a switch with a default, whenever adding a case must not be allowed to do nothing quietly. The fallback branch is the alternative and it is the worse one here: an unhandled kind shows up as your fallback component or a blank space, at runtime, in front of a user, instead of as a failed build.',
    ref: 'el-type',
    summary:
      '`CONTROL_FOR` maps every field kind to a component name. Because it is exhaustive over a union, adding a kind without adding a control is a type error rather than a blank space at runtime.',
  },
  {
    id: 'required',
    focus: 'spec',
    title: 'required becomes a check',
    when:
      'Derive every binding and every check from the field id as soon as the spec can touch a real record. Letting a model choose the paths is the alternative, and it is one hallucinated pointer away from writing into the wrong filing — which is why this is the line between the safe ways to ship and the risky ones rather than a matter of taste.',
    concept: 'derived-bindings',
  },
  {
    // No `focus`: this stage is the only one that needs BOTH halves of the
    // toggle — the derived keys in the spec, then the answers pane proving a
    // write can land nowhere but under /answers. It opens on whatever the
    // previous stage left, which is always the spec its first step asks for.
    id: 'derived',
    title: 'Every key is derived',
    when:
      'Derive keys whenever the same UI is rebuilt from changing data, because `field:email` survives an edit and a patch while a positional `el-3` does not. Hand-written keys are fine in a fixture you will never regenerate; anywhere else they are the reason a refinement lands on the wrong element.',
    ref: 'el-elements',
    summary:
      'No element key in this spec was typed by a person: they all read `field:…` or `section:…`, built from the model. That is what makes the whole UI a pure function of the data — and what makes it testable without a browser.',
    also: ['four-risk-levels'],
  },
];

export function CompilerLab() {
  const initial = useInitialStage(PATTERN_STAGES.length);
  const [fieldsText, setFieldsText] = useState(() => JSON.stringify(DEFAULT_FIELDS, null, 2));
  const [title, setTitle] = useState('Client onboarding');
  // Seeded from the stage the lab OPENS on: a deep link (`?stage=4`) is
  // server-rendered, so a view chosen only in onStageChange would paint the
  // wrong half of the toggle until hydration.
  const [view, setView] = useState<View>(() => PATTERN_STAGES[initial].focus ?? 'spec');

  const parsed = useMemo(() => {
    try {
      return { ok: true as const, value: JSON.parse(fieldsText) as FieldDef[] };
    } catch (e) {
      return { ok: false as const, error: (e as Error).message };
    }
  }, [fieldsText]);

  const spec = useMemo(() => (parsed.ok ? buildSpec(parsed.value, title) : null), [parsed, title]);

  // A new store whenever the shape changes, seeded with empty answers.
  const store = useMemo(() => {
    const answers: Record<string, unknown> = {};
    if (parsed.ok) for (const f of parsed.value) answers[f.id] = f.kind === 'boolean' ? false : '';
    return createStateStore({ answers });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fieldsText]);

  // Subscribed, not sampled: the last stage asks the learner to type into the
  // rendered form and watch /answers fill. A bare getSnapshot() only re-reads
  // when something else re-renders this component, so those writes landed in
  // the store and never reached the pane claiming to show them.
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);

  const fields = parsed.ok ? parsed.value : [];
  const sections = new Set(fields.map((f) => f.section));
  const requiredCount = fields.filter((f) => f.required).length;
  const specKeys = Object.keys(spec?.elements ?? {});

  const items: ChecklistItem[] = [
    {
      label: 'Add a field. One row in, one control out — no model involved.',
      done: fields.length > DEFAULT_FIELDS.length,
      steps: [
        <>
          Click into <strong>your domain model · FieldDef[]</strong> on the left and put the cursor after
          the last <code>{'}'}</code> in the array.
        </>,
        <>
          Add a row:{' '}
          <code>
            {'{ "id": "phone", "kind": "text", "label": "Phone", "required": false, "section": "Identity" }'}
          </code>
          .
        </>,
        <>
          The header of that panel counts up to <strong>6 fields</strong> as soon as the JSON parses.
        </>,
        <>
          Look at <strong>rendered form</strong>: a Phone input is now inside the Identity card, and the
          Screen subtitle counts it. You wrote no JSX and no spec.
        </>,
      ],
      apply: {
        label: 'add the row for me',
        run: () => setFieldsText(JSON.stringify(WITH_PHONE, null, 2)),
      },
    },
    {
      label: <>Give it a new <code>section</code> and watch a whole Card appear.</>,
      done: sections.size > 2,
      steps: [
        <>
          Add another row, this time with a <code>section</code> no other field uses — e.g.{' '}
          <code>"section": "Engagement"</code>.
        </>,
        <>
          In <strong>rendered form</strong>, a third Card appears with that name as its title.
        </>,
        <>
          In the middle panel — <strong>compiled spec</strong>, open on this stage — find the new{' '}
          <code>section:Engagement</code> key, plus its reference in <code>form.children</code>.
        </>,
        <>
          Nothing in <code>buildSpec</code> knows the word &ldquo;Engagement&rdquo; — the section list is{' '}
          <code>[...new Set(fields.map(f =&gt; f.section))]</code>.
        </>,
      ],
      apply: {
        label: 'add a new section for me',
        run: () => setFieldsText(JSON.stringify(WITH_SECTION, null, 2)),
      },
    },
    {
      label: <>Use a third <code>kind</code> — the exhaustive <code>CONTROL_FOR</code> map picks the control.</>,
      // DEFAULT_FIELDS already covers text/choice/boolean, so counting
      // kinds ticked on load. Require a kind the default list does not use.
      done: fields.some((f) => f.kind === 'number' || f.kind === 'date'),
      steps: [
        <>
          The starting list already spans three kinds — <code>text</code>, <code>choice</code> and{' '}
          <code>boolean</code>. Find each in <strong>rendered form</strong>: an input, a dropdown, a
          checkbox.
        </>,
        <>
          Change one row&rsquo;s <code>kind</code> to <code>number</code> or <code>date</code>.
        </>,
        <>
          In <strong>compiled spec</strong>, that field&rsquo;s <code>type</code> is whatever{' '}
          <code>CONTROL_FOR</code> maps the kind to — both land on <code>TextInput</code>.
        </>,
        <>
          Watch the Screen subtitle in <strong>rendered form</strong> recount{' '}
          <code>N fields · M sections</code> as you type: the spec is rebuilt from the rows every time, not
          patched.
        </>,
      ],
      apply: {
        label: 'add a number field for me',
        run: () => setFieldsText(JSON.stringify(WITH_NUMBER, null, 2)),
      },
    },
    {
      label: <>Flip a <code>required</code> and find the compiled <code>required</code> check in the spec.</>,
      done: requiredCount !== DEFAULT_FIELDS.filter((f) => f.required).length,
      steps: [
        <>
          Find the <code>vat</code> row in the left panel and change{' '}
          <code>"required": false</code> to <code>"required": true</code>.
        </>,
        <>
          In the middle panel — <strong>compiled spec</strong> — find <code>field:vat</code>.
        </>,
        <>
          Read its <code>props.checks</code>:{' '}
          <code>{'[{ "type": "required", "args": null, "message": "VAT number is required" }]'}</code> —
          composed from the label, not written by anyone.
        </>,
        <>
          In <strong>rendered form</strong>, the VAT field now carries the required marker.
        </>,
      ],
      apply: {
        label: 'make VAT required',
        run: () => setFieldsText(JSON.stringify(WITH_REQUIRED, null, 2)),
      },
    },
    {
      label: <>Confirm every key is derived, never authored: they all read <code>field:</code> or <code>section:</code>.</>,
      // Every compiled key is derived by construction, so this was always
      // true. Require a key derived from a field the learner added.
      done:
        specKeys.some(
          (k) => k.startsWith('field:') && !DEFAULT_FIELDS.some((f) => `field:${f.id}` === k),
        ) && specKeys.every((k) => k === 'form' || k.startsWith('field:') || k.startsWith('section:')),
      hint: 'That is the property that makes this safe to point at a real record.',
      steps: [
        <>
          Read the middle panel, <strong>compiled spec</strong>.
        </>,
        <>
          Read every key under <code>elements</code>: <code>form</code>, then only{' '}
          <code>section:…</code> and <code>field:…</code>.
        </>,
        <>
          Find any <code>$bindState</code> in the spec — each is{' '}
          <code>/answers/&lt;the field id&gt;</code>, built in <code>buildSpec</code>.
        </>,
        <>
          Switch to <strong>answers</strong> and type in the form: writes can only ever land under{' '}
          <code>/answers</code>. Nothing here can invent a path into a record you did not open.
        </>,
      ],
    },
  ];

  const stages = stagesFromChecklist(items, PATTERN_STAGES);

  const stagedBody = (
    <div className="flex h-full min-h-0 flex-col gap-3">

      <div className="flex items-center gap-2 rounded-lg border bg-surface px-3 py-2">
        <label className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">form title</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="flex-1 rounded border bg-background px-2 py-0.5 text-[13px] text-foreground outline-none focus:border-orange-500"
        />
        <button
          type="button"
          onClick={() => {
            setFieldsText(JSON.stringify(DEFAULT_FIELDS, null, 2));
            setTitle('Client onboarding');
          }}
          className="rounded border px-2 py-0.5 font-mono text-[11px] text-muted-foreground hover:text-foreground"
        >
          reset
        </button>
      </div>

      <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-3">
        <Panel
          title="your domain model · FieldDef[]"
          bodyClassName="flex flex-col overflow-hidden"
          right={
            <span className={`font-mono text-[11px] ${parsed.ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
              {parsed.ok ? `${parsed.value.length} fields` : 'invalid'}
            </span>
          }
        >
          <div className="min-h-0 flex-1 overflow-hidden">
            <JsonEditor value={fieldsText} onChange={setFieldsText} />
          </div>
        </Panel>

        <Panel
          title={
            <div className="flex gap-0.5">
              {(['spec', 'answers'] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setView(v)}
                  className={`rounded px-2 py-0.5 font-mono text-[11px] uppercase tracking-wider transition ${
                    view === v ? 'bg-surface-hover text-foreground' : 'text-muted-foreground hover:text-muted-foreground'
                  }`}
                >
                  {v === 'spec' ? 'compiled spec' : 'answers'}
                </button>
              ))}
            </div>
          }
        >
          <pre className="h-full overflow-auto p-3 font-mono text-[11.5px] leading-[1.5] text-muted-foreground">
            <code>
              {view === 'spec'
                ? JSON.stringify(spec, null, 2)
                : JSON.stringify(snapshot, null, 2)}
            </code>
          </pre>
        </Panel>

        <Panel title="rendered form" bodyClassName="overflow-auto">
          <div className="p-3" style={{ height: 540 }}>
            {spec ? (
              <JSONUIProvider registry={demoRegistry} store={store}>
                <Renderer spec={spec} registry={demoRegistry} fallback={UnknownComponent} />
              </JSONUIProvider>
            ) : (
              <span className="text-[12px] text-red-600 dark:text-red-400">{!parsed.ok && parsed.error}</span>
            )}
          </div>
        </Panel>
      </div>

    </div>
  );

  return (
    <StageFrame
      slug="patterns"
      stages={stages}
      // Only the toggle follows the stage; the three panels are the instrument
      // and every stage needs all of them. A stage with no `focus` keeps what
      // is on screen — see `derived`, which reads both halves.
      onStageChange={(stage: Stage) => {
        if (stage.focus) setView(stage.focus as View);
      }}
    >
      {() => stagedBody}
    </StageFrame>
  );
}
