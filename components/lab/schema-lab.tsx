'use client';

import type { Spec } from '@json-render/core';
import { createStateStore } from '@json-render/core';
import { JSONUIProvider, Renderer } from '@json-render/react';
import { useMemo, useState } from 'react';
import { z } from 'zod';
import { demoComponents } from '@/lib/demo/catalog';
import { demoRegistry, UnknownComponent } from '@/lib/demo/registry';
import { CATALOG_ENTRIES, CATALOG_EXAMPLES, COMPONENT_NAMES } from '@/lib/demo/source.generated';
import { useCatalogLab, useJsonSchemaLab } from './catalog-lab';
import { useValidateLab } from './validate-lab';
import { CodeBlock } from '../playground/code-block';
import { JsonEditor } from '../playground/json-editor';
import { Chip, Panel, Pill } from '../playground/ui';
import type { ChecklistItem } from './checklist';
import { StageFrame } from './stage-frame';
import { stagesFromChecklist } from '@/lib/labs/types';

/**
 * What a catalog IS: the schema for the nodes of the JSON tree.
 *
 * Not "the thing that makes the prompt" — that is a consequence. A catalog
 * entry declares, per component, which props a node of that type may carry and
 * of what type. Everything else (the prompt, the TypeScript types on the
 * registry, catalog.validate) is generated from that one declaration.
 *
 * So this lab puts the three faces of one entry next to each other:
 *   the Zod declaration → the node shape it permits → that node, rendered.
 */

/** Describe a Zod field the way a spec author needs to read it. */
function describe(schema: z.ZodTypeAny): { type: string; required: boolean } {
  try {
    const js = z.toJSONSchema(schema, { io: 'input' }) as Record<string, unknown>;
    const render = (s: Record<string, unknown>): string => {
      if (Array.isArray(s.enum)) return (s.enum as unknown[]).map((v) => JSON.stringify(v)).join(' | ');
      if (Array.isArray(s.anyOf)) return (s.anyOf as Record<string, unknown>[]).map(render).join(' | ');
      if (Array.isArray(s.type)) return (s.type as string[]).join(' | ');
      if (s.type === 'array') return `${render((s.items ?? {}) as Record<string, unknown>)}[]`;
      if (s.type === 'object') return 'object';
      return (s.type as string) ?? 'unknown';
    };
    return { type: render(js), required: true };
  } catch {
    return { type: 'unknown', required: false };
  }
}

/**
 * Three panes, three groups of stages.
 *
 * A stage belongs to exactly ONE pane and scopes the lab to it, so what is on
 * screen is only ever the thing the stage is about. The node schema, the
 * generated prompt and catalog.validate are three separate things a catalog
 * does, and each gets its own run of stages rather than being collapsed into
 * whichever pane happened to be open.
 */
const SCHEMA_STAGES = [
  {
    id: 'schema-orient',
    title: 'Declaration, node, render',
    concept: 'catalog-is-schema',
    when:
      'Add a catalog entry the moment a component should be nameable by a model or by a stored spec — one declaration then feeds the registry types, the prompt and `catalog.validate` together. Keep a component in the registry alone when it is internal plumbing you render by hand: it still works, and no model can ever emit it, which is sometimes exactly what you want.',
    also: ['nullable-not-optional'],
  },
  {
    id: 'schema-break',
    title: 'Props are parsed against Zod',
    when:
      'Declare the prop types for your own code and for the model, which reads them in the prompt. Do not lean on them to police a spec: `catalog.validate` widens props to an open object as soon as the catalog holds more than one component, so anything that would actually break your component has to be parsed inside it, the way the demo TextInput parses `checks`.',
    ref: 'util-catalogvalidate',
    summary:
      'The entry is a Zod object, so the props in a node are parsed against it. Give a declared prop the wrong type and the parse fails — which is the one part of a spec anything checks automatically.',
  },
  {
    id: 'schema-extra',
    title: 'Props nobody declared',
    when:
      'You will reach for an undeclared prop roughly never — it is invisible to the prompt, so no model will send it, and invisible to the next person reading the entry. The one honest use is a host-compiled spec passing something internal through; anything a model should ever emit belongs in the schema, where it is documented by construction.',
    ref: 'el-props',
    summary:
      'An undeclared prop is not stripped and not rejected — it travels in the node and reaches your component like any other. The schema says what MAY be there, not what may not.',
  },
];

const PROMPT_STAGES = [
  {
    id: 'prompt-min',
    title: 'catalog.prompt(), and what it costs',
    concept: 'catalog-prompt-cost',
    when:
      'Call it whenever a model generates specs — it is the only way it learns your components exist. Reach for a SECOND, narrower catalog when the bill justifies it: the string is a prefix on every request, so thirteen components serving a screen that needs four is an argument for splitting per surface, not for shortening descriptions, which are the part doing the work.',
    also: ['prompt-scaffolding'],
    ref: 'util-catalogprompt',
    tasks: 2,
    summary:
      'One feature, both directions: the prompt is generated from the catalog, so cutting it down and putting it back is how you see which half of the bill is your components and which half is fixed scaffolding.',
  },
  {
    id: 'prompt-description',
    title: 'A useless description costs you',
    concept: 'description-is-prompt',
    when:
      'Spend your effort here first when a model keeps picking the wrong component or filling props badly: the description and the example are the only documentation it will ever get, so rewriting one is cheaper than adding a rule for every mistake. Treat the change like a public API change — nothing fails, and every generation moves.',
    also: ['example-in-prompt'],
  },
  {
    id: 'prompt-rules',
    title: 'customRules',
    when:
      '`customRules` is for what is true of your DOMAIN rather than of one component — never invent figures, one root per screen. When the rule is about a single entry it belongs in that entry description instead: a rule that names one component is a description written in the wrong place, and it ships on every request either way.',
    ref: 'util-catalogprompt',
    summary:
      '`customRules` is where your domain overrides the generic instructions the library ships. It is the cheapest place to stop a model inventing figures or emitting two roots.',
  },
  {
    id: 'prompt-actions',
    title: 'The four built-in actions',
    when:
      'Reach for the built-ins — `setState`, `pushState`, `removeState`, `validateForm` — whenever the work is only moving a value around the state model; you write no handler, and they are in the prompt whether you asked for them or not. Declare an action in the catalog as soon as the work leaves that model: a save, a fetch, anything that can fail and needs `onSuccess` or `onError`.',
    ref: 'act-setstate',
    summary:
      'Turning actions off shrinks the AVAILABLE ACTIONS block but never empties it: `setState`, `validateForm`, `push` and `navigate` are injected by the runtime, so a model can always reach for them whether or not you declared them.',
  },
];

/**
 * The schema you HAND a model, as opposed to the prompt you send it. One API,
 * two sides — what it pins down, and where it gives up — so it is one stage
 * with two parts rather than two stages.
 */
const JSONSCHEMA_STAGES = [
  {
    id: 'schema-json',
    title: 'catalog.jsonSchema()',
    concept: 'structured-output-schema',
    when:
      'Only when a provider demands a structured-output schema and will not take instructions in the system prompt. Prefer `catalog.prompt()` with JSONL streaming otherwise: under `strict: true` the `elements` record — which is the entire UI — comes out as an opaque empty object, so the schema constrains the two keys around your tree and nothing inside it.',
    ref: 'util-catalogjsonschema',
    tasks: 2,
    summary:
      'The same catalog exported as JSON Schema, for a provider that enforces one. It names your components and the spec\u2019s two top-level keys \u2014 and under `strict: true` the `elements` record, which is the whole spec, collapses to an empty object.',
  },
];

const VALIDATE_STAGES = [
  {
    id: 'validate-cases',
    title: 'catalog.validate',
    when:
      'Run it on anything a model produced, alongside `validateSpec` rather than instead of it: this one knows your component names, that one knows whether the tree hangs together, and neither covers the other half. Skip it for a spec you compiled in TypeScript from the same catalog, where the compiler has already said the same thing.',
    ref: 'util-catalogvalidate',
    summary:
      '`catalog.validate` is a different tool from `validateSpec`. It parses each node\u2019s props against its entry; it says nothing about whether the tree hangs together.',
  },
  {
    id: 'validate-types',
    title: 'It checks names, not types',
    concept: 'validate-names-only',
    when:
      'Trust it for exactly one question — is every `type` a component you actually wrote — which is the mistake a model makes most. Do not reach for it for prop types or action names: with more than one component the props widen to an open object, and an `on` binding naming a handler nobody implemented passes clean, so those need a parse in the component and a check against your own handler map.',
    tasks: 2,
    summary:
      'One feature, both sides: props of the wrong type sail through, and so does an action that does not exist — but rename a component to something the catalog never declared and it is rejected outright. The name is the one thing it is certain about.',
  },
];

/** Which pane each stage belongs to. */
const PANE_OF: Record<string, 'schema' | 'prompt' | 'jsonschema' | 'validate'> = Object.fromEntries([
  ...SCHEMA_STAGES.map((s) => [s.id, 'schema' as const]),
  ...PROMPT_STAGES.map((s) => [s.id, 'prompt' as const]),
  ...JSONSCHEMA_STAGES.map((s) => [s.id, 'jsonschema' as const]),
  ...VALIDATE_STAGES.map((s) => [s.id, 'validate' as const]),
]);

export function SchemaLab() {
  /**
   * Three first-class views of the same object, not one with the others hidden
   * in a notes drawer. The schema view is what a catalog IS; the prompt view is
   * the most consequential thing it produces; catalog.validate is the check
   * everyone assumes covers them and does not. All three are features.
   */
  // The pane is derived from the stage the learner is on — never stored.
  // A stored copy can drift out of step with the rail; a derived one cannot.
  type Pane = 'schema' | 'prompt' | 'jsonschema' | 'validate';
  const [name, setName] = useState('Metric');
  const [seen, setSeen] = useState<Set<string>>(new Set(['Metric']));
  const [nodeText, setNodeText] = useState(() => JSON.stringify(CATALOG_EXAMPLES.Metric ?? {}, null, 2));
  const [edited, setEdited] = useState(false);

  const store = useMemo(() => createStateStore({ form: { email: '', country: 'fi' }, user: { name: 'Ada' } }), []);

  const fields = useMemo(() => {
    const def = demoComponents[name as keyof typeof demoComponents];
    const shape = (def?.props as z.ZodObject<Record<string, z.ZodTypeAny>>)?.shape ?? {};
    return Object.entries(shape).map(([k, v]) => {
      const { type } = describe(v as z.ZodTypeAny);
      const optional = type.includes('null') || (v as z.ZodTypeAny).safeParse(undefined).success;
      return { key: k, type, optional };
    });
  }, [name]);

  const parsed = useMemo(() => {
    try {
      return { ok: true as const, value: JSON.parse(nodeText) as Record<string, unknown> };
    } catch (e) {
      return { ok: false as const, error: (e as Error).message };
    }
  }, [nodeText]);

  /** Does the node the learner typed actually satisfy the catalog's schema? */
  const check = useMemo(() => {
    if (!parsed.ok) return null;
    const def = demoComponents[name as keyof typeof demoComponents];
    const r = (def?.props as z.ZodTypeAny)?.safeParse(parsed.value);
    if (!r) return null;
    if (r.success) return { ok: true as const };
    return {
      ok: false as const,
      issues: r.error.issues.slice(0, 5).map((i) => `${i.path.join('.') || '(root)'} — ${i.message}`),
    };
  }, [parsed, name]);

  /**
   * Keys the learner typed that the catalog never declared. Zod objects are
   * NOT strict here, so these pass safeParse AND reach the component — which
   * is the whole point of the third checklist item.
   */
  const extraProps = useMemo(() => {
    if (!parsed.ok || typeof parsed.value !== 'object' || parsed.value === null) return [];
    const declared = new Set(fields.map((f) => f.key));
    return Object.keys(parsed.value).filter((k) => !declared.has(k));
  }, [parsed, fields]);

  const needsChild = name === 'Screen' || name === 'Stack' || name === 'Card';
  const spec: Spec | null = parsed.ok
    ? {
        root: 'node',
        elements: {
          node: { type: name, props: parsed.value, children: needsChild ? ['kid'] : [] },
          ...(needsChild
            ? { kid: { type: 'Text', props: { value: 'a child element', tone: null, size: null }, children: [] } }
            : {}),
        },
      }
    : null;

  function pick(n: string) {
    setName(n);
    setSeen((prev) => new Set(prev).add(n));
    setNodeText(JSON.stringify(CATALOG_EXAMPLES[n] ?? {}, null, 2));
    setEdited(false);
  }

  const items: ChecklistItem[] = [
    {
      label: (
        <>
          Get oriented: click three entries and read left to right — the Zod declaration, the JSON node it
          permits, that node rendered. One declaration, three consequences.
        </>
      ),
      done: seen.size >= 3,
      hint: 'Rule: a catalog entry is the schema for a node in the tree. defineRegistry types your React from it, catalog.prompt() serialises it for the model, and catalog.validate() checks names against it.',
      steps: [
        <>
          Read the three panels left to right: <strong>1 · the declaration</strong>,{' '}
          <strong>2 · the node it permits</strong>, <strong>3 · rendered</strong>. All three are the same{' '}
          <code>Metric</code> entry.
        </>,
        <>
          Click <strong>Badge</strong> on the <strong>entry</strong> row at the top.
        </>,
        <>
          Read panel 1: the Zod declaration copied out of <code>lib/demo/catalog.ts</code> — for Badge,{' '}
          <code>label: z.string()</code> and a nullable <code>tone</code>.
        </>,
        <>
          Read panel 2: the field/type table above the editor is that same declaration, and the JSON under it
          is the entry&rsquo;s own <code>example</code>.
        </>,
        <>
          Click <strong>Button</strong>, then <strong>TextInput</strong>. Three entries seen — the dot for this
          task turns green.
        </>,
      ],
      apply: {
        label: 'click three for me',
        run: () => {
          pick('Badge');
          pick('Button');
        },
      },
    },
    {
      label: (
        <>
          Break the middle column on purpose — make <code>label</code> a number. The schema badge goes red, so
          something clearly knows the shape is wrong.
        </>
      ),
      done: edited && check?.ok === false,
      hint: 'Rule: that badge is this lab calling props.safeParse() by hand. Nothing in json-render does it for you.',
      steps: [
        <>
          Click <strong>Metric</strong> on the <strong>entry</strong> row.
        </>,
        <>
          In panel 2&rsquo;s editor, change <code>"label": "Revenue"</code> to <code>"label": 123</code>.
        </>,
        <>
          Watch the pill at the top right of panel 2 flip from <strong>matches schema</strong> to{' '}
          <strong>violates schema</strong>.
        </>,
        <>
          Read the red strip along the bottom of panel 2: one line naming <code>label</code> and the type it
          expected.
        </>,
      ],
      apply: {
        label: 'break it for me',
        run: () => {
          pick('Metric');
          setNodeText(
            JSON.stringify(
              { ...(CATALOG_EXAMPLES.Metric as Record<string, unknown>), label: 123 },
              null,
              2,
            ),
          );
          setEdited(true);
        },
      },
    },
    {
      label: (
        <>
          Now add a prop the catalog never declared — <code>&quot;nonsense&quot;: true</code> — and look at the
          third column. It still renders. The Zod schema types your code and writes the prompt; it never
          guards the tree.
        </>
      ),
      done: extraProps.length > 0,
      hint: 'Rule: if a wrong prop type matters, parse it in the component. This playground\u2019s TextInput does exactly that with props.checks.',
      steps: [
        <>
          In panel 2&rsquo;s editor, add a line inside the object: <code>&quot;nonsense&quot;: true</code>.
        </>,
        <>
          Look at the pill at the top right of panel 2. It still says <strong>matches schema</strong> — a Zod
          object ignores keys it does not declare.
        </>,
        <>
          Look at panel 3, <strong>3 · rendered</strong>: the component rendered, and the undeclared prop was
          handed straight to it.
        </>,
        <>
          Read the grey note under it — nothing checks props against the catalog at render time.
        </>,
        // The pane follows the stage now, so the other thing that misses this
        // is a stage on the rail rather than a chip in this pane.
        <>
          Stage 9, <strong>catalog.validate</strong> on the rail, is the other thing that does not check them
          either.
        </>,
      ],
      apply: {
        label: 'add the prop for me',
        run: () => {
          setNodeText(
            JSON.stringify(
              { ...(CATALOG_EXAMPLES[name] as Record<string, unknown>), nonsense: true },
              null,
              2,
            ),
          );
          setEdited(true);
        },
      },
    },
  ];

  // The other two panes own their own tasks, so they hand them up rather than
  // the parent guessing at them.
  const prompt = useCatalogLab();
  const jsonSchema = useJsonSchemaLab();
  const validate = useValidateLab();

  const stages = [
    ...stagesFromChecklist(items, SCHEMA_STAGES),
    ...stagesFromChecklist(prompt.items, PROMPT_STAGES),
    ...stagesFromChecklist(jsonSchema.items, JSONSCHEMA_STAGES),
    ...stagesFromChecklist(validate.items, VALIDATE_STAGES),
  ];

  const paneBody = (view: Pane) => (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="flex items-center gap-1.5 overflow-x-auto rounded-lg border bg-card px-3 py-2">
        {view === 'schema' && (
          <>
            <span className="ml-2 shrink-0 font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
              entry
            </span>
            {COMPONENT_NAMES.map((n) => (
              <Chip key={n} active={n === name} onClick={() => pick(n)}>
                {n}
              </Chip>
            ))}
          </>
        )}
        {view === 'prompt' && (
          <span className="ml-2 text-[12.5px] text-muted-foreground">
            The same entries, serialised by <code className="font-mono text-foreground">catalog.prompt()</code>.
          </span>
        )}
        {view === 'jsonschema' && (
          <span className="ml-2 text-[12.5px] text-muted-foreground">
            The same entries, exported as JSON Schema by{' '}
            <code className="font-mono text-foreground">catalog.jsonSchema()</code>.
          </span>
        )}
        {view === 'validate' && (
          <span className="ml-2 text-[12.5px] text-muted-foreground">
            The same entries, compiled into a spec schema by{' '}
            <code className="font-mono text-foreground">catalog.validate()</code>.
          </span>
        )}
      </div>

      {view === 'prompt' && (
        <div className="min-h-0 flex-1 overflow-auto">
          {prompt.body}
        </div>
      )}

      {view === 'jsonschema' && (
        <div className="min-h-0 flex-1 overflow-auto">
          {jsonSchema.body}
        </div>
      )}

      {view === 'validate' && (
        <div className="min-h-0 flex-1 overflow-auto">
          {validate.body}
        </div>
      )}

      {view === 'schema' && (
      <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-3">
        <Panel
          title={
            <span className="flex items-center gap-1.5">
              <span className="size-1.5 rounded-full bg-blue-500" aria-hidden />1 · the declaration
            </span>
          }
          bodyClassName="flex flex-col overflow-hidden"
        >
          <div className="border-b bg-muted px-3 py-1.5 text-[12px] text-muted-foreground">
            Zod, in <code className="font-mono text-foreground">lib/demo/catalog.ts</code>.
          </div>
          <div className="min-h-0 flex-1 overflow-auto">
            <CodeBlock code={CATALOG_ENTRIES[name] ?? ''} lang="typescript" maxHeight="none" showLineNumbers={false} />
          </div>
        </Panel>

        <Panel
          title={
            <span className="flex items-center gap-1.5">
              <span className="size-1.5 rounded-full bg-blue-500" aria-hidden />2 · the node it permits
            </span>
          }
          bodyClassName="flex flex-col overflow-hidden"
          right={
            check ? (
              check.ok ? (
                <Pill tone="ok">matches schema</Pill>
              ) : (
                <Pill tone="bad">violates schema</Pill>
              )
            ) : null
          }
        >
          <table className="w-full max-h-[34%] shrink-0 border-collapse border-b text-[12.5px]">
            <tbody>
              {fields.map((f) => (
                <tr key={f.key}>
                  <td className="border-b px-3 py-1 font-mono text-foreground">{f.key}</td>
                  <td className="border-b px-2 py-1 font-mono text-[11.5px] text-blue-600 dark:text-blue-400">
                    {f.type}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="min-h-0 flex-1 overflow-hidden">
            <JsonEditor
              value={nodeText}
              onChange={(v) => {
                setNodeText(v);
                setEdited(true);
              }}
            />
          </div>
          {check && !check.ok && (
            <div className="shrink-0 border-t bg-red-50 px-3 py-1.5 font-mono text-[11px] text-red-700 dark:bg-red-950 dark:text-red-300">
              {check.issues.map((i) => (
                <div key={i}>{i}</div>
              ))}
            </div>
          )}
        </Panel>

        <Panel
          title={
            <span className="flex items-center gap-1.5">
              <span className="size-1.5 rounded-full bg-emerald-500" aria-hidden />3 · rendered
            </span>
          }
          bodyClassName="overflow-auto jr-canvas"
        >
          <div className="p-4">
            {spec ? (
              <JSONUIProvider registry={demoRegistry} store={store}>
                <Renderer spec={spec} registry={demoRegistry} fallback={UnknownComponent} />
              </JSONUIProvider>
            ) : (
              <span className="font-mono text-[12px] text-yellow-600 dark:text-yellow-400">invalid JSON</span>
            )}
          </div>
          {check && !check.ok && (
            <div className="border-t bg-muted px-3 py-2 text-[12.5px] leading-relaxed text-muted-foreground">
              <strong className="text-foreground">It rendered anyway.</strong> The Zod schema types your registry
              and writes the prompt. Nothing checks it against a spec at render time — not even{' '}
              <code>catalog.validate()</code>.
            </div>
          )}
        </Panel>
      </div>
      )}
    </div>
  );

  return (
    <StageFrame
      slug="catalog"
      stages={stages}
    >
      {(stage) => paneBody(PANE_OF[stage.id] ?? 'schema')}
    </StageFrame>
  );
}
