'use client';

import type { Spec } from '@json-render/core';
import { defineCatalog, validateSpec } from '@json-render/core';
import { JSONUIProvider, Renderer } from '@json-render/react';
import { schema } from '@json-render/react/schema';
import { useMemo, useRef, useState } from 'react';
import {
  autoExample,
  catalogEntrySource,
  contractSource,
  descriptorErrors,
  enumValues,
  propsSchema,
  PROP_KINDS,
  resolveExample,
  slotList,
  tsPropType,
  type ComponentDescriptor,
  type PropDescriptor,
  type PropKind,
} from '@/lib/build/descriptor';
import { componentLine, mentions, slotGuidance } from '@/lib/build/prompt-slice';
import { demoActions, demoCatalog, demoComponents } from '@/lib/demo/catalog';
import { demoRegistry, UnknownComponent } from '@/lib/demo/registry';
import { CodeBlock } from '../playground/code-block';
import { ChromeButton, CopyButton, Panel, Pill, Tabs } from '../playground/ui';
import type { ChecklistItem } from './checklist';
import { StageFrame } from './stage-frame';
import { stagesFromChecklist, type Stage, type StageMeta } from '@/lib/labs/types';
import { useInitialStage } from '@/lib/labs/use-initial-stage';

/**
 * Declare a component, and watch the three things that declaration causes.
 *
 * A catalog entry is not a form of documentation. It is simultaneously the
 * prompt the model reads, the TypeScript your registry has to satisfy, and the
 * name the validator will accept. Editing one field here moves all three at
 * once, which is the only way the claim lands.
 */

const INITIAL_DESCRIPTION = 'A highlighted note. Use it to draw attention to one sentence.';

const INITIAL: ComponentDescriptor = {
  name: 'Callout',
  description: INITIAL_DESCRIPTION,
  props: [
    { id: 'p1', name: 'title', kind: 'string', values: '', nullable: false },
    { id: 'p2', name: 'body', kind: 'string', values: '', nullable: true },
  ],
  defaultSlot: false,
  namedSlots: [],
  exampleText: '',
};

const TAKEN = Object.keys(demoComponents);

/**
 * What the FIRST argument to `defineCatalog` contributes, before any entry.
 *
 * `schema` is one `defineSchema` call that `@json-render/react` exports, and
 * its `defaultRules` and `builtInActions` reach the model through every prompt
 * built on it — with or without a catalog. That is the floor under the
 * character count the prompt tab reports.
 */
const SCHEMA_ONLY_PROMPT = defineCatalog(schema, {
  components: {} as never,
  actions: {} as never,
}).prompt();
const DEFAULT_RULES = schema.defaultRules ?? [];
const BUILT_IN_ACTIONS = schema.builtInActions ?? [];

let seq = 2;
const nextId = () => `p${++seq}`;

/**
 * The lesson half of each stage; `items` supplies the assignment half.
 *
 * `focus` is the pane the stage's feature is visible in. Typed explicitly so
 * the lab can read `focus` off the stage it OPENS on — the last entry has none
 * on purpose and an inferred union would not admit the key at all.
 */
const BUILD_CATALOG_STAGES: Array<Omit<StageMeta, 'spec' | 'seed'> & { id: string }> = [
  {
    id: 'props',
    title: 'An entry needs props',
    concept: 'catalog-entry',
    when:
      'Add an ENTRY when the model has to be able to name this thing on its own; add a PROP to an entry you already have when it is the same component wearing a different face. A `tone` prop beats a DangerCallout beside the Callout, because every entry and every prop is re-serialised into the prompt on every request — split into two names only when the two would share almost no props and no description.',
    ref: 'util-definecatalog',
    focus: 'prompt',
  },
  {
    id: 'enum',
    title: 'An enum becomes a union',
    concept: 'zod-props',
    when:
      'Whenever your component branches on the value. The union is the only place a model can learn that `info` and `danger` exist, so a bare `z.string()` there gets you `warning-red` and a silent fall-through; keep the string only for genuinely open text. It is guidance, not enforcement — nothing re-checks props at render time, so give the switch a default branch anyway.',
    focus: 'prompt',
  },
  {
    id: 'nullable',
    title: 'nullable versus optional',
    concept: 'nullable-vs-optional',
    when:
      'Default to `.nullable()` for every prop that is not always there: structured output emits an explicit null far more reliably than it drops a key, and null survives a JSON round trip where undefined does not. Reserve `.optional()` for the rare prop where a missing key must mean something different from null, and then be consistent — both print as `name?:`, so a catalog that mixes them leaves nobody able to tell which you meant.',
    focus: 'prompt',
  },
  {
    id: 'slots',
    title: 'Declaring a named slot',
    concept: 'slots-declaration',
    when:
      'Declare a slot when what goes in is other ELEMENTS the model composes — an actions row, a footer — and use a prop when it is a value your component renders itself; `title: string` beats a title slot every time. Prefer the default slot (children) and reach for a NAMED one only when your component must place that group somewhere of its own, because a declared slot your implementation never renders is content that vanishes with no warning.',
    focus: 'prompt',
  },
  {
    id: 'description',
    title: 'The description is the prompt',
    concept: 'description-is-docs',
    when:
      'Rewrite it the moment two entries could plausibly answer the same request — it is the only tie-breaker the model has, since it never sees your React and the name alone is rarely enough. Spend the words on when to pick this component over the neighbouring one, not on what it looks like: “a bordered surface” tells a model nothing that `Card` did not.',
    focus: 'prompt',
  },
  {
    id: 'schema',
    title: 'The prompt you did not write',
    when:
      'Effectively never write one — `@json-render/react` exports the schema you want, and your own means redescribing what a spec is. Read this stage instead when the prompt is far bigger than your entries explain, or the model emits a `setState` no catalog declares: that comes from `defaultRules` and `builtInActions` on the schema, and the lever you actually have is `customRules` on `catalog.prompt()`.',
    ref: 'util-defineschema',
    focus: 'prompt',
    summary:
      '`defineCatalog(schema, …)` reads its first argument. `schema` is a `defineSchema` call — it decides what a spec may look like, and it carries `defaultRules` and `builtInActions` that land in every prompt built on it. You almost never write one; `@json-render/react` exports the one you are using.',
  },
  {
    id: 'contract',
    title: 'One entry, one required key',
    concept: 'define-registry',
    when:
      'Read this before adding an entry, not after: because `components` is typed from the catalog, a new name is a commitment to write and keep an implementation, and renaming one quietly orphans the function that satisfied it. When that compile error appears, let it — casting it away or widening the map is exactly how a catalog ends up advertising components that render the fallback.',
    focus: 'contract',
  },
  {
    id: 'runtime',
    title: 'Valid, and still the fallback',
    when:
      'Run `catalog.validate` over anything a model produced, before you render it — but never read a pass as “this will draw”. It parses props with Zod and knows nothing of your registry, so pair it with `validateSpec` for structure, lean on `defineRegistry` at compile time for the names, and treat the fallback box on screen as the only report you get for a name that is legal but unimplemented.',
    ref: 'util-catalogvalidate',
    summary:
      '`catalog.validate` checks far less than its name suggests. Against a multi-component catalog it validates the element TYPE against the declared names and lets the props through: a value outside an enum, a prop of the wrong type and a missing required prop all pass. And it has no idea whether the registry implements the name, so an entry can pass validation and still render the fallback.',
    also: ['example-in-prompt'],
  },
];

export function BuildCatalogLab() {
  const [d, setD] = useState<ComponentDescriptor>(INITIAL);
  /* Seed the pane from the stage the page OPENS on, not from the lab's
   * default: `onStageChange` fires in an effect, so a deep link to `?stage=7`
   * server-rendered the prompt pane under a lesson that says the contract one
   * is already up. The last stage has no `focus`, and opening the pane it is
   * about is its assignment, so it falls back to the lab's home pane. */
  const initialStage = useInitialStage(BUILD_CATALOG_STAGES.length);
  const [tab, setTab] = useState(BUILD_CATALOG_STAGES[initialStage]?.focus ?? 'prompt');
  const [nullableToggles, setNullableToggles] = useState(0);
  const sawRuntime = useRef(false);
  if (tab === 'runtime') sawRuntime.current = true;
  /** Which half of the schema's contribution is open, and which have been opened. */
  const [schemaView, setSchemaView] = useState<'rules' | 'actions' | null>(null);
  const [schemaSeen, setSchemaSeen] = useState<Array<'rules' | 'actions'>>([]);
  const openSchema = (view: 'rules' | 'actions') => {
    setSchemaView(view);
    setSchemaSeen((prev) => (prev.includes(view) ? prev : [...prev, view]));
  };

  const patch = (next: Partial<ComponentDescriptor>) => setD((prev) => ({ ...prev, ...next }));
  const patchProp = (id: string, next: Partial<PropDescriptor>) =>
    setD((prev) => ({ ...prev, props: prev.props.map((p) => (p.id === id ? { ...p, ...next } : p)) }));

  const errors = descriptorErrors(d, TAKEN);
  const blocking = errors.filter((e) => !e.startsWith('Description') && !e.startsWith('Enum prop'));
  const dKey = JSON.stringify(d);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const example = useMemo(() => resolveExample(d), [dKey]);

  /** The real thing: one defineCatalog call, rebuilt on every keystroke. */
  const built = useMemo(() => {
    if (blocking.length > 0) return { ok: false as const, error: blocking[0] };
    try {
      const entry = {
        description: d.description,
        props: propsSchema(d),
        slots: slotList(d),
        example: example.value,
      };
      const catalog = defineCatalog(schema, {
        components: { ...demoComponents, [d.name.trim()]: entry } as never,
        actions: demoActions as never,
      });
      // A one-entry catalog too — jsonSchema() only keeps per-component prop
      // shapes when there is exactly one component. See the runtime pane.
      const solo = defineCatalog(schema, {
        components: { [d.name.trim()]: entry } as never,
        actions: {} as never,
      });
      return { ok: true as const, catalog, solo };
    } catch (e) {
      return { ok: false as const, error: (e as Error).message };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dKey, blocking.length]);

  const basePrompt = useMemo(() => demoCatalog.prompt(), []);
  const prompt = built.ok ? built.catalog.prompt() : '';
  const line = built.ok ? componentLine(prompt, d.name.trim()) : null;
  const guidance = slotGuidance(line);
  const delta = built.ok ? prompt.length - basePrompt.length : 0;

  const runtimeSpec = useMemo<Spec>(
    () => ({
      root: 'screen',
      elements: {
        screen: {
          type: 'Screen',
          props: { title: 'Runtime', subtitle: 'demoRegistry has no entry for the new name' },
          children: ['note', 'subject'],
        },
        note: {
          type: 'Text',
          props: { value: 'Everything the registry knows still renders.', tone: null, size: 'sm' },
          children: [],
        },
        subject: {
          type: d.name.trim() || 'Callout',
          props: (example.value ?? {}) as Record<string, unknown>,
          children: [],
        },
      },
    }),
    [d.name, example.value],
  );

  const catalogCheck = built.ok ? built.catalog.validate(runtimeSpec) : null;
  const specCheck = useMemo(() => validateSpec(runtimeSpec), [runtimeSpec]);

  const namedProps = d.props.filter((p) => p.name.trim());

  /* The checklist's "do it for me" buttons, each one editing the descriptor
   * exactly the way the form above would. */
  const addProp = (next: Omit<PropDescriptor, 'id'>) =>
    setD((prev) => ({ ...prev, props: [...prev.props, { ...next, id: nextId() }] }));
  const toggleFirstNullable = () =>
    setD((prev) => {
      const first = prev.props[0];
      if (!first) return prev;
      setNullableToggles((n) => n + 1);
      return {
        ...prev,
        props: prev.props.map((p) => (p.id === first.id ? { ...p, nullable: !p.nullable } : p)),
      };
    });

  const items: ChecklistItem[] = [
    {
      label: (
        <>
          Add a prop of your own. The entry already declares <code>title</code> and <code>body</code>, so
          this is about naming and typing a third — the model never sees your React.
        </>
      ),
      // INITIAL already declares title and body: require one of their own.
      done: namedProps.length >= 3,
      hint: 'Names and types only — the model never sees your React.',
      steps: [
        <>
          Look at <strong>the entry</strong> on the left: <code>title</code> and <code>body</code> are
          already declared.
        </>,
        <>
          Press <strong>+ prop</strong> and type a name into the new row&rsquo;s{' '}
          <code>propName</code> field — say <code>footnote</code>.
        </>,
        <>
          Watch the grey type preview on the right of that row change from <code>—</code> to{' '}
          <code>footnote: string | null</code>.
        </>,
        <>
          On the <strong>prompt</strong> tab, find the new name inside{' '}
          <strong>your component&rsquo;s line, inside AVAILABLE COMPONENTS</strong>, and watch{' '}
          <strong>this entry costs</strong> go up. Every prop you declare is paid for on every request.
        </>,
      ],
      apply: {
        label: 'add a third prop',
        run: () => addProp({ name: 'footnote', kind: 'string', values: '', nullable: true }),
      },
    },
    {
      label: (
        <>
          Add an <strong>enum</strong> prop with two or more members, then find the union in the prompt line.
        </>
      ),
      done:
        namedProps.some((p) => p.kind === 'enum' && enumValues(p).length >= 2) &&
        Boolean(line?.includes(' | ')),
      hint: 'z.enum() serialises into the prompt verbatim. That is how a model learns your vocabulary.',
      steps: [
        <>
          Press <strong>+ prop</strong> and name it <code>tone</code>.
        </>,
        <>
          Change that row&rsquo;s type dropdown from <code>string</code> to <code>enum</code>.
        </>,
        <>
          A second field appears beside <strong>nullable</strong>. Type{' '}
          <code>info, success, danger</code> into it.
        </>,
        <>
          On the <strong>prompt</strong> tab, read your component&rsquo;s line: it now carries{' '}
          <code>tone?: &quot;info&quot; | &quot;success&quot; | &quot;danger&quot;</code>. That union is
          the entire vocabulary the model has for this prop.
        </>,
      ],
      apply: {
        label: 'add a tone enum',
        run: () => addProp({ name: 'tone', kind: 'enum', values: 'info, success, danger', nullable: true }),
      },
    },
    {
      label: (
        <>
          Toggle a prop&rsquo;s <code>nullable</code> off and on. Watch <code>name:</code> become{' '}
          <code>name?:</code> and back.
        </>
      ),
      done: nullableToggles >= 2,
      hint: 'Both .nullable() and .optional() print as `?`. The prompt cannot tell you which one you wrote.',
      steps: [
        <>
          Open the <strong>prompt</strong> tab so you can watch the line while you click.
        </>,
        <>
          In <strong>the entry</strong>, untick <strong>nullable</strong> on the <code>body</code> row.
        </>,
        <>
          The line changes from <code>body?: string</code> to <code>body: string</code> — no question
          mark, and the model must now emit the key.
        </>,
        <>
          Tick it back on and watch <code>?</code> return. Both <code>.nullable()</code> and{' '}
          <code>.optional()</code> print that same mark, so the prompt cannot tell you which you wrote.
        </>,
      ],
      apply: { label: 'toggle one for me', run: toggleFirstNullable },
    },
    {
      label: (
        <>
          Add a <strong>named slot</strong> and find the slot guidance at the end of the line.
        </>
      ),
      done: d.namedSlots.length >= 1 && Boolean(guidance?.includes('slots:')),
      hint: 'Named slots show as [slots: …]; the default slot shows as [accepts children].',
      steps: [
        <>
          Scroll to the <strong>slots</strong> block at the bottom of <strong>the entry</strong>.
        </>,
        <>
          Type <code>actions, footer</code> into the{' '}
          <em>named slots: actions, footer</em> field.
        </>,
        <>
          On the <strong>prompt</strong> tab, the green pill beside <strong>slot guidance:</strong> now
          reads <code>[slots: actions, footer]</code> instead of <em>none — no slots declared</em>.
        </>,
        <>
          Tick <strong>default — accepts children</strong> as well: the pill becomes{' '}
          <code>[accepts children; slots: actions, footer]</code>. Those few words are all the model gets
          to learn the difference between children and a named slot.
        </>,
      ],
      apply: { label: 'declare an actions slot', run: () => patch({ namedSlots: ['actions'] }) },
    },
    {
      label: (
        <>
          Rewrite the <code>description</code> — it is the only reason a model picks this component over
          another.
        </>
      ),
      done: d.description.trim() !== INITIAL_DESCRIPTION && d.description.trim().length >= 12,
      steps: [
        <>
          Select everything in the <strong>description · goes into the prompt verbatim</strong> box.
        </>,
        <>
          Write the sentence you would give a new colleague — when to reach for this component{' '}
          <em>instead of</em> a Card or an Alert.
        </>,
        <>
          On the <strong>prompt</strong> tab, watch your sentence appear in the component&rsquo;s line
          word for word.
        </>,
        <>
          Check <strong>this entry costs</strong> as you write: a description is the cheapest thing in the
          prompt and the only thing that decides whether the model picks this component at all.
        </>,
      ],
      apply: {
        label: 'rewrite it for me',
        run: () =>
          patch({
            description:
              'A highlighted note with a tone and its own actions row. Use it for something the reader must act on; use Card for ordinary grouping and Alert for system errors.',
          }),
      },
    },
    {
      label: (
        <>
          Most of this prompt is not yours. Open both halves of what <code>schema</code> put there —{' '}
          <code>defaultRules</code> and <code>builtInActions</code>.
        </>
      ),
      done: schemaSeen.includes('rules') && schemaSeen.includes('actions'),
      hint: 'The first argument to defineCatalog is a defineSchema call, and its rules and built-in actions are in every prompt built on it.',
      steps: [
        <>
          Read <strong>prompt chars</strong>, then the orange box under the mentions: a catalog with{' '}
          <em>no components at all</em> already prints{' '}
          {SCHEMA_ONLY_PROMPT.length.toLocaleString()} characters.
        </>,
        <>
          Press <strong>defaultRules ({DEFAULT_RULES.length})</strong>. Those are the rules the schema
          injects before any <code>customRules</code> you pass — you wrote none of them.
        </>,
        <>
          Press <strong>builtInActions ({BUILT_IN_ACTIONS.length})</strong>. The model is told about{' '}
          <code>setState</code>, <code>pushState</code>, <code>removeState</code> and{' '}
          <code>validateForm</code> although no catalog declares them and no registry implements them.
        </>,
        <>
          Compare that list with <code>catalog.actionNames</code> printed beneath it: not one of them is
          there, because they belong to the schema and not to your catalog.
        </>,
      ],
      apply: {
        label: 'open both',
        run: () => {
          openSchema('rules');
          openSchema('actions');
        },
      },
    },
    {
      label: (
        <>
          Rename the entry and watch the <strong>contract</strong> rename with it —{' '}
          <code>defineRegistry</code> wants one key per catalog entry.
        </>
      ),
      done: built.ok && d.name.trim() !== INITIAL.name,
      hint: 'components is typed Components<typeof catalog> — every entry is a required key, enforced by TypeScript at build time and by nothing at runtime.',
      steps: [
        <>
          The right-hand panel is already on the <strong>contract</strong> tab — this is the TypeScript
          your registry file owes, derived from the entry on the left.
        </>,
        <>
          Change <strong>name</strong> at the top of <strong>the entry</strong> from{' '}
          <code>Callout</code> to <code>Notice</code>.
        </>,
        <>
          Every mention in the contract renames at once, down to the last line:{' '}
          <code>components: {'{'} ...rest, Notice {'}'}</code>. Your old <code>Callout</code> function now
          satisfies nothing — renaming an entry is renaming a required key.
        </>,
        <>
          Add a prop as well and watch its type appear in <code>NoticeProps</code>. The entry types the
          implementation; that is the only thing joining the two files.
        </>,
      ],
      apply: { label: 'rename it to Notice', run: () => patch({ name: 'Notice' }) },
    },
    {
      label: (
        <>
          Open the <strong>runtime</strong> pane: the element passes <code>catalog.validate</code> and still
          renders the fallback.
        </>
      ),
      done: sawRuntime.current && catalogCheck?.success === true,
      hint: 'Declaring a name makes it legal. It does not make it render.',
      steps: [
        <>
          Click the <strong>runtime</strong> tab on the right-hand panel.
        </>,
        <>
          Read the top row: <code>catalog.validate(spec)</code> reports{' '}
          <strong>success</strong> and <code>validateSpec(spec)</code> reports <strong>clean</strong>.
        </>,
        <>
          Look at the render below it: the <code>Text</code> renders, and your component is a dashed{' '}
          <em>unknown component</em> box — <code>demoRegistry</code> has no implementation for the name.
        </>,
        <>
          Press <strong>show catalog.jsonSchema()</strong> and compare the two dumps: alone, the props are
          fully described; beside the other components they collapse to{' '}
          <code>additionalProperties</code>. Structured output constrains names, not props.
        </>,
      ],
      apply: { label: 'open the runtime pane', run: () => setTab('runtime') },
    },
  ];

  const stages = stagesFromChecklist(items, BUILD_CATALOG_STAGES);

  const stagedBody = (stage: Stage) => (
    <div className="flex flex-col gap-3 pb-6">

      <div className="grid gap-3 xl:grid-cols-[400px_1fr]">
        {/* ---------------------------------------------------------- editor */}
        <div className="flex flex-col gap-3">
          <Panel
            title="the entry"
            right={<CopyButton text={catalogEntrySource(d)} label="copy as ts" />}
            bodyClassName="flex flex-col gap-3 p-3"
          >
            <label className="flex flex-col gap-1">
              <span className="font-mono text-[10.5px] uppercase tracking-wider text-muted-foreground">name</span>
              <input
                value={d.name}
                onChange={(e) => patch({ name: e.target.value })}
                className="rounded-sm border bg-background px-2 py-1 font-mono text-[13px] text-foreground outline-none focus:border-orange-400"
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className="font-mono text-[10.5px] uppercase tracking-wider text-muted-foreground">
                description · goes into the prompt verbatim
              </span>
              <textarea
                value={d.description}
                rows={3}
                onChange={(e) => patch({ description: e.target.value })}
                className="resize-none rounded-sm border bg-background px-2 py-1 text-[13px] leading-relaxed text-foreground outline-none focus:border-orange-400"
              />
            </label>

            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10.5px] uppercase tracking-wider text-muted-foreground">props</span>
                <button
                  type="button"
                  onClick={() =>
                    setD((prev) => ({
                      ...prev,
                      props: [
                        ...prev.props,
                        { id: nextId(), name: '', kind: 'string', values: '', nullable: true },
                      ],
                    }))
                  }
                  className="ml-auto rounded-sm border bg-surface px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground hover:bg-surface-hover hover:text-foreground"
                >
                  + prop
                </button>
              </div>

              {d.props.length === 0 && (
                <p className="text-[12.5px] text-muted-foreground">No props. The prompt will show {'{ }'}.</p>
              )}

              {d.props.map((p) => (
                <div key={p.id} className="rounded-sm border bg-surface px-2 py-1.5">
                  <div className="flex items-center gap-1.5">
                    <input
                      value={p.name}
                      placeholder="propName"
                      onChange={(e) => patchProp(p.id, { name: e.target.value })}
                      className="min-w-0 flex-1 rounded-sm border bg-background px-1.5 py-0.5 font-mono text-[12px] text-foreground outline-none focus:border-orange-400"
                    />
                    <select
                      value={p.kind}
                      onChange={(e) => patchProp(p.id, { kind: e.target.value as PropKind })}
                      className="rounded-sm border bg-background px-1 py-0.5 font-mono text-[11.5px] text-foreground outline-none"
                    >
                      {PROP_KINDS.map((k) => (
                        <option key={k} value={k}>
                          {k}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      title="remove"
                      onClick={() => setD((prev) => ({ ...prev, props: prev.props.filter((x) => x.id !== p.id) }))}
                      className="rounded-sm border bg-background px-1 py-0.5 font-mono text-[11px] text-muted-foreground hover:text-red-600"
                    >
                      ×
                    </button>
                  </div>

                  <div className="mt-1 flex items-center gap-2">
                    <label className="flex cursor-pointer items-center gap-1 font-mono text-[11.5px] text-muted-foreground">
                      <input
                        type="checkbox"
                        className="size-3 accent-orange-500"
                        checked={p.nullable}
                        onChange={(e) => {
                          patchProp(p.id, { nullable: e.target.checked });
                          setNullableToggles((n) => n + 1);
                        }}
                      />
                      nullable
                    </label>
                    {p.kind === 'enum' && (
                      <input
                        value={p.values}
                        placeholder="info, success, danger"
                        onChange={(e) => patchProp(p.id, { values: e.target.value })}
                        className="min-w-0 flex-1 rounded-sm border bg-background px-1.5 py-0.5 font-mono text-[11.5px] text-foreground outline-none focus:border-orange-400"
                      />
                    )}
                    <span className="ml-auto truncate font-mono text-[11px] text-muted-foreground">
                      {p.name.trim() ? `${p.name.trim()}: ${tsPropType(p)}` : '—'}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-col gap-1.5 border-t pt-2.5">
              <span className="font-mono text-[10.5px] uppercase tracking-wider text-muted-foreground">slots</span>
              <label className="flex cursor-pointer items-center gap-1.5 text-[13px] text-muted-foreground">
                <input
                  type="checkbox"
                  className="size-3.5 accent-orange-500"
                  checked={d.defaultSlot}
                  onChange={(e) => patch({ defaultSlot: e.target.checked })}
                />
                <code className="font-mono text-[12px]">default</code> — accepts children
              </label>
              <input
                value={d.namedSlots.join(', ')}
                placeholder="named slots: actions, footer"
                onChange={(e) =>
                  patch({
                    namedSlots: e.target.value
                      .split(',')
                      .map((s) => s.trim())
                      .filter(Boolean),
                  })
                }
                className="rounded-sm border bg-background px-2 py-1 font-mono text-[12px] text-foreground outline-none focus:border-orange-400"
              />
            </div>

            <div className="flex flex-col gap-1 border-t pt-2.5">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10.5px] uppercase tracking-wider text-muted-foreground">
                  example
                </span>
                <button
                  type="button"
                  onClick={() => patch({ exampleText: JSON.stringify(autoExample(d), null, 2) })}
                  className="ml-auto rounded-sm border bg-surface px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground hover:bg-surface-hover hover:text-foreground"
                >
                  generate
                </button>
              </div>
              <textarea
                value={d.exampleText}
                rows={5}
                placeholder="(blank — the library invents one from the Zod schema)"
                onChange={(e) => patch({ exampleText: e.target.value })}
                spellCheck={false}
                className="resize-none rounded-sm border bg-background px-2 py-1 font-mono text-[12px] leading-relaxed text-foreground outline-none focus:border-orange-400"
              />
              {example.error && (
                <span className="font-mono text-[11px] text-red-600 dark:text-red-400">
                  not JSON: {example.error} — using the generated example
                </span>
              )}
            </div>
          </Panel>

          {errors.length > 0 && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 dark:border-red-900 dark:bg-red-950">
              <div className="font-mono text-[10.5px] uppercase tracking-wider text-red-700 dark:text-red-300">
                problems
              </div>
              <ul className="mt-1 flex flex-col gap-0.5">
                {errors.map((e) => (
                  <li key={e} className="text-[12.5px] leading-snug text-red-700 dark:text-red-300">
                    {e}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* ------------------------------------------------------- consequence */}
        <Panel
          title="what that declaration just caused"
          right={
            <Tabs
              tabs={[
                { id: 'prompt', label: 'prompt' },
                { id: 'contract', label: 'contract' },
                { id: 'runtime', label: 'runtime' },
              ]}
              active={tab}
              onChange={setTab}
            />
          }
          bodyClassName="p-3"
        >
          {!built.ok ? (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 font-mono text-[12.5px] text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
              defineCatalog refused: {built.error}
            </div>
          ) : tab === 'prompt' ? (
            <div className="flex flex-col gap-3">
              <div className="grid gap-2 sm:grid-cols-3">
                <Stat label="prompt chars" value={prompt.length.toLocaleString()} />
                <Stat label="this entry costs" value={`+${delta.toLocaleString()}`} accent />
                <Stat label="≈ tokens added" value={`+${Math.round(delta / 4).toLocaleString()}`} />
              </div>

              <div>
                <Label>your component&rsquo;s line, inside AVAILABLE COMPONENTS</Label>
                <pre className="overflow-x-auto whitespace-pre-wrap rounded-md border bg-surface px-3 py-2 font-mono text-[12.5px] leading-relaxed text-foreground">
                  {line ?? '(not found — the catalog did not build)'}
                </pre>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-[11px] text-muted-foreground">slot guidance:</span>
                {guidance ? (
                  <Pill tone="ok">{guidance}</Pill>
                ) : (
                  <Pill tone="idle">none — no slots declared</Pill>
                )}
              </div>

              <div>
                <Label>every other line that mentions the name</Label>
                <pre className="max-h-[220px] overflow-auto whitespace-pre-wrap rounded-md border bg-surface px-3 py-2 font-mono text-[11.5px] leading-relaxed text-muted-foreground">
                  {mentions(prompt, d.name.trim())
                    .filter((l) => !l.startsWith(`- ${d.name.trim()}: `))
                    .join('\n\n') ||
                    `(none — the sample JSONL is built from the FIRST entries in the components map, currently ${Object.keys(demoComponents).slice(0, 2).join(" and ")})`}
                </pre>
                <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">
                  <code>example</code> is not decoration. The library inlines one component&rsquo;s example prop
                  values verbatim into the sample JSONL at the top of the prompt — it reaches for the first entries in
                  the map. Move yours to the top of <code>demoComponents</code> and those lines become yours, so a
                  careless example teaches a careless habit to every generation.
                </p>
              </div>

              {stage.id === 'schema' && (
                <div className="flex flex-col gap-2 rounded-md border border-l-2 border-l-orange-500 bg-surface px-3 py-2">
                  <p className="text-[13.5px] leading-relaxed">
                    A catalog with <strong>no components at all</strong> still prints{' '}
                    <strong>{SCHEMA_ONLY_PROMPT.length.toLocaleString()}</strong> characters. Every one of
                    them comes from <code>schema</code> — the <code>defineSchema</code> call{' '}
                    <code>@json-render/react</code> exports and you pass as the first argument.
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <ChromeButton active={schemaView === 'rules'} onClick={() => openSchema('rules')}>
                      defaultRules ({DEFAULT_RULES.length})
                    </ChromeButton>
                    <ChromeButton active={schemaView === 'actions'} onClick={() => openSchema('actions')}>
                      builtInActions ({BUILT_IN_ACTIONS.length})
                    </ChromeButton>
                  </div>
                  {schemaView === 'rules' && (
                    <ol className="flex list-decimal flex-col gap-1 pl-5">
                      {DEFAULT_RULES.map((rule) => (
                        <li key={rule} className="text-[12.5px] leading-snug text-muted-foreground">
                          {rule}
                        </li>
                      ))}
                    </ol>
                  )}
                  {schemaView === 'actions' && (
                    <ul className="flex flex-col gap-1">
                      {BUILT_IN_ACTIONS.map((action) => (
                        <li key={action.name} className="text-[12.5px] leading-snug text-muted-foreground">
                          <code className="font-mono text-[12px] text-foreground">{action.name}</code> —{' '}
                          {action.description}
                        </li>
                      ))}
                    </ul>
                  )}
                  {schemaView !== null && (
                    <p className="text-[12.5px] leading-relaxed text-muted-foreground">
                      <code>catalog.actionNames</code> is{' '}
                      <code>[{built.catalog.actionNames.join(', ')}]</code> — not one of the built-ins
                      above is in it. The schema describes them to the model and the runtime implements
                      them, so no handler of yours is ever asked for.
                    </p>
                  )}
                </div>
              )}
            </div>
          ) : tab === 'contract' ? (
            <div className="flex flex-col gap-2">
              <p className="text-[13.5px] leading-relaxed text-muted-foreground">
                <code>defineRegistry(catalog, {'{ components }'})</code> types <code>components</code> as{' '}
                <code>Components&lt;typeof catalog&gt;</code> — one <strong>required</strong> key per catalog entry.
                Adding the entry above breaks the registry file until this exists.
              </p>
              <div className="overflow-hidden rounded-md border">
                <CodeBlock code={contractSource(d)} lang="tsx" maxHeight={420} />
              </div>
            </div>
          ) : (
            <RuntimePane
              spec={runtimeSpec}
              catalogValid={catalogCheck?.success === true}
              catalogError={catalogCheck?.error?.issues?.[0]?.message ?? null}
              specIssues={specCheck.issues.length}
              schemaText={JSON.stringify(
                (built.solo.jsonSchema() as Record<string, never>)?.properties,
                null,
                2,
              )}
              multiSchemaText={JSON.stringify(
                (built.catalog.jsonSchema() as Record<string, never>)?.properties,
                null,
                2,
              )}
            />
          )}
        </Panel>
      </div>
    </div>
  );

  /* Every stage but the last lives in one pane, so arriving opens it. The
   * runtime stage names no `focus` on purpose: opening that pane is its task,
   * and it arrives on the home pane rather than inheriting the previous
   * stage's — leftover chrome is exactly what staging is meant to remove. */
  return (
    <StageFrame
      slug="build-catalog"
      stages={stages}
      onStageChange={(s) => setTab(s.focus ?? 'prompt')}
    >
      {(stage) => stagedBody(stage)}
    </StageFrame>
  );
}

function RuntimePane({
  spec,
  catalogValid,
  catalogError,
  specIssues,
  schemaText,
  multiSchemaText,
}: {
  spec: Spec;
  catalogValid: boolean;
  catalogError: string | null;
  specIssues: number;
  schemaText: string;
  multiSchemaText: string;
}) {
  const [showSchema, setShowSchema] = useState(false);
  const soloProps = extractProps(schemaText);
  const multiProps = extractProps(multiSchemaText);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-[11px] text-muted-foreground">catalog.validate(spec):</span>
        {catalogValid ? <Pill tone="ok">success</Pill> : <Pill tone="bad">{catalogError ?? 'failed'}</Pill>}
        <span className="ml-2 font-mono text-[11px] text-muted-foreground">validateSpec(spec):</span>
        {specIssues === 0 ? <Pill tone="ok">clean</Pill> : <Pill tone="warn">{specIssues} issues</Pill>}
      </div>

      <div className="rounded-md border bg-background p-3">
        <JSONUIProvider registry={demoRegistry} initialState={{}}>
          <Renderer spec={spec} registry={demoRegistry} fallback={UnknownComponent} />
        </JSONUIProvider>
      </div>

      <div className="rounded-md border border-l-2 border-l-orange-500 bg-surface px-3 py-2 text-[13.5px] leading-relaxed">
        Both validators pass and the component still does not render. The catalog decides which{' '}
        <em>names are legal</em>; the registry decides what they <em>draw</em>. Nothing joins them at runtime —
        only TypeScript does, at build time, and only if you do not cast past it. Without a{' '}
        <code>fallback</code> this element would have rendered nothing at all.
      </div>

      <div>
        <button
          type="button"
          onClick={() => setShowSchema((v) => !v)}
          className="rounded-sm border bg-surface px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground hover:bg-surface-hover hover:text-foreground"
        >
          {showSchema ? 'hide' : 'show'} catalog.jsonSchema()
        </button>
        {showSchema && (
          <div className="mt-2 flex flex-col gap-2">
            <div>
              <Label>alone in a catalog — props are fully described</Label>
              <pre className="max-h-[180px] overflow-auto rounded-md border bg-surface px-3 py-2 font-mono text-[11.5px] text-foreground">
                {soloProps}
              </pre>
            </div>
            <div>
              <Label>in the real catalog, next to the other components</Label>
              <pre className="max-h-[120px] overflow-auto rounded-md border bg-surface px-3 py-2 font-mono text-[11.5px] text-foreground">
                {multiProps}
              </pre>
            </div>
            <p className="text-[13px] leading-relaxed text-muted-foreground">
              With two or more components the per-component prop schema collapses to{' '}
              <code>{'{ "type": "object", "additionalProperties": {} }'}</code> — JSON Schema cannot express
              &ldquo;props depend on type&rdquo; here. Structured-output mode therefore constrains the element{' '}
              <em>names</em> only; the prop vocabulary reaches the model through{' '}
              <code>prompt()</code> and nowhere else.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/** Pull the elements-level `props` sub-schema out of a jsonSchema() dump. */
function extractProps(text: string): string {
  try {
    const parsed = JSON.parse(text) as Record<string, unknown>;
    const elements = parsed.elements as Record<string, unknown> | undefined;
    const entry = elements?.additionalProperties as Record<string, unknown> | undefined;
    const props = (entry?.properties as Record<string, unknown> | undefined)?.props;
    return JSON.stringify(props ?? {}, null, 2);
  } catch {
    return text;
  }
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-1 font-mono text-[10.5px] uppercase tracking-wider text-muted-foreground">{children}</div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-md border bg-surface px-2.5 py-1.5">
      <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div
        className={`font-mono text-[16px] tabular-nums ${accent ? 'text-orange-600 dark:text-orange-400' : 'text-foreground'}`}
      >
        {value}
      </div>
    </div>
  );
}
